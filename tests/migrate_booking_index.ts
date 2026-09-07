import { ownerDb } from "../src/lib/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Updating bookings_user_slot_date_unique to partial unique index...");
  await ownerDb.execute(sql`DROP INDEX IF EXISTS bookings_user_slot_date_unique`);
  await ownerDb.execute(sql`CREATE UNIQUE INDEX bookings_user_slot_date_unique ON bookings (user_id, amenity_id, booking_date, slot_id) WHERE status != 'CANCELLED'`);
  console.log("Successfully updated index to partial unique index!");
  
  const indexes = await ownerDb.execute(sql`SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'bookings' AND indexname = 'bookings_user_slot_date_unique'`);
  console.log("Updated index def:", indexes.rows[0]);
  process.exit(0);
}

main().catch(err => {
  console.error("Index migration failed:", err);
  process.exit(1);
});
