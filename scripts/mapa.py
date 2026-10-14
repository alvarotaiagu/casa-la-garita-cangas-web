# -*- coding: utf-8 -*-
"""
Lamina de la ria de Vigo para Casa Rural La Garita (Rodeira, Cangas do Morrazo).
Saca de OpenStreetMap (Overpass + OSRM) costa, agua, carreteras, nucleos y lugares, los proyecta a
metros desde la casa y escribe js/ria.js (window.RIA) y datos/ria.json (consultas, rutas, dudas).

Uso (desde la carpeta scripts, con python -I):
    python -I mapa.py            # todo (usa la cache de Overpass si existe)
    python -I vista.py           # render rapido datos/ria-vista.png
Variable GARITA_CACHE: carpeta de cache de Overpass (por defecto scripts/.cache).
Las respuestas de OSRM se guardan tambien en la cache (osrm_*.json) para repetir sin red.
"""
import sys, os, json, math, time, hashlib, urllib.request

sys.stdout.reconfigure(encoding="utf-8")
AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
from ovp import overpass, CACHE, UA  # noqa

RAIZ = os.path.dirname(AQUI)
FECHA = "2026-10-14"
# pin de su web: 42°15'33.9"N 8°45'54.6"W
PIN_WEB = (42 + 15 / 60 + 33.9 / 3600, -(8 + 45 / 60 + 54.6 / 3600))
ORIGEN_NODO = 4637733182  # "La Garita" (tourism=guest_house) en OSM

# caja que se dibuja (grados): S, W, N, E
CAJA_GEO = (42.170, -8.935, 42.300, -8.640)   # Cies al oeste, puente de Rande al este
# caja de descarga: algo mayor, para que las vias que cruzan el borde lleguen enteras
D = 0.012
DESCARGA = (CAJA_GEO[0] - D, CAJA_GEO[1] - D, CAJA_GEO[2] + D, CAJA_GEO[3] + D)

# simplificacion (metros)
EPS_COSTA_CERCA, EPS_COSTA_LEJOS, RADIO_CERCA = 6, 28, 3000
EPS_RD = 30
EPS_URBANO = 40
URBANO_MIN_M2 = 50000

# ---------------------------------------------------------------- lugares
# (id, nombre es, nombre gl, tipo, ref OSM, extras)
#   punto:  "borde" -> vertice del contorno mas cercano al centro del poligono (no cae en el agua)
#   ruta_a: "cerca" -> los minutos se miden hasta el vertice del contorno mas cercano a la casa
#   modo:   "barco" -> sin minutos en coche; los pone el cliente desde la naviera
#   dest:   (tipo,id) -> en los de barco, el embarcadero al que se calcula el paseo a pie
#   extra:  True    -> lugar que no cita la web del cliente (se marca «extra»)
TERMINAL_CANGAS = ("way", 237726324)   # «Estacion Maritima», Naviera Mar de Ons, Cangas
LUGARES = [
    ("rodeira", "Playa de Rodeira", "Praia de Rodeira", "playa", ("way", 107686353),
     {"punto": "borde", "ruta_a": "cerca",
      "nota": "la casa esta en el extremo este del arenal (el poligono de la playa empieza a unos 30 m del nodo de la casa); los minutos son hasta el arenal mas cercano y el punto del mapa, el centro de la playa"}),
    ("alemanes", "Playa de los Alemanes (de las Ratas)", "Praia dos Alemáns (das Ratas)", "playa", ("way", 107686352),
     {"punto": "borde", "ruta_a": "cerca",
      "nota": "en OSM la playa es una sola: name=Praia dos Alemans, alt_name=Praia das Ratas; no hay una playa de las Ratas aparte"}),
    ("canaval", "Playa de Canabal", "Praia do Canaval", "playa", ("way", 107686351),
     {"punto": "borde", "ruta_a": "cerca", "nota": "en OSM se escribe «Canaval» (Praia do Canaval)"}),
    ("cangas-centro", "Cangas (centro)", "Cangas (centro)", "ciudad", ("way", 180273285),
     {"nota": "punto = Concello de Cangas de Morrazo, en la calle peatonal junto al puerto (el nodo place=town cae 120 m al norte)"}),
    ("cangas-puerto", "Puerto de Cangas (embarcadero)", "Porto de Cangas (embarcadoiro)", "puerto", TERMINAL_CANGAS,
     {"nota": "Estacion Maritima de la Naviera Mar de Ons: de aqui salen los barcos a Vigo y a las Illas Cies"}),
    ("moana", "Moaña", "Moaña", "ciudad", ("node", 1263362733), {}),
    ("vigo", "Vigo (Estación Marítima)", "Vigo (Estación Marítima)", "ciudad", ("node", 430099399),
     {"modo": "barco", "dest": TERMINAL_CANGAS,
      "nota": "Estacion Maritima de Ria de Vigo, donde atraca el barco de Cangas (OSM: ruta Vigo - Cangas de Morrazo, Naviera Mar de Ons); por carretera se rodea la ria, ver comprobaciones"}),
    ("cies", "Illas Cíes", "Illas Cíes", "isla", ("node", 10246697684),
     {"modo": "barco", "dest": TERMINAL_CANGAS,
      "nota": "punto = Porto de Cies (Peirao do Almacen, isla de Monteagudo/Faro); se va en barco desde Cangas, no hay carretera"}),
    ("bateas", "Bateas de la ría", "Bateas da ría", "bateas", ("bateas", 0),
     {"modo": "barco", "dest": TERMINAL_CANGAS,
      "nota": "zona de bateas (man_made=mussel_raft) mas cercana a Rodeira; OSM tiene ademas la ruta turistica «Ruta do Mexillon» (Piratas de Nabia) de Cangas a Moaña por entre las bateas"}),
    # ---- extras (no los cita la web)
    ("mona", "Miradoiro do Monte da Mona", "Miradoiro do Monte da Mona", "mirador", ("node", 8121258677),
     {"extra": True, "nota": "mirador de OSM (tourism=viewpoint) en el camino de costa hacia Moaña; no es «Punta Rodeira», que OSM no tiene"}),
    ("hio", "Cruceiro del Hío", "Cruceiro do Hío", "patrimonio", ("node", 2322010422), {"extra": True}),
    ("facho", "Monte do Facho (Donón)", "Monte do Facho (Donón)", "naturaleza", ("node", 4871467166),
     {"extra": True, "nota": "OSM lo tiene como peak «O Facho de Donon» (node/4871467166); hay otros nodos del mismo sitio: «Monte Facho» (node/13807013532), la Capela do Facho (way/1051895924) y el Petroglifo do Facho"}),
    ("cabo-home", "Cabo Home", "Cabo Home", "naturaleza", ("node", 679160620),
     {"extra": True, "nota": "cabo (natural=cape) con el Faro de Cabo Home (node/679182350) a 50 m; el «Miradoiro de Cabo Home» y el restaurante de OSM estan 2 km al norte, en Donon"}),
]
# nodos place cuyo nombre se dibuja en la lamina (el resto va a datos/ria.json por si hace falta)
NUCLEOS_ELEGIDOS = {"Vigo", "Cangas de Morrazo", "Moaña", "Bouzas", "Donón", "Nerga", "Liméns"}
# cifras de la web del cliente que se comprueban con OSRM: clave -> (que, ref OSM, perfiles)
REFS_COMPROBACION = {
    "cangasPueblo": ("Cangas: nodo place=town (centro del pueblo en OSM)", ("node", 247711726), ["foot", "car"]),
    "vigoCentro": ("Vigo: nodo place=city (centro de Vigo en OSM)", ("node", 84550790), ["car"]),
    "vigoEstacion": ("Vigo: Estacion Maritima de Ria (donde atraca el barco)", ("node", 430099399), ["car"]),
}

