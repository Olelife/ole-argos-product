#!/usr/bin/env node
// findings-scan.mjs <intakeDir> [--brain <dir>] [--since YYYY-MM-DD] [--apply --date YYYY-MM-DD] [--json]
//
// Cierra el loop con Dev: busca en los findings del cerebro (ole-argos-brain/findings/, solo lectura)
// los que hablan de ESTE intake — por sus keys de Jira (historias + épicas), su capability o su slug — y
// que el decision-log todavía no registra. Cada uno es una decisión que Dev tomó contra el código y que
// el PRD puede no reflejar (el caso real: el PRD pedía la caja de comisión que el código borró).
//
//   sin --apply  → reporta la lista (fecha · estado · finding · por qué matchea).
//   --apply      → agrega una fila `abierta` por finding al final de la última tabla del decision-log,
//                  con fuente `cerebro findings/<archivo>`. El PM decide qué hacer con cada una.
// El cerebro NUNCA se escribe. Si findings/ no está en el clon recortado, hay que re-correr /setup.
import { readdirSync, existsSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { readMaybe, parseFrontmatter, parseTable, STORY, DUDAS, DUDA, asList } from './lib/md.mjs';

const args = process.argv.slice(2);
const dir = args[0];
if (!dir) { console.error('uso: findings-scan.mjs <intakeDir> [--brain <dir>] [--since D] [--apply --date D] [--json]'); process.exit(1); }
const opt = f => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
function findBrain() {
  const c = [opt('--brain'), process.env.OLE_BRAIN, process.env.OLE_REPOS && join(process.env.OLE_REPOS, 'ole-argos-brain')];
  for (const w of [process.env.OLE_WORKSPACE, process.env.CLAUDE_PROJECT_DIR]) if (w) c.push(join(w, 'repos', 'ole-argos-brain'));
  let d = process.cwd();
  for (let i = 0; i < 6; i++) { c.push(join(d, 'repos', 'ole-argos-brain')); const up = join(d, '..'); if (up === d) break; d = up; }
  return c.find(x => x && existsSync(join(x, 'findings'))) || c.find(Boolean);
}
const brain = findBrain();
const since = opt('--since'); const apply = args.includes('--apply'); const date = opt('--date'); const asJson = args.includes('--json');
if (apply && !date) { console.error('✗ --apply requiere --date YYYY-MM-DD (la fecha la pasa el agente)'); process.exit(1); }

const fDir = join(brain, 'findings');
if (!existsSync(fDir)) { console.error(`✗ no encuentro ${fDir}. El cerebro recortado necesita findings/ (re-corré /argos-product:setup).`); process.exit(2); }

const fm = parseFrontmatter(readMaybe(join(dir, 'STATUS.md')));
const slug = fm.slug || basename(dir);
const stories = parseTable(readMaybe(join(dir, 'stories.md')), 'Historia');
const keys = new Set([...stories.map(STORY.jira).filter(Boolean), ...asList(fm.jira_epics)]);
const capability = String(fm.capability || '').trim();
const decisionMd = readMaybe(join(dir, 'decision-log.md'));

const terms = [...[...keys].map(k => ({ t: k, re: new RegExp(`\\b${k.replace('-', '[-‑]')}\\b`) })),
  ...(capability ? [{ t: capability, re: new RegExp(`\\b${capability.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i') }] : []),
  { t: slug, re: new RegExp(`\\b${slug.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i') }];

const files = readdirSync(fDir).filter(f => f.endsWith('.md')).sort();
const hits = [];
for (const f of files) {
  const txt = readMaybe(join(fDir, f));
  const matched = terms.filter(x => x.re.test(txt)).map(x => x.t);
  if (!matched.length) continue;
  const ffm = parseFrontmatter(txt);
  const fdate = String(ffm.date || (f.match(/\b(\d{6})\b/) ? `20${f.match(/\b(\d{6})\b/)[1].replace(/(\d\d)(\d\d)(\d\d)/, '$1-$2-$3')}` : ''));
  if (since && fdate && fdate < since) continue;
  const name = f.replace(/\.md$/, '');
  const already = decisionMd.includes(name) || decisionMd.includes(`findings/${f}`);
  const title = (txt.match(/^#\s+(.+)$/m) || [, name])[1].trim();
  hits.push({ file: f, name, title, date: fdate, status: ffm.status || '', rq: ffm.rq || '', area: ffm.area || '', matched, already });
}
hits.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
const pending = hits.filter(h => !h.already);

let applied = 0;
if (apply && pending.length) {
  const rows = DUDAS(decisionMd);
  const maxId = rows.reduce((m, r) => { const n = parseInt(DUDA.id(r).replace(/\D/g, ''), 10); return Number.isFinite(n) && n > m ? n : m; }, 0);
  const lines = decisionMd.split('\n');
  let lastTable = -1;
  for (let i = lines.length - 1; i >= 0; i--) if (/^\s*\|/.test(lines[i])) { lastTable = i; break; }
  if (lastTable < 0) { console.error('✗ decision-log.md no tiene ninguna tabla de dudas'); process.exit(1); }
  const cols = lines[lastTable].split('|').slice(1, -1).length;
  const newRows = pending.map((h, i) => {
    const cells = [String(maxId + i + 1),
      `**Reconciliación con el cerebro:** ${h.title.replace(/\|/g, '/')} — finding \`findings/${h.file}\`${h.rq ? ` (RQ ${h.rq})` : ''}${h.date ? `, ${h.date}` : ''}. Menciona ${h.matched.join(', ')}. ¿El PRD y las historias reflejan esta decisión de Dev, o hay que actualizarlos?`,
      `cerebro findings/${h.file}`, 'abierta', 'Argos propone: leer el finding, alinear el PRD/historias si aplica, o registrar por qué no aplica.', date];
    while (cells.length < cols) cells.splice(cells.length - 1, 0, '');
    return `| ${cells.slice(0, cols).join(' | ')} |`;
  });
  lines.splice(lastTable + 1, 0, ...newRows);
  writeFileSync(join(dir, 'decision-log.md'), lines.join('\n'));
  applied = newRows.length;
}

const out = { slug, brain, terms: terms.map(t => t.t), scanned: files.length, hits: hits.length, pending: pending.map(h => ({ ...h })), applied };
if (asJson) { console.log(JSON.stringify(out, null, 2)); process.exit(0); }

console.log(`🗿 findings-scan ${slug}: ${files.length} findings del cerebro · ${hits.length} hablan de este intake · ${pending.length} sin registrar en el decision-log${since ? ` (desde ${since})` : ''}`);
for (const h of pending) console.log(`  ${(h.date || '—').padEnd(10)} ${(h.status || '—').padEnd(9)} ${h.name}\n             ↳ ${h.title.slice(0, 110)}${h.title.length > 110 ? '…' : ''}  [${h.matched.join(', ')}]`);
if (hits.length && !pending.length) console.log('  Todo lo que el cerebro dice de este intake ya está en el decision-log.');
if (applied) console.log(`\n  ✓ ${applied} fila(s) 'abierta' agregadas al decision-log (fuente: cerebro). Regenerá STATUS/dashboard.`);
else if (pending.length && !apply) console.log(`\n  → para registrarlas como dudas: --apply --date <hoy>`);
