#!/usr/bin/env node
// stories-sync.mjs <intakeDir> <jira-snapshot.json> [--dry-run] [--json]
//
// Sincroniza stories.md con el estado real de Jira: el agente trae el snapshot por MCP (mismo shape
// que el input.json de /avance: { issues: [ { key, status, summary, labels? } ] }) y este script lo
// escribe en la tabla índice de historias. Los markdown siguen siendo la verdad; esto los pone al día.
//
//   · Columna `Estado Jira` ← status real (se crea si falta).
//   · Columna `Jira`        ← key (si la fila no la tenía y el issue trae el label intake-<slug>-<sid>).
//   · Columna `Estado`      ← `cerrada` cuando el status alcanza jira_goal_status; `en-Jira` cuando
//                             tiene key y estaba `propuesta` o vacía. Nunca pisa `en-RQ`/`descartada`.
//
// Imprime los movimientos (antes → ahora), lo que quedó sin dato y lo que está en Jira pero no en
// stories.md, y sugiere el estado del intake (in-delivery / done). No toca STATUS.md (status-render.mjs).
import { readFileSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { readMaybe, parseFrontmatter, normalizeHeader, jiraKey, jiraBaseOf, asList, stateOf } from './lib/md.mjs';

const args = process.argv.slice(2);
const dir = args[0], snapPath = args[1];
if (!dir || !snapPath) { console.error('uso: stories-sync.mjs <intakeDir> <jira-snapshot.json> [--dry-run] [--json]'); process.exit(1); }
const dryRun = args.includes('--dry-run');
const asJson = args.includes('--json');

const fm = parseFrontmatter(readMaybe(join(dir, 'STATUS.md')));
const slug = fm.slug || basename(dir);
const goal = String(fm.jira_goal_status || 'Ready to Prod');
const jiraBase = jiraBaseOf(fm);
const snap = JSON.parse(readFileSync(snapPath, 'utf8'));
const issues = (snap.issues || []).filter(i => i && i.key);
const byKey = new Map(issues.map(i => [i.key, i]));
const byLabel = new Map();
for (const i of issues) for (const l of asList(i.labels)) byLabel.set(String(l).toLowerCase(), i);

const path = join(dir, 'stories.md');
const src = readMaybe(path);
if (!src) { console.error(`✗ no existe ${path}`); process.exit(1); }
const lines = src.split('\n');

// --- localizar la tabla índice (primera tabla cuyo header incluye "Historia")
let hIdx = -1;
for (let i = 0; i < lines.length; i++) {
  if (/^\s*\|/.test(lines[i]) && /historia/i.test(lines[i]) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) { hIdx = i; break; }
}
if (hIdx < 0) { console.error('✗ stories.md no tiene la tabla índice (header con "Historia")'); process.exit(1); }

const splitRow = l => l.split('|').slice(1, -1).map(c => c.trim());
const joinRow = cells => `| ${cells.join(' | ')} |`;
let headers = splitRow(lines[hIdx]);
let norm = headers.map(normalizeHeader);
const idxOf = name => norm.indexOf(normalizeHeader(name));

// --- asegurar columnas Estado Jira y Jira
const added = [];
function addColumn(name, after) {
  const pos = after >= 0 ? after + 1 : headers.length;
  headers.splice(pos, 0, name);
  norm = headers.map(normalizeHeader);
  added.push({ name, pos });
}
if (idxOf('jira') < 0) addColumn('Jira', -1);
if (idxOf('estado jira') < 0) addColumn('Estado Jira', idxOf('estado') >= 0 ? idxOf('estado') : idxOf('jira') - 1);

const cId = idxOf('historia'), cState = idxOf('estado'), cJState = idxOf('estado jira'), cJira = idxOf('jira'), cTitle = idxOf('titulo');

// --- filas de la tabla
let end = hIdx + 2;
while (end < lines.length && /^\s*\|/.test(lines[end])) end++;

const sidOf = id => { const m = String(id).match(/\b([SH]\d+[a-z]?)\s*$/i); return m ? m[1].toLowerCase() : String(id).toLowerCase(); };
const labelOf = id => `intake-${slug}-${sidOf(id)}`;

const moves = [], noData = [], seen = new Set();
const newRows = [];
for (let i = hIdx + 2; i < end; i++) {
  let cells = splitRow(lines[i]);
  for (const a of added) cells.splice(a.pos, 0, '');
  while (cells.length < headers.length) cells.push('');
  const id = cells[cId] || '';
  if (!id || /^-+$/.test(id)) { newRows.push(joinRow(cells)); continue; }
  let key = jiraKey(cells[cJira]);
  let issue = key ? byKey.get(key) : byLabel.get(labelOf(id));
  if (!issue) { if (key) noData.push({ id, key }); newRows.push(joinRow(cells)); continue; }
  seen.add(issue.key);
  const before = { jira: cells[cJState], state: cState >= 0 ? cells[cState] : '' };
  if (!key) { key = issue.key; cells[cJira] = `[${key}](${jiraBase}/browse/${key})`; }
  cells[cJState] = issue.status || '';
  if (cState >= 0) {
    const st = (cells[cState] || '').toLowerCase();
    const closed = !!issue.status && stateOf(issue.status) === stateOf(goal);
    if (closed) cells[cState] = 'cerrada';
    else if (st === 'cerrada') cells[cState] = 'en-Jira';
    else if (!st || st === 'propuesta' || st === '—' || st === '-') cells[cState] = 'en-Jira';
  }
  const after = { jira: cells[cJState], state: cState >= 0 ? cells[cState] : '' };
  if (before.jira !== after.jira || before.state !== after.state) moves.push({ id, key, title: cTitle >= 0 ? cells[cTitle] : '', before, after });
  newRows.push(joinRow(cells));
}

const sep = headers.map(() => '---');
const out = [...lines.slice(0, hIdx), joinRow(headers), joinRow(sep), ...newRows, ...lines.slice(end)].join('\n');

const orphans = issues.filter(i => !seen.has(i.key) && !/^epic$/i.test(i.type || '')).map(i => ({ key: i.key, status: i.status, summary: i.summary || '' }));
const total = newRows.filter(r => splitRow(r)[cId]).length;
const closedN = newRows.filter(r => { const c = splitRow(r); return (cState >= 0 && (c[cState] || '').toLowerCase() === 'cerrada') || (stateOf(c[cJState]) === stateOf(goal)); }).length;
const inJira = newRows.filter(r => jiraKey(splitRow(r)[cJira])).length;
const suggest = total && closedN === total ? 'done' : inJira ? 'in-delivery' : null;

if (!dryRun && out !== src) writeFileSync(path, out);

const summary = { slug, goal, total, inJira, closed: closedN, moves, noData, orphans, addedColumns: added.map(a => a.name), suggestedStatus: suggest, written: !dryRun && out !== src };
if (asJson) { console.log(JSON.stringify(summary, null, 2)); process.exit(0); }

console.log(`${dryRun ? '(dry-run) ' : ''}✓ sync ${slug}: ${inJira}/${total} en Jira · ${closedN}/${total} en «${goal}»${added.length ? ` · columnas nuevas: ${added.map(a => a.name).join(', ')}` : ''}`);
if (moves.length) {
  console.log('  Movimientos:');
  for (const m of moves) console.log(`    ${m.id.padEnd(30)} ${m.key.padEnd(9)} ${(m.before.jira || '—')} → ${m.after.jira}${m.before.state !== m.after.state ? `   [${m.before.state || '—'} → ${m.after.state}]` : ''}`);
} else console.log('  Sin movimientos.');
if (noData.length) console.log(`  ⚠ ${noData.length} historia(s) con key que no vinieron en el snapshot: ${noData.map(n => n.key).join(', ')}`);
if (orphans.length) console.log(`  ⚠ ${orphans.length} issue(s) en Jira sin fila en stories.md: ${orphans.map(o => o.key).join(', ')}`);
if (suggest && suggest !== String(fm.status || '').toLowerCase()) console.log(`  → STATUS sugerido: ${suggest} (hoy ${fm.status || '—'}); lo decide el PM.`);
