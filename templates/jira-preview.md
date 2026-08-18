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
- **Descripción:** <objetivo de la épica; base PRD + Figma>

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
