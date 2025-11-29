/**
 * Socratic Interrogator API Routes
 */

import { Router } from 'express';
import { socraticInterrogator } from '../agents/socraticInterrogatorAgent';

const router = Router();

/**
 * POST /api/socratic/analyze
 * Analyze requirements for ambiguity
 */
router.post('/analyze', async (req, res) => {
  try {
    const { projectId, requirements } = req.body;
    
    if (!projectId || !requirements) {
      return res.status(400).json({ error: 'projectId and requirements are required' });
    }
    
    const result = await socraticInterrogator.interrogateRequirements(
      projectId,
      requirements
    );
    
    res.json(result);
  } catch (error: any) {
    console.error('[Socratic API] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/socratic/answer
 * Submit answers to clarification questions
 */
router.post('/answer', async (req, res) => {
  try {
    const { projectId, requirements, previousAnswers, newAnswers } = req.body;
    
    if (!projectId || !requirements || !newAnswers) {
      return res.status(400).json({ error: 'projectId, requirements, and newAnswers are required' });
    }
    
    const result = await socraticInterrogator.processAnswers(
      projectId,
      requirements,
      previousAnswers || {},
      newAnswers
    );
    
    res.json(result);
  } catch (error: any) {
    console.error('[Socratic API] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/socratic/check
 * Quick check if requirements need interrogation
 */
router.post('/check', async (req, res) => {
  try {
    const { requirements } = req.body;
    
    if (!requirements) {
      return res.status(400).json({ error: 'requirements is required' });
    }
    
    const needsInterrogation = await socraticInterrogator.needsInterrogation(requirements);
    const analysis = await socraticInterrogator.analyzeAmbiguity(requirements);
    
    res.json({
      needsInterrogation,
      ambiguityScore: analysis.score,
      issueCount: analysis.issues.length
    });
  } catch (error: any) {
    console.error('[Socratic API] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
