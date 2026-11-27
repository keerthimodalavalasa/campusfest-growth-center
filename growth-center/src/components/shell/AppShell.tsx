'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Suspense, type ComponentType, type ReactNode } from 'react';
import { ActivityDuotone, ChartBarDuotone, CompassDuotone, KanbanDuotone, Layers2Duotone, LayoutGridDuotone, MapDuotone, SparklesDuotone } from 'runeicons-react';
import { useApp } from '@/lib/app-state';
import { CampaignTape } from './CampaignTape';
import { Copilot } from '@/components/copilot/Copilot';
import { cx } from '@/components/ui';

const NAV: { href: string; label: string; icon: ComponentType<{ size?: number }> }[] = [
  { href: '/', label: 'Overview', icon: LayoutGridDuotone },
  { href: '/plan', label: 'Plan 2027', icon: MapDuotone },
  { href: '/campaigns', label: 'Campaigns', icon: ChartBarDuotone },
  { href: '/diagnose', label: 'Diagnose', icon: ActivityDuotone },
  { href: '/decide', label: 'Decide', icon: CompassDuotone },
  { href: '/execute', label: 'Execute', icon: KanbanDuotone },
  { href: '/data', label: 'Data', icon: Layers2Duotone },
];

const isActive = (path: string | null, href: string) => (href === '/' ? path === '/' : !!path?.startsWith(href));

/** Rail links. Reads the pathname, so it renders inside its own Suspense boundary (Cache Components rule). */
function RailLinks({ path }: { path: string | null }) {
  return (
    <>
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = isActive(path, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cx('rune-duo flex w-[74px] flex-col items-center gap-1 rounded-xl py-2 text-[0.72rem] font-medium transition-colors', active ? 'bg-ink text-white' : 'text-ink-2 hover:bg-paper-2 hover:text-ink')}
          >
            <Icon size={20} />
            {label}
          </Link>
        );
      })}
    </>
  );
}
function ActiveRailLinks() {
  return <RailLinks path={usePathname()} />;
}

function MobileLinks({ path }: { path: string | null }) {
  return (
    <>
      {NAV.map(({ href, label }) => (
        <Link key={href} href={href} aria-current={isActive(path, href) ? 'page' : undefined} className={cx('shrink-0 rounded-full px-3 py-1 text-[0.8rem]', isActive(path, href) ? 'bg-ink text-white' : 'bg-paper-2 text-ink-2')}>
          {label}
        </Link>
      ))}
    </>
  );
}
function ActiveMobileLinks() {
  return <MobileLinks path={usePathname()} />;
}

export function AppShell({ children }: { children: ReactNode }) {
  const { copilotOpen, setCopilotOpen, metaError } = useApp();

  return (
    <div className="flex min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2">
        Skip to content
      </a>
      <nav aria-label="Workspaces" className="sticky top-0 hidden h-screen w-[86px] shrink-0 flex-col items-center gap-1 border-r border-line bg-surface py-4 md:flex">
        <Link href="/" className="mb-4 flex flex-col items-center" aria-label="CampusFest Growth Center home">
          <span className="type-display grid size-10 place-items-center rounded-xl bg-lac text-[1.05rem] text-white">CF</span>
        </Link>
        <Suspense fallback={<RailLinks path={null} />}>
          <ActiveRailLinks />
        </Suspense>
        <div className="mt-auto">
          <button
            onClick={() => setCopilotOpen(!copilotOpen)}
            aria-pressed={copilotOpen}
            className={cx('rune-duo flex w-[74px] flex-col items-center gap-1 rounded-xl py-2 text-[0.72rem] font-semibold', copilotOpen ? 'bg-lac text-white' : 'text-lac hover:bg-lac-soft')}
          >
            <SparklesDuotone size={20} />
            Copilot
          </button>
        </div>
      </nav>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-line bg-paper/95 backdrop-blur">
          <div className="flex items-center gap-5 px-5 py-2.5">
            <div className="hidden shrink-0 leading-tight lg:block">
              <div className="type-title text-[0.98rem]">CampusFest Growth Center</div>
              <div className="text-[0.75rem] text-ink-3">2025 data, Hyderabad 2027 plan</div>
            </div>
            <CampaignTape />
            <button onClick={() => setCopilotOpen(!copilotOpen)} className="shrink-0 rounded-lg bg-lac px-3 py-2 text-[0.82rem] font-semibold text-white md:hidden">
              Copilot
            </button>
          </div>
          <nav aria-label="Workspaces" className="flex gap-1 overflow-x-auto px-3 pb-2 md:hidden">
            <Suspense fallback={<MobileLinks path={null} />}>
              <ActiveMobileLinks />
            </Suspense>
          </nav>
        </header>
        <div className="flex min-h-0 flex-1">
          <main id="main" className="min-w-0 flex-1 px-5 py-6 lg:px-8">
            {metaError ? (
              <div role="alert" className="mb-4 rounded-lg border border-lac/30 bg-lac-soft px-3 py-2 text-sm text-lac">
                Could not load the dataset: {metaError}
              </div>
            ) : null}
            {children}
          </main>
          <Copilot />
        </div>
      </div>
    </div>
  );
}
