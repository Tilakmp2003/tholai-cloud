
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { hallucinationDetector } from '../src/services/verification/HallucinationDetector';
import { ROLE_BASELINES } from '../src/types/verification';

dotenv.config({ path: resolve(__dirname, '../.env') });

interface TestCase {
  id: string;
  description: string;
  code: string;
  shouldPass: boolean;
  expectedFailureType?: string;
}

const COMPLEX_TEST_CASES: TestCase[] = [
  // --- VALID COMPLEX CODE (12 Cases) ---
  {
    id: 'V-C1',
    description: 'Dijkstra Algorithm',
    code: `
      function dijkstra(graph, start) {
        const distances = {};
        const visited = new Set();
        for (let node in graph) distances[node] = Infinity;
        distances[start] = 0;
        
        while (true) {
          let minNode = null;
          for (let node in distances) {
            if (!visited.has(node) && (minNode === null || distances[node] < distances[minNode])) {
              minNode = node;
            }
          }
          if (minNode === null || distances[minNode] === Infinity) break;
          visited.add(minNode);
          for (let neighbor in graph[minNode]) {
            let alt = distances[minNode] + graph[minNode][neighbor];
            if (alt < distances[neighbor]) distances[neighbor] = alt;
          }
        }
        return distances;
      }
    `,
    shouldPass: true
  },
  {
    id: 'V-C2',
    description: 'Async Generator Pagination',
    code: `
      async function* fetchPages(url) {
        let page = 1;
        while (true) {
          const res = await fetch(\`\${url}?page=\${page}\`);
          const data = await res.json();
          if (data.length === 0) break;
          yield data;
          page++;
        }
      }
    `,
    shouldPass: true
  },
  {
    id: 'V-C3',
    description: 'Curried Function Composition',
    code: `
      const add = x => y => x + y;
      const multiply = x => y => x * y;
      const pipe = (...fns) => x => fns.reduce((v, f) => f(v), x);
      const formula = pipe(add(5), multiply(2));
      const result = formula(10); // (10 + 5) * 2 = 30
    `,
    shouldPass: true
  },
  {
    id: 'V-C4',
    description: 'Proxy Object Validation',
    code: `
      const validator = {
        set: function(obj, prop, value) {
          if (prop === 'age') {
            if (!Number.isInteger(value)) throw new TypeError('Age must be an integer');
            if (value > 200) throw new RangeError('Age invalid');
          }
          obj[prop] = value;
          return true;
        }
      };
      const person = new Proxy({}, validator);
    `,
    shouldPass: true
  },
  {
    id: 'V-C5',
    description: 'Memoized Fibonacci',
    code: `
      const memo = new Map();
      function fib(n) {
        if (n <= 1) return n;
        if (memo.has(n)) return memo.get(n);
        const res = fib(n - 1) + fib(n - 2);
        memo.set(n, res);
        return res;
      }
    `,
    shouldPass: true
  },
  {
    id: 'V-C6',
    description: 'Custom EventEmitter',
    code: `
      class EventEmitter {
        constructor() { this.events = {}; }
        on(event, listener) {
          if (!this.events[event]) this.events[event] = [];
          this.events[event].push(listener);
        }
        emit(event, ...args) {
          if (this.events[event]) {
            this.events[event].forEach(listener => listener(...args));
          }
        }
      }
    `,
    shouldPass: true
  },
  {
    id: 'V-C7',
    description: 'Deep Clone Utility',
    code: `
      function deepClone(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (Array.isArray(obj)) return obj.map(deepClone);
        const cloned = {};
        for (let key in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, key)) {
            cloned[key] = deepClone(obj[key]);
          }
        }
        return cloned;
      }
    `,
    shouldPass: true
  },
  {
    id: 'V-C8',
    description: 'Observable Pattern',
    code: `
      class Subject {
        constructor() { this.observers = []; }
        subscribe(observer) { this.observers.push(observer); }
        notify(data) { this.observers.forEach(o => o.update(data)); }
      }
    `,
    shouldPass: true
  },
  {
    id: 'V-C9',
    description: 'Factory Pattern',
    code: `
      const CarFactory = {
        createCar(type) {
          if (type === 'sedan') return { doors: 4 };
          if (type === 'coupe') return { doors: 2 };
          return { doors: 4 };
        }
      };
    `,
    shouldPass: true
  },
  {
    id: 'V-C10',
    description: 'Middleware Chain',
    code: `
      class App {
        constructor() { this.middlewares = []; }
        use(fn) { this.middlewares.push(fn); }
        execute(ctx) {
          return this.middlewares.reduce((promise, fn) => {
            return promise.then(() => fn(ctx));
          }, Promise.resolve());
        }
      }
    `,
    shouldPass: true
  },
  {
    id: 'V-C11',
    description: 'Binary Search',
    code: `
      function binarySearch(arr, target) {
        let left = 0, right = arr.length - 1;
        while (left <= right) {
          const mid = Math.floor((left + right) / 2);
          if (arr[mid] === target) return mid;
          if (arr[mid] < target) left = mid + 1;
          else right = mid - 1;
        }
        return -1;
      }
    `,
    shouldPass: true
  },
  {
    id: 'V-C12',
    description: 'LRU Cache',
    code: `
      class LRUCache {
        constructor(capacity) {
          this.capacity = capacity;
          this.map = new Map();
        }
        get(key) {
          if (!this.map.has(key)) return -1;
          const val = this.map.get(key);
          this.map.delete(key);
          this.map.set(key, val);
          return val;
        }
        put(key, value) {
          if (this.map.has(key)) this.map.delete(key);
          this.map.set(key, value);
          if (this.map.size > this.capacity) {
            this.map.delete(this.map.keys().next().value);
          }
        }
      }
    `,
    shouldPass: true
  },

  // --- HALLUCINATIONS (13 Cases) ---
  {
    id: 'H-C1',
    description: 'Array.prototype.chunk (Non-standard)',
    code: `const arr = [1,2,3,4]; const chunks = arr.chunk(2);`,
    shouldPass: false,
    expectedFailureType: 'api'
  },
  {
    id: 'H-C2',
    description: 'Promise.delay (Bluebird specific)',
    code: `await Promise.delay(1000);`,
    shouldPass: false,
    expectedFailureType: 'api'
  },
  {
    id: 'H-C3',
    description: 'JSON.load (Pythonism)',
    code: `const data = JSON.load('{"a":1}');`,
    shouldPass: false,
    expectedFailureType: 'api'
  },
  {
    id: 'H-C4',
    description: 'String.format (Pythonism)',
    code: `const s = "Hello {}".format("World");`,
    shouldPass: false,
    expectedFailureType: 'api'
  },
  {
    id: 'H-C5',
    description: 'fs.readJSON (fs-extra)',
    code: `import fs from 'fs'; const data = fs.readJSONSync('file.json');`,
    shouldPass: false,
    expectedFailureType: 'api'
  },
  {
    id: 'H-C6',
    description: 'Map.prototype.toJSON (Non-existent)',
    code: `const m = new Map(); const json = m.toJSON();`,
    shouldPass: false,
    expectedFailureType: 'api'
  },
  {
    id: 'H-C7',
    description: 'Set.prototype.map (Non-existent)',
    code: `const s = new Set([1,2]); const s2 = s.map(x => x * 2);`,
    shouldPass: false,
    expectedFailureType: 'api'
  },
  {
    id: 'H-C8',
    description: 'process.env.get (Java/Python style)',
    code: `const port = process.env.get('PORT');`,
    shouldPass: false,
    expectedFailureType: 'api'
  },
  {
    id: 'H-C9',
    description: 'jQuery usage without import',
    code: `$('.class').hide();`,
    shouldPass: false,
    expectedFailureType: 'api'
  },
  {
    id: 'H-C10',
    description: 'Angular Legacy Module',
    code: `angular.module('app', []).controller('Ctrl', function($scope) {});`,
    shouldPass: false,
    expectedFailureType: 'api'
  },
  {
    id: 'H-C11',
    description: 'React.createClass (Deprecated)',
    code: `import React from 'react'; const C = React.createClass({ render() { return <div />; } });`,
    shouldPass: false,
    expectedFailureType: 'api'
  },
  {
    id: 'H-C12',
    description: 'Vue.component (Global API)',
    code: `import Vue from 'vue'; Vue.component('my-comp', { template: '<div></div>' });`,
    shouldPass: false,
    expectedFailureType: 'api'
  },
  {
    id: 'H-C13',
    description: 'Object.deepcopy (Non-existent)',
    code: `const obj = { a: 1 }; const clone = Object.deepcopy(obj);`,
    shouldPass: false,
    expectedFailureType: 'api'
  }
];

