import { PrismaClient } from '@prisma/client';
import { runMidDevAgentOnce } from '../src/agents/midDevAgent';

const prisma = new PrismaClient();

async function testConfusionDetection() {
  console.log('🧪 Testing Phase 3 Confusion Detection...\n');

  try {
    // 1. Create a TeamLead agent (needed for escalation)
    const teamLead = await prisma.agent.upsert({
      where: { id: 'test-teamlead-agent' },
      update: {},
      create: {
        id: 'test-teamlead-agent',
        role: 'TeamLead',
        specialization: 'Management',
        status: 'IDLE'
      }
    });
    console.log('✅ TeamLead agent ready');

    // 2. Create a MidDev agent
    const midDev = await prisma.agent.upsert({
      where: { id: 'test-middev-agent' },
      update: {},
      create: {
        id: 'test-middev-agent',
        role: 'MidDev',
        specialization: 'Backend',
        status: 'IDLE'
      }
    });
    console.log('✅ MidDev agent ready');

    // 3. Create a project and module
    const project = await prisma.project.create({
      data: {
        name: 'Confusion Test Project',
        clientName: 'Test Client',
        status: 'PLANNED'
      }
    });

    const module = await prisma.module.create({
      data: {
        name: 'Test Module',
        projectId: project.id,
        status: 'PLANNED'
      }
    });
    console.log('✅ Project and Module created');

    // 4. Create a task with MISSING CONTEXT (should trigger pre-check)
    console.log('\n📝 Test 1: Missing Summary (Pre-Check)');
    const task1 = await prisma.task.create({
      data: {
        moduleId: module.id,
        requiredRole: 'MidDev',
        status: 'ASSIGNED',
        assignedToAgentId: midDev.id,
        contextPacket: {
          // Missing 'summary' field - should trigger pre-check
          details: 'Some details here'
        }
      }
    });

    await runMidDevAgentOnce();

    const updatedTask1 = await prisma.task.findUnique({
      where: { id: task1.id }
    });

    const escalation1 = await prisma.contextRequest.findFirst({
      where: { taskId: task1.id }
    });

    if (updatedTask1?.status === 'BLOCKED' && escalation1) {
      console.log('✅ PASS: Task blocked and escalation created');
      console.log(`   Escalation: "${escalation1.message}"`);
    } else {
      console.log('❌ FAIL: Pre-check did not work');
    }

    // 5. Create a task with AMBIGUOUS CONTEXT (should trigger LLM check)
    console.log('\n📝 Test 2: Ambiguous Instructions (LLM Check)');
    const task2 = await prisma.task.create({
      data: {
        moduleId: module.id,
        requiredRole: 'MidDev',
        status: 'ASSIGNED',
        assignedToAgentId: midDev.id,
        contextPacket: {
          summary: 'Make it nice',
          details: 'Just make it look good'
        }
      }
    });

    await runMidDevAgentOnce();

    const updatedTask2 = await prisma.task.findUnique({
      where: { id: task2.id }
    });

    const escalation2 = await prisma.contextRequest.findFirst({
      where: { taskId: task2.id }
    });

    if (updatedTask2?.status === 'BLOCKED' && escalation2) {
      console.log('✅ PASS: Ambiguity detected and escalated');
      console.log(`   Escalation: "${escalation2.message}"`);
    } else if (updatedTask2?.status === 'IN_REVIEW') {
      console.log('⚠️  PARTIAL: LLM decided task was clear enough, proceeded with execution');
    } else {
      console.log('❌ FAIL: Ambiguity check did not work');
    }

    // 6. Create a CLEAR task (should execute normally)
    console.log('\n📝 Test 3: Clear Instructions (Should Execute)');
    const task3 = await prisma.task.create({
      data: {
        moduleId: module.id,
        requiredRole: 'MidDev',
        status: 'ASSIGNED',
        assignedToAgentId: midDev.id,
        contextPacket: {
          summary: 'Create a GET /health endpoint',
          details: 'Create a simple Express route that returns { status: "ok" } with HTTP 200'
        }
      }
    });

    await runMidDevAgentOnce();

    const updatedTask3 = await prisma.task.findUnique({
      where: { id: task3.id }
    });

    if (updatedTask3?.status === 'IN_REVIEW') {
      console.log('✅ PASS: Clear task executed successfully');
      console.log(`   Result: ${JSON.stringify(updatedTask3.result).substring(0, 100)}...`);
    } else if (updatedTask3?.status === 'BLOCKED') {
      console.log('⚠️  WARNING: Clear task was blocked (LLM may have been overly cautious)');
    } else {
      console.log('❌ FAIL: Clear task did not execute');
    }

    // Summary
    console.log('\n📊 Summary:');
    const allRequests = await prisma.contextRequest.findMany({
      where: {
        taskId: { in: [task1.id, task2.id, task3.id] }
      }
    });
    console.log(`Total Escalations Created: ${allRequests.length}`);

  } catch (error) {
    console.error('❌ Test Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testConfusionDetection();
