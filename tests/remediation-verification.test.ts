import { readFileSync } from "fs";
import { resolve } from "path";

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
  console.log("   RUNNING SOCIETY OS AUDIT REMEDIATION SUITE     ");
  console.log("==================================================");

  // Test 1: RLS on vehicle_entries table
  try {
    const { ownerDb } = await import("../src/lib/db");
    const { sql } = await import("drizzle-orm");
    const rlsCheck = await ownerDb.execute(sql`
      SELECT relname, relrowsecurity, relforcerowsecurity 
      FROM pg_class 
      WHERE relname = 'vehicle_entries';
    `);
    const isRls = rlsCheck.rows[0]?.relrowsecurity === true && rlsCheck.rows[0]?.relforcerowsecurity === true;
    assert(isRls, "PostgreSQL enforces FORCE ROW LEVEL SECURITY on vehicle_entries");
  } catch (e: any) {
    assert(false, `vehicle_entries RLS check failed: ${e.message}`);
  }

  // Test 2: CANCELLED enum values present in database
  try {
    const { ownerDb } = await import("../src/lib/db");
    const { sql } = await import("drizzle-orm");
    const enumCheck = await ownerDb.execute(sql`
      SELECT t.typname, e.enumlabel
      FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname IN ('ticket_status', 'bill_status') AND e.enumlabel = 'CANCELLED';
    `);
    assert(enumCheck.rows.length === 2, "'CANCELLED' enum values exist in PostgreSQL for ticket_status and bill_status");
  } catch (e: any) {
    assert(false, `Enum check failed: ${e.message}`);
  }

  // Test 3: app_user role has NOBYPASSRLS and connects
  try {
    const { ownerDb } = await import("../src/lib/db");
    const { sql } = await import("drizzle-orm");
    const roleCheck = await ownerDb.execute(sql`
      SELECT rolname, rolbypassrls FROM pg_roles WHERE rolname = 'app_user';
    `);
    const appUserRole = roleCheck.rows[0];
    assert(appUserRole && appUserRole.rolbypassrls === false, "app_user role has rolbypassrls = false");
  } catch (e: any) {
    assert(false, `Role check failed: ${e.message}`);
  }

  // Test 4: Payment Provider signature verification
  try {
    const { getPaymentProvider } = await import("../src/lib/payments/provider");
    const provider = getPaymentProvider();
    const isValid = provider.verifySignature({
      orderId: "order_123",
      paymentId: "pay_123",
      signature: "mock_signature",
    });
    assert(isValid, "Mock payment provider verifies mock_signature in development mode");
  } catch (e: any) {
    assert(false, `Payment signature check failed: ${e.message}`);
  }

  // Test 5: Domestic help phone privacy masking
  try {
    const { maskPhone } = await import("../src/lib/privacy");
    const raw = "+919876543210";
    const masked = maskPhone(raw);
    assert(masked !== raw && masked.includes("*") && masked.slice(-4) === "3210", "Phone masking protects privacy: +919876543210 -> " + masked);
  } catch (e: any) {
    assert(false, `Phone privacy check failed: ${e.message}`);
  }

  // Test 6: Twilio provider throws explicit credential error when unconfigured
  try {
    const { twilioProvider } = await import("../src/lib/otp/provider");
    let threw = false;
    try {
      await twilioProvider.request("+919876543210", "123456");
    } catch (err: any) {
      threw = err.message.includes("Twilio SMS credentials missing");
    }
    assert(threw, "Twilio OTP provider throws explicit credential error when unconfigured");
  } catch (e: any) {
    assert(false, `Twilio check failed: ${e.message}`);
  }

  // Test 7: Multi-role navigation resolution
  try {
    const { getNavForRoles } = await import("../src/lib/navigation");
    const residentNav = getNavForRoles(["RESIDENT"]);
    const guardNav = getNavForRoles(["GUARD"]);
    const adminNav = getNavForRoles(["SOCIETY_ADMIN"]);
    const switchedNav = getNavForRoles(["SOCIETY_ADMIN", "RESIDENT"], "RESIDENT");

    assert(residentNav.length > 0, "Resident navigation generates successfully");
    assert(guardNav.length > 0, "Guard navigation generates successfully");
    assert(adminNav.length > 0, "Admin navigation generates successfully");
    assert(
      switchedNav[0].title !== adminNav[0].title || switchedNav.length !== adminNav.length,
      "Dual-role navigation view switcher toggles to Resident portal when activeMode='RESIDENT'"
    );
  } catch (e: any) {
    assert(false, `Navigation check failed: ${e.message}`);
  }

  console.log("==================================================");
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log("==================================================");

  if (failed > 0) process.exit(1);
  process.exit(0);
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
