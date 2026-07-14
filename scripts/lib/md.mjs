// Helpers mínimos de parsing markdown para los scripts del intake. Solo stdlib.
import { readFileSync } from 'node:fs';

export function readMaybe(path) {
  try { return readFileSync(path, 'utf8'); } catch { return ''; }
}

export function parseFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  const fm = {};
  if (m) for (const line of m[1].split('\n')) {
    const i = line.indexOf(':');
    if (i > 0) fm[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/\s*#.*$/, '');
  }
  return fm;
}

// Devuelve filas (arrays de celdas) de la primera tabla cuyo header incluye `headerIncludes`.
export function parseTable(text, headerIncludes) {
  const rows = [];
  let started = false;
  for (const l of text.split('\n')) {
    if (/^\s*\|/.test(l)) {
      const cells = l.split('|').slice(1, -1).map(c => c.trim());
      if (!started) {
        if (!headerIncludes || cells.join(' ').toLowerCase().includes(headerIncludes.toLowerCase())) { started = true; }
        continue;
      }
      if (cells.every(c => /^:?-{2,}:?$/.test(c.replace(/\s/g, '')))) continue; // separador
      if (cells.some(c => c.length)) rows.push(cells);
    } else if (started) break;
  }
  return rows;
}

export const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
