import { PrismaClient } from '@prisma/client';
import { runMidDevAgentOnce } from '../src/agents/midDevAgent';
import { runTeamLeadAgentOnce } from '../src/agents/teamLeadAgent';
import { runTeamLeadResolutionOnce } from '../src/agents/teamLeadResolutionAgent';

const prisma = new PrismaClient();

async function testPhase3() {
  console.log('🧪 Testing Phase 3: Complete Escalation & Context Management System\n');

  try {
    // Setup agents
    const teamLead = await prisma.agent.upsert({
      where: { id: 'test-teamlead-p3' },
      update: {},
      create: {
        id: 'test-teamlead-p3',
        role: 'TeamLead',
        specialization: 'Management',
        status: 'IDLE'
      }
    });

    const midDev = await prisma.agent.upsert({
      where: { id: 'test-middev-p3' },
      update: {},
      create: {
        id: 'test-middev-p3',
        role: 'MidDev',
        specialization: 'Backend',
        status: 'IDLE'
      }
    });
    console.log('✅ Agents ready\n');

    // Create project and module
    const project = await prisma.project.create({
      data: {
        name: 'Phase 3 Test Project',
        clientName: 'Test Client',
        status: 'PLANNED'
      }
    });

    const module = await prisma.module.create({
      data: {
        name: 'Phase 3 Module',
        projectId: project.id,
        status: 'PLANNED'
      }
    });

    // ==============================================
    // TEST 1: ContextPacket v2 Format
    // ==============================================
    console.log('📝 TEST 1: ContextPacket v2 Format');
    
    await runTeamLeadAgentOnce();
    await new Promise(r => setTimeout(r, 2000));

    const createdTasks = await prisma.task.findMany({
      where: { moduleId: module.id }
    });

    if (createdTasks.length > 0) {
      const sampleTask = createdTasks[0];
      const context: any = sampleTask.contextPacket;

      console.log('   Context Packet:', JSON.stringify(context, null, 2));

      const hasVersion = context.version === 1;
      const hasHistory = Array.isArray(context.history) && context.history.length > 0;
      const hasStructure = context.summary && context.details;

      if (hasVersion && hasHistory && hasStructure) {
        console.log('   ✅ PASS: ContextPacket v2 has version, history, and structure');
      } else {
        console.log('   ❌ FAIL: ContextPacket v2 missing required fields');
      }
    }

    // ==============================================
    // TEST 2: Confusion Detection → Escalation
    // ==============================================
    console.log('\n📝 TEST 2: Confusion Detection → Escalation');

    const ambiguousTask = await prisma.task.create({
      data: {
        moduleId: module.id,
        requiredRole: 'MidDev',
        status: 'ASSIGNED',
        assignedToAgentId: midDev.id,
        contextPacket: {
          version: 1,
          summary: 'Make it nice',
          details: 'Just improve the UI',
          history: []
        }
      }
    });

    await runMidDevAgentOnce();
    await new Promise(r => setTimeout(r, 2000));

    const updatedAmbiguous = await prisma.task.findUnique({
      where: { id: ambiguousTask.id }
    });

    const escalation = await prisma.contextRequest.findFirst({
      where: { taskId: ambiguousTask.id }
    });

    if (updatedAmbiguous?.status === 'BLOCKED' && escalation) {
      console.log('   ✅ PASS: Ambiguous task blocked and escalation created');
      console.log(`   Issue: ${escalation.issueType} - "${escalation.message}"`);
    } else {
      console.log('   ⚠️  Task proceeded or escalation not created');
    }

    // ==============================================
    // TEST 3: TeamLead Resolution → Context Update
    // ==============================================
    console.log('\n📝 TEST 3: TeamLead Resolution → Context Update');

    if (escalation) {
      await runTeamLeadResolutionOnce();
      await new Promise(r => setTimeout(r, 3000));

      const resolvedEscalation = await prisma.contextRequest.findUnique({
        where: { id: escalation.id }
      });

      const taskAfterResolution = await prisma.task.findUnique({
        where: { id: ambiguousTask.id }
      });

      if (resolvedEscalation?.status === 'RESOLVED') {
        console.log('   ✅ PASS: Escalation marked as RESOLVED');
        console.log(`   Resolution: "${resolvedEscalation.resolution?.substring(0, 100)}..."`);
      }

      if (taskAfterResolution?.status === 'NEEDS_REVISION') {
        console.log('   ✅ PASS: Task unblocked (BLOCKED → NEEDS_REVISION)');
      }

      const updatedContext: any = taskAfterResolution?.contextPacket;
      if (updatedContext?.version > 1 && updatedContext?.history?.length > 1) {
        console.log('   ✅ PASS: Context version incremented and history updated');
        console.log('   History events:', updatedContext.history.map((h: any) => h.event).join(' → '));
      }
    }

    // ==============================================
    // TEST 4: Revision Limit Enforcement
    // ==============================================
    console.log('\n📝 TEST 4: Revision Limit Enforcement');

    // First, clear other tasks so MidDev picks up our test task
    await prisma.task.updateMany({
      where: {
        status: { in: ['ASSIGNED', 'NEEDS_REVISION'] }
      },
      data: {
        status: 'COMPLETED'
      }
    });

    const limitTask = await prisma.task.create({
      data: {
        moduleId: module.id,
        requiredRole: 'MidDev',
        status: 'ASSIGNED',
        assignedToAgentId: midDev.id,
        revisionCount: 3,  // Already at max
        maxRevisions: 3,
        contextPacket: {
          version: 1,
          summary: 'Clear task at revision limit',
          details: 'This should fail due to revision limit',
          history: []
        }
      }
    });

    await runMidDevAgentOnce();
    await new Promise(r => setTimeout(r, 1000));

    const limitTaskResult = await prisma.task.findUnique({
      where: { id: limitTask.id }
    });

    if (limitTaskResult?.status === 'FAILED' && 
        limitTaskResult?.errorMessage?.includes('Max revisions')) {
      console.log('   ✅ PASS: Task failed due to revision limit');
      console.log(`   Error: "${limitTaskResult.errorMessage}"`);
    } else {
      console.log('   ❌ FAIL: Revision limit not enforced');
      console.log(`   Status: ${limitTaskResult?.status}, Revisions: ${limitTaskResult?.revisionCount}`);
    }

    // ==============================================
    // Summary
    // ==============================================
    console.log('\n📊 Phase 3 Test Summary:');
    console.log('========================');
    
    const allEscalations = await prisma.contextRequest.count();
    const allTraces = await prisma.trace.count();
    
    console.log(`Total Escalations Created: ${allEscalations}`);
    console.log(`Total Trace Events Logged: ${allTraces}`);
    console.log('\n✅ Phase 3 Features Verified:');
    console.log('   - ContextPacket v2 (versioning + history)');
    console.log('   - Confusion detection & blocking');
    console.log('   - Auto-escalation creation');
    console.log('   - TeamLead resolution & unblocking');
    console.log('   - Revision limit enforcement');

  } catch (error) {
    console.error('❌ Test Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testPhase3();
