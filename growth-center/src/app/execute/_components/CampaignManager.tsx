'use client';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { api, mutate } from '@/lib/api';
import type { MetaCampaign, TeamMember } from '@/lib/app-state';
import { dateLabel, inr, pct } from '@/lib/format';
import { CampaignDot } from '@/components/charts';
import { Button, Chip, Dialog, Field, Select, Table, Td, TextArea, TextInput, Th } from '@/components/ui';
import { CAMPAIGN_STATUS_LABEL, CAMPAIGN_STATUSES, groupIN, parseInr, type ChangeRow } from './model';
import { MiniSelect } from './TaskBits';

interface Props {
  campaigns: MetaCampaign[];
  team: TeamMember[];
  asOf: string | null;
  /** campaignId -> net spend as of the global date (from /api/campaigns); null while loading. */
  spend: Map<string, number> | null;
  changes: ChangeRow[] | null;
  /** First date of the dataset; used to read campaign notes cheaply. */
  historyStart: string | null;
}

/**
 * Notes are not part of /api/meta, so they are read once from /api/campaigns/{id}, one campaign at a time
 * (at the first history date, the cheapest snapshot) so the page's other requests are not queued behind them.
 * Later edits (from this page or the copilot) are taken from the change log, which records every notes patch.
 */
function useCampaignNotes(ids: string[], changes: ChangeRow[] | null, cheapDate: string | null) {
  const [base, setBase] = useState<{ notes: Record<string, string | null>; upTo: number }>({ notes: {}, upTo: 0 });
  const [error, setError] = useState<string | null>(null);
  const key = ids.join(',');
  const lastImport = useMemo(() => changes?.find((c) => c.entity === 'dataset')?.id ?? 0, [changes]);
  const changesRef = useRef(changes);
  useEffect(() => {
    changesRef.current = changes;
  });

  useEffect(() => {
    if (!key) return;
    let alive = true;
    const upTo = changesRef.current?.[0]?.id ?? 0;
    setBase({ notes: {}, upTo });
    (async () => {
      for (const id of key.split(',')) {
        const r = await api<{ campaign: { notes: string | null } | null }>(`/api/campaigns/${encodeURIComponent(id)}${cheapDate ? `?asOf=${cheapDate}` : ''}`);
        if (!alive) return;
        setBase((b) => ({ ...b, notes: { ...b.notes, [id]: r.campaign?.notes ?? null } }));
      }
      if (alive) setError(null);
    })().catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [key, lastImport, cheapDate]);

  return useMemo(() => {
    const out: Record<string, string | null | undefined> = { ...base.notes };
    const seen = new Set<string>();
    for (const c of changes ?? []) {
      if (c.id <= base.upTo) break; // changes are newest first
      if (c.entity !== 'campaign' || !c.entity_id || seen.has(c.entity_id)) continue;
      const d = c.detail as Record<string, unknown> | null;
      if (d && 'notes' in d) {
        // only overlay once the base value is in, so a half-loaded row stays disabled
        if (c.entity_id in base.notes) out[c.entity_id] = (d.notes as string | null) ?? null;
        seen.add(c.entity_id);
      }
    }
    return { notes: out, error };
  }, [base, changes, error]);
}

export function CampaignManager({ campaigns, team, asOf, spend, changes, historyStart }: Props) {
  const [creating, setCreating] = useState(false);
  const { notes, error: notesError } = useCampaignNotes(
    campaigns.map((c) => c.id),
    changes,
    historyStart,
  );

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-[70ch] text-[0.85rem] text-ink-2">Status and owner save as soon as you pick them. Budget and notes save when you leave the field. Every change goes to the activity log, and analytics refresh straight away.</p>
        <Button variant="secondary" onClick={() => setCreating(true)}>
          New campaign
        </Button>
      </div>
      {notesError ? <p className="mb-2 text-[0.82rem] text-lac">Could not load campaign notes ({notesError}). Notes are read-only until the page is reloaded.</p> : null}
      <Table>
        <thead>
          <tr>
            <Th className="text-left">Campaign</Th>
            <Th className="text-left">Origin</Th>
            <Th className="text-left">Status</Th>
            <Th className="text-left">Owner</Th>
            <Th align="right">Planned budget</Th>
            <Th align="right">Net spend{asOf ? ` by ${dateLabel(asOf)}` : ''}</Th>
            <Th className="min-w-[14rem] text-left">Notes</Th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((c) => (
            <CampaignRow key={c.id} c={c} team={team} spend={spend ? (spend.get(c.id) ?? 0) : null} notes={notes[c.id]} notesFailed={!!notesError && notes[c.id] === undefined} />
          ))}
        </tbody>
      </Table>
      <NewCampaignDialog open={creating} onClose={() => setCreating(false)} team={team} />
    </>
  );
}

