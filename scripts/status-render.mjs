#!/usr/bin/env node
// status-render.mjs <intakeDir> [--date YYYY-MM-DD]
//
// Regenera el bloque AUTO del cuerpo de STATUS.md — los conteos que antes se escribían a mano y
// quedaban viejos (dudas, historias, versiones, épicas, entregables). Vive entre los marcadores
//   <!-- argos:auto -->  …  <!-- /argos:auto -->
// Si no existen, se insertan después del H1. Todo lo demás del archivo (la prosa del PM) se conserva.
// Con --date actualiza `updated:` en el frontmatter (la fecha la pasa el agente; sin relojes acá).
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { readMaybe, parseFrontmatter, parseTable, STORY, DUDA, storyClosed, dudaOpen, asList, figmaUrls, jiraBaseOf, DUDAS, stateOf } from './lib/md.mjs';

const args = process.argv.slice(2);
const dir = args[0];
if (!dir) { console.error('uso: status-render.mjs <intakeDir> [--date YYYY-MM-DD]'); process.exit(1); }
const di = args.indexOf('--date'); const date = di >= 0 ? args[di + 1] : null;

const path = join(dir, 'STATUS.md');
let src = readFileSync(path, 'utf8');
const fm = parseFrontmatter(src);
const slug = fm.slug || basename(dir);
const jiraBase = jiraBaseOf(fm);

const dudas = DUDAS(readMaybe(join(dir, 'decision-log.md')));
const stories = parseTable(readMaybe(join(dir, 'stories.md')), 'Historia');
const cnt = (rows, f) => rows.filter(f).length;
const dState = s => rows => cnt(rows, r => stateOf(DUDA.state(r)).startsWith(s));
const open = cnt(dudas, dudaOpen);
const applied = dState('aplicada-al-prd')(dudas), resolved = dState('resuelta')(dudas), discarded = dState('descartada')(dudas), inSlack = dState('propuesta-en-slack')(dudas);
const closed = cnt(stories, r => storyClosed(r, fm.jira_goal_status));
const inJira = cnt(stories, r => !!STORY.jira(r));

let frames = '';
if (fm.figma_version && fm.figma_version !== '—') {
  const sp = join(dir, 'figma', String(fm.figma_version), 'structure.json');
  if (existsSync(sp)) { try { frames = ` (${(JSON.parse(readFileSync(sp, 'utf8')).frames || []).length} frames en \`figma/${fm.figma_version}/\`)`; } catch { /* sin structure legible */ } }
}
const figmaLinks = figmaUrls(fm).map(f => `[${f.key}](${f.url})`).join(' · ');
const epics = asList(fm.jira_epics).map(k => `[${k}](${jiraBase}/browse/${k})`).join(' · ');

const b = [];
b.push(`- **Dudas:** ${open} abiertas / ${dudas.length} totales${dudas.length ? ` (${applied} aplicadas al PRD · ${resolved} resueltas · ${discarded} descartadas${inSlack ? ` · **${inSlack} propuesta${inSlack > 1 ? 's' : ''} en Slack esperando ✅**` : ''})` : ''}.`);
b.push(`- **Historias:** ${closed} cerradas / ${stories.length} totales · ${inJira} en Jira${fm.jira_goal_status ? ` (cerrada = \`Estado: cerrada\` o \`Estado Jira\` = «${fm.jira_goal_status}»)` : ''}.`);
b.push(`- **Última versión:** PRD **${fm.prd_version || '—'}** · Figma **${fm.figma_version || '—'}**${frames}${figmaLinks ? ` · ${figmaLinks}` : ''}.`);
if (epics) b.push(`- **Jira:** ${fm.jira_project ? `proyecto ${fm.jira_project} · ` : ''}épica(s) ${epics}.`);
const deliver = [];
if (fm.roadmap_artifact_url) deliver.push(`[Roadmap](${fm.roadmap_artifact_url})`);
if (fm.avance_artifact_url) deliver.push(`[Avance](${fm.avance_artifact_url})`);
if (deliver.length) b.push(`- **Entregables:** ${deliver.join(' · ')}.`);
if (fm.base_branch || fm.deploy_env) b.push(`- **Base técnica:** ${fm.base_branch ? `rama \`${fm.base_branch}\`` : ''}${fm.base_branch && fm.deploy_env ? ' · ' : ''}${fm.deploy_env ? `entorno ${fm.deploy_env}` : ''}.`);
const block = `<!-- argos:auto -->\n${b.join('\n')}\n<!-- /argos:auto -->`;

const re = /<!-- argos:auto -->[\s\S]*?<!-- \/argos:auto -->/;
if (re.test(src)) src = src.replace(re, block);
else {
  const m = src.match(/^# .*$/m);
  if (m) { const at = src.indexOf(m[0]) + m[0].length; src = `${src.slice(0, at)}\n\n${block}\n${src.slice(at)}`; }
  else src = `${src.trimEnd()}\n\n${block}\n`;
}
if (date) src = src.replace(/^updated:.*$/m, `updated: ${date}`);

writeFileSync(path, src);
console.log(`✓ STATUS ${slug}: ${open}/${dudas.length} dudas abiertas · ${closed}/${stories.length} historias cerradas · ${inJira} en Jira${date ? ` · updated ${date}` : ''}`);
void readdirSync;
