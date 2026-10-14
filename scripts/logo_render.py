"""Comprobación independiente del calco: Chromium pinta los SVG de marca/ y se compara con el
original. Mide el IoU a x3 de cada pieza (y de cada letra) y guarda las comparaciones.

Uso: python -I scripts/logo_render.py
Deja marca/comparacion-garita.png, comparacion-texto.png, comparacion-logo.png,
comparacion-solida.png y marca/iou.json (lo usa el LEEME).

IoU "a x3": el SVG se rasteriza a x3 (tinta negra sobre blanco, antialias del navegador, corte
al 50 %) y se compara con la cobertura del original (alfa de su tinta) ampliada x3 en bicúbico
y cortada al 50 %. IoU suave a x1: sum(min)/sum(max) entre la cobertura que pinta Chromium a
1x y el alfa del PNG (error de borde sin umbral).

Las piezas se colocan en el lienzo 857x640 exactamente como lo haría la web con
marca/geometria.json (viewBox propio + transform), así que se comprueban los ficheros reales.
"""
import io
import json
import os
import re
import sys
import xml.etree.ElementTree as ET

import cv2
import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from logo import MARCA, cargar, piezas  # noqa: E402

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

S = 3   # escala de la medida
TMP = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_tmp")
os.makedirs(TMP, exist_ok=True)
SVGNS = "{http://www.w3.org/2000/svg}"


def leer(ruta):
    t = open(ruta, encoding="utf-8").read()
    vb = [float(v) for v in re.search(r'viewBox="([^"]+)"', t).group(1).split()]
    inner = re.search(r">(.*)</svg>", t, re.S).group(1)
    return vb, inner


def compuesto(W, H, partes):
    """SVG del tamaño del lienzo con cada pieza (ruta, (dx, dy)) en su sitio. Tinta negra."""
    trozos = []
    for ruta, (dx, dy) in partes:
        vb, inner = leer(ruta)
        inner = inner.replace('fill="currentColor"', 'fill="#000"')
        inner = re.sub(r'fill="#[0-9A-Fa-f]{6}"', 'fill="#000"', inner)
        trozos.append(f'<svg x="{dx}" y="{dy}" width="{vb[2]}" height="{vb[3]}" '
                      f'viewBox="{vb[0]} {vb[1]} {vb[2]} {vb[3]}" overflow="visible">{inner}</svg>')
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">'
            f'<rect width="{W}" height="{H}" fill="#fff"/>{"".join(trozos)}</svg>')


def pintar(pagina, svg_txt, W, H, esc):
    svg_txt = svg_txt.replace(f'width="{W}" height="{H}"', f'width="{W * esc}" height="{H * esc}"', 1)
    pagina.set_viewport_size({"width": W * esc, "height": H * esc})
    pagina.set_content(f"<html><body style='margin:0;background:#fff'>{svg_txt}</body></html>")
    png = pagina.screenshot(clip={"x": 0, "y": 0, "width": W * esc, "height": H * esc})
    g = np.array(Image.open(io.BytesIO(png)).convert("L")).astype(np.float32)
    return 1.0 - g / 255.0   # cobertura 0..1


def iou(a, b):
    return float((a & b).sum() / max(1, (a | b).sum()))


def contorno_rojo(base_rgb, mascara):
    borde = cv2.morphologyEx(mascara.astype(np.uint8), cv2.MORPH_GRADIENT, np.ones((3, 3), np.uint8)) > 0
    out = base_rgb.copy()
    out[borde] = (230, 20, 20)
    return out


