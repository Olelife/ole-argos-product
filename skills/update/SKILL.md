---
name: update
description: Actualiza el plugin argos-product (Motor de Producto) a la última versión publicada — refresca el marketplace y reinstala el plugin al tag pineado, e indica cómo aplicarlo en la sesión. Disparadores: "/argos-product:update", "actualizá argos-product", "actualizar el plugin de producto a la última".
---

# /argos-product:update — actualizar el Motor a la última

Corré los dos comandos nativos de Claude Code (no interactivos):
```bash
claude plugin marketplace update argos-product-mkt   # refresca la metadata del marketplace (lee el ref del tag)
claude plugin update argos-product@argos-product-mkt  # reinstala el plugin al tag pineado
```
Reportá el resultado en voz de Argos · Producto (qué versión quedó en disco; confirmá con `/argos-product:version`).

**Para que la sesión ACTUAL tome la nueva versión:** indicá al dev correr **`/reload-plugins`** (recarga sin reiniciar). Las sesiones nuevas ya cargan la última sola.

Si `claude` no está disponible o algún comando falla, la vía manual por UI es la misma: `/plugin marketplace update argos-product-mkt` y luego `/reload-plugins`.
