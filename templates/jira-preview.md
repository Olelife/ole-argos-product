# Jira preview · <título>

<!-- Gate de validación. Lo genera /argos-product:intake (verbo `aprobar`) desde el PRD §6 + Figma. -->
<!-- El dev revisa y edita ACÁ. Nada se crea hasta su OK. La creación es idempotente (ver abajo). -->

## Campos globales (confirmar)
- **Proyecto Jira:** <clave, ej. SO>
- **Épica padre:** `EP-<SLUG>` (se crea primero; su key real reemplaza el placeholder)
- **Convención de título:** `[<Producto>] <título>`
- **Labels por defecto:** <label1>, <label2>
- **Figma base:** <url completa del archivo, con `?node-id=...` para poder concatenar frames>

## Idempotencia (no duplica)
Cada issue lleva un **label único**: épica `intake-<slug>-epic`, historias `intake-<slug>-s<n>`.
Antes de crear se chequea **doble llave** — (1) key en `stories.md`, (2) JQL `labels = "intake-<slug>-s<n>"`.
Si ya existe por cualquiera, **no se crea**: se reutiliza el key. Mandar dos veces = no-op.

## Reglas de formato de las historias (obligatorias)

**Todas las historias que se creen en Jira deben cumplir estas 3 reglas** — se aplican también al template de abajo y al contenido que envía el MCP al crear:

1. **Links de Figma completos.** La sección "Diseño" nunca lleva solo el `node-id` (ej `2480:9380`). Cada frame se cita como URL completa clickeable — la **URL base del archivo** (de `figma_url.*` en `STATUS.md`) + `?node-id=<node-id-con-guiones>` (ej `2480-9380`, **no** `2480:9380`). Formato Markdown: `- [Nombre del frame](<url-completa>)`.
2. **Sin sección "Trazabilidad".** El estado Ready?, la fase, el intake y las dudas ya viajan en los **labels** (`ready:*`, `phase:*`, `intake:*`, `blocked-by:#NN`). No se repiten en el cuerpo de la historia — solo aparecen inline cuando aportan contexto (ej: nota de una duda activa).
3. **Diagrama de secuencia embebido cuando existe.** Si `intakes/<slug>/analysis/stories/<sid>.mmd` existe, su contenido se embebe en la historia dentro de un bloque ```` ```mermaid ```` (Jira renderiza Mermaid nativo). Si no existe, la sección "Diagrama de secuencia" se **omite** (no se pone placeholder ni "pendiente").

---

## ÉPICA — EP-<SLUG>
- **Tipo:** Epic · **Label único:** `intake-<slug>-epic`
- **Summary:** `[<Producto>] <título de la épica>`

  **Secciones estándar de la épica (en este orden):** Objetivo · Alcance · **Base técnica** (opcional, ver abajo) · Fuentes · Convenciones para Dev · Trazabilidad.

  ### Reglas de contenido de la épica (obligatorias)

  1. **`## Objetivo` es de negocio, no técnico.** Describe el *por qué* del proyecto y el *valor para la organización* en lenguaje que entiende cualquier stakeholder (retención, auditoría, escalabilidad, reducción de fricción). **Prohibido** mencionar repos, endpoints, componentes, servicios, códigos de historia (Sxx) o cualquier jerga técnica interna. Si necesitás enunciar el valor, hacelo con bullets `**<beneficio>** — <explicación breve>`.
  2. **`## Alcance` describe capacidades funcionales, no artefactos técnicos.** Enunciá qué puede hacer el usuario final o el negocio (ej. "consulta de cartera", "9 tipos de cambio agrupados por impacto en prima", "landing pública de aceptación de oferta"). **Prohibido** enumerar historias por código (`S1`, `S2b`, `S13a/b`), rutas de archivo, nombres de servicios o keys de Jira — eso vive en el intake (`stories.md`) y en el propio backlog de la épica en Jira. Incluí un bullet **"Quedan fuera de alcance"** con las decisiones deliberadas de recorte.
  3. **`## Convenciones para Dev` empieza siempre con el link al Roadmap interactivo del initiative** (si existe · Artifact publicado del entregable `roadmap-mvp.html` del intake). Ese link es la puerta de entrada de Dev al abrir un spec — le muestra fases, dependencias y secuencia sugerida. Formato: `**Roadmap interactivo del initiative** — <descripción breve>. **Link vigente:** [<Nombre>](<url>).`. Si el intake aún no tiene roadmap publicado, se omite este bullet (no dejar placeholder).
  4. **No sección "Estado del bump"** ni bitácora de versiones del PRD en la épica. Ese historial vive en el `decision-log.md` del intake — referenciarlo desde la sección `## Fuentes` alcanza. La épica muestra el estado vigente, no la evolución.

  ### Sección `## Base técnica` (opcional · solo cuando aplica)

  Se agrega **solo en la épica** — nunca se repite en cada historia. La consumen todos los `/argos:spec` de las historias hijas para saber de dónde arrancar. Aplica cuando el initiative usa una **rama base distinta de la default del repo** (ej. `petra/policies`, `mobile/v2`); si usa la default (methodology §4: INT→`develop`, MX/BR→`staging`), la sección se **omite** — no se pone placeholder ni "usa la default". Formato:

  ```markdown
  ## Base técnica (aplica a todas las historias del initiative)

  - **Rama base:** `<rama>` — <por qué existe · ej. "rama de integración del initiative X donde caen todos los RQs antes de mergear a develop">.
      - Cada historia sale de `<rama>` y su PR vuelve a `<rama>` (no a `develop`).
      - El merge de `<rama>` → `develop` se coordina al cierre del initiative (o por hitos de fase).
  - **Entorno de deploy inicial:** **<INT | staging-mx | staging-br | ...>**.
      - <regla de promoción entre entornos si aplica>.
  ```

  **Repos afectados** no van acá — los define el `/argos:spec` de cada RQ según lo que efectivamente toque, y viven en el spec del RQ (no en la épica).

---

## S1 — <título>
- **Tipo:** Story · **Épica:** EP-<SLUG> · **Label único:** `intake-<slug>-s1` · **Labels:** <labels>
- **Summary:** `[<Producto>] <título>`
- **Descripción:**

  *Como* <rol> *quiero* <acción> *para* <beneficio>.

  ## Alcance

  <párrafo del alcance de la historia · viene de stories.md>

  ## Criterios de aceptación

  - CA-XX · <criterio>
  - CA-YY · <criterio>

  ## Diseño

  - [<Nombre del frame en Figma>](<figma-url-base>?node-id=<node-id-con-guiones>)
  - [<Otro frame>](<figma-url-base>?node-id=<node-id-con-guiones>)

  ## Diagrama de secuencia

  ```mermaid
  <contenido de analysis/stories/s1.mmd si existe · sino se omite toda la sección>
  ```

<!-- repetir por historia: S2, S3, … con su label único intake-<slug>-s<n> -->
