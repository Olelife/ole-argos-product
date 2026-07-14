#!/usr/bin/env bash
set -euo pipefail

# intake-new.sh <slug> "<título>" — crea intakes/<slug>/ en el repo de datos desde los templates.
# Lo invoca /argos-product:intake (verbo 'nuevo'). Idempotente-seguro: falla si el intake ya existe.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOTOR="${CLAUDE_PLUGIN_ROOT:-$(dirname "$SCRIPT_DIR")}"
WORKSPACE="${OLE_WORKSPACE:-${CLAUDE_PROJECT_DIR:-$PWD}}"
CONFIG_FILE="${OLE_CONFIG:-${WORKSPACE}/config.local.conf}"
# shellcheck source=/dev/null
[ -f "${CONFIG_FILE}" ] && . "${CONFIG_FILE}"
OLE_REPOS="${OLE_REPOS:-${WORKSPACE}/repos}"
DATA="${OLE_DATA_REPO:-${OLE_REPOS}/ole-argos-product-data}"
TPL="${MOTOR}/templates"

slug="${1:-}"; title="${2:-}"
[ -n "${slug}" ] && [ -n "${title}" ] || { echo "uso: intake-new.sh <slug> \"<título>\"" >&2; exit 1; }
[ -d "${DATA}/.git" ] || { echo "✗ falta el repo de datos en ${DATA}. Corré /argos-product:setup." >&2; exit 1; }

DIR="${DATA}/intakes/${slug}"
[ -e "${DIR}" ] && { echo "✗ el intake '${slug}' ya existe (${DIR}). Usá el verbo 'version' o 'duda'." >&2; exit 1; }

SLUG_UP="$(printf '%s' "${slug}" | tr '[:lower:]' '[:upper:]')"
TODAY="$(date +%F)"

mkdir -p "${DIR}/analysis" "${DIR}/figma"

fill() { # fill <template> <destino>
  TITLE="${title}" SLUG="${slug}" SLUGUP="${SLUG_UP}" TODAY="${TODAY}" \
  perl -pe 's/<slug-kebab>/$ENV{SLUG}/g; s/<título del intake>/$ENV{TITLE}/g; s/<título>/$ENV{TITLE}/g; s/<SLUG>/$ENV{SLUGUP}/g; s/<slug>/$ENV{SLUG}/g; s/<YYYY-MM-DD>/$ENV{TODAY}/g' \
    "$1" > "$2"
}

fill "${TPL}/intake-status.md" "${DIR}/STATUS.md"
fill "${TPL}/decision-log.md"  "${DIR}/decision-log.md"
fill "${TPL}/stories.md"       "${DIR}/stories.md"
fill "${TPL}/prd.md"           "${DIR}/PRD-${slug}.md"
: > "${DIR}/analysis/.gitkeep"

echo "✓ intake creado: intakes/${slug}/"
echo "  ${DIR}"
