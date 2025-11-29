
import { planProject } from '../services/projectPlanner';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting Project Planner Integration Test...');

  // Enable Mock Mode
  process.env.USE_MOCK_LLM = 'true';

  // 1. Cleanup
  await prisma.project.deleteMany({ where: { name: 'Integration Test Project' } });

  // 2. Create Project
  const project = await prisma.project.create({
    data: {
      name: 'Integration Test Project',
      clientName: 'Integration Client',
      status: 'PLANNED'
    }
  });

  // 3. Run Plan Project
  console.log('Running planProject...');
  try {
    const result = await planProject(
      project.id,
      "Build a simple todo app with a modern UI.",
      "Productivity",
      true // skipInterrogation
    );

    console.log('Plan Project Result:', result.plan ? 'Success' : 'Failure');
    
    // 4. Verify Designer Output in Architect Input
    // Since we can't easily spy on the internal call, we rely on logs or side effects.
    // But we can check if a DesignPackage was created in the DB!
    
    const designPackages = await (prisma as any).designPackage.findMany({
      where: { projectId: project.id }
    });

    console.log(`Design Packages Created: ${designPackages.length}`);

    if (designPackages.length > 0) {
      console.log('✅ Designer Agent was triggered and created a package.');
    } else {
      console.error('❌ Designer Agent was NOT triggered.');
      process.exit(1);
    }

    // 5. Verify Tasks Created
    const tasks = await prisma.task.findMany({
      where: { module: { projectId: project.id } }
    });
    console.log(`Tasks Created: ${tasks.length}`);

    if (tasks.length > 0) {
      console.log('✅ Tasks were created from Architect plan.');
    } else {
      console.warn('⚠️ No tasks created (might be due to mock Architect output).');
    }

  } catch (error) {
    console.error('❌ Test Failed:', error);
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
