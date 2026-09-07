import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { sql } from "drizzle-orm";
import * as schema from "./db/schema";

const runtimeUrl = process.env.APP_DATABASE_URL;
if (!runtimeUrl && process.env.NODE_ENV !== "test") {
  throw new Error("APP_DATABASE_URL is required for application runtime; DATABASE_URL is reserved for migrations and trusted tasks.");
}

const pool = new Pool({
  connectionString: runtimeUrl || undefined,
});
const ownerPool = new Pool({
  connectionString: process.env.DATABASE_URL || undefined,
});
export const db = drizzle(pool, { schema });
export const ownerDb = drizzle(ownerPool, { schema });
export { pool, ownerPool };

let runtimeRoleCheck: Promise<void> | undefined;

export function assertRuntimeDatabaseRole() {
  if (process.env.NODE_ENV === "test") return Promise.resolve();
  runtimeRoleCheck ??= (async () => {
    const result = await db.execute(sql`SELECT current_user, rolbypassrls FROM pg_roles WHERE rolname = current_user`);
    const role = result.rows[0] as { current_user?: string; rolbypassrls?: boolean } | undefined;
    if (!role || role.rolbypassrls === true) {
      throw new Error("Application database role must exist and have NOBYPASSRLS");
    }
  })();
  return runtimeRoleCheck;
}
