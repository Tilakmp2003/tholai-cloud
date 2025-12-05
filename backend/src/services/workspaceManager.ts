/**
 * Workspace Manager
 * Manages filesystem workspaces for AI-generated Next.js projects
 */

import { exec, spawn, ChildProcess } from "child_process";
import path from "path";
import fs from "fs/promises";
import { promisify } from "util";
import net from "net";
import { prisma } from "../lib/prisma";
import { emitLog } from "../websocket/socketServer";

const execAsync = promisify(exec);

const WORKSPACE_ROOT = path.resolve(__dirname, "../../../workspaces");
const BASE_PORT = 4100;

// Track running dev servers
const runningServers = new Map<
  string,
  { port: number; process: ChildProcess }
>();
// Track logs
const projectLogs = new Map<string, string[]>();

// Helper function to check if a port is available
async function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close();
      resolve(true);
    });
    server.listen(port);
  });
}

// Helper function to find an available port starting from basePort
async function findAvailablePort(basePort: number): Promise<number> {
  let port = basePort;
  while (!(await isPortAvailable(port))) {
    port++;
    if (port > basePort + 100) {
      throw new Error("No available ports found");
    }
  }
  return port;
}

export class WorkspaceManager {
  /**
   * Initialize a new Next.js workspace for a project
   */
  async initializeWorkspace(
    projectId: string,
    projectName: string
  ): Promise<string> {
    console.log(
      `\n[Workspace] 🏗️  Initializing workspace for "${projectName}"...`
    );

    // 1. Sanitize project name for filesystem
    const safeName = projectName
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/^-|-$/g, "");

    const projectPath = path.join(WORKSPACE_ROOT, safeName);

    // 2. Check if already exists
    try {
      await fs.access(projectPath);
      console.log(
        `[Workspace] ⚠️  Workspace already exists at: ${projectPath}`
      );

      await prisma.project.update({
        where: { id: projectId },
        data: {
          workspacePath: projectPath,
          previewStatus: "READY",
        },
      });

      return projectPath;
    } catch (error) {
      // Directory doesn't exist, proceed with creation
    }

    // 3. Ensure workspace root exists
    await fs.mkdir(WORKSPACE_ROOT, { recursive: true });

    console.log(`[Workspace] 📦 Scaffolding Next.js app...`);

