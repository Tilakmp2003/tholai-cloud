import fetch from 'node-fetch';

const API_URL = 'http://localhost:3000/api';

async function verify() {
  console.log('Starting AI Verification...');

  // 1. Create Project
  console.log('Creating Project...');
  const projectRes = await fetch(`${API_URL}/project`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'AI Project', clientName: 'AI Client', status: 'PLANNED' })
  });
  const project = await projectRes.json();
  console.log('Project Created:', project.id);

  // 2. Create Module
  console.log('Creating Module...');
  const moduleRes = await fetch(`${API_URL}/module`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'AI Module', projectId: project.id, status: 'PLANNED' })
  });
  const module = await moduleRes.json();
  console.log('Module Created:', module.id);

  // 3. Create Agent
  console.log('Creating MidDev Agent...');
  const agentRes = await fetch(`${API_URL}/agent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'MidDev', specialization: 'Backend', status: 'IDLE' })
  });
  const agent = await agentRes.json();
  console.log('Agent Created:', agent.id);

  // 4. Create Task with Context
  console.log('Creating Task with Context...');
  const taskRes = await fetch(`${API_URL}/task`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      moduleId: module.id, 
      requiredRole: 'MidDev', 
      summary: 'Write a short poem about a coding bug.' 
    })
  });
  const task = await taskRes.json();
  console.log('Task Created:', task.id);

  // 5. Wait for Orchestrator & Agent
  console.log('Waiting 20s for Orchestrator & Agent...');
  await new Promise(resolve => setTimeout(resolve, 20000));

  // 6. Check Task Status & Result
  const checkRes = await fetch(`${API_URL}/task`);
  const tasks = await checkRes.json();
  const updatedTask = tasks.find((t: any) => t.id === task.id);

  console.log('Final Task State:', updatedTask);

  if (updatedTask.status === 'COMPLETED' && updatedTask.result) {
    console.log('SUCCESS: Task completed by AI Agent!');
    console.log('AI Output:', updatedTask.result.output);
    if (updatedTask.traceId) {
        console.log('Trace ID found:', updatedTask.traceId);
    } else {
        console.warn('WARNING: No Trace ID found.');
    }
  } else {
    console.error('FAILURE: Task was not completed.');
    process.exit(1);
  }
}

verify().catch(err => {
  console.error(err);
  process.exit(1);
});
