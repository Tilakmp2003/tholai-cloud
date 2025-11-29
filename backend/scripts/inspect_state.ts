import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function inspect() {
  console.log('--- AGENTS ---');
  const agents = await prisma.agent.findMany();
  console.table(agents.map(a => ({ id: a.id, role: a.role, status: a.status })));

  console.log('\n--- TASKS ---');
  const tasks = await prisma.task.findMany();
  console.table(tasks.map(t => ({ 
    id: t.id, 
    role: t.requiredRole, 
    status: t.status, 
    assignedTo: t.assignedToAgentId 
  })));
}

inspect()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
