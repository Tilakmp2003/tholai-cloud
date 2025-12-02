import { PrismaClient, Task } from "@prisma/client";
import { callLLM } from "../llm/llmClient";
import { getAgentConfig } from "../llm/modelRegistry";
import { emitTaskUpdate, emitAgentUpdate } from "../websocket/socketServer";

const prisma = new PrismaClient();

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
    const response = await callLLM(config, [
      { role: "system", content: systemPrompt },
      { role: "user", content: "Create architecture design." },
    ]);

    try {
      const cleanResponse = response.content
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();
      return JSON.parse(cleanResponse);
    } catch (e) {
      console.error("Failed to parse Architect response", e);
      return {
        proposals: [],
        recommendedProposalId: "",
        adr: "",
        diagrams: [],
      };
    }
  }
}

export const architectAgent = new ArchitectAgent();

export async function runArchitectAgentOnce() {
  const tasks = await prisma.task.findMany({
    where: { status: "ASSIGNED", requiredRole: "Architect" },
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
        const reviewTask = await prisma.task.update({
          where: { id: task.id },
          data: {
            status: "IN_REVIEW",
            outputArtifact: JSON.stringify(result),
            lastAgentMessage: "Architecture plan created.",
          },
        });
        emitTaskUpdate(reviewTask);
      } else {
        const failedTask = await prisma.task.update({
          where: { id: task.id },
          data: { status: "FAILED", errorMessage: "Failed to plan" },
        });
        emitTaskUpdate(failedTask);
      }
    } catch (error) {
      console.error(`[Architect] Error:`, error);
      const failedTask = await prisma.task.update({
        where: { id: task.id },
        data: { status: "FAILED", errorMessage: String(error) },
      });
      emitTaskUpdate(failedTask);
    }

    // Mark agent as IDLE
    if (task.assignedToAgentId) {
      const idleAgent = await prisma.agent.update({
        where: { id: task.assignedToAgentId },
        data: { status: "IDLE", currentTaskId: null },
      });
      emitAgentUpdate(idleAgent);
    }
  }
}
