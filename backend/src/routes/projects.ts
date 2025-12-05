/**
 * Phase 8: Project Creation API
 *
 * Handles new project intake and initialization
 */

import { Router } from "express";
import { prisma } from "../lib/prisma";
import { workspaceManager } from "../services/workspaceManager";
import { planProject, planProjectSimple } from "../services/projectPlanner";
import {
  emitProjectCreated,
  emitProjectUpdate,
} from "../websocket/socketServer";

const router = Router();

/**
 * GET /api/projects
 * List all projects
 */
router.get("/", async (req, res) => {
  try {
    const projects = await prisma.project.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        clientName: true,
        description: true,
        domain: true,
        status: true,
        workspacePath: true,
        devPort: true,
        previewStatus: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json(projects);
  } catch (error: any) {
    console.error("[Projects API] Error listing projects:", error);
    res.status(500).json({ error: "Failed to list projects" });
  }
});

/**
 * POST /api/projects
 * Create a new project from user requirements
 */
router.post("/", async (req, res) => {
  try {
    const { name, clientName, description, domain } = req.body;

    // Validation
    if (!name || !clientName) {
      return res.status(400).json({
        error: "name and clientName are required",
      });
    }

    console.log(`[Projects API] Creating project: ${name}`);

    // Step 1: Create project record
    const project = await prisma.project.create({
      data: {
        name,
        clientName,
        description: description || "",
        domain: domain || "CUSTOM",
        status: "IN_PROGRESS",
      },
    });

    console.log(`[Projects API] Project created with ID: ${project.id}`);

    // Step 2: Initialize workspace (Background)
    // Don't await this - it takes too long (create-next-app) and will timeout the HTTP request
    workspaceManager
      .initializeWorkspace(project.id, project.name)
      .then(() =>
        console.log(`[Projects API] Workspace initialized for ${project.id}`)
      )
      .catch((error) =>
        console.error(`[Projects API] Workspace init failed:`, error.message)
      );

    // Step 3: Use SIMPLE planning - just build a working app!
    if (description && description.length > 10) {
      // Run simple planning in background - creates practical frontend tasks
      planProjectSimple(project.id, description, name)
        .then((result) => {
          console.log(
            `[Projects API] ✅ Simple planning complete for ${project.id}`
          );
          console.log(`  → Created ${result.taskCount} tasks`);
        })
        .catch((error) => {
          console.error(
            `[Projects API] Planning failed for ${project.id}:`,
            error
          );
        });
    }

    // Emit WebSocket event for real-time dashboard update
    emitProjectCreated({
      id: project.id,
      name: project.name,
      clientName: project.clientName,
      domain: project.domain,
      status: project.status,
      createdAt: project.createdAt,
    });

    // Return immediately
    res.status(201).json({
      success: true,
      project: {
        id: project.id,
        name: project.name,
        clientName: project.clientName,
        domain: project.domain,
        status: project.status,
      },
      message:
        "Project created! AI agents are building your app. Check the Pipeline to see progress!",
    });
  } catch (error: any) {
    console.error("[Projects API] Error creating project:", error);
    res.status(500).json({
      error: "Failed to create project",
      details: error.message,
    });
  }
});

/**
 * GET /api/projects/:id
 * Get project details with modules and tasks
 */
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        modules: {
          include: {
            tasks: {
              take: 5,
              orderBy: { createdAt: "desc" },
            },
          },
        },
      },
    });

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    res.json(project);
  } catch (error: any) {
    console.error("[Projects API] Error fetching project:", error);
    res.status(500).json({ error: "Failed to fetch project" });
  }
});

/**
 * POST /api/projects/:id/plan
 * Manually trigger planning for a project (useful for retrying failed plans)
 */
