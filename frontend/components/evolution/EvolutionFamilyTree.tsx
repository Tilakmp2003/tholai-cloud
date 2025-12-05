'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GitBranch, User, Zap, Skull, Trophy } from 'lucide-react';

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

interface EvolutionFamilyTreeProps {
  projectId: string;
}

export function EvolutionFamilyTree({ projectId }: EvolutionFamilyTreeProps) {
  const [roots, setRoots] = useState<FamilyTreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<FamilyTreeNode | null>(null);

  useEffect(() => {
    fetchTreeData();
  }, [projectId]);

  const fetchTreeData = async () => {
    try {
      const res = await fetch(`http://localhost:4000/api/evolution/${projectId}/family-tree`);
      if (res.ok) {
        const data = await res.json();
        setRoots(data);
      }
    } catch (error) {
      console.error('Failed to fetch family tree:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-96 flex items-center justify-center text-gray-500 animate-pulse">
        Loading Lineage Data...
      </div>
    );
  }

  if (roots.length === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-gray-500 border border-white/10 rounded-xl bg-white/5">
        <GitBranch className="w-8 h-8 mb-2 opacity-50" />
        <p>No lineage data available yet.</p>
      </div>
    );
  }

  return (
    <div className="relative w-full overflow-x-auto pb-4">
      <div className="min-w-max p-8">
        <div className="flex gap-8 justify-center">
          {roots.map((root) => (
            <TreeNode 
              key={root.id} 
              node={root} 
              onSelect={setSelectedNode}
              selectedId={selectedNode?.id}
            />
          ))}
        </div>
      </div>

      {/* Node Details Modal/Panel */}
      <AnimatePresence>
        {selectedNode && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-8 right-8 w-80 bg-zinc-900/95 backdrop-blur-md border border-white/10 rounded-xl p-6 shadow-2xl z-50"
          >
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <User className="w-4 h-4 text-blue-400" />
                {selectedNode.role}
              </h3>
              <button 
                onClick={() => setSelectedNode(null)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-gray-400">
                <span>Generation</span>
                <span className="text-white font-mono">{selectedNode.generation}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Fitness Score</span>
                <span className="text-green-400 font-mono">{selectedNode.fitness.toFixed(4)}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Specialization</span>
                <span className="text-purple-400">{selectedNode.specialization}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Status</span>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  selectedNode.status === 'ALIVE' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                }`}>
                  {selectedNode.status}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TreeNode({ 
  node, 
  onSelect, 
  selectedId 
}: { 
  node: FamilyTreeNode; 
  onSelect: (n: FamilyTreeNode) => void;
  selectedId?: string;
}) {
  const isSelected = selectedId === node.id;
  const isAlive = node.status === 'ALIVE';

  return (
    <div className="flex flex-col items-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ scale: 1.05 }}
        onClick={() => onSelect(node)}
        className={`
          relative z-10 w-12 h-12 rounded-full flex items-center justify-center cursor-pointer
          border-2 transition-colors duration-300
          ${isSelected 
            ? 'bg-blue-600 border-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.5)]' 
            : isAlive 
              ? 'bg-zinc-800 border-zinc-600 hover:border-zinc-400' 
              : 'bg-zinc-900 border-zinc-800 opacity-60'
          }
        `}
      >
        {isAlive ? (
          <Zap className={`w-5 h-5 ${isSelected ? 'text-white' : 'text-yellow-500'}`} />
        ) : (
          <Skull className="w-5 h-5 text-gray-500" />
        )}
        
        {/* Fitness Badge */}
        {node.fitness > 0.8 && (
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center border border-black">
            <Trophy className="w-2 h-2 text-black" />
          </div>
        )}
      </motion.div>

      {/* Connection Line */}
      {node.children.length > 0 && (
        <div className="flex flex-col items-center w-full">
          <div className="w-px h-8 bg-white/10" />
          <div className="relative flex gap-8 pt-4 border-t border-white/10">
            {/* Vertical connector for each child */}
            {node.children.map((child) => (
              <div key={child.id} className="relative flex flex-col items-center -mt-4">
                <div className="w-px h-4 bg-white/10" />
                <TreeNode node={child} onSelect={onSelect} selectedId={selectedId} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
