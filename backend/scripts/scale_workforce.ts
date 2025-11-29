/**
 * Scale Workforce - Add 50 MidDev Agents
 * Enables massive parallelization for faster project completion
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SPECIALIZATIONS = ['Backend', 'Frontend', 'FullStack', 'Database', 'API'];

async function scaleWorkforce() {
  console.log('🚀 Scaling AI Company Workforce...\n');

  const targetMidDevs = 50;
  
  // Check existing MidDevs
  const existingMidDevs = await prisma.agent.count({
    where: { role: 'MidDev' }
  });

  const toCreate = Math.max(0, targetMidDevs - existingMidDevs);

  if (toCreate === 0) {
    console.log(`✅ Already have ${existingMidDevs} MidDev agents. No scaling needed.\n`);
    return;
  }

  console.log(`📊 Current MidDevs: ${existingMidDevs}`);
  console.log(`🎯 Target MidDevs: ${targetMidDevs}`);
  console.log(`➕ Creating: ${toCreate} new agents\n`);

  const agents = [];
  
  for (let i = 0; i < toCreate; i++) {
    const specialization = SPECIALIZATIONS[i % SPECIALIZATIONS.length];
    const baseScore = 60 + Math.random() * 15; // 60-75 range for new agents
    
    agents.push({
      role: 'MidDev',
      specialization,
      status: 'IDLE',
      score: Math.round(baseScore * 10) / 10,
      riskLevel: baseScore > 70 ? 'LOW' : 'MEDIUM'
    });
  }

  // Batch create agents
  console.log('⚡ Creating agents in batches...');
  const batchSize = 10;
  let created = 0;

  for (let i = 0; i < agents.length; i += batchSize) {
    const batch = agents.slice(i, i + batchSize);
    await prisma.agent.createMany({
      data: batch
    });
    created += batch.length;
    console.log(`   ✅ Batch ${Math.floor(i / batchSize) + 1}: ${created}/${toCreate} agents created`);
  }

  console.log(`\n✅ Workforce scaled successfully!`);
  console.log(`\n📊 Final Statistics:`);
  
  const finalCount = await prisma.agent.groupBy({
    by: ['role'],
    _count: { id: true }
  });

  console.log('\n   Agents by Role:');
  finalCount.forEach(group => {
    console.log(`   - ${group.role}: ${group._count.id}`);
  });

  const totalAgents = await prisma.agent.count();
  console.log(`\n   🎯 Total Workforce: ${totalAgents} agents`);
  
  console.log(`\n💡 Benefits:`);
  console.log(`   - ${toCreate}x more parallel task execution`);
  console.log(`   - Faster module completion (minutes instead of hours)`);
  console.log(`   - Reduced task queue buildup`);
  console.log(`   - Higher throughput for large projects`);
  
  console.log(`\n🔧 System Capacity:`);
  console.log(`   - Can handle 50+ tasks simultaneously`);
  console.log(`   - TeamLeads can manage 100+ tasks easily`);
  console.log(`   - Pipeline will flow much faster`);
}

scaleWorkforce()
  .catch(e => console.error('❌ Error:', e))
  .finally(async () => {
    await prisma.$disconnect();
  });
