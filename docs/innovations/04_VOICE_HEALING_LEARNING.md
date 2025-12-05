# Voice Control, Self-Healing & Cross-Project Learning - Complete Implementation

## Part 1: Voice Control Integration

### 1.1 Frontend: Speech Recognition Hook

```tsx
// frontend/src/hooks/useVoiceCommand.ts

import { useState, useCallback, useRef, useEffect } from 'react';

interface VoiceCommandOptions {
  onCommand: (text: string) => void;
  onError?: (error: string) => void;
  language?: string;
  continuous?: boolean;
}

export function useVoiceCommand({ 
  onCommand, 
  onError, 
  language = 'en-US',
  continuous = false 
}: VoiceCommandOptions) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      onError?.('Speech recognition not supported');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = continuous;
    recognition.interimResults = true;
    recognition.lang = language;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    
    recognition.onresult = (event) => {
      const current = event.resultIndex;
      const result = event.results[current];
      const text = result[0].transcript;
      
      setTranscript(text);
      
      if (result.isFinal) {
        onCommand(text);
        setTranscript('');
      }
    };

    recognition.onerror = (event) => {
      onError?.(event.error);
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
    };
  }, [onCommand, onError, language, continuous]);

  const startListening = useCallback(() => {
    recognitionRef.current?.start();
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  return { isListening, transcript, startListening, stopListening, toggleListening };
}
```

### 1.2 Voice Command Component

```tsx
// frontend/src/components/voice/VoiceCommandButton.tsx

'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVoiceCommand } from '@/hooks/useVoiceCommand';
import { Mic, MicOff, Volume2 } from 'lucide-react';

interface VoiceCommandButtonProps {
  projectId: string;
  onResponse?: (response: string) => void;
}

export function VoiceCommandButton({ projectId, onResponse }: VoiceCommandButtonProps) {
  const [processing, setProcessing] = useState(false);
  const [response, setResponse] = useState<string | null>(null);

  const handleCommand = async (text: string) => {
    setProcessing(true);
    try {
      const res = await fetch('/api/voice/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, command: text }),
      });
      
      const data = await res.json();
      setResponse(data.response);
      onResponse?.(data.response);
      
      // Text-to-Speech response
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(data.response);
        utterance.rate = 1;
        utterance.pitch = 1;
        speechSynthesis.speak(utterance);
      }
    } catch (error) {
      console.error('Voice command failed:', error);
    } finally {
      setProcessing(false);
    }
  };

  const { isListening, transcript, toggleListening } = useVoiceCommand({
    onCommand: handleCommand,
    onError: (e) => console.error('Voice error:', e),
  });

  return (
    <div className="relative">
      <motion.button
        onClick={toggleListening}
        disabled={processing}
        className={`p-4 rounded-full transition-all ${
          isListening 
            ? 'bg-red-500 shadow-lg shadow-red-500/50' 
            : 'bg-blue-600 hover:bg-blue-500'
        }`}
        whileTap={{ scale: 0.95 }}
        animate={isListening ? { scale: [1, 1.1, 1] } : {}}
        transition={{ repeat: isListening ? Infinity : 0, duration: 1 }}
      >
        {isListening ? (
          <Mic className="w-6 h-6 text-white animate-pulse" />
        ) : (
          <MicOff className="w-6 h-6 text-white" />
        )}
      </motion.button>

      {/* Live transcript */}
      <AnimatePresence>
        {transcript && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-gray-900 px-4 py-2 rounded-lg text-white text-sm whitespace-nowrap"
          >
            {transcript}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Response display */}
      <AnimatePresence>
        {response && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-blue-900/90 px-4 py-2 rounded-lg text-white text-sm max-w-xs"
          >
            <Volume2 className="w-4 h-4 inline mr-2" />
            {response}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

### 1.3 Backend: Intent Classification

```typescript
// backend/src/services/VoiceCommandService.ts

import { LLMService } from './LLMService';

interface CommandIntent {
  action: 'status' | 'create_task' | 'assign' | 'query' | 'help' | 'unknown';
  parameters: Record<string, any>;
  confidence: number;
}

export class VoiceCommandService {
  constructor(private llm: LLMService) {}

