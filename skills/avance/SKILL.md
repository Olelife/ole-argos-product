---
name: avance
description: Genera y publica el tablero de AVANCE de un intake — corte FRESCO desde Jira (historias del épico + bugs linkeados) sin herencia entre cortes. Persistente (avance.html + Artifact reutilizable) y versionado en el repo de datos. Úsalo cuando Producto quiera un corte confiable del progreso — disparadores como "actualizá el avance de X", "cómo va el avance del intake X", "mostrame el avance de X", "/argos-product:avance <slug>". Es el reemplazo endurecido del verbo `avance` de /argos-product:intake — reconstruye el snapshot desde Jira en cada corrida, sin heredar estados ni assignees ni links del corte anterior.
---

# /argos-product:avance — corte fresco del tablero de avance

Genero el **tablero de avance** de un intake y lo publico como Artifact.
El script `avance-gen.mjs` no cambia — el aporte de este skill es **cómo se arma su input.json**:
cada corte reconstruye historias, bugs, estados y assignees **desde Jira**, sin heredar nada del
corte anterior. Persona y reglas: `CONSTITUTION.md`.

> Narro en voz de **Argos**, sobrio y mínimo. Solo comunico movimientos reales del corte
> (promociones, regresiones, bugs nuevos, cambios de dueño). El artefacto es una foto —
> para refrescar se vuelve a correr.

## Dónde vive todo (3 piezas)
- **Motor** = este plugin (read-only, se instala).
- **Datos** = `ole-argos-product-data` (repo, clonado por `/argos-product:setup` en `repos/`). **Acá escribo** (`avance.html` + commit).
- **Cerebro** = `ole-argos-brain` (read-only). No lo toca este skill.

Ruta base de datos: `${OLE_REPOS:-<workspace>/repos}/ole-argos-product-data`. Si no está, pido correr `/argos-product:setup`.

## Contrato de frescura (las 5 reglas no negociables)

Cada corte que emito respeta estas reglas. Vienen de fallas reales observadas al usar el
verbo viejo de `/intake` (memoria: `argos-product-avance-freshness-rules.md`).

1. **El `input.json` se arma DESDE JIRA, no desde el corte anterior.**
   Prohibido leer el `input.json` previo del scratchpad para "heredar" campos. Cada corrida
   parte de cero y reconstruye historias, bugs, estados y assignees con lo que Jira
   responda ahora.
2. **Los bugs se linkean por `issuelink` real, nunca por inferencia del título.**
   Cada bug se mapea a su historia leyendo el `type.name` del issuelink (`Defect` o `Test`)
   y el `inwardIssue.key` / `outwardIssue.key`. Si un título "suena a" otra historia y el
   link dice otra cosa, gana el link.
3. **Los assignees de bugs viejos se re-consultan siempre.**
   Un bug que ya vi en cortes anteriores puede haber cambiado de dueño. No se copia del
   input previo.
4. **Los bugs nuevos se descubren por JQL amplia, no por rango de key.**
   La consulta de bugs NO filtra por `key >= último+1`. Si un ticket se creó fuera de rango
   (p. ej. porque otro equipo abrió tickets en el medio), lo pierdo si filtro.
5. **La paginación se sigue hasta `hasNextPage=false`.**
   Si la JQL amplia con `issuelinks` supera el token cap del MCP y vuelca a `.txt`, se usa
   `jq` sobre el volcado — pero se **confirma con una JQL corta por keys** los assignees y
   estados de los que quedaron cortados. Nunca dar por buenos datos parciales.

Detalle operativo del cap y del volcado en la memoria `argos-product-avance-jql-token-cap.md`.

## Verbos

Este skill tiene un solo verbo — **cortar avance** — para minimizar la superficie. Se dispara
con `/argos-product:avance <slug>` o cualquier frase natural que lo pida.

### `cortar` (default) — corte fresco + publica + commitea

1. **Config del intake** — leo `intakes/<slug>/STATUS.md` frontmatter:
   - **`jira_epics`** (obligatorio) — lista de épicas a barrer. Sin esto no hay de dónde leer.
   - **`stories`** (opcional) — override explícito, lista de keys. Si está, mando esas
     historias tal cual y me salteo el descubrimiento por JQL. Sirve para excluir una
     historia descartada o forzar orden.
   - **`jira_goal_status`** (default `Ready to Prod`) — meta.
   - **`jira_stage_order`** (default `["Tareas por hacer","En curso","Staging","Ready to Prod"]`).
   - **`avance_artifact_url`** (opcional) — si existe, republico ese Artifact
     (los stakeholders ya tienen el link).

   Si falta `jira_epics`, aviso y freno. Si faltan los defaults, uso los defaults y aviso
   cuáles asumí.

2. **Descubro historias** (`HIS`) — dos caminos:
   - Si `stories:` está en el STATUS → uso esa lista literal (sin re-JQL de descubrimiento).
   - Si no → JQL:
     ```
     ("Epic Link" in (<jira_epics>) OR parent in (<jira_epics>))
       AND issuetype = Historia
       AND status != "Desestimado"
     ```
     `searchJiraIssuesUsingJql` (MCP Atlassian), fields = `["key","status","assignee","summary"]`.

   En ambos casos, para las keys resultantes hago **una JQL corta explícita por keys** para
   traer estado + assignee + summary frescos — sin heredar del corte anterior.

