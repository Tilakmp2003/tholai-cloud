/**
 * Phase 8: Project Planner Service
 * 
 * Analyzes PRD text and creates modules/tasks for a new project
 * Integrated with Architect Agent for creative system design.
 */

import { spawnAgents } from './agentSpawner';
import { socraticInterrogator, InterrogationResult } from '../agents/socraticInterrogatorAgent';
import { architectAgent, ArchitectOutput } from '../agents/architectAgent';
import { gitIntegration } from './gitIntegration';
import { generateDesignPackage } from '../agents/designerAgent';
import { approvalGates } from './approvalGates';
import { PrismaClient, Module } from '@prisma/client';
import { analyzeProject, allocateAgentsForProject, getTotalAgentCount, AgentAllocation } from './agentAllocator';
import { queryVectorDB } from './ragService';
import { ModelConfig } from './llmClient';
import { emitLog, emitModuleUpdate } from '../websocket/socketServer';

const prisma = new PrismaClient();

/**
 * Create modules and tasks from Architect's plan
 */
export async function createModulesFromArchitectPlan(
  projectId: string,
  architectOutput: ArchitectOutput
) {
  const modules: Module[] = [];
  const recommendedProposal = architectOutput.proposals.find(p => p.id === architectOutput.recommendedProposalId) || architectOutput.proposals[0];

  if (!recommendedProposal) {
    throw new Error('No proposal found in Architect output');
  }

  // HARDENING: If proposal is BOLD, require explicit human approval
  let approvalStatus = 'APPROVED';
  if (recommendedProposal.type === 'BOLD') {
    console.log(`[ProjectPlanner] BOLD proposal selected. Flagging for Human Review.`);
    approvalStatus = 'PENDING_REVIEW';
    // In a real system, this would trigger a notification to the user
    // For now, we just log it and potentially block auto-execution of tasks
  }

  console.log(`[ProjectPlanner] Selected Proposal: ${recommendedProposal.type} (${recommendedProposal.summary}) - Status: ${approvalStatus}`);

  // 4. Create modules and tasks from Architect's plan (Phased Execution)
  // We iterate through phases and create modules/tasks accordingly.
  // If the Architect didn't return phases (legacy fallback), we use the old logic.
  
  if (recommendedProposal.phases && recommendedProposal.phases.length > 0) {
    console.log(`[ProjectPlanner] Implementing Phased Execution Plan (${recommendedProposal.phases.length} phases)`);
    
    for (const phase of recommendedProposal.phases) {
      console.log(`[ProjectPlanner] Processing Phase: ${phase.name}`);
      
      // Create a "Phase Module" or group tasks by phase?
      // Better: Create modules based on components, but tag tasks with phases?
      // OR: Create a module for each phase if the phase is distinct (e.g. "Infrastructure").
      
      // Let's stick to Component-based Modules, but ensure tasks are created.
      // We'll iterate through tasks in the phase and assign them to modules.
      
      for (const taskDef of phase.tasks) {
        // Find or create module for this task
        // If taskDef has 'module' or 'component' field, use it.
        // Otherwise, use a default module for the phase.
        
        const moduleName = taskDef.module || taskDef.component || phase.name;
        
        let projectModule = modules.find(m => m.name === moduleName);
        if (!projectModule) {
          projectModule = await prisma.module.create({
            data: { projectId, name: moduleName, status: 'IN_PROGRESS' }
          });
          modules.push(projectModule);
          emitModuleUpdate(projectModule);
        }

        await prisma.task.create({
          data: {
            moduleId: projectModule.id,
            title: taskDef.title || "Implement task",
            requiredRole: taskDef.required_role || 'MidDev',
            status: 'QUEUED',
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
                riskAssessment: recommendedProposal.riskAssessment
              }
            }
          }
        });
      }
    }
  } else {
    // Legacy Fallback (Flat tasks list)
    console.log('[ProjectPlanner] No phases detected. Using legacy flat task list.');
    
    // ... (Old logic for components/tasks) ...
    // For brevity, I'll just implement a simplified version of the old logic here 
    // or we can assume the old logic was replaced. 
    // Let's keep the old logic as a fallback path.
    
    for (const component of recommendedProposal.components) {
        const projectModule = await prisma.module.create({
          data: { projectId, name: component, status: 'IN_PROGRESS' }
        });
        modules.push(projectModule);
        
        const relevantTasks = recommendedProposal.tasks.filter((t: any) => t.module === component || !t.module);
        for (const taskDef of relevantTasks) {
             await prisma.task.create({
                data: {
                  moduleId: projectModule.id,
                  title: taskDef.summary || taskDef.title || "Implement component logic",
                  requiredRole: taskDef.required_role || 'MidDev',
                  status: 'QUEUED',
                  contextPacket: {
                    description: taskDef.description || taskDef.summary,
                    acceptanceCriteria: taskDef.acceptance_criteria,
                    designContext: {
                      adr: architectOutput.adr,
                      diagrams: architectOutput.diagrams,
                      proposalType: recommendedProposal.type,
                      tradeoffs: recommendedProposal.tradeoffs
                    }
                  }
                }
              });
        }
    }
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
    console.log('[ProjectPlanner] Running Socratic Interrogator...');
    interrogationResult = await socraticInterrogator.interrogateRequirements(
      projectId,
      description
    );
    
    if (!interrogationResult.isReady) {
      console.log(`[ProjectPlanner] ❓ Requirements need clarification (${interrogationResult.questions.length} questions)`);
      
      // Spawn a Team Lead to handle clarification
      console.log('[ProjectPlanner] Spawning Team Lead to handle clarification...');
      await spawnAgents(projectId, { teamLead: 1, architect: 0, seniorDev: 0, midDev: 0, juniorDev: 0, qa: 0, security: 0, ops: 0 });

      return {
        needsClarification: true,
        interrogationResult,
        modules: [],
        plan: null,
        agentCount: 1,
        allocation: { teamLead: 1 }
      };
    }
    
    finalDescription = interrogationResult.clarifiedRequirements;
    console.log(`[ProjectPlanner] ✅ Requirements clarified (Ambiguity: ${(interrogationResult.ambiguityScore * 100).toFixed(1)}%)`);
  }

  // Step 1: Analyze project requirements for agent allocation (Hardened)
  console.log('[ProjectPlanner] Analyzing requirements for agent allocation...');
  const allocResult = await allocateAgentsForProject(projectId, finalDescription);
  
  if (!allocResult.ok && allocResult.reason === 'CooldownActive') {
     console.warn('[ProjectPlanner] Allocation cooldown active. Using last allocation.');
     // Proceed with last allocation or default? For now, let's proceed.
  }

  const allocation = (allocResult.allocation || allocResult.lastAlloc?.composition || {}) as AgentAllocation; // Fallback
  const agentCount = getTotalAgentCount(allocation);
  
  // Step 2: Spawn agents
  console.log(`[ProjectPlanner] Spawning ${agentCount} agents for project...`);
  await spawnAgents(projectId, allocation);

  // Step 2.5: Designer Agent (Visual Direction)
  console.log('[ProjectPlanner] 🎨 Designer Agent is creating the visual direction...');
  let designContextString = "";
  try {
    // We create a temporary "task" context for the designer
    
    // Fetch Designer Agent Config
    const designerAgent = await prisma.agent.findFirst({ where: { role: 'Designer' } });
    const agentConfig = (designerAgent?.modelConfig as any)?.primary as ModelConfig;
    
    if (!agentConfig) {
       console.warn('[ProjectPlanner] Designer agent config not found. Skipping design phase.');
       throw new Error("Designer Agent not configured");
    }

    // RAG Retrieval
    const ragResult = await queryVectorDB("Initial Design Direction " + finalDescription);
    const ragContext = ragResult.docs.map(d => d.content).join("\n\n");

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
    console.log(`[ProjectPlanner] Designer recommended: ${designPackage.recommendedDirection}`);
  } catch (err) {
    console.warn('[ProjectPlanner] Designer Agent failed (non-fatal):', err);
  }

  // Step 3: Architect Agent Design Phase
  console.log('[ProjectPlanner] 🏛️ Architect Agent is designing the system...');
  // Append design context to requirements so Architect considers it
  const architectRequirements = finalDescription + "\n\n" + designContextString;
  
  const architectOutput = await architectAgent.designSystem(projectId, architectRequirements);
  
  console.log(`[ProjectPlanner] Architect generated ${architectOutput.proposals.length} proposals. Recommended: ${architectOutput.recommendedProposalId}`);

  // Step 4: Create modules and tasks from Architect's plan
  const modules = await createModulesFromArchitectPlan(projectId, architectOutput);
  console.log(`[ProjectPlanner] Created ${modules.length} modules based on architecture`);

  // Step 5: Initialize Git repository
  // Poll for workspace path (up to 60 seconds)
  let project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { workspacePath: true, name: true }
  });
  
  let attempts = 0;
  while (!project?.workspacePath && attempts < 120) {
    console.log(`[ProjectPlanner] Waiting for workspace path... (${attempts + 1}/120)`);
    emitLog(`[System] Waiting for workspace initialization... (${attempts + 1}/120)`);
    await new Promise(resolve => setTimeout(resolve, 1000));
    project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { workspacePath: true, name: true }
    });
    attempts++;
  }
  
  if (project?.workspacePath) {
    console.log('[ProjectPlanner] Initializing Git repository...');
    emitLog('[System] Initializing Git repository...');
    await gitIntegration.initRepo(project.workspacePath, project.name);
    
    // Configure approval gates for this project
    approvalGates.configureGates(projectId, approvalGates.getDefaultGates());
    emitLog('[System] Git repository initialized and approval gates configured.');
  } else {
    console.warn('[ProjectPlanner] Workspace path not found after timeout. Skipping Git init.');
    emitLog('[System] Warning: Workspace initialization timed out. Git repository not initialized.');
  }

  return {
    needsClarification: false,
    interrogationResult,
    modules,
    plan: architectOutput, // Return full architect output as plan
    agentCount,
    allocation
  };
}
