#!/usr/bin/env bash
set -euo pipefail

# diagrams-gen.sh <analysisDir> — renderiza los .mmd (Mermaid) del dir a .png con el tema Olé.
# Best-effort: si mmdc/Chrome no están, deja los .mmd como fuente y no rompe el intake.
# Lo invoca /argos-product:intake (paso 'Diagramas'). El dashboard embebe los .png resultantes.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOTOR="${CLAUDE_PLUGIN_ROOT:-$(dirname "$SCRIPT_DIR")}"
THEME="${MOTOR}/templates/mermaid-theme.json"

DIR="${1:-}"
[ -n "${DIR}" ] || { echo "uso: diagrams-gen.sh <analysisDir>" >&2; exit 1; }

shopt -s nullglob
mmds=( "${DIR}"/*.mmd )
if [ ${#mmds[@]} -eq 0 ]; then echo "  (sin .mmd en ${DIR}; nada que renderizar)"; exit 0; fi

PPTR="$(mktemp)"
CHROME=""
for c in "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" "$(command -v google-chrome 2>/dev/null || true)" "$(command -v chromium 2>/dev/null || true)" "$(command -v chromium-browser 2>/dev/null || true)"; do
  [ -n "${c}" ] && [ -x "${c}" ] && { CHROME="${c}"; break; }
done
if [ -n "${CHROME}" ]; then
  printf '{ "executablePath": "%s", "args": ["--no-sandbox"] }' "${CHROME}" > "${PPTR}"
else
  printf '{ "args": ["--no-sandbox"] }' > "${PPTR}"
fi
# mmdc local si existe; si no, npx contra el registry público (un .npmrc de CodeArtifact vencido rompe
# cualquier npx y el error "¿mmdc/Chrome?" despista). El dashboard igual renderiza los .mmd en el navegador.
if command -v mmdc >/dev/null 2>&1; then MMDC=(mmdc); else MMDC=(npx -y --registry=https://registry.npmjs.org/ @mermaid-js/mermaid-cli@11); fi

ok=0; fail=0
for f in "${mmds[@]}"; do
  out="${f%.mmd}.png"
  if "${MMDC[@]}" -i "${f}" -o "${out}" -c "${THEME}" -p "${PPTR}" -b white --scale 3 >/dev/null 2>&1; then
    ok=$((ok + 1))
  else
    fail=$((fail + 1)); echo "  ! no pude renderizar $(basename "${f}") — el dashboard lo dibuja igual desde el .mmd (mermaid en el navegador)"
  fi
done
rm -f "${PPTR}"
echo "✓ diagramas: ${ok} renderizados, ${fail} fallidos (los .mmd quedan como fuente en ${DIR})"
