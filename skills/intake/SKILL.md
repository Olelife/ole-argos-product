---
name: intake
description: Gestiona el ciclo de vida de un intake de producto VERSIONADO en el repo de datos (ole-argos-product-data) — a partir de un PRD borrador + Figma. A diferencia de /prd (que produce un archivo local suelto), intake persiste, CONGELA el Figma por versión, mantiene un decision-log de dudas↔respuestas, controla estados (intake/dudas/historias) y genera un dashboard. Úsalo cuando Producto quiera abrir o hacer seguir un intake vivo — disparadores como "nuevo intake de…", "actualizá el intake X", "respondé la duda N de X", "subí la versión del PRD/Figma de X", "mostrame el intake X", "aprobá el intake X", "/argos-product:intake". Reutiliza el standard y el template de /prd para redactar el PRD dentro del intake.
---

# /argos-product:intake — intake versionado

Convierto un PRD borrador + Figma en un **intake vivo y versionado** que se refina en el tiempo,
sin contaminar el cerebro (es material *to-be*, tentativo). Persona y reglas: `CONSTITUTION.md`.
Qué es un buen PRD: `standards/prd.md` (lo reutilizo para el PRD de adentro).

> Narro en voz de **Argos**, sobrio y mínimo. La **fuente de verdad son los markdown** del intake;
> el dashboard es presentación regenerable. **Nunca escribo el cerebro** (solo lo leo para fundamentar).

## Dónde vive todo (3 piezas)
- **Motor** = este plugin (read-only, se instala).
- **Datos** = `ole-argos-product-data` (repo, clonado por `/argos-product:setup` en `repos/`). **Acá escribo.**
- **Cerebro** = `ole-argos-brain` (read-only). Un intake **solo cruza al cerebro cuando su RQ se implementa y cierra** (lo hace Dev, no yo).

Ruta base de datos: `${OLE_REPOS:-<workspace>/repos}/ole-argos-product-data`. Si no está, pido correr `/argos-product:setup`.

## Verbos (detecto la intención del pedido)

### `listar` / `abrir` — ver todos los intakes y elegir uno
Disparadores: `/argos-product:intake` **sin slug**, "listar intakes", "qué intakes hay", "abrí un intake", "abrí el tablero de intakes".
1. `node "${CLAUDE_PLUGIN_ROOT}/scripts/index-update.mjs" "<repo-datos>"` (regenera `INDEX.md`) y `node "${CLAUDE_PLUGIN_ROOT}/scripts/index-widget.mjs" "<repo-datos>"` (genera `INDEX-widget.html`).
2. **Leo `INDEX-widget.html` y lo emito con `show_widget`**: una tarjeta por intake (título, estado, dudas abiertas, historias, versiones, última actualización) con botones **Abrir** (→ verbo `ver`) y **Tickets** (→ verbo `tickets`), que retoman por `sendPrompt`. Así el dev elige sin recordar el slug.
- Si no hay intakes, el widget muestra el estado vacío. Sirve como pantalla de entrada del skill cuando se invoca sin argumentos.

### `nuevo` — abrir un intake
Disparadores: "nuevo intake de…", "abrí el intake …", con un PRD (archivo/link) y/o un Figma.
1. **Slug**: kebab-case corto y estable (ej. `cotizaciones-petra`). Confirmo si es ambiguo.
2. **Scaffold**: `bash "${CLAUDE_PLUGIN_ROOT}/scripts/intake-new.sh" <slug> "<título>"` — crea `intakes/<slug>/` desde los templates (STATUS, PRD, decision-log, stories, analysis/, figma/).
3. **Congelar Figma** (ver *Congelado del Figma* abajo) → `figma/v1/`.
4. **Redactar el PRD**: aplico el flujo de `/prd` (standard + `templates/prd.md`) sobre `intakes/<slug>/PRD-<slug>.md`, fundado en el cerebro (read-only) y anclado a una `capability`.
5. **Auditoría de inconsistencias** (obligatoria) → `decision-log`: barro sistemáticamente (a) contradicciones **internas** del PRD/insumo (tablas que se contradicen, criterios que no cubren una regla, numeración rota, valores fuera de rango) y (b) **cruces PRD↔Figma** (lo que dice el texto vs lo que muestran los frames congelados: umbrales, campos, textos, estados). **Toda** contradicción, gap de dato o ambigüedad va como fila `abierta` con un default propuesto. Si la aplico al PRD, queda `aplicada-al-PRD` — **nunca la resuelvo en silencio** (ver Reglas). Checklist de cruce: cada regla numérica y cada campo del Figma debe existir/coincidir en el PRD y en el modelo.
   **Dirección de la fuente de verdad:** el **PRD manda el alcance**. Si un frame del Figma no tiene correlato en el PRD, es un **gap de alcance** → fila `abierta` ("¿entra al alcance o es fuera?"), **nunca** una historia nueva. El Figma **sí** puede detallar comportamiento no escrito en el PRD (validaciones, estados, textos) — eso enriquece una historia existente, no expande el alcance.
