/**
 * Fix existing PLANNED modules by updating them to IN_PROGRESS
 * Run this once to fix modules that were created before the fix
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixExistingModules() {
  console.log('[Fix] Looking for PLANNED modules...');
  
  const plannedModules = await prisma.module.findMany({
    where: { status: 'PLANNED' },
    include: {
      tasks: true
    }
  });

  console.log(`[Fix] Found ${plannedModules.length} PLANNED modules`);

  for (const module of plannedModules) {
    console.log(`[Fix] Module: ${module.name}`);
    console.log(`  - Tasks: ${module.tasks.length}`);
    
    if (module.tasks.length > 0) {
      // Module has tasks, so it should be IN_PROGRESS
      await prisma.module.update({
        where: { id: module.id },
        data: { status: 'IN_PROGRESS' }
      });
      console.log(`  ✅ Updated to IN_PROGRESS`);
    } else {
      console.log(`  ⚠️  No tasks found, keeping as PLANNED`);
    }
  }

  console.log('[Fix] Done!');
  await prisma.$disconnect();
}

fixExistingModules().catch(console.error);
