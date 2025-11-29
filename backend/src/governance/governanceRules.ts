// @ts-nocheck
/**
 * Phase 4: Governance Decision Rules
 * 
 * Implements promotion, demotion, and termination logic
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface GovernanceDecision {
  action: 'PROMOTE' | 'DEMOTE' | 'TERMINATE' | 'WARNING' | 'NONE';
  reason: string;
  newRole?: string;
  previousRole?: string;
}

interface AgentContext {
  id: string;
  role: string;
  score: number;
  riskLevel: string;
  successCount: number;
  failCount: number;
  tasksHandled: number;
  // Claim 2
  costBaseline?: number;
  sessionCost?: number;
}

/**
 * Main governance decision function
 */
export function evaluateGovernanceAction(agent: AgentContext): GovernanceDecision {
  // CLAIM 2: ECONOMIC CIRCUIT BREAKER (Highest Priority)
  const circuitBreaker = shouldTriggerCircuitBreaker(agent);
  if (circuitBreaker.shouldTerminate) {
    return {
      action: 'TERMINATE',
      reason: circuitBreaker.reason,
      previousRole: agent.role
    };
  }

  // TERMINATION (Standard)
  const terminationCheck = shouldTerminate(agent);
  if (terminationCheck.shouldTerminate) {
    return {
      action: 'TERMINATE',
      reason: terminationCheck.reason,
      previousRole: agent.role
    };
  }

  // PROMOTION
  const promotionCheck = shouldPromote(agent);
  if (promotionCheck.shouldPromote) {
    return {
      action: 'PROMOTE',
      reason: promotionCheck.reason,
      previousRole: agent.role,
      newRole: promotionCheck.newRole
    };
  }

  // DEMOTION
  const demotionCheck = shouldDemote(agent);
  if (demotionCheck.shouldDemote) {
    return {
      action: 'DEMOTE',
      reason: demotionCheck.reason,
      previousRole: agent.role,
      newRole: demotionCheck.newRole
    };
  }

  // WARNING
  if (agent.score < 50 && agent.riskLevel === 'MEDIUM') {
    return {
      action: 'WARNING',
      reason: 'Performance declining - approaching demotion threshold'
    };
  }

  return {
    action: 'NONE',
    reason: 'Agent performing within acceptable range'
  };
}

/**
 * Termination Rules (HARD)
 */
function shouldTerminate(agent: AgentContext): { shouldTerminate: boolean; reason: string } {
  // Rule 1: Too many failures
  if (agent.failCount >= 5) {
    return {
      shouldTerminate: true,
      reason: `Exceeded failure limit (${agent.failCount}/5 failures)`
    };
  }

  // Rule 2: Critical score with high risk
  if (agent.score < 20) {
    return {
      shouldTerminate: true,
      reason: `Critical performance score (${agent.score.toFixed(1)}/100)`
    };
  }

  // Rule 3: High risk for extended period
  if (agent.riskLevel === 'HIGH' && agent.score < 30) {
    return {
      shouldTerminate: true,
      reason: `Sustained HIGH risk level with score ${agent.score.toFixed(1)}`
    };
  }

  return { shouldTerminate: false, reason: '' };
}

/**
 * Claim 2: Economic Circuit Breaker Logic (Upgraded)
 */
function shouldTriggerCircuitBreaker(agent: AgentContext): { shouldTerminate: boolean; reason: string } {
  // If no cost data, skip
  if (!agent.costBaseline || !agent.sessionCost) return { shouldTerminate: false, reason: '' };

  // Dynamic Baseline Calculation
  // Standard Task (50) -> 1.0x Multiplier
  // Complex Task (100) -> 2.0x Multiplier
  // Trivial Task (10) -> 0.2x Multiplier
  const complexity = agent.currentTaskComplexity ?? 50;
  const multiplier = Math.max(0.2, complexity / 50);
  const adjustedBaseline = agent.costBaseline * multiplier;

  // Rule: If Session Cost > 3x Adjusted Baseline, KILL IT.
  const deviation = agent.sessionCost / adjustedBaseline;
  
  if (deviation > 3.0) {
    return {
      shouldTerminate: true,
      reason: `Economic Circuit Breaker Triggered: Cost deviation ${(deviation * 100).toFixed(0)}% > 300% (Complexity Adjusted)`
    };
  }

  return { shouldTerminate: false, reason: '' };
}

