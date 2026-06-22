#!/usr/bin/env bash
set -euo pipefail

# prd-check.sh <archivo.md> — valida que el PRD tenga las secciones obligatorias y reporta huecos.
# Read-only, advisory. Sale 0 siempre. Lo usa /argos-product:prd (paso 8) y podés correrlo a mano.

FILE="${1:-}"
if [ ! -f "${FILE}" ]; then
  echo "Uso: $(basename "$0") PRD-<slug>.md" >&2
  exit 1
fi

issues=0
flag() { echo "  ⚠ $1"; issues=$((issues + 1)); }
has() { grep -qiE "^#+[[:space:]].*$1" "${FILE}"; }   # ¿hay un heading que contenga el texto?

echo "🗿  Argos valida ${FILE}"

# --- secciones obligatorias (standards/prd.md) ---
while IFS= read -r sec; do
  [ -n "${sec}" ] || continue
  has "${sec}" || flag "falta sección: ${sec}"
done <<'SECTIONS'
Problema
Objetivo
En alcance
Fuera de alcance
Comportamiento
(Historias|Épicas)
Preguntas abiertas
Contexto complementario
SECTIONS

# --- placeholders / guía sin completar ---
n_ph="$(grep -cE '<[A-Za-zÁÉÍÓÚÑáéíóúñ][^>]*>|TODO' "${FILE}" || true)"
[ "${n_ph:-0}" -gt 0 ] && flag "${n_ph} placeholder(s) sin completar (<…> / TODO)"
grep -q '<!--' "${FILE}" && flag "quedan comentarios guía <!-- --> sin borrar"

# --- info (no bloqueante) ---
n_open="$(grep -ciE '\|[[:space:]]*open[[:space:]]*\|' "${FILE}" || true)"
[ "${n_open:-0}" -gt 0 ] && echo "  • ${n_open} pregunta(s) abierta(s) en estado 'open' (ok a propósito; resolvé antes de 'ready')"
st="$(awk -F': *' '/^status:/{print $2; exit}' "${FILE}")"
echo "  • status: ${st:-?}"

echo
if [ "${issues}" -eq 0 ]; then
  echo "✓ Estructura completa. Revisá las preguntas abiertas antes de marcar status: ready."
else
  echo "⚠ ${issues} hueco(s). Completalos antes de dar el PRD por listo."
fi
exit 0
