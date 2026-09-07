import { db } from "../src/lib/db";
import { visitorInvites, visitorEntries } from "../src/lib/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  const future = new Date(Date.now() + 7 * 24 * 3600 * 1000);
  const [upd] = await db
    .update(visitorInvites)
    .set({ validTo: future, status: "APPROVED" })
    .where(eq(visitorInvites.code, "GA1234"))
    .returning();

  if (upd) {
    console.log("RENEWED_GA1234_SUCCESS:", upd.code, upd.status, upd.validTo.toISOString());
    await db.delete(visitorEntries).where(eq(visitorEntries.inviteId, upd.id));
    console.log("CLEARED_ENTRIES_SUCCESS");
  } else {
    console.log("GA1234_NOT_FOUND");
  }
  process.exit(0);
}

main().catch((e) => {
  console.error("RENEW_FAILED:", e);
  process.exit(1);
});
