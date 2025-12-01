import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { LLMMessage, LLMResponse } from '../types';

// Initialize Clients Lazily by Region
const bedrockClients: Record<string, BedrockRuntimeClient> = {};

function getBedrockClient(region: string = process.env.AWS_REGION || "ap-south-1") {
  if (!bedrockClients[region]) {
    console.log(`[Bedrock Provider] Initializing client for region: ${region}`);
    bedrockClients[region] = new BedrockRuntimeClient({ region });
  }
  return bedrockClients[region];
}

export async function callBedrock(
  model: string,
  messages: LLMMessage[],
  maxTokens: number,
  temperature: number,
  region?: string
): Promise<LLMResponse> {
  try {
    let payload: any = {};
    const systemMsg = messages.find(m => m.role === 'system');
    const userMsgs = messages.filter(m => m.role !== 'system');
    const systemContent = systemMsg ? systemMsg.content : "";
    
    // Construct prompt for models that need it
    const userContent = userMsgs.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join("\n");

    // 1. DeepSeek V3 (Chat Format)
    if (model.includes("deepseek.v3")) {
      payload = {
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        max_tokens: maxTokens,
        temperature: temperature
      };
    }
    // 2. DeepSeek R1 (Prompt Format)
    else if (model.toLowerCase().includes("deepseek")) {
       payload = {
         prompt: `${systemContent}\n\n${userContent}`,
         max_tokens: maxTokens,
         temperature: temperature
       };
    }
    // 3. Meta Llama 3
    else if (model.includes("meta.llama")) {
      const prompt = `<|begin_of_text|>${systemContent ? `<|start_header_id|>system<|end_header_id|>\n\n${systemContent}<|eot_id|>` : ''}${messages.filter(m => m.role !== 'system').map(m => `<|start_header_id|>${m.role}<|end_header_id|>\n\n${m.content}<|eot_id|>`).join('')}<|start_header_id|>assistant<|end_header_id|>\n\n`;
      
      payload = {
        prompt: prompt,
        max_gen_len: maxTokens,
        temperature: temperature
      };
    }
    // Fallback
    else {
      payload = {
        prompt: `${systemContent}\n\n${userContent}`,
        max_tokens: maxTokens,
        temperature: temperature
      };
    }

    const command = new InvokeModelCommand({
      modelId: model,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify(payload)
    });

    const client = getBedrockClient(region);
    const response = await client.send(command);
    
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    let completion = "";

    // Parse response
    if (responseBody.choices && Array.isArray(responseBody.choices)) {
       // DeepSeek V3 (Chat)
       if (responseBody.choices[0].message && responseBody.choices[0].message.content) {
         completion = responseBody.choices[0].message.content;
       } else {
         // DeepSeek R1 (Prompt)
         completion = responseBody.choices[0].text;
       }
    } else if (responseBody.generation) {
      completion = responseBody.generation; // Llama
    } else if (responseBody.results) {
      completion = responseBody.results[0].outputText; // Titan
    } else {
      completion = responseBody.text || JSON.stringify(responseBody);
    }

    return {
      content: completion,
      usage: {
        promptTokens: 0, // Bedrock doesn't always return this in standard response
        completionTokens: 0,
        totalTokens: 0
      }
    };
  } catch (error: any) {
    console.error('[Bedrock Provider] Error:', error);
    throw new Error(`Bedrock API error: ${error.message}`);
  }
}
