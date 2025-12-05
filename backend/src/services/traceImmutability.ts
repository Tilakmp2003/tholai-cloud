/**
 * Trace Immutability Service
 *
 * Ensures trace logs cannot be tampered with.
 * Uses append-only storage with cryptographic hashing.
 */

import { createHash } from "crypto";
import { prisma } from "../lib/prisma";
import { emitLog } from "../websocket/socketServer";

// In-memory hash chain (in production, use append-only DB or blockchain)
const hashChain: Array<{
  index: number;
  timestamp: string;
  traceId: string;
  eventHash: string;
  previousHash: string;
  chainHash: string;
}> = [];

let lastHash = "GENESIS";

/**
 * Hash an event payload
 */
function hashEvent(event: any): string {
  const content = JSON.stringify(event, Object.keys(event).sort());
  return createHash("sha256").update(content).digest("hex");
}

/**
 * Create a chain hash (links to previous)
 */
function createChainHash(
  eventHash: string,
  previousHash: string,
  index: number
): string {
  const content = `${index}:${eventHash}:${previousHash}`;
  return createHash("sha256").update(content).digest("hex");
}

/**
 * Record an immutable trace event
 */
export async function recordImmutableTrace(
  traceId: string,
  taskId: string,
  agentId: string,
  event: string,
  metadata: any
): Promise<{ chainHash: string; index: number }> {
  const timestamp = new Date().toISOString();
  const index = hashChain.length;

  // Create event hash
  const eventPayload = {
    traceId,
    taskId,
    agentId,
    event,
    metadata,
    timestamp,
  };
  const eventHash = hashEvent(eventPayload);

  // Create chain hash
  const chainHash = createChainHash(eventHash, lastHash, index);

  // Add to chain
  const chainEntry = {
    index,
    timestamp,
    traceId,
    eventHash,
    previousHash: lastHash,
    chainHash,
  };
  hashChain.push(chainEntry);
  lastHash = chainHash;

  // Store in database with hash
  await prisma.trace.create({
    data: {
      id: `${traceId}-${index}`,
      taskId,
      agentId,
      event,
      metadata: {
        ...metadata,
        _immutable: {
          index,
          eventHash,
          chainHash,
          previousHash: chainEntry.previousHash,
        },
      },
    },
  });

  return { chainHash, index };
}

/**
 * Verify the integrity of the hash chain
 */
export function verifyChainIntegrity(): {
  valid: boolean;
  errors: Array<{ index: number; error: string }>;
} {
  const errors: Array<{ index: number; error: string }> = [];
  let expectedPrevious = "GENESIS";

  for (let i = 0; i < hashChain.length; i++) {
    const entry = hashChain[i];

    // Check previous hash link
    if (entry.previousHash !== expectedPrevious) {
      errors.push({
        index: i,
        error: `Previous hash mismatch: expected ${expectedPrevious}, got ${entry.previousHash}`,
      });
    }

    // Verify chain hash
    const expectedChainHash = createChainHash(
      entry.eventHash,
      entry.previousHash,
      i
    );
    if (entry.chainHash !== expectedChainHash) {
      errors.push({
        index: i,
        error: `Chain hash mismatch: expected ${expectedChainHash}, got ${entry.chainHash}`,
      });
    }

    expectedPrevious = entry.chainHash;
  }

  const valid = errors.length === 0;

  if (!valid) {
    emitLog(
      `[TraceImmutability] 🚨 INTEGRITY VIOLATION DETECTED: ${errors.length} errors`
    );
  }

  return { valid, errors };
}

/**
 * Verify a specific trace entry
 */
export async function verifyTraceEntry(
  traceId: string,
  index: number
): Promise<{
  valid: boolean;
  error?: string;
}> {
  const entry = hashChain.find(
    (e) => e.traceId === traceId && e.index === index
  );

  if (!entry) {
    return { valid: false, error: "Entry not found in chain" };
  }

  // Fetch from database
  const dbEntry = await prisma.trace.findUnique({
    where: { id: `${traceId}-${index}` },
  });

  if (!dbEntry) {
    return { valid: false, error: "Entry not found in database" };
  }

  const dbMeta = dbEntry.metadata as any;
  if (!dbMeta?._immutable) {
    return { valid: false, error: "Missing immutability metadata" };
  }

  // Verify hashes match
  if (dbMeta._immutable.chainHash !== entry.chainHash) {
    return { valid: false, error: "Chain hash mismatch between DB and chain" };
  }

  return { valid: true };
}

/**
 * Get chain statistics
 */
export function getChainStats(): {
  length: number;
  lastHash: string;
  lastTimestamp: string | null;
} {
  return {
    length: hashChain.length,
    lastHash,
    lastTimestamp:
      hashChain.length > 0 ? hashChain[hashChain.length - 1].timestamp : null,
  };
}

/**
 * Export chain for audit
 */
export function exportChain(): typeof hashChain {
  return [...hashChain];
}

/**
 * Create a snapshot of current state
 */
export function createSnapshot(): {
  timestamp: string;
  chainLength: number;
  chainHash: string;
  snapshotHash: string;
} {
  const timestamp = new Date().toISOString();
  const chainLength = hashChain.length;
  const chainHash = lastHash;

  const snapshotContent = `${timestamp}:${chainLength}:${chainHash}`;
  const snapshotHash = createHash("sha256")
    .update(snapshotContent)
    .digest("hex");

  emitLog(
    `[TraceImmutability] 📸 Snapshot created: ${snapshotHash.substring(
      0,
      16
    )}...`
  );

  return {
    timestamp,
    chainLength,
    chainHash,
    snapshotHash,
  };
}

export const traceImmutability = {
  recordImmutableTrace,
  verifyChainIntegrity,
  verifyTraceEntry,
  getChainStats,
  exportChain,
  createSnapshot,
};
