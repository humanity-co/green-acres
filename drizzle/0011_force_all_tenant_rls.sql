-- Final production RLS gate. Keep this list synchronized with tenant-scoped
-- tables in src/lib/db/schema.ts.

ALTER TABLE "user_society_roles" FORCE ROW LEVEL SECURITY;
ALTER TABLE "buildings" FORCE ROW LEVEL SECURITY;
ALTER TABLE "floors" FORCE ROW LEVEL SECURITY;
ALTER TABLE "units" FORCE ROW LEVEL SECURITY;
ALTER TABLE "unit_members" FORCE ROW LEVEL SECURITY;
ALTER TABLE "gates" FORCE ROW LEVEL SECURITY;
ALTER TABLE "visitors" FORCE ROW LEVEL SECURITY;
ALTER TABLE "visitor_invites" FORCE ROW LEVEL SECURITY;
ALTER TABLE "visitor_entries" FORCE ROW LEVEL SECURITY;
ALTER TABLE "vehicle_entries" FORCE ROW LEVEL SECURITY;
ALTER TABLE "deliveries" FORCE ROW LEVEL SECURITY;
ALTER TABLE "daily_help" FORCE ROW LEVEL SECURITY;
ALTER TABLE "daily_help_links" FORCE ROW LEVEL SECURITY;
ALTER TABLE "daily_help_attendance" FORCE ROW LEVEL SECURITY;
ALTER TABLE "vehicles" FORCE ROW LEVEL SECURITY;
ALTER TABLE "parking_slots" FORCE ROW LEVEL SECURITY;
ALTER TABLE "amenities" FORCE ROW LEVEL SECURITY;
ALTER TABLE "amenity_slots" FORCE ROW LEVEL SECURITY;
ALTER TABLE "bookings" FORCE ROW LEVEL SECURITY;
ALTER TABLE "bills" FORCE ROW LEVEL SECURITY;
ALTER TABLE "payments" FORCE ROW LEVEL SECURITY;
ALTER TABLE "helpdesk_tickets" FORCE ROW LEVEL SECURITY;
ALTER TABLE "announcements" FORCE ROW LEVEL SECURITY;
ALTER TABLE "polls" FORCE ROW LEVEL SECURITY;
ALTER TABLE "poll_votes" FORCE ROW LEVEL SECURITY;
ALTER TABLE "events" FORCE ROW LEVEL SECURITY;
ALTER TABLE "notifications" FORCE ROW LEVEL SECURITY;
ALTER TABLE "emergency_alerts" FORCE ROW LEVEL SECURITY;
ALTER TABLE "poll_options" FORCE ROW LEVEL SECURITY;
ALTER TABLE "ticket_comments" FORCE ROW LEVEL SECURITY;
ALTER TABLE "bill_items" FORCE ROW LEVEL SECURITY;

-- vehicle_entries was omitted from the original policy migration. Add the
-- missing four-operation policy before forcing RLS on the table.
ALTER TABLE "vehicle_entries" ENABLE ROW LEVEL SECURITY;
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