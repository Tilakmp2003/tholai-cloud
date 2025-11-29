/**
 * Test project creation directly
 */

import { PrismaClient } from '@prisma/client';
import { planProject } from '../src/services/projectPlanner';

const prisma = new PrismaClient();

async function testProjectCreation() {
  console.log('\n=== Creating Test Project ===\n');

  // Create project record
  const project = await prisma.project.create({
    data: {
      name: 'TaskFlow MVP',
      clientName: 'Test Client',
      description: 'Build a modern task management application with user authentication, real-time collaboration features, task assignments, and an analytics dashboard to track team productivity.',
      domain: 'SAAS',
      status: 'IN_PROGRESS'
    }
  });

  console.log(`✓ Project created: ${project.id}`);
  console.log(`  Name: ${project.name}`);

  // Run project planning
  console.log('\n=== Running Project Planner ===\n');
  const result = await planProject(project.id, project.description!, project.domain!);

  console.log(`\n✓ Planning complete!`);
  console.log(`  Modules created: ${result.modules.length}`);

  // Check tasks
  const tasksCreated = await prisma.task.findMany({
    where: { module: { projectId: project.id } },
    include: { module: true }
  });

  console.log(`\n=== Results ===`);
  console.log(`Total tasks created: ${tasksCreated.length}`);
  console.log(`\nTasks by module:`);

  const tasksByModule = tasksCreated.reduce((acc, task) => {
    const moduleName = task.module.name;
    if (!acc[moduleName]) acc[moduleName] = [];
    acc[moduleName].push(task);
    return acc;
  }, {} as Record<string, typeof tasksCreated>);

  for (const [moduleName, tasks] of Object.entries(tasksByModule)) {
    console.log(`\n  ${moduleName} (${tasks[0].module.status}):`);
    tasks.forEach(task => {
      console.log(`    - ${task.title} [${task.status}]`);
    });
  }

  await prisma.$disconnect();
}

testProjectCreation().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
