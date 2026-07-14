#!/usr/bin/env bash
set -euo pipefail

# version-check.sh — versión del plugin argos-product (Motor de Producto): instalada vs última
# publicada (el tag más alto de ole-argos-product).
#   (sin args)  modo hook: avisa SOLO si estás atrasado (silencioso si al día/offline).
#   --show      comando /argos-product:version: muestra instalada + última + estado + cómo actualizar.
# Tolerante: sin red o sin acceso al repo → no rompe (sale 0).

MODE="${1:-warn}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOTOR="${CLAUDE_PLUGIN_ROOT:-$(dirname "$SCRIPT_DIR")}"
WORKSPACE="${OLE_WORKSPACE:-${CLAUDE_PROJECT_DIR:-$PWD}}"
CONFIG_FILE="${OLE_CONFIG:-${WORKSPACE}/config.local.conf}"
# shellcheck source=/dev/null
[ -f "${CONFIG_FILE}" ] && . "${CONFIG_FILE}"
ORG="${OLE_GH_ORG:-Olelife}"
REPO="ole-argos-product"
PJSON="${MOTOR}/.claude-plugin/plugin.json"

installed=""
[ -f "${PJSON}" ] && installed="$(grep -m1 '"version"' "${PJSON}" | sed -E 's/.*"version"[^"]*"([^"]+)".*/\1/')"

latest="$(GIT_TERMINAL_PROMPT=0 GIT_SSH_COMMAND='ssh -o BatchMode=yes -o ConnectTimeout=8' \
  git ls-remote --tags "https://github.com/${ORG}/${REPO}.git" 2>/dev/null \
  | sed -E 's#.*refs/tags/v?##' | grep -E '^[0-9]+\.[0-9]+\.[0-9]+$' | sort -V | tail -1)"

behind=0
if [ -n "${installed}" ] && [ -n "${latest}" ] && [ "${installed}" != "${latest}" ]; then
  top="$(printf '%s\n%s\n' "${installed}" "${latest}" | sort -V | tail -1)"
  [ "${top}" = "${latest}" ] && behind=1
fi

if [ "${MODE}" = "--show" ]; then
  echo "🗿  Argos · Producto — versión del plugin (Motor)"
  echo "    instalada:        v${installed:-desconocida}"
  if [ -n "${latest}" ]; then
    echo "    última publicada: v${latest}"
    if [ "${behind}" = 1 ]; then
      echo "    ⚠ atrasado → actualizá con /argos-product:update (o /plugin marketplace update argos-product-mkt) y recargá."
    elif [ "${installed}" = "${latest}" ]; then
      echo "    ✓ estás al día."
    else
      echo "    (tu versión es ≥ la publicada — build local/dev)"
    fi
  else
    echo "    (no pude consultar la última — sin red o sin acceso a ${ORG})"
  fi
  exit 0
fi

if [ "${behind}" = 1 ]; then
  echo "⚠ argos-product: tenés v${installed} instalada; hay v${latest} publicada. Actualizá con /argos-product:update y recargá."
fi
exit 0
