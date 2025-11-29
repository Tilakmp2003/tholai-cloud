-- AlterTable
ALTER TABLE "Agent" ADD COLUMN     "currentTaskId" TEXT;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "errorMessage" TEXT,
ADD COLUMN     "result" JSONB,
ADD COLUMN     "traceId" TEXT;

-- CreateTable
CREATE TABLE "Trace" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Trace_pkey" PRIMARY KEY ("id")
);
