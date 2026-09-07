import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./db/schema";

const runtimeUrl = process.env.APP_DATABASE_URL || process.env.DATABASE_URL;
if (!runtimeUrl && process.env.NODE_ENV !== "test") {
  console.warn("[WARN] Neither APP_DATABASE_URL nor DATABASE_URL is set in environment.");
}

const pool = new Pool({
  connectionString: runtimeUrl || undefined,
});
const ownerPool = new Pool({
  connectionString: process.env.DATABASE_URL || runtimeUrl || undefined,
});
export const db = drizzle(pool, { schema });
export const ownerDb = drizzle(ownerPool, { schema });
export { pool, ownerPool };
