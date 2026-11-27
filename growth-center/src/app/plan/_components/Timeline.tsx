'use client';
import type { CSSProperties } from 'react';
import { CalendarDuotone } from 'runeicons-react';
import { dateLabel, daysBetween } from '@/lib/format';
import { cx, Tile, TileHead } from '@/components/ui';
import { ChartData } from '@/components/ChartData';
import { tipProps } from '@/components/tooltip';
import { clean, gatesOf, phaseRange, type Plan } from './model';

/**
 * The plan on one strip: phases as limestone blocks sized by their days (the festival in lac), gates as numbered
 * ink markers at their dates, and the gate criteria as compact cards underneath. Phase detail rides in the tooltip
 * and the full timeline sits in "View data".
 */
export function TimelineTile({ p }: { p: Plan }) {
  const phases = p.timeline
    .map((t, i) => {
      const r = phaseRange(t.dates);
      return r ? { i, name: t.phase.replace(/^\d+\.\s*/, ''), num: t.phase.match(/^(\d+)/)?.[1] ?? String(i), start: r[0], end: r[1], items: t.items } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x != null);
  const gates = gatesOf(p.timeline);
  if (!phases.length) return null;
  const t0 = phases[0].start;
  const t1 = phases[phases.length - 1].end;
  const span = Math.max(1, daysBetween(t0, t1) + 1);
  const at = (d: string) => (daysBetween(t0, d) / span) * 100;
  const isFest = (name: string) => /festival/i.test(name);

  return (
    <Tile field="stone" delay={360} className="col-span-12" aria-label="Timeline and gates">
      <TileHead icon={CalendarDuotone} aside={`${dateLabel(t0, true)} to ${dateLabel(t1, true)}`}>
        Timeline and gates
      </TileHead>

      <div className="mt-4 overflow-x-auto pb-1">
        <div className="relative min-w-[760px]">
          {/* gate markers */}
          <div className="relative h-9">
            {gates.map((g, i) => (
              <span
                key={g.key}
                tabIndex={0}
                {...tipProps({ title: `${g.label}, ${dateLabel(g.date, true)}`, notes: [g.text] })}
                aria-label={`${g.label}, ${dateLabel(g.date, true)}: ${g.text}`}
                className="anim-fade absolute bottom-0 flex -translate-x-1/2 flex-col items-center"
                style={{ left: `${at(g.date) + 100 / span / 2}%`, '--d': `${420 + i * 40}ms` } as CSSProperties}
              >
                <span className={cx('grid size-[22px] place-items-center text-[11.5px] font-[800] text-white', g.key === 'lock' ? 'rotate-45 rounded-[5px] bg-ink-2' : 'rounded-full bg-ink')}>
                  <span className={g.key === 'lock' ? '-rotate-45' : undefined}>{g.short}</span>
                </span>
                <i aria-hidden className="mt-0.5 block h-1.5 w-px bg-ink" />
              </span>
            ))}
          </div>
          {/* phases */}
          <div className="relative h-14">
            {phases.map((ph, i) => {
              const left = at(ph.start);
              const width = ((daysBetween(ph.start, ph.end) + 1) / span) * 100;
              const fest = isFest(ph.name);
              return (
                <div
                  key={ph.i}
                  tabIndex={0}
                  {...tipProps({ title: `${ph.num}. ${ph.name}`, notes: [`${dateLabel(ph.start)} to ${dateLabel(ph.end, true)}`, ...ph.items.slice(0, 4).map(clean)] })}
                  aria-label={`Phase ${ph.num}, ${ph.name}: ${dateLabel(ph.start)} to ${dateLabel(ph.end, true)}`}
                  className={cx('anim-grow-x absolute inset-y-0 flex min-w-0 flex-col justify-center overflow-hidden rounded-[8px] px-2 transition-[filter] duration-150 hover:brightness-[0.95]', fest ? 'bg-lac text-white' : i % 2 ? 'bg-stone-3' : 'bg-stone-2')}
                  style={{ left: `calc(${left}% + 1px)`, width: `calc(${width}% - 2px)`, '--d': `${380 + i * 40}ms` } as CSSProperties}
                >
                  <span className="num text-[18px] leading-none">{ph.num}</span>
                  {width > 9 ? <span className="mt-0.5 truncate text-[11.5px] leading-tight font-[650]">{ph.name.replace(/\s*\(.*\)$/, '')}</span> : null}
                </div>
              );
            })}
          </div>
          {/* months */}
          <div className="relative mt-1.5 h-4 text-[11.5px] font-[600] text-ink-2">
            {monthsBetween(t0, t1).map((m) => (
              <span key={m} className="tab absolute -translate-x-0" style={{ left: `${Math.max(0, at(m))}%` }}>
                {dateLabel(m).split(' ')[1]}
              </span>
            ))}
          </div>
        </div>
      </div>

      <ol className="mt-4 grid grid-cols-6 gap-2 max-[1200px]:grid-cols-3 max-[720px]:grid-cols-1">
        {gates.map((g) => (
          <li key={g.key} tabIndex={0} {...tipProps({ title: `${g.label}, ${dateLabel(g.date, true)}`, notes: [g.text] })} className="min-w-0 rounded-[14px] bg-stone-2 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <span className={cx('grid size-5 shrink-0 place-items-center text-[10.5px] font-[800] text-white', g.key === 'lock' ? 'rotate-45 rounded-[4px] bg-ink-2' : 'rounded-full bg-ink')}>
                <span className={g.key === 'lock' ? '-rotate-45' : undefined}>{g.short}</span>
              </span>
              <span className="text-[13px] font-[700]">{g.label}</span>
              <span className="tab ml-auto text-[12px] font-[600] text-ink-2">{dateLabel(g.date)}</span>
            </div>
            <p className="mt-1.5 line-clamp-3 text-[12.5px] leading-[1.4] text-ink-2">{g.text}</p>
          </li>
        ))}
      </ol>

      <ChartData label="View the full timeline">
        <ol className="grid gap-3 pr-2 text-[12.5px] leading-[1.45]">
          {p.timeline.map((t) => (
            <li key={t.phase}>
              <b className="font-[700] text-ink">{t.phase}</b> <span className="text-ink-2">{t.dates}</span>
              <ul className="mt-1 list-disc pl-5 text-ink-2">
                {t.items.map((it) => (
                  <li key={it}>{clean(it)}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </ChartData>
    </Tile>
  );
}

function monthsBetween(a: string, b: string) {
  const out: string[] = [];
  let y = Number(a.slice(0, 4));
  let m = Number(a.slice(5, 7));
  for (let k = 0; k < 24; k++) {
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
    const iso = `${y}-${String(m).padStart(2, '0')}-01`;
    if (iso > b) break;
    out.push(iso);
  }
  return out;
}
