<!-- Árbol épica → historias del intake. Cada historia = un RQ en /argos:spec. -->
# Historias · <título>

Épica: **EP-<SLUG>** — <objetivo de la épica en una línea>.

Estados de historia: `propuesta` · `en-Jira` · `en-RQ` · `cerrada`.

Prioridad: `P0` imprescindible para salir · `P1` importante · `P2` deseable. **Si todo es P0, nada es P0** (el lint avisa si más de la mitad lo es).
`Ready?` lo calcula el motor (`stories-ready.mjs`): 🟢 criterios + frame + sin dudas · 🟡 con dudas abiertas · 🟠 le falta criterio o frame · 🚧 bloqueada.

| Historia | Título | Prioridad | Ready? | Estado | Jira | RQ |
|----------|--------|-----------|--------|--------|------|----|
| EP-<SLUG>-S1 | <título> | P0 | 🟠 | propuesta | — | — |

---

<!-- Detalle por historia (usar templates/story.md). Ejemplo: -->

### EP-<SLUG>-S1 · <título>
**Como** <rol> **quiero** <acción> **para** <beneficio>.
**Criterios de aceptación:**
- [ ] Dado <contexto>, cuando <acción>, entonces <resultado>.
