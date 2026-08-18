<!--
Plantilla de la sección "Orden de ejecución · roadmap por fase" que consume
el verbo `roadmap` del skill argos-product:intake para generar roadmap-mvp.html.

Cómo usarla:
1. Pegá el bloque en tu `stories.md` justo después del "Resumen del índice"
   (o donde encaje mejor · no importa el lugar exacto, el script busca el
   heading `## Orden de ejecución · roadmap por fase`).
2. Editá los nombres de las fases y las historias con los datos del intake.
3. Corré `/argos-product:intake roadmap <slug>`.

Formato que el script espera:
- Heading H2: `## Orden de ejecución · roadmap por fase`
- Un H3 por fase con formato: `### Fase <N> · <emoji> <título> *(<descripción opcional>)*`
- Debajo de cada H3, una tabla con columnas: `Historia | Título | Ready?`
- Estados Ready? con emoji: 🟢 (listo) · 🟡 (with questions) · 🟠 (need validate) · 🚧 (bloqueada)

Si tu intake no tiene esta sección, el verbo `roadmap` va a pedirte agregarla
antes de generar el HTML.
-->

## Orden de ejecución · roadmap por fase

Cambiá esta introducción por una descripción corta del criterio con el que agrupaste las fases.

### Fase 1 · 👀 <Nombre de la fase> *(descripción corta opcional entre paréntesis con asteriscos)*
| Historia | Título | Ready? |
|----------|--------|--------|
| S1 | <Título de la historia> | 🟢 |
| S2 | <Título de la historia> | 🟡 |

### Fase 2 · ✏️ <Nombre de la fase>
| Historia | Título | Ready? |
|----------|--------|--------|
| S3 | <Título de la historia> | 🟠 (opcional · nota entre paréntesis después del emoji) |

### Fase N · <emoji> <Nombre de la fase>
| Historia | Título | Ready? |
|----------|--------|--------|
| Sxx | <Título de la historia> | 🚧 (bloqueada · duda #NN) |

### Descartadas *(opcional)*
| Historia | Motivo |
|----------|--------|
| ~~S14~~ | <por qué se descartó · ref a decision-log> |
