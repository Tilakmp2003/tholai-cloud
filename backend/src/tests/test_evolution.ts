import { EvolutionService } from "../services/evolution/EvolutionService";
import { ExistenceService } from "../services/evolution/ExistenceService";
import { EvolutionHistoryService } from "../services/evolution/EvolutionHistoryService";
import { EvolutionaryAgent } from "../agents/EvolutionaryAgent";
import { Agent, Task } from "@prisma/client";
import { v4 as uuidv4 } from 'uuid';

async function testEvolutionSystem() {
    console.log("🧪 Starting Evolution System Verification...");

    // 1. Test EvolutionService
    console.log("\n1. Testing EvolutionService...");
    const evoService = new EvolutionService();
    
    const taskOutcomes = [
        { success: true, quality_score: 0.9, efficiency_score: 0.8, complexity: 0.5 },
        { success: true, quality_score: 0.8, efficiency_score: 0.7, complexity: 0.3 },
        { success: false, quality_score: 0.0, efficiency_score: 0.0, complexity: 0.8 }
    ];
    
    const fitness = evoService.calculateFitness(taskOutcomes);
    console.log(`   Calculated Fitness: ${fitness.toFixed(4)}`);
    if (fitness > 0 && fitness < 1) console.log("   ✅ Fitness calculation within range");
    else console.error("   ❌ Fitness calculation failed");

    // 2. Test ExistenceService
    console.log("\n2. Testing ExistenceService...");
    const existService = new ExistenceService();
    const reward = existService.calculateTaskReward(true, 0.8, 0.9, 0.7);
    console.log(`   Calculated Reward: ${reward}`);
    if (reward > 10) console.log("   ✅ Reward calculation looks correct (bonus applied)");
    else console.error("   ❌ Reward calculation unexpected");

    const urgency = existService.calculateUrgency(10); // Low E
    console.log(`   Urgency at E=10: ${urgency}`);
    if (urgency > 0.5) console.log("   ✅ Urgency correctly high for low E");

    // 3. Test EvolutionaryAgent (Mocking Prisma)
    console.log("\n3. Testing EvolutionaryAgent...");
    
    // Mock Agent
    const mockAgent: Agent = {
        id: uuidv4(),
        role: "MidDev",
        specialization: "Frontend",
        status: "IDLE",
        currentTaskId: null,
        failCount: 0,
        successCount: 0,
        lastActiveAt: new Date(),
        score: 0,
        riskLevel: "LOW",
        costBaseline: 0.05,
        sessionCost: 0,
        modelConfig: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        genome: {
            id: uuidv4(),
            generation: 0,
            system_prompt: "You are a coder.",
            temperature: 0.5,
            risk_tolerance: 0.5,
            collaboration_preference: 0.5,
            specialization: {},
            fitness_history: []
        },
        generation: 0,
        existencePotential: 100,
        parentId: null
    };

    // Mock Prisma update (Monkey patch for test)
    const prismaMock = require("../lib/prisma").prisma;
    prismaMock.agent = {
        update: async (args: any) => {
            console.log("   [MockDB] Updating agent:", args.where.id, args.data);
            return { ...mockAgent, ...args.data };
        },
        create: async (args: any) => {
            console.log("   [MockDB] Creating agent:", args.data);
            return { ...args.data, id: uuidv4() };
        }
    };
    
    prismaMock.knowledgeNugget = {
        create: async (args: any) => {
            console.log("   [MockDB] Creating KnowledgeNugget:", args.data);
            return { ...args.data, id: uuidv4() };
        },
        findMany: async (args: any) => { return []; }
    };

    const evoAgent = new EvolutionaryAgent(mockAgent);
    
    // Test Task Execution
    const mockTask: Task = {
        id: uuidv4(),
        moduleId: "mod_1",
        title: "Test Task",
        requiredRole: "MidDev",
        status: "ASSIGNED",
        contextPacket: {},
        assignedToAgentId: mockAgent.id,
        result: null,
        errorMessage: null,
        traceId: null,
        reviewFeedback: null,
        retryCount: 0,
        isDeadlocked: false,
        revisionCount: 0,
        maxRevisions: 3,
        contextVersion: 1,
        blockedReason: null,
        lastAgentMessage: null,
        files: null,
        failedFiles: null,
        repairScope: null,
        lastFailureReason: null,
        designContext: null,
        proposalId: null,
        adrId: null,
        outputArtifact: null,
        relatedFileName: null,
        qaFeedback: null,
        ownerAgentId: null,
        lastReviewBy: null,
        lastReviewAt: null,
        reviewDecision: null,
        history: null,
        createdAt: new Date(),
        updatedAt: new Date()
    };

    console.log("   Executing task...");
    await evoAgent.executeTaskWithEvolution(mockTask, async (t, ctx) => {
        console.log("   [Agent] Working on task...");
        return { success: true };
    });
    
    console.log(`   New E value: ${evoAgent.E}`);
    if (evoAgent.E > 100) console.log("   ✅ E increased after success");
    else console.error("   ❌ E did not increase");

    // 4. Test Reproduction
    console.log("\n4. Testing Reproduction...");
    const partnerAgent = new EvolutionaryAgent({
        ...mockAgent, 
        id: uuidv4(), 
        existencePotential: 120,
        genome: { 
            ...mockAgent.genome as any,
            id: uuidv4(),
            system_prompt: "You are a partner.", 
            temperature: 0.9 
        }
    });

    const child = await evoAgent.createChild(partnerAgent);
    console.log("   Child Created:", child.id);
    console.log("   Child Generation:", child.generation);
    
    if (child.generation === 1) console.log("   ✅ Child generation correct");
    else console.error("   ❌ Child generation incorrect");

    // 5. Testing Emotional Behavior
    console.log("\n5. Testing Emotional Behavior...");
    const fearfulAgent = new EvolutionaryAgent({
        ...mockAgent,
        id: uuidv4(),
        existencePotential: 10, // Critical level -> Fear
        genome: { 
            ...mockAgent.genome as any,
            system_prompt: "You are a coder.",
            temperature: 0.7 
        }
    });

    console.log("   Executing task with fearful agent (E=10)...");
    await fearfulAgent.executeTaskWithEvolution(mockTask, async (t, ctx) => {
        const state = ctx.agent_state;
        const prompt = ctx.system_prompt_override;
        
        console.log(`   Emotional State: ${state.current_emotional_state}`);
        console.log(`   Urgency: ${state.urgency.toFixed(2)}`);
        
        if (state.current_emotional_state === 'fearful') console.log("   ✅ Agent correctly identified as FEARFUL");
        else console.error(`   ❌ Agent state incorrect: ${state.current_emotional_state}`);
        
        if (prompt && prompt.includes("SYSTEM ALERT: Your Existence Potential is CRITICAL")) {
            console.log("   ✅ System prompt contains fear injection");
        } else {
            console.error("   ❌ System prompt missing fear injection");
        }
        
        return { success: true };
    });

    // 6. Test Specialization
    console.log("\n6. Testing Specialization...");
    const specAgent = new EvolutionaryAgent(mockAgent);
    
    const frontendTask: any = {
        id: uuidv4(),
        title: "Implement React Component for Dashboard",
        description: "Create a new UI component using CSS and HTML",
        status: "PENDING",
        projectId: uuidv4(),
        contextPacket: {}
    };

    console.log("   Executing Frontend task...");
    await specAgent.executeTaskWithEvolution(frontendTask, async (t) => {
        return { success: true };
    });

    const updatedGenome = (specAgent.agentData.genome as any);
    const frontendScore = updatedGenome.specialization['Frontend'] || 0;
    console.log(`   Frontend Score: ${frontendScore.toFixed(2)}`);
    
    if (frontendScore > 0) {
        console.log("   ✅ Specialization score increased");
    } else {
        console.log("   ❌ Specialization score failed to increase");
        process.exit(1);
    }

    // 7. Test Knowledge Harvesting
    console.log("\n7. Testing Knowledge Harvesting...");
    const dyingAgent = new EvolutionaryAgent({
        ...mockAgent,
        id: uuidv4(),
        existencePotential: 0, // Should trigger immediate death
        successCount: 10, // High enough to harvest
        specialization: "Backend"
    });

    console.log("   Executing task with dying agent...");
    try {
        await dyingAgent.executeTaskWithEvolution(mockTask, async () => {
             return { success: true };
        });
    } catch (e: any) {
        console.log(`   ✅ Agent terminated as expected: ${e.message}`);
        if (e.message.includes("insufficient Existence Potential")) {
             console.log("   ✅ Termination logic triggered");
        }
    }

    console.log("\n✅ Verification Complete!");

    // 8. Test Generational Lifecycle
    console.log("\n8. Testing Generational Lifecycle...");
    const historyService = new EvolutionHistoryService();
    
    // Mock Prisma for Generation
    prismaMock.generation = {
        create: async (args: any) => {
            console.log("   [MockDB] Creating Generation:", args.data.generationNumber);
            return { ...args.data, id: uuidv4(), startedAt: new Date(), completedAt: new Date() };
        },
        findMany: async (args: any) => {
            return [{
                generationNumber: 1,
                avgFitness: 0.8,
                maxFitness: 0.9,
                minFitness: 0.7,
                populationSize: 10,
                survivalRate: 0.9,
                specializationDistribution: { Frontend: 0.5, Backend: 0.5 },
                keyInnovations: ["Better Prompting"],
                topAgent: { role: "Architect" }
            }];
        }
    };
    
    prismaMock.agentGeneration = {
        findMany: async (args: any) => []
    };

    const genRecord = await historyService.recordGeneration({
        projectId: "test-project",
        generationNumber: 1,
        agents: [{
            id: mockAgent.id,
            fitness: 0.8,
            tasksCompleted: 5,
            tasksSucceeded: 4,
            tokensUsed: 1000,
            existencePotential: 80,
            genome: mockAgent.genome,
            status: 'ALIVE'
        }],
        innovations: ["Better Prompting"],
        mutationRate: 0.1,
        crossoverRate: 0.5
    });
    
    console.log(`   ✅ Recorded Generation ${genRecord.generationNumber}`);
    
    const timeline = await historyService.getTimelineData("test-project");
    console.log(`   ✅ Retrieved Timeline: ${timeline.length} generations`);
    
    console.log("\n✅ Verification Complete!");
}

// Run test
testEvolutionSystem().catch(console.error);
