# ole-argos-product 🗿

**Argos para el equipo de Producto.** Un plugin de Claude Code que te ayuda a escribir PRDs
estandarizados de Olé: funda el análisis en el conocimiento ya curado (cerebro, read-only),
**acota el alcance**, desglosa **épicas → historias**, y deja **explícito lo que falta definir** —
sin sobrecargarte de preguntas.

## Qué hace
| Comando | Hace |
|---|---|
| `/argos-product:prd` | crea o refina un **PRD suelto** (`PRD-<slug>.md` local), como recorrido guiado por etapas (encuadre → breadboard → diseño → cierre, RFC-003) o en una pasada |
| `/argos-product:prd-mercado` | PRD de **adaptación de mercado** (llevar una capability a otro país), con lint y export a Word |
| `/argos-product:intake` | gestiona un **intake versionado** en el repo de datos: PRD + **Figma congelado** + decision-log + historias + dashboard + roadmap + handoff idempotente a Jira (con CSV de importación como fallback) + `sync` del estado real de Jira a `stories.md` + `reconciliar` findings del cerebro → decision-log + `tests` (casos de prueba del QA) |
| `/argos-product:avance` | tablero de **avance** y proyección de cierre, corte fresco desde Jira, publicado como Artifact |
| `/argos-product:rag` | memoria histórica de Producto (Bedrock KB, `Retrieve` + redacción con citas al markdown fuente); `similares` y `auditar` se enganchan en `/intake` |
| `/argos-product:setup` | clona el cerebro recortado (read-only) y el repo de datos `ole-argos-product-data` (read-write) |
| `/argos-product:version` · `update` | versión instalada vs publicada · actualizar el plugin |

Lee el cerebro **solo para fundamentar** (domain, flows, findings, glossary); **nunca lo modifica**.

## Instalar
```bash
claude plugin marketplace add Olelife/ole-argos-product
claude plugin install argos-product@argos-product-mkt --scope project
# reiniciá Claude Code, luego:  /argos-product:setup
```

## Modelo (importante) — 3 piezas
```
  🧩 argos-product (motor, plugin)  ──escribe──►  📦 ole-argos-product-data (datos, repo)
        │ lee (read-only)                               │ handoff: cada historia → un RQ
        ▼                                               ▼
  🧠 ole-argos-brain (cerebro)  ◄──escribe (al cerrar el RQ)──  🧩 argos (motor Dev) /argos:spec
```
- **Producto escribe SOLO** en `ole-argos-product-data`; **lee** el cerebro read-only.
- El **cerebro** describe el sistema *as-built* (código). Un intake es *to-be* tentativo: **cruza al cerebro solo cuando su RQ se implementa y cierra**.

> **Permisos:** los miembros de Producto deben tener acceso **read-only** a `Olelife/ole-argos-brain`.
> Ese permiso es la garantía dura de que Producto no puede modificar el cerebro; el plugin, además,
> no tiene ninguna skill que lo escriba.

Standard del PRD: `standards/prd.md`. Template: `templates/prd.md`. Ejemplo: `examples/`. Historial: `CHANGELOG.md`.

## Desarrollo del Motor
El Motor cambia por PR a `main` + tag (`scripts/release.sh <patch|minor|major>` bumpea `plugin.json` y `marketplace.json` coherentes).
El CI corre sintaxis, shellcheck, coherencia de versión, `node --test tests/` y `bash tests/smoke.sh` (todos los generadores sobre el intake fixture de `tests/fixtures/`).
Validadores: `prd-check.sh` (PRD vs standard), `prd-lint.sh` (PRD de mercado), `intake-lint.mjs` (coherencia del intake). Los scripts leen `stories.md` / `decision-log.md` **por nombre de columna** y el frontmatter de `STATUS.md` admite bloques anidados y listas — ver `scripts/lib/md.mjs`.
