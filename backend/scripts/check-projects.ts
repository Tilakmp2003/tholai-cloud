import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function checkProjects() {
  const projects = await prisma.project.findMany({
    select: { id: true, name: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  console.log("Recent projects:");
  projects.forEach((p) =>
    console.log("  -", p.name, "|", p.id.substring(0, 8))
  );

  // Check Phase1-Test-App if it exists
  const testProject = await prisma.project.findFirst({
    where: { name: { contains: "Phase1" } },
    include: {
      modules: { include: { tasks: true } },
      _count: { select: { modules: true } },
    },
  });

  if (testProject) {
    console.log("\nPhase1 Test Project Found!");
    console.log("  Name:", testProject.name);
    console.log("  Modules:", testProject._count.modules);
    const totalTasks = testProject.modules.reduce(
      (sum, m) => sum + m.tasks.length,
      0
    );
    console.log("  Total Tasks:", totalTasks);
    testProject.modules.forEach((m) => {
      console.log("  Module:", m.name, "(", m.tasks.length, "tasks)");
      m.tasks.forEach((t) =>
        console.log("    -", t.title, "|", t.requiredRole)
      );
    });
  } else {
    console.log("\nNo Phase1 project found yet");
  }

  await prisma.$disconnect();
}

checkProjects();
