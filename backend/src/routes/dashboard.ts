/**
 * Phase 5: Dashboard API Routes
 *
 * Provides real-time data for the observability dashboard
 */

import { Router } from "express";
import { prisma } from "../lib/prisma";
import { applyGovernanceDecision } from "../governance/governanceRules";
import { emitAgentUpdate, emitLog } from "../websocket/socketServer";

const router = Router();

/**
 * GET /api/dashboard/agents
 * Returns all agents with current status and metrics
 * Query params: projectId (optional) - ignored, always returns all agents from global pool
 */
router.get("/agents", async (req, res) => {
  try {
    // Always return ALL agents from the global pool
    // The projectId filter is deprecated since we now use a shared agent pool
    const agents = await prisma.agent.findMany({
      // Sort by most active first (success + fail count), then by score
      orderBy: [{ successCount: "desc" }, { score: "desc" }],
      select: {
        id: true,
        role: true,
        status: true,
        score: true,
        riskLevel: true,
        successCount: true,
        failCount: true,
        currentTaskId: true,
        lastActiveAt: true,
        specialization: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json({ agents });
  } catch (error) {
    console.error("[Dashboard API] Error fetching agents:", error);
    res.status(500).json({ error: "Failed to fetch agents" });
  }
});

/**
 * GET /api/dashboard/agents/:agentId
 * Returns detailed information about a specific agent including:
 * - Task history (completed and failed)
 * - Cost metrics
 * - Performance stats
 * - Time taken per task
 */
router.get("/agents/:agentId", async (req, res) => {
  try {
    const { agentId } = req.params;

    // Get agent details
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      include: {
        performanceLogs: {
          orderBy: { createdAt: "desc" },
          take: 50,
        },
      },
    });

    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }

    // Determine if this is a review-type agent (TeamLead, QA, etc.)
    const isReviewAgent = ["TeamLead", "QA", "SeniorDev"].some((role) =>
      agent.role.toLowerCase().includes(role.toLowerCase())
    );

    // Get tasks this agent worked on (assigned to them)
    let tasks = await prisma.task.findMany({
      where: { assignedToAgentId: agentId },
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: {
        id: true,
        title: true,
        status: true,
        requiredRole: true,
        createdAt: true,
        updatedAt: true,
        errorMessage: true,
        relatedFileName: true,
        lastReviewBy: true,
        module: {
          select: {
            name: true,
            project: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    // For review agents, also get tasks they reviewed
    if (isReviewAgent && tasks.length === 0) {
      // Extract project ID from agent ID (format: proj_{projectId}_role_num)
      const projectIdMatch = agentId.match(/^proj_([^_]+)/);
      const projectId = projectIdMatch ? projectIdMatch[1] : null;

      // Build the where clause based on agent role
      const isQAAgent = agent.role.toLowerCase().includes("qa");

      let whereClause: any = {};

      if (isQAAgent) {
        // QA agents: find tasks that have qaFeedback (meaning QA reviewed them)
        whereClause = {
          qaFeedback: { not: null },
          ...(projectId && {
            module: {
              projectId: { contains: projectId },
            },
          }),
        };
      } else {
        // TeamLead and other review agents: use lastReviewBy
        whereClause = {
          lastReviewBy: {
            contains: agent.role.replace(/[0-9]/g, ""),
            mode: "insensitive",
          },
          ...(projectId && {
            module: {
              projectId: { contains: projectId },
            },
          }),
        };
      }

      // Get tasks reviewed by this agent type in the same project
      const reviewedTasks = await prisma.task.findMany({
        where: whereClause,
        orderBy: { updatedAt: "desc" },
        take: 50,
        select: {
          id: true,
          title: true,
          status: true,
          requiredRole: true,
          createdAt: true,
          updatedAt: true,
          errorMessage: true,
          relatedFileName: true,
          lastReviewBy: true,
          qaFeedback: true,
          module: {
            select: {
              name: true,
              project: {
                select: { id: true, name: true },
              },
            },
          },
        },
      });

      tasks = reviewedTasks;
    }

    // Get task metrics for this agent
    const taskMetrics = await prisma.taskMetrics.findMany({
      where: { agentId: agentId },
      orderBy: { createdAt: "desc" },
      include: {
        task: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
      },
    });

    // Calculate aggregated stats
    const totalCost = taskMetrics.reduce((sum, m) => sum + (m.costUsd || 0), 0);
    const totalTokensIn = taskMetrics.reduce(
      (sum, m) => sum + (m.tokensIn || 0),
      0
    );
    const totalTokensOut = taskMetrics.reduce(
      (sum, m) => sum + (m.tokensOut || 0),
      0
    );
    const avgExecutionTime =
      taskMetrics.length > 0
        ? taskMetrics.reduce((sum, m) => sum + (m.executionTimeMs || 0), 0) /
          taskMetrics.length
        : 0;

    // Task breakdown by status
    const tasksByStatus = {
      completed: tasks.filter((t) => t.status === "COMPLETED").length,
      failed: tasks.filter((t) => t.status === "FAILED").length,
      inProgress: tasks.filter((t) => t.status === "IN_PROGRESS").length,
      inReview: tasks.filter((t) => t.status === "IN_REVIEW").length,
      inQA: tasks.filter((t) => t.status === "IN_QA").length,
    };

    res.json({
      agent: {
        id: agent.id,
        role: agent.role,
        status: agent.status,
        score: agent.score,
        riskLevel: agent.riskLevel,
        successCount: agent.successCount,
        failCount: agent.failCount,
        specialization: agent.specialization,
        createdAt: agent.createdAt,
        lastActiveAt: agent.lastActiveAt,
        modelConfig: agent.modelConfig,
      },
      stats: {
        totalCost: parseFloat(totalCost.toFixed(6)),
        totalTokensIn,
        totalTokensOut,
        avgExecutionTimeMs: Math.round(avgExecutionTime),
        successRate:
          agent.successCount + agent.failCount > 0
            ? parseFloat(
                (
                  (agent.successCount /
                    (agent.successCount + agent.failCount)) *
                  100
                ).toFixed(1)
              )
            : 0,
        tasksByStatus,
      },
      tasks: tasks.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        requiredRole: t.requiredRole,
        completedAt: t.updatedAt,
        errorMessage: t.errorMessage,
        fileName: t.relatedFileName,
        project: t.module?.project?.name || "Unknown",
        module: t.module?.name || "Unknown",
      })),
      taskMetrics: taskMetrics.map((m) => ({
        taskId: m.taskId,
        taskTitle: m.task?.title || "Unknown",
        taskStatus: m.task?.status || "Unknown",
        executionTimeMs: m.executionTimeMs,
        tokensIn: m.tokensIn,
        tokensOut: m.tokensOut,
        costUsd: m.costUsd,
        createdAt: m.createdAt,
      })),
      performanceLogs: agent.performanceLogs,
    });
  } catch (error) {
    console.error("[Dashboard API] Error fetching agent details:", error);
    res.status(500).json({ error: "Failed to fetch agent details" });
  }
});

/**
 * GET /api/dashboard/tasks
 * Returns tasks grouped by status
 * Query params: projectId (optional) - filter by project
 */
router.get("/tasks", async (req, res) => {
  try {
    const { projectId } = req.query;

    // Build where clause
    const whereClause: any = {};
    if (projectId && typeof projectId === "string") {
      whereClause.module = {
        projectId: projectId,
      };
    }

    const tasks = await prisma.task.findMany({
      where: whereClause,
      include: {
        module: {
          select: {
            name: true,
            projectId: true,
            project: {
              select: { id: true, name: true },
            },
          },
        },
        assignedToAgent: {
          select: {
            id: true,
            role: true,
          },
        },
        traces: {
          take: 1,
          orderBy: { createdAt: "desc" },
          select: {
            event: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 200, // Limit for performance
    });

    // Fetch cost metrics for all tasks in one query
    const taskIds = tasks.map((t) => t.id);
    const taskMetrics = await prisma.taskMetrics.findMany({
      where: { taskId: { in: taskIds } },
      select: { taskId: true, costUsd: true },
    });

    // Create a map for quick lookup
    const costMap = new Map<string, number>();
    taskMetrics.forEach((m) => {
      costMap.set(m.taskId, m.costUsd || 0);
    });

    // Add cost to each task
    const tasksWithCost = tasks.map((t) => ({
      ...t,
      cost: costMap.get(t.id) || 0,
    }));

    // Group by status
    const grouped = {
      queued: tasksWithCost.filter((t) => t.status === "QUEUED"),
      assigned: tasksWithCost.filter((t) => t.status === "ASSIGNED"),
      inProgress: tasksWithCost.filter((t) => t.status === "IN_PROGRESS"),
      inReview: tasksWithCost.filter((t) => t.status === "IN_REVIEW"),
      inQA: tasksWithCost.filter((t) => t.status === "IN_QA"),
      needsRevision: tasksWithCost.filter((t) => t.status === "NEEDS_REVISION"),
      blocked: tasksWithCost.filter((t) => t.status === "BLOCKED"),
      completed: tasksWithCost.filter((t) => t.status === "COMPLETED"),
      failed: tasksWithCost.filter((t) => t.status === "FAILED"),
    };

    // Calculate stats
    const completed = grouped.completed.length;
    const total = tasksWithCost.length;
    const completionRate = total > 0 ? (completed / total) * 100 : 0;

    res.json({
      ...grouped,
      stats: {
        total,
        completionRate: parseFloat(completionRate.toFixed(2)),
        avgDuration: 0, // TODO: Calculate from trace data
      },
    });
  } catch (error) {
    console.error("[Dashboard API] Error fetching tasks:", error);
    res.status(500).json({ error: "Failed to fetch tasks" });
  }
});

/**
 * GET /api/dashboard/escalations
 * Returns context requests with details
 */
router.get("/escalations", async (req, res) => {
  try {
    const escalations = await prisma.contextRequest.findMany({
      include: {
        task: {
          select: {
            id: true,
            contextPacket: true,
            module: {
              select: { name: true },
            },
          },
        },
        fromAgent: {
          select: {
            id: true,
            role: true,
          },
        },
        toAgent: {
          select: {
            id: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const open = escalations.filter((e) => e.status === "OPEN");
    const resolved = escalations.filter((e) => e.status === "RESOLVED");

    // Calculate avg resolution time
    const resolvedWithTimes = resolved.filter((e) => e.resolvedAt);
    const avgResolutionTime =
      resolvedWithTimes.length > 0
        ? resolvedWithTimes.reduce((sum, e) => {
            const duration = e.resolvedAt!.getTime() - e.createdAt.getTime();
            return sum + duration;
          }, 0) / resolvedWithTimes.length
        : 0;

    res.json({
      open,
      resolved,
      stats: {
        totalOpen: open.length,
        totalResolved: resolved.length,
        avgResolutionTime: Math.round(avgResolutionTime / 1000), // Convert to seconds
      },
    });
  } catch (error) {
    console.error("[Dashboard API] Error fetching escalations:", error);
    res.status(500).json({ error: "Failed to fetch escalations" });
  }
});

/**
 * GET /api/dashboard/governance
 * Returns governance events with stats
 */
router.get("/governance", async (req, res) => {
  try {
    const events = await prisma.governanceEvent.findMany({
      include: {
        agent: {
          select: {
            id: true,
            role: true,
            specialization: true,
          },
        },
        task: {
          select: {
            id: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    // Calculate stats
    const stats = {
      promotions: events.filter((e) => e.action === "PROMOTE").length,
      demotions: events.filter((e) => e.action === "DEMOTE").length,
      terminations: events.filter((e) => e.action === "TERMINATE").length,
      warnings: events.filter((e) => e.action === "WARNING").length,
      flags: events.filter((e) => e.action === "FLAG").length,
    };

    res.json({ events, stats });
  } catch (error) {
    console.error("[Dashboard API] Error fetching governance events:", error);
    res.status(500).json({ error: "Failed to fetch governance events" });
  }
});

/**
 * GET /api/dashboard/trace/:taskId
 * Returns complete trace log for a task
 */
router.get("/trace/:taskId", async (req, res) => {
  try {
    const { taskId } = req.params;

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        module: {
          select: {
            name: true,
            project: {
              select: { name: true },
            },
          },
        },
        assignedToAgent: {
          select: {
            id: true,
            role: true,
          },
        },
      },
    });

    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    const traces = await prisma.trace.findMany({
      where: { taskId },
      orderBy: { createdAt: "asc" },
    });

    // Calculate timeline
    const firstTrace = traces[0];
    const lastTrace = traces[traces.length - 1];
    const timeline =
      firstTrace && lastTrace
        ? {
            assigned: firstTrace.createdAt,
            started: firstTrace.createdAt,
            completed: lastTrace.createdAt,
            duration:
              lastTrace.createdAt.getTime() - firstTrace.createdAt.getTime(),
          }
        : null;

    res.json({ task, traces, timeline });
  } catch (error) {
    console.error("[Dashboard API] Error fetching trace:", error);
    res.status(500).json({ error: "Failed to fetch trace" });
  }
});

/**
 * GET /api/dashboard/metrics
 * Returns system-wide metrics
 */
router.get("/metrics", async (req, res) => {
  try {
    // Agent metrics
    const agents = await prisma.agent.findMany({
      select: {
        status: true,
        score: true,
        successCount: true,
        failCount: true,
      },
    });

    const agentStats = {
      total: agents.length,
      active: agents.filter((a) => a.status === "BUSY").length,
      idle: agents.filter((a) => a.status === "IDLE").length,
      offline: agents.filter((a) => a.status === "OFFLINE").length,
    };

    // Task metrics
    const tasks = await prisma.task.findMany({
      select: { status: true },
    });

    const taskStats = {
      total: tasks.length,
      completed: tasks.filter((t) => t.status === "COMPLETED").length,
      failed: tasks.filter((t) => t.status === "FAILED").length,
      blocked: tasks.filter((t) => t.status === "BLOCKED").length,
    };

    // Performance metrics
    const avgScore =
      agents.length > 0
        ? agents.reduce((sum, a) => sum + a.score, 0) / agents.length
        : 0;

    const totalSuccess = agents.reduce((sum, a) => sum + a.successCount, 0);
    const totalFail = agents.reduce((sum, a) => sum + a.failCount, 0);
    const avgSuccessRate =
      totalSuccess + totalFail > 0
        ? (totalSuccess / (totalSuccess + totalFail)) * 100
        : 0;

    // Cost metrics (from TaskMetrics)
    const taskMetrics = await prisma.taskMetrics.findMany({
      select: { costUsd: true },
    });

    const totalCost = taskMetrics.reduce((sum, m) => sum + (m.costUsd || 0), 0);

    res.json({
      agents: agentStats,
      tasks: taskStats,
      performance: {
        avgScore: parseFloat(avgScore.toFixed(2)),
        avgSuccessRate: parseFloat(avgSuccessRate.toFixed(2)),
        totalCost: parseFloat(totalCost.toFixed(4)),
      },
    });
  } catch (error) {
    console.error("[Dashboard API] Error fetching metrics:", error);
    res.status(500).json({ error: "Failed to fetch metrics" });
  }
});

/**
 * GET /api/dashboard/projects
 * Returns all projects with their workspace info
 */
router.get("/projects", async (req, res) => {
  try {
    const projects = await prisma.project.findMany({
      select: {
        id: true,
        name: true,
        clientName: true,
        status: true,
        workspacePath: true,
        devPort: true,
        previewStatus: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(projects);
  } catch (error) {
    console.error("[Dashboard API] Error fetching projects:", error);
    res.status(500).json({ error: "Failed to fetch projects" });
  }
});

/**
 * GET /api/dashboard/team-progress
 * Returns detailed progress for each agent with their current/completed/incomplete tasks
 * This is what the TeamLead uses to monitor the team
 */
router.get("/team-progress", async (req, res) => {
  try {
    const { projectId } = req.query;

    // Get all agents (optionally filtered by project)
    const agents = await prisma.agent.findMany({
      where: projectId ? { id: { startsWith: `proj_${projectId}` } } : {},
      select: {
        id: true,
        role: true,
        status: true,
        score: true,
        successCount: true,
        failCount: true,
        currentTaskId: true,
        lastActiveAt: true,
      },
    });

    // Get all tasks with agent assignments
    const tasks = await prisma.task.findMany({
      where: projectId ? { module: { projectId: projectId as string } } : {},
      select: {
        id: true,
        title: true,
        status: true,
        requiredRole: true,
        assignedToAgentId: true,
        createdAt: true,
        updatedAt: true,
        reviewDecision: true,
        retryCount: true,
      },
    });

    // Build agent progress map
    const agentProgress = agents.map((agent) => {
      const agentTasks = tasks.filter((t) => t.assignedToAgentId === agent.id);

      const currentTask = agentTasks.find((t) =>
        ["ASSIGNED", "IN_PROGRESS"].includes(t.status)
      );

      const completedTasks = agentTasks.filter((t) => t.status === "COMPLETED");
      const incompleteTasks = agentTasks.filter((t) =>
        ["IN_REVIEW", "IN_QA", "NEEDS_REVISION", "BLOCKED", "FAILED"].includes(
          t.status
        )
      );
      const queuedTasks = agentTasks.filter((t) => t.status === "QUEUED");

      return {
        agent: {
          id: agent.id,
          role: agent.role,
          status: agent.status,
          score: agent.score,
          successRate:
            agent.successCount + agent.failCount > 0
              ? Math.round(
                  (agent.successCount /
                    (agent.successCount + agent.failCount)) *
                    100
                )
              : 100,
          lastActive: agent.lastActiveAt,
        },
        currentTask: currentTask
          ? {
              id: currentTask.id,
              title: currentTask.title,
              status: currentTask.status,
              startedAt: currentTask.updatedAt,
            }
          : null,
        stats: {
          completed: completedTasks.length,
          incomplete: incompleteTasks.length,
          queued: queuedTasks.length,
          total: agentTasks.length,
        },
        incompleteTasks: incompleteTasks.map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          reviewDecision: t.reviewDecision,
          retryCount: t.retryCount,
        })),
      };
    });

    // Summary stats
    const summary = {
      totalAgents: agents.length,
      busyAgents: agents.filter((a) => a.status === "BUSY").length,
      idleAgents: agents.filter((a) => a.status === "IDLE").length,
      totalTasks: tasks.length,
      completedTasks: tasks.filter((t) => t.status === "COMPLETED").length,
      inProgressTasks: tasks.filter((t) =>
        ["ASSIGNED", "IN_PROGRESS"].includes(t.status)
      ).length,
      blockedTasks: tasks.filter((t) =>
        ["BLOCKED", "FAILED", "WAR_ROOM"].includes(t.status)
      ).length,
      completionRate:
        tasks.length > 0
          ? Math.round(
              (tasks.filter((t) => t.status === "COMPLETED").length /
                tasks.length) *
                100
            )
          : 0,
    };

    res.json({
      summary,
      agents: agentProgress,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Dashboard API] Error fetching team progress:", error);
    res.status(500).json({ error: "Failed to fetch team progress" });
  }
});

/**
 * POST /api/dashboard/agents/:agentId/terminate
 * Manually terminate an agent
 */
router.post("/agents/:agentId/terminate", async (req, res) => {
  try {
    const { agentId } = req.params;
    const { reason } = req.body;

    const agent = await prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }

    // Apply termination via governance system
    await applyGovernanceDecision(agentId, {
      action: "TERMINATE",
      reason: reason || "Manual termination by admin",
      previousRole: agent.role,
    });

    const updatedAgent = await prisma.agent.findUnique({
      where: { id: agentId },
    });
    emitAgentUpdate(updatedAgent);
    emitLog(
      `[Admin] Manually terminated agent ${agentId}: ${
        reason || "No reason provided"
      }`
    );

    res.json({ success: true, agent: updatedAgent });
  } catch (error) {
    console.error("[Dashboard API] Error terminating agent:", error);
    res.status(500).json({ error: "Failed to terminate agent" });
  }
});

/**
 * POST /api/dashboard/agents/:agentId/promote
 * Manually promote an agent to next role
 */
router.post("/agents/:agentId/promote", async (req, res) => {
  try {
    const { agentId } = req.params;
    const { newRole, reason } = req.body;

    const agent = await prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }

    // Determine new role if not specified
    const roleHierarchy: Record<string, string> = {
      JuniorDev: "MidDev",
      MidDev: "SeniorDev",
      QA: "SeniorQA",
    };
    const targetRole = newRole || roleHierarchy[agent.role];

    if (!targetRole) {
      return res
        .status(400)
        .json({ error: "Agent cannot be promoted further" });
    }

    // Apply promotion via governance system
    await applyGovernanceDecision(agentId, {
      action: "PROMOTE",
      reason: reason || "Manual promotion by admin",
      previousRole: agent.role,
      newRole: targetRole,
    });

    const updatedAgent = await prisma.agent.findUnique({
      where: { id: agentId },
    });
    emitAgentUpdate(updatedAgent);
    emitLog(
      `[Admin] Manually promoted agent ${agentId}: ${agent.role} → ${targetRole}`
    );

    res.json({ success: true, agent: updatedAgent });
  } catch (error) {
    console.error("[Dashboard API] Error promoting agent:", error);
    res.status(500).json({ error: "Failed to promote agent" });
  }
});

/**
 * POST /api/dashboard/agents/:agentId/demote
 * Manually demote an agent to previous role
 */
router.post("/agents/:agentId/demote", async (req, res) => {
  try {
    const { agentId } = req.params;
    const { newRole, reason } = req.body;

    const agent = await prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }

    // Determine new role if not specified
    const demotionMap: Record<string, string> = {
      SeniorDev: "MidDev",
      MidDev: "JuniorDev",
      SeniorQA: "QA",
    };
    const targetRole = newRole || demotionMap[agent.role];

    if (!targetRole) {
      return res.status(400).json({ error: "Agent cannot be demoted further" });
    }

    // Apply demotion via governance system
    await applyGovernanceDecision(agentId, {
      action: "DEMOTE",
      reason: reason || "Manual demotion by admin",
      previousRole: agent.role,
      newRole: targetRole,
    });

    const updatedAgent = await prisma.agent.findUnique({
      where: { id: agentId },
    });
    emitAgentUpdate(updatedAgent);
    emitLog(
      `[Admin] Manually demoted agent ${agentId}: ${agent.role} → ${targetRole}`
    );

    res.json({ success: true, agent: updatedAgent });
  } catch (error) {
    console.error("[Dashboard API] Error demoting agent:", error);
    res.status(500).json({ error: "Failed to demote agent" });
  }
});

/**
 * POST /api/dashboard/agents/:agentId/revive
 * Revive a terminated/offline agent
 */
router.post("/agents/:agentId/revive", async (req, res) => {
  try {
    const { agentId } = req.params;

    const agent = await prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }

    if (agent.status !== "OFFLINE") {
      return res.status(400).json({ error: "Agent is not offline/terminated" });
    }

    // Reset agent to IDLE with clean slate
    const updatedAgent = await prisma.agent.update({
      where: { id: agentId },
      data: {
        status: "IDLE",
        score: 50, // Reset to neutral score
        failCount: 0,
        successCount: 0,
        riskLevel: "LOW",
      },
    });

    // Log governance event
    await prisma.governanceEvent.create({
      data: {
        agentId,
        action: "REVIVE" as any,
        reason: "Manual revival by admin",
        previousRole: agent.role,
        newRole: agent.role,
      },
    });

    emitAgentUpdate(updatedAgent);
    emitLog(`[Admin] Revived agent ${agentId} - reset to IDLE with score 50`);

    res.json({ success: true, agent: updatedAgent });
  } catch (error) {
    console.error("[Dashboard API] Error reviving agent:", error);
    res.status(500).json({ error: "Failed to revive agent" });
  }
});

export default router;
