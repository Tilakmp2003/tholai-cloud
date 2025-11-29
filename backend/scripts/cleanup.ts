import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanup() {
  console.log('Cleaning up database...');
  
  // Delete in correct order to respect foreign key constraints
  await prisma.governanceEvent.deleteMany({});
  await prisma.agentPerformanceLog.deleteMany({});
  await prisma.taskMetrics.deleteMany({});
  await prisma.contextRequest.deleteMany({});
  await prisma.trace.deleteMany({});
  await prisma.task.deleteMany({});
  await prisma.module.deleteMany({});
  await prisma.project.deleteMany({});
  await prisma.agent.deleteMany({});

  console.log('✅ Database cleaned successfully!');
}

cleanup()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
