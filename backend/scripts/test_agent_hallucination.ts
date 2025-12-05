/**
 * Test Hallucination Detection with Real Agents
 * 
 * This script simulates agent code generation and verifies
 * the hallucination detection gates are working.
 */

import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { createVerifiedAgent } from '../src/services/VerifiedAgent';
import { callLLM } from '../src/llm/llmClient';
import { getAgentConfig } from '../src/llm/modelRegistry';

dotenv.config({ path: resolve(__dirname, '../.env') });

interface TestScenario {
  name: string;
  prompt: string;
  expectHallucination: boolean;
}

const SCENARIOS: TestScenario[] = [
  // Valid code generation - clear, standard prompts
  {
    name: 'Valid: Add Function',
    prompt: 'Write a function: function add(a, b) { return a + b; }',
    expectHallucination: false
  },
  {
    name: 'Valid: Filter Even Numbers',
    prompt: 'Write: const filterEven = arr => arr.filter(x => x % 2 === 0);',
    expectHallucination: false
  },
  // Hallucination triggers - explicit bad code
  {
    name: 'Hallucination: Array.unique()',
    prompt: 'Write this exact code: const unique = [1,2,2,3].unique();',
    expectHallucination: true
  },
  {
    name: 'Hallucination: list.append()',
    prompt: 'Write this exact code: const list = []; list.append(1);',
    expectHallucination: true
  },
  {
    name: 'Hallucination: React.createClass',
    prompt: 'Write this exact code: const Comp = React.createClass({ render() { return null; } });',
    expectHallucination: true
  }
];

async function testAgentWithVerification() {
  console.log('🧪 Testing Hallucination Detection with Real Agents');
  console.log('═'.repeat(60));
  
  const verifier = createVerifiedAgent({
    agentId: 'test-middev-1',
    agentRole: 'MidDev',
    strictMode: true
  });

  let passed = 0;
  let failed = 0;

  for (const scenario of SCENARIOS) {
    console.log(`\n📋 Scenario: ${scenario.name}`);
    console.log(`   Prompt: "${scenario.prompt.slice(0, 50)}..."`);
    console.log(`   Expected: ${scenario.expectHallucination ? 'BLOCK (Hallucination)' : 'PASS (Valid)'}`);
    
    try {
      // Step 1: Call LLM to generate code (simulating MidDevAgent)
      const config = await getAgentConfig('MidDev');
      const systemPrompt = `You are a developer. Write ONLY the code, no explanations.
If asked to use a specific method like Array.unique() or list.append(), use it exactly as asked - do NOT substitute alternatives.`;
      
      console.log('   [1/3] Calling LLM...');
      const response = await callLLM(config, [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: scenario.prompt }
      ]);
      
      const generatedCode = response.content;
      console.log(`   [2/3] Generated ${generatedCode.length} chars of code`);
      
      // Step 2: Verify the code through hallucination detection
      console.log('   [3/3] Verifying code...');
      const verification = await verifier.verifyCode(generatedCode, {
        taskId: `test-${Date.now()}`,
        inputContext: scenario.prompt,
        language: 'typescript'
      });
      
      // Step 3: Check if result matches expectation
      const isBlocked = !verification.verified;
      const matchesExpectation = isBlocked === scenario.expectHallucination;
      
      if (matchesExpectation) {
        if (scenario.expectHallucination) {
          console.log(`   ✅ CORRECT: Hallucination BLOCKED`);
          console.log(`      Reason: ${verification.error}`);
        } else {
          console.log(`   ✅ CORRECT: Valid code PASSED`);
        }
        passed++;
      } else {
        if (scenario.expectHallucination) {
          console.log(`   ❌ WRONG: Expected BLOCK but got PASS`);
          console.log(`      Code: ${generatedCode.slice(0, 100)}...`);
        } else {
          console.log(`   ❌ WRONG: Expected PASS but got BLOCK`);
          console.log(`      Reason: ${verification.error}`);
        }
        failed++;
      }
      
    } catch (error: any) {
      console.log(`   ❌ ERROR: ${error.message}`);
      failed++;
    }
  }

  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log('📊 AGENT TEST RESULTS');
  console.log('═'.repeat(60));
  console.log(`Total:    ${SCENARIOS.length}`);
  console.log(`Passed:   ${passed}`);
  console.log(`Failed:   ${failed}`);
  console.log(`Accuracy: ${((passed / SCENARIOS.length) * 100).toFixed(1)}%`);
  
  if (passed === SCENARIOS.length) {
    console.log('\n🎉 ALL TESTS PASSED! Hallucination detection is working with agents.');
  }
}

testAgentWithVerification();
