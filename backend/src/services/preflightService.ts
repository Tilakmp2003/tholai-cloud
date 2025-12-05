import { prisma } from "../lib/prisma";
import { ModelConfig } from "./llmClient";

export interface PreflightResult {
  allowed: boolean;
  reason?: string;
}

export async function checkBudget(
  taskId: string,
  agentId: string,
  estimatedCost: number
): Promise<PreflightResult> {
  try {
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
    });

    if (!agent) {
      return { allowed: false, reason: "Agent not found" };
    }

    // Check Agent-level Cost Limit per Task
    const modelConfig = agent.modelConfig as any; // Cast JSON
    const limitPerTask = modelConfig?.cost_limit_per_task_usd || 10.0; // Default $10

    if (estimatedCost > limitPerTask) {
      return {
        allowed: false,
        reason: `Estimated cost ($${estimatedCost.toFixed(
          4
        )}) exceeds agent limit per task ($${limitPerTask})`,
      };
    }

    // Check Global/Daily limits (Placeholder for future implementation)
    // const dailyCost = agent.sessionCost;
    // if (dailyCost + estimatedCost > DAILY_LIMIT) ...

    return { allowed: true };
  } catch (error) {
    console.error("[Preflight] Error checking budget:", error);
    // Fail safe: block if error
    return { allowed: false, reason: "Internal error checking budget" };
  }
}
