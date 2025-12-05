import { Task, Agent } from "@prisma/client";
import { prisma } from "../lib/prisma";
import {
  emitTaskUpdate,
  emitAgentUpdate,
  emitLog,
} from "../websocket/socketServer";

export async function dispatchTasks() {
  // 1. Find all QUEUED tasks, ordered by priority (or creation time)
  // Include module to get projectId for project-aware agent assignment
  const queuedTasks = await prisma.task.findMany({
    where: { status: "QUEUED" },
    orderBy: { createdAt: "asc" },
    take: 20,
    include: { module: true },
  });

  if (queuedTasks.length === 0) {
    console.log("[TaskDispatcher] No queued tasks found.");
    return;
  }

  console.log(`[TaskDispatcher] Found ${queuedTasks.length} queued tasks.`);

  // 2. For each task, try to find an available agent (preferring same project)
  for (const task of queuedTasks) {
    await assignTaskToAgent(task);
  }
}

async function assignTaskToAgent(
  task: Task & { module?: { projectId: string } | null }
) {
  // Role mapping to handle various naming conventions
  const roleVariants: Record<string, string[]> = {
    middev: ["MidDev", "MIDDEV", "MID_DEV", "Mid_Dev", "midDev"],
    seniordev: [
      "SeniorDev",
      "SENIORDEV",
      "SENIOR_DEV",
      "Senior_Dev",
      "seniorDev",
    ],
    juniordev: [
      "JuniorDev",
      "JUNIORDEV",
      "JUNIOR_DEV",
      "Junior_Dev",
      "juniorDev",
    ],
    teamlead: ["TeamLead", "TEAMLEAD", "TEAM_LEAD", "Team_Lead", "teamLead"],
    architect: ["Architect", "ARCHITECT", "architect"],
    qa: ["QA", "Qa", "qa", "Quality", "Tester"],
    designer: ["Designer", "DESIGNER", "designer", "UI", "UX"],
    devops: ["DevOps", "DEVOPS", "Ops", "AgentOps", "AGENTOPS", "agentops"],
    canary: ["Canary", "CANARY", "canary"],
    testgenerator: [
      "TestGenerator",
      "TESTGENERATOR",
      "TEST_GENERATOR",
      "testgenerator",
    ],
    // Fallback mappings for roles that don't have dedicated agents
    frontenddev: ["MidDev", "FrontendDev"],
    backenddev: ["MidDev", "BackendDev"],
    developer: ["MidDev", "Developer"],
    techwriter: ["MidDev", "TechWriter"], // MidDev handles documentation too
  };

  // Get all possible role names for matching
  const normalizedRequired = task.requiredRole
    .toLowerCase()
    .replace(/[_\s]/g, "");
  const possibleRoles = roleVariants[normalizedRequired] || [task.requiredRole];

  // Get the project ID from the task's module
  const projectId = task.module?.projectId;

  console.log(
    `[TaskDispatcher] Looking for agent with role: "${
      task.requiredRole
    }" (normalized: "${normalizedRequired}", variants: ${possibleRoles.join(
      ", "
    )}) for project: ${projectId || "unknown"}`
  );

  // PRIORITY 1: Find an IDLE agent from the SAME PROJECT
  let agent: Agent | null = null;

  if (projectId) {
    agent = await prisma.agent.findFirst({
      where: {
        id: { startsWith: `proj_${projectId}` },
        role: { in: possibleRoles },
        status: "IDLE",
      },
    });

    if (agent) {
      console.log(`[TaskDispatcher] ✅ Found same-project agent: ${agent.id}`);
    }
  }

  // PRIORITY 2: Try any IDLE agent with the matching role
  if (!agent) {
    agent = await prisma.agent.findFirst({
      where: {
        role: { in: possibleRoles },
        status: "IDLE",
      },
    });
  }

  if (!agent) {
    // Try a broader search with case-insensitive contains (prefer same project)
    if (projectId) {
      agent = await prisma.agent.findFirst({
        where: {
          id: { startsWith: `proj_${projectId}` },
          role: {
            contains: normalizedRequired.slice(0, 4),
            mode: "insensitive",
          },
          status: "IDLE",
        },
      });
    }
    if (!agent) {
      agent = await prisma.agent.findFirst({
        where: {
          role: {
            contains: normalizedRequired.slice(0, 4),
            mode: "insensitive",
          },
          status: "IDLE",
        },
      });
    }
  }

  // FALLBACK: If still no agent, use any available MidDev for development tasks (prefer same project)
  if (!agent) {
    const devRoles = [
      "seniordev",
      "frontenddev",
      "backenddev",
      "developer",
      "techwriter",
      "devops",
    ];
    if (devRoles.includes(normalizedRequired)) {
      // First try same-project MidDev
      if (projectId) {
        agent = await prisma.agent.findFirst({
          where: {
            id: { startsWith: `proj_${projectId}` },
            role: "MidDev",
            status: "IDLE",
          },
        });
      }
      // Then try any MidDev
      if (!agent) {
        agent = await prisma.agent.findFirst({
          where: {
            role: "MidDev",
            status: "IDLE",
          },
        });
      }
      if (agent) {
        console.log(
          `[TaskDispatcher] 📌 Fallback: Using MidDev for ${task.requiredRole} task`
        );
      }
    }
  }

  if (!agent) {
    // Log available agents to help debug role mismatches
    const availableAgents = await prisma.agent.findMany({
      where: { status: "IDLE" },
      select: { id: true, role: true },
    });
    console.log(
      `[TaskDispatcher] No IDLE agent found for role "${task.requiredRole}" (Task ${task.id}). Available IDLE agents:`,
      availableAgents.map((a) => `${a.role}(${a.id})`).join(", ") || "none"
    );
    return;
  }

  // Assign the task to the found agent
  console.log(
    `[TaskDispatcher] Assigning Task ${task.id} (${task.title}) to Agent ${agent.id} (${agent.role})`
  );

  try {
    await prisma.$transaction(async (tx) => {
      // 1. Update Task
      const updatedTask = await tx.task.update({
        where: { id: task.id },
        data: {
          status: "ASSIGNED",
          assignedToAgentId: agent!.id,
        },
      });

      // 2. Update Agent
      const updatedAgent = await tx.agent.update({
        where: { id: agent!.id },
        data: {
          status: "BUSY",
          currentTaskId: task.id,
          lastActiveAt: new Date(),
        },
      });

      // 3. Emit WebSocket events for real-time UI updates
      emitTaskUpdate(updatedTask);
      emitAgentUpdate(updatedAgent);

      console.log(
        `[TaskDispatcher] ✅ Successfully assigned task ${task.id} to agent ${
          agent!.id
        }`
      );
    });
  } catch (error) {
    console.error(
      `[TaskDispatcher] ❌ Failed to assign task ${task.id} to agent ${agent.id}:`,
      error
    );
  }
}
