/**
 * Mock LLM Client
 * 
 * Returns realistic mock responses for testing without API keys.
 * Enable by setting USE_MOCK_LLM=true in .env
 */

import { LLMMessage, LLMResponse } from './types';

// Simulated delay to mimic real API calls
const MOCK_DELAY_MS = 500;

/**
 * Mock responses based on prompt content
 */
function generateMockResponse(messages: LLMMessage[]): string {
  const lastMessage = messages[messages.length - 1]?.content || '';
  const systemMessage = messages.find(m => m.role === 'system')?.content || '';
  
  // Team Lead Review
  if (systemMessage.includes('Team Lead Engineer')) {
    return JSON.stringify({
      decision: "REQUEST_CHANGES",
      feedback: [
        {
          file: "src/auth.ts",
          line: 42,
          issue: "Missing input validation",
          explanation: "User input is used directly in SQL query",
          patch_hint: "Use parameterized queries or ORM"
        }
      ],
      audit_note: "Security vulnerability detected in auth module",
      mentoring_tip: "Always sanitize user inputs before database operations."
    });
  }

  // MidDev Fix Mode
  if (systemMessage.includes('Mid-Level Developer') && systemMessage.includes('FIX-MODE')) {
    return JSON.stringify({
      status: "FIXED",
      newFileContent: "// Fixed content with validation\nexport function auth(user) { if(!user) throw new Error('Invalid'); ... }",
      commitMessage: "Fix: Added input validation to auth.ts (QA#123)"
    });
  }

  // MidDev Implementation Mode
  if (systemMessage.includes('Mid-Level Developer') && systemMessage.includes('IMPLEMENTATION-MODE')) {
    return JSON.stringify({
      status: "COMPLETED",
      artifact: "// Implemented feature\nexport const feature = () => { console.log('Feature works'); }",
      fileName: "feature.ts"
    });
  }

  // JuniorDev Implementation
  if (systemMessage.includes('Junior Developer')) {
    return JSON.stringify({
      status: "COMPLETED",
      artifact: "// Junior dev implementation\nconsole.log('Hello World');",
      fileName: "hello.ts"
    });
  }
  
  // Socratic Interrogator - Ambiguity Analysis
  if (systemMessage.includes('classifier') && lastMessage.includes('ambiguous')) {
    return JSON.stringify({
      isConfused: false,
      issueType: null,
      reason: 'Mock: Requirements appear clear enough to proceed.'
    });
  }
  
  // Socratic Interrogator - Requirement Analysis
  if (lastMessage.includes('Analyze') && lastMessage.includes('ambiguity')) {
    const isVague = lastMessage.length < 200;
    return JSON.stringify({
      score: isVague ? 0.65 : 0.12,
      issues: isVague ? [
        {
          category: 'MISSING_INFO',
          description: 'Authentication method not specified',
          question: 'What authentication method should be used? (JWT, OAuth, Session-based)'
        },
        {
          category: 'AMBIGUOUS_TERM',
          description: '"Fast" is not quantified',
          question: 'What is the acceptable response time? (e.g., <200ms)'
        },
        {
          category: 'UNDEFINED_SCOPE',
          description: 'Database choice not specified',
          question: 'Which database should be used? (PostgreSQL, MongoDB, etc.)'
        }
      ] : []
    });
  }
  
  // Project Planning - Module Generation
  if (lastMessage.includes('break it into modules')) {
    return JSON.stringify([
      {
        name: "Auth Module",
        description: "Handles user authentication",
        complexity: "Medium",
        requiredRole: "Backend Developer",
        techStack: ["Node.js", "JWT"]
      },
      {
        name: "UI Module",
        description: "Frontend interface",
        complexity: "High",
        requiredRole: "Frontend Developer",
        techStack: ["React", "Tailwind"]
      }
    ]);
  }

  // Designer Agent
  if (lastMessage.includes('Generate the Design Package JSON')) {
    return JSON.stringify({
      id: "mock-design-package-id",
      recommendedDirection: "Clean & Modern",
      directions: [
        { name: "Clean & Modern", description: "Minimalist", vibe: "Professional", colorPalette: ["#ffffff", "#000000"] }
      ],
      userJourney: [{ step: "Login", action: "Click Login", outcome: "Dashboard" }],
      wireframes: [{ screenName: "Dashboard", description: "Main view", content: "ASCII Wireframe" }],
      componentInventory: [{ name: "Button", purpose: "Action", complexity: "Low" }],
      designSystem: {
        colors: [{ name: "Primary", value: "#007bff", tailwind: "bg-blue-500" }],
        typography: { family: "Inter", sizes: { "h1": "2rem" } },
        spacing: { "sm": "0.5rem" },
        shadows: { "sm": "0 1px 2px rgba(0,0,0,0.1)" }
      },
      userFlowMermaid: "graph TD; A-->B;",
      componentStubs: [{ name: "Button", description: "Primary button", props: { label: "string" }, codeStub: "export const Button = () => <button>Click</button>;" }],
      accessibilityReport: { pass: true, issues: [], notes: "All good" },
      designConfidence: 95,
      requiresHumanReview: false
    });
  }

  // Design Review (Team Lead)
  if (systemMessage.includes('Creative Director') || systemMessage.includes('Brand Guardian')) {
    return JSON.stringify({
      decision: "APPROVE",
      feedback: [],
      audit_note: "Design looks great, meets all requirements.",
      mentoring_tip: "Great job on the accessibility considerations."
    });
  }

  
  // Code Generation
  if (systemMessage.includes('Developer Agent') || lastMessage.includes('Implement')) {
    return `// Mock generated code
import express from 'express';

const router = express.Router();

router.post('/api/endpoint', async (req, res) => {
  try {
    const { data } = req.body;
    
    // Validate input
    if (!data) {
      return res.status(400).json({ error: 'Data is required' });
    }
    
    // Process request
    const result = await processData(data);
    
    return res.status(200).json({ success: true, result });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

async function processData(data: any) {
  // Mock implementation
  return { processed: true, data };
}

export default router;`;
  }
  
  // QA Review
  if (systemMessage.includes('QA') || lastMessage.includes('review')) {
    return JSON.stringify({
      approved: true,
      feedback: 'Code looks good. All acceptance criteria met.',
      issues: []
    });
  }
  
  // War Room Resolution
  if (systemMessage.includes('WAR ROOM') || lastMessage.includes('deadlock')) {
    return JSON.stringify({
      analysis: 'The deadlock occurred due to conflicting requirements between the developer and QA agent.',
      resolution: 'Simplified the implementation to meet core requirements first.',
      targetFile: 'app/api/route.ts',
      finalCode: '// Resolved implementation\nexport function handler() { return { ok: true }; }',
      action: 'FORCE_MERGE'
    });
  }
  
  // Learning Extraction
  if (lastMessage.includes('extract') && lastMessage.includes('learning')) {
    return JSON.stringify([
      {
        type: 'SUCCESS_PATTERN',
        title: 'Input Validation Pattern',
        content: 'Always validate input at the start of the handler before processing.',
        category: 'api'
      }
    ]);
  }
  
  // PR Explanation
  if (lastMessage.includes('Explain why this change')) {
    return 'This change implements the requested feature by adding proper input validation and error handling to ensure robust API behavior.';
  }
  


  // Default response
  return 'Mock response: Task completed successfully.';
}

/**
 * Mock LLM call
 */
export async function callMockLLM(messages: LLMMessage[]): Promise<LLMResponse> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, MOCK_DELAY_MS));
  
  const content = generateMockResponse(messages);
  
  // Estimate token usage
  const inputTokens = messages.reduce((sum, m) => sum + m.content.length / 4, 0);
  const outputTokens = content.length / 4;
  
  console.log('[MockLLM] Generated response (' + Math.round(outputTokens) + ' tokens)');
  
  return {
    content,
    usage: {
      promptTokens: Math.round(inputTokens),
      completionTokens: Math.round(outputTokens),
      totalTokens: Math.round(inputTokens + outputTokens)
    }
  };
}

/**
 * Check if mock mode is enabled
 */
export function isMockEnabled(): boolean {
  return process.env.USE_MOCK_LLM === 'true';
}
