import { v4 as uuidv4 } from 'uuid';

// Interfaces for type safety
export interface AgentGenome {
    id: string;
    generation: number;
    parents: string[];
    system_prompt: string;
    temperature: number;
    risk_tolerance: number;
    collaboration_preference: number;
    specialization: Record<string, number>;
    fitness_history: number[];
    [key: string]: any;
}

export interface TaskOutcome {
    success: boolean;
    quality_score: number; // 0-1
    efficiency_score: number; // 0-1
    complexity: number; // 0-1
    collaboration_score?: number; // 0-1
}

export interface EvolutionConfig {
    mutation_rate: number;
    crossover_weights: {
        performance: number;
        efficiency: number;
        quality: number;
        collaboration: number;
    };
}

export class EvolutionService {
    private config: EvolutionConfig;

    constructor(config?: Partial<EvolutionConfig>) {
        this.config = {
            mutation_rate: config?.mutation_rate ?? 0.1,
            crossover_weights: config?.crossover_weights ?? {
                performance: 0.4,
                efficiency: 0.2,
                quality: 0.25,
                collaboration: 0.15
            }
        };
    }

    /**
     * Calculate fitness score for an agent based on task history
     */
    public calculateFitness(
        taskOutcomes: TaskOutcome[],
        collaborationHistory: any[] = []
    ): number {
        if (taskOutcomes.length === 0) return 0.1; // Base fitness for survival

        // 1. Performance Metric (Success Rate weighted by complexity)
        let totalWeightedSuccess = 0;
        let totalComplexity = 0;
        
        for (const task of taskOutcomes) {
            const weight = 1 + task.complexity;
            totalWeightedSuccess += (task.success ? 1 : 0) * weight;
            totalComplexity += weight;
        }
        
        const performanceScore = totalComplexity > 0 ? totalWeightedSuccess / totalComplexity : 0;

        // 2. Efficiency Metric (Average efficiency score)
        const avgEfficiency = taskOutcomes.reduce((sum, t) => sum + t.efficiency_score, 0) / taskOutcomes.length;

        // 3. Quality Metric (Average quality score)
        const avgQuality = taskOutcomes.reduce((sum, t) => sum + t.quality_score, 0) / taskOutcomes.length;

        // 4. Collaboration Metric
        // Simple placeholder: ratio of successful collaborative tasks
        const collaborationScore = collaborationHistory.length > 0 
            ? collaborationHistory.filter(c => c.success).length / collaborationHistory.length
            : 0.5; // Neutral default

        // Weighted Sum
        const w = this.config.crossover_weights;
        const fitness = (
            performanceScore * w.performance +
            avgEfficiency * w.efficiency +
            avgQuality * w.quality +
            collaborationScore * w.collaboration
        );

        return Math.max(0.01, Math.min(1.0, fitness));
    }

    /**
     * Select parents using Tournament Selection
     */
    public tournamentSelection(
        population: { genome: AgentGenome; fitness: number }[],
        tournamentSize: number = 3
    ): AgentGenome {
        // Randomly select 'tournamentSize' individuals
        const tournament = [];
        for (let i = 0; i < tournamentSize; i++) {
            const randomIndex = Math.floor(Math.random() * population.length);
            tournament.push(population[randomIndex]);
        }

        // Return the one with highest fitness
        return tournament.reduce((best, current) => 
            (current.fitness > best.fitness ? current : best)
        ).genome;
    }

    /**
     * Create a child genome from two parents
     */
    public crossover(
        parent1: AgentGenome,
        parent2: AgentGenome,
        fitness1: number,
        fitness2: number
    ): AgentGenome {
        // Calculate influence based on relative fitness
        const totalFitness = fitness1 + fitness2;
        const p1Influence = totalFitness > 0 ? fitness1 / totalFitness : 0.5;
        
        // 1. System Prompt Blending (Simple interpolation for now)
        // In a real implementation, we'd use embeddings or LLM to merge
        const childPrompt = this.blendSystemPrompts(
            parent1.system_prompt, 
            parent2.system_prompt, 
            p1Influence
        );

        // 2. Parameter inheritance (Weighted average)
        const childTemp = parent1.temperature * p1Influence + parent2.temperature * (1 - p1Influence);
        const childRisk = parent1.risk_tolerance * p1Influence + parent2.risk_tolerance * (1 - p1Influence);
        
        // 3. Specialization inheritance (Baldwinian)
        const childSpecialization: Record<string, number> = {};
        const allKeys = new Set([
            ...Object.keys(parent1.specialization || {}),
            ...Object.keys(parent2.specialization || {})
        ]);
        
        for (const key of allKeys) {
            const v1 = parent1.specialization?.[key] || 0;
            const v2 = parent2.specialization?.[key] || 0;
            childSpecialization[key] = v1 * p1Influence + v2 * (1 - p1Influence);
        }

        return {
            id: uuidv4(),
            generation: Math.max(parent1.generation, parent2.generation) + 1,
            parents: [parent1.id, parent2.id],
            system_prompt: childPrompt,
            temperature: childTemp,
            risk_tolerance: childRisk,
            collaboration_preference: (parent1.collaboration_preference + parent2.collaboration_preference) / 2,
            specialization: childSpecialization,
            fitness_history: []
        };
    }

    /**
     * Mutate a genome
     */
    public mutate(genome: AgentGenome): AgentGenome {
        const mutated = { ...genome };

        // Mutate Temperature
        if (Math.random() < this.config.mutation_rate) {
            mutated.temperature += (Math.random() - 0.5) * 0.2; // +/- 0.1
            mutated.temperature = Math.max(0.1, Math.min(1.0, mutated.temperature));
        }

        // Mutate Risk Tolerance
        if (Math.random() < this.config.mutation_rate) {
            mutated.risk_tolerance += (Math.random() - 0.5) * 0.2;
            mutated.risk_tolerance = Math.max(0.1, Math.min(1.0, mutated.risk_tolerance));
        }

        // Mutate System Prompt (Simulated small change)
        // In production, this would ask an LLM to "slightly vary this prompt"
        if (Math.random() < this.config.mutation_rate * 0.5) {
             // Placeholder for prompt mutation
             // mutated.system_prompt = await this.llm.mutatePrompt(mutated.system_prompt);
        }

        return mutated;
    }

    private blendSystemPrompts(prompt1: string, prompt2: string, weight1: number): string {
        // Simple strategy: If weight1 > 0.6, take prompt1. If weight1 < 0.4, take prompt2.
        // If in between, concatenate with a transition.
        // Ideally, this uses an LLM to synthesize.
        
        if (weight1 > 0.7) return prompt1;
        if (weight1 < 0.3) return prompt2;
        
        // Hybrid approach for now
        const lines1 = prompt1.split('\n');
        const lines2 = prompt2.split('\n');
        
        // Take top half of dominant parent, bottom half of other?
        // Or just return the stronger one to avoid nonsense.
        // For MVP, let's just return the stronger parent's prompt to ensure coherence.
        return weight1 >= 0.5 ? prompt1 : prompt2;
    }
}
