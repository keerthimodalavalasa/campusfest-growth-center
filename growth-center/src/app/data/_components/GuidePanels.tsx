'use client';
import { CalendarDuotone, CircleCheckDuotone, ClockDuotone, FilePlusDuotone, FlagDuotone, HistoryDuotone, IndianRupeeDuotone, InfoDuotone, LibraryDuotone, PencilDuotone, ShieldCheckDuotone, UsersDuotone, XDuotone } from 'runeicons-react';
import { useApp } from '@/lib/app-state';
import { dateLabel } from '@/lib/format';
import { Button, Ico, Tile, TileHead, type IconComponent } from '@/components/ui';
import { HowThisWorks } from '@/components/tiles';
import { tipProps } from '@/components/tooltip';

export type QuickActionKey = 'deny-checkin' | 'add-spend' | 'cancel-registration' | 'add-target';

const ACTIONS: { key: QuickActionKey; icon: IconComponent; title: string; example: string; effect: string; button: string }[] = [
  {
    key: 'deny-checkin',
    icon: XDuotone,
    title: 'Deny a check-in',
    example: 'Event CHK000002',
    effect: 'A denied admission is not a visit. Verified visitors fall by one from that check-in’s date, unless the person has another verified admission.',
    button: 'Edit CHK000002',
  },
  {
    key: 'add-spend',
    icon: IndianRupeeDuotone,
    title: 'Add spend to a day',
    example: 'Paid Social, on the viewed date',
    effect: 'Net spend and every cost per registration or visitor rise from that day. A negative amount records a vendor credit.',
    button: 'Add a spend row',
  },
  {
    key: 'cancel-registration',
    icon: FilePlusDuotone,
    title: 'Cancel a registration',
    example: 'A new status version for R0003',
    effect: 'From the version’s effective time the registration counts as cancelled; earlier dates keep the old status. Never edit or sum old versions.',
    button: 'Add a cancellation',
  },
  {
    key: 'add-target',
    icon: FlagDuotone,
    title: 'Add a target version',
    example: 'Copied from the version in force',
    effect: 'Goals, budget and pace lines switch to the new version from its effective time. Each version is complete, so keep every goal you still want.',
    button: 'Add a target version',
  },
];

/** "What changes when you edit": the time-travel rule as a picture, plus worked examples that open the row. */
export function EditHelper({ onAction, pending, delay }: { onAction: (k: QuickActionKey) => void; pending: QuickActionKey | null; delay?: number }) {
  const { asOf } = useApp();
  return (
    <Tile field="stone" delay={delay} className="flex flex-col" aria-label="What changes when you edit">
      <TileHead icon={PencilDuotone}>What changes when you edit</TileHead>

      {/* an edit counts from the date it carries: earlier dates keep their numbers */}
      <figure className="mt-3.5">
        <div className="relative flex h-9 overflow-hidden rounded-[10px] text-[12px] font-[650]">
          <div className="flex w-[42%] items-center bg-stone-2 px-2.5 text-ink-2">Earlier dates kept</div>
          <div className="flex flex-1 items-center justify-end bg-ink px-2.5 text-white">Recomputed from here</div>
        </div>
        <div className="relative h-6">
          <span className="absolute left-[42%] -translate-x-1/2 border-x-[6px] border-b-[7px] border-x-transparent border-b-ink" aria-hidden />
          <span className="absolute top-2 left-[42%] -translate-x-1/2 text-[11.5px] font-[650] whitespace-nowrap">The row&apos;s date</span>
        </div>
        <figcaption className="mt-1 text-[12.5px] leading-[1.4] text-ink-2">
          Every save recomputes all pages. You are viewing <b className="tab font-[650] text-ink">{asOf ? dateLabel(asOf, true) : '…'}</b>; move the tape to see an edit dated later.
        </figcaption>
      </figure>

      <ul className="mt-4 grid gap-2">
        {ACTIONS.map((a) => (
          <li key={a.key} className="grid grid-cols-[32px_minmax(0,1fr)] items-start gap-x-3 gap-y-2 rounded-tile-m bg-stone-2/60 px-3 py-3">
            <span aria-hidden className="grid size-8 place-items-center rounded-icon bg-ground">
              <Ico icon={a.icon} size={17} ia="var(--ink)" ib="var(--stone-3)" />
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-[13.5px] leading-[1.25] font-[650]">
                {a.title}
                <span tabIndex={0} aria-label={`What ${a.title.toLowerCase()} does`} {...tipProps({ title: a.title, notes: [a.effect] })} className="cursor-default rounded-full">
                  <Ico icon={InfoDuotone} size={14} ia="var(--ink-2)" ib="var(--stone-3)" />
                </span>
              </span>
              <span className="block text-[12px] font-[550] text-ink-2">{a.example}</span>
              <span className="sr-only">{a.effect}</span>
            </span>
            <Button size="sm" variant="secondary" className="col-start-2 w-fit" onClick={() => onAction(a.key)} disabled={pending != null} aria-busy={pending === a.key}>
              {pending === a.key ? 'Looking up the row…' : a.button}
            </Button>
          </li>
        ))}
      </ul>
    </Tile>
  );
}

