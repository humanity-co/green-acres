# 5-Phase Roadmap — Task Tracker

## Phase 1: Guard Offline-First Mode & Resilient Sync Queue `[COMPLETED]`
- `[x]` **IndexedDB Store Expansion** (`src/lib/offline/db.ts`)
  - Added `cached_inside` store for offline check-outs of active visitors/deliveries
  - Added `cached_daily_help` store for offline helper verification
  - Added queue helper functions: `getAllOfflineQueueEntries`, `retryFailedEntry`, `dismissFailedEntry`, `clearSyncedEntries`
- `[x]` **Backend Check-Out Route Hardening** (`src/app/api/guard/check-out/route.ts`)
  - Support `offlineTimestamp`, `isOffline`, and `idempotencyKey`
  - Idempotent re-sync resolution (returns 200 instead of 409 crash on sync replays)
- `[x]` **Offline Emergency Manual Pass API** (`src/app/api/guard/manual-pass/route.ts`)
  - Syncs offline emergency passes created during network outages
  - Idempotent deduplication + audit log logging
- `[x]` **Guard Console Cockpit & Sync Drawer UI** (`src/app/guard/page.tsx`)
  - Interactive online/offline station status indicator
  - Slide-out Sync Queue Drawer (`Sheet`) with pending, synced, and failed metrics, retry/dismiss actions, and "Sync Now"
  - Emergency Manual Pass modal dialog (`Dialog`) for unannounced visitors/deliveries
  - Offline caching of 24h allowlist, inside entries, and domestic help
- `[x]` **Automated Verification**
  - `tests/guard-offline.test.ts` -> **20/20 PASS (100%)**

---

## Phase 2: Amenity Booking Slot Concurrency & Auto-Invoicing `[COMPLETED]`
- `[x]` **Pessimistic Locking & Slot Concurrency** (`src/app/api/bookings/route.ts`)
  - Added parent amenity and slot-level row locking (`.for("update")`) to eliminate race conditions
  - Enforced capacity limiting with COUNT queries against non-cancelled slots
  - Added past time slot validation for same-day reservations
  - Replaced static unique constraint with partial unique index (`WHERE status != 'CANCELLED'`) in PostgreSQL (`0006_booking_slot_concurrency.sql`) to enable re-booking after cancellation
- `[x]` **Auto-Invoicing & Line Item Generation** (`src/app/api/bookings/route.ts`, `0007_bill_items_rls_all.sql`)
  - Auto-creates linked `bill` with status `ISSUED` for paid amenities
  - Generates itemized `billItems` record with amenity name, slot timing, and fee
  - Fixed `bill_items` RLS policy to allow tenant session mutations (`FOR ALL`)
- `[x]` **Tiered Cancellation & Refund Policy Engine** (`src/app/api/bookings/[id]/route.ts`)
  - Notice &gt; 24h: 100% refund via gateway refund provider + payment marked `REFUNDED` + bill cancelled
  - Notice 6–24h: 50% partial refund
  - Notice &lt; 6h: Non-refundable late cancellation policy
  - Passed/ongoing booking cancellation blocked
  - Real-time refund estimation included in `GET /api/bookings/[id]`
- `[x]` **Resident UI Redesign** (`src/app/bookings/[id]/page.tsx`, `src/app/bookings/page.tsx`, `src/app/amenities/[id]/page.tsx`)
  - Fixed booking confirmation redirect (`d.booking?.id || d.id`)
  - Added prominent "Payment Required to Confirm Slot" banner with "Pay Now" action
  - Added Society Cancellation & Refund Policy card
  - Added refund estimate breakdown in cancellation modal
  - Added "Payment Pending" tab and warning badges in bookings list
- `[x]` **Automated Verification**
  - `tests/amenities-concurrency.test.ts` -> **32/32 PASS (100%)**
  - `tests/guard-offline.test.ts` -> **20/20 PASS (100%)**
  - `tests/helpdesk.test.ts` -> **26/26 PASS (100%)**
  - `tests/audit-remediation-full.test.ts` -> **35/35 PASS (100%)**
  - `npx tsc --noEmit` -> **0 errors**

---

## Phase 3: Automated Maintenance Billing Cycle & Invoicing `[NEXT]`
- `[ ]` Bulk monthly billing generator across occupied units (`POST /api/admin/bills/generate`)
- `[ ]` Late fee / penalty calculation engine based on due date
- `[ ]` Itemized maintenance bill breakdown (Water, Common Electricity, Security, Sinking Fund)
- `[ ]` Printable / downloadable PDF maintenance invoice view

---

## Phase 4: Domestic Staff (Daily Help) Full Workflow `[UPCOMING]`
- `[ ]` Guard 1-tap pass/QR check-in for daily helpers
- `[ ]` Resident "Staff Inside Campus" live tracker
- `[ ]` Helper hiring directory with resident ratings and reviews

---

## Phase 5: Emergency SOS Panic Alert & Siren System `[UPCOMING]`
- `[ ]` Resident SOS panic trigger with exact unit geolocation
- `[ ]` Guard cockpit audio-visual persistent siren modal
- `[ ]` Security staff notification fanout
