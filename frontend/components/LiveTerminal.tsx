'use client';

import React, { useEffect, useRef } from 'react';
import { useWebSocket } from '@/providers/WebSocketProvider';
import { Terminal, ShieldCheck, Activity, ChevronRight, Minimize2, Maximize2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

export function LiveTerminal() {
  const { logs, isConnected } = useWebSocket();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isCollapsed, setIsCollapsed] = React.useState(false);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <motion.div 
      initial={{ width: "100%" }}
      animate={{ width: isCollapsed ? 48 : "100%" }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="flex flex-col h-full bg-zinc-950/80 backdrop-blur-xl border-l border-white/5 relative shadow-2xl"
    >
      {/* Scanline Effect */}
      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-0 bg-[length:100%_2px,3px_100%] opacity-20" />

      {/* Toggle Button */}
      <button 
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -left-3 top-4 bg-zinc-900 border border-white/10 rounded-full p-1.5 hover:bg-zinc-800 hover:border-emerald-500/50 hover:text-emerald-400 transition-all z-20 shadow-lg group"
      >
        {isCollapsed ? (
          <ChevronRight className="h-3 w-3 text-zinc-400 group-hover:text-emerald-400" />
        ) : (
          <Minimize2 className="h-3 w-3 text-zinc-400 group-hover:text-emerald-400" />
        )}
      </button>

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-4 py-3 border-b border-white/5 bg-zinc-900/50 overflow-hidden whitespace-nowrap">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 bg-emerald-500/20 blur-sm rounded-full" />
            <Activity className="h-4 w-4 text-emerald-500 relative z-10" />
          </div>
          <motion.div 
            animate={{ opacity: isCollapsed ? 0 : 1 }}
            className="flex flex-col"
          >
            <span className="text-[10px] font-bold tracking-[0.2em] text-zinc-500 uppercase">System Stream</span>
            <span className="text-xs font-bold tracking-widest text-zinc-200 uppercase font-mono">Agent Logs</span>
          </motion.div>
        </div>
        <motion.div 
          animate={{ opacity: isCollapsed ? 0 : 1 }}
          className="flex items-center gap-2 bg-zinc-900/80 rounded-full px-2 py-1 border border-white/5"
        >
          <div className={`h-1.5 w-1.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-red-500'}`} />
          <span className={`text-[10px] font-mono uppercase ${isConnected ? 'text-emerald-500' : 'text-red-500'}`}>
            {isConnected ? 'ONLINE' : 'OFFLINE'}
          </span>
        </motion.div>
      </div>

      {/* Logs Area */}
      <div 
        ref={scrollRef}
        className="relative z-10 flex-1 overflow-y-auto p-6 font-mono text-xs space-y-2 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent overflow-x-hidden"
      >
        {!isCollapsed && (
          <AnimatePresence initial={false}>
            {logs
              .filter(log => {
                // Filter out system cycle messages - only show real agent work
                const isSystemCycle = log.includes('Cycle started') || log.includes('Cycle finished');
                return !isSystemCycle;
              })
              .map((log, i) => (
              <motion.div
                key={`${i}-${log.substring(0, 10)}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="group flex items-start gap-4 text-zinc-400 break-all hover:bg-white/5 -mx-4 px-4 py-1.5 rounded transition-colors border-l-2 border-transparent hover:border-emerald-500/30"
              >
                <span className="text-zinc-600 shrink-0 select-none text-[10px] pt-0.5 opacity-50 group-hover:opacity-100 transition-opacity font-medium">
                  {new Date().toLocaleTimeString([], { hour12: false })}
                </span>
                <div className="leading-relaxed flex-1">
                  {formatLog(log)}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
        {!isCollapsed && logs.filter(log => !log.includes('Cycle started') && !log.includes('Cycle finished')).length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-zinc-700 space-y-3 opacity-50">
            <Activity className="h-10 w-10 animate-pulse" />
            <span className="text-sm tracking-widest uppercase font-medium">Awaiting Agent Activity...</span>
            <span className="text-xs text-zinc-800 font-mono max-w-xs text-center">No active work detected. Agents will appear here when working on projects.</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function formatLog(log: string) {
  // Extract timestamp if present (e.g. from backend logs)
  // But usually we add our own. If backend sends one, we might want to parse it.
  
  let content = log;
  let badge = null;

  if (log.includes('[ERROR]') || log.toLowerCase().includes('error:')) {
    badge = <span className="bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded text-[9px] font-bold text-red-500 tracking-wider">ERR</span>;
    content = content.replace('[ERROR]', '').replace('Error:', '');
  } else if (log.includes('[WARN]') || log.toLowerCase().includes('warn:')) {
    badge = <span className="bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded text-[9px] font-bold text-amber-500 tracking-wider">WRN</span>;
    content = content.replace('[WARN]', '').replace('Warn:', '');
  } else if (log.includes('[INFO]')) {
    badge = <span className="bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded text-[9px] font-bold text-blue-500 tracking-wider">INF</span>;
    content = content.replace('[INFO]', '');
  } else if (log.includes('[Runner]') || log.includes('[System]')) {
    badge = <span className="bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded text-[9px] font-bold text-emerald-500 tracking-wider">SYS</span>;
    content = content.replace('[Runner]', '').replace('[System]', '');
  } else if (log.includes('[Workspace]')) {
    badge = <span className="bg-indigo-500/10 border border-indigo-500/20 px-1.5 py-0.5 rounded text-[9px] font-bold text-indigo-500 tracking-wider">WRK</span>;
    content = content.replace('[Workspace]', '');
  } else if (log.includes('[Next.js')) {
    badge = <span className="bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 rounded text-[9px] font-bold text-zinc-400 tracking-wider">APP</span>;
    // Keep the port info if useful, or clean it up
  }

  return (
    <span className={cn("flex items-center gap-3", badge ? "text-zinc-300" : "text-zinc-400")}>
      {badge}
      <span className="truncate">{content.trim()}</span>
    </span>
  );
}
