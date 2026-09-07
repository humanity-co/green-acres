import { ownerDb as db } from "../src/lib/db";
import { users, societies, userSocietyRoles, units, buildings, floors, unitMembers, bills, payments } from "../src/lib/db/schema";
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
  const mkSoc = async (name:string)=>{
    const [soc] = await db.insert(societies).values({ name, code:`BL${suffix.slice(0,3)}${randomInt(10,99)}${name.slice(-1)}`, city:"Test" }).returning();
    const [b]=await db.insert(buildings).values({ societyId: soc.id, name:"B1", floorsCount:1 }).returning();
    const [f]=await db.insert(floors).values({ societyId: soc.id, buildingId:b.id, number:1 }).returning();
    const [u1]=await db.insert(units).values({ societyId: soc.id, buildingId:b.id, floorId:f.id, number:`BL-${suffix}-1` }).returning();
    const [u2]=await db.insert(units).values({ societyId: soc.id, buildingId:b.id, floorId:f.id, number:`BL-${suffix}-2` }).returning();
    return { soc, u1, u2 };
  };
  const A = await mkSoc("SocA-BL");
  const B = await mkSoc("SocB-BL");
  const mkUser = async (role:string, soc:any, unit:any)=>{
    const phone=`9006${randomInt(100000,999999)}${suffix.slice(0,1)}`.slice(0,12);
    const [u]=await db.insert(users).values({ phone, fullName:`${role} BL`, phoneVerified:true }).returning();
    await db.insert(userSocietyRoles).values({ userId:u.id, societyId:soc.id, role: role as any });
    await db.insert(unitMembers).values({ societyId:soc.id, unitId:unit.id, userId:u.id, relation:"OWNER", isPrimary:true, isVerified:true });
    const token=await signJwt({ userId:u.id, phone:u.phone },"24h");
    await db.insert((await import("../src/lib/db/schema")).sessions).values({ userId:u.id, token, expiresAt:new Date(Date.now()+86400000) });
    return { user:u, token, cookie:`session=${token}; active_society=${soc.id}`, unit, soc };
  };
  const residentA = await mkUser("RESIDENT", A.soc, A.u1);
  const residentA2 = await mkUser("RESIDENT", A.soc, A.u2);
  const adminA = await mkUser("SOCIETY_ADMIN", A.soc, A.u1);
  const residentB = await mkUser("RESIDENT", B.soc, B.u1);
  const adminB = await mkUser("SOCIETY_ADMIN", B.soc, B.u1);
  // create bill for A.u1 by admin
  const billRes = await fetchWithCookie("/api/bills", { method:"POST", body: JSON.stringify({ unitId: A.u1.id, title:"Maintenance", periodStart:"2026-01-01", periodEnd:"2026-01-31", dueDate:"2026-02-10", subtotal:"3500.00", tax:"630.00", total:"4130.00" }) }, adminA.cookie);
  const bill = await billRes.json();
  return { A, B, residentA, residentA2, adminA, residentB, adminB, bill };
}

let pass=0, fail=0;
const assert=(c:boolean,m:string)=>{ if(c){console.log(`✓ ${m}`); pass++;} else {console.log(`✗ ${m}`); fail++;}};

