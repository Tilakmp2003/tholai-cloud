import { Task } from "@prisma/client";
import { callLLM } from "../llm/llmClient";
import { getAgentConfig } from "../llm/modelRegistry";
import {
  emitTaskUpdate,
  emitAgentUpdate,
  emitLog,
} from "../websocket/socketServer";
import { prisma } from "../lib/prisma";
import { workspaceManager } from "../services/workspaceManager";
import { createVerifiedAgent } from "../services/VerifiedAgent";
import { EvolutionaryAgent } from "./EvolutionaryAgent";
import { populationManager } from "../services/evolution/PopulationManager";
import { verifyGeneratedCode } from "../services/agentHallucinationWrapper";

interface FileReviewResult {
  fileName: string;
  issues: Array<{
    type: "error" | "warning" | "suggestion";
    line?: number;
    message: string;
    fix?: string;
  }>;
  passed: boolean;
}

interface ProjectReviewReport {
  projectId: string;
  projectName: string;
  totalFiles: number;
  filesReviewed: number;
  passedFiles: number;
  failedFiles: number;
  criticalIssues: number;
  warnings: number;
  suggestions: number;
  fileReports: FileReviewResult[];
  overallStatus: "PASSED" | "NEEDS_FIXES" | "CRITICAL";
  summary: string;
}

export class SeniorDevAgent {
  /**
   * Review a single file for issues
   */
  async reviewFile(
    fileName: string,
    content: string
  ): Promise<FileReviewResult> {
    const systemPrompt = `
You are a Senior Developer (L6) performing CODE REVIEW.
Review this file for:
1. Syntax errors
2. Type errors (for TypeScript)
3. Logic bugs
4. Security vulnerabilities
5. Performance issues
6. Best practice violations
7. Missing error handling
8. Import issues

FILE: ${fileName}
CONTENT:
\`\`\`
${content.slice(0, 8000)}
\`\`\`

OUTPUT JSON ONLY:
{
  "issues": [
    {
      "type": "error" | "warning" | "suggestion",
      "line": number or null,
      "message": "Description of issue",
      "fix": "How to fix it"
    }
  ],
  "passed": true/false
}

If no issues found, return {"issues": [], "passed": true}
`;

    const config = await getAgentConfig("SeniorDev");

    try {
      const response = await callLLM(config, [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Review this code file." },
      ]);

      const cleanResponse = response.content
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

      const result = JSON.parse(cleanResponse);
      return {
        fileName,
        issues: result.issues || [],
        passed: result.passed ?? result.issues?.length === 0,
      };
    } catch (e) {
      console.error(`[SeniorDev] Failed to review ${fileName}:`, e);
      return {
        fileName,
        issues: [{ type: "warning", message: "Failed to review file" }],
        passed: true, // Don't block on review failure
      };
    }
  }

