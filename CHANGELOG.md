# Changelog · argos-product (Motor de Producto)

Una sección por versión publicada (tag `vX.Y.Z`). El CI exige que la versión de `plugin.json` tenga su sección acá.

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
