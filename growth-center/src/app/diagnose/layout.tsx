import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Diagnose',
  description: 'Where people drop out of the funnel, which campaigns lose the most, and the signals that need attention.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
