/**
 * Phase Reports API Routes
 * 
 * Endpoints for managing project phases:
 * - Create phases
 * - Start/complete phases
 * - Approve/revise phases
 * - Get phase reports
 */

import { Router, Request, Response } from "express";
import { phaseReportService } from "../services/PhaseReportService";

const router = Router();

/**
 * GET /api/projects/:id/phases
 * Get all phases for a project
 */
router.get("/:id/phases", async (req: Request, res: Response) => {
  try {
    const { id: projectId } = req.params;

    const phases = await phaseReportService.getProjectPhases(projectId);

    return res.json({ phases });
  } catch (error: any) {
    console.error("[Phases API] Error fetching phases:", error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/projects/:id/phases/initialize
 * Create default phases for a project
 */
router.post("/:id/phases/initialize", async (req: Request, res: Response) => {
  try {
    const { id: projectId } = req.params;
    const { planId } = req.body;

    await phaseReportService.createDefaultPhases(projectId, planId);

    const phases = await phaseReportService.getProjectPhases(projectId);

    return res.status(201).json({
      success: true,
      message: `Created ${phases.length} phases`,
      phases,
    });
  } catch (error: any) {
    console.error("[Phases API] Error initializing phases:", error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/projects/:id/phases/current
 * Get the current active phase
 */
router.get("/:id/phases/current", async (req: Request, res: Response) => {
  try {
    const { id: projectId } = req.params;

    const phase = await phaseReportService.getCurrentPhase(projectId);

    if (!phase) {
      return res.status(404).json({ error: "No active phase found" });
    }

    return res.json(phase);
  } catch (error: any) {
    console.error("[Phases API] Error fetching current phase:", error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/projects/:id/phases/:phaseNum/report
 * Get a specific phase report
 */
router.get("/:id/phases/:phaseNum/report", async (req: Request, res: Response) => {
  try {
    const { id: projectId, phaseNum } = req.params;

    const phases = await phaseReportService.getProjectPhases(projectId);
    const phase = phases.find(p => p.phaseNumber === parseInt(phaseNum));

    if (!phase) {
      return res.status(404).json({ error: `Phase ${phaseNum} not found` });
    }

    const report = await phaseReportService.getPhaseReport(phase.id);

    return res.json(report);
  } catch (error: any) {
    console.error("[Phases API] Error fetching phase report:", error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/projects/:id/phases/:phaseNum/start
 * Start a phase
 */
router.post("/:id/phases/:phaseNum/start", async (req: Request, res: Response) => {
  try {
    const { id: projectId, phaseNum } = req.params;

    const phases = await phaseReportService.getProjectPhases(projectId);
    const phase = phases.find(p => p.phaseNumber === parseInt(phaseNum));

    if (!phase) {
      return res.status(404).json({ error: `Phase ${phaseNum} not found` });
    }

    await phaseReportService.startPhase(phase.id);

    return res.json({
      success: true,
      message: `Phase ${phaseNum} started`,
    });
  } catch (error: any) {
    console.error("[Phases API] Error starting phase:", error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/projects/:id/phases/:phaseNum/complete
 * Mark a phase as complete
 */
router.post("/:id/phases/:phaseNum/complete", async (req: Request, res: Response) => {
  try {
    const { id: projectId, phaseNum } = req.params;
    const { summary, previewUrl, screenshots } = req.body;

    const phases = await phaseReportService.getProjectPhases(projectId);
    const phase = phases.find(p => p.phaseNumber === parseInt(phaseNum));

    if (!phase) {
      return res.status(404).json({ error: `Phase ${phaseNum} not found` });
    }

    await phaseReportService.completePhase(phase.id, summary, previewUrl, screenshots);

    return res.json({
      success: true,
      message: `Phase ${phaseNum} marked as complete, awaiting approval`,
    });
  } catch (error: any) {
    console.error("[Phases API] Error completing phase:", error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/projects/:id/phases/:phaseNum/approve
 * Approve a phase
 */
router.post("/:id/phases/:phaseNum/approve", async (req: Request, res: Response) => {
  try {
    const { id: projectId, phaseNum } = req.params;
    const { approvedBy, feedbackNotes } = req.body;

    const phases = await phaseReportService.getProjectPhases(projectId);
    const phase = phases.find(p => p.phaseNumber === parseInt(phaseNum));

    if (!phase) {
      return res.status(404).json({ error: `Phase ${phaseNum} not found` });
    }

    await phaseReportService.approvePhase(phase.id, approvedBy || "Client", feedbackNotes);

    return res.json({
      success: true,
      message: `Phase ${phaseNum} approved`,
    });
  } catch (error: any) {
    console.error("[Phases API] Error approving phase:", error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/projects/:id/phases/:phaseNum/revise
 * Request revisions for a phase
 */
router.post("/:id/phases/:phaseNum/revise", async (req: Request, res: Response) => {
  try {
    const { id: projectId, phaseNum } = req.params;
    const { feedbackNotes } = req.body;

    if (!feedbackNotes) {
      return res.status(400).json({ error: "feedbackNotes is required" });
    }

    const phases = await phaseReportService.getProjectPhases(projectId);
    const phase = phases.find(p => p.phaseNumber === parseInt(phaseNum));

    if (!phase) {
      return res.status(404).json({ error: `Phase ${phaseNum} not found` });
    }

    await phaseReportService.requestRevisions(phase.id, feedbackNotes);

    return res.json({
      success: true,
      message: `Phase ${phaseNum} marked for revision`,
    });
  } catch (error: any) {
    console.error("[Phases API] Error requesting revision:", error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/projects/:id/phases/trace
 * Trace which agent worked on a file/feature
 */
router.get("/:id/phases/trace", async (req: Request, res: Response) => {
  try {
    const { id: projectId } = req.params;
    const { file, taskTitle } = req.query;

    const activity = await phaseReportService.traceResponsibleAgent(
      projectId,
      file as string | undefined,
      taskTitle as string | undefined
    );

    return res.json({ activity });
  } catch (error: any) {
    console.error("[Phases API] Error tracing agent:", error);
    return res.status(500).json({ error: error.message });
  }
});

export default router;
