/**
 * Demo: Create Banking Backend Project
 * Demonstrates autonomous AI company workflow with a new project
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createBankingProject() {
  console.log('🏦 Creating Banking Backend Project...\n');

  // 1. Create the project
  console.log('📝 Step 1: Creating project...');
  
  const project = await prisma.project.create({
    data: {
      name: 'Banking Backend API',
      clientName: 'SecureBank Corp',
      status: 'IN_PROGRESS'
    }
  });

  console.log(`   ✅ Project created: ${project.id}`);
  console.log(`      Client: ${project.clientName}\n`);

  // 2. Create modules
  console.log('📝 Step 2: Creating modules...');
  
  const accountModule = await prisma.module.create({
    data: {
      projectId: project.id,
      name: 'Account Management',
      status: 'PLANNED'
    }
  });

  const transactionModule = await prisma.module.create({
    data: {
      projectId: project.id,
      name: 'Transaction Processing',
      status: 'PLANNED'
    }
  });

  const fraudModule = await prisma.module.create({
    data: {
      projectId: project.id,
      name: 'Fraud Detection',
      status: 'PLANNED'
    }
  });

  console.log(`   ✅ Created 3 modules:`);
  console.log(`      - Account Management: ${accountModule.id}`);
  console.log(`      - Transaction Processing: ${transactionModule.id}`);
  console.log(`      - Fraud Detection: ${fraudModule.id}\n`);

  console.log('✅ Banking Backend project setup complete!\n');
  console.log('🎯 What happens next:');
  console.log('   1. Orchestrator assigns modules to TeamLead (every 20s)');
  console.log('   2. TeamLead breaks down into tasks (API endpoints, logic)');
  console.log('   3. MidDevs execute tasks (generate code via Gemini)');
  console.log('   4. TeamLead reviews outputs');
  console.log('   5. QA validates');
  console.log('   6. Governance monitors performance\n');
  console.log('📊 Watch the dashboard:');
  console.log('   - Command Center: http://localhost:3001');
  console.log('   - Pipeline: http://localhost:3001/pipeline');
  console.log('   - Agents: http://localhost:3001/agents\n');
  console.log('⏱️  Estimated completion: 5-15 minutes');
  console.log('💰 Cost: ~$0.01-0.05 (depending on complexity)');
}

createBankingProject()
  .catch(e => console.error('❌ Error:', e))
  .finally(async () => {
    await prisma.$disconnect();
  });
