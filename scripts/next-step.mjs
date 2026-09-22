#!/usr/bin/env node
// next-step.mjs <intakeDir> [--date YYYY-MM-DD] [--json] [--all]
//
// Responde "¿y ahora qué?" para un intake: mira el estado que el propio intake ya tiene calculado
// (dudas, historias, cortes de avance, updates publicados, fechas de git) y propone LA acción que sigue.
// Es la salida al problema de tener que recordar veintitantos verbos: el PM pregunta y el motor elige.
//
// No escribe nada ni llama a Jira ni a Slack: solo lee y ordena. Cada candidato trae el porqué con
// números concretos, así el PM puede no estar de acuerdo con conocimiento de causa.
import { existsSync, readdirSync, realpathSync } from 'node:fs';
import { join, basename, relative } from 'node:path';
import { execSync } from 'node:child_process';
import { readMaybe, parseFrontmatter, parseTable, STORY, DUDAS, DUDA, dudaOpen, dudaPending, storyClosed, stateOf, asList } from './lib/md.mjs';

const args = process.argv.slice(2);
const opt = f => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const raw = args[0];
if (!raw) { console.error('uso: next-step.mjs <intakeDir> [--date YYYY-MM-DD] [--json] [--all]'); process.exit(1); }
const dir = existsSync(raw) ? realpathSync(raw) : raw;
const today = opt('--date') || new Date().toISOString().slice(0, 10);
const asJson = args.includes('--json'), showAll = args.includes('--all');

const fm = parseFrontmatter(readMaybe(join(dir, 'STATUS.md')));
const slug = fm.slug || basename(dir);
const goal = fm.jira_goal_status || 'Ready to Prod';
const status = String(fm.status || '').split('#')[0].trim() || 'draft';
const stories = parseTable(readMaybe(join(dir, 'stories.md')), 'Historia');
const dudas = DUDAS(readMaybe(join(dir, 'decision-log.md')));

