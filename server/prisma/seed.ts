// Seed the specialist directory. Idempotent: upserts by id.
import { PrismaClient } from "@prisma/client";
import { SPECIALISTS } from "../src/data/specialists.js";

const prisma = new PrismaClient();

async function main() {
  for (const s of SPECIALISTS) {
    await prisma.specialist.upsert({
      where: { id: s.id },
      update: {
        name: s.name, specialty: s.specialty, subspecialty: s.subspecialty,
        zone: s.zone, city: s.city, lat: s.lat, lng: s.lng,
        facility: s.facility, address: s.address, phone: s.phone, email: s.email,
        available: s.available, languages: s.languages, tags: s.tags,
      },
      create: {
        id: s.id, name: s.name, specialty: s.specialty, subspecialty: s.subspecialty,
        zone: s.zone, city: s.city, lat: s.lat, lng: s.lng,
        facility: s.facility, address: s.address, phone: s.phone, email: s.email,
        available: s.available, languages: s.languages, tags: s.tags,
      },
    });
  }
  console.log(`Seeded ${SPECIALISTS.length} specialists.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
