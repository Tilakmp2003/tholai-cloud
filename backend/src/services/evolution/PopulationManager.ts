/**
 * Population Manager Service
 * 
 * Manages the global agent population for evolutionary dynamics.
 * Instead of creating disposable per-project agents, this service
 * maintains a persistent pool of agents that evolve over time.
 */

import { Agent, AgentStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { EvolutionService, AgentGenome } from './EvolutionService';
import { ExistenceService } from './ExistenceService';
import { KnowledgeHarvester } from './KnowledgeHarvester';
import { getAgentConfig } from '../../llm/modelRegistry';
import { emitAgentUpdate, emitLog } from '../../websocket/socketServer';
import { v4 as uuidv4 } from 'uuid';

export interface PopulationConfig {
    targetPopulationSize: number;
    minPopulationSize: number;
    elitePercentage: number;
    breedingRate: number;
    dryRunMode: boolean; // If true, log but don't actually terminate/breed
}

export interface PopulationStats {
    totalAgents: number;
    aliveAgents: number;
    busyAgents: number;
    idleAgents: number;
    avgE: number;
    avgFitness: number;
    generationDistribution: Record<number, number>;
    roleDistribution: Record<string, number>;
}

const DEFAULT_CONFIG: PopulationConfig = {
    targetPopulationSize: 20,
    minPopulationSize: 10,
    elitePercentage: 0.2, // Top 20% are elite
    breedingRate: 0.3,    // 30% of population breeds each cycle
    dryRunMode: false     // PRODUCTION: Real evolution enabled
};

// Role-based default genomes
const ROLE_GENOMES: Record<string, Partial<AgentGenome>> = {
    'MidDev': {
        system_prompt: 'You are a Mid-Level Developer. Write clean, efficient code.',
        temperature: 0.7,
        risk_tolerance: 0.5,
        collaboration_preference: 0.6
    },
    'SeniorDev': {
        system_prompt: 'You are a Senior Developer. Focus on architecture and code quality.',
        temperature: 0.6,
        risk_tolerance: 0.4,
        collaboration_preference: 0.7
    },
    'QA': {
        system_prompt: 'You are a QA Engineer. Find bugs and ensure quality.',
        temperature: 0.5,
        risk_tolerance: 0.3,
        collaboration_preference: 0.8
    },
    'Architect': {
        system_prompt: 'You are a Software Architect. Design scalable systems.',
        temperature: 0.7,
        risk_tolerance: 0.5,
        collaboration_preference: 0.6
    },
    'TeamLead': {
        system_prompt: 'You are a Team Lead. Coordinate work and review code.',
        temperature: 0.6,
        risk_tolerance: 0.4,
        collaboration_preference: 0.9
    }
};

class PopulationManagerClass {
    private config: PopulationConfig;
    private evolutionService: EvolutionService;
    private existenceService: ExistenceService;
    private knowledgeHarvester: KnowledgeHarvester;

    constructor(config?: Partial<PopulationConfig>) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.evolutionService = new EvolutionService();
        this.existenceService = new ExistenceService();
        this.knowledgeHarvester = new KnowledgeHarvester();
    }

    /**
     * Initialize population if empty (Gen 0 bootstrap)
     */
    async initializePopulation(): Promise<number> {
        const existingCount = await prisma.agent.count({
            where: { 
                status: { not: 'OFFLINE' },
                // Only count agents with evolutionary fields
                existencePotential: { gt: 0 }
            }
        });

        if (existingCount >= this.config.minPopulationSize) {
            console.log(`[PopulationManager] Population already has ${existingCount} agents. Skipping bootstrap.`);
            return existingCount;
        }

        console.log(`[PopulationManager] Bootstrapping Gen 0 population...`);
        emitLog(`[Evolution] 🌱 Bootstrapping Gen 0 population...`);

        const roleCounts: Record<string, number> = {
            'MidDev': 8,
            'SeniorDev': 4,
            'QA': 3,
            'Architect': 2,
            'TeamLead': 2,
            'Designer': 1
        };

        let created = 0;
        for (const [role, count] of Object.entries(roleCounts)) {
            for (let i = 0; i < count; i++) {
                try {
                    await this.spawnGenesisAgent(role);
                    created++;
                } catch (err) {
                    console.error(`[PopulationManager] Failed to spawn ${role}:`, err);
                }
            }
        }

        console.log(`[PopulationManager] ✅ Created ${created} Gen 0 agents`);
        emitLog(`[Evolution] ✅ Created ${created} Gen 0 agents`);
        return created;
    }

    /**
     * Create a Gen 0 agent with default genome
     */
    async spawnGenesisAgent(role: string): Promise<Agent> {
        const roleGenome = ROLE_GENOMES[role] || ROLE_GENOMES['MidDev'];
        
        const genome: AgentGenome = {
            id: uuidv4(),
            generation: 0,
            parents: [],
            system_prompt: roleGenome.system_prompt || `You are a ${role}.`,
            temperature: roleGenome.temperature || 0.7,
            risk_tolerance: roleGenome.risk_tolerance || 0.5,
            collaboration_preference: roleGenome.collaboration_preference || 0.5,
            specialization: {},
            fitness_history: []
        };

        const modelConfig = await getAgentConfig(role);

        const agent = await prisma.agent.create({
            data: {
                id: `evo_${role.toLowerCase()}_${uuidv4().slice(0, 8)}`,
                role: role,
                specialization: role,
                status: 'IDLE',
                existencePotential: 100.0, // Starting E
                generation: 0,
                genome: genome as any,
                modelConfig: modelConfig as any,
                lastActiveAt: new Date()
            }
        });

        emitAgentUpdate(agent);
        console.log(`[PopulationManager] 🐣 Spawned Gen 0 ${role}: ${agent.id}`);
        return agent;
    }

    /**
     * Request an agent from the pool for a task
     * Selects the best available agent by E-value and role match
     */
    async requestAgent(role: string): Promise<Agent | null> {
        // Find all IDLE agents that match the role (or can handle it)
        const candidates = await prisma.agent.findMany({
            where: {
                status: 'IDLE',
                existencePotential: { gt: 0 },
                OR: [
                    { role: role },
                    { specialization: role },
                    // Fallback: any developer role can do developer work
                    ...(role.includes('Dev') ? [
                        { role: { in: ['MidDev', 'SeniorDev', 'JuniorDev'] } }
                    ] : [])
                ]
            },
            orderBy: [
                { existencePotential: 'desc' }, // Prefer higher E
                { score: 'desc' }               // Then by historical score
            ],
            take: 1
        });

        if (candidates.length === 0) {
            console.log(`[PopulationManager] No available agents for role ${role}`);
            return null;
        }

        const selected = candidates[0];

        // Mark as BUSY
        const updated = await prisma.agent.update({
            where: { id: selected.id },
            data: { status: 'BUSY' }
        });

        console.log(`[PopulationManager] 📋 Assigned ${selected.id} (E=${selected.existencePotential.toFixed(1)}) for ${role} task`);
        emitAgentUpdate(updated);
        
        return updated;
    }

    /**
     * Release an agent back to the pool after task completion
     */
    async releaseAgent(agentId: string): Promise<void> {
        const agent = await prisma.agent.findUnique({ where: { id: agentId } });
        
        if (!agent) {
            console.warn(`[PopulationManager] Agent ${agentId} not found for release`);
            return;
        }

        // Check if should die
        if (this.existenceService.shouldTerminate(agent.existencePotential)) {
            await this.terminateAgent(agentId, 'LOW_E');
            return;
        }

        // Release back to pool
        const updated = await prisma.agent.update({
            where: { id: agentId },
            data: { 
                status: 'IDLE',
                currentTaskId: null,
                lastActiveAt: new Date()
            }
        });

        emitAgentUpdate(updated);
    }

    /**
     * Terminate an agent (harvest knowledge first)
     */
    async terminateAgent(agentId: string, reason: string): Promise<void> {
        const agent = await prisma.agent.findUnique({ where: { id: agentId } });
        if (!agent) return;

        if (this.config.dryRunMode) {
            console.log(`[PopulationManager] 🔮 DRY-RUN: Would terminate ${agentId} (Reason: ${reason}, E=${agent.existencePotential.toFixed(1)})`);
            emitLog(`[Evolution] 🔮 DRY-RUN: ${agent.role} agent would die (E=${agent.existencePotential.toFixed(1)})`);
            return;
        }

        // Harvest knowledge before death
        await this.knowledgeHarvester.harvest(agent);

        // Mark as terminated
        await prisma.agent.update({
            where: { id: agentId },
            data: { 
                status: 'OFFLINE',
                existencePotential: 0
            }
        });

        console.log(`[PopulationManager] 💀 Terminated ${agentId} (Reason: ${reason})`);
        emitLog(`[Evolution] 💀 Agent terminated: ${agent.role} (${reason})`);
    }

    /**
     * Get population statistics
     */
    async getPopulationStats(): Promise<PopulationStats> {
        const agents = await prisma.agent.findMany({
            where: { existencePotential: { gt: 0 } }
        });

        const aliveAgents = agents.filter(a => a.status !== 'OFFLINE');
        const busyAgents = aliveAgents.filter(a => a.status === 'BUSY');
        const idleAgents = aliveAgents.filter(a => a.status === 'IDLE');

        const genDist: Record<number, number> = {};
        const roleDist: Record<string, number> = {};
        let totalE = 0;
        let totalFitness = 0;

        for (const agent of aliveAgents) {
            totalE += agent.existencePotential;
            totalFitness += agent.score;
            
            const gen = agent.generation || 0;
            genDist[gen] = (genDist[gen] || 0) + 1;
            roleDist[agent.role] = (roleDist[agent.role] || 0) + 1;
        }

        return {
            totalAgents: agents.length,
            aliveAgents: aliveAgents.length,
            busyAgents: busyAgents.length,
            idleAgents: idleAgents.length,
            avgE: aliveAgents.length > 0 ? totalE / aliveAgents.length : 0,
            avgFitness: aliveAgents.length > 0 ? totalFitness / aliveAgents.length : 0,
            generationDistribution: genDist,
            roleDistribution: roleDist
        };
    }

    /**
     * Enable or disable dry-run mode
     */
    setDryRunMode(enabled: boolean): void {
        this.config.dryRunMode = enabled;
        console.log(`[PopulationManager] Dry-run mode: ${enabled ? 'ENABLED' : 'DISABLED'}`);
    }

    /**
     * Dynamic Population Scaling
     * Automatically adjusts population size based on workload
     */
    async scalePopulation(): Promise<{ scaled: boolean; targetSize: number; currentSize: number; action: string }> {
        // Count pending/in-progress tasks
        const pendingTasks = await prisma.task.count({
            where: { status: { in: ['QUEUED', 'ASSIGNED', 'IN_PROGRESS'] } }
        });

        // Calculate target size based on workload
        // Rule: 1 agent per 2 pending tasks, min 10, max 50
        const MIN_AGENTS = 10;
        const MAX_AGENTS = 50;
        const TASKS_PER_AGENT = 2;

        const targetSize = Math.min(MAX_AGENTS, Math.max(MIN_AGENTS, Math.ceil(pendingTasks / TASKS_PER_AGENT)));

        const currentSize = await prisma.agent.count({
            where: { 
                status: { not: 'OFFLINE' },
                existencePotential: { gt: 0 }
            }
        });

        let action = 'NO_CHANGE';

        if (currentSize < targetSize) {
            // SCALE UP: Need more agents
            const toCreate = Math.min(5, targetSize - currentSize); // Max 5 at a time
            
            console.log(`[PopulationManager] 📈 Scaling UP: ${currentSize} → ${targetSize} (creating ${toCreate})`);
            emitLog(`[Evolution] 📈 Scaling up population for ${pendingTasks} pending tasks`);

            // Breed new agents from elite
            const eliteAgents = await prisma.agent.findMany({
                where: { 
                    status: { not: 'OFFLINE' },
                    existencePotential: { gt: 50 }
                },
                orderBy: { score: 'desc' },
                take: 5
            });

            if (eliteAgents.length >= 2) {
                // Breed from elite
                for (let i = 0; i < toCreate && i < eliteAgents.length; i++) {
                    const parent = eliteAgents[i];
                    await this.breedOffspring(parent);
                }
                action = `SCALE_UP_BRED_${toCreate}`;
            } else {
                // Not enough elite, spawn genesis agents
                const roles = ['MidDev', 'SeniorDev', 'QA'];
                for (let i = 0; i < toCreate; i++) {
                    await this.spawnGenesisAgent(roles[i % roles.length]);
                }
                action = `SCALE_UP_SPAWNED_${toCreate}`;
            }
        } else if (currentSize > targetSize + 10) {
            // SCALE DOWN: Let natural decay handle it (don't force kill)
            // Just log that we're over capacity
            console.log(`[PopulationManager] 📉 Over capacity: ${currentSize} agents for ${pendingTasks} tasks (target: ${targetSize})`);
            emitLog(`[Evolution] 📉 Population over capacity - idle agents will naturally decay`);
            action = 'SCALE_DOWN_NATURAL';
        }

        return { scaled: action !== 'NO_CHANGE', targetSize, currentSize, action };
    }

    /**
     * Breed a new offspring from a parent agent
     */
    async breedOffspring(parent: Agent): Promise<Agent> {
        const parentGenome = parent.genome as any as AgentGenome || ROLE_GENOMES[parent.role];
        
        // Mutate the parent genome
        const childGenome: AgentGenome = {
            id: uuidv4(),
            generation: (parent.generation || 0) + 1,
            parents: [parentGenome?.id || parent.id],
            system_prompt: parentGenome?.system_prompt || `You are a ${parent.role}.`,
            temperature: this.mutateValue(parentGenome?.temperature || 0.7, 0.1),
            risk_tolerance: this.mutateValue(parentGenome?.risk_tolerance || 0.5, 0.1),
            collaboration_preference: this.mutateValue(parentGenome?.collaboration_preference || 0.5, 0.1),
            specialization: parentGenome?.specialization || {},
            fitness_history: []
        };

        const modelConfig = await getAgentConfig(parent.role);

        const child = await prisma.agent.create({
            data: {
                id: `evo_${parent.role.toLowerCase()}_gen${childGenome.generation}_${uuidv4().slice(0, 6)}`,
                role: parent.role,
                specialization: parent.role,
                status: 'IDLE',
                existencePotential: 80.0, // Start with slightly less E than parents
                generation: childGenome.generation,
                genome: childGenome as any,
                parentId: parent.id,
                modelConfig: modelConfig as any,
                lastActiveAt: new Date()
            }
        });

        console.log(`[PopulationManager] 🐣 Bred Gen ${childGenome.generation} ${parent.role} from ${parent.id}`);
        emitAgentUpdate(child);
        return child;
    }

    /**
     * Mutate a numeric value slightly
     */
    private mutateValue(value: number, range: number): number {
        const mutation = (Math.random() - 0.5) * 2 * range;
        return Math.max(0, Math.min(1, value + mutation));
    }
}

// Singleton instance
export const populationManager = new PopulationManagerClass();

