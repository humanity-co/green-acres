import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env variables into process.env manually without external package
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
} catch (e) {
  console.warn("Could not read .env file:", e);
}

async function run() {
  const { ownerDb } = await import("../src/lib/db");
  const { sql } = await import("drizzle-orm");

  console.log("Applying P0 Database RLS and Schema fixes...");

  // 1. Enable RLS on vehicle_entries
  console.log("1. Enabling Row Level Security on vehicle_entries...");
  await ownerDb.execute(sql`
    ALTER TABLE IF EXISTS vehicle_entries ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS vehicle_entries FORCE ROW LEVEL SECURITY;
  `);

  // 2. Apply RLS policies to vehicle_entries
  console.log("2. Applying RLS tenant policies to vehicle_entries...");
  await ownerDb.execute(sql`
    DROP POLICY IF EXISTS "vehicle_entries_tenant_select" ON vehicle_entries;
    CREATE POLICY "vehicle_entries_tenant_select" ON vehicle_entries
      FOR SELECT USING (society_id = nullif(current_setting('app.society_id', true), '')::uuid);

    DROP POLICY IF EXISTS "vehicle_entries_tenant_insert" ON vehicle_entries;
    CREATE POLICY "vehicle_entries_tenant_insert" ON vehicle_entries
      FOR INSERT WITH CHECK (society_id = nullif(current_setting('app.society_id', true), '')::uuid);

    DROP POLICY IF EXISTS "vehicle_entries_tenant_update" ON vehicle_entries;
    CREATE POLICY "vehicle_entries_tenant_update" ON vehicle_entries
      FOR UPDATE USING (society_id = nullif(current_setting('app.society_id', true), '')::uuid);

    DROP POLICY IF EXISTS "vehicle_entries_tenant_delete" ON vehicle_entries;
    CREATE POLICY "vehicle_entries_tenant_delete" ON vehicle_entries
      FOR DELETE USING (society_id = nullif(current_setting('app.society_id', true), '')::uuid);
  `);

  // 3. Grant table permissions to app_user
  console.log("3. Granting table permissions on vehicle_entries to app_user...");
  await ownerDb.execute(sql`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
        GRANT SELECT, INSERT, UPDATE, DELETE ON vehicle_entries TO app_user;
        GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
      END IF;
    END $$;
  `);

  // 4. Add 'CANCELLED' to ticket_status and bill_status enum if missing
  console.log("4. Adding 'CANCELLED' to ticket_status and bill_status enum if missing...");
  await ownerDb.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'ticket_status' AND e.enumlabel = 'CANCELLED'
      ) THEN
        ALTER TYPE ticket_status ADD VALUE 'CANCELLED';
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'bill_status' AND e.enumlabel = 'CANCELLED'
      ) THEN
        ALTER TYPE bill_status ADD VALUE 'CANCELLED';
      END IF;
    END $$;

    ALTER TABLE bookings ADD COLUMN IF NOT EXISTS bill_id uuid REFERENCES bills(id);
  `);

  // 5. Drop dead table test_votes
  console.log("5. Dropping orphaned test_votes table if present...");
  await ownerDb.execute(sql`
    DROP TABLE IF EXISTS test_votes;
  `);

  // 6. Verify catalog state
  console.log("6. Verifying pg_class and pg_policies...");
  const classRes: any = await ownerDb.execute(sql`
    SELECT relname, relrowsecurity, relforcerowsecurity
    FROM pg_class
    WHERE relname = 'vehicle_entries';
  `);
  console.log("vehicle_entries class info:", classRes.rows || classRes);

  const policyRes: any = await ownerDb.execute(sql`
    SELECT policyname, cmd
    FROM pg_policies
    WHERE tablename = 'vehicle_entries';
  `);
  console.log("vehicle_entries policies:", policyRes.rows || policyRes);

  const enumRes: any = await ownerDb.execute(sql`
    SELECT enumlabel
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'ticket_status'
    ORDER BY enumsortorder;
  `);
  console.log("ticket_status enum values:", (enumRes.rows || enumRes).map((r: any) => r.enumlabel));

  console.log("Phase 1 database migration completed successfully!");
  process.exit(0);
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
