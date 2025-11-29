import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();

async function seedDemoTask() {
  console.log("🌱 Seeding Demo Task...");

  // 1. Ensure Project Exists
  let project = await prisma.project.findFirst({ where: { name: "Demo Project" } });
  if (!project) {
    project = await prisma.project.create({
      data: {
        id: randomUUID(),
        name: "Demo Project",
        clientName: "Demo Client",
        description: "A demo project to showcase the AI Enterprise OS.",
        status: "IN_PROGRESS"
      }
    });
  }

  // 2. Ensure Module Exists
  let module = await prisma.module.findFirst({ where: { projectId: project.id } });
  if (!module) {
    module = await prisma.module.create({
      data: {
        id: randomUUID(),
        projectId: project.id,
        name: "Authentication Module",
        status: "IN_PROGRESS"
      }
    });
  }

  // 3. Create Task
  const task = await prisma.task.create({
    data: {
      id: randomUUID(),
      moduleId: module.id,
      title: "Implement Login Component",
      status: "QUEUED",
      requiredRole: "MidDev",
      contextPacket: {
        summary: "Create a login form.",
        details: "Create a React login component with email and password fields. Use Tailwind CSS. Button: 'Sign In'.",
        targetFile: "src/components/Login.tsx"
      }
    }
  });

  console.log(`✅ Demo Task Created: ${task.id}`);
  console.log("🚀 The system should pick this up shortly.");
}

seedDemoTask()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
