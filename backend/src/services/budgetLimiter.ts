/**
 * Budget Limiter Service
 * 
 * Enforces cost limits per project and globally.
 * Pauses agents when budgets are exceeded.
 */

import { PrismaClient } from '@prisma/client';
import { emitLog, getIO } from '../websocket/socketServer';
import { approvalGates } from './approvalGates';

const prisma = new PrismaClient();

// Budget configuration
interface BudgetConfig {
  dailyLimit: number;      // USD per day
  projectLimit: number;    // USD per project
  taskLimit: number;       // USD per task
  warningThreshold: number; // Percentage (0-1) to warn
}

const DEFAULT_CONFIG: BudgetConfig = {
  dailyLimit: 50.00,
  projectLimit: 100.00,
  taskLimit: 5.00,
  warningThreshold: 0.8
};

// In-memory tracking (in production, use Redis)
const dailySpend = new Map<string, number>(); // date -> spend
const projectSpend = new Map<string, number>(); // projectId -> spend
const pausedProjects = new Set<string>();

// Budget configs per project
const projectConfigs = new Map<string, Partial<BudgetConfig>>();

/**
 * Get today's date key
 */
function getTodayKey(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Get effective config for a project
 */
function getConfig(projectId?: string): BudgetConfig {
  if (projectId && projectConfigs.has(projectId)) {
    return { ...DEFAULT_CONFIG, ...projectConfigs.get(projectId) };
  }
  return DEFAULT_CONFIG;
}

/**
 * Record cost for a task
 */
export async function recordCost(
  projectId: string,
  taskId: string,
  costUsd: number
): Promise<{ allowed: boolean; reason?: string }> {
  const config = getConfig(projectId);
  const today = getTodayKey();
  
  // Check if project is paused
  if (pausedProjects.has(projectId)) {
    return { allowed: false, reason: 'Project is paused due to budget limits' };
  }
  
  // Update daily spend
  const currentDaily = dailySpend.get(today) || 0;
  const newDaily = currentDaily + costUsd;
  dailySpend.set(today, newDaily);
  
  // Update project spend
  const currentProject = projectSpend.get(projectId) || 0;
  const newProject = currentProject + costUsd;
  projectSpend.set(projectId, newProject);
  
  // Check task limit
  if (costUsd > config.taskLimit) {
    emitLog(`[Budget] ⚠️ Task ${taskId} exceeded task limit: $${costUsd.toFixed(4)} > $${config.taskLimit}`);
    
    // Create approval gate for high-cost task
    await approvalGates.createCostGate(
      projectId,
      costUsd,
      config.taskLimit,
      newProject
    );
  }
  
  // Check daily limit
  if (newDaily > config.dailyLimit) {
    emitLog(`[Budget] 🚨 DAILY LIMIT EXCEEDED: $${newDaily.toFixed(2)} > $${config.dailyLimit}`);
    emitBudgetAlert('DAILY_LIMIT_EXCEEDED', newDaily, config.dailyLimit);
    
    // Pause all projects
    pauseAllProjects('Daily budget limit exceeded');
    return { allowed: false, reason: 'Daily budget limit exceeded' };
  }
  
  // Check project limit
  if (newProject > config.projectLimit) {
    emitLog(`[Budget] 🚨 PROJECT LIMIT EXCEEDED: $${newProject.toFixed(2)} > $${config.projectLimit}`);
    emitBudgetAlert('PROJECT_LIMIT_EXCEEDED', newProject, config.projectLimit, projectId);
    
    // Pause this project
    pauseProject(projectId, 'Project budget limit exceeded');
    return { allowed: false, reason: 'Project budget limit exceeded' };
  }
  
  // Check warning thresholds
  const dailyPercent = newDaily / config.dailyLimit;
  const projectPercent = newProject / config.projectLimit;
  
  if (dailyPercent >= config.warningThreshold && dailyPercent < 1) {
    emitLog(`[Budget] ⚠️ Daily spend at ${(dailyPercent * 100).toFixed(0)}% of limit`);
    emitBudgetAlert('DAILY_WARNING', newDaily, config.dailyLimit);
  }
  
  if (projectPercent >= config.warningThreshold && projectPercent < 1) {
    emitLog(`[Budget] ⚠️ Project spend at ${(projectPercent * 100).toFixed(0)}% of limit`);
    emitBudgetAlert('PROJECT_WARNING', newProject, config.projectLimit, projectId);
  }
  
  return { allowed: true };
}

/**
 * Check if a task can proceed (pre-check)
 */
export function canProceed(projectId: string, estimatedCost: number = 0): boolean {
  if (pausedProjects.has(projectId)) {
    return false;
  }
  
  const config = getConfig(projectId);
  const today = getTodayKey();
  
  const currentDaily = dailySpend.get(today) || 0;
  const currentProject = projectSpend.get(projectId) || 0;
  
  // Check if adding estimated cost would exceed limits
  if (currentDaily + estimatedCost > config.dailyLimit) {
    return false;
  }
  
  if (currentProject + estimatedCost > config.projectLimit) {
    return false;
  }
  
  return true;
}

/**
 * Pause a project
 */
export function pauseProject(projectId: string, reason: string): void {
  pausedProjects.add(projectId);
  emitLog(`[Budget] ⏸️ Project ${projectId} paused: ${reason}`);
  
  try {
    const io = getIO();
    io.emit('budget:project-paused', { projectId, reason });
  } catch (e) {
    // Socket not initialized (e.g. in tests), ignore
  }
}

/**
 * Resume a project
 */
export function resumeProject(projectId: string): void {
  pausedProjects.delete(projectId);
  emitLog(`[Budget] ▶️ Project ${projectId} resumed`);
  
  try {
    const io = getIO();
    io.emit('budget:project-resumed', { projectId });
  } catch (e) {
    // Socket not initialized (e.g. in tests), ignore
  }
}

/**
 * Pause all projects
 */
export function pauseAllProjects(reason: string): void {
  // Get all active projects and pause them
  emitLog(`[Budget] ⏸️ ALL PROJECTS PAUSED: ${reason}`);
  
  try {
    const io = getIO();
    io.emit('budget:all-paused', { reason });
  } catch (e) {
    // Socket not initialized (e.g. in tests), ignore
  }
}

/**
 * Resume all projects
 */
export function resumeAllProjects(): void {
  pausedProjects.clear();
  emitLog(`[Budget] ▶️ All projects resumed`);
  
  try {
    const io = getIO();
    io.emit('budget:all-resumed', {});
  } catch (e) {
    // Socket not initialized (e.g. in tests), ignore
  }
}

/**
 * Set budget config for a project
 */
export function setProjectBudget(
  projectId: string,
  config: Partial<BudgetConfig>
): void {
  projectConfigs.set(projectId, config);
  emitLog(`[Budget] 📊 Updated budget config for project ${projectId}`);
}

/**
 * Get current spend stats
 */
export function getSpendStats(projectId?: string): {
  daily: { spent: number; limit: number; percent: number };
  project?: { spent: number; limit: number; percent: number };
  isPaused: boolean;
} {
  const config = getConfig(projectId);
  const today = getTodayKey();
  const dailySpent = dailySpend.get(today) || 0;
  
  const result: any = {
    daily: {
      spent: dailySpent,
      limit: config.dailyLimit,
      percent: dailySpent / config.dailyLimit
    },
    isPaused: projectId ? pausedProjects.has(projectId) : false
  };
  
  if (projectId) {
    const projectSpent = projectSpend.get(projectId) || 0;
    result.project = {
      spent: projectSpent,
      limit: config.projectLimit,
      percent: projectSpent / config.projectLimit
    };
  }
  
  return result;
}

/**
 * Reset daily spend (call at midnight)
 */
export function resetDailySpend(): void {
  const yesterday = getTodayKey();
  dailySpend.delete(yesterday);
  emitLog(`[Budget] 🔄 Daily spend reset`);
}

/**
 * Emit budget alert via WebSocket
 */
function emitBudgetAlert(
  type: string,
  current: number,
  limit: number,
  projectId?: string
): void {
  try {
    const io = getIO();
    io.emit('budget:alert', {
      type,
      current,
      limit,
      percent: current / limit,
      projectId,
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    // Socket not initialized (e.g. in tests), ignore
  }
}

// Schedule daily reset at midnight
const scheduleReset = () => {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  
  const msUntilMidnight = tomorrow.getTime() - now.getTime();
  
  setTimeout(() => {
    resetDailySpend();
    scheduleReset(); // Schedule next reset
  }, msUntilMidnight);
};

// Start the reset scheduler
scheduleReset();

export const budgetLimiter = {
  recordCost,
  canProceed,
  pauseProject,
  resumeProject,
  pauseAllProjects,
  resumeAllProjects,
  setProjectBudget,
  getSpendStats,
  resetDailySpend
};
