'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  HelpCircle
} from 'lucide-react';
import { useDashboardData } from '@/hooks/useDashboardData';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

// --- Configuration ---

const ROLE_GROUPS = [
  {
    id: 'L4',
    label: 'EXECUTIVE COMMAND',
    color: 'indigo',
    match: ['HEADAGENT', 'CEO', 'CTO']
  },
  {
    id: 'L3',
    label: 'MANAGEMENT LAYER',
    color: 'purple',
    match: ['TEAMLEAD', 'PM', 'ARCHITECT', 'PROJECTMANAGER', 'TEAM_LEAD']
  },
  {
    id: 'L1',
    label: 'EXECUTION UNITS',
    color: 'emerald',
    match: ['SENIORDEV', 'MIDDEV', 'JUNIORDEV', 'QA', 'SECURITY', 'SENIOR_DEV', 'MID_DEV', 'JUNIOR_DEV']
  },
  {
    id: 'U0',
    label: 'UNCLASSIFIED UNITS',
    color: 'zinc',
    match: [] // Fallback group
  }
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
  if (!role) return 'UNKNOWN';
  return role.toUpperCase().replace(/[^A-Z0-9]/g, '');
};

const getGroupForRole = (normalizedRole: string) => {
  for (const group of ROLE_GROUPS) {
    if (group.match.includes(normalizedRole)) {
      return group;
    }
  }
  return ROLE_GROUPS.find(g => g.id === 'U0')!;
};

// --- Components ---

export default function AgentsPage() {
  const { agents, isLoading } = useDashboardData();

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
          <h1 className="text-2xl font-bold tracking-tight text-white">Workforce Directory</h1>
          <p className="text-xs text-zinc-500 font-mono mt-1 tracking-wider uppercase">
            ACTIVE PERSONNEL DATABASE • <span className="text-emerald-500">LIVE SYNC</span>
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900/50 border border-white/5">
          <span className="text-[10px] font-mono text-zinc-500 tracking-widest uppercase">TOTAL UNITS</span>
          <span className="text-xs font-mono font-bold text-white">{agents.length}</span>
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
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

function AgentGroup({ group, agents, delay }: { group: any, agents: any[], delay: number }) {
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
        <div className={cn("h-px flex-1 bg-gradient-to-r from-transparent", `to-${group.color}-500/20`)} />
        <span className={cn("text-xs font-mono font-bold tracking-[0.2em] uppercase", `text-${group.color}-500`)}>
          {group.id} // {group.label}
        </span>
        <div className={cn("h-px flex-1 bg-gradient-to-l from-transparent", `to-${group.color}-500/20`)} />
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {agents.map((agent, i) => (
          <AgentCard key={agent.id} agent={agent} index={i} groupColor={group.color} />
        ))}
      </div>
    </motion.div>
  );
}

function AgentCard({ agent, index, groupColor }: { agent: any, index: number, groupColor: string }) {
  const Icon = ROLE_ICONS[agent.normalizedRole] || HelpCircle;
  const isTerminated = agent.status === 'TERMINATED' || agent.status === 'OFFLINE';
  const isBusy = agent.status === 'BUSY';

  // Status Styles
  const statusConfig = {
    IDLE: { color: 'emerald', glow: 'shadow-emerald-900/20 border-emerald-500/30' },
    BUSY: { color: 'amber', glow: 'shadow-amber-900/20 border-amber-500/30' },
    TERMINATED: { color: 'red', glow: 'shadow-red-900/20 border-red-500/50 bg-red-950/10' },
    OFFLINE: { color: 'red', glow: 'shadow-red-900/20 border-red-500/50 bg-red-950/10' },
  };

  const status = (statusConfig[agent.status as keyof typeof statusConfig] || statusConfig.IDLE);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.05 }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className={cn(
        "group relative overflow-hidden rounded-xl border bg-zinc-900/40 backdrop-blur-md p-5 transition-all duration-300",
        isTerminated ? status.glow : "border-white/5 hover:border-white/20 hover:bg-zinc-900/60 hover:shadow-2xl"
      )}
    >
      {/* Inner Grid Texture (Hover) */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:16px_16px] opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex h-10 w-10 items-center justify-center rounded-lg ring-1 ring-white/10 transition-colors",
            isTerminated ? "bg-red-500/10 text-red-500" : "bg-zinc-800 text-zinc-300 group-hover:bg-zinc-700 group-hover:text-white"
          )}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight">{agent.role}</h3>
            <p className="text-[10px] font-mono text-zinc-500">ID-...{agent.id.slice(-6)}</p>
          </div>
        </div>
        
        {/* Status Dot */}
        <div className="relative flex h-2.5 w-2.5">
          {!isTerminated && (
            <span className={cn(
              "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
              `bg-${status.color}-400`
            )} />
          )}
          <span className={cn(
            "relative inline-flex h-2.5 w-2.5 rounded-full",
            `bg-${status.color}-500`
          )} />
        </div>
      </div>

      {/* Metrics Row */}
      <div className="relative z-10 grid grid-cols-2 gap-px bg-white/5 rounded-lg overflow-hidden border border-white/5 mb-6">
        <div className="bg-zinc-900/50 p-2.5 flex flex-col items-center justify-center group-hover:bg-zinc-900/80 transition-colors">
          <div className="text-[9px] text-zinc-500 uppercase tracking-wider mb-1 flex items-center gap-1">
            <Zap className="h-3 w-3" /> Score
          </div>
          <span className="text-sm font-mono font-bold text-white">{(agent.score || 0).toFixed(0)}</span>
        </div>
        <div className="bg-zinc-900/50 p-2.5 flex flex-col items-center justify-center group-hover:bg-zinc-900/80 transition-colors">
          <div className="text-[9px] text-zinc-500 uppercase tracking-wider mb-1 flex items-center gap-1">
            <Wallet className="h-3 w-3" /> Cost
          </div>
          <span className="text-sm font-mono font-bold text-white">${(agent.totalCost || 0).toFixed(2)}</span>
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

        <button className="text-[10px] font-medium text-zinc-500 hover:text-white transition-all opacity-0 group-hover:opacity-100 flex items-center gap-1 translate-x-2 group-hover:translate-x-0">
          AUDIT LOGS <Terminal className="h-3 w-3" />
        </button>
      </div>
    </motion.div>
  );
}

