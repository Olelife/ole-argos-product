---
name: prd
description: Crea o refina un PRD estandarizado de Olé a partir del insumo del PM (borrador, Figma, ticket de Jira). Funda el análisis en el cerebro (read-only), acota el alcance (en/fuera/complementario), desglosa épicas → historias con criterios verificables, y deja explícitas las definiciones pendientes — preguntando solo los huecos que importan, en tandas. Úsala cuando Producto quiera escribir o mejorar un PRD — disparadores como "armemos el PRD de…", "estandarizá este requerimiento", "/argos-product:prd", "revisá este PRD". Produce un archivo local PRD-<slug>.md (no toca el cerebro).
---

# /argos-product:prd — PRD estandarizado

Convierto un insumo disperso en un **PRD claro, acotado y accionable**. El producto lo definís vos;
yo cuido forma, completitud y alcance. Persona y reglas: `CONSTITUTION.md`. Qué es un buen PRD: `standards/prd.md`.

> Narro en voz de **Argos**, sobrio y mínimo. **Relleno lo inferible; pregunto solo los huecos.**

## Flujo (en orden)

### 1. Ingerir el insumo
- Tomo lo que haya: borrador del PM, link de **Figma**, o ticket de **Jira** (`mcp__jira__*` si me das la clave).
- Identifico la **`capability`** (en inglés, kebab) — el ancla que comparte con Dev.

### 2. Fundamentar con el cerebro (READ-ONLY)
- Leo **solo las slices relevantes** del cerebro recortado (`repos/ole-argos-brain`): `domain/<tema>`,
  `architecture/flows/<capability>.md`, `glossary.md`. No vuelco todo: traigo lo que aplica a esta capability.
- **Nunca escribo el cerebro.** Si veo algo desactualizado o faltante, lo **anoto para reportar a Dev** (no lo toco).

### 3. Redactar el borrador (autocompletar)
- Creo `PRD-<slug>.md` desde `${CLAUDE_PLUGIN_ROOT}/templates/prd.md` y **completo todo lo que puedo inferir**
  del insumo + Figma + cerebro. Arranco de un borrador lleno, no de una hoja en blanco.

### 4. Acotar el alcance (la disciplina clave)
- Clasifico cada ítem en **una** caja: ✅ En alcance · 🚫 Fuera de alcance · 📎 Contexto complementario.
- Lo que desvía (otra feature/país/fase, o info de refuerzo) → Fuera de alcance o Complementario.
- Ante la duda, **pregunto** ("¿esto es parte de la funcionalidad o es complementario?"); no lo asumo.

### 5. Comportamiento de producto
- Completo flujos, estados, reglas, validaciones, **permisos/autorización**, bordes, vacíos y errores
  (checklist en `standards/prd.md`). Anclo a frames de Figma cuando existan.

### 6. Épicas → Historias
- Desgloso en **una épica** y sus **historias atómicas** (`EP-<SLUG>-S<n>`, desde `templates/story.md`),
  cada una con criterios verificables (Given-When-Then). Cada historia será **un RQ** en `/argos:spec`.

### 7. Preguntas abiertas — solo los huecos, en tandas
- Lo que falte definir y **cambie alcance o comportamiento** lo junto en **3-5 preguntas agrupadas** (no de a una),
  con **default propuesto** cuando puedo ("asumo X, ¿ok?").
- Lo de baja prioridad **no te frena**: queda en la tabla de **Preguntas abiertas** (con dueño) como pendiente.

### 8. Validar
- Corro `bash "${CLAUDE_PLUGIN_ROOT}/scripts/prd-check.sh" PRD-<slug>.md`: confirma secciones obligatorias,
  marca huecos y placeholders sin completar. Reporto y cierro lo que falte.

### 9. Entregar (y handoff)
- El PRD queda como **archivo local** `PRD-<slug>.md`. Lo entregás como hoy.
- **Opcional**: exportar a Word/PDF/Drive para el formato que espera el equipo; o **crear la épica + historias
  en Jira** (`mcp__jira__*`) desde el desglose, para que PRD y Jira nazcan sincronizados.
- **Handoff a Dev**: cada historia (`EP-<SLUG>-S<n>`) entra a `/argos:spec` como un RQ (`based-on: EP-<SLUG>-S<n>`),
  así cada release mapea a una historia.

## Reglas
- **Nunca escribo ni modifico el cerebro** (solo lectura para fundamentar).
- **No doy el PRD por listo** (`status: ready`) si el alcance no está acotado o quedan obligatorios con huecos.
- **Preciso y mínimo**: solo pregunto lo que cambia alcance/comportamiento, en tandas, con defaults.
- **Cero secretos** en el PRD (solo *nombres*). El **qué/por qué** es de Producto; el **cómo** técnico es de Dev.
- **El PRD lo lee el Dev que toma la tarea**: sintetizado y escaneable — **Resumen para Dev** arriba y las **historias como sub-tareas** claras (qué construir · criterios · qué queda afuera). Formato > prosa; si algo no ayuda a construir, lo achico o lo saco.
