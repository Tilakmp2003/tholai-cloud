import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tasks = await prisma.task.findMany({
    include: { module: { include: { project: true } } }
  });
  console.log(`Found ${tasks.length} tasks:`);
  tasks.forEach(t => console.log(`- [${t.status}] ${t.title} (Project: ${t.module.project.name})`));
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
