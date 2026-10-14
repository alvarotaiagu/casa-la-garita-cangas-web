/* Genera las páginas a partir de sus fuentes *.src.html:
   1. <img data-foto="nombre" ...> → <picture> con AVIF, WebP y JPG en todos los
      anchos de img/fotos/fotos.json (el <img> conserva sus demás atributos).
   2. <!--svg:ruta/archivo.svg atributos--> → el SVG en línea, con los atributos
      añadidos a la etiqueta <svg> (sin la cabecera XML).
   3. Ejecuta versionar.mjs para poner ?v=<huella> a CSS y JS.
   Se edita SIEMPRE el *.src.html; el .html generado se sobrescribe. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const RAIZ = path.dirname(fileURLToPath(import.meta.url));
const FOTOS = new Map(JSON.parse(fs.readFileSync(path.join(RAIZ, 'img/fotos/fotos.json'), 'utf8')).map((f) => [f.nombre, f]));

function picture(atrs) {
  const nombre = /data-foto="([^"]+)"/.exec(atrs)[1];
  const f = FOTOS.get(nombre);
  if (!f) throw new Error('Foto desconocida: ' + nombre);
  const sizes = (/\bsizes="([^"]+)"/.exec(atrs) || [, '100vw'])[1];
  const set = (ext) => f.anchos.map((w) => `img/fotos/${nombre}-${w}.${ext} ${w}w`).join(', ');
  // el JPG por defecto: el ancho intermedio (o el único)
  const base = f.anchos.includes(800) ? 800 : f.anchos[f.anchos.length - 1];
  let resto = atrs.replace(/\s*data-foto="[^"]+"/, '').replace(/\s*\bsizes="[^"]+"/, '');
  if (!/\bloading=/.test(resto) && !/fetchpriority="high"/.test(resto)) resto += ' loading="lazy"';
  if (!/\bdecoding=/.test(resto)) resto += ' decoding="async"';
  return `<picture data-foto="${nombre}">`
    + `<source type="image/avif" srcset="${set('avif')}" sizes="${sizes}">`
    + `<source type="image/webp" srcset="${set('webp')}" sizes="${sizes}">`
    + `<img src="img/fotos/${nombre}-${base}.jpg" srcset="${set('jpg')}" sizes="${sizes}" width="${f.ancho}" height="${f.alto}"${resto}>`
    + `</picture>`;
}

function svgEnLinea(ruta, atrs) {
  let s = fs.readFileSync(path.join(RAIZ, ruta), 'utf8').replace(/<\?xml[^>]*>\s*/, '').replace(/<!--[\s\S]*?-->/g, '').trim();
  // el mismo SVG va varias veces en la página: fuera todos sus id (el JS usa
  // data-* y el orden de las piedras); el id lo pone quien lo incrusta
  s = s.replace(/\sid="[^"]*"/g, '');
  // quita role/aria del archivo: los decide quien lo incrusta
  s = s.replace(/<svg\b([^>]*)>/, (m, a) => '<svg' + a.replace(/\s(role|aria-label)="[^"]*"/g, '') + ' ' + atrs.trim() + '>');
  return s;
}

const fuentes = fs.readdirSync(RAIZ).filter((f) => f.endsWith('.src.html'));
for (const src of fuentes) {
  const antes = fs.readFileSync(path.join(RAIZ, src), 'utf8');
  let html = antes.replace(/<img\b([^>]*\bdata-foto="[^"]+"[^>]*)>/g, (m, a) => picture(a.replace(/\s*\/$/, '')));
  html = html.replace(/<!--svg:([^\s>]+)\s*([^>]*?)-->/g, (m, ruta, a) => svgEnLinea(ruta, a));
  const destino = src.replace('.src.html', '.html');
  fs.writeFileSync(path.join(RAIZ, destino), html);
  console.log(`${src} → ${destino} (${(html.length / 1024).toFixed(0)} KB)`);
}
execFileSync(process.execPath, [path.join(RAIZ, 'versionar.mjs')], { stdio: 'inherit' });
