/**
 * Gemini Provider (Fallback)
 * Extracted from existing geminiClient.ts
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { LLMMessage, LLMResponse } from '../types';

let genAI: GoogleGenerativeAI | null = null;
if (process.env.GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
} else {
  console.warn('[Gemini Provider] GEMINI_API_KEY not set. Gemini will be unavailable.');
}

export async function callGemini(
  model: string,
  messages: LLMMessage[],
  maxTokens: number,
  temperature: number
): Promise<LLMResponse> {
  try {
    if (!genAI) {
      throw new Error('Gemini is not initialized (missing API Key)');
    }
    const geminiModel = genAI.getGenerativeModel({
      model,
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature,
      },
    });

    // Convert messages to Gemini format
    // Gemini expects alternating user/model messages
    const systemMessage = messages.find(m => m.role === 'system');
    const conversationMessages = messages.filter(m => m.role !== 'system');

    // Combine system prompt with first user message if present
    let prompt = '';
    if (systemMessage) {
      prompt = `${systemMessage.content}\n\n`;
    }
    
    if (conversationMessages.length > 0) {
      prompt += conversationMessages.map(m => m.content).join('\n\n');
    }

    const result = await geminiModel.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    return {
      content: text,
      usage: response.usageMetadata
        ? {
            promptTokens: response.usageMetadata.promptTokenCount || 0,
            completionTokens: response.usageMetadata.candidatesTokenCount || 0,
            totalTokens: response.usageMetadata.totalTokenCount || 0,
          }
        : undefined,
    };
  } catch (error: any) {
    console.error('[Gemini Provider] Error:', error.message);
    throw new Error(`Gemini API error: ${error.message}`);
  }
}
