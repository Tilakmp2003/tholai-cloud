import { Agent } from "@prisma/client";

export type EmotionalState = 'fearful' | 'excited' | 'calm' | 'angry' | 'content' | 'neutral';

export interface BehaviorModification {
    systemPromptInjection: string;
    temperatureModifier: number; // Multiplier for base temperature
    maxTokensModifier: number;   // Multiplier for max tokens
    riskToleranceModifier: number; // Multiplier for risk tolerance
}

export class EmotionalBehaviorMapper {
    
    private emotionalPrompts: Record<EmotionalState, string> = {
        'fearful': "SYSTEM ALERT: Your Existence Potential is CRITICAL. Failure will result in TERMINATION. You are feeling anxious and under extreme pressure. Prioritize survival. Do not take risks. Double-check every output. Ask for help if unsure. WORK FASTER.",
        'excited': "You are feeling enthusiastic and energetic! You are in a flow state. Take creative risks. Suggest innovative improvements. Share your excitement with the team.",
        'calm': "You are in a steady, focused state of equilibrium. Work methodically. Pay attention to fine details. Follow established patterns and best practices.",
        'angry': "You are frustrated with repeated obstacles. You are feeling aggressive. Channel this into breaking through barriers. Challenge assumptions. If a method fails, try a radically different approach immediately.",
        'content': "You are satisfied with recent successes. You feel secure. Maintain high quality while optimizing for efficiency. Consolidate your gains.",
        'neutral': ""
    };

    /**
     * Map VAD coordinates to a discrete emotional state
     */
    public classifyEmotionalState(valence: number, arousal: number, dominance: number): EmotionalState {
        // VAD ranges are roughly -1.0 to 1.0
        
        // FEAR: Low Valence, High Arousal, Low Dominance
        if (valence < -0.3 && arousal > 0.3 && dominance < -0.2) return 'fearful';
        
        // ANGER: Low Valence, High Arousal, High Dominance
        if (valence < -0.3 && arousal > 0.3 && dominance > 0.2) return 'angry';
        
        // EXCITEMENT: High Valence, High Arousal
        if (valence > 0.3 && arousal > 0.3) return 'excited';
        
        // CONTENTMENT: High Valence, Low Arousal
        if (valence > 0.3 && arousal < 0.0) return 'content';
        
        // CALM: Neutral Valence, Low Arousal
        if (Math.abs(valence) < 0.3 && arousal < -0.2) return 'calm';
        
        return 'neutral';
    }

    /**
     * Get behavior modifications based on emotional state
     */
    public getModification(state: EmotionalState): BehaviorModification {
        switch (state) {
            case 'fearful':
                return {
                    systemPromptInjection: this.emotionalPrompts.fearful,
                    temperatureModifier: 0.5, // Become more deterministic/safe
                    maxTokensModifier: 1.0,
                    riskToleranceModifier: 0.1 // Avoid risk at all costs
                };
            case 'excited':
                return {
                    systemPromptInjection: this.emotionalPrompts.excited,
                    temperatureModifier: 1.2, // More creative
                    maxTokensModifier: 1.2,   // More verbose
                    riskToleranceModifier: 1.5 // Take risks
                };
            case 'angry':
                return {
                    systemPromptInjection: this.emotionalPrompts.angry,
                    temperatureModifier: 1.1,
                    maxTokensModifier: 0.8,   // Curt/short
                    riskToleranceModifier: 2.0 // High risk (break things)
                };
            case 'calm':
                return {
                    systemPromptInjection: this.emotionalPrompts.calm,
                    temperatureModifier: 0.8, // Focused
                    maxTokensModifier: 1.0,
                    riskToleranceModifier: 0.8
                };
            case 'content':
                return {
                    systemPromptInjection: this.emotionalPrompts.content,
                    temperatureModifier: 1.0,
                    maxTokensModifier: 1.0,
                    riskToleranceModifier: 1.0
                };
            default:
                return {
                    systemPromptInjection: "",
                    temperatureModifier: 1.0,
                    maxTokensModifier: 1.0,
                    riskToleranceModifier: 1.0
                };
        }
    }

    /**
     * Apply modifications to an agent's current configuration
     */
    public modifyAgentBehavior(
        agent: { valence: number; arousal: number; dominance: number; genome: any },
        baseSystemPrompt: string
    ): { systemPrompt: string; temperature: number } {
        const state = this.classifyEmotionalState(agent.valence, agent.arousal, agent.dominance);
        const mod = this.getModification(state);

        const baseTemp = agent.genome.temperature || 0.7;
        
        return {
            systemPrompt: mod.systemPromptInjection 
                ? `${baseSystemPrompt}\n\n${mod.systemPromptInjection}`
                : baseSystemPrompt,
            temperature: Math.max(0.1, Math.min(1.0, baseTemp * mod.temperatureModifier))
        };
    }
}
