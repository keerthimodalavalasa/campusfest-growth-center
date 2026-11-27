'use client';
import { useState } from 'react';
import { toast } from 'sonner';
import type { Campaign } from '@/server/engine/types';
import { mutate } from '@/lib/api';
import { inr, pct } from '@/lib/format';
import { Button, Field, Meter, Select, TextArea, TextInput } from '@/components/ui';
import { CAMPAIGN_STATUSES, statusLabel } from './shared';

interface Draft {
  status: string;
  budget: string;
  notes: string;
}

/** Status, planned budget and notes, saved together with PATCH /api/campaigns/{id}. */
export function ManagePanel({ campaign, spend }: { campaign: Campaign; spend: number }) {
  const original: Draft = { status: campaign.status, budget: campaign.plannedBudget == null ? '' : String(campaign.plannedBudget), notes: campaign.notes ?? '' };
  // null = showing the saved values; a draft exists only while the user is editing
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // once the refetched campaign arrives with new saved values, drop the draft (avoids a flash of old values)
  const savedKey = `${campaign.campaignId}|${original.status}|${original.budget}|${original.notes}`;
  const [seenKey, setSeenKey] = useState(savedKey);
  if (seenKey !== savedKey) {
    setSeenKey(savedKey);
    setDraft(null);
  }
  const v = draft ?? original;
  const set = (k: keyof Draft, val: string) => setDraft({ ...v, [k]: val });

  const parsedBudget = v.budget.trim() === '' ? null : Number(v.budget.replace(/[,\s₹]/g, ''));
  const budgetError = parsedBudget != null && (!Number.isFinite(parsedBudget) || parsedBudget < 0) ? 'Enter the budget in rupees as a whole number, e.g. 50000, or leave it empty.' : null;
  const patch: Record<string, unknown> = {};
  if (v.status !== original.status) patch.status = v.status;
  if (!budgetError && (parsedBudget == null ? null : Math.round(parsedBudget)) !== campaign.plannedBudget) patch.planned_budget_inr = parsedBudget == null ? null : Math.round(parsedBudget);
  if (v.notes.trim() !== (campaign.notes ?? '').trim()) patch.notes = v.notes.trim() || null;
  const dirty = Object.keys(patch).length > 0;

  const save = async () => {
    if (budgetError || !dirty) return;
    setSaving(true);
    setError(null);
    try {
      await mutate(`/api/campaigns/${encodeURIComponent(campaign.campaignId)}`, 'PATCH', patch);
      toast.success(`Saved changes to ${campaign.name}`);
    } catch (e) {
      setError(`Could not save: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const budget = campaign.plannedBudget;
  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Status">
          <Select value={v.status} onChange={(e) => set('status', e.target.value)}>
            {CAMPAIGN_STATUSES.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
            {!CAMPAIGN_STATUSES.includes(v.status as never) ? <option value={v.status}>{v.status}</option> : null}
          </Select>
        </Field>
        <Field label="Planned budget (INR)" error={budgetError}>
          <TextInput value={v.budget} onChange={(e) => set('budget', e.target.value)} inputMode="numeric" placeholder="Not set" className="tab" aria-invalid={!!budgetError} />
        </Field>
      </div>
      {budget != null && budget > 0 ? (
        <div>
          <div className="mb-1.5 flex items-baseline justify-between text-[12.5px] text-ink-2">
            <span>
              <b className="tab font-[700] text-ink">{inr(spend)}</b> net spend of <span className="tab">{inr(budget)}</span> planned
            </span>
            <span className="tab font-[700] text-ink">
              {spend > budget ? <span className="mr-1 text-st-stop">over</span> : null}
              {pct(spend / budget, 0)}
            </span>
          </div>
          <Meter value={Math.max(0, spend)} goal={budget} color="var(--haldi)" height={8} />
        </div>
      ) : (
        <p className="text-[12.5px] text-ink-2">No planned budget set. Net spend to date is {inr(spend)}.</p>
      )}
      <Field label="Notes" hint="Context for the team: what changed, what you are testing, what to watch.">
        <TextArea value={v.notes} onChange={(e) => set('notes', e.target.value)} className="min-h-20" />
      </Field>
      {error ? (
        <p role="alert" className="text-[13px] font-[600] text-st-stop">
          {error}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        {dirty ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setDraft(null);
              setError(null);
            }}
          >
            Discard changes
          </Button>
        ) : null}
        <Button type="submit" variant="primary" disabled={!dirty || !!budgetError || saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}