  /**
   * Get all source files from project (flatten file tree)
   */
  private flattenFileTree(tree: any[], prefix: string = ""): string[] {
    const files: string[] = [];
    for (const item of tree) {
      const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.type === "file") {
        // Only review code files
        if (/\.(ts|tsx|js|jsx|json|css|scss|html)$/.test(item.name)) {
          files.push(fullPath);
        }
      } else if (item.type === "dir" && item.children) {
        files.push(...this.flattenFileTree(item.children, fullPath));
      }
    }
    return files;
  }

  /**
   * Review entire project and generate report
   */
  async reviewProject(projectId: string): Promise<ProjectReviewReport> {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true, workspacePath: true },
    });

    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    console.log(`[SeniorDev] 🔍 Starting full project review: ${project.name}`);
    emitLog(`[SeniorDev] 🔍 Starting code review for ${project.name}`);

    // Get all files
    const fileTree = await workspaceManager.getFileTree(projectId);
    const allFiles = this.flattenFileTree(fileTree);

    // Filter to main source files (skip config files, package-lock, etc)
    const sourceFiles = allFiles
      .filter(
        (f) =>
          (!f.includes("package-lock") &&
            !f.includes(".d.ts") &&
            !f.endsWith(".json")) ||
          f === "tsconfig.json"
      )
      .slice(0, 20); // Limit to 20 files to avoid rate limits

    console.log(`[SeniorDev] Found ${sourceFiles.length} files to review`);

    const fileReports: FileReviewResult[] = [];
    let criticalIssues = 0;
    let warnings = 0;
    let suggestions = 0;

    // Review each file
    for (const filePath of sourceFiles) {
      try {
        const content = await workspaceManager.readFile(projectId, filePath);

        // Skip very large files
        if (content.length > 15000) {
          console.log(`[SeniorDev] Skipping large file: ${filePath}`);
          continue;
        }

        const review = await this.reviewFile(filePath, content);
        fileReports.push(review);

        // Count issues
        for (const issue of review.issues) {
          if (issue.type === "error") criticalIssues++;
          else if (issue.type === "warning") warnings++;
          else suggestions++;
        }

        if (!review.passed) {
          console.log(
            `[SeniorDev] ❌ Issues in: ${filePath} (${review.issues.length} issues)`
          );
        } else {
          console.log(`[SeniorDev] ✅ Passed: ${filePath}`);
        }

        // Small delay to avoid rate limits
        await new Promise((r) => setTimeout(r, 500));
      } catch (err: any) {
        console.error(`[SeniorDev] Error reading ${filePath}:`, err.message);
      }
    }

    // Also run TypeScript type check if tsconfig exists
    try {
      const tsResult = await workspaceManager.runCommand(
        projectId,
        "npx tsc --noEmit 2>&1 || true"
      );
      if (tsResult.stderr || tsResult.stdout.includes("error TS")) {
        const tsErrors = (tsResult.stdout + tsResult.stderr)
          .split("\n")
          .filter((line) => line.includes("error TS"))
          .slice(0, 10);

        if (tsErrors.length > 0) {
          fileReports.push({
            fileName: "TypeScript Compilation",
            issues: tsErrors.map((err) => ({
              type: "error" as const,
              message: err.trim(),
            })),
            passed: false,
          });
          criticalIssues += tsErrors.length;
        }
      }
    } catch (e) {
      console.log(`[SeniorDev] TypeScript check skipped`);
    }

    const passedFiles = fileReports.filter((r) => r.passed).length;
    const failedFiles = fileReports.filter((r) => !r.passed).length;

    let overallStatus: "PASSED" | "NEEDS_FIXES" | "CRITICAL" = "PASSED";
    if (criticalIssues > 0) overallStatus = "CRITICAL";
    else if (warnings > 0 || failedFiles > 0) overallStatus = "NEEDS_FIXES";

    const summary =
      `Reviewed ${fileReports.length} files: ${passedFiles} passed, ${failedFiles} failed. ` +
      `Found ${criticalIssues} errors, ${warnings} warnings, ${suggestions} suggestions.`;

    emitLog(`[SeniorDev] 📋 Review complete: ${summary}`);

    return {
      projectId: project.id,
      projectName: project.name,
      totalFiles: allFiles.length,
      filesReviewed: fileReports.length,
      passedFiles,
      failedFiles,
      criticalIssues,
      warnings,
      suggestions,
      fileReports,
      overallStatus,
      summary,
    };
  }

  /**
   * Create fix tasks for issues found
   */
  async createFixTasks(
    report: ProjectReviewReport,
    moduleId: string
  ): Promise<number> {
    let tasksCreated = 0;

    for (const fileReport of report.fileReports) {
      if (fileReport.passed) continue;

      const criticalIssues = fileReport.issues.filter(
        (i) => i.type === "error"
      );
      const otherIssues = fileReport.issues.filter((i) => i.type !== "error");

      // Create task for critical issues (assign to MidDev) - WITH DEDUPLICATION
      if (criticalIssues.length > 0) {
        // Check if there's already a pending task for this file
        const existingTask = await prisma.task.findFirst({
          where: {
            relatedFileName: fileReport.fileName,
            moduleId,
            status: { in: ['QUEUED', 'ASSIGNED', 'IN_PROGRESS'] },
            title: { startsWith: 'Fix errors in' }
          }
        });

        if (!existingTask) {
          const description =
            `Senior Dev Review found ${criticalIssues.length} error(s) in this file:\n` +
            criticalIssues
              .map((i) => `- ${i.message}${i.fix ? `\n  Fix: ${i.fix}` : ""}`)
              .join("\n");

          await prisma.task.create({
            data: {
              title: `Fix errors in ${fileReport.fileName}`,
              status: "QUEUED",
              requiredRole: "MidDev",
              moduleId,
              relatedFileName: fileReport.fileName,
              contextPacket: {
                description,
                issues: criticalIssues,
                sourceReview: "SeniorDev",
                priority: "HIGH",
              },
            },
          });
          tasksCreated++;
          console.log(
            `[SeniorDev] 📝 Created fix task for ${fileReport.fileName}`
          );
        } else {
          console.log(
            `[SeniorDev] ⏭️ Skipping duplicate fix task for ${fileReport.fileName}`
          );
        }
      }

      // Create task for warnings (assign to MidDev) - WITH DEDUPLICATION
      if (otherIssues.length > 0) {
        // Check if there's already a pending improvement task for this file
        const existingImproveTask = await prisma.task.findFirst({
          where: {
            relatedFileName: fileReport.fileName,
            moduleId,
            status: { in: ['QUEUED', 'ASSIGNED', 'IN_PROGRESS'] },
            title: { startsWith: 'Improve' }
          }
        });

        if (!existingImproveTask) {
          const description =
            `Senior Dev Review found ${otherIssues.length} improvement(s):\n` +
            otherIssues
              .map(
                (i) =>
                  `- [${i.type.toUpperCase()}] ${i.message}${
                    i.fix ? `\n  Fix: ${i.fix}` : ""
                  }`
              )
              .join("\n");

          await prisma.task.create({
            data: {
              title: `Improve ${fileReport.fileName}`,
              status: "QUEUED",
              requiredRole: "MidDev",
              moduleId,
              relatedFileName: fileReport.fileName,
              contextPacket: {
                description,
                issues: otherIssues,
                sourceReview: "SeniorDev",
                priority: "MEDIUM",
              },
            },
          });
          tasksCreated++;
        } else {
          console.log(
            `[SeniorDev] ⏭️ Skipping duplicate improve task for ${fileReport.fileName}`
          );
        }
      }
    }

    return tasksCreated;
  }

  async executeTask(task: Task, context: any): Promise<any> {
    const systemPrompt = `
You are a Senior Developer (L6). You are in EXECUTION-MODE.
Your goal is to solve complex coding problems and refactor code.

INPUT:
- Task: ${task.title}
- Context: ${JSON.stringify(context)}

INSTRUCTIONS:
1. Analyze the complex logic.
2. Write optimized, clean code.
3. Handle edge cases.

OUTPUT JSON ONLY:
{
  "status": "COMPLETED" | "FAILED",
  "artifact": "Code solution",
  "fileName": "file.ts"
}
`;

    const config = await getAgentConfig("SeniorDev");
    const response = await callLLM(config, [
      { role: "system", content: systemPrompt },
      { role: "user", content: "Execute complex task." },
    ]);

    try {
      const cleanResponse = response.content
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();
      const parsed = JSON.parse(cleanResponse);
      
      // Hallucination check for generated code
      if (parsed.artifact && typeof parsed.artifact === 'string') {
        const verifyResult = await verifyGeneratedCode(
          'SeniorDev',
          task.id,
          task.title || 'Execute complex task',
          parsed.artifact
        );
        
        if (!verifyResult.success) {
          emitLog(`[SeniorDev] 🚫 Hallucination blocked: ${verifyResult.blockReason}`);
          return { status: "FAILED", artifact: "", fileName: "", error: verifyResult.blockReason };
        }
      }
      
      return parsed;
    } catch (e) {
      return { status: "FAILED", artifact: "", fileName: "" };
    }
  }
}

