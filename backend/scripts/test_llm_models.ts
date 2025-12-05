/**
 * LLM Model Test Suite
 * Tests all configured AI providers without database dependency
 */

// Load environment variables
import * as dotenv from "dotenv";
dotenv.config();

import { callLLM } from "../src/llm/llmClient";
import { ModelConfig } from "../src/llm/types";

interface TestResult {
  name: string;
  status: "PASS" | "FAIL";
  time?: number;
  message?: string;
  response?: string;
}

const results: TestResult[] = [];

async function testProvider(
  name: string,
  config: ModelConfig,
  prompt: string
): Promise<boolean> {
  console.log(`\n🧪 Testing ${name}...`);
  console.log(`   Provider: ${config.provider}`);
  console.log(`   Model: ${config.model}`);
  if (config.region) console.log(`   Region: ${config.region}`);

  try {
    const start = Date.now();
    const response = await callLLM(config, [
      {
        role: "system",
        content:
          "You are a helpful assistant. Be very concise - respond in 1-2 sentences max.",
      },
      { role: "user", content: prompt },
    ]);
    const time = Date.now() - start;

    if (response.content && response.content.length > 0) {
      const preview = response.content.substring(0, 150).replace(/\n/g, " ");
      console.log(`   ✅ PASS (${time}ms)`);
      console.log(
        `   Response: ${preview}${response.content.length > 150 ? "..." : ""}`
      );
      results.push({
        name,
        status: "PASS",
        time,
        message: `${response.content.length} chars`,
        response: preview,
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
  console.log("\n" + "=".repeat(70));
  console.log("🤖 LLM MODEL TEST SUITE");
  console.log("=".repeat(70));
  console.log("Testing all AI providers configured for your agents...\n");

  // ===== 1. Bedrock DeepSeek R1 (Brains - for strategic roles) =====
  const bedrockR1Config: ModelConfig = {
    provider: "bedrock",
    model: "deepseek.r1-v1:0",
    maxTokens: 256,
    temperature: 0.2,
    region: "us-east-1",
  };
  await testProvider(
    "Bedrock DeepSeek R1 (Brains - HeadAgent/TeamLead/Architect)",
    bedrockR1Config,
    "What is 15 + 27? Just give the number."
  );

  // ===== 2. Bedrock DeepSeek V3 (Hands - for execution tasks) =====
  const bedrockV3Config: ModelConfig = {
    provider: "bedrock",
    model: "deepseek.v3-v1:0",
    maxTokens: 256,
    temperature: 0.3,
    region: "ap-south-1",
  };
  await testProvider(
    "Bedrock DeepSeek V3 (Hands - MidDev/JuniorDev/QA)",
    bedrockV3Config,
    'Write a TypeScript function called "add" that takes two numbers and returns their sum. Just the code, no explanation.'
  );

  // ===== 3. Gemini (Fallback) =====
  if (process.env.GEMINI_API_KEY) {
    const geminiConfig: ModelConfig = {
      provider: "gemini",
      model: "gemini-2.0-flash",
      maxTokens: 256,
      temperature: 0.3,
    };
    await testProvider(
      "Gemini 2.0 Flash (Fallback)",
      geminiConfig,
      'Say "Hello, TholAI is ready!" in exactly those words.'
    );
  } else {
    console.log("\n🧪 Testing Gemini 2.0 Flash (Fallback)...");
    console.log("   ⏭️  SKIP - No GEMINI_API_KEY in environment");
  }

  // ===== 4. Groq Llama (Fast inference) =====
  if (process.env.GROQ_API_KEY) {
    const groqConfig: ModelConfig = {
      provider: "groq",
      model: "llama-3.3-70b-versatile",
      maxTokens: 256,
      temperature: 0.3,
    };
    await testProvider(
      "Groq Llama 3.3 70B (Fast Inference)",
      groqConfig,
      "What programming language is TypeScript based on?"
    );
  } else {
    console.log("\n🧪 Testing Groq Llama 3.3 70B...");
    console.log("   ⏭️  SKIP - No GROQ_API_KEY in environment");
  }

  // ===== 5. OpenRouter DeepSeek (Alternative) =====
  if (process.env.OPENROUTER_API_KEY) {
    const openrouterConfig: ModelConfig = {
      provider: "openrouter",
      model: "deepseek/deepseek-chat",
      maxTokens: 256,
      temperature: 0.3,
    };
    await testProvider(
      "OpenRouter DeepSeek Chat (Alternative)",
      openrouterConfig,
      "Name one benefit of using TypeScript over JavaScript."
    );
  } else {
    console.log("\n🧪 Testing OpenRouter DeepSeek...");
    console.log("   ⏭️  SKIP - No OPENROUTER_API_KEY in environment");
  }

  // ===== Print Summary =====
  console.log("\n" + "=".repeat(70));
  console.log("📊 TEST SUMMARY");
  console.log("=".repeat(70));

  const passed = results.filter((r) => r.status === "PASS").length;
  const failed = results.filter((r) => r.status === "FAIL").length;

  results.forEach((r) => {
    const icon = r.status === "PASS" ? "✅" : "❌";
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
    console.log(
      "\n⚠️  Some LLM providers failed. Check your API keys and network."
    );

    // Provide guidance
    if (
      results.find((r) => r.name.includes("Bedrock") && r.status === "FAIL")
    ) {
      console.log("\n💡 Bedrock Issues:");
      console.log("   - Check AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY");
      console.log(
        "   - Ensure you have Bedrock model access enabled in AWS Console"
      );
      console.log(
        "   - Verify the regions (us-east-1 for R1, ap-south-1 for V3)"
      );
    }

    process.exit(1);
  } else {
    console.log("\n🎉 All LLM providers working! Ready for deployment.");
    process.exit(0);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
