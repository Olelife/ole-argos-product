#!/usr/bin/env node
// status-update.mjs <intakeDir> --date <YYYY-MM-DD> [--since <rev|YYYY-MM-DD>] [--audience stakeholders|dev]
//
// Escribe el update para stakeholders y las release notes del período en <intakeDir>/updates/<date>.md,
// a partir de lo que el intake YA sabe (sin Jira en vivo): stories.md de hoy vs. stories.md en git al corte
// anterior (--since; default: el commit anterior que tocó stories.md), avance-summary.json (foto + Monte Carlo
// del último /avance), decision-log.md (bloqueos y decisiones pendientes) y la Prioridad de las historias.
//
// Secciones: TL;DR · Entregado desde el corte anterior (release notes en lenguaje de negocio) · Dónde está el
// trabajo · Bloqueos · Próximo (P0 sin cerrar) · Decisiones que necesitamos · Pronóstico. Lo que no se puede
// afirmar no se inventa: si no hay avance-summary.json, la sección de pronóstico dice que falta correr /avance.
import { existsSync, readFileSync, writeFileSync, mkdirSync, realpathSync } from 'node:fs';
import { join, basename, relative, dirname } from 'node:path';
import { execSync } from 'node:child_process';
import { readMaybe, parseFrontmatter, parseTable, STORY, DUDAS, DUDA, dudaOpen, dudaPending, storyClosed, stateOf, col, jiraBaseOf, asList } from './lib/md.mjs';

const args = process.argv.slice(2);
const dir = args[0] && existsSync(args[0]) ? realpathSync(args[0]) : args[0];
const opt = f => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const date = opt('--date');
if (!dir || !date) { console.error('uso: status-update.mjs <intakeDir> --date YYYY-MM-DD [--since <rev|fecha>] [--audience stakeholders|dev]'); process.exit(1); }
const audience = opt('--audience') || 'stakeholders';

const fm = parseFrontmatter(readMaybe(join(dir, 'STATUS.md')));
const slug = fm.slug || basename(dir); const title = fm.title || slug; const goal = fm.jira_goal_status || 'Ready to Prod';
const jiraBase = jiraBaseOf(fm);
const storiesMd = readMaybe(join(dir, 'stories.md'));
const stories = parseTable(storiesMd, 'Historia');
const dudas = DUDAS(readMaybe(join(dir, 'decision-log.md')));

