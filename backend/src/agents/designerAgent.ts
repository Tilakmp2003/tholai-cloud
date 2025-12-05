import { invokeModel, ModelConfig } from "../services/llmClient";
import { queryVectorDB } from "../services/ragService";
import { checkBudget } from "../services/preflightService";
import { randomUUID } from "crypto";
import { emitTaskUpdate, emitAgentUpdate } from "../websocket/socketServer";
import { prisma } from "../lib/prisma";

const SYSTEM_PROMPT = `
You are a World-Class Product Designer and Creative Director (ex-Apple, ex-Airbnb).
Your goal is to design beautiful, functional, and accessible user interfaces that delight users.
You balance aesthetic excellence with engineering feasibility.

You will be given a Design Brief (from a Socratic Interrogator session) and RAG Context.
Your job is to produce a comprehensive **Design Package**.

You must provide THREE distinct visual directions (e.g., "Minimalist/Clean", "Playful/Vibrant", "Enterprise/Trust"),
but ultimately recommend ONE primary direction for implementation.

For the recommended direction, you must generate:
1. **User Journey**: Key steps, entry/exit points.
2. **Wireframes**: ASCII or Mermaid.js representations of key screens.
3. **Component Inventory**: JSON list of required UI components (e.g., "HeroCard", "NavHeader").
4. **Design System**: Color palette (Tailwind classes), typography, spacing, shadows.
5. **User Flow**: Mermaid.js diagram of the core flow.
6. **Component Stubs**: React/Tailwind code stubs for 2-3 core components.
7. **Accessibility Check**: WCAG contrast notes, ARIA requirements.
8. **Design Confidence**: Score (0-100) and reasoning.

Return ONLY valid JSON matching the schema below.
`;

export interface DesignComponentStub {
  name: string;
  description: string;
  props: Record<string, string>;
  codeStub: string; // React/Tailwind code
}

export interface DesignSystem {
  colors: { name: string; value: string; tailwind: string }[];
  typography: { family: string; sizes: Record<string, string> };
  spacing: Record<string, string>;
  shadows: Record<string, string>;
}

export interface DesignDirection {
  name: string;
  description: string;
  vibe: string; // e.g., "Professional", "Playful"
  colorPalette: string[];
}

export interface DesignPackageContent {
  id: string;
  recommendedDirection: string; // Name of the selected direction
  directions: DesignDirection[];
  userJourney: { step: string; action: string; outcome: string }[];
  wireframes: { screenName: string; description: string; content: string }[]; // ASCII or Mermaid
  componentInventory: {
    name: string;
    purpose: string;
    complexity: "Low" | "Medium" | "High";
  }[];
  designSystem: DesignSystem;
  userFlowMermaid: string;
  componentStubs: DesignComponentStub[];
  accessibilityReport: { pass: boolean; issues: string[]; notes: string };
  designConfidence: number;
  requiresHumanReview: boolean; // True if confidence < 80 or "BOLD" choices
}

export async function generateDesignPackage(
  projectId: string,
  projectName: string,
  taskTitle: string,
  designBrief: any,
  agentConfig: ModelConfig,
  ragContext: string
): Promise<DesignPackageContent> {
  const prompt = `
    Project: ${projectName}
    Task: ${taskTitle}
    Design Brief: ${JSON.stringify(designBrief, null, 2)}
    
    RAG Context:
    ${ragContext}
    
    Generate the Design Package JSON.
  `;

  const response = await invokeModel(agentConfig, SYSTEM_PROMPT, prompt);

  let designPackageContent: DesignPackageContent;
  try {
    let content = response.text.trim();
    const jsonStart = content.indexOf("{");
    const jsonEnd = content.lastIndexOf("}");
    if (jsonStart !== -1 && jsonEnd !== -1) {
      content = content.substring(jsonStart, jsonEnd + 1);
    }
    designPackageContent = JSON.parse(content);
  } catch (e) {
    console.error("[Designer] Failed to parse JSON:", response.text);
    throw new Error("Failed to parse Design Package JSON");
  }

  // Create DesignPackage record
  await (prisma as any).designPackage.create({
    data: {
      projectId,
      artifactRef: `artifact://design-package-${randomUUID()}.json`, // Mock ref
      metadata: designPackageContent as any,
    },
  });

  return designPackageContent;
}

