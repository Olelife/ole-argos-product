#!/usr/bin/env node
// jira-import.mjs <intakeDir> [--all] [--markdown]
//
// Genera <intakeDir>/jira-import.csv desde jira-preview.md: el fallback cuando el MCP de Atlassian no
// responde (bot check, conector caído). El PM lo importa desde Jira (Sistema → Importación externa → CSV).
// Conserva los labels únicos de idempotencia, así una importación repetida se detecta por JQL.
//
//   · Por defecto solo las historias PENDIENTES (sin key en stories.md ni [KEY] en el título del preview).
//     --all las incluye todas (para re-importar en otro proyecto).
//   · La épica va en la primera fila salvo que STATUS.md ya tenga jira_epics (entonces las historias
//     cuelgan de esa key en la columna Parent).
//   · La descripción se convierte de Markdown a wiki de Jira (h3. · *negrita* · listas · [texto|url]).
//     --markdown la deja tal cual (para proyectos con editor Markdown).
//
// Columnas: "Issue Type","Summary","Description","Labels","Epic Name","Parent" (labels separados por espacio).
import { writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { readMaybe, parseFrontmatter, parseTable, STORY, asList } from './lib/md.mjs';

const args = process.argv.slice(2);
const dir = args[0];
if (!dir) { console.error('uso: jira-import.mjs <intakeDir> [--all] [--markdown]'); process.exit(1); }
const all = args.includes('--all');
const keepMd = args.includes('--markdown');

const fm = parseFrontmatter(readMaybe(join(dir, 'STATUS.md')));
const slug = fm.slug || basename(dir);
const preview = readMaybe(join(dir, 'jira-preview.md'));
if (!preview) { console.error(`✗ falta ${join(dir, 'jira-preview.md')} (lo genera el verbo aprobar)`); process.exit(1); }

const stories = parseTable(readMaybe(join(dir, 'stories.md')), 'Historia');
const sidOf = id => { const m = String(id).match(/\b([SH]\d+[a-z]?)\s*$/i); return m ? m[1].toUpperCase() : ''; };
const createdSids = new Set(stories.filter(r => STORY.jira(r)).map(r => sidOf(STORY.id(r))));

// --- secciones H2
const secs = [];
const rx = /^## (.+)$/gm;
let m; const heads = [];
while ((m = rx.exec(preview)) !== null) heads.push({ idx: m.index, title: m[1].trim() });
for (let i = 0; i < heads.length; i++) {
  const end = i + 1 < heads.length ? heads[i + 1].idx : preview.length;
  secs.push({ title: heads[i].title, body: preview.slice(heads[i].idx, end) });
}
const isStory = t => /^([SH]\d+[a-z]?)\s*[—–-]/i.test(t);
const isEpic = t => /^ÉPICA\b/i.test(t);

const tick = s => { const r = String(s || '').match(/`([^`]*)`/); return r ? r[1] : String(s || '').trim(); };
const meta = body => {
  const out = { labels: [] };
  const ms = body.match(/^- \*\*Summary:\*\*\s*(.+)$/m); if (ms) out.summary = tick(ms[1]);
  const mu = body.match(/\*\*Label único:\*\*\s*`([^`]+)`/); if (mu) out.labels.push(mu[1]);
  const ml = body.match(/\*\*Labels:\*\*\s*([^\n]+)/); if (ml) out.labels.push(...[...ml[1].matchAll(/`([^`]+)`/g)].map(x => x[1]));
  return out;
};
const defaults = (() => { const d = preview.match(/\*\*Labels por defecto:\*\*\s*([^\n]+)/); return d ? [...d[1].matchAll(/`([^`]+)`/g)].map(x => x[1]) : []; })();

// Cuerpo = lo que sigue a los bullets de metadatos (Tipo/Summary/Descripción), de-indentado, sin el separador final.
function description(body) {
  let lines = body.split('\n').slice(1);
  lines = lines.filter(l => !/^- \*\*(Tipo|Summary|Descripción|Label único)/.test(l));
  return lines.map(l => l.replace(/^ {2}/, '')).join('\n').replace(/\n---\s*$/m, '').trim();
}

function toWiki(md) {
  if (keepMd) return md;
  const fences = [];
  let s = md.replace(/```[\s\S]*?```/g, b => { fences.push(b); return `@@F${fences.length - 1}@@`; });
  s = s.replace(/^#{1,3}\s+(.*)$/gm, 'h3. $1');
  s = s.replace(/\*\*([^*\n]+)\*\*/g, '@@B@@$1@@B@@');
  s = s.replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,;:]|$)/g, '$1_$2_');
  s = s.replace(/@@B@@/g, '*');
  s = s.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '[$1|$2]');
  s = s.replace(/`([^`\n]+)`/g, '{{$1}}');
  s = s.replace(/^(\s*)- \[[ x]\]\s+/gm, '$1* ').replace(/^(\s*)- /gm, '$1* ');
  s = s.replace(/@@F(\d+)@@/g, (_, i) => fences[+i].replace(/^```\w*\n?/, '{code}\n').replace(/```$/, '{code}'));
  return s;
}

const q = s => `"${String(s ?? '').replace(/"/g, '""')}"`;
const rows = [['Issue Type', 'Summary', 'Description', 'Labels', 'Epic Name', 'Parent']];

const epicKey = asList(fm.jira_epics)[0] || '';
const epicSec = secs.find(s => isEpic(s.title));
const epicMeta = epicSec ? meta(epicSec.body) : {};
const epicSummary = epicMeta.summary || `[${fm.title || slug}]`;
let epicIncluded = false;
if (epicSec && !epicKey) {
  const storyStart = secs.findIndex(s => isStory(s.title));
  const epicBody = storyStart > secs.indexOf(epicSec) ? secs.slice(secs.indexOf(epicSec), storyStart).map(s => s.body).join('\n') : epicSec.body;
  rows.push(['Epic', epicSummary, toWiki(description(epicBody)), [...new Set([...defaults, ...epicMeta.labels])].join(' '), epicSummary, '']);
  epicIncluded = true;
}
const parent = epicKey || epicSummary;

let included = 0, skipped = 0;
for (const s of secs.filter(x => isStory(x.title))) {
  const sid = s.title.match(/^([SH]\d+[a-z]?)/i)[1].toUpperCase();
  const alreadyKey = /\[[A-Z][A-Z0-9]+-\d+\]/.test(s.title) || createdSids.has(sid);
  if (alreadyKey && !all) { skipped++; continue; }
  const mt = meta(s.body);
  const summary = mt.summary || s.title.replace(/^[SH]\d+[a-z]?\s*[—–-]\s*/i, '').replace(/\s*·\s*[🔴🟢🟡🟠]+\s*$/u, '').trim();
  const labels = [...new Set([...defaults, ...mt.labels, `intake-${slug}-${sid.toLowerCase()}`])];
  rows.push(['Story', summary, toWiki(description(s.body)), labels.join(' '), '', parent]);
  included++;
}

const out = join(dir, 'jira-import.csv');
writeFileSync(out, rows.map(r => r.map(q).join(',')).join('\n') + '\n');
console.log(`✓ ${out}: ${included} historia(s)${epicIncluded ? ' + épica' : epicKey ? ` (padre ${epicKey})` : ''}${skipped ? ` · ${skipped} ya creadas omitidas (usá --all para incluirlas)` : ''}`);
if (!included && !epicIncluded) console.log('  (nada pendiente de importar)');
