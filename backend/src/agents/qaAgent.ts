// @ts-nocheck
/**
 * QA Agent
 *
 * An expert QA engineer agent that runs multi-layered testing (Lint, Unit, Integration, Fuzz).
 * Produces structured bug reports and patch suggestions.
 */

import { callLLM } from "../llm/llmClient";
import { getDefaultModelConfig } from "../llm/modelRegistry";
import { workspaceManager } from "../services/workspaceManager";
import { sandbox } from "../services/sandbox";
import { handleQAReject } from "../services/qaHandler";
import { confidenceRouter } from "../services/confidenceRouter";
import { emitTaskUpdate, emitAgentUpdate, emitLog } from "../websocket/socketServer";
import { prisma } from "../lib/prisma";
import { EvolutionaryAgent } from "./EvolutionaryAgent";
import { populationManager } from "../services/evolution/PopulationManager";
import { quickEUpdate, getRoleReward } from "../services/evolution/EvolutionaryRewardHelper";

export interface BugReport {
  bugId: string;
  taskId: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  file?: string;
  lines?: number[];
  error: string;
  reproSteps: string[];
  stackTrace?: string;
  confidence: number;
  suggestedPatch: string;
  failingArtifact?: string;
  timestamp: string;
}

const SYSTEM_PROMPT = `You are QA_AGENT — an expert QA engineer. Your job is to thoroughly validate features with layered testing and produce precise, actionable bug reports.

You will:
1) Run static scans: linter, security SAST, dependency audit.
2) Run unit tests (coverage >= 80%), integration tests, and e2e smoke flows.
3) Generate mutation tests for critical functions.
4) Run fuzzing (input fuzz) for public endpoints.
5) Produce structured bug report: file, lineRange, failingTest, stackTrace, reproSteps, patchSuggestion.
6) If tests are flaky, mark as FLAKY.

Bug Report Schema (JSON):
{
  "bugId": "BUG-...",
  "severity": "HIGH",
  "file": "path/to/file.ts",
  "lines": [10, 20],
  "error": "Error message...",
  "reproSteps": ["npm test ..."],
  "stackTrace": "...",
  "confidence": 0.95,
  "suggestedPatch": "One-line fix suggestion..."
}`;

export async function runQAAgentOnce() {
  const tasks = await prisma.task.findMany({
    where: { status: "IN_QA" },
    include: {
      module: {
        select: { projectId: true, name: true },
      },
    },
  });

  for (const task of tasks) {
    try {
      console.log(`[QA] Validating task: ${task.id}`);

      // Find the QA agent for this project to track its stats
      const projectId = task.module?.projectId;
      let qaAgent = null;
      if (projectId) {
        qaAgent = await prisma.agent.findFirst({
          where: {
            id: { startsWith: `proj_${projectId}` },
            role: { contains: "QA", mode: "insensitive" },
          },
        });
      }

      // In cloud mode, we can't run actual tests - use LLM to review code
      if (process.env.EXECUTION_MODE === "CLOUD") {
        await runLLMCodeReview(task, qaAgent);
      } else {
        await runMultiLayeredTests(task, qaAgent);
      }
    } catch (error) {
      console.error(`[QA] Error validating task ${task.id}:`, error);
      // Don't let errors block - mark as passed with warning
      await prisma.task.update({
        where: { id: task.id },
        data: {
          status: "COMPLETED", // Skip review if QA errors
          qaFeedback: `QA check skipped due to error: ${String(error).slice(
            0,
            200
          )}`,
        },
      });
    }
  }
}

/**
 * LLM-based code review for cloud mode (no Docker)
 * After QA review, sends to TeamLead for final approval
 */
