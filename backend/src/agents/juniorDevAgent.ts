import { PrismaClient, Task, TaskStatus } from '@prisma/client';
import { callLLM } from '../llm/llmClient';
import { getDefaultModelConfig } from '../llm/modelRegistry';

const prisma = new PrismaClient();

export class JuniorDevAgent {

  async implementTask(task: Task, designContext: any): Promise<any> {
    const systemPrompt = `
You are a Junior Developer (L3). Your job is to IMPLEMENT a feature from scratch.
You follow instructions precisely.

INPUT:
- Task: ${task.title}
- Design Context: ${JSON.stringify(designContext)}

INSTRUCTIONS:
1. Read the Design Context.
2. Write the code for the feature.
3. Ensure it compiles and follows basic best practices.
4. If you are unsure, ask for clarification (but for this task, just do your best).

OUTPUT JSON ONLY:
{
  "status": "COMPLETED" | "FAILED",
  "artifact": "The code you wrote",
  "fileName": "suggested_filename.ts"
}
`;

    const config = getDefaultModelConfig('JuniorDev');
    const response = await callLLM(config, [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: "Implement this feature." }
    ]);

    try {
        const cleanResponse = response.content.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanResponse);
    } catch (e) {
        console.error("Failed to parse JuniorDev response", e);
        return { status: "FAILED", artifact: "", fileName: "" };
    }
  }
}

export async function runJuniorDevAgentOnce() {
    const tasks = await prisma.task.findMany({
        where: {
            status: 'ASSIGNED',
            requiredRole: 'JuniorDev'
        },
        take: 5
    });

    if (tasks.length === 0) return;

    const agent = new JuniorDevAgent();

    for (const task of tasks) {
        console.log(`[JuniorDev] Processing Task ${task.id}`);
        await prisma.task.update({ where: { id: task.id }, data: { status: 'IN_PROGRESS' } });

        try {
            const designContext = task.designContext || {};
            const result = await agent.implementTask(task, designContext);

            if (result.status === 'COMPLETED') {
                await prisma.task.update({
                    where: { id: task.id },
                    data: {
                        status: 'IN_REVIEW',
                        outputArtifact: result.artifact,
                        relatedFileName: result.fileName
                    }
                });
            } else {
                await prisma.task.update({ where: { id: task.id }, data: { status: 'FAILED', errorMessage: "Implementation failed" } });
            }
        } catch (error) {
            console.error(`[JuniorDev] Error processing task ${task.id}:`, error);
            await prisma.task.update({ where: { id: task.id }, data: { status: 'FAILED', errorMessage: String(error) } });
        }
    }
}
