import fetch from 'node-fetch';

const API_URL = 'http://localhost:3000/api';

async function verifyPhase2() {
  console.log('Starting Phase 2 Verification...');

  // 1. Create Project & Module (PLANNED)
  console.log('Creating Project & Module...');
  const projectRes = await fetch(`${API_URL}/project`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Phase 2 Project', clientName: 'P2 Client', status: 'PLANNED' })
  });
  const project = await projectRes.json();

  const moduleRes = await fetch(`${API_URL}/module`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'User Authentication', projectId: project.id, status: 'PLANNED' })
  });
  const module = await moduleRes.json();
  console.log('Module Created (PLANNED):', module.id);

  // 2. Wait for TeamLead to Plan (Split Module -> Tasks)
  console.log('Waiting 60s for TeamLead Planning...');
  await new Promise(resolve => setTimeout(resolve, 60000));

  // Check if tasks were created
  let tasksRes = await fetch(`${API_URL}/task`);
  let tasks = await tasksRes.json();
  let moduleTasks = tasks.filter((t: any) => t.moduleId === module.id);
  
  if (moduleTasks.length > 0) {
    console.log(`SUCCESS: TeamLead created ${moduleTasks.length} tasks.`);
  } else {
    console.error('FAILURE: TeamLead did not create tasks.');
    process.exit(1);
  }

  // 3. Create Agents (MidDev, TeamLead, QA) if not exist
  console.log('Ensuring MidDev Agent exists...');
  await fetch(`${API_URL}/agent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'MidDev', specialization: 'Backend', status: 'IDLE' })
  });

  const agentsRes = await fetch(`${API_URL}/agent`);
  const agents = await agentsRes.json();
  console.log('Current Agents:', agents.map((a: any) => `${a.role} (${a.status})`));

  // 4. Wait for full pipeline (Orchestrator -> Dev -> TL -> QA)
  console.log('Waiting 120s for Pipeline Execution...');
  await new Promise(resolve => setTimeout(resolve, 120000));

  // 5. Check Final Status
  tasksRes = await fetch(`${API_URL}/task`);
  tasks = await tasksRes.json();
  moduleTasks = tasks.filter((t: any) => t.moduleId === module.id);

  console.log('Final Task States:');
  moduleTasks.forEach((t: any) => {
    console.log(`- Task ${t.id}: ${t.status}`);
    if (t.status === 'COMPLETED') {
        console.log(`  Result: ${JSON.stringify(t.result).substring(0, 50)}...`);
        console.log(`  Feedback: ${JSON.stringify(t.reviewFeedback)}`);
    }
  });

  const completedCount = moduleTasks.filter((t: any) => t.status === 'COMPLETED').length;
  if (completedCount > 0) {
    console.log(`SUCCESS: ${completedCount} tasks completed full pipeline!`);
  } else {
    console.warn('WARNING: No tasks reached COMPLETED state yet. Pipeline might be slow or stuck.');
  }
}

verifyPhase2().catch(err => {
  console.error(err);
  process.exit(1);
});
