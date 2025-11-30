import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

const client = new BedrockRuntimeClient({ region: process.env.AWS_REGION || "us-east-1" });

async function testModel(modelId: string) {
  console.log(`\nTesting model: ${modelId}`);
  
  const payload = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 100,
    temperature: 0.0,
    system: "You are a helpful assistant.",
    messages: [
      { role: "user", content: "Say 'hello' in one word." }
    ]
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
    console.log(`Response: ${JSON.stringify(responseBody.content[0].text)}`);
    return true;
  } catch (error: any) {
    console.error(`❌ ${modelId} failed: ${error.message}`);
    return false;
  }
}

async function testAll() {
  console.log("Testing Bedrock Claude models...\n");
  
  const models = [
    "anthropic.claude-3-5-sonnet-20240620-v1:0",
    "anthropic.claude-3-5-haiku-20241022-v1:0",
    "an thropid.claude-3-sonnet-20240229-v1:0",
    "anthropic.claude-3-haiku-20240307-v1:0"
  ];

  for (const model of models) {
    await testModel(model);
  }
}

testAll();
