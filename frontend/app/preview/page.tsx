'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { 
  Layout, Smartphone, Tablet, Monitor, RefreshCw, ExternalLink, 
  WifiOff, ChevronLeft, Loader2, Code2, Terminal, ChevronDown, X, Play,
  Globe, Plus, Maximize2, Minimize2, Wifi
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// --- Configuration ---

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface Project {
  id: string;
  name: string;
  status: string;
  workspacePath: string | null;
  devPort: number | null;
  previewStatus: string;
}

type DeviceType = 'mobile' | 'tablet' | 'desktop';

const DEVICE_SIZES = {
  mobile: '375px',
  tablet: '768px',
  desktop: '100%'
};

// --- Main Component ---

export default function PreviewPage() {
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [device, setDevice] = useState<DeviceType>('desktop');
  const [refreshKey, setRefreshKey] = useState(0);
  const [isLoadingIframe, setIsLoadingIframe] = useState(false);

  // Fetch Projects
  const { data: projects, isLoading } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/dashboard/projects`);
      return res.data;
    },
    refetchInterval: 3000,
  });

  const activeProject = projects?.find(p => p.id === selectedProject);
  const isRunning = activeProject?.previewStatus === 'RUNNING' && activeProject?.devPort;
  const previewUrl = isRunning ? `http://localhost:${activeProject.devPort}` : null;

  const handleRefresh = () => {
    setIsLoadingIframe(true);
    setRefreshKey(prev => prev + 1);
    // Reset loading state after a delay (fallback if onLoad doesn't fire)
    setTimeout(() => setIsLoadingIframe(false), 2000);
  };

  // Poll for logs
  const { data: logs } = useQuery({
    queryKey: ['project-logs', activeProject?.id],
    queryFn: async () => {
      if (!activeProject?.id) return [];
      const res = await axios.get(`/api/workspace/${activeProject.id}/logs`);
      return res.data.logs as string[];
    },
    enabled: !!activeProject && Boolean(isRunning),
    refetchInterval: 1000
  });

  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, isTerminalOpen]);

  return (
    <div className="h-screen bg-zinc-950 text-zinc-50 font-sans selection:bg-emerald-500/30 overflow-hidden flex flex-col relative">
      {/* Perspective Grid Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent pointer-events-none" />

      {/* Header / Control Deck */}
      <header className="relative z-20 flex-none h-14 border-b border-white/5 bg-zinc-950/80 backdrop-blur-md flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm font-mono text-zinc-400">
            <Layout className="h-4 w-4 text-emerald-500" />
            <span className="font-bold tracking-wider text-zinc-200">PREVIEW_HUB</span>
            {activeProject && (
              <>
                <span className="text-zinc-700">/</span>
                <span className="text-emerald-400">{activeProject?.name}</span>
                <Badge variant="outline" className="ml-2 h-5 text-[10px] border-emerald-500/30 text-emerald-400 bg-emerald-500/5">
                  main
                </Badge>
              </>
            )}
          </div>
        </div>

        {/* Device Toggles or Status Badge */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center">
          {activeProject ? (
            <div className="flex items-center p-1 rounded-lg bg-zinc-900 border border-white/5 shadow-inner">
              <DeviceToggle icon={Smartphone} active={device === 'mobile'} onClick={() => setDevice('mobile')} label="Mobile" />
              <DeviceToggle icon={Tablet} active={device === 'tablet'} onClick={() => setDevice('tablet')} label="Tablet" />
              <DeviceToggle icon={Monitor} active={device === 'desktop'} onClick={() => setDevice('desktop')} label="Desktop" />
            </div>
          ) : (
            <Badge variant="outline" className="h-7 bg-red-500/5 text-red-400 border-red-500/20 font-mono tracking-wider animate-pulse">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 mr-2" />
              OFFLINE
            </Badge>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {activeProject && (
            <>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-white" onClick={handleRefresh}>
                      <RefreshCw className={cn("h-4 w-4", isLoadingIframe && "animate-spin")} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Refresh Preview</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-white" onClick={() => window.open(previewUrl || '', '_blank')}>
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Open in New Tab</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </>
          )}
        </div>
      </header>

      {/* Main Viewport */}
      <div className="flex-1 relative flex flex-col overflow-hidden">
        
        {/* Project Selector (if none selected) */}
        <AnimatePresence mode="wait">
          {!selectedProject ? (
            <ProjectSelector projects={projects || []} onSelect={setSelectedProject} />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 overflow-hidden relative perspective-1000 min-h-0">
              
              {/* Back Button */}
              <div className="absolute top-4 left-6 z-30">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-zinc-500 hover:text-zinc-300 gap-2"
                  onClick={() => setSelectedProject(null)}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back to Hub
                </Button>
              </div>

              {/* The Holographic Browser Window */}
              <motion.div
                layout
                initial={{ opacity: 0, scale: 0.9, rotateX: 5 }}
                animate={{ opacity: 1, scale: 1, rotateX: 0 }}
                transition={{ type: "spring", stiffness: 100, damping: 20 }}
                style={{ width: DEVICE_SIZES[device] }}
                className={cn(
                  "relative flex flex-col rounded-xl overflow-hidden border border-white/10 bg-zinc-950 shadow-2xl ring-1 ring-white/10 transition-all duration-500 ease-spring",
                  // Height constraints
                  "h-full max-h-[85vh]",
                  // Width constraints
                  device === 'mobile' ? "max-w-[375px]" : device === 'tablet' ? "max-w-[768px]" : "w-full max-w-[1400px]"
                )}
              >
                {/* Browser Chrome */}
                <div className="h-10 bg-zinc-900/90 backdrop-blur-md border-b border-white/5 flex items-center px-4 gap-4 shrink-0 z-10 relative">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/20 border border-red-500/50" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/20 border border-yellow-500/50" />
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/20 border border-emerald-500/50" />
                  </div>
                  
                  {/* URL Pill */}
                  <div className="flex-1 flex justify-center">
                    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-black/50 border border-white/5 text-[10px] font-mono text-zinc-400 min-w-[200px] justify-center shadow-inner">
                      {isRunning ? (
                        <>
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                          <span className="text-emerald-400">localhost:{activeProject?.devPort}</span>
                        </>
                      ) : (
                        <>
                          <WifiOff className="h-3 w-3 text-red-400" />
                          <span className="text-zinc-600">offline</span>
                        </>
                      )}
                    </div>
                  </div>
                  
                  <div className="w-12" /> {/* Spacer for balance */}
                </div>

                {/* Content Area - Absolute Lock */}
                <div className="flex-1 relative bg-white isolate w-full min-h-0">
                  {isRunning ? (
                    <>
                      <iframe
                        key={refreshKey}
                        src={previewUrl!}
                        className="absolute inset-0 w-full h-full border-none"
                        title="Live Preview"
                        onLoad={() => setIsLoadingIframe(false)}
                      />
                      {/* Loading Overlay */}
                      <AnimatePresence>
                        {isLoadingIframe && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-10"
                          >
                            <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Edit Code Button */}
                      <div className="absolute bottom-6 right-6 z-50">
                         <Button 
                          className="bg-zinc-900/90 backdrop-blur border border-white/10 text-white hover:bg-emerald-500 hover:border-emerald-400 shadow-2xl gap-2 transition-all"
                          onClick={() => window.location.href = `/workspace?project=${activeProject?.id}`}
                        >
                          <Code2 className="h-4 w-4" />
                          EDIT CODE
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="absolute inset-0">
                      <ZeroState project={activeProject} />
                    </div>
                  )}
                </div>

                {/* Console Drawer Trigger */}
                {isRunning && (
                  <div className="absolute bottom-0 right-0 z-20 p-2">
                     <button 
                      onClick={() => setIsTerminalOpen(!isTerminalOpen)}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-t-lg bg-zinc-900 border-t border-x border-white/10 text-[10px] font-mono text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                    >
                      {isTerminalOpen ? <ChevronDown className="h-3 w-3" /> : <Terminal className="h-3 w-3" />}
                      CONSOLE OUTPUT
                      {logs && logs.length > 0 && (
                        <span className="ml-1 px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                          {logs.length}
                        </span>
                      )}
                    </button>
                  </div>
                )}

                {/* Console Drawer */}
                <AnimatePresence>
                  {isTerminalOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 200, opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="absolute bottom-0 left-0 right-0 bg-zinc-950/95 backdrop-blur border-t border-white/10 z-30 flex flex-col"
                    >
                      <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-zinc-900/50">
                        <span className="text-xs font-mono text-zinc-400">TERMINAL OUTPUT</span>
                        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setIsTerminalOpen(false)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                      <div ref={scrollRef} className="flex-1 overflow-auto p-4 font-mono text-xs space-y-1">
                        {logs?.map((log, i) => (
                          <div key={i} className="text-zinc-300 border-l-2 border-transparent pl-2 hover:border-zinc-700">
                            <span className="text-zinc-500 mr-2">[{new Date().toLocaleTimeString()}]</span>
                            {log}
                          </div>
                        )) || <div className="text-zinc-600 italic">No logs available...</div>}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

              </motion.div>

            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// --- Sub-Components ---

function DeviceToggle({ icon: Icon, active, onClick, label }: { icon: any, active: boolean, onClick: () => void, label: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onClick}
            className={cn(
              "p-1.5 rounded-md transition-all duration-200",
              active ? "bg-zinc-800 text-emerald-400 shadow-sm" : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
            )}
          >
            <Icon className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs bg-zinc-900 border-zinc-800">
          {label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function ProjectSelector({ projects, onSelect }: { projects: Project[], onSelect: (id: string) => void }) {
  const projectsWithWorkspace = projects.filter(p => p.workspacePath);
  const [launchingId, setLaunchingId] = useState<string | null>(null);

  const handleLaunch = (id: string) => {
    setLaunchingId(id);
    setTimeout(() => {
      onSelect(id);
    }, 1200); // 1.2s delay for the "Handshake" animation
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex-1 flex flex-col items-center justify-center p-8 relative"
    >
      {/* Massive Ghost Wireframe */}
      <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none scale-110">
        <div className="w-[90%] h-[80%] border-2 border-dashed border-white rounded-xl flex flex-col">
          <div className="h-16 border-b-2 border-dashed border-white flex items-center px-8 gap-4">
             <div className="w-4 h-4 rounded-full border border-white" />
             <div className="w-4 h-4 rounded-full border border-white" />
             <div className="w-4 h-4 rounded-full border border-white" />
          </div>
          <div className="flex-1 flex items-center justify-center">
             <div className="w-32 h-32 rounded-full border-2 border-dashed border-white animate-[spin_10s_linear_infinite]" />
          </div>
        </div>
      </div>

      <div className="max-w-4xl w-full relative z-10">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-zinc-900 border border-white/5 mb-6 shadow-[0_0_40px_-10px_rgba(16,185,129,0.1)]">
            <Globe className="h-8 w-8 text-emerald-500" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-3 tracking-tight">Global Preview Network</h1>
          <p className="text-zinc-500 max-w-md mx-auto">
            Select an active neural node to establish a visual uplink.
          </p>
        </div>

        {projectsWithWorkspace.length === 0 ? (
          <div className="text-center p-12 border border-dashed border-zinc-800 rounded-xl bg-zinc-900/20 backdrop-blur-sm">
            <p className="text-zinc-600 font-mono text-sm mb-6">NO ACTIVE WORKSPACES DETECTED</p>
            <Button 
              variant="outline" 
              className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300"
              onClick={() => window.location.href = '/'} 
            >
              <Plus className="mr-2 h-4 w-4" />
              Initialize Deployment
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projectsWithWorkspace.map((project) => {
              const isLaunching = launchingId === project.id;
              
              return (
                <motion.div
                  key={project.id}
                  whileHover={!isLaunching ? { scale: 1.02, translateY: -5 } : {}}
                  whileTap={!isLaunching ? { scale: 0.98 } : {}}
                  onClick={() => !isLaunching && handleLaunch(project.id)}
                  className={cn(
                    "group relative cursor-pointer transition-all duration-500",
                    isLaunching ? "scale-105 z-20" : ""
                  )}
                >
                  <div className={cn(
                    "absolute inset-0 rounded-xl blur-xl transition-all duration-500",
                    isLaunching ? "bg-emerald-500/30 opacity-100" : "bg-gradient-to-br from-emerald-500/20 to-indigo-500/20 opacity-0 group-hover:opacity-100"
                  )} />
                  
                  <div className={cn(
                    "relative bg-zinc-900 border rounded-xl p-6 transition-all duration-300 shadow-xl overflow-hidden",
                    isLaunching ? "border-emerald-500 bg-zinc-900/90" : "border-white/10 group-hover:border-emerald-500/50"
                  )}>
                    
                    {/* Handshake Animation Overlay */}
                    <AnimatePresence>
                      {isLaunching && (
                        <motion.div 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="absolute inset-0 bg-emerald-500/10 flex flex-col items-center justify-center z-20 backdrop-blur-[1px]"
                        >
                          <Loader2 className="h-8 w-8 text-emerald-500 animate-spin mb-2" />
                          <span className="text-emerald-400 font-mono text-xs tracking-widest animate-pulse">ESTABLISHING UPLINK...</span>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="flex justify-between items-start mb-4">
                      <div className="p-2 rounded-lg bg-zinc-950 border border-white/5">
                        <Layout className={cn(
                          "h-5 w-5 transition-colors",
                          isLaunching ? "text-emerald-400" : "text-zinc-400 group-hover:text-emerald-400"
                        )} />
                      </div>
                      <Badge variant="outline" className={cn(
                        "text-[10px] border-none transition-colors",
                        project.previewStatus === 'RUNNING' || isLaunching ? "bg-emerald-500/10 text-emerald-400" : "bg-zinc-800 text-zinc-500"
                      )}>
                        {isLaunching ? 'CONNECTING' : project.previewStatus}
                      </Badge>
                    </div>
                    
                    <h3 className="text-lg font-bold text-zinc-200 group-hover:text-white mb-4 transition-colors">{project.name}</h3>
                    
                    {/* Launch Key Button Look */}
                    <div className={cn(
                      "mt-4 py-2 px-3 rounded-lg border flex items-center justify-center gap-2 text-xs font-mono tracking-wider transition-all duration-300",
                      isLaunching 
                        ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                        : "bg-zinc-950 border-white/5 text-zinc-500 group-hover:border-emerald-500/30 group-hover:text-emerald-400 group-hover:bg-emerald-500/5 group-hover:shadow-[0_0_10px_rgba(16,185,129,0.1)]"
                    )}>
                      {isLaunching ? (
                        <>
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          UPLINK ACTIVE
                        </>
                      ) : (
                        <>
                          <Play className="h-3 w-3 fill-current" />
                          INITIALIZE UPLINK
                        </>
                      )}
                    </div>

                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function ZeroState({ project }: { project?: Project }) {
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStart = async () => {
    if (!project) return;
    setIsStarting(true);
    setError(null);
    try {
      const response = await axios.post(`${API_URL}/api/workspace/${project.id}/start`);
      console.log('[Preview] Dev server started:', response.data);
    } catch (e: any) {
      console.error('[Preview] Failed to start dev server:', e);
      const errorMsg = e.response?.data?.details || e.response?.data?.error || e.message || 'Unknown error';
      setError(errorMsg);
      setIsStarting(false);
    }
  };

  // Auto-start if we land here and it's not running
  useEffect(() => {
    if (project && !isStarting && !error) {
      handleStart();
    }
  }, [project, isStarting, error]);

  return (
    <div className="absolute inset-0 bg-zinc-950 flex flex-col items-center justify-center overflow-hidden">
      {/* CRT Scanline Effect */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-10 bg-[length:100%_2px,3px_100%] pointer-events-none" />
      <div className="absolute inset-0 animate-scan pointer-events-none bg-gradient-to-b from-transparent via-emerald-500/5 to-transparent h-[20%] w-full z-20 opacity-20" />

      <div className="relative z-30 flex flex-col items-center text-center p-8 max-w-md">
        <div className="mb-8 relative">
          <div className={`absolute inset-0 blur-xl animate-pulse ${error ? 'bg-red-500/20' : 'bg-emerald-500/20'}`} />
          <WifiOff className={`h-16 w-16 relative z-10 ${error ? 'text-red-500' : 'text-emerald-500'}`} />
        </div>
        
        <h2 className="text-2xl font-bold text-zinc-200 mb-2 tracking-widest uppercase font-mono">
          {error ? 'Connection Failed' : isStarting ? 'Connecting...' : 'Signal Lost'}
        </h2>
        <p className="text-zinc-500 mb-4 font-mono text-xs tracking-wider">
          {error ? 'UPLINK_ERROR // RETRY_AVAILABLE' : isStarting ? 'UPLINK_ESTABLISHING // PLEASE_WAIT' : 'UPLINK_OFFLINE // SYSTEM_STANDBY'}
        </p>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-red-400 font-mono text-xs mb-2">ERROR DETAILS:</p>
            <p className="text-zinc-400 text-xs font-mono break-all">{error}</p>
          </div>
        )}

        <Button 
          onClick={handleStart}
          disabled={isStarting}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-mono tracking-wider px-8 py-6 h-auto border border-emerald-400/30 shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] transition-all"
        >
          {isStarting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              INITIALIZING...
            </>
          ) : error ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              RETRY CONNECTION
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              ESTABLISH CONNECTION
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
