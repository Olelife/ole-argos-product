// Tests del contrato de parsing compartido (scripts/lib/md.mjs). Correr: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFrontmatter, parseTable, col, colExact, STORY, DUDA, storyClosed, dudaOpen, asList, figmaUrls, jiraKey, jiraBaseOf } from '../scripts/lib/md.mjs';
import { resolveIntake } from '../scripts/lib/resolve.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const intake = join(here, 'fixtures', 'data-repo', 'intakes', 'sample-intake');
const read = f => readFileSync(join(intake, f), 'utf8');

test('frontmatter: bloque anidado (figma_url por sección)', () => {
  const fm = parseFrontmatter(read('STATUS.md'));
  assert.equal(typeof fm.figma_url, 'object');
  assert.equal(fm.figma_url.asesores, 'https://www.figma.com/design/FILEKEY/Archivo?node-id=10-20');
  assert.equal(fm.figma_url['portal-ole'], 'https://www.figma.com/design/FILEKEY2/Otro?node-id=30-40');
  assert.equal(figmaUrls(fm).length, 2);
});

test('frontmatter: listas con y sin comillas, comentarios al final', () => {
  const fm = parseFrontmatter(read('STATUS.md'));
  assert.deepEqual(fm.jira_epics, ['SO-100', 'SO-200']);
  assert.deepEqual(fm.jira_stage_order, ['Tareas por hacer', 'En curso', 'Staging', 'Ready to Prod']);
  assert.equal(fm.status, 'in-delivery');
  assert.equal(fm.figma_version, 'v1');
  assert.equal(fm.jira_title_prefix, '[Muestra]');
  assert.deepEqual(asList('SO-1, SO-2'), ['SO-1', 'SO-2']);
  assert.deepEqual(asList(['SO-1']), ['SO-1']);
});

test('frontmatter: escalar simple sigue funcionando (compatibilidad)', () => {
  const fm = parseFrontmatter('---\nslug: x\nfigma_url: https://f.com/a?node-id=1-2\nupdated: 2026-01-01   # nota\n---\n');
  assert.equal(fm.figma_url, 'https://f.com/a?node-id=1-2');
  assert.equal(fm.updated, '2026-01-01');
  assert.equal(figmaUrls(fm)[0].url, 'https://f.com/a?node-id=1-2');
});

test('tablas: lectura por nombre de columna, no por posición', () => {
  const rows = parseTable(read('stories.md'), 'Historia');
  assert.equal(rows.length, 3);
  assert.equal(STORY.id(rows[0]), 'S1');
  assert.equal(STORY.title(rows[1]), 'Ver el histórico');
  assert.equal(STORY.ready(rows[2]).startsWith('🚧'), true);
  assert.equal(STORY.jira(rows[0]), 'SO-101', 'extrae el key aunque venga como link');
  assert.equal(STORY.jira(rows[1]), 'SO-102');
  assert.equal(STORY.jira(rows[2]), '');
  assert.equal(STORY.rq(rows[0]), 'RQ-1');
});

test('tablas: "Estado" exacto no se confunde con "Estado Jira"', () => {
  const rows = parseTable(read('stories.md'), 'Historia');
  assert.equal(STORY.state(rows[0]), '', 'no hay columna Estado local en este layout');
  assert.equal(STORY.jiraState(rows[0]), 'Ready to Prod');
  assert.equal(colExact(rows[0], 'titulo'), 'Ver el listado');
  assert.equal(col(rows[0], 'ready?'), '🟢');
});

test('historias cerradas: por estado local o por meta de Jira', () => {
  const rows = parseTable(read('stories.md'), 'Historia');
  assert.equal(storyClosed(rows[0], 'Ready to Prod'), true);
  assert.equal(storyClosed(rows[1], 'Ready to Prod'), false);
  assert.equal(storyClosed(rows[0], undefined), false, 'sin meta declarada no se infiere');
  const local = parseTable('| Historia | Título | Estado | Jira | RQ |\n|--|--|--|--|--|\n| S9 | x | cerrada | SO-9 | — |', 'Historia');
  assert.equal(storyClosed(local[0]), true);
});

test('decision-log: columnas por nombre y dudas abiertas', () => {
  const rows = parseTable(read('decision-log.md'), 'Duda');
  assert.equal(rows.length, 4);
  assert.equal(DUDA.id(rows[0]), '1');
  assert.equal(DUDA.state(rows[1]), 'aplicada-al-PRD');
  assert.equal(DUDA.answer(rows[1]), 'Sí, solo Admin');
  assert.equal(DUDA.date(rows[1]), '2026-09-10');
  assert.equal(rows.filter(dudaOpen).length, 1);
});

test('jira: key y host', () => {
  assert.equal(jiraKey('[SO-12](https://x/browse/SO-12)'), 'SO-12');
  assert.equal(jiraKey('—'), '');
  assert.equal(jiraBaseOf({}), 'https://olelife.atlassian.net');
  assert.equal(jiraBaseOf({ jira_base: 'https://otro.atlassian.net/' }), 'https://otro.atlassian.net');
  assert.equal(jiraBaseOf({}, 'https://x.y/'), 'https://x.y');
});

test('resolveIntake: el slug deja de ser un requisito de memoria', () => {
  const C = [
    { slug: 'modulo-poliza-petra', title: 'Módulo Póliza — Portal Asesores', status: 'draft', epics: ['SO-912'] },
    { slug: 'modulo-poliza-mx', title: 'Módulo Póliza — Adaptación a México', status: 'draft', epics: [] },
    { slug: 'cobranzas-petra', title: 'Módulo Cobranzas', status: 'in-delivery', epics: [] },
  ];
  assert.equal(resolveIntake(C, 'modulo-poliza-petra').match.slug, 'modulo-poliza-petra');
  assert.equal(resolveIntake(C, 'cobranzas').match.slug, 'cobranzas-petra', 'prefijo');
  assert.equal(resolveIntake(C, 'SO-912').match.slug, 'modulo-poliza-petra', 'clave de la épica');
  assert.equal(resolveIntake(C, 'so-912').match.slug, 'modulo-poliza-petra', 'la clave no distingue mayúsculas');
  assert.equal(resolveIntake(C, 'el modulo de poliza de petra').match.slug, 'modulo-poliza-petra', 'palabras sueltas');
  assert.equal(resolveIntake(C, 'Módulo Cobranzas').match.slug, 'cobranzas-petra', 'acentos y espacios');

  const amb = resolveIntake(C, 'poliza');
  assert.equal(amb.match, null, 'no adivina entre dos pólizas');
  assert.deepEqual(amb.ambiguous.map(c => c.slug), ['modulo-poliza-petra', 'modulo-poliza-mx']);

  assert.equal(resolveIntake(C, '', { last: 'modulo-poliza-mx' }).match.slug, 'modulo-poliza-mx', 'sin consulta, el último');
  assert.equal(resolveIntake(C, '').match.slug, 'cobranzas-petra', 'sin consulta ni memoria, el único activo');
  assert.equal(resolveIntake(C, 'contabilidad').match, null, 'lo que no existe no se fuerza');
  assert.equal(resolveIntake([], 'lo que sea').match, null, 'repo vacío');
});
