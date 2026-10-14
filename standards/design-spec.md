# Estándar · especificación desde el código fuente de Claude Design

Cuando el diseño de un intake es un prototipo de Claude Design, además de (o en vez de) capturas se congela su
**código fuente** y se extrae, por pantalla y estado, lo que Dev construye: cada elemento con su valor y su token, los
textos exactos y lo que Diseño tiene que validar. Lo ejecuta el verbo `specs` de `/argos-product:intake`.

Nació suelto en el repo de datos (`docs/intake-structure.md` + `tools/design-spec/`) y se usó en `incentivos-petra`
(`figma/v4`, 2026-10-08) y `roles-permisos-petra` (`figma/v2`, 2026-10-12). Los scripts del Motor reproducen esas dos
extracciones byte a byte; lo que cambió es lo que estaba fijo a un portal (barra lateral, sistema de tokens, fecha).

## Estructura

```
figma/<vN>/
  MANIFEST.md                       hash del zip, qué se guardó, revisión de seguridad, mapa pantalla → historias
  <superficie>/                     un proyecto de Claude Design (backoffice, asesores…)
    source/                         código fuente congelado: SOLO lo vigente
      <Archivo>.dc.html | .html     el archivo vigente (el `?file=` del proyecto) y el prototipo navegable si es otro
      <Componente>.dc.html          lo que importa con <dc-import name="…">
      support.js · assets/ · _ds/<ds>/   runtime, logos y el sistema de diseño (tokens/*.css, bundle, readme)
    specs/<id>-<pantalla>/          una carpeta por pantalla (rp-01-usuarios, s1-listado…)
      raw-<estado>.json             lo que extrajo el navegador, un archivo por estado (evidencia; se commitea)
      spec.json · copy.md · token-findings.json   generados por design-spec.mjs
      notas.md                      curado por Argos (tabla fija)
      a-validar.md                  generado por design-avalidar.mjs (marcador <!-- auto -->)
```

## 1 · Congelar (`design-freeze.mjs`)

- **Export:** Share → Export → Project HTML → "Project archive" (.zip), bajado con Claude in Chrome (el navegador de
  la app no tiene sesión en claude.ai) y **con confirmación en el chat por cada descarga** (archivo, proyecto, tamaño).
- **Se guarda:** las entradas (`--entry` o el `?file=` de `--project-url`), sus `dc-import` (recursivo), todo `src`/`href`
  relativo que exista en el zip (incluido un `uploads/` que el prototipo sí use), los `import` relativos de sus scripts y los
  `@import`/`url()` de sus hojas de estilo, `assets/` y `_ds/`.
- **No se guarda:** versiones anteriores (`<Nombre> vN.dc.html` de la misma familia), otros archivos del proyecto,
  `uploads/` sin referenciar, `scratch/`, `export/` ni metadatos (`.thumbnail`, `.image-slots.state.json`).
- **Revisión de seguridad** sobre todo lo que se guarda que no sea binario (sin filtrar por extensión): claves de AWS/GitHub/Slack/Google/Stripe, `sk-…`, JWT, claves
  privadas, secretos asignados, URLs con usuario y clave, `Bearer`. **Una sola coincidencia frena todo (exit 3)**: el PM
  mira los hallazgos (enmascarados) y solo con su OK se vuelve a correr con `--accept-findings`. Correos, CPF/CNPJ y CURP
  se listan para confirmar que son datos de ejemplo del prototipo.
- Una versión congelada **no se pisa**: un export nuevo va a `v<N+1>` (`--force` solo para rehacer la misma).
- Zip-slip: una entrada con `..`, ruta absoluta o `\` aborta la lectura.

## 2 · Extraer (navegador de la app, `design-serve.mjs` + `design-extract.js`)

- `design-serve.mjs <figma/vN>` sirve la versión en `127.0.0.1` (los `.dc.html` no abren con `file://`), solo atiende
  pedidos con Host/Origin locales y solo acepta escribir `raw-*.json` bajo `<superficie>/specs/<pantalla>/`.
- Viewport **1440×900**. Se inyecta `design-extract.js` desde `/__extract.js`.
- **Barra lateral** (el menú del portal no es parte de la pantalla): `__side()` la detecta sola — `<nav>`/`<aside>`
  anclado a la izquierda y de alto completo (un riel de íconos incluido), un bloque fixed/sticky con esa forma, o la
  columna izquierda de un layout en fila (≤ 300 px); la heurística vieja por texto («Mi Agencia», «Contratos») queda de
  último recurso. Se fuerza con `window.__argos = { side: '<selector>' | <px> | 'none' }`; `window.__sideX` sigue valiendo.
  Un drawer a la derecha no cuenta. El raw guarda `sideX` y `sideBy`.
- **Estados:** por clic, o en un `.dc.html` por su state (`__logicKeys()`, `__findLogic(clave)`, `__cap(ruta, estado, patch)`).
  En los estados con modal la extracción incluye la pantalla de fondo. Un estado que el prototipo no tiene no se inventa.

## 3 · Formatos

**`raw-<estado>.json`** — el nombre en kebab-case ASCII (`raw-sin-resultados.json`); la etiqueta (`label`) puede llevar acentos. `{ label, url, viewport, pageH, sideX, sideBy, tokens, nodes[] }`; cada nodo con texto
propio, fondo, borde o sombra: `{ i, tag, text?, x, y, w, h, font?: "familia|tamaño|peso|alto de línea|transform|espaciado", color?, deco?, bg?, border?, radius?, shadow?, pad? }`. Colores en `#RRGGBB` o `#RRGGBB@alfa`.

