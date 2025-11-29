import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface BugReport {
  bugId: string;
  taskId: string;
  severity: string;
  confidence: number;
  suggestedPatch?: string;
}

export const confidenceRouter = {
  /**
   * Route a task based on QA confidence score
   */
  async routeByConfidence(report: {
    bugId: string;
    taskId: string;
    severity: string;
    confidence: number;
    suggestedPatch: string;
  }) {
    console.log(`[Router] Routing Bug ${report.bugId} (Confidence: ${report.confidence})`);

    // 1. High Confidence (> 0.9) -> Auto-Verify
    if (report.confidence > 0.9) {
      console.log(`[Router] 🚀 High Confidence! Routing to Auto-Verify.`);
      await prisma.task.update({
        where: { id: report.taskId },
        data: {
          status: 'PENDING_TESTS', // Mapped from AUTO_VERIFY_PENDING
          assignedToAgentId: 'qa_auto_fixer',
          contextPacket: {
            patch: report.suggestedPatch,
            instruction: "Apply patch and run verification tests immediately."
          }
        }
      });
      return;
    }

    // 2. Medium Confidence (0.5 - 0.9) -> Team Lead Review
    if (report.confidence > 0.5) {
      console.log(`[Router] ⚠️ Medium Confidence. Routing to Team Lead.`);
      await prisma.task.update({
        where: { id: report.taskId },
        data: {
          status: 'IN_REVIEW', // Mapped from TEAM_LEAD_REVIEW
          assignedToAgentId: 'team_lead',
          contextPacket: {
            patch: report.suggestedPatch,
            instruction: "Review this proposed patch. It has medium confidence."
          }
        }
      });
      return;
    }

    // 3. Low Confidence (< 0.5) -> War Room
    console.log(`[Router] 🚨 Low Confidence. Escalating to War Room.`);
    await prisma.task.update({
      where: { id: report.taskId },
      data: {
        status: 'WAR_ROOM',
        assignedToAgentId: null, // Broadcast to all
        isDeadlocked: true,
        contextPacket: {
          error: "Complex bug with low confidence fix.",
          instruction: "Collaborative debugging required."
        }
      }
    });
  }
};
