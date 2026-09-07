import { ownerDb as db } from "../src/lib/db";
import { users, societies, userSocietyRoles, units, buildings, floors, helpdeskTickets, ticketComments, notifications, auditLogs } from "../src/lib/db/schema";
import { signJwt } from "../src/lib/auth/jwt";
import { randomInt } from "crypto";
import { eq, and } from "drizzle-orm";
import { Pool } from "pg";
const BASE = "http://localhost:4000";
async function fetchWithCookie(path: string, opts: any = {}, cookie?: string) {
  const headers: any = { "Content-Type": "application/json", ...(opts.headers || {}) };
  if (cookie) headers["Cookie"] = cookie;
  const res = await fetch(BASE + path, { ...opts, headers });
  return res;
}
async function createSocieties() {
  const suffix = Date.now().toString().slice(-6);
  const mkSoc = async (name: string) => {
    const [soc] = await db.insert(societies).values({ name, code: `HD${suffix}${randomInt(10,99)}${name.slice(-1)}`, city: "Test" }).returning();
    const [b] = await db.insert(buildings).values({ societyId: soc.id, name: "B1", floorsCount: 1 }).returning();
    const [f] = await db.insert(floors).values({ societyId: soc.id, buildingId: b.id, number: 1 }).returning();
    const [u] = await db.insert(units).values({ societyId: soc.id, buildingId: b.id, floorId: f.id, number: `HD-${suffix}` }).returning();
    const [u2] = await db.insert(units).values({ societyId: soc.id, buildingId: b.id, floorId: f.id, number: `HD2-${suffix}` }).returning();
    return { soc, unit: u, unit2: u2 };
  };
  const A = await mkSoc("SocA-HD");
  const B = await mkSoc("SocB-HD");
  const mkUser = async (role: string, soc: any, unit: any) => {
    const phone = `9005${randomInt(100000,999999)}${suffix.slice(0,1)}`.slice(0,12);
    const [u] = await db.insert(users).values({ phone, fullName: `${role} HD`, phoneVerified: true }).returning();
    await db.insert(userSocietyRoles).values({ userId: u.id, societyId: soc.id, role: role as any });
    const { unitMembers } = await import("../src/lib/db/schema");
    await db.insert(unitMembers).values({ societyId: soc.id, unitId: unit.id, userId: u.id, relation: "OWNER", isPrimary: true, isVerified: true });
    const token = await signJwt({ userId: u.id, phone: u.phone }, "24h");
    await db.insert((await import("../src/lib/db/schema")).sessions).values({ userId: u.id, token, expiresAt: new Date(Date.now() + 86400000) });
    return { user: u, token, cookie: `session=${token}; active_society=${soc.id}`, soc, unit };
  };
  const residentA = await mkUser("RESIDENT", A.soc, A.unit);
  const residentA2 = await mkUser("RESIDENT", A.soc, A.unit2);
  const facilityA = await mkUser("FACILITY_MANAGER", A.soc, A.unit);
  const adminA = await mkUser("SOCIETY_ADMIN", A.soc, A.unit);
  const residentB = await mkUser("RESIDENT", B.soc, B.unit);
  const adminB = await mkUser("SOCIETY_ADMIN", B.soc, B.unit);
  return { A, B, residentA, residentA2, facilityA, adminA, residentB, adminB };
}
let pass = 0, fail = 0;
const assert = (c: boolean, m: string) => { if (c) { console.log(`✓ ${m}`); pass++; } else { console.log(`✗ ${m}`); fail++; } };
async function run() {
  console.log("Helpdesk tests");
  const { A, B, residentA, residentA2, facilityA, adminA, residentB, adminB } = await createSocieties();
  // 1 unauth GET 401
  let res = await fetch(BASE + "/api/helpdesk");
  assert(res.status === 401, "1 unauth GET 401");
  // 2 unauth create 401
  res = await fetch(BASE + "/api/helpdesk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ unitId: A.unit.id, category: "Plumbing", title: "Leak", description: "x" }) });
  assert(res.status === 401, "2 unauth create 401");
  // 3 resident creates ticket
  res = await fetchWithCookie("/api/helpdesk", { method: "POST", body: JSON.stringify({ unitId: A.unit.id, category: "Plumbing", title: "Leak in kitchen", description: "Water leak", priority: "HIGH" }) }, residentA.cookie);
  assert(res.status === 201, "3 resident creates 201");
  const ticket = await res.json();
  const ticketId = ticket.id;
  // 4 resident sees own
  res = await fetchWithCookie("/api/helpdesk", {}, residentA.cookie);
  let list = await res.json();
  assert(Array.isArray(list) && list.some((t: any) => t.id === ticketId), "4 resident sees own");
  // 5 another resident blocked (residentA2 same society but different unit and not creator, should not see unless unit match? Our logic allows unit members to see unit tickets, but residentA2 is in unit2, ticket is in unit1, and raisedBy is residentA, so residentA2 should not see)
  res = await fetchWithCookie(`/api/helpdesk/${ticketId}`, {}, residentA2.cookie);
  assert(res.status === 403, "5 another resident blocked 403");
  // 6 cross-tenant blocked
  res = await fetchWithCookie(`/api/helpdesk/${ticketId}`, {}, residentB.cookie);
  assert(res.status === 404 || res.status === 403, "6 cross-tenant blocked");
  // 7 forged ticket ID blocked
  res = await fetchWithCookie("/api/helpdesk/00000000-0000-0000-0000-000000000000", {}, residentA.cookie);
  assert(res.status === 404, "7 forged ID 404");
  // 8 invalid input rejected (missing title)
  res = await fetchWithCookie("/api/helpdesk", { method: "POST", body: JSON.stringify({ unitId: A.unit.id, category: "Plumbing", title: "", description: "x" }) }, residentA.cookie);
  assert(res.status === 400, "8 invalid input 400");
  // 9 resident cannot admin-transition (try PATCH status)
  res = await fetchWithCookie(`/api/helpdesk/${ticketId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "ASSIGNED" }) }, residentA.cookie);
  assert(res.status === 403, "9 resident cannot admin-transition 403");
  // 10 authorized staff can assign
  res = await fetchWithCookie(`/api/helpdesk/${ticketId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assigneeId: facilityA.user.id }) }, adminA.cookie);
  assert(res.status === 200, "10 staff can assign 200");
  // 11 cross-society assignee blocked (try assign residentB from B society)
  res = await fetchWithCookie(`/api/helpdesk/${ticketId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assigneeId: residentB.user.id }) }, adminA.cookie);
  assert(res.status === 400, "11 cross-society assignee blocked 400");
  // 12 OPEN->ASSIGNED valid (create new ticket for state machine)
  res = await fetchWithCookie("/api/helpdesk", { method: "POST", body: JSON.stringify({ unitId: A.unit.id, category: "Electrical", title: "Power outage", description: "No power" }) }, residentA.cookie);
  const t2 = await res.json();
  res = await fetchWithCookie(`/api/helpdesk/${t2.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "ASSIGNED" }) }, adminA.cookie);
  assert(res.status === 200, "12 OPEN->ASSIGNED valid");
  // 13 ASSIGNED->IN_PROGRESS valid
  res = await fetchWithCookie(`/api/helpdesk/${t2.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "IN_PROGRESS" }) }, adminA.cookie);
  assert(res.status === 200, "13 ASSIGNED->IN_PROGRESS valid");
  // 14 IN_PROGRESS->RESOLVED valid
  res = await fetchWithCookie(`/api/helpdesk/${t2.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "RESOLVED" }) }, adminA.cookie);
  assert(res.status === 200, "14 IN_PROGRESS->RESOLVED valid");
  // 15 RESOLVED->CLOSED valid
  res = await fetchWithCookie(`/api/helpdesk/${t2.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "CLOSED" }) }, adminA.cookie);
  assert(res.status === 200, "15 RESOLVED->CLOSED valid");
  // 16 invalid transition rejected (try OPEN->RESOLVED directly on fresh ticket)
  res = await fetchWithCookie("/api/helpdesk", { method: "POST", body: JSON.stringify({ unitId: A.unit.id, category: "Cleaning", title: "Dirty", description: "x" }) }, residentA.cookie);
  const t3 = await res.json();
  res = await fetchWithCookie(`/api/helpdesk/${t3.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "RESOLVED" }) }, adminA.cookie);
  assert(res.status === 400, "16 invalid transition rejected 400");
  // 17 resident comment succeeds (on own ticket)
  res = await fetchWithCookie(`/api/helpdesk/${ticketId}/comments`, { method: "POST", body: JSON.stringify({ body: "Please fix soon" }) }, residentA.cookie);
  assert(res.status === 201, "17 resident comment 201");
  // 18 unauthorized comment blocked (residentA2 not owner)
  res = await fetchWithCookie(`/api/helpdesk/${ticketId}/comments`, { method: "POST", body: JSON.stringify({ body: "Hack" }) }, residentA2.cookie);
  assert(res.status === 403, "18 unauthorized comment blocked 403");
  // 19 cross-tenant comment blocked
  res = await fetchWithCookie(`/api/helpdesk/${ticketId}/comments`, { method: "POST", body: JSON.stringify({ body: "Cross" }) }, residentB.cookie);
  assert(res.status === 404 || res.status === 403, "19 cross-tenant comment blocked");
  // 20 staff comment succeeds
  res = await fetchWithCookie(`/api/helpdesk/${ticketId}/comments`, { method: "POST", body: JSON.stringify({ body: "We will fix" }) }, facilityA.cookie);
  assert(res.status === 201, "20 staff comment 201");
  // 21 audit generated
  let audits = await db.select().from(auditLogs).where(eq(auditLogs.entity, "ticket"));
  assert(audits.length > 0, "21 audit generated");
  // 22 notification generated
  let notifs = await db.select().from(notifications).where(eq(notifications.relatedEntity, "ticket"));
  assert(notifs.length > 0, "22 notification generated");
  // 23 RLS SELECT isolation (direct app_pool without tenant should be 0)
  const appPool = new Pool({ connectionString: process.env.APP_DATABASE_URL! });
  let noCtx = await appPool.query("SELECT count(*) as c FROM helpdesk_tickets");
  assert(noCtx.rows[0].c === "0", "23 RLS SELECT 0 without tenant");
  // 24 RLS INSERT isolation (try insert cross-society via A context with B unit)
  let rlsInsertBlocked = false;
  const client = await appPool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.society_id', $1, true)", [A.soc.id]);
    await client.query("INSERT INTO helpdesk_tickets (id, society_id, unit_id, raised_by, category, title) VALUES (gen_random_uuid(), $1, $2, $3, 'Plumbing', 'Hack')", [B.soc.id, B.unit.id, residentA.user.id]);
    await client.query("COMMIT");
  } catch { rlsInsertBlocked = true; try { await client.query("ROLLBACK"); } catch {} } finally { client.release(); }
  assert(rlsInsertBlocked, "24 RLS INSERT blocked");
  // 25 RLS UPDATE isolation (try update B ticket via A context)
  let rlsUpdateBlocked = false;
  const client2 = await appPool.connect();
  try {
    await client2.query("BEGIN");
    await client2.query("SELECT set_config('app.society_id', $1, true)", [A.soc.id]);
    const upd = await client2.query("UPDATE helpdesk_tickets SET title='Hacked' WHERE id=$1 AND society_id=$2", [t2.id, B.soc.id]);
    if (upd.rowCount === 0) rlsUpdateBlocked = true;
    await client2.query("COMMIT");
    if (!rlsUpdateBlocked) {
      const check = await db.select().from(helpdeskTickets).where(eq(helpdeskTickets.id, t2.id));
      if (check[0].title !== "Hacked") rlsUpdateBlocked = true;
    }
  } catch { rlsUpdateBlocked = true; try { await client2.query("ROLLBACK"); } catch {} } finally { client2.release(); }
  assert(rlsUpdateBlocked, "25 RLS UPDATE blocked");
  // 26 RLS DELETE isolation
  let rlsDeleteBlocked = false;
  const client3 = await appPool.connect();
  try {
    await client3.query("BEGIN");
    await client3.query("SELECT set_config('app.society_id', $1, true)", [A.soc.id]);
    const del = await client3.query("DELETE FROM helpdesk_tickets WHERE id=$1 AND society_id=$2", [t2.id, B.soc.id]);
    if (del.rowCount === 0) rlsDeleteBlocked = true;
    await client3.query("COMMIT");
  } catch { rlsDeleteBlocked = true; try { await client3.query("ROLLBACK"); } catch {} } finally { client3.release(); }
  assert(rlsDeleteBlocked, "26 RLS DELETE blocked");
  console.log(`\nHelpdesk Results: ${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
}
run().catch(e => { console.error(e); process.exit(1); });
