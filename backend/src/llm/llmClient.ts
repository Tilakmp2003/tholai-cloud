/**
 * LLM Client: Central routing for multi-provider system
 * Routes requests to appropriate provider based on model config
 */

import { ModelConfig, LLMMessage, LLMResponse } from './types';
import { callOpenRouter } from './providers/openrouterProvider';
import { callGroq } from './providers/groqProvider';
import { callGemini } from './providers/geminiProvider';
import { callBedrock } from './providers/bedrockProvider';
import { callMockLLM, isMockEnabled } from './mockClient';

export async function callLLM(
  modelConfig: ModelConfig,
  messages: LLMMessage[]
): Promise<LLMResponse> {
  const { provider, model, maxTokens, temperature } = modelConfig;

  // Use mock if enabled (for testing without API keys)
  if (isMockEnabled()) {
    console.log(`[LLM Client] Using MOCK mode`);
    return await callMockLLM(messages);
  }

  console.log(`[LLM Client] Routing to ${provider} (${model})`);

  try {
    switch (provider) {
      case 'openrouter':
        return await callOpenRouter(model, messages, maxTokens, temperature);
      
      case 'groq':
        return await callGroq(model, messages, maxTokens, temperature);
      
      case 'gemini':
        return await callGemini(model, messages, maxTokens, temperature);

      case 'bedrock':
        return await callBedrock(model, messages, maxTokens, temperature);
      
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  } catch (error: any) {
    console.error(`[LLM Client] Error with ${provider}:`, error.message);
    
    // Fallback to mock if no API keys configured
    if (!process.env.GEMINI_API_KEY && !process.env.OPENROUTER_API_KEY) {
      console.log('[LLM Client] No API keys configured, falling back to mock...');
      return await callMockLLM(messages);
    }
    
    // Fallback to Gemini if primary provider fails
    if (provider !== 'gemini') {
      console.log('[LLM Client] Falling back to Gemini...');
      return await callGemini('gemini-2.0-flash', messages, maxTokens, temperature);
    }
    
    throw error;
  }
}
