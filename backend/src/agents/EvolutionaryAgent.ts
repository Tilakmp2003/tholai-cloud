import { Agent, Task } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { EvolutionService, AgentGenome } from "../services/evolution/EvolutionService";
import { ExistenceService } from "../services/evolution/ExistenceService";
import { SpecializationTracker } from "../services/evolution/SpecializationTracker";
import { EmotionalBehaviorMapper } from "../services/evolution/EmotionalBehaviorMapper";

import { KnowledgeHarvester } from "../services/evolution/KnowledgeHarvester";

// Extended interface to include dynamic runtime properties
export interface RuntimeEvolutionaryAgent extends Agent {
    genome: any; // Typed as any because Prisma Json is generic
    valence: number;
    arousal: number;
    dominance: number;
    current_prompt: string;
}

export class EvolutionaryAgent {
    private agent: RuntimeEvolutionaryAgent;
    private evolutionService: EvolutionService;
    private existenceService: ExistenceService;
    private emotionMapper: EmotionalBehaviorMapper;
    private specializationTracker: SpecializationTracker;
    private knowledgeHarvester: KnowledgeHarvester;

    constructor(agent: Agent) {
        // Initialize with default values if missing
        this.agent = {
            ...agent,
            genome: agent.genome || this.createDefaultGenome(agent),
            valence: 0.0,
            arousal: 0.0,
            dominance: 0.0,
            current_prompt: (agent.genome as any)?.system_prompt || ""
        };
        
        this.evolutionService = new EvolutionService();
        this.existenceService = new ExistenceService();
        this.emotionMapper = new EmotionalBehaviorMapper();
        this.specializationTracker = new SpecializationTracker();
        this.knowledgeHarvester = new KnowledgeHarvester();
    }

    private createDefaultGenome(agent: Agent): AgentGenome {
        return {
            id: agent.id,
            generation: agent.generation,
            parents: [],
            system_prompt: `You are a ${agent.role}.`,
            temperature: 0.7,
            risk_tolerance: 0.5,
            collaboration_preference: 0.5,
            specialization: {},
            fitness_history: []
        };
    }

