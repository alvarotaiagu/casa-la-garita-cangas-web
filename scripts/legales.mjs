/* Genera los *.src.html de las páginas legales y el 404 con una plantilla común.
   Uso: node scripts/legales.mjs  (después, node construir.mjs)
   Los datos del titular son los de su aviso legal actual (casalagarita.com/legales). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const TITULAR = `<dl>
  <dt>Titular</dt><dd>LA GARITA ESPJ</dd>
  <dt>CIF</dt><dd>E67679639</dd>
  <dt>Nombre comercial</dt><dd>Casa Rural La Garita</dd>
  <dt>Domicilio</dt><dd>Camino de la Garita, 25 · Rodeira · 36940 Cangas do Morrazo (Pontevedra)</dd>
  <dt>Correo</dt><dd><a href="mailto:rural@casalagarita.com">rural@casalagarita.com</a></dd>
  <dt>Teléfono</dt><dd><a href="tel:+34617633166">617 633 166</a> · <a href="tel:+34986300257">986 300 257</a></dd>
</dl>`;

const paginas = {
  'aviso-legal': {
    titulo: 'Aviso legal',
    cuerpo: `
<p>En cumplimiento del artículo 10 de la Ley 34/2002, de Servicios de la Sociedad de la Información y de Comercio Electrónico (LSSI-CE), estos son los datos del titular de esta web:</p>
${TITULAR}
<p>Alojamiento de turismo rural inscrito en el Registro de Turismo de Galicia con el número <b class="nw">TR-PO-000115</b>.</p>
<h2>Uso de la web</h2>
<p>Esta web informa sobre el alojamiento Casa Rural La Garita y permite preparar una consulta de disponibilidad. Quien la usa se compromete a hacerlo de buena fe y conforme a la ley.</p>
<p>Las consultas que se preparan en el formulario se envían desde el WhatsApp o el correo de la persona usuaria: la web no las guarda ni las manda por su cuenta.</p>
<h2>Propiedad intelectual</h2>
<p>Los textos, el logotipo y las fotografías son del titular o se usan con su permiso. No se pueden reproducir sin autorización.</p>
<p>El mapa de la ría se ha dibujado con datos de <a href="https://www.openstreetmap.org/copyright">© colaboradores de OpenStreetMap</a>, disponibles con la licencia Open Database License (ODbL).</p>
<h2>Responsabilidad</h2>
<p>Las distancias y los tiempos de viaje son aproximados. Los enlaces a otras webs (Google Maps, WhatsApp, Booking.com, Tripadvisor, Instagram, Facebook) llevan a servicios de terceros con sus propias condiciones.</p>
<h2>Ley aplicable</h2>
<p>Estas condiciones se rigen por la ley española. Para cualquier reclamación, puede escribirnos al correo indicado arriba: buscaremos siempre una solución amistosa.</p>`,
  },
  privacidad: {
    titulo: 'Política de privacidad',
    cuerpo: `
<h2>Responsable</h2>
${TITULAR}
<h2>Qué datos tratamos y para qué</h2>
<p>Solo los que usted nos manda al hacer una consulta (por WhatsApp, por correo o por teléfono): nombre, fechas, número de personas y lo que quiera contarnos. Los usamos para contestarle y, si reserva, para gestionar su estancia.</p>
<p>El formulario de esta web no envía nada por su cuenta: abre su WhatsApp o su correo con el mensaje escrito, y es usted quien lo manda.</p>
<h2>Base legal y plazos</h2>
<p>La base es su consentimiento al escribirnos y, si reserva, la ejecución del contrato de alojamiento. Conservamos los datos el tiempo necesario para atender la consulta y, en las reservas, los plazos que exige la ley (incluido el registro de viajeros).</p>
<h2>Con quién se comparten</h2>
<p>Con nadie, salvo obligación legal. Si nos escribe por WhatsApp o correo, esos servicios tratan el mensaje según sus propias políticas.</p>
<h2>Sus derechos</h2>
<p>Puede pedir el acceso, la rectificación, la supresión, la oposición, la limitación o la portabilidad de sus datos escribiendo a <a href="mailto:rural@casalagarita.com">rural@casalagarita.com</a>. Si cree que no se han respetado, puede reclamar ante la Agencia Española de Protección de Datos (<a href="https://www.aepd.es">aepd.es</a>).</p>
<h2>Lo que guarda esta web en su navegador</h2>
<p>Una sola cosa: <code>lagarita-cookies</code> en el almacenamiento local, para recordar que ya ha visto el aviso de cookies. Más detalles en <a href="cookies.html">cookies</a>.</p>`,
  },
  cookies: {
    titulo: 'Política de cookies',
    cuerpo: `
<p>Esta web no usa cookies propias de análisis ni de publicidad.</p>
<h2>Lo que se guarda en su navegador</h2>
<ul>
  <li><b>lagarita-cookies</b> (almacenamiento local): recuerda que ha visto el aviso, para no enseñárselo en cada visita. Es técnica y no caduca sola; puede borrarla desde su navegador.</li>
</ul>
<h2>Servicios de terceros</h2>
<ul>
  <li><b>Google Fonts</b>: las letras de la web se cargan desde los servidores de Google, que reciben su dirección IP.</li>
  <li><b>Google Maps</b>: el mapa del apartado «Cómo llegar» solo se carga si pulsa «Ver el mapa». A partir de ese momento, Google puede instalar sus cookies.</li>
  <li><b>Librerías de animación</b> (GSAP y Lenis): se descargan de cdnjs y jsDelivr, que reciben su dirección IP. No instalan cookies.</li>
</ul>
<p>Puede volver a ver el aviso desde «Preferencias de cookies», en el pie de la portada.</p>`,
  },
  accesibilidad: {
    titulo: 'Declaración de accesibilidad',
    cuerpo: `
<p>El titular se compromete a que esta web sea accesible conforme al Real Decreto 1112/2018, de 7 de septiembre, sobre accesibilidad de los sitios web y aplicaciones para dispositivos móviles, y a la norma UNE-EN 301 549 (nivel AA de las WCAG 2.1).</p>
<h2>Situación de cumplimiento</h2>
<p class="aviso">PENDIENTE: completar tras la revisión de accesibilidad previa a la publicación.</p>
<p>La web se ha construido para poder usarse entera con el teclado y con lector de pantalla: contrastes de al menos 4,5:1, foco visible, textos alternativos en las fotos, formularios con etiquetas y animaciones que se desactivan si su sistema pide reducir el movimiento. La vista del inicio se puede recorrer con el teclado (flechas) y con los botones.</p>
<h2>Contacto</h2>
<p>Si encuentra una barrera, escríbanos a <a href="mailto:rural@casalagarita.com">rural@casalagarita.com</a> o llame al <a href="tel:+34617633166">617 633 166</a>. Le responderemos y le daremos la información en un formato accesible.</p>`,
  },
};

for (const [nombre, p] of Object.entries(paginas)) {
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${p.titulo} · Casa Rural La Garita</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Hanken+Grotesk:wght@400;600;700&display=swap">
<link rel="stylesheet" href="css/estilos.css">
<link rel="stylesheet" href="css/legal.css">
<link rel="icon" href="marca/favicon.svg" type="image/svg+xml">
</head>
<body>
<header class="legal-cab">
  <div class="env">
    <a href="index.html" aria-label="Casa Rural La Garita, a la portada"><!--svg:marca/garita.svg aria-hidden="true" focusable="false"--><span class="cab__nombre">La garita<small>Casa rural</small></span></a>
    <a class="volver" href="index.html">Volver a la portada</a>
  </div>
</header>
<main class="legal">
  <div class="env">
    <h1>${p.titulo}</h1>
${p.cuerpo}
  </div>
</main>
<footer class="legal-pie">
  <div class="env">
    <a href="aviso-legal.html">Aviso legal</a>
    <a href="privacidad.html">Privacidad</a>
    <a href="cookies.html">Cookies</a>
    <a href="accesibilidad.html">Accesibilidad</a>
  </div>
</footer>
</body>
</html>
`;
  fs.writeFileSync(path.join(RAIZ, `${nombre}.src.html`), html);
  console.log(`${nombre}.src.html`);
}

fs.writeFileSync(path.join(RAIZ, '404.src.html'), `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Página no encontrada · Casa Rural La Garita</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Hanken+Grotesk:wght@400;700&display=swap">
<link rel="stylesheet" href="css/estilos.css">
<link rel="icon" href="marca/favicon.svg" type="image/svg+xml">
<style>
  body { background: var(--noche); color: var(--espuma); min-height: 100svh; display: grid; place-items: center; text-align: center; padding: 24px; }
  .no { display: grid; gap: 22px; justify-items: center; max-width: 30em; }
  .no svg { width: 190px; height: auto; color: var(--garita-claro); }
  .no h1 { font-family: var(--letra-tit); font-weight: 400; font-size: clamp(2.4rem, 7vw, 3.6rem); line-height: 1; }
</style>
</head>
<body>
  <main class="no">
    <!--svg:marca/garita.svg aria-hidden="true" focusable="false"-->
    <h1>Aquí no hay nada que vigilar.</h1>
    <p>La página que busca no existe o ha cambiado de sitio.</p>
    <a class="btn btn--lima" href="./">Volver a la portada</a>
  </main>
</body>
</html>
`);
console.log('404.src.html');
