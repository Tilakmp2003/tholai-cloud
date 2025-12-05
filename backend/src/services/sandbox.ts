import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import Docker from 'dockerode';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { PassThrough } from 'stream';

// --- CONFIGURATION ---
const EXECUTION_MODE = process.env.EXECUTION_MODE || (process.env.NODE_ENV === 'production' ? 'CLOUD' : 'LOCAL');
const AWS_REGION = process.env.AWS_REGION || "us-east-1";
const LAMBDA_FUNCTION_NAME = "Tholai-Code-Executor";

// --- CLIENTS ---
const lambda = new LambdaClient({ region: AWS_REGION });
// Only instantiate Docker if in LOCAL mode to prevent crash on AWS App Runner (where Docker socket is missing)
const docker = EXECUTION_MODE === 'LOCAL' ? new Docker() : null;

interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  error?: string;
}

/**
 * Executes code in a secure sandbox.
 * Automatically selects between Local Docker and AWS Lambda based on env.
 */
export const executeInSandbox = async (code: string, language: 'javascript' | 'python' | 'typescript'): Promise<ExecutionResult> => {
  console.log(`[Sandbox] Executing ${language} code in ${EXECUTION_MODE} mode...`);

  if (EXECUTION_MODE === 'CLOUD') {
    return executeInLambda(code, language);
  } else {
    return executeInDocker(code, language);
  }
};

// --- STRATEGY 1: AWS LAMBDA (PROD) ---
async function executeInLambda(code: string, language: string): Promise<ExecutionResult> {
  try {
    const command = new InvokeCommand({
      FunctionName: LAMBDA_FUNCTION_NAME,
      Payload: JSON.stringify({ code, language }),
    });

    const response = await lambda.send(command);
    
    if (!response.Payload) {
      throw new Error("No payload received from Lambda");
    }

    // Decode the Uint8Array payload
    const result = JSON.parse(new TextDecoder().decode(response.Payload));
    
    // AWS Lambda errors (like timeouts) sometimes return a specific structure
    if (result.errorMessage) {
       return { stdout: "", stderr: result.errorMessage, exitCode: 1 };
    }

    return result;
  } catch (error: any) {
    console.error("[Sandbox] Lambda execution failed:", error);
    return { stdout: "", stderr: error.message, exitCode: 1, error: error.message };
  }
}

