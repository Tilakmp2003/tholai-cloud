import * as pty from "node-pty";
import * as os from "os";
import * as path from "path";
import * as fs from "fs";
import { prisma } from "../lib/prisma";

interface TerminalSession {
  pty: pty.IPty;
  projectId: string;
  cwd: string;
}

export class TerminalService {
  private sessions = new Map<string, TerminalSession>();

  /**
   * Create a new terminal session
   */
  async createSession(
    sessionId: string,
    projectId: string,
    onData: (data: string) => void
  ): Promise<void> {
    try {
      // Poll for workspace path (up to 30 seconds)
      let project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { workspacePath: true },
      });

      let attempts = 0;
      while (!project?.workspacePath && attempts < 30) {
        console.log(
          `[Terminal] Waiting for workspace path... (${attempts + 1}/30)`
        );
        await new Promise((resolve) => setTimeout(resolve, 1000));
        project = await prisma.project.findUnique({
          where: { id: projectId },
          select: { workspacePath: true },
        });
        attempts++;
      }

      if (!project?.workspacePath) {
        throw new Error(`Project ${projectId} has no workspace path after 30s`);
      }

      const workspacePath = project.workspacePath;

      // Create workspace directory if it doesn't exist
      if (!fs.existsSync(workspacePath)) {
        console.log(
          `[Terminal] Creating workspace directory: ${workspacePath}`
        );
        fs.mkdirSync(workspacePath, { recursive: true });
      }

      // Determine shell based on platform
      const shell =
        os.platform() === "win32"
          ? "powershell.exe"
          : process.env.SHELL || "/bin/bash";

      console.log(`[Terminal] Spawning shell: ${shell} in ${workspacePath}`);

      // Buffer to capture early output
      let outputBuffer: string[] = [];
      let isReady = false;

      // Create PTY
      const terminal = pty.spawn(shell, [], {
        name: "xterm-color",
        cols: 80,
        rows: 30,
        cwd: workspacePath,
        env: {
          ...process.env,
          TERM: "xterm-256color",
          COLORTERM: "truecolor",
        },
      });

      // Listen for data
      terminal.onData((data) => {
        if (isReady) {
          // If ready, send immediately
          onData(data);
        } else {
          // If not ready, buffer the data
          outputBuffer.push(data);
        }
      });

      // Handle exit
      terminal.onExit(({ exitCode, signal }) => {
        console.log(
          `[Terminal] Session ${sessionId} exited with code ${exitCode}`
        );
        this.destroySession(sessionId);
      });

      // Store session
      this.sessions.set(sessionId, {
        pty: terminal,
        projectId,
        cwd: workspacePath,
      });

      console.log(
        `[Terminal] Created session ${sessionId} for project ${projectId}`
      );

      // Wait for shell to initialize
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Mark as ready and flush any buffered output
      isReady = true;
      if (outputBuffer.length > 0) {
        const bufferedData = outputBuffer.join("");
        console.log(
          `[Terminal] Flushing ${outputBuffer.length} buffered chunks (${bufferedData.length} chars)`
        );
        onData(bufferedData);
        outputBuffer = [];
      }

      // Send pwd command to force output and prompt
      console.log(`[Terminal] Sending pwd command to force prompt`);
      terminal.write("pwd\r");

      // Wait for the command output and prompt
      await new Promise((resolve) => setTimeout(resolve, 200));
    } catch (error) {
      console.error(`[Terminal] Failed to create session ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Write data to terminal (user input)
   */
  write(sessionId: string, data: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Terminal session ${sessionId} not found`);
    }

    session.pty.write(data);
  }

  /**
   * Resize terminal
   */
  resize(sessionId: string, cols: number, rows: number): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Terminal session ${sessionId} not found`);
    }

    session.pty.resize(cols, rows);
  }

  /**
   * Destroy terminal session
   */
  destroySession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      try {
        session.pty.kill();
      } catch (err) {
        console.error(`[Terminal] Error killing session ${sessionId}:`, err);
      }
      this.sessions.delete(sessionId);
      console.log(`[Terminal] Destroyed session ${sessionId}`);
    }
  }

  /**
   * Get active session count
   */
  getSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Check if session exists
   */
  hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }
}

export const terminalService = new TerminalService();