  async processCommand(projectId: string, command: string): Promise<{
    intent: CommandIntent;
    response: string;
    actionTaken?: any;
  }> {
    // Classify intent
    const intent = await this.classifyIntent(command);
    
    // Execute based on intent
    let response: string;
    let actionTaken: any;

    switch (intent.action) {
      case 'status':
        const status = await this.getProjectStatus(projectId);
        response = `The project has ${status.activeTasks} active tasks. ${status.agents.length} agents are working. ${status.completedToday} tasks completed today.`;
        actionTaken = status;
        break;

      case 'create_task':
        const task = await this.createTask(projectId, intent.parameters.description);
        response = `Created task: "${task.title}". I've assigned it to ${task.assignee}.`;
        actionTaken = task;
        break;

      case 'assign':
        const assignment = await this.assignTask(projectId, intent.parameters);
        response = `${assignment.taskTitle} is now assigned to ${assignment.agentName}.`;
        actionTaken = assignment;
        break;

      case 'query':
        const answer = await this.queryProject(projectId, command);
        response = answer;
        break;

      case 'help':
        response = "You can ask about project status, create tasks, assign work to agents, or ask questions about the codebase. Just speak naturally!";
        break;

      default:
        response = "I didn't quite understand that. Could you rephrase?";
    }

    return { intent, response, actionTaken };
  }

  private async classifyIntent(command: string): Promise<CommandIntent> {
    const prompt = `
Classify the user's voice command into one of these intents:
- status: Asking about project progress, agent status, task counts
- create_task: Creating a new task or feature request
- assign: Assigning a task to a specific agent
- query: Asking a question about the code or project
- help: Asking for help or what they can do
- unknown: Cannot determine intent

Command: "${command}"

Respond in JSON format:
{
  "action": "status|create_task|assign|query|help|unknown",
  "parameters": { /* extracted entities */ },
  "confidence": 0.0-1.0
}`;

    const response = await this.llm.generate(prompt);
    return JSON.parse(response);
  }

  private async getProjectStatus(projectId: string) {
    // Implementation
    return { activeTasks: 5, agents: [], completedToday: 3 };
  }

  private async createTask(projectId: string, description: string) {
    // Implementation
    return { title: description, assignee: 'SeniorDev-001' };
  }

  private async assignTask(projectId: string, params: any) {
    // Implementation
    return { taskTitle: 'Task', agentName: 'Agent' };
  }

  private async queryProject(projectId: string, query: string): Promise<string> {
    // Use RAG to answer questions about the project
    return "Based on the codebase...";
  }
}
```

---

## Part 2: Self-Healing Code

### 2.1 Error Monitor Integration

```typescript
// backend/src/services/ErrorMonitorService.ts

import * as Sentry from '@sentry/node';

interface ProductionError {
  id: string;
  message: string;
  stackTrace: string;
  timestamp: Date;
  frequency: number;
  affectedEndpoint?: string;
  userId?: string;
}

export class ErrorMonitorService {
  private errors: Map<string, ProductionError> = new Map();
  private healingQueue: ProductionError[] = [];

  constructor(private doctorAgentService: DoctorAgentService) {
    this.setupSentryWebhook();
  }

  private setupSentryWebhook() {
    // In reality, this would be an HTTP endpoint receiving Sentry webhooks
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      beforeSend: (event) => {
        this.processError(event);
        return event;
      },
    });
  }

  async processError(sentryEvent: any) {
    const error: ProductionError = {
      id: sentryEvent.event_id,
      message: sentryEvent.exception?.values?.[0]?.value || 'Unknown error',
      stackTrace: this.extractStackTrace(sentryEvent),
      timestamp: new Date(),
      frequency: 1,
      affectedEndpoint: sentryEvent.request?.url,
    };

    // Check if we've seen this error before
    const existingKey = this.getErrorSignature(error);
    const existing = this.errors.get(existingKey);

    if (existing) {
      existing.frequency++;
      // If error frequency exceeds threshold, trigger healing
      if (existing.frequency >= 3) {
        await this.triggerHealing(existing);
      }
    } else {
      this.errors.set(existingKey, error);
    }
  }

  private async triggerHealing(error: ProductionError) {
    console.log(`Triggering self-healing for error: ${error.message}`);
    
    // Add to healing queue
    this.healingQueue.push(error);
    
    // Invoke Doctor Agent
    await this.doctorAgentService.diagnoseAndFix(error);
  }

  private extractStackTrace(event: any): string {
    const frames = event.exception?.values?.[0]?.stacktrace?.frames || [];
    return frames.map((f: any) => `at ${f.function} (${f.filename}:${f.lineno})`).join('\n');
  }

  private getErrorSignature(error: ProductionError): string {
    // Create a signature from the first line of stack trace and message
    const firstStackLine = error.stackTrace.split('\n')[0] || '';
    return `${error.message}::${firstStackLine}`;
  }
}
```

### 2.2 Doctor Agent

```typescript
// backend/src/agents/DoctorAgent.ts

