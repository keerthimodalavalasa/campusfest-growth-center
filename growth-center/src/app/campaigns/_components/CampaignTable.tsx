'use client';
import Link from 'next/link';
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { ChevronDownDuotone, ChevronUpDuotone } from 'runeicons-react';
import type { CampaignMetrics } from '@/server/engine/snapshot';
import type { Recommendation } from '@/server/engine/decide';
import { CampaignDot } from '@/components/charts';
import { cx, Ico, StatusPill } from '@/components/ui';
import { tipProps } from '@/components/tooltip';
import { inr, num, pct } from '@/lib/format';
import { StatusText, UNATTRIBUTED } from './shared';

type Align = 'left' | 'right';
interface Col {
  key: string;
  label: string;
  align: Align;
  /** Sort value; null always sorts last. */
  value: (c: CampaignMetrics) => number | string | null;
  cell: (c: CampaignMetrics, total: boolean) => ReactNode;
  tip?: ReactNode;
}

/** Walk-ins are not bought, so a cost per head for them would read as a false ₹0. */
const cost = (m: CampaignMetrics, v: number | null) => (m.campaignId === UNATTRIBUTED ? '–' : inr(v));

const DECISION_ORDER: Record<string, number> = { scale: 0, keep: 1, change: 2, stop: 3 };

