#!/usr/bin/env node
// design-freeze.mjs <zip> <intakes/<slug>/figma/<vN>/<superficie>> --entry "<archivo>" [--entry …]
//                   --date YYYY-MM-DD [--project-url <url>] [--project "<nombre>"]
//                   [--accept-findings] [--force] [--dry-run] [--json]
//
// Congela el código fuente de un prototipo de Claude Design ("Share → Export → Project HTML → Project archive")
// en `figma/<vN>/<superficie>/source/`, guardando SOLO lo vigente:
//   · los archivos de entrada (--entry, o el `?file=` de --project-url) y lo que importan: `<dc-import name="X">`
//     → `X.dc.html`, y cada `src`/`href` relativo que exista en el zip (support.js, uploads referenciados…);
//   · `assets/` y `_ds/` (el sistema de diseño del prototipo: tokens, fuentes, bundle).
// No guarda versiones anteriores, otros archivos del proyecto, `uploads/` sin referenciar, `scratch/`, `export/`
// ni metadatos (`.thumbnail`).
//
// Antes de escribir revisa credenciales y datos personales en lo que se va a guardar. Una credencial frena
// todo (exit 3) hasta que el PM la revise y se vuelva a correr con --accept-findings; los datos personales
// se reportan para confirmar que son de ejemplo. Escribe el hash del zip y la fila de la superficie en
// `figma/<vN>/MANIFEST.md` (lo crea desde templates/design-manifest.md si falta).
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname, basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readZip } from './lib/zip.mjs';
import { upsertRow, SOURCE_HEADERS } from './lib/design.mjs';

const MOTOR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = f => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const opts = f => args.flatMap((a, i) => (a === f && args[i + 1] ? [args[i + 1]] : []));
const VALUE_FLAGS = new Set(['--entry', '--date', '--project-url', '--project']);
const positional = [];
for (let i = 0; i < args.length; i++) {
  if (VALUE_FLAGS.has(args[i])) { i++; continue; }
  if (!args[i].startsWith('--')) positional.push(args[i]);
}
const [zipPath, destArg] = positional;
if (!zipPath || !destArg) {
  console.error('uso: design-freeze.mjs <zip> <figma/vN/<superficie>> --entry "<archivo>" --date YYYY-MM-DD [--project-url URL] [--project NOMBRE] [--accept-findings] [--force] [--dry-run] [--json]');
  process.exit(1);
}
const date = opt('--date');
const projectUrl = opt('--project-url');
const dryRun = args.includes('--dry-run'), asJson = args.includes('--json');
if (!date && !dryRun) { console.error('✗ falta --date (la fecha de captura la pasa el agente, no un reloj)'); process.exit(1); }

const supDir = basename(destArg) === 'source' ? dirname(resolve(destArg)) : resolve(destArg);
const srcDir = join(supDir, 'source');
const versionDir = dirname(supDir);
const superficie = basename(supDir);
const version = basename(versionDir);

const files = readZip(zipPath).filter(e => !e.isDir);
const byName = new Map(files.map(e => [e.name, e]));
const textOf = name => byName.get(name).data().toString('utf8');

const entries = [...opts('--entry')];
if (projectUrl) {
  const f = new URL(projectUrl).searchParams.get('file');
  if (f && !entries.includes(f)) entries.push(f);
}
const isPage = n => /\.html$/i.test(n);
if (!entries.length) {
  console.error(`✗ falta --entry: ¿cuál es el archivo vigente? Candidatos en el zip:\n${files.filter(e => isPage(e.name) && !e.name.includes('/')).map(e => `  - ${e.name}`).join('\n')}`);
  process.exit(2);
}
const missing = entries.filter(e => !byName.has(e));
if (missing.length) { console.error(`✗ no están en el zip: ${missing.join(', ')}`); process.exit(1); }

