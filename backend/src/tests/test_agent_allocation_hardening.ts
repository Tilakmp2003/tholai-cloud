// @ts-nocheck

import { allocateAgentsForProject, analyzeProject } from '../services/agentAllocator';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

// Manual mock setup
const mockAnalyzeProject = {
  mockResolvedValue: (val: any) => {
    mockAnalyzeProject.currentValue = val;
  },
  currentValue: null,
  // This will be called by the monkey-patched function
  call: async () => mockAnalyzeProject.currentValue
};

async function runTests() {
  console.log('🧪 Starting Agent Allocation Hardening Tests...');
  const projectId = `test-project-${randomUUID()}`;

  // --- Test 1: Small Project Base Allocation ---
  console.log('\nTest 1: Small Project Base Allocation (< 10 features)');
  mockAnalyzeProject.mockResolvedValue({
    features: 5,
    modules: 2,
    totalWords: 500,
    complexityScore: 30,
    workflowsPerHour: 2,
    traceId: 'trace-small'
  });

  const res1 = await allocateAgentsForProject(projectId, 'small prd');
  if (res1.ok && res1.allocation.teamLead === 1 && res1.allocation.juniorDev === 2) {
    console.log('✅ PASSED: Small project allocated correctly (7 agents)');
  } else {
    console.error('❌ FAILED: Small project allocation mismatch', res1.allocation);
  }

  // --- Test 2: Medium Project Base Allocation ---
  console.log('\nTest 2: Medium Project Base Allocation (< 30 features)');
  // Wait for cooldown (we'll mock time or just use a new project ID for simplicity in this script)
  const projectId2 = `test-project-${randomUUID()}`;
  mockAnalyzeProject.mockResolvedValue({
    features: 20,
    modules: 5,
    totalWords: 2000,
    complexityScore: 50,
    workflowsPerHour: 5,
    traceId: 'trace-medium'
  });

  const res2 = await allocateAgentsForProject(projectId2, 'medium prd');
  if (res2.ok && res2.allocation.architect === 1 && res2.allocation.midDev === 4) {
    console.log('✅ PASSED: Medium project allocated correctly (13 agents)');
  } else {
    console.error('❌ FAILED: Medium project allocation mismatch', res2.allocation);
  }

  // --- Test 3: Large Project Base Allocation ---
  console.log('\nTest 3: Large Project Base Allocation (30+ features)');
  const projectId3 = `test-project-${randomUUID()}`;
  mockAnalyzeProject.mockResolvedValue({
    features: 40,
    modules: 10,
    totalWords: 5000,
    complexityScore: 60,
    workflowsPerHour: 8,
    traceId: 'trace-large'
  });

  const res3 = await allocateAgentsForProject(projectId3, 'large prd');
  if (res3.ok && res3.allocation.security === 1 && res3.allocation.midDev === 6) {
    console.log('✅ PASSED: Large project allocated correctly (20 agents)');
  } else {
    console.error('❌ FAILED: Large project allocation mismatch', res3.allocation);
  }

  // --- Test 4: High Workload Scaling ---
  console.log('\nTest 4: High Workload Scaling (workflows/hr >= 10)');
  const projectId4 = `test-project-${randomUUID()}`;
  mockAnalyzeProject.mockResolvedValue({
    features: 20, // Medium base
    modules: 5,
    totalWords: 2000,
    complexityScore: 50,
    workflowsPerHour: 12, // High workload
    traceId: 'trace-workload'
  });

  const res4 = await allocateAgentsForProject(projectId4, 'high workload');
  // Medium base midDev=4. Expect +2 = 6.
  if (res4.ok && res4.allocation.midDev === 6) {
    console.log('✅ PASSED: High workload added +2 MidDevs');
  } else {
    console.error('❌ FAILED: High workload scaling mismatch', res4.allocation);
  }

  // --- Test 5: High Complexity Scaling ---
  console.log('\nTest 5: High Complexity Scaling (score > 70)');
  const projectId5 = `test-project-${randomUUID()}`;
  mockAnalyzeProject.mockResolvedValue({
    features: 20, // Medium base
    modules: 5,
    totalWords: 2000,
    complexityScore: 80, // High complexity
    workflowsPerHour: 5,
    traceId: 'trace-complexity'
  });

  const res5 = await allocateAgentsForProject(projectId5, 'high complexity');
  // Medium base architect=1. Expect +1 = 2.
  if (res5.ok && res5.allocation.architect === 2) {
    console.log('✅ PASSED: High complexity added +1 Architect');
  } else {
    console.error('❌ FAILED: High complexity scaling mismatch', res5.allocation);
  }

  // --- Test 6: Budget Breach (Scaling Down) ---
  console.log('\nTest 6: Budget Breach Enforcement');
  const projectId6 = `test-project-${randomUUID()}`;
  // Force a very large team that would exceed $50/day
  // Large base (20 agents) + High Workload + High Complexity
  // This should trigger the budget scaler
  mockAnalyzeProject.mockResolvedValue({
    features: 50,
    modules: 10,
    totalWords: 5000,
    complexityScore: 90,
    workflowsPerHour: 20,
    traceId: 'trace-budget'
  });

  const res6 = await allocateAgentsForProject(projectId6, 'expensive prd');
  // We expect the cost to be <= 50.
  // Let's check the log
  if (res6.ok && res6.log.estimatedCostUsd <= 50.0) {
    console.log(`✅ PASSED: Budget enforced. Final cost: $${res6.log.estimatedCostUsd.toFixed(2)} <= $50.00`);
    console.log('   Final composition:', res6.allocation);
  } else {
    console.error(`❌ FAILED: Budget breach. Cost: $${res6.log?.estimatedCostUsd}`);
  }

  // --- Test 7: Cooldown Enforcement ---
  console.log('\nTest 7: Cooldown Enforcement');
  // Reuse projectId1 which was just allocated
  const res7 = await allocateAgentsForProject(projectId, 'retry immediately');
  if (!res7.ok && res7.reason === 'CooldownActive') {
    console.log('✅ PASSED: Cooldown blocked immediate reallocation');
  } else {
    console.error('❌ FAILED: Cooldown did not block', res7);
  }

  console.log('\n🎉 All Hardening Tests Completed!');
}

// Simple Jest-like mock setup for standalone execution
if (require.main === module) {
  // Mocking global jest object for the mock above to work if running with tsx directly without jest
  // But since we are running with tsx, we need a slight adjustment or just rely on the logic without jest.mock if possible.
  // Actually, for `tsx` execution, we can't easily use `jest.mock`. 
  // We'll manually override the function for this script.
  
  // Monkey-patching for test script execution
  const allocatorService = require('../services/agentAllocator');
  allocatorService.analyzeProject = mockAnalyzeProject.call;

  runTests().catch(console.error).finally(() => prisma.$disconnect());
}
