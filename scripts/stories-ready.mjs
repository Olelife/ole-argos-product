#!/usr/bin/env node
// stories-ready.mjs <intakeDir> [--dry-run] [--json]
//
// Definition of Ready calculada por historia (lo que Rovo llama "work readiness"): en vez de un emoji
// puesto a mano, el `Ready?` del índice de stories.md sale de evidencia que ya está en el intake.
//
//   🟢 LISTO           tiene criterios Dado/cuando/entonces (o EARS) · tiene frame de Figma (si el intake tiene Figma)
//                      · ninguna duda `abierta` la menciona · no depende de una historia sin cerrar
//   🟡 WITH QUESTIONS  alguna duda `abierta` o `propuesta-en-Slack` (sin ✅ del PM) la menciona, sin marcarla bloqueante
//   🟠 NEED VALIDATE   le faltan criterios verificables o el frame de Figma
//   🚧 BLOQUEADA       una duda `abierta` la nombra como bloqueada/bloqueante, o depende de una historia no cerrada
//   —                  descartada / desestimada (no se evalúa)
//
// Fuentes: stories.md (índice + detalle `### <id>`), PRD §6, jira-preview.md (links de Figma), decision-log.md.
// Una historia que YA tiene key de Jira no se degrada por criterios/frame (viven en el ticket): solo dudas y dependencias.
// Escribe la columna `Ready?` (la crea si falta) y deja el motivo por historia en la salida. Los markdown son la verdad.
import { writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { readMaybe, parseFrontmatter, parseTable, normalizeHeader, STORY, DUDAS, DUDA, dudaPending, stateOf, figmaUrls, storyClosed } from './lib/md.mjs';

const args = process.argv.slice(2);
const dir = args[0];
if (!dir) { console.error('uso: stories-ready.mjs <intakeDir> [--dry-run] [--json]'); process.exit(1); }
const dryRun = args.includes('--dry-run'), asJson = args.includes('--json');

const fm = parseFrontmatter(readMaybe(join(dir, 'STATUS.md')));
const slug = fm.slug || basename(dir);
const hasFigma = figmaUrls(fm).length > 0;
const storiesMd = readMaybe(join(dir, 'stories.md'));
const prd = readMaybe(join(dir, `PRD-${slug}.md`));
const preview = readMaybe(join(dir, 'jira-preview.md'));
const dudas = DUDAS(readMaybe(join(dir, 'decision-log.md')));
const rows = parseTable(storiesMd, 'Historia');
if (!rows.length) { console.error('✗ stories.md sin tabla índice'); process.exit(1); }

const sidOf = id => { const m = String(id).match(/\b([SH]\d+[a-z]?)\s*$/i); return m ? m[1].toUpperCase() : ''; };
const GWT = /^\s*(?:[-*]|\d+\.)\s*(?:\[[ x]\]\s*)?(?:\**CA-[\w.]+\**\s*[·:-]\s*)?\**(?:Dad[oa]s?\b.*\b(?:cuando|entonces)\b|Cuando\b.*\b(?:el sistema|debe)\b)/im;
const FIGMA = /figma\.com\/(design|file|proto)\//i;

// Secciones de detalle por historia: `### <id>` o `## <id>` en stories.md, PRD §6 y jira-preview.
function sectionFor(text, sid, fullId) {
  const rx = new RegExp(`^#{2,4}\\s+[^\\n]*\\b(?:${fullId.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}|${sid})\\b[^\\n]*\\n([\\s\\S]*?)(?=^#{2,4}\\s|$(?![\s\S]))`, 'mi');
  const m = text.match(rx); return m ? m[1] : '';
}
const closedIds = new Set(rows.filter(r => storyClosed(r, fm.jira_goal_status)).map(r => sidOf(STORY.id(r))));

const results = [];
for (const r of rows) {
  const id = STORY.id(r).replace(/~~/g, '').trim(); const sid = sidOf(id);
  const st = stateOf(STORY.state(r));
  if (!id) continue;
  if (st === 'descartada' || st === 'desestimada' || /~~/.test(STORY.id(r))) { results.push({ id, sid, ready: '—', why: ['descartada'] }); continue; }
  const body = [sectionFor(storiesMd, sid, id), sectionFor(prd, sid, id), sectionFor(preview, sid, id)].join('\n');
  const why = [];
  const inJira = !!STORY.jira(r);
  const hasGwt = GWT.test(body) || inJira;
  const hasFrame = !hasFigma || FIGMA.test(body) || inJira;
  if (!GWT.test(body) && !inJira) why.push('sin criterios Dado/cuando/entonces');
  if (hasFigma && !FIGMA.test(body) && !inJira) why.push('sin frame de Figma');
  const mentions = dudas.filter(d => dudaPending(d) && new RegExp(`\\b${sid}\\b`, 'i').test(DUDA.text(d) + ' ' + DUDA.answer(d)));
  const blocking = mentions.filter(d => /bloque/i.test(DUDA.text(d) + ' ' + DUDA.answer(d)));
  const deps = [...body.matchAll(/depende de\s+(?:la\s+)?(?:historia\s+)?([SH]\d+[a-z]?)/gi)].map(m => m[1].toUpperCase()).filter(d => d !== sid && !closedIds.has(d));
  let ready;
  if (blocking.length || deps.length) { ready = '🚧'; if (blocking.length) why.push(`bloqueada por duda #${blocking.map(DUDA.id).join(', #')}`); if (deps.length) why.push(`depende de ${deps.join(', ')} (sin cerrar)`); }
  else if (!hasGwt || !hasFrame) ready = '🟠';
  else if (mentions.length) { ready = '🟡'; const ids = mentions.map(DUDA.id); why.push(`dudas abiertas #${ids.slice(0, 6).join(', #')}${ids.length > 6 ? ` +${ids.length - 6}` : ''}`); }
  else ready = '🟢';
  results.push({ id, sid, ready, why });
}

// --- escribir la columna Ready? en la tabla índice
const lines = storiesMd.split('\n');
let hIdx = -1;
for (let i = 0; i < lines.length; i++) if (/^\s*\|/.test(lines[i]) && /historia/i.test(lines[i]) && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1] || '')) { hIdx = i; break; }
const splitRow = l => l.split('|').slice(1, -1).map(c => c.trim());
const joinRow = c => `| ${c.join(' | ')} |`;
let headers = splitRow(lines[hIdx]); let norm = headers.map(normalizeHeader);
let cReady = norm.findIndex(h => h === 'ready?' || h === 'ready'); let added = false;
if (cReady < 0) { const cTitle = norm.indexOf('titulo'); cReady = (cTitle >= 0 ? cTitle : 1) + 1; headers.splice(cReady, 0, 'Ready?'); added = true; norm = headers.map(normalizeHeader); }
const cId = norm.indexOf('historia');
let end = hIdx + 2; while (end < lines.length && /^\s*\|/.test(lines[end])) end++;
const byId = new Map(results.map(x => [x.id, x]));
const LABEL = { '🟢': '🟢 LISTO', '🟡': '🟡 WITH QUESTIONS', '🟠': '🟠 NEED VALIDATE', '🚧': '🚧 BLOQUEADA', '—': '—' };
const changes = [];
const newRows = [];
for (let i = hIdx + 2; i < end; i++) {
  const cells = splitRow(lines[i]); if (added) cells.splice(cReady, 0, ''); while (cells.length < headers.length) cells.push('');
  const res = byId.get((cells[cId] || '').replace(/~~/g, '').trim());
  if (res) {
    const before = cells[cReady] || '';
    const keepNote = before.match(/\(([^)]*)\)\s*$/);
    const after = res.ready === '—' ? (before || '—') : `${LABEL[res.ready]}${res.why.length && res.ready !== '🟢' ? ` (${res.why.join(' · ')})` : keepNote && res.ready !== '🟢' ? ` (${keepNote[1]})` : ''}`;
    if ((before.match(/[🟢🟡🟠🚧]/u) || [''])[0] !== res.ready && res.ready !== '—') changes.push({ id: res.id, before: before || '—', after: LABEL[res.ready], why: res.why });
    cells[cReady] = after;
  }
  newRows.push(joinRow(cells));
}
const out = [...lines.slice(0, hIdx), joinRow(headers), joinRow(headers.map(() => '---')), ...newRows, ...lines.slice(end)].join('\n');
if (!dryRun && out !== storiesMd) writeFileSync(join(dir, 'stories.md'), out);

const counts = results.reduce((a, x) => { a[x.ready] = (a[x.ready] || 0) + 1; return a; }, {});
if (asJson) { console.log(JSON.stringify({ slug, counts, results, changes, written: !dryRun && out !== storiesMd }, null, 2)); process.exit(0); }
console.log(`${dryRun ? '(dry-run) ' : ''}✓ ready ${slug}: 🟢 ${counts['🟢'] || 0} · 🟡 ${counts['🟡'] || 0} · 🟠 ${counts['🟠'] || 0} · 🚧 ${counts['🚧'] || 0}${counts['—'] ? ` · — ${counts['—']}` : ''}${added ? ' · columna Ready? creada' : ''}`);
for (const c of changes) console.log(`    ${c.id.padEnd(30)} ${c.before.padEnd(22)} → ${c.after}${c.why.length ? `   (${c.why.join(' · ')})` : ''}`);
if (!changes.length) console.log('  Sin cambios de readiness.');
