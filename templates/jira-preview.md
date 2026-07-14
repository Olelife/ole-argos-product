# Jira preview · <título>

<!-- Gate de validación. Lo genera /argos-product:intake (verbo aprobar) desde el PRD §6 + Figma. -->
<!-- El dev revisa y edita ACÁ. Nada se crea hasta su OK. La creación es idempotente (ver abajo). -->

## Campos globales (confirmar)
- **Proyecto Jira:** <clave, ej. SO>
- **Épica padre:** `EP-<SLUG>` (se crea primero; su key real reemplaza el placeholder)
- **Convención de título:** `[<Producto>] <título>`
- **Labels por defecto:** <label1>, <label2>
- **Figma base:** <url del archivo>

## Idempotencia (no duplica)
Cada issue lleva un **label único**: épica `intake-<slug>-epic`, historias `intake-<slug>-s<n>`.
Antes de crear se chequea **doble llave** — (1) key en `stories.md`, (2) JQL `labels = "intake-<slug>-s<n>"`.
Si ya existe por cualquiera, **no se crea**: se reutiliza el key. Mandar dos veces = no-op.

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

  **Criterios de aceptación:**
  - Dado <contexto>, cuando <acción>, entonces <resultado> (CA-XX).
- **Diseño (Figma):**
  - <frame> → `?node-id=<node-id>`

<!-- repetir por historia: S2, S3, … con su label único intake-<slug>-s<n> -->
