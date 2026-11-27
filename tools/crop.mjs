// crop a region of a PNG using Chrome canvas: node crop.mjs in.png out.png x y w h
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const [inp, out, x, y, w, h] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: Number(w), height: Number(h) } });
const data = fs.readFileSync(inp).toString('base64');
await p.setContent(`<body style="margin:0;overflow:hidden"><img src="data:image/png;base64,${data}" style="position:absolute;left:-${x}px;top:-${y}px"></body>`);
await p.waitForTimeout(300);
await p.screenshot({ path: out });
await b.close();