**`spec.json`** — contrato con Dev, ver abajo:
```json
{ "source": "Roles y Permisos.html",
  "designSystem": "Olé — Portal de Asesores (figma/v2/backoffice/source/_ds/<ds>/tokens)",
  "states": [ { "state": "todos", "viewport": [1440, 900], "elements": [
    { "i": 0, "tag": "span", "box": [x, y, w, h], "text": "Usuarios internos",
      "font": { "family": "Plus Jakarta Sans", "size": "22px", "sizeToken": "var(--text-heading)", "weight": "600", … },
      "color": { "value": "#18252C", "token": "var(--text-strong)", "aliases": [] },
      "background": {…}, "border": { "width": "1px", "color": {…} }, "radius": { "value": "8px", "token": "var(--radius-lg)" },
      "shadow": { "value": "…", "token": null }, "padding": "8px 12px" } ] } ] }
```
El nombre del sistema sale de `--system` o del `readme.md` del `_ds/` congelado; las escalas (`--text-*` en px,
`--radius-*`, `--shadow-*`) y la familia tipográfica (`--font-*`), de sus tokens. Un color toma el primer token con ese
hex (los demás van en `aliases`).

**`copy.md`** — `# Textos de la pantalla`, una sección `## <estado>` por estado y una línea por texto en orden de
lectura: `` - `13px/400` Texto ``. Desde el segundo estado solo los textos nuevos.

**`token-findings.json`** — `[ { tipo, valor, usos, ejemplos[≤4], escala } ]`: tamaño de letra fuera de la escala,
fuente distinta, color de texto / fondo / borde sin token, radio fuera de la escala, sombra sin token.

**`notas.md`** — curado por Argos, una tabla con este encabezado exacto (`templates/design-notas.md`):

| # | Qué muestra el diseño | PRD / decisión | Para Diseño |
|---|---|---|---|
| 1 | lo que muestra el prototipo, con el texto literal entre comillas | `S<n>` · `CA-x` · `#<duda> (estado; default)` · "El PRD no lo menciona" | `Coincide` · `Sin observación` · la acción concreta |

Una fila por diferencia o coincidencia relevante con el PRD §6 y el decision-log. Toda contradicción con el PRD es
además una fila `abierta` del decision-log. El lint avisa si falta o si la tabla no tiene ese encabezado.

**`a-validar.md`** — `<!-- auto -->`, título `<Pantalla> — a validar con Diseño`, historias, fuente, fecha del export,
viewport, estados y sistema de referencia; **§1** = `notas.md`; **§2** = `token-findings.json` agrupado por tipo con la
escala del sistema. Un `a-validar.md` sin el marcador es manual y no se pisa.

**`MANIFEST.md`** (`templates/design-manifest.md`) — dos tablas que los scripts editan por fila (la prosa es del PM):
- `| Carpeta | Proyecto Claude Design | Archivos vigentes | Zip original (sha256, 16 car.) |` (design-freeze), más un
  renglón por superficie en "Qué se guardó y qué no" con la revisión de seguridad.
- `| Carpeta | Pantalla | Historias | Estados extraídos |` — **el mapa pantalla → historias**. Carpeta =
  `` `<superficie>/specs/<pantalla>/` `` (se acepta el nombre pelado si es único); Pantalla e Historias las escribe
  Argos (`S19 (SO-1357), S23 (SO-1361)`); Estados extraídos lo mantiene `design-link.mjs`.

## 4 · Enlazar (`design-link.mjs`)

Por cada historia de la columna Historias, idempotente:
- PRD §6, después de `**Diseño:**`: `**Especificación (vN):** figma/vN/<sup>/specs/<p>/ (spec.json · copy.md · a-validar.md).`
- `stories.md`, al final de la sección de la historia: `` - Spec vN: `figma/vN/<sup>/specs/<p>/` (spec.json · copy.md · a-validar.md) ``
- `jira-preview.md`, dentro de `## Diseño`: el bloque **Especificación desde el código fuente del diseño (vN, sistema de
  diseño <nombre>[, #duda])** con links absolutos al repo de datos (`OLE_DATA_REPO_URL`, default `main`).
Una historia ya en Jira se actualiza con `jira-diff.mjs` (cuenta el link como `+ spec del diseño`) y `editJiraIssue` con OK.
`stories-ready.mjs` cuenta un link a `specs/` o a `claude.ai/design` como anclaje de diseño.

## Contrato con Dev (OlePilot)

`design-source.sh` y `design-check.sh` del Motor de Dev leen estos archivos desde el link del ticket. **No cambiar sin
coordinar con `ole-argos-engine`:**
- rutas `figma/<vN>/<superficie>/specs/<pantalla>/{spec.json,copy.md,a-validar.md,notas.md}` y
  `figma/<vN>/<superficie>/source/_ds/<ds>/tokens/*.css` (lo congela al commit);
- `designSystem` = `"<nombre> (<ruta>)"`: Dev toma el nombre hasta ` (` y decide «Petra» si lo contiene;
- `states[].state`, `states[].elements[]` y los `{ "token": "var(--x)" }` de sus valores (Dev junta todos los `var(--x)` del archivo);
- las líneas `` - `tam/peso` texto `` de `copy.md`.

## STATUS

`figma_version: <vN>` apunta a la versión con el código fuente. `figma_url` acepta la URL del proyecto de Claude Design
(`https://claude.ai/design/p/…`), plana o anidada por superficie.
