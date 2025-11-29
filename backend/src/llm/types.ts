/**
 * Type definitions for Multi-Provider LLM System
 */

export type Provider = 'openrouter' | 'groq' | 'gemini';

export interface ModelConfig {
  provider: Provider;
  model: string;
  maxTokens: number;
  temperature: number;
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  } | undefined;
}

export interface ProviderConfig {
  apiKey: string;
  baseURL?: string;
}
