import { PrismaClient, Task } from "@prisma/client";
import { callLLM } from "../llm/llmClient";
import { getAgentConfig } from "../llm/modelRegistry";
import { emitTaskUpdate, emitAgentUpdate } from "../websocket/socketServer";

const prisma = new PrismaClient();

export class SeniorDevAgent {
  async executeTask(task: Task, context: any): Promise<any> {
    const systemPrompt = `
You are a Senior Developer (L6). You are in EXECUTION-MODE.
Your goal is to solve complex coding problems and refactor code.

INPUT:
- Task: ${task.title}
- Context: ${JSON.stringify(context)}

INSTRUCTIONS:
1. Analyze the complex logic.
2. Write optimized, clean code.
3. Handle edge cases.

OUTPUT JSON ONLY:
{
  "status": "COMPLETED" | "FAILED",
  "artifact": "Code solution",
  "fileName": "file.ts"
}
`;

    const config = await getAgentConfig("SeniorDev");
    const response = await callLLM(config, [
      { role: "system", content: systemPrompt },
      { role: "user", content: "Execute complex task." },
    ]);

    try {
      const cleanResponse = response.content
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();
      return JSON.parse(cleanResponse);
    } catch (e) {
      return { status: "FAILED", artifact: "", fileName: "" };
    }
  }
}

export async function runSeniorDevAgentOnce() {
  const tasks = await prisma.task.findMany({
    where: { status: "ASSIGNED", requiredRole: "SeniorDev" },
    take: 5,
  });

  if (tasks.length === 0) return;

  const agent = new SeniorDevAgent();

  for (const task of tasks) {
    console.log(`[SeniorDev] Processing Task ${task.id}`);
    const inProgressTask = await prisma.task.update({
      where: { id: task.id },
      data: { status: "IN_PROGRESS" },
    });
    emitTaskUpdate(inProgressTask);

    try {
      const result = await agent.executeTask(task, task.contextPacket);

      if (result.status === "COMPLETED") {
        const reviewTask = await prisma.task.update({
          where: { id: task.id },
          data: {
            status: "IN_REVIEW",
            outputArtifact: result.artifact,
            relatedFileName: result.fileName,
            lastAgentMessage: "Complex task completed.",
          },
        });
        emitTaskUpdate(reviewTask);
      } else {
        const failedTask = await prisma.task.update({
          where: { id: task.id },
          data: { status: "FAILED", errorMessage: "Failed to execute" },
        });
        emitTaskUpdate(failedTask);
      }
    } catch (error) {
      console.error(`[SeniorDev] Error:`, error);
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