async function run(){
  console.log("Billing tests");
  const { A, B, residentA, residentA2, adminA, residentB, adminB, bill } = await createSocieties();

  // 1 unauth
  let res = await fetch(BASE+"/api/bills");
  assert(res.status===401, "1 unauth bill read 401");

  // 2 resident can read own
  res = await fetchWithCookie("/api/bills", {}, residentA.cookie);
  let list = await res.json();
  assert(Array.isArray(list) && list.some((b:any)=>b.id===bill.id), "2 resident can read own");

  // 3 cannot read another unit's bill
  res = await fetchWithCookie("/api/bills", {}, residentA2.cookie);
  list = await res.json();
  assert(!list.some((b:any)=>b.id===bill.id), "3 resident cannot read another unit's bill");

  // 4 cross-tenant blocked
  res = await fetchWithCookie(`/api/bills/${bill.id}`, {}, residentB.cookie);
  assert(res.status===403 || res.status===404, "4 cross-tenant bill blocked");

  // 5 resident cannot create bill
  res = await fetchWithCookie("/api/bills", { method:"POST", body: JSON.stringify({ unitId: A.u1.id, title:"Hack", periodStart:"2026-02-01", periodEnd:"2026-02-28", dueDate:"2026-03-10", subtotal:"100.00", total:"100.00" }) }, residentA.cookie);
  assert(res.status===403, "5 resident cannot create bill");

  // 6 admin can create valid bill
  res = await fetchWithCookie("/api/bills", { method:"POST", body: JSON.stringify({ unitId: A.u1.id, title:"Admin Bill", periodStart:"2026-02-01", periodEnd:"2026-02-28", dueDate:"2026-03-10", subtotal:"1000.00", tax:"180.00", total:"1180.00" }) }, adminA.cookie);
  assert(res.status===201, "6 admin can create valid bill");

  // 7 forged unitId blocked
  res = await fetchWithCookie("/api/bills", { method:"POST", body: JSON.stringify({ unitId:"00000000-0000-0000-0000-000000000000", title:"Hack", periodStart:"2026-02-01", periodEnd:"2026-02-28", dueDate:"2026-03-10", subtotal:"100.00", total:"100.00" }) }, adminA.cookie);
  assert(res.status===500 || res.status===404, "7 forged unitId blocked");

  // 8 forged billId blocked
  res = await fetchWithCookie(`/api/bills/00000000-0000-0000-0000-000000000000`, {}, residentA.cookie);
  assert(res.status===404 || res.status===403, "8 forged billId blocked");

  // 9 resident cannot modify bill
  res = await fetchWithCookie(`/api/bills/${bill.id}`, { method:"PATCH", headers:{ "Content-Type":"application/json"}, body: JSON.stringify({ title:"Hacked" }) }, residentA.cookie);
  assert(res.status===403, "9 resident cannot modify bill");

  // 10 unauthorized payment read blocked (unauth)
  res = await fetch(BASE+"/api/payments");
  assert(res.status===401, "10 unauth payment read 401");

  // 11 resident sees only authorized payment history (create payment then check)
  // Create a payment for bill by residentA
  res = await fetchWithCookie("/api/payments", { method:"POST", body: JSON.stringify({ billId: bill.id, amount:"100.00" }) }, residentA.cookie);
  assert(res.status===201, "11a resident can create payment attempt");
  const pay = await res.json();
  let pays = await fetchWithCookie("/api/payments", {}, residentA.cookie).then(r=>r.json());
  assert(pays.some((p:any)=>p.id===pay.id), "11 resident sees own payment");
  let paysB = await fetchWithCookie("/api/payments", {}, residentB.cookie).then(r=>r.json());
  assert(!paysB.some((p:any)=>p.id===pay.id), "11b other society not see");

  // 12 payment record authorization enforced (residentA2 cannot pay for A.u1 bill)
  res = await fetchWithCookie("/api/payments", { method:"POST", body: JSON.stringify({ billId: bill.id, amount:"50.00" }) }, residentA2.cookie);
  assert(res.status===403, "12 payment authorization enforced");

  // 13 duplicate payment/reference protection (gatewayRef)
  const dupRef = `mock_${Date.now()}_dup`;
  res = await fetchWithCookie("/api/payments", { method:"POST", body: JSON.stringify({ billId: bill.id, amount:"10.00", gatewayRef: dupRef }) }, residentA.cookie);
  assert(res.status===201, "13a first gatewayRef ok");
  res = await fetchWithCookie("/api/payments", { method:"POST", body: JSON.stringify({ billId: bill.id, amount:"10.00", gatewayRef: dupRef }) }, residentA.cookie);
  assert(res.status===409, "13 duplicate gatewayRef blocked");

  // 14 invalid payment state transition blocked - resident cannot set SUCCESS (no API to set, but try to patch bill to PAID)
  res = await fetchWithCookie(`/api/bills/${bill.id}`, { method:"PATCH", headers:{ "Content-Type":"application/json"}, body: JSON.stringify({ status:"PAID" }) }, residentA.cookie);
  assert(res.status===403, "14 resident cannot set PAID 403");
  // Admin trying to directly set PAID should also be blocked per our logic
  res = await fetchWithCookie(`/api/bills/${bill.id}`, { method:"PATCH", headers:{ "Content-Type":"application/json"}, body: JSON.stringify({ status:"PAID" }) }, adminA.cookie);
  assert(res.status===500 || res.status===400, "14b admin direct PAID blocked");

  // 15 negative/invalid amount rejected
  res = await fetchWithCookie("/api/payments", { method:"POST", body: JSON.stringify({ billId: bill.id, amount:"-100.00" }) }, residentA.cookie);
  assert(res.status===400, "15 negative amount rejected");
  res = await fetchWithCookie("/api/payments", { method:"POST", body: JSON.stringify({ billId: bill.id, amount:"abc" }) }, residentA.cookie);
  assert(res.status===400, "15b invalid amount rejected");

  // 16 audit generated
  const { auditLogs } = await import("../src/lib/db/schema");
  const { eq: eq2 } = await import("drizzle-orm");
  const audits = await db.select().from(auditLogs).where(eq2(auditLogs.entity, "bill"));
  assert(audits.length>0, "16 audit for bill");

  // 17 notification generated where appropriate (bill creation)
  const { notifications } = await import("../src/lib/db/schema");
  const notifs = await db.select().from(notifications).where(eq2(notifications.relatedEntity, "bill"));
  assert(notifs.length>0, "17 notification for bill");

  // 18 RLS SELECT blocked already via 4
  // 19 INSERT blocked already via cross-tenant
  // Create cross-tenant bill attempt via adminB trying to create for A unit
  res = await fetchWithCookie("/api/bills", { method:"POST", body: JSON.stringify({ unitId: A.u1.id, title:"Cross", periodStart:"2026-03-01", periodEnd:"2026-03-31", dueDate:"2026-04-10", subtotal:"100.00", total:"100.00" }) }, adminB.cookie);
  assert(res.status===500 || res.status===404, "19 cross-tenant INSERT blocked");

  // 20 UPDATE blocked
  res = await fetchWithCookie(`/api/bills/${bill.id}`, { method:"PATCH", headers:{ "Content-Type":"application/json"}, body: JSON.stringify({ title:"Hacked" }) }, adminB.cookie);
  assert(res.status===403 || res.status===404, "20 cross-tenant UPDATE blocked");

  // 21 DELETE blocked (no delete route, but test via attempt to patch with delete? Use payment delete not exist, so test bill delete via direct? Our bills have no DELETE route, so expect 404)
  res = await fetch(BASE+`/api/bills/${bill.id}`, { method:"DELETE", headers:{ "Cookie": adminB.cookie } });
  assert(res.status===404 || res.status===405 || res.status===403, "21 cross-tenant DELETE blocked (no route)");

  console.log(`\nBilling Results: ${pass} passed, ${fail} failed`);
  process.exit(fail>0?1:0);
}
run().catch(e=>{ console.error(e); process.exit(1); });
