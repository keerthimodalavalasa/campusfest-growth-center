// Screenshot pages of the running Growth Center. Usage:
//   node appshot.mjs <out-dir> <width> <url> [url...]   (full-page PNG per URL)
import { chromium } from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs';
const [outDir, width, ...urls] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const ctx = await browser.newContext({ viewport: { width: Number(width) || 1600, height: 1000 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
for (const url of urls) {
  errors.length = 0;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
      await page.waitForSelector('main h1', { timeout: 60000 });
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1200);
      break;
    } catch (e) { if (attempt === 2) errors.push('nav: ' + e.message); }
  }
  const name = (new URL(url).pathname.replace(/\//g, '_').replace(/^_$/, 'home') || 'home') + (new URL(url).search ? '_' + new URL(url).searchParams.get('asOf') : '');
  const out = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: out, fullPage: true });
  console.log('OK', url, '->', out);
  if (errors.length) console.log('  ERRORS:\n   - ' + [...new Set(errors)].slice(0, 8).join('\n   - '));
}
await browser.close();
