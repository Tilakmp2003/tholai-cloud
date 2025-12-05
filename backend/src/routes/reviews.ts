import { Router } from "express";
import { prisma } from "../lib/prisma";

const router = Router();

// POST /api/reviews/:proposalId/decision
router.post("/:proposalId/decision", async (req, res) => {
  const { proposalId } = req.params;
  const { approved, feedback, reviewerId } = req.body;

  try {
    const proposal = await prisma.proposal.update({
      where: { id: proposalId },
      data: {
        approved,
        // If rejected, we might want to store feedback somewhere linked to the proposal
        // For now, we'll assume the frontend handles the feedback display or we log it
      },
    });

    // If approved, trigger downstream logic (e.g., notify Project Planner)
    if (approved) {
      // TODO: Trigger project planner to proceed with this proposal
      console.log(`Proposal ${proposalId} approved by ${reviewerId}`);
    } else {
      console.log(
        `Proposal ${proposalId} rejected by ${reviewerId}. Feedback: ${feedback}`
      );
    }

    res.json({ success: true, proposal });
  } catch (error) {
    console.error("Failed to process review decision:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
