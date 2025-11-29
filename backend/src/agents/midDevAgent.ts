import { PrismaClient, Task, TaskStatus } from '@prisma/client';
import { callLLM } from '../llm/llmClient';
import { getDefaultModelConfig } from '../llm/modelRegistry';

const prisma = new PrismaClient();

export class MidDevAgent {

  async fixTask(task: Task, relatedFileContent: string, qaFeedback: any): Promise<any> {
    const systemPrompt = `
You are a Mid-Level Developer (L4). You are in FIX-MODE.
Your goal is to fix the reported issues in the code.

INPUT:
- Task: ${task.title}
- Related File: ${task.relatedFileName}
- File Content:
\`\`\`typescript
${relatedFileContent}
\`\`\`
- QA/Review Feedback: ${JSON.stringify(qaFeedback)}

INSTRUCTIONS:
1. Analyze the Feedback.
2. Modify ONLY the Related File to fix the issues.
3. Do NOT make unnecessary changes.
4. Run a mental simulation of the fix.

OUTPUT JSON ONLY:
{
  "status": "FIXED" | "FAILED",
  "newFileContent": "Full content of the file with fixes applied",
  "commitMessage": "Fix: <brief description> (QA#<id>)"
}
`;

    const config = getDefaultModelConfig('MidDev');
    const response = await callLLM(config, [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: "Fix the code based on feedback." }
    ]);

    try {
        const cleanResponse = response.content.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanResponse);
    } catch (e) {
        console.error("Failed to parse MidDev response", e);
        return { status: "FAILED", newFileContent: relatedFileContent, commitMessage: "Parse Error" };
    }
  }

  async implementTask(task: Task, designContext: any): Promise<any> {
      // Basic implementation logic for fresh tasks
      const systemPrompt = `
You are a Mid-Level Developer (L4). You are in IMPLEMENTATION-MODE.
Your goal is to implement the requested feature.

INPUT:
- Task: ${task.title}
- Design Context: ${JSON.stringify(designContext)}

INSTRUCTIONS:
1. Implement the feature based on the design.
2. Ensure code is clean and typed.

OUTPUT JSON ONLY:
{
  "status": "COMPLETED" | "FAILED",
  "artifact": "The code you wrote",
  "fileName": "suggested_filename.ts"
}
`;
      const config = getDefaultModelConfig('MidDev');
      const response = await callLLM(config, [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: "Implement feature." }
      ]);

      try {
          const cleanResponse = response.content.replace(/```json/g, '').replace(/```/g, '').trim();
          return JSON.parse(cleanResponse);
      } catch (e) {
          return { status: "FAILED", artifact: "", fileName: "" };
      }
  }
}

export async function runMidDevAgentOnce() {
    // Find tasks assigned to MidDevs that are either ASSIGNED (new) or NEEDS_REVISION (fix)
    const tasks = await prisma.task.findMany({
        where: {
            OR: [
                { status: 'ASSIGNED', requiredRole: 'MidDev' },
                { status: 'NEEDS_REVISION', requiredRole: 'MidDev' }
            ]
        },
        take: 5
    });

    if (tasks.length === 0) return;

    const agent = new MidDevAgent();

    for (const task of tasks) {
        console.log(`[MidDev] Processing Task ${task.id} (${task.status})`);

        // Mark as IN_PROGRESS
        await prisma.task.update({ where: { id: task.id }, data: { status: 'IN_PROGRESS' } });

        try {
            let result;
            if (task.status === 'NEEDS_REVISION') {
                // FIX MODE
                // Mock reading file content (in real app, read from file system/repo)
                const fileContent = "// Mock file content"; 
                const feedback = task.reviewFeedback || task.qaFeedback;
                
                result = await agent.fixTask(task, fileContent, feedback);
                
                if (result.status === 'FIXED') {
                    await prisma.task.update({
                        where: { id: task.id },
                        data: {
                            status: 'IN_REVIEW', // Send back to Review
                            outputArtifact: result.newFileContent,
                            lastAgentMessage: result.commitMessage
                        }
                    });
                } else {
                    // Failed to fix?
                    await prisma.task.update({ where: { id: task.id }, data: { status: 'FAILED', errorMessage: "Agent failed to fix" } });
                }

            } else {
                // IMPLEMENTATION MODE
                const designContext = task.designContext || {};
                result = await agent.implementTask(task, designContext);

                if (result.status === 'COMPLETED') {
                    await prisma.task.update({
                        where: { id: task.id },
                        data: {
                            status: 'IN_REVIEW', // Send to Review
                            outputArtifact: result.artifact,
                            relatedFileName: result.fileName
                        }
                    });
                } else {
                     await prisma.task.update({ where: { id: task.id }, data: { status: 'FAILED', errorMessage: "Agent failed to implement" } });
                }
            }

        } catch (error) {
            console.error(`[MidDev] Error processing task ${task.id}:`, error);
            await prisma.task.update({ where: { id: task.id }, data: { status: 'FAILED', errorMessage: String(error) } });
        }
    }
}
