'use client';
import { useApi } from '@/lib/api';
import { useApp, type TableMeta } from '@/lib/app-state';
import { inr, istTime, num1 } from '@/lib/format';
import { EmptyState, ErrorNote, Panel, Skeleton, Table, Td, Th } from '@/components/ui';
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

const ACTION: Record<string, string> = { insert: 'Added', update: 'Edited', delete: 'Deleted', import: 'Imported' };
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

/** The change log, limited to the source tables and dataset imports. */
export function ChangesPanel({ onOpen }: { onOpen: (tableKey: string, id: string) => void }) {
  const { meta } = useApp();
  const q = useApi<{ changes: Change[] }>('/api/changes');
  const tables = new Map((meta?.tables ?? []).map((t) => [t.key, t]));
  const rows = q.data?.changes.filter((c) => c.entity === 'dataset' || tables.has(c.entity)) ?? [];
  // a row deleted after this change can no longer be opened
  const gone = (c: Change) => rows.some((o) => o.id > c.id && o.entity === c.entity && o.entity_id === c.entity_id && o.action === 'delete');

  return (
    <Panel title="Recent data changes" aside={q.data ? <span className="num">{rows.length} shown</span> : null}>
      {q.error ? (
        <ErrorNote onRetry={q.refresh}>Could not load the change log: {q.error}</ErrorNote>
      ) : !q.data || !meta ? (
        <Skeleton className="h-60" />
      ) : rows.length === 0 ? (
        <EmptyState title="No data changes yet">Edit a row in the source tables, or try one of the examples in the helper. Each save is listed here.</EmptyState>
      ) : (
        <Table className="max-h-[560px] overflow-y-auto">
          <thead className="sticky top-0 bg-surface">
            <tr>
              <Th className="text-left">Time (IST)</Th>
              <Th className="text-left">Actor</Th>
              <Th className="text-left">Action</Th>
              <Th className="text-left">Row</Th>
              <Th className="text-left">What changed</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const t = tables.get(c.entity);
              const what = describe(c, t);
              return (
                <tr key={c.id} className="align-top">
                  <Td className="num whitespace-nowrap">{istTime(Date.parse(c.at))}</Td>
                  <Td className="whitespace-nowrap capitalize">{c.actor}</Td>
                  <Td className="whitespace-nowrap">{ACTION[c.action] ?? c.action}</Td>
                  <Td className="whitespace-nowrap">
                    {t && c.entity_id && c.action !== 'delete' && !gone(c) ? (
                      <button type="button" className="font-medium text-sagar hover:underline" onClick={() => onOpen(t.key, c.entity_id!)} aria-label={`Show ${c.entity_id} in ${t.label}`}>
                        {c.entity_id}
                      </button>
                    ) : (
                      <span className="text-ink">{c.entity_id ?? 'All tables'}</span>
                    )}
                    {t ? <div className="text-[0.78rem] text-ink-3">{t.label}</div> : null}
                  </Td>
                  <Td className="min-w-[12rem] text-[0.82rem] text-ink-2" title={what}>
                    <span className="line-clamp-2">{what || '–'}</span>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </Panel>
  );
}
