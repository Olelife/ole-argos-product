#!/usr/bin/env bash
set -euo pipefail

# data-doctor.sh — chequeo ADVISORY del repo de datos (ole-argos-product-data) al arrancar la sesión.
# Avisa solo si algo está mal; silencioso si todo está en orden. Sale 0 siempre.
#   · rama distinta de main (el intake se commitea a main; en otra rama no llega a nadie)
#   · commits atrás/adelante de origin/main (fetch de solo lectura, con timeout)
#   · cambios sin commitear
#   · PNG de Figma que son punteros de LFS (falta `git lfs pull`)
#
#   --show   modo verboso: imprime también lo que está bien y el conteo de intakes.

MODE="${1:-warn}"
WORKSPACE="${OLE_WORKSPACE:-${CLAUDE_PROJECT_DIR:-$PWD}}"
CONFIG_FILE="${OLE_CONFIG:-${WORKSPACE}/config.local.conf}"
# shellcheck source=/dev/null
[ -f "${CONFIG_FILE}" ] && . "${CONFIG_FILE}"
OLE_REPOS="${OLE_REPOS:-${WORKSPACE}/repos}"
DATA="${OLE_DATA_REPO:-${OLE_REPOS}/ole-argos-product-data}"

say()  { echo "$@"; }
info() { [ "${MODE}" = "--show" ] && echo "$@" || true; }

if ! git -C "${DATA}" rev-parse --git-dir >/dev/null 2>&1; then
  info "🗿  repo de datos: no está en ${DATA} (corré /argos-product:setup)"
  exit 0
fi

warns=0
branch="$(git -C "${DATA}" rev-parse --abbrev-ref HEAD 2>/dev/null || echo '?')"
if [ "${branch}" != "main" ]; then
  say "⚠ repo de datos en rama '${branch}' (los intakes se commitean a main; en otra rama no le llegan a nadie)."
  warns=$((warns + 1))
fi

dirty="$(git -C "${DATA}" status --porcelain 2>/dev/null | wc -l | tr -d ' ')"
[ "${dirty:-0}" -gt 0 ] && { say "⚠ repo de datos con ${dirty} cambio(s) sin commitear."; warns=$((warns + 1)); }

if git -C "${DATA}" remote get-url origin >/dev/null 2>&1; then
  ( GIT_TERMINAL_PROMPT=0 GIT_SSH_COMMAND='ssh -o BatchMode=yes -o ConnectTimeout=8' \
      git -C "${DATA}" fetch -q origin main 2>/dev/null ) &
  fp=$!; ( sleep 20; kill "${fp}" 2>/dev/null ) 2>/dev/null & wp=$!
  wait "${fp}" 2>/dev/null || true; kill "${wp}" 2>/dev/null || true; wait "${wp}" 2>/dev/null || true
  if git -C "${DATA}" show-ref --verify --quiet refs/remotes/origin/main; then
    behind="$(git -C "${DATA}" rev-list --count HEAD..origin/main 2>/dev/null || echo 0)"
    ahead="$(git -C "${DATA}" rev-list --count origin/main..HEAD 2>/dev/null || echo 0)"
    [ "${behind:-0}" -gt 0 ] && { say "⚠ repo de datos ${behind} commit(s) atrás de origin/main → git -C \"${DATA}\" pull --ff-only"; warns=$((warns + 1)); }
    [ "${ahead:-0}" -gt 0 ] && { say "⚠ repo de datos ${ahead} commit(s) sin pushear."; warns=$((warns + 1)); }
  fi
fi

pointers=0
while IFS= read -r png; do
  [ -n "${png}" ] || continue
  if head -c 64 "${png}" 2>/dev/null | grep -q 'git-lfs.github.com/spec'; then pointers=$((pointers + 1)); fi
done < <(find "${DATA}/intakes" -path '*/figma/*/frames/*.png' -type f 2>/dev/null | head -400)
[ "${pointers}" -gt 0 ] && { say "⚠ ${pointers} PNG de Figma son punteros de LFS (no imágenes) → git -C \"${DATA}\" lfs pull"; warns=$((warns + 1)); }

n="$(find "${DATA}/intakes" -mindepth 1 -maxdepth 1 -type d ! -name '_*' 2>/dev/null | wc -l | tr -d ' ')"
if [ "${warns}" -eq 0 ]; then
  info "✓ repo de datos en orden: rama main, al día, ${n} intake(s)."
else
  say "  (repo de datos: ${DATA} · ${n} intake(s))"
fi
exit 0
