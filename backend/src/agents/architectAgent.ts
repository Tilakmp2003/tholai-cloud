import { Task } from "@prisma/client";
import { callLLM } from "../llm/llmClient";
import { getAgentConfig } from "../llm/modelRegistry";
import { emitTaskUpdate, emitAgentUpdate, emitLog } from "../websocket/socketServer";
import { prisma } from "../lib/prisma";
import { createVerifiedAgent } from "../services/VerifiedAgent";
import { populationManager } from "../services/evolution/PopulationManager";
import { quickEUpdate, getRoleReward } from "../services/evolution/EvolutionaryRewardHelper";

export interface ArchitectOutput {
  proposals: any[];
  recommendedProposalId: string;
  adr: string;
  diagrams: string[];
}

export class ArchitectAgent {
  async planProject(task: Task, context: any): Promise<any> {
    // ... existing implementation ...
    return this.designSystem(task.id, JSON.stringify(context));
  }

  async designSystem(
    projectId: string,
    requirements: string
  ): Promise<ArchitectOutput> {
    const systemPrompt = `
You are a Chief Architect (L7). You are in DESIGN-MODE.
Your goal is to design the system architecture and implementation plan.

INPUT:
- ProjectId: ${projectId}
- Requirements: ${requirements}

INSTRUCTIONS:
1. Analyze the requirements.
2. Design the high-level architecture.
3. Create proposals (at least one).
4. Identify necessary technologies and patterns.

OUTPUT JSON ONLY:
{
  "proposals": [
    {
      "id": "prop_1",
      "type": "STANDARD",
      "summary": "Standard implementation",
      "phases": [
        { "name": "Phase 1", "tasks": [{ "title": "Setup", "required_role": "MidDev" }] }
      ],
      "tradeoffs": [],
      "dataStrategy": {},
      "riskAssessment": {}
    }
  ],
  "recommendedProposalId": "prop_1",
  "adr": "Architecture Decision Record...",
  "diagrams": []
}
`;

    const config = await getAgentConfig("Architect");
    console.log(
      `[Architect] Calling LLM with config:`,
      config.provider,
      config.model
    );

    const response = await callLLM(config, [
      { role: "system", content: systemPrompt },
      { role: "user", content: "Create architecture design." },
    ]);

    console.log(
      `[Architect] LLM response length: ${response.content?.length || 0}`
    );

    try {
      const cleanResponse = response.content
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();
      const parsed = JSON.parse(cleanResponse);
      console.log(
        `[Architect] Parsed ${parsed.proposals?.length || 0} proposals`
      );
      return parsed;
    } catch (e) {
      console.error("[Architect] Failed to parse response:", e);
      console.error(
        "[Architect] Raw response:",
        response.content?.substring(0, 500)
      );

      // Return a valid fallback instead of empty
      return {
        proposals: [
          {
            id: "fallback_1",
            type: "STANDARD",
            summary: "Standard implementation with core features",
            phases: [
              {
                name: "Core Development",
                tasks: [
                  {
                    title: "Setup project structure and dependencies",
                    required_role: "MidDev",
                    description:
                      "Initialize project with necessary configuration",
                  },
                  {
                    title: "Implement main functionality",
                    required_role: "MidDev",
                    description: "Build the core features",
                  },
                  {
                    title: "Create user interface",
                    required_role: "MidDev",
                    description: "Design and implement UI components",
                  },
                  {
                    title: "Add styling",
                    required_role: "MidDev",
                    description: "Style the application",
                  },
                  {
                    title: "Testing and validation",
                    required_role: "QA",
                    description: "Write and run tests",
                  },
                ],
              },
            ],
            tradeoffs: [],
            dataStrategy: {},
            riskAssessment: {},
          },
        ],
        recommendedProposalId: "fallback_1",
        adr: "Using standard architecture due to LLM parsing failure",
        diagrams: [],
      };
    }
  }
}

export const architectAgent = new ArchitectAgent();

