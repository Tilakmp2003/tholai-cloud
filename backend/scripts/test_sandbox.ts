import { sandbox } from '../src/services/sandbox';
import { v4 as uuidv4 } from 'uuid';

async function runTest() {
  const projectId = `test-project-${uuidv4().substring(0, 8)}`;
  console.log(`🧪 Starting Sandbox Test for Project: ${projectId}`);

  let containerId: string | null = null;

  try {
    // 1. Create Session
    console.log('Creating sandbox session...');
    containerId = await sandbox.createSession(projectId);
    console.log(`✅ Container started: ${containerId}`);

    // 2. Execute Command
    console.log('Running echo command...');
    const result1 = await sandbox.exec(containerId, 'echo "Hello from Docker"');
    console.log('Result:', result1);
    if (result1.stdout === 'Hello from Docker') {
      console.log('✅ Exec works');
    } else {
      console.error('❌ Exec failed');
    }

    // 3. Test Persistence
    console.log('Testing persistence...');
    await sandbox.exec(containerId, 'echo "Persistent Data" > /workspace/data.txt');
    const result2 = await sandbox.exec(containerId, 'cat /workspace/data.txt');
    console.log('File Content:', result2.stdout);
    
    if (result2.stdout === 'Persistent Data') {
      console.log('✅ Persistence works');
    } else {
      console.error('❌ Persistence failed');
    }

    // 4. Test Timeout
    console.log('Testing timeout (should fail)...');
    try {
      await sandbox.exec(containerId, 'sleep 2', 1000); // 1s timeout for 2s sleep
      console.error('❌ Timeout failed (command finished)');
    } catch (e) {
      console.log('✅ Timeout works:', e.message);
    }

  } catch (error) {
    console.error('❌ Test Failed:', error);
  } finally {
    // 5. Cleanup
    if (containerId) {
      console.log('Destroying session...');
      await sandbox.destroySession(containerId);
      console.log('✅ Session destroyed');
    }
  }
}

runTest();
