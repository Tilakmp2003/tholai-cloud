/**
 * Git Integration Service
 * 
 * Provides automatic git operations for agent-generated code:
 * - Auto-commits per task completion
 * - Branch-per-feature workflow
 * - PR creation for review
 * - Rollback capabilities
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs/promises';
import { emitLog } from '../websocket/socketServer';
import { approvalGates } from './approvalGates';

const execAsync = promisify(exec);
const prisma = new PrismaClient();

export interface CommitResult {
  success: boolean;
  commitHash?: string;
  branch?: string;
  error?: string;
}

export interface BranchInfo {
  name: string;
  isDefault: boolean;
  lastCommit: string;
  ahead: number;
  behind: number;
}

export class GitIntegrationService {
  
  /**
   * Initialize git repository in workspace
   */
  async initRepo(workspacePath: string, projectName: string): Promise<boolean> {
    try {
      // Check if already a git repo
      try {
        await execAsync('git rev-parse --git-dir', { cwd: workspacePath });
        emitLog(`[Git] Repository already initialized at ${workspacePath}`);
        return true;
      } catch {
        // Not a git repo, initialize
      }
      
      await execAsync('git init', { cwd: workspacePath });
      await execAsync('git config user.email "ai-agent@virtualcompany.dev"', { cwd: workspacePath });
      await execAsync('git config user.name "AI Agent"', { cwd: workspacePath });
      
      // Create .gitignore
      const gitignore = `node_modules/
.next/
.env
.env.local
*.log
.DS_Store
`;
      await fs.writeFile(path.join(workspacePath, '.gitignore'), gitignore);
      
      // Initial commit
      await execAsync('git add .', { cwd: workspacePath });
      await execAsync(`git commit -m "🎉 Initial commit: ${projectName}"`, { cwd: workspacePath });
      
      emitLog(`[Git] ✅ Repository initialized for ${projectName}`);
      return true;
    } catch (error: any) {
      emitLog(`[Git] ❌ Failed to initialize repo: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Create a feature branch for a module/task
   */
  async createBranch(workspacePath: string, branchName: string): Promise<boolean> {
    try {
      const safeBranch = this.sanitizeBranchName(branchName);
      
      // Check if branch exists
      try {
        await execAsync(`git rev-parse --verify ${safeBranch}`, { cwd: workspacePath });
        // Branch exists, switch to it
        await execAsync(`git checkout ${safeBranch}`, { cwd: workspacePath });
        emitLog(`[Git] Switched to existing branch: ${safeBranch}`);
      } catch {
        // Branch doesn't exist, create it
        await execAsync(`git checkout -b ${safeBranch}`, { cwd: workspacePath });
        emitLog(`[Git] 🌿 Created branch: ${safeBranch}`);
      }
      
      return true;
    } catch (error: any) {
      emitLog(`[Git] ❌ Failed to create branch: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Auto-commit changes for a completed task
   */
  async commitTaskChanges(
    projectId: string,
    taskId: string,
    message: string,
    files?: string[]
  ): Promise<CommitResult> {
    try {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { workspacePath: true, name: true }
      });
      
      if (!project?.workspacePath) {
        return { success: false, error: 'No workspace path' };
      }
      
      const task = await prisma.task.findUnique({
        where: { id: taskId },
        include: { assignedToAgent: true, module: true }
      });
      
      // Stage files
      if (files && files.length > 0) {
        for (const file of files) {
          await execAsync(`git add "${file}"`, { cwd: project.workspacePath });
        }
      } else {
        await execAsync('git add -A', { cwd: project.workspacePath });
      }
      
      // Check if there are changes to commit
      const { stdout: status } = await execAsync('git status --porcelain', { cwd: project.workspacePath });
      if (!status.trim()) {
        emitLog(`[Git] No changes to commit for task ${taskId}`);
        return { success: true, commitHash: 'no-changes' };
      }
      
      // Get changed files for approval gate
      const changedFiles = status.trim().split('\n').map(line => line.substring(3));
      
      // Create approval gate for pre-commit review
      const gate = await approvalGates.createGate(
        projectId,
        'PRE_COMMIT',
        `Commit: ${message}`,
        `Review changes before committing`,
        {
          taskId,
          message,
          files: changedFiles,
          agentRole: task?.assignedToAgent?.role || 'Unknown'
        },
        taskId
      );
      
      // If gate requires approval, wait (with timeout)
      if (gate.status === 'PENDING') {
        emitLog(`[Git] ⏳ Waiting for commit approval...`);
        try {
          const resolvedGate = await approvalGates.waitForApproval(gate.id, 300000); // 5 min timeout
          
          if (resolvedGate.status === 'REJECTED') {
            emitLog(`[Git] ❌ Commit rejected: ${resolvedGate.reviewerNotes}`);
            // Unstage changes
            await execAsync('git reset HEAD', { cwd: project.workspacePath });
            return { success: false, error: `Rejected: ${resolvedGate.reviewerNotes}` };
          }
        } catch (timeoutError) {
          // Auto-approve on timeout for now (configurable)
          emitLog(`[Git] ⚠️ Approval timeout, auto-approving...`);
        }
      }
      
      // Build commit message
      const agentInfo = task?.assignedToAgent 
        ? `\n\nAgent: ${task.assignedToAgent.role} (${task.assignedToAgent.id.substring(0, 8)})`
        : '';
      const moduleInfo = task?.module ? `\nModule: ${task.module.name}` : '';
      const fullMessage = `🤖 ${message}${moduleInfo}${agentInfo}\n\nTask ID: ${taskId}`;
      
      // Commit
      const { stdout } = await execAsync(
        `git commit -m "${fullMessage.replace(/"/g, '\\"')}"`,
        { cwd: project.workspacePath }
      );
      
      // Get commit hash
      const { stdout: hash } = await execAsync('git rev-parse HEAD', { cwd: project.workspacePath });
      const commitHash = hash.trim().substring(0, 8);
      
      // Get current branch
      const { stdout: branch } = await execAsync('git branch --show-current', { cwd: project.workspacePath });
      
      emitLog(`[Git] ✅ Committed: ${commitHash} on ${branch.trim()}`);
      
      return {
        success: true,
        commitHash,
        branch: branch.trim()
      };
    } catch (error: any) {
      emitLog(`[Git] ❌ Commit failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Create a module branch and switch to it
   */
  async startModuleBranch(projectId: string, moduleName: string): Promise<string | null> {
    try {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { workspacePath: true }
      });
      
      if (!project?.workspacePath) return null;
      
      const branchName = `feature/${this.sanitizeBranchName(moduleName)}`;
      await this.createBranch(project.workspacePath, branchName);
      
      return branchName;
    } catch (error) {
      return null;
    }
  }
  
  /**
   * Merge module branch back to main
   */
  async mergeModuleBranch(
    projectId: string,
    branchName: string,
    deleteBranch: boolean = true
  ): Promise<boolean> {
    try {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { workspacePath: true }
      });
      
      if (!project?.workspacePath) return false;
      
      // Switch to main
      await execAsync('git checkout main', { cwd: project.workspacePath });
      
      // Merge
      await execAsync(`git merge ${branchName} --no-ff -m "🔀 Merge ${branchName}"`, { 
        cwd: project.workspacePath 
      });
      
      // Delete branch if requested
      if (deleteBranch) {
        await execAsync(`git branch -d ${branchName}`, { cwd: project.workspacePath });
      }
      
      emitLog(`[Git] 🔀 Merged ${branchName} into main`);
      return true;
    } catch (error: any) {
      emitLog(`[Git] ❌ Merge failed: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Get diff for a file or all changes
   */
  async getDiff(workspacePath: string, filePath?: string): Promise<string> {
    try {
      const cmd = filePath 
        ? `git diff HEAD -- "${filePath}"`
        : 'git diff HEAD';
      
      const { stdout } = await execAsync(cmd, { cwd: workspacePath });
      return stdout;
    } catch (error) {
      return '';
    }
  }
  
  /**
   * Rollback to a specific commit
   */
  async rollback(workspacePath: string, commitHash: string): Promise<boolean> {
    try {
      await execAsync(`git revert ${commitHash} --no-commit`, { cwd: workspacePath });
      await execAsync(`git commit -m "⏪ Rollback: Revert ${commitHash}"`, { cwd: workspacePath });
      
      emitLog(`[Git] ⏪ Rolled back to ${commitHash}`);
      return true;
    } catch (error: any) {
      emitLog(`[Git] ❌ Rollback failed: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Get commit history
   */
  async getHistory(workspacePath: string, limit: number = 20): Promise<Array<{
    hash: string;
    message: string;
    author: string;
    date: string;
  }>> {
    try {
      const { stdout } = await execAsync(
        `git log --pretty=format:"%h|%s|%an|%ar" -n ${limit}`,
        { cwd: workspacePath }
      );
      
      return stdout.split('\n').filter(Boolean).map(line => {
        const [hash, message, author, date] = line.split('|');
        return { 
          hash: hash || '', 
          message: message || '', 
          author: author || '', 
          date: date || '' 
        };
      });
    } catch (error) {
      return [];
    }
  }
  
  /**
   * Get list of branches
   */
  async getBranches(workspacePath: string): Promise<BranchInfo[]> {
    try {
      const { stdout: currentBranch } = await execAsync('git branch --show-current', { cwd: workspacePath });
      const { stdout: branches } = await execAsync('git branch -v', { cwd: workspacePath });
      
      return branches.split('\n').filter(Boolean).map(line => {
        const isCurrent = line.startsWith('*');
        const parts = line.replace('*', '').trim().split(/\s+/);
        return {
          name: parts[0] || '',
          isDefault: parts[0] === 'main' || parts[0] === 'master',
          lastCommit: parts[1] || '',
          ahead: 0,
          behind: 0
        };
      });
    } catch (error) {
      return [];
    }
  }
  
  /**
   * Stash current changes
   */
  async stash(workspacePath: string, message?: string): Promise<boolean> {
    try {
      const cmd = message 
        ? `git stash push -m "${message}"`
        : 'git stash';
      
      await execAsync(cmd, { cwd: workspacePath });
      emitLog(`[Git] 📦 Changes stashed`);
      return true;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Pop stashed changes
   */
  async stashPop(workspacePath: string): Promise<boolean> {
    try {
      await execAsync('git stash pop', { cwd: workspacePath });
      emitLog(`[Git] 📦 Stash applied`);
      return true;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Sanitize branch name
   */
  private sanitizeBranchName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/--+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50);
  }
}

export const gitIntegration = new GitIntegrationService();
