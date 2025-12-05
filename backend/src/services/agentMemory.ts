/**
 * Agent Memory Service
 *
 * Provides persistent memory and learning capabilities for agents.
 * Stores successful patterns, learns from failures, and enables cross-project knowledge transfer.
 */

import { prisma } from "../lib/prisma";
import { createHash } from "crypto";
import { invokeModel, ModelConfig } from "./llmClient";
import { emitLog } from "../websocket/socketServer";

export async function extractMemory(
  taskId: string,
  agentId: string,
  output: any
): Promise<void> {
  const agentRecord = await prisma.agent.findFirst({ where: { id: agentId } });
  if (!agentRecord || !agentRecord.modelConfig) {
    console.warn(
      `[AgentMemory] Agent ${agentId} not configured. Skipping memory extraction.`
    );
    return;
  }
  const modelConfig = (agentRecord.modelConfig as any).primary as ModelConfig;
  // TODO: Implement memory extraction logic
  console.log(
    `[AgentMemory] Memory extraction called for task ${taskId} by agent ${agentId}`
  );
}

export interface MemoryEntry {
  id: string;
  agentId?: string;
  agentRole: string;
  type:
    | "SUCCESS_PATTERN"
    | "FAILURE_LESSON"
    | "DOMAIN_KNOWLEDGE"
    | "CODE_SNIPPET"
    | "BEST_PRACTICE";
  category: string; // e.g., "auth", "api", "database", "frontend"
  title: string;
  content: string;
  context: any; // Original task context
  embedding?: number[]; // Vector embedding for similarity search
  useCount: number; // How many times this memory was retrieved
  successRate: number; // When applied, how often it led to success
  createdAt: Date;
  updatedAt: Date;
}

// In-memory store (in production, use vector DB like Pinecone)
const memoryStore = new Map<string, MemoryEntry>();

// Agent-specific memory index
const agentMemoryIndex = new Map<string, Set<string>>();

// Category index for fast lookup
const categoryIndex = new Map<string, Set<string>>();

/**
 * Generate a simple embedding (in production, use OpenAI/Cohere embeddings)
 */
async function generateEmbedding(text: string): Promise<number[]> {
  // Simple hash-based pseudo-embedding for demo
  // In production, call OpenAI embeddings API
  const hash = createHash("sha256").update(text).digest();
  const embedding: number[] = [];
  for (let i = 0; i < 64; i++) {
    embedding.push((hash[i % hash.length] - 128) / 128);
  }
  return embedding;
}

/**
 * Calculate cosine similarity between two embeddings
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Extract learnings from a completed task
 */
async function extractLearnings(
  task: any,
  success: boolean
): Promise<
  Array<{
    type: MemoryEntry["type"];
    title: string;
    content: string;
    category: string;
  }>
> {
  const prompt = `Analyze this ${
    success ? "successful" : "failed"
  } task and extract reusable learnings.

TASK:
Title: ${task.title}
Context: ${JSON.stringify(task.contextPacket, null, 2)}
Result: ${JSON.stringify(task.result, null, 2)}
${!success ? `Error: ${task.errorMessage}` : ""}

Extract learnings as JSON array:
[
  {
    "type": "${success ? "SUCCESS_PATTERN" : "FAILURE_LESSON"}",
    "title": "Short descriptive title",
    "content": "Detailed explanation of what worked/failed and why",
    "category": "auth|api|database|frontend|testing|security|performance"
  }
]

Rules:
- Extract 1-3 most important learnings
- Be specific and actionable
- Include code patterns if relevant
- For failures, explain what to avoid`;

  try {
    const agentRecord = await prisma.agent.findFirst({
      where: { role: "MidDev" },
    });
    if (!agentRecord || !agentRecord.modelConfig) {
      return [];
    }
    const modelConfig = (agentRecord.modelConfig as any).primary as ModelConfig;

    const response = await invokeModel(
      modelConfig,
      "You are a learning extraction system. Return only valid JSON array.",
      prompt
    );

    const clean = response.text.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  } catch (error) {
    console.error("[AgentMemory] Failed to extract learnings:", error);
    return [];
  }
}

/**
 * Store a memory entry
 */
