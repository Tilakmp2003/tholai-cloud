/**
 * Phase 8: Project Planner Service
 *
 * Analyzes PRD text and creates modules/tasks for a new project
 * Integrated with Architect Agent for creative system design.
 */

import { spawnAgents } from "./agentSpawner";
import {
  socraticInterrogator,
  InterrogationResult,
} from "../agents/socraticInterrogatorAgent";
import { architectAgent, ArchitectOutput } from "../agents/architectAgent";
import { gitIntegration } from "./gitIntegration";
import { generateDesignPackage } from "../agents/designerAgent";
import { approvalGates } from "./approvalGates";
import { Module } from "@prisma/client";
import { prisma } from "../lib/prisma";
import {
  analyzeProject,
  allocateAgentsForProject,
  getTotalAgentCount,
  AgentAllocation,
} from "./agentAllocator";
import { queryVectorDB } from "./ragService";
import { ModelConfig } from "./llmClient";
import {
  emitLog,
  emitModuleUpdate,
  emitTaskCreated,
} from "../websocket/socketServer";

/**
 * Phase 1 Task Filter
 *
 * Filters out tasks that are NOT needed for Phase 1 (building a working app).
 * Phase 1 = Frontend + Basic Backend functionality only.
 *
 * Excludes: DevOps, AWS, Cloud, CI/CD, Deployment, Security hardening, Infrastructure
 */
const PHASE1_EXCLUDED_KEYWORDS = [
  // DevOps & Infrastructure
  "devops",
  "infrastructure",
  "terraform",
  "ansible",
  "kubernetes",
  "k8s",
  "docker compose",
  "container orchestration",
  "helm",
  "argocd",
  // Cloud & AWS
  "aws",
  "azure",
  "gcp",
  "cloud",
  "ec2",
  "s3 bucket",
  "lambda",
  "cloudformation",
  "cloudwatch",
  "iam policy",
  "vpc",
  "load balancer",
  "auto-scaling",
  // CI/CD & Deployment
  "ci/cd",
  "cicd",
  "pipeline",
  "jenkins",
  "github actions",
  "deploy to",
  "deployment",
  "production deploy",
  "staging",
  "release pipeline",
  // Security (advanced)
  "security audit",
  "penetration test",
  "security hardening",
  "waf",
  "firewall",
  "ssl certificate",
  "https setup",
  "security scan",
  // Monitoring & Ops
  "monitoring setup",
  "alerting",
  "grafana",
  "prometheus",
  "datadog",
  "log aggregation",
  "apm",
  "observability infrastructure",
  // Database ops
  "database migration",
  "backup strategy",
  "disaster recovery",
  "replication",
];

const PHASE1_EXCLUDED_ROLES = [
  "DevOps",
  "DevOps Engineer",
  "Infrastructure Engineer",
  "Cloud Engineer",
  "Security Engineer",
  "SRE",
  "Site Reliability",
  "Platform Engineer",
  "Release Engineer",
  "Ops",
  "Operations",
];

function isPhase1Task(task: any): boolean {
  const title = (task.title || task.summary || "").toLowerCase();
  const description = (task.description || "").toLowerCase();
  const role = task.required_role || task.role || "";
  const phase = (task.phase || "").toLowerCase();

  // Exclude if phase name contains excluded keywords
  if (
    phase.includes("devops") ||
    phase.includes("infrastructure") ||
    phase.includes("deployment") ||
    phase.includes("security") ||
    phase.includes("monitoring") ||
    phase.includes("operations")
  ) {
    return false;
  }

  // Exclude if role is not Phase 1
  if (
    PHASE1_EXCLUDED_ROLES.some((r) =>
      role.toLowerCase().includes(r.toLowerCase())
    )
  ) {
    return false;
  }

  // Exclude if title/description contains excluded keywords
  const combined = title + " " + description;
  if (PHASE1_EXCLUDED_KEYWORDS.some((keyword) => combined.includes(keyword))) {
    return false;
  }

  return true;
}

/**
 * Map non-standard roles to available agent roles
 */
