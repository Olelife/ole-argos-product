<!-- Template de PRD (Olé · Argos-Producto). Borrá los comentarios <!-- --> al completar. -->
<!-- Nombre del archivo: PRD-<slug>.md  ·  Valídalo con: scripts/prd-check.sh PRD-<slug>.md -->
---
title: <título corto y claro>
epic: EP-<SLUG>            # id de la épica (estable); las historias cuelgan de acá
pm: <dueño/a del PRD>
status: draft              # draft | in-review | ready (listo para /argos:spec)
date: <YYYY-MM-DD>
country: <MX | BR | ...>
capability: <kebab-en>     # debe matchear o referenciar un architecture/flows/<capability>.md del cerebro
figma: <url o "—">
stage: encuadre            # etapa alcanzada del recorrido guiado: encuadre | breadboard | diseno | cierre (RFC-003)
path: greenfield           # greenfield (alcance en texto ANTES del Figma) | retro (PRD sobre un diseño ya hecho)
---

# <título>

<!-- Lo que no sabés todavía NO se asume: dejalo marcado en el lugar exacto con `[POR DEFINIR: pregunta — dueño]`.
     prd-check los cuenta; `aprobar` exige cero (se resuelven o pasan a §7 Preguntas abiertas con dueño). -->

> **Resumen para Dev** (TL;DR — completalo al final, es lo primero que lee quien toma la tarea)
> - **Qué se construye:** <1-2 líneas>.
> - **Alcance:** en = <una línea> · fuera = <una línea>.
> - **Sub-tareas:** S1 <título> · S2 <título> · S3 <título> … (detalle en §6).

## 1. Problema / Por qué
<!-- 2-3 frases: el dolor de usuario o negocio. Por qué importa AHORA. (No la solución todavía.) -->

**Evidencia:**
<!-- Cada afirmación del problema cita su fuente, con tamaño cuando lo hay. Sin fuente es opinión, no problema.
     Fuentes válidas: bugs/tickets de Jira (SO-123), casos del QA (TC-12), findings del cerebro (findings/x.md),
     chunks del RAG (RAG: ruta), tickets de soporte, datos ("34 pólizas en septiembre"). -->
- <hecho> — <fuente> (<tamaño/fecha>)

## 2. Objetivo / Resultado
<!-- Cómo se ve el éxito. Medible si se puede (métrica + meta). -->

## 3. ✅ En alcance
<!-- La funcionalidad que se construye, en bullets concretos. Si dudás si algo entra, va a la sección 5 o 9. -->
-

## 4. 🚫 Fuera de alcance
<!-- Lo que explícitamente NO se hace en este PRD. Mata el scope creep. Sé específico. -->
-

## 5.0 Mapa: módulo → pantallas → acciones (breadboard)
<!-- Solo palabras y líneas, sin wireframes (Shape Up). Es la COMPUERTA DE ALCANCE: cuando esta tabla está
     completa y aprobada, el alcance queda congelado en texto, antes del Figma. Obligatoria con path: greenfield;
     recomendada con path: retro. Cada fila es candidata a criterio en §6; la columna Roles arma la matriz de §5;
     todo "→ fuera del mapa" obliga a una fila en §4 (fuera) o §9 (dependencia) — nunca queda implícito. -->
| Pantalla (*place*) | Acción (*affordance*) | Para qué | Roles | Efecto | ¿Se extiende a? |
|---|---|---|---|---|---|
| <pantalla> | <acción> | <valor para el usuario> | <roles> | <qué pasa> | `cierra` · `→ <pantalla del mapa>` · `→ <módulo/sistema fuera del mapa>` |

## 5. Comportamiento de producto
<!-- El corazón del PRD. Por cada flujo: estados, reglas de negocio, validaciones, permisos,
     casos borde, estados vacíos y de error. Anclá a frames de Figma cuando aplique. -->

### Catálogo de valores (enumeraciones) — si aplica
<!-- Fuente de verdad de los campos tipo enum: una tabla por campo, con valores permitidos y
     (si hay máquina de estados) las transiciones. Lo usan Dev y QA. Borrá si no aplica. -->
| Valor | Descripción | Transiciones permitidas |
|-------|-------------|-------------------------|
| <valor> | <qué significa> | → <valores a los que puede pasar> (o "final") |

### Roles y permisos — si hay varios roles
<!-- Matriz rol × acción/módulo (ej. CRUD). Más clara que prosa cuando hay múltiples roles. -->
| Acción / Módulo | <Rol A> | <Rol B> |
|-----------------|---------|---------|
| <acción> | <permiso> | <permiso> |

### Cálculo — si la feature ES un cálculo
<!-- La LÓGICA es producto y va acá; los VALORES se referencian en su fuente pinneada (no se copian).
     Insumo = este PRD + ese artefacto, juntos. Conciso. -->
- **Fórmula / orden de operaciones:** <paso a paso — un **diagrama ASCII del pipeline** suele leerse mejor que la prosa>
- **Redondeo / precisión:** <regla, si aplica>
- **Valores (tablas/tarifas):** ver `<artefacto>` v`<x>`, pestañas/rangos `<...>` — fuente **pinneada**.


## 6. Épicas → Historias
<!-- Desglose para no perder el control del alcance. Cada historia con id estable y criterios verificables.
     Cada historia se convierte en UN RQ en /argos:spec. Usá templates/story.md por historia. -->

### EP-<SLUG>-S1 · <título de la historia>
**Como** <rol> **quiero** <acción> **para** <beneficio>.
**Criterios de aceptación:**
- [ ] Dado <contexto>, cuando <acción>, entonces <resultado esperado>.

<!-- repetí por historia: S2, S3, … -->

## 7. ❓ Preguntas abiertas
<!-- Toda definición pendiente, explícita. Nada se asume en silencio. -->
| # | Pregunta | Dueño | Estado |
|---|----------|-------|--------|
| 1 | <qué falta definir> | <quién responde> | open |

## 8. 📎 Contexto complementario (NO es parte de este trabajo)
<!-- Info que refuerza el análisis pero NO se construye acá. Sirve para entender, no para hacer.
     Marcá explícito por qué es complementario y no alcance. -->

## 9. Dependencias / Supuestos
<!-- Otros equipos, servicios, datos o decisiones de las que depende esto. Supuestos que estás haciendo. -->
-
