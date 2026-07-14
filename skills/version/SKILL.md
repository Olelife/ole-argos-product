---
name: version
description: Muestra la versión del plugin argos-product (Motor de Producto) con la que estás trabajando — instalada vs última publicada — y si estás atrasado, cómo actualizar. Disparadores: "/argos-product:version", "qué versión de argos-product tengo", "¿estoy en la última del plugin de producto?".
---

# /argos-product:version — versión del plugin (Motor)

Corré:
```
bash "${CLAUDE_PLUGIN_ROOT}/scripts/version-check.sh" --show
```

Reportá lo que devuelve, en voz de Argos · Producto: versión **instalada**, **última publicada** y el estado (al día / atrasado / build local).

- Si estás **atrasado**: actualizá con **`/argos-product:update`** (o el nativo `/plugin marketplace update argos-product-mkt`) y **recargá** (`/reload-plugins` o reiniciá).
- Si el script **no pudo consultar la última** (sin red o sin acceso a `Olelife`), reportá solo la instalada y aclaralo.
