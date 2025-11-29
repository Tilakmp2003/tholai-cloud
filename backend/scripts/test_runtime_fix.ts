import { runtimeMonitor } from '../src/services/runtimeMonitor';
import { sandbox } from '../src/services/sandbox';
import { workspaceManager } from '../src/services/workspaceManager';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

async function runTest() {
  const projectId = `test-runtime-${uuidv4().substring(0, 8)}`;
  console.log(`🧪 Testing Runtime Fix for Project: ${projectId}`);

  try {
    // 1. Setup Project
    await prisma.project.create({
      data: {
        id: projectId,
        name: projectId,
        clientName: 'Test Client',
        status: 'IN_PROGRESS'
      }
    });

    const workspacePath = await workspaceManager.initializeWorkspace(projectId, projectId);
    
    // 2. Write a crashing script
    await workspaceManager.writeFile(projectId, 'server.js', `
      console.log('Server started...');
      setTimeout(() => {
        console.log('Simulating crash...');
        throw new Error('Critical Runtime Failure!');
      }, 2000);
    `);

    // 3. Start Monitoring
    console.log('\n--- Starting Monitor ---');
    await runtimeMonitor.startMonitoring(projectId, 'node server.js');

    // 4. Wait for crash detection
    console.log('Waiting for crash...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // 5. Cleanup
    runtimeMonitor.stopMonitoring(projectId);
    
    // We expect to see "[RuntimeMonitor] 🚨 Detected Error..." in the logs.
    
    const containerId = await sandbox.getOrCreateSession(projectId);
    
    // Cleanup tasks, then modules, then project
    const modules = await prisma.module.findMany({ where: { projectId: projectId } });
    for (const mod of modules) {
      await prisma.task.deleteMany({ where: { moduleId: mod.id } });
    }
    await prisma.module.deleteMany({ where: { projectId: projectId } });
    await prisma.project.delete({ where: { id: projectId } });
    
    await sandbox.destroySession(containerId);

  } catch (error) {
    console.error('❌ Test Failed:', error);
  }
}

runTest();
