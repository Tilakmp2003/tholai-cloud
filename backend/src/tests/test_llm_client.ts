import { estimateCost, estimateTokens } from '../services/llmClient';

console.log("Testing LLM Client Utilities...");

const text = "Hello, world! This is a test of the token estimator.";
const tokens = estimateTokens(text);
console.log(`Text: "${text}"`);
console.log(`Estimated Tokens: ${tokens}`);

const cost = estimateCost(1000, 500, 0.06); // 1.5k tokens at $0.06/1k
console.log(`Cost for 1500 tokens at $0.06/1k: $${cost}`);

if (cost === 0.09) {
  console.log("✅ Cost calculation correct.");
} else {
  console.error("❌ Cost calculation failed.");
}
