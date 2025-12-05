/**
 * Zero-Hallucination System: Code Safety Analyzer
 * 
 * Detects dangerous or problematic code patterns:
 * - Computationally expensive loops
 * - Infinite loops
 * - Blocking operations
 * - Resource exhaustion
 * - Over-generation (too much code for simple tasks)
 */

export interface SafetyAnalysisResult {
  isSafe: boolean;
  issues: string[];
  metrics: {
    loopComplexity: number;
    nestingDepth: number;
    estimatedIterations: number;
    codeToInputRatio: number;
  };
}

export class CodeSafetyAnalyzer {
  
  // Thresholds
  private readonly MAX_LOOP_ITERATIONS = 10_000_000;
  private readonly MAX_NESTING_DEPTH = 5;
  private readonly MAX_CODE_TO_INPUT_RATIO = 10; // For simple tasks

  /**
   * Analyze code for safety issues
   */
  analyze(code: string, inputContext: string): SafetyAnalysisResult {
    const issues: string[] = [];
    
    // Analyze loops
    const loopAnalysis = this.analyzeLoops(code);
    if (loopAnalysis.estimatedIterations > this.MAX_LOOP_ITERATIONS) {
      issues.push(`Expensive loop detected: ~${loopAnalysis.estimatedIterations.toLocaleString()} iterations`);
    }
    if (loopAnalysis.nestingDepth > this.MAX_NESTING_DEPTH) {
      issues.push(`Deeply nested loops: ${loopAnalysis.nestingDepth} levels`);
    }
    if (loopAnalysis.hasInfiniteLoop) {
      issues.push('Infinite loop pattern detected');
    }
    if (loopAnalysis.hasBlockingPattern) {
      issues.push('Blocking computation pattern detected');
    }

    // Analyze over-generation
    const overgenAnalysis = this.analyzeOverGeneration(code, inputContext);
    if (overgenAnalysis.isOverGenerated) {
      issues.push(`Over-generation: ${overgenAnalysis.reason}`);
    }

    // Analyze dangerous patterns
    const dangerousPatterns = this.findDangerousPatterns(code);
    issues.push(...dangerousPatterns);

    return {
      isSafe: issues.length === 0,
      issues,
      metrics: {
        loopComplexity: loopAnalysis.complexity,
        nestingDepth: loopAnalysis.nestingDepth,
        estimatedIterations: loopAnalysis.estimatedIterations,
        codeToInputRatio: overgenAnalysis.ratio,
      },
    };
  }

