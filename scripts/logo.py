"""Calco vectorial FIEL del logo de Casa Rural La Garita (no se redibuja ni se mejora).

Origen: ref/logo/LOGO_LA_GARITA_CUADRADO.png (857x640, RGBA: la mayor versión que sirve la web
del cliente). El alfa es cobertura exacta (antialias) de tres tintas planas, sin mezclas
entre ellas, así que se calca directamente el alfa de cada tinta con precisión subpíxel.

Uso:  python -I scripts/logo.py
Deja en marca/: garita.svg, garita-solida.svg, punto.svg, texto.svg, logo.svg, geometria.json,
colores.json. La comprobación (IoU con Chromium e imágenes de comparación) está en
scripts/logo_render.py.

Método (rótulo manuscrito y mancha irregular: no hay rectas que redibujar):
  1. Cobertura de cada pieza = alfa de los píxeles de su tinta (componentes conexas), con
     un margen de ceros alrededor (la dome roza el borde superior del PNG).
  2. Ampliación x4 (bicúbica) y suavizado ligero: campo continuo 0..1.
  3. Contorno subpíxel al nivel 0,5 del campo (sin escalera de píxeles), suavizado
     de Fourier/gauss mínimo y ajuste de Bézier cúbicas (Schneider) con esquinas sólo donde el
     giro es brusco (scripts/logo_curvas.py, adaptado del calco de Neixón).
     Se probó antes potrace sobre la máscara x4: IoU parecido, pero a x8 deja facetas y
     rectas falsas en las curvas suaves; por eso se cambió.
  4. Color por MEDIANA de los píxeles opacos de cada tinta.
"""
import json
import math
import os
import sys
import xml.etree.ElementTree as ET
from collections import Counter

import cv2
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from logo_curvas import ajustar_cerrada, contornos_subpixel, esquinas  # noqa: E402

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
MARCA = os.path.join(RAIZ, "marca")
FUENTE = os.path.join(RAIZ, "ref", "logo", "LOGO_LA_GARITA_CUADRADO.png")

E = 4                       # ampliación para la precisión subpíxel
SIGMA = 1.0                 # suavizado del campo a x4 (0,25 px del original)
UMBRAL = 0.5                # corte de la cobertura ampliada (media tinta)
DECIMALES = 2               # decimales de las coordenadas del SVG
MARGEN = 6                  # ceros alrededor de cada pieza (px del original)
# Ajuste, en píxeles del campo x4 (1 px x4 = 0,25 px del original)
PARAMS = dict(suavizado=1.5, ventana=8, umbral=55, tol=0.5)          # garita y mota
PARAMS_TEXTO = dict(suavizado=2.0, ventana=8, umbral=50, tol=0.5)    # rótulos
PARAMS_SOLIDA = dict(suavizado=6.0, ventana=12, umbral=80, tol=1.5)  # silueta derivada
RADIO_SOLIDA = 24           # px del original: el cierre morfológico que borra las juntas


# ------------------------------------------------------------- lectura
def cargar():
    im = np.array(Image.open(FUENTE).convert("RGBA"))
    rgb = im[..., :3].astype(np.int32)
    alfa = im[..., 3].astype(np.float32) / 255.0
    visible = im[..., 3] > 0
    # tres tintas: las tres más frecuentes entre los píxeles opacos
    opacos = rgb[im[..., 3] == 255]
    top = [np.array(c, np.int32) for c, _ in Counter(map(tuple, opacos)).most_common(3)]
    d = np.stack([np.abs(rgb - c).sum(-1) for c in top], -1)
    cls = d.argmin(-1)
    # color por MEDIANA de los píxeles opacos de cada tinta
    medidos = []
    for k in range(3):
        px = rgb[(cls == k) & (im[..., 3] == 255)]
        medidos.append(np.median(px, axis=0).astype(int))
    mezcla = int(((d.min(-1) > 8) & visible).sum())   # píxeles visibles que no son de ninguna tinta
    return im, alfa, visible, cls, medidos, mezcla


