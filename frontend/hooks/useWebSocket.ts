'use client';

import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export function useWebSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const socketInstance = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
    });

    socketInstance.on('connect', () => {
      console.log('[WebSocket] Connected');
      setIsConnected(true);
    });

    socketInstance.on('disconnect', () => {
      console.log('[WebSocket] Disconnected');
      setIsConnected(false);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  return { socket, isConnected };
}

// Hook for task updates
export function useTaskUpdates(callback: (task: any) => void) {
  const { socket } = useWebSocket();

  useEffect(() => {
    if (!socket) return;

    socket.on('task:update', callback);
    socket.on('task:created', callback);

    return () => {
      socket.off('task:update', callback);
      socket.off('task:created', callback);
    };
  }, [socket, callback]);
}

// Hook for agent updates
export function useAgentUpdates(callback: (agent: any) => void) {
  const { socket } = useWebSocket();

  useEffect(() => {
    if (!socket) return;

    socket.on('agent:update', callback);

    return () => {
      socket.off('agent:update', callback);
    };
  }, [socket, callback]);
}

// Hook for governance events
export function useGovernanceUpdates(callback: (event: any) => void) {
  const { socket } = useWebSocket();

  useEffect(() => {
    if (!socket) return;

    socket.on('governance:event', callback);

    return () => {
      socket.off('governance:event', callback);
    };
  }, [socket, callback]);
}
