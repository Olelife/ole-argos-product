#!/usr/bin/env node
// tc-draft.mjs <intakeDir>  → escribe <intakeDir>/test-cases-draft.csv
//
// Siembra al QA: convierte cada criterio de aceptación Dado/cuando/entonces de las historias en un caso de
// prueba borrador, con las MISMAS columnas que el CSV que el QA entrega (ID · Sección · Caso de prueba ·
// Pasos · Resultado esperado · Prioridad · Sin confirmar), así `test-map.mjs` lo lee igual.
//   Sección = historia · Pasos = "Dado … cuando …" · Resultado = "entonces …" · Prioridad = la de la historia
//   Sin confirmar = Sí cuando la historia está 🟡/🚧 o el criterio trae [POR DEFINIR] / "⚠️".
// Es un borrador: el QA lo depura y lo guarda como test-cases.csv. No reemplaza su criterio.
import { writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { readMaybe, parseFrontmatter, parseTable, STORY, col, stateOf } from './lib/md.mjs';

const dir = process.argv[2];
if (!dir) { console.error('uso: tc-draft.mjs <intakeDir>'); process.exit(1); }
const fm = parseFrontmatter(readMaybe(join(dir, 'STATUS.md')));
const slug = fm.slug || basename(dir);
const storiesMd = readMaybe(join(dir, 'stories.md')), prd = readMaybe(join(dir, `PRD-${slug}.md`)), preview = readMaybe(join(dir, 'jira-preview.md'));
const stories = parseTable(storiesMd, 'Historia');
const sidOf = id => { const m = String(id).match(/\b([SH]\d+[a-z]?)\s*$/i); return m ? m[1].toUpperCase() : ''; };
const esc = s => s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
function sectionFor(text, sid, fullId) {
  const rx = new RegExp(`^#{2,4}\\s+[^\\n]*\\b(?:${esc(fullId)}|${sid})\\b[^\\n]*\\n([\\s\\S]*?)(?=^#{2,4}\\s|$(?![\\s\\S]))`, 'mi');
  const m = text.match(rx); return m ? m[1] : '';
}
const CRIT = /^\s*[-*]\s*(?:\[[ x]\]\s*)?(?:\**(CA-[\w.]+)\**\s*[·:-]\s*)?\**((?:Dad[oa]s?|Cuando)\b[^\n]+)$/gim;
const q = s => `"${String(s ?? '').replace(/"/g, '""')}"`;
const rows = [['ID', 'Sección', 'Caso de prueba', 'Pasos', 'Resultado esperado', 'Prioridad', 'Sin confirmar', 'Historia', 'CA']];
let n = 0, perStory = 0, stWith = 0;
for (const r of stories) {
  const st = stateOf(STORY.state(r)); if (['descartada', 'desestimada', 'movida'].includes(st)) continue;
  const id = STORY.id(r), sid = sidOf(id);
  const body = [sectionFor(storiesMd, sid, id), sectionFor(prd, sid, id), sectionFor(preview, sid, id)].join('\n');
  const seen = new Set(); perStory = 0;
  for (const m of body.matchAll(CRIT)) {
    const text = m[2].replace(/\*\*/g, '').replace(/\s+/g, ' ').trim(); if (seen.has(text)) continue; seen.add(text);
    const parts = text.match(/^(Dad[oa]s?\b.*?)(?:,\s*)?\b(cuando\b.*?)?(?:,\s*)?\b(entonces\b.*)$/i);
    const pasos = parts ? [parts[1], parts[2]].filter(Boolean).join(', ') : text;
    const resultado = parts && parts[3] ? parts[3] : (/^Cuando/i.test(text) ? text : '');
    const unsure = /\[POR DEFINIR|⚠️|sin confirmar/i.test(text) || /[🟡🚧]/u.test(STORY.ready(r));
    n++; perStory++;
    const caso = parts && parts[2] ? parts[2].replace(/^cuando\s+/i, '') : text.replace(/^Dad[oa]s?\s+/i, '').split(/,\s*entonces\s+/i)[0];
    rows.push([`TC-D${String(n).padStart(2, '0')}`, `${sid} · ${STORY.title(r)}`, (caso.charAt(0).toUpperCase() + caso.slice(1)).slice(0, 110), pasos, resultado, col(r, 'prioridad') ? ({ P0: 'Alta', P1: 'Media', P2: 'Baja' }[col(r, 'prioridad').toUpperCase().trim()] || 'Media') : 'Media', unsure ? 'Sí' : '', STORY.jira(r) || id, m[1] || '']);
  }
  if (perStory) stWith++;
}
const out = join(dir, 'test-cases-draft.csv');
writeFileSync(out, rows.map(r => r.map(q).join(',')).join('\n') + '\n');
console.log(`✓ ${out}: ${n} casos borrador desde ${stWith} historias con criterios${stories.length - stWith ? ` (${stories.length - stWith} sin criterios verificables)` : ''}`);
