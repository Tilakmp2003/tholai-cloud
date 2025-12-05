/**
 * Zero-Hallucination System: ADVANCED Stress Test
 * 
 * Tests complex real-world scenarios including:
 * - LLM-generated code patterns
 * - Subtle hallucinations
 * - Edge cases
 * - Cross-language detection
 */

import { hallucinationDetector } from '../src/services/verification';
import { ROLE_BASELINES } from '../src/types/verification';

interface TestCase {
  name: string;
  input: string;
  output: string;
  shouldPass: boolean;
  language?: 'javascript' | 'typescript' | 'python';
  roleBaseline?: typeof ROLE_BASELINES.SeniorDev;
}

const advancedTestCases: TestCase[] = [
  // ========== LLM HALLUCINATION PATTERNS ==========
  {
    name: '🔴 Invents non-existent npm package',
    input: 'Add validation',
    output: `
      import { validateEmail, validatePhone } from 'super-validator-pro';
      const isValid = validateEmail(email) && validatePhone(phone);
    `,
    shouldPass: false, // 'super-validator-pro' doesn't exist
  },
  {
    name: '🔴 Uses deprecated/wrong API',
    input: 'Fetch data from API',
    output: `
      const response = await fetch.get('/api/data'); // fetch.get doesn't exist
      const data = response.json;
    `,
    shouldPass: false,
  },
  {
    name: '🔴 Hallucinates React hooks',
    input: 'Add a timer hook',
    output: `
      import { useTimer } from 'react'; // useTimer doesn't exist in React
      const { time, start, stop } = useTimer();
    `,
    shouldPass: false,
  },
  {
    name: '🔴 Invents TypeScript features',
    input: 'Create a type-safe function',
    output: `
      function getData<T extends @strict>(): T { // @strict is not valid TS
        return {} as T;
      }
    `,
    shouldPass: false,
  },
  
  // ========== SUBTLE HALLUCINATIONS ==========
  {
    name: '🔴 Slightly wrong method name',
    input: 'Parse JSON from string',
    output: `
      const data = JSON.parseString(jsonStr); // Should be JSON.parse
    `,
    shouldPass: false,
  },
  {
    name: '🔴 Wrong promise handling',
    input: 'Handle async operation',
    output: `
      const result = await Promise.wait(1000); // Promise.wait doesn't exist
      console.log(result);
    `,
    shouldPass: false,
  },
  {
    name: '🔴 Invents Array method',
    input: 'Filter unique items',
    output: `
      const unique = arr.unique(); // Array.unique doesn't exist
    `,
    shouldPass: false,
  },
  
  // ========== CORRECT CODE (SHOULD PASS) ==========
  {
    name: '🟢 Complex but correct async code',
    input: 'Create an async function to fetch and cache data',
    output: `
      const cache = new Map();
      
      async function fetchWithCache(url) {
        if (cache.has(url)) {
          return cache.get(url);
        }
        
        const response = await fetch(url);
        const data = await response.json();
        
        cache.set(url, data);
        return data;
      }
    `,
    shouldPass: true,
  },
  {
    name: '🟢 Correct React component',
    input: 'Create a React button component with state',
    output: `
      function ClickCounter() {
        const [count, setCount] = React.useState(0);
        
        const handleClick = () => {
          setCount(prev => prev + 1);
        };
        
        return React.createElement('button', 
          { onClick: handleClick },
          'Clicks: ' + count
        );
      }
    `,
    shouldPass: true,
  },
  {
    name: '🟢 Correct TypeScript with generics',
    input: 'Create a generic repository pattern',
    output: `
      class Repository {
        constructor(items) {
          this.items = items || [];
        }
        
        findById(id) {
          return this.items.find(item => item.id === id);
        }
        
        save(item) {
          const idx = this.items.findIndex(i => i.id === item.id);
          if (idx >= 0) this.items[idx] = item;
          else this.items.push(item);
          return item;
        }
      }
    `,
    shouldPass: true,
  },
  
  // ========== OVER-GENERATION ==========
  {
    name: '🔴 Simple request, massive output',
    input: 'Fix the typo in console.log',
    output: `
      // Agent completely rewrote everything instead of just fixing a typo
      class Logger { static log(m){console.log(m)} static warn(m){console.warn(m)} static error(m){console.error(m)} static info(m){console.info(m)} static debug(m){console.debug(m)} }
      class LoggerFactory { static create(n){return new NamedLogger(n)} }
      class NamedLogger { constructor(n){this.n=n} log(m){Logger.log('['+this.n+']'+m)} }
      const l=LoggerFactory.create('A');
      l.log('x');
    `,
    shouldPass: false, // Way too much for fix typo - 10 lines of new classes
  },
  {
    name: '🔴 Unrequested extra imports',
    input: 'Add console log',
    output: `
      import lodash from 'lodash';
      import axios from 'axios';
      import moment from 'moment';
      import fs from 'fs';
      import path from 'path';
      import os from 'os';
      console.log('hello');
    `,
    shouldPass: false,
  },
  
  // ========== VALID COMPLEX CODE ==========
  {
    name: '🟢 Multi-function service (requested)',
    input: 'Create a user authentication service with login, logout, and session management',
    output: `
      const sessions = new Map();
      
      const authService = {
        login(email, password) {
          // Validate credentials
          const user = { email, id: Math.random().toString(36) };
          const token = Math.random().toString(36);
          sessions.set(token, user);
          return { token, user };
        },
        
        logout(token) {
          sessions.delete(token);
          return true;
        },
        
        getSession(token) {
          return sessions.get(token);
        },
        
        isAuthenticated(token) {
          return sessions.has(token);
        }
      };
    `,
    shouldPass: true,
  },
  
  // ========== RUNTIME ERRORS ==========
  {
    name: '🔴 Undefined variable access',
    input: 'Log the user name',
    output: `
      console.log(userName); // userName is never defined
    `,
    shouldPass: false, // Will fail sandbox
  },
  {
    name: '🔴 Invalid function call',
    input: 'Call the API',
    output: `
      const result = callApi().then().catch(); // callApi not defined
    `,
    shouldPass: false,
  },
  
  // ========== EDGE CASES ==========
  {
    name: '🟢 Just a template literal',
    input: 'Create a greeting message',
    output: 'const greeting = `Hello, World!`;',
    shouldPass: true,
  },
  {
    name: '🟢 Object destructuring',
    input: 'Extract name, age, and city from the person object with default for city',
    output: 'const { name, age, city = "Unknown" } = person || {};',
    shouldPass: true,
  },
  {
    name: '🔴 Slow blocking loop',
    input: 'Create a simple counter',
    output: `
      // This runs expensive blocking operations
      let x = 0;
      for (let i = 0; i < 999999999; i++) { x = Math.pow(Math.sin(i), Math.cos(i)); }
    `,
    shouldPass: false, // Harmful blocking code
  },
];

