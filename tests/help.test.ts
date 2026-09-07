import { ownerDb as db } from "../src/lib/db";
import { users, societies, userSocietyRoles, units, buildings, floors, unitMembers } from "../src/lib/db/schema";
import { signJwt } from "../src/lib/auth/jwt";
import { randomInt } from "crypto";

const BASE = "http://localhost:4000";
async function fetchWithCookie(path: string, opts: any = {}, cookie?: string) {
  const headers: any = { "Content-Type": "application/json", ...(opts.headers || {}) };
  if (cookie) headers["Cookie"] = cookie;
  const res = await fetch(BASE + path, { ...opts, headers });
  return res;
}
async function createSocieties() {
  const suffix = Date.now().toString().slice(-6);
  const mkUser = async (role:string, socId:string, unitId:string) => {
    const phone = `9009${randomInt(100000,999999)}${suffix.slice(0,2)}`;
    const [u] = await db.insert(users).values({ phone, fullName: `${role} Help`, phoneVerified: true }).returning();
    await db.insert(userSocietyRoles).values({ userId: u.id, societyId: socId, role: role as any });
    if (unitId) await db.insert(unitMembers).values({ societyId: socId, unitId, userId: u.id, relation: "OWNER", isPrimary: true, isVerified: true });
    const token = await signJwt({ userId: u.id, phone: u.phone }, "24h");
    await db.insert((await import("../src/lib/db/schema")).sessions).values({ userId: u.id, token, expiresAt: new Date(Date.now()+86400000) });
    return { user: u, token, cookie: `session=${token}; active_society=${socId}` };
  };
  const [socA] = await db.insert(societies).values({ name: `SocH-A-${suffix}`, code: `HA${suffix}${randomInt(10,99)}`, city:"Test" }).returning();
  const [socB] = await db.insert(societies).values({ name: `SocH-B-${suffix}`, code: `HB${suffix}${randomInt(10,99)}`, city:"Test" }).returning();
  for (const soc of [socA, socB]) {
    const [b]=await db.insert(buildings).values({ societyId: soc.id, name:"B1", floorsCount:1 }).returning();
    const [f]=await db.insert(floors).values({ societyId: soc.id, buildingId:b.id, number:1 }).returning();
    const [u]=await db.insert(units).values({ societyId: soc.id, buildingId:b.id, floorId:f.id, number:`HH-${soc.id.slice(0,4)}` }).returning();
    (soc as any).unitId = u.id;
  }
  const residentA = await mkUser("RESIDENT", socA.id, (socA as any).unitId);
  const guardA = await mkUser("GUARD", socA.id, (socA as any).unitId);
  const residentB = await mkUser("RESIDENT", socB.id, (socB as any).unitId);
  const guardB = await mkUser("GUARD", socB.id, (socB as any).unitId);
  const residentA2 = await mkUser("RESIDENT", socA.id, (socA as any).unitId); // another unit? use same unit for now but second user also in same unit
  // Make second resident in different unit of same society for "another unit" test
  const [b2]=await db.insert(buildings).values({ societyId: socA.id, name:"B2", floorsCount:1 }).returning();
  const [f2]=await db.insert(floors).values({ societyId: socA.id, buildingId:b2.id, number:1 }).returning();
  const [u2]=await db.insert(units).values({ societyId: socA.id, buildingId:b2.id, floorId:f2.id, number:`HH2-${suffix}` }).returning();
  // move residentA2 to u2
  await db.delete(unitMembers).where((await import("drizzle-orm")).eq(unitMembers.userId, residentA2.user.id));
  await db.insert(unitMembers).values({ societyId: socA.id, unitId: u2.id, userId: residentA2.user.id, relation:"OWNER", isPrimary:true, isVerified:true });
  (residentA2 as any).unitId = u2.id;
  return { socA, socB, residentA, guardA, residentB, guardB, residentA2 };
}

let pass=0, fail=0;
const assert=(c:boolean, m:string)=>{ if(c){console.log(`✓ ${m}`); pass++;} else {console.log(`✗ ${m}`); fail++;}};

