/**
 * Evolution Cycle Service
 * 
 * Runs periodic evolution cycles to:
 * 1. Terminate low-E agents (harvest knowledge first)
 * 2. Calculate fitness for survivors
 * 3. Breed new offspring from elite parents
 * 4. Record generation stats for visualization
 */

import { Agent } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { EvolutionService, AgentGenome, TaskOutcome } from './EvolutionService';
import { ExistenceService } from './ExistenceService';
import { KnowledgeHarvester } from './KnowledgeHarvester';
import { EvolutionHistoryService } from './EvolutionHistoryService';
import { populationManager } from './PopulationManager';
import { emitLog } from '../../websocket/socketServer';
import { v4 as uuidv4 } from 'uuid';

export interface EvolutionCycleConfig {
    elitePercentage: number;     // Top % to keep unchanged
    terminationThreshold: number; // E value below which agents die
    breedingPairs: number;        // Number of breeding pairs per cycle
    mutationRate: number;         // Probability of mutation
    dryRunMode: boolean;          // Log only, don't actually change
}

export interface CycleResult {
    generationNumber: number;
    terminated: string[];
    bred: string[];
    survivors: string[];
    avgFitness: number;
    maxFitness: number;
    innovations: string[];
}

const DEFAULT_CONFIG: EvolutionCycleConfig = {
    elitePercentage: 0.2,
    terminationThreshold: 10,
    breedingPairs: 3,
    mutationRate: 0.1,
    dryRunMode: false  // PRODUCTION: Real evolution enabled
};

class EvolutionCycleServiceClass {
    private config: EvolutionCycleConfig;
    private evolutionService: EvolutionService;
    private existenceService: ExistenceService;
    private knowledgeHarvester: KnowledgeHarvester;
    private currentGeneration: number = 0;

