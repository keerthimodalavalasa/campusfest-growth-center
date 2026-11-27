import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Data',
  description: 'Edit, import or reset the source tables; every change updates the analytics.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
