# La Garita · Casa Rural · Cangas do Morrazo · «Desde la garita»

Rediseño de `casalagarita.com` (WordPress de Araneira). Esta versión está **en local**, con `noindex` en todas las páginas, **sin publicar y sin repo git**.

- **Datos y fuentes:** `../casa-la-garita-cangas-bocetos/DATOS-GARITA.md` (resumen) y `ref/HALLAZGOS.md` (todo, con fuente y fecha de cada dato, lecturas del 2026-10-14).
- **Decisión (2026-10-14, «sigo con tus recomendaciones»):** concepto «La garita»; solo castellano; fotos de su web (y las de Instagram solo como ambiente); **sin fotos regeneradas con IA**; consulta por WhatsApp o correo, sin motor de reservas.

## Concepto

Una **garita** es el refugio de piedra de quien vigila el mar, y el logo es una garita de piedra con cúpula. La web es *mirar la ría desde la garita*:

1. **Portal (cortina):** el logo sobre el bosque; la garita se aclara y deja ver, **dentro de su silueta**, la vista de la ría (máscara SVG con el trazado real del logo); esa ventana crece (expo.inOut, ≈14 veces) hasta destapar la pantalla. El pivote del zoom es un punto de la cúpula, para que al final la cúpula cubra todo el viewport.
2. **Hero «el mirador»:** foto a pantalla completa que **se recorre con la mirada**: se arrastra con el dedo o el ratón (inercia y goma en los extremos), con las flechas del teclado y con dos botones. Con ratón, sin tocar nada, la vista sigue al puntero. Con `touch-action: pan-y` el scroll vertical no se pierde. Debajo, **la puesta de sol de hoy en Cangas**, calculada (ecuación del sol de NOAA/Meeus para 42,2594 N, 8,7652 O, hora de Madrid) con cuenta atrás.
3. **La casa:** texto, la garita de piedra de su web en un arco y la **panorámica** de la casa (2500 px) que se recorre con el scroll (a mano con movimiento reducido).
4. **Habitaciones:** índice por plantas y seis filas editoriales (Rodeira, Solano, Amencer, Cangas, Morrazo y el apartamento Mariña) con dos fotos cada una, una de ellas con forma de **arco** en varias. «Consultar esta» preselecciona la habitación en el formulario.
5. **Fuera:** jardín, minigolf, kayaks, barbacoa, parking y desayuno, con la vista de dron (1920 px) y la sala de desayunos.
6. **La ría (lámina):** mapa en canvas de OpenStreetMap estilo carta de navegación al anochecer. Empieza **cerca** (la casa, las playas, Cangas), se abre desde la casa como una gota y después **se abre hasta la ría entera** (Cíes, Vigo, Moaña, Morrazo, bateas, líneas de barco). La **línea ámbar** es el rumbo de la puesta de sol de hoy (hoy cae a 8° de las Illas Cíes, que quedan a 252°: el texto lo dice con los números del día y cuando la puesta cae sobre las Cíes lo dice). Filtros Todo / A pie / Playas / En barco; la lista manda, el mapa la acompaña.
7. **Opiniones:** notas (Booking 9,2 y Google 4,7, sin recuento) y seis opiniones literales con el nombre y el país con los que las firmaron.
8. **Consulta:** formulario que escribe el mensaje; lo envía el usuario desde su WhatsApp (34617633166) o correo.
9. **Cómo llegar** (con las cifras calculadas, no las de su web) y **pie**: la garita se **llena como la marea** con el scroll (ola en SVG recortada con la silueta exacta de la garita); el botón «Consultar fechas» aparece al llegar arriba.

### Nivel §5 bis (cinco obligatorias)

| Obligatoria | Cómo se cumple |
|---|---|
| Romper la fórmula | **Fuera:** cursor propio, imanes en botones, marquesinas, inclinación de tarjetas y pila sticky. **Propias:** portal por máscara, mirador arrastrable, sol de hoy, marea en la garita. |
| Gesto táctil propio del hero | Arrastrar horizontalmente el mirador (comprobado con toques reales por CDP; el arrastre vertical sigue siendo scroll). |
| El objeto se completa en el pie | La marea llena la garita; el botón es la puerta. |
| Foco con la forma del motivo | Contorno con esquinas de arco (`border-radius: 18px 18px 6px 6px`; 22/8 en botones, campos y filtros). |
| Rendimiento medido en móvil de gama media | Ver abajo. |

**Menú opcional elegido: dato en vivo** (la puesta de sol de hoy, calculada; y su rumbo en el mapa). No guarda nada en el navegador.

### Paleta (del logo)

