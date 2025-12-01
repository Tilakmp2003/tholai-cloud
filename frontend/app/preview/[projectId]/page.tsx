'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Loader2, Wifi, WifiOff, RefreshCw, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface PreviewStatus {
  workspacePath: string | null;
  devPort: number | null;
  previewStatus: string;
  isActuallyRunning: boolean;
}

export default function LivePreview() {
  const params = useParams();
  const projectId = params.projectId as string;

  // Poll preview status
  const { data: status, isLoading, refetch } = useQuery<PreviewStatus>({
    queryKey: ['preview-status', projectId],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/workspace/${projectId}/status`);
      return res.data;
    },
    refetchInterval: 3000, // Poll every 3 seconds
  });

  // Start preview server
  const startPreview = async () => {
    try {
      await axios.post(`${API_URL}/api/workspace/${projectId}/start`);
      refetch();
    } catch (error) {
      console.error('Failed to start preview:', error);
    }
  };

  // Stop preview server
  const stopPreview = async () => {
    try {
      await axios.post(`${API_URL}/api/workspace/${projectId}/stop`);
      refetch();
    } catch (error) {
      console.error('Failed to stop preview:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50">
        <Loader2 className="h-12 w-12 animate-spin text-slate-400 mb-4" />
        <p className="text-lg text-slate-600">Loading preview status...</p>
      </div>
    );
  }

  if (!status?.workspacePath) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50 p-6">
        <Card className="p-8 text-center max-w-md">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold mb-2">No Workspace</h2>
          <p className="text-slate-600 mb-4">
            This project doesn't have a workspace yet. Initialize one to enable live preview.
          </p>
          <Button 
            onClick={async () => {
              await axios.post(`${API_URL}/api/workspace/${projectId}/init`);
              refetch();
            }}
            className="w-full"
          >
            Initialize Workspace
          </Button>
        </Card>
      </div>
    );
  }

  const isRunning = status.previewStatus === 'RUNNING' && status.isActuallyRunning;
  const previewUrl = status.devPort ? `${API_URL}/api/preview/${projectId}/` : null;

  if (!isRunning) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50 p-6">
        <Card className="p-8 text-center max-w-md">
          <div className="text-6xl mb-4">🚀</div>
          <h2 className="text-2xl font-bold mb-2">Preview Stopped</h2>
          <p className="text-slate-600 mb-4">
            Start the dev server to see your AI-generated website live.
          </p>
          <Button onClick={startPreview} className="w-full" size="lg">
            Start Preview Server
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full h-screen bg-slate-900 flex flex-col">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 px-4 py-3 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Badge 
            variant="default"
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
          >
            <Wifi className="h-3 w-3" />
            Live
          </Badge>
          
          <span className="text-sm font-mono text-slate-300">
            localhost:{status.devPort}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => refetch()}
            variant="outline"
            size="sm"
            className="bg-slate-700 border-slate-600 hover:bg-slate-600 text-white"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>

          <Button
            onClick={() => window.open(previewUrl!, '_blank')}
            variant="outline"
            size="sm"
            className="bg-slate-700 border-slate-600 hover:bg-slate-600 text-white"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Open
          </Button>

          <Button
            onClick={stopPreview}
            variant="destructive"
            size="sm"
          >
            Stop Server
          </Button>
        </div>
      </div>

      {/* Preview Iframe */}
      {previewUrl ? (
        <iframe 
          key={previewUrl} // Force reload on URL change
          src={previewUrl} 
          className="w-full flex-1 border-none bg-white"
          title="Live Preview"
        />
      ) : (
        <div className="flex-1 flex items-center justify-center bg-slate-950 text-slate-400">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4" />
            <p>Waiting for dev server...</p>
          </div>
        </div>
      )}
    </div>
  );
}
