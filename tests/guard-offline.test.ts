import { ownerDb as db } from "../src/lib/db";
import {
  users,
  societies,
  userSocietyRoles,
  units,
  buildings,
  floors,
  visitorInvites,
  visitors,
  visitorEntries,
  auditLogs,
  sessions,
  unitMembers,
} from "../src/lib/db/schema";
import { signJwt } from "../src/lib/auth/jwt";
import { randomInt, randomUUID } from "crypto";
import { eq, and } from "drizzle-orm";
import { Pool } from "pg";

const BASE = "http://localhost:4000";

async function fetchWithCookie(path: string, opts: any = {}, cookie?: string) {
  const headers: any = { "Content-Type": "application/json", ...(opts.headers || {}) };
  if (cookie) headers["Cookie"] = cookie;
  return fetch(BASE + path, { ...opts, headers });
}

async function setup() {
  const suffix = Date.now().toString().slice(-6);

  const mkSoc = async (name: string) => {
    const [soc] = await db
      .insert(societies)
      .values({ name, code: `GO${suffix}${randomInt(10, 99)}`, city: "TestCity" })
      .returning();
    const [b] = await db
      .insert(buildings)
      .values({ societyId: soc.id, name: "Tower A", floorsCount: 2 })
      .returning();
    const [f] = await db
      .insert(floors)
      .values({ societyId: soc.id, buildingId: b.id, number: 1 })
      .returning();
    const [u] = await db
      .insert(units)
      .values({ societyId: soc.id, buildingId: b.id, floorId: f.id, number: `G-${suffix}` })
      .returning();
    return { soc, building: b, floor: f, unit: u };
  };

  const A = await mkSoc("SocA-GuardOffline");
  const B = await mkSoc("SocB-GuardOffline");

  const mkUser = async (role: string, soc: any, unit: any) => {
    const phone = `9008${randomInt(100000, 999999)}`;
    const [u] = await db
      .insert(users)
      .values({ phone, fullName: `${role} Officer`, phoneVerified: true })
      .returning();
    await db.insert(userSocietyRoles).values({ userId: u.id, societyId: soc.id, role: role as any });
    await db.insert(unitMembers).values({
      societyId: soc.id,
      unitId: unit.id,
      userId: u.id,
      relation: "OWNER",
      isPrimary: true,
      isVerified: true,
    });
    const token = await signJwt({ userId: u.id, phone: u.phone }, "24h");
    await db.insert(sessions).values({
      userId: u.id,
      token,
      expiresAt: new Date(Date.now() + 86400000),
    });
    return { user: u, token, cookie: `session=${token}; active_society=${soc.id}` };
  };

  const guardA = await mkUser("GUARD", A.soc, A.unit);
  const residentA = await mkUser("RESIDENT", A.soc, A.unit);
  const guardB = await mkUser("GUARD", B.soc, B.unit);

  return { A, B, guardA, residentA, guardB };
}

let pass = 0,
  fail = 0;
const assert = (c: boolean, m: string) => {
  if (c) {
    console.log(`✓ ${m}`);
    pass++;
  } else {
    console.log(`✗ ${m}`);
    fail++;
  }
};

