'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface WebSocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  logs: string[];
}

const WebSocketContext = createContext<WebSocketContextType>({
  socket: null,
  isConnected: false,
  logs: [],
});

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    const socketUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    const socketInstance = io(socketUrl, {
      withCredentials: true,
      transports: ['websocket'], // Force WebSocket to avoid sticky session issues on App Runner
    });

    socketInstance.on('connect', () => {
      console.log('✅ WebSocket Connected');
      setIsConnected(true);
    });

    socketInstance.on('disconnect', () => {
      console.log('❌ WebSocket Disconnected');
      setIsConnected(false);
    });

    socketInstance.on('log:new', (log: string) => {
      setLogs((prev) => [log, ...prev].slice(0, 100)); // Keep last 100 logs
    });

    socketInstance.on('logs:history', (history: string[]) => {
      // History comes oldest first, we want newest first for UI
      setLogs(history.reverse());
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  return (
    <WebSocketContext.Provider value={{ socket, isConnected, logs }}>
      {children}
    </WebSocketContext.Provider>
  );
}

export const useWebSocket = () => useContext(WebSocketContext);
