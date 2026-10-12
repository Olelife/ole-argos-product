#!/usr/bin/env node
// design-serve.mjs <intakes/<slug>/figma/<vN>> [--port 8765]
//
// Sirve una versión de diseño congelada por HTTP en 127.0.0.1 (los .dc.html no abren con file://) y recibe lo
// que el navegador extrae:
//   GET  /__extract.js                          → scripts/design-extract.js (inyectarlo en la página)
//   POST /__save?path=<sup>/specs/<pantalla>/raw-<estado>.json   body = JSON
// Solo escribe archivos `raw-*.json` bajo `<superficie>/specs/<pantalla>/`; nada más del intake.
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, dirname, extname, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = f => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const root = args[0] && !args[0].startsWith('--') ? resolve(args[0]) : null;
if (!root || !existsSync(root)) { console.error('uso: design-serve.mjs <intakes/<slug>/figma/<vN>> [--port 8765]'); process.exit(1); }
const port = Number(opt('--port') || 8765);

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.mjs': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff': 'font/woff', '.woff2': 'font/woff2', '.md': 'text/markdown; charset=utf-8' };
const SAVE_PATH = /^[^/\\]+\/specs\/[^/\\]+\/raw-[A-Za-z0-9._-]+\.json$/;
const MAX_BODY = 25 * 1024 * 1024;

const inside = p => { const r = relative(root, p); return r && !r.startsWith('..') && !r.split(sep).includes('..'); };
const send = (res, code, body, type = 'text/plain; charset=utf-8') => { res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' }); res.end(body); };

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${port}`);
  if (req.method === 'GET' && url.pathname === '/__extract.js') return send(res, 200, readFileSync(join(HERE, 'design-extract.js')), TYPES['.js']);
  if (req.method === 'POST' && url.pathname === '/__save') {
    const rel = url.searchParams.get('path') || '';
    const dest = resolve(root, rel);
    if (!SAVE_PATH.test(rel) || !inside(dest)) return send(res, 403, `solo raw-*.json bajo <superficie>/specs/<pantalla>/: ${rel}`);
    const chunks = []; let size = 0;
    req.on('data', c => { size += c.length; if (size > MAX_BODY) req.destroy(); else chunks.push(c); });
    req.on('end', () => {
      const body = Buffer.concat(chunks).toString('utf8');
      try { JSON.parse(body); } catch { return send(res, 400, 'el cuerpo no es JSON'); }
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, body.endsWith('\n') ? body : `${body}\n`);
      send(res, 200, `ok ${rel}`);
    });
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'método no permitido');
  let p;
  try { p = resolve(root, `.${decodeURIComponent(url.pathname)}`); } catch { return send(res, 400, 'ruta inválida'); }
  if (p !== root && !inside(p)) return send(res, 403, 'fuera de la versión');
  if (existsSync(p) && statSync(p).isDirectory()) {
    const items = readdirSync(p).map(n => `<li><a href="${encodeURI(`${url.pathname.replace(/\/$/, '')}/${n}`)}">${n}</a></li>`).join('');
    return send(res, 200, `<!doctype html><meta charset="utf-8"><ul>${items}</ul>`, TYPES['.html']);
  }
  if (!existsSync(p)) return send(res, 404, 'no existe');
  send(res, 200, readFileSync(p), TYPES[extname(p).toLowerCase()] || 'application/octet-stream');
});

server.listen(port, '127.0.0.1', () => {
  const pages = [];
  for (const sup of readdirSync(root, { withFileTypes: true }).filter(d => d.isDirectory())) {
    const src = join(root, sup.name, 'source');
    if (existsSync(src)) for (const f of readdirSync(src).filter(n => /\.html$/i.test(n))) pages.push(`http://127.0.0.1:${port}/${encodeURI(`${sup.name}/source/${f}`)}`);
  }
  console.log(`🗿 sirviendo ${root} en http://127.0.0.1:${port}`);
  for (const u of pages) console.log(`  ${u}`);
  console.log('  inyectar: eval(await (await fetch("/__extract.js")).text())');
});
