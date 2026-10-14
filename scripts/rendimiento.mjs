/* LCP y peso en un móvil de gama media (Pixel 7 emulado, 4G lento, CPU ×4).
   Uso: node scripts/rendimiento.mjs   (3 pasadas; GSAP y Lenis desde copia local) */
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const require = createRequire('C:/Users/alvar/Desktop/WEBS NEGOCIOS/alvarotaiagu.github.io/');
const { chromium } = require('playwright');
const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.avif': 'image/avif' };
const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
  const f = path.join(RAIZ, p);
  if (!f.startsWith(RAIZ) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('no'); return; }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => srv.listen(8765, r));
const CACHE = path.join(os.tmpdir(), 'neixon-cdn');
const b = await chromium.launch();
for (let n = 1; n <= 3; n++) {
  const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true });
  await ctx.route(/(gsap\.min|ScrollTrigger\.min|lenis\.min)\.js$/, (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(path.join(CACHE, r.request().url().split('/').pop())) }));
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.addInitScript(() => {
    try { localStorage.setItem('lagarita-cookies', 'si'); } catch (e) {}
    window.__lcp = null; window.__long = [];
    new PerformanceObserver((l) => { const e = l.getEntries().pop(); window.__lcp = { t: e.startTime, url: e.url || e.element?.tagName }; }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__long.push(Math.round(e.duration)))).observe({ type: 'longtask', buffered: true });
  });
  let bytes = 0, reqs = 0;
  cdp.on('Network.loadingFinished', (e) => { bytes += e.encodedDataLength; reqs++; });
  const t0 = Date.now();
  await page.goto('http://localhost:8765/index.html');
  await page.waitForFunction(() => document.documentElement.classList.contains('cortina-fuera'), null, { timeout: 30000 });
  const fuera = Date.now() - t0;
  await page.waitForTimeout(800);
  const r = await page.evaluate(() => ({ lcp: window.__lcp, long: window.__long }));
  console.log(`pasada ${n}: LCP ${Math.round(r.lcp.t)} ms (${String(r.lcp.url).split('/').pop()}) · portal fuera ${fuera} ms · ${reqs} peticiones, ${(bytes / 1024).toFixed(0)} KB · tareas largas ${JSON.stringify(r.long)}`);
  await ctx.close();
}
await b.close(); srv.close();
