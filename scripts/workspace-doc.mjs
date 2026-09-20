#!/usr/bin/env node
// workspace-doc.mjs [--motor <dir>] [--data <repoDatos>] [--write <CLAUDE.md>]
//
// Genera la ficha de verbos del taller de Producto LEYENDO los skills del Motor, para que no se
// desactualice a mano: cada `### \`verbo\`` de un SKILL.md es una fila, y el H1 de cada skill es su
// descripción corta. Si el repo de datos está clonado, agrega además los slugs vivos con su estado.
//
// Escribe SOLO entre marcadores (`<!-- argos:verbos -->` … `<!-- /argos:verbos -->` y
// `<!-- argos:intakes -->` … `<!-- /argos:intakes -->`), igual que el bloque auto de STATUS.md:
// la prosa de alrededor es del equipo y no se toca. Sin --write, imprime los bloques por stdout.
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readMaybe, parseFrontmatter } from './lib/md.mjs';

const args = process.argv.slice(2);
const opt = f => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const motor = opt('--motor') || process.env.CLAUDE_PLUGIN_ROOT || dirname(dirname(fileURLToPath(import.meta.url)));
const data = opt('--data');
const write = opt('--write');

// --- skills del Motor: H1 = descripción corta, `### \`verbo\`` = fila de la ficha
const skillsDir = join(motor, 'skills');
if (!existsSync(skillsDir)) { console.error(`✗ no encuentro los skills del Motor en ${skillsDir}`); process.exit(1); }
const skills = [];
for (const name of readdirSync(skillsDir).sort()) {
  const md = readMaybe(join(skillsDir, name, 'SKILL.md'));
  if (!md) continue;
  const h1 = (md.match(/^#\s+\/argos-product:[a-z-]+\s*[—–-]\s*(.+)$/m) || [])[1] || '';
  const verbs = [];
  for (const line of md.split('\n')) {
    const m = line.match(/^###\s+`([a-z-]+)`(.*)$/);
    if (!m) continue;
    let [, verb, rest] = m;
    let alt = '';
    const a = rest.match(/^\s*\/\s*`([a-z-]+)`/);
    if (a) { alt = a[1]; rest = rest.slice(a[0].length); }
    const why = rest.replace(/^\s*\(default\)/, '').replace(/^[\s/—–>→-]+/, '').trim();
    verbs.push({ verb, alt, why });
  }
  skills.push({ name, h1, verbs });
}

const esc = s => String(s).replace(/\|/g, '\\|');
const V = ['## Skills del Motor', '', '| Skill | Para qué sirve |', '|---|---|'];
for (const s of skills) V.push(`| \`/argos-product:${s.name}\` | ${esc(s.h1)} |`);
for (const s of skills.filter(x => x.verbs.length)) {
  V.push('', `### Verbos de \`/argos-product:${s.name}\``, '', '| Verbo | Qué hace |', '|---|---|');
  for (const v of s.verbs) V.push(`| \`${v.verb}\`${v.alt ? ` · \`${v.alt}\`` : ''} | ${esc(v.why)} |`);
}
V.push('', `Se invocan en lenguaje natural o con el verbo explícito, por ejemplo \`/argos-product:intake ver <slug>\`.`);

// --- intakes vivos (si el repo de datos está clonado)
const I = ['## Intakes vivos'];
let nIntakes = 0;
const intakesDir = data ? join(data, 'intakes') : null;
if (intakesDir && existsSync(intakesDir)) {
  const rows = [];
  for (const d of readdirSync(intakesDir).sort()) {
    if (d.startsWith('_')) continue;
    const st = join(intakesDir, d, 'STATUS.md');
    if (!existsSync(st)) continue;
    const fm = parseFrontmatter(readFileSync(st, 'utf8'));
    rows.push({ slug: fm.slug || basename(d), title: fm.title || '', status: String(fm.status || '').split('#')[0].trim() || '—' });
  }
  nIntakes = rows.length;
  if (rows.length) {
    I.push('', '| Slug | Estado | Qué es |', '|---|---|---|');
    for (const r of rows) I.push(`| \`${r.slug}\` | ${esc(r.status)} | ${esc(r.title)} |`);
    I.push('', 'El slug es la llave de todo: carpeta, nombre del PRD y etiqueta en Jira. No se renombra.');
  } else I.push('', 'El repo de datos está clonado pero todavía no tiene intakes.');
} else {
  I.push('', 'Todavía no está clonado el repo de datos. Corré `/argos-product:setup` y volvé a generar esta ficha.');
}

const blocks = [['verbos', V.join('\n')], ['intakes', I.join('\n')]];
if (!write) { console.log(blocks.map(([, b]) => b).join('\n\n')); process.exit(0); }

let doc = readMaybe(write);
if (!doc) { console.error(`✗ no encuentro ${write}`); process.exit(1); }
for (const [tag, body] of blocks) {
  const rx = new RegExp(`<!-- argos:${tag} -->[\\s\\S]*?<!-- /argos:${tag} -->`);
  const filled = `<!-- argos:${tag} -->\n${body}\n<!-- /argos:${tag} -->`;
  if (rx.test(doc)) doc = doc.replace(rx, filled);
  else doc = doc.replace(/\n*$/, `\n\n${filled}\n`);
}
writeFileSync(write, doc);
const nVerbs = skills.reduce((a, s) => a + s.verbs.length, 0);
console.log(`✓ ficha del taller → ${write}: ${skills.length} skills · ${nVerbs} verbos · ${nIntakes} intakes`);
