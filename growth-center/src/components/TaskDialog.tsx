'use client';
import { useState } from 'react';
import { toast } from 'sonner';
import { mutate } from '@/lib/api';
import { useApp } from '@/lib/app-state';
import { addDays, todayIST } from '@/lib/format';
import { Button, Dialog, Field, Select, TextArea, TextInput } from '@/components/ui';

export interface TaskDraft {
  id?: number;
  title?: string;
  description?: string | null;
  campaign_id?: string | null;
  initiative_id?: string | null;
  owner_id?: string | null;
  due_date?: string | null;
  status?: string;
  priority?: string;
  decision?: string | null;
  evidence?: string | null;
  source?: string;
}

/** Create or edit a task. Opening it with a draft (e.g. from an alert) pre-fills the evidence. */
export function TaskDialog({ open, onClose, draft, initiatives = [] }: { open: boolean; onClose: () => void; draft: TaskDraft | null; initiatives?: { id: string; name: string }[] }) {
  // the form remounts (fresh state from the draft) every time the dialog opens
  return (
    <Dialog open={open} onClose={onClose} title={draft?.id ? 'Edit task' : 'Create task'}>
      {open ? <TaskForm key={JSON.stringify(draft ?? {})} draft={draft} onClose={onClose} initiatives={initiatives} /> : null}
    </Dialog>
  );
}

function TaskForm({ onClose, draft, initiatives }: { onClose: () => void; draft: TaskDraft | null; initiatives: { id: string; name: string }[] }) {
  const { meta } = useApp();
  const [f, setF] = useState<TaskDraft>(() => ({ status: 'todo', priority: 'medium', due_date: addDays(todayIST(), 7), ...(draft ?? {}) }));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const set = (k: keyof TaskDraft, v: string) => setF((s) => ({ ...s, [k]: v === '' ? null : v }));
  const editing = !!f.id;

  const save = async () => {
    if (!f.title?.trim()) {
      setErr('Give the task a title.');
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const payload = { title: f.title, description: f.description, campaign_id: f.campaign_id, initiative_id: f.initiative_id, owner_id: f.owner_id, due_date: f.due_date, status: f.status, priority: f.priority, decision: f.decision, evidence: f.evidence, ...(editing ? {} : { source: f.source ?? 'manual' }) };
      if (editing) await mutate(`/api/tasks/${f.id}`, 'PATCH', payload);
      else await mutate('/api/tasks', 'POST', payload);
      toast.success(editing ? 'Task updated' : 'Task created');
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
      <div className="grid gap-3">
        <Field label="Title">
          <TextInput value={f.title ?? ''} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Pause Paid Social prospecting until new creative is ready" autoFocus />
        </Field>
        <Field label="What and why">
          <TextArea value={f.description ?? ''} onChange={(e) => set('description', e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Owner">
            <Select value={f.owner_id ?? ''} onChange={(e) => set('owner_id', e.target.value)}>
              <option value="">Unassigned</option>
              {meta?.team.map((t) => (
                <option key={t.ownerId} value={t.ownerId}>
                  {t.ownerName}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Due date">
            <TextInput type="date" value={f.due_date ?? ''} onChange={(e) => set('due_date', e.target.value)} />
          </Field>
          <Field label="Campaign">
            <Select value={f.campaign_id ?? ''} onChange={(e) => set('campaign_id', e.target.value)}>
              <option value="">None</option>
              {meta?.campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="2027 bet">
            <Select value={f.initiative_id ?? ''} onChange={(e) => set('initiative_id', e.target.value)}>
              <option value="">None</option>
              {initiatives.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Priority">
            <Select value={f.priority ?? 'medium'} onChange={(e) => set('priority', e.target.value)}>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </Select>
          </Field>
          <Field label="Decision">
            <Select value={f.decision ?? ''} onChange={(e) => set('decision', e.target.value)}>
              <option value="">None</option>
              <option value="scale">Scale</option>
              <option value="change">Change</option>
              <option value="stop">Stop</option>
              <option value="fix">Fix</option>
              <option value="monitor">Monitor</option>
            </Select>
          </Field>
          {editing ? (
            <Field label="Status">
              <Select value={f.status ?? 'todo'} onChange={(e) => set('status', e.target.value)}>
                <option value="todo">To do</option>
                <option value="in_progress">In progress</option>
                <option value="blocked">Blocked</option>
                <option value="done">Done</option>
              </Select>
            </Field>
          ) : null}
        </div>
        <Field label="Evidence" hint="The numbers behind this task, so the owner knows why it matters.">
          <TextArea value={f.evidence ?? ''} onChange={(e) => set('evidence', e.target.value)} className="min-h-14" />
        </Field>
        {err ? <p className="text-[0.85rem] text-lac">{err}</p> : null}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Create task'}
          </Button>
        </div>
      </div>
  );
}
