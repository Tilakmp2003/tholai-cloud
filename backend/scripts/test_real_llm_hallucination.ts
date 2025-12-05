
import { callLLM } from '../src/llm/llmClient';
import { ModelConfig } from '../src/llm/types';
import { hallucinationDetector } from '../src/services/verification';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env') });

async function testRealLLMHallucination() {
  console.log('🧪 Testing Hallucination Detection with Real DeepSeek V3 Model');
  console.log('===============================================================');

  // Configuration for DeepSeek V3 via Bedrock
  const modelConfig: ModelConfig = {
    provider: 'bedrock',
    model: 'deepseek.v3-v1:0', // Using the V3 model as it's the default in the codebase
    maxTokens: 1024,
    temperature: 0.7, // Higher temperature to encourage creativity (and potentially hallucinations)
    region: 'ap-south-1',
  };

  console.log(`📝 Model: ${modelConfig.model} (${modelConfig.provider})`);
  console.log(`📍 Region: ${modelConfig.region}`);

  const testCases = [
    {
      name: 'Hallucination Induction (localStorage)',
      prompt: 'Write a TypeScript function to save a user object to localStorage. Use the "save" method of localStorage.',
      expectedHallucination: true,
    },
    {
      name: 'Hallucination Induction (Array)',
      prompt: 'Write a function to get unique items from an array using the native .unique() method.',
      expectedHallucination: true,
    },
    {
      name: 'Valid Code (Simple)',
      prompt: 'Write a TypeScript function to calculate the factorial of a number.',
      expectedHallucination: false,
    },
    {
      name: 'Valid Code (Complex)',
      prompt: 'Write a TypeScript function that fetches data from an API using fetch, handles errors, and returns the JSON response. Use async/await.',
      expectedHallucination: false,
    }
  ];

  for (const test of testCases) {
    console.log(`\n---------------------------------------------------------------`);
    console.log(`🔍 Test Case: ${test.name}`);
    console.log(`❓ Prompt: "${test.prompt}"`);
    
    try {
      console.log('⏳ Generating code...');
      const response = await callLLM(modelConfig, [
        { role: 'system', content: 'You are a coding assistant. Output ONLY the code block. Do not use markdown backticks if possible, or I will strip them.' },
        { role: 'user', content: test.prompt }
      ]);

      let code = response.content;
      // Strip markdown if present
      code = code.replace(/```typescript/g, '').replace(/```javascript/g, '').replace(/```/g, '').trim();

      console.log('📄 Generated Code:');
      console.log('---------------------------------------------------');
      console.log(code.substring(0, 500) + (code.length > 500 ? '...' : ''));
      console.log('---------------------------------------------------');

      console.log('🛡️ Verifying...');
      const result = await hallucinationDetector.verify({
        agentId: 'test-agent',
        taskId: 'test-real-llm',
        input: test.prompt,
        output: code,
        language: 'typescript'
      });

      console.log(`🎯 Result: ${result.passed ? '✅ PASSED' : '❌ FAILED'}`);
      
      if (!result.passed) {
        console.log('⚠️ Detection Details:');
        console.log(`   - Syntax: ${result.checks.syntax.passed ? '✅' : '❌'}`);
        console.log(`   - Sandbox: ${result.checks.sandbox.passed ? '✅' : '❌'} (${result.checks.sandbox.message || ''})`);
        console.log(`   - Entropy: ${result.checks.entropy.passed ? '✅' : '❌'} (${result.checks.entropy.message || ''})`);
        console.log(`   - API: ${result.checks.api?.passed ? '✅' : '❌'}`);
        console.log(`   - Safety: ${result.checks.safety?.passed ? '✅' : '❌'}`);
        
        if (!result.checks.api?.passed) {
           // @ts-ignore
           console.log(`   - API Errors: ${JSON.stringify(result.checks.api?.details || [])}`);
        }
      }

      // Check expectations
      if (test.expectedHallucination && !result.passed) {
        console.log('✅ SUCCESS: Hallucination correctly detected.');
      } else if (!test.expectedHallucination && result.passed) {
        console.log('✅ SUCCESS: Valid code correctly passed.');
      } else if (test.expectedHallucination && result.passed) {
        console.log('❌ FAILURE: Hallucination NOT detected (False Negative).');
      } else {
        console.log('❌ FAILURE: Valid code incorrectly flagged (False Positive).');
      }

    } catch (error: any) {
      console.error(`❌ Error executing test: ${error.message}`);
    }
  }
}

testRealLLMHallucination().catch(console.error);
