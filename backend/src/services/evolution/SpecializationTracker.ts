import { Task } from "@prisma/client";

export class SpecializationTracker {
    
    private categories: Record<string, string[]> = {
        'Frontend': ['ui', 'css', 'html', 'react', 'component', 'style', 'frontend', 'page', 'view'],
        'Backend': ['api', 'database', 'db', 'prisma', 'server', 'service', 'backend', 'route', 'controller'],
        'DevOps': ['deploy', 'docker', 'ci/cd', 'pipeline', 'aws', 'cloud', 'infrastructure', 'config'],
        'Testing': ['test', 'spec', 'e2e', 'unit', 'verify', 'validation'],
        'Architecture': ['design', 'plan', 'structure', 'system', 'diagram', 'adr']
    };

    /**
     * Categorize a task based on its title and content
     */
    public categorizeTask(task: Task): string {
        const text = `${task.title} ${(task as any).description || ''}`.toLowerCase();
        
        for (const [category, keywords] of Object.entries(this.categories)) {
            if (keywords.some(k => text.includes(k))) {
                return category;
            }
        }
        
        return 'General';
    }

    /**
     * Update specialization scores based on task outcome
     */
    public updateSpecialization(
        currentSpecialization: Record<string, number>,
        category: string,
        success: boolean,
        complexity: number = 0.5
    ): Record<string, number> {
        const newSpecs = { ...currentSpecialization };
        
        if (!newSpecs[category]) {
            newSpecs[category] = 0.0;
        }

        // Baldwinian Learning: Success reinforces the pathway
        if (success) {
            // Gain is proportional to complexity
            const gain = 0.05 * (1 + complexity);
            newSpecs[category] = Math.min(1.0, newSpecs[category] + gain);
        } else {
            // Failure causes slight doubt/atrophy in that specific area
            newSpecs[category] = Math.max(0.0, newSpecs[category] - 0.02);
        }

        return newSpecs;
    }

    /**
     * Get the primary specialization (highest score)
     */
    public getPrimarySpecialization(specs: Record<string, number>): string {
        let maxScore = -1;
        let primary = 'General';
        
        for (const [cat, score] of Object.entries(specs)) {
            if (score > maxScore) {
                maxScore = score;
                primary = cat;
            }
        }
        
        return primary;
    }
}
