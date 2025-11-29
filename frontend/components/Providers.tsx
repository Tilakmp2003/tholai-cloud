'use client';

import { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClerkProvider } from '@clerk/nextjs';
import { WebSocketProvider } from '@/providers/WebSocketProvider';
import { ApprovalNotification } from '@/components/ApprovalNotification';
import { Toaster } from 'sonner';

const queryClient = new QueryClient();

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider>
      <QueryClientProvider client={queryClient}>
        <WebSocketProvider>
          {children}
          <ApprovalNotification />
        </WebSocketProvider>
      </QueryClientProvider>
      <Toaster position="bottom-right" theme="dark" />
    </ClerkProvider>
  );
}
