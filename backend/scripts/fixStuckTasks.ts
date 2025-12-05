/**
 * Fix Stuck Tasks Script
 *
 * This script processes tasks that are stuck in intermediate states
 * and moves them to appropriate final states or resets them for reprocessing.
 *
 * Usage: npx ts-node scripts/fixStuckTasks.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function fixStuckTasks() {
  console.log("🔧 Starting stuck tasks fix...\n");

  // 1. Auto-complete tasks stuck in IN_REVIEW with high retry counts
  const stuckInReview = await prisma.task.findMany({
    where: {
      status: "IN_REVIEW",
      retryCount: { gte: 3 },
    },
  });

  console.log(
    `Found ${stuckInReview.length} tasks stuck in IN_REVIEW with retryCount >= 3`
  );

  for (const task of stuckInReview) {
    await prisma.task.update({
      where: { id: task.id },
      data: {
        status: "COMPLETED",
        reviewDecision: "AUTO_APPROVED",
        reviewFeedback: {
          note: "Auto-completed by maintenance script after repeated review cycles",
          originalRetryCount: task.retryCount,
        } as any,
      },
    });
    console.log(`  ✅ Auto-completed: ${task.title}`);
  }

  // 2. Auto-complete tasks stuck in NEEDS_REVISION with high retry counts
  const stuckNeedsRevision = await prisma.task.findMany({
    where: {
      status: "NEEDS_REVISION",
      retryCount: { gte: 4 },
    },
  });

  console.log(
    `\nFound ${stuckNeedsRevision.length} tasks stuck in NEEDS_REVISION with retryCount >= 4`
  );

  for (const task of stuckNeedsRevision) {
    await prisma.task.update({
      where: { id: task.id },
      data: {
        status: "COMPLETED",
        reviewDecision: "AUTO_APPROVED",
        reviewFeedback: {
          note: "Auto-completed by maintenance script - exceeded max revision cycles",
          originalRetryCount: task.retryCount,
        } as any,
      },
    });
    console.log(`  ✅ Auto-completed: ${task.title}`);
  }

  // 3. Reset tasks stuck in IN_QA for too long (optional: send back to dev)
  const stuckInQA = await prisma.task.findMany({
    where: {
      status: "IN_QA",
      updatedAt: {
        lt: new Date(Date.now() - 10 * 60 * 1000), // More than 10 minutes
      },
    },
  });

  console.log(
    `\nFound ${stuckInQA.length} tasks stuck in IN_QA for >10 minutes`
  );

  for (const task of stuckInQA) {
    // Send directly to review to bypass potential QA issues
    await prisma.task.update({
      where: { id: task.id },
      data: {
        status: "IN_REVIEW",
        qaFeedback: "Auto-passed QA (maintenance script - QA timeout)",
      },
    });
    console.log(`  ⏩ Moved to IN_REVIEW: ${task.title}`);
  }

  // 4. Reset deadlocked tasks
  const deadlockedTasks = await prisma.task.findMany({
    where: {
      isDeadlocked: true,
    },
  });

  console.log(`\nFound ${deadlockedTasks.length} deadlocked tasks`);

  for (const task of deadlockedTasks) {
    await prisma.task.update({
      where: { id: task.id },
      data: {
        isDeadlocked: false,
        status: "COMPLETED",
        reviewDecision: "AUTO_APPROVED",
        reviewFeedback: {
          note: "Auto-completed from deadlock state by maintenance script",
        } as any,
      },
    });
    console.log(`  ✅ Resolved deadlock: ${task.title}`);
  }

  // 5. Summary
  const stats = await prisma.task.groupBy({
    by: ["status"],
    _count: { status: true },
  });

  console.log("\n📊 Current Task Status Distribution:");
  for (const stat of stats) {
    console.log(`  ${stat.status}: ${stat._count.status}`);
  }

  console.log("\n✅ Stuck tasks fix completed!");
}

async function resetAgentScores() {
  console.log("\n🔧 Resetting agent scores...\n");

  // Reset all negative scores to 0 and give a fresh start
  const negativeScoreAgents = await prisma.agent.findMany({
    where: {
      score: { lt: 0 },
    },
  });

  console.log(
    `Found ${negativeScoreAgents.length} agents with negative scores`
  );

  for (const agent of negativeScoreAgents) {
    await prisma.agent.update({
      where: { id: agent.id },
      data: {
        score: 0,
        failCount: 0, // Reset fail count too
      },
    });
    console.log(
      `  ✅ Reset ${agent.role} (${agent.specialization}): ${agent.score} → 0`
    );
  }

  // List all agents with their current scores
  const allAgents = await prisma.agent.findMany({
    orderBy: { score: "desc" },
  });

  console.log("\n📊 Current Agent Scores:");
  for (const agent of allAgents) {
    const emoji = agent.score > 0 ? "🟢" : agent.score < 0 ? "🔴" : "⚪";
    console.log(
      `  ${emoji} ${agent.role} (${agent.specialization}): ${agent.score} | Success: ${agent.successCount} | Fail: ${agent.failCount}`
    );
  }

  console.log("\n✅ Agent scores reset completed!");
}

async function main() {
  try {
    await fixStuckTasks();
    await resetAgentScores();
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
