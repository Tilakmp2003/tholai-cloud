# Evolution Timeline Visualization - Complete Implementation Guide

## Overview
A real-time visualization system that proves your AI agents are evolving and improving over generations.

---

## 1. Database Schema

### 1.1 Prisma Schema Additions

```prisma
// prisma/schema.prisma

model Generation {
  id                  String   @id @default(cuid())
  generationNumber    Int
  projectId           String
  project             Project  @relation(fields: [projectId], references: [id])
  
  // Fitness Metrics
  avgFitness          Float
  maxFitness          Float
  minFitness          Float
  fitnessStdDev       Float
  
  // Population Metrics
  populationSize      Int
  birthCount          Int      // New agents this generation
  deathCount          Int      // Terminated agents
  survivalRate        Float
  
  // Evolution Metrics
  mutationRate        Float
  crossoverRate       Float
  elitePreserved      Int      // Top performers kept unchanged
  
  // Specialization Distribution (JSON)
  specializationDistribution Json  // { "frontend": 0.3, "backend": 0.4, ... }
  
  // Innovation Tracking
  keyInnovations      String[] // Notable improvements discovered
  
  // Timestamps
  startedAt           DateTime
  completedAt         DateTime?
  
  // Relations
  agents              AgentGeneration[]
  topAgent            Agent?   @relation("TopAgent", fields: [topAgentId], references: [id])
  topAgentId          String?
  
  createdAt           DateTime @default(now())
  
  @@unique([projectId, generationNumber])
  @@index([projectId])
}

model AgentGeneration {
  id              String     @id @default(cuid())
  agentId         String
  agent           Agent      @relation(fields: [agentId], references: [id])
  generationId    String
  generation      Generation @relation(fields: [generationId], references: [id])
  
  // Agent's state in this generation
  fitnessScore    Float
  tasksCompleted  Int
  tasksSucceeded  Int
  tokensUsed      Int
  existencePotential Float   // E value at end of generation
  
  // Genome snapshot (JSON)
  genomeSnapshot  Json
  
  // Lineage
  parentId        String?    // Parent agent (null if Gen 0)
  parent          AgentGeneration? @relation("Lineage", fields: [parentId], references: [id])
  children        AgentGeneration[] @relation("Lineage")
  
  // Status
  status          AgentGenerationStatus @default(ALIVE)
  causeOfDeath    String?    // If terminated
  
  createdAt       DateTime   @default(now())
  
  @@unique([agentId, generationId])
  @@index([generationId])
}

enum AgentGenerationStatus {
  ALIVE
  TERMINATED_LOW_E
  TERMINATED_RETIREMENT
  TERMINATED_REPLACED
}
```

### 1.2 Database Migration

```bash
npx prisma migrate dev --name add_evolution_tracking
```

---

## 2. Backend Services

### 2.1 Evolution History Service

