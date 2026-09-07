import { ownerDb as db } from "../src/lib/db";
import { users, societies, userSocietyRoles, units, buildings, floors, announcements, polls, pollOptions, pollVotes, events, emergencyAlerts, notifications, auditLogs } from "../src/lib/db/schema";
import { signJwt } from "../src/lib/auth/jwt";
import { randomInt } from "crypto";
import { eq } from "drizzle-orm";
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
    const [soc] = await db.insert(societies).values({ name, code: `CM${suffix}${randomInt(10,99)}${name.slice(-1)}`, city: "Test" }).returning();
    const [b] = await db.insert(buildings).values({ societyId: soc.id, name: "B1", floorsCount: 1 }).returning();
    const [f] = await db.insert(floors).values({ societyId: soc.id, buildingId: b.id, number: 1 }).returning();
    const [u] = await db.insert(units).values({ societyId: soc.id, buildingId: b.id, floorId: f.id, number: `CM-${suffix}` }).returning();
    return { soc, unit: u };
  };
  const A = await mkSoc("SocA-CM");
  const B = await mkSoc("SocB-CM");
  const mkUser = async (role: string, soc: any, unit: any) => {
    const phone = `9001${randomInt(100000,999999)}${suffix.slice(0,1)}`.slice(0,12);
    const [u] = await db.insert(users).values({ phone, fullName: `${role} CM`, phoneVerified: true }).returning();
    await db.insert(userSocietyRoles).values({ userId: u.id, societyId: soc.id, role: role as any });
    const { unitMembers } = await import("../src/lib/db/schema");
    await db.insert(unitMembers).values({ societyId: soc.id, unitId: unit.id, userId: u.id, relation: "OWNER", isPrimary: true, isVerified: true });
    const token = await signJwt({ userId: u.id, phone: u.phone }, "24h");
    await db.insert((await import("../src/lib/db/schema")).sessions).values({ userId: u.id, token, expiresAt: new Date(Date.now() + 86400000) });
    return { user: u, token, cookie: `session=${token}; active_society=${soc.id}`, soc, unit };
  };
  const residentA = await mkUser("RESIDENT", A.soc, A.unit);
  const adminA = await mkUser("SOCIETY_ADMIN", A.soc, A.unit);
  const guardA = await mkUser("GUARD", A.soc, A.unit);
  const residentB = await mkUser("RESIDENT", B.soc, B.unit);
  const adminB = await mkUser("SOCIETY_ADMIN", B.soc, B.unit);
  return { A, B, residentA, adminA, guardA, residentB, adminB };
}
let pass = 0, fail = 0;
const assert = (c: boolean, m: string) => { if (c) { console.log(`✓ ${m}`); pass++; } else { console.log(`✗ ${m}`); fail++; } };
async function run() {
  console.log("Community tests");
  const { A, B, residentA, adminA, guardA, residentB, adminB } = await createSocieties();
  // Notifications: unauth 401
  let res = await fetch(BASE + "/api/notifications");
  assert(res.status === 401, "N1 unauth 401");
  // Create announcement by admin to generate notifications
  res = await fetchWithCookie("/api/announcements", { method: "POST", body: JSON.stringify({ title: "Test Ann", body: "Hello society" }) }, adminA.cookie);
  assert(res.status === 201, "A1 admin create announcement 201");
  const ann = await res.json();
  // Resident can read
  res = await fetchWithCookie("/api/announcements", {}, residentA.cookie);
  let list = await res.json();
  assert(Array.isArray(list) && list.some((a: any) => a.id === ann.id), "A2 resident read");
  // Resident cannot create
  res = await fetchWithCookie("/api/announcements", { method: "POST", body: JSON.stringify({ title: "Hack", body: "x" }) }, residentA.cookie);
  assert(res.status === 403, "A3 resident cannot create 403");
  // Cross-tenant blocked
  res = await fetchWithCookie(`/api/announcements/${ann.id}`, {}, residentB.cookie);
  assert(res.status === 404, "A4 cross-tenant blocked 404");
  // Forged societyId ignored (POST with societyId should not affect)
  res = await fetchWithCookie("/api/announcements", { method: "POST", body: JSON.stringify({ title: "Spoof", body: "x", societyId: B.soc.id }) }, adminA.cookie);
  const spoof = await res.json();
  // It should create in A, not B
  res = await fetchWithCookie("/api/announcements", {}, adminB.cookie);
  list = await res.json();
  assert(!list.some((a: any) => a.id === spoof.id), "A5 forged societyId ignored");
  // IDOR blocked: residentB cannot PATCH adminA's announcement
  res = await fetchWithCookie(`/api/announcements/${ann.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "Hacked" }) }, residentB.cookie);
  assert(res.status === 403 || res.status === 404, "A6 IDOR blocked");
  // Audit generated
  let audits = await db.select().from(auditLogs).where(eq(auditLogs.entity, "announcement"));
  assert(audits.length > 0, "A7 audit generated");
  // Notifications: own visible
  res = await fetchWithCookie("/api/notifications", {}, residentA.cookie);
  let notifsA = await res.json();
  assert(Array.isArray(notifsA) && notifsA.some((n: any) => n.relatedId === ann.id), "N2 own notifications visible");
  // Another user's notifications blocked (residentA cannot mark residentB's notification)
  res = await fetchWithCookie("/api/notifications", {}, residentB.cookie);
  let notifsB = await res.json();
  // Create a notification for B via announcement in B
  const annBRes = await fetchWithCookie("/api/announcements", { method: "POST", body: JSON.stringify({ title: "B Ann", body: "Hi B" }) }, adminB.cookie);
  const annB = await annBRes.json();
  res = await fetchWithCookie("/api/notifications", {}, residentB.cookie);
  notifsB = await res.json();
  const notifB = notifsB.find((n: any) => n.relatedId === annB.id);
  assert(notifB, "N3 B notification exists");
  if (notifB) {
    res = await fetchWithCookie(`/api/notifications/${notifB.id}`, { method: "PATCH" }, residentA.cookie);
    assert(res.status === 404, "N4 another user's notification blocked 404");
  } else assert(false, "N4 another user's notification blocked 404");
  // Cross-society blocked: A cannot see B's notification via direct fetch? Already above, but check that A's list doesn't contain B's
  res = await fetchWithCookie("/api/notifications", {}, residentA.cookie);
  notifsA = await res.json();
  assert(!notifsA.some((n: any) => n.relatedId === annB.id), "N5 cross-society blocked");
  // Mark-read auth
  const notifA = notifsA.find((n: any) => n.relatedId === ann.id);
  if (notifA) {
    res = await fetchWithCookie(`/api/notifications/${notifA.id}`, { method: "PATCH" }, residentA.cookie);
    assert(res.status === 200, "N6 mark-read auth 200");
  } else assert(false, "N6 mark-read");
  // Mark-all-read
  res = await fetchWithCookie("/api/notifications/read-all", { method: "POST" }, residentA.cookie);
  assert(res.status === 200, "N7 mark-all-read 200");
  // Polls
  // Resident read (empty initially, but admin will create)
  res = await fetchWithCookie("/api/polls", {}, residentA.cookie);
  assert(res.status === 200, "P1 resident read 200");
  // Admin create
  res = await fetchWithCookie("/api/polls", { method: "POST", body: JSON.stringify({ question: "EV charging?", options: ["Yes", "No"] }) }, adminA.cookie);
  assert(res.status === 201, "P2 admin create 201");
  const pollRes = await res.json();
  const pollId = pollRes.poll.id;
  const optId = pollRes.options[0].id;
  const optId2 = pollRes.options[1].id;
  // Resident cannot create
  res = await fetchWithCookie("/api/polls", { method: "POST", body: JSON.stringify({ question: "Hack", options: ["A", "B"] }) }, residentA.cookie);
  assert(res.status === 403, "P3 resident cannot create 403");
  // Valid vote
  res = await fetchWithCookie(`/api/polls/${pollId}/vote`, { method: "POST", body: JSON.stringify({ optionId: optId }) }, residentA.cookie);
  assert(res.status === 201, "P4 valid vote 201");
  // Duplicate vote rejected
  res = await fetchWithCookie(`/api/polls/${pollId}/vote`, { method: "POST", body: JSON.stringify({ optionId: optId2 }) }, residentA.cookie);
  assert(res.status === 409, "P5 duplicate vote 409");
  // Cross-tenant vote blocked
  res = await fetchWithCookie(`/api/polls/${pollId}/vote`, { method: "POST", body: JSON.stringify({ optionId: optId }) }, residentB.cookie);
  assert(res.status === 404 || res.status === 403, "P6 cross-tenant vote blocked");
  // Forged IDs blocked (invalid poll)
  res = await fetchWithCookie(`/api/polls/00000000-0000-0000-0000-000000000000/vote`, { method: "POST", body: JSON.stringify({ optionId: optId }) }, residentA.cookie);
  assert(res.status === 404, "P7 forged pollId 404");
  // Forged option (use admin who hasn't voted yet)
  res = await fetchWithCookie(`/api/polls/${pollId}/vote`, { method: "POST", body: JSON.stringify({ optionId: "00000000-0000-0000-0000-000000000000" }) }, adminA.cookie);
  assert(res.status === 400, "P8 forged option 400");
  // Closed poll rejected
  const closedRes = await fetchWithCookie("/api/polls", { method: "POST", body: JSON.stringify({ question: "Closed?", options: ["A", "B"], endsAt: new Date(Date.now() + 60000).toISOString() }) }, adminA.cookie);
  const closedPoll = await closedRes.json();
  // Manually close by patching endsAt to past
  await fetchWithCookie(`/api/polls/${closedPoll.poll.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endsAt: new Date(Date.now() - 60000).toISOString() }) }, adminA.cookie);
  res = await fetchWithCookie(`/api/polls/${closedPoll.poll.id}/vote`, { method: "POST", body: JSON.stringify({ optionId: closedPoll.options[0].id }) }, residentA.cookie);
  assert(res.status === 409, "P9 closed poll rejected 409");
  // Concurrent double vote protection (try two simultaneous votes with fresh poll and fresh user)
  const concPollRes = await fetchWithCookie("/api/polls", { method: "POST", body: JSON.stringify({ question: "Concurrent?", options: ["X", "Y"] }) }, adminA.cookie);
  const concPoll = await concPollRes.json();
  const concOpt = concPoll.options[0].id;
  // Create fresh resident for concurrent test
  const phoneC = `9009${randomInt(100000,999999)}${Date.now().toString().slice(-2)}`;
  const [userC] = await db.insert(users).values({ phone: phoneC, fullName: "Conc Resident", phoneVerified: true }).returning();
  await db.insert(userSocietyRoles).values({ userId: userC.id, societyId: A.soc.id, role: "RESIDENT" });
  const { unitMembers } = await import("../src/lib/db/schema");
  await db.insert(unitMembers).values({ societyId: A.soc.id, unitId: A.unit.id, userId: userC.id, relation: "OWNER", isPrimary: false, isVerified: true });
  const tokenC = await signJwt({ userId: userC.id, phone: userC.phone }, "24h");
  await db.insert((await import("../src/lib/db/schema")).sessions).values({ userId: userC.id, token: tokenC, expiresAt: new Date(Date.now() + 86400000) });
  const cookieC = `session=${tokenC}; active_society=${A.soc.id}`;
  const [r1, r2] = await Promise.all([
    fetchWithCookie(`/api/polls/${concPoll.poll.id}/vote`, { method: "POST", body: JSON.stringify({ optionId: concOpt }) }, cookieC),
    fetchWithCookie(`/api/polls/${concPoll.poll.id}/vote`, { method: "POST", body: JSON.stringify({ optionId: concOpt }) }, cookieC),
  ]);
  const statuses = [r1.status, r2.status].sort();
  assert(statuses[0] === 201 && statuses[1] === 409, "P10 concurrent double vote 201+409");
  // Audit poll creation/vote
  audits = await db.select().from(auditLogs).where(eq(auditLogs.entity, "poll"));
  assert(audits.length > 0, "P11 audit poll");
  // Events
  res = await fetchWithCookie("/api/events", {}, residentA.cookie);
  assert(res.status === 200, "E1 resident read 200");
  res = await fetchWithCookie("/api/events", { method: "POST", body: JSON.stringify({ title: "Holi", startsAt: new Date(Date.now() + 86400000).toISOString(), location: "Park" }) }, residentA.cookie);
  assert(res.status === 403, "E2 resident cannot create 403");
  res = await fetchWithCookie("/api/events", { method: "POST", body: JSON.stringify({ title: "Meeting", description: "Annual", startsAt: new Date(Date.now() + 86400000).toISOString(), location: "Hall" }) }, adminA.cookie);
  assert(res.status === 201, "E3 admin create 201");
  const ev = await res.json();
  // Cross-tenant blocked
  res = await fetchWithCookie(`/api/events/${ev.id}`, {}, residentB.cookie);
  assert(res.status === 404, "E4 cross-tenant blocked 404");
  // IDOR blocked: residentB cannot PATCH
  res = await fetchWithCookie(`/api/events/${ev.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "Hacked" }) }, residentB.cookie);
  assert(res.status === 403 || res.status === 404, "E5 IDOR blocked");
  // Emergency
  res = await fetchWithCookie("/api/emergency", { method: "POST", body: JSON.stringify({ type: "FIRE" }) }, residentA.cookie);
  assert(res.status === 403, "EM1 resident cannot create 403");
  res = await fetchWithCookie("/api/emergency", { method: "POST", body: JSON.stringify({ type: "MEDICAL" }) }, guardA.cookie);
  // guard is not allowed? emergency:manage is SOCIETY_ADMIN, SECURITY_MANAGER, SUPER_ADMIN — guard alone should be 403
  assert(res.status === 403, "EM2 guard cannot create (strict RBAC) 403");
  res = await fetchWithCookie("/api/emergency", { method: "POST", body: JSON.stringify({ type: "FIRE" }) }, adminA.cookie);
  assert(res.status === 201, "EM3 admin create 201");
  const em = await res.json();
  // Cross-tenant blocked
  res = await fetchWithCookie(`/api/emergency/${em.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "RESOLVED" }) }, adminB.cookie);
  assert(res.status === 404, "EM4 cross-tenant blocked 404");
  // Resident cannot escalate (cannot PATCH)
  res = await fetchWithCookie(`/api/emergency/${em.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "RESOLVED" }) }, residentA.cookie);
  assert(res.status === 403, "EM5 resident cannot resolve 403");
  // Audit emergency
  audits = await db.select().from(auditLogs).where(eq(auditLogs.entity, "emergency_alert"));
  assert(audits.length > 0, "EM6 audit emergency");
  // RLS checks via direct DB without tenant should be 0, but via owner should see. We already tested RLS in rls-mutation, here just verify that announcements are tenant scoped via API
  console.log(`\nCommunity Results: ${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
}
run().catch((e) => { console.error(e); process.exit(1); });
