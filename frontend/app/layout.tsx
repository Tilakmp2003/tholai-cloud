import { ReactNode } from 'react';
import BillionDollarSidebar from '@/components/BillionDollarSidebar';
import { GlobalHeader } from '@/components/GlobalHeader';
import { Providers } from '@/components/Providers';
import './globals.css';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Virtual Software Company - Command Center',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased bg-zinc-950 text-zinc-50 min-h-screen selection:bg-indigo-500/30 selection:text-indigo-200">
        <Providers>
          {/* Global Background Effects */}
          <div className="fixed inset-0 z-0 pointer-events-none">
            {/* Grid Pattern */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />
            {/* Stage Light Gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-zinc-950/80" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[400px] bg-indigo-500/10 blur-[120px] rounded-full opacity-50" />
          </div>

          <div className="relative z-10 flex min-h-screen">
            {/* Cinematic Sidebar */}
            <BillionDollarSidebar />

            {/* Main Content */}
            <main className="flex-1 overflow-auto flex flex-col">
              <GlobalHeader />
              <div className="flex-1 overflow-auto">
                {children}
              </div>
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
