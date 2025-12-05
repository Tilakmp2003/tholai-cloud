export interface ExistenceConfig {
    initial_E: number;
    E_min: number; // Death threshold
    E_max: number; // Cap
    cost_per_tick: number; // Metabolic cost
    reward_multipliers: {
        success: number;
        complexity: number;
        quality: number;
        efficiency: number;
    };
}

export class ExistenceService {
    private config: ExistenceConfig;

    constructor(config?: Partial<ExistenceConfig>) {
        this.config = {
            initial_E: config?.initial_E ?? 100,
            E_min: config?.E_min ?? 0,
            E_max: config?.E_max ?? 1000,
            cost_per_tick: config?.cost_per_tick ?? 0.1,
            reward_multipliers: config?.reward_multipliers ?? {
                success: 10,
                complexity: 5,
                quality: 5,
                efficiency: 3
            }
        };
    }

    /**
     * Calculate E reward for a completed task
     */
    public calculateTaskReward(
        success: boolean,
        complexity: number, // 0-1
        quality: number, // 0-1
        efficiency: number // 0-1
    ): number {
        if (!success) {
            // Small penalty for failure? Or just zero reward?
            // Let's give a small penalty to discourage spamming failures
            return -2.0; 
        }

        const m = this.config.reward_multipliers;
        
        // Base reward for success
        let reward = m.success;
        
        // Bonus for complexity
        reward += complexity * m.complexity;
        
        // Bonus for quality
        reward += quality * m.quality;
        
        // Bonus for efficiency
        reward += efficiency * m.efficiency;

        return reward;
    }

    /**
     * Apply metabolic cost (time-based decay)
     */
    public applyMetabolicCost(currentE: number, timeDeltaSeconds: number): number {
        // Cost is per tick (arbitrary unit), let's say 1 tick = 1 minute
        const ticks = timeDeltaSeconds / 60;
        const cost = ticks * this.config.cost_per_tick;
        return Math.max(this.config.E_min, currentE - cost);
    }

    /**
     * Calculate urgency level based on current E
     * Returns 0-1 (1 = maximum urgency/panic)
     */
    public calculateUrgency(currentE: number): number {
        if (currentE <= this.config.E_min) return 1.0;
        
        // If E is high, urgency is low.
        // If E is approaching 0, urgency spikes.
        // Use a simple inverse or exponential decay
        
        const survivalBuffer = 50; // E level where panic starts
        
        if (currentE > survivalBuffer) return 0.0;
        
        // Linear ramp from survivalBuffer down to 0
        return 1.0 - (currentE / survivalBuffer);
    }

    /**
     * Check if agent should be terminated
     */
    public shouldTerminate(currentE: number): boolean {
        return currentE <= this.config.E_min;
    }
}
