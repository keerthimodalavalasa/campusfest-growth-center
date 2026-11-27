import { ctx, handle } from '@/server/api';
import { parseWorkbook, writeWorkbook } from '@/server/importer';
import { ValidationError } from '@/server/mutations';

export const maxDuration = 120;

export const POST = handle(async (req: Request) => {
  const { db } = await ctx();
  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!file || typeof file === 'string') throw new ValidationError('Upload an .xlsx workbook in the "file" field.');
  if (file.size > 15 * 1024 * 1024) throw new ValidationError('File is larger than 15 MB.');
  let parsed;
  try {
    parsed = await parseWorkbook(Buffer.from(await file.arrayBuffer()));
  } catch (e) {
    throw new ValidationError(`Could not read the workbook: ${(e as Error).message}`);
  }
  return writeWorkbook(db, parsed, `upload: ${file.name}`);
});