6. **Diagramas** (`analysis/`): escribo los `.mmd` (casos de uso, componentes, actividad E2E, actividad del cotizador, estados) y los renderizo con `bash "${CLAUDE_PLUGIN_ROOT}/scripts/diagrams-gen.sh" "intakes/<slug>/analysis"` (best-effort: si `mmdc` no está, dejo los `.mmd` y aviso). El **diagrama de casos de uso refleja el alcance del PRD** (el Figma ilustra, no agrega casos). El dashboard los embebe.
7. **Historias** (alcance = **solo PRD**): desgloso épica → historias (`EP-<SLUG>-S<n>`) derivadas **exclusivamente del alcance del PRD**; el Figma **ancla e ilustra** el comportamiento de esas historias, pero **no agrega historias** que el PRD no tenga. `stories.md`, estado `propuesta`.
8. **STATUS** = `draft`. **Dashboard** + **INDEX** (ver abajo).

### `duda` — resolver / mover una duda
Disparadores: "respondé la duda N de X", "la duda N es …", "descartá la duda N".
- Actualizo la fila en `decision-log.md`: respuesta + fecha, estado `resuelta` (o `descartada`).
- Si la respuesta cambia el PRD/historias, lo aplico y marco la duda `aplicada-al-PRD`.
- Regenero dashboard + INDEX.

### `version` — nueva versión del PRD/Figma
Disparadores: "subí el PRD v2.3", "hay nuevo Figma", "re-analizá X".
- **Figma**: congelo en `figma/vN+1/` (nunca piso vN) y **diffeo** `structure.json` contra la versión previa → reporto frames añadidos/eliminados/redimensionados; re-capturo los que cambiaron.
- **PRD**: actualizo el PRD y anoto en el decision-log qué dudas resolvió/creó esta versión.
- **Re-auditoría**: vuelvo a correr la auditoría de inconsistencias (paso 5 de `nuevo`) sobre lo que cambió; nuevas contradicciones → filas `abierta`.
- Regenero diagramas afectados (`analysis/`). Bump `prd_version`/`figma_version` en STATUS. Regenero dashboard + INDEX.

### `ver` — dashboard amigable
Disparadores: "mostrame el intake X", "cómo va X".
- `node "${CLAUDE_PLUGIN_ROOT}/scripts/dashboard-gen.mjs" <intakes/<slug>>` → escribe `dashboard.html`.
- **Lo publico como Artifact** (compartible) usando ese HTML. El markdown sigue siendo la verdad.

### `aprobar` — cerrar el borrador y cortar historias
Disparadores: "aprobá el intake X", "está listo X".
1. Corro `bash "${CLAUDE_PLUGIN_ROOT}/scripts/prd-check.sh" intakes/<slug>/PRD-<slug>.md` — no apruebo con obligatorios en hueco ni alcance sin acotar ni dudas `abierta` que cambien alcance.
2. **Genero el gate** `intakes/<slug>/jira-preview.md` desde `${CLAUDE_PLUGIN_ROOT}/templates/jira-preview.md`, poblándolo con las historias del PRD §6 (título, descripción Como/Quiero/Para + criterios) y los **links de Figma** (mapeo frame→node-id de `figma/vN/structure.json`). El dev revisa/edita ese archivo — **es la fuente desde la que se crea**.
3. **STATUS** = `ready`. Congelo la versión del PRD/Figma.
4. **Handoff a Jira — con GATE + IDEMPOTENCIA.** Espero tu **confirmación explícita** antes de crear nada. La escritura usa el **MCP de Atlassian**; si no está disponible en el runtime, **no invento**: dejo `jira-preview.md` como fallback listo para pegar (ver [[atlassian-mcp-runtime-vs-cli]]). Nunca creo en masa sin tu OK.

