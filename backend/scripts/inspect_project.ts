
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function inspectProject() {
  const projectName = "Neon Portfolio";
  console.log(`🔍 Inspecting project: ${projectName}`);

  const project = await prisma.project.findFirst({
    where: { name: projectName },
    include: {
      modules: {
        include: {
          tasks: true
        }
      }
    }
  });

  if (!project) {
    console.log("❌ Project not found!");
    return;
  }

  console.log(`✅ Project found: ${project.id} (${project.status})`);
  console.log(`📊 Modules: ${project.modules.length}`);

  project.modules.forEach(m => {
    console.log(`   - Module: ${m.name} (${m.status})`);
    console.log(`     Tasks: ${m.tasks.length}`);
    m.tasks.forEach(t => {
      console.log(`       - [${t.status}] ${t.title} (Role: ${t.requiredRole})`);
    });
  });
}

inspectProject()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
