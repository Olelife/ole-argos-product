#!/usr/bin/env node
// dashboard-gen.mjs <intakeDir>  → escribe <intakeDir>/dashboard.html
// Fragmento HTML self-contained y theme-aware (sirve para abrir local y para publicar como Artifact).
// La fuente de verdad son los markdown; esto es solo presentación regenerable.
import { readdirSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { join, extname, basename } from 'node:path';
import { readMaybe, parseFrontmatter, parseTable, esc } from './lib/md.mjs';

const dir = process.argv[2];
if (!dir) { console.error('uso: dashboard-gen.mjs <intakeDir>'); process.exit(1); }

const fm = parseFrontmatter(readMaybe(join(dir, 'STATUS.md')));
const dudas = parseTable(readMaybe(join(dir, 'decision-log.md')), 'Duda');
const stories = parseTable(readMaybe(join(dir, 'stories.md')), 'Historia');

const countBy = (rows, idx) => rows.reduce((a, r) => { const k = (r[idx] || '').toLowerCase(); a[k] = (a[k] || 0) + 1; return a; }, {});
const dudaState = countBy(dudas, 3);
const dudasOpen = dudaState['abierta'] || 0;
const storyState = countBy(stories, 2);
const storiesClosed = storyState['cerrada'] || 0;

const pct = (n, t) => t ? Math.round((n / t) * 100) : 0;
const dudasDone = dudas.length - dudasOpen;

const mime = e => ({ '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml' }[e] || 'application/octet-stream');
function dataUri(p) { const b = readFileSync(p); return `data:${mime(extname(p).toLowerCase())};base64,${b.toString('base64')}`; }

let diagrams = [];
const aDir = join(dir, 'analysis');
if (existsSync(aDir)) diagrams = readdirSync(aDir)
  .filter(f => /\.(png|jpe?g|svg)$/i.test(f)).sort()
  .map(f => ({ name: basename(f, extname(f)), uri: dataUri(join(aDir, f)) }));

let figmaVers = [];
const fDir = join(dir, 'figma');
if (existsSync(fDir)) figmaVers = readdirSync(fDir, { withFileTypes: true })
  .filter(d => d.isDirectory()).map(d => d.name).sort()
  .map(v => { let s = {}; try { s = JSON.parse(readMaybe(join(fDir, v, 'structure.json')) || '{}'); } catch {} return { v, n: (s.frames || []).length, at: s.capturedAt || '—', scope: s.scope || '' }; });

const badge = (txt, cls) => `<span class="badge ${cls}">${esc(txt)}</span>`;
const dudaCls = s => ({ 'abierta': 'b-red', 'resuelta': 'b-green', 'aplicada-al-prd': 'b-teal', 'descartada': 'b-grey' }[(s || '').toLowerCase()] || 'b-grey');
const storyCls = s => ({ 'propuesta': 'b-grey', 'en-jira': 'b-blue', 'en-rq': 'b-amber', 'cerrada': 'b-green' }[(s || '').toLowerCase()] || 'b-grey');

const dudaRows = dudas.map(r => `<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td class="dim">${esc(r[2])}</td><td>${badge(r[3], dudaCls(r[3]))}</td><td>${esc(r[4] || '')}</td><td class="dim">${esc(r[5] || '')}</td></tr>`).join('');
const storyRows = stories.map(r => `<tr><td class="mono">${esc(r[0])}</td><td>${esc(r[1])}</td><td>${badge(r[2], storyCls(r[2]))}</td><td class="dim">${esc(r[3] || '—')}</td><td class="dim">${esc(r[4] || '—')}</td></tr>`).join('');
const figRows = figmaVers.map(f => `<tr><td class="mono">${esc(f.v)}</td><td>${f.n} frames</td><td class="dim">${esc(f.scope)}</td><td class="dim">${esc(f.at)}</td></tr>`).join('') || '<tr><td colspan="4" class="dim">sin snapshots</td></tr>';

const html = `<style>
  .wrap{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#22314f;max-width:1000px;margin:0 auto;padding:8px}
  .wrap h1{font-size:26px;margin:0 0 2px} .wrap h2{font-size:16px;margin:26px 0 10px;color:#12b886;text-transform:uppercase;letter-spacing:.04em}
  .meta{color:#6b7a90;font-size:13px;margin:6px 0 2px} .meta b{color:#22314f}
  .badge{display:inline-block;padding:2px 9px;border-radius:999px;font-size:12px;font-weight:600}
  .b-red{background:#fdecea;color:#c0392b}.b-green{background:#e7f7f0;color:#0e9d72}.b-teal{background:#e0f5f0;color:#12866b}
  .b-grey{background:#eef1f5;color:#5a6b82}.b-blue{background:#e8eef9;color:#3a5ccc}.b-amber{background:#fff4d6;color:#a6790a}
  .st{font-size:14px;padding:4px 12px}
  .bars{display:flex;gap:22px;flex-wrap:wrap;margin:8px 0}
  .bar{flex:1;min-width:240px} .bar .lbl{font-size:13px;color:#6b7a90;margin-bottom:4px}
  .track{background:#eef1f5;border-radius:999px;height:10px;overflow:hidden}.fill{height:100%;background:#12b886;border-radius:999px}
  table{border-collapse:collapse;width:100%;font-size:13px} th,td{border:1px solid #e3e8ef;padding:6px 9px;text-align:left;vertical-align:top}
  th{background:#22314f;color:#fff;font-weight:600} tr:nth-child(even) td{background:#f7f9fb}
  .dim{color:#8595a8} .mono{font-family:ui-monospace,Menlo,monospace;font-size:12px}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px}
  .grid figure{margin:0;border:1px solid #e3e8ef;border-radius:10px;padding:8px;background:#fff}
  .grid img{width:100%;height:auto;border-radius:6px} .grid figcaption{font-size:12px;color:#6b7a90;margin-top:6px;text-align:center}
  .scroll{overflow-x:auto}
  @media (prefers-color-scheme:dark){
    .wrap{color:#e7ecf3}.wrap h1{color:#e7ecf3}.meta b{color:#e7ecf3}.track{background:#2a3852}
    table td{background:#1a2436!important}tr:nth-child(even) td{background:#212d44!important}th{background:#0e1830}
    td,th{border-color:#2a3852}.grid figure{background:#1a2436;border-color:#2a3852}.dim{color:#8595a8}
  }
  :root[data-theme="dark"] .wrap{color:#e7ecf3} :root[data-theme="dark"] table td{background:#1a2436}
  :root[data-theme="light"] .wrap{color:#22314f}
</style>
<div class="wrap">
  <h1>${esc(fm.title || basename(dir))}</h1>
  <div>${badge(fm.status || 'draft', 'st b-teal')}</div>
  <div class="meta"><b>Owner:</b> ${esc(fm.owner || '—')} &nbsp;·&nbsp; <b>Capability:</b> ${esc(fm.capability || '—')} &nbsp;·&nbsp; <b>PRD:</b> ${esc(fm.prd_version || '—')} &nbsp;·&nbsp; <b>Figma:</b> ${esc(fm.figma_version || '—')} &nbsp;·&nbsp; <b>Actualizado:</b> ${esc(fm.updated || '—')}</div>

  <div class="bars">
    <div class="bar"><div class="lbl">Dudas resueltas · ${dudasDone}/${dudas.length}</div><div class="track"><div class="fill" style="width:${pct(dudasDone, dudas.length)}%"></div></div></div>
    <div class="bar"><div class="lbl">Historias cerradas · ${storiesClosed}/${stories.length}</div><div class="track"><div class="fill" style="width:${pct(storiesClosed, stories.length)}%"></div></div></div>
  </div>

  ${diagrams.length ? `<h2>Diagramas</h2><div class="grid">${diagrams.map(d => `<figure><img src="${d.uri}" alt="${esc(d.name)}"><figcaption>${esc(d.name)}</figcaption></figure>`).join('')}</div>` : ''}

  <h2>Dudas · ${dudasOpen} abiertas</h2>
  <div class="scroll"><table><tr><th>#</th><th>Duda</th><th>Fuente</th><th>Estado</th><th>Respuesta / decisión</th><th>Fecha</th></tr>${dudaRows || '<tr><td colspan="6" class="dim">sin dudas</td></tr>'}</table></div>

  <h2>Historias</h2>
  <div class="scroll"><table><tr><th>Historia</th><th>Título</th><th>Estado</th><th>Jira</th><th>RQ</th></tr>${storyRows || '<tr><td colspan="5" class="dim">sin historias</td></tr>'}</table></div>

  <h2>Figma congelado</h2>
  <div class="scroll"><table><tr><th>Versión</th><th>Frames</th><th>Alcance</th><th>Capturado</th></tr>${figRows}</table></div>
</div>`;

writeFileSync(join(dir, 'dashboard.html'), html);
console.log(`✓ dashboard: ${join(dir, 'dashboard.html')} (${dudas.length} dudas, ${stories.length} historias, ${diagrams.length} diagramas, ${figmaVers.length} snapshots)`);
