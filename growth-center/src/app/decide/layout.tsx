import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Decide',
  description: 'Scale, keep, change or stop each campaign, with the rules that fired and a budget simulator.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
