/**
 * Phase Report Service
 * 
 * Generates professional phase reports after each development phase.
 * Includes agent activity logs, code changes, and previews.
 */

import { prisma } from "../lib/prisma";
import { emitLog } from "../websocket/socketServer";

export interface AgentActivityEntry {
  agentId: string;
  agentRole: string;
  taskId: string;
  taskTitle: string;
  action: "STARTED" | "COMPLETED" | "FAILED" | "REVISED";
  file?: string;
  timestamp: string;
}

export class PhaseReportService {
  /**
   * Create a new phase for a project
   */
  async createPhase(
    projectId: string,
    phaseNumber: number,
    phaseName: string,
    planId?: string
  ): Promise<string> {
    const phase = await prisma.phaseReport.create({
      data: {
        projectId,
        planId,
        phaseNumber,
        phaseName,
        status: "NOT_STARTED",
      },
    });

    console.log(`[PhaseReport] Created Phase ${phaseNumber}: ${phaseName}`);
    return phase.id;
  }

  /**
   * Start a phase
   */
  async startPhase(phaseId: string): Promise<void> {
    await prisma.phaseReport.update({
      where: { id: phaseId },
      data: {
        status: "IN_PROGRESS",
        startedAt: new Date(),
      },
    });

    const phase = await prisma.phaseReport.findUnique({ where: { id: phaseId } });
    emitLog(`[System] 🚀 Starting Phase ${phase?.phaseNumber}: ${phase?.phaseName}`);
  }

  /**
   * Record agent activity in a phase
   */
  async recordAgentActivity(
    phaseId: string,
    activity: AgentActivityEntry
  ): Promise<void> {
    const phase = await prisma.phaseReport.findUnique({
      where: { id: phaseId },
    });

    if (!phase) {
      throw new Error(`Phase ${phaseId} not found`);
    }

    const existingActivity = (phase.agentActivity as AgentActivityEntry[]) || [];
    existingActivity.push(activity);

    await prisma.phaseReport.update({
      where: { id: phaseId },
      data: {
        agentActivity: existingActivity,
      },
    });
  }

  /**
   * Update phase metrics (files, tasks, etc.)
   */
  async updatePhaseMetrics(
    phaseId: string,
    metrics: {
      tasksCompleted?: number;
      tasksTotal?: number;
      filesCreated?: number;
      filesModified?: number;
      linesAdded?: number;
      linesRemoved?: number;
    }
  ): Promise<void> {
    await prisma.phaseReport.update({
      where: { id: phaseId },
      data: metrics,
    });
  }

  /**
   * Complete a phase and generate the report
   */
  async completePhase(
    phaseId: string,
    summary: string,
    previewUrl?: string,
    screenshots?: Array<{ url: string; caption: string }>
  ): Promise<void> {
    await prisma.phaseReport.update({
      where: { id: phaseId },
      data: {
        status: "PENDING_APPROVAL",
        summary,
        previewUrl,
        screenshots,
        completedAt: new Date(),
      },
    });

    const phase = await prisma.phaseReport.findUnique({ where: { id: phaseId } });
    emitLog(`[System] ✅ Phase ${phase?.phaseNumber} complete! Awaiting client review.`);
  }

  /**
   * Approve a phase
   */
  async approvePhase(phaseId: string, approvedBy: string, feedbackNotes?: string): Promise<void> {
    await prisma.phaseReport.update({
      where: { id: phaseId },
      data: {
        status: "APPROVED",
        approvedAt: new Date(),
        approvedBy,
        feedbackNotes,
      },
    });

    const phase = await prisma.phaseReport.findUnique({ where: { id: phaseId } });
    emitLog(`[System] 👍 Phase ${phase?.phaseNumber} approved by ${approvedBy}`);
  }

  /**
   * Request revisions for a phase
   */
  async requestRevisions(phaseId: string, feedbackNotes: string): Promise<void> {
    await prisma.phaseReport.update({
      where: { id: phaseId },
      data: {
        status: "NEEDS_REVISION",
        feedbackNotes,
      },
    });

    const phase = await prisma.phaseReport.findUnique({ where: { id: phaseId } });
    emitLog(`[System] 🔄 Phase ${phase?.phaseNumber} needs revisions`);
  }

  /**
   * Get all phases for a project
   */
  async getProjectPhases(projectId: string) {
    return prisma.phaseReport.findMany({
      where: { projectId },
      orderBy: { phaseNumber: "asc" },
    });
  }

  /**
   * Get a specific phase report
   */
  async getPhaseReport(phaseId: string) {
    return prisma.phaseReport.findUnique({
      where: { id: phaseId },
      include: {
        project: true,
        plan: true,
      },
    });
  }

  /**
   * Get the current active phase for a project
   */
  async getCurrentPhase(projectId: string) {
    return prisma.phaseReport.findFirst({
      where: {
        projectId,
        status: { in: ["NOT_STARTED", "IN_PROGRESS", "PENDING_APPROVAL", "NEEDS_REVISION"] },
      },
      orderBy: { phaseNumber: "asc" },
    });
  }

  /**
   * Create default phases for a project
   */
  async createDefaultPhases(projectId: string, planId?: string): Promise<void> {
    const phases = [
      { number: 1, name: "Design & Setup" },
      { number: 2, name: "Core Development" },
      { number: 3, name: "Advanced Features" },
      { number: 4, name: "Testing & QA" },
      { number: 5, name: "Deployment" },
    ];

    for (const phase of phases) {
      await this.createPhase(projectId, phase.number, phase.name, planId);
    }

    console.log(`[PhaseReport] Created ${phases.length} default phases for project`);
    emitLog(`[System] 📋 Created ${phases.length} development phases`);
  }

  /**
   * Trace which agent worked on a specific file/feature
   */
  async traceResponsibleAgent(
    projectId: string,
    file?: string,
    taskTitle?: string
  ): Promise<AgentActivityEntry[]> {
    const phases = await this.getProjectPhases(projectId);
    
    const relevantActivity: AgentActivityEntry[] = [];
    
    for (const phase of phases) {
      const activity = (phase.agentActivity as AgentActivityEntry[]) || [];
      
      for (const entry of activity) {
        if (file && entry.file === file) {
          relevantActivity.push(entry);
        } else if (taskTitle && entry.taskTitle.includes(taskTitle)) {
          relevantActivity.push(entry);
        }
      }
    }
    
    return relevantActivity;
  }
}

// Singleton instance
export const phaseReportService = new PhaseReportService();