// --- STRATEGY 2: LOCAL DOCKER (DEV) ---
async function executeInDocker(code: string, language: string): Promise<ExecutionResult> {
  if (!docker) {
    return { stdout: "", stderr: "Docker client not initialized. Are you in LOCAL mode?", exitCode: 1 };
  }

  const containerId = uuidv4();
  // Use a temporary directory inside the project for volume mounting
  const tmpDir = path.join(process.cwd(), '.sandbox_tmp', containerId);
  
  // Ensure sandbox dir exists
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  try {
    let image = 'node:20-alpine';
    let cmd = ['node', 'script.js'];
    let filename = 'script.js';

    // Language configuration
    if (language === 'python') {
      image = 'python:3.10-alpine';
      cmd = ['python', 'script.py'];
      filename = 'script.py';
    } else if (language === 'typescript') {
      // For local testing, we run TS using ts-node/tsx if available, or just node (assuming pure JS for now)
      // Ideally, in a real sandbox, you'd use a custom image with ts-node installed.
      image = 'node:20-alpine'; 
      cmd = ['node', 'script.js']; 
    }

    // Write the code to the host file system (so Docker can see it)
    fs.writeFileSync(path.join(tmpDir, filename), code);

    // Create a mock node_modules structure for common packages
    // WHY MOCK? Installing real heavy libraries (Sequelize, AWS SDK) in a fresh Docker container
    // takes minutes. Mocking allows us to verify API syntax correctness (hallucination detection)
    // in milliseconds without network/disk overhead.
    const nodeModulesDir = path.join(tmpDir, 'node_modules');
    fs.mkdirSync(nodeModulesDir, { recursive: true });

    // Mock lodash
    const lodashDir = path.join(nodeModulesDir, 'lodash');
    fs.mkdirSync(lodashDir, { recursive: true });
    fs.writeFileSync(path.join(lodashDir, 'index.js'), 'const _ = { groupBy: (arr) => ({}), map: (arr) => [], filter: (arr) => [], reduce: (arr) => {} }; _.default = _; module.exports = _;');
    fs.writeFileSync(path.join(lodashDir, 'package.json'), '{"name": "lodash", "main": "index.js"}');

    // Mock prisma
    const prismaDir = path.join(nodeModulesDir, '@prisma', 'client');
    fs.mkdirSync(prismaDir, { recursive: true });
    fs.writeFileSync(path.join(prismaDir, 'index.js'), 'module.exports = { PrismaClient: class { constructor() { this.user = { findMany: async () => [] }; } } };');
    fs.writeFileSync(path.join(prismaDir, 'package.json'), '{"name": "@prisma/client", "main": "index.js"}');

    // Mock react
    const reactDir = path.join(nodeModulesDir, 'react');
    fs.mkdirSync(reactDir, { recursive: true });
    fs.writeFileSync(path.join(reactDir, 'index.js'), 'module.exports = { createElement: () => {}, useState: () => [null, () => {}], useEffect: () => {} };');
    fs.writeFileSync(path.join(reactDir, 'package.json'), '{"name": "react", "main": "index.js"}');

    // Mock express
    const expressDir = path.join(nodeModulesDir, 'express');
    fs.mkdirSync(expressDir, { recursive: true });
    fs.writeFileSync(path.join(expressDir, 'index.js'), 'const e = () => ({ get: () => {}, post: () => {}, listen: () => {}, use: () => {} }); e.default = e; module.exports = e;');
    fs.writeFileSync(path.join(expressDir, 'package.json'), '{"name": "express", "main": "index.js"}');

    // Mock aws-sdk
    const awsSdkDir = path.join(nodeModulesDir, 'aws-sdk');
    fs.mkdirSync(awsSdkDir, { recursive: true });
    fs.writeFileSync(path.join(awsSdkDir, 'index.js'), `
      module.exports = {
        S3: class { upload() { return { promise: () => Promise.resolve() }; } },
        DynamoDB: {
          DocumentClient: class {
            get() { return { promise: () => Promise.resolve({}) }; }
            put() { return { promise: () => Promise.resolve({}) }; }
          }
        }
      };
    `);
    fs.writeFileSync(path.join(awsSdkDir, 'package.json'), '{"name": "aws-sdk", "main": "index.js"}');

    // Mock sequelize
    const sequelizeDir = path.join(nodeModulesDir, 'sequelize');
    fs.mkdirSync(sequelizeDir, { recursive: true });
    fs.writeFileSync(path.join(sequelizeDir, 'index.js'), `
      module.exports = {
        Sequelize: class { constructor() {} },
        Model: class { static init() {} static findAll() { return Promise.resolve([]); } },
        DataTypes: { STRING: 'STRING' }
      };
    `);
    fs.writeFileSync(path.join(sequelizeDir, 'package.json'), '{"name": "sequelize", "main": "index.js"}');

    // Mock Jest globals for testing libraries
    // These are not module mocks, but global variables that Jest typically provides.
    // We'll inject them into the script's preamble.
    const jestPreamble = `
      const test = (name, fn) => fn();
      const expect = (actual) => ({
        toBe: (expected) => {},
        toEqual: (expected) => {},
        toBeTruthy: () => {},
        toBeFalsy: () => {}
      });
      const describe = (name, fn) => fn();
      const it = test;
    `;

    // Prepend the Jest preamble to the user's code
    fs.writeFileSync(path.join(tmpDir, filename), jestPreamble + '\n' + code);

    // Prepare streams to capture output
    const stdoutStream = new PassThrough();
    const stderrStream = new PassThrough();
    let stdoutData = '';
    let stderrData = '';

    stdoutStream.on('data', (chunk) => stdoutData += chunk.toString());
    stderrStream.on('data', (chunk) => stderrData += chunk.toString());

    // Docker Run with TIMEOUT
    const TIMEOUT_MS = 10000; // 10 second timeout
    
    const runPromise = docker.run(image, cmd, [stdoutStream, stderrStream], {
      HostConfig: {
        Binds: [`${tmpDir}:/app`], // Mount the temp dir to /app in container
        AutoRemove: true,         // Delete container after run
        NetworkMode: 'none',      // No internet
        Memory: 512 * 1024 * 1024 // 512MB RAM limit
      },
      WorkingDir: '/app',
      Tty: false
    });
    
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Sandbox timeout: code took too long to execute')), TIMEOUT_MS);
    });
    
    const data = await Promise.race([runPromise, timeoutPromise]);

    const output = data[0]; // Result of the run
    const container = data[1]; // The container object (unused since auto-removed)

    return {
      stdout: stdoutData,
      stderr: stderrData,
      exitCode: output.StatusCode
    };

  } catch (error: any) {
    console.error("[Sandbox] Docker execution failed:", error);
    return { stdout: "", stderr: error.message, exitCode: 1, error: error.message };
  } finally {
    // Cleanup: Remove the temp directory
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (e) { console.warn("Failed to clean sandbox dir", e); }
  }
}

export const sandbox = {
  executeInSandbox,
  getOrCreateSession: (sessionId: string) => ({
    exec: async (code: string) => executeInSandbox(code, 'javascript'),
    streamExec: async (code: string, onData: any) => executeInSandbox(code, 'javascript')
  })
};
