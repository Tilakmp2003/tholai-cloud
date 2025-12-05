/**
 * LLM Client: Central routing for multi-provider system
 * Routes requests to appropriate provider based on model config
 */

import { ModelConfig, LLMMessage, LLMResponse, calculateCost } from "./types";
import { callOpenRouter } from "./providers/openrouterProvider";
import { callGroq } from "./providers/groqProvider";
import { callGemini } from "./providers/geminiProvider";
import { callBedrock } from "./providers/bedrockProvider";
import { callMockLLM, isMockEnabled } from "./mockClient";

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
    let response: LLMResponse;

    switch (provider) {
      case "openrouter":
        response = await callOpenRouter(
          model,
          messages,
          maxTokens,
          temperature
        );
        break;

      case "groq":
        response = await callGroq(model, messages, maxTokens, temperature);
        break;

      case "gemini":
        response = await callGemini(model, messages, maxTokens, temperature);
        break;

      case "bedrock":
        response = await callBedrock(
          model,
          messages,
          maxTokens,
          temperature,
          modelConfig.region
        );
        break;

      default:
        throw new Error(`Unknown provider: ${provider}`);
    }

    // Calculate and attach cost if usage is available
    if (response.usage) {
      response.costUsd = calculateCost(
        model,
        response.usage.promptTokens,
        response.usage.completionTokens
      );
      console.log(
        `[LLM Client] Cost: $${response.costUsd.toFixed(6)} (${
          response.usage.totalTokens
        } tokens)`
      );
    }

    return response;
  } catch (error: any) {
    console.error(`[LLM Client] Error with ${provider}:`, error.message);

    // Fallback chain: Try multiple providers before giving up
    const fallbackProviders = ["groq", "openrouter", "gemini", "mock"];

    for (const fallbackProvider of fallbackProviders) {
      // Skip the provider that already failed
      if (fallbackProvider === provider) continue;

      console.log(`[LLM Client] Trying fallback provider: ${fallbackProvider}`);

      try {
        if (fallbackProvider === "mock") {
          return await callMockLLM(messages);
        }

        if (fallbackProvider === "groq" && process.env.GROQ_API_KEY) {
          return await callGroq(
            "llama-3.1-70b-versatile",
            messages,
            maxTokens,
            temperature
          );
        }

        if (
          fallbackProvider === "openrouter" &&
          process.env.OPENROUTER_API_KEY
        ) {
          return await callOpenRouter(
            "anthropic/claude-3-haiku",
            messages,
            maxTokens,
            temperature
          );
        }

        if (fallbackProvider === "gemini" && process.env.GEMINI_API_KEY) {
          return await callGemini(
            "gemini-2.0-flash",
            messages,
            maxTokens,
            temperature
          );
        }
      } catch (fallbackError: any) {
        console.error(
          `[LLM Client] Fallback ${fallbackProvider} also failed:`,
          fallbackError.message
        );
        continue;
      }
    }

    // All providers failed - use mock as last resort
    console.log("[LLM Client] All providers failed, using mock response...");
    return await callMockLLM(messages);
  }
}