router.post("/:id/plan", async (req, res) => {
  try {
    const { id } = req.params;

    const project = await prisma.project.findUnique({
      where: { id },
      include: { modules: true },
    });

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    // Check if project already has modules
    if (project.modules.length > 0) {
      return res.status(400).json({
        error: "Project already has modules",
        moduleCount: project.modules.length,
      });
    }

    if (!project.description || project.description.length < 20) {
      return res.status(400).json({
        error: "Project description is too short for planning",
      });
    }

    console.log(
      `[Projects API] Manually triggering planning for ${project.name}...`
    );

    // Run planning with skipInterrogation=true to go straight to Architect
    planProject(
      project.id,
      project.description,
      project.domain || undefined,
      true
    )
      .then((result) => {
        console.log(`[Projects API] Planning complete for ${project.id}`);
        console.log(`  → Created ${result.modules?.length || 0} modules`);
      })
      .catch((error) => {
        console.error(
          `[Projects API] Planning failed for ${project.id}:`,
          error
        );
      });

    res.json({
      success: true,
      message:
        "Planning triggered! AI agents are creating modules and tasks...",
    });
  } catch (error: any) {
    console.error("[Projects API] Error triggering plan:", error);
    res.status(500).json({ error: "Failed to trigger planning" });
  }
});

/**
 * DELETE /api/projects/:id
 * Delete a project and all its associated data
 */
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Check if project exists
    const project = await prisma.project.findUnique({
      where: { id },
    });

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    console.log(`[Projects API] Deleting project: ${project.name} (${id})`);

    // Get all agent IDs for this project
    const projectAgents = await prisma.agent.findMany({
      where: { id: { startsWith: `proj_${id}` } },
      select: { id: true },
    });
    const agentIds = projectAgents.map((a) => a.id);

    // Get all module IDs for this project
    const projectModules = await prisma.module.findMany({
      where: { projectId: id },
      select: { id: true },
    });
    const moduleIds = projectModules.map((m) => m.id);

    // Get all task IDs for this project
    const projectTasks = await prisma.task.findMany({
      where: { moduleId: { in: moduleIds } },
      select: { id: true },
    });
    const taskIds = projectTasks.map((t) => t.id);

    // Delete in order due to foreign key constraints:
    // 1. Delete task metrics (references tasks and agents)
    // Delete by both taskId AND agentId to handle all constraints
    if (taskIds.length > 0 || agentIds.length > 0) {
      await prisma.taskMetrics.deleteMany({
        where: {
          OR: [
            ...(taskIds.length > 0 ? [{ taskId: { in: taskIds } }] : []),
            ...(agentIds.length > 0 ? [{ agentId: { in: agentIds } }] : []),
          ],
        },
      });
    }

    // 2. Delete context requests (references agents)
    if (agentIds.length > 0) {
      await prisma.contextRequest.deleteMany({
        where: {
          OR: [
            { fromAgentId: { in: agentIds } },
            { toAgentId: { in: agentIds } },
          ],
        },
      });
    }

    // 3. Delete agent performance logs (references agents)
    if (agentIds.length > 0) {
      await prisma.agentPerformanceLog.deleteMany({
        where: { agentId: { in: agentIds } },
      });
    }

    // 4. Delete governance events (references agents)
    if (agentIds.length > 0) {
      await prisma.governanceEvent.deleteMany({
        where: { agentId: { in: agentIds } },
      });
    }

    // 5. Delete tasks (they reference modules and agents)
    if (moduleIds.length > 0) {
      await prisma.task.deleteMany({
        where: { moduleId: { in: moduleIds } },
      });
    }

    // 6. Delete modules (they reference project and agents)
    await prisma.module.deleteMany({
      where: { projectId: id },
    });

    // 7. Delete agents associated with the project
    if (agentIds.length > 0) {
      await prisma.agent.deleteMany({
        where: { id: { in: agentIds } },
      });
    }

    // 8. Finally delete the project
    await prisma.project.delete({
      where: { id },
    });

    console.log(`[Projects API] ✅ Project deleted: ${project.name}`);

    res.json({
      success: true,
      message: `Project "${project.name}" has been deleted`,
    });
  } catch (error: any) {
    console.error("[Projects API] Error deleting project:", error);
    res.status(500).json({
      error: "Failed to delete project",
      details: error.message,
    });
  }
});

export default router;
