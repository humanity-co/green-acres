-- R3 P0-04: PostgreSQL Row Level Security Tenant-Isolation Remediation
-- Adds RLS policies as defense-in-depth alongside application-level tenant filtering
-- via withTenant() → SET LOCAL app.society_id (transaction-scoped)
--
-- Policy expression: society_id = nullif(current_setting('app.society_id', true), '')::uuid
-- - When app.society_id is set → filters rows to matching society
-- - When app.society_id is NOT set → returns 0 rows (fail-closed)
-- - When app.society_id is '' → treated as no context → 0 rows

-- ---------------------------------------------------------
-- 1. Tables with direct society_id column
--    (25 tables: every row is explicitly scoped to a society)
-- ---------------------------------------------------------

-- amenities
ALTER TABLE amenities ENABLE ROW LEVEL SECURITY;
CREATE POLICY amenities_tenant_select ON amenities
  FOR SELECT USING ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );
CREATE POLICY amenities_tenant_insert ON amenities
  FOR INSERT WITH CHECK ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );
CREATE POLICY amenities_tenant_update ON amenities
  FOR UPDATE USING ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );
CREATE POLICY amenities_tenant_delete ON amenities
  FOR DELETE USING ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );

-- amenity_slots
ALTER TABLE amenity_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY amenity_slots_tenant_select ON amenity_slots
  FOR SELECT USING ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );
CREATE POLICY amenity_slots_tenant_insert ON amenity_slots
  FOR INSERT WITH CHECK ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );
CREATE POLICY amenity_slots_tenant_update ON amenity_slots
  FOR UPDATE USING ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );
CREATE POLICY amenity_slots_tenant_delete ON amenity_slots
  FOR DELETE USING ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );

-- announcements
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY announcements_tenant_select ON announcements
  FOR SELECT USING ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );
CREATE POLICY announcements_tenant_insert ON announcements
  FOR INSERT WITH CHECK ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );
CREATE POLICY announcements_tenant_update ON announcements
  FOR UPDATE USING ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );
CREATE POLICY announcements_tenant_delete ON announcements
  FOR DELETE USING ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );

-- bills
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
CREATE POLICY bills_tenant_select ON bills
  FOR SELECT USING ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );
CREATE POLICY bills_tenant_insert ON bills
  FOR INSERT WITH CHECK ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );
CREATE POLICY bills_tenant_update ON bills
  FOR UPDATE USING ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );
CREATE POLICY bills_tenant_delete ON bills
  FOR DELETE USING ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );

-- bookings
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY bookings_tenant_select ON bookings
  FOR SELECT USING ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );
CREATE POLICY bookings_tenant_insert ON bookings
  FOR INSERT WITH CHECK ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );
CREATE POLICY bookings_tenant_update ON bookings
  FOR UPDATE USING ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );
CREATE POLICY bookings_tenant_delete ON bookings
  FOR DELETE USING ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );

-- buildings
ALTER TABLE buildings ENABLE ROW LEVEL SECURITY;
CREATE POLICY buildings_tenant_select ON buildings
  FOR SELECT USING ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );
CREATE POLICY buildings_tenant_insert ON buildings
  FOR INSERT WITH CHECK ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );
CREATE POLICY buildings_tenant_update ON buildings
  FOR UPDATE USING ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );
CREATE POLICY buildings_tenant_delete ON buildings
  FOR DELETE USING ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );

-- daily_help
ALTER TABLE daily_help ENABLE ROW LEVEL SECURITY;
CREATE POLICY daily_help_tenant_select ON daily_help
  FOR SELECT USING ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );
CREATE POLICY daily_help_tenant_insert ON daily_help
  FOR INSERT WITH CHECK ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );
CREATE POLICY daily_help_tenant_update ON daily_help
  FOR UPDATE USING ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );
CREATE POLICY daily_help_tenant_delete ON daily_help
  FOR DELETE USING ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );

-- daily_help_attendance
ALTER TABLE daily_help_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY daily_help_attendance_tenant_select ON daily_help_attendance
  FOR SELECT USING ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );
CREATE POLICY daily_help_attendance_tenant_insert ON daily_help_attendance
  FOR INSERT WITH CHECK ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );
CREATE POLICY daily_help_attendance_tenant_update ON daily_help_attendance
  FOR UPDATE USING ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );
CREATE POLICY daily_help_attendance_tenant_delete ON daily_help_attendance
  FOR DELETE USING ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );

-- daily_help_links
ALTER TABLE daily_help_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY daily_help_links_tenant_select ON daily_help_links
  FOR SELECT USING ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );
CREATE POLICY daily_help_links_tenant_insert ON daily_help_links
  FOR INSERT WITH CHECK ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );
CREATE POLICY daily_help_links_tenant_update ON daily_help_links
  FOR UPDATE USING ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );
