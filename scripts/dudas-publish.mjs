#!/usr/bin/env node
// dudas-publish.mjs <intakeDir> [--ids 12,15b] [--all-open] [--json]
//
// Arma los mensajes de Slack para publicar dudas del intake, UN HILO POR DUDA (verbo `preguntar` de /intake).
// El agente los manda con slack_send_message tras el OK del PM, recibe los permalinks y los guarda en la fila
// con dudas-resolve.mjs (`fuente_add`). Solo dudas `abierta` que todavía no tengan un permalink de Slack.
// Salida (--json): [ { id, channel, text, stories: [...] } ]  ·  default: los textos listos para pegar.
//
// Formato del mensaje (mrkdwn de Slack): título con el # y las historias · la duda · el default de Argos ·
// la consigna de ratificación (✅ del PM sobre la respuesta que vale). Sin jerga de código.
import { join, basename } from 'node:path';
import { readMaybe, parseFrontmatter, parseTable, DUDAS, DUDA, dudaOpen, STORY, jiraBaseOf } from './lib/md.mjs';

const args = process.argv.slice(2);
const dir = args[0];
const opt = f => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
if (!dir) { console.error('uso: dudas-publish.mjs <intakeDir> [--ids a,b] [--all-open] [--json]'); process.exit(1); }
const fm = parseFrontmatter(readMaybe(join(dir, 'STATUS.md')));
const slug = fm.slug || basename(dir);
const channel = String(fm.slack_channel || process.env.OLE_SLACK_CHANNEL || '#squad-petra-interno');
const jiraBase = jiraBaseOf(fm);
const wanted = opt('--ids') ? new Set(opt('--ids').split(',').map(s => s.trim().replace(/^#/, ''))) : null;
const dudas = DUDAS(readMaybe(join(dir, 'decision-log.md')));
const stories = parseTable(readMaybe(join(dir, 'stories.md')), 'Historia');
const sidOf = id => { const m = String(id).match(/\b([SH]\d+[a-z]?)\s*$/i); return m ? m[1].toUpperCase() : ''; };
const byS = new Map(stories.map(r => [sidOf(STORY.id(r)), r]));

const plain = s => String(s || '').replace(/\*\*/g, '*').replace(/`/g, '').replace(/\s+/g, ' ').trim();
const out = [];
for (const d of dudas) {
  const id = DUDA.id(d).replace(/\*/g, '').trim();
  if (!id) continue;
  if (wanted ? !wanted.has(id) : !(args.includes('--all-open') && dudaOpen(d))) continue;
  if (/slack\.com\/archives\//i.test(DUDA.source(d))) continue;
  const text = DUDA.text(d), answer = DUDA.answer(d);
  const sids = [...new Set([...(text + ' ' + answer).matchAll(/\b(S\d+[a-z]?)\b/g)].map(m => m[1].toUpperCase()))].filter(s => byS.has(s));
  const storyLine = sids.map(s => { const r = byS.get(s); const k = STORY.jira(r); return k ? `<${jiraBase}/browse/${k}|${k}> ${STORY.title(r)}` : `${s} ${STORY.title(r)}`; }).join(' · ');
  const title = plain(text).split(/[.?!]\s/)[0].slice(0, 120);
  const body = plain(text).slice(0, 900);
  const def = plain(answer).replace(/^Default de Argos:\s*/i, '').replace(/^Argos propone:\s*/i, '');
  const msg = [
    `🗿 *Duda #${id} · ${fm.title || slug}*${storyLine ? ` · ${storyLine}` : ''}`,
    body,
    def && def !== '—' ? `_Default de Argos:_ ${def.slice(0, 500)}` : null,
    `_Respondé en este hilo. La respuesta que vale la ratifica el PM con ✅; Argos la registra en el decision-log con tu nombre y el link, y actualiza el PRD._`,
  ].filter(Boolean).join('\n');
  out.push({ id, channel, title, stories: sids, text: msg });
}
if (args.includes('--json')) { console.log(JSON.stringify(out, null, 2)); process.exit(0); }
if (!out.length) { console.log(`(${slug}: ninguna duda para publicar${wanted ? ' con esos ids' : ' — usá --ids o --all-open'}; las que ya tienen hilo se omiten)`); process.exit(0); }
console.log(`🗿 ${out.length} duda(s) para publicar en ${channel} (un hilo por duda):\n`);
for (const m of out) console.log(`──── #${m.id}\n${m.text}\n`);
