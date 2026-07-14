#!/usr/bin/env node
// figma-freeze.mjs <outDir> <captura.json>
// Congela un snapshot del Figma: descarga los PNG (URLs efímeras del MCP) y arma MANIFEST + structure.json.
// El JSON de captura lo genera el agente llamando al MCP de Figma:
//   { fileKey, url, capturedAt, scope, frames: [ { nodeId, name, w, h, imageUrl } ] }
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const [, , outDir, capturePath] = process.argv;
if (!outDir || !capturePath) { console.error('uso: figma-freeze.mjs <outDir> <captura.json>'); process.exit(1); }

const cap = JSON.parse(readFileSync(capturePath, 'utf8'));
mkdirSync(join(outDir, 'frames'), { recursive: true });

const slug = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);

const structure = [], rows = [];
let ok = 0, fail = 0;
for (const f of cap.frames) {
  const file = `${slug(f.name || f.nodeId)}-${String(f.nodeId).replace(/:/g, '-')}.png`;
  structure.push({ nodeId: f.nodeId, name: f.name, w: f.w, h: f.h, file });
  rows.push(`| ${f.name || ''} | ${f.nodeId} | ${f.w || ''}x${f.h || ''} | frames/${file} |`);
  if (!f.imageUrl) { fail++; continue; }
  try {
    const res = await fetch(f.imageUrl);
    if (!res.ok) { console.error(`  ! ${f.nodeId}: HTTP ${res.status}`); fail++; continue; }
    writeFileSync(join(outDir, 'frames', file), Buffer.from(await res.arrayBuffer()));
    ok++;
  } catch (e) { console.error(`  ! ${f.nodeId}: ${e.message}`); fail++; }
}

writeFileSync(join(outDir, 'structure.json'),
  JSON.stringify({ fileKey: cap.fileKey, url: cap.url, capturedAt: cap.capturedAt, scope: cap.scope || 'completo', frames: structure }, null, 2));

writeFileSync(join(outDir, 'MANIFEST.md'),
  `# Figma snapshot\n\n- **fileKey:** \`${cap.fileKey}\`\n- **URL:** ${cap.url}\n- **Capturado:** ${cap.capturedAt} (Argos)\n- **Alcance:** ${cap.scope || 'completo'}\n- **Frames:** ${cap.frames.length}\n\n| Frame | node-id | Tamaño | Archivo |\n|-------|---------|--------|---------|\n${rows.join('\n')}\n`);

console.log(`✓ figma ${outDir}: ${ok} descargados, ${fail} sin imagen, ${cap.frames.length} en structure.json`);
