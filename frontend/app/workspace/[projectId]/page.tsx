'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useState } from 'react';
import { ChevronRight, ChevronDown, File, Folder, FolderOpen, Loader2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'dir';
  children?: FileTreeNode[];
}

export default function WorkspaceExplorer() {
  const params = useParams();
  const projectId = params.projectId as string;
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set(['']));

  // Fetch file tree (poll every 5 seconds to see live updates)
  const { data: tree, isLoading: treeLoading } = useQuery<FileTreeNode[]>({
    queryKey: ['workspace-tree', projectId],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/workspace/${projectId}/tree`);
      return res.data;
    },
    refetchInterval: 5000, // Poll every 5 seconds
  });

  // Fetch selected file content
  const { data: fileData, isLoading: fileLoading } = useQuery({
    queryKey: ['workspace-file', projectId, selectedFile],
    queryFn: async () => {
      if (!selectedFile) return null;
      const res = await axios.get(`${API_URL}/api/workspace/${projectId}/file`, {
        params: { path: selectedFile }
      });
      return res.data;
    },
    enabled: !!selectedFile,
  });

  const toggleDir = (path: string) => {
    const newExpanded = new Set(expandedDirs);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedDirs(newExpanded);
  };

  const renderTree = (nodes: FileTreeNode[], depth = 0) => {
    return nodes.map((node) => {
      const isExpanded = expandedDirs.has(node.path);
      const isSelected = selectedFile === node.path;

      if (node.type === 'dir') {
        return (
          <div key={node.path}>
            <div
              className={`
                flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-slate-700 rounded
                ${isSelected ? 'bg-slate-600' : ''}
              `}
              style={{ paddingLeft: `${depth * 12 + 8}px` }}
              onClick={() => toggleDir(node.path)}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-slate-400" />
              ) : (
                <ChevronRight className="h-4 w-4 text-slate-400" />
              )}
              {isExpanded ? (
                <FolderOpen className="h-4 w-4 text-blue-400" />
              ) : (
                <Folder className="h-4 w-4 text-blue-400" />
              )}
              <span className="text-sm text-slate-200">{node.name}</span>
            </div>
            {isExpanded && node.children && (
              <div>{renderTree(node.children, depth + 1)}</div>
            )}
          </div>
        );
      } else {
        return (
          <div
            key={node.path}
            className={`
              flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-slate-700 rounded
              ${isSelected ? 'bg-blue-600' : ''}
            `}
            style={{ paddingLeft: `${depth * 12 + 28}px` }}
            onClick={() => setSelectedFile(node.path)}
          >
            <File className="h-4 w-4 text-slate-400" />
            <span className="text-sm text-slate-200">{node.name}</span>
          </div>
        );
      }
    });
  };

  if (treeLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900">
        <Loader2 className="h-12 w-12 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-900 text-white">
      {/* Left Panel - File Tree */}
      <div className="w-80 border-r border-slate-700 flex flex-col">
        <div className="p-4 border-b border-slate-700">
          <h2 className="font-semibold text-lg">Workspace Explorer</h2>
          <p className="text-xs text-slate-400 mt-1">Live file updates every 5s</p>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2">
            {tree && tree.length > 0 ? (
              renderTree(tree)
            ) : (
              <p className="text-sm text-slate-400 p-4">No files in workspace</p>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Right Panel - File Content */}
      <div className="flex-1 flex flex-col">
        {selectedFile ? (
          <>
            {/* File Header */}
            <div className="px-6 py-3 border-b border-slate-700 flex items-center justify-between bg-slate-800">
              <div className="flex items-center gap-3">
                <File className="h-4 w-4 text-slate-400" />
                <span className="font-mono text-sm">{selectedFile}</span>
              </div>
              <Badge variant="outline" className="text-xs">
                {fileLoading ? 'Loading...' : 'Read-only'}
              </Badge>
            </div>

            {/* File Content */}
            <ScrollArea className="flex-1">
              {fileLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                </div>
              ) : (
                <pre className="p-6 text-sm font-mono text-slate-200 overflow-x-auto">
                  <code>{fileData?.content || 'No content'}</code>
                </pre>
              )}
            </ScrollArea>
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-slate-400">
              <File className="h-16 w-16 mx-auto mb-4 opacity-20" />
              <p className="text-lg font-medium">No file selected</p>
              <p className="text-sm mt-2">Click a file in the explorer to view its content</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