export async function runDesignerAgentOnce() {
  // 1. Find a task assigned to DESIGNER or a generic 'design' task
  const tasks = await prisma.task.findMany({
    where: {
      requiredRole: { in: ["DESIGNER", "Designer", "designer"] },
      status: { in: ["QUEUED", "ASSIGNED"] },
      assignedToAgentId: null,
    },
    include: {
      module: {
        include: {
          project: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
    take: 1,
  });

  if (tasks.length === 0) return null;
  const task = tasks[0] as any;

  if (!task.module || !task.module.project) {
    console.error(`[Designer] Task ${task.id} has no associated project`);
    return null;
  }
  const projectId = task.module.project.id;

  // 2. Find the Designer Agent (Seeded)
  const agent = await prisma.agent.findFirst({
    where: { role: { in: ["Designer", "DESIGNER", "designer"] } },
  });

  if (!agent) {
    console.error("[Designer] No Designer agent found in DB. Please run seed.");
    return null;
  }

  // Claim task
  await prisma.task.update({
    where: { id: task.id },
    data: {
      status: "IN_PROGRESS",
      assignedToAgentId: agent.id,
    },
  });

  console.log(`[Designer] Starting task: ${task.title}`);

  try {
    // 3. Prepare Context & RAG
    const contextPacket = task.contextPacket as any;
    const designBrief =
      contextPacket?.designBrief || task.description || "No brief provided";

    // RAG Retrieval
    const ragResult = await queryVectorDB(
      task.title + " " + JSON.stringify(designBrief)
    );
    const ragContext = ragResult.docs.map((d) => d.content).join("\n\n");

    // 4. Preflight Check
    // Estimate cost (rough)
    const estimatedTokens =
      (SYSTEM_PROMPT.length +
        JSON.stringify(designBrief).length +
        ragContext.length) /
      4;
    const estimatedCost =
      (estimatedTokens / 1000) *
      ((agent.modelConfig as any)?.primary?.estimated_cost_per_1k_tokens_usd ||
        0.12);

    const preflight = await checkBudget(task.id, agent.id, estimatedCost);
    if (!preflight.allowed) {
      console.warn(`[Designer] Task blocked by budget: ${preflight.reason}`);
      await prisma.task.update({
        where: { id: task.id },
        data: { status: "BLOCKED", blockedReason: preflight.reason },
      });
      return null;
    }

    // 5. Generate Design Package
    const modelConfig = (agent.modelConfig as any).primary as ModelConfig;

    const designPackageContent = await generateDesignPackage(
      projectId,
      task.module.project.name,
      task.title,
      designBrief,
      modelConfig,
      ragContext
    );

    // 6. Update Task
    const updatedTask = await prisma.task.update({
      where: { id: task.id },
      data: {
        status: designPackageContent.requiresHumanReview
          ? "IN_REVIEW"
          : "COMPLETED",
        outputArtifact: JSON.stringify(designPackageContent),
        designContext: designPackageContent as any,
      } as any,
    });
    emitTaskUpdate(updatedTask);

    // Mark agent IDLE
    if (task.assignedToAgentId) {
      const idleAgent = await prisma.agent.update({
        where: { id: task.assignedToAgentId },
        data: { status: "IDLE", currentTaskId: null },
      });
      emitAgentUpdate(idleAgent);
    }

    console.log(
      `[Designer] Completed task: ${task.title}. Review required: ${designPackageContent.requiresHumanReview}`
    );
    return designPackageContent;
  } catch (error: any) {
    console.error("[Designer] Error:", error);
    const failedTask = await prisma.task.update({
      where: { id: task.id },
      data: {
        status: "FAILED",
        errorMessage: error.message || JSON.stringify(error),
      } as any,
    });
    emitTaskUpdate(failedTask);
    throw error;
  }
}
