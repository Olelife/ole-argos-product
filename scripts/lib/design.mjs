// Helpers compartidos por los scripts de diseño desde el código fuente de Claude Design
// (design-freeze, design-spec, design-avalidar, design-link). Estándar: standards/design-spec.md.
import { existsSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { readMaybe, normalizeHeader } from './md.mjs';

export const SPEC_FILES = ['spec.json', 'copy.md', 'a-validar.md'];
export const NOTAS_HEADERS = ['#', 'Qué muestra el diseño', 'PRD / decisión', 'Para Diseño'];
export const SPECS_HEADERS = ['Carpeta', 'Pantalla', 'Historias', 'Estados extraídos'];
export const SOURCE_HEADERS = ['Carpeta', 'Proyecto Claude Design', 'Archivos vigentes', 'Zip original (sha256, 16 car.)'];

// <intake>/figma/<vN>/<superficie>/specs/<pantalla> → sus piezas. null si la ruta no sigue el estándar.
export function specLayout(specDir) {
  const parts = specDir.split(sep);
  const i = parts.lastIndexOf('specs');
  if (i < 3 || parts[i - 3] !== 'figma' || i !== parts.length - 2) return null;
  return {
    pantalla: parts[i + 1],
    superficie: parts[i - 1],
    version: parts[i - 2],
    versionDir: parts.slice(0, i - 1).join(sep),
    supDir: parts.slice(0, i).join(sep),
    intakeDir: parts.slice(0, i - 3).join(sep),
  };
}

// Las carpetas de spec de una versión, como `<superficie>/specs/<pantalla>` (relativas a figma/<vN>).
export function specFolders(versionDir) {
  const out = [];
  if (!existsSync(versionDir)) return out;
  for (const sup of readdirSync(versionDir, { withFileTypes: true })) {
    if (!sup.isDirectory()) continue;
    const specs = join(versionDir, sup.name, 'specs');
    if (!existsSync(specs)) continue;
    for (const p of readdirSync(specs, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name).sort()) {
      out.push(`${sup.name}/specs/${p}`);
    }
  }
  return out;
}

// El sistema de diseño congelado al lado del prototipo: `<superficie>/source/_ds/<ds>/`.
export function designSystemOf(supDir, override) {
  const dsRoot = join(supDir, 'source', '_ds');
  const dirs = existsSync(dsRoot) ? readdirSync(dsRoot, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name).sort() : [];
  let name = override || '';
  if (!name && dirs.length) {
    const h1 = (readMaybe(join(dsRoot, dirs[0], 'readme.md')).match(/^#\s+(.+)$/m) || [])[1];
    if (h1) name = h1.replace(/\s*[·—-]?\s*Design System\s*$/i, '').trim();
    if (!name) {
      try { name = JSON.parse(readMaybe(join(dsRoot, dirs[0], '_ds_manifest.json')) || '{}').namespace || ''; } catch { name = ''; }
    }
  }
  return { name: name || '?', dirs, tokensDirs: dirs.map(d => join(dsRoot, d, 'tokens')) };
}

// --------------------------------------------------------------- tablas editables en su lugar
const isRow = l => /^\s*\|/.test(l);
const cellsOf = l => l.split('|').slice(1, -1).map(c => c.trim());
const isSep = cells => cells.length && cells.every(c => /^:?-{2,}:?$/.test(c.replace(/\s/g, '')));

// Primera tabla cuyo encabezado tiene TODAS las columnas pedidas (comparadas normalizadas).
export function findTable(text, required) {
  const want = required.map(normalizeHeader);
  const lines = text.split('\n');
  for (let i = 0; i < lines.length - 1; i++) {
    if (!isRow(lines[i]) || (i > 0 && isRow(lines[i - 1]))) continue;
    const headers = cellsOf(lines[i]).map(normalizeHeader);
    if (!isSep(cellsOf(lines[i + 1])) || !want.every(w => headers.includes(w))) continue;
    let end = i + 2;
    while (end < lines.length && isRow(lines[end])) end++;
    const rows = lines.slice(i + 2, end).map(cellsOf);
    return { start: i, end, headers, rows, lines };
  }
  return null;
}

export const cell = (t, row, name) => row[t.headers.indexOf(normalizeHeader(name))] ?? '';

export function renderTable(headers, rows) {
  const line = cs => `| ${cs.map(c => String(c ?? '').replace(/\|/g, '/').replace(/\n/g, ' ')).join(' | ')} |`;
  return [line(headers), `|${headers.map(() => '---').join('|')}|`, ...rows.map(line)];
}

// Inserta o reemplaza la fila cuya columna `key` vale `row[key]`; conserva el orden y las columnas extra.
export function upsertRow(text, headers, key, values, { createAfter } = {}) {
  const t = findTable(text, headers);
  const norm = normalizeHeader(key);
  if (!t) {
    const block = renderTable(headers, [headers.map(h => values[h] ?? '')]).join('\n');
    if (createAfter && text.includes(createAfter)) return text.replace(createAfter, `${createAfter}\n\n${block}`);
    return `${text.replace(/\s*$/, '')}\n\n${block}\n`;
  }
  const keyIdx = t.headers.indexOf(norm);
  const full = cellsOf(t.lines[t.start]);
  const rows = t.rows.map(r => [...r]);
  const asRow = prev => full.map((h, i) => {
    const v = Object.entries(values).find(([k]) => normalizeHeader(k) === normalizeHeader(h));
    return v ? v[1] : (prev ? prev[i] : '');
  });
  const at = rows.findIndex(r => sameKey(r[keyIdx], values[key]));
  if (at >= 0) rows[at] = asRow(rows[at]); else rows.push(asRow(null));
  const out = [...t.lines.slice(0, t.start), ...renderTable(full, rows), ...t.lines.slice(t.end)];
  return out.join('\n');
}

export const sameKey = (a, b) => stripMd(a) === stripMd(b);
export const stripMd = s => String(s || '').replace(/[`*]/g, '').replace(/\/+$/, '').trim();

// --------------------------------------------------------------- notas.md
// La sección 1 del a-validar sale de notas.md, curada a mano con una tabla de formato fijo.
export function checkNotas(text) {
  if (!text.trim()) return { ok: false, why: 'notas.md vacío', rows: [] };
  const t = findTable(text, NOTAS_HEADERS);
  if (!t) return { ok: false, why: `notas.md sin la tabla estándar | ${NOTAS_HEADERS.join(' | ')} |`, rows: [] };
  const rows = t.rows.filter(r => r.some(Boolean));
  const accion = rows.filter(r => !/^(coincide|sin observaci[oó]n)/i.test(stripMd(cell(t, r, 'Para Diseño'))));
  return { ok: true, rows, accion };
}

export const relFromIntake = (intakeDir, p) => relative(intakeDir, p).split(sep).join('/');
