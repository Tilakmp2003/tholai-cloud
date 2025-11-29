/**
 * Approval Gates API Routes
 */

import { Router } from 'express';
import { approvalGates } from '../services/approvalGates';

const router = Router();

/**
 * GET /api/approvals
 * Get all pending approval gates
 */
router.get('/', async (req, res) => {
  try {
    const { projectId } = req.query;
    const gates = approvalGates.getPendingGates(projectId as string);
    res.json(gates);
  } catch (error: any) {
    console.error('[Approvals API] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/approvals/:gateId
 * Get a specific gate
 */
router.get('/:gateId', async (req, res) => {
  try {
    const { gateId } = req.params;
    const gate = approvalGates.getGate(gateId);
    
    if (!gate) {
      return res.status(404).json({ error: 'Gate not found' });
    }
    
    res.json(gate);
  } catch (error: any) {
    console.error('[Approvals API] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/approvals/:gateId/approve
 * Approve a gate
 */
router.post('/:gateId/approve', async (req, res) => {
  try {
    const { gateId } = req.params;
    const { reviewerId, notes } = req.body;
    
    const gate = await approvalGates.approveGate(
      gateId,
      reviewerId || 'anonymous',
      notes
    );
    
    res.json(gate);
  } catch (error: any) {
    console.error('[Approvals API] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/approvals/:gateId/reject
 * Reject a gate
 */
router.post('/:gateId/reject', async (req, res) => {
  try {
    const { gateId } = req.params;
    const { reviewerId, reason } = req.body;
    
    if (!reason) {
      return res.status(400).json({ error: 'reason is required' });
    }
    
    const gate = await approvalGates.rejectGate(
      gateId,
      reviewerId || 'anonymous',
      reason
    );
    
    res.json(gate);
  } catch (error: any) {
    console.error('[Approvals API] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/approvals/:gateId/modify
 * Modify and approve a gate
 */
router.post('/:gateId/modify', async (req, res) => {
  try {
    const { gateId } = req.params;
    const { reviewerId, modifiedPayload, notes } = req.body;
    
    if (!modifiedPayload) {
      return res.status(400).json({ error: 'modifiedPayload is required' });
    }
    
    const gate = await approvalGates.modifyAndApprove(
      gateId,
      reviewerId || 'anonymous',
      modifiedPayload,
      notes
    );
    
    res.json(gate);
  } catch (error: any) {
    console.error('[Approvals API] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/approvals/configure
 * Configure gates for a project
 */
router.post('/configure', async (req, res) => {
  try {
    const { projectId, enabledGates } = req.body;
    
    if (!projectId || !enabledGates) {
      return res.status(400).json({ error: 'projectId and enabledGates are required' });
    }
    
    approvalGates.configureGates(projectId, enabledGates);
    
    res.json({ success: true, enabledGates });
  } catch (error: any) {
    console.error('[Approvals API] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
