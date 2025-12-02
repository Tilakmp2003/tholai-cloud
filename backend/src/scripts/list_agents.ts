import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const agents = await prisma.agent.findMany();
  console.log(`Found ${agents.length} agents:`);
  agents.forEach(a => console.log(`- ${a.id} (${a.role}) [${a.status}]`));
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
