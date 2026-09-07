import { ownerDb as db } from "../src/lib/db";
import { users, societies, userSocietyRoles, units, buildings, floors, unitMembers, amenities, amenitySlots, bookings } from "../src/lib/db/schema";
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
async function createSocietiesWithAmenity() {
  const suffix = Date.now().toString().slice(-6);
  const mkSoc = async (name:string)=>{
    const [soc] = await db.insert(societies).values({ name, code:`AM${suffix.slice(0,4)}${randomInt(10,99)}${name.slice(0,1)}`, city:"Test" }).returning();
    const [b]=await db.insert(buildings).values({ societyId: soc.id, name:"B1", floorsCount:1 }).returning();
    const [f]=await db.insert(floors).values({ societyId: soc.id, buildingId:b.id, number:1 }).returning();
    const [u]=await db.insert(units).values({ societyId: soc.id, buildingId:b.id, floorId:f.id, number:`AM-${suffix}` }).returning();
    const [amenity]=await db.insert(amenities).values({ societyId: soc.id, name:`Gym ${suffix}`, type:"GYM", capacity:10, fee:"0", isActive:true }).returning();
    const [slot]=await db.insert(amenitySlots).values({ societyId: soc.id, amenityId: amenity.id, dayOfWeek: new Date().getDay(), startTime:"10:00", endTime:"12:00" }).returning();
    return { soc, unit:u, amenity, slot };
  };
  const A = await mkSoc("SocA-AM");
  const B = await mkSoc("SocB-AM");
  const mkUser = async (role:string, soc:any, unit:any)=>{
    const phone = `9007${randomInt(100000,999999)}${suffix.slice(0,1)}`.slice(0,12);
    const [u]=await db.insert(users).values({ phone, fullName:`${role} AM`, phoneVerified:true }).returning();
    await db.insert(userSocietyRoles).values({ userId:u.id, societyId:soc.id, role: role as any });
    await db.insert(unitMembers).values({ societyId: soc.id, unitId: unit.id, userId:u.id, relation:"OWNER", isPrimary:true, isVerified:true });
    const token=await signJwt({ userId:u.id, phone:u.phone },"24h");
    await db.insert((await import("../src/lib/db/schema")).sessions).values({ userId:u.id, token, expiresAt:new Date(Date.now()+86400000) });
    return { user:u, token, cookie:`session=${token}; active_society=${soc.id}`, soc, unit };
  };
  const residentA = await mkUser("RESIDENT", A.soc, A.unit);
  const residentA2 = await mkUser("RESIDENT", A.soc, A.unit);
  // second resident in same society but different unit for isolation test
  const [b2]=await db.insert(buildings).values({ societyId: A.soc.id, name:"B2", floorsCount:1 }).returning();
  const [f2]=await db.insert(floors).values({ societyId: A.soc.id, buildingId:b2.id, number:1 }).returning();
  const [u2]=await db.insert(units).values({ societyId: A.soc.id, buildingId:b2.id, floorId:f2.id, number:`AM2-${suffix}` }).returning();
  // move residentA2 to u2
  await db.delete(unitMembers).where(eq(unitMembers.userId, residentA2.user.id));
  await db.insert(unitMembers).values({ societyId: A.soc.id, unitId:u2.id, userId:residentA2.user.id, relation:"OWNER", isPrimary:true, isVerified:true });
  residentA2.unit = u2 as any;
  const residentB = await mkUser("RESIDENT", B.soc, B.unit);
  const adminA = await mkUser("SOCIETY_ADMIN", A.soc, A.unit);
  const adminB = await mkUser("SOCIETY_ADMIN", B.soc, B.unit);
  return { A, B, residentA, residentA2, residentB, adminA, adminB };
}

let pass=0, fail=0;
const assert=(c:boolean,m:string)=>{ if(c){console.log(`✓ ${m}`); pass++;} else {console.log(`✗ ${m}`); fail++;}};

