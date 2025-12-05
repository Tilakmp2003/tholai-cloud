-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "adrId" TEXT,
ADD COLUMN     "designContext" JSONB,
ADD COLUMN     "history" JSONB,
ADD COLUMN     "lastReviewAt" TIMESTAMP(3),
ADD COLUMN     "lastReviewBy" TEXT,
ADD COLUMN     "outputArtifact" TEXT,
ADD COLUMN     "ownerAgentId" TEXT,
ADD COLUMN     "proposalId" TEXT,
ADD COLUMN     "qaFeedback" TEXT,
ADD COLUMN     "relatedFileName" TEXT,
ADD COLUMN     "reviewDecision" TEXT;

-- CreateTable
CREATE TABLE "ADR" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "authorAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "markdown" TEXT NOT NULL,
    "mermaidDiagram" TEXT,
    "metadata" JSONB,

    CONSTRAINT "ADR_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Proposal" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "authorAgent" TEXT,
    "type" TEXT NOT NULL,
    "adrId" TEXT,
    "costEstimate" DECIMAL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Proposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DesignPackage" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "artifactRef" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DesignPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AllocationLog" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "traceId" TEXT,
    "featureCount" INTEGER NOT NULL,
    "complexityScore" INTEGER NOT NULL,
    "workflowsPerHour" INTEGER NOT NULL,
    "composition" JSONB NOT NULL,
    "estimatedCostUsd" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AllocationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TruthBlock" (
    "id" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "previousHash" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "nonce" INTEGER NOT NULL DEFAULT 0,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TruthBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerifiedStatement" (
    "id" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "taskId" TEXT,
    "contentType" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "proofHash" TEXT NOT NULL,
    "syntaxValid" BOOLEAN NOT NULL DEFAULT false,
    "sandboxValid" BOOLEAN NOT NULL DEFAULT false,
    "entropyValid" BOOLEAN NOT NULL DEFAULT false,
    "entropyScore" DOUBLE PRECISION,
    "complexityRatio" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerifiedStatement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HallucinationCheck" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "taskId" TEXT,
    "inputHash" TEXT NOT NULL,
    "outputHash" TEXT NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "failureReason" TEXT,
    "syntaxCheckMs" INTEGER,
    "sandboxCheckMs" INTEGER,
    "entropyScore" DOUBLE PRECISION,
    "flaggedOutput" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HallucinationCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TruthBlock_index_key" ON "TruthBlock"("index");

-- CreateIndex
CREATE UNIQUE INDEX "TruthBlock_hash_key" ON "TruthBlock"("hash");

-- CreateIndex
CREATE INDEX "TruthBlock_hash_idx" ON "TruthBlock"("hash");

-- CreateIndex
CREATE INDEX "TruthBlock_index_idx" ON "TruthBlock"("index");

-- CreateIndex
CREATE INDEX "VerifiedStatement_agentId_idx" ON "VerifiedStatement"("agentId");

-- CreateIndex
CREATE INDEX "VerifiedStatement_taskId_idx" ON "VerifiedStatement"("taskId");

-- CreateIndex
CREATE INDEX "VerifiedStatement_contentHash_idx" ON "VerifiedStatement"("contentHash");

-- CreateIndex
CREATE INDEX "HallucinationCheck_agentId_passed_idx" ON "HallucinationCheck"("agentId", "passed");

-- CreateIndex
CREATE INDEX "HallucinationCheck_taskId_idx" ON "HallucinationCheck"("taskId");

-- AddForeignKey
ALTER TABLE "Trace" ADD CONSTRAINT "Trace_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerifiedStatement" ADD CONSTRAINT "VerifiedStatement_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "TruthBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;
