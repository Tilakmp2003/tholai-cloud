import { callBedrock } from './src/llm/providers/bedrockProvider';

async function testBedrock() {
  console.log('Testing Bedrock DeepSeek V3...');
  
  try {
    const result = await callBedrock(
      'deepseek.v3-v1:0',
      [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Say hello in one word.' }
      ],
      100,
      0.7,
      'ap-south-1'
    );
    
    console.log('Result:', JSON.stringify(result, null, 2));
    console.log('\nToken Usage:', result.usage);
    console.log('Content length:', result.content?.length);
  } catch (err: any) {
    console.error('Error:', err.message);
  }
  process.exit(0);
}

testBedrock();