consultas = []  # (descripcion, texto) para el JSON


def ovp(desc, q):
    consultas.append({"para": desc, "consulta": q})
    return overpass(q)


def ovp_teselas(desc, filtro, caja, nx, ny, extra=""):
    """Overpass se atraganta con cajas grandes: se parte en teselas y se deduplican las vias por id."""
    S, W, N, E = caja
    vistos, elementos = set(), []
    ejemplo = None
    for i in range(ny):
        for k in range(nx):
            s, n = S + (N - S) * i / ny, S + (N - S) * (i + 1) / ny
            w, e = W + (E - W) * k / nx, W + (E - W) * (k + 1) / nx
            q = "[out:json][timeout:120];%s(%.4f,%.4f,%.4f,%.4f)%s;out body geom;" % (filtro, s, w, n, e, extra)
            ejemplo = ejemplo or q
            j = overpass(q)
            print("  tesela %d,%d: %d elementos" % (i, k, len(j["elements"])), flush=True)
            for el in j["elements"]:
                if (el["type"], el["id"]) not in vistos:
                    vistos.add((el["type"], el["id"])); elementos.append(el)
    consultas.append({"para": desc + " (en %dx%d teselas; se muestra la primera)" % (nx, ny), "consulta": ejemplo})
    return {"elements": elementos}


# ---------------------------------------------------------------- geometria
def proy(lat, lon, lat0, lon0):
    return ((lon - lon0) * 111320 * math.cos(math.radians(lat0)), -(lat - lat0) * 111320)


def haversine(lat1, lon1, lat2, lon2):
    R = 6371000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    a = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lon2 - lon1) / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def dp(pts, eps):
    """Douglas-Peucker iterativo sobre lista [(x,y)]; extremos fijos."""
    n = len(pts)
    if n < 3:
        return list(pts)
    keep = [False] * n
    keep[0] = keep[-1] = True
    pila = [(0, n - 1)]
    while pila:
        a, b = pila.pop()
        ax, ay = pts[a]; bx, by = pts[b]
        dx, dy = bx - ax, by - ay
        L2 = dx * dx + dy * dy
        dmax, imax = -1.0, -1
        for i in range(a + 1, b):
            px, py = pts[i]
            if L2 == 0:
                d = math.hypot(px - ax, py - ay)
            else:
                t = ((px - ax) * dx + (py - ay) * dy) / L2
                t = max(0.0, min(1.0, t))
                d = math.hypot(px - (ax + t * dx), py - (ay + t * dy))
            if d > dmax:
                dmax, imax = d, i
        if dmax > eps:
            keep[imax] = True
            pila.append((a, imax)); pila.append((imax, b))
    return [p for p, k in zip(pts, keep) if k]


def dp_linea(pts, eps):
    """DP que trata los anillos cerrados: parte por el vertice mas lejano al primero."""
    if len(pts) >= 4 and pts[0] == pts[-1]:
        x0, y0 = pts[0]
        k = max(range(1, len(pts) - 1), key=lambda i: (pts[i][0] - x0) ** 2 + (pts[i][1] - y0) ** 2)
        a = dp(pts[:k + 1], eps)
        b = dp(pts[k:], eps)
        return a + b[1:]
    return dp(pts, eps)


def dp_variable(pts, eps_cerca, eps_lejos, radio):
    """DP con tolerancia fina cerca de la casa y gruesa lejos. Parte la linea en tramos cerca/lejos."""
    cerca = [math.hypot(x, y) < radio for x, y in pts]
    if all(cerca):
        return dp_linea(pts, eps_cerca)
    if not any(cerca):
        return dp_linea(pts, eps_lejos)
    out, ini, n = [], 0, len(pts)
    while ini < n - 1:
        fin = ini + 1
        while fin < n - 1 and cerca[fin] == cerca[ini]:
            fin += 1                              # el tramo comparte su ultimo punto con el siguiente
        s = dp(pts[ini:fin + 1], eps_cerca if cerca[ini] else eps_lejos)
        out += s if not out else s[1:]
        ini = fin
    return out


def redondea(pts):
    out = []
    for x, y in pts:
        p = (int(round(x)), int(round(y)))
        if not out or out[-1] != p:
            out.append(p)
    return out


def recorta_segmento(p, q, caja):
    """Liang-Barsky. Devuelve (t0, t1) o None."""
    x0, y0, x1, y1 = caja
    dx, dy = q[0] - p[0], q[1] - p[1]
    t0, t1 = 0.0, 1.0
    for pp, qq in ((-dx, p[0] - x0), (dx, x1 - p[0]), (-dy, p[1] - y0), (dy, y1 - p[1])):
        if pp == 0:
            if qq < 0:
                return None
        else:
            r = qq / pp
            if pp < 0:
                if r > t1: return None
                if r > t0: t0 = r
            else:
                if r < t0: return None
                if r < t1: t1 = r
    return t0, t1


def recorta_linea(pts, caja):
    """Parte una polilinea en tramos dentro de la caja."""
    runs, cur = [], []
    for i in range(len(pts) - 1):
        p, q = pts[i], pts[i + 1]
        r = recorta_segmento(p, q, caja)
        if r is None:
            if len(cur) > 1: runs.append(cur)
            cur = []
            continue
        t0, t1 = r
        a = (p[0] + t0 * (q[0] - p[0]), p[1] + t0 * (q[1] - p[1]))
        b = (p[0] + t1 * (q[0] - p[0]), p[1] + t1 * (q[1] - p[1]))
        if t0 > 0 or not cur:
            if len(cur) > 1: runs.append(cur)
            cur = [a]
        cur.append(b)
        if t1 < 1:
            if len(cur) > 1: runs.append(cur)
            cur = []
    if len(cur) > 1: runs.append(cur)
    return runs


