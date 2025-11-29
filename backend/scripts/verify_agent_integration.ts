import { sandbox } from '../src/services/sandbox';
import { workspaceManager } from '../src/services/workspaceManager';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

async function verifyIntegration() {
  const projectId = `test-integration-${uuidv4().substring(0, 8)}`;
  console.log(`🧪 Starting Integration Test for Project: ${projectId}`);

  try {
    // 1. Create Project in DB (needed for WorkspaceManager)
    const project = await prisma.project.create({
      data: {
        id: projectId,
        name: projectId,
        description: 'Integration Test',
        status: 'ACTIVE',
        ownerId: 'test-user',
        organizationId: 'test-org'
      }
    });

    // 2. Initialize Workspace
    console.log('Initializing workspace...');
    const workspacePath = await workspaceManager.initializeWorkspace(projectId, projectId);
    console.log(`✅ Workspace created at: ${workspacePath}`);

    // 3. Initialize Sandbox (using workspace path)
    console.log('Initializing sandbox...');
    const containerId = await sandbox.getOrCreateSession(projectId, workspacePath);
    console.log(`✅ Sandbox container: ${containerId}`);

    // 4. Write File via WorkspaceManager
    console.log('Writing file via WorkspaceManager...');
    await workspaceManager.writeFile(projectId, 'integration.txt', 'Hello from Host');

    // 5. Read File via Sandbox
    console.log('Reading file via Sandbox...');
    const result = await sandbox.exec(containerId, 'cat /workspace/integration.txt');
    console.log('Sandbox Output:', result.stdout);

    if (result.stdout === 'Hello from Host') {
      console.log('✅ Integration Successful: Host writes are visible in Sandbox');
    } else {
      console.error('❌ Integration Failed: File content mismatch');
    }

    // 6. Cleanup
    await sandbox.destroySession(containerId);
    await prisma.project.delete({ where: { id: projectId } });
    // Note: We don't delete the filesystem workspace in this test to avoid safety issues, 
    // but in a real test we might.

  } catch (error) {
    console.error('❌ Test Failed:', error);
  }
}

verifyIntegration();
