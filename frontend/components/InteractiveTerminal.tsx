'use client';

import { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { useWebSocket } from '../providers/WebSocketProvider';
import { Terminal, Activity, Zap, Command } from 'lucide-react';
import '@xterm/xterm/css/xterm.css';

interface InteractiveTerminalProps {
  projectId: string;
  className?: string;
}

export function InteractiveTerminal({ projectId, className = '' }: InteractiveTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  // Use stable session ID based on projectId only (no timestamp)
  const sessionId = `terminal-${projectId}`;
  const [isConnected, setIsConnected] = useState(false);
  const { socket } = useWebSocket();

  useEffect(() => {
    if (!socket || !terminalRef.current) return;

    // Initialize xterm.js
    const term = new XTerm({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      lineHeight: 1.4,
      theme: {
        background: '#09090b', // zinc-950
        foreground: '#a1a1aa', // zinc-400
        cursor: '#10b981', // emerald-500
        cursorAccent: '#09090b',
        selectionBackground: 'rgba(16, 185, 129, 0.2)',
        black: '#09090b',
        red: '#ef4444',
        green: '#10b981',
        yellow: '#f59e0b',
        blue: '#3b82f6',
        magenta: '#d946ef',
        cyan: '#06b6d4',
        white: '#f4f4f5',
        brightBlack: '#52525b',
        brightRed: '#f87171',
        brightGreen: '#34d399',
        brightYellow: '#fbbf24',
        brightBlue: '#60a5fa',
        brightMagenta: '#e879f9',
        brightCyan: '#22d3ee',
        brightWhite: '#ffffff',
      },
      scrollback: 1000,
      allowProposedApi: true,
    });

    // Add fit addon
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    // Open terminal
    term.open(terminalRef.current);
    
    // Wait for next frame to ensure dimensions are available
    requestAnimationFrame(() => {
      try {
        fitAddon.fit();
      } catch (err) {
        console.warn('[Terminal] Failed to fit on initial mount, will retry:', err);
        // Retry after a short delay
        setTimeout(() => {
          try {
            fitAddon.fit();
          } catch (retryErr) {
            console.error('[Terminal] Failed to fit after retry:', retryErr);
          }
        }, 100);
      }
    });

    // Store refs
    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    // Handle window resize
    const handleResize = () => {
      try {
        fitAddon.fit();
        if (socket) {
          socket.emit('terminal:resize', {
            sessionId,
            cols: term.cols,
            rows: term.rows,
          });
        }
      } catch (err) {
        console.warn('[Terminal] Failed to fit on resize:', err);
      }
    };

    window.addEventListener('resize', handleResize);

    // Listen for terminal output
    socket.on('terminal:output', ({ sessionId: sid, data }) => {
      if (sid === sessionId) {
        term.write(data);
      }
    });

    // Listen for session created
    socket.on('terminal:created', ({ sessionId: sid }) => {
      if (sid === sessionId) {
        setIsConnected(true);
        term.focus(); // Focus terminal on connection
      }
    });

    // Listen for errors
    socket.on('terminal:error', ({ sessionId: sid, error }) => {
      if (sid === sessionId) {
        term.write(`\r\n\x1b[1;31mTerminal Error: ${error}\x1b[0m\r\n`);
      }
    });

    // Send user input to backend
    term.onData((data) => {
      socket.emit('terminal:input', { sessionId, data });
    });

    // Create terminal session (AFTER listeners are set up)
    socket.emit('terminal:create', { sessionId, projectId });

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      socket.emit('terminal:destroy', { sessionId });
      socket.off('terminal:output');
      socket.off('terminal:created');
      socket.off('terminal:error');
      term.dispose();
    };
  }, [socket, projectId, sessionId]);

  return (
    <div className={`flex flex-col h-full bg-zinc-950/80 backdrop-blur-xl border-l border-white/5 relative shadow-2xl ${className}`}>
      {/* Scanline Effect */}
      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-0 bg-[length:100%_2px,3px_100%] opacity-20" />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-4 py-3 border-b border-white/5 bg-zinc-900/50 overflow-hidden whitespace-nowrap">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 bg-blue-500/20 blur-sm rounded-full" />
            <Command className="h-4 w-4 text-blue-500 relative z-10" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold tracking-[0.2em] text-zinc-500 uppercase">Interactive Shell</span>
            <span className="text-xs font-bold tracking-widest text-zinc-200 uppercase font-mono">Terminal</span>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-zinc-900/80 rounded-full px-2 py-1 border border-white/5">
          <div className={`h-1.5 w-1.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-yellow-500 animate-pulse'}`} />
          <span className={`text-[10px] font-mono uppercase ${isConnected ? 'text-emerald-500' : 'text-yellow-500'}`}>
            {isConnected ? 'CONNECTED' : 'CONNECTING'}
          </span>
        </div>
      </div>

      {/* Terminal container */}
      <div className="relative z-10 flex-1 overflow-hidden p-4 bg-[#09090b]">
        <div 
          ref={terminalRef} 
          className="h-full w-full"
        />
      </div>
    </div>
  );
}