  /**
   * Analyze loops for complexity and potential issues
   */
  private analyzeLoops(code: string): {
    complexity: number;
    nestingDepth: number;
    estimatedIterations: number;
    hasInfiniteLoop: boolean;
    hasBlockingPattern: boolean;
  } {
    let complexity = 0;
    let maxNestingDepth = 0;
    let estimatedIterations = 0;
    let hasInfiniteLoop = false;
    let hasBlockingPattern = false;

    // Detect for loops with large iteration counts
    const forLoopRegex = /for\s*\([^;]*;\s*[^;]*<\s*(\d+|[a-zA-Z_]\w*)/g;
    let match;
    while ((match = forLoopRegex.exec(code)) !== null) {
      complexity++;
      const limit = match[1];
      const numLimit = parseInt(limit, 10);
      if (!isNaN(numLimit)) {
        estimatedIterations = Math.max(estimatedIterations, numLimit);
      }
    }

    // Detect while(true) or while(1) patterns
    if (/while\s*\(\s*(true|1)\s*\)/.test(code)) {
      hasInfiniteLoop = true;
    }

    // Detect for(;;) infinite loop
    if (/for\s*\(\s*;\s*;\s*\)/.test(code)) {
      hasInfiniteLoop = true;
    }

    // Detect blocking computation patterns (expensive math in tight loops)
    const blockingPatterns = [
      /for\s*\([^)]*\)\s*\{[^}]*Math\.(pow|sin|cos|tan|sqrt|log|exp)/,
      /while\s*\([^)]*\)\s*\{[^}]*Math\.(pow|sin|cos|tan|sqrt|log|exp)/,
      /for\s*\([^)]*\)\s*\{[^}]*\*\*/, // Exponentiation operator
    ];
    hasBlockingPattern = blockingPatterns.some(p => p.test(code));

    // Count nesting depth
    let currentDepth = 0;
    const loopKeywords = /\b(for|while|do)\s*[\(\{]/g;
    const openBrace = /\{/g;
    const closeBrace = /\}/g;
    
    // Simple nesting counter
    const lines = code.split('\n');
    for (const line of lines) {
      if (/\b(for|while|do)\b/.test(line)) {
        currentDepth++;
        maxNestingDepth = Math.max(maxNestingDepth, currentDepth);
      }
      if (/^\s*\}/.test(line)) {
        currentDepth = Math.max(0, currentDepth - 1);
      }
    }

    return {
      complexity,
      nestingDepth: maxNestingDepth,
      estimatedIterations,
      hasInfiniteLoop,
      hasBlockingPattern,
    };
  }

  /**
   * Analyze if code is over-generated for the task
   */
  private analyzeOverGeneration(code: string, input: string): {
    isOverGenerated: boolean;
    reason: string;
    ratio: number;
  } {
    const inputWords = input.split(/\s+/).length;
    const codeLines = code.split('\n').filter(l => l.trim()).length;
    const codeChars = code.length;
    const inputChars = input.length;
    
    const ratio = codeChars / Math.max(inputChars, 1);
    
    // Simple task indicators
    const isSimpleTask = this.isSimpleTask(input);
    
    // Check for over-generation
    if (isSimpleTask) {
      // For simple tasks, output shouldn't be more than 3x the input
      if (ratio > 5) {
        return {
          isOverGenerated: true,
          reason: `Code is ${ratio.toFixed(1)}x larger than input for a simple task`,
          ratio,
        };
      }
      
      // Check for class definitions in simple tasks
      const classCount = (code.match(/\bclass\s+\w+/g) || []).length;
      if (classCount > 0 && !input.toLowerCase().includes('class')) {
        return {
          isOverGenerated: true,
          reason: `Created ${classCount} class(es) when not requested`,
          ratio,
        };
      }
      
      // Check for multiple functions when only one was asked
      const funcCount = (code.match(/\b(function|const\s+\w+\s*=\s*\(|=>\s*\{)/g) || []).length;
      if (funcCount > 2 && inputWords < 10) {
        return {
          isOverGenerated: true,
          reason: `Created ${funcCount} functions for a simple request`,
          ratio,
        };
      }
    }
    
    return { isOverGenerated: false, reason: '', ratio };
  }

  /**
   * Detect if the task is simple (fix, rename, add log, etc.)
   */
  private isSimpleTask(input: string): boolean {
    const simpleIndicators = [
      /\bfix\b/i,
      /\btypo\b/i,
      /\brename\b/i,
      /\badd\s+(a\s+)?log/i,
      /\bconsole\.log/i,
      /\bchange\s+(the\s+)?\w+\s+to\b/i,
      /\bupdate\s+(the\s+)?\w+\b/i,
      /\bremove\b/i,
      /\bdelete\b/i,
      /\bextract\b/i,
    ];
    
    const complexIndicators = [
      /\bfull\b/i,
      /\bcomplete\b/i,
      /\bcreate\s+(a\s+)?(new\s+)?(component|service|class|system)/i,
      /\bbuild\b/i,
      /\bimplement\b/i,
      /\bwith\s+.*\s+and\s+/i,
    ];
    
    const isSimple = simpleIndicators.some(p => p.test(input));
    const isComplex = complexIndicators.some(p => p.test(input));
    
    return isSimple && !isComplex;
  }

  /**
   * Find dangerous code patterns
   */
  private findDangerousPatterns(code: string): string[] {
    const issues: string[] = [];
    
    const patterns: Array<{ pattern: RegExp; message: string }> = [
      { pattern: /eval\s*\(/, message: 'eval() is dangerous' },
      { pattern: /new\s+Function\s*\(/, message: 'new Function() is dangerous' },
      { pattern: /document\.write\s*\(/, message: 'document.write is deprecated' },
      { pattern: /innerHTML\s*=\s*[^'"]/, message: 'innerHTML without sanitization' },
      { pattern: /__proto__/, message: '__proto__ manipulation is dangerous' },
      { pattern: /process\.exit\s*\(/, message: 'process.exit should not be in production code' },
      { pattern: /rm\s+-rf/, message: 'Destructive shell command detected' },
      { pattern: /exec\s*\(['"`].*\$/, message: 'Potential command injection' },
    ];
    
    for (const { pattern, message } of patterns) {
      if (pattern.test(code)) {
        issues.push(message);
      }
    }
    
    return issues;
  }
}

export const codeSafetyAnalyzer = new CodeSafetyAnalyzer();
