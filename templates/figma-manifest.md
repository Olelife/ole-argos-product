<!-- MANIFEST de un snapshot congelado del Figma. Lo genera scripts/figma-freeze.mjs. -->
# Figma snapshot · <versión>

- **fileKey:** `<fileKey>`
- **URL:** <url con node-id>
- **Capturado:** <YYYY-MM-DD> (Argos)
- **Alcance:** <completo | solo frames cambiados vs v anterior>
- **Frames:** <N>

Los PNG viven en `frames/` (Git LFS). La estructura completa (todos los frames · node-id · tamaño) está en `structure.json` — se usa para diffear contra la próxima versión.

| Frame | node-id | Tamaño | Archivo |
|-------|---------|--------|---------|
| <name> | <id> | <w>x<h> | frames/<archivo>.png |
