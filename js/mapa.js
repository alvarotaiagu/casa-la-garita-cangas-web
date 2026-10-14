/* ------------------------------------------------------------------
   La Garita · la lámina de la ría
   Costa, mar, carreteras, barcos y bateas de OpenStreetMap (js/ria.js, en
   metros desde la casa, y hacia el sur la y) dibujados en canvas como una carta
   de navegación al anochecer. Empieza cerca (la casa, las playas, Cangas) y se
   abre hasta la ría entera. La línea ámbar es la puesta de sol de HOY, calculada.
   En OSM la tierra queda a la IZQUIERDA del sentido del trazo de costa.
   ------------------------------------------------------------------ */
(function () {
  'use strict';
  const R = window.RIA;
  const lienzo = document.getElementById('lamina-lienzo');
  const lista = document.getElementById('lugares-lista');
  if (!R || !lienzo || !lista) return;

  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fino = matchMedia('(pointer: fine)').matches;
  const C = {
    mar: '#16394a',
    marOnda: 'rgba(214, 224, 225, .10)',
    tierra: '#153a2a',
    urbano: 'rgba(241, 243, 236, .075)',
    lago: '#16394a',
    costa: '#9bc0a8',
    carretera: 'rgba(241, 243, 236, .20)',
    principal: 'rgba(241, 243, 236, .42)',
    rio: 'rgba(120, 170, 190, .45)',
    batea: 'rgba(150, 194, 43, .85)',
    barco: 'rgba(241, 243, 236, .8)',
    coche: 'rgba(150, 194, 43, .85)',
    sol: '#f0a24d',
    etiqueta: 'rgba(10, 38, 24, .88)',
    texto: '#f1f3ec',
    activo: '#96c22b',
    tinta: '#11462b',
  };
  const FUENTE = '"Hanken Grotesk", "Segoe UI", system-ui, sans-serif';

  // nombres cortos para las etiquetas del mapa
  const CORTO = { rodeira: 'Rodeira', alemanes: 'Alemanes', canaval: 'Canabal', 'cangas-centro': 'Cangas', 'cangas-puerto': 'Puerto de Cangas', moana: 'Moaña', vigo: 'Vigo', cies: 'Illas Cíes', bateas: 'Bateas', mona: 'Monte da Mona', hio: 'Cruceiro do Hío', facho: 'Monte do Facho', 'cabo-home': 'Cabo Home' };
  // lo que la cifra no cuenta
  const NOTA = {
    rodeira: 'Enfrente de la casa',
    alemanes: 'En OpenStreetMap, también «de las Ratas»',
    canaval: 'Por calles',
    'cangas-puerto': 'De aquí salen los barcos a Vigo y a las Illas Cíes',
    vigo: 'En barco desde Cangas, unos 25 min; en coche, 26 km rodeando la ría',
    cies: 'En barco desde Cangas, en temporada: no se llega por carretera',
    bateas: 'Se ven en barco, recorriendo la ría',
    mona: 'Mirador',
    hio: 'Cruz de piedra',
    facho: 'Monte con vistas a la ría',
    'cabo-home': 'El coche llega a unos 700 m del faro',
  };
  const TXT_TIPO = { playa: 'Playa', ciudad: 'Pueblo', puerto: 'Puerto', isla: 'Islas', bateas: 'Bateas', mirador: 'Mirador', patrimonio: 'Patrimonio', naturaleza: 'Naturaleza' };
  const ORDEN = { pie: 0, coche: 1, barco: 2 };

  const lugares = (R.lugares || []).slice().sort((a, b) => (!!a.extra - !!b.extra) || (ORDEN[a.modo] - ORDEN[b.modo]) || ((a.min || 0) - (b.min || 0)));
  const dist = (l) => Math.hypot(l.x, l.y);
  const filtroDe = (l, f) => f === 'todo' || (f === 'pie' && l.modo === 'pie') || (f === 'playa' && l.tipo === 'playa') || (f === 'barco' && l.modo === 'barco');

  /* ---------- la lista (accesible, y la que manda) ---------- */
  const fmtKm = (k) => String(k).replace('.', ',');
  lista.innerHTML = '';
  lugares.forEach((l, i) => {
    l.n = i + 1;
    const li = document.createElement('li');
    li.className = 'lugar';
    li.dataset.i = i;
    li.dataset.modo = l.modo;
    li.dataset.tipo = l.tipo;
    let tiempo, sub = '';
    if (l.modo === 'pie') { tiempo = `${l.min} min a pie`; sub = `<small>${fmtKm(l.km)} km</small>`; }
    else if (l.modo === 'coche') { tiempo = `${l.min} min en coche`; sub = `<small>${fmtKm(l.km)} km</small>`; }
    else { tiempo = 'En barco'; sub = l.alEmbarcadero ? `<small>${l.alEmbarcadero.min} min a pie hasta el embarcadero</small>` : ''; }
    const gl = `<span class="lugar__gl">${TXT_TIPO[l.tipo] || ''}${NOTA[l.id] ? ' · ' + NOTA[l.id] : ''}</span>`;
    li.innerHTML = `<span class="lugar__n">${String(l.n).padStart(2, '0')}</span><span class="lugar__nom">${l.nombre.replace(/ \(.*\)/, '')}${gl}</span><span class="lugar__dist">${tiempo}${sub}</span>`;
    li.tabIndex = 0;
    li.setAttribute('aria-label', `${l.nombre}: ${tiempo}${l.modo !== 'barco' ? ', ' + fmtKm(l.km) + ' kilómetros' : ''}${NOTA[l.id] ? '; ' + NOTA[l.id] : ''}`);
    const activar = () => resaltar(i);
    li.addEventListener('mouseenter', activar);
    li.addEventListener('focus', activar);
    li.addEventListener('click', activar);
    li.addEventListener('mouseleave', () => resaltar(-1));
    li.addEventListener('blur', () => resaltar(-1));
    lista.appendChild(li);
  });
  const items = Array.from(lista.children);

  // filtros
  const filtros = Array.from(document.querySelectorAll('.filtros--lugares .filtro'));
  let filtro = 'todo';
  filtros.forEach((b) => b.addEventListener('click', () => {
    filtro = b.dataset.tipo;
    filtros.forEach((o) => o.setAttribute('aria-pressed', String(o === b)));
    items.forEach((li, k) => li.classList.toggle('es-fuera', !filtroDe(lugares[k], filtro)));
    if (!hecho) return;
    ir(filtro === 'pie' || filtro === 'playa' ? 'cerca' : 'lejos');
  }));

  /* ---------- la tierra: se cierran las cadenas de costa siguiendo el borde de la caja ---------- */
  const caja = R.caja;
  const X0 = caja.x0 - 800, Y0 = caja.y0 - 800, X1 = caja.x1 + 800, Y1 = caja.y1 + 800;
  const Wc = X1 - X0, Hc = Y1 - Y0, P_TOT = 2 * (Wc + Hc);
  const param = (x, y) => {
    const tol = 3;
    if (Math.abs(y - Y1) <= tol) return x - X0;
    if (Math.abs(x - X1) <= tol) return Wc + (Y1 - y);
    if (Math.abs(y - Y0) <= tol) return Wc + Hc + (X1 - x);
    if (Math.abs(x - X0) <= tol) return 2 * Wc + Hc + (y - Y0);
    return null;
  };
  const esquina = (t) => {
    t = ((t % P_TOT) + P_TOT) % P_TOT;
    if (t < Wc) return [X0 + t, Y1];
    if (t < Wc + Hc) return [X1, Y1 - (t - Wc)];
    if (t < 2 * Wc + Hc) return [X1 - (t - Wc - Hc), Y0];
    return [X0, Y0 + (t - 2 * Wc - Hc)];
  };
  const polis = [], anillos = [], abiertas = [];
  (R.costa || []).forEach((c) => {
    const pts = [];
    for (let i = 0; i < c.length; i += 2) pts.push([c[i], c[i + 1]]);
    if (pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1]) anillos.push(pts); else abiertas.push(pts);
  });
  (function cerrar() {
    const usada = abiertas.map(() => false);
    const inicios = abiertas.map((p, i) => [param(p[0][0], p[0][1]), i]).filter(([t]) => t !== null).sort((a, b) => a[0] - b[0]);
    abiertas.forEach((_, i0) => {
      if (usada[i0] || param(...abiertas[i0][0]) === null || param(...abiertas[i0][abiertas[i0].length - 1]) === null) return;
      const poli = [];
      let i = i0;
      while (!usada[i]) {
        usada[i] = true;
        poli.push(...abiertas[i]);
        const ult = abiertas[i][abiertas[i].length - 1];
        const te = param(ult[0], ult[1]);
        const cand = inicios.map(([ts, j]) => [((ts - te) % P_TOT + P_TOT) % P_TOT, j]).sort((a, b) => a[0] - b[0]);
        const [d, j] = cand[0];
        [0, Wc, Wc + Hc, 2 * Wc + Hc].sort((a, b) => (((a - te) % P_TOT + P_TOT) % P_TOT) - (((b - te) % P_TOT + P_TOT) % P_TOT)).forEach((e) => {
          const r = ((e - te) % P_TOT + P_TOT) % P_TOT;
          if (r > 0 && r < d) poli.push(esquina(e));
        });
        i = j;
      }
      polis.push(poli);
    });
  })();
  const area = (p) => { let s = 0; for (let i = 0; i < p.length - 1; i++) s += p[i][0] * p[i + 1][1] - p[i + 1][0] * p[i][1]; return s; };
  const pares = (a) => { const o = []; for (let i = 0; i < a.length; i += 2) o.push([a[i], a[i + 1]]); return o; };
  const urbano = (R.urbano || []).map(pares);
  const lagos = (R.agua || []).map(pares);

  /* ---------- el lienzo ---------- */
  const ctx = lienzo.getContext('2d');
  let W = 0, H = 0, dpr = 1, gf = 1;
  const base = document.createElement('canvas');
  const bctx = base.getContext('2d');
  let vista = { cx: 0, cy: 0, esc: 1 };
  let destino = 'cerca', tVista = 1, activo = -1, hecho = false, arrancado = false, revela = 1;
  const VISTAS = {};
  const P = (x, y, v) => [W / 2 + (x - v.cx) * v.esc, H / 2 + (y - v.cy) * v.esc];

  function ajustar(b, m) {
    const esc = Math.min((W - 2 * m) / (b.x1 - b.x0), (H - 2 * m) / (b.y1 - b.y0));
    return { cx: (b.x0 + b.x1) / 2, cy: (b.y0 + b.y1) / 2, esc };
  }
  function medir() {
    const r = lienzo.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    for (const c of [lienzo, base]) { c.width = W * dpr; c.height = H * dpr; }
    gf = Math.max(0.8, Math.min(1.6, W / 640));
    VISTAS.cerca = ajustar({ x0: -1750, y0: -760, x1: 760, y1: 300 }, 34);
    VISTAS.lejos = ajustar({ x0: -12100, y0: -3300, x1: 4900, y1: 4700 }, 22);
  }

  // sol de hoy (calculado en main.js)
  function solHoy() {
    if (!window.__sol) return null;
    const S = window.__sol, { y, m, d } = S.fechaMadrid(new Date());
    const h = S.dia(y, m, d);
    if (!h) return null;
    const cies = lugares.find((l) => l.id === 'cies');
    const rumboCies = cies ? ((Math.atan2(cies.x, -cies.y) * 180 / Math.PI) + 360) % 360 : null;
    return { hora: S.hm(h.pone), az: h.acimut, rumboCies };
  }
  const SOL = solHoy();
  const VIENTOS = ['norte', 'norte-noreste', 'noreste', 'este-noreste', 'este', 'este-sureste', 'sureste', 'sur-sureste', 'sur', 'sur-suroeste', 'suroeste', 'oeste-suroeste', 'oeste', 'oeste-noroeste', 'noroeste', 'norte-noroeste'];
  const nombreViento = (g) => VIENTOS[Math.round(((g % 360) + 360) % 360 / 22.5) % 16];
  (function textoSol() {
    const p = document.getElementById('lamina-sol');
    if (!p || !SOL) return;
    const sobreCies = SOL.rumboCies !== null && Math.abs(SOL.az - SOL.rumboCies) < 3.5;
    p.textContent = sobreCies
      ? `La línea ámbar es la puesta de sol de hoy, a las ${SOL.hora}: cae justo sobre las Illas Cíes (rumbo ${Math.round(SOL.az)}°).`
      : `La línea ámbar es la puesta de sol de hoy, a las ${SOL.hora}: rumbo ${Math.round(SOL.az)}° (${nombreViento(SOL.az)}). Las Illas Cíes quedan a ${SOL.rumboCies !== null ? Math.round(SOL.rumboCies) : '—'}°.`;
    p.hidden = false;
  })();

  function trazo(c, p, v) {
    c.moveTo(...P(p[0][0], p[0][1], v));
    for (let i = 1; i < p.length; i++) c.lineTo(...P(p[i][0], p[i][1], v));
  }
  function trazoPlano(c, a, v) {
    c.moveTo(...P(a[0], a[1], v));
    for (let i = 2; i < a.length; i += 2) c.lineTo(...P(a[i], a[i + 1], v));
  }

  function pintarMapa(c, v) {
    c.save();
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = C.mar;
    c.fillRect(0, 0, W, H);
    c.lineJoin = 'round'; c.lineCap = 'round';
    // tierra
    c.fillStyle = C.tierra;
    polis.forEach((p) => { c.beginPath(); trazo(c, p, v); c.closePath(); c.fill(); });
    anillos.forEach((p) => { c.fillStyle = area(p) < 0 ? C.tierra : C.mar; c.beginPath(); trazo(c, p, v); c.closePath(); c.fill(); });
    c.fillStyle = C.lago;
    lagos.forEach((p) => { c.beginPath(); trazo(c, p, v); c.closePath(); c.fill(); });
    c.fillStyle = C.urbano;
    urbano.forEach((p) => { c.beginPath(); trazo(c, p, v); c.closePath(); c.fill(); });
    // ríos y carreteras
    c.strokeStyle = C.rio; c.lineWidth = 1 * gf;
    c.beginPath(); (R.rios || []).forEach((a) => trazoPlano(c, a, v)); c.stroke();
    const grosor = v.esc > 0.02 ? 1.6 : 1;
    [['sec', C.carretera, 0.8 * grosor], ['prin', C.principal, 1.3 * grosor]].forEach(([k, col, w]) => {
      c.strokeStyle = col; c.lineWidth = w * gf;
      c.beginPath();
      (R.carreteras || []).forEach((r) => {
        const prin = r.nivel === 'motorway' || r.nivel === 'trunk' || r.nivel === 'primary';
        if ((k === 'prin') === prin) trazoPlano(c, r.p, v);
      });
      c.stroke();
    });
    // ondas junto a la costa (por el lado del agua): dos líneas muy tenues
    c.strokeStyle = C.marOnda; c.lineWidth = 0.9 * gf;
    const sep = [3.5 * gf, 8 * gf];
    sep.forEach((s) => {
      c.beginPath();
      (R.costa || []).forEach((a) => {
        for (let i = 0; i < a.length; i += 2) {
          const j0 = Math.max(0, i - 2), j1 = Math.min(a.length - 2, i + 2);
          const [ax, ay] = P(a[j0], a[j0 + 1], v), [bx, by] = P(a[j1], a[j1 + 1], v);
          let nx = -(by - ay), ny = bx - ax;
          const L = Math.hypot(nx, ny) || 1; nx /= L; ny /= L;      // derecha del trazo = agua
          const [x, y] = P(a[i], a[i + 1], v);
          if (i === 0) c.moveTo(x + nx * s, y + ny * s); else c.lineTo(x + nx * s, y + ny * s);
        }
      });
      c.stroke();
    });
    // la costa
    c.strokeStyle = C.costa; c.lineWidth = 1.5 * gf;
    c.beginPath(); (R.costa || []).forEach((a) => trazoPlano(c, a, v)); c.stroke();
    // bateas
    c.fillStyle = C.batea;
    const tb = Math.max(1.1, Math.min(2.4, v.esc * 900));
    for (let i = 0; i < R.bateas.length; i += 2) { const [x, y] = P(R.bateas[i], R.bateas[i + 1], v); c.fillRect(x - tb / 2, y - tb / 2, tb, tb); }
    // barcos (discontinua) y coche a Vigo
    const raya = (a, color, w, dash) => { c.setLineDash(dash); c.strokeStyle = color; c.lineWidth = w * gf; c.beginPath(); trazoPlano(c, a, v); c.stroke(); c.setLineDash([]); };
    (R.barcos || []).forEach((b) => raya(b.p, C.barco, 1.3, [6 * gf, 5 * gf]));
    if (filtro === 'todo' || filtro === 'barco') raya(R.rutas.vigoCoche, C.coche, 1.4, [2 * gf, 5 * gf]);
    c.restore();
  }

  // el rumbo de la puesta de sol de hoy, desde la casa
  function rayoSol(c, v) {
    if (!SOL) return;
    const a = SOL.az * Math.PI / 180;
    const [hx, hy] = P(0, 0, v);
    const L = Math.hypot(W, H) * 1.3;
    const fx = hx + Math.sin(a) * L, fy = hy - Math.cos(a) * L;
    const g = c.createLinearGradient(hx, hy, fx, fy);
    g.addColorStop(0, 'rgba(240, 162, 77, .95)'); g.addColorStop(0.55, 'rgba(240, 162, 77, .45)'); g.addColorStop(1, 'rgba(240, 162, 77, 0)');
    c.save();
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.strokeStyle = g; c.lineWidth = 1.6 * gf;
    c.beginPath(); c.moveTo(hx, hy); c.lineTo(fx, fy); c.stroke();
    c.restore();
  }

  const colorDe = (l) => (l.tipo === 'playa' ? '#e4e8dc' : l.tipo === 'puerto' || l.modo === 'barco' ? C.activo : l.extra ? C.costa : '#f1f3ec');
  function chapas(c, v, conEtiquetas) {
    c.save();
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const ocupado = [];
    const choca = (r) => r.x < 4 || r.y < 4 || r.x + r.w > W - 4 || r.y + r.h > H - 22 || ocupado.some((o) => !(r.x + r.w < o.x || o.x + o.w < r.x || r.y + r.h < o.y || o.y + o.h < r.y));
    const cerca = v.esc > 0.06;
    // la casa
    const [hx, hy] = P(0, 0, v);
    c.strokeStyle = C.sol; c.lineWidth = 2 * gf;
    c.beginPath(); c.arc(hx, hy, 8 * gf, 0, Math.PI * 2); c.stroke();
    c.fillStyle = C.sol; c.beginPath(); c.arc(hx, hy, 3 * gf, 0, Math.PI * 2); c.fill();
    c.font = `700 ${Math.round(12 * Math.min(gf, 1.2))}px ${FUENTE}`;
    ocupado.push({ x: hx - 10, y: hy - 10, w: 20, h: 20 });
    const rect = [];
    // los puntos de todos los lugares visibles se reservan antes de colocar ninguna etiqueta
    lugares.forEach((l) => {
      if (!filtroDe(l, filtro)) return;
      const [x, y] = P(l.x, l.y, v);
      ocupado.push({ x: x - 7, y: y - 7, w: 14, h: 14 });
    });
    if (conEtiquetas) {
      const tH = 'La garita';
      const wH = c.measureText(tH).width + 12, rH = { x: hx + 13 * gf, y: hy - 9, w: wH, h: 18 };
      const cand = [rH, { x: hx - 13 * gf - wH, y: hy - 9, w: wH, h: 18 }, { x: hx - wH / 2, y: hy + 12, w: wH, h: 18 }, { x: hx - wH / 2, y: hy - 30, w: wH, h: 18 }];
      const ok = cand.find((q) => !choca(q)) || rH;
      ocupado.push(ok);
      c.fillStyle = C.sol; c.fillRect(ok.x, ok.y, ok.w, ok.h);
      c.fillStyle = C.tinta; c.fillText(tH, ok.x + 6, ok.y + 13);
    }
    const orden = lugares.map((_, i) => i).sort((a, b) => (b === activo) - (a === activo));
    c.font = `600 ${Math.round(11 * Math.min(gf, 1.2))}px ${FUENTE}`;
    orden.forEach((i) => {
      const l = lugares[i];
      if (!filtroDe(l, filtro)) return;
      const [x, y] = P(l.x, l.y, v);
      if (x < -10 || y < -10 || x > W + 10 || y > H + 10) return;
      const es = i === activo;
      // lo que cae a menos de 2,6 km de la casa solo se rotula de cerca (de lejos se amontona), salvo Cangas
      const amontona = !cerca && dist(l) < 2600 && l.id !== 'cangas-centro' && !es;
      c.fillStyle = es ? C.sol : colorDe(l);
      c.beginPath(); c.arc(x, y, (es ? 6 : amontona ? 3 : 4.4) * gf, 0, Math.PI * 2); c.fill();
      c.strokeStyle = 'rgba(10, 38, 24, .9)'; c.lineWidth = 1.4; c.stroke();
      if (!conEtiquetas || amontona) return;
      const t = `${l.n} · ${CORTO[l.id] || l.nombre}`;
      const w = c.measureText(t).width + 10, h = 17;
      const cand = [[x + 9 * gf, y - h / 2], [x - 9 * gf - w, y - h / 2], [x - w / 2, y - 9 * gf - h], [x - w / 2, y + 9 * gf]];
      let r = null;
      for (const [cx, cy] of cand) { const q = { x: cx, y: cy, w, h }; if (!choca(q)) { r = q; break; } }
      if (!r && es) r = { x: cand[0][0], y: cand[0][1], w, h };
      if (!r) return;
      ocupado.push(r);
      rect.push({ i, ...r });
      c.fillStyle = es ? C.activo : C.etiqueta;
      c.fillRect(r.x, r.y, r.w, r.h);
      c.fillStyle = es ? C.tinta : C.texto;
      c.fillText(t, r.x + 5, r.y + 12.5);
    });
    lienzo.__chapas = rect;      // para las pruebas: que no se pisen
    // rosa de los vientos y escala, arriba a la izquierda (abajo va la fuente)
    c.fillStyle = C.texto; c.strokeStyle = C.texto; c.lineWidth = 1;
    const nx = 26, ny = 32;
    c.beginPath(); c.moveTo(nx, ny - 14); c.lineTo(nx + 5, ny + 4); c.lineTo(nx, ny); c.lineTo(nx - 5, ny + 4); c.closePath(); c.fill();
    c.font = `700 10px ${FUENTE}`; c.fillText('N', nx - 3.5, ny + 17);
    const km = cerca ? 0.5 : 5, px = km * 1000 * v.esc;
    const sx = 48, sy = 32;
    c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx + px, sy); c.moveTo(sx, sy - 4); c.lineTo(sx, sy + 4); c.moveTo(sx + px, sy - 4); c.lineTo(sx + px, sy + 4); c.stroke();
    c.fillText(`${String(km).replace('.', ',')} km`, sx + px / 2 - 14, sy - 7);
    c.restore();
  }

  function componer(radio) {
    const c = ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, lienzo.width, lienzo.height);
    if (radio !== undefined && radio < 1) {
      // el mapa se abre desde la casa, como una gota
      const [hx, hy] = P(0, 0, vista);
      const rMax = Math.hypot(Math.max(hx, W - hx), Math.max(hy, H - hy)) + 20;
      c.save();
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.beginPath(); c.arc(hx, hy, rMax * radio, 0, Math.PI * 2); c.clip();
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.drawImage(base, 0, 0);
      c.restore();
      c.save(); c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.strokeStyle = 'rgba(240, 162, 77, .5)'; c.lineWidth = 1.2;
      c.beginPath(); c.arc(hx, hy, rMax * radio, 0, Math.PI * 2); c.stroke();
      c.restore();
    } else {
      c.drawImage(base, 0, 0);
    }
    rayoSol(c, vista);
    chapas(c, vista, radio === undefined || radio >= 1);
  }
  function pintarFinal() {
    if (!W) medir();
    pintarMapa(bctx, vista);
    componer();
  }
  function resaltar(i) {
    activo = i;
    items.forEach((li, k) => li.classList.toggle('es-activo', k === i));
    if (hecho && tVista === 1) componer();
  }

  /* ---------- cambio de vista: cerca ↔ la ría entera ---------- */
  let anim = 0;
  function ir(nombre, dur) {
    destino = nombre;
    const a = { ...vista }, b = VISTAS[nombre];
    cancelAnimationFrame(anim);
    if (quieto || dur === 0) { vista = { ...b }; tVista = 1; pintarFinal(); return; }
    const t0 = performance.now(), D = dur || 1500;
    tVista = 0;
    const paso = (ahora) => {
      const t = Math.min(1, (ahora - t0) / D);
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      vista = { cx: a.cx + (b.cx - a.cx) * e, cy: a.cy + (b.cy - a.cy) * e, esc: a.esc * Math.pow(b.esc / a.esc, e) };
      pintarMapa(bctx, vista);
      tVista = t;
      componer(t < 1 ? 1 : undefined);
      if (t < 1) anim = requestAnimationFrame(paso); else { tVista = 1; componer(); }
    };
    anim = requestAnimationFrame(paso);
  }

  /* ---------- arranque: se abre desde la casa y luego se abre hasta la ría ---------- */
  function arrancar() {
    if (arrancado) return;
    arrancado = true;
    medir();
    if (quieto) { vista = { ...VISTAS.lejos }; hecho = true; pintarFinal(); return; }
    vista = { ...VISTAS.cerca };
    pintarMapa(bctx, vista);
    const t0 = performance.now(), DUR = 1500;
    const paso = (ahora) => {
      const t = Math.min(1, (ahora - t0) / DUR);
      const e = 1 - Math.pow(1 - t, 2.6);
      componer(Math.max(0.02, e));
      if (t < 1) requestAnimationFrame(paso);
      else {
        hecho = true;
        componer();
        // se queda un momento cerca (la casa, las playas, Cangas) y se abre a la ría
        setTimeout(() => { if (filtro === 'todo' || filtro === 'barco') ir('lejos', 1900); }, 1100);
      }
    };
    requestAnimationFrame(paso);
  }
  const io = new IntersectionObserver((es) => {
    if (es.some((e) => e.isIntersecting)) { arrancar(); io.disconnect(); }
  }, { rootMargin: '0px 0px -15% 0px' });
  io.observe(lienzo);

  // resize de verdad (no el de la barra del móvil): se vuelve a medir y a pintar
  let aw = innerWidth, ah = innerHeight, tr = 0;
  addEventListener('resize', () => {
    if (!fino && innerWidth === aw && Math.abs(innerHeight - ah) < 160) return;
    clearTimeout(tr);
    tr = setTimeout(() => { aw = innerWidth; ah = innerHeight; if (hecho) { medir(); vista = { ...VISTAS[destino] }; pintarFinal(); } }, 200);
  });
  window.__lamina = { lugares, pintarFinal, resaltar, ir, get vista() { return vista; }, get hecho() { return hecho; } };
})();
