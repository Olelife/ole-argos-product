#!/usr/bin/env node
// design-link.mjs <intakes/<slug>> --version <vN> [--system "<nombre>"] [--system-duda <N>] [--dry-run] [--json]
//
// Enlaza la especificación por pantalla (figma/<vN>/<superficie>/specs/<pantalla>/) en las historias que la usan.
// El mapa pantalla → historias es la tabla "Especificación por pantalla" del MANIFEST de la versión
// (| Carpeta | Pantalla | Historias | Estados extraídos |): la columna Historias la completa Argos con los S<n>;
// este script agrega las carpetas que falten (Historias = —) y mantiene al día "Estados extraídos".
// Por cada historia escribe, idempotente (reemplaza la línea o el bloque si ya estaba):
//   PRD §6      `**Especificación (vN):** figma/vN/…/ (spec.json · copy.md · a-validar.md).` después de **Diseño:**
//   stories.md  `- Spec vN: \`figma/vN/…/\` (spec.json · copy.md · a-validar.md)` al final de su sección
//   jira-preview el bloque "Especificación desde el código fuente del diseño" dentro de `## Diseño`, con links
//               absolutos al repo de datos (OLE_DATA_REPO_URL), que es lo que lee el design-source.sh de Dev.
// Las historias que ya están en Jira se reportan: el ticket se actualiza con jira-diff + editJiraIssue (con OK).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { readMaybe, parseFrontmatter, parseTable, normalizeHeader, STORY } from './lib/md.mjs';
import { specFolders, findTable, cell, renderTable, sameKey, SPECS_HEADERS } from './lib/design.mjs';

const args = process.argv.slice(2);
const opt = f => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const dir = args[0] && !args[0].startsWith('--') ? resolve(args[0]) : null;
const version = opt('--version');
if (!dir || !version) { console.error('uso: design-link.mjs <intakes/<slug>> --version <vN> [--system "<nombre>"] [--system-duda N] [--dry-run] [--json]'); process.exit(1); }
const dryRun = args.includes('--dry-run'), asJson = args.includes('--json');
const versionDir = join(dir, 'figma', version);
const manifestPath = join(versionDir, 'MANIFEST.md');
if (!existsSync(manifestPath)) { console.error(`✗ falta figma/${version}/MANIFEST.md (lo crea design-freeze.mjs)`); process.exit(1); }

const fm = parseFrontmatter(readMaybe(join(dir, 'STATUS.md')));
const slug = fm.slug || basename(dir);
const repoUrl = String(process.env.OLE_DATA_REPO_URL || 'https://github.com/Olelife/ole-argos-product-data/blob/main').replace(/\/+$/, '');
const folders = specFolders(versionDir).filter(f => existsSync(join(versionDir, f, 'spec.json')));
if (!folders.length) { console.error(`✗ figma/${version}/ no tiene carpetas specs/<pantalla>/ con spec.json`); process.exit(1); }
const specOf = f => JSON.parse(readFileSync(join(versionDir, f, 'spec.json'), 'utf8'));
const resolveFolder = c => folders.find(f => sameKey(c, f) || sameKey(c, basename(f))) || null;

// --- 1 · la tabla del MANIFEST (mapa pantalla → historias)
let manifest = readFileSync(manifestPath, 'utf8');
const t = findTable(manifest, SPECS_HEADERS.slice(0, 3));
const head = t ? t.lines[t.start].split('|').slice(1, -1).map(c => c.trim()) : SPECS_HEADERS;
const idx = name => head.map(normalizeHeader).indexOf(normalizeHeader(name));
const rows = t ? t.rows.map(r => [...r]) : [];
const added = [];
for (const f of folders) {
  let r = rows.find(x => resolveFolder(x[idx('Carpeta')]) === f);
  if (!r) { r = head.map(() => ''); r[idx('Carpeta')] = `\`${f}/\``; r[idx('Pantalla')] = basename(f); r[idx('Historias')] = '—'; rows.push(r); added.push(f); }
  const e = idx('Estados extraídos');
  if (e >= 0) {
    const now = specOf(f).states.map(s => s.state);
    const had = String(r[e] || '').split(',').map(x => x.trim()).filter(Boolean);
    if (had.length !== now.length || !now.every(x => had.includes(x))) r[e] = now.join(', ');
  }
}
const table = renderTable(head, rows);
if (t) manifest = [...t.lines.slice(0, t.start), ...table, ...t.lines.slice(t.end)].join('\n');
else {
  const block = ['## Especificación por pantalla', '', ...table, ''].join('\n');
  manifest = manifest.includes('## Cómo verlo') ? manifest.replace('## Cómo verlo', `${block}\n## Cómo verlo`) : `${manifest.trimEnd()}\n\n${block}`;
}

