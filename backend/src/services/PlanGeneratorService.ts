/**
 * Plan Generator Service
 * 
 * Generates comprehensive 30-page industrial implementation plans for client projects.
 * Integrates with Architect, Designer, and Socratic agents to create professional documentation.
 */

import { prisma } from "../lib/prisma";
import { callLLM } from "../llm/llmClient";
import { getAgentConfig } from "../llm/modelRegistry";
import { emitLog } from "../websocket/socketServer";

// Plan section structure
export interface PlanContent {
  coverPage: {
    projectName: string;
    clientName: string;
    version: string;
    date: string;
    preparedBy: string;
  };
  executiveSummary: {
    vision: string;
    goals: string[];
    successMetrics: string[];
    estimatedTimeline: string;
    estimatedBudget: string;
  };
  requirementsSpecification: {
    functionalRequirements: Array<{
      id: string;
      title: string;
      description: string;
      priority: "HIGH" | "MEDIUM" | "LOW";
      acceptanceCriteria: string[];
    }>;
    nonFunctionalRequirements: Array<{
      category: string;
      requirement: string;
    }>;
    constraints: string[];
    assumptions: string[];
  };
  systemArchitecture: {
    techStack: {
      frontend: string[];
      backend: string[];
      database: string[];
      infrastructure: string[];
    };
    architectureDiagram: string; // Mermaid diagram
    dataFlowDiagram: string; // Mermaid diagram
    securityConsiderations: string[];
  };
  uiuxDesign: {
    designDirection: string;
    colorScheme: {
      primary: string;
      secondary: string;
      accent: string;
      background: string;
      text: string;
    };
    typography: {
      headingFont: string;
      bodyFont: string;
    };
    wireframes: Array<{
      pageName: string;
      description: string;
      components: string[];
    }>;
    userJourney: string[]; // Steps in the main user flow
  };
  moduleBreakdown: Array<{
    moduleName: string;
    description: string;
    features: Array<{
      featureName: string;
      tasks: Array<{
        title: string;
        assignedRole: string;
        estimatedHours: number;
        priority: "P0" | "P1" | "P2" | "P3";
      }>;
    }>;
  }>;
  timeline: {
    phases: Array<{
      phaseNumber: number;
      phaseName: string;
      duration: string;
      milestones: string[];
      deliverables: string[];
    }>;
    ganttChart: string; // Mermaid Gantt diagram
  };
  riskAssessment: Array<{
    risk: string;
    probability: "HIGH" | "MEDIUM" | "LOW";
    impact: "HIGH" | "MEDIUM" | "LOW";
    mitigation: string;
    contingency: string;
  }>;
  resourceAllocation: {
    agentTeam: Array<{
      role: string;
      count: number;
      responsibilities: string[];
    }>;
    estimatedCost: {
      development: number;
      infrastructure: number;
      total: number;
      currency: string;
    };
  };
  testingStrategy: {
    unitTesting: string;
    integrationTesting: string;
    e2eTesting: string;
    uatApproach: string;
    testCoverage: string;
  };
  deploymentPlan: {
    infrastructure: string;
    cicdPipeline: string;
    environmentStrategy: string;
    goLiveChecklist: string[];
    rollbackPlan: string;
  };
}

