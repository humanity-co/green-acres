import { db } from "../db";
import { societies, buildings, floors, units, users, userSocietyRoles, gates, amenities, amenitySlots, visitors, visitorInvites, bills, helpdeskTickets, announcements } from "./schema";

async function seed() {
  console.log("Seeding pilot society (96 flats)...");
  const [admin] = await db.insert(users).values({ phone: "9999999999", fullName: "Society Admin", phoneVerified: true }).returning();
  const [guard] = await db.insert(users).values({ phone: "8888888888", fullName: "Main Gate Guard", phoneVerified: true }).returning();
  const [resident] = await db.insert(users).values({ phone: "7777777777", fullName: "R. Resident", phoneVerified: true }).returning();

  const [society] = await db.insert(societies).values({
    name: "Green Acres Residency",
    code: "GAR001",
    address: "Plot 42, OMR, Chennai",
    city: "Chennai",
    state: "Tamil Nadu",
    pincode: "600096",
    createdBy: admin.id,
  }).returning();

  await db.insert(userSocietyRoles).values([
    { userId: admin.id, societyId: society.id, role: "SOCIETY_ADMIN" },
    { userId: guard.id, societyId: society.id, role: "GUARD" },
    { userId: resident.id, societyId: society.id, role: "RESIDENT" },
  ]);

  const [mainGate] = await db.insert(gates).values({ societyId: society.id, name: "Main Gate", type: "MAIN" }).returning();
  await db.insert(gates).values({ societyId: society.id, name: "Service Gate", type: "SERVICE" });

  const buildingNames = ["A", "B", "C"];
  const unitIds: string[] = [];
  for (const bName of buildingNames) {
    const [building] = await db.insert(buildings).values({ societyId: society.id, name: `Tower ${bName}`, floorsCount: 4 }).returning();
    for (let f = 1; f <= 4; f++) {
      const [floor] = await db.insert(floors).values({ societyId: society.id, buildingId: building.id, number: f }).returning();
      for (let u = 1; u <= 8; u++) {
        const num = `${bName}-${f}0${u}`;
        const [unit] = await db.insert(units).values({
          societyId: society.id, buildingId: building.id, floorId: floor.id, number: num, type: "FLAT", areaSqft: 1200 + u * 10,
        }).returning();
        unitIds.push(unit.id);
      }
    }
  }

  const { unitMembers } = await import("./schema");
  await db.insert(unitMembers).values({ societyId: society.id, unitId: unitIds[0], userId: resident.id, relation: "OWNER", isPrimary: true, isVerified: true });

  await db.insert(amenities).values([
    { societyId: society.id, name: "Swimming Pool", type: "POOL", capacity: 20, fee: "100" },
    { societyId: society.id, name: "Gym", type: "GYM", capacity: 15, fee: "0" },
    { societyId: society.id, name: "Clubhouse", type: "CLUBHOUSE", capacity: 100, fee: "500" },
  ]);

  const [pool] = await db.select().from(amenities).limit(1);
  if (pool) {
    await db.insert(amenitySlots).values([
      { societyId: society.id, amenityId: pool.id, dayOfWeek: 1, startTime: "06:00", endTime: "08:00" },
      { societyId: society.id, amenityId: pool.id, dayOfWeek: 6, startTime: "10:00", endTime: "12:00" },
    ]);
  }

  const [v1] = await db.insert(visitors).values({ societyId: society.id, name: "Amit Kumar", phone: "9000011111" }).returning();
  const [v2] = await db.insert(visitors).values({ societyId: society.id, name: "Courier Express", phone: "9000022222" }).returning();
  await db.insert(visitorInvites).values({
    societyId: society.id, unitId: unitIds[0], createdBy: resident.id, visitorId: v1.id, code: "GA1234", qrToken: "qr-demo-1", purpose: "Family visit", validTo: new Date(Date.now() + 86400000),
  });

  await db.insert(bills).values({
    societyId: society.id, unitId: unitIds[0], title: "Maintenance — Apr 2026", periodStart: "2026-04-01", periodEnd: "2026-04-30", dueDate: "2026-04-10", subtotal: "3500", tax: "630", total: "4130", status: "ISSUED",
  });
  await db.insert(helpdeskTickets).values({
    societyId: society.id, unitId: unitIds[0], raisedBy: resident.id, category: "Plumbing", title: "Leak in kitchen", description: "Tap leaking since 2 days", priority: "HIGH",
  });
  await db.insert(announcements).values({
    societyId: society.id, authorId: admin.id, title: "Water Supply Shutdown", body: "No water 10am-2pm tomorrow due to maintenance.", priority: "HIGH",
  });

  console.log(`Seeded society ${society.id} with ${unitIds.length} units`);
  process.exit(0);
}

seed().catch((e) => { console.error(e); process.exit(1); });
