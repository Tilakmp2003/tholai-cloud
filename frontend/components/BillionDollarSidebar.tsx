'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutGrid, 
  GitPullRequest, 
  Users, 
  TerminalSquare, 
  View, 
  Search, 
  ChevronLeft, 
  Command,
  Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { SignInButton, SignedIn, SignedOut, UserButton } from '@clerk/nextjs';

// --- Configuration ---

const NAV_ITEMS = [
  { name: 'Command Center', path: '/', icon: LayoutGrid, shortcut: '⌘1' },
  { name: 'Pipeline', path: '/pipeline', icon: GitPullRequest, shortcut: '⌘2', badge: 3 },
  { name: 'Agents', path: '/agents', icon: Users, shortcut: '⌘3' },
  { name: 'Workspace', path: '/workspace', icon: TerminalSquare, shortcut: '⌘4' },
  { name: 'Preview', path: '/preview', icon: View, shortcut: '⌘5' },
  { name: 'Admin', path: '/admin', icon: Settings, shortcut: '⌘6' },
];

// --- Component ---

export default function BillionDollarSidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const projectId = searchParams.get('project');
  const router = useRouter();

  const getPath = (basePath: string) => {
    if (projectId && (basePath === '/workspace' || basePath === '/preview')) {
      return `${basePath}?project=${projectId}`;
    }
    return basePath;
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle Sidebar: Cmd + B
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        setIsCollapsed((prev) => !prev);
      }

      // Navigation: Cmd + 1-5
      if (e.metaKey || e.ctrlKey) {
        const key = parseInt(e.key);
        if (key >= 1 && key <= NAV_ITEMS.length) {
          e.preventDefault();
          router.push(getPath(NAV_ITEMS[key - 1].path));
        }
      }

      // Global Search: Cmd + K
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        console.log('Trigger Global Search'); // Placeholder for actual search trigger
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [router]);

  return (
    <TooltipProvider delayDuration={0}>
      <motion.aside
        initial={false}
        animate={{ width: isCollapsed ? 80 : 280 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="relative h-screen bg-sidebar/80 backdrop-blur-2xl border-r border-white/[0.05] flex flex-col shrink-0 z-50 shadow-[20px_0_40px_-10px_rgba(0,0,0,0.5)]"
      >
        {/* Toggle Button */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-8 z-50 flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-zinc-900 text-zinc-400 shadow-lg hover:bg-zinc-800 hover:text-white transition-colors"
        >
          <motion.div
            animate={{ rotate: isCollapsed ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronLeft className="h-3 w-3" />
          </motion.div>
        </button>

        {/* Header */}
        <div className={cn("flex items-center gap-3 p-6", isCollapsed ? "justify-center px-2" : "")}>
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-[0_0_20px_rgba(99,102,241,0.4)] ring-1 ring-white/20 group cursor-pointer overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <Command className="h-5 w-5 text-white relative z-10" />
          </div>
          
          <AnimatePresence>
            {!isCollapsed && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="overflow-hidden whitespace-nowrap"
              >
                <h1 className="text-sm font-bold tracking-tight text-white">AI Corp</h1>
                <p className="text-[10px] font-medium text-zinc-500">Enterprise OS</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1.5 px-3 py-4">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.path;
            
            return (
              <Tooltip key={item.path}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => router.push(getPath(item.path))}
                    className={cn(
                      "group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-300 outline-none",
                      isActive 
                        ? "text-white" 
                        : "text-zinc-400 hover:bg-white/[0.03] hover:text-zinc-100"
                    )}
                  >
                    {/* Active Background & Magic Line */}
                    {isActive && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute inset-0 rounded-lg bg-white/[0.08] border border-white/[0.05] shadow-inner"
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      >
                        <div className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-indigo-500 shadow-[0_0_12px_#6366f1]" />
                      </motion.div>
                    )}

                    {/* Icon */}
                    <div className="relative z-10 flex shrink-0 items-center justify-center">
                      <item.icon className={cn("h-5 w-5 transition-colors duration-300", isActive ? "text-indigo-400" : "text-zinc-500 group-hover:text-zinc-300")} />
                      
                      {/* Live Indicator for Command Center */}
                      {item.name === 'Command Center' && (
                        <span className="absolute -right-0.5 -top-0.5 flex h-2 w-2">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                        </span>
                      )}
                    </div>

                    {/* Label */}
                    <AnimatePresence>
                      {!isCollapsed && (
                        <motion.span
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -10 }}
                          className="relative z-10 truncate"
                        >
                          {item.name}
                        </motion.span>
                      )}
                    </AnimatePresence>

                    {/* Badge */}
                    {!isCollapsed && item.badge && (
                      <motion.span
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-indigo-500/20 px-1.5 text-[10px] font-bold text-indigo-300 ring-1 ring-indigo-500/50"
                      >
                        {item.badge}
                      </motion.span>
                    )}

                    {/* Shortcut Hint (Hover) */}
                    {!isCollapsed && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                        <kbd className="hidden rounded bg-zinc-900/50 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 border border-white/5 lg:inline-block">
                          {item.shortcut}
                        </kbd>
                      </div>
                    )}
                  </button>
                </TooltipTrigger>
                
                {/* Tooltip (Only when collapsed) */}
                {isCollapsed && (
                  <TooltipContent side="right" className="flex items-center gap-2 bg-zinc-900 border-zinc-800 text-zinc-100">
                    <span>{item.name}</span>
                    <kbd className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400 border border-zinc-700">
                      {item.shortcut}
                    </kbd>
                  </TooltipContent>
                )}
              </Tooltip>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="mt-auto border-t border-white/[0.05] p-4 space-y-4">
          {/* Global Search */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button 
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2 text-sm text-zinc-400 transition-all hover:bg-white/[0.05] hover:text-zinc-100 hover:border-white/10",
                  isCollapsed ? "justify-center px-0" : ""
                )}
              >
                <Search className="h-4 w-4 shrink-0" />
                {!isCollapsed && (
                  <>
                    <span className="flex-1 text-left">Search...</span>
                    <kbd className="rounded bg-zinc-900/50 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 border border-white/5">
                      ⌘K
                    </kbd>
                  </>
                )}
              </button>
            </TooltipTrigger>
            {isCollapsed && <TooltipContent side="right">Global Search (⌘K)</TooltipContent>}
          </Tooltip>

          {/* User Profile (Clerk) */}
          <div className={cn("flex items-center justify-center w-full", isCollapsed ? "" : "px-2")}>
            <SignedOut>
              <SignInButton mode="modal">
                <button className={cn(
                  "flex items-center gap-3 w-full rounded-lg p-2 transition-colors hover:bg-white/5 group text-left border border-white/10 bg-zinc-900",
                  isCollapsed ? "justify-center p-2" : "px-3 py-2"
                )}>
                  <div className="h-5 w-5 rounded-full bg-zinc-700 flex items-center justify-center">
                    <Users className="h-3 w-3 text-zinc-400" />
                  </div>
                  {!isCollapsed && <span className="text-sm font-medium text-zinc-300">Sign In</span>}
                </button>
              </SignInButton>
            </SignedOut>

            <SignedIn>
              <div className={cn(
                "flex items-center gap-3 w-full rounded-lg p-2 transition-colors hover:bg-white/[0.05] group text-left",
                isCollapsed ? "justify-center" : ""
              )}>
                <UserButton 
                  afterSignOutUrl="/"
                  appearance={{
                    elements: {
                      avatarBox: "h-9 w-9 ring-2 ring-white/10 hover:ring-white/20 transition-all"
                    }
                  }}
                />
                {!isCollapsed && (
                  <Link href="/profile" className="flex flex-col overflow-hidden cursor-pointer">
                    <span className="text-sm font-medium text-white truncate group-hover:text-indigo-300 transition-colors">
                      My Account
                    </span>
                    <span className="text-[10px] text-zinc-500 truncate">Manage Settings</span>
                  </Link>
                )}
              </div>
            </SignedIn>
          </div>
        </div>
      </motion.aside>
    </TooltipProvider>
  );
}
