/**
 * Check the status of the most recently created project
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkLatestProject() {
  console.log('📊 Checking latest project status...\n');

  try {
    // Get the most recently created project
    const project = await prisma.project.findFirst({
      orderBy: { createdAt: 'desc' },
      include: {
        modules: {
          include: {
            tasks: true
          }
        }
      }
    });

    if (!project) {
      console.log('❌ No projects found');
      return;
    }

    console.log('✅ Project Found:');
    console.log(`   ID: ${project.id}`);
    console.log(`   Name: ${project.name}`);
    console.log(`   Client: ${project.clientName}`);
    console.log(`   Status: ${project.status}`);
    console.log(`   Created: ${project.createdAt}`);
    console.log(`\n📦 Modules: ${project.modules.length}`);
    
    if (project.modules.length > 0) {
      project.modules.forEach((module, i) => {
        console.log(`\n   Module ${i + 1}: ${module.name}`);
        console.log(`   Tasks: ${module.tasks.length}`);
        
        if (module.tasks.length > 0) {
          module.tasks.forEach((task, j) => {
            console.log(`      ${j + 1}. ${task.title} - ${task.status}`);
          });
        }
      });
    } else {
      console.log('   ⚠️  No modules created yet - agents may still be planning');
    }

    console.log(`\n💡 View in browser: http://localhost:4000/api/projects/${project.id}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkLatestProject();
