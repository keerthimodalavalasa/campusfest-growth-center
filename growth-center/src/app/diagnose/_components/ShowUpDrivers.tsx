'use client';
import type { CSSProperties } from 'react';
import type { ShowUpDriver } from '@/server/engine/diagnose';
import { ChartData } from '@/components/ChartData';
import { Legend } from '@/components/charts';
import { cx, Table, Td, Th } from '@/components/ui';
import { tipProps } from '@/components/tooltip';
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
 * (all registrants, or confirmed only for lead time), so the reference tick differs by factor.
 */
function factorBase(groups: ShowUpDriver[]): { rate: number | null; people: number } {
  const people = groups.reduce((s, g) => s + g.registrants, 0);
  const attended = groups.reduce((s, g) => s + g.visitors, 0);
  return { rate: people > 0 ? attended / people : null, people };
}

/**
 * Show rate by group, one small chart per factor. Show rate is a visitors metric, so bars are lac; a factor whose
 * spread is within chance at 95% is drawn in stone instead, so only real differences carry the hue.
 */
export function ShowUpDrivers({ rows }: { rows: ShowUpDriver[] }) {
  const factors: string[] = [];
  for (const r of rows) if (!factors.includes(r.factor)) factors.push(r.factor);
  return (
    <div className="mt-3">
      <Legend
        className="mb-4"
        items={[
          { label: 'Show rate, spread beyond chance', color: 'var(--lac)' },
          { label: 'Spread within chance', color: 'var(--stone-3)' },
          { label: 'Everyone in the factor', color: 'var(--ink)', bar: true },
        ]}
      />
      <div className="grid grid-cols-3 gap-x-6 gap-y-6 max-[900px]:grid-cols-2 max-[560px]:grid-cols-1">
        {factors.map((f, i) => (
          <FactorBlock key={f} factor={f} groups={rows.filter((r) => r.factor === f)} index={i} />
        ))}
      </div>
      <ChartData>
        <Table>
          <thead>
            <tr>
              <Th>Factor</Th>
              <Th>Group</Th>
              <Th align="right">Registered</Th>
              <Th align="right">Attended</Th>
              <Th align="right">Show rate</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.factor}-${r.group}`}>
                <Td>{r.factor}</Td>
                <Td>{rangeDash(GROUP_LABEL[r.group] ?? r.group)}</Td>
                <Td align="right">{num(r.registrants)}</Td>
                <Td align="right">{num(r.visitors)}</Td>
                <Td align="right">{pct(r.showRate)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </ChartData>
    </div>
  );
}

function FactorBlock({ factor, groups, index }: { factor: string; groups: ShowUpDriver[]; index: number }) {
  const base = factorBase(groups);
  const valid = groups.filter((g) => g.showRate != null && g.registrants > 0);
  const top = valid.reduce<ShowUpDriver | null>((m, g) => (!m || (g.showRate ?? 0) > (m.showRate ?? 0) ? g : m), null);
  const bottom = valid.reduce<ShowUpDriver | null>((m, g) => (!m || (g.showRate ?? 0) < (m.showRate ?? 0) ? g : m), null);
  const spread = top && bottom && top !== bottom ? ((top.showRate ?? 0) - (bottom.showRate ?? 0)) * 100 : null;
  const z = top && bottom && top !== bottom ? zStat(top, bottom) : null;
  const beyondChance = z != null && Math.abs(z) >= 1.96;
  const label = (g: ShowUpDriver) => rangeDash(GROUP_LABEL[g.group] ?? g.group);
  const fill = beyondChance ? 'var(--lac)' : 'var(--stone-3)';

  return (
    <section aria-label={factor} className="min-w-0">
      <h3 className="text-[13.5px] leading-[1.3] font-[650]">{factor}</h3>
      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        {spread != null ? (
          <span
            className={cx('inline-flex h-[22px] items-center rounded-full px-2 text-[11.5px] font-[700] whitespace-nowrap', beyondChance ? 'bg-ink text-white' : 'text-ink-2 shadow-[inset_0_0_0_1.5px_var(--stone-3)]')}
            {...tipProps({ title: `${factor}: spread ${pts(spread).replace('+', '')}`, notes: [`${top ? label(top) : ''} ${pct(top?.showRate)} vs ${bottom ? label(bottom) : ''} ${pct(bottom?.showRate)}. ${z != null ? `Two-proportion test: ${beyondChance ? 'beyond' : 'within'} chance at 95%.` : ''}`] })}
            tabIndex={0}
          >
            {pts(spread).replace('+', '')} {beyondChance ? 'beyond chance' : 'within chance'}
          </span>
        ) : null}
        {base.rate != null ? (
          <span className="tab text-[12px] font-[550] text-ink-2">
            {pct(base.rate)} of {num(base.people)}
          </span>
        ) : null}
      </div>
      <ul className="mt-2.5 grid gap-2">
        {groups.map((g, gi) => {
          const r = g.showRate ?? 0;
          return (
            <li
              key={g.group}
              tabIndex={0}
              {...tipProps({ title: `${factor}: ${label(g)}`, rows: [{ color: fill, label: 'Show rate', value: pct(g.showRate), swatch: 'square' }, { label: 'Attended', value: `${num(g.visitors)} of ${num(g.registrants)}` }, { label: 'Everyone in the factor', value: pct(base.rate) }] })}
              className="rounded-md"
            >
              <div className="flex items-baseline justify-between gap-2 text-[12.5px]">
                <span className="truncate font-[600] text-ink-2">{label(g)}</span>
                <span className="tab font-[700]">{g.showRate == null ? '–' : pct(g.showRate)}</span>
              </div>
              <span className="relative mt-1 block h-2.5 rounded-r-[4px] bg-stone-2" aria-hidden>
                <i
                  className="anim-grow-x absolute inset-y-0 left-0 block rounded-r-[4px]"
                  style={{ width: `${Math.max(r * 100, g.registrants ? 0.8 : 0)}%`, background: fill, '--d': `${300 + index * 60 + gi * 40}ms` } as CSSProperties}
                />
                {base.rate != null ? <i className="absolute -inset-y-[3px] block w-[2.5px] rounded-full bg-ink" style={{ left: `calc(${base.rate * 100}% - 1px)` }} /> : null}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
