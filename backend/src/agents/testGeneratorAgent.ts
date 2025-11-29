import { PrismaClient } from "@prisma/client";
import { callLLM } from "../llm/llmClient";
import { ModelConfig } from "../llm/types";
import { workspaceManager } from "../services/workspaceManager";

const prisma = new PrismaClient();

// Default config if agent not found
const DEFAULT_CONFIG: ModelConfig = {
  provider: "gemini",
  model: "gemini-2.0-flash-exp",
  maxTokens: 8000,
  temperature: 0.2
};

export async function runTestGeneratorAgentOnce() {
  // 1. Find tasks waiting for tests
  const task = await prisma.task.findFirst({
    where: {
      status: "PENDING_TESTS"
    },
    include: { module: true }
  });

  if (!task) return;

  console.log(`[TestGen] 🧪 Generating tests for Task ${task.id}`);

  try {
    // 2. Get the code that was just written
    // We expect the result to contain { output, targetFile }
    const result = task.result as any;
    const targetFile = result?.targetFile;
    const codeContent = result?.output;
    const projectId = task.module.projectId;

    if (!targetFile || !codeContent || !projectId) {
      console.warn(`[TestGen] ⚠️ Missing targetFile or content. Skipping test generation.`);
      // Skip straight to QA if we can't generate tests
      await prisma.task.update({
        where: { id: task.id },
        data: { status: "IN_QA" }
      });
      return;
    }

    // 3. Generate Test Code
    const prompt = `
You are a Senior Test Engineer.
Your goal is to write a robust test suite for the following code.

Target File: ${targetFile}
Code Content:
${codeContent}

Requirements:
1. Use 'jest' and '@testing-library/react' (if React component).
2. Cover happy paths and edge cases.
3. Mock external dependencies if needed.
4. Return ONLY the test code. No markdown. No explanations.
    `;

    const testCode = await callLLM(DEFAULT_CONFIG, [
      { role: "system", content: "You are a Test Generator Agent. Output only code." },
      { role: "user", content: prompt }
    ]).then(r => r.content);

    // 4. Determine Test File Path
    // e.g., src/components/Button.tsx -> src/components/__tests__/Button.test.tsx
    // or src/components/Button.tsx -> src/components/Button.test.tsx
    // Let's use a simple convention: same directory, .test.tsx extension
    const testFilePath = targetFile.replace(/\.(tsx|ts|js|jsx)$/, ".test.$1");

    // 5. Write Test File
    await workspaceManager.writeFile(projectId, testFilePath, testCode);
    console.log(`[TestGen] ✅ Wrote test file: ${testFilePath}`);

    // 6. Update Task -> IN_QA
    await prisma.task.update({
      where: { id: task.id },
      data: {
        status: "IN_QA",
        // Append test info to result? Or just leave it.
        // Let's add a note to the result
        result: {
          ...result,
          testFile: testFilePath
        }
      }
    });

  } catch (error: any) {
    console.error(`[TestGen] ❌ Error generating tests:`, error);
    // Fallback: Send to QA anyway, maybe they can catch it
    await prisma.task.update({
      where: { id: task.id },
      data: {
        status: "IN_QA",
        errorMessage: `Test generation failed: ${error.message}`
      }
    });
  }
}
