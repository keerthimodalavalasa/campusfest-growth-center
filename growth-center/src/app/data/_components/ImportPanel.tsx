'use client';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { toast } from 'sonner';
import { CloudUploadDuotone, FileDuotone, ImportDuotone, RotateCcwDuotone, TriangleAlertDuotone } from 'runeicons-react';
import type { ImportResult } from '@/server/importer';
import { mutate, notifyDataChanged } from '@/lib/api';
import { useApp, type Meta } from '@/lib/app-state';
import { istTime, num } from '@/lib/format';
import { Button, Dialog, ErrorNote, Ico, Skeleton, Table, Td, Th, Tile, TileHead, cx } from '@/components/ui';
import { ChartData } from '@/components/ChartData';
import { HowThisWorks } from '@/components/tiles';

type Stats = NonNullable<Meta['importStats']>;
type Phase = { kind: 'idle' } | { kind: 'uploading'; share: number } | { kind: 'importing'; since: number } | { kind: 'resetting'; since: number };

const SHEET_ORDER = ['event', 'targets', 'campaigns', 'daily', 'people', 'interactions', 'registrations', 'history', 'checkins'];
const MAX_BYTES = 15 * 1024 * 1024;

/** Upload a replacement workbook, reset to the original one, and show what the latest import did. */
export function ImportPanel({ delay }: { delay?: number }) {
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
  const stats: Stats | null = last ? { at: last.at, source: last.result.source, tables: last.result.tables, warnings: last.result.warnings } : (meta?.importStats ?? null);

  return (
    <Tile field="stone" delay={delay} className="flex flex-col" aria-label="Import or reset the data">
      <TileHead icon={ImportDuotone}>
        Import or reset the data
      </TileHead>

      {/* the drop zone is a dashed tile: drag a workbook in, or click / press Enter to browse */}
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
        className={cx(
          'mt-4 flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-tile-m border-2 border-dashed px-4 py-7 text-center transition-[border-color,background-color] duration-150',
          dragging ? 'border-ink bg-stone-2' : 'border-stone-3 hover:border-ink-2 hover:bg-stone-2/50',
          busy && 'pointer-events-none opacity-60',
        )}
      >
        <Ico icon={CloudUploadDuotone} size={34} ia="var(--ink)" ib="var(--stone-3)" />
        <span className="mt-1 text-[15px] font-[650]">{dragging ? 'Drop to choose this workbook' : 'Drop the attendee workbook here'}</span>
        <span className="text-[12.5px] font-[550] text-ink-2">or select to browse: .xlsx, same sheets, up to 15 MB</span>
        <input ref={fileRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={busy} onChange={(e) => pickFile(e.target.files?.[0] ?? null)} className="sr-only" tabIndex={-1} aria-hidden />
      </div>
      {file ? (
        <div className="mt-2 flex flex-wrap items-center gap-3 rounded-tile-m bg-stone-2/60 px-3.5 py-2.5">
          <Ico icon={FileDuotone} size={22} ia="var(--ink)" ib="var(--stone-3)" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13.5px] font-[650]">{file.name}</div>
            <div className="tab text-[12px] font-[550] text-ink-2">{(file.size / 1024 / 1024).toFixed(2)} MB, ready to import</div>
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

      <HowThisWorks label="What an import replaces">
        <p>The workbook needs the same sheets as the RISA attendee workbook. It replaces all seven source tables and the event details, applying the import rules: dedupe by ID, IST timestamps.</p>
        <p>Tasks, initiatives, settings and campaigns added in the app are kept. Campaigns from the workbook return to their original details.</p>
      </HowThisWorks>

      <div className="mt-5">{stats ? <ImportStats stats={stats} fresh={!!last} /> : meta ? <p className="text-[13px] text-ink-2">No import has been recorded yet. Upload a workbook or reset to the original data.</p> : <Skeleton className="h-40" />}</div>

      {/* destructive: set apart, outlined in the stop colour, and always confirmed */}
      <div className="mt-5 flex flex-wrap items-center gap-3 rounded-tile-m px-3.5 py-3 shadow-[inset_0_0_0_1.5px_color-mix(in_srgb,var(--st-stop)_40%,transparent)]">
        <Ico icon={RotateCcwDuotone} size={22} ia="var(--st-stop)" ib="color-mix(in srgb, var(--st-stop) 35%, transparent)" />
        <div className="min-w-0 flex-1 basis-[12rem]">
          <div className="text-[13.5px] font-[650]">Reset to original data</div>
          <div className="text-[12px] font-[550] text-ink-2">Undoes every edit and import made here</div>
        </div>
        <Button variant="danger" size="sm" onClick={() => setConfirmReset(true)} disabled={busy}>
          Reset to original data
        </Button>
      </div>

      <Dialog open={confirmReset} onClose={() => setConfirmReset(false)} title="Reset to original data?" width={500}>
        <div className="space-y-3 text-[13.5px] leading-[1.5] text-ink-2">
          <div className="flex gap-3 rounded-tile-m bg-[#f8dcde] px-3.5 py-3 text-ink">
            <Ico icon={TriangleAlertDuotone} size={20} ia="var(--st-stop)" ib="color-mix(in srgb, var(--st-stop) 35%, transparent)" />
            <p className="font-[600]">This cannot be undone. Every row you added, edited or deleted here, and any workbook you uploaded, is replaced.</p>
          </div>
          <p>It reloads the original RISA attendee workbook (Attendee Dataset.xlsx) into all seven source tables. Target versions added in the app are removed too.</p>
          <p>Tasks, initiatives, settings and campaigns added in the app are kept. Campaigns from the dataset return to their original details, so any status, planned budget or notes set on them in the app are reset.</p>
          <div className="flex justify-end gap-2 pt-3 shadow-[inset_0_1px_0_var(--stone-2)]">
            <Button variant="ghost" onClick={() => setConfirmReset(false)}>
              Keep my data
            </Button>
            <Button variant="danger" onClick={reset} className="!bg-st-stop !text-white !shadow-none hover:!bg-[#a51a24]">
              Reset to original data
            </Button>
          </div>
        </div>
      </Dialog>
    </Tile>
  );
}

function Progress({ phase, now }: { phase: Phase; now: number }) {
  const secs = 'since' in phase ? Math.max(0, Math.round((now - phase.since) / 1000)) : 0;
  const share = phase.kind === 'uploading' ? phase.share : null;
  const label = phase.kind === 'uploading' ? `Uploading ${Math.round((share ?? 0) * 100)}%` : phase.kind === 'importing' ? `Uploaded. Importing and checking every sheet, ${secs} s` : `Reloading the original workbook, ${secs} s`;
  return (
    <div className="mt-3" role="status" aria-live="polite">
      <div className="mb-1 flex justify-between text-[12.5px] font-[550] text-ink-2">
        <span className="tab">{label}</span>
        {phase.kind !== 'uploading' ? <span>This can take up to a minute.</span> : null}
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-stone-2">
        <div className={cx('h-full rounded-full bg-ink', share == null && 'w-1/3 animate-pulse')} style={share != null ? { width: `${Math.max(2, share * 100)}%` } : undefined} />
      </div>
    </div>
  );
}

/** What the latest import did, as four figures; the per-sheet table sits behind View data. */
function ImportStats({ stats, fresh }: { stats: Stats; fresh: boolean }) {
  const keys = [...SHEET_ORDER.filter((k) => k in stats.tables), ...Object.keys(stats.tables).filter((k) => !SHEET_ORDER.includes(k))];
  const rows = keys.map((k) => stats.tables[k]);
  const sum = (f: (r: (typeof rows)[number]) => number) => rows.reduce((a, r) => a + f(r), 0);
  const figures = [
    { label: 'Rows imported', value: sum((r) => r.imported), sub: `of ${num(sum((r) => r.rowsRead))} read` },
    { label: 'Duplicate IDs removed', value: sum((r) => r.duplicateIds), sub: 'repeats of an ID' },
    { label: 'Conflicting duplicates', value: sum((r) => r.conflictingDuplicates), sub: 'first row kept' },
    { label: 'Skipped as invalid', value: sum((r) => r.skippedInvalid), sub: 'failed a check' },
  ];
  return (
    <div>
      <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-[13.5px] font-[650]">{fresh ? 'Result of this import' : 'Latest import'}</h3>
        <span className="text-[12px] font-[550] text-ink-2">
          {stats.source ?? 'Unknown source'}
          {stats.at ? <span className="tab">, {istTime(Date.parse(stats.at))} IST</span> : null}
        </span>
      </div>
      <dl className="grid grid-cols-4 gap-2 max-[640px]:grid-cols-2">
        {figures.map((f, i) => (
          <div key={f.label} className="anim-settle min-w-0 rounded-tile-m bg-stone-2/60 px-3 py-2.5" style={{ '--d': `${200 + i * 40}ms` } as CSSProperties}>
            <dt className="text-[12px] leading-[1.25] font-[600] text-ink-2">{f.label}</dt>
            <dd className="num mt-1.5 text-[28px] leading-none">{num(f.value)}</dd>
            <dd className="mt-1 text-[11.5px] font-[550] text-ink-2">{f.sub}</dd>
          </div>
        ))}
      </dl>
      <ChartData label="View each sheet">
        <Table>
          <thead>
            <tr>
              <Th>Sheet</Th>
              <Th align="right">Rows read</Th>
              <Th align="right">Imported</Th>
              <Th align="right">Duplicate IDs</Th>
              <Th align="right">Conflicting</Th>
              <Th align="right">Skipped</Th>
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
                  <Td align="right" className={cx(r.duplicateIds > 0 && 'font-[700]')}>
                    {num(r.duplicateIds)}
                  </Td>
                  <Td align="right" className={cx(r.conflictingDuplicates > 0 && 'font-[700]')}>
                    {num(r.conflictingDuplicates)}
                  </Td>
                  <Td align="right" className={cx(r.skippedInvalid > 0 && 'font-[700]')}>
                    {num(r.skippedInvalid)}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
        <p className="mt-1.5 text-ink-2">Duplicate IDs counts every repeated ID; conflicting duplicates are the subset whose values differed (the first row was kept).</p>
      </ChartData>
      {stats.warnings.length ? (
        <div className="mt-3 flex gap-2.5 rounded-tile-m bg-stone-2/60 px-3.5 py-3 text-[12.5px] text-ink">
          <Ico icon={TriangleAlertDuotone} size={18} ia="var(--ink)" ib="var(--stone-3)" />
          <div className="min-w-0">
            <div className="font-[650]">
              {stats.warnings.length} warning{stats.warnings.length > 1 ? 's' : ''}
            </div>
            <ul className="mt-0.5 space-y-0.5 text-ink-2">
              {stats.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <p className="mt-2 text-[12.5px] font-[550] text-ink-2">No warnings.</p>
      )}
    </div>
  );
}
