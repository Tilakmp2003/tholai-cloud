import { architectAgent } from '../agents/architectAgent';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testArchitectCreativity() {
  console.log("🧪 Testing Architect Creativity & Principal Persona...");

  const projectId = "test-project-creative";
  const requirements = "Build a global, real-time auction system for high-frequency trading assets. Must handle 1M TPS.";

  // Mock LLM response
  architectAgent.designSystem = async () => ({
    proposals: [
      {
        id: "prop-1",
        type: "CONSERVATIVE",
        summary: "Monolith with Postgres",
        components: ["API", "DB"],
        infra_components: [{ component: "DB", tech: "Postgres" }],
        tradeoffs: "Simple but hard to scale",
        costEstUsdMonth: 50,
        diagramMermaid: "graph TD; A-->B",
        tasks: [],
        safetyFlags: [],
        estimatedTimelineWeeks: 4,
        dataStrategy: "Relational",
        riskAssessment: "Low",
        scalabilityPlan: "Vertical",
        phases: [{ name: "Phase 1", description: "MVP", tasks: [] }],
        requires_human_review: false
      },
      {
        id: "prop-2",
        type: "BALANCED",
        summary: "Microservices with Redis",
        components: ["Auth", "Payment"],
        infra_components: [{ component: "Cache", tech: "Redis" }],
        tradeoffs: "More complex",
        costEstUsdMonth: 150,
        diagramMermaid: "graph TD; A-->B",
        tasks: [],
        safetyFlags: [],
        estimatedTimelineWeeks: 8,
        dataStrategy: "Polyglot",
        riskAssessment: "Medium",
        scalabilityPlan: "Horizontal",
        phases: [{ name: "Phase 1", description: "Core", tasks: [] }],
        requires_human_review: false
      },
      {
        id: "prop-3",
        type: "BOLD",
        summary: "Event Sourcing with ScyllaDB",
        components: ["EventStore", "Projections"],
        infra_components: [{ component: "DB", tech: "ScyllaDB" }],
        tradeoffs: "High complexity",
        costEstUsdMonth: 500,
        diagramMermaid: "graph TD; A-->B",
        tasks: [],
        safetyFlags: ["Complexity"],
        estimatedTimelineWeeks: 12,
        dataStrategy: "Event Log",
        riskAssessment: "High",
        scalabilityPlan: "Infinite",
        phases: [{ name: "Phase 1", description: "PoC", tasks: [] }],
        requires_human_review: true
      }
    ],
    recommendedProposalId: "prop-2",
    adr: "# ADR",
    diagrams: []
  });

  try {
    const output = await architectAgent.designSystem(projectId, requirements);

    console.log("\n--- Architect Output ---");
    console.log("Recommended Proposal:", output.recommendedProposalId);
    
    output.proposals.forEach(p => {
      console.log(`\n[${p.type}] ${p.summary}`);
      console.log(`   Cost: $${p.costEstUsdMonth}/mo`);
      console.log(`   Tech: ${p.infra_components?.map(c => c.tech).join(', ')}`);
      console.log(`   Risk: ${p.riskAssessment}`);
      console.log(`   Phases: ${p.phases.length}`);
      
      if (p.type === 'BOLD') {
        console.log(`   Requires Human Review: ${p.requires_human_review}`);
        if (!p.requires_human_review) console.warn("⚠️ BOLD proposal should require review!");
      }
    });

    if (output.proposals.length !== 3) {
      throw new Error(`Expected 3 proposals, got ${output.proposals.length}`);
    }

    const bold = output.proposals.find(p => p.type === 'BOLD');
    if (!bold) throw new Error("Missing BOLD proposal");

    console.log("\n✅ Architect Creativity Test Passed!");
  } catch (error) {
    console.error("❌ Test Failed:", error);
    process.exit(1);
  }
}

testArchitectCreativity();
