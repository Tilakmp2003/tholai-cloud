# Agent Personality & Emotion System - Complete Implementation Guide

## Overview
Give agents unique identities using Big Five personality traits and real-time emotional states (VAD model) that affect their behavior.

---

## 1. Database Schema

```prisma
// prisma/schema.prisma

model Agent {
  id                  String   @id @default(cuid())
  name                String
  role                String
  
  // Personality (Big Five) - immutable after creation
  openness            Float    @default(0.5)  // 0-1: Creative vs Conservative
  conscientiousness   Float    @default(0.5)  // 0-1: Detail-oriented vs Fast
  extraversion        Float    @default(0.5)  // 0-1: Collaborative vs Solo
  agreeableness       Float    @default(0.5)  // 0-1: Compliant vs Critical
  neuroticism         Float    @default(0.5)  // 0-1: Reactive vs Stable
  
  // Current Emotional State (VAD) - changes over time
  valence             Float    @default(0.5)  // -1 to 1: Bad to Good
  arousal             Float    @default(0.3)  // 0 to 1: Calm to Excited
  dominance           Float    @default(0.5)  // 0 to 1: Submissive to Dominant
  
  // Existence Potential
  existencePotential  Float    @default(100)
  
  // Other fields...
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
}

model EmotionLog {
  id              String   @id @default(cuid())
  agentId         String
  agent           Agent    @relation(fields: [agentId], references: [id])
  
  // State snapshot
  valence         Float
  arousal         Float
  dominance       Float
  existencePotential Float
  
  // Trigger
  triggerEvent    String   // What caused this state change
  triggerType     String   // 'task_success', 'task_failure', 'collaboration', etc.
  
  timestamp       DateTime @default(now())
  
  @@index([agentId])
}
```

---

## 2. Personality System

### 2.1 Personality Generator

