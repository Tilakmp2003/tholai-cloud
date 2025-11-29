'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  HelpCircle, 
  CheckCircle, 
  AlertCircle,
  Send,
  Loader2,
  Brain
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import axios from 'axios';
import { toast } from 'sonner';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface InterrogationResult {
  isReady: boolean;
  ambiguityScore: number;
  clarifiedRequirements: string;
  questions: string[];
  answers: Record<string, string>;
  round: number;
}

interface SocraticInterrogatorProps {
  projectId: string;
  requirements: string;
  onComplete: (clarifiedRequirements: string) => void;
  onSkip: () => void;
}

export function SocraticInterrogator({ 
  projectId, 
  requirements, 
  onComplete,
  onSkip 
}: SocraticInterrogatorProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<InterrogationResult | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [allAnswers, setAllAnswers] = useState<Record<string, string>>({});

  const analyzeRequirements = async () => {
    setIsAnalyzing(true);
    try {
      const response = await axios.post(`${API_URL}/api/socratic/analyze`, {
        projectId,
        requirements
      });
      setResult(response.data);
      
      if (response.data.isReady) {
        onComplete(response.data.clarifiedRequirements);
      }
    } catch (error) {
      toast.error('Failed to analyze requirements');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const submitAnswers = async () => {
    if (Object.keys(answers).length === 0) {
      toast.error('Please answer at least one question');
      return;
    }

    setIsAnalyzing(true);
    try {
      const newAllAnswers = { ...allAnswers, ...answers };
      setAllAnswers(newAllAnswers);
      
      const response = await axios.post(`${API_URL}/api/socratic/answer`, {
        projectId,
        requirements,
        previousAnswers: allAnswers,
        newAnswers: answers
      });
      
      setResult(response.data);
      setAnswers({});
      
      if (response.data.isReady) {
        onComplete(response.data.clarifiedRequirements);
      }
    } catch (error) {
      toast.error('Failed to process answers');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score <= 0.15) return 'text-emerald-400';
    if (score <= 0.4) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getScoreLabel = (score: number) => {
    if (score <= 0.15) return 'Ready';
    if (score <= 0.4) return 'Minor Issues';
    if (score <= 0.7) return 'Needs Clarification';
    return 'Too Vague';
  };

  // Initial state - show analyze button
  if (!result) {
    return (
      <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/50 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-500/20">
            <Brain className="h-5 w-5 text-indigo-400" />
          </div>
          <div>
            <h3 className="font-medium text-white">Socratic Interrogator</h3>
            <p className="text-sm text-zinc-500">Analyze requirements for clarity</p>
          </div>
        </div>

        <p className="text-sm text-zinc-400">
          Before starting the project, let's ensure your requirements are clear and complete.
          This helps agents deliver better results.
        </p>

        <div className="flex gap-3">
          <Button
            onClick={analyzeRequirements}
            disabled={isAnalyzing}
            className="bg-indigo-600 hover:bg-indigo-500"
          >
            {isAnalyzing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <HelpCircle className="h-4 w-4 mr-2" />
            )}
            Analyze Requirements
          </Button>
          <Button variant="outline" onClick={onSkip}>
            Skip Analysis
          </Button>
        </div>
      </div>
    );
  }

  // Requirements are ready
  if (result.isReady) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-6 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-4"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/20">
            <CheckCircle className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <h3 className="font-medium text-white">Requirements Ready</h3>
            <p className="text-sm text-zinc-500">
              Ambiguity Score: {(result.ambiguityScore * 100).toFixed(1)}%
            </p>
          </div>
        </div>

        <p className="text-sm text-zinc-400">
          Your requirements are clear enough to proceed. The project will be created with the clarified requirements.
        </p>
      </motion.div>
    );
  }

  // Questions to answer
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/50 space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-yellow-500/20">
            <AlertCircle className="h-5 w-5 text-yellow-400" />
          </div>
          <div>
            <h3 className="font-medium text-white">Clarification Needed</h3>
            <p className="text-sm text-zinc-500">Round {result.round}</p>
          </div>
        </div>
        
        <div className="text-right">
          <Badge className={`${getScoreColor(result.ambiguityScore)} bg-transparent border-current`}>
            {getScoreLabel(result.ambiguityScore)}
          </Badge>
          <p className="text-xs text-zinc-500 mt-1">
            {(result.ambiguityScore * 100).toFixed(1)}% ambiguous
          </p>
        </div>
      </div>

      {/* Progress */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-zinc-500">
          <span>Clarity Progress</span>
          <span>{((1 - result.ambiguityScore) * 100).toFixed(0)}%</span>
        </div>
        <Progress value={(1 - result.ambiguityScore) * 100} className="h-2" />
      </div>

      {/* Questions */}
      <div className="space-y-4">
        <p className="text-sm text-zinc-400">
          Please answer these questions to clarify your requirements:
        </p>

        <AnimatePresence mode="popLayout">
          {result.questions.map((question, index) => (
            <motion.div
              key={question}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="space-y-2"
            >
              <label className="text-sm font-medium text-zinc-300 flex items-start gap-2">
                <span className="text-indigo-400 font-mono">{index + 1}.</span>
                {question}
              </label>
              <textarea
                value={answers[question] || ''}
                onChange={(e) => setAnswers({ ...answers, [question]: e.target.value })}
                placeholder="Your answer..."
                className="w-full h-20 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none"
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Actions */}
      <div className="flex justify-between pt-4 border-t border-zinc-800">
        <Button variant="outline" onClick={onSkip}>
          Skip & Proceed Anyway
        </Button>
        <Button
          onClick={submitAnswers}
          disabled={isAnalyzing || Object.keys(answers).length === 0}
          className="bg-indigo-600 hover:bg-indigo-500"
        >
          {isAnalyzing ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Send className="h-4 w-4 mr-2" />
          )}
          Submit Answers
        </Button>
      </div>
    </motion.div>
  );
}
