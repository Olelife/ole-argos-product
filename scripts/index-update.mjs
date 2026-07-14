#!/usr/bin/env node
// index-update.mjs [dataRepo]  → regenera <dataRepo>/INDEX.md escaneando intakes/*/STATUS.md
import { readdirSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readMaybe, parseFrontmatter, parseTable } from './lib/md.mjs';

const data = process.argv[2] || join(process.env.OLE_REPOS || join(process.cwd(), 'repos'), 'ole-argos-product-data');
const intakesDir = join(data, 'intakes');
if (!existsSync(intakesDir)) { console.error(`✗ no existe ${intakesDir}`); process.exit(1); }

const dirs = readdirSync(intakesDir, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name).sort();
const countBy = (rows, idx, val) => rows.filter(r => (r[idx] || '').toLowerCase() === val).length;

const rows = dirs.map(slug => {
  const p = join(intakesDir, slug);
  const fm = parseFrontmatter(readMaybe(join(p, 'STATUS.md')));
  const dudas = parseTable(readMaybe(join(p, 'decision-log.md')), 'Duda');
  const stories = parseTable(readMaybe(join(p, 'stories.md')), 'Historia');
  const open = countBy(dudas, 3, 'abierta');
  const closed = countBy(stories, 2, 'cerrada');
  return `| [${slug}](intakes/${slug}/) | ${fm.status || '—'} | ${fm.prd_version || '—'} | ${fm.figma_version || '—'} | ${open} / ${dudas.length} | ${closed} / ${stories.length} | ${fm.updated || '—'} |`;
});

const body = `# Índice de intakes 🗿

Tablero de todos los intakes de producto y su estado. Lo regenera el motor \`argos-product\` (index-update.mjs).

| Intake | Estado | PRD | Figma | Dudas abiertas | Historias | Actualizado |
|--------|--------|-----|-------|----------------|-----------|-------------|
${rows.join('\n') || '| _(sin intakes todavía)_ | — | — | — | — | — | — |'}

**Estados del intake:** \`draft\` → \`in-review\` → \`ready\` → \`in-delivery\` → \`done\`.
`;

writeFileSync(join(data, 'INDEX.md'), body);
console.log(`✓ INDEX.md regenerado (${dirs.length} intake/s)`);
