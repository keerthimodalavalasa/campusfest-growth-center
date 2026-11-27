import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Execute',
  description: 'Tasks, owners and deadlines for every campaign, with the activity log.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