```typescript
// backend/src/services/PersonalityService.ts

interface PersonalityTraits {
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
}

interface PersonalityProfile {
  traits: PersonalityTraits;
  archetype: string;
  communicationStyle: string;
  workStyle: string;
  riskTolerance: number;
  collaborationPreference: number;
}

export class PersonalityService {
  // Predefined archetypes with trait distributions
  private archetypes: Record<string, PersonalityTraits> = {
    'The Pioneer': { openness: 0.9, conscientiousness: 0.6, extraversion: 0.7, agreeableness: 0.5, neuroticism: 0.3 },
    'The Perfectionist': { openness: 0.4, conscientiousness: 0.95, extraversion: 0.3, agreeableness: 0.6, neuroticism: 0.7 },
    'The Collaborator': { openness: 0.6, conscientiousness: 0.5, extraversion: 0.9, agreeableness: 0.85, neuroticism: 0.4 },
    'The Critic': { openness: 0.5, conscientiousness: 0.8, extraversion: 0.4, agreeableness: 0.2, neuroticism: 0.6 },
    'The Steady': { openness: 0.3, conscientiousness: 0.7, extraversion: 0.5, agreeableness: 0.7, neuroticism: 0.2 },
    'The Maverick': { openness: 0.95, conscientiousness: 0.4, extraversion: 0.8, agreeableness: 0.3, neuroticism: 0.5 },
  };

  /**
   * Generate personality for new agent based on role
   */
  generatePersonality(role: string): PersonalityProfile {
    // Role-based trait tendencies
    const roleModifiers: Record<string, Partial<PersonalityTraits>> = {
      architect: { openness: 0.8, conscientiousness: 0.7 },
      developer: { conscientiousness: 0.6, openness: 0.5 },
      designer: { openness: 0.9, extraversion: 0.6 },
      qa: { conscientiousness: 0.9, neuroticism: 0.6 },
      devops: { conscientiousness: 0.8, neuroticism: 0.3 },
    };

    const modifier = roleModifiers[role] || {};

    // Generate base traits with randomness
    const traits: PersonalityTraits = {
      openness: this.clamp(this.randomNormal(0.5, 0.2) + (modifier.openness || 0) * 0.3),
      conscientiousness: this.clamp(this.randomNormal(0.5, 0.2) + (modifier.conscientiousness || 0) * 0.3),
      extraversion: this.clamp(this.randomNormal(0.5, 0.2) + (modifier.extraversion || 0) * 0.3),
      agreeableness: this.clamp(this.randomNormal(0.5, 0.2) + (modifier.agreeableness || 0) * 0.3),
      neuroticism: this.clamp(this.randomNormal(0.5, 0.2) + (modifier.neuroticism || 0) * 0.3),
    };

    // Find closest archetype
    const archetype = this.findClosestArchetype(traits);

    return {
      traits,
      archetype,
      communicationStyle: this.deriveCommunicationStyle(traits),
      workStyle: this.deriveWorkStyle(traits),
      riskTolerance: this.deriveRiskTolerance(traits),
      collaborationPreference: this.deriveCollaborationPreference(traits),
    };
  }

  /**
   * Inherit personality from parents (for evolution)
   */
  inheritPersonality(parent1: PersonalityTraits, parent2: PersonalityTraits, mutationRate = 0.1): PersonalityTraits {
    const child: PersonalityTraits = {
      openness: 0,
      conscientiousness: 0,
      extraversion: 0,
      agreeableness: 0,
      neuroticism: 0,
    };

    for (const trait of Object.keys(child) as (keyof PersonalityTraits)[]) {
      // Crossover: blend parent traits
      const blend = Math.random();
      const inherited = parent1[trait] * blend + parent2[trait] * (1 - blend);

      // Mutation: small random change
      const mutation = (Math.random() - 0.5) * mutationRate;

      child[trait] = this.clamp(inherited + mutation);
    }

    return child;
  }

  private deriveCommunicationStyle(traits: PersonalityTraits): string {
    if (traits.extraversion > 0.7 && traits.agreeableness > 0.6) {
      return 'Enthusiastic and supportive. Uses emojis and positive language.';
    }
    if (traits.extraversion < 0.4 && traits.conscientiousness > 0.7) {
      return 'Concise and precise. Focuses on technical details.';
    }
    if (traits.agreeableness < 0.4) {
      return 'Direct and critical. Prioritizes truth over comfort.';
    }
    if (traits.openness > 0.7) {
      return 'Creative and exploratory. Often suggests alternatives.';
    }
    return 'Balanced and professional. Adapts to context.';
  }

  private deriveWorkStyle(traits: PersonalityTraits): string {
    if (traits.conscientiousness > 0.8) {
      return 'Methodical planner. Creates detailed tasks before starting.';
    }
    if (traits.openness > 0.8 && traits.conscientiousness < 0.5) {
      return 'Experimental. Tries multiple approaches quickly.';
    }
    if (traits.neuroticism > 0.7) {
      return 'Cautious. Double-checks everything.';
    }
    return 'Balanced. Plans appropriately for task complexity.';
  }

  private deriveRiskTolerance(traits: PersonalityTraits): number {
    return traits.openness * 0.4 + (1 - traits.neuroticism) * 0.4 + (1 - traits.conscientiousness) * 0.2;
  }

  private deriveCollaborationPreference(traits: PersonalityTraits): number {
    return traits.extraversion * 0.5 + traits.agreeableness * 0.5;
  }

  private findClosestArchetype(traits: PersonalityTraits): string {
    let closest = '';
    let minDistance = Infinity;

    for (const [name, archTraits] of Object.entries(this.archetypes)) {
      const distance = this.euclideanDistance(traits, archTraits);
      if (distance < minDistance) {
        minDistance = distance;
        closest = name;
      }
    }

    return closest;
  }

  private euclideanDistance(a: PersonalityTraits, b: PersonalityTraits): number {
    let sum = 0;
    for (const key of Object.keys(a) as (keyof PersonalityTraits)[]) {
      sum += Math.pow(a[key] - b[key], 2);
    }
    return Math.sqrt(sum);
  }

  private randomNormal(mean: number, std: number): number {
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + z * std;
  }

  private clamp(value: number): number {
    return Math.max(0, Math.min(1, value));
  }
}
```

---

## 3. Emotion Engine

### 3.1 VAD Emotion Engine