def luminancia_relativa(rgb):
    def lin(c):
        c = c / 255.0
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = (lin(v) for v in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contraste(l1, l2):
    a, b = max(l1, l2), min(l1, l2)
    return (a + 0.05) / (b + 0.05)


def hexa(rgb):
    return "#%02X%02X%02X" % tuple(int(v) for v in rgb)


def piezas(alfa, visible, cls, medidos):
    """Devuelve ({nombre: (mascara, indice_de_tinta)}, {nombre: indice_de_tinta}).
    Tres tintas planas: lima («CASA RURAL», la más saturada), oscura («La garita» y una mota
    bajo la base de la garita) y media (el macizo de la garita)."""
    brillo = [luminancia_relativa(m) for m in medidos]
    sat = [int(max(m) - min(m)) for m in medidos]
    k_lim = int(np.argmax(sat))
    resto = [k for k in range(3) if k != k_lim]
    k_osc = min(resto, key=lambda k: brillo[k])
    k_med = max(resto, key=lambda k: brillo[k])

    out = {"garita": ((cls == k_med) & visible, k_med),
           "t2": ((cls == k_lim) & visible, k_lim)}
    m = ((cls == k_osc) & visible).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(m, connectivity=8)
    comps = [(i, st[i]) for i in range(1, n)]
    # mota: componente oscura cuya caja acaba por encima de la parte más alta de todas las demás
    punto = [i for i, s in comps
             if s[1] + s[3] < min(t[1] for j, t in comps if j != i)]
    mp = np.isin(lab, punto)
    out["punto"] = (mp, k_osc)
    out["t1"] = ((lab > 0) & ~mp, k_osc)
    return out, dict(garita=k_med, t1=k_osc, punto=k_osc, t2=k_lim)


# ------------------------------------------------------------- calco
def campo_x4(cov, caja, pad=MARGEN):
    """Cobertura ampliada x4 (bicúbica) y suavizada de la caja (x0,y0,x1,y1) con margen de
    ceros (también fuera del lienzo). Devuelve (campo, x0, y0): origen del campo en px del
    original, que puede ser negativo."""
    x0, y0, x1, y1 = caja
    x0 -= pad; y0 -= pad; x1 += pad; y1 += pad
    H, W = cov.shape
    sub = np.zeros((y1 - y0, x1 - x0), np.float32)
    ya, yb, xa, xb = max(0, y0), min(H, y1), max(0, x0), min(W, x1)
    sub[ya - y0:yb - y0, xa - x0:xb - x0] = cov[ya:yb, xa:xb]
    big = cv2.resize(sub, (sub.shape[1] * E, sub.shape[0] * E), interpolation=cv2.INTER_CUBIC)
    big = np.clip(big, 0, 1)
    big = cv2.GaussianBlur(big, (0, 0), sigmaX=SIGMA)
    return big, x0, y0


def trazar(campo, x0, y0, params):
    """Contornos subpíxel del nivel UMBRAL del campo x4 y Bézier cúbicas. Curvas cerradas en
    unidades del lienzo (px del original): (inicio, [("L", p) | ("C", c1, c2, p), ...])."""
    mask = campo > UMBRAL
    org = np.array([x0, y0], float)
    f = lambda q: q / E + org
    curvas = []
    for p in contornos_subpixel(mask, campo, 0, 0, suavizado=params["suavizado"]):
        cortes, _ = esquinas(p, params["ventana"], params["umbral"])
        ini, segs = ajustar_cerrada(p, params["tol"], cortes)
        curvas.append((f(ini), [(sg[0],) + tuple(f(q) for q in sg[1:]) for sg in segs]))
    return curvas


def calcar(cov_total, mascara_comp, params):
    ys, xs = np.nonzero(mascara_comp)
    caja = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
    campo, x0, y0 = campo_x4(cov_total * mascara_comp, caja)
    return trazar(campo, x0, y0, params), campo, (x0, y0)


# ------------------------------------------------------------- geometría
def extremos_bezier(p0, p1, p2, p3):
    """Cajas exactas de una cúbica: puntos extremos (derivada = 0) incluidos."""
    pts = [p0, p3]
    for k in (0, 1):
        a = -p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]
        b = 2 * (p0[k] - 2 * p1[k] + p2[k])
        c = p1[k] - p0[k]
        # derivada/3 = a t^2 + b t + c
        ts = []
        if abs(a) < 1e-12:
            if abs(b) > 1e-12:
                ts = [-c / b]
        else:
            disc = b * b - 4 * a * c
            if disc >= 0:
                r = math.sqrt(disc)
                ts = [(-b + r) / (2 * a), (-b - r) / (2 * a)]
        for t in ts:
            if 0 < t < 1:
                q = ((1 - t) ** 3) * p0 + 3 * ((1 - t) ** 2) * t * p1 + 3 * (1 - t) * t * t * p2 + t ** 3 * p3
                pts.append(q)
    return pts


