import { BedrockClient, ListFoundationModelsCommand } from "@aws-sdk/client-bedrock";

const client = new BedrockClient({ region: process.env.AWS_REGION || "us-east-1" });

async function listModels() {
  console.log(`Checking models in region: ${process.env.AWS_REGION || "us-east-1"}`);
  try {
    const command = new ListFoundationModelsCommand({});
    const response = await client.send(command);
    console.log("Available Models:");
    response.modelSummaries?.forEach(m => {
      console.log(`- ${m.modelId}`);
    });
  } catch (err) {
    console.error("Error listing models:", err);
  }
}

listModels();
