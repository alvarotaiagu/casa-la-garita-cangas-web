# Marca de Casa Rural La Garita: calco vectorial del logo

El logo del cliente no se redibuja ni se mejora: es un calco fiel del PNG original. Todo se regenera con:

```
python -I scripts/logo.py          # SVG, geometria.json, colores.json
python -I scripts/logo_render.py   # Chromium pinta los SVG: IoU, iou.json y comparacion-*.png
```

Origen: `ref/logo/LOGO_LA_GARITA_CUADRADO.png`, **857 x 640 px** (el encargo decía 641; el PNG mide 640). Es la mayor versión que sirve la web del cliente: en `ref/media.json` el logo cuadrado, en PNG y en JPG, mide 857 x 640 y el rectangular 801 x 223. Es RGBA con fondo transparente.

## Ficheros

| Fichero | Contenido |
|---|---|
| `garita.svg` (11,9 KB, 5,3 KB gzip) | La garita (cúpula, muro y base): **un solo `<path fill-rule="evenodd">`**, `fill="currentColor"`, sin ids. Las juntas son huecos; las 7 piedras sueltas de dentro de los huecos son subtrazados anidados, así que hay que dejar `evenodd`. 414 nodos. |
| `texto.svg` (17,5 KB, 7,7 KB gzip) | Dos paths sin `fill`: `class="t1"` = «La garita» (371 nodos) y `class="t2"` = «CASA RURAL» (224 nodos). Los colores se ponen por CSS con el SVG en línea (en un `<img>` las clases no llegan). |
| `logo.svg` (29,7 KB, 12,8 KB gzip) | El conjunto vertical como el original, con los colores medidos como `fill`. `viewBox="0 0 857 640"`, 1 unidad = 1 px del PNG. Cuatro paths: garita, mota, «La garita», «CASA RURAL». |
| `punto.svg` | La mota de tinta oscura bajo la base de la garita (ver «Decisiones»). |
| `garita-solida.svg` | Opcional, **derivada, no calco**: la silueta exterior sin juntas, un solo contorno (1 `M`), `currentColor`. Para animar un relleno. |
| `geometria.json` | `viewBox`, caja (x, y, w, h) y `transform` de cada pieza dentro del lienzo 857 x 640, y la caja de cada renglón. |
| `colores.json` | Colores medidos, luminancia relativa, contraste sobre blanco y fondo del PNG. |
| `iou.json` | Resultado de la comprobación, por pieza y por letra. |
| `comparacion-garita.png`, `-texto.png`, `-logo.png`, `-solida.png` | El original a x3 (con su antialias) con el contorno del SVG en rojo, y debajo o al lado el mapa de diferencias: gris = coincide, rojo = sólo SVG, azul = sólo original. |

`garita.svg`, `punto.svg`, `garita-solida.svg` y `texto.svg` llevan `viewBox="0 0 w h"` ajustado a su dibujo con margen 0 (origen 0,0). Para que casen sobre `logo.svg` basta el `translate` de `geometria.json`:

| Pieza | viewBox | Caja en el lienzo (x, y, w, h) | transform |
|---|---|---|---|
| garita | `0 0 388.99 335.84` | 234.33, 0.11, 388.99, 335.84 | `translate(234.33 0.11)` |
| garita-solida | `0 0 388.9 336.03` | 234.35, 0.14, 388.9, 336.03 | `translate(234.35 0.14)` |
| mota | `0 0 22.67 17.86` | 308.49, 320.31, 22.67, 17.86 | `translate(308.49 320.31)` |
| texto (los dos renglones) | `0 0 855.46 274.31` | 0.83, 364.9, 855.46, 274.31 | `translate(0.83 364.9)` |
| renglón «La garita» | | 0.83, 364.9, 853.79, 274.3 | |
| renglón «CASA RURAL» | | 436.37, 559.12, 419.92, 53.28 | |

Dentro de `texto.svg`, «CASA RURAL» está en (435.54, 194.22) con 419.92 x 53.28 (`caja_en_texto_svg` en `geometria.json`).

Colocarlas encima del logo (así se midió el IoU, con SVG anidados):

```html
<svg viewBox="0 0 857 640">
  <svg x="234.33" y="0.11" width="388.99" height="335.84" viewBox="0 0 388.99 335.84">…path de garita.svg…</svg>
  <svg x="0.83" y="364.9" width="855.46" height="274.31" viewBox="0 0 855.46 274.31">…paths de texto.svg…</svg>
</svg>
```

## Colores (colores.json)

Las tres tintas son planas: todos los píxeles opacos de cada una son idénticos y no hay mezcla entre tintas (0 píxeles). Color por mediana.

| Pieza | Hex | RGB | Luminancia relativa | Contraste sobre blanco |
|---|---|---|---|---|
| Garita (macizo) | `#547D64` | 84, 125, 100 | 0,1747 | 4,67 |
| «La garita» (y la mota) | `#11462B` | 17, 70, 43 | 0,0467 | 10,85 |
| «CASA RURAL» | `#96C22B` | 150, 194, 43 | 0,4524 | 2,09 |

**Fondo del PNG: transparente** (alfa 0; los píxeles transparentes llevan RGB blanco). Está pensado para fondo claro. El lima sobre blanco no llega a 3:1: vale para el rótulo de la marca, no para texto ni iconos con función.

## Método

