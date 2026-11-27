'use client';
import { useState } from 'react';
import { toast } from 'sonner';
import { mutate } from '@/lib/api';
import type { TableMeta } from '@/lib/app-state';
import { dateLabel } from '@/lib/format';
import { Button, Dialog, ErrorNote } from '@/components/ui';
import { asText, carryDate, singular, type Row } from './shared';

/** Confirmation before deleting a source row. */
export function DeleteDialog({ target, onClose }: { target: { table: TableMeta; row: Row } | null; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!target) return <Dialog open={false} onClose={onClose} title="">{null}</Dialog>;
  const { table, row } = target;
  const id = asText(row[table.pk]);
  const what = singular(table.key);
  const carry = carryDate(table, row);

  const remove = async () => {
    setBusy(true);
    setErr(null);
    try {
      await mutate(`/api/data/${table.key}/${encodeURIComponent(id)}`, 'DELETE');
      toast.success('Deleted. Analytics updated.');
      onClose();
    } catch (e) {
      setErr(`Could not delete ${id}: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onClose={onClose} title={`Delete ${what} ${id}?`} width={480}>
      <div className="space-y-3 text-[0.9rem] text-ink-2">
        <p>
          This removes the row from {table.label}. Every page recomputes without it
          {carry ? (
            <>
              {' '}
              from <span className="num font-semibold text-ink">{dateLabel(carry, true)}</span> onward
            </>
          ) : null}
          .
        </p>
        <p>To undo, add the row again, or use Reset to original data to reload the RISA workbook.</p>
        {err ? <ErrorNote>{err}</ErrorNote> : null}
        <div className="flex justify-end gap-2 border-t border-line pt-3">
          <Button variant="ghost" onClick={onClose}>
            Keep the row
          </Button>
          <Button variant="danger" onClick={remove} disabled={busy}>
            {busy ? 'Deleting…' : `Delete ${what}`}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
