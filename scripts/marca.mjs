/* Deja los iconos y la imagen para compartir a partir de marca/*.svg (el calco del logo).
   Uso: node scripts/marca.mjs  → marca/favicon.svg, favicon-32.png, apple-touch-icon.png y img/og.jpg */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire('C:/Users/alvar/Desktop/WEBS NEGOCIOS/alvarotaiagu.github.io/');
const sharp = require('sharp');
const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r) => fs.readFileSync(path.join(RAIZ, r), 'utf8');

const BOSQUE = '#11462B', CLARO = '#9bc0a8', LIMA = '#96C22B', ESPUMA = '#f1f3ec';
const garita = leer('marca/garita.svg');
const d = /<path[^>]*\sd="([^"]+)"/.exec(garita)[1];
const vb = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(garita);
const gw = +vb[1], gh = +vb[2];

// favicon: la garita en lima sobre un cuadrado de bosque con esquinas redondas
function icono(lado, margen) {
  const s = (lado * (1 - 2 * margen)) / gw;
  const x = (lado - gw * s) / 2, y = (lado - gh * s) / 2 - lado * 0.01;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${lado}" height="${lado}" viewBox="0 0 ${lado} ${lado}"><rect width="${lado}" height="${lado}" rx="${lado * 0.22}" fill="${BOSQUE}"/><g transform="translate(${x} ${y}) scale(${s})"><path fill="${LIMA}" fill-rule="evenodd" d="${d}"/></g></svg>`;
}
fs.writeFileSync(path.join(RAIZ, 'marca/favicon.svg'), icono(64, 0.14));
await sharp(Buffer.from(icono(256, 0.14))).resize(32, 32).png().toFile(path.join(RAIZ, 'marca/favicon-32.png'));
await sharp(Buffer.from(icono(512, 0.2).replace(/rx="[\d.]+"/, 'rx="0"'))).resize(180, 180).png().toFile(path.join(RAIZ, 'marca/apple-touch-icon.png'));

// imagen para compartir: la vista de la ría con el logo en claro
const logo = leer('marca/logo.svg').replace(/#11462B/g, ESPUMA).replace(/#547D64/g, CLARO);
const logoUri = 'data:image/svg+xml;base64,' + Buffer.from(logo).toString('base64');
const W = 1200, H = 630;
const foto = await sharp(path.join(RAIZ, 'img/fotos/hero-atardecer-1921.jpg')).resize(W, H, { fit: 'cover', position: 'right' }).toBuffer();
const velo = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#0a2618" stop-opacity=".92"/><stop offset=".55" stop-color="#0a2618" stop-opacity=".55"/><stop offset="1" stop-color="#0a2618" stop-opacity="0"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#g)"/><image href="${logoUri}" x="70" y="96" width="470" height="351"/><text x="74" y="520" font-family="Segoe UI, Arial, sans-serif" font-weight="700" font-size="25" letter-spacing="5" fill="${LIMA}">CANGAS DO MORRAZO · PLAYA DE RODEIRA</text></svg>`);
await sharp(foto).composite([{ input: velo }]).jpeg({ quality: 84, mozjpeg: true }).toFile(path.join(RAIZ, 'img/og.jpg'));
console.log('marca lista');
