
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deleteProject() {
  const projectName = "Neon Portfolio";
  console.log(`🗑️  Deleting project: ${projectName}`);

  try {
    const project = await prisma.project.findFirst({
      where: { name: projectName }
    });

    if (!project) {
      console.log("✅ Project not found (already deleted)");
      return;
    }

    // Delete related data first
    await prisma.task.deleteMany({
      where: { module: { projectId: project.id } }
    });
    
    await prisma.module.deleteMany({
      where: { projectId: project.id }
    });

    await prisma.project.delete({
      where: { id: project.id }
    });

    console.log("✅ Project deleted successfully");
  } catch (error) {
    console.error("❌ Error deleting project:", error);
  }
}

deleteProject()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
