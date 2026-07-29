import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Upsert standard Roles
  const adminRole = await prisma.role.upsert({
    where: { name: "ADMIN" },
    update: {},
    create: { name: "ADMIN" },
  });

  const studentRole = await prisma.role.upsert({
    where: { name: "STUDENT" },
    update: {},
    create: { name: "STUDENT" },
  });

  const recruiterRole = await prisma.role.upsert({
    where: { name: "RECRUITER" },
    update: {},
    create: { name: "RECRUITER" },
  });

  console.log("Roles seeded successfully: ADMIN, STUDENT, RECRUITER");

  // Create default student user
  const passwordHash = await bcrypt.hash("password", 10);
  
  const testStudent = await prisma.user.upsert({
    where: { username: "student" },
    update: {},
    create: {
      username: "student",
      email: "student@example.com",
      passwordHash: passwordHash,
      roleId: studentRole.id,
      profile: {
        create: {
          fullName: "Jane Doe",
          targetRole: "Full Stack Engineer",
          streak: 5,
          lastActive: new Date(),
          details: {
            college: "University of Placements",
            skills: ["JavaScript", "TypeScript", "React", "Node.js"]
          }
        }
      }
    }
  });

  console.log(`Test student user seeded successfully: @${testStudent.username}`);
}

main()
  .catch((e) => {
    console.error("Seeding operation failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
