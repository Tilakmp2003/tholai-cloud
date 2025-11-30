import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

const client = new BedrockRuntimeClient({ region: process.env.AWS_REGION || "us-east-1" });

async function testDeepSeekR1WithARN() {
  console.log(`\nTesting DeepSeek-R1 with full ARN...`);
  
  const modelArn = "arn:aws:bedrock:us-east-1::inference-profile/us.deepseek.r1-v1:0";

  const payload = {
    input: "User: Say 'hello' in one word.\n\nAssistant:",
    max_tokens: 100,
    temperature: 0.0
  };

  try {
    const command = new InvokeModelCommand({
      modelId: modelArn,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify(payload)
    });

    const response = await client.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    console.log(`✅ DeepSeek-R1 with ARN works!`);
    console.log(`Response:`, JSON.stringify(responseBody).substring(0, 300));
    return true;
  } catch (error: any) {
    console.error(`❌ DeepSeek-R1 with ARN failed: ${error.message}`);
    console.error(`Full error:`, error);
    return false;
  }
}

testDeepSeekR1WithARN();
