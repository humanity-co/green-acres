ALTER TABLE "emergency_alerts" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "emergency_alerts" ADD COLUMN "location" text;--> statement-breakpoint
ALTER TABLE "emergency_alerts" ADD COLUMN "acknowledged_at" timestamp;--> statement-breakpoint
ALTER TABLE "emergency_alerts" ADD COLUMN "responded_by" uuid;--> statement-breakpoint
ALTER TABLE "emergency_alerts" ADD COLUMN "responded_at" timestamp;--> statement-breakpoint
ALTER TABLE "emergency_alerts" ADD COLUMN "resolved_at" timestamp;--> statement-breakpoint
ALTER TABLE "emergency_alerts" ADD COLUMN "resolution_notes" text;--> statement-breakpoint
ALTER TABLE "emergency_alerts" ADD CONSTRAINT "emergency_alerts_responded_by_users_id_fk" FOREIGN KEY ("responded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;