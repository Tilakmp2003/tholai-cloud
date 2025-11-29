/**
 * Run All Tests
 * 
 * Executes all test suites and reports results.
 */

import { runTests as runApprovalTests } from './test_approval_flow';
import { runTests as runMemoryTests } from './test_memory_reuse';

interface TestResult {
  name: string;
  passed: number;
  failed: number;
  duration: number;
}

async function runAllTests() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║           VIRTUAL SOFTWARE COMPANY TEST SUITE          ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  const results: TestResult[] = [];
  const startTime = Date.now();

  // Test 1: Approval Flow
  console.log('\n' + '─'.repeat(60));
  console.log('SUITE 1: Approval Flow Tests');
  console.log('─'.repeat(60) + '\n');
  
  const approvalStart = Date.now();
  try {
    const approvalResult = await runApprovalTests();
    results.push({
      name: 'Approval Flow',
      passed: approvalResult.passed,
      failed: approvalResult.failed,
      duration: Date.now() - approvalStart
    });
  } catch (error) {
    console.error('Approval tests crashed:', error);
    results.push({
      name: 'Approval Flow',
      passed: 0,
      failed: 1,
      duration: Date.now() - approvalStart
    });
  }

  // Test 2: Memory Reuse
  console.log('\n' + '─'.repeat(60));
  console.log('SUITE 2: Memory Reuse Tests');
  console.log('─'.repeat(60) + '\n');
  
  const memoryStart = Date.now();
  try {
    const memoryResult = await runMemoryTests();
    results.push({
      name: 'Memory Reuse',
      passed: memoryResult.passed,
      failed: memoryResult.failed,
      duration: Date.now() - memoryStart
    });
  } catch (error) {
    console.error('Memory tests crashed:', error);
    results.push({
      name: 'Memory Reuse',
      passed: 0,
      failed: 1,
      duration: Date.now() - memoryStart
    });
  }

  // Test 3: Safety Policy (inline tests)
  console.log('\n' + '─'.repeat(60));
  console.log('SUITE 3: Safety Policy Tests');
  console.log('─'.repeat(60) + '\n');
  
  const safetyStart = Date.now();
  const safetyResult = await runSafetyTests();
  results.push({
    name: 'Safety Policy',
    ...safetyResult,
    duration: Date.now() - safetyStart
  });

  // Test 4: Budget Limiter (inline tests)
  console.log('\n' + '─'.repeat(60));
  console.log('SUITE 4: Budget Limiter Tests');
  console.log('─'.repeat(60) + '\n');
  
  const budgetStart = Date.now();
  const budgetResult = await runBudgetTests();
  results.push({
    name: 'Budget Limiter',
    ...budgetResult,
    duration: Date.now() - budgetStart
  });

  // Test 5: Trace Immutability (inline tests)
  console.log('\n' + '─'.repeat(60));
  console.log('SUITE 5: Trace Immutability Tests');
  console.log('─'.repeat(60) + '\n');
  
  const traceStart = Date.now();
  const traceResult = await runTraceTests();
  results.push({
    name: 'Trace Immutability',
    ...traceResult,
    duration: Date.now() - traceStart
  });

  // Final Report
  const totalDuration = Date.now() - startTime;
  const totalPassed = results.reduce((sum, r) => sum + r.passed, 0);
  const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);

  console.log('\n' + '═'.repeat(60));
  console.log('                      FINAL REPORT');
  console.log('═'.repeat(60) + '\n');

  console.log('Suite Results:');
  console.log('─'.repeat(60));
  
  for (const result of results) {
    const status = result.failed === 0 ? '✅' : '❌';
    const passRate = ((result.passed / (result.passed + result.failed)) * 100).toFixed(0);
    console.log(
      `${status} ${result.name.padEnd(25)} ${result.passed}/${result.passed + result.failed} (${passRate}%) - ${result.duration}ms`
    );
  }

  console.log('─'.repeat(60));
  console.log(`\nTotal: ${totalPassed} passed, ${totalFailed} failed`);
  console.log(`Duration: ${totalDuration}ms`);
  console.log(`Overall: ${totalFailed === 0 ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
  console.log('\n' + '═'.repeat(60));

  return { totalPassed, totalFailed };
}

// Safety Policy Tests
async function runSafetyTests(): Promise<{ passed: number; failed: number }> {
  const { safetyPolicy } = await import('../services/safetyPolicy');
  let passed = 0;
  let failed = 0;

  // Test 1: Allowlisted package
  console.log('Test 1: Allowlisted package check');
  const reactCheck = safetyPolicy.checkPackageInstall('react');
  if (reactCheck.allowed) {
    console.log('  ✅ PASSED: react is allowed');
    passed++;
  } else {
    console.log('  ❌ FAILED: react should be allowed');
    failed++;
  }

  // Test 2: Denylisted package
  console.log('Test 2: Denylisted package check');
  const evalCheck = safetyPolicy.checkPackageInstall('eval');
  if (!evalCheck.allowed) {
    console.log('  ✅ PASSED: eval is blocked');
    passed++;
  } else {
    console.log('  ❌ FAILED: eval should be blocked');
    failed++;
  }

  // Test 3: Dangerous command
  console.log('Test 3: Dangerous command check');
  const cmdCheck = safetyPolicy.checkCommand('rm -rf /');
  if (!cmdCheck.allowed) {
    console.log('  ✅ PASSED: rm -rf / is blocked');
    passed++;
  } else {
    console.log('  ❌ FAILED: rm -rf / should be blocked');
    failed++;
  }

  // Test 4: Safe command
  console.log('Test 4: Safe command check');
  const safeCmd = safetyPolicy.checkCommand('npm install lodash');
  if (safeCmd.allowed) {
    console.log('  ✅ PASSED: npm install is allowed');
    passed++;
  } else {
    console.log('  ❌ FAILED: npm install should be allowed');
    failed++;
  }

  // Test 5: Restricted path
  console.log('Test 5: Restricted path check');
  const pathCheck = safetyPolicy.checkFilePath('/etc/passwd');
  if (!pathCheck.allowed) {
    console.log('  ✅ PASSED: /etc/passwd is blocked');
    passed++;
  } else {
    console.log('  ❌ FAILED: /etc/passwd should be blocked');
    failed++;
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  return { passed, failed };
}

// Budget Limiter Tests
async function runBudgetTests(): Promise<{ passed: number; failed: number }> {
  const { budgetLimiter } = await import('../services/budgetLimiter');
  let passed = 0;
  let failed = 0;

  const testProjectId = 'test-budget-project';

  // Test 1: Record cost
  console.log('Test 1: Record cost');
  const result = await budgetLimiter.recordCost(testProjectId, 'task-1', 0.01);
  if (result.allowed) {
    console.log('  ✅ PASSED: Cost recorded successfully');
    passed++;
  } else {
    console.log('  ❌ FAILED: Cost should be allowed');
    failed++;
  }

  // Test 2: Get spend stats
  console.log('Test 2: Get spend stats');
  const stats = budgetLimiter.getSpendStats(testProjectId);
  if (stats.daily && stats.project) {
    console.log('  ✅ PASSED: Stats retrieved');
    console.log(`     Daily: $${stats.daily.spent.toFixed(4)}`);
    passed++;
  } else {
    console.log('  ❌ FAILED: Stats incomplete');
    failed++;
  }

  // Test 3: Can proceed check
  console.log('Test 3: Can proceed check');
  const canProceed = budgetLimiter.canProceed(testProjectId, 1.0);
  if (typeof canProceed === 'boolean') {
    console.log(`  ✅ PASSED: Can proceed = ${canProceed}`);
    passed++;
  } else {
    console.log('  ❌ FAILED: Invalid response');
    failed++;
  }

  // Test 4: Pause/Resume
  console.log('Test 4: Pause and resume');
  budgetLimiter.pauseProject(testProjectId, 'Test pause');
  const afterPause = budgetLimiter.canProceed(testProjectId);
  budgetLimiter.resumeProject(testProjectId);
  const afterResume = budgetLimiter.canProceed(testProjectId);
  
  if (!afterPause && afterResume) {
    console.log('  ✅ PASSED: Pause/resume working');
    passed++;
  } else {
    console.log('  ❌ FAILED: Pause/resume not working');
    failed++;
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  return { passed, failed };
}

// Trace Immutability Tests
async function runTraceTests(): Promise<{ passed: number; failed: number }> {
  const { traceImmutability } = await import('../services/traceImmutability');
  let passed = 0;
  let failed = 0;

  // Test 1: Record trace
  console.log('Test 1: Record immutable trace');
  const trace = await traceImmutability.recordImmutableTrace(
    'test-trace-1',
    'task-1',
    'agent-1',
    'TEST_EVENT',
    { test: true }
  );
  if (trace.chainHash && trace.index >= 0) {
    console.log('  ✅ PASSED: Trace recorded');
    console.log(`     Hash: ${trace.chainHash.substring(0, 16)}...`);
    passed++;
  } else {
    console.log('  ❌ FAILED: Trace not recorded');
    failed++;
  }

  // Test 2: Chain stats
  console.log('Test 2: Get chain stats');
  const stats = traceImmutability.getChainStats();
  if (stats.length > 0 && stats.lastHash) {
    console.log('  ✅ PASSED: Chain stats retrieved');
    console.log(`     Length: ${stats.length}`);
    passed++;
  } else {
    console.log('  ❌ FAILED: Invalid stats');
    failed++;
  }

  // Test 3: Verify integrity
  console.log('Test 3: Verify chain integrity');
  const verification = traceImmutability.verifyChainIntegrity();
  if (verification.valid) {
    console.log('  ✅ PASSED: Chain integrity verified');
    passed++;
  } else {
    console.log('  ❌ FAILED: Chain integrity broken');
    console.log(`     Errors: ${verification.errors.length}`);
    failed++;
  }

  // Test 4: Create snapshot
  console.log('Test 4: Create snapshot');
  const snapshot = traceImmutability.createSnapshot();
  if (snapshot.snapshotHash && snapshot.chainLength >= 0) {
    console.log('  ✅ PASSED: Snapshot created');
    console.log(`     Hash: ${snapshot.snapshotHash.substring(0, 16)}...`);
    passed++;
  } else {
    console.log('  ❌ FAILED: Snapshot failed');
    failed++;
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  return { passed, failed };
}

// Run if executed directly
if (require.main === module) {
  runAllTests()
    .then(({ totalPassed, totalFailed }) => {
      process.exit(totalFailed > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('Test runner crashed:', error);
      process.exit(1);
    });
}

export { runAllTests };