def comparacion(R, Rn, cov_big, ruta, caja, vertical=False, reducir=1.0):
    """Original (cobertura x3, con su antialias) con el contorno del SVG en rojo, junto al mapa
    de diferencias: gris = coinciden, rojo = sólo SVG, azul = sólo original."""
    x0, y0, x1, y1 = caja
    r = R[y0:y1, x0:x1]; s = Rn[y0:y1, x0:x1]; c = cov_big[y0:y1, x0:x1]
    base = np.stack([255 - (c * 255).astype(np.uint8)] * 3, -1)
    a = contorno_rojo(base, s)
    d = np.full(r.shape + (3,), 255, np.uint8)
    d[r & s] = (205, 205, 205)
    d[s & ~r] = (230, 40, 40)
    d[r & ~s] = (40, 80, 230)
    if vertical:
        sep = np.full((8, a.shape[1], 3), 90, np.uint8)
        im = np.concatenate([a, sep, d], 0)
    else:
        sep = np.full((a.shape[0], 8, 3), 90, np.uint8)
        im = np.concatenate([a, sep, d], 1)
    im = Image.fromarray(im)
    if reducir != 1.0:
        im = im.resize((int(im.width * reducir), int(im.height * reducir)), Image.LANCZOS)
    im.save(ruta, optimize=True)


def caja_de(R, margen=24):
    ys, xs = np.nonzero(R)
    return (max(0, xs.min() - margen), max(0, ys.min() - margen), xs.max() + margen, ys.max() + margen)


def comprobar_estructura():
    """Reglas que se le prometieron a quien use los SVG."""
    errores = []
    f = lambda n: os.path.join(MARCA, n)
    for n in ("garita", "garita-solida", "punto", "texto", "logo"):
        ET.parse(f(n + ".svg"))   # XML bien formado
    g = ET.parse(f("garita.svg")).getroot()
    paths = [e for e in g.iter() if e.tag == SVGNS + "path"]
    if len(paths) != 1:
        errores.append(f"garita.svg: {len(paths)} paths (debe ser 1)")
    else:
        if paths[0].get("fill") != "currentColor" or paths[0].get("fill-rule") != "evenodd":
            errores.append("garita.svg: fill/fill-rule incorrectos")
    if any(e.get("id") is not None for e in g.iter()):
        errores.append("garita.svg: lleva ids")
    t = ET.parse(f("texto.svg")).getroot()
    tp = [e for e in t.iter() if e.tag == SVGNS + "path"]
    if [e.get("class") for e in tp] != ["t1", "t2"]:
        errores.append("texto.svg: clases t1/t2 incorrectas")
    if any(e.get("fill") is not None for e in tp):
        errores.append("texto.svg: lleva fill fijo")
    l = ET.parse(f("logo.svg")).getroot()
    if l.get("viewBox") != "0 0 857 640":
        errores.append("logo.svg: viewBox " + str(l.get("viewBox")))
    s = ET.parse(f("garita-solida.svg")).getroot()
    sp = [e for e in s.iter() if e.tag == SVGNS + "path"]
    if len(sp) != 1 or sp[0].get("d").count("M") != 1:
        errores.append("garita-solida.svg: no es un solo contorno")
    return errores


