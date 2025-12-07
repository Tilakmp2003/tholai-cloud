"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Terminal,
  Zap,
  CheckCircle,
  DollarSign,
  Cpu,
  Server,
  Shield,
} from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useWebSocket } from "@/providers/WebSocketProvider";
import { EnterpriseProjectWizard } from "@/components/EnterpriseProjectWizard";

export default function CommandCenterPage() {
  const {
    agents,
    tasks,
    events: governanceEvents,
    governanceStats,
    metrics,
    isLoading,
  } = useDashboardData();
  const { isConnected } = useWebSocket();
  const [showNewProject, setShowNewProject] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-2rem)]">
        <div className="text-center space-y-4">
          <div className="relative">
            <div className="absolute inset-0 bg-indigo-500/20 blur-xl rounded-full animate-pulse" />
            <Terminal className="h-12 w-12 animate-pulse mx-auto text-indigo-400 relative z-10" />
          </div>
          <p className="text-sm font-mono text-zinc-500 tracking-widest uppercase">
            Initializing System...
          </p>
        </div>
      </div>
    );
  }

  // Derived metrics
  const activeAgents = metrics.agents?.active || 0;
  const totalAgents = metrics.agents?.total || 0;
  const totalCost = metrics.performance?.totalCost || 0;
  const queuedTasks = Array.isArray(tasks.queued) ? tasks.queued.length : 0;
  const criticalIssues =
    (governanceStats.terminations || 0) + (governanceStats.demotions || 0);

  // Active tasks (not completed or failed)
  const activeTasks = [
    ...(tasks.queued || []),
    ...(tasks.assigned || []),
    ...(tasks.inProgress || []),
    ...(tasks.inReview || []),
    ...(tasks.inQA || []),
    ...(tasks.needsRevision || []),
    ...(tasks.blocked || []),
  ];

  const events = governanceEvents || [];

  return (
    <div className="p-8 max-w-[1800px] mx-auto space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-medium tracking-tight text-white">
            Command Center
          </h1>
          <p className="text-sm text-zinc-500 font-mono mt-1">
            <span className="text-emerald-500">●</span> SYSTEM OPTIMAL
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900/50 border border-white/5 text-xs font-mono text-zinc-400">
            <div
              className={`w-1.5 h-1.5 rounded-full ${
                isConnected
                  ? "bg-emerald-500 shadow-[0_0_8px_#10b981]"
                  : "bg-red-500"
              }`}
            />
            {isConnected ? "SOCKET_CONNECTED" : "SOCKET_OFFLINE"}
          </div>

          <Button
            onClick={() => setShowNewProject(true)}
            size="sm"
            className="bg-zinc-100 text-zinc-950 hover:bg-white font-medium shadow-[0_0_20px_rgba(255,255,255,0.1)] border-0"
          >
            <Plus className="mr-2 h-4 w-4" />
            Initialize Project
          </Button>
        </div>
      </motion.div>

      {/* KPI Grid ("Holo-Cards") */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="LIFETIME COMPUTE"
          value={`$${totalCost.toFixed(4)}`}
          icon={DollarSign}
          delay={0.1}
        />
        <KpiCard
          label="ACTIVE WORKFORCE"
          value={`${activeAgents}/${totalAgents}`}
          icon={Cpu}
          delay={0.2}
          subValue="AGENTS"
        />
        <KpiCard
          label="TASK BACKLOG"
          value={queuedTasks}
          icon={Server}
          delay={0.3}
          subValue="PENDING"
        />
        <KpiCard
          label="GOVERNANCE"
          value={criticalIssues === 0 ? "100%" : "98%"}
          icon={Shield}
          delay={0.4}
          alert={criticalIssues > 0}
          subValue="HEALTH"
        />
      </div>

      {/* Main Content Split */}
      <div className="grid gap-6 md:grid-cols-12 h-[600px]">
        {/* Governance Feed (Terminal Style) */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
          className="md:col-span-7 lg:col-span-8 h-full"
        >
          <div className="h-full flex flex-col rounded-xl border border-white/10 bg-zinc-900/50 backdrop-blur-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/[0.02]">
              <div className="flex items-center gap-2">
                <Terminal className="h-4 w-4 text-zinc-500" />
                <span className="text-xs font-medium text-zinc-400 tracking-wider uppercase">
                  System Logs
                </span>
              </div>
              <span className="text-[10px] font-mono text-zinc-600">
                {events.length} EVENTS
              </span>
            </div>

            <div className="flex-1 overflow-hidden relative group">
              {/* Inner Glow on Hover */}
              <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

              <ScrollArea className="h-full">
                <div className="p-2 space-y-1">
                  <AnimatePresence mode="popLayout">
                    {events.length === 0 && (
                      <EmptyState icon={Terminal} label="NO LOGS DETECTED" />
                    )}
                    {events.map((event: any, i: number) => (
                      <LogItem key={event.id || i} event={event} index={i} />
                    ))}
                  </AnimatePresence>
                </div>
              </ScrollArea>
            </div>
          </div>
        </motion.div>

        {/* Active Pipeline (Command Grid) */}
        <motion.div
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.6 }}
          className="md:col-span-5 lg:col-span-4 h-full"
        >
          <div className="h-full flex flex-col rounded-xl border border-white/10 bg-zinc-900/50 backdrop-blur-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/[0.02]">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-zinc-500" />
                <span className="text-xs font-medium text-zinc-400 tracking-wider uppercase">
                  Active Tasks
                </span>
              </div>
              <span className="text-[10px] font-mono text-zinc-600">
                {activeTasks.length} PENDING
              </span>
            </div>

            <div className="flex-1 overflow-hidden relative group">
              <div className="absolute inset-0 bg-gradient-to-bl from-emerald-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

              <ScrollArea className="h-full">
                <div className="p-4 space-y-3">
                  <AnimatePresence mode="popLayout">
                    {activeTasks.length === 0 && (
                      <EmptyState icon={CheckCircle} label="ALL SYSTEMS IDLE" />
                    )}
                    {activeTasks.slice(0, 20).map((task: any, i: number) => (
                      <TaskCard key={task.id || i} task={task} index={i} />
                    ))}
                  </AnimatePresence>
                </div>
              </ScrollArea>
            </div>
          </div>
        </motion.div>
      </div>

      <EnterpriseProjectWizard
        open={showNewProject}
        onOpenChange={setShowNewProject}
      />
    </div>
  );
}

