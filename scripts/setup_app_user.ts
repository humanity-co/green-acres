import { readFileSync } from "fs";
import { resolve } from "path";

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
  console.log("Checking pg_roles for app_user...");
  const roles = await ownerDb.execute(sql`
    SELECT rolname, rolbypassrls, rolcanlogin 
    FROM pg_roles 
    WHERE rolname IN ('neondb_owner', 'app_user');
  `);
  console.log("Current roles:", roles.rows);

  console.log("Setting known password on app_user and testing connection...");
  await ownerDb.execute(sql`
    ALTER ROLE app_user WITH PASSWORD 'SocietyOS_Secure_AppUser_2026!' NOBYPASSRLS;
    GRANT CONNECT ON DATABASE neondb TO app_user;
    GRANT USAGE ON SCHEMA public TO app_user;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
    REVOKE UPDATE, DELETE ON audit_logs FROM app_user;
  `);

  console.log("Testing app_user connection...");
  const { Pool } = await import("pg");
  const appPool = new Pool({
    connectionString: process.env.APP_DATABASE_URL,
  });
  const client = await appPool.connect();
  const testRes = await client.query("SELECT current_user, current_setting('is_superuser', true)");
  console.log("app_user connected successfully:", testRes.rows);
  client.release();
  await appPool.end();
  process.exit(0);
}

run().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
