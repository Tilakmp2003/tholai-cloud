import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { LLMMessage, LLMResponse } from '../types';

const client = new BedrockRuntimeClient({ region: process.env.AWS_REGION || "ap-south-1" });

export async function callBedrock(
  model: string,
  messages: LLMMessage[],
  maxTokens: number,
  temperature: number
): Promise<LLMResponse> {
  try {
    // Convert messages to Llama 3 format (or generic Bedrock format)
    // For Llama 3:
    // <|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\n...<|eot_id|>...
    
    // However, Bedrock's Converse API is easier, but let's stick to InvokeModel for broad compatibility
    // Using the standard Llama 3 prompt format construction
    
    let prompt = "<|begin_of_text|>";
    
    // Add system prompt if exists (usually first message)
    const systemMsg = messages.find(m => m.role === 'system');
    if (systemMsg) {
        prompt += `<|start_header_id|>system<|end_header_id|>\n\n${systemMsg.content}<|eot_id|>`;
    }
    
    // Add conversation history
    for (const msg of messages) {
        if (msg.role === 'system') continue;
        prompt += `<|start_header_id|>${msg.role}<|end_header_id|>\n\n${msg.content}<|eot_id|>`;
    }
    
    // Add assistant header for generation
    prompt += "<|start_header_id|>assistant<|end_header_id|>\n\n";

    const input = {
      modelId: model, // e.g., "meta.llama3-70b-instruct-v1:0"
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        prompt,
        max_gen_len: maxTokens,
        temperature,
        top_p: 0.9,
      }),
    };

    const command = new InvokeModelCommand(input);
    const response = await client.send(command);
    
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const completion = responseBody.generation;

    return {
      content: completion,
      usage: {
        promptTokens: responseBody.prompt_token_count,
        completionTokens: responseBody.generation_token_count,
        totalTokens: responseBody.prompt_token_count + responseBody.generation_token_count
      }
    };
  } catch (error: any) {
    console.error('[Bedrock Provider] Error:', error);
    throw new Error(`Bedrock API error: ${error.message}`);
  }
}
