#!/usr/bin/env node
// rag-sync.mjs <repoRoot> [--to <s3://bucket/prefix>] [--dry-run] [--kb-id <id>]
//
// Recolecta los archivos de un repo (brain o product-data) que aportan al corpus
// del RAG de Bedrock — con metadata y filtro anti-secretos — y los sube a S3.
// Diseñado para correrse desde un GitHub Action on-push a main.
//
// Sin --to o con --dry-run: imprime el manifiesto (files + metadata) sin subir.
// Con --to s3://bucket/prefix: sube por AWS SDK v3, incremental por SHA.
// Con --kb-id <id>: dispara un ingestion-job de Bedrock KB al terminar.
//
// Reglas de qué se incluye/excluye viven en INCLUDE_PATTERNS/EXCLUDE_PATTERNS abajo.
//
// `layer` (RFC-mini «layer como metadata nativa de Bedrock», ole-argos-product-data
// /intakes/sistema-modulos-por-pais/RFC-mini-layer-metadata.md): cada archivo se
// clasifica en functional · technical · traceability según su docType (tabla
// DOCTYPE_LAYER), o por el frontmatter `layer:` explícito cuando el docType no
// alcanza (hoy solo `analysis`/`analysis-mermaid`, que pueden mezclar capas). Ese
// valor viaja como metadata de objeto S3 (informativo) Y como sidecar
// `<key>.metadata.json` (`metadataAttributes`, formato que Bedrock indexa como
// atributo filtrable) para que el consumidor (el bot) pueda pedir
// `retrievalConfiguration.managedSearchConfiguration.filter` por capa en vez de
// post-filtrar por regex sobre la ruta del S3 key.

import { existsSync, statSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative, extname, basename } from 'node:path';
import { execSync } from 'node:child_process';

// --- Reglas de inclusión ------------------------------------------------------
// Formato: array de { glob RE, docType, source, extractMeta? }
const INCLUDE = [
  // BRAIN
  { re: /^domain\/.*\.md$/,                     source: 'brain',   docType: 'domain' },
  { re: /^architecture\/services\/.*\.md$/,     source: 'brain',   docType: 'service' },
  { re: /^architecture\/flows\/.*\.md$/,        source: 'brain',   docType: 'flow' },
  { re: /^architecture\/[^/]+\.md$/,            source: 'brain',   docType: 'architecture' },
  { re: /^glossary\.md$/,                       source: 'brain',   docType: 'glossary' },
  { re: /^findings\/.*\.md$/,                   source: 'brain',   docType: 'finding' },
  { re: /^archive\/[^/]+\/spec\.md$/,           source: 'brain',   docType: 'rq-spec' },

  // PRODUCT
  { re: /^standards\/prd\.md$/,                 source: 'product', docType: 'standard' },
  { re: /^intakes\/[^/]+\/STATUS\.md$/,         source: 'product', docType: 'status' },
  { re: /^intakes\/[^/]+\/PRD-.*\.md$/,         source: 'product', docType: 'prd' },
  { re: /^intakes\/[^/]+\/decision-log\.md$/,   source: 'product', docType: 'decision-log' },
  { re: /^intakes\/[^/]+\/stories\.md$/,        source: 'product', docType: 'stories' },
  { re: /^intakes\/[^/]+\/jira-preview\.md$/,   source: 'product', docType: 'jira-preview' },
  { re: /^intakes\/[^/]+\/jira-updates\.md$/,   source: 'product', docType: 'jira-updates' },
  { re: /^intakes\/[^/]+\/updates\/.*\.md$/,     source: 'product', docType: 'status-update' },
  { re: /^intakes\/[^/]+\/changelog-prd\.md$/,  source: 'product', docType: 'prd-changelog' },
  { re: /^intakes\/[^/]+\/review\.md$/,         source: 'product', docType: 'prd-review' },
  { re: /^intakes\/[^/]+\/analysis\/.*\.md$/,   source: 'product', docType: 'analysis' },
  { re: /^intakes\/[^/]+\/analysis\/.*\.mmd$/,  source: 'product', docType: 'analysis-mermaid' },
  { re: /^intakes\/[^/]+\/figma\/v\d+\/MANIFEST\.md$/,     source: 'product', docType: 'figma-manifest' },
  { re: /^intakes\/[^/]+\/figma\/v\d+\/structure\.json$/,  source: 'product', docType: 'figma-structure' },
  // PDFs de insumo: se marcan pero requieren Textract del lado del pipeline
  { re: /^intakes\/[^/]+\/docx\/v\d+\/.*\.pdf$/, source: 'product', docType: 'insumo-pdf' },
];