// --- qué se guarda
const EXCLUDED_DIR = /^(uploads|scratch|export)\//;
const isMeta = n => n.split('/').some(s => s.startsWith('.') || s === '__MACOSX');
const keep = new Set();
const components = [];
const refsOf = (name, html) => {
  const out = [];
  for (const m of html.matchAll(/<dc-import\b[^>]*\bname=["']([^"']+)["']/gi)) out.push({ ref: `${m[1]}.dc.html`, component: m[1] });
  for (const m of html.matchAll(/\b(?:src|href)\s*=\s*["']([^"'#?]+)[^"']*["']/gi)) {
    const v = m[1].trim();
    if (!v || /^(?:[a-z][a-z0-9+.-]*:|\/\/|\/)/i.test(v) || v.includes('{{')) continue;
    let p = join(dirname(name), v).split('\\').join('/');
    try { p = decodeURI(p); } catch { /* deja el literal */ }
    out.push({ ref: p.replace(/^\.\//, '') });
  }
  return out;
};
const queue = [...entries];
for (const e of entries) keep.add(e);
while (queue.length) {
  const name = queue.shift();
  if (!isPage(name)) continue;
  for (const { ref, component } of refsOf(name, textOf(name))) {
    if (!byName.has(ref) || keep.has(ref) || isMeta(ref)) continue;
    keep.add(ref);
    if (component) components.push(component);
    queue.push(ref);
  }
}
for (const f of files) if (/^(_ds|assets)\//.test(f.name) && !isMeta(f.name)) keep.add(f.name);

const family = n => n.replace(/\.(dc\.)?html$/i, '').replace(/\s+v\d+$/i, '').trim().toLowerCase();
const families = new Set(entries.map(family));
const dropped = { versiones: [], otros: [], uploads: 0, scratch: 0, export: 0, meta: [], resto: [] };
for (const f of files) {
  if (keep.has(f.name)) continue;
  const top = f.name.split('/')[0];
  if (isMeta(f.name)) dropped.meta.push(f.name);
  else if (EXCLUDED_DIR.test(f.name)) dropped[top] += 1;
  else if (!f.name.includes('/') && isPage(f.name) && families.has(family(f.name))) dropped.versiones.push(f.name);
  else if (!f.name.includes('/')) dropped.otros.push(f.name);
  else dropped.resto.push(f.name);
}
const keptUploads = [...keep].filter(n => EXCLUDED_DIR.test(n));

// --- revisión de credenciales y datos personales
const TEXT = /\.(html?|m?js|css|json|md|txt|svg|xml|csv)$/i;
const CREDENTIALS = [
  ['clave de AWS', /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g],
  ['clave privada', /-----BEGIN [A-Z ]*PRIVATE KEY-----/g],
  ['token de GitHub', /\b(?:gh[pousr]_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{22,})\b/g],
  ['token de Slack', /\bxox[abposr]-[A-Za-z0-9-]{10,}/g],
  ['clave de API (sk-…)', /\bsk-(?:ant-)?[A-Za-z0-9_-]{20,}/g],
  ['clave de Google', /\bAIza[0-9A-Za-z_-]{35}\b/g],
  ['clave de Stripe', /\b[rs]k_(?:live|test)_[0-9a-zA-Z]{16,}/g],
  ['JWT', /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g],
  ['secreto asignado', /\b(?:api[_-]?key|secret|password|passwd|client[_-]?secret|access[_-]?token|auth[_-]?token)\b["']?\s*[:=]\s*["'][^"'\s]{8,}["']/gi],
  ['URL con usuario y clave', /\b[a-z][a-z0-9+.-]*:\/\/[^/\s:@"']+:[^/\s:@"']+@[^\s"']+/gi],
  ['token Bearer', /\bBearer\s+[A-Za-z0-9._~+/-]{20,}=*/g],
];
const PERSONAL = [
  ['CPF', /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g],
  ['CNPJ', /\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g],
  ['CURP', /\b[A-Z][AEIOUX][A-Z]{2}\d{6}[HM][A-Z]{5}[0-9A-Z]\d\b/g],
];
const EMAIL = /\b[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,})\b/g;
const mask = s => (s.length <= 8 ? '****' : `${s.slice(0, 4)}…(${s.length} car.)`);
const credentials = [], personal = [], emails = new Map();
for (const name of [...keep].sort()) {
  if (!TEXT.test(name)) continue;
  const lines = textOf(name).split('\n');
  lines.forEach((line, i) => {
    for (const [kind, rx] of CREDENTIALS) for (const m of line.matchAll(rx)) credentials.push({ file: name, line: i + 1, kind, match: mask(m[0]) });
    for (const [kind, rx] of PERSONAL) for (const m of line.matchAll(rx)) personal.push({ file: name, line: i + 1, kind, match: mask(m[0]) });
    for (const m of line.matchAll(EMAIL)) emails.set(m[1].toLowerCase(), (emails.get(m[1].toLowerCase()) || 0) + 1);
  });
}

const sha = createHash('sha256').update(readFileSync(zipPath)).digest('hex');
const keptList = [...keep].sort();
const ds = [...new Set(keptList.filter(n => n.startsWith('_ds/')).map(n => n.split('/')[1]))];
const summary = {
  zip: basename(zipPath), sha256: sha, sha16: sha.slice(0, 16), version, superficie, dest: srcDir,
  entries, components, kept: keptList.length, keptUploads, ds, dropped,
  review: { credentials, personal, emails: Object.fromEntries([...emails].sort((a, b) => b[1] - a[1])) },
};

const reviewLine = () => {
  const parts = [credentials.length ? `${credentials.length} posible(s) credencial(es) revisada(s) y aceptada(s) por el PM` : 'sin credenciales ni tokens'];
  if (emails.size) parts.push(`correos de ${[...emails.keys()].slice(0, 4).map(d => `@${d}`).join(', ')}${emails.size > 4 ? '…' : ''} (${[...emails.values()].reduce((a, b) => a + b, 0)} apariciones; datos de ejemplo del prototipo, a confirmar)`);
  if (personal.length) parts.push(`${personal.length} documento(s) con formato ${[...new Set(personal.map(p => p.kind))].join('/')} (a confirmar que son de ejemplo)`);
  return parts.join('; ');
};

function report() {
  if (asJson) { console.log(JSON.stringify(summary, null, 2)); return; }
  console.log(`🗿 ${summary.zip} · sha256 ${summary.sha16} → ${version}/${superficie}/source/`);
  console.log(`  vigente: ${entries.join(' + ')}${components.length ? ` · componentes ${components.join(', ')}` : ''}`);
  console.log(`  se guardan ${keptList.length} archivo(s)${ds.length ? ` · _ds/${ds.join(', ')}` : ' · ⚠ sin _ds/ (el spec no va a poder mapear tokens)'}`);
  if (keptUploads.length) console.log(`  uploads/ que el prototipo referencia (se guardan): ${keptUploads.join(', ')}`);
  const d = dropped;
  const no = [d.versiones.length && `versiones anteriores (${d.versiones.join(', ')})`, d.otros.length && `otros archivos del proyecto (${d.otros.join(', ')})`, d.uploads && `uploads/ (${d.uploads})`, d.scratch && `scratch/ (${d.scratch})`, d.export && `export/ (${d.export})`, d.meta.length && `metadatos (${d.meta.join(', ')})`, d.resto.length && `otros (${d.resto.join(', ')})`].filter(Boolean);
  if (no.length) console.log(`  no se guarda: ${no.join(' · ')}`);
  console.log(`  revisión: ${reviewLine()}`);
  for (const c of credentials) console.log(`  ✗ ${c.kind}: ${c.file}:${c.line} ${c.match}`);
  for (const p of personal.slice(0, 10)) console.log(`  ⚠ ${p.kind}: ${p.file}:${p.line} ${p.match}`);
}

if (credentials.length && !args.includes('--accept-findings')) {
  report();
  console.error(`\n✗ ${credentials.length} posible(s) credencial(es): no congelo nada. Mostrale los hallazgos al PM; si son falsos positivos, volvé a correr con --accept-findings.`);
  process.exit(3);
}
if (dryRun) { report(); process.exit(0); }
if (existsSync(srcDir) && readdirSync(srcDir).length && !args.includes('--force')) {
  console.error(`✗ ${version}/${superficie}/source/ ya tiene archivos: una versión congelada no se pisa (un export nuevo va a la versión siguiente; --force solo para rehacer la misma).`);
  process.exit(1);
}

for (const name of keptList) {
  const out = join(srcDir, name);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, byName.get(name).data());
}

const manifestPath = join(versionDir, 'MANIFEST.md');
let manifest = existsSync(manifestPath)
  ? readFileSync(manifestPath, 'utf8')
  : readFileSync(join(MOTOR, 'templates', 'design-manifest.md'), 'utf8').replace(/<vN>/g, version).replace('<YYYY-MM-DD>', date).replace('<slug>', basename(dirname(dirname(versionDir))));
const project = opt('--project') || basename(zipPath).replace(/\.zip$/i, '');
const vigentes = `${entries.map(e => `\`${e}\``).join(' + ')}${components.length ? ` + componentes ${components.map(c => `\`${c}\``).join(', ')}` : ''}`;
manifest = upsertRow(manifest, SOURCE_HEADERS, 'Carpeta', {
  Carpeta: `\`${superficie}/source/\``,
  'Proyecto Claude Design': projectUrl ? `[${project}](${projectUrl})` : project,
  'Archivos vigentes': vigentes,
  'Zip original (sha256, 16 car.)': `\`${sha.slice(0, 16)}\``,
}, { createAfter: '## Código fuente por superficie' });

const d = dropped;
const keptDesc = [vigentes, keptList.filter(n => !n.includes('/') && !entries.includes(n) && !n.endsWith('.dc.html')).map(n => `\`${n}\``).join(', '), keptList.some(n => n.startsWith('assets/')) && '`assets/`', ds.length && `\`_ds/\` (${ds.map(x => `\`${x.length > 40 ? `${x.slice(0, 37)}…` : x}\``).join(', ')})`, keptUploads.length && `uploads referenciados: ${keptUploads.map(n => `\`${n}\``).join(', ')}`].filter(Boolean).join(', ');
const droppedDesc = [d.versiones.length && `versiones anteriores (${d.versiones.length})`, d.otros.length && `otros archivos del proyecto (${d.otros.map(n => `\`${n}\``).join(', ')})`, d.uploads && '`uploads/`', d.scratch && '`scratch/`', d.export && '`export/`', d.meta.length && 'metadatos (`.thumbnail`)'].filter(Boolean).join(', ') || 'nada';
const bullet = `- **\`${superficie}/source/\`** — se guardó: ${keptDesc}. No se guardó: ${droppedDesc}. Revisión de seguridad: ${reviewLine()}.`;
const lines = manifest.split('\n');
const at = lines.findIndex(l => l.startsWith(`- **\`${superficie}/source/\`**`));
if (at >= 0) lines[at] = bullet;
else {
  const h = lines.findIndex(l => /^##\s+Qué se guardó/.test(l));
  if (h < 0) lines.push('', '## Qué se guardó y qué no', '', bullet);
  else {
    let next = lines.findIndex((l, i) => i > h && /^##\s/.test(l));
    if (next < 0) next = lines.length;
    let last = -1;
    for (let i = h + 1; i < next; i++) if (lines[i].startsWith('- ')) last = i;
    if (last >= 0) lines.splice(last + 1, 0, bullet);
    else lines.splice(h + 1, 0, '', bullet);
  }
}
writeFileSync(manifestPath, lines.join('\n').replace(/\n*$/, '\n'));

report();
console.log(`  ✓ ${keptList.length} archivo(s) en ${version}/${superficie}/source/ · MANIFEST.md al día`);
