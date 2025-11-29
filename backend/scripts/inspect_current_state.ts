/**
 * Inspect current state of projects, modules, tasks, and agents
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function inspect() {
  console.log('\n=== PROJECTS ===');
  const projects = await prisma.project.findMany({
    include: {
      modules: {
        include: {
          tasks: true
        }
      }
    }
  });

  for (const project of projects) {
    console.log(`\nProject: ${project.name} (${project.status})`);
    console.log(`  Modules: ${project.modules.length}`);
    
    for (const module of project.modules) {
      console.log(`    - ${module.name} (${module.status}): ${module.tasks.length} tasks`);
      
      for (const task of module.tasks) {
        console.log(`      • ${task.title} [${task.status}] (${task.requiredRole})`);
      }
    }
  }

  console.log('\n=== AGENTS ===');
  const agents = await prisma.agent.findMany();
  console.log(`Total agents: ${agents.length}`);
  
  const byStatus = agents.reduce((acc, a) => {
    acc[a.status] = (acc[a.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  console.log('By status:', byStatus);

  console.log('\n=== TASKS SUMMARY ===');
  const allTasks = await prisma.task.findMany();
  const tasksByStatus = allTasks.reduce((acc, t) => {
    acc[t.status] = (acc[t.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  console.log('Total tasks:', allTasks.length);
  console.log('By status:', tasksByStatus);

  await prisma.$disconnect();
}

inspect().catch(console.error);