| Token | Color | De dónde sale |
|---|---|---|
| `--bosque` | `#11462b` | «La garita» del logo (medido en el PNG) |
| `--garita` / `--garita-claro` | `#547d64` / `#9bc0a8` | la garita del logo, sobre claro / sobre oscuro |
| `--lima` | `#96c22b` | «CASA RURAL» del logo (solo sobre oscuro o como relleno) |
| `--noche` | `#0a2618` | hero, pie |
| `--espuma` / `--arena` | `#f1f3ec` / `#e4e8dc` | fondos claros (algo más fríos y verdes que los de las otras webs) |
| `--almagre` | `#a64b32` | el color teja de la casa, en acentos pequeños |
| `--poniente` | `#f0a24d` | solo el sol: el disco y el rumbo en el mapa |

`verificar.mjs` mide 18 contrastes; todos pasan.

### Letras

`Instrument Serif` para los títulos (la del logo es manuscrita y vive solo en el logo) y `Hanken Grotesk` para el texto, con una cara de respaldo con `size-adjust` para no mover el texto al cargar.

## Logo

El logo **no se redibuja**: es un calco SVG (potrace descartado; contorno subpíxel + Bézier) con IoU ≥ 99,3 % la garita y el rótulo, ≥ 98,6 % «CASA RURAL». Método y límites en `marca/LEEME.md`. El PNG original solo mide 857 × 640: si se quiere más calidad hay que pedir el vector. `marca/garita.svg` se incrusta en línea (cortina, cabecera, pie, 404, legales) y de él sale la máscara del portal y el recorte de la marea.

## Cómo se trabaja

- **Edita siempre los `*.src.html`.** `node construir.mjs` genera los `.html`: cada `<img data-foto>` pasa a `<picture>` (AVIF, WebP, JPG), incrusta los SVG de `marca/` sin sus `id` y pone `?v=<huella>` a CSS y JS.
- **Las legales y el 404** salen de `node scripts/legales.mjs`.
- **Fotos:** `scripts/fotos-lista.json` (nombre → archivo de `ref/fotos-web` o de `ref/instagram`) y `node scripts/fotos.mjs`. Nunca amplía. Muchas fotos de habitaciones solo tienen 800 px y se muestran pequeñas a propósito; `verificar.mjs` falla si alguna se pinta por encima de su resolución original.
- **Marca:** `node scripts/marca.mjs` (favicons, icono de iOS y `img/og.jpg`).
- **Mapa:** `cd scripts; python -I mapa.py; python -I vista.py` regenera `js/ria.js` y `datos/ria.json` (Overpass falla mucho: `ovp.py` reintenta con espejos y cachea en `scripts/.cache`, 6,9 MB, que no hay que subir). Origen: el nodo OSM `node/4637733182`, a 42 m del pin de su web.
- **`node verificar.mjs [--capturas]`** (puerto 8764, GSAP y Lenis desde copia local) comprueba: archivos y enlaces, portal (fotogramas registrados en la página), sin CDN / CDN lento / sin JS / movimiento reducido, mirador (botones, teclado, ratón, toque real), sol, habitaciones, formulario, cookies, marea, lámina (que dibuje y que las etiquetas no se pisen), móvil a 360, 375, 390 y 768, 0 `refresh` al subir y bajar la barra del navegador, densidades, foco y contraste. **142/142** el 2026-10-14.
- **`node scripts/rendimiento.mjs`**: LCP y peso en un Pixel 7 emulado (4G lento, CPU ×4).

## Mando de densidades (solo con `?revision`)

- **«La garita»:** fotos con arco, hileras de muro de piedra seca entre secciones.
- **«Sobria»:** fotos rectas, las hileras pasan a una línea. **Añade** la tabla «Las seis, de un vistazo» y una galería de doce fotos.

No guarda nada en el navegador: la URL lleva `&densidad=sobria`.

### Receta de borrado del mando

1. En `index.src.html`: borra el bloque entre `<!-- MANDO DE MAQUETA` y `fin del MANDO DE MAQUETA -->`, y en el script del `<head>` el bloque `// MANDO DE MAQUETA` (el `try { … }`).
2. En `js/main.js`: borra el bloque `16. MANDO DE MAQUETA` hasta `fin del MANDO DE MAQUETA`.
3. Opcional: en `css/estilos.css`, borra `.mando`. Las reglas `densidad-sobria`, la tabla y la galería quedan inertes.
4. `node construir.mjs`.

## Rendimiento (medido el 2026-10-14)

Pixel 7 emulado (412 × 915, DPR 2,6), 4G lento (1,6 Mbps, 150 ms), CPU ×4, GSAP y Lenis desde copia local, 3 pasadas:

| Medida | Resultado |
|---|---|
| **LCP** | **1,18 – 1,21 s** (el titular del hero) |
| Portal fuera | ~2,8 s |
| Peticiones / peso | 12 / 606 KB |
| Tareas largas | una de ~110 ms (arranque) |

La foto del hero va precargada (`imagesizes="max(100vw, 178svh)"`: el ancho real en pantalla, que en móvil es mayor que el viewport porque se recorre) y el portal espera como máximo 1,4 s a que esté lista para que el primer fotograma de la ventana ya tenga imagen. Las hileras se montan en un rato libre **después** del portal.

