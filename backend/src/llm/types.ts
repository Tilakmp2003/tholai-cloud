/**
 * Type definitions for Multi-Provider LLM System
 */

export type Provider = "openrouter" | "groq" | "gemini" | "bedrock";

// Cost per 1K tokens (input/output) for different models
export const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  // Gemini models (very cheap)
  "gemini-2.0-flash": { input: 0.00001, output: 0.00004 },
  "gemini-1.5-flash": { input: 0.000075, output: 0.0003 },
  "gemini-1.5-pro": { input: 0.00125, output: 0.005 },
  // Groq models (free tier available)
  "llama-3.3-70b-versatile": { input: 0.00059, output: 0.00079 },
  "llama-3.1-8b-instant": { input: 0.00005, output: 0.00008 },
  "llama-3.1-70b-versatile": { input: 0.00059, output: 0.00079 },
  "mixtral-8x7b-32768": { input: 0.00024, output: 0.00024 },
  // OpenRouter models
  "anthropic/claude-3.5-sonnet": { input: 0.003, output: 0.015 },
  "anthropic/claude-3-haiku": { input: 0.00025, output: 0.00125 },
  "openai/gpt-4o": { input: 0.005, output: 0.015 },
  "openai/gpt-4o-mini": { input: 0.00015, output: 0.0006 },
  // Bedrock Claude
  "anthropic.claude-3-5-sonnet-20241022-v2:0": { input: 0.003, output: 0.015 },
  "anthropic.claude-3-haiku-20240307-v1:0": { input: 0.00025, output: 0.00125 },
  // AWS Bedrock DeepSeek models (DeepSeek pricing via AWS)
  "deepseek.v3-v1:0": { input: 0.00027, output: 0.0011 }, // DeepSeek V3: $0.27/$1.10 per 1M tokens
  "deepseek.r1-v1:0": { input: 0.00055, output: 0.00219 }, // DeepSeek R1: $0.55/$2.19 per 1M tokens
  "us.deepseek.r1-v1:0": { input: 0.00055, output: 0.00219 }, // Cross-region R1 inference profile
  "eu.deepseek.r1-v1:0": { input: 0.00055, output: 0.00219 }, // EU cross-region R1
};

export interface ModelConfig {
  provider: Provider;
  model: string;
  maxTokens: number;
  temperature: number;
  region?: string;
  estimatedCost?: number;
}

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMResponse {
  content: string;
  usage?:
    | {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
      }
    | undefined;
  costUsd?: number;
}

export interface ProviderConfig {
  apiKey: string;
  baseURL?: string;
}

/**
 * Calculate cost based on model and token usage
 */
export function calculateCost(
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  const costs = MODEL_COSTS[model] || { input: 0.001, output: 0.002 }; // Default fallback
  return (
    (promptTokens / 1000) * costs.input +
    (completionTokens / 1000) * costs.output
  );
}
