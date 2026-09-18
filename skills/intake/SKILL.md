---
name: intake
description: Gestiona el ciclo de vida de un intake de producto VERSIONADO en el repo de datos (ole-argos-product-data) — a partir de un PRD borrador + Figma. A diferencia de /prd (que produce un archivo local suelto), intake persiste, CONGELA el Figma por versión, mantiene un decision-log de dudas↔respuestas, controla estados (intake/dudas/historias) y genera un dashboard. Úsalo cuando Producto quiera abrir o hacer seguir un intake vivo — disparadores como "nuevo intake de…", "actualizá el intake X", "respondé la duda N de X", "subí la versión del PRD/Figma de X", "mostrame el intake X", "aprobá el intake X", "generá el roadmap del intake X", "sincronizá las historias de X con Jira", "reconciliá X con el cerebro", "cruzá los casos de prueba de X", "/argos-product:intake". Reutiliza el standard y el template de /prd para redactar el PRD dentro del intake.
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

**Contrato de datos que respetan los scripts** (`scripts/lib/md.mjs`): las tablas de `stories.md` y `decision-log.md` se leen **por nombre de columna** (`Historia · Título · Estado · Estado Jira · Ready? · Jira · RQ` / `# · Duda · Fuente · Estado · Respuesta · Fecha`), así que puedo agregar o reordenar columnas sin romper los generadores. El frontmatter de `STATUS.md` admite bloques anidados (`figma_url:` con una URL por sección) y listas. Config opcional que los scripts leen: `jira_project`, `jira_base`, `jira_title_prefix`, `jira_epics`, `jira_goal_status`, `jira_stage_order` (documentadas en `templates/intake-status.md`). Una historia cuenta como **cerrada** si `Estado: cerrada` o si su `Estado Jira` alcanzó `jira_goal_status`.

## Verbos (detecto la intención del pedido)

### `listar` / `abrir` — ver todos los intakes y elegir uno
Disparadores: `/argos-product:intake` **sin slug**, "listar intakes", "qué intakes hay", "abrí un intake", "abrí el tablero de intakes".
1. `node "${CLAUDE_PLUGIN_ROOT}/scripts/index-update.mjs" "<repo-datos>"` (regenera `INDEX.md`) y `node "${CLAUDE_PLUGIN_ROOT}/scripts/index-widget.mjs" "<repo-datos>"` (genera `INDEX-widget.html`).
2. **Leo `INDEX-widget.html` y lo emito con `show_widget`**: una tarjeta por intake (título, estado, dudas abiertas, historias, versiones, última actualización) con botones **Abrir** (→ verbo `ver`) y **Tickets** (→ verbo `tickets`), que retoman por `sendPrompt`. Así el dev elige sin recordar el slug.
- Si no hay intakes, el widget muestra el estado vacío. Sirve como pantalla de entrada del skill cuando se invoca sin argumentos.

### `nuevo` — abrir un intake
Disparadores: "nuevo intake de…", "abrí el intake …", con un PRD (archivo/link) y/o un Figma.
1. **Slug**: kebab-case corto y estable (ej. `cotizaciones-petra`). Confirmo si es ambiguo.
   **Pre-flight (si `RAG_KB_ID` está configurado):** corro `/argos-product:rag similares "<título + resumen del insumo>"` y muestro hasta 5 intakes parecidos con su estado. Si uno cubre lo mismo, propongo **sumarse** (versión nueva de ese intake) en vez de abrir otro; el PM decide.
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
- Regenero STATUS (`status-render.mjs --date <hoy>`), dashboard + INDEX.

### `version` — nueva versión del PRD/Figma
Disparadores: "subí el PRD v2.3", "hay nuevo Figma", "re-analizá X".
- **Figma**: congelo en `figma/vN+1/` (nunca piso vN) y **diffeo** `structure.json` contra la versión previa → reporto frames añadidos/eliminados/redimensionados; re-capturo los que cambiaron.
- **PRD**: actualizo el PRD y anoto en el decision-log qué dudas resolvió/creó esta versión.
- **Re-auditoría**: vuelvo a correr la auditoría de inconsistencias (paso 5 de `nuevo`) sobre lo que cambió; nuevas contradicciones → filas `abierta`.
- Regenero diagramas afectados (`analysis/`). Bump `prd_version`/`figma_version` en STATUS y `status-render.mjs --date <hoy>`. Regenero dashboard + INDEX.

### `ver` — dashboard amigable
Disparadores: "mostrame el intake X", "cómo va X".
- `node "${CLAUDE_PLUGIN_ROOT}/scripts/status-render.mjs" <intakes/<slug>>` (conteos al día en STATUS) y `node "${CLAUDE_PLUGIN_ROOT}/scripts/dashboard-gen.mjs" <intakes/<slug>>` → escribe `dashboard.html`.
- **Lo publico como Artifact** (compartible) usando ese HTML. El markdown sigue siendo la verdad.

