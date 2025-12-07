/**
 * Client Messages API Routes
 * 
 * Chat interface for client-agent communication:
 * - Send messages
 * - Request changes
 * - View conversation history
 */

import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { emitLog } from "../websocket/socketServer";

const router = Router();

/**
 * GET /api/projects/:id/messages
 * Get all messages for a project
 */
router.get("/:id/messages", async (req: Request, res: Response) => {
  try {
    const { id: projectId } = req.params;
    const { limit = "50", offset = "0" } = req.query;

    const messages = await prisma.clientMessage.findMany({
      where: { projectId },
      orderBy: { createdAt: "asc" },
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
    });

    const total = await prisma.clientMessage.count({
      where: { projectId },
    });

    return res.json({
      messages,
      total,
      hasMore: total > parseInt(offset as string) + parseInt(limit as string),
    });
  } catch (error: any) {
    console.error("[Messages API] Error fetching messages:", error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/projects/:id/messages
 * Send a new message (from client or system)
 */
router.post("/:id/messages", async (req: Request, res: Response) => {
  try {
    const { id: projectId } = req.params;
    const { 
      content, 
      senderName, 
      sender = "CLIENT", 
      attachments,
      isChangeRequest = false,
      planVersion,
      phaseNumber,
    } = req.body;

    if (!content) {
      return res.status(400).json({ error: "content is required" });
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    // Create the message
    const message = await prisma.clientMessage.create({
      data: {
        projectId,
        content,
        senderName: senderName || project.clientName,
        sender: sender as any,
        attachments: attachments || undefined,
        isChangeRequest,
        changeStatus: isChangeRequest ? "PENDING" : undefined,
        planVersion,
        phaseNumber,
      },
    });

    // Emit WebSocket event
    emitLog(`[Client Message] ${senderName || project.clientName}: ${content.slice(0, 100)}...`);

    // If it's a change request, we'll need to process it
    if (isChangeRequest) {
      // Create a system acknowledgment
      await prisma.clientMessage.create({
        data: {
          projectId,
          content: `Received your change request. Our team will review and update the plan accordingly.`,
          sender: "SYSTEM",
          senderName: "Tholai System",
          replyToId: message.id,
        },
      });
    }

    return res.status(201).json({
      success: true,
      message,
    });
  } catch (error: any) {
    console.error("[Messages API] Error creating message:", error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/projects/:id/messages/change-requests
 * Get all pending change requests for a project
 */
router.get("/:id/messages/change-requests", async (req: Request, res: Response) => {
  try {
    const { id: projectId } = req.params;

    const changeRequests = await prisma.clientMessage.findMany({
      where: { 
        projectId,
        isChangeRequest: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return res.json({ changeRequests });
  } catch (error: any) {
    console.error("[Messages API] Error fetching change requests:", error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /api/projects/:id/messages/:messageId/resolve
 * Mark a change request as resolved
 */
router.patch("/:id/messages/:messageId/resolve", async (req: Request, res: Response) => {
  try {
    const { messageId } = req.params;
    const { status = "COMPLETED" } = req.body;

    const message = await prisma.clientMessage.update({
      where: { id: messageId },
      data: {
        changeStatus: status as any,
        resolvedAt: new Date(),
      },
    });

    return res.json({
      success: true,
      message,
    });
  } catch (error: any) {
    console.error("[Messages API] Error resolving change request:", error);
    return res.status(500).json({ error: error.message });
  }
});

export default router;
