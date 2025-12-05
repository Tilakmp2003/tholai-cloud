/**
 * Comprehensive App Functionality Test
 * Tests all core components before deployment
 */

import * as dotenv from "dotenv";
dotenv.config();

import { PrismaClient } from "@prisma/client";
import { callLLM } from "../src/llm/llmClient";
import {
  getDefaultModelConfig,
  getAgentConfig,
} from "../src/llm/modelRegistry";

const prisma = new PrismaClient();

interface TestResult {
  name: string;
  status: "PASS" | "FAIL" | "SKIP";
  time?: number;
  message?: string;
}

const results: TestResult[] = [];

async function test(name: string, fn: () => Promise<void>) {
  console.log(`\n🧪 ${name}...`);
  const start = Date.now();
  try {
    await fn();
    const time = Date.now() - start;
    console.log(`   ✅ PASS (${time}ms)`);
    results.push({ name, status: "PASS", time });
  } catch (error: any) {
    console.log(`   ❌ FAIL: ${error.message}`);
    results.push({ name, status: "FAIL", message: error.message });
  }
}

async function main() {
  console.log("\n" + "=".repeat(70));
  console.log("🚀 THOLAI APP FUNCTIONALITY TEST SUITE");
  console.log("=".repeat(70));

  // ===== 1. Database Connection =====
  await test("Database Connection", async () => {
    await prisma.$connect();
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    if (!result) throw new Error("Database query failed");
  });

  // ===== 2. Agent Configuration =====
  await test("Agent Records Exist", async () => {
    const agents = await prisma.agent.findMany();
    console.log(`   Found ${agents.length} agents`);
    if (agents.length === 0) throw new Error("No agents in database");
    agents
      .slice(0, 5)
      .forEach((a) => console.log(`   - ${a.role}: ${a.status}`));
  });

  // ===== 3. Model Registry =====
  await test("Model Registry - Default Configs", async () => {
    const roles = ["HeadAgent", "Architect", "MidDev", "QA"];
    for (const role of roles) {
      const config = getDefaultModelConfig(role);
      if (!config.model) throw new Error(`No config for ${role}`);
      console.log(`   ${role}: ${config.provider}/${config.model}`);
    }
  });

  // ===== 4. LLM Call - DeepSeek V3 =====
  await test("LLM Call - DeepSeek V3", async () => {
    const response = await callLLM(
      {
        provider: "bedrock",
        model: "deepseek.v3-v1:0",
        maxTokens: 100,
        temperature: 0.2,
        region: "ap-south-1",
      },
      [
        {
          role: "system",
          content: "You are a helpful assistant. Respond with valid JSON only.",
        },
        {
          role: "user",
          content: 'Return: {"status": "ok", "message": "test passed"}',
        },
      ]
    );
    console.log(`   Response: ${response.content.substring(0, 80)}`);
    if (!response.content) throw new Error("Empty response");
  });

  // ===== 5. Task Dispatcher Module =====
  await test("Task Dispatcher Module Load", async () => {
    const { dispatchTasks } = await import("../src/services/taskDispatcher");
    if (typeof dispatchTasks !== "function")
      throw new Error("dispatchTasks not a function");
  });

  // ===== 6. WebSocket Module =====
  await test("WebSocket Module Load", async () => {
    const { emitTaskUpdate, emitAgentUpdate } = await import(
      "../src/websocket/socketServer"
    );
    if (typeof emitTaskUpdate !== "function")
      throw new Error("emitTaskUpdate not a function");
    if (typeof emitAgentUpdate !== "function")
      throw new Error("emitAgentUpdate not a function");
  });

  // ===== 7. Project Planner =====
  await test("Project Planner Module Load", async () => {
    const { planProject } = await import("../src/services/projectPlanner");
    if (typeof planProject !== "function")
      throw new Error("planProject not a function");
  });

  // ===== 8. Workspace Manager =====
  await test("Workspace Manager Module Load", async () => {
    const { workspaceManager } = await import(
      "../src/services/workspaceManager"
    );
    if (!workspaceManager) throw new Error("workspaceManager not exported");
  });

  // ===== 9. Agent Runner Functions =====
  await test("Agent Runner Functions", async () => {
    const agentModules = [
      { name: "Architect", fn: "runArchitectAgentOnce" },
      { name: "MidDev", fn: "runMidDevAgentOnce" },
      { name: "SeniorDev", fn: "runSeniorDevAgentOnce" },
      { name: "TeamLead", fn: "runTeamLeadAgentOnce" },
    ];

    for (const { name, fn } of agentModules) {
      const mod = await import(`../src/agents/${name.toLowerCase()}Agent`);
      if (typeof mod[fn] !== "function") throw new Error(`${fn} not found`);
      console.log(`   ${name}Agent: ✓`);
    }
  });

  // ===== 10. Check Existing Projects =====
  await test("Existing Projects", async () => {
    const projects = await prisma.project.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, status: true },
    });
    console.log(`   Found ${projects.length} projects`);
    projects.forEach((p) => console.log(`   - ${p.name}: ${p.status}`));
  });

  // ===== 11. Check Tasks =====
  await test("Task Status Distribution", async () => {
    const statusCounts = await prisma.task.groupBy({
      by: ["status"],
      _count: { status: true },
    });
    if (statusCounts.length === 0) {
      console.log("   No tasks found (this is OK for fresh deploy)");
    } else {
      statusCounts.forEach((s) =>
        console.log(`   ${s.status}: ${s._count.status}`)
      );
    }
  });

  // ===== 12. End-to-End: Create Test Project =====
  await test("E2E: Create Test Project", async () => {
    const testProject = await prisma.project.create({
      data: {
        name: `test-deploy-${Date.now()}`,
        status: "PLANNING",
        requirements: "Test project for deployment verification",
      },
    });
    console.log(`   Created project: ${testProject.id}`);

    // Create a test module
    const testModule = await prisma.module.create({
      data: {
        projectId: testProject.id,
        name: "test-module",
        status: "PLANNING",
      },
    });
    console.log(`   Created module: ${testModule.id}`);

    // Create a test task
    const testTask = await prisma.task.create({
      data: {
        moduleId: testModule.id,
        title: "Test Task",
        description: "Verify task creation works",
        requiredRole: "MidDev",
        status: "QUEUED",
        priority: 1,
      },
    });
    console.log(`   Created task: ${testTask.id}`);

    // Cleanup
    await prisma.task.delete({ where: { id: testTask.id } });
    await prisma.module.delete({ where: { id: testModule.id } });
    await prisma.project.delete({ where: { id: testProject.id } });
    console.log(`   Cleanup complete`);
  });

  // ===== Print Summary =====
  console.log("\n" + "=".repeat(70));
  console.log("📊 TEST SUMMARY");
  console.log("=".repeat(70));

  const passed = results.filter((r) => r.status === "PASS").length;
  const failed = results.filter((r) => r.status === "FAIL").length;

  results.forEach((r) => {
    const icon = r.status === "PASS" ? "✅" : r.status === "FAIL" ? "❌" : "⏭️";
    const timeStr = r.time ? ` (${r.time}ms)` : "";
    console.log(`${icon} ${r.name}${timeStr}`);
    if (r.status === "FAIL" && r.message) {
      console.log(`   Error: ${r.message}`);
    }
  });

  console.log("\n" + "-".repeat(70));
  console.log(`RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log("-".repeat(70));

  if (failed > 0) {
    console.log("\n⚠️  Some tests failed. Review before deployment.");
    process.exit(1);
  } else {
    console.log("\n🎉 All tests passed! Ready for deployment.");
    process.exit(0);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
