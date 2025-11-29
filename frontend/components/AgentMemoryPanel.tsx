'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { 
  Brain, 
  Lightbulb, 
  AlertTriangle,
  Code,
  BookOpen,
  TrendingUp,
  Loader2
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface MemoryStats {
  totalMemories: number;
  byType: Record<string, number>;
  byCategory: Record<string, number>;
  avgSuccessRate: number;
}

export function AgentMemoryPanel() {
  const { data: stats, isLoading } = useQuery<MemoryStats>({
    queryKey: ['memory-stats'],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/memory/stats`);
      return res.data;
    },
    refetchInterval: 30000
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'SUCCESS_PATTERN': return <Lightbulb className="h-4 w-4 text-emerald-400" />;
      case 'FAILURE_LESSON': return <AlertTriangle className="h-4 w-4 text-red-400" />;
      case 'CODE_SNIPPET': return <Code className="h-4 w-4 text-blue-400" />;
      case 'BEST_PRACTICE': return <BookOpen className="h-4 w-4 text-purple-400" />;
      default: return <Brain className="h-4 w-4 text-zinc-400" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'SUCCESS_PATTERN': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'FAILURE_LESSON': return 'bg-red-500/10 text-red-400 border-red-500/30';
      case 'CODE_SNIPPET': return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      case 'BEST_PRACTICE': return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
      default: return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30';
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/50 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (!stats || stats.totalMemories === 0) {
    return (
      <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/50 text-center space-y-4">
        <Brain className="h-12 w-12 mx-auto text-zinc-600" />
        <div>
          <h3 className="font-medium text-white">No Memories Yet</h3>
          <p className="text-sm text-zinc-500 mt-1">
            Agents will learn from completed tasks
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-indigo-400" />
            <h3 className="font-medium text-white">Agent Memory</h3>
          </div>
          <Badge variant="outline" className="text-xs">
            {stats.totalMemories} memories
          </Badge>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Success Rate */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Average Success Rate
            </span>
            <span className="text-emerald-400 font-medium">
              {(stats.avgSuccessRate * 100).toFixed(1)}%
            </span>
          </div>
          <Progress value={stats.avgSuccessRate * 100} className="h-2" />
        </div>

        {/* Memory Types */}
        <div className="space-y-3">
          <h4 className="text-xs text-zinc-500 uppercase tracking-wider">By Type</h4>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(stats.byType).map(([type, count]) => (
              <motion.div
                key={type}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`p-3 rounded-lg border ${getTypeColor(type)}`}
              >
                <div className="flex items-center gap-2">
                  {getTypeIcon(type)}
                  <span className="text-xs font-medium truncate">
                    {type.replace(/_/g, ' ')}
                  </span>
                </div>
                <p className="text-2xl font-bold mt-2">{count}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Categories */}
        <div className="space-y-3">
          <h4 className="text-xs text-zinc-500 uppercase tracking-wider">By Category</h4>
          <ScrollArea className="h-[150px]">
            <div className="space-y-2">
              {Object.entries(stats.byCategory)
                .sort((a, b) => b[1] - a[1])
                .map(([category, count]) => (
                  <div
                    key={category}
                    className="flex items-center justify-between p-2 rounded-lg bg-zinc-800/30"
                  >
                    <span className="text-sm text-zinc-300 capitalize">{category}</span>
                    <Badge variant="outline" className="text-xs">
                      {count}
                    </Badge>
                  </div>
                ))}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
