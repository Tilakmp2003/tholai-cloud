'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import axios from 'axios';
import { Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const DOMAINS = [
  { value: 'E_COMMERCE', label: 'E-Commerce' },
  { value: 'BANKING', label: 'Banking / Fintech' },
  { value: 'SAAS', label: 'SaaS Application' },
  { value: 'INTERNAL_TOOL', label: 'Internal Tool' },
  { value: 'CUSTOM', label: 'Custom / Other' },
];

interface NewProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewProjectDialog({ open, onOpenChange }: NewProjectDialogProps) {
  const [name, setName] = useState('');
  const [clientName, setClientName] = useState('');
  const [domain, setDomain] = useState('CUSTOM');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const queryClient = useQueryClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name || !clientName) {
      alert('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await axios.post(`${API_URL}/api/projects`, {
        name,
        clientName,
        description,
        domain
      });

      console.log('Project created:', response.data);

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });

      // Show success message
      alert(`✅ Project "${name}" created successfully! AI agents are analyzing requirements and creating modules...`);

      // Reset form
      setName('');
      setClientName('');
      setDescription('');
      setDomain('CUSTOM');

      // Close dialog
      onOpenChange(false);

    } catch (error: any) {
      console.error('Failed to create project:', error);
      alert(`Failed to create project: ${error.response?.data?.error || error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
          <DialogDescription>
            Submit your project requirements. Our AI company will analyze the PRD, create modules, and start building.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Project Name */}
          <div>
            <Label htmlFor="name">
              Project Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Fitness Tracker App"
              required
            />
          </div>

          {/* Client Name */}
          <div>
            <Label htmlFor="clientName">
              Client / Company Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="clientName"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="e.g., GymCo Inc"
              required
            />
          </div>

          {/* Domain */}
          <div>
            <Label htmlFor="domain">Domain / Category</Label>
            <Select value={domain} onValueChange={setDomain}>
              <SelectTrigger>
                <SelectValue placeholder="Select domain" />
              </SelectTrigger>
              <SelectContent>
                {DOMAINS.map((d) => (
                  <SelectItem key={d.value} value={d.value}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Requirements / PRD */}
          <div>
            <Label htmlFor="description">
              Project Requirements (PRD)
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what the app should do:&#10;- User authentication with email/password&#10;- Exercise tracking with sets, reps, weight&#10;- Progress charts and analytics&#10;- Social features (follow friends, share workouts)&#10;&#10;Tech preferences: Modern React/Next.js frontend..."
              rows={10}
              className="font-mono text-sm"
            />
            <p className="text-xs text-slate-500 mt-1">
              The more detailed, the better! AI agents will use this to plan modules and tasks.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Project & Start Building'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
