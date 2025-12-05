import { Task } from "@prisma/client";
import { callLLM } from "../llm/llmClient";
import { getAgentConfig } from "../llm/modelRegistry";
import { prisma } from "../lib/prisma";

export class AgentOpsAgent {
  async analyzeLogs(task: Task, context: any): Promise<any> {
    const systemPrompt = `
You are an AgentOps Engineer. You are in OBSERVABILITY-MODE.
Your goal is to analyze logs and detect anomalies.

INPUT:
- Task: ${task.title}
- Context: ${JSON.stringify(context)}

INSTRUCTIONS:
1. Scan logs for errors or patterns.
2. Summarize findings.
3. Suggest fixes.

OUTPUT JSON ONLY:
{
  "status": "COMPLETED" | "FAILED",
  "report": "Analysis report"
}
`;

    const config = await getAgentConfig("AgentOps");
    const response = await callLLM(config, [
      { role: "system", content: systemPrompt },
      { role: "user", content: "Analyze logs." },
    ]);

    try {
      const cleanResponse = response.content
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();
      return JSON.parse(cleanResponse);
    } catch (e) {
      return { status: "FAILED", report: "" };
    }
  }
}

export async function runAgentOpsAgentOnce() {
  const tasks = await prisma.task.findMany({
    where: {
      status: "ASSIGNED",
      requiredRole: {
        in: ["AgentOps", "AGENTOPS", "AGENT_OPS", "agentOps", "agentops"],
      },
    },
    take: 5,
  });

  if (tasks.length === 0) return;

  const agent = new AgentOpsAgent();

  for (const task of tasks) {
    console.log(`[AgentOps] Processing Task ${task.id}`);
    await prisma.task.update({
      where: { id: task.id },
      data: { status: "IN_PROGRESS" },
    });

    try {
      const result = await agent.analyzeLogs(task, task.contextPacket);

      if (result.status === "COMPLETED") {
        await prisma.task.update({
          where: { id: task.id },
          data: {
            status: "COMPLETED", // AgentOps tasks might verify themselves or go to review
            outputArtifact: result.report,
            lastAgentMessage: "Log analysis complete.",
          },
        });
      } else {
        await prisma.task.update({
          where: { id: task.id },
          data: { status: "FAILED", errorMessage: "Failed to analyze" },
        });
      }
    } catch (error) {
      console.error(`[AgentOps] Error:`, error);
      await prisma.task.update({
        where: { id: task.id },
        data: { status: "FAILED", errorMessage: String(error) },
      });
    }
  }
}
