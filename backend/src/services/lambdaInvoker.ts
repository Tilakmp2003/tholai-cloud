import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

const sqsClient = new SQSClient({ region: process.env.AWS_REGION || "us-east-1" });

export interface AgentInvocationPayload {
  agentId: string;
  taskId: string;
  contextPacket: any;
  role: string;
}

export async function invokeAgentLambda(payload: AgentInvocationPayload) {
  const queueUrl = process.env.SQS_QUEUE_URL;

  if (!queueUrl) {
    console.error("[LambdaInvoker] SQS_QUEUE_URL is not defined!");
    return false;
  }

  console.log(`[LambdaInvoker] Pushing task ${payload.taskId} for Agent ${payload.agentId} to SQS...`);

  try {
    const command = new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(payload),
      MessageGroupId: payload.agentId, // Ensure ordering per agent if FIFO (optional)
    });

    const response = await sqsClient.send(command);

    console.log(`[LambdaInvoker] SQS Push successful. MessageId: ${response.MessageId}`);
    return true;
  } catch (error) {
    console.error("[LambdaInvoker] Failed to push to SQS:", error);
    return false;
  }
}
