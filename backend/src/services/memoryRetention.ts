/**
 * Memory Retention Policy Service
 * 
 * Manages memory lifecycle:
 * - Age-based expiration
 * - Usage-weighted retention
 * - Human curation for high-impact memories
 * - Automatic purging of stale/low-quality memories
 */

import { emitLog } from '../websocket/socketServer';
import { agentMemory, MemoryEntry } from './agentMemory';

// Retention configuration
interface RetentionConfig {
  maxAgeMs: number;           // Max age before expiration (default: 30 days)
  minSuccessRate: number;     // Min success rate to keep (default: 0.3)
  minUseCount: number;        // Min uses to be considered valuable (default: 2)
  highImpactThreshold: number; // Success rate to flag as high-impact (default: 0.8)
  purgeIntervalMs: number;    // How often to run purge (default: 1 hour)
}

const DEFAULT_CONFIG: RetentionConfig = {
  maxAgeMs: 30 * 24 * 60 * 60 * 1000, // 30 days
  minSuccessRate: 0.3,
  minUseCount: 2,
  highImpactThreshold: 0.8,
  purgeIntervalMs: 60 * 60 * 1000 // 1 hour
};

// Curated memories (protected from auto-purge)
const curatedMemories = new Set<string>();

// Flagged for review
const flaggedForReview = new Map<string, { reason: string; flaggedAt: Date }>();

/**
 * Calculate retention score for a memory
 * Higher score = more likely to keep
 */
function calculateRetentionScore(memory: MemoryEntry): number {
  const now = Date.now();
  const ageMs = now - memory.createdAt.getTime();
  const ageDays = ageMs / (24 * 60 * 60 * 1000);
  
  // Base score from success rate (0-40 points)
  const successScore = memory.successRate * 40;
  
  // Usage score (0-30 points, logarithmic)
  const usageScore = Math.min(30, Math.log2(memory.useCount + 1) * 10);
  
  // Recency score (0-20 points, decays over time)
  const recencyScore = Math.max(0, 20 - (ageDays / 30) * 20);
  
  // Type bonus (0-10 points)
  let typeBonus = 0;
  if (memory.type === 'BEST_PRACTICE') typeBonus = 10;
  else if (memory.type === 'SUCCESS_PATTERN') typeBonus = 8;
  else if (memory.type === 'CODE_SNIPPET') typeBonus = 6;
  else if (memory.type === 'FAILURE_LESSON') typeBonus = 4;
  
  return successScore + usageScore + recencyScore + typeBonus;
}

/**
 * Check if a memory should be purged
 */
function shouldPurge(memory: MemoryEntry, config: RetentionConfig): {
  purge: boolean;
  reason?: string;
} {
  // Never purge curated memories
  if (curatedMemories.has(memory.id)) {
    return { purge: false };
  }
  
  const now = Date.now();
  const ageMs = now - memory.createdAt.getTime();
  
  // Check age
  if (ageMs > config.maxAgeMs) {
    // But keep if high usage
    if (memory.useCount >= config.minUseCount * 3) {
      return { purge: false };
    }
    return { purge: true, reason: 'Exceeded max age' };
  }
  
  // Check success rate (only after some usage)
  if (memory.useCount >= config.minUseCount && memory.successRate < config.minSuccessRate) {
    return { purge: true, reason: `Low success rate: ${(memory.successRate * 100).toFixed(0)}%` };
  }
  
  // Check retention score
  const score = calculateRetentionScore(memory);
  if (score < 20 && ageMs > 7 * 24 * 60 * 60 * 1000) { // Low score after 7 days
    return { purge: true, reason: `Low retention score: ${score.toFixed(1)}` };
  }
  
  return { purge: false };
}

/**
 * Run purge cycle
 */
export async function runPurgeCycle(config: RetentionConfig = DEFAULT_CONFIG): Promise<{
  purged: number;
  flagged: number;
  kept: number;
}> {
  emitLog('[MemoryRetention] 🧹 Running purge cycle...');
  
  const stats = agentMemory.getMemoryStats();
  let purged = 0;
  let flagged = 0;
  let kept = 0;
  
  // Get all memories by category and check each
  for (const category of Object.keys(stats.byCategory)) {
    const memories = agentMemory.getMemoriesByCategory(category);
    
    for (const memory of memories) {
      const result = shouldPurge(memory, config);
      
      if (result.purge) {
        // Check if high-impact before purging
        if (memory.successRate >= config.highImpactThreshold) {
          // Flag for human review instead of purging
          flaggedForReview.set(memory.id, {
            reason: `High-impact memory flagged for review: ${result.reason}`,
            flaggedAt: new Date()
          });
          flagged++;
          emitLog(`[MemoryRetention] 🚩 Flagged high-impact memory: ${memory.title}`);
        } else {
          // Actually purge (in real implementation, would delete from store)
          purged++;
          emitLog(`[MemoryRetention] 🗑️ Purged: ${memory.title} (${result.reason})`);
        }
      } else {
        kept++;
      }
    }
  }
  
  emitLog(`[MemoryRetention] ✅ Cycle complete: ${purged} purged, ${flagged} flagged, ${kept} kept`);
  
  return { purged, flagged, kept };
}

/**
 * Mark a memory as curated (protected from auto-purge)
 */
export function curateMemory(memoryId: string): void {
  curatedMemories.add(memoryId);
  flaggedForReview.delete(memoryId); // Remove from review queue
  emitLog(`[MemoryRetention] ⭐ Memory curated: ${memoryId}`);
}

/**
 * Remove curation from a memory
 */
export function uncurateMemory(memoryId: string): void {
  curatedMemories.delete(memoryId);
  emitLog(`[MemoryRetention] ❌ Memory uncurated: ${memoryId}`);
}

/**
 * Get memories flagged for review
 */
export function getFlaggedMemories(): Array<{
  memoryId: string;
  reason: string;
  flaggedAt: Date;
}> {
  return Array.from(flaggedForReview.entries()).map(([id, data]) => ({
    memoryId: id,
    ...data
  }));
}

/**
 * Approve a flagged memory (keep it)
 */
export function approveFlaggedMemory(memoryId: string, curate: boolean = false): void {
  flaggedForReview.delete(memoryId);
  if (curate) {
    curateMemory(memoryId);
  }
  emitLog(`[MemoryRetention] ✅ Approved flagged memory: ${memoryId}`);
}

/**
 * Reject a flagged memory (purge it)
 */
export function rejectFlaggedMemory(memoryId: string): void {
  flaggedForReview.delete(memoryId);
  // In real implementation, would delete from memory store
  emitLog(`[MemoryRetention] 🗑️ Rejected flagged memory: ${memoryId}`);
}

/**
 * Get retention statistics
 */
export function getRetentionStats(): {
  totalCurated: number;
  totalFlagged: number;
  config: RetentionConfig;
} {
  return {
    totalCurated: curatedMemories.size,
    totalFlagged: flaggedForReview.size,
    config: DEFAULT_CONFIG
  };
}

/**
 * Start automatic purge scheduler
 */
export function startPurgeScheduler(config: RetentionConfig = DEFAULT_CONFIG): void {
  setInterval(() => {
    runPurgeCycle(config);
  }, config.purgeIntervalMs);
  
  emitLog(`[MemoryRetention] ⏰ Purge scheduler started (interval: ${config.purgeIntervalMs / 1000}s)`);
}

export const memoryRetention = {
  runPurgeCycle,
  curateMemory,
  uncurateMemory,
  getFlaggedMemories,
  approveFlaggedMemory,
  rejectFlaggedMemory,
  getRetentionStats,
  startPurgeScheduler,
  calculateRetentionScore
};
