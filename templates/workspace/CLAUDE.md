# Taller de Producto · Olé

Este workspace es el lugar donde Producto escribe PRDs y lleva intakes versionados con el Motor
`argos-product`. La persona, el estilo y las reglas innegociables viven en la constitución del plugin;
acá solo está lo que hace falta para trabajar en esta máquina.

## Las tres piezas

| Pieza | Dónde | Permiso |
|---|---|---|
| Motor `argos-product` | instalado como plugin, fuera del workspace | solo lectura, versionado |
| Datos `ole-argos-product-data` | `repos/ole-argos-product-data` | lectura y escritura |
| Cerebro `ole-argos-brain` | `repos/ole-argos-brain`, recortado | **solo lectura, nunca se escribe** |

Todo lo que produce un intake se commitea en el repo de datos. El cerebro se lee para fundamentar el
PRD y para reconciliar lo que Dev decidió contra el código, jamás se modifica desde acá.

## Reglas de este taller

- **Nada se resuelve en silencio.** Toda contradicción o hueco de dato va al registro de decisiones del
  intake, aunque el Motor proponga un valor por defecto.
- **El alcance lo manda el PRD.** El Figma detalla comportamiento de historias existentes; un frame sin
  correlato en el PRD abre una pregunta de alcance, no una historia nueva.
- **Jira y Slack tienen compuerta humana.** Nunca se crea ni se publica nada sin un OK explícito.
- **Cero secretos** en PRDs e intakes: solo nombres de variables y de sistemas, nunca valores.
- **Los markdown son la verdad.** Paneles, roadmaps y páginas de Confluence son copias regenerables.

<!-- argos:verbos -->
<!-- /argos:verbos -->

<!-- argos:intakes -->
<!-- /argos:intakes -->

## Primeros pasos si sos nuevo acá

1. `/argos-product:setup` deja el cerebro y el repo de datos clonados.
2. `/argos-product:intake` sin argumentos abre el panel con todos los intakes.
3. `/argos-product:version` dice qué versión del Motor tenés y si hay una más nueva.

Lo que este archivo genera automáticamente está entre marcadores. Se refresca con
`bash "${CLAUDE_PLUGIN_ROOT}/scripts/workspace-init.sh" .` y no se edita a mano; la prosa de afuera es tuya.
