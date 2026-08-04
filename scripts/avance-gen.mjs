#!/usr/bin/env node
// avance-gen.mjs <intakeDir> <input.json>  → escribe <intakeDir>/avance.html
// Tablero de AVANCE y proyección de cierre para stakeholders, a partir de un snapshot de Jira.
// El agente trae los datos EN VIVO por MCP (estados + transiciones) y los pasa en input.json;
// este script solo calcula (% DoD, ponderado, escenarios) y renderiza. Fragmento para Artifact.
//
// input.json (todo lo de Jira + config + análisis lo arma el agente):
// {
//   "capturedAt": "2026-08-04",           // fecha del corte (el script no usa relojes)
//   "project": "SO",
//   "epics": ["SO-668","SO-790"],
//   "stageOrder": ["Tareas por hacer","En curso","Staging","Ready to Prod"], // última = meta
//   "issues": [ {"key":"SO-672","status":"Ready to Prod","weight":3,"summary":"…","assignee":"…"}, ... ], // weight/summary/assignee opcionales
//   "jiraBase": "https://olelife.atlassian.net",  // opcional: base para los links de las historias
//   "throughputRecentPerWeek": 10,         // opcional: ritmo reciente a la meta (hist/sem)
//   "scenarios": [ {"name":"B · Realista","cond":"…","ratePerWeek":4.5,"best":true}, … ], // opcional
//   "finding": {"title":"…","body":"…","stats":[{"k":"→ Staging 14d","v":"37"}, …]},      // opcional
//   "risks": [ {"tag":"Validación","title":"…","detail":"…"}, … ]                          // opcional
// }
import { readFileSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { readMaybe, parseFrontmatter, esc } from './lib/md.mjs';

const dir = process.argv[2];
const inPath = process.argv[3];
if (!dir || !inPath) { console.error('uso: avance-gen.mjs <intakeDir> <input.json>'); process.exit(1); }

const fm = parseFrontmatter(readMaybe(join(dir, 'STATUS.md')));
const slug = fm.slug || basename(dir);
const title = fm.title || slug;
const D = JSON.parse(readFileSync(inPath, 'utf8'));

const stageOrder = D.stageOrder && D.stageOrder.length ? D.stageOrder : ['Tareas por hacer', 'En curso', 'Staging', 'Ready to Prod'];
const goal = stageOrder[stageOrder.length - 1];
const issues = (D.issues || []).filter(i => i && i.status);
const jiraBase = (D.jiraBase || 'https://olelife.atlassian.net').replace(/\/+$/, '');
const hasWeights = issues.some(i => typeof i.weight === 'number' && i.weight > 0);
const w = i => hasWeights ? (typeof i.weight === 'number' && i.weight > 0 ? i.weight : 1) : 1;

// color por posición de etapa: primera=gris, última=verde (meta), intermedias azul/ámbar/teal
const MID = ['#7C8A90', '#3B82C4', '#C08519', '#0E9AA5', '#8A6BD1'];
function stageColor(idx, n) {
  if (idx === n - 1) return '#1D9E75';        // meta = verde
  if (idx === 0) return '#7C8A90';            // inicio = gris
  return MID[(idx % (MID.length - 1)) + 1] || '#3B82C4';
}

// agrupar por etapa (en el orden dado); estados no mapeados → bucket "Sin mapear"
const idxOf = {}; stageOrder.forEach((s, i) => idxOf[s] = i);
const buckets = stageOrder.map((name, i) => ({ name, i, color: stageColor(i, stageOrder.length), n: 0, pts: 0, items: [] }));
const unmapped = { name: 'Sin mapear', color: '#C63E29', n: 0, pts: 0, keys: [], items: [] };
for (const it of issues) {
  const rec = { key: it.key || '', summary: it.summary || '', assignee: it.assignee || '', weight: w(it) };
  if (it.status in idxOf) { const b = buckets[idxOf[it.status]]; b.n++; b.pts += w(it); b.items.push(rec); }
  else { unmapped.n++; unmapped.pts += w(it); unmapped.keys.push(it.key); unmapped.items.push(rec); }
}
const totalN = issues.length;
const totalPts = buckets.reduce((a, b) => a + b.pts, 0) + unmapped.pts;
const done = buckets[buckets.length - 1];
const remN = totalN - done.n, remPts = totalPts - done.pts;

// porcentajes
const pct = (a, b) => b ? Math.round(a / b * 1000) / 10 : 0;
const dodCount = pct(done.n, totalN);
const dodPts = pct(done.pts, totalPts);
// ponderado por etapa: factor = i/(n-1)
const nStages = stageOrder.length;
const stageFactor = i => nStages > 1 ? i / (nStages - 1) : 1;
let wCount = 0, wPts = 0;
buckets.forEach(b => { wCount += b.n * stageFactor(b.i); wPts += b.pts * stageFactor(b.i); });
const weightedCount = pct(wCount, totalN);
const weightedPts = pct(wPts, totalPts);

// escenarios: usar los dados, o derivar de throughputRecentPerWeek
const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function addWeeks(iso, weeks) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + Math.round(weeks * 7));
  return `${String(d.getUTCDate()).padStart(2, '0')}-${MES[d.getUTCMonth()]}`;
}
let scenarios = D.scenarios;
if ((!scenarios || !scenarios.length) && D.throughputRecentPerWeek > 0) {
  const r = D.throughputRecentPerWeek;
  scenarios = [
    { name: 'A · Optimista', cond: 'Sostiene el ritmo reciente.', ratePerWeek: r },
    { name: 'B · Realista', cond: 'Mitad del ritmo reciente.', ratePerWeek: r / 2, best: true },
    { name: 'C · Conservador', cond: 'Ritmo de arranque estable.', ratePerWeek: Math.max(1, r / 4) },
  ];
}
scenarios = (scenarios || []).map(s => {
  const weeks = s.ratePerWeek > 0 ? remN / s.ratePerWeek : 0;
  return { ...s, weeks: Math.round(weeks * 10) / 10, date: D.capturedAt ? addWeeks(D.capturedAt, weeks) : '—' };
});
const best = scenarios.find(s => s.best) || scenarios[Math.floor(scenarios.length / 2)];

