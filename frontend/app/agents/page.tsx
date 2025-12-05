"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck,
  Users,
  Cpu,
  Wallet,
  Zap,
  Activity,
  Terminal,
  Lock,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Skull,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  MoreVertical,
  ChevronDown,
} from "lucide-react";
import { useProjectAgents, useProjects } from "@/hooks/useDashboardData";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { dashboardAPI } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AgentDetailModal } from "@/components/AgentDetailModal";

// --- Configuration ---

const ROLE_GROUPS = [
  {
    id: "L4",
    label: "EXECUTIVE COMMAND",
    color: "indigo",
    match: ["HEADAGENT", "CEO", "CTO"],
  },
  {
    id: "L3",
    label: "MANAGEMENT LAYER",
    color: "purple",
    match: ["TEAMLEAD", "PM", "ARCHITECT", "PROJECTMANAGER", "TEAM_LEAD"],
  },
  {
    id: "L1",
    label: "EXECUTION UNITS",
    color: "emerald",
    match: [
      "SENIORDEV",
      "MIDDEV",
      "JUNIORDEV",
      "QA",
      "SECURITY",
      "SENIOR_DEV",
      "MID_DEV",
      "JUNIOR_DEV",
    ],
  },
  {
    id: "U0",
    label: "UNCLASSIFIED UNITS",
    color: "zinc",
    match: [], // Fallback group
  },
];

const ROLE_ICONS: Record<string, any> = {
  HEADAGENT: ShieldCheck,
  CEO: ShieldCheck,
  CTO: ShieldCheck,
  TEAMLEAD: Users,
  PM: Users,
  ARCHITECT: Users,
  SENIORDEV: Cpu,
  MIDDEV: Cpu,
  JUNIORDEV: Cpu,
  QA: Activity,
  SECURITY: Lock,
};

// --- Helpers ---

const normalizeRole = (role: string): string => {
  if (!role) return "UNKNOWN";
  return role.toUpperCase().replace(/[^A-Z0-9]/g, "");
};

const getGroupForRole = (normalizedRole: string) => {
  for (const group of ROLE_GROUPS) {
    if (group.match.includes(normalizedRole)) {
      return group;
    }
  }
  return ROLE_GROUPS.find((g) => g.id === "U0")!;
};

// --- Components ---

export default function AgentsPage() {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null
  );
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const { data: projects = [], isLoading: projectsLoading } = useProjects();
  const { data: agents = [], isLoading: agentsLoading } =
    useProjectAgents(selectedProjectId);

  // Auto-select the most recent project
  useEffect(() => {
    if (projects.length > 0 && !selectedProjectId) {
      // Sort by createdAt descending and select the first one
      const sorted = [...projects].sort(
        (a: any, b: any) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setSelectedProjectId(sorted[0].id);
    }
  }, [projects, selectedProjectId]);

  const isLoading = projectsLoading || agentsLoading;

  // Grouping Logic
  const groupedAgents = React.useMemo(() => {
    const groups: Record<string, any[]> = { L4: [], L3: [], L1: [], U0: [] };

    agents.forEach((agent: any) => {
      const normalized = normalizeRole(agent.role);
      const group = getGroupForRole(normalized);
      groups[group.id].push({ ...agent, normalizedRole: normalized });
    });

    return groups;
  }, [agents]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-950 text-zinc-500 font-mono animate-pulse">
        LOADING WORKFORCE DATA...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-50 overflow-hidden selection:bg-indigo-500/30">
      {/* Background Grid */}
      <div className="fixed inset-0 z-0 pointer-events-none bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />

      {/* Header */}
      <header className="flex-none flex items-center justify-between px-8 py-6 border-b border-white/5 bg-zinc-950/50 backdrop-blur-md z-10">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Workforce Directory
          </h1>
          <p className="text-xs text-zinc-500 font-mono mt-1 tracking-wider uppercase">
            ACTIVE PERSONNEL DATABASE •{" "}
            <span className="text-emerald-500">LIVE SYNC</span>
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Project Selector */}
          <Select
            value={selectedProjectId || ""}
            onValueChange={(value) => setSelectedProjectId(value)}
          >
            <SelectTrigger className="w-[220px] bg-zinc-900/50 border-white/10 text-sm">
              <SelectValue placeholder="Select Project" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((project: any) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900/50 border border-white/5">
            <span className="text-[10px] font-mono text-zinc-500 tracking-widest uppercase">
              TOTAL UNITS
            </span>
            <span className="text-xs font-mono font-bold text-white">
              {agents.length}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <ScrollArea className="flex-1 min-h-0 px-8 py-8">
        <div className="max-w-7xl mx-auto space-y-12 pb-20">
          {ROLE_GROUPS.map((group, index) => (
            <AgentGroup
              key={group.id}
              group={group}
              agents={groupedAgents[group.id]}
              delay={index * 0.2}
              onAgentClick={(agentId: string) => setSelectedAgentId(agentId)}
            />
          ))}
        </div>
      </ScrollArea>

      {/* Agent Detail Modal */}
      <AgentDetailModal
        agentId={selectedAgentId}
        open={!!selectedAgentId}
        onOpenChange={(open) => !open && setSelectedAgentId(null)}
      />
    </div>
  );
}

