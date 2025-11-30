/**
 * Step 2: List inference profiles & foundation models
 */

import { BedrockClient, ListInferenceProfilesCommand } from "@aws-sdk/client-bedrock";
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

async function listBedrockResources() {
  console.log('🔍 Step 2: Listing Bedrock Resources\n');
  console.log('='.repeat(60));

  const region = process.env.AWS_REGION || 'us-east-1';
  console.log(`\n📍 Region: ${region}\n`);

  try {
    const client = new BedrockClient({ region });

    // List inference profiles
    console.log('📊 Inference Profiles:');
    console.log('-'.repeat(60));
    
    const profilesResp = await client.send(new ListInferenceProfilesCommand({ 
      maxResults: 50 
    }));

    if (profilesResp.inferenceProfileSummaries && profilesResp.inferenceProfileSummaries.length > 0) {
      profilesResp.inferenceProfileSummaries.forEach((profile: any) => {
        console.log(`\n   Profile: ${profile.inferenceProfileName}`);
        console.log(`   ID: ${profile.inferenceProfileId}`);
        console.log(`   ARN: ${profile.inferenceProfileArn}`);
        console.log(`   Status: ${profile.status}`);
        console.log(`   Models: ${profile.models?.map((m: any) => m.modelArn).join(', ') || 'N/A'}`);
      });

      // Find DeepSeek profiles
      const deepseekProfiles = profilesResp.inferenceProfileSummaries.filter((p: any) => 
        p.inferenceProfileId?.toLowerCase().includes('deepseek') ||
        p.inferenceProfileName?.toLowerCase().includes('deepseek')
      );

      if (deepseekProfiles.length > 0) {
        console.log('\n\n✅ DeepSeek Profiles Found:');
        deepseekProfiles.forEach((p: any) => {
          console.log(`   → ${p.inferenceProfileId}`);
          console.log(`      ARN: ${p.inferenceProfileArn}`);
        });
      } else {
        console.log('\n\n⚠️  No DeepSeek profiles found!');
      }
    } else {
      console.log('   (No inference profiles found)');
    }

  } catch (error: any) {
    console.error('\n❌ Error listing Bedrock resources:');
    console.error(`   ${error.message}`);
    console.error(`   Code: ${error.name}`);
    
    if (error.name === 'AccessDeniedException') {
      console.error('\n💡 IAM permissions missing! Need:');
      console.error('   - bedrock:ListInferenceProfiles');
      console.error('   - bedrock:ListFoundationModels');
    }
    
    throw error;
  }
}

listBedrockResources()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