def une_dirigido(ways):
    """ways: lista de (nodes, pts). Une por extremos respetando el sentido (costa)."""
    por_ini = {}
    for i, (nodes, pts) in enumerate(ways):
        por_ini.setdefault(nodes[0], []).append(i)
    usados = [False] * len(ways)
    fines = {nodes[-1] for nodes, _ in ways}
    cadenas = []

    def seguir(i):
        nodes, pts = ways[i]
        usados[i] = True
        cn, cp = list(nodes), list(pts)
        while True:
            sig = [j for j in por_ini.get(cn[-1], []) if not usados[j]]
            if not sig:
                break
            j = sig[0]
            usados[j] = True
            cn += ways[j][0][1:]
            cp += ways[j][1][1:]
        return cn, cp

    # primero las cadenas que empiezan en un nodo que no es final de otra
    for i, (nodes, _) in enumerate(ways):
        if not usados[i] and nodes[0] not in fines:
            cadenas.append(seguir(i))
    for i in range(len(ways)):
        if not usados[i]:
            cadenas.append(seguir(i))
    return cadenas


def une_sin_sentido(ways):
    """Une tramos por extremos sin importar el sentido. ways: lista de (nodes, pts)."""
    ends = {}
    for i, (nodes, _) in enumerate(ways):
        ends.setdefault(nodes[0], []).append(i)
        ends.setdefault(nodes[-1], []).append(i)
    usados = [False] * len(ways)
    cadenas = []
    for i in range(len(ways)):
        if usados[i]:
            continue
        usados[i] = True
        cp = list(ways[i][1]); cn = list(ways[i][0])
        for lado in (0, 1):
            while True:
                extremo = cn[-1]
                sig = [j for j in ends.get(extremo, []) if not usados[j]]
                if not sig:
                    break
                j = sig[0]
                usados[j] = True
                nn, pp = ways[j]
                if nn[0] == extremo:
                    cn += list(nn[1:]); cp += list(pp[1:])
                else:
                    cn += list(reversed(nn))[1:]; cp += list(reversed(pp))[1:]
            cn.reverse(); cp.reverse()
        cadenas.append((cn, cp))
    return cadenas


def plano(pts):
    return [c for p in pts for c in p]


def largo(t):
    return sum(math.hypot(t[i + 1][0] - t[i][0], t[i + 1][1] - t[i][1]) for i in range(len(t) - 1))


def area_m2(r):
    return abs(sum(r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1] for i in range(len(r) - 1))) / 2


# ---------------------------------------------------------------- lugares OSM
def centro_bounds(b):
    return ((b["minlat"] + b["maxlat"]) / 2, (b["minlon"] + b["maxlon"]) / 2)


def coger_lugares():
    ids = {"node": [], "way": [], "relation": []}
    for _, _, _, _, ref, extra in LUGARES:
        if ref[0] in ids:
            ids[ref[0]].append(ref[1])
        if "dest" in extra:
            ids[extra["dest"][0]].append(extra["dest"][1])
    ids["node"].append(ORIGEN_NODO)
    for _, ref, _ in REFS_COMPROBACION.values():
        ids[ref[0]].append(ref[1])
    partes = []
    for t, v in ids.items():
        if v:
            partes.append("%s(id:%s);" % (t, ",".join(str(x) for x in sorted(set(v)))))
    q = "[out:json][timeout:90];(" + "".join(partes) + ");out body geom;"
    j = ovp("lugares y casa, por id (verificacion de etiquetas y geometria)", q)
    return {(e["type"], e["id"]): e for e in j["elements"]}


def punto_de(e, modo=None, ref=None):
    """(lat, lon) del elemento. modo 'borde': vertice del contorno mas cercano al centro del bbox."""
    if e["type"] == "node":
        return e["lat"], e["lon"]
    if e["type"] == "way":
        g = e["geometry"]
        clat, clon = centro_bounds(e["bounds"])
        if modo == "borde":
            v = min(g, key=lambda p: (p["lat"] - clat) ** 2 + ((p["lon"] - clon) * 0.74) ** 2)
            return v["lat"], v["lon"]
        if modo == "cerca" and ref:
            v = min(g, key=lambda p: (p["lat"] - ref[0]) ** 2 + ((p["lon"] - ref[1]) * 0.74) ** 2)
            return v["lat"], v["lon"]
        return clat, clon
    return centro_bounds(e["bounds"])


# ---------------------------------------------------------------- OSRM (con cache en disco)
def _osrm_get(url, intentos=5):
    h = hashlib.sha1(url.encode("utf-8")).hexdigest()[:16]
    f = os.path.join(CACHE, "osrm_" + h + ".json")
    if os.path.exists(f):
        with open(f, encoding="utf-8") as fh:
            return json.load(fh)
    ult = None
    for i in range(intentos):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=60) as r:
                j = json.loads(r.read().decode("utf-8"))
            time.sleep(0.5)
            if j.get("code") != "Ok":
                raise ValueError(j.get("code"))
            os.makedirs(CACHE, exist_ok=True)
            with open(f, "w", encoding="utf-8") as fh:
                json.dump(j, fh)
            return j
        except Exception as e:
            ult = e
            time.sleep(2 + 2 * i)
    raise RuntimeError("OSRM fallo %s: %s" % (url, ult))


def osrm(perfil, a, b, geom=False):
    url = "https://routing.openstreetmap.de/routed-%s/route/v1/driving/%.6f,%.6f;%.6f,%.6f?overview=%s%s" % (
        perfil, a[1], a[0], b[1], b[0], "simplified" if geom else "false", "&geometries=geojson" if geom else "")
    j = _osrm_get(url)
    rt = j["routes"][0]
    snaps = [w.get("distance") for w in j["waypoints"]]
    if geom:
        return rt["distance"], rt["duration"], snaps, url, rt["geometry"]["coordinates"]
    return rt["distance"], rt["duration"], snaps, url


def minutos(seg):
    return max(2, math.ceil(seg / 60))


# ---------------------------------------------------------------- capas
def tramos_osm(j):
    """elementos way con geometry -> [(nodes, [(lat,lon)], tags)]"""
    out = []
    for e in j["elements"]:
        if e["type"] == "way" and e.get("geometry") and e.get("nodes"):
            out.append((e["nodes"], [(p["lat"], p["lon"]) for p in e["geometry"]], e.get("tags", {})))
    return out


