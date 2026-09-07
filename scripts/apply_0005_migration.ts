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

  console.log("Applying Phase B schema enhancements with active DB credentials...");

  await ownerDb.execute(sql`
    CREATE TABLE IF NOT EXISTS vehicle_entries (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      society_id uuid NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
      vehicle_id uuid REFERENCES vehicles(id),
      unit_id uuid REFERENCES units(id),
      gate_id uuid REFERENCES gates(id),
      guard_id uuid REFERENCES users(id),
      number_plate varchar(20) NOT NULL,
      is_visitor boolean DEFAULT false NOT NULL,
      check_in timestamp DEFAULT now() NOT NULL,
      check_out timestamp,
      notes text,
      created_at timestamp DEFAULT now() NOT NULL
    );
  `);
  console.log("✓ vehicle_entries table created/verified");

  await ownerDb.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'poll_votes' AND column_name = 'society_id'
      ) THEN
        ALTER TABLE poll_votes ADD COLUMN society_id uuid;
        UPDATE poll_votes pv SET society_id = p.society_id FROM polls p WHERE pv.poll_id = p.id;
        ALTER TABLE poll_votes ALTER COLUMN society_id SET NOT NULL;
        ALTER TABLE poll_votes ADD CONSTRAINT poll_votes_society_id_societies_id_fk FOREIGN KEY (society_id) REFERENCES societies(id) ON DELETE CASCADE;
      END IF;
    END $$;
  `);
  console.log("✓ poll_votes society_id column and foreign key verified");

  await ownerDb.execute(sql`
    CREATE INDEX IF NOT EXISTS veh_entries_society_idx ON vehicle_entries USING btree (society_id);
    CREATE INDEX IF NOT EXISTS veh_entries_inside_idx ON vehicle_entries USING btree (society_id, check_out, created_at);
    CREATE INDEX IF NOT EXISTS deliveries_pending_idx ON deliveries USING btree (society_id, status, unit_id);
    CREATE INDEX IF NOT EXISTS poll_votes_society_idx ON poll_votes USING btree (society_id);
    CREATE INDEX IF NOT EXISTS entries_inside_idx ON visitor_entries USING btree (society_id, check_out, created_at);
  `);
  console.log("✓ Performance composite indexes created");

  console.log("All Phase B database updates successfully applied!");
  process.exit(0);
}

run().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
