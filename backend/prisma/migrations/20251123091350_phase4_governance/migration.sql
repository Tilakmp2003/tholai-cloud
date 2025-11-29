-- CreateEnum
CREATE TYPE "GovernanceAction" AS ENUM ('PROMOTE', 'DEMOTE', 'TERMINATE', 'WARNING', 'FLAG');

-- CreateEnum
CREATE TYPE "AgentRiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- AlterTable
ALTER TABLE "Agent" ADD COLUMN     "riskLevel" "AgentRiskLevel" NOT NULL DEFAULT 'LOW',
ADD COLUMN     "score" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "AgentPerformanceLog" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "taskId" TEXT,
    "success" BOOLEAN NOT NULL,
    "failureReason" TEXT,
    "costUsd" DOUBLE PRECISION,
    "tokensIn" INTEGER,
    "tokensOut" INTEGER,
    "durationMs" INTEGER,
    "revisionCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentPerformanceLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GovernanceEvent" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "taskId" TEXT,
    "action" "GovernanceAction" NOT NULL,
    "reason" TEXT NOT NULL,
    "previousRole" TEXT,
    "newRole" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GovernanceEvent_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "AgentPerformanceLog" ADD CONSTRAINT "AgentPerformanceLog_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentPerformanceLog" ADD CONSTRAINT "AgentPerformanceLog_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GovernanceEvent" ADD CONSTRAINT "GovernanceEvent_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GovernanceEvent" ADD CONSTRAINT "GovernanceEvent_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
