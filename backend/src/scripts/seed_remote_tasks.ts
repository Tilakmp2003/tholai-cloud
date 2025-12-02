import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Connecting to DB...');
  
  // 1. Find or create a project
  let project = await prisma.project.findFirst({ where: { name: 'PipelineTest' } });
  if (!project) {
    console.log('Creating project...');
    project = await prisma.project.create({
      data: {
        name: 'PipelineTest',
        clientName: 'Internal',
        description: 'Seeded project',
        status: 'IN_PROGRESS'
      }
    });
  }

  // 2. Create a module
  let module = await prisma.module.findFirst({ where: { projectId: project.id } });
  if (!module) {
    console.log('Creating module...');
    module = await prisma.module.create({
      data: {
        projectId: project.id,
        name: 'Core Module',
        status: 'IN_PROGRESS'
      }
    });
  }

  // 3. Create tasks in various states
  console.log('Creating tasks...');
  const tasks = [
    { title: 'Implement Auth', status: 'COMPLETED', role: 'SeniorDev' },
    { title: 'Design Database', status: 'IN_PROGRESS', role: 'Architect' },
    { title: 'Setup CI/CD', status: 'QUEUED', role: 'AgentOps' },
    { title: 'Fix Login Bug', status: 'FAILED', role: 'MidDev' },
    { title: 'Review PR #123', status: 'IN_REVIEW', role: 'TeamLead' },
    { title: 'Verify Payment', status: 'IN_QA', role: 'QA' },
    { title: 'Security Audit', status: 'BLOCKED', role: 'SeniorDev' },
  ];

  for (const t of tasks) {
    await prisma.task.create({
      data: {
        moduleId: module.id,
        title: t.title,
        status: t.status as any,
        requiredRole: t.role,
        contextPacket: {
          description: `Seeded task: ${t.title}`,
          designContext: {
             note: "Seeded context for verification"
          }
        }
      }
    });
  }

  console.log('Done!');
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
