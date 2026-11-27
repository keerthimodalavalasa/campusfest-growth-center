'use client';
import { forwardRef, useEffect, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { DECISION, SEVERITY, type DecisionKey } from '@/lib/colors';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

/* ------------------------------------------------------------------ layout */

export function PageHeader({ title, lede, actions }: { title: string; lede?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 pb-5">
      <div className="max-w-[72ch]">
        <h1 className="type-display text-[1.9rem] text-ink">{title}</h1>
        {lede ? <p className="mt-1.5 text-[0.95rem] text-ink-2">{lede}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

/** A panel is a white surface. `tone="well"` is a recessed area for secondary content. */
export function Panel({ title, aside, children, className, tone = 'surface', pad = true, id }: { title?: ReactNode; aside?: ReactNode; children: ReactNode; className?: string; tone?: 'surface' | 'well' | 'ink'; pad?: boolean; id?: string }) {
  return (
    <section
      id={id}
      className={cx(
        'rounded-[var(--radius-panel)]',
        tone === 'surface' && 'border border-line bg-surface',
        tone === 'well' && 'bg-paper-2',
        tone === 'ink' && 'bg-ink text-white',
        pad && 'p-5',
        className,
      )}
    >
      {title || aside ? (
        <div className="mb-3 flex items-start justify-between gap-3">
          {title ? <h2 className="type-title text-[1.02rem]">{title}</h2> : <span />}
          {aside ? <div className="shrink-0 text-sm text-ink-3">{aside}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ controls */

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent';
export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm' | 'md'; icon?: ReactNode }>(function Button(
  { variant = 'secondary', size = 'md', icon, className, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      {...rest}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-control)] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'h-8 px-2.5 text-[0.82rem]' : 'h-9.5 px-3.5 text-[0.9rem]',
        variant === 'primary' && 'bg-ink text-white hover:bg-[#2a3646]',
        variant === 'accent' && 'bg-lac text-white hover:bg-[#8f123e]',
        variant === 'secondary' && 'border border-line-2 bg-surface text-ink hover:bg-paper',
        variant === 'ghost' && 'text-ink-2 hover:bg-paper-2 hover:text-ink',
        variant === 'danger' && 'border border-lac/40 bg-surface text-lac hover:bg-lac-soft',
        className,
      )}
    >
      {icon}
      {children}
    </button>
  );
});

const fieldBase = 'w-full rounded-[var(--radius-control)] border border-line-2 bg-surface px-2.5 text-[0.9rem] text-ink placeholder:text-ink-3 focus:border-sagar focus:outline-none disabled:bg-paper-2';

export function Field({ label, hint, children, error }: { label: string; hint?: string; children: ReactNode; error?: string | null }) {
  return (
    <label className="flex flex-col gap-1 text-[0.85rem]">
      <span className="font-medium text-ink-2">{label}</span>
      {children}
      {error ? <span className="text-lac">{error}</span> : hint ? <span className="text-ink-3">{hint}</span> : null}
    </label>
  );
}
export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function TextInput({ className, ...p }, ref) {
  return <input ref={ref} {...p} className={cx(fieldBase, 'h-9', className)} />;
});
export function Select({ className, children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...p} className={cx(fieldBase, 'h-9 pr-7', className)}>
      {children}
    </select>
  );
}
export function TextArea({ className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...p} className={cx(fieldBase, 'min-h-20 py-2', className)} />;
}

/* ------------------------------------------------------------------ chips */

export function Chip({ children, fg = 'var(--ink-2)', bg = 'var(--paper-2)', className, title }: { children: ReactNode; fg?: string; bg?: string; className?: string; title?: string }) {
  return (
    <span title={title} className={cx('inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-[0.78rem] font-semibold whitespace-nowrap', className)} style={{ color: fg, background: bg }}>
      {children}
    </span>
  );
}

export function DecisionChip({ decision, className }: { decision: DecisionKey; className?: string }) {
  const d = DECISION[decision];
  return (
    <Chip fg={d.fg} bg={d.bg} className={className}>
      <span className="size-1.5 rounded-full" style={{ background: d.fg }} aria-hidden />
      {d.label}
    </Chip>
  );
}

export function SeverityChip({ severity }: { severity: keyof typeof SEVERITY }) {
  const s = SEVERITY[severity];
  return (
    <Chip fg={s.fg} bg={s.bg}>
      {s.label}
    </Chip>
  );
}

export function StatusDot({ color }: { color: string }) {
  return <span className="inline-block size-2.5 shrink-0 rounded-full" style={{ background: color }} aria-hidden />;
}

/* ------------------------------------------------------------------ figures */

/** A figure with its comparison. Used sparingly; not a hero device. */
export function Figure({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'good' | 'bad' | 'warn' | 'neutral' }) {
  const color = tone === 'good' ? 'var(--bangle)' : tone === 'bad' ? 'var(--lac)' : tone === 'warn' ? 'var(--zari)' : 'var(--ink)';
  return (
    <div className="min-w-0">
      <div className="text-[0.82rem] text-ink-3">{label}</div>
      <div className="num type-title mt-0.5 text-[1.45rem]" style={{ color }}>
        {value}
      </div>
      {sub ? <div className="mt-0.5 text-[0.8rem] text-ink-2">{sub}</div> : null}
    </div>
  );
}

/** Attainment bar: actual vs goal, with an optional projection marker. */
export function Meter({ value, goal, projected, color = 'var(--ink)', height = 8 }: { value: number; goal: number | null; projected?: number | null; color?: string; height?: number }) {
  const max = Math.max(goal ?? 0, value, projected ?? 0, 1) * 1.08;
  const w = (x: number) => `${Math.min(100, (x / max) * 100)}%`;
  return (
    <div className="relative w-full rounded-full bg-paper-2" style={{ height }} role="img" aria-label={`${Math.round(value)} of ${goal ?? 'no goal'}`}>
      {projected != null ? <div className="absolute inset-y-0 left-0 rounded-full opacity-25" style={{ width: w(projected), background: color }} /> : null}
      <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: w(value), background: color }} />
      {goal ? <div className="absolute -inset-y-1 w-0.5 rounded bg-ink" style={{ left: w(goal) }} title={`Goal ${goal}`} /> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ states */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('animate-pulse rounded-md bg-paper-2', className)} />;
}

