/**
 * Evolutionary Reward Helper
 * 
 * Centralized utility for calculating and applying E-value rewards across all agents.
 * Replaces the old score-based system with survival-based E-value rewards.
 */

import { prisma } from '../../lib/prisma';
import { emitAgentUpdate, emitLog } from '../../websocket/socketServer';
import { ExistenceService } from './ExistenceService';

const existenceService = new ExistenceService();

export interface TaskPerformanceMetrics {
    taskId: string;
    agentId: string;
    success: boolean;
    // Time efficiency (0-1): 1 = faster than expected, 0 = very slow
    timeEfficiency?: number;
    // Quality score (0-1): from QA or review feedback
    qualityScore?: number;
    // Complexity (0-1): task complexity level
    complexity?: number;
    // Token/cost efficiency (0-1): used fewer tokens than expected
    costEfficiency?: number;
    // Execution time in seconds
    executionTimeSeconds?: number;
    // Expected time in seconds
    expectedTimeSeconds?: number;
}

export interface ERewardResult {
    agentId: string;
    previousE: number;
    newE: number;
    delta: number;
    breakdown: {
        base: number;
        timeBonus: number;
        qualityBonus: number;
        costBonus: number;
    };
    shouldTerminate: boolean;
}

/**
 * Calculate and apply E-value reward for task completion
 */
export async function applyEvolutionaryReward(metrics: TaskPerformanceMetrics): Promise<ERewardResult> {
    // Fetch current agent
    const agent = await prisma.agent.findUnique({ where: { id: metrics.agentId } });
    if (!agent) {
        throw new Error(`Agent ${metrics.agentId} not found`);
    }

    const currentE = (agent as any).existencePotential ?? 100;
    let breakdown = { base: 0, timeBonus: 0, qualityBonus: 0, costBonus: 0 };

    // Base reward calculation
    if (metrics.success) {
        // Base reward from ExistenceService
        breakdown.base = existenceService.calculateTaskReward(
            true,
            metrics.complexity ?? 0.5,
            metrics.qualityScore ?? 0.7,
            metrics.timeEfficiency ?? 0.5
        );

        // BONUS: Time efficiency (completed faster = more E)
        if (metrics.executionTimeSeconds && metrics.expectedTimeSeconds) {
            const timeRatio = metrics.executionTimeSeconds / metrics.expectedTimeSeconds;
            if (timeRatio < 0.5) {
                breakdown.timeBonus = 8; // 2x faster = +8 E
            } else if (timeRatio < 0.75) {
                breakdown.timeBonus = 4; // 1.5x faster = +4 E
            } else if (timeRatio < 1.0) {
                breakdown.timeBonus = 2; // On time = +2 E
            }
            // Over time = no bonus
        }

        // BONUS: Cost efficiency (fewer tokens/API calls)
        if (metrics.costEfficiency && metrics.costEfficiency > 0.7) {
            breakdown.costBonus = Math.floor((metrics.costEfficiency - 0.5) * 10);
        }

        // BONUS: Quality score
        if (metrics.qualityScore && metrics.qualityScore > 0.8) {
            breakdown.qualityBonus = Math.floor((metrics.qualityScore - 0.5) * 8);
        }
    } else {
        // Failure penalty
        breakdown.base = -5; // Base failure penalty
        
        // Extra penalty for taking long and failing
        if (metrics.executionTimeSeconds && metrics.expectedTimeSeconds) {
            const timeRatio = metrics.executionTimeSeconds / metrics.expectedTimeSeconds;
            if (timeRatio > 2) {
                breakdown.timeBonus = -3; // Took too long AND failed = extra penalty
            }
        }
    }

    const delta = breakdown.base + breakdown.timeBonus + breakdown.qualityBonus + breakdown.costBonus;
    const newE = Math.max(0, Math.min(1000, currentE + delta)); // Cap between 0-1000

    // Update agent in database
    await prisma.agent.update({
        where: { id: metrics.agentId },
        data: { 
            existencePotential: newE,
            // Also update legacy score for backwards compatibility
            score: { increment: Math.floor(delta / 2) },
            ...(metrics.success 
                ? { successCount: { increment: 1 } }
                : { failCount: { increment: 1 } }
            ),
            lastActiveAt: new Date(),
        } as any,
    });

    // Emit update for real-time UI
    const updatedAgent = await prisma.agent.findUnique({ where: { id: metrics.agentId } });
    if (updatedAgent) {
        emitAgentUpdate(updatedAgent);
    }

    // Log the E-value change
    const emoji = delta > 0 ? '📈' : delta < 0 ? '📉' : '➖';
    emitLog(`[Evolution] ${emoji} Agent ${metrics.agentId.slice(0, 12)}... E: ${currentE.toFixed(1)} → ${newE.toFixed(1)} (${delta > 0 ? '+' : ''}${delta.toFixed(1)})`);

    // Check for termination
    const shouldTerminate = existenceService.shouldTerminate(newE);
    if (shouldTerminate) {
        emitLog(`[Evolution] 💀 Agent ${metrics.agentId} marked for termination (E=${newE.toFixed(1)})`);
    }

    return {
        agentId: metrics.agentId,
        previousE: currentE,
        newE,
        delta,
        breakdown,
        shouldTerminate,
    };
}

/**
 * Quick E-value update for simple reward/penalty
 */
export async function quickEUpdate(agentId: string, delta: number, reason: string): Promise<number> {
    const agent = await prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) return 0;

    const currentE = (agent as any).existencePotential ?? 100;
    const newE = Math.max(0, Math.min(1000, currentE + delta));

    await prisma.agent.update({
        where: { id: agentId },
        data: { 
            existencePotential: newE,
            score: { increment: Math.floor(delta / 2) },
            lastActiveAt: new Date(),
        } as any,
    });

    const emoji = delta > 0 ? '📈' : '📉';
    emitLog(`[Evolution] ${emoji} ${agentId.slice(0, 15)}... E: ${currentE.toFixed(1)} → ${newE.toFixed(1)} (${reason})`);

    const updated = await prisma.agent.findUnique({ where: { id: agentId } });
    if (updated) emitAgentUpdate(updated);

    return newE;
}

/**
 * Role-based default rewards
 */
export const ROLE_REWARDS = {
    MidDev: { success: 10, failure: -5, review: 2 },
    SeniorDev: { success: 15, failure: -8, review: 3 },
    QA: { success: 8, failure: -3, review: 5 },
    TeamLead: { success: 12, failure: -5, review: 4 },
    Architect: { success: 20, failure: -10, review: 5 },
    Designer: { success: 12, failure: -5, review: 3 },
} as const;

/**
 * Get role-specific reward amount
 */
export function getRoleReward(role: string, type: 'success' | 'failure' | 'review'): number {
    const roleKey = role as keyof typeof ROLE_REWARDS;
    return ROLE_REWARDS[roleKey]?.[type] ?? ROLE_REWARDS.MidDev[type];
}