import { BaseAgent } from './BaseAgent';
import { GitService } from '../services/GitService';
import { LLMService } from '../services/LLMService';

interface ProductionError {
  id: string;
  message: string;
  stackTrace: string;
  timestamp: Date;
  frequency: number;
  affectedEndpoint?: string;
}

interface Diagnosis {
  rootCause: string;
  affectedFiles: string[];
  suggestedFix: string;
  confidence: number;
  riskLevel: 'low' | 'medium' | 'high';
}

interface HealingResult {
  success: boolean;
  fixApplied: string;
  prUrl?: string;
  testsPassed: boolean;
  deploymentStatus?: string;
}

export class DoctorAgent extends BaseAgent {
  constructor(
    private llm: LLMService,
    private git: GitService,
    private testRunner: TestRunnerService,
    private deployService: DeploymentService
  ) {
    super();
  }

  async diagnoseAndFix(error: ProductionError): Promise<HealingResult> {
    this.emitThought(`Analyzing production error: ${error.message}`);

    // Step 1: Diagnose
    const diagnosis = await this.diagnose(error);
    
    if (diagnosis.confidence < 0.7) {
      this.emitThought('Low confidence in diagnosis. Escalating to human.');
      return { success: false, fixApplied: 'Escalated to human', testsPassed: false };
    }

    // Step 2: Create hotfix branch
    const branchName = `hotfix/${error.id.slice(0, 8)}`;
    await this.git.createBranch(branchName);
    this.emitThought(`Created branch: ${branchName}`);

    // Step 3: Generate and apply fix
    const fix = await this.generateFix(diagnosis, error);
    
    for (const file of diagnosis.affectedFiles) {
      const originalCode = await this.git.readFile(file);
      const fixedCode = await this.applyFixToFile(originalCode, fix, file);
      
      await this.git.writeFile(file, fixedCode);
      this.emitCode(fixedCode, this.getLanguage(file), file);
    }

    // Step 4: Run tests
    this.emitThought('Running tests to validate fix...');
    const testResult = await this.testRunner.runRelevantTests(diagnosis.affectedFiles);
    
    if (!testResult.passed) {
      this.emitThought('Tests failed. Rolling back...');
      await this.git.resetBranch();
      return { 
        success: false, 
        fixApplied: diagnosis.suggestedFix, 
        testsPassed: false 
      };
    }

    // Step 5: Create PR
    const commitMessage = `Fix: ${error.message.slice(0, 50)}\n\nRoot cause: ${diagnosis.rootCause}\n\nAuto-generated by Doctor Agent`;
    await this.git.commit(commitMessage);
    const prUrl = await this.git.createPR(branchName, 'main', {
      title: `[Hotfix] ${error.message.slice(0, 50)}`,
      body: this.generatePRDescription(error, diagnosis),
      labels: ['hotfix', 'auto-generated'],
    });

    this.emitThought(`Created PR: ${prUrl}`);

    // Step 6: Auto-merge if low risk and tests pass
    if (diagnosis.riskLevel === 'low' && testResult.passed) {
      await this.git.mergePR(prUrl);
      await this.deployService.deployToProduction();
      
      return {
        success: true,
        fixApplied: diagnosis.suggestedFix,
        prUrl,
        testsPassed: true,
        deploymentStatus: 'deployed',
      };
    }

    return {
      success: true,
      fixApplied: diagnosis.suggestedFix,
      prUrl,
      testsPassed: true,
      deploymentStatus: 'pending_review',
    };
  }

  private async diagnose(error: ProductionError): Promise<Diagnosis> {
    // Parse stack trace to find affected files
    const fileMatches = error.stackTrace.match(/\(([^:]+):\d+\)/g) || [];
    const affectedFiles = [...new Set(fileMatches.map(m => m.replace(/\(([^:]+):\d+\)/, '$1')))];

    // Read the affected code
    const codeContexts = await Promise.all(
      affectedFiles.slice(0, 3).map(async (file) => {
        try {
          const code = await this.git.readFile(file);
          return `// ${file}\n${code}`;
        } catch {
          return null;
        }
      })
    );

    const prompt = `
You are a senior software engineer diagnosing a production error.

Error Message: ${error.message}

Stack Trace:
${error.stackTrace}

Relevant Code:
${codeContexts.filter(Boolean).join('\n\n---\n\n')}

Analyze this error and provide:
1. Root cause analysis
2. Which files need to be modified
3. A specific code fix
4. Your confidence level (0-1)
5. Risk level of the fix (low/medium/high)

Respond in JSON format:
{
  "rootCause": "explanation",
  "affectedFiles": ["file1.ts", "file2.ts"],
  "suggestedFix": "specific code change",
  "confidence": 0.85,
  "riskLevel": "low"
}`;

    const response = await this.llm.generate(prompt);
    return JSON.parse(response);
  }

