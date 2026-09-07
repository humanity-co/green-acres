# SOCIETY OS — EXHAUSTIVE SYSTEM AUDIT REPORT (2026)
**Platform**: Multi-Tenant Gated Community OS (MyGate / Living Room Inspired)  
**Target Codebase**: `GREEN ACRES`  
**Audit Scope**: End-to-end inspection of 78 API routes, 58 UI pages/cockpits, Database Schemas, PostgreSQL Catalog, Row Level Security policies, Offline Guard System, Authentication, and Financial Workflows.  
**Rule Compliance**: Strict verification against permanent engineering rules in [AGENTS.md](file:///c:/Users/Varad%20Deshpande/Desktop/GREEN%20ACRES/AGENTS.md).  
**Methodology**: Line-by-line source code inspection, live PostgreSQL catalog queries, automated verification test runs, and structural attack-surface modeling. Zero assumptions.

---

## EXECUTIVE SUMMARY & SEVERITY DASHBOARD

An exhaustive forensic audit of the entire Society OS codebase revealed **30 critical, high, medium, and operational issues** across all system tiers.

| Severity Level | Verified Count | Primary Domains Affected |
| :--- | :---: | :--- |
| **P0 — Critical / Blocker** | **7** | RLS engine bypass via `rolbypassrls`, Unprotected tenant table (`vehicle_entries`), Webhook fraudulent payment settlement, CSP blocking Razorpay SDK, Helpdesk enum state machine crash, Walk-in guard consent bypass, Amenity capacity race conditions. |
| **P1 — High Priority** | **8** | Cross-unit visitor invite IDOR, Global visitor pass & entry code leak, Inverted domestic help phone privacy, Unprotected resident pages in middleware, Mock payment signature verification crash, Offline sync skipping deliveries & staff, Serverless notification drop risk, Unlinked / orphaned booking bills. |
| **P2 — Medium Priority** | **9** | Sequential N+1 query cascades (1,500 queries on export), Unbounded `SELECT * FROM societies` memory leak, Broken in-memory resident search pagination, Hardcoded fallback units ("A-101") & society names, Unchecked cross-society unit creation, Role navigation lockouts for multi-role users, Missing society switcher in UI, Command Palette privilege leakage, Deliveries resident gate-bypass. |
| **P3 — Low / Clean-Up** | **6** | Cryptic UUIDs in CSV exports, `twilio` OTP provider returns mock silently, Dead table (`test_votes`) in DB catalog, Missing online `idempotencyKey` parameter, Non-notified family members in walk-ins, Sub-optimal database indexes. |

---

## 1. MULTI-TENANCY, DATABASE & ROW LEVEL SECURITY (RLS)

### 1.1 [P0] `vehicle_entries` Table Completely Lacks Row Level Security & Policies
- **Source Code**: [`drizzle/0005_safe_luminals.sql:1-14`](file:///c:/Users/Varad%20Deshpande/Desktop/GREEN%20ACRES/drizzle/0005_safe_luminals.sql#L1-L14), [`scripts/apply_0005_migration.ts:28-43`](file:///c:/Users/Varad%20Deshpande/Desktop/GREEN%20ACRES/scripts/apply_0005_migration.ts#L28-L43)
- **Live Database State**: PostgreSQL catalog query confirmed:
  ```json
  {
    "relname": "vehicle_entries",
    "relrowsecurity": false,
    "relforcerowsecurity": false
  }
  ```
  Policies on `vehicle_entries`: `[]` (Zero policies).
- **Vulnerability Mechanics**: When the `vehicle_entries` table was created in migration `0005` and `apply_0005_migration.ts`, the migration executed `CREATE TABLE vehicle_entries` with `society_id`, but omitted `ALTER TABLE vehicle_entries ENABLE ROW LEVEL SECURITY;`, `ALTER TABLE vehicle_entries FORCE ROW LEVEL SECURITY;`, and all tenant RLS policies (`vehicle_entries_tenant_select/insert/update/delete`).
- **Impact**: Any direct database query or route without manual tenant filtering will return or mutate vehicle entry logs across ALL societies in the database.
- **Remediation**:
  ```sql
  ALTER TABLE vehicle_entries ENABLE ROW LEVEL SECURITY;
  ALTER TABLE vehicle_entries FORCE ROW LEVEL SECURITY;
  CREATE POLICY "vehicle_entries_tenant_select" ON "vehicle_entries" FOR SELECT USING (society_id = nullif(current_setting('app.society_id', true), '')::uuid);
  CREATE POLICY "vehicle_entries_tenant_insert" ON "vehicle_entries" FOR INSERT WITH CHECK (society_id = nullif(current_setting('app.society_id', true), '')::uuid);
  CREATE POLICY "vehicle_entries_tenant_update" ON "vehicle_entries" FOR UPDATE USING (society_id = nullif(current_setting('app.society_id', true), '')::uuid);
  CREATE POLICY "vehicle_entries_tenant_delete" ON "vehicle_entries" FOR DELETE USING (society_id = nullif(current_setting('app.society_id', true), '')::uuid);
  ```

---

### 1.2 [P0] Application Database Connection Connects as Table Owner with `rolbypassrls = true`
- **Source Code**: [`.env:1-2`](file:///c:/Users/Varad%20Deshpande/Desktop/GREEN%20ACRES/.env#L1-L2), [`src/lib/db.ts:5-18`](file:///c:/Users/Varad%20Deshpande/Desktop/GREEN%20ACRES/src/lib/db.ts#L5-L18)
- **Live Database State**:
  ```json
  {
    "rolname": "neondb_owner",
    "rolbypassrls": true
  }
  ```
- **Vulnerability Mechanics**: Per PostgreSQL official documentation: *"The superuser and roles with the BYPASSRLS attribute always bypass the row security system when accessing a table, even if FORCE ROW LEVEL SECURITY is set on the table."* In `.env`, `APP_DATABASE_URL` is set to `neondb_owner`. Because `neondb_owner` possesses `rolbypassrls = true`, the PostgreSQL RLS policy evaluation engine is completely bypassed for every query run by the application runtime pool `db`.
- **Violation of Source of Truth**: [`AGENTS.md Rule 3`](file:///c:/Users/Varad%20Deshpande/Desktop/GREEN%20ACRES/AGENTS.md) explicitly mandates isolation enforced by PostgreSQL RLS via a restricted runtime user. Although `app_user` with `NOBYPASSRLS` was defined in [`scripts/create_app_user.sql`](file:///c:/Users/Varad%20Deshpande/Desktop/GREEN%20ACRES/scripts/create_app_user.sql) and exists in the DB, `.env` was never pointed to it.
- **Remediation**: Update `APP_DATABASE_URL` in `.env` to connect using `app_user` credentials with `NOBYPASSRLS`. Keep `DATABASE_URL` as `neondb_owner` strictly for migrations.

---

### 1.3 [P1] Direct Unscoped Queries in Route Handlers Bypassing `withTenant()`
- **Files**:
  - [`src/app/api/units/[id]/route.ts:10, 15, 20`](file:///c:/Users/Varad%20Deshpande/Desktop/GREEN%20ACRES/src/app/api/units/%5Bid%5D/route.ts#L10)
  - [`src/app/api/emergency/route.ts:54`](file:///c:/Users/Varad%20Deshpande/Desktop/GREEN%20ACRES/src/app/api/emergency/route.ts#L54)
  - [`src/app/api/auth/me/route.ts:14`](file:///c:/Users/Varad%20Deshpande/Desktop/GREEN%20ACRES/src/app/api/auth/me/route.ts#L14)
  - [`src/app/api/auth/switch-society/route.ts:18`](file:///c:/Users/Varad%20Deshpande/Desktop/GREEN%20ACRES/src/app/api/auth/switch-society/route.ts#L18)
- **Vulnerability Mechanics**: These endpoints execute queries on `db` without wrapping the call in `withTenant(societyId, userId, async (tx) => ...)`. Consequently, `SET LOCAL app.society_id` and `SET LOCAL app.user_id` are never set for the session transaction. Once `app_user` with active RLS is enforced, queries in these routes will evaluate `current_setting('app.society_id')` as null, returning 0 rows or failing check constraints.
- **Remediation**: Wrap all database queries in `withTenant()`. In `switch-society/route.ts` and `auth/me/route.ts`, use `ownerDb` explicitly where tenant context has not yet been selected.

---

### 1.4 [P2] Unchecked Cross-Society Foreign Key Association During Unit Creation
- **File**: [`src/app/api/units/route.ts:20, 26-32`](file:///c:/Users/Varad%20Deshpande/Desktop/GREEN%20ACRES/src/app/api/units/route.ts#L20)
- **Vulnerability Mechanics**: `createSchema` validates that `buildingId` and `floorId` are valid UUIDs. However, the handler does not verify that `buildingId` belongs to `societyId`, nor that `floorId` belongs to `buildingId`. An admin in Society A can submit a unit payload referencing a `buildingId` and `floorId` from Society B.
- **Impact**: Cross-tenant data corruption where a unit in Society A is orphaned or attached to buildings belonging to Society B.
- **Remediation**: Query `buildings` and `floors` with `and(eq(buildings.id, buildingId), eq(buildings.societyId, societyId))` before inserting the unit.

---

## 2. PAYMENTS & FINANCIAL LEDGER INTEGRITY

### 2.1 [P0] Razorpay Webhook Marks Failed Payments as SUCCESS (Zero Event Type Validation)
- **File**: [`src/app/api/payments/webhook/route.ts:30-105`](file:///c:/Users/Varad%20Deshpande/Desktop/GREEN%20ACRES/src/app/api/payments/webhook/route.ts#L30-L105)
- **Vulnerable Code**:
  ```typescript
  const event = payload.event || payload.entity;
  ...
  const [payment] = await ownerDb.select().from(payments).where(eq(payments.gatewayRef, razorpayOrderId));
  ...
  const [updatedPayment] = await tx.update(payments).set({
    status: "SUCCESS",
    rawPayload: { ... },
  }).where(eq(payments.id, payment.id)).returning();
  ...
  const [ub] = await tx.update(bills).set({ status: newBillStatus }).where(eq(bills.id, bill.id)).returning();
  ```
- **Vulnerability Mechanics**: The webhook handler verifies the HMAC signature and extracts `razorpayOrderId`. However, **it NEVER checks `payload.event`**. Razorpay dispatches webhooks for all payment events, including `payment.failed`, `payment.authorized`, and `payment.captured`. When an attempted payment fails (e.g. insufficient funds, card declined), Razorpay dispatches a valid signed `payment.failed` webhook. This endpoint parses `order_id`, transitions the payment status to `"SUCCESS"`, marks the bill as `"PAID"`, and sends a success notification.
- **Financial Impact**: Any user who initiates a payment and enters a declined card or cancels at the gateway gets their society maintenance dues cleared for free.
- **Remediation**:
  ```typescript
  if (event !== "payment.captured" && event !== "order.paid") {
    if (event === "payment.failed") {
      await tx.update(payments).set({ status: "FAILED", rawPayload: payload }).where(eq(payments.id, payment.id));
    }
    return NextResponse.json({ received: true, ignored: event });
  }
  ```

---

### 2.2 [P0] Razorpay Checkout Script Blocked by Content Security Policy (CSP)
- **Files**: [`middleware.ts:33`](file:///c:/Users/Varad%20Deshpande/Desktop/GREEN%20ACRES/middleware.ts#L33), [`src/app/bills/[id]/page.tsx:22`](file:///c:/Users/Varad%20Deshpande/Desktop/GREEN%20ACRES/src/app/bills/%5Bid%5D/page.tsx#L22)
- **Vulnerable Code**:
  In `middleware.ts`:
  ```typescript
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net",
    ...
  ].join('; ');
  ```
  In `src/app/bills/[id]/page.tsx`:
  ```typescript
  script.src = "https://checkout.razorpay.com/v1/checkout.js";
  ```
- **Failure Mechanics**: The CSP header strictly limits `script-src` to `'self'`, `'unsafe-inline'`, `'unsafe-eval'`, and `https://cdn.jsdelivr.net`. It completely omits `https://checkout.razorpay.com`. The browser's security engine blocks `checkout.js` from loading with a CSP violation error.
- **Impact**: Real Razorpay payments can never be launched in production browsers.
- **Remediation**: Add `https://checkout.razorpay.com` to `script-src`, `frame-src https://api.razorpay.com`, and `connect-src https://lumberjack.razorpay.com` in `middleware.ts`.

---

### 2.3 [P1] Mock Payment Verification Signature Mismatch Crash
- **Files**: [`src/app/bills/[id]/page.tsx:77`](file:///c:/Users/Varad%20Deshpande/Desktop/GREEN%20ACRES/src/app/bills/%5Bid%5D/page.tsx#L77), [`src/lib/payments/provider.ts:48-50`](file:///c:/Users/Varad%20Deshpande/Desktop/GREEN%20ACRES/src/lib/payments/provider.ts#L48-L50)
- **Vulnerable Code**:
  In `bills/[id]/page.tsx`:
  ```typescript
  body: JSON.stringify({
    razorpay_order_id: orderData.orderId,
    razorpay_payment_id: fakePaymentId,
    razorpay_signature: "mock_signature",
    paymentId: orderData.paymentId,
  })
  ```
  In `payments/provider.ts`:
  ```typescript
  verifySignature({ orderId, paymentId, signature }) {
    const secret = getEnv("RAZORPAY_KEY_SECRET") || "mock_secret";
    const expected = createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
    return expected === signature;
  }
  ```
- **Failure Mechanics**: When the frontend falls back to mock payment simulation, it sends the literal string `"mock_signature"`. But `mockProvider.verifySignature` computes an HMAC-SHA256 hash using the secret `"mock_secret"` (producing a 64-character hex digest). The comparison `expected === signature` evaluates to `false`, and `/api/payments/verify` returns HTTP 400 "Invalid signature".
- **Impact**: Developers and QA cannot complete mock payment workflows in development mode.
- **Remediation**: Allow `signature === "mock_signature"` in `mockProvider.verifySignature` when `process.env.PAYMENT_GATEWAY === "mock" && process.env.NODE_ENV !== "production"`.

---

### 2.4 [P1] Orphaned Bills & Missing Refunds on Amenity Booking Cancellations
- **Files**: [`src/app/api/bookings/route.ts:131-144`](file:///c:/Users/Varad%20Deshpande/Desktop/GREEN%20ACRES/src/app/api/bookings/route.ts#L131-L144), [`src/app/api/bookings/[id]/route.ts:40-71, 73-90`](file:///c:/Users/Varad%20Deshpande/Desktop/GREEN%20ACRES/src/app/api/bookings/%5Bid%5D/route.ts#L40-L71)
- **Vulnerability Mechanics**: When a resident books a paid amenity, `POST /api/bookings` auto-generates a `bill` for the fee. However, the generated `bill.id` is not saved on `bookings.paymentId` or tracked in a relationship table. When a user cancels the booking (`PATCH /api/bookings/[id]` with `status: "CANCELLED"`) or deletes it (`DELETE /api/bookings/[id]`):
  1. The bill is never cancelled. It remains in `ISSUED` status and eventually becomes `OVERDUE` against the resident's flat.
  2. If the resident had already paid the bill, no refund (`provider.refund()`) is initiated or logged.
- **Remediation**: Link `bill.id` to `bookings.billId` in the schema. When a booking is cancelled, check bill status: if unpaid, set `bills.status = "CANCELLED"`; if paid, initiate a refund transaction via `provider.refund()` and record an audit log.

---

### 2.5 [P0] Amenity Slot Booking Capacity Race Condition Under `READ COMMITTED`
- **File**: [`src/app/api/bookings/route.ts:108-127`](file:///c:/Users/Varad%20Deshpande/Desktop/GREEN%20ACRES/src/app/api/bookings/route.ts#L108-L127)
- **Vulnerable Code**:
  ```typescript
  const [{ activeCount }] = await tx
    .select({ activeCount: count() })
    .from(bookings)
    .where(and(...whereConditions));

  if (Number(activeCount) >= amenity.capacity) {
    throw Object.assign(new Error(`Slot fully booked`), { code: "CAPACITY_FULL" });
  }

  const [created] = await tx.insert(bookings).values({ ... }).returning();
  ```
- **Vulnerability Mechanics**: Under PostgreSQL default `READ COMMITTED` isolation level, concurrent transactions do not lock the count. If an amenity has capacity 10 and currently has 9 bookings, two residents submitting bookings simultaneously will both read `activeCount = 9 < 10`, pass the check, and both insert. The amenity slot ends up with 11 bookings, violating the physical capacity limit.
- **Remediation**: Execute `SELECT * FROM amenities WHERE id = amenityId FOR UPDATE` at the beginning of the transaction to lock the amenity row, or use PostgreSQL advisory locks `pg_advisory_xact_lock(hashtext(amenityId || slotId || bookingDate))`.

---

## 3. GATE SECURITY & OFFLINE GUARD MODE

### 3.1 [P0] Walk-In Resident Approval Bypass in Gate Check-In Endpoint
- **Files**: [`src/app/api/guard/check-in/route.ts:37-43`](file:///c:/Users/Varad%20Deshpande/Desktop/GREEN%20ACRES/src/app/api/guard/check-in/route.ts#L37-L43), [`src/app/api/guard/verify/route.ts:42`](file:///c:/Users/Varad%20Deshpande/Desktop/GREEN%20ACRES/src/app/api/guard/verify/route.ts#L42)
- **Vulnerable Code**:
  In `guard/check-in/route.ts`:
  ```typescript
  const [invite] = await tx.select().from(visitorInvites).where(...);
  if (!invite) throw new Error("Invite not found");
  if (invite.status === "CANCELLED" || invite.status === "REJECTED") throw new Error("Invite cancelled/rejected");
  if (new Date(invite.validTo) < new Date()) throw new Error("Invite expired");
  const existing = await tx.select().from(visitorEntries).where(eq(visitorEntries.inviteId, invite.id));
  if (existing.some(e => !e.checkOut)) throw new Error("Already checked in");
  ```
  In `guard/verify/route.ts`:
  ```typescript
  if (invite.status !== "PENDING" && invite.status !== "APPROVED") return NextResponse.json({ ... }, { status: 409 });
  return NextResponse.json({ invite, visitor: maskedVisitor, unit, status: "READY" });
  ```
- **Vulnerability Mechanics**: In [`guard/walk-in/route.ts`](file:///c:/Users/Varad%20Deshpande/Desktop/GREEN%20ACRES/src/app/api/guard/walk-in/route.ts), walk-in invites are created with `status: "PENDING"` so the resident must approve. However, in `guard/check-in/route.ts`, the check **never validates `status === "APPROVED"`**. It only rejects if status is `CANCELLED` or `REJECTED`. Furthermore, `guard/verify` returns `status: "READY"` for `PENDING` passes.
- **Physical Security Impact**: A guard can log an unannounced walk-in visitor and immediately click Check-In, checking the stranger into the estate without waiting for resident consent.
- **Remediation**:
  ```typescript
  if (invite.status !== "APPROVED") {
    throw new Error("Cannot check in: Invite has not been approved by resident");
  }
  ```

---

### 3.2 [P1] Guard Console Expected Visitors Query Excludes Approved Passes
- **File**: [`src/app/api/guard/expected/route.ts:15`](file:///c:/Users/Varad%20Deshpande/Desktop/GREEN%20ACRES/src/app/api/guard/expected/route.ts#L15)
- **Vulnerable Code**:
  ```typescript
  const invites = await tx.select().from(visitorInvites).where(and(eq(visitorInvites.societyId, societyId), eq(visitorInvites.status, "PENDING")))...
  ```
- **Defect**: The expected visitor feed queries strictly `eq(visitorInvites.status, "PENDING")`. As soon as a resident approves a visitor pass via `/api/invites/[id]/respond` (which updates `status = "APPROVED"`), the invite **completely disappears from the guard's Expected Visitors list**!
- **Impact**: Guards cannot see scheduled, approved guests on their terminal feed.
- **Remediation**: Update query to `inArray(visitorInvites.status, ["PENDING", "APPROVED"])`.

---

### 3.3 [P1] Walk-In Notifications Silently Dropped When No Resident Marked as Primary
- **File**: [`src/app/api/guard/walk-in/route.ts:65-74`](file:///c:/Users/Varad%20Deshpande/Desktop/GREEN%20ACRES/src/app/api/guard/walk-in/route.ts#L65-L74)
- **Vulnerable Code**:
  ```typescript
  const [primary] = await tx
    .select({ userId: unitMembers.userId })
    .from(unitMembers)
    .innerJoin(users, eq(users.id, unitMembers.userId))
    .where(and(
      eq(unitMembers.unitId, unit.id),
      eq(unitMembers.societyId, societyId),
      eq(unitMembers.isPrimary, true),
    ));
  if (primary?.userId) {
    await tx.insert(notifications).values({ ... });
  }
  ```
- **Defect**: In `unitMembers` schema, `isPrimary` defaults to `false`. If an apartment unit's residents were registered without explicitly setting `isPrimary: true`, `primary` evaluates to `undefined`. As a result, **zero notifications are sent**, and the walk-in visitor is stranded at the gate forever.
- **Remediation**: Query all members of the unit and send notifications to all registered residents of that flat.

---

### 3.4 [P1] Offline Sync Loop Ignores Delivery and Domestic Help Queue Items
- **Files**: [`src/app/guard/page.tsx:57-85`](file:///c:/Users/Varad%20Deshpande/Desktop/GREEN%20ACRES/src/app/guard/page.tsx#L57-L85), [`src/lib/offline/db.ts:21-26`](file:///c:/Users/Varad%20Deshpande/Desktop/GREEN%20ACRES/src/lib/offline/db.ts#L21-L26)
- **Defect**:
  In `src/lib/offline/db.ts`, `OfflineActionType` defines:
  `"VISITOR_CHECKIN" | "VISITOR_CHECKOUT" | "DELIVERY_LOG" | "HELP_CHECKIN" | "HELP_CHECKOUT"`.
  However, in `guard/page.tsx`:
  ```typescript
  for (const item of list) {
    if (!item.actionType || item.actionType === "VISITOR_CHECKIN") {
      ...
    } else if (item.actionType === "VISITOR_CHECKOUT" && item.entryId) {
      ...
    }
  }
  ```
  Items with `actionType` of `DELIVERY_LOG`, `HELP_CHECKIN`, or `HELP_CHECKOUT` are ignored. They remain stuck in IndexedDB forever and never sync to the server.
- **Remediation**: Implement handlers in `syncOfflineQueue()` for deliveries and domestic help check-in/out.

---

### 3.5 [P2] Resident Can Bypass Gate Handover Verification on Deliveries
- **File**: [`src/app/api/deliveries/[id]/route.ts:58-88`](file:///c:/Users/Varad%20Deshpande/Desktop/GREEN%20ACRES/src/app/api/deliveries/%5Bid%5D/route.ts#L58-L88)
- **Vulnerable Code**:
  ```typescript
  if (isResidentCollect) {
    const members = await tx.select().from(unitMembers).where(and(eq(unitMembers.userId, sess.userId), eq(unitMembers.unitId, del.unitId)));
    const isUnitResident = members.length > 0;

    if (isGuard && !isUnitResident) {
      // Guard requires OTP from resident
      ...
    }
    // Resident calling directly: NO OTP CHECK
    const [upd] = await tx.update(deliveries).set({ status: "COLLECTED", collectedAt: new Date() })...
  }
  ```
- **Defect**: While a guard is required to verify the resident's OTP upon physical handover, a resident can call `PATCH /api/deliveries/[id]` directly with `status: "COLLECTED"`. The status updates to `COLLECTED` immediately, removing the package from the guard's pending deliveries dashboard before the resident ever visits the gate.
- **Remediation**: Require guard authorization or guard OTP verification to transition packages from `AT_GATE` to `COLLECTED`.

---

## 4. AUTHORIZATION, IDOR & DATA PRIVACY

### 4.1 [P1] Cross-Unit Visitor Invite IDOR in `/api/invites`
- **File**: [`src/app/api/invites/route.ts:21-26`](file:///c:/Users/Varad%20Deshpande/Desktop/GREEN%20ACRES/src/app/api/invites/route.ts#L21-L26)
- **Vulnerable Code**:
  ```typescript
  const [unit] = await tx.select().from(units).where(and(eq(units.id, parsed.data.unitId), eq(units.societyId, societyId)));
  if (!unit) throw new Error("Unit not in society");
  const [visitor] = await tx.select().from(visitors).where(and(eq(visitors.id, parsed.data.visitorId), eq(visitors.societyId, societyId)));
  if (!visitor) throw new Error("Visitor not in society");
  const [created] = await tx.insert(visitorInvites).values({
    societyId, unitId: parsed.data.unitId, visitorId: parsed.data.visitorId, createdBy: sess.userId, ...
  }).returning();
  ```
- **Vulnerability Mechanics**: In `src/app/api/visitors/invite/route.ts`, the handler verifies that `sess.userId` belongs to `unitId` (or has admin privileges). However, in `src/app/api/invites/route.ts`, **this check is completely omitted**. Any resident of Society A can provide the UUID of ANY other unit in the society and successfully issue a visitor pass under another resident's name.
- **Impact**: Full IDOR enabling unauthorized pass generation for foreign apartments.
- **Remediation**: Verify caller's membership in `parsed.data.unitId` using `unitMembers` before insertion.

---

### 4.2 [P1] Global Visitor Pass & Entry Code Leakage to All Residents
- **Files**: [`src/app/api/invites/route.ts:12`](file:///c:/Users/Varad%20Deshpande/Desktop/GREEN%20ACRES/src/app/api/invites/route.ts#L12), [`src/app/api/entries/route.ts:12`](file:///c:/Users/Varad%20Deshpande/Desktop/GREEN%20ACRES/src/app/api/entries/route.ts#L12)
- **Vulnerable Code**:
  In `api/invites/route.ts`:
  ```typescript
  const items = await withTenant(societyId, sess.userId, async (tx) =>
    tx.select().from(visitorInvites).where(eq(visitorInvites.societyId, societyId)).orderBy(desc(visitorInvites.createdAt)).limit(50)
  );
  return NextResponse.json(items);
  ```
  In `api/entries/route.ts`:
  ```typescript
  const items = await withTenant(societyId, sess.userId, async (tx) =>
    tx.select().from(visitorEntries).where(eq(visitorEntries.societyId, societyId)).orderBy(desc(visitorEntries.createdAt)).limit(50)
  );
  return NextResponse.json(items);
  ```
- **Vulnerability Mechanics**: Any resident with the standard `"visitor:read"` permission can call `GET /api/invites` and `GET /api/entries`. The endpoints query across the entire society without filtering by `unitId` or `userId`.
- **Privacy Impact**: Residents can inspect visitor pass PINs, QR codes, check-in timestamps, and host unit IDs for all other residents in the community.
- **Remediation**: Filter rows by the caller's unit IDs (`unitMembers.unitId IN (...)`) unless the caller holds `GUARD`, `SECURITY_MANAGER`, `SOCIETY_ADMIN`, or `SUPER_ADMIN`.

---

### 4.3 [P1] Inverted Privacy Check Exposes Unmasked Domestic Help Phone Numbers
- **File**: [`src/app/api/help/attendance/route.ts:45`](file:///c:/Users/Varad%20Deshpande/Desktop/GREEN%20ACRES/src/app/api/help/attendance/route.ts#L45)
- **Vulnerable Code**:
  ```typescript
  const maskedHelp = h ? { ...h, phone: isPrivileged ? maskPhone(h.phone) : h.phone } : null;
  ```
- **Vulnerability Mechanics**: The ternary condition is inverted. If `isPrivileged === true` (Security Guards, Admins), the phone number is masked. If `isPrivileged === false` (regular residents), the raw unmasked phone number is returned!
- **Remediation**: Correct the condition to:
  ```typescript
  phone: isPrivileged ? h.phone : maskPhone(h.phone)
  ```

---

### 4.4 [P2] Command Palette Exposes Guard and Admin Cockpit Shortcuts to Residents
- **File**: [`src/components/shared/CommandPalette.tsx:153-169`](file:///c:/Users/Varad%20Deshpande/Desktop/GREEN%20ACRES/src/components/shared/CommandPalette.tsx#L153-L169)
- **Vulnerability Mechanics**: The items list in `CommandPalette.tsx` includes `"Gate Terminal Console"` (`/guard`) and `"Operations Command Hub"` (`/admin`) without checking the active user's roles. Any resident pressing `Ctrl+K` sees admin and guard navigation links.
- **Remediation**: Pass `roles` to `CommandPalette` and filter navigation items against role capabilities.

---

## 5. WORKFLOWS, ENUMS & STATE MACHINES

### 5.1 [P0] Helpdesk Ticket State Machine Enum Crash on CANCELLED
- **Files**: [`src/app/api/helpdesk/[id]/route.ts:10-15`](file:///c:/Users/Varad%20Deshpande/Desktop/GREEN%20ACRES/src/app/api/helpdesk/%5Bid%5D/route.ts#L10-L15), [`src/lib/db/schema.ts:16`](file:///c:/Users/Varad%20Deshpande/Desktop/GREEN%20ACRES/src/lib/db/schema.ts#L16)
- **Vulnerable Code**:
  In `helpdesk/[id]/route.ts`:
  ```typescript
  const transitions: Record<string, Record<string, string[]>> = {
    OPEN: {
      RESIDENT: ["CANCELLED"],
      FAMILY_MEMBER: ["CANCELLED"],
      FACILITY_MANAGER: ["ASSIGNED", "IN_PROGRESS", "RESOLVED", "CANCELLED"],
      ...
    }
  };
  ```
  In `src/lib/db/schema.ts`:
  ```typescript
  export const ticketStatusEnum = pgEnum("ticket_status", ["OPEN","ASSIGNED","IN_PROGRESS","RESOLVED","CLOSED"]);
  ```
- **Failure Mechanics**: The transition map allows residents to cancel an open ticket to `"CANCELLED"`. However, `"CANCELLED"` **does not exist in the database `ticket_status` enum**. When a resident attempts to cancel an open ticket, PostgreSQL throws: `invalid input value for enum ticket_status: "CANCELLED"`, crashing the request with an unhandled HTTP 500 error. Because `"CANCELLED"` is the ONLY transition permitted for residents on an `OPEN` ticket, residents can never close or withdraw tickets they filed.
- **Remediation**: Add `"CANCELLED"` to `ticketStatusEnum` in `schema.ts` and run a migration:
  ```sql
  ALTER TYPE ticket_status ADD VALUE 'CANCELLED';
  ```

---

### 5.2 [P1] Unprotected Resident Routes in Middleware Leading to Broken UI
- **File**: [`middleware.ts:9`](file:///c:/Users/Varad%20Deshpande/Desktop/GREEN%20ACRES/middleware.ts#L9)
- **Vulnerable Code**:
  ```typescript
  const isProtectedPage = pathname.startsWith('/admin') || pathname.startsWith('/guard');
  if (isProtectedPage && !sessionToken) {
    const signInUrl = new URL('/auth/sign-in', request.url);
    signInUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(signInUrl);
  }
  ```
- **Defect**: Middleware only protects `/admin` and `/guard`. All resident routes (`/visitors`, `/deliveries`, `/bills`, `/bookings`, `/help`, `/emergency`, `/events`, `/announcements`, `/parking`, `/vehicles`, `/helpdesk`, `/profile`) allow unauthenticated browser access. The pages mount, send API requests, receive 401s, and display generic error cards ("Couldn't load bills") instead of redirecting the user to `/auth/sign-in`.
- **Remediation**: Update `isProtectedPage` in `middleware.ts` to protect all routes except `/auth/sign-in`, public assets, and webhook callbacks.

---

### 5.3 [P1] Background Notification Fan-Out Silently Aborted in Serverless Environments
- **Files**: [`src/app/api/emergency/route.ts:75-99`](file:///c:/Users/Varad%20Deshpande/Desktop/GREEN%20ACRES/src/app/api/emergency/route.ts#L75-L99), [`src/app/api/announcements/route.ts:70-96`](file:///c:/Users/Varad%20Deshpande/Desktop/GREEN%20ACRES/src/app/api/announcements/route.ts#L70-L96)
- **Vulnerable Code**:
  ```typescript
  setImmediate(async () => {
    try {
      ...
      for (let i = 0; i < notifRows.length; i += CHUNK) {
        await db.insert(notifications).values(notifRows.slice(i, i + CHUNK));
      }
    } catch (e) { ... }
  });
  return NextResponse.json(alert, { status: 201 });
  ```
- **Failure Mechanics**: In modern cloud hosting (Next.js on Vercel, AWS Lambda, or containerized serverless runtimes), un-awaited background tasks scheduled via `setImmediate` or unhandled promises are frozen or terminated immediately when the HTTP response stream closes. In production, notifications for emergency alerts or society-wide announcements will be truncated or fail to send to residents.
- **Remediation**: Use Next.js 15 `waitUntil()` from `@vercel/functions` or `after()` from `next/server`, or offload fan-out to a persistent queue (Upstash QStash / Redis).

---

### 5.4 [P2] Rigid Navigation Hierarchy Locks Out Dual-Role Users
- **File**: [`src/lib/navigation.ts:84`](file:///c:/Users/Varad%20Deshpande/Desktop/GREEN%20ACRES/src/lib/navigation.ts#L84)
- **Vulnerable Code**:
  ```typescript
  export function getNavForRoles(roles: string[]) {
    if (roles.includes("GUARD") || roles.includes("SECURITY_MANAGER")) return guardNav;
    if (roles.includes("SUPER_ADMIN") || roles.includes("SOCIETY_ADMIN") ...) return adminNav;
    return residentNav;
  }
  ```
- **Defect**: If a user is a `SECURITY_MANAGER` or `GUARD` who also resides in the building as a `RESIDENT`, they are forced into `guardNav`. They cannot access resident menus (Bills, Bookings, Flat Passes, Helpdesk). Similarly, a `SUPER_ADMIN` is locked into `adminNav` and cannot switch to resident or guard cockpits without modifying database records.
- **Remediation**: Implement an explicit role selector in the user dropdown and allow users with multiple roles to switch active navigation context.

---

### 5.5 [P2] Hardcoded Fallback Units and Society Names in Passes
- **Files**:
  - [`src/app/page.tsx:332-333`](file:///c:/Users/Varad%20Deshpande/Desktop/GREEN%20ACRES/src/app/page.tsx#L332-L333)
  - [`src/app/visitors/page.tsx:157-158`](file:///c:/Users/Varad%20Deshpande/Desktop/GREEN%20ACRES/src/app/visitors/page.tsx#L157-L158)
  - [`src/app/visitors/new/page.tsx:107`](file:///c:/Users/Varad%20Deshpande/Desktop/GREEN%20ACRES/src/app/visitors/new/page.tsx#L107)
- **Defect**:
  - In `src/app/visitors/page.tsx:130`, `const unit = units[0];` is evaluated once, and every pass card in the list displays `unitNumber: unit?.number || "A-101"`, regardless of which unit the visitor was actually visiting.
  - Society name is hardcoded to `"Green Acres Residency"`, ignoring other tenant societies.
  - In `src/app/page.tsx:331`, `visitorName` falls back to `iv.purpose || "Guest"` because `visitorInvites` does not join `visitors` to retrieve the actual guest name.

---

## 6. PERFORMANCE & DATABASE SCALABILITY

### 6.1 [P2] 1,500 Sequential Database Queries in Resident CSV Export
- **File**: [`src/app/api/admin/export/residents/route.ts:14-19`](file:///c:/Users/Varad%20Deshpande/Desktop/GREEN%20ACRES/src/app/api/admin/export/residents/route.ts#L14-L19)
- **Vulnerable Code**:
  ```typescript
  const members = await tx.select().from(unitMembers).where(eq(unitMembers.societyId, societyId)).limit(500);
  for (const m of members) {
    const [u] = await tx.select().from(users).where(eq(users.id, m.userId));
    const [unit] = await tx.select().from(units).where(eq(units.id, m.unitId));
    const [b] = unit ? await tx.select().from(buildings).where(eq(buildings.id, unit.buildingId)) : [null];
    rows.push([...]);
  }
  ```
- **Defect**: For 500 members, the loop executes 3 individual queries per member sequentially, totaling **1,501 round-trips to the database**. This guarantees HTTP 504 Gateway Timeouts under load.
- **Remediation**: Rewrite as a single SQL query using `innerJoin` and `leftJoin` across `unit_members`, `users`, `units`, and `buildings`.

---

### 6.2 [P2] Unbounded `SELECT * FROM societies` Memory Leak
- **File**: [`src/app/api/societies/route.ts:17-19`](file:///c:/Users/Varad%20Deshpande/Desktop/GREEN%20ACRES/src/app/api/societies/route.ts#L17-L19)
- **Vulnerable Code**:
  ```typescript
  const items = await db.select().from(societies).where(eq(societies.id, ids[0]));
  const all = await db.select().from(societies);
  const filtered = all.filter(s => ids.includes(s.id));
  return NextResponse.json(filtered);
  ```
- **Defect**: The route issues an unused query on line 17, then loads ALL societies in the database into Node.js memory on line 18, and filters them in memory. In a multi-tenant platform with thousands of societies, this creates massive memory bloat and leaks cross-tenant row counts into application memory.
- **Remediation**: Replace with `db.select().from(societies).where(inArray(societies.id, ids))`.

---

### 6.3 [P2] Admin Resident Search Filter Executed In-Memory After Pagination Limit
- **File**: [`src/app/api/admin/residents/route.ts:16-26`](file:///c:/Users/Varad%20Deshpande/Desktop/GREEN%20ACRES/src/app/api/admin/residents/route.ts#L16-L26)
- **Vulnerable Code**:
  ```typescript
  const rows = await tx.select().from(unitMembers).where(eq(unitMembers.societyId, societyId)).orderBy(desc(unitMembers.createdAt)).limit(limit).offset(offset);
  const enriched = await Promise.all(rows.map(async (m) => {
    ...
    if (q && !(`${u.fullName} ${u.phone} ${unit.number}`.toLowerCase().includes(q.toLowerCase()))) return null;
    ...
  }));
  return enriched.filter(Boolean);
  ```
- **Defect**: SQL `limit` and `offset` are applied first. Then, the search term `q` is checked in JavaScript. If 50 rows are fetched and none match `q`, the endpoint returns an empty array, even if hundreds of matching residents exist further down in the table.
- **Remediation**: Perform the search query inside the SQL query using `ilike` and joins before applying `limit` and `offset`.

---

## 7. SYSTEM COMPLIANCE & OBSERVABILITY

| Feature / Subsystem | Current State | Defect / Vulnerability | Remediation Priority |
| :--- | :--- | :--- | :---: |
| **Audit Logs Immutability** | Connects as `neondb_owner` | Table owner can `UPDATE` / `DELETE` audit rows | **P0** |
| **Twilio Provider** | Returns `mockProvider` | Twilio SMS integration is completely unimplemented | **P3** |
| **Catalog Cleanliness** | Table `test_votes` present | Orphaned test table left in public database schema | **P3** |
| **CSV Export Formatting** | `unitId.slice(0, 8)` | Cryptic UUIDs in finance export instead of Flat No. | **P3** |
| **Multi-Society Switcher** | No UI in `AppShell` | Users in multiple societies cannot change active tenant | **P2** |

---

## 8. REMEDIATION ROADMAP (RECOMMENDED ORDER)

1. **Sprint 1: Critical Security & Integrity (P0)**
   - Apply RLS and policies to `vehicle_entries`.
   - Update `.env` `APP_DATABASE_URL` to `app_user` (`NOBYPASSRLS`).
   - Add event type verification (`payment.captured` / `order.paid`) in Razorpay webhook.
   - Fix Content Security Policy in `middleware.ts` to allow `checkout.razorpay.com`.
   - Add `"CANCELLED"` to `ticket_status` enum in database schema.
   - Enforce `status === "APPROVED"` requirement in `/api/guard/check-in`.
   - Wrap amenity slot capacity checks in transaction locks.

2. **Sprint 2: Tenant Isolation & Workflows (P1)**
   - Protect all resident routes in `middleware.ts`.
   - Add unit ownership validation to `/api/invites` (prevent IDOR).
   - Scope `/api/invites` and `/api/entries` GET queries to resident's own units.
   - Fix inverted privacy condition in `/api/help/attendance`.
   - Fix `guard/expected` query to include approved visitor passes.
   - Link amenity booking bills to bookings and handle cancellation status.
   - Support domestic help and deliveries in offline queue sync.

3. **Sprint 3: Performance & Operational Polish (P2 & P3)**
   - Refactor N+1 queries in `admin/residents` and CSV exports into SQL joins.
   - Replace in-memory `all.filter()` in `api/societies` with SQL `inArray()`.
   - Replace hardcoded "A-101" and "Green Acres" fallbacks with dynamic entity lookups.
   - Add active society switcher to `AppShell` user menu.
   - Clean up orphaned table `test_votes` from database catalog.
