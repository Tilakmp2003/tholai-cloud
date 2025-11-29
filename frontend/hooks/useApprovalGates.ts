'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useWebSocket } from './useWebSocket';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export interface ApprovalGate {
  id: string;
  projectId: string;
  taskId?: string;
  gateType: string;
  status: string;
  title: string;
  description: string;
  payload: any;
  createdAt: string;
}

export function useApprovalGates(projectId?: string) {
  const queryClient = useQueryClient();
  const { socket, isConnected } = useWebSocket();
  const [pendingGates, setPendingGates] = useState<ApprovalGate[]>([]);

  // Fetch pending gates
  const { data, isLoading, refetch } = useQuery<ApprovalGate[]>({
    queryKey: ['approval-gates', projectId],
    queryFn: async () => {
      const url = projectId 
        ? `${API_URL}/api/approvals?projectId=${projectId}`
        : `${API_URL}/api/approvals`;
      const res = await axios.get(url);
      return res.data;
    },
    refetchInterval: 10000
  });

  // Update local state when data changes
  useEffect(() => {
    if (data) {
      setPendingGates(data);
    }
  }, [data]);

  // Listen for WebSocket events
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handlePending = (gate: ApprovalGate) => {
      // Only add if matches project filter
      if (!projectId || gate.projectId === projectId) {
        setPendingGates(prev => {
          // Avoid duplicates
          if (prev.some(g => g.id === gate.id)) return prev;
          return [gate, ...prev];
        });
      }
    };

    const handleResolved = (gate: ApprovalGate) => {
      setPendingGates(prev => prev.filter(g => g.id !== gate.id));
      queryClient.invalidateQueries({ queryKey: ['approval-gates'] });
    };

    socket.on('approval:pending', handlePending);
    socket.on('approval:resolved', handleResolved);

    return () => {
      socket.off('approval:pending', handlePending);
      socket.off('approval:resolved', handleResolved);
    };
  }, [socket, isConnected, projectId, queryClient]);

  const approveGate = useCallback(async (gateId: string, notes?: string) => {
    await axios.post(`${API_URL}/api/approvals/${gateId}/approve`, {
      reviewerId: 'human-reviewer',
      notes
    });
    refetch();
  }, [refetch]);

  const rejectGate = useCallback(async (gateId: string, reason: string) => {
    await axios.post(`${API_URL}/api/approvals/${gateId}/reject`, {
      reviewerId: 'human-reviewer',
      reason
    });
    refetch();
  }, [refetch]);

  return {
    pendingGates,
    isLoading,
    approveGate,
    rejectGate,
    refetch,
    hasPending: pendingGates.length > 0
  };
}
