'use client';
import { forwardRef, useEffect, useRef, type ButtonHTMLAttributes, type ComponentType, type CSSProperties, type HTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { ArrowUpRightDuotone, CheckDuotone, CircleAlertDuotone, RotateCwDuotone, SquareStopDuotone, XDuotone } from 'runeicons-react';
import { DECISION, SEVERITY, type DecisionKey } from '@/lib/colors';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

/* ------------------------------------------------------------------ icons */

export type IconComponent = ComponentType<{ size?: number }>;

/**
 * A Rune duotone icon with the context's two inks. A Tile field sets --ia / --ib; pass `ia` / `ib` to override.
 */
export function Ico({ icon: Icon, size = 18, ia, ib, className }: { icon: IconComponent; size?: number; ia?: string; ib?: string; className?: string }) {
  const style = { ...(ia ? { '--ia': ia } : null), ...(ib ? { '--ib': ib } : null) } as CSSProperties;
  return (
    <span aria-hidden className={cx('rune-duo inline-flex shrink-0', className)} style={style}>
      <Icon size={size} />
    </span>
  );
}

/* ------------------------------------------------------------------ tiles */

export type TileField = 'lac' | 'nizami' | 'haldi' | 'pista' | 'stone' | 'bidri' | 'ground';
export type TileSize = 'hero' | 'l' | 's' | 'm';

const TILE_SIZE: Record<TileSize, string> = {
  hero: 'rounded-tile-hero p-[26px_28px_24px] max-[720px]:p-[22px_20px_20px]',
  l: 'rounded-tile-l p-5',
  s: 'rounded-tile-s p-[18px_18px_16px] max-[720px]:p-3.5',
  m: 'rounded-tile-m p-[12px_14px]',
};

/**
 * The bento tile: a solid family field or bare limestone, never a white card. Replaces cards and panels.
 * One solid tile per family is its lead number; every other use of that hue is a mark on limestone.
 * `delay` (ms) joins the page's orchestrated load: the tile settles in once, on mount.
 */
export function Tile({
  field = 'stone',
  size = 'l',
  pad = true,
  delay,
  as: Tag = 'section',
  className,
  style,
  children,
  ...rest
}: { field?: TileField; size?: TileSize; pad?: boolean; delay?: number; as?: 'section' | 'div' | 'article' | 'aside' } & HTMLAttributes<HTMLElement>) {
  const sz = TILE_SIZE[size];
  return (
    <Tag
      {...rest}
      className={cx('relative min-w-0', `field-${field}`, pad ? sz : sz.split(' ')[0], delay != null && 'anim-settle', className)}
      style={delay != null ? ({ ...style, '--d': `${delay}ms` } as CSSProperties) : style}
    >
      {children}
    </Tag>
  );
}

/** Tile heading row: duotone icon, a label of six words or fewer, and an optional aside on the right. */
export function TileHead({ icon, children, aside, className, as: Tag = 'h2' }: { icon?: IconComponent; children: ReactNode; aside?: ReactNode; className?: string; as?: 'h2' | 'h3' | 'div' }) {
  return (
    <div className={cx('flex items-center gap-2', className)}>
      {icon ? <Ico icon={icon} size={20} /> : null}
      <Tag className="min-w-0 text-[14px] font-[650] leading-[1.3]">{children}</Tag>
      {aside ? <div className="ml-auto shrink-0 text-[12.5px] font-[550] whitespace-nowrap text-k2">{aside}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ layout */

export function PageHeader({ title, lede, actions }: { title: string; lede?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 pb-5">
      <div className="max-w-[72ch]">
        <h1 className="type-display text-[2.6rem] text-ink max-[720px]:text-[2.1rem]">{title}</h1>
        {lede ? <p className="mt-2 text-[14px] text-ink-2">{lede}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

/* ------------------------------------------------------------------ controls */

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent' | 'bidri';
export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm' | 'md'; icon?: ReactNode }>(function Button(
  { variant = 'secondary', size = 'md', icon, className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      {...rest}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-full font-[650] whitespace-nowrap transition-[transform,background-color,color,box-shadow] duration-150 ease-out active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100',
        size === 'sm' ? 'h-8 px-3 text-[12.5px]' : 'h-10 px-4 text-[14px]',
        variant === 'primary' && 'bg-ink text-white hover:bg-[#2c313a]',
        variant === 'bidri' && 'bg-bidri text-white hover:bg-[#343a42]',
        variant === 'accent' && 'bg-lac text-white hover:bg-[#8c0f32]',
        variant === 'secondary' && 'bg-ground text-ink shadow-[inset_0_0_0_1.5px_var(--stone-3)] hover:bg-stone-2',
        variant === 'ghost' && 'text-ink-2 hover:bg-stone-2 hover:text-ink',
        variant === 'danger' && 'bg-ground text-st-stop shadow-[inset_0_0_0_1.5px_color-mix(in_srgb,var(--st-stop)_45%,transparent)] hover:bg-[#f8dcde]',
        className,
      )}
    >
      {icon}
      {children}
    </button>
  );
});

const fieldBase =
  'w-full rounded-[12px] border-[1.5px] border-stone-3 bg-ground px-3 text-[14px] text-ink placeholder:text-ink-2/80 transition-colors duration-150 hover:border-ink-2/60 focus:border-ink focus:outline-none disabled:bg-stone-2 disabled:text-ink-2';

export function Field({ label, hint, children, error }: { label: string; hint?: string; children: ReactNode; error?: string | null }) {
  return (
    <label className="flex flex-col gap-1.5 text-[13px]">
      <span className="font-[600] text-ink">{label}</span>
      {children}
      {error ? <span className="font-[600] text-st-stop">{error}</span> : hint ? <span className="text-ink-2">{hint}</span> : null}
    </label>
  );
}
export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function TextInput({ className, ...p }, ref) {
  return <input ref={ref} {...p} className={cx(fieldBase, 'h-10', className)} />;
});
export function Select({ className, children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...p} className={cx(fieldBase, 'h-10 cursor-pointer pr-8', className)}>
      {children}
    </select>
  );
}
export function TextArea({ className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...p} className={cx(fieldBase, 'min-h-20 py-2', className)} />;
}

/* ------------------------------------------------------------------ chips and status */

export function Chip({ children, fg = 'var(--ink)', bg = 'var(--stone-2)', className, title }: { children: ReactNode; fg?: string; bg?: string; className?: string; title?: string }) {
  return (
    <span title={title} className={cx('inline-flex h-[26px] items-center gap-1.5 rounded-full px-2.5 text-[12.5px] leading-none font-[650] whitespace-nowrap', className)} style={{ color: fg, background: bg }}>
      {children}
    </span>
  );
}

/** Severity pips: three rising bars, `level` of them filled. Severity is shown as weight, never as a hue. */
export function Pips({ level, className }: { level: 1 | 2 | 3 | number; className?: string }) {
  return (
    <span aria-hidden className={cx('inline-flex h-2.5 items-end gap-[2px]', className)}>
      {[4, 7, 10].map((h, k) => (
        <i key={h} className="block w-[3px] rounded-[1px] bg-current" style={{ height: h, opacity: k < level ? 1 : 0.28 }} />
      ))}
    </span>
  );
}

const STATUS_GLYPH: Record<DecisionKey, IconComponent> = { scale: ArrowUpRightDuotone, keep: CheckDuotone, change: RotateCwDuotone, stop: SquareStopDuotone };

/** Status call pill: solid reserved colour, white glyph and label. Never colour alone. */
export function StatusPill({ decision, className }: { decision: DecisionKey; className?: string }) {
  const d = DECISION[decision];
  return (
    <span className={cx('inline-flex h-6 shrink-0 items-center gap-1 rounded-full pr-[9px] pl-1.5 text-[12px] leading-none font-[700] whitespace-nowrap text-white', className)} style={{ background: d.fg }}>
      <Ico icon={STATUS_GLYPH[decision]} size={14} ia="#fff" ib="#fff" />
      {d.label}
    </span>
  );
}

export function SeverityChip({ severity }: { severity: keyof typeof SEVERITY }) {
  const s = SEVERITY[severity];
  return (
    <Chip fg={s.fg} bg={s.bg}>
      <Pips level={s.level} />
      {s.label}
    </Chip>
  );
}

export function StatusDot({ color }: { color: string }) {
  return <span className="inline-block size-2.5 shrink-0 rounded-full" style={{ background: color }} aria-hidden />;
}

/* ------------------------------------------------------------------ figures */

/** A figure with its comparison: condensed numeral, label above, comparison below. */
export function Figure({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'good' | 'bad' | 'warn' | 'neutral' }) {
  const color = tone === 'good' ? 'var(--st-scale)' : tone === 'bad' ? 'var(--st-stop)' : tone === 'warn' ? 'var(--st-change)' : undefined;
  return (
    <div className="min-w-0">
      <div className="text-[12.5px] font-[550] text-k2">{label}</div>
      <div className="num mt-1 text-[28px] leading-[0.95]" style={color ? { color } : undefined}>
        {value}
      </div>
      {sub ? <div className="mt-1 text-[12.5px] text-k2">{sub}</div> : null}
    </div>
  );
}

/** Attainment bar: actual vs goal, with an optional projection (shown hatched-light) and a goal tick. */
export function Meter({ value, goal, projected, color = 'var(--ink)', height = 8 }: { value: number; goal: number | null; projected?: number | null; color?: string; height?: number }) {
  const max = Math.max(goal ?? 0, value, projected ?? 0, 1) * 1.08;
  const w = (x: number) => `${Math.min(100, (x / max) * 100)}%`;
  return (
    <div className="relative w-full rounded-full bg-stone-2" style={{ height }} role="img" aria-label={`${Math.round(value)} of ${goal ?? 'no goal'}`}>
      {projected != null ? <div className="absolute inset-y-0 left-0 rounded-full opacity-30" style={{ width: w(projected), background: color }} /> : null}
      <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: w(value), background: color }} />
      {goal ? <div className="absolute -inset-y-1 w-0.5 rounded bg-ink" style={{ left: w(goal) }} title={`Goal ${goal}`} /> : null}
    </div>
  );
}

