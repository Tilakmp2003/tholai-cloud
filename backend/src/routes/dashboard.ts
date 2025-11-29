/**
 * Phase 5: Dashboard API Routes
 * 
 * Provides real-time data for the observability dashboard
 */

import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

/**
 * GET /api/dashboard/agents
 * Returns all agents with current status and metrics
 */
router.get('/agents', async (req, res) => {
  try {
    const agents = await prisma.agent.findMany({
      orderBy: { score: 'desc' },
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
        updatedAt: true
      }
    });

    res.json({ agents });
  } catch (error) {
    console.error('[Dashboard API] Error fetching agents:', error);
    res.status(500).json({ error: 'Failed to fetch agents' });
  }
});

/**
 * GET /api/dashboard/tasks
 * Returns tasks grouped by status
 */
router.get('/tasks', async (req, res) => {
  try {
    const tasks = await prisma.task.findMany({
      include: {
        module: {
          select: {
            name: true,
            project: {
              select: { name: true }
            }
          }
        },
        assignedToAgent: {
          select: {
            id: true,
            role: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 200 // Limit for performance
    });

    // Group by status
    const grouped = {
      queued: tasks.filter(t => t.status === 'QUEUED'),
      assigned: tasks.filter(t => t.status === 'ASSIGNED'),
      inProgress: tasks.filter(t => t.status === 'IN_PROGRESS'),
      inReview: tasks.filter(t => t.status === 'IN_REVIEW'),
      inQA: tasks.filter(t => t.status === 'IN_QA'),
      needsRevision: tasks.filter(t => t.status === 'NEEDS_REVISION'),
      blocked: tasks.filter(t => t.status === 'BLOCKED'),
      completed: tasks.filter(t => t.status === 'COMPLETED'),
      failed: tasks.filter(t => t.status === 'FAILED')
    };

    // Calculate stats
    const completed = grouped.completed.length;
    const total = tasks.length;
    const completionRate = total > 0 ? (completed / total) * 100 : 0;

    res.json({
      ...grouped,
      stats: {
        total,
        completionRate: parseFloat(completionRate.toFixed(2)),
        avgDuration: 0 // TODO: Calculate from trace data
      }
    });
  } catch (error) {
    console.error('[Dashboard API] Error fetching tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

/**
 * GET /api/dashboard/escalations
 * Returns context requests with details
 */
router.get('/escalations', async (req, res) => {
  try {
    const escalations = await prisma.contextRequest.findMany({
      include: {
        task: {
          select: {
            id: true,
            contextPacket: true,
            module: {
              select: { name: true }
            }
          }
        },
        fromAgent: {
          select: {
            id: true,
            role: true
          }
        },
        toAgent: {
          select: {
            id: true,
            role: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    const open = escalations.filter(e => e.status === 'OPEN');
    const resolved = escalations.filter(e => e.status === 'RESOLVED');

    // Calculate avg resolution time
    const resolvedWithTimes = resolved.filter(e => e.resolvedAt);
    const avgResolutionTime = resolvedWithTimes.length > 0
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
        avgResolutionTime: Math.round(avgResolutionTime / 1000) // Convert to seconds
      }
    });
  } catch (error) {
    console.error('[Dashboard API] Error fetching escalations:', error);
    res.status(500).json({ error: 'Failed to fetch escalations' });
  }
});

/**
 * GET /api/dashboard/governance
 * Returns governance events with stats
 */
router.get('/governance', async (req, res) => {
  try {
    const events = await prisma.governanceEvent.findMany({
      include: {
        agent: {
          select: {
            id: true,
            role: true,
            specialization: true
          }
        },
        task: {
          select: {
            id: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    // Calculate stats
    const stats = {
      promotions: events.filter(e => e.action === 'PROMOTE').length,
      demotions: events.filter(e => e.action === 'DEMOTE').length,
      terminations: events.filter(e => e.action === 'TERMINATE').length,
      warnings: events.filter(e => e.action === 'WARNING').length,
      flags: events.filter(e => e.action === 'FLAG').length
    };

    res.json({ events, stats });
  } catch (error) {
    console.error('[Dashboard API] Error fetching governance events:', error);
    res.status(500).json({ error: 'Failed to fetch governance events' });
  }
});

/**
 * GET /api/dashboard/trace/:taskId
 * Returns complete trace log for a task
 */
router.get('/trace/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        module: {
          select: {
            name: true,
            project: {
              select: { name: true }
            }
          }
        },
        assignedToAgent: {
          select: {
            id: true,
            role: true
          }
        }
      }
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const traces = await prisma.trace.findMany({
      where: { taskId },
      orderBy: { createdAt: 'asc' }
    });

    // Calculate timeline
    const firstTrace = traces[0];
    const lastTrace = traces[traces.length - 1];
    const timeline = firstTrace && lastTrace ? {
      assigned: firstTrace.createdAt,
      started: firstTrace.createdAt,
      completed: lastTrace.createdAt,
      duration: lastTrace.createdAt.getTime() - firstTrace.createdAt.getTime()
    } : null;

    res.json({ task, traces, timeline });
  } catch (error) {
    console.error('[Dashboard API] Error fetching trace:', error);
    res.status(500).json({ error: 'Failed to fetch trace' });
  }
});

/**
 * GET /api/dashboard/metrics
 * Returns system-wide metrics
 */
router.get('/metrics', async (req, res) => {
  try {
    // Agent metrics
    const agents = await prisma.agent.findMany({
      select: {
        status: true,
        score: true,
        successCount: true,
        failCount: true
      }
    });

    const agentStats = {
      total: agents.length,
      active: agents.filter(a => a.status === 'BUSY').length,
      idle: agents.filter(a => a.status === 'IDLE').length,
      offline: agents.filter(a => a.status === 'OFFLINE').length
    };

    // Task metrics
    const tasks = await prisma.task.findMany({
      select: { status: true }
    });

    const taskStats = {
      total: tasks.length,
      completed: tasks.filter(t => t.status === 'COMPLETED').length,
      failed: tasks.filter(t => t.status === 'FAILED').length,
      blocked: tasks.filter(t => t.status === 'BLOCKED').length
    };

    // Performance metrics
    const avgScore = agents.length > 0
      ? agents.reduce((sum, a) => sum + a.score, 0) / agents.length
      : 0;

    const totalSuccess = agents.reduce((sum, a) => sum + a.successCount, 0);
    const totalFail = agents.reduce((sum, a) => sum + a.failCount, 0);
    const avgSuccessRate = (totalSuccess + totalFail) > 0
      ? (totalSuccess / (totalSuccess + totalFail)) * 100
      : 0;

    // Cost metrics (from TaskMetrics)
    const taskMetrics = await prisma.taskMetrics.findMany({
      select: { costUsd: true }
    });

    const totalCost = taskMetrics.reduce((sum, m) => sum + (m.costUsd || 0), 0);

    res.json({
      agents: agentStats,
      tasks: taskStats,
      performance: {
        avgScore: parseFloat(avgScore.toFixed(2)),
        avgSuccessRate: parseFloat(avgSuccessRate.toFixed(2)),
        totalCost: parseFloat(totalCost.toFixed(4))
      }
    });
  } catch (error) {
    console.error('[Dashboard API] Error fetching metrics:', error);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

/**
 * GET /api/dashboard/projects
 * Returns all projects with their workspace info
 */
router.get('/projects', async (req, res) => {
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
        updatedAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(projects);
  } catch (error) {
    console.error('[Dashboard API] Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

export default router;
