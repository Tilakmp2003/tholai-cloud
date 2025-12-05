import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function seedAgents() {
  // All agents now use DeepSeek V3 in ap-south-1 for consistent, clean JSON output
  const agents = [
    {
      role: "Architect",
      specialization: "System Design & Tech Stack",
      model: "deepseek.v3-v1:0",
      provider: "bedrock",
      region: "ap-south-1",
    },
    {
      role: "SeniorDev",
      specialization: "Core Logic & Security",
      model: "deepseek.v3-v1:0",
      provider: "bedrock",
      region: "ap-south-1",
    },
    {
      role: "MidDev",
      specialization: "Feature Implementation",
      model: "deepseek.v3-v1:0",
      provider: "bedrock",
      region: "ap-south-1",
    },
    {
      role: "TeamLead",
      specialization: "Coordination & Review",
      model: "deepseek.v3-v1:0",
      provider: "bedrock",
      region: "ap-south-1",
    },
    {
      role: "Designer",
      specialization: "UI/UX & CSS",
      model: "deepseek.v3-v1:0",
      provider: "bedrock",
      region: "ap-south-1",
    },
    {
      role: "QA",
      specialization: "Testing & Validation",
      model: "deepseek.v3-v1:0",
      provider: "bedrock",
      region: "ap-south-1",
    },
    {
      role: "AgentOps",
      specialization: "DevOps & Deployment",
      model: "deepseek.v3-v1:0",
      provider: "bedrock",
      region: "ap-south-1",
    },
    {
      role: "Canary",
      specialization: "System Health Check",
      model: "deepseek.v3-v1:0",
      provider: "bedrock",
      region: "ap-south-1",
    },
    {
      role: "TestGenerator",
      specialization: "Test Case Creation",
      model: "deepseek.v3-v1:0",
      provider: "bedrock",
      region: "ap-south-1",
    },
  ];

  console.log("🌱 Seeding Agents...");

  for (const agent of agents) {
    await prisma.agent.upsert({
      where: { id: agent.role }, // Using role as ID for simplicity in seed, or we can query by role
      update: {
        modelConfig: {
          provider: agent.provider,
          model: agent.model,
          temperature: 0.7,
          region: agent.region,
        },
      },
      create: {
        id: agent.role, // Force ID to match role for easy reference
        role: agent.role,
        specialization: agent.specialization,
        status: "IDLE",
        score: 100,
        riskLevel: "LOW",
        modelConfig: {
          provider: agent.provider,
          model: agent.model,
          temperature: 0.7,
          region: agent.region,
        },
      },
    });
  }

  console.log("✅ Agents Seeded!");
  return { success: true, count: agents.length };
}
