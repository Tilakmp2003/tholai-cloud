/**
 * AWS Deployment Service
 * 
 * Handles deployment of client projects to AWS:
 * - AWS Amplify for frontend (Next.js, React) hosting
 * - AWS App Runner for backend services
 * 
 * This service requires AWS credentials configured in environment:
 * - AWS_ACCESS_KEY_ID
 * - AWS_SECRET_ACCESS_KEY
 * - AWS_REGION
 */

import {
  AmplifyClient,
  CreateAppCommand,
  CreateBranchCommand,
  StartDeploymentCommand,
  GetAppCommand,
  CreateDeploymentCommand,
  StartJobCommand,
} from "@aws-sdk/client-amplify";
import {
  AppRunnerClient,
  CreateServiceCommand,
  DescribeServiceCommand,
} from "@aws-sdk/client-apprunner";
import { prisma } from "../lib/prisma";
import { emitLog } from "../websocket/socketServer";

export interface DeploymentResult {
  success: boolean;
  deploymentId: string;
  url?: string;
  error?: string;
}

export class AWSDeploymentService {
  private amplifyClient: AmplifyClient;
  private appRunnerClient: AppRunnerClient;
  private isConfigured: boolean = false;

  constructor() {
    const region = process.env.AWS_REGION || "us-east-1";
    
    // Check if AWS credentials are configured
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      this.amplifyClient = new AmplifyClient({ region });
      this.appRunnerClient = new AppRunnerClient({ region });
      this.isConfigured = true;
      console.log("[AWSDeployment] AWS clients initialized");
    } else {
      console.warn("[AWSDeployment] AWS credentials not configured - deployment features disabled");
      this.amplifyClient = null as any;
      this.appRunnerClient = null as any;
    }
  }

  /**
   * Check if AWS deployment is available
   */
  isAvailable(): boolean {
    return this.isConfigured;
  }

  /**
   * Deploy frontend to AWS Amplify
   */
  async deployFrontend(
    projectId: string,
    options?: {
      branch?: string;
      buildSpec?: string;
    }
  ): Promise<DeploymentResult> {
    if (!this.isConfigured) {
      return {
        success: false,
        deploymentId: "",
        error: "AWS credentials not configured",
      };
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    console.log(`[AWSDeployment] Deploying frontend for ${project.name}...`);
    emitLog(`[Deployment] 🚀 Starting Amplify deployment for ${project.name}...`);

    try {
      // Create deployment record
      const deployment = await prisma.deployment.create({
        data: {
          projectId,
          type: "PRODUCTION",
          target: "AMPLIFY",
          status: "BUILDING",
        },
      });

      // Create Amplify app if doesn't exist
      let amplifyAppId = deployment.amplifyAppId;

      if (!amplifyAppId) {
        const appName = `tholai-${project.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
        
        try {
          const createAppResult = await this.amplifyClient.send(
            new CreateAppCommand({
              name: appName,
              platform: "WEB",
              buildSpec: options?.buildSpec || this.getDefaultBuildSpec(),
              customRules: [
                {
                  source: "/<*>",
                  target: "/index.html",
                  status: "404-200",
                },
              ],
            })
          );

          amplifyAppId = createAppResult.app?.appId;

          // Create branch
          if (amplifyAppId) {
            await this.amplifyClient.send(
              new CreateBranchCommand({
                appId: amplifyAppId,
                branchName: options?.branch || "main",
                enableAutoBuild: true,
              })
            );
          }
        } catch (error: any) {
          if (error.name !== "ResourceAlreadyExistsException") {
            throw error;
          }
          // App already exists, get its ID
          console.log(`[AWSDeployment] App already exists, using existing app`);
        }
      }

      if (!amplifyAppId) {
        throw new Error("Failed to create or find Amplify app");
      }

      // Update deployment with Amplify app ID
      await prisma.deployment.update({
        where: { id: deployment.id },
        data: {
          amplifyAppId,
          status: "DEPLOYING",
        },
      });

      // Start a deployment job
      const startJobResult = await this.amplifyClient.send(
        new StartJobCommand({
          appId: amplifyAppId,
          branchName: options?.branch || "main",
          jobType: "RELEASE",
        })
      );

      // Construct the URL
      const appUrl = `https://${options?.branch || "main"}.${amplifyAppId}.amplifyapp.com`;

      // Update deployment record
      await prisma.deployment.update({
        where: { id: deployment.id },
        data: {
          status: "DEPLOYED",
          url: appUrl,
          deployedAt: new Date(),
        },
      });

      emitLog(`[Deployment] ✅ Amplify deployment complete: ${appUrl}`);

      return {
        success: true,
        deploymentId: deployment.id,
        url: appUrl,
      };
    } catch (error: any) {
      console.error("[AWSDeployment] Amplify deployment failed:", error);
      emitLog(`[Deployment] ❌ Amplify deployment failed: ${error.message}`);

      return {
        success: false,
        deploymentId: "",
        error: error.message,
      };
    }
  }

  /**
   * Deploy backend to AWS App Runner
   */
  async deployBackend(
    projectId: string,
    options?: {
      port?: number;
      cpu?: string;
      memory?: string;
    }
  ): Promise<DeploymentResult> {
    if (!this.isConfigured) {
      return {
        success: false,
        deploymentId: "",
        error: "AWS credentials not configured",
      };
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    console.log(`[AWSDeployment] Deploying backend for ${project.name}...`);
    emitLog(`[Deployment] 🚀 Starting App Runner deployment for ${project.name}...`);

    try {
      // Create deployment record
      const deployment = await prisma.deployment.create({
        data: {
          projectId,
          type: "PRODUCTION",
          target: "APP_RUNNER",
          status: "BUILDING",
        },
      });

      const serviceName = `tholai-api-${project.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;

      // Note: App Runner typically needs an ECR image or source code connection
      // This is a simplified version - full implementation would need GitHub connection or ECR push
      
      emitLog(`[Deployment] ⚠️ App Runner deployment requires ECR image or GitHub connection`);
      
      // Update deployment record
      await prisma.deployment.update({
        where: { id: deployment.id },
        data: {
          status: "PENDING",
          errorMessage: "App Runner setup requires additional configuration",
        },
      });

      return {
        success: false,
        deploymentId: deployment.id,
        error: "App Runner deployment requires ECR image or GitHub connection - use manual setup",
      };
    } catch (error: any) {
      console.error("[AWSDeployment] App Runner deployment failed:", error);
      emitLog(`[Deployment] ❌ App Runner deployment failed: ${error.message}`);

      return {
        success: false,
        deploymentId: "",
        error: error.message,
      };
    }
  }

  /**
   * Deploy to preview environment
   */
  async deployPreview(projectId: string): Promise<DeploymentResult> {
    // For preview, we use the existing workspace dev server
    // This is already handled by workspaceManager.startPreview()
    
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    // Create a deployment record for tracking
    const deployment = await prisma.deployment.create({
      data: {
        projectId,
        type: "PREVIEW",
        target: "CUSTOM",
        status: "DEPLOYED",
        url: project.devPort ? `http://localhost:${project.devPort}` : undefined,
        deployedAt: new Date(),
      },
    });

    return {
      success: true,
      deploymentId: deployment.id,
      url: deployment.url || undefined,
    };
  }

  /**
   * Get deployment history for a project
   */
  async getDeployments(projectId: string) {
    return prisma.deployment.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Get a specific deployment
   */
  async getDeployment(deploymentId: string) {
    return prisma.deployment.findUnique({
      where: { id: deploymentId },
    });
  }

  /**
   * Default build spec for Next.js apps
   */
  private getDefaultBuildSpec(): string {
    return `
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - npm ci
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: .next
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*
      - .next/cache/**/*
`;
  }
}

// Singleton instance
export const awsDeploymentService = new AWSDeploymentService();
