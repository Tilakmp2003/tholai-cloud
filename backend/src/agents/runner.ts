import { runMidDevAgentOnce } from "./midDevAgent";
import { runTeamLeadAgentOnce } from "./teamLeadAgent";
import { runDesignerAgentOnce } from "./designerAgent";
import { runQAAgentOnce } from "./qaAgent";
import { runTestGeneratorAgentOnce } from "./testGeneratorAgent";
import { runTeamLeadResolutionOnce } from "./teamLeadResolutionAgent";
import { runGovernanceLoopOnce } from "../governance/governanceLoop";
import { logger } from "../services/logger";
import { invokeAgentLambda } from "../services/lambdaInvoker";
import { PrismaClient } from "@prisma/client";
import { runArchitectAgentOnce } from "./architectAgent";
import { runSeniorDevAgentOnce } from "./seniorDevAgent";
import { runAgentOpsAgentOnce } from "./agentOpsAgent";
import { runCanaryAgentOnce } from "./canaryAgent";
import { dispatchTasks } from "../services/taskDispatcher";

const prisma = new PrismaClient();

async function dispatchToLambda() {
  // Find tasks that need processing and dispatch them to Lambda
  const tasks = await prisma.task.findMany({
    where: { status: 'ASSIGNED' },
    take: 10
  });

  for (const task of tasks) {
    if (task.assignedToAgentId) {
      await invokeAgentLambda({
        agentId: task.assignedToAgentId,
        taskId: task.id,
        contextPacket: task.contextPacket,
        role: task.requiredRole
      });
    }
  }
}

async function loop() {
  try {
    logger.log("[Runner] Cycle started...");

    if (process.env.USE_LAMBDA_AGENTS === 'true') {
      logger.log("[Runner] ☁️ Running in Cloud Mode (Lambda Dispatch)");
      await dispatchToLambda();
      await runGovernanceLoopOnce();
    } else {
      logger.log("[Runner] 💻 Running in Local Mode (In-Process)");
      
      // Dispatch queued tasks to agents
      await dispatchTasks().catch((err) => logger.error("[Runner] Dispatcher error:", err));

      await Promise.all([
        runArchitectAgentOnce().catch((err) => logger.error("[Runner] Architect error:", err)),
        runSeniorDevAgentOnce().catch((err) => logger.error("[Runner] SeniorDev error:", err)),
        runMidDevAgentOnce().catch((err) => logger.error("[Runner] MidDev error:", err)),
        runTeamLeadAgentOnce().catch((err) => logger.error("[Runner] TeamLead error:", err)),
        runDesignerAgentOnce().catch((err) => logger.error("[Runner] Designer error:", err)),
        runQAAgentOnce().catch((err) => logger.error("[Runner] QA error:", err)),
        runAgentOpsAgentOnce().catch((err) => logger.error("[Runner] AgentOps error:", err)),
        runCanaryAgentOnce().catch((err) => logger.error("[Runner] Canary error:", err)),
        runTestGeneratorAgentOnce().catch((err) => logger.error("[Runner] TestGen error:", err)),
        runTeamLeadResolutionOnce().catch((err) => logger.error("[Runner] TL-Resolution error:", err)),
        runGovernanceLoopOnce().catch((err) => logger.error("[Runner] HeadAgent Governance error:", err))
      ]);
    }

    logger.log("[Runner] Cycle finished.");
  } catch (err) {
    logger.error("[Runner] Critical error in loop:", err);
  }
}

// Run every 20 seconds to avoid 429 Rate Limits
setInterval(loop, 20000);
