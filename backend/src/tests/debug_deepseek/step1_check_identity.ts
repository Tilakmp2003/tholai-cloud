/**
 * Step 1: Verify runtime AWS identity & region
 */

import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";

async function checkIdentity() {
  console.log('🔍 Step 1: Checking AWS Identity & Region\n');
  console.log('=' .repeat(60));

  // Environment variables
  console.log('\n📋 Environment Variables:');
  console.log(`   AWS_REGION: ${process.env.AWS_REGION || '(not set)'}`);
  console.log(`   AWS_PROFILE: ${process.env.AWS_PROFILE || '(not set)'}`);
  console.log(`   AWS_ACCESS_KEY_ID: ${process.env.AWS_ACCESS_KEY_ID ? '***' + process.env.AWS_ACCESS_KEY_ID.slice(-4) : '(not set)'}`);
  console.log(`   NODE_ENV: ${process.env.NODE_ENV || '(not set)'}`);

  // STS GetCallerIdentity
  try {
    const client = new STSClient({ region: process.env.AWS_REGION || "us-east-1" });
    const resp = await client.send(new GetCallerIdentityCommand({}));
    
    console.log('\n🔐 AWS Caller Identity:');
    console.log(`   User ID: ${resp.UserId}`);
    console.log(`   Account: ${resp.Account}`);
    console.log(`   ARN: ${resp.Arn}`);
    
    console.log('\n✅ Identity check passed!');
    return resp;

  } catch (error: any) {
    console.error('\n❌ Failed to get caller identity:');
    console.error(`   Error: ${error.message}`);
    console.error(`   Code: ${error.name}`);
    throw error;
  }
}

checkIdentity()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
