/**
 * API Client for Dashboard
 * Connects to backend at localhost:4000
 */

import axios from "axios";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Dashboard API calls
export const dashboardAPI = {
  // Get all agents with metrics (optionally filter by project)
  getAgents: (projectId?: string) =>
    api.get("/api/dashboard/agents", {
      params: projectId ? { projectId } : {},
    }),

  // Get agent details with task history
  getAgentDetails: (agentId: string) =>
    api.get(`/api/dashboard/agents/${agentId}`),

  // Get tasks grouped by status (optionally filter by project)
  getTasks: (projectId?: string) =>
    api.get("/api/dashboard/tasks", { params: projectId ? { projectId } : {} }),

  // Get all projects
  getProjects: () => api.get("/api/projects"),

  // Get escalations (open & resolved)
  getEscalations: () => api.get("/api/dashboard/escalations"),

  // Get governance events
  getGovernance: () => api.get("/api/dashboard/governance"),

  // Get trace for specific task
  getTrace: (taskId: string) => api.get(`/api/dashboard/trace/${taskId}`),

  // Get system-wide metrics
  getMetrics: () => api.get("/api/dashboard/metrics"),

  // Get team progress (agent work tracking)
  getTeamProgress: (projectId?: string) =>
    api.get("/api/dashboard/team-progress", { params: { projectId } }),

  // Agent management actions
  terminateAgent: (agentId: string, reason?: string) =>
    api.post(`/api/dashboard/agents/${agentId}/terminate`, { reason }),

  promoteAgent: (agentId: string, newRole?: string, reason?: string) =>
    api.post(`/api/dashboard/agents/${agentId}/promote`, { newRole, reason }),

  demoteAgent: (agentId: string, newRole?: string, reason?: string) =>
    api.post(`/api/dashboard/agents/${agentId}/demote`, { newRole, reason }),

  reviveAgent: (agentId: string) =>
    api.post(`/api/dashboard/agents/${agentId}/revive`),
};
