/**
 * Agent Hallucination Protection System
 * 
 * This module shows how hallucination detection integrates with your real agents.
 * It demonstrates the RETRY and SELF-CORRECTION mechanisms.
 */

import { createVerifiedAgent, VerifiedOutput } from './VerifiedAgent';
import { truthChainService } from './verification';
import { ROLE_BASELINES } from '../types/verification';

// ===================================================================
// 1. HOW IT WORKS: The Verified Agent Wrapper
// ===================================================================

/**
 * Every agent that generates code/text gets wrapped with verification.
 * The flow is:
 * 
 *   Agent Request → LLM Call → OUTPUT → Verification → Pass/Fail
 *                                              ↓
 *                                        If FAIL: Retry
 */

// ===================================================================
// 2. RETRY CONFIGURATION
// ===================================================================

export interface HallucinationConfig {
  maxRetries: number;           // How many times to retry on hallucination
  retryWithFeedback: boolean;   // Include verification errors in retry prompt
  fallbackStrategy: 'FAIL' | 'HUMAN_REVIEW' | 'SIMPLER_MODEL';
  notifyOnFail: boolean;        // Send notification on persistent failure
}

const DEFAULT_CONFIG: HallucinationConfig = {
  maxRetries: 3,
  retryWithFeedback: true,
  fallbackStrategy: 'HUMAN_REVIEW',
  notifyOnFail: true,
};

// ===================================================================
// 3. INTEGRATION: Wrap callLLM with Verification
// ===================================================================

/**
 * Enhanced LLM call that automatically verifies outputs and retries on hallucination.
 */
export async function callLLMWithVerification(
  agentId: string,
  agentRole: string,
  systemPrompt: string,
  userPrompt: string,
  callLLMFn: (system: string, user: string) => Promise<string>,
  config: Partial<HallucinationConfig> = {}
): Promise<VerifiedOutput<string>> {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const verifier = createVerifiedAgent({ agentId, agentRole });
  
  let lastError: string | undefined;
  let attempt = 0;
  
  while (attempt < mergedConfig.maxRetries) {
    attempt++;
    console.log(`[Hallucination Guard] 🔄 Attempt ${attempt}/${mergedConfig.maxRetries} for ${agentId}`);
    
    // Call the LLM
    let enhancedSystem = systemPrompt;
    let enhancedUser = userPrompt;
    
    // On retry, add feedback from previous verification failure
    if (attempt > 1 && lastError && mergedConfig.retryWithFeedback) {
      enhancedSystem += `\n\n⚠️ VERIFICATION FEEDBACK (from previous attempt):\n${lastError}\n\nPlease fix the issues and try again. Output ONLY valid, working code.`;
    }
    
    const output = await callLLMFn(enhancedSystem, enhancedUser);
    
    // Verify the output
    const result = await verifier.verifyCode(output, {
      inputContext: userPrompt,
      language: 'typescript',
    });
    
    if (result.verified) {
      console.log(`[Hallucination Guard] ✅ Verification PASSED on attempt ${attempt}`);
      console.log(`[Hallucination Guard] 🔒 Proof Hash: ${result.proofHash?.slice(0, 16)}...`);
      return result;
    }
    
    // Verification failed - extract error for retry
    lastError = result.error || 'Unknown verification failure';
    console.log(`[Hallucination Guard] ❌ Verification FAILED: ${lastError}`);
    
    // Log for audit (the verification was already stored in truth chain)
  }
  
  // All retries exhausted
  console.log(`[Hallucination Guard] 🚨 All ${mergedConfig.maxRetries} attempts failed for ${agentId}`);
  
  // Handle fallback strategy
  switch (mergedConfig.fallbackStrategy) {
    case 'HUMAN_REVIEW':
      console.log(`[Hallucination Guard] 📋 Escalating to HUMAN REVIEW`);
      // In real implementation: create a human approval task
      return {
        success: false,
        verified: false,
        verificationResult: {} as any,
        error: `Hallucination detected after ${mergedConfig.maxRetries} attempts. Needs human review.`,
      };
      
    case 'SIMPLER_MODEL':
      console.log(`[Hallucination Guard] 🔄 Falling back to simpler model`);
      // In real implementation: retry with a more deterministic model
      break;
      
    case 'FAIL':
    default:
      return {
        success: false,
        verified: false,
        verificationResult: {} as any,
        error: `Hallucination blocked after ${mergedConfig.maxRetries} attempts: ${lastError}`,
      };
  }
  
  return {
    success: false,
    verified: false,
    verificationResult: {} as any,
    error: lastError,
  };
}

// ===================================================================
// 4. EXAMPLE: Integrate with MidDevAgent
// ===================================================================

/**
 * Example of how to modify your existing MidDevAgent to use verification.
 * 
 * BEFORE (no verification):
 * ```typescript
 * const response = await callLLM(config, messages);
 * return JSON.parse(response.content);
 * ```
 * 
 * AFTER (with verification):
 * ```typescript
 * const result = await callLLMWithVerification(
 *   'mid-dev-agent',
 *   'MidDev',
 *   systemPrompt,
 *   userPrompt,
 *   async (sys, usr) => {
 *     const response = await callLLM(config, [
 *       { role: 'system', content: sys },
 *       { role: 'user', content: usr },
 *     ]);
 *     return response.content;
 *   }
 * );
 * 
 * if (!result.verified) {
 *   // Handle hallucination - escalate to human or retry
 *   throw new Error(result.error);
 * }
 * ```
 */

// ===================================================================
// 5. WHAT HAPPENS ON HALLUCINATION
// ===================================================================

/**
 * When a hallucination is detected, the system:
 * 
 * 1. LOGS IT: Records the attempt in the Truth Chain database
 * 2. RETRIES: Sends the error feedback back to the LLM for self-correction
 * 3. ESCALATES: If all retries fail, triggers human review or fallback
 * 
 * Example flow:
 * 
 *   Attempt 1: LLM outputs "JSON.parseString(data)"
 *              └── Caught: "Hallucinated API: JSON.parseString does not exist"
 *              └── Retry with feedback
 * 
 *   Attempt 2: LLM outputs "JSON.parse(data)" 
 *              └── Passed! ✅
 *              └── Stored in Truth Chain with proof hash
 */

// ===================================================================
// 6. QUICK INTEGRATION CODE
// ===================================================================

/**
 * Add this to any agent that generates code:
 */
export async function executeWithHallucinationGuard<T>(
  agentId: string,
  agentRole: string,
  taskTitle: string,
  generateFn: () => Promise<string>,
  parseFn: (output: string) => T
): Promise<{ success: boolean; data?: T; error?: string; verified: boolean }> {
  const verifier = createVerifiedAgent({ agentId, agentRole, strictMode: true });
  
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const output = await generateFn();
      
      const result = await verifier.verifyCode(output, {
        inputContext: taskTitle,
        language: 'typescript',
      });
      
      if (result.verified) {
        return {
          success: true,
          data: parseFn(output),
          verified: true,
        };
      }
      
      console.log(`[${agentId}] Hallucination attempt ${attempt}: ${result.error}`);
    } catch (e: any) {
      console.log(`[${agentId}] Error on attempt ${attempt}: ${e.message}`);
    }
  }
  
  return {
    success: false,
    error: 'Persistent hallucination detected - needs human review',
    verified: false,
  };
}
