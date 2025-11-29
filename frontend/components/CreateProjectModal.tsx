'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Rocket, Box, Type, ScrollText, Check, Loader2, 
  Globe, ShoppingCart, Layout, Server, Database,
  Brain, HelpCircle, Send
} from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import axios from 'axios';
import { toast } from 'sonner';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// --- Schema ---

const formSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  description: z.string().min(1, "Description is required"),
});

type FormValues = z.infer<typeof formSchema>;

// --- Component ---

interface CreateProjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const QUICK_STARTS = [
  { id: 'ecommerce', label: 'E-Commerce', icon: ShoppingCart, template: "Build a modern e-commerce platform with product catalog, shopping cart, and checkout flow." },
  { id: 'saas', label: 'SaaS Platform', icon: Layout, template: "Create a B2B SaaS dashboard with user authentication, subscription management, and analytics." },
  { id: 'api', label: 'REST API', icon: Server, template: "Design a scalable REST API with Express.js, PostgreSQL, and comprehensive documentation." },
  { id: 'blog', label: 'Tech Blog', icon: Globe, template: "Develop a high-performance technical blog with MDX support, SEO optimization, and dark mode." },
];

// Interrogation state
interface InterrogationState {
  isActive: boolean;
  questions: string[];
  answers: Record<string, string>;
  ambiguityScore: number;
  round: number;
}

