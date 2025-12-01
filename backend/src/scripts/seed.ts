import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function seedAgents() {
  const agents = [
    { role: 'Architect', specialization: 'System Design & Tech Stack', model: 'us.deepseek.r1-v1:0', provider: 'bedrock', region: 'us-east-1' },
    { role: 'SeniorDev', specialization: 'Core Logic & Security', model: 'us.deepseek.r1-v1:0', provider: 'bedrock', region: 'us-east-1' },
    { role: 'MidDev', specialization: 'Feature Implementation', model: 'deepseek.deepseek-v3:1', provider: 'bedrock', region: 'ap-south-1' },
    { role: 'TeamLead', specialization: 'Coordination & Review', model: 'us.deepseek.r1-v1:0', provider: 'bedrock', region: 'us-east-1' },
    { role: 'Designer', specialization: 'UI/UX & CSS', model: 'deepseek.deepseek-v3:1', provider: 'bedrock', region: 'ap-south-1' },
    { role: 'QA', specialization: 'Testing & Validation', model: 'deepseek.deepseek-v3:1', provider: 'bedrock', region: 'ap-south-1' },
    { role: 'AgentOps', specialization: 'DevOps & Deployment', model: 'deepseek.deepseek-v3:1', provider: 'bedrock', region: 'ap-south-1' },
    { role: 'Canary', specialization: 'System Health Check', model: 'deepseek.deepseek-v3:1', provider: 'bedrock', region: 'ap-south-1' },
    { role: 'TestGenerator', specialization: 'Test Case Creation', model: 'deepseek.deepseek-v3:1', provider: 'bedrock', region: 'ap-south-1' }
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
