/**
 * Human Approval Gates Service
 *
 * Pauses agent work at critical points for human review.
 * Supports approval, rejection, and modification of agent outputs.
 */

import { prisma } from "../lib/prisma";
import { emitLog } from "../websocket/socketServer";
import { getIO } from "../websocket/socketServer";

export type GateType =
  | "PRE_COMMIT" // Before committing code to git
  | "ARCHITECTURE" // Major architectural decisions
  | "SECURITY" // Security-sensitive changes
  | "DEPLOYMENT" // Before deployment
  | "COST_THRESHOLD" // When cost exceeds threshold
  | "TASK_COMPLETE" // After task completion (optional)
  | "WAR_ROOM_EXIT"; // Before applying war room resolution

export type GateStatus = "PENDING" | "APPROVED" | "REJECTED" | "MODIFIED";

export interface ApprovalGate {
  id: string;
  projectId: string;
  taskId?: string | undefined;
  gateType: GateType;
  status: GateStatus;
  title: string;
  description: string;
  payload: any; // The content awaiting approval (code, config, etc.)
  modifiedPayload?: any; // Human-modified version
  reviewerNotes?: string | undefined;
  createdAt: Date;
  resolvedAt?: Date;
  resolvedBy?: string;
}

// In-memory store (in production, use Redis or DB)
const pendingGates = new Map<string, ApprovalGate>();

// Gate configuration per project
const projectGateConfig = new Map<string, Set<GateType>>();

/**
 * Configure which gates are enabled for a project
 */
export function configureGates(projectId: string, enabledGates: GateType[]) {
  projectGateConfig.set(projectId, new Set(enabledGates));
  emitLog(
    `[ApprovalGates] Configured gates for project ${projectId}: ${enabledGates.join(
      ", "
    )}`
  );
}

/**
 * Get default gates (can be overridden per project)
 */
export function getDefaultGates(): GateType[] {
  return ["PRE_COMMIT", "ARCHITECTURE", "SECURITY", "WAR_ROOM_EXIT"];
}

/**
 * Check if a gate type is enabled for a project
 */
export function isGateEnabled(projectId: string, gateType: GateType): boolean {
  const config = projectGateConfig.get(projectId);
  if (!config) {
    // Default: enable critical gates
    return ["PRE_COMMIT", "SECURITY", "WAR_ROOM_EXIT", "ARCHITECTURE"].includes(
      gateType
    );
  }
  return config.has(gateType);
}

/**
 * Create an approval gate and wait for human decision
 */