def main():
    S, W, N, E = DESCARGA
    print("cache:", CACHE)

    # ---- origen
    datos = coger_lugares()
    nodo = datos.get(("node", ORIGEN_NODO))
    if nodo:
        LAT0, LON0 = nodo["lat"], nodo["lon"]
        origen = {"lat": LAT0, "lon": LON0,
                  "fuente": "OSM node/%d (\"%s\", tourism=%s)" % (ORIGEN_NODO, nodo["tags"].get("name"), nodo["tags"].get("tourism")),
                  "osm": "node/%d" % ORIGEN_NODO, "pinWeb": {"lat": round(PIN_WEB[0], 6), "lon": round(PIN_WEB[1], 6)},
                  "distPinWebM": round(haversine(LAT0, LON0, *PIN_WEB)), "etiquetasOsm": nodo.get("tags", {})}
    else:
        LAT0, LON0 = PIN_WEB
        origen = {"lat": LAT0, "lon": LON0, "fuente": "pin del mapa de la web (no hay nodo OSM)", "osm": None}
    print("origen", origen["fuente"], "dist al pin de la web", origen.get("distPinWebM"), "m")
    P = lambda lat, lon: proy(lat, lon, LAT0, LON0)
    ORI = (LAT0, LON0)

    # ---- caja del mapa en metros
    x0, y1 = P(CAJA_GEO[0], CAJA_GEO[1])      # S,W  (y crece hacia el sur)
    x1, y0 = P(CAJA_GEO[2], CAJA_GEO[3])      # N,E
    caja = {"x0": int(round(x0)), "y0": int(round(y0)), "x1": int(round(x1)), "y1": int(round(y1))}
    caja_clip = (caja["x0"] - 800, caja["y0"] - 800, caja["x1"] + 800, caja["y1"] + 800)
    print("caja", caja, "-> %.1f x %.1f km" % ((caja["x1"] - caja["x0"]) / 1000, (caja["y1"] - caja["y0"]) / 1000))

    # ---- bateas (man_made=mussel_raft): el grupo mas cercano a la casa
    bateas_pts, bateas_zona, bateas_meta = coger_bateas(P)

    # ---- lugares
    lugares, ruta_urls, rutas_crudas = [], [], []
    for lid, nes, ngl, tipo, ref, extra in LUGARES:
        if ref[0] == "bateas":
            e = {"type": "node", "id": 0, "lat": bateas_zona["lat"], "lon": bateas_zona["lon"],
                 "tags": {"name": "Batea", "man_made": "mussel_raft"}}
            ref_txt = "way/%d (batea; grupo de %d bateas)" % (bateas_zona["raft_id"], bateas_zona["n"])
        else:
            e = datos.get(ref)
            ref_txt = "%s/%d" % ref
        if e is None:
            print("!! no encontrado", ref); continue
        lat, lon = punto_de(e, extra.get("punto"))
        destino = (lat, lon)
        if extra.get("ruta_a") == "cerca":
            destino = punto_de(e, "cerca", ORI)
        notas = [extra["nota"]] if "nota" in extra else []
        L = {"id": lid, "nombre": nes, "nombreGl": ngl, "nombreOsm": e["tags"].get("name"), "tipo": tipo,
             "lat": round(lat, 6), "lon": round(lon, 6), "osm": ref_txt,
             "_destino": destino, "_notas": notas, "_extra": extra,
             "_osm_tags": {k: e["tags"][k] for k in ("name", "alt_name", "natural", "historic", "amenity", "leisure", "place", "tourism", "man_made", "ferry", "operator", "wikidata", "ele") if k in e["tags"]}}
        if extra.get("extra"):
            L["extra"] = True
        if "dest" in extra:
            ed = datos[extra["dest"]]
            L["_destino"] = punto_de(ed)
            L["_dest_nombre"] = "%s (%s/%d)" % (ed["tags"].get("name"), extra["dest"][0], extra["dest"][1])
        L["_recta_m"] = round(haversine(LAT0, LON0, lat, lon))
        lugares.append(L)

    for L in lugares:
        d = L["_destino"]
        ex = L["_extra"]
        if ex.get("modo") == "barco":
            # sin coche: solo se calcula el paseo hasta el embarcadero
            L["modo"] = "barco"; L["min"] = None; L["km"] = None
            L["barco"] = {"min": None, "desde": L.get("_dest_nombre"), "nota": "minutos de la naviera; sin rellenar"}
            kmp, segp, snp, urlp = osrm("foot", ORI, d)
            ruta_urls.append(urlp)
            L["alEmbarcadero"] = {"modo": "pie", "km": round(kmp / 1000, 2), "min": minutos(segp)}
            rutas_crudas.append({"id": L["id"], "perfil": "foot", "m": round(kmp), "s": round(segp), "snapOrigenM": round(snp[0]), "snapDestinoM": round(snp[1]), "url": urlp, "para": "paseo hasta " + str(L.get("_dest_nombre"))})
            print("%-22s BARCO (embarcadero a pie %.2f km, %d min)" % (L["id"], kmp / 1000, minutos(segp)))
            continue
        km, seg, snaps, url = osrm("car", ORI, d)
        L["coche"] = {"km": round(km / 1000, 1), "min": minutos(seg)}
        L["_snapM"] = round(snaps[1]); L["_snapOrigenM"] = round(snaps[0])
        ruta_urls.append(url)
        rutas_crudas.append({"id": L["id"], "perfil": "car", "m": round(km), "s": round(seg), "snapOrigenM": round(snaps[0]), "snapDestinoM": round(snaps[1]), "url": url})
        if L["_snapM"] > 300:
            L["_notas"].append("el punto cae a %d m de la carretera mas cercana (OSRM)" % L["_snapM"])
        if L["_recta_m"] < 3500:
            try:
                kmp, segp, snp, urlp = osrm("foot", ORI, d)
                ruta_urls.append(urlp)
                rutas_crudas.append({"id": L["id"], "perfil": "foot", "m": round(kmp), "s": round(segp), "snapOrigenM": round(snp[0]), "snapDestinoM": round(snp[1]), "url": urlp})
                if kmp < 3000:
                    L["pie"] = {"km": round(kmp / 1000, 2), "min": minutos(segp)}
            except Exception as ex_:
                print("pie fallo", L["id"], ex_)
        if "pie" in L and L["pie"]["min"] <= 30:
            L["modo"] = "pie"; L["min"] = L["pie"]["min"]; L["km"] = L["pie"]["km"]
        else:
            L["modo"] = "coche"; L["min"] = L["coche"]["min"]; L["km"] = L["coche"]["km"]
        print("%-22s coche %5.1f km %3d min  pie %s  snap %d m  recta %d m" % (L["id"], L["coche"]["km"], L["coche"]["min"], L.get("pie"), L["_snapM"], L["_recta_m"]))

    for L in lugares:
        L["x"], L["y"] = (int(round(v)) for v in P(L["lat"], L["lon"]))

    # ---- comprobaciones contra la web del cliente
    comprobaciones = comprueba_web(datos, ORI, lugares, rutas_crudas, ruta_urls)

    # ---- ruta en coche a Vigo (para dibujarla: «por carretera, dando la vuelta a la ria»)
    vigo = next((L for L in lugares if L["id"] == "vigo"), None)
    ruta_vigo = None
    if vigo:
        dest = comprobaciones["vigoCentro"]["_pt"]
        kmv, segv, snv, urlv, coords = osrm("car", ORI, dest, geom=True)
        pts = [P(la, lo) for lo, la in coords]
        ruta_vigo = redondea(dp(pts, 40))
        ruta_urls.append(urlv)

    # ---- costa
    jc = ovp_teselas("costa (natural=coastline) con geometria", 'way["natural"="coastline"]', DESCARGA, 3, 2)
    vias = [(n, g) for n, g, _ in tramos_osm(jc)]
    cadenas = une_dirigido(vias)
    print("costa: %d vias -> %d cadenas" % (len(vias), len(cadenas)))
    costa, n_pts_costa_bruto = [], 0
    for cn, cp in cadenas:
        pts = [P(la, lo) for la, lo in cp]
        n_pts_costa_bruto += len(pts)
        cerrada = len(cn) > 3 and cn[0] == cn[-1]
        dentro = all(caja_clip[0] <= x <= caja_clip[2] and caja_clip[1] <= y <= caja_clip[3] for x, y in pts)
        if cerrada and dentro:
            tramos = [dp_variable(pts, EPS_COSTA_CERCA, EPS_COSTA_LEJOS, RADIO_CERCA)]
        else:
            tramos = [dp_variable(t, EPS_COSTA_CERCA, EPS_COSTA_LEJOS, RADIO_CERCA) for t in recorta_linea(pts, caja_clip)]
        for t in tramos:
            t = redondea(t)
            if cerrada and dentro:
                if len(t) >= 4 and area_m2(t) >= 1500:     # islotes de menos de 0,15 ha fuera
                    costa.append(t)
            elif len(t) >= 2:
                costa.append(t)
    print("costa tras DP: %d tramos, %d puntos (bruto %d)" % (len(costa), sum(len(t) for t in costa), n_pts_costa_bruto))

    # ---- carreteras
    jr = ovp_teselas("carreteras principales: motorway|trunk|primary|secondary, con geometria", 'way["highway"~"^(motorway|trunk|primary|secondary)$"]', DESCARGA, 3, 2)
    q = ('[out:json][timeout:120];way["highway"="tertiary"](around:4500,%.6f,%.6f);out body geom;' % (LAT0, LON0))
    jt = ovp("carreteras terciarias en 4,5 km de la casa", q)
    grupos = {}
    for nodes, geom, tags in tramos_osm(jr) + tramos_osm(jt):
        nivel = tags.get("highway")
        ref = tags.get("ref") or ""
        clave = (nivel, ref or tags.get("name") or "")
        grupos.setdefault(clave, []).append((nodes, geom))
    carreteras = []
    for (nivel, nombre), vs in grupos.items():
        for cn, cp in une_sin_sentido(vs):
            pts = [P(la, lo) for la, lo in cp]
            for t in recorta_linea(pts, caja_clip):
                t = redondea(dp(t, EPS_RD))
                if len(t) >= 2:
                    mind = min(math.hypot(x, y) for x, y in t)
                    carreteras.append({"ref": nombre, "nivel": nivel, "p": plano(t), "_len": largo(t), "_d": mind})
    # fragmentos cortos fuera; lejos de la casa las secundarias tienen que ser largas (Vigo es muy denso)
    def conserva(c):
        if c["nivel"] in ("motorway", "trunk", "primary"):
            return c["_len"] >= 300
        lim = 250 if c["_d"] < 6000 else 700
        return c["_len"] >= lim
    carreteras = [c for c in carreteras if conserva(c)]
    orden = {"motorway": 0, "trunk": 1, "primary": 2, "secondary": 3, "tertiary": 4}
    carreteras.sort(key=lambda c: (orden[c["nivel"]], c["ref"]))
    for c in carreteras:
        del c["_len"], c["_d"]
    print("carreteras: %d tramos" % len(carreteras), {n: sum(1 for c in carreteras if c["nivel"] == n) for n in orden})

    # ---- rios
    jw = ovp_teselas("rios (waterway=river) con geometria", 'way["waterway"="river"]', DESCARGA, 3, 2)
    gr = {}
    for nodes, geom, tags in tramos_osm(jw):
        gr.setdefault(tags.get("name") or "id%d" % nodes[0], []).append((nodes, geom))
    rios, rios_meta = [], []
    for nombre, vs in gr.items():
        for cn, cp in une_sin_sentido(vs):
            pts = [P(la, lo) for la, lo in cp]
            for t in recorta_linea(pts, caja_clip):
                lg = largo(t)
                if lg < 1500:
                    continue
                t = redondea(dp(t, 25))
                if len(t) >= 2:
                    rios.append(t); rios_meta.append({"nombre": nombre, "m": round(lg)})
    print("rios: %d tramos" % len(rios), rios_meta)

    # ---- agua interior (natural=water)
    ja = ovp_teselas("agua interior (natural=water) con geometria", 'way["natural"="water"]', DESCARGA, 3, 2)
    agua, agua_meta = [], []
    for nodes, geom, tags in tramos_osm(ja):
        pts = [P(la, lo) for la, lo in geom]
        if pts[0] != pts[-1]:
            continue
        if not all(caja_clip[0] <= x <= caja_clip[2] and caja_clip[1] <= y <= caja_clip[3] for x, y in pts):
            continue
        a = area_m2(pts)
        if a < 15000:
            continue
        t = redondea(dp_linea(pts, 12))
        if len(t) >= 4:
            agua.append(t); agua_meta.append({"nombre": tags.get("name"), "m2": round(a)})
    print("agua interior: %d" % len(agua), agua_meta[:10])

    # ---- barcos (route=ferry)
    jf = ovp_teselas("lineas de barco (route=ferry) con geometria", 'way["route"="ferry"]', DESCARGA, 1, 1)
    barcos, barcos_meta = [], []
    for nodes, geom, tags in tramos_osm(jf):
        if not any(k in (tags.get("name") or "") for k in ("Cangas", "Vigo", "Moaña")) or "Baiona" in (tags.get("name") or ""):
            continue   # Baiona - Cies, Santradan - San Simon...: no son de esta lamina
        pts = [P(la, lo) for la, lo in geom]
        for t in recorta_linea(pts, caja_clip):
            t = redondea(dp(t, 25))
            if len(t) >= 2:
                barcos.append({"nombre": tags.get("name") or "", "p": plano(t)})
                barcos_meta.append({"nombre": tags.get("name"), "operador": tags.get("operator"), "m": round(largo(t))})
    print("barcos:", barcos_meta)

    # ---- nucleos (nodos place)
    jn = ovp("nucleos: nodos place=city|town|village|suburb|hamlet", '[out:json][timeout:90];node["place"~"^(city|town|village|suburb|hamlet)$"](%.4f,%.4f,%.4f,%.4f);out body;' % (CAJA_GEO[0], CAJA_GEO[1], CAJA_GEO[2], CAJA_GEO[3]))
    nucleos, nucleos_todos = [], []
    for e in jn["elements"]:
        t = e.get("tags", {})
        if not t.get("name"):
            continue
        x, y = (int(round(v)) for v in P(e["lat"], e["lon"]))
        rango = {"city": 0, "town": 1, "village": 2, "suburb": 3, "hamlet": 4}[t["place"]]
        nucleos_todos.append({"nombre": t["name"], "place": t["place"], "osm": "node/%d" % e["id"], "x": x, "y": y})
        if t["name"] in NUCLEOS_ELEGIDOS:
            nucleos.append({"nombre": t["name"], "tipo": t["place"], "rango": rango, "x": x, "y": y})
    nucleos.sort(key=lambda n: (n["rango"], n["nombre"]))
    print("nucleos elegidos: %d de %d" % (len(nucleos), len(nucleos_todos)))

    # ---- manchas urbanas (landuse residencial/comercial/industrial), muy simplificadas
    ju = ovp_teselas("zonas urbanas: landuse residential|commercial|retail|industrial, con geometria", 'way["landuse"~"^(residential|commercial|retail|industrial)$"]', DESCARGA, 3, 2)
    urbano = []
    for nodes, geom, tags in tramos_osm(ju):
        pts = [P(la, lo) for la, lo in geom]
        if pts[0] != pts[-1] or len(pts) < 4:
            continue
        a = area_m2(pts)
        if a < URBANO_MIN_M2:
            continue
        if not any(caja_clip[0] <= x <= caja_clip[2] and caja_clip[1] <= y <= caja_clip[3] for x, y in pts):
            continue
        t = redondea(dp_linea(pts, EPS_URBANO))
        if len(t) >= 4 and area_m2(t) > URBANO_MIN_M2 * 0.5:
            urbano.append(t)
    print("urbano: %d poligonos, %d puntos" % (len(urbano), sum(len(t) for t in urbano)))

    # ---- salida
    publicos = []
    for L in lugares:
        d = {k: v for k, v in L.items() if not k.startswith("_")}
        if L["_notas"]:
            d["nota"] = "; ".join(L["_notas"])
        d["recta_m"] = L["_recta_m"]
        publicos.append(d)

    dudas = construir_dudas(origen, lugares, comprobaciones, barcos_meta, nucleos_todos)
    ria = {
        "origen": {"lat": origen["lat"], "lon": origen["lon"], "fuente": origen["fuente"]},
        "caja": caja,
        "costa": [plano(t) for t in costa],
        "agua": [plano(t) for t in agua],
        "carreteras": carreteras,
        "rios": [plano(t) for t in rios],
        "barcos": barcos,
        "urbano": [plano(t) for t in urbano],
        "bateas": plano(bateas_pts),
        "nucleos": nucleos,
        "rutas": {"vigoCoche": plano(ruta_vigo) if ruta_vigo else None},
        "lugares": publicos,
        "fuente": "© OpenStreetMap (ODbL)",
        "fecha": FECHA,
    }
    js = ("/* Lamina de la ria de Vigo desde Casa Rural La Garita. Metros desde la casa (x este, y sur). "
          "Costa en sentido OSM: tierra a la izquierda. Generado por scripts/mapa.py. © OpenStreetMap (ODbL) */\n"
          "window.RIA=" + json.dumps(ria, ensure_ascii=False, separators=(",", ":")) + ";\n")
    os.makedirs(os.path.join(RAIZ, "js"), exist_ok=True)
    os.makedirs(os.path.join(RAIZ, "datos"), exist_ok=True)
    with open(os.path.join(RAIZ, "js", "ria.js"), "w", encoding="utf-8") as f:
        f.write(js)
    tam = {k: len(json.dumps(ria[k], separators=(",", ":"))) for k in ("costa", "agua", "carreteras", "rios", "barcos", "urbano", "bateas", "nucleos", "rutas", "lugares")}
    comp = {k: {kk: vv for kk, vv in v.items() if not kk.startswith("_")} for k, v in comprobaciones.items()}
    legible = dict(ria)
    legible["origen"] = origen
    legible["proyeccion"] = "equirectangular: x=(lon-LON0)*111320*cos(LAT0), y=-(lat-LAT0)*111320; metros desde el origen"
    legible["simplificacion"] = {"costa_eps_m": {"cerca(<%d m)" % RADIO_CERCA: EPS_COSTA_CERCA, "lejos": EPS_COSTA_LEJOS}, "carreteras_eps_m": EPS_RD,
                                 "urbano_eps_m": EPS_URBANO, "urbano_min_m2": URBANO_MIN_M2, "rios_eps_m": 25, "agua_eps_m": 12}
    legible["rios_meta"] = rios_meta
    legible["agua_meta"] = agua_meta
    legible["barcos_meta"] = barcos_meta
    legible["nucleos_todos"] = nucleos_todos
    legible["bateas_meta"] = bateas_meta
    legible["bytes_por_capa"] = tam
    legible["comprobaciones"] = comp
    legible["consultas"] = consultas
    legible["rutas_osrm"] = ruta_urls
    legible["rutas_resultado"] = rutas_crudas
    legible["dudas"] = dudas
    legible["costa_sentido"] = "las lineas siguen el sentido de OSM: tierra a la izquierda, mar a la derecha"
    legible["caja_geo"] = {"S": CAJA_GEO[0], "W": CAJA_GEO[1], "N": CAJA_GEO[2], "E": CAJA_GEO[3]}
    with open(os.path.join(RAIZ, "datos", "ria.json"), "w", encoding="utf-8") as f:
        json.dump(legible, f, ensure_ascii=False, indent=1)
    kb = os.path.getsize(os.path.join(RAIZ, "js", "ria.js")) / 1024
    print("ria.js %.1f KB; bytes por capa: %s" % (kb, tam))
    print("costa %d, carreteras %d, rios %d, agua %d, barcos %d, urbano %d, nucleos %d" % (len(costa), len(carreteras), len(rios), len(agua), len(barcos), len(urbano), len(nucleos)))


