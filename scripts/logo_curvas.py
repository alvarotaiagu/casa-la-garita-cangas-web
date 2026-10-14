"""Contorno subpíxel y ajuste de Bézier cúbicas (Schneider, «An Algorithm for
Automatically Fitting Digitized Curves», Graphics Gems 1990).

Adaptado de hotel-rural-neixon-boiro-web/scripts/curvas.py (sin lo específico de letras
rectas). Se usa en lugar de potrace porque potracer, a mucho aumento, deja facetas
(escalones de píxel convertidos en tramos rectos) y rectas falsas en las curvas suaves.

Formato de salida común con logo.py: lista de curvas cerradas
    (inicio, [("L", p) | ("C", c1, c2, p), ...])
con puntos numpy (x, y) en las mismas unidades que los puntos de entrada.
"""
import math

import cv2
import numpy as np
from scipy.ndimage import gaussian_filter1d, map_coordinates


# ------------------------------------------------------------- contorno
def contornos_subpixel(mask, campo, x0, y0, suavizado=1.5, paso=1.0):
    """Contornos (exterior y huecos) de una máscara recortada, refinados al
    nivel 0,5 del campo continuo `campo` (imagen completa) y suavizados.
    Coordenadas continuas de la imagen completa (el píxel i ocupa [i, i+1]).
    Devuelve lista de arrays Nx2, exterior primero."""
    m8 = np.pad(mask.astype(np.uint8), 2)
    cs, jer = cv2.findContours(m8, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    out = []
    orden = sorted(range(len(cs)), key=lambda k: -abs(cv2.contourArea(cs[k])))
    for k in orden:
        c = cs[k][:, 0, :].astype(float)
        if len(c) < 12:
            continue
        p = c + np.array([x0 - 2 + 0.5, y0 - 2 + 0.5])  # centro del píxel
        # remuestreo uniforme
        p = remuestrear(p, paso)
        # normal desde la tangente suavizada
        ps = gaussian_filter1d(p, 3, axis=0, mode="wrap")
        t = np.roll(ps, -1, 0) - np.roll(ps, 1, 0)
        t /= np.maximum(np.hypot(t[:, 0], t[:, 1]), 1e-9)[:, None]
        nrm = np.c_[t[:, 1], -t[:, 0]]
        # buscar el cruce 0,5 del campo a lo largo de la normal
        ts = np.linspace(-2.5, 2.5, 51)
        q = p[:, None, :] + ts[None, :, None] * nrm[:, None, :]
        vals = map_coordinates(campo, [q[..., 1].ravel() - 0.5, q[..., 0].ravel() - 0.5],
                               order=1, mode="nearest").reshape(q.shape[:2])
        dentro = vals > 0.5
        nuevo = p.copy()
        for i in range(len(p)):
            v = vals[i]
            cruces = np.nonzero(dentro[i, :-1] != dentro[i, 1:])[0]
            if len(cruces) == 0:
                continue
            j = cruces[np.argmin(np.abs(ts[cruces] + 0.05))]
            a, b = v[j], v[j + 1]
            f = (0.5 - a) / (b - a) if b != a else 0.5
            nuevo[i] = p[i] + (ts[j] + f * (ts[j + 1] - ts[j])) * nrm[i]
        nuevo = gaussian_filter1d(nuevo, suavizado, axis=0, mode="wrap") if suavizado > 0 else nuevo
        out.append(nuevo)
    return out


def remuestrear(p, paso):
    q = np.vstack([p, p[:1]])
    seg = np.hypot(*np.diff(q, axis=0).T)
    s = np.r_[0, np.cumsum(seg)]
    n = max(8, int(round(s[-1] / paso)))
    u = np.linspace(0, s[-1], n, endpoint=False)
    return np.c_[np.interp(u, s, q[:, 0]), np.interp(u, s, q[:, 1])]


# ------------------------------------------------------------- esquinas
def esquinas(p, ventana, umbral_grados):
    """Índices de puntos donde la dirección gira más de `umbral` entre los
    `ventana` puntos anteriores y los siguientes (máximos locales)."""
    n = len(p)
    a = p - np.roll(p, ventana, 0)
    b = np.roll(p, -ventana, 0) - p
    ang = np.degrees(np.abs(np.arctan2(a[:, 0] * b[:, 1] - a[:, 1] * b[:, 0], (a * b).sum(1))))
    res = []
    for i in range(n):
        if ang[i] < umbral_grados:
            continue
        vec = [ang[(i + d) % n] for d in range(-ventana, ventana + 1)]
        if ang[i] >= max(vec) and (i - 1) % n not in res:
            res.append(i)
    return res, ang


# ------------------------------------------------------------- Schneider
def _bez(ctrl, t):
    t = np.asarray(t)[:, None]
    p0, p1, p2, p3 = ctrl
    return ((1 - t) ** 3) * p0 + 3 * ((1 - t) ** 2) * t * p1 + 3 * (1 - t) * t * t * p2 + t ** 3 * p3


def _bez_d1(ctrl, t):
    t = np.asarray(t)[:, None]
    p0, p1, p2, p3 = ctrl
    return 3 * ((1 - t) ** 2) * (p1 - p0) + 6 * (1 - t) * t * (p2 - p1) + 3 * t * t * (p3 - p2)


def _bez_d2(ctrl, t):
    t = np.asarray(t)[:, None]
    p0, p1, p2, p3 = ctrl
    return 6 * (1 - t) * (p2 - 2 * p1 + p0) + 6 * t * (p3 - 2 * p2 + p1)


def _cuerda(pts):
    d = np.r_[0, np.cumsum(np.hypot(*np.diff(pts, axis=0).T))]
    return d / d[-1] if d[-1] > 0 else d


def _genera(pts, u, t1, t2):
    p0, p3 = pts[0], pts[-1]
    A1 = (3 * (1 - u) ** 2 * u)[:, None] * t1
    A2 = (3 * (1 - u) * u ** 2)[:, None] * t2
    C = np.array([[(A1 * A1).sum(), (A1 * A2).sum()], [(A1 * A2).sum(), (A2 * A2).sum()]])
    base = _bez([p0, p0, p3, p3], u)
    tmp = pts - base
    X = np.array([(A1 * tmp).sum(), (A2 * tmp).sum()])
    det = C[0, 0] * C[1, 1] - C[0, 1] * C[1, 0]
    seg = np.hypot(*(p3 - p0))
    if abs(det) > 1e-12:
        a1 = (X[0] * C[1, 1] - X[1] * C[0, 1]) / det
        a2 = (C[0, 0] * X[1] - C[1, 0] * X[0]) / det
    else:
        a1 = a2 = seg / 3
    eps = 1e-6 * seg
    if a1 < eps or a2 < eps or a1 > 2 * seg or a2 > 2 * seg:
        a1 = a2 = seg / 3
    return [p0, p0 + a1 * t1, p3 + a2 * t2, p3]


def _newton(ctrl, pts, u):
    d = _bez(ctrl, u) - pts
    d1 = _bez_d1(ctrl, u)
    d2 = _bez_d2(ctrl, u)
    num = (d * d1).sum(1)
    den = (d1 * d1).sum(1) + (d * d2).sum(1)
    with np.errstate(divide="ignore", invalid="ignore"):
        nu = np.where(np.abs(den) > 1e-12, u - num / den, u)
    return np.clip(nu, 0, 1)


def _error(ctrl, pts, u):
    d = np.hypot(*(_bez(ctrl, u) - pts).T)
    i = int(np.argmax(d))
    return d[i], i


def _unit(v):
    n = np.hypot(*v)
    return v / n if n > 1e-12 else v


def ajustar_tramo(pts, t1, t2, tol):
    """Bézier que pasan por pts[0] y pts[-1] con tangentes t1 (salida) y t2 (llegada, apuntando hacia atrás)."""
    if len(pts) == 2:
        dist = np.hypot(*(pts[1] - pts[0])) / 3
        return [[pts[0], pts[0] + t1 * dist, pts[1] + t2 * dist, pts[1]]]
    u = _cuerda(pts)
    ctrl = _genera(pts, u, t1, t2)
    err, k = _error(ctrl, pts, u)
    if err < tol:
        return [ctrl]
    if err < tol * 4:
        for _ in range(20):
            u = _newton(ctrl, pts, u)
            ctrl = _genera(pts, u, t1, t2)
            err, k = _error(ctrl, pts, u)
            if err < tol:
                return [ctrl]
    k = min(max(k, 1), len(pts) - 2)
    tc = _unit(pts[k - 1] - pts[k + 1]) if k + 1 < len(pts) else _unit(pts[k - 1] - pts[k])
    # tangente central suavizada con más vecinos (menos ruido)
    a = max(0, k - 3); b = min(len(pts) - 1, k + 3)
    tc = _unit(pts[a] - pts[b])
    return ajustar_tramo(pts[:k + 1], t1, tc, tol) + ajustar_tramo(pts[k:], -tc, t2, tol)


def tangente(p, i, w=3):
    n = len(p)
    return _unit(p[(i + w) % n] - p[(i - w) % n])


def ajustar_cerrada(p, tol, cortes=(), recta_tol=None, recta_min=0.0):
    """Ajusta una curva cerrada. `cortes` = índices de esquinas (sin
    continuidad de tangente). Sin esquinas, se corta en 4 puntos repartidos
    con tangente común (G1). Si recta_tol, los tramos entre esquinas casi
    rectos se emiten como rectas."""
    n = len(p)
    esquinas_ = sorted(set(int(c) % n for c in cortes))
    if not esquinas_:
        nodos = [0, n // 4, n // 2, 3 * n // 4]
        suaves = set(nodos)
    else:
        nodos = esquinas_
        suaves = set()
        # tramos largos sin esquina: añadir nodos suaves para ayudar al ajuste
        extra = []
        for a, b in zip(nodos, nodos[1:] + [nodos[0] + n]):
            if b - a > n / 3:
                m = (a + (b - a) // 2) % n
                extra.append(m)
        for m in extra:
            suaves.add(m)
        nodos = sorted(set(nodos) | set(extra))
    segs = []
    inicio = p[nodos[0]]
    for a, b in zip(nodos, nodos[1:] + [nodos[0] + n]):
        idx = np.arange(a, b + 1) % n
        pts = p[idx]
        if a % n in suaves:
            t1 = tangente(p, a % n)
        else:
            t1 = _unit(pts[min(3, len(pts) - 1)] - pts[0])
        if b % n in suaves:
            t2 = -tangente(p, b % n)
        else:
            t2 = _unit(pts[max(0, len(pts) - 4)] - pts[-1])
        if recta_tol is not None and a % n not in suaves and b % n not in suaves:
            ch = pts[-1] - pts[0]
            L = np.hypot(*ch)
            if L > recta_min:
                dist = np.abs(ch[0] * (pts[:, 1] - pts[0, 1]) - ch[1] * (pts[:, 0] - pts[0, 0])) / L
                if dist.max() < recta_tol:
                    segs.append(("L", pts[-1].copy()))
                    continue
        for c in ajustar_tramo(pts, t1, t2, tol):
            segs.append(("C", c[1], c[2], c[3]))
    return (inicio.copy(), segs)
