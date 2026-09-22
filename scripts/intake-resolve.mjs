#!/usr/bin/env node
// intake-resolve.mjs "<lo que dijo el PM>" [--data <repoDatos>] [--json] [--touch]
//
// Traduce lo que el PM escribió a un intake concreto: "póliza", "el modulo poliza", "SO-912" o nada.
// Lo usan todos los verbos de /argos-product:intake antes de armar la ruta, para que el slug exacto
// deje de ser un requisito de memoria. La lógica de match vive en lib/resolve.mjs (pura, testeada).
//
// Salidas: 0 resuelto (imprime la ruta) · 2 ambiguo (lista los candidatos) · 1 sin coincidencia.
// Con --touch recuerda el intake como «el último que tocaste» en <repoDatos>/.argos-state.json,
// que es lo que hace funcionar un «¿cómo va?» sin más datos.
import { existsSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname, resolve as abs } from 'node:path';
import { readMaybe, parseFrontmatter, asList } from './lib/md.mjs';
import { resolveIntake } from './lib/resolve.mjs';

const args = process.argv.slice(2);
const opt = f => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const asJson = args.includes('--json'), touch = args.includes('--touch');
const query = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--data').join(' ').trim();

// --- repo de datos: --data, OLE_REPOS, o el primer ancestro que lo tenga
function findData() {
  const explicit = opt('--data') || process.env.OLE_PRODUCT_DATA;
  if (explicit) return abs(explicit);
  const repos = process.env.OLE_REPOS ? [abs(process.env.OLE_REPOS)] : [];
  for (let d = process.cwd(); ; d = dirname(d)) {
    repos.push(d, join(d, 'repos'));
    if (dirname(d) === d) break;
  }
  for (const r of repos) {
    for (const c of [r, join(r, 'ole-argos-product-data')]) if (existsSync(join(c, 'intakes'))) return c;
  }
  return null;
}
const data = findData();
if (!data) { console.error('✗ no encuentro el repo de datos (ole-argos-product-data). Corré /argos-product:setup o pasá --data.'); process.exit(1); }

const statePath = join(data, '.argos-state.json');
const state = (() => { try { return JSON.parse(readFileSync(statePath, 'utf8')); } catch { return {}; } })();

const candidates = readdirSync(join(data, 'intakes')).sort().filter(d => !d.startsWith('_')).flatMap(d => {
  const st = join(data, 'intakes', d, 'STATUS.md');
  if (!existsSync(st)) return [];
  const fm = parseFrontmatter(readMaybe(st));
  return [{ slug: fm.slug || d, dir: join(data, 'intakes', d), title: fm.title || '', status: String(fm.status || '').split('#')[0].trim(), epics: asList(fm.jira_epics) }];
});

const r = resolveIntake(candidates, query, { last: state.lastIntake });
const out = { query, data, match: r.match ? { slug: r.match.slug, dir: r.match.dir, title: r.match.title, status: r.match.status } : null, why: r.why, ambiguous: r.ambiguous.map(c => ({ slug: c.slug, title: c.title, status: c.status })) };

if (r.match && touch) { try { writeFileSync(statePath, JSON.stringify({ ...state, lastIntake: r.match.slug, at: new Date().toISOString().slice(0, 10) }, null, 2) + '\n'); } catch { /* estado best-effort */ } }

if (asJson) { console.log(JSON.stringify(out, null, 2)); process.exit(r.match ? 0 : r.ambiguous.length ? 2 : 1); }
if (r.match) { console.log(r.match.dir); console.error(`✓ ${r.match.slug} — ${r.why}`); process.exit(0); }
console.error(`✗ ${r.why}`);
if (r.ambiguous.length) { for (const c of r.ambiguous) console.error(`    ${c.slug.padEnd(32)} ${c.status || '—'}   ${c.title}`); console.error('  → elegí uno, o abrí el panel con /argos-product:intake sin argumentos.'); process.exit(2); }
process.exit(1);
