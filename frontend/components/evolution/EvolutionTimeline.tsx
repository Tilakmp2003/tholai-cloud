'use client';

import React, { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';

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



export function EvolutionTimeline({ 
  data,
  loading = false
}: { 
  data: TimelineDataPoint[];
  loading?: boolean;
}) {
  const [selectedGeneration, setSelectedGeneration] = useState<TimelineDataPoint | null>(null);
  const [velocity, setVelocity] = useState<{
    currentVelocity: number;
    trend: string;
    projectedFitness: number;
  } | null>(null);

  useEffect(() => {
    if (data.length >= 2) {
      const recent = data.slice(-5);
      const first = recent[0];
      const last = recent[recent.length - 1];
      const diff = last.avgFitness - first.avgFitness;
      const velocity = diff / recent.length;
      
      setVelocity({
        currentVelocity: velocity,
        trend: velocity > 0.01 ? 'accelerating' : velocity > 0 ? 'stable' : 'slowing',
        projectedFitness: last.avgFitness + (velocity * 10)
      });
    }
  }, [data]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    const genData = data.find(d => d.generationNumber === label);
    if (!genData) return null;

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-gray-900/95 backdrop-blur-sm border border-gray-700 rounded-lg p-4 shadow-xl"
      >
        <div className="text-sm font-bold text-white mb-2">
          Generation {label}
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <div className="text-gray-400">Avg Fitness:</div>
          <div className="text-green-400 font-mono">{genData.avgFitness.toFixed(3)}</div>
          
          <div className="text-gray-400">Max Fitness:</div>
          <div className="text-blue-400 font-mono">{genData.maxFitness.toFixed(3)}</div>
          
          <div className="text-gray-400">Population:</div>
          <div className="text-white font-mono">{genData.populationSize}</div>
          
          <div className="text-gray-400">Survival Rate:</div>
          <div className={`font-mono ${genData.survivalRate > 0.7 ? 'text-green-400' : 'text-yellow-400'}`}>
            {(genData.survivalRate * 100).toFixed(1)}%
          </div>
          
          <div className="text-gray-400">Top Agent:</div>
          <div className="text-purple-400">{genData.topAgentName}</div>
        </div>
        
        {genData.keyInnovations.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-700">
            <div className="text-xs text-gray-400 mb-1">Innovations:</div>
            {genData.keyInnovations.map((innovation, i) => (
              <div key={i} className="text-xs text-yellow-300 flex items-center gap-1">
                <span>💡</span> {innovation}
              </div>
            ))}
          </div>
        )}
      </motion.div>
    );
  };

  if (loading) {
    return (
      <div className="h-96 w-full bg-gray-900/50 rounded-xl flex items-center justify-center">
        <div className="animate-pulse flex items-center gap-3">
          <div className="w-4 h-4 bg-blue-500 rounded-full animate-bounce" />
          <span className="text-gray-400">Loading evolution data...</span>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="h-96 w-full bg-gray-900/50 rounded-xl flex flex-col items-center justify-center border border-gray-800 border-dashed">
        <div className="text-4xl mb-4">🧬</div>
        <h3 className="text-xl font-bold text-white mb-2">No Evolution Data Yet</h3>
        <p className="text-gray-400 text-center max-w-md">
          The system is currently running its first generation. 
          Check back soon to see the evolution timeline populate.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Velocity Header */}
      {velocity && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between bg-gray-900/50 rounded-lg p-4 border border-gray-800"
        >
          <div>
            <h3 className="text-lg font-bold text-white">Evolution Velocity</h3>
            <p className="text-sm text-gray-400">
              {velocity.trend === 'accelerating' && '🚀 Agents are improving faster!'}
              {velocity.trend === 'stable' && '📈 Steady improvement'}
              {velocity.trend === 'slowing' && '⚠️ Evolution is plateauing'}
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-blue-400">
              +{(velocity.currentVelocity * 100).toFixed(2)}%
            </div>
            <div className="text-xs text-gray-500">per generation</div>
          </div>
        </motion.div>
      )}

      {/* Main Chart */}
      <div className="h-96 w-full bg-gray-900/80 backdrop-blur-sm p-6 rounded-xl border border-gray-800">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} onClick={(e) => {
            if (e?.activePayload?.[0]) {
              setSelectedGeneration(data.find(d => d.generationNumber === e.activeLabel) || null);
            }
          }}>
            <defs>
              <linearGradient id="fitnessGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="rangeGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10B981" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            
            <XAxis 
              dataKey="generationNumber" 
              stroke="#9CA3AF"
              tick={{ fill: '#9CA3AF', fontSize: 12 }}
              label={{ value: 'Generation', position: 'bottom', fill: '#9CA3AF' }}
            />
            
            <YAxis 
              stroke="#9CA3AF"
              tick={{ fill: '#9CA3AF', fontSize: 12 }}
              domain={[0, 1]}
              label={{ value: 'Fitness', angle: -90, position: 'left', fill: '#9CA3AF' }}
            />
            
            <Tooltip content={<CustomTooltip />} />
            
            <Legend 
              wrapperStyle={{ paddingTop: '20px' }}
              formatter={(value) => <span className="text-gray-300">{value}</span>}
            />

            {/* Fitness range (min to max) */}
            <Area
              type="monotone"
              dataKey="maxFitness"
              stroke="none"
              fill="url(#rangeGradient)"
              name="Fitness Range"
            />
            
            {/* Average fitness line */}
            <Area
              type="monotone"
              dataKey="avgFitness"
              stroke="#3B82F6"
              strokeWidth={2}
              fill="url(#fitnessGradient)"
              name="Average Fitness"
              animationDuration={1000}
            />
            
            {/* Max fitness line */}
            <Line
              type="monotone"
              dataKey="maxFitness"
              stroke="#10B981"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              name="Best Agent"
            />

            {/* Reference line for target */}
            <ReferenceLine 
              y={0.8} 
              stroke="#F59E0B" 
              strokeDasharray="10 5"
              label={{ value: 'Target', fill: '#F59E0B', fontSize: 12 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Generation Details Panel */}
      <AnimatePresence>
        {selectedGeneration && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-gray-900/50 rounded-lg p-4 border border-gray-800"
          >
            <div className="flex justify-between items-start mb-4">
              <h4 className="text-lg font-bold text-white">
                Generation {selectedGeneration.generationNumber} Details
              </h4>
              <button 
                onClick={() => setSelectedGeneration(null)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            
            {/* Specialization Distribution */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(selectedGeneration.specializationDistribution).map(([spec, value]) => (
                <div key={spec} className="bg-gray-800/50 rounded-lg p-3">
                  <div className="text-xs text-gray-400 capitalize">{spec}</div>
                  <div className="text-lg font-bold text-blue-400">
                    {(value * 100).toFixed(1)}%
                  </div>
                  <div className="mt-2 h-1 bg-gray-700 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${value * 100}%` }}
                      className="h-full bg-blue-500 rounded-full"
                    />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
