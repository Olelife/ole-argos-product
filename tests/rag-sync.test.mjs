// Tests de scripts/rag-sync.mjs: clasificación por capa (RFC-mini «layer como
// metadata nativa de Bedrock») y el sidecar de metadata filtrable. Correr: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  layerFor, metadataSidecarFor, buildManifest, VALID_LAYERS, DOCTYPE_LAYER,
} from '../scripts/rag-sync.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const dataRepo = join(here, 'fixtures', 'data-repo');

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
