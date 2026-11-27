'use client';
import Link from 'next/link';
import { useState, type CSSProperties } from 'react';
import { toast } from 'sonner';
import { ChevronDownDuotone, ClipboardListDuotone, MessageSquareTextDuotone, XDuotone } from 'runeicons-react';
import { mutate } from '@/lib/api';
import { inr, inrShort, num, pct } from '@/lib/format';
import { Button, cx, Ico, Select, StatusPill, Tile } from '@/components/ui';
import { Legend } from '@/components/charts';
import { GroupHead } from '@/components/tiles';
import { tipProps } from '@/components/tooltip';
import { Gauge } from '@/components/viz';
import { betName, clean, STATUS, STATUS_LABEL, type Idea, type Initiative } from './model';

/** Stretch visitors are conditional on a gate, so they are hatched (assumptions look different). */
const LAC_HATCH = 'repeating-linear-gradient(135deg, var(--lac) 0 4px, color-mix(in srgb, var(--lac) 30%, var(--stone)) 4px 8px)';
const v = (o: Record<string, string | number>) => o as CSSProperties;

export function Bets({ ideas, byKey, onAsk }: { ideas: Idea[]; byKey: Map<string, Initiative>; onAsk: (prompt: string) => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const maxVis = Math.max(1, ...ideas.map((i) => Math.max(i.incremental_visitors_stretch, i.incremental_visitors_base + (i.incremental_visitors_sponsor_band ?? 0))));
  const maxBudget = Math.max(1, ...ideas.map((i) => i.budget_inr));
  const openIdea = ideas.find((i) => i.key === open) ?? null;

  return (
    <section aria-label="Five bets, ranked by ICE" className="col-span-12 mt-2">
      <GroupHead title="Five bets, ranked by ICE" delay={300} aside="Impact, confidence, ease, each 1–10">
        <Legend
          items={[
            { label: 'Visitors in the base', color: 'var(--lac)' },
            { label: 'Stretch, gated', color: 'color-mix(in srgb, var(--lac) 45%, var(--stone))' },
            { label: 'Budget', color: 'var(--haldi)' },
          ]}
        />
      </GroupHead>
      <div className="grid grid-cols-5 gap-3 max-[1200px]:grid-cols-3 max-[900px]:grid-cols-2 max-[560px]:grid-cols-1">
        {ideas.map((idea, i) => (
          <BetTile
            key={idea.key}
            idea={idea}
            live={byKey.get(idea.key)}
            maxVis={maxVis}
            maxBudget={maxBudget}
            open={open === idea.key}
            onToggle={() => setOpen(open === idea.key ? null : idea.key)}
            delay={320 + i * 40}
          />
        ))}
      </div>
      {openIdea ? <BetDetail idea={openIdea} live={byKey.get(openIdea.key)} onClose={() => setOpen(null)} onAsk={onAsk} /> : null}
    </section>
  );
}

function BetTile({ idea, live, maxVis, maxBudget, open, onToggle, delay }: { idea: Idea; live?: Initiative; maxVis: number; maxBudget: number; open: boolean; onToggle: () => void; delay: number }) {
  const ice = (idea.ice.I + idea.ice.C + idea.ice.E) / 3;
  const [saving, setSaving] = useState(false);
  const name = betName(idea, live);
  const setStatus = async (status: string) => {
    if (!live) return;
    setSaving(true);
    try {
      await mutate(`/api/initiatives/${live.id}`, 'PATCH', { status });
      toast.success(`${live.name}: ${STATUS_LABEL[status].toLowerCase()}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  const base = idea.incremental_visitors_base;
  const stretch = idea.incremental_visitors_stretch;
  const sponsor = idea.incremental_visitors_sponsor_band ?? 0;
  const w = (x: number) => `${Math.max(0, Math.min(100, (x / maxVis) * 100))}%`;

  return (
    <article
      aria-label={`Bet ${idea.rank}: ${name}`}
      className={cx('anim-settle field-stone flex min-w-0 flex-col rounded-tile-s p-[18px_18px_16px] transition-shadow duration-150', open && 'shadow-[inset_0_0_0_2px_var(--ink)]')}
      style={v({ '--d': `${delay}ms` })}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="num text-[34px] leading-[0.85] text-ink-2">{idea.rank}</span>
        <div
          className="flex w-[76px] shrink-0 flex-col items-center"
          tabIndex={0}
          {...tipProps({ title: `ICE ${ice.toFixed(1)}`, rows: [{ label: 'Impact', value: idea.ice.I }, { label: 'Confidence', value: idea.ice.C }, { label: 'Ease', value: idea.ice.E }], notes: [idea.ice.C_basis ? clean(idea.ice.C_basis) : ''].filter(Boolean) })}
          aria-label={`ICE ${ice.toFixed(1)} of 10: impact ${idea.ice.I}, confidence ${idea.ice.C}, ease ${idea.ice.E}`}
        >
          <Gauge value={ice / 10} color="var(--ink)" className="block h-auto w-[76px]" />
          <span className="num -mt-3 text-[20px] leading-none">{ice.toFixed(1)}</span>
          <span className="tab mt-0.5 text-[11px] font-[600] text-ink-2">
            I{idea.ice.I} C{idea.ice.C} E{idea.ice.E}
          </span>
        </div>
      </div>
      <h3 className="mt-2 text-[14px] leading-[1.3] font-[650]">{name}</h3>
      <p className="mt-0.5 text-[12.5px] font-[550] text-ink-2">
        {live?.owner_name ?? idea.owner.split('(')[0].trim()}, {idea.person_weeks} person-weeks
      </p>

      <div className="mt-3.5 grid gap-1.5 text-[12px] font-[600]" aria-label="Visitors">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-ink-2">Visitors</span>
          <span className="tab">
            {Math.round(base) !== 0 ? <b className="font-[750]">+{num(base)}</b> : <span className="text-ink-2">none in base</span>}
            <span className="text-ink-2">, +{num(stretch)} stretch</span>
          </span>
        </div>
        <div className="relative h-2.5 rounded-r-[4px] bg-stone-2" {...tipProps({ title: name, rows: [{ color: 'var(--lac)', label: 'Base', value: `+${num(base)}`, swatch: 'square' }, ...(sponsor ? [{ label: 'If sponsored', value: `+${num(sponsor)}` }] : []), { label: 'Stretch, gated', value: `+${num(stretch)}` }] })}>
          <i className="anim-grow-x absolute inset-y-0 left-0 block rounded-r-[4px]" style={{ width: w(stretch), backgroundImage: LAC_HATCH, ...v({ '--d': `${delay + 200}ms` }) }} />
          {base > 0 ? <i className="anim-grow-x absolute inset-y-0 left-0 block rounded-r-[4px] bg-lac" style={{ width: w(base), ...v({ '--d': `${delay + 160}ms` }) }} /> : null}
        </div>
        {sponsor ? <span className="tab text-[11.5px] font-[550] text-ink-2">+{num(sponsor)} if a sponsor signs</span> : null}
      </div>
      <div className="mt-2.5 grid gap-1.5 text-[12px] font-[600]">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-ink-2">Budget</span>
          <span className="tab font-[750]">{inrShort(idea.budget_inr)}</span>
        </div>
        <div className="relative h-2.5">
          <i className="anim-grow-x absolute inset-y-0 left-0 block rounded-r-[4px] bg-haldi" style={{ width: `${(idea.budget_inr / maxBudget) * 100}%`, ...v({ '--d': `${delay + 240}ms` }) }} />
        </div>
      </div>

      <div className="mt-auto flex items-center gap-2 pt-4">
        {live ? (
          <Select aria-label={`Status of ${live.name}`} value={live.status} disabled={saving} onChange={(e) => setStatus(e.target.value)} className="h-8 min-w-0 flex-1 text-[12.5px]">
            {STATUS.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
        ) : (
          <span className="flex-1 text-[12.5px] text-ink-2">No live status</span>
        )}
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-label={`${open ? 'Hide' : 'Show'} the test plan for ${name}`}
          className={cx('grid size-8 shrink-0 place-items-center rounded-full transition-[background-color,transform] duration-150 active:scale-[0.95]', open ? 'bg-ink text-white' : 'bg-ground text-ink shadow-[inset_0_0_0_1.5px_var(--stone-3)] hover:bg-stone-2')}
        >
          <span className={cx('transition-transform duration-200 ease-out', open && 'rotate-180')}>
            <Ico icon={ChevronDownDuotone} size={16} ia="currentColor" ib="currentColor" />
          </span>
        </button>
      </div>
    </article>
  );
}

function BetDetail({ idea, live, onClose, onAsk }: { idea: Idea; live?: Initiative; onClose: () => void; onAsk: (prompt: string) => void }) {
  const name = betName(idea, live);
  const ev = live?.evidence;
  const rules: { key: 'scale' | 'change' | 'stop'; text: string }[] = [
    { key: 'scale', text: idea.thresholds.scale },
    { key: 'change', text: idea.thresholds.change },
    { key: 'stop', text: idea.thresholds.stop },
  ];
  return (
    <Tile field="stone" className="anim-settle mt-3" aria-label={`Test plan for ${name}`}>
      <div className="flex items-start gap-3">
        <span className="num text-[34px] leading-[0.85] text-ink-2">{idea.rank}</span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[16px] leading-[1.3] font-[700]">{name}</h3>
          <p className="mt-1 max-w-[90ch] text-[13px] leading-[1.45] text-ink-2">{clean(idea.concept)}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close the test plan" className="grid size-9 shrink-0 place-items-center rounded-full bg-stone-2 transition-[background-color,transform] duration-150 hover:bg-stone-3 active:scale-[0.95]">
          <Ico icon={XDuotone} size={18} />
        </button>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-5 max-[1200px]:grid-cols-2 max-[720px]:grid-cols-1">
        <div className="grid content-start gap-3 text-[13px] leading-[1.5]">
          <div>
            <h4 className="text-[12.5px] font-[650] text-ink-2">How we test it</h4>
            <p className="mt-0.5 text-ink">{clean(idea.test_design)}</p>
          </div>
          <div>
            <h4 className="text-[12.5px] font-[650] text-ink-2">Leading indicator</h4>
            <p className="mt-0.5 text-ink">{clean(idea.leading_indicator)}</p>
          </div>
        </div>
        <ul className="grid content-start gap-2" aria-label="Decision rules">
          {rules.map((r) => (
            <li key={r.key} className="rounded-[14px] bg-stone-2 px-3.5 py-3">
              <div className="flex items-center gap-2">
                <StatusPill decision={r.key} />
                <span className="text-[12.5px] font-[650] text-ink-2">when</span>
              </div>
              <p className="mt-1.5 text-[13px] leading-[1.45] text-ink">{clean(r.text)}</p>
            </li>
          ))}
        </ul>
        <div className="grid content-start gap-3 text-[13px] leading-[1.5] max-[1200px]:col-span-2 max-[720px]:col-span-1">
          <div>
            <h4 className="text-[12.5px] font-[650] text-ink-2">Biggest risk</h4>
            <p className="mt-0.5 text-ink">{clean(idea.biggest_risk)}</p>
          </div>
          <div>
            <h4 className="text-[12.5px] font-[650] text-ink-2">2025 evidence in this app</h4>
            {ev ? (
              <>
                <p className="mt-0.5 text-[12.5px] text-ink-2">{ev.campaigns.join(', ')}</p>
                <dl className="mt-2 grid grid-cols-4 gap-1.5">
                  {[
                    { k: 'Registered', val: num(ev.registrations) },
                    { k: 'Visitors', val: ev.visitors != null ? num(ev.visitors) : '–' },
                    { k: 'Per visitor', val: ev.costPerVisitor != null ? inr(ev.costPerVisitor) : '–' },
                    { k: 'Show rate', val: ev.showRate != null ? pct(ev.showRate, 0) : '–' },
                  ].map((f) => (
                    <div key={f.k} className="min-w-0 rounded-[10px] bg-stone-2 px-2 py-1.5">
                      <dd className="num truncate text-[18px] leading-none">{f.val}</dd>
                      <dt className="mt-1 truncate text-[11px] font-[600] text-ink-2">{f.k}</dt>
                    </div>
                  ))}
                </dl>
              </>
            ) : (
              <p className="mt-0.5 text-ink-2">New mechanism: no 2025 channel to compare, so it is tested before money scales.</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Link href="/execute" className="inline-flex h-8 items-center gap-1.5 rounded-full bg-ground px-3 text-[12.5px] font-[650] shadow-[inset_0_0_0_1.5px_var(--stone-3)] transition-colors duration-150 hover:bg-stone-2">
              <Ico icon={ClipboardListDuotone} size={15} ia="var(--ink)" />
              {live ? `${live.tasks_done} of ${live.task_count} tasks done` : 'Tasks'}
            </Link>
            <Button
              size="sm"
              variant="ghost"
              icon={<Ico icon={MessageSquareTextDuotone} size={15} ia="var(--lac)" ib="var(--lac-pale)" />}
              onClick={() => onAsk(`For the 2027 bet "${idea.name}": using the 2025 data, what evidence supports it, what is its leading indicator, and what would make us stop it?`)}
            >
              Ask the copilot
            </Button>
          </div>
        </div>
      </div>
    </Tile>
  );
}
