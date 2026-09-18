#!/usr/bin/env node
// confluence-body.mjs <PRD.md|intakeDir> [--title]  → stdout: el cuerpo listo para createConfluencePage / updateConfluencePage
//
// El PRD se publica en Confluence como copia regenerable (la fuente es el markdown del intake). Este script
// prepara el cuerpo: quita el frontmatter, antepone la nota de procedencia (versión · intake · "no editar acá"),
// vuelve absolutos los links relativos al repo de datos y saca los comentarios <!-- --> de guía. El agente pasa
// el resultado al MCP de Atlassian con contentFormat markdown y guarda el page id en STATUS (`confluence_page_id`).
import { existsSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
import { readMaybe, parseFrontmatter } from './lib/md.mjs';

process.stdout.on('error', e => { if (e.code === 'EPIPE') process.exit(0); throw e; });
const args = process.argv.slice(2);
let target = args[0];
if (!target) { console.error('uso: confluence-body.mjs <PRD.md|intakeDir> [--title]'); process.exit(1); }
let dir = null;
if (existsSync(target) && statSync(target).isDirectory()) { dir = target; const fm = parseFrontmatter(readMaybe(join(dir, 'STATUS.md'))); target = join(dir, `PRD-${fm.slug || basename(dir)}.md`); }
const md = readMaybe(target);
if (!md) { console.error(`✗ no existe ${target}`); process.exit(1); }
const fm = parseFrontmatter(md);
const status = dir ? parseFrontmatter(readMaybe(join(dir, 'STATUS.md'))) : {};
const repoUrl = process.env.OLE_DATA_REPO_URL || 'https://github.com/Olelife/ole-argos-product-data/blob/main';
const slug = status.slug || fm.slug || (dir ? basename(dir) : '');
const title = `${fm.title || basename(target, '.md')}${status.prd_version || fm.version ? ` · PRD ${status.prd_version || fm.version}` : ''}`;
if (args.includes('--title')) { console.log(title); process.exit(0); }

let body = md.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');
body = body.replace(/<!--[\s\S]*?-->\n?/g, '');
if (slug) body = body.replace(/\]\((?!https?:|#|mailto:)([^)]+)\)/g, (_, rel) => `](${repoUrl}/intakes/${slug}/${rel.replace(/^\.\//, '')})`);
const src = slug ? `${repoUrl}/intakes/${slug}/${basename(target)}` : basename(target);
const note = [
  `> **Documento publicado desde el intake \`${slug || basename(target)}\`** · PRD **${status.prd_version || fm.version || fm.status || '—'}** · estado **${fm.status || status.status || '—'}** · actualizado ${status.updated || fm.date || '—'}.`,
  `> La fuente de verdad es el markdown del repo de datos ([ver fuente](${src})). **No editar esta página**: los comentarios se aplican al markdown y la página se vuelve a publicar con la versión siguiente.`,
  '',
].join('\n');
process.stdout.write(note + body.trimStart());