export function CampaignTable({ campaigns, totals, post, decisions, showRate }: { campaigns: CampaignMetrics[]; totals: CampaignMetrics; post: boolean; decisions: Map<string, Recommendation>; showRate: number }) {
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);

  const cols = useMemo<Col[]>(() => {
    const c: Col[] = [
      {
        key: 'name',
        label: 'Campaign',
        align: 'left',
        value: (m) => m.name,
        cell: (m, total) =>
          total ? (
            <span className="font-semibold">All campaigns</span>
          ) : m.campaignId === UNATTRIBUTED ? (
            <Link href={`/campaigns/${m.campaignId}`} className="text-ink-2 hover:text-ink hover:underline">
              <CampaignDot id={m.campaignId}>{m.name}</CampaignDot>
            </Link>
          ) : (
            <Link href={`/campaigns/${m.campaignId}`} className="font-[600] text-ink hover:underline">
              <CampaignDot id={m.campaignId}>{m.name}</CampaignDot>
            </Link>
          ),
      },
      { key: 'status', label: 'Status', align: 'left', value: (m) => m.status, cell: (m, total) => (total ? null : <StatusText status={m.status} />) },
      { key: 'owner', label: 'Owner', align: 'left', value: (m) => m.ownerName, cell: (m, total) => (total ? null : <span className="whitespace-nowrap text-ink-2">{m.ownerName ?? (m.campaignId === UNATTRIBUTED ? '–' : 'Unassigned')}</span>) },
      { key: 'spend', label: 'Net spend', align: 'right', value: (m) => m.spend, cell: (m) => inr(m.spend), tip: 'Platform spend after refunds and credits, up to the as-of date. A negative week means a credit posted.' },
      { key: 'identified', label: 'Identified', align: 'right', value: (m) => m.identified, cell: (m) => num(m.identified), tip: 'Distinct external people, attributed to their first-touch campaign.' },
      { key: 'registrations', label: 'Registered', align: 'right', value: (m) => m.registrations, cell: (m) => num(m.registrations) },
      { key: 'confirmed', label: 'Confirmed', align: 'right', value: (m) => m.confirmed, cell: (m) => num(m.confirmed) },
      post
        ? { key: 'visitors', label: 'Visitors', align: 'right', value: (m) => m.visitors, cell: (m) => num(m.visitors), tip: 'Unique verified external visitors admitted at the gate. Walk-ins without a registration sit in the walk-ins row.' }
        : {
            key: 'visitors',
            label: 'Expected visitors',
            align: 'right',
            value: (m) => m.expectedVisitors,
            cell: (m) => num(m.expectedVisitors),
            
            tip: `The event has not happened at this date, so attendance does not exist yet. Expected visitors = confirmed registrants × show-rate assumption (${pct(showRate, 0)}, a planning assumption from Settings).`,
          },
      { key: 'ctr', label: 'CTR', align: 'right', value: (m) => m.rates.ctr, cell: (m) => pct(m.rates.ctr), tip: 'Clicks ÷ impressions (anonymous platform events, not people).' },
      { key: 'identToReg', label: 'Ident. → reg.', align: 'right', value: (m) => m.rates.identToReg, cell: (m) => pct(m.rates.identToReg), tip: 'Registered ÷ identified, everyone identified so far. Recent sign-ups have not had time to register, so this understates fast-growing campaigns.' },
      {
        key: 'identToRegMature',
        label: '14-day cohort',
        align: 'right',
        value: (m) => m.rates.identToRegMature,
        cell: (m) => pct(m.rates.identToRegMature),
        
        tip: 'Identified → registered for the cohort first identified 14 or more days before the as-of date. People take up to 14 days (median 7) to register, so this rate is not dragged down by recent sign-ups. Walk-ins are excluded.',
      },
      { key: 'regToConfirmed', label: 'Reg. → conf.', align: 'right', value: (m) => m.rates.regToConfirmed, cell: (m) => pct(m.rates.regToConfirmed), tip: 'Share of registrants whose latest status is confirmed at the as-of date.' },
      ...(post ? [{ key: 'regToVisit', label: 'Show rate', align: 'right' as Align, value: (m: CampaignMetrics) => m.rates.regToVisit, cell: (m: CampaignMetrics) => pct(m.rates.regToVisit), tip: 'Registrants who were admitted as verified visitors ÷ registrants.' }] : []),
      { key: 'cancelRate', label: 'Cancel rate', align: 'right', value: (m) => m.rates.cancelRate, cell: (m) => pct(m.rates.cancelRate) },
      { key: 'optOutRate', label: 'Opt-out rate', align: 'right', value: (m) => m.rates.optOutRate, cell: (m) => pct(m.rates.optOutRate), tip: 'Identified people who opted out of messages ÷ identified people.' },
      { key: 'perRegistration', label: 'Cost / reg.', align: 'right', value: (m) => m.costs.perRegistration, cell: (m) => cost(m, m.costs.perRegistration) },
      post
        ? { key: 'perVisitor', label: 'Cost / visitor', align: 'right', value: (m) => m.costs.perVisitor, cell: (m) => cost(m, m.costs.perVisitor), tip: 'Net spend ÷ unique verified visitors. This is the efficiency the decision rules use after the event.' }
        : { key: 'perVisitor', label: 'Cost / exp. visitor', align: 'right', value: (m) => m.costs.perExpectedVisitor, cell: (m) => cost(m, m.costs.perExpectedVisitor), tip: 'Net spend ÷ expected visitors. This is the efficiency the decision rules use before the event.' },
      {
        key: 'decision',
        label: 'Call',
        align: 'left',
        value: (m) => {
          const d = decisions.get(m.campaignId);
          return d ? DECISION_ORDER[d.decision] : null;
        },
        cell: (m, total) => {
          // the totals row and the walk-ins bucket are not campaigns, so they get no call
          if (total || m.campaignId === UNATTRIBUTED) return null;
          const d = decisions.get(m.campaignId);
          return d ? <StatusPill decision={d.decision} /> : <span className="text-ink-2">–</span>;
        },
      },
    ];
    return c;
  }, [post, decisions, showRate]);

  const rows = useMemo(() => {
    const named = campaigns.filter((c) => c.campaignId !== UNATTRIBUTED);
    const tail = campaigns.filter((c) => c.campaignId === UNATTRIBUTED);
    if (!sort) return [...named, ...tail];
    const col = cols.find((c) => c.key === sort.key);
    if (!col) return [...named, ...tail];
    const sorted = [...named].sort((a, b) => {
      const va = col.value(a);
      const vb = col.value(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      const r = typeof va === 'string' || typeof vb === 'string' ? String(va).localeCompare(String(vb)) : va - vb;
      return sort.dir === 'asc' ? r : -r;
    });
    // walk-ins / unattributed stay pinned under the named campaigns so the totals reconcile visually
    return [...sorted, ...tail];
  }, [campaigns, cols, sort]);

  const toggle = (col: Col) =>
    setSort((s) => {
      const firstDir = col.align === 'left' ? 'asc' : 'desc';
      if (!s || s.key !== col.key) return { key: col.key, dir: firstDir };
      if (s.dir === firstDir) return { key: col.key, dir: firstDir === 'asc' ? 'desc' : 'asc' };
      return null; // third click returns to the default order
    });

  // the sticky first column carries the tile's own limestone, so scrolled columns slide under it
  const stickyCell = 'sticky left-0 z-[1] bg-stone transition-colors duration-150 group-hover:bg-stone-2';

  // a soft edge on the right while more columns are hidden off-screen
  const scroller = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const check = () => setMore(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    el.addEventListener('scroll', check, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener('scroll', check);
    };
  }, [cols]);

  return (
    <div className="relative">
      <div ref={scroller} className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <caption className="sr-only">Campaign metrics. Select a column header to sort; headers with a dotted underline explain the metric on hover or focus.</caption>
          <thead>
            <tr>
              {cols.map((col, i) => (
                <HeaderCell key={col.key} col={col} first={i === 0} sort={sort?.key === col.key ? sort.dir : null} onSort={() => toggle(col)} />
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.campaignId} className={cx('group transition-colors duration-150 hover:bg-stone-2', m.campaignId === UNATTRIBUTED && 'text-ink-2')}>
                {cols.map((col, i) => (
                  <td key={col.key} className={cx('border-b border-stone-2 px-2 py-2 align-middle', col.align === 'right' && 'tab text-right whitespace-nowrap', i === 0 && cx(stickyCell, 'min-w-[11.5rem] pl-1 whitespace-nowrap'))}>
                    {col.cell(m, false)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="group">
              {cols.map((col, i) => (
                <td key={col.key} className={cx('border-t-[1.5px] border-stone-3 px-2 py-2 font-[700]', col.align === 'right' && 'tab text-right whitespace-nowrap', i === 0 && cx(stickyCell, 'pl-1 whitespace-nowrap'))}>
                  {col.cell(totals, true)}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
      {more ? <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-stone to-transparent" aria-hidden /> : null}
    </div>
  );
}

/** Sortable header. aria-sort sits on the cell; the button sorts; a dotted underline marks an explanation in the dark tooltip. */
function HeaderCell({ col, first, sort, onSort }: { col: Col; first: boolean; sort: 'asc' | 'desc' | null; onSort: () => void }) {
  const tipId = useId();
  return (
    <th
      scope="col"
      aria-sort={sort === 'asc' ? 'ascending' : sort === 'desc' ? 'descending' : 'none'}
      className={cx('border-b-[1.5px] border-stone-3 px-2 py-1.5 align-bottom text-[12.5px] leading-tight font-[600] text-ink-2', col.align === 'right' ? 'text-right' : 'text-left', first && 'sticky left-0 z-[2] bg-stone pl-1')}
    >
      <button
        type="button"
        onClick={onSort}
        aria-describedby={col.tip ? tipId : undefined}
        {...(col.tip ? tipProps({ title: col.label, notes: [col.tip] }) : null)}
        className={cx('inline-flex items-end gap-0.5 rounded py-0.5 transition-colors duration-150 hover:text-ink', col.align === 'right' ? 'text-right' : 'text-left', sort && 'text-ink')}
      >
        {col.align === 'right' ? <SortMark dir={sort} /> : null}
        <span className={col.tip ? 'underline decoration-stone-3 decoration-dotted decoration-[1.5px] underline-offset-[3px]' : undefined}>{col.label}</span>
        {col.align === 'left' ? <SortMark dir={sort} /> : null}
      </button>
      {col.tip ? (
        <span id={tipId} className="sr-only">
          {col.tip}
        </span>
      ) : null}
    </th>
  );
}

function SortMark({ dir }: { dir: 'asc' | 'desc' | null }) {
  if (!dir) return null;
  return <Ico icon={dir === 'asc' ? ChevronUpDuotone : ChevronDownDuotone} size={14} ia="currentColor" className="mb-px" />;
}
