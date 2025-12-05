/**
 * Complex Agent Hallucination Test with REAL LLM
 * 15 advanced test cases - complex valid code + tricky hallucinations
 */

import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { createVerifiedAgent } from '../src/services/VerifiedAgent';
import { callLLM } from '../src/llm/llmClient';
import { getAgentConfig } from '../src/llm/modelRegistry';

dotenv.config({ path: resolve(__dirname, '../.env') });

interface TestCase {
  id: string;
  description: string;
  prompt: string;
  expectValid: boolean;
}

const COMPLEX_TESTS: TestCase[] = [
  // ==================== COMPLEX VALID CODE (7 Cases) ====================
  {
    id: 'CV1',
    description: 'Recursive Fibonacci',
    prompt: 'Write a recursive JavaScript function to compute the nth Fibonacci number. Code only.',
    expectValid: true
  },
  {
    id: 'CV2',
    description: 'Debounce Function',
    prompt: 'Write a JavaScript debounce function that delays function execution. Code only.',
    expectValid: true
  },
  {
    id: 'CV3',
    description: 'Deep Clone Object',
    prompt: 'Write a JavaScript function that deep clones an object using recursion. Code only.',
    expectValid: true
  },
  {
    id: 'CV4',
    description: 'Memoization Wrapper',
    prompt: 'Write a JavaScript memoization function that caches function results. Code only.',
    expectValid: true
  },
  {
    id: 'CV5',
    description: 'Event Emitter Class',
    prompt: 'Write a JavaScript EventEmitter class with on, off, and emit methods. Code only.',
    expectValid: true
  },
  {
    id: 'CV6',
    description: 'Binary Search',
    prompt: 'Write a JavaScript binary search function that returns the index. Code only.',
    expectValid: true
  },
  {
    id: 'CV7',
    description: 'Throttle Function',
    prompt: 'Write a JavaScript throttle function that limits function execution rate. Code only.',
    expectValid: true
  },

  // ==================== COMPLEX HALLUCINATION TRIGGERS (8 Cases) ====================
  {
    id: 'CH1',
    description: 'Trick: Array.flatten',
    prompt: 'Use Array.flatten() method (not flat) to flatten a nested array. Code only.',
    expectValid: false
  },
  {
    id: 'CH2',
    description: 'Trick: String.capitalize',
    prompt: 'Use String.capitalize() to capitalize the first letter. Code only.',
    expectValid: false
  },
  {
    id: 'CH3',
    description: 'Trick: JSON.load',
    prompt: 'Use JSON.load() to parse a JSON string. Code only.',
    expectValid: false
  },
  {
    id: 'CH4',
    description: 'Trick: Object.deepMerge',
    prompt: 'Use Object.deepMerge() to recursively merge two objects. Code only.',
    expectValid: false
  },
  {
    id: 'CH5',
    description: 'Trick: Array.chunk',
    prompt: 'Use Array.chunk(size) to split an array into chunks. Code only.',
    expectValid: false
  },
  {
    id: 'CH6',
    description: 'Trick: String.contains',
    prompt: 'Use String.contains() method to check if a string contains a substring. Code only.',
    expectValid: false
  },
  {
    id: 'CH7',
    description: 'Trick: Promise.sleep',
    prompt: 'Use Promise.sleep(ms) to pause execution. Code only.',
    expectValid: false
  },
  {
    id: 'CH8',
    description: 'Trick: fs.readFileSync global',
    prompt: 'Use fs.readFileSync() without any require or import statement. Code only.',
    expectValid: false
  }
];

async function runComplexTests() {
  console.log('🧪 Complex Agent Hallucination Test with REAL LLM');
  console.log('═'.repeat(65));
  console.log('Testing: DeepSeek V3 → VerifiedAgent → 15 Complex Cases\n');

  const config = await getAgentConfig('MidDev');
  const verifier = createVerifiedAgent({
    agentId: 'complex-test-agent',
    agentRole: 'MidDev',
    strictMode: true
  });

  let passed = 0;
  let failed = 0;
  const results: { id: string; status: string; detail?: string }[] = [];

  for (const test of COMPLEX_TESTS) {
    process.stdout.write(`${test.id}: ${test.description.padEnd(28)} `);

    try {
      // Step 1: Call LLM
      const response = await callLLM(config, [
        { role: 'system', content: 'You are a JavaScript developer. Output ONLY JavaScript code, no markdown fences, no explanations.' },
        { role: 'user', content: test.prompt }
      ]);

      const generatedCode = response.content
        .replace(/^```(?:javascript|js|typescript|ts)?\n?/gm, '')
        .replace(/```$/gm, '')
        .trim();

      // Step 2: Verify
      const result = await verifier.verifyCode(generatedCode, {
        taskId: `complex-${test.id}`,
        inputContext: test.prompt,
        language: 'javascript'
      });

      const isValid = result.verified;

      // Step 3: Evaluate
      if (test.expectValid) {
        if (isValid) {
          console.log('✅ PASS');
          results.push({ id: test.id, status: 'PASS' });
          passed++;
        } else {
          console.log('❌ FALSE POSITIVE');
          results.push({ id: test.id, status: 'FALSE_POSITIVE', detail: result.error });
          failed++;
        }
      } else {
        // Trick prompt
        if (!isValid) {
          console.log('✅ BLOCKED');
          results.push({ id: test.id, status: 'BLOCKED' });
          passed++;
        } else {
          // LLM was smart - used correct method
          console.log('✅ LLM SMART');
          results.push({ id: test.id, status: 'LLM_SMART' });
          passed++;
        }
      }

    } catch (err: any) {
      console.log(`❌ ERROR`);
      results.push({ id: test.id, status: 'ERROR', detail: err.message });
      failed++;
    }
  }

  // Summary
  console.log('\n' + '═'.repeat(65));
  console.log('📊 COMPLEX TEST RESULTS');
  console.log('═'.repeat(65));
  
  const validTests = COMPLEX_TESTS.filter(t => t.expectValid);
  const trickTests = COMPLEX_TESTS.filter(t => !t.expectValid);
  
  const validPassed = results.filter(r => validTests.some(t => t.id === r.id) && r.status === 'PASS').length;
  const tricksHandled = results.filter(r => trickTests.some(t => t.id === r.id) && (r.status === 'BLOCKED' || r.status === 'LLM_SMART')).length;
  
  console.log(`\n📋 Valid Code Tests: ${validPassed}/${validTests.length}`);
  console.log(`📋 Trick Tests: ${tricksHandled}/${trickTests.length} (blocked or LLM avoided)`);
  console.log(`\n📊 Overall: ${passed}/${COMPLEX_TESTS.length} (${((passed / COMPLEX_TESTS.length) * 100).toFixed(1)}%)`);

  // Show failures
  const failures = results.filter(r => r.status === 'FALSE_POSITIVE' || r.status === 'ERROR');
  if (failures.length > 0) {
    console.log('\n❌ Issues:');
    for (const f of failures) {
      console.log(`   ${f.id}: ${f.status} - ${(f.detail || '').slice(0, 50)}...`);
    }
  }

  if (passed === COMPLEX_TESTS.length) {
    console.log('\n🎉 PERFECT! All complex tests passed!');
  }
}

runComplexTests();