const days = (from, to = today) => { if (!from) return Infinity; const d = (Date.parse(to) - Date.parse(from)) / 86400000; return Number.isFinite(d) ? Math.round(d) : Infinity; };
const gitDate = file => {
  try {
    const root = execSync('git rev-parse --show-toplevel', { cwd: dir, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    return execSync(`git log -1 --format=%cs -- "${relative(realpathSync(root), join(dir, file))}"`, { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || null;
  } catch { return null; }
};

// una historia fuera de juego puede venir tachada (`~~S14~~`) o con el estado anotado
// («**descartada** (decision-log #50)»): comparar por igualdad exacta la contaría como viva.
const OUT = /^(descartada|desestimada|movida)/;
const live = stories.filter(r => !OUT.test(stateOf(STORY.state(r))) && !/~~/.test(STORY.id(r)));
const closed = live.filter(r => storyClosed(r, goal));
const inJira = live.filter(r => STORY.jira(r));
const open = dudas.filter(dudaOpen);
const pending = dudas.filter(dudaPending);
const isSlack = d => /slack\.com\/archives|slack #/i.test(DUDA.source(d));
const inThread = pending.filter(isSlack);
const unasked = open.filter(d => !isSlack(d));
const sidOf = id => { const m = String(id).match(/\b([SH]\d+[a-z]?)\s*$/i); return m ? m[1].toUpperCase() : ''; };
const openSids = new Set(live.filter(r => !storyClosed(r, goal)).map(r => sidOf(STORY.id(r))).filter(Boolean));
const touchesOpen = d => [...openSids].some(s => new RegExp(`\\b${s}\\b`, 'i').test(DUDA.text(d)));
const isAsk = d => /PREGUNTA a Producto|CONTRADICE|bloque/i.test(DUDA.text(d));
const blocking = unasked.filter(d => isAsk(d) || touchesOpen(d));

let av = null; try { av = JSON.parse(readMaybe(join(dir, 'avance-summary.json')) || 'null'); } catch { av = null; }
const updates = existsSync(join(dir, 'updates')) ? readdirSync(join(dir, 'updates')).filter(f => /^\d{4}-\d{2}-\d{2}/.test(f)).sort() : [];
const lastUpdate = updates.length ? updates[updates.length - 1].slice(0, 10) : null;
const storiesDate = gitDate('stories.md');
const logDate = gitDate('decision-log.md');
const hasTests = existsSync(join(dir, 'test-cases.csv'));
const reconciled = /Reconciliación con el cerebro[^\n]*?(\d{4}-\d{2}-\d{2})/.exec(readMaybe(join(dir, 'decision-log.md')) || '');

const C = [];
const add = (rank, verb, why, cmd) => C.push({ rank, verb, why, cmd });

if (inThread.length) add(10, 'slack', `${inThread.length} duda(s) con hilo abierto en Slack esperando respuesta o el ✅ del PM`, `/argos-product:intake slack ${slug}`);
if (blocking.length) {
  const nOpen = blocking.filter(touchesOpen).length;
  const why = nOpen ? `${blocking.length} duda(s) abiertas sin llevar al canal, ${nOpen} de ellas sobre historias sin cerrar` : `${blocking.length} duda(s) abiertas que contradicen el PRD o preguntan a Producto, todavía sin llevar al canal`;
  add(20, 'preguntar', why, `/argos-product:intake preguntar ${slug}`);
}
// alcanza con que haya historias con key: no todos los intakes declaran `jira_epics` en el STATUS
const epics = asList(fm.jira_epics);
if ((epics.length || inJira.length) && days(storiesDate) > 7) add(30, 'sync', `el estado de Jira no se trae desde hace ${days(storiesDate)} días${epics.length ? ` (épica ${epics.join(', ')})` : `; el STATUS no declara \`jira_epics\`, hay que pasarle las keys`}`, `/argos-product:intake sync ${slug}`);
if (closed.length && (!reconciled || days(reconciled[1]) > 30)) add(40, 'reconciliar', `${closed.length} historia(s) llegaron a «${goal}»${reconciled ? ` y la última reconciliación fue hace ${days(reconciled[1])} días` : ' y el decision-log no registra ninguna reconciliación'}`, `/argos-product:intake reconciliar ${slug}`);
if (inJira.length && (!av || days(av.capturedAt) > 7)) add(50, 'avance', av ? `el último corte de avance es de hace ${days(av.capturedAt)} días` : 'todavía no hay un corte de avance con pronóstico', `/argos-product:avance ${slug}`);
if (av && closed.length && (!lastUpdate || days(lastUpdate) > 7)) add(60, 'update', lastUpdate ? `el último update a stakeholders fue hace ${days(lastUpdate)} días` : 'nunca se publicó un update a stakeholders', `/argos-product:intake update ${slug}`);
if (['draft', 'in-review'].includes(status) && !open.length && live.length) add(70, 'aprobar', 'no quedan dudas abiertas: el intake está en condiciones de cortar historias', `/argos-product:intake aprobar ${slug}`);
if (inJira.length && !hasTests) add(80, 'tests', 'hay historias en Jira y el intake todavía no tiene casos de prueba del QA', `/argos-product:intake tests ${slug}`);
if (closed.length === live.length && live.length && status !== 'done') add(90, 'cerrar', `las ${live.length} historias vivas están en «${goal}»`, `pasar STATUS de ${slug} a done (lo decide el PM)`);
add(999, 'ver', 'mirar el panel del intake', `/argos-product:intake ver ${slug}`);

C.sort((a, b) => a.rank - b.rank);
const facts = { slug, status, stories: { total: live.length, closed: closed.length, inJira: inJira.length }, dudas: { total: dudas.length, open: open.length, inThread: inThread.length, blocking: blocking.length }, lastSync: storiesDate, lastLog: logDate, lastUpdate, avance: av ? av.capturedAt : null };

if (asJson) { console.log(JSON.stringify({ today, facts, next: C[0], candidates: C }, null, 2)); process.exit(0); }
const top = C[0];
console.log(`🗿 ${slug} · ${status} — ${closed.length}/${live.length} historias entregadas · ${open.length} dudas abiertas`);
console.log(`\n  Lo que sigue:  ${top.cmd}`);
console.log(`  Por qué:       ${top.why}`);
if (showAll && C.length > 1) { console.log('\n  Después:'); for (const c of C.slice(1)) console.log(`    ${c.cmd.padEnd(48)} ${c.why}`); }
else if (C.length > 2) console.log(`\n  (${C.length - 1} acciones más en la fila; pedí el detalle con --all)`);
