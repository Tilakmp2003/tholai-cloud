/**
 * Minimal test: Just verify DeepSeek R1 can generate a simple response
 */

import { invokeModel } from '../services/llmClient';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testDeepSeekSimple() {
  console.log('🧪 Testing DeepSeek R1 with a simple prompt...\n');

  try {
    // Get Architect config (uses DeepSeek R1)
    const architect = await prisma.agent.findFirst({
      where: { role: 'Architect' }
    });

    if (!architect || !architect.modelConfig) {
      throw new Error('Architect agent not configured');
    }

    const modelConfig = (architect.modelConfig as any).primary;
    console.log(`📝 Using model: ${modelConfig.model}\n`);

    const system = 'You are a helpful assistant. Be concise.';
    const user = 'List 3 features for a todo app in JSON format with just feature names.';

    console.log('⏳ Invoking DeepSeek R1...\n');
    const startTime = Date.now();

    const response = await invokeModel(modelConfig, system, user);

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`✅ Response received in ${duration}s\n`);
    console.log('📄 Response:');
    console.log(response.text.substring(0, 500)); // First 500 chars
    console.log(`\n💰 Cost: $${response.cost.toFixed(4)}`);
    console.log(`🔢 Tokens: ${response.tokensUsed}`);

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testDeepSeekSimple();
