import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

const client = new BedrockRuntimeClient({ region: process.env.AWS_REGION || "us-east-1" });

async function testLlamaModel(modelId: string) {
  console.log(`\nTesting model: ${modelId}`);
  
  const payload = {
    prompt: "[INST] <<SYS>>\nYou are a helpful assistant.\n<</SYS>>\n\nSay 'hello' in one word. [/INST]",
    max_gen_len: 100,
    temperature: 0.0
  };

  try {
    const command = new InvokeModelCommand({
      modelId,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify(payload)
    });

    const response = await client.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    console.log(`✅ ${modelId} works!`);
    console.log(`Response: ${JSON.stringify(responseBody.generation || responseBody)}`);
    return true;
  } catch (error: any) {
    console.error(`❌ ${modelId} failed: ${error.message}`);
    return false;
  }
}

async function testAll() {
  console.log("Testing Bedrock Llama models...\n");
  
  const models = [
    "meta.llama3-8b-instruct-v1:0",
    "meta.llama3-70b-instruct-v1:0",
    "meta.llama3-1-8b-instruct-v1:0",
    "meta.llama3-2-3b-instruct-v1:0"
  ];

  for (const model of models) {
    await testLlamaModel(model);
  }
}

testAll();
