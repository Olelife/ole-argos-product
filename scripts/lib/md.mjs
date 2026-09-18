// Helpers de parsing markdown para los scripts del intake. Solo stdlib.
//
// Contrato compartido por TODOS los generadores (dashboard, index, roadmap, widget, avance):
//   · el frontmatter admite escalares, listas `[a, b]` / `- a`, y bloques anidados (`figma_url:` + `  clave: url`).
//   · las tablas se leen POR NOMBRE DE COLUMNA (col(row, 'estado')), nunca por posición: cada intake
//     ordena sus columnas distinto y los índices fijos fueron la causa de los conteos en cero.
import { readFileSync } from 'node:fs';

export const JIRA_BASE_DEFAULT = 'https://olelife.atlassian.net';

export function readMaybe(path) {
  try { return readFileSync(path, 'utf8'); } catch { return ''; }
}

// ---------------------------------------------------------------- frontmatter
function stripComment(v) {
  return v.replace(/\s+#.*$/, '').trim();
}

function scalar(raw) {
  const v = stripComment(raw);
  if (/^\[.*\]$/.test(v)) {
    const inner = v.slice(1, -1).trim();
    return inner ? inner.split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean) : [];
  }
  return v.replace(/^["']|["']$/g, '');
}

export function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const fm = {};
  if (!m) return fm;
  const lines = m[1].split('\n');
  let parentKey = null;
  for (const line of lines) {
    if (!line.trim() || /^\s*#/.test(line)) continue;
    const indented = /^\s+/.test(line);
    if (indented && parentKey) {
      const item = line.match(/^\s+-\s+(.*)$/);
      if (item) {
        if (!Array.isArray(fm[parentKey])) fm[parentKey] = [];
        fm[parentKey].push(scalar(item[1]));
        continue;
      }
      const kv = line.match(/^\s+([^:\s][^:]*?):\s*(.*)$/);
      if (kv) {
        if (typeof fm[parentKey] !== 'object' || Array.isArray(fm[parentKey])) fm[parentKey] = {};
        fm[parentKey][kv[1].trim()] = scalar(kv[2]);
        continue;
      }
    }
    const kv = line.match(/^([^:\s][^:]*?):\s*(.*)$/);
    if (!kv) continue;
    const key = kv[1].trim();
    const raw = kv[2];
    parentKey = key;
    fm[key] = stripComment(raw) === '' ? '' : scalar(raw);
  }
  return fm;
}

// Devuelve siempre una lista (para claves que aceptan uno o varios valores, ej. jira_epics).
export function asList(v) {
  if (v == null || v === '') return [];
  if (Array.isArray(v)) return v;
  return String(v).split(',').map(s => s.trim()).filter(Boolean);
}

// La URL base del archivo de Figma, o la primera si el frontmatter trae varias por sección.
export function figmaUrls(fm) {
  const v = fm.figma_url;
  if (!v || v === '—' || v === '-') return [];
  if (typeof v === 'object') return Object.entries(v).map(([k, url]) => ({ key: k, url }));
  return [{ key: 'figma', url: String(v) }];
}

// ---------------------------------------------------------------- tablas
export function normalizeHeader(h) {
  return String(h || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}#?]+/gu, ' ')
    .trim().toLowerCase();
}

// Devuelve { headers, rows } de la primera tabla cuyo header incluye `headerIncludes`.
// Cada fila es un array de celdas con `row.headers` adjunto, para leer por nombre con col().
export function parseTableNamed(text, headerIncludes) {
  let headers = null;
  const rows = [];
  for (const l of text.split('\n')) {
    if (/^\s*\|/.test(l)) {
      const cells = l.split('|').slice(1, -1).map(c => c.trim());
      if (!headers) {
        if (!headerIncludes || cells.join(' ').toLowerCase().includes(headerIncludes.toLowerCase())) {
          headers = cells.map(normalizeHeader);
        }
        continue;
      }
      if (cells.every(c => /^:?-{2,}:?$/.test(c.replace(/\s/g, '')))) continue;
      if (cells.some(c => c.length)) { cells.headers = headers; rows.push(cells); }
    } else if (headers) break;
  }
  return { headers: headers || [], rows };
}

// Filas de la PRIMERA tabla que matchea (índice de historias: las tablas del roadmap también tienen "Historia").
export function parseTable(text, headerIncludes) {
  return parseTableNamed(text, headerIncludes).rows;
}

// Filas de TODAS las tablas cuyo header matchea, concatenadas. Un decision-log largo se parte en
// varias tablas (una por tanda / bump del PRD) y los conteos tienen que sumarlas.
export function parseTablesAll(text, headerIncludes) {
  const rows = [];
  let headers = null, inTable = false;
  for (const l of text.split('\n')) {
    if (/^\s*\|/.test(l)) {
      const cells = l.split('|').slice(1, -1).map(c => c.trim());
      if (!inTable) {
        inTable = true;
        headers = (!headerIncludes || cells.join(' ').toLowerCase().includes(headerIncludes.toLowerCase())) ? cells.map(normalizeHeader) : null;
        continue;
      }
      if (!headers) continue;
      if (cells.every(c => /^:?-{2,}:?$/.test(c.replace(/\s/g, '')))) continue;
      if (cells.some(c => c.length)) { cells.headers = headers; rows.push(cells); }
    } else { inTable = false; headers = null; }
  }
  return rows;
}

export const DUDAS = text => parseTablesAll(text, 'Duda');

// Estado normalizado de una celda: sin negritas ni backticks, en minúsculas.
export const stateOf = cell => String(cell || '').replace(/[*`_]/g, '').trim().toLowerCase().replace(/\s+/g, '-');

// Lee una celda por nombre de columna. Acepta varios alias; prioridad: igual > empieza con > contiene.
export function col(row, ...names) {
  const headers = row.headers || [];
  const wanted = names.map(normalizeHeader);
  for (const w of wanted) { const i = headers.indexOf(w); if (i >= 0) return row[i] || ''; }
  for (const w of wanted) { const i = headers.findIndex(h => h.startsWith(w)); if (i >= 0) return row[i] || ''; }
  for (const w of wanted) { const i = headers.findIndex(h => h.includes(w)); if (i >= 0) return row[i] || ''; }
  return '';
}

// Solo coincidencia exacta: para columnas cuyo nombre es prefijo de otra ("Estado" vs "Estado Jira").
export function colExact(row, ...names) {
  const headers = row.headers || [];
  for (const w of names.map(normalizeHeader)) { const i = headers.indexOf(w); if (i >= 0) return row[i] || ''; }
  return '';
}

// Contrato de columnas de stories.md / decision-log.md (alias que hemos visto en intakes reales).
export const STORY = {
  id: r => col(r, 'historia'),
  title: r => col(r, 'titulo'),
  state: r => colExact(r, 'estado'),
  jiraState: r => colExact(r, 'estado jira'),
  jira: r => jiraKey(col(r, 'jira')),
  rq: r => col(r, 'rq'),
  ready: r => col(r, 'ready?', 'ready'),
};

export const DUDA = {
  id: r => col(r, '#', 'n'),
  text: r => col(r, 'duda'),
  source: r => col(r, 'fuente'),
  state: r => col(r, 'estado'),
  answer: r => col(r, 'respuesta', 'respuesta decision', 'decision'),
  date: r => col(r, 'fecha'),
};

export function jiraKey(cell) {
  const m = String(cell || '').match(/\b([A-Z][A-Z0-9]+-\d+)\b/);
  return m ? m[1] : '';
}

// Una historia está cerrada si su estado local lo dice, o si su estado en Jira alcanzó la meta.
export function storyClosed(row, goalStatus) {
  if (stateOf(STORY.state(row)) === 'cerrada') return true;
  const js = stateOf(STORY.jiraState(row));
  return !!goalStatus && !!js && js === stateOf(goalStatus);
}

export function dudaOpen(row) {
  return stateOf(DUDA.state(row)).startsWith('abierta');
}

export function jiraBaseOf(fm, override) {
  return String(override || fm.jira_base || process.env.OLE_JIRA_BASE || JIRA_BASE_DEFAULT).replace(/\/+$/, '');
}

export const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