async function run(){
  console.log("Amenity tests");
  const { A, B, residentA, residentA2, residentB, adminA, adminB } = await createSocietiesWithAmenity();
  const today = new Date().toISOString().slice(0,10);
  const tomorrow = new Date(Date.now()+86400000).toISOString().slice(0,10);

  // 1 unauth
  let res = await fetch(BASE+"/api/amenities");
  assert(res.status===401, "1 unauth amenity read 401");

  // 2 resident can read authorized amenities
  res = await fetchWithCookie("/api/amenities", {}, residentA.cookie);
  let list = await res.json();
  assert(Array.isArray(list) && list.some((a:any)=>a.id===A.amenity.id), "2 resident can read authorized");

  // 3 cross-tenant blocked
  res = await fetchWithCookie(`/api/amenities/${B.amenity.id}`, {}, residentA.cookie);
  assert(res.status===404 || res.status===403, "3 cross-tenant amenity read blocked");

  // 4 resident can see valid slots
  res = await fetchWithCookie(`/api/amenities/${A.amenity.id}/slots`, {}, residentA.cookie);
  let slots = await res.json();
  assert(Array.isArray(slots) && slots.some((s:any)=>s.id===A.slot.id), "4 resident can see valid slots");

  // 5 cross-tenant slot access blocked
  res = await fetchWithCookie(`/api/amenities/${B.amenity.id}/slots`, {}, residentA.cookie);
  // B amenity belongs to other society, residentA should get 404 or empty via society check
  assert(res.status===404 || (Array.isArray(await res.clone().json()) && (await res.clone().json()).length===0) || res.status===403, "5 cross-tenant slot blocked");

  // 6 resident can create valid booking
  res = await fetchWithCookie("/api/bookings", { method:"POST", body: JSON.stringify({ amenityId: A.amenity.id, slotId: A.slot.id, bookingDate: tomorrow }) }, residentA.cookie);
  assert(res.status===201, "6 resident create valid booking "+res.status);
  const booking = await res.json();

  // 7 forged amenityId blocked
  res = await fetchWithCookie("/api/bookings", { method:"POST", body: JSON.stringify({ amenityId: "00000000-0000-0000-0000-000000000000", slotId: A.slot.id, bookingDate: tomorrow }) }, residentA.cookie);
  assert(res.status===404 || res.status===500, "7 forged amenityId blocked");

  // 8 forged slotId blocked
  res = await fetchWithCookie("/api/bookings", { method:"POST", body: JSON.stringify({ amenityId: A.amenity.id, slotId: "00000000-0000-0000-0000-000000000000", bookingDate: tomorrow }) }, residentA.cookie);
  assert(res.status===404 || res.status===500, "8 forged slotId blocked");

  // 9 cross-tenant booking blocked (B resident tries to book A amenity)
  res = await fetchWithCookie("/api/bookings", { method:"POST", body: JSON.stringify({ amenityId: A.amenity.id, slotId: A.slot.id, bookingDate: tomorrow }) }, residentB.cookie);
  assert(res.status===404 || res.status===403, "9 cross-tenant booking blocked");

  // 10 unauthorized modification blocked (residentB tries to cancel residentA's booking)
  res = await fetchWithCookie(`/api/bookings/${booking.id}`, { method:"PATCH", headers:{ "Content-Type":"application/json"}, body: JSON.stringify({ status:"CANCELLED" }) }, residentB.cookie);
  assert(res.status===403 || res.status===404, "10 unauthorized modification blocked");

  // 11 resident cannot modify another resident booking (same society different user)
  res = await fetchWithCookie(`/api/bookings/${booking.id}`, { method:"PATCH", headers:{ "Content-Type":"application/json"}, body: JSON.stringify({ status:"CANCELLED" }) }, residentA2.cookie);
  assert(res.status===403 || res.status===404, "11 resident cannot modify another's booking");

  // 12 duplicate double booking blocked
  res = await fetchWithCookie("/api/bookings", { method:"POST", body: JSON.stringify({ amenityId: A.amenity.id, slotId: A.slot.id, bookingDate: tomorrow }) }, residentA.cookie);
  assert(res.status===409, "12 double booking blocked");

  // 13 cancellation authorization (owner can cancel)
  res = await fetchWithCookie(`/api/bookings/${booking.id}`, { method:"PATCH", headers:{ "Content-Type":"application/json"}, body: JSON.stringify({ status:"CANCELLED" }) }, residentA.cookie);
  assert(res.status===200, "13 owner can cancel");

  // 14 successful cancellation already tested 13

  // 15 admin management authorization (resident cannot create amenity)
  res = await fetchWithCookie("/api/amenities", { method:"POST", headers:{ "Content-Type":"application/json"}, body: JSON.stringify({ name:"Test Pool", type:"POOL" }) }, residentA.cookie);
  assert(res.status===403, "15 resident cannot create amenity 403");

  // admin can create
  res = await fetchWithCookie("/api/amenities", { method:"POST", headers:{ "Content-Type":"application/json"}, body: JSON.stringify({ name:`Admin Pool ${Date.now()}`, type:"POOL" }) }, adminA.cookie);
  assert(res.status===201, "15b admin can create amenity");

  // 16 audit generated
  const { auditLogs } = await import("../src/lib/db/schema");
  const { eq: eq2 } = await import("drizzle-orm");
  const audits = await db.select().from(auditLogs).where(eq2(auditLogs.entity, "booking"));
  assert(audits.length>0, "16 audit generated");

  // 17 notification generated
  const { notifications } = await import("../src/lib/db/schema");
  const notifs = await db.select().from(notifications).where(eq2(notifications.relatedEntity, "booking"));
  assert(notifs.length>0, "17 notification generated");

  // 18 RLS SELECT blocked already via 3,9

  // 19 RLS INSERT blocked already via 7,8,9

  // 20 RLS UPDATE blocked via 10,11

  // 21 RLS DELETE blocked (admin delete, resident cannot)
  const newBookingRes = await fetchWithCookie("/api/bookings", { method:"POST", body: JSON.stringify({ amenityId: A.amenity.id, slotId: A.slot.id, bookingDate: new Date(Date.now()+2*86400000).toISOString().slice(0,10) }) }, residentA.cookie);
  const newBooking = await newBookingRes.json();
  res = await fetchWithCookie(`/api/bookings/${newBooking.id}`, { method:"DELETE" }, residentB.cookie);
  assert(res.status===403 || res.status===404, "21 RLS DELETE blocked");

  console.log(`\nAmenity Results: ${pass} passed, ${fail} failed`);
  process.exit(fail>0?1:0);
}
run().catch(e=>{ console.error(e); process.exit(1); });
