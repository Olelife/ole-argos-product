#!/usr/bin/env node
// dudas-add.mjs <intakeDir> <dudas.json> --date <YYYY-MM-DD> [--section "<título>"]
//
// Agrega filas al decision-log con el id siguiente, sin que el agente tenga que contar ni respetar columnas a
// mano. Lo usan los verbos que traen dudas desde afuera: `comentarios` (comentarios de stakeholders en el
// Artifact publicado), `tests` (TCs "sin confirmar" del QA), `reconciliar`. Entrada:
//   [ { "duda": "…", "fuente": "Artifact dashboard · comentario de Ana (2026-09-18)", "respuesta": "default…", "estado": "abierta" }, … ]
// Idempotente por fuente+duda: si ya existe una fila con la misma fuente y el mismo texto, no la repite.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readMaybe, DUDAS, DUDA, normalizeHeader } from './lib/md.mjs';

const args = process.argv.slice(2);
const dir = args[0], src = args[1];
const opt = f => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const date = opt('--date'); const section = opt('--section');
if (!dir || !src || !date) { console.error('uso: dudas-add.mjs <intakeDir> <dudas.json> --date D [--section "título"]'); process.exit(1); }
const items = JSON.parse(readFileSync(src, 'utf8'));
const p = join(dir, 'decision-log.md');
let md = readMaybe(p);
if (!md) { console.error(`✗ falta ${p}`); process.exit(1); }
const rows = DUDAS(md);
const existing = new Set(rows.map(r => `${DUDA.source(r)}|${DUDA.text(r)}`.replace(/\s+/g, ' ').toLowerCase()));
const maxId = rows.reduce((m, r) => { const n = parseInt(DUDA.id(r).replace(/\D/g, ''), 10); return Number.isFinite(n) && n > m ? n : m; }, 0);
const fresh = items.filter(it => !existing.has(`${it.fuente || ''}|${it.duda || ''}`.replace(/\s+/g, ' ').toLowerCase()));
if (!fresh.length) { console.log(`(${items.length} duda(s), todas ya registradas)`); process.exit(0); }

const lines = md.split('\n');
let lastTable = -1; let cols = 6;
for (let i = lines.length - 1; i >= 0; i--) if (/^\s*\|/.test(lines[i])) { lastTable = i; cols = lines[i].split('|').slice(1, -1).length; break; }
const cell = s => String(s || '').replace(/\|/g, '/').replace(/\r?\n/g, ' ').trim();
const mk = (id, it) => { const c = [String(id), cell(it.duda), cell(it.fuente), cell(it.estado || 'abierta'), cell(it.respuesta || ''), date]; while (c.length < cols) c.splice(c.length - 1, 0, ''); return `| ${c.slice(0, cols).join(' | ')} |`; };
const newRows = fresh.map((it, i) => mk(maxId + 1 + i, it));
if (section) {
  // Un encabezado de tabla es la línea seguida por el separador `|---|`, no cualquier línea que diga
  // "duda": el texto de una fila también la menciona y copiarla deja la sección nueva sin encabezado.
  const DEFAULT_HDR = '| # | Duda | Fuente | Estado | Respuesta / decisión | Fecha |';
  const isSep = l => /^\s*\|[\s:|-]+\|\s*$/.test(l || '');
  let hdr = DEFAULT_HDR;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (!/^\s*\|/.test(lines[i]) || !isSep(lines[i + 1])) continue;
    const cells = lines[i].split('|').slice(1, -1).map(c => normalizeHeader(c.trim()));
    if (cells.includes('duda')) { hdr = lines[i]; break; }
  }
  const sepCols = hdr.split('|').slice(1, -1).length;
  md = md.trimEnd() + `\n\n## ${section}\n\n${hdr}\n| ${Array(sepCols).fill('---').join(' | ')} |\n${newRows.join('\n')}\n`;
} else if (lastTable >= 0) { lines.splice(lastTable + 1, 0, ...newRows); md = lines.join('\n'); }
else { console.error('✗ el decision-log no tiene tabla y no se pasó --section'); process.exit(1); }
writeFileSync(p, md);
console.log(`✓ ${fresh.length} duda(s) agregadas (#${maxId + 1}–#${maxId + fresh.length})${items.length - fresh.length ? ` · ${items.length - fresh.length} ya existían` : ''}`);
