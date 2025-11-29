/**
 * Agent Memory API Routes
 */

import { Router } from 'express';
import { agentMemory } from '../services/agentMemory';

const router = Router();

/**
 * GET /api/memory/stats
 * Get memory statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = agentMemory.getMemoryStats();
    res.json(stats);
  } catch (error: any) {
    console.error('[Memory API] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/memory/agent/:agentId
 * Get memories for a specific agent
 */
router.get('/agent/:agentId', async (req, res) => {
  try {
    const { agentId } = req.params;
    const memories = agentMemory.getAgentMemories(agentId);
    res.json(memories);
  } catch (error: any) {
    console.error('[Memory API] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/memory/category/:category
 * Get memories by category
 */
router.get('/category/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const memories = agentMemory.getMemoriesByCategory(category);
    res.json(memories);
  } catch (error: any) {
    console.error('[Memory API] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/memory/search
 * Search for relevant memories
 */
router.post('/search', async (req, res) => {
  try {
    const { context, agentRole, limit } = req.body;
    
    if (!context) {
      return res.status(400).json({ error: 'context is required' });
    }
    
    const memories = await agentMemory.retrieveRelevantMemories(
      context,
      agentRole || 'MidDev',
      limit || 5
    );
    
    res.json(memories);
  } catch (error: any) {
    console.error('[Memory API] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/memory/best-practice
 * Store a best practice
 */
router.post('/best-practice', async (req, res) => {
  try {
    const { category, title, content } = req.body;
    
    if (!category || !title || !content) {
      return res.status(400).json({ error: 'category, title, and content are required' });
    }
    
    const entry = await agentMemory.storeBestPractice(category, title, content);
    res.json(entry);
  } catch (error: any) {
    console.error('[Memory API] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/memory/code-snippet
 * Store a code snippet
 */
router.post('/code-snippet', async (req, res) => {
  try {
    const { category, title, code, description } = req.body;
    
    if (!category || !title || !code) {
      return res.status(400).json({ error: 'category, title, and code are required' });
    }
    
    const entry = await agentMemory.storeCodeSnippet(
      category,
      title,
      code,
      description || ''
    );
    res.json(entry);
  } catch (error: any) {
    console.error('[Memory API] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/memory/feedback
 * Update memory outcome based on usage feedback
 */
router.post('/feedback', async (req, res) => {
  try {
    const { memoryId, wasSuccessful } = req.body;
    
    if (!memoryId || wasSuccessful === undefined) {
      return res.status(400).json({ error: 'memoryId and wasSuccessful are required' });
    }
    
    agentMemory.updateMemoryOutcome(memoryId, wasSuccessful);
    res.json({ success: true });
  } catch (error: any) {
    console.error('[Memory API] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
