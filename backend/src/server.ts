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

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 4000;

// CORS configuration for dashboard
app.use(cors({
  origin: ['http://localhost:3001', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json());

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

httpServer.listen(PORT, () => {
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
