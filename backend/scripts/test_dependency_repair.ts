import { dependencyRepair } from '../src/services/dependencyRepair';
import { sandbox } from '../src/services/sandbox';
import { workspaceManager } from '../src/services/workspaceManager';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

async function runTest() {
  const projectId = `test-dep-${uuidv4().substring(0, 8)}`;
  console.log(`🧪 Testing Dependency Repair for Project: ${projectId}`);

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
    
    // 2. Write a file that uses a missing package (lodash)
    await workspaceManager.writeFile(projectId, 'index.ts', `
      import _ from 'lodash';
      console.log(_.kebabCase('Hello World'));
    `);

    // 3. Run it and expect failure
    console.log('\n--- Running Code (Expect Failure) ---');
    const containerId = await sandbox.getOrCreateSession(projectId, workspacePath);
    console.log(`[Test] Using Container ID: ${containerId}`);
    
    // We need to run with tsx or node. Since it's TS, we might need to compile or use ts-node/tsx.
    // Let's assume we have tsx installed or we can just run a JS file for simplicity.
    // Let's use JS to avoid TS compilation issues in this simple test.
    await workspaceManager.writeFile(projectId, 'index.js', `
      const _ = require('lodash');
      console.log(_.kebabCase('Hello World'));
    `);

    const runResult = await sandbox.exec(containerId, 'node index.js');
    console.log('Run Output:', runResult.output);

    if (runResult.exitCode !== 0) {
      console.log('✅ Code failed as expected.');
      
      // 4. Detect Missing Package
      const missingPkg = dependencyRepair.detectMissingPackage(runResult.output);
      if (missingPkg === 'lodash') {
        console.log(`✅ Detected missing package: ${missingPkg}`);
        
        // 5. Fix Dependency
        console.log('\n--- Fixing Dependency ---');
        const fixResult = await dependencyRepair.fixDependency(projectId, missingPkg);
        
        if (fixResult.success) {
          console.log('✅ Fix successful.');
          
          // 6. Rerun Code
          console.log('\n--- Rerunning Code ---');
          const rerunResult = await sandbox.exec(containerId, 'node index.js');
          console.log('Rerun Output:', rerunResult.output);
          
          if (rerunResult.exitCode === 0 && rerunResult.output.includes('hello-world')) {
            console.log('✅ Code ran successfully after fix!');
          } else {
            console.error('❌ Code still failed after fix.');
          }
        } else {
          console.error('❌ Failed to fix dependency.');
        }

      } else {
        console.error(`❌ Failed to detect 'lodash'. Detected: ${missingPkg}`);
      }

    } else {
      console.error('❌ Code ran successfully but should have failed?');
    }

    // Cleanup
    await prisma.project.delete({ where: { id: projectId } });
    await sandbox.destroySession(containerId);

  } catch (error) {
    console.error('❌ Test Failed:', error);
  }
}

runTest();
