/**
 * Socratic Interrogator Agent
 * 
 * Challenges vague requirements and forces clarity before work begins.
 * Computes an ambiguity score and asks structured questions until requirements are clear.
 */

import { PrismaClient } from '@prisma/client';
import { callLLM } from '../llm/llmClient';
import { ModelConfig } from '../llm/types';
import { emitLog } from '../websocket/socketServer';

const prisma = new PrismaClient();

const DEFAULT_MODEL_CONFIG: ModelConfig = {
  provider: 'gemini',
  model: 'gemini-2.0-flash',
  maxTokens: 4096,
  temperature: 0.3
};

const AMBIGUITY_THRESHOLD = 0.15; // 15% ambiguity is acceptable
const MAX_INTERROGATION_ROUNDS = 5;

export interface InterrogationResult {
  isReady: boolean;
  ambiguityScore: number;
  clarifiedRequirements: string;
  questions: string[];
  answers: Record<string, string>;
  round: number;
}

export interface AmbiguityAnalysis {
  score: number; // 0-1 (0 = crystal clear, 1 = completely vague)
  issues: Array<{
    category: 'MISSING_INFO' | 'AMBIGUOUS_TERM' | 'CONFLICTING_REQ' | 'UNDEFINED_SCOPE';
    description: string;
    question: string;
  }>;
}

/**
 * Analyze requirements for ambiguity
 */
async function analyzeAmbiguity(
  requirements: string,
  previousAnswers: Record<string, string> = {}
): Promise<AmbiguityAnalysis> {
  const prompt = `You are a requirements analyst. Analyze these requirements for ambiguity and missing information.

REQUIREMENTS:
${requirements}

${Object.keys(previousAnswers).length > 0 ? `
PREVIOUS CLARIFICATIONS:
${Object.entries(previousAnswers).map(([q, a]) => `Q: ${q}\nA: ${a}`).join('\n\n')}
` : ''}

Analyze and return JSON ONLY:
{
  "score": 0.0-1.0,
  "issues": [
    {
      "category": "MISSING_INFO" | "AMBIGUOUS_TERM" | "CONFLICTING_REQ" | "UNDEFINED_SCOPE",
      "description": "What's unclear",
      "question": "Specific question to ask the user"
    }
  ]
}

Categories:
- MISSING_INFO: Essential details not provided (auth method, data storage, etc.)
- AMBIGUOUS_TERM: Vague words like "fast", "secure", "user-friendly" without metrics
- CONFLICTING_REQ: Requirements that contradict each other
- UNDEFINED_SCOPE: Unclear boundaries (what's in/out of scope)

Rules:
- Score 0.0-0.2: Ready to proceed
- Score 0.2-0.5: Minor clarifications needed
- Score 0.5-0.8: Significant gaps
- Score 0.8-1.0: Too vague to start
- Ask max 5 most critical questions
- Questions should be specific and actionable`;

  try {
    const response = await callLLM(DEFAULT_MODEL_CONFIG, [
      { role: 'system', content: 'You are a requirements analyst. Return only valid JSON.' },
      { role: 'user', content: prompt }
    ]);

    const clean = response.content.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch (error) {
    console.error('[Socratic] Failed to analyze ambiguity:', error);
    return { score: 0.5, issues: [] };
  }
}

/**
 * Generate clarified requirements from original + answers
 */
async function synthesizeClarifiedRequirements(
  originalRequirements: string,
  answers: Record<string, string>
): Promise<string> {
  const prompt = `You are a technical writer. Synthesize these requirements with the clarifications into a clear, complete PRD.

ORIGINAL REQUIREMENTS:
${originalRequirements}

CLARIFICATIONS:
${Object.entries(answers).map(([q, a]) => `Q: ${q}\nA: ${a}`).join('\n\n')}

Write a clear, structured requirements document that incorporates all clarifications.
Use bullet points and sections. Be specific and actionable.`;

  try {
    const response = await callLLM(DEFAULT_MODEL_CONFIG, [
      { role: 'system', content: 'You are a technical writer creating clear requirements documents.' },
      { role: 'user', content: prompt }
    ]);
    return response.content;
  } catch (error) {
    console.error('[Socratic] Failed to synthesize requirements:', error);
    return originalRequirements;
  }
}

/**
 * Main interrogation function - analyzes and returns questions if needed
 */
export async function interrogateRequirements(
  projectId: string,
  requirements: string,
  previousAnswers: Record<string, string> = {},
  round: number = 1
): Promise<InterrogationResult> {
  emitLog(`[Socratic] 🔍 Analyzing requirements (Round ${round})...`);
  
  // Analyze ambiguity
  const analysis = await analyzeAmbiguity(requirements, previousAnswers);
  
  emitLog(`[Socratic] Ambiguity Score: ${(analysis.score * 100).toFixed(1)}%`);
  
  // Check if we're done
  if (analysis.score <= AMBIGUITY_THRESHOLD || round >= MAX_INTERROGATION_ROUNDS) {
    // Synthesize final requirements
    const clarifiedRequirements = Object.keys(previousAnswers).length > 0
      ? await synthesizeClarifiedRequirements(requirements, previousAnswers)
      : requirements;
    
    emitLog(`[Socratic] ✅ Requirements ready (Score: ${(analysis.score * 100).toFixed(1)}%)`);
    
    // Store the interrogation result
    await prisma.project.update({
      where: { id: projectId },
      data: {
        description: clarifiedRequirements
      }
    });
    
    return {
      isReady: true,
      ambiguityScore: analysis.score,
      clarifiedRequirements,
      questions: [],
      answers: previousAnswers,
      round
    };
  }
  
  // Extract questions from issues
  const questions = analysis.issues
    .slice(0, 5)
    .map(issue => issue.question);
  
  emitLog(`[Socratic] ❓ ${questions.length} clarification questions needed`);
  
  return {
    isReady: false,
    ambiguityScore: analysis.score,
    clarifiedRequirements: requirements,
    questions,
    answers: previousAnswers,
    round
  };
}

/**
 * Process user answers and continue interrogation
 */
export async function processAnswers(
  projectId: string,
  requirements: string,
  previousAnswers: Record<string, string>,
  newAnswers: Record<string, string>
): Promise<InterrogationResult> {
  const allAnswers = { ...previousAnswers, ...newAnswers };
  const nextRound = Object.keys(previousAnswers).length > 0 
    ? Math.ceil(Object.keys(allAnswers).length / 5) + 1 
    : 2;
  
  return interrogateRequirements(projectId, requirements, allAnswers, nextRound);
}

/**
 * Quick check if requirements need interrogation
 */
export async function needsInterrogation(requirements: string): Promise<boolean> {
  const analysis = await analyzeAmbiguity(requirements);
  return analysis.score > AMBIGUITY_THRESHOLD;
}

export const socraticInterrogator = {
  interrogateRequirements,
  processAnswers,
  needsInterrogation,
  analyzeAmbiguity
};
