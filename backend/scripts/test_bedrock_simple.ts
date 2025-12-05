
import { callBedrock } from '../src/llm/providers/bedrockProvider';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env') });

async function testBedrock() {
  console.log('Testing Bedrock Connectivity...');
  try {
    const response = await callBedrock(
      'deepseek.v3-v1:0',
      [{ role: 'user', content: 'Hello, say "test" and nothing else.' }],
      100,
      0.5,
      'ap-south-1'
    );
    console.log('Response:', response.content);
  } catch (error: any) {
    console.error('Error:', error.message);
    if (error.name) console.error('Error Name:', error.name);
    // @ts-ignore
    if (error.$metadata) console.error('Metadata:', error.$metadata);
  }
}

testBedrock();