function normalizeRole(role: string): string {
  const roleLower = role.toLowerCase();

  // Frontend roles
  if (
    roleLower.includes("frontend") ||
    roleLower.includes("ui") ||
    roleLower.includes("react") ||
    roleLower.includes("vue")
  ) {
    return "MidDev";
  }

  // Backend roles
  if (
    roleLower.includes("backend") ||
    roleLower.includes("api") ||
    roleLower.includes("server") ||
    roleLower.includes("node")
  ) {
    return "SeniorDev";
  }

  // Senior/Lead roles
  if (
    roleLower.includes("senior") ||
    roleLower.includes("lead") ||
    roleLower.includes("architect")
  ) {
    return "SeniorDev";
  }

  // Junior roles
  if (roleLower.includes("junior") || roleLower.includes("intern")) {
    return "JuniorDev";
  }

  // QA roles
  if (
    roleLower.includes("qa") ||
    roleLower.includes("test") ||
    roleLower.includes("quality")
  ) {
    return "QA";
  }

  // Default to MidDev
  return "MidDev";
}

/**
 * Create modules and tasks from Architect's plan
 */
export async function createModulesFromArchitectPlan(
  projectId: string,
  architectOutput: ArchitectOutput
) {
  const modules: Module[] = [];
  const recommendedProposal =
    architectOutput.proposals.find(
      (p) => p.id === architectOutput.recommendedProposalId
    ) || architectOutput.proposals[0];

  if (!recommendedProposal) {
    console.warn(
      "[ProjectPlanner] No proposal found - creating fallback module with basic tasks"
    );

    // Create a fallback module with generic tasks
    const fallbackModule = await prisma.module.create({
      data: { projectId, name: "Core Implementation", status: "IN_PROGRESS" },
    });
    modules.push(fallbackModule);
    emitModuleUpdate(fallbackModule);

    // Create basic development tasks
    const fallbackTasks = [
      { title: "Setup project structure", role: "MidDev" },
      { title: "Implement core functionality", role: "MidDev" },
      { title: "Create UI components", role: "MidDev" },
      { title: "Add styling and layout", role: "MidDev" },
      { title: "Write tests", role: "QA" },
    ];

    for (const taskDef of fallbackTasks) {
      const newTask = await prisma.task.create({
        data: {
          moduleId: fallbackModule.id,
          title: taskDef.title,
          requiredRole: taskDef.role,
          status: "QUEUED",
          contextPacket: {
            description: `${taskDef.title} for the project`,
            fallback: true,
          },
        },
      });
      emitTaskCreated(newTask);
    }

    return modules;
  }

  // HARDENING: If proposal is BOLD, require explicit human approval
  let approvalStatus = "APPROVED";
  if (recommendedProposal.type === "BOLD") {
    console.log(
      `[ProjectPlanner] BOLD proposal selected. Flagging for Human Review.`
    );
    approvalStatus = "PENDING_REVIEW";
    // In a real system, this would trigger a notification to the user
    // For now, we just log it and potentially block auto-execution of tasks
  }

  console.log(
    `[ProjectPlanner] Selected Proposal: ${recommendedProposal.type} (${recommendedProposal.summary}) - Status: ${approvalStatus}`
  );

  // 4. Create modules and tasks from Architect's plan (Phased Execution)
  // We iterate through phases and create modules/tasks accordingly.
  // If the Architect didn't return phases (legacy fallback), we use the old logic.

  // PHASE 1 FILTER: Only create tasks that are needed for a working app
  // Skip DevOps, AWS, CI/CD, Deployment, Security hardening tasks
  let totalTasks = 0;
  let skippedTasks = 0;

  if (recommendedProposal.phases && recommendedProposal.phases.length > 0) {
    console.log(
      `[ProjectPlanner] Implementing Phased Execution Plan (${recommendedProposal.phases.length} phases)`
    );

    for (const phase of recommendedProposal.phases) {
      console.log(`[ProjectPlanner] Processing Phase: ${phase.name}`);

      // Create a "Phase Module" or group tasks by phase?
      // Better: Create modules based on components, but tag tasks with phases?
      // OR: Create a module for each phase if the phase is distinct (e.g. "Infrastructure").

      // Let's stick to Component-based Modules, but ensure tasks are created.
      // We'll iterate through tasks in the phase and assign them to modules.

      for (const taskDef of phase.tasks) {
        totalTasks++;

        // PHASE 1 FILTER: Skip non-Phase 1 tasks
        const taskWithPhase = { ...taskDef, phase: phase.name };
        if (!isPhase1Task(taskWithPhase)) {
          console.log(
            `[ProjectPlanner] ⏭️ Skipping non-Phase1 task: ${taskDef.title}`
          );
          skippedTasks++;
          continue;
        }

        // Find or create module for this task
        // If taskDef has 'module' or 'component' field, use it.
        // Otherwise, use a default module for the phase.

        const moduleName = taskDef.module || taskDef.component || phase.name;

        let projectModule = modules.find((m) => m.name === moduleName);
        if (!projectModule) {
          projectModule = await prisma.module.create({
            data: { projectId, name: moduleName, status: "IN_PROGRESS" },
          });
          modules.push(projectModule);
          emitModuleUpdate(projectModule);
        }

        // Normalize role to available agent roles
        const normalizedRole = normalizeRole(taskDef.required_role || "MidDev");

        const newTask = await prisma.task.create({
          data: {
            moduleId: projectModule.id,
            title: taskDef.title || "Implement task",
            requiredRole: normalizedRole,
            status: "QUEUED",
            contextPacket: {
              description: taskDef.description || taskDef.title,
              acceptanceCriteria: taskDef.acceptance_criteria,
              phase: phase.name, // Tag with phase
              designContext: {
                adr: architectOutput.adr,
                diagrams: architectOutput.diagrams,
                proposalType: recommendedProposal.type,
                tradeoffs: recommendedProposal.tradeoffs,
                dataStrategy: recommendedProposal.dataStrategy,
                riskAssessment: recommendedProposal.riskAssessment,
              },
            },
          },
        });
        emitTaskCreated(newTask);
      }
    }

    console.log(
      `[ProjectPlanner] Phase 1 Filter: Created ${
        totalTasks - skippedTasks
      } tasks, skipped ${skippedTasks} non-Phase1 tasks`
    );
  } else {
    // Legacy Fallback (Flat tasks list)
    console.log(
      "[ProjectPlanner] No phases detected. Using legacy flat task list."
    );

    // ... (Old logic for components/tasks) ...
    // For brevity, I'll just implement a simplified version of the old logic here
    // or we can assume the old logic was replaced.
    // Let's keep the old logic as a fallback path.

    for (const component of recommendedProposal.components) {
      // Check if this component is Phase 1 eligible (skip DevOps/AWS/Deploy components)
      const componentLower = component.toLowerCase();
      const isPhase1Component = ![
        "devops",
        "ci/cd",
        "aws",
        "deployment",
        "infrastructure",
        "kubernetes",
        "docker",
        "security",
      ].some((keyword) => componentLower.includes(keyword));

      if (!isPhase1Component) {
        console.log(
          `[ProjectPlanner] ⏭️ Skipping non-Phase1 component: ${component}`
        );
        skippedTasks++;
        continue;
      }

      const projectModule = await prisma.module.create({
        data: { projectId, name: component, status: "IN_PROGRESS" },
      });
      modules.push(projectModule);

      const relevantTasks = recommendedProposal.tasks.filter(
        (t: any) => t.module === component || !t.module
      );
      for (const taskDef of relevantTasks) {
        totalTasks++;

        // PHASE 1 FILTER: Skip non-Phase 1 tasks
        if (!isPhase1Task(taskDef)) {
          console.log(
            `[ProjectPlanner] ⏭️ Skipping non-Phase1 task: ${
              taskDef.title || taskDef.summary
            }`
          );
          skippedTasks++;
          continue;
        }

        // Normalize role to available agent roles
        const normalizedRole = normalizeRole(taskDef.required_role || "MidDev");

        const newTask = await prisma.task.create({
          data: {
            moduleId: projectModule.id,
            title:
              taskDef.summary || taskDef.title || "Implement component logic",
            requiredRole: normalizedRole,
            status: "QUEUED",
            contextPacket: {
              description: taskDef.description || taskDef.summary,
              acceptanceCriteria: taskDef.acceptance_criteria,
              designContext: {
                adr: architectOutput.adr,
                diagrams: architectOutput.diagrams,
                proposalType: recommendedProposal.type,
                tradeoffs: recommendedProposal.tradeoffs,
              },
            },
          },
        });
        emitTaskCreated(newTask);
      }
    }

    console.log(
      `[ProjectPlanner] Legacy path: Created tasks (Total: ${
        totalTasks - skippedTasks
      } created, ${skippedTasks} skipped for Phase 1)`
    );
  }

  return modules;
}

