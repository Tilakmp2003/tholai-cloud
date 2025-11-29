/**
 * Seed Agent Model Configs
 * Populates all agents with appropriate model configurations based on their role
 */

import { PrismaClient } from '@prisma/client';
import { getDefaultModelConfig } from '../src/llm/modelRegistry';

const prisma = new PrismaClient();

async function seedAgentModels() {
  console.log('\n=== Seeding Agent Model Configs ===\n');

  const agents = await prisma.agent.findMany();
  console.log(`Found ${agents.length} agents`);

  let updated = 0;
  for (const agent of agents) {
    const modelConfig = getDefaultModelConfig(agent.role);
    
    await prisma.agent.update({
      where: { id: agent.id },
      data: { modelConfig },
    });

    const emoji = modelConfig.provider === 'kimi' ? '🧠' : '🤖';
    console.log(`  ${emoji} ${agent.role} → ${modelConfig.provider} (${modelConfig.model})`);
    updated++;
  }

  console.log(`\n✅ Updated ${updated} agents with model configs`);
  
  // Show summary
  const byProvider = agents.reduce((acc, agent) => {
    const config = getDefaultModelConfig(agent.role);
    acc[config.provider] = (acc[config.provider] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('\nDistribution by provider:');
  Object.entries(byProvider).forEach(([provider, count]) => {
    const emoji = provider === 'kimi' ? '🧠' : '🤖';
    console.log(`  ${emoji} ${provider}: ${count} agents`);
  });

  await prisma.$disconnect();
}

seedAgentModels().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
