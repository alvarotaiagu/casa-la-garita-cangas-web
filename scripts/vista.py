# -*- coding: utf-8 -*-
"""Render rapido de datos/ria.json a datos/ria-vista.png para comprobar la costa a ojo.
Uso (desde scripts, con python -I):  python -I vista.py"""
import sys, os, json, math
sys.stdout.reconfigure(encoding="utf-8")
import numpy as np
from PIL import Image, ImageDraw, ImageFont

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
J = json.load(open(os.path.join(RAIZ, "datos", "ria.json"), encoding="utf-8"))
caja = J["caja"]
W_PX = 2800
s = W_PX / (caja["x1"] - caja["x0"])
H_PX = int((caja["y1"] - caja["y0"]) * s)
tr = lambda x, y: ((x - caja["x0"]) * s, (y - caja["y0"]) * s)


def pares(flat):
    return [tr(flat[i], flat[i + 1]) for i in range(0, len(flat), 2)]


# ---- tierra: se cierran las cadenas de costa (tierra a la izquierda) siguiendo el borde de la caja de recorte
X0, Y0, X1, Y1 = caja["x0"] - 800, caja["y0"] - 800, caja["x1"] + 800, caja["y1"] + 800
Wc, Hc = X1 - X0, Y1 - Y0


def param(x, y):
    """posicion en el perimetro, recorrido: abajo hacia el este, derecha hacia el norte (y decrece), arriba hacia el oeste, izquierda hacia el sur."""
    tol = 3
    if abs(y - Y1) <= tol: return (x - X0)
    if abs(x - X1) <= tol: return Wc + (Y1 - y)
    if abs(y - Y0) <= tol: return Wc + Hc + (X1 - x)
    if abs(x - X0) <= tol: return 2 * Wc + Hc + (y - Y0)
    return None


def esquina(t):
    t %= 2 * (Wc + Hc)
    if t < Wc: return (X0 + t, Y1)
    if t < Wc + Hc: return (X1, Y1 - (t - Wc))
    if t < 2 * Wc + Hc: return (X1 - (t - Wc - Hc), Y0)
    return (X0, Y0 + (t - 2 * Wc - Hc))


abiertas, anillos = [], []
for c in J["costa"]:
    pts = [(c[i], c[i + 1]) for i in range(0, len(c), 2)]
    if pts[0] == pts[-1]:
        anillos.append(pts)
    else:
        abiertas.append(pts)
polis = []
usada = [False] * len(abiertas)
inicios = sorted((param(*p[0]), i) for i, p in enumerate(abiertas) if param(*p[0]) is not None)
P_TOT = 2 * (Wc + Hc)
for i0 in range(len(abiertas)):
    if usada[i0] or param(*abiertas[i0][0]) is None or param(*abiertas[i0][-1]) is None:
        continue
    poli, i = [], i0
    while not usada[i]:
        usada[i] = True
        poli += abiertas[i]
        te = param(*abiertas[i][-1])
        cand = sorted(((ts - te) % P_TOT, j) for ts, j in inicios)
        dist, j = cand[0]
        esq = [0, Wc, Wc + Hc, 2 * Wc + Hc]
        for e in sorted(esq, key=lambda e: (e - te) % P_TOT):
            if 0 < (e - te) % P_TOT < dist:
                poli.append(esquina(e))
        i = j
    polis.append(poli)
print("poligonos de tierra:", len(polis), "anillos:", len(anillos), "abiertas sin cerrar:", sum(1 for u in usada if not u))
SC = s
TIERRA, MAR = (236, 230, 214), (176, 205, 222)
big = Image.new("RGB", (int(Wc * SC), int(Hc * SC)), MAR)
bd = ImageDraw.Draw(big)
tb = lambda x, y: ((x - X0) * SC, (y - Y0) * SC)
for poli in polis:
    bd.polygon([tb(*p) for p in poli], fill=TIERRA)
for r in anillos:
    area = sum(r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1] for i in range(len(r) - 1))
    # y hacia el sur: tierra a la izquierda => area (en pantalla) negativa
    bd.polygon([tb(*p) for p in r], fill=TIERRA if area < 0 else MAR)
