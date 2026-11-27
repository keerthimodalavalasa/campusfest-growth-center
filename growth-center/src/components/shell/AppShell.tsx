'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Suspense, type ReactNode } from 'react';
import { MessageSquareTextDuotone } from 'runeicons-react';
import { useApp } from '@/lib/app-state';
import { CampaignTape } from './CampaignTape';
import { Copilot } from '@/components/copilot/Copilot';
import { TipLayer } from '@/components/tooltip';
import { cx, ErrorNote, Ico } from '@/components/ui';

const NAV: { href: string; label: string }[] = [
  { href: '/', label: 'Overview' },
  { href: '/plan', label: 'Plan 2027' },
  { href: '/campaigns', label: 'Campaigns' },
  { href: '/diagnose', label: 'Diagnose' },
  { href: '/decide', label: 'Decide' },
  { href: '/execute', label: 'Execute' },
  { href: '/data', label: 'Data' },
];

const isActive = (path: string | null, href: string) => (href === '/' ? path === '/' : !!path?.startsWith(href));

/** Nav pills. Reads the pathname, so it renders inside its own Suspense boundary (Cache Components rule). */
function NavLinks({ path }: { path: string | null }) {
  return (
    <>
      {NAV.map(({ href, label }) => {
        const active = isActive(path, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cx(
              'flex h-9 shrink-0 items-center rounded-full px-3.5 text-[14px] font-[550] whitespace-nowrap transition-colors duration-150 max-[1200px]:px-2.5 max-[720px]:px-3',
              active ? 'bg-ink text-white' : 'text-ink-2 hover:bg-stone hover:text-ink',
            )}
          >
            {label}
          </Link>
        );
      })}
    </>
  );
}
function ActiveNavLinks() {
  return <NavLinks path={usePathname()} />;
}

export function AppShell({ children }: { children: ReactNode }) {
  const { copilotOpen, setCopilotOpen, metaError } = useApp();

  return (
    <div className="min-h-screen bg-ground">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-white">
        Skip to content
      </a>
      <header className="sticky top-0 z-30 border-b border-stone-2 bg-ground max-[720px]:static max-[720px]:border-b-0">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-6 px-8 max-[1200px]:gap-4 max-[1200px]:px-6 max-[720px]:h-auto max-[720px]:flex-wrap max-[720px]:gap-2.5 max-[720px]:px-4 max-[720px]:pt-3">
          <Link href="/" className="flex shrink-0 items-baseline gap-2 whitespace-nowrap" aria-label="CampusFest Growth Center, Overview">
            <b className="text-[22px] leading-none font-[850] tracking-[-0.01em] [font-stretch:75%] max-[720px]:text-[20px]">CampusFest</b>
            <span className="text-[14px] font-[500] text-ink-2 max-[900px]:hidden">Growth Center</span>
          </Link>
          <nav
            aria-label="Workspaces"
            className="flex min-w-0 flex-1 gap-0.5 max-[720px]:order-3 max-[720px]:basis-full max-[720px]:overflow-x-auto max-[720px]:border-b max-[720px]:border-stone-2 max-[720px]:pb-2.5 max-[720px]:[scrollbar-width:none]"
          >
            <Suspense fallback={<NavLinks path={null} />}>
              <ActiveNavLinks />
            </Suspense>
          </nav>
          <button
            type="button"
            onClick={() => setCopilotOpen(!copilotOpen)}
            aria-expanded={copilotOpen}
            aria-haspopup="dialog"
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-bidri pr-4 pl-3 text-[14px] font-[650] whitespace-nowrap text-white transition-[transform,background-color] duration-150 ease-out hover:bg-[#343a42] active:scale-[0.97] max-[720px]:ml-auto max-[720px]:h-[38px]"
          >
            <Ico icon={MessageSquareTextDuotone} size={20} ia="var(--lac-pale)" ib="var(--bidri)" />
            Ask the copilot
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-[1440px] px-8 pt-4 pb-12 max-[1200px]:px-6 max-[1200px]:pb-10 max-[720px]:px-4 max-[720px]:pt-3 max-[720px]:pb-8">
        <CampaignTape />
        <main id="main" className="min-w-0">
          {metaError ? (
            <div className="mb-3">
              <ErrorNote>Could not load the dataset: {metaError}</ErrorNote>
            </div>
          ) : null}
          {children}
        </main>
      </div>
      <Copilot />
      <TipLayer />
    </div>
  );
}
