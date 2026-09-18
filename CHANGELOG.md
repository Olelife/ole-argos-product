# Changelog · argos-product (Motor de Producto)

Una sección por versión publicada (tag `vX.Y.Z`). El CI exige que la versión de `plugin.json` tenga su sección acá.

## v1.19.0 — Cerrar el círculo hacia afuera: updates, PRD → Jira, evidencia, comentarios, Confluence, TCs, lite

Tanda T5 (2026-09-18), segunda mitad del bench de mercado.

- **`status-update.mjs` + verbo `update`**: `updates/<fecha>.md` para stakeholders desde el intake y su git — TL;DR con DoD y P85, **release notes** en lenguaje de negocio (derivadas del *Como/quiero/para*), bloqueos, próximo por prioridad, decisiones pendientes, pronóstico. `avance-gen` deja `avance-summary.json` para alimentarlo. Referencia: stakeholder-comms del plugin PM de Anthropic, release notes de Productboard Spark.
- **`jira-diff.mjs`** (PRD → Jira, la dirección que faltaba): historias ya creadas cuya definición cambió desde su alta (criterios +/−, frames) → `jira-updates.md` con el delta por ticket y la descripción nueva; se aplica con `editJiraIssue` una por una y con gate. Referencia: sync de dos vías de Productboard.
- **Evidencia con procedencia** en §1 (template, standard, `prd-check` avisa si no cita nada; `review` la puntúa). Referencia: Enterpret, BuildBetter.
- **Verbo `comentarios`** + `dudas-add.mjs`: comentarios de los stakeholders en los Artifacts publicados → dudas del decision-log (idempotente por fuente+texto, sección propia). Referencia: multiplayer de Spark/Notion.
- **Verbo `publicar`** + `confluence-body.mjs`: el PRD en Confluence como copia regenerable con nota de procedencia; `confluence_page_id` en STATUS.
- **`tc-draft.mjs`**: un caso de prueba borrador por criterio Dado/cuando/entonces, con las columnas del CSV del QA. Referencia: test scenarios de Figflow.
- **`/prd --lite`** (`templates/prd-lite.md`, `lite: true`): one-pager de 5 secciones para bugfix/ajuste; `prd-check` lo valida como tal. Referencia: Quick Flow de BMAD.
- `rag-sync` indexa `updates/`, `jira-updates.md`, `changelog-prd.md` y `review.md`.

## v1.18.0 — Medir y cuidar: Monte Carlo, Definition of Ready calculada, marcadores, review, deltas del PRD

Tanda T4 (2026-09-18), lo que el bench de mercado mostró que otros hacen mejor y sí vale tomar.

- **Monte Carlo en `/avance`** (`avance-gen.mjs`): con `throughputWeekly` (historias llegadas a la meta por semana, 8–12 semanas) corre 10.000 corridas con semilla fija por corte y muestra **P50/P70/P85/P95** con fecha, histograma y, si el STATUS tiene `target_date`, la probabilidad de llegar con semáforo. Sin serie quedan los escenarios de antes. Referencia: apps de pronóstico probabilístico para Jira.
- **Definition of Ready calculada** (`stories-ready.mjs`): el `Ready?` de `stories.md` deja de ser un emoji a mano — 🟢 criterios Dado/cuando/entonces + frame de Figma + sin dudas abiertas · 🟡 con dudas · 🟠 falta criterio o frame · 🚧 bloqueada por duda o dependencia sin cerrar. El roadmap lo lee del índice. Referencia: el "readiness checker" de Rovo.
- **Marcadores de ambigüedad** `[POR DEFINIR: pregunta — dueño]` en el cuerpo del PRD: `prd-check` los cuenta, bloquean el `ready` y `--strict`; `aprobar` exige cero. Referencia: `[NEEDS CLARIFICATION]` de Spec Kit.
- **`/prd review`**: lectura cualitativa con rúbrica de 5 dimensiones (claridad · alcance · verificabilidad · evidencia · prioridad), puntaje /25 con cita del PRD por dimensión, top 3 correcciones y riesgos que el PRD no nombra (`templates/prd-review.md`). Referencia: la crítica "nivel CPO" de ChatPRD.
- **Prioridad P0/P1/P2** en `stories.md`; `intake-lint` avisa cuando más de la mitad es P0 (si todo es P0, nada es P0). Referencia: plugin oficial de PM de Anthropic.
- **`prd-diff.mjs`**: deltas estructurales ADDED / MODIFIED / REMOVED entre versiones del PRD (secciones, reglas `RN-xx`, criterios, historias/casos de uso), desde git; `--write` acumula `changelog-prd.md`. El verbo `version` lo corre. Referencia: delta markers de OpenSpec.
- Smoke cubre Monte Carlo determinista, readiness, marcadores y diff.