export async function createGate(
  projectId: string,
  gateType: GateType,
  title: string,
  description: string,
  payload: any,
  taskId?: string
): Promise<ApprovalGate> {
  // Check if gate is enabled
  if (!isGateEnabled(projectId, gateType)) {
    // Auto-approve if gate is disabled
    return {
      id: `auto-${Date.now()}`,
      projectId,
      taskId,
      gateType,
      status: "APPROVED",
      title,
      description,
      payload,
      createdAt: new Date(),
      resolvedAt: new Date(),
    };
  }

  const gate: ApprovalGate = {
    id: `gate-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    projectId,
    taskId,
    gateType,
    status: "PENDING",
    title,
    description,
    payload,
    createdAt: new Date(),
  };

  pendingGates.set(gate.id, gate);

  // Emit to frontend
  try {
    const io = getIO();
    io.emit("approval:pending", gate);
  } catch (e) {
    // Socket not initialized (e.g. in tests), ignore
  }

  emitLog(`[ApprovalGates] 🚦 Gate created: ${gateType} - ${title}`);

  return gate;
}

/**
 * Wait for gate resolution (with timeout)
 */
export async function waitForApproval(
  gateId: string,
  timeoutMs: number = 3600000 // 1 hour default
): Promise<ApprovalGate> {
  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    const checkInterval = setInterval(() => {
      const gate = pendingGates.get(gateId);

      if (!gate) {
        clearInterval(checkInterval);
        reject(new Error(`Gate ${gateId} not found`));
        return;
      }

      if (gate.status !== "PENDING") {
        clearInterval(checkInterval);
        resolve(gate);
        return;
      }

      if (Date.now() - startTime > timeoutMs) {
        clearInterval(checkInterval);
        reject(new Error(`Gate ${gateId} timed out after ${timeoutMs}ms`));
        return;
      }
    }, 1000); // Check every second
  });
}

/**
 * Approve a gate
 */
export async function approveGate(
  gateId: string,
  reviewerId: string,
  notes?: string
): Promise<ApprovalGate> {
  const gate = pendingGates.get(gateId);
  if (!gate) {
    throw new Error(`Gate ${gateId} not found`);
  }

  gate.status = "APPROVED";
  gate.resolvedAt = new Date();
  gate.resolvedBy = reviewerId;
  gate.reviewerNotes = notes;

  pendingGates.set(gateId, gate);

  // Emit to frontend
  try {
    const io = getIO();
    io.emit("approval:resolved", gate);
  } catch (e) {
    // Socket not initialized (e.g. in tests), ignore
  }

  emitLog(`[ApprovalGates] ✅ Gate approved: ${gate.title}`);

  return gate;
}

/**
 * Reject a gate
 */
export async function rejectGate(
  gateId: string,
  reviewerId: string,
  reason: string
): Promise<ApprovalGate> {
  const gate = pendingGates.get(gateId);
  if (!gate) {
    throw new Error(`Gate ${gateId} not found`);
  }

  gate.status = "REJECTED";
  gate.resolvedAt = new Date();
  gate.resolvedBy = reviewerId;
  gate.reviewerNotes = reason;

  pendingGates.set(gateId, gate);

  // Emit to frontend
  try {
    const io = getIO();
    io.emit("approval:resolved", gate);
  } catch (e) {
    // Socket not initialized (e.g. in tests), ignore
  }

  emitLog(`[ApprovalGates] ❌ Gate rejected: ${gate.title} - ${reason}`);

  return gate;
}

/**
 * Modify and approve a gate (human edits the payload)
 */
export async function modifyAndApprove(
  gateId: string,
  reviewerId: string,
  modifiedPayload: any,
  notes?: string
): Promise<ApprovalGate> {
  const gate = pendingGates.get(gateId);
  if (!gate) {
    throw new Error(`Gate ${gateId} not found`);
  }

  gate.status = "MODIFIED";
  gate.modifiedPayload = modifiedPayload;
  gate.resolvedAt = new Date();
  gate.resolvedBy = reviewerId;
  gate.reviewerNotes = notes;

  pendingGates.set(gateId, gate);

  // Emit to frontend
  try {
    const io = getIO();
    io.emit("approval:resolved", gate);
  } catch (e) {
    // Socket not initialized (e.g. in tests), ignore
  }

  emitLog(`[ApprovalGates] ✏️ Gate modified & approved: ${gate.title}`);

  return gate;
}

/**
 * Get all pending gates for a project
 */
export function getPendingGates(projectId?: string): ApprovalGate[] {
  const gates = Array.from(pendingGates.values());
  if (projectId) {
    return gates.filter(
      (g) => g.projectId === projectId && g.status === "PENDING"
    );
  }
  return gates.filter((g) => g.status === "PENDING");
}

/**
 * Get gate by ID
 */
export function getGate(gateId: string): ApprovalGate | undefined {
  return pendingGates.get(gateId);
}

/**
 * Helper: Create a pre-commit gate
 */
export async function createPreCommitGate(
  projectId: string,
  taskId: string,
  files: Array<{ path: string; content: string; diff?: string }>
): Promise<ApprovalGate> {
  return createGate(
    projectId,
    "PRE_COMMIT",
    `Code Review: ${files.length} file(s)`,
    `Review code changes before committing to repository`,
    { files },
    taskId
  );
}

/**
 * Helper: Create an architecture gate
 */
export async function createArchitectureGate(
  projectId: string,
  decision: string,
  options: string[],
  recommendation: string
): Promise<ApprovalGate> {
  return createGate(
    projectId,
    "ARCHITECTURE",
    `Architecture Decision: ${decision}`,
    `Review architectural decision before proceeding`,
    { decision, options, recommendation }
  );
}

/**
 * Helper: Create a cost threshold gate
 */
export async function createCostGate(
  projectId: string,
  currentCost: number,
  threshold: number,
  projectedCost: number
): Promise<ApprovalGate> {
  return createGate(
    projectId,
    "COST_THRESHOLD",
    `Cost Alert: $${currentCost.toFixed(2)} / $${threshold.toFixed(2)}`,
    `Project cost has exceeded threshold. Approve to continue.`,
    { currentCost, threshold, projectedCost }
  );
}

export const approvalGates = {
  configureGates,
  getDefaultGates,
  isGateEnabled,
  createGate,
  waitForApproval,
  approveGate,
  rejectGate,
  modifyAndApprove,
  getPendingGates,
  getGate,
  createPreCommitGate,
  createArchitectureGate,
  createCostGate,
};
