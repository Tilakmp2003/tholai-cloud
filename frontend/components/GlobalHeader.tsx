'use client';

import React, { useEffect, useState } from 'react';
import { useWebSocket } from '@/providers/WebSocketProvider';
import { Activity, Radio, Wifi, Clock } from 'lucide-react';
import { format } from 'date-fns';

export function GlobalHeader() {
  const { isConnected, logs } = useWebSocket();
  const [lastEventTime, setLastEventTime] = useState<Date | null>(null);
  const [heartbeat, setHeartbeat] = useState(0);

  useEffect(() => {
    if (logs.length > 0) {
      setLastEventTime(new Date());
    }
  }, [logs]);

  useEffect(() => {
    const interval = setInterval(() => {
      setHeartbeat(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="h-14 border-b border-white/5 bg-zinc-950/50 backdrop-blur-sm flex items-center justify-between px-6 sticky top-0 z-50">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="relative flex h-3 w-3">
            {isConnected && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            )}
            <span className={`relative inline-flex rounded-full h-3 w-3 ${isConnected ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
          </div>
          <span className="text-xs font-bold tracking-widest text-zinc-300 uppercase">
            {isConnected ? 'System Online' : 'Disconnected'}
          </span>
        </div>
        
        <div className="h-4 w-[1px] bg-white/10" />

        <div className="flex items-center gap-2 text-xs font-mono text-zinc-500">
          <Activity className="h-3.5 w-3.5 text-indigo-500" />
          <span>Heartbeat: {heartbeat}</span>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 text-xs font-mono text-zinc-500">
          <Clock className="h-3.5 w-3.5" />
          <span>Last Event: {lastEventTime ? format(lastEventTime, 'HH:mm:ss') : '--:--:--'}</span>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-zinc-500">
          <Wifi className="h-3.5 w-3.5" />
          <span>Latency: {isConnected ? '12ms' : '---'}</span>
        </div>
      </div>
    </header>
  );
}
