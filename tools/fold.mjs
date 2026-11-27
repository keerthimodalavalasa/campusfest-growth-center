// Fold tall narrow screenshots into side-by-side columns: node fold.mjs <colHeight> in.png out.png [in.png out.png ...]
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const [colH, ...pairs] = process.argv.slice(2);
const H = Number(colH);
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
for (let i = 0; i < pairs.length; i += 2) {
  const buf = fs.readFileSync(pairs[i]);
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
  const cols = Math.ceil(h / H);
  const gap = 16;
  const W = cols * w + (cols - 1) * gap;
  const p = await b.newPage({ viewport: { width: W, height: Math.min(H, h) } });
  const data = buf.toString('base64');
  const imgs = Array.from({ length: cols }, (_, c) => `<div style="position:absolute;left:${c * (w + gap)}px;top:0;width:${w}px;height:${H}px;overflow:hidden"><img src="data:image/png;base64,${data}" style="position:absolute;left:0;top:-${c * H}px"></div>`).join('');
  await p.setContent(`<body style="margin:0;background:#888">${imgs}</body>`);
  await p.waitForTimeout(400);
  await p.screenshot({ path: pairs[i + 1] });
  await p.close();
  console.log('folded', pairs[i + 1], cols, 'cols');
}
await b.close();
