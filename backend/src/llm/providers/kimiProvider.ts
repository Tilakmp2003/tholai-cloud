/**
 * Kimi K2 Thinking Provider
 * Uses Kimi's Moonshot API (OpenAI-compatible)
 */

import OpenAI from 'openai';
import { LLMMessage, LLMResponse } from '../types';

if (!process.env.KIMI_API_KEY) {
  throw new Error('KIMI_API_KEY environment variable is not set');
}

const kimi = new OpenAI({
  apiKey: process.env.KIMI_API_KEY,
  baseURL: process.env.KIMI_BASE_URL || 'https://api.moonshot.cn/v1',
});

export async function callKimi(
  model: string,
  messages: LLMMessage[],
  maxTokens: number,
  temperature: number
): Promise<LLMResponse> {
  try {
    // Kimi K2 Thinking recommends temperature 1.0
    const completionTemp = model === 'kimi-k2-thinking' ? 1.0 : temperature;
    
    const completion = await kimi.chat.completions.create({
      model,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      max_tokens: maxTokens,
      temperature: completionTemp,
    });

    const choice = completion.choices[0];
    if (!choice || !choice.message?.content) {
      throw new Error('Kimi returned empty response');
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
    console.error('[Kimi Provider] Error:', error.message);
    throw new Error(`Kimi API error: ${error.message}`);
  }
}
