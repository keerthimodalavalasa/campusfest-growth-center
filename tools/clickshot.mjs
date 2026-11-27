// Screenshot after clicking: node clickshot.mjs <out.png> <width> <url> <click text|aria-label> [more clicks...]
// Each click target is matched by accessible name (button or link); prefix "label:" to match aria-label exactly.
import { chromium } from 'playwright-core';
const [out, width, url, ...clicks] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: Number(width), height: 1000 } });
const errors = [];
p.on('pageerror', (e) => errors.push(String(e)));
await p.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
await p.waitForSelector('main h1', { timeout: 60000 });
await p.waitForTimeout(1500);
for (const c of clicks) {
  const name = c.startsWith('label:') ? c.slice(6) : c;
  const loc = p.getByRole('button', { name, exact: c.startsWith('label:') }).first();
  await loc.scrollIntoViewIfNeeded();
  await loc.click();
  await p.waitForTimeout(700);
}
await p.screenshot({ path: out, fullPage: true });
console.log('OK', out, errors.length ? 'ERRORS ' + errors.join(' | ') : '');
await b.close();
