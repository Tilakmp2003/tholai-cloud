import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';

const router = Router();
const prisma = new PrismaClient();

// Mock Data Store (until AuditEntry model is added to schema)
const MOCK_AUDIT_LOGS: any[] = [
  {
    id: 'audit-1',
    proposalId: 'prop-123',
    type: 'PROPOSAL_GENERATED',
    payload: JSON.stringify({ summary: 'Bold new architecture', cost: 500 }),
    hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', // Empty hash for demo
    createdAt: new Date().toISOString()
  },
  {
    id: 'audit-2',
    proposalId: 'prop-123',
    type: 'HUMAN_REVIEW',
    payload: JSON.stringify({ decision: 'APPROVE', reviewer: 'admin' }),
    hash: 'valid-hash-2',
    createdAt: new Date().toISOString()
  }
];

// GET /api/audit/:proposalId
router.get('/:proposalId', async (req, res) => {
  const { proposalId } = req.params;
  
  try {
    // Real implementation:
    /*
    const entries = await prisma.auditEntry.findMany({
      where: { proposalId },
      orderBy: { createdAt: 'desc' }
    });
    */
    
    // Mock implementation:
    const entries = MOCK_AUDIT_LOGS.filter(e => e.proposalId === proposalId || proposalId === 'demo');
    res.json(entries);
  } catch (error: any) {
    console.error('[Audit] Error fetching logs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/audit/entry/:entryId/verify
router.get('/entry/:entryId/verify', async (req, res) => {
  const { entryId } = req.params;
  
  try {
    // Real implementation:
    /*
    const entry = await prisma.auditEntry.findUnique({ where: { id: entryId }});
    if (!entry) return res.status(404).json({ error: 'not found' });
    const computed = createHash('sha256').update(entry.payload).digest('hex');
    res.json({ ok: computed === entry.hash });
    */

    // Mock implementation:
    const entry = MOCK_AUDIT_LOGS.find(e => e.id === entryId);
    if (!entry) return res.status(404).json({ error: 'not found' });
    
    // Simulate verification
    // For demo, we'll say it's valid if it exists
    res.json({ ok: true, verifiedAt: new Date() });
  } catch (error: any) {
    console.error('[Audit] Error verifying log:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