CREATE POLICY daily_help_links_tenant_delete ON daily_help_links
  FOR DELETE USING ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );

-- deliveries
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY deliveries_tenant_select ON deliveries
  FOR SELECT USING ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );
CREATE POLICY deliveries_tenant_insert ON deliveries
  FOR INSERT WITH CHECK ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );
CREATE POLICY deliveries_tenant_update ON deliveries
  FOR UPDATE USING ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );
CREATE POLICY deliveries_tenant_delete ON deliveries
  FOR DELETE USING ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );

-- emergency_alerts
ALTER TABLE emergency_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY emergency_alerts_tenant_select ON emergency_alerts
  FOR SELECT USING ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );
CREATE POLICY emergency_alerts_tenant_insert ON emergency_alerts
  FOR INSERT WITH CHECK ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );
CREATE POLICY emergency_alerts_tenant_update ON emergency_alerts
  FOR UPDATE USING ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );
CREATE POLICY emergency_alerts_tenant_delete ON emergency_alerts
  FOR DELETE USING ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );

-- events
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
CREATE POLICY events_tenant_select ON events
  FOR SELECT USING ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );
CREATE POLICY events_tenant_insert ON events
  FOR INSERT WITH CHECK ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );
CREATE POLICY events_tenant_update ON events
  FOR UPDATE USING ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );
CREATE POLICY events_tenant_delete ON events
  FOR DELETE USING ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );

-- floors
ALTER TABLE floors ENABLE ROW LEVEL SECURITY;
CREATE POLICY floors_tenant_select ON floors
  FOR SELECT USING ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );
CREATE POLICY floors_tenant_insert ON floors
  FOR INSERT WITH CHECK ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );
CREATE POLICY floors_tenant_update ON floors
  FOR UPDATE USING ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );
CREATE POLICY floors_tenant_delete ON floors
  FOR DELETE USING ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );

-- gates
ALTER TABLE gates ENABLE ROW LEVEL SECURITY;
CREATE POLICY gates_tenant_select ON gates
  FOR SELECT USING ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );
CREATE POLICY gates_tenant_insert ON gates
  FOR INSERT WITH CHECK ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );
CREATE POLICY gates_tenant_update ON gates
  FOR UPDATE USING ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );
CREATE POLICY gates_tenant_delete ON gates
  FOR DELETE USING ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );

-- helpdesk_tickets
ALTER TABLE helpdesk_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY helpdesk_tickets_tenant_select ON helpdesk_tickets
  FOR SELECT USING ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );
CREATE POLICY helpdesk_tickets_tenant_insert ON helpdesk_tickets
  FOR INSERT WITH CHECK ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );
CREATE POLICY helpdesk_tickets_tenant_update ON helpdesk_tickets
  FOR UPDATE USING ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );
CREATE POLICY helpdesk_tickets_tenant_delete ON helpdesk_tickets
  FOR DELETE USING ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );

-- notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY notifications_tenant_select ON notifications
  FOR SELECT USING ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );
CREATE POLICY notifications_tenant_insert ON notifications
  FOR INSERT WITH CHECK ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );
CREATE POLICY notifications_tenant_update ON notifications
  FOR UPDATE USING ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );
CREATE POLICY notifications_tenant_delete ON notifications
  FOR DELETE USING ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );

-- parking_slots
ALTER TABLE parking_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY parking_slots_tenant_select ON parking_slots
  FOR SELECT USING ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );
CREATE POLICY parking_slots_tenant_insert ON parking_slots
  FOR INSERT WITH CHECK ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );
CREATE POLICY parking_slots_tenant_update ON parking_slots
  FOR UPDATE USING ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );
CREATE POLICY parking_slots_tenant_delete ON parking_slots
  FOR DELETE USING ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );

-- payments
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY payments_tenant_select ON payments
  FOR SELECT USING ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );
CREATE POLICY payments_tenant_insert ON payments
  FOR INSERT WITH CHECK ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );
CREATE POLICY payments_tenant_update ON payments
  FOR UPDATE USING ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );
CREATE POLICY payments_tenant_delete ON payments
  FOR DELETE USING ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );

-- polls
ALTER TABLE polls ENABLE ROW LEVEL SECURITY;
CREATE POLICY polls_tenant_select ON polls
  FOR SELECT USING ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );
CREATE POLICY polls_tenant_insert ON polls
  FOR INSERT WITH CHECK ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );
CREATE POLICY polls_tenant_update ON polls
  FOR UPDATE USING ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );
CREATE POLICY polls_tenant_delete ON polls
  FOR DELETE USING ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );

-- unit_members
ALTER TABLE unit_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY unit_members_tenant_select ON unit_members
  FOR SELECT USING ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );
CREATE POLICY unit_members_tenant_insert ON unit_members
  FOR INSERT WITH CHECK ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );
