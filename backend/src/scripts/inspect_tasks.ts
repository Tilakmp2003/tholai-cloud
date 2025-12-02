
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tasks = await prisma.task.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: {
      traces: {
        take: 1,
        orderBy: { createdAt: 'desc' }
      }
    }
  });

  console.log(JSON.stringify(tasks, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