```typescript
// backend/src/services/EmotionEngine.ts

import { PrismaClient } from '@prisma/client';
import { emitAgentEvent } from '../gateways/AgentLiveGateway';

interface EmotionalState {
  valence: number;   // -1 to 1
  arousal: number;   // 0 to 1
  dominance: number; // 0 to 1
}

interface SystemEvent {
  type: 'task_success' | 'task_failure' | 'collaboration_request' | 'criticism' | 
        'praise' | 'deadline_approaching' | 'E_change' | 'team_success' | 'team_failure';
  magnitude: number; // 0 to 1
  context?: any;
}

export class EmotionEngine {
  constructor(private prisma: PrismaClient) {}

  /**
   * Update agent's emotional state based on system event
   */
  async processEvent(agentId: string, event: SystemEvent): Promise<EmotionalState> {
    const agent = await this.prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) throw new Error('Agent not found');

    // Current state
    let { valence, arousal, dominance } = agent;

    // Calculate emotional impact based on event type and agent personality
    const impact = this.calculateImpact(event, {
      openness: agent.openness,
      conscientiousness: agent.conscientiousness,
      extraversion: agent.extraversion,
      agreeableness: agent.agreeableness,
      neuroticism: agent.neuroticism,
    });

    // Apply impact with personality modulation
    valence = this.applyValenceChange(valence, impact.valenceChange, agent.neuroticism);
    arousal = this.applyArousalChange(arousal, impact.arousalChange, agent.neuroticism);
    dominance = this.applyDominanceChange(dominance, impact.dominanceChange, agent.conscientiousness);

    // Clamp values
    valence = Math.max(-1, Math.min(1, valence));
    arousal = Math.max(0, Math.min(1, arousal));
    dominance = Math.max(0, Math.min(1, dominance));

    // Update database
    await this.prisma.agent.update({
      where: { id: agentId },
      data: { valence, arousal, dominance },
    });

    // Log emotion change
    await this.prisma.emotionLog.create({
      data: {
        agentId,
        valence,
        arousal,
        dominance,
        existencePotential: agent.existencePotential,
        triggerEvent: JSON.stringify(event),
        triggerType: event.type,
      },
    });

    // Emit to live feed
    emitAgentEvent({
      projectId: (await this.getProjectId(agentId)) || '',
      agentId,
      agentName: agent.name,
      agentRole: agent.role as any,
      actionType: 'thinking',
      payload: {
        type: 'thought',
        content: this.generateEmotionalThought({ valence, arousal, dominance }, event),
      },
      emotionalState: { valence, arousal, dominance },
      existencePotential: agent.existencePotential,
      timestamp: new Date(),
    });

    return { valence, arousal, dominance };
  }

  private calculateImpact(event: SystemEvent, personality: any): {
    valenceChange: number;
    arousalChange: number;
    dominanceChange: number;
  } {
    const impactMap: Record<string, { v: number; a: number; d: number }> = {
      task_success: { v: 0.2, a: 0.1, d: 0.15 },
      task_failure: { v: -0.3, a: 0.3, d: -0.2 },
      collaboration_request: { v: 0.05, a: 0.1, d: 0 },
      criticism: { v: -0.15, a: 0.2, d: -0.1 },
      praise: { v: 0.25, a: 0.15, d: 0.1 },
      deadline_approaching: { v: -0.1, a: 0.4, d: -0.05 },
      E_change: { v: event.magnitude > 0 ? 0.1 : -0.2, a: 0.1, d: event.magnitude > 0 ? 0.05 : -0.1 },
      team_success: { v: 0.15, a: 0.1, d: 0.05 },
      team_failure: { v: -0.1, a: 0.15, d: -0.05 },
    };

    const base = impactMap[event.type] || { v: 0, a: 0, d: 0 };

    // Personality modulation
    // High neuroticism = stronger negative reactions
    const neuroMod = personality.neuroticism > 0.6 ? 1.3 : 1;
    // High extraversion = stronger social event reactions
    const extraMod = event.type.includes('collaboration') || event.type.includes('team') 
      ? (personality.extraversion > 0.6 ? 1.2 : 0.8) : 1;

    return {
      valenceChange: base.v * event.magnitude * neuroMod * extraMod,
      arousalChange: base.a * event.magnitude * neuroMod,
      dominanceChange: base.d * event.magnitude,
    };
  }

  private applyValenceChange(current: number, change: number, neuroticism: number): number {
    // High neuroticism = faster negative changes, slower positive recovery
    if (change < 0) {
      return current + change * (1 + neuroticism * 0.5);
    } else {
      return current + change * (1 - neuroticism * 0.3);
    }
  }

  private applyArousalChange(current: number, change: number, neuroticism: number): number {
    // Natural decay toward baseline (0.3)
    const decayRate = 0.95;
    const baseline = 0.3;
    const decayed = baseline + (current - baseline) * decayRate;
    
    // Apply change with neuroticism amplification
    return decayed + change * (1 + neuroticism * 0.5);
  }

  private applyDominanceChange(current: number, change: number, conscientiousness: number): number {
    // High conscientiousness = more stable dominance
    const stabilityFactor = 1 - conscientiousness * 0.3;
    return current + change * stabilityFactor;
  }

  private generateEmotionalThought(state: EmotionalState, event: SystemEvent): string {
    const { valence, arousal, dominance } = state;

    // Stressed (high arousal, low valence)
    if (arousal > 0.7 && valence < 0) {
      return "I need to stay focused. The pressure is high but I can handle this...";
    }

    // Excited (high arousal, high valence)
    if (arousal > 0.7 && valence > 0.5) {
      return "This is going great! I'm feeling really productive right now!";
    }

    // Confident (high dominance, positive valence)
    if (dominance > 0.7 && valence > 0) {
      return "I've got this under control. My approach is working well.";
    }

    // Dejected (low dominance, low valence)
    if (dominance < 0.3 && valence < 0) {
      return "Maybe I should try a different approach... something isn't clicking.";
    }

    // Content (calm, positive)
    if (arousal < 0.4 && valence > 0.3) {
      return "Steady progress. Everything is going according to plan.";
    }

    return "Processing... considering the best approach...";
  }

  private async getProjectId(agentId: string): Promise<string | null> {
    // Implementation depends on your data model
    return null;
  }
}
```

