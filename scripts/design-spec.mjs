#!/usr/bin/env node
// design-spec.mjs <intakes/<slug>/figma/<vN>/<superficie>/specs/<pantalla>> [--system "<nombre>"] [--font "<familia>"] [--json]
//
// raw-<estado>.json (lo que extrajo el navegador con design-extract.js) → en la misma carpeta:
//   spec.json            cada elemento por estado con su valor y su token (`var(--x)`) del sistema del prototipo
//   copy.md              los textos en orden de lectura, `tamaño/peso` + texto
//   token-findings.json  valores fuera de los tokens del sistema (lo lee design-avalidar.mjs)
// El nombre del sistema sale de `--system` o del readme de `<superficie>/source/_ds/<ds>/`; la familia
// tipográfica esperada, de `--font` o de los tokens `--font-*`; las escalas, de `--text-*`, `--radius-*` y
// `--shadow-*`. Nada queda fijo a un portal.
//
// Contrato con Dev (OlePilot design-source.sh / design-check.sh): `designSystem` = "<nombre> (<ruta a tokens>)",
// `states[].state`, `states[].elements[]` con `{ token: "var(--x)" }`, y las líneas `- \`tam/peso\` texto` de copy.md.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { specLayout, designSystemOf, relFromIntake } from './lib/design.mjs';

const args = process.argv.slice(2);
const opt = f => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const dir = args[0] && !args[0].startsWith('--') ? resolve(args[0]) : null;
if (!dir || !existsSync(dir)) { console.error('uso: design-spec.mjs <…/specs/<pantalla>> [--system "<nombre>"] [--font "<familia>"] [--json]'); process.exit(1); }

const rawFiles = readdirSync(dir).filter(f => f.startsWith('raw-') && f.endsWith('.json')).sort();
if (!rawFiles.length) { console.error(`✗ ${dir}: no hay raw-*.json (extraelos con design-extract.js)`); process.exit(1); }
const raws = rawFiles.map(f => JSON.parse(readFileSync(join(dir, f), 'utf8')));
const tok = raws[0].tokens || {};

const byHex = new Map();
for (const [k, v] of Object.entries(tok)) if (/^#[0-9A-F]{6}$/.test(v)) { if (!byHex.has(v)) byHex.set(v, []); byHex.get(v).push(k); }
const ctok = v => {
  if (!v) return null;
  const at = v.indexOf('@');
  const base = at >= 0 ? v.slice(0, at) : v, alpha = at >= 0 ? v.slice(at + 1) : '';
  const names = byHex.get(base);
  const t = names ? names[0] : null;
  return { value: v, token: t ? `var(${t})${alpha ? ` @${alpha}` : ''}` : null, aliases: names ? names.slice(1) : [] };
};
const lastWins = (pred) => { const m = new Map(); for (const [k, v] of Object.entries(tok)) if (pred(k, v)) m.set(v, k); return m; };
const FS = lastWins((k, v) => k.startsWith('--text-') && v.endsWith('px'));
const RAD = lastWins(k => k.startsWith('--radius-'));

const g6 = x => String(Number(Number(x).toPrecision(6)));
// Sombra computada o de token, comparable: colores a hex(@alfa), sin "px", partes y capas ordenadas.
const shnorm = v => {
  const s = v.replace(/rgba?\(([^)]*)\)/g, (_, inner) => {
    const p = inner.split(',').map(x => x.trim());
    const h = '#' + p.slice(0, 3).map(x => Math.trunc(parseFloat(x)).toString(16).toUpperCase().padStart(2, '0')).join('');
    return h + (p.length === 4 && parseFloat(p[3]) < 1 ? `@${g6(p[3])}` : '');
  }).replace(/px/g, '');
  return s.split(/,(?![^(]*\))/).map(l => l.trim().toUpperCase().split(/\s+/).filter(x => x && x !== '0' && x !== '0.0').sort().join(' ')).sort().join('|');
};
const SH = new Map();
for (const [k, v] of Object.entries(tok)) if (k.startsWith('--shadow-')) SH.set(shnorm(v), k);