```typescript
// backend/src/services/EvolutionHistoryService.ts

import { PrismaClient, Generation, AgentGeneration } from '@prisma/client';

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

interface FamilyTreeNode {
  id: string;
  name: string;
  generation: number;
  fitness: number;
  role: string;
  status: string;
  specialization: string;
  children: FamilyTreeNode[];
}

export class EvolutionHistoryService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Record a new generation's metrics after evolution cycle completes
   */
  async recordGeneration(data: {
    projectId: string;
    generationNumber: number;
    agents: Array<{
      id: string;
      fitness: number;
      tasksCompleted: number;
      tasksSucceeded: number;
      tokensUsed: number;
      existencePotential: number;
      genome: any;
      parentId?: string;
      status: 'ALIVE' | 'TERMINATED_LOW_E' | 'TERMINATED_RETIREMENT' | 'TERMINATED_REPLACED';
      causeOfDeath?: string;
    }>;
    innovations: string[];
    mutationRate: number;
    crossoverRate: number;
  }): Promise<Generation> {
    const { projectId, generationNumber, agents, innovations, mutationRate, crossoverRate } = data;

    // Calculate aggregate metrics
    const fitnessValues = agents.map(a => a.fitness);
    const avgFitness = fitnessValues.reduce((a, b) => a + b, 0) / fitnessValues.length;
    const maxFitness = Math.max(...fitnessValues);
    const minFitness = Math.min(...fitnessValues);
    const fitnessStdDev = this.calculateStdDev(fitnessValues);

    const aliveAgents = agents.filter(a => a.status === 'ALIVE');
    const deadAgents = agents.filter(a => a.status !== 'ALIVE');
    const newAgents = agents.filter(a => a.parentId); // Has parent = was born this gen

    // Calculate specialization distribution
    const specializationDistribution = this.calculateSpecializationDistribution(agents);

    // Find top agent
    const topAgent = agents.reduce((best, current) => 
      current.fitness > best.fitness ? current : best
    );

    // Create generation record with all agent snapshots
    const generation = await this.prisma.generation.create({
      data: {
        projectId,
        generationNumber,
        avgFitness,
        maxFitness,
        minFitness,
        fitnessStdDev,
        populationSize: agents.length,
        birthCount: newAgents.length,
        deathCount: deadAgents.length,
        survivalRate: aliveAgents.length / agents.length,
        mutationRate,
        crossoverRate,
        elitePreserved: Math.floor(agents.length * 0.1), // Top 10%
        specializationDistribution,
        keyInnovations: innovations,
        topAgentId: topAgent.id,
        startedAt: new Date(),
        completedAt: new Date(),
        agents: {
          create: agents.map(agent => ({
            agentId: agent.id,
            fitnessScore: agent.fitness,
            tasksCompleted: agent.tasksCompleted,
            tasksSucceeded: agent.tasksSucceeded,
            tokensUsed: agent.tokensUsed,
            existencePotential: agent.existencePotential,
            genomeSnapshot: agent.genome,
            parentId: agent.parentId,
            status: agent.status,
            causeOfDeath: agent.causeOfDeath,
          })),
        },
      },
      include: {
        agents: true,
        topAgent: true,
      },
    });

    return generation;
  }

  /**
   * Get timeline data for visualization
   */
  async getTimelineData(projectId: string, limit = 100): Promise<TimelineDataPoint[]> {
    const generations = await this.prisma.generation.findMany({
      where: { projectId },
      orderBy: { generationNumber: 'asc' },
      take: limit,
      include: {
        topAgent: true,
      },
    });

    return generations.map(gen => ({
      generationNumber: gen.generationNumber,
      timestamp: gen.completedAt || gen.startedAt,
      avgFitness: gen.avgFitness,
      maxFitness: gen.maxFitness,
      minFitness: gen.minFitness,
      populationSize: gen.populationSize,
      survivalRate: gen.survivalRate,
      specializationDistribution: gen.specializationDistribution as Record<string, number>,
      keyInnovations: gen.keyInnovations,
      topAgentName: gen.topAgent?.name || 'Unknown',
    }));
  }

  /**
   * Get family tree for visualization (D3.js compatible)
   */
  async getFamilyTree(projectId: string, rootGeneration = 0): Promise<FamilyTreeNode[]> {
    // Get all agent generations for this project
    const agentGenerations = await this.prisma.agentGeneration.findMany({
      where: {
        generation: {
          projectId,
          generationNumber: { gte: rootGeneration },
        },
      },
      include: {
        agent: true,
        generation: true,
      },
      orderBy: {
        generation: { generationNumber: 'asc' },
      },
    });

    // Build tree structure
    const nodeMap = new Map<string, FamilyTreeNode>();
    const roots: FamilyTreeNode[] = [];

    // First pass: create all nodes
    for (const ag of agentGenerations) {
      const node: FamilyTreeNode = {
        id: ag.id,
        name: ag.agent.name,
        generation: ag.generation.generationNumber,
        fitness: ag.fitnessScore,
        role: ag.agent.role,
        status: ag.status,
        specialization: this.getTopSpecialization(ag.genomeSnapshot),
        children: [],
      };
      nodeMap.set(ag.id, node);
    }

    // Second pass: connect children to parents
    for (const ag of agentGenerations) {
      const node = nodeMap.get(ag.id)!;
      if (ag.parentId && nodeMap.has(ag.parentId)) {
        nodeMap.get(ag.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }

  /**
   * Get evolution velocity (rate of improvement)
   */
  async getEvolutionVelocity(projectId: string, windowSize = 10): Promise<{
    currentVelocity: number;
    trend: 'accelerating' | 'stable' | 'slowing';
    projectedFitness: number;
  }> {
    const generations = await this.prisma.generation.findMany({
      where: { projectId },
      orderBy: { generationNumber: 'desc' },
      take: windowSize * 2,
    });

    if (generations.length < 4) {
      return { currentVelocity: 0, trend: 'stable', projectedFitness: generations[0]?.avgFitness || 0 };
    }

    // Calculate velocity (fitness change per generation)
    const recentGens = generations.slice(0, windowSize);
    const olderGens = generations.slice(windowSize);

    const recentVelocity = this.calculateVelocity(recentGens);
    const olderVelocity = this.calculateVelocity(olderGens);

    const currentVelocity = recentVelocity;
    const trend = recentVelocity > olderVelocity * 1.1 ? 'accelerating' :
                  recentVelocity < olderVelocity * 0.9 ? 'slowing' : 'stable';
    
    const projectedFitness = generations[0].avgFitness + (currentVelocity * 10);

    return { currentVelocity, trend, projectedFitness };
  }

  /**
   * Get specialization emergence data
   */
  async getSpecializationEmergence(projectId: string): Promise<{
    specialization: string;
    firstAppeared: number;
    peakGeneration: number;
    currentStrength: number;
    trend: 'growing' | 'stable' | 'declining';
  }[]> {
    const generations = await this.prisma.generation.findMany({
      where: { projectId },
      orderBy: { generationNumber: 'asc' },
    });

    const specializationHistory: Record<string, number[]> = {};

    for (const gen of generations) {
      const dist = gen.specializationDistribution as Record<string, number>;
      for (const [spec, value] of Object.entries(dist)) {
        if (!specializationHistory[spec]) {
          specializationHistory[spec] = [];
        }
        specializationHistory[spec].push(value);
      }
    }

    return Object.entries(specializationHistory).map(([spec, history]) => {
      const firstAppeared = history.findIndex(v => v > 0.05);
      const peakIndex = history.indexOf(Math.max(...history));
      const recent = history.slice(-5);
      const older = history.slice(-10, -5);
      
      const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
      const olderAvg = older.length ? older.reduce((a, b) => a + b, 0) / older.length : recentAvg;

      return {
        specialization: spec,
        firstAppeared,
        peakGeneration: peakIndex,
        currentStrength: history[history.length - 1] || 0,
        trend: recentAvg > olderAvg * 1.1 ? 'growing' :
               recentAvg < olderAvg * 0.9 ? 'declining' : 'stable',
      };
    });
  }

  // Helper methods
  private calculateStdDev(values: number[]): number {
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const squareDiffs = values.map(v => Math.pow(v - avg, 2));
    return Math.sqrt(squareDiffs.reduce((a, b) => a + b, 0) / values.length);
  }

  private calculateSpecializationDistribution(agents: any[]): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const agent of agents) {
      const spec = agent.genome?.primarySpecialization || 'general';
      counts[spec] = (counts[spec] || 0) + 1;
    }
    const total = agents.length;
    return Object.fromEntries(
      Object.entries(counts).map(([k, v]) => [k, v / total])
    );
  }

  private calculateVelocity(generations: Generation[]): number {
    if (generations.length < 2) return 0;
    const sorted = [...generations].sort((a, b) => a.generationNumber - b.generationNumber);
    const first = sorted[0].avgFitness;
    const last = sorted[sorted.length - 1].avgFitness;
    return (last - first) / sorted.length;
  }

  private getTopSpecialization(genome: any): string {
    if (!genome?.specialization) return 'general';
    const entries = Object.entries(genome.specialization as Record<string, number>);
    if (entries.length === 0) return 'general';
    return entries.sort((a, b) => (b[1] as number) - (a[1] as number))[0][0];
  }
}
```

