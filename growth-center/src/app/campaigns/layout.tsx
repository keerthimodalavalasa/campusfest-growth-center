import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Campaigns',
  description: 'Every campaign side by side: spend, registrations, verified visitors, cost per visitor and the current call.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
