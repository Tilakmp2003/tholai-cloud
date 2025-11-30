/**
 * OpenRouter Provider
 * Provides access to DeepSeek R1:free and other models via OpenRouter
 */

import { LLMMessage, LLMResponse } from '../types';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

if (!OPENROUTER_API_KEY) {
  console.warn('[OpenRouter Provider] OPENROUTER_API_KEY not set. OpenRouter will be unavailable.');
}
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

export async function callOpenRouter(
  model: string,
  messages: LLMMessage[],
  maxTokens: number,
  temperature: number
): Promise<LLMResponse> {
  try {
    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3001', // Optional, for rankings
        'X-Title': 'AI Company Platform', // Optional, for rankings
      },
      body: JSON.stringify({
        model,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        max_tokens: maxTokens,
        temperature,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OpenRouter API error ${res.status}: ${text}`);
    }

    const data = await res.json() as any;
    const choice = data.choices[0];
    
    if (!choice || !choice.message?.content) {
      throw new Error('OpenRouter returned empty response');
    }

    return {
      content: choice.message.content,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
    };
  } catch (error: any) {
    console.error('[OpenRouter Provider] Error:', error.message);
    throw new Error(`OpenRouter API error: ${error.message}`);
  }
}
