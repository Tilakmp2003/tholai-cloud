import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

type RejectPayload = {
  taskId: string;
  reviewerAgentId: string; // QA or TL
  failingFiles: string[];  // relative paths that failed QA
  instruction?: string;    // optional clarifying instruction
  escalateToAgentId?: string | null; // optional override to reassign to another agent
};

export async function handleQAReject(payload: RejectPayload) {
  const { taskId, reviewerAgentId, failingFiles, instruction, escalateToAgentId } = payload;
  const traceId = randomUUID();

  // Load task and current assignment
  const task = await prisma.task.findUnique({ where: { id: taskId }});
  if (!task) throw new Error(`Task ${taskId} not found`);

  // Determine who to assign to: prefer original assigned agent
  const targetAgentId = escalateToAgentId ?? task.assignedToAgentId ?? null;

  // Create repair scope
  const repairScope = {
    files: failingFiles,
    instruction: instruction ?? "Fix failing tests/issues in the listed files. Do not modify other files. Return only JSON with artifact updates and tests."
  };

  // Transaction: update task + create trace + traceStep
  await prisma.$transaction(async (tx) => {
    // Update task to reflect QA rejection and reassign
    await tx.task.update({
      where: { id: taskId },
      data: {
        status: targetAgentId ? 'ASSIGNED' : 'NEEDS_REVISION', // Use NEEDS_REVISION if no agent
        failedFiles: failingFiles,
        repairScope,
        retryCount: { increment: 1 },
        lastFailureReason: 'QA_REJECT',
        assignedToAgentId: targetAgentId,
        traceId
      }
    });

    // Create trace event (for AgentOps)
    await tx.trace.create({
      data: {
        id: traceId,
        taskId,
        agentId: reviewerAgentId,
        event: "QA_REJECT",
        metadata: {
          failingFiles,
          targetAgentId,
          instruction: repairScope.instruction
        }
      }
    });

    // If assigned back to agent, also mark agent BUSY and set currentTaskId
    if (targetAgentId) {
      await tx.agent.update({
        where: { id: targetAgentId },
        data: { status: 'BUSY', currentTaskId: taskId }
      });
    }
  });

  console.log(`[QA] 🛑 Task ${taskId} rejected. Reassigned to ${targetAgentId} with scope: ${JSON.stringify(failingFiles)}`);
}
