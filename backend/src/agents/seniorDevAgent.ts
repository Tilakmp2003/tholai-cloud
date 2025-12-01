import { PrismaClient, Task } from '@prisma/client';
import { callLLM } from '../llm/llmClient';
import { getAgentConfig } from '../llm/modelRegistry';

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

    const config = await getAgentConfig('SeniorDev');
    const response = await callLLM(config, [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: "Execute complex task." }
    ]);

    try {
        const cleanResponse = response.content.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanResponse);
    } catch (e) {
        return { status: "FAILED", artifact: "", fileName: "" };
    }
  }
}

export async function runSeniorDevAgentOnce() {
    const tasks = await prisma.task.findMany({
        where: { status: 'ASSIGNED', requiredRole: 'SeniorDev' },
        take: 5
    });

    if (tasks.length === 0) return;

    const agent = new SeniorDevAgent();

    for (const task of tasks) {
        console.log(`[SeniorDev] Processing Task ${task.id}`);
        await prisma.task.update({ where: { id: task.id }, data: { status: 'IN_PROGRESS' } });

        try {
            const result = await agent.executeTask(task, task.contextPacket);

            if (result.status === 'COMPLETED') {
                await prisma.task.update({
                    where: { id: task.id },
                    data: {
                        status: 'IN_REVIEW',
                        outputArtifact: result.artifact,
                        relatedFileName: result.fileName,
                        lastAgentMessage: "Complex task completed."
                    }
                });
            } else {
                await prisma.task.update({ where: { id: task.id }, data: { status: 'FAILED', errorMessage: "Failed to execute" } });
            }
        } catch (error) {
            console.error(`[SeniorDev] Error:`, error);
            await prisma.task.update({ where: { id: task.id }, data: { status: 'FAILED', errorMessage: String(error) } });
        }
    }
}
