/**
 * Test Multi-Provider System
 * Tests Kimi and Groq providers with sample requests
 */

import { callLLM } from '../src/llm/llmClient';
import { ModelConfig } from '../src/llm/types';

async function testProviders() {
  console.log('\n=== Testing Multi-Provider LLM System ===\n');

  // Test Groq (Hands)
  console.log('🤖 Testing Groq (Llama 3.3 70B)...');
  const groqConfig: ModelConfig = {
    provider: 'groq',
    model: 'llama-3.3-70b-versatile',
    maxTokens: 512,
    temperature: 0.3,
  };

  try {
    const groqStart = Date.now();
    const groqResponse = await callLLM(groqConfig, [
      {
        role: 'user',
        content: 'Write a simple Hello World function in TypeScript',
      },
    ]);
    const groqTime = Date.now() - groqStart;

    console.log(`✅ Groq Response (${groqTime}ms):`);
    console.log(groqResponse.content.substring(0, 200) + '...');
    console.log(`   Tokens: ${groqResponse.usage?.totalTokens || 'N/A'}\n`);
  } catch (error: any) {
    console.error(`❌ Groq Error: ${error.message}\n`);
  }

  // Test DeepSeek R1 (Brains)
  console.log('🧠 Testing DeepSeek R1 (via OpenRouter)...');
  const deepseekConfig: ModelConfig = {
    provider: 'openrouter',
    model: 'deepseek/deepseek-r1:free',
    maxTokens: 512,
    temperature: 0.2,
  };

  try {
    const deepseekStart = Date.now();
    const deepseekResponse = await callLLM(deepseekConfig, [
      {
        role: 'user',
        content: 'Explain the benefits of microservices architecture in 2 sentences',
      },
    ]);
    const deepseekTime = Date.now() - deepseekStart;

    console.log(`✅ DeepSeek R1 Response (${deepseekTime}ms):`);
    console.log(deepseekResponse.content.substring(0, 200) + '...');
    console.log(`   Tokens: ${deepseekResponse.usage?.totalTokens || 'N/A'}\n`);
  } catch (error: any) {
    console.error(`❌ DeepSeek R1 Error: ${error.message}\n`);
  }

  console.log('=== Test Complete ===\n');
}

testProviders().catch(console.error);
