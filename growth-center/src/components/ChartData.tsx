'use client';
import { useId, useState, type ReactNode } from 'react';
import { ChevronDownDuotone } from 'runeicons-react';
import { cx, Ico } from '@/components/ui';

/** "View data" disclosure under a chart: the exact numbers as a compact tabular table. */
export function ChartData({ children, label = 'View data', className }: { children: ReactNode; label?: string; className?: string }) {
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
        {open ? 'Hide data' : label}
      </button>
      {open ? (
        <div id={id} className="tab mt-2 max-h-[240px] overflow-auto text-[12px] [&_td]:py-1 [&_td]:text-[12px] [&_th]:py-1 [&_th]:text-[12px]">
          {children}
        </div>
      ) : null}
    </div>
  );
}
