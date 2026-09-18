#!/usr/bin/env bash
set -euo pipefail

# smoke.sh — corre TODOS los generadores del Motor sobre el intake fixture y verifica la salida.
# Atrapa regresiones del contrato de columnas / frontmatter que los tests unitarios no cubren
# (lo que el dashboard, el índice, el roadmap, el widget y el avance realmente escriben).
# Uso: bash tests/smoke.sh    (sale != 0 ante la primera falla)

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "${TMP}"' EXIT
cp -R "${ROOT}/tests/fixtures/data-repo" "${TMP}/data"
DATA="${TMP}/data"
INTAKE="${DATA}/intakes/sample-intake"

rc=0
fail() { echo "  ✗ $*" >&2; rc=1; }
ok()   { echo "  ✓ $*"; }
has()  { grep -qF -- "$2" "$1" && ok "$3" || fail "$3 — no encontré '$2' en $(basename "$1")"; }
hasnt(){ grep -qF -- "$2" "$1" && fail "$3 — apareció '$2' en $(basename "$1")" || ok "$3"; }

echo "🗿 smoke test del Motor de Producto (fixture: sample-intake)"

node "${ROOT}/scripts/index-update.mjs" "${DATA}" >/dev/null
has "${DATA}/INDEX.md" "| 1 / 4 | 1 / 3 |" "INDEX: 1/4 dudas abiertas y 1/3 historias cerradas (meta Jira)"

node "${ROOT}/scripts/index-widget.mjs" "${DATA}" >/dev/null
has "${DATA}/INDEX-widget.html" '"storiesClosed":1' "index widget: cuenta historias cerradas"
has "${DATA}/INDEX-widget.html" '"dudasOpen":1' "index widget: cuenta dudas abiertas"

node "${ROOT}/scripts/dashboard-gen.mjs" "${INTAKE}" >/dev/null
has "${INTAKE}/dashboard.html" "FILEKEY/Archivo?node-id=10-20" "dashboard: link de Figma desde frontmatter anidado"
has "${INTAKE}/dashboard.html" "olelife.atlassian.net/browse/SO-101" "dashboard: link a Jira con el host correcto"
has "${INTAKE}/dashboard.html" "1/3 cerradas" "dashboard: historias cerradas por meta de Jira"
has "${INTAKE}/dashboard.html" "Sí, solo Admin" "dashboard: respuesta de la duda por nombre de columna"

node "${ROOT}/scripts/roadmap-gen.mjs" "${INTAKE}" >/dev/null 2>&1
has "${INTAKE}/roadmap-mvp.html" "Fase 1 · 👀 Consulta" "roadmap: fases parseadas"
has "${INTAKE}/roadmap-mvp.html" 'class="block b-block"' "roadmap: historia bloqueada"
has "${INTAKE}/roadmap-mvp.html" "🚧 #1" "roadmap: duda abierta cruzada con S3"
hasnt "${INTAKE}/roadmap-mvp.html" "Falta la sección" "roadmap: no muestra el banner de sección faltante"

node "${ROOT}/scripts/widget-gen.mjs" "${INTAKE}" >/dev/null
has "${INTAKE}/tickets-widget.html" "\"jiraBase\":\"https://olelife.atlassian.net\"" "widget: host de Jira correcto"
hasnt "${INTAKE}/tickets-widget.html" "ole.atlassian.net/" "widget: sin el host viejo"
has "${INTAKE}/tickets-widget.html" 'value="[Muestra]"' "widget: prefijo de título desde STATUS"
hasnt "${INTAKE}/tickets-widget.html" "Cotizaciones" "widget: sin prefijo hardcodeado"

node "${ROOT}/scripts/avance-gen.mjs" "${INTAKE}" "${ROOT}/tests/fixtures/avance-input.json" >/dev/null
has "${INTAKE}/avance.html" "1 de 3 historias" "avance: DoD por conteo"
has "${INTAKE}/avance.html" "argos-product:avance" "avance: footer cita el skill vigente"
has "${INTAKE}/avance.html" "olelife.atlassian.net/browse/SO-150" "avance: bug linkeado con host correcto"
has "${INTAKE}/avance.html" "Pronóstico probabilístico" "avance: sección Monte Carlo con serie semanal"
has "${INTAKE}/avance.html" "<td>P85</td>" "avance: percentiles"
has "${INTAKE}/avance.html" "Fecha comprometida 2026-10-30" "avance: semáforo contra target_date"
node "${ROOT}/scripts/avance-gen.mjs" "${INTAKE}" "${ROOT}/tests/fixtures/avance-input.json" > "${TMP}/mc1.out"; node "${ROOT}/scripts/avance-gen.mjs" "${INTAKE}" "${ROOT}/tests/fixtures/avance-input.json" > "${TMP}/mc2.out"
diff -q <(grep "Monte Carlo" "${TMP}/mc1.out") <(grep "Monte Carlo" "${TMP}/mc2.out") >/dev/null && ok "avance: Monte Carlo determinista (misma foto, mismo pronóstico)" || fail "avance: el Monte Carlo cambió entre corridas"

