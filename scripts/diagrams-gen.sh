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
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
if [ -x "${CHROME}" ]; then
  printf '{ "executablePath": "%s", "args": ["--no-sandbox"] }' "${CHROME}" > "${PPTR}"
else
  printf '{ "args": ["--no-sandbox"] }' > "${PPTR}"
fi

ok=0; fail=0
for f in "${mmds[@]}"; do
  out="${f%.mmd}.png"
  if npx -y @mermaid-js/mermaid-cli@latest -i "${f}" -o "${out}" -c "${THEME}" -p "${PPTR}" -b white --scale 3 >/dev/null 2>&1; then
    ok=$((ok + 1))
  else
    fail=$((fail + 1)); echo "  ! no pude renderizar $(basename "${f}") (¿mmdc/Chrome disponibles?)"
  fi
done
rm -f "${PPTR}"
echo "✓ diagramas: ${ok} renderizados, ${fail} fallidos (los .mmd quedan como fuente en ${DIR})"
