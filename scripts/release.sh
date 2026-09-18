#!/usr/bin/env bash
set -euo pipefail

# release.sh — bumpea la versión del Motor de Producto de forma COHERENTE (plugin.json + marketplace.json)
# y te deja los próximos pasos. Evita que version/ref se desincronicen (el CI lo verifica).
#
# NO commitea, NO pushea, NO taggea: solo edita los dos archivos. Vos revisás, abrís PR, y tras
# mergear a main creás el tag (el comando te lo imprime este script).
#
# Uso: release.sh <patch|minor|major>       (o release.sh <X.Y.Z> para fijar una versión exacta)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOTOR="${CLAUDE_PLUGIN_ROOT:-$(dirname "$SCRIPT_DIR")}"
PLUGIN="${MOTOR}/.claude-plugin/plugin.json"
MARKET="${MOTOR}/.claude-plugin/marketplace.json"

[ -f "${PLUGIN}" ] || { echo "✗ no encuentro ${PLUGIN}" >&2; exit 1; }
[ "$#" -ge 1 ] || { echo "Uso: $(basename "$0") <patch|minor|major|X.Y.Z>" >&2; exit 1; }

cur="$(node -e "process.stdout.write(require('${PLUGIN}').version)")"
IFS='.' read -r MA MI PA <<EOF
${cur}
EOF

case "$1" in
  patch) new="${MA}.${MI}.$((PA + 1))" ;;
  minor) new="${MA}.$((MI + 1)).0" ;;
  major) new="$((MA + 1)).0.0" ;;
  [0-9]*.[0-9]*.[0-9]*) new="$1" ;;
  *) echo "✗ nivel inválido: $1 (usá patch|minor|major|X.Y.Z)" >&2; exit 1 ;;
esac

echo "🗿  Argos prepara el release del Motor de Producto: ${cur} → ${new}"

node -e "
  const fs=require('fs'), p='${PLUGIN}';
  const j=JSON.parse(fs.readFileSync(p)); j.version='${new}';
  fs.writeFileSync(p, JSON.stringify(j,null,2)+'\n');
"
echo "  ✓ plugin.json → ${new}"

if [ -f "${MARKET}" ]; then
  node -e "
    const fs=require('fs'), p='${MARKET}';
    const j=JSON.parse(fs.readFileSync(p));
    for (const pl of (j.plugins||[])) { pl.version='${new}'; if (pl.source) pl.source.ref='v${new}'; }
    fs.writeFileSync(p, JSON.stringify(j,null,2)+'\n');
  "
  echo "  ✓ marketplace.json → ${new} (ref v${new})"
fi

cat <<NEXT

  Próximos pasos:
    1. anotá el cambio en CHANGELOG.md bajo "## v${new}"
    2. git add .claude-plugin CHANGELOG.md && git commit -m "🔖 release v${new} — <resumen>"
    3. abrí el PR a main
    4. tras mergear:  git checkout main && git pull && git tag -a v${new} -m "argos-product v${new}" && git push origin v${new}
       (el marketplace referencia el tag: sin tag no hay release)
NEXT