export async function runSeniorDevAgentOnce() {
  // GLOBAL DEDUP CHECK: Skip review if ANY active improvement/fix tasks exist
  const existingActiveTasks = await prisma.task.count({
    where: {
      status: { in: ['QUEUED', 'ASSIGNED', 'IN_PROGRESS'] },
      OR: [
        { title: { startsWith: 'Fix errors' } },
        { title: { startsWith: 'Improve' } },
        { title: { startsWith: 'Code Review Report' } }
      ]
    }
  });
  
  if (existingActiveTasks > 0) {
    console.log(`[SeniorDev] ⏭️ Skipping review - ${existingActiveTasks} active review tasks already exist`);
    return; // Don't create more tasks until existing ones are processed
  }

  // First, check for projects that need review (have completed tasks but no recent review)
  const projectsNeedingReview = await prisma.project.findMany({
    where: {
      modules: {
        some: {
          tasks: {
            some: {
              status: "COMPLETED",
              // Only review if task was completed in last hour and not yet reviewed by SeniorDev
              updatedAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
            },
          },
        },
      },
    },
    include: {
      modules: {
        take: 1,
        select: { id: true },
      },
    },
    take: 1, // One project at a time
  });

  const agent = new SeniorDevAgent();

  // Review projects with completed work
  for (const project of projectsNeedingReview) {
    try {
      console.log(`[SeniorDev] 🔍 Reviewing project: ${project.name}`);
      emitLog(`[SeniorDev] 🔍 Starting review of ${project.name}`);

      const report = await agent.reviewProject(project.id);

      // Report to Team Leader via creating a review report task
      if (report.overallStatus !== "PASSED") {
        const moduleId = project.modules[0]?.id;

        if (moduleId) {
          // CHECK FOR EXISTING REPORT TASK - DEDUPLICATION
          const existingReportTask = await prisma.task.findFirst({
            where: {
              moduleId,
              status: { in: ['QUEUED', 'ASSIGNED', 'IN_PROGRESS'] },
              title: { startsWith: 'Code Review Report:' }
            }
          });

          if (existingReportTask) {
            console.log(`[SeniorDev] ⏭️ Skipping duplicate Code Review Report for ${project.name}`);
          } else {
            const description =
              `**Senior Dev Code Review Complete**\n\n` +
              `**Status:** ${report.overallStatus}\n\n` +
              `**Summary:** ${report.summary}\n\n` +
              `**Issues Found:**\n` +
              report.fileReports
                .filter((r) => !r.passed)
                .map((r) => `- ${r.fileName}: ${r.issues.length} issue(s)`)
                .join("\n");

            // Create report task for Team Leader
            await prisma.task.create({
              data: {
                title: `Code Review Report: ${project.name}`,
                status: "QUEUED",
                requiredRole: "TeamLead",
                moduleId,
                contextPacket: {
                  description,
                  report: JSON.parse(JSON.stringify(report)), // Ensure it's a plain object
                  priority:
                    report.overallStatus === "CRITICAL" ? "CRITICAL" : "HIGH",
                },
              },
            });
            console.log(`[SeniorDev] 📝 Created Code Review Report for ${project.name}`);
          }

          // Also create fix tasks for MidDev (already has deduplication)
          const fixTasksCreated = await agent.createFixTasks(report, moduleId);
          emitLog(
            `[SeniorDev] 📝 Created ${fixTasksCreated} fix tasks for developers`
          );
        }
      } else {
        emitLog(
          `[SeniorDev] ✅ Project ${project.name} passed review - no issues found`
        );
      }
    } catch (err) {
      console.error(`[SeniorDev] Review error:`, err);
    }
  }

  // Also handle directly assigned SeniorDev tasks
  const tasks = await prisma.task.findMany({
    where: {
      status: "ASSIGNED",
      requiredRole: {
        in: ["SeniorDev", "SENIORDEV", "SENIOR_DEV", "seniorDev", "seniordev"],
      },
    },
    take: 5,
  });

  if (tasks.length === 0) return;

  for (const task of tasks) {
    console.log(`[SeniorDev] Processing Task ${task.id}`);
    
    // EVOLUTIONARY: Get agent from pool or use assigned
    let agentId = task.assignedToAgentId;
    let dbAgent = agentId ? await prisma.agent.findUnique({ where: { id: agentId } }) : null;
    let evoAgent: EvolutionaryAgent | null = null;

    // If no agent assigned, request one from the evolution pool
    if (!dbAgent) {
      dbAgent = await populationManager.requestAgent("SeniorDev");
      if (dbAgent) {
        agentId = dbAgent.id;
        await prisma.task.update({
          where: { id: task.id },
          data: { assignedToAgentId: agentId },
        });
        await prisma.agent.update({
          where: { id: agentId },
          data: { currentTaskId: task.id },
        });
        console.log(`[SeniorDev] 🧬 Assigned evolutionary agent ${agentId} (E=${(dbAgent as any).existencePotential?.toFixed(1) || 'N/A'})`);
      }
    }

    // Create evolutionary wrapper if agent has E-value
    if (dbAgent && (dbAgent as any).existencePotential !== null && (dbAgent as any).existencePotential > 0) {
      evoAgent = new EvolutionaryAgent(dbAgent as any);
      console.log(`[SeniorDev] 🧬 Using EvolutionaryAgent wrapper (E=${(dbAgent as any).existencePotential.toFixed(1)})`);
    }

    const inProgressTask = await prisma.task.update({
      where: { id: task.id },
      data: { status: "IN_PROGRESS" },
    });
    emitTaskUpdate(inProgressTask);

    try {
      const result = await agent.executeTask(task, task.contextPacket);

      if (result.status === "COMPLETED") {
        // HALLUCINATION VERIFICATION GATE WITH AUTO-FIX RETRY
        const verifier = createVerifiedAgent({ 
          agentId: agentId || 'seniorDev', 
          agentRole: 'SeniorDev',
          maxRetries: 2
        });
        
        const MAX_RETRIES = 2;
        let currentCode = result.artifact;
        let verified = false;
        
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
          const verification = await verifier.verifyCode(currentCode, {
            taskId: task.id,
            inputContext: task.title,
            language: 'typescript'
          });

          if (verification.verified) {
            console.log(`[SeniorDev] ✅ Code verified - no hallucinations`);
            result.artifact = currentCode;
            verified = true;
            break;
          }
          
          if (attempt < MAX_RETRIES) {
            console.log(`[SeniorDev] 🔄 Retry ${attempt + 1}/${MAX_RETRIES} - fixing hallucination...`);
            emitLog(`[SeniorDev] 🔄 Fixing: ${verification.error}`);
            
            const fixPrompt = `
Your previous code had a hallucination error:
${verification.error}

FIX THE CODE - do not use non-existent methods or APIs.
Here is the problematic code:
\`\`\`
${currentCode}
\`\`\`

OUTPUT ONLY the fixed code, no explanation.
`;
            const config = await getAgentConfig("SeniorDev");
            const fixResponse = await callLLM(config, [
              { role: "system", content: "You are a senior code fixer. Output ONLY valid JavaScript/TypeScript code." },
              { role: "user", content: fixPrompt }
            ]);
            
            currentCode = fixResponse.content
              .replace(/```(?:javascript|typescript|js|ts)?/g, '')
              .replace(/```/g, '')
              .trim();
          } else {
            console.log(`[SeniorDev] ⚠️ HALLUCINATION DETECTED after ${MAX_RETRIES} retries`);
            emitLog(`[SeniorDev] ⚠️ Failed after retries: ${verification.error}`);
            const hallucinatedTask = await prisma.task.update({
              where: { id: task.id },
              data: {
                status: "FAILED",
                errorMessage: `Hallucination after ${MAX_RETRIES} retries: ${verification.error}`,
              },
            });
            emitTaskUpdate(hallucinatedTask);
            continue;
          }
        }
        
        if (!verified) continue;

        const reviewTask = await prisma.task.update({
          where: { id: task.id },
          data: {
            status: "IN_REVIEW",
            outputArtifact: result.artifact,
            relatedFileName: result.fileName,
            lastAgentMessage: "Complex task completed.",
          },
        });
        emitTaskUpdate(reviewTask);

        // EVOLUTIONARY: Update E-value for success (+15 for senior dev)
        if (evoAgent && agentId) {
          const currentE = (dbAgent as any).existencePotential || 100;
          const newE = Math.min(100, currentE + 15);
          await prisma.agent.update({
            where: { id: agentId },
            data: { existencePotential: newE } as any,
          });
          console.log(`[SeniorDev] 🧬 E-value reward: +15 (${currentE.toFixed(1)} → ${newE.toFixed(1)})`);
        }

        // Update agent stats - reward for success
        if (agentId) {
          const updatedAgent = await prisma.agent.update({
            where: { id: agentId },
            data: {
              successCount: { increment: 1 },
              score: { increment: 10 }, // Higher reward for senior dev tasks
              lastActiveAt: new Date(),
            },
          });
          emitAgentUpdate(updatedAgent);
        }
      } else {
        const failedTask = await prisma.task.update({
          where: { id: task.id },
          data: { status: "FAILED", errorMessage: "Failed to execute" },
        });
        emitTaskUpdate(failedTask);

        // EVOLUTIONARY: Update E-value for failure (-20 for senior dev failure)
        if (evoAgent && agentId) {
          const currentE = (dbAgent as any).existencePotential || 100;
          const newE = Math.max(0, currentE - 20);
          await prisma.agent.update({
            where: { id: agentId },
            data: { existencePotential: newE } as any,
          });
          console.log(`[SeniorDev] 🧬 E-value penalty: -20 (${currentE.toFixed(1)} → ${newE.toFixed(1)})`);
        }

        // Update agent stats - penalty for failure
        if (agentId) {
          const updatedAgent = await prisma.agent.update({
            where: { id: agentId },
            data: {
              failCount: { increment: 1 },
              score: { decrement: 5 },
            },
          });
          emitAgentUpdate(updatedAgent);
        }
      }
    } catch (error) {
      console.error(`[SeniorDev] Error:`, error);
      const failedTask = await prisma.task.update({
        where: { id: task.id },
        data: { status: "FAILED", errorMessage: String(error) },
      });
      emitTaskUpdate(failedTask);

      // EVOLUTIONARY: Penalty for error
      if (evoAgent && agentId) {
        const currentE = (dbAgent as any).existencePotential || 100;
        const newE = Math.max(0, currentE - 15);
        await prisma.agent.update({
          where: { id: agentId },
          data: { existencePotential: newE } as any,
        });
        console.log(`[SeniorDev] 🧬 E-value penalty: -15 (error)`);
      }

      // Update agent stats - penalty for error
      if (agentId) {
        const updatedAgent = await prisma.agent.update({
          where: { id: agentId },
          data: {
            failCount: { increment: 1 },
            score: { decrement: 5 },
          },
        });
        emitAgentUpdate(updatedAgent);
      }
    }

    // Mark agent as IDLE
    if (agentId) {
      const idleAgent = await prisma.agent.update({
        where: { id: agentId },
        data: { status: "IDLE", currentTaskId: null, lastActiveAt: new Date() },
      });
      emitAgentUpdate(idleAgent);
    }
  }
}