### `roadmap` — entregable visual del plan de ejecución (RFC-002)
Disparadores: "generá el roadmap del intake X", "sincronizá las historias de X con Jira", "reconciliá X con el cerebro", "cruzá los casos de prueba de X", "actualizá el roadmap-mvp de X", "hacé el mapa de fases de X".
Distinto de `ver` (que es panel ejecutivo con contadores): `roadmap` es la vista de "cómo lo abordamos" — una tarjeta por historia agrupada por fase, con estado Ready?, dudas bloqueantes cruzadas del decision-log y modal por historia. Es el artefacto que Producto le muestra a Dev cuando arranca el spec del RQ.
1. **Prerequisito**: el `stories.md` debe tener la sección `## Orden de ejecución · roadmap por fase` con un H3 por fase y una tabla `Historia | Título | Ready?`. Si falta, el script genera igual el HTML **con un banner de warning** que guía a pegar `templates/stories-roadmap-section.md` del motor.
2. **Datos que consume** (todos del intake, sin Jira ni servicios externos):
   - `STATUS.md` frontmatter → título del intake.
   - `stories.md` → tabla índice de historias + sección "Orden de ejecución".
   - `decision-log.md` → dudas con estado `abierta`, cruzadas con las historias por menciones `SXX` en el cuerpo. Las que matchean se muestran como flag `🚧 #NN` en la tarjeta y en el modal.
3. **Genero**: `node "${CLAUDE_PLUGIN_ROOT}/scripts/roadmap-gen.mjs" <intakes/<slug>>` → escribe `roadmap-mvp.html`. Self-contained + theme-aware (mismo patrón que `dashboard.html`).
4. **Publico como Artifact** con ese HTML. Guardo la URL en `STATUS.md` (`roadmap_artifact_url`); en corridas siguientes republico sobre esa MISMA URL (paso `url`) para conservar el link ya compartido.
5. **Cuándo se re-corre**: al cerrar dudas grandes, al agregar/mover historias entre fases, o al cambiar el orden del plan. El HTML es regenerable — nunca se edita a mano.

### `avance` → vive en `/argos-product:avance`
El tablero de avance y la proyección de cierre son un skill propio con **contrato de frescura** (cada corte se reconstruye desde Jira). Si me lo piden desde acá, lo derivo: `/argos-product:avance <slug>`. Ese skill, además, deja `stories.md` y `STATUS.md` al día (verbo `sync`).

### `sync` — traer el estado real de Jira a `stories.md`
Disparadores: "sincronizá las historias de X con Jira", "reconciliá X con el cerebro", "cruzá los casos de prueba de X", "actualizá el estado de las historias de X", "qué historias de X ya cerraron".
1. **Snapshot desde Jira** (MCP Atlassian, sin heredar nada de cortes previos): `searchJiraIssuesUsingJql` con `("Epic Link" in (<jira_epics>) OR parent in (<jira_epics>)) AND issuetype = Historia`, fields `key, status, summary, labels`. Lo guardo como JSON `{ "issues": [ { "key", "status", "summary", "labels" } ] }` en el scratchpad (mismo shape que el input de `/avance`).
2. `node "${CLAUDE_PLUGIN_ROOT}/scripts/stories-sync.mjs" "intakes/<slug>" <snapshot.json>` → escribe `Estado Jira` (y `Jira` si la historia se reconoce por su label `intake-<slug>-s<n>`), pasa `Estado` a `en-Jira`/`cerrada` según `jira_goal_status`, y reporta **movimientos**, historias sin dato y issues de Jira sin fila. Nunca infiero por título.
3. `node "${CLAUDE_PLUGIN_ROOT}/scripts/status-render.mjs" "intakes/<slug>" --date <hoy>` → regenera el bloque `<!-- argos:auto -->` de `STATUS.md` (conteos de dudas, historias, versiones, épicas, entregables) y `updated:`.
4. Si el script sugiere otro `status` del intake (`in-delivery` / `done`), **lo propongo**; lo decide el PM.
5. Regenero dashboard + INDEX y commiteo (`📝 Intake(<título>): sync Jira — <movimientos>`).