3. **Descubro bugs** (`BUGS`) — JQL amplia SIN filtro de key:
   ```
   issuetype in (Bug, Error) AND (
     issue in linkedIssues(<H1>) OR issue in linkedIssues(<H2>) OR …
   )
   ORDER BY key ASC
   ```
   fields = `["key","status","assignee","summary","issuelinks"]`, paginado hasta
   `hasNextPage=false`.

   Si la respuesta se vuelca a `.txt` por token cap, extraigo con
   `jq -r '.issues.nodes[] | ...'` y **confirmo con una JQL corta por keys** los assignees
   y estados de los bugs que quedaron cortados por la paginación.

   Para cada bug, mapeo a su historia leyendo `issuelinks[]`:
   - Tipo `Defect` (inward "created by") → la historia es `inwardIssue.key`.
   - Tipo `Test` (outward "tests") → la historia es `outwardIssue.key`.
   - Si un bug tiene links a historias **fuera del intake**, lo ignoro para el mapa
     (aparecerá en el avance del intake que sí lo cubre).
   - Regla 2: **nunca infiero por título**.

   Un bug se cuenta como **abierto** si `status ∉ {"Ready to Prod","Desestimado"}`.

4. **Armo `input.json` desde cero** (ver schema en `scripts/avance-gen.mjs`):
   - `capturedAt` = fecha de hoy (del sistema).
   - `project`, `epics`, `stageOrder` desde el STATUS.
   - `issues[]` = una entrada por historia, con:
     - `key`, `status`, `assignee`, `summary` traídos de Jira.
     - `bugs = {total, open, keys[], openKeys[], items[{key,status,assignee,summary,open}]}` armado del mapa BUGS.
   - `jiraBase = "https://olelife.atlassian.net"`.
   - `finding.title` y `finding.body` los redacto yo con los **movimientos reales** del
     corte: promociones, regresiones, bugs nuevos, cambios de dueño, bugs cerrados. Uso el
     `input.json` previo del scratchpad **solo** para calcular el diff que va al `finding`
     — no para heredar campos de la foto.
   - `finding.stats[]` = 6 filas fijas: Ready to Prod / Staging / En curso / Por hacer /
     bugs total / bugs abiertos.

   Guardo en `<scratchpad>/avance-input.json` (no committeable).

5. **Regenero el HTML** — sin cambios en el script:
   ```
   node "${CLAUDE_PLUGIN_ROOT}/scripts/avance-gen.mjs" "intakes/<slug>" <scratchpad>/avance-input.json
   ```
   Escribe `intakes/<slug>/avance.html`.

6. **Publico el Artifact**:
   - Si `avance_artifact_url` está en `STATUS.md` → republico ahí (paso `url`) para
     conservar el link ya compartido.
   - Si no está → publico nuevo, guardo la URL en `STATUS.md` (`avance_artifact_url`) y
     lo committeo junto con el HTML.

7. **Commit + push** al repo de datos, en `main`:
   - Mensaje: `📊 Avance(<title-corto>): <resumen de movimientos>` (una línea, imperativo).
     Ej: `📊 Avance(Módulo Póliza): SO-930/SO-931 a Staging; SO-1033/SO-1036 en curso`.
   - `git add intakes/<slug>/avance.html` (+ `STATUS.md` si actualicé el URL).
   - Autor: nombre + email del `git config` del clon.

## Reporte al chat (mínimo, formato fijo)

Al terminar emito un bloque ASCII compacto — nada de prosa, nada de repetir lo que
el Artifact ya muestra. Foco: **movimientos reales** del corte.

```
Historias que avanzaron / retrocedieron
  SO-xxx  título                          Estado antes → Estado ahora   [Asignee]
  …

Bugs con cambio de estado o dueño
  SO-yyyy [texto] → SO-xxx                Estado antes → Estado ahora   [Asignee]
  …

Bugs nuevos (aparecieron en este corte)
  SO-yyyy [texto] → SO-xxx                Estado                        [Asignee]
  …

Estado por historia
  Ready to Prod    X / N   (X.X% conteo · X.X% ponderado)
  Staging          X / N
  En curso         X / N
  Tareas por hacer X / N

Bugs relacionados TOTAL   X   (Δ vs corte previo)
Bugs abiertos             X
```

Después una **sola** frase de contexto (foco caliente / próximo paso). Cierro con el
URL del Artifact y el hash del commit. Nada más.

## Reglas siempre activas (aplican a este skill)

- **NUNCA reconstruyo el input.json desde el corte anterior.** Cada corte parte de Jira.
- **NUNCA infiero el link bug→historia por título.** Uso el issuelink real.
- **NUNCA heredo el assignee de un bug ya visto.** Se re-consulta siempre.
- **Cero secretos.** Solo nombres (de historias, de bugs, de asignados). Nunca tokens.
- **Idioma**: código en inglés (commits, scripts); narración con el PM en el idioma del team.
- **El markdown es la verdad**; el `avance.html` y el Artifact son presentación regenerable.

## Interacción con `/argos-product:intake`

El verbo `avance` de `/argos-product:intake` sigue existiendo por compatibilidad, pero
delega su implementación a este skill: si me llaman desde `/intake`, aplico el mismo
contrato de frescura. En una futura versión mayor, el verbo se remueve de `/intake` y
queda solo `/argos-product:avance`.