// ---------- render ----------
const barSegs = buckets.concat(unmapped.n ? [unmapped] : [])
  .filter(b => b.n > 0)
  .map(b => `<span style="width:${pct(b.n, totalN)}%;background:${b.color}" title="${esc(b.name)}: ${b.n}"></span>`).join('');
const legend = buckets.concat(unmapped.n ? [unmapped] : []).map(b =>
  `<span class="lg"><span class="dot" style="background:${b.color}"></span>${esc(b.name)} <b>${b.n}</b></span>`).join('');
const rows = buckets.concat(unmapped.n ? [unmapped] : []).map((b, bi) => {
  const detId = `det-${bi}`;
  const items = b.items.length
    ? b.items.map(it => `<li><a href="${jiraBase}/browse/${esc(it.key)}">${esc(it.key)}</a>${it.summary ? `<span class="sm">${esc(it.summary)}</span>` : '<span class="sm"></span>'}<span class="asg">${it.assignee ? esc(it.assignee) : 'Sin asignar'}</span></li>`).join('')
    : '<li class="empty">Sin historias en esta etapa.</li>';
  const head = `<tr class="etapa" role="button" tabindex="0" aria-expanded="false" aria-controls="${detId}" data-det="${detId}">` +
    `<td><span class="st"><span class="dot" style="background:${b.color}"></span>${esc(b.name)}<i class="chev" aria-hidden="true">▸</i></span></td>` +
    `<td>${b.n}</td><td>${hasWeights ? b.pts : '—'}</td><td>${hasWeights ? pct(b.pts, totalPts) + '%' : pct(b.n, totalN) + '%'}</td></tr>`;
  const det = `<tr class="detrow" id="${detId}" hidden><td colspan="4"><ul class="ilist">${items}</ul></td></tr>`;
  return head + det;
}).join('');

