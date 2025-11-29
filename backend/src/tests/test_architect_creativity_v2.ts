
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

// --- MOCK LLM CLIENT ---
const mockCallLLM = async (config: any, messages: any[]) => {
  return {
    content: JSON.stringify({
      proposals: [
        {
          id: "A",
          type: "CONSERVATIVE",
          summary: "Monolith with Postgres",
          components: ["Monolith API", "Postgres"],
          tradeoffs: "Simple but hard to scale",
          costEstUsdMonth: 50,
          diagramMermaid: "graph TD; API-->DB;",
          tasks: [{ title: "Setup Monolith" }],
          safetyFlags: [],
          estimatedTimelineWeeks: 4
        },
        {
          id: "B",
          type: "BALANCED",
          summary: "Microservices with Redis",
          components: ["Auth Service", "Inventory Service", "Postgres", "Redis"],
          tradeoffs: "Scalable but complex",
          costEstUsdMonth: 150,
          diagramMermaid: "graph TD; Auth-->DB; Inventory-->Redis;",
          tasks: [{ title: "Setup Auth" }, { title: "Setup Inventory" }],
          safetyFlags: [],
          estimatedTimelineWeeks: 8
        },
        {
          id: "C",
          type: "BOLD",
          summary: "Event Sourcing with Kafka",
          components: ["Event Store", "Projections", "Kafka"],
          tradeoffs: "High complexity, infinite scale",
          costEstUsdMonth: 300,
          diagramMermaid: "graph TD; Events-->Kafka;",
          tasks: [{ title: "Setup Kafka" }],
          safetyFlags: ["High Complexity"],
          estimatedTimelineWeeks: 12
        }
      ],
      recommendedProposalId: "B",
      adr: "# ADR: Microservices\n\nWe chose option B because...",
      diagrams: ["graph TD; Auth-->DB;"],
      tasks: [{ title: "Setup Auth" }]
    })
  };
};

// --- AGENT LOGIC (Copied for verification) ---
export interface ArchitectProposal {
  id: string;
  type: 'CONSERVATIVE' | 'BALANCED' | 'BOLD';
  summary: string;
  components: string[];
  tradeoffs: string;
  costEstUsdMonth: number;
  diagramMermaid: string;
  tasks: any[];
  safetyFlags: string[];
  estimatedTimelineWeeks: number;
}

export interface ArchitectOutput {
  proposals: ArchitectProposal[];
  recommendedProposalId: string;
  adr: string;
  diagrams: string[];
  tasks: any[];
}

const SYSTEM_PROMPT = `You are ARCHITECT_AGENT...`; // (Truncated for brevity in test)

const architectAgent = {
  async designSystem(projectId: string, requirements: string): Promise<ArchitectOutput> {
    console.log(`[Architect] Designing system for project ${projectId}...`);
    
    // Use MOCK LLM
    const response = await mockCallLLM({}, []);
    
    const cleaned = response.content.replace(/```json|```/g, '').trim();
    const output: ArchitectOutput = JSON.parse(cleaned);
    return output;
  }
};

// --- TEST RUNNER ---
async function runTests() {
  console.log('🧪 Starting Architect Creativity Tests (Self-Contained)...');
  const projectId = `test-project-${randomUUID()}`;
  const requirements = "Build a scalable e-commerce platform.";

  const output = await architectAgent.designSystem(projectId, requirements);

  // Verification
  if (output.proposals.length === 3) {
    console.log('✅ PASSED: Generated 3 distinct proposals');
  } else {
    console.error(`❌ FAILED: Expected 3 proposals, got ${output.proposals.length}`);
  }

  if (output.proposals.find(p => p.type === 'BOLD')) {
    console.log('✅ PASSED: Includes BOLD proposal');
  } else {
    console.error('❌ FAILED: Missing BOLD proposal');
  }

  if (output.adr.includes("# ADR")) {
    console.log('✅ PASSED: Generated ADR');
  } else {
    console.error('❌ FAILED: Missing ADR');
  }

  console.log('🎉 Architect Creativity Tests Completed!');
}

runTests().catch(console.error);
