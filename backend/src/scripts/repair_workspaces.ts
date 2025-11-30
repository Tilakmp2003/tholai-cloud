
import { PrismaClient } from '@prisma/client';
import * as path from 'path';
import * as fs from 'fs';

const prisma = new PrismaClient();
const WORKSPACE_ROOT = path.resolve(__dirname, '../../../../workspaces');

async function main() {
  console.log('🔧 Starting Workspace Repair Tool...');
  console.log(`📂 Workspace Root: ${WORKSPACE_ROOT}`);

  // 1. Get all projects
  const projects = await prisma.project.findMany();
  console.log(`📊 Found ${projects.length} projects in database.`);

  for (const project of projects) {
    console.log(`\nChecking Project: ${project.name} (${project.id})`);
    
    // Calculate expected path
    const safeName = project.name
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/^-|-$/g, '');
    
    const expectedPath = path.join(WORKSPACE_ROOT, safeName);
    
    // Check if path exists on disk
    const exists = fs.existsSync(expectedPath);
    console.log(`  - Expected Path: ${expectedPath}`);
    console.log(`  - Exists on Disk: ${exists ? '✅ YES' : '❌ NO'}`);
    console.log(`  - Current DB Path: ${project.workspacePath || 'NULL'}`);

    if (exists) {
      if (!project.workspacePath || project.workspacePath !== expectedPath) {
        console.log(`  - 🛠️  FIXING database record...`);
        await prisma.project.update({
          where: { id: project.id },
          data: { 
            workspacePath: expectedPath,
            previewStatus: 'READY'
          }
        });
        console.log(`  - ✅ Fixed!`);
      } else {
        console.log(`  - ✅ DB record matches disk.`);
      }
    } else {
      console.log(`  - ⚠️  Folder missing. Cannot fix automatically.`);
    }
  }

  console.log('\n✨ Repair complete.');
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