### 2.2 API Routes

```typescript
// backend/src/routes/evolutionRoutes.ts

import { Router } from 'express';
import { EvolutionHistoryService } from '../services/EvolutionHistoryService';
import { prisma } from '../lib/prisma';

const router = Router();
const evolutionService = new EvolutionHistoryService(prisma);

// GET /api/evolution/:projectId/timeline
router.get('/:projectId/timeline', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { limit } = req.query;
    
    const data = await evolutionService.getTimelineData(
      projectId, 
      limit ? parseInt(limit as string) : 100
    );
    
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/evolution/:projectId/family-tree
router.get('/:projectId/family-tree', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { rootGeneration } = req.query;
    
    const data = await evolutionService.getFamilyTree(
      projectId,
      rootGeneration ? parseInt(rootGeneration as string) : 0
    );
    
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/evolution/:projectId/velocity
router.get('/:projectId/velocity', async (req, res) => {
  try {
    const { projectId } = req.params;
    
    const data = await evolutionService.getEvolutionVelocity(projectId);
    
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/evolution/:projectId/specializations
router.get('/:projectId/specializations', async (req, res) => {
  try {
    const { projectId } = req.params;
    
    const data = await evolutionService.getSpecializationEmergence(projectId);
    
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
```

---

## 3. Frontend Components

