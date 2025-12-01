import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

// Initialize Clients Lazily by Region
const bedrockClients: Record<string, BedrockRuntimeClient> = {};

function getBedrockClient(region: string = process.env.AWS_REGION || "us-east-1") {
  if (!bedrockClients[region]) {
    console.log(`[LLM] Initializing Bedrock client for region: ${region}`);
    bedrockClients[region] = new BedrockRuntimeClient({ region });
  }
  return bedrockClients[region];
}

export interface ModelConfig {
  provider: "bedrock";
  model: string;
  region?: string; // Optional region override
  temperature: number;
  max_tokens: number;
  estimated_cost_per_1k_tokens_usd: number;
}

export interface LLMResult {
  text: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
}

/**
 * Estimates token count (Simple approximation: 1 token ~= 4 chars)
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Estimates cost based on input/output tokens and model rate.
 */
export function estimateCost(tokensIn: number, tokensOut: number, costPer1k: number): number {
  return ((tokensIn + tokensOut) / 1000) * costPer1k;
}

/**
 * Invokes the LLM using AWS Bedrock.
 */
export async function invokeModel(
  config: ModelConfig,
  systemPrompt: string,
  userPrompt: string
): Promise<LLMResult> {
  const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;
  const tokensIn = estimateTokens(fullPrompt);

  console.log(`[LLM] Invoking Bedrock model: ${config.model} (Temp: ${config.temperature})`);

  try {
    const text = await invokeBedrock(config, systemPrompt, userPrompt);
    const tokensOut = estimateTokens(text); // Bedrock often doesn't return usage in simple response
    const costUsd = estimateCost(tokensIn, tokensOut, config.estimated_cost_per_1k_tokens_usd);

    return {
      text,
      tokensIn,
      tokensOut,
      costUsd
    };

  } catch (error) {
    console.error(`[LLM] Error invoking Bedrock model ${config.model}:`, error);
    throw error;
  }
}

async function invokeBedrock(config: ModelConfig, system: string, user: string): Promise<string> {
  let payload: any = {};

  // 1. Anthropic Claude (Messages API format for Bedrock)
  if (config.model.includes("anthropic.claude")) {
    payload = {
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: config.max_tokens,
      temperature: config.temperature,
      system: system, // Claude 3/3.5 supports top-level system param
      messages: [
        { role: "user", content: user }
      ]
    };
  } 
  // 2. DeepSeek V3 (Chat Format)
  else if (config.model.includes("deepseek.v3")) {
    payload = {
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      max_tokens: config.max_tokens,
      temperature: config.temperature
    };
  }
  // 3. DeepSeek R1 (Prompt Format - Legacy/Specific)
  else if (config.model.toLowerCase().includes("deepseek")) {
     payload = {
       prompt: `${system}\n\n${user}`,
       max_tokens: config.max_tokens,
       temperature: config.temperature
     };
  }
  // 4. Meta Llama 2/3
  else if (config.model.includes("meta.llama")) {
    const prompt = `[INST] <<SYS>>\n${system}\n<</SYS>>\n\n${user} [/INST]`;
    payload = {
      prompt: prompt,
      max_gen_len: config.max_tokens,
      temperature: config.temperature
    };
  }
  // 5. Amazon Titan
  else if (config.model.includes("amazon.titan")) {
    payload = {
      inputText: `${system}\n\n${user}`,
      textGenerationConfig: {
        maxTokenCount: config.max_tokens,
        temperature: config.temperature
      }
    };
  }
  // Fallback / Generic
  else {
    // Default to a generic prompt structure
    payload = {
      prompt: `${system}\n\n${user}`,
      max_tokens: config.max_tokens,
      temperature: config.temperature
    };
  }

  console.log(`[LLM] Payload for ${config.model}:`, JSON.stringify(payload, null, 2));

  try {
    const command = new InvokeModelCommand({
      modelId: config.model,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify(payload)
    });

    const response = await getBedrockClient(config.region).send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    return parseResponse(responseBody);

  } catch (error: any) {
    console.error(`[LLM] Bedrock Error for ${config.model}:`, error.message);
    console.error(`[LLM] Full Error:`, JSON.stringify(error, null, 2));
    if (error.$metadata) {
      console.error(`[LLM] Request ID: ${error.$metadata.requestId}`);
    }
    throw error;
  }
}

function parseResponse(responseBody: any): string {
  // Parse response based on model family
  if (responseBody.content && Array.isArray(responseBody.content)) {
    return responseBody.content[0].text; // Claude 3/3.5
  } else if (responseBody.choices && Array.isArray(responseBody.choices)) {
    // DeepSeek V3 (Chat)
    if (responseBody.choices[0].message && responseBody.choices[0].message.content) {
      return responseBody.choices[0].message.content;
    }
    // DeepSeek R1 (Prompt)
    return responseBody.choices[0].text; 
  } else if (responseBody.generation) {
    return responseBody.generation; // Llama
  } else if (responseBody.results) {
    return responseBody.results[0].outputText; // Titan
  } else if (typeof responseBody === 'string') {
      return responseBody;
  }
  return responseBody.text || JSON.stringify(responseBody);
}

