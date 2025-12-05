import { Agent } from '@prisma/client';
import { prisma } from '../../lib/prisma';

export class KnowledgeHarvester {
    
    /**
     * Harvests knowledge from a dying agent.
     * Extracts patterns if the agent was successful enough.
     */
    public async harvest(agent: Agent): Promise<void> {
        // Only harvest from successful agents
        // Threshold: at least 3 successes to be considered "wise"
        if (agent.successCount < 3) {
            console.log(`Agent ${agent.id} died without enough success to harvest (Successes: ${agent.successCount}).`);
            return;
        }

        const specialization = agent.specialization || "General";
        const wisdom = this.extractWisdom(agent);

        if (wisdom) {
            try {
                await prisma.knowledgeNugget.create({
                    data: {
                        category: specialization,
                        content: wisdom,
                        sourceAgentId: agent.id,
                        qualityScore: Math.min(1.0, agent.successCount / 20) // Simple quality metric
                    }
                });
                console.log(`🌱 Harvested knowledge from ${agent.id}: [${specialization}] "${wisdom}"`);
            } catch (error) {
                console.error(`Failed to save knowledge nugget for agent ${agent.id}:`, error);
            }
        }
    }

    /**
     * Simulates extracting wisdom based on agent's role and history.
     * In a real system, this would analyze actual task outputs using an LLM.
     */
    private extractWisdom(agent: Agent): string | null {
        const role = agent.role;
        const spec = agent.specialization || "General";

        // Simulated patterns/heuristics
        const patterns = [
            `Always validate inputs for ${spec} tasks to prevent runtime errors.`,
            `Use caching strategies when handling high-load ${spec} operations.`,
            `Prioritize rigorous error handling in ${role} workflows.`,
            `Keep functions small, pure, and testable in ${spec} development.`,
            `Document assumptions clearly for ${role} tasks to improve collaboration.`,
            `Refactor early when complexity in ${spec} modules increases.`,
            `Automate repetitive ${spec} testing steps to save E-cost.`
        ];

        // Pick a random "lesson" to simulate extraction
        return patterns[Math.floor(Math.random() * patterns.length)];
    }

    /**
     * Retrieve relevant nuggets for a context or category.
     * Used by new agents to "inherit" wisdom.
     */
    public async getRelevantKnowledge(category: string): Promise<string[]> {
        try {
            const nuggets = await prisma.knowledgeNugget.findMany({
                where: { 
                    OR: [
                        { category: category },
                        { category: "General" }
                    ]
                },
                orderBy: { qualityScore: 'desc' },
                take: 3
            });

            return nuggets.map(n => n.content);
        } catch (error) {
            console.error("Failed to retrieve knowledge nuggets:", error);
            return [];
        }
    }
}
