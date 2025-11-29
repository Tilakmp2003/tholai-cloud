import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

export async function dispatchLoop(prisma: PrismaClient) {
  console.log(`\n[Orchestrator] Running dispatch cycle...`);

  // Fetch only a LIMITed number of queued tasks to avoid stampedes
  const queuedTasks = await prisma.task.findMany({
    where: { status: 'QUEUED' },
    take: 10, // prevent 1000 tasks from assigning at once
    orderBy: { createdAt: 'asc' }
  });

  console.log(`[Orchestrator] Found ${queuedTasks.length} queued tasks.`);

  for (const task of queuedTasks) {
    // Create a trace session for monitoring (AgentOps)
    const traceId = randomUUID();

    console.log(
      `[Dispatch] Task ${task.id} (role=${task.requiredRole}) assigned trace=${traceId}`
    );

    // -----------------------------------------------------
    // CLAIM 4: ELASTIC HIERARCHY ROUTING PROTOCOL
    // -----------------------------------------------------
    let targetRole = task.requiredRole;
    const complexity = task.complexityScore ?? 50;

    // 1. FAST TRACK (Low Complexity -> Skip Management)
    if (complexity < 20 && (targetRole === 'TeamLead' || targetRole === 'Architect')) {
      console.log(`[Dispatcher] 📉 Fast Tracking Task ${task.id} (Score: ${complexity}) -> JuniorDev`);
      targetRole = 'JuniorDev';
    }

    // 2. EXECUTIVE TRACK (High Complexity -> Escalate to Architect)
    if (complexity > 80 && (targetRole === 'JuniorDev' || targetRole === 'MidDev')) {
      console.log(`[Dispatcher] 📈 Escalating Task ${task.id} (Score: ${complexity}) -> Architect`);
      targetRole = 'Architect';
    }

    let freeAgent: any = null;

    // -----------------------------------------------------
    // SMARTER AGENTS: STICKY ASSIGNMENT
    // -----------------------------------------------------
    // Prioritize the owner agent for fixes
    if (task.status === 'NEEDS_REVISION' && (task as any).ownerAgentId) {
        const ownerAgent = await prisma.agent.findUnique({ where: { id: (task as any).ownerAgentId } });
        if (ownerAgent && ownerAgent.status === 'IDLE') {
            console.log(`[Dispatcher] 🍯 Sticky Assignment: Task ${task.id} -> Owner ${ownerAgent.id}`);
            freeAgent = ownerAgent;
        }
    }

    // Find an IDLE agent with the target role if no sticky owner found
    if (!freeAgent) {
        freeAgent = await prisma.agent.findFirst({
            where: {
                role: targetRole,
                status: 'IDLE'
            }
        });
    }

    // -----------------------------------------------------
    // CLAIM 4 UPGRADE: LOAD-AWARE PRESSURE ROUTING
    // -----------------------------------------------------
    // If no IDLE agent, check for "Executive Paralysis" (Bottleneck at the top)
    if (!freeAgent && (targetRole === 'Architect' || targetRole === 'TeamLead')) {
      const queueDepth = await prisma.task.count({
        where: { assignedToAgent: { role: targetRole }, status: 'IN_PROGRESS' }
      });

      if (queueDepth > 5) {
        console.log(`[Dispatcher] ⚠️  High Load on ${targetRole} (Queue: ${queueDepth}). Applying Backpressure...`);
        
        // Downgrade Role to maintain throughput
        const newRole = targetRole === 'Architect' ? 'TeamLead' : 'SeniorDev';
        console.log(`[Dispatcher] 📉 Downgrading Task ${task.id} -> ${newRole}`);
        
        freeAgent = await prisma.agent.findFirst({
          where: { role: newRole, status: 'IDLE' }
        });
      }
    }

    if (!freeAgent) {
      console.log(`[Dispatch] ❌ No IDLE agent available for ${targetRole}`);
      continue;
    }

    console.log(
      `[Dispatch] Assigning task ${task.id} ➝ Agent ${freeAgent.id} (${freeAgent.role})`
    );

    // Update the task with assignment + trace
    await prisma.task.update({
      where: { id: task.id },
      data: {
        status: 'ASSIGNED',
        assignedToAgentId: freeAgent.id,
        ownerAgentId: (task as any).ownerAgentId || freeAgent.id, // Set owner if not set
        traceId: traceId // NEW: track execution chain
      }
    });

    // Agent goes BUSY
    await prisma.agent.update({
      where: { id: freeAgent.id },
      data: { status: 'BUSY', currentTaskId: task.id }
    });

    // Log assignment event
    await prisma.trace.create({
      data: {
        id: traceId,
        taskId: task.id,
        agentId: freeAgent.id,
        event: "TASK_ASSIGNED",
        metadata: {
          taskId: task.id,
          agentId: freeAgent.id,
          role: freeAgent.role
        }
      }
    });

    console.log(`[Dispatch] ✅ Task ${task.id} officially dispatched`);
  }

  // ---------------------------------------------------------
  // CLAIM 1: DEADLOCK DETECTION ("WAR ROOM")
  // ---------------------------------------------------------
  const deadlockedTasks = await prisma.task.findMany({
    where: {
      status: { in: ['NEEDS_REVISION', 'FAILED'] },
      retryCount: { gt: 2 },
      isDeadlocked: false
    }
  });

  if (deadlockedTasks.length > 0) {
    console.log(`[Orchestrator] 🚨 DETECTED ${deadlockedTasks.length} DEADLOCKED TASKS! Initiating War Room...`);
    
    for (const task of deadlockedTasks) {
      await prisma.task.update({
        where: { id: task.id },
        data: {
          status: 'WAR_ROOM',
          isDeadlocked: true,
          blockedReason: 'Infinite loop detected. War Room activated.'
        }
      });
      console.log(`[Orchestrator] 🔒 Task ${task.id} frozen in WAR_ROOM state.`);
    }
  }
}
