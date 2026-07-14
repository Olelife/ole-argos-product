#!/usr/bin/env node
// index-widget.mjs [dataRepo]  → escribe <dataRepo>/INDEX-widget.html (fragmento para show_widget)
// Una tarjeta por intake (estado, dudas, historias) con botones que retoman el intake vía sendPrompt.
import { readdirSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readMaybe, parseFrontmatter, parseTable } from './lib/md.mjs';

const data = process.argv[2] || join(process.env.OLE_REPOS || join(process.cwd(), 'repos'), 'ole-argos-product-data');
const intakesDir = join(data, 'intakes');
if (!existsSync(intakesDir)) { console.error(`✗ no existe ${intakesDir}`); process.exit(1); }

const dirs = readdirSync(intakesDir, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name).sort();
const cnt = (rows, idx, val) => rows.filter(r => (r[idx] || '').toLowerCase() === val).length;

const items = dirs.map(slug => {
  const p = join(intakesDir, slug);
  const fm = parseFrontmatter(readMaybe(join(p, 'STATUS.md')));
  const dudas = parseTable(readMaybe(join(p, 'decision-log.md')), 'Duda');
  const stories = parseTable(readMaybe(join(p, 'stories.md')), 'Historia');
  return {
    slug, title: fm.title || slug, status: (fm.status || '—').toLowerCase(),
    prd: fm.prd_version || '—', figma: fm.figma_version || '—', updated: fm.updated || '—',
    dudasOpen: cnt(dudas, 3, 'abierta'), dudasTot: dudas.length,
    storiesClosed: cnt(stories, 2, 'cerrada'), storiesTot: stories.length,
  };
});

const html = `<h2 class="sr-only">Intakes de producto: una tarjeta por intake con su estado, dudas e historias, y botones para abrirlo.</h2>
<div style="padding:1rem 0;">
  <div id="grid" style="display:grid; grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); gap:12px;"></div>
  <p id="empty" style="display:none; color:var(--text-muted); font-size:13px;">No hay intakes todavía. Creá uno con "nuevo intake de …".</p>
</div>
<script>
const P=${JSON.stringify({ items })};
const grid=document.getElementById("grid");
if(!P.items.length){document.getElementById("empty").style.display="block";}
const STC={"draft":["var(--bg-warning)","var(--text-warning)"],"in-review":["var(--bg-accent)","var(--text-accent)"],"ready":["var(--bg-success)","var(--text-success)"],"in-delivery":["var(--bg-accent)","var(--text-accent)"],"done":["var(--surface-1)","var(--text-secondary)"]};
P.items.forEach(function(d){
  var c=STC[d.status]||["var(--surface-1)","var(--text-secondary)"];
  var el=document.createElement("div");
  el.style.cssText="background:var(--surface-2); border:0.5px solid var(--border); border-radius:12px; padding:1rem 1.25rem; display:flex; flex-direction:column; gap:10px;";
  el.innerHTML='<div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">'
    +'<span style="font-weight:500; font-size:15px;">'+d.title+'</span>'
    +'<span style="font-size:11px; font-weight:500; padding:2px 9px; border-radius:999px; white-space:nowrap; background:'+c[0]+'; color:'+c[1]+';">'+d.status+'</span></div>'
    +'<div style="display:flex; flex-wrap:wrap; gap:6px; font-size:12px; color:var(--text-secondary);">'
    +'<span style="background:var(--surface-1); border-radius:6px; padding:2px 8px;"><i class="ti ti-help-circle" aria-hidden="true"></i> '+d.dudasOpen+'/'+d.dudasTot+' dudas</span>'
    +'<span style="background:var(--surface-1); border-radius:6px; padding:2px 8px;"><i class="ti ti-list-check" aria-hidden="true"></i> '+d.storiesClosed+'/'+d.storiesTot+' historias</span>'
    +'<span style="background:var(--surface-1); border-radius:6px; padding:2px 8px;">PRD '+d.prd+' · Figma '+d.figma+'</span></div>'
    +'<div style="display:flex; gap:8px; margin-top:2px;">'
    +'<button class="op" data-s="'+d.slug+'" style="display:flex; align-items:center; gap:6px;"><i class="ti ti-folder-open" aria-hidden="true"></i> Abrir ↗</button>'
    +'<button class="tk" data-s="'+d.slug+'" style="display:flex; align-items:center; gap:6px;"><i class="ti ti-brand-jira" aria-hidden="true"></i> Tickets ↗</button></div>'
    +'<div style="font-size:11px; color:var(--text-muted);">actualizado '+d.updated+'</div>';
  grid.appendChild(el);
});
grid.querySelectorAll(".op").forEach(function(b){b.addEventListener("click",function(){sendPrompt("Mostrame el intake "+b.dataset.s+" (dashboard y estado). Si querés, puedo abrir dudas, historias o tickets.");});});
grid.querySelectorAll(".tk").forEach(function(b){b.addEventListener("click",function(){sendPrompt("Mostrame los tickets del intake "+b.dataset.s+".");});});
</script>`;

writeFileSync(join(data, 'INDEX-widget.html'), html);
console.log(`✓ index widget: ${join(data, 'INDEX-widget.html')} (${items.length} intake/s)`);
