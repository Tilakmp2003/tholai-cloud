/**
 * Agent Spawner Service
 * Creates agents dynamically per project with proper namespacing
 */

import { PrismaClient } from '@prisma/client';
import { AgentAllocation } from './agentAllocator';
import { emitAgentUpdate } from '../websocket/socketServer';
import { getAgentConfig } from '../llm/modelRegistry';


const prisma = new PrismaClient();

// Map allocation roles to schema roles
const ROLE_MAPPING: Record<string, string> = {
  architect: 'Architect',
  teamLead: 'TeamLead',
  seniorDev: 'SeniorDev',
  midDev: 'MidDev',
  juniorDev: 'JuniorDev',
  qa: 'QA',
  security: 'SecurityAnalyst',
  ops: 'DevOps',
};

/**
 * Spawn agents for a specific project
 */
export async function spawnAgents(
  projectId: string,
  allocation: AgentAllocation
): Promise<number> {
  console.log(`[AgentSpawner] Spawning agents for project ${projectId}...`);
  
  let spawnedCount = 0;

  for (const [roleKey, count] of Object.entries(allocation)) {
    if (count === 0) continue;

    const schemaRole = ROLE_MAPPING[roleKey];
    if (!schemaRole) {
      console.warn(`[AgentSpawner] Unknown role: ${roleKey}`);
      continue;
    }

    for (let i = 1; i <= count; i++) {
      const agentId = `proj_${projectId}_${roleKey}_${i}`;
      
      try {
        const agent = await prisma.agent.create({
          data: {
            id: agentId,
            role: schemaRole,
            specialization: schemaRole, // Use role as specialization
            status: 'IDLE',
            modelConfig: await getAgentConfig(schemaRole) as any,
            lastActiveAt: new Date(),
          },
        });

        emitAgentUpdate(agent);

        spawnedCount++;
        console.log(`[AgentSpawner] Created ${agentId}`);
      } catch (error: any) {
        if (error.code === 'P2002') {
          // Agent already exists, skip
          console.log(`[AgentSpawner] Agent ${agentId} already exists, skipping`);
        } else {
          console.error(`[AgentSpawner] Failed to create ${agentId}:`, error.message);
        }
      }
    }
  }

  console.log(`[AgentSpawner] Spawned ${spawnedCount} agents for project ${projectId}`);
  return spawnedCount;
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
