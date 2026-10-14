/* Pone ?v=<huella> a los CSS y JS propios de cada HTML, para que GitHub Pages
   no sirva ficheros viejos de la cache del navegador tras un cambio.
   Solo toca los atributos href= y src= (nunca texto suelto que se parezca). */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const RAIZ = path.dirname(fileURLToPath(import.meta.url));
const huellas = new Map();

function huella(rel) {
  if (huellas.has(rel)) return huellas.get(rel);
  const f = path.join(RAIZ, rel);
  if (!fs.existsSync(f)) return null;
  const h = crypto.createHash('sha1').update(fs.readFileSync(f)).digest('hex').slice(0, 8);
  huellas.set(rel, h);
  return h;
}

let tocados = 0;
for (const html of fs.readdirSync(RAIZ).filter((f) => f.endsWith('.html'))) {
  const p = path.join(RAIZ, html);
  const antes = fs.readFileSync(p, 'utf8');
  // anclado al atributo: (href|src)="ruta.css|js" con un ?v= opcional ya puesto
  const despues = antes.replace(
    /(\b(?:href|src)=")((?:css|js)\/[A-Za-z0-9._-]+\.(?:css|js))(?:\?v=[0-9a-f]+)?(")/g,
    (todo, pre, rel, post) => {
      const h = huella(rel);
      if (!h) return todo;
      return pre + rel + '?v=' + h + post;
    });
  if (despues !== antes) {
    fs.writeFileSync(p, despues);
    tocados++;
    console.log('  ' + html);
  }
}
console.log(`${tocados} html actualizados, ${huellas.size} ficheros con huella`);
for (const [rel, h] of huellas) console.log(`  ${rel}  ${h}`);
