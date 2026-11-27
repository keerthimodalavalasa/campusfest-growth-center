'use client';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { ApiError, mutate, useApi } from '@/lib/api';
import { useApp, type ColumnSpec } from '@/lib/app-state';
import { dateLabel, inr } from '@/lib/format';
import { Button, Dialog, ErrorNote, Field, Select, TextInput, cx } from '@/components/ui';
import { asText, carryDate, isCampaignCol, isMoney, isNumeric, isOwnerCol, istDate, istMs, singular, tsKey, tsText, type Row, type RowDialogState } from './shared';

const formValue = (c: ColumnSpec, v: unknown) => (c.type === 'ts' ? tsText(asText(v)) : asText(v));

/** Edit or add one source row. Fields are generated from the table's column specs. */
export function RowDialog({ state, onClose, onSaved }: { state: RowDialogState | null; onClose: () => void; onSaved?: (tableKey: string, id: string, mode: 'edit' | 'add') => void }) {
  const { meta, asOf, campaignName, ownerName } = useApp();
  const [vals, setVals] = useState<Record<string, string>>(() => {
    if (!state) return {};
    const o: Record<string, string> = {};
    if (state.row) for (const c of state.table.columns) o[c.name] = formValue(c, state.row[c.name]);
    return { ...o, ...(state.initial ?? {}) };
  });
  const [fieldErr, setFieldErr] = useState<Record<string, string>>({});
  const [formErr, setFormErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const table = state?.table ?? null;
  const editing = state?.mode === 'edit';

  // the original values, normalised the same way as the form (for diffing and "was" hints)
  const original = useMemo(() => {
    const o: Record<string, string> = {};
    if (state?.row && table) for (const c of table.columns) o[c.name] = formValue(c, state.row[c.name]);
    return o;
  }, [state, table]);


  if (!state || !table) return <Dialog open={false} onClose={onClose} title="">{null}</Dialog>;

  const pkValue = editing ? asText(state.row?.[table.pk]) : '';
  const title = editing ? `Edit ${singular(table.key)} ${pkValue}` : `Add ${singular(table.key)}`;
  const visibleCols = table.columns.filter((c) => !(state.mode === 'add' && c.name === table.pk && table.pkGenerated));
  const writable = (c: ColumnSpec) => (editing ? c.editable : c.editable || (c.name === table.pk && !table.pkGenerated));
  const mustFill = (c: ColumnSpec) => !!c.required || (!editing && c.name === table.pk && !table.pkGenerated);

  const changed = editing ? table.columns.filter((c) => c.editable && (vals[c.name] ?? '') !== (original[c.name] ?? '')) : [];
  const carry = carryDate(table, vals);
  const carriesLater = carry && asOf && carry > asOf;
  const versionedAdd = state.mode === 'add' && (table.key === 'targets' || table.key === 'registration_history');

  const set = (name: string, v: string) => {
    setVals((s) => ({ ...s, [name]: v }));
    if (fieldErr[name]) setFieldErr((e) => ({ ...e, [name]: '' }));
  };

  /** Attach an API validation message to the field it names, if any. */
  const routeError = (msg: string) => {
    const col = table.columns.find((c) => msg.startsWith(`${c.label} `) || msg.startsWith(`${c.name} `));
    if (col) setFieldErr({ [col.name]: msg });
    else setFormErr(msg);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFormErr(null);
    const missing: Record<string, string> = {};
    for (const c of visibleCols) if (writable(c) && mustFill(c) && !(vals[c.name] ?? '').trim()) missing[c.name] = `${c.label} is required.`;
    if (Object.keys(missing).length) {
      setFieldErr(missing);
      return;
    }
    setFieldErr({});
    setSaving(true);
    try {
      if (editing) {
        if (!changed.length) {
          setFormErr('Nothing has changed yet. Edit a field, then save.');
          return;
        }
        const patch = Object.fromEntries(changed.map((c) => [c.name, (vals[c.name] ?? '').trim() === '' ? null : vals[c.name].trim()]));
        await mutate(`/api/data/${table.key}/${encodeURIComponent(pkValue)}`, 'PATCH', patch);
        onSaved?.(table.key, pkValue, 'edit');
      } else {
        const body: Record<string, string> = {};
        for (const c of visibleCols) {
          const v = (vals[c.name] ?? '').trim();
          if (v !== '') body[c.name] = v;
        }
        const res = await mutate<{ id: string | number }>(`/api/data/${table.key}`, 'POST', body);
        onSaved?.(table.key, String(res.id), 'add');
      }
      toast.success('Saved. Analytics updated.');
      onClose();
    } catch (err) {
      const msg = err instanceof ApiError || err instanceof Error ? err.message : 'Saving failed.';
      routeError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onClose={onClose} title={title} width={680}>
      <form onSubmit={submit} noValidate className="space-y-4">
        {state.note ? <p className="rounded-[var(--radius-control)] bg-sagar-soft px-3 py-2 text-[0.85rem] text-ink">{state.note}</p> : null}
        <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
          {visibleCols.map((c) => {
            const v = vals[c.name] ?? '';
            const ro = !writable(c);
            const was = editing && c.editable && v !== (original[c.name] ?? '') ? original[c.name] || 'empty' : null;
            const label = `${c.label}${mustFill(c) && !ro ? ' *' : ''}`;
            const hint = was
              ? `Was ${was}`
              : c.type === 'ts'
                ? 'India time (IST)'
                : isCampaignCol(c) && v
                  ? campaignName(v)
                  : isOwnerCol(c) && v
                    ? ownerName(v)
                    : ro && c.name === table.pk
                      ? 'IDs cannot be changed'
                      : isMoney(c) && v.trim() !== '' && Number.isFinite(Number(v.replace(/[,₹\s]/g, '')))
                        ? inr(Number(v.replace(/[,₹\s]/g, '')))
                        : undefined;
            const common = {
              name: c.name,
              value: v,
              disabled: ro,
              'aria-invalid': fieldErr[c.name] ? true : undefined,
              style: fieldErr[c.name] ? { borderColor: 'var(--lac)' } : was ? { borderColor: 'var(--zari-bright)' } : undefined,
            } as const;
            let input;
            if (c.type === 'enum' || c.type === 'bool') {
              const opts = c.type === 'bool' ? ['true', 'false'] : (c.options ?? []);
              input = (
                <Select {...common} onChange={(e) => set(c.name, e.target.value)}>
                  {!c.required || !v ? <option value="">{c.required ? 'Choose…' : 'None'}</option> : null}
                  {opts.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                  {v && !opts.includes(v) ? <option value={v}>{v}</option> : null}
                </Select>
              );
            } else {
              input = (
                <TextInput
                  {...common}
                  type={c.type === 'date' ? 'date' : 'text'}
                  inputMode={isNumeric(c) ? 'decimal' : undefined}
                  placeholder={c.type === 'ts' ? '2025-03-02 10:00' : isNumeric(c) ? '0' : undefined}
                  list={isCampaignCol(c) ? 'gc-data-campaigns' : isOwnerCol(c) ? 'gc-data-owners' : undefined}
                  autoComplete="off"
                  className={cx((isNumeric(c) || c.type === 'ts' || c.type === 'date') && 'num')}
                  onChange={(e) => set(c.name, e.target.value)}
                />
              );
            }
            return (
              <div key={c.name} className={cx(c.name === 'detail' && 'sm:col-span-2')}>
                <Field label={label} hint={hint} error={fieldErr[c.name] || null}>
                  {input}
                </Field>
              </div>
            );
          })}
          {state.mode === 'add' && table.pkGenerated ? <p className="self-end text-[0.82rem] text-ink-3">The {table.columns.find((c) => c.name === table.pk)?.label ?? 'ID'} is assigned when you add the row.</p> : null}
        </div>

        <datalist id="gc-data-campaigns">
          {meta?.campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </datalist>
        <datalist id="gc-data-owners">
          {meta?.team.map((t) => (
            <option key={t.ownerId} value={t.ownerId}>
              {t.ownerName}
            </option>
          ))}
        </datalist>

        {carry && asOf ? (
          <p className={cx('text-[0.84rem]', carriesLater ? 'text-zari' : 'text-ink-2')}>
            {carriesLater ? (
              <>
                This row is dated <span className="num font-semibold">{dateLabel(carry, true)}</span>, after the date you are viewing ({dateLabel(asOf, true)}). It changes nothing on screen until you move the date to {dateLabel(carry)} or later.
              </>
            ) : (
              <>
                This row is dated <span className="num font-semibold">{dateLabel(carry, true)}</span>. {versionedAdd ? 'Views of earlier dates do not change.' : 'It counts from that date onward; views of earlier dates do not change.'}
              </>
            )}
          </p>
        ) : null}

        {versionedAdd ? <VersionContext tableKey={table.key} vals={vals} /> : null}

        {formErr ? <ErrorNote>{formErr}</ErrorNote> : null}

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line pt-3">
          {editing ? <span className="mr-auto text-[0.82rem] text-ink-3">{changed.length ? `${changed.length} field${changed.length > 1 ? 's' : ''} changed` : 'No changes yet'}</span> : null}
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? 'Saving…' : editing ? 'Save changes' : `Add ${singular(table.key)}`}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/**
 * For a new full-state version: what it replaces and whether a later version already overrides it.
 * Recomputed as the effective time or registration ID is typed.
 */
function VersionContext({ tableKey, vals }: { tableKey: string; vals: Record<string, string> }) {
  const { meta } = useApp();
  const at = tsKey(vals.effective_at);
  const regId = tableKey === 'registration_history' ? (vals.registration_id ?? '').trim() : '';
  const [debouncedReg, setDebouncedReg] = useState(regId);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedReg(regId), 400);
    return () => clearTimeout(t);
  }, [regId]);
  const hist = useApi<{ rows: Row[] }>(debouncedReg ? `/api/data/registration_history?q=${encodeURIComponent(debouncedReg)}&limit=200` : null);
  if (!at) return null;

  if (tableKey === 'targets') {
    const ms = istMs(at);
    const list = meta?.targets ?? [];
    const before = list.filter((t) => t.effectiveAt <= ms).pop() ?? null;
    const next = list.find((t) => t.effectiveAt > ms) ?? null;
    return (
      <p className={cx('text-[0.84rem]', next ? 'text-zari' : 'text-ink-2')}>
        {before ? <>It replaces &ldquo;{before.version}&rdquo; from {dateLabel(istDate(ms), true)}. </> : <>No target version is in force before it. </>}
        {next ? (
          <>
            &ldquo;{next.version}&rdquo; already takes effect on <span className="num font-semibold">{dateLabel(istDate(next.effectiveAt), true)}</span>, so this version only applies until then. Dates from then on still show &ldquo;{next.version}&rdquo;.
          </>
        ) : (
          <>It stays in force on every later date until another version is added.</>
        )}
      </p>
    );
  }

  if (!regId || regId !== debouncedReg || !hist.data) return null;
  const versions = hist.data.rows
    .filter((r) => asText(r.registration_id) === regId)
    .sort((a, b) => asText(a.effective_at).localeCompare(asText(b.effective_at)));
  if (!versions.length) return <p className="text-[0.84rem] text-zari">{regId} has no status versions yet. Check the registration ID.</p>;
  const before = versions.filter((r) => asText(r.effective_at) <= at).pop() ?? null;
  const next = versions.find((r) => asText(r.effective_at) > at) ?? null;
  return (
    <p className={cx('text-[0.84rem]', next ? 'text-zari' : 'text-ink-2')}>
      {before ? (
        <>
          Until this version, {regId} is {asText(before.status)} (since {dateLabel(asText(before.effective_at), true)}, {asText(before.history_id)}).{' '}
        </>
      ) : (
        <>This is the first status version of {regId}. </>
      )}
      {next ? (
        <>
          A later version already sets it to {asText(next.status)} on <span className="num font-semibold">{dateLabel(asText(next.effective_at), true)}</span> ({asText(next.history_id)}), so this one only holds until then.
        </>
      ) : (
        <>No later version exists, so this status holds on every later date.</>
      )}
    </p>
  );
}
