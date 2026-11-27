'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { useApi } from '@/lib/api';
import { useApp, type ColumnSpec, type TableMeta } from '@/lib/app-state';
import { dateLabel, inr, num, num1 } from '@/lib/format';
import { Button, Chip, EmptyState, ErrorNote, Panel, Skeleton, Table, Tabs, Td, TextInput, Th, cx } from '@/components/ui';
import { CampaignDot } from '@/components/charts';
import { SEARCHES, SEARCH_SHORT, VERSIONED, asText, carryDate, isCampaignCol, isMoney, isNumeric, isOwnerCol, singular, type Row } from './shared';

const PAGE = 50;

interface Props {
  tables: TableMeta[];
  table: TableMeta;
  onTable: (key: string) => void;
  query: string;
  onQuery: (q: string) => void;
  onEdit: (row: Row) => void;
  onAdd: () => void;
  onNewVersion: (row: Row) => void;
  onDelete: (row: Row) => void;
}

/** Table picker, debounced search and a paginated grid of one source table. */
export function TableBrowser({ tables, table, onTable, query, onQuery, onEdit, onAdd, onNewVersion, onDelete }: Props) {
  const { asOf } = useApp();
  const [input, setInput] = useState(query);
  const [syncedQuery, setSyncedQuery] = useState(query);
  if (query !== syncedQuery) {
    // an outside change (deep link, quick action, table switch) replaces what is typed
    setSyncedQuery(query);
    setInput(query);
  }
  useEffect(() => {
    if (input === query) return;
    const t = setTimeout(() => onQuery(input), 300);
    return () => clearTimeout(t);
  }, [input, query, onQuery]);

  // offset resets whenever the table or the applied search changes
  const scope = `${table.key}|${query}`;
  const [pager, setPager] = useState({ scope, offset: 0 });
  const offset = pager.scope === scope ? pager.offset : 0;
  const goTo = (o: number) => setPager({ scope, offset: Math.max(0, o) });

  const url = `/api/data/${table.key}?q=${encodeURIComponent(query)}&limit=${PAGE}&offset=${offset}`;
  const res = useApi<{ total: number; rows: Row[] }>(url);
  const d = res.data;
  const matches = !!d && (d.rows.length === 0 || (Object.keys(d.rows[0]).length === table.columns.length && table.columns.every((c) => c.name in d.rows[0])));
  const data = matches ? d : null;
  const versioned = VERSIONED.has(table.key);

  // time travel: rows dated after the viewed date do not count at it; for targets, mark the version in force
  const isLater = (r: Row) => {
    const d = carryDate(table, r);
    return !!(d && asOf && d > asOf);
  };
  const laterCount = data ? data.rows.filter(isLater).length : 0;
  const inForceId =
    table.key === 'targets' && data && asOf
      ? (data.rows
          .filter((r) => asText(r.effective_at) !== '' && asText(r.effective_at) <= `${asOf} 23:59:59`)
          .sort((a, b) => asText(a.effective_at).localeCompare(asText(b.effective_at)))
          .map((r) => asText(r[table.pk]))
          .pop() ?? null)
      : null;

  return (
    <Panel
      id="table-browser"
      title="Source tables"
      aside={
        <Button size="sm" variant="primary" onClick={onAdd} disabled={!table.insertable}>
          Add {singular(table.key)}
        </Button>
      }
    >
      <div className="-mx-1 overflow-x-auto whitespace-nowrap px-1 pb-1">
        <Tabs value={table.key} onChange={onTable} options={tables.map((t) => ({ value: t.key, label: t.label }))} />
      </div>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <p className="max-w-[68ch] text-[0.88rem] text-ink-2">
          {table.description}
          {versioned ? <span className="text-ink-3"> Use New version on a row to record a change at a date.</span> : null}
        </p>
        <label className="flex w-full flex-col gap-1 text-[0.82rem] sm:w-80">
          <span className="sr-only">
            Search {table.label} by {SEARCHES[table.key] ?? 'any column'}
          </span>
          <TextInput type="search" value={input} onChange={(e) => setInput(e.target.value)} placeholder={`Search ${SEARCH_SHORT[table.key] ?? 'this table'}`} title={`Searches ${SEARCHES[table.key] ?? 'this table'}`} />
        </label>
      </div>

      <div className="mt-3">
        {res.error ? (
          <ErrorNote onRetry={res.refresh}>Could not load {table.label}: {res.error}</ErrorNote>
        ) : !data ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-8" />
            ))}
          </div>
        ) : data.rows.length === 0 ? (
          query ? (
            <EmptyState
              title={`No ${table.label.toLowerCase()} rows match "${query}"`}
              action={
                <Button size="sm" variant="secondary" onClick={() => onQuery('')}>
                  Clear the search
                </Button>
              }
            >
              Search looks in {SEARCHES[table.key] ?? 'this table'}.
            </EmptyState>
          ) : (
            <EmptyState
              title={`${table.label} has no rows`}
              action={
                table.insertable ? (
                  <Button size="sm" variant="secondary" onClick={onAdd}>
                    Add {singular(table.key)}
                  </Button>
                ) : null
              }
            >
              Add a row here or import a workbook below.
            </EmptyState>
          )
        ) : (
          <div className={cx('transition-opacity', res.loading && 'opacity-60')} aria-busy={res.loading}>
            <Table className="max-h-[min(70vh,720px)] overflow-y-auto rounded-[var(--radius-control)] border border-line">
              <thead className="sticky top-0 z-[1] bg-surface">
                <tr>
                  {table.columns.map((c) => (
                    <Th key={c.name} align={isNumeric(c) ? "right" : "left"} className={isNumeric(c) ? undefined : "text-left"}>
                      {c.label}
                    </Th>
                  ))}
                  <Th className="sticky right-0 bg-surface text-right">
                    <span className="sr-only">Row actions</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => {
                  const id = asText(r[table.pk]);
                  const later = isLater(r);
                  return (
                    <tr key={id} className={cx('group hover:bg-paper', later && 'text-ink-3')}>
                      {table.columns.map((c) => (
                        <Cell
                          key={c.name}
                          c={c}
                          v={r[c.name]}
                          pk={c.name === table.pk}
                          later={later}
                          badge={c.name === 'target_version' && id === inForceId ? <Chip className="ml-2 h-5 px-2 text-[0.72rem]" fg="var(--sagar)" bg="var(--sagar-soft)">In force</Chip> : null}
                        />
                      ))}
                      <Td className="sticky right-0 bg-surface whitespace-nowrap text-right text-ink shadow-[-1px_0_0_var(--line)] group-hover:bg-paper">
                        <div className="-my-1 flex justify-end gap-0.5">
                          <RowAction onClick={() => onEdit(r)} label={`Edit ${id}`}>
                            Edit
                          </RowAction>
                          {versioned && table.insertable ? (
                            <RowAction onClick={() => onNewVersion(r)} label={`Add a new version based on ${id}`}>
                              New version
                            </RowAction>
                          ) : null}
                          {table.deletable ? (
                            <RowAction onClick={() => onDelete(r)} label={`Delete ${id}`} danger>
                              Delete
                            </RowAction>
                          ) : null}
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[0.85rem] text-ink-2">
              <span>
                Rows <span className="num font-semibold text-ink">{num(offset + 1)}</span>–<span className="num font-semibold text-ink">{num(offset + data.rows.length)}</span> of{' '}
                <span className="num font-semibold text-ink">{num(data.total)}</span>
                {query ? <> matching &ldquo;{query}&rdquo;</> : null}
                {laterCount && asOf ? (
                  <span className="text-ink-3">
                    . Grey rows (<span className="num">{num(laterCount)}</span> on this page) are dated after {dateLabel(asOf, true)} and do not count at that date.
                  </span>
                ) : null}
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => goTo(offset - PAGE)} disabled={offset === 0 || res.loading}>
                  Previous
                </Button>
                <Button size="sm" variant="secondary" onClick={() => goTo(offset + PAGE)} disabled={offset + PAGE >= data.total || res.loading}>
                  Next
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}

/** Compact text button for per-row actions, so wide tables keep their last columns visible. */
function RowAction({ onClick, label, danger, children }: { onClick: () => void; label: string; danger?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cx('h-7 rounded-md px-1.5 text-[0.82rem] font-medium', danger ? 'text-ink-2 hover:bg-lac-soft hover:text-lac' : 'text-ink-2 hover:bg-paper-2 hover:text-ink')}
    >
      {children}
    </button>
  );
}

