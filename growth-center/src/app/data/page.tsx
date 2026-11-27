'use client';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useApp, type TableMeta } from '@/lib/app-state';
import { dateLabel } from '@/lib/format';
import { ErrorNote, PageHeader, Skeleton } from '@/components/ui';
import { TableBrowser } from './_components/TableBrowser';
import { RowDialog } from './_components/RowDialog';
import { DeleteDialog } from './_components/DeleteDialog';
import { LiveTotals } from './_components/LiveTotals';
import { EditHelper, RulesPanel, type QuickActionKey } from './_components/GuidePanels';
import { ImportPanel } from './_components/ImportPanel';
import { ChangesPanel } from './_components/ChangesPanel';
import { asText, suggestId, tsText, type Row, type RowDialogState } from './_components/shared';

const noopSubscribe = () => () => {};
const readSearch = () => window.location.search;

const scrollToBrowser = () => document.getElementById('table-browser')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

export default function DataPage() {
  const { meta, metaError, asOf } = useApp();
  // deep links: /data?table=checkins&q=CHK000002 (read hydration-safely; explicit choices then take over)
  const search = useSyncExternalStore(noopSubscribe, readSearch, () => '');
  const urlParams = new URLSearchParams(search);
  const [chosenTable, setTableKey] = useState<string | null>(null);
  const [chosenQuery, setQuery] = useState<string | null>(null);
  const tableKey = chosenTable ?? urlParams.get('table');
  const query = chosenQuery ?? urlParams.get('q') ?? '';
  const [dialog, setDialog] = useState<RowDialogState | null>(null);
  const [pending, setPending] = useState<QuickActionKey | null>(null);
  const [toDelete, setToDelete] = useState<{ table: TableMeta; row: Row } | null>(null);

  useEffect(() => {
    if (!tableKey) return;
    const url = new URL(window.location.href);
    url.searchParams.set('table', tableKey);
    if (query) url.searchParams.set('q', query);
    else url.searchParams.delete('q');
    window.history.replaceState(window.history.state, '', url.toString());
  }, [tableKey, query]);

  const onQuery: (q: string) => void = setQuery; // state setters are stable

  if (metaError) return <ErrorNote onRetry={() => window.location.reload()}>Could not load the table definitions: {metaError}</ErrorNote>;
  if (!meta || !asOf) return <DataSkeleton />;

  const tables = meta.tables;
  const table = tables.find((t) => t.key === tableKey) ?? tables[0];
  const byKey = (k: string) => tables.find((t) => t.key === k)!;

  const show = (key: string, q: string) => {
    setTableKey(key);
    setQuery(q);
    scrollToBrowser();
  };

  const findRow = async (key: string, id: string): Promise<Row | null> => {
    try {
      const res = await api<{ rows: Row[] }>(`/api/data/${key}?q=${encodeURIComponent(id)}&limit=20`);
      return res.rows.find((r) => asText(r[byKey(key).pk]) === id) ?? null;
    } catch (e) {
      toast.error(`Could not look up ${id}: ${(e as Error).message}`);
      return null;
    }
  };

  /** The day a new spend row or version lands on: the viewed date, kept inside the data range. */
  const viewedDay = asOf < meta.event.historyStart ? meta.event.historyStart : asOf > meta.latestDate ? meta.latestDate : asOf;

  const newVersion = (t: TableMeta, row: Row) => {
    const initial: Record<string, string> = {};
    for (const c of t.columns) {
      if (c.name === t.pk) continue;
      initial[c.name] = c.type === 'ts' ? tsText(asText(row[c.name])) : asText(row[c.name]);
    }
    initial.effective_at = `${viewedDay} 12:00`;
    if (!t.pkGenerated) initial[t.pk] = suggestId(t.key);
    setDialog({
      mode: 'add',
      table: t,
      initial,
      note: `Copied from ${asText(row[t.pk])}. Change what is different and set when it takes effect: on any date the latest version on or before it wins. The effective time defaults to noon on the date you are viewing.`,
    });
  };

  const doAction = async (k: QuickActionKey) => {
    if (k === 'deny-checkin') {
      show('checkins', 'CHK000002');
      const row = await findRow('checkins', 'CHK000002');
      if (!row) {
        toast.error('CHK000002 is no longer in the data. Reset to original data to restore it, or edit another check-in.');
        return;
      }
      // unique visitors: denying one admission changes nothing if the person has another verified admission
      const person = asText(row.person_id);
      let others: Row[] = [];
      try {
        const res = await api<{ rows: Row[] }>(`/api/data/checkins?q=${encodeURIComponent(person)}&limit=50`);
        others = res.rows.filter((r) => asText(r.person_id) === person && asText(r.event_id) !== 'CHK000002' && r.result === 'admitted' && r.verification === 'verified');
      } catch {
        /* the note falls back to the general rule */
      }
      const ids = others.map((r) => asText(r.event_id));
      const firstDay = [row, ...others].map((r) => asText(r.occurred_at).slice(0, 10)).sort()[0];
      const note = ids.length
        ? `Result is set to denied below and not saved yet. ${person} also has ${ids.length} other verified admission${ids.length > 1 ? 's' : ''} (${ids.join(', ')}), so unique visitors stay the same after this save. Deny ${ids.length > 1 ? 'those too' : 'that one too'} and visitors fall by one from ${dateLabel(firstDay, true)}.`
        : 'Result is set to denied below and not saved yet. Save to apply it; verified visitors fall by one from the check-in’s date onward.';
      setDialog({ mode: 'edit', table: byKey('checkins'), row, initial: { result: 'denied' }, note });
    } else if (k === 'add-spend') {
      show('daily_marketing', 'C02');
      const camp = meta.campaigns.find((c) => c.id === 'C02');
      setDialog({
        mode: 'add',
        table: byKey('daily_marketing'),
        initial: { activity_id: suggestId('daily_marketing'), campaign_id: 'C02', activity_date: viewedDay, marketing_spend_inr: '5000', platform: 'paid platform', owner_id: camp?.ownerId ?? '' },
        note: `A second row for ${camp?.name ?? 'C02'} on ${dateLabel(viewedDay, true)} adds ₹5,000 to that day’s net spend. Use a negative amount to record a vendor credit.`,
      });
    } else if (k === 'cancel-registration') {
      show('registration_history', 'R0003');
      let versions: Row[] = [];
      try {
        const res = await api<{ rows: Row[] }>(`/api/data/registration_history?q=R0003&limit=200`);
        versions = res.rows.filter((r) => asText(r.registration_id) === 'R0003');
      } catch (e) {
        toast.error(`Could not look up R0003: ${(e as Error).message}`);
        return;
      }
      if (!versions.length) {
        toast.error('R0003 has no status versions any more. Reset to original data to restore them, or pick another registration.');
        return;
      }
      // any version carries the person, campaign and owner; the newest one is the best copy
      const row = [...versions].sort((a, b) => asText(a.effective_at).localeCompare(asText(b.effective_at))).pop()!;
      const t = byKey('registration_history');
      setDialog({
        mode: 'add',
        table: t,
        initial: { history_id: suggestId(t.key), registration_id: 'R0003', person_id: asText(row.person_id), campaign_id: asText(row.campaign_id), effective_at: `${viewedDay} 12:00`, status: 'cancelled', owner_id: asText(row.owner_id) },
        note: `This adds a cancelled version of R0003 at noon on ${dateLabel(viewedDay, true)}, the date you are viewing. Earlier dates keep the old status.`,
      });
    } else if (k === 'add-target') {
      show('targets', '');
      const cut = Date.parse(`${asOf}T23:59:59.999+05:30`);
      const inForce = [...meta.targets].filter((t) => t.effectiveAt <= cut).pop() ?? meta.targets[meta.targets.length - 1];
      setDialog({
        mode: 'add',
        table: byKey('targets'),
        initial: inForce
          ? {
              effective_at: `${viewedDay} 09:00`,
              identified_external_people_goal: String(inForce.identifiedGoal),
              registration_goal: String(inForce.registrationGoal),
              unique_external_visitors_goal: String(inForce.visitorsGoal),
              marketing_budget_inr: String(inForce.budget),
              target_version: `Revision of ${dateLabel(viewedDay, true)}`,
            }
          : { effective_at: `${viewedDay} 09:00` },
        note: inForce ? `Copied from “${inForce.version}”, the version in force on ${dateLabel(asOf, true)}. Change the goals you want; the rest carry over because each version is complete.` : 'Each target version is complete: fill every goal.',
      });
    }
  };

  const runAction = async (k: QuickActionKey) => {
    setPending(k);
    try {
      await doAction(k);
    } finally {
      setPending(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Source data"
        lede={
          <>
            Seven source tables. Every page recomputes from these rows, at the dates they carry. Totals as of <b className="font-[650] text-ink">{dateLabel(asOf, true)}</b>.
          </>
        }
      />

      <LiveTotals />

      <div className="mt-3 grid grid-cols-[minmax(0,1fr)_340px] items-start gap-3 max-[1200px]:grid-cols-1">
        <TableBrowser
          delay={160}
          tables={tables}
          table={table}
          onTable={(k) => {
            setTableKey(k);
            setQuery('');
          }}
          query={query}
          onQuery={onQuery}
          onEdit={(row) => setDialog({ mode: 'edit', table, row })}
          onAdd={() => setDialog({ mode: 'add', table, initial: table.pkGenerated ? {} : { [table.pk]: suggestId(table.key) } })}
          onNewVersion={(row) => newVersion(table, row)}
          onDelete={(row) => setToDelete({ table, row })}
        />
        <EditHelper onAction={runAction} pending={pending} delay={200} />
      </div>

      <div className="mt-3 grid grid-cols-2 items-start gap-3 max-[1024px]:grid-cols-1">
        <ImportPanel delay={240} />
        <div className="grid gap-3">
          <ChangesPanel delay={280} onOpen={(key, id) => show(key, byKey(key)?.pkGenerated ? '' : id)} />
          <RulesPanel delay={320} />
        </div>
      </div>

      <RowDialog
        key={dialog ? `${dialog.mode}:${dialog.table.key}:${asText(dialog.row?.[dialog.table.pk] ?? '')}:${JSON.stringify(dialog.initial ?? {})}` : 'closed'}
        state={dialog}
        onClose={() => setDialog(null)}
        onSaved={(key, id, mode) => {
          // show the row just added (a date-sorted grid would otherwise bury it on a later page)
          if (mode !== 'add') return;
          setTableKey(key);
          setQuery(byKey(key)?.pkGenerated ? '' : id);
        }}
      />
      <DeleteDialog key={toDelete ? `${toDelete.table.key}:${asText(toDelete.row[toDelete.table.pk])}` : 'none'} target={toDelete} onClose={() => setToDelete(null)} />
    </div>
  );
}

function DataSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading the source data">
      <Skeleton className="mb-2 h-12 w-96 max-w-full bg-stone" />
      <div className="grid grid-cols-4 gap-3 max-[1200px]:grid-cols-2 max-[560px]:grid-cols-1">
        {[0, 1, 2, 3].map((k) => (
          <Skeleton key={k} className="h-[180px] rounded-tile-s bg-stone" />
        ))}
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_340px] gap-3 max-[1200px]:grid-cols-1">
        <Skeleton className="h-[560px] rounded-tile-l bg-stone" />
        <Skeleton className="h-[560px] rounded-tile-l bg-stone" />
      </div>
    </div>
  );
}