// --- SUB COMPONENTS ---

function KpiCard({ label, value, icon: Icon, delay, subValue, alert }: any) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.4 }}
      className="relative group overflow-hidden rounded-xl border border-white/10 bg-zinc-900/50 p-6 backdrop-blur-xl transition-all duration-300 hover:border-white/20"
    >
      {/* Top Highlight */}
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-50" />

      {/* Hover Gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <span className="text-[10px] font-medium tracking-widest text-zinc-500 uppercase">
            {label}
          </span>
          <Icon
            className={`h-4 w-4 ${
              alert ? "text-red-500" : "text-zinc-600 group-hover:text-zinc-400"
            } transition-colors`}
          />
        </div>
        <div className="flex items-baseline gap-2">
          <span
            className={`text-3xl font-mono font-light tracking-tighter ${
              alert ? "text-red-400" : "text-white"
            }`}
          >
            {value}
          </span>
          {subValue && (
            <span className="text-[10px] font-mono text-zinc-600 uppercase">
              {subValue}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function LogItem({ event, index }: any) {
  const isBad = ["TERMINATE", "DEMOTE", "WARNING"].includes(event.action);
  const isGood = ["PROMOTE"].includes(event.action);

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.02 }}
      className="group flex items-center gap-3 px-4 py-2 hover:bg-white/[0.02] border-l-2 border-transparent hover:border-indigo-500/50 transition-all"
    >
      <span className="font-mono text-[10px] text-zinc-600 min-w-[50px]">
        {format(new Date(event.createdAt), "HH:mm:ss")}
      </span>

      <div
        className={`w-1.5 h-1.5 rounded-full ${
          isBad
            ? "bg-red-500 shadow-[0_0_6px_#ef4444]"
            : isGood
            ? "bg-emerald-500 shadow-[0_0_6px_#10b981]"
            : "bg-indigo-500 shadow-[0_0_6px_#6366f1]"
        }`}
      />

      <span
        className={`text-xs font-mono font-medium ${
          isBad ? "text-red-400" : "text-zinc-300"
        }`}
      >
        {event.action}
      </span>

      <span className="text-xs text-zinc-500 truncate flex-1 group-hover:text-zinc-400 transition-colors">
        {event.reason}
      </span>

      <Badge
        variant="outline"
        className="text-[9px] h-4 border-white/5 bg-white/[0.02] text-zinc-500 font-mono uppercase tracking-wider"
      >
        {event.agent?.role || "SYSTEM"}
      </Badge>
    </motion.div>
  );
}

function TaskCard({ task, index }: any) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="group relative p-4 rounded-lg border border-white/5 bg-zinc-900/30 hover:bg-zinc-900/60 hover:border-white/10 transition-all duration-200"
    >
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-2">
          <div className="w-1 h-1 rounded-full bg-indigo-500" />
          <span className="font-mono text-[10px] text-zinc-500">
            ID-{task.id.substring(0, 4)}
          </span>
        </div>
        <Badge
          variant="outline"
          className="text-[9px] h-4 border-white/5 bg-white/[0.02] text-zinc-400 font-mono"
        >
          {task.status}
        </Badge>
      </div>

      <p className="text-xs text-zinc-400 line-clamp-2 mb-3 group-hover:text-zinc-200 transition-colors font-medium leading-relaxed">
        {typeof task.contextPacket === "string"
          ? JSON.parse(task.contextPacket)?.summary ||
            JSON.parse(task.contextPacket)?.description
          : task.contextPacket?.summary ||
            task.contextPacket?.description ||
            task.title}
      </p>

      {/* Progress Bar */}
      <div className="h-0.5 w-full bg-zinc-800 rounded-full overflow-hidden">
        <div className="h-full bg-indigo-500 w-1/3 opacity-50 group-hover:opacity-100 transition-opacity" />
      </div>
    </motion.div>
  );
}

function EmptyState({ icon: Icon, label }: any) {
  return (
    <div className="h-full flex flex-col items-center justify-center py-20 border-2 border-dashed border-zinc-800/50 rounded-lg bg-zinc-900/20 m-4">
      <Icon className="h-8 w-8 text-zinc-700 mb-3" />
      <span className="text-xs font-mono text-zinc-600 tracking-widest uppercase">
        {label}
      </span>
    </div>
  );
}
