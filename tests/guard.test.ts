import { ownerDb as db } from "../src/lib/db";
import { users, societies, userSocietyRoles, units, buildings, floors, visitors, visitorInvites } from "../src/lib/db/schema";
import { eq } from "drizzle-orm";
import { signJwt } from "../src/lib/auth/jwt";
import { randomInt, randomUUID } from "crypto";

const BASE = "http://localhost:4000";
async function fetchWithCookie(path: string, opts: any = {}, cookie?: string) {
  const headers: any = { "Content-Type": "application/json", ...(opts.headers || {}) };
  if (cookie) headers["Cookie"] = cookie;
  const res = await fetch(BASE + path, { ...opts, headers });
  return res;
}
async function createSocietyAndUsers() {
  const suffix = Date.now().toString().slice(-5);
  const phoneR = `9000100${randomInt(100,999)}${suffix.slice(0,2)}`;
  const phoneG = `9000200${randomInt(100,999)}${suffix.slice(1,3)}`;
  const [userR] = await db.insert(users).values({ phone: phoneR, fullName: "Resident Test", phoneVerified: true }).returning();
  const [userG] = await db.insert(users).values({ phone: phoneG, fullName: "Guard Test", phoneVerified: true }).returning();
  const [soc] = await db.insert(societies).values({ name: `SocG-${suffix}`, code: `SG${suffix}${randomInt(10,99)}`, city: "Test" }).returning();
  await db.insert(userSocietyRoles).values({ userId: userR.id, societyId: soc.id, role: "RESIDENT" });
  await db.insert(userSocietyRoles).values({ userId: userG.id, societyId: soc.id, role: "GUARD" });
  const [b] = await db.insert(buildings).values({ societyId: soc.id, name: "B1", floorsCount: 1 }).returning();
  const [f] = await db.insert(floors).values({ societyId: soc.id, buildingId: b.id, number: 1 }).returning();
  const [u] = await db.insert(units).values({ societyId: soc.id, buildingId: b.id, floorId: f.id, number: `GU-${suffix}` }).returning();
  const { gates } = await import("../src/lib/db/schema");
  const [gate] = await db.insert(gates).values({ societyId: soc.id, name: "Main Gate", type: "MAIN" }).returning();
  const tokenR = await signJwt({ userId: userR.id, phone: userR.phone }, "24h");
  const tokenG = await signJwt({ userId: userG.id, phone: userG.phone }, "24h");
  await db.insert((await import("../src/lib/db/schema")).sessions).values({ userId: userR.id, token: tokenR, expiresAt: new Date(Date.now()+86400000) });
  await db.insert((await import("../src/lib/db/schema")).sessions).values({ userId: userG.id, token: tokenG, expiresAt: new Date(Date.now()+86400000) });
  const cookieR = `session=${tokenR}; active_society=${soc.id}`;
  const cookieG = `session=${tokenG}; active_society=${soc.id}`;
  return { userR, userG, soc, unit: u, gate, cookieR, cookieG };
}

let pass=0, fail=0;
const assert = (c:boolean, msg:string)=>{ if(c){ console.log(`✓ ${msg}`); pass++; } else { console.log(`✗ ${msg}`); fail++; } };

