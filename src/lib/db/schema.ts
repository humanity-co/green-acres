import {
  pgTable, uuid, text, timestamp, integer, boolean, jsonb, pgEnum, index, uniqueIndex, varchar, numeric, date
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

export const roleEnum = pgEnum("role", ["SUPER_ADMIN","SOCIETY_ADMIN","RWA_MEMBER","ACCOUNTANT","FACILITY_MANAGER","SECURITY_MANAGER","GUARD","RESIDENT","FAMILY_MEMBER","VENDOR","SERVICE_PROVIDER","DOMESTIC_HELP"]);
export const unitTypeEnum = pgEnum("unit_type", ["FLAT","SHOP","VILLA","PLOT"]);
export const relationEnum = pgEnum("relation", ["OWNER","TENANT","FAMILY","SPOUSE","CHILD","PARENT"]);
export const inviteStatusEnum = pgEnum("invite_status", ["PENDING","APPROVED","REJECTED","EXPIRED","CANCELLED"]);
export const entryStatusEnum = pgEnum("entry_status", ["INSIDE","EXITED","DENIED"]);
export const deliveryStatusEnum = pgEnum("delivery_status", ["AT_GATE","DELIVERED","COLLECTED","RETURNED"]);
export const helpCategoryEnum = pgEnum("help_category", ["MAID","COOK","DRIVER","NANNY","GARDENER","OTHER"]);
export const billStatusEnum = pgEnum("bill_status", ["DRAFT","ISSUED","OVERDUE","PAID","PARTIAL","CANCELLED"]);
export const paymentStatusEnum = pgEnum("payment_status", ["PENDING","SUCCESS","FAILED","REFUNDED"]);
export const paymentMethodEnum = pgEnum("payment_method", ["UPI","CARD","NETBANKING","CASH","PHONEPE","RAZORPAY"]);
export const ticketStatusEnum = pgEnum("ticket_status", ["OPEN","ASSIGNED","IN_PROGRESS","RESOLVED","CLOSED","CANCELLED"]);
export const ticketPriorityEnum = pgEnum("ticket_priority", ["LOW","MEDIUM","HIGH","URGENT"]);
export const amenityTypeEnum = pgEnum("amenity_type", ["POOL","GYM","CLUBHOUSE","PARK","HALL","SPORTS","OTHER"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  phone: varchar("phone", { length: 20 }).notNull().unique(),
  email: varchar("email", { length: 255 }),
  fullName: text("full_name").notNull(),
  avatarUrl: text("avatar_url"),
  phoneVerified: boolean("phone_verified").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [index("users_phone_idx").on(t.phone)]);

export const societies = pgTable("societies", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  code: varchar("code", { length: 20 }).notNull().unique(),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 100 }),
  pincode: varchar("pincode", { length: 10 }),
  gstin: varchar("gstin", { length: 20 }),
  logoUrl: text("logo_url"),
  settings: jsonb("settings").default({}),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const userSocietyRoles = pgTable("user_society_roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  societyId: uuid("society_id").notNull().references(() => societies.id, { onDelete: "cascade" }),
  role: roleEnum("role").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("usr_role_unique").on(t.userId, t.societyId, t.role),
  index("usr_society_idx").on(t.societyId),
  index("usr_user_idx").on(t.userId),
]);