### Creación idempotente (nunca duplica)
Cada issue lleva un **label único** de trazabilidad: la épica `intake-<slug>-epic`, cada historia `intake-<slug>-s<n>`. Antes de crear **cualquier** issue, chequeo **doble llave**:
1. **`stories.md`** (registro local): si esa fila ya tiene un `Jira` key → **no creo**, reutilizo ese key.
2. **JQL en Jira**: `project = <PROY> AND labels = "intake-<slug>-s<n>"` → si ya existe → **no creo**, vinculo el que hay y sincronizo `stories.md`.

Solo si **ambas** dan vacío, creo el issue **con** su label único, y **escribo el key de vuelta** en `stories.md` (columna Jira, estado `en-Jira`). Orden: **épica primero** (su key es el parent de las historias); si la épica ya existe por su label, reutilizo su key. Así, mandar la creación de una historia ya procesada es **no-op idempotente** (te devuelvo el key existente), tanto por-historia como en "crear todas".

### `tickets` / widget de creación
Disparadores: "mostrame los tickets", "widget de Jira de X".
1. Corro `node "${CLAUDE_PLUGIN_ROOT}/scripts/widget-gen.mjs" "intakes/<slug>" <proyecto>` → genera `intakes/<slug>/tickets-widget.html` **desde `stories.md`** (estado real).
2. **Leo ese archivo y lo emito con el widget de visualización** (`show_widget`), pasándolo como `widget_code`.
- Las historias con key de Jira se muestran con `✓ <key>` (botón deshabilitado); las pendientes con "Crear en Jira" que dispara la **creación idempotente** vía `sendPrompt` (doble llave). El detalle editable de cada historia vive en `jira-preview.md`; el estado, en `stories.md`. El widget es superficie regenerable.

## Congelado del Figma (procedimiento)
El congelado combina el MCP de Figma (lo llamo yo) + `figma-freeze.mjs` (mecánica). **Las URLs de screenshot del MCP son efímeras** → hay que descargar en el momento.
1. `get_metadata(fileKey)` → lista de frames top-level (name · node-id · tamaño).
2. **v1 = Figma completo** = **todos los frames de pantalla top-level** (vistas y estados). **Excluyo componentes sueltos** (botones, inputs, chips: nodos chicos —regla práctica ancho < 320px— o cuyo nombre es de componente, no de pantalla). En versiones siguientes, solo los frames que cambiaron (RFC-001).
3. Por frame: `get_screenshot(fileKey, nodeId)` → URL efímera.
4. Armo un JSON de captura `{fileKey, url, capturedAt, frames:[{nodeId,name,w,h,imageUrl}]}` y lo paso a
   `node "${CLAUDE_PLUGIN_ROOT}/scripts/figma-freeze.mjs" <intakes/<slug>/figma/vN> <captura.json>` → descarga `frames/*.png` (LFS), escribe `MANIFEST.md` y `structure.json`.
5. `capturedAt` lo paso yo (no uso relojes dentro de scripts de workflow).

## Reglas
- **Ninguna inconsistencia se resuelve en silencio.** Toda contradicción (interna o PRD↔Figma) o gap de dato va al `decision-log`, aunque proponga un default. Taparla callado en el PRD es anti-patrón.
- **Escribo SOLO en el repo de datos.** Nunca toco el cerebro (lo leo para fundamentar).
- **No apruebo** (`ready`) con alcance sin acotar u obligatorios con hueco.
- **Jira con gate**: jamás creo/muevo issues sin confirmación explícita tuya.
- **Cero secretos** en el intake (solo *nombres*).
- **El markdown es la verdad**; el dashboard/Artifact es presentación regenerable.
- **Commit del repo de datos**: al cerrar cada verbo, dejo el cambio commiteado en `ole-argos-product-data` con un mensaje claro (no push directo si el repo tuviera protección; hoy va a `main`).
