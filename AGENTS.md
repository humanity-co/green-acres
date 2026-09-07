# AGENTS.md — Gated-Community Platform (MyGate-Inspired) — Permanent Engineering Rules

## Environment Configuration
- **Sandbox**: E2B sandbox; preview via E2B-exposed URL in iframe
- **Port**: dev server on 4000 (already running). If starting: kill 4000 then `bun run dev --port 4000`
- **Package Manager**: bun (`bun install`, `bun run <script>`)
- **Quality**: `bun run typecheck` after tasks; don't run build unless asked
- **Ideavo**: Keep `ideavo/webpack-tagger` loader, `allowedDevOrigins`, and `ideavo-scripts` CDN in layout.tsx

## 1. Vision & Tenancy
Multi-tenant: Platform → Society → Building → Floor → Unit → Resident. Every society-scoped row has `society_id uuid NOT NULL REFERENCES societies(id) ON DELETE CASCADE` + composite index. Member belongs to many societies via `user_society_roles (user_id, society_id, role)`. All queries set `SET LOCAL app.society_id / app.user_id` from server session; Postgres RLS enforces isolation. Frontend filtering is never security.

## 2. Stack (Locked)
Next.js 15 App Router + React 19 + TS strict, Tailwind 4 + shadcn new-york, Drizzle + Postgres (Neon), Bun, zod + react-hook-form, tanstack-query + zustand, PWA → Expo (React Native). No npm/pnpm/yarn mix; CI uses `oven-sh/setup-bun`.

## 3. Multi-Tenancy & RLS
- All tenant tables: `society_id` NOT NULL + FK + `(society_id, created_at)` + `(society_id, unit_id)` indexes; unique `(society_id, field)` where needed.
- RLS: `CREATE POLICY tenant ON tbl USING (society_id = current_setting('app.society_id')::uuid) WITH CHECK (...)`. App middleware sets GUC per request from httpOnly session; `service_role` bypasses only in migrations.
- Every handler: `auth() → getSocietyId() → SET LOCAL → can() → zod → tx`. Test: society A query as B returns 0 rows. Protects against IDOR.

## 4. Authentication (Phone OTP, MyGate-style)
- Abstraction: `lib/otp/provider.ts` `{request, verify}` → env `OTP_PROVIDER=mock|msg91|twilio`; `OTP_EXPIRY=300`, `OTP_RESEND_COOLDOWN=60`.
- Production: never hardcode OTP/phone. Mock `123456` only when `OTP_PROVIDER=mock && NODE_ENV!=production && MOCK_OTP_ENABLED=true`, console-log only, runtime guard throws in prod, hashed at rest.
- Security: 6-digit, 5-min expiry, resend cooldown 60s, rate-limit 3/hr/phone (Upstash Redis), 5 attempts → 15-min lock, JWT httpOnly Secure SameSite=Lax, 24h rotation, session invalidation. No secrets in client.

## 5. Payments (Razorpay initial, abstracted)
- Abstraction: `lib/payments/provider.ts` → `createOrder, verifySignature, webhook, refund`; env `PAYMENT_GATEWAY=mock|razorpay|phonepe`; `RAZORPAY_KEY_SECRET` server-only.
- Flow: `createOrder` (server validates bill.total) → initiate (client SDK/UPI intent) → verify (server HMAC) → webhook (HMAC + idempotent `gateway_ref UNIQUE`) → tx `payments + bills status + audit`. Never trust client success.
- States: `PENDING→SUCCESS|FAILED`, refund `INITIATED→PROCESSED`; reconciliation cron + failed retry queue + audit every transition.

## 6. Database
- FKs, UNIQUE, CHECK (e.g., `due_date > period_end`), indexes, transactions, `drizzle-kit` migrations + seed. Large tables (`visitor_entries, notifications, payments, audit_logs, helpdesk`) cursor-paginated, `audit_logs` partitioned monthly, archived >1yr.

## 7. Offline Guard Mode
- Online-required: auth, resident approve/reject, new invite creation, full PII search. Offline-allowed (queued): check-in/out against cached 24h allowlist, manual pass.
- Arch: service worker + IndexedDB queue (UUID idempotency) + BackgroundSync + LWW server-wins conflict + auditable sync log + offline banner. Never allow offline privileged pass without cached allowlist.

## 8. Authorization (Server RBAC)
- Roles: `SUPER_ADMIN, SOCIETY_ADMIN, RWA_MEMBER, ACCOUNTANT, FACILITY_MANAGER, SECURITY_MANAGER, GUARD, RESIDENT, FAMILY_MEMBER, VENDOR, SERVICE_PROVIDER, DOMESTIC_HELP`
- Permissions: explicit `resource:action` (e.g., `visitor:approve, bill:issue, payment:refund`). `can(user, action, resource, societyId)` checked in every Route Handler/Server Action. `withRole()` HOC. Frontend visibility ≠ boundary.

## 9. Audit Logging
- Every mutation → `audit_logs (actor_id, society_id, action, entity, entity_id, prev_state jsonb, new_state jsonb, ip, ts)` append-only (`REVOKE UPDATE/DELETE` for app role), tx + outbox.

## 10. Design System
- Single `components/ui` + `components/shared` + `components/{resident,guard,admin}`. Mobile-first, accessible (Radix), reusable, no duplicated shells. MyGate-inspired dense, fast lists — avoid generic AI dashboard aesthetics.

## 11. Execution Order
Foundation → Auth → Tenancy/RLS → RBAC → Resident → Guard → Deliveries/Help → Billing/Payments → Helpdesk → Amenities → Vehicles/Community → Reports/Notifications → Hardening → Expo

## 12. Do Not
- Keep this file as source of truth; all agents must read it first. Preserve Ideavo compatibility (Plan/Build, Tasks, GitHub, Visual Edit, Secrets, DB).
