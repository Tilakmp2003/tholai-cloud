import { planProject } from '../services/projectPlanner';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testDirectPlanning() {
  console.log("🚀 Testing Direct Project Planning (Skipping Interrogation)...");

  // Create a dummy project first
  const project = await prisma.project.create({
    data: {
      name: "Direct Plan Test " + Date.now(),
      clientName: "Test Client",
      description: "A fitness tracking app.",
      domain: "SAAS",
      status: "IN_PROGRESS"
    }
  });

  console.log(`Created Project: ${project.id}`);

  try {
    // Call planProject with skipInterrogation = true
    const result = await planProject(
      project.id,
      "Build a fitness tracking app with user auth, workout logging, and progress charts. Tech stack: React, Node, Postgres.",
      "SAAS",
      true // skipInterrogation
    );

    console.log("✅ Planning Result:", JSON.stringify(result, null, 2));

  } catch (error) {
    console.error("❌ Error in planning:", error);
  } finally {
    await prisma.$disconnect();
  }
}

testDirectPlanning();
