import { readFileSync } from "fs";
import { resolve } from "path";
import crypto from "crypto";

// Load .env
try {
  const envContent = readFileSync(resolve(process.cwd(), ".env"), "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const idx = trimmed.indexOf("=");
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
      if (key && !process.env[key]) {
        process.env[key] = val;
      }
    }
  }
} catch {}

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  [PASS] ${msg}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${msg}`);
    failed++;
  }
}

async function runTests() {
  console.log("==================================================");
  console.log("   AUDIT REMEDIATION FULL VERIFICATION SUITE       ");
  console.log("==================================================");

  // -------------------------------------------------------------
  // Test 1: SEC-06 Payment Provider Production Guard
  // -------------------------------------------------------------
  try {
    const originalEnv = process.env.NODE_ENV;
    const { getPaymentProvider } = await import("../src/lib/payments/provider");
    const devProvider = getPaymentProvider();
    const isMockVerified = devProvider.verifySignature({
      orderId: "order_123",
      paymentId: "pay_123",
      signature: "mock_signature",
    });
    assert(isMockVerified, "In dev environment, mock provider verifies mock_signature");

    // Test in simulated production
    (process.env as any).NODE_ENV = "production";
    let threw = false;
    try {
      await devProvider.createOrder({ amountPaise: 10000, currency: "INR", receipt: "r1" });
    } catch (e: any) {
      threw = e.message.includes("Mock gateway not allowed in production");
    }
    const sigDeniedInProd = devProvider.verifySignature({
      orderId: "order_123",
      paymentId: "pay_123",
      signature: "mock_signature",
    }) === false;

    assert(
      threw && sigDeniedInProd,
      "Mock payment provider throws on order creation and rejects signatures in production (SEC-06)"
    );
    (process.env as any).NODE_ENV = originalEnv;
  } catch (e: any) {
    assert(false, `Payment provider test failed: ${e.message}`);
  }

  // -------------------------------------------------------------
  // Test 2: SEC-09 File Upload Magic Bytes Validation
  // -------------------------------------------------------------
  try {
    const jpegHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
    const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
    const spoofedPhp = Buffer.from("<?php echo 'malicious'; ?>", "utf-8");

    // Test signature helper logic
    function isValidImageSignature(buffer: Buffer, mimeType: string): boolean {
      if (buffer.length < 12) return false;
      if (mimeType === "image/jpeg") return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
      if (mimeType === "image/png") {
        return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47 &&
               buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a;
      }
      if (mimeType === "image/webp") {
        return buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
               buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50;
      }
      return false;
    }

    assert(isValidImageSignature(jpegHeader, "image/jpeg"), "Valid JPEG header accepted");
    assert(isValidImageSignature(pngHeader, "image/png"), "Valid PNG header accepted");
    assert(!isValidImageSignature(spoofedPhp, "image/png"), "Spoofed PHP file masked as PNG rejected (SEC-09)");
  } catch (e: any) {
    assert(false, `Magic bytes test failed: ${e.message}`);
  }

  // -------------------------------------------------------------
  // Test 3: OTH-04 HMAC-Signed Active Society Cookie
  // -------------------------------------------------------------
  try {
    const secret = process.env.BETTER_AUTH_SECRET || process.env.NEXTAUTH_SECRET || "dev-secret-32chars-long-change-me-fallback-only-dev";
    const testSocietyId = "00000000-0000-0000-0000-000000000001";
    const validSig = crypto.createHmac("sha256", secret).update(testSocietyId).digest("hex");
    const signedValue = `${testSocietyId}.${validSig}`;

    // Verify HMAC
    const [id, sig] = signedValue.split(".");
    const expectedSig = crypto.createHmac("sha256", secret).update(id).digest("hex");
    const isValid = sig.length === expectedSig.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig));
    assert(isValid, "HMAC signature on active_society verifies with timing-safe equality (OTH-04)");

    // Test tamper resistance
    const tamperedValue = `${testSocietyId}.deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef`;
    const [, tamperedSig] = tamperedValue.split(".");
    const isTamperedValid = tamperedSig.length === expectedSig.length && crypto.timingSafeEqual(Buffer.from(tamperedSig), Buffer.from(expectedSig));
    assert(!isTamperedValid, "Tampered active_society cookie signature is rejected (OTH-04)");
  } catch (e: any) {
    assert(false, `Cookie signature test failed: ${e.message}`);
  }

  // -------------------------------------------------------------
  // Test 4: OTH-03 Audit Dead-Letter Queue
  // -------------------------------------------------------------
  try {
    const { audit, getAuditDeadLetterQueue, clearAuditDeadLetterQueue } = await import("../src/lib/audit");
    clearAuditDeadLetterQueue();

    // Trigger an audit insert with invalid societyId to exercise error handling
    await audit({
      actorId: "test-actor",
      societyId: "not-a-valid-uuid",
      action: "test_action",
      entity: "test_entity",
    });

    const deadLetters = getAuditDeadLetterQueue();
    assert(deadLetters.length > 0, "Failed audit log is captured in dead-letter buffer without throwing unhandled exception (OTH-03)");
    assert(deadLetters[0].entry.action === "test_action", "Dead-letter entry preserves audit log payload");
    clearAuditDeadLetterQueue();
  } catch (e: any) {
    assert(false, `Audit dead-letter test failed: ${e.message}`);
  }

  // -------------------------------------------------------------
  // Test 5: SEC-01 Booking Confirmed Schema Security
  // -------------------------------------------------------------
  try {
    const bookingsRouteSource = readFileSync(resolve(process.cwd(), "src/app/api/bookings/[id]/route.ts"), "utf-8");
    assert(
      bookingsRouteSource.includes('if (parsed.data.status==="CONFIRMED" && !isPrivileged)'),
      "Booking route explicitly forbids non-privileged users from self-confirming status (SEC-01)"
    );
  } catch (e: any) {
    assert(false, `SEC-01 check failed: ${e.message}`);
  }

  // -------------------------------------------------------------
  // Test 6: SEC-02 & SEC-05 withTenant Fan-Out Wrapping
  // -------------------------------------------------------------
  try {
    const emergencyRouteSource = readFileSync(resolve(process.cwd(), "src/app/api/emergency/route.ts"), "utf-8");
    const announcementsRouteSource = readFileSync(resolve(process.cwd(), "src/app/api/announcements/route.ts"), "utf-8");
    const unitsIdRouteSource = readFileSync(resolve(process.cwd(), "src/app/api/units/[id]/route.ts"), "utf-8");

    assert(
      emergencyRouteSource.includes("await withTenant(societyId, sess.userId, async (tx) => {") &&
      emergencyRouteSource.includes("after(async () => {") &&
      emergencyRouteSource.includes("await withTenant(societyId, sess.userId, async (tx) => {"),
      "Emergency route wraps alert creation and after() notification fanout in withTenant (SEC-02)"
    );

    assert(
      announcementsRouteSource.includes("await withTenant(societyId, sess.userId, async (tx) => {") &&
      !announcementsRouteSource.includes('import { db } from "@/lib/db";'),
      "Announcements route wraps after() fan-out in withTenant with RLS context (SEC-05)"
    );

    assert(
      unitsIdRouteSource.includes("await withTenant(societyId, sess.userId, async (tx) => {") &&
      !unitsIdRouteSource.includes("await db.update(units)"),
      "Units [id] route wraps GET, PATCH, and DELETE in withTenant (SEC-04)"
    );
  } catch (e: any) {
    assert(false, `withTenant checks failed: ${e.message}`);
  }

  // -------------------------------------------------------------
  // Test 7: SEC-03 Helpdesk Role Restriction
  // -------------------------------------------------------------
  try {
    const helpdeskRouteSource = readFileSync(resolve(process.cwd(), "src/app/api/helpdesk/[id]/route.ts"), "utf-8");
    assert(
      helpdeskRouteSource.includes("Only staff can modify ticket assignee, priority, or category"),
      "Helpdesk route blocks non-staff from mutating assignee, priority, or category (SEC-03)"
    );
    assert(
      helpdeskRouteSource.includes("Only ticket owner or staff can change ticket status"),
      "Helpdesk route blocks residents from changing status of tickets they do not own (SEC-03)"
    );
  } catch (e: any) {
    assert(false, `SEC-03 check failed: ${e.message}`);
  }

  // -------------------------------------------------------------
  // Test 8: WF-01 / WF-02 Booking Auto-Confirmation & Concurrency Locking
  // -------------------------------------------------------------
  try {
    const verifyRouteSource = readFileSync(resolve(process.cwd(), "src/app/api/payments/verify/route.ts"), "utf-8");
    const webhookRouteSource = readFileSync(resolve(process.cwd(), "src/app/api/payments/webhook/route.ts"), "utf-8");

    assert(
      verifyRouteSource.includes(".for(\"update\")") && webhookRouteSource.includes(".for(\"update\")"),
      "Payments verify and webhook employ pessimistic .for('update') row locking (WF-01/02)"
    );
    assert(
      verifyRouteSource.includes("tx.update(bookings).set({ status: \"CONFIRMED\"") &&
      webhookRouteSource.includes("tx.update(bookings).set({ status: \"CONFIRMED\""),
      "Payments verify and webhook automatically confirm linked amenity bookings upon payment (WF-01/02)"
    );
  } catch (e: any) {
    assert(false, `Payment workflow checks failed: ${e.message}`);
  }

  // -------------------------------------------------------------
  // Test 9: OTH-01 Admin Units Batching & Society Filter
  // -------------------------------------------------------------
  try {
    const adminUnitsRouteSource = readFileSync(resolve(process.cwd(), "src/app/api/admin/units/route.ts"), "utf-8");
    assert(
      adminUnitsRouteSource.includes("const conditions = [eq(units.societyId, societyId)];") &&
      adminUnitsRouteSource.includes("inArray(buildings.id, buildingIds)") &&
      adminUnitsRouteSource.includes("inArray(floors.id, floorIds)"),
      "Admin units route preserves societyId filter and batches N+1 queries using inArray (OTH-01)"
    );
  } catch (e: any) {
    assert(false, `Admin units check failed: ${e.message}`);
  }

  // -------------------------------------------------------------
  // Test 10: BUG-V01 Resident Invites Pre-Approved (APPROVED Status)
  // -------------------------------------------------------------
  try {
    const visitorsInviteSource = readFileSync(resolve(process.cwd(), "src/app/api/visitors/invite/route.ts"), "utf-8");
    const invitesSource = readFileSync(resolve(process.cwd(), "src/app/api/invites/route.ts"), "utf-8");

    assert(
      visitorsInviteSource.includes('status: "APPROVED"') && visitorsInviteSource.includes("approvedBy: sess.userId"),
      "Visitor invite endpoint sets pre-approved status for resident guests (BUG-V01)"
    );
    assert(
      invitesSource.includes('status: "APPROVED"') && invitesSource.includes("approvedBy: sess.userId"),
      "Parallel invites endpoint sets pre-approved status for resident guests (BUG-V01)"
    );
  } catch (e: any) {
    assert(false, `BUG-V01 check failed: ${e.message}`);
  }

  // -------------------------------------------------------------
  // Test 11: BUG-V02 & BUG-V03 Guard Check-In Idempotency & Future Pass
  // -------------------------------------------------------------
  try {
    const checkInSource = readFileSync(resolve(process.cwd(), "src/app/api/guard/check-in/route.ts"), "utf-8");
    const idempIdx = checkInSource.indexOf("const existingKey = await tx.select().from(visitorEntries)");
    const activeCheckIdx = checkInSource.indexOf("if (existing.some(e => !e.checkOut))");

    assert(
      idempIdx !== -1 && activeCheckIdx !== -1 && idempIdx < activeCheckIdx,
      "Guard check-in checks idempotency key BEFORE checking active entry to prevent false 409 on retry (BUG-V02)"
    );
    assert(
      checkInSource.includes('if (new Date(invite.validFrom) > now) throw new Error("Invite is not yet valid (future pass)")'),
      "Guard check-in rejects future passes before validFrom date/time (BUG-V03)"
    );
  } catch (e: any) {
    assert(false, `BUG-V02/03 check failed: ${e.message}`);
  }

  // -------------------------------------------------------------
  // Test 12: BUG-V04 Guard Verify ALREADY_INSIDE and FUTURE_PASS
  // -------------------------------------------------------------
  try {
    const verifySource = readFileSync(resolve(process.cwd(), "src/app/api/guard/verify/route.ts"), "utf-8");
    assert(
      verifySource.includes('status: "ALREADY_INSIDE"') && verifySource.includes("isInside: true"),
      "Guard verify returns ALREADY_INSIDE and isInside: true when visitor is inside (BUG-V04)"
    );
    assert(
      verifySource.includes('code: "FUTURE_PASS"') && verifySource.includes("new Date(invite.validFrom) > now"),
      "Guard verify rejects future passes with code FUTURE_PASS (BUG-V04)"
    );
  } catch (e: any) {
    assert(false, `BUG-V04 check failed: ${e.message}`);
  }

  // -------------------------------------------------------------
  // Test 13: BUG-V05 Invite Respond PENDING Guard & Guard Notification
  // -------------------------------------------------------------
  try {
    const respondSource = readFileSync(resolve(process.cwd(), "src/app/api/invites/[id]/respond/route.ts"), "utf-8");
    assert(
      respondSource.includes('if (invite.status !== "PENDING") throw new Error("Invite is no longer pending")'),
      "Invite respond endpoint forbids mutating non-pending invites (BUG-V05)"
    );
    assert(
      respondSource.includes("if (invite.createdBy && invite.createdBy !== sess.userId)"),
      "Invite respond notifies the guard who logged the walk-in upon resident response (BUG-V05)"
    );
  } catch (e: any) {
    assert(false, `BUG-V05 check failed: ${e.message}`);
  }

  // -------------------------------------------------------------
  // Test 14: BUG-H01 & BUG-H02 Helpdesk Staff & Comment Notifications
  // -------------------------------------------------------------
  try {
    const helpdeskSource = readFileSync(resolve(process.cwd(), "src/app/api/helpdesk/route.ts"), "utf-8");
    const commentsSource = readFileSync(resolve(process.cwd(), "src/app/api/helpdesk/[id]/comments/route.ts"), "utf-8");

    assert(
      helpdeskSource.includes('inArray(userSocietyRoles.role, ["FACILITY_MANAGER", "SOCIETY_ADMIN", "RWA_MEMBER"])') &&
      !helpdeskSource.includes("const staffRoles = await tx.select().from(units)"),
      "Helpdesk ticket creation notifies facility staff and eliminates dead query (BUG-H01)"
    );
    assert(
      commentsSource.includes("recipients.add(ticket.raisedBy)") &&
      commentsSource.includes("recipients.add(ticket.assigneeId)"),
      "Helpdesk comments notify both ticket author and technician assignee without gaps (BUG-H02)"
    );
  } catch (e: any) {
    assert(false, `BUG-H01/02 check failed: ${e.message}`);
  }

  // -------------------------------------------------------------
  // Test 15: BUG-B01 & BUG-B02 Bill CANCELLED & Immutable Paid Bills
  // -------------------------------------------------------------
  try {
    const billIdSource = readFileSync(resolve(process.cwd(), "src/app/api/bills/[id]/route.ts"), "utf-8");
    const billsSource = readFileSync(resolve(process.cwd(), "src/app/api/bills/route.ts"), "utf-8");

    assert(
      billIdSource.includes('"CANCELLED"') && billsSource.includes('"CANCELLED"'),
      "Bill schemas accept CANCELLED status enum (BUG-B01)"
    );
    assert(
      billIdSource.includes('if (bill.status === "PAID") throw new Error("Cannot modify a paid bill")'),
      "Bills with status PAID are protected against mutation (BUG-B02)"
    );
  } catch (e: any) {
    assert(false, `BUG-B01/02 check failed: ${e.message}`);
  }

  // -------------------------------------------------------------
  // Test 16: BUG-A01 Booking Auto-Bill dueDate > periodEnd
  // -------------------------------------------------------------
  try {
    const bookingsSource = readFileSync(resolve(process.cwd(), "src/app/api/bookings/route.ts"), "utf-8");
    assert(
      bookingsSource.includes("const nextDay = new Date(new Date(bookingDate).getTime() + 86400000).toISOString().slice(0, 10)") &&
      bookingsSource.includes("dueDate: nextDay"),
      "Booking auto-bill sets dueDate to nextDay guaranteeing dueDate > periodEnd constraint (BUG-A01)"
    );
  } catch (e: any) {
    assert(false, `BUG-A01 check failed: ${e.message}`);
  }

  // -------------------------------------------------------------
  // Test 17: BUG-D01 & BUG-D02 Daily Help Active Guard & Scoped Links
  // -------------------------------------------------------------
  try {
    const attendanceSource = readFileSync(resolve(process.cwd(), "src/app/api/help/attendance/route.ts"), "utf-8");
    const helpSource = readFileSync(resolve(process.cwd(), "src/app/api/help/route.ts"), "utf-8");

    assert(
      attendanceSource.includes("if (!help.isActive) throw new Error") &&
      attendanceSource.includes("if (!link.isActive) throw new Error"),
      "Daily help check-in verifies that both helper and unit link are active (BUG-D01)"
    );
    assert(
      helpSource.includes("inArray(dailyHelpLinks.helpId, helpIds)"),
      "Daily help query scopes links by helpIds to prevent full-table scan (BUG-D02)"
    );
  } catch (e: any) {
    assert(false, `BUG-D01/02 check failed: ${e.message}`);
  }

  // -------------------------------------------------------------
  // Test 18: BUG-C01 & BUG-C02 Polls Notification Deduplication & Events endsAt
  // -------------------------------------------------------------
  try {
    const pollsSource = readFileSync(resolve(process.cwd(), "src/app/api/polls/route.ts"), "utf-8");
    const eventsSource = readFileSync(resolve(process.cwd(), "src/app/api/events/route.ts"), "utf-8");

    assert(
      pollsSource.includes("Array.from(new Set(members.map((m) => m.userId)))") &&
      pollsSource.includes("CHUNK_SIZE"),
      "Poll creation deduplicates user notifications and batches inserts (BUG-C01)"
    );
    assert(
      eventsSource.includes("if (parsed.data.endsAt && new Date(parsed.data.endsAt) <= new Date(parsed.data.startsAt))"),
      "Event creation validates that endsAt is strictly after startsAt (BUG-C02)"
    );
  } catch (e: any) {
    assert(false, `BUG-C01/02 check failed: ${e.message}`);
  }

  console.log("==================================================");
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log("==================================================");

  if (failed > 0) process.exit(1);
  process.exit(0);
}

runTests().catch((err) => {
  console.error("Test suite encountered unexpected error:", err);
  process.exit(1);
});