export class PlanGeneratorService {
  /**
   * Estimate project complexity based on description
   * Returns: SIMPLE (1-2 pages), MODERATE (3-8 pages), COMPLEX (10-20 pages), ENTERPRISE (20+ pages)
   */
  private estimateComplexity(description: string): {
    level: "SIMPLE" | "MODERATE" | "COMPLEX" | "ENTERPRISE";
    score: number;
    targetPages: number;
    sectionsToInclude: string[];
  } {
    const desc = description.toLowerCase();
    let score = 0;

    // Simple indicators (reduce score)
    const simpleKeywords = [
      "todo", "to-do", "simple", "basic", "minimal", "single page",
      "landing page", "portfolio", "personal", "prototype", "mvp"
    ];
    simpleKeywords.forEach(kw => { if (desc.includes(kw)) score -= 10; });

    // Complexity indicators (increase score)
    const moderateKeywords = [
      "dashboard", "authentication", "login", "signup", "crud", "form",
      "api", "database", "user management", "charts", "analytics"
    ];
    moderateKeywords.forEach(kw => { if (desc.includes(kw)) score += 5; });

    const complexKeywords = [
      "multi-tenant", "payment", "stripe", "real-time", "websocket",
      "admin panel", "roles", "permissions", "integrations", "third-party",
      "mobile", "responsive", "notifications", "email", "search"
    ];
    complexKeywords.forEach(kw => { if (desc.includes(kw)) score += 10; });

    const enterpriseKeywords = [
      "enterprise", "saas", "platform", "marketplace", "e-commerce",
      "microservices", "kubernetes", "ci/cd", "compliance", "hipaa",
      "gdpr", "security audit", "load balancing", "high availability"
    ];
    enterpriseKeywords.forEach(kw => { if (desc.includes(kw)) score += 20; });

    // Word count as complexity indicator
    const wordCount = description.split(/\s+/).length;
    if (wordCount < 30) score -= 15;
    else if (wordCount > 100) score += 10;
    else if (wordCount > 200) score += 20;

    // Determine level and target pages
    if (score <= 0) {
      return {
        level: "SIMPLE",
        score,
        targetPages: 1,
        sectionsToInclude: ["coverPage", "executiveSummary", "moduleBreakdown"]
      };
    } else if (score <= 30) {
      return {
        level: "MODERATE",
        score,
        targetPages: 5,
        sectionsToInclude: [
          "coverPage", "executiveSummary", "requirementsSpecification",
          "systemArchitecture", "moduleBreakdown", "timeline"
        ]
      };
    } else if (score <= 60) {
      return {
        level: "COMPLEX",
        score,
        targetPages: 12,
        sectionsToInclude: [
          "coverPage", "executiveSummary", "requirementsSpecification",
          "systemArchitecture", "uiuxDesign", "moduleBreakdown",
          "timeline", "riskAssessment", "testingStrategy"
        ]
      };
    } else {
      return {
        level: "ENTERPRISE",
        score,
        targetPages: 25,
        sectionsToInclude: [
          "coverPage", "executiveSummary", "requirementsSpecification",
          "systemArchitecture", "uiuxDesign", "moduleBreakdown",
          "timeline", "riskAssessment", "resourceAllocation",
          "testingStrategy", "deploymentPlan"
        ]
      };
    }
  }

  /**
   * Generate an implementation plan scaled to project complexity
   */
  async generatePlan(
    projectId: string,
    description: string,
    clientName: string,
    projectName: string,
    domain?: string
  ): Promise<{ planId: string; version: string }> {
    // Estimate complexity first
    const complexity = this.estimateComplexity(description);
    
    console.log(`[PlanGenerator] 📋 Generating ${complexity.level} plan (~${complexity.targetPages} pages) for "${projectName}"...`);
    emitLog(`[System] 📋 Analyzing project complexity... Level: ${complexity.level}`);

    // Get existing plan count to determine version
    const existingPlans = await prisma.projectPlan.count({
      where: { projectId },
    });
    const version = existingPlans === 0 ? "1.0" : `${existingPlans + 1}.0`;

    // Generate plan content using LLM with complexity-aware prompts
    const planContent = await this.generatePlanContent(
      projectId,
      description,
      clientName,
      projectName,
      domain,
      complexity
    );

    // Calculate metrics
    const wordCount = this.estimateWordCount(planContent);
    const pageCount = Math.ceil(wordCount / 500); // ~500 words per page

    // Save to database
    const plan = await prisma.projectPlan.create({
      data: {
        projectId,
        version,
        status: "DRAFT",
        content: planContent as any,
        wordCount,
        pageCount,
      },
    });

    console.log(`[PlanGenerator] ✅ Plan v${version} generated (${pageCount} pages, ${wordCount} words, complexity: ${complexity.level})`);
    emitLog(`[System] ✅ Implementation plan v${version} ready (${pageCount} pages)`);

    return { planId: plan.id, version: plan.version };
  }

