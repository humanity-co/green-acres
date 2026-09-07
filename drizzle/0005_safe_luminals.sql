CREATE TABLE "vehicle_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"society_id" uuid NOT NULL,
	"vehicle_id" uuid,
	"unit_id" uuid,
	"gate_id" uuid,
	"guard_id" uuid,
	"number_plate" varchar(20) NOT NULL,
	"is_visitor" boolean DEFAULT false NOT NULL,
	"check_in" timestamp DEFAULT now() NOT NULL,
	"check_out" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "poll_votes" ADD COLUMN "society_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "vehicle_entries" ADD CONSTRAINT "vehicle_entries_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_entries" ADD CONSTRAINT "vehicle_entries_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_entries" ADD CONSTRAINT "vehicle_entries_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_entries" ADD CONSTRAINT "vehicle_entries_gate_id_gates_id_fk" FOREIGN KEY ("gate_id") REFERENCES "public"."gates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_entries" ADD CONSTRAINT "vehicle_entries_guard_id_users_id_fk" FOREIGN KEY ("guard_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "veh_entries_society_idx" ON "vehicle_entries" USING btree ("society_id");--> statement-breakpoint
CREATE INDEX "veh_entries_inside_idx" ON "vehicle_entries" USING btree ("society_id","check_out","created_at");--> statement-breakpoint
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "deliveries_pending_idx" ON "deliveries" USING btree ("society_id","status","unit_id");--> statement-breakpoint
CREATE INDEX "poll_votes_society_idx" ON "poll_votes" USING btree ("society_id");--> statement-breakpoint
CREATE INDEX "entries_inside_idx" ON "visitor_entries" USING btree ("society_id","check_out","created_at");