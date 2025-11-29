import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function listProjects() {
  const projects = await prisma.project.findMany({
    select: {
      id: true,
      name: true,
      status: true,
    },
    orderBy: {
      createdAt: 'desc'
    },
    take: 10
  });

  console.log('📊 Projects in database:');
  console.log(JSON.stringify(projects, null, 2));
  
  await prisma.$disconnect();
}

listProjects();
