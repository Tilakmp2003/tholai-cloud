'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import Editor from '@monaco-editor/react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Folder, FolderOpen, FileCode, FileJson, File, 
  ChevronRight, ChevronDown, Play, Save, ExternalLink, 
  Terminal, Loader2, X, Search, Command, Cpu, Layout, Activity, ChevronLeft
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { LiveTerminal } from '@/components/LiveTerminal';
import dynamic from 'next/dynamic';

// Dynamic import to avoid SSR issues with xterm
const InteractiveTerminal = dynamic(
  () => import('@/components/InteractiveTerminal').then(mod => ({ default: mod.InteractiveTerminal })),
  { ssr: false }
);

// --- Types ---

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'dir';
  children?: FileNode[];
}

interface Project {
  id: string;
  name: string;
  workspacePath: string;
  devPort: number | null;
  previewStatus: string;
}

// --- Icons Map ---

const FileIcon = ({ name, className }: { name: string, className?: string }) => {
  if (name.endsWith('.tsx') || name.endsWith('.ts')) return <FileCode className={cn("text-blue-400", className)} />;
  if (name.endsWith('.css')) return <FileCode className={cn("text-sky-300", className)} />;
  if (name.endsWith('.json')) return <FileJson className={cn("text-yellow-400", className)} />;
  if (name.endsWith('.md')) return <FileCode className={cn("text-purple-400", className)} />;
  return <File className={cn("text-zinc-500", className)} />;
};

// --- Components ---

