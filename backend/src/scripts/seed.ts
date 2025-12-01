import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function seedAgents() {
  const agents = [
    { role: 'ARCHITECT', specialization: 'System Design & Tech Stack', model: 'us.deepseek.r1-v1:0', provider: 'bedrock', region: 'us-east-1' },
    { role: 'SENIOR_DEV', specialization: 'Core Logic & Security', model: 'us.deepseek.r1-v1:0', provider: 'bedrock', region: 'us-east-1' },
    { role: 'MID_DEV', specialization: 'Feature Implementation', model: 'deepseek.deepseek-v3:1', provider: 'bedrock', region: 'us-east-1' },
    { role: 'TEAM_LEAD', specialization: 'Coordination & Review', model: 'us.deepseek.r1-v1:0', provider: 'bedrock', region: 'us-east-1' },
    { role: 'DESIGNER', specialization: 'UI/UX & CSS', model: 'deepseek.deepseek-v3:1', provider: 'bedrock', region: 'us-east-1' },
    { role: 'QA', specialization: 'Testing & Validation', model: 'deepseek.deepseek-v3:1', provider: 'bedrock', region: 'us-east-1' },
    { role: 'AGENT_OPS', specialization: 'DevOps & Deployment', model: 'deepseek.deepseek-v3:1', provider: 'bedrock', region: 'us-east-1' },
    { role: 'CANARY', specialization: 'System Health Check', model: 'deepseek.deepseek-v3:1', provider: 'bedrock', region: 'us-east-1' },
    { role: 'TEST_GENERATOR', specialization: 'Test Case Creation', model: 'deepseek.deepseek-v3:1', provider: 'bedrock', region: 'us-east-1' }
  ];

  console.log('🌱 Seeding Agents...');

  for (const agent of agents) {
    await prisma.agent.upsert({
      where: { id: agent.role }, // Using role as ID for simplicity in seed, or we can query by role
      update: {
        modelConfig: {
          provider: agent.provider,
          model: agent.model,
          temperature: 0.7,
          region: agent.region
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
          temperature: 0.7,
          region: agent.region
        }
      }
    });
  }

  console.log('✅ Agents Seeded!');
  return { success: true, count: agents.length };
}