async function saveCampaign(c: MetaCampaign, patch: Record<string, unknown>, what: string) {
  try {
    await mutate(`/api/campaigns/${encodeURIComponent(c.id)}`, 'PATCH', patch);
    toast.success(`${c.name}: ${what} saved`);
    return true;
  } catch (e) {
    toast.error(`Could not save ${what} for ${c.name}: ${(e as Error).message}`);
    return false;
  }
}

/** Local copy of a server value: it follows server changes unless the user is editing the field at that moment. */
function useDraft<T>(server: T, editing: boolean) {
  const [v, setV] = useState(server);
  const editingRef = useRef(editing);
  useEffect(() => {
    editingRef.current = editing;
  });
  useEffect(() => {
    if (!editingRef.current) setV(server);
  }, [server]);
  return [v, setV] as const;
}

function CampaignRow({ c, team, spend, notes, notesFailed }: { c: MetaCampaign; team: TeamMember[]; spend: number | null; notes: string | null | undefined; notesFailed: boolean }) {
  const [focus, setFocus] = useState<'budget' | 'notes' | null>(null);
  const [status, setStatus] = useDraft(c.status, false);
  const [owner, setOwner] = useDraft(c.ownerId ?? '', false);
  const [budget, setBudget] = useDraft(groupIN(c.plannedBudget), focus === 'budget');
  const [note, setNote] = useDraft(notes ?? '', focus === 'notes');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const remove = async () => {
    setDeleting(true);
    try {
      await mutate(`/api/campaigns/${c.id}`, 'DELETE');
      toast.success(`Deleted ${c.name}`);
      setConfirmDelete(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  const commitBudget = async () => {
    setFocus(null);
    const n = parseInr(budget);
    if (n === undefined) {
      toast.error(`Planned budget for ${c.name} must be a number of rupees, for example 50,000.`);
      setBudget(groupIN(c.plannedBudget));
      return;
    }
    if (n === c.plannedBudget) {
      setBudget(groupIN(n));
      return;
    }
    setBudget(groupIN(n));
    if (!(await saveCampaign(c, { planned_budget_inr: n }, 'planned budget'))) setBudget(groupIN(c.plannedBudget));
  };
  const commitNotes = async () => {
    setFocus(null);
    const next = note.trim();
    if (notes === undefined || next === (notes ?? '').trim()) return;
    if (!(await saveCampaign(c, { notes: next || null }, 'notes'))) setNote(notes ?? '');
  };

  const share = spend != null && c.plannedBudget ? spend / c.plannedBudget : null;
  return (
    <tr className="hover:bg-paper">
      <Td className="whitespace-nowrap">
        <Link href={`/campaigns/${c.id}`} className="font-medium text-ink hover:underline">
          <CampaignDot id={c.id}>{c.name}</CampaignDot>
        </Link>
        <div className="pl-[18px] text-[0.75rem] text-ink-3">
          {c.id}
          {c.channel ? `, ${c.channel.replace(/_/g, ' ')}` : ''}
        </div>
      </Td>
      <Td>
        {c.origin === 'app' ? (
          <div className="flex items-center gap-1">
            <Chip fg="var(--sagar)" bg="var(--sagar-soft)">Added in app</Chip>
            <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(true)} aria-label={`Delete ${c.name}`}>
              Delete
            </Button>
            <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)} title={`Delete ${c.name}?`} width={460}>
              <div className="space-y-3 text-[0.9rem] text-ink-2">
                <p>This removes the campaign. Tasks linked to it stay on the board without a campaign. Campaigns that already have data rows cannot be deleted; set them to stopped instead.</p>
                <div className="flex justify-end gap-2 border-t border-line pt-3">
                  <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                    Cancel
                  </Button>
                  <Button variant="danger" onClick={remove} disabled={deleting}>
                    {deleting ? 'Deleting…' : 'Delete campaign'}
                  </Button>
                </div>
              </div>
            </Dialog>
          </div>
        ) : (
          <Chip>Dataset</Chip>
        )}
      </Td>
      <Td>
        <MiniSelect
          aria-label={`Status of ${c.name}`}
          value={status}
          onChange={async (e) => {
            const v = e.target.value;
            setStatus(v);
            if (!(await saveCampaign(c, { status: v }, 'status'))) setStatus(c.status);
          }}
          className="h-8 text-[0.82rem] text-ink"
        >
          {CAMPAIGN_STATUSES.map((s) => (
            <option key={s} value={s}>
              {CAMPAIGN_STATUS_LABEL[s]}
            </option>
          ))}
          {!CAMPAIGN_STATUSES.includes(status as never) ? <option value={status}>{status}</option> : null}
        </MiniSelect>
      </Td>
      <Td>
        <MiniSelect
          aria-label={`Owner of ${c.name}`}
          value={owner}
          onChange={async (e) => {
            const v = e.target.value;
            setOwner(v);
            if (!(await saveCampaign(c, { owner_id: v || null }, 'owner'))) setOwner(c.ownerId ?? '');
          }}
          className="h-8 max-w-[11rem] text-[0.82rem] text-ink"
        >
          <option value="">Unassigned</option>
          {team.map((t) => (
            <option key={t.ownerId} value={t.ownerId}>
              {t.ownerName}
            </option>
          ))}
        </MiniSelect>
      </Td>
      <Td align="right">
        <label className="relative inline-flex items-center">
          <span className="sr-only">Planned budget for {c.name} in rupees</span>
          <span className="pointer-events-none absolute left-2 text-[0.82rem] text-ink-3" aria-hidden>
            ₹
          </span>
          <input
            inputMode="numeric"
            value={budget}
            placeholder="Not set"
            onFocus={() => setFocus('budget')}
            onChange={(e) => setBudget(e.target.value)}
            onBlur={commitBudget}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
              if (e.key === 'Escape') {
                setBudget(groupIN(c.plannedBudget));
                setFocus(null);
              }
            }}
            className="num h-8 w-[8.5rem] rounded-[6px] border border-line-2 bg-surface pl-5 pr-2 text-right text-[0.85rem] text-ink placeholder:text-ink-3 focus:border-sagar focus:outline-none"
          />
        </label>
      </Td>
      <Td align="right" className="whitespace-nowrap">
        {spend == null ? <span className="inline-block h-3 w-16 animate-pulse rounded bg-paper-2" aria-label="Loading spend" /> : inr(spend)}
        {share != null ? <div className="text-[0.75rem] text-ink-3">{pct(share)} of plan</div> : null}
      </Td>
      <Td>
        <input
          aria-label={`Notes for ${c.name}`}
          value={note}
          disabled={notes === undefined}
          placeholder={notes === undefined ? (notesFailed ? 'Notes unavailable' : 'Loading notes…') : 'Add a note'}
          onFocus={() => setFocus('notes')}
          onChange={(e) => setNote(e.target.value)}
          onBlur={commitNotes}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') {
              setNote(notes ?? '');
              setFocus(null);
            }
          }}
          title={note || undefined}
          className="h-8 w-full min-w-[14rem] rounded-[6px] border border-line-2 bg-surface px-2 text-[0.85rem] text-ink placeholder:text-ink-3 focus:border-sagar focus:outline-none disabled:bg-paper-2"
        />
      </Td>
    </tr>
  );
}