async function run(){
  console.log("Guard tests");
  const A = await createSocietyAndUsers();
  const B = await createSocietyAndUsers();

  // 1 unauth
  let res = await fetch(BASE+"/api/guard/verify", { method:"POST", headers:{ "Content-Type":"application/json"}, body: JSON.stringify({ code:"ABC123"}) });
  assert(res.status===401, "1 unauth guard verify → 401");

  // 2 resident accessing guard route
  res = await fetchWithCookie("/api/guard/verify", { method:"POST", body: JSON.stringify({ code:"ABC123"}) }, A.cookieR);
  assert(res.status===403, "2 resident → guard verify 403");

  // Create invite for A via resident
  const inviteRes = await fetchWithCookie("/api/visitors/invite", { method:"POST", body: JSON.stringify({ name:"Test Visitor", phone:"9000111111", purpose:"Guest", unitId: A.unit.id }) }, A.cookieR);
  const inviteData = await inviteRes.json();
  const codeA = inviteData.invite.code;
  const inviteIdA = inviteData.invite.id;

  // 3 guard accessing another society (B guard verifying A code)
  res = await fetchWithCookie("/api/guard/verify", { method:"POST", body: JSON.stringify({ code: codeA }) }, B.cookieG);
  assert(res.status===404, "3 guard B verify A code → 404");

  // 4 guard verifying own society success
  res = await fetchWithCookie("/api/guard/verify", { method:"POST", body: JSON.stringify({ code: codeA }) }, A.cookieG);
  assert(res.status===200, "4 guard A verify A code → 200");

  // 5 forged gateId
  res = await fetchWithCookie("/api/guard/check-in", { method:"POST", body: JSON.stringify({ inviteId: inviteIdA, gateId: B.gate.id }) }, A.cookieG);
  assert(res.status===403, "5 forged gateId → 403");

  // 6 forged unitId in walk-in
  res = await fetchWithCookie("/api/guard/walk-in", { method:"POST", body: JSON.stringify({ visitorName:"Hacker", phone:"9000000000", purpose:"Guest", unitId: B.unit.id }) }, A.cookieG);
  assert(res.status===500 || res.status===403, "6 forged unitId walk-in rejected");

  // 7 expired pass
  const expCode = `EXP${Date.now().toString().slice(-4)}`;
  const [visitorExp] = await db.insert(visitors).values({ name:"Expired", phone:`9000222${randomInt(100,999)}`, societyId: A.soc.id }).returning();
  const [inviteExp] = await db.insert(visitorInvites).values({ societyId: A.soc.id, unitId: A.unit.id, createdBy: A.userR.id, visitorId: visitorExp.id, code: expCode, validFrom: new Date(Date.now()-86400000), validTo: new Date(Date.now()-3600000), status:"PENDING" }).returning();
  res = await fetchWithCookie("/api/guard/verify", { method:"POST", body: JSON.stringify({ code: expCode}) }, A.cookieG);
  assert(res.status===409, "7 expired pass → 409");

  // 8 cancelled
  const canCode = `CAN${Date.now().toString().slice(-4)}`;
  const [visitorCan] = await db.insert(visitors).values({ name:"Cancelled", phone:`9000333${randomInt(100,999)}`, societyId: A.soc.id }).returning();
  const [inviteCan] = await db.insert(visitorInvites).values({ societyId: A.soc.id, unitId: A.unit.id, createdBy: A.userR.id, visitorId: visitorCan.id, code: canCode, validFrom: new Date(), validTo: new Date(Date.now()+86400000), status:"CANCELLED" }).returning();
  res = await fetchWithCookie("/api/guard/verify", { method:"POST", body: JSON.stringify({ code: canCode}) }, A.cookieG);
  assert(res.status===409, "8 cancelled → 409");

  // 9 invalid code
  res = await fetchWithCookie("/api/guard/verify", { method:"POST", body: JSON.stringify({ code:"INVALID99"}) }, A.cookieG);
  assert(res.status===404, "9 invalid code → 404");

  // 10 successful check-in
  res = await fetchWithCookie("/api/guard/check-in", { method:"POST", body: JSON.stringify({ inviteId: inviteIdA, gateId: A.gate.id }) }, A.cookieG);
  assert(res.status===201, "10 successful check-in → 201");
  const entry = await res.json();

  // 11 duplicate check-in
  res = await fetchWithCookie("/api/guard/check-in", { method:"POST", body: JSON.stringify({ inviteId: inviteIdA, gateId: A.gate.id }) }, A.cookieG);
  assert(res.status===409, "11 duplicate check-in → 409");

  // 12 unauthorized check-out (resident)
  res = await fetchWithCookie("/api/guard/check-out", { method:"POST", body: JSON.stringify({ entryId: entry.id }) }, A.cookieR);
  assert(res.status===403, "12 resident check-out → 403");

  // 13 cross-tenant check-out (B guard checkout A entry)
  res = await fetchWithCookie("/api/guard/check-out", { method:"POST", body: JSON.stringify({ entryId: entry.id }) }, B.cookieG);
  assert(res.status===404 || res.status===403, "13 cross-tenant check-out blocked");

  // 14 cross-tenant resident search
  res = await fetchWithCookie("/api/guard/resident-search?q=A", {}, B.cookieG);
  const search = await res.json();
  assert(Array.isArray(search) && !search.some((r:any)=> r.unit?.id===A.unit.id), "14 cross-tenant resident search filtered");

  // 15 successful check-out
  res = await fetchWithCookie("/api/guard/check-out", { method:"POST", body: JSON.stringify({ entryId: entry.id }) }, A.cookieG);
  assert(res.status===200, "15 successful check-out → 200");

  // 16 RLS check: app_user without context sees 0
  // Already covered in rls tests, but quick check via guard expected should not leak B
  const expA = await fetchWithCookie("/api/guard/expected", {}, A.cookieG).then(r=>r.json());
  const expB = await fetchWithCookie("/api/guard/expected", {}, B.cookieG).then(r=>r.json());
  assert(!expA.some((e:any)=> e.invite?.societyId===B.soc.id), "16 RLS expected isolation");

  console.log(`\nGuard Results: ${pass} passed, ${fail} failed`);
  process.exit(fail>0?1:0);
}
run().catch(e=>{ console.error(e); process.exit(1); });
