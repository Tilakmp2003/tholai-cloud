import { PrismaClient, Task, Agent } from '@prisma/client';
import { emitTaskUpdate, emitAgentUpdate } from '../websocket/socketServer';

const prisma = new PrismaClient();

export async function dispatchTasks() {
  // 1. Find all QUEUED tasks, ordered by priority (or creation time)
  const queuedTasks = await prisma.task.findMany({
    where: { status: 'QUEUED' },
    orderBy: { createdAt: 'asc' },
    take: 20 // Process in batches
  });

  if (queuedTasks.length === 0) return;

  console.log(`[TaskDispatcher] Found ${queuedTasks.length} queued tasks.`);

  // 2. For each task, try to find an available agent
  for (const task of queuedTasks) {
    await assignTaskToAgent(task);
  }
}

async function assignTaskToAgent(task: Task) {
  // Find an IDLE agent with the required role
  // We can also add logic to prefer agents who worked on this module before, etc.
  const agent = await prisma.agent.findFirst({
    where: {
      role: task.requiredRole,
      status: 'IDLE'
    }
  });

  if (!agent) {
    // No agent available for this role
    // console.log(`[TaskDispatcher] No IDLE agent found for role ${task.requiredRole} (Task ${task.id})`);
    return;
  }

  console.log(`[TaskDispatcher] Assigning Task ${task.id} (${task.title}) to Agent ${agent.id}`);

  // Transaction to ensure atomicity
  try {
    await prisma.$transaction(async (tx) => {
      // 1. Update Task
      const updatedTask = await tx.task.update({
        where: { id: task.id },
        data: {
          status: 'ASSIGNED',
          assignedToAgentId: agent.id
        }
      });

      // 2. Update Agent
      const updatedAgent = await tx.agent.update({
        where: { id: agent.id },
        data: {
          status: 'BUSY',
          currentTaskId: task.id,
          lastActiveAt: new Date()
        }
      });

      // 3. Emit events (outside transaction usually, but fine here for simplicity)
      emitTaskUpdate(updatedTask);
      emitAgentUpdate(updatedAgent);
    });
  } catch (error) {
    console.error(`[TaskDispatcher] Failed to assign task ${task.id} to agent ${agent.id}:`, error);
  }
}