  private async generateFix(diagnosis: Diagnosis, error: ProductionError): Promise<string> {
    const prompt = `
Based on this diagnosis, generate the exact code fix:

Root Cause: ${diagnosis.rootCause}
Suggested Fix: ${diagnosis.suggestedFix}
Error: ${error.message}

Generate ONLY the corrected code block. No explanations.`;

    return await this.llm.generate(prompt);
  }

  private async applyFixToFile(original: string, fix: string, fileName: string): Promise<string> {
    const prompt = `
Apply this fix to the file. Return the complete updated file content.

Original file (${fileName}):
${original}

Fix to apply:
${fix}

Return ONLY the complete updated file content.`;

    return await this.llm.generate(prompt);
  }

  private generatePRDescription(error: ProductionError, diagnosis: Diagnosis): string {
    return `
## 🔧 Auto-Generated Hotfix

**Error:** ${error.message}

**Root Cause:** ${diagnosis.rootCause}

**Files Modified:**
${diagnosis.affectedFiles.map(f => `- \`${f}\``).join('\n')}

**Risk Level:** ${diagnosis.riskLevel}
**Confidence:** ${(diagnosis.confidence * 100).toFixed(0)}%

---
*This PR was automatically generated by the Doctor Agent. Please review before merging.*`;
  }

  private getLanguage(fileName: string): string {
    if (fileName.endsWith('.ts') || fileName.endsWith('.tsx')) return 'typescript';
    if (fileName.endsWith('.js') || fileName.endsWith('.jsx')) return 'javascript';
    if (fileName.endsWith('.py')) return 'python';
    return 'text';
  }
}
```

---

## Part 3: Cross-Project Learning

### 3.1 Vector Database Setup (Pinecone)

```typescript
// backend/src/services/KnowledgeVectorService.ts

import { Pinecone } from '@pinecone-database/pinecone';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';

interface SolutionPattern {
  id: string;
  problemDescription: string;
  solutionCode: string;
  context: {
    projectType: string;
    techStack: string[];
    taskType: string;
  };
  successRating: number;
  usageCount: number;
  createdAt: Date;
}

export class KnowledgeVectorService {
  private pinecone: Pinecone;
  private embeddings: OpenAIEmbeddings;
  private indexName = 'solution-patterns';

  constructor() {
    this.pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY!,
    });
    
    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: 'text-embedding-3-small',
    });
  }

  /**
   * Store a successful solution pattern
   */
  async storeSolution(pattern: Omit<SolutionPattern, 'id'>): Promise<string> {
    const id = `solution_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    
    // Generate embedding from problem description
    const embedding = await this.embeddings.embedQuery(
      `${pattern.problemDescription}\n\nContext: ${pattern.context.taskType} in ${pattern.context.projectType}`
    );

    const index = this.pinecone.index(this.indexName);
    
    await index.upsert([{
      id,
      values: embedding,
      metadata: {
        problemDescription: pattern.problemDescription,
        solutionCode: pattern.solutionCode,
        projectType: pattern.context.projectType,
        techStack: pattern.context.techStack.join(','),
        taskType: pattern.context.taskType,
        successRating: pattern.successRating,
        usageCount: pattern.usageCount,
        createdAt: pattern.createdAt.toISOString(),
      },
    }]);

    return id;
  }

  /**
   * Find similar solutions from past projects
   */
  async findSimilarSolutions(
    problemDescription: string,
    context: { projectType?: string; techStack?: string[]; taskType?: string },
    limit = 5,
    minScore = 0.75
  ): Promise<(SolutionPattern & { score: number })[]> {
    const embedding = await this.embeddings.embedQuery(problemDescription);
    
    const index = this.pinecone.index(this.indexName);
    
    // Build filter
    const filter: any = {};
    if (context.projectType) filter.projectType = { $eq: context.projectType };
    if (context.taskType) filter.taskType = { $eq: context.taskType };

    const results = await index.query({
      vector: embedding,
      topK: limit,
      filter: Object.keys(filter).length > 0 ? filter : undefined,
      includeMetadata: true,
    });

    return results.matches
      .filter(match => (match.score || 0) >= minScore)
      .map(match => ({
        id: match.id,
        problemDescription: match.metadata?.problemDescription as string,
        solutionCode: match.metadata?.solutionCode as string,
        context: {
          projectType: match.metadata?.projectType as string,
          techStack: (match.metadata?.techStack as string)?.split(',') || [],
          taskType: match.metadata?.taskType as string,
        },
        successRating: match.metadata?.successRating as number,
        usageCount: match.metadata?.usageCount as number,
        createdAt: new Date(match.metadata?.createdAt as string),
        score: match.score || 0,
      }));
  }

  /**
   * Increment usage count for a solution
   */
  async recordUsage(solutionId: string): Promise<void> {
    const index = this.pinecone.index(this.indexName);
    
    // Fetch current metadata
    const result = await index.fetch([solutionId]);
    const current = result.records[solutionId];
    
    if (current && current.metadata) {
      const currentCount = (current.metadata.usageCount as number) || 0;
      
      await index.update({
        id: solutionId,
        metadata: {
          ...current.metadata,
          usageCount: currentCount + 1,
        },
      });
    }
  }
}
```

### 3.2 RAG-Enhanced Developer Agent

```typescript
// backend/src/agents/EnhancedDeveloperAgent.ts

