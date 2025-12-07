-- CreateEnum
CREATE TYPE "AgentGenerationStatus" AS ENUM ('ALIVE', 'TERMINATED_LOW_E', 'TERMINATED_RETIREMENT', 'TERMINATED_REPLACED');

-- AlterTable
ALTER TABLE "Agent" ADD COLUMN     "existencePotential" DOUBLE PRECISION NOT NULL DEFAULT 100.0,
ADD COLUMN     "generation" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "genome" JSONB,
ADD COLUMN     "parentId" TEXT;

-- CreateTable
CREATE TABLE "KnowledgeNugget" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sourceAgentId" TEXT NOT NULL,
    "qualityScore" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeNugget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Generation" (
    "id" TEXT NOT NULL,
    "generationNumber" INTEGER NOT NULL,
    "projectId" TEXT NOT NULL,
    "avgFitness" DOUBLE PRECISION NOT NULL,
    "maxFitness" DOUBLE PRECISION NOT NULL,
    "minFitness" DOUBLE PRECISION NOT NULL,
    "fitnessStdDev" DOUBLE PRECISION NOT NULL,
    "populationSize" INTEGER NOT NULL,
    "birthCount" INTEGER NOT NULL,
    "deathCount" INTEGER NOT NULL,
    "survivalRate" DOUBLE PRECISION NOT NULL,
    "mutationRate" DOUBLE PRECISION NOT NULL,
    "crossoverRate" DOUBLE PRECISION NOT NULL,
    "elitePreserved" INTEGER NOT NULL,
    "specializationDistribution" JSONB NOT NULL,
    "keyInnovations" TEXT[],
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "topAgentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Generation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentGeneration" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "generationId" TEXT NOT NULL,
    "fitnessScore" DOUBLE PRECISION NOT NULL,
    "tasksCompleted" INTEGER NOT NULL,
    "tasksSucceeded" INTEGER NOT NULL,
    "tokensUsed" INTEGER NOT NULL,
    "existencePotential" DOUBLE PRECISION NOT NULL,
    "genomeSnapshot" JSONB NOT NULL,
    "parentId" TEXT,
    "status" "AgentGenerationStatus" NOT NULL DEFAULT 'ALIVE',
    "causeOfDeath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentGeneration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Generation_projectId_idx" ON "Generation"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Generation_projectId_generationNumber_key" ON "Generation"("projectId", "generationNumber");

-- CreateIndex
CREATE INDEX "AgentGeneration_generationId_idx" ON "AgentGeneration"("generationId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentGeneration_agentId_generationId_key" ON "AgentGeneration"("agentId", "generationId");

-- AddForeignKey
ALTER TABLE "KnowledgeNugget" ADD CONSTRAINT "KnowledgeNugget_sourceAgentId_fkey" FOREIGN KEY ("sourceAgentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Generation" ADD CONSTRAINT "Generation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Generation" ADD CONSTRAINT "Generation_topAgentId_fkey" FOREIGN KEY ("topAgentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentGeneration" ADD CONSTRAINT "AgentGeneration_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentGeneration" ADD CONSTRAINT "AgentGeneration_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "Generation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentGeneration" ADD CONSTRAINT "AgentGeneration_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "AgentGeneration"("id") ON DELETE SET NULL ON UPDATE CASCADE;