// --- corte anterior: stories.md en git
let prevStories = [], sinceLabel = '';
try {
  const root = execSync('git rev-parse --show-toplevel', { cwd: dir, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  const rel = relative(root, join(dir, 'stories.md'));
  let rev = opt('--since');
  const q = { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] };
  if (rev && /^\d{4}-\d{2}-\d{2}$/.test(rev)) { rev = execSync(`git log -1 --format=%H --before="${rev} 23:59" -- "${rel}"`, q).toString().trim(); sinceLabel = opt('--since'); }
  else if (!rev) { rev = execSync(`git log -2 --format=%H -- "${rel}"`, q).toString().trim().split('\n')[1] || ''; }
  if (rev) {
    prevStories = parseTable(execSync(`git show ${rev}:"${rel}"`, { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString(), 'Historia');
    if (!sinceLabel) sinceLabel = execSync(`git log -1 --format=%cs ${rev}`, q).toString().trim();
  }
} catch { /* sin historia en git: no hay "entregado desde" */ }

const key = r => STORY.jira(r) || STORY.id(r);
const prevClosed = new Set(prevStories.filter(r => storyClosed(r, goal)).map(key));
const closedNow = stories.filter(r => storyClosed(r, goal));
const delivered = closedNow.filter(r => !prevClosed.has(key(r)));
const total = stories.filter(r => !['descartada', 'desestimada', 'movida'].includes(stateOf(STORY.state(r)))).length;
const sidOf = id => { const m = String(id).match(/\b([SH]\d+[a-z]?)\s*$/i); return m ? m[1].toUpperCase() : ''; };

// "Como X quiero Y para Z" → "Los X ya pueden Y" (lenguaje de negocio)
function benefit(r) {
  const sid = sidOf(STORY.id(r));
  const rx = new RegExp(`^#{2,4}\\s+[^\\n]*\\b(?:${STORY.id(r).replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}|${sid})\\b[^\\n]*\\n([\\s\\S]*?)(?=^#{2,4}\\s|$(?![\\s\\S]))`, 'mi');
  const body = (storiesMd.match(rx) || [])[1] || '';
  const m = body.match(/\*{0,2}Como\*{0,2}\s+([^*\n]+?)\s+\*{0,2}quiero\*{0,2}\s+([^*\n]+?)\s+\*{0,2}para\*{0,2}\s+([^*\n.]+)/i);
  if (m) return `${m[1].trim().replace(/^el |^la |^los |^las /i, '')} ya ${/s$/.test(m[1].trim()) ? 'pueden' : 'puede'} ${m[2].trim()} — ${m[3].trim()}`;
  return STORY.title(r);
}
const link = r => STORY.jira(r) ? `[${STORY.jira(r)}](${jiraBase}/browse/${STORY.jira(r)})` : `\`${STORY.id(r)}\``;

// --- avance-summary (foto + pronóstico)
let av = null; try { av = JSON.parse(readMaybe(join(dir, 'avance-summary.json')) || 'null'); } catch { av = null; }

// --- bloqueos, próximo, decisiones
const readyOf = r => (STORY.ready(r).match(/[🟢🟡🟠🚧]/u) || [''])[0];
const blocked = stories.filter(r => readyOf(r) === '🚧' && !storyClosed(r, goal));
const prio = r => col(r, 'prioridad').toUpperCase().trim();
const next = stories.filter(r => !storyClosed(r, goal) && !['descartada', 'desestimada'].includes(stateOf(STORY.state(r)))).sort((a, b) => (prio(a) || 'P9').localeCompare(prio(b) || 'P9')).slice(0, 5);
const openDudas = dudas.filter(dudaOpen);
const inSlack = dudas.filter(d => dudaPending(d) && !dudaOpen(d));
const asks = [...inSlack, ...openDudas.filter(d => /PREGUNTA a Producto|CONTRADICE|bloque/i.test(DUDA.text(d)))].slice(0, 6);

const pct = total ? Math.round(closedNow.length / total * 100) : 0;
const L = [];
L.push(`# ${title} · update ${date}`, '');
L.push(`> **TL;DR** ${closedNow.length}/${total} historias entregadas (${pct}% del alcance en «${goal}»)${delivered.length ? `; **${delivered.length} nueva${delivered.length > 1 ? 's' : ''}** desde ${sinceLabel || 'el corte anterior'}` : sinceLabel ? `; sin entregas nuevas desde ${sinceLabel}` : ''}.${av && av.forecast && av.forecast.method === 'monte-carlo' ? ` Cierre estimado **${av.forecast.dates[85]}** (85% de probabilidad)${av.forecast.target ? `; fecha comprometida ${av.forecast.target.date}: ${av.forecast.target.prob}% ${av.forecast.target.rag === 'green' ? '🟢' : av.forecast.target.rag === 'amber' ? '🟡' : '🔴'}` : ''}.` : ''}${blocked.length ? ` **${blocked.length} historia${blocked.length > 1 ? 's' : ''} bloqueada${blocked.length > 1 ? 's' : ''}** esperando decisión.` : ''}`, '');
L.push(`## Entregado${sinceLabel ? ` desde ${sinceLabel}` : ''}`);
L.push(...(delivered.length ? delivered.map(r => `- ${benefit(r)} · ${link(r)}`) : ['- Sin entregas nuevas en el período.']), '');
if (av) {
  L.push('## Dónde está el trabajo', `Corte de Jira del ${av.capturedAt || '—'}:`, '', '| Etapa | Historias |', '|---|---:|', ...av.stages.map(s => `| ${s.name} | ${s.n} |`), '');
  if (av.bugs && av.bugs.total) L.push(`Bugs relacionados: **${av.bugs.open} abiertos** de ${av.bugs.total}.`, '');
}
L.push('## Bloqueos');
L.push(...(blocked.length ? blocked.map(r => `- ${STORY.title(r)} · ${link(r)} — ${STORY.ready(r).replace(/^🚧\s*(BLOQUEADA)?\s*/u, '').replace(/^\((.*)\)$/, '$1') || 'bloqueada'}`) : ['- Ninguna historia bloqueada.']), '');
L.push('## Próximo');
L.push(...(next.length ? next.map(r => `- ${prio(r) ? `**${prio(r)}** · ` : ''}${STORY.title(r)} · ${link(r)}${readyOf(r) ? ` ${readyOf(r)}` : ''}`) : ['- Todo el alcance está entregado.']), '');
L.push('## Decisiones que necesitamos');
L.push(...(asks.length ? asks.map(d => `- **#${DUDA.id(d)}**${inSlack.includes(d) ? ' ⏳ *propuesta en Slack, falta ✅ del PM* —' : ''} ${DUDA.text(d).replace(/\*\*/g, '').replace(/\s+/g, ' ').slice(0, 220)}${DUDA.text(d).length > 220 ? '…' : ''}`) : openDudas.length ? [`- ${openDudas.length} dudas abiertas en el decision-log; ninguna marcada como bloqueante o pregunta explícita.`] : ['- Sin decisiones pendientes.']), '');
L.push('## Pronóstico');
if (av && av.forecast && av.forecast.method === 'monte-carlo') {
  L.push(`Monte Carlo sobre las últimas ${av.forecast.weeks} semanas reales (${av.forecast.avgPerWeek} historias/semana): **P50 ${av.forecast.dates[50]} · P85 ${av.forecast.dates[85]} · P95 ${av.forecast.dates[95]}**.${av.forecast.target ? ` Probabilidad de llegar al ${av.forecast.target.date}: **${av.forecast.target.prob}%**.` : ''} Son probabilidades, no promesas.`);
} else if (av && av.forecast) L.push(`Escenario ${av.forecast.name}: ${av.forecast.date} (${av.forecast.weeks} semanas). Sin serie semanal no hay Monte Carlo.`);
else L.push('Sin corte de avance reciente: corré `/argos-product:avance` para tener pronóstico.');
L.push('', `---`, `_Generado por el motor argos-product desde \`stories.md\`, \`decision-log.md\` y el último corte de avance. Fuente de verdad: el intake \`${slug}\`._`);

const outDir = join(dir, 'updates'); mkdirSync(outDir, { recursive: true });
const out = join(outDir, `${date}${audience === 'dev' ? '-dev' : ''}.md`);
writeFileSync(out, L.join('\n') + '\n');
console.log(`✓ update ${slug} → ${out}: ${closedNow.length}/${total} entregadas · ${delivered.length} nuevas${sinceLabel ? ` desde ${sinceLabel}` : ''} · ${blocked.length} bloqueadas · ${asks.length} decisiones${av ? ` · pronóstico ${av.forecast ? av.forecast.method : 'sin serie'}` : ' · sin avance-summary'}`);
void asList; void dirname; void existsSync; void readFileSync;
