import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

interface Proposal {
  id: string;
  type: 'CONSERVATIVE' | 'BALANCED' | 'BOLD';
  summary: string;
  costEstUsdMonth: number;
  riskAssessment: string;
  tradeoffs: string;
}

interface HumanReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  proposal: Proposal;
  onDecision: (approved: boolean, feedback: string) => void;
}

export function HumanReviewModal({ isOpen, onClose, proposal, onDecision }: HumanReviewModalProps) {
  const [feedback, setFeedback] = useState('');
  const isBold = proposal.type === 'BOLD';

  const handleApprove = () => {
    onDecision(true, feedback);
    onClose();
  };

  const handleReject = () => {
    onDecision(false, feedback);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] border-l-4 border-l-yellow-500">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Human Review Required: {proposal.type} Proposal
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-muted p-4 rounded-md">
            <h4 className="font-semibold mb-2">Summary</h4>
            <p className="text-sm text-muted-foreground">{proposal.summary}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-red-50 dark:bg-red-950/20 p-3 rounded border border-red-100 dark:border-red-900/50">
              <h5 className="text-xs font-bold text-red-600 dark:text-red-400 uppercase mb-1">Risks</h5>
              <p className="text-xs">{proposal.riskAssessment}</p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded border border-blue-100 dark:border-blue-900/50">
              <h5 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase mb-1">Cost Estimate</h5>
              <p className="text-xs font-mono">${proposal.costEstUsdMonth}/mo</p>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium mb-2">Reviewer Feedback (Optional)</h4>
            <Textarea 
              placeholder="Add notes about your decision..." 
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleReject} className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50">
            <XCircle className="h-4 w-4" />
            Reject & Revise
          </Button>
          <Button onClick={handleApprove} className="gap-2 bg-green-600 hover:bg-green-700 text-white">
            <CheckCircle className="h-4 w-4" />
            Approve Proposal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
