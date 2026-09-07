# Walkthrough — Gated Community Platform Enhancements

All work for **Phase 1 (Guard Offline-First Mode)** and **Phase 2 (Amenity Booking Concurrency & Auto-Invoicing)** is complete, verified, and tested with zero regressions.

---

## Phase 2: Amenity Booking Slot Concurrency & Auto-Invoicing

### 1. Pessimistic Locking & Slot Concurrency
- **Parent & Slot Locking**: In [`src/app/api/bookings/route.ts`](file:///c:/Users/Varad%20Deshpande/Desktop/GREEN%20ACRES/src/app/api/bookings/route.ts), added transactional `.for("update")` row locking on both the parent amenity and the requested slot. This serializes concurrent booking requests and eliminates race conditions when multiple residents attempt to reserve the final spot at the same millisecond.
- **Dynamic Capacity Enforcing**: Active bookings count uses `COUNT(*)` over non-cancelled slots (`ne(bookings.status, "CANCELLED")`) compared against `amenity.capacity`.
- **Same-Day Slot Expiry**: Added validation rejecting bookings for time slots that have already started or passed today (`code: PAST_SLOT`, HTTP 400).
- **PostgreSQL Partial Unique Index (`0006_booking_slot_concurrency.sql`)**:
  - Replaced the static `bookings_user_slot_date_unique` constraint with a partial unique index:
    ```sql
    CREATE UNIQUE INDEX bookings_user_slot_date_unique 
      ON bookings (user_id, amenity_id, booking_date, slot_id) 
      WHERE status != 'CANCELLED';
    ```
  - This allows a resident who cancelled a slot earlier in the day to re-book it without encountering a database 23505 unique constraint violation.

### 2. Auto-Invoicing & Line Item Generation
- **Automatic Invoicing**: When a paid amenity (`amenity.fee > 0`) is booked, the booking is created with status `PENDING_PAYMENT` and an invoice (`bills`) is auto-generated with status `ISSUED`.
- **Itemized Invoice Records**: Added itemized line items into `bill_items` describing the amenity, date, and slot time range.
- **`bill_items` RLS Mutation Upgrade (`0007_bill_items_rls_all.sql`)**:
  - Discovered that `bill_items` only had a `FOR SELECT` RLS policy, which caused all non-owner inserts to fail.
  - Upgraded `bill_items` RLS policy to `FOR ALL` enforcing tenant isolation through parent bill's `bills.society_id`.
- **Automatic Pass Confirmation on Payment**: When payment is completed (via `POST /api/payments/verify` or webhook), the linked booking status automatically transitions from `PENDING_PAYMENT` to `CONFIRMED`, and a notification pass is dispatched.

### 3. Tiered Cancellation & Refund Policy Engine
- In [`src/app/api/bookings/[id]/route.ts`](file:///c:/Users/Varad%20Deshpande/Desktop/GREEN%20ACRES/src/app/api/bookings/%5Bid%5D/route.ts), built automated refund rules based on hours remaining until the slot starts:
  - **Notice &gt; 24 hours**: **100% Refund** initiated at payment gateway, payment marked `REFUNDED`, bill cancelled, resident notified.
  - **Notice 6–24 hours**: **50% Partial Refund** initiated at payment gateway.
  - **Notice &lt; 6 hours**: **Non-refundable late cancellation**; slot is freed up for society members but fee is retained per policy.
  - **Past or ongoing slot**: Cancellation is blocked (`Cannot cancel past or ongoing booking`, HTTP 400).
- `GET /api/bookings/[id]` includes a `cancellationEstimate` preview containing notice hours and calculated refund percentage.

### 4. Resident Experience & Booking Cockpit
- **Booking Detail Redesign** ([`src/app/bookings/[id]/page.tsx`](file:///c:/Users/Varad%20Deshpande/Desktop/GREEN%20ACRES/src/app/bookings/%5Bid%5D/page.tsx)):
  - Fixed booking confirmation redirect (`d.booking?.id || d.id`).
  - Added warning banner for `PENDING_PAYMENT` with a direct "Pay Now" action.
  - Added "Society Cancellation & Refund Policy" information card.
  - Previews calculated refund amount and window directly inside the confirmation dialog before the resident cancels.
- **My Bookings Page** ([`src/app/bookings/page.tsx`](file:///c:/Users/Varad%20Deshpande/Desktop/GREEN%20ACRES/src/app/bookings/page.tsx)):
  - Added "Payment Pending" tab and count badge so residents never lose track of reservations requiring payment.
- **Status Badges** ([`src/components/shared/StatusBadge.tsx`](file:///c:/Users/Varad%20Deshpande/Desktop/GREEN%20ACRES/src/components/shared/StatusBadge.tsx)):
  - Added dot colors and labels for `PENDING_PAYMENT` (amber) and `REFUNDED` (purple).

---

## Verification Results

| Test Suite | Result | Details |
|---|---|---|
| `npx tsc --noEmit` | **PASS (0 errors)** | Strict TypeScript compilation passes across all routes |
| `tests/amenities-concurrency.test.ts` | **PASS (32/32, 100%)** | Slot concurrency, capacity limits, auto-invoicing, payment confirmation, re-booking, tiered refunds |
| `tests/guard-offline.test.ts` | **PASS (20/20, 100%)** | Offline check-in/out, departure timestamps, manual pass sync, RLS isolation |
| `tests/helpdesk.test.ts` | **PASS (26/26, 100%)** | Helpdesk lifecycle, SLA timers, comments, RBAC, tenant isolation |
| `tests/audit-remediation-full.test.ts` | **PASS (35/35, 100%)** | Audit logs, security remediations, RLS boundary protection |

**Total Automated Test Coverage: 113 / 113 Tests Passing (100%)**
