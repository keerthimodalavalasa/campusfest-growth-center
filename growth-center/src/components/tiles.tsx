'use client';
import { useId, useState, type CSSProperties, type ReactNode } from 'react';
import { ChevronDownDuotone } from 'runeicons-react';
import { cx, Ico, Tile, type IconComponent, type TileField } from '@/components/ui';

/**
 * Small metric tile: duotone icon + label, a micro-visual pinned top-right (ring, gauge, mini bars), the numeral
 * bottom-left with its comparison, and an optional footer on a hairline. Promoted from the Overview's attainment
 * tiles so every page's header row reads the same. One solid family tile per row at most; the rest stay limestone.
 */
export function MetricTile({
  field = 'stone',
  icon,
  ia,
  ib,
  title,
  viz,
  vizClass,
  value,
  sub,
  foot,
  delay,
  label,
  className,
  style,
  wideViz,
}: {
  field?: TileField;
  icon: IconComponent;
  ia?: string;
  ib?: string;
  title: ReactNode;
  viz?: ReactNode;
  vizClass?: string;
  value: ReactNode;
  sub?: ReactNode;
  foot?: ReactNode;
  delay?: number;
  label: string;
  className?: string;
  style?: CSSProperties;
  /** the micro-visual is wider than the 72px ring (mini bars): keep the title clear of it */
  wideViz?: boolean;
}) {
  return (
    <Tile field={field} size="s" delay={delay} aria-label={label} className={cx('flex min-h-0 flex-col', className)} style={style}>
      {/* The visual sits in the flow beside the title, never on top of it: the title keeps a minimum width
          and wraps; when the tile is too narrow for both, the visual drops to its own line. */}
      <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-2.5">
        <div className={cx('flex flex-1 items-start gap-2', viz ? (wideViz ? 'min-w-[8rem]' : 'min-w-[8.5rem]') : 'min-w-0')}>
          <Ico icon={icon} size={20} ia={ia} ib={ib} />
          <h3 className="min-w-0 text-[13.5px] leading-[1.3] font-[650] [overflow-wrap:break-word] max-[720px]:text-[13px]">{title}</h3>
        </div>
        {viz ? <div className={cx('relative -mt-1.5 -mr-1.5 size-[72px] shrink-0 max-[720px]:size-16', vizClass)}>{viz}</div> : null}
      </div>
      <div className="mt-auto pt-3">
        <div className="num text-[46px] leading-[0.9] max-[720px]:text-[36px]">{value}</div>
        {sub ? <div className="mt-[5px] text-[12.5px] leading-[1.35] font-[550] text-k2">{sub}</div> : null}
      </div>
      {foot ? <div className="mt-2.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 pt-2.5 text-[12.5px] font-[600] shadow-[inset_0_1px_0_var(--rule)]">{foot}</div> : null}
    </Tile>
  );
}

/**
 * "How this works": methodology that must stay, collapsed under the visual it explains. Same affordance as the
 * chart "View data" disclosure, so words never lead a tile.
 */
export function HowThisWorks({ children, label = 'How this works', className, wide }: { children: ReactNode; label?: string; className?: string; /** let tables use the tile's full width */ wide?: boolean }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className={cx('mt-3', className)}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={id}
        className="inline-flex items-center gap-1.5 rounded-md text-[12.5px] font-[600] text-k2 transition-colors duration-150 hover:text-ink"
      >
        <span className={cx('transition-transform duration-200 ease-out', open && 'rotate-180')}>
          <Ico icon={ChevronDownDuotone} size={14} ia="currentColor" />
        </span>
        {label}
      </button>
      {open ? (
        <div id={id} className={cx('mt-2 space-y-1.5 text-[13px] leading-[1.5] text-k2 [&_b]:font-[650] [&_b]:text-ink', !wide && 'max-w-[78ch]')}>
          {children}
        </div>
      ) : null}
    </div>
  );
}

/** A row heading that sits on the page ground above a group of tiles (no tile of its own). */
export function GroupHead({ icon, title, children, aside, delay, className }: { icon?: IconComponent; title: ReactNode; children?: ReactNode; aside?: ReactNode; delay?: number; className?: string }) {
  return (
    <div className={cx('flex flex-wrap items-center gap-x-4 gap-y-2 px-1 pt-1.5 pb-3', delay != null && 'anim-settle', className)} style={delay != null ? ({ '--d': `${delay}ms` } as CSSProperties) : undefined}>
      <h2 className="flex items-center gap-2 text-[15px] font-[650]">
        {icon ? <Ico icon={icon} size={20} ia="var(--ink)" ib="var(--stone-3)" /> : null}
        {title}
      </h2>
      {children}
      {aside ? <div className="ml-auto text-[12.5px] font-[550] text-ink-2">{aside}</div> : null}
    </div>
  );
}
