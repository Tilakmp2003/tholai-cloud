import fetch from 'node-fetch';

async function testCreateProject() {
  console.log("🚀 Testing E2E Project Creation (Detailed)...");

  const payload = {
    name: "E2E Test Project " + Date.now(),
    clientName: "Test Client",
    description: `
      Build a comprehensive Fitness Tracking SaaS Dashboard.
      
      **Target Audience:** Personal trainers and their clients.
      
      **Core Features:**
      1. **User Authentication:** Email/password login using Clerk. Two roles: Trainer and Client.
      2. **Dashboard:** 
         - Trainers see a list of clients and their recent activity.
         - Clients see their daily workout plan and progress charts.
      3. **Workout Logger:** Simple form to log sets, reps, and weight.
      4. **Progress Analytics:** Line charts showing weight lifted over time (using Recharts).
      5. **Goal Setting:** Ability to set weekly targets.
      
      **Technical Requirements:**
      - Frontend: Next.js 14 (App Router), Tailwind CSS, Lucide Icons.
      - Backend: Node.js, Prisma, PostgreSQL.
      - Design: Clean, minimalist, "Apple Health" vibe. Dark mode support.
      
      **Constraints:**
      - Must be mobile-responsive.
      - Use Shadcn/UI components.
    `,
    domain: "SAAS"
  };

  try {
    const response = await fetch('http://localhost:4000/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (response.status === 201) {
      console.log("✅ Project created successfully!");
      console.log("Project ID:", data.project.id);
      console.log("Message:", data.message);
    } else {
      console.error("❌ Failed to create project:", data);
    }

  } catch (error) {
    console.error("❌ Error connecting to backend:", error);
  }
}

testCreateProject();
