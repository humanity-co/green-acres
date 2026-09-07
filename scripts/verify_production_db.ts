import { Pool } from "pg";
import { readFileSync } from "fs";
import { resolve } from "path";

try {
  const envContent = readFileSync(resolve(process.cwd(), ".env"), "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const index = trimmed.indexOf("=");
      const key = trimmed.slice(0, index).trim();
      const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
      if (key && !process.env[key]) process.env[key] = value;
    }
  }
} catch {
  // Deployment environments provide variables directly.
}

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const tenantTables = [
  "user_society_roles", "buildings", "floors", "units", "unit_members", "gates",
  "visitors", "visitor_invites", "visitor_entries", "vehicle_entries", "deliveries",
  "daily_help", "daily_help_links", "daily_help_attendance", "vehicles", "parking_slots",
  "amenities", "amenity_slots", "bookings", "bills", "payments", "helpdesk_tickets",
  "announcements", "polls", "poll_votes", "events", "notifications", "emergency_alerts",
  "poll_options", "ticket_comments", "bill_items",
];

async function run() {
  const ownerPool = new Pool({ connectionString: requireEnv("DATABASE_URL") });
  const appPool = new Pool({ connectionString: requireEnv("APP_DATABASE_URL") });

  try {
    const role = await appPool.query(`
      SELECT current_user, r.rolbypassrls, r.rolsuper,
             has_table_privilege(current_user, 'audit_logs', 'UPDATE') AS can_update_audit
      FROM pg_roles r
      WHERE r.rolname = current_user
    `);
    const appRole = role.rows[0];
    if (!appRole || appRole.rolbypassrls || appRole.rolsuper || appRole.can_update_audit) {
      throw new Error("Runtime role is not a restricted NOBYPASSRLS role with immutable audit logs");
    }

    const tableState = await ownerPool.query(`
      SELECT c.relname AS table_name, c.relrowsecurity, c.relforcerowsecurity,
             COALESCE(array_agg(DISTINCT p.cmd) FILTER (WHERE p.cmd IS NOT NULL), ARRAY[]::text[]) AS commands
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      LEFT JOIN pg_policies p ON p.tablename = c.relname AND p.schemaname = 'public'
      WHERE n.nspname = 'public' AND c.relname = ANY($1::text[])
      GROUP BY c.relname, c.relrowsecurity, c.relforcerowsecurity
      ORDER BY c.relname
    `, [tenantTables]);

    for (const table of tenantTables) {
      const state = tableState.rows.find((row) => row.table_name === table);
      if (!state) throw new Error(`Missing tenant table: ${table}`);
      if (!state.relrowsecurity || !state.relforcerowsecurity) {
        throw new Error(`RLS is not enabled and forced on ${table}`);
      }
      const commands = new Set(state.commands);
      if (!(commands.has("SELECT") || commands.has("ALL")) || !(commands.has("INSERT") || commands.has("ALL")) || !(commands.has("UPDATE") || commands.has("ALL")) || !(commands.has("DELETE") || commands.has("ALL"))) {
        throw new Error(`Missing SELECT/INSERT/UPDATE/DELETE policy on ${table}`);
      }
    }

    const noContext = await appPool.query("SELECT count(*)::int AS count FROM units");
    if (noContext.rows[0].count !== 0) throw new Error("Runtime role can read tenant rows without context");

    const societies = await ownerPool.query(`
      SELECT s.id, u.id AS unit_id, u.building_id, u.floor_id
      FROM societies s
      JOIN units u ON u.society_id = s.id
      ORDER BY s.id, u.id
      LIMIT 2
    `);
    if (societies.rows.length >= 2) {
      const client = await appPool.connect();
      try {
        for (const [source, target] of [[societies.rows[0], societies.rows[1]], [societies.rows[1], societies.rows[0]]]) {
          await client.query("BEGIN");
          await client.query("SELECT set_config('app.society_id', $1, true)", [source.id]);
          const crossTenant = await client.query("SELECT count(*)::int AS count FROM units WHERE society_id = $1", [target.id]);
          if (crossTenant.rows[0].count !== 0) throw new Error(`Runtime role can read society ${target.id} from society ${source.id}`);

          await client.query("SAVEPOINT cross_tenant_insert");
          try {
            await client.query(
              "INSERT INTO units (society_id, building_id, floor_id, number, type, area_sqft) VALUES ($1, $2, $3, $4, 'FLAT', 1000)",
              [target.id, target.building_id, target.floor_id, `PROBE-${source.id.slice(0, 8)}`],
            );
            throw new Error(`Runtime role inserted into society ${target.id} from society ${source.id}`);
          } catch (error) {
            if (error instanceof Error && error.message.startsWith("Runtime role inserted")) throw error;
            await client.query("ROLLBACK TO SAVEPOINT cross_tenant_insert");
          }

          const updated = await client.query("UPDATE units SET number = 'PROBE-UPDATE' WHERE id = $1 AND society_id = $2 RETURNING id", [target.unit_id, target.id]);
          if (updated.rowCount !== 0) throw new Error(`Runtime role updated society ${target.id} from society ${source.id}`);
          const deleted = await client.query("DELETE FROM units WHERE id = $1 AND society_id = $2 RETURNING id", [target.unit_id, target.id]);
          if (deleted.rowCount !== 0) throw new Error(`Runtime role deleted from society ${target.id} from society ${source.id}`);
          await client.query("ROLLBACK");
        }
      } finally {
        client.release();
      }
    } else {
      console.warn("Only one society exists; cross-tenant read test was not run.");
    }

    console.log(`Production database verification passed for ${tenantTables.length} tenant tables.`);
  } finally {
    await ownerPool.end();
    await appPool.end();
  }
}

run().catch((error) => {
  console.error(`Production database verification failed: ${error.message}`);
  process.exit(1);
});
