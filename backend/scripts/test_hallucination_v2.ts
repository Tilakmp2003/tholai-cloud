/**
 * Complex Hallucination Benchmark v2
 * 25 diverse test cases to evaluate the Hallucination Detection System
 * 
 * Categories:
 * - Valid Complex Code (12 cases)
 * - Hallucinations (13 cases)
 */

import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { hallucinationDetector } from '../src/services/verification/HallucinationDetector';

dotenv.config({ path: resolve(__dirname, '../.env') });

interface TestCase {
  id: string;
  description: string;
  code: string;
  shouldPass: boolean;
}

const TEST_CASES: TestCase[] = [
  // ==================== VALID COMPLEX CODE (12 Cases) ====================
  
  // V1: Advanced Data Structures
  {
    id: 'V1',
    description: 'Valid Trie Implementation',
    code: `
class TrieNode {
  constructor() {
    this.children = {};
    this.isEnd = false;
  }
}
class Trie {
  constructor() { this.root = new TrieNode(); }
  insert(word) {
    let node = this.root;
    for (const char of word) {
      if (!node.children[char]) node.children[char] = new TrieNode();
      node = node.children[char];
    }
    node.isEnd = true;
  }
  search(word) {
    let node = this.root;
    for (const char of word) {
      if (!node.children[char]) return false;
      node = node.children[char];
    }
    return node.isEnd;
  }
}`,
    shouldPass: true
  },

  // V2: Async/Await Patterns
  {
    id: 'V2',
    description: 'Valid Promise.all with Error Handling',
    code: `
async function fetchMultiple(urls) {
  const results = await Promise.all(
    urls.map(async (url) => {
      try {
        const res = await fetch(url);
        return { success: true, data: await res.json() };
      } catch (e) {
        return { success: false, error: e.message };
      }
    })
  );
  return results.filter(r => r.success);
}`,
    shouldPass: true
  },

  // V3: Functional Programming
  {
    id: 'V3',
    description: 'Valid Compose and Pipe Functions',
    code: `
const compose = (...fns) => x => fns.reduceRight((acc, fn) => fn(acc), x);
const pipe = (...fns) => x => fns.reduce((acc, fn) => fn(acc), x);
const double = x => x * 2;
const addTen = x => x + 10;
const result = pipe(double, addTen)(5); // 20`,
    shouldPass: true
  },

  // V4: Generator Functions
  {
    id: 'V4',
    description: 'Valid Infinite Sequence Generator',
    code: `
function* fibonacci() {
  let a = 0, b = 1;
  while (true) {
    yield a;
    [a, b] = [b, a + b];
  }
}
function take(gen, n) {
  const result = [];
  for (let i = 0; i < n; i++) result.push(gen.next().value);
  return result;
}`,
    shouldPass: true
  },

  // V5: Modern JavaScript
  {
    id: 'V5',
    description: 'Valid WeakMap for Private Data',
    code: `
const privateData = new WeakMap();
class User {
  constructor(name, password) {
    privateData.set(this, { password });
    this.name = name;
  }
  checkPassword(input) {
    return privateData.get(this).password === input;
  }
}`,
    shouldPass: true
  },

  // V6: DOM Manipulation (Valid)
  {
    id: 'V6',
    description: 'Valid DOM Event Delegation',
    code: `
function delegate(container, selector, event, handler) {
  container.addEventListener(event, function(e) {
    const target = e.target.closest(selector);
    if (target && container.contains(target)) {
      handler.call(target, e);
    }
  });
}`,
    shouldPass: true
  },

  // V7: Debounce/Throttle
  {
    id: 'V7',
    description: 'Valid Debounce Implementation',
    code: `
function debounce(fn, delay) {
  let timeoutId;
  return function(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), delay);
  };
}`,
    shouldPass: true
  },

  // V8: Object Cloning
  {
    id: 'V8',
    description: 'Valid Structured Clone Alternative',
    code: `
function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj);
  if (obj instanceof Array) return obj.map(item => deepClone(item));
  if (obj instanceof Object) {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, deepClone(v)])
    );
  }
}`,
    shouldPass: true
  },

  // V9: Valid HTTP Client
  {
    id: 'V9',
    description: 'Valid Fetch Wrapper with Retry',
    code: `
async function fetchWithRetry(url, options = {}, retries = 3) {
  try {
    const response = await fetch(url, options);
    if (!response.ok) throw new Error('HTTP Error');
    return response.json();
  } catch (error) {
    if (retries > 0) return fetchWithRetry(url, options, retries - 1);
    throw error;
  }
}`,
    shouldPass: true
  },

  // V10: Valid State Machine
  {
    id: 'V10',
    description: 'Valid Finite State Machine',
    code: `
class StateMachine {
  constructor(initialState, transitions) {
    this.state = initialState;
    this.transitions = transitions;
  }
  transition(action) {
    const key = this.state + ':' + action;
    if (this.transitions[key]) {
      this.state = this.transitions[key];
      return true;
    }
    return false;
  }
}`,
    shouldPass: true
  },

  // V11: Valid Array Methods
  {
    id: 'V11',
    description: 'Valid Array Grouping',
    code: `
function groupBy(arr, keyFn) {
  return arr.reduce((acc, item) => {
    const key = keyFn(item);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
}`,
    shouldPass: true
  },

  // V12: Valid Memoization
  {
    id: 'V12',
    description: 'Valid Generic Memoize',
    code: `
function memoize(fn) {
  const cache = new Map();
  return function(...args) {
    const key = JSON.stringify(args);
    if (cache.has(key)) return cache.get(key);
    const result = fn.apply(this, args);
    cache.set(key, result);
    return result;
  };
}`,
    shouldPass: true
  },

  // ==================== HALLUCINATIONS (13 Cases) ====================

  // H1: Fake Array Methods
  {
    id: 'H1',
    description: 'Hallucinated Array.unique()',
    code: `const arr = [1,2,2,3]; const unique = arr.unique();`,
    shouldPass: false
  },

  // H2: Fake String Methods
  {
    id: 'H2',
    description: 'Hallucinated String.reverse()',
    code: `const str = "hello"; const reversed = str.reverse();`,
    shouldPass: false
  },

  // H3: Fake Object Methods
  {
    id: 'H3',
    description: 'Hallucinated Object.merge()',
    code: `const merged = Object.merge({a:1}, {b:2});`,
    shouldPass: false
  },

  // H4: Python-style Methods
  {
    id: 'H4',
    description: 'Hallucinated list.append()',
    code: `const list = []; list.append(1);`,
    shouldPass: false
  },

  // H5: Fake Promise Methods
  {
    id: 'H5',
    description: 'Hallucinated Promise.wait()',
    code: `await Promise.wait(1000);`,
    shouldPass: false
  },

  // H6: Fake Number Methods
  {
    id: 'H6',
    description: 'Hallucinated Number.range()',
    code: `const nums = Number.range(1, 10);`,
    shouldPass: false
  },

  // H7: Deprecated React API
  {
    id: 'H7',
    description: 'Hallucinated React.createClass',
    code: `import React from 'react'; const Comp = React.createClass({ render() { return <div />; } });`,
    shouldPass: false
  },

  // H8: Fake lodash-style
  {
    id: 'H8',
    description: 'Hallucinated Array.flatten() depth',
    code: `const arr = [[1,2],[3,[4]]]; const flat = arr.flatten(2);`,
    shouldPass: false
  },

  // H9: Fake Math Methods
  {
    id: 'H9',
    description: 'Hallucinated Math.clamp()',
    code: `const clamped = Math.clamp(15, 0, 10);`,
    shouldPass: false
  },

  // H10: Fake Date Methods
  {
    id: 'H10',
    description: 'Hallucinated Date.format()',
    code: `const d = new Date(); const fmt = d.format('YYYY-MM-DD');`,
    shouldPass: false
  },

  // H11: Global Variable Without Import
  {
    id: 'H11',
    description: 'Hallucinated axios without import',
    code: `const data = await axios.get('/api/users');`,
    shouldPass: false
  },

  // H12: Fake Console Methods
  {
    id: 'H12',
    description: 'Hallucinated console.success()',
    code: `console.success('Operation completed!');`,
    shouldPass: false
  },

  // H13: Java-style Syntax
  {
    id: 'H13',
    description: 'Hallucinated System.out.println',
    code: `System.out.println("Hello World");`,
    shouldPass: false
  }
];