// --- 2 · historia → carpetas
const byStory = new Map();
for (const r of rows) {
  const f = resolveFolder(r[idx('Carpeta')]);
  if (!f) continue;
  for (const m of String(r[idx('Historias')]).matchAll(/\b([SH]\d+[a-z]?)\b/g)) {
    if (!byStory.has(m[1])) byStory.set(m[1], []);
    if (!byStory.get(m[1]).includes(f)) byStory.get(m[1]).push(f);
  }
}
const index = parseTable(readMaybe(join(dir, 'stories.md')), 'Historia');
const sidOf = id => { const m = String(id).match(/\b([SH]\d+[a-z]?)\s*$/i); return m ? m[1].toUpperCase() : ''; };
const storyRow = sid => index.find(r => sidOf(STORY.id(r).replace(/~~/g, '')) === sid);
const system = opt('--system') || String(specOf(folders[0]).designSystem || '?').split(' (')[0];
const duda = opt('--system-duda') ? `, #${String(opt('--system-duda')).replace(/\D/g, '')}` : '';

// --- 3 · editar las secciones de cada historia
const escRx = s => s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
function section(lines, sid, fullId, { level } = {}) {
  const ids = [fullId, sid].filter(Boolean).map(escRx).join('|');
  const lead = level ? new RegExp(`^#{${level}}\\s+(?:${ids})\\b`) : new RegExp(`^#{2,4}\\s+\\**(?:${ids})\\b`);
  const anywhere = new RegExp(`^#{2,4}\\s+[^\\n]*\\b(?:${ids})\\b`);
  let start = lines.findIndex(l => lead.test(l));
  if (start < 0 && !level) start = lines.findIndex(l => anywhere.test(l));
  if (start < 0) return null;
  const lv = level || lines[start].match(/^#+/)[0].length;
  let end = start + 1;
  while (end < lines.length && !new RegExp(`^#{1,${lv}}\\s`).test(lines[end]) && !(level && /^---\s*$/.test(lines[end]))) end++;
  let last = end - 1;
  while (last > start && !lines[last].trim()) last--;
  return { start, end, last };
}

const paths = fs => fs.map(f => `figma/${version}/${f}/`);
function linkPrd(text, sid, fullId, fs) {
  const lines = text.split('\n');
  const s = section(lines, sid, fullId);
  if (!s) return { text, done: false };
  const line = `**Especificación (${version}):** ${paths(fs).join(' · ')} (spec.json · copy.md · a-validar.md).`;
  const inSec = rx => { for (let i = s.start + 1; i <= s.last; i++) if (rx.test(lines[i])) return i; return -1; };
  const prev = inSec(/^\*\*Especificación \(v/);
  if (prev >= 0) lines[prev] = line;
  else {
    const dis = inSec(/^\*\*Diseño:\*\*/), out = inSec(/^\*\*Fuera de esta historia/);
    lines.splice(dis >= 0 ? dis + 1 : out >= 0 ? out : s.last + 1, 0, line);
  }
  return { text: lines.join('\n'), done: true };
}
function linkStories(text, sid, fullId, fs) {
  const lines = text.split('\n');
  const s = section(lines, sid, fullId);
  if (!s) return { text, done: false };
  const line = `- Spec ${version}: ${paths(fs).map(p => `\`${p}\``).join(' · ')} (spec.json · copy.md · a-validar.md)`;
  let prev = -1;
  for (let i = s.start + 1; i <= s.last; i++) if (/^- Spec v[\w.]+:/.test(lines[i])) prev = i;
  if (prev >= 0) lines[prev] = line; else lines.splice(s.last + 1, 0, line);
  return { text: lines.join('\n'), done: true };
}
function linkPreview(text, sid, fullId, fs) {
  const lines = text.split('\n');
  const s = section(lines, sid, fullId, { level: 2 });
  if (!s) return { text, done: false };
  const sub = [];
  for (let i = s.start + 1; i < s.end; i++) if (/^\s+##\s/.test(lines[i])) sub.push(i);
  const ind = sub.length ? lines[sub[0]].match(/^\s*/)[0] : '  ';
  const multi = fs.length > 1;
  const block = [`${ind}**Especificación desde el código fuente del diseño (${version}, sistema de diseño ${system}${duda}):**`, ''];
  for (const f of fs) {
    const url = `${repoUrl}/${encodeURI(`intakes/${slug}/figma/${version}/${f}`)}`;
    const tag = multi ? ` · ${basename(f)}` : '';
    block.push(`${ind}- [Valores por elemento con su token (spec.json)${tag}](${url}/spec.json)`, `${ind}- [Textos de la pantalla (copy.md)${tag}](${url}/copy.md)`, `${ind}- [Puntos a validar con Diseño (a-validar.md)${tag}](${url}/a-validar.md)`);
  }
  const prev = lines.findIndex((l, i) => i > s.start && i < s.end && /^\s*\*\*Especificación desde el código fuente del diseño/.test(l));
  if (prev >= 0) {
    let e = prev + 1;
    while (e < s.end && (!lines[e].trim() || /^\s*- \[/.test(lines[e]))) e++;
    while (e > prev + 1 && !lines[e - 1].trim()) e--;
    lines.splice(prev, e - prev, ...block);
    return { text: lines.join('\n'), done: true };
  }
  const dis = sub.find(i => /^\s+##\s+Diseño\s*$/.test(lines[i]));
  if (dis !== undefined) {
    const next = sub.find(i => i > dis);
    let at = (next ?? s.end) - 1;
    while (at > dis && !lines[at].trim()) at--;
    lines.splice(at + 1, 0, '', ...block);
  } else {
    const before = sub.find(i => /^\s+##\s+(Diagrama de secuencia|Fuera de esta historia)/.test(lines[i]));
    if (before !== undefined) lines.splice(before, 0, `${ind}## Diseño`, '', ...block, '');
    else lines.splice(s.last + 1, 0, '', `${ind}## Diseño`, '', ...block);
  }
  return { text: lines.join('\n'), done: true };
}

