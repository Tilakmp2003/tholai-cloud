/**
 * Approval Flow Tests
 * 
 * Tests the human approval gate system.
 */

import { approvalGates } from '../services/approvalGates';

async function runTests() {
  console.log('🧪 Running Approval Flow Tests\n');
  
  let passed = 0;
  let failed = 0;
  
  const testProjectId = 'test-project-approval';
  
  // Test 1: Create approval gate
  console.log('Test 1: Create approval gate');
  try {
    const gate = await approvalGates.createGate(
      testProjectId,
      'PRE_COMMIT',
      'Test Commit',
      'Testing approval flow',
      { files: ['test.ts'], changes: 10 },
      'task-123'
    );
    
    if (gate.id && gate.status === 'PENDING') {
      console.log('  ✅ PASSED: Gate created successfully');
      console.log(`     Gate ID: ${gate.id}`);
      passed++;
    } else {
      console.log('  ❌ FAILED: Gate not created properly');
      failed++;
    }
  } catch (error) {
    console.log('  ❌ FAILED:', error);
    failed++;
  }
  
  // Test 2: Get pending gates
  console.log('\nTest 2: Get pending gates');
  try {
    const pending = approvalGates.getPendingGates(testProjectId);
    
    if (pending.length > 0) {
      console.log('  ✅ PASSED: Retrieved pending gates');
      console.log(`     Count: ${pending.length}`);
      passed++;
    } else {
      console.log('  ❌ FAILED: No pending gates found');
      failed++;
    }
  } catch (error) {
    console.log('  ❌ FAILED:', error);
    failed++;
  }
  
  // Test 3: Approve gate
  console.log('\nTest 3: Approve gate');
  try {
    const pending = approvalGates.getPendingGates(testProjectId);
    if (pending.length > 0) {
      const approved = await approvalGates.approveGate(
        pending[0].id,
        'test-reviewer',
        'Looks good!'
      );
      
      if (approved.status === 'APPROVED') {
        console.log('  ✅ PASSED: Gate approved successfully');
        passed++;
      } else {
        console.log('  ❌ FAILED: Gate not approved');
        failed++;
      }
    } else {
      console.log('  ⚠️ SKIPPED: No gates to approve');
      passed++;
    }
  } catch (error) {
    console.log('  ❌ FAILED:', error);
    failed++;
  }
  
  // Test 4: Reject gate
  console.log('\nTest 4: Reject gate');
  try {
    // Create a new gate to reject
    const gate = await approvalGates.createGate(
      testProjectId,
      'SECURITY',
      'Security Review',
      'Testing rejection',
      { vulnerability: 'test' }
    );
    
    const rejected = await approvalGates.rejectGate(
      gate.id,
      'test-reviewer',
      'Security concern found'
    );
    
    if (rejected.status === 'REJECTED' && rejected.reviewerNotes === 'Security concern found') {
      console.log('  ✅ PASSED: Gate rejected successfully');
      passed++;
    } else {
      console.log('  ❌ FAILED: Gate not rejected properly');
      failed++;
    }
  } catch (error) {
    console.log('  ❌ FAILED:', error);
    failed++;
  }
  
  // Test 5: Modify and approve
  console.log('\nTest 5: Modify and approve');
  try {
    const gate = await approvalGates.createGate(
      testProjectId,
      'ARCHITECTURE',
      'Architecture Decision',
      'Testing modification',
      { original: 'value' }
    );
    
    const modified = await approvalGates.modifyAndApprove(
      gate.id,
      'test-reviewer',
      { modified: 'new-value' },
      'Changed the approach'
    );
    
    if (modified.status === 'MODIFIED' && modified.modifiedPayload?.modified === 'new-value') {
      console.log('  ✅ PASSED: Gate modified and approved');
      passed++;
    } else {
      console.log('  ❌ FAILED: Modification not applied');
      failed++;
    }
  } catch (error) {
    console.log('  ❌ FAILED:', error);
    failed++;
  }
  
  // Test 6: Gate configuration
  console.log('\nTest 6: Gate configuration');
  try {
    approvalGates.configureGates(testProjectId, ['PRE_COMMIT', 'SECURITY']);
    
    // PRE_COMMIT should be enabled
    const preCommitEnabled = approvalGates.isGateEnabled(testProjectId, 'PRE_COMMIT');
    // ARCHITECTURE should be disabled
    const archEnabled = approvalGates.isGateEnabled(testProjectId, 'ARCHITECTURE');
    
    if (preCommitEnabled && !archEnabled) {
      console.log('  ✅ PASSED: Gate configuration working');
      passed++;
    } else {
      console.log('  ❌ FAILED: Configuration not applied correctly');
      failed++;
    }
  } catch (error) {
    console.log('  ❌ FAILED:', error);
    failed++;
  }
  
  // Test 7: Auto-approve when gate disabled
  console.log('\nTest 7: Auto-approve disabled gates');
  try {
    // DEPLOYMENT is not in our config, should auto-approve
    const gate = await approvalGates.createGate(
      testProjectId,
      'DEPLOYMENT',
      'Deploy Test',
      'Should auto-approve',
      {}
    );
    
    if (gate.status === 'APPROVED') {
      console.log('  ✅ PASSED: Disabled gate auto-approved');
      passed++;
    } else {
      console.log('  ❌ FAILED: Should have auto-approved');
      failed++;
    }
  } catch (error) {
    console.log('  ❌ FAILED:', error);
    failed++;
  }
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(50));
  
  return { passed, failed };
}

// Run if executed directly
if (require.main === module) {
  runTests()
    .then(({ passed, failed }) => {
      process.exit(failed > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('Test suite failed:', error);
      process.exit(1);
    });
}

export { runTests };
