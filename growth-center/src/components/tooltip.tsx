'use client';
import { useEffect, useSyncExternalStore, type CSSProperties, type FocusEvent, type PointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cx } from '@/components/ui';

/**
 * One dark tooltip for the whole app (bidri with a hairline), driven by a tiny external store so hovering a mark
 * never re-renders the tile that owns it. Attach with {...tipProps(content)} on any focusable or hoverable element.
 * Once a tooltip is open, moving to the next mark shows it instantly (no second fade).
 */
export interface TipRow {
  color?: string;
  label: ReactNode;
  value: ReactNode;
  total?: boolean;
  swatch?: 'line' | 'square';
}
export interface TipContent {
  title?: ReactNode;
  rows?: TipRow[];
  notes?: ReactNode[];
}
interface TipState {
  content: TipContent;
  x: number;
  y: number;
  instant: boolean;
  owner: unknown;
}

let current: TipState | null = null;
let hiddenAt = 0;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
const subscribe = (f: () => void) => {
  subs.add(f);
  return () => {
    subs.delete(f);
  };
};

export function showTip(content: TipContent, x: number, y: number, owner?: unknown) {
  const instant = !!current || performance.now() - hiddenAt < 300;
  current = { content, x, y, instant, owner };
  emit();
}
export function hideTip(owner?: unknown) {
  if (!current) return;
  if (owner !== undefined && current.owner !== owner) return;
  current = null;
  hiddenAt = performance.now();
  emit();
}

/** Pointer + keyboard handlers that show `content` near the pointer, or under the element on focus. */
export function tipProps(content: TipContent | (() => TipContent)) {
  const get = () => (typeof content === 'function' ? content() : content);
  return {
    onPointerMove: (e: PointerEvent<Element>) => {
      if (e.pointerType === 'touch') return;
      showTip(get(), e.clientX, e.clientY);
    },
    // leave fires before the next mark's move, which then reopens instantly
    onPointerLeave: () => hideTip(),
    onFocus: (e: FocusEvent<Element>) => {
      const r = e.currentTarget.getBoundingClientRect();
      showTip(get(), r.left + r.width / 2, r.bottom - 6);
    },
    onBlur: () => hideTip(),
  };
}

/** Tooltip body: title, swatch rows (label + tabular value), an optional total row and notes. Shared with ChartTip. */
export function TipBody({ title, rows = [], notes = [] }: TipContent) {
  return (
    <>
      {title != null ? <div className="mb-1.5 text-[12px] font-[650] text-silver">{title}</div> : null}
      {rows.map((r, i) => (
        <div key={i} className={cx('grid grid-cols-[12px_1fr_auto] items-center gap-2 leading-[1.6]', r.total && 'mt-1 border-t border-bidri-3 pt-1')}>
          {r.swatch === 'square' ? (
            <i className="block size-2.5 rounded-[3px]" style={{ background: r.color ?? 'transparent' }} />
          ) : (
            <i className="block h-0 w-3 rounded-[2px] border-t-[2.5px]" style={{ borderColor: r.color ?? 'transparent' }} />
          )}
          <span className="min-w-0 text-silver">{r.label}</span>
          <b className="tab text-right font-[750] text-white">{r.value}</b>
        </div>
      ))}
      {notes.map((n, i) => (
        <p key={i} className={cx('leading-[1.45] text-silver [&_b]:text-white', (i > 0 || rows.length > 0) && 'mt-1.5')}>
          {n}
        </p>
      ))}
    </>
  );
}

/** Mount once (the shell does). Renders the active tooltip into <body>, flipped to stay on screen. */
export function TipLayer() {
  const s = useSyncExternalStore(subscribe, () => current, () => null);
  useEffect(() => {
    const h = () => hideTip();
    window.addEventListener('scroll', h, { passive: true, capture: true });
    return () => window.removeEventListener('scroll', h, { capture: true });
  }, []);
  if (!s) return null;
  const W = window.innerWidth;
  const H = window.innerHeight;
  let left: number;
  let tx = '0px';
  if (W < 640) left = Math.max(8, Math.min(s.x - 140, W - 288));
  else if (s.x > W - 300) {
    left = s.x - 14;
    tx = '-100%';
  } else left = s.x + 14;
  const flipY = s.y > H - 220;
  const ty = flipY ? '-100%' : '0px';
  const style = { left, top: flipY ? s.y - 14 : s.y + 14, transform: `translate(${tx}, ${ty})`, '--tx': tx, '--ty': ty } as CSSProperties;
  return createPortal(
    <div role="tooltip" className="gc-tip" data-instant={s.instant ? '' : undefined} style={style}>
      <TipBody {...s.content} />
    </div>,
    document.body,
  );
}
