import { Router } from "express";
import { prisma } from "../lib/prisma";

const router = Router();

import { seedAgents } from "../scripts/seed";

// POST /api/admin/seed
router.post("/seed", async (req, res) => {
  try {
    const result = await seedAgents();
    res.json(result);
  } catch (error) {
    console.error("Seeding failed:", error);
    res.status(500).json({ error: "Seeding failed" });
  }
});

// GET /api/admin/kpis
router.get("/kpis", async (req, res) => {
  try {
    const totalProposals = await prisma.proposal.count();
    const approvedProposals = await prisma.proposal.count({
      where: { approved: true },
    });
    const boldProposals = await prisma.proposal.count({
      where: { type: "BOLD" },
    });

    const acceptanceRate =
      totalProposals > 0 ? (approvedProposals / totalProposals) * 100 : 0;
    const boldRate =
      totalProposals > 0 ? (boldProposals / totalProposals) * 100 : 0;

    const kpis = {
      tasks: {
        fixSuccessRate: 0.75, // Mock
        avgRetryCount: 1.2, // Mock
        reviewAcceptanceRate: 0.85, // Mock
      },
      architect: {
        proposalAcceptanceRate:
          totalProposals > 0 ? approvedProposals / totalProposals : 0,
        boldProposalRate:
          totalProposals > 0 ? boldProposals / totalProposals : 0,
      },
      performance: {
        totalCostWeek: 1250.5, // Mock
      },
      budget: {
        daily: {
          spent: 35.5,
          limit: 50.0,
          percent: 0.71,
        },
        isPaused: false,
      },
      memory: {
        totalMemories: 150,
        avgSuccessRate: 0.88,
      },
    };

    res.json(kpis);
  } catch (error) {
    console.error("Failed to fetch Admin KPIs:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// GET /api/admin/safety/allowlist
router.get("/safety/allowlist", (req, res) => {
  // Frontend expects an array of strings (package names)
  res.json(["axios", "react", "lodash", "express", "zod", "prisma"]);
});

// GET /api/admin/memory/retention
router.get("/memory/retention", (req, res) => {
  res.json({
    retentionDays: 30,
    archiveEnabled: true,
    totalArchived: 15,
    totalCurated: 42,
    totalFlagged: 0,
    flagged: [], // Frontend expects this array for mapping
  });
});

// GET /api/admin/trace/stats
router.get("/trace/stats", (req, res) => {
  res.json({
    totalTraces: 0,
    avgLatency: 0,
    errorRate: 0,
  });
});

// POST /api/admin/reset-stuck-tasks - Reset IN_PROGRESS tasks back to ASSIGNED
router.post("/reset-stuck-tasks", async (req, res) => {
  try {
    // Reset stuck IN_PROGRESS tasks
    const inProgressResult = await prisma.task.updateMany({
      where: { status: "IN_PROGRESS" },
      data: { status: "ASSIGNED" },
    });

    // Reset FAILED tasks back to QUEUED for retry
    const failedResult = await prisma.task.updateMany({
      where: { status: "FAILED" },
      data: { status: "QUEUED", errorMessage: null },
    });

    // Also reset agents to IDLE
    await prisma.agent.updateMany({
      where: { status: "BUSY" },
      data: { status: "IDLE", currentTaskId: null },
    });

    res.json({
      success: true,
      message: `Reset ${inProgressResult.count} stuck tasks and ${failedResult.count} failed tasks`,
    });
  } catch (error) {
    console.error("Reset stuck tasks failed:", error);
    res.status(500).json({ error: "Failed to reset stuck tasks" });
  }
});

// POST /api/admin/retry-all - Reset ALL non-completed tasks to QUEUED for fresh processing
router.post("/retry-all", async (req, res) => {
  try {
    const result = await prisma.task.updateMany({
      where: {
        status: {
          in: [
            "ASSIGNED",
            "IN_PROGRESS",
            "FAILED",
            "IN_REVIEW",
            "NEEDS_REVISION",
          ],
        },
      },
      data: { status: "QUEUED", errorMessage: null },
    });

    // Reset all agents to IDLE
    await prisma.agent.updateMany({
      data: { status: "IDLE", currentTaskId: null },
    });

    res.json({
      success: true,
      message: `Reset ${result.count} tasks to QUEUED for fresh processing`,
    });
  } catch (error) {
    console.error("Retry all failed:", error);
    res.status(500).json({ error: "Failed to retry all tasks" });
  }
});

export default router;
