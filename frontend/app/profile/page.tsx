'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { 
  Building, CreditCard, Activity, Server, Globe, 
  ArrowUpRight, Shield, Users, Clock, FileText,
  ChevronRight, AlertTriangle, CheckCircle, Terminal
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SignOutButton } from '@clerk/nextjs';

// --- Mock Data ---

const CLIENT_DATA = {
  name: "Tilak M.",
  id: "ENG-001-ALPHA",
  tier: "SENIOR_ENGINEER",
  health: "OPTIMAL",
  joined: "2024-01-15",
  metrics: {
    ltv: "98.5%",
    activeProjects: 4,
    computeUsage: "12.4h"
  },
  contacts: [
    { name: "System Admin", role: "Ops", status: "online", avatar: "https://avatar.vercel.sh/admin" },
    { name: "Project Lead", role: "Management", status: "busy", avatar: "https://avatar.vercel.sh/lead" },
  ],
  projects: [
    { id: 1, name: "E-Commerce Platform", status: "BUILDING", progress: 65, budget: "Active" },
    { id: 2, name: "SaaS Dashboard", status: "MAINTENANCE", progress: 100, budget: "Stable" },
    { id: 3, name: "AI Agent Core", status: "BUILDING", progress: 32, budget: "In Review" },
  ],
  logs: [
    { id: 1, type: "info", message: "WORKSPACE_ACCESSED", timestamp: "2025-11-26 14:00" },
    { id: 2, type: "success", message: "DEPLOYMENT_COMPLETE", timestamp: "2025-11-26 12:30" },
    { id: 3, type: "warning", message: "HIGH_LATENCY_DETECTED", timestamp: "2025-11-26 09:15" },
    { id: 4, type: "info", message: "FILE_SAVED: main.tsx", timestamp: "2025-11-25 16:45" },
    { id: 5, type: "success", message: "LOGIN_SUCCESSFUL", timestamp: "2025-11-25 14:20" },
  ]
};

// --- Sub-Components ---

const TelemetryCard = ({ label, value, icon: Icon, trend, subValue }: any) => (
  <div className="bg-zinc-900/50 border border-white/5 rounded-xl p-6 flex flex-col justify-between hover:border-indigo-500/30 transition-colors group h-full">
    <div className="flex items-center justify-between mb-4">
      <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">{label}</span>
      <Icon className="h-4 w-4 text-zinc-600 group-hover:text-indigo-400 transition-colors" />
    </div>
    <div>
      <div className="flex items-end gap-3 mb-1">
        <span className="text-4xl font-mono font-bold text-white tracking-tighter">{value}</span>
        {trend && (
          <div className="flex items-center gap-1 text-xs font-mono text-emerald-400 mb-1.5">
            <ArrowUpRight className="h-3 w-3" />
            {trend}
          </div>
        )}
      </div>
      {subValue && <p className="text-xs text-zinc-600 font-mono">{subValue}</p>}
    </div>
    {/* Sparkline Decoration */}
    <div className="mt-4 h-1 w-full bg-zinc-800 rounded-full overflow-hidden">
      <div className="h-full bg-indigo-500/50 w-[60%]" />
    </div>
  </div>
);

const ProjectRow = ({ project }: any) => (
  <div className="group flex items-center justify-between p-3 rounded-lg border border-white/5 bg-zinc-900/30 hover:bg-zinc-800 hover:border-indigo-500/30 transition-all cursor-pointer">
    <div className="flex items-center gap-3">
      <div className={cn(
        "w-2 h-2 rounded-full",
        project.status === 'BUILDING' ? "bg-indigo-500 animate-pulse" : "bg-emerald-500"
      )} />
      <div>
        <h4 className="text-sm font-medium text-zinc-200 group-hover:text-white">{project.name}</h4>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] font-mono text-zinc-500">{project.status}</span>
          <span className="text-[10px] font-mono text-zinc-600">•</span>
          <span className="text-[10px] font-mono text-zinc-500">{project.budget}</span>
        </div>
      </div>
    </div>
    <div className="flex items-center gap-4">
      <div className="w-24 h-1 bg-zinc-800 rounded-full overflow-hidden">
        <div 
          className="h-full bg-indigo-500 transition-all duration-500" 
          style={{ width: `${project.progress}%` }} 
        />
      </div>
      <ChevronRight className="h-4 w-4 text-zinc-600 group-hover:text-white transition-colors" />
    </div>
  </div>
);

const LogEntry = ({ log }: any) => {
  const getColor = (type: string) => {
    switch (type) {
      case 'success': return 'text-emerald-400';
      case 'warning': return 'text-amber-400';
      case 'error': return 'text-red-400';
      default: return 'text-blue-400';
    }
  };

  return (
    <div className="flex items-start gap-3 py-2 border-b border-white/5 last:border-0 font-mono text-xs">
      <span className="text-zinc-600 shrink-0">[{log.timestamp.split(' ')[1]}]</span>
      <span className={cn("font-medium", getColor(log.type))}>{log.message}</span>
    </div>
  );
};

// --- Main Page ---

