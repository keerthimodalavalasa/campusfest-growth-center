'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { ClockDuotone, FilePlusDuotone, Grid3x3Duotone, PencilDuotone, PlusDuotone, SearchDuotone, Trash2Duotone } from 'runeicons-react';
import { useApi } from '@/lib/api';
import { useApp, type ColumnSpec, type TableMeta } from '@/lib/app-state';
import { dateLabel, inr, num, num1 } from '@/lib/format';
import { Button, Chip, EmptyState, ErrorNote, Ico, Skeleton, Table, Tabs, Td, TextInput, Th, Tile, TileHead, cx, type IconComponent } from '@/components/ui';
import { CampaignDot } from '@/components/charts';
import { tipProps } from '@/components/tooltip';
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
  delay?: number;
}

/** Table picker, debounced search and a paginated grid of one source table, with edit, new version and delete on every row. */
export function TableBrowser({ tables, table, onTable, query, onQuery, onEdit, onAdd, onNewVersion, onDelete, delay }: Props) {
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
    <Tile field="stone" id="table-browser" delay={delay} className="min-w-0 scroll-mt-24" aria-label="Source tables">
      <TileHead
        icon={Grid3x3Duotone}
        aside={
          <Button size="sm" variant="primary" onClick={onAdd} disabled={!table.insertable} icon={<Ico icon={PlusDuotone} size={15} ia="#fff" ib="rgba(255,255,255,0.5)" />}>
            Add {singular(table.key)}
          </Button>
        }
      >
        Source tables
      </TileHead>

      <div className="mt-3 -mx-1 overflow-x-auto px-1 pb-1 whitespace-nowrap">
        <Tabs value={table.key} onChange={onTable} options={tables.map((t) => ({ value: t.key, label: t.label }))} />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-[64ch] text-[12.5px] leading-[1.4] font-[550] text-ink-2">
          {table.description}
          {versioned ? <> Use New version on a row to record a change at a date.</> : null}
        </p>
        <label className="relative flex w-full items-center sm:w-80">
          <span className="sr-only">
            Search {table.label} by {SEARCHES[table.key] ?? 'any column'}
          </span>
          <span className="pointer-events-none absolute left-3">
            <Ico icon={SearchDuotone} size={16} ia="var(--stone-3)" ib="var(--ink-2)" />
          </span>
          <TextInput type="search" value={input} onChange={(e) => setInput(e.target.value)} placeholder={`Search ${SEARCH_SHORT[table.key] ?? 'this table'}`} title={`Searches ${SEARCHES[table.key] ?? 'this table'}`} className="!rounded-full !pl-9" />
        </label>
      </div>

      <div className="mt-3">
        {res.error ? (
          <ErrorNote onRetry={res.refresh}>
            Could not load {table.label}: {res.error}
          </ErrorNote>
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
          <div className={cx('transition-opacity duration-150', res.loading && 'opacity-60')} aria-busy={res.loading}>
            <Table className="max-h-[min(70vh,720px)] overflow-y-auto">
              <thead className="sticky top-0 z-[1] bg-stone">
                <tr>
                  {table.columns.map((c) => (
                    <Th key={c.name} align={isNumeric(c) ? 'right' : 'left'}>
                      {c.label}
                    </Th>
                  ))}
                  <Th align="right" className="sticky right-0 bg-stone">
                    <span className="sr-only">Row actions</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => {
                  const id = asText(r[table.pk]);
                  const later = isLater(r);
                  return (
                    <tr key={id} onDoubleClick={() => onEdit(r)} className={cx('group transition-colors duration-150 hover:bg-stone-2', later && 'text-ink-2')}>
                      {table.columns.map((c) => (
                        <Cell
                          key={c.name}
                          c={c}
                          v={r[c.name]}
                          pk={c.name === table.pk}
                          later={later && c.name === table.pk ? asOf : null}
                          badge={c.name === 'target_version' && id === inForceId ? (
                            <Chip className="ml-2 h-5 px-2 text-[11px]" fg="#fff" bg="var(--ink)">
                              In force
                            </Chip>
                          ) : null}
                        />
                      ))}
                      <Td className="sticky right-0 bg-stone !py-1 text-right whitespace-nowrap shadow-[-1.5px_0_0_var(--stone-2)] transition-colors duration-150 group-hover:bg-stone-2">
                        <div className="flex justify-end gap-0.5">
                          <RowAction onClick={() => onEdit(r)} label={`Edit ${id}`} tip="Edit" icon={PencilDuotone} />
                          {versioned && table.insertable ? <RowAction onClick={() => onNewVersion(r)} label={`Add a new version based on ${id}`} tip="New version" icon={FilePlusDuotone} /> : null}
                          {table.deletable ? <RowAction onClick={() => onDelete(r)} label={`Delete ${id}`} tip="Delete" icon={Trash2Duotone} danger /> : null}
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[12.5px] font-[550] text-ink-2">
              <span>
                Rows{' '}
                <span className="tab font-[700] text-ink">
                  {num(offset + 1)}–{num(offset + data.rows.length)}
                </span>{' '}
                of <span className="tab font-[700] text-ink">{num(data.total)}</span>
                {query ? <> matching &ldquo;{query}&rdquo;</> : null}
                {laterCount && asOf ? (
                  <span className="ml-2 inline-flex items-center gap-1">
                    <Ico icon={ClockDuotone} size={14} ia="var(--ink-2)" ib="var(--stone-3)" />
                    <span className="tab">{num(laterCount)}</span> greyed rows are dated after {dateLabel(asOf, true)}
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
    </Tile>
  );
}

/** Icon-only row action (with its words in a tooltip and the label for assistive tech), so wide tables keep their last columns visible. */
function RowAction({ onClick, label, tip, icon, danger }: { onClick: () => void; label: string; tip: string; icon: IconComponent; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      {...tipProps({ title: tip })}
      className={cx(
        'grid size-7 place-items-center rounded-full transition-[background-color,transform] duration-150 [--ia:var(--ink)] [--ib:var(--stone-3)] active:scale-[0.95]',
        // delete stays quiet until it is the target: the stop colour appears on hover and focus only
        danger ? 'hover:bg-[#f8dcde] hover:[--ia:var(--st-stop)] focus-visible:[--ia:var(--st-stop)]' : 'hover:bg-ground',
      )}
    >
      <Ico icon={icon} size={16} />
    </button>
  );
}

function Cell({ c, v, pk, later, badge }: { c: ColumnSpec; v: Row[string]; pk: boolean; /** the viewed date, on the ID cell of a row dated after it */ later: string | null; badge?: ReactNode }) {
  const { campaignName, ownerName } = useApp();
  if (v == null || v === '') return <Td align={isNumeric(c) ? 'right' : 'left'} className="text-ink-2">–</Td>;
  const s = String(v);
  if (isNumeric(c)) {
    const n = Number(s);
    return (
      <Td align="right" className="whitespace-nowrap">
        {isMoney(c) ? inr(n) : num1(n)}
      </Td>
    );
  }
  if (c.type === 'date') return <Td className="tab whitespace-nowrap">{s}</Td>;
  if (c.type === 'ts')
    return (
      <Td className="tab whitespace-nowrap">
        {s.slice(0, 16)}
        {s.length > 16 ? <span className="text-ink-2">{s.slice(16)}</span> : null}
      </Td>
    );
  if (isCampaignCol(c))
    return (
      <Td className="whitespace-nowrap" title={campaignName(s)}>
        <CampaignDot id={s}>
          <span className="tab">{s}</span>
        </CampaignDot>
      </Td>
    );
  if (isOwnerCol(c))
    return (
      <Td className="tab whitespace-nowrap" title={ownerName(s)}>
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
    <Td className={cx('whitespace-nowrap', pk && 'tab font-[650]', pk && !later && 'text-ink')} title={s.length > 24 ? s : undefined}>
      <span className="flex items-center gap-1.5">
        {later ? (
          <span tabIndex={0} {...tipProps({ title: 'Dated later', notes: [`This row is dated after ${dateLabel(later, true)}, so it does not count at that date.`] })} className="shrink-0 cursor-default rounded-full">
            <Ico icon={ClockDuotone} size={14} ia="var(--ink-2)" ib="var(--stone-3)" />
            <span className="sr-only">Dated after {dateLabel(later, true)}: </span>
          </span>
        ) : null}
        <span className="block max-w-[13rem] truncate">{s}</span>
        {badge}
      </span>
    </Td>
  );
}