/**
 * Period delta badge ("vs last week"): a glyph and the absolute change. On a solid field it keeps the field's ink;
 * pass `colored` on limestone to tint good / bad with the reserved status colours (the glyph still carries it).
 */
export function Delta({ now, prev, format, lowerIsBetter, unit = '', colored, label = 'vs last week' }: { now: number | null | undefined; prev: number | null | undefined; format: (n: number) => string; lowerIsBetter?: boolean; unit?: string; colored?: boolean; label?: string }) {
  if (now == null || prev == null || !Number.isFinite(now) || !Number.isFinite(prev)) return null;
  const d = now - prev;
  if (format(Math.abs(d)) === format(0)) return <span className="font-[600]">no change<span className="sr-only"> {label}</span></span>;
  const good = lowerIsBetter ? d < 0 : d > 0;
  return (
    <span className="tab inline-flex items-center gap-[3px] font-[700] whitespace-nowrap" title={label} style={colored ? { color: good ? 'var(--st-scale)' : 'var(--st-stop)' } : undefined}>
      <span aria-hidden className="text-[10px]">{d > 0 ? '▲' : '▼'}</span>
      <span className="sr-only">{d > 0 ? 'up' : 'down'} </span>
      {format(Math.abs(d))}
      {unit}
      <span className="sr-only"> {label}</span>
    </span>
  );
}