  /**
   * Generate the plan content using LLM with complexity-aware prompting
   */
  private async generatePlanContent(
    projectId: string,
    description: string,
    clientName: string,
    projectName: string,
    domain: string | undefined,
    complexity: { level: string; targetPages: number; sectionsToInclude: string[] }
  ): Promise<PlanContent> {
    const config = await getAgentConfig("Architect");

    // Build complexity-specific prompts
    const detailLevel = {
      SIMPLE: "Keep it brief and to the point. 1-2 pages max. Only essential information.",
      MODERATE: "Include moderate detail. 3-8 pages. Cover key aspects without over-engineering.",
      COMPLEX: "Be thorough but not excessive. 10-15 pages. Include diagrams and detailed breakdowns.",
      ENTERPRISE: "Comprehensive enterprise documentation. 20+ pages. Full detail on all sections."
    }[complexity.level] || "Moderate detail";

    const systemPrompt = `You are a Senior Solutions Architect creating an implementation plan.
PROJECT COMPLEXITY: ${complexity.level}
TARGET SIZE: ~${complexity.targetPages} pages
SECTIONS TO INCLUDE: ${complexity.sectionsToInclude.join(", ")}

${detailLevel}

Your output must be valid JSON. Scale the detail appropriately - a simple todo app needs 1 page, not 30.`;

    const sectionsGuidance = complexity.level === "SIMPLE" 
      ? `For this SIMPLE project, keep arrays minimal (1-2 items each). Focus on:
         - Brief summary
         - Module list with basic tasks
         - Skip detailed diagrams`
      : complexity.level === "MODERATE"
      ? `For this MODERATE project:
         - 2-3 functional requirements
         - Basic tech stack overview
         - 2-3 phases in timeline
         - Simple wireframe descriptions`
      : `For this ${complexity.level} project, include comprehensive details across all sections.`;

    const userPrompt = `Create an implementation plan for:

PROJECT: ${projectName}
CLIENT: ${clientName}
DOMAIN: ${domain || "Custom Software"}
COMPLEXITY LEVEL: ${complexity.level}

DESCRIPTION:
${description}

${sectionsGuidance}

Generate JSON with these sections: ${complexity.sectionsToInclude.join(", ")}

For sections not in the list, include minimal placeholder content.
For SIMPLE projects: arrays should have 1-2 items max.
For MODERATE projects: arrays should have 2-4 items.
For COMPLEX/ENTERPRISE: arrays should have 4-6 items.

OUTPUT VALID JSON ONLY.`;

    try {
      const response = await callLLM(config, [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ]);

      // Parse JSON response
      let cleanContent = response.content
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

      // Find the JSON object in the response
      const jsonStart = cleanContent.indexOf("{");
      const jsonEnd = cleanContent.lastIndexOf("}");
      if (jsonStart !== -1 && jsonEnd !== -1) {
        cleanContent = cleanContent.slice(jsonStart, jsonEnd + 1);
      }

      const planContent = JSON.parse(cleanContent) as PlanContent;
      return planContent;
    } catch (error: any) {
      console.error("[PlanGenerator] Error generating plan:", error.message);
      
      // Return a fallback structure scaled to complexity
      return this.createFallbackPlan(projectName, clientName, description, domain, complexity.level);
    }
  }

