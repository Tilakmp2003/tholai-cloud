/**
 * WebSocket Server
 * Real-time event broadcasting for dashboard updates
 */

import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { terminalService } from '../services/terminalService';

let io: SocketIOServer | null = null;

export function initializeWebSocket(httpServer: HTTPServer) {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        const allowedOrigins = [
          'http://localhost:3000',
          'http://localhost:3001',
          'https://main.d1xncmoa82vznf.amplifyapp.com',
          'https://d506a8lgzmu1v.cloudfront.net'
        ];
    
        // Check exact match or subdomain match
        if (allowedOrigins.indexOf(origin) !== -1 || 
            origin.endsWith('.amplifyapp.com') || 
            origin.endsWith('.cloudfront.net')) {
          callback(null, true);
        } else {
          console.log('[WebSocket] Blocked by CORS:', origin);
          callback(new Error('Not allowed by CORS'));
        }
      },
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  io.on('connection', (socket) => {
    console.log(`[WebSocket] Client connected: ${socket.id}`);

    // Send history
    socket.emit('logs:history', logHistory);

    // Terminal events
    socket.on('terminal:create', async ({ sessionId, projectId }) => {
      console.log(`[WebSocket] Creating terminal session: ${sessionId} for project: ${projectId}`);
      
      try {
        // If session already exists, destroy it first to ensure fresh start
        if (terminalService.hasSession(sessionId)) {
          console.log(`[WebSocket] Session ${sessionId} already exists, destroying it first`);
          terminalService.destroySession(sessionId);
          // Wait a moment for PTY to fully terminate
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        await terminalService.createSession(sessionId, projectId, (data) => {
          // Stream terminal output to client
          socket.emit('terminal:output', { sessionId, data });
        });
        
        socket.emit('terminal:created', { sessionId, projectId });
      } catch (err: any) {
        console.error('[WebSocket] Terminal creation failed:', err);
        socket.emit('terminal:error', { sessionId, error: err.message });
      }
    });

    socket.on('terminal:input', ({ sessionId, data }) => {
      try {
        terminalService.write(sessionId, data);
      } catch (err: any) {
        console.error('[WebSocket] Terminal write failed:', err);
        socket.emit('terminal:error', { sessionId, error: err.message });
      }
    });

    socket.on('terminal:resize', ({ sessionId, cols, rows }) => {
      try {
        terminalService.resize(sessionId, cols, rows);
      } catch (err: any) {
        console.error('[WebSocket] Terminal resize failed:', err);
      }
    });

    socket.on('terminal:destroy', ({ sessionId }) => {
      try {
        terminalService.destroySession(sessionId);
        socket.emit('terminal:destroyed', { sessionId });
      } catch (err: any) {
        console.error('[WebSocket] Terminal destroy failed:', err);
      }
    });

    socket.on('disconnect', () => {
      console.log(`[WebSocket] Client disconnected: ${socket.id}`);
      // Note: In production, track which terminals belong to which socket
      // and clean them up on disconnect
    });
  });

  console.log('[WebSocket] Server initialized');
  return io;
}

export function getIO(): SocketIOServer {
  if (!io) {
    throw new Error('WebSocket not initialized. Call initializeWebSocket first.');
  }
  return io;
}

// Event emitters
export const emitTaskUpdate = (task: any) => {
  if (io) {
    io.emit('task:update', task);
  }
};

export const emitTaskCreated = (task: any) => {
  if (io) {
    io.emit('task:created', task);
  }
};

export const emitAgentUpdate = (agent: any) => {
  if (io) {
    io.emit('agent:update', agent);
  }
};

export const emitGovernanceEvent = (event: any) => {
  if (io) {
    io.emit('governance:event', event);
  }
};

const LOG_HISTORY_SIZE = 50;
const logHistory: string[] = [];

export const emitModuleUpdate = (module: any) => {
  if (io) {
    io.emit('module:update', module);
  }
};

export const emitLog = (log: string) => {
  // Add to history
  logHistory.push(log);
  if (logHistory.length > LOG_HISTORY_SIZE) {
    logHistory.shift();
  }

  if (io) {
    io.emit('log:new', log);
  }
};

export function getLogHistory() {
  return logHistory;
}