1. **Piezas.** Cada tinta se separa por color exacto. El alfa de sus píxeles es la cobertura (antialias) de esa tinta. La tinta oscura se divide en componentes conexas: «La garita» y una mota que queda por encima del rótulo y por debajo de la garita.
2. **Campo.** La cobertura de cada pieza, con un margen de ceros alrededor (la cúpula roza el borde superior del PNG), se amplía x4 en bicúbico y se suaviza con sigma 0,25 px del original. Es un campo continuo 0..1.
3. **Contorno subpíxel.** Se toma el contorno al nivel 0,5 (media tinta) refinado a lo largo de la normal, sin escalera de píxeles. Después, un suavizado mínimo (1,5 muestras en la garita y 2 en el rótulo, a 0,25 px por muestra).
4. **Bézier.** Ajuste de cúbicas (Schneider) con error máximo de 0,5 px a x4, es decir 0,125 px del original, y esquinas solo donde el giro es brusco. Es el código del calco de Neixón (`scripts/logo_curvas.py`, adaptado de `hotel-rural-neixon-boiro-web/scripts/curvas.py`). Coordenadas con 2 decimales.
5. **Silueta sólida (opcional).** Cierre morfológico de radio 24 px del macizo, relleno de huecos y un solo contorno. No es un calco: es una pieza derivada.

## Resultado (Chromium, IoU a x3)

El SVG se pinta con Chromium a x3 (tinta negra, antialias del navegador, corte al 50 %) y se compara con el alfa de la tinta ampliado x3 y cortado al 50 %. Las piezas se colocan en el lienzo con los `viewBox` y `transform` de `geometria.json`, así que se comprueban los ficheros reales. El IoU suave a x1 es sum(min)/sum(max) entre la cobertura que pinta Chromium a 1x y el alfa del PNG, sin umbral.

| Pieza | IoU a x3 | IoU suave a x1 |
|---|---|---|
| `garita.svg` | **0,9962** | 0,9946 |
| `texto.svg` (los dos renglones) | **0,9930** | 0,9910 |
| «La garita» sola | **0,9942** | 0,9928 |
| «CASA RURAL» sola | **0,9867** | 0,9813 |
| Mota (`punto.svg`) | 0,9857 | 0,9783 |
| `logo.svg` completo | **0,9947** | 0,9929 |

Todas las piezas pasan del 98 %. Por componente conexa del original (letras que se tocan cuentan juntas): «La garita» 9 componentes, de 0,9931 a 0,9954; «CASA RURAL» 6 componentes, de 0,9855 a 0,9881.

`garita-solida.svg` cubre el 99,85 % del macizo de la garita (área 1,49 veces la del macizo). No tiene IoU frente al original porque no es un calco.

Validación: los cinco SVG se parsean con `xml.etree`; `logo_render.py` comprueba además que `garita.svg` tiene un solo path con `currentColor` y `evenodd` y ningún id, que `texto.svg` tiene los paths `t1`/`t2` sin `fill`, que `logo.svg` tiene `viewBox="0 0 857 640"` y que `garita-solida.svg` es un solo contorno.

Revisado a ojo en las comparaciones a x3 y con la garita y letras sueltas pintadas a x8: sin dientes, mellas ni halos.

## Decisiones, dificultades y límites

- **Mota.** Bajo la base de la garita, a la izquierda (308-331 x 320-338 px), hay una mota de tinta **oscura** (#11462B), no del verde medio del macizo. Se calca y está en `logo.svg` con su color; **no va en `garita.svg`** (no es cúpula, muro ni base) y se deja aparte en `punto.svg`. Si se quiere en la garita monocroma, se añade su path.
- **potrace probado y descartado.** Primero se calcó con potrace (potracer) sobre la máscara x4: IoU parecido (0,9957 / 0,9932 / 0,9856) pero a x8 deja facetas en las curvas suaves (escalones de píxel convertidos en tramos rectos, por ejemplo un lomo plano en el ojo de la g). El contorno subpíxel con Bézier las elimina, da algo más de IoU y entre un 15 y un 30 % menos de nodos.
- **El original es pequeño (857 px) y tiene temblor.** El borde de las letras y de las piedras oscila unos 0,1 px; es del original y el calco lo respeta. A tamaño de cabecera no se ve; a más de x6 se nota una ondulación ligera en las astas de la r, la i y la t. Subir el suavizado la reduce pero baja el IoU (con 2,5 muestras «CASA RURAL» baja a 0,985), así que se dejó en 2.
- **«CASA RURAL» es lo más bajo (0,9867).** Son letras de 10-14 px de trazo con contrapuntos pequeños, y el borde del PNG es más ancho que un antialias de 1 px, así que el corte al 50 % no puede cuadrar más. El IoU suave a x1 tiene el mismo techo (~0,975-0,98) con cualquier parámetro probado.
- **Cúpula y bordes del lienzo.** La cúpula llega al borde superior del PNG pero no se recorta: su ápice está en y = 0,11. Ninguna letra sale del lienzo (la L está a 0,83 px del borde izquierdo).
- **Los renglones.** La caja de «La garita» (0,83-854,6 x 364,9-639,2) incluye la g con su rabo, que baja hasta el final del lienzo por la izquierda de «CASA RURAL». No se solapan en horizontal (la g acaba en x = 422 y «CASA RURAL» empieza en 436).
- **Silueta sólida derivada.** Con radio 24 px se cierran todas las juntas y el hueco entre cúpula y cornisa, y queda un solo contorno; el hueco grande de la derecha, que en el original es un vacío del dibujo, sigue abierto con algunas bahías redondeadas. Con radios de 10 a 16 px quedaban juntas y muescas abiertas; con 34 px las bahías de la derecha salían más grandes.
- **Dos decimales** en las coordenadas (0,01 px del lienzo). Con uno bajaría un 20 % el peso, pero a x8 se notaría en las curvas.
- **Qué no se ha hecho:** no se ha buscado otra versión del logo fuera de la web del cliente (Facebook, Google Business) por si hubiera una mayor; el calco está limitado por los 857 px del PNG.
- En `marca/` conviven otros ficheros (favicon, apple-touch-icon) que no son de este calco.
