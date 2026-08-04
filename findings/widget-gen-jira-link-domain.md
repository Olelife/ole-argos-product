# Finding · `widget-gen.mjs` genera links de Jira con dominio equivocado

- **Componente:** Motor `argos-product` → `scripts/widget-gen.mjs`
- **Versión detectada:** v1.7.0
- **Severidad:** baja (cosmético/UX — el link no resuelve), fix trivial
- **Detectado:** 2026-08-04, operando el intake `cotizaciones-petra` (verbo `tickets`)

## Síntoma
Las tarjetas de historias ya creadas enlazan a un dominio inexistente y el click da 404.

## Ubicación
`scripts/widget-gen.mjs:49` (rama del `href` cuando la historia tiene key de Jira):

```js
? '<a href="https://ole.atlassian.net/browse/'+d.jira+'" ...>...'
```

## Causa
El host de Jira de Olé es **`olelife.atlassian.net`**, no `ole.atlassian.net`. Se confirma con el `webUrl` que devuelve la API de Atlassian para cualquier issue del proyecto SO (p. ej. `https://olelife.atlassian.net/browse/SO-668`).

## Fix propuesto
Cambiar el dominio en la línea 49:

```diff
-    ? '<a href="https://ole.atlassian.net/browse/'+d.jira+'" style="font-size:13px; ...
+    ? '<a href="https://olelife.atlassian.net/browse/'+d.jira+'" style="font-size:13px; ...
```

Mejor aún, parametrizarlo para no hardcodear el host (defensa a futuro): aceptar un `jiraBase` (arg o env, default `https://olelife.atlassian.net`) e interpolarlo, igual que ya se parametriza el proyecto (`proj`).

## Impacto / alcance
- Afecta a **todos** los intakes que emiten el widget de tickets, no solo `cotizaciones-petra`.
- Solo el enlace de tarjetas "ya en Jira"; la creación idempotente (`sendPrompt`) no usa el host, así que no afecta el alta de historias.

## Verificación
Tras el fix, regenerar el widget de cualquier intake con historias creadas y confirmar que las tarjetas abren `https://olelife.atlassian.net/browse/SO-###`.

## Nota de proceso
Registrado como **finding** (no aplicado al Motor) según la constitución: un RQ/intake no modifica el Motor por efecto colateral; el cambio va por PR + review al repo `ole-argos-product`. Mientras tanto, el widget que se mostró al usuario en la sesión ya lleva el dominio corregido a mano.
