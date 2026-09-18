---
prd: PRD-<slug>.md
prd_version: <vN>
reviewed: <YYYY-MM-DD>
score: <suma>/25
verdict: <listo | casi | rehacer>   # ≥20 listo · 15–19 casi · <15 rehacer
---

# Review del PRD · <título>

<!-- Lo escribe el verbo `review` de /prd (rúbrica) después de leer el PRD completo, el standard y el cerebro.
     Es lectura cualitativa: complementa a prd-check (mecánico), no lo reemplaza. Cada puntaje cita evidencia
     del propio PRD (sección o cita textual), nunca una impresión. Se re-corre con cada versión; el anterior
     queda en git. -->

## Puntaje

| Dimensión | 1–5 | Evidencia (cita del PRD) | Qué falta para el 5 |
|---|---|---|---|
| **Claridad** — un Dev que no estuvo en la reunión entiende qué construir sin preguntar | | | |
| **Alcance** — en/fuera/complementario nítidos; nada desvía; los `→ fuera del mapa` están resueltos | | | |
| **Verificabilidad** — cada historia con criterios Dado/cuando/entonces (o EARS) que QA puede ejecutar; catálogo de valores y estados | | | |
| **Evidencia** — el problema y las reglas citan su fuente (ticket, bug, TC del QA, finding, dato); nada afirmado "porque sí" | | | |
| **Prioridad** — P0/P1/P2 declaradas y defendibles; si todo es P0, nada es P0 | | | |

**Total: <suma>/25 · <veredicto>**

## Las 3 correcciones que más suben el puntaje
1. <acción concreta · sección>
2. <acción concreta · sección>
3. <acción concreta · sección>

## Riesgos que el PRD no nombra
<!-- Lo que el cerebro (flows, findings) o el Figma sugieren y el PRD calla: dependencias, datos que no existen, reglas ya decididas por Dev. -->
-

## Lo que está bien y no hay que tocar
-
