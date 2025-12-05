// @ts-nocheck
import { sandbox } from "./sandbox";
import { midDevAgent } from "../agents/midDevAgent";
import { stackTraceMapper } from "./stackTraceMapper";
import { dependencyRepair } from "./dependencyRepair";
import { repoQuery } from "./repoQuery";
import { prisma } from "../lib/prisma";

export class RuntimeMonitorService {
  private activeMonitors: Map<string, () => void> = new Map();

  /**
   * Start monitoring a project's runtime logs.
   * Runs the provided command (e.g., 'npm start') in the sandbox.
   */
  async startMonitoring(projectId: string, runCommand: string = "npm start") {
    console.log(`[RuntimeMonitor] 🛡️ Starting monitor for ${projectId}`);

    const containerId = await sandbox.getOrCreateSession(projectId);

    const stopExec = await sandbox.streamExec(
      containerId,
      runCommand,
      (log, type) => {
        // console.log(`[${projectId}] ${type}: ${log.trim()}`); // Verbose
        this.analyzeLog(projectId, log);
      }
    );

    this.activeMonitors.set(projectId, stopExec);
  }

  /**
   * Stop monitoring a project.
   */
  stopMonitoring(projectId: string) {
    const stopFn = this.activeMonitors.get(projectId);
    if (stopFn) {
      stopFn();
      this.activeMonitors.delete(projectId);
      console.log(`[RuntimeMonitor] 🛑 Stopped monitor for ${projectId}`);
    }
  }

  /**
   * Analyze incoming logs for errors.
   */
  private async analyzeLog(projectId: string, log: string) {
    // 1. Check for Stack Traces / Exceptions
    // Simple heuristic: "Error:", "Exception", or stack trace lines "at ..."
    const isError = /Error:|Exception|^\s*at\s+/m.test(log);

    if (isError) {
      console.log(
        `[RuntimeMonitor] 🚨 Detected Error in ${projectId}:`,
        log.slice(0, 100)
      );

      // Prevent infinite loops: check if we are already repairing?
      // For MVP, just trigger repair.

      await this.triggerRepair(projectId, log);
    }
  }

  /**
   * Trigger the repair loop.
   */
  private async triggerRepair(projectId: string, errorLog: string) {
    console.log(`[RuntimeMonitor] 🔧 Triggering Repair for ${projectId}`);

    // 1. Map Stack Trace
    const mappedSymbol = await stackTraceMapper.mapToSymbol(
      projectId,
      errorLog
    );
    let context = "";

    if (mappedSymbol) {
      console.log(`[RuntimeMonitor] 📍 Mapped to ${mappedSymbol.file.path}`);
      const symbolDetails = await repoQuery.fetchBySymbol(
        projectId,
        mappedSymbol.symbol.name
      );
      if (symbolDetails) {
        context = `\nContext:\n${symbolDetails.code}`;
      }
    }

    // 2. Invoke Agent (Mocking the invocation for now as MidDevAgent.run is complex)
    // In a real system, we'd create a new Task for the agent.
    // "Fix runtime error: <error>"

    // For this MVP, we'll just log that we WOULD call the agent.
    // Or we can try to call a simplified repair function.

    console.log(`[RuntimeMonitor] 🤖 Invoking Agent with context...`);

    // Create a Task for the agent
    try {
      // Find or create a module for runtime fixes
      let module = await prisma.module.findFirst({
        where: { projectId: projectId },
      });

      if (!module) {
        module = await prisma.module.create({
          data: {
            name: "Runtime Fixes",
            projectId: projectId,
            status: "IN_PROGRESS",
          },
        });
      }

      const task = await prisma.task.create({
        data: {
          title: `Fix Runtime Error: ${errorLog
            .split("\n")[0]
            .slice(0, 50)}...`,
          // description: ... // Task doesn't have description
          contextPacket: {
            description: `Runtime error detected:\n\`\`\`\n${errorLog}\n\`\`\`\n${context}\nPlease fix the code to prevent this error.`,
            errorLog: errorLog,
            context: context,
          },
          status: "IN_PROGRESS",
          moduleId: module.id,
          requiredRole: "DEVELOPER",
        },
      });

      // Invoke Agent
      // We run it in background so we don't block the monitor?
      // But monitor is async.
      midDevAgent.run(projectId, task).catch((err) => {
        console.error(`[RuntimeMonitor] Agent failed:`, err);
      });
    } catch (err) {
      console.error(`[RuntimeMonitor] Failed to create task:`, err);
    }
  }
}

export const runtimeMonitor = new RuntimeMonitorService();
