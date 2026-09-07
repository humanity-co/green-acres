import { ownerDb } from "../src/lib/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Upgrading bill_items RLS policy to FOR ALL (SELECT, INSERT, UPDATE, DELETE)...");
  await ownerDb.execute(sql`
    DROP POLICY IF EXISTS bill_items_tenant_select ON bill_items;
    DROP POLICY IF EXISTS bill_items_tenant_all ON bill_items;
    CREATE POLICY bill_items_tenant_all ON bill_items
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM bills WHERE bills.id = bill_items.bill_id
          AND bills.society_id = nullif(current_setting('app.society_id', true), '')::uuid
        )
      ) WITH CHECK (
        EXISTS (
          SELECT 1 FROM bills WHERE bills.id = bill_items.bill_id
          AND bills.society_id = nullif(current_setting('app.society_id', true), '')::uuid
        )
      );
  `);
  console.log("Successfully upgraded bill_items RLS policy!");
  process.exit(0);
}

main().catch(err => {
  console.error("Migration error:", err);
  process.exit(1);
});