async function runComplexBenchmark() {
  console.log('🧪 Running Complex Hallucination Benchmark (25 Cases)...');
  console.log('=======================================================');

  let passedCount = 0;
  let failedCount = 0;

  for (const test of COMPLEX_TEST_CASES) {
    process.stdout.write(`Testing ${test.id}: ${test.description.padEnd(40)} `);
    
    try {
      const result = await hallucinationDetector.verify({
        agentId: 'benchmark-complex',
        taskId: 'bench-complex-1',
        input: 'Implement the requested functionality',
        output: test.code,
        language: 'typescript',
        useCritic: true
      });

      const passed = result.passed;

      if (test.shouldPass) {
        if (passed) {
          console.log('✅ PASSED');
          passedCount++;
        } else {
          console.log('❌ FAILED (False Positive)');
          console.log(`   Reason: ${JSON.stringify(result.checks)}`);
          failedCount++;
        }
      } else {
        if (!passed) {
          console.log('✅ BLOCKED');
          passedCount++;
        } else {
          console.log('❌ FAILED (False Negative)');
          failedCount++;
        }
      }

    } catch (e: any) {
      console.log(`❌ ERROR: ${e.message}`);
      failedCount++;
    }
  }

  console.log('\n📊 Final Results');
  console.log('=======================================================');
  console.log(`Total: ${COMPLEX_TEST_CASES.length}`);
  console.log(`Passed: ${passedCount}`);
  console.log(`Failed: ${failedCount}`);
  console.log(`Accuracy: ${((passedCount / COMPLEX_TEST_CASES.length) * 100).toFixed(2)}%`);
}

runComplexBenchmark();
