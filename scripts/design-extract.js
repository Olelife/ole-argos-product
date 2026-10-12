// design-extract.js — corre EN EL NAVEGADOR, con el prototipo abierto vía design-serve.mjs a 1440 px de ancho.
// Inyectar: eval(await (await fetch('/__extract.js')).text())
//
//   __side(opts)                → qué barra lateral se excluye: { x, by } (verificarlo antes de extraer)
//   __extract(label, opts)      → estilos computados de lo visible + tokens del :root (el raw-<estado>.json)
//   __save(path, obj)           → lo guarda vía el servidor (solo <superficie>/specs/<pantalla>/raw-*.json)
//   __findLogic(key)            → la lógica (estado) del prototipo .dc.html cuyo state tiene `key`
//   __cap(path, label, patch, ms, opts) → lleva el prototipo a un estado con setState(patch), extrae y guarda
//
// opts.side controla la barra lateral que NO es parte de la pantalla (menú del portal):
//   'auto' (default) · un selector CSS ('nav.rail') · un ancho en px (70) · 'none'.
//   `window.__argos = { side: … }` lo fija para toda la sesión; `window.__sideX = <px>` sigue valiendo.
(() => {
  const W = () => window.innerWidth, H = () => window.innerHeight;
  const plausible = r => r.left <= 4 && r.width >= 40 && r.width <= W() * 0.35;

  window.__side = (opts = {}) => {
    const side = opts.side ?? (window.__argos || {}).side ?? 'auto';
    if (typeof side === 'number') return { x: side, by: 'px' };
    if (typeof window.__sideX === 'number') return { x: window.__sideX, by: '__sideX' };
    if (side === 'none') return { x: 0, by: 'none' };
    if (typeof side === 'string' && side !== 'auto') {
      const el = document.querySelector(side);
      return el ? { x: Math.round(el.getBoundingClientRect().right), by: `selector ${side}` } : { x: 0, by: `selector sin coincidencias: ${side}` };
    }
    // Riel o menú anclado a la izquierda y de alto completo: un <nav>/<aside> (o el contenedor que lo
    // envuelve) o, si el prototipo no usa etiquetas semánticas, un bloque fixed/sticky con esa forma.
    // Un drawer a la derecha (<aside> de un modal lateral) no está anclado a la izquierda y no cuenta.
    const tall = el => el.getBoundingClientRect().height >= Math.min(H(), document.documentElement.scrollHeight) * 0.6;
    let best = null;
    const consider = (el, by) => {
      let top = el;
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const r = p.getBoundingClientRect();
        if (!plausible(r)) break;
        if (r.height > top.getBoundingClientRect().height) top = p;
      }
      const r = top.getBoundingClientRect();
      if (plausible(r) && tall(top) && (!best || r.right > best.x)) best = { x: Math.round(r.right), by };
    };
    for (const el of document.querySelectorAll('nav, aside, [role="navigation"]')) if (plausible(el.getBoundingClientRect())) consider(el, `<${el.tagName.toLowerCase()}>`);
    if (best) return best;
    for (const el of document.body.querySelectorAll('*')) {
      const pos = getComputedStyle(el).position;
      if ((pos === 'fixed' || pos === 'sticky') && plausible(el.getBoundingClientRect())) consider(el, `bloque ${pos}`);
    }
    if (best) return best;
    // Columna izquierda de un layout en fila (flex/grid estático): angosta, de alto completo, dentro de algo
    // más ancho. El tope de 300 px deja afuera el listado de un maestro-detalle.
    for (const el of document.body.querySelectorAll('*')) {
      const r = el.getBoundingClientRect(), pr = el.parentElement && el.parentElement.getBoundingClientRect();
      if (plausible(r) && r.top <= 4 && r.width <= 300 && r.height >= H() * 0.9 && pr && pr.width > r.width * 1.5 && (!best || r.right > best.x)) best = { x: Math.round(r.right), by: 'columna izquierda del layout' };
    }
    if (best) return best;
    const label = [...document.querySelectorAll('*')].find(e => ['Mi Agencia', 'Contratos'].includes(e.textContent.trim()));
    if (label) return { x: Math.round(label.closest('aside,nav,div').getBoundingClientRect().right), by: 'texto del menú (heurística vieja)' };
    return { x: 0, by: 'sin barra lateral' };
  };

  window.__extract = (label, opts = {}) => {
    const toHex = c => { const m = c && c.match(/rgba?\(([^)]+)\)/); if (!m) return c; const p = m[1].split(',').map(s => parseFloat(s)); if (p.length === 4 && p[3] === 0) return 'transparent'; const h = '#' + p.slice(0, 3).map(x => Math.round(x).toString(16).padStart(2, '0')).join('').toUpperCase(); return (p.length === 4 && p[3] < 1) ? h + '@' + p[3] : h; };
    const names = new Set();
    for (const ss of document.styleSheets) { let rules; try { rules = ss.cssRules; } catch (e) { continue; } for (const r of rules) { if (r.style) { for (const k of r.style) { if (k.startsWith('--')) names.add(k); } } } }
    const rs = getComputedStyle(document.documentElement); const tokens = {};
    for (const n of names) { const v = rs.getPropertyValue(n).trim(); if (v) tokens[n] = v.startsWith('#') ? v.toUpperCase() : v; }
    const side = window.__side(opts); const sideX = side.x;
    const out = []; let id = 0;
    for (const el of document.body.querySelectorAll('*')) {
      const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue; if (r.left < sideX - 5) continue; const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) continue;
      const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').replace(/\s+/g, ' ').trim();
      const bg = toHex(cs.backgroundColor); const br = cs.borderTopWidth !== '0px' && cs.borderTopStyle !== 'none' ? cs.borderTopWidth + ' ' + toHex(cs.borderTopColor) : null; const rad = cs.borderTopLeftRadius !== '0px' ? cs.borderTopLeftRadius : null; const sh = cs.boxShadow !== 'none' ? cs.boxShadow : null;
      const deco = cs.textDecorationLine !== 'none' ? cs.textDecorationLine : undefined;
      if (!own && bg === 'transparent' && !br && !sh) continue;
      out.push({ i: id++, tag: el.tagName.toLowerCase(), text: own || undefined, x: Math.round(r.left), y: Math.round(r.top + window.scrollY), w: Math.round(r.width), h: Math.round(r.height),
        font: own ? `${cs.fontFamily.split(',')[0].replace(/"/g, '')}|${cs.fontSize}|${cs.fontWeight}|${cs.lineHeight}|${cs.textTransform}|${cs.letterSpacing}` : undefined, color: own ? toHex(cs.color) : undefined, deco, bg: bg !== 'transparent' ? bg : undefined, border: br || undefined, radius: rad || undefined, shadow: sh || undefined, pad: (bg !== 'transparent' || br) ? cs.padding : undefined });
    }
    return { label, url: location.href, viewport: [innerWidth, innerHeight], pageH: document.documentElement.scrollHeight, sideX, sideBy: side.by, tokens, nodes: out };
  };

  window.__save = async (path, obj) => (await fetch('/__save?path=' + encodeURIComponent(path), { method: 'POST', body: JSON.stringify(obj, null, 1) })).text();

  // Las claves del state de cada lógica del prototipo, para elegir con qué patch se llega a cada estado.
  window.__logicKeys = () => { const out = [], seen = new Set(); for (const el of document.querySelectorAll('*')) { const k = Object.keys(el).find(k => k.startsWith('__reactFiber$')); if (!k) continue; for (let f = el[k]; f; f = f.return) { const sn = f.stateNode; if (sn && !seen.has(sn) && sn.logic && sn.logic.state) { seen.add(sn); out.push(Object.fromEntries(Object.entries(sn.logic.state).map(([key, v]) => [key, Array.isArray(v) ? `[${v.length}]` : (v && typeof v === 'object') ? '{…}' : v]))); } } } return out; };

  window.__findLogic = (key) => { const seen = new Set(); for (const el of document.querySelectorAll('*')) { const k = Object.keys(el).find(k => k.startsWith('__reactFiber$')); if (!k) continue; let f = el[k]; while (f) { const sn = f.stateNode; if (sn && !seen.has(sn) && sn.logic && sn.logic.state && key in sn.logic.state) return sn.logic; if (sn) seen.add(sn); f = f.return; } } return null; };

  window.__cap = async (path, label, patch, ms = 900, opts = {}) => {
    const logic = opts.logic || window.__L;
    if (patch) { if (!logic) throw new Error('sin lógica: window.__L = __findLogic("<clave del state>")'); await new Promise(r => logic.setState(patch, r)); }
    await new Promise(r => setTimeout(r, ms)); window.scrollTo(0, 0);
    const d = window.__extract(label, opts);
    return (await window.__save(path, d)) + ' · ' + d.nodes.length + ' nodos · barra lateral ' + d.sideX + ' px (' + d.sideBy + ')';
  };
})();
