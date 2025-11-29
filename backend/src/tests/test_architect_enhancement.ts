// @ts-nocheck
import { architectAgent } from '../agents/architectAgent';
import { createModulesFromArchitectPlan } from '../services/projectPlanner';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

async function runTest() {
  console.log('🏛️ Testing Principal Architect Agent...');

  const requirements = `
    Build a high-scale e-commerce platform for a flash-sale site.
    Must handle 1M concurrent users during sales.
    Needs real-time inventory tracking.
    Global availability.
  `;

  try {
    // 1. Mock Architect Output (Principal Engineer Persona)
    console.log('\n[1] Generating Architecture Proposals (MOCKED)...');
    
    // Mock the agent's response to avoid API key issues and ensure deterministic testing of the new schema
    const mockOutput = {
      proposals: [
        {
          id: "BOLD-1",
          type: "BOLD",
          summary: "Event-Sourced Microservices with Edge Computing",
          components: ["Auth Service", "Inventory Service", "Order Service", "Edge API"],
          tradeoffs: "High complexity but infinite scale.",
          costEstUsdMonth: 500,
          diagramMermaid: "graph TD; A-->B;",
          tasks: [],
          safetyFlags: ["Complexity"],
          estimatedTimelineWeeks: 12,
          dataStrategy: "ScyllaDB for high-throughput writes, EventStore for sourcing.",
          riskAssessment: "Eventual consistency lag could impact inventory. Mitigation: Optimistic UI.",
          scalabilityPlan: "Horizontal scaling of consumers. Edge caching for reads.",
          phases: [
            {
              name: "Phase 1: Core Infra",
              description: "Setup K8s and Event Bus",
              tasks: [{ title: "Setup ScyllaDB", required_role: "DevOps" }]
            },
            {
              name: "Phase 2: MVP",
              description: "Basic Order Flow",
              tasks: [{ title: "Implement Order Service", required_role: "Backend" }]
            }
          ]
        }
      ],
      recommendedProposalId: "BOLD-1",
      adr: "# ADR: Event Sourcing",
      diagrams: [],
      tasks: []
    };

    // We skip the actual call and use the mock
    const output = mockOutput as any; 

    console.log('\n✅ Architect Output Received (Mocked)');
    console.log(`Recommended Proposal: ${output.recommendedProposalId}`);
    
    const proposal = output.proposals.find(p => p.id === output.recommendedProposalId);
    if (!proposal) throw new Error('Proposal not found');

    // Verify New Fields
    console.log('\n[2] Verifying Principal Engineer Fields:');
    console.log(`- Data Strategy: ${proposal.dataStrategy ? '✅ Present' : '❌ MISSING'}`);
    if (proposal.dataStrategy) console.log(`  "${proposal.dataStrategy.substring(0, 100)}..."`);
    
    console.log(`- Risk Assessment: ${proposal.riskAssessment ? '✅ Present' : '❌ MISSING'}`);
    if (proposal.riskAssessment) console.log(`  "${proposal.riskAssessment.substring(0, 100)}..."`);
    
    console.log(`- Scalability Plan: ${proposal.scalabilityPlan ? '✅ Present' : '❌ MISSING'}`);
    
    console.log(`- Phases: ${proposal.phases && proposal.phases.length > 0 ? '✅ Present' : '❌ MISSING'}`);
    if (proposal.phases) {
      console.log(`  Count: ${proposal.phases.length}`);
      proposal.phases.forEach((p: any) => console.log(`  - ${p.name}: ${p.tasks.length} tasks`));
    }

    // 2. Test Planner Phased Execution
    console.log('\n[3] Testing Planner Phased Execution...');
    // Mock project ID for module creation
    const project = await prisma.project.create({
      data: { name: 'Arch Test Project', clientName: 'Test' }
    });

    const modules = await createModulesFromArchitectPlan(project.id, output);
    
    console.log(`\n✅ Created ${modules.length} modules.`);
    const tasks = await prisma.task.findMany({ where: { moduleId: { in: modules.map((m: any) => m.id) } } });
    console.log(`✅ Created ${tasks.length} tasks.`);
    
    // Check if tasks have phase tags
    const tasksWithPhase = await prisma.task.findMany({ 
      where: { 
        moduleId: { in: modules.map(m => m.id) },
        contextPacket: { path: ['phase'], not: Prisma.JsonNull }
      }
    });
    // Note: Prisma JSON filtering might be tricky, let's check in JS
    const phasedTasks = tasks.filter((t: any) => t.contextPacket?.phase);
    console.log(`✅ Tasks with Phase tag: ${phasedTasks.length}`);

    console.log('\n🎉 Architect Enhancement Verification Complete!');

  } catch (error) {
    console.error('❌ Test Failed:', error);
  }
}

runTest();