export async function runArchitectAgentOnce() {
  const tasks = await prisma.task.findMany({
    where: {
      status: "ASSIGNED",
      requiredRole: { in: ["Architect", "ARCHITECT", "architect"] },
    },
    take: 5,
  });

  if (tasks.length === 0) return;

  const agent = new ArchitectAgent();

  for (const task of tasks) {
    console.log(`[Architect] Processing Task ${task.id}`);
    const inProgressTask = await prisma.task.update({
      where: { id: task.id },
      data: { status: "IN_PROGRESS" },
    });
    emitTaskUpdate(inProgressTask);

    try {
      const result = await agent.planProject(task, task.contextPacket);

      if (result) {
        // HALLUCINATION VERIFICATION GATE WITH AUTO-FIX RETRY for any code in ADR
        const verifier = createVerifiedAgent({ 
          agentId: task.assignedToAgentId || 'architect', 
          agentRole: 'Architect',
          maxRetries: 2
        });
        
        // Check if ADR contains code blocks that need verification
        let adrContent = typeof result === 'string' ? result : JSON.stringify(result);
        const hasCode = adrContent.includes('```') || adrContent.includes('function') || adrContent.includes('const ');
        
        if (hasCode) {
          const MAX_RETRIES = 2;
          let verified = false;
          
          for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            const verification = await verifier.verifyCode(adrContent, {
              taskId: task.id,
              inputContext: task.title,
              language: 'typescript'
            });

            if (verification.verified) {
              console.log(`[Architect] ✅ Architecture verified`);
              verified = true;
              break;
            }
            
            if (attempt < MAX_RETRIES) {
              console.log(`[Architect] 🔄 Retry ${attempt + 1}/${MAX_RETRIES} - fixing hallucination...`);
              
              const fixPrompt = `
Your previous architecture design had a hallucination error:
${verification.error}

FIX THE CODE - do not use non-existent methods or APIs.
Here is the problematic content:
\`\`\`
${adrContent.slice(0, 2000)}
\`\`\`

OUTPUT ONLY the fixed architecture JSON, no explanation.
`;
              const config = await getAgentConfig("Architect");
              const fixResponse = await callLLM(config, [
                { role: "system", content: "You are an architecture fixer. Output ONLY valid JSON." },
                { role: "user", content: fixPrompt }
              ]);
              
              adrContent = fixResponse.content
                .replace(/```(?:json)?/g, '')
                .replace(/```/g, '')
                .trim();
            } else {
              console.log(`[Architect] ⚠️ HALLUCINATION DETECTED after ${MAX_RETRIES} retries`);
              const hallucinatedTask = await prisma.task.update({
                where: { id: task.id },
                data: {
                  status: "FAILED",
                  errorMessage: `Hallucination in ADR after ${MAX_RETRIES} retries: ${verification.error}`,
                },
              });
              emitTaskUpdate(hallucinatedTask);
              continue;
            }
          }
          
          if (!verified) continue;
        }

        const reviewTask = await prisma.task.update({
          where: { id: task.id },
          data: {
            status: "IN_REVIEW",
            outputArtifact: JSON.stringify(result),
            lastAgentMessage: "Architecture plan created.",
          },
        });
        emitTaskUpdate(reviewTask);

        // EVOLUTIONARY: Reward architect for successful design
        if (task.assignedToAgentId) {
          await quickEUpdate(task.assignedToAgentId, getRoleReward('Architect', 'success'), 'Architecture completed');
        }
      } else {
        const failedTask = await prisma.task.update({
          where: { id: task.id },
          data: { status: "FAILED", errorMessage: "Failed to plan" },
        });
        emitTaskUpdate(failedTask);

        // EVOLUTIONARY: Penalty for failed design
        if (task.assignedToAgentId) {
          await quickEUpdate(task.assignedToAgentId, getRoleReward('Architect', 'failure'), 'Architecture failed');
        }
      }
    } catch (error) {
      console.error(`[Architect] Error:`, error);
      const failedTask = await prisma.task.update({
        where: { id: task.id },
        data: { status: "FAILED", errorMessage: String(error) },
      });
      emitTaskUpdate(failedTask);

      // EVOLUTIONARY: Penalty for error
      if (task.assignedToAgentId) {
        await quickEUpdate(task.assignedToAgentId, -10, 'Architecture error');
      }
    }

    // Mark agent as IDLE and release to pool
    if (task.assignedToAgentId) {
      const idleAgent = await prisma.agent.update({
        where: { id: task.assignedToAgentId },
        data: { status: "IDLE", currentTaskId: null },
      });
      emitAgentUpdate(idleAgent);
      populationManager.releaseAgent(task.assignedToAgentId);
    }
  }
}
