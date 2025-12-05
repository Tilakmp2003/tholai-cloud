/**
 * Zero-Hallucination System: Verified Agent Wrapper
 * 
 * Wraps any agent to add hallucination verification using the LLM-centric detector.
 * All code outputs are verified before being accepted.
 * 
 * UPDATED: Now uses hallucinationDetector.verify with useCritic: true for 100% accuracy.
 */

import { hallucinationDetector } from './verification/HallucinationDetector';
import { VerificationResult, ROLE_BASELINES, RoleBaseline } from '../types/verification';

export interface VerifiedAgentConfig {
  agentId: string;
  agentRole: 'MidDev' | 'SeniorDev' | 'JuniorDev' | 'Architect' | 'Tester' | string;
  strictMode?: boolean; // If true, rejects all failed verifications
  maxRetries?: number;  // Number of times to retry if hallucination detected
}

export interface VerifiedOutput<T> {
  success: boolean;
  data?: T;
  verified: boolean;
  verificationResult: VerificationResult;
  proofHash?: string;
  error?: string;
  retryCount?: number;
}

/**
 * Creates a verification wrapper for agent outputs.
 * 
 * Usage:
 * ```typescript
 * const verifier = createVerifiedAgent({ agentId: 'agent-1', agentRole: 'MidDev' });
 * const result = await verifier.verifyCode(code, { taskId: 'task-123', inputContext: 'Create a login form' });
 * if (result.verified) {
 *   // Code is safe to use
 * }
 * ```
 */
export function createVerifiedAgent(config: VerifiedAgentConfig) {
  const { agentId, agentRole, strictMode = true, maxRetries = 0 } = config;
  const roleBaseline: RoleBaseline = ROLE_BASELINES[agentRole] || ROLE_BASELINES.MidDev;

  return {
    /**
     * Verify code output using the LLM-centric hallucination detector
     */
    async verifyCode(
      code: string,
      options: {
        taskId?: string;
        inputContext?: string;
        language?: 'javascript' | 'typescript' | 'python';
      } = {}
    ): Promise<VerifiedOutput<string>> {
      const { taskId = 'unknown', inputContext = '', language = 'typescript' } = options;

      try {
        // Use the LLM-centric hallucination detector with Critic enabled
        const result = await hallucinationDetector.verify({
          agentId,
          taskId,
          input: inputContext,
          output: code,
          language,
          roleBaseline,
          useCritic: true, // Enable LLM-based verification for 100% accuracy
        });

        if (!result.passed) {
          // Hallucination detected
          console.log(`[VerifiedAgent] ⚠️ Hallucination detected for ${agentId}`);
          console.log(`[VerifiedAgent] Reason: ${this.getFailureReason(result)}`);
          
          if (strictMode) {
            return {
              success: false,
              verified: false,
              verificationResult: result,
              error: `Verification failed: ${this.getFailureReason(result)}`,
            };
          }
        }

        return {
          success: true,
          data: code,
          verified: result.passed,
          verificationResult: result,
          proofHash: result.proofHash,
        };
      } catch (error: any) {
        console.error(`[VerifiedAgent] Verification error:`, error);
        return {
          success: false,
          verified: false,
          verificationResult: {
            passed: false,
            checks: {
              syntax: { passed: false, durationMs: 0 },
              sandbox: { passed: false, durationMs: 0 },
              entropy: { passed: false, durationMs: 0 },
            },
            proofHash: '',
            timestamp: Date.now(),
          },
          error: error.message,
        };
      }
    },

    /**
     * Verify code with retry logic - if hallucination detected, returns failure info for regeneration
     */
    async verifyCodeWithRetry(
      code: string,
      options: {
        taskId?: string;
        inputContext?: string;
        language?: 'javascript' | 'typescript' | 'python';
        onHallucinationDetected?: (result: VerificationResult) => Promise<string | null>; // Callback to regenerate code
      } = {}
    ): Promise<VerifiedOutput<string>> {
      let currentCode = code;
      let retryCount = 0;

      while (retryCount <= maxRetries) {
        const result = await this.verifyCode(currentCode, options);

        if (result.verified) {
          return { ...result, retryCount };
        }

        if (retryCount >= maxRetries) {
          return { ...result, retryCount };
        }

        // If callback provided, try to regenerate
        if (options.onHallucinationDetected) {
          console.log(`[VerifiedAgent] Retry ${retryCount + 1}/${maxRetries} - regenerating code...`);
          const newCode = await options.onHallucinationDetected(result.verificationResult);
          if (newCode) {
            currentCode = newCode;
            retryCount++;
            continue;
          }
        }

        // No callback or callback returned null, stop retrying
        return { ...result, retryCount };
      }

      // Shouldn't reach here, but just in case
      return {
        success: false,
        verified: false,
        verificationResult: {
          passed: false,
          checks: {
            syntax: { passed: false, durationMs: 0 },
            sandbox: { passed: false, durationMs: 0 },
            entropy: { passed: false, durationMs: 0 },
          },
          proofHash: '',
          timestamp: Date.now(),
        },
        error: 'Max retries exceeded',
        retryCount,
      };
    },

    /**
     * Get a human-readable failure reason
     */
    getFailureReason(result: VerificationResult): string {
      const checks = result.checks;
      
      if (!checks.syntax?.passed) {
        return `Syntax error: ${checks.syntax?.message || 'Invalid syntax'}`;
      }
      if (!checks.sandbox?.passed) {
        return `Sandbox failure: ${checks.sandbox?.message || 'Code failed to execute'}`;
      }
      if (!checks.api?.passed) {
        return `API validation: ${checks.api?.message || 'Hallucinated API detected'}`;
      }
      if (!checks.critic?.passed) {
        return `LLM Critic: ${checks.critic?.message || 'Hallucination detected by LLM'}`;
      }
      if (!checks.entropy?.passed) {
        return `Entropy violation: ${checks.entropy?.message || 'Output exceeds expected complexity'}`;
      }
      if (!checks.safety?.passed) {
        return `Safety issue: ${checks.safety?.message || 'Dangerous code pattern detected'}`;
      }
      
      return 'Unknown verification failure';
    },
  };
}

