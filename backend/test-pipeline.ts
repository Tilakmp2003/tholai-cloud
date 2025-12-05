/**
 * Pipeline Functionality Test
 */

import { prisma } from "./src/lib/prisma";
import { analyzeProject, allocateAgents } from "./src/services/agentAllocator";
import { callLLM } from "./src/llm/llmClient";
import { getAgentConfig } from "./src/llm/modelRegistry";

async function testPipeline() {
  console.log("🧪 PIPELINE FUNCTIONALITY TEST\n");
  console.log("=".repeat(60));

  // 1. Test Model Registry
  console.log("\n📋 1. Testing Model Registry...");
  const roles = ["TeamLead", "Architect", "MidDev", "QA"];
  for (const role of roles) {
    const config = await getAgentConfig(role);
    console.log(`   ${role}: ${config.provider}/${config.model} (${config.region})`);
  }

  // 2. Test LLM Call
  console.log("\n🤖 2. Testing LLM Call (DeepSeek V3)...");
  const startTime = Date.now();
  try {
    const config = await getAgentConfig("TeamLead");
    const response = await callLLM(config, [
      { role: "system", content: "You are a helpful assistant. Respond with valid JSON only." },
      { role: "user", content: 'Return JSON: {"status": "ok", "model": "DeepSeek V3"}' }
    ]);
    const elapsed = Date.now() - startTime;
    console.log(`   ✅ Response in ${elapsed}ms: ${response.content.substring(0, 100)}`);
  } catch (err: any) {
    console.log(`   ❌ LLM Error: ${err.message}`);
  }

  // 3. Test Project Analysis
  console.log("\n📊 3. Testing Project Analysis...");
  const testPRD = `
    Build a simple todo list app with:
    - Add todo items
    - Mark as complete
    - Delete items
    - Filter by status
  `;
  try {
    const analysis = await analyzeProject(testPRD);
    console.log(`   Features: ${analysis.features}`);
    console.log(`   Modules: ${analysis.modules}`);
    console.log(`   Complexity: ${analysis.complexityScore}`);
    
    // 4. Test Agent Allocation
    console.log("\n👥 4. Testing Agent Allocation...");
    const allocation = allocateAgents(analysis);
    const total = Object.values(allocation).reduce((a: number, b: number) => a + b, 0);
    console.log(`   Allocation: ${JSON.stringify(allocation)}`);
    console.log(`   Total agents: ${total}`);
  } catch (err: any) {
    console.log(`   ❌ Error: ${err.message}`);
  }

  // 5. Check Database Connection
  console.log("\n🗄️  5. Testing Database...");
  try {
    const projectCount = await prisma.project.count();
    const agentCount = await prisma.agent.count();
    const taskCount = await prisma.task.count();
    console.log(`   Projects: ${projectCount}, Agents: ${agentCount}, Tasks: ${taskCount}`);
  } catch (err: any) {
    console.log(`   ❌ DB Error: ${err.message}`);
  }

  console.log("\n" + "=".repeat(60));
  console.log("🏁 Pipeline test complete!\n");

  await prisma.$disconnect();
}

testPipeline().catch(console.error);
