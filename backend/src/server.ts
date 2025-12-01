import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { PrismaClient } from '@prisma/client';
import { router } from './routes';
import { contextRequestRouter } from './routes/contextRequest';
import dashboardRouter from './routes/dashboard';
import workspaceRouter from './routes/workspace';
import projectsRouter from './routes/projects';
import gitRouter from './routes/git';
import memoryRouter from './routes/memory';
import socraticRouter from './routes/socratic';
import approvalsRouter from './routes/approvals';
import adminRoutes from './routes/admin';
import reviewsRouter from './routes/reviews';
import auditRouter from './routes/audit';
import { initializeWebSocket } from './websocket/socketServer';
import { memoryRetention } from './services/memoryRetention';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { workspaceManager } from './services/workspaceManager';

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 4000;

// Global Error Handling for Startup Crashes
process.on('uncaughtException', (err) => {
  console.error('🔥 UNCAUGHT EXCEPTION:', err);
  // Keep process alive for a moment to flush logs
  setTimeout(() => process.exit(1), 1000);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🔥 UNHANDLED REJECTION:', reason);
});

// COR configuration for dashboard
// COR configuration for dashboard
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:3001',
      'http://localhost:3000',
      'https://main.d1xncmoa82vznf.amplifyapp.com',
      'https://d506a8lgzmu1v.cloudfront.net'
    ];

    // Check exact match or subdomain match
    if (allowedOrigins.indexOf(origin) !== -1 || 
        origin.endsWith('.amplifyapp.com') || 
        origin.endsWith('.cloudfront.net')) {
      callback(null, true);
    } else {
      console.log('Blocked by CORS:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// --- Proxy Middleware for Previews ---
// Must be before body parsers if we were proxying POSTs, but for preview (GET) it's fine here.
// Actually, for better compatibility, let's place it before express.json() if possible, 
// but since we already have express.json() above, we just need to ensure we don't consume body if not needed.
// However, standard Next.js preview is mostly GET.

app.use('/api/preview', createProxyMiddleware({
  target: 'http://localhost:3000', // Default fallback, overridden by router
  changeOrigin: true,
  ws: true, // Support WebSockets for HMR
  router: async (req) => {
    try {
      // Extract projectId from path: /api/preview/PROJECT_ID/...
      // Since we mounted at /api/preview, req.url starts with /PROJECT_ID
      const matches = req.url.match(/^\/([^\/]+)/);
      if (matches && matches[1]) {
        const projectId = matches[1];
        const status = await workspaceManager.getPreviewStatus(projectId);
        if (status.isActuallyRunning && status.devPort) {
          console.log(`[Proxy] Forwarding ${projectId} to port ${status.devPort}`);
          return `http://localhost:${status.devPort}`;
        }
      }
    } catch (err) {
      console.error('[Proxy] Router error:', err);
    }
    return 'http://localhost:4000'; // Fallback to self (will likely 404)
  },
  pathRewrite: (path, req) => {
    // Remove /api/preview/PROJECT_ID from the path
    // Example: /api/preview/123/about -> /about
    return path.replace(/^\/api\/preview\/[^\/]+/, '') || '/';
  },
  onError: (err, req, res) => {
    console.error('[Proxy] Error:', err);
    res.status(502).send('Preview Unavailable');
  }
}));




app.use('/api', router);
app.use('/api/context-request', contextRequestRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/workspace', workspaceRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/git', gitRouter);
app.use('/api/memory', memoryRouter);
app.use('/api/socratic', socraticRouter);
app.use('/api/approvals', approvalsRouter);
app.use('/api/admin', adminRoutes);
app.use('/api/reviews', reviewsRouter);
app.use('/api/audit', auditRouter);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

import { startGovernanceLoop } from './governance/governanceLoop';
import { taskQueue } from './services/taskQueue';
import './agents/runner'; // Start Autonomous Agents Loop

// Create HTTP server and initialize WebSocket
const httpServer = createServer(app);
initializeWebSocket(httpServer);

httpServer.listen(Number(PORT), '0.0.0.0', () => {
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
