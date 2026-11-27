'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, CircleAlert, Database, LoaderCircle, Ticket } from 'lucide-react';
import { useApp } from '@/lib/app-state';
import { dateLabel } from '@/lib/format';
import { Button, cx } from '@/components/ui';

export interface AnyToolPart {
  type: string;
  toolCallId: string;
  state: 'input-streaming' | 'input-available' | 'approval-requested' | 'approval-responded' | 'output-available' | 'output-error' | 'output-denied';
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  errorText?: string;
  approval?: { id: string; approved?: boolean; reason?: string; isAutomatic?: boolean };
}

const LABELS: Record<string, string> = {
  get_overview: 'Read headline status',
  get_campaign_metrics: 'Read campaign metrics',
  compare_campaigns: 'Ranked campaigns',
  get_trend: 'Read a trend',
  diagnose: 'Ran the diagnosis',
  get_decisions: 'Checked scale / stop rules',
  simulate_budget_shift: 'Simulated a budget shift',
  get_data_dictionary: 'Checked what the data covers',
  query_data: 'Queried the source tables',
  calculate: 'Calculated',
  list_initiatives: 'Read the 2027 bets',
  get_plan: 'Read the 2027 plan model',
  get_event_day: 'Read gate arrivals by hour',
  list_tasks: 'Read the task list',
  create_task: 'Create task',
  update_task: 'Update task',
  update_campaign: 'Update campaign',
};

function describe(name: string, input: Record<string, unknown> | undefined) {
  const i = input ?? {};
  const bits: string[] = [];
  if (typeof i.campaign === 'string') bits.push(i.campaign);
  if (typeof i.metric === 'string') bits.push(String(i.metric).replace(/_/g, ' '));
  if (typeof i.from_campaign === 'string') bits.push(`${i.from_campaign} to ${i.to_campaign}, ₹${Number(i.amount_inr ?? 0).toLocaleString('en-IN')}`);
  if (typeof i.expression === 'string') bits.push(String(i.expression));
  if (typeof i.purpose === 'string') bits.push(String(i.purpose));
  if (typeof i.as_of === 'string') bits.push(`as of ${dateLabel(i.as_of, true)}`);
  return bits.join(', ');
}

export function ToolPart({ part, onApproval }: { part: AnyToolPart; onApproval: (id: string, approved: boolean) => void }) {
  const name = part.type.replace(/^tool-/, '');
  const isWrite = name === 'create_task' || name === 'update_task' || name === 'update_campaign';
  if (isWrite) return <ActionTicket name={name} part={part} onApproval={onApproval} />;
  return <Receipt name={name} part={part} />;
}

function Receipt({ name, part }: { name: string; part: AnyToolPart }) {
  const [open, setOpen] = useState(false);
  const running = part.state === 'input-streaming' || part.state === 'input-available';
  const failed = part.state === 'output-error' || (part.output && typeof part.output.error === 'string');
  const detail = describe(name, part.input);
  return (
    <div className="rounded-[12px] shadow-[inset_0_0_0_1.5px_var(--stone-2)] text-[12.5px]">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 rounded-[12px] px-3 py-2 text-left text-ink-2 transition-colors duration-150 hover:bg-stone" aria-expanded={open} disabled={running}>
        {running ? <LoaderCircle size={14} className="animate-spin text-ink-2" /> : failed ? <CircleAlert size={14} className="text-st-change" /> : <Database size={14} className="text-nizami" />}
        <span className="font-[650] text-ink">{LABELS[name] ?? name}</span>
        {detail ? <span className="truncate text-ink-2">{detail}</span> : null}
        {!running ? <ChevronDown size={14} className={cx('ml-auto shrink-0 text-ink-2 transition-transform duration-200 ease-out', open && 'rotate-180')} /> : null}
      </button>
      {open ? (
        <pre className="tab max-h-72 overflow-auto border-t border-stone-2 px-3 py-2 text-[11.5px] leading-snug whitespace-pre-wrap text-ink-2">
          {part.state === 'output-error' ? part.errorText : JSON.stringify(part.output ?? part.input, null, 1)}
        </pre>
      ) : null}
    </div>
  );
}

