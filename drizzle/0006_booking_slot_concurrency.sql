-- Migration 0006: Amenity Booking Slot Concurrency & Partial Unique Index
-- Replace static unique constraint with partial unique index so cancelled bookings do not prevent re-booking.

DROP INDEX IF EXISTS bookings_user_slot_date_unique;
CREATE UNIQUE INDEX IF NOT EXISTS bookings_user_slot_date_unique 
  ON bookings (user_id, amenity_id, booking_date, slot_id) 
  WHERE status != 'CANCELLED';