bash "${ROOT}/scripts/prd-check.sh" "${INTAKE}/PRD-sample-intake.md" --strict >/dev/null && ok "prd-check --strict: fixture pasa" || fail "prd-check --strict: el fixture debería pasar"
bash "${ROOT}/scripts/prd-check.sh" "${INTAKE}/PRD-sample-intake.md" | grep -q "cita 2 fuente" && ok "prd-check: cuenta la evidencia de §1" || fail "prd-check: no contó la evidencia"
bash "${ROOT}/scripts/prd-check.sh" "${ROOT}/tests/fixtures/PRD-lite.md" --strict > "${TMP}/lite.out" && ok "prd-check: PRD lite pasa con sus 5 secciones" || fail "prd-check: el PRD lite debería pasar"
has "${TMP}/lite.out" "PRD lite (one-pager)" "prd-check: reconoce lite: true"

node "${ROOT}/scripts/jira-import.mjs" "${INTAKE}" >/dev/null
has "${INTAKE}/jira-import.csv" '"Story","[Muestra] Exportar el listado"' "jira-import: incluye la historia pendiente"
hasnt "${INTAKE}/jira-import.csv" "Ver el listado" "jira-import: omite la historia ya creada"
has "${INTAKE}/jira-import.csv" "intake-sample-intake-s3" "jira-import: conserva el label único"
has "${INTAKE}/jira-import.csv" '"SO-100"' "jira-import: cuelga de la épica del STATUS"
has "${INTAKE}/jira-import.csv" "_Como_ asesor _quiero_ exportar *el listado*" "jira-import: markdown → wiki de Jira"
has "${INTAKE}/jira-import.csv" "[Listado|https://www.figma.com" "jira-import: links en formato wiki"

node "${ROOT}/scripts/stories-sync.mjs" "${INTAKE}" "${ROOT}/tests/fixtures/jira-snapshot.json" > "${TMP}/sync.out"
has "${TMP}/sync.out" "SO-102    Staging → Ready to Prod" "stories-sync: reporta el movimiento"
has "${TMP}/sync.out" "sin fila en stories.md: SO-199" "stories-sync: detecta issues huérfanos"
has "${INTAKE}/stories.md" "| S3 | Exportar | 🚧 (bloqueada · duda #1) | En curso | [SO-103](https://olelife.atlassian.net/browse/SO-103) | — |" "stories-sync: key por label + Estado Jira, resto intacto"
has "${INTAKE}/stories.md" "| S2 | Ver el histórico | 🟡 | Ready to Prod | SO-102 | — |" "stories-sync: no reescribe celdas que no cambian"

node "${ROOT}/scripts/stories-ready.mjs" "${INTAKE}" > "${TMP}/ready.out"
has "${INTAKE}/stories.md" "| S1 | Ver el listado | 🟢 LISTO |" "stories-ready: criterios + frame + sin dudas → LISTO"
has "${INTAKE}/stories.md" "| S2 | Ver el histórico | 🚧 BLOQUEADA (bloqueada por duda #1) |" "stories-ready: duda que bloquea → BLOQUEADA (sin degradar por criterios: ya está en Jira)"
has "${INTAKE}/stories.md" "| S3 | Exportar | 🚧 BLOQUEADA (bloqueada por duda #1) |" "stories-ready: la duda que la bloquea gana"
node "${ROOT}/scripts/stories-ready.mjs" "${INTAKE}" | grep -q "Sin cambios de readiness" && ok "stories-ready: idempotente" || fail "stories-ready: no es idempotente"
node "${ROOT}/scripts/roadmap-gen.mjs" "${INTAKE}" >/dev/null 2>&1
[ "$(grep -o 'class="block b-block"' "${INTAKE}/roadmap-mvp.html" | wc -l | tr -d ' ')" = "2" ] && ok "roadmap: lee el Ready? calculado del índice (S2 y S3 bloqueadas)" || fail "roadmap: no tomó el Ready? del índice"

