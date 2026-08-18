#!/usr/bin/env node
// roadmap-gen.mjs <intakeDir>  → escribe <intakeDir>/roadmap-mvp.html
//
// Genera el entregable visual "roadmap MVP" (RFC-002) a partir de:
//   - STATUS.md   → título del intake (frontmatter)
//   - stories.md  → tabla índice + sección "## Orden de ejecución · roadmap por fase"
//   - decision-log.md → dudas abiertas para cruzar como bloqueos
//
// La fuente de verdad son los markdown. El HTML es presentación regenerable,
// self-contained y theme-aware (funciona local + como Artifact).
//
// Sigue el mismo patrón que dashboard-gen.mjs: todo el HTML se compone inline
// con template literals, sin archivo template separado.

import { writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { readMaybe, parseFrontmatter, parseTable, esc } from './lib/md.mjs';

const dir = process.argv[2];
if (!dir) { console.error('uso: roadmap-gen.mjs <intakeDir>'); process.exit(1); }

const status = readMaybe(join(dir, 'STATUS.md'));
const storiesMd = readMaybe(join(dir, 'stories.md'));
const decisionMd = readMaybe(join(dir, 'decision-log.md'));

const fm = parseFrontmatter(status);
const title = fm.title || basename(dir);

// ── Índice global de historias (para el modal · descripción corta por historia)
const indexRows = parseTable(storiesMd, 'Historia');
const storyIndex = new Map();
for (const r of indexRows) {
  const id = (r[0] || '').trim();
  if (!id) continue;
  storyIndex.set(id, { id, title: r[1] || '', ready: r[2] || '', jira: r[4] || '', rq: r[5] || '' });
}

// ── Sección "Orden de ejecución · roadmap por fase"
// Parseo: busco el H2, después H3 por fase y la tabla que le sigue.
function parsePhases(md) {
  const start = md.search(/^##\s+Orden de ejecución.*?roadmap por fase/mi);
  if (start < 0) return null;
  const body = md.slice(start);
  const end = body.search(/^---\s*$/m);
  const chunk = end > 0 ? body.slice(0, end) : body;

  const phases = [];
  const rx = /^###\s+(.+?)(?:\s*\*\((.+?)\)\*)?\s*$/gm;
  const heads = [];
  let m;
  while ((m = rx.exec(chunk)) !== null) heads.push({ idx: m.index, title: m[1].trim(), desc: (m[2] || '').trim() });
  for (let i = 0; i < heads.length; i++) {
    const h = heads[i];
    const next = i + 1 < heads.length ? heads[i + 1].idx : chunk.length;
    const block = chunk.slice(h.idx, next);
    const rows = parseTable(block, 'Historia|Título|Ready');
    // Si no matchea el header, intentar con "Historia" a secas (para Descartadas).
    const finalRows = rows.length ? rows : parseTable(block, 'Historia');
    phases.push({ title: h.title, desc: h.desc, rows: finalRows });
  }
  return phases;
}

// ── Dudas abiertas
function openDudas(md) {
  const rows = parseTable(md, 'Duda');
  return rows.filter(r => (r[3] || '').toLowerCase().includes('abierta'));
}

// ── Deriva Ready? del emoji en la celda
function readyFromCell(cell) {
  const c = String(cell || '');
  if (c.includes('🟢')) return { key: 'ready', label: 'LISTO', cls: 'b-ready' };
  if (c.includes('🟡')) return { key: 'questions', label: 'WITH QUESTIONS', cls: 'b-questions' };
  if (c.includes('🟠')) return { key: 'validate', label: 'NEED VALIDATE', cls: 'b-validate' };
  if (c.includes('🚧')) return { key: 'blocked', label: 'BLOQUEADA', cls: 'b-block' };
  if (c.includes('~~') || /descartad/i.test(c)) return { key: 'discarded', label: 'DESCARTADA', cls: 'b-discarded' };
  return { key: 'unknown', label: '—', cls: 'b-grey' };
}

// ── Detecta menciones "SXX" en el texto de una duda para asociarla a historias
function dudasByStory(dudas) {
  const map = new Map();
  for (const d of dudas) {
    const body = (d[1] || '') + ' ' + (d[4] || '');
    const ids = [...body.matchAll(/\bS\d+[a-z]?\b/g)].map(x => x[0]);
    for (const id of ids) {
      if (!map.has(id)) map.set(id, []);
      map.get(id).push({ id: d[0], text: d[1] });
    }
  }
  return map;
}

const phases = parsePhases(storiesMd);
const dudas = openDudas(decisionMd);
const dudasBloq = dudasByStory(dudas);

// ── Build HTML

const missingSection = phases === null;

const phaseBlocks = missingSection ? '' : phases.map((p, i) => {
  // Detectar si es "Descartadas"
  const isDiscarded = /descartad/i.test(p.title);
  const cardHtml = p.rows.map(r => {
    const sid = (r[0] || '').replace(/~~/g, '').trim();
    const stitle = r[1] || '';
    const ready = readyFromCell(isDiscarded ? '~~' : (r[2] || ''));
    const flags = dudasBloq.get(sid) || [];
    const flagLabels = flags.length
      ? `<div class="hint">🚧 ${flags.map(f => `#${esc(f.id)}`).join(' · ')}</div>` : '';
    return `<div class="block ${ready.cls}" onclick="openHist('${esc(sid)}')">
      <div class="story-id">${esc(sid)}</div>
      <div class="title">${esc(stitle)}</div>
      <div class="meta"><span class="status ${ready.cls}">${esc(ready.label)}</span></div>
      ${flagLabels}
    </div>`;
  }).join('');
  return `<div class="ola">
    <div class="ola-header">${esc(p.title)}${p.desc ? ` <span class="desc">${esc(p.desc)}</span>` : ''}</div>
    <div class="blocks">${cardHtml}</div>
  </div>`;
}).join('');

// Modal · para cada historia armamos un data-payload con lo del índice
const modalData = JSON.stringify(Object.fromEntries(
  [...storyIndex.entries()].map(([id, s]) => [id, {
    title: s.title,
    ready: s.ready,
    jira: s.jira,
    rq: s.rq,
    dudas: (dudasBloq.get(id) || []).map(d => ({ id: d.id, text: d.text })),
  }])
));

const bloqPanel = dudas.length ? `
<div class="blockers">
  <h3>🚧 ${dudas.length} duda(s) abierta(s)</h3>
  <ul>${dudas.map(d => `<li><b>#${esc(d[0])}</b> · ${esc((d[1] || '').slice(0, 200))}${(d[1] || '').length > 200 ? '…' : ''}</li>`).join('')}</ul>
</div>` : '';

const missingBanner = missingSection ? `
<div class="missing">
  <h3>⚠ Falta la sección "Orden de ejecución · roadmap por fase" en <code>stories.md</code></h3>
  <p>Este entregable se genera a partir de esa sección. Pegá la plantilla <code>templates/stories-roadmap-section.md</code> del motor
  en tu <code>stories.md</code>, completá las fases con tus historias, y volvé a correr <code>/argos-product:intake roadmap ${esc(basename(dir))}</code>.</p>
</div>` : '';

const html = `<title>${esc(title)} · Roadmap</title>
<style>
  :root {
    --bg:#f7f8fa; --card:#ffffff; --card-hover:#eef2f7; --text:#18282c; --text-muted:#506878;
    --border:#d5dfe6; --ready:#02b9a8; --questions:#dc8910; --validate:#dd0000; --block:#6b7280;
    --ola-band:rgba(2,185,168,0.06); --shadow:0 1px 3px rgba(0,0,0,0.08);
  }
  @media (prefers-color-scheme:dark){
    :root{ --bg:#0d1117; --card:#161b22; --card-hover:#21262d; --text:#e6edf3; --text-muted:#8b949e;
      --border:#30363d; --ola-band:rgba(2,185,168,0.08); --shadow:0 1px 3px rgba(0,0,0,0.4); }
  }
  :root[data-theme="dark"]{ --bg:#0d1117; --card:#161b22; --card-hover:#21262d; --text:#e6edf3;
    --text-muted:#8b949e; --border:#30363d; --ola-band:rgba(2,185,168,0.08); --shadow:0 1px 3px rgba(0,0,0,0.4); }
  :root[data-theme="light"]{ --bg:#f7f8fa; --card:#ffffff; --card-hover:#eef2f7; --text:#18282c;
    --text-muted:#506878; --border:#d5dfe6; --ola-band:rgba(2,185,168,0.06); --shadow:0 1px 3px rgba(0,0,0,0.08); }
  body{ font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; background:var(--bg); color:var(--text);
    padding:24px; max-width:1200px; margin:0 auto; }
  h1{ font-size:22px; margin:0 0 4px 0; }
  .subtitle{ color:var(--text-muted); font-size:13px; margin:0 0 18px 0; }
  .legend{ display:flex; flex-wrap:wrap; gap:14px; font-size:12px; color:var(--text-muted); margin:12px 0; }
  .legend .dot{ display:inline-block; width:10px; height:10px; border-radius:50%; margin-right:4px; vertical-align:middle; }
  .dot-ready{ background:var(--ready); } .dot-questions{ background:var(--questions); } .dot-validate{ background:var(--validate); } .dot-block{ background:var(--block); }
  .ola{ margin:16px 0; padding:12px 14px 14px; background:var(--ola-band); border-radius:8px; }
  .ola-header{ font-size:15px; font-weight:600; margin-bottom:10px; color:var(--text); }
  .ola-header .desc{ font-weight:400; color:var(--text-muted); font-size:12px; margin-left:6px; }
  .blocks{ display:grid; grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); gap:10px; }
  .block{ background:var(--card); border:1px solid var(--border); border-radius:6px; padding:10px 12px; cursor:pointer;
    box-shadow:var(--shadow); transition:background 0.15s, transform 0.15s; }
  .block:hover{ background:var(--card-hover); transform:translateY(-1px); }
  .block .story-id{ font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:11px; font-weight:600; color:var(--text-muted); }
  .block .title{ font-size:13px; font-weight:500; margin:3px 0 6px 0; line-height:1.3; }
  .block .meta{ display:flex; gap:8px; align-items:center; font-size:11px; }
  .block .meta .status{ padding:2px 6px; border-radius:4px; font-weight:600; }
  .block .hint{ font-size:11px; color:var(--validate); margin-top:6px; }
  .b-ready{ border-left:3px solid var(--ready); }
  .b-ready.status{ background:rgba(2,185,168,0.12); color:var(--ready); border-left:none; }
  .b-questions{ border-left:3px solid var(--questions); }
  .b-questions.status{ background:rgba(220,137,16,0.12); color:var(--questions); border-left:none; }
  .b-validate{ border-left:3px solid var(--validate); }
  .b-validate.status{ background:rgba(221,0,0,0.10); color:var(--validate); border-left:none; }
  .b-block{ border-left:3px solid var(--block); }
  .b-block.status{ background:rgba(107,114,128,0.15); color:var(--block); border-left:none; }
  .b-discarded{ border-left:3px dashed var(--text-muted); opacity:0.6; }
  .b-discarded.status{ background:transparent; color:var(--text-muted); border-left:none; }
  .b-grey{ border-left:3px solid var(--text-muted); }
  .b-grey.status{ background:var(--card-hover); color:var(--text-muted); border-left:none; }
  .blockers, .missing{ margin:22px 0; padding:14px 16px; background:var(--card); border:1px solid var(--border); border-left:3px solid var(--validate); border-radius:6px; }
  .blockers h3, .missing h3{ margin:0 0 6px 0; font-size:14px; color:var(--validate); }
  .blockers ul{ margin:0; padding-left:18px; font-size:12px; color:var(--text-muted); line-height:1.6; }
  .blockers li b{ color:var(--text); }
  .missing p{ margin:6px 0 0 0; font-size:13px; color:var(--text-muted); line-height:1.55; }
  .missing code{ background:var(--card-hover); padding:1px 6px; border-radius:3px; font-size:12px; color:var(--text); }
  .modal-overlay{ position:fixed; inset:0; background:rgba(0,0,0,0.55); display:none; align-items:center; justify-content:center; z-index:1000; padding:20px; }
  .modal-overlay.open{ display:flex; }
  .modal{ background:var(--card); border:1px solid var(--border); border-radius:10px; max-width:640px; width:100%; max-height:85vh; overflow:auto; }
  .modal-header{ display:flex; justify-content:space-between; align-items:flex-start; padding:16px 20px; border-bottom:1px solid var(--border); }
  .modal-title{ font-size:16px; font-weight:600; margin:0; }
  .modal-subtitle{ font-size:12px; color:var(--text-muted); margin-top:4px; }
  .close-btn{ background:none; border:none; color:var(--text-muted); font-size:22px; cursor:pointer; padding:0; line-height:1; }
  .modal-body{ padding:16px 20px; font-size:13px; line-height:1.6; }
  .modal-body .dudas{ margin-top:12px; padding:10px 12px; background:rgba(221,0,0,0.06); border-radius:5px; border-left:2px solid var(--validate); }
  .modal-body .dudas h4{ margin:0 0 6px 0; font-size:12px; color:var(--validate); }
  .modal-body .dudas ul{ margin:0; padding-left:16px; font-size:12px; color:var(--text-muted); }
</style>

<h1>🗿 ${esc(title)}</h1>
<div class="subtitle">
  Roadmap generado desde <code>stories.md</code> + <code>decision-log.md</code>.
  Cliqueá una historia para ver su detalle. Los markdown son la fuente de verdad.
</div>
<div class="legend">
  <span><span class="dot dot-ready"></span> LISTO</span>
  <span><span class="dot dot-questions"></span> WITH QUESTIONS</span>
  <span><span class="dot dot-validate"></span> NEED VALIDATE</span>
  <span><span class="dot dot-block"></span> BLOQUEADA</span>
</div>

${missingBanner}
${phaseBlocks}
${bloqPanel}

<div class="modal-overlay" id="modal-overlay" onclick="closeIfBackdrop(event)">
  <div class="modal" role="dialog" aria-modal="true">
    <div class="modal-header">
      <div>
        <div class="modal-title" id="modal-title">—</div>
        <div class="modal-subtitle" id="modal-subtitle">—</div>
      </div>
      <button class="close-btn" onclick="closeModal()" aria-label="Cerrar">×</button>
    </div>
    <div class="modal-body" id="modal-body"></div>
  </div>
</div>

<script>
  const STORIES = ${modalData};
  function openHist(id){
    const s = STORIES[id];
    if (!s){ return; }
    document.getElementById('modal-title').textContent = id + ' · ' + s.title;
    document.getElementById('modal-subtitle').textContent = s.ready || '—';
    const dudasHtml = (s.dudas && s.dudas.length)
      ? '<div class="dudas"><h4>Dudas abiertas asociadas</h4><ul>' + s.dudas.map(d => '<li><b>#' + d.id + '</b> · ' + (d.text || '').slice(0,180) + '</li>').join('') + '</ul></div>'
      : '';
    const jira = s.jira && s.jira !== '—' ? '<div><b>Jira:</b> ' + s.jira + '</div>' : '';
    const rq = s.rq && s.rq !== '—' ? '<div><b>RQ:</b> ' + s.rq + '</div>' : '';
    document.getElementById('modal-body').innerHTML = jira + rq + dudasHtml + '<div style="margin-top:12px;color:var(--text-muted);font-size:12px">Detalle completo en <code>stories.md</code> · sección ' + id + '.</div>';
    document.getElementById('modal-overlay').classList.add('open');
  }
  function closeModal(){ document.getElementById('modal-overlay').classList.remove('open'); }
  function closeIfBackdrop(e){ if (e.target.id === 'modal-overlay') closeModal(); }
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
</script>`;

writeFileSync(join(dir, 'roadmap-mvp.html'), html, 'utf8');
console.log(`✓ roadmap-mvp.html generado en ${dir}`);
if (missingSection) {
  console.error(`⚠ falta la sección "## Orden de ejecución · roadmap por fase" en stories.md`);
  console.error(`  → usá templates/stories-roadmap-section.md del motor como base`);
}
