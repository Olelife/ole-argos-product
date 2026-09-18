#!/usr/bin/env bash
set -euo pipefail

# rag-retrieve.sh "<pregunta>" [--k N] [--source brain|product] [--slug <slug>] [--type <docType>] [--json]
#
# Recupera los chunks más parecidos del corpus de Producto en Bedrock Knowledge Bases (solo Retrieve:
# la KB managed no soporta RetrieveAndGenerate ni filtros de metadata — usa managedSearchConfiguration
# y el filtro por fuente/slug/tipo se hace acá, sobre la ruta de la URI de S3). La redacción de la
# respuesta la hace el agente, con estas citas.
#
# Config (config.local.conf o env): RAG_KB_ID=<knowledgeBaseId>[:<dataSourceId>]  RAG_AWS_REGION=us-east-1
# Salida (default): una línea por chunk → score · ruta (source/…/archivo.md) · extracto.  --json: crudo.

Q="${1:-}"; shift || true
[ -n "${Q}" ] || { echo "uso: rag-retrieve.sh \"<pregunta>\" [--k N] [--source brain|product] [--slug S] [--type T] [--json]" >&2; exit 1; }
K=8; SRC=""; SLUG=""; TYPE=""; JSON=0
while [ $# -gt 0 ]; do
  case "$1" in
    --k) K="${2:-8}"; shift 2 ;;
    --source) SRC="${2:-}"; shift 2 ;;
    --slug) SLUG="${2:-}"; shift 2 ;;
    --type) TYPE="${2:-}"; shift 2 ;;
    --json) JSON=1; shift ;;
    *) shift ;;
  esac
done

WORKSPACE="${OLE_WORKSPACE:-${CLAUDE_PROJECT_DIR:-$PWD}}"
CONFIG_FILE="${OLE_CONFIG:-${WORKSPACE}/config.local.conf}"
# shellcheck source=/dev/null
[ -f "${CONFIG_FILE}" ] && . "${CONFIG_FILE}"
KB="${RAG_KB_ID%%:*}"
REGION="${RAG_AWS_REGION:-us-east-1}"
[ -n "${KB:-}" ] || { echo "RAG no habilitado: falta RAG_KB_ID (ver docs/rag-setup.md)." >&2; exit 3; }
command -v aws >/dev/null 2>&1 || { echo "✗ falta la CLI de AWS." >&2; exit 3; }

# Pedimos más de lo que mostramos para que el filtro por URI no deje la lista vacía.
WANT=$(( K * 4 )); [ "${WANT}" -gt 100 ] && WANT=100
# La KB managed exige managedSearchConfiguration para fijar numberOfResults; la CLI 2.27 todavía no lo
# conoce, boto3 sí. Orden: boto3 → CLI con managedSearchConfiguration → CLI pelada (5 resultados).
retrieve_boto3() {
  RAG_Q="${Q}" RAG_KB="${KB}" RAG_REGION="${REGION}" RAG_WANT="${WANT}" python3 - <<'PYB' 2>/dev/null
import json, os, sys
try:
    import boto3
except ImportError:
    sys.exit(4)
c = boto3.client('bedrock-agent-runtime', region_name=os.environ['RAG_REGION'])
r = c.retrieve(knowledgeBaseId=os.environ['RAG_KB'], retrievalQuery={'text': os.environ['RAG_Q']},
               retrievalConfiguration={'managedSearchConfiguration': {'numberOfResults': int(os.environ['RAG_WANT'])}})
print(json.dumps({'retrievalResults': r.get('retrievalResults', [])}, default=str))
PYB
}
RAW="$(retrieve_boto3 \
  || aws bedrock-agent-runtime retrieve --region "${REGION}" --knowledge-base-id "${KB}" --retrieval-query "text=${Q}" \
       --retrieval-configuration "{\"managedSearchConfiguration\":{\"numberOfResults\":${WANT}}}" --output json 2>/dev/null \
  || aws bedrock-agent-runtime retrieve --region "${REGION}" --knowledge-base-id "${KB}" --retrieval-query "text=${Q}" --output json)"

RAG_RAW="${RAW}" RAG_K="${K}" RAG_SRC="${SRC}" RAG_SLUG="${SLUG}" RAG_TYPE="${TYPE}" RAG_JSON="${JSON}" python3 - <<'PY'
import json, os, re, sys
raw = json.loads(os.environ['RAG_RAW']); k = int(os.environ['RAG_K'])
src, slug, typ, as_json = os.environ['RAG_SRC'], os.environ['RAG_SLUG'], os.environ['RAG_TYPE'], os.environ['RAG_JSON'] == '1'
out = []
for r in raw.get('retrievalResults', []):
    uri = (r.get('location', {}).get('s3Location', {}) or {}).get('uri', '')
    path = re.sub(r'^https?://[^/]+/|^s3://[^/]+/', '', uri)
    source = path.split('/')[0] if '/' in path else ''
    m = re.search(r'/intakes/([^/]+)/', '/' + path)
    pslug = m.group(1) if m else ''
    # La KB managed no devuelve la metadata propia (docType…): se deriva de la ruta, con las mismas reglas que rag-sync.
    base = path.rsplit('/', 1)[-1]
    dtype = ('prd' if base.startswith('PRD-') else 'decision-log' if base == 'decision-log.md' else 'stories' if base == 'stories.md'
             else 'status' if base == 'STATUS.md' else 'finding' if '/findings/' in '/' + path else 'flow' if '/flows/' in path
             else 'domain' if path.startswith('brain/domain/') else 'service' if '/services/' in path else 'analysis' if '/analysis/' in path
             else 'rq-spec' if '/archive/' in path else 'glossary' if base == 'glossary.md' else '')
    if src and source != src: continue
    if slug and pslug != slug: continue
    if typ and dtype != typ: continue
    text = re.sub(r'\s+', ' ', (r.get('content', {}) or {}).get('text', '')).strip()
    out.append({'score': round(float(r.get('score', 0)), 3), 'path': path, 'source': source, 'slug': pslug, 'docType': dtype, 'excerpt': text[:400]})
    if len(out) >= k: break
if as_json:
    print(json.dumps({'query': os.environ.get('Q', ''), 'results': out}, ensure_ascii=False, indent=1)); sys.exit(0)
if not out:
    n = len(raw.get('retrievalResults', []))
    print(f'no hay material relevante en el corpus para esa consulta ({n} chunk(s) recuperados, 0 tras el filtro' + (' — probá sin --source/--slug/--type' if n else '') + ')'); sys.exit(0)
avg = sum(o['score'] for o in out) / len(out)
print(f"{len(out)} chunk(s) · score promedio {avg:.2f}" + ("  ⚠ bajo: la respuesta puede ser parcial" if avg < 0.5 else ""))
for o in out:
    print(f"\n[{o['score']:.2f}] {o['path']}" + (f"  ({o['docType']})" if o['docType'] else ''))
    print(f"    {o['excerpt'][:300]}{'…' if len(o['excerpt']) > 300 else ''}")
PY
