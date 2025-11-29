
import { PrismaClient, TaskStatus } from '@prisma/client';
import { runTeamLeadAgentOnce } from '../agents/teamLeadAgent';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting Design Review Gate Test...');

  // Enable Mock Mode
  process.env.USE_MOCK_LLM = 'true';

  // 1. Cleanup
  await prisma.task.deleteMany({ where: { title: 'Test Design Review Task' } });
  await prisma.module.deleteMany({ where: { name: 'Test Design Review Module' } });
  await prisma.project.deleteMany({ where: { name: 'Test Design Review Project' } });

  // 2. Setup Data
  const project = await prisma.project.create({
    data: {
      name: 'Test Design Review Project',
      clientName: 'Test Client',
      status: 'PLANNED'
    }
  });

  const module = await prisma.module.create({
    data: {
      name: 'Test Design Review Module',
      projectId: project.id,
      status: 'PLANNED'
    }
  });

  const mockDesignPackage = {
    id: "mock-dp-1",
    recommendedDirection: "Clean",
    requiresHumanReview: true
  };

  const task = await prisma.task.create({
    data: {
      title: 'Test Design Review Task',
      moduleId: module.id,
      requiredRole: 'DESIGNER',
      status: 'IN_REVIEW',
      outputArtifact: JSON.stringify(mockDesignPackage),
      contextPacket: {
        designBrief: {
          goal: "Create a modern dashboard"
        }
      }
    }
  });

  console.log(`Created Task: ${task.id} (${task.status})`);

  // 3. Run Agent
  console.log('Running TeamLead Agent...');
  await runTeamLeadAgentOnce();

  // 4. Verify
  const updatedTask = await prisma.task.findUnique({
    where: { id: task.id }
  });

  console.log(`Updated Task Status: ${updatedTask?.status}`);
  const reviewDecision = (updatedTask as any)?.reviewDecision;
  console.log(`Review Decision: ${reviewDecision}`);

  if (updatedTask?.status === 'COMPLETED' && reviewDecision === 'APPROVE') {
    console.log('✅ Test Passed: Design Task approved and completed.');
  } else {
    console.error('❌ Test Failed: Task status or decision incorrect.');
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