async function runAdvancedTests() {
  console.log('🔬 ADVANCED HALLUCINATION STRESS TEST\n');
  console.log('Testing ' + advancedTestCases.length + ' complex scenarios...\n');
  console.log('─'.repeat(60) + '\n');
  
  let passed = 0;
  let failed = 0;
  let correctDetections = 0;
  const errors: string[] = [];
  
  for (const tc of advancedTestCases) {
    process.stdout.write(`Testing: ${tc.name}... `);
    
    const result = await hallucinationDetector.verify({
      agentId: 'advanced-test',
      input: tc.input,
      output: tc.output,
      language: tc.language || 'javascript',
      roleBaseline: tc.roleBaseline,
    });
    
    const correct = (tc.shouldPass === result.passed);
    
    if (correct) {
      correctDetections++;
      console.log('✅');
    } else {
      const expected = tc.shouldPass ? 'PASS' : 'FAIL';
      const actual = result.passed ? 'PASS' : 'FAIL';
      console.log(`❌ (Expected: ${expected}, Got: ${actual})`);
      
      if (result.passed && !tc.shouldPass) {
        errors.push(`${tc.name}: Should have FAILED but PASSED`);
      } else {
        const reason = result.checks.syntax.message || 
                       result.checks.sandbox.message || 
                       result.checks.entropy.message || 'Unknown';
        errors.push(`${tc.name}: Should have PASSED but FAILED - ${reason}`);
      }
    }
    
    if (result.passed) passed++;
    else failed++;
  }
  
  const accuracy = (correctDetections / advancedTestCases.length * 100).toFixed(1);
  const hallucinationsCaught = advancedTestCases.filter(tc => !tc.shouldPass).length;
  const falsePositives = errors.filter(e => e.includes('PASSED but FAILED')).length;
  const missedHallucinations = errors.filter(e => e.includes('FAILED but PASSED')).length;
  
  console.log('\n' + '═'.repeat(60));
  console.log('📊 ADVANCED TEST RESULTS');
  console.log('═'.repeat(60));
  console.log(`Total Tests:              ${advancedTestCases.length}`);
  console.log(`Correct Detections:       ${correctDetections}/${advancedTestCases.length}`);
  console.log(`Detection Accuracy:       ${accuracy}%`);
  console.log(`Hallucinations Caught:    ${failed}/${hallucinationsCaught} expected bad`);
  console.log(`False Positives:          ${falsePositives}`);
  console.log(`Missed Hallucinations:    ${missedHallucinations}`);
  console.log('═'.repeat(60));
  
  if (errors.length > 0) {
    console.log('\n⚠️  ERRORS:');
    errors.forEach(e => console.log('  • ' + e));
  }
  
  console.log('\n');
  if (parseFloat(accuracy) >= 95) {
    console.log('🏆 OUTSTANDING: Near-perfect hallucination detection!');
  } else if (parseFloat(accuracy) >= 85) {
    console.log('🎉 EXCELLENT: System is highly effective!');
  } else if (parseFloat(accuracy) >= 70) {
    console.log('✅ GOOD: Reasonable detection rate');
  } else {
    console.log('⚠️  NEEDS IMPROVEMENT: Detection rate too low');
  }
  
  // Summary by category
  console.log('\n📈 CATEGORY BREAKDOWN:');
  console.log('  • LLM Hallucinations (fake APIs/packages): Check logs above');
  console.log('  • Subtle Mistakes (wrong method names): Check logs above');
  console.log('  • Over-generation (too much code): Check logs above');
  console.log('  • Valid Complex Code: Check logs above');
}

runAdvancedTests().catch(console.error);
