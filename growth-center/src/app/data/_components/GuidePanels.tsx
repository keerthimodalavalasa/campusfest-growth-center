'use client';
import { useApp } from '@/lib/app-state';
import { dateLabel } from '@/lib/format';
import { Button, Panel } from '@/components/ui';

export type QuickActionKey = 'deny-checkin' | 'add-spend' | 'cancel-registration' | 'add-target';

const ACTIONS: { key: QuickActionKey; title: string; example: string; effect: string; button: string }[] = [
  {
    key: 'deny-checkin',
    title: 'Mark a check-in as denied',
    example: 'try event CHK000002',
    effect: 'A denied admission is not a visit. Verified visitors fall by one from that check-in’s date, unless the person has another verified admission.',
    button: 'Edit CHK000002',
  },
  {
    key: 'add-spend',
    title: 'Add net spend to a campaign day',
    example: 'Paid Social, on the date you are viewing',
    effect: 'Net spend and every cost per registration or visitor rise from that day. A negative amount records a vendor credit.',
    button: 'Add a spend row',
  },
  {
    key: 'cancel-registration',
    title: 'Cancel a registration by adding a new status version',
    example: 'try R0003',
    effect: 'From the version’s effective time the registration counts as cancelled; earlier dates keep the old status. Never edit or sum old versions.',
    button: 'Add a cancellation',
  },
  {
    key: 'add-target',
    title: 'Add a new target version',
    example: 'copied from the version in force',
    effect: 'Goals, budget and pace lines switch to the new version from its effective time. Each version is complete, so keep every goal you still want.',
    button: 'Add a target version',
  },
];

/** "What changes when you edit": the time-travel rule plus worked examples. */
export function EditHelper({ onAction, pending }: { onAction: (k: QuickActionKey) => void; pending: QuickActionKey | null }) {
  const { asOf } = useApp();
  return (
    <Panel title="What changes when you edit">
      <p className="text-[0.88rem] text-ink-2">
        Every save rewrites the source data and recomputes all pages: overview, campaigns, diagnosis and decisions. Edits apply to the dates they carry. A row dated 12 Apr changes numbers from 12 Apr onward and leaves earlier dates as they were.
      </p>
      {asOf ? (
        <p className="mt-2 text-[0.88rem] text-ink-2">
          You are viewing <span className="num font-semibold text-ink">{dateLabel(asOf, true)}</span>. Move the date on the timeline above to see an edit dated later.
        </p>
      ) : null}
      <ul className="mt-4 space-y-3.5">
        {ACTIONS.map((a) => (
          <li key={a.key} className="border-t border-line pt-3.5">
            <div className="text-[0.9rem] font-semibold leading-snug text-ink">
              {a.title} <span className="font-normal text-ink-3">({a.example})</span>
            </div>
            <p className="mt-0.5 text-[0.82rem] leading-snug text-ink-2">{a.effect}</p>
            <Button size="sm" variant="secondary" className="mt-2" onClick={() => onAction(a.key)} disabled={pending != null} aria-busy={pending === a.key}>
              {pending === a.key ? 'Looking up the row…' : a.button}
            </Button>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

const RULES: { title: string; body: string }[] = [
  { title: 'Dedupe by stable ID.', body: 'Repeated activity, person, registration, history, check-in and interaction IDs are dropped on import. Identical repeats vanish quietly; conflicting ones keep the first row and raise a warning.' },
  { title: 'Latest full-state version on or before the date.', body: 'Registration status and targets are read from the most recent version effective at the end of the selected day. Later versions are ignored and versions are never summed.' },
  { title: 'External people only.', body: 'Identified, registered and visitor totals count people whose type is external. Internal, staff and test people are excluded.' },
  { title: 'Admitted + verified = visit.', body: 'A check-in counts only when it is admitted and verified for an external person. Each person counts once. Denied, pending and unverified records do not.' },
  { title: 'End of day, India time.', body: 'A selected date means 23:59:59 IST that day. Every source timestamp is read as IST.' },
  { title: 'Net spend includes credits.', body: 'Spend is the sum of daily rows up to the date, and vendor credits are negative rows that lower it on the day they carry.' },
  { title: 'Expected visitors before the event.', body: 'Until the gates open, visitors are projected as confirmed registrations × the show-rate assumption, never shown as attendance.' },
];

/** The source rules the engine applies, in plain words. */
export function RulesPanel() {
  return (
    <Panel tone="well" title="Rules the engine applies">
      <ol className="space-y-2.5 text-[0.84rem] leading-snug text-ink-2">
        {RULES.map((r, i) => (
          <li key={r.title} className="flex gap-2.5">
            <span className="num w-4 shrink-0 text-right font-semibold text-ink-3">{i + 1}</span>
            <span>
              <span className="font-semibold text-ink">{r.title}</span> {r.body}
            </span>
          </li>
        ))}
      </ol>
    </Panel>
  );
}
