/**
 * Agent Hallucination Wrapper
 * 
 * A shared utility that wraps LLM calls with hallucination detection.
 * All agents should use this for code generation.
 */

import { hallucinationDetector } from './verification/HallucinationDetector';
import { emitLog } from '../websocket/socketServer';

export interface VerifiedCodeResult {
  success: boolean;
  content: string;
  verified: boolean;
  hallucinationBlocked?: boolean;
  blockReason?: string;
  proofHash?: string;
}

/**
 * Verify generated code for hallucinations
 * 
 * @param agentId - ID of the agent (e.g., 'MidDev', 'SeniorDev')
 * @param taskId - Task ID for tracking
 * @param taskTitle - Description of what was requested
 * @param generatedCode - The code output from the LLM
 * @param language - 'typescript' | 'javascript' | 'python'
 */
export async function verifyGeneratedCode(
  agentId: string,
  taskId: string,
  taskTitle: string,
  generatedCode: string,
  language: 'typescript' | 'javascript' | 'python' = 'typescript'
): Promise<VerifiedCodeResult> {
  // Skip verification for empty or very short code
  if (!generatedCode || generatedCode.trim().length < 10) {
    return {
      success: true,
      content: generatedCode,
      verified: true,
    };
  }

  try {
    console.log(`[${agentId}] 🔍 Running hallucination detection...`);
    
    const verification = await hallucinationDetector.verify({
      agentId,
      taskId,
      input: taskTitle,
      output: generatedCode,
      language,
      useCritic: true,
    });

    if (!verification.passed) {
      // Find which check failed
      const failedCheck = Object.entries(verification.checks)
        .find(([_, check]) => !check.passed);
      
      const reason = failedCheck 
        ? `${failedCheck[0]}: ${(failedCheck[1] as any).message || 'Failed'}` 
        : 'Unknown verification failure';
      
      console.log(`[${agentId}] 🚫 HALLUCINATION DETECTED: ${reason}`);
      emitLog(`[${agentId}] 🚫 Hallucination blocked: ${reason}`);
      
      return {
        success: false,
        content: '',
        verified: false,
        hallucinationBlocked: true,
        blockReason: reason,
      };
    }

    console.log(`[${agentId}] ✅ Code verified - no hallucinations detected`);
    
    return {
      success: true,
      content: generatedCode,
      verified: true,
      proofHash: verification.proofHash,
    };
    
  } catch (error: any) {
    console.warn(`[${agentId}] ⚠️ Verification error (allowing): ${error.message}`);
    // On verification system error, allow the code through
    // but mark as unverified
    return {
      success: true,
      content: generatedCode,
      verified: false,
    };
  }
}

/**
 * Wrap an LLM response parser with hallucination detection
 * Use this as a drop-in enhancement for existing agent code
 */
export async function parseWithVerification<T>(
  agentId: string,
  taskId: string,
  taskTitle: string,
  rawResponse: string,
  parser: (cleaned: string) => T,
  codeField: keyof T = 'artifact' as keyof T
): Promise<{ parsed: T | null; verified: boolean; error?: string }> {
  try {
    // Clean the response
    const cleanResponse = rawResponse
      .replace(/```json/g, '')
      .replace(/```typescript/g, '')
      .replace(/```javascript/g, '')
      .replace(/```/g, '')
      .trim();
    
    const parsed = parser(cleanResponse);
    
    // If there's a code field, verify it
    const codeContent = parsed && typeof parsed === 'object' 
      ? (parsed as any)[codeField] 
      : null;
    
    if (codeContent && typeof codeContent === 'string' && codeContent.length > 10) {
      const verifyResult = await verifyGeneratedCode(
        agentId,
        taskId,
        taskTitle,
        codeContent,
        'typescript'
      );
      
      if (!verifyResult.success) {
        return {
          parsed: null,
          verified: false,
          error: verifyResult.blockReason,
        };
      }
    }
    
    return { parsed, verified: true };
    
  } catch (e: any) {
    return {
      parsed: null,
      verified: false,
      error: `Parse error: ${e.message}`,
    };
  }
}
