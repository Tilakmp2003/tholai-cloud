import { useEffect } from 'react';
import { useWebSocket as useWebSocketContext } from '@/providers/WebSocketProvider';

export function useWebSocket() {
  return useWebSocketContext();
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
