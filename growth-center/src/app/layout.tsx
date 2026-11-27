import type { Metadata } from 'next';
import { Archivo } from 'next/font/google';
import { Toaster } from 'sonner';
import './globals.css';
import { AppStateProvider } from '@/lib/app-state';
import { AppShell } from '@/components/shell/AppShell';

const archivo = Archivo({
  variable: '--font-archivo',
  subsets: ['latin'],
  axes: ['wdth'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'CampusFest Growth Center',
  description: 'Attendee-growth command center: funnel analytics, scale/change/stop decisions, campaign and task management, and an AI copilot grounded in the CampusFest data.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${archivo.variable} antialiased`}>
      <body>
        <AppStateProvider>
          <AppShell>{children}</AppShell>
        </AppStateProvider>
        <Toaster position="bottom-left" richColors closeButton />
      </body>
    </html>
  );
}
