#!/usr/bin/env node
// index-update.mjs [dataRepo]  → regenera <dataRepo>/INDEX.md escaneando intakes/*/STATUS.md
import { readdirSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readMaybe, parseFrontmatter, parseTable, storyClosed, dudaOpen } from './lib/md.mjs';

const data = process.argv[2] || join(process.env.OLE_REPOS || join(process.cwd(), 'repos'), 'ole-argos-product-data');
const intakesDir = join(data, 'intakes');
if (!existsSync(intakesDir)) { console.error(`✗ no existe ${intakesDir}`); process.exit(1); }

const dirs = readdirSync(intakesDir, { withFileTypes: true })
  .filter(d => d.isDirectory() && !d.name.startsWith('_')).map(d => d.name).sort();

const rows = dirs.map(slug => {
  const p = join(intakesDir, slug);
  const fm = parseFrontmatter(readMaybe(join(p, 'STATUS.md')));
  const dudas = parseTable(readMaybe(join(p, 'decision-log.md')), 'Duda');
  const stories = parseTable(readMaybe(join(p, 'stories.md')), 'Historia');
  const open = dudas.filter(dudaOpen).length;
  const closed = stories.filter(r => storyClosed(r, fm.jira_goal_status)).length;
  return `| [${slug}](intakes/${slug}/) | ${fm.status || '—'} | ${fm.prd_version || '—'} | ${fm.figma_version || '—'} | ${open} / ${dudas.length} | ${closed} / ${stories.length} | ${fm.updated || '—'} |`;
});

const body = `# Índice de intakes 🗿

Tablero de todos los intakes de producto y su estado. Lo regenera el motor \`argos-product\` (index-update.mjs).

| Intake | Estado | PRD | Figma | Dudas abiertas | Historias cerradas | Actualizado |
|--------|--------|-----|-------|----------------|--------------------|-------------|
${rows.join('\n') || '| _(sin intakes todavía)_ | — | — | — | — | — | — |'}

**Estados del intake:** \`draft\` → \`in-review\` → \`ready\` → \`in-delivery\` → \`done\`.
`;

writeFileSync(join(data, 'INDEX.md'), body);
console.log(`✓ INDEX.md regenerado (${dirs.length} intake/s)`);
