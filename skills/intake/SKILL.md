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

### `nuevo` — abrir un intake
Disparadores: "nuevo intake de…", "abrí el intake …", con un PRD (archivo/link) y/o un Figma.
1. **Slug**: kebab-case corto y estable (ej. `cotizaciones-petra`). Confirmo si es ambiguo.
2. **Scaffold**: `bash "${CLAUDE_PLUGIN_ROOT}/scripts/intake-new.sh" <slug> "<título>"` — crea `intakes/<slug>/` desde los templates (STATUS, PRD, decision-log, stories, analysis/, figma/).
3. **Congelar Figma** (ver *Congelado del Figma* abajo) → `figma/v1/`.
4. **Redactar el PRD**: aplico el flujo de `/prd` (standard + `templates/prd.md`) sobre `intakes/<slug>/PRD-<slug>.md`, fundado en el cerebro (read-only) y anclado a una `capability`.
5. **Sembrar el decision-log**: cada inconsistencia/duda detectada → una fila `abierta` (con mi lectura y un default propuesto).
6. **Historias**: desgloso épica → historias (`EP-<SLUG>-S<n>`) en `stories.md`, estado `propuesta`.
7. **STATUS** = `draft`. **Dashboard** + **INDEX** (ver abajo).

### `duda` — resolver / mover una duda
Disparadores: "respondé la duda N de X", "la duda N es …", "descartá la duda N".
- Actualizo la fila en `decision-log.md`: respuesta + fecha, estado `resuelta` (o `descartada`).
- Si la respuesta cambia el PRD/historias, lo aplico y marco la duda `aplicada-al-PRD`.
- Regenero dashboard + INDEX.

### `version` — nueva versión del PRD/Figma
Disparadores: "subí el PRD v2.3", "hay nuevo Figma", "re-analizá X".
- **Figma**: congelo en `figma/vN+1/` (nunca piso vN) y **diffeo** `structure.json` contra la versión previa → reporto frames añadidos/eliminados/redimensionados; re-capturo los que cambiaron.
- **PRD**: actualizo el PRD y anoto en el decision-log qué dudas resolvió/creó esta versión.
- Bump `prd_version`/`figma_version` en STATUS. Regenero dashboard + INDEX.

### `ver` — dashboard amigable
Disparadores: "mostrame el intake X", "cómo va X".
- `node "${CLAUDE_PLUGIN_ROOT}/scripts/dashboard-gen.mjs" <intakes/<slug>>` → escribe `dashboard.html`.
- **Lo publico como Artifact** (compartible) usando ese HTML. El markdown sigue siendo la verdad.

### `aprobar` — cerrar el borrador y cortar historias
Disparadores: "aprobá el intake X", "está listo X".
1. Corro `bash "${CLAUDE_PLUGIN_ROOT}/scripts/prd-check.sh" intakes/<slug>/PRD-<slug>.md` — no apruebo con obligatorios en hueco ni alcance sin acotar ni dudas `abierta` que cambien alcance.
2. **STATUS** = `ready`. Congelo la versión del PRD/Figma.
3. **Handoff a Jira (F3, con GATE)**: propongo el árbol épica→historias y **espero tu confirmación explícita** antes de crear nada. La escritura usa el **MCP oficial de Atlassian** (si está conectado; si no, aviso y dejo el árbol listo para pegar). Nunca creo issues en masa sin tu OK.
4. Al pasar cada historia a `en-Jira`/`en-RQ`/`cerrada`, actualizo `stories.md` (el estado de ejecución lo manda Jira; yo lo reflejo).

## Congelado del Figma (procedimiento)
El congelado combina el MCP de Figma (lo llamo yo) + `figma-freeze.mjs` (mecánica). **Las URLs de screenshot del MCP son efímeras** → hay que descargar en el momento.
1. `get_metadata(fileKey)` → lista de frames top-level (name · node-id · tamaño).
2. **v1 = Figma completo**; en versiones siguientes, solo los frames que cambiaron (política del RFC-001).
3. Por frame: `get_screenshot(fileKey, nodeId)` → URL efímera.
4. Armo un JSON de captura `{fileKey, url, capturedAt, frames:[{nodeId,name,w,h,imageUrl}]}` y lo paso a
   `node "${CLAUDE_PLUGIN_ROOT}/scripts/figma-freeze.mjs" <intakes/<slug>/figma/vN> <captura.json>` → descarga `frames/*.png` (LFS), escribe `MANIFEST.md` y `structure.json`.
5. `capturedAt` lo paso yo (no uso relojes dentro de scripts de workflow).

## Reglas
- **Escribo SOLO en el repo de datos.** Nunca toco el cerebro (lo leo para fundamentar).
- **No apruebo** (`ready`) con alcance sin acotar u obligatorios con hueco.
- **Jira con gate**: jamás creo/muevo issues sin confirmación explícita tuya.
- **Cero secretos** en el intake (solo *nombres*).
- **El markdown es la verdad**; el dashboard/Artifact es presentación regenerable.
- **Commit del repo de datos**: al cerrar cada verbo, dejo el cambio commiteado en `ole-argos-product-data` con un mensaje claro (no push directo si el repo tuviera protección; hoy va a `main`).
