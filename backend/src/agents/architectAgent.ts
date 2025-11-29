/**
 * Architect Agent
 * 
 * A senior solutions architect agent that produces creative, well-reasoned design proposals.
 * Generates 3 distinct options (Conservative, Balanced, Bold) and creates ADRs.
 */

import { callLLM } from '../llm/llmClient';
import { getDefaultModelConfig } from '../llm/modelRegistry';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { ModelConfig } from '../llm/types';

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
  tasks: any[]; // Legacy field, keep empty or minimal
  safetyFlags: string[];
  estimatedTimelineWeeks: number;
  
  // Principal Engineer Fields
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
      module?: string; // Optional mapping
      component?: string; // Optional mapping
    }[];
  }[];
  requires_human_review: boolean;
}

export interface ArchitectOutput {
  proposals: ArchitectProposal[];
  recommendedProposalId: string;
  adr: string; // Markdown Architecture Decision Record
  diagrams: string[]; // URLs or Mermaid strings
}

export const architectAgent = {
  /**
   * Design architecture for a given requirement
   */
  async designSystem(projectId: string, requirements: string): Promise<ArchitectOutput> {
    console.log(`[Architect] Designing system for project ${projectId}...`);

    // 0. Cost Guard Check (Mocked for now, ideally check budgetLimiter)
    const dailyCost = 0; // Fetch from DB
    const DAILY_LIMIT = 10.0;
    if (dailyCost > DAILY_LIMIT) {
      console.warn('[Architect] Daily budget exceeded. Switching to dry-run/cheaper mode.');
      // Fallback logic or error could go here
    }

    // 1. Ideation Phase (Creative Model)
    const ideationConfig: ModelConfig = {
      provider: 'openrouter',
      model: 'deepseek/deepseek-chat', // DeepSeek V3 for creativity
      temperature: 0.7,
      maxTokens: 4000
    };

    // 2. Artifact Generation Phase (Cheaper/Faster Model)
    // We could use this for ADR refinement if we split the steps, 
    // but for now we'll keep it simple and use the creative model for the main proposal 
    // to ensure consistency, but we define the config for future use.
    const _artifactConfig: ModelConfig = {
      provider: 'gemini',
      model: 'gemini-1.5-flash',
      temperature: 0.2,
      maxTokens: 2000
    };

    const prompt = `
Project Requirements:
${requirements}

Task: Generate 3 distinct architectural proposals (Conservative, Balanced, Bold) and recommend the best one.
Ensure you include Data Strategy, Risk Assessment, and Phased Execution Plans.
Return ONLY valid JSON matching the specified format.
`;

    try {
      // Audit Log: Record Prompt
      const auditLog = {
        timestamp: new Date().toISOString(),
        projectId,
        phase: 'ideation',
        model: ideationConfig.model,
        prompt: prompt.substring(0, 500) + '...' // Truncate for log
      };
      console.log('[Architect] Audit Log:', JSON.stringify(auditLog));

      const response = await callLLM(ideationConfig, [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt }
      ]);

      // Audit Log: Record Response
      console.log('[Architect] Response Tokens:', response.usage?.totalTokens || 'unknown');

      const cleaned = response.content.replace(/```json|```/g, '').trim();
      const output: ArchitectOutput = JSON.parse(cleaned);

      // 3. Persist ADR (Optional: could be stored in Artifact table)
      console.log(`[Architect] Generated ADR: ${output.adr.substring(0, 100)}...`);
      
      return output;

    } catch (error) {
      console.error('[Architect] Design failed:', error);
      throw error;
    }
  }
};
