#!/usr/bin/env bash
set -euo pipefail

# argos-hello.sh — saludo de Argos·Producto al iniciar (SessionStart, advisory). En personaje.
# Tolerante: sale 0 siempre (sin cerebro, sin config — igual saluda).

WORKSPACE="${OLE_WORKSPACE:-${CLAUDE_PROJECT_DIR:-$PWD}}"
CONFIG_FILE="${OLE_CONFIG:-${WORKSPACE}/config.local.conf}"
# shellcheck source=/dev/null
[ -f "${CONFIG_FILE}" ] && . "${CONFIG_FILE}"
OLE_REPOS="${OLE_REPOS:-${WORKSPACE}/repos}"
BRAIN="${OLE_REPOS}/ole-argos-brain"

echo "🗿  Argos despierto — modo Producto."
if [ -d "${BRAIN}/.git" ]; then
  echo "    Cerebro a mano (solo lectura) para fundamentar tus PRDs."
else
  echo "    Sin cerebro todavía — corré /argos-product:setup para traerlo (read-only)."
fi
echo "    Te ayudo a escribir un PRD claro y acotado. Cuando quieras: /argos-product:prd."
exit 0
