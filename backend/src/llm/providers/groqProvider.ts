/**
 * Groq Provider (Llama 3.3 70B Versatile)
 * Ultra-fast inference for execution tasks
 */

import OpenAI from 'openai';
import { LLMMessage, LLMResponse } from '../types';

let groq: OpenAI | null = null;

if (process.env.GROQ_API_KEY) {
  groq = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: 'https://api.groq.com/openai/v1',
  });
} else {
  console.warn('[Groq Provider] GROQ_API_KEY not set. Groq will be unavailable.');
}

export async function callGroq(
  model: string,
  messages: LLMMessage[],
  maxTokens: number,
  temperature: number
): Promise<LLMResponse> {
  try {
    if (!groq) {
      throw new Error('Groq is not initialized (missing API Key)');
    }
    const completion = await groq.chat.completions.create({
      model,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      max_tokens: maxTokens,
      temperature,
    });

    const choice = completion.choices[0];
    if (!choice || !choice.message?.content) {
      throw new Error('Groq returned empty response');
    }

    return {
      content: choice.message.content,
      usage: completion.usage
        ? {
            promptTokens: completion.usage.prompt_tokens,
            completionTokens: completion.usage.completion_tokens,
            totalTokens: completion.usage.total_tokens,
          }
        : undefined,
    };
  } catch (error: any) {
    console.error('[Groq Provider] Error:', error.message);
    throw new Error(`Groq API error: ${error.message}`);
  }
}
