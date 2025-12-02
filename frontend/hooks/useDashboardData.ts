/**
 * Enhanced Dashboard Hooks
 * Added navigation helpers and pipeline-specific queries
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { dashboardAPI } from "@/lib/api";
import { useWebSocket } from "@/providers/WebSocketProvider";
import { useEffect, useState } from "react";

export function useDashboardData() {
  const queryClient = useQueryClient();
  const { socket } = useWebSocket();

  const [realtimeLogs, setRealtimeLogs] = useState<string[]>([]);

  useEffect(() => {
    if (!socket) return;

    socket.on("task:update", (updatedTask: any) => {
      queryClient.setQueryData(["tasks"], (oldData: any) => {
        if (!oldData) return oldData;
        return oldData;
      });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    });

    socket.on("task:created", (newTask: any) => {
      console.log("[WebSocket] New task created:", newTask.id);
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    });

    socket.on("agent:update", (updatedAgent: any) => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
    });

    socket.on("log:new", (newLog: string) => {
      setRealtimeLogs((prev) => [newLog, ...prev].slice(0, 50));
      queryClient.invalidateQueries({ queryKey: ["governance"] });
    });

    socket.on("module:update", (updatedModule: any) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    });

    return () => {
      socket.off("task:update");
      socket.off("task:created");
      socket.off("agent:update");
      socket.off("log:new");
      socket.off("module:update");
    };
  }, [socket, queryClient]);

  const agents = useQuery({
    queryKey: ["agents"],
    queryFn: async () => {
      const response = await dashboardAPI.getAgents();
      return response.data.agents;
    },
    // Keep polling as fallback but reduce frequency
    refetchInterval: 10000,
  });

  const tasks = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const response = await dashboardAPI.getTasks();
      return response.data;
    },
    refetchInterval: 5000,
  });

  const governance = useQuery({
    queryKey: ["governance"],
    queryFn: async () => {
      const response = await dashboardAPI.getGovernance();
      return response.data;
    },
    refetchInterval: 5000,
  });

  const metrics = useQuery({
    queryKey: ["metrics"],
    queryFn: async () => {
      const response = await dashboardAPI.getMetrics();
      return response.data;
    },
    refetchInterval: 10000,
  });

  return {
    agents: agents.data || [],
    tasks: tasks.data || { stats: {}, queued: [], assigned: [], completed: [] },
    events: governance.data?.events || [],
    logs: realtimeLogs,
    governanceStats: governance.data?.stats || {},
    metrics: metrics.data || {},
    isLoading:
      agents.isLoading ||
      tasks.isLoading ||
      governance.isLoading ||
      metrics.isLoading,
  };
}

export function useEscalations() {
  return useQuery({
    queryKey: ["escalations"],
    queryFn: async () => {
      const response = await dashboardAPI.getEscalations();
      return response.data;
    },
    refetchInterval: 3000,
  });
}

export function useTaskTrace(taskId: string | null) {
  return useQuery({
    queryKey: ["trace", taskId],
    queryFn: async () => {
      if (!taskId) return null;
      const response = await dashboardAPI.getTrace(taskId);
      return response.data;
    },
    enabled: !!taskId,
    refetchInterval: 5000,
  });
}