interface NewCampaign {
  campaign_name: string;
  channel: string;
  owner_id: string;
  status: string;
  budget: string;
  planned_start_at: string;
  planned_end_at: string;
  objective: string;
  target_audience: string;
  notes: string;
}
const EMPTY: NewCampaign = { campaign_name: '', channel: '', owner_id: '', status: 'planned', budget: '', planned_start_at: '', planned_end_at: '', objective: '', target_audience: '', notes: '' };

function NewCampaignDialog({ open, onClose, team }: { open: boolean; onClose: () => void; team: TeamMember[] }) {
  const [f, setF] = useState<NewCampaign>(EMPTY);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // start from a blank form every time the dialog opens
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setF(EMPTY);
      setErr(null);
    }
  }
  const set = (k: keyof NewCampaign) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));

  const save = async () => {
    if (!f.campaign_name.trim()) return setErr('Give the campaign a name.');
    const budget = parseInr(f.budget);
    if (budget === undefined) return setErr('Planned budget must be a number of rupees, for example 50,000.');
    if (f.planned_start_at && f.planned_end_at && f.planned_end_at < f.planned_start_at) return setErr('The planned end date is before the start date.');
    setSaving(true);
    setErr(null);
    const blank = (s: string) => (s.trim() ? s.trim() : null);
    try {
      const r = await mutate<{ id: string }>('/api/campaigns', 'POST', {
        campaign_name: f.campaign_name.trim(),
        channel: blank(f.channel),
        owner_id: blank(f.owner_id),
        status: f.status,
        planned_budget_inr: budget,
        planned_start_at: blank(f.planned_start_at),
        planned_end_at: blank(f.planned_end_at),
        objective: blank(f.objective),
        target_audience: blank(f.target_audience),
        notes: blank(f.notes),
      });
      toast.success(`Campaign ${r.id} created`);
      onClose();
    } catch (e) {
      setErr(`Could not create the campaign: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="New campaign" width={560}>
      <div className="grid gap-3">
        <Field label="Name">
          <TextInput value={f.campaign_name} onChange={set('campaign_name')} placeholder="e.g. Hostel notice boards" autoFocus />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Channel" hint="Short code, e.g. offline or paid_social">
            <TextInput value={f.channel} onChange={set('channel')} />
          </Field>
          <Field label="Owner">
            <Select value={f.owner_id} onChange={set('owner_id')}>
              <option value="">Unassigned</option>
              {team.map((t) => (
                <option key={t.ownerId} value={t.ownerId}>
                  {t.ownerName}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status">
            <Select value={f.status} onChange={set('status')}>
              {CAMPAIGN_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {CAMPAIGN_STATUS_LABEL[s]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Planned budget (₹)">
            <TextInput inputMode="numeric" value={f.budget} onChange={set('budget')} placeholder="e.g. 50,000" className="num" />
          </Field>
          <Field label="Planned start">
            <TextInput type="date" value={f.planned_start_at} onChange={set('planned_start_at')} />
          </Field>
          <Field label="Planned end">
            <TextInput type="date" value={f.planned_end_at} onChange={set('planned_end_at')} />
          </Field>
        </div>
        <Field label="Objective">
          <TextInput value={f.objective} onChange={set('objective')} />
        </Field>
        <Field label="Target audience">
          <TextInput value={f.target_audience} onChange={set('target_audience')} />
        </Field>
        <Field label="Notes">
          <TextArea value={f.notes} onChange={set('notes')} className="min-h-14" />
        </Field>
        <p className="text-[0.8rem] text-ink-3">The campaign gets the next free ID (C08, C09 and so on). It has no marketing activity until rows are added on the Data page.</p>
        {err ? <p className="text-[0.85rem] text-lac">{err}</p> : null}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} disabled={saving}>
            {saving ? 'Creating…' : 'Create campaign'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