export function CreateProjectModal({ open, onOpenChange }: CreateProjectModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [interrogation, setInterrogation] = useState<InterrogationState>({
    isActive: false,
    questions: [],
    answers: {},
    ambiguityScore: 0,
    round: 0
  });

  const { register, handleSubmit, setValue, getValues, formState: { errors }, reset } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
  });

  // Analyze requirements with Socratic Interrogator
  const analyzeRequirements = async () => {
    const description = getValues('description');
    if (!description) {
      toast.error('Please enter requirements first');
      return;
    }

    setIsAnalyzing(true);
    try {
      const response = await axios.post(`${API_URL}/api/socratic/analyze`, {
        projectId: 'temp-' + Date.now(),
        requirements: description
      });

      const result = response.data;
      
      if (result.isReady) {
        toast.success(`Requirements are clear! (${(result.ambiguityScore * 100).toFixed(0)}% ambiguity)`);
        // Update description with clarified version if available
        if (result.clarifiedRequirements) {
          setValue('description', result.clarifiedRequirements);
        }
      } else {
        setInterrogation({
          isActive: true,
          questions: result.questions,
          answers: {},
          ambiguityScore: result.ambiguityScore,
          round: result.round
        });
      }
    } catch (error) {
      toast.error('Failed to analyze requirements');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Submit answers to interrogator
  const submitAnswers = async () => {
    if (Object.keys(interrogation.answers).length === 0) {
      toast.error('Please answer at least one question');
      return;
    }

    setIsAnalyzing(true);
    try {
      const response = await axios.post(`${API_URL}/api/socratic/answer`, {
        projectId: 'temp-' + Date.now(),
        requirements: getValues('description'),
        previousAnswers: {},
        newAnswers: interrogation.answers
      });

      const result = response.data;
      
      if (result.isReady) {
        toast.success('Requirements clarified!');
        setValue('description', result.clarifiedRequirements);
        setInterrogation({ isActive: false, questions: [], answers: {}, ambiguityScore: 0, round: 0 });
      } else {
        setInterrogation({
          isActive: true,
          questions: result.questions,
          answers: {},
          ambiguityScore: result.ambiguityScore,
          round: result.round
        });
      }
    } catch (error) {
      toast.error('Failed to process answers');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true);
    try {
      await axios.post(`${API_URL}/api/projects`, data);
      
      // Success Sequence
      setIsSubmitting(false);
      setIsSuccess(true);
      
      // Wait for animation then close
      setTimeout(() => {
        setIsSuccess(false);
        onOpenChange(false);
        reset();
        setInterrogation({ isActive: false, questions: [], answers: {}, ambiguityScore: 0, round: 0 });
        toast.success("Mission Initialized Successfully");
        window.location.reload();
      }, 1500);

    } catch (error) {
      console.error('Failed to create project:', error);
      toast.error("Mission Aborted: Initialization Failed");
      setIsSubmitting(false);
    }
  };

  const applyTemplate = (template: string) => {
    setValue('description', template, { shouldValidate: true });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-zinc-950 border-white/10 p-0 overflow-hidden shadow-2xl shadow-indigo-500/10 sm:rounded-xl">
        <DialogTitle className="sr-only">Initialize New Project</DialogTitle>
        
        <AnimatePresence mode="wait">
          {isSuccess ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-[500px] flex flex-col items-center justify-center bg-zinc-950 relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:24px_24px]" />
              
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", duration: 0.5 }}
                className="w-24 h-24 rounded-full bg-emerald-500/10 border border-emerald-500/50 flex items-center justify-center mb-6 relative z-10"
              >
                <Check className="h-12 w-12 text-emerald-500" />
                <div className="absolute inset-0 rounded-full animate-ping bg-emerald-500/20" />
              </motion.div>
              
              <h2 className="text-xl font-mono font-bold text-white tracking-widest mb-2 z-10">MISSION INITIALIZED</h2>
              <p className="text-zinc-500 font-mono text-xs z-10">ESTABLISHING UPLINK...</p>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col h-full"
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-white/5 bg-zinc-900/30 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                    <Rocket className="h-4 w-4 text-indigo-400" />
                  </div>
                  <div>
                    <h2 className="text-sm font-mono font-bold tracking-widest text-zinc-300">INITIALIZE NEW PROJECT</h2>
                    <p className="text-[10px] text-zinc-600 font-mono uppercase">System Configuration Panel</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-mono text-emerald-500">SYSTEM READY</span>
                </div>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
                
                {/* Project Name Input */}
                <div className="space-y-2">
                  <div className={cn(
                    "group flex items-center bg-zinc-900/50 border rounded-lg transition-all duration-200 focus-within:bg-zinc-900 focus-within:border-indigo-500/50 focus-within:shadow-[0_0_15px_rgba(99,102,241,0.1)]",
                    errors.name ? "border-red-500/50" : "border-white/5"
                  )}>
                    <div className="pl-3 pr-2 py-3 border-r border-white/5 text-zinc-600">
                      <Box className="h-4 w-4" />
                    </div>
                    <div className="flex-1 px-3 py-1.5">
                      <label className="block text-[10px] font-mono text-zinc-500 uppercase mb-0.5">Project Identifier</label>
                      <input 
                        {...register('name')}
                        className="w-full bg-transparent border-none p-0 text-sm text-zinc-200 placeholder:text-zinc-700 focus:ring-0 font-mono"
                        placeholder="e.g. quantum-engine-v1"
                        autoComplete="off"
                      />
                    </div>
                  </div>
                  {errors.name && <p className="text-[10px] text-red-400 font-mono pl-1">{errors.name.message}</p>}
                </div>

                {/* Quick Starts */}
                <div className="space-y-2">
                  <label className="text-[10px] font-mono text-zinc-500 uppercase pl-1">Quick Start Modules</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {QUICK_STARTS.map((qs) => (
                      <button
                        key={qs.id}
                        type="button"
                        onClick={() => applyTemplate(qs.template)}
                        className="flex flex-col items-center justify-center gap-2 p-3 rounded-lg border border-white/5 bg-zinc-900/30 hover:bg-zinc-800 hover:border-indigo-500/30 hover:shadow-[0_0_10px_rgba(99,102,241,0.1)] transition-all group"
                      >
                        <qs.icon className="h-5 w-5 text-zinc-500 group-hover:text-indigo-400 transition-colors" />
                        <span className="text-[10px] font-medium text-zinc-400 group-hover:text-zinc-200">{qs.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Description Textarea */}
                <div className="space-y-2">
                  <div className={cn(
                    "group flex items-start bg-black/40 border rounded-lg transition-all duration-200 focus-within:border-indigo-500/50",
                    errors.description ? "border-red-500/50" : "border-white/5"
                  )}>
                    <div className="pl-3 pr-2 py-3 border-r border-white/5 text-zinc-600 h-full">
                      <ScrollText className="h-4 w-4" />
                    </div>
                    <div className="flex-1 px-3 py-2">
                      <label className="block text-[10px] font-mono text-zinc-500 uppercase mb-1">System Parameters & Requirements</label>
                      <textarea 
                        {...register('description')}
                        className="w-full bg-transparent border-none p-0 text-sm text-zinc-300 placeholder:text-zinc-700 focus:ring-0 font-mono min-h-[120px] resize-none leading-relaxed"
                        placeholder="Describe system parameters and functional requirements..."
                      />
                    </div>
                  </div>
                  {errors.description && <p className="text-[10px] text-red-400 font-mono pl-1">{errors.description.message}</p>}
                  
                  {/* Socratic Interrogator Button */}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={analyzeRequirements}
                    disabled={isAnalyzing}
                    className="w-full border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10 font-mono text-xs"
                  >
                    {isAnalyzing ? (
                      <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                    ) : (
                      <Brain className="h-3 w-3 mr-2" />
                    )}
                    ANALYZE REQUIREMENTS CLARITY
                  </Button>
                </div>

                {/* Socratic Interrogation Panel */}
                <AnimatePresence>
                  {interrogation.isActive && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-4 p-4 rounded-lg border border-amber-500/30 bg-amber-500/5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <HelpCircle className="h-4 w-4 text-amber-400" />
                          <span className="text-xs font-mono text-amber-400">CLARIFICATION NEEDED</span>
                        </div>
                        <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]">
                          Round {interrogation.round}
                        </Badge>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between text-[10px] text-zinc-500">
                          <span>Clarity Progress</span>
                          <span>{((1 - interrogation.ambiguityScore) * 100).toFixed(0)}%</span>
                        </div>
                        <Progress value={(1 - interrogation.ambiguityScore) * 100} className="h-1" />
                      </div>

                      <div className="space-y-3">
                        {interrogation.questions.map((question, index) => (
                          <div key={index} className="space-y-1">
                            <label className="text-xs text-zinc-300 flex items-start gap-2">
                              <span className="text-amber-400 font-mono">{index + 1}.</span>
                              {question}
                            </label>
                            <input
                              type="text"
                              value={interrogation.answers[question] || ''}
                              onChange={(e) => setInterrogation(prev => ({
                                ...prev,
                                answers: { ...prev.answers, [question]: e.target.value }
                              }))}
                              placeholder="Your answer..."
                              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                            />
                          </div>
                        ))}
                      </div>

                      <div className="flex justify-between">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setInterrogation({ isActive: false, questions: [], answers: {}, ambiguityScore: 0, round: 0 })}
                          className="text-zinc-500 text-xs"
                        >
                          Skip
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={submitAnswers}
                          disabled={isAnalyzing || Object.keys(interrogation.answers).length === 0}
                          className="bg-amber-600 hover:bg-amber-500 text-xs"
                        >
                          {isAnalyzing ? (
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          ) : (
                            <Send className="h-3 w-3 mr-1" />
                          )}
                          Submit Answers
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Footer Actions */}
                <div className="flex items-center justify-end gap-3 pt-2">
                  <Button 
                    type="button" 
                    variant="ghost" 
                    onClick={() => onOpenChange(false)}
                    className="text-zinc-500 hover:text-zinc-300 hover:bg-white/5 font-mono text-xs"
                  >
                    ABORT
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_30px_rgba(79,70,229,0.5)] transition-all font-mono text-xs tracking-wide"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                        INITIALIZING...
                      </>
                    ) : (
                      <>
                        <Rocket className="mr-2 h-3 w-3" />
                        INITIALIZE WORKSPACE
                      </>
                    )}
                  </Button>
                </div>

              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