    /**
     * Execute a task with evolutionary wrappers (E-cost, emotional updates)
     */
    public async executeTaskWithEvolution(
        task: Task, 
        executor: (task: Task, context: any) => Promise<any>
    ): Promise<any> {
        // 1. Check if alive
        if (this.existenceService.shouldTerminate(this.agent.existencePotential)) {
            // Harvest knowledge before dying
            await this.knowledgeHarvester.harvest(this.agent);
            
            // Mark as offline/dead in DB if not already
            if (this.agent.status !== 'OFFLINE') {
                 await prisma.agent.update({
                    where: { id: this.agent.id },
                    data: { status: 'OFFLINE' }
                });
            }

            throw new Error(`Agent ${this.agent.id} has insufficient Existence Potential (E=${this.agent.existencePotential})`);
        }

        // 2. Apply metabolic cost for time passed since last active
        const now = new Date();
        const lastActive = this.agent.lastActiveAt || now;
        const timeDelta = (now.getTime() - lastActive.getTime()) / 1000; // seconds
        
        let currentE = this.existenceService.applyMetabolicCost(
            this.agent.existencePotential, 
            timeDelta
        );

        // 3. Update urgency based on E
        const urgency = this.existenceService.calculateUrgency(currentE);
        
        // Urgency impacts arousal and dominance (fear reduces dominance)
        this.agent.arousal = Math.max(this.agent.arousal, urgency); 
        if (urgency > 0.5) {
            this.agent.dominance -= 0.3; // Fear makes agent submissive (Stronger penalty)
            this.agent.valence -= 0.4;   // Fear is a negative emotion (Stronger penalty to ensure FEAR state)
        }

        // 4. Apply Emotional Behavior Mapping
        const behavior = this.emotionMapper.modifyAgentBehavior(
            this.agent,
            (this.agent.genome as any).system_prompt
        );
        
        // Update runtime prompt and temp (this doesn't save to DB, just for this execution)
        this.agent.current_prompt = behavior.systemPrompt;
        
        // 5. Execute Task
        const startTime = Date.now();
        let result;
        let success = false;
        
        try {
            // Inject urgency/emotion AND modified prompt into context
            const context = {
                ...task.contextPacket as object,
                agent_state: {
                    urgency,
                    valence: this.agent.valence,
                    arousal: this.agent.arousal,
                    dominance: this.agent.dominance,
                    current_emotional_state: this.emotionMapper.classifyEmotionalState(
                        this.agent.valence, 
                        this.agent.arousal, 
                        this.agent.dominance
                    )
                },
                // Pass the modified system prompt so the executor can use it
                system_prompt_override: behavior.systemPrompt,
                temperature_override: behavior.temperature
            };
            
            result = await executor(task, context);
            success = true;
        } catch (error) {
            console.error(`Task execution failed for agent ${this.agent.id}`, error);
            success = false;
            this.agent.valence -= 0.2; // Failure reduces valence
            this.agent.arousal += 0.1; // Failure increases stress
            throw error;
        } finally {
            const duration = (Date.now() - startTime) / 1000;
            
            // 6. Calculate Reward/Penalty
            // For MVP, we estimate complexity/quality. In real system, these come from review.
            const complexity = (task as any).complexityScore ? (task as any).complexityScore / 100 : 0.5;
            const quality = success ? 0.8 : 0.0; // Placeholder
            const efficiency = Math.max(0, 1.0 - (duration / 60)); // Simple efficiency metric
            
            const reward = this.existenceService.calculateTaskReward(
                success,
                complexity,
                quality,
                efficiency
            );
            
            currentE += reward;
            
            // 7. Update Specialization
            const category = this.specializationTracker.categorizeTask(task);
            const currentSpecs = (this.agent.genome as any).specialization || {};
            const newSpecs = this.specializationTracker.updateSpecialization(
                currentSpecs,
                category,
                success,
                complexity
            );
            
            // Update genome with new specs
            (this.agent.genome as any).specialization = newSpecs;
            
            // Determine primary specialization
            const primarySpec = this.specializationTracker.getPrimarySpecialization(newSpecs);
            if (primarySpec !== 'General' && primarySpec !== this.agent.specialization) {
                this.agent.specialization = primarySpec; // Evolve role label
            }

            // 8. Update Agent State in DB
            this.agent.existencePotential = currentE;
            
            // Emotional dynamics
            if (success) {
                this.agent.valence = Math.min(1.0, this.agent.valence + 0.15);
                this.agent.dominance = Math.min(1.0, this.agent.dominance + 0.1); // Success builds confidence
                this.agent.arousal = Math.max(-1.0, this.agent.arousal - 0.2); // Success calms down (unless manic)
            } else {
                this.agent.failCount++;
            }
            
            if (success) this.agent.successCount++;

            // Save updates
            await prisma.agent.update({
                where: { id: this.agent.id },
                data: {
                    existencePotential: this.agent.existencePotential,
                    lastActiveAt: new Date(),
                    successCount: this.agent.successCount,
                    failCount: this.agent.failCount,
                    specialization: this.agent.specialization, // Persist evolved specialization
                    genome: this.agent.genome as any // Persist evolved genome
                }
            });
        }

        return result;
    }

    /**
     * Create a child agent with another parent
     */
    public async createChild(partnerAgent: EvolutionaryAgent): Promise<Agent> {
        const myGenome = this.agent.genome as AgentGenome;
        const partnerGenome = partnerAgent.agent.genome as AgentGenome;
        
        // Calculate fitness (simplified for MVP)
        // In reality, this would look at history
        const myFitness = this.evolutionService.calculateFitness([], []); 
        const partnerFitness = this.evolutionService.calculateFitness([], []);

        const childGenome = this.evolutionService.crossover(
            myGenome,
            partnerGenome,
            myFitness,
            partnerFitness
        );

        const mutatedGenome = this.evolutionService.mutate(childGenome);

        // Create child in DB
        const child = await prisma.agent.create({
            data: {
                role: this.agent.role, // Inherit role from primary parent
                specialization: this.agent.specialization, // Inherit specialization
                status: "IDLE",
                existencePotential: (this.agent.existencePotential + partnerAgent.agent.existencePotential) / 2, // Start with average E
                generation: mutatedGenome.generation,
                genome: mutatedGenome as any,
                parentId: this.agent.id,
                modelConfig: this.agent.modelConfig || undefined
            }
        });

        return child;
    }
    
    // Getters
    public get id() { return this.agent.id; }
    public get E() { return this.agent.existencePotential; }
    public get agentData() { return this.agent; }
}
