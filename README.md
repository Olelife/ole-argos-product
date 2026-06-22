# ole-argos-product 🗿

**Argos para el equipo de Producto.** Un plugin de Claude Code que te ayuda a escribir PRDs
estandarizados de Olé: funda el análisis en el conocimiento ya curado (cerebro, read-only),
**acota el alcance**, desglosa **épicas → historias**, y deja **explícito lo que falta definir** —
sin sobrecargarte de preguntas.

## Qué hace
- `/argos-product:prd` — crea o refina un PRD a partir de tu insumo (borrador, Figma, ticket).
- Lee el cerebro **solo para fundamentar** (domain, flows, glossary); **nunca lo modifica**.
- Produce un **archivo local** (`PRD-<slug>.md`) que entregás como hoy. No hay repo de salida.
- `/argos-product:setup` — baja el cerebro recortado y read-only (una vez).

## Instalar
```bash
claude plugin marketplace add Olelife/ole-argos-product
claude plugin install argos-product@argos-product-mkt --scope project
# reiniciá Claude Code, luego:  /argos-product:setup
```

## Modelo (importante)
```
Producto  ── lee (read-only) ──►  ole-argos-brain   (lo escribe Dev, no Producto)
          ── escribe ──►          PRD-<slug>.md (archivo local, lo entregás)
                                       │
Dev  /argos:spec  ◄────────────────────┘  (cada historia del PRD → un RQ)
```

> **Permisos:** los miembros de Producto deben tener acceso **read-only** a `Olelife/ole-argos-brain`.
> Ese permiso es la garantía dura de que Producto no puede modificar el cerebro; el plugin, además,
> no tiene ninguna skill que lo escriba.

Standard del PRD: `standards/prd.md`. Template: `templates/prd.md`. Ejemplo: `examples/`.