export default function ClientProfilePage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200 p-8 font-sans selection:bg-indigo-500/30">
      
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start justify-between mb-8"
      >
        <div className="flex items-center gap-6">
          {/* Corporate Monogram */}
          <div className="relative w-24 h-24 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center overflow-hidden group">
            <div className="absolute inset-0 bg-emerald-500/20 blur-xl opacity-50 group-hover:opacity-75 transition-opacity" />
            <span className="text-3xl font-bold text-white relative z-10 tracking-tighter">CS</span>
          </div>
          
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-3xl font-bold tracking-tight text-white">{CLIENT_DATA.name}</h1>
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 font-mono text-[10px] tracking-widest">
                {CLIENT_DATA.health}
              </Badge>
            </div>
            <div className="flex items-center gap-4 text-sm font-mono text-zinc-500">
              <span>ID: {CLIENT_DATA.id}</span>
              <span>•</span>
              <span>TIER: {CLIENT_DATA.tier}</span>
              <span>•</span>
              <span>JOINED: {CLIENT_DATA.joined}</span>
            </div>
          </div>
        </div>

          <div className="flex items-center gap-3">
            <Button variant="outline" className="border-white/10 hover:bg-white/5 text-zinc-400 hover:text-white">
              <FileText className="h-4 w-4 mr-2" />
              Export Report
            </Button>
            <SignOutButton>
              <Button className="bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20">
                Sign Out
              </Button>
            </SignOutButton>
          </div>
      </motion.div>

      {/* Navigation Strip */}
      <div className="flex items-center gap-8 border-b border-white/5 mb-8 text-sm font-medium text-zinc-500">
        <button className="text-white border-b-2 border-indigo-500 pb-4 px-2">OVERVIEW</button>
        <button className="hover:text-zinc-300 pb-4 px-2 transition-colors">FINANCIALS</button>
        <button className="hover:text-zinc-300 pb-4 px-2 transition-colors">SETTINGS</button>
      </div>

      {/* Bento Grid */}
      <motion.div 
        initial="hidden"
        animate="visible"
        variants={{
          visible: { transition: { staggerChildren: 0.1 } }
        }}
        className="grid grid-cols-12 gap-6 h-[600px]"
      >
        
        {/* A. Account Telemetry (Top Row) */}
        <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }} className="col-span-4 h-40">
          <TelemetryCard 
            label="PERFORMANCE SCORE" 
            value={CLIENT_DATA.metrics.ltv} 
            icon={CreditCard} 
            trend="+2.5%"
            subValue="Top 5% of Engineers"
          />
        </motion.div>
        <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }} className="col-span-4 h-40">
          <TelemetryCard 
            label="ACTIVE ASSIGNMENTS" 
            value={CLIENT_DATA.metrics.activeProjects} 
            icon={Activity} 
            subValue="1 Critical Deadline"
          />
        </motion.div>
        <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }} className="col-span-4 h-40">
          <TelemetryCard 
            label="SESSION DURATION" 
            value={CLIENT_DATA.metrics.computeUsage} 
            icon={Server} 
            trend="+1.2h"
            subValue="Since Last Login"
          />
        </motion.div>

        {/* B. Active Engagements (Left Column) */}
        <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }} className="col-span-8 row-span-2 bg-zinc-900/30 border border-white/5 rounded-xl p-6 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <h3 className="text-sm font-mono font-bold text-zinc-300 tracking-wider">ACTIVE PROJECTS</h3>
            </div>
            <Button variant="ghost" size="sm" className="h-6 text-[10px] font-mono text-zinc-500 hover:text-white">VIEW ALL</Button>
          </div>
          <div className="space-y-3 flex-1 overflow-auto pr-2">
            {CLIENT_DATA.projects.map((project) => (
              <ProjectRow key={project.id} project={project} />
            ))}
          </div>
        </motion.div>

        {/* C. Interaction Log (Right Column) */}
        <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }} className="col-span-4 row-span-2 bg-black/40 border border-white/5 rounded-xl p-6 flex flex-col font-mono">
          <div className="flex items-center gap-2 mb-4 border-b border-white/5 pb-2">
            <Terminal className="h-4 w-4 text-zinc-500" />
            <h3 className="text-xs font-bold text-zinc-400 tracking-wider">SYSTEM LOGS</h3>
          </div>
          <ScrollArea className="flex-1 -mr-4 pr-4">
            <div className="space-y-1">
              {CLIENT_DATA.logs.map((log) => (
                <LogEntry key={log.id} log={log} />
              ))}
            </div>
          </ScrollArea>
        </motion.div>

        {/* D. Stakeholder Roster (Bottom Row - Merged into Grid for layout balance) */}
        {/* Note: In a real Bento, this might be a separate row, but fitting into 12 cols/rows. 
            Let's add it as a footer strip inside the Active Engagements or separate. 
            Given the request for "Bottom Row", let's adjust the grid. 
            Actually, let's make the Active Engagements span less height and put Roster below it?
            Or just add it as a new row below.
        */}
      </motion.div>

      {/* D. Stakeholder Roster (Separate Row) */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="mt-6 grid grid-cols-12 gap-6"
      >
        <div className="col-span-12 bg-zinc-900/30 border border-white/5 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Users className="h-4 w-4 text-zinc-500" />
            <span className="text-xs font-mono font-bold text-zinc-400 tracking-wider">STAKEHOLDERS</span>
          </div>
          <div className="flex items-center gap-6">
            {CLIENT_DATA.contacts.map((contact, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="relative">
                  <img src={contact.avatar} alt={contact.name} className="w-8 h-8 rounded-full grayscale hover:grayscale-0 transition-all" />
                  <div className={cn(
                    "absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-zinc-900",
                    contact.status === 'online' ? "bg-emerald-500" : "bg-zinc-600"
                  )} />
                </div>
                <div>
                  <p className="text-xs font-medium text-zinc-300">{contact.name}</p>
                  <p className="text-[10px] text-zinc-600 font-mono uppercase">{contact.role}</p>
                </div>
              </div>
            ))}
          </div>
          <Button variant="ghost" size="sm" className="text-xs text-zinc-500 hover:text-white">Manage Team</Button>
        </div>
      </motion.div>

    </div>
  );
}
