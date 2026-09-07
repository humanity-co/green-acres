CREATE TYPE "public"."booking_status" AS ENUM('PENDING_PAYMENT', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW');--> statement-breakpoint
DROP INDEX "bookings_slot_date_unique";--> statement-breakpoint
CREATE INDEX "bookings_slot_date_idx" ON "bookings" USING btree ("amenity_id","booking_date","slot_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_user_slot_date_unique" ON "bookings" USING btree ("user_id","amenity_id","booking_date","slot_id");