#!/usr/bin/env bash
set -euo pipefail

# smoke.sh — corre TODOS los generadores del Motor sobre el intake fixture y verifica la salida.
# Atrapa regresiones del contrato de columnas / frontmatter que los tests unitarios no cubren
# (lo que el dashboard, el índice, el roadmap, el widget y el avance realmente escriben).
# Uso: bash tests/smoke.sh    (sale != 0 ante la primera falla)

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "${TMP}"' EXIT
cp -R "${ROOT}/tests/fixtures/data-repo" "${TMP}/data"
DATA="${TMP}/data"
INTAKE="${DATA}/intakes/sample-intake"

rc=0
fail() { echo "  ✗ $*" >&2; rc=1; }
ok()   { echo "  ✓ $*"; }
has()  { grep -qF -- "$2" "$1" && ok "$3" || fail "$3 — no encontré '$2' en $(basename "$1")"; }
hasnt(){ grep -qF -- "$2" "$1" && fail "$3 — apareció '$2' en $(basename "$1")" || ok "$3"; }

echo "🗿 smoke test del Motor de Producto (fixture: sample-intake)"

node "${ROOT}/scripts/index-update.mjs" "${DATA}" >/dev/null
has "${DATA}/INDEX.md" "| 1 / 3 | 1 / 3 |" "INDEX: 1/3 dudas abiertas y 1/3 historias cerradas (meta Jira)"

node "${ROOT}/scripts/index-widget.mjs" "${DATA}" >/dev/null
has "${DATA}/INDEX-widget.html" '"storiesClosed":1' "index widget: cuenta historias cerradas"
has "${DATA}/INDEX-widget.html" '"dudasOpen":1' "index widget: cuenta dudas abiertas"

node "${ROOT}/scripts/dashboard-gen.mjs" "${INTAKE}" >/dev/null
has "${INTAKE}/dashboard.html" "FILEKEY/Archivo?node-id=10-20" "dashboard: link de Figma desde frontmatter anidado"
has "${INTAKE}/dashboard.html" "olelife.atlassian.net/browse/SO-101" "dashboard: link a Jira con el host correcto"
has "${INTAKE}/dashboard.html" "1/3 cerradas" "dashboard: historias cerradas por meta de Jira"
has "${INTAKE}/dashboard.html" "Sí, solo Admin" "dashboard: respuesta de la duda por nombre de columna"

node "${ROOT}/scripts/roadmap-gen.mjs" "${INTAKE}" >/dev/null 2>&1
has "${INTAKE}/roadmap-mvp.html" "Fase 1 · 👀 Consulta" "roadmap: fases parseadas"
has "${INTAKE}/roadmap-mvp.html" 'class="block b-block"' "roadmap: historia bloqueada"
has "${INTAKE}/roadmap-mvp.html" "🚧 #1" "roadmap: duda abierta cruzada con S3"
hasnt "${INTAKE}/roadmap-mvp.html" "Falta la sección" "roadmap: no muestra el banner de sección faltante"

node "${ROOT}/scripts/widget-gen.mjs" "${INTAKE}" >/dev/null
has "${INTAKE}/tickets-widget.html" "\"jiraBase\":\"https://olelife.atlassian.net\"" "widget: host de Jira correcto"
hasnt "${INTAKE}/tickets-widget.html" "ole.atlassian.net/" "widget: sin el host viejo"
has "${INTAKE}/tickets-widget.html" 'value="[Muestra]"' "widget: prefijo de título desde STATUS"
hasnt "${INTAKE}/tickets-widget.html" "Cotizaciones" "widget: sin prefijo hardcodeado"

node "${ROOT}/scripts/avance-gen.mjs" "${INTAKE}" "${ROOT}/tests/fixtures/avance-input.json" >/dev/null
has "${INTAKE}/avance.html" "1 de 3 historias" "avance: DoD por conteo"
has "${INTAKE}/avance.html" "argos-product:avance" "avance: footer cita el skill vigente"
has "${INTAKE}/avance.html" "olelife.atlassian.net/browse/SO-150" "avance: bug linkeado con host correcto"

