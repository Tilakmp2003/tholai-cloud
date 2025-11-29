/**
 * Test Workspace System
 * Verifies workspace creation, file writing, and dev server spawn
 */

import { workspaceManager } from '../src/services/workspaceManager';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testWorkspaceSystem() {
  console.log('🧪 Testing Live Preview System...\n');
  
  try {
    // 1. Create test project
    console.log('Step 1: Creating test project...');
    const project = await prisma.project.create({
      data: {
        name: 'Test Preview App',
        clientName: 'Test Client',
        status: 'IN_PROGRESS'
      }
    });
    console.log(`   ✅ Project created: ${project.id}\n`);
    
    // 2. Initialize workspace
    console.log('Step 2: Initializing workspace...');
    const workspacePath = await workspaceManager.initializeWorkspace(
      project.id,
      project.name
    );
    console.log(`   ✅ Workspace created at: ${workspacePath}\n`);
    
    // 3. Write a test file
    console.log('Step 3: Writing test file...');
    const testCode = `
export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-600 to-blue-500">
      <div className="text-center text-white">
        <h1 className="text-6xl font-bold mb-4">🚀 AI Generated!</h1>
        <p className="text-2xl">This app was built by autonomous AI agents</p>
      </div>
    </main>
  );
}
`.trim();
    
    await workspaceManager.writeFile(project.id, 'app/page.tsx', testCode);
    console.log(`   ✅ File written: app/page.tsx\n`);
    
    // 4. Start preview server
    console.log('Step 4: Starting dev server...');
    const port = await workspaceManager.startPreview(project.id);
    console.log(`   ✅ Dev server started on http://localhost:${port}\n`);
    
    console.log('⏳ Waiting 30 seconds for Next.js to compile...');
    await new Promise(resolve => setTimeout(resolve, 30000));
    
    // 5. Check status
    console.log('\nStep 5: Checking preview status...');
    const status = await workspaceManager.getPreviewStatus(project.id);
    console.log('   Status:', JSON.stringify(status, null, 2));
    
    console.log(`\n✅ TEST PASSED!`);
    console.log(`\n📱 Open your browser:`);
    console.log(`   http://localhost:${port}`);
    console.log(`\n🎉 You should see a purple gradient page saying "AI Generated!"`);
    console.log(`\n⚠️  Note: Press Ctrl+C to stop the dev server when done`);
    
  } catch (error: any) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error(error);
    process.exit(1);
  }
}

testWorkspaceSystem()
  .catch(console.error)
  .finally(() => {
    // Don't disconnect - keep server running
    console.log('\n💡 Keep this running to test the preview!');
  });
