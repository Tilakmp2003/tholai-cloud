/**
 * GitHub Integration Service
 * Auto-commits generated code to GitHub repository
 */

import { Octokit } from "@octokit/rest";
import { prisma } from "../lib/prisma";
import * as fs from "fs";
import * as path from "path";

interface GitHubConfig {
  token: string;
  owner: string;
  repo: string;
}

export class GitHubService {
  private octokit: Octokit;
  private owner: string;
  private repo: string;

  constructor(config: GitHubConfig) {
    this.octokit = new Octokit({ auth: config.token });
    this.owner = config.owner;
    this.repo = config.repo;
  }

  /**
   * Auto-commit generated code for a completed project
   */
  async commitGeneratedCode(projectName: string) {
    console.log(
      `\n🚀 GitHub Integration: Committing code for "${projectName}"\n`
    );

    // 1. Get project modules and tasks
    const tasks = await prisma.task.findMany({
      where: {
        status: "COMPLETED",
        module: {
          project: {
            name: projectName,
          },
        },
      },
      include: {
        module: {
          include: {
            project: true,
          },
        },
        assignedToAgent: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    if (tasks.length === 0) {
      console.log("❌ No completed tasks found for this project.");
      return;
    }

    console.log(`📦 Found ${tasks.length} completed tasks\n`);

    // 2. Group by module
    const moduleMap = new Map<string, any[]>();
    for (const task of tasks) {
      const moduleName = task.module.name;
      if (!moduleMap.has(moduleName)) {
        moduleMap.set(moduleName, []);
      }
      moduleMap.get(moduleName)!.push(task);
    }

    // 3. Create commits for each module
    for (const [moduleName, moduleTasks] of moduleMap.entries()) {
      await this.commitModule(projectName, moduleName, moduleTasks);
    }

    console.log("\n✅ GitHub integration complete!");
  }

  private async commitModule(
    projectName: string,
    moduleName: string,
    tasks: any[]
  ) {
    console.log(`\n📂 Module: ${moduleName} (${tasks.length} tasks)`);

    const branchName = `feature/${this.sanitize(moduleName)}`;

    try {
      // 1. Get default branch
      const { data: repo } = await this.octokit.repos.get({
        owner: this.owner,
        repo: this.repo,
      });
      const defaultBranch = repo.default_branch;

      // 2. Create or update branch
      console.log(`   Creating branch: ${branchName}`);

      const { data: ref } = await this.octokit.git.getRef({
        owner: this.owner,
        repo: this.repo,
        ref: `heads/${defaultBranch}`,
      });

      try {
        await this.octokit.git.createRef({
          owner: this.owner,
          repo: this.repo,
          ref: `refs/heads/${branchName}`,
          sha: ref.object.sha,
        });
      } catch (e: any) {
        if (e.status === 422) {
          console.log(`   Branch already exists, using existing`);
        } else {
          throw e;
        }
      }

      // 3. Commit files for each task
      for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];
        await this.commitTask(branchName, projectName, moduleName, task, i + 1);
      }

      // 4. Create Pull Request
      console.log(`\n   Creating Pull Request...`);
      const pr = await this.octokit.pulls.create({
        owner: this.owner,
        repo: this.repo,
        title: `🤖 [AI Generated] ${moduleName}`,
        head: branchName,
        base: defaultBranch,
        body: this.createPRDescription(projectName, moduleName, tasks),
      });

      console.log(`   ✅ PR Created: ${pr.data.html_url}`);
    } catch (error: any) {
      console.error(`   ❌ Error: ${error.message}`);
    }
  }

  private async commitTask(
    branchName: string,
    projectName: string,
    moduleName: string,
    task: any,
    taskNum: number
  ) {
    const result = task.result;
    if (!result || typeof result !== "object") {
      console.log(`      ⚠️  Task ${taskNum}: No valid result`);
      return;
    }

    let code = this.extractCode(result);
    if (!code) {
      console.log(`      ⚠️  Task ${taskNum}: Could not extract code`);
      return;
    }

    code = this.cleanMarkdown(code);

    // Determine file path
    const fileName = `task_${taskNum}_${task.id.substring(0, 8)}.ts`;
    const filePath = `${this.sanitize(projectName)}/${this.sanitize(
      moduleName
    )}/${fileName}`;

    try {
      // Get current file (if exists)
      let sha: string | undefined;
      try {
        const { data } = await this.octokit.repos.getContent({
          owner: this.owner,
          repo: this.repo,
          path: filePath,
          ref: branchName,
        });
        if ("sha" in data) {
          sha = data.sha;
        }
      } catch (e: any) {
        if (e.status !== 404) throw e;
      }

      // Create/update file
      await this.octokit.repos.createOrUpdateFileContents({
        owner: this.owner,
        repo: this.repo,
        path: filePath,
        message: `🤖 Add ${fileName}\n\nGenerated by: ${
          task.assignedToAgent?.role || "Agent"
        }\nTask ID: ${task.id}`,
        content: Buffer.from(code).toString("base64"),
        branch: branchName,
        ...(sha && { sha }),
      });

      console.log(`      ✅ Task ${taskNum}: Committed ${fileName}`);
    } catch (error: any) {
      console.error(`      ❌ Task ${taskNum}: ${error.message}`);
    }
  }

  private createPRDescription(
    projectName: string,
    moduleName: string,
    tasks: any[]
  ): string {
    return `## 🤖 AI-Generated Code

**Project**: ${projectName}
**Module**: ${moduleName}
**Tasks Completed**: ${tasks.length}

### Generated Files

${tasks
  .map((t, i) => `- \`task_${i + 1}_${t.id.substring(0, 8)}.ts\``)
  .join("\n")}

### Agents Involved

${Array.from(new Set(tasks.map((t) => t.assignedToAgent?.role).filter(Boolean)))
  .map((role) => `- ${role}`)
  .join("\n")}

---

*This code was autonomously generated by AI agents and may require review before merging.*
`;
  }

  private extractCode(result: any): string | null {
    if (typeof result === "string") return result;
    if (result.output)
      return typeof result.output === "string"
        ? result.output
        : JSON.stringify(result.output, null, 2);
    if (result.code)
      return typeof result.code === "string"
        ? result.code
        : JSON.stringify(result.code, null, 2);
    if (result.implementation)
      return typeof result.implementation === "string"
        ? result.implementation
        : JSON.stringify(result.implementation, null, 2);
    return JSON.stringify(result, null, 2);
  }

  private cleanMarkdown(code: string): string {
    code = code.replace(/```[\w]*\n/g, "");
    code = code.replace(/```$/g, "");
    return code.trim();
  }

  private sanitize(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }
}

// CLI usage
if (require.main === module) {
  const projectName = process.argv[2];
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;

  if (!projectName) {
    console.error(
      '❌ Usage: npx tsx src/github/githubService.ts "Project Name"'
    );
    process.exit(1);
  }

  if (!token || !owner || !repo) {
    console.error("❌ Missing environment variables:");
    console.error("   GITHUB_TOKEN - Your GitHub personal access token");
    console.error("   GITHUB_OWNER - Repository owner");
    console.error("   GITHUB_REPO - Repository name");
    process.exit(1);
  }

  const service = new GitHubService({ token, owner, repo });
  service
    .commitGeneratedCode(projectName)
    .then(() => console.log("\n🎉 Done!"))
    .catch((e) => console.error("\n❌ Error:", e))
    .finally(() => prisma.$disconnect());
}