const files = { prd: join(dir, `PRD-${slug}.md`), stories: join(dir, 'stories.md'), preview: join(dir, 'jira-preview.md') };
const text = Object.fromEntries(Object.entries(files).map(([k, p]) => [k, readMaybe(p)]));
const before = { ...text, manifest: readFileSync(manifestPath, 'utf8') };
const report = [];
for (const [sid, fs] of [...byStory].sort((a, b) => parseInt(a[0].slice(1), 10) - parseInt(b[0].slice(1), 10))) {
  const r = storyRow(sid);
  const fullId = r ? STORY.id(r).replace(/~~/g, '').trim() : '';
  const where = [];
  for (const [k, fn] of [['prd', linkPrd], ['stories', linkStories], ['preview', linkPreview]]) {
    if (!text[k]) continue;
    const res = fn(text[k], sid, fullId, fs);
    if (res.done) { text[k] = res.text; where.push(k); }
  }
  report.push({ sid, folders: fs, linkedIn: where, jira: r ? STORY.jira(r) : '' });
}

const changed = [];
if (manifest !== before.manifest) changed.push(`figma/${version}/MANIFEST.md`);
for (const k of Object.keys(files)) if (text[k] !== before[k]) changed.push(basename(files[k]));
if (!dryRun) {
  if (manifest !== before.manifest) writeFileSync(manifestPath, manifest);
  for (const k of Object.keys(files)) if (text[k] !== before[k]) writeFileSync(files[k], text[k]);
}

const unmapped = rows.filter(r => resolveFolder(r[idx('Carpeta')]) && !/\b[SH]\d+/.test(r[idx('Historias')])).map(r => resolveFolder(r[idx('Carpeta')]));
const inJira = report.filter(x => x.jira);
if (asJson) { console.log(JSON.stringify({ version, folders, added, unmapped, stories: report, changed, dryRun }, null, 2)); process.exit(0); }
console.log(`🗿 ${slug} · ${version}: ${folders.length} pantalla(s) · ${report.length} historia(s) enlazada(s)${dryRun ? ' (dry-run)' : ''}`);
for (const x of report) console.log(`  ${x.sid.padEnd(5)} ${x.folders.map(f => basename(f)).join(' · ').padEnd(40)} → ${x.linkedIn.join(', ') || '⚠ sin sección de la historia en PRD/stories/jira-preview'}${x.jira ? ` · ya en Jira (${x.jira})` : ''}`);
if (added.length) console.log(`  + ${added.length} carpeta(s) nuevas en la tabla del MANIFEST: ${added.map(f => basename(f)).join(', ')}`);
if (unmapped.length) console.log(`  ⚠ ${unmapped.length} pantalla(s) sin historia en la columna Historias: ${unmapped.map(f => basename(f)).join(', ')}`);
console.log(changed.length ? `  ${dryRun ? 'cambiaría' : '✓ escrito'}: ${changed.join(', ')}` : '  sin cambios (ya estaba enlazado)');
if (inJira.length) console.log(`  → ${inJira.length} historia(s) ya en Jira: \`jira-diff.mjs ${dir} --write\` arma la actualización de cada ticket (se aplica con OK).`);
