#!/usr/bin/env node
// dudas-resolve.mjs <intakeDir> <cambios.json> --date <YYYY-MM-DD> [--dry-run]
//
// Actualiza filas EXISTENTES del decision-log por id (en cualquiera de sus tablas), sin que el agente edite
// markdown a mano. Es la contraparte de dudas-add (que crea). Lo usan `preguntar` (guardar el permalink del
// hilo de Slack en la Fuente) y `slack` (escribir la respuesta ratificada con su sustento).
//   [ { "id": "12",
//       "estado": "resuelta" | "propuesta-en-Slack" | "aplicada-al-PRD" | "descartada" | (omitido = no cambia),
//       "respuesta": "texto que REEMPLAZA la columna Respuesta"  ó  "respuesta_add": "texto que se AGREGA al final",
//       "fuente_add": "Slack #squad-petra-interno · <permalink>"   (se agrega a la Fuente si no está ya) } ]
// Idempotente: un `respuesta_add` o `fuente_add` que ya está en la celda no se repite; la Fecha se pisa solo si algo cambió.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readMaybe, normalizeHeader } from './lib/md.mjs';

const args = process.argv.slice(2);
const dir = args[0], src = args[1];
const opt = f => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const date = opt('--date'); const dryRun = args.includes('--dry-run');
if (!dir || !src || !date) { console.error('uso: dudas-resolve.mjs <intakeDir> <cambios.json> --date D [--dry-run]'); process.exit(1); }
const ESTADOS = ['abierta', 'resuelta', 'propuesta-en-Slack', 'aplicada-al-PRD', 'descartada', 'movida'];
const items = JSON.parse(readFileSync(src, 'utf8'));
const p = join(dir, 'decision-log.md');
const md = readMaybe(p);
if (!md) { console.error(`✗ falta ${p}`); process.exit(1); }

const lines = md.split('\n');
const cell = s => String(s || '').replace(/\|/g, '/').replace(/\r?\n/g, ' ').trim();
let headers = null, cols = {};
const applied = [], missing = [];
const byId = new Map(items.map(it => [String(it.id).replace(/\D/g, '') + String(it.id).replace(/^\d+/, ''), it]));
for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  if (!/^\s*\|/.test(l)) { headers = null; continue; }
  const cells = l.split('|').slice(1, -1).map(c => c.trim());
  if (!headers) {
    if (/duda/i.test(l)) { headers = cells.map(normalizeHeader); cols = { id: headers.indexOf('#'), fuente: headers.indexOf('fuente'), estado: headers.indexOf('estado'), resp: headers.findIndex(h => h.startsWith('respuesta')), fecha: headers.indexOf('fecha') }; }
    continue;
  }
  if (cells.every(c => /^:?-{2,}:?$/.test(c))) continue;
  const id = (cells[cols.id] || '').replace(/\*/g, '').trim();
  const it = byId.get(id); if (!it) continue;
  byId.delete(id);
  let changed = false;
  if (it.estado) {
    if (!ESTADOS.includes(it.estado)) { console.error(`✗ #${id}: estado "${it.estado}" no es uno de ${ESTADOS.join(' | ')}`); process.exit(1); }
    const cur = (cells[cols.estado] || '').replace(/\*/g, '').trim();
    if (cur !== it.estado) { cells[cols.estado] = `**${it.estado}**`; changed = true; }
  }
  if (it.respuesta != null) { const v = cell(it.respuesta); if ((cells[cols.resp] || '') !== v) { cells[cols.resp] = v; changed = true; } }
  if (it.respuesta_add) { const v = cell(it.respuesta_add); if (!(cells[cols.resp] || '').includes(v)) { cells[cols.resp] = [cells[cols.resp], v].filter(x => x && x !== '—').join(' '); changed = true; } }
  if (it.fuente_add && cols.fuente >= 0) { const v = cell(it.fuente_add); if (!(cells[cols.fuente] || '').includes(v)) { cells[cols.fuente] = [cells[cols.fuente], v].filter(x => x && x !== '—').join(' · '); changed = true; } }
  if (changed && cols.fecha >= 0) cells[cols.fecha] = date;
  if (changed) { lines[i] = `| ${cells.join(' | ')} |`; applied.push({ id, estado: it.estado || '(igual)' }); }
  else applied.push({ id, estado: 'sin cambios' });
}
for (const id of byId.keys()) missing.push(id);
const out = lines.join('\n');
if (!dryRun && out !== md) writeFileSync(p, out);
console.log(`${dryRun ? '(dry-run) ' : ''}✓ dudas-resolve: ${applied.filter(a => a.estado !== 'sin cambios').length} fila(s) actualizadas${applied.some(a => a.estado === 'sin cambios') ? ` · ${applied.filter(a => a.estado === 'sin cambios').length} ya estaban así` : ''}${missing.length ? ` · ⚠ ids no encontrados: #${missing.join(', #')}` : ''}`);
for (const a of applied.filter(a => a.estado !== 'sin cambios')) console.log(`    #${a.id} → ${a.estado}`);
if (missing.length) process.exitCode = 2;
