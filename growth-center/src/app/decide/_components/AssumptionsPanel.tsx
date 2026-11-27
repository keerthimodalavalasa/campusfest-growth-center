'use client';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { mutate, type ApiState } from '@/lib/api';
import { dateLabel, inr, pct } from '@/lib/format';
import { Button, ErrorNote, Panel, Skeleton, TextInput, cx } from '@/components/ui';
import { tidy } from './types';

export interface SettingRow {
  key: string;
  value: unknown;
  description: string | null;
}

type Kind = 'share' | 'factor' | 'points' | 'elasticity';

const FIELDS: { key: string; label: string; kind: Kind; group: string; suffix: string }[] = [
  { key: 'showRateAssumption', label: 'Show-rate assumption', kind: 'share', group: 'Expected visitors', suffix: 'share' },
  { key: 'scaleCostFactor', label: 'Scale factor', kind: 'factor', group: 'Efficiency thresholds', suffix: '× median' },
  { key: 'changeCostFactor', label: 'Change factor', kind: 'factor', group: 'Efficiency thresholds', suffix: '× median' },
  { key: 'stopCostFactor', label: 'Stop factor', kind: 'factor', group: 'Efficiency thresholds', suffix: '× median' },
  { key: 'maxOptOutRate', label: 'Opt-out limit', kind: 'share', group: 'Quality guardrails', suffix: 'share' },
  { key: 'maxCancelRateGapPts', label: 'Cancellation gap limit', kind: 'points', group: 'Quality guardrails', suffix: 'pts' },
  { key: 'momentumDropRatio', label: 'Momentum ratio', kind: 'share', group: 'Quality guardrails', suffix: 'share' },
  { key: 'spendElasticity', label: 'Spend elasticity', kind: 'elasticity', group: 'Budget simulator', suffix: 'exponent' },
];
const GROUPS = ['Expected visitors', 'Efficiency thresholds', 'Quality guardrails', 'Budget simulator'];

const parse = (s: string) => {
  const n = Number(s.trim());
  return s.trim() === '' || !Number.isFinite(n) ? null : n;
};

/** Editable decision rules and planning assumptions (GET / PATCH /api/settings). The page fetches GET /api/settings in parallel with the board. */
export function AssumptionsPanel({ q, median, perUnit, asOf }: { q: ApiState<{ settings: SettingRow[] }>; median: number | null; perUnit: string; asOf: string }) {
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
      toast.success(`${changed.length === 1 ? `${changed[0].label} saved` : `${changed.length} assumptions saved`}`, { description: 'The board, thresholds and simulator have been recomputed.' });
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
    if (kind === 'factor') return median != null ? `= ${inr(median * v)} ${perUnit} at the ${dateLabel(asOf)} median of ${inr(median)}` : null;
    if (kind === 'points') return `= ${v} percentage points above the portfolio rate`;
    return `doubling spend gives ${Math.pow(2, v).toFixed(2)}× the visitors`;
  };

  const overrides = server.get('showRateByCampaign')?.value as Record<string, number> | undefined;
  const overrideList = overrides && typeof overrides === 'object' ? Object.entries(overrides) : [];

  return (
    <Panel
      id="assumptions"
      title="Assumptions behind the calls"
      aside={changed.length ? <span className="num text-zari">{changed.length} unsaved {changed.length === 1 ? 'change' : 'changes'}</span> : 'Saved values'}
    >
      <p className="max-w-[90ch] text-[0.88rem] text-ink-2">
        Cost thresholds are multiples of the portfolio median cost {perUnit}
        {median != null ? (
          <>
            {' '}
            (<span className="num font-medium text-ink">{inr(median)}</span> at this date)
          </>
        ) : null}
        , so they move with the data rather than being fixed rupee amounts. Saving recomputes the board, the thresholds and the simulator immediately, for every view of the app.
      </p>
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
          <div className="grid gap-x-6 gap-y-5 lg:grid-cols-2 2xl:grid-cols-4">
            {GROUPS.map((g) => (
              <fieldset key={g} className="min-w-0 space-y-4">
                <legend className="mb-2 text-[0.9rem] font-semibold text-ink">{g}</legend>
                {FIELDS.filter((f) => f.group === g).map((f) => {
                  const err = errors[f.key];
                  const p = preview(f.key, f.kind);
                  const dirty = changed.some((c) => c.key === f.key);
                  const id = `setting-${f.key}`;
                  return (
                    <div key={f.key} className="min-w-0">
                      <label htmlFor={id} className="flex items-baseline justify-between gap-2 text-[0.85rem] font-medium text-ink-2">
                        <span>{f.label}</span>
                        <span className="text-[0.75rem] font-normal text-ink-3">{f.suffix}</span>
                      </label>
                      <div className="mt-1 flex items-center gap-2.5">
                        <div className="w-24 shrink-0">
                          <TextInput
                            id={id}
                            inputMode="decimal"
                            value={form[f.key] ?? ''}
                            onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
                            aria-invalid={!!err}
                            aria-describedby={`${id}-msg ${id}-desc`}
                            className={cx('num text-right', err && 'border-lac', dirty && !err && 'border-zari-bright')}
                          />
                        </div>
                        <span id={`${id}-msg`} className={cx('num min-w-0 flex-1 text-[0.8rem] leading-snug', err ? 'text-lac' : 'text-ink-2')}>
                          {err ?? p}
                        </span>
                      </div>
                      <p id={`${id}-desc`} className="mt-1 text-[0.78rem] leading-snug text-ink-3">
                        {tidy(server.get(f.key)?.description ?? '')}
                      </p>
                    </div>
                  );
                })}
                {g === 'Expected visitors' ? (
                  <p className="text-[0.78rem] text-ink-3">
                    Per-campaign show-rate overrides:{' '}
                    {overrideList.length ? (
                      <span className="num text-ink-2">{overrideList.map(([id, v]) => `${id} ${pct(Number(v))}`).join(', ')}</span>
                    ) : (
                      'none set.'
                    )}{' '}
                    Used only before the event; after it, actual attendance replaces the assumption.
                  </p>
                ) : null}
              </fieldset>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-4">
            <Button type="submit" variant="primary" disabled={saving || hasErrors || !changed.length}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
            <Button type="button" variant="ghost" onClick={discard} disabled={saving || !changed.length}>
              Discard edits
            </Button>
            {hasErrors ? <span className="text-[0.82rem] text-lac">Fix the values marked in red to save.</span> : null}
          </div>
        </form>
      )}
    </Panel>
  );
}