// 1. Recursive File Tree
const FileTreeItem = ({ node, level, onSelect, selectedPath }: { node: FileNode, level: number, onSelect: (path: string) => void, selectedPath: string | null }) => {
  const [isOpen, setIsOpen] = useState(false);
  const isSelected = selectedPath === node.path;
  const hasChildren = node.type === 'dir' && node.children && node.children.length > 0;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (node.type === 'dir') {
      setIsOpen(!isOpen);
    } else {
      onSelect(node.path);
    }
  };

  return (
    <div>
      <div 
        className={cn(
          "flex items-center py-1 px-2 cursor-pointer select-none transition-colors text-[13px] font-mono border-l border-transparent hover:bg-white/5",
          isSelected ? "bg-white/10 text-emerald-400 border-l-emerald-500" : "text-zinc-400"
        )}
        style={{ paddingLeft: `${level * 12 + 12}px` }}
        onClick={handleClick}
      >
        <span className="mr-1.5 opacity-70">
          {node.type === 'dir' ? (
            isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />
          ) : (
            <div className="w-3" />
          )}
        </span>
        
        <span className="mr-2">
          {node.type === 'dir' ? (
            isOpen ? <FolderOpen className="h-3.5 w-3.5 text-indigo-400" /> : <Folder className="h-3.5 w-3.5 text-indigo-400" />
          ) : (
            <FileIcon name={node.name} className="h-3.5 w-3.5" />
          )}
        </span>
        
        <span className="truncate">{node.name}</span>
      </div>

      <AnimatePresence>
        {isOpen && hasChildren && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            {node.children!.map((child) => (
              <FileTreeItem 
                key={child.path} 
                node={child} 
                level={level + 1} 
                onSelect={onSelect} 
                selectedPath={selectedPath} 
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Main Page Component ---

function WorkspaceContent() {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  const searchParams = useSearchParams();
  const projectId = searchParams.get('project');
  const router = useRouter();
  const queryClient = useQueryClient();

  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [unsavedContent, setUnsavedContent] = useState<string | null>(null);
  const [isTerminalOpen, setIsTerminalOpen] = useState(true);
  const [terminalTab, setTerminalTab] = useState<'logs' | 'interactive'>('interactive');

  // 1. Fetch Project Details
  const { data: project } = useQuery<Project>({
    queryKey: ['project', projectId],
    queryFn: async () => {
      if (!projectId) return null;
      const res = await axios.get(`${API_URL}/api/projects`);
      return res.data.find((p: Project) => p.id === projectId);
    },
    enabled: !!projectId
  });

  // 2. Fetch File Tree
  const { data: fileTree, isLoading: isLoadingTree } = useQuery<FileNode[]>({
    queryKey: ['files', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const res = await axios.get(`${API_URL}/api/workspace/${projectId}/tree`);
      return res.data;
    },
    enabled: !!projectId
  });

  // 3. Fetch File Content
  const { data: fileContent, isLoading: isLoadingContent } = useQuery({
    queryKey: ['content', projectId, selectedFile],
    queryFn: async () => {
      if (!projectId || !selectedFile) return '';
      const res = await axios.get(`${API_URL}/api/workspace/${projectId}/file?path=${selectedFile}`);
      return res.data.content;
    },
    enabled: !!projectId && !!selectedFile
  });

  // 4. Save Mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!projectId || !selectedFile || unsavedContent === null) return;
      await axios.post(`${API_URL}/api/workspace/${projectId}/file`, {
        path: selectedFile,
        content: unsavedContent
      });
    },
    onSuccess: () => {
      toast.success("File saved successfully");
      queryClient.invalidateQueries({ queryKey: ['content', projectId, selectedFile] });
      setUnsavedContent(null);
    }
  });

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        saveMutation.mutate();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [saveMutation]);

  // Sync unsaved content when file changes
  useEffect(() => {
    setUnsavedContent(null);
  }, [selectedFile]);

  // 0. Fetch Projects List for Empty State
  const { data: projects, isLoading: isLoadingProjects } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/projects`);
      return res.data;
    },
    enabled: !projectId
  });

  if (!projectId) {
    return (
      <div className="h-screen bg-zinc-950 flex flex-col items-center justify-center text-zinc-500 font-mono gap-8 p-8">
        <div className="flex flex-col items-center gap-4">
          <div className="w-20 h-20 rounded-3xl bg-zinc-900 border border-dashed border-zinc-800 flex items-center justify-center relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <Layout className="h-10 w-10 text-zinc-700 group-hover:text-indigo-400 transition-colors" />
          </div>
          <div className="text-center">
            <h2 className="text-xl font-bold text-zinc-200 tracking-tight">Select Workspace</h2>
            <p className="text-sm text-zinc-600 mt-1">Choose a project to mount the file system.</p>
          </div>
        </div>

        {isLoadingProjects ? (
          <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-4xl">
            {projects?.map((p) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ scale: 1.02, y: -2 }}
                onClick={() => router.push(`/workspace?project=${p.id}`)}
                className="bg-zinc-900/50 border border-white/5 rounded-xl p-6 cursor-pointer hover:bg-zinc-900 hover:border-indigo-500/30 transition-all group relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ExternalLink className="h-4 w-4 text-indigo-400" />
                </div>
                <h3 className="text-lg font-bold text-zinc-200 mb-2 group-hover:text-indigo-300 transition-colors">{p.name}</h3>
                <div className="flex items-center gap-2 text-xs text-zinc-500 font-mono">
                  <Folder className="h-3 w-3" />
                  <span className="truncate">{p.workspacePath || 'No path set'}</span>
                </div>
                {p.previewStatus === 'RUNNING' && (
                  <div className="absolute bottom-4 right-4 flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-bold text-emerald-500">LIVE</span>
                  </div>
                )}
              </motion.div>
            ))}
            
            {/* Create New Project Card */}
            <motion.div
              whileHover={{ scale: 1.02, y: -2 }}
              onClick={() => router.push('/')} // Redirect to main Command Center
              className="bg-zinc-950 border border-dashed border-zinc-800 rounded-xl p-6 cursor-pointer hover:bg-zinc-900/50 hover:border-zinc-700 transition-all flex flex-col items-center justify-center gap-3 text-zinc-600 hover:text-zinc-400"
            >
              <div className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center">
                <span className="text-2xl font-light">+</span>
              </div>
              <span className="text-sm font-medium">Create New Project</span>
            </motion.div>
          </div>
        )}

        <Button 
          variant="ghost" 
          className="text-zinc-600 hover:text-zinc-400 text-xs mt-8"
          onClick={() => router.push('/preview')}
        >
          Return to Preview Hub
        </Button>
      </div>
    );
  }

  return (
    <div className="h-screen bg-zinc-950 text-zinc-300 font-sans flex flex-col overflow-hidden selection:bg-indigo-500/30">
      
      {/* --- Header Bar --- */}
      <header className="h-12 border-b border-white/5 bg-zinc-950 flex items-center justify-between px-4 shrink-0 z-10">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
            onClick={() => router.push('/workspace')}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2 text-xs font-mono text-zinc-500">
            <Layout className="h-4 w-4 text-indigo-500" />
            <span className="text-zinc-300 font-bold tracking-wider">WORKSPACE</span>
            <span>/</span>
            <span className="text-indigo-400">{project?.name || 'Loading...'}</span>
            {selectedFile && (
              <>
                <span>/</span>
                <span className="text-zinc-300">{selectedFile.split('/').pop()}</span>
              </>
            )}
            {unsavedContent !== null && (
              <div className="w-2 h-2 rounded-full bg-yellow-500 ml-2 animate-pulse" />
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 w-8 p-0 text-zinc-400 hover:text-white"
                  onClick={() => saveMutation.mutate()}
                  disabled={unsavedContent === null || saveMutation.isPending}
                >
                  {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Save (Cmd+S)</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <div className="h-4 w-[1px] bg-white/10 mx-2" />

          <Button 
            size="sm" 
            className="h-7 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 gap-2 text-xs font-mono"
            onClick={() => window.open('/preview', '_blank')}
          >
            <Play className="h-3 w-3 fill-current" />
            PREVIEW
          </Button>
        </div>
      </header>

      {/* --- Main Layout --- */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* 1. Sidebar (File Explorer & Agent Chat) */}
        <div className="w-64 bg-[#18181b] flex flex-col shrink-0 border-r border-white/5">
          {/* Explorer Section */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="h-9 flex items-center px-4 shrink-0">
              <span className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase">Explorer</span>
            </div>
            <ScrollArea className="flex-1">
              <div className="py-2 px-2">
                {isLoadingTree ? (
                  <div className="flex items-center justify-center py-8 text-zinc-600">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    <span className="text-xs font-mono">SCANNING...</span>
                  </div>
                ) : (
                  fileTree?.map(node => (
                    <FileTreeItem 
                      key={node.path} 
                      node={node} 
                      level={0} 
                      onSelect={setSelectedFile} 
                      selectedPath={selectedFile} 
                    />
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Agent Chat Section */}
          <div className="h-64 flex flex-col border-t border-white/5 bg-[#18181b]">
            <div className="h-9 flex items-center px-4 shrink-0 gap-2">
              <span className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase">Agent Chat</span>
            </div>
            <ScrollArea className="flex-1 px-3 pb-3">
              <div className="space-y-4">
                {/* Architect Message */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-purple-500/20 flex items-center justify-center text-[8px] font-bold text-purple-400">A</div>
                    <span className="text-[10px] font-bold text-zinc-400">Architect</span>
                  </div>
                  <div className="bg-zinc-900 rounded-md p-3 border border-white/5 text-[10px] text-zinc-400 font-mono leading-relaxed relative ml-1">
                    <div className="absolute top-0 left-2 -mt-1 w-2 h-2 bg-zinc-900 border-t border-l border-white/5 transform rotate-45"></div>
                    Analyzing requirements for new auth module...
                  </div>
                </div>

                {/* Architect Plan */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-purple-500/20 flex items-center justify-center text-[8px] font-bold text-purple-400">A</div>
                    <span className="text-[10px] font-bold text-zinc-400">Architect</span>
                  </div>
                  <div className="bg-zinc-900 rounded-md p-3 border border-white/5 text-[10px] text-zinc-400 font-mono leading-relaxed relative ml-1">
                    <div className="absolute top-0 left-2 -mt-1 w-2 h-2 bg-zinc-900 border-t border-l border-white/5 transform rotate-45"></div>
                    Plan created. Using JWT + OAuth2 strategy.
                  </div>
                </div>

                {/* Dev Message */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center text-[8px] font-bold text-emerald-400">D</div>
                    <span className="text-[10px] font-bold text-zinc-400">Dev</span>
                  </div>
                  <div className="bg-zinc-900 rounded-md p-3 border border-white/5 text-[10px] text-zinc-400 font-mono leading-relaxed relative ml-1">
                    <div className="absolute top-0 left-2 -mt-1 w-2 h-2 bg-zinc-900 border-t border-l border-white/5 transform rotate-45"></div>
                    Received plan. Starting implementation.
                  </div>
                </div>
              </div>
            </ScrollArea>
          </div>
        </div>

        {/* 2. Editor Surface */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#1e1e1e]">
          {selectedFile ? (
            <>
              {/* Tabs */}
              <div className="h-9 bg-[#18181b] flex items-center px-0 border-b border-black">
                <div className="h-full px-4 flex items-center gap-2 bg-[#1e1e1e] min-w-[150px] border-t-2 border-indigo-500">
                  <FileIcon name={selectedFile} className="h-3.5 w-3.5" />
                  <span className="text-xs text-zinc-300 font-mono truncate">{selectedFile.split('/').pop()}</span>
                  <button 
                    className="ml-auto hover:bg-white/10 rounded p-0.5"
                    onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}
                  >
                    <X className="h-3 w-3 text-zinc-500" />
                  </button>
                </div>
              </div>

              {/* Monaco Editor */}
              <div className="flex-1 relative">
                {isLoadingContent ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-[#1e1e1e]">
                    <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
                  </div>
                ) : (
                  <Editor
                    height="100%"
                    defaultLanguage="typescript"
                    path={selectedFile}
                    defaultValue={fileContent}
                    value={unsavedContent ?? fileContent}
                    onChange={(value) => setUnsavedContent(value || '')}
                    theme="vs-dark"
                    onMount={(editor, monaco) => {
                      // Configure TypeScript to be less strict and suppress common errors
                      monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
                        noSemanticValidation: false,
                        noSyntaxValidation: false,
                        diagnosticCodesToIgnore: [
                          1005, // Expecting ';'
                          2307, // Cannot find module
                          2304, // Cannot find name
                          2339, // Property does not exist
                          2345, // Argument of type is not assignable
                          2741, // Property is missing in type
                          7016, // Could not find declaration file
                        ],
                      });

                      // Set compiler options for more lenient type checking
                      monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
                        target: monaco.languages.typescript.ScriptTarget.Latest,
                        allowNonTsExtensions: true,
                        moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
                        module: monaco.languages.typescript.ModuleKind.ESNext,
                        noEmit: true,
                        esModuleInterop: true,
                        jsx: monaco.languages.typescript.JsxEmit.React,
                        reactNamespace: 'React',
                        allowJs: true,
                        typeRoots: ['node_modules/@types'],
                        skipLibCheck: true,
                        strict: false,
                        noImplicitAny: false,
                      });

                      // Disable validation for JavaScript files
                      monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
                        noSemanticValidation: true,
                        noSyntaxValidation: false,
                      });
                    }}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 13,
                      fontFamily: "'JetBrains Mono', 'Geist Mono', monospace",
                      lineHeight: 1.6,
                      padding: { top: 16 },
                      scrollBeyondLastLine: false,
                      smoothScrolling: true,
                      cursorBlinking: "smooth",
                      cursorSmoothCaretAnimation: "on",
                      renderLineHighlight: "all",
                    }}
                  />
                )}
              </div>
            </>
          ) : (
            /* System Standby (Zero State) */
            <div className="flex-1 flex items-center justify-center bg-[#1e1e1e] relative overflow-hidden">
               <div className="relative z-10 flex flex-col items-center opacity-30">
                 <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mb-4">
                   <Command className="h-8 w-8 text-zinc-500" />
                 </div>
                 <p className="text-zinc-500 font-mono text-xs">Select a file to edit</p>
               </div>
            </div>
          )}
        </div>

      </div>

      {/* 3. Terminal Panel (Bottom) */}
      <div className="h-80 flex flex-col bg-[#18181b] border-t border-black">
        <div className="h-8 flex items-center justify-between px-4 bg-[#18181b]">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-6 text-[10px] font-bold tracking-widest text-zinc-500">
              <span className={cn("cursor-pointer hover:text-zinc-300 transition-colors", terminalTab === 'interactive' && "text-zinc-200")} onClick={() => setTerminalTab('interactive')}>TERMINAL</span>
              <span className={cn("cursor-pointer hover:text-zinc-300 transition-colors", terminalTab === 'logs' && "text-zinc-200")} onClick={() => setTerminalTab('logs')}>OUTPUT</span>
              <span className="cursor-pointer hover:text-zinc-300 transition-colors">DEBUG</span>
              <span className="cursor-pointer hover:text-zinc-300 transition-colors">CONSOLE</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
             <div className="flex items-center gap-2">
               <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
               <span className="text-[10px] font-mono text-zinc-500">Node.js v20.14.0</span>
             </div>
             <div className="h-3 w-[1px] bg-white/5" />
             <ChevronDown 
               className={cn("h-3 w-3 text-zinc-600 cursor-pointer hover:text-zinc-400 transition-transform", !isTerminalOpen && "rotate-180")} 
               onClick={() => setIsTerminalOpen(!isTerminalOpen)}
             />
          </div>
        </div>

        {isTerminalOpen && (
          <div className="flex-1 overflow-hidden bg-[#1e1e1e]">
            {terminalTab === 'logs' ? (
              <LiveTerminal />
            ) : (
              projectId && <InteractiveTerminal projectId={projectId} />
            )}
          </div>
        )}
      </div>

    </div>
  );
}

export default function WorkspacePage() {
  return (
    <React.Suspense fallback={
      <div className="h-screen bg-zinc-950 flex items-center justify-center text-zinc-500 font-mono">
        <Loader2 className="h-6 w-6 animate-spin mr-3" />
        LOADING WORKSPACE...
      </div>
    }>
      <WorkspaceContent />
    </React.Suspense>
  );
}
