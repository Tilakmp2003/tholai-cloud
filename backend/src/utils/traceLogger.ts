import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function logTrace(opts: {
  event: string;
  taskId?: string;
  agentId?: string;
  metadata?: any;
}) {
  const { event, taskId, agentId, metadata } = opts;

  await prisma.trace.create({
    data: {
      taskId: taskId ?? "",
      agentId: agentId ?? "",
      event,
      metadata: metadata ?? {}
    }
  });
}
