#!/usr/bin/env bash
set -euo pipefail

# setup.sh — onboarding de Argos-Producto (lo corre /argos-product:setup).
#
# Baja el cerebro (ole-argos-brain) RECORTADO (sparse-checkout) y SOLO PARA LECTURA:
# por defecto domain/, architecture/flows/ y glossary.md — nada de findings/, services/, specs/ (interno de Dev).
# Producto NO escribe el cerebro (lo cura Dev); el read-only real lo da el PERMISO de GitHub.
# El PRD se crea como archivo LOCAL en tu carpeta de trabajo; no hay repo de salida.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOTOR="${CLAUDE_PLUGIN_ROOT:-$(dirname "$SCRIPT_DIR")}"
WORKSPACE="${OLE_WORKSPACE:-${CLAUDE_PROJECT_DIR:-$PWD}}"
WORKSPACE="$(cd "${WORKSPACE}" 2>/dev/null && pwd -P || printf '%s' "${WORKSPACE}")"
CONFIG_FILE="${OLE_CONFIG:-${WORKSPACE}/config.local.conf}"
# shellcheck source=/dev/null
[ -f "${CONFIG_FILE}" ] && . "${CONFIG_FILE}"
OLE_REPOS="${OLE_REPOS:-${WORKSPACE}/repos}"
ORG="${OLE_GH_ORG:-Olelife}"
BRAIN="ole-argos-brain"
SPARSE="${OLE_BRAIN_SPARSE:-/domain/ /architecture/flows/ /glossary.md /README.md}"
EXAMPLE="${MOTOR}/config.example.conf"
: "${GIT_SSH_COMMAND:=ssh -o ConnectTimeout=15 -o ServerAliveInterval=10 -o ServerAliveCountMax=3 -o BatchMode=yes}"
export GIT_SSH_COMMAND
export GIT_TERMINAL_PROMPT=0
PROTO="${OLE_GH_PROTO:-}"
[ -z "${PROTO}" ] && PROTO="$(command -v gh >/dev/null 2>&1 && gh config get git_protocol 2>/dev/null || true)"
PROTO="${PROTO:-ssh}"
case "${PROTO}" in https) URL="https://github.com/${ORG}/${BRAIN}.git" ;; *) URL="git@github.com:${ORG}/${BRAIN}.git" ;; esac

run_timed() {
  local t="$1"; shift; "$@" & local p=$!
  ( sleep "$t"; kill -TERM "$p" 2>/dev/null; sleep 3; kill -KILL "$p" 2>/dev/null ) & local w=$!
  local rc=0; wait "$p" 2>/dev/null || rc=$?
  kill "$w" 2>/dev/null || true; wait "$w" 2>/dev/null || true; return "$rc"
}

echo "🗿  Argos prepara el taller de Producto."
echo "    workspace: ${WORKSPACE}"
echo "    cerebro:   ${ORG}/${BRAIN} (read-only, recortado: ${SPARSE})"
echo

mkdir -p "${OLE_REPOS}"
if [ ! -f "${CONFIG_FILE}" ] && [ -f "${EXAMPLE}" ]; then
  cp "${EXAMPLE}" "${CONFIG_FILE}"; echo "✓ config.local.conf creado desde el template."
fi

DEST="${OLE_REPOS}/${BRAIN}"
if git -C "${DEST}" rev-parse --verify --quiet HEAD >/dev/null 2>&1; then
  echo "• ${BRAIN}: ya está, refresco (read-only)."
  git -C "${DEST}" sparse-checkout set --no-cone ${SPARSE} 2>/dev/null || true
  run_timed 120 git -C "${DEST}" fetch --quiet origin 2>/dev/null || echo "  (no pude refrescar, sigo con lo local)"
  git -C "${DEST}" checkout --quiet 2>/dev/null || true
else
  [ -e "${DEST}" ] && rm -rf "${DEST}"   # limpiar clon parcial previo
  echo "• ${BRAIN}: clonando recortado…"
  if run_timed 180 git clone --filter=blob:none --no-checkout --quiet "${URL}" "${DEST}"; then
    git -C "${DEST}" sparse-checkout set --no-cone ${SPARSE}
    git -C "${DEST}" checkout --quiet
    echo "  ✓ cerebro recortado en repos/${BRAIN}"
  else
    rm -rf "${DEST}"
    echo "  ✗ no pude clonar ${ORG}/${BRAIN} (¿acceso read-only? ¿red?)."
  fi
fi

# --- repo de DATOS de intake (read-write: acá escribe Producto) ---
DATA_REPO="ole-argos-product-data"
case "${PROTO}" in https) DURL="https://github.com/${ORG}/${DATA_REPO}.git" ;; *) DURL="git@github.com:${ORG}/${DATA_REPO}.git" ;; esac
DDEST="${OLE_REPOS}/${DATA_REPO}"
if git -C "${DDEST}" rev-parse --verify --quiet HEAD >/dev/null 2>&1; then
  echo "• ${DATA_REPO}: ya está, refresco."
  run_timed 180 git -C "${DDEST}" pull --ff-only --quiet 2>/dev/null || echo "  (no pude refrescar, sigo con lo local)"
else
  [ -e "${DDEST}" ] && rm -rf "${DDEST}"
  echo "• ${DATA_REPO}: clonando (con LFS)…"
  if run_timed 240 git clone --quiet "${DURL}" "${DDEST}"; then
    command -v git-lfs >/dev/null 2>&1 && git -C "${DDEST}" lfs pull 2>/dev/null || true
    echo "  ✓ datos en repos/${DATA_REPO}"
  else
    rm -rf "${DDEST}"
    echo "  ✗ no pude clonar ${ORG}/${DATA_REPO} (¿acceso? ¿red? ¿git-lfs instalado?)."
  fi
fi

echo
echo "🗿  Listo. El cerebro es SOLO LECTURA (lo cura Dev); los intakes se escriben en repos/${DATA_REPO}."
echo "    • PRD suelto (como hoy):      /argos-product:prd"
echo "    • Intake versionado + Figma:  /argos-product:intake"
exit 0