    // 4. Create Next.js app with optimized template
    // Using --yes to skip prompts, --typescript for TS, --tailwind for styling
    try {
      // Manual scaffolding to avoid npx hangs
      await fs.mkdir(projectPath, { recursive: true });
      await fs.mkdir(path.join(projectPath, "app"), { recursive: true });

      // Write package.json
      await fs.writeFile(
        path.join(projectPath, "package.json"),
        JSON.stringify(
          {
            name: safeName,
            version: "0.1.0",
            private: true,
            scripts: {
              dev: "next dev",
              build: "next build",
              start: "next start",
              lint: "next lint",
            },
            dependencies: {
              react: "^18",
              "react-dom": "^18",
              next: "14.2.3",
              "lucide-react": "^0.378.0",
              clsx: "^2.1.1",
              "tailwind-merge": "^2.3.0",
            },
            devDependencies: {
              typescript: "^5",
              "@types/node": "^20",
              "@types/react": "^18",
              "@types/react-dom": "^18",
              postcss: "^8",
              tailwindcss: "^3.4.1",
              autoprefixer: "^10.4.19",
              eslint: "^8",
              "eslint-config-next": "14.2.3",
            },
          },
          null,
          2
        )
      );

      // Write tsconfig.json
      await fs.writeFile(
        path.join(projectPath, "tsconfig.json"),
        JSON.stringify(
          {
            compilerOptions: {
              lib: ["dom", "dom.iterable", "esnext"],
              allowJs: true,
              skipLibCheck: true,
              strict: true,
              noEmit: true,
              esModuleInterop: true,
              module: "esnext",
              moduleResolution: "bundler",
              resolveJsonModule: true,
              isolatedModules: true,
              jsx: "preserve",
              incremental: true,
              plugins: [{ name: "next" }],
              paths: { "@/*": ["./*"] },
            },
            include: [
              "next-env.d.ts",
              "**/*.ts",
              "**/*.tsx",
              ".next/types/**/*.ts",
            ],
            exclude: ["node_modules"],
          },
          null,
          2
        )
      );

      // Write tailwind.config.ts
      await fs.writeFile(
        path.join(projectPath, "tailwind.config.ts"),
        `
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic": "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
    },
  },
  plugins: [],
};
export default config;
`
      );

      // Write postcss.config.js
      await fs.writeFile(
        path.join(projectPath, "postcss.config.js"),
        `module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
`
      );

      // Write next.config.js (CommonJS format for compatibility)
      await fs.writeFile(
        path.join(projectPath, "next.config.js"),
        `/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

module.exports = nextConfig;
`
      );

      console.log(
        `[Workspace] ✅ Next.js app scaffolded manually at: ${projectPath}`
      );

      // --- FIRST PAINT FIX ---
      // Overwrite page.tsx with a custom "AI Corp" landing page
      const firstPaintContent = `
import React from 'react';

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 flex flex-col items-center justify-center p-8 font-sans">
      <div className="max-w-2xl w-full text-center space-y-8">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-zinc-900 border border-zinc-800 shadow-2xl mb-8">
          <div className="w-10 h-10 rounded-full bg-emerald-500 animate-pulse" />
        </div>
        
        <h1 className="text-5xl font-bold tracking-tight text-white">
          ${projectName} <span className="text-emerald-500">v0.1</span>
        </h1>
        
        <p className="text-xl text-zinc-400 max-w-lg mx-auto leading-relaxed">
          Generated by AI Corp Enterprise OS.
          <br />
          Your application scaffolding is complete.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-12 text-left">
          {[
            { title: 'Next.js 14', desc: 'App Router Configured' },
            { title: 'TypeScript', desc: 'Strict Mode Enabled' },
            { title: 'Tailwind CSS', desc: 'Design System Ready' }
          ].map((item, i) => (
            <div key={i} className="p-6 rounded-xl bg-zinc-900/50 border border-zinc-800 hover:border-emerald-500/30 transition-colors">
              <h3 className="font-semibold text-zinc-200 mb-1">{item.title}</h3>
              <p className="text-sm text-zinc-500">{item.desc}</p>
            </div>
          ))}
        </div>

        <div className="pt-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 text-emerald-400 text-sm font-mono border border-emerald-500/20">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            System Online. Waiting for Agent Code Injection...
          </div>
        </div>
      </div>
    </div>
  );
}
`;
      await fs.writeFile(
        path.join(projectPath, "app/page.tsx"),
        firstPaintContent
      );
      console.log(`[Workspace] 🎨 Applied First Paint custom landing page`);

      // Write layout.tsx (required for Next.js App Router)
      const layoutContent = `import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: '${projectName}',
  description: 'Generated by AI Corp Enterprise OS',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
`;
      await fs.writeFile(
        path.join(projectPath, "app/layout.tsx"),
        layoutContent
      );
      console.log(`[Workspace] 📄 Created layout.tsx`);

      // Write globals.css (required for Tailwind)
      const globalsCss = `@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --foreground-rgb: 255, 255, 255;
  --background-rgb: 9, 9, 11;
}

body {
  color: rgb(var(--foreground-rgb));
  background: rgb(var(--background-rgb));
}
`;
      await fs.writeFile(path.join(projectPath, "app/globals.css"), globalsCss);
      console.log(`[Workspace] 🎨 Created globals.css`);

      // 5. Update database
      await prisma.project.update({
        where: { id: projectId },
        data: {
          workspacePath: projectPath,
          previewStatus: "READY",
        },
      });

      return projectPath;
    } catch (error: any) {
      console.error(
        `[Workspace] ❌ Failed to create workspace:`,
        error.message
      );
      throw new Error(`Failed to initialize workspace: ${error.message}`);
    }
  }

  /**
   * Write a file to the workspace
   */
  async writeFile(
    projectId: string,
    relativePath: string,
    content: string
  ): Promise<void> {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { workspacePath: true, name: true },
    });

    if (!project?.workspacePath) {
      throw new Error(
        `Project ${projectId} has no workspace. Run initializeWorkspace first.`
      );
    }

    const fullPath = path.join(project.workspacePath, relativePath);

    // Ensure parent directory exists
    await fs.mkdir(path.dirname(fullPath), { recursive: true });

    // Write file
    await fs.writeFile(fullPath, content, "utf-8");

    console.log(
      `[Workspace] 💾 Wrote file: ${relativePath} (${content.length} bytes)`
    );
  }

  /**
   * Start the dev server for a project
   */
  async startPreview(projectId: string): Promise<number> {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { workspacePath: true, name: true, devPort: true },
    });

    if (!project?.workspacePath) {
      throw new Error(`Project ${projectId} has no workspace`);
    }

    // Check if already running
    if (runningServers.has(projectId)) {
      const { port } = runningServers.get(projectId)!;
      console.log(`[Workspace] ℹ️  Dev server already running on port ${port}`);
      return port;
    }

    // Assign port - find an available one
    let port = project.devPort || BASE_PORT + runningServers.size;

    // Check if port is available, if not find another
    if (!(await isPortAvailable(port))) {
      console.log(
        `[Workspace] ⚠️  Port ${port} is in use, finding available port...`
      );
      port = await findAvailablePort(BASE_PORT);
      console.log(`[Workspace] 📍 Found available port: ${port}`);
    }

    console.log(`[Workspace] 🚀 Starting dev server on port ${port}...`);

    // Initialize logs
    projectLogs.set(projectId, []);
    const log = (msg: string) => {
      const logs = projectLogs.get(projectId) || [];
      logs.push(msg);
      // Keep last 1000 lines
      if (logs.length > 1000) logs.shift();
      projectLogs.set(projectId, logs);
      emitLog(msg);
    };

    // Update status to RUNNING
    await prisma.project.update({
      where: { id: projectId },
      data: {
        devPort: port,
        previewStatus: "RUNNING",
      },
    });

    // Install dependencies first (if needed)
    try {
      await execAsync("npm install", {
        cwd: project.workspacePath,
        timeout: 60000,
      });
      console.log(`[Workspace] 📦 Dependencies installed`);
      log(`[System] Dependencies installed successfully.`);
    } catch (error) {
      console.log(
        `[Workspace] ⚠️  npm install skipped or failed (may already be installed)`
      );
      log(`[System] npm install skipped (check console for details).`);
    }

    // Spawn dev server as detached process
    const child = spawn("npm", ["run", "dev", "--", "-p", String(port)], {
      cwd: project.workspacePath,
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    // Log output
    child.stdout?.on("data", (data) => {
      const msg = data.toString().trim();
      console.log(`[Next.js:${port}] ${msg}`);
      log(msg);
    });

    child.stderr?.on("data", (data) => {
      const msg = data.toString().trim();
      if (!msg.includes("Compiled") && !msg.includes("Fast Refresh")) {
        console.error(`[Next.js:${port}] ${msg}`);
      }
      log(msg);
    });

    // Handle process exit
    child.on("exit", (code) => {
      console.log(
        `[Workspace] 🛑 Dev server on port ${port} exited with code ${code}`
      );
      log(`[System] Dev server exited with code ${code}`);
      runningServers.delete(projectId);

      // Update DB status
      prisma.project
        .update({
          where: { id: projectId },
          data: { previewStatus: "STOPPED" },
        })
        .catch(console.error);
    });

    // Track process
    runningServers.set(projectId, { port, process: child });

    console.log(
      `[Workspace] ✅ Dev server started on http://localhost:${port}`
    );
    log(`[System] Dev server started on port ${port}`);

    return port;
  }

  /**
   * Stop the dev server for a project
   */
  async stopPreview(projectId: string): Promise<void> {
    const server = runningServers.get(projectId);

    if (!server) {
      console.log(`[Workspace] ℹ️  No running server for project ${projectId}`);
      return;
    }

    console.log(`[Workspace] 🛑 Stopping dev server on port ${server.port}...`);

    // Kill process
    server.process.kill("SIGTERM");
    runningServers.delete(projectId);

    // Update DB
    await prisma.project.update({
      where: { id: projectId },
      data: { previewStatus: "STOPPED" },
    });

    console.log(`[Workspace] ✅ Dev server stopped`);
  }

  /**
   * Get preview status for a project
   */
  async getPreviewStatus(projectId: string) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        workspacePath: true,
        devPort: true,
        previewStatus: true,
      },
    });

    let isRunning = runningServers.has(projectId);

    // If not tracked but has a port, check if something is actually running on that port
    if (!isRunning && project?.devPort) {
      try {
        const response = await fetch(`http://localhost:${project.devPort}`, {
          method: "HEAD",
          signal: AbortSignal.timeout(1000),
        });
        if (response.ok || response.status === 404) {
          // Server is running (404 is fine, it means Next.js is up)
          isRunning = true;
        }
      } catch {
        // Server not running or timeout
        isRunning = false;
      }
    }

    return {
      workspacePath: project?.workspacePath,
      devPort: project?.devPort,
      previewStatus: project?.previewStatus,
      isActuallyRunning: isRunning,
    };
  }

  /**
   * Get logs for a project
   */
  getProjectLogs(projectId: string): string[] {
    return projectLogs.get(projectId) || [];
  }

  /**
   * Get file tree for a project workspace
   */
  async getFileTree(projectId: string): Promise<any[]> {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { workspacePath: true },
    });

    if (!project?.workspacePath) {
      throw new Error(`Project ${projectId} has no workspace`);
    }

    return this.buildFileTree(project.workspacePath, "");
  }

  private async buildFileTree(
    basePath: string,
    relativePath: string
  ): Promise<any[]> {
    const fullPath = path.join(basePath, relativePath);

    try {
      const entries = await fs.readdir(fullPath, { withFileTypes: true });
      const tree: any[] = [];

      for (const entry of entries) {
        // Skip node_modules, .next, .git
        if (
          entry.name === "node_modules" ||
          entry.name === ".next" ||
          entry.name === ".git"
        ) {
          continue;
        }

        const entryPath = path.join(relativePath, entry.name);

        if (entry.isDirectory()) {
          const children = await this.buildFileTree(basePath, entryPath);
          tree.push({
            name: entry.name,
            path: entryPath,
            type: "dir",
            children,
          });
        } else {
          tree.push({
            name: entry.name,
            path: entryPath,
            type: "file",
          });
        }
      }

      // Sort: directories first, then files, both alphabetically
      tree.sort((a, b) => {
        if (a.type === b.type) return a.name.localeCompare(b.name);
        return a.type === "dir" ? -1 : 1;
      });

      return tree;
    } catch (error: any) {
      console.error(
        `[Workspace] Error reading directory ${fullPath}:`,
        error.message
      );
      return [];
    }
  }

  /**
   * Read a file from the workspace
   */
  async readFile(projectId: string, filePath: string): Promise<string> {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { workspacePath: true },
    });

    if (!project?.workspacePath) {
      throw new Error(`Project ${projectId} has no workspace`);
    }

    const fullPath = path.join(project.workspacePath, filePath);

    // Security: ensure path is within workspace
    const resolvedPath = path.resolve(fullPath);
    const resolvedWorkspace = path.resolve(project.workspacePath);

    if (!resolvedPath.startsWith(resolvedWorkspace)) {
      throw new Error("Access denied: path outside workspace");
    }

    try {
      const content = await fs.readFile(fullPath, "utf-8");
      return content;
    } catch (error: any) {
      throw new Error(`Failed to read file: ${error.message}`);
    }
  }
  /**
   * Run a command in the project workspace
   */
  async runCommand(
    projectId: string,
    command: string
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { workspacePath: true },
    });

    if (!project?.workspacePath) {
      throw new Error(`Project ${projectId} has no workspace`);
    }

    console.log(
      `[Workspace] 🏃 Running command: "${command}" in ${project.workspacePath}`
    );

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: project.workspacePath,
        timeout: 60000, // 1 minute timeout
      });

      return { stdout, stderr, exitCode: 0 };
    } catch (error: any) {
      // Command failed (non-zero exit code)
      return {
        stdout: error.stdout || "",
        stderr: error.stderr || error.message,
        exitCode: error.code || 1,
      };
    }
  }
}

// Singleton instance
export const workspaceManager = new WorkspaceManager();
