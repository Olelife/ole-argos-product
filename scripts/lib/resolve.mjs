// resolve.mjs — resolver un intake a partir de lo que el PM escribió, sin pedirle el slug exacto.
//
// El slug es la llave de todo (carpeta, PRD, label de Jira) y por eso no se renombra, pero nadie tiene
// por qué tenerlo en la cabeza. Acá se resuelve "póliza", "el módulo poliza", "SO-912" o nada.
// Es una función pura: la lectura del disco vive en intake-resolve.mjs.

export const norm = s => String(s || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const ACTIVE = ['in-delivery', 'in-review', 'ready'];

// candidates: [{ slug, title, status, epics: [] }] · query: texto libre · last: slug de la última vez
// → { match, why, ambiguous: [] }   (match null + ambiguous lleno = hay que preguntar o mostrar el panel)
export function resolveIntake(candidates, query, { last } = {}) {
  const list = candidates.filter(c => c && c.slug);
  if (!list.length) return { match: null, why: 'no hay intakes en el repo de datos', ambiguous: [] };
  const q = norm(query);

  if (!q) {
    const prev = list.find(c => c.slug === last);
    if (prev) return { match: prev, why: `el último intake que tocaste (${prev.slug})`, ambiguous: [] };
    const active = list.filter(c => ACTIVE.includes(norm(c.status)));
    if (active.length === 1) return { match: active[0], why: `el único intake en «${active[0].status}»`, ambiguous: [] };
    return { match: null, why: 'sin pista para elegir', ambiguous: list };
  }

  const pick = (hits, why) => hits.length === 1 ? { match: hits[0], why, ambiguous: [] } : null;
  const words = q.split('-').filter(w => w.length > 2);
  const levels = [
    [list.filter(c => norm(c.slug) === q), 'slug exacto'],
    [list.filter(c => (c.epics || []).some(k => norm(k) === q)), 'clave de la épica en Jira'],
    [list.filter(c => norm(c.slug).startsWith(q)), 'prefijo del slug'],
    [list.filter(c => norm(c.slug).includes(q)), 'parte del slug'],
    [list.filter(c => words.length && words.every(w => `${norm(c.slug)}-${norm(c.title)}`.includes(w))), 'palabras del título'],
  ];
  for (const [hits, why] of levels) { const r = pick(hits, why); if (r) return r; }

  // varios candidatos en el nivel más específico que dio algo: hay que desambiguar, no adivinar
  for (const [hits, why] of levels) if (hits.length > 1) return { match: null, why: `«${query}» coincide con varios (${why})`, ambiguous: hits };
  return { match: null, why: `«${query}» no coincide con ningún intake`, ambiguous: [] };
}
