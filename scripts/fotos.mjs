/* Prepara las fotos de la web desde las originales de casalagarita.com (ref/fotos-web)
   y, si las hay, las de su Instagram (ref/instagram).
   Uso: node scripts/fotos.mjs
   - Gradación común y sutil: algo menos de azul saturado y un punto cálido.
   - NUNCA amplía: los anchos se recortan al ancho original (muchas fotos de
     habitaciones solo tienen 800 px; se muestran pequeñas a propósito).
   - Escribe img/fotos/<nombre>-<ancho>.{avif,webp,jpg} e img/fotos/fotos.json. */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire('C:/Users/alvar/Desktop/WEBS NEGOCIOS/alvarotaiagu.github.io/');
const sharp = require('sharp');

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const WEB = path.join(RAIZ, 'ref/fotos-web');
const SALIDA = path.join(RAIZ, 'img/fotos');
fs.mkdirSync(SALIDA, { recursive: true });

// nombre, archivo (en ref/fotos-web o ruta relativa a ref/), opciones { sat, claro, recorte:{left,top,width,height} }
const FOTOS = JSON.parse(fs.readFileSync(path.join(RAIZ, 'scripts/fotos-lista.json'), 'utf8'));
const ANCHOS = [480, 800, 1200, 1600, 2200];

const salida = [];
for (const f of FOTOS) {
  const fuente = f.ruta ? path.join(RAIZ, 'ref', f.ruta) : path.join(WEB, f.archivo);
  if (!fs.existsSync(fuente)) throw new Error(`Falta ${fuente} (${f.nombre})`);
  let base = sharp(fuente).rotate();
  if (f.recorte) base = base.extract(f.recorte);
  const buf = await base.toBuffer();
  const meta = await sharp(buf).metadata();
  const anchos = ANCHOS.filter((w) => w < meta.width - 30);
  anchos.push(meta.width > 2200 ? 2200 : meta.width);
  const unicos = [...new Set(anchos)].filter((w) => w >= 400 || w === meta.width);
  for (const w of unicos) {
    let p = sharp(buf).resize({ width: w, withoutEnlargement: true, kernel: 'lanczos3' })
      .modulate({ saturation: f.sat ?? 0.93, brightness: f.claro ?? 1.0 })
      .linear(1.02, -2);
    if (meta.width <= 900) p = p.sharpen({ sigma: 0.5, m1: 0.6, m2: 1.2 });
    const dst = path.join(SALIDA, `${f.nombre}-${w}`);
    await p.clone().avif({ quality: 52, effort: 4 }).toFile(dst + '.avif');
    await p.clone().webp({ quality: 74 }).toFile(dst + '.webp');
    await p.clone().jpeg({ quality: 78, mozjpeg: true }).toFile(dst + '.jpg');
  }
  const m2 = meta;
  const alto = Math.round(m2.height * (unicos[unicos.length - 1] / m2.width));
  salida.push({ nombre: f.nombre, anchos: unicos, ancho: unicos[unicos.length - 1], alto, origen: f.archivo || f.ruta, ancho_origen: meta.width, alto_origen: meta.height });
  console.log(f.nombre.padEnd(22), unicos.join(','), `${meta.width}x${meta.height}`);
}
fs.writeFileSync(path.join(SALIDA, 'fotos.json'), JSON.stringify(salida, null, 1));
console.log(salida.length + ' fotos');