    constructor(config?: Partial<EvolutionCycleConfig>) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.evolutionService = new EvolutionService({ mutation_rate: this.config.mutationRate });
        this.existenceService = new ExistenceService();
        this.knowledgeHarvester = new KnowledgeHarvester();
    }

    /**
     * Run one evolution cycle
     */
    async runCycle(projectId: string = 'global'): Promise<CycleResult> {
        console.log(`[EvolutionCycle] 🧬 Starting evolution cycle for ${projectId}...`);
        emitLog(`[Evolution] 🧬 Starting generation ${this.currentGeneration + 1} cycle...`);

        // Get all alive agents
        const agents = await prisma.agent.findMany({
            where: {
                status: { not: 'OFFLINE' },
                existencePotential: { gt: 0 }
            },
            include: {
                taskMetrics: {
                    take: 50,
                    orderBy: { createdAt: 'desc' }
                }
            }
        });

        if (agents.length === 0) {
            console.log(`[EvolutionCycle] No agents to evolve. Run population bootstrap first.`);
            return {
                generationNumber: this.currentGeneration,
                terminated: [],
                bred: [],
                survivors: [],
                avgFitness: 0,
                maxFitness: 0,
                innovations: []
            };
        }

        // Step 1: Calculate fitness for each agent
        const agentFitness: { agent: Agent; fitness: number; outcomes: TaskOutcome[] }[] = [];
        
        for (const agent of agents) {
            const outcomes = this.convertMetricsToOutcomes(agent.taskMetrics);
            const fitness = this.evolutionService.calculateFitness(outcomes, []);
            agentFitness.push({ agent, fitness, outcomes });
        }

        // Sort by fitness (descending)
        agentFitness.sort((a, b) => b.fitness - a.fitness);

        // Step 2: Identify agents to terminate (low E)
        const toTerminate = agentFitness.filter(
            af => af.agent.existencePotential <= this.config.terminationThreshold
        );

        const terminated: string[] = [];
        for (const { agent } of toTerminate) {
            if (this.config.dryRunMode) {
                console.log(`[EvolutionCycle] 🔮 DRY-RUN: Would terminate ${agent.id} (E=${agent.existencePotential.toFixed(1)})`);
            } else {
                await this.knowledgeHarvester.harvest(agent);
                await prisma.agent.update({
                    where: { id: agent.id },
                    data: { status: 'OFFLINE', existencePotential: 0 }
                });
                console.log(`[EvolutionCycle] 💀 Terminated: ${agent.id}`);
            }
            terminated.push(agent.id);
        }

        // Step 3: Identify survivors and elite
        const survivors = agentFitness.filter(
            af => af.agent.existencePotential > this.config.terminationThreshold
        );
        
        const eliteCount = Math.max(1, Math.floor(survivors.length * this.config.elitePercentage));
        const elite = survivors.slice(0, eliteCount);

        console.log(`[EvolutionCycle] 👑 Elite agents (top ${eliteCount}):`, elite.map(e => e.agent.id));

        // Step 4: Breed new offspring
        const bred: string[] = [];
        const innovations: string[] = [];

        for (let i = 0; i < this.config.breedingPairs && elite.length >= 2; i++) {
            // Select two parents via tournament
            const parent1 = this.evolutionService.tournamentSelection(
                elite.map(e => ({ genome: e.agent.genome as AgentGenome, fitness: e.fitness }))
            );
            const parent2 = this.evolutionService.tournamentSelection(
                elite.map(e => ({ genome: e.agent.genome as AgentGenome, fitness: e.fitness }))
            );

            if (parent1.id === parent2.id) continue; // Skip self-breeding

            // Get parent fitness
            const p1Fitness = elite.find(e => (e.agent.genome as any)?.id === parent1.id)?.fitness || 0.5;
            const p2Fitness = elite.find(e => (e.agent.genome as any)?.id === parent2.id)?.fitness || 0.5;

            // Crossover
            const childGenome = this.evolutionService.crossover(parent1, parent2, p1Fitness, p2Fitness);
            const mutatedGenome = this.evolutionService.mutate(childGenome);

            if (this.config.dryRunMode) {
                console.log(`[EvolutionCycle] 🔮 DRY-RUN: Would breed child from ${parent1.id} x ${parent2.id}`);
                bred.push(`dry-run-child-${i}`);
            } else {
                // Create new agent
                const role = elite[0].agent.role; // Inherit role from top parent
                const newAgent = await prisma.agent.create({
                    data: {
                        id: `evo_${role.toLowerCase()}_gen${mutatedGenome.generation}_${uuidv4().slice(0, 6)}`,
                        role: role,
                        specialization: role,
                        status: 'IDLE',
                        existencePotential: 80.0, // Start with slightly less E than parents
                        generation: mutatedGenome.generation,
                        genome: mutatedGenome as any,
                        parentId: parent1.id,
                        lastActiveAt: new Date()
                    }
                });

                console.log(`[EvolutionCycle] 🐣 Bred: ${newAgent.id} (Gen ${mutatedGenome.generation})`);
                bred.push(newAgent.id);
                innovations.push(`Gen ${mutatedGenome.generation} ${role} born`);
            }
        }

        // Step 5: Record generation stats
        this.currentGeneration++;
        
        const avgFitness = agentFitness.reduce((sum, af) => sum + af.fitness, 0) / agentFitness.length;
        const maxFitness = agentFitness[0]?.fitness || 0;

        // Try to record to history service
        try {
            const historyService = new EvolutionHistoryService();
            await historyService.recordGeneration({
                projectId,
                generationNumber: this.currentGeneration,
                agents: agentFitness.map(af => ({
                    id: af.agent.id,
                    fitness: af.fitness,
                    tasksCompleted: af.agent.successCount + af.agent.failCount,
                    tasksSucceeded: af.agent.successCount,
                    tokensUsed: af.outcomes.reduce((sum, o) => sum + 1000, 0), // Placeholder
                    existencePotential: af.agent.existencePotential,
                    genome: af.agent.genome,
                    parentId: af.agent.parentId || undefined,
                    status: terminated.includes(af.agent.id) ? 'TERMINATED_LOW_E' : 'ALIVE',
                    causeOfDeath: terminated.includes(af.agent.id) ? 'Low E' : undefined
                })),
                innovations,
                mutationRate: this.config.mutationRate,
                crossoverRate: this.config.breedingPairs / Math.max(1, elite.length)
            });
        } catch (err) {
            console.error(`[EvolutionCycle] Failed to record generation:`, err);
        }

        emitLog(`[Evolution] ✅ Gen ${this.currentGeneration}: ${terminated.length} died, ${bred.length} born, avg fitness ${avgFitness.toFixed(3)}`);

        return {
            generationNumber: this.currentGeneration,
            terminated,
            bred,
            survivors: survivors.map(s => s.agent.id),
            avgFitness,
            maxFitness,
            innovations
        };
    }

    /**
     * Convert TaskMetrics to TaskOutcome format
     */
    private convertMetricsToOutcomes(metrics: any[]): TaskOutcome[] {
        return metrics.map(m => ({
            success: m.success !== false,
            quality_score: 0.7, // Default placeholder
            efficiency_score: m.executionTimeMs ? Math.max(0, 1 - m.executionTimeMs / 60000) : 0.5,
            complexity: 0.5,
            collaboration_score: 0.5
        }));
    }

    /**
     * Enable or disable dry-run mode
     */
    setDryRunMode(enabled: boolean): void {
        this.config.dryRunMode = enabled;
        populationManager.setDryRunMode(enabled);
        console.log(`[EvolutionCycle] Dry-run mode: ${enabled ? 'ENABLED' : 'DISABLED'}`);
    }

    /**
     * Get current generation number
     */
    getGeneration(): number {
        return this.currentGeneration;
    }
}

// Singleton instance
export const evolutionCycleService = new EvolutionCycleServiceClass();