function Cell({ c, v, pk, later, badge }: { c: ColumnSpec; v: Row[string]; pk: boolean; later: boolean; badge?: ReactNode }) {
  const { campaignName, ownerName } = useApp();
  if (v == null || v === '') return <Td align={isNumeric(c) ? 'right' : 'left'} className="text-ink-3">–</Td>;
  const s = String(v);
  if (isNumeric(c)) {
    const n = Number(s);
    return (
      <Td align="right" className="whitespace-nowrap">
        {isMoney(c) ? inr(n) : num1(n)}
      </Td>
    );
  }
  if (c.type === 'date') return <Td className="num whitespace-nowrap">{s}</Td>;
  if (c.type === 'ts')
    return (
      <Td className="num whitespace-nowrap">
        {s.slice(0, 16)}
        {s.length > 16 ? <span className="text-ink-3">{s.slice(16)}</span> : null}
      </Td>
    );
  if (isCampaignCol(c))
    return (
      <Td className="whitespace-nowrap" title={campaignName(s)}>
        <CampaignDot id={s}>{s}</CampaignDot>
      </Td>
    );
  if (isOwnerCol(c))
    return (
      <Td className="whitespace-nowrap" title={ownerName(s)}>
        {s}
      </Td>
    );
  if (c.name === 'detail')
    return (
      <Td title={s}>
        <span className="block max-w-[16rem] truncate">{s}</span>
      </Td>
    );
  return (
    <Td className={cx('whitespace-nowrap', pk && 'font-medium', pk && !later && 'text-ink')} title={s.length > 24 ? s : undefined}>
      <span className="flex items-center">
        <span className="block max-w-[13rem] truncate">{s}</span>
        {badge}
      </span>
    </Td>
  );
}
