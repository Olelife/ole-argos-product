#!/usr/bin/env node
// design-avalidar.mjs <intakes/<slug>/figma/<vN>/<superficie>/specs/<pantalla>> [--title "<pantalla>"] [--stories "<S19 (SO-1357)…>"]
//                     [--export-date YYYY-MM-DD] [--system-duda <N>] [--system-note "<texto>"]
//
// token-findings.json + notas.md → a-validar.md de la pantalla (lo que Diseño tiene que mirar):
//   §1 Textos y comportamiento vs PRD y decisiones — viene de notas.md, curada por Argos con la tabla
//      | # | Qué muestra el diseño | PRD / decisión | Para Diseño |   (una fila por diferencia o coincidencia relevante)
//   §2 Valores fuera de los tokens del sistema — se genera de token-findings.json, con la escala del propio sistema.
// Lo que no viene por argumento sale del intake: título e historias de la fila de la pantalla en la tabla
// "Especificación por pantalla" del MANIFEST, la fecha del export de su línea **Captura:**, el nombre del
// sistema del spec.json, y el estado de la duda del sistema de tokens (--system-duda) del decision-log.
// No pisa un a-validar.md escrito a mano (sin el marcador <!-- auto -->).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { readMaybe, DUDAS, DUDA, dudaOpen } from './lib/md.mjs';
import { specLayout, findTable, cell, sameKey, checkNotas, SPECS_HEADERS, NOTAS_HEADERS } from './lib/design.mjs';

const args = process.argv.slice(2);
const opt = f => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const dir = args[0] && !args[0].startsWith('--') ? resolve(args[0]) : null;
if (!dir || !existsSync(join(dir, 'spec.json'))) { console.error('uso: design-avalidar.mjs <…/specs/<pantalla>> [--title T] [--stories S] [--export-date D] [--system-duda N] [--system-note T] (corré design-spec.mjs antes)'); process.exit(1); }
const out = join(dir, 'a-validar.md');
if (existsSync(out) && !readFileSync(out, 'utf8').includes('<!-- auto -->')) { console.log(`skip (escrito a mano): ${out}`); process.exit(0); }

const spec = JSON.parse(readFileSync(join(dir, 'spec.json'), 'utf8'));
const findings = JSON.parse(readMaybe(join(dir, 'token-findings.json')) || '[]');
const lay = specLayout(dir);
const manifest = lay ? readMaybe(join(lay.versionDir, 'MANIFEST.md')) : '';
const t = manifest ? findTable(manifest, SPECS_HEADERS.slice(0, 3)) : null;
const row = t && lay ? t.rows.find(r => [`${lay.superficie}/specs/${lay.pantalla}`, lay.pantalla].some(k => sameKey(cell(t, r, 'Carpeta'), k))) : null;

const title = opt('--title') || (row && cell(t, row, 'Pantalla')) || (lay ? lay.pantalla : 'Pantalla');
const stories = opt('--stories') || (row && cell(t, row, 'Historias').replace(/^—$/, '')) || '';
const exportDate = opt('--export-date') || (manifest.match(/\*\*Captura:\*\*\s*(\d{4}-\d{2}-\d{2})/) || [])[1] || 'fecha sin registrar';
const width = (spec.states[0] && spec.states[0].viewport && spec.states[0].viewport[0]) || '?';
const systemName = String(spec.designSystem || '?').split(' (')[0];

let systemTail = '';
const nDuda = opt('--system-duda');
if (nDuda && lay) {
  const d = DUDAS(readMaybe(join(lay.intakeDir, 'decision-log.md'))).find(r => String(DUDA.id(r)).replace(/\D/g, '') === String(nDuda).replace(/\D/g, ''));
  if (d) {
    const st = String(DUDA.state(d)).replace(/[*`_]/g, '').trim();
    const first = String(DUDA.answer(d) || '').replace(/\*\*/g, '').replace(/^\s*default:\s*/i, '').split(/[.;:]\s/)[0].trim();
    const ans = first.length > 100 ? `${first.slice(0, 100).replace(/\s+\S*$/, '')}…` : first;
    systemTail = ` (#${String(nDuda).replace(/\D/g, '')}, ${st}${ans && dudaOpen(d) ? `; default: ${ans}` : ''})`;
  } else systemTail = ` (#${String(nDuda).replace(/\D/g, '')})`;
}
const systemLine = opt('--system-note') || `**${systemName}**, el del prototipo${systemTail}`;

const notasPath = join(dir, 'notas.md');
const notasText = readMaybe(notasPath).trim();
const notas = checkNotas(notasText);
const warns = [];
if (!notasText) warns.push('falta notas.md: la §1 queda sin el cruce con el PRD y el decision-log');
else if (!notas.ok) warns.push(notas.why);

const byKind = new Map();
for (const f of findings) { if (!byKind.has(f.tipo)) byKind.set(f.tipo, []); byKind.get(f.tipo).push(f); }

const L = ['<!-- auto -->', `# ${title} — a validar con Diseño`, '',
  `${stories ? `${stories}. ` : ''}Fuente: \`${spec.source}\` (export del ${exportDate}, ${width} px). Estados: ${spec.states.map(s => `*${s.state}*`).join('; ')}.`,
  `Sistema de diseño de referencia: ${systemLine}. Detalle por elemento en \`spec.json\`; textos en \`copy.md\`.`,
  'En los estados con modal, la extracción incluye también la pantalla de fondo.', '',
  '## 1. Textos y comportamiento vs PRD y decisiones', '',
  notasText || '_Sin diferencias de texto o comportamiento registradas (falta `notas.md`)._', '',
  '## 2. Valores fuera de los tokens del sistema', ''];
if (!byKind.size) L.push('Todos los valores usan tokens del sistema.');
for (const [tipo, items] of byKind) {
  L.push(`**${tipo}.** ${items[0].escala || ''}`.trimEnd(), '', '| Valor | Usos | Ejemplos |', '|---|---|---|');
  for (const it of [...items].sort((a, b) => b.usos - a.usos)) L.push(`| \`${it.valor}\` | ${it.usos} | ${it.ejemplos.slice(0, 3).map(e => e.replace(/\|/g, '/')).join('; ')} |`);
  L.push('');
}
writeFileSync(out, L.join('\n').trimEnd() + '\n');

const accion = notas.ok ? notas.accion.length : 0;
console.log(`🗿 a-validar · ${title}: ${notas.ok ? `${notas.rows.length} fila(s) de notas, ${accion} para Diseño` : 'sin notas'} · ${findings.length} valor(es) fuera de token`);
for (const w of warns) console.log(`  ⚠ ${w}${w.startsWith('notas.md sin') ? '' : ` — formato: | ${NOTAS_HEADERS.join(' | ')} |`}`);
