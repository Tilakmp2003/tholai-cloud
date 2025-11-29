
import { PrismaClient, TaskStatus } from '@prisma/client';
import { runDesignerAgentOnce } from '../agents/designerAgent';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting Designer Agent Test...');

  // Enable Mock Mode
  process.env.USE_MOCK_LLM = 'true';

  // 1. Cleanup
  await prisma.task.deleteMany({ where: { title: 'Test Design Task' } });
  await prisma.module.deleteMany({ where: { name: 'Test Design Module' } });
  await prisma.project.deleteMany({ where: { name: 'Test Design Project' } });

  // 2. Setup Data
  const project = await prisma.project.create({
    data: {
      name: 'Test Design Project',
      clientName: 'Test Client',
      status: 'PLANNED'
    }
  });

  const module = await prisma.module.create({
    data: {
      name: 'Test Design Module',
      projectId: project.id,
      status: 'PLANNED'
    }
  });

  const task = await prisma.task.create({
    data: {
      title: 'Test Design Task',
      moduleId: module.id,
      requiredRole: 'DESIGNER',
      status: 'QUEUED',
      contextPacket: {
        designBrief: {
          goal: "Create a modern dashboard",
          targetAudience: "Enterprise users"
        }
      }
    }
  });

  console.log(`Created Task: ${task.id} (${task.status})`);

  // 3. Run Agent
  console.log('Running Designer Agent...');
  const result = await runDesignerAgentOnce();

  // 4. Verify
  if (!result) {
    console.error('❌ Agent did not pick up the task.');
    process.exit(1);
  }

  const updatedTask = await prisma.task.findUnique({
    where: { id: task.id }
  });

  console.log(`Updated Task Status: ${updatedTask?.status}`);
  const outputArtifact = (updatedTask as any)?.outputArtifact;
  console.log(`Output Artifact: ${outputArtifact?.substring(0, 100)}...`);

  if (updatedTask?.status === 'COMPLETED' || updatedTask?.status === 'IN_REVIEW') {
    console.log('✅ Test Passed: Task processed successfully.');
  } else {
    console.error('❌ Test Failed: Task status incorrect.');
    process.exit(1);
  }

  // Verify DesignPackage creation
  const designPackage = await (prisma as any).designPackage.findFirst({
    where: { projectId: project.id }
  });

  if (designPackage) {
    console.log('✅ DesignPackage created:', designPackage.id);
  } else {
    console.error('❌ DesignPackage not found.');
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
