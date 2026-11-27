'use client';
import { useState } from 'react';
import { CircleUserDuotone, ServerDuotone, SparklesDuotone } from 'runeicons-react';
import { useApp, type ColumnSpec } from '@/lib/app-state';
import { dateLabel, inr, istTime, num1, pct } from '@/lib/format';
import { Button, cx, Ico, type IconComponent } from '@/components/ui';
import { CAMPAIGN_STATUS_LABEL, PRIORITY_LABEL, STATUS_LABEL, type ChangeRow, type InitiativeLite, type TaskRow } from './model';

/** Timeline nodes: the copilot in its bidri and lac (as on its button in the top bar), people and the system on limestone. */
const ACTOR: Record<string, { label: string; icon: IconComponent; bg: string; ia: string; ib: string }> = {
  copilot: { label: 'Copilot', icon: SparklesDuotone, bg: 'var(--bidri)', ia: 'var(--lac-pale)', ib: 'var(--silver-2)' },
  user: { label: 'User', icon: CircleUserDuotone, bg: 'var(--stone-2)', ia: 'var(--ink)', ib: 'var(--ink-2)' },
  system: { label: 'System', icon: ServerDuotone, bg: 'var(--stone-2)', ia: 'var(--ink)', ib: 'var(--ink-2)' },
};

const VERB: Record<string, string> = { create: 'created', update: 'updated', delete: 'deleted', insert: 'added', import: 'imported', reset: 'reset' };
const DECISION_LABEL: Record<string, string> = { scale: 'Scale', keep: 'Keep', change: 'Change', stop: 'Stop', fix: 'Fix', monitor: 'Monitor' };

const PAGE = 20;

/** Settings that are shares (0-1) and read better as percentages. */
const SHARE_SETTINGS = new Set(['showRateAssumption', 'maxOptOutRate', 'momentumDropRatio']);
/** spendElasticity -> "spend elasticity", planned_budget -> "planned budget" */
const words = (k: string) => k.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
/** Lower-case a sentence-case label ("Date" -> "date") but keep acronyms ("LP sessions"). */
const lc = (s: string) => (/^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s);