/**
 * Promotion Rules (AUTOMATIC)
 */
function shouldPromote(agent: AgentContext): { 
  shouldPromote: boolean; 
  reason: string; 
  newRole?: string;
} {
  const successRate = agent.successCount / (agent.successCount + agent.failCount);

  // Not enough experience yet
  if (agent.tasksHandled < 5) {
    return { shouldPromote: false, reason: '' };
  }

  // High performance threshold
  if (agent.score > 80 && successRate > 0.8) {
    const newRole = getNextRole(agent.role);
    
    if (newRole) {
      return {
        shouldPromote: true,
        reason: `Excellent performance (score: ${agent.score.toFixed(1)}, success rate: ${(successRate * 100).toFixed(1)}%)`,
        newRole
      };
    }
  }

  return { shouldPromote: false, reason: '' };
}

/**
 * Demotion Rules (AUTOMATIC)
 */
function shouldDemote(agent: AgentContext): { 
  shouldDemote: boolean; 
  reason: string; 
  newRole?: string;
} {
  // Rule 1: Low score with failures
  if (agent.score < 40 && agent.failCount > 3) {
    const newRole = getPreviousRole(agent.role);
    
    if (newRole) {
      return {
        shouldDemote: true,
        reason: `Poor performance (score: ${agent.score.toFixed(1)}, ${agent.failCount} failures)`,
        newRole
      };
    }
  }

  // Rule 2: High risk level sustained
  if (agent.riskLevel === 'HIGH' && agent.score < 50) {
    const newRole = getPreviousRole(agent.role);
    
    if (newRole) {
      return {
        shouldDemote: true,
        reason: `HIGH risk level with declining performance`,
        newRole
      };
    }
  }

  return { shouldDemote: false, reason: '' };
}

/**
 * Role progression mapping
 */
function getNextRole(currentRole: string): string | null {
  const roleHierarchy: { [key: string]: string } = {
    'JuniorDev': 'MidDev',
    'MidDev': 'SeniorDev',
    'SeniorDev': null, // Already at top
    'TeamLead': null,  // Different track
    'QA': 'SeniorQA'
  };

  return roleHierarchy[currentRole] || null;
}

/**
 * Role demotion mapping
 */
function getPreviousRole(currentRole: string): string | null {
  const demotionMap: { [key: string]: string } = {
    'SeniorDev': 'MidDev',
    'MidDev': 'JuniorDev',
    'JuniorDev': null, // Can't demote further, only terminate
    'SeniorQA': 'QA',
    'QA': null
  };

  return demotionMap[currentRole] || null;
}

/**
 * Apply governance decision to database
 */
export async function applyGovernanceDecision(
  agentId: string, 
  decision: GovernanceDecision,
  taskId?: string
): Promise<void> {
  if (decision.action === 'NONE') return;

  // Log the governance event
  await prisma.governanceEvent.create({
    data: {
      agentId,
      taskId: taskId || null,
      action: decision.action,
      reason: decision.reason,
      previousRole: decision.previousRole || null,
      newRole: decision.newRole || null
    }
  });

  // Apply role changes
  if (decision.newRole) {
    await prisma.agent.update({
      where: { id: agentId },
      data: {
        role: decision.newRole
      }
    });

    console.log(`[Governance] ${decision.action}: Agent ${agentId} ${decision.previousRole} → ${decision.newRole}`);
  }

  // Handle termination
  if (decision.action === 'TERMINATE') {
    await prisma.agent.update({
      where: { id: agentId },
      data: {
        status: 'OFFLINE'
      }
    });

    // Reassign active tasks
    await prisma.task.updateMany({
      where: {
        assignedToAgentId: agentId,
        status: { in: ['ASSIGNED', 'IN_PROGRESS'] }
      },
      data: {
        status: 'QUEUED',
        assignedToAgentId: null
      }
    });

    console.log(`[Governance] TERMINATED: Agent ${agentId} - ${decision.reason}`);
  }

  // Handle warnings
  if (decision.action === 'WARNING') {
    console.warn(`[Governance] WARNING: Agent ${agentId} - ${decision.reason}`);
  }
}
