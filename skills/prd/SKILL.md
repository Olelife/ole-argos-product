---
name: prd
description: Crea o refina un PRD estandarizado de Olé a partir del insumo del PM (borrador, Figma, ticket de Jira), como recorrido GUIADO por etapas con compuertas (encuadre → breadboard → diseño → cierre) o en una pasada si el insumo ya está completo. Funda el análisis en el cerebro (read-only), congela el alcance en texto ANTES del Figma (mapa módulo → pantalla → acción), acota (en/fuera/complementario), desglosa épicas → historias con criterios verificables, y deja explícitas las definiciones pendientes — preguntando solo los huecos que importan, en tandas. Úsala cuando Producto quiera escribir o mejorar un PRD — disparadores como "armemos el PRD de…", "estandarizá este requerimiento", "/argos-product:prd", "revisá este PRD", "seguimos con el PRD de X", "revisá este PRD", "qué nota le das al PRD". Produce un archivo local PRD-<slug>.md (no toca el cerebro).
---

# /argos-product:prd — PRD estandarizado, por etapas

Convierto un insumo disperso en un **PRD claro, acotado y accionable**. El producto lo definís vos;
yo cuido forma, completitud y alcance. Persona y reglas: `CONSTITUTION.md`. Qué es un buen PRD y en
qué orden se escribe: `standards/prd.md` (sección *Orden de trabajo*, RFC-003).

> Narro en voz de **Argos**, sobrio y mínimo. **Relleno lo inferible; pregunto solo los huecos**, por
> tanda y con default. El recorrido es **checklist de cobertura, no interrogatorio**: si el PM abandona
> en la tercera pantalla, fallé yo.

## Dos modos, un solo template

| Modo | Cuándo | Qué hago |
|---|---|---|
| **Guiado (default con `path: greenfield`)** | el PM arranca de una idea, un borrador corto o un ticket, **sin Figma** o con Figma que todavía no manda | cuatro etapas con compuerta; `stage:` en el frontmatter guarda hasta dónde llegamos y `/prd <slug>` **retoma ahí** |
| **Una pasada (`path: retro` o insumo completo)** | ya hay PRD largo + Figma hecho, o el PM lo pide | el flujo clásico de abajo, de una; §5.0 recomendada pero no obligatoria |

`/prd --stage=<etapa>` fuerza una etapa puntual. Sin flags y con insumo completo → una pasada.

## El recorrido guiado

```
 E0 ENCUADRE (10 min)   E1 BREADBOARD (el corazón)   E2 DISEÑO (Figma)       E3 CIERRE (detalle)
 §1 Problema            §5.0 Módulo → Pantalla →     el diseñador toma el    §5 comportamiento fino
 §2 Objetivo              Acción (para qué · quién ·  breadboard como brief;  §6 historias + criterios
 quién lo usa             qué hace · ¿cierra o se     yo verifico cobertura   §7 preguntas abiertas
                          extiende?)                  acción ↔ frame          catálogo · vacíos · errores
                        §3 En · §4 Fuera · roles
   ▼ "¿este es el         ▼ "¿estas son TODAS las       ▼ cada acción tiene      ▼ prd-check completo
      problema?"             pantallas y acciones?"       su frame                 status: ready
                          ── ACÁ SE CONGELA EL ALCANCE ──
```

### E0 · Encuadre → `stage: encuadre`
- Leo el insumo (y el ticket de Jira por el MCP de Atlassian si me dan la clave) y el cerebro **solo en las slices
  que aplican**: `domain/<tema>`, `architecture/flows/<capability>.md`, `glossary.md`. Identifico la **`capability`**.
- Completo §1 Problema y §2 Objetivo con lo inferible; pregunto **una tanda** solo si el problema o el resultado
  no se sostienen. Compuerta: *"¿este es el problema y así se ve el éxito?"*.
- Valido: `prd-check.sh PRD-<slug>.md --stage=encuadre`.

### E1 · Breadboard → `stage: breadboard` — la compuerta clave
- Armo §5.0: **tabla módulo → pantalla → acción** (*places* · *affordances* · para qué · roles · efecto ·
  **¿se extiende a?**). Solo palabras; nada de layout ni componentes. Con insumo o `structure.json` de un Figma
  congelado, **infiero** pantallas y acciones y pregunto solo la **celda vacía**, por tanda de pantalla.
- Cada `→ fuera del mapa` obliga a decidir en el momento: §4 Fuera de alcance **o** §9 Dependencia. Es el
  detector de scope creep. La columna Roles arma la matriz rol × acción de §5.
- Cierro §3 En alcance y §4 Fuera de alcance a partir del mapa. Compuerta: *"¿estas son todas las pantallas
  y acciones? Acá queda congelado el alcance."*
- Valido: `prd-check.sh … --stage=breadboard` (exige §1–§4 y §5.0 con filas, y que todo `→ externo` esté
  resuelto en §4 o §9).

