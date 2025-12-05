
import { RoleBaseline } from '../../types/verification';
import { symbolicHasher } from './SymbolicHasher';

export interface EntropyAnalysis {
  inputEntropy: number;
  outputEntropy: number;
  ratio: number;
  isViolation: boolean;
  threshold: number;
}

export interface EntropyCheckResult {
  passed: boolean;
  message?: string;
  durationMs: number;
}

export class EntropyDetector {
  private readonly ENTROPY_THRESHOLD = 2.0; // Relaxed from 1.5 to 2.0 to prevent false positives on dense algorithms
  
  /**
   * Main entry point for entropy verification
   */
  checkEntropy(input: string, output: string, baseline: RoleBaseline): EntropyCheckResult {
    const startTime = Date.now();
    
    // Extract expected complexity from input
    const expectedComplexity = this.estimateExpectedComplexity(input);
    
    const analysis = this.analyzeEntropy(input, output);
    
    // Adjust thresholds based on request complexity
    const adjustedMaxRatio = baseline.maxComplexityRatio * expectedComplexity;
    const adjustedMaxDelta = baseline.maxLineDelta * expectedComplexity;
    
    // Check 1: Entropy ratio (adjusted)
    // If output has significantly more "information" than input + context, it's suspicious
    const entropyViolation = analysis.ratio > adjustedMaxRatio;
    
    // Check 2: Line count delta (adjusted)
    const inputLines = input.split('\n').length;
    const outputLines = output.split('\n').length;
    const lineDelta = Math.max(0, outputLines - inputLines);
    const lineViolation = lineDelta > adjustedMaxDelta;
    
    // Check 3: New imports count (stricter for simple tasks)
    const newImports = this.countNewImports(output, input);
    const adjustedMaxImports = expectedComplexity > 1.5 
      ? baseline.maxNewImports + 2 
      : baseline.maxNewImports;
    const importViolation = newImports > adjustedMaxImports;
    
    const passed = !entropyViolation && !lineViolation && !importViolation;
    
    let message: string | undefined;
    if (!passed) {
      const violations: string[] = [];
      if (entropyViolation) violations.push(`entropy ratio ${analysis.ratio.toFixed(2)} > ${adjustedMaxRatio.toFixed(2)}`);
      if (lineViolation) violations.push(`line delta ${lineDelta} > ${adjustedMaxDelta}`);
      if (importViolation) violations.push(`new imports ${newImports} > ${adjustedMaxImports}`);
      message = `Entropy violation: ${violations.join(', ')}`;
    }

    return { passed, message, durationMs: Date.now() - startTime };
  }

  /**
   * Estimate expected complexity multiplier from the input request
   */
  private estimateExpectedComplexity(input: string): number {
    const lowComplexityKeywords = ['fix', 'typo', 'rename', 'simple', 'minor', 'small', 'tweak'];
    const mediumComplexityKeywords = ['add', 'update', 'modify', 'change', 'implement'];
    const highComplexityKeywords = ['create', 'build', 'full', 'complete', 'component', 'feature', 'service', 'system'];
    
    const inputLower = input.toLowerCase();
    
    // Check for high complexity indicators
    if (highComplexityKeywords.some(kw => inputLower.includes(kw))) {
      // Check for even higher complexity
      if (inputLower.includes('with') && inputLower.includes('and')) return 3.0;
      if (inputLower.includes('full') || inputLower.includes('complete')) return 2.5;
      return 2.0;
    }
    
    // Medium complexity
    if (mediumComplexityKeywords.some(kw => inputLower.includes(kw))) {
      return 1.5;
    }
    
    // Low complexity
    if (lowComplexityKeywords.some(kw => inputLower.includes(kw))) {
      return 0.8;
    }
    
    return 1.0; // Default
  }

  /**
   * Calculate Shannon entropy of a string
   */
  private calculateShannonEntropy(text: string): number {
    if (!text || text.length === 0) return 0;

    const freq = new Map<string, number>();
    for (const char of text) {
      freq.set(char, (freq.get(char) || 0) + 1);
    }

    let entropy = 0;
    const len = text.length;
    for (const count of freq.values()) {
      const p = count / len;
      entropy -= p * Math.log2(p);
    }

    return entropy;
  }

  /**
   * Analyze entropy relationship between input and output
   */
  private analyzeEntropy(input: string, output: string): EntropyAnalysis {
    const inputEntropy = this.calculateShannonEntropy(input);
    const outputEntropy = this.calculateShannonEntropy(output);
    
    // Use SymbolicHasher to get structural complexity (approximated by normalized length)
    // We can't easily get "complexity" from hash, so we use normalized length ratio
    const normalizedInput = input.replace(/\s+/g, ' ').length;
    const normalizedOutput = output.replace(/\s+/g, ' ').length;
    
    const entropyRatio = inputEntropy > 0 ? outputEntropy / inputEntropy : 1;
    const complexityRatio = normalizedInput > 0 ? normalizedOutput / normalizedInput : 1;
    
    // Combined ratio: Entropy (information density) + Complexity (structural size)
    const ratio = (entropyRatio + complexityRatio) / 2;

    return {
      inputEntropy,
      outputEntropy,
      ratio,
      isViolation: ratio > this.ENTROPY_THRESHOLD,
      threshold: this.ENTROPY_THRESHOLD,
    };
  }

  /**
   * Count new imports that weren't in the input
   */
  private countNewImports(output: string, input: string): number {
    const importRegex = /import\s+.*?from\s+['"]([^'"]+)['"]/g;
    
    const inputImports = new Set<string>();
    let match;
    while ((match = importRegex.exec(input)) !== null) {
      inputImports.add(match[1]);
    }
    
    importRegex.lastIndex = 0;
    
    let newImports = 0;
    while ((match = importRegex.exec(output)) !== null) {
      if (!inputImports.has(match[1])) {
        newImports++;
      }
    }
    
    return newImports;
  }
}

export const entropyDetector = new EntropyDetector();
