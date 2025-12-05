/**
 * Pre-Deployment Test Suite
 * Tests all LLM providers and critical system components before deployment
 */

import { PrismaClient } from "@prisma/client";
import { callLLM } from "../src/llm/llmClient";
import {
  getDefaultModelConfig,
  getAgentConfig,
} from "../src/llm/modelRegistry";
import { ModelConfig } from "../src/llm/types";

const prisma = new PrismaClient();

interface TestResult {
  name: string;
  status: "PASS" | "FAIL" | "SKIP";
  time?: number;
  message?: string;
}

const results: TestResult[] = [];

async function testProvider(
  name: string,
  config: ModelConfig,
  prompt: string
): Promise<boolean> {
  console.log(`\n🧪 Testing ${name}...`);
  console.log(`   Provider: ${config.provider}, Model: ${config.model}`);
  if (config.region) console.log(`   Region: ${config.region}`);

  try {
    const start = Date.now();
    const response = await callLLM(config, [
      { role: "system", content: "You are a helpful assistant. Be concise." },
      { role: "user", content: prompt },
    ]);
    const time = Date.now() - start;

    if (response.content && response.content.length > 0) {
      console.log(`   ✅ PASS (${time}ms)`);
      console.log(
        `   Response preview: ${response.content
          .substring(0, 100)
          .replace(/\n/g, " ")}...`
      );
      results.push({
        name,
        status: "PASS",
        time,
        message: `Got ${response.content.length} chars`,
      });
      return true;
    } else {
      console.log(`   ❌ FAIL - Empty response`);
      results.push({ name, status: "FAIL", time, message: "Empty response" });
      return false;
    }
  } catch (error: any) {
    console.log(`   ❌ FAIL - ${error.message}`);
    results.push({ name, status: "FAIL", message: error.message });
    return false;
  }
}