## v1.17.0 — Loop con Dev, RAG fase 2, flujo guiado (RFC-003)

Tanda T3 del plan de mejora (2026-09-18). Lo que Dev decide contra el código vuelve al intake; el RAG deja de depender de una API que la KB no soporta; el PRD deja de ser una plantilla y pasa a ser un recorrido.

- **Verbo `reconciliar`** en `/intake` (`scripts/findings-scan.mjs`): cruza los findings del cerebro (solo lectura) con las keys de Jira, la capability y el slug del intake, omite los que el decision-log ya cita y, con `--apply`, agrega una fila `abierta` por finding. Sobre `modulo-poliza-petra` encontró 71 findings de septiembre sin registrar. El recorte del cerebro (`setup.sh`, `config.example.conf`) suma `findings/`.
- **RAG fase 2**: `scripts/rag-retrieve.sh` (Retrieve sobre la KB managed, filtros por fuente/slug/tipo derivados de la ruta de S3); el skill `/rag` redacta a partir de los chunks — la KB managed no soporta `RetrieveAndGenerate`. `similares` es pre-flight de `/intake nuevo` y `auditar` paso opcional de `aprobar`. `rag-sync.mjs` reintenta el ingestion job ante `ConflictException` (dos repos sincronizando a la vez).
- **Dashboard dibuja los `.mmd` en el navegador** (Mermaid por CDN, tema Olé) cuando no hay PNG: el intake ya no depende de Chrome/npx en la máquina que lo generó. `diagrams-gen.sh` usa `mmdc` local si existe, `npx` contra el registry público y detecta Chrome en Linux.
- **RFC-003 · flujo guiado**: `/prd` en cuatro etapas (encuadre → breadboard → diseño → cierre) con `stage:`/`path:` en el frontmatter y retoma donde quedó; §5.0 **mapa módulo → pantalla → acción** en el template (compuerta de alcance, antes del Figma); `prd-check.sh --stage=<etapa>` valida solo lo que la etapa exige y exige que todo `→ fuera del mapa` esté en §4 o §9; sección *Orden de trabajo* + EARS en el standard. Sin flag, `prd-check` se comporta como siempre.
- **Verbo `tests`** en `/intake` (`scripts/test-map.mjs`): `test-cases.csv` del QA → `test-map.md` con la matriz sección ↔ historia (TCs, Alta, «sin confirmar», cobertura) y mapeo manual que se conserva.
- Smoke test cubre findings-scan (detección, apply, idempotencia), test-map, Mermaid en el dashboard y `prd-check --stage`.

## v1.16.0 — Ciclo que cierra: sync con Jira, STATUS generado, lint del intake, CSV de importación

Tanda T2 del plan de mejora (2026-09-18). Los estados de las historias nunca llegaban a `cerrada` porque la verdad vivía en Jira y nada la traía de vuelta; los conteos del cuerpo de STATUS se escribían a mano y quedaban viejos.

- **Verbo `sync`** en `/intake` (`scripts/stories-sync.mjs`): escribe en `stories.md` el `Estado Jira` real y el key (reconocido por el label `intake-<slug>-s<n>`), deriva `Estado` a `en-Jira`/`cerrada` según `jira_goal_status`, reporta movimientos, historias sin dato e issues sin fila, y sugiere el estado del intake. `/avance` corre el mismo sync con su snapshot antes de commitear.
- **`STATUS.md` con bloque auto** (`scripts/status-render.mjs`): dudas por estado, historias cerradas/en Jira, versiones con links de Figma, épicas, entregables y base técnica entre `<!-- argos:auto -->` … `<!-- /argos:auto -->`; la prosa del PM queda fuera. `--date` actualiza `updated:`.
- **`scripts/intake-lint.mjs`**: esquema del frontmatter (obligatorias, `status` válido, keys de Jira, URLs), estados de dudas e historias, dudas citadas que existen, roadmap ↔ índice, PRD §6 ↔ `stories.md`, snapshots de Figma. Errores salen 1; `--strict` también con avisos. El verbo `aprobar` no aprueba con errores.
- **`prd-check.sh` real**: frontmatter, "Resumen para Dev", criterios Dado/cuando/entonces por historia, dueño en las preguntas abiertas, `ready` sin huecos ni `open`; deriva los PRDs de adaptación de mercado a `prd-lint.sh`; `--strict` para CI.
- **`scripts/jira-import.mjs`**: `jira-import.csv` desde `jira-preview.md` (solo pendientes, labels únicos, épica o `Parent` = key del STATUS, Markdown → wiki de Jira). Codifica el fallback que antes se armaba a mano cuando el MCP de Atlassian no responde.
- Decision-logs con **varias tablas** (una por tanda) ahora se suman en todos los conteos (`DUDAS()`); estados con negrita/espacios se normalizan (`aplicada al PRD` = `aplicada-al-PRD`).
- El verbo `avance` sale de `/intake` (deriva a `/argos-product:avance`, anunciado en v1.12).
- Template de STATUS con el bloque auto; smoke test cubre los 5 scripts nuevos.

