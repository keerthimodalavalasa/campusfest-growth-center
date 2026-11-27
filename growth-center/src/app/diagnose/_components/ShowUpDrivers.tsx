'use client';
import type { ShowUpDriver } from '@/server/engine/diagnose';
import { Legend } from '@/components/charts';
import { num, pct } from '@/lib/format';
import { pts, rangeDash } from './text';

const GROUP_LABEL: Record<string, string> = {
  confirmed: 'Confirmed',
  cancelled: 'Cancelled',
  waitlisted: 'Waitlisted',
  interested: 'Interested only',
  yes: 'Yes',
  no: 'No',
};

/** Two-proportion z statistic for the top vs bottom group of a factor. */
function zStat(a: ShowUpDriver, b: ShowUpDriver): number | null {
  const n1 = a.registrants;
  const n2 = b.registrants;
  if (!n1 || !n2) return null;
  const p = (a.visitors + b.visitors) / (n1 + n2);
  const se = Math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2));
  if (!se) return null;
  return (a.visitors / n1 - b.visitors / n2) / se;
}

/**
 * Show rate of everyone the factor covers. Each factor's groups partition its population
 * (all registrants, or confirmed only for lead time), so the reference line differs by factor.
 */
function factorBase(groups: ShowUpDriver[]): { rate: number | null; people: number } {
  const people = groups.reduce((s, g) => s + g.registrants, 0);
  const attended = groups.reduce((s, g) => s + g.visitors, 0);
  return { rate: people > 0 ? attended / people : null, people };
}

export function ShowUpDrivers({ rows }: { rows: ShowUpDriver[] }) {
  const factors: string[] = [];
  for (const r of rows) if (!factors.includes(r.factor)) factors.push(r.factor);

  return (
    <div>
      <div className="mb-4">
        <Legend
          items={[
            { label: 'Highest show rate in the factor', color: 'var(--bangle)' },
            { label: 'Lowest', color: 'var(--lac)' },
            { label: 'Other groups, or a spread within chance', color: 'var(--ink-3)' },
            { label: 'Show rate of everyone in the factor', color: 'var(--ink)', dashed: true },
          ]}
        />
      </div>
      <div className="grid grid-cols-1 gap-x-8 gap-y-6 xl:grid-cols-2">
        {factors.map((f) => (
          <FactorBlock key={f} factor={f} groups={rows.filter((r) => r.factor === f)} />
        ))}
      </div>
    </div>
  );
}

function FactorBlock({ factor, groups }: { factor: string; groups: ShowUpDriver[] }) {
  const base = factorBase(groups);
  const valid = groups.filter((g) => g.showRate != null && g.registrants > 0);
  const top = valid.reduce<ShowUpDriver | null>((m, g) => (!m || (g.showRate ?? 0) > (m.showRate ?? 0) ? g : m), null);
  const bottom = valid.reduce<ShowUpDriver | null>((m, g) => (!m || (g.showRate ?? 0) < (m.showRate ?? 0) ? g : m), null);
  const spread = top && bottom && top !== bottom ? ((top.showRate ?? 0) - (bottom.showRate ?? 0)) * 100 : null;
  const z = top && bottom && top !== bottom ? zStat(top, bottom) : null;
  const beyondChance = z != null && Math.abs(z) >= 1.96;
  const label = (g: ShowUpDriver) => rangeDash(GROUP_LABEL[g.group] ?? g.group);

  return (
    <section aria-label={factor}>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b border-line pb-1.5">
        <h3 className="text-[0.92rem] font-semibold">
          {factor}
          {base.rate != null ? (
            <span className="num ml-2 text-[0.78rem] font-normal text-ink-3">
              {pct(base.rate)} of {num(base.people)} attended
            </span>
          ) : null}
        </h3>
        {spread != null && top && bottom ? (
          <div className="num text-[0.8rem] text-ink-2">
            <span className="font-semibold" style={{ color: beyondChance ? 'var(--ink)' : 'var(--ink-3)' }}>
              Spread {pts(spread).replace('+', '')}
            </span>
            <span className="text-ink-3">
              {' '}
              ({label(top).toLowerCase()} {pct(top.showRate)} vs {label(bottom).toLowerCase()} {pct(bottom.showRate)}
              {z != null ? `, ${beyondChance ? 'beyond chance' : 'within chance'} at 95%` : ''})
            </span>
          </div>
        ) : null}
      </div>
      <ul className="space-y-1.5">
        {groups.map((g) => {
          const isTop = beyondChance && g === top;
          const isBottom = beyondChance && bottom != null && g.showRate === bottom.showRate;
          const color = isTop ? 'var(--bangle)' : isBottom ? 'var(--lac)' : 'var(--ink-3)';
          const r = g.showRate ?? 0;
          return (
            <li key={g.group} className="grid grid-cols-[6rem_minmax(2.5rem,1fr)_3.4rem_5.6rem] items-center gap-2 text-[0.84rem] sm:grid-cols-[8.5rem_minmax(0,1fr)_3.6rem_7.5rem]" title={`${factor}: ${label(g)}. ${num(g.visitors)} of ${num(g.registrants)} attended (${pct(g.showRate)}), against ${pct(base.rate)} for everyone in the factor.`}>
              <span className="truncate text-ink-2">{label(g)}</span>
              <span className="relative h-3 rounded-full bg-paper-2" aria-hidden>
                <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.max(r * 100, g.registrants ? 0.6 : 0)}%`, background: color }} />
                {base.rate != null ? <span className="absolute -inset-y-1 w-0 border-l-2 border-dashed border-ink" style={{ left: `${base.rate * 100}%` }} /> : null}
              </span>
              <span className="num text-right font-semibold" style={{ color: isTop || isBottom ? color : 'var(--ink)' }}>
                {g.showRate == null ? '–' : pct(g.showRate)}
              </span>
              <span className="num text-right text-[0.78rem] text-ink-3">
                {num(g.visitors)} of {num(g.registrants)}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