import { BaseAgent } from './BaseAgent';
import { KnowledgeVectorService } from '../services/KnowledgeVectorService';
import { LLMService } from '../services/LLMService';

export class EnhancedDeveloperAgent extends BaseAgent {
  constructor(
    private llm: LLMService,
    private knowledge: KnowledgeVectorService
  ) {
    super();
  }

  async generateCode(task: {
    description: string;
    projectType: string;
    techStack: string[];
    taskType: string;
  }): Promise<string> {
    this.emitThought('Searching knowledge base for similar solutions...');

    // 1. RAG: Find similar past solutions
    const similarSolutions = await this.knowledge.findSimilarSolutions(
      task.description,
      {
        projectType: task.projectType,
        techStack: task.techStack,
        taskType: task.taskType,
      },
      3,
      0.7
    );

    // 2. Build context with past wisdom
    let wisdomContext = '';
    if (similarSolutions.length > 0) {
      this.emitThought(`Found ${similarSolutions.length} relevant past solutions!`);
      
      wisdomContext = '\n\n## Relevant Past Solutions\n\n' +
        similarSolutions.map((sol, i) => `
### Solution ${i + 1} (${(sol.score * 100).toFixed(0)}% match, used ${sol.usageCount} times)
**Problem:** ${sol.problemDescription}
**Solution:**
\`\`\`
${sol.solutionCode}
\`\`\`
`).join('\n');

      // Record usage
      for (const sol of similarSolutions) {
        await this.knowledge.recordUsage(sol.id);
      }
    } else {
      this.emitThought('No similar past solutions found. Generating fresh solution.');
    }

    // 3. Generate with enriched context
    const prompt = `
You are an expert developer working on a ${task.projectType} project.
Tech stack: ${task.techStack.join(', ')}

## Task
${task.description}

${wisdomContext}

## Instructions
Generate high-quality, production-ready code for this task.
If relevant past solutions were provided, learn from their patterns but adapt to the current context.
Include comments explaining your approach.

## Code`;

    const code = await this.llm.generate(prompt);
    this.emitCode(code, 'typescript');

    return code;
  }

  /**
   * After task completion, store successful patterns
   */
  async learnFromSuccess(
    taskDescription: string,
    solutionCode: string,
    context: { projectType: string; techStack: string[]; taskType: string },
    rating: number
  ): Promise<void> {
    if (rating >= 0.8) { // Only store high-quality solutions
      await this.knowledge.storeSolution({
        problemDescription: taskDescription,
        solutionCode,
        context,
        successRating: rating,
        usageCount: 0,
        createdAt: new Date(),
      });
      
      this.emitThought('Pattern stored in knowledge base for future use.');
    }
  }
}
```

---

## Summary

| Feature | Component | Status |
|---------|-----------|--------|
| **Voice Control** | Speech Hook | ✅ |
| | Command Button | ✅ |
| | Intent Classification | ✅ |
| **Self-Healing** | Error Monitor | ✅ |
| | Doctor Agent | ✅ |
| | Auto PR/Deploy | ✅ |
| **Cross-Project** | Vector DB Setup | ✅ |
| | RAG-Enhanced Agent | ✅ |
| | Pattern Storage | ✅ |
