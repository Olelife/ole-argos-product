---
title: <Módulo/Capability> — <Mercado>
epic: EP-<SLUG>
pm: <dueño/a del PRD>
status: draft            # draft | in-review | ready
version: v1
date: <YYYY-MM-DD>
country: <MX | BR | …>
capability: <kebab-en>   # debe existir o referenciar architecture/flows/<capability>.md del cerebro
figma: <url de la sección del mercado, o "—">
---

# <Módulo/Capability> — <Mercado>

> **Resumen ejecutivo**
>
> - **Qué se construye:** <1-2 líneas, en producto: qué va a poder hacer quién>.
> - **Para quién:** <los actores del mercado>.
> - **Qué resuelve:** <cómo se hace hoy en ese mercado y qué cuesta>.
> - **De qué se compone:** **<N> casos de uso** (sección 4), en <k> bloques: <…>.
> - **Lo que define a <Mercado>:** <los 2-4 deltas que más pesan, en lenguaje de producto>.

---

## Control del documento

**Versión vigente:** <x.y> · **Estado:** <borrador para revisión> · **Responsable de producto:** <nombre> · **Redacción:** Argos · Producto.

| Versión | Fecha | Cambio |
|---|---|---|
| 1.0 | <fecha> | <qué trajo> |

| Aprobación | Rol | Estado |
|---|---|---|
| Producto <Mercado> | Define alcance, prioridad y catálogos de negocio | Pendiente |
| Underwriting <Mercado> | Ratifica las reglas de producto y tarifa marcadas con 🔏 | Pendiente |
| Legal <Mercado> | Ratifica <figuras contractuales, firma, requisitos regulatorios> | Pendiente |
| Tecnología | Confirma viabilidad y el origen de datos de la sección 10 | Pendiente |

## 1. Contexto y objetivo

### 1.1 El problema
<Cómo se resuelve hoy en ESE mercado y qué cuesta. Tres costos concretos, no adjetivos.>

### 1.2 Objetivo
<Una frase con el resultado.> Al cerrar el alcance de este documento se cumple que:
1. <…>

<!-- Métricas: SOLO si el negocio ya acordó metas. Si no, borrá la sección; no inventes números. -->

## 2. Usuarios y facultades

### 2.1 Quiénes usan el módulo
| Actor | Dónde | Qué hace |
|---|---|---|

### 2.2 Qué puede hacer cada uno
🟢 puede · 🔒 no puede

| Acción | <Actor 1> | <Actor 2> | … |
|---|---|---|---|

**Sobre qué <entidades>.** <El alcance de cada actor, en prosa corta — no lo metas en las celdas.>

### 2.3 Las reglas que gobiernan las facultades
1. <…>
2. **Cada restricción se valida del lado del servidor.** Ocultar un control no es un permiso.

## 3. Alcance

### 3.1 En alcance
| Capacidad | Qué incluye |
|---|---|

### 3.2 Fuera de alcance
| Fuera | Por qué |
|---|---|

## 4. Casos de uso

**Cómo leer las fichas.** <…> Los criterios citan entre paréntesis las **reglas de negocio** de la
sección 5.<n> (`RN-01`, `RN-30`, …); las validaciones de campo y los mensajes están en la 5.<n+1>.

**Diseño.** <Qué pantallas entregó este mercado.> Los casos sin enlace **no tienen pantalla propia**:
se construyen con el diseño existente, aplicando el contenido y las reglas de este documento (Anexo C).

El símbolo 🔏 marca lo que espera ratificación (detalle en el Anexo B).

### Bloque A · <nombre>

#### CU-01 · <verbo + objeto>
- **Quién:** <actores> · **decide** <si aplica>.
- **Disponible:** <precondiciones>.
- **Diseño:** [<frame>](<url>).
- **Entrada:** <desde dónde>.
- **Pasos:**
  1. <…>
- **Opciones:** <bifurcaciones reales>.
- **Reglas de <Mercado>:** <lo propio de este mercado>.
- **Notifica:** <qué correo o aviso dispara>.
- **Resultado:** <qué queda escrito>.
- **Casos alternos:** <fuera de alcance, sin permiso, sin dato, error>.
- **Criterios de aceptación:**
  - Dado <contexto>, cuando <acción>, entonces <resultado verificable> (RN-xx).

## 5. Reglas de negocio y catálogos de <Mercado>

### 5.1 Identidad, domicilio y formatos
### 5.2 Catálogos del producto
### 5.3 <otros catálogos>
### 5.n Reglas de negocio
<!-- Agrupadas por tema, con id estable. Las citan los criterios de aceptación. -->

| # | Regla |
|---|---|
| RN-01 | <…> |

### 5.n+1 Validaciones y mensajes
| Formulario | Campo | Obligatorio | Validación | Mensaje al usuario |
|---|---|---|---|---|

**Errores que no son de campo:**
| Situación | Qué ve el usuario |
|---|---|

### 5.n+2 Información que maneja el módulo
<!-- Qué información existe desde el negocio. NO es un modelo técnico: sin tablas ni campos físicos. -->
<!-- Cerrá con los valores exactos de cada enumerado: son la fuente de verdad de Dev y QA. -->

## 6. Ciclo de vida de <la entidad central>
<!-- Diagrama ASCII de máximo 66 caracteres de ancho: más que eso se parte en Word vertical. -->

## 7. Notificaciones
| Notificación | Se dispara cuando | Qué lleva |
|---|---|---|

## 8. Requisitos no funcionales
<!-- Pocos y verificables. Si un requisito ya está dicho en el cuerpo, no lo repitas acá. -->

## 9. Glosario
| Término | Qué significa |
|---|---|

## 10. Dependencias y supuestos

## Anexo A · Trazabilidad con <mercado origen>
<!-- Para quien viene de allá y quiere reusar trabajo. NO es alcance: es referencia. -->
| Caso de uso <Mercado> | Equivalente | Qué se conserva | Qué cambia |
|---|---|---|---|

## Anexo B · Decisiones pendientes de ratificar
| Tema | Qué asume la v1 | Quién ratifica | Impacto si cambia |
|---|---|---|---|

## Anexo C · Fuentes de diseño
| Frame | Qué define | Enlace |
|---|---|---|
