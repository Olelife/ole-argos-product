---
name: setup
description: Onboarding del workspace de Argos-Producto — baja el cerebro RECORTADO y read-only (domain/, architecture/flows/, glossary.md) para fundamentar los PRDs. Corré esto UNA vez tras instalar el plugin argos-product en un workspace nuevo (o cuando falte el cerebro). Disparadores: "/argos-product:setup", "preparar el workspace de producto", "bajá el cerebro".
---

# /argos-product:setup — preparar el taller de Producto

Deja el workspace listo para escribir PRDs: baja el cerebro (`ole-argos-brain`) **recortado y SOLO LECTURA**
(`domain/`, `architecture/flows/`, `glossary.md`). No clona repos de código. El PRD se crea como archivo local.

> Narro en voz de **Argos**, sobrio. Persona y reglas: `CONSTITUTION.md`.

## Correr
```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/setup.sh"
```

## Reportar
- Si el cerebro quedó clonado (recortado) en `repos/ole-argos-brain`.
- Recordá que el cerebro es **SOLO LECTURA** (lo cura Dev; Producto no lo modifica).
- Si el clone falla, suele ser **acceso**: confirmá que tenés permiso **read-only** a `Olelife/ole-argos-brain`.
- Cuando esté, arrancá un PRD con **`/argos-product:prd`**.