def main():
    errores = comprobar_estructura()
    print("estructura:", "OK" if not errores else errores)

    im, alfa, visible, cls, medidos, _ = cargar()
    H, W = alfa.shape
    P, _ = piezas(alfa, visible, cls, medidos)
    geo = json.load(open(os.path.join(MARCA, "geometria.json"), encoding="utf-8"))

    def tr(k):
        return tuple(float(v) for v in re.findall(r"[-\d.]+", geo[k]["transform"]))

    f = lambda n: os.path.join(MARCA, n)

    def ref_pieza(nombres):
        m = np.zeros((H, W), bool)
        for n in nombres:
            m |= P[n][0]
        cov = alfa * m
        return cov, np.clip(cv2.resize(cov, (W * S, H * S), interpolation=cv2.INTER_CUBIC), 0, 1)

    res = {"estructura_ok": not errores, "errores": errores}
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page()

        def medir(nombre, partes, nombres_ref):
            svg_txt = compuesto(W, H, partes)
            ren = pintar(pg, svg_txt, W, H, S)
            ren1 = pintar(pg, svg_txt, W, H, 1)
            cov, big = ref_pieza(nombres_ref)
            R, Rn = big > 0.5, ren > 0.5
            ioux3 = iou(R, Rn)
            suave = float(np.minimum(ren1, cov).sum() / np.maximum(ren1, cov).sum())
            res[nombre] = dict(iou_x3=round(ioux3, 4), iou_suave_x1=round(suave, 4))
            print(f"{nombre:14s} IoU x3 = {ioux3:.4f}   IoU suave x1 = {suave:.4f}")
            return R, Rn, big

        # garita
        R, Rn, big = medir("garita", [(f("garita.svg"), tr("garita"))], ["garita"])
        comparacion(R, Rn, big, f("comparacion-garita.png"), caja_de(R))

        # texto: los dos renglones juntos, y cada uno por separado (el otro path se quita)
        R, Rn, big = medir("texto", [(f("texto.svg"), tr("texto"))], ["t1", "t2"])
        comparacion(R, Rn, big, f("comparacion-texto.png"), caja_de(R), vertical=True)
        Rt, Rnt = R, Rn
        ttxt = open(f("texto.svg"), encoding="utf-8").read()
        for cl, nom in (("t1", "La garita"), ("t2", "CASA RURAL")):
            otro = "t2" if cl == "t1" else "t1"
            tmp = os.path.join(TMP, f"_solo_{cl}.svg")
            open(tmp, "w", encoding="utf-8").write(re.sub(rf'<path class="{otro}"[^>]*/>', "", ttxt))
            try:
                medir(nom, [(tmp, tr("texto"))], [cl])
            finally:
                os.remove(tmp)

        medir("mota", [(f("punto.svg"), tr("punto"))], ["punto"])

        # logo completo (logo.svg, con sus colores medidos pasados a negro)
        R, Rn, big = medir("logo.svg", [(f("logo.svg"), (0, 0))], ["garita", "punto", "t1", "t2"])
        comparacion(R, Rn, big, f("comparacion-logo.png"), (0, 0, W * S, H * S), vertical=True, reducir=2 / 3)

        # garita-solida: no es un calco, sino derivada; se comprueba que cubre todo el macizo
        ren_s = pintar(pg, compuesto(W, H, [(f("garita-solida.svg"), tr("garita_solida"))]), W, H, S) > 0.5
        _, big_g = ref_pieza(["garita"])
        Rg = big_g > 0.5
        res["garita-solida"] = dict(
            macizo_cubierto=round(float((Rg & ren_s).sum() / Rg.sum()), 4),
            area_sobre_macizo=round(float(ren_s.sum() / Rg.sum()), 3))
        comparacion(Rg, ren_s, big_g, f("comparacion-solida.png"), caja_de(Rg))
        print("garita-solida", res["garita-solida"])
        b.close()

    # IoU por letra: cada componente conexa del original frente al texto pintado (a x3)
    letras = {}
    for cl in ("t1", "t2"):
        lab_n, lab, st, _ = (lambda r: (r[0], r[1], r[2], r[3]))(
            cv2.connectedComponentsWithStats(P[cl][0].astype(np.uint8), connectivity=8))
        lista = []
        _, big_cl = ref_pieza([cl])
        Rcl = big_cl > 0.5
        for i in range(1, lab_n):
            x, y, w, h = [int(v) for v in st[i, :4]]
            xa, ya = max(0, x - 2), max(0, y - 2)
            xb, yb = min(W, x + w + 2), min(H, y + h + 2)
            m3 = np.zeros((H, W), np.uint8)
            m3[lab == i] = 1
            sub_ref = Rcl[ya * S:yb * S, xa * S:xb * S]
            zona = cv2.resize(cv2.dilate(m3, np.ones((5, 5), np.uint8))[ya:yb, xa:xb],
                              (sub_ref.shape[1], sub_ref.shape[0]), interpolation=cv2.INTER_NEAREST) > 0
            sub_ren = Rnt[ya * S:yb * S, xa * S:xb * S]
            lista.append(dict(caja=[x, y, w, h], iou_x3=round(iou(sub_ref & zona, sub_ren & zona), 4)))
        letras[cl] = lista
    res["componentes"] = letras
    json.dump(res, open(f("iou.json"), "w", encoding="utf-8"), indent=2, ensure_ascii=False)
    for cl, lista in letras.items():
        v = sorted(c["iou_x3"] for c in lista)
        print(cl, "componentes:", len(v), "min", v[0], "mediana", v[len(v) // 2], "max", v[-1])


if __name__ == "__main__":
    main()
