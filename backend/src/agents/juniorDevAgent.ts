import { Task, TaskStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { callLLM } from "../llm/llmClient";
import { getAgentConfig } from "../llm/modelRegistry";
import { emitTaskUpdate, emitAgentUpdate } from "../websocket/socketServer";
import { createVerifiedAgent } from "../services/VerifiedAgent";

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

    const config = await getAgentConfig("JuniorDev");
    const response = await callLLM(config, [
      { role: "system", content: systemPrompt },
      { role: "user", content: "Implement this feature." },
    ]);

    try {
      const cleanResponse = response.content
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();
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
      status: "ASSIGNED",
      requiredRole: "JuniorDev",
    },
    take: 5,
  });

  if (tasks.length === 0) return;

  const agent = new JuniorDevAgent();

  for (const task of tasks) {
    console.log(`[JuniorDev] Processing Task ${task.id}`);
    await prisma.task.update({
      where: { id: task.id },
      data: { status: "IN_PROGRESS" },
    });

    const agentId = task.assignedToAgentId;

    try {
      const designContext = task.designContext || {};
      const result = await agent.implementTask(task, designContext);

      if (result.status === "COMPLETED") {
        // HALLUCINATION VERIFICATION GATE WITH AUTO-FIX RETRY
        const verifier = createVerifiedAgent({ 
          agentId: agentId || 'juniorDev', 
          agentRole: 'JuniorDev',
          maxRetries: 2
        });
        
        const MAX_RETRIES = 2;
        let currentCode = result.artifact;
        let verified = false;
        
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
          const verification = await verifier.verifyCode(currentCode, {
            taskId: task.id,
            inputContext: task.title,
            language: 'typescript'
          });

          if (verification.verified) {
            console.log(`[JuniorDev] ✅ Code verified - no hallucinations`);
            result.artifact = currentCode;
            verified = true;
            break;
          }
          
          if (attempt < MAX_RETRIES) {
            console.log(`[JuniorDev] 🔄 Retry ${attempt + 1}/${MAX_RETRIES} - fixing hallucination...`);
            
            const fixPrompt = `
Your previous code had a hallucination error:
${verification.error}

FIX THE CODE - do not use non-existent methods or APIs.
Here is the problematic code:
\`\`\`
${currentCode}
\`\`\`

OUTPUT ONLY the fixed code, no explanation.
`;
            const config = await getAgentConfig("JuniorDev");
            const fixResponse = await callLLM(config, [
              { role: "system", content: "You are a code fixer. Output ONLY valid JavaScript/TypeScript code." },
              { role: "user", content: fixPrompt }
            ]);
            
            currentCode = fixResponse.content
              .replace(/```(?:javascript|typescript|js|ts)?/g, '')
              .replace(/```/g, '')
              .trim();
          } else {
            console.log(`[JuniorDev] ⚠️ HALLUCINATION DETECTED after ${MAX_RETRIES} retries`);
            const hallucinatedTask = await prisma.task.update({
              where: { id: task.id },
              data: {
                status: "FAILED",
                errorMessage: `Hallucination after ${MAX_RETRIES} retries: ${verification.error}`,
              },
            });
            emitTaskUpdate(hallucinatedTask);
            continue;
          }
        }
        
        if (!verified) continue;

        const updatedTask = await prisma.task.update({
          where: { id: task.id },
          data: {
            status: "IN_REVIEW",
            outputArtifact: result.artifact,
            relatedFileName: result.fileName,
          },
        });
        emitTaskUpdate(updatedTask);

        // Update agent stats - reward for success
        if (agentId) {
          const updatedAgent = await prisma.agent.update({
            where: { id: agentId },
            data: {
              successCount: { increment: 1 },
              score: { increment: 5 },
              lastActiveAt: new Date(),
            },
          });
          emitAgentUpdate(updatedAgent);
        }
      } else {
        const failedTask = await prisma.task.update({
          where: { id: task.id },
          data: { status: "FAILED", errorMessage: "Implementation failed" },
        });
        emitTaskUpdate(failedTask);

        // Update agent stats - penalty for failure
        if (agentId) {
          const updatedAgent = await prisma.agent.update({
            where: { id: agentId },
            data: {
              failCount: { increment: 1 },
              score: { decrement: 3 },
            },
          });
          emitAgentUpdate(updatedAgent);
        }
      }
    } catch (error) {
      console.error(`[JuniorDev] Error processing task ${task.id}:`, error);
      const failedTask = await prisma.task.update({
        where: { id: task.id },
        data: { status: "FAILED", errorMessage: String(error) },
      });
      emitTaskUpdate(failedTask);

      // Update agent stats - penalty for error
      if (agentId) {
        const updatedAgent = await prisma.agent.update({
          where: { id: agentId },
          data: {
            failCount: { increment: 1 },
            score: { decrement: 3 },
          },
        });
        emitAgentUpdate(updatedAgent);
      }
    }

    // Mark agent as IDLE
    if (agentId) {
      const idleAgent = await prisma.agent.update({
        where: { id: agentId },
        data: { status: "IDLE", currentTaskId: null, lastActiveAt: new Date() },
      });
      emitAgentUpdate(idleAgent);
    }
  }
}