## Fotos

Todas de su web (`ref/fotos-web`, sacadas de `wp-json/wp/v2/media`) salvo `desayuno` (su Instagram, 1080 px). Gradación común y suave (algo menos de saturación). **Ninguna regenerada con IA.**

- El **techo es la resolución**: las habitaciones no pasan de 801 px (Rodeira, 1078), la fachada solo existe a 853 px y las mejores (atardecer 1921, dron 1920, panorámica 2500) son de ambiente. **Hay que pedirle a Jesús los originales** de las habitaciones, la fachada y el vídeo.
- `fotos-web-stock/` guarda las 53 de plantilla de su WordPress (`hostel_*`, `home-staging_*`…); no se usan.
- Su Instagram (27 posts, último de 2022, 271 seguidores) solo sirve como ambiente, a 1080 px cuadrados: no hay habitaciones ni fachada.

## Pendientes para la casa

- [ ] **Capacidad registrada vs. anunciada (lo más delicado antes de publicar):** el Registro de Turismo de Galicia (REAT) recoge **3 habitaciones dobles y 6 plazas** como turismo rural, grupo C (casa de labranza), `TR-PO-000115`. La web anuncia 5 habitaciones y un apartamento de 4 a 6 personas, y no hay otro registro a esa dirección. Aquí se mantiene lo que dice su web. Preguntar si hay otra inscripción (VUT o de apartamento) o si el registro está desactualizado.
- [ ] **Booking muestra `TR-PO-00015`** (falta un cero): avisar.
- [ ] **Rodeira «terraza privada»**: su página lo lista en Rodeira y la terraza que describe es la de Solano. Confirmar.
- [ ] **Precios «desde»** (60 / 70 €, temporada baja) y qué es «temporada alta»: su web no da fechas. Confirmar si son por habitación y noche.
- [ ] **Tiempos a pie y distancias:** su web dice «15 minutos andando del centro» (en otro sitio, «5 minutos») y «20 km de Vigo» (en otro, 27). Aquí van los calculados con OSRM sobre OpenStreetMap: **unos 20 min** a pie al centro (1,4 km), **26 km / 23 min** en coche a Vigo rodeando la ría, y el ferry Cangas–Vigo, unos 25 min. El cálculo a pie por calles es pesimista (el camino de costa a Canabal no está unido a la red peatonal de OSM).
- [ ] **Barcos:** a Vigo, la estación marítima de Cangas (Mar de Ons); a las Illas Cíes, solo en temporada (Semana Santa y del 15 de mayo al 15 de septiembre, con autorización). Su web dice «ferry cada 10 minutos»: el 14-oct-2026 hay 34 salidas, cada 20–30 min, de 07:20 a 22:30. Aquí no se ponen horarios ni precios.
- [ ] **Punta Rodeira (mirador)**: lo cita su web pero no existe en OSM; confirmar dónde está (aquí solo se nombra en el texto de «Fuera»). Hay una **garita de piedra** en su web (foto `tarifas.jpg`, sin lugar): confirmar si es la del nombre y dónde queda antes de ponerle pie.
- [ ] **Alemanes y Ratas** son una sola playa en OSM; su web las cuenta aparte.
- [ ] Horarios y normas (de Booking, no de la casa): entrada 14:00–20:00, salida 9:00–12:00, sin mascotas, no fumar, silencio de 21:00 a 9:00. Confirmar para publicarlos (aquí no van).
- [ ] **Titular**: «LA GARITA ESPJ», CIF E67679639, tal como en su aviso legal actual. Comprobar con la gestoría (una ESPJ es una entidad sin personalidad jurídica).
- [ ] Teléfono: 617 633 166 (móvil con WhatsApp) y 986 300 257 (fijo, el del registro oficial; en su web solo estaba en un botón roto). En OSM el nodo de la casa lleva el fijo.
- [ ] Nombre «Amencer» (su web) o «Solpor» (nombres de archivo de sus fotos).
- [ ] Notas de Booking (9,2) y Google (4,7) leídas el 2026-10-14; Tripadvisor bloquea la lectura. Se muestran sin recuento y con fecha.
- [ ] Errores de la web actual a corregir si se migra: el enlace de correo de la privacidad apunta a `reservas@apartamentosarango.com` (otro negocio); los botones «Reservar» de La Casa y Tarifas tienen `href=""`, y los textos legales prometen reserva online con tarjeta.
- [ ] Dominio y paso de su WordPress.
- [ ] Declaración de accesibilidad: completar tras la revisión previa a la publicación.

## Para publicar

`noindex` en todas las páginas mientras no venda. `?v=<huella>` ya lo pone `construir.mjs`; avisar de Ctrl+F5. No subir `scripts/.cache` ni `ref/` (datos de terceros sin depurar).
