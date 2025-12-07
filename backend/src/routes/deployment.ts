/**
 * Deployment API Routes
 * 
 * Endpoints for deploying client projects:
 * - Deploy to preview (local dev server)
 * - Deploy to AWS Amplify (frontend)
 * - Deploy to AWS App Runner (backend)
 * - Get deployment history
 */

import { Router, Request, Response } from "express";
import { awsDeploymentService } from "../services/AWSDeploymentService";
import { prisma } from "../lib/prisma";

const router = Router();

/**
 * GET /api/projects/:id/deployments
 * Get deployment history for a project
 */
router.get("/:id/deployments", async (req: Request, res: Response) => {
  try {
    const { id: projectId } = req.params;

    const deployments = await awsDeploymentService.getDeployments(projectId);

    return res.json({ deployments });
  } catch (error: any) {
    console.error("[Deployments API] Error fetching deployments:", error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/projects/:id/deploy/preview
 * Deploy to local preview (start dev server)
 */
router.post("/:id/deploy/preview", async (req: Request, res: Response) => {
  try {
    const { id: projectId } = req.params;

    const result = await awsDeploymentService.deployPreview(projectId);

    return res.json({
      success: result.success,
      deploymentId: result.deploymentId,
      url: result.url,
      message: result.success ? "Preview deployment ready" : result.error,
    });
  } catch (error: any) {
    console.error("[Deployments API] Error deploying preview:", error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/projects/:id/deploy/frontend
 * Deploy frontend to AWS Amplify
 */
router.post("/:id/deploy/frontend", async (req: Request, res: Response) => {
  try {
    const { id: projectId } = req.params;
    const { branch } = req.body;

    if (!awsDeploymentService.isAvailable()) {
      return res.status(503).json({
        error: "AWS deployment not configured",
        message: "Please configure AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY",
      });
    }

    const result = await awsDeploymentService.deployFrontend(projectId, { branch });

    return res.json({
      success: result.success,
      deploymentId: result.deploymentId,
      url: result.url,
      message: result.success ? "Frontend deployed to Amplify" : result.error,
    });
  } catch (error: any) {
    console.error("[Deployments API] Error deploying frontend:", error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/projects/:id/deploy/backend
 * Deploy backend to AWS App Runner
 */
router.post("/:id/deploy/backend", async (req: Request, res: Response) => {
  try {
    const { id: projectId } = req.params;
    const { port, cpu, memory } = req.body;

    if (!awsDeploymentService.isAvailable()) {
      return res.status(503).json({
        error: "AWS deployment not configured",
        message: "Please configure AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY",
      });
    }

    const result = await awsDeploymentService.deployBackend(projectId, { port, cpu, memory });

    return res.json({
      success: result.success,
      deploymentId: result.deploymentId,
      url: result.url,
      message: result.success ? "Backend deployed to App Runner" : result.error,
    });
  } catch (error: any) {
    console.error("[Deployments API] Error deploying backend:", error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/projects/:id/deploy/status
 * Check if AWS deployment is available
 */
router.get("/:id/deploy/status", async (req: Request, res: Response) => {
  try {
    const { id: projectId } = req.params;

    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    return res.json({
      awsConfigured: awsDeploymentService.isAvailable(),
      hasWorkspace: !!project.workspacePath,
      previewRunning: project.previewStatus === "RUNNING",
      previewPort: project.devPort,
    });
  } catch (error: any) {
    console.error("[Deployments API] Error checking status:", error);
    return res.status(500).json({ error: error.message });
  }
});

export default router;