/**
 * Main function: analyze PRD → allocate agents → Architect Design → create modules → create tasks
 */
export async function planProject(
  projectId: string,
  description: string,
  domain?: string,
  skipInterrogation: boolean = false
) {
  console.log(`[ProjectPlanner] Planning project ${projectId}...`);

  // Step 0: Socratic Interrogation (if not skipped)
  let finalDescription = description;
  let interrogationResult: InterrogationResult | null = null;

  if (!skipInterrogation) {
    console.log("[ProjectPlanner] Running Socratic Interrogator...");
    interrogationResult = await socraticInterrogator.interrogateRequirements(
      projectId,
      description
    );

    if (!interrogationResult.isReady) {
      console.log(
        `[ProjectPlanner] ❓ Requirements need clarification (${interrogationResult.questions.length} questions)`
      );

      // Spawn a Team Lead and a skeleton crew to handle clarification and readiness
      console.log(
        "[ProjectPlanner] Spawning Team Lead and Skeleton Crew to handle clarification..."
      );
      await spawnAgents(projectId, {
        teamLead: 1,
        architect: 0,
        seniorDev: 0,
        midDev: 1,
        juniorDev: 1,
        qa: 0,
        security: 0,
        ops: 0,
      });

      return {
        needsClarification: true,
        interrogationResult,
        modules: [],
        plan: null,
        agentCount: 1,
        allocation: { teamLead: 1 },
      };
    }

    finalDescription = interrogationResult.clarifiedRequirements;
    console.log(
      `[ProjectPlanner] ✅ Requirements clarified (Ambiguity: ${(
        interrogationResult.ambiguityScore * 100
      ).toFixed(1)}%)`
    );
  }

  // Step 1: Analyze project requirements for agent allocation (Hardened)
  console.log(
    "[ProjectPlanner] Analyzing requirements for agent allocation..."
  );
  const allocResult = await allocateAgentsForProject(
    projectId,
    finalDescription
  );

  if (!allocResult.ok && allocResult.reason === "CooldownActive") {
    console.warn(
      "[ProjectPlanner] Allocation cooldown active. Using last allocation."
    );
    // Proceed with last allocation or default? For now, let's proceed.
  }

  const allocation = (allocResult.allocation ||
    allocResult.lastAlloc?.composition ||
    {}) as AgentAllocation; // Fallback
  const agentCount = getTotalAgentCount(allocation);

  // Step 2: Spawn agents
  console.log(`[ProjectPlanner] Spawning ${agentCount} agents for project...`);
  await spawnAgents(projectId, allocation);

  // Step 2.5: Designer Agent (Visual Direction)
  console.log(
    "[ProjectPlanner] 🎨 Designer Agent is creating the visual direction..."
  );
  let designContextString = "";
  try {
    // We create a temporary "task" context for the designer

    // Fetch Designer Agent Config
    const designerAgent = await prisma.agent.findFirst({
      where: { role: "Designer" },
    });
    const agentConfig = (designerAgent?.modelConfig as any)
      ?.primary as ModelConfig;

    if (!agentConfig) {
      console.warn(
        "[ProjectPlanner] Designer agent config not found. Skipping design phase."
      );
      throw new Error("Designer Agent not configured");
    }

    // RAG Retrieval
    const ragResult = await queryVectorDB(
      "Initial Design Direction " + finalDescription
    );
    const ragContext = ragResult.docs.map((d) => d.content).join("\n\n");

    const designPackage = await generateDesignPackage(
      projectId,
      "Project Plan",
      "Initial Design Direction",
      { goal: finalDescription },
      agentConfig,
      ragContext
    );

    designContextString = `
    VISUAL DESIGN DIRECTION: ${designPackage.recommendedDirection}
    USER JOURNEY: ${JSON.stringify(designPackage.userJourney)}
    WIREFRAMES: ${JSON.stringify(designPackage.wireframes)}
    DESIGN SYSTEM: ${JSON.stringify(designPackage.designSystem)}
    `;
    console.log(
      `[ProjectPlanner] Designer recommended: ${designPackage.recommendedDirection}`
    );
  } catch (err) {
    console.warn("[ProjectPlanner] Designer Agent failed (non-fatal):", err);
  }

  // Step 3: Architect Agent Design Phase
  console.log("[ProjectPlanner] 🏛️ Architect Agent is designing the system...");
  // Append design context to requirements so Architect considers it
  const architectRequirements = finalDescription + "\n\n" + designContextString;

  let architectOutput: ArchitectOutput;
  let modules: Module[] = [];

  try {
    architectOutput = await architectAgent.designSystem(
      projectId,
      architectRequirements
    );

    console.log(
      `[ProjectPlanner] Architect generated ${architectOutput.proposals.length} proposals. Recommended: ${architectOutput.recommendedProposalId}`
    );

    // Step 4: Create modules and tasks from Architect's plan
    modules = await createModulesFromArchitectPlan(projectId, architectOutput);
    console.log(
      `[ProjectPlanner] Created ${modules.length} modules based on architecture`
    );
  } catch (architectError: any) {
    console.error(
      "[ProjectPlanner] Architect Agent failed:",
      architectError.message
    );
    console.log("[ProjectPlanner] Using fallback module creation...");

    // Fallback: Create basic modules and tasks without Architect
    const fallbackModule = await prisma.module.create({
      data: {
        projectId,
        name: "Core Implementation",
        status: "IN_PROGRESS",
      },
    });
    modules.push(fallbackModule);
    emitModuleUpdate(fallbackModule);

    // Create basic development tasks based on description keywords
    const descLower = finalDescription.toLowerCase();
    const fallbackTasks: { title: string; role: string }[] = [
      { title: "Setup project structure and dependencies", role: "MidDev" },
      { title: "Create main application entry point", role: "MidDev" },
      { title: "Implement core UI layout and navigation", role: "MidDev" },
    ];

    // Add domain-specific tasks based on description
    if (
      descLower.includes("marketplace") ||
      descLower.includes("e-commerce") ||
      descLower.includes("shop")
    ) {
      fallbackTasks.push(
        { title: "Create product listing components", role: "MidDev" },
        { title: "Implement shopping cart functionality", role: "MidDev" },
        {
          title: "Build checkout flow with payment integration",
          role: "SeniorDev",
        },
        { title: "Create seller dashboard", role: "MidDev" },
        { title: "Implement order tracking system", role: "MidDev" }
      );
    } else if (
      descLower.includes("dashboard") ||
      descLower.includes("analytics")
    ) {
      fallbackTasks.push(
        { title: "Create dashboard layout with widgets", role: "MidDev" },
        { title: "Implement data visualization charts", role: "MidDev" },
        { title: "Build real-time data updates", role: "SeniorDev" }
      );
    } else if (
      descLower.includes("portfolio") ||
      descLower.includes("personal")
    ) {
      fallbackTasks.push(
        { title: "Create hero section with animations", role: "MidDev" },
        { title: "Build projects showcase grid", role: "MidDev" },
        { title: "Implement contact form", role: "MidDev" }
      );
    } else {
      fallbackTasks.push(
        { title: "Implement main feature functionality", role: "MidDev" },
        { title: "Create data models and state management", role: "MidDev" },
        { title: "Build form components with validation", role: "MidDev" }
      );
    }

    fallbackTasks.push(
      { title: "Add responsive styling and dark mode", role: "MidDev" },
      { title: "Write unit tests for core functionality", role: "QA" }
    );

    for (const taskDef of fallbackTasks) {
      const newTask = await prisma.task.create({
        data: {
          moduleId: fallbackModule.id,
          title: taskDef.title,
          requiredRole: taskDef.role,
          status: "QUEUED",
          contextPacket: {
            description: `${
              taskDef.title
            } based on project requirements: ${finalDescription.slice(0, 200)}`,
            fallback: true,
          },
        },
      });
      emitTaskCreated(newTask);
    }

    console.log(
      `[ProjectPlanner] Created fallback module with ${fallbackTasks.length} tasks`
    );

    // Create a dummy architectOutput for return
    architectOutput = {
      proposals: [],
      recommendedProposalId: "fallback",
      designRationale: "Fallback due to Architect failure",
    } as any;
  }

  // Step 5: Initialize Git repository
  // Poll for workspace path (up to 60 seconds)
  let project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { workspacePath: true, name: true },
  });

  let attempts = 0;
  while (!project?.workspacePath && attempts < 120) {
    console.log(
      `[ProjectPlanner] Waiting for workspace path... (${attempts + 1}/120)`
    );
    emitLog(
      `[System] Waiting for workspace initialization... (${attempts + 1}/120)`
    );
    await new Promise((resolve) => setTimeout(resolve, 1000));
    project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { workspacePath: true, name: true },
    });
    attempts++;
  }

  if (project?.workspacePath) {
    console.log("[ProjectPlanner] Initializing Git repository...");
    emitLog("[System] Initializing Git repository...");
    await gitIntegration.initRepo(project.workspacePath, project.name);

    // Configure approval gates for this project
    approvalGates.configureGates(projectId, approvalGates.getDefaultGates());
    emitLog(
      "[System] Git repository initialized and approval gates configured."
    );
  } else {
    console.warn(
      "[ProjectPlanner] Workspace path not found after timeout. Skipping Git init."
    );
    emitLog(
      "[System] Warning: Workspace initialization timed out. Git repository not initialized."
    );
  }

  return {
    needsClarification: false,
    interrogationResult,
    modules,
    plan: architectOutput, // Return full architect output as plan
    agentCount,
    allocation,
  };
}

