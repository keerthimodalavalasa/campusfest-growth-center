// Screenshot one or more local HTML files with system Chrome (playwright-core).
// Usage:
//   node shot.mjs <file.html> <out.png> [--w 1920] [--h 1080] [--transparent] [--scale 1]
//   node shot.mjs --batch <dir-with-html> <out-dir>      (every *.html in dir -> out-dir/<name>.png)
// Waits for web fonts and, if the page sets window.__ready = true (e.g. after a three.js render), for that flag.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const args = process.argv.slice(2);
const flag = (name, def) => {
  const i = args.indexOf(name);
  if (i === -1) return def;
  const v = args[i + 1];
  return v === undefined || v.startsWith('--') ? true : v;
};

const W = Number(flag('--w', 1920));
const H = Number(flag('--h', 1080));
const SCALE = Number(flag('--scale', 1));
const TRANSPARENT = !!flag('--transparent', false);

let jobs = [];
if (args[0] === '--batch') {
  const dir = path.resolve(args[1]);
  const out = path.resolve(args[2]);
  fs.mkdirSync(out, { recursive: true });
  jobs = fs.readdirSync(dir).filter(f => f.endsWith('.html')).sort()
    .map(f => [path.join(dir, f), path.join(out, f.replace(/\.html$/, '.png'))]);
} else {
  jobs = [[path.resolve(args[0]), path.resolve(args[1])]];
}

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--allow-file-access-from-files'],
});
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: SCALE });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

for (const [file, out] of jobs) {
  errors.length = 0;
  const target = /^https?:\/\//.test(args[0]) && jobs.length === 1 ? args[0] : pathToFileURL(file).href;
  await page.goto(target, { waitUntil: 'networkidle', timeout: 60000 }).catch(e => errors.push('goto: ' + e.message));
  await page.evaluate(() => document.fonts && document.fonts.ready);
  const hasReady = await page.evaluate(() => 'ㅤ' && typeof window.__ready !== 'undefined');
  if (hasReady) {
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 }).catch(() => errors.push('timeout waiting for window.__ready'));
  }
  await page.waitForTimeout(400);
  // overflow report: elements whose box leaves the 1920x1080 canvas, and text clipped inside its box
  const overflow = await page.evaluate(([w, h]) => {
    const bad = [];
    for (const el of document.querySelectorAll('body *')) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (el.closest('[data-allow-bleed]')) continue;
      if (r.right > w + 1 || r.bottom > h + 1 || r.left < -1 || r.top < -1) {
        bad.push(`${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').join('.') : ''} leaves canvas (${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)})`);
      }
      if ((el.scrollHeight > el.clientHeight + 2 && ['hidden', 'clip'].includes(cs.overflowY)) ||
          (el.scrollWidth > el.clientWidth + 2 && ['hidden', 'clip'].includes(cs.overflowX))) {
        if (el.tagName !== 'BODY' && el.tagName !== 'HTML') bad.push(`${el.tagName.toLowerCase()}.${String(el.className)} clips its own content`);
      }
    }
    return bad.slice(0, 15);
  }, [W, H]);
  await page.screenshot({ path: out, omitBackground: TRANSPARENT, fullPage: false });
  console.log(`OK ${path.basename(file)} -> ${out}`);
  if (overflow.length) console.log('  OVERFLOW:\n   - ' + overflow.join('\n   - '));
  if (errors.length) console.log('  ERRORS:\n   - ' + errors.join('\n   - '));
}
await browser.close();