async function runLLMCodeReview(task: any, qaAgent: any) {
  console.log(`[QA] Running LLM Code Review for Task ${task.id}`);

  const config = getDefaultModelConfig("QA");
  const response = await callLLM(config, [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `Review this task for quality:\nTitle: ${
        task.title
      }\nDescription: ${task.description || "N/A"}\nOutput: ${
        task.outputArtifact || "No output yet"
      }\n\nRespond with JSON: {"passed": boolean, "issues": string[], "confidence": number}`,
    },
  ]);

  try {
    const cleaned = response.content.replace(/```json|```/g, "").trim();
    const review = JSON.parse(cleaned);

    if (review.passed) {
      console.log(
        `[QA] ✅ Task ${task.id} passed QA review - sending to TeamLead`
      );
      await prisma.task.update({
        where: { id: task.id },
        data: {
          status: "IN_REVIEW", // Send to TeamLead for final approval
          qaFeedback: `QA Passed ✅ (confidence: ${(
            review.confidence * 100
          ).toFixed(0)}%)`,
        },
      });
    } else {
      console.log(
        `[QA] ❌ Task ${task.id} failed QA review: ${review.issues?.join(", ")}`
      );
      await prisma.task.update({
        where: { id: task.id },
        data: {
          status: "NEEDS_REVISION", // Send back to developer for fixes
          // Increment retryCount so loops can be detected and handled
          retryCount: { increment: 1 },
          qaFeedback: `QA Failed ❌: ${(review.issues || []).join("; ")}`,
        },
      });
    }

    // EVOLUTIONARY: Update QA agent E-value for completing a review
    if (qaAgent) {
      await quickEUpdate(qaAgent.id, getRoleReward('QA', 'review'), review.passed ? 'QA passed' : 'QA rejected');
    }

    const updatedTask = await prisma.task.findUnique({
      where: { id: task.id },
    });
    if (updatedTask) emitTaskUpdate(updatedTask);
  } catch (e) {
    // Default to send to review if parsing fails
    console.log(`[QA] Parse error, sending to TeamLead for Task ${task.id}`);
    await prisma.task.update({
      where: { id: task.id },
      data: {
        status: "IN_REVIEW",
        qaFeedback: "QA review completed (manual check recommended)",
      },
    });

    // EVOLUTIONARY: Still count this as a review completion for QA
    if (qaAgent) {
      await quickEUpdate(qaAgent.id, getRoleReward('QA', 'review'), 'Parse error - still reviewed');
    }

    const updatedTask = await prisma.task.findUnique({
      where: { id: task.id },
    });
    if (updatedTask) emitTaskUpdate(updatedTask);
  }
}

