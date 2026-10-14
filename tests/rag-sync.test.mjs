// rag-sync.mjs: el sha y la fecha de cada archivo del manifiesto. Correr: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync, execFileSync } from 'node:child_process';

const script = join(dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'rag-sync.mjs');

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