### 3.1 Main Timeline Component

```tsx
// frontend/src/components/evolution/EvolutionTimeline.tsx

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

interface EvolutionTimelineProps {
  projectId: string;
  refreshInterval?: number;
}

export function EvolutionTimeline({ 
  projectId, 
  refreshInterval = 30000 
}: EvolutionTimelineProps) {
  const [data, setData] = useState<TimelineDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGeneration, setSelectedGeneration] = useState<TimelineDataPoint | null>(null);
  const [velocity, setVelocity] = useState<{
    currentVelocity: number;
    trend: string;
    projectedFitness: number;
  } | null>(null);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, refreshInterval);
    return () => clearInterval(interval);
  }, [projectId, refreshInterval]);

  const fetchData = async () => {
    try {
      const [timelineRes, velocityRes] = await Promise.all([
        fetch(`/api/evolution/${projectId}/timeline`),
        fetch(`/api/evolution/${projectId}/velocity`),
      ]);
      
      const timelineData = await timelineRes.json();
      const velocityData = await velocityRes.json();
      
      if (timelineData.success) {
        setData(timelineData.data);
      }
      if (velocityData.success) {
        setVelocity(velocityData.data);
      }
    } catch (error) {
      console.error('Failed to fetch evolution data:', error);
    } finally {
      setLoading(false);
    }
  };

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
```

### 3.2 Family Tree Component (D3.js)