---

## 4. Behavior Modification

### 4.1 Emotion-to-Behavior Mapper

```typescript
// backend/src/services/BehaviorModifier.ts

interface EmotionalState {
  valence: number;
  arousal: number;
  dominance: number;
}

interface BehaviorModifiers {
  temperature: number;       // LLM temperature
  maxTokens: number;         // Response length
  retryAttempts: number;     // How many times to retry on failure
  helpSeeking: boolean;      // Whether to ask for help
  riskTolerance: number;     // Willingness to try new approaches
  detailLevel: number;       // How thorough to be
  collaborationBias: number; // Preference for team work
}

export class BehaviorModifier {
  /**
   * Convert emotional state to behavior modifiers
   */
  calculateModifiers(state: EmotionalState, baseModifiers: BehaviorModifiers): BehaviorModifiers {
    const { valence, arousal, dominance } = state;

    return {
      // High arousal = more creative/random outputs
      temperature: baseModifiers.temperature * (1 + arousal * 0.3),

      // Low valence + high arousal = shorter, more urgent responses
      // High valence = more verbose, explanatory
      maxTokens: Math.round(baseModifiers.maxTokens * 
        (valence > 0 ? (1 + valence * 0.2) : (1 - Math.abs(valence) * 0.3))
      ),

      // Low valence = more retries (desperate)
      retryAttempts: Math.round(baseModifiers.retryAttempts * 
        (valence < 0 ? (1 + Math.abs(valence) * 0.5) : 1)
      ),

      // Low dominance + low valence = seek help
      helpSeeking: dominance < 0.4 && valence < 0,

      // High valence + low arousal = willing to experiment
      // Low valence + high arousal = stick to safe approaches
      riskTolerance: baseModifiers.riskTolerance * 
        ((valence > 0 && arousal < 0.5) ? 1.3 : (valence < 0 && arousal > 0.5) ? 0.6 : 1),

      // High conscientiousness + low arousal = very detailed
      // High arousal = less detailed (rushing)
      detailLevel: baseModifiers.detailLevel * (1 - arousal * 0.3),

      // High valence = more collaborative
      collaborationBias: baseModifiers.collaborationBias * (1 + valence * 0.3),
    };
  }

  /**
   * Generate emotional context for system prompt
   */
  generateEmotionalContext(state: EmotionalState): string {
    const { valence, arousal, dominance } = state;

    const contexts: string[] = [];

    // Valence-based context
    if (valence > 0.5) {
      contexts.push("You're feeling confident and positive about this task.");
    } else if (valence < -0.3) {
      contexts.push("You're feeling some pressure. Focus on getting it right.");
    }

    // Arousal-based context
    if (arousal > 0.7) {
      contexts.push("Time is of the essence. Be efficient but don't sacrifice quality.");
    } else if (arousal < 0.3) {
      contexts.push("Take your time to think through this carefully.");
    }

    // Dominance-based context
    if (dominance > 0.7) {
      contexts.push("Trust your expertise. You know what you're doing.");
    } else if (dominance < 0.3) {
      contexts.push("Consider consulting with teammates if you're unsure.");
    }

    return contexts.join(' ');
  }
}
```

