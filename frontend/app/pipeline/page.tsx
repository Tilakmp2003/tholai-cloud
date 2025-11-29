'use client';

import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Terminal, 
  Cpu, 
  Activity, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  PlayCircle, 
  FileSearch,
  ShieldAlert,
  DollarSign,
  User
} from 'lucide-react';
import { useDashboardData } from '@/hooks/useDashboardData';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { LiveTerminal } from '@/components/LiveTerminal';

// --- Configuration ---

const COLUMNS = [
  { id: 'queued', label: 'QUEUED', color: 'zinc', icon: Clock },
  { id: 'assigned', label: 'ASSIGNED', color: 'indigo', icon: User },
  { id: 'inProgress', label: 'IN PROGRESS', color: 'blue', icon: PlayCircle },
  { id: 'inReview', label: 'IN REVIEW', color: 'amber', icon: FileSearch },
  { id: 'inQA', label: 'IN QA', color: 'purple', icon: Activity },
  { id: 'completed', label: 'COMPLETED', color: 'emerald', icon: CheckCircle2 },
  { id: 'failed', label: 'FAILED', color: 'red', icon: AlertCircle },
];

const COLUMN_STYLES: Record<string, { bg: string; gradient: string; glow: string; text: string; border: string }> = {
  zinc: { 
    bg: 'bg-zinc-500', 
    gradient: 'from-zinc-500/10', 
    glow: 'shadow-[0_0_20px_rgba(113,113,122,0.15)]',
    text: 'text-zinc-500',
    border: 'group-hover:border-zinc-500/50'
  },
  indigo: { 
    bg: 'bg-indigo-500', 
    gradient: 'from-indigo-500/10', 
    glow: 'shadow-[0_0_20px_rgba(99,102,241,0.15)]',
    text: 'text-indigo-500',
    border: 'group-hover:border-indigo-500/50'
  },
  blue: { 
    bg: 'bg-blue-500', 
    gradient: 'from-blue-500/10', 
    glow: 'shadow-[0_0_20px_rgba(59,130,246,0.15)]',
    text: 'text-blue-500',
    border: 'group-hover:border-blue-500/50'
  },
  amber: { 
    bg: 'bg-amber-500', 
    gradient: 'from-amber-500/10', 
    glow: 'shadow-[0_0_20px_rgba(245,158,11,0.15)]',
    text: 'text-amber-500',
    border: 'group-hover:border-amber-500/50'
  },
  purple: { 
    bg: 'bg-purple-500', 
    gradient: 'from-purple-500/10', 
    glow: 'shadow-[0_0_20px_rgba(168,85,247,0.15)]',
    text: 'text-purple-500',
    border: 'group-hover:border-purple-500/50'
  },
  emerald: { 
    bg: 'bg-emerald-500', 
    gradient: 'from-emerald-500/10', 
    glow: 'shadow-[0_0_20px_rgba(16,185,129,0.15)]',
    text: 'text-emerald-500',
    border: 'group-hover:border-emerald-500/50'
  },
  red: { 
    bg: 'bg-red-500', 
    gradient: 'from-red-500/10', 
    glow: 'shadow-[0_0_20px_rgba(239,68,68,0.15)]',
    text: 'text-red-500',
    border: 'group-hover:border-red-500/50'
  },
};

// --- Components ---

export default function PipelinePage() {
  const { tasks, isLoading } = useDashboardData();
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate stats
  const activeThreads = Object.values(tasks || {}).flat().length || 0;

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-50 overflow-hidden selection:bg-indigo-500/30">
      
      {/* HUD Header */}
      <header className="flex items-center justify-between px-8 py-6 border-b border-white/5 bg-zinc-950/50 backdrop-blur-md z-10">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Task Pipeline</h1>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-[10px] font-mono text-zinc-500 tracking-widest uppercase">
              ACTIVE THREADS: <span className="text-zinc-300">{activeThreads}</span>
            </span>
            <span className="text-[10px] font-mono text-zinc-700">|</span>
            <span className="text-[10px] font-mono text-zinc-500 tracking-widest uppercase">
              SYSTEM: <span className="text-emerald-500">NOMINAL</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900/50 border border-white/5">
          <div className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
          </div>
          <span className="text-[10px] font-mono font-medium text-emerald-500 tracking-widest uppercase">
            LIVE SYNC ACTIVE
          </span>
        </div>
      </header>

      {/* Kanban Canvas */}
      <div className="flex flex-1 overflow-hidden">
        <div 
          ref={containerRef}
          className="flex-1 overflow-x-auto overflow-y-hidden scrollbar-hide"
        >
          <div className="flex h-full min-w-max px-8 pb-8 pt-4 gap-0">
            {COLUMNS.map((column, index) => (
              <PipelineColumn 
                key={column.id} 
                column={column} 
                tasks={tasks?.[column.id] || []} 
                index={index}
              />
            ))}
          </div>
        </div>
        
        {/* Live Terminal Sidebar */}
        <LiveTerminal />
      </div>
    </div>
  );
}

