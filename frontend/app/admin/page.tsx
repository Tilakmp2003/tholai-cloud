'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { 
  Shield, 
  DollarSign, 
  Brain, 
  Activity,
  AlertTriangle,
  CheckCircle,
  Pause,
  Play,
  Trash2,
  Plus,
  RefreshCw,
  Lock,
  TrendingUp,
  Users,
  Zap
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import axios from 'axios';
import { toast } from 'sonner';
import { useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function AdminDashboard() {
  const queryClient = useQueryClient();
  const [newPackage, setNewPackage] = useState('');

  // Fetch KPIs
  const { data: kpis, isLoading: kpisLoading } = useQuery({
    queryKey: ['admin-kpis'],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/admin/kpis`);
      return res.data;
    },
    refetchInterval: 10000
  });

  // Fetch allowlist
  const { data: allowlist } = useQuery({
    queryKey: ['safety-allowlist'],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/admin/safety/allowlist`);
      return res.data;
    }
  });

  // Fetch memory retention
  const { data: retention } = useQuery({
    queryKey: ['memory-retention'],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/admin/memory/retention`);
      return res.data;
    }
  });

  // Fetch trace stats
  const { data: traceStats } = useQuery({
    queryKey: ['trace-stats'],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/admin/trace/stats`);
      return res.data;
    }
  });

  // Mutations
  const pauseMutation = useMutation({
    mutationFn: async () => {
      await axios.post(`${API_URL}/api/admin/budget/pause`, { reason: 'Manual pause from admin' });
    },
    onSuccess: () => {
      toast.success('All agents paused');
      queryClient.invalidateQueries({ queryKey: ['admin-kpis'] });
    }
  });

  const resumeMutation = useMutation({
    mutationFn: async () => {
      await axios.post(`${API_URL}/api/admin/budget/resume`);
    },
    onSuccess: () => {
      toast.success('All agents resumed');
      queryClient.invalidateQueries({ queryKey: ['admin-kpis'] });
    }
  });

  const addPackageMutation = useMutation({
    mutationFn: async (packageName: string) => {
      await axios.post(`${API_URL}/api/admin/safety/allowlist`, { packageName });
    },
    onSuccess: () => {
      toast.success('Package added to allowlist');
      setNewPackage('');
      queryClient.invalidateQueries({ queryKey: ['safety-allowlist'] });
    }
  });

  const purgeMutation = useMutation({
    mutationFn: async () => {
      const res = await axios.post(`${API_URL}/api/admin/memory/purge`);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(`Purged ${data.purged} memories, flagged ${data.flagged}`);
      queryClient.invalidateQueries({ queryKey: ['memory-retention'] });
    }
  });

  const verifyTraceMutation = useMutation({
    mutationFn: async () => {
      const res = await axios.get(`${API_URL}/api/admin/trace/verify`);
      return res.data;
    },
    onSuccess: (data) => {
      if (data.valid) {
        toast.success('Trace chain integrity verified');
      } else {
        toast.error(`Integrity errors: ${data.errors.length}`);
      }
    }
  });

  if (kpisLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="h-8 w-8 animate-spin text-zinc-500" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-[1800px] mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium text-white">Admin Dashboard</h1>
          <p className="text-sm text-zinc-500">System monitoring and controls</p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => pauseMutation.mutate()}
            disabled={pauseMutation.isPending}
            className="border-amber-500/30 text-amber-400"
          >
            <Pause className="h-4 w-4 mr-2" />
            Pause All
          </Button>
          <Button
            onClick={() => resumeMutation.mutate()}
            disabled={resumeMutation.isPending}
            className="bg-emerald-600 hover:bg-emerald-500"
          >
            <Play className="h-4 w-4 mr-2" />
            Resume All
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Fix Success Rate"
          value={`${((kpis?.tasks?.fixSuccessRate || 0) * 100).toFixed(1)}%`}
          target="≥65%"
          icon={CheckCircle}
          color={kpis?.tasks?.fixSuccessRate >= 0.65 ? 'emerald' : 'amber'}
        />
        <KPICard
          title="Proposal Acceptance"
          value={`${((kpis?.architect?.proposalAcceptanceRate || 0) * 100).toFixed(0)}%`}
          target="≥80%"
          icon={Brain}
          color="blue"
        />
        <KPICard
          title="Bold Rate"
          value={`${((kpis?.architect?.boldProposalRate || 0) * 100).toFixed(0)}%`}
          subtitle="of accepted"
          icon={TrendingUp}
          color="purple"
        />
        <KPICard
          title="Weekly Cost"
          value={`$${(kpis?.performance?.totalCostWeek || 0).toFixed(2)}`}
          icon={DollarSign}
          color={kpis?.budget?.daily?.percent > 0.8 ? 'red' : 'emerald'}
        />
      </div>

      {/* Main Content */}
      <Tabs defaultValue="safety" className="space-y-6">
        <TabsList className="bg-zinc-900">
          <TabsTrigger value="safety">
            <Shield className="h-4 w-4 mr-2" />
            Safety
          </TabsTrigger>
          <TabsTrigger value="budget">
            <DollarSign className="h-4 w-4 mr-2" />
            Budget
          </TabsTrigger>
          <TabsTrigger value="memory">
            <Brain className="h-4 w-4 mr-2" />
            Memory
          </TabsTrigger>
          <TabsTrigger value="trace">
            <Lock className="h-4 w-4 mr-2" />
            Trace
          </TabsTrigger>
        </TabsList>

        {/* Safety Tab */}
        <TabsContent value="safety">
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="p-6 bg-zinc-900/50 border-zinc-800">
              <h3 className="font-medium text-white mb-4 flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-emerald-400" />
                Package Allowlist
              </h3>
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={newPackage}
                  onChange={(e) => setNewPackage(e.target.value)}
                  placeholder="package-name"
                  className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm"
                />
                <Button
                  size="sm"
                  onClick={() => addPackageMutation.mutate(newPackage)}
                  disabled={!newPackage || addPackageMutation.isPending}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <ScrollArea className="h-[200px]">
                <div className="space-y-1">
                  {allowlist?.slice(0, 20).map((pkg: string) => (
                    <div key={pkg} className="flex items-center justify-between py-1 px-2 rounded bg-zinc-800/50">
                      <span className="text-sm text-zinc-300 font-mono">{pkg}</span>
                    </div>
                  ))}
                  {allowlist?.length > 20 && (
                    <p className="text-xs text-zinc-500 text-center py-2">
                      +{allowlist.length - 20} more
                    </p>
                  )}
                </div>
              </ScrollArea>
            </Card>

            <Card className="p-6 bg-zinc-900/50 border-zinc-800">
              <h3 className="font-medium text-white mb-4 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-400" />
                Safety Status
              </h3>
              <div className="space-y-4">
                <StatusRow label="Package Policy" status="active" />
                <StatusRow label="Command Filter" status="active" />
                <StatusRow label="Path Restrictions" status="active" />
                <StatusRow label="Budget Limits" status={kpis?.budget?.isPaused ? 'paused' : 'active'} />
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* Budget Tab */}
        <TabsContent value="budget">
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="p-6 bg-zinc-900/50 border-zinc-800">
              <h3 className="font-medium text-white mb-4">Daily Budget</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-zinc-400">Spent Today</span>
                    <span className="text-white">
                      ${(kpis?.budget?.daily?.spent || 0).toFixed(2)} / ${(kpis?.budget?.daily?.limit || 50).toFixed(2)}
                    </span>
                  </div>
                  <Progress value={(kpis?.budget?.daily?.percent || 0) * 100} />
                </div>
                <div className="grid grid-cols-3 gap-4 pt-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-white">
                      {((kpis?.budget?.daily?.percent || 0) * 100).toFixed(0)}%
                    </p>
                    <p className="text-xs text-zinc-500">Used</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-emerald-400">
                      ${((kpis?.budget?.daily?.limit || 50) - (kpis?.budget?.daily?.spent || 0)).toFixed(2)}
                    </p>
                    <p className="text-xs text-zinc-500">Remaining</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-zinc-400">
                      ${(kpis?.performance?.totalCostWeek || 0).toFixed(2)}
                    </p>
                    <p className="text-xs text-zinc-500">This Week</p>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-6 bg-zinc-900/50 border-zinc-800">
              <h3 className="font-medium text-white mb-4">Budget Controls</h3>
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-zinc-800/50">
                  <p className="text-sm text-zinc-400 mb-2">Daily Limit</p>
                  <input
                    type="number"
                    defaultValue={50}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-white"
                  />
                </div>
                <div className="p-4 rounded-lg bg-zinc-800/50">
                  <p className="text-sm text-zinc-400 mb-2">Per-Task Limit</p>
                  <input
                    type="number"
                    defaultValue={5}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-white"
                  />
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* Memory Tab */}
        <TabsContent value="memory">
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="p-6 bg-zinc-900/50 border-zinc-800">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-white">Memory Retention</h3>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => purgeMutation.mutate()}
                  disabled={purgeMutation.isPending}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Run Purge
                </Button>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Total Memories</span>
                  <span className="text-white">{kpis?.memory?.totalMemories || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Curated</span>
                  <span className="text-emerald-400">{retention?.totalCurated || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Flagged for Review</span>
                  <span className="text-amber-400">{retention?.totalFlagged || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Avg Success Rate</span>
                  <span className="text-white">
                    {((kpis?.memory?.avgSuccessRate || 0) * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            </Card>

            <Card className="p-6 bg-zinc-900/50 border-zinc-800">
              <h3 className="font-medium text-white mb-4">Flagged Memories</h3>
              <ScrollArea className="h-[200px]">
                {retention?.flagged?.length > 0 ? (
                  <div className="space-y-2">
                    {retention.flagged.map((item: any) => (
                      <div key={item.memoryId} className="p-3 rounded-lg bg-zinc-800/50">
                        <p className="text-sm text-zinc-300">{item.reason}</p>
                        <p className="text-xs text-zinc-500 mt-1">
                          {new Date(item.flaggedAt).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-zinc-500 text-center py-8">
                    No flagged memories
                  </p>
                )}
              </ScrollArea>
            </Card>
          </div>
        </TabsContent>

        {/* Trace Tab */}
        <TabsContent value="trace">
          <Card className="p-6 bg-zinc-900/50 border-zinc-800">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-medium text-white">Trace Immutability</h3>
              <Button
                size="sm"
                onClick={() => verifyTraceMutation.mutate()}
                disabled={verifyTraceMutation.isPending}
              >
                <Lock className="h-4 w-4 mr-2" />
                Verify Integrity
              </Button>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              <div className="p-4 rounded-lg bg-zinc-800/50 text-center">
                <p className="text-3xl font-bold text-white">{traceStats?.length || 0}</p>
                <p className="text-sm text-zinc-500">Chain Length</p>
              </div>
              <div className="p-4 rounded-lg bg-zinc-800/50 text-center">
                <p className="text-sm font-mono text-indigo-400 truncate">
                  {traceStats?.lastHash?.substring(0, 16) || 'N/A'}...
                </p>
                <p className="text-sm text-zinc-500 mt-2">Last Hash</p>
              </div>
              <div className="p-4 rounded-lg bg-zinc-800/50 text-center">
                <p className="text-sm text-zinc-300">
                  {traceStats?.lastTimestamp 
                    ? new Date(traceStats.lastTimestamp).toLocaleString()
                    : 'N/A'}
                </p>
                <p className="text-sm text-zinc-500 mt-2">Last Entry</p>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function KPICard({ title, value, subtitle, target, icon: Icon, color }: any) {
  const colorClasses: Record<string, string> = {
    emerald: 'text-emerald-400',
    amber: 'text-amber-400',
    red: 'text-red-400',
    blue: 'text-blue-400',
    purple: 'text-purple-400'
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/50"
    >
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs text-zinc-500 uppercase tracking-wider">{title}</span>
        <Icon className={`h-5 w-5 ${colorClasses[color]}`} />
      </div>
      <p className={`text-3xl font-bold ${colorClasses[color]}`}>{value}</p>
      {subtitle && <p className="text-xs text-zinc-500 mt-1">{subtitle}</p>}
      {target && <p className="text-xs text-zinc-500 mt-1">Target: {target}</p>}
    </motion.div>
  );
}

function StatusRow({ label, status }: { label: string; status: 'active' | 'paused' | 'error' }) {
  const statusConfig = {
    active: { color: 'bg-emerald-500', text: 'Active' },
    paused: { color: 'bg-amber-500', text: 'Paused' },
    error: { color: 'bg-red-500', text: 'Error' }
  };

  const config = statusConfig[status];

  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-zinc-400">{label}</span>
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${config.color}`} />
        <span className="text-sm text-zinc-300">{config.text}</span>
      </div>
    </div>
  );
}
