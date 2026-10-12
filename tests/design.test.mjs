// Tests del verbo `specs`: congelar el export de Claude Design, construir el spec, el a-validar y los enlaces.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readZip, writeZip } from '../scripts/lib/zip.mjs';
import { findTable, upsertRow, checkNotas, specLayout } from '../scripts/lib/design.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PROJECT = join(ROOT, 'tests/fixtures/design/project');
const run = (script, ...args) => spawnSync(process.execPath, [join(ROOT, 'scripts', script), ...args], { encoding: 'utf8' });

function walk(dir) {
  return readdirSync(dir).flatMap(n => statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]);
}
function projectZip(tmp, extra = []) {
  const files = walk(PROJECT).map(p => ({ name: relative(PROJECT, p).split('\\').join('/'), data: readFileSync(p) }));
  const zip = join(tmp, 'Proyecto de prueba.zip');
  writeFileSync(zip, writeZip([...files, ...extra]));
  return zip;
}
function intake() {
  const tmp = mkdtempSync(join(tmpdir(), 'design-'));
  cpSync(join(ROOT, 'tests/fixtures/data-repo/intakes/sample-intake'), join(tmp, 'intakes/sample-intake'), { recursive: true });
  return { tmp, dir: join(tmp, 'intakes/sample-intake') };
}

const TOKENS = {
  '--n-900': '#18252C', '--text-strong': '#18252C', '--t-400': '#30AAC0', '--surface': '#FFFFFF', '--border-subtle': '#B5C9D4',
  '--font-sans': '"Plus Jakarta Sans", -apple-system, sans-serif', '--text-heading': '22px', '--text-base': '13px', '--text-caption': '11px',
  '--radius-sm': '4px', '--radius-lg': '8px', '--radius-full': '9999px',
  '--shadow-card': '0 1px 2px rgba(24,37,44,.04),0 1px 3px rgba(24,37,44,.06)',
};
const raw = (label, nodes) => ({ label, url: 'http://127.0.0.1:8765/backoffice/source/Pantalla%20v2.dc.html', viewport: [1440, 900], pageH: 900, sideX: 70, sideBy: '<nav>', tokens: TOKENS, nodes });
const RAW_LIST = raw('listado', [
  { i: 0, tag: 'h1', text: 'Listado', x: 100, y: 20, w: 200, h: 28, font: 'Plus Jakarta Sans|22px|600|26px|none|normal', color: '#18252C' },
  { i: 1, tag: 'div', x: 100, y: 60, w: 600, h: 300, bg: '#FFFFFF', radius: '8px', shadow: 'rgba(24, 37, 44, 0.04) 0px 1px 2px 0px, rgba(24, 37, 44, 0.06) 0px 1px 3px 0px', pad: '16px' },
  { i: 2, tag: 'span', text: 'Activo', x: 120, y: 80, w: 50, h: 18, font: 'Plus Jakarta Sans|12px|500|16px|none|normal', color: '#30AAC0', bg: '#30AAC0@0.1', radius: '50%', border: '1px #B5C9D4', pad: '2px 8px' },
  { i: 3, tag: 'p', text: 'Pie en otra fuente', x: 100, y: 400, w: 200, h: 16, font: 'Arial|13px|400|16px|none|normal', color: '#123456' },
]);
const RAW_MODAL = raw('modal-borrar', [
  { i: 0, tag: 'h1', text: 'Listado', x: 100, y: 20, w: 200, h: 28, font: 'Plus Jakarta Sans|22px|600|26px|none|normal', color: '#18252C' },
  { i: 1, tag: 'div', text: '¿Borrar el registro?', x: 500, y: 300, w: 400, h: 120, font: 'Plus Jakarta Sans|13px|400|18px|none|normal', color: '#18252C', bg: '#FFFFFF', radius: '14px', shadow: 'rgba(1, 31, 48, 0.3) 0px 12px 40px 0px' },
]);
const NOTAS = `| # | Qué muestra el diseño | PRD / decisión | Para Diseño |
|---|---|---|---|
| 1 | Listado con chip "Activo" | S1 | Coincide |
| 2 | Modal "¿Borrar el registro?" | El PRD no lo menciona | Confirmar si entra |
`;

