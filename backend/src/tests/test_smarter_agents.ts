import { PrismaClient } from '@prisma/client';
import { dispatchLoop } from '../orchestrator/dispatcher';
import { TeamLeadAgent } from '../agents/teamLeadAgent';
import { MidDevAgent } from '../agents/midDevAgent';
import * as llmClient from '../llm/llmClient';

const prisma = new PrismaClient();

// Enable Mock Mode
process.env.USE_MOCK_LLM = 'true';

async function testSmarterAgents() {
  console.log("🧪 Testing Smarter Agents Flow...");

  // 1. Setup: Create Project, Module, Agent
  const project = await prisma.project.create({
    data: { name: "Smart Agent Test", clientName: "Test Corp" }
  });
  
  const module = await prisma.module.create({
    data: { name: "Auth", projectId: project.id }
  });

  const devAgent = await prisma.agent.create({
    data: { role: "MidDev", status: "IDLE", specialization: "Backend" }
  });

  // 2. Create Task (Simulate Dev submitted it)
  const task = await prisma.task.create({
    data: {
      moduleId: module.id,
      title: "Implement Login",
      requiredRole: "MidDev",
      status: "IN_PROGRESS", // Initially assigned
      assignedToAgentId: devAgent.id,
      ownerAgentId: devAgent.id // Sticky owner
    }
  });

  console.log(`[Test] Task Created: ${task.id} (Owner: ${devAgent.id})`);

  // 3. Simulate Team Lead Review -> REQUEST_CHANGES
  console.log("[Test] Simulating Team Lead Review...");
  const tlAgent = new TeamLeadAgent();
  const reviewResult = await tlAgent.reviewTask(task, {}, []);
  
  console.log("[Test] TL Decision:", reviewResult.decision);

  if (reviewResult.decision === "REQUEST_CHANGES") {
    await prisma.task.update({
        where: { id: task.id },
        data: {
            status: "NEEDS_REVISION", // Mapped from CHANGES_REQUESTED
            reviewDecision: "REQUEST_CHANGES",
            reviewFeedback: reviewResult.feedback
        }
    });
  }

  // 4. Verify Task Status
  const reviewedTask = await prisma.task.findUnique({ where: { id: task.id } });
  console.log(`[Test] Task Status after Review: ${reviewedTask?.status}`);

  // 5. Run Dispatcher (Should pick sticky owner)
  console.log("[Test] Running Dispatcher (Sticky Check)...");
  // Ensure agent is IDLE
  await prisma.agent.update({ where: { id: devAgent.id }, data: { status: "IDLE" } });
  
  await dispatchLoop(prisma);

  const reAssignedTask = await prisma.task.findUnique({ where: { id: task.id } });
  console.log(`[Test] Task Re-assigned to: ${reAssignedTask?.assignedToAgentId}`);

  if (reAssignedTask?.assignedToAgentId === devAgent.id) {
    console.log("✅ Sticky Assignment Verified!");
  } else {
    console.error("❌ Sticky Assignment Failed!");
  }

  // Cleanup
  await prisma.task.deleteMany({ where: { moduleId: module.id } });
  await prisma.module.delete({ where: { id: module.id } });
  await prisma.project.delete({ where: { id: project.id } });
  await prisma.agent.delete({ where: { id: devAgent.id } });
}

testSmarterAgents()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
