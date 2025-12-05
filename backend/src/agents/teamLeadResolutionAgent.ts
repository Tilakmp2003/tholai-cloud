// @ts-nocheck
import { invokeModel, ModelConfig } from "../services/llmClient";
import { randomUUID } from "crypto";
import { prisma } from "../lib/prisma";

export async function runTeamLeadResolutionOnce() {
  console.log("[TeamLead-Resolution] Checking escalations...");

  const escalations = await prisma.contextRequest.findMany({
    where: { status: "OPEN" },
    include: { task: true },
    take: 5,
  });

  if (escalations.length === 0) {
    console.log("[TeamLead-Resolution] No OPEN escalations");
    return;
  }

  for (const esc of escalations) {
    const traceId = randomUUID();

    console.log(
      `[TeamLead-Resolution] Resolving escalation ${esc.id} for task ${esc.taskId}`
    );

    if (!esc.task) {
      console.error(
        `[TeamLead-Resolution] Task missing for escalation ${esc.id}`
      );
      continue;
    }

    try {
      // ----------------------------------------------
      // 1. Load current context packet
      // ----------------------------------------------
      const currentPacket = esc.task.contextPacket ?? {};
      const issue = esc.message;
      const issueType = esc.issueType;

      // ----------------------------------------------
      // 2. Fetch Agent Config and Ask Bedrock for clarification/fix
      // ----------------------------------------------
      const agentRecord = await prisma.agent.findFirst({
        where: { role: "TeamLead" },
      });
      if (!agentRecord || !agentRecord.modelConfig) {
        console.error(
          "[TeamLead-Resolution] Agent config not found. Skipping."
        );
        continue;
      }
      const config = (agentRecord.modelConfig as any).primary as ModelConfig;
      const prompt = `
You are a Team Lead Agent in a virtual software company.
A developer has raised an escalation because they are confused.

You must:
1. Understand the issue.
2. Provide a correction or clarification.
3. Provide a "patch" JSON which should be merged into the task's contextPacket.

Input:
Task ContextPacket: ${JSON.stringify(currentPacket, null, 2)}
Issue Type: ${issueType}
Issue Message: ${issue}

Strict Output (JSON only):
{
  "clarification": "Human-readable explanation",
  "patch": { ... updated contextPacket fields ... }
}
`;

      let responseText = "";
      try {
        const result = await invokeModel(
          config,
          "You are a Team Lead Agent.",
          prompt
        );
        responseText = result.text;
      } catch (err: any) {
        console.error(
          `[TeamLead-Resolution] Error invoking LLM for escalation ${esc.id}:`,
          err
        );
        continue;
      }

      // Extract JSON
      let cleaned = responseText.trim();
      const jsonStart = cleaned.indexOf("{");
      const jsonEnd = cleaned.lastIndexOf("}");
      if (jsonStart !== -1 && jsonEnd !== -1) {
        cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
      }
      const parsed = JSON.parse(cleaned);

      const clarification = parsed.clarification;
      const patch = parsed.patch ?? {};

      // ----------------------------------------------
      // 3. Merge patch → updated contextPacket
      // ----------------------------------------------
      const history = Array.isArray(currentPacket.history)
        ? currentPacket.history
        : [];

      const updatedPacket = {
        ...currentPacket,
        ...patch,
        version: (currentPacket.version ?? esc.task.contextVersion ?? 1) + 1,
        history: [
          ...history,
          {
            event: "CLARIFIED",
            actor: "TeamLead",
            message: clarification,
            timestamp: new Date().toISOString(),
          },
        ],
        lastClarifiedBy: "TeamLead",
        lastClarifiedAt: new Date().toISOString(),
      };

      // ----------------------------------------------
      // 4. Update the Task (unblock it)
      // ----------------------------------------------
      await prisma.task.update({
        where: { id: esc.taskId },
        data: {
          status: "NEEDS_REVISION",
          contextPacket: updatedPacket,
          reviewFeedback: {
            ...(esc.task.reviewFeedback as any),
            teamLeadResolution: clarification,
            teamLeadResolutionAt: new Date().toISOString(),
          },
        },
      });

      // ----------------------------------------------
      // 5. Close the escalation
      // ----------------------------------------------
      await prisma.contextRequest.update({
        where: { id: esc.id },
        data: {
          status: "RESOLVED",
          resolvedAt: new Date(),
          resolution: clarification,
        },
      });

      // ----------------------------------------------
      // 6. Log trace
      // ----------------------------------------------
      await prisma.trace.create({
        data: {
          id: traceId,
          agentId: esc.task.assignedToAgentId ?? "system",
          taskId: esc.taskId,
          event: "TEAMLEAD_RESOLUTION",
          metadata: {
            escalationId: esc.id,
            clarification,
            patch,
          },
        },
      });

      console.log(
        `[TeamLead-Resolution] ✔ Resolved escalation ${esc.id} — task ${esc.taskId} unblocked`
      );
    } catch (error) {
      console.error(
        `[TeamLead-Resolution] ❌ Failed to resolve escalation ${esc.id}:`,
        error
      );
    }
  }
}