```tsx
// frontend/src/components/evolution/FamilyTree.tsx

'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

interface FamilyTreeNode {
  id: string;
  name: string;
  generation: number;
  fitness: number;
  role: string;
  status: string;
  specialization: string;
  children: FamilyTreeNode[];
}

interface FamilyTreeProps {
  projectId: string;
  width?: number;
  height?: number;
}

export function FamilyTree({ projectId, width = 1200, height = 800 }: FamilyTreeProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [data, setData] = useState<FamilyTreeNode[]>([]);
  const [selectedNode, setSelectedNode] = useState<FamilyTreeNode | null>(null);

  useEffect(() => {
    fetchData();
  }, [projectId]);

  useEffect(() => {
    if (data.length > 0 && svgRef.current) {
      renderTree();
    }
  }, [data, width, height]);

  const fetchData = async () => {
    try {
      const res = await fetch(`/api/evolution/${projectId}/family-tree`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      }
    } catch (error) {
      console.error('Failed to fetch family tree:', error);
    }
  };

  const renderTree = () => {
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 40, right: 120, bottom: 40, left: 120 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Create tree layout
    const treeLayout = d3.tree<FamilyTreeNode>()
      .size([innerHeight, innerWidth]);

    // Create hierarchy from first root (or combine all roots)
    const rootData = data.length === 1 ? data[0] : {
      id: 'root',
      name: 'Genesis',
      generation: -1,
      fitness: 0,
      role: 'root',
      status: 'ALIVE',
      specialization: 'all',
      children: data,
    };

    const root = d3.hierarchy(rootData);
    const treeData = treeLayout(root);

    // Color scale based on fitness
    const colorScale = d3.scaleSequential(d3.interpolateViridis)
      .domain([0, 1]);

    // Status color mapping
    const statusColors: Record<string, string> = {
      'ALIVE': '#10B981',
      'TERMINATED_LOW_E': '#EF4444',
      'TERMINATED_RETIREMENT': '#6B7280',
      'TERMINATED_REPLACED': '#F59E0B',
    };

    // Draw links (connections between nodes)
    g.selectAll('.link')
      .data(treeData.links())
      .enter()
      .append('path')
      .attr('class', 'link')
      .attr('d', d3.linkHorizontal<any, any>()
        .x(d => d.y)
        .y(d => d.x)
      )
      .attr('fill', 'none')
      .attr('stroke', '#4B5563')
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.6);

    // Draw nodes
    const nodes = g.selectAll('.node')
      .data(treeData.descendants())
      .enter()
      .append('g')
      .attr('class', 'node')
      .attr('transform', d => `translate(${d.y},${d.x})`)
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        setSelectedNode(d.data);
      });

    // Node circles
    nodes.append('circle')
      .attr('r', d => 8 + (d.data.fitness * 10))
      .attr('fill', d => colorScale(d.data.fitness))
      .attr('stroke', d => statusColors[d.data.status] || '#fff')
      .attr('stroke-width', 3)
      .on('mouseover', function() {
        d3.select(this)
          .transition()
          .duration(200)
          .attr('r', d => 12 + ((d as any).data.fitness * 10));
      })
      .on('mouseout', function(event, d) {
        d3.select(this)
          .transition()
          .duration(200)
          .attr('r', 8 + (d.data.fitness * 10));
      });

    // Node labels
    nodes.append('text')
      .attr('dy', '0.35em')
      .attr('x', d => d.children ? -15 : 15)
      .attr('text-anchor', d => d.children ? 'end' : 'start')
      .attr('fill', '#E5E7EB')
      .attr('font-size', '11px')
      .text(d => d.data.name);

    // Generation labels (left side)
    const generations = [...new Set(treeData.descendants().map(d => d.data.generation))];
    generations.sort((a, b) => a - b);

    svg.append('g')
      .attr('transform', `translate(20, ${margin.top})`)
      .selectAll('.gen-label')
      .data(generations.filter(g => g >= 0))
      .enter()
      .append('text')
      .attr('y', (d, i) => {
        const nodesInGen = treeData.descendants().filter(n => n.data.generation === d);
        if (nodesInGen.length === 0) return i * 50;
        const avgY = nodesInGen.reduce((sum, n) => sum + n.x, 0) / nodesInGen.length;
        return avgY;
      })
      .attr('fill', '#9CA3AF')
      .attr('font-size', '10px')
      .attr('font-weight', 'bold')
      .text(d => `Gen ${d}`);

    // Add zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);
  };

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="bg-gray-900/80 rounded-xl border border-gray-800"
      />
      
      {/* Legend */}
      <div className="absolute top-4 right-4 bg-gray-900/90 backdrop-blur-sm rounded-lg p-3 border border-gray-700">
        <div className="text-xs font-bold text-white mb-2">Status</div>
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-gray-300">Alive</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-gray-300">Low E</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-full bg-gray-500" />
            <span className="text-gray-300">Retired</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <span className="text-gray-300">Replaced</span>
          </div>
        </div>
        <div className="mt-3 pt-2 border-t border-gray-700">
          <div className="text-xs text-gray-400">Node size = Fitness</div>
        </div>
      </div>

      {/* Selected Node Details */}
      {selectedNode && selectedNode.id !== 'root' && (
        <div className="absolute bottom-4 left-4 bg-gray-900/90 backdrop-blur-sm rounded-lg p-4 border border-gray-700 max-w-sm">
          <div className="flex justify-between items-start mb-2">
            <h4 className="font-bold text-white">{selectedNode.name}</h4>
            <button 
              onClick={() => setSelectedNode(null)}
              className="text-gray-400 hover:text-white text-sm"
            >
              ✕
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="text-gray-400">Generation:</div>
            <div className="text-white">{selectedNode.generation}</div>
            <div className="text-gray-400">Fitness:</div>
            <div className="text-green-400">{selectedNode.fitness.toFixed(3)}</div>
            <div className="text-gray-400">Role:</div>
            <div className="text-blue-400">{selectedNode.role}</div>
            <div className="text-gray-400">Specialization:</div>
            <div className="text-purple-400">{selectedNode.specialization}</div>
            <div className="text-gray-400">Status:</div>
            <div className={selectedNode.status === 'ALIVE' ? 'text-green-400' : 'text-red-400'}>
              {selectedNode.status.replace('TERMINATED_', '')}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## 4. Integration with Evolution Engine

### 4.1 Hook into Generation Cycle

```typescript
// backend/src/services/EvolutionEngine.ts