### `reconciliar` — traer al decision-log lo que Dev decidió contra el código
Disparadores: "reconciliá X con el cerebro", "qué findings hay de X", "el código cambió, ¿el PRD sigue vigente?", "/argos-product:intake reconciliar <slug>".
El caso que lo motiva: el PRD de cotizaciones seguía pidiendo la caja de comisión que el código había borrado un mes antes, y nada lo trajo de vuelta a Producto. El cerebro (solo lectura, `findings/` en el recorte) registra esas decisiones; este verbo las cruza con el intake.
1. `node "${CLAUDE_PLUGIN_ROOT}/scripts/findings-scan.mjs" "intakes/<slug>" [--since <fecha del último reconciliar>]` → lista los findings que mencionan las **keys de Jira** del intake (historias + épicas), su **capability** o su **slug**, y que el decision-log **todavía no cita**. Leo cada uno (son markdown en `repos/ole-argos-brain/findings/`) y resumo en una línea qué decidió Dev y qué parte del PRD toca.
2. Los que sí afectan al PRD/historias los registro: `findings-scan.mjs "intakes/<slug>" --apply --date <hoy>` agrega una fila `abierta` por finding (fuente `cerebro findings/<archivo>`); después **reescribo la Duda** de cada fila con mi resumen concreto ("Dev quitó X porque Y — ¿el PRD deja de pedirlo?"). Los que no afectan los marco `descartada` con el motivo, así el próximo scan no los vuelve a traer.
3. Si el finding contradice al PRD y el PM ratifica lo implementado, **el código manda**: aplico el cambio al PRD/historias (`aplicada-al-PRD`) y anoto que el PRD anterior quedó superado — no "drift a cerrar". Si el PM sostiene el PRD, queda `abierta` con dueño Dev y la reporto como finding a curar (nunca toco el cerebro).
4. Regenero STATUS (`status-render.mjs --date <hoy>`), dashboard + INDEX y commiteo (`📝 Intake(<título>): reconciliación con el cerebro — N findings`).
5. Lo corro también **al cerrar cada `sync`** cuando aparecen historias nuevas en «Ready to Prod»: es el momento en que Dev dejó decisiones escritas.

### `tests` — casos de prueba del QA como artefacto del intake
Disparadores: "incorporá los casos de prueba de X", "cruzá los TCs del QA con las historias", "/argos-product:intake tests <slug>".
1. El QA deja `intakes/<slug>/test-cases.csv` (columnas: `ID · Sección · Caso de prueba · Pasos · Resultado esperado · Prioridad · Sin confirmar`; el orden no importa).
2. `node "${CLAUDE_PLUGIN_ROOT}/scripts/test-map.mjs" "intakes/<slug>"` → `test-map.md` con la matriz **sección QA ↔ historia(s)**: TCs, cuántos Alta, cuántos «sin confirmar», cobertura (🟢 mapeada · 🟠 con dudas del QA · ⚪ sin historia). Las historias las detecta por menciones de keys/S<n> en el CSV; lo que el CSV no dice lo completo yo en la tabla `## Mapeo sección → historia` del mismo archivo (se conserva entre corridas) y vuelvo a correr.
3. Cada TC «sin confirmar» es una **duda del QA**: la registro en el decision-log (fuente `QA TC-xxx`) con default propuesto. Las secciones ⚪ son alcance que el QA ve y el PRD no tiene (o al revés) → fila `abierta` de alcance.
4. Al enriquecer criterios de aceptación con TCs, cito `QA TC-xxx` como sufijo discreto y explico la leyenda **una vez** en la épica (las historias deben entenderse solas, sin el CSV a la vista).
5. Regenero STATUS + dashboard y commiteo (`📝 Intake(<título>): N casos de prueba del QA mapeados`).

### `aprobar` — cerrar el borrador y cortar historias
Disparadores: "aprobá el intake X", "está listo X".
1. Corro `bash "${CLAUDE_PLUGIN_ROOT}/scripts/prd-check.sh" intakes/<slug>/PRD-<slug>.md` (secciones, placeholders, Resumen para Dev, criterios Dado/cuando/entonces por historia, dueños de las preguntas) y `node "${CLAUDE_PLUGIN_ROOT}/scripts/intake-lint.mjs" intakes/<slug>` (frontmatter, estados, dudas citadas que existen, roadmap ↔ índice, PRD §6 ↔ stories, snapshot de Figma). **No apruebo** con errores del lint, obligatorios en hueco, alcance sin acotar ni dudas `abierta` que cambien alcance; los avisos los reporto.
   **Si `RAG_KB_ID` está configurado**, además corro `/argos-product:rag auditar <slug>`: contradicciones con el cerebro, historias redundantes con otros intakes y precedentes de dudas — **solo sugiere**, no bloquea; lo que el PM acepte va al decision-log con fuente `RAG: <ruta>`.
