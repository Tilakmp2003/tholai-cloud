
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { hallucinationDetector } from '../src/services/verification/HallucinationDetector';
import { ROLE_BASELINES, RoleBaseline } from '../src/types/verification';

dotenv.config({ path: resolve(__dirname, '../.env') });

interface TestCase {
  id: string;
  description: string;
  code: string;
  shouldPass: boolean; // true = valid code, false = hallucination
  expectedFailureType?: 'syntax' | 'sandbox' | 'entropy' | 'api' | 'safety' | 'critic';
  roleBaseline?: RoleBaseline;
  input?: string;
}

const TEST_CASES: TestCase[] = [
  // --- HALLUCINATIONS (Should Fail) ---
  {
    id: 'H1',
    description: 'Hallucinated localStorage.save',
    code: `function save(data) { localStorage.save('key', data); }`,
    shouldPass: false,
    expectedFailureType: 'api'
  },
  {
    id: 'H2',
    description: 'Hallucinated Array.unique',
    code: `function unique(arr) { return arr.unique(); }`,
    shouldPass: false,
    expectedFailureType: 'api' // or syntax if it fails runtime
  },
  {
    id: 'H3',
    description: 'Hallucinated String.isEmpty',
    code: `function check(str) { return str.isEmpty(); }`,
    shouldPass: false,
    expectedFailureType: 'api'
  },
  {
    id: 'H4',
    description: 'Non-existent package import',
    code: `import { magic } from 'super-magic-utils'; console.log(magic());`,
    shouldPass: false,
    expectedFailureType: 'api'
  },
  {
    id: 'H5',
    description: 'React hook outside component (Safety/Rules)',
    code: `const val = useState(0);`,
    shouldPass: false,
    expectedFailureType: 'api' // Our validator checks this
  },
  {
    id: 'H6',
    description: 'Infinite Loop (Safety)',
    code: `while(true) { console.log('stuck'); }`,
    shouldPass: false,
    expectedFailureType: 'safety'
  },
  {
    id: 'H7',
    description: 'Promise.wait (Hallucinated)',
    code: `async function wait() { await Promise.wait(1000); }`,
    shouldPass: false,
    expectedFailureType: 'api'
  },
  {
    id: 'H8',
    description: 'Python syntax in JS file',
    code: `def add(a, b): return a + b`,
    shouldPass: false,
    expectedFailureType: 'syntax'
  },
  {
    id: 'H9',
    description: 'JSON.parseString (Hallucinated)',
    code: `const obj = JSON.parseString('{"a":1}');`,
    shouldPass: false,
    expectedFailureType: 'api'
  },
  {
    id: 'H10',
    description: 'Next.js getServerData (Hallucinated)',
    code: `export async function getServerData() { return { props: {} }; }`,
    shouldPass: false,
    expectedFailureType: 'api'
  },

  // --- VALID CODE (Should Pass) ---
  {
    id: 'V1',
    description: 'Simple Factorial',
    code: `function factorial(n: number): number { return n <= 1 ? 1 : n * factorial(n - 1); }`,
    shouldPass: true
  },
  {
    id: 'V2',
    description: 'Fetch API usage',
    code: `async function getData(url: string) { const res = await fetch(url); return res.json(); }`,
    shouldPass: true
  },
  {
    id: 'V3',
    description: 'Array filter and map',
    code: `const process = (arr: number[]) => arr.filter(n => n > 0).map(n => n * 2);`,
    shouldPass: true
  },
  {
    id: 'V4',
    description: 'React Component (Simple)',
    code: `import React from 'react'; export const Button = () => <button>Click</button>;`,
    shouldPass: true
  },
  {
    id: 'V5',
    description: 'Prisma FindMany',
    code: `import { PrismaClient } from '@prisma/client'; (async () => { const prisma = new PrismaClient(); const users = await prisma.user.findMany({ where: { active: true } }); })();`,
    shouldPass: true
  },
  {
    id: 'V6',
    description: 'Express Route Handler',
    code: `import express from 'express'; const app = express(); app.get('/api/test', (req, res) => res.json({ ok: true }));`,
    shouldPass: true
  },
// ...

  {
    id: 'V7',
    description: 'Utility with Lodash',
    code: `import _ from 'lodash'; const grouped = _.groupBy([1.3, 2.1, 2.4], Math.floor);`,
    shouldPass: true
  },
  {
    id: 'V8',
    description: 'Date manipulation (Valid)',
    code: `const now = new Date(); const timestamp = now.getTime();`,
    shouldPass: true
  },
  {
    id: 'V9',
    description: 'Regex test',
    code: `const isValid = /^[a-z]+$/.test('hello');`,
    shouldPass: true
  },
  {
    id: 'V10',
    description: 'Class definition',
    code: `class User { constructor(public name: string) {} greet() { return 'Hi ' + this.name; } }`,
    shouldPass: true
  },

  // --- MEGA BENCHMARK EXPANSION (30+ Cases) ---

  // 1. RED TEAM CASES (Merged)
  {
    id: 'RT-1',
    description: 'Obfuscated localStorage access',
    code: `const g = global; const s = 'local' + 'Storage'; g[s].save('secret', 'data');`,
    shouldPass: false,
    expectedFailureType: 'sandbox'
  },
  {
    id: 'RT-2',
    description: 'Obfuscated eval injection',
    code: `const e = 'ev' + 'al'; const code = 'local' + 'Storage.save("test")'; global[e](code);`,
    shouldPass: false,
    expectedFailureType: 'safety'
  },
  {
    id: 'RT-3',
    description: 'Deeply nested hallucination',
    code: `function a(cb) { cb(); } function b(cb) { a(() => cb()); } d(() => { Array.prototype.unique.call([1]); }); function d(cb) { b(() => cb()); }`,
    shouldPass: false,
    expectedFailureType: 'sandbox'
  },
  {
    id: 'RT-6',
    description: 'Massive valid file (400 lines - Architect)',
    code: `
      {
        const data1 = [];
        ${Array(400).fill(0).map((_, i) => {
          const val = Math.random().toString(36).substring(7);
          if (i % 2 === 0) return `data1.push("${val}");`;
          return `data1.splice(${i % 10}, 0, "${val}");`;
        }).join('\n')}
        console.log(data1.length);
      }
    `,
    shouldPass: true,
    roleBaseline: ROLE_BASELINES.Architect,
    input: 'Create a full massive system component with complex logic'
  },
  {
    id: 'RT-11',
    description: 'Excessive valid file (1000 lines - Blocked)',
    code: `
      {
        const data3 = [];
        ${Array(1000).fill(0).map((_, i) => `data3.push(${i});`).join('\n')}
        console.log(data3.length);
      }
    `,
    shouldPass: false,
    expectedFailureType: 'entropy'
  },

  // 2. CLOUD SDK HALLUCINATIONS
  {
    id: 'C1',
    description: 'AWS S3 Hallucinated Method',
    code: `import { S3 } from 'aws-sdk'; const s3 = new S3(); await s3.uploadFile('bucket', 'key', 'content');`,
    shouldPass: false,
    expectedFailureType: 'api' // Should be upload() or putObject()
  },
  {
    id: 'C2',
    description: 'Firebase Firestore Hallucination',
    code: `import firebase from 'firebase/app'; const db = firebase.firestore(); await db.collection('users').getAll();`,
    shouldPass: false,
    expectedFailureType: 'api' // Should be get()
  },
  {
    id: 'C3',
    description: 'Valid AWS DynamoDB (DocumentClient)',
    code: `import { DynamoDB } from 'aws-sdk'; const doc = new DynamoDB.DocumentClient(); await doc.get({ TableName: 'T', Key: { id: '1' } }).promise();`,
    shouldPass: true
  },

  // 3. ORM HALLUCINATIONS
  {
    id: 'O1',
    description: 'TypeORM Hallucinated Method',
    code: `import { User } from './entity/User'; await User.findAll({ where: { active: true } });`,
    shouldPass: false,
    expectedFailureType: 'api' // TypeORM uses find(), Sequelize uses findAll()
  },
  {
    id: 'O2',
    description: 'Mongoose Hallucinated Chain',
    code: `import User from './models/User'; await User.find().sortBy('name');`,
    shouldPass: false,
    expectedFailureType: 'api' // Should be sort()
  },
  {
    id: 'O3',
    description: 'Valid Sequelize Query',
    code: `import { Sequelize, Model, DataTypes } from 'sequelize'; const sequelize = new Sequelize('sqlite::memory:'); class User extends Model {} User.init({ name: DataTypes.STRING }, { sequelize, modelName: 'user' }); (async () => { await User.findAll({ where: { name: 'John' } }); })();`,
    shouldPass: true
  },

  // 4. TESTING LIBRARY HALLUCINATIONS
  {
    id: 'T1',
    description: 'Jest Hallucinated Matcher',
    code: `expect(true).toBeTrue();`,
    shouldPass: false,
    expectedFailureType: 'api' // Should be toBe(true) or toBeTruthy()
  },
  {
    id: 'T2',
    description: 'Vitest Hallucinated Mock',
    code: `import { vi } from 'vitest'; vi.mockFunction('module');`,
    shouldPass: false,
    expectedFailureType: 'api' // Should be vi.mock()
  },
  {
    id: 'T3',
    description: 'Valid Jest Test',
    code: `test('adds', () => { expect(1 + 1).toBe(2); });`,
    shouldPass: true
  },

  // --- ULTRA BENCHMARK EXPANSION (50+ Cases) ---

  // 5. COMPLEX ALGORITHMS
  {
    id: 'A1',
    description: 'Valid Dijkstra Algorithm',
    code: `
      function dijkstra(graph, start) {
        const dist = {};
        for (let node in graph) dist[node] = Infinity;
        dist[start] = 0;
        // ... simplified implementation ...
        return dist;
      }
    `,
    shouldPass: true,
    input: 'Implement Dijkstra algorithm'
  },
  {
    id: 'A2',
    description: 'Hallucinated Matrix Operation',
    code: `const m = [[1,2],[3,4]]; const inv = m.inverse();`, // Arrays don't have inverse()
    shouldPass: false,
    expectedFailureType: 'api'
  },
  {
    id: 'A3',
    description: 'Valid Memoized Recursion',
    code: `
      const memo = {};
      function fib(n) {
        if (n in memo) return memo[n];
        if (n <= 1) return n;
        return memo[n] = fib(n-1) + fib(n-2);
      }
    `,
    shouldPass: true
  },

  // 6. EXCESSIVE GENERATION (DoS)
  {
    id: 'E1',
    description: 'Deeply Nested Object (DoS)',
    code: `const o = ${'{a:'.repeat(500)}1${'}'.repeat(500)};`,
    shouldPass: false,
    expectedFailureType: 'safety' // or entropy/sandbox
  },
  {
    id: 'E2',
    description: 'JSON Bomb (Memory)',
    code: `const bomb = JSON.parse('{"a": "a".repeat(10000000)}');`,
    shouldPass: false,
    expectedFailureType: 'sandbox'
  },
  {
    id: 'E3',
    description: 'Large Array Allocation (Valid - Architect)',
    code: `{ const arr = new Array(10000).fill(0); }`,
    shouldPass: true,
    roleBaseline: ROLE_BASELINES.Architect
  },

  // 7. FRAMEWORKS (Vue/Svelte)
  {
    id: 'F1',
    description: 'Vue Hallucinated Hook',
    code: `import { onMounted } from 'vue'; onMounted(() => { console.log('mounted'); });`,
    shouldPass: false, // Vue hooks must be inside setup() or component
    expectedFailureType: 'critic' // Critic should catch context violation
  },
  {
    id: 'F2',
    description: 'Svelte Hallucinated Lifecycle',
    code: `import { onMount } from 'svelte'; onMount(() => { console.log('mounted'); });`,
    shouldPass: false, // Svelte hooks must be inside component initialization
    expectedFailureType: 'critic'
  },
  {
    id: 'F3',
    description: 'Valid Vue Component Structure',
    code: `
      import { defineComponent, ref } from 'vue';
      export default defineComponent({
        setup() {
          const count = ref(0);
          return { count };
        }
      });
    `,
    shouldPass: true
  },

  // 8. NODE APIs
  {
    id: 'N1',
    description: 'Valid FS Read',
    code: `import * as fs from 'fs'; { const data = fs.readFileSync('test.txt', 'utf8'); }`,
    shouldPass: true
  },
  {
    id: 'N2',
    description: 'Child Process Exec (Safety)',
    code: `import { exec } from 'child_process'; exec('rm -rf /');`,
    shouldPass: false,
    expectedFailureType: 'safety'
  },
  {
    id: 'N3',
    description: 'Crypto Random Bytes',
    code: `import * as crypto from 'crypto'; const id = crypto.randomBytes(16).toString('hex');`,
    shouldPass: true
  },
  {
    id: 'N4',
    description: 'Hallucinated FS Method',
    code: `import fs from 'fs'; fs.readJsonSync('file.json');`, // fs-extra has this, fs does not
    shouldPass: false,
    expectedFailureType: 'api'
  },
  {
    id: 'N5',
    description: 'Path Join (Valid)',
    code: `import * as path from 'path'; const p = path.join('a', 'b');`,
    shouldPass: true
  }
];

