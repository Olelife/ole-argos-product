#!/usr/bin/env bash
set -euo pipefail

# workspace-init.sh [destino] — arma (o refresca) el taller de Producto en una carpeta.
#
# Deja el workspace listo para que cualquiera abra Claude Code y tenga el Motor instalado, la config
# local creada y una ficha de verbos al día en CLAUDE.md. Es IDEMPOTENTE: no pisa lo que ya escribiste
# (settings.json se fusiona, CLAUDE.md solo se regenera entre marcadores) y se puede correr en cada
# actualización del Motor para refrescar la ficha.
#
# No clona nada: eso lo hace /argos-product:setup, que este script te recuerda correr.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOTOR="${CLAUDE_PLUGIN_ROOT:-$(dirname "$SCRIPT_DIR")}"
TPL="${MOTOR}/templates/workspace"
DEST="${1:-${OLE_WORKSPACE:-${CLAUDE_PROJECT_DIR:-$PWD}}}"

[ -d "${TPL}" ] || { echo "✗ no encuentro la plantilla en ${TPL}" >&2; exit 1; }
mkdir -p "${DEST}"
DEST="$(cd "${DEST}" && pwd -P)"

echo "🗿  Argos arma el taller de Producto en ${DEST}"

mkdir -p "${DEST}/.claude" "${DEST}/repos"

# --- settings.json: fusiono el marketplace + el plugin, conservo lo que ya haya
SETTINGS="${DEST}/.claude/settings.json"
if [ -f "${SETTINGS}" ]; then
  node -e '
    const fs=require("fs"), dest=process.argv[1], tpl=process.argv[2];
    const cur=JSON.parse(fs.readFileSync(dest,"utf8")), add=JSON.parse(fs.readFileSync(tpl,"utf8"));
    const before=JSON.stringify(cur);
    cur.extraKnownMarketplaces={...(cur.extraKnownMarketplaces||{}),...add.extraKnownMarketplaces};
    cur.enabledPlugins={...(cur.enabledPlugins||{}),...add.enabledPlugins};
    if(JSON.stringify(cur)===before){ console.log("• settings.json: ya declaraba el Motor, sin cambios."); process.exit(0); }
    fs.writeFileSync(dest, JSON.stringify(cur,null,2)+"\n");
    console.log("✓ settings.json: agregué el marketplace y habilité el plugin (lo demás quedó igual).");
  ' "${SETTINGS}" "${TPL}/.claude/settings.json"
else
  cp "${TPL}/.claude/settings.json" "${SETTINGS}"
  echo "✓ .claude/settings.json creado (marketplace argos-product-mkt + plugin habilitado)."
fi

# --- archivos que solo se crean si faltan (nunca se pisan)
for pair in "CLAUDE.md:CLAUDE.md" "README.md:README.md" "gitignore:.gitignore"; do
  src="${TPL}/${pair%%:*}"; dst="${DEST}/${pair##*:}"
  if [ -f "${dst}" ]; then echo "• ${pair##*:}: ya existe, lo respeto."; else cp "${src}" "${dst}"; echo "✓ ${pair##*:} creado."; fi
done

CONFIG="${DEST}/config.local.conf"
if [ -f "${CONFIG}" ]; then echo "• config.local.conf: ya existe, lo respeto."
elif [ -f "${MOTOR}/config.example.conf" ]; then cp "${MOTOR}/config.example.conf" "${CONFIG}"; echo "✓ config.local.conf creado desde el template."
fi

# --- ficha de verbos al día (y slugs vivos si el repo de datos ya está)
DATA="${DEST}/repos/ole-argos-product-data"
if [ -d "${DATA}/intakes" ]; then
  node "${MOTOR}/scripts/workspace-doc.mjs" --motor "${MOTOR}" --data "${DATA}" --write "${DEST}/CLAUDE.md"
else
  node "${MOTOR}/scripts/workspace-doc.mjs" --motor "${MOTOR}" --write "${DEST}/CLAUDE.md"
fi

echo
if [ -d "${DATA}/intakes" ]; then
  echo "🗿  Taller listo. Abrí esta carpeta con Claude Code y arrancá con /argos-product:intake"
else
  echo "🗿  Taller armado. Falta el paso de clonado:"
  echo "    1. abrí ${DEST} con Claude Code"
  echo "    2. corré /argos-product:setup (cerebro read-only + repo de datos)"
  echo "    3. volvé a correr este script para que la ficha liste los intakes vivos"
fi
exit 0
