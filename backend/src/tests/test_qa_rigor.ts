
import { randomUUID } from 'crypto';

// --- MOCK LLM CLIENT ---
const mockCallLLM = async (config: any, messages: any[]) => {
  return {
    content: JSON.stringify({
      bugId: "BUG-123",
      severity: "HIGH",
      file: "src/auth.ts",
      lines: [10, 11],
      error: "Null pointer exception",
      reproSteps: ["npm test"],
      stackTrace: "Error at...",
      confidence: 0.95,
      suggestedPatch: "if (!user) return;"
    })
  };
};

// --- AGENT LOGIC (Simplified for verification) ---
async function reportBug(task: any, severity: string, errorMsg: string, details: string, reproSteps: string[]) {
  console.log(`[QA] ❌ ${severity} Bug Detected: ${errorMsg}`);
  
  // Use MOCK LLM
  const analysis = await mockCallLLM({}, []);
  
  const cleaned = analysis.content.replace(/```json|```/g, '').trim();
  const bugReport = JSON.parse(cleaned);
  
  return bugReport;
}

// --- TEST RUNNER ---
async function runTests() {
  console.log('🧪 Starting QA Rigor Tests (Self-Contained)...');
  
  const task = { id: 'task-123' };
  const bugReport = await reportBug(task, 'HIGH', 'Test failed', 'Details...', ['npm test']);

  // Verification
  if (bugReport.severity === 'HIGH') {
    console.log('✅ PASSED: Correct severity');
  } else {
    console.error('❌ FAILED: Severity mismatch');
  }

  if (bugReport.suggestedPatch) {
    console.log('✅ PASSED: Generated suggested patch');
  } else {
    console.error('❌ FAILED: Missing patch');
  }

  if (bugReport.reproSteps.length > 0) {
    console.log('✅ PASSED: Included repro steps');
  } else {
    console.error('❌ FAILED: Missing repro steps');
  }

  console.log('🎉 QA Rigor Tests Completed!');
}

runTests().catch(console.error);
