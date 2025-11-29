/**
 * Safety Policy Enforcement Service
 * 
 * Allowlist/denylist middleware for agent actions.
 * Prevents unauthorized installs, network calls, and dangerous operations.
 */

import { emitLog } from '../websocket/socketServer';

// Package allowlist/denylist
const PACKAGE_ALLOWLIST = new Set([
  // Core frameworks
  'react', 'react-dom', 'next', 'express', 'fastify',
  // UI libraries
  'tailwindcss', '@radix-ui/*', 'framer-motion', 'lucide-react',
  // Data
  'prisma', '@prisma/client', 'mongoose', 'pg', 'redis', 'ioredis',
  // Auth
  '@clerk/nextjs', 'next-auth', 'jsonwebtoken', 'bcrypt',
  // Utilities
  'axios', 'zod', 'date-fns', 'lodash', 'uuid',
  // Testing
  'jest', 'vitest', '@testing-library/*',
  // Types
  '@types/*', 'typescript'
]);

const PACKAGE_DENYLIST = new Set([
  // Dangerous packages
  'eval', 'vm2', 'child_process',
  // Known malicious patterns
  'event-stream', 'flatmap-stream',
  // System access
  'fs-extra', 'shelljs', 'execa',
  // Network tools that could be abused
  'puppeteer', 'playwright', 'selenium-webdriver'
]);

// Command denylist
const COMMAND_DENYLIST = [
  /rm\s+-rf\s+\//, // rm -rf /
  /rm\s+-rf\s+~/, // rm -rf ~
  /curl.*\|.*sh/, // curl | sh
  /wget.*\|.*sh/, // wget | sh
  /chmod\s+777/, // chmod 777
  /sudo/, // sudo commands
  /eval\s*\(/, // eval()
  /exec\s*\(/, // exec()
  />\s*\/dev\//, // redirect to /dev/
  /mkfs/, // format disk
  /dd\s+if=/, // dd command
];

// File path denylist
const PATH_DENYLIST = [
  /^\/etc\//,
  /^\/usr\//,
  /^\/var\//,
  /^\/root\//,
  /^~\//,
  /\.env$/,
  /\.env\.local$/,
  /\.env\.production$/,
  /id_rsa/,
  /\.ssh\//,
  /\.aws\//,
  /credentials/i,
  /secrets/i,
];

export interface PolicyViolation {
  type: 'PACKAGE' | 'COMMAND' | 'PATH' | 'NETWORK' | 'COST';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  blocked: boolean;
}

export interface PolicyCheckResult {
  allowed: boolean;
  violations: PolicyViolation[];
}

/**
 * Check if a package installation is allowed
 */
export function checkPackageInstall(packageName: string): PolicyCheckResult {
  const violations: PolicyViolation[] = [];
  
  // Check denylist first
  if (PACKAGE_DENYLIST.has(packageName)) {
    violations.push({
      type: 'PACKAGE',
      severity: 'CRITICAL',
      message: `Package "${packageName}" is on the denylist`,
      blocked: true
    });
    emitLog(`[Safety] 🚫 BLOCKED: Package install "${packageName}" (denylisted)`);
    return { allowed: false, violations };
  }
  
  // Check allowlist
  const isAllowed = PACKAGE_ALLOWLIST.has(packageName) || 
    Array.from(PACKAGE_ALLOWLIST).some(pattern => {
      if (pattern.endsWith('/*')) {
        const prefix = pattern.slice(0, -2);
        return packageName.startsWith(prefix);
      }
      return false;
    });
  
  if (!isAllowed) {
    violations.push({
      type: 'PACKAGE',
      severity: 'MEDIUM',
      message: `Package "${packageName}" is not on the allowlist - requires approval`,
      blocked: false // Not blocked, but flagged for approval
    });
    emitLog(`[Safety] ⚠️ Package "${packageName}" requires approval (not allowlisted)`);
  }
  
  return { allowed: isAllowed, violations };
}

/**
 * Check if a command is safe to execute
 */
export function checkCommand(command: string): PolicyCheckResult {
  const violations: PolicyViolation[] = [];
  
  for (const pattern of COMMAND_DENYLIST) {
    if (pattern.test(command)) {
      violations.push({
        type: 'COMMAND',
        severity: 'CRITICAL',
        message: `Command matches dangerous pattern: ${pattern}`,
        blocked: true
      });
      emitLog(`[Safety] 🚫 BLOCKED: Dangerous command detected`);
      return { allowed: false, violations };
    }
  }
  
  return { allowed: true, violations };
}

/**
 * Check if a file path is safe to access
 */
export function checkFilePath(filePath: string): PolicyCheckResult {
  const violations: PolicyViolation[] = [];
  
  for (const pattern of PATH_DENYLIST) {
    if (pattern.test(filePath)) {
      violations.push({
        type: 'PATH',
        severity: 'HIGH',
        message: `Path "${filePath}" matches restricted pattern`,
        blocked: true
      });
      emitLog(`[Safety] 🚫 BLOCKED: Restricted path access "${filePath}"`);
      return { allowed: false, violations };
    }
  }
  
  return { allowed: true, violations };
}

/**
 * Add package to allowlist (requires admin)
 */
export function addToAllowlist(packageName: string): void {
  PACKAGE_ALLOWLIST.add(packageName);
  emitLog(`[Safety] ✅ Added "${packageName}" to package allowlist`);
}

/**
 * Remove package from allowlist
 */
export function removeFromAllowlist(packageName: string): void {
  PACKAGE_ALLOWLIST.delete(packageName);
  emitLog(`[Safety] ❌ Removed "${packageName}" from package allowlist`);
}

/**
 * Get current allowlist
 */
export function getAllowlist(): string[] {
  return Array.from(PACKAGE_ALLOWLIST);
}

/**
 * Get current denylist
 */
export function getDenylist(): string[] {
  return Array.from(PACKAGE_DENYLIST);
}

export const safetyPolicy = {
  checkPackageInstall,
  checkCommand,
  checkFilePath,
  addToAllowlist,
  removeFromAllowlist,
  getAllowlist,
  getDenylist
};
