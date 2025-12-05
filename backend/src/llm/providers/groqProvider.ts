/**
 * Groq Provider (Llama 3.3 70B Versatile)
 * Ultra-fast inference for execution tasks
 */

import OpenAI from "openai";
import { LLMMessage, LLMResponse } from "../types";

// Lazy initialization to allow dotenv to load first
let groq: OpenAI | null = null;
let initialized = false;

function getGroqClient(): OpenAI | null {
  if (!initialized) {
    initialized = true;
    if (process.env.GROQ_API_KEY) {
      groq = new OpenAI({
        apiKey: process.env.GROQ_API_KEY,
        baseURL: "https://api.groq.com/openai/v1",
      });
    } else {
      console.warn(
        "[Groq Provider] GROQ_API_KEY not set. Groq will be unavailable."
      );
    }
  }
  return groq;
}

export async function callGroq(
  model: string,
  messages: LLMMessage[],
  maxTokens: number,
  temperature: number
): Promise<LLMResponse> {
  try {
    const client = getGroqClient();
    if (!client) {
      throw new Error("Groq is not initialized (missing API Key)");
    }
    const completion = await client.chat.completions.create({
      model,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      max_tokens: maxTokens,
      temperature,
    });

    const choice = completion.choices[0];
    if (!choice || !choice.message?.content) {
      throw new Error("Groq returned empty response");
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
    console.error("[Groq Provider] Error:", error.message);
    throw new Error(`Groq API error: ${error.message}`);
  }
}
