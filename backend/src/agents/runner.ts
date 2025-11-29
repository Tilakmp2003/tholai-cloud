import { runMidDevAgentOnce } from "./midDevAgent";
import { runTeamLeadAgentOnce } from "./teamLeadAgent";
import { runDesignerAgentOnce } from "./designerAgent";
import { runQAAgentOnce } from "./qaAgent";
import { runTestGeneratorAgentOnce } from "./testGeneratorAgent";
import { runTeamLeadResolutionOnce } from "./teamLeadResolutionAgent";
import { runGovernanceLoopOnce } from "../governance/governanceLoop";
import { logger } from "../services/logger";

async function loop() {
  try {
    logger.log("[Runner] Cycle started...");

    await Promise.all([
      runMidDevAgentOnce().catch((err) => logger.error("[Runner] MidDev error:", err)),
      runTeamLeadAgentOnce().catch((err) => logger.error("[Runner] TeamLead error:", err)),
      runDesignerAgentOnce().catch((err) => logger.error("[Runner] Designer error:", err)),
      runQAAgentOnce().catch((err) => logger.error("[Runner] QA error:", err)),
      runTestGeneratorAgentOnce().catch((err) => logger.error("[Runner] TestGen error:", err)),
      runTeamLeadResolutionOnce().catch((err) => logger.error("[Runner] TL-Resolution error:", err)),
      runGovernanceLoopOnce().catch((err) => logger.error("[Runner] HeadAgent Governance error:", err))
    ]);

    logger.log("[Runner] Cycle finished.");
  } catch (err) {
    logger.error("[Runner] Critical error in loop:", err);
  }
}

// Run every 20 seconds to avoid 429 Rate Limits
setInterval(loop, 20000);