/**
 * SIMPLE Project Planning - Phase 1
 *
 * Creates a working app quickly without complex architecture.
 * Focus: Build frontend UI that can be previewed immediately.
 *
 * Flow:
 * 1. Create simple module structure
 * 2. Generate practical frontend tasks
 * 3. Spawn minimal agents (MidDev, JuniorDev)
 * 4. Let agents build the app
 * 5. User previews and decides if changes needed
 */
export async function planProjectSimple(
  projectId: string,
  description: string,
  projectName: string
) {
  console.log(`[ProjectPlanner] 🚀 Simple planning for ${projectName}...`);
  emitLog(`[System] Starting simple project planning for ${projectName}...`);

  // Step 1: Spawn minimal agent team (just developers)
  const simpleAllocation = {
    teamLead: 1,
    architect: 0,
    seniorDev: 1,
    midDev: 3,
    juniorDev: 1,
    qa: 1,
    security: 0,
    ops: 0,
  };

  console.log("[ProjectPlanner] Spawning development team...");
  await spawnAgents(projectId, simpleAllocation);

  // Step 2: Create a single module for the app
  const mainModule = await prisma.module.create({
    data: {
      projectId,
      name: projectName,
      status: "IN_PROGRESS",
    },
  });
  emitModuleUpdate(mainModule);
  console.log(`[ProjectPlanner] Created module: ${mainModule.name}`);

  // Step 3: Analyze description and create practical tasks
  const descLower = description.toLowerCase();
  const tasks: {
    title: string;
    role: string;
    description: string;
    priority: number;
  }[] = [];

  // Core setup task (always first)
  tasks.push({
    title: "Setup project with Next.js and Tailwind CSS",
    role: "MidDev",
    description: `Initialize the ${projectName} project with Next.js 14, TypeScript, and Tailwind CSS. Create the basic folder structure with app/, components/, and lib/ directories. Install shadcn/ui for UI components.`,
    priority: 1,
  });

  // Layout task
  tasks.push({
    title: "Create main layout and navigation",
    role: "MidDev",
    description: `Create the main app layout with a responsive navigation bar, sidebar (if needed), and footer. Use Tailwind CSS for styling with dark mode support. The layout should be mobile-friendly.`,
    priority: 2,
  });

  // Determine app type and add specific tasks
  if (
    descLower.includes("marketplace") ||
    descLower.includes("e-commerce") ||
    descLower.includes("shop") ||
    descLower.includes("store")
  ) {
    // E-Commerce tasks
    tasks.push(
      {
        title: "Create product listing page with grid layout",
        role: "MidDev",
        description: `Build a product listing page that displays products in a responsive grid. Include product cards with image, title, price, and "Add to Cart" button. Add filtering by category and search functionality.`,
        priority: 3,
      },
      {
        title: "Build product detail page",
        role: "MidDev",
        description: `Create a product detail page showing product image gallery, title, description, price, quantity selector, and Add to Cart button. Include related products section.`,
        priority: 4,
      },
      {
        title: "Implement shopping cart functionality",
        role: "SeniorDev",
        description: `Build a shopping cart with React Context or Zustand for state management. Include cart sidebar/modal showing items, quantities, subtotal, and checkout button. Add ability to update quantities and remove items.`,
        priority: 5,
      },
      {
        title: "Create checkout page",
        role: "MidDev",
        description: `Build a checkout page with shipping address form, payment method selection (mock), and order summary. Include form validation and a "Place Order" button that shows success message.`,
        priority: 6,
      },
      {
        title: "Build seller dashboard",
        role: "MidDev",
        description: `Create a seller dashboard with: product management (add/edit/delete products), order list view, and basic analytics cards showing total sales and orders.`,
        priority: 7,
      }
    );
  } else if (
    descLower.includes("dashboard") ||
    descLower.includes("analytics") ||
    descLower.includes("admin")
  ) {
    // Dashboard tasks
    tasks.push(
      {
        title: "Create dashboard overview page with stat cards",
        role: "MidDev",
        description: `Build a dashboard overview page with stat cards showing key metrics (total users, revenue, orders, etc.). Use a grid layout with responsive design.`,
        priority: 3,
      },
      {
        title: "Add charts and data visualization",
        role: "MidDev",
        description: `Integrate Recharts or Chart.js to display line charts, bar charts, and pie charts. Show trends over time with mock data.`,
        priority: 4,
      },
      {
        title: "Build data table with sorting and filtering",
        role: "MidDev",
        description: `Create a reusable data table component with sorting, filtering, pagination, and search. Use TanStack Table for advanced features.`,
        priority: 5,
      }
    );
  } else if (
    descLower.includes("portfolio") ||
    descLower.includes("personal") ||
    descLower.includes("blog")
  ) {
    // Portfolio/Blog tasks
    tasks.push(
      {
        title: "Create hero section with animations",
        role: "MidDev",
        description: `Build an eye-catching hero section with animated text, profile image, and call-to-action buttons. Use Framer Motion for smooth animations.`,
        priority: 3,
      },
      {
        title: "Build projects showcase section",
        role: "MidDev",
        description: `Create a projects grid showing portfolio items with image, title, description, and tech stack tags. Add hover effects and links to live demos.`,
        priority: 4,
      },
      {
        title: "Add skills and experience section",
        role: "MidDev",
        description: `Build a skills section with technology icons and proficiency indicators. Add an experience timeline showing work history.`,
        priority: 5,
      },
      {
        title: "Create contact form",
        role: "MidDev",
        description: `Build a contact form with name, email, and message fields. Include form validation and a success message on submit.`,
        priority: 6,
      }
    );
  } else if (
    descLower.includes("todo") ||
    descLower.includes("task") ||
    descLower.includes("list")
  ) {
    // Todo/Task app tasks
    tasks.push(
      {
        title: "Create todo list UI with add/edit/delete",
        role: "MidDev",
        description: `Build a todo list interface with input field to add tasks, checkbox to mark complete, edit button, and delete button. Use local storage to persist tasks.`,
        priority: 3,
      },
      {
        title: "Add filtering and categories",
        role: "MidDev",
        description: `Add filter tabs (All, Active, Completed) and category tags. Allow users to organize tasks by category.`,
        priority: 4,
      }
    );
  } else if (
    descLower.includes("chat") ||
    descLower.includes("message") ||
    descLower.includes("slack") ||
    descLower.includes("discord")
  ) {
    // Chat app tasks
    tasks.push(
      {
        title: "Create chat interface with message list",
        role: "MidDev",
        description: `Build a chat interface with message list, input field, and send button. Messages should show sender avatar, name, timestamp, and content.`,
        priority: 3,
      },
      {
        title: "Add channels/rooms sidebar",
        role: "MidDev",
        description: `Create a sidebar showing available channels/rooms. Allow switching between channels with active state indicator.`,
        priority: 4,
      },
      {
        title: "Implement real-time message updates",
        role: "SeniorDev",
        description: `Add real-time message updates using WebSocket or polling. New messages should appear instantly without page refresh.`,
        priority: 5,
      }
    );
  } else {
    // Generic app tasks
    tasks.push(
      {
        title: "Create main feature page",
        role: "MidDev",
        description: `Build the main feature page based on the project requirements: ${description.slice(
          0,
          200
        )}. Focus on creating a clean, functional UI.`,
        priority: 3,
      },
      {
        title: "Add form components with validation",
        role: "MidDev",
        description: `Create reusable form components (input, select, checkbox, etc.) with validation using React Hook Form and Zod.`,
        priority: 4,
      },
      {
        title: "Build data display components",
        role: "MidDev",
        description: `Create components to display data: cards, lists, tables, and modals. Make them reusable and responsive.`,
        priority: 5,
      }
    );
  }

  // Final polish tasks (always added)
  tasks.push(
    {
      title: "Add responsive design and mobile optimization",
      role: "MidDev",
      description: `Ensure all pages work well on mobile devices. Add proper breakpoints, touch-friendly buttons, and responsive images.`,
      priority: 8,
    },
    {
      title: "Implement dark mode toggle",
      role: "JuniorDev",
      description: `Add a dark mode toggle button in the navigation. Use Tailwind's dark mode with class strategy. Persist preference in localStorage.`,
      priority: 9,
    }
  );

  // Step 4: Create tasks in database
  console.log(`[ProjectPlanner] Creating ${tasks.length} tasks...`);

  for (const taskDef of tasks) {
    const newTask = await prisma.task.create({
      data: {
        moduleId: mainModule.id,
        title: taskDef.title,
        requiredRole: taskDef.role,
        status: "QUEUED",
        contextPacket: {
          description: taskDef.description,
          projectName,
          projectDescription: description,
          techStack: ["Next.js", "TypeScript", "Tailwind CSS", "shadcn/ui"],
          priority: taskDef.priority, // Store priority in contextPacket instead
        },
      },
    });
    emitTaskCreated(newTask);
    console.log(`[ProjectPlanner] ✅ Created task: ${taskDef.title}`);
  }

  emitLog(
    `[System] Created ${tasks.length} tasks for ${projectName}. Agents will start building!`
  );

  return {
    success: true,
    modules: [mainModule],
    taskCount: tasks.length,
    agentCount: 7,
    message: `Created ${tasks.length} tasks. Your app will be ready for preview soon!`,
  };
}