async function run() {
  console.log("Guard Offline Mode & Resilient Sync Test Suite\n");
  const { A, B, guardA, residentA, guardB } = await setup();

  // 1. Unauthenticated check-out blocked
  let res = await fetch(BASE + "/api/guard/check-out", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entryId: randomUUID() }),
  });
  assert(res.status === 401, "1 unauth check-out returns 401");

  // 2. Unauthenticated manual-pass blocked
  res = await fetch(BASE + "/api/guard/manual-pass", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "John Doe",
      phone: "9876543210",
      unitId: A.unit.id,
      purpose: "Delivery",
      idempotencyKey: randomUUID(),
    }),
  });
  assert(res.status === 401, "2 unauth manual-pass returns 401");

  // Setup an approved invite for check-in tests
  const [visitor] = await db
    .insert(visitors)
    .values({ societyId: A.soc.id, name: "Alice Visitor", phone: "9876543210" })
    .returning();

  const code = `GO${randomInt(1000, 9999)}`;
  const now = new Date();
  const [invite] = await db
    .insert(visitorInvites)
    .values({
      societyId: A.soc.id,
      unitId: A.unit.id,
      createdBy: residentA.user.id,
      visitorId: visitor.id,
      code,
      purpose: "Guest Visit",
      status: "APPROVED",
      approvedBy: residentA.user.id,
      validFrom: new Date(now.getTime() - 3600000),
      validTo: new Date(now.getTime() + 7200000),
    })
    .returning();

  // 3. Offline check-in with idempotencyKey & offlineTimestamp
  const checkInKey = randomUUID();
  const offlineCheckInTime = new Date(Date.now() - 1800000).toISOString(); // 30 min ago

  res = await fetchWithCookie(
    "/api/guard/check-in",
    {
      method: "POST",
      body: JSON.stringify({
        inviteId: invite.id,
        idempotencyKey: checkInKey,
        offlineTimestamp: offlineCheckInTime,
        isOffline: true,
      }),
    },
    guardA.cookie
  );
  assert(res.status === 201, "3 offline check-in returns 201");
  const checkInEntry = await res.json();
  const entryId = checkInEntry.id;

  // 4. Check-in preserves offline timestamp and is_offline flag
  assert(checkInEntry.isOffline === true, "4 check-in records isOffline = true");
  const recordedCheckIn = new Date(checkInEntry.checkIn).getTime();
  const targetCheckIn = new Date(offlineCheckInTime).getTime();
  assert(Math.abs(recordedCheckIn - targetCheckIn) < 5000, "5 check-in records original offlineTimestamp");

  // 6. Idempotent check-in replay returns existing entry without error
  res = await fetchWithCookie(
    "/api/guard/check-in",
    {
      method: "POST",
      body: JSON.stringify({
        inviteId: invite.id,
        idempotencyKey: checkInKey,
        offlineTimestamp: offlineCheckInTime,
        isOffline: true,
      }),
    },
    guardA.cookie
  );
  assert(res.status === 201 || res.status === 200, "6 check-in idempotent replay succeeds");

  // 7. Offline check-out with idempotencyKey and offlineTimestamp
  const checkOutKey = randomUUID();
  const offlineCheckOutTime = new Date(Date.now() - 900000).toISOString(); // 15 min ago

  res = await fetchWithCookie(
    "/api/guard/check-out",
    {
      method: "POST",
      body: JSON.stringify({
        entryId,
        idempotencyKey: checkOutKey,
        offlineTimestamp: offlineCheckOutTime,
        isOffline: true,
      }),
    },
    guardA.cookie
  );
  assert(res.status === 200, "7 offline check-out returns 200");
  const checkOutEntry = await res.json();

  // 8. Check-out preserves offline timestamp
  assert(checkOutEntry.checkOut !== null, "8 check-out records checkOut timestamp");
  const recordedCheckOut = new Date(checkOutEntry.checkOut).getTime();
  const targetCheckOut = new Date(offlineCheckOutTime).getTime();
  assert(Math.abs(recordedCheckOut - targetCheckOut) < 5000, "9 check-out records original departure timestamp");

  // 10. Check-out re-sync idempotency (same offline key/flag returns 200 without throwing 409)
  res = await fetchWithCookie(
    "/api/guard/check-out",
    {
      method: "POST",
      body: JSON.stringify({
        entryId,
        idempotencyKey: checkOutKey,
        offlineTimestamp: offlineCheckOutTime,
        isOffline: true,
      }),
    },
    guardA.cookie
  );
  assert(res.status === 200, "10 check-out idempotent re-sync succeeds with 200");

  // 11. Normal duplicate check-out (without offline flag) returns 409 ALREADY_OUT
  res = await fetchWithCookie(
    "/api/guard/check-out",
    {
      method: "POST",
      body: JSON.stringify({ entryId }),
    },
    guardA.cookie
  );
  assert(res.status === 409, "11 online duplicate check-out returns 409 ALREADY_OUT");

  // 12. Offline Emergency Manual Pass sync
  const manualPassKey = randomUUID();
  const manualPassTime = new Date(Date.now() - 600000).toISOString(); // 10 min ago

  res = await fetchWithCookie(
    "/api/guard/manual-pass",
    {
      method: "POST",
      body: JSON.stringify({
        name: "Delivery Agent Kumar",
        phone: "9123456780",
        unitId: A.unit.id,
        purpose: "Urgent Package Delivery",
        vehicleNumber: "MH12XY9999",
        offlineTimestamp: manualPassTime,
        idempotencyKey: manualPassKey,
        notes: "Heavy parcel delivery during offline hours",
      }),
    },
    guardA.cookie
  );
  assert(res.status === 201, "12 manual pass sync returns 201");
  const manualEntry = await res.json();
  assert(manualEntry.idempotencyKey === manualPassKey, "13 manual pass returns entry with matching idempotencyKey");
  assert(manualEntry.isOffline === true, "14 manual pass records isOffline = true");

  // 15. Manual pass audit log generated
  const [manualAudit] = await db
    .select()
    .from(auditLogs)
    .where(and(eq(auditLogs.action, "guard:manual_pass_sync"), eq(auditLogs.entityId, manualEntry.id)));
  assert(!!manualAudit, "15 manual pass records audit log guard:manual_pass_sync");

  // 16. Manual pass idempotent replay returns existing entry without duplicating
  res = await fetchWithCookie(
    "/api/guard/manual-pass",
    {
      method: "POST",
      body: JSON.stringify({
        name: "Delivery Agent Kumar",
        phone: "9123456780",
        unitId: A.unit.id,
        purpose: "Urgent Package Delivery",
        vehicleNumber: "MH12XY9999",
        offlineTimestamp: manualPassTime,
        idempotencyKey: manualPassKey,
      }),
    },
    guardA.cookie
  );
  assert(res.status === 201 || res.status === 200, "16 manual pass idempotent replay succeeds");
  const replayed = await res.json();
  assert(replayed.id === manualEntry.id, "17 replayed manual pass returns identical entry ID");

  // 18. Cross-tenant isolation: Guard A cannot create manual pass for Society B unit
  res = await fetchWithCookie(
    "/api/guard/manual-pass",
    {
      method: "POST",
      body: JSON.stringify({
        name: "Cross Tenant Intruder",
        phone: "9999999999",
        unitId: B.unit.id,
        purpose: "Cross tenant test",
        idempotencyKey: randomUUID(),
      }),
    },
    guardA.cookie
  );
  assert(res.status === 404, "18 cross-tenant unit manual pass blocked with 404");

  // 19. Direct RLS SELECT isolation on visitor_entries without tenant context
  const appPool = new Pool({ connectionString: process.env.APP_DATABASE_URL! });
  const noCtx = await appPool.query("SELECT count(*) as c FROM visitor_entries");
  assert(noCtx.rows[0].c === "0", "19 direct RLS SELECT returns 0 rows without tenant context");

  // 20. Direct RLS INSERT cross-society blocked
  let rlsInsertBlocked = false;
  const client = await appPool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.society_id', $1, true)", [A.soc.id]);
    await client.query(
      "INSERT INTO visitor_entries (id, society_id, visitor_id, unit_id, check_in) VALUES (gen_random_uuid(), $1, $2, $3, NOW())",
      [B.soc.id, visitor.id, B.unit.id]
    );
    await client.query("COMMIT");
  } catch {
    rlsInsertBlocked = true;
    try {
      await client.query("ROLLBACK");
    } catch {}
  } finally {
    client.release();
  }
  assert(rlsInsertBlocked, "20 direct cross-society RLS INSERT blocked by tenant policy");

  console.log(`\nGuard Offline Results: ${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
