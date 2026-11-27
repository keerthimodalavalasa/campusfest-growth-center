'use client';
import { useId, useState } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { mutate } from '@/lib/api';
import { useApp } from '@/lib/app-state';
import { Button, Dialog, Field, Select, TextArea, TextInput } from '@/components/ui';
import { channelLabel } from './shared';

interface Form {
  name: string;
  channel: string;
  owner: string;
  objective: string;
  audience: string;
  status: 'planned' | 'active';
  budget: string;
  start: string;
  end: string;
}
const EMPTY: Form = { name: '', channel: '', owner: '', objective: '', audience: '', status: 'planned', budget: '', start: '', end: '' };

/** Create a campaign. On success it toasts with a link and reports the new ID to the page. */
export function NewCampaignDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string, name: string) => void }) {
  const { meta } = useApp();
  const router = useRouter();
  const listId = useId();
  const [f, setF] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // start from a blank form each time the dialog opens
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setF(EMPTY);
      setErrors({});
      setServerError(null);
    }
  }

  const channels = [...new Set((meta?.campaigns ?? []).map((c) => c.channel).filter((c): c is string => !!c))].sort();
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((s) => ({ ...s, [k]: v }));

  const validate = () => {
    const e: Partial<Record<keyof Form, string>> = {};
    if (!f.name.trim()) e.name = 'Give the campaign a name.';
    else if (meta?.campaigns.some((c) => c.name.trim().toLowerCase() === f.name.trim().toLowerCase())) e.name = 'A campaign with this name already exists. Use a distinct name.';
    if (f.budget.trim()) {
      const b = Number(f.budget.replace(/[,\s₹]/g, ''));
      if (!Number.isFinite(b) || b < 0) e.budget = 'Enter the budget in rupees as a whole number, e.g. 25000.';
    }
    if (f.start && f.end && f.end < f.start) e.end = 'The end date must be on or after the start date.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    setServerError(null);
    const name = f.name.trim();
    try {
      const channel = f.channel.trim().toLowerCase().replace(/\s+/g, '_');
      const out = await mutate<{ id: string }>('/api/campaigns', 'POST', {
        campaign_name: name,
        channel: channel || null,
        owner_id: f.owner || null,
        objective: f.objective.trim() || null,
        target_audience: f.audience.trim() || null,
        status: f.status,
        planned_budget_inr: f.budget.trim() ? Math.round(Number(f.budget.replace(/[,\s₹]/g, ''))) : null,
        planned_start_at: f.start || null,
        planned_end_at: f.end || null,
      });
      toast.success(`Created ${name} (${out.id})`, { action: { label: 'Open campaign', onClick: () => router.push(`/campaigns/${out.id}`) } });
      onCreated(out.id, name);
      onClose();
    } catch (e) {
      setServerError(`Could not create the campaign: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="New campaign" width={600}>
      <form
        className="grid gap-3"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Field label="Name" error={errors.name}>
          <TextInput value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Hostel WhatsApp squads" autoFocus required aria-invalid={!!errors.name} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Channel" hint="Pick an existing channel to compare like with like.">
            <TextInput value={f.channel} onChange={(e) => set('channel', e.target.value)} list={listId} placeholder="e.g. referrals" />
          </Field>
          <datalist id={listId}>
            {channels.map((c) => (
              <option key={c} value={c}>
                {channelLabel(c)}
              </option>
            ))}
          </datalist>
          <Field label="Owner">
            <Select value={f.owner} onChange={(e) => set('owner', e.target.value)}>
              <option value="">Unassigned</option>
              {meta?.team.map((t) => (
                <option key={t.ownerId} value={t.ownerId}>
                  {t.ownerName}
                  {t.role ? ` (${t.role})` : ''}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Objective">
          <TextArea value={f.objective} onChange={(e) => set('objective', e.target.value)} className="min-h-16" placeholder="What this campaign must prove or deliver" />
        </Field>
        <Field label="Target audience">
          <TextInput value={f.audience} onChange={(e) => set('audience', e.target.value)} placeholder="e.g. First-year engineering students in Hyderabad" />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Status">
            <Select value={f.status} onChange={(e) => set('status', e.target.value as Form['status'])}>
              <option value="planned">Planned</option>
              <option value="active">Active</option>
            </Select>
          </Field>
          <Field label="Planned budget (INR)" error={errors.budget}>
            <TextInput value={f.budget} onChange={(e) => set('budget', e.target.value)} inputMode="numeric" placeholder="e.g. 25000" className="num" aria-invalid={!!errors.budget} />
          </Field>
          <Field label="Planned start">
            <TextInput type="date" value={f.start} onChange={(e) => set('start', e.target.value)} />
          </Field>
          <Field label="Planned end" error={errors.end}>
            <TextInput type="date" value={f.end} min={f.start || undefined} onChange={(e) => set('end', e.target.value)} aria-invalid={!!errors.end} />
          </Field>
        </div>
        {serverError ? (
          <p role="alert" className="text-[0.85rem] text-lac">
            {serverError}
          </p>
        ) : null}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? 'Creating…' : 'Create campaign'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
