'use client';
import { FilePlusDuotone, HistoryDuotone, ImportDuotone, PencilDuotone, Trash2Duotone } from 'runeicons-react';
import { useApi } from '@/lib/api';
import { useApp, type TableMeta } from '@/lib/app-state';
import { inr, istTime, num1 } from '@/lib/format';
import { EmptyState, ErrorNote, Ico, Skeleton, Tile, TileHead, cx, type IconComponent } from '@/components/ui';
import { isMoney, isNumeric, tsText } from './shared';

interface Change {
  id: number;
  at: string;
  actor: string;
  entity: string;
  entity_id: string | null;
  action: string;
  detail: unknown;
}

const ACTION: Record<string, string> = { insert: 'Added', update: 'Edited', delete: 'Deleted', import: 'Imported', reset: 'Reset' };
/** Timeline nodes: a delete is the heavy one (solid ink); the rest sit on limestone. */
const NODE: Record<string, { icon: IconComponent; solid?: boolean }> = { insert: { icon: FilePlusDuotone }, update: { icon: PencilDuotone }, delete: { icon: Trash2Duotone, solid: true }, import: { icon: ImportDuotone }, reset: { icon: ImportDuotone } };
type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

/** A logged value formatted like the grid: money in INR, numbers grouped, timestamps without zero seconds. */
function fmt(t: TableMeta | undefined, name: string, v: unknown): string {
  if (v == null || v === '') return 'empty';
  const col = t?.columns.find((c) => c.name === name);
  if (!col) return String(v);
  if (isNumeric(col)) {
    const n = Number(String(v).replace(/[,₹\s]/g, ''));
    if (Number.isFinite(n)) return isMoney(col) ? inr(n) : num1(n);
  }
  if (col.type === 'ts') return tsText(String(v).replace('T', ' '));
  return String(v);
}
/** Column label without a trailing currency sign, so "Spend ₹" reads "Spend ₹5,000". */
const labelOf = (t: TableMeta | undefined, name: string) => (t?.columns.find((col) => col.name === name)?.label ?? name).replace(/ ₹$/, '');

/** One readable line describing what a change did. */
function describe(c: Change, t: TableMeta | undefined): string {
  const d = c.detail;
  if (c.entity === 'dataset') return isObj(d) && d.source ? String(d.source) : 'Workbook import';
  if (c.action === 'update' && isObj(d) && isObj(d.patch)) {
    const before = isObj(d.before) ? d.before : {};
    return Object.entries(d.patch)
      .map(([k, v]) => `${labelOf(t, k)}: ${fmt(t, k, before[k])} to ${fmt(t, k, v)}`)
      .join('; ');
  }
  const values = c.action === 'insert' && isObj(d) ? d : c.action === 'delete' && isObj(d) && isObj(d.before) ? d.before : null;
  if (values) return summarise(values, t);
  return '';
}

/** Key values of an added or deleted row, in the table's column order, skipping IDs, owners, blanks and zeros. */
function summarise(values: Obj, t: TableMeta | undefined): string {
  const cols = t ? t.columns.map((col) => col.name) : Object.keys(values);
  return cols
    .filter((k) => k !== t?.pk && k !== 'owner_id' && k in values)
    .filter((k) => {
      const v = values[k];
      return v != null && v !== '' && v !== 0 && v !== '0';
    })
    .slice(0, 4)
    .map((k) => `${labelOf(t, k)} ${fmt(t, k, values[k])}`)
    .join('; ');
}

