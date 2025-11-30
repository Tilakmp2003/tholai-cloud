/**
 * Step 5: Minimal DeepSeek R1 invocation test from production runtime
 */

import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

async function testDeepSeekInvoke() {
  console.log('🔍 Step 5: Testing DeepSeek R1 Invocation\n');
  console.log('='.repeat(60));

  const region = process.env.AWS_REGION || 'us-east-1';
  console.log(`\n📍 Region: ${region}`);

  // Test with different model ID formats
  const testCases = [
    {
      name: 'Inference Profile ID',
      modelId: 'us.deepseek.r1-v1:0'
    },
    {
      name: 'Full ARN (update with your account)',
      modelId: 'arn:aws:bedrock:us-east-1:711893265317:inference-profile/us.deepseek.r1-v1:0'
    },
    {
      name: 'Direct Model ID',
      modelId: 'deepseek.r1-v1:0'
    }
  ];

  const client = new BedrockRuntimeClient({ region });

  for (const testCase of testCases) {
    console.log(`\n\n📝 Testing: ${testCase.name}`);
    console.log(`   Model ID: ${testCase.modelId}`);
    console.log('-'.repeat(60));

    const payload = {
      prompt: "Say 'hello' in one word.",
      max_tokens: 50,
      temperature: 0
    };

    console.log(`   Payload: ${JSON.stringify(payload)}`);

    try {
      const startTime =Date.now();
      
      const command = new InvokeModelCommand({
        modelId: testCase.modelId,
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify(payload)
      });

      const response = await client.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      
      const duration = Date.now() - startTime;
      
      console.log(`\n   ✅ SUCCESS! (${duration}ms)`);
      console.log(`   Response: ${JSON.stringify(responseBody).substring(0, 200)}`);
      
      return { success: true, modelId: testCase.modelId, responseBody };

    } catch (error: any) {
      console.log(`\n   ❌ FAILED`);
      console.log(`   Error: ${error.name}: ${error.message}`);
      console.log(`   HTTP Status: ${error.$metadata?.httpStatusCode || 'N/A'}`);
      console.log(`   Request ID: ${error.$metadata?.requestId || 'N/A'}`);
      
      // Continue to next test case
    }
  }

  console.log('\n\n❌ All test cases failed!');
  throw new Error('DeepSeek R1 invocation failed with all model ID formats');
}

testDeepSeekInvoke()
  .then((result) => {
    console.log('\n\n🎉 DeepSeek R1 is working!');
    console.log(`   Use modelId: ${result.modelId}`);
    process.exit(0);
  })
  .catch(() => process.exit(1));
