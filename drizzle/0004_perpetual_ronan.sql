ALTER TABLE "daily_help_attendance" DROP CONSTRAINT "daily_help_attendance_help_id_daily_help_id_fk";
--> statement-breakpoint
ALTER TABLE "deliveries" ALTER COLUMN "otp" SET DATA TYPE varchar(64);--> statement-breakpoint
ALTER TABLE "daily_help" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "deliveries" ADD COLUMN "otp_expiry" timestamp;--> statement-breakpoint
ALTER TABLE "daily_help_attendance" ADD CONSTRAINT "daily_help_attendance_help_id_daily_help_id_fk" FOREIGN KEY ("help_id") REFERENCES "public"."daily_help"("id") ON DELETE cascade ON UPDATE no action;