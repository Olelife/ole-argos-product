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

out="$(bash "${ROOT}/scripts/prd-check.sh" "${INTAKE}/PRD-sample-intake.md")"
echo "${out}" | grep -q "Estructura completa" && ok "prd-check: fixture pasa" || fail "prd-check: el fixture debería pasar"

echo
[ "${rc}" -eq 0 ] && echo "✓ smoke OK" || { echo "✗ smoke con fallas" >&2; exit 1; }
