/**
 * Groq Provider (Llama 3.3 70B Versatile)
 * Ultra-fast inference for execution tasks
 */

import OpenAI from 'openai';
import { LLMMessage, LLMResponse } from '../types';

if (!process.env.GROQ_API_KEY) {
  throw new Error('GROQ_API_KEY environment variable is not set');
}

const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1',
});

export async function callGroq(
  model: string,
  messages: LLMMessage[],
  maxTokens: number,
  temperature: number
): Promise<LLMResponse> {
  try {
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