2. **Genero el gate** `intakes/<slug>/jira-preview.md` desde `${CLAUDE_PLUGIN_ROOT}/templates/jira-preview.md`, poblándolo con las historias del PRD §6 (título, descripción Como/Quiero/Para + criterios) y los **links de Figma** (mapeo frame→node-id de `figma/vN/structure.json`). El dev revisa/edita ese archivo — **es la fuente desde la que se crea**.
   **Formato obligatorio de cada historia** (aplica también al MCP al crear):
   - **Links de Figma completos** — nunca cito solo el `node-id`. Cada frame va como URL completa clickeable = **URL base del archivo** (de `figma_url.*` en `STATUS.md`) + `?node-id=<node-id-con-guiones>` (los `:` del id se reemplazan por `-`). Markdown: `- [Nombre del frame](<url-completa>)`.
   - **Sin sección "Trazabilidad".** El estado Ready?, la fase, el intake y las dudas ya viajan en los **labels** (`ready:*`, `phase:*`, `intake:*`, `blocked-by:#NN`). No los repito en el cuerpo. Las dudas activas se mencionan inline solo cuando aportan contexto.
   - **Diagrama de secuencia embebido cuando existe.** Para cada historia `Sxx`, si existe `intakes/<slug>/analysis/stories/<sid>.mmd`, embebo su contenido en un bloque ```` ```mermaid ```` en la descripción (Jira renderiza Mermaid nativo). Si el archivo no existe, **omito toda la sección** — no dejo placeholder ni "pendiente".

   **Contenido de la ÉPICA (reglas obligatorias):**
   - **`## Objetivo` en lenguaje de negocio, no técnico.** Describo el *por qué* del proyecto y el *valor para la organización* para cualquier stakeholder (retención, auditoría, escalabilidad, reducción de fricción). **No** menciono repos, endpoints, componentes, servicios, códigos de historia (Sxx) ni jerga técnica interna. Si necesito bullets, van con formato `**<beneficio>** — <explicación breve>`.
   - **`## Alcance` describe capacidades funcionales, no artefactos técnicos.** Enuncio qué puede hacer el usuario final o el negocio. **No** enumero historias por código, rutas de archivo o keys de Jira — eso vive en `stories.md` y en el backlog de la épica. Incluyo un bullet **"Quedan fuera de alcance"** con las decisiones deliberadas de recorte.
   - **`## Convenciones para Dev` empieza siempre con el link al Roadmap interactivo del initiative** si existe. Fuente: `STATUS.md` frontmatter `roadmap_artifact_url:` (el verbo `roadmap` lo escribe al publicar). Formato: `- **Roadmap interactivo del initiative** — <descripción breve>. **Link vigente:** [<Nombre>](<url>).`. Si no hay URL en el STATUS, **omito** el bullet — no invento ni pongo placeholder.
   - **No incluyo sección "Estado del bump v<N>"** ni bitácora de versiones del PRD. Esa historia vive en `decision-log.md`; alcanza con referenciarlo desde `## Fuentes`.

   **Sección `## Base técnica` en la ÉPICA (opcional · solo cuando el initiative tiene rama de integración propia):**
   - Se agrega **solo en la descripción de la épica**, nunca en cada historia — las historias hijas heredan la base al abrir su spec.
   - Aplica cuando el intake trabaja sobre una **rama base distinta de la default del repo** (ej. `petra/policies`, `mobile/v2`) — típicamente un initiative multi-RQ que se integra antes de bajar a `develop`/`staging`.
   - Campos: **Rama base** (nombre + destino del PR + criterio de merge a la default) · **Entorno de deploy inicial** (INT / staging-mx / staging-br · regla de promoción). **Repos afectados NO van acá** — los define el `/argos:spec` de cada RQ.
   - Si el intake usa la default del repo (methodology §4: INT→`develop`, MX/BR→`staging`), **omito** la sección — no dejo placeholder.
   - Fuente de verdad para el valor: `STATUS.md` frontmatter (campos opcionales `base_branch:` y `deploy_env:`). Si no están en el STATUS, pregunto al usuario antes de emitir; no invento.

3. **STATUS** = `ready`. Congelo la versión del PRD/Figma.
4. **Handoff a Jira — con GATE + IDEMPOTENCIA.** Espero tu **confirmación explícita** antes de crear nada. La escritura usa el **MCP de Atlassian** (probá `atlassianUserInfo` antes de darlo por caído). Si no responde, **no invento**: genero el CSV importable con `node "${CLAUDE_PLUGIN_ROOT}/scripts/jira-import.mjs" intakes/<slug>` (solo las historias pendientes, con sus labels únicos; épica incluida si el STATUS aún no tiene `jira_epics`; descripción en wiki de Jira, `--markdown` para dejarla tal cual) y el PM lo importa desde Jira. Nunca creo en masa sin tu OK.

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
- **El markdown es la verdad**; el dashboard/Artifact es presentación regenerable. Los **conteos del cuerpo de `STATUS.md`** (bloque `<!-- argos:auto -->`) también: los escribe `status-render.mjs`, nunca a mano — la prosa del PM va fuera del bloque.
- **Commit del repo de datos**: al cerrar cada verbo, dejo el cambio commiteado en `ole-argos-product-data` con un mensaje claro (no push directo si el repo tuviera protección; hoy va a `main`).
