/**
 * Agent Cleanup Service
 * Removes project-specific agents when project completes
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Clean up all agents for a specific project
 */
export async function cleanupProjectAgents(projectId: string): Promise<number> {
  console.log(`[AgentCleanup] Cleaning up agents for project ${projectId}...`);
  
  try {
    const result = await prisma.agent.deleteMany({
      where: {
        id: {
          startsWith: `proj_${projectId}_`,
        },
      },
    });

    console.log(`[AgentCleanup] Removed ${result.count} agents from project ${projectId}`);
    return result.count;
  } catch (error: any) {
    console.error(`[AgentCleanup] Failed to cleanup agents:`, error.message);
    return 0;
  }
}

/**
 * Clean up agents from all completed projects
 */
export async function cleanupCompletedProjects(): Promise<number> {
  console.log('[AgentCleanup] Cleaning up all completed projects...');
  
  const completedProjects = await prisma.project.findMany({
    where: {
      status: 'COMPLETED',
    },
    select: { id: true },
  });

  let totalCleaned = 0;
  for (const project of completedProjects) {
    const count = await cleanupProjectAgents(project.id);
    totalCleaned += count;
  }

  console.log(`[AgentCleanup] Total agents cleaned: ${totalCleaned}`);
  return totalCleaned;
}