  /**
   * Create a fallback plan structure when LLM fails, scaled to complexity
   */
  private createFallbackPlan(
    projectName: string,
    clientName: string,
    description: string,
    domain?: string,
    complexityLevel: string = "MODERATE"
  ): PlanContent {
    return {
      coverPage: {
        projectName,
        clientName,
        version: "1.0",
        date: new Date().toISOString().split("T")[0],
        preparedBy: "Tholai AI Systems",
      },
      executiveSummary: {
        vision: `Build a comprehensive ${domain || "software"} solution for ${clientName}.`,
        goals: [
          "Deliver a high-quality, scalable application",
          "Ensure excellent user experience",
          "Meet all functional requirements",
        ],
        successMetrics: [
          "Application deployed to production",
          "All core features implemented",
          "User acceptance testing passed",
        ],
        estimatedTimeline: "4-6 weeks",
        estimatedBudget: "Contact for quote",
      },
      requirementsSpecification: {
        functionalRequirements: [
          {
            id: "FR-001",
            title: "Core Application Feature",
            description: description.slice(0, 200),
            priority: "HIGH",
            acceptanceCriteria: ["Feature is functional", "Feature is tested"],
          },
        ],
        nonFunctionalRequirements: [
          { category: "Performance", requirement: "Page load under 3 seconds" },
          { category: "Security", requirement: "HTTPS encryption" },
          { category: "Accessibility", requirement: "WCAG 2.1 AA compliance" },
        ],
        constraints: ["Must use modern web technologies"],
        assumptions: ["Client will provide timely feedback"],
      },
      systemArchitecture: {
        techStack: {
          frontend: ["Next.js 14", "React", "TypeScript", "Tailwind CSS"],
          backend: ["Node.js", "Express/Next.js API Routes"],
          database: ["PostgreSQL", "Prisma ORM"],
          infrastructure: ["AWS Amplify", "AWS App Runner"],
        },
        architectureDiagram: `graph TD
    A[Client Browser] --> B[Next.js Frontend]
    B --> C[API Routes]
    C --> D[Database]`,
        dataFlowDiagram: `flowchart LR
    User --> Frontend
    Frontend --> API
    API --> Database
    Database --> API
    API --> Frontend`,
        securityConsiderations: [
          "Authentication via secure tokens",
          "Input validation on all forms",
          "HTTPS for all communications",
        ],
      },
      uiuxDesign: {
        designDirection: "Modern, clean, professional interface",
        colorScheme: {
          primary: "#3B82F6",
          secondary: "#10B981",
          accent: "#F59E0B",
          background: "#FFFFFF",
          text: "#1F2937",
        },
        typography: {
          headingFont: "Inter",
          bodyFont: "Inter",
        },
        wireframes: [
          {
            pageName: "Dashboard",
            description: "Main application dashboard",
            components: ["Header", "Sidebar", "Main Content Area", "Footer"],
          },
        ],
        userJourney: [
          "User visits application",
          "User logs in/signs up",
          "User navigates to dashboard",
          "User interacts with main features",
        ],
      },
      moduleBreakdown: [
        {
          moduleName: "Core Application",
          description: "Main application functionality",
          features: [
            {
              featureName: "User Interface",
              tasks: [
                { title: "Setup project structure", assignedRole: "MidDev", estimatedHours: 2, priority: "P0" },
                { title: "Implement main layout", assignedRole: "MidDev", estimatedHours: 4, priority: "P0" },
                { title: "Create core components", assignedRole: "MidDev", estimatedHours: 8, priority: "P0" },
              ],
            },
          ],
        },
      ],
      timeline: {
        phases: [
          {
            phaseNumber: 1,
            phaseName: "Design & Setup",
            duration: "1 week",
            milestones: ["Project structure complete", "Design approved"],
            deliverables: ["UI mockups", "Database schema"],
          },
          {
            phaseNumber: 2,
            phaseName: "Core Development",
            duration: "2 weeks",
            milestones: ["Core features implemented"],
            deliverables: ["Working application"],
          },
          {
            phaseNumber: 3,
            phaseName: "Testing & Polish",
            duration: "1 week",
            milestones: ["All tests passing", "Bug fixes complete"],
            deliverables: ["Production-ready application"],
          },
        ],
        ganttChart: `gantt
    title Project Timeline
    dateFormat  YYYY-MM-DD
    section Phase 1
    Design & Setup :a1, 2024-01-01, 1w
    section Phase 2
    Core Development :a2, after a1, 2w
    section Phase 3
    Testing & Polish :a3, after a2, 1w`,
      },
      riskAssessment: [
        {
          risk: "Scope creep",
          probability: "MEDIUM",
          impact: "HIGH",
          mitigation: "Clear requirements documentation and approval gates",
          contingency: "Dedicated change request process",
        },
        {
          risk: "Technical complexity",
          probability: "LOW",
          impact: "MEDIUM",
          mitigation: "Senior developer oversight",
          contingency: "Escalation to senior agents",
        },
      ],
      resourceAllocation: {
        agentTeam: [
          { role: "Architect", count: 1, responsibilities: ["System design", "Technical decisions"] },
          { role: "SeniorDev", count: 1, responsibilities: ["Complex features", "Code review"] },
          { role: "MidDev", count: 3, responsibilities: ["Feature implementation"] },
          { role: "QA", count: 1, responsibilities: ["Testing", "Quality assurance"] },
        ],
        estimatedCost: {
          development: 0,
          infrastructure: 0,
          total: 0,
          currency: "USD",
        },
      },
      testingStrategy: {
        unitTesting: "Jest for component and utility testing",
        integrationTesting: "API endpoint testing with supertest",
        e2eTesting: "Playwright for end-to-end user flows",
        uatApproach: "Client review of staging environment",
        testCoverage: "Minimum 80% code coverage target",
      },
      deploymentPlan: {
        infrastructure: "AWS Amplify (frontend) + App Runner (backend)",
        cicdPipeline: "GitHub Actions for automated deployment",
        environmentStrategy: "Development → Staging → Production",
        goLiveChecklist: [
          "All tests passing",
          "Client approval received",
          "Database migrations applied",
          "DNS configured",
          "SSL certificates active",
        ],
        rollbackPlan: "Amplify rollback to previous deployment",
      },
    };
  }

