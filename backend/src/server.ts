import express from "express";
import cors from "cors";
import { createServer } from "http";
import { prisma } from "./lib/prisma";
import { router } from "./routes";
import { contextRequestRouter } from "./routes/contextRequest";
import dashboardRouter from "./routes/dashboard";
import workspaceRouter from "./routes/workspace";
import projectsRouter from "./routes/projects";
import gitRouter from "./routes/git";
import memoryRouter from "./routes/memory";
import socraticRouter from "./routes/socratic";
import approvalsRouter from "./routes/approvals";
import adminRoutes from "./routes/admin";
import reviewsRouter from "./routes/reviews";
import auditRouter from "./routes/audit";
import evolutionRouter from "./routes/evolutionRoutes";
import { initializeWebSocket } from "./websocket/socketServer";
import { memoryRetention } from "./services/memoryRetention";
import { createProxyMiddleware } from "http-proxy-middleware";
import { workspaceManager } from "./services/workspaceManager";

const app = express();
const PORT = process.env.PORT || 4000;

// Global Error Handling for Startup Crashes
process.on("uncaughtException", (err) => {
  console.error("🔥 UNCAUGHT EXCEPTION:", err);
  // Keep process alive for a moment to flush logs
  setTimeout(() => process.exit(1), 1000);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("🔥 UNHANDLED REJECTION:", reason);
});

// COR configuration for dashboard
// COR configuration for dashboard
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      const allowedOrigins = [
        "http://localhost:3001",
        "http://localhost:3000",
        "https://main.d1xncmoa82vznf.amplifyapp.com",
        "https://d506a8lgzmu1v.cloudfront.net",
      ];

      // Check exact match or subdomain match
      if (
        allowedOrigins.indexOf(origin) !== -1 ||
        origin.endsWith(".amplifyapp.com") ||
        origin.endsWith(".cloudfront.net")
      ) {
        callback(null, true);
      } else {
        console.log("Blocked by CORS:", origin);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());

// --- Preview Proxy Route (Manual Implementation) ---
// Using manual proxy for better control over async routing
app.use("/api/preview/:projectId", async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const status = await workspaceManager.getPreviewStatus(projectId);

    if (!status.isActuallyRunning || !status.devPort) {
      console.log(
        `[Preview] Project ${projectId} not running (port: ${status.devPort}, running: ${status.isActuallyRunning})`
      );
      return res.status(503).send(`
        <html>
          <head><title>Preview Not Available</title></head>
          <body style="background:#09090b;color:#fff;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
            <div style="text-align:center;">
              <h1 style="color:#10b981;">Preview Starting...</h1>
              <p style="color:#71717a;">The dev server is initializing. Please wait a moment and refresh.</p>
            </div>
          </body>
        </html>
      `);
    }

    // Rewrite the URL to remove /api/preview/:projectId
    const targetPath = req.url || "/";
    const targetUrl = `http://localhost:${status.devPort}${targetPath}`;

    console.log(`[Preview] Proxying ${projectId} -> ${targetUrl}`);

    // Use http-proxy-middleware for this specific request
    const proxy = createProxyMiddleware({
      target: `http://localhost:${status.devPort}`,
      changeOrigin: true,
      ws: true,
      pathRewrite: { [`^/api/preview/${projectId}`]: "" },
      onError: (err, req, res) => {
        console.error("[Preview] Proxy error:", err);
        if (!res.headersSent) {
          (res as any).status(502).send("Preview Unavailable");
        }
      },
    });

    return proxy(req, res, next);
  } catch (err) {
    console.error("[Preview] Error:", err);
    res.status(500).send("Preview Error");
  }
});

app.use("/api", router);
app.use("/api/context-request", contextRequestRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/workspace", workspaceRouter);
app.use("/api/projects", projectsRouter);
app.use("/api/git", gitRouter);
app.use("/api/memory", memoryRouter);
app.use("/api/socratic", socraticRouter);
app.use("/api/approvals", approvalsRouter);
app.use("/api/admin", adminRoutes);
app.use("/api/reviews", reviewsRouter);
app.use("/api/audit", auditRouter);
app.use("/api/evolution", evolutionRouter);

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

import { startGovernanceLoop } from "./governance/governanceLoop";
import { taskQueue } from "./services/taskQueue";
import "./agents/runner"; // Start Autonomous Agents Loop

// Create HTTP server and initialize WebSocket
const httpServer = createServer(app);
initializeWebSocket(httpServer);

httpServer.listen(Number(PORT), "0.0.0.0", () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📡 WebSocket ready for real-time updates`);

  // Start Background Services
  console.log(`🧠 Starting Governance Loop...`);
  startGovernanceLoop();

  console.log(`📨 Starting Task Queue Processor...`);
  // Simple polling for prototype (in production, use a worker process)
  setInterval(async () => {
    const taskId = await taskQueue.pop();
    if (taskId) {
      // In a real app, we would call the Dispatcher here
      // For now, we just log it to prove the queue works
      console.log(`[Worker] Processing Task ${taskId} from Redis`);
    }
  }, 1000);

  // Start Memory Retention Scheduler
  console.log(`🧹 Starting Memory Retention Scheduler...`);
  memoryRetention.startPurgeScheduler();
});

export { prisma };