export async function storeMemory(
  agentId: string | undefined,
  agentRole: string,
  type: MemoryEntry["type"],
  category: string,
  title: string,
  content: string,
  context: any
): Promise<MemoryEntry> {
  const id = `mem-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const embedding = await generateEmbedding(`${title} ${content} ${category}`);

  const entry: MemoryEntry = {
    id,
    agentId,
    agentRole,
    type,
    category,
    title,
    content,
    context,
    embedding,
    useCount: 0,
    successRate: type === "SUCCESS_PATTERN" ? 1.0 : 0.0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  memoryStore.set(id, entry);

  // Update indexes
  if (agentId) {
    if (!agentMemoryIndex.has(agentId)) {
      agentMemoryIndex.set(agentId, new Set());
    }
    agentMemoryIndex.get(agentId)!.add(id);
  }

  if (!categoryIndex.has(category)) {
    categoryIndex.set(category, new Set());
  }
  categoryIndex.get(category)!.add(id);

  emitLog(`[AgentMemory] 🧠 Stored ${type}: ${title}`);

  return entry;
}

/**
 * Learn from a completed task
 */
export async function learnFromTask(
  task: any,
  agentId: string,
  agentRole: string,
  success: boolean
): Promise<MemoryEntry[]> {
  emitLog(
    `[AgentMemory] 📚 Learning from ${
      success ? "successful" : "failed"
    } task...`
  );

  const learnings = await extractLearnings(task, success);
  const entries: MemoryEntry[] = [];

  for (const learning of learnings) {
    const entry = await storeMemory(
      agentId,
      agentRole,
      learning.type as MemoryEntry["type"],
      learning.category,
      learning.title,
      learning.content,
      { taskId: task.id, taskTitle: task.title }
    );
    entries.push(entry);
  }

  return entries;
}

/**
 * Retrieve relevant memories for a task
 */
export async function retrieveRelevantMemories(
  taskContext: any,
  agentRole: string,
  limit: number = 5
): Promise<MemoryEntry[]> {
  // Generate embedding for the query
  const queryText = `${taskContext.summary || ""} ${
    taskContext.description || ""
  } ${JSON.stringify(taskContext)}`;
  const queryEmbedding = await generateEmbedding(queryText);

  // Score all memories
  const scored: Array<{ entry: MemoryEntry; score: number }> = [];

  for (const entry of memoryStore.values()) {
    if (!entry.embedding) continue;

    let score = cosineSimilarity(queryEmbedding, entry.embedding);

    // Boost score for same role
    if (entry.agentRole === agentRole) {
      score *= 1.2;
    }

    // Boost score for success patterns
    if (entry.type === "SUCCESS_PATTERN") {
      score *= 1.1;
    }

    // Boost score based on success rate
    score *= 0.5 + entry.successRate * 0.5;

    scored.push({ entry, score });
  }

  // Sort by score and return top N
  scored.sort((a, b) => b.score - a.score);

  const results = scored.slice(0, limit).map((s) => s.entry);

  // Update use counts
  for (const entry of results) {
    entry.useCount++;
    entry.updatedAt = new Date();
    memoryStore.set(entry.id, entry);
  }

  if (results.length > 0) {
    emitLog(`[AgentMemory] 🔍 Retrieved ${results.length} relevant memories`);
  }

  return results;
}

/**
 * Get memories for a specific agent
 */
export function getAgentMemories(agentId: string): MemoryEntry[] {
  const memoryIds = agentMemoryIndex.get(agentId);
  if (!memoryIds) return [];

  return Array.from(memoryIds)
    .map((id) => memoryStore.get(id))
    .filter((m): m is MemoryEntry => m !== undefined);
}

/**
 * Get memories by category
 */
export function getMemoriesByCategory(category: string): MemoryEntry[] {
  const memoryIds = categoryIndex.get(category);
  if (!memoryIds) return [];

  return Array.from(memoryIds)
    .map((id) => memoryStore.get(id))
    .filter((m): m is MemoryEntry => m !== undefined);
}

/**
 * Update memory success rate based on outcome
 */
export function updateMemoryOutcome(
  memoryId: string,
  wasSuccessful: boolean
): void {
  const entry = memoryStore.get(memoryId);
  if (!entry) return;

  // Exponential moving average
  const alpha = 0.3;
  entry.successRate =
    alpha * (wasSuccessful ? 1 : 0) + (1 - alpha) * entry.successRate;
  entry.updatedAt = new Date();

  memoryStore.set(memoryId, entry);
}

/**
 * Format memories for injection into agent prompt
 */
export function formatMemoriesForPrompt(memories: MemoryEntry[]): string {
  if (memories.length === 0) return "";

  let prompt = "\n\n--- RELEVANT KNOWLEDGE FROM PAST EXPERIENCE ---\n";

  for (const mem of memories) {
    prompt += `\n[${mem.type}] ${mem.title}\n`;
    prompt += `Category: ${mem.category}\n`;
    prompt += `${mem.content}\n`;
    prompt += `(Success rate: ${(mem.successRate * 100).toFixed(0)}%)\n`;
  }

  prompt += "\n--- END KNOWLEDGE ---\n";

  return prompt;
}

/**
 * Get memory statistics
 */
export function getMemoryStats(): {
  totalMemories: number;
  byType: Record<string, number>;
  byCategory: Record<string, number>;
  avgSuccessRate: number;
} {
  const memories = Array.from(memoryStore.values());

  const byType: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  let totalSuccessRate = 0;

  for (const mem of memories) {
    byType[mem.type] = (byType[mem.type] || 0) + 1;
    byCategory[mem.category] = (byCategory[mem.category] || 0) + 1;
    totalSuccessRate += mem.successRate;
  }

  return {
    totalMemories: memories.length,
    byType,
    byCategory,
    avgSuccessRate:
      memories.length > 0 ? totalSuccessRate / memories.length : 0,
  };
}

/**
 * Store a best practice manually
 */
export async function storeBestPractice(
  category: string,
  title: string,
  content: string
): Promise<MemoryEntry> {
  return storeMemory(
    undefined,
    "SYSTEM",
    "BEST_PRACTICE",
    category,
    title,
    content,
    { source: "manual" }
  );
}

/**
 * Store a code snippet for reuse
 */
export async function storeCodeSnippet(
  category: string,
  title: string,
  code: string,
  description: string
): Promise<MemoryEntry> {
  return storeMemory(
    undefined,
    "SYSTEM",
    "CODE_SNIPPET",
    category,
    title,
    `${description}\n\n\`\`\`\n${code}\n\`\`\``,
    { source: "manual" }
  );
}

export const agentMemory = {
  storeMemory,
  learnFromTask,
  retrieveRelevantMemories,
  getAgentMemories,
  getMemoriesByCategory,
  updateMemoryOutcome,
  formatMemoriesForPrompt,
  getMemoryStats,
  storeBestPractice,
  storeCodeSnippet,
};
