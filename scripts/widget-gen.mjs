#!/usr/bin/env node
// widget-gen.mjs <intakeDir> [proyecto]  → escribe <intakeDir>/tickets-widget.html
// Fragmento para mcp__visualize__show_widget: una tarjeta por issue leyendo stories.md (estado real).
// Historias con key de Jira → muestran el key, botón deshabilitado. Pendientes → botón que dispara
// la creación idempotente vía sendPrompt (el detalle vive en jira-preview.md; el estado en stories.md).
//
// Config desde STATUS.md (frontmatter, todos opcionales):
//   jira_project        proyecto por defecto (o el 2º argumento; default SO)
//   jira_base           host de Jira (default https://olelife.atlassian.net; también OLE_JIRA_BASE)
//   jira_title_prefix   prefijo de los títulos, ej. "[Petra][Cotizaciones]" (default: vacío)
import { writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { readMaybe, parseFrontmatter, parseTable, STORY, jiraBaseOf, esc } from './lib/md.mjs';

const dir = process.argv[2];
if (!dir) { console.error('uso: widget-gen.mjs <intakeDir> [proyecto]'); process.exit(1); }

const fm = parseFrontmatter(readMaybe(join(dir, 'STATUS.md')));
const proj = process.argv[3] || fm.jira_project || 'SO';
const jiraBase = jiraBaseOf(fm);
const prefix = fm.jira_title_prefix || '';
const slug = fm.slug || basename(dir);
const title = fm.title || slug;
const storiesRaw = readMaybe(join(dir, 'stories.md'));
const epicMatch = storiesRaw.match(/\*\*(EP-[A-Z0-9-]+)\*\*/);
const epicId = epicMatch ? epicMatch[1] : ('EP-' + slug.toUpperCase());

const rows = parseTable(storiesRaw, 'Historia');
const items = rows.map(r => ({ id: STORY.id(r), title: STORY.title(r), estado: STORY.state(r).toLowerCase(), jira: STORY.jira(r) }));

const payload = { proj, slug, epicId, jiraBase, prefix, items };

const html = `<h2 class="sr-only">Tickets de Jira del intake ${esc(title)}: una tarjeta por historia, con estado real desde stories.md y botón de creación idempotente.</h2>
<div style="display:flex; flex-direction:column; gap:12px; padding:1rem 0;">
  <div style="background:var(--surface-1); border-radius:12px; padding:12px 14px; display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:12px; align-items:end;">
    <label style="display:flex; flex-direction:column; gap:4px; font-size:13px; color:var(--text-secondary);">Proyecto Jira
      <input id="proj" value="${esc(proj)}"></label>
    <label style="display:flex; flex-direction:column; gap:4px; font-size:13px; color:var(--text-secondary);">Prefijo de título
      <input id="conv" value="${esc(prefix)}" placeholder="[Producto][Módulo]"></label>
    <button id="epic" style="height:36px; display:flex; align-items:center; justify-content:center; gap:6px;"><i class="ti ti-crown" aria-hidden="true"></i> Crear/asegurar épica ↗</button>
    <button id="all" style="height:36px; display:flex; align-items:center; justify-content:center; gap:6px;"><i class="ti ti-stack-2" aria-hidden="true"></i> Crear pendientes ↗</button>
  </div>
  <div id="cards" style="display:flex; flex-direction:column; gap:10px;"></div>
  <p style="font-size:12px; color:var(--text-muted); margin:4px 0 0;">El detalle editable de cada historia vive en jira-preview.md. La creación es idempotente: una historia ya creada no se duplica.</p>
</div>
<script>
const P=${JSON.stringify(payload)};
const T=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const isKey=s=>/^[A-Z][A-Z0-9]+-[0-9]+$/.test((s||"").trim());
const v=id=>document.getElementById(id).value.trim();
const cards=document.getElementById("cards");
P.items.forEach(function(d,i){
  const created=isKey(d.jira);
  const el=document.createElement("div");
  el.style.cssText="background:var(--surface-2); border:0.5px solid var(--border); border-radius:12px; padding:12px 14px;";
  const right=created
    ? '<a href="'+P.jiraBase+'/browse/'+T(d.jira)+'" style="font-size:13px; color:var(--text-success); text-decoration:none; white-space:nowrap;"><i class="ti ti-check" aria-hidden="true"></i> '+T(d.jira)+'</a>'
    : '<button data-i="'+i+'" class="mk" style="display:flex; align-items:center; gap:6px; white-space:nowrap;"><i class="ti ti-brand-jira" aria-hidden="true"></i> Crear en Jira ↗</button>';
  el.innerHTML='<div style="display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:8px;">'
    +'<span style="font-size:11px; font-weight:500; padding:2px 8px; border-radius:6px; background:var(--surface-1); color:var(--text-secondary);">'+T(d.id)+'</span>'
    +'<span style="font-size:11px; color:var(--text-muted);">'+(created?"en Jira":T(d.estado))+'</span></div>'
    +'<div style="display:flex; gap:10px; align-items:center;">'
    +'<input id="t'+i+'" value="'+T(d.title)+'" '+(created?"disabled":"")+' style="flex:1;">'
    +right+'</div>';
  cards.appendChild(el);
});
function labelOf(id){var m=id.match(/S[0-9]+[a-z]?$/i);return "intake-"+P.slug+"-"+(m?m[0].toLowerCase():id.toLowerCase());}
function titled(i){var c=v("conv");return (c?c+" ":"")+v("t"+i);}
function payOne(i){var d=P.items[i];
  return "Creá en Jira la historia "+d.id+" del intake "+P.slug+" desde jira-preview.md. Creación idempotente (doble llave): antes de crear, chequeá el key en stories.md y el JQL labels=\\""+labelOf(d.id)+"\\"; si ya existe, devolvé ese key sin duplicar. Proyecto: "+v("proj")+". Título: "+titled(i)+". Épica padre: "+P.epicId+".";}
cards.querySelectorAll(".mk").forEach(function(b){b.addEventListener("click",function(){sendPrompt(payOne(+b.dataset.i));});});
document.getElementById("epic").addEventListener("click",function(){
  sendPrompt("Creá/asegurá en Jira la épica "+P.epicId+" del intake "+P.slug+" (idempotente por label intake-"+P.slug+"-epic; si ya existe, devolvé su key). Proyecto: "+v("proj")+".");});
document.getElementById("all").addEventListener("click",function(){
  sendPrompt("Creá en Jira todas las historias PENDIENTES del intake "+P.slug+" desde jira-preview.md. Idempotente: épica primero, y por cada historia chequeá stories.md + su label intake-"+P.slug+"-s<n> antes de crear (no dupliques las que ya tienen key). Proyecto: "+v("proj")+". Mostrame el árbol y confirmá antes de crear cada una.");});
</script>`;

writeFileSync(join(dir, 'tickets-widget.html'), html);
const pend = items.filter(x => !x.jira).length;
console.log(`✓ widget: ${join(dir, 'tickets-widget.html')} (${items.length} historias, ${pend} pendientes, jira ${jiraBase})`);
