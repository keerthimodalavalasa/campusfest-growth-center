// Export a multi-file HTML deck to one vector PDF (text stays selectable).
// Usage: node tools/pdf.mjs <slides-dir> <out.pdf> [filename-regex]   (every matching *.html in the dir, sorted by name)
import { chromium } from 'playwright-core';
import { PDFDocument } from 'pdf-lib';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [dirArg, outArg, filterArg] = process.argv.slice(2);
const dir = path.resolve(dirArg);
const out = path.resolve(outArg);
const only = filterArg ? new RegExp(filterArg) : null;
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html') && (!only || only.test(f))).sort();

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--allow-file-access-from-files'],
});
const page = await (await browser.newContext({ viewport: { width: 1920, height: 1080 } })).newPage();
// Serve a JPEG twin (same name, .jpg) for full-frame render PNGs when one exists, to keep the PDF small.
await page.route(/\/render[^/]*\.png$|\/render\/[^/]+\.png$/, async (route) => {
  const p = decodeURIComponent(new URL(route.request().url()).pathname).replace(/^\/([A-Za-z]:)/, '$1');
  const jpg = p.replace(/\.png$/, '.jpg');
  if (fs.existsSync(jpg)) return route.fulfill({ status: 200, contentType: 'image/jpeg', body: fs.readFileSync(jpg) });
  return route.continue();
});
const merged = await PDFDocument.create();

for (const f of files) {
  await page.goto(pathToFileURL(path.join(dir, f)).href, { waitUntil: 'networkidle', timeout: 60000 });
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await page.waitForTimeout(500);
  await page.addStyleTag({ content: '@page{size:1920px 1080px;margin:0} html,body{margin:0!important}' });
  const bytes = await page.pdf({ width: '1920px', height: '1080px', printBackground: true, preferCSSPageSize: true, pageRanges: '1' });
  const doc = await PDFDocument.load(bytes);
  const [p] = await merged.copyPages(doc, [0]);
  merged.addPage(p);
  console.log('page', f);
}
fs.writeFileSync(out, await merged.save());
console.log(`wrote ${out} (${files.length} pages)`);
await browser.close();