bash "${ROOT}/scripts/prd-check.sh" "${INTAKE}/PRD-sample-intake.md" --strict >/dev/null && ok "prd-check --strict: fixture pasa" || fail "prd-check --strict: el fixture debería pasar"

node "${ROOT}/scripts/jira-import.mjs" "${INTAKE}" >/dev/null
has "${INTAKE}/jira-import.csv" '"Story","[Muestra] Exportar el listado"' "jira-import: incluye la historia pendiente"
hasnt "${INTAKE}/jira-import.csv" "Ver el listado" "jira-import: omite la historia ya creada"
has "${INTAKE}/jira-import.csv" "intake-sample-intake-s3" "jira-import: conserva el label único"
has "${INTAKE}/jira-import.csv" '"SO-100"' "jira-import: cuelga de la épica del STATUS"
has "${INTAKE}/jira-import.csv" "_Como_ asesor _quiero_ exportar *el listado*" "jira-import: markdown → wiki de Jira"
has "${INTAKE}/jira-import.csv" "[Listado|https://www.figma.com" "jira-import: links en formato wiki"

node "${ROOT}/scripts/stories-sync.mjs" "${INTAKE}" "${ROOT}/tests/fixtures/jira-snapshot.json" > "${TMP}/sync.out"
has "${TMP}/sync.out" "SO-102    Staging → Ready to Prod" "stories-sync: reporta el movimiento"
has "${TMP}/sync.out" "sin fila en stories.md: SO-199" "stories-sync: detecta issues huérfanos"
has "${INTAKE}/stories.md" "| S3 | Exportar | 🚧 (bloqueada · duda #1) | En curso | [SO-103](https://olelife.atlassian.net/browse/SO-103) | — |" "stories-sync: key por label + Estado Jira, resto intacto"
has "${INTAKE}/stories.md" "| S2 | Ver el histórico | 🟡 | Ready to Prod | SO-102 | — |" "stories-sync: no reescribe celdas que no cambian"

node "${ROOT}/scripts/status-render.mjs" "${INTAKE}" --date 2026-09-18 >/dev/null
has "${INTAKE}/STATUS.md" "- **Historias:** 2 cerradas / 3 totales · 3 en Jira" "status-render: conteos tras el sync"
has "${INTAKE}/STATUS.md" "- **Dudas:** 1 abiertas / 3 totales (1 aplicadas al PRD · 0 resueltas · 1 descartadas)" "status-render: dudas por estado"
has "${INTAKE}/STATUS.md" "updated: 2026-09-18" "status-render: fecha desde el agente"
has "${INTAKE}/STATUS.md" "fixture mínimo que ejercita" "status-render: conserva la prosa del PM"
node "${ROOT}/scripts/status-render.mjs" "${INTAKE}" >/dev/null
[ "$(grep -c '^<!-- argos:auto -->' "${INTAKE}/STATUS.md")" = "1" ] && ok "status-render: idempotente (un solo bloque auto)" || fail "status-render: duplicó el bloque auto"

node "${ROOT}/scripts/intake-lint.mjs" "${INTAKE}" > "${TMP}/lint.out" && ok "intake-lint: fixture sin errores" || fail "intake-lint: el fixture no debería tener errores"
has "${TMP}/lint.out" "roadmap: todas las historias de las fases existen" "intake-lint: cruza roadmap ↔ índice"
node "${ROOT}/scripts/index-update.mjs" "${DATA}" >/dev/null
has "${DATA}/INDEX.md" "| 1 / 3 | 2 / 3 |" "INDEX: refleja las 2 cerradas tras el sync"

echo
[ "${rc}" -eq 0 ] && echo "✓ smoke OK" || { echo "✗ smoke con fallas" >&2; exit 1; }