// --- Reglas de exclusión (hard) -----------------------------------------------
const EXCLUDE = [
  /^\.git\//,
  /\/node_modules\//,
  /\.DS_Store$/,
  // Regenerables (presentación)
  /^intakes\/[^/]+\/(dashboard|roadmap-mvp|avance|INDEX-widget|tickets-widget)\.html$/,
  // Binarios de Figma / diagramas (sin multimodal)
  /^intakes\/[^/]+\/figma\/v\d+\/frames\/.*/,
  /^intakes\/[^/]+\/analysis\/.*\.png$/,
  // Drafts privados marcados explícitamente
  /(^|\/)(PRIVATE-|_draft-).*/,
];

// --- Capas (RFC-mini) ----------------------------------------------------------
// Default por docType. Lo que no está acá (hoy: analysis · analysis-mermaid ·
// figma-manifest · figma-structure · insumo-pdf) resuelve por frontmatter `layer:`
// o cae al default seguro 'functional' (mejor exponer de más a Negocio un doc
// técnico ocasional que ocultarle a Producto uno funcional).
const DOCTYPE_LAYER = {
  // brain
  domain: 'functional',
  service: 'functional',
  flow: 'functional',
  architecture: 'functional',
  glossary: 'functional',
  finding: 'traceability',
  'rq-spec': 'technical',
  // product
  standard: 'technical',
  status: 'traceability',
  prd: 'functional',
  'decision-log': 'traceability',
  stories: 'functional',
  'jira-preview': 'traceability',
  'jira-updates': 'traceability',
  'status-update': 'traceability',
  'prd-changelog': 'traceability',
  'prd-review': 'traceability',
};
const VALID_LAYERS = new Set(['functional', 'technical', 'traceability']);
const LAYER_DEFAULT = 'functional';

/** Resuelve la capa: frontmatter `layer:` explícito manda; si no, el default del
 * docType; si el docType no tiene default (p.ej. analysis), cae a LAYER_DEFAULT. */
function layerFor(docType, fmYaml) {
  const explicit = String(fmYaml?.layer ?? '').toLowerCase();
  if (VALID_LAYERS.has(explicit)) return explicit;
  return DOCTYPE_LAYER[docType] ?? LAYER_DEFAULT;
}

/** Sidecar de metadata que Bedrock indexa como atributos filtrables
 * (`<s3-key>.metadata.json`, formato `metadataAttributes`). Todo lo que ya
 * viaja como header S3 informativo (metadata()) se repite acá para que
 * managedSearchConfiguration.filter pueda usarlo. */
function metadataSidecarFor(metadata) {
  const attrs = {};
  for (const [k, v] of Object.entries(metadata)) {
    if (v == null || v === '') continue;
    attrs[k] = { value: { type: 'STRING', stringValue: String(v) }, includeForEmbedding: false };
  }
  return { metadataAttributes: attrs };
}

// --- Escaneo de árbol ---------------------------------------------------------
async function walk(dir, out = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === '.git' || e.name === 'node_modules') continue;
      await walk(p, out);
    } else if (e.isFile()) {
      out.push(p);
    }
  }
  return out;
}

// --- Filtro anti-secretos (regex conservador; el pipeline puede sumar más) ---
const SECRET_PATTERNS = [
  { name: 'AWS access key',   re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'AWS secret key',   re: /aws_secret_access_key\s*=\s*[A-Za-z0-9/+=]{40}/i },
  { name: 'JWT',              re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/ },
  { name: 'Private key PEM',  re: /-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----/ },
  { name: 'Slack token',      re: /\bxox[abpr]-[A-Za-z0-9-]{10,}/ },
  { name: 'GitHub PAT',       re: /\bghp_[A-Za-z0-9]{36}\b/ },
];

function scanSecrets(text) {
  const hits = [];
  for (const p of SECRET_PATTERNS) if (p.re.test(text)) hits.push(p.name);
  return hits;
}

