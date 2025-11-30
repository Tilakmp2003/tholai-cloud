import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

const client = new BedrockRuntimeClient({ region: "us-east-1" });

async function testDeepSeekR1() {
  console.log('Testing DeepSeek-R1 with inference profile ARN...\n');
  
  // Use the exact ARN provided by user
  const modelId = "arn:aws:bedrock:us-east-1:711893265317:inference-profile/us.deepseek.r1-v1:0";
  
  // Try different payload formats
  const payloads = [
    {
      name: "Format 1: Simple input",
      payload: {
        input: "Say 'hello' in one word.",
        max_tokens: 100,
        temperature: 0.0
      }
    },
    {
      name: "Format 2: Prompt with system",
      payload: {
        prompt: "User: Say 'hello' in one word.\nAssistant:",
        max_tokens: 100,
        temperature: 0.0
      }
    },
    {
      name: "Format 3: Messages format",
      payload: {
        messages: [{ role: "user", content: "Say 'hello' in one word." }],
        max_tokens: 100,
        temperature: 0.0
      }
    }
  ];

  for (const { name, payload } of payloads) {
    console.log(`\n${name}:`);
    console.log(`Payload:`, JSON.stringify(payload, null, 2));
    
    try {
      const command = new InvokeModelCommand({
        modelId,
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify(payload)
      });

      const response = await client.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      console.log(`✅ SUCCESS!`);
      console.log(`Response:`, JSON.stringify(responseBody, null, 2));
      return { format: name, payload, response: responseBody };
    } catch (error: any) {
      console.log(`❌ Failed: ${error.message}`);
    }
  }
  
  return null;
}

testDeepSeekR1().then(result => {
  if (result) {
    console.log(`\n🎉 DeepSeek R1 is working with ${result.format}!`);
  } else {
    console.log(`\n❌ All formats failed`);
  }
});
