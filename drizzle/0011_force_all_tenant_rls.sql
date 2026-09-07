-- Final production RLS gate. Keep this list synchronized with tenant-scoped
-- tables in src/lib/db/schema.ts.

DROP POLICY IF EXISTS user_society_roles_tenant_select ON user_society_roles;
DROP POLICY IF EXISTS user_society_roles_tenant_insert ON user_society_roles;
DROP POLICY IF EXISTS user_society_roles_tenant_update ON user_society_roles;
DROP POLICY IF EXISTS user_society_roles_tenant_delete ON user_society_roles;
CREATE POLICY user_society_roles_tenant_select ON user_society_roles
  FOR SELECT USING (society_id = nullif(current_setting('app.society_id', true), '')::uuid);
CREATE POLICY user_society_roles_tenant_insert ON user_society_roles
  FOR INSERT WITH CHECK (society_id = nullif(current_setting('app.society_id', true), '')::uuid);
CREATE POLICY user_society_roles_tenant_update ON user_society_roles
  FOR UPDATE USING (society_id = nullif(current_setting('app.society_id', true), '')::uuid)
  WITH CHECK (society_id = nullif(current_setting('app.society_id', true), '')::uuid);
CREATE POLICY user_society_roles_tenant_delete ON user_society_roles
  FOR DELETE USING (society_id = nullif(current_setting('app.society_id', true), '')::uuid);

ALTER TABLE "user_society_roles" ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
ALTER TABLE "buildings" ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
ALTER TABLE "floors" ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
ALTER TABLE "units" ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
ALTER TABLE "unit_members" ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
ALTER TABLE "gates" ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
ALTER TABLE "visitors" ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
ALTER TABLE "visitor_invites" ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
ALTER TABLE "visitor_entries" ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
ALTER TABLE "vehicle_entries" ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
ALTER TABLE "deliveries" ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
ALTER TABLE "daily_help" ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
ALTER TABLE "daily_help_links" ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
ALTER TABLE "daily_help_attendance" ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
ALTER TABLE "vehicles" ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
ALTER TABLE "parking_slots" ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
ALTER TABLE "amenities" ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
ALTER TABLE "amenity_slots" ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
ALTER TABLE "bookings" ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
ALTER TABLE "bills" ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
ALTER TABLE "helpdesk_tickets" ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
ALTER TABLE "announcements" ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
ALTER TABLE "polls" ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
ALTER TABLE "poll_votes" ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
ALTER TABLE "events" ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
ALTER TABLE "emergency_alerts" ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
ALTER TABLE "poll_options" ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
ALTER TABLE "ticket_comments" ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
ALTER TABLE "bill_items" ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;

-- vehicle_entries was omitted from the original policy migration. Add the
-- missing four-operation policy before forcing RLS on the table.
ALTER TABLE "vehicle_entries" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS vehicle_entries_tenant_select ON vehicle_entries;
DROP POLICY IF EXISTS vehicle_entries_tenant_insert ON vehicle_entries;
DROP POLICY IF EXISTS vehicle_entries_tenant_update ON vehicle_entries;
DROP POLICY IF EXISTS vehicle_entries_tenant_delete ON vehicle_entries;
CREATE POLICY vehicle_entries_tenant_select ON vehicle_entries
  FOR SELECT USING (society_id = nullif(current_setting('app.society_id', true), '')::uuid);
CREATE POLICY vehicle_entries_tenant_insert ON vehicle_entries
  FOR INSERT WITH CHECK (society_id = nullif(current_setting('app.society_id', true), '')::uuid);
CREATE POLICY vehicle_entries_tenant_update ON vehicle_entries
  FOR UPDATE USING (society_id = nullif(current_setting('app.society_id', true), '')::uuid)
  WITH CHECK (society_id = nullif(current_setting('app.society_id', true), '')::uuid);
CREATE POLICY vehicle_entries_tenant_delete ON vehicle_entries
  FOR DELETE USING (society_id = nullif(current_setting('app.society_id', true), '')::uuid);
ALTER TABLE "vehicle_entries" FORCE ROW LEVEL SECURITY;