function AgentGroup({
  group,
  agents,
  delay,
  onAgentClick,
}: {
  group: any;
  agents: any[];
  delay: number;
  onAgentClick: (agentId: string) => void;
}) {
  if (agents.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      className="space-y-6"
    >
      {/* Cinematic Divider */}
      <div className="flex items-center gap-4">
        <div
          className={cn(
            "h-px flex-1 bg-gradient-to-r from-transparent",
            `to-${group.color}-500/20`
          )}
        />
        <span
          className={cn(
            "text-xs font-mono font-bold tracking-[0.2em] uppercase",
            `text-${group.color}-500`
          )}
        >
          {group.id} // {group.label}
        </span>
        <div
          className={cn(
            "h-px flex-1 bg-gradient-to-l from-transparent",
            `to-${group.color}-500/20`
          )}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {agents.map((agent, i) => (
          <AgentCard
            key={agent.id}
            agent={agent}
            index={i}
            groupColor={group.color}
            onClick={() => onAgentClick(agent.id)}
          />
        ))}
      </div>
    </motion.div>
  );
}

function AgentCard({
  agent,
  index,
  groupColor,
  onClick,
}: {
  agent: any;
  index: number;
  groupColor: string;
  onClick: () => void;
}) {
  const Icon = ROLE_ICONS[agent.normalizedRole] || HelpCircle;
  const isTerminated =
    agent.status === "TERMINATED" || agent.status === "OFFLINE";
  const isBusy = agent.status === "BUSY";
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = React.useState(false);

  // Status Styles
  const statusConfig = {
    IDLE: {
      color: "emerald",
      glow: "shadow-emerald-900/20 border-emerald-500/30",
    },
    BUSY: { color: "amber", glow: "shadow-amber-900/20 border-amber-500/30" },
    TERMINATED: {
      color: "red",
      glow: "shadow-red-900/20 border-red-500/50 bg-red-950/10",
    },
    OFFLINE: {
      color: "red",
      glow: "shadow-red-900/20 border-red-500/50 bg-red-950/10",
    },
  };

  const status =
    statusConfig[agent.status as keyof typeof statusConfig] ||
    statusConfig.IDLE;

  const handleTerminate = async () => {
    if (
      !confirm(
        `Terminate agent ${agent.id}? This will reassign all their tasks.`
      )
    )
      return;
    setIsLoading(true);
    try {
      await dashboardAPI.terminateAgent(agent.id, "Manual termination");
      queryClient.invalidateQueries({ queryKey: ["agents"] });
    } catch (err) {
      console.error("Failed to terminate:", err);
    }
    setIsLoading(false);
  };

  const handlePromote = async () => {
    setIsLoading(true);
    try {
      await dashboardAPI.promoteAgent(agent.id);
      queryClient.invalidateQueries({ queryKey: ["agents"] });
    } catch (err) {
      console.error("Failed to promote:", err);
      alert("Agent cannot be promoted further");
    }
    setIsLoading(false);
  };

  const handleDemote = async () => {
    setIsLoading(true);
    try {
      await dashboardAPI.demoteAgent(agent.id);
      queryClient.invalidateQueries({ queryKey: ["agents"] });
    } catch (err) {
      console.error("Failed to demote:", err);
      alert("Agent cannot be demoted further");
    }
    setIsLoading(false);
  };

  const handleRevive = async () => {
    setIsLoading(true);
    try {
      await dashboardAPI.reviveAgent(agent.id);
      queryClient.invalidateQueries({ queryKey: ["agents"] });
    } catch (err) {
      console.error("Failed to revive:", err);
    }
    setIsLoading(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.05 }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      onClick={onClick}
      className={cn(
        "group relative overflow-hidden rounded-xl border bg-zinc-900/40 backdrop-blur-md p-5 transition-all duration-300 cursor-pointer",
        isTerminated
          ? status.glow
          : "border-white/5 hover:border-white/20 hover:bg-zinc-900/60 hover:shadow-2xl",
        isLoading && "opacity-50 pointer-events-none"
      )}
    >
      {/* Inner Grid Texture (Hover) */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:16px_16px] opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-lg ring-1 ring-white/10 transition-colors",
              isTerminated
                ? "bg-red-500/10 text-red-500"
                : "bg-zinc-800 text-zinc-300 group-hover:bg-zinc-700 group-hover:text-white"
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight">
              {agent.role}
            </h3>
            <p className="text-[10px] font-mono text-zinc-500">
              ID-...{agent.id.slice(-6)}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {isTerminated ? (
            <button
              onClick={handleRevive}
              className="p-1.5 rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
              title="Revive Agent"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          ) : (
            <>
              <button
                onClick={handlePromote}
                className="p-1.5 rounded bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors"
                title="Promote"
              >
                <TrendingUp className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={handleDemote}
                className="p-1.5 rounded bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors"
                title="Demote"
              >
                <TrendingDown className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={handleTerminate}
                className="p-1.5 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                title="Terminate"
              >
                <Skull className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Status Dot */}
      <div className="absolute top-5 right-5 flex h-2.5 w-2.5 group-hover:hidden">
        {!isTerminated && (
          <span
            className={cn(
              "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
              `bg-${status.color}-400`
            )}
          />
        )}
        <span
          className={cn(
            "relative inline-flex h-2.5 w-2.5 rounded-full",
            `bg-${status.color}-500`
          )}
        />
      </div>

      {/* Metrics Row */}
      <div className="relative z-10 grid grid-cols-2 gap-px bg-white/5 rounded-lg overflow-hidden border border-white/5 mb-6">
        <div className="bg-zinc-900/50 p-2.5 flex flex-col items-center justify-center group-hover:bg-zinc-900/80 transition-colors">
          <div className="text-[9px] text-zinc-500 uppercase tracking-wider mb-1 flex items-center gap-1">
            <Zap className="h-3 w-3" /> Score
          </div>
          <span className="text-sm font-mono font-bold text-white">
            {(agent.score || 0).toFixed(0)}
          </span>
        </div>
        <div className="bg-zinc-900/50 p-2.5 flex flex-col items-center justify-center group-hover:bg-zinc-900/80 transition-colors">
          <div className="text-[9px] text-zinc-500 uppercase tracking-wider mb-1 flex items-center gap-1">
            <Activity className="h-3 w-3" /> Tasks
          </div>
          <span className="text-sm font-mono font-bold text-white">
            {agent.successCount || 0}/
            {(agent.successCount || 0) + (agent.failCount || 0)}
          </span>
        </div>
      </div>

      {/* Footer */}
      <div className="relative z-10 flex items-center justify-between h-6">
        <Badge
          variant="outline"
          className={cn(
            "text-[10px] font-mono border-0 px-2 py-0.5",
            `bg-${status.color}-500/10 text-${status.color}-400`
          )}
        >
          {agent.status}
        </Badge>

        <span className="text-[10px] font-mono text-zinc-500">
          {agent.riskLevel || "LOW"} risk
        </span>
      </div>
    </motion.div>
  );
}