const RULES: { icon: IconComponent; title: string; body: string }[] = [
  { icon: ShieldCheckDuotone, title: 'Dedupe by stable ID', body: 'Repeated activity, person, registration, history, check-in and interaction IDs are dropped on import. Identical repeats vanish quietly; conflicting ones keep the first row and raise a warning.' },
  { icon: HistoryDuotone, title: 'Latest version at the date', body: 'Registration status and targets are read from the most recent version effective at the end of the selected day. Later versions are ignored and versions are never summed.' },
  { icon: UsersDuotone, title: 'External people only', body: 'Identified, registered and visitor totals count people whose type is external. Internal, staff and test people are excluded.' },
  { icon: CircleCheckDuotone, title: 'Admitted and verified is a visit', body: 'A check-in counts only when it is admitted and verified for an external person. Each person counts once. Denied, pending and unverified records do not.' },
  { icon: ClockDuotone, title: 'End of day, India time', body: 'A selected date means 23:59:59 IST that day. Every source timestamp is read as IST.' },
  { icon: IndianRupeeDuotone, title: 'Net spend includes credits', body: 'Spend is the sum of daily rows up to the date, and vendor credits are negative rows that lower it on the day they carry.' },
  { icon: CalendarDuotone, title: 'Expected visitors before the event', body: 'Until the gates open, visitors are projected as confirmed registrations × the show-rate assumption, never shown as attendance.' },
];

/** The source rules the engine applies: short titles with a glyph, the full wording one click away. */
export function RulesPanel({ delay }: { delay?: number }) {
  return (
    <Tile field="stone" delay={delay} aria-label="Rules the engine applies">
      <TileHead icon={LibraryDuotone}>
        Rules the engine applies
      </TileHead>
      <ul className="mt-3.5 grid grid-cols-2 gap-x-4 gap-y-2.5 max-[560px]:grid-cols-1">
        {RULES.map((r) => (
          <li key={r.title} tabIndex={0} {...tipProps({ title: r.title, notes: [r.body] })} className="flex cursor-default items-center gap-2.5 rounded-md text-[13px] leading-[1.3] font-[650]">
            <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-icon bg-stone-2">
              <Ico icon={r.icon} size={15} ia="var(--ink)" ib="var(--ink-2)" />
            </span>
            {r.title}
          </li>
        ))}
      </ul>
      <HowThisWorks label="Read the rules in full">
        {RULES.map((r) => (
          <p key={r.title}>
            <b>{r.title}.</b> {r.body}
          </p>
        ))}
      </HowThisWorks>
    </Tile>
  );
}
