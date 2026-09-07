import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
export async function withTenant<T>(societyId: string, userId: string, fn: (tx: typeof db) => Promise<T>): Promise<T> {
  return await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.society_id', ${societyId}, true), set_config('app.user_id', ${userId}, true)`);
    return await fn(tx as any);
  });
}