## v1.15.0 — Confiabilidad: parser, contrato de columnas, CI

Tanda T1 del plan de mejora (2026-09-18). Nada de lo que prometían los generadores se sostenía contra los 9 intakes reales; esta versión lo arregla y pone la red que lo hubiera atrapado.

- **Parser de frontmatter** (`scripts/lib/md.mjs`): bloques anidados (`figma_url:` por sección), listas `[a, b]` y `- a`, comentarios al final. Antes `figma_url` llegaba vacío en los 3 intakes del Módulo Póliza y `jira_epics` como string.
- **Contrato de columnas por nombre**: `dashboard`, `INDEX`, `roadmap` y `tickets-widget` leen `stories.md` y `decision-log.md` por nombre de columna (`Historia`, `Título`, `Estado`, `Estado Jira`, `Ready?`, `Jira`, `RQ`; `#`, `Duda`, `Fuente`, `Estado`, `Respuesta`, `Fecha`), no por posición. Antes cada script asumía un orden distinto y "Historias cerradas" daba 0/N en todos los intakes.
- **Historia cerrada** = `Estado: cerrada` **o** `Estado Jira` igual a `jira_goal_status` del STATUS.
- **Host de Jira parametrizado** (`jira_base` en STATUS · `OLE_JIRA_BASE` · default `olelife.atlassian.net`) en widget, dashboard y avance. Cierra el finding `widget-gen-jira-link-domain` (abierto desde v1.7).
- **Prefijo de título del widget** desde `jira_title_prefix` (antes `[Petra][Cotizaciones]` hardcodeado); proyecto desde `jira_project`.
- Dashboard: links de Figma por sección y a cada key de Jira. Avance: el footer cita `/argos-product:avance`.
- Skill `prd`: nombres reales del MCP de Atlassian. Constitución y README listan los 8 skills.
- **CI** (`.github/workflows/ci.yml`): sintaxis (bash · node · python), shellcheck, JSON, coherencia versión↔marketplace↔tag↔CHANGELOG, hooks→scripts, **tests unitarios** del parser y **smoke test** de todos los generadores sobre un intake fixture (`tests/`).
- `scripts/release.sh`: bump coherente de `plugin.json` + `marketplace.json` (mismo patrón que el Motor Dev). `CODEOWNERS`.
- **Hooks**: `version-check.sh` al arrancar (avisa si hay versión nueva) y `data-doctor.sh` (repo de datos en rama ≠ main, atrás/adelante de origin, cambios sin commitear, PNG de Figma como punteros de LFS).

## v1.14.0
- Skill `/argos-product:prd-mercado`: standard, template, `prd-lint.sh` y export a Word/PDF para PRDs de adaptación de mercado (#20).

## v1.13.2 · v1.13.1
- `rag-sync.mjs`: `charset=utf-8` en ContentType y encode de headers no-ASCII para Bedrock KB (#19).

## v1.13.0
- Skill `/argos-product:rag`: POC RAG con Bedrock Knowledge Bases + `rag-sync.mjs` + workflow template (#17). Bucket real documentado (#18).

## v1.12.0
- Skill `/argos-product:avance` con contrato de frescura: cada corte se reconstruye desde Jira (#16).

## v1.11.0 · v1.10.0 · v1.9.0
- Intake: 4 reglas de contenido para la épica (#15) · sección `## Base técnica` opcional (#14) · 3 reglas de formato v3 para historias en Jira (#13).

## v1.8.0 · v1.7.0
- Verbo `avance` (tablero + proyección, #9) · verbo `roadmap` (RFC-002, #11) · el PRD manda el alcance, el Figma complementa (#7).

## v1.6.0 → v1.1.0
- Widget de índice de intakes (#6) · skills `update`/`version` (#5) · widget de tickets (#4) · handoff a Jira idempotente (#3) · auditoría de inconsistencias + diagramas (#2) · intakes versionados con Figma congelado, decision-log y dashboard (#1, RFC-001).

## v1.0.x
- Constitución inyectada por hook, standard y template de PRD Dev-first, reglas de cálculo en el PRD.