function PipelineColumn({ column, tasks, index }: { column: any, tasks: any[], index: number }) {
  const styles = COLUMN_STYLES[column.color];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.4 }}
      className="w-[320px] h-full flex flex-col border-r border-white/5 last:border-r-0 relative group"
    >
      {/* Top Light Effect */}
      <div className={cn("absolute top-0 inset-x-0 h-1", styles.bg)} />
      <div className={cn("absolute top-1 inset-x-0 h-32 bg-gradient-to-b to-transparent opacity-20 pointer-events-none", styles.gradient)} />

      {/* Column Header */}
      <div className="p-4 bg-zinc-900/20 backdrop-blur-sm border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <column.icon className={cn("h-4 w-4", styles.text)} />
          <span className="text-xs font-bold tracking-widest text-zinc-400 uppercase">{column.label}</span>
        </div>
        <span className="text-[10px] font-mono text-zinc-600 bg-zinc-900 px-1.5 py-0.5 rounded border border-white/5">
          {tasks.length}
        </span>
      </div>

      {/* Task List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
        <AnimatePresence mode="popLayout">
          {tasks.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="h-32 flex flex-col items-center justify-center border-2 border-dashed border-zinc-900 rounded-lg bg-zinc-950/30"
            >
              <ShieldAlert className="h-6 w-6 text-zinc-800 mb-2" />
              <span className="text-[10px] font-mono text-zinc-700 tracking-widest uppercase">NO SIGNAL</span>
            </motion.div>
          ) : (
            tasks.map((task) => (
              <TaskCard key={task.id} task={task} color={column.color} />
            ))
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function TaskCard({ task, color }: { task: any, color: string }) {
  const styles = COLUMN_STYLES[color] || COLUMN_STYLES.zinc;
  
  return (
    <motion.div
      layout
      layoutId={task.id}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ y: -4, scale: 1.02, transition: { duration: 0.2 } }}
      className={cn(
        "group relative p-4 rounded-lg border border-white/10 bg-zinc-900 transition-all duration-200",
        `hover:${styles.glow}`,
        styles.border
      )}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-2">
        <span className="text-[10px] font-mono text-zinc-500">
          ID-{task.id.substring(0, 6)}
        </span>
        {task.priority && (
          <div className={cn("w-1.5 h-1.5 rounded-full", task.priority === 'HIGH' ? 'bg-red-500' : 'bg-zinc-600')} />
        )}
      </div>

      {/* Title */}
      <h3 className="text-sm font-medium text-zinc-100 mb-3 line-clamp-2 leading-snug">
        {typeof task.contextPacket === 'string' 
          ? JSON.parse(task.contextPacket)?.summary 
          : task.contextPacket?.summary || "Processing Task Data..."}
      </h3>

      {/* Metadata Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-white/5 mt-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-zinc-500">
            <DollarSign className="h-3 w-3" />
            <span className="text-[10px] font-mono">
              {(task.cost || 0.0042).toFixed(4)}
            </span>
          </div>
          
          {task.retry_count > 0 && (
            <div className="flex items-center gap-1 text-amber-500">
              <AlertCircle className="h-3 w-3" />
              <span className="text-[10px] font-mono">{task.retry_count}</span>
            </div>
          )}
        </div>

        {/* Agent Avatar */}
        <div className="flex items-center gap-1.5 px-1.5 py-0.5 rounded bg-zinc-800/50 border border-white/5">
          <Cpu className="h-3 w-3 text-zinc-400" />
          <span className="text-[10px] font-mono text-zinc-300 uppercase">
            {task.assignedTo || 'SYSTEM'}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
