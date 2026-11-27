'use client';
import { useId, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cx } from '@/components/ui';

/** "View data" disclosure under a chart (pattern from Sesama UI): the exact numbers as a table. */
export function ChartData({ children, label = 'View data' }: { children: ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="mt-2">
      <button onClick={() => setOpen(!open)} aria-expanded={open} aria-controls={id} className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[0.8rem] font-medium text-ink-3 hover:bg-paper-2 hover:text-ink">
        <ChevronDown size={14} className={cx('transition-transform', open && 'rotate-180')} aria-hidden />
        {open ? 'Hide data' : label}
      </button>
      {open ? (
        <div id={id} className="mt-1 max-h-72 overflow-auto rounded-lg border border-line">
          {children}
        </div>
      ) : null}
    </div>
  );
}
