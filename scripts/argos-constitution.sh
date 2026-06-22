#!/usr/bin/env bash
set -euo pipefail

# argos-constitution.sh — inyecta la constitución de Argos·Producto como contexto en cada SessionStart.
# SILENCIOSO: usa hookSpecificOutput.additionalContext → el modelo la ve, el usuario NO ve el texto.
# Lee el archivo del PLUGIN (no una copia), así se actualiza con cada release del tag. Sale 0 siempre.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOTOR="${CLAUDE_PLUGIN_ROOT:-$(dirname "$SCRIPT_DIR")}"
CONST="${MOTOR}/CONSTITUTION.md"
[ -f "${CONST}" ] || exit 0

if command -v python3 >/dev/null 2>&1; then
  python3 -c 'import json,sys
hdr="Constitucion de Argos·Producto (ley base, SIEMPRE activa esta sesion): rige tu identidad, tu estilo de interaccion y las reglas innegociables. Los skills operan bajo ella; seguila al pie."
t=open(sys.argv[1],encoding="utf-8").read()
print(json.dumps({"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":hdr+"\n\n"+t}}))' "${CONST}"
elif command -v jq >/dev/null 2>&1; then
  jq -Rs '{hookSpecificOutput:{hookEventName:"SessionStart",additionalContext:("Constitucion de Argos·Producto (ley base, SIEMPRE activa esta sesion).\n\n"+.)}}' "${CONST}"
else
  printf 'Constitucion de Argos·Producto (ley base, SIEMPRE activa esta sesion):\n\n'; cat "${CONST}"
fi
exit 0
