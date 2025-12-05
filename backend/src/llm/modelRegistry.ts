/**
 * Model Registry: Default model configurations for each agent role
 *
 * Strategy:
 * - Brains 🧠 (Kimi K2): Strategic thinking, critical decisions
 * - Hands 🤖 (Groq Llama): High-volume execution tasks
 */

import { ModelConfig } from "./types";

export const RoleModelDefaults: Record<string, ModelConfig> = {
  // === ALL AGENTS (DeepSeek V3 via Bedrock) ===
  // V3 provides clean structured output, faster response times

  HeadAgent: {
    provider: "bedrock",
    model: "deepseek.v3-v1:0",
    maxTokens: 4096,
    temperature: 0.2,
    region: "ap-south-1",
  },

  TeamLead: {
    provider: "bedrock",
    model: "deepseek.v3-v1:0",
    maxTokens: 4096,
    temperature: 0.2,
    region: "ap-south-1",
  },

  Architect: {
    provider: "bedrock",
    model: "deepseek.v3-v1:0",
    maxTokens: 4096,
    temperature: 0.15,
    region: "ap-south-1",
  },

  SeniorDev: {
    provider: "bedrock",
    model: "deepseek.v3-v1:0",
    maxTokens: 3584,
    temperature: 0.2,
    region: "ap-south-1",
  },

  // === HANDS 🤖 (DeepSeek V3 via Bedrock) ===
  // Use for high-volume execution tasks

  MidDev: {
    provider: "bedrock",
    model: "deepseek.v3-v1:0",
    maxTokens: 3072,
    temperature: 0.4,
    region: "ap-south-1",
  },

  JuniorDev: {
    provider: "bedrock",
    model: "deepseek.v3-v1:0",
    maxTokens: 2048,
    temperature: 0.6,
    region: "ap-south-1",
  },

  QA: {
    provider: "bedrock",
    model: "deepseek.v3-v1:0",
    maxTokens: 4096,
    temperature: 0.2,
    region: "ap-south-1",
  },

  Reviewer: {
    provider: "bedrock",
    model: "deepseek.v3-v1:0",
    maxTokens: 3072,
    temperature: 0.3,
    region: "ap-south-1",
  },

  Canary: {
    provider: "bedrock",
    model: "deepseek.v3-v1:0",
    maxTokens: 1024,
    temperature: 0.1,
    region: "ap-south-1",
  },

  SocraticInterrogator: {
    provider: "bedrock",
    model: "deepseek.v3-v1:0",
    maxTokens: 2048,
    temperature: 0.5,
    region: "ap-south-1",
  },
};

import { prisma } from "../lib/prisma";

/**
 * Get model config for a role from the database
 */
export async function getAgentConfig(role: string): Promise<ModelConfig> {
  try {
    const agent = await prisma.agent.findFirst({
      where: { role },
    });

    if (agent && agent.modelConfig) {
      const config = agent.modelConfig as any;
      // Use primary config by default, with safety checks
      const primary = config.primary || config;

      // Ensure primary has required fields before using
      if (primary && primary.provider && primary.model) {
        return {
          provider: primary.provider,
          model: primary.model,
          maxTokens: primary.max_tokens || primary.maxTokens || 3072,
          temperature: primary.temperature ?? 0.4,
          region: primary.region || "ap-south-1",
          estimatedCost: primary.estimated_cost_per_1k_tokens_usd,
        };
      }
    }
  } catch (error) {
    console.error(`[ModelRegistry] Failed to fetch config for ${role}:`, error);
  }

  // Fallback if DB fails or agent not found
  console.warn(`[ModelRegistry] Using fallback default for ${role}`);
  return (
    RoleModelDefaults[role] || {
      provider: "bedrock",
      model: "deepseek.v3-v1:0",
      maxTokens: 3072,
      temperature: 0.4,
      region: "ap-south-1",
    }
  );
}

/**
 * Get default model config for a role (synchronous, from RoleModelDefaults)
 */
export function getDefaultModelConfig(role: string): ModelConfig {
  return (
    RoleModelDefaults[role] || {
      provider: "bedrock",
      model: "deepseek.v3-v1:0",
      maxTokens: 3072,
      temperature: 0.4,
      region: "ap-south-1",
    }
  );
}