def coger_bateas(P):
    """Bateas = ways man_made=mussel_raft. Se agrupan (enlace simple a <=700 m) y se elige el grupo
    grande mas cercano a la casa; el punto del lugar es la batea del grupo mas cercana a su centro."""
    S, W, N, E = CAJA_GEO
    q = '[out:json][timeout:120];way["man_made"="mussel_raft"](%.4f,%.4f,%.4f,%.4f);out center tags;' % (S, W, N, E)
    j = ovp("bateas: ways man_made=mussel_raft (centro)", q)
    rafts = [(e["id"], e["center"]["lat"], e["center"]["lon"]) for e in j["elements"] if e.get("center")]
    xy = [P(la, lo) for _, la, lo in rafts]
    n = len(rafts)
    padre = list(range(n))

    def raiz(i):
        while padre[i] != i:
            padre[i] = padre[padre[i]]; i = padre[i]
        return i
    # rejilla de 700 m para no comparar todos con todos
    celdas = {}
    for i, (x, y) in enumerate(xy):
        celdas.setdefault((int(x // 700), int(y // 700)), []).append(i)
    for i, (x, y) in enumerate(xy):
        cx, cy = int(x // 700), int(y // 700)
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for k in celdas.get((cx + dx, cy + dy), []):
                    if k > i and math.hypot(x - xy[k][0], y - xy[k][1]) <= 700:
                        padre[raiz(k)] = raiz(i)
    grupos = {}
    for i in range(n):
        grupos.setdefault(raiz(i), []).append(i)
    info = []
    for g in grupos.values():
        cx = sum(xy[i][0] for i in g) / len(g); cy = sum(xy[i][1] for i in g) / len(g)
        info.append({"n": len(g), "x": round(cx), "y": round(cy), "dist_m": round(math.hypot(cx, cy)), "_g": g, "_c": (cx, cy)})
    info.sort(key=lambda d: d["dist_m"])
    grandes = [d for d in info if d["n"] >= 25]
    elegido = grandes[0]
    cx, cy = elegido["_c"]
    k = min(elegido["_g"], key=lambda i: math.hypot(xy[i][0] - cx, xy[i][1] - cy))
    zona = {"lat": rafts[k][1], "lon": rafts[k][2], "raft_id": rafts[k][0], "n": elegido["n"], "dist_m": elegido["dist_m"]}
    meta = {"total_bateas": n, "grupos": [{k2: v for k2, v in d.items() if not k2.startswith("_")} for d in info if d["n"] >= 5]}
    # puntos para dibujar: una por celda de 40 m
    vistos, pts = set(), []
    for x, y in xy:
        c = (int(x // 40), int(y // 40))
        if c not in vistos:
            vistos.add(c); pts.append((int(round(x)), int(round(y))))
    print("bateas: %d, grupos grandes: %s" % (n, [(d["n"], d["dist_m"]) for d in grandes]))
    return pts, zona, meta


def comprueba_web(datos, ORI, lugares, rutas_crudas, ruta_urls):
    """Cifras de la web del cliente contra OSRM: centro de Cangas a pie y Vigo por carretera."""
    out = {}
    for clave, (desc, ref, perfiles) in REFS_COMPROBACION.items():
        e = datos[ref]
        pt = punto_de(e)
        r = {"descripcion": desc, "osm": "%s/%d" % ref, "nombreOsm": e["tags"].get("name"), "_pt": pt,
             "lat": round(pt[0], 6), "lon": round(pt[1], 6), "recta_m": round(haversine(ORI[0], ORI[1], *pt))}
        for perfil in perfiles:
            km, seg, snaps, url = osrm(perfil, ORI, pt)
            ruta_urls.append(url)
            r[perfil] = {"km": round(km / 1000, 2), "min_exacto": round(seg / 60, 1), "min": minutos(seg), "snapDestinoM": round(snaps[1])}
            rutas_crudas.append({"id": "cmp-" + clave, "perfil": perfil, "m": round(km), "s": round(seg), "snapOrigenM": round(snaps[0]), "snapDestinoM": round(snaps[1]), "url": url})
        out[clave] = r
        print("COMPROBACION %-20s %s" % (clave, {p: r[p] for p in perfiles}))
    return out


def construir_dudas(origen, lugares, comprobaciones, barcos_meta, nucleos_todos):
    por = {L["id"]: L for L in lugares}
    cp, vc, ve = comprobaciones["cangasPueblo"], comprobaciones["vigoCentro"], comprobaciones["vigoEstacion"]
    d = []
    d.append("Origen: el nodo OSM de la casa (node/%d, name=La Garita, tourism=guest_house, addr:city=Cangas; Nominatim lo devuelve tambien al buscar «La Garita, Rodeira, Cangas») esta a %d m del pin de su web (42°15'33.9\"N 8°45'54.6\"W = 42.259417, -8.765167). Se usa el nodo OSM. Ese nodo no lleva calle ni numero (la web dice «Camino de la Garita, 25»; en OSM existe la calle Camiño da Garita, p. ej. way/146233834, con casas numeradas 9-21, pero ningun elemento lleva el 25), y su telefono en OSM (+34 986 300 257) no coincide con el de la web (+34 617 633 166); contact:website=casalagarita.com." % (ORIGEN_NODO, origen.get("distPinWebM", 0)))
    d.append("«15 minutos andando del centro» (web; las resenas dicen 5, 10 y 20): OSRM a pie da %.2f km y %d min hasta el nodo place=town de Cangas y %.2f km y %d min hasta el Concello; hasta el paseo maritimo del puerto salen unos 23 min y hasta el embarcadero %.2f km y %d min. Con la velocidad de OSRM a pie (unos 4,3 km/h) son ~20 min; 15 min exige ir a paso vivo. El «5 minutos andando por el paseo maritimo» del apartamento Mariña de la web solo vale para la playa de Rodeira, no para el pueblo." % (cp["foot"]["km"], cp["foot"]["min"], por["cangas-centro"]["pie"]["km"], por["cangas-centro"]["pie"]["min"], por["cangas-puerto"]["pie"]["km"], por["cangas-puerto"]["pie"]["min"]))
    d.append("«20 km de Vigo» (web; en otro sitio 27 km): por carretera OSRM da %.1f km y %d min hasta el centro de Vigo (nodo place=city) y %.1f km y %d min hasta la Estacion Maritima de Ria; hay que rodear la ria por Moaña y el puente de Rande. Los 27 km se acercan; los 20 km no. En linea recta (por el agua) son %.1f km al centro y %.1f km a la Estacion Maritima. La lamina dibuja la ruta en coche (rutas.vigoCoche) para que se vea lo que acorta el barco." % (vc["car"]["km"], vc["car"]["min"], ve["car"]["km"], ve["car"]["min"], vc["recta_m"] / 1000, ve["recta_m"] / 1000))
    d.append("Vigo e Illas Cies: modo=barco, min=null. Los minutos en barco los pone el cliente desde la naviera (OSM no los trae). OSM tiene las lineas «Vigo - Cangas de Morrazo» (Naviera Mar de Ons; sale de la Estacion Maritima de Cangas, way/237726324, y llega a la Estacion Maritima de Ria de Vigo, node/430099399), «Cangas de Morrazo - Illas Cies» (way/423825301, sin operador en OSM y sin temporada) y «Vigo - Moaña» (piratasdenabia.com). Horarios y temporada, por confirmar con la naviera. alEmbarcadero = paseo desde la casa hasta la Estacion Maritima de Cangas (%.2f km, %d min a pie; OSRM)." % (por["cies"]["alEmbarcadero"]["km"], por["cies"]["alEmbarcadero"]["min"]))
    d.append("Playa de los Alemanes y de las Ratas: en OSM son UNA sola playa (way/107686352, name=Praia dos Alemáns, alt_name=Praia das Ratas, wikidata Q24023094), a 160 m de la casa. No hay una playa de las Ratas aparte; a 340 m hay un islote «Illa dos Ratos» (node/6271795210), que probablemente da el nombre. Si el cliente las cuenta como dos playas, la segunda podria ser la Praia da Cova da Lontra (way/107686349, a ~500 m); no se puede afirmar con OSM, preguntar.")
    d.append("Playa de Canabal: confirmada, pero OSM la escribe «Praia do Canaval» (way/107686351, wikidata Q24023097), a ~600 m en linea recta al nor-noreste. OSRM a pie da %d min por %.2f km: va por calles, porque el sendero de costa que cita la web no parece unido a la red peatonal de OSM; el tiempo es pesimista y el «en pocos minutos» de la web no se puede comprobar." % (por["canaval"]["pie"]["min"], por["canaval"]["pie"]["km"]))
    d.append("Playa de Rodeira: way/107686353; el arenal empieza a unos 30 m de la casa y se alarga ~1 km hacia Cangas. Los 2 min son hasta el arenal mas cercano (regla de minimo 2 min); el punto dibujado es el centro de la playa, a ~500 m.")
    d.append("Punta Rodeira / «Mirador de Punta Rodeira»: NO existe en OSM (ningun nodo, via ni area con ese nombre, ni «Miradoiro» con nombre parecido cerca; Nominatim tampoco devuelve nada). No se invento ningun punto. Lo mas cercano con «Rodeira» en el nombre es el Obelisco de Rodeira (node/4883121831, man_made=obelisk, operador Autoridad Portuaria de Vigo, a ~350 m al noroeste), pero no se puede afirmar que sea el mirador: preguntar al cliente donde esta. Como sustituto se anade, marcado «extra», el Miradoiro do Monte da Mona (node/8121258677, tourism=viewpoint).")
    d.append("Falsos emparejados descartados: «A Garita» (node/4575136993, tourism=viewpoint, a 2,7 km al oeste-suroeste, en la costa sur de Cangas) y «Pico Garita» (node/1260548451, natural=peak, a 3 km al noroeste) no son la casa; la casa es node/4637733182. Tampoco vale la farmacia «Margarita Rodriguez Lantaron» que sale al buscar «Garita».")
    d.append("Centro de Cangas: se usa el Concello (way/180273285, amenity=townhall) y no el nodo place=town (node/247711726), que cae 120 m al norte; la diferencia en minutos es de 0.")
    d.append("Puerto de Cangas: way/237726324 «Estacion Maritima» (operator Naviera Mar de Ons, amenity=ferry_terminal), junto al Porto Deportivo (way/264911969) y la lonja. OSRM a pie da hasta ella un recorrido ~300 m mas largo que hasta el paseo maritimo vecino (1.72 km, 23 min); se publica el del embarcadero (%.2f km, %d min), asi que a pie conviene decir «unos 25 min». En coche, %d min." % (por["cangas-puerto"]["pie"]["km"], por["cangas-puerto"]["pie"]["min"], por["cangas-puerto"]["coche"]["min"]))
    d.append("Moaña: node/1263362733 place=town; el punto es el centro de la villa; la Estacion Maritima de Moaña (way/246323041) esta a ~700 m al sur. En coche, %d min / %.1f km." % (por["moana"]["coche"]["min"], por["moana"]["coche"]["km"]))
    d.append("Bateas: OSM las tiene como ~600 ways man_made=mussel_raft (name=Batea) en toda la ria; la lamina las dibuja como puntos (una por cuadricula de 40 m). El lugar «Bateas de la ria» es la batea mas cercana al centro del grupo de bateas mas cercano a la casa (155 bateas, a %.1f km al oeste-suroeste, en el fondo de la ensenada abierta de Cangas, hacia las Cies). El grupo mayor (334) esta al este de Moaña, a ~6,4 km. OSM tiene ademas «Ruta do Mexillon» (way/479280333, tourism=attraction, piratasdenabia.com, tel. +34 986 320 048): excursion en barco entre Cangas y Moaña pasando por las bateas, con degustacion; es lo que dice la web («viaje por la ria conociendo las bateas»). Sin minutos (barco)." % (por["bateas"]["_recta_m"] / 1000))
    d.append("Extras marcados «extra» (la web no los cita): Miradoiro do Monte da Mona (%.1f km, %d min en coche), Cruceiro del Hio (node/2322010422, %.1f km, %d min), Monte do Facho de Donon (%.1f km, %d min) y Cabo Home (%.1f km, %d min). Cabo Home y el Facho estan a unos 9 y 8 km en linea recta pero a 13 y 12 km por carretera; en Cabo Home el coche llega a ~700 m del faro (OSRM) y el resto es a pie. El mirador esta a 2,7 km y 36 min a pie, por eso va en coche. Si se quieren menos lugares, quitar los extras." % (por["mona"]["coche"]["km"], por["mona"]["coche"]["min"], por["hio"]["coche"]["km"], por["hio"]["coche"]["min"], por["facho"]["coche"]["km"], por["facho"]["coche"]["min"], por["cabo-home"]["coche"]["km"], por["cabo-home"]["coche"]["min"]))
    d.append("Minutos: OSRM car/foot de routing.openstreetmap.de, con minimo 2 min. Titular (min/km/modo) = a pie si la ruta baja de 3 km y de 30 min; en otro caso, coche. Los objetos coche y pie van siempre que existen. Confirmar con el cliente los que vayan a salir publicados.")
    d.append("Nucleos: en OSM no hay nodo place de pueblo para Hio, Aldan ni Cabo Home; en la lamina se rotulan solo Vigo, Cangas, Moaña, Bouzas, Donon, Nerga y Limens. La lista completa (todos los nodos place de la caja, casi todos aldeas minusculas) esta en nucleos_todos. Las manchas urbanas (urbano) son landuse residencial/comercial/retail/industrial de >=5 ha, simplificadas a 40 m: Cangas y Moaña salen como manchas pequeñas.")
    d.append("Costa: sentido OSM (tierra a la izquierda, mar a la derecha), recortada a la caja ampliada 800 m; los anillos cerrados (Cies, islotes) van completos y los de menos de 0,15 ha se quitan. Tolerancia de simplificacion 6 m a menos de 3 km de la casa y 28 m en el resto. Comprobada a ojo (datos/ria-vista.png) y numericamente (cada lugar de tierra cae a la izquierda de la costa mas cercana).")
    d.append("Caja: 24,3 x 14,5 km, de las Cies (oeste) al puente de Rande (este), de Hio/Moaña (norte) a San Martiño (sur). Se amplio al este hasta Rande para que la ruta en coche a Vigo se vea entera. A esa escala la casa, Cangas y sus playas quedan muy juntas (las cuatro playas y el puerto caben en ~1,5 km): la lamina probablemente necesite empezar con zoom a Cangas-Moaña y abrirse hasta la ria, o agrupar etiquetas.")
    d.append("Fuentes y atribucion: © OpenStreetMap contributors (ODbL), a citar en el aviso legal y en los creditos. Overpass: espejo overpass.openstreetmap.fr (overpass-api.de y kumi daban 504 / «server too busy» el 2026-10-14); overpass.osm.ch descartado. UA con nombre y correo.")
    return d


if __name__ == "__main__":
    main()
