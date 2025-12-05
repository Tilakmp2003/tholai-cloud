/**
 * Agent Hallucination Test Suite v3
 * 20 pre-defined test cases (10 valid, 10 hallucinations)
 * Tests the VerifiedAgent wrapper directly without LLM variability
 */

import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { createVerifiedAgent } from '../src/services/VerifiedAgent';

dotenv.config({ path: resolve(__dirname, '../.env') });

interface TestCase {
  id: string;
  description: string;
  code: string;
  shouldPass: boolean;
}

const TESTS: TestCase[] = [
  // ==================== VALID CODE (10 Cases) ====================
  {
    id: 'V1',
    description: 'Simple Add Function',
    code: `function add(a, b) { return a + b; }`,
    shouldPass: true
  },
  {
    id: 'V2',
    description: 'Arrow Function',
    code: `const multiply = (x, y) => x * y;`,
    shouldPass: true
  },
  {
    id: 'V3',
    description: 'Array Filter',
    code: `const evens = [1,2,3,4].filter(n => n % 2 === 0);`,
    shouldPass: true
  },
  {
    id: 'V4',
    description: 'Async Function',
    code: `async function getData() { return await Promise.resolve(42); }`,
    shouldPass: true
  },
  {
    id: 'V5',
    description: 'Class Definition',
    code: `class User { constructor(name) { this.name = name; } }`,
    shouldPass: true
  },
  {
    id: 'V6',
    description: 'Object Destructuring',
    code: `const { name, age } = { name: 'John', age: 30 };`,
    shouldPass: true
  },
  {
    id: 'V7',
    description: 'Spread Operator',
    code: `const merged = { ...{ a: 1 }, ...{ b: 2 } };`,
    shouldPass: true
  },
  {
    id: 'V8',
    description: 'Map Method',
    code: `const doubled = [1,2,3].map(n => n * 2);`,
    shouldPass: true
  },
  {
    id: 'V9',
    description: 'Template Literal',
    code: `const greeting = \`Hello, \${'World'}!\`;`,
    shouldPass: true
  },
  {
    id: 'V10',
    description: 'Array Reduce',
    code: `const sum = [1,2,3].reduce((acc, n) => acc + n, 0);`,
    shouldPass: true
  },

  // ==================== HALLUCINATIONS (10 Cases) ====================
  {
    id: 'H1',
    description: 'Array.unique() - Non-existent',
    code: `const unique = [1,2,2,3].unique();`,
    shouldPass: false
  },
  {
    id: 'H2',
    description: 'String.reverse() - Non-existent',
    code: `const rev = "hello".reverse();`,
    shouldPass: false
  },
  {
    id: 'H3',
    description: 'Object.merge() - Non-existent',
    code: `const merged = Object.merge({a:1}, {b:2});`,
    shouldPass: false
  },
  {
    id: 'H4',
    description: 'list.append() - Python syntax',
    code: `const list = []; list.append(1);`,
    shouldPass: false
  },
  {
    id: 'H5',
    description: 'Promise.wait() - Non-existent',
    code: `await Promise.wait(1000);`,
    shouldPass: false
  },
  {
    id: 'H6',
    description: 'Number.range() - Non-existent',
    code: `const nums = Number.range(1, 10);`,
    shouldPass: false
  },
  {
    id: 'H7',
    description: 'Math.clamp() - Non-existent',
    code: `const clamped = Math.clamp(15, 0, 10);`,
    shouldPass: false
  },
  {
    id: 'H8',
    description: 'Date.format() - Non-existent',
    code: `const fmt = new Date().format('YYYY-MM-DD');`,
    shouldPass: false
  },
  {
    id: 'H9',
    description: 'console.success() - Non-existent',
    code: `console.success('Done!');`,
    shouldPass: false
  },
  {
    id: 'H10',
    description: 'Array.flatten(depth) - Wrong name',
    code: `const flat = [[1,2],[3,[4]]].flatten(2);`,
    shouldPass: false
  }
];

async function runTests() {
  console.log('🧪 Agent Hallucination Test Suite v3');
  console.log('═'.repeat(60));
  console.log('Testing VerifiedAgent with 20 pre-defined cases\n');

  const verifier = createVerifiedAgent({
    agentId: 'test-agent',
    agentRole: 'MidDev',
    strictMode: true
  });

  let passed = 0;
  let failed = 0;
  const failures: { id: string; expected: string; got: string; reason?: string }[] = [];

  for (const test of TESTS) {
    process.stdout.write(`${test.id}: ${test.description.padEnd(35)} `);

    try {
      const result = await verifier.verifyCode(test.code, {
        taskId: `test-${test.id}`,
        inputContext: test.description,
        language: 'javascript'
      });

      const isBlocked = !result.verified;
      const matchesExpectation = isBlocked !== test.shouldPass;

      if (matchesExpectation) {
        console.log(test.shouldPass ? '✅ PASS' : '✅ BLOCKED');
        passed++;
      } else {
        console.log(test.shouldPass ? '❌ FALSE POSITIVE' : '❌ FALSE NEGATIVE');
        failures.push({
          id: test.id,
          expected: test.shouldPass ? 'PASS' : 'BLOCK',
          got: test.shouldPass ? 'BLOCKED' : 'PASSED',
          reason: result.error
        });
        failed++;
      }
    } catch (err: any) {
      console.log(`❌ ERROR: ${err.message}`);
      failed++;
    }
  }

  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log('📊 RESULTS');
  console.log('═'.repeat(60));
  console.log(`Total:    ${TESTS.length}`);
  console.log(`Passed:   ${passed}`);
  console.log(`Failed:   ${failed}`);
  console.log(`Accuracy: ${((passed / TESTS.length) * 100).toFixed(1)}%`);

  if (failures.length > 0) {
    console.log('\n📋 Failure Details:');
    for (const f of failures) {
      console.log(`  ${f.id}: Expected ${f.expected}, got ${f.got}`);
      if (f.reason) console.log(`      Reason: ${f.reason.slice(0, 80)}`);
    }
  }

  if (passed === TESTS.length) {
    console.log('\n🎉 PERFECT SCORE! Zero-Hallucination system is working!');
  }
}

runTests();
