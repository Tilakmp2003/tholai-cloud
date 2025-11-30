
import { PrismaClient } from '@prisma/client';
import * as path from 'path';
import * as fs from 'fs';

const prisma = new PrismaClient();
const WORKSPACE_ROOT = path.resolve(__dirname, '../../../workspaces');

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

  console.log('\n✨ Workspace Repair complete.');

  // 2. Check Agents
  const agentCount = await prisma.agent.count();
  console.log(`\n🤖 Found ${agentCount} agents in database.`);
  
  if (agentCount === 0) {
    console.log('⚠️  No agents found! Seeding agents...');
    try {
      // Import and run the seed logic dynamically
      // We use exec to run the seed script to avoid import issues
      const { execSync } = require('child_process');
      console.log('  - Running seed_model_config.ts...');
      execSync('npx tsx prisma/seed_model_config.ts', { stdio: 'inherit', cwd: path.join(__dirname, '../..') });
      console.log('  - ✅ Agents seeded successfully!');
    } catch (error: any) {
      console.error('  - ❌ Failed to seed agents:', error.message);
    }
  } else {
    console.log('  - ✅ Agents are present.');
  }

  console.log('\n✨ All Repairs Finished.');
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
