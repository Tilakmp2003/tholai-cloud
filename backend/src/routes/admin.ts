import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// GET /api/admin/kpis
router.get('/kpis', async (req, res) => {
  try {
    const totalProposals = await prisma.proposal.count();
    const approvedProposals = await prisma.proposal.count({ where: { approved: true } });
    const boldProposals = await prisma.proposal.count({ where: { type: 'BOLD' } });
    
    const acceptanceRate = totalProposals > 0 ? (approvedProposals / totalProposals) * 100 : 0;
    const boldRate = totalProposals > 0 ? (boldProposals / totalProposals) * 100 : 0;

    const kpis = {
      tasks: {
        fixSuccessRate: 0.75, // Mock
        avgRetryCount: 1.2, // Mock
        reviewAcceptanceRate: 0.85 // Mock
      },
      architect: {
        proposalAcceptanceRate: totalProposals > 0 ? (approvedProposals / totalProposals) : 0,
        boldProposalRate: totalProposals > 0 ? (boldProposals / totalProposals) : 0,
      },
      performance: {
        totalCostWeek: 1250.50, // Mock
      },
      budget: {
        daily: {
          spent: 35.50,
          limit: 50.00,
          percent: 0.71
        },
        isPaused: false
      },
      memory: {
        totalMemories: 150,
        avgSuccessRate: 0.88
      }
    };

    res.json(kpis);
  } catch (error) {
    console.error('Failed to fetch Admin KPIs:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/admin/safety/allowlist
router.get('/safety/allowlist', (req, res) => {
  res.json({ domains: [], commands: [] });
});

// GET /api/admin/memory/retention
router.get('/memory/retention', (req, res) => {
  res.json({ 
    retentionDays: 30,
    archiveEnabled: true,
    totalArchived: 0
  });
});

// GET /api/admin/trace/stats
router.get('/trace/stats', (req, res) => {
  res.json({
    totalTraces: 0,
    avgLatency: 0,
    errorRate: 0
  });
});

export default router;
