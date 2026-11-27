// Capture design-reference sites: above-the-fold + long screenshot, fonts in use, headings, WebGL/canvas use, license mentions.
// Usage: node inspo.mjs <out-dir> <url> [url...]
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const [outDir, ...urls] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36' });

for (const url of urls) {
  const slug = url.replace(/^https?:\/\//, '').replace(/[^a-z0-9]+/gi, '_').replace(/_+$/, '');
  const page = await ctx.newPage();
  const info = { url, ok: false };
  try {
    const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    info.status = res?.status();
    info.finalUrl = page.url();
    await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(outDir, `${slug}_fold.png`) });
    Object.assign(
      info,
      await page.evaluate(() => {
        const ff = (sel) => {
          const el = document.querySelector(sel);
          return el ? getComputedStyle(el).fontFamily : null;
        };
        const fonts = [...document.fonts].filter((f) => f.status === 'loaded').map((f) => `${f.family.replace(/["']/g, '')} ${f.weight} ${f.style}`);
        const heads = [...document.querySelectorAll('h1,h2,h3')].map((h) => h.textContent.trim().replace(/\s+/g, ' ')).filter(Boolean).slice(0, 18);
        const body = document.body.innerText.replace(/\s+/g, ' ').slice(0, 1800);
        const license = [...document.querySelectorAll('a,p,li,span')].map((e) => e.textContent.trim()).filter((t) => /licen[cs]e|MIT|OFL|open[- ]source|free for commercial|attribution/i.test(t) && t.length < 200).slice(0, 8);
        return {
          ok: true,
          title: document.title,
          description: document.querySelector('meta[name="description"]')?.content ?? null,
          fontsBody: ff('body'),
          fontsH1: ff('h1'),
          fontsH2: ff('h2'),
          fontsButton: ff('button'),
          loadedFonts: [...new Set(fonts)].slice(0, 20),
          headings: heads,
          canvases: document.querySelectorAll('canvas').length,
          svgs: document.querySelectorAll('svg').length,
          bodyBg: getComputedStyle(document.body).backgroundColor,
          bodyColor: getComputedStyle(document.body).color,
          license,
          text: body,
          pageHeight: document.documentElement.scrollHeight,
        };
      }),
    );
    // long capture (capped) to see the page rhythm
    const h = Math.min(info.pageHeight || 900, 5200);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({ path: path.join(outDir, `${slug}_long.png`), fullPage: false, clip: undefined }).catch(() => {});
    if (h > 1000) {
      // scroll through to trigger lazy content, then full-page capped
      for (let y = 0; y < h; y += 800) {
        await page.evaluate((yy) => window.scrollTo(0, yy), y);
        await page.waitForTimeout(250);
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(outDir, `${slug}_long.png`), fullPage: true, clip: { x: 0, y: 0, width: 1440, height: h } }).catch(() => {});
    }
  } catch (e) {
    info.error = String(e).slice(0, 300);
  }
  fs.writeFileSync(path.join(outDir, `${slug}.json`), JSON.stringify(info, null, 1));
  console.log(`${info.ok ? 'OK ' : 'ERR'} ${url} ${info.status ?? ''} ${info.error ?? ''} | ${info.title ?? ''}`);
  await page.close();
}
await browser.close();
