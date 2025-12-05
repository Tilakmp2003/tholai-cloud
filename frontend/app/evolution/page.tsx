'use client';

import React, { useEffect, useState } from 'react';
import { EvolutionTimeline } from '../../components/evolution/EvolutionTimeline';
import { EvolutionFamilyTree } from '../../components/evolution/EvolutionFamilyTree';
import { motion } from 'framer-motion';
import { 
  Dna, 
  Zap, 
  Users, 
  TrendingUp, 
  Activity, 
  GitBranch, 
  Microscope,
  Info
} from 'lucide-react';

interface TimelineDataPoint {
  generationNumber: number;
  timestamp: Date;
  avgFitness: number;
  maxFitness: number;
  minFitness: number;
  populationSize: number;
  survivalRate: number;
  specializationDistribution: Record<string, number>;
  keyInnovations: string[];
  topAgentName: string;
}

export default function EvolutionPage() {
  const [data, setData] = useState<TimelineDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    totalGenerations: 0,
    activePopulation: 0,
    innovationRate: 'Low',
    avgFitnessTrend: 0
  });

  // In a real app, this would come from context or URL
  const projectId = 'default-project-id';

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      // Fetch simple stats from working API
      const statsRes = await fetch(`http://localhost:4000/api/evolution/stats`);
      if (statsRes.ok) {
        const stats = await statsRes.json();
        setMetrics({
          totalGenerations: stats.totalGenerations || 0,
          activePopulation: stats.activePopulation || 0,
          innovationRate: stats.innovationRate || 'Low',
          avgFitnessTrend: stats.avgFitness || 0
        });

        // Generate timeline data from stats (simulated for now)
        if (stats.activePopulation > 0) {
          const genData: TimelineDataPoint = {
            generationNumber: stats.totalGenerations,
            timestamp: new Date(),
            avgFitness: stats.avgFitness || 0,
            maxFitness: stats.maxFitness || 0,
            minFitness: 0,
            populationSize: stats.activePopulation,
            survivalRate: parseFloat(stats.successRate) / 100 || 0.5,
            specializationDistribution: stats.roleDistribution || {},
            keyInnovations: [],
            topAgentName: 'Top Agent'
          };
          setData(prev => {
            const newData = [...prev, genData].slice(-50); // Keep last 50 points
            return newData;
          });
        }
      }
    } catch (error) {
      console.error('Failed to fetch evolution data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white selection:bg-blue-500/30">
      {/* Ambient Background */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-black to-black pointer-events-none" />
      
      <div className="relative max-w-[1600px] mx-auto p-8 space-y-12">
        
        {/* Hero Section */}
        <header className="relative z-10 space-y-4 border-b border-white/10 pb-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 text-blue-400 font-mono text-sm tracking-wider uppercase"
          >
            <Dna className="w-4 h-4" />
            <span>Genetic Optimization Engine</span>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex justify-between items-end"
          >
            <div>
              <h1 className="text-5xl md:text-7xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-white/50">
                Evolutionary Intelligence
              </h1>
              <p className="text-xl text-gray-400 mt-4 max-w-2xl font-light leading-relaxed">
                Witness the real-time emergence of sophisticated agent behaviors through 
                Darwinian selection, crossover, and mutation.
              </p>
            </div>
            
            <div className="hidden md:flex items-center gap-4 bg-white/5 backdrop-blur-md border border-white/10 px-6 py-3 rounded-full">
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
                <span className="text-sm font-medium text-emerald-400">System Active</span>
              </div>
              <div className="h-4 w-px bg-white/10" />
              <span className="text-sm text-gray-400 font-mono">v2.4.0-alpha</span>
            </div>
          </motion.div>
        </header>

        {/* Metrics Grid */}
        <section className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <MetricCard 
            label="Total Generations"
            value={metrics.totalGenerations.toString()}
            subValue="Evolution Cycles"
            icon={GitBranch}
            trend="+1"
            color="blue"
          />
          <MetricCard 
            label="Active Population"
            value={metrics.activePopulation.toString()}
            subValue="Living Agents"
            icon={Users}
            trend={metrics.activePopulation > 0 ? "Stable" : "Initializing"}
            color="emerald"
          />
          <MetricCard 
            label="Innovation Rate"
            value={metrics.innovationRate}
            subValue="Pattern Discovery"
            icon={Zap}
            trend="Dynamic"
            color="purple"
          />
          <MetricCard 
            label="Fitness Velocity"
            value={metrics.avgFitnessTrend > 0 ? `+${(metrics.avgFitnessTrend * 100).toFixed(2)}%` : "0%"}
            subValue="Improvement / Gen"
            icon={TrendingUp}
            trend={metrics.avgFitnessTrend > 0 ? "Improving" : "Plateau"}
            color="orange"
          />
        </section>

        {/* Main Visualization */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-white flex items-center gap-3">
              <Activity className="w-6 h-6 text-blue-400" />
              Fitness Landscape
            </h2>
            <div className="flex gap-3">
              <LegendItem color="bg-blue-500" label="Avg Fitness" />
              <LegendItem color="bg-emerald-500" label="Max Fitness" />
            </div>
          </div>
          
          <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-6 backdrop-blur-sm shadow-2xl">
            <EvolutionTimeline data={data} loading={loading} />
          </div>
        </section>

        {/* Educational Content */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-8 border-t border-white/10">
          <div className="lg:col-span-1 space-y-4">
            <h3 className="text-2xl font-semibold text-white flex items-center gap-3">
              <Microscope className="w-6 h-6 text-purple-400" />
              The Mechanism
            </h3>
            <p className="text-gray-400 leading-relaxed">
              Our evolutionary engine mimics biological evolution to optimize agent prompts and parameters. 
              Agents that successfully complete tasks are selected to reproduce, passing their "genes" 
              (configurations) to the next generation.
            </p>
          </div>
          
          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-6">
            <InfoCard 
              title="Selection"
              description="High-performing agents are chosen via tournament selection based on fitness scores derived from task success and efficiency."
              delay={0.1}
            />
            <InfoCard 
              title="Crossover"
              description="Genetic material (system prompts, risk tolerance) from two parents is combined to create offspring with potentially superior traits."
              delay={0.2}
            />
            <InfoCard 
              title="Mutation"
              description="Random variations are introduced to agent genomes to prevent stagnation and discover novel behavioral patterns."
              delay={0.3}
            />
          </div>
        </section>

        {/* Family Tree Section */}
        <section className="space-y-6 pt-8 border-t border-white/10">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-white flex items-center gap-3">
              <GitBranch className="w-6 h-6 text-emerald-400" />
              Agent Lineage Tree
            </h2>
            <div className="text-sm text-gray-400">
              Visualizing ancestry and descent
            </div>
          </div>
          
          <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-6 backdrop-blur-sm shadow-2xl overflow-hidden">
            <EvolutionFamilyTree projectId={projectId} />
          </div>
        </section>

      </div>
    </div>
  );
}

// --- Subcomponents ---

function MetricCard({ label, value, subValue, icon: Icon, trend, color }: any) {
  const colors: any = {
    blue: "from-blue-500/20 to-blue-600/5 text-blue-400 border-blue-500/20",
    emerald: "from-emerald-500/20 to-emerald-600/5 text-emerald-400 border-emerald-500/20",
    purple: "from-purple-500/20 to-purple-600/5 text-purple-400 border-purple-500/20",
    orange: "from-orange-500/20 to-orange-600/5 text-orange-400 border-orange-500/20",
  };

  return (
    <motion.div 
      whileHover={{ y: -5 }}
      className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br ${colors[color]} p-6 backdrop-blur-sm`}
    >
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-xl bg-white/5 ${colors[color].split(" ")[2]}`}>
          <Icon className="w-6 h-6" />
        </div>
        <span className={`text-xs font-mono px-2 py-1 rounded-full bg-white/5 border border-white/10 ${colors[color].split(" ")[2]}`}>
          {trend}
        </span>
      </div>
      <div className="space-y-1">
        <h3 className="text-3xl font-bold text-white tracking-tight">{value}</h3>
        <p className="text-sm text-gray-400 font-medium">{label}</p>
        <p className="text-xs text-gray-500">{subValue}</p>
      </div>
    </motion.div>
  );
}

function LegendItem({ color, label }: { color: string, label: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-gray-300">
      <div className={`w-2 h-2 rounded-full ${color}`} />
      {label}
    </div>
  );
}

function InfoCard({ title, description, delay }: any) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay }}
      className="bg-zinc-900/50 border border-white/5 p-6 rounded-xl hover:bg-zinc-900/80 transition-colors"
    >
      <h4 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
        <Info className="w-4 h-4 text-gray-500" />
        {title}
      </h4>
      <p className="text-sm text-gray-400 leading-relaxed">
        {description}
      </p>
    </motion.div>
  );
}
