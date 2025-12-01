/**
 * Model Registry: Default model configurations for each agent role
 * 
 * Strategy:
 * - Brains 🧠 (Kimi K2): Strategic thinking, critical decisions
 * - Hands 🤖 (Groq Llama): High-volume execution tasks
 */

import { ModelConfig } from './types';

export const RoleModelDefaults: Record<string, ModelConfig> = {
  // === BRAINS 🧠 (DeepSeek R1 via Bedrock) ===
  // Use for strategic roles requiring deep reasoning
  
  HeadAgent: {
    provider: 'bedrock',
    model: 'us.deepseek.r1-v1:0',
    maxTokens: 4096,
    temperature: 0.2,
    region: 'us-east-1'
  },
  
  TeamLead: {
    provider: 'bedrock',
    model: 'us.deepseek.r1-v1:0',
    maxTokens: 4096,
    temperature: 0.2,
    region: 'us-east-1'
  },
  
  Architect: {
    provider: 'bedrock',
    model: 'us.deepseek.r1-v1:0',
    maxTokens: 4096,
    temperature: 0.15,
    region: 'us-east-1'
  },
  
  SeniorDev: {
    provider: 'bedrock',
    model: 'us.deepseek.r1-v1:0',
    maxTokens: 3584,
    temperature: 0.2,
    region: 'us-east-1'
  },
  
  // === HANDS 🤖 (DeepSeek V3 via Bedrock) ===
  // Use for high-volume execution tasks
  
  MidDev: {
    provider: 'bedrock',
    model: 'deepseek.deepseek-v3:1',
    maxTokens: 3072,
    temperature: 0.4,
    region: 'us-east-1'
  },
  
  JuniorDev: {
    provider: 'bedrock',
    model: 'deepseek.deepseek-v3:1',
    maxTokens: 2048,
    temperature: 0.6,
    region: 'us-east-1'
  },
  
  QA: {
    provider: 'bedrock',
    model: 'deepseek.deepseek-v3:1',
    maxTokens: 4096,
    temperature: 0.2,
    region: 'us-east-1'
  },
  
  Reviewer: {
    provider: 'bedrock',
    model: 'deepseek.deepseek-v3:1',
    maxTokens: 3072,
    temperature: 0.3,
    region: 'us-east-1'
  },
  
  Canary: {
    provider: 'bedrock',
    model: 'deepseek.deepseek-v3:1',
    maxTokens: 1024,
    temperature: 0.1,
    region: 'us-east-1'
  },
  
  SocraticInterrogator: {
    provider: 'bedrock',
    model: 'deepseek.deepseek-v3:1',
    maxTokens: 2048,
    temperature: 0.5,
    region: 'us-east-1'
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
    provider: 'bedrock',
    model: 'deepseek.deepseek-v3:1',
    maxTokens: 3072,
    temperature: 0.4,
    region: 'us-east-1'
  };
}
