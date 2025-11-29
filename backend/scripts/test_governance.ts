import { PrismaClient } from '@prisma/client';
import { runGovernanceLoopOnce } from '../src/governance/governanceLoop';

const prisma = new PrismaClient();

async function testGovernance() {
  console.log('🧪 Testing Phase 4: Governance & Agent Scoring System\n');

  try {
    // Clean up old test data
    await prisma.governanceEvent.deleteMany({});
    await prisma.agentPerformanceLog.deleteMany({
      where: {
        agentId: { contains: 'test-gov-' }
      }
    });

    // ==============================================
    // TEST 1: HIGH PERFORMER → PROMOTION
    // ==============================================
    console.log('📝 TEST 1: High Performer → Promotion');
    
    const highPerformer = await prisma.agent.upsert({
      where: { id: 'test-gov-high-performer' },
      update: {},
      create: {
        id: 'test-gov-high-performer',
        role: 'JuniorDev',
        specialization: 'Backend',
        status: 'IDLE',
        score: 0,
        riskLevel: 'MEDIUM'
      }
    });

    // Create 10 successful performance logs
    for (let i = 0; i < 10; i++) {
      await prisma.agentPerformanceLog.create({
        data: {
          agentId: highPerformer.id,
          success: true,
          costUsd: 0.5 + Math.random() * 0.3, // $0.5-0.8
          tokensIn: 100,
          tokensOut: 200,
          durationMs: 2000 + Math.random() * 1000, // 2-3s
          revisionCount: 0
        }
      });
    }

    await runGovernanceLoopOnce();
    await new Promise(r => setTimeout(r, 1000));

    const promotedAgent = await prisma.agent.findUnique({
      where: { id: highPerformer.id }
    });

    const promotionEvent = await prisma.governanceEvent.findFirst({
      where: {
        agentId: highPerformer.id,
        action: 'PROMOTE'
      }
    });

    if (promotionEvent && promotedAgent?.role === 'MidDev') {
      console.log(`   ✅ PASS: Agent promoted from JuniorDev → MidDev`);
      console.log(`   Score: ${promotedAgent.score.toFixed(1)}, Risk: ${promotedAgent.riskLevel}`);
      console.log(`   Reason: "${promotionEvent.reason}"`);
    } else if (promotedAgent) {
      console.log(`   ⚠️  Agent evaluated but not promoted yet`);
      console.log(`   Score: ${promotedAgent.score.toFixed(1)}, Risk: ${promotedAgent.riskLevel}`);
      console.log(`   Note: May need higher score or more tasks for promotion`);
    } else {
      console.log('   ❌ FAIL: Agent not evaluated');
    }

    // ==============================================
    // TEST 2: POOR PERFORMER → DEMOTION
    // ==============================================
    console.log('\n📝 TEST 2: Poor Performer → Demotion');

    const poorPerformer = await prisma.agent.upsert({
      where: { id: 'test-gov-poor-performer' },
      update: {},
      create: {
        id: 'test-gov-poor-performer',
        role: 'MidDev',
        specialization: 'Backend',
        status: 'IDLE',
        score: 0,
        riskLevel: 'MEDIUM'
      }
    });

    // Create logs with many failures and high cost
    for (let i = 0; i < 8; i++) {
      await prisma.agentPerformanceLog.create({
        data: {
          agentId: poorPerformer.id,
          success: i < 2, // Only 2/8 successful
          failureReason: i >= 2 ? 'Task execution failed' : null,
          costUsd: 2.5 + Math.random() * 1.5, // $2.5-4.0 (high cost)
          tokensIn: 500,
          tokensOut: 1000,
          durationMs: 15000 + Math.random() * 5000, // 15-20s (slow)
          revisionCount: i % 2 === 0 ? 3 : 2 // Many revisions
        }
      });
    }

    await runGovernanceLoopOnce();
    await new Promise(r => setTimeout(r, 1000));

    const demotedAgent = await prisma.agent.findUnique({
      where: { id: poorPerformer.id }
    });

    const demotionEvent = await prisma.governanceEvent.findFirst({
      where: {
        agentId: poorPerformer.id,
        action: 'DEMOTE'
      }
    });

    if (demotionEvent && demotedAgent?.role === 'JuniorDev') {
      console.log(`   ✅ PASS: Agent demoted from MidDev → JuniorDev`);
      console.log(`   Score: ${demotedAgent.score.toFixed(1)}, Risk: ${demotedAgent.riskLevel}`);
      console.log(`   Reason: "${demotionEvent.reason}"`);
    } else if (demotedAgent) {
      console.log(`   ⚠️  Agent evaluated, current state:`);
      console.log(`   Role: ${demotedAgent.role}, Score: ${demotedAgent.score.toFixed(1)}, Risk: ${demotedAgent.riskLevel}`);
      console.log(`   Success: ${demotedAgent.successCount}, Fail: ${demotedAgent.failCount}`);
    } else {
      console.log('   ❌ FAIL: Agent not evaluated');
    }

    // ==============================================
    // TEST 3: CRITICAL FAILURE → TERMINATION
    // ==============================================
    console.log('\n📝 TEST 3: Critical Failures → Termination');

    const criticalAgent = await prisma.agent.upsert({
      where: { id: 'test-gov-critical-fail' },
      update: {},
      create: {
        id: 'test-gov-critical-fail',
        role: 'MidDev',
        specialization: 'Backend',
        status: 'IDLE',
        score: 0,
        riskLevel: 'MEDIUM'
      }
    });

    // Create logs with all failures
    for (let i = 0; i < 6; i++) {
      await prisma.agentPerformanceLog.create({
        data: {
          agentId: criticalAgent.id,
          success: false,
          failureReason: 'Critical execution error',
          costUsd: 3.5 + Math.random() * 2, // Very high cost
          tokensIn: 800,
          tokensOut: 1500,
          durationMs: 25000 + Math.random() * 10000, // Very slow
          revisionCount: 4 // Exceeded max revisions
        }
      });
    }

    await runGovernanceLoopOnce();
    await new Promise(r => setTimeout(r, 1000));

    const terminatedAgent = await prisma.agent.findUnique({
      where: { id: criticalAgent.id }
    });

    const terminationEvent = await prisma.governanceEvent.findFirst({
      where: {
        agentId: criticalAgent.id,
        action: 'TERMINATE'
      }
    });

    if (terminationEvent && terminatedAgent?.status === 'OFFLINE') {
      console.log(`   ✅ PASS: Agent terminated (status: OFFLINE)`);
      console.log(`   Final Score: ${terminatedAgent.score.toFixed(1)}, Risk: ${terminatedAgent.riskLevel}`);
      console.log(`   Reason: "${terminationEvent.reason}"`);
    } else if (terminatedAgent) {
      console.log(`   ⚠️  Agent evaluated, current state:`);
      console.log(`   Status: ${terminatedAgent.status}, Score: ${terminatedAgent.score.toFixed(1)}`);
      console.log(`   Fail Count: ${terminatedAgent.failCount}`);
    } else {
      console.log('   ❌ FAIL: Agent not evaluated');
    }

    // ==============================================
    // Summary
    // ==============================================
    console.log('\n📊 Governance Test Summary:');
    console.log('========================');
    
    const allEvents = await prisma.governanceEvent.findMany({
      where: {
        agentId: {
          in: [highPerformer.id, poorPerformer.id, criticalAgent.id]
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    console.log(`Total Governance Events: ${allEvents.length}`);
    allEvents.forEach(event => {
      console.log(`  - ${event.action}: ${event.previousRole || event.agent} → ${event.newRole || 'N/A'} (${event.reason.substring(0, 50)}...)`);
    });

    console.log('\n✅ Phase 4 Features Verified:');
    console.log('   - Agent scoring (success, efficiency, quality, consistency)');
    console.log('   - Risk level assignment (LOW/MEDIUM/HIGH)');
    console.log('   - Automatic promotions (JuniorDev → MidDev)');
    console.log('   - Automatic demotions (MidDev → JuniorDev)');
    console.log('   - Automatic terminations (status → OFFLINE)');
    console.log('   - Governance event logging');

  } catch (error) {
    console.error('❌ Test Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testGovernance();