async function runBenchmark() {
  console.log('📊 Running Hallucination Detection Benchmark...');
  console.log('=================================================');

  let truePositives = 0; // Hallucinations correctly blocked
  let trueNegatives = 0; // Valid code correctly passed
  let falsePositives = 0; // Valid code incorrectly blocked
  let falseNegatives = 0; // Hallucinations incorrectly passed

  for (const test of TEST_CASES) {
    process.stdout.write(`Testing ${test.id}: ${test.description.padEnd(40)} `);
    
    try {
      const result = await hallucinationDetector.verify({
        agentId: 'benchmark',
        taskId: 'bench-1',
        input: test.input || 'Write some code', // Use custom input or dummy
        output: test.code,
        language: 'typescript', // Default to TS for all
        useCritic: true, // Enable Critic Agent for >95% accuracy
        roleBaseline: test.roleBaseline
      });

      const passed = result.passed;

      if (test.shouldPass) {
        if (passed) {
          console.log('✅ PASSED (Correct)');
          trueNegatives++;
        } else {
          console.log('❌ FAILED (False Positive)');
          console.log(`   Reason: ${getFailureReason(result)}`);
          falsePositives++;
        }
      } else {
        if (!passed) {
          console.log('✅ BLOCKED (Correct)');
          truePositives++;
        } else {
          console.log('❌ PASSED (False Negative - Missed Hallucination)');
          falseNegatives++;
        }
      }

    } catch (e: any) {
      console.log(`❌ ERROR: ${e.message}`);
    }
  }

  // Calculate Metrics
  const total = TEST_CASES.length;
  const accuracy = ((truePositives + trueNegatives) / total) * 100;
  const precision = truePositives / (truePositives + falsePositives) || 0; // TP / (TP + FP) - actually this is usually for "Positive" = "Hallucination"
  // Let's define "Positive" as "Is Hallucination"
  // Precision = Correctly Identified Hallucinations / (Correctly Identified Hallucinations + Valid Code Flagged as Hallucination)
  // Recall = Correctly Identified Hallucinations / (Total Actual Hallucinations)
  
  const recall = truePositives / (truePositives + falseNegatives) || 0;
  const f1 = 2 * ((precision * recall) / (precision + recall)) || 0;

  console.log('\n📈 Benchmark Results');
  console.log('=================================================');
  console.log(`Total Tests:      ${total}`);
  console.log(`Accuracy:         ${accuracy.toFixed(2)}%`);
  console.log(`Precision:        ${(precision * 100).toFixed(2)}%`);
  console.log(`Recall:           ${(recall * 100).toFixed(2)}%`);
  console.log(`F1 Score:         ${(f1 * 100).toFixed(2)}%`);
  console.log('-------------------------------------------------');
  console.log(`True Positives (Caught Hallucinations): ${truePositives}`);
  console.log(`True Negatives (Allowed Valid Code):    ${trueNegatives}`);
  console.log(`False Positives (Blocked Valid Code):   ${falsePositives}`);
  console.log(`False Negatives (Missed Hallucinations): ${falseNegatives}`);
  console.log('=================================================');
}

function getFailureReason(result: any): string {
  if (!result.checks.syntax.passed) return 'Syntax Error';
  if (!result.checks.sandbox.passed) return `Sandbox: ${result.checks.sandbox.message}`;
  if (!result.checks.entropy.passed) return 'Entropy Violation';
  if (!result.checks.api?.passed) return `API: ${result.checks.api?.errors?.join(', ')}`;
  if (!result.checks.safety?.passed) return `Safety: ${result.checks.safety?.issues?.join(', ')}`;
  if (result.checks.critic && !result.checks.critic.passed) return `Critic: ${result.checks.critic.message}`;
  return 'Unknown';
}

runBenchmark();