export const buildings = pgTable("buildings", {
  id: uuid("id").primaryKey().defaultRandom(),
  societyId: uuid("society_id").notNull().references(() => societies.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(),
  floorsCount: integer("floors_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("buildings_society_idx").on(t.societyId),
  uniqueIndex("buildings_society_name_unique").on(t.societyId, t.name),
]);

export const floors = pgTable("floors", {
  id: uuid("id").primaryKey().defaultRandom(),
  societyId: uuid("society_id").notNull().references(() => societies.id, { onDelete: "cascade" }),
  buildingId: uuid("building_id").notNull().references(() => buildings.id, { onDelete: "cascade" }),
  number: integer("number").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("floors_society_idx").on(t.societyId),
  index("floors_building_idx").on(t.buildingId),
  uniqueIndex("floors_building_number_unique").on(t.buildingId, t.number),
]);

export const units = pgTable("units", {
  id: uuid("id").primaryKey().defaultRandom(),
  societyId: uuid("society_id").notNull().references(() => societies.id, { onDelete: "cascade" }),
  buildingId: uuid("building_id").notNull().references(() => buildings.id, { onDelete: "cascade" }),
  floorId: uuid("floor_id").notNull().references(() => floors.id, { onDelete: "cascade" }),
  number: varchar("number", { length: 20 }).notNull(),
  type: unitTypeEnum("type").default("FLAT").notNull(),
  areaSqft: integer("area_sqft"),
  status: varchar("status", { length: 20 }).default("OCCUPIED").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("units_society_idx").on(t.societyId),
  index("units_society_created_idx").on(t.societyId, t.createdAt),
  uniqueIndex("units_society_number_unique").on(t.societyId, t.number),
]);

export const unitMembers = pgTable("unit_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  societyId: uuid("society_id").notNull().references(() => societies.id, { onDelete: "cascade" }),
  unitId: uuid("unit_id").notNull().references(() => units.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  relation: relationEnum("relation").notNull(),
  isPrimary: boolean("is_primary").default(false).notNull(),
  isVerified: boolean("is_verified").default(false).notNull(),
  verifiedBy: uuid("verified_by").references(() => users.id),
  verifiedAt: timestamp("verified_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("unit_members_society_idx").on(t.societyId),
  index("unit_members_unit_idx").on(t.unitId),
  index("unit_members_user_idx").on(t.userId),
  uniqueIndex("unit_members_unique").on(t.unitId, t.userId),
]);

export const gates = pgTable("gates", {
  id: uuid("id").primaryKey().defaultRandom(),
  societyId: uuid("society_id").notNull().references(() => societies.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(),
  type: varchar("type", { length: 20 }).default("MAIN").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [index("gates_society_idx").on(t.societyId)]);

export const visitors = pgTable("visitors", {
  id: uuid("id").primaryKey().defaultRandom(),
  societyId: uuid("society_id").notNull().references(() => societies.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  phone: varchar("phone", { length: 20 }).notNull(),
  photoUrl: text("photo_url"),
  govIdType: varchar("gov_id_type", { length: 20 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("visitors_society_idx").on(t.societyId),
  index("visitors_phone_idx").on(t.societyId, t.phone),
]);

export const visitorInvites = pgTable("visitor_invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  societyId: uuid("society_id").notNull().references(() => societies.id, { onDelete: "cascade" }),
  unitId: uuid("unit_id").notNull().references(() => units.id, { onDelete: "cascade" }),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  visitorId: uuid("visitor_id").notNull().references(() => visitors.id, { onDelete: "cascade" }),
  code: varchar("code", { length: 10 }).notNull(),
  qrToken: varchar("qr_token", { length: 64 }),
  otp: varchar("otp", { length: 10 }),
  purpose: text("purpose"),
  validFrom: timestamp("valid_from").defaultNow().notNull(),
  validTo: timestamp("valid_to").notNull(),
  status: inviteStatusEnum("status").default("PENDING").notNull(),
  approvedBy: uuid("approved_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("invites_society_idx").on(t.societyId),
  index("invites_society_created_idx").on(t.societyId, t.createdAt),
  index("invites_unit_idx").on(t.societyId, t.unitId),
  uniqueIndex("invites_code_unique").on(t.code),
]);

export const visitorEntries = pgTable("visitor_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  societyId: uuid("society_id").notNull().references(() => societies.id, { onDelete: "cascade" }),
  inviteId: uuid("invite_id").references(() => visitorInvites.id, { onDelete: "set null" }),
  visitorId: uuid("visitor_id").notNull().references(() => visitors.id),
  unitId: uuid("unit_id").notNull().references(() => units.id),
  gateId: uuid("gate_id").references(() => gates.id),
  guardId: uuid("guard_id").references(() => users.id),
  checkIn: timestamp("check_in").defaultNow().notNull(),
  checkOut: timestamp("check_out"),
  idempotencyKey: varchar("idempotency_key", { length: 64 }),
  isOffline: boolean("is_offline").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("entries_society_idx").on(t.societyId),
  index("entries_society_created_idx").on(t.societyId, t.createdAt),
  index("entries_unit_idx").on(t.societyId, t.unitId),
  index("entries_inside_idx").on(t.societyId, t.checkOut, t.createdAt),
  uniqueIndex("entries_idempotency_unique").on(t.idempotencyKey),
]);

export const deliveries = pgTable("deliveries", {
  id: uuid("id").primaryKey().defaultRandom(),
  societyId: uuid("society_id").notNull().references(() => societies.id, { onDelete: "cascade" }),
  unitId: uuid("unit_id").notNull().references(() => units.id),
  courierName: text("courier_name"),
  awb: varchar("awb", { length: 50 }),
  status: deliveryStatusEnum("status").default("AT_GATE").notNull(),
  otp: varchar("otp", { length: 64 }),
  otpExpiry: timestamp("otp_expiry"),
  guardId: uuid("guard_id").references(() => users.id),
  collectedAt: timestamp("collected_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("deliveries_society_idx").on(t.societyId),
  index("deliveries_unit_idx").on(t.societyId, t.unitId),
  index("deliveries_pending_idx").on(t.societyId, t.status, t.unitId),
]);

export const vehicleEntries = pgTable("vehicle_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  societyId: uuid("society_id").notNull().references(() => societies.id, { onDelete: "cascade" }),
  vehicleId: uuid("vehicle_id").references(() => vehicles.id),
  unitId: uuid("unit_id").references(() => units.id),
  gateId: uuid("gate_id").references(() => gates.id),
  guardId: uuid("guard_id").references(() => users.id),
  numberPlate: varchar("number_plate", { length: 20 }).notNull(),
  isVisitor: boolean("is_visitor").default(false).notNull(),
  checkIn: timestamp("check_in").defaultNow().notNull(),
  checkOut: timestamp("check_out"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("veh_entries_society_idx").on(t.societyId),
  index("veh_entries_inside_idx").on(t.societyId, t.checkOut, t.createdAt),
]);

export const dailyHelp = pgTable("daily_help", {
  id: uuid("id").primaryKey().defaultRandom(),
  societyId: uuid("society_id").notNull().references(() => societies.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  phone: varchar("phone", { length: 20 }).notNull(),
  photoUrl: text("photo_url"),
  category: helpCategoryEnum("category").notNull(),
  policeVerified: boolean("police_verified").default(false).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [index("daily_help_society_idx").on(t.societyId)]);

export const dailyHelpLinks = pgTable("daily_help_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  societyId: uuid("society_id").notNull().references(() => societies.id, { onDelete: "cascade" }),
  helpId: uuid("help_id").notNull().references(() => dailyHelp.id, { onDelete: "cascade" }),
  unitId: uuid("unit_id").notNull().references(() => units.id, { onDelete: "cascade" }),
  schedule: jsonb("schedule"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("help_links_society_idx").on(t.societyId),
  uniqueIndex("help_links_unique").on(t.helpId, t.unitId),
]);

export const dailyHelpAttendance = pgTable("daily_help_attendance", {
  id: uuid("id").primaryKey().defaultRandom(),
  societyId: uuid("society_id").notNull().references(() => societies.id, { onDelete: "cascade" }),
  helpId: uuid("help_id").notNull().references(() => dailyHelp.id, { onDelete: "cascade" }),
  unitId: uuid("unit_id").notNull().references(() => units.id),
  gateId: uuid("gate_id").references(() => gates.id),
  checkIn: timestamp("check_in").defaultNow().notNull(),
  checkOut: timestamp("check_out"),
  verifiedBy: uuid("verified_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("help_attendance_society_idx").on(t.societyId),
  index("help_attendance_date_idx").on(t.societyId, t.createdAt),
]);

export const vehicles = pgTable("vehicles", {
  id: uuid("id").primaryKey().defaultRandom(),
  societyId: uuid("society_id").notNull().references(() => societies.id, { onDelete: "cascade" }),
  unitId: uuid("unit_id").notNull().references(() => units.id),
  userId: uuid("user_id").notNull().references(() => users.id),
  numberPlate: varchar("number_plate", { length: 20 }).notNull(),
  type: varchar("type", { length: 20 }).notNull(),
  stickerNo: varchar("sticker_no", { length: 20 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("vehicles_society_idx").on(t.societyId),
  uniqueIndex("vehicles_society_plate_unique").on(t.societyId, t.numberPlate),
]);

export const parkingSlots = pgTable("parking_slots", {
  id: uuid("id").primaryKey().defaultRandom(),
  societyId: uuid("society_id").notNull().references(() => societies.id, { onDelete: "cascade" }),
  buildingId: uuid("building_id").references(() => buildings.id),
  number: varchar("number", { length: 20 }).notNull(),
  type: varchar("type", { length: 20 }).default("ALLOTTED").notNull(),
  unitId: uuid("unit_id").references(() => units.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("parking_society_idx").on(t.societyId),
  uniqueIndex("parking_society_number_unique").on(t.societyId, t.number),
]);

export const amenities = pgTable("amenities", {
  id: uuid("id").primaryKey().defaultRandom(),
  societyId: uuid("society_id").notNull().references(() => societies.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(),
  type: amenityTypeEnum("type").default("OTHER").notNull(),
  capacity: integer("capacity").default(10).notNull(),
  fee: numeric("fee", { precision: 10, scale: 2 }).default("0").notNull(),
  rules: text("rules"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [index("amenities_society_idx").on(t.societyId)]);

export const amenitySlots = pgTable("amenity_slots", {
  id: uuid("id").primaryKey().defaultRandom(),
  societyId: uuid("society_id").notNull().references(() => societies.id, { onDelete: "cascade" }),
  amenityId: uuid("amenity_id").notNull().references(() => amenities.id, { onDelete: "cascade" }),
  dayOfWeek: integer("day_of_week").notNull(),
  startTime: varchar("start_time", { length: 10 }).notNull(),
  endTime: varchar("end_time", { length: 10 }).notNull(),
}, (t) => [index("amenity_slots_society_idx").on(t.societyId)]);


// Booking status enum for type safety across booking lifecycle
export const bookingStatusEnum = pgEnum("booking_status", [
  "PENDING_PAYMENT",  // Awaiting payment for paid amenities
  "CONFIRMED",        // Active booking (free amenities or after payment)
  "CANCELLED",        // Cancelled by user or admin
  "COMPLETED",        // Slot time passed, booking fulfilled
  "NO_SHOW",          // User didn't show up
]);

export const bookings = pgTable("bookings", {
  id: uuid("id").primaryKey().defaultRandom(),
  societyId: uuid("society_id").notNull().references(() => societies.id, { onDelete: "cascade" }),
  amenityId: uuid("amenity_id").notNull().references(() => amenities.id),
  unitId: uuid("unit_id").notNull().references(() => units.id),
  userId: uuid("user_id").notNull().references(() => users.id),
  slotId: uuid("slot_id").references(() => amenitySlots.id),
  bookingDate: date("booking_date").notNull(),
  // P0 FIX: Changed default from "CONFIRMED" to "PENDING_PAYMENT" for paid amenities.
  // Actual initial value set at INSERT time based on amenity.fee > 0.
  status: varchar("status", { length: 20 }).default("CONFIRMED").notNull(),
  paymentId: uuid("payment_id"),
  billId: uuid("bill_id").references(() => bills.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("bookings_society_idx").on(t.societyId),
  // P0 FIX: Dropped bookings_slot_date_unique (forced capacity=1 for every amenity).
  // Replaced with a plain index for capacity-COUNT queries and a per-user unique
  // index that prevents one person from double-booking the same slot on the same date.
  index("bookings_slot_date_idx").on(t.amenityId, t.bookingDate, t.slotId),
  uniqueIndex("bookings_user_slot_date_unique").on(t.userId, t.amenityId, t.bookingDate, t.slotId).where(sql`status != 'CANCELLED'`),
]);



export const bills = pgTable("bills", {
  id: uuid("id").primaryKey().defaultRandom(),
  societyId: uuid("society_id").notNull().references(() => societies.id, { onDelete: "cascade" }),
  unitId: uuid("unit_id").notNull().references(() => units.id),
  title: text("title").notNull(),
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  dueDate: date("due_date").notNull(),
  subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),
  tax: numeric("tax", { precision: 12, scale: 2 }).default("0").notNull(),
  total: numeric("total", { precision: 12, scale: 2 }).notNull(),
  status: billStatusEnum("status").default("ISSUED").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("bills_society_idx").on(t.societyId),
  index("bills_unit_idx").on(t.societyId, t.unitId),
  index("bills_status_idx").on(t.societyId, t.status),
]);

export const billItems = pgTable("bill_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  billId: uuid("bill_id").notNull().references(() => bills.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  hsn: varchar("hsn", { length: 20 }),
});

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  societyId: uuid("society_id").notNull().references(() => societies.id, { onDelete: "cascade" }),
  billId: uuid("bill_id").references(() => bills.id, { onDelete: "set null" }),
  unitId: uuid("unit_id").notNull().references(() => units.id),
  payerId: uuid("payer_id").notNull().references(() => users.id),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  method: paymentMethodEnum("method").default("UPI").notNull(),
  gateway: varchar("gateway", { length: 20 }).default("mock").notNull(),
  gatewayRef: varchar("gateway_ref", { length: 100 }),
  status: paymentStatusEnum("status").default("PENDING").notNull(),
  rawPayload: jsonb("raw_payload"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("payments_society_idx").on(t.societyId),
  index("payments_bill_idx").on(t.billId),
  uniqueIndex("payments_gateway_ref_unique").on(t.gatewayRef),
]);

export const helpdeskTickets = pgTable("helpdesk_tickets", {
  id: uuid("id").primaryKey().defaultRandom(),
  societyId: uuid("society_id").notNull().references(() => societies.id, { onDelete: "cascade" }),
  unitId: uuid("unit_id").notNull().references(() => units.id),
  raisedBy: uuid("raised_by").notNull().references(() => users.id),
  category: varchar("category", { length: 50 }).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  priority: ticketPriorityEnum("priority").default("MEDIUM").notNull(),
  status: ticketStatusEnum("status").default("OPEN").notNull(),
  assigneeId: uuid("assignee_id").references(() => users.id),
  slaDue: timestamp("sla_due"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("tickets_society_idx").on(t.societyId),
  index("tickets_status_idx").on(t.societyId, t.status),
  index("tickets_unit_idx").on(t.societyId, t.unitId),
]);

export const ticketComments = pgTable("ticket_comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  ticketId: uuid("ticket_id").notNull().references(() => helpdeskTickets.id, { onDelete: "cascade" }),
  authorId: uuid("author_id").notNull().references(() => users.id),
  body: text("body").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [index("ticket_comments_ticket_idx").on(t.ticketId)]);

export const announcements = pgTable("announcements", {
  id: uuid("id").primaryKey().defaultRandom(),
  societyId: uuid("society_id").notNull().references(() => societies.id, { onDelete: "cascade" }),
  authorId: uuid("author_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  body: text("body").notNull(),
  priority: varchar("priority", { length: 20 }).default("NORMAL").notNull(),
  audienceScope: varchar("audience_scope", { length: 20 }).default("ALL").notNull(),
  publishedAt: timestamp("published_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [index("announcements_society_idx").on(t.societyId, t.createdAt)]);

export const polls = pgTable("polls", {
  id: uuid("id").primaryKey().defaultRandom(),
  societyId: uuid("society_id").notNull().references(() => societies.id, { onDelete: "cascade" }),
  question: text("question").notNull(),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  endsAt: timestamp("ends_at"),
  isAnonymous: boolean("is_anonymous").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [index("polls_society_idx").on(t.societyId)]);

export const pollOptions = pgTable("poll_options", {
  id: uuid("id").primaryKey().defaultRandom(),
  pollId: uuid("poll_id").notNull().references(() => polls.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
});

export const pollVotes = pgTable("poll_votes", {
  id: uuid("id").primaryKey().defaultRandom(),
  societyId: uuid("society_id").notNull().references(() => societies.id, { onDelete: "cascade" }),
  pollId: uuid("poll_id").notNull().references(() => polls.id, { onDelete: "cascade" }),
  optionId: uuid("option_id").notNull().references(() => pollOptions.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("poll_votes_society_idx").on(t.societyId),
  uniqueIndex("poll_votes_user_poll_unique").on(t.pollId, t.userId),
]);

export const events = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  societyId: uuid("society_id").notNull().references(() => societies.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  startsAt: timestamp("starts_at").notNull(),
  endsAt: timestamp("ends_at"),
  location: text("location"),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [index("events_society_idx").on(t.societyId)]);

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  societyId: uuid("society_id").notNull().references(() => societies.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  body: text("body"),
  channel: varchar("channel", { length: 20 }).default("IN_APP").notNull(),
  relatedEntity: varchar("related_entity", { length: 50 }),
  relatedId: uuid("related_id"),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("notifications_society_idx").on(t.societyId),
  index("notifications_user_idx").on(t.userId, t.createdAt),
]);

export const emergencyAlerts = pgTable("emergency_alerts", {
  id: uuid("id").primaryKey().defaultRandom(),
  societyId: uuid("society_id").notNull().references(() => societies.id, { onDelete: "cascade" }),
  unitId: uuid("unit_id").references(() => units.id),
  raisedBy: uuid("raised_by").notNull().references(() => users.id),
  type: varchar("type", { length: 20 }).notNull(),         // FIRE | MEDICAL | SECURITY | PANIC | OTHER
  description: text("description"),                         // What the resident described
  location: text("location"),                               // e.g. "Lobby, Tower B, Floor 3"
  status: varchar("status", { length: 20 }).default("OPEN").notNull(),
  // OPEN → ACKNOWLEDGED → RESPONDED → RESOLVED | DISMISSED
  acknowledgedBy: uuid("acknowledged_by").references(() => users.id),
  acknowledgedAt: timestamp("acknowledged_at"),             // When guard acknowledged
  respondedBy: uuid("responded_by").references(() => users.id), // Who physically responded
  respondedAt: timestamp("responded_at"),                   // When physical response started
  resolvedAt: timestamp("resolved_at"),                     // When incident closed
  resolutionNotes: text("resolution_notes"),                // What actually happened
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [index("emergency_society_idx").on(t.societyId)]);


export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  societyId: uuid("society_id").references(() => societies.id, { onDelete: "cascade" }),
  actorId: uuid("actor_id").references(() => users.id),
  action: varchar("action", { length: 100 }).notNull(),
  entity: varchar("entity", { length: 100 }).notNull(),
  entityId: uuid("entity_id"),
  prevState: jsonb("prev_state"),
  newState: jsonb("new_state"),
  ip: varchar("ip", { length: 45 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("audit_society_idx").on(t.societyId, t.createdAt),
  index("audit_entity_idx").on(t.entity, t.entityId),
]);

export const otpCodes = pgTable("otp_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  phone: varchar("phone", { length: 20 }).notNull(),
  codeHash: varchar("code_hash", { length: 255 }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  attempts: integer("attempts").default(0).notNull(),
  consumed: boolean("consumed").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [index("otp_phone_idx").on(t.phone), index("otp_expires_idx").on(t.expiresAt)]);

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: varchar("token", { length: 512 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [index("sessions_user_idx").on(t.userId), index("sessions_token_idx").on(t.token)]);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Society = typeof societies.$inferSelect;
export type NewSociety = typeof societies.$inferInsert;
export type Building = typeof buildings.$inferSelect;
export type Unit = typeof units.$inferSelect;
export type Gate = typeof gates.$inferSelect;
export type Visitor = typeof visitors.$inferSelect;
export type VisitorInvite = typeof visitorInvites.$inferSelect;
export type VisitorEntry = typeof visitorEntries.$inferSelect;
export type Delivery = typeof deliveries.$inferSelect;
export type DailyHelp = typeof dailyHelp.$inferSelect;
export type Vehicle = typeof vehicles.$inferSelect;
export type Amenity = typeof amenities.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type Bill = typeof bills.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type HelpdeskTicket = typeof helpdeskTickets.$inferSelect;
export type Announcement = typeof announcements.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type OtpCode = typeof otpCodes.$inferSelect;
export type Session = typeof sessions.$inferSelect;

export const societiesRelations = relations(societies, ({ many }) => ({
  buildings: many(buildings),
  units: many(units),
  gates: many(gates),
}));

export const buildingsRelations = relations(buildings, ({ one, many }) => ({
  society: one(societies, { fields: [buildings.societyId], references: [societies.id] }),
  floors: many(floors),
  units: many(units),
}));

export const unitsRelations = relations(units, ({ one, many }) => ({
  building: one(buildings, { fields: [units.buildingId], references: [buildings.id] }),
  floor: one(floors, { fields: [units.floorId], references: [floors.id] }),
  members: many(unitMembers),
}));

export const visitorInvitesRelations = relations(visitorInvites, ({ one }) => ({
  visitor: one(visitors, { fields: [visitorInvites.visitorId], references: [visitors.id] }),
  unit: one(units, { fields: [visitorInvites.unitId], references: [units.id] }),
}));
