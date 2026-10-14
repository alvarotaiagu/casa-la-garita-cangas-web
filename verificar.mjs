/* Verificación de la web de La Garita (Playwright, bajando con la rueda).
   Uso: node verificar.mjs [--capturas]   → capturas en ./pruebas/ */
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const require = createRequire('C:/Users/alvar/Desktop/WEBS NEGOCIOS/alvarotaiagu.github.io/');
const { chromium } = require('playwright');

const RAIZ = path.dirname(fileURLToPath(import.meta.url));
const PUERTO = 8764;                 // puerto propio de esta web
const CAPTURAS = process.argv.includes('--capturas');
const DIR_CAP = path.join(RAIZ, 'pruebas');
if (CAPTURAS) fs.mkdirSync(DIR_CAP, { recursive: true });
const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.avif': 'image/avif' };
const servidor = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = path.join(RAIZ, p);
  if (!f.startsWith(RAIZ) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('no'); return; }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
servidor.on('error', (e) => { console.error(`El puerto ${PUERTO} está ocupado (¿otra sesión?): ${e.message}`); process.exit(2); });
await new Promise((r) => servidor.listen(PUERTO, r));
const BASE = `http://localhost:${PUERTO}/`;
console.log('sirviendo en ' + BASE);

const fallos = [];
let nOk = 0;
const mal = (m) => { fallos.push(m); console.log('  FALLO  ' + m); };
const ok = (m) => { nOk++; console.log('  ok     ' + m); };
const info = (m) => console.log('  ·      ' + m);
const comprobar = (cond, m, detalle) => (cond ? ok(m) : mal(m + (detalle !== undefined ? ' → ' + JSON.stringify(detalle) : '')));
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const cap = async (page, nombre, op) => { if (CAPTURAS) await page.screenshot({ path: path.join(DIR_CAP, nombre + '.png'), ...(op || {}) }); };
const sinCookies = () => { try { localStorage.setItem('lagarita-cookies', 'si'); } catch (e) {} };

const browser = await chromium.launch({ headless: true });

/* GSAP y Lenis desde una copia local: así el portal no depende del CDN ese día */
const CDN = {
  'gsap.min.js': 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js',
  'ScrollTrigger.min.js': 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js',
  'lenis.min.js': 'https://cdn.jsdelivr.net/npm/@studio-freight/lenis@1.0.42/dist/lenis.min.js',
};
const CACHE = path.join(os.tmpdir(), 'neixon-cdn');   // la misma copia que usan las otras webs
fs.mkdirSync(CACHE, { recursive: true });
for (const [n, u] of Object.entries(CDN)) {
  const f = path.join(CACHE, n);
  if (!fs.existsSync(f)) fs.writeFileSync(f, Buffer.from(await (await fetch(u)).arrayBuffer()));
}
const RE_CDN = /(gsap\.min|ScrollTrigger\.min|lenis\.min)\.js$/;

async function nueva(op = {}, { cdn = 'local', script } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, ...op });
  if (cdn === 'local') await ctx.route(RE_CDN, (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(path.join(CACHE, r.request().url().split('/').pop())) }));
  if (cdn === 'caido') await ctx.route(RE_CDN, (r) => r.abort());
  // las letras de Google, fuera: las pruebas no dependen de la red
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  if (script) await ctx.addInitScript(script);
  const page = await ctx.newPage();
  page._errores = [];
  page.on('pageerror', (e) => page._errores.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') page._errores.push('consola: ' + m.text()); });
  page.on('response', (r) => { if (r.status() >= 400) page._errores.push(r.status() + ' ' + r.url()); });
  return { ctx, page };
}
// baja con la rueda hasta que la sección queda en su sitio y SE ASIENTA
// (Lenis sigue frenando después de la última rueda y puede pasarse)
async function bajarA(page, sel, margen = 0) {
  const top = () => page.evaluate((s) => document.querySelector(s).getBoundingClientRect().top, sel);
  for (let vuelta = 0; vuelta < 4; vuelta++) {
    for (let i = 0; i < 200; i++) {
      const t = await top();
      if (Math.abs(t - margen) < 30) break;
      await page.mouse.wheel(0, Math.max(-450, Math.min(450, t - margen)));
      await page.waitForTimeout(60);
    }
    await page.waitForTimeout(800);
    if (Math.abs((await top()) - margen) < 40) break;
  }
  await page.waitForTimeout(300);
}
async function bajarTodo(page) {
  for (let i = 0; i < 260; i++) {
    await page.mouse.wheel(0, 420);
    await page.waitForTimeout(50);
    if (await page.evaluate(() => innerHeight + scrollY >= document.documentElement.scrollHeight - 4)) break;
  }
  await page.waitForTimeout(900);
}
const esperarCortina = async (page, extra = 500) => {
  await page.waitForFunction(() => { const c = document.getElementById('cortina'); return !c || getComputedStyle(c).display === 'none'; }, null, { timeout: 12000 });
  await page.waitForTimeout(extra);
};

