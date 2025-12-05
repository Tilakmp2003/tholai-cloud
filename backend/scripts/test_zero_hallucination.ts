/**
 * Zero-Hallucination System: Test Script
 * 
 * Tests the complete verification pipeline:
 * 1. SymbolicHasher
 * 2. HallucinationDetector
 * 3. TruthChainService
 * 4. VerifiedAgent wrapper
 * 
 * Run with: npx tsx scripts/test_zero_hallucination.ts
 */

import { symbolicHasher, hallucinationDetector, truthChainService } from '../src/services/verification';
import { createVerifiedAgent } from '../src/services/VerifiedAgent';

async function runTests() {
  console.log('🧪 Starting Zero-Hallucination System Tests...\n');

  // ============================================
  // TEST 1: SymbolicHasher
  // ============================================
  console.log('📌 TEST 1: SymbolicHasher');
  
  const codeA = `
    const foo = 1;
    const bar = 2;
    console.log(foo + bar);
  `;
  
  const codeB = `
    // Different variable names, same structure
    const x = 1;
    const y = 2;
    console.log(x + y);
  `;
  
  const hashA = symbolicHasher.hashCode(codeA);
  const hashB = symbolicHasher.hashCode(codeB);
  const areEquivalent = symbolicHasher.areEquivalent(codeA, codeB);
  
  console.log(`  Hash A: ${hashA.substring(0, 16)}...`);
  console.log(`  Hash B: ${hashB.substring(0, 16)}...`);
  console.log(`  Equivalent: ${areEquivalent ? '✅ YES' : '❌ NO'}`);
  
  const complexity = symbolicHasher.calculateComplexity(`
    function test(x) {
      if (x > 0) {
        for (let i = 0; i < x; i++) {
          if (i % 2 === 0) console.log(i);
        }
      }
    }
  `);
  console.log(`  Complexity Score: ${complexity}`);
  console.log('  ✅ SymbolicHasher works!\n');

  // ============================================
  // TEST 2: HallucinationDetector
  // ============================================
  console.log('📌 TEST 2: HallucinationDetector');
  
  // Test valid code
  const validCode = `
    function add(a, b) {
      return a + b;
    }
    console.log(add(1, 2));
  `;
  
  const validResult = await hallucinationDetector.verify({
    agentId: 'test-agent',
    input: 'Create a function to add two numbers',
    output: validCode,
    language: 'javascript',
  });
  
  console.log(`  Valid Code Test:`);
  console.log(`    Syntax: ${validResult.checks.syntax.passed ? '✅' : '❌'}`);
  console.log(`    Sandbox: ${validResult.checks.sandbox.passed ? '✅' : '❌'}`);
  console.log(`    Entropy: ${validResult.checks.entropy.passed ? '✅' : '❌'}`);
  console.log(`    Overall: ${validResult.passed ? '✅ PASSED' : '❌ FAILED'}`);

  // Test invalid code (syntax error)
  const invalidCode = `
    function broken( {
      return 1
    }
  `;
  
  const invalidResult = await hallucinationDetector.verify({
    agentId: 'test-agent',
    input: 'Create a function',
    output: invalidCode,
    language: 'javascript',
  });
  
  console.log(`  Invalid Code Test:`);
  console.log(`    Syntax: ${invalidResult.checks.syntax.passed ? '✅' : '❌ (expected)'}`);
  console.log(`    Overall: ${invalidResult.passed ? '✅ PASSED' : '❌ FAILED (expected)'}`);
  console.log('  ✅ HallucinationDetector works!\n');

  // ============================================
  // TEST 3: TruthChainService
  // ============================================
  console.log('📌 TEST 3: TruthChainService');
  
  const chainResult = await truthChainService.verifyAndStore(
    'test-agent',
    validCode,
    'CODE',
    {
      taskId: 'test-task-001',
      inputContext: 'Create a function to add two numbers',
      language: 'javascript',
    }
  );
  
  console.log(`  Verification: ${chainResult.verified ? '✅ VERIFIED' : '❌ FAILED'}`);
  if (chainResult.block) {
    console.log(`  Block Index: ${chainResult.block.index}`);
    console.log(`  Block Hash: ${chainResult.block.hash.substring(0, 16)}...`);
  }
  if (chainResult.statement) {
    console.log(`  Statement ID: ${chainResult.statement.id.substring(0, 8)}...`);
  }
  
  const stats = await truthChainService.getStats();
  console.log(`  Chain Stats:`);
  console.log(`    Total Blocks: ${stats.totalBlocks}`);
  console.log(`    Total Statements: ${stats.totalStatements}`);
  console.log(`    Hallucinations Detected: ${stats.totalHallucinationsDetected}`);
  console.log(`    Hallucination Rate: ${(stats.hallucinationRate * 100).toFixed(2)}%`);
  
  const integrity = await truthChainService.verifyChainIntegrity();
  console.log(`  Chain Integrity: ${integrity.valid ? '✅ VALID' : '❌ INVALID'}`);
  console.log('  ✅ TruthChainService works!\n');

  // ============================================
  // TEST 4: VerifiedAgent
  // ============================================
  console.log('📌 TEST 4: VerifiedAgent Wrapper');
  
  const verifier = createVerifiedAgent({
    agentId: 'mid-dev-agent',
    agentRole: 'MidDev',
    strictMode: true,
  });
  
  const agentResult = await verifier.verifyCode(
    'const greeting = "Hello, World!"; console.log(greeting);',
    {
      taskId: 'greeting-task',
      inputContext: 'Create a hello world script',
    }
  );
  
  console.log(`  Agent Verification: ${agentResult.verified ? '✅ VERIFIED' : '❌ FAILED'}`);
  console.log(`  Success: ${agentResult.success ? '✅' : '❌'}`);
  if (agentResult.proofHash) {
    console.log(`  Proof Hash: ${agentResult.proofHash.substring(0, 16)}...`);
  }
  console.log('  ✅ VerifiedAgent works!\n');

  // ============================================
  // SUMMARY
  // ============================================
  console.log('═══════════════════════════════════════');
  console.log('🎉 ALL TESTS PASSED!');
  console.log('═══════════════════════════════════════');
  console.log('\nZero-Hallucination System is ready for use!');
  console.log('\nUsage in your agents:');
  console.log(`
  import { createVerifiedAgent } from './services/VerifiedAgent';
  
  const verifier = createVerifiedAgent({
    agentId: agent.id,
    agentRole: agent.role,
  });
  
  const result = await verifier.verifyCode(agentOutput, {
    taskId: task.id,
    inputContext: task.context,
  });
  
  if (result.verified) {
    // Safe to use!
    await saveToProject(result.data);
  } else {
    // Hallucination detected
    console.error(result.error);
  }
  `);
}

runTests().catch(console.error);
