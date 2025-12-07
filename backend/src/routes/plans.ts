/**
 * Plan Management API Routes
 * 
 * Endpoints for managing project implementation plans:
 * - Generate 30-page plans
 * - Version control
 * - Approval workflow
 * - Revision requests
 */

import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { planGeneratorService } from "../services/PlanGeneratorService";

const router = Router();

/**
 * POST /api/projects/:id/plan/generate
 * Generate a new implementation plan for a project
 */
router.post("/:id/plan/generate", async (req: Request, res: Response) => {
  try {
    const { id: projectId } = req.params;

    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    const result = await planGeneratorService.generatePlan(
      projectId,
      project.description || "",
      project.clientName,
      project.name,
      project.domain || undefined
    );

    return res.status(201).json({
      success: true,
      planId: result.planId,
      version: result.version,
      message: `Implementation plan v${result.version} generated successfully`,
    });
  } catch (error: any) {
    console.error("[Plans API] Error generating plan:", error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/projects/:id/plan
 * Get the current active plan for a project
 */
router.get("/:id/plan", async (req: Request, res: Response) => {
  try {
    const { id: projectId } = req.params;

    const plan = await planGeneratorService.getCurrentPlan(projectId);

    if (!plan) {
      return res.status(404).json({ error: "No plan found for this project" });
    }

    return res.json(plan);
  } catch (error: any) {
    console.error("[Plans API] Error fetching plan:", error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/projects/:id/plan/versions
 * Get all plan versions for a project
 */
router.get("/:id/plan/versions", async (req: Request, res: Response) => {
  try {
    const { id: projectId } = req.params;

    const versions = await planGeneratorService.getPlanVersions(projectId);

    return res.json({ versions });
  } catch (error: any) {
    console.error("[Plans API] Error fetching plan versions:", error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/projects/:id/plan/approve
 * Approve the current plan
 */
router.post("/:id/plan/approve", async (req: Request, res: Response) => {
  try {
    const { id: projectId } = req.params;
    const { approvedBy } = req.body;

    const plan = await planGeneratorService.getCurrentPlan(projectId);

    if (!plan) {
      return res.status(404).json({ error: "No plan found for this project" });
    }

    await planGeneratorService.approvePlan(plan.id, approvedBy || "Client");

    return res.json({
      success: true,
      message: "Plan approved successfully",
      planId: plan.id,
    });
  } catch (error: any) {
    console.error("[Plans API] Error approving plan:", error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/projects/:id/plan/revise
 * Request a revision to the current plan
 */
router.post("/:id/plan/revise", async (req: Request, res: Response) => {
  try {
    const { id: projectId } = req.params;
    const { revisionNotes } = req.body;

    if (!revisionNotes) {
      return res.status(400).json({ error: "revisionNotes is required" });
    }

    const plan = await planGeneratorService.getCurrentPlan(projectId);

    if (!plan) {
      return res.status(404).json({ error: "No plan found for this project" });
    }

    const result = await planGeneratorService.requestRevision(plan.id, revisionNotes);

    return res.json({
      success: true,
      message: `Plan revised to v${result.newVersion}`,
      newPlanId: result.newPlanId,
      newVersion: result.newVersion,
    });
  } catch (error: any) {
    console.error("[Plans API] Error revising plan:", error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/projects/:id/plan/submit
 * Submit plan for client approval
 */
router.post("/:id/plan/submit", async (req: Request, res: Response) => {
  try {
    const { id: projectId } = req.params;

    const plan = await planGeneratorService.getCurrentPlan(projectId);

    if (!plan) {
      return res.status(404).json({ error: "No plan found for this project" });
    }

    await planGeneratorService.submitForApproval(plan.id);

    return res.json({
      success: true,
      message: "Plan submitted for client approval",
      planId: plan.id,
    });
  } catch (error: any) {
    console.error("[Plans API] Error submitting plan:", error);
    return res.status(500).json({ error: error.message });
  }
});

export default router;