CREATE POLICY unit_members_tenant_update ON unit_members
  FOR UPDATE USING ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );
CREATE POLICY unit_members_tenant_delete ON unit_members
  FOR DELETE USING ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );

-- units
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
CREATE POLICY units_tenant_select ON units
  FOR SELECT USING ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );
CREATE POLICY units_tenant_insert ON units
  FOR INSERT WITH CHECK ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );
CREATE POLICY units_tenant_update ON units
  FOR UPDATE USING ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );
CREATE POLICY units_tenant_delete ON units
  FOR DELETE USING ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );

-- vehicles
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY vehicles_tenant_select ON vehicles
  FOR SELECT USING ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );
CREATE POLICY vehicles_tenant_insert ON vehicles
  FOR INSERT WITH CHECK ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );
CREATE POLICY vehicles_tenant_update ON vehicles
  FOR UPDATE USING ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );
CREATE POLICY vehicles_tenant_delete ON vehicles
  FOR DELETE USING ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );

-- visitor_entries
ALTER TABLE visitor_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY visitor_entries_tenant_select ON visitor_entries
  FOR SELECT USING ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );
CREATE POLICY visitor_entries_tenant_insert ON visitor_entries
  FOR INSERT WITH CHECK ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );
CREATE POLICY visitor_entries_tenant_update ON visitor_entries
  FOR UPDATE USING ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );
CREATE POLICY visitor_entries_tenant_delete ON visitor_entries
  FOR DELETE USING ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );

-- visitor_invites
ALTER TABLE visitor_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY visitor_invites_tenant_select ON visitor_invites
  FOR SELECT USING ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );
CREATE POLICY visitor_invites_tenant_insert ON visitor_invites
  FOR INSERT WITH CHECK ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );
CREATE POLICY visitor_invites_tenant_update ON visitor_invites
  FOR UPDATE USING ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );
CREATE POLICY visitor_invites_tenant_delete ON visitor_invites
  FOR DELETE USING ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );

-- visitors
ALTER TABLE visitors ENABLE ROW LEVEL SECURITY;
CREATE POLICY visitors_tenant_select ON visitors
  FOR SELECT USING ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );
CREATE POLICY visitors_tenant_insert ON visitors
  FOR INSERT WITH CHECK ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );
CREATE POLICY visitors_tenant_update ON visitors
  FOR UPDATE USING ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );
CREATE POLICY visitors_tenant_delete ON visitors
  FOR DELETE USING ( society_id = nullif(current_setting('app.society_id', true), '')::uuid );

-- ---------------------------------------------------------
-- 2. Tables without direct society_id — relationship-based RLS
--    Tenant ownership inherited through foreign key relationships
-- ---------------------------------------------------------

-- poll_votes → poll → society_id
ALTER TABLE poll_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY poll_votes_tenant_select ON poll_votes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM polls WHERE polls.id = poll_votes.poll_id
      AND polls.society_id = nullif(current_setting('app.society_id', true), '')::uuid
    )
  );

-- ticket_comments → helpdesk_tickets → society_id
ALTER TABLE ticket_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY ticket_comments_tenant_select ON ticket_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM helpdesk_tickets WHERE helpdesk_tickets.id = ticket_id
      AND helpdesk_tickets.society_id = nullif(current_setting('app.society_id', true), '')::uuid
    )
  );

-- poll_options → poll → society_id
ALTER TABLE poll_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY poll_options_tenant_select ON poll_options
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM polls WHERE polls.id = poll_options.poll_id
      AND polls.society_id = nullif(current_setting('app.society_id', true), '')::uuid
    )
  );

-- bill_items → bills → society_id
ALTER TABLE bill_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY bill_items_tenant_select ON bill_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM bills WHERE bills.id = bill_items.bill_id
      AND bills.society_id = nullif(current_setting('app.society_id', true), '')::uuid
    )
  );

-- ---------------------------------------------------------
-- 3. Tables NOT receiving RLS policies (preserve existing behavior)
-- ---------------------------------------------------------
-- audit_logs: append-only, REVOKE UPDATE/DELETE already in place.
--               RLS would interfere with audit append pathway.
-- societies: parent reference table, privileged service-role access only.
-- users: global auth table, no society_id, controlled at API layer.
-- otp_codes: global auth table, no society_id, controlled at API layer.
-- sessions: global auth table, no society_id, controlled at API layer.
-- bill_items INSERT/UPDATE/DELETE: relationship RLS added for SELECT only;
--       application-layer mutation guards remain primary enforcement.

COMMENT ON DATABASE IS 'R3 P0-04 RLS Tenant-Isolation Remediation applied. '
  'Policies enforce society_id = nullif(current_setting(''app.society_id'', true), '''')::uuid '
  'for defense-in-depth. See migration for full policy list.';