/**
 * Test using EXACT same code path as llmClient
 */

import { invokeModel } from '../../services/llmClient';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testViaLLMClient() {
  console.log('🧪 Testing DeepSeek R1 via llmClient (production code path)...\n');

  try {
    // Get Architect config (uses DeepSeek R1)
    const architect = await prisma.agent.findFirst({
      where: { role: 'Architect' }
    });

    if (!architect || !architect.modelConfig) {
      throw new Error('Architect agent not configured');
    }

    const modelConfig = (architect.modelConfig as any).primary;
    console.log(`📝 Model from DB: ${modelConfig.model}`);
    console.log(`📝 Full config:`, JSON.stringify(modelConfig, null, 2));

    const system = 'You are a helpful assistant. Be concise.';
    const user = 'Say "hello" in one word.';

    console.log('\n⏳ Invoking via invokeModel...\n');
    const startTime = Date.now();

    const response = await invokeModel(modelConfig, system, user);

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n✅ SUCCESS in ${duration}s\n`);
    console.log(`📄 Response: ${response.text.substring(0, 200)}`);
    console.log(`💰 Cost: $${response.costUsd.toFixed(4)}`);
    console.log(`🔢 Tokens: ${response.tokensIn + response.tokensOut}`);

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

testViaLLMClient();
