import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { LLMMessage, LLMResponse } from "../types";

// Initialize Clients Lazily by Region
const bedrockClients: Record<string, BedrockRuntimeClient> = {};

function getBedrockClient(
  region: string = process.env.AWS_REGION || "ap-south-1"
) {
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
    const systemMsg = messages.find((m) => m.role === "system");
    const userMsgs = messages.filter((m) => m.role !== "system");
    const systemContent = systemMsg ? systemMsg.content : "";

    // Construct prompt for models that need it
    const userContent = userMsgs
      .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
      .join("\n");

    // Determine model ID - use inference profile for R1
    let modelId = model;

    // 1. DeepSeek V3 (OpenAI Chat Format - messages array)
    if (model.includes("v3")) {
      payload = {
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        max_tokens: maxTokens,
        temperature: temperature,
      };
    }
    // 2. DeepSeek R1 (Uses inference profile with prompt format)
    else if (model.includes("r1")) {
      // R1 requires inference profile - use cross-region profile
      modelId = `us.deepseek.r1-v1:0`;
      payload = {
        messages: [
          ...(systemContent
            ? [{ role: "system", content: systemContent }]
            : []),
          ...userMsgs.map((m) => ({ role: m.role, content: m.content })),
        ],
        max_tokens: maxTokens,
        temperature: temperature,
      };
    }
    // 3. Meta Llama 3
    else if (model.includes("meta.llama")) {
      const prompt = `<|begin_of_text|>${
        systemContent
          ? `<|start_header_id|>system<|end_header_id|>\n\n${systemContent}<|eot_id|>`
          : ""
      }${messages
        .filter((m) => m.role !== "system")
        .map(
          (m) =>
            `<|start_header_id|>${m.role}<|end_header_id|>\n\n${m.content}<|eot_id|>`
        )
        .join("")}<|start_header_id|>assistant<|end_header_id|>\n\n`;

      payload = {
        prompt: prompt,
        max_gen_len: maxTokens,
        temperature: temperature,
      };
    }
    // Fallback - try chat format
    else {
      payload = {
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        max_tokens: maxTokens,
        temperature: temperature,
      };
    }

    const command = new InvokeModelCommand({
      modelId: modelId,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify(payload),
    });

    const client = getBedrockClient(region);
    const response = await client.send(command);

    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    let completion = "";

    // Debug: Log the full response to check token usage
    console.log(
      `[Bedrock Provider] Response keys: ${Object.keys(responseBody).join(
        ", "
      )}`
    );
    if (responseBody.usage) {
      console.log(
        `[Bedrock Provider] Usage data:`,
        JSON.stringify(responseBody.usage)
      );
    } else {
      console.log(
        `[Bedrock Provider] ⚠️ No usage data in response! Full response:`,
        JSON.stringify(responseBody).substring(0, 500)
      );
    }

    // Parse response
    if (responseBody.choices && Array.isArray(responseBody.choices)) {
      const choice = responseBody.choices[0];
      // DeepSeek R1 returns reasoning_content, V3 returns message.content
      if (choice.message) {
        // Prefer content, fallback to reasoning_content for R1
        completion =
          choice.message.content || choice.message.reasoning_content || "";
      } else if (choice.text) {
        // Legacy prompt format
        completion = choice.text;
      }
    } else if (responseBody.generation) {
      completion = responseBody.generation; // Llama
    } else if (responseBody.results) {
      completion = responseBody.results[0].outputText; // Titan
    } else {
      completion = responseBody.text || JSON.stringify(responseBody);
    }

    // Extract token usage from response if available
    const promptTokens =
      responseBody.usage?.prompt_tokens ||
      responseBody.usage?.input_tokens ||
      0;
    const completionTokens =
      responseBody.usage?.completion_tokens ||
      responseBody.usage?.output_tokens ||
      0;

    return {
      content: completion,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      },
    };
  } catch (error: any) {
    console.error("[Bedrock Provider] Error:", error);
    throw new Error(`Bedrock API error: ${error.message}`);
  }
}