  /**
   * Estimate word count from plan content
   */
  private estimateWordCount(content: PlanContent): number {
    const jsonString = JSON.stringify(content);
    // Rough estimate: 1 word per 6 characters
    return Math.floor(jsonString.length / 6);
  }

  /**
   * Submit plan for client approval
   */
  async submitForApproval(planId: string): Promise<void> {
    await prisma.projectPlan.update({
      where: { id: planId },
      data: { status: "PENDING_APPROVAL" },
    });
    console.log(`[PlanGenerator] Plan ${planId} submitted for client approval`);
    emitLog(`[System] 📨 Implementation plan submitted for client approval`);
  }

  /**
   * Approve a plan
   */
  async approvePlan(planId: string, approvedBy: string): Promise<void> {
    await prisma.projectPlan.update({
      where: { id: planId },
      data: { 
        status: "APPROVED",
        approvedAt: new Date(),
        approvedBy,
      },
    });
    console.log(`[PlanGenerator] Plan ${planId} approved by ${approvedBy}`);
    emitLog(`[System] ✅ Implementation plan approved! Starting development...`);
  }

  /**
   * Request plan revision
   */
  async requestRevision(
    planId: string,
    revisionNotes: string
  ): Promise<{ newPlanId: string; newVersion: string }> {
    const existingPlan = await prisma.projectPlan.findUnique({
      where: { id: planId },
      include: { project: true },
    });

    if (!existingPlan) {
      throw new Error(`Plan ${planId} not found`);
    }

    // Mark old plan as superseded
    await prisma.projectPlan.update({
      where: { id: planId },
      data: { status: "SUPERSEDED" },
    });

    // Create new version
    const versionParts = existingPlan.version.split(".");
    const newMinor = parseInt(versionParts[1] || "0") + 1;
    const newVersion = `${versionParts[0]}.${newMinor}`;

    // For now, regenerate the plan with revision notes appended
    // In a full implementation, this would intelligently update specific sections
    const result = await this.generatePlan(
      existingPlan.projectId,
      `${existingPlan.project.description}\n\nREVISION NOTES: ${revisionNotes}`,
      existingPlan.project.clientName,
      existingPlan.project.name,
      existingPlan.project.domain || undefined
    );

    // Update the new plan with parent reference
    await prisma.projectPlan.update({
      where: { id: result.planId },
      data: { 
        parentPlanId: planId,
        revisionNotes,
        version: newVersion,
      },
    });

    console.log(`[PlanGenerator] Created revision v${newVersion} based on ${existingPlan.version}`);
    emitLog(`[System] 📝 Plan revised to v${newVersion}`);

    return { newPlanId: result.planId, newVersion };
  }

  /**
   * Get the current active plan for a project
   */
  async getCurrentPlan(projectId: string) {
    return prisma.projectPlan.findFirst({
      where: { 
        projectId,
        status: { in: ["DRAFT", "PENDING_APPROVAL", "APPROVED"] },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Get all plan versions for a project
   */
  async getPlanVersions(projectId: string) {
    return prisma.projectPlan.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        version: true,
        status: true,
        wordCount: true,
        pageCount: true,
        createdAt: true,
        approvedAt: true,
        approvedBy: true,
      },
    });
  }
}

// Singleton instance
export const planGeneratorService = new PlanGeneratorService();