/** `compact` keeps the log short when the board beside it is empty, so the two columns stay balanced. */
export function ActivityFeed({ changes, tasks, initiatives, compact = false }: { changes: ChangeRow[]; tasks: TaskRow[]; initiatives: InitiativeLite[]; compact?: boolean }) {
  const { meta, campaignName, ownerName } = useApp();
  const [shown, setShown] = useState(PAGE);

  // remember task titles from create events too, so deleted tasks still read as words
  const titles = new Map<string, string>(tasks.map((t) => [String(t.id), t.title]));
  for (const c of changes) {
    const d = c.detail as Record<string, unknown> | null;
    if (c.entity === 'task' && c.entity_id && d && typeof d.title === 'string' && !titles.has(c.entity_id)) titles.set(c.entity_id, d.title);
  }
  const bets = new Map(initiatives.map((i) => [i.id, i.name]));
  const tableLabel = new Map(meta?.tables.map((t) => [t.key, t.label]) ?? []);
  const tableSpec = new Map(meta?.tables.map((t) => [t.key, { pk: t.pk, cols: new Map<string, ColumnSpec>(t.columns.map((c) => [c.name, c])) }]) ?? []);

  /** One field of a data-table row, in words: "date set to 10 Mar 2025", "spend ₹5,000". */
  const rowField = (entity: string, k: string, v: unknown, verb: string): string => {
    const col = tableSpec.get(entity)?.cols.get(k);
    const label = k === 'owner_id' ? 'owner' : col ? lc(col.label.replace(/\s*₹$/, '')) : words(k);
    let val: string;
    if (v == null || v === '') val = 'blank';
    else if (k === 'campaign_id' || k === 'first_campaign_id') val = campaignName(String(v));
    else if (k === 'owner_id') val = ownerName(String(v));
    else if (k.endsWith('_inr')) val = inr(Number(v));
    else if (col?.type === 'date') val = dateLabel(String(v), true);
    else if ((col?.type === 'num' || col?.type === 'int') && Number.isFinite(Number(v))) val = num1(Number(v));
    else val = String(v).replace(/_/g, ' ');
    return `${label}${verb}${val}`;
  };
  const settingField = (k: string, v: unknown): string => {
    if (v != null && typeof v === 'object') return `${words(k)} changed`;
    const n = Number(v);
    return `${words(k)} set to ${SHARE_SETTINGS.has(k) && Number.isFinite(n) ? pct(n) : String(v)}`;
  };

  const subject = (c: ChangeRow): string => {
    switch (c.entity) {
      case 'task':
        return c.entity_id && titles.has(c.entity_id) ? `task “${titles.get(c.entity_id)}”` : `task ${c.entity_id ?? ''}`.trim();
      case 'campaign':
        return `campaign ${c.entity_id ? campaignName(c.entity_id) : ''}`.trim();
      case 'initiative':
        return `2027 bet ${c.entity_id ? (bets.get(c.entity_id) ?? c.entity_id) : ''}`.trim();
      case 'dataset':
        return 'the dataset';
      case 'settings':
        return 'assumptions and thresholds';
      default:
        return `${(tableLabel.get(c.entity) ?? c.entity).toLowerCase()} row ${c.entity_id ?? ''}`.trim();
    }
  };

  const fieldText = (k: string, v: unknown): string | null => {
    const s = v == null || v === '' ? null : String(v);
    switch (k) {
      case 'status':
        return `status set to ${s ? (STATUS_LABEL[s] ?? CAMPAIGN_STATUS_LABEL[s] ?? s) : 'none'}`;
      case 'priority':
        return `priority set to ${s ? (PRIORITY_LABEL[s] ?? s) : 'none'}`;
      case 'owner_id':
        return `owner set to ${ownerName(s)}`;
      case 'due_date':
        return s ? `due ${dateLabel(s, true)}` : 'due date cleared';
      case 'campaign_id':
        return s ? `campaign set to ${campaignName(s)}` : 'campaign cleared';
      case 'initiative_id':
        return s ? `2027 bet set to ${bets.get(s) ?? s}` : '2027 bet cleared';
      case 'decision':
        return s ? `decision set to ${DECISION_LABEL[s] ?? s}` : 'decision cleared';
      case 'planned_budget_inr':
        return s ? `planned budget set to ${inr(Number(s))}` : 'planned budget cleared';
      case 'notes':
        return s ? `notes: “${s.length > 60 ? `${s.slice(0, 60)}…` : s}”` : 'notes cleared';
      case 'title':
        return s ? `renamed to “${s}”` : null;
      case 'description':
      case 'evidence':
      case 'objective':
      case 'target_audience':
        return `${k.replace('_', ' ')} edited`;
      default:
        return `${k.replace(/_/g, ' ')} changed`;
    }
  };

  const detail = (c: ChangeRow): string | null => {
    const d = c.detail as Record<string, unknown> | null;
    if (!d) return null;
    if (c.entity === 'dataset') return typeof d.source === 'string' ? `Source: ${d.source}` : null;
    if (c.action === 'create') {
      const bits = [d.owner_id ? `for ${ownerName(String(d.owner_id))}` : null, d.due_date ? `due ${dateLabel(String(d.due_date), true)}` : null, d.priority ? `${PRIORITY_LABEL[String(d.priority)] ?? d.priority} priority` : null, c.entity === 'campaign' && d.planned_budget_inr != null ? `budget ${inr(Number(d.planned_budget_inr))}` : null].filter(Boolean);
      return bits.length ? bits.join(', ') : null;
    }
    if (c.action === 'update' || c.action === 'insert') {
      // generic table edits log { before, patch }
      const patch = (d.patch && typeof d.patch === 'object' ? d.patch : d) as Record<string, unknown>;
      const pk = tableSpec.get(c.entity)?.pk;
      const parts = Object.entries(patch)
        .filter(([k]) => k !== pk) // the row id is already in the subject
        .map(([k, v]) =>
          c.entity === 'task' || c.entity === 'campaign' || c.entity === 'initiative' ? fieldText(k, v) : c.entity === 'settings' ? settingField(k, v) : rowField(c.entity, k, v, c.action === 'insert' ? ' ' : ' set to '),
        )
        .filter(Boolean);
      if (!parts.length) return null;
      return parts.length > 3 ? `${parts.slice(0, 3).join('; ')}; and ${parts.length - 3} more` : parts.join('; ');
    }
    return null;
  };

  if (!changes.length) return <p className="mt-3 text-[13.5px] text-ink-2">No changes yet. Edits to tasks, campaigns and data will appear here.</p>;

  const list = changes.slice(0, shown);
  return (
    <div role="region" aria-label="Change log, newest first" tabIndex={0} className={cx('-mx-2 mt-3 overflow-y-auto px-2', compact ? 'max-h-[22rem]' : 'max-h-[34rem] min-[1200px]:max-h-[calc(100vh-13rem)]')}>
      <ol>
        {list.map((c, i) => {
          const a = ACTOR[c.actor] ?? { label: c.actor, icon: CircleUserDuotone, bg: 'var(--stone-2)', ia: 'var(--ink-2)', ib: 'var(--stone-3)' };
          const extra = detail(c);
          const at = Date.parse(c.at);
          const [day, time] = Number.isFinite(at) ? istTime(at).split(', ') : [c.at, ''];
          const prevAt = i ? Date.parse(list[i - 1].at) : NaN;
          const newDay = !i || !Number.isFinite(prevAt) || istTime(prevAt).split(', ')[0] !== day;
          const last = i === list.length - 1;
          return (
            <li key={c.id}>
              {newDay ? <div className={cx('tab pb-2 text-[12px] font-[700] text-ink', i > 0 && 'pt-1')}>{day}</div> : null}
              <div className="relative grid grid-cols-[28px_minmax(0,1fr)] gap-x-3 pb-3.5">
                {!last ? <i aria-hidden className="absolute top-8 bottom-0 left-[13.25px] block w-[1.5px] rounded-full bg-stone-3" /> : null}
                <span className="grid size-7 place-items-center rounded-full" style={{ background: a.bg }} title={a.label}>
                  <Ico icon={a.icon} size={15} ia={a.ia} ib={a.ib} />
                </span>
                <div className="min-w-0 pt-0.5">
                  <div className="text-[13px] leading-[1.35] text-ink">
                    <span className="font-[650]">{a.label}</span> {VERB[c.action] ?? c.action} <span className="break-words">{subject(c)}</span>
                  </div>
                  {extra ? <div className="mt-0.5 text-[12px] leading-[1.4] break-words text-ink-2">{extra}</div> : null}
                  <div className="tab mt-0.5 text-[11.5px] font-[550] text-ink-2" title={Number.isFinite(at) ? new Date(at).toISOString() : c.at}>
                    {time ? `${time} IST` : null}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      {changes.length > shown ? (
        <Button size="sm" variant="ghost" className="-ml-1" onClick={() => setShown((n) => n + PAGE)}>
          Show {Math.min(PAGE, changes.length - shown)} older changes
        </Button>
      ) : null}
    </div>
  );
}
