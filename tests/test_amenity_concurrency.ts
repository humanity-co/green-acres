import { db } from "../src/lib/db";
import { sql } from "drizzle-orm";

async function main() {
  const indexes = await db.execute(sql`SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'bookings'`);
  console.log("Bookings indexes:", indexes.rows);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
