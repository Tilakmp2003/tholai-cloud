/**
 * Phase 4: Governance Loop (HeadAgent)
 * 
 * Main orchestrator for agent performance evaluation and governance
 */

import { PrismaClient, Agent, AgentRiskLevel } from "@prisma/client";
import { computeAgentScore, assignRiskLevel } from "./scoringUtils";
import { evaluateGovernanceAction, applyGovernanceDecision } from "./governanceRules";

const prisma = new PrismaClient();

const MIN_TASKS_FOR_EVAL = 3;

/**
 * Main governance loop - evaluates all agents and applies governance actions
 */
export async function runGovernanceLoopOnce() {
  console.log("[HeadAgent] Governance loop started...");

  try {
    // Load all agents with their performance logs
    const agents = await prisma.agent.findMany({
      include: {
        performanceLogs: {
          orderBy: { createdAt: 'desc' },
          take: 20 // Only look at recent performance
        }
      }
    });

    for (const agent of agents) {
      try {
        await evaluateAgent(agent);
      } catch (err) {
        console.error(`[HeadAgent] Error evaluating agent ${agent.id}:`, err);
      }
    }

    console.log("[HeadAgent] Governance loop finished.");
  } catch (error) {
    console.error("[HeadAgent] Critical error in governance loop:", error);
  }
}

/**
 * Evaluate a single agent's performance
 */
async function evaluateAgent(agent: any) {
  const logs = agent.performanceLogs || [];

  // Skip if not enough data
  if (logs.length < MIN_TASKS_FOR_EVAL) {
    console.log(`[HeadAgent] Skipping agent ${agent.id} - insufficient data (${logs.length} tasks)`);
    return;
  }

  // 1. Compute score breakdown
  const scoreBreakdown = computeAgentScore(logs);
  const riskLevel = assignRiskLevel(scoreBreakdown.totalScore);

  // 2. Count successes/failures
  const successCount = logs.filter((l: any) => l.success).length;
  const failCount = logs.length - successCount;
  const tasksHandled = logs.length;

  // 3. Update agent with new metrics
  const updatedAgent = await prisma.agent.update({
    where: { id: agent.id },
    data: {
      score: scoreBreakdown.totalScore,
      riskLevel: riskLevel as AgentRiskLevel,
      successCount,
      failCount
    }
  });

  const successRate = successCount / tasksHandled;

  console.log(
    `[HeadAgent] Evaluated ${agent.role} ${agent.id.substring(0, 8)}... → ` +
    `score=${scoreBreakdown.totalScore.toFixed(1)}, ` +
    `risk=${riskLevel}, ` +
    `success=${(successRate * 100).toFixed(1)}% (${successCount}/${tasksHandled})`
  );

  // 4. Determine governance action
  const decision = evaluateGovernanceAction({
    id: updatedAgent.id,
    role: updatedAgent.role,
    score: scoreBreakdown.totalScore,
    riskLevel: riskLevel,
    successCount,
    failCount,
    tasksHandled,
    // Claim 2: Pass cost data
    costBaseline: updatedAgent.costBaseline,
    sessionCost: updatedAgent.sessionCost,
    currentTaskComplexity: agent.currentTask?.complexityScore ?? 50 // Default to 50
  });

  // 5. Apply the decision
  if (decision.action !== 'NONE') {
    await applyGovernanceDecision(updatedAgent.id, decision);
    
    // Log detailed breakdown for significant actions
    if (decision.action === 'PROMOTE' || decision.action === 'DEMOTE' || decision.action === 'TERMINATE') {
      console.log(`[HeadAgent] Score breakdown for ${agent.id}:`, {
        successRate: `${(scoreBreakdown.successRate * 100).toFixed(1)}%`,
        efficiency: scoreBreakdown.efficiencyScore.toFixed(2),
        quality: scoreBreakdown.qualityScore.toFixed(2),
        consistency: scoreBreakdown.consistencyScore.toFixed(2),
        riskPenalty: scoreBreakdown.riskPenalty.toFixed(2)
      });
    }
  }
}

/**
 * Starts the governance loop interval
 */
export function startGovernanceLoop() {
  // Run immediately
  runGovernanceLoopOnce();

  // Then run every 5 minutes (300000 ms)
  setInterval(() => {
    runGovernanceLoopOnce();
  }, 300000);
}
