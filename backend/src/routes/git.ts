/**
 * Git Integration API Routes
 */

import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { gitIntegration } from '../services/gitIntegration';

const router = Router();
const prisma = new PrismaClient();

/**
 * POST /api/git/:projectId/init
 * Initialize git repository for a project
 */
router.post('/:projectId/init', async (req, res) => {
  try {
    const { projectId } = req.params;
    
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { workspacePath: true, name: true }
    });
    
    if (!project?.workspacePath) {
      return res.status(404).json({ error: 'Project workspace not found' });
    }
    
    const success = await gitIntegration.initRepo(project.workspacePath, project.name);
    res.json({ success });
  } catch (error: any) {
    console.error('[Git API] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/git/:projectId/branch
 * Create a new branch
 */
router.post('/:projectId/branch', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { branchName } = req.body;
    
    if (!branchName) {
      return res.status(400).json({ error: 'branchName is required' });
    }
    
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { workspacePath: true }
    });
    
    if (!project?.workspacePath) {
      return res.status(404).json({ error: 'Project workspace not found' });
    }
    
    const success = await gitIntegration.createBranch(project.workspacePath, branchName);
    res.json({ success, branchName });
  } catch (error: any) {
    console.error('[Git API] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/git/:projectId/commit
 * Commit changes
 */
router.post('/:projectId/commit', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { taskId, message, files } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }
    
    const result = await gitIntegration.commitTaskChanges(
      projectId,
      taskId || 'manual',
      message,
      files
    );
    
    res.json(result);
  } catch (error: any) {
    console.error('[Git API] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/git/:projectId/history
 * Get commit history
 */
router.get('/:projectId/history', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { limit } = req.query;
    
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { workspacePath: true }
    });
    
    if (!project?.workspacePath) {
      return res.status(404).json({ error: 'Project workspace not found' });
    }
    
    const history = await gitIntegration.getHistory(
      project.workspacePath,
      parseInt(limit as string) || 20
    );
    
    res.json(history);
  } catch (error: any) {
    console.error('[Git API] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/git/:projectId/branches
 * Get list of branches
 */
router.get('/:projectId/branches', async (req, res) => {
  try {
    const { projectId } = req.params;
    
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { workspacePath: true }
    });
    
    if (!project?.workspacePath) {
      return res.status(404).json({ error: 'Project workspace not found' });
    }
    
    const branches = await gitIntegration.getBranches(project.workspacePath);
    res.json(branches);
  } catch (error: any) {
    console.error('[Git API] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/git/:projectId/diff
 * Get diff for changes
 */
router.get('/:projectId/diff', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { file } = req.query;
    
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { workspacePath: true }
    });
    
    if (!project?.workspacePath) {
      return res.status(404).json({ error: 'Project workspace not found' });
    }
    
    const diff = await gitIntegration.getDiff(
      project.workspacePath,
      file as string
    );
    
    res.json({ diff });
  } catch (error: any) {
    console.error('[Git API] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/git/:projectId/merge
 * Merge a branch
 */
router.post('/:projectId/merge', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { branchName, deleteBranch } = req.body;
    
    if (!branchName) {
      return res.status(400).json({ error: 'branchName is required' });
    }
    
    const success = await gitIntegration.mergeModuleBranch(
      projectId,
      branchName,
      deleteBranch !== false
    );
    
    res.json({ success });
  } catch (error: any) {
    console.error('[Git API] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/git/:projectId/rollback
 * Rollback to a commit
 */
router.post('/:projectId/rollback', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { commitHash } = req.body;
    
    if (!commitHash) {
      return res.status(400).json({ error: 'commitHash is required' });
    }
    
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { workspacePath: true }
    });
    
    if (!project?.workspacePath) {
      return res.status(404).json({ error: 'Project workspace not found' });
    }
    
    const success = await gitIntegration.rollback(project.workspacePath, commitHash);
    res.json({ success });
  } catch (error: any) {
    console.error('[Git API] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
