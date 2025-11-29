
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function initAgents() {
  console.log('🚀 Initializing Agents...');

  // 1. HeadAgent
  const headAgent = await prisma.agent.upsert({
    where: { id: 'head-agent-1' }, // Use a fixed ID or find by role if unique constraint exists
    update: {},
    create: {
      role: 'HeadAgent',
      specialization: 'Governance',
      status: 'IDLE',
      score: 95,
      riskLevel: 'LOW'
    }
  });
  console.log('✅ HeadAgent ready');

  // 2. TeamLead
  const teamLead = await prisma.agent.upsert({
    where: { id: 'team-lead-1' },
    update: {},
    create: {
      role: 'TeamLead',
      specialization: 'Management',
      status: 'IDLE',
      score: 90,
      riskLevel: 'LOW'
    }
  });
  console.log('✅ TeamLead ready');

  // 3. QA Agent
  const qaAgent = await prisma.agent.upsert({
    where: { id: 'qa-agent-1' },
    update: {},
    create: {
      role: 'QA',
      specialization: 'Testing',
      status: 'IDLE',
      score: 88,
      riskLevel: 'LOW'
    }
  });
  console.log('✅ QA Agent ready');

  // 4. MidDev Agents (Create a few if none exist)
  const midDevCount = await prisma.agent.count({ where: { role: 'MidDev' } });
  if (midDevCount < 5) {
    console.log('➕ Creating initial MidDev squad...');
    await prisma.agent.createMany({
      data: [
        { role: 'MidDev', specialization: 'Backend', status: 'IDLE', score: 85, riskLevel: 'LOW' },
        { role: 'MidDev', specialization: 'Frontend', status: 'IDLE', score: 82, riskLevel: 'LOW' },
        { role: 'MidDev', specialization: 'FullStack', status: 'IDLE', score: 80, riskLevel: 'LOW' },
        { role: 'MidDev', specialization: 'Database', status: 'IDLE', score: 78, riskLevel: 'LOW' },
        { role: 'MidDev', specialization: 'API', status: 'IDLE', score: 75, riskLevel: 'LOW' }
      ]
    });
    console.log('✅ MidDev squad ready');
  } else {
    console.log(`✅ ${midDevCount} MidDev agents already exist`);
  }

  console.log('\n🎉 Agent initialization complete!');
}

initAgents()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
