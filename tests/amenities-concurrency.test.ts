import { db, ownerDb } from "../src/lib/db";
import { users, societies, userSocietyRoles, units, unitMembers, amenities, amenitySlots, bookings, bills, billItems, payments, sessions } from "../src/lib/db/schema";
import { signJwt } from "../src/lib/auth/jwt";
import { eq, and, inArray } from "drizzle-orm";

const BASE_URL = "http://localhost:4000";

let societyId: string;
let unitId: string;
let residentUser1: any;
let residentUser2: any;
let residentCookie1: string;
let residentCookie2: string;
let adminUser: any;
let adminCookie: string;

let testAmenityCapacity1: any; // capacity: 1, fee: 0
let testAmenityPaid: any;        // capacity: 2, fee: 250.00
let testSlot1: any;
let testSlot2: any;
let pastSlot: any;

let createdBookingIds: string[] = [];
let createdBillIds: string[] = [];
let createdSessionTokens: string[] = [];

async function setup() {
  console.log("\n--- Setting up Amenity Concurrency & Auto-Invoicing Test Environment ---");

  // Fetch or setup society
  const [soc] = await ownerDb.select().from(societies).limit(1);
  if (!soc) throw new Error("No society found in DB");
  societyId = soc.id;

  // Fetch or setup unit
  const [u] = await ownerDb.select().from(units).where(eq(units.societyId, societyId)).limit(1);
  if (!u) throw new Error("No unit found in DB");
  unitId = u.id;

  const mkUser = async (name: string, role: string) => {
    const rand = Math.floor(100000 + Math.random() * 900000);
    const [usr] = await ownerDb.insert(users).values({
      phone: `98${rand}`,
      fullName: name,
      phoneVerified: true,
    }).returning();

    await ownerDb.insert(userSocietyRoles).values({
      userId: usr.id,
      societyId,
      role: role as any,
    });

    await ownerDb.insert(unitMembers).values({
      userId: usr.id,
      societyId,
      unitId,
      relation: "OWNER",
      isPrimary: true,
      isVerified: true,
    });

    const token = await signJwt({ userId: usr.id, phone: usr.phone }, "24h");
    await ownerDb.insert(sessions).values({
      userId: usr.id,
      token,
      expiresAt: new Date(Date.now() + 86400000),
    });
    createdSessionTokens.push(token);

    return {
      user: usr,
      cookie: `session=${token}; active_society=${societyId}`,
    };
  };

  const r1 = await mkUser("Resident Alpha", "RESIDENT");
  residentUser1 = r1.user;
  residentCookie1 = r1.cookie;

  const r2 = await mkUser("Resident Beta", "RESIDENT");
  residentUser2 = r2.user;
  residentCookie2 = r2.cookie;

  const adm = await mkUser("Admin Facility", "SOCIETY_ADMIN");
  adminUser = adm.user;
  adminCookie = adm.cookie;

  const rand = Math.floor(1000 + Math.random() * 9000);

  // Create Free Amenity with Capacity 1
  const [am1] = await ownerDb.insert(amenities).values({
    societyId,
    name: `Tennis Court Test ${rand}`,
    type: "SPORTS",
    capacity: 1,
    fee: "0.00",
    isActive: true,
  }).returning();
  testAmenityCapacity1 = am1;

  // Add a slot
  const [s1] = await ownerDb.insert(amenitySlots).values({
    societyId,
    amenityId: am1.id,
    dayOfWeek: new Date().getDay(),
    startTime: "18:00",
    endTime: "19:00",
  }).returning();
  testSlot1 = s1;

  // Create Paid Amenity with Capacity 2, Fee ₹250.00
  const [am2] = await ownerDb.insert(amenities).values({
    societyId,
    name: `Clubhouse Hall Test ${rand}`,
    type: "HALL",
    capacity: 2,
    fee: "250.00",
    isActive: true,
  }).returning();
  testAmenityPaid = am2;

  const [s2] = await ownerDb.insert(amenitySlots).values({
    societyId,
    amenityId: am2.id,
    dayOfWeek: new Date().getDay(),
    startTime: "20:00",
    endTime: "22:00",
  }).returning();
  testSlot2 = s2;

  // Create a past slot for today (00:01 - 00:30)
  const [ps] = await ownerDb.insert(amenitySlots).values({
    societyId,
    amenityId: am1.id,
    dayOfWeek: new Date().getDay(),
    startTime: "00:01",
    endTime: "00:30",
  }).returning();
  pastSlot = ps;

  console.log("Setup completed successfully!");
}

