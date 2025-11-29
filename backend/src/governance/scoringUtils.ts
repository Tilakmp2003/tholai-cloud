/**
 * Phase 4: Agent Scoring Utilities
 * 
 * Implements hybrid governance model:
 * - Hard Rules: Cost thresholds, failure limits
 * - Soft Rules: Quality, efficiency, consistency
 */

interface PerformanceLog {
  success: boolean;
  costUsd?: number | null;
  durationMs?: number | null;
  revisionCount?: number | null;
  failureReason?: string | null;
}

interface ScoreBreakdown {
  successRate: number;
  efficiencyScore: number;
  qualityScore: number;
  consistencyScore: number;
  riskPenalty: number;
  totalScore: number;
}

/**
 * Main scoring function - Weighted hybrid model
 */
export function computeAgentScore(logs: PerformanceLog[]): ScoreBreakdown {
  if (logs.length === 0) {
    return {
      successRate: 0,
      efficiencyScore: 0,
      qualityScore: 0,
      consistencyScore: 0,
      riskPenalty: 0,
      totalScore: 50 // Default neutral score
    };
  }

  // 1. Success Rate (30 points)
  const successCount = logs.filter(l => l.success).length;
  const failCount = logs.length - successCount;
  const successRate = successCount / logs.length;

  // 2. Efficiency Score (25 points)
  const costs = logs.map(l => l.costUsd || 0);
  const durations = logs.map(l => l.durationMs || 0);
  
  const avgCost = average(costs);
  const avgDuration = average(durations);
  
  // Lower cost and duration = better efficiency
  const normalizedCost = normalize(avgCost, 0, 5); // $0-$5 range
  const normalizedDuration = normalize(avgDuration, 0, 60000); // 0-60s range
  
  const efficiencyScore = 
    (1 - normalizedCost) * 0.5 + 
    (1 - normalizedDuration) * 0.5;

  // 3. Quality Score (25 points)
  const revisions = logs.map(l => l.revisionCount || 0);
  const avgRevisions = average(revisions);
  const normalizedRevisions = normalize(avgRevisions, 0, 3); // 0-3 revisions
  const qualityScore = 1 - normalizedRevisions;

  // 4. Consistency Score (15 points)
  const consistencyScore = 1 - (standardDeviation(costs) / (average(costs) || 1));

  // 5. Risk Penalty (up to -50 points)
  const riskPenalty = computeRiskPenalty({
    avgCost,
    failCount,
    successCount,
    consecutiveFailures: countConsecutiveFailures(logs),
    maxRevisions: Math.max(...revisions)
  });

  // Final weighted score
  const totalScore = clamp(
    successRate * 30 +
    efficiencyScore * 25 +
    qualityScore * 25 +
    consistencyScore * 15 -
    riskPenalty * 50,
    0,
    100
  );

  return {
    successRate,
    efficiencyScore,
    qualityScore,
    consistencyScore,
    riskPenalty,
    totalScore
  };
}

/**
 * Risk penalty based on hard rules
 */
function computeRiskPenalty(metrics: {
  avgCost: number;
  failCount: number;
  successCount: number;
  consecutiveFailures: number;
  maxRevisions: number;
}): number {
  let penalty = 0;

  // HARD RULE: High cost
  if (metrics.avgCost > 3) {
    penalty += 0.4;
  }

  // HARD RULE: 3+ consecutive failures
  if (metrics.consecutiveFailures >= 3) {
    penalty += 0.3;
  }

  // HARD RULE: Exceeded max revisions
  if (metrics.maxRevisions > 3) {
    penalty += 0.2;
  }

  // HARD RULE: Low success rate
  const successRate = metrics.successCount / (metrics.successCount + metrics.failCount);
  if (successRate < 0.4) {
    penalty += 0.1;
  }

  return clamp(penalty, 0, 1);
}

/**
 * Assign risk level based on score
 */
export function assignRiskLevel(score: number): 'LOW' | 'MEDIUM' | 'HIGH' {
  if (score > 70) return 'LOW';
  if (score > 40) return 'MEDIUM';
  return 'HIGH';
}

/**
 * Count consecutive failures from the end of logs
 */
function countConsecutiveFailures(logs: PerformanceLog[]): number {
  let count = 0;
  for (let i = logs.length - 1; i >= 0; i--) {
    if (logs[i].success) break;
    count++;
  }
  return count;
}

/**
 * Helper: Calculate average
 */
function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * Helper: Calculate standard deviation
 */
function standardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  const avg = average(values);
  const squareDiffs = values.map(val => Math.pow(val - avg, 2));
  return Math.sqrt(average(squareDiffs));
}

/**
 * Helper: Normalize value between 0 and 1
 */
function normalize(value: number, min: number, max: number): number {
  if (max === min) return 0;
  return clamp((value - min) / (max - min), 0, 1);
}

/**
 * Helper: Clamp value between min and max
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
