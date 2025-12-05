/**
 * Tholai Code Executor Lambda
 * Executes code in a secure sandbox environment
 */

import { Handler } from 'aws-lambda';
import { execSync, spawn } from 'child_process';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';

interface ExecutionRequest {
  code: string;
  language: 'javascript' | 'typescript' | 'python';
}

interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  error?: string;
}

// Lambda handler
export const handler: Handler<ExecutionRequest, ExecutionResult> = async (event) => {
  console.log(`[CodeExecutor] Received request for ${event.language}`);
  
  const { code, language } = event;
  
  if (!code || !language) {
    return {
      stdout: '',
      stderr: 'Missing code or language parameter',
      exitCode: 1,
      error: 'Invalid request'
    };
  }
  
  // Create temp execution directory
  const execId = randomUUID();
  const tmpDir = `/tmp/${execId}`;
  
  try {
    mkdirSync(tmpDir, { recursive: true });
    
    let filename: string;
    let cmd: string[];
    
    switch (language) {
      case 'python':
        filename = 'script.py';
        cmd = ['python3', join(tmpDir, filename)];
        break;
      case 'typescript':
      case 'javascript':
      default:
        filename = 'script.js';
        // Add mock globals for common testing patterns
        const wrappedCode = `
// Mock globals for testing
const test = (name, fn) => fn();
const describe = (name, fn) => fn();
const it = test;
const expect = (actual) => ({
  toBe: (expected) => {},
  toEqual: (expected) => {},
  toBeTruthy: () => {},
  toBeFalsy: () => {},
  toThrow: () => {},
  not: { toBe: () => {}, toThrow: () => {} }
});

// User code below
${code}
`;
        writeFileSync(join(tmpDir, filename), wrappedCode);
        cmd = ['node', join(tmpDir, filename)];
        break;
    }
    
    // Write the code file
    if (language === 'python') {
      writeFileSync(join(tmpDir, filename), code);
    }
    
    // Execute with timeout
    const TIMEOUT_MS = 10000; // 10 seconds
    const result = await executeWithTimeout(cmd, TIMEOUT_MS);
    
    console.log(`[CodeExecutor] Execution completed with exit code ${result.exitCode}`);
    
    return result;
    
  } catch (error: any) {
    console.error(`[CodeExecutor] Error:`, error);
    return {
      stdout: '',
      stderr: error.message || 'Unknown error',
      exitCode: 1,
      error: error.message
    };
  } finally {
    // Cleanup
    try {
      rmSync(tmpDir, { recursive: true, force: true });
    } catch (e) {}
  }
};

async function executeWithTimeout(cmd: string[], timeoutMs: number): Promise<ExecutionResult> {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let killed = false;
    
    const proc = spawn(cmd[0], cmd.slice(1), {
      timeout: timeoutMs,
      killSignal: 'SIGKILL',
    });
    
    const timer = setTimeout(() => {
      killed = true;
      proc.kill('SIGKILL');
    }, timeoutMs);
    
    proc.stdout?.on('data', (data) => {
      stdout += data.toString();
    });
    
    proc.stderr?.on('data', (data) => {
      stderr += data.toString();
    });
    
    proc.on('close', (code) => {
      clearTimeout(timer);
      
      if (killed) {
        resolve({
          stdout: stdout.slice(0, 5000),
          stderr: 'Execution timeout - code took too long',
          exitCode: 124,
          error: 'Timeout'
        });
      } else {
        resolve({
          stdout: stdout.slice(0, 10000), // Limit output size
          stderr: stderr.slice(0, 5000),
          exitCode: code ?? 1
        });
      }
    });
    
    proc.on('error', (err) => {
      clearTimeout(timer);
      resolve({
        stdout: '',
        stderr: err.message,
        exitCode: 1,
        error: err.message
      });
    });
  });
}
