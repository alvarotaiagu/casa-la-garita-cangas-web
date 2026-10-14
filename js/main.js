/* ------------------------------------------------------------------
   Casa Rural La Garita · «Desde la garita»
   ------------------------------------------------------------------ */
(function () {
  'use strict';

  const raiz = document.documentElement;
  const hayGSAP = typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined';
  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fino = matchMedia('(pointer: fine)').matches;
  // «con-movimiento» SOLO con GSAP y sin movimiento reducido: si no, los
  // titulares partidos y las entradas se quedarían escondidos.
  const motion = hayGSAP && !quieto;
  if (motion) raiz.classList.add('con-movimiento');
  if (hayGSAP) {
    gsap.registerPlugin(ScrollTrigger);
    // el resize lo gestionamos nosotros (la barra del móvil no rehace nada)
    ScrollTrigger.config({ autoRefreshEvents: 'visibilitychange,DOMContentLoaded,load', ignoreMobileResize: true });
  }

  const $ = (s, c) => (c || document).querySelector(s);
  const $$ = (s, c) => Array.from((c || document).querySelectorAll(s));
  const f = (n) => Math.round(n * 100) / 100;
  const anno = $('#anno');
  if (anno) anno.textContent = new Date().getFullYear();

  // el resize de la barra del móvil (mismo ancho, poca altura) no rehace NADA
  let anchoVista = innerWidth, altoVista = innerHeight;
  const esBarra = () => !fino && innerWidth === anchoVista && Math.abs(innerHeight - altoVista) < 160;

  /* ============ 1. titulares partidos en palabras ============ */
  function partir(h) {
    if (h.classList.contains('es-partido')) return;
    h.setAttribute('aria-label', h.textContent.replace(/\s+/g, ' ').trim());
    let n = 0;
    const envolver = (nodo) => {
      if (nodo.nodeType === 3) {
        const frag = document.createDocumentFragment();
        // solo espacios normales: el espacio duro (&nbsp;) mantiene unidas las palabras que deben ir juntas
        nodo.textContent.split(/([ \t\r\n]+)/).forEach((t) => {
          if (!t.trim()) { frag.appendChild(document.createTextNode(t)); return; }
          const pal = document.createElement('span');
          pal.className = 'pal';
          pal.setAttribute('aria-hidden', 'true');
          const i = document.createElement('i');
          i.textContent = t;
          i.style.setProperty('--n', n++);
          pal.appendChild(i);
          frag.appendChild(pal);
        });
        nodo.replaceWith(frag);
      } else if (nodo.nodeType === 1) {
        Array.from(nodo.childNodes).forEach(envolver);
      }
    };
    Array.from(h.childNodes).forEach(envolver);
    h.classList.add('es-partido');
  }
  const vistos = new IntersectionObserver((es) => es.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add('es-visto'); vistos.unobserve(e.target); }
  }), { rootMargin: '0px 0px -10% 0px' });
  if (motion) {
    $$('[data-partir]').forEach((h) => {
      if (h.closest('.hero')) return;     // el del hero, al abrirse el portal
      partir(h);
      vistos.observe(h);
    });
    $$('[data-revela]').forEach((el, i) => {
      el.style.setProperty('--d', i % 3);
      vistos.observe(el);
    });
  }

  /* ============ 2. Lenis ============ */
  let lenis = null;
  if (typeof Lenis !== 'undefined' && !quieto) {
    lenis = new Lenis({ duration: 1.05, smoothWheel: true, lerp: 0.12 });
    if (hayGSAP) {
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((t) => lenis.raf(t * 1000));
    } else {
      const bucle = (t) => { lenis.raf(t); requestAnimationFrame(bucle); };
      requestAnimationFrame(bucle);
    }
  }
  const irA = (sel) => {
    const el = $(sel);
    if (!el) return;
    const y = el.getBoundingClientRect().top + scrollY - (sel === '#consulta' ? 0 : 60);
    if (lenis) lenis.scrollTo(y, { duration: 1.1 });
    else scrollTo({ top: y, behavior: quieto ? 'auto' : 'smooth' });
  };

  // lo que está fuera de la pantalla y mide cajas de SVG se monta en un rato
  // libre, con el portal ya fuera (si no, sus tareas largas lo entrecortan)
  const tardias = [];
  let tardiasLanzadas = false;
  const lanzarTardias = () => {
    if (tardiasLanzadas) return;
    tardiasLanzadas = true;
    const libre = (fn) => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 1500 }) : setTimeout(fn, 300));
    setTimeout(() => tardias.forEach((fn) => libre(fn)), 400);
  };

  // hileras: un tramo de muro de piedra seca (dos hiladas de sillares) como separador
  tardias.push(function hileras() {
    const NS = 'http://www.w3.org/2000/svg';
    const rng = (s) => () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    $$('.hilera').forEach((h, k) => {
      const r = rng(k * 97 + 11);
      const svg = document.createElementNS(NS, 'svg');
      const H = 34, W = 1400;
      const g = document.createElementNS(NS, 'g');
      g.setAttribute('fill', 'currentColor');
      for (let c = 0; c < 2; c++) {
        let x = c ? -r() * 40 : 0;
        while (x < W) {
          const w = 26 + r() * 44;
          const u = document.createElementNS(NS, 'rect');
          u.setAttribute('x', f(x + 1.6)); u.setAttribute('y', c * 17 + 1.4);
          u.setAttribute('width', f(w - 3.2)); u.setAttribute('height', 14.2);
          u.setAttribute('rx', 4.5);
          u.setAttribute('opacity', f(0.55 + r() * 0.45));
          g.appendChild(u);
          x += w;
        }
      }
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
      svg.setAttribute('aria-hidden', 'true');
      svg.appendChild(g);
      h.appendChild(svg);
    });
  });

  /* ============ 3. el sol de hoy en Cangas (calculado, no inventado) ============
     Ecuación de salida/puesta del sol (NOAA / Meeus) para la casa:
     42,2594 N, 8,7652 O. Hora de Europa/Madrid. */
  const SOL = (function () {
    const LAT = 42.25942, LON = -8.76517, rad = Math.PI / 180;
    const fechaMadrid = (d) => {
      const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
      const g = (t) => +p.find((x) => x.type === t).value;
      return { y: g('year'), m: g('month'), d: g('day') };
    };
    function dia(y, m, d) {
      const jd0 = Date.UTC(y, m - 1, d, 0, 0, 0) / 86400000 + 2440587.5;
      const n = Math.ceil(jd0 - 2451545 + 0.0008);
      const js = n - LON / 360;
      const M = (357.5291 + 0.98560028 * js) % 360;
      const C = 1.9148 * Math.sin(M * rad) + 0.02 * Math.sin(2 * M * rad) + 0.0003 * Math.sin(3 * M * rad);
      const lam = (M + C + 180 + 102.9372) % 360;
      const jt = 2451545 + js + 0.0053 * Math.sin(M * rad) - 0.0069 * Math.sin(2 * lam * rad);
      const sd = Math.sin(lam * rad) * Math.sin(23.4397 * rad);
      const cd = Math.cos(Math.asin(sd));
      const alt = -0.833 * rad;
      const cw = (Math.sin(alt) - Math.sin(LAT * rad) * sd) / (Math.cos(LAT * rad) * cd);
      if (cw < -1 || cw > 1) return null;
      const w0 = Math.acos(cw) / rad;
      const aDate = (j) => new Date((j - 2440587.5) * 86400000);
      // acimut de la puesta (grados desde el norte, hacia el este)
      const cz = (sd - Math.sin(LAT * rad) * Math.sin(alt)) / (Math.cos(LAT * rad) * Math.cos(alt));
      const acimut = 360 - Math.acos(Math.max(-1, Math.min(1, cz))) / rad;
      return { sale: aDate(jt - w0 / 360), pone: aDate(jt + w0 / 360), acimut };
    }
    const hm = (d) => new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d);
    return { dia, fechaMadrid, hm };
  })();
  window.__sol = SOL;
  (function solVivo() {
    const t = $('#sol-vivo-txt');
    if (!t) return;
    const pintar = () => {
      const ahora = new Date();
      const { y, m, d } = SOL.fechaMadrid(ahora);
      const hoy = SOL.dia(y, m, d);
      if (!hoy) return;
      const falta = hoy.pone - ahora;
      if (falta > 0) {
        const min = Math.round(falta / 60000);
        const resto = min >= 60 ? `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min` : `${min} min`;
        t.textContent = `Hoy el sol se pone en Cangas a las ${SOL.hm(hoy.pone)} · faltan ${resto}`;
      } else {
        const x = new Date(Date.UTC(y, m - 1, d + 1, 12));
        const man = SOL.dia(x.getUTCFullYear(), x.getUTCMonth() + 1, x.getUTCDate());
        t.textContent = `Hoy el sol se puso a las ${SOL.hm(hoy.pone)} · mañana, a las ${SOL.hm(man.pone)}`;
      }
    };
    pintar();
    setInterval(pintar, 30000);
  })();

  /* ============ 4. el mirador del hero: arrastrar para mirar alrededor ============ */
  const mirador = (function () {
    const caja = $('#mirador'), img = $('#mirador-img'), mando = $('#mirador-mando');
    if (!caja || !img) return null;
    let rango = 0, x = 0, anim = 0, arrastrando = false, tocado = false;
    const SOL_X = 0.8;      // dónde está el sol en la foto (fracción del ancho)
    const acotar = (v) => Math.max(-rango, Math.min(0, v));
    const pintar = () => caja.style.setProperty('--px', f(x) + 'px');
    function medir(conservar) {
      const antes = rango ? x / -rango : null;
      rango = Math.max(0, img.offsetWidth - caja.clientWidth);
      if (conservar && antes !== null) x = -rango * antes;
      else x = acotar(-(SOL_X * img.offsetWidth - 0.68 * caja.clientWidth));
      pintar();
      if (mando) {
        mando.hidden = rango < 40;
        const ay = $('#mirador-ayuda');
        if (ay) ay.textContent = fino ? 'Arrastre o mueva el ratón para mirar alrededor' : 'Arrastre para mirar alrededor';
      }
    }
    // movimiento con ease propio (sin depender de GSAP)
    function ir(destino, dur) {
      cancelAnimationFrame(anim);
      destino = acotar(destino);
      if (quieto || !dur) { x = destino; pintar(); return; }
      const x0 = x, t0 = performance.now();
      const paso = (ahora) => {
        const t = Math.min(1, (ahora - t0) / dur);
        const e = 1 - Math.pow(1 - t, 3);
        x = x0 + (destino - x0) * e;
        pintar();
        if (t < 1) anim = requestAnimationFrame(paso);
      };
      anim = requestAnimationFrame(paso);
    }
    const paso = (d) => { tocado = true; ir(x + d * Math.max(160, rango * 0.45), 800); };
    $('#mirador-izq').addEventListener('click', () => paso(1));
    $('#mirador-der').addEventListener('click', () => paso(-1));
    caja.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); paso(1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); paso(-1); }
    });
    // arrastre con inercia y un poco de goma en los extremos
    let px0 = 0, py0 = 0, x0 = 0, capturado = false, ult = [];
    caja.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      cancelAnimationFrame(anim);
      arrastrando = true; capturado = false; tocado = true;
      px0 = e.clientX; py0 = e.clientY; x0 = x; ult = [{ t: performance.now(), x }];
    });
    caja.addEventListener('pointermove', (e) => {
      if (arrastrando) {
        const dx = e.clientX - px0, dy = e.clientY - py0;
        if (!capturado) {
          if (Math.abs(dx) < 6 || Math.abs(dx) < Math.abs(dy)) return;
          capturado = true;
          try { caja.setPointerCapture(e.pointerId); } catch (err) {}
          caja.classList.add('es-agarrado');
        }
        let v = x0 + dx;
        if (v > 0) v = v * 0.35;
        else if (v < -rango) v = -rango + (v + rango) * 0.35;
        x = v; pintar();
        ult.push({ t: performance.now(), x });
        if (ult.length > 6) ult.shift();
      } else if (fino && e.pointerType === 'mouse' && !tocado && rango > 0) {
        // sin tocar nada, el ratón mueve la vista con suavidad
        ir(-rango * (e.clientX / innerWidth) , 900);
      }
    });
    const soltar = () => {
      if (!arrastrando) return;
      arrastrando = false;
      caja.classList.remove('es-agarrado');
      if (!capturado) return;
      const a = ult[0], b = ult[ult.length - 1];
      const v = b && a && b.t > a.t ? (b.x - a.x) / (b.t - a.t) : 0;      // px por ms
      ir(x + Math.max(-1.6, Math.min(1.6, v)) * 320, 1100);               // inercia (acota al llegar)
    };
    caja.addEventListener('pointerup', soltar);
    caja.addEventListener('pointercancel', soltar);
    // el gesto se enseña una sola vez, al abrirse el portal
    function ensenar() {
      if (!motion || tocado || rango < 80) return;
      const base = x;
      ir(base + Math.min(rango * 0.22, 140), 900);
      setTimeout(() => { if (!tocado) ir(base, 1100); }, 1500);
    }
    if (img.complete) medir(false); else img.addEventListener('load', () => medir(false), { once: true });
    window.__mirador = { medir, get rango() { return rango; }, get x() { return x; }, ir };
    return { medir, ensenar };
  })();

  /* ============ 5. la panorámica: el scroll la recorre y se puede arrastrar entera ============ */
  (function pano() {
    const caja = $('#pano'), riel = $('#pano-riel');
    if (!caja || !riel || !motion) return;
    const img = $('img', riel);
    let rango = 0, base = 0, extra = 0, x = 0, anim = 0;
    const medir = () => { rango = Math.max(0, riel.offsetWidth - caja.clientWidth); };
    const pintar = () => {
      // lo que el scroll pone más lo que el usuario ha arrastrado, siempre dentro de la foto
      x = Math.max(-rango, Math.min(0, base + extra));
      riel.style.transform = `translate3d(${f(x)}px,0,0)`;
    };
    const crear = () => {
      medir();
      if (rango < 10) return;
      ScrollTrigger.create({
        trigger: caja, start: 'top bottom', end: 'bottom top', invalidateOnRefresh: true,
        onRefresh: medir,
        onUpdate: (st) => { base = -rango * st.progress; pintar(); },
      });
      // arrastre con inercia; el scroll vertical sigue siendo de la página (touch-action: pan-y)
      let px0 = 0, py0 = 0, e0 = 0, arr = false, cap = false, ult = [];
      caja.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        cancelAnimationFrame(anim);
        arr = true; cap = false; px0 = e.clientX; py0 = e.clientY; e0 = extra; ult = [{ t: performance.now(), x: extra }];
      });
      caja.addEventListener('pointermove', (e) => {
        if (!arr) return;
        const dx = e.clientX - px0, dy = e.clientY - py0;
        if (!cap) {
          if (Math.abs(dx) < 6 || Math.abs(dx) < Math.abs(dy)) return;
          cap = true; caja.classList.add('es-agarrado');
          try { caja.setPointerCapture(e.pointerId); } catch (err) {}
        }
        extra = e0 + dx; pintar();
        ult.push({ t: performance.now(), x: extra });
        if (ult.length > 6) ult.shift();
      });
      const soltar = () => {
        if (!arr) return;
        arr = false; caja.classList.remove('es-agarrado');
        if (!cap) return;
        const a = ult[0], b = ult[ult.length - 1];
        const v = b && a && b.t > a.t ? (b.x - a.x) / (b.t - a.t) : 0;
        const destino = extra + Math.max(-1.6, Math.min(1.6, v)) * 320;
        const x0 = extra, t0 = performance.now();
        const paso = (ahora) => {
          const t = Math.min(1, (ahora - t0) / 900);
          extra = x0 + (destino - x0) * (1 - Math.pow(1 - t, 3));
          // al topar con un extremo, el exceso se descarta para que no «pese» al volver a hacer scroll
          const total = base + extra;
          if (total > 0) extra = -base; else if (total < -rango) extra = -rango - base;
          pintar();
          if (t < 1) anim = requestAnimationFrame(paso);
        };
        anim = requestAnimationFrame(paso);
      };
      caja.addEventListener('pointerup', soltar);
      caja.addEventListener('pointercancel', soltar);
    };
    if (img.complete) crear(); else img.addEventListener('load', () => { crear(); ScrollTrigger.refresh(); }, { once: true });
  })();

  /* ============ 6. portal: la garita se abre como una ventana ============ */
  const cortina = $('#cortina');
  let heroEntrado = false;
  function entradaHero() {
    if (heroEntrado) return;
    heroEntrado = true;
    const h1 = $('.hero__tit');
    if (motion) {
      partir(h1);
      requestAnimationFrame(() => requestAnimationFrame(() => h1.classList.add('es-visto')));
      gsap.fromTo(['.hero .eti', '.hero__entra', '.hero__acc', '.hero__pie > *'], { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out', stagger: 0.07, delay: 0.25, immediateRender: true });
      if (mirador) setTimeout(() => mirador.ensenar(), 1300);
    }
  }

  function retirarCortina() {
    if (!cortina || cortina.hidden) return;
    cortina.hidden = true;
    raiz.classList.add('cortina-fuera');
    document.body.style.removeProperty('overflow');
    if (lenis) lenis.start();
    if (hayGSAP) { gsap.ticker.lagSmoothing(0); ScrollTrigger.refresh(); }
    entradaHero();
    mostrarCookies();
    lanzarTardias();
  }

  clearTimeout(window.__redCortina);
  const tarde = performance.now() > 2500;     // GSAP llegó tarde del CDN: no se anima
  const garitaCortina = $('#cortina-garita');
  if (cortina && motion && !tarde && garitaCortina) {
    raiz.classList.add('cortina-js');
    document.body.style.overflow = 'hidden';
    if (lenis) lenis.stop();
    const red = setTimeout(retirarCortina, 6500);         // red de seguridad

    const W = innerWidth, H = innerHeight;
    const lienzo = $('#cortina-lienzo');
    lienzo.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const mascara = $('#cortina-mascara');
    [['x', 0], ['y', 0], ['width', W], ['height', H]].forEach(([k, v]) => mascara.setAttribute(k, v));
    [$('#cortina-m-rect'), $('#cortina-fondo')].forEach((r) => { r.setAttribute('width', W); r.setAttribute('height', H); });
    // el texto del hero queda escondido desde el primer fotograma: si no, se vería entero por la ventana y luego reharía su entrada
    partir($('.hero__tit'));
    const hueco = $('#cortina-m-hueco');
    hueco.setAttribute('d', $('path', garitaCortina).getAttribute('d'));
    const logo = $('#cortina-logo');
    const texto = $('#cortina-texto');
    const txt = $('#cortina-txt');

    // la garita del logo (sólida, sobre el bosque) y, debajo, la misma garita como hueco de la máscara
    const vb = garitaCortina.viewBox.baseVal;
    const rg = garitaCortina.getBoundingClientRect();
    const S0 = rg.width / vb.width;
    const PIV = { x: 180, y: 56 };                       // un punto dentro de la cúpula (unidades del viewBox)
    const P0 = { x: rg.left + PIV.x * S0, y: rg.top + PIV.y * S0 };
    const S1 = Math.max(W / 2 / 120, H / 2 / 38) * 1.5;  // escala a la que la cúpula cubre toda la pantalla
    const est = { t: 0 };
    const poner = (t) => {
      const S = S0 * Math.pow(S1 / S0, t);
      const px = P0.x + (W / 2 - P0.x) * t, py = P0.y + (H / 2 - P0.y) * t;
      hueco.setAttribute('transform', `translate(${f(px - PIV.x * S)} ${f(py - PIV.y * S)}) scale(${f(S * 1e4) / 1e4})`);
    };
    poner(0);
    cortina.classList.add('es-mascara');

    // se espera (poco) a que la foto del hero esté lista: el primer fotograma ya tiene imagen
    const img = $('#mirador-img');
    const lista = img && !img.complete ? new Promise((r) => { img.addEventListener('load', r, { once: true }); setTimeout(r, 1400); }) : Promise.resolve();
    lista.then(() => {
      const fondo = $('#mirador-foto');
      const tl = gsap.timeline({ onComplete: () => { clearTimeout(red); retirarCortina(); } });
      tl.to(txt, { opacity: 1, duration: 0.6, ease: 'power2.out' }, 0)
        // 1) la garita se aclara: dentro de su silueta queda la vista de la ría
        .to(garitaCortina, { opacity: 0, duration: 0.8, ease: 'power2.inOut' }, 0.45)
        .fromTo(fondo, { scale: 1.16 }, { scale: 1, duration: 3.2, ease: 'power2.out', immediateRender: true }, 0.2)
        // 2) el rótulo se va
        .to([texto, txt], { opacity: 0, duration: 0.4, ease: 'power1.in' }, 1.55)
        // 3) la ventana crece hasta destapar la pantalla
        .to(est, { t: 1, duration: 1.35, ease: 'expo.inOut', autoRound: false, onUpdate: () => poner(est.t) }, 1.45)
        .add(() => entradaHero(), 2.4);
    });
  } else if (cortina) {
    cortina.hidden = true;
    raiz.classList.add('cortina-fuera');
    if (hayGSAP) gsap.ticker.lagSmoothing(0);
    entradaHero();
    lanzarTardias();
  } else {
    if (hayGSAP) gsap.ticker.lagSmoothing(0);
    entradaHero();
    lanzarTardias();
  }

  /* ============ 7. «Consultar esta»: preselecciona la habitación ============ */
  const selHab = $('#c-hab');
  $$('[data-elige]').forEach((a) => a.addEventListener('click', () => { if (selHab) selHab.value = a.dataset.elige; }));

  /* ============ 8. consulta → WhatsApp o correo ============ */
  (function consulta() {
    const form = $('#form-consulta');
    if (!form) return;
    const ent = $('#c-entrada'), sal = $('#c-salida'), nom = $('#c-nombre'), err = $('#form-error');
    const hoy = new Date();
    const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    ent.min = iso(hoy);
    sal.min = iso(new Date(hoy.getTime() + 864e5));
    ent.addEventListener('change', () => {
      if (!ent.value) return;
      const d = new Date(ent.value + 'T12:00');
      const manana = iso(new Date(d.getTime() + 864e5));
      sal.min = manana;
      if (!sal.value || sal.value <= ent.value) sal.value = manana;
    });
    const fecha = (v) => { const [y, m, d] = v.split('-'); return `${d}/${m}/${y}`; };
    let via = 'whatsapp';
    $$('button[type="submit"]', form).forEach((b) => b.addEventListener('click', () => { via = b.dataset.via; }));
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fallos = [];
      [ent, sal, nom].forEach((c) => c.removeAttribute('aria-invalid'));
      if (!ent.value) { fallos.push('la fecha de llegada'); ent.setAttribute('aria-invalid', 'true'); }
      if (!sal.value) { fallos.push('la fecha de salida'); sal.setAttribute('aria-invalid', 'true'); }
      if (!nom.value.trim()) { fallos.push('tu nombre'); nom.setAttribute('aria-invalid', 'true'); }
      if (ent.value && sal.value && sal.value <= ent.value) { fallos.push('una salida posterior a la llegada'); sal.setAttribute('aria-invalid', 'true'); }
      if (fallos.length) {
        err.textContent = 'Falta ' + fallos.join(', ') + '.';
        err.hidden = false;
        const primero = form.querySelector('[aria-invalid="true"]');
        if (primero) primero.focus();
        return;
      }
      err.hidden = true;
      const noches = Math.round((new Date(sal.value + 'T12:00') - new Date(ent.value + 'T12:00')) / 864e5);
      const hab = $('#c-hab');
      const nombreHab = hab.value ? hab.options[hab.selectedIndex].text : 'la que esté libre';
      const ad = $('#c-adultos').value, ni = $('#c-ninos').value;
      const nota = $('#c-nota').value.trim();
      const lineas = [
        'Hola, quería consultar disponibilidad en Casa Rural La Garita:',
        `· Llegada: ${fecha(ent.value)}`,
        `· Salida: ${fecha(sal.value)} (${noches} ${noches === 1 ? 'noche' : 'noches'})`,
        `· ${ad} ${ad === '1' ? 'adulto' : 'adultos'}${ni !== '0' ? `, ${ni} ${ni === '1' ? 'niño' : 'niños'}` : ''}`,
        `· Alojamiento: ${nombreHab}`,
      ];
      if (nota) lineas.push(`· ${nota}`);
      lineas.push('', `${nom.value.trim()}`);
      const msg = lineas.join('\n');
      const url = via === 'correo'
        ? `mailto:rural@casalagarita.com?subject=${encodeURIComponent(`Consulta: ${fecha(ent.value)} a ${fecha(sal.value)}`)}&body=${encodeURIComponent(msg)}`
        : `https://wa.me/34617633166?text=${encodeURIComponent(msg)}`;
      if (via === 'correo') location.href = url;
      else window.open(url, '_blank', 'noopener');
    });
  })();

  /* ============ 9. pie: la marea llena la garita ============ */
  (function pie() {
    const svgGarita = $('#pie-garita');
    const recorte = $('#pie-recorte-p');
    const ola = $('#pie-ola');
    const olaX = $('#pie-ola-x');
    const btn = $('#pie-cierre');
    if (!svgGarita || !recorte || !ola) return;
    const d = $('path', svgGarita).getAttribute('d');
    recorte.setAttribute('d', d);
    // la ola: tres longitudes de onda más que el ancho, para que pueda desplazarse sin huecos
    const Wd = 388.99, L = Wd / 2, A = 5;
    let p = `M${-L},0`;
    for (let i = 0; i < 6; i++) p += `q${f(L / 4)},${-A * 2} ${f(L / 2)},0 t${f(L / 2)},0`;
    p += `V420H${-L}Z`;
    ola.setAttribute('d', p);
    if (!motion) return;
    gsap.set(ola, { y: 352 });
    if (btn) gsap.set(btn, { opacity: 0, y: 14 });
    gsap.to(olaX, { x: -L, duration: 4.5, ease: 'none', repeat: -1 });
    const tl = gsap.timeline({ scrollTrigger: { trigger: '#pie', start: 'top 80%', end: 'bottom bottom', scrub: 0.6 } });
    tl.to(ola, { y: -6, duration: 1, ease: 'none', autoRound: false })
      .to(btn, { opacity: 1, y: 0, duration: 0.25, ease: 'power2.out' }, 0.75);
  })();

  /* ============ 10. cabecera, menú y anclas ============ */
  const cab = $('#cab');
  const oscuras = $$('.hero, .fuera, .consulta, .pie');
  let pendienteCab = 0;
  const alScroll = () => {
    pendienteCab = 0;
    cab.classList.toggle('sc', scrollY > 24);
    const y = cab.offsetHeight / 2;
    cab.classList.toggle('es-oscura', oscuras.some((s) => { const r = s.getBoundingClientRect(); return r.top <= y && r.bottom > y; }));
  };
  addEventListener('scroll', () => { if (!pendienteCab) pendienteCab = requestAnimationFrame(alScroll); }, { passive: true });
  alScroll();

  const btnMenu = $('#menu-btn'), menu = $('#menu-movil');
  const cerrarMenu = () => {
    document.body.classList.remove('menu');
    btnMenu.setAttribute('aria-expanded', 'false');
    menu.setAttribute('aria-hidden', 'true');
    if (lenis) lenis.start();
  };
  btnMenu.addEventListener('click', () => {
    const abierto = document.body.classList.toggle('menu');
    btnMenu.setAttribute('aria-expanded', String(abierto));
    menu.setAttribute('aria-hidden', String(!abierto));
    if (lenis) abierto ? lenis.stop() : lenis.start();
  });
  $$('a[href^="#"]').forEach((a) => {
    const destino = a.getAttribute('href');
    if (destino.length < 2) return;
    a.addEventListener('click', (e) => {
      if (!$(destino)) return;
      e.preventDefault();
      cerrarMenu();
      irA(destino);
      // el foco viaja con el scroll: el siguiente Tab sigue desde allí
      setTimeout(() => {
        if (destino === '#consulta') { $('#c-entrada').focus({ preventScroll: true }); return; }
        const t = $(destino);
        if (!t.hasAttribute('tabindex')) t.setAttribute('tabindex', '-1');
        t.focus({ preventScroll: true });
      }, 900);
    });
  });
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.body.classList.contains('menu')) { cerrarMenu(); btnMenu.focus(); }
  });

  /* ============ 11. cookies (y el mando se aparta mientras están) ============ */
  const ck = $('#cookies');
  const LLAVE = 'lagarita-cookies';
  const leer = () => { try { return localStorage.getItem(LLAVE); } catch (e) { return null; } };
  const guardar = (v) => { try { localStorage.setItem(LLAVE, v); } catch (e) {} };
  const mando = $('#mando');
  const verMando = () => { if (mando && raiz.classList.contains('revision')) mando.hidden = !ck.hidden; };
  let cookiesPendientes = !leer();
  function mostrarCookies() {
    if (!cookiesPendientes) { verMando(); return; }
    cookiesPendientes = false;
    ck.hidden = false;
    verMando();
  }
  const cerrarCk = (v) => { guardar(v); ck.hidden = true; verMando(); };
  $('#ck-si').addEventListener('click', () => cerrarCk('si'));
  $('#ck-no').addEventListener('click', () => cerrarCk('no'));
  $('#abrir-cookies').addEventListener('click', () => { ck.hidden = false; verMando(); $('#ck-si').focus(); });
  if (!cortina || cortina.hidden) mostrarCookies();

  /* ============ 12. barra fija en el móvil ============
     Solo con observadores: ningún resize (ni el de la barra del navegador) la toca. */
  (function barraMovil() {
    const barra = $('#barra');
    if (!barra) return;
    const movil = matchMedia('(max-width: 999px)');
    const dentro = { hero: true, consulta: false, pie: false };
    const pintar = () => {
      const ver = movil.matches && !dentro.hero && !dentro.consulta && !dentro.pie
        && !document.body.classList.contains('menu') && ck.hidden;
      barra.classList.toggle('es-visible', ver);
      barra.setAttribute('aria-hidden', String(!ver));
      $$('a', barra).forEach((a) => a.tabIndex = ver ? 0 : -1);
      raiz.classList.toggle('con-barra', ver);
    };
    const io = new IntersectionObserver((es) => { es.forEach((e) => { dentro[e.target.dataset.barra] = e.isIntersecting; }); pintar(); });
    [['hero', '.hero'], ['consulta', '#consulta'], ['pie', '#pie']].forEach(([k, s]) => { const el = $(s); if (el) { el.dataset.barra = k; io.observe(el); } });
    const mo = new MutationObserver(pintar);
    mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    mo.observe(ck, { attributes: true, attributeFilter: ['hidden'] });
    movil.addEventListener('change', pintar);
    pintar();
  })();

  /* ============ 13. mapa de Google solo al pedirlo ============ */
  $('#mapa-btn').addEventListener('click', () => {
    const marco = document.createElement('iframe');
    marco.src = 'https://www.google.com/maps?q=' + encodeURIComponent('42.25942,-8.76517 (Casa Rural La Garita)') + '&z=14&output=embed';
    marco.loading = 'lazy';
    marco.title = 'Mapa con la Casa Rural La Garita en Cangas do Morrazo';
    marco.referrerPolicy = 'no-referrer-when-downgrade';
    $('#mapa').appendChild(marco);
    $('#mapa-consent').remove();
  });

  /* ============ 16. MANDO DE MAQUETA (no viaja al cliente) ============ */
  if (mando && raiz.classList.contains('revision')) {
    const botones = $$('button[data-densidad]', mando);
    const pintarMando = () => botones.forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.densidad === 'sobria') === raiz.classList.contains('densidad-sobria'))));
    botones.forEach((b) => b.addEventListener('click', () => {
      raiz.classList.toggle('densidad-sobria', b.dataset.densidad === 'sobria');
      const u = new URL(location.href);
      if (b.dataset.densidad === 'sobria') u.searchParams.set('densidad', 'sobria'); else u.searchParams.delete('densidad');
      history.replaceState(null, '', u);
      pintarMando();
      if (hayGSAP) ScrollTrigger.refresh();
    }));
    pintarMando();
    verMando();
  }
  /* fin del MANDO DE MAQUETA */

  /* ============ 17. resize de verdad (no el de la barra del móvil) ============ */
  let tRes = 0;
  addEventListener('resize', () => {
    if (esBarra()) return;
    clearTimeout(tRes);
    tRes = setTimeout(() => {
      anchoVista = innerWidth; altoVista = innerHeight;
      if (mirador) mirador.medir(true);
      if (hayGSAP) ScrollTrigger.refresh();
    }, 200);
  });
  addEventListener('load', () => { if (hayGSAP) ScrollTrigger.refresh(); });
})();
