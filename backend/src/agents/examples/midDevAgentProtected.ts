/**
 * Example: MidDevAgent WITH Hallucination Protection
 * 
 * This shows how to integrate the Zero-Hallucination system
 * into an existing agent. Compare with your original midDevAgent.ts.
 */

import { Task } from "@prisma/client";
import { callLLM } from "../../llm/llmClient";
import { getAgentConfig } from "../../llm/modelRegistry";
import { createVerifiedAgent } from "../../services/VerifiedAgent";

// Create a verified agent instance for MidDev
const midDevVerifier = createVerifiedAgent({
  agentId: 'mid-dev',
  agentRole: 'MidDev',
  strictMode: true, // Block all hallucinations
});

export class MidDevAgentProtected {
  
  /**
   * Implement a task WITH hallucination protection.
   * 
   * FLOW:
   * 1. Call LLM to generate code
   * 2. Verify the output (syntax, sandbox, entropy, API, safety)
   * 3. If FAILS: Retry with feedback (up to 3 times)
   * 4. If PASSES: Return verified code with proof hash
   */
  async implementTask(task: Task, designContext: any): Promise<any> {
    const MAX_RETRIES = 3;
    
    const systemPrompt = `
You are a Mid-Level Developer (L4). You are in IMPLEMENTATION-MODE.
Your goal is to implement the requested feature.

CRITICAL RULES:
- Only use REAL JavaScript/TypeScript APIs
- Do NOT invent methods like Array.unique() or JSON.parseString()
- Do NOT import from non-existent packages
- Keep your output focused on the task

INPUT:
- Task: ${task.title}
- Design Context: ${JSON.stringify(designContext)}

INSTRUCTIONS:
1. Implement the feature based on the design.
2. Ensure code is clean and typed.

OUTPUT JSON ONLY:
{
  "status": "COMPLETED" | "FAILED",
  "artifact": "The code you wrote",
  "fileName": "suggested_filename.ts"
}
`;
    
    let lastError: string | undefined;
    
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      console.log(`[MidDev] Attempt ${attempt}/${MAX_RETRIES} for task: ${task.title}`);
      
      // Add verification feedback on retries
      let enhancedPrompt = systemPrompt;
      if (lastError && attempt > 1) {
        enhancedPrompt += `

⚠️ PREVIOUS ATTEMPT FAILED VERIFICATION:
${lastError}

Please fix the issues and output valid code. Do not use non-existent APIs.`;
      }
      
      // 1. Call LLM
      const config = await getAgentConfig("MidDev");
      const response = await callLLM(config, [
        { role: "system", content: enhancedPrompt },
        { role: "user", content: "Implement feature." },
      ]);
      
      // Extract the code artifact
      let parsed: any;
      try {
        const cleanResponse = response.content
          .replace(/```json/g, "")
          .replace(/```/g, "")
          .trim();
        parsed = JSON.parse(cleanResponse);
      } catch (e) {
        lastError = "Failed to parse JSON response";
        continue;
      }
      
      // 2. VERIFY the generated code
      const verificationResult = await midDevVerifier.verifyCode(parsed.artifact || '', {
        taskId: task.id,
        inputContext: task.title,
        language: 'typescript',
      });
      
      if (verificationResult.verified) {
        // ✅ PASSED - Code is safe and valid
        console.log(`[MidDev] ✅ Verification PASSED on attempt ${attempt}`);
        console.log(`[MidDev] 🔒 Proof: ${verificationResult.proofHash?.slice(0, 16)}...`);
        
        return {
          ...parsed,
          verified: true,
          proofHash: verificationResult.proofHash,
        };
      }
      
      // ❌ FAILED - Hallucination detected
      lastError = verificationResult.error || 'Unknown verification failure';
      console.log(`[MidDev] ❌ Hallucination detected: ${lastError}`);
      
      // The loop will retry with feedback
    }
    
    // 3. All retries failed - escalate
    console.log(`[MidDev] 🚨 All ${MAX_RETRIES} attempts failed, escalating to human review`);
    
    return {
      status: "FAILED",
      verified: false,
      error: `Hallucination detected after ${MAX_RETRIES} attempts: ${lastError}`,
      needsHumanReview: true,
      artifact: "",
      fileName: "",
    };
  }
}

/**
 * WHAT HAPPENS WHEN HALLUCINATION IS DETECTED:
 * 
 * 1. LLM outputs: "Array.unique()" (doesn't exist)
 * 2. Verification catches it: "Hallucinated API: Array.unique does not exist"
 * 3. System retries with feedback: "⚠️ Previous attempt failed: Array.unique doesn't exist"
 * 4. LLM self-corrects: "Array.from(new Set(arr))" 
 * 5. Verification passes ✅
 * 6. Code is stored with cryptographic proof hash
 * 
 * If LLM keeps hallucinating:
 * - After 3 attempts → Escalate to human review
 * - Task marked as "NEEDS_HUMAN_REVIEW"
 * - Human approves or manually fixes
 */
