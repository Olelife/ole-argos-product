<!-- MANIFEST de una versión de diseño congelada desde el código fuente de Claude Design.
     Lo crea scripts/design-freeze.mjs. Las tablas y la lista de "Qué se guardó" las mantienen los scripts
     (design-freeze, design-link) por fila; la prosa es del PM. Estándar: standards/design-spec.md del Motor. -->
# Diseño <vN> · código fuente congelado (Claude Design · Project HTML)

- **Captura:** <YYYY-MM-DD>, export "Project archive" (.zip) de Claude Design, descargado por Argos desde Chrome con confirmación en el chat.
- **Qué es:** el HTML/CSS fuente del prototipo, no capturas. Sirve para extraer valores exactos (estilos, tokens, textos y estados) y para diffear contra la próxima versión.
- **Capturas (imágenes):** <en esta versión o en vM/frames/>.

## Código fuente por superficie

| Carpeta | Proyecto Claude Design | Archivos vigentes | Zip original (sha256, 16 car.) |
|---|---|---|---|

## Qué se guardó y qué no

## Sistema de diseño del prototipo

<nombre del sistema (de `_ds/<ds>/readme.md`), escalas de tokens y si es el del portal destino o no (duda # del decision-log).>

## Especificación por pantalla

Extraída con `/argos-product:intake specs` (estándar `standards/design-spec.md` del Motor). Cada carpeta trae `spec.json` (cada elemento con su valor y su token), `copy.md` (textos), `token-findings.json`, `notas.md` y `a-validar.md`. La columna **Historias** la completa Argos; **Estados extraídos** la mantiene `design-link.mjs`.

| Carpeta | Pantalla | Historias | Estados extraídos |
|---|---|---|---|

## Cómo verlo

Los archivos necesitan servirse por HTTP: con el Motor, `node <motor>/scripts/design-serve.mjs intakes/<slug>/figma/<vN>` y abrir `http://127.0.0.1:8765/<superficie>/source/<archivo>`.
