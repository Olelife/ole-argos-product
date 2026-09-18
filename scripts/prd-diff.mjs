#!/usr/bin/env node
// prd-diff.mjs <intakeDir> [--from <rev>] [--file <PRD.md>] [--write --version <vN> --date <YYYY-MM-DD>]
// prd-diff.mjs --old <a.md> --new <b.md>
//
// Diff ESTRUCTURAL entre dos versiones del PRD, en el vocabulario de OpenSpec/Kiro: qué se AGREGÓ, qué se
// MODIFICÓ y qué se QUITÓ — por sección (headings), por regla numerada (RN-xx), por criterio de aceptación
// (líneas Dado/cuando/entonces · CA-xx) y por historia/caso de uso (### S<n> · ### CU-xx). Un diff de texto
// no le sirve al PM ni a Dev; este sí: dice qué reglas cambiaron.
//
//   default: el PRD del intake contra su versión en git (--from HEAD, o el rev que se pase).
//   --write: agrega la sección "## Cambios vN (fecha)" a <intakeDir>/changelog-prd.md (se crea si falta).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, basename, relative, dirname } from 'node:path';
import { execSync } from 'node:child_process';
import { readMaybe, parseFrontmatter } from './lib/md.mjs';

const args = process.argv.slice(2);
const opt = f => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const has = f => args.includes(f);

let oldText, newText, label;
if (opt('--old') && opt('--new')) {
  oldText = readFileSync(opt('--old'), 'utf8'); newText = readFileSync(opt('--new'), 'utf8'); label = `${basename(opt('--old'))} → ${basename(opt('--new'))}`;
} else {
  const dir = args[0];
  if (!dir || dir.startsWith('--')) { console.error('uso: prd-diff.mjs <intakeDir> [--from <rev>] | --old <a.md> --new <b.md>'); process.exit(1); }
  const fm = parseFrontmatter(readMaybe(join(dir, 'STATUS.md')));
  const slug = fm.slug || basename(dir);
  const file = opt('--file') || join(dir, `PRD-${slug}.md`);
  if (!existsSync(file)) { console.error(`✗ no existe ${file}`); process.exit(1); }
  newText = readFileSync(file, 'utf8');
  const rev = opt('--from') || 'HEAD';
  try {
    const root = execSync('git rev-parse --show-toplevel', { cwd: dirname(file) }).toString().trim();
    oldText = execSync(`git show ${rev}:"${relative(root, file)}"`, { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString();
  } catch { console.error(`✗ no pude leer la versión ${rev} del PRD en git`); process.exit(2); }
  label = `${rev} → working tree`;
}

const norm = s => s.replace(/\s+/g, ' ').trim();
function extract(text) {
  const sections = new Map(), rules = new Map(), criteria = new Map(), stories = new Map();
  const heads = [...text.matchAll(/^(#{1,4})\s+(.+)$/gm)];
  for (let i = 0; i < heads.length; i++) {
    const h = heads[i]; const title = norm(h[2]);
    const end = i + 1 < heads.length ? heads[i + 1].index : text.length;
    const body = text.slice(h.index + h[0].length, end);
    const key = title.replace(/^\d+(\.\d+)*\.?\s*/, '').replace(/[✅🚫❓📎]/gu, '').trim();
    sections.set(key, norm(body));
    const sm = title.match(/\b((?:EP-[A-Z0-9-]+-)?[SH]\d+[a-z]?|CU-\d+)\b/);
    if (sm) stories.set(sm[1].replace(/^EP-[A-Z0-9-]+-/, ''), { title, body: norm(body) });
  }
  for (const m of text.matchAll(/^\|\s*(RN-\d+)\s*\|\s*([^|]+)\|/gm)) rules.set(m[1], norm(m[2]));
  for (const m of text.matchAll(/^\s*[-*]\s*(?:\[[ x]\]\s*)?(?:(CA-[\w.]+)\s*[·:-]\s*)?((?:Dad[oa]s?|Cuando)\b[^\n]+)$/gim)) {
    const key = m[1] || norm(m[2]).slice(0, 60); criteria.set(key, norm(m[2]));
  }
  return { sections, rules, criteria, stories };
}
const A = extract(oldText), B = extract(newText);
function diffMap(a, b, val = x => x) {
  const added = [], removed = [], modified = [];
  for (const [k, v] of b) { if (!a.has(k)) added.push(k); else if (val(a.get(k)) !== val(v)) modified.push(k); }
  for (const k of a.keys()) if (!b.has(k)) removed.push(k);
  return { added, removed, modified };
}
const d = {
  sections: diffMap(A.sections, B.sections),
  rules: diffMap(A.rules, B.rules),
  criteria: diffMap(A.criteria, B.criteria),
  stories: diffMap(A.stories, B.stories, s => s.body),
};
const total = Object.values(d).reduce((n, x) => n + x.added.length + x.removed.length + x.modified.length, 0);

const fmt = (name, x, show = k => `\`${k}\``) => {
  if (!x.added.length && !x.removed.length && !x.modified.length) return '';
  const l = [`**${name}**`];
  if (x.added.length) l.push(`- ADDED: ${x.added.map(show).join(' · ')}`);
  if (x.modified.length) l.push(`- MODIFIED: ${x.modified.map(show).join(' · ')}`);
  if (x.removed.length) l.push(`- REMOVED: ${x.removed.map(show).join(' · ')}`);
  return l.join('\n');
};
const ruleShow = k => `\`${k}\`${B.rules.has(k) ? ` — ${B.rules.get(k).slice(0, 90)}${B.rules.get(k).length > 90 ? '…' : ''}` : A.rules.has(k) ? ` — ~~${A.rules.get(k).slice(0, 60)}~~` : ''}`;
const storyShow = k => `\`${k}\`${(B.stories.get(k) || A.stories.get(k) || {}).title ? ` · ${(B.stories.get(k) || A.stories.get(k)).title.replace(/^.*?·\s*/, '').slice(0, 60)}` : ''}`;
const report = [fmt('Secciones', d.sections), fmt('Reglas numeradas', d.rules, ruleShow), fmt('Criterios de aceptación', d.criteria, k => `\`${k}\``), fmt('Historias / casos de uso', d.stories, storyShow)].filter(Boolean).join('\n\n');

if (has('--json')) { console.log(JSON.stringify({ label, total, ...d }, null, 2)); process.exit(0); }
console.log(`🗿 prd-diff ${label}: ${total} cambio(s) estructural(es)`);
console.log(report ? '\n' + report + '\n' : '  Sin cambios de secciones, reglas, criterios ni historias (solo texto).\n');

if (has('--write') && !opt('--old')) {
  const dir = args[0]; const v = opt('--version') || 'vN'; const date = opt('--date') || '';
  const p = join(dir, 'changelog-prd.md');
  const prev = readMaybe(p) || `# Cambios del PRD · ${basename(dir)}\n\nDeltas estructurales por versión (los genera \`prd-diff.mjs\` del motor; el texto lo cura el PM).\n`;
  const block = `\n## Cambios ${v}${date ? ` (${date})` : ''}\n\n${report || '_Solo cambios de redacción._'}\n`;
  writeFileSync(p, prev.trimEnd() + '\n' + block);
  console.log(`✓ ${p} actualizado (${v})`);
}