// --- Frontmatter YAML mínimo (solo pares k: v de primer nivel) ---------------
function parseFrontmatter(text) {
  if (!text.startsWith('---')) return {};
  const end = text.indexOf('\n---', 3);
  if (end < 0) return {};
  const body = text.slice(3, end);
  const out = {};
  for (const line of body.split('\n')) {
    const m = line.match(/^([a-zA-Z0-9_.-]+):\s*(.+?)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

// --- Metadata por archivo -----------------------------------------------------
function repoNameFrom(rootPath) {
  try {
    return execSync('basename $(git rev-parse --show-toplevel)', { cwd: rootPath })
      .toString().trim();
  } catch { return basename(rootPath); }
}

function shaFor(rootPath, relPath) {
  try {
    return execSync(`git log -1 --format=%H -- "${relPath}"`, { cwd: rootPath }).toString().trim().slice(0, 12);
  } catch { return ''; }
}

function lastUpdatedFor(rootPath, relPath) {
  try {
    return execSync(`git log -1 --format=%aI -- "${relPath}"`, { cwd: rootPath }).toString().trim().slice(0, 10);
  } catch { return ''; }
}

async function buildManifest(rootPath) {
  const files = await walk(rootPath);
  const rel = files.map(f => relative(rootPath, f));
  const repo = repoNameFrom(rootPath);
  const kept = [], skipped = [], secrets = [];

  for (const rp of rel) {
    if (EXCLUDE.some(re => re.test(rp))) { skipped.push({ file: rp, reason: 'excluded' }); continue; }
    const rule = INCLUDE.find(r => r.re.test(rp));
    if (!rule) { skipped.push({ file: rp, reason: 'no include rule' }); continue; }

    const full = join(rootPath, rp);
    const size = statSync(full).size;

    let fmYaml = {};
    let textCheck = '';
    if (extname(rp) === '.md' || extname(rp) === '.mmd' || extname(rp) === '.json') {
      const buf = await readFile(full, 'utf8');
      textCheck = buf;
      if (extname(rp) === '.md') fmYaml = parseFrontmatter(buf);
    }

    const secretHits = textCheck ? scanSecrets(textCheck) : [];
    if (secretHits.length) {
      secrets.push({ file: rp, patterns: secretHits });
      skipped.push({ file: rp, reason: `secret detected: ${secretHits.join(', ')}` });
      continue;
    }

    const slug = rp.startsWith('intakes/') ? rp.split('/')[1] : null;
    const version = (rp.match(/\/v(\d+)\//) || [])[1] || fmYaml.prd_version || fmYaml.figma_version;

    kept.push({
      file: rp,
      size,
      sha: shaFor(rootPath, rp),
      lastUpdated: lastUpdatedFor(rootPath, rp),
      metadata: {
        source: rule.source,
        repo,
        docType: rule.docType,
        layer: layerFor(rule.docType, fmYaml),
        slug,
        version,
        status: fmYaml.status,
        capability: fmYaml.capability,
        title: fmYaml.title,
      },
    });
  }

  return { kept, skipped, secrets };
}

// --- Upload S3 (best-effort; requiere AWS SDK v3 instalado) ------------------
async function uploadS3(kept, rootPath, s3Uri) {
  const m = s3Uri.match(/^s3:\/\/([^/]+)\/?(.*)$/);
  if (!m) throw new Error(`s3 uri inválida: ${s3Uri}`);
  const [, bucket, rawPrefix] = m;
  const prefix = rawPrefix.replace(/\/$/, '');
  let PutObjectCommand, S3Client;
  try {
    ({ S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3'));
  } catch {
    console.error('❌ falta @aws-sdk/client-s3 · agregar al Action con `npm i @aws-sdk/client-s3`');
    process.exit(2);
  }
  const s3 = new S3Client({});
  let uploaded = 0;
  // S3 user-defined metadata viaja como HTTP header — Node rechaza chars fuera
  // de ASCII imprimible. Los valores del frontmatter pueden tener acentos, ñ,
  // comillas curvas, etc. → escapamos con encodeURIComponent y quien lee
  // decodea con decodeURIComponent. Truncamos a 200 chars para no romper el
  // límite de 2 KB por header.
  const safeHeader = (v) => {
    const s = String(v ?? '');
    const encoded = /^[\x20-\x7E]*$/.test(s) ? s : encodeURIComponent(s);
    return encoded.slice(0, 200);
  };
  for (const it of kept) {
    const key = prefix ? `${prefix}/${it.file}` : it.file;
    const body = await readFile(join(rootPath, it.file));
    const meta = Object.fromEntries(
      Object.entries(it.metadata)
        .filter(([, v]) => v != null)
        .map(([k, v]) => [k.toLowerCase(), safeHeader(v)])
    );
    await s3.send(new PutObjectCommand({
      Bucket: bucket, Key: key, Body: body,
      Metadata: { ...meta, sha: safeHeader(it.sha), 'last-updated': safeHeader(it.lastUpdated) },
      ContentType: contentTypeFor(it.file),
    }));
    // Sidecar que Bedrock SÍ indexa como atributo filtrable (a diferencia del
    // header S3 de arriba, que es solo informativo). Convención de AWS: junto a
    // <key> va <key>.metadata.json.
    await s3.send(new PutObjectCommand({
      Bucket: bucket, Key: `${key}.metadata.json`,
      Body: Buffer.from(JSON.stringify(metadataSidecarFor(it.metadata)), 'utf8'),
      ContentType: 'application/json; charset=utf-8',
    }));
    uploaded++;
  }
  return uploaded;
}

function contentTypeFor(f) {
  // charset=utf-8 explícito: Bedrock KB, si no lo ve, asume Latin-1 (RFC 2616) y
  // re-encodea → doble UTF-8 en cada chunk retrieved (Módulo → MÃ³dulo).
  if (f.endsWith('.md') || f.endsWith('.mmd')) return 'text/markdown; charset=utf-8';
  if (f.endsWith('.json')) return 'application/json; charset=utf-8';
  if (f.endsWith('.pdf')) return 'application/pdf';
  return 'application/octet-stream';
}

// --- Bedrock KB ingestion job (opcional) -------------------------------------
async function triggerIngestion(kbIdArg) {
  const [kbId, dataSourceId] = kbIdArg.split(':');
  if (!kbId || !dataSourceId) {
    console.error('⚠ --kb-id espera "<kbId>:<dataSourceId>"; ingestion no disparado');
    return null;
  }
  let StartIngestionJobCommand, BedrockAgentClient;
  try {
    ({ BedrockAgentClient, StartIngestionJobCommand } = await import('@aws-sdk/client-bedrock-agent'));
  } catch {
    console.error('⚠ falta @aws-sdk/client-bedrock-agent · ingestion no disparado');
    return null;
  }
  const c = new BedrockAgentClient({});
  // Bedrock serializa los ingestion jobs por data source: si brain y product-data sincronizan casi
  // a la vez, el segundo recibe ConflictException. Reintentamos con espera en vez de fallar el workflow.
  const waits = [45_000, 90_000, 120_000];
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await c.send(new StartIngestionJobCommand({ knowledgeBaseId: kbId, dataSourceId }));
      return res.ingestionJob?.ingestionJobId;
    } catch (e) {
      const conflict = e?.name === 'ConflictException' || /ongoing ingestion job/i.test(e?.message || '');
      if (!conflict || attempt >= waits.length) throw e;
      console.error(`⚠ ingestion job en curso en la KB; reintento ${attempt + 1}/${waits.length} en ${waits[attempt] / 1000}s`);
      await new Promise(r => setTimeout(r, waits[attempt]));
    }
  }
}

// --- CLI -----------------------------------------------------------------------
// Guardado detrás de isMain para que los tests puedan `import` las funciones de
// arriba sin disparar la ejecución (que exige repoRoot por argv y hace process.exit).
const isMain = process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href;

async function main() {
  const args = process.argv.slice(2);
  const repoRoot = args[0];
  if (!repoRoot || !existsSync(repoRoot)) {
    console.error('uso: rag-sync.mjs <repoRoot> [--to s3://bucket/prefix] [--dry-run] [--kb-id <id>]');
    process.exit(1);
  }
  const argVal = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : null; };
  const dryRun = args.includes('--dry-run');
  const s3Target = argVal('--to');
  const kbId = argVal('--kb-id');
  const doUpload = !!s3Target && !dryRun;

  const { kept, skipped, secrets } = await buildManifest(repoRoot);
  const summary = {
    repoRoot,
    counts: { kept: kept.length, skipped: skipped.length, secretsBlocked: secrets.length },
    bytes: kept.reduce((a, b) => a + b.size, 0),
    generatedAt: new Date().toISOString(),
  };

  if (dryRun || !doUpload) {
    console.log(JSON.stringify({ summary, kept, skipped, secrets }, null, 2));
    if (secrets.length) process.exitCode = 3;
    return;
  }

  console.log(`▲ subiendo ${kept.length} archivos (${(summary.bytes / 1024).toFixed(1)} KB) a ${s3Target}`);
  const uploaded = await uploadS3(kept, repoRoot, s3Target);
  console.log(`✓ subidos ${uploaded}/${kept.length}`);

  if (kbId) {
    const jobId = await triggerIngestion(kbId);
    if (jobId) console.log(`✓ ingestion job Bedrock KB: ${jobId}`);
  }

  if (secrets.length) {
    console.error(`⚠ ${secrets.length} archivo(s) bloqueado(s) por secretos detectados — revisá:`);
    for (const s of secrets) console.error(`  - ${s.file} (${s.patterns.join(', ')})`);
    process.exitCode = 3;
  }
}

if (isMain) {
  main();
}

export {
  INCLUDE, EXCLUDE, DOCTYPE_LAYER, VALID_LAYERS, LAYER_DEFAULT,
  layerFor, metadataSidecarFor, parseFrontmatter, scanSecrets,
  buildManifest, uploadS3, contentTypeFor, triggerIngestion,
};
