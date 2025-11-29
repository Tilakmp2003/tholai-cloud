'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Bell, X, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useApprovalGates, ApprovalGate } from '@/hooks/useApprovalGates';
import { ApprovalGateModal } from './ApprovalGateModal';

export function ApprovalNotification() {
  const { pendingGates, hasPending, refetch } = useApprovalGates();
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedGate, setSelectedGate] = useState<ApprovalGate | null>(null);
  const [showModal, setShowModal] = useState(false);

  // Auto-expand when new gates arrive
  useEffect(() => {
    if (hasPending && !isExpanded) {
      setIsExpanded(true);
    }
  }, [hasPending]);

  if (!hasPending && !isExpanded) {
    return null;
  }

  return (
    <>
      {/* Floating notification */}
      <AnimatePresence>
        {hasPending && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className="fixed bottom-6 right-6 z-50"
          >
            <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden min-w-[320px] max-w-[400px]">
              {/* Header */}
              <div 
                className="flex items-center justify-between p-4 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-b border-zinc-800 cursor-pointer"
                onClick={() => setIsExpanded(!isExpanded)}
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="p-2 rounded-lg bg-amber-500/20">
                      <Shield className="h-5 w-5 text-amber-400" />
                    </div>
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-black">
                      {pendingGates.length}
                    </span>
                  </div>
                  <div>
                    <h4 className="font-medium text-white text-sm">Approval Required</h4>
                    <p className="text-xs text-zinc-500">
                      {pendingGates.length} pending review{pendingGates.length > 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <motion.div
                    animate={{ rotate: isExpanded ? 90 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronRight className="h-4 w-4 text-zinc-400" />
                  </motion.div>
                </Button>
              </div>

              {/* Expanded content */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="max-h-[300px] overflow-y-auto">
                      {pendingGates.map((gate, index) => (
                        <motion.div
                          key={gate.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className="p-3 border-b border-zinc-800 last:border-0 hover:bg-zinc-800/50 cursor-pointer transition-colors"
                          onClick={() => {
                            setSelectedGate(gate);
                            setShowModal(true);
                          }}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-zinc-200 truncate">
                                {gate.title}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge 
                                  variant="outline" 
                                  className="text-[10px] h-4 bg-zinc-800"
                                >
                                  {gate.gateType}
                                </Badge>
                                <span className="text-[10px] text-zinc-500">
                                  {new Date(gate.createdAt).toLocaleTimeString()}
                                </span>
                              </div>
                            </div>
                            <Button size="sm" className="h-7 text-xs bg-amber-600 hover:bg-amber-500">
                              Review
                            </Button>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal */}
      <ApprovalGateModal
        gate={selectedGate}
        open={showModal}
        onOpenChange={setShowModal}
        onResolved={() => {
          refetch();
          setSelectedGate(null);
        }}
      />
    </>
  );
}