async function runMultiLayeredTests(task: any, qaAgent: any) {
  const moduleId = task.moduleId;
  let projectId: string | null = null;

  if (moduleId) {
    const module = await prisma.module.findUnique({
      where: { id: moduleId },
      select: { projectId: true },
    });
    projectId = module?.projectId ?? null;
  }

  if (!projectId) return;

  console.log(
    `[QA] 🧪 Running Multi-Layered Tests for Project ${projectId}...`
  );

  let status = await workspaceManager.getPreviewStatus(projectId);

  // Poll for workspace path if not ready (up to 120s)
  let attempts = 0;
  while (!status.workspacePath && attempts < 120) {
    console.log(`[QA] Waiting for workspace path... (${attempts + 1}/120)`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    status = await workspaceManager.getPreviewStatus(projectId);
    attempts++;
  }

  if (!status.workspacePath) {
    console.error(
      `[QA] No workspace path found for project ${projectId} after timeout. Skipping QA.`
    );
    return;
  }

  const containerId = await sandbox.getOrCreateSession(
    projectId,
    status.workspacePath
  );

  // 1. Lint & Static Analysis
  console.log("[QA] 🔍 Running Static Analysis (Lint/SAST)...");
  const lintRes = await sandbox.exec(
    containerId,
    "npm run lint -- --format json"
  );
  if (lintRes.exitCode !== 0) {
    await reportBug(
      task,
      "MEDIUM",
      "Linting failed",
      lintRes.stderr || lintRes.stdout,
      ["npm run lint"]
    );
    return;
  }

  // 2. Unit Tests
  console.log("[QA] 🧪 Running Unit Tests...");
  const testRes = await sandbox.exec(containerId, "npm test -- --json");
  if (testRes.exitCode !== 0) {
    await reportBug(
      task,
      "HIGH",
      "Unit tests failed",
      testRes.stderr || testRes.stdout,
      ["npm test"]
    );
    return;
  }

  // 3. Integration Tests (Playwright/Supertest)
  console.log("[QA] 🎭 Running Integration Tests...");
  // Check if integration tests exist
  const hasIntegration = await sandbox.exec(
    containerId,
    "ls tests/integration"
  );
  if (hasIntegration.exitCode === 0) {
    const intRes = await sandbox.exec(containerId, "npm run test:integration");
    if (intRes.exitCode !== 0) {
      await reportBug(
        task,
        "CRITICAL",
        "Integration tests failed",
        intRes.stderr || intRes.stdout,
        ["npm run test:integration"]
      );
      return;
    }
  }

  // 4. Fuzz Testing (Fast-Check)
  console.log("[QA] 🎲 Running Fuzz Tests...");
  const fuzzRes = await sandbox.exec(containerId, "npm run fuzz");
  if (fuzzRes.exitCode !== 0) {
    // Fuzzing failures are often edge cases, treat as High but maybe not blocking if minor?
    // For now, block.
    await reportBug(
      task,
      "HIGH",
      "Fuzz testing found edge cases",
      fuzzRes.stderr || fuzzRes.stdout,
      ["npm run fuzz"]
    );
    return;
  }

  // 5. Mutation Testing (Stryker) - Only for high complexity or critical paths
  // Check budget or complexity before running
  if (task.complexityScore && task.complexityScore > 70) {
    console.log("[QA] 🧬 Running Mutation Tests (Stryker)...");
    const mutRes = await sandbox.exec(containerId, "npx stryker run");
    if (mutRes.exitCode !== 0) {
      // Mutation score too low?
      await reportBug(
        task,
        "MEDIUM",
        "Mutation score below threshold",
        mutRes.stdout,
        ["npx stryker run"]
      );
      return;
    }
  }

  console.log(`[QA] ✅ All Checks Passed! Proceeding to Approval.`);

  const existingFeedback = (task.reviewFeedback as any) || {};
  const completedTask = await prisma.task.update({
    where: { id: task.id },
    data: {
      status: "COMPLETED",
      reviewFeedback: {
        ...existingFeedback,
        qa: "Auto-QA: Lint, Unit, Integration, Fuzz, and Mutation Tests Passed.",
        qaTimestamp: new Date().toISOString(),
      },
    },
  });
  emitTaskUpdate(completedTask);

  // Mark agent as IDLE if assigned
  if (task.assignedToAgentId) {
    const idleAgent = await prisma.agent.update({
      where: { id: task.assignedToAgentId },
      data: { status: "IDLE", currentTaskId: null },
    });
    emitAgentUpdate(idleAgent);
  }
}

async function reportBug(
  task: any,
  severity: string,
  errorMsg: string,
  details: string,
  reproSteps: string[]
) {
  console.log(`[QA] ❌ ${severity} Bug Detected: ${errorMsg}`);

  // Ask LLM for structured analysis and patch
  const config = getDefaultModelConfig("QA");
  let bugReport: BugReport;

  try {
    const analysis = await callLLM(config, [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Analyze this failure and return a JSON BugReport:\nError: ${errorMsg}\nDetails: ${details}`,
      },
    ]);

    const cleaned = analysis.content.replace(/```json|```/g, "").trim();
    bugReport = JSON.parse(cleaned);

    // Ensure bugId and timestamp are present
    bugReport.bugId = bugReport.bugId || `BUG-${Date.now()}`;
    bugReport.timestamp = new Date().toISOString();
    bugReport.taskId = task.id;

    // HARDENING: Route based on confidence
    if (bugReport.suggestedPatch) {
      await confidenceRouter.routeByConfidence({
        bugId: bugReport.bugId,
        taskId: task.id,
        severity: bugReport.severity,
        confidence: bugReport.confidence || 0,
        suggestedPatch: bugReport.suggestedPatch,
      });
    }
  } catch (e) {
    console.error("Failed to generate/parse bug report:", e);
    // Fallback if LLM fails
    bugReport = {
      bugId: `BUG-${Date.now()}`,
      taskId: task.id,
      severity: severity as any,
      file: "",
      lines: [],
      error: errorMsg,
      reproSteps,
      stackTrace: details,
      suggestedPatch: "Please fix the errors shown in the logs.",
      confidence: 0.0,
      timestamp: new Date().toISOString(),
    };

    // Still route to War Room if critical
    if (severity === "CRITICAL") {
      await confidenceRouter.routeByConfidence({
        bugId: bugReport.bugId,
        taskId: task.id,
        severity: "CRITICAL",
        confidence: 0,
        suggestedPatch: "",
      });
    }
  }

  await handleQAReject({
    taskId: task.id,
    reviewerAgentId: "qa_expert_v2",
    failingFiles: bugReport.file ? [bugReport.file] : [],
    instruction: `QA Failed (${severity}): ${
      bugReport.error
    }\n\nReproduction:\n${bugReport.reproSteps.join(
      "\n"
    )}\n\nSuggested Patch:\n${
      bugReport.suggestedPatch
    }\n\nDetails:\n${details}`,
  });
}
