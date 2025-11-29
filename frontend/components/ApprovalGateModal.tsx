'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Shield, 
  Check, 
  X, 
  Edit3, 
  AlertTriangle,
  GitCommit,
  Code,
  Clock
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import axios from 'axios';
import { toast } from 'sonner';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface ApprovalGate {
  id: string;
  projectId: string;
  taskId?: string;
  gateType: string;
  status: string;
  title: string;
  description: string;
  payload: any;
  createdAt: string;
}

interface ApprovalGateModalProps {
  gate: ApprovalGate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResolved: () => void;
}

export function ApprovalGateModal({ gate, open, onOpenChange, onResolved }: ApprovalGateModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

  if (!gate) return null;

  const handleApprove = async () => {
    setIsLoading(true);
    try {
      await axios.post(`${API_URL}/api/approvals/${gate.id}/approve`, {
        reviewerId: 'human-reviewer',
        notes: 'Approved via UI'
      });
      toast.success('Approved successfully');
      onResolved();
      onOpenChange(false);
    } catch (error) {
      toast.error('Failed to approve');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }
    
    setIsLoading(true);
    try {
      await axios.post(`${API_URL}/api/approvals/${gate.id}/reject`, {
        reviewerId: 'human-reviewer',
        reason: rejectReason
      });
      toast.success('Rejected');
      onResolved();
      onOpenChange(false);
    } catch (error) {
      toast.error('Failed to reject');
    } finally {
      setIsLoading(false);
    }
  };

  const getGateIcon = () => {
    switch (gate.gateType) {
      case 'PRE_COMMIT': return <GitCommit className="h-5 w-5" />;
      case 'SECURITY': return <Shield className="h-5 w-5" />;
      case 'ARCHITECTURE': return <Code className="h-5 w-5" />;
      default: return <AlertTriangle className="h-5 w-5" />;
    }
  };

  const getGateColor = () => {
    switch (gate.gateType) {
      case 'PRE_COMMIT': return 'text-blue-400';
      case 'SECURITY': return 'text-red-400';
      case 'ARCHITECTURE': return 'text-purple-400';
      default: return 'text-yellow-400';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl bg-zinc-900 border-zinc-800">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-zinc-800 ${getGateColor()}`}>
              {getGateIcon()}
            </div>
            <div>
              <span className="text-white">{gate.title}</span>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs">
                  {gate.gateType}
                </Badge>
                <span className="text-xs text-zinc-500 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {new Date(gate.createdAt).toLocaleTimeString()}
                </span>
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-zinc-400">{gate.description}</p>

          {/* Payload Preview */}
          <Tabs defaultValue="preview" className="w-full">
            <TabsList className="bg-zinc-800">
              <TabsTrigger value="preview">Preview</TabsTrigger>
              <TabsTrigger value="raw">Raw Data</TabsTrigger>
            </TabsList>
            
            <TabsContent value="preview">
              <ScrollArea className="h-[300px] rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                {gate.gateType === 'PRE_COMMIT' && gate.payload?.files ? (
                  <div className="space-y-3">
                    <p className="text-xs text-zinc-500 uppercase tracking-wider">
                      Files to commit ({gate.payload.files.length})
                    </p>
                    {gate.payload.files.map((file: string, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <Code className="h-4 w-4 text-zinc-500" />
                        <span className="text-zinc-300 font-mono">{file}</span>
                      </div>
                    ))}
                    {gate.payload.agentRole && (
                      <p className="text-xs text-zinc-500 mt-4">
                        Agent: <span className="text-zinc-400">{gate.payload.agentRole}</span>
                      </p>
                    )}
                  </div>
                ) : (
                  <pre className="text-xs text-zinc-400 font-mono whitespace-pre-wrap">
                    {JSON.stringify(gate.payload, null, 2)}
                  </pre>
                )}
              </ScrollArea>
            </TabsContent>
            
            <TabsContent value="raw">
              <ScrollArea className="h-[300px] rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                <pre className="text-xs text-zinc-400 font-mono whitespace-pre-wrap">
                  {JSON.stringify(gate.payload, null, 2)}
                </pre>
              </ScrollArea>
            </TabsContent>
          </Tabs>

          {/* Reject Reason Input */}
          <AnimatePresence>
            {showRejectInput && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Reason for rejection..."
                  className="w-full h-24 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500/50"
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800">
            {!showRejectInput ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => setShowRejectInput(true)}
                  className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                >
                  <X className="h-4 w-4 mr-2" />
                  Reject
                </Button>
                <Button
                  onClick={handleApprove}
                  disabled={isLoading}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                  <Check className="h-4 w-4 mr-2" />
                  Approve
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => setShowRejectInput(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleReject}
                  disabled={isLoading || !rejectReason.trim()}
                  className="bg-red-600 hover:bg-red-500 text-white"
                >
                  <X className="h-4 w-4 mr-2" />
                  Confirm Rejection
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