test('zip: lee lo que escribe, con nombres UTF-8, y rechaza zip-slip', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'zip-'));
  const z = join(tmp, 'a.zip');
  writeFileSync(z, writeZip([{ name: 'Roles y Permisos.dc.html', data: '<p>ñ</p>' }, { name: '_ds/x/tokens/c.css', data: ':root{}' }]));
  const e = readZip(z);
  assert.deepEqual(e.map(x => x.name), ['Roles y Permisos.dc.html', '_ds/x/tokens/c.css']);
  assert.equal(e[0].data().toString('utf8'), '<p>ñ</p>');
  writeFileSync(z, writeZip([{ name: '../escape.txt', data: 'x' }]));
  assert.throws(() => readZip(z), /insegura/);
  rmSync(tmp, { recursive: true, force: true });
});

test('design-freeze: guarda solo lo vigente, resuelve dc-import y escribe el MANIFEST', () => {
  const { tmp, dir } = intake();
  const zip = projectZip(tmp);
  const sup = join(dir, 'figma/v2/backoffice');
  const r = run('design-freeze.mjs', zip, sup, '--project-url', 'https://claude.ai/design/p/abc?file=Pantalla%20v2.dc.html', '--date', '2026-10-12');
  assert.equal(r.status, 0, r.stderr);
  const src = join(sup, 'source');
  const kept = walk(src).map(p => relative(src, p)).sort();
  assert.deepEqual(kept, ['Chip.dc.html', 'Pantalla v2.dc.html', 'Tip.dc.html', '_ds/demo-ds/readme.md', '_ds/demo-ds/tokens/colors.css', '_ds/demo-ds/tokens/spacing.css', '_ds/demo-ds/tokens/typography.css', 'assets/logo.png', 'support.js', 'uploads/ref.png']);
  assert.match(r.stdout, /versiones anteriores \(Pantalla v1\.dc\.html\)/);
  assert.match(r.stdout, /otros archivos del proyecto \(Otra\.dc\.html\)/);
  assert.match(r.stdout, /correos de @olelife\.com/);
  const m = readFileSync(join(dir, 'figma/v2/MANIFEST.md'), 'utf8');
  assert.match(m, /^# Diseño v2 · código fuente congelado/m);
  assert.match(m, /\*\*Captura:\*\* 2026-10-12/);
  assert.match(m, /\| `backoffice\/source\/` \| \[Proyecto de prueba\]\(https:\/\/claude\.ai\/design\/p\/abc\?file=Pantalla%20v2\.dc\.html\) \| `Pantalla v2\.dc\.html` \+ componentes `Chip`, `Tip` \| `[0-9a-f]{16}` \|/);
  assert.match(m, /- \*\*`backoffice\/source\/`\*\* — se guardó: .*Revisión de seguridad: sin credenciales ni tokens/);
  const again = run('design-freeze.mjs', zip, sup, '--entry', 'Pantalla v2.dc.html', '--date', '2026-10-12');
  assert.equal(again.status, 1, 'una versión congelada no se pisa');
  rmSync(tmp, { recursive: true, force: true });
});

test('design-freeze: sin --entry lista candidatos; una credencial frena todo hasta el OK', () => {
  const { tmp, dir } = intake();
  const fake = `const cfg = { key: "${'AKIA'}${'Q'.repeat(16)}" };`;
  const zip = projectZip(tmp);
  const noEntry = run('design-freeze.mjs', zip, join(dir, 'figma/v2/backoffice'), '--date', '2026-10-12');
  assert.equal(noEntry.status, 2);
  assert.match(noEntry.stderr, /Pantalla v2\.dc\.html/);
  const files = walk(PROJECT).map(p => ({ name: relative(PROJECT, p), data: relative(PROJECT, p) === 'support.js' ? fake : readFileSync(p) }));
  const bad = join(tmp, 'con-clave.zip');
  writeFileSync(bad, writeZip(files));
  const sup = join(dir, 'figma/v3/backoffice');
  const r = run('design-freeze.mjs', bad, sup, '--entry', 'Pantalla v2.dc.html', '--date', '2026-10-12');
  assert.equal(r.status, 3);
  assert.match(r.stdout, /clave de AWS: support\.js:1 AKIA…\(20 car\.\)/);
  assert.equal(existsSync(join(sup, 'source')), false, 'no congela nada');
  const ok = run('design-freeze.mjs', bad, sup, '--entry', 'Pantalla v2.dc.html', '--date', '2026-10-12', '--accept-findings');
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(readFileSync(join(dir, 'figma/v3/MANIFEST.md'), 'utf8'), /1 posible\(s\) credencial\(es\) revisada\(s\) y aceptada\(s\) por el PM/);
  rmSync(tmp, { recursive: true, force: true });
});

function specFixture() {
  const { tmp, dir } = intake();
  run('design-freeze.mjs', projectZip(tmp), join(dir, 'figma/v2/backoffice'), '--entry', 'Pantalla v2.dc.html', '--date', '2026-10-12');
  const p = join(dir, 'figma/v2/backoffice/specs/p1-listado');
  mkdirSync(p, { recursive: true });
  writeFileSync(join(p, 'raw-listado.json'), JSON.stringify(RAW_LIST));
  writeFileSync(join(p, 'raw-modal-borrar.json'), JSON.stringify(RAW_MODAL));
  return { tmp, dir, p };
}

test('design-spec: valor → token con el sistema congelado, escalas y fuente desde sus tokens', () => {
  const { tmp, p } = specFixture();
  const r = run('design-spec.mjs', p);
  assert.equal(r.status, 0, r.stderr);
  const spec = JSON.parse(readFileSync(join(p, 'spec.json'), 'utf8'));
  assert.equal(spec.source, 'Pantalla v2.dc.html');
  assert.equal(spec.designSystem, 'Demo — Portal de Prueba (figma/v2/backoffice/source/_ds/demo-ds/tokens)');
  assert.deepEqual(spec.states.map(s => s.state), ['listado', 'modal-borrar']);
  const [h1, card, chip, pie] = spec.states[0].elements;
  assert.deepEqual(h1.color, { value: '#18252C', token: 'var(--n-900)', aliases: ['--text-strong'] });
  assert.equal(h1.font.sizeToken, 'var(--text-heading)');
  assert.equal(card.shadow.token, 'var(--shadow-card)', 'la sombra computada (rgba, px) matchea el token');
  assert.equal(card.radius.token, 'var(--radius-lg)');
  assert.equal(chip.background.token, 'var(--t-400) @0.1');
  assert.equal(chip.radius.token, 'var(--radius-full)');
  assert.equal(chip.border.color.token, 'var(--border-subtle)');
  assert.equal(pie.color.token, null);
  const copy = readFileSync(join(p, 'copy.md'), 'utf8');
  assert.match(copy, /## listado\n\n- `22px\/600` Listado\n- `12px\/500` Activo\n- `13px\/400` Pie en otra fuente/);
  assert.match(copy, /## modal-borrar\n\n- `13px\/400` ¿Borrar el registro\?\n$/, 'el segundo estado solo trae textos nuevos');
  const f = JSON.parse(readFileSync(join(p, 'token-findings.json'), 'utf8'));
  const tipos = Object.fromEntries(f.map(x => [`${x.tipo}|${x.valor}`, x]));
  assert.ok(tipos['Tamaño de letra fuera de la escala|12px']);
  assert.equal(tipos['Tamaño de letra fuera de la escala|12px'].escala, 'Escala: 22 · 13 · 11 px');
  assert.ok(tipos['Fuente distinta|Arial'], 'la familia esperada sale de --font-sans');
  assert.ok(tipos['Color de texto sin token|#123456']);
  assert.equal(tipos['Radio fuera de la escala|14px'].escala, 'Escala: 4 · 8 · 9999 (pill) px');
  assert.match(tipos['Sombra sin token|rgba(1, 31, 48, 0.3) 0px 12px 40px 0px'].escala, /`--shadow-card`/);
  assert.equal(run('design-spec.mjs', p, '--system', 'Portal de Agentes').status, 0);
  assert.match(JSON.parse(readFileSync(join(p, 'spec.json'), 'utf8')).designSystem, /^Portal de Agentes \(/);
  rmSync(tmp, { recursive: true, force: true });
});

test('design-avalidar: §1 de notas.md, §2 de los hallazgos, datos del MANIFEST y no pisa lo manual', () => {
  const { tmp, dir, p } = specFixture();
  run('design-spec.mjs', p);
  const sinNotas = run('design-avalidar.mjs', p);
  assert.match(sinNotas.stdout, /falta notas\.md/);
  writeFileSync(join(p, 'notas.md'), NOTAS);
  const man = join(dir, 'figma/v2/MANIFEST.md');
  writeFileSync(man, upsertRow(readFileSync(man, 'utf8'), ['Carpeta', 'Pantalla', 'Historias', 'Estados extraídos'], 'Carpeta', { Carpeta: '`backoffice/specs/p1-listado/`', Pantalla: 'P1 · Listado', Historias: 'S1 (SO-101), S3' }));
  const r = run('design-avalidar.mjs', p, '--system-duda', '1');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /2 fila\(s\) de notas, 1 para Diseño/);
  const a = readFileSync(join(p, 'a-validar.md'), 'utf8');
  assert.match(a, /^<!-- auto -->\n# P1 · Listado — a validar con Diseño/);
  assert.match(a, /S1 \(SO-101\), S3\. Fuente: `Pantalla v2\.dc\.html` \(export del 2026-10-12, 1440 px\)\. Estados: \*listado\*; \*modal-borrar\*\./);
  assert.match(a, /Sistema de diseño de referencia: \*\*Demo — Portal de Prueba\*\*, el del prototipo \(#1, abierta/);
  assert.match(a, /## 1\. Textos y comportamiento vs PRD y decisiones\n\n\| # \| Qué muestra el diseño/);
  assert.match(a, /\*\*Radio fuera de la escala\.\*\* Escala: 4 · 8 · 9999 \(pill\) px\n\n\| Valor \| Usos \| Ejemplos \|\n\|---\|---\|---\|\n\| `14px` \| 1 \|/);
  writeFileSync(join(p, 'a-validar.md'), '# a mano\n');
  assert.match(run('design-avalidar.mjs', p).stdout, /skip \(escrito a mano\)/);
  assert.equal(readFileSync(join(p, 'a-validar.md'), 'utf8'), '# a mano\n');
  rmSync(tmp, { recursive: true, force: true });
});

test('design-link: PRD, stories y jira-preview enlazados, idempotente; lint y siguiente lo ven', () => {
  const { tmp, dir, p } = specFixture();
  run('design-spec.mjs', p);
  writeFileSync(join(p, 'notas.md'), NOTAS);
  run('design-avalidar.mjs', p);
  const first = run('design-link.mjs', dir, '--version', 'v2');
  assert.equal(first.status, 0, first.stderr);
  assert.match(first.stdout, /1 carpeta\(s\) nuevas en la tabla del MANIFEST: p1-listado/);
  assert.match(first.stdout, /1 pantalla\(s\) sin historia/);
  const ns = run('next-step.mjs', dir, '--date', '2026-10-12', '--all');
  assert.match(ns.stdout, /intake specs sample-intake\s+figma\/v2: 1 pantalla\(s\) sin historia enlazada/);
  const man = join(dir, 'figma/v2/MANIFEST.md');
  const t = findTable(readFileSync(man, 'utf8'), ['Carpeta', 'Pantalla', 'Historias']);
  assert.deepEqual(t.rows, [['`backoffice/specs/p1-listado/`', 'p1-listado', '—', 'listado, modal-borrar']]);
  writeFileSync(man, readFileSync(man, 'utf8').replace('| p1-listado | — |', '| P1 · Listado | S1 (SO-101), S3 |'));
  const r = run('design-link.mjs', dir, '--version', 'v2', '--system-duda', '1');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /S1 +p1-listado +→ prd, stories, preview · ya en Jira \(SO-101\)/);
  assert.match(r.stdout, /S3 +p1-listado +→ preview\n/);
  const spec = '(spec.json · copy.md · a-validar.md)';
  const prd = readFileSync(join(dir, 'PRD-sample-intake.md'), 'utf8');
  assert.ok(prd.includes(`**Especificación (v2):** figma/v2/backoffice/specs/p1-listado/ ${spec}.`));
  const stories = readFileSync(join(dir, 'stories.md'), 'utf8');
  assert.ok(stories.includes(`**Diseño:** [Listado](https://www.figma.com/design/FILEKEY/Archivo?node-id=10-20)\n- Spec v2: \`figma/v2/backoffice/specs/p1-listado/\` ${spec}`));
  const prev = readFileSync(join(dir, 'jira-preview.md'), 'utf8');
  const base = 'https://github.com/Olelife/ole-argos-product-data/blob/main/intakes/sample-intake/figma/v2/backoffice/specs/p1-listado';
  assert.ok(prev.includes(`  ## Diseño\n\n  - [Listado](https://www.figma.com/design/FILEKEY/Archivo?node-id=10-20)\n\n  **Especificación desde el código fuente del diseño (v2, sistema de diseño Demo — Portal de Prueba, #1):**\n\n  - [Valores por elemento con su token (spec.json)](${base}/spec.json)`), 'S3: dentro de su ## Diseño');
  assert.ok(/## S1 — \[SO-101\] Ver el listado[\s\S]*?  ## Diseño\n\n  \*\*Especificación desde el código fuente del diseño[\s\S]*?\n\n---\n\n## S3/.test(prev), 'S1: crea su ## Diseño antes del separador');
  const again = run('design-link.mjs', dir, '--version', 'v2', '--system-duda', '1');
  assert.match(again.stdout, /sin cambios \(ya estaba enlazado\)/);
  const lint = run('intake-lint.mjs', dir);
  assert.match(lint.stdout, /figma\/v2\/ código fuente de Claude Design \(backoffice\)/);
  assert.match(lint.stdout, /figma\/v2\/: 1 pantalla\(s\) con spec, todas con historia/);
  assert.doesNotMatch(run('next-step.mjs', dir, '--date', '2026-10-12', '--all').stdout, /intake specs/);
  rmSync(tmp, { recursive: true, force: true });
});

test('design-serve: sirve la versión, entrega el extractor y solo guarda raw-*.json bajo specs/', async () => {
  const { tmp, dir } = intake();
  run('design-freeze.mjs', projectZip(tmp), join(dir, 'figma/v2/backoffice'), '--entry', 'Pantalla v2.dc.html', '--date', '2026-10-12');
  const port = 18000 + Math.floor(Math.random() * 2000);
  const srv = spawn(process.execPath, [join(ROOT, 'scripts/design-serve.mjs'), join(dir, 'figma/v2'), '--port', String(port)]);
  try {
    await new Promise((res, rej) => { srv.stdout.once('data', res); srv.once('error', rej); setTimeout(() => rej(new Error('el servidor no arrancó')), 5000); });
    const url = p => `http://127.0.0.1:${port}${p}`;
    const page = await fetch(url('/backoffice/source/Pantalla%20v2.dc.html'));
    assert.equal(page.status, 200);
    assert.match(await page.text(), /dc-import name="Chip"/);
    assert.match(await (await fetch(url('/__extract.js'))).text(), /window\.__side = /);
    const ok = await fetch(url('/__save?path=backoffice/specs/p1-listado/raw-todos.json'), { method: 'POST', body: JSON.stringify(RAW_LIST) });
    assert.equal(ok.status, 200);
    assert.ok(existsSync(join(dir, 'figma/v2/backoffice/specs/p1-listado/raw-todos.json')));
    for (const bad of ['backoffice/specs/p1-listado/spec.json', '../../../STATUS.md', 'backoffice/source/raw-x.json']) {
      assert.equal((await fetch(url(`/__save?path=${encodeURIComponent(bad)}`), { method: 'POST', body: '{}' })).status, 403, bad);
    }
    assert.equal((await fetch(url('/__save?path=backoffice/specs/p1-listado/raw-x.json'), { method: 'POST', body: 'no es json' })).status, 400);
  } finally {
    srv.kill();
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('notas.md: la tabla fija se valida por encabezado; specLayout entiende la ruta estándar', () => {
  assert.equal(checkNotas(NOTAS).ok, true);
  assert.equal(checkNotas(NOTAS).accion.length, 1);
  assert.equal(checkNotas('| # | Texto | Estado |\n|---|---|---|\n| 1 | a | b |\n').ok, false);
  const l = specLayout(join('/r', 'intakes', 'x', 'figma', 'v4', 'asesores', 'specs', 's15-home'));
  assert.deepEqual([l.version, l.superficie, l.pantalla, l.intakeDir], ['v4', 'asesores', 's15-home', join('/r', 'intakes', 'x')]);
  assert.equal(specLayout('/r/intakes/x/figma/v4/asesores'), null);
});