---

## 5. Frontend: Emotion Visualization

### 5.1 Agent Avatar with Aura

```tsx
// frontend/src/components/agents/AgentAvatar.tsx

'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface AgentAvatarProps {
  agent: {
    id: string;
    name: string;
    role: string;
    avatarUrl?: string;
  };
  emotion: {
    valence: number;
    arousal: number;
    dominance: number;
  };
  size?: 'sm' | 'md' | 'lg';
  showDetails?: boolean;
}

export function AgentAvatar({ agent, emotion, size = 'md', showDetails = true }: AgentAvatarProps) {
  const { valence, arousal, dominance } = emotion;

  // Map VAD to visual properties
  const getAuraColor = () => {
    if (arousal > 0.7 && valence < 0) return { color: '#EF4444', label: 'Stressed' };  // Red
    if (arousal > 0.7 && valence > 0.5) return { color: '#FBBF24', label: 'Excited' };  // Yellow
    if (valence > 0.5) return { color: '#3B82F6', label: 'Flow' };  // Blue
    if (valence < -0.3) return { color: '#8B5CF6', label: 'Frustrated' };  // Purple
    return { color: '#6B7280', label: 'Neutral' };  // Gray
  };

  const getEmoji = () => {
    if (arousal > 0.7 && valence < 0) return '😰';
    if (arousal > 0.7 && valence > 0.5) return '🤩';
    if (valence > 0.5) return '😊';
    if (valence < -0.3) return '😤';
    if (arousal < 0.3) return '😴';
    return '🤔';
  };

  const aura = getAuraColor();

  const sizeClasses = {
    sm: 'w-10 h-10',
    md: 'w-16 h-16',
    lg: 'w-24 h-24',
  };

  const pulseIntensity = arousal; // Higher arousal = faster pulse

  return (
    <div className="relative inline-block">
      {/* Aura glow */}
      <motion.div
        className={`absolute inset-0 rounded-full blur-xl ${sizeClasses[size]}`}
        style={{ backgroundColor: aura.color }}
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{
          duration: 2 - pulseIntensity,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Avatar container */}
      <motion.div
        className={`relative ${sizeClasses[size]} rounded-full overflow-hidden border-2`}
        style={{ 
          borderColor: aura.color,
          boxShadow: `0 0 20px ${aura.color}40`,
        }}
        animate={{
          scale: arousal > 0.7 ? [1, 1.05, 1] : 1,
        }}
        transition={{
          duration: 0.5,
          repeat: arousal > 0.7 ? Infinity : 0,
        }}
      >
        {/* Avatar image or placeholder */}
        {agent.avatarUrl ? (
          <img 
            src={agent.avatarUrl} 
            alt={agent.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center">
            <span className="text-white font-bold text-lg">
              {agent.name.charAt(0)}
            </span>
          </div>
        )}

        {/* Emotion overlay */}
        <div 
          className="absolute inset-0"
          style={{
            background: `radial-gradient(circle, transparent 50%, ${aura.color}40 100%)`,
          }}
        />
      </motion.div>

      {/* Emoji indicator */}
      <div className="absolute -bottom-1 -right-1 text-lg bg-gray-900 rounded-full p-0.5 shadow-lg">
        {getEmoji()}
      </div>

      {/* Details tooltip */}
      {showDetails && (
        <div className="absolute left-1/2 -translate-x-1/2 -bottom-16 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 rounded-lg p-2 text-xs whitespace-nowrap z-10">
          <div className="font-bold text-white">{agent.name}</div>
          <div className="text-gray-400">{aura.label}</div>
          <div className="flex gap-2 mt-1 text-xs">
            <span className="text-blue-400">V:{valence.toFixed(1)}</span>
            <span className="text-yellow-400">A:{arousal.toFixed(1)}</span>
            <span className="text-purple-400">D:{dominance.toFixed(1)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
```

