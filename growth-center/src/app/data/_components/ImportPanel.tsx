'use client';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { ImportResult } from '@/server/importer';
import { mutate, notifyDataChanged } from '@/lib/api';
import { useApp, type Meta } from '@/lib/app-state';
import { istTime, num } from '@/lib/format';
import { Button, Dialog, ErrorNote, Panel, Skeleton, Table, Td, Th, cx } from '@/components/ui';

type Stats = NonNullable<Meta['importStats']>;
type Phase = { kind: 'idle' } | { kind: 'uploading'; share: number } | { kind: 'importing'; since: number } | { kind: 'resetting'; since: number };

const SHEET_ORDER = ['event', 'targets', 'campaigns', 'daily', 'people', 'interactions', 'registrations', 'history', 'checkins'];
const MAX_BYTES = 15 * 1024 * 1024;

/** Upload a replacement workbook, reset to the original one, and show what the latest import did. */
export function ImportPanel() {
  const { meta } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [err, setErr] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [last, setLast] = useState<{ result: ImportResult; at: string } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [dragging, setDragging] = useState(false);

  const busy = phase.kind !== 'idle';
  useEffect(() => {
    if (phase.kind !== 'importing' && phase.kind !== 'resetting') return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [phase.kind]);

  const pickFile = (f: File | null) => {
    setErr(null);
    if (f && !f.name.toLowerCase().endsWith('.xlsx')) {
      setErr(`${f.name} is not an .xlsx workbook. Export the file from Excel as .xlsx and choose it again.`);
      setFile(null);
      return;
    }
    if (f && f.size > MAX_BYTES) {
      setErr(`${f.name} is larger than 15 MB. Remove unused sheets and try again.`);
      setFile(null);
      return;
    }
    setFile(f);
  };

  const upload = () => {
    if (!file) return;
    setErr(null);
    setPhase({ kind: 'uploading', share: 0 });
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/data/import');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) setPhase({ kind: 'uploading', share: e.loaded / e.total });
    };
    xhr.upload.onload = () => {
      setNow(Date.now());
      setPhase({ kind: 'importing', since: Date.now() });
    };
    xhr.onload = () => {
      let body: unknown = null;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        body = { error: xhr.responseText };
      }
      setPhase({ kind: 'idle' });
      if (xhr.status >= 200 && xhr.status < 300) {
        setLast({ result: body as ImportResult, at: new Date().toISOString() });
        setFile(null);
        if (fileRef.current) fileRef.current.value = '';
        notifyDataChanged();
        toast.success(`Imported ${file.name}. Analytics updated.`);
      } else {
        const msg = (body as { error?: string })?.error ?? `Import failed (${xhr.status}).`;
        setErr(`${msg} Nothing was changed.`);
        toast.error('Import failed. Nothing was changed.');
      }
    };
    xhr.onerror = () => {
      setPhase({ kind: 'idle' });
      setErr('The upload did not reach the server. Check that the app is running and try again.');
    };
    const fd = new FormData();
    fd.append('file', file);
    xhr.send(fd);
  };

  const reset = async () => {
    setConfirmReset(false);
    setErr(null);
    setNow(Date.now());
    setPhase({ kind: 'resetting', since: Date.now() });
    try {
      const result = await mutate<ImportResult>('/api/data/reset', 'POST');
      setLast({ result, at: new Date().toISOString() });
      toast.success('Original data restored. Analytics updated.');
    } catch (e) {
      setErr(`Reset failed: ${(e as Error).message}. The current data is unchanged.`);
      toast.error('Reset failed.');
    } finally {
      setPhase({ kind: 'idle' });
    }
  };

  // prefer the response we just received; otherwise the latest import recorded in the database
  const stats: Stats | null = last ? { at: last.at, source: last.result.source, tables: last.result.tables, warnings: last.result.warnings } : meta?.importStats ?? null;

  return (
    <Panel title="Import or reset the data">
      <p className="text-[0.88rem] text-ink-2">
        Upload an .xlsx with the same sheets as the RISA attendee workbook. It replaces all seven source tables and the event details, applying the import rules (dedupe by ID, IST timestamps). Tasks, initiatives, settings and campaigns added in the app are kept; campaigns from the workbook return to their original details.
      </p>

      {/* Drop zone (pattern after uploadcn.dev): drag a workbook in, or click / press Enter to browse. */}
      <div
        role="button"
        tabIndex={busy ? -1 : 0}
        aria-disabled={busy}
        aria-label="Drop an .xlsx workbook here, or press Enter to choose a file"
        onClick={() => !busy && fileRef.current?.click()}
        onKeyDown={(e) => {
          if (!busy && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            fileRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!busy) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (busy) return;
          const f = e.dataTransfer.files?.[0] ?? null;
          if (f && !/\.xlsx$/i.test(f.name)) {
            setErr(`"${f.name}" is not an .xlsx workbook. Export the sheet as Excel (.xlsx) and drop it again.`);
            return;
          }
          pickFile(f);
        }}
        className={`mt-4 flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[var(--radius-panel)] border-2 border-dashed px-4 py-6 text-center transition-colors ${
          dragging ? 'border-sagar bg-sagar-soft' : 'border-line-2 bg-paper hover:border-ink-3'
        } ${busy ? 'pointer-events-none opacity-60' : ''}`}
      >
        <span className="type-title text-[0.98rem]">{dragging ? 'Drop to choose this workbook' : 'Drop the attendee workbook here'}</span>
        <span className="text-[0.82rem] text-ink-3">or click to browse. .xlsx with the same sheets, up to 15 MB</span>
        <input ref={fileRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={busy} onChange={(e) => pickFile(e.target.files?.[0] ?? null)} className="sr-only" tabIndex={-1} aria-hidden />
      </div>
      {file ? (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-control)] border border-line px-3 py-2">
          <div className="min-w-0">
            <div className="truncate text-[0.88rem] font-semibold text-ink">{file.name}</div>
            <div className="num text-[0.78rem] text-ink-3">{(file.size / 1024 / 1024).toFixed(2)} MB, ready to import</div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                pickFile(null);
                if (fileRef.current) fileRef.current.value = '';
              }}
              disabled={busy}
            >
              Remove
            </Button>
            <Button variant="primary" size="sm" onClick={upload} disabled={busy}>
              {phase.kind === 'uploading' || phase.kind === 'importing' ? 'Importing…' : 'Upload and import'}
            </Button>
          </div>
        </div>
      ) : null}

      {busy ? <Progress phase={phase} now={now} /> : null}
      {err ? (
        <div className="mt-3">
          <ErrorNote>{err}</ErrorNote>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-control)] bg-paper-2 px-3 py-2.5">
        <p className="text-[0.84rem] text-ink-2">Undo every edit and import made here by reloading the original workbook.</p>
        <Button variant="danger" size="sm" onClick={() => setConfirmReset(true)} disabled={busy}>
          Reset to original data
        </Button>
      </div>

      <div className="mt-5">
        {stats ? <ImportStats stats={stats} fresh={!!last} /> : meta ? <p className="text-[0.88rem] text-ink-2">No import has been recorded yet. Upload a workbook or reset to the original data.</p> : <Skeleton className="h-60" />}
      </div>

      <Dialog open={confirmReset} onClose={() => setConfirmReset(false)} title="Reset to original data?" width={500}>
        <div className="space-y-3 text-[0.9rem] text-ink-2">
          <p>This reloads the original RISA attendee workbook (Attendee Dataset.xlsx) and replaces all seven source tables. Every row you added, edited or deleted here, and any workbook you uploaded, is undone. Target versions added in the app are removed too.</p>
          <p>Tasks, initiatives, settings and campaigns added in the app are kept. Campaigns from the dataset return to their original details, so any status, planned budget or notes set on them in the app are reset.</p>
          <div className="flex justify-end gap-2 border-t border-line pt-3">
            <Button variant="ghost" onClick={() => setConfirmReset(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={reset}>
              Reset to original data
            </Button>
          </div>
        </div>
      </Dialog>
    </Panel>
  );
}

