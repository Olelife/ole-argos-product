#!/usr/bin/env node
// test-map.mjs <intakeDir>  → escribe/actualiza <intakeDir>/test-map.md
//
// Incorpora los casos de prueba del QA como artefacto del intake. Lee test-cases.csv (columnas
// esperadas: ID · Sección · Caso de prueba · Pasos · Resultado esperado · Prioridad · Sin confirmar;
// el orden no importa, se leen por nombre) y produce la matriz de cobertura sección ↔ historia:
//   · TCs por sección, cuántos de prioridad Alta, cuántos "sin confirmar".
//   · Historia(s): las keys de Jira / ids S<n> que el CSV menciona en la sección, o el mapeo manual de
//     la tabla `## Mapeo sección → historia` de test-map.md (que se conserva entre corridas).
//   · Cobertura: 🟢 mapeada · ⚪ sin historia · 🟠 con TCs "sin confirmar" (dudas del QA).
// La matriz vive entre <!-- argos:auto --> … <!-- /argos:auto -->; el resto del archivo es del PM.
import { existsSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { readMaybe, parseFrontmatter, parseTable, parseTableNamed, col, STORY, jiraKey } from './lib/md.mjs';

const dir = process.argv[2];
if (!dir) { console.error('uso: test-map.mjs <intakeDir>'); process.exit(1); }
const csvPath = join(dir, 'test-cases.csv');
if (!existsSync(csvPath)) { console.error(`✗ falta ${csvPath} (dejá ahí el CSV del QA)`); process.exit(1); }

function parseCsv(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim()));
}
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const [header, ...data] = parseCsv(readMaybe(csvPath));
const H = header.map(norm);
const ix = (...names) => { for (const n of names) { const i = H.findIndex(h => h === norm(n)); if (i >= 0) return i; } for (const n of names) { const i = H.findIndex(h => h.includes(norm(n))); if (i >= 0) return i; } return -1; };
const cId = ix('ID'), cSec = ix('Sección', 'Seccion', 'Módulo'), cPri = ix('Prioridad'), cUnc = ix('Sin confirmar', 'Duda');
if (cSec < 0) { console.error('✗ el CSV no tiene columna "Sección"'); process.exit(1); }

const fm = parseFrontmatter(readMaybe(join(dir, 'STATUS.md')));
const title = fm.title || basename(dir);
const stories = parseTable(readMaybe(join(dir, 'stories.md')), 'Historia');
const knownKeys = new Set(stories.map(STORY.jira).filter(Boolean));
const sidToKey = new Map(stories.map(r => [String(STORY.id(r)).match(/\b([SH]\d+[a-z]?)\s*$/i)?.[1]?.toUpperCase(), STORY.jira(r)]).filter(([s]) => s));

const mapPath = join(dir, 'test-map.md');
const prev = readMaybe(mapPath);
const manual = new Map();
const mm = prev.match(/^##\s+Mapeo sección → historia[\s\S]*?(?=^##\s|\Z)/m);
if (mm) for (const r of parseTableNamed(mm[0], 'Sección').rows) manual.set(norm(col(r, 'seccion', 'sección')), col(r, 'historia'));

const sections = new Map();
for (const r of data) {
  const sec = (r[cSec] || '').trim(); if (!sec) continue;
  const s = sections.get(sec) || { sec, n: 0, alta: 0, unc: 0, keys: new Set(), ids: [] };
  s.n++; if (/^alta$/i.test((r[cPri] || '').trim())) s.alta++;
  if (cUnc >= 0 && /^(s[ií]|x|yes|true)$/i.test((r[cUnc] || '').trim())) s.unc++;
  if (cId >= 0) s.ids.push(r[cId]);
  const txt = r.join(' ');
  for (const k of txt.matchAll(/\b([A-Z][A-Z0-9]+-\d+)\b/g)) if (knownKeys.has(k[1])) s.keys.add(k[1]);
  for (const m of txt.matchAll(/\b(S\d+[a-z]?)\b/g)) { const k = sidToKey.get(m[1].toUpperCase()); if (k) s.keys.add(k); else if (sidToKey.has(m[1].toUpperCase())) s.keys.add(m[1].toUpperCase()); }
  sections.set(sec, s);
}
const secs = [...sections.values()];
const tot = secs.reduce((a, s) => a + s.n, 0), totUnc = secs.reduce((a, s) => a + s.unc, 0);
const rowsMd = secs.map(s => {
  const man = manual.get(norm(s.sec)) || '';
  const hist = man && man !== '—' ? man : ([...s.keys].join(' · ') || '—');
  const cov = hist === '—' ? '⚪ sin historia' : s.unc ? `🟠 ${s.unc} sin confirmar` : '🟢';
  return `| ${s.sec} | ${s.n} | ${s.alta} | ${hist} | ${cov} |`;
});
const covered = secs.filter(s => (manual.get(norm(s.sec)) && manual.get(norm(s.sec)) !== '—') || s.keys.size).length;
const block = `<!-- argos:auto -->
Fuente: \`test-cases.csv\` · **${tot} TCs** en **${secs.length} secciones** · ${totUnc} «sin confirmar» · ${covered}/${secs.length} secciones con historia.

| Sección QA | TCs | Alta | Historia(s) | Cobertura |
|---|---:|---:|---|---|
${rowsMd.join('\n')}
<!-- /argos:auto -->`;

let out;
const re = /<!-- argos:auto -->[\s\S]*?<!-- \/argos:auto -->/;
if (prev && re.test(prev)) out = prev.replace(re, block);
else {
  const manualTable = mm ? '' : `\n## Mapeo sección → historia\n\nCompletá acá lo que el CSV no dice solo (una fila por sección; \`—\` = fuera del alcance del intake). Se conserva entre corridas.\n\n| Sección | Historia |\n|---|---|\n${secs.map(s => `| ${s.sec} | ${[...s.keys].join(' · ') || '—'} |`).join('\n')}\n`;
  out = prev && prev.trim() ? `${prev.trimEnd()}\n\n## Cobertura TC ↔ historia\n\n${block}\n${manualTable}` : `# Test-map · ${title}\n\nCasos de prueba del QA incorporados al intake. La matriz la regenera el motor (\`test-map.mjs\`); el mapeo manual y las notas son del PM.\n\n## Cobertura TC ↔ historia\n\n${block}\n${manualTable}`;
}
writeFileSync(mapPath, out);
console.log(`✓ test-map: ${tot} TCs · ${secs.length} secciones · ${covered} con historia · ${totUnc} sin confirmar → ${mapPath}`);
