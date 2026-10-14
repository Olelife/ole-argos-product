// Tests de scripts/rag-sync.mjs: el sha/fecha de cada archivo del manifiesto (una pasada de
// git log) y la clasificación por capa (RFC-mini «layer como metadata nativa de Bedrock») +
// el sidecar de metadata filtrable. Correr: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync, execFileSync } from 'node:child_process';
import {
  layerFor, metadataSidecarFor, buildManifest, VALID_LAYERS, DOCTYPE_LAYER,
} from '../scripts/rag-sync.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const script = join(here, '..', 'scripts', 'rag-sync.mjs');
const dataRepo = join(here, 'fixtures', 'data-repo');

function repo() {
  const dir = mkdtempSync(join(tmpdir(), 'rag-sync-'));
  const git = (cmd) => execSync(`git ${cmd}`, { cwd: dir, env: { ...process.env, GIT_AUTHOR_DATE: '2026-01-01T00:00:00Z', GIT_COMMITTER_DATE: '2026-01-01T00:00:00Z' } }).toString().trim();
  const escribir = (rel, texto) => { mkdirSync(dirname(join(dir, rel)), { recursive: true }); writeFileSync(join(dir, rel), texto); };
  git('init -q -b main');
  git('config user.email test@test');
  git('config user.name test');
  return { dir, git, escribir };
}

test('el sha de cada archivo es el de `git log -1 -- <archivo>`, merges y archivos con acento incluidos', () => {
  const { dir, git, escribir } = repo();
  escribir('domain/polizas.md', '# Pólizas\n');
  escribir('domain/cotización.md', '# Cotización\n');
  git('add -A'); git('commit -q -m base');

  // Una rama agrega un archivo que solo llega a main por el merge, y las dos tocan el mismo archivo:
  // el merge lo resuelve a mano, así que difiere de los dos padres y es su último commit.
  git('checkout -q -b rama');
  escribir('archive/RQ-1/spec.md', '# RQ-1\n');
  escribir('domain/polizas.md', '# Pólizas\nrama\n');
  git('add -A'); git('commit -q -m rama');
  git('checkout -q main');
  escribir('domain/polizas.md', '# Pólizas\nmain\n');
  git('add -A'); git('commit -q -m main');
  try { git('merge -q rama -m merge'); } catch { /* conflicto esperado */ }
  escribir('domain/polizas.md', '# Pólizas\nresuelto\n');
  git('add -A'); git('commit -q --no-edit');
  escribir('findings/nuevo.md', '# nuevo\n');
  git('add -A'); git('commit -q -m nuevo');

  const manifiesto = JSON.parse(execFileSync('node', [script, dir, '--dry-run']).toString());
  const archivos = manifiesto.kept.map((k) => k.file).sort();
  assert.deepEqual(archivos, ['archive/RQ-1/spec.md', 'domain/cotización.md', 'domain/polizas.md', 'findings/nuevo.md']);
  for (const k of manifiesto.kept) {
    const esperado = execFileSync('git', ['log', '-1', '--format=%H', '--', k.file], { cwd: dir }).toString().trim().slice(0, 12);
    assert.equal(k.sha, esperado, k.file);
    assert.equal(k.lastUpdated, '2026-01-01', k.file);
  }
});

test('layerFor: default por docType (prd → functional, decision-log → traceability)', () => {
  assert.equal(layerFor('prd', {}), 'functional');
  assert.equal(layerFor('stories', {}), 'functional');
  assert.equal(layerFor('decision-log', {}), 'traceability');
  assert.equal(layerFor('jira-preview', {}), 'traceability');
  assert.equal(layerFor('status', {}), 'traceability');
  assert.equal(layerFor('standard', {}), 'technical');
  assert.equal(layerFor('finding', {}), 'traceability');
  assert.equal(layerFor('rq-spec', {}), 'technical');
});

test('layerFor: docType sin default (analysis) cae al default seguro functional', () => {
  assert.equal(layerFor('analysis', {}), 'functional');
  assert.equal(layerFor('analysis-mermaid', {}), 'functional');
});

test('layerFor: frontmatter layer: explícito manda sobre el default del docType', () => {
  assert.equal(layerFor('analysis', { layer: 'technical' }), 'technical');
  assert.equal(layerFor('analysis', { layer: 'traceability' }), 'traceability');
  assert.equal(layerFor('prd', { layer: 'technical' }), 'technical');
});

test('layerFor: valor de frontmatter inválido se ignora (no rompe, cae al default)', () => {
  assert.equal(layerFor('prd', { layer: 'algo-que-no-existe' }), 'functional');
  assert.equal(layerFor('analysis', { layer: '' }), 'functional');
});

test('layerFor: no es case-sensitive en el frontmatter', () => {
  assert.equal(layerFor('analysis', { layer: 'Technical' }), 'technical');
  assert.equal(layerFor('analysis', { layer: 'TRACEABILITY' }), 'traceability');
});

test('DOCTYPE_LAYER: todo valor de la tabla es una capa válida', () => {
  for (const [docType, layer] of Object.entries(DOCTYPE_LAYER)) {
    assert.ok(VALID_LAYERS.has(layer), `${docType} → ${layer} no es una capa válida`);
  }
});

test('metadataSidecarFor: shape metadataAttributes que Bedrock indexa como filtrable', () => {
  const sidecar = metadataSidecarFor({ layer: 'functional', docType: 'prd', capability: 'auth-identity' });
  assert.deepEqual(sidecar, {
    metadataAttributes: {
      layer: { value: { type: 'STRING', stringValue: 'functional' }, includeForEmbedding: false },
      docType: { value: { type: 'STRING', stringValue: 'prd' }, includeForEmbedding: false },
      capability: { value: { type: 'STRING', stringValue: 'auth-identity' }, includeForEmbedding: false },
    },
  });
});

test('metadataSidecarFor: descarta null/undefined/vacío, no genera atributos basura', () => {
  const sidecar = metadataSidecarFor({ layer: 'functional', slug: null, version: undefined, status: '' });
  assert.deepEqual(Object.keys(sidecar.metadataAttributes), ['layer']);
});

test('buildManifest: cada archivo mantenido lleva metadata.layer (fixture data-repo)', async () => {
  const { kept } = await buildManifest(dataRepo);
  assert.ok(kept.length > 0, 'el fixture debería aportar al menos un archivo');
  for (const it of kept) {
    assert.ok(VALID_LAYERS.has(it.metadata.layer), `${it.file} → layer inválido: ${it.metadata.layer}`);
  }
  const byFile = Object.fromEntries(kept.map(k => [k.file, k.metadata]));
  assert.equal(byFile['intakes/sample-intake/PRD-sample-intake.md']?.layer, 'functional');
  assert.equal(byFile['intakes/sample-intake/decision-log.md']?.layer, 'traceability');
  assert.equal(byFile['intakes/sample-intake/jira-preview.md']?.layer, 'traceability');
  assert.equal(byFile['intakes/sample-intake/stories.md']?.layer, 'functional');
});
