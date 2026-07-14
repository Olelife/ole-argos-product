# ole-argos-product 🗿

**Argos para el equipo de Producto.** Un plugin de Claude Code que te ayuda a escribir PRDs
estandarizados de Olé: funda el análisis en el conocimiento ya curado (cerebro, read-only),
**acota el alcance**, desglosa **épicas → historias**, y deja **explícito lo que falta definir** —
sin sobrecargarte de preguntas.

## Qué hace
- `/argos-product:prd` — crea o refina un **PRD suelto** (`PRD-<slug>.md` local) a partir de tu insumo (borrador, Figma, ticket).
- `/argos-product:intake` — gestiona un **intake versionado** en el repo de datos: PRD + **Figma congelado** por versión + decision-log de dudas + estados + dashboard.
- Lee el cerebro **solo para fundamentar** (domain, flows, glossary); **nunca lo modifica**.
- `/argos-product:setup` — clona el cerebro recortado (read-only) y el repo de datos `ole-argos-product-data` (read-write).

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

Standard del PRD: `standards/prd.md`. Template: `templates/prd.md`. Ejemplo: `examples/`.
