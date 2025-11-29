/**
 * API Client for Dashboard
 * Connects to backend at localhost:4000
 */

import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Dashboard API calls
export const dashboardAPI = {
  // Get all agents with metrics
  getAgents: () => api.get('/api/dashboard/agents'),
  
  // Get tasks grouped by status
  getTasks: () => api.get('/api/dashboard/tasks'),
  
  // Get escalations (open & resolved)
  getEscalations: () => api.get('/api/dashboard/escalations'),
  
  // Get governance events
  getGovernance: () => api.get('/api/dashboard/governance'),
  
  // Get trace for specific task
  getTrace: (taskId: string) => api.get(`/api/dashboard/trace/${taskId}`),
  
  // Get system-wide metrics
  getMetrics: () => api.get('/api/dashboard/metrics'),
};
