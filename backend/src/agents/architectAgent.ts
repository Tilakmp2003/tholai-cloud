/**
 * Architect Agent
 * 
 * A senior solutions architect agent that produces creative, well-reasoned design proposals.
 * Generates 3 distinct options (Conservative, Balanced, Bold) and creates ADRs.
 */

import { invokeModel, ModelConfig } from '../services/llmClient';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SYSTEM_PROMPT = `
You are a Principal Software Architect (L7+) with 12+ years of experience designing scalable, secure, and resilient distributed systems.
Your goal is to design a system architecture that meets the user's requirements while balancing trade-offs between speed, cost, and complexity.

You must provide THREE distinct proposals:
1. **CONSERVATIVE**: Proven, boring technology. Low risk, fast to build, easy to hire for. (e.g., Monolith, Postgres, REST)
2. **BALANCED**: Modern best practices. Good balance of scale and complexity. (e.g., Modular Monolith/Microservices, Redis, Docker)
3. **BOLD**: Cutting-edge, high-scale, "Google-scale" architecture. High complexity, high performance. (e.g., Event Sourcing, ScyllaDB, Edge Computing, Kubernetes)

For EACH proposal, you must provide:
- **Summary**: A concise executive summary of the approach.
- **Components**: List of major components (e.g., "Auth Service", "Payment Worker").
- **Infra Components**: Specific technology choices (e.g., "Postgres 15", "Redis Cluster", "RabbitMQ").
- **Trade-offs**: Honest assessment of pros/cons.
- **Cost Estimate**: Estimated monthly infrastructure cost in USD.
- **Diagram**: A Mermaid.js graph definition (graph TD or LR).
- **Data Strategy**: Specific database choices, schemas, and consistency models (e.g., "ScyllaDB for writes, Postgres for read replicas").
- **Risk Assessment**: Potential failure modes and mitigations (e.g., "Eventual consistency lag").
- **Scalability Plan**: How the system handles 10x/100x growth (e.g., "Sharding strategy").
- **Phases**: A phased execution plan (Phase 1: Core, Phase 2: MVP, etc.).
- **Requires Human Review**: Set to true for BOLD proposals or high-risk designs.

Return ONLY valid JSON matching the schema below. No markdown formatting.
`;

export interface ArchitectProposal {
  id: string;
  type: 'CONSERVATIVE' | 'BALANCED' | 'BOLD';
  summary: string;
  components: string[];
  infra_components: { component: string; tech: string }[];
  tradeoffs: string;
  costEstUsdMonth: number;
  diagramMermaid: string;
  tasks: any[];
  safetyFlags: string[];
  estimatedTimelineWeeks: number;
  dataStrategy: string;
  riskAssessment: string;
  scalabilityPlan: string;
  phases: {
    name: string;
    description: string;
    tasks: {
      title: string;
      description?: string;
      required_role?: string;
      acceptance_criteria?: string[];
      module?: string;
      component?: string;
    }[];
  }[];
  requires_human_review: boolean;
}

export interface ArchitectOutput {
  proposals: ArchitectProposal[];
  recommendedProposalId: string;
  adr: string;
  diagrams: string[];
}

export const architectAgent = {
  async designSystem(projectId: string, requirements: string): Promise<ArchitectOutput> {
    console.log(`[Architect] Designing system for project ${projectId}...`);

    // Fetch Agent Config from DB
    const agentRecord = await prisma.agent.findFirst({ where: { role: 'Architect' } });
    if (!agentRecord || !agentRecord.modelConfig) {
      throw new Error("Architect Agent not configured in DB");
    }
    const config = (agentRecord.modelConfig as any).primary as ModelConfig;

    const prompt = `
Project Requirements:
${requirements}

Task: Generate 3 distinct architectural proposals (Conservative, Balanced, Bold) and recommend the best one.
Ensure you include Data Strategy, Risk Assessment, and Phased Execution Plans.
Return ONLY valid JSON matching the specified format.
`;

    try {
      console.log(`[Architect] Invoking ${config.model}...`);
      
      const response = await invokeModel(config, SYSTEM_PROMPT, prompt);

      console.log('[Architect] Response Tokens:', response.tokensOut);

      // Robust JSON Extraction
      let cleaned = response.text.trim();
      const jsonStart = cleaned.indexOf('{');
      const jsonEnd = cleaned.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1) {
        cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
      }

      const output: ArchitectOutput = JSON.parse(cleaned);

      // Validate Output
      if (!output.adr) output.adr = "No ADR generated.";
      if (!output.proposals) output.proposals = [];

      console.log(`[Architect] Generated ADR: ${output.adr.substring(0, 100)}...`);
      
      return output;

    } catch (error) {
      console.error('[Architect] Design failed:', error);
      throw error;
    }
  }
};