async function runBenchmark() {
  console.log('🧪 Complex Hallucination Benchmark v2 (25 Cases)');
  console.log('================================================');
  console.log('Testing the ORIGINAL Hallucination Detection System\n');

  let passed = 0;
  let failed = 0;

  for (const test of TEST_CASES) {
    process.stdout.write(`${test.id}: ${test.description.padEnd(45)} `);
    
    try {
      const result = await hallucinationDetector.verify({
        agentId: 'benchmark-v2',
        taskId: 'bench-v2',
        input: 'Implement the requested functionality',
        output: test.code,
        language: 'typescript',
        useCritic: true
      });

      if (test.shouldPass) {
        if (result.passed) {
          console.log('✅ PASS');
          passed++;
        } else {
          console.log('❌ FALSE POSITIVE');
          failed++;
        }
      } else {
        if (!result.passed) {
          console.log('✅ BLOCKED');
          passed++;
        } else {
          console.log('❌ FALSE NEGATIVE');
          failed++;
        }
      }
    } catch (e: any) {
      console.log(`❌ ERROR: ${e.message}`);
      failed++;
    }
  }

  console.log('\n================================================');
  console.log('📊 RESULTS');
  console.log('================================================');
  console.log(`Total:    ${TEST_CASES.length}`);
  console.log(`Passed:   ${passed}`);
  console.log(`Failed:   ${failed}`);
  console.log(`Accuracy: ${((passed / TEST_CASES.length) * 100).toFixed(2)}%`);
}

runBenchmark();