const heroBig = hasWeights
  ? `${Math.min(dodCount, dodPts)}–${Math.max(dodCount, dodPts)}<span style="font-size:.5em">%</span>`
  : `${dodCount}<span style="font-size:.5em">%</span>`;
const heroRange = hasWeights
  ? `${done.n} de ${totalN} historias en «${esc(goal)}». Rango: ${dodCount}% por conteo · ${dodPts}% ponderado por tamaño.`
  : `${done.n} de ${totalN} historias en «${esc(goal)}» (modo conteo — sin pesos cargados).`;
const weightedTag = hasWeights ? weightedPts : weightedCount;

const scenCards = scenarios.map((s, k) => {
  const cls = ['s-a', 's-b', 's-c'][k] || 's-b';
  return `<div class="sc ${cls}${s.best ? ' best' : ''}">${s.best ? '<span class="flag">Recomendado</span>' : ''}` +
    `<h3>${esc(s.name)}</h3><p class="cond">${esc(s.cond || '')}</p>` +
    `<div class="date tnum">${esc(s.date)}</div><div class="rate">${s.ratePerWeek} hist/sem · ${s.weeks} sem</div></div>`;
}).join('');

const findingBlock = D.finding ? `
  <section>
    <h2>Hallazgo que condiciona la fecha</h2>
    <div class="callout warn">
      <p class="h">${esc(D.finding.title)}</p>
      <p>${esc(D.finding.body)}</p>
      ${(D.finding.stats && D.finding.stats.length) ? `<div class="mini">${D.finding.stats.map(s => `<div><b class="tnum">${esc(s.v)}</b>${esc(s.k)}</div>`).join('')}</div>` : ''}
    </div>
  </section>` : '';

const risksBlock = (D.risks && D.risks.length) ? `
  <section>
    <h2>Riesgos de cola</h2>
    <p class="lede">Lo que puede correr la fecha aunque el equipo tenga capacidad.</p>
    <div class="card">
      ${D.risks.map(r => `<div class="risk"><div class="chip">${esc(r.tag)}</div><div class="body"><b>${esc(r.title)}</b><p>${esc(r.detail)}</p></div></div>`).join('')}
    </div>
  </section>` : '';

const projBlock = scenarios.length ? `
  <section>
    <h2>Proyección de cierre</h2>
    <p class="lede">Fecha en que todo el alcance alcanzaría «${esc(goal)}». Restante: <b>${remN} historias${hasWeights ? ` / ${remPts} pts` : ''}</b>. Se proyecta por escenarios de ritmo.</p>
    <div class="scen">${scenCards}</div>
  </section>` : '';

const stamp = `Corte: ${esc(D.capturedAt || '—')} · ${totalN} historias · meta = «${esc(goal)}»` +
  (D.epics && D.epics.length ? ` · épicas ${D.epics.map(esc).join(', ')}` : '');
const bestDate = best ? esc(best.date) : '—';
const footWeights = hasWeights
  ? 'El peso por historia proviene de story points o de una estimación de tamaño; es direccional, no un contrato.'
  : 'Modo conteo: todas las historias pesan igual (no hay pesos ni story points cargados). Esto puede subestimar la cola si el trabajo restante es más pesado que el promedio.';