ox, oy = (caja["x0"] - X0) * SC, (caja["y0"] - Y0) * SC
im = big.crop((int(ox), int(oy), int(ox) + W_PX, int(oy) + H_PX)).convert("RGBA")

# manchas urbanas encima de la tierra (traslucidas)
cap = Image.new("RGBA", im.size, (0, 0, 0, 0))
cd = ImageDraw.Draw(cap)
for u in J.get("urbano", []):
    cd.polygon(pares(u), fill=(205, 190, 165, 150))
for a in J.get("agua", []):
    cd.polygon(pares(a), fill=(176, 205, 222, 255))
im = Image.alpha_composite(im, cap).convert("RGB")
dr = ImageDraw.Draw(im)
try:
    f = ImageFont.truetype("arial.ttf", 22); fb = ImageFont.truetype("arialbd.ttf", 26); fs = ImageFont.truetype("arial.ttf", 18); fn = ImageFont.truetype("ariali.ttf", 17)
except Exception:
    f = fb = fs = fn = ImageFont.load_default()

for r in J["rios"]:
    dr.line(pares(r), fill=(90, 140, 190), width=2)
col = {"motorway": ((200, 90, 60), 5), "trunk": ((210, 120, 60), 4), "primary": ((190, 150, 70), 3), "secondary": ((150, 140, 120), 2), "tertiary": ((190, 185, 170), 1)}
for c in reversed(J["carreteras"]):
    cc, w = col[c["nivel"]]
    dr.line(pares(c["p"]), fill=cc, width=w)
for c in J["costa"]:
    dr.line(pares(c), fill=(40, 60, 80), width=2)
# bateas
b = J.get("bateas", [])
for i in range(0, len(b), 2):
    x, y = tr(b[i], b[i + 1])
    dr.rectangle([x - 2, y - 2, x + 2, y + 2], fill=(120, 80, 40))


def raya(pts, color, w=3, on=14, off=10):
    """linea discontinua"""
    acc = 0.0; pintar = True
    for (ax, ay), (bx, by) in zip(pts, pts[1:]):
        L = math.hypot(bx - ax, by - ay)
        t = 0.0
        while t < L:
            paso = min((on if pintar else off) - acc, L - t)
            if pintar:
                dr.line([(ax + (bx - ax) * t / L, ay + (by - ay) * t / L), (ax + (bx - ax) * (t + paso) / L, ay + (by - ay) * (t + paso) / L)], fill=color, width=w)
            t += paso; acc += paso
            if acc >= (on if pintar else off) - 1e-9:
                acc = 0.0; pintar = not pintar


for bc in J.get("barcos", []):
    raya(pares(bc["p"]), (30, 90, 170), 3)
rv = (J.get("rutas") or {}).get("vigoCoche")
if rv:
    raya(pares(rv), (200, 30, 60), 3, 18, 8)

# rejilla 5 km
for k in range(-30, 31):
    gx = k * 5000
    if caja["x0"] < gx < caja["x1"]:
        x, _ = tr(gx, 0); dr.line([(x, 0), (x, H_PX)], fill=(205, 205, 205), width=1)
    if caja["y0"] < gx < caja["y1"]:
        _, y = tr(0, gx); dr.line([(0, y), (W_PX, y)], fill=(205, 205, 205), width=1)

ocupado = []


def pon(x, y, txt, font, fill, dx=14, dy=-12):
    """etiqueta con 4 posiciones candidatas para no pisarse"""
    w = dr.textlength(txt, font=font)
    h = font.size + 4
    cands = [(x + dx, y + dy), (x - dx - w, y + dy), (x - w / 2, y - h - 8), (x - w / 2, y + 10)]
    for cx, cy in cands:
        r = (cx, cy, cx + w, cy + h)
        if r[0] < 4 or r[2] > W_PX - 4 or r[1] < 4 or r[3] > H_PX - 30:
            continue
        if any(not (r[2] < o[0] or o[2] < r[0] or r[3] < o[1] or o[3] < r[1]) for o in ocupado):
            continue
        ocupado.append(r)
        dr.text((cx, cy), txt, font=font, fill=fill, stroke_width=3, stroke_fill=(255, 255, 255))
        return
    cx, cy = cands[0]
    dr.text((cx, cy), txt, font=font, fill=fill, stroke_width=3, stroke_fill=(255, 255, 255))