/** The change log as a timeline, limited to the source tables and dataset imports. */
export function ChangesPanel({ onOpen, delay }: { onOpen: (tableKey: string, id: string) => void; delay?: number }) {
  const { meta } = useApp();
  const q = useApi<{ changes: Change[] }>('/api/changes');
  const tables = new Map((meta?.tables ?? []).map((t) => [t.key, t]));
  const rows = q.data?.changes.filter((c) => c.entity === 'dataset' || tables.has(c.entity)) ?? [];
  // a row deleted after this change can no longer be opened
  const gone = (c: Change) => rows.some((o) => o.id > c.id && o.entity === c.entity && o.entity_id === c.entity_id && o.action === 'delete');

  return (
    <Tile field="stone" delay={delay} className="flex flex-col" aria-label="Recent data changes">
      <TileHead icon={HistoryDuotone} aside={q.data ? <span className="tab">{rows.length} shown</span> : null}>
        Recent data changes
      </TileHead>
      {q.error ? (
        <div className="mt-3">
          <ErrorNote onRetry={q.refresh}>Could not load the change log: {q.error}</ErrorNote>
        </div>
      ) : !q.data || !meta ? (
        <Skeleton className="mt-3 h-60" />
      ) : rows.length === 0 ? (
        <div className="mt-3">
          <EmptyState title="No data changes yet">Edit a row in the source tables, or try one of the examples beside them. Each save is listed here.</EmptyState>
        </div>
      ) : (
        <div role="region" aria-label="Data changes, newest first" tabIndex={0} className="-mx-2 mt-3 max-h-[560px] overflow-y-auto px-2">
          <ol>
            {rows.map((c, i) => {
              const t = tables.get(c.entity);
              const what = describe(c, t);
              const at = Date.parse(c.at);
              const [day, time] = Number.isFinite(at) ? istTime(at).split(', ') : [c.at, ''];
              const prevAt = i ? Date.parse(rows[i - 1].at) : NaN;
              const newDay = !i || !Number.isFinite(prevAt) || istTime(prevAt).split(', ')[0] !== day;
              const node = NODE[c.action] ?? NODE.update;
              const last = i === rows.length - 1;
              const openable = t && c.entity_id && c.action !== 'delete' && !gone(c);
              return (
                <li key={c.id}>
                  {newDay ? <div className={cx('tab pb-2 text-[12px] font-[700] text-ink', i > 0 && 'pt-1')}>{day}</div> : null}
                  <div className="relative grid grid-cols-[28px_minmax(0,1fr)] gap-x-3 pb-3.5">
                    {!last ? <i aria-hidden className="absolute top-8 bottom-0 left-[13.25px] block w-[1.5px] rounded-full bg-stone-3" /> : null}
                    <span className={cx('grid size-7 place-items-center rounded-full', node.solid ? 'bg-ink' : 'bg-stone-2')} aria-hidden>
                      <Ico icon={node.icon} size={15} ia={node.solid ? '#fff' : 'var(--ink)'} ib={node.solid ? 'rgba(255,255,255,0.55)' : 'var(--ink-2)'} />
                    </span>
                    <div className="min-w-0 pt-0.5">
                      <div className="flex flex-wrap items-baseline gap-x-1.5 text-[13px] leading-[1.35]">
                        <span className="font-[650]">{ACTION[c.action] ?? c.action}</span>
                        {openable ? (
                          <button type="button" className="tab font-[650] underline decoration-stone-3 underline-offset-2 hover:decoration-ink" onClick={() => onOpen(t.key, c.entity_id!)} aria-label={`Show ${c.entity_id} in ${t.label}`}>
                            {c.entity_id}
                          </button>
                        ) : (
                          <span className="tab font-[600]">{c.entity_id ?? 'all tables'}</span>
                        )}
                        {t ? <span className="text-[12px] font-[550] text-ink-2">in {t.label}</span> : null}
                      </div>
                      {what ? (
                        <div className="mt-0.5 line-clamp-2 text-[12px] leading-[1.4] text-ink-2" title={what}>
                          {what}
                        </div>
                      ) : null}
                      <div className="tab mt-0.5 text-[11.5px] font-[550] text-ink-2">
                        {time ? `${time} IST, ` : ''}
                        <span className="capitalize">{c.actor}</span>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </Tile>
  );
}