node "${ROOT}/scripts/status-render.mjs" "${INTAKE}" --date 2026-09-18 >/dev/null
has "${INTAKE}/STATUS.md" "- **Historias:** 2 cerradas / 3 totales · 3 en Jira" "status-render: conteos tras el sync"
has "${INTAKE}/STATUS.md" "- **Dudas:** 1 abiertas / 4 totales (1 aplicadas al PRD · 1 resueltas · 1 descartadas)" "status-render: dudas por estado"
has "${INTAKE}/STATUS.md" "updated: 2026-09-18" "status-render: fecha desde el agente"
has "${INTAKE}/STATUS.md" "fixture mínimo que ejercita" "status-render: conserva la prosa del PM"
node "${ROOT}/scripts/status-render.mjs" "${INTAKE}" >/dev/null
[ "$(grep -c '^<!-- argos:auto -->' "${INTAKE}/STATUS.md")" = "1" ] && ok "status-render: idempotente (un solo bloque auto)" || fail "status-render: duplicó el bloque auto"

node "${ROOT}/scripts/intake-lint.mjs" "${INTAKE}" > "${TMP}/lint.out" && ok "intake-lint: fixture sin errores" || fail "intake-lint: el fixture no debería tener errores"
has "${TMP}/lint.out" "roadmap: todas las historias de las fases existen" "intake-lint: cruza roadmap ↔ índice"
node "${ROOT}/scripts/index-update.mjs" "${DATA}" >/dev/null
has "${DATA}/INDEX.md" "| 1 / 4 | 2 / 3 |" "INDEX: refleja las 2 cerradas tras el sync"

node "${ROOT}/scripts/dashboard-gen.mjs" "${INTAKE}" >/dev/null
has "${INTAKE}/dashboard.html" "cdn.jsdelivr.net/npm/mermaid" "dashboard: renderiza el .mmd en el navegador cuando no hay PNG"
has "${INTAKE}/dashboard.html" 'class="mermaid"' "dashboard: embebe la fuente Mermaid"

node "${ROOT}/scripts/findings-scan.mjs" "${INTAKE}" --brain "${ROOT}/tests/fixtures/brain" > "${TMP}/scan.out"
has "${TMP}/scan.out" "1 sin registrar en el decision-log" "findings-scan: detecta el finding no registrado"
hasnt "${TMP}/scan.out" "RQ-260801-unrelated" "findings-scan: ignora findings de otros intakes"
hasnt "${TMP}/scan.out" "RQ-260905-already-logged" "findings-scan: omite los ya citados en el decision-log"
node "${ROOT}/scripts/findings-scan.mjs" "${INTAKE}" --brain "${ROOT}/tests/fixtures/brain" --apply --date 2026-09-18 >/dev/null
has "${INTAKE}/decision-log.md" "| 5 | **Reconciliación con el cerebro:** La exportación a Excel se quitó" "findings-scan --apply: agrega la fila con el id siguiente"
has "${INTAKE}/decision-log.md" "| cerebro findings/RQ-260910-sample-export-dropped.md | abierta |" "findings-scan --apply: fuente y estado"
node "${ROOT}/scripts/findings-scan.mjs" "${INTAKE}" --brain "${ROOT}/tests/fixtures/brain" > "${TMP}/scan2.out"
has "${TMP}/scan2.out" "0 sin registrar" "findings-scan: idempotente tras aplicar"

node "${ROOT}/scripts/tc-draft.mjs" "${INTAKE}" >/dev/null
has "${INTAKE}/test-cases-draft.csv" '"TC-D01","S1 · Ver el listado","Abre el listado","Dado un asesor con datos, cuando abre el listado","entonces ve sus filas.","Media","","SO-101",""' "tc-draft: criterio → caso borrador con las columnas del QA"
has "${INTAKE}/test-cases-draft.csv" '"Sí","SO-103","CA-01"' "tc-draft: historia bloqueada → sin confirmar + CA"

node "${ROOT}/scripts/dudas-add.mjs" "${INTAKE}" "${ROOT}/tests/fixtures/dudas-comentarios.json" --date 2026-09-18 --section "Comentarios de stakeholders · 2026-09-18" > "${TMP}/da.out"
has "${TMP}/da.out" "1 duda(s) agregadas" "dudas-add: agrega la nueva con el id siguiente"
has "${TMP}/da.out" "1 ya existían" "dudas-add: no duplica la que ya estaba"
has "${INTAKE}/decision-log.md" "## Comentarios de stakeholders · 2026-09-18" "dudas-add: sección propia"
node "${ROOT}/scripts/dudas-add.mjs" "${INTAKE}" "${ROOT}/tests/fixtures/dudas-comentarios.json" --date 2026-09-18 | grep -q "todas ya registradas" && ok "dudas-add: idempotente" || fail "dudas-add: volvió a agregar"