async function runTests() {
  await setup();

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`  ✓ ${msg}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${msg}`);
      failed++;
    }
  }

  const futureDate = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  const todayStr = new Date().toISOString().slice(0, 10);

  console.log("\n--- Suite 1: Slot Concurrency & Capacity Limiting ---");

  // Test 1: Resident 1 successfully books free slot (capacity 1)
  const res1 = await fetch(`${BASE_URL}/api/bookings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: residentCookie1,
    },
    body: JSON.stringify({
      amenityId: testAmenityCapacity1.id,
      slotId: testSlot1.id,
      bookingDate: futureDate,
      unitId,
    }),
  });
  const data1 = await res1.json();
  assert(res1.status === 201, `Resident 1 books free slot (HTTP ${res1.status})`);
  assert(data1.booking?.status === "CONFIRMED", "Free amenity is CONFIRMED immediately");
  assert(data1.requiresPayment === false, "requiresPayment is false for free amenity");
  if (data1.booking?.id) createdBookingIds.push(data1.booking.id);

  // Test 2: Double-booking prevention — Resident 1 tries booking same slot on same date
  const resDouble = await fetch(`${BASE_URL}/api/bookings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: residentCookie1,
    },
    body: JSON.stringify({
      amenityId: testAmenityCapacity1.id,
      slotId: testSlot1.id,
      bookingDate: futureDate,
      unitId,
    }),
  });
  const dataDouble = await resDouble.json();
  assert(resDouble.status === 409, `Resident 1 double-booking rejected with HTTP 409 (got ${resDouble.status})`);
  assert(
    dataDouble.error?.includes("already have an active booking") || dataDouble.error?.includes("already have a booking"),
    `Double booking error message: "${dataDouble.error}"`
  );

  // Test 3: Capacity limit — Resident 2 tries booking same slot which is already full (capacity = 1)
  const resFull = await fetch(`${BASE_URL}/api/bookings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: residentCookie2,
    },
    body: JSON.stringify({
      amenityId: testAmenityCapacity1.id,
      slotId: testSlot1.id,
      bookingDate: futureDate,
      unitId,
    }),
  });
  const dataFull = await resFull.json();
  assert(resFull.status === 409, `Resident 2 rejected when capacity full (HTTP ${resFull.status})`);
  assert(dataFull.error?.includes("capacity: 1") || dataFull.error?.includes("fully booked"), `Capacity error: "${dataFull.error}"`);

  // Test 4: Past time slot check for today
  const resPast = await fetch(`${BASE_URL}/api/bookings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: residentCookie2,
    },
    body: JSON.stringify({
      amenityId: testAmenityCapacity1.id,
      slotId: pastSlot.id,
      bookingDate: todayStr,
      unitId,
    }),
  });
  const dataPast = await resPast.json();
  assert(resPast.status === 400, `Booking past time slot rejected with HTTP 400 (got ${resPast.status})`);
  assert(dataPast.error?.includes("started or passed"), `Past slot error message: "${dataPast.error}"`);

  console.log("\n--- Suite 2: Auto-Invoicing & Line Item Generation ---");

  // Test 5: Paid amenity booking initiates PENDING_PAYMENT with auto-invoiced bill & line items
  const resPaid = await fetch(`${BASE_URL}/api/bookings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: residentCookie1,
    },
    body: JSON.stringify({
      amenityId: testAmenityPaid.id,
      slotId: testSlot2.id,
      bookingDate: futureDate,
      unitId,
    }),
  });
  const dataPaid = await resPaid.json();
  assert(resPaid.status === 201, `Paid amenity booking initiated (HTTP ${resPaid.status})`);
  assert(dataPaid.booking?.status === "PENDING_PAYMENT", `Booking status is PENDING_PAYMENT (got ${dataPaid.booking?.status})`);
  assert(dataPaid.requiresPayment === true, "requiresPayment is true");
  assert(!!dataPaid.bill?.id, `Linked bill created with ID: ${dataPaid.bill?.id}`);
  assert(dataPaid.bill?.total === "250.00", `Bill total is ₹250.00 (got ${dataPaid.bill?.total})`);

  if (dataPaid.booking?.id) createdBookingIds.push(dataPaid.booking.id);
  if (dataPaid.bill?.id) createdBillIds.push(dataPaid.bill.id);

  // Test 6: Verify line item in billItems
  const items = await ownerDb.select().from(billItems).where(eq(billItems.billId, dataPaid.bill.id));
  assert(items.length > 0, `Bill has line items (count: ${items.length})`);
  assert(items[0].label.includes("Clubhouse Hall Test"), `Line item label matches: "${items[0].label}"`);
  assert(items[0].amount === "250.00", `Line item amount matches fee: ₹${items[0].amount}`);

  // Test 7: Booking GET detail returns cancellationEstimate preview & bill info
  const resDetail = await fetch(`${BASE_URL}/api/bookings/${dataPaid.booking.id}`, {
    headers: { Cookie: residentCookie1 },
  });
  const detailData = await resDetail.json();
  assert(resDetail.status === 200, `Booking detail fetched (HTTP ${resDetail.status})`);
  assert(detailData.bill?.id === dataPaid.bill.id, "Detail includes linked bill");
  assert(detailData.cancellationEstimate?.canCancel === true, "cancellationEstimate canCancel is true");
  assert(detailData.cancellationEstimate?.refundPercentage === 100, `Future booking (>24h) has 100% refund preview`);

  console.log("\n--- Suite 3: Payment Verification & Slot Confirmation ---");

  // Test 8: Create order for the linked bill
  const resOrder = await fetch(`${BASE_URL}/api/payments/create-order`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: residentCookie1,
    },
    body: JSON.stringify({ billId: dataPaid.bill.id }),
  });
  const orderData = await resOrder.json();
  assert(resOrder.status === 200, `Payment order created (HTTP ${resOrder.status})`);
  assert(orderData.amount === 25000, `Order amount is 25000 paise (₹250.00)`);

  // Test 9: Verify payment to confirm booking
  const fakePayId = `pay_test_${Date.now()}`;
  const resVerify = await fetch(`${BASE_URL}/api/payments/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: residentCookie1,
    },
    body: JSON.stringify({
      razorpay_order_id: orderData.orderId,
      razorpay_payment_id: fakePayId,
      razorpay_signature: "mock_signature",
      paymentId: orderData.paymentId,
    }),
  });
  const verifyData = await resVerify.json();
  assert(resVerify.status === 200, `Payment verified (HTTP ${resVerify.status})`);
  assert(verifyData.bill?.status === "PAID", "Bill status updated to PAID");

  // Test 10: Verify booking status transitioned to CONFIRMED
  const [confirmedBooking] = await ownerDb.select().from(bookings).where(eq(bookings.id, dataPaid.booking.id));
  assert(confirmedBooking.status === "CONFIRMED", `Booking status updated to CONFIRMED after payment (got ${confirmedBooking.status})`);

  console.log("\n--- Suite 4: Tiered Cancellation & Refund Policy ---");

  // Test 11: Resident 1 cancels paid booking > 24 hours in advance
  const resCancel = await fetch(`${BASE_URL}/api/bookings/${dataPaid.booking.id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Cookie: residentCookie1,
    },
    body: JSON.stringify({ status: "CANCELLED" }),
  });
  const cancelData = await resCancel.json();
  assert(resCancel.status === 200, `Booking cancelled successfully (HTTP ${resCancel.status})`);
  assert(cancelData.status === "CANCELLED", "Returned booking status is CANCELLED");

  // Test 12: Verify payment refunded & bill cancelled
  const [updatedPay] = await ownerDb.select().from(payments).where(eq(payments.id, orderData.paymentId));
  assert(updatedPay.status === "REFUNDED", `Payment status is REFUNDED (got ${updatedPay.status})`);
  const [updatedBill] = await ownerDb.select().from(bills).where(eq(bills.id, dataPaid.bill.id));
  assert(updatedBill.status === "CANCELLED", `Bill status is CANCELLED (got ${updatedBill.status})`);

  // Test 13: Partial Unique Index allows re-booking after cancellation!
  const resRebook = await fetch(`${BASE_URL}/api/bookings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: residentCookie1,
    },
    body: JSON.stringify({
      amenityId: testAmenityPaid.id,
      slotId: testSlot2.id,
      bookingDate: futureDate,
      unitId,
    }),
  });
  const dataRebook = await resRebook.json();
  assert(resRebook.status === 201, `Resident 1 can re-book previously cancelled slot (HTTP ${resRebook.status})`);
  if (dataRebook.booking?.id) createdBookingIds.push(dataRebook.booking.id);
  if (dataRebook.bill?.id) createdBillIds.push(dataRebook.bill.id);

  // Test 14: Resident 2 can also book the second capacity slot
  const resResident2 = await fetch(`${BASE_URL}/api/bookings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: residentCookie2,
    },
    body: JSON.stringify({
      amenityId: testAmenityPaid.id,
      slotId: testSlot2.id,
      bookingDate: futureDate,
      unitId,
    }),
  });
  const dataResident2 = await resResident2.json();
  assert(resResident2.status === 201, `Resident 2 books second capacity slot (HTTP ${resResident2.status})`);
  if (dataResident2.booking?.id) createdBookingIds.push(dataResident2.booking.id);
  if (dataResident2.bill?.id) createdBillIds.push(dataResident2.bill.id);

  console.log("\n==========================================");
  console.log(`Phase 2 Test Results: ${passed} PASSED, ${failed} FAILED (Total: ${passed + failed})`);
  console.log("==========================================\n");

  // Cleanup test artifacts
  try {
    if (createdBookingIds.length > 0) {
      await ownerDb.delete(bookings).where(inArray(bookings.id, createdBookingIds));
    }
    if (createdBillIds.length > 0) {
      await ownerDb.delete(billItems).where(inArray(billItems.billId, createdBillIds));
      await ownerDb.delete(payments).where(inArray(payments.billId, createdBillIds));
      await ownerDb.delete(bills).where(inArray(bills.id, createdBillIds));
    }
    await ownerDb.delete(amenitySlots).where(inArray(amenitySlots.id, [testSlot1.id, testSlot2.id, pastSlot.id]));
    await ownerDb.delete(amenities).where(inArray(amenities.id, [testAmenityCapacity1.id, testAmenityPaid.id]));
    if (createdSessionTokens.length > 0) {
      await ownerDb.delete(sessions).where(inArray(sessions.token, createdSessionTokens));
    }
    await ownerDb.delete(unitMembers).where(inArray(unitMembers.userId, [residentUser1.id, residentUser2.id]));
    await ownerDb.delete(userSocietyRoles).where(inArray(userSocietyRoles.userId, [residentUser1.id, residentUser2.id, adminUser.id]));
    await ownerDb.delete(users).where(inArray(users.id, [residentUser1.id, residentUser2.id, adminUser.id]));
  } catch (cleanErr) {
    console.warn("Cleanup warning:", cleanErr);
  }

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error("Test execution fatal error:", err);
  process.exit(1);
});
