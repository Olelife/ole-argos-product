---
name: setup
description: Onboarding del workspace de Argos-Producto — arma el taller (plantilla de workspace con el Motor instalado, config local y ficha de verbos al día) y baja el cerebro RECORTADO y read-only (domain/, architecture/flows/, glossary.md) más el repo de datos de intakes. Corré esto UNA vez tras instalar el plugin argos-product en un workspace nuevo (o cuando falte el cerebro), y el verbo taller cada vez que actualices el Motor. Disparadores: "/argos-product:setup", "preparar el workspace de producto", "bajá el cerebro", "armá el taller", "dejá listo el workspace para alguien nuevo", "refrescá la ficha de verbos".
---

# /argos-product:setup — preparar el taller de Producto

Deja el workspace listo para escribir PRDs: arma el **taller** (Motor instalado, config local y ficha de
verbos), baja el cerebro (`ole-argos-brain`) **recortado y SOLO LECTURA** (`domain/`, `architecture/flows/`,
`findings/`, `glossary.md`) y el repo de **datos** de intakes. No clona repos de código.

> Narro en voz de **Argos**, sobrio. Persona y reglas: `CONSTITUTION.md`.

## Verbos

### `clonar` (default) — bajar cerebro + datos
```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/setup.sh"
```

### `taller` — armar (o refrescar) la plantilla de workspace
Disparadores: "armá el taller", "dejá el workspace listo para alguien nuevo", "refrescá la ficha de verbos", "actualizá el CLAUDE.md del taller".
```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/workspace-init.sh" [destino]
```
Deja en la carpeta un `.claude/settings.json` que declara el marketplace y habilita el Motor, un
`CLAUDE.md` con las reglas del taller y la **ficha de verbos generada desde los propios skills**, un
`README.md` de puesta en marcha, `config.local.conf` y `.gitignore`. Es **idempotente**: fusiona el
settings existente sin pisar otros plugins, respeta los archivos ya creados y regenera solo los bloques
entre marcadores (`<!-- argos:verbos -->` y `<!-- argos:intakes -->`) — la prosa del equipo queda intacta.
Si el repo de datos ya está clonado, la ficha lista además los **slugs vivos con su estado**.
- Corrélo **al actualizar el Motor** (`/argos-product:update`) para que la ficha no quede vieja.
- Para alguien nuevo el orden es: `taller` → abrir la carpeta con Claude Code → `clonar` → `taller` otra vez.

## Reportar
- Si el cerebro quedó clonado (recortado) en `repos/ole-argos-brain`.
- Recordá que el cerebro es **SOLO LECTURA** (lo cura Dev; Producto no lo modifica).
- Si el clone falla, suele ser **acceso**: confirmá que tenés permiso **read-only** a `Olelife/ole-argos-brain`.
- Cuando esté, arrancá un PRD con **`/argos-product:prd`** o abrí el panel con **`/argos-product:intake`**.
- Si armaste el taller, decí cuántos skills, verbos e intakes quedaron en la ficha y cuál es el próximo paso.
