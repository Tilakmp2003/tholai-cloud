import { Router } from 'express';
import { EvolutionHistoryService } from '../services/evolution/EvolutionHistoryService';
import { populationManager } from '../services/evolution/PopulationManager';
import { evolutionCycleService } from '../services/evolution/EvolutionCycleService';
import { prisma } from '../lib/prisma';

const router = Router();
const historyService = new EvolutionHistoryService();

// GET /api/evolution/stats - Simple live stats from agents
router.get('/stats', async (req, res) => {
  try {
    // Get all agents with their stats
    const agents = await prisma.agent.findMany({
      select: {
        id: true,
        role: true,
        status: true,
        score: true,
        successCount: true,
        failCount: true,
        createdAt: true,
      }
    });

    // Calculate stats
    const activeAgents = agents.filter(a => a.status !== 'OFFLINE');
    const avgScore = activeAgents.length > 0 
      ? activeAgents.reduce((sum, a) => sum + (a.score || 0), 0) / activeAgents.length 
      : 0;
    
    // Role distribution
    const roleDistribution: Record<string, number> = {};
    activeAgents.forEach(a => {
      roleDistribution[a.role] = (roleDistribution[a.role] || 0) + 1;
    });

    // Success rate
    const totalTasks = activeAgents.reduce((sum, a) => sum + a.successCount + a.failCount, 0);
    const successfulTasks = activeAgents.reduce((sum, a) => sum + a.successCount, 0);
    const successRate = totalTasks > 0 ? (successfulTasks / totalTasks) * 100 : 0;

    res.json({
      totalGenerations: evolutionCycleService.getGeneration(),
      activePopulation: activeAgents.length,
      avgFitness: avgScore,
      maxFitness: Math.max(...activeAgents.map(a => a.score || 0), 0),
      successRate: successRate.toFixed(1),
      roleDistribution,
      innovationRate: successRate > 80 ? 'High' : successRate > 50 ? 'Stable' : 'Low',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/evolution/:projectId/timeline
router.get('/:projectId/timeline', async (req, res) => {
  try {
    const { projectId } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
    
    const data = await historyService.getTimelineData(projectId, limit);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/evolution/:projectId/family-tree
router.get('/:projectId/family-tree', async (req, res) => {
  try {
    const { projectId } = req.params;
    const rootGen = req.query.rootGen ? parseInt(req.query.rootGen as string) : 0;
    
    const data = await historyService.getFamilyTree(projectId, rootGen);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// =================================================
// Population Management Endpoints
// =================================================

// GET /api/evolution/population/stats
router.get('/population/stats', async (req, res) => {
  try {
    const stats = await populationManager.getPopulationStats();
    res.json({ success: true, data: stats });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/evolution/population/initialize
router.post('/population/initialize', async (req, res) => {
  try {
    const count = await populationManager.initializePopulation();
    res.json({ 
      success: true, 
      message: `Population initialized with ${count} agents`,
      count 
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =================================================
// Evolution Cycle Control Endpoints
// =================================================

// POST /api/evolution/cycle/run
router.post('/cycle/run', async (req, res) => {
  try {
    const { projectId = 'global', dryRun = true } = req.body;
    
    // Set dry-run mode before running cycle
    evolutionCycleService.setDryRunMode(dryRun);
    
    const result = await evolutionCycleService.runCycle(projectId);
    res.json({ 
      success: true, 
      dryRun,
      result 
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/evolution/cycle/generation
router.get('/cycle/generation', async (req, res) => {
  try {
    const generation = evolutionCycleService.getGeneration();
    res.json({ success: true, generation });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/evolution/settings/dry-run
router.post('/settings/dry-run', async (req, res) => {
  try {
    const { enabled = true } = req.body;
    evolutionCycleService.setDryRunMode(enabled);
    res.json({ 
      success: true, 
      message: `Dry-run mode ${enabled ? 'ENABLED' : 'DISABLED'}`,
      dryRunEnabled: enabled
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/evolution/population/scale
router.post('/population/scale', async (req, res) => {
  try {
    const result = await populationManager.scalePopulation();
    res.json({ 
      success: true, 
      ...result,
      message: result.scaled 
        ? `Scaled population: ${result.action}` 
        : `No scaling needed (current: ${result.currentSize}, target: ${result.targetSize})`
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;

