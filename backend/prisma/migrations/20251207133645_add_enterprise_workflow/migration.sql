-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SUPERSEDED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PhaseStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'PENDING_APPROVAL', 'APPROVED', 'NEEDS_REVISION');

-- CreateEnum
CREATE TYPE "MessageSender" AS ENUM ('CLIENT', 'SYSTEM', 'AGENT');

-- CreateEnum
CREATE TYPE "ChangeRequestStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DeploymentType" AS ENUM ('PREVIEW', 'STAGING', 'PRODUCTION');

-- CreateEnum
CREATE TYPE "DeploymentTarget" AS ENUM ('AMPLIFY', 'APP_RUNNER', 'VERCEL', 'CLOUDFLARE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "DeploymentStatus" AS ENUM ('PENDING', 'BUILDING', 'DEPLOYING', 'DEPLOYED', 'FAILED', 'STOPPED');

-- CreateTable
CREATE TABLE "ProjectPlan" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "status" "PlanStatus" NOT NULL DEFAULT 'DRAFT',
    "content" JSONB NOT NULL,
    "pdfUrl" TEXT,
    "wordCount" INTEGER NOT NULL DEFAULT 0,
    "pageCount" INTEGER NOT NULL DEFAULT 0,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "parentPlanId" TEXT,
    "revisionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhaseReport" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "planId" TEXT,
    "phaseNumber" INTEGER NOT NULL,
    "phaseName" TEXT NOT NULL,
    "status" "PhaseStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "summary" TEXT,
    "tasksCompleted" INTEGER NOT NULL DEFAULT 0,
    "tasksTotal" INTEGER NOT NULL DEFAULT 0,
    "agentActivity" JSONB,
    "filesCreated" INTEGER NOT NULL DEFAULT 0,
    "filesModified" INTEGER NOT NULL DEFAULT 0,
    "linesAdded" INTEGER NOT NULL DEFAULT 0,
    "linesRemoved" INTEGER NOT NULL DEFAULT 0,
    "previewUrl" TEXT,
    "screenshots" JSONB,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "feedbackNotes" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhaseReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientMessage" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sender" "MessageSender" NOT NULL DEFAULT 'CLIENT',
    "senderName" TEXT,
    "content" TEXT NOT NULL,
    "attachments" JSONB,
    "agentId" TEXT,
    "agentRole" TEXT,
    "replyToId" TEXT,
    "planVersion" TEXT,
    "phaseNumber" INTEGER,
    "isChangeRequest" BOOLEAN NOT NULL DEFAULT false,
    "changeStatus" "ChangeRequestStatus",
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deployment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" "DeploymentType" NOT NULL,
    "target" "DeploymentTarget" NOT NULL,
    "status" "DeploymentStatus" NOT NULL DEFAULT 'PENDING',
    "url" TEXT,
    "customDomain" TEXT,
    "amplifyAppId" TEXT,
    "appRunnerServiceId" TEXT,
    "buildLogs" TEXT,
    "buildDuration" INTEGER,
    "errorMessage" TEXT,
    "deployedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deployment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectPlan_projectId_idx" ON "ProjectPlan"("projectId");

-- CreateIndex
CREATE INDEX "ProjectPlan_projectId_version_idx" ON "ProjectPlan"("projectId", "version");

-- CreateIndex
CREATE INDEX "PhaseReport_projectId_idx" ON "PhaseReport"("projectId");

-- CreateIndex
CREATE INDEX "PhaseReport_projectId_phaseNumber_idx" ON "PhaseReport"("projectId", "phaseNumber");

-- CreateIndex
CREATE INDEX "ClientMessage_projectId_idx" ON "ClientMessage"("projectId");

-- CreateIndex
CREATE INDEX "ClientMessage_projectId_createdAt_idx" ON "ClientMessage"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "Deployment_projectId_idx" ON "Deployment"("projectId");

-- CreateIndex
CREATE INDEX "Deployment_projectId_type_idx" ON "Deployment"("projectId", "type");

-- AddForeignKey
ALTER TABLE "ProjectPlan" ADD CONSTRAINT "ProjectPlan_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhaseReport" ADD CONSTRAINT "PhaseReport_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhaseReport" ADD CONSTRAINT "PhaseReport_planId_fkey" FOREIGN KEY ("planId") REFERENCES "ProjectPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientMessage" ADD CONSTRAINT "ClientMessage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deployment" ADD CONSTRAINT "Deployment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
