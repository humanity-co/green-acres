-- Prevent concurrent requests from creating multiple active entries for the
-- same visitor invitation or normalized vehicle plate.
CREATE UNIQUE INDEX IF NOT EXISTS visitor_entries_one_active_invite
  ON visitor_entries (invite_id)
  WHERE check_out IS NULL AND invite_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS vehicle_entries_one_active_plate
  ON vehicle_entries (society_id, number_plate)
  WHERE check_out IS NULL;