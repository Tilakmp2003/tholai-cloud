
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function scaleWorkforceCustom() {
  console.log('🚀 Scaling Workforce to Custom Specs...');

  // 1. HeadAgent (Ensure 1 exists)
  await prisma.agent.upsert({
    where: { id: 'head-agent-1' },
    update: { status: 'IDLE' },
    create: {
      role: 'HeadAgent',
      specialization: 'Governance',
      status: 'IDLE',
      score: 98,
      riskLevel: 'LOW'
    }
  });
  console.log('✅ HeadAgent: 1 (Verified)');

  // 2. TeamLeads (Target: 5)
  const targetTeamLeads = 5;
  const currentTeamLeads = await prisma.agent.count({ where: { role: 'TeamLead' } });
  if (currentTeamLeads < targetTeamLeads) {
    const toCreate = targetTeamLeads - currentTeamLeads;
    console.log(`➕ Creating ${toCreate} TeamLeads...`);
    const newTeamLeads = Array.from({ length: toCreate }).map((_, i) => ({
      role: 'TeamLead',
      specialization: 'Management',
      status: 'IDLE',
      score: 90 + Math.random() * 5,
      riskLevel: 'LOW'
    }));
    await prisma.agent.createMany({ data: newTeamLeads });
  }
  console.log(`✅ TeamLeads: ${targetTeamLeads} (Verified)`);

  // 3. QA Agents (Target: 15 - aiming for middle of 10-20)
  const targetQA = 15;
  const currentQA = await prisma.agent.count({ where: { role: 'QA' } });
  if (currentQA < targetQA) {
    const toCreate = targetQA - currentQA;
    console.log(`➕ Creating ${toCreate} QA Agents...`);
    const newQAs = Array.from({ length: toCreate }).map((_, i) => ({
      role: 'QA',
      specialization: 'Testing',
      status: 'IDLE',
      score: 85 + Math.random() * 10,
      riskLevel: 'LOW'
    }));
    await prisma.agent.createMany({ data: newQAs });
  }
  console.log(`✅ QA Agents: ${targetQA} (Verified)`);

  // 4. MidDev Agents (Target: 40 - aiming for middle of 30-50)
  const targetMidDevs = 40;
  const currentMidDevs = await prisma.agent.count({ where: { role: 'MidDev' } });
  if (currentMidDevs < targetMidDevs) {
    const toCreate = targetMidDevs - currentMidDevs;
    console.log(`➕ Creating ${toCreate} MidDev Agents...`);
    const specializations = ['Backend', 'Frontend', 'FullStack', 'Database', 'API'];
    const newMidDevs = Array.from({ length: toCreate }).map((_, i) => ({
      role: 'MidDev',
      specialization: specializations[i % specializations.length],
      status: 'IDLE',
      score: 75 + Math.random() * 15,
      riskLevel: 'LOW'
    }));
    
    // Batch create to avoid too large query
    const batchSize = 10;
    for (let i = 0; i < newMidDevs.length; i += batchSize) {
      const batch = newMidDevs.slice(i, i + batchSize);
      await prisma.agent.createMany({ data: batch });
    }
  }
  console.log(`✅ MidDev Agents: ${targetMidDevs} (Verified)`);

  console.log('\n🎉 Workforce scaling complete!');
  
  const finalCounts = await prisma.agent.groupBy({
    by: ['role'],
    _count: { id: true }
  });
  console.table(finalCounts.map(c => ({ Role: c.role, Count: c._count.id })));
}

scaleWorkforceCustom()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
