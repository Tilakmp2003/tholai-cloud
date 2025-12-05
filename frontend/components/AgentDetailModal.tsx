"use client";

import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  DollarSign,
  Zap,
  FileCode,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface AgentDetailModalProps {
  agentId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface AgentDetails {
  agent: {
    id: string;
    role: string;
    status: string;
    score: number;
    riskLevel: string;
    successCount: number;
    failCount: number;
    specialization: string | null;
    createdAt: string;
    lastActiveAt: string | null;
  };
  stats: {
    totalCost: number;
    totalTokensIn: number;
    totalTokensOut: number;
    avgExecutionTimeMs: number;
    successRate: number;
    tasksByStatus: {
      completed: number;
      failed: number;
      inProgress: number;
      inReview: number;
      inQA: number;
    };
  };
  tasks: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    completedAt: string;
    errorMessage: string | null;
    fileName: string | null;
    project: string;
    module: string;
  }>;
  taskMetrics: Array<{
    taskId: string;
    taskTitle: string;
    taskStatus: string;
    executionTimeMs: number;
    tokensIn: number;
    tokensOut: number;
    costUsd: number;
    createdAt: string;
  }>;
}

export function AgentDetailModal({
  agentId,
  open,
  onOpenChange,
}: AgentDetailModalProps) {
  const [details, setDetails] = useState<AgentDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (agentId && open) {
      setLoading(true);
      setError(null);
      axios
        .get(`${API_URL}/api/dashboard/agents/${agentId}`)
        .then((res) => {
          setDetails(res.data);
        })
        .catch((err) => {
          setError(err.response?.data?.error || "Failed to load agent details");
        })
        .finally(() => setLoading(false));
    }
  }, [agentId, open]);

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] bg-zinc-900 border-white/10">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span className="text-xl font-bold">Agent Details</span>
            {details && (
              <Badge
                variant="outline"
                className={cn(
                  "text-xs",
                  details.agent.status === "IDLE"
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                    : details.agent.status === "BUSY"
                    ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                    : "bg-red-500/10 text-red-400 border-red-500/30"
                )}
              >
                {details.agent.status}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-pulse text-zinc-500 font-mono">
              Loading agent data...
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-12 text-red-400">
            {error}
          </div>
        ) : details ? (
          <div className="space-y-6">
            {/* Agent Info Header */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                icon={<Zap className="h-4 w-4" />}
                label="Score"
                value={details.agent.score.toFixed(0)}
                color="indigo"
              />
              <StatCard
                icon={<CheckCircle2 className="h-4 w-4" />}
                label="Success Rate"
                value={`${details.stats.successRate}%`}
                color="emerald"
              />
              <StatCard
                icon={<DollarSign className="h-4 w-4" />}
                label="Total Cost"
                value={`$${details.stats.totalCost.toFixed(4)}`}
                color="amber"
              />
              <StatCard
                icon={<Clock className="h-4 w-4" />}
                label="Avg Time"
                value={`${(details.stats.avgExecutionTimeMs / 1000).toFixed(
                  1
                )}s`}
                color="blue"
              />
            </div>

            {/* Task Stats */}
            <div className="grid grid-cols-5 gap-2 p-4 bg-zinc-800/50 rounded-lg border border-white/5">
              <div className="text-center">
                <div className="text-lg font-bold text-emerald-400">
                  {details.stats.tasksByStatus.completed}
                </div>
                <div className="text-[10px] text-zinc-500 uppercase">
                  Completed
                </div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-red-400">
                  {details.stats.tasksByStatus.failed}
                </div>
                <div className="text-[10px] text-zinc-500 uppercase">
                  Failed
                </div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-blue-400">
                  {details.stats.tasksByStatus.inProgress}
                </div>
                <div className="text-[10px] text-zinc-500 uppercase">
                  In Progress
                </div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-amber-400">
                  {details.stats.tasksByStatus.inReview}
                </div>
                <div className="text-[10px] text-zinc-500 uppercase">
                  In Review
                </div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-purple-400">
                  {details.stats.tasksByStatus.inQA}
                </div>
                <div className="text-[10px] text-zinc-500 uppercase">In QA</div>
              </div>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="tasks" className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-zinc-800/50">
                <TabsTrigger value="tasks">Task History</TabsTrigger>
                <TabsTrigger value="metrics">Cost & Performance</TabsTrigger>
              </TabsList>

              <TabsContent value="tasks">
                <ScrollArea className="h-[300px] rounded-lg border border-white/5">
                  {details.tasks.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-zinc-500">
                      No tasks found for this agent
                    </div>
                  ) : (
                    <div className="space-y-2 p-4">
                      {details.tasks.map((task) => (
                        <TaskRow key={task.id} task={task} />
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>

              <TabsContent value="metrics">
                <ScrollArea className="h-[300px] rounded-lg border border-white/5">
                  {details.taskMetrics.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-zinc-500">
                      No metrics recorded yet
                    </div>
                  ) : (
                    <div className="space-y-2 p-4">
                      {details.taskMetrics.map((metric, i) => (
                        <MetricRow key={i} metric={metric} />
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>

            {/* Token Usage */}
            <div className="flex items-center justify-between p-4 bg-zinc-800/30 rounded-lg border border-white/5 text-sm">
              <div className="text-zinc-400">
                Total Tokens Used:{" "}
                <span className="text-white font-mono">
                  {(
                    details.stats.totalTokensIn + details.stats.totalTokensOut
                  ).toLocaleString()}
                </span>
              </div>
              <div className="text-zinc-500 text-xs">
                In: {details.stats.totalTokensIn.toLocaleString()} / Out:{" "}
                {details.stats.totalTokensOut.toLocaleString()}
              </div>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div
      className={cn(
        "p-4 rounded-lg border border-white/5 bg-zinc-800/30",
        `hover:border-${color}-500/30`
      )}
    >
      <div className={`flex items-center gap-2 text-${color}-400 mb-2`}>
        {icon}
        <span className="text-[10px] uppercase tracking-wider text-zinc-500">
          {label}
        </span>
      </div>
      <div className="text-xl font-bold font-mono text-white">{value}</div>
    </div>
  );
}

function TaskRow({ task }: { task: any }) {
  const statusColors: Record<string, string> = {
    COMPLETED: "text-emerald-400 bg-emerald-500/10",
    FAILED: "text-red-400 bg-red-500/10",
    IN_PROGRESS: "text-blue-400 bg-blue-500/10",
    IN_REVIEW: "text-amber-400 bg-amber-500/10",
    IN_QA: "text-purple-400 bg-purple-500/10",
    NEEDS_REVISION: "text-orange-400 bg-orange-500/10",
  };

  return (
    <div className="flex items-center justify-between p-3 bg-zinc-800/30 rounded-lg border border-white/5 hover:border-white/10 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {task.status === "COMPLETED" ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          ) : task.status === "FAILED" ? (
            <XCircle className="h-4 w-4 text-red-400 shrink-0" />
          ) : (
            <Activity className="h-4 w-4 text-blue-400 shrink-0" />
          )}
          <span className="text-sm font-medium text-white truncate">
            {task.title}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-1 text-xs text-zinc-500">
          <span>{task.project}</span>
          {task.fileName && (
            <>
              <span>•</span>
              <span className="flex items-center gap-1">
                <FileCode className="h-3 w-3" />
                {task.fileName}
              </span>
            </>
          )}
        </div>
        {task.errorMessage && (
          <div className="flex items-center gap-1 mt-1 text-xs text-red-400">
            <AlertTriangle className="h-3 w-3" />
            {task.errorMessage.slice(0, 50)}...
          </div>
        )}
      </div>
      <Badge className={cn("text-[10px]", statusColors[task.status] || "")}>
        {task.status}
      </Badge>
    </div>
  );
}

function MetricRow({ metric }: { metric: any }) {
  return (
    <div className="flex items-center justify-between p-3 bg-zinc-800/30 rounded-lg border border-white/5">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-white truncate">
          {metric.taskTitle}
        </div>
        <div className="text-xs text-zinc-500 mt-1">
          {new Date(metric.createdAt).toLocaleString()}
        </div>
      </div>
      <div className="flex items-center gap-4 text-xs font-mono">
        <div className="text-right">
          <div className="text-zinc-400">
            {(metric.executionTimeMs / 1000).toFixed(1)}s
          </div>
          <div className="text-zinc-600">time</div>
        </div>
        <div className="text-right">
          <div className="text-zinc-400">
            {(metric.tokensIn + metric.tokensOut).toLocaleString()}
          </div>
          <div className="text-zinc-600">tokens</div>
        </div>
        <div className="text-right">
          <div className="text-amber-400">${metric.costUsd.toFixed(4)}</div>
          <div className="text-zinc-600">cost</div>
        </div>
      </div>
    </div>
  );
}
