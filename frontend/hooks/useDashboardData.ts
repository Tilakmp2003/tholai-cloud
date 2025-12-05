/**
 * Enhanced Dashboard Hooks
 * Added navigation helpers and pipeline-specific queries
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { dashboardAPI } from "@/lib/api";
import { useWebSocket } from "@/providers/WebSocketProvider";
import { useEffect, useState, useCallback } from "react";

// Global callback for new project events
let onNewProjectCallback: ((project: any) => void) | null = null;

export function setOnNewProjectCallback(cb: ((project: any) => void) | null) {
  onNewProjectCallback = cb;
}

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

    // Listen for new project creation
    socket.on("project:created", (newProject: any) => {
      console.log("[WebSocket] New project created:", newProject.id);
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      // Notify any listeners (like Pipeline page)
      if (onNewProjectCallback) {
        onNewProjectCallback(newProject);
      }
    });

    // Listen for project updates
    socket.on("project:update", (project: any) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    });

    return () => {
      socket.off("task:update");
      socket.off("task:created");
      socket.off("agent:update");
      socket.off("log:new");
      socket.off("module:update");
      socket.off("project:created");
      socket.off("project:update");
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

  const teamProgress = useQuery({
    queryKey: ["teamProgress"],
    queryFn: async () => {
      const response = await dashboardAPI.getTeamProgress();
      return response.data;
    },
    refetchInterval: 5000,
  });

  return {
    agents: agents.data || [],
    tasks: tasks.data || { stats: {}, queued: [], assigned: [], completed: [] },
    events: governance.data?.events || [],
    logs: realtimeLogs,
    governanceStats: governance.data?.stats || {},
    metrics: metrics.data || {},
    teamProgress: teamProgress.data || { summary: {}, agents: [] },
    isLoading:
      agents.isLoading ||
      tasks.isLoading ||
      governance.isLoading ||
      metrics.isLoading,
  };
}

// Hook for project-filtered tasks (for Pipeline page)
export function useProjectTasks(projectId: string | null) {
  const queryClient = useQueryClient();
  const { socket } = useWebSocket();

  useEffect(() => {
    if (!socket) return;

    socket.on("task:update", () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
    });

    socket.on("task:created", () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
    });

    return () => {
      socket.off("task:update");
      socket.off("task:created");
    };
  }, [socket, queryClient, projectId]);

  return useQuery({
    queryKey: ["tasks", projectId],
    queryFn: async () => {
      const response = await dashboardAPI.getTasks(projectId || undefined);
      return response.data;
    },
    refetchInterval: 5000,
  });
}

// Hook for project-filtered agents (for Agents page)
export function useProjectAgents(projectId: string | null) {
  const queryClient = useQueryClient();
  const { socket } = useWebSocket();

  useEffect(() => {
    if (!socket) return;

    socket.on("agent:update", () => {
      queryClient.invalidateQueries({ queryKey: ["agents", projectId] });
    });

    return () => {
      socket.off("agent:update");
    };
  }, [socket, queryClient, projectId]);

  return useQuery({
    queryKey: ["agents", projectId],
    queryFn: async () => {
      const response = await dashboardAPI.getAgents(projectId || undefined);
      return response.data.agents;
    },
    refetchInterval: 5000,
  });
}

// Hook to get all projects
export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const response = await dashboardAPI.getProjects();
      return response.data;
    },
    refetchInterval: 30000,
  });
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
