import { APIGatewayProxyHandler, SQSHandler } from 'aws-lambda';
import { runMidDevAgentOnce } from '../../backend/src/agents/midDevAgent';
import { runDesignerAgentOnce } from '../../backend/src/agents/designerAgent';
import { runQAAgentOnce } from '../../backend/src/agents/qaAgent';

// Handler for SQS Events
export const handler: SQSHandler = async (event) => {
  console.log(`[Lambda] Received batch of ${event.Records.length} records`);

  for (const record of event.Records) {
    try {
      const body = JSON.parse(record.body);
      const { agentId, taskId, role } = body;

      console.log(`[Lambda] Processing Task ${taskId} for Agent ${agentId} (Role: ${role})`);

      let result;
      switch (role) {
        case 'MidDev':
        case 'JuniorDev':
        case 'SeniorDev':
          result = await runMidDevAgentOnce(); 
          break;
        case 'DESIGNER':
          result = await runDesignerAgentOnce();
          break;
        case 'QA':
          result = await runQAAgentOnce();
          break;
        default:
          console.log(`[Lambda] Unknown role ${role}, defaulting to MidDev logic`);
          result = await runMidDevAgentOnce();
      }
      
      console.log(`[Lambda] Task ${taskId} completed successfully.`);
    } catch (error) {
      console.error(`[Lambda] Failed to process record ${record.messageId}:`, error);
      // Throwing error here will trigger SQS retry (visibility timeout)
      throw error; 
    }
  }
};