/* ------------------------------------------------------------------ states */

export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return <div aria-hidden className={cx('animate-pulse rounded-[10px] bg-stone-2', className)} style={style} />;
}

export function ErrorNote({ children, onRetry }: { children: ReactNode; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-center gap-3 rounded-tile-m bg-stone px-3.5 py-2.5 text-[13.5px] text-ink">
      <Ico icon={CircleAlertDuotone} size={20} ia="var(--st-stop)" ib="color-mix(in srgb, var(--st-stop) 35%, transparent)" />
      <span className="min-w-0 flex-1">{children}</span>
      {onRetry ? (
        <Button size="sm" variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-tile-s border-[1.5px] border-dashed border-stone-3 px-5 py-6">
      <div className="text-[15px] font-[650] text-ink">{title}</div>
      {children ? <div className="text-[13.5px] text-ink-2">{children}</div> : null}
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------ segmented controls */

/** Tabs: the segmented pill (ink when selected) on a stone-2 track. */
export function Tabs<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string; count?: number }[] }) {
  return (
    <div role="tablist" className="inline-flex max-w-full gap-0.5 overflow-x-auto rounded-full bg-stone-2 p-1 [scrollbar-width:none]">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'h-8 shrink-0 rounded-full px-3.5 text-[13px] font-[600] whitespace-nowrap transition-[background-color,color,transform] duration-150 active:scale-[0.97]',
            value === o.value ? 'bg-ink text-white' : 'text-ink-2 hover:bg-stone hover:text-ink',
          )}
        >
          {o.label}
          {o.count != null ? <span className={cx('tab ml-1.5', value === o.value ? 'text-silver' : 'text-ink-2')}>{o.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

/** Segmented buttons (toggle group) on a white track, as the as-of presets use. */
export function Segmented<T extends string>({ value, onChange, options, label, className }: { value: T | null; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string; className?: string }) {
  return (
    <div role="group" aria-label={label} className={cx('flex gap-0.5 rounded-full bg-ground p-1', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'h-[34px] rounded-full px-3.5 text-[14px] font-[600] whitespace-nowrap transition-[background-color,color,transform] duration-150 active:scale-[0.97] max-[720px]:flex-1 max-[720px]:px-2',
            value === o.value ? 'bg-ink text-white' : 'text-ink-2 hover:bg-stone hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ dialog */

/** Native <dialog> modal: accessible focus handling, Esc to close. A raised surface, like the copilot drawer. */
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
      className="m-auto rounded-tile-l bg-ground p-0 text-ink shadow-[0_24px_60px_rgba(26,29,35,0.22)] backdrop:bg-[#1a1d2352]"
      style={{ width: `min(${width}px, calc(100vw - 32px))` }}
    >
      <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
        <h2 className="text-[16px] font-[700]">{title}</h2>
        <button type="button" onClick={onClose} className="grid size-9 place-items-center rounded-full bg-stone text-ink transition-[background-color,transform] duration-150 hover:bg-stone-2 active:scale-[0.95]" aria-label="Close">
          <Ico icon={XDuotone} size={18} />
        </button>
      </div>
      <div className="max-h-[75vh] overflow-y-auto px-5 pb-5">{children}</div>
    </dialog>
  );
}

/* ------------------------------------------------------------------ table */

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx('overflow-x-auto', className)}>
      <table className="w-full border-collapse text-[13px]">{children}</table>
    </div>
  );
}
export function Th({ children, align = 'left', className }: { children?: ReactNode; align?: 'left' | 'right' | 'center'; className?: string }) {
  return <th className={cx('border-b-[1.5px] border-stone-3 px-2.5 py-2 text-[12.5px] font-[600] whitespace-nowrap text-ink-2', align === 'right' && 'text-right', align === 'center' && 'text-center', align === 'left' && 'text-left', className)}>{children}</th>;
}
export function Td({ children, align = 'left', className, title }: { children?: ReactNode; align?: 'left' | 'right' | 'center'; className?: string; title?: string }) {
  return (
    <td title={title} className={cx('border-b border-stone-2 px-2.5 py-2 align-middle', align === 'right' && 'tab text-right', align === 'center' && 'text-center', className)}>
      {children}
    </td>
  );
}
