/**
 * Comprehensive Multi-Provider Test
 * Tests Groq, OpenRouter, and the full task assignment flow
 */

import { PrismaClient } from '@prisma/client';
import { callLLM } from '../src/llm/llmClient';
import { getDefaultModelConfig } from '../src/llm/modelRegistry';

const prisma = new PrismaClient();

async function testMultiProvider() {
  console.log('\n🧪 === COMPREHENSIVE MULTI-PROVIDER TEST ===\n');

  // Test 1: Groq (Hands)
  console.log('⚡ Test 1: Groq Llama 3.3 70B...');
  const groqConfig = getDefaultModelConfig('MidDev');
  console.log(`   Config: ${JSON.stringify(groqConfig)}`);
  
  try {
    const start = Date.now();
    const response = await callLLM(groqConfig, [
      { role: 'user', content: 'Write a one-line function to add two numbers in TypeScript' }
    ]);
    const time = Date.now() - start;
    console.log(`   ✅ Response (${time}ms): ${response.content.substring(0, 80)}...`);
    console.log(`   ✅ GROQ WORKING!\n`);
  } catch (error: any) {
    console.log(`   ❌ Error: ${error.message}\n`);
  }

  // Test 2: OpenRouter/DeepSeek (Brains)
  console.log('🧠 Test 2: DeepSeek R1 via OpenRouter...');
  const deepseekConfig = getDefaultModelConfig('TeamLead');
  console.log(`   Config: ${JSON.stringify(deepseekConfig)}`);
  
  try {
    const start = Date.now();
    const response = await callLLM(deepseekConfig, [
      { role: 'user', content: 'Explain dependency injection in one sentence' }
    ]);
    const time = Date.now() - start;
    console.log(`   ✅ Response (${time}ms): ${response.content.substring(0, 80)}...`);
    console.log(`   ✅ DEEPSEEK R1 WORKING!\n`);
  } catch (error: any) {
    console.log(`   ⚠️  Error (expected if rate-limited): ${error.message}`);
    console.log(`   ℹ️  Fallback to Gemini should have activated\n`);
  }

  // Test 3: Check Agent Configs
  console.log('📊 Test 3: Checking Agent Configurations...');
  const agents = await prisma.agent.findMany({
    select: { role: true, modelConfig: true }
  });

  if (agents.length === 0) {
    console.log('   ⚠️  No agents found! Run: npx tsx scripts/seed_agent_models.ts\n');
  } else {
    const byProvider: Record<string, number> = {};
    agents.forEach(agent => {
      const config = agent.modelConfig as any;
      if (config?.provider) {
        byProvider[config.provider] = (byProvider[config.provider] || 0) + 1;
      }
    });

    console.log(`   Total Agents: ${agents.length}`);
    Object.entries(byProvider).forEach(([provider, count]) => {
      const emoji = provider === 'groq' ? '🤖' : provider === 'openrouter' ? '🧠' : '🔄';
      console.log(`   ${emoji} ${provider}: ${count} agents`);
    });
    console.log(`   ✅ AGENT CONFIGS PRESENT!\n`);
  }

  // Test 4: End-to-End Task Creation
  console.log('🔄 Test 4: Creating Test Project...');
  
  try {
    const project = await prisma.project.create({
      data: {
        name: 'Multi-Provider Test',
        status: 'ACTIVE',
        requirements: 'Test project to verify multi-provider LLM system'
      }
    });

    const module = await prisma.module.create({
      data: {
        projectId: project.id,
        name: 'test-module',
        status: 'IN_PROGRESS'
      }
    });

    const task = await prisma.task.create({
      data: {
        moduleId: module.id,
        title: 'Test task for multi-provider',
        requiredRole: 'MidDev',
        status: 'QUEUED',
        contextPacket: {
          description: 'Simple test task',
          moduleName: 'test-module'
        }
      }
    });

    console.log(`   ✅ Created project: ${project.id}`);
    console.log(`   ✅ Created module: ${module.id}`);
    console.log(`   ✅ Created task: ${task.id}`);
    console.log(`   ✅ TASK CREATION WORKING!\n`);

    // Clean up
    await prisma.task.delete({ where: { id: task.id } });
    await prisma.module.delete({ where: { id: module.id } });
    await prisma.project.delete({ where: { id: project.id } });
    console.log(`   🧹 Cleaned up test data\n`);

  } catch (error: any) {
    console.log(`   ❌ Error: ${error.message}\n`);
  }

  console.log('=== TEST COMPLETE ===\n');
  
  await prisma.$disconnect();
}

testMultiProvider().catch(console.error);
