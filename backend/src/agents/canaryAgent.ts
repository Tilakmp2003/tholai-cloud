import { PrismaClient, Task } from '@prisma/client';
import { callLLM } from '../llm/llmClient';
import { getAgentConfig } from '../llm/modelRegistry';

const prisma = new PrismaClient();

export class CanaryAgent {

  async probeSystem(task: Task, context: any): Promise<any> {
    const systemPrompt = `
You are a Canary Agent. You are in PROBING-MODE.
Your goal is to validate system health and configuration.

INPUT:
- Task: ${task.title}
- Context: ${JSON.stringify(context)}

INSTRUCTIONS:
1. Check the specific configuration or endpoint.
2. Verify expected behavior.
3. Report status.

OUTPUT JSON ONLY:
{
  "status": "COMPLETED" | "FAILED",
  "result": "Validation result"
}
`;

    const config = await getAgentConfig('Canary');
    const response = await callLLM(config, [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: "Probe system." }
    ]);

    try {
        const cleanResponse = response.content.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanResponse);
    } catch (e) {
        return { status: "FAILED", result: "" };
    }
  }
}

export async function runCanaryAgentOnce() {
    const tasks = await prisma.task.findMany({
        where: { status: 'ASSIGNED', requiredRole: 'Canary' },
        take: 5
    });

    if (tasks.length === 0) return;

    const agent = new CanaryAgent();

    for (const task of tasks) {
        console.log(`[Canary] Processing Task ${task.id}`);
        await prisma.task.update({ where: { id: task.id }, data: { status: 'IN_PROGRESS' } });

        try {
            const result = await agent.probeSystem(task, task.contextPacket);

            if (result.status === 'COMPLETED') {
                await prisma.task.update({
                    where: { id: task.id },
                    data: {
                        status: 'COMPLETED',
                        outputArtifact: result.result,
                        lastAgentMessage: "Validation complete."
                    }
                });
            } else {
                await prisma.task.update({ where: { id: task.id }, data: { status: 'FAILED', errorMessage: "Validation failed" } });
            }
        } catch (error) {
            console.error(`[Canary] Error:`, error);
            await prisma.task.update({ where: { id: task.id }, data: { status: 'FAILED', errorMessage: String(error) } });
        }
    }
}
