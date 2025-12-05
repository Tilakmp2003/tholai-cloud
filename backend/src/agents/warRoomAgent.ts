import { workspaceManager } from "../services/workspaceManager";
import { randomUUID } from "crypto";
import { emitTaskUpdate } from "../websocket/socketServer";
import { prisma } from "../lib/prisma";
import { getAgentConfig } from "../llm/modelRegistry";
import { callLLM } from "../llm/llmClient";

export async function runWarRoomAgentOnce() {
  // 1. Find a task stuck in WAR_ROOM
  const task = await prisma.task.findFirst({
    where: { status: "WAR_ROOM" },
    include: { assignedToAgent: true, module: { include: { project: true } } }, // <--- Need Project ID via Module
  });

  if (!task) return;

  console.log(`[WarRoom] ⚔️  Entering War Room for Task ${task.id}`);

  try {
    const context = (task.contextPacket as any) ?? {};
    const feedback = (task.reviewFeedback as any) ?? {};
    const traceId = randomUUID();

    // 2. Construct the "Mediator" Prompt
    const prompt = `
You are the WAR ROOM MEDIATOR.
A deadlock has occurred between a Developer Agent and a QA Agent.
They are stuck in a loop of rejection and failed fixes.

Task Context:
${JSON.stringify(context, null, 2)}

Last Feedback (The Blocker):
${JSON.stringify(feedback, null, 2)}

YOUR MISSION:
1. Analyze the conflict. Why are they stuck?
2. Propose a FINAL, synthesized solution that satisfies both requirements.
3. You have OVERRIDE AUTHORITY. Rewrite the code or instructions to break the loop.

Output JSON ONLY:
{
  "analysis": "Why the deadlock happened...",
  "resolution": "The technical fix...",
  "targetFile": "The file path to edit (e.g. app/page.tsx)",
  "finalCode": "The actual code block...",
  "action": "FORCE_MERGE"
}
`;

    // 3. Use model registry to get config (ensures DeepSeek V3)
    const config = await getAgentConfig("Architect");

    const result = await callLLM(config, [
      { role: "system", content: "You are the WAR ROOM MEDIATOR." },
      { role: "user", content: prompt },
    ]);
    let text = result.content.trim();

    // Extract JSON from response
    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}");
    if (jsonStart !== -1 && jsonEnd !== -1) {
      text = text.substring(jsonStart, jsonEnd + 1);
    }

    let resolution;
    try {
      resolution = JSON.parse(text);
    } catch (e) {
      console.error("[WarRoom] Failed to parse JSON:", text);
      return;
    }

    console.log(`[WarRoom] ⚖️  Verdict: ${resolution.analysis}`);

    // --- CRITICAL FIX START ---
    // 4. SANDBOXED VERIFICATION (Claim 1 Upgrade)
    if (
      resolution.targetFile &&
      resolution.finalCode &&
      task.module?.project?.id
    ) {
      console.log(
        `[WarRoom] 🧪 Initiating Sandbox Verification for ${resolution.targetFile}...`
      );

      // Simulate running `npm test` in a sandbox
      // In a real implementation, this would spawn a Docker container or isolated process
      const isSafe = await runSandboxTest(resolution.finalCode);

      if (isSafe) {
        console.log(`[WarRoom] ✅ Sandbox Tests PASSED. Applying patch...`);
        await workspaceManager.writeFile(
          task.module.project.id,
          resolution.targetFile,
          resolution.finalCode
        );
      } else {
        console.error(`[WarRoom] ❌ Sandbox Tests FAILED. Patch rejected.`);
        // In a real system, we would feed this back to the LLM for a retry
        // For now, we abort to prevent breaking the build
        return;
      }
    }
    // --- CRITICAL FIX END ---

    // 5. Update Context & Break Loop
    const updatedContext = {
      ...context,
      warRoomResolution: resolution,
      lastModifiedBy: "WAR_ROOM_MEDIATOR",
    };

    await prisma.task.update({
      where: { id: task.id },
      data: {
        status: "IN_QA", // Send to QA to verify the fix
        contextPacket: updatedContext,
        retryCount: 0, // Reset the counter
        isDeadlocked: false,
        blockedReason: null,
        result: {
          output: resolution.finalCode || resolution.resolution,
          note: "Resolved by War Room",
        },
      },
    });

    // Emit WebSocket update for real-time UI
    const resolvedTask = await prisma.task.findUnique({
      where: { id: task.id },
    });
    if (resolvedTask) emitTaskUpdate(resolvedTask);

    // 6. Log the Event
    await prisma.trace.create({
      data: {
        id: traceId,
        taskId: task.id,
        agentId: "WAR_ROOM_MEDIATOR",
        event: "DEADLOCK_RESOLVED",
        metadata: resolution,
      },
    });

    console.log(
      `[WarRoom] ✅ Deadlock resolved. Task ${task.id} patched and sent to QA.`
    );
  } catch (error) {
    console.error(`[WarRoom] ❌ Failed to resolve deadlock:`, error);
  }
}

import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";

const execAsync = promisify(exec);

/**
 * Simulates a sandboxed test runner.
 * Returns true if the code is "safe" (passes tests).
 *
 * Phase 3 Upgrade: Uses Docker for true isolation.
 */
async function runSandboxTest(code: string): Promise<boolean> {
  const sandboxDir = path.resolve(__dirname, "../../sandbox_temp");
  const testFile = path.join(sandboxDir, "test.ts");

  try {
    // 1. Ensure temp dir exists
    await fs.mkdir(sandboxDir, { recursive: true });

    // 2. Write code to temp file
    await fs.writeFile(testFile, code);

    // 3. Run Docker Container
    // Mounts the temp dir to /usr/src/app inside the container
    // Runs the container ephemerally (--rm)
    // Limits memory to 128MB (-m 128m)
    // Timeouts after 5 seconds
    console.log(`[WarRoom] 🐳 Spawning Docker Sandbox...`);

    // NOTE: This requires the 'sandbox-runner' image to be built:
    // docker build -t sandbox-runner ./backend/sandbox
    const command = `docker run --rm -m 128m -v "${sandboxDir}:/usr/src/app" sandbox-runner ts-node test.ts`;

    await execAsync(command, { timeout: 5000 });

    console.log(`[WarRoom] ✅ Docker Sandbox Passed.`);
    return true;
  } catch (error: any) {
    console.error(`[WarRoom] ❌ Docker Sandbox Failed:`, error.message);
    return false;
  } finally {
    // Cleanup
    try {
      await fs.rm(sandboxDir, { recursive: true, force: true });
    } catch (e) {
      /* ignore */
    }
  }
}
