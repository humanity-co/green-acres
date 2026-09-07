-- R3 P0-04: Force RLS on relationship tables (opt-in → force)
-- Converts RLS from ENABLE (opt-in) to FORCE on 4 tables where
-- tenant ownership is inherited through foreign key relationships.
-- All policies use the existing app.society_id session mechanism;
-- FORCE ensures RLS cannot be bypassed.
--
-- Tables modified:
--   poll_votes   → poll → society_id
--   ticket_comments → helpdesk_tickets → society_id
--   poll_options → poll → society_id
--   bill_items   → bills → society_id

ALTER TABLE poll_votes FORCE ROW LEVEL SECURITY;
ALTER TABLE ticket_comments FORCE ROW LEVEL SECURITY;
ALTER TABLE poll_options FORCE ROW LEVEL SECURITY;
ALTER TABLE bill_items FORCE ROW LEVEL SECURITY;