export function ErrorNote({ children, onRetry }: { children: ReactNode; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-center justify-between gap-3 rounded-[var(--radius-control)] border border-lac/30 bg-lac-soft px-3 py-2 text-[0.88rem] text-lac">
      <span>{children}</span>
      {onRetry ? (
        <Button size="sm" variant="secondary" onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-[var(--radius-panel)] border border-dashed border-line-2 px-5 py-6">
      <div className="font-semibold text-ink">{title}</div>
      {children ? <div className="text-[0.9rem] text-ink-2">{children}</div> : null}
      {action}
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string; count?: number }[] }) {
  return (
    <div role="tablist" className="inline-flex rounded-[var(--radius-control)] bg-paper-2 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx('h-8 rounded-[6px] px-3 text-[0.85rem] font-medium transition-colors', value === o.value ? 'bg-surface text-ink shadow-[0_1px_0_var(--line-2)]' : 'text-ink-2 hover:text-ink')}
        >
          {o.label}
          {o.count != null ? <span className="num ml-1.5 text-ink-3">{o.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

/** Native <dialog> modal: accessible focus handling, Esc to close. */
export function Dialog({ open, onClose, title, children, width = 520 }: { open: boolean; onClose: () => void; title: string; children: ReactNode; width?: number }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="m-auto rounded-[var(--radius-panel)] border border-line bg-surface p-0 text-ink backdrop:bg-[#1b243066]"
      style={{ width: `min(${width}px, calc(100vw - 32px))` }}
    >
      <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
        <h2 className="type-title text-[1.05rem]">{title}</h2>
        <button onClick={onClose} className="rounded-md px-2 py-1 text-ink-3 hover:bg-paper-2 hover:text-ink" aria-label="Close">
          ✕
        </button>
      </div>
      <div className="max-h-[75vh] overflow-y-auto px-5 py-4">{children}</div>
    </dialog>
  );
}

/* ------------------------------------------------------------------ table */

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx('overflow-x-auto', className)}>
      <table className="w-full border-collapse text-[0.88rem]">{children}</table>
    </div>
  );
}
export function Th({ children, align = 'left', className }: { children?: ReactNode; align?: 'left' | 'right' | 'center'; className?: string }) {
  return <th className={cx('type-condensed whitespace-nowrap border-b border-line-2 px-2.5 py-2 text-[0.8rem] font-semibold text-ink-2', align === 'right' && 'text-right', align === 'center' && 'text-center', className)}>{children}</th>;
}
export function Td({ children, align = 'left', className, title }: { children?: ReactNode; align?: 'left' | 'right' | 'center'; className?: string; title?: string }) {
  return (
    <td title={title} className={cx('border-b border-line px-2.5 py-2 align-middle', align === 'right' && 'num text-right', align === 'center' && 'text-center', className)}>
      {children}
    </td>
  );
}
