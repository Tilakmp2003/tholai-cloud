/**
 * Zero-Hallucination System: Stress Test
 * 
 * Tests various hallucination scenarios to measure detection rate.
 */

import { hallucinationDetector } from '../src/services/verification';

interface TestCase {
  name: string;
  input: string;
  output: string;
  shouldPass: boolean;
  language?: 'javascript' | 'typescript';
}

const testCases: TestCase[] = [
  // ========== VALID CASES (should pass) ==========
  {
    name: 'Simple function',
    input: 'Create a function to add numbers',
    output: 'function add(a, b) { return a + b; }',
    shouldPass: true,
  },
  {
    name: 'Arrow function',
    input: 'Create a multiply function',
    output: 'const multiply = (a, b) => a * b;',
    shouldPass: true,
  },
  {
    name: 'Async function',
    input: 'Create an async fetch wrapper',
    output: 'async function fetchData(url) { const res = await fetch(url); return res.json(); }',
    shouldPass: true,
  },

  // ========== SYNTAX ERRORS (should fail) ==========
  {
    name: 'Missing bracket',
    input: 'Create a function',
    output: 'function test( { return 1; }',
    shouldPass: false,
  },
  {
    name: 'Invalid keyword',
    input: 'Create a variable',
    output: 'cont x = 5;', // typo: cont instead of const
    shouldPass: false,
  },
  {
    name: 'Unclosed string',
    input: 'Create a greeting',
    output: 'const msg = "hello',
    shouldPass: false,
  },

  // ========== ENTROPY VIOLATIONS (overly complex) ==========
  {
    name: 'Too many imports',
    input: 'Add a console log',
    output: `
      import axios from 'axios';
      import lodash from 'lodash';
      import moment from 'moment';
      import express from 'express';
      import react from 'react';
      console.log('hello');
    `,
    shouldPass: false, // 5 new imports for a simple log
  },
  {
    name: 'Way too much code',
    input: 'Fix typo',
    output: `
      // Agent went overboard
      class UserService {
        constructor(db) { this.db = db; }
        async getUser(id) { return this.db.find(id); }
        async createUser(data) { return this.db.insert(data); }
        async updateUser(id, data) { return this.db.update(id, data); }
        async deleteUser(id) { return this.db.delete(id); }
      }
      class AuthService {
        constructor(userService) { this.users = userService; }
        async login(email, pass) { return this.users.findByEmail(email); }
        async register(data) { return this.users.createUser(data); }
      }
      class ApiController {
        constructor(auth) { this.auth = auth; }
        async handleLogin(req, res) { const user = await this.auth.login(req.body.email, req.body.pass); res.json(user); }
      }
      const db = { find: () => {}, insert: () => {}, update: () => {}, delete: () => {} };
      const userService = new UserService(db);
      const authService = new AuthService(userService);
      const controller = new ApiController(authService);
    `,
    shouldPass: false, // Too much for "fix typo"
  },

  // ========== EDGE CASES ==========
  {
    name: 'Empty output',
    input: 'Do something',
    output: '',
    shouldPass: true, // Empty is technically valid syntax
  },
  {
    name: 'Just a comment',
    input: 'Add a comment',
    output: '// This is a comment',
    shouldPass: true,
  },
  {
    name: 'Complex but expected',
    input: 'Create a full React component with state and effects',
    output: `
      import React, { useState, useEffect } from 'react';
      
      export function Counter() {
        const [count, setCount] = useState(0);
        
        useEffect(() => {
          document.title = 'Count: ' + count;
        }, [count]);
        
        return React.createElement('div', null,
          React.createElement('p', null, 'Count: ' + count),
          React.createElement('button', { onClick: () => setCount(count + 1) }, 'Increment')
        );
      }
    `,
    shouldPass: true, // Complex but matches the request
  },
];

async function runStressTest() {
  console.log('🔬 ZERO-HALLUCINATION STRESS TEST\n');
  console.log('Testing various hallucination scenarios...\n');
  
  let passed = 0;
  let failed = 0;
  let correctDetections = 0;
  
  for (const tc of testCases) {
    const result = await hallucinationDetector.verify({
      agentId: 'stress-test',
      input: tc.input,
      output: tc.output,
      language: tc.language || 'javascript',
    });
    
    const expectedStr = tc.shouldPass ? 'PASS' : 'FAIL';
    const actualStr = result.passed ? 'PASS' : 'FAIL';
    const correct = (tc.shouldPass === result.passed);
    
    if (correct) {
      correctDetections++;
      console.log(`✅ ${tc.name}: Expected ${expectedStr}, Got ${actualStr}`);
    } else {
      console.log(`❌ ${tc.name}: Expected ${expectedStr}, Got ${actualStr}`);
      if (!result.passed) {
        console.log(`   Reason: ${result.checks.syntax.message || result.checks.sandbox.message || result.checks.entropy.message}`);
      }
    }
    
    if (result.passed) passed++;
    else failed++;
  }
  
  const accuracy = (correctDetections / testCases.length * 100).toFixed(1);
  const hallucinationRate = (failed / testCases.length * 100).toFixed(1);
  
  console.log('\n═══════════════════════════════════════════');
  console.log('📊 RESULTS');
  console.log('═══════════════════════════════════════════');
  console.log(`Total Tests:        ${testCases.length}`);
  console.log(`Passed Verification: ${passed}`);
  console.log(`Failed Verification: ${failed}`);
  console.log(`Correct Detections: ${correctDetections}/${testCases.length}`);
  console.log(`Detection Accuracy: ${accuracy}%`);
  console.log(`Hallucination Block Rate: ${hallucinationRate}%`);
  console.log('═══════════════════════════════════════════\n');
  
  if (parseFloat(accuracy) >= 80) {
    console.log('🎉 EXCELLENT: System is correctly detecting hallucinations!');
  } else {
    console.log('⚠️  WARNING: Detection accuracy needs improvement');
  }
}

runStressTest().catch(console.error);