async function main() {
  console.log("\n" + "=".repeat(60));
  console.log("🚀 PRE-DEPLOYMENT TEST SUITE");
  console.log("=".repeat(60));

  // ===== 1. Database Connection =====
  console.log("\n📊 TEST 1: Database Connection...");
  try {
    await prisma.$connect();
    const agentCount = await prisma.agent.count();
    const projectCount = await prisma.project.count();
    console.log(`   ✅ PASS - Connected to database`);
    console.log(`   Agents: ${agentCount}, Projects: ${projectCount}`);
    results.push({
      name: "Database Connection",
      status: "PASS",
      message: `${agentCount} agents, ${projectCount} projects`,
    });
  } catch (error: any) {
    console.log(`   ❌ FAIL - ${error.message}`);
    results.push({
      name: "Database Connection",
      status: "FAIL",
      message: error.message,
    });
  }

  // ===== 2. Check Agent Configurations =====
  console.log("\n📋 TEST 2: Agent Configurations...");
  const agents = await prisma.agent.findMany({
    select: { id: true, role: true, modelConfig: true, status: true },
  });

  if (agents.length === 0) {
    console.log(
      `   ⚠️  No agents found! Run: npx tsx scripts/seed_agent_models.ts`
    );
    results.push({
      name: "Agent Configurations",
      status: "FAIL",
      message: "No agents found",
    });
  } else {
    console.log(`   ✅ Found ${agents.length} agents`);
    const byProvider: Record<string, string[]> = {};
    agents.forEach((agent) => {
      const config = agent.modelConfig as any;
      const provider = config?.provider || "unknown";
      if (!byProvider[provider]) byProvider[provider] = [];
      byProvider[provider].push(agent.role);
    });

    Object.entries(byProvider).forEach(([provider, roles]) => {
      console.log(`   ${provider}: ${roles.join(", ")}`);
    });
    results.push({
      name: "Agent Configurations",
      status: "PASS",
      message: `${agents.length} agents configured`,
    });
  }

  // ===== 3. Test Bedrock DeepSeek R1 (Brains) =====
  const bedrockR1Config: ModelConfig = {
    provider: "bedrock",
    model: "us.deepseek.r1-v1:0",
    maxTokens: 512,
    temperature: 0.2,
    region: "us-east-1",
  };
  await testProvider(
    "Bedrock DeepSeek R1 (Brains)",
    bedrockR1Config,
    "What is 2+2? Answer with just the number."
  );

  // ===== 4. Test Bedrock DeepSeek V3 (Hands) =====
  const bedrockV3Config: ModelConfig = {
    provider: "bedrock",
    model: "deepseek.deepseek-v3:1",
    maxTokens: 512,
    temperature: 0.3,
    region: "ap-south-1",
  };
  await testProvider(
    "Bedrock DeepSeek V3 (Hands)",
    bedrockV3Config,
    "Write a one-line TypeScript function to double a number."
  );

  // ===== 5. Test Gemini Fallback =====
  if (process.env.GEMINI_API_KEY) {
    const geminiConfig: ModelConfig = {
      provider: "gemini",
      model: "gemini-2.0-flash",
      maxTokens: 512,
      temperature: 0.3,
    };
    await testProvider(
      "Gemini Fallback",
      geminiConfig,
      "Say hello in one word."
    );
  } else {
    console.log("\n🧪 Testing Gemini Fallback...");
    console.log("   ⏭️  SKIP - No GEMINI_API_KEY set");
    results.push({
      name: "Gemini Fallback",
      status: "SKIP",
      message: "No API key",
    });
  }

  // ===== 6. Test Groq (if available) =====
  if (process.env.GROQ_API_KEY) {
    const groqConfig: ModelConfig = {
      provider: "groq",
      model: "llama-3.3-70b-versatile",
      maxTokens: 512,
      temperature: 0.3,
    };
    await testProvider("Groq Llama 3.3", groqConfig, "What is JavaScript?");
  } else {
    console.log("\n🧪 Testing Groq Llama 3.3...");
    console.log("   ⏭️  SKIP - No GROQ_API_KEY set");
    results.push({
      name: "Groq Llama 3.3",
      status: "SKIP",
      message: "No API key",
    });
  }

  // ===== 7. Test Agent Config Retrieval =====
  console.log("\n📋 TEST: Agent Config Retrieval...");
  const roles = ["Architect", "TeamLead", "MidDev", "SeniorDev", "QA"];
  let configsValid = true;

  for (const role of roles) {
    try {
      const config = await getAgentConfig(role);
      console.log(`   ${role}: ${config.provider}/${config.model}`);
    } catch (error: any) {
      console.log(`   ${role}: ❌ ${error.message}`);
      configsValid = false;
    }
  }

  results.push({
    name: "Agent Config Retrieval",
    status: configsValid ? "PASS" : "FAIL",
    message: configsValid ? "All configs retrieved" : "Some configs missing",
  });

  // ===== 8. Check Task Dispatcher =====
  console.log("\n📋 TEST: Task Dispatcher Module...");
  try {
    const { dispatchTasks } = await import("../src/services/taskDispatcher");
    console.log("   ✅ Task Dispatcher module loads correctly");
    results.push({ name: "Task Dispatcher Module", status: "PASS" });
  } catch (error: any) {
    console.log(`   ❌ FAIL - ${error.message}`);
    results.push({
      name: "Task Dispatcher Module",
      status: "FAIL",
      message: error.message,
    });
  }

  // ===== 9. Check WebSocket Module =====
  console.log("\n📋 TEST: WebSocket Module...");
  try {
    const { emitTaskUpdate, emitAgentUpdate } = await import(
      "../src/websocket/socketServer"
    );
    console.log("   ✅ WebSocket module loads correctly");
    results.push({ name: "WebSocket Module", status: "PASS" });
  } catch (error: any) {
    console.log(`   ❌ FAIL - ${error.message}`);
    results.push({
      name: "WebSocket Module",
      status: "FAIL",
      message: error.message,
    });
  }

  // ===== Print Summary =====
  console.log("\n" + "=".repeat(60));
  console.log("📊 TEST SUMMARY");
  console.log("=".repeat(60));

  const passed = results.filter((r) => r.status === "PASS").length;
  const failed = results.filter((r) => r.status === "FAIL").length;
  const skipped = results.filter((r) => r.status === "SKIP").length;

  results.forEach((r) => {
    const icon = r.status === "PASS" ? "✅" : r.status === "FAIL" ? "❌" : "⏭️";
    const timeStr = r.time ? ` (${r.time}ms)` : "";
    console.log(
      `${icon} ${r.name}${timeStr}${r.message ? ` - ${r.message}` : ""}`
    );
  });

  console.log("\n" + "-".repeat(60));
  console.log(`PASSED: ${passed} | FAILED: ${failed} | SKIPPED: ${skipped}`);
  console.log("-".repeat(60));

  if (failed > 0) {
    console.log("\n⚠️  Some tests failed. Please review before deployment.");
    process.exit(1);
  } else {
    console.log("\n🎉 All critical tests passed! Ready for deployment.");
    process.exit(0);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
