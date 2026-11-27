'use client';
import { useMemo, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { ArrowLeftRightDuotone, InfoDuotone, Settings2Duotone, ShieldCheckDuotone, SlidersHorizontalDuotone, UsersDuotone } from 'runeicons-react';
import { mutate, type ApiState } from '@/lib/api';
import { inr, pct } from '@/lib/format';
import { Button, cx, ErrorNote, Ico, Skeleton, TextInput, Tile, TileHead, type IconComponent } from '@/components/ui';
import { RuleStrip, type RulePoint } from '@/components/RuleStrip';
import { tipProps } from '@/components/tooltip';
import { Gauge } from '@/components/viz';
import { ResponseCurve } from './ResponseCurve';
import { tidy } from './types';

export interface SettingRow {
  key: string;
  value: unknown;
  description: string | null;
}

type Kind = 'share' | 'factor' | 'points' | 'elasticity';

const FIELDS: { key: string; label: string; kind: Kind; group: string; suffix: string }[] = [
  { key: 'showRateAssumption', label: 'Show rate', kind: 'share', group: 'Expected visitors', suffix: 'share' },
  { key: 'scaleCostFactor', label: 'Scale at or below', kind: 'factor', group: 'Cost thresholds', suffix: '× median' },
  { key: 'changeCostFactor', label: 'Change above', kind: 'factor', group: 'Cost thresholds', suffix: '× median' },
  { key: 'stopCostFactor', label: 'Stop at or above', kind: 'factor', group: 'Cost thresholds', suffix: '× median' },
  { key: 'maxOptOutRate', label: 'Opt-out ceiling', kind: 'share', group: 'Quality guardrails', suffix: 'share' },
  { key: 'maxCancelRateGapPts', label: 'Cancellation gap', kind: 'points', group: 'Quality guardrails', suffix: 'pts' },
  { key: 'momentumDropRatio', label: 'Momentum floor', kind: 'share', group: 'Quality guardrails', suffix: 'share' },
  { key: 'spendElasticity', label: 'Spend elasticity', kind: 'elasticity', group: 'Budget simulator', suffix: 'exponent' },
];
const GROUPS: { name: string; icon: IconComponent; ia: string; ib: string; span: string }[] = [
  { name: 'Cost thresholds', icon: SlidersHorizontalDuotone, ia: 'var(--ink)', ib: 'var(--stone-3)', span: 'col-span-7' },
  { name: 'Expected visitors', icon: UsersDuotone, ia: 'var(--lac)', ib: 'var(--lac-pale)', span: 'col-span-5' },
  { name: 'Quality guardrails', icon: ShieldCheckDuotone, ia: 'var(--ink)', ib: 'var(--stone-3)', span: 'col-span-7' },
  { name: 'Budget simulator', icon: ArrowLeftRightDuotone, ia: 'var(--haldi-track)', ib: 'var(--haldi)', span: 'col-span-5' },
];

const parse = (s: string) => {
  const n = Number(s.trim());
  return s.trim() === '' || !Number.isFinite(n) ? null : n;
};

/** Editable decision rules and planning assumptions (GET / PATCH /api/settings). The page fetches GET /api/settings in parallel with the board. */
export function AssumptionsPanel({ q, median, perUnit, points, delay = 0 }: { q: ApiState<{ settings: SettingRow[] }>; median: number | null; perUnit: string; points: RulePoint[]; delay?: number }) {
  const server = useMemo(() => new Map((q.data?.settings ?? []).map((r) => [r.key, r])), [q.data]);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // reset the form only when the stored values change (a save here or elsewhere), not on every refetch.
  // Adjusted during render (React's pattern for deriving state from props) rather than in an effect.
  const serverKey = q.data ? JSON.stringify(FIELDS.map((f) => server.get(f.key)?.value ?? null)) : null;
  const [syncedKey, setSyncedKey] = useState<string | null>(null);
  if (serverKey != null && serverKey !== syncedKey) {
    const values = JSON.parse(serverKey) as unknown[];
    setSyncedKey(serverKey);
    setForm(Object.fromEntries(FIELDS.map((f, i) => [f.key, values[i] == null ? '' : String(values[i])])));
  }

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    for (const f of FIELDS) {
      const v = parse(form[f.key] ?? '');
      if (v == null) e[f.key] = 'Enter a number.';
      else if (f.kind === 'share' && (v < 0 || v > 1)) e[f.key] = 'A share between 0 and 1, e.g. 0.75 for 75%.';
      else if (f.kind === 'factor' && v <= 0) e[f.key] = 'Must be more than 0.';
      else if (f.kind === 'points' && (v < 0 || v > 100)) e[f.key] = 'Between 0 and 100 points.';
      else if (f.kind === 'elasticity' && (v <= 0 || v > 2)) e[f.key] = 'Between 0 and 2; below 1 means diminishing returns.';
    }
    const sc = parse(form.scaleCostFactor ?? '');
    const ch = parse(form.changeCostFactor ?? '');
    const st = parse(form.stopCostFactor ?? '');
    if (!e.changeCostFactor && sc != null && ch != null && ch <= sc) e.changeCostFactor = 'Must be above the scale factor.';
    if (!e.stopCostFactor && ch != null && st != null && st <= ch) e.stopCostFactor = 'Must be above the change factor.';
    return e;
  }, [form]);

  const changed = FIELDS.filter((f) => {
    const v = parse(form[f.key] ?? '');
    return v != null && v !== Number(server.get(f.key)?.value);
  });
  const hasErrors = Object.keys(errors).length > 0;

  const save = async () => {
    if (hasErrors || !changed.length) return;
    setSaving(true);
    try {
      await mutate('/api/settings', 'PATCH', Object.fromEntries(changed.map((f) => [f.key, parse(form[f.key])!])));
      toast.success(changed.length === 1 ? `${changed[0].group}: ${changed[0].label.toLowerCase()} saved` : `${changed.length} assumptions saved`, { description: 'The board, thresholds and simulator have been recomputed.' });
    } catch (e) {
      toast.error(`Could not save the assumptions: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  };
  const discard = () => setForm(Object.fromEntries(FIELDS.map((f) => [f.key, String(server.get(f.key)?.value ?? '')])));

  const preview = (key: string, kind: Kind): string | null => {
    const v = parse(form[key] ?? '');
    if (v == null || errors[key]) return null;
    if (kind === 'share') return `= ${pct(v)}`;
    if (kind === 'factor') return median != null ? `= ${inr(median * v)}` : null;
    if (kind === 'points') return `= ${v} pts over portfolio`;
    return `×${Math.pow(2, v).toFixed(2)} when spend doubles`;
  };

  const overrides = server.get('showRateByCampaign')?.value as Record<string, number> | undefined;
  const overrideList = overrides && typeof overrides === 'object' ? Object.entries(overrides) : [];
  const live = (key: string) => {
    const v = parse(form[key] ?? '');
    return v != null && !errors[key] ? v : Number(server.get(key)?.value);
  };
  const factorsOk = !errors.scaleCostFactor && !errors.changeCostFactor && !errors.stopCostFactor;
  const factors = factorsOk
    ? { scale: live('scaleCostFactor'), change: live('changeCostFactor'), stop: live('stopCostFactor') }
    : { scale: Number(server.get('scaleCostFactor')?.value), change: Number(server.get('changeCostFactor')?.value), stop: Number(server.get('stopCostFactor')?.value) };
  const showRate = live('showRateAssumption');

  const field = (key: string) => {
    const f = FIELDS.find((x) => x.key === key)!;
    const err = errors[f.key];
    const p = preview(f.key, f.kind);
    const dirty = changed.some((c) => c.key === f.key);
    const id = `setting-${f.key}`;
    const desc = tidy(server.get(f.key)?.description ?? '');
    return (
      <div key={f.key} className="min-w-0">
        <div className="flex items-center gap-1.5 text-[12.5px] font-[600] text-ink-2">
          <label htmlFor={id}>{f.label}</label>
          {desc ? (
            <span tabIndex={0} aria-label={`About ${f.label.toLowerCase()}`} {...tipProps({ title: f.label, notes: [desc] })} className="cursor-default rounded-full">
              <Ico icon={InfoDuotone} size={14} ia="var(--ink-2)" ib="var(--stone-3)" />
            </span>
          ) : null}
        </div>
        <div className="mt-1 flex items-center gap-2">
          <div className="w-[76px] shrink-0">
          <TextInput
            id={id}
            inputMode="decimal"
            value={form[f.key] ?? ''}
            onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
            aria-invalid={!!err}
            aria-describedby={`${id}-msg ${id}-desc`}
            className={cx('tab h-9 text-right', err ? '!border-st-stop' : dirty ? '!border-haldi-track' : null)}
          />
          </div>
          <span className="text-[12px] font-[550] text-ink-2">{f.suffix}</span>
        </div>
        <p id={`${id}-msg`} className={cx('tab mt-1 min-h-[16px] text-[12px] leading-[1.35] font-[600]', err ? 'text-st-stop' : 'text-ink')}>
          {err ?? p}
        </p>
        <span id={`${id}-desc`} className="sr-only">
          {desc}
        </span>
      </div>
    );
  };

  const visual: Record<string, ReactNode> = {
    'Cost thresholds':
      Number.isFinite(factors.scale) && Number.isFinite(factors.change) && Number.isFinite(factors.stop) ? (
        <div className="mt-1">
          <RuleStrip factors={factors} median={median} points={points} />
          <p className="mt-0.5 text-[12px] font-[550] text-ink-2">{changed.some((c) => c.kind === 'factor') ? 'Preview with your edits, before saving' : `Multiples of the ${inr(median)} median ${perUnit}`}</p>
        </div>
      ) : null,
    'Expected visitors': (
      <div className="flex items-end gap-3">
        <Gauge value={Number.isFinite(showRate) ? showRate : 0} assumed className="h-[52px] w-[88px] shrink-0" label={`${pct(showRate)} show rate, assumed`} />
        <p className="text-[12px] leading-[1.4] font-[550] text-ink-2">
          Before the event only.{' '}
          {overrideList.length ? <span className="tab text-ink">Overrides: {overrideList.map(([id, v]) => `${id} ${pct(Number(v))}`).join(', ')}</span> : 'No campaign overrides.'}
        </p>
      </div>
    ),
    'Quality guardrails': null,
    'Budget simulator': <ResponseCurve k={live('spendElasticity')} width={160} height={70} />,
  };

  return (
    <Tile field="stone" id="assumptions" delay={delay} className="scroll-mt-24" aria-label="Assumptions behind the calls">
      <TileHead
        icon={Settings2Duotone}
        aside={
          changed.length ? (
            <span className="inline-flex items-center gap-1.5 font-[650] text-ink">
              <i aria-hidden className="block size-2.5 rounded-[3px] bg-haldi" />
              <span className="tab">{changed.length}</span> unsaved
            </span>
          ) : (
            'saved values'
          )
        }
      >
        Assumptions behind the calls
      </TileHead>
      {q.error ? (
        <div className="mt-4">
          <ErrorNote onRetry={q.refresh}>Could not load the settings: {q.error}</ErrorNote>
        </div>
      ) : !q.data ? (
        <Skeleton className="mt-4 h-56" />
      ) : (
        <form
          className="mt-4"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <div className="grid grid-cols-12 gap-3">
            {GROUPS.map((g) => (
              <fieldset key={g.name} className={cx('min-w-0 rounded-tile-m bg-stone-2/60 px-4 pt-3 pb-3.5 max-[1200px]:col-span-12', g.span)}>
                <legend className="sr-only">{g.name}</legend>
                <div aria-hidden className="flex items-center gap-2 text-[13.5px] font-[650]">
                  <Ico icon={g.icon} size={18} ia={g.ia} ib={g.ib} />
                  {g.name}
                </div>
                <div className={cx('mt-3 grid gap-x-4 gap-y-2', g.name === 'Expected visitors' || g.name === 'Budget simulator' ? 'grid-cols-[auto_minmax(0,1fr)] items-start max-[480px]:grid-cols-1' : 'grid-cols-3 max-[560px]:grid-cols-1')}>
                  {FIELDS.filter((f) => f.group === g.name).map((f) => field(f.key))}
                  {g.name === 'Expected visitors' || g.name === 'Budget simulator' ? <div className="min-w-0">{visual[g.name]}</div> : null}
                </div>
                {g.name === 'Cost thresholds' ? visual[g.name] : null}
              </fieldset>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button type="submit" variant="primary" disabled={saving || hasErrors || !changed.length}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
            <Button type="button" variant="ghost" onClick={discard} disabled={saving || !changed.length}>
              Discard edits
            </Button>
            {hasErrors ? <span className="text-[12.5px] font-[600] text-st-stop">Fix the values marked in red to save.</span> : <span className="text-[12.5px] font-[550] text-ink-2">Saving recomputes every view of the app.</span>}
          </div>
        </form>
      )}
    </Tile>
  );
}