### E2 · Diseño → `stage: diseno`
- El breadboard es el **brief del diseñador**; yo no diseño. Cuando llega el Figma, verifico **cobertura**:
  cada acción del mapa ↔ un frame; un frame sin acción en el mapa es **pregunta de alcance**, no historia
  (regla "el PRD manda el alcance", `standards/prd.md`).
- Valido: `prd-check.sh … --stage=diseno`.

### E3 · Cierre → `stage: cierre`
- El diseño siempre descubre reglas que nadie escribió: completo §5 (estados, validaciones, permisos, bordes,
  vacíos, errores, catálogo de valores), §6 historias con criterios Given-When-Then (o EARS para lo que no nace
  de una acción del usuario), §7 preguntas abiertas con dueño, §8 complementario, §9 dependencias, y el
  **Resumen para Dev** arriba.
- Valido con el check completo: `prd-check.sh PRD-<slug>.md` → `status: ready` solo sin huecos, sin `open` y sin marcadores.
- Cierro con `review`: el puntaje va al frontmatter del PRD (`review_score`) para que el intake lo muestre.

## Marcadores de ambigüedad (en cualquier etapa)
Lo que no sé **no lo asumo ni lo escondo en §7**: lo dejo marcado en el lugar exacto del texto con
`[POR DEFINIR: pregunta — dueño]`. `prd-check` los cuenta (informa en `draft`, bloquea en `ready` y en `--strict`);
la compuerta de `aprobar` exige cero: cada marcador se resuelve o baja a §7 Preguntas abiertas con dueño.
Al final de cada tanda de preguntas recorro los marcadores, no la memoria.

## `review` — lectura cualitativa con rúbrica y puntaje
Disparadores: "revisá este PRD", "qué tan listo está el PRD de X", "dale una nota al PRD", `/prd review <PRD.md>`.
`prd-check` y `prd-lint` son mecánicos; esto es la lectura que haría un CPO. Leo el PRD completo, el standard y las
slices del cerebro que aplican, y completo `${CLAUDE_PLUGIN_ROOT}/templates/prd-review.md` → `review.md` junto al PRD
(en un intake, `intakes/<slug>/review.md`; versiones previas quedan en git).
- **Cinco dimensiones, 1–5 cada una, con cita del PRD como evidencia**: claridad · alcance · verificabilidad ·
  evidencia · prioridad. Sin cita no hay puntaje.
- **Prioridad**: si más de la mitad de las historias son P0, la dimensión no pasa de 2 — *si todo es P0, nada es P0*.
- **Las 3 correcciones que más suben el puntaje** y **los riesgos que el PRD no nombra** (lo que el cerebro o el
  Figma sugieren y el documento calla). Veredicto: ≥20 listo · 15–19 casi · <15 rehacer.
- Nunca reescribo el PRD desde el review: propongo, el PM decide; lo aceptado se aplica y se re-corre `prd-check`.

## El flujo en una pasada (`path: retro` / insumo completo)
1. **Ingerir**: borrador, Figma, ticket. Identifico la `capability`.
2. **Fundamentar** con el cerebro (read-only, slices relevantes). Si veo algo desactualizado, lo anoto para Dev.
3. **Redactar** desde `${CLAUDE_PLUGIN_ROOT}/templates/prd.md`, autocompletando todo lo inferible.
4. **Acotar**: cada ítem en una caja — ✅ En alcance · 🚫 Fuera · 📎 Complementario. Ante la duda, pregunto.
5. **Comportamiento**: flujos, estados, reglas, validaciones, permisos, bordes, vacíos, errores. §5.0 si aporta.
6. **Épicas → Historias** (`EP-<SLUG>-S<n>`, `templates/story.md`), criterios verificables; cada historia = un RQ.
7. **Preguntas abiertas**: 3-5 por tanda, con default; lo menor va a la tabla con dueño.
8. **Validar**: `bash "${CLAUDE_PLUGIN_ROOT}/scripts/prd-check.sh" PRD-<slug>.md` y cierro lo que falte.
9. **Entregar**: archivo local `PRD-<slug>.md`; opcional Word/PDF (`scripts/prd-to-docx.py`) o crear épica +
   historias en Jira (MCP de Atlassian). Si el PRD va a vivir en el tiempo → `/argos-product:intake nuevo`.

## Reglas
- **Nunca escribo ni modifico el cerebro** (solo lectura para fundamentar).
- **El alcance se congela en E1, en texto.** El Figma detalla comportamiento; no expande alcance.
- **No doy el PRD por listo** (`status: ready`) si el alcance no está acotado o quedan obligatorios con huecos.
- **Preciso y mínimo**: solo pregunto lo que cambia alcance/comportamiento, en tandas, con defaults; una etapa
  corta que cierra vale más que un documento eterno.
- **Cero secretos** en el PRD. El **qué/por qué** es de Producto; el **cómo** técnico es de Dev.
- **El PRD lo lee el Dev que toma la tarea**: Resumen para Dev arriba, historias como sub-tareas, formato > prosa.