[ "$(node "${ROOT}/scripts/confluence-body.mjs" "${INTAKE}" --title)" = "Intake de muestra · PRD v1.2" ] && ok "confluence-body: título con versión" || fail "confluence-body: título inesperado"
node "${ROOT}/scripts/confluence-body.mjs" "${INTAKE}" > "${TMP}/conf.md"
has "${TMP}/conf.md" "No editar esta página" "confluence-body: nota de procedencia"
hasnt "${TMP}/conf.md" "capability: sample-capability" "confluence-body: sin frontmatter"
hasnt "${TMP}/conf.md" "<!--" "confluence-body: sin comentarios guía"

[ -f "${INTAKE}/avance-summary.json" ] && ok "avance: escribe avance-summary.json" || fail "avance: falta avance-summary.json"
( cd "${DATA}" && git init -q && git add -A && git -c user.email=t@t -c user.name=t commit -q -m base ) 2>/dev/null
node "${ROOT}/scripts/status-update.mjs" "${INTAKE}" --date 2026-09-18 > "${TMP}/su.out"
has "${INTAKE}/updates/2026-09-18.md" "2/3 historias entregadas" "status-update: TL;DR con DoD"
has "${INTAKE}/updates/2026-09-18.md" "Cierre estimado **09-oct** (85% de probabilidad)" "status-update: pronóstico desde avance-summary"
has "${INTAKE}/updates/2026-09-18.md" "## Bloqueos" "status-update: sección de bloqueos"
has "${INTAKE}/updates/2026-09-18.md" "SO-103" "status-update: la bloqueada aparece"
perl -0pi -e 's/(  \*Como\* asesor \*quiero\* ver el listado \*para\* consultar\.\n)/$1\n  - Dado un asesor sin datos, cuando abre el listado, entonces ve el estado vacío.\n/' "${INTAKE}/jira-preview.md"
node "${ROOT}/scripts/jira-diff.mjs" "${INTAKE}" --write --date 2026-09-18 > "${TMP}/jd.out"
has "${TMP}/jd.out" "1 con la definición cambiada" "jira-diff: detecta la historia cuyo criterio cambió tras crearse"
has "${INTAKE}/jira-updates.md" "**+ criterio:** Dado un asesor sin datos, cuando abre el listado, entonces ve el estado vacío." "jira-diff: delta por ticket con el criterio nuevo"

node "${ROOT}/scripts/test-map.mjs" "${INTAKE}" >/dev/null
has "${INTAKE}/test-map.md" "| 1. Listado | 2 | 1 | SO-101 | 🟢 |" "test-map: sección mapeada por key en el CSV"
has "${INTAKE}/test-map.md" "| 2. Histórico | 1 | 1 | SO-102 | 🟠 1 sin confirmar |" "test-map: S<n> resuelto a key + sin confirmar"
has "${INTAKE}/test-map.md" "| 3. Exportar | 1 | 0 | — | ⚪ sin historia |" "test-map: sección sin historia"
node "${ROOT}/scripts/test-map.mjs" "${INTAKE}" >/dev/null
[ "$(grep -c '^<!-- argos:auto -->' "${INTAKE}/test-map.md")" = "1" ] && ok "test-map: idempotente" || fail "test-map: duplicó el bloque auto"

bash "${ROOT}/scripts/prd-check.sh" "${ROOT}/tests/fixtures/PRD-breadboard-stage.md" --stage=breadboard > "${TMP}/bb.out" || true
has "${TMP}/bb.out" 'se extiende a "Logalty"' "prd-check --stage=breadboard: detecta el → externo sin resolver"
hasnt "${TMP}/bb.out" 'se extiende a "Excel"' "prd-check --stage=breadboard: el → externo cubierto en §4 pasa"
hasnt "${TMP}/bb.out" "falta sección: Preguntas abiertas" "prd-check --stage=breadboard: no exige etapas posteriores"
bash "${ROOT}/scripts/prd-check.sh" "${ROOT}/tests/fixtures/PRD-breadboard-stage.md" --stage=encuadre --strict >/dev/null && fail "prd-check --strict: debería fallar por el marcador [POR DEFINIR]" || ok "prd-check --strict: el marcador [POR DEFINIR] bloquea"
has "${TMP}/bb.out" "1 marcador(es) [POR DEFINIR]" "prd-check: cuenta los marcadores de ambigüedad"

