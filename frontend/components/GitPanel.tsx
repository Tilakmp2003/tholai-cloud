'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  GitBranch, 
  GitCommit, 
  GitMerge,
  RotateCcw,
  Plus,
  Check,
  Clock,
  User,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import axios from 'axios';
import { toast } from 'sonner';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface GitPanelProps {
  projectId: string;
}

interface CommitInfo {
  hash: string;
  message: string;
  author: string;
  date: string;
}

interface BranchInfo {
  name: string;
  isDefault: boolean;
  lastCommit: string;
}

export function GitPanel({ projectId }: GitPanelProps) {
  const queryClient = useQueryClient();
  const [newBranchName, setNewBranchName] = useState('');
  const [showNewBranch, setShowNewBranch] = useState(false);

  // Fetch commit history
  const { data: history, isLoading: historyLoading } = useQuery<CommitInfo[]>({
    queryKey: ['git-history', projectId],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/git/${projectId}/history`);
      return res.data;
    },
    refetchInterval: 10000
  });

  // Fetch branches
  const { data: branches, isLoading: branchesLoading } = useQuery<BranchInfo[]>({
    queryKey: ['git-branches', projectId],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/git/${projectId}/branches`);
      return res.data;
    }
  });

  // Initialize repo mutation
  const initMutation = useMutation({
    mutationFn: async () => {
      const res = await axios.post(`${API_URL}/api/git/${projectId}/init`);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Git repository initialized');
      queryClient.invalidateQueries({ queryKey: ['git-history', projectId] });
      queryClient.invalidateQueries({ queryKey: ['git-branches', projectId] });
    },
    onError: () => {
      toast.error('Failed to initialize repository');
    }
  });

  // Create branch mutation
  const createBranchMutation = useMutation({
    mutationFn: async (branchName: string) => {
      const res = await axios.post(`${API_URL}/api/git/${projectId}/branch`, { branchName });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Branch created');
      setNewBranchName('');
      setShowNewBranch(false);
      queryClient.invalidateQueries({ queryKey: ['git-branches', projectId] });
    },
    onError: () => {
      toast.error('Failed to create branch');
    }
  });

  // Rollback mutation
  const rollbackMutation = useMutation({
    mutationFn: async (commitHash: string) => {
      const res = await axios.post(`${API_URL}/api/git/${projectId}/rollback`, { commitHash });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Rollback successful');
      queryClient.invalidateQueries({ queryKey: ['git-history', projectId] });
    },
    onError: () => {
      toast.error('Failed to rollback');
    }
  });

  const handleCreateBranch = () => {
    if (!newBranchName.trim()) return;
    createBranchMutation.mutate(newBranchName);
  };

  // No history means repo might not be initialized
  if (!historyLoading && (!history || history.length === 0)) {
    return (
      <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/50 text-center space-y-4">
        <GitBranch className="h-12 w-12 mx-auto text-zinc-600" />
        <div>
          <h3 className="font-medium text-white">No Git Repository</h3>
          <p className="text-sm text-zinc-500 mt-1">
            Initialize a git repository to track changes
          </p>
        </div>
        <Button
          onClick={() => initMutation.mutate()}
          disabled={initMutation.isPending}
          className="bg-indigo-600 hover:bg-indigo-500"
        >
          {initMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <GitBranch className="h-4 w-4 mr-2" />
          )}
          Initialize Repository
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
      <Tabs defaultValue="history" className="w-full">
        <div className="px-4 pt-4 border-b border-zinc-800">
          <TabsList className="bg-zinc-800/50">
            <TabsTrigger value="history" className="text-xs">
              <GitCommit className="h-3 w-3 mr-1" />
              History
            </TabsTrigger>
            <TabsTrigger value="branches" className="text-xs">
              <GitBranch className="h-3 w-3 mr-1" />
              Branches
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="history" className="m-0">
          <ScrollArea className="h-[400px]">
            <div className="p-4 space-y-2">
              {historyLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
                </div>
              ) : (
                <AnimatePresence mode="popLayout">
                  {history?.map((commit, index) => (
                    <motion.div
                      key={commit.hash}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="group relative flex items-start gap-3 p-3 rounded-lg hover:bg-zinc-800/50 transition-colors"
                    >
                      {/* Timeline line */}
                      {index < (history?.length || 0) - 1 && (
                        <div className="absolute left-[22px] top-10 bottom-0 w-px bg-zinc-800" />
                      )}
                      
                      {/* Commit dot */}
                      <div className="relative z-10 flex-shrink-0 w-5 h-5 rounded-full bg-zinc-800 border-2 border-indigo-500 flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                      </div>
                      
                      {/* Commit info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-zinc-200 truncate">
                          {commit.message}
                        </p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500">
                          <span className="font-mono text-indigo-400">{commit.hash}</span>
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {commit.author}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {commit.date}
                          </span>
                        </div>
                      </div>
                      
                      {/* Rollback button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => rollbackMutation.mutate(commit.hash)}
                        disabled={rollbackMutation.isPending}
                        className="opacity-0 group-hover:opacity-100 transition-opacity h-7 px-2"
                      >
                        <RotateCcw className="h-3 w-3 mr-1" />
                        Rollback
                      </Button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="branches" className="m-0">
          <div className="p-4 space-y-4">
            {/* New branch input */}
            <AnimatePresence>
              {showNewBranch ? (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex gap-2"
                >
                  <input
                    type="text"
                    value={newBranchName}
                    onChange={(e) => setNewBranchName(e.target.value)}
                    placeholder="feature/new-branch"
                    className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateBranch()}
                  />
                  <Button
                    onClick={handleCreateBranch}
                    disabled={createBranchMutation.isPending || !newBranchName.trim()}
                    size="sm"
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                </motion.div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowNewBranch(true)}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  New Branch
                </Button>
              )}
            </AnimatePresence>

            {/* Branch list */}
            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {branchesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
                  </div>
                ) : (
                  branches?.map((branch) => (
                    <div
                      key={branch.name}
                      className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/30 hover:bg-zinc-800/50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <GitBranch className="h-4 w-4 text-zinc-500" />
                        <span className="text-sm text-zinc-200">{branch.name}</span>
                        {branch.isDefault && (
                          <Badge variant="outline" className="text-[10px] h-4">
                            default
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs font-mono text-zinc-500">
                        {branch.lastCommit}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
