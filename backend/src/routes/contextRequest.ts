import { Router } from "express";
import { prisma } from "../lib/prisma";

export const contextRequestRouter = Router();

/**
 * POST /api/context-request
 * Developer → TeamLead escalation
 */
contextRequestRouter.post("/", async (req, res) => {
  try {
    const { taskId, fromAgentId, toAgentId, issueType, message } = req.body;

    if (!taskId || !fromAgentId || !toAgentId || !issueType || !message) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const request = await prisma.contextRequest.create({
      data: { taskId, fromAgentId, toAgentId, issueType, message },
    });

    res.json({ success: true, request });
  } catch (err) {
    console.error("[POST /context-request] Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/context-request
 * TeamLead sees all active/unresolved escalations
 */
contextRequestRouter.get("/", async (req, res) => {
  try {
    const requests = await prisma.contextRequest.findMany({
      where: { status: "OPEN" },
      include: {
        task: true,
        fromAgent: true,
        toAgent: true,
      },
      orderBy: { createdAt: "asc" },
    });

    res.json(requests);
  } catch (err) {
    console.error("[GET /context-request] Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * PUT /api/context-request/:id/resolve
 * TeamLead → provides resolution text
 */
contextRequestRouter.put("/:id/resolve", async (req, res) => {
  try {
    const { id } = req.params;
    const { resolution } = req.body;

    if (!resolution) {
      return res.status(400).json({ error: "Resolution text required" });
    }

    const request = await prisma.contextRequest.update({
      where: { id },
      data: {
        resolution,
        status: "RESOLVED",
        resolvedAt: new Date(),
      },
    });

    res.json({ success: true, request });
  } catch (err) {
    console.error("[PUT /context-request/:id/resolve] Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});