function Progress({ phase, now }: { phase: Phase; now: number }) {
  const secs = 'since' in phase ? Math.max(0, Math.round((now - phase.since) / 1000)) : 0;
  const share = phase.kind === 'uploading' ? phase.share : null;
  const label =
    phase.kind === 'uploading'
      ? `Uploading ${Math.round((share ?? 0) * 100)}%`
      : phase.kind === 'importing'
        ? `Uploaded. Importing and checking every sheet, ${secs} s`
        : `Reloading the original workbook, ${secs} s`;
  return (
    <div className="mt-3" role="status" aria-live="polite">
      <div className="mb-1 flex justify-between text-[0.82rem] text-ink-2">
        <span className="num">{label}</span>
        {phase.kind !== 'uploading' ? <span>This can take up to a minute.</span> : null}
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-paper-2">
        <div className={cx('h-full rounded-full bg-sagar', share == null && 'w-1/3 animate-pulse')} style={share != null ? { width: `${Math.max(2, share * 100)}%` } : undefined} />
      </div>
    </div>
  );
}

function ImportStats({ stats, fresh }: { stats: Stats; fresh: boolean }) {
  const keys = [...SHEET_ORDER.filter((k) => k in stats.tables), ...Object.keys(stats.tables).filter((k) => !SHEET_ORDER.includes(k))];
  const rows = keys.map((k) => stats.tables[k]);
  const sum = (f: (r: (typeof rows)[number]) => number) => rows.reduce((a, r) => a + f(r), 0);
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="type-title text-[0.95rem]">{fresh ? 'Result of this import' : 'Latest import'}</h3>
        <span className="text-[0.82rem] text-ink-3">
          {stats.source ?? 'Unknown source'}
          {stats.at ? <span className="num">, {istTime(Date.parse(stats.at))} IST</span> : null}
        </span>
      </div>
      <Table>
        <thead>
          <tr>
            <Th className="text-left">Sheet</Th>
            <Th align="right">Rows read</Th>
            <Th align="right">Imported</Th>
            <Th align="right">Duplicate IDs removed</Th>
            <Th align="right">Conflicting duplicates</Th>
            <Th align="right">Skipped invalid</Th>
          </tr>
        </thead>
        <tbody>
          {keys.map((k) => {
            const r = stats.tables[k];
            return (
              <tr key={k}>
                <Td className="whitespace-nowrap">{r.sheet}</Td>
                <Td align="right">{num(r.rowsRead)}</Td>
                <Td align="right">{num(r.imported)}</Td>
                <Td align="right" className={cx(r.duplicateIds > 0 && 'font-semibold text-ink')}>{num(r.duplicateIds)}</Td>
                <Td align="right" className={cx(r.conflictingDuplicates > 0 && 'font-semibold text-zari')}>{num(r.conflictingDuplicates)}</Td>
                <Td align="right" className={cx(r.skippedInvalid > 0 && 'font-semibold text-zari')}>{num(r.skippedInvalid)}</Td>
              </tr>
            );
          })}
          <tr className="font-semibold">
            <Td>All sheets</Td>
            <Td align="right">{num(sum((r) => r.rowsRead))}</Td>
            <Td align="right">{num(sum((r) => r.imported))}</Td>
            <Td align="right">{num(sum((r) => r.duplicateIds))}</Td>
            <Td align="right">{num(sum((r) => r.conflictingDuplicates))}</Td>
            <Td align="right">{num(sum((r) => r.skippedInvalid))}</Td>
          </tr>
        </tbody>
      </Table>
      <p className="mt-2 text-[0.78rem] text-ink-3">Duplicate IDs removed counts every repeated ID; conflicting duplicates are the subset whose values differed (the first row was kept).</p>
      {stats.warnings.length ? (
        <div className="mt-3 rounded-[var(--radius-control)] border border-zari-bright/50 bg-zari-soft px-3 py-2 text-[0.84rem] text-ink">
          <div className="font-semibold text-zari">
            {stats.warnings.length} warning{stats.warnings.length > 1 ? 's' : ''}
          </div>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {stats.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-1 text-[0.82rem] text-ink-2">No warnings.</p>
      )}
    </div>
  );
}