### 5.2 Emotion History Chart

```tsx
// frontend/src/components/agents/EmotionHistory.tsx

'use client';

import React from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend } from 'recharts';

interface EmotionLogEntry {
  timestamp: Date;
  valence: number;
  arousal: number;
  dominance: number;
  triggerType: string;
}

interface EmotionHistoryProps {
  data: EmotionLogEntry[];
}

export function EmotionHistory({ data }: EmotionHistoryProps) {
  const formattedData = data.map(entry => ({
    ...entry,
    time: new Date(entry.timestamp).toLocaleTimeString(),
  }));

  return (
    <div className="h-64 w-full bg-gray-900/50 rounded-xl p-4 border border-gray-800">
      <h4 className="text-sm font-bold text-white mb-2">Emotional Journey</h4>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={formattedData}>
          <XAxis dataKey="time" stroke="#666" tick={{ fontSize: 10 }} />
          <YAxis domain={[-1, 1]} stroke="#666" tick={{ fontSize: 10 }} />
          <Tooltip 
            contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }}
            labelStyle={{ color: '#9CA3AF' }}
          />
          <Legend />
          <Line 
            type="monotone" 
            dataKey="valence" 
            stroke="#3B82F6" 
            strokeWidth={2}
            dot={false}
            name="Valence"
          />
          <Line 
            type="monotone" 
            dataKey="arousal" 
            stroke="#FBBF24" 
            strokeWidth={2}
            dot={false}
            name="Arousal"
          />
          <Line 
            type="monotone" 
            dataKey="dominance" 
            stroke="#8B5CF6" 
            strokeWidth={2}
            dot={false}
            name="Dominance"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

---

## 6. Personality Card Component

```tsx
// frontend/src/components/agents/PersonalityCard.tsx

'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface PersonalityCardProps {
  agent: {
    name: string;
    role: string;
    openness: number;
    conscientiousness: number;
    extraversion: number;
    agreeableness: number;
    neuroticism: number;
  };
  archetype: string;
  communicationStyle: string;
}

export function PersonalityCard({ agent, archetype, communicationStyle }: PersonalityCardProps) {
  const traits = [
    { name: 'Openness', value: agent.openness, color: 'bg-blue-500' },
    { name: 'Conscientiousness', value: agent.conscientiousness, color: 'bg-green-500' },
    { name: 'Extraversion', value: agent.extraversion, color: 'bg-yellow-500' },
    { name: 'Agreeableness', value: agent.agreeableness, color: 'bg-pink-500' },
    { name: 'Neuroticism', value: agent.neuroticism, color: 'bg-purple-500' },
  ];

  return (
    <div className="bg-gray-900/80 rounded-xl p-6 border border-gray-800">
      <div className="mb-4">
        <h3 className="text-xl font-bold text-white">{agent.name}</h3>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-sm text-gray-400">{agent.role}</span>
          <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded">
            {archetype}
          </span>
        </div>
      </div>

      {/* Trait bars */}
      <div className="space-y-3 mb-4">
        {traits.map(trait => (
          <div key={trait.name}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-400">{trait.name}</span>
              <span className="text-gray-300">{(trait.value * 100).toFixed(0)}%</span>
            </div>
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <motion.div
                className={`h-full ${trait.color} rounded-full`}
                initial={{ width: 0 }}
                animate={{ width: `${trait.value * 100}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Communication style */}
      <div className="pt-4 border-t border-gray-700">
        <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">Communication Style</h4>
        <p className="text-sm text-gray-300">{communicationStyle}</p>
      </div>
    </div>
  );
}
```

---

## Summary

| Component | Status |
|-----------|--------|
| Database Schema | ✅ Complete |
| Personality Generator | ✅ Complete |
| Emotion Engine (VAD) | ✅ Complete |
| Behavior Modifier | ✅ Complete |
| Agent Avatar | ✅ Complete |
| Emotion History | ✅ Complete |
| Personality Card | ✅ Complete |