def caja_curvas(curvas):
    xs, ys = [], []
    for ini, segs in curvas:
        cur = ini
        xs.append(ini[0]); ys.append(ini[1])
        for s in segs:
            if s[0] == "L":
                pts = [s[1]]
                cur = s[1]
            else:
                pts = extremos_bezier(cur, s[1], s[2], s[3])
                cur = s[3]
            for q in pts:
                xs.append(q[0]); ys.append(q[1])
    return min(xs), min(ys), max(xs), max(ys)


def desplazar(curvas, dx, dy):
    o = np.array([dx, dy], float)
    return [(i + o, [(s[0],) + tuple(q + o for q in s[1:]) for s in segs]) for i, segs in curvas]


# ------------------------------------------------------------- serializar
def num(v, dec=DECIMALES):
    s = f"{v:.{dec}f}"
    if "." in s:
        s = s.rstrip("0").rstrip(".")
    if s.startswith("0."):
        s = s[1:]
    elif s.startswith("-0."):
        s = "-" + s[2:]
    return "0" if s in ("-0", "") else s


def txt(v):
    """Número normal (con el cero delante) para JSON y atributos transform."""
    s = f"{v:.2f}".rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s


def unir(nums):
    out = ""
    for v in nums:
        s = num(v)
        if out and not s.startswith("-"):
            out += " "
        out += s
    return out


def path_d(curvas):
    """Comandos relativos sobre coordenadas absolutas ya redondeadas (sin deriva)."""
    r = lambda q: np.round(q, DECIMALES)
    partes = []
    for ini, segs in curvas:
        cur = r(ini)
        trozos = ["M" + unir(cur)]
        ultimo = None
        for s in segs:
            if s[0] == "L":
                p = r(s[1])
                d = p - cur
                if abs(d[0]) < 1e-9 and abs(d[1]) < 1e-9:
                    continue
                if abs(d[1]) < 1e-9:
                    trozos.append("h" + unir([d[0]])); ultimo = "h"
                elif abs(d[0]) < 1e-9:
                    trozos.append("v" + unir([d[1]])); ultimo = "v"
                else:
                    trozos.append(("" if ultimo == "l" else "l") + (" " if ultimo == "l" else "") + unir(d)); ultimo = "l"
                cur = p
            else:
                c1, c2, p = r(s[1]), r(s[2]), r(s[3])
                vals = list(c1 - cur) + list(c2 - cur) + list(p - cur)
                trozos.append(("" if ultimo == "c" else "c") + (" " if ultimo == "c" else "") + unir(vals)); ultimo = "c"
                cur = p
        trozos.append("z")
        partes.append("".join(trozos).replace(" -", "-"))
    return "".join(partes)


def n_nodos(curvas):
    return sum(len(s) for _, s in curvas)


def svg(vb, cuerpo, extra=""):
    w, h = vb[2], vb[3]
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{num(vb[0])} {num(vb[1])} {num(w)} {num(h)}"'
            f'{extra}>{cuerpo}</svg>\n')


def validar(ruta):
    ET.parse(ruta)


