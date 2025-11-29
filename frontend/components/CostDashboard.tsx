'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  AlertTriangle,
  Pause,
  Play,
  Settings
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import axios from 'axios';
import { useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface CostDashboardProps {
  projectId?: string;
}

export function CostDashboard({ projectId }: CostDashboardProps) {
  const [budget, setBudget] = useState(10.00); // Default $10 budget
  const [isPaused, setIsPaused] = useState(false);

  // Fetch cost metrics from dashboard
  const { data: metrics } = useQuery({
    queryKey: ['dashboard-metrics'],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/dashboard/metrics`);
      return res.data;
    },
    refetchInterval: 5000
  });

  const totalCost = metrics?.performance?.totalCost || 0;
  const budgetUsed = (totalCost / budget) * 100;
  const isOverBudget = totalCost > budget;
  const isNearBudget = budgetUsed > 80;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-emerald-400" />
          <h3 className="font-medium text-white">Cost Control</h3>
        </div>
        <div className="flex items-center gap-2">
          {isOverBudget && (
            <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Over Budget
            </Badge>
          )}
          {isNearBudget && !isOverBudget && (
            <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
              Near Limit
            </Badge>
          )}
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Main Cost Display */}
        <div className="text-center">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Total Spend</p>
          <motion.p 
            key={totalCost}
            initial={{ scale: 1.1 }}
            animate={{ scale: 1 }}
            className={`text-4xl font-mono font-bold ${
              isOverBudget ? 'text-red-400' : isNearBudget ? 'text-amber-400' : 'text-emerald-400'
            }`}
          >
            ${totalCost.toFixed(4)}
          </motion.p>
          <p className="text-xs text-zinc-500 mt-1">
            of ${budget.toFixed(2)} budget
          </p>
        </div>

        {/* Budget Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-zinc-500">
            <span>Budget Usage</span>
            <span>{Math.min(budgetUsed, 100).toFixed(1)}%</span>
          </div>
          <Progress 
            value={Math.min(budgetUsed, 100)} 
            className={`h-2 ${isOverBudget ? '[&>div]:bg-red-500' : isNearBudget ? '[&>div]:bg-amber-500' : ''}`}
          />
        </div>

        {/* Budget Controls */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-zinc-500 w-20">Budget:</label>
            <div className="flex-1 flex items-center gap-2">
              <input
                type="number"
                value={budget}
                onChange={(e) => setBudget(parseFloat(e.target.value) || 0)}
                step="1"
                min="0"
                className="flex-1 px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
              />
              <span className="text-xs text-zinc-500">USD</span>
            </div>
          </div>

          {/* Pause/Resume */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsPaused(!isPaused)}
            className={`w-full ${isPaused ? 'border-emerald-500/30 text-emerald-400' : 'border-amber-500/30 text-amber-400'}`}
          >
            {isPaused ? (
              <>
                <Play className="h-4 w-4 mr-2" />
                Resume Agents
              </>
            ) : (
              <>
                <Pause className="h-4 w-4 mr-2" />
                Pause All Agents
              </>
            )}
          </Button>
        </div>

        {/* Cost Breakdown */}
        <div className="space-y-2 pt-4 border-t border-zinc-800">
          <p className="text-xs text-zinc-500 uppercase tracking-wider">Breakdown</p>
          <div className="space-y-2">
            <CostRow label="LLM Calls" value={totalCost * 0.85} />
            <CostRow label="Embeddings" value={totalCost * 0.10} />
            <CostRow label="Other" value={totalCost * 0.05} />
          </div>
        </div>
      </div>
    </div>
  );
}

function CostRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-zinc-400">{label}</span>
      <span className="font-mono text-zinc-300">${value.toFixed(4)}</span>
    </div>
  );
}
