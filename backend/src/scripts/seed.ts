import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function seedAgents() {
  const agents = [
    { role: 'ARCHITECT', specialization: 'System Design & Tech Stack', model: 'deepseek-r1' },
    { role: 'SENIOR_DEV', specialization: 'Core Logic & Security', model: 'deepseek-r1' },
    { role: 'MID_DEV', specialization: 'Feature Implementation', model: 'gemini-2.0-flash-exp' },
    { role: 'TEAM_LEAD', specialization: 'Coordination & Review', model: 'deepseek-r1' },
    { role: 'DESIGNER', specialization: 'UI/UX & CSS', model: 'gemini-2.0-flash-exp' },
    { role: 'QA', specialization: 'Testing & Validation', model: 'gemini-2.0-flash-exp' },
    { role: 'AGENT_OPS', specialization: 'DevOps & Deployment', model: 'gemini-2.0-flash-exp' },
    { role: 'CANARY', specialization: 'System Health Check', model: 'gemini-2.0-flash-exp' },
    { role: 'TEST_GENERATOR', specialization: 'Test Case Creation', model: 'gemini-2.0-flash-exp' }
  ];

  console.log('🌱 Seeding Agents...');

  for (const agent of agents) {
    await prisma.agent.upsert({
      where: { id: agent.role }, // Using role as ID for simplicity in seed, or we can query by role
      update: {},
      create: {
        id: agent.role, // Force ID to match role for easy reference
        role: agent.role,
        specialization: agent.specialization,
        status: 'IDLE',
        score: 100,
        riskLevel: 'LOW',
        modelConfig: {
          provider: agent.model.includes('gemini') ? 'google' : 'deepseek',
          model: agent.model,
          temperature: 0.7
        }
      }
    });
  }

  console.log('✅ Agents Seeded!');
  return { success: true, count: agents.length };
}