# ------------------------------------------------------------- silueta
def silueta_solida(cov_total, mascara, radio=6):
    """Silueta exterior de la garita sin juntas: cierre morfológico del macizo, relleno de
    huecos y un único contorno exterior. Devuelve el campo x4 (suavizado) y su origen."""
    ys, xs = np.nonzero(mascara)
    caja = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
    campo, x0, y0 = campo_x4(cov_total * mascara, caja, pad=radio + 6)
    m = (campo > 0.5).astype(np.uint8)
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * radio * E + 1, 2 * radio * E + 1))
    mc = cv2.morphologyEx(np.pad(m, radio * E + 2), cv2.MORPH_CLOSE, k)[radio * E + 2:-(radio * E + 2),
                                                                         radio * E + 2:-(radio * E + 2)]
    cs, _ = cv2.findContours(mc, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    lleno = np.zeros_like(mc)
    cv2.drawContours(lleno, cs, -1, 1, thickness=cv2.FILLED)
    return cv2.GaussianBlur(lleno.astype(np.float32), (0, 0), sigmaX=3.0), x0, y0


# ------------------------------------------------------------- principal
def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    os.makedirs(MARCA, exist_ok=True)
    im, alfa, visible, cls, medidos, mezcla = cargar()
    H, W = alfa.shape
    P, tintas = piezas(alfa, visible, cls, medidos)
    print("lienzo", W, H, "| píxeles visibles que no son de ninguna tinta:", mezcla)
    print("colores medidos (mediana):", [hexa(m) for m in medidos])

    curvas = {}
    for nombre in ("garita", "punto", "t1", "t2"):
        mask, k = P[nombre]
        par = PARAMS_TEXTO if nombre in ("t1", "t2") else PARAMS
        cv_, campo, org = calcar(alfa, mask, par)
        curvas[nombre] = cv_
        print(f"{nombre:7s} curvas={len(cv_):3d} nodos={n_nodos(cv_):4d}")

    cajas = {n: caja_curvas(c) for n, c in curvas.items()}

    def caja_xywh(b):
        return dict(x=round(b[0], 2), y=round(b[1], 2), w=round(b[2] - b[0], 2), h=round(b[3] - b[1], 2))

    # ---- garita.svg (origen 0,0 en la esquina de la caja; margen 0)
    def pieza(nombres, cajas_):
        x0 = math.floor(min(cajas_[n][0] for n in nombres) * 100) / 100
        y0 = math.floor(min(cajas_[n][1] for n in nombres) * 100) / 100
        trasl = {n: desplazar(curvas[n], -x0, -y0) for n in nombres}
        cx = max(caja_curvas(trasl[n])[2] for n in nombres)
        cy = max(caja_curvas(trasl[n])[3] for n in nombres)
        return x0, y0, math.ceil(cx * 100) / 100, math.ceil(cy * 100) / 100, trasl

    gx, gy, gw, gh, tg = pieza(["garita"], cajas)
    d_g = path_d(tg["garita"])
    open(os.path.join(MARCA, "garita.svg"), "w", encoding="utf-8").write(
        svg((0, 0, gw, gh), f'<path fill="currentColor" fill-rule="evenodd" d="{d_g}"/>'))

    # ---- punto.svg
    px, py, pw, ph, tp = pieza(["punto"], cajas)
    d_p = path_d(tp["punto"])
    open(os.path.join(MARCA, "punto.svg"), "w", encoding="utf-8").write(
        svg((0, 0, pw, ph), f'<path fill="currentColor" fill-rule="evenodd" d="{d_p}"/>'))

    # ---- texto.svg (dos paths, class t1 / t2, sin fill)
    tx, ty, tw, th, tt = pieza(["t1", "t2"], cajas)
    d_t1 = path_d(tt["t1"]); d_t2 = path_d(tt["t2"])
    open(os.path.join(MARCA, "texto.svg"), "w", encoding="utf-8").write(
        svg((0, 0, tw, th), f'<path class="t1" fill-rule="evenodd" d="{d_t1}"/>'
                            f'<path class="t2" fill-rule="evenodd" d="{d_t2}"/>'))

    # ---- logo.svg: lienzo original 0 0 W H con los colores medidos
    f = {n: hexa(medidos[tintas[n]]) for n in tintas}
    d_gl = path_d(curvas["garita"]); d_pl = path_d(curvas["punto"])
    d_t1l = path_d(curvas["t1"]); d_t2l = path_d(curvas["t2"])
    open(os.path.join(MARCA, "logo.svg"), "w", encoding="utf-8").write(
        svg((0, 0, W, H),
            f'<path fill="{f["garita"]}" fill-rule="evenodd" d="{d_gl}"/>'
            f'<path fill="{f["punto"]}" fill-rule="evenodd" d="{d_pl}"/>'
            f'<path fill="{f["t1"]}" fill-rule="evenodd" d="{d_t1l}"/>'
            f'<path fill="{f["t2"]}" fill-rule="evenodd" d="{d_t2l}"/>',
            ' role="img" aria-label="La Garita, casa rural"'))

    # ---- garita-solida.svg (opcional): un solo contorno, sin juntas
    lleno, sx0, sy0 = silueta_solida(alfa, P["garita"][0], radio=RADIO_SOLIDA)
    cs = trazar(lleno, sx0, sy0, PARAMS_SOLIDA)
    assert len(cs) == 1, f"la silueta debería ser un solo contorno y salen {len(cs)}"
    sb = caja_curvas(cs)
    sdx = math.floor(sb[0] * 100) / 100; sdy = math.floor(sb[1] * 100) / 100
    cs_t = desplazar(cs, -sdx, -sdy)
    sb2 = caja_curvas(cs_t)
    sw, sh = math.ceil(sb2[2] * 100) / 100, math.ceil(sb2[3] * 100) / 100
    open(os.path.join(MARCA, "garita-solida.svg"), "w", encoding="utf-8").write(
        svg((0, 0, sw, sh), f'<path fill="currentColor" d="{path_d(cs_t)}"/>'))

    for fn in ("garita", "garita-solida", "punto", "texto", "logo"):
        validar(os.path.join(MARCA, fn + ".svg"))

    # ---- geometria.json
    geo = dict(
        lienzo=dict(w=W, h=H, viewBox=f"0 0 {W} {H}",
                    nota="1 unidad = 1 px del PNG original (LOGO_LA_GARITA_CUADRADO.png); origen 0,0 = esquina superior izquierda"),
        garita=dict(archivo="garita.svg", viewBox=f"0 0 {txt(gw)} {txt(gh)}", caja=caja_xywh((gx, gy, gx + gw, gy + gh)),
                    transform=f"translate({txt(gx)} {txt(gy)})", color_original=f["garita"]),
        garita_solida=dict(archivo="garita-solida.svg", viewBox=f"0 0 {txt(sw)} {txt(sh)}",
                           caja=caja_xywh((sdx, sdy, sdx + sw, sdy + sh)), transform=f"translate({txt(sdx)} {txt(sdy)})"),
        punto=dict(archivo="punto.svg", viewBox=f"0 0 {txt(pw)} {txt(ph)}", caja=caja_xywh((px, py, px + pw, py + ph)),
                   transform=f"translate({txt(px)} {txt(py)})", color_original=f["punto"],
                   nota="mota de tinta oscura bajo la base de la garita; está en logo.svg, no en garita.svg"),
        texto=dict(archivo="texto.svg", viewBox=f"0 0 {txt(tw)} {txt(th)}", caja=caja_xywh((tx, ty, tx + tw, ty + th)),
                   transform=f"translate({txt(tx)} {txt(ty)})",
                   renglones=dict(
                       t1=dict(texto="La garita", caja=caja_xywh(cajas["t1"]), color_original=f["t1"],
                               caja_en_texto_svg=caja_xywh((cajas["t1"][0] - tx, cajas["t1"][1] - ty, cajas["t1"][2] - tx, cajas["t1"][3] - ty))),
                       t2=dict(texto="CASA RURAL", caja=caja_xywh(cajas["t2"]), color_original=f["t2"],
                               caja_en_texto_svg=caja_xywh((cajas["t2"][0] - tx, cajas["t2"][1] - ty, cajas["t2"][2] - tx, cajas["t2"][3] - ty))))),
        logo_svg=dict(archivo="logo.svg", viewBox=f"0 0 {W} {H}",
                      nota="garita.svg y texto.svg casan sobre logo.svg con el transform indicado en cada uno"),
    )
    json.dump(geo, open(os.path.join(MARCA, "geometria.json"), "w", encoding="utf-8"), indent=2, ensure_ascii=False)

    # ---- colores.json
    L = {n: luminancia_relativa(medidos[tintas[n]]) for n in tintas}
    blanco = 1.0
    col = dict(
        fondo=dict(tipo="transparente", descripcion="El PNG original es RGBA con fondo transparente (alfa 0; los píxeles transparentes llevan RGB blanco 255,255,255). El JPG rectangular del cliente tiene fondo blanco. Pensado para fondo claro.",
                   referencia_blanco="#FFFFFF"),
        metodo="mediana del RGB de los píxeles con alfa 255 de cada tinta (las tintas son planas: todos los píxeles opacos de cada una son idénticos)",
        garita=dict(hex=hexa(medidos[tintas["garita"]]), rgb=[int(v) for v in medidos[tintas["garita"]]],
                    luminancia_relativa=round(L["garita"], 4), contraste_sobre_blanco=round(contraste(L["garita"], blanco), 2)),
        la_garita=dict(hex=f["t1"], rgb=[int(v) for v in medidos[tintas["t1"]]],
                       luminancia_relativa=round(L["t1"], 4), contraste_sobre_blanco=round(contraste(L["t1"], blanco), 2),
                       nota="la mota bajo la base de la garita tiene este mismo color"),
        casa_rural=dict(hex=f["t2"], rgb=[int(v) for v in medidos[tintas["t2"]]],
                        luminancia_relativa=round(L["t2"], 4), contraste_sobre_blanco=round(contraste(L["t2"], blanco), 2)),
        mota=dict(hex=f["punto"]),
        pixeles_mezcla_entre_tintas=mezcla,
    )
    json.dump(col, open(os.path.join(MARCA, "colores.json"), "w", encoding="utf-8"), indent=2, ensure_ascii=False)
    for n in ("garita", "garita-solida", "punto", "texto", "logo"):
        print(f"{n:14s} {os.path.getsize(os.path.join(MARCA, n + '.svg')):6d} bytes")


if __name__ == "__main__":
    main()
