import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// Role normalization map
function normalizeRole(role: string): string {
  const r = role.toLowerCase().trim();
  if (r.includes("backend") || r.includes("backenddev")) return "MidDev";
  if (r.includes("frontend") || r.includes("frontenddev")) return "MidDev";
  if (r.includes("senior") || r.includes("seniordev")) return "SeniorDev";
  if (r.includes("full-stack") || r.includes("fullstack")) return "MidDev";
  if (r.includes("techwriter") || r.includes("tech writer")) return "MidDev";
  if (r === "system" || r === "") return "MidDev";
  if (r === "middev") return "MidDev";
  if (r === "juniordev") return "JuniorDev";
  if (r === "qa") return "QA";
  if (r === "teamlead") return "TeamLead";
  return role; // Keep as-is if already valid
}

async function cleanupAndNormalizeTasks() {
  const nonPhase1Keywords = [
    "devops",
    "ci/cd",
    "aws",
    "deployment",
    "infrastructure",
    "kubernetes",
    "docker",
    "terraform",
    "pipeline",
    "monitoring",
    "logging",
    "cloud",
    "security audit",
    "penetration",
  ];

  const allTasks = await prisma.task.findMany({
    select: { id: true, title: true, requiredRole: true, status: true },
  });

  console.log("Total tasks:", allTasks.length);

  // Find tasks to delete (non-Phase-1 by keyword)
  const tasksToDelete = allTasks.filter((task) => {
    const titleMatch = nonPhase1Keywords.some((keyword) =>
      task.title?.toLowerCase().includes(keyword.toLowerCase())
    );
    return titleMatch;
  });

  console.log("Tasks to delete (non-Phase-1):", tasksToDelete.length);
  tasksToDelete.forEach((t) => console.log("  DELETE:", t.title));

  if (tasksToDelete.length > 0) {
    const ids = tasksToDelete.map((t) => t.id);
    const deleted = await prisma.task.deleteMany({
      where: { id: { in: ids } },
    });
    console.log("Deleted:", deleted.count, "tasks");
  }

  // Normalize roles for remaining tasks
  const remainingTasks = await prisma.task.findMany({
    select: { id: true, title: true, requiredRole: true },
  });

  console.log("\nNormalizing roles for", remainingTasks.length, "tasks...");
  let normalizedCount = 0;

  for (const task of remainingTasks) {
    const oldRole = task.requiredRole || "MidDev";
    const newRole = normalizeRole(oldRole);
    if (oldRole !== newRole) {
      console.log(
        "  NORMALIZE:",
        oldRole,
        "->",
        newRole,
        "|",
        task.title?.substring(0, 40)
      );
      await prisma.task.update({
        where: { id: task.id },
        data: { requiredRole: newRole },
      });
      normalizedCount++;
    }
  }

  console.log("Normalized:", normalizedCount, "tasks");

  // Show final state
  const finalTasks = await prisma.task.findMany({
    select: { requiredRole: true },
  });

  const byRole: Record<string, number> = {};
  finalTasks.forEach((t) => {
    const role = t.requiredRole || "Unknown";
    byRole[role] = (byRole[role] || 0) + 1;
  });

  console.log("\nFinal tasks by role:");
  Object.entries(byRole)
    .sort()
    .forEach(([role, count]) => console.log("  ", role, ":", count));

  await prisma.$disconnect();
}

cleanupAndNormalizeTasks();