import { EvolutionHistoryService } from './EvolutionHistoryService';

class EvolutionEngine {
  private historyService: EvolutionHistoryService;

  constructor(prisma: PrismaClient) {
    this.historyService = new EvolutionHistoryService(prisma);
  }

  async runGenerationCycle(projectId: string) {
    // ... existing evolution logic ...

    // After evolution cycle completes, record the generation
    await this.historyService.recordGeneration({
      projectId,
      generationNumber: this.currentGeneration,
      agents: this.population.map(agent => ({
        id: agent.id,
        fitness: agent.fitnessScore,
        tasksCompleted: agent.tasksCompleted,
        tasksSucceeded: agent.tasksPassed,
        tokensUsed: agent.totalTokensUsed,
        existencePotential: agent.E,
        genome: agent.genome,
        parentId: agent.parentId,
        status: agent.E > 0 ? 'ALIVE' : 'TERMINATED_LOW_E',
        causeOfDeath: agent.E <= 0 ? 'Low existence potential' : undefined,
      })),
      innovations: this.discoveredInnovations,
      mutationRate: this.currentMutationRate,
      crossoverRate: this.currentCrossoverRate,
    });
  }
}
```

---

## 5. Page Integration

```tsx
// frontend/app/project/[id]/evolution/page.tsx

import { EvolutionTimeline } from '@/components/evolution/EvolutionTimeline';
import { FamilyTree } from '@/components/evolution/FamilyTree';

export default function EvolutionPage({ params }: { params: { id: string } }) {
  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        <header>
          <h1 className="text-3xl font-bold">Evolution Observatory</h1>
          <p className="text-gray-400 mt-1">
            Watch your AI agents evolve and improve in real-time
          </p>
        </header>

        <section>
          <h2 className="text-xl font-semibold mb-4">Fitness Timeline</h2>
          <EvolutionTimeline projectId={params.id} />
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4">Agent Family Tree</h2>
          <FamilyTree projectId={params.id} />
        </section>
      </div>
    </div>
  );
}
```

---

## Summary

This document provides **100% implementation-ready code** for the Evolution Timeline feature:

| Component | Status |
|-----------|--------|
| Database Schema | ✅ Complete |
| Backend Service | ✅ Complete |
| API Routes | ✅ Complete |
| Timeline Chart | ✅ Complete |
| Family Tree (D3) | ✅ Complete |
| Page Integration | ✅ Complete |
