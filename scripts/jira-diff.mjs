#!/usr/bin/env node
// jira-diff.mjs <intakeDir> [--since <rev>] [--write --date <YYYY-MM-DD>]
//
// Sync PRD → Jira (la dirección que faltaba): detecta las historias que YA están en Jira cuya definición en el
// intake cambió después de crearse — criterios agregados/quitados/modificados, alcance, links de Figma — y
// arma `jira-updates.md`: el delta ticket por ticket + la descripción completa nueva, lista para que el agente
// la aplique con `editJiraIssue` tras el OK del PM (gate). Sin Jira en vivo: compara el intake contra su propio git.
//
//   baseline por historia = el commit en que su key apareció en stories.md (o --since <rev> para todas).
//   fuente de la definición = sección `## S<n>` de jira-preview.md (lo que se mandó a Jira); si falta, `### S<n>` de stories.md.
import { writeFileSync, existsSync, realpathSync } from 'node:fs';
import { join, basename, relative } from 'node:path';
import { execSync } from 'node:child_process';
import { readMaybe, parseFrontmatter, parseTable, STORY } from './lib/md.mjs';

const args = process.argv.slice(2);
const dir = args[0] && existsSync(args[0]) ? realpathSync(args[0]) : args[0];
const opt = f => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
if (!dir) { console.error('uso: jira-diff.mjs <intakeDir> [--since <rev>] [--write --date D]'); process.exit(1); }
const write = args.includes('--write'); const date = opt('--date') || '';

const fm = parseFrontmatter(readMaybe(join(dir, 'STATUS.md')));
const slug = fm.slug || basename(dir);
let root; try { root = execSync('git rev-parse --show-toplevel', { cwd: dir, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { console.log(`(${slug}: el intake no está en un repo git; jira-diff compara contra el historial)`); process.exit(0); }
const relPreview = relative(root, join(dir, 'jira-preview.md')), relStories = relative(root, join(dir, 'stories.md'));
const preview = readMaybe(join(dir, 'jira-preview.md')), storiesMd = readMaybe(join(dir, 'stories.md'));
const stories = parseTable(storiesMd, 'Historia').filter(r => STORY.jira(r));
if (!stories.length) { console.log(`(${slug}: ninguna historia con key de Jira todavía)`); process.exit(0); }

const sidOf = id => { const m = String(id).match(/\b([SH]\d+[a-z]?)\s*$/i); return m ? m[1].toUpperCase() : ''; };
const esc = s => s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
function sectionFor(text, sid, fullId) {
  const rx = new RegExp(`^#{2,4}\\s+[^\\n]*\\b(?:${esc(fullId)}|${sid})\\b[^\\n]*\\n([\\s\\S]*?)(?=^#{2,4}\\s+(?:[SH]\\d+[a-z]?\\b|ÉPICA|EP-)|$(?![\\s\\S]))`, 'mi');
  const m = text.match(rx); return m ? m[1].trim() : '';
}
const gitShow = (rev, rel) => { try { return execSync(`git show ${rev}:"${rel}"`, { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString(); } catch { return ''; } };
const baselineRev = key => { try { return execSync(`git log --format=%H --reverse -S"${key}" -- "${relStories}"`, { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim().split('\n')[0] || ''; } catch { return ''; } };
const norm = s => s.replace(/\s+/g, ' ').trim();
const criteria = body => [...body.matchAll(/^\s*[-*]\s*(?:\[[ x]\]\s*)?(?:\**CA-[\w.]+\**\s*[·:-]\s*)?\**((?:Dad[oa]s?|Cuando)\b[^\n]+)$/gim)].map(m => norm(m[1]));
const figma = body => [...body.matchAll(/https:\/\/www\.figma\.com\/[^\s)>]+/g)].map(m => m[0]);

const changes = [];
for (const r of stories) {
  const key = STORY.jira(r), id = STORY.id(r), sid = sidOf(id);
  const rev = opt('--since') || baselineRev(key);
  if (!rev) continue;
  const now = sectionFor(preview, sid, id) || sectionFor(storiesMd, sid, id);
  const then = sectionFor(gitShow(rev, relPreview), sid, id) || sectionFor(gitShow(rev, relStories), sid, id);
  if (!now || !then || norm(now) === norm(then)) continue;
  const cNow = criteria(now), cThen = criteria(then);
  const added = cNow.filter(c => !cThen.includes(c)), removed = cThen.filter(c => !cNow.includes(c));
  const fNow = new Set(figma(now)), fThen = new Set(figma(then));
  const figAdded = [...fNow].filter(f => !fThen.has(f)), figRemoved = [...fThen].filter(f => !fNow.has(f));
  const textOnly = !added.length && !removed.length && !figAdded.length && !figRemoved.length;
  changes.push({ key, id, title: STORY.title(r), rev: rev.slice(0, 8), added, removed, figAdded, figRemoved, textOnly, now });
}

console.log(`🗿 jira-diff ${slug}: ${stories.length} historias en Jira · ${changes.length} con la definición cambiada desde su alta`);
for (const c of changes) console.log(`  ${c.key.padEnd(8)} ${c.id.padEnd(28)} +${c.added.length} criterio(s) · −${c.removed.length} · figma +${c.figAdded.length}/−${c.figRemoved.length}${c.textOnly ? ' · solo redacción' : ''}  (desde ${c.rev})`);
if (!changes.length) { console.log('  Jira está al día con el intake.'); process.exit(0); }

if (write) {
  const L = [`# Qué actualizar en Jira · ${slug} (${date || 'sin fecha'})`, '', `> Generado por \`jira-diff.mjs\`: historias cuya definición en el intake cambió después de crearse en Jira. Nada se aplica sin el OK del PM; la escritura va con \`editJiraIssue\` (MCP de Atlassian) una por una. Marcar acá **✅ APLICADO** con fecha cuando se haga.`, '', '## Delta por ticket', ''];
  for (const c of changes) {
    L.push(`### ${c.key} · ${c.id} ${c.title}`);
    if (c.added.length) L.push(...c.added.map(x => `- **+ criterio:** ${x}`));
    if (c.removed.length) L.push(...c.removed.map(x => `- **− criterio:** ~~${x}~~`));
    if (c.figAdded.length) L.push(...c.figAdded.map(x => `- **+ frame:** ${x}`));
    if (c.figRemoved.length) L.push(...c.figRemoved.map(x => `- **− frame:** ${x}`));
    if (c.textOnly) L.push('- Solo cambió la redacción (sin criterios ni frames nuevos): revisar si vale actualizar el ticket.');
    L.push('', '<details><summary>Descripción completa nueva (para pegar/editar)</summary>', '', c.now, '', '</details>', '');
  }
  const out = join(dir, 'jira-updates.md');
  writeFileSync(out, L.join('\n'));
  console.log(`✓ ${out} (${changes.length} tickets)`);
}