function ActionTicket({ name, part, onApproval }: { name: string; part: AnyToolPart; onApproval: (id: string, approved: boolean) => void }) {
  const { ownerName } = useApp();
  const i = part.input ?? {};
  const out = part.output ?? {};
  const rows: [string, unknown][] =
    name === 'create_task'
      ? [
          ['Owner', i.owner],
          ['Campaign', i.campaign],
          ['Due', i.due_date ? dateLabel(String(i.due_date), true) : null],
          ['Priority', i.priority],
          ['Decision', i.decision],
        ]
      : name === 'update_task'
        ? [
            ['Task', `#${i.task_id}`],
            ['Status', i.status],
            ['Owner', i.owner],
            ['Due', i.due_date],
            ['Priority', i.priority],
          ]
        : [
            ['Campaign', i.campaign],
            ['Status', i.status],
            ['Planned budget', i.planned_budget_inr != null ? `₹${Number(i.planned_budget_inr).toLocaleString('en-IN')}` : null],
            ['Owner', i.owner],
            ['Notes', i.notes],
          ];
  const done = part.state === 'output-available' && (out.created === true || out.updated === true);
  // "Design spell": when the approval is saved during this session, the action stub tears off along the perforation.
  const wasPending = useRef(part.state === 'approval-requested' || part.state === 'approval-responded');
  const [tearing, setTearing] = useState(false);
  useEffect(() => {
    if (part.state === 'approval-requested' || part.state === 'approval-responded') wasPending.current = true;
    if (done && wasPending.current) {
      wasPending.current = false;
      setTearing(true);
      const t = setTimeout(() => setTearing(false), 750);
      return () => clearTimeout(t);
    }
  }, [done, part.state]);
  const failed = part.state === 'output-error' || (part.state === 'output-available' && !done);
  const denied = part.state === 'output-denied' || (part.state === 'approval-responded' && part.approval?.approved === false);

  return (
    <div className={cx('overflow-hidden rounded-tile-s bg-stone', denied && 'opacity-80')}>
      <div className="flex items-center gap-2 px-4 pt-3 pb-2">
        <Ticket size={16} className={done ? 'text-st-scale' : 'text-lac'} aria-hidden />
        <span className="text-[12.5px] font-[650] text-ink-2">{LABELS[name]}</span>
        {done ? (
          <span className="ml-auto inline-flex h-6 items-center gap-1 rounded-full bg-st-scale pr-[9px] pl-1.5 text-[12px] font-[700] text-white">
            <Check size={14} aria-hidden /> Saved
          </span>
        ) : null}
      </div>
      <div className="perforated h-3 bg-transparent" aria-hidden>
        <div className="mx-3 h-1.5 border-b-[1.5px] border-dashed border-stone-3" />
      </div>
      <div className="space-y-2 px-4 pt-1 pb-4">
        {name === 'create_task' ? <div className="text-[14.5px] leading-snug font-[650] text-ink">{String(i.title ?? 'Untitled task')}</div> : null}
        {typeof i.description === 'string' ? <p className="text-[13px] text-ink-2">{i.description}</p> : null}
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[13px]">
          {rows
            .filter(([, v]) => v != null && v !== '')
            .map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-ink-2">{k}</dt>
                <dd className="text-ink">{k === 'Owner' ? ownerName(String(v)) === String(v) ? String(v) : ownerName(String(v)) : String(v)}</dd>
              </div>
            ))}
        </dl>
        {typeof i.evidence === 'string' ? <p className="rounded-[10px] bg-ground px-2.5 py-2 text-[12.5px] text-ink-2">Evidence: {i.evidence}</p> : null}

        {part.state === 'approval-requested' && part.approval && !part.approval.isAutomatic ? (
          <div className="flex gap-2 pt-1">
            <Button variant="primary" size="sm" onClick={() => onApproval(part.approval!.id, true)}>
              Approve and save
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onApproval(part.approval!.id, false)}>
              Decline
            </Button>
          </div>
        ) : null}
        {part.state === 'approval-responded' && part.approval?.approved ? <p className="text-[13px] text-ink-2">Approved. Saving…</p> : null}
        {denied ? <p className="text-[13px] text-ink-2">Declined. Nothing was saved.</p> : null}
        {tearing ? (
          <div className="ticket-stub-tear rounded-[10px] border-[1.5px] border-dashed border-stone-3 bg-ground px-2.5 py-1.5 text-[12px] font-[650] text-ink-2" aria-hidden>
            {name === 'create_task' ? 'Moving to the task board' : 'Applying the change'}
          </div>
        ) : null}
        {done && name === 'create_task' ? (
          <p className="ticket-settle text-[13px] font-[600] text-st-scale">
            Task #{String(out.task_id)} is on the board.{' '}
            <Link href="/execute" className="font-semibold underline">
              Open Execute
            </Link>
          </p>
        ) : null}
        {done && name !== 'create_task' ? <p className="text-[13px] font-[600] text-st-scale">Updated. Dashboards now reflect the change.</p> : null}
        {failed ? <p className="text-[13px] font-[600] text-st-stop">{String(out.error ?? part.errorText ?? 'Could not save.')}</p> : null}
      </div>
    </div>
  );
}