node "${ROOT}/scripts/prd-diff.mjs" --old "${ROOT}/tests/fixtures/PRD-diff-old.md" --new "${ROOT}/tests/fixtures/data-repo/intakes/sample-intake/PRD-sample-intake.md" > "${TMP}/diff.out"
has "${TMP}/diff.out" "\`Métricas\`" "prd-diff: sección quitada"
has "${TMP}/diff.out" "\`Objetivo / Resultado\`" "prd-diff: sección modificada"
has "${TMP}/diff.out" "**Criterios de aceptación**" "prd-diff: detecta criterios que cambian"
has "${TMP}/diff.out" "- MODIFIED: \`S1\`" "prd-diff: historia modificada"
node "${ROOT}/scripts/prd-diff.mjs" --old "${INTAKE}/PRD-sample-intake.md" --new "${INTAKE}/PRD-sample-intake.md" | grep -q "0 cambio" && ok "prd-diff: idéntico → 0 cambios" || fail "prd-diff: falso positivo en PRD idéntico"

# ---- T6 · dudas por Slack (al final: cambia el estado de la duda #1 que los checks anteriores necesitan abierta)
node "${ROOT}/scripts/dudas-publish.mjs" "${INTAKE}" --ids 1 > "${TMP}/pub.out"
has "${TMP}/pub.out" "1 duda(s) para publicar en #squad-petra-interno" "dudas-publish: canal default del squad"
has "${TMP}/pub.out" "*Duda #1 · Intake de muestra" "dudas-publish: título con el #"
has "${TMP}/pub.out" "<https://olelife.atlassian.net/browse/SO-102|SO-102> Ver el histórico" "dudas-publish: historias con link a Jira en mrkdwn"
has "${TMP}/pub.out" "la ratifica el PM con ✅" "dudas-publish: consigna de ratificación"
node "${ROOT}/scripts/dudas-resolve.mjs" "${INTAKE}" "${ROOT}/tests/fixtures/slack-permalink.json" --date 2026-09-18 >/dev/null
has "${INTAKE}/decision-log.md" "PRD §5 · Slack #squad-petra-interno · https://olelifeworkspace.slack.com/archives/C09C4UED6JJ/p1785948368848429" "dudas-resolve: permalink agregado a la Fuente"
node "${ROOT}/scripts/dudas-publish.mjs" "${INTAKE}" --ids 1 | grep -q "ninguna duda para publicar" && ok "dudas-publish: omite la duda que ya tiene hilo" || fail "dudas-publish: volvió a publicar la #1"
node "${ROOT}/scripts/dudas-resolve.mjs" "${INTAKE}" "${ROOT}/tests/fixtures/slack-propuesta.json" --date 2026-09-18 >/dev/null
node "${ROOT}/scripts/status-render.mjs" "${INTAKE}" >/dev/null
has "${INTAKE}/STATUS.md" "1 propuesta en Slack esperando ✅" "status-render: cuenta la propuesta sin ratificar"
node "${ROOT}/scripts/stories-ready.mjs" "${INTAKE}" >/dev/null
has "${INTAKE}/stories.md" "| S3 | Exportar | 🚧 BLOQUEADA (bloqueada por duda #1) |" "stories-ready: una propuesta sin ✅ sigue bloqueando"
node "${ROOT}/scripts/status-update.mjs" "${INTAKE}" --date 2026-09-19 >/dev/null
has "${INTAKE}/updates/2026-09-19.md" "⏳ *propuesta en Slack, falta ✅ del PM*" "status-update: pide la ratificación"
node "${ROOT}/scripts/dudas-resolve.mjs" "${INTAKE}" "${ROOT}/tests/fixtures/slack-resuelta.json" --date 2026-09-18 > "${TMP}/res.out"
has "${TMP}/res.out" "#1 → resuelta" "dudas-resolve: resuelta con sustento"
has "${INTAKE}/decision-log.md" "**Resuelta por Ana Roncal en Slack (2026-09-18, [hilo](https://olelifeworkspace.slack.com/archives/C09C4UED6JJ/p1785948368848429)):** «los últimos 12 meses, con paginación» — ratificado ✅ por Alexander Cerna." "dudas-resolve: cita textual + autor + fecha + permalink + ✅"
node "${ROOT}/scripts/stories-ready.mjs" "${INTAKE}" >/dev/null
has "${INTAKE}/stories.md" "| S3 | Exportar | 🟢 LISTO |" "stories-ready: resuelta la duda, S3 queda LISTO"
node "${ROOT}/scripts/dudas-resolve.mjs" "${INTAKE}" "${ROOT}/tests/fixtures/slack-resuelta.json" --date 2026-09-18 | grep -q "ya estaban así" && ok "dudas-resolve: idempotente" || fail "dudas-resolve: reescribió sin cambios"

echo
[ "${rc}" -eq 0 ] && echo "✓ smoke OK" || { echo "✗ smoke con fallas" >&2; exit 1; }