const html = `<title>${esc(title)} — Avance del proyecto</title>
<style>
  :root{
    --bg:#F5F8F9;--surface:#FFFFFF;--surface-2:#EEF3F4;--border:#DBE3E6;
    --ink:#0E1B20;--muted:#5A6C73;--faint:#8A9AA0;--accent:#0B8E96;--accent-soft:#DFF1F1;
    --staging-bg:#F7ECD8;--staging:#B0731A;--risk:#C63E29;
    --font-display:"Iowan Old Style",Georgia,"Times New Roman",serif;
    --font-sans:system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,sans-serif;
    --font-mono:ui-monospace,"SF Mono","Cascadia Code",Menlo,monospace;
  }
  @media (prefers-color-scheme:dark){:root{
    --bg:#0C1417;--surface:#121E22;--surface-2:#1A282D;--border:#26373D;
    --ink:#E9F1F3;--muted:#94A7AE;--faint:#6C7E85;--accent:#2DB7BF;--accent-soft:#0F302F;
    --staging-bg:#2E2415;--staging:#D79A44;--risk:#E76A54;}}
  :root[data-theme="dark"]{
    --bg:#0C1417;--surface:#121E22;--surface-2:#1A282D;--border:#26373D;
    --ink:#E9F1F3;--muted:#94A7AE;--faint:#6C7E85;--accent:#2DB7BF;--accent-soft:#0F302F;
    --staging-bg:#2E2415;--staging:#D79A44;--risk:#E76A54;}
  :root[data-theme="light"]{
    --bg:#F5F8F9;--surface:#FFFFFF;--surface-2:#EEF3F4;--border:#DBE3E6;
    --ink:#0E1B20;--muted:#5A6C73;--faint:#8A9AA0;--accent:#0B8E96;--accent-soft:#DFF1F1;
    --staging-bg:#F7ECD8;--staging:#B0731A;--risk:#C63E29;}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--font-sans);line-height:1.6;-webkit-font-smoothing:antialiased}
  .wrap{max-width:920px;margin:0 auto;padding:clamp(20px,4vw,48px)}
  .tnum{font-variant-numeric:tabular-nums}
  .eyebrow{text-transform:uppercase;letter-spacing:.14em;font-size:12px;font-weight:600;color:var(--accent);margin:0 0 10px}
  h1{font-family:var(--font-display);font-weight:600;font-size:clamp(28px,5vw,42px);line-height:1.12;margin:0 0 8px;text-wrap:balance;letter-spacing:-.01em}
  .sub{color:var(--muted);font-size:16px;margin:0}
  .stamp{color:var(--faint);font-size:13px;margin:14px 0 0;font-family:var(--font-mono)}
  section{margin-top:40px}
  h2{font-family:var(--font-display);font-weight:600;font-size:22px;margin:0 0 4px;letter-spacing:-.01em}
  .lede{color:var(--muted);font-size:14.5px;margin:0 0 18px;max-width:62ch}
  .card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:22px}
  .hero{display:grid;grid-template-columns:1.15fr 1fr;gap:14px}
  @media(max-width:640px){.hero{grid-template-columns:1fr}}
  .headline .big{font-family:var(--font-mono);font-size:clamp(46px,9vw,72px);font-weight:600;line-height:1;letter-spacing:-.03em}
  .headline .range{font-size:15px;color:var(--muted);margin-top:6px}
  .headline .tag{display:inline-block;margin-top:14px;font-size:12.5px;font-weight:600;padding:4px 11px;border-radius:999px;background:var(--accent-soft);color:var(--accent)}
  .aside .arow{display:flex;justify-content:space-between;align-items:baseline;padding:9px 0;border-bottom:1px dashed var(--border)}
  .aside .arow:last-child{border-bottom:0}
  .aside .k{font-size:13.5px;color:var(--muted)}
  .aside .v{font-family:var(--font-mono);font-weight:600;font-size:15px}
  .bar{display:flex;height:22px;border-radius:7px;overflow:hidden;margin:6px 0 14px;border:1px solid var(--border)}
  .bar span{display:block}
  .legend{display:flex;flex-wrap:wrap;gap:14px 20px}
  .lg{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--muted)}
  .dot{width:11px;height:11px;border-radius:3px;flex:none}
  .lg b{color:var(--ink);font-family:var(--font-mono);font-weight:600}
  table{width:100%;border-collapse:collapse;font-size:14.5px}
  th,td{text-align:right;padding:11px 10px;border-bottom:1px solid var(--border)}
  th:first-child,td:first-child{text-align:left}
  thead th{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--faint);font-weight:600}
  tbody td{font-family:var(--font-mono)}
  tbody td:first-child{font-family:var(--font-sans)}
  .st{display:inline-flex;align-items:center;gap:8px;font-weight:500}
  tr.etapa{cursor:pointer}
  tr.etapa:hover td{background:var(--surface-2)}
  tr.etapa:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}
  .chev{font-style:normal;color:var(--faint);margin-left:2px;transition:transform .15s ease;display:inline-block}
  tr.etapa[aria-expanded="true"] .chev{transform:rotate(90deg)}
  tr.detrow>td{padding:0 10px 4px}
  .ilist{list-style:none;margin:2px 0 10px;padding:0;display:grid;gap:6px}
  .ilist li{display:flex;gap:10px;align-items:baseline;flex-wrap:wrap;font-size:13.5px;padding:6px 10px;background:var(--surface-2);border-radius:8px}
  .ilist li.empty{color:var(--faint);font-style:italic;background:transparent}
  .ilist a{font-family:var(--font-mono);font-weight:600;color:var(--accent);text-decoration:none;flex:none}
  .ilist .sm{color:var(--muted);flex:1 1 40%;min-width:0}
  .ilist .asg{flex:none;margin-left:auto;color:var(--ink);font-size:12px;font-weight:500;padding:2px 9px;border-radius:999px;background:var(--surface);border:1px solid var(--border);white-space:nowrap}
  .hint{font-size:12.5px;color:var(--faint);margin:8px 0 0}
  .scen{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
  @media(max-width:640px){.scen{grid-template-columns:1fr}}
  .sc{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:18px;position:relative}
  .sc.best{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent)}
  .sc .flag{position:absolute;top:-11px;left:18px;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;background:var(--accent);color:#fff;padding:3px 10px;border-radius:999px}
  .sc h3{margin:0 0 2px;font-size:15px;font-weight:600}
  .sc .cond{font-size:13px;color:var(--muted);min-height:34px;margin:0 0 12px}
  .sc .date{font-family:var(--font-mono);font-size:22px;font-weight:600;letter-spacing:-.02em;color:var(--accent)}
  .sc .rate{font-size:12.5px;color:var(--faint);margin-top:2px;font-family:var(--font-mono)}
  .callout{border-left:3px solid var(--accent);background:var(--accent-soft);border-radius:0 12px 12px 0;padding:16px 20px}
  .callout.warn{border-left-color:var(--staging);background:var(--staging-bg)}
  .callout p{margin:0}.callout .h{font-weight:600;margin:0 0 4px;font-size:15px}
  .mini{display:flex;gap:20px;flex-wrap:wrap;margin-top:12px}
  .mini div{font-size:13px;color:var(--muted)}
  .mini b{display:block;font-family:var(--font-mono);font-size:20px;font-weight:600;color:var(--ink)}
  .risk{display:flex;gap:14px;padding:15px 0;border-bottom:1px solid var(--border)}
  .risk:last-child{border-bottom:0}
  .risk .chip{flex:none;width:92px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.03em;color:var(--risk);padding-top:2px}
  .risk .body{font-size:14px}.risk .body b{color:var(--ink)}.risk .body p{margin:3px 0 0;color:var(--muted);font-size:13.5px}
  footer{margin-top:44px;padding-top:18px;border-top:1px solid var(--border);font-size:12.5px;color:var(--faint);line-height:1.7}
  footer b{color:var(--muted)}
</style>

<div class="wrap">
  <header>
    <p class="eyebrow">${esc(title)}</p>
    <h1>Estado del proyecto y proyección de cierre</h1>
    <p class="sub">Reporte para stakeholders · alcance en Jira${D.epics && D.epics.length ? ` (épicas ${D.epics.map(esc).join(', ')})` : ''}.</p>
    <p class="stamp">${stamp}</p>
  </header>

  <section class="hero">
    <div class="card headline">
      <p class="eyebrow" style="color:var(--muted)">Avance — alcance terminado (Definition of Done)</p>
      <div class="big tnum">${heroBig}</div>
      <p class="range">${heroRange}</p>
      <span class="tag">Con crédito parcial por etapa (termómetro interno): ~${weightedTag}%</span>
    </div>
    <div class="card aside">
      <p class="eyebrow" style="color:var(--muted)">De un vistazo</p>
      <div class="arow"><span class="k">Historias activas</span><span class="v tnum">${totalN}</span></div>
      <div class="arow"><span class="k">Terminadas («${esc(goal)}»)</span><span class="v tnum" style="color:#1D9E75">${done.n}</span></div>
      <div class="arow"><span class="k">Pendientes de cerrar</span><span class="v tnum">${remN}</span></div>
      ${best ? `<div class="arow"><span class="k">Cierre estimado (${esc((best.name || '').split('·').pop().trim())})</span><span class="v" style="color:var(--accent)">${bestDate}</span></div>` : ''}
    </div>
  </section>

  <section>
    <h2>Dónde está el trabajo</h2>
    <p class="lede">Distribución de las ${totalN} historias por etapa. La barra es proporcional al número de historias.</p>
    <div class="bar" role="img" aria-label="Distribución por etapa">${barSegs}</div>
    <div class="legend">${legend}</div>
    <div class="card" style="margin-top:18px;overflow-x:auto">
      <table>
        <thead><tr><th>Etapa</th><th>Historias</th><th>Peso (pts)</th><th>%</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <p class="hint">Tocá una etapa para ver sus historias.</p>
  </section>
${projBlock}${findingBlock}${risksBlock}
  <footer>
    <p><b>Cómo leer este reporte.</b> El avance se mide como porcentaje del alcance que cumple la Definition of Done (aquí, «${esc(goal)}»); el número «con crédito parcial» es un termómetro interno y no el avance oficial. ${footWeights} La proyección es por escenarios de ritmo.</p>
    <p><b>Fuente:</b> Jira${D.project ? ` proyecto ${esc(D.project)}` : ''}${D.epics && D.epics.length ? `, épicas ${D.epics.map(esc).join(', ')}` : ''}, corte ${esc(D.capturedAt || '—')}. Generado por el skill <code>argos-product:intake</code> (verbo <code>avance</code>).</p>
  </footer>
</div>
<script>
(function(){
  function toggle(row){
    var det=document.getElementById(row.getAttribute("aria-controls"));
    if(!det)return;
    var open=row.getAttribute("aria-expanded")==="true";
    row.setAttribute("aria-expanded",String(!open));
    det.hidden=open;
  }
  var rows=document.querySelectorAll("tr.etapa");
  for(var i=0;i<rows.length;i++){
    rows[i].addEventListener("click",function(){toggle(this);});
    rows[i].addEventListener("keydown",function(e){
      if(e.key==="Enter"||e.key===" "){e.preventDefault();toggle(this);}
    });
  }
})();
</script>`;

writeFileSync(join(dir, 'avance.html'), html);
console.log(`✓ avance: ${join(dir, 'avance.html')}`);
console.log(`  ${totalN} historias · ${done.n} en «${goal}» (${dodCount}% conteo${hasWeights ? `, ${dodPts}% peso` : ''}) · ponderado ~${hasWeights ? weightedPts : weightedCount}%`);
if (unmapped.n) console.log(`  ⚠ ${unmapped.n} con estado sin mapear en stageOrder: ${unmapped.keys.join(', ')}`);
if (best) console.log(`  cierre (${best.name}): ${best.date} (${best.weeks} sem @ ${best.ratePerWeek}/sem)`);