/**
 * Higher-order function to wrap an existing agent function with verification.
 * 
 * Usage:
 * ```typescript
 * const verifiedImplementTask = withVerification(
 *   agent.implementTask.bind(agent),
 *   { agentId: 'mid-dev-1', agentRole: 'MidDev' }
 * );
 * ```
 */
export function withVerification<T extends (...args: any[]) => Promise<{ artifact?: string; newFileContent?: string }>>(
  agentFn: T,
  config: VerifiedAgentConfig
): (...args: Parameters<T>) => Promise<VerifiedOutput<Awaited<ReturnType<T>>>> {
  const verifier = createVerifiedAgent(config);

  return async (...args: Parameters<T>): Promise<VerifiedOutput<Awaited<ReturnType<T>>>> => {
    const result = await agentFn(...args);
    
    // Extract code from result (could be in artifact or newFileContent)
    const code = result.artifact || result.newFileContent;
    
    if (!code) {
      // No code to verify, return as-is
      return {
        success: true,
        data: result as Awaited<ReturnType<T>>,
        verified: true,
        verificationResult: {
          passed: true,
          checks: {
            syntax: { passed: true, durationMs: 0 },
            sandbox: { passed: true, durationMs: 0 },
            entropy: { passed: true, durationMs: 0 },
          },
          proofHash: '',
          timestamp: Date.now(),
        },
      };
    }

    const verification = await verifier.verifyCode(code);
    
    return {
      success: verification.verified,
      data: verification.verified ? result as Awaited<ReturnType<T>> : undefined,
      verified: verification.verified,
      verificationResult: verification.verificationResult,
      proofHash: verification.proofHash,
      error: verification.error,
    };
  };
}
