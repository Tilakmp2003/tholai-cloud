import { PrismaClient, Generation, AgentGeneration, Agent } from '@prisma/client';
import { prisma } from '../../lib/prisma';

interface TimelineDataPoint {
  generationNumber: number;
  timestamp: Date;
  avgFitness: number;
  maxFitness: number;
  minFitness: number;
  populationSize: number;
  survivalRate: number;
  specializationDistribution: Record<string, number>;
  keyInnovations: string[];
  topAgentName: string;
}

interface FamilyTreeNode {
  id: string;
  name: string;
  generation: number;
  fitness: number;
  role: string;
  status: string;
  specialization: string;
  children: FamilyTreeNode[];
}

export class EvolutionHistoryService {
  constructor() {}

  /**
   * Record a new generation's metrics after evolution cycle completes
   */
  async recordGeneration(data: {
    projectId: string;
    generationNumber: number;
    agents: Array<{
      id: string;
      fitness: number;
      tasksCompleted: number;
      tasksSucceeded: number;
      tokensUsed: number;
      existencePotential: number;
      genome: any;
      parentId?: string;
      status: 'ALIVE' | 'TERMINATED_LOW_E' | 'TERMINATED_RETIREMENT' | 'TERMINATED_REPLACED';
      causeOfDeath?: string;
    }>;
    innovations: string[];
    mutationRate: number;
    crossoverRate: number;
  }): Promise<Generation> {
    const { projectId, generationNumber, agents, innovations, mutationRate, crossoverRate } = data;

    // Calculate aggregate metrics
    const fitnessValues = agents.map(a => a.fitness);
    const avgFitness = fitnessValues.reduce((a, b) => a + b, 0) / fitnessValues.length;
    const maxFitness = Math.max(...fitnessValues);
    const minFitness = Math.min(...fitnessValues);
    const fitnessStdDev = this.calculateStdDev(fitnessValues);

    const aliveAgents = agents.filter(a => a.status === 'ALIVE');
    const deadAgents = agents.filter(a => a.status !== 'ALIVE');
    const newAgents = agents.filter(a => a.parentId); // Has parent = was born this gen

    // Calculate specialization distribution
    const specializationDistribution = this.calculateSpecializationDistribution(agents);

    // Find top agent
    const topAgent = agents.reduce((best, current) => 
      current.fitness > best.fitness ? current : best
    );

    // Create generation record with all agent snapshots
    const generation = await prisma.generation.create({
      data: {
        projectId,
        generationNumber,
        avgFitness,
        maxFitness,
        minFitness,
        fitnessStdDev,
        populationSize: agents.length,
        birthCount: newAgents.length,
        deathCount: deadAgents.length,
        survivalRate: aliveAgents.length / agents.length,
        mutationRate,
        crossoverRate,
        elitePreserved: Math.floor(agents.length * 0.1), // Top 10%
        specializationDistribution,
        keyInnovations: innovations,
        topAgentId: topAgent.id,
        startedAt: new Date(),
        completedAt: new Date(),
        agents: {
          create: agents.map(agent => ({
            agentId: agent.id,
            fitnessScore: agent.fitness,
            tasksCompleted: agent.tasksCompleted,
            tasksSucceeded: agent.tasksSucceeded,
            tokensUsed: agent.tokensUsed,
            existencePotential: agent.existencePotential,
            genomeSnapshot: agent.genome,
            parentId: agent.parentId,
            status: agent.status,
            causeOfDeath: agent.causeOfDeath,
          })),
        },
      },
      include: {
        agents: true,
        topAgent: true,
      },
    });

    return generation;
  }

  /**
   * Get timeline data for visualization
   */
  async getTimelineData(projectId: string, limit = 100): Promise<TimelineDataPoint[]> {
    const generations = await prisma.generation.findMany({
      where: { projectId },
      orderBy: { generationNumber: 'asc' },
      take: limit,
      include: {
        topAgent: true,
      },
    });

    return generations.map(gen => ({
      generationNumber: gen.generationNumber,
      timestamp: gen.completedAt || gen.startedAt,
      avgFitness: gen.avgFitness,
      maxFitness: gen.maxFitness,
      minFitness: gen.minFitness,
      populationSize: gen.populationSize,
      survivalRate: gen.survivalRate,
      specializationDistribution: gen.specializationDistribution as Record<string, number>,
      keyInnovations: gen.keyInnovations,
      topAgentName: gen.topAgent?.role || 'Unknown', // Using role as name for now
    }));
  }

  /**
   * Get family tree for visualization (D3.js compatible)
   */
  async getFamilyTree(projectId: string, rootGeneration = 0): Promise<FamilyTreeNode[]> {
    // Get all agent generations for this project
    const agentGenerations = await prisma.agentGeneration.findMany({
      where: {
        generation: {
          projectId,
          generationNumber: { gte: rootGeneration },
        },
      },
      include: {
        agent: true,
        generation: true,
      },
      orderBy: {
        generation: { generationNumber: 'asc' },
      },
    });

    // Build tree structure
    const nodeMap = new Map<string, FamilyTreeNode>();
    const roots: FamilyTreeNode[] = [];

    // First pass: create all nodes
    for (const ag of agentGenerations) {
      const node: FamilyTreeNode = {
        id: ag.id,
        name: ag.agent.role, // Using role as name
        generation: ag.generation.generationNumber,
        fitness: ag.fitnessScore,
        role: ag.agent.role,
        status: ag.status,
        specialization: this.getTopSpecialization(ag.genomeSnapshot),
        children: [],
      };
      nodeMap.set(ag.id, node);
    }

    // Second pass: connect children to parents
    for (const ag of agentGenerations) {
      const node = nodeMap.get(ag.id)!;
      if (ag.parentId && nodeMap.has(ag.parentId)) {
        nodeMap.get(ag.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }

  // Helper methods
  private calculateStdDev(values: number[]): number {
    if (values.length === 0) return 0;
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const squareDiffs = values.map(v => Math.pow(v - avg, 2));
    return Math.sqrt(squareDiffs.reduce((a, b) => a + b, 0) / values.length);
  }

  private calculateSpecializationDistribution(agents: any[]): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const agent of agents) {
      const spec = agent.genome?.specialization ? this.getTopSpecialization(agent.genome) : 'General';
      counts[spec] = (counts[spec] || 0) + 1;
    }
    const total = agents.length;
    return Object.fromEntries(
      Object.entries(counts).map(([k, v]) => [k, v / total])
    );
  }

  private getTopSpecialization(genome: any): string {
    if (!genome?.specialization) return 'General';
    const entries = Object.entries(genome.specialization as Record<string, number>);
    if (entries.length === 0) return 'General';
    return entries.sort((a, b) => (b[1] as number) - (a[1] as number))[0][0];
  }
}
