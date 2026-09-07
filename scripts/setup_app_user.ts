import { readFileSync } from "fs";
import { resolve } from "path";
import { Pool } from "pg";

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
  const migrationUrl = process.env.DATABASE_URL;
  const appUrl = process.env.APP_DATABASE_URL;
  if (!migrationUrl) throw new Error("DATABASE_URL is required for trusted database setup");
  if (!appUrl) throw new Error("APP_DATABASE_URL is required and must use the restricted app_user role");
  const ownerPool = new Pool({ connectionString: migrationUrl });
  const ownerClient = await ownerPool.connect();
  const sql = async (text: string, values: unknown[] = []) => ownerClient.query(text, values);
  console.log("Checking pg_roles for app_user...");
  const roles = await sql(`
    SELECT rolname, rolbypassrls, rolcanlogin 
    FROM pg_roles 
    WHERE rolname IN ('neondb_owner', 'app_user');
  `);
  console.log("Current roles:", roles.rows.map((role) => ({ rolname: role.rolname, rolbypassrls: role.rolbypassrls, rolcanlogin: role.rolcanlogin })));

  const appDatabasePassword = process.env.APP_DATABASE_PASSWORD;
  if (!appDatabasePassword) {
    throw new Error("APP_DATABASE_PASSWORD must be provided through the environment; refusing to set a database credential from source code.");
  }
  console.log("Setting the configured password on app_user and testing connection...");
  const quotedPassword = await sql("SELECT quote_literal($1) AS value", [appDatabasePassword]);
  await sql(`
    DO $setup$
    BEGIN
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
        CREATE ROLE app_user LOGIN NOINHERIT NOCREATEDB NOCREATEROLE NOBYPASSRLS;
      END IF;
    END
    $setup$;
    ALTER ROLE app_user WITH LOGIN NOINHERIT NOCREATEDB NOCREATEROLE NOBYPASSRLS;
    ALTER ROLE app_user WITH PASSWORD ${quotedPassword.rows[0].value};
    GRANT CONNECT ON DATABASE neondb TO app_user;
    GRANT USAGE ON SCHEMA public TO app_user;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_user;
    REVOKE UPDATE, DELETE ON audit_logs FROM app_user;
  `);
  ownerClient.release();
  await ownerPool.end();

  console.log("Testing app_user connection...");
  const appPool = new Pool({
    connectionString: appUrl,
  });
  const client = await appPool.connect();
  const testRes = await client.query(`
    SELECT current_user, current_setting('is_superuser', true) AS is_superuser,
           r.rolbypassrls, has_table_privilege(current_user, 'audit_logs', 'UPDATE') AS can_update_audit
    FROM pg_roles r
    WHERE r.rolname = current_user
  `);
  console.log("app_user connected successfully:", testRes.rows);
  const role = testRes.rows[0];
  if (!role || role.rolbypassrls || role.is_superuser === "on" || role.can_update_audit) {
    throw new Error("Application role verification failed: expected non-superuser NOBYPASSRLS role with immutable audit logs");
  }
  client.release();
  await appPool.end();
  process.exit(0);
}

run().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