/* ================= 0. archivos ================= */
console.log('\n0. Archivos');
for (const f of fs.readdirSync(RAIZ).filter((f) => f.endsWith('.html') && !f.endsWith('.src.html'))) {
  const s = fs.readFileSync(path.join(RAIZ, f), 'utf8');
  comprobar(/<meta name="robots" content="noindex/.test(s), `${f}: noindex`);
  comprobar(!/<!--svg:/.test(s), `${f}: sin marcadores de construir.mjs sin expandir`);
  const ids = [...s.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  const rep = ids.filter((x, i) => ids.indexOf(x) !== i);
  comprobar(rep.length === 0, `${f}: ningún id repetido`, [...new Set(rep)].slice(0, 8));
}
comprobar(['.nojekyll', '404.html', 'manifest.json', 'img/og.jpg', 'marca/favicon.svg', 'marca/favicon-32.png', 'marca/apple-touch-icon.png'].every((f) => fs.existsSync(path.join(RAIZ, f))), '.nojekyll, 404, manifest, og:image y favicons');
{
  const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
  const rutas = new Set();
  for (const m of html.matchAll(/(src|srcset|href|imagesrcset)="([^"]+)"/g)) for (const parte of (/srcset/.test(m[1]) ? m[2].split(',') : [m[2]])) {
    const r = parte.trim().split(/\s+/)[0].split('?')[0];
    if (r && !/^(https?:|mailto:|tel:|#|data:)/.test(r)) rutas.add(r);
  }
  const faltan = [...rutas].filter((r) => !fs.existsSync(path.join(RAIZ, r)));
  comprobar(faltan.length === 0, `index.html: existen los ${rutas.size} archivos que enlaza`, faltan);
  comprobar(/rel="preload" as="image"[^>]*hero-atardecer-800\.avif/.test(html.replace(/\n\s*/g, ' ')), 'la foto LCP (hero) va precargada');
  // reseñas: nunca el recuento cuando hay pocas, nunca prueba social inventada (reglas de Álvaro)
  const texto = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ');
  comprobar(!/\b(1|una)( sola| única)? reseña|la (primera|segunda) reseña/i.test(texto), 'sin «una reseña» ni ordinales de reseñas');
  comprobar(!/clientes satisfechos|cientos de|miles de/i.test(texto), 'sin prueba social en plural inventada');
  comprobar(!/sin permanencia|sin cuotas|la web es tuya/i.test(texto), 'sin condiciones comerciales de taller web');
  // las fotos: todas con alt (las decorativas llevan alt="")
  comprobar([...html.matchAll(/<img\b[^>]*>/g)].every((m) => /\salt="/.test(m[0])), 'todas las imágenes llevan alt');
}
const css = fs.readFileSync(path.join(RAIZ, 'css/estilos.css'), 'utf8');
comprobar(/\.cookies:not\(\[hidden\]\)\s*\{\s*display:\s*flex/.test(css) && !/\.cookies\s*\{[^}]*display:\s*flex/.test(css), 'cookies: display:flex solo en :not([hidden])');
comprobar(/\.cortina\[hidden\]/.test(css), 'cortina: regla [hidden] propia (es display:grid)');
comprobar(!/scroll-behavior:\s*smooth/.test(css.replace(/\/\*[\s\S]*?\*\//g, '')), 'sin scroll-behavior:smooth (pelearía con Lenis)');
comprobar(/height:\s*100dvh/.test(css.match(/\.menu-movil \{[^}]*\}/)?.[0] || ''), 'menú móvil con altura explícita 100dvh');
comprobar(!/cursor:\s*none/.test(css), 'sin cursor propio (no hay dos cursores)');
{
  const src = fs.readFileSync(path.join(RAIZ, 'index.src.html'), 'utf8');
  const js = fs.readFileSync(path.join(RAIZ, 'js/main.js'), 'utf8');
  comprobar(/MANDO DE MAQUETA \(solo con \?revision; no viaja al cliente\)/.test(src) && /fin del MANDO DE MAQUETA/.test(src) && /16\. MANDO DE MAQUETA/.test(js) && /fin del MANDO DE MAQUETA/.test(js), 'receta de borrado del mando: marcas en index.src.html y main.js');
  comprobar(/cdn\.jsdelivr\.net\/npm\/@studio-freight\/lenis@1\.0\.42/.test(src), 'Lenis desde jsDelivr con versión fija (cdnjs da 404)');
}

/* ================= 1. el portal ================= */
console.log('\n1. Portal');
{
  // fotogramas a medias: se registra en la propia página (Playwright llega tarde)
  const { ctx, page } = await nueva({}, { script: () => {
    window.__muestras = [];
    const t0 = performance.now();
    const tick = () => {
      const c = document.getElementById('cortina');
      if (c) {
        const h = document.getElementById('cortina-m-hueco');
        const tr = h ? (h.getAttribute('transform') || '') : '';
        const m = /scale\(([\d.eE+-]+)\)/.exec(tr);
        const g = document.getElementById('cortina-garita');
        const img = document.getElementById('mirador-img');
        window.__muestras.push({ t: performance.now() - t0, vis: getComputedStyle(c).display !== 'none',
          escala: m ? +m[1] : 0, garitaOp: g ? +getComputedStyle(g).opacity : 1,
          masc: c.classList.contains('es-mascara'), fondo: getComputedStyle(c).backgroundColor,
          img: !!(img && img.complete && img.naturalWidth > 0),
          textoOp: +getComputedStyle(document.getElementById('cortina-texto')).opacity });
        if (getComputedStyle(c).display !== 'none') requestAnimationFrame(tick);
      }
    };
    requestAnimationFrame(tick);
  } });
  await page.goto(BASE);
  await esperarCortina(page);
  const m = await page.evaluate(() => window.__muestras);
  comprobar(m.length > 20 && m[0].vis, 'el portal tapa al cargar', m.length);
  const conMasc = m.filter((x) => x.masc);
  comprobar(conMasc.length > 10, 'pasa a máscara (la garita es una ventana)', conMasc.length);
  comprobar(conMasc.every((x) => x.fondo === 'rgba(0, 0, 0, 0)'), 'con máscara, la capa no tiene fondo opaco propio');
  comprobar(conMasc.length > 0 && conMasc[0].img, 'al abrirse la ventana, la foto del hero ya está cargada (el primer fotograma tiene imagen)');
  const e0 = conMasc[0]?.escala || 0, e1 = Math.max(...conMasc.map((x) => x.escala));
  comprobar(e1 > e0 * 8, 'la ventana crece al menos 8 veces', [e0, e1]);
  comprobar(m.some((x) => x.garitaOp < 0.6 && x.escala < e0 * 1.5), 'la garita se aclara antes de crecer (la vista queda dentro de su silueta)');
  comprobar(m.some((x) => x.textoOp > 0.9) && m.some((x) => x.textoOp < 0.1), 'el rótulo se ve y se va');
  const dur = m[m.length - 1].t;
  comprobar(dur > 2000 && dur < 6200, 'el portal dura entre 2 y 6,2 s', Math.round(dur));
  comprobar(await page.evaluate(() => getComputedStyle(document.getElementById('cortina')).display === 'none' && document.documentElement.classList.contains('cortina-fuera')), 'el portal desaparece de verdad (display:none)');
  comprobar(await page.evaluate(() => !document.getElementById('cookies').hidden), 'el aviso de cookies sale al irse el portal');
  await cap(page, '01-hero-1440');
  comprobar(page._errores.length === 0, 'sin errores de consola ni 404 (escritorio)', page._errores);
  await ctx.close();
}
{
  const { ctx, page } = await nueva({ reducedMotion: 'reduce' }, { script: sinCookies });
  await page.goto(BASE);
  await page.waitForTimeout(300);
  comprobar(await page.evaluate(() => getComputedStyle(document.getElementById('cortina')).display === 'none'), 'movimiento reducido: el portal no se ve ni un fotograma');
  comprobar(await page.evaluate(() => !document.documentElement.classList.contains('con-movimiento')), 'movimiento reducido: sin «con-movimiento»');
  await bajarA(page, '#habitaciones');
  comprobar(await page.evaluate(() => +getComputedStyle(document.querySelector('#habs-tit')).opacity === 1 && +getComputedStyle(document.querySelector('.hab__foto')).opacity === 1), 'movimiento reducido: titulares y fotos visibles');
  comprobar(await page.evaluate(() => getComputedStyle(document.getElementById('pie-agua')).display === 'none' && getComputedStyle(document.getElementById('pie-garita')).color !== 'rgba(155, 192, 168, 0.2)'), 'movimiento reducido: la garita del pie se ve entera, sin marea');
  comprobar(await page.evaluate(() => getComputedStyle(document.getElementById('pano')).overflowX === 'auto'), 'movimiento reducido: la panorámica se recorre a mano (overflow-x:auto)');
  await ctx.close();
}
{
  const { ctx, page } = await nueva({}, { cdn: 'caido', script: sinCookies });
  await page.goto(BASE);
  await page.waitForTimeout(3600);
  comprobar(await page.evaluate(() => getComputedStyle(document.getElementById('cortina')).visibility === 'hidden' || getComputedStyle(document.getElementById('cortina')).display === 'none'), 'sin CDN: el portal se va solo por CSS');
  comprobar(await page.evaluate(() => { const h = document.querySelector('.hero__tit'); return getComputedStyle(h).opacity === '1' && !h.classList.contains('es-partido'); }), 'sin CDN: el titular del hero se ve entero');
  comprobar(await page.evaluate(() => Array.from(document.querySelectorAll('[data-partir]')).every((h) => !h.classList.contains('es-partido'))), 'sin CDN: ningún titular partido (se quedarían ocultos)');
  comprobar(await page.evaluate(() => Array.from(document.querySelectorAll('[data-revela]')).every((e) => +getComputedStyle(e).opacity === 1)), 'sin CDN: ninguna foto ni tarjeta escondida');
  await ctx.close();
}
{
  // CDN lento (> 2,5 s): no se anima y se retira enseguida
  const { ctx, page } = await nueva({}, { cdn: 'nada', script: sinCookies });
  await ctx.route(RE_CDN, async (r) => { await espera(3000); await r.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(path.join(CACHE, r.request().url().split('/').pop())) }); });
  await page.goto(BASE);
  await page.waitForTimeout(4200);
  comprobar(await page.evaluate(() => { const c = document.getElementById('cortina'); return getComputedStyle(c).display === 'none' || getComputedStyle(c).visibility === 'hidden'; }), 'CDN lento: el portal no se queda puesto');
  await ctx.close();
}
{
  const { ctx, page } = await nueva({ javaScriptEnabled: false });
  await page.goto(BASE);
  await page.waitForTimeout(400);
  comprobar(await page.evaluate(() => getComputedStyle(document.getElementById('cortina')).display === 'none'), 'sin JS: no hay portal');
  comprobar(await page.evaluate(() => +getComputedStyle(document.querySelector('.hero__tit')).opacity === 1 && +getComputedStyle(document.querySelector('.hab__foto')).opacity === 1), 'sin JS: el contenido se ve');
  await ctx.close();
}

/* ================= 2. el mirador y el sol ================= */
console.log('\n2. Mirador del hero y sol de hoy');
{
  const { ctx, page } = await nueva({}, { script: sinCookies });
  await page.goto(BASE);
  await esperarCortina(page, 2600);
  const g = await page.evaluate(() => {
    const h = document.querySelector('.hero').getBoundingClientRect();
    const i = document.getElementById('mirador-img').getBoundingClientRect();
    const m = window.__mirador;
    return { hero: h.height, imgH: i.height, imgW: i.width, vw: innerWidth, rango: m.rango, x: m.x, ta: getComputedStyle(document.getElementById('mirador')).touchAction };
  });
  comprobar(Math.abs(g.imgH - g.hero) < 2 && g.imgW >= g.vw, 'la foto del hero llena el hero a lo alto y no deja huecos a los lados', g);
  comprobar(g.rango > 40 && g.x <= 0 && g.x >= -g.rango, 'hay rango para mirar alrededor y la vista empieza dentro', g);
  comprobar(g.ta === 'pan-y', 'touch-action: pan-y (el scroll vertical sigue funcionando)');
  comprobar(await page.evaluate(() => !document.getElementById('mirador-mando').hidden), 'los botones del mirador se ven cuando hay algo que mirar');
  // los botones
  const x0 = await page.evaluate(() => window.__mirador.x);
  await page.click('#mirador-izq');
  await page.waitForTimeout(1000);
  const x1 = await page.evaluate(() => window.__mirador.x);
  comprobar(x1 > x0 - 0.5 && x1 !== x0 || x0 === 0, 'flecha izquierda: la vista se desplaza', [x0, x1]);
  await page.click('#mirador-der');
  await page.waitForTimeout(1000);
  const x2 = await page.evaluate(() => window.__mirador.x);
  comprobar(x2 < x1, 'flecha derecha: la vista vuelve', [x1, x2]);
  // teclado
  await page.focus('#mirador');
  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(1000);
  comprobar(await page.evaluate(() => window.__mirador.x) > x2, 'teclado (←) con el mirador enfocado');
  // arrastre con el ratón
  const antes = await page.evaluate(() => window.__mirador.x);
  await page.mouse.move(900, 300);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) { await page.mouse.move(900 - i * 18, 300); await page.waitForTimeout(16); }
  await page.mouse.up();
  await page.waitForTimeout(1300);
  const despues = await page.evaluate(() => window.__mirador.x);
  comprobar(despues < antes, 'arrastrar a la izquierda mueve la vista a la derecha', [antes, despues]);
  comprobar(despues >= -(await page.evaluate(() => window.__mirador.rango)) - 0.5 && despues <= 0.5, 'tras la inercia la vista queda dentro de los límites', despues);
  // el sol de hoy (calculado)
  const txt = await page.evaluate(() => document.getElementById('sol-vivo-txt').textContent);
  comprobar(/^Hoy el sol (se pone en Cangas a las \d\d:\d\d · faltan|se puso a las \d\d:\d\d · mañana, a las)/.test(txt), 'dato en vivo: la puesta de sol de hoy en Cangas', txt);
  const sol = await page.evaluate(() => {
    const S = window.__sol;
    const hm = (y, m, d) => S.hm(S.dia(y, m, d).pone);
    return { jun: hm(2026, 6, 21), dic: hm(2026, 12, 21), mar: hm(2026, 3, 20), ac: Math.round(S.dia(2026, 12, 21).acimut) };
  });
  const mins = (s) => +s.slice(0, 2) * 60 + +s.slice(3);
  comprobar(Math.abs(mins(sol.jun) - mins('22:14')) <= 4, 'cálculo del sol: 21 de junio, puesta hacia las 22:14 (ω0 = 114,5°)', sol);
  comprobar(Math.abs(mins(sol.dic) - mins('18:06')) <= 5, 'cálculo del sol: 21 de diciembre, puesta hacia las 18:06 (ω0 = 68,1°)', sol);
  comprobar(sol.ac > 235 && sol.ac < 245, 'acimut de la puesta en diciembre (~240°)', sol);
  await cap(page, '02-mirador');
  await ctx.close();
}

/* ================= 2b. la panorámica ================= */
console.log('\n2b. Panorámica (scroll + arrastre)');
for (const movil of [false, true]) {
  const { ctx, page } = await nueva(movil ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}, { script: sinCookies });
  await page.goto(BASE);
  await esperarCortina(page);
  const tx = () => page.evaluate(() => { const m = /translate3d\((-?[\d.]+)px/.exec(document.getElementById('pano-riel').style.transform || ''); return m ? +m[1] : 0; });
  const et = movil ? 'móvil' : 'escritorio';
  const t0 = await tx();
  await bajarA(page, '#pano', 300);
  const t1 = await tx();
  comprobar(t1 < t0 - 20, `${et}: el scroll recorre la panorámica`, [t0, t1]);
  const r = await page.evaluate(() => { const b = document.getElementById('pano').getBoundingClientRect(); return { y: b.top + b.height / 2, w: innerWidth }; });
  if (movil) {
    const cdp = await ctx.newCDPSession(page);
    const toque = (t, x, y) => cdp.send('Input.dispatchTouchEvent', { type: t, touchPoints: t === 'touchEnd' ? [] : [{ x, y }] });
    await toque('touchStart', 120, r.y);
    for (let i = 1; i <= 10; i++) { await toque('touchMove', 120 + i * 14, r.y); await page.waitForTimeout(16); }
    await toque('touchEnd', 0, 0);
  } else {
    await page.mouse.move(400, r.y); await page.mouse.down();
    for (let i = 1; i <= 10; i++) { await page.mouse.move(400 + i * 20, r.y); await page.waitForTimeout(16); }
    await page.mouse.up();
  }
  await page.waitForTimeout(1200);
  const t2 = await tx();
  comprobar(t2 > t1 + 20 || t2 === 0, `${et}: arrastrar a la derecha desplaza la foto (se ve lo de la izquierda)`, [t1, t2]);
  const rango = await page.evaluate(() => document.getElementById('pano-riel').offsetWidth - document.getElementById('pano').clientWidth);
  comprobar(t2 <= 0.5 && t2 >= -rango - 0.5, `${et}: la foto no se sale de sus límites`, [t2, rango]);
  await ctx.close();
}

/* ================= 3. habitaciones ================= */
console.log('\n3. Habitaciones');
{
  const { ctx, page } = await nueva({}, { script: sinCookies });
  await page.goto(BASE);
  await esperarCortina(page);
  const hab = await page.evaluate(() => Array.from(document.querySelectorAll('.hab')).map((h) => ({ id: h.id, nom: h.querySelector('.hab__nom').textContent, precio: (h.querySelector('.hab__precio b') || {}).textContent, fotos: h.querySelectorAll('.hab__foto img').length })));
  comprobar(hab.length === 6 && hab.every((h) => /^\d\d\s€$/.test(h.precio.replace('\u00a0', ' ')) && h.fotos === 2), 'las 6 habitaciones llevan nombre, precio «desde» y dos fotos', hab);
  comprobar(await page.evaluate(() => Array.from(document.querySelectorAll('.habs__indice a')).every((a) => document.querySelector(a.getAttribute('href')))), 'todos los enlaces del índice llevan a una habitación');
  await bajarA(page, '#habitaciones');
  await page.click('.habs__indice a[href="#hab-morrazo"]');
  await page.waitForTimeout(2000);
  comprobar(await page.evaluate(() => { const t = document.getElementById('hab-morrazo').getBoundingClientRect().top; return t > -40 && t < 220; }), 'el índice lleva a Morrazo');
  await page.click('#hab-cangas .btn');
  await page.waitForTimeout(2200);
  comprobar(await page.evaluate(() => document.getElementById('c-hab').value === 'cangas'), '«Consultar esta» elige Cangas en el formulario');
  comprobar(await page.evaluate(() => Math.abs(document.getElementById('consulta').getBoundingClientRect().top) < 80), '… y lleva a la consulta');
  // que ninguna foto pequeña se amplíe demasiado: el ancho mostrado frente al de origen
  await page.evaluate(() => window.scrollTo(0, 0));
  const fotos = JSON.parse(fs.readFileSync(path.join(RAIZ, 'img/fotos/fotos.json'), 'utf8'));
  const amp = await page.evaluate(() => Array.from(document.querySelectorAll('img[data-foto]')).map((i) => ({ n: i.closest('picture').dataset.foto, w: Math.round(i.getBoundingClientRect().width) || Math.round(i.parentElement.getBoundingClientRect().width), vh: i.closest('.mirador') ? 1 : 0 })));
  const por = new Map(fotos.map((f) => [f.nombre, f.ancho_origen]));
  const blandas = amp.filter((a) => a.w && por.get(a.n) && a.w > por.get(a.n) * 1.1 && !a.vh).map((a) => `${a.n}: se muestra a ${a.w}px, origen ${por.get(a.n)}px`);
  comprobar(blandas.length === 0, 'ninguna foto se muestra por encima de su resolución original (a 1440 de ancho)', blandas);
  await ctx.close();
}

/* ================= 4. consulta ================= */
console.log('\n4. Consulta');
{
  const { ctx, page } = await nueva({}, { script: () => { try { localStorage.setItem('lagarita-cookies', 'si'); } catch (e) {} window.open = (u) => { window.__abierto = u; return null; }; } });
  await page.goto(BASE);
  await esperarCortina(page);
  await bajarA(page, '#consulta');
  await page.click('button[data-via="whatsapp"]');
  await page.waitForTimeout(200);
  const err = await page.evaluate(() => ({ vis: !document.getElementById('form-error').hidden, txt: document.getElementById('form-error').textContent, foco: document.activeElement.id }));
  comprobar(err.vis && /llegada/.test(err.txt) && err.foco === 'c-entrada', 'sin datos: error visible y foco en el primer campo', err);
  const d = new Date(Date.now() + 20 * 864e5); const iso = d.toISOString().slice(0, 10);
  await page.fill('#c-entrada', iso);
  await page.dispatchEvent('#c-entrada', 'change');
  comprobar(await page.evaluate(() => document.getElementById('c-salida').value > document.getElementById('c-entrada').value), 'al poner la llegada, la salida pasa al día siguiente');
  await page.fill('#c-nombre', 'Prueba');
  await page.selectOption('#c-hab', 'marina');
  await page.click('button[data-via="whatsapp"]');
  await page.waitForTimeout(200);
  const url = await page.evaluate(() => window.__abierto || '');
  const txt = decodeURIComponent(url.split('text=')[1] || '');
  comprobar(url.startsWith('https://wa.me/34617633166?text='), 'WhatsApp al 617 633 166', url.slice(0, 40));
  comprobar(/Llegada: \d\d\/\d\d\/\d{4}/.test(txt) && /1 noche/.test(txt) && /Mariña/.test(txt) && /Prueba/.test(txt) && /Casa Rural La Garita/.test(txt), 'el mensaje lleva fechas, noches, alojamiento y nombre', txt);
  const tam = await page.evaluate(() => Array.from(document.querySelectorAll('.campo input, .campo select, .campo textarea')).map((c) => parseFloat(getComputedStyle(c).fontSize)));
  comprobar(tam.every((t) => t >= 16), 'ningún campo baja de 16 px (iOS no hace zoom)', tam);
  await ctx.close();
}

/* ================= 5. cabecera, cookies, pie ================= */
console.log('\n5. Cabecera, cookies y pie (la marea)');
{
  const { ctx, page } = await nueva();
  await page.goto(BASE);
  await esperarCortina(page);
  comprobar(await page.evaluate(() => getComputedStyle(document.getElementById('cookies')).display === 'flex'), 'cookies visibles en la primera visita');
  await page.click('#ck-si');
  comprobar(await page.evaluate(() => getComputedStyle(document.getElementById('cookies')).display === 'none' && localStorage.getItem('lagarita-cookies') === 'si'), 'aceptar oculta el aviso y lo recuerda');
  comprobar(await page.evaluate(() => document.querySelector('.saltar').getBoundingClientRect().bottom <= 0), '«Saltar al contenido» fuera de la vista hasta que se enfoca');
  comprobar(await page.evaluate(() => document.getElementById('mando').hidden && getComputedStyle(document.getElementById('mando')).display === 'none'), 'sin ?revision el mando no está');
  comprobar(await page.evaluate(() => getComputedStyle(document.body).cursor !== 'none'), 'el cursor del sistema sigue visible');
  await page.mouse.move(720, 450);
  await bajarA(page, '#fuera', 0);
  comprobar(await page.evaluate(() => /es-oscura/.test(document.getElementById('cab').className)), 'la cabecera se vuelve noche sobre «Fuera»', await page.evaluate(() => document.getElementById('cab').className));
  await bajarA(page, '#habitaciones', 0);
  comprobar(await page.evaluate(() => !document.getElementById('cab').classList.contains('es-oscura') && document.getElementById('cab').classList.contains('sc')), 'y vuelve a espuma sobre las habitaciones');
  // la marea: a medio camino la ola está a medias; al final, llena
  await bajarA(page, '#pie', 300);
  const medio = await page.evaluate(() => { const o = document.getElementById('pie-ola'); return { y: +(gsap.getProperty(o, 'y')), btn: +getComputedStyle(document.getElementById('pie-cierre')).opacity }; });
  await bajarTodo(page);
  await page.waitForTimeout(1200);
  const fin = await page.evaluate(() => { const o = document.getElementById('pie-ola'); return { y: +(gsap.getProperty(o, 'y')), btn: +getComputedStyle(document.getElementById('pie-cierre')).opacity, rec: document.getElementById('pie-recorte-p').getAttribute('d') === document.querySelector('#pie-garita path').getAttribute('d') }; });
  comprobar(medio.y > fin.y + 20, 'la marea sube con el scroll (más baja a medio camino que al final)', [medio.y, fin.y]);
  comprobar(fin.y < 10 && fin.btn > 0.95, 'al final del todo la garita está llena y el botón puesto', fin);
  comprobar(fin.rec, 'la marea se recorta con la silueta exacta de la garita');
  await cap(page, '03-pie');
  comprobar(await page.evaluate(() => !document.querySelector('#mapa iframe')), 'sin iframe de Google hasta pulsar «Ver el mapa»');
  comprobar(page._errores.filter((e) => !/google/.test(e)).length === 0, 'sin errores al recorrer la página', page._errores);
  await ctx.close();
}

/* ================= 6. lámina de la ría ================= */
console.log('\n6. Lámina de la ría');
{
  const hayDatos = fs.existsSync(path.join(RAIZ, 'js/ria.js')) && fs.existsSync(path.join(RAIZ, 'js/mapa.js'));
  comprobar(hayDatos, 'existen js/ria.js (datos de OSM) y js/mapa.js');
  if (hayDatos) {
    const { ctx, page } = await nueva({}, { script: sinCookies });
    await page.goto(BASE);
    await esperarCortina(page);
    await bajarA(page, '#entorno', 0);
    await page.waitForTimeout(3600);
    const r = await page.evaluate(() => {
      const c = document.getElementById('lamina-lienzo');
      const x = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      const f = [x[0], x[1], x[2]];
      let dist = 0;
      for (let i = 0; i < x.length; i += 16) if (Math.abs(x[i] - f[0]) + Math.abs(x[i + 1] - f[1]) + Math.abs(x[i + 2] - f[2]) > 30) dist++;
      const ch = c.__chapas || [];
      let pisan = 0;
      for (let i = 0; i < ch.length; i++) for (let j = i + 1; j < ch.length; j++) { const a = ch[i], b = ch[j]; if (!(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y)) pisan++; }
      return { pct: dist / (x.length / 16), chapas: ch.length, pisan, lista: document.querySelectorAll('#lugares-lista .lugar').length, lugares: window.__lamina ? window.__lamina.lugares.length : 0 };
    });
    comprobar(r.pct > 0.03, 'la lámina dibuja (píxeles que se salen del fondo)', r.pct);
    comprobar(r.lista > 4 && r.lista === r.lugares, 'la lista tiene un lugar por cada punto del mapa', r);
    comprobar(r.pisan === 0, 'las etiquetas del mapa no se pisan', r.pisan);
    await cap(page, '04-lamina');
    await ctx.close();
  }
}

/* ================= 7. móvil ================= */
console.log('\n7. Móvil');
for (const [w, h] of [[360, 640], [375, 667], [390, 844], [768, 1024]]) {
  const { ctx, page } = await nueva({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, { script: sinCookies });
  await page.goto(BASE);
  await esperarCortina(page, 2400);
  const m = await page.evaluate(() => {
    const env = document.querySelector('.hero__env').getBoundingClientRect();
    const pie = document.querySelector('.hero__pie').getBoundingClientRect();
    const cab = document.getElementById('cab').getBoundingClientRect();
    const tit = document.querySelector('.hero__tit').getBoundingClientRect();
    const acc = document.querySelector('.hero__acc').getBoundingClientRect();
    return { solape: env.bottom > pie.top + 2, bajoCab: tit.top >= cab.bottom - 2, accVisible: acc.bottom <= innerHeight, desborde: document.documentElement.scrollWidth - innerWidth };
  });
  comprobar(!m.solape, `${w}×${h}: el texto del hero no pisa la franja de abajo`, m);
  comprobar(m.bajoCab, `${w}×${h}: el titular queda bajo la cabecera`, m);
  comprobar(m.accVisible, `${w}×${h}: los botones del hero caben en la primera pantalla`, m);
  comprobar(m.desborde <= 0, `${w}×${h}: sin scroll horizontal`, m.desborde);
  if (w === 390) {
    await cap(page, '05-hero-390');
    // el gesto táctil del hero: un arrastre horizontal con el dedo mueve la vista (CDP, toque de verdad)
    const cdp = await ctx.newCDPSession(page);
    const antes = await page.evaluate(() => window.__mirador.x);
    const toque = async (t, x, y) => cdp.send('Input.dispatchTouchEvent', { type: t, touchPoints: t === 'touchEnd' ? [] : [{ x, y }] });
    await toque('touchStart', 300, 300);
    for (let i = 1; i <= 10; i++) { await toque('touchMove', 300 - i * 12, 300); await page.waitForTimeout(16); }
    await toque('touchEnd', 0, 0);
    await page.waitForTimeout(1400);
    const despues = await page.evaluate(() => window.__mirador.x);
    comprobar(despues < antes, 'móvil: arrastrar con el dedo en horizontal mueve la vista del hero', [antes, despues]);
    // un gesto vertical NO lo mueve (sigue siendo scroll de página)
    const y0 = await page.evaluate(() => scrollY), x0 = await page.evaluate(() => window.__mirador.x);
    await toque('touchStart', 200, 500);
    for (let i = 1; i <= 10; i++) { await toque('touchMove', 200, 500 - i * 25); await page.waitForTimeout(16); }
    await toque('touchEnd', 0, 0);
    await page.waitForTimeout(900);
    comprobar(await page.evaluate(() => window.__mirador.x) === x0, 'móvil: un arrastre vertical no mueve la vista (es scroll)', x0);
    // menú
    await page.tap('#menu-btn');
    await page.waitForTimeout(500);
    const menu = await page.evaluate(() => { const r = document.getElementById('menu-movil').getBoundingClientRect(); return { h: r.height, ih: innerHeight, vis: getComputedStyle(document.getElementById('menu-movil')).visibility }; });
    comprobar(menu.vis === 'visible' && Math.abs(menu.h - menu.ih) < 2, 'menú móvil a pantalla completa', menu);
    await page.tap('#menu-movil a[href="#habitaciones"]');
    await page.waitForTimeout(1600);
    comprobar(await page.evaluate(() => !document.body.classList.contains('menu') && Math.abs(document.getElementById('habitaciones').getBoundingClientRect().top) < 120), 'un enlace del menú lo cierra y lleva a su sección');
    comprobar(await page.evaluate(() => document.getElementById('barra').classList.contains('es-visible')), 'la barra de «Consultar» aparece al dejar el hero');
    // la barra del navegador no rehace nada: 0 refresh de ScrollTrigger
    await page.evaluate(() => { window.__refrescos = 0; ScrollTrigger.addEventListener('refresh', () => window.__refrescos++); });
    const top0 = await page.evaluate(() => Math.round(document.getElementById('hab-solano').getBoundingClientRect().top + scrollY));
    for (let i = 0; i < 6; i++) { await page.setViewportSize({ width: 390, height: i % 2 ? 844 : 900 }); await page.waitForTimeout(260); }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(400);
    comprobar(await page.evaluate(() => window.__refrescos) === 0, 'la barra del móvil sube y baja: 0 refresh', await page.evaluate(() => window.__refrescos));
    comprobar(Math.abs(top0 - await page.evaluate(() => Math.round(document.getElementById('hab-solano').getBoundingClientRect().top + scrollY))) <= 1, 'la barra del móvil no mueve nada de sitio', top0);
    await bajarA(page, '#pie', 300).catch(() => {});
    await cap(page, '06-pie-390');
  }
  await ctx.close();
}

/* ================= 8. versión «Sobria» (?revision) ================= */
console.log('\n8. Densidades');
{
  const { ctx, page } = await nueva({}, { script: sinCookies });
  await page.goto(BASE + '?revision');
  await esperarCortina(page);
  comprobar(await page.evaluate(() => !document.getElementById('mando').hidden), 'con ?revision se ve el mando');
  const radio = () => page.evaluate(() => ({ arco: getComputedStyle(document.querySelector('.hab__foto--arco')).borderTopLeftRadius, hil: document.querySelector('.hilera').offsetHeight }));
  const c0 = await radio();
  await page.click('#mando button[data-densidad="sobria"]');
  await page.waitForTimeout(400);
  const s = await page.evaluate(() => ({
    tabla: getComputedStyle(document.getElementById('tabla-habs')).display,
    galeria: getComputedStyle(document.getElementById('galeria')).display,
    url: location.search,
  }));
  const c1 = await radio();
  comprobar(s.tabla === 'block' && s.galeria === 'block', '«Sobria» añade la tabla de las seis y la galería', s);
  comprobar(c0.arco !== c1.arco && c1.arco === '6px', '«Sobria»: las fotos con arco pasan a rectas', [c0, c1]);
  comprobar(c0.hil > 20 && c1.hil <= 2, '«Sobria»: las hileras de piedra pasan a una línea', [c0, c1]);
  comprobar(/densidad=sobria/.test(s.url), 'la URL recuerda la densidad (sin guardar nada)', s.url);
  await ctx.close();
}

/* ================= 9. teclado y foco ================= */
console.log('\n9. Foco');
{
  const { ctx, page } = await nueva({}, { script: sinCookies });
  await page.goto(BASE);
  await esperarCortina(page, 2200);
  for (let i = 0; i < 4; i++) await page.keyboard.press('Tab');
  const foco = await page.evaluate(() => { const e = document.activeElement; const s = getComputedStyle(e); return { tag: e.tagName, out: s.outlineStyle, ancho: s.outlineWidth, radio: s.borderTopLeftRadius }; });
  comprobar(foco.out === 'solid' && parseFloat(foco.ancho) >= 2, 'el foco del teclado se ve (contorno sólido de 2 px)', foco);
  await ctx.close();
}

/* ================= 10. contraste ================= */
console.log('\n10. Contraste');
{
  const lum = (hex) => { const c = hex.match(/\w\w/g).map((x) => parseInt(x, 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const v = (n) => (css.match(new RegExp(`--${n}:\\s*(#[0-9a-f]{6})`, 'i')) || [])[1];
  for (const [t, f, min] of [
    ['tinta', 'espuma', 7], ['tinta-2', 'espuma', 4.5], ['tinta-2', 'arena', 4.5], ['bosque', 'espuma', 7], ['bosque', 'arena', 7], ['almagre', 'espuma', 4.5],
    ['espuma', 'bosque', 7], ['espuma-2', 'bosque', 4.5], ['espuma-3', 'bosque', 4.5], ['espuma-2', 'noche', 7], ['espuma-3', 'noche', 4.5], ['espuma-3', 'bosque-2', 4.5],
    ['lima', 'bosque', 4.5], ['lima', 'noche', 4.5], ['bosque', 'lima', 4.5], ['garita-claro', 'noche', 4.5], ['tinta', 'lima', 4.5], ['espuma', 'noche', 7],
  ]) {
    const r = ratio(v(t), v(f));
    comprobar(r >= min, `${t} sobre ${f}: ${r.toFixed(2)}:1 (mín. ${min})`);
  }
}

await browser.close();
servidor.close();
console.log(`\n${nOk} bien, ${fallos.length} fallos`);
if (fallos.length) { console.log(fallos.map((f) => ' - ' + f).join('\n')); process.exit(1); }
