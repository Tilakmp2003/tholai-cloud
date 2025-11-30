import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

const client = new BedrockRuntimeClient({ region: process.env.AWS_REGION || "us-east-1" });

async function testDeepSeekModel(modelId: string, useInferenceProfile: boolean = false) {
  console.log(`\nTesting model: ${modelId} (inference profile: ${useInferenceProfile})`);
  
  const finalModelId = useInferenceProfile && modelId.includes("deepseek.r1") 
    ? "us.deepseek.r1-v1:0" 
    : modelId;

  const payload = {
    input: "<think>\nLet me think about this step by step.\n</think>\n\nUser: Say 'hello' in one word.\n\nAssistant:",
    max_tokens: 100,
    temperature: 0.0
  };

  try {
    const command = new InvokeModelCommand({
      modelId: finalModelId,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify(payload)
    });

    const response = await client.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    console.log(`✅ ${finalModelId} works!`);
    console.log(`Response:`, JSON.stringify(responseBody).substring(0, 200));
    return true;
  } catch (error: any) {
    console.error(`❌ ${finalModelId} failed: ${error.message}`);
    return false;
  }
}

async function testAll() {
  console.log("Testing DeepSeek models on Bedrock...\n");
  
  // Test DeepSeek-R1 (with and without inference profile)
  await testDeepSeekModel("deepseek.r1-v1:0", false);
  await testDeepSeekModel("deepseek.r1-v1:0", true);
  
  // Test DeepSeek-V3 (should work without profile)
  // Note: Check exact model ID from list_bedrock_models
  const possibleV3Ids = [
    "deepseek.v3",
    "deepseek.deepseek-v3",
    "deepseek-v3-v1:0"
  ];
  
  for (const id of possibleV3Ids) {
    await testDeepSeekModel(id, false);
  }
}

testAll();
