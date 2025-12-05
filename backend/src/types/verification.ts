/**
 * Zero-Hallucination System: Type Definitions
 * 
 * Core types for the formal verification and truth chain system.
 */

// --- VERIFICATION TYPES ---

export interface VerificationResult {
  passed: boolean;
  checks: {
    syntax: CheckResult;
    sandbox: CheckResult;
    entropy: CheckResult;
    api?: CheckResult;
    safety?: CheckResult;
    critic?: CheckResult;
  };
  proofHash: string;
  timestamp: number;
}

export interface CheckResult {
  passed: boolean;
  message?: string;
  durationMs: number;
}

export interface ProofCertificate {
  id: string;
  agentId: string;
  taskId?: string;
  contentHash: string;
  checks: {
    syntax: boolean;
    sandbox: boolean;
    entropy: boolean;
  };
  metrics: {
    entropyScore: number;
    complexityRatio: number;
    executionTimeMs?: number;
  };
  proofHash: string;
  createdAt: Date;
}

// --- TRUTH CHAIN TYPES ---

export interface TruthBlockData {
  index: number;
  previousHash: string;
  statements: VerifiedStatementData[];
  timestamp: Date;
  nonce: number;
}

export interface VerifiedStatementData {
  agentId: string;
  taskId?: string;
  contentType: 'CODE' | 'TEXT' | 'JSON';
  content: string;
  contentHash: string;
  proofHash: string;
  syntaxValid: boolean;
  sandboxValid: boolean;
  entropyValid: boolean;
  entropyScore?: number;
  complexityRatio?: number;
}

// --- SANDBOX TYPES ---

export interface SandboxExecutionResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTimeMs: number;
  error?: string;
}

export interface SandboxConfig {
  timeout: number;        // ms
  memoryLimit: number;    // bytes
  networkEnabled: boolean;
  language: 'javascript' | 'typescript' | 'python';
}

// --- ENTROPY TYPES ---

export interface EntropyAnalysis {
  inputEntropy: number;
  outputEntropy: number;
  ratio: number;
  isViolation: boolean;
  threshold: number;
}

// --- HALLUCINATION DETECTION ---

export interface HallucinationDetectionInput {
  agentId: string;
  taskId?: string;
  input: string;           // Original context/prompt
  output: string;          // Agent's output
  language?: 'javascript' | 'typescript' | 'python';
  roleBaseline?: RoleBaseline;
  useCritic?: boolean;     // Enable LLM-based critic layer
}

export interface RoleBaseline {
  maxComplexityRatio: number;
  minSimilarity: number;
  maxNewImports: number;
  maxLineDelta: number;
}

export const ROLE_BASELINES: Record<string, RoleBaseline> = {
  SeniorDev: { maxComplexityRatio: 3.5, minSimilarity: 0.7, maxNewImports: 2, maxLineDelta: 50 },
  MidDev: { maxComplexityRatio: 4.0, minSimilarity: 0.6, maxNewImports: 3, maxLineDelta: 100 },
  JuniorDev: { maxComplexityRatio: 4.5, minSimilarity: 0.5, maxNewImports: 4, maxLineDelta: 150 },
  Architect: { maxComplexityRatio: 5.0, minSimilarity: 0.4, maxNewImports: 5, maxLineDelta: 200 },
  QA: { maxComplexityRatio: 3.0, minSimilarity: 0.9, maxNewImports: 1, maxLineDelta: 30 },
};
