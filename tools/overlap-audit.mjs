// Layout audit: loads every page at several widths and flags text that collides with charts, other text,
// or spills out of its tile. Usage:
//   node overlap-audit.mjs <baseUrl> [--widths 390,820,1024,1180,1280,1366,1440] [--pages /,/plan] [--asof 2025-03-09]
import { chromium } from 'playwright-core';

const args = process.argv.slice(2);
const base = args[0] || 'http://localhost:3100';
const opt = (k, d) => { const i = args.indexOf(k); return i > -1 ? args[i + 1] : d; };
const widths = opt('--widths', '390,820,1024,1180,1280,1366,1440').split(',').map(Number);
const pages = opt('--pages', '/,/plan,/campaigns,/campaigns/C03,/diagnose,/decide,/execute,/data').split(',');
const asofs = opt('--asof', '').split(',').filter(Boolean);

const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
let total = 0;

for (const p of pages) {
  for (const d of ['', ...asofs]) {
    const url = base + p + (d ? `?asOf=${d}` : '');
    for (const w of widths) {
      await page.setViewportSize({ width: w, height: 900 });
      await page.goto(url, { waitUntil: 'networkidle', timeout: 120000 });
      await page.waitForSelector('main h1', { timeout: 60000 }).catch(() => {});
      await page.waitForTimeout(1600); // let load animations settle
      const found = await page.evaluate(() => {
        const out = [];
        const vis = (r) => r.width > 0.5 && r.height > 0.5;
        // an overlap counts only when it is at least 3px deep in both directions (touching line boxes are not a collision)
        const inter = (a, b) => { const w = Math.min(a.right, b.right) - Math.max(a.left, b.left), h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top); return w >= 3 && h >= 3 ? w * h : 0; };
        const inside = (a, b, tol = 1) => a.left >= b.left - tol && a.right <= b.right + tol && a.top >= b.top - tol && a.bottom <= b.bottom + tol;
        const label = (el) => (el.closest('[aria-label]')?.getAttribute('aria-label') || el.closest('h1,h2,h3')?.textContent || '').trim().slice(0, 40);
        const tiles = [...document.querySelectorAll('main [class*="field-"]')].filter((t) => vis(t.getBoundingClientRect()));
        const tileSet = new Set(tiles);
        for (const tile of tiles) {
          // only judge text against the innermost tile that owns it
          const tr = tile.getBoundingClientRect();
          const texts = [];
          const walker = document.createTreeWalker(tile, NodeFilter.SHOW_TEXT);
          for (let n = walker.nextNode(); n; n = walker.nextNode()) {
            if (!n.textContent.trim()) continue;
            const el = n.parentElement;
            if (!el || el.closest('svg') || el.closest('.sr-only') || el.closest('[aria-hidden="true"] svg')) continue;
            let owner = el.closest('[class*="field-"]');
            if (owner !== tile) continue;
            const cs = getComputedStyle(el);
            if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) continue;
            const range = document.createRange();
            range.selectNodeContents(n);
            // judge each line by its line-height box, not the taller font box (tight numerals would false-alarm)
            const fs = parseFloat(cs.fontSize);
            const lh = cs.lineHeight === 'normal' ? fs * 1.2 : parseFloat(cs.lineHeight);
            // intentional scroll areas (overflow auto/scroll) clip what is visible; truncated text (ellipsis) is intended
            const scrollers = [];
            for (let a = el; a && a !== tile; a = a.parentElement) {
              const s = getComputedStyle(a);
              // any box that clips its content (scroll areas, truncated labels, overflow-hidden bars) bounds what shows
              if (/(auto|scroll|hidden|clip)/.test(s.overflowX + s.overflowY)) scrollers.push(a.getBoundingClientRect());
            }
            const truncated = cs.textOverflow === 'ellipsis' || el.closest('.truncate');
            for (const raw of range.getClientRects()) {
              if (!vis(raw)) continue;
              const mid = (raw.top + raw.bottom) / 2, half = Math.min(raw.height, lh) / 2;
              let r = { left: raw.left, right: raw.right, top: mid - half, bottom: mid + half };
              for (const c of scrollers) r = { left: Math.max(r.left, c.left), right: Math.min(r.right, c.right), top: Math.max(r.top, c.top), bottom: Math.min(r.bottom, c.bottom) };
              if (r.right - r.left < 1 || r.bottom - r.top < 1) continue; // scrolled out of view
              r.width = r.right - r.left; r.height = r.bottom - r.top;
              texts.push({ r, el, t: n.textContent.trim().slice(0, 30), truncated, clipped: scrollers.length > 0 });
            }
          }
          const svgs = [...tile.querySelectorAll('svg')].filter((s) => s.closest('[class*="field-"]') === tile && vis(s.getBoundingClientRect()) && s.getBoundingClientRect().width > 24);
          for (const x of texts) {
            // 1. spills out of its tile (horizontally)
            if (!x.truncated && (x.r.right > tr.right + 1 || x.r.left < tr.left - 1)) out.push(`spill   [${label(tile)}] "${x.t}" by ${Math.round(Math.max(x.r.right - tr.right, tr.left - x.r.left))}px`);
            // 2. partly covered by a chart/ring/gauge (a label centred inside a ring is fine)
            for (const s of svgs) {
              const sr = s.getBoundingClientRect();
              if (s.contains(x.el)) continue;
              // a value set in a gauge's mouth on purpose (marked in the markup) is not a collision
              if (x.el.closest('[data-in-gauge]')) continue;
              const a = inter(x.r, sr);
              if (a > 6 && !inside(x.r, sr)) out.push(`overlap [${label(tile)}] text "${x.t}" vs graphic ${Math.round(sr.width)}x${Math.round(sr.height)} (${Math.round(a)}px²)`);
            }
          }
          // 3. text over text
          for (let i = 0; i < texts.length; i++)
            for (let j = i + 1; j < texts.length; j++) {
              const A = texts[i], B = texts[j];
              if (A.el === B.el || A.el.contains(B.el) || B.el.contains(A.el)) continue;
              if (inter(A.r, B.r) > 6) out.push(`collide [${label(tile)}] "${A.t}" x "${B.t}"`);
            }
        }
        // 4. page wider than the viewport
        if (document.documentElement.scrollWidth > innerWidth + 1) out.push(`page    horizontal overflow ${document.documentElement.scrollWidth - innerWidth}px`);
        void tileSet;
        return [...new Set(out)];
      });
      if (found.length) {
        total += found.length;
        console.log(`\n${p}${d ? ' @' + d : ''}  ${w}px`);
        for (const f of found.slice(0, 25)) console.log('  ' + f);
        if (found.length > 25) console.log(`  ... +${found.length - 25} more`);
      }
    }
  }
}
console.log(`\n${total} issues`);
await browser.close();
