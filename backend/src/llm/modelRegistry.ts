/**
 * Model Registry: Default model configurations for each agent role
 * 
 * Strategy:
 * - Brains 🧠 (Kimi K2): Strategic thinking, critical decisions
 * - Hands 🤖 (Groq Llama): High-volume execution tasks
 */

import { ModelConfig } from './types';

export const RoleModelDefaults: Record<string, ModelConfig> = {
  // === BRAINS 🧠 (DeepSeek R1 via OpenRouter) ===
  // Use for strategic roles requiring deep reasoning
  // DeepSeek R1:free is powerful and completely free!
  
  HeadAgent: {
    provider: 'openrouter',
    model: 'deepseek/deepseek-r1:free',
    maxTokens: 4096,
    temperature: 0.2,
  },
  
  TeamLead: {
    provider: 'openrouter',
    model: 'deepseek/deepseek-r1:free',
    maxTokens: 4096,
    temperature: 0.2,
  },
  
  Architect: {
    provider: 'openrouter',
    model: 'deepseek/deepseek-r1:free',
    maxTokens: 4096,
    temperature: 0.15,
  },
  
  SeniorDev: {
    provider: 'openrouter',
    model: 'deepseek/deepseek-r1:free',
    maxTokens: 3584,
    temperature: 0.2,
  },
  
  // === HANDS 🤖 (Groq Llama 3.3 70B) ===
  // Use for high-volume execution tasks
  
  MidDev: {
    provider: 'groq',
    model: 'llama-3.3-70b-versatile',
    maxTokens: 3072,
    temperature: 0.4,
  },
  
  JuniorDev: {
    provider: 'groq',
    model: 'llama-3.3-70b-versatile',
    maxTokens: 2048,
    temperature: 0.6,
  },
  
  QA: {
    provider: 'openrouter',
    model: 'deepseek/deepseek-chat',
    maxTokens: 4096,
    temperature: 0.2,
  },
  
  Reviewer: {
    provider: 'groq',
    model: 'llama-3.3-70b-versatile',
    maxTokens: 3072,
    temperature: 0.3,
  },
  
  Canary: {
    provider: 'groq',
    model: 'llama-3.3-70b-versatile',
    maxTokens: 1024,
    temperature: 0.1,
  },
  
  SocraticInterrogator: {
    provider: 'groq',
    model: 'llama-3.3-70b-versatile',
    maxTokens: 2048,
    temperature: 0.5,
  },
};

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Get model config for a role from the database
 */
export async function getAgentConfig(role: string): Promise<ModelConfig> {
  try {
    const agent = await prisma.agent.findFirst({
      where: { role }
    });

    if (agent && agent.modelConfig) {
      const config = agent.modelConfig as any;
      // Use primary config by default
      const primary = config.primary;
      return {
        provider: primary.provider,
        model: primary.model,
        maxTokens: primary.max_tokens,
        temperature: primary.temperature,
        region: primary.region,
        estimatedCost: primary.estimated_cost_per_1k_tokens_usd
      };
    }
  } catch (error) {
    console.error(`[ModelRegistry] Failed to fetch config for ${role}:`, error);
  }

  // Fallback if DB fails or agent not found
  console.warn(`[ModelRegistry] Using fallback default for ${role}`);
  return RoleModelDefaults[role] || {
    provider: 'groq',
    model: 'llama-3.3-70b-versatile',
    maxTokens: 3072,
    temperature: 0.4,
  };
}