const fontTokens = Object.entries(tok).filter(([k, v]) => k.startsWith('--font-') && /["',]/.test(v));
const families = new Set(opt('--font') ? [opt('--font')] : fontTokens.map(([, v]) => v.split(',')[0].trim().replace(/^["']|["']$/g, '')));

const px = v => parseFloat(v);
const scaleOf = m => [...m.keys()].sort((a, b) => px(b) - px(a)).map(v => (px(v) >= 9999 ? '9999 (pill)' : String(px(v)))).join(' · ');
const SCALE = {
  'Tamaño de letra fuera de la escala': FS.size ? `Escala: ${scaleOf(FS)} px` : 'El sistema no define tokens `--text-*` en px',
  'Radio fuera de la escala': RAD.size ? `Escala: ${[...new Set([...RAD.keys()].map(px))].sort((a, b) => a - b).map(n => (n >= 9999 ? '9999 (pill)' : String(n))).join(' · ')} px` : 'El sistema no define tokens `--radius-*`',
  'Sombra sin token': SH.size ? `Tokens: ${[...SH.values()].map(k => `\`${k}\``).join(', ')}` : 'El sistema no define tokens `--shadow-*`',
  'Fuente distinta': families.size ? `Familia del sistema: ${[...families].join(', ')}` : '',
};

const issues = new Map();
const flag = (kind, val, where) => { const k = `${kind}\u0000${val}`; if (!issues.has(k)) issues.set(k, { kind, val, where: [] }); issues.get(k).where.push(where); };

const states = raws.map(raw => {
  const elements = (raw.nodes || []).map(n => {
    const e = { i: n.i, tag: n.tag, box: [n.x, n.y, n.w, n.h] };
    const where = (n.text || `<${n.tag}> ${n.w}×${n.h}`).slice(0, 60);
    if (n.text) {
      const [fam, fs, fw, lh, tt, ls] = n.font.split('|');
      e.text = n.text;
      e.font = { family: fam, size: fs, sizeToken: FS.has(fs) ? `var(${FS.get(fs)})` : null, weight: fw, lineHeight: lh, transform: tt, letterSpacing: ls };
      e.color = ctok(n.color);
      if (n.deco) e.decoration = n.deco;
      if (!FS.has(fs)) flag('Tamaño de letra fuera de la escala', fs, where);
      if (families.size && !families.has(fam)) flag('Fuente distinta', fam, where);
      if (!e.color.token) flag('Color de texto sin token', n.color, where);
    }
    if (n.bg) {
      e.background = ctok(n.bg);
      if (!e.background.token) flag('Fondo sin token', n.bg, where);
    }
    if (n.border) {
      const sp = n.border.indexOf(' ');
      const w = n.border.slice(0, sp), c = n.border.slice(sp + 1);
      e.border = { width: w, color: ctok(c) };
      if (!e.border.color.token) flag('Borde sin token', c, where);
    }
    if (n.radius) {
      const r = n.radius, rt = RAD.get(r) || (r === '50%' ? '--radius-full' : null);
      e.radius = { value: r, token: rt ? `var(${rt})` : null };
      if (!rt) flag('Radio fuera de la escala', r, where);
    }
    if (n.shadow) {
      const t = SH.get(shnorm(n.shadow));
      e.shadow = { value: n.shadow, token: t ? `var(${t})` : null };
      if (!t) flag('Sombra sin token', n.shadow, where);
    }
    if (n.pad) e.padding = n.pad;
    return e;
  });
  return { state: raw.label, viewport: raw.viewport, elements };
});

const lay = specLayout(dir);
const ds = lay ? designSystemOf(lay.supDir, opt('--system')) : { name: opt('--system') || '?', dirs: [] };
const tokensPath = lay && ds.dirs.length ? relFromIntake(lay.intakeDir, ds.tokensDirs[0]) : 'sin _ds/ congelado';
let source = String(raws[0].url || '').split('/source/').pop();
try { source = decodeURIComponent(source); } catch { source = source.replace(/%20/g, ' '); }
const spec = { source, designSystem: `${ds.name} (${tokensPath})`, states };
writeFileSync(join(dir, 'spec.json'), JSON.stringify(spec, null, 1));

const seen = new Set(), lines = [];
for (const st of states) {
  lines.push(`\n## ${st.state}\n`);
  const texts = st.elements.filter(e => e.text).sort((a, b) => (Math.floor(a.box[1] / 8) - Math.floor(b.box[1] / 8)) || (a.box[0] - b.box[0]));
  for (const e of texts) {
    if (st.state !== states[0].state && seen.has(e.text)) continue;
    seen.add(e.text);
    lines.push(`- \`${e.font.size}/${e.font.weight}\` ${e.text}`);
  }
}
writeFileSync(join(dir, 'copy.md'), '# Textos de la pantalla\n\nOrden de lectura (arriba→abajo). `tamaño/peso`. Los datos de ejemplo (nombres, montos, fechas) son ficticios del prototipo.\n' + lines.join('\n') + '\n');

const findings = [...issues.values()].map(x => ({ tipo: x.kind, valor: x.val, usos: x.where.length, ejemplos: x.where.slice(0, 4), escala: SCALE[x.kind] || '' }));
writeFileSync(join(dir, 'token-findings.json'), JSON.stringify(findings, null, 1));

const nEl = states.reduce((a, s) => a + s.elements.length, 0);
const tokenized = states.flatMap(s => s.elements).flatMap(e => [e.color, e.background, e.border && e.border.color, e.radius, e.shadow].filter(Boolean));
const summary = { dir, states: states.map(s => s.state), elements: nEl, values: tokenized.length, withToken: tokenized.filter(x => x.token).length, designSystem: spec.designSystem, findings: findings.map(f => ({ tipo: f.tipo, valor: f.valor, usos: f.usos })) };
if (args.includes('--json')) { console.log(JSON.stringify(summary, null, 2)); process.exit(0); }
console.log(`🗿 ${lay ? `${lay.superficie}/specs/${lay.pantalla}` : dir} · ${states.length} estado(s) · ${nEl} elementos · ${summary.withToken}/${summary.values} valores con token · ${spec.designSystem}`);
for (const f of findings) console.log(`  ${f.tipo} | ${f.valor} | ${f.usos} | ${f.ejemplos.slice(0, 3).join('; ')}`);
