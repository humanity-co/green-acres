import { Pool } from "pg";

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

    const societies = await ownerPool.query("SELECT id FROM societies ORDER BY id LIMIT 2");
    if (societies.rows.length >= 2) {
      const client = await appPool.connect();
      try {
        await client.query("BEGIN");
        await client.query("SELECT set_config('app.society_id', $1, true)", [societies.rows[0].id]);
        const crossTenant = await client.query("SELECT count(*)::int AS count FROM units WHERE society_id = $1", [societies.rows[1].id]);
        if (crossTenant.rows[0].count !== 0) throw new Error("Runtime role can read another society");
        await client.query("ROLLBACK");
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
