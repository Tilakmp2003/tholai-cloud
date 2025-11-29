/**
 * Workspace API Routes
 * Endpoints for managing project workspaces and dev servers
 */

import { Router } from 'express';
import { workspaceManager } from '../services/workspaceManager';
import { prisma } from '../server';

const router = Router();

/**
 * POST /api/workspace/:projectId/init
 * Initialize a new workspace for a project
 */
router.post('/:projectId/init', async (req, res) => {
  try {
    const { projectId } = req.params;
    
    const project = await prisma.project.findUnique({
      where: { id: projectId }
    });
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const workspacePath = await workspaceManager.initializeWorkspace(
      projectId,
      project.name
    );
    
    res.json({
      success: true,
      workspacePath,
      message: 'Workspace initialized successfully'
    });
    
  } catch (error: any) {
    console.error('[API] Workspace init error:', error);
    res.status(500).json({ 
      error: 'Failed to initialize workspace',
      details: error.message
    });
  }
});

/**
 * POST /api/workspace/:projectId/start
 * Start the dev server for a project
 */
router.post('/:projectId/start', async (req, res) => {
  try {
    const { projectId } = req.params;
    
    const port = await workspaceManager.startPreview(projectId);
    
    res.json({
      success: true,
      port,
      url: `http://localhost:${port}`,
      message: 'Dev server started'
    });
    
  } catch (error: any) {
    console.error('[API] Preview start error:', error);
    res.status(500).json({ 
      error: 'Failed to start preview',
      details: error.message
    });
  }
});

/**
 * POST /api/workspace/:projectId/stop
 * Stop the dev server for a project
 */
router.post('/:projectId/stop', async (req, res) => {
  try {
    const { projectId } = req.params;
    
    await workspaceManager.stopPreview(projectId);
    
    res.json({
      success: true,
      message: 'Dev server stopped'
    });
    
  } catch (error: any) {
    console.error('[API] Preview stop error:', error);
    res.status(500).json({ 
      error: 'Failed to stop preview',
      details: error.message
    });
  }
});

/**
 * GET /api/workspace/:projectId/status
 * Get preview status for a project
 */
router.get('/:projectId/status', async (req, res) => {
  try {
    const { projectId } = req.params;
    
    const status = await workspaceManager.getPreviewStatus(projectId);
    
    res.json(status);
    
  } catch (error: any) {
    console.error('[API] Preview status error:', error);
    res.status(500).json({ 
      error: 'Failed to get preview status',
      details: error.message
    });
  }
});

/**
 * GET /api/workspace/:projectId/tree
 * Get file tree for a project workspace
 */
router.get('/:projectId/tree', async (req, res) => {
  try {
    const { projectId } = req.params;
    
    const tree = await workspaceManager.getFileTree(projectId);
    
    res.json(tree);
    
  } catch (error: any) {
    console.error('[API] File tree error:', error);
    res.status(500).json({ 
      error: 'Failed to get file tree',
      details: error.message
    });
  }
});

/**
 * GET /api/workspace/:projectId/file?path=<path>
 * Get file content
 */
router.get('/:projectId/file', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { path: filePath } = req.query;
    
    if (!filePath || typeof filePath !== 'string') {
      return res.status(400).json({ error: 'Path query parameter is required' });
    }
    
    const content = await workspaceManager.readFile(projectId, filePath);
    res.json({ content });
  } catch (error: any) {
    console.error(`[Workspace] Failed to read file:`, error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/workspace/:projectId/file
 * Write file content
 */
router.post('/:projectId/file', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { path: filePath, content } = req.body;
    
    if (!filePath || typeof filePath !== 'string') {
      return res.status(400).json({ error: 'Path is required' });
    }
    
    if (typeof content !== 'string') {
      return res.status(400).json({ error: 'Content must be a string' });
    }
    
    await workspaceManager.writeFile(projectId, filePath, content);
    res.json({ success: true });
  } catch (error: any) {
    console.error(`[Workspace] Failed to write file:`, error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/workspace/:projectId/logs
 * Get project logs
 */
router.get('/:projectId/logs', (req, res) => {
  try {
    const { projectId } = req.params;
    const logs = workspaceManager.getProjectLogs(projectId);
    res.json({ logs });
  } catch (error: any) {
    console.error(`[Workspace] Failed to get logs:`, error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
