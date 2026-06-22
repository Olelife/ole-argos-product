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
---

# <título>

> **Resumen para Dev** (TL;DR — completalo al final, es lo primero que lee quien toma la tarea)
> - **Qué se construye:** <1-2 líneas>.
> - **Alcance:** en = <una línea> · fuera = <una línea>.
> - **Sub-tareas:** S1 <título> · S2 <título> · S3 <título> … (detalle en §6).

## 1. Problema / Por qué
<!-- 2-3 frases: el dolor de usuario o negocio. Por qué importa AHORA. (No la solución todavía.) -->

## 2. Objetivo / Resultado
<!-- Cómo se ve el éxito. Medible si se puede (métrica + meta). -->

## 3. ✅ En alcance
<!-- La funcionalidad que se construye, en bullets concretos. Si dudás si algo entra, va a la sección 5 o 9. -->
-

## 4. 🚫 Fuera de alcance
<!-- Lo que explícitamente NO se hace en este PRD. Mata el scope creep. Sé específico. -->
-

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
- **Fórmula / orden de operaciones:** <paso a paso — qué entra en cada término>
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
