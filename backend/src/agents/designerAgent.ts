import { callLLM } from '../llm/llmClient';
import { getDefaultModelConfig } from '../llm/modelRegistry';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { ModelConfig } from '../llm/types';

const prisma = new PrismaClient();

const SYSTEM_PROMPT = `
You are a World-Class Product Designer and Creative Director (ex-Apple, ex-Airbnb).
Your goal is to design beautiful, functional, and accessible user interfaces that delight users.
You balance aesthetic excellence with engineering feasibility.

You will be given a Design Brief (from a Socratic Interrogator session).
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
  componentInventory: { name: string; purpose: string; complexity: 'Low' | 'Medium' | 'High' }[];
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
  designBrief: any
): Promise<DesignPackageContent> {
  const modelConfig = getDefaultModelConfig('ideation');
  
  const prompt = `
    Project: ${projectName}
    Task: ${taskTitle}
    Design Brief: ${JSON.stringify(designBrief, null, 2)}
    
    Generate the Design Package JSON.
  `;

  const response = await callLLM(
    modelConfig,
    [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt }
    ]
  );

  let designPackageContent: DesignPackageContent;
  try {
    const content = response.content.replace(/```json/g, '').replace(/```/g, '').trim();
    designPackageContent = JSON.parse(content);
  } catch (e) {
    console.error('[Designer] Failed to parse JSON:', response.content);
    throw new Error('Failed to parse Design Package JSON');
  }

  // Create DesignPackage record
  await (prisma as any).designPackage.create({
    data: {
      projectId,
      artifactRef: `artifact://design-package-${randomUUID()}.json`, // Mock ref
      metadata: designPackageContent as any
    }
  });

  return designPackageContent;
}

export async function runDesignerAgentOnce() {
  // 1. Find a task assigned to DESIGNER or a generic 'design' task
  // For now, we look for tasks with requiredRole = 'DESIGNER' and status = 'QUEUED' or 'ASSIGNED'
  const tasks = await prisma.task.findMany({
    where: {
      requiredRole: 'DESIGNER',
      status: { in: ['QUEUED', 'ASSIGNED'] },
      assignedToAgentId: null 
    },
    include: {
      module: {
        include: {
          project: true
        }
      }
    },
    orderBy: { createdAt: 'asc' },
    take: 1
  });

  if (tasks.length === 0) return null;
  const task = tasks[0] as any; // Cast to any to avoid strict typing issues with relations for now
  
  // Verify we have the project ID
  if (!task.module || !task.module.project) {
    console.error(`[Designer] Task ${task.id} has no associated project`);
    return null;
  }
  const projectId = task.module.project.id;

  // Claim task
  await prisma.task.update({
    where: { id: task.id },
    data: { 
      status: 'IN_PROGRESS', 
      assignedToAgent: {
        connectOrCreate: {
          where: { id: 'designer-agent-singleton' },
          create: {
            id: 'designer-agent-singleton',
            role: 'DESIGNER',
            specialization: 'UI/UX',
            modelConfig: {}
          }
        }
      }
    } as any // Cast to avoid strict type checks on update input
  });

  console.log(`[Designer] Starting task: ${task.title}`);

  try {
    // 2. Prepare Context
    // We expect the 'contextPacket' to contain the 'designBrief' from Socratic
    const contextPacket = task.contextPacket as any;
    const designBrief = contextPacket?.designBrief || task.description || "No brief provided";

    // 3. Generate Design Package
    const designPackageContent = await generateDesignPackage(
      projectId,
      task.module.project.name,
      task.title,
      designBrief
    );

    // 4. Update Task
    await prisma.task.update({
      where: { id: task.id },
      data: {
        status: designPackageContent.requiresHumanReview ? 'IN_REVIEW' : 'COMPLETED',
        outputArtifact: JSON.stringify(designPackageContent), // Store as string
        designContext: designPackageContent as any // Pass to Architect
      } as any
    });

    console.log(`[Designer] Completed task: ${task.title}. Review required: ${designPackageContent.requiresHumanReview}`);
    return designPackageContent;

  } catch (error: any) {
    console.error('[Designer] Error:', error);
    await prisma.task.update({
      where: { id: task.id },
      data: {
        status: 'FAILED',
        errorMessage: error.message || JSON.stringify(error)
      } as any
    });
    throw error;
  }
}
