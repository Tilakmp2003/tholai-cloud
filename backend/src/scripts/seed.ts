import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function seedAgents() {
  const agents = [
    { role: 'ARCHITECT', specialization: 'System Design & Tech Stack', model: 'deepseek-r1', provider: 'openrouter' },
    { role: 'SENIOR_DEV', specialization: 'Core Logic & Security', model: 'deepseek-r1', provider: 'openrouter' },
    { role: 'MID_DEV', specialization: 'Feature Implementation', model: 'deepseek.deepseek-v3:1', provider: 'bedrock' },
    { role: 'TEAM_LEAD', specialization: 'Coordination & Review', model: 'deepseek-r1', provider: 'openrouter' },
    { role: 'DESIGNER', specialization: 'UI/UX & CSS', model: 'deepseek.deepseek-v3:1', provider: 'bedrock' },
    { role: 'QA', specialization: 'Testing & Validation', model: 'deepseek.deepseek-v3:1', provider: 'bedrock' },
    { role: 'AGENT_OPS', specialization: 'DevOps & Deployment', model: 'deepseek.deepseek-v3:1', provider: 'bedrock' },
    { role: 'CANARY', specialization: 'System Health Check', model: 'deepseek.deepseek-v3:1', provider: 'bedrock' },
    { role: 'TEST_GENERATOR', specialization: 'Test Case Creation', model: 'deepseek.deepseek-v3:1', provider: 'bedrock' }
  ];

  console.log('🌱 Seeding Agents...');

  for (const agent of agents) {
    await prisma.agent.upsert({
      where: { id: agent.role }, // Using role as ID for simplicity in seed, or we can query by role
      update: {
        modelConfig: {
          provider: agent.provider,
          model: agent.model,
          temperature: 0.7
        }
      },
      create: {
        id: agent.role, // Force ID to match role for easy reference
        role: agent.role,
        specialization: agent.specialization,
        status: 'IDLE',
        score: 100,
        riskLevel: 'LOW',
        modelConfig: {
          provider: agent.provider,
          model: agent.model,
          temperature: 0.7
        }
      }
    });
  }

  console.log('✅ Agents Seeded!');
  return { success: true, count: agents.length };
}
