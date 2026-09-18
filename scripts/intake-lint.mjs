#!/usr/bin/env node
// intake-lint.mjs <intakeDir> [--strict] [--json]
//
// Valida la coherencia de un intake: el esquema del frontmatter de STATUS.md, los estados de dudas e
// historias, las referencias cruzadas (dudas citadas que existen, historias del roadmap que existen,
// historias del PRD §6 ↔ stories.md) y el snapshot de Figma declarado.
//   ✗ error  → algo que los generadores o el handoff van a leer mal (sale 1)
//   ⚠ aviso  → drift o dato dudoso que el PM debería mirar (sale 0; con --strict sale 1)
import { existsSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { readMaybe, parseFrontmatter, parseTable, STORY, DUDA, asList, figmaUrls, jiraKey, DUDAS, stateOf, col } from './lib/md.mjs';

const args = process.argv.slice(2);
const dir = args[0];
if (!dir) { console.error('uso: intake-lint.mjs <intakeDir> [--strict] [--json]'); process.exit(1); }
const strict = args.includes('--strict'), asJson = args.includes('--json');
if (basename(dir).startsWith('_')) { console.log(`(${basename(dir)} no es un intake; omitido)`); process.exit(0); }

const errors = [], warns = [], oks = [];
const err = t => errors.push(t), warn = t => warns.push(t), ok = t => oks.push(t);

const slugDir = basename(dir);
const statusMd = readMaybe(join(dir, 'STATUS.md'));
if (!statusMd) { err('falta STATUS.md'); }
const fm = parseFrontmatter(statusMd);
const isTransversal = String(fm.tipo || '').includes('transversal');

// --- 1 · frontmatter
const REQ = ['slug', 'title', 'status', 'owner', 'capability', 'prd_version', 'updated'];
const STATUSES = ['draft', 'in-review', 'ready', 'in-delivery', 'done'];
if (!isTransversal) {
  const missing = REQ.filter(k => !fm[k]);
  missing.length ? err(`STATUS: faltan claves obligatorias: ${missing.join(', ')}`) : ok('STATUS: claves obligatorias completas');
  if (fm.slug && fm.slug !== slugDir) err(`STATUS: slug "${fm.slug}" ≠ carpeta "${slugDir}"`);
  if (fm.status && !STATUSES.includes(String(fm.status).toLowerCase())) err(`STATUS: status "${fm.status}" no es uno de ${STATUSES.join(' | ')}`);
  if (fm.updated && !/^\d{4}-\d{2}-\d{2}$/.test(String(fm.updated))) warn(`STATUS: updated "${fm.updated}" no es YYYY-MM-DD`);
  if (/^<.*>$/.test(String(fm.owner || ''))) warn('STATUS: owner sigue con el placeholder del template');
  for (const k of ['jira_epics', 'stories']) {
    const bad = asList(fm[k]).filter(v => !/^[A-Z][A-Z0-9]+-\d+$/.test(v));
    if (bad.length) err(`STATUS: ${k} tiene valores que no son keys de Jira: ${bad.join(', ')}`);
  }
  const order = asList(fm.jira_stage_order);
  if (order.length && fm.jira_goal_status && order[order.length - 1] !== fm.jira_goal_status) warn(`STATUS: jira_goal_status "${fm.jira_goal_status}" no es la última etapa de jira_stage_order ("${order[order.length - 1]}")`);
  const fu = figmaUrls(fm);
  const badFigma = fu.filter(f => !/^https:\/\/www\.figma\.com\//.test(f.url));
  if (badFigma.length) err(`STATUS: figma_url con valores que no son URLs de Figma: ${badFigma.map(f => f.key).join(', ')}`);
  else if (fu.length) ok(`STATUS: ${fu.length} URL(s) de Figma válidas`);
  for (const k of ['roadmap_artifact_url', 'avance_artifact_url', 'landing_url']) if (fm[k] && !/^https:\/\//.test(String(fm[k]))) err(`STATUS: ${k} no es una URL`);
  if (fm.figma_version && fm.figma_version !== '—') {
    const sp = join(dir, 'figma', String(fm.figma_version), 'structure.json');
    existsSync(sp) ? ok(`figma/${fm.figma_version}/structure.json presente`) : warn(`STATUS: figma_version ${fm.figma_version} pero no existe figma/${fm.figma_version}/structure.json`);
  }
}

// --- 2 · decision-log
const dudas = DUDAS(readMaybe(join(dir, 'decision-log.md')));
const DSTATES = ['abierta', 'resuelta', 'aplicada-al-prd', 'descartada', 'movida'];
const dudaIds = new Set();
if (!isTransversal) {
  if (!dudas.length) warn('decision-log: sin filas (¿todavía sin auditoría de inconsistencias?)');
  const dupD = [], badD = [];
  for (const r of dudas) {
    const id = DUDA.id(r).replace(/\*/g, '').trim();
    if (!id) continue;
    if (dudaIds.has(id)) dupD.push(id); dudaIds.add(id);
    const st = stateOf(DUDA.state(r));
    if (st && !DSTATES.some(s => st.startsWith(s))) badD.push(`#${id}:"${DUDA.state(r)}"`);
  }
  dupD.length ? err(`decision-log: ids duplicados: ${dupD.join(', ')}`) : (dudas.length && ok(`decision-log: ${dudas.length} dudas con ids únicos`));
  if (badD.length) warn(`decision-log: estados fuera de {${DSTATES.join(', ')}}: ${badD.slice(0, 6).join(' ')}${badD.length > 6 ? '…' : ''}`);
}

// --- 3 · stories
const storiesMd = readMaybe(join(dir, 'stories.md'));
const stories = parseTable(storiesMd, 'Historia');
const SSTATES = ['propuesta', 'en-jira', 'en-rq', 'cerrada', 'descartada', 'desestimada', 'movida', '—', '-', ''];
const storyIds = new Set(), storySids = new Set();
const sidOf = id => { const m = String(id).match(/\b([SH]\d+[a-z]?)\s*$/i); return m ? m[1].toUpperCase() : ''; };
if (!isTransversal) {
  if (!stories.length) warn('stories: la tabla índice no tiene filas');
  const dupS = [], badS = [], badK = [], keys = new Map();
  for (const r of stories) {
    const id = STORY.id(r).replace(/~~/g, '').trim();
    if (storyIds.has(id)) dupS.push(id); storyIds.add(id); if (sidOf(id)) storySids.add(sidOf(id));
    const st = stateOf(STORY.state(r));
    if (!SSTATES.includes(st)) badS.push(`${id}:"${STORY.state(r)}"`);
    const cell = (r[(r.headers || []).indexOf('jira')] || '').trim();
    if (cell && cell !== '—' && cell !== '-' && !jiraKey(cell)) badK.push(`${id}:"${cell}"`);
    const k = STORY.jira(r); if (k) { if (keys.has(k)) err(`stories: key ${k} repetida en ${keys.get(k)} y ${id}`); keys.set(k, id); }
  }
  dupS.length ? err(`stories: ids duplicados: ${dupS.join(', ')}`) : (stories.length && ok(`stories: ${stories.length} historias con ids únicos`));
  const prios = stories.map(r => col(r, 'prioridad').toUpperCase().trim()).filter(Boolean);
  if (prios.length) {
    const bad = prios.filter(p => !/^P[0-2]$/.test(p));
    if (bad.length) warn(`stories: prioridades fuera de P0/P1/P2: ${[...new Set(bad)].join(', ')}`);
    const p0 = prios.filter(p => p === 'P0').length;
    if (p0 > prios.length / 2) warn(`stories: ${p0}/${prios.length} historias son P0 — si todo es P0, nada es P0; bajá lo que puede esperar`);
    else ok(`stories: prioridades declaradas (${p0} P0 de ${prios.length})`);
  }
  if (badS.length) warn(`stories: estados fuera de {propuesta, en-Jira, en-RQ, cerrada, descartada}: ${badS.slice(0, 5).join(' ')}${badS.length > 5 ? '…' : ''}`);
  if (badK.length) err(`stories: celdas Jira que no son un key: ${badK.slice(0, 5).join(' ')}`);

  // dudas citadas en stories deben existir
  const cited = new Set([...storiesMd.matchAll(/duda[s]?\s*#(\d+[a-z]?)/gi)].map(x => x[1]));
  const ghost = [...cited].filter(d => dudaIds.size && !dudaIds.has(d));
  ghost.length ? warn(`stories: cita dudas que no están en decision-log: #${ghost.join(', #')}`) : (cited.size && ok(`stories: las ${cited.size} dudas citadas existen`));

  // roadmap por fase: historias que no existen en el índice
  const rm = storiesMd.search(/^##\s+Orden de ejecución/m);
  if (rm >= 0) {
    const chunk = storiesMd.slice(rm);
    const phaseIds = [...chunk.matchAll(/^\|\s*~{0,2}([A-Za-z0-9-]+?)~{0,2}\s*\|/gm)].map(x => x[1]).filter(x => !/^(Historia|-+)$/i.test(x));
    const unknown = phaseIds.filter(p => !storyIds.has(p) && !storySids.has(p.toUpperCase()) && ![...storyIds].some(id => sidOf(id) === p.toUpperCase()));
    unknown.length ? err(`roadmap: historias en fases que no existen en el índice: ${[...new Set(unknown)].join(', ')}`) : ok('roadmap: todas las historias de las fases existen');
    const inPhase = new Set(phaseIds.map(p => p.toUpperCase()));
    const orphan = [...storySids].filter(s => !inPhase.has(s) && ![...inPhase].some(p => sidOf(p) === s));
    if (orphan.length) warn(`roadmap: historias del índice sin fase: ${orphan.join(', ')}`);
  }

  // PRD §6 ↔ stories
  const prd = readMaybe(join(dir, `PRD-${slugDir}.md`));
  if (!prd) err(`falta PRD-${slugDir}.md`);
  else {
    const prdSids = new Set([...prd.matchAll(/^###\s+(?:EP-[A-Z0-9-]+-)?([SH]\d+[a-z]?)\b/gm)].map(x => x[1].toUpperCase()));
    if (prdSids.size && storySids.size) {
      const onlyPrd = [...prdSids].filter(s => !storySids.has(s)), onlyStories = [...storySids].filter(s => !prdSids.has(s));
      if (onlyPrd.length) warn(`PRD §6 tiene historias que no están en stories.md: ${onlyPrd.join(', ')}`);
      if (onlyStories.length) warn(`stories.md tiene historias que no están en el PRD §6: ${onlyStories.join(', ')}`);
      if (!onlyPrd.length && !onlyStories.length) ok(`PRD §6 ↔ stories.md: ${prdSids.size} historias alineadas`);
    }
  }
}

// --- 4 · figma versions existentes vs declaradas
const fDir = join(dir, 'figma');
if (existsSync(fDir)) {
  const vers = readdirSync(fDir, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name);
  for (const v of vers) if (!existsSync(join(fDir, v, 'structure.json'))) warn(`figma/${v}/ sin structure.json (snapshot incompleto)`);
}

const summary = { intake: slugDir, errors, warns, oks };
if (asJson) { console.log(JSON.stringify(summary, null, 2)); process.exit(errors.length || (strict && warns.length) ? 1 : 0); }
console.log(`\n  intake-lint · ${slugDir}\n`);
for (const t of oks) console.log(`  ✓ ${t}`);
for (const t of warns) console.log(`  ⚠ ${t}`);
for (const t of errors) console.log(`  ✗ ${t}`);
console.log();
if (errors.length) { console.log(`  ${errors.length} error(es) — los generadores o el handoff van a leer mal el intake.\n`); process.exit(1); }
if (strict && warns.length) { console.log(`  ${warns.length} aviso(s) con --strict.\n`); process.exit(1); }
console.log(warns.length ? '  Pasa, con avisos.\n' : '  Intake coherente.\n');
