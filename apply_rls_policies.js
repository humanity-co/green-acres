const { Pool } = require('pg');
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function createPolicies() {
  // Define all policies per the migration file convention
  // Format: <tablename>_tenant_select/insert/update/delete
  const tables = ['amenities', 'amenity_slots', 'announcements', 'bills', 'bookings', 
    'buildings', 'daily_help', 'daily_help_attendance', 'daily_help_links', 
    'deliveries', 'emergency_alerts', 'events', 'floors', 'gates', 
    'helpdesk_tickets', 'notifications', 'parking_slots', 'payments', 
    'polls', 'unit_members', 'units', 'user_society_roles', 'vehicles', 
    'visitor_entries', 'visitor_invites', 'visitors'];
  
  const expression = "society_id = nullif(current_setting('app.society_id', true), '')::uuid";
  
  for (const t of tables) {
    // SELECT policy
    await pool.query("CREATE POLICY \"" + t + "_tenant_select\" ON \"" + t + "\" FOR SELECT USING (" + expression + ");");
    // INSERT policy
    await pool.query("CREATE POLICY \"" + t + "_tenant_insert\" ON \"" + t + "\" FOR INSERT WITH CHECK (" + expression + ");");
    // UPDATE policy
    await pool.query("CREATE POLICY \"" + t + "_tenant_update\" ON \"" + t + "\" FOR UPDATE USING (" + expression + ");");
    // DELETE policy
    await pool.query("CREATE POLICY \"" + t + "_tenant_delete\" ON \"" + t + "\" FOR DELETE USING (" + expression + ");");
    console.log('Created 4 policies on', t);
  }
  
  // Now create relationship-based policies for tables without direct society_id
  // poll_votes → poll → society_id
  await pool.query("CREATE POLICY \"poll_votes_tenant_select\" ON \"poll_votes\" FOR SELECT USING (\n    EXISTS (\n      SELECT 1 FROM polls WHERE polls.id = poll_votes.poll_id\n      AND polls.society_id = nullif(current_setting('app.society_id', true), '')::uuid\n    )\n  );");
  console.log('Created poll_votes_tenant_select');
  
  // ticket_comments → helpdesk_tickets → society_id
  await pool.query("CREATE POLICY \"ticket_comments_tenant_select\" ON \"ticket_comments\" FOR SELECT USING (\n    EXISTS (\n      SELECT 1 FROM helpdesk_tickets WHERE helpdesk_tickets.id = ticket_comments.ticket_id\n      AND helpdesk_tickets.society_id = nullif(current_setting('app.society_id', true), '')::uuid\n    )\n  );");
  console.log('Created ticket_comments_tenant_select');
  
  // poll_options → poll → society_id
  await pool.query("CREATE POLICY \"poll_options_tenant_select\" ON \"poll_options\" FOR SELECT USING (\n    EXISTS (\n      SELECT 1 FROM polls WHERE polls.id = poll_options.poll_id\n      AND polls.society_id = nullif(current_setting('app.society_id', true), '')::uuid\n    )\n  );");
  console.log('Created poll_options_tenant_select');
  
  // bill_items → bills → society_id
  await pool.query("CREATE POLICY \"bill_items_tenant_select\" ON \"bill_items\" FOR SELECT USING (\n    EXISTS (\n      SELECT 1 FROM bills WHERE bills.id = bill_items.bill_id\n      AND bills.society_id = nullif(current_setting('app.society_id', true), '')::uuid\n    )\n  );");
  console.log('Created bill_items_tenant_select');
  
  await pool.end();
  console.log('\nAll RLS policies applied successfully!');
}

createPolicies().catch(e => console.error('Error:', e));