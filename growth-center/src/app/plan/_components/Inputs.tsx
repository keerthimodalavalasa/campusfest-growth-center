'use client';
import { useState } from 'react';
import { CheckDuotone, ShieldCheckDuotone, XDuotone } from 'runeicons-react';
import { num, pct } from '@/lib/format';
import { Button, cx, Ico, Segmented, Table, Td, Th, Tile, TileHead } from '@/components/ui';
import { HowThisWorks } from '@/components/tiles';
import { Ring } from '@/components/viz';
import { clean, type Plan } from './model';

type Show = 'all' | 'fact' | 'assumption';

/** Fact, derived, assumption, decision: weight and texture, never a hue. Assumptions are hatched, as everywhere. */
function FlagChip({ flag }: { flag: string }) {
  const base = 'inline-flex h-[22px] items-center rounded-full px-2 text-[11.5px] font-[700] whitespace-nowrap';
  if (flag === 'fact') return <span className={cx(base, 'bg-ink text-white')}>Fact</span>;
  if (flag.startsWith('fact')) return <span className={cx(base, 'bg-stone-3 text-ink')}>Derived fact</span>;
  if (flag === 'decision') return <span className={cx(base, 'text-ink shadow-[inset_0_0_0_1.5px_var(--ink)]')}>Decision</span>;
  return (
    <span className={cx(base, 'text-ink shadow-[inset_0_0_0_1.5px_var(--stone-3)]')} style={{ backgroundImage: 'repeating-linear-gradient(135deg, var(--stone-3) 0 3px, transparent 3px 7px)' }}>
      Assumption
    </span>
  );
}

/** Inputs and model checks: the evidence trail, one click down so it never leads the page. */
export function InputsTile({ p }: { p: Plan }) {
  const [show, setShow] = useState<Show>('all');
  const [expanded, setExpanded] = useState(false);
  const all = Object.entries(p.inputs)
    .map(([k, val]) => ({ k, ...(val as { value: unknown; flag: string; basis: string; source?: string }) }))
    .filter((r) => r && r.flag);
  const rows = all.filter((r) => show === 'all' || (show === 'fact' ? r.flag.startsWith('fact') : !r.flag.startsWith('fact')));
  const facts = all.filter((r) => r.flag.startsWith('fact')).length;
  const passed = p.checks.filter((c) => c.pass).length;
  const fmt = (val: unknown) => (typeof val === 'number' ? (Math.abs(val) < 2 && !Number.isInteger(val) ? String(Math.round(val * 1000) / 1000) : num(val)) : typeof val === 'string' ? val : 'see model');

  return (
    <Tile field="stone" delay={460} className="col-span-12" aria-label="Inputs and model checks">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <TileHead icon={ShieldCheckDuotone}>Inputs and model checks</TileHead>
        <div className="flex items-center gap-2.5">
          <span className="size-11">
            <Ring value={p.checks.length ? passed / p.checks.length : NaN} track="var(--stone-2)" arc="var(--ink)" ink="var(--ink)" label={`${passed} of ${p.checks.length} checks pass`} />
          </span>
          <span className="text-[12.5px] font-[600] text-ink-2">
            <b className="tab font-[750] text-ink">{passed}</b> of {p.checks.length} checks pass
          </span>
        </div>
        <span className="text-[12.5px] font-[600] text-ink-2">
          <b className="tab font-[750] text-ink">{facts}</b> sourced facts, <b className="tab font-[750] text-ink">{all.length - facts}</b> assumptions and decisions ({pct(facts / Math.max(1, all.length), 0)} sourced)
        </span>
      </div>
      <HowThisWorks label="Show inputs and checks" wide>
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <Segmented<Show>
              label="Which inputs"
              value={show}
              onChange={(s) => {
                setShow(s);
                setExpanded(false);
              }}
              className="bg-stone-2"
              options={[
                { value: 'all', label: 'All inputs' },
                { value: 'fact', label: 'Sourced facts' },
                { value: 'assumption', label: 'Assumptions and decisions' },
              ]}
            />
          </div>
          <Table>
            <thead>
              <tr>
                <Th>Input</Th>
                <Th>Value</Th>
                <Th>Type</Th>
                <Th>Basis</Th>
              </tr>
            </thead>
            <tbody>
              {(expanded ? rows : rows.slice(0, 12)).map((r) => (
                <tr key={r.k}>
                  <Td className="whitespace-nowrap text-ink-2">{r.k.replace(/_/g, ' ')}</Td>
                  <Td className="tab max-w-[10rem] truncate font-[650] text-ink">{fmt(r.value)}</Td>
                  <Td>
                    <FlagChip flag={r.flag} />
                  </Td>
                  <Td className="text-ink-2">{clean(r.basis)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
          {rows.length > 12 ? (
            <Button size="sm" variant="ghost" className="mt-2" onClick={() => setExpanded(!expanded)}>
              {expanded ? 'Show fewer' : `Show all ${rows.length} inputs`}
            </Button>
          ) : null}
          <h3 className="mt-5 mb-2 text-[13.5px] font-[650] text-ink">Model checks</h3>
          <ul className="grid gap-x-6 gap-y-1.5 md:grid-cols-2">
            {p.checks.map((c) => (
              <li key={c.check} className="grid grid-cols-[18px_minmax(0,1fr)] gap-2 text-[12.5px]">
                <span className={cx('mt-px grid size-[18px] place-items-center rounded-full', c.pass ? 'bg-stone-2' : 'bg-st-stop')}>
                  <Ico icon={c.pass ? CheckDuotone : XDuotone} size={12} ia={c.pass ? 'var(--ink)' : '#fff'} ib={c.pass ? 'var(--ink)' : '#fff'} />
                </span>
                <span>
                  <span className="font-[600] text-ink">{c.check}</span>
                  <span className="sr-only">{c.pass ? ', passes' : ', fails'}</span>
                  {c.detail ? <span className="text-ink-2"> {c.detail}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </HowThisWorks>
    </Tile>
  );
}
