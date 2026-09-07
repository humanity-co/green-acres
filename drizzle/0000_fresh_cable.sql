CREATE TYPE "public"."amenity_type" AS ENUM('POOL', 'GYM', 'CLUBHOUSE', 'PARK', 'HALL', 'SPORTS', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."bill_status" AS ENUM('DRAFT', 'ISSUED', 'OVERDUE', 'PAID', 'PARTIAL');--> statement-breakpoint
CREATE TYPE "public"."delivery_status" AS ENUM('AT_GATE', 'DELIVERED', 'COLLECTED', 'RETURNED');--> statement-breakpoint
CREATE TYPE "public"."entry_status" AS ENUM('INSIDE', 'EXITED', 'DENIED');--> statement-breakpoint
CREATE TYPE "public"."help_category" AS ENUM('MAID', 'COOK', 'DRIVER', 'NANNY', 'GARDENER', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."invite_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('UPI', 'CARD', 'NETBANKING', 'CASH', 'PHONEPE', 'RAZORPAY');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED');--> statement-breakpoint
CREATE TYPE "public"."relation" AS ENUM('OWNER', 'TENANT', 'FAMILY', 'SPOUSE', 'CHILD', 'PARENT');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('SUPER_ADMIN', 'SOCIETY_ADMIN', 'RWA_MEMBER', 'ACCOUNTANT', 'FACILITY_MANAGER', 'SECURITY_MANAGER', 'GUARD', 'RESIDENT', 'FAMILY_MEMBER', 'VENDOR', 'SERVICE_PROVIDER', 'DOMESTIC_HELP');--> statement-breakpoint
CREATE TYPE "public"."ticket_priority" AS ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT');--> statement-breakpoint
CREATE TYPE "public"."ticket_status" AS ENUM('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');--> statement-breakpoint
CREATE TYPE "public"."unit_type" AS ENUM('FLAT', 'SHOP', 'VILLA', 'PLOT');--> statement-breakpoint
CREATE TABLE "amenities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"society_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"type" "amenity_type" DEFAULT 'OTHER' NOT NULL,
	"capacity" integer DEFAULT 10 NOT NULL,
	"fee" numeric(10, 2) DEFAULT '0' NOT NULL,
	"rules" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "amenity_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"society_id" uuid NOT NULL,
	"amenity_id" uuid NOT NULL,
	"day_of_week" integer NOT NULL,
	"start_time" varchar(10) NOT NULL,
	"end_time" varchar(10) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "announcements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"society_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"priority" varchar(20) DEFAULT 'NORMAL' NOT NULL,
	"audience_scope" varchar(20) DEFAULT 'ALL' NOT NULL,
	"published_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"society_id" uuid,
	"actor_id" uuid,
	"action" varchar(100) NOT NULL,
	"entity" varchar(100) NOT NULL,
	"entity_id" uuid,
	"prev_state" jsonb,
	"new_state" jsonb,
	"ip" varchar(45),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bill_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bill_id" uuid NOT NULL,
	"label" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"hsn" varchar(20)
);
--> statement-breakpoint
CREATE TABLE "bills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"society_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"title" text NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"due_date" date NOT NULL,
	"subtotal" numeric(12, 2) NOT NULL,
	"tax" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total" numeric(12, 2) NOT NULL,
	"status" "bill_status" DEFAULT 'ISSUED' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"society_id" uuid NOT NULL,
	"amenity_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"slot_id" uuid,
	"booking_date" date NOT NULL,
	"status" varchar(20) DEFAULT 'CONFIRMED' NOT NULL,
	"payment_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "buildings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"society_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"floors_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_help" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"society_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" varchar(20) NOT NULL,
	"photo_url" text,
	"category" "help_category" NOT NULL,
	"police_verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_help_attendance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"society_id" uuid NOT NULL,
	"help_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"gate_id" uuid,
	"check_in" timestamp DEFAULT now() NOT NULL,
	"check_out" timestamp,
	"verified_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_help_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"society_id" uuid NOT NULL,
	"help_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"schedule" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"society_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"courier_name" text,
	"awb" varchar(50),
	"status" "delivery_status" DEFAULT 'AT_GATE' NOT NULL,
	"otp" varchar(10),
	"guard_id" uuid,
	"collected_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "emergency_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"society_id" uuid NOT NULL,
	"unit_id" uuid,
	"raised_by" uuid NOT NULL,
	"type" varchar(20) NOT NULL,
	"status" varchar(20) DEFAULT 'OPEN' NOT NULL,
	"acknowledged_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"society_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"starts_at" timestamp NOT NULL,
	"ends_at" timestamp,
	"location" text,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "floors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"society_id" uuid NOT NULL,
	"building_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"society_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"type" varchar(20) DEFAULT 'MAIN' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "helpdesk_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"society_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"raised_by" uuid NOT NULL,
	"category" varchar(50) NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"priority" "ticket_priority" DEFAULT 'MEDIUM' NOT NULL,
	"status" "ticket_status" DEFAULT 'OPEN' NOT NULL,
	"assignee_id" uuid,
	"sla_due" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"society_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"channel" varchar(20) DEFAULT 'IN_APP' NOT NULL,
	"related_entity" varchar(50),
	"related_id" uuid,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parking_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"society_id" uuid NOT NULL,
	"building_id" uuid,
	"number" varchar(20) NOT NULL,
	"type" varchar(20) DEFAULT 'ALLOTTED' NOT NULL,
	"unit_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"society_id" uuid NOT NULL,
	"bill_id" uuid,
	"unit_id" uuid NOT NULL,
	"payer_id" uuid NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"method" "payment_method" DEFAULT 'UPI' NOT NULL,
	"gateway" varchar(20) DEFAULT 'mock' NOT NULL,
	"gateway_ref" varchar(100),
	"status" "payment_status" DEFAULT 'PENDING' NOT NULL,
	"raw_payload" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "poll_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"poll_id" uuid NOT NULL,
	"label" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "poll_votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"poll_id" uuid NOT NULL,
	"option_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "polls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"society_id" uuid NOT NULL,
	"question" text NOT NULL,
	"created_by" uuid NOT NULL,
	"ends_at" timestamp,
	"is_anonymous" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "societies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"code" varchar(20) NOT NULL,
	"address" text,
	"city" varchar(100),
	"state" varchar(100),
	"pincode" varchar(10),
	"gstin" varchar(20),
	"logo_url" text,
	"settings" jsonb DEFAULT '{}'::jsonb,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "societies_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "ticket_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "unit_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"society_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"relation" "relation" NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL,
	"verified_by" uuid,
	"verified_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"society_id" uuid NOT NULL,
	"building_id" uuid NOT NULL,
	"floor_id" uuid NOT NULL,
	"number" varchar(20) NOT NULL,
	"type" "unit_type" DEFAULT 'FLAT' NOT NULL,
	"area_sqft" integer,
	"status" varchar(20) DEFAULT 'OCCUPIED' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_society_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"society_id" uuid NOT NULL,
	"role" "role" NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" varchar(20) NOT NULL,
	"email" varchar(255),
	"full_name" text NOT NULL,
	"avatar_url" text,
	"phone_verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"society_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"number_plate" varchar(20) NOT NULL,
	"type" varchar(20) NOT NULL,
	"sticker_no" varchar(20),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "visitor_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"society_id" uuid NOT NULL,
	"invite_id" uuid,
	"visitor_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"gate_id" uuid,
	"guard_id" uuid,
	"check_in" timestamp DEFAULT now() NOT NULL,
	"check_out" timestamp,
	"idempotency_key" varchar(64),
	"is_offline" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "visitor_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"society_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"visitor_id" uuid NOT NULL,
	"code" varchar(10) NOT NULL,
	"qr_token" varchar(64),
	"otp" varchar(10),
	"purpose" text,
	"valid_from" timestamp DEFAULT now() NOT NULL,
	"valid_to" timestamp NOT NULL,
	"status" "invite_status" DEFAULT 'PENDING' NOT NULL,
	"approved_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "visitors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"society_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" varchar(20) NOT NULL,
	"photo_url" text,
	"gov_id_type" varchar(20),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "amenities" ADD CONSTRAINT "amenities_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "amenity_slots" ADD CONSTRAINT "amenity_slots_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "amenity_slots" ADD CONSTRAINT "amenity_slots_amenity_id_amenities_id_fk" FOREIGN KEY ("amenity_id") REFERENCES "public"."amenities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_items" ADD CONSTRAINT "bill_items_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_amenity_id_amenities_id_fk" FOREIGN KEY ("amenity_id") REFERENCES "public"."amenities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_slot_id_amenity_slots_id_fk" FOREIGN KEY ("slot_id") REFERENCES "public"."amenity_slots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buildings" ADD CONSTRAINT "buildings_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_help" ADD CONSTRAINT "daily_help_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_help_attendance" ADD CONSTRAINT "daily_help_attendance_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_help_attendance" ADD CONSTRAINT "daily_help_attendance_help_id_daily_help_id_fk" FOREIGN KEY ("help_id") REFERENCES "public"."daily_help"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_help_attendance" ADD CONSTRAINT "daily_help_attendance_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_help_attendance" ADD CONSTRAINT "daily_help_attendance_gate_id_gates_id_fk" FOREIGN KEY ("gate_id") REFERENCES "public"."gates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_help_attendance" ADD CONSTRAINT "daily_help_attendance_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_help_links" ADD CONSTRAINT "daily_help_links_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_help_links" ADD CONSTRAINT "daily_help_links_help_id_daily_help_id_fk" FOREIGN KEY ("help_id") REFERENCES "public"."daily_help"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_help_links" ADD CONSTRAINT "daily_help_links_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_guard_id_users_id_fk" FOREIGN KEY ("guard_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emergency_alerts" ADD CONSTRAINT "emergency_alerts_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emergency_alerts" ADD CONSTRAINT "emergency_alerts_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emergency_alerts" ADD CONSTRAINT "emergency_alerts_raised_by_users_id_fk" FOREIGN KEY ("raised_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emergency_alerts" ADD CONSTRAINT "emergency_alerts_acknowledged_by_users_id_fk" FOREIGN KEY ("acknowledged_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "floors" ADD CONSTRAINT "floors_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "floors" ADD CONSTRAINT "floors_building_id_buildings_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."buildings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gates" ADD CONSTRAINT "gates_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "helpdesk_tickets" ADD CONSTRAINT "helpdesk_tickets_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "helpdesk_tickets" ADD CONSTRAINT "helpdesk_tickets_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "helpdesk_tickets" ADD CONSTRAINT "helpdesk_tickets_raised_by_users_id_fk" FOREIGN KEY ("raised_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "helpdesk_tickets" ADD CONSTRAINT "helpdesk_tickets_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parking_slots" ADD CONSTRAINT "parking_slots_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parking_slots" ADD CONSTRAINT "parking_slots_building_id_buildings_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."buildings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parking_slots" ADD CONSTRAINT "parking_slots_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_payer_id_users_id_fk" FOREIGN KEY ("payer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_options" ADD CONSTRAINT "poll_options_poll_id_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_poll_id_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_option_id_poll_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."poll_options"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "polls" ADD CONSTRAINT "polls_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "polls" ADD CONSTRAINT "polls_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "societies" ADD CONSTRAINT "societies_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_comments" ADD CONSTRAINT "ticket_comments_ticket_id_helpdesk_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."helpdesk_tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_comments" ADD CONSTRAINT "ticket_comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_members" ADD CONSTRAINT "unit_members_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_members" ADD CONSTRAINT "unit_members_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_members" ADD CONSTRAINT "unit_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_members" ADD CONSTRAINT "unit_members_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_building_id_buildings_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."buildings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_floor_id_floors_id_fk" FOREIGN KEY ("floor_id") REFERENCES "public"."floors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_society_roles" ADD CONSTRAINT "user_society_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_society_roles" ADD CONSTRAINT "user_society_roles_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitor_entries" ADD CONSTRAINT "visitor_entries_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitor_entries" ADD CONSTRAINT "visitor_entries_invite_id_visitor_invites_id_fk" FOREIGN KEY ("invite_id") REFERENCES "public"."visitor_invites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitor_entries" ADD CONSTRAINT "visitor_entries_visitor_id_visitors_id_fk" FOREIGN KEY ("visitor_id") REFERENCES "public"."visitors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitor_entries" ADD CONSTRAINT "visitor_entries_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitor_entries" ADD CONSTRAINT "visitor_entries_gate_id_gates_id_fk" FOREIGN KEY ("gate_id") REFERENCES "public"."gates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitor_entries" ADD CONSTRAINT "visitor_entries_guard_id_users_id_fk" FOREIGN KEY ("guard_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitor_invites" ADD CONSTRAINT "visitor_invites_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitor_invites" ADD CONSTRAINT "visitor_invites_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitor_invites" ADD CONSTRAINT "visitor_invites_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitor_invites" ADD CONSTRAINT "visitor_invites_visitor_id_visitors_id_fk" FOREIGN KEY ("visitor_id") REFERENCES "public"."visitors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitor_invites" ADD CONSTRAINT "visitor_invites_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitors" ADD CONSTRAINT "visitors_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "amenities_society_idx" ON "amenities" USING btree ("society_id");--> statement-breakpoint
CREATE INDEX "amenity_slots_society_idx" ON "amenity_slots" USING btree ("society_id");--> statement-breakpoint
CREATE INDEX "announcements_society_idx" ON "announcements" USING btree ("society_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_society_idx" ON "audit_logs" USING btree ("society_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "audit_logs" USING btree ("entity","entity_id");--> statement-breakpoint
CREATE INDEX "bills_society_idx" ON "bills" USING btree ("society_id");--> statement-breakpoint
CREATE INDEX "bills_unit_idx" ON "bills" USING btree ("society_id","unit_id");--> statement-breakpoint
CREATE INDEX "bills_status_idx" ON "bills" USING btree ("society_id","status");--> statement-breakpoint
CREATE INDEX "bookings_society_idx" ON "bookings" USING btree ("society_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_slot_date_unique" ON "bookings" USING btree ("amenity_id","booking_date","slot_id");--> statement-breakpoint
CREATE INDEX "buildings_society_idx" ON "buildings" USING btree ("society_id");--> statement-breakpoint
CREATE UNIQUE INDEX "buildings_society_name_unique" ON "buildings" USING btree ("society_id","name");--> statement-breakpoint
CREATE INDEX "daily_help_society_idx" ON "daily_help" USING btree ("society_id");--> statement-breakpoint
CREATE INDEX "help_attendance_society_idx" ON "daily_help_attendance" USING btree ("society_id");--> statement-breakpoint
CREATE INDEX "help_attendance_date_idx" ON "daily_help_attendance" USING btree ("society_id","created_at");--> statement-breakpoint
CREATE INDEX "help_links_society_idx" ON "daily_help_links" USING btree ("society_id");--> statement-breakpoint
CREATE UNIQUE INDEX "help_links_unique" ON "daily_help_links" USING btree ("help_id","unit_id");--> statement-breakpoint
CREATE INDEX "deliveries_society_idx" ON "deliveries" USING btree ("society_id");--> statement-breakpoint
CREATE INDEX "deliveries_unit_idx" ON "deliveries" USING btree ("society_id","unit_id");--> statement-breakpoint
CREATE INDEX "emergency_society_idx" ON "emergency_alerts" USING btree ("society_id");--> statement-breakpoint
CREATE INDEX "events_society_idx" ON "events" USING btree ("society_id");--> statement-breakpoint
CREATE INDEX "floors_society_idx" ON "floors" USING btree ("society_id");--> statement-breakpoint
CREATE INDEX "floors_building_idx" ON "floors" USING btree ("building_id");--> statement-breakpoint
CREATE UNIQUE INDEX "floors_building_number_unique" ON "floors" USING btree ("building_id","number");--> statement-breakpoint
CREATE INDEX "gates_society_idx" ON "gates" USING btree ("society_id");--> statement-breakpoint
CREATE INDEX "tickets_society_idx" ON "helpdesk_tickets" USING btree ("society_id");--> statement-breakpoint
CREATE INDEX "tickets_status_idx" ON "helpdesk_tickets" USING btree ("society_id","status");--> statement-breakpoint
CREATE INDEX "tickets_unit_idx" ON "helpdesk_tickets" USING btree ("society_id","unit_id");--> statement-breakpoint
CREATE INDEX "notifications_society_idx" ON "notifications" USING btree ("society_id");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "parking_society_idx" ON "parking_slots" USING btree ("society_id");--> statement-breakpoint
CREATE UNIQUE INDEX "parking_society_number_unique" ON "parking_slots" USING btree ("society_id","number");--> statement-breakpoint
CREATE INDEX "payments_society_idx" ON "payments" USING btree ("society_id");--> statement-breakpoint
CREATE INDEX "payments_bill_idx" ON "payments" USING btree ("bill_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_gateway_ref_unique" ON "payments" USING btree ("gateway_ref");--> statement-breakpoint
CREATE UNIQUE INDEX "poll_votes_user_poll_unique" ON "poll_votes" USING btree ("poll_id","user_id");--> statement-breakpoint
CREATE INDEX "polls_society_idx" ON "polls" USING btree ("society_id");--> statement-breakpoint
CREATE INDEX "ticket_comments_ticket_idx" ON "ticket_comments" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "unit_members_society_idx" ON "unit_members" USING btree ("society_id");--> statement-breakpoint
CREATE INDEX "unit_members_unit_idx" ON "unit_members" USING btree ("unit_id");--> statement-breakpoint
CREATE INDEX "unit_members_user_idx" ON "unit_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unit_members_unique" ON "unit_members" USING btree ("unit_id","user_id");--> statement-breakpoint
CREATE INDEX "units_society_idx" ON "units" USING btree ("society_id");--> statement-breakpoint
CREATE INDEX "units_society_created_idx" ON "units" USING btree ("society_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "units_society_number_unique" ON "units" USING btree ("society_id","number");--> statement-breakpoint
CREATE UNIQUE INDEX "usr_role_unique" ON "user_society_roles" USING btree ("user_id","society_id","role");--> statement-breakpoint
CREATE INDEX "usr_society_idx" ON "user_society_roles" USING btree ("society_id");--> statement-breakpoint
CREATE INDEX "usr_user_idx" ON "user_society_roles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "users_phone_idx" ON "users" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "vehicles_society_idx" ON "vehicles" USING btree ("society_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicles_society_plate_unique" ON "vehicles" USING btree ("society_id","number_plate");--> statement-breakpoint
CREATE INDEX "entries_society_idx" ON "visitor_entries" USING btree ("society_id");--> statement-breakpoint
CREATE INDEX "entries_society_created_idx" ON "visitor_entries" USING btree ("society_id","created_at");--> statement-breakpoint
CREATE INDEX "entries_unit_idx" ON "visitor_entries" USING btree ("society_id","unit_id");--> statement-breakpoint
CREATE UNIQUE INDEX "entries_idempotency_unique" ON "visitor_entries" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "invites_society_idx" ON "visitor_invites" USING btree ("society_id");--> statement-breakpoint
CREATE INDEX "invites_society_created_idx" ON "visitor_invites" USING btree ("society_id","created_at");--> statement-breakpoint
CREATE INDEX "invites_unit_idx" ON "visitor_invites" USING btree ("society_id","unit_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invites_code_unique" ON "visitor_invites" USING btree ("code");--> statement-breakpoint
CREATE INDEX "visitors_society_idx" ON "visitors" USING btree ("society_id");--> statement-breakpoint
CREATE INDEX "visitors_phone_idx" ON "visitors" USING btree ("society_id","phone");