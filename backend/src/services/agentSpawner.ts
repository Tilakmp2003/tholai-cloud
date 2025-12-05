/**
 * Agent Spawner Service
 * Creates agents dynamically per project with proper namespacing
 */

import { prisma } from "../lib/prisma";
import { AgentAllocation } from "./agentAllocator";
import { emitAgentUpdate } from "../websocket/socketServer";
import { getAgentConfig } from "../llm/modelRegistry";

// Map allocation roles to schema roles (consistent casing with task requiredRole)
const ROLE_MAPPING: Record<string, string> = {
  architect: "Architect",
  teamLead: "TeamLead",
  seniorDev: "SeniorDev",
  midDev: "MidDev",
  juniorDev: "JuniorDev",
  qa: "QA",
  security: "SecurityAnalyst",
  ops: "AgentOps",
  designer: "Designer",
  canary: "Canary",
  testGenerator: "TestGenerator",
};

/**
 * Spawn agents for a specific project
 * DISABLED: Now uses global evolution pool instead of per-project agents
 * This prevents agent count from growing with each new project
 */
export async function spawnAgents(
  projectId: string,
  allocation: AgentAllocation
): Promise<number> {
  console.log(`[AgentSpawner] Project ${projectId} will use global agent pool (spawning disabled)`);
  
  // Count how many agents are available in the global pool
  const globalAgents = await prisma.agent.count({
    where: {
      id: { not: { startsWith: 'proj_' } }
    }
  });
  
  console.log(`[AgentSpawner] Global pool has ${globalAgents} agents available`);
  return 0; // No new agents spawned
}

/**
 * Get project agents
 */
export async function getProjectAgents(projectId: string) {
  return await prisma.agent.findMany({
    where: {
      id: {
        startsWith: `proj_${projectId}_`,
      },
    },
  });
}

/**
 * Count project agents
 */
export async function countProjectAgents(projectId: string): Promise<number> {
  return await prisma.agent.count({
    where: {
      id: {
        startsWith: `proj_${projectId}_`,
      },
    },
  });
}