tcol = {"playa": (230, 160, 30), "puerto": (30, 90, 170), "ciudad": (40, 40, 40), "isla": (30, 120, 90), "bateas": (120, 80, 40), "mirador": (140, 60, 140), "patrimonio": (150, 60, 40), "naturaleza": (40, 130, 60)}
hx, hy = tr(0, 0)
ocupado.append((hx - 40, hy - 40, hx + 40 + 330, hy + 40))
for L in J["lugares"]:
    x, y = tr(L["x"], L["y"])
    c = tcol.get(L["tipo"], (0, 0, 0))
    dr.ellipse([x - 9, y - 9, x + 9, y + 9], fill=c, outline="white", width=2)
    if L["modo"] == "barco":
        et = L["nombre"] + "  (barco)"
        if L.get("alEmbarcadero"):
            et += " a pie al muelle %d min" % L["alEmbarcadero"]["min"]
    else:
        et = L["nombre"] + "  %.1f km / %d min %s" % (L["km"], L["min"], L["modo"])
    if L.get("extra"):
        et += " [extra]"
    pon(x, y, et, fs, (0, 0, 0))
for n in J.get("nucleos", []):
    x, y = tr(n["x"], n["y"])
    dr.ellipse([x - 3, y - 3, x + 3, y + 3], fill=(90, 90, 90))
    pon(x, y, n["nombre"], fn, (70, 70, 70), 6, -22)
dr.polygon([(hx, hy - 22), (hx + 7, hy - 7), (hx + 22, hy - 7), (hx + 10, hy + 3), (hx + 14, hy + 19), (hx, hy + 9), (hx - 14, hy + 19), (hx - 10, hy + 3), (hx - 22, hy - 7), (hx - 7, hy - 7)], fill=(220, 0, 90), outline="white")
dr.text((hx + 26, hy - 34), "CASA RURAL LA GARITA", font=fb, fill=(220, 0, 90), stroke_width=3, stroke_fill=(255, 255, 255))
dr.text((20, H_PX - 34), "(c) OpenStreetMap (ODbL) - rejilla cada 5 km - caja %d x %d m - azul discontinuo: barcos; rojo discontinuo: coche a Vigo" % (caja["x1"] - caja["x0"], caja["y1"] - caja["y0"]), font=f, fill=(60, 60, 60))
im.save(os.path.join(RAIZ, "datos", "ria-vista.png"), optimize=True)
print("png", im.size)


# comprobacion numerica: de que lado de la costa (OSM: tierra a la izquierda) cae cada lugar
def lado(x, y):
    mejor = None
    for c in J["costa"]:
        for i in range(0, len(c) - 3, 2):
            ax, ay, bx, by = c[i], c[i + 1], c[i + 2], c[i + 3]
            dx, dy = bx - ax, by - ay
            L2 = dx * dx + dy * dy or 1
            t = max(0, min(1, ((x - ax) * dx + (y - ay) * dy) / L2))
            qx, qy = ax + t * dx, ay + t * dy
            d = math.hypot(x - qx, y - qy)
            if mejor is None or d < mejor[0]:
                mejor = (d, dx, dy, ax, ay)
    d, dx, dy, ax, ay = mejor
    izq = (x - ax) * dy + (y - ay) * (-dx)   # producto con la normal izquierda (dy,-dx)
    return d, "tierra" if izq > 0 else "mar"


print("lado de la costa por lugar (distancia a la costa m):")
for L in J["lugares"]:
    d, l = lado(L["x"], L["y"])
    print("  %-16s %-6s %5d m  %s" % (L["id"], l, d, "(barco)" if L["modo"] == "barco" else ""))
d, l = lado(0, 0)
print("  %-16s %-6s %5d m" % ("CASA", l, d))