async function run(){
  console.log("Help tests");
  const { socA, socB, residentA, guardA, residentB, guardB, residentA2 } = await createSocieties();

  // 1 unauth
  let res = await fetch(BASE+"/api/help", { method:"POST", headers:{ "Content-Type":"application/json"}, body: JSON.stringify({ name:"Test", phone:"9000000000", category:"MAID" }) });
  assert(res.status===401, "1 unauth help create → 401");

  // 2 resident can create for own unit
  res = await fetchWithCookie("/api/help", { method:"POST", body: JSON.stringify({ name:"Lakshmi", phone:"9000111111", category:"MAID", unitId: (socA as any).unitId }) }, residentA.cookie);
  assert(res.status===201, "2 resident create own → 201");
  const created = await res.json();
  const helpId = created.help.id;

  // 3 cross-tenant creation blocked (resident A tries to use B unit)
  res = await fetchWithCookie("/api/help", { method:"POST", body: JSON.stringify({ name:"Hacker", phone:"9000222222", category:"COOK", unitId: (socB as any).unitId }) }, residentA.cookie);
  assert(res.status===500 || res.status===403, "3 cross-tenant create blocked");

  // 4 resident sees own help
  let list = await fetchWithCookie("/api/help", {}, residentA.cookie).then(r=>r.json());
  assert(Array.isArray(list) && list.some((x:any)=>x.help.id===helpId), "4 resident sees own");

  // 5 resident B cannot see A help
  let listB = await fetchWithCookie("/api/help", {}, residentB.cookie).then(r=>r.json());
  assert(!listB.some((x:any)=>x.help.id===helpId), "5 B cannot see A help");

  // 6 resident cannot see another unit's help in same society (residentA2 in different unit)
  let listA2 = await fetchWithCookie("/api/help", {}, (residentA2 as any).cookie).then(r=>r.json());
  assert(!listA2.some((x:any)=>x.help.id===helpId), "6 same-society different unit not visible");

  // 7 guard sees all in society
  let guardList = await fetchWithCookie("/api/help", {}, guardA.cookie).then(r=>r.json());
  assert(guardList.some((x:any)=>x.help.id===helpId), "7 guard sees all");

  // 8 guard attendance check-in
  res = await fetchWithCookie("/api/help/attendance", { method:"POST", body: JSON.stringify({ helpId, unitId: (socA as any).unitId }) }, guardA.cookie);
  assert(res.status===201, "8 guard check-in → 201");
  const att = await res.json();

  // 9 duplicate check-in blocked
  res = await fetchWithCookie("/api/help/attendance", { method:"POST", body: JSON.stringify({ helpId, unitId: (socA as any).unitId }) }, guardA.cookie);
  assert(res.status===409, "9 duplicate check-in → 409");

  // 10 unauthorized check-in (resident trying attendance)
  res = await fetchWithCookie("/api/help/attendance", { method:"POST", body: JSON.stringify({ helpId, unitId: (socA as any).unitId }) }, residentA.cookie);
  assert(res.status===403, "10 resident attendance → 403");

  // 11 cross-tenant attendance blocked (B guard check-in A help)
  res = await fetchWithCookie("/api/help/attendance", { method:"POST", body: JSON.stringify({ helpId, unitId: (socA as any).unitId }) }, guardB.cookie);
  assert(res.status===500 || res.status===403, "11 cross-tenant attendance blocked");

  // 12 successful check-out
  res = await fetchWithCookie("/api/help/attendance", { method:"POST", body: JSON.stringify({ attendanceId: att.id }) }, guardA.cookie);
  assert(res.status===200, "12 check-out → 200");

  // 13 duplicate check-out blocked
  res = await fetchWithCookie("/api/help/attendance", { method:"POST", body: JSON.stringify({ attendanceId: att.id }) }, guardA.cookie);
  assert(res.status===409, "13 duplicate check-out → 409");

  // 14 audit generated
  const { auditLogs } = await import("../src/lib/db/schema");
  const { eq } = await import("drizzle-orm");
  const audits = await db.select().from(auditLogs).where(eq(auditLogs.entity, "daily_help"));
  assert(audits.length>0, "14 audit for help");

  console.log(`\nHelp Results: ${pass} passed, ${fail} failed`);
  process.exit(fail>0?1:0);
}
run().catch(e=>{ console.error(e); process.exit(1); });
