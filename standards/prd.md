# Standard de PRD (Olé)

Qué hace que un PRD de Olé sea bueno. Lean y práctico: el objetivo es **acelerar** al PM y darle a Dev
un insumo claro y acotado — no un documento ceremonial.

## Lo lee el Dev → sintetizado y por sub-tareas
El PRD lo abre el **desarrollador que toma la tarea**. Tiene que ser **escaneable**:
- Un **Resumen para Dev** arriba (qué se construye + alcance en una línea + lista de sub-tareas).
- Las **historias = sub-tareas** son la **columna vertebral** (cada una: qué construir · criterios · qué queda afuera). Cada una mapea a un RQ.
- El contexto y las reglas **apoyan**, no tapan. **Formato > prosa**: tablas y bullets, sin párrafos largos.
- Si una sección no le sirve al Dev para construir, **achicala o sacala**.
- **Diagrama ASCII simple** cuando un flujo, un **pipeline de cálculo** o una máquina de estados se entiende mejor visual que en prosa (opcional, sin ceremonia — solo si aclara).

## Principios (de mercado, sin ceremonia)
- **Working Backwards**: arrancá del problema y el resultado, no de la solución.
- **One-pager primero**: lo esencial en una página; el detalle crece solo donde aporta.
- **Non-goals explícitos**: lo que NO se hace vale tanto como lo que sí. Acotar es parte del trabajo.
- **Historias INVEST**: independientes, negociables, valiosas, estimables, chicas, testeables.
- **Criterios verificables** (Given-When-Then): si no se puede verificar, no es criterio.

## Secciones obligatorias
Un PRD listo (`status: ready`) tiene, sin huecos:
1. **Problema / Por qué** — el dolor, no la solución.
2. **Objetivo / Resultado** — éxito, medible si se puede.
3. **En alcance** y **Fuera de alcance** — ambos, explícitos.
4. **Comportamiento de producto** — flujos, estados, reglas, validaciones, permisos, bordes, vacíos/errores.
5. **Épicas → Historias** — con ids estables y criterios de aceptación.
6. **Preguntas abiertas** — toda definición pendiente, con dueño.
7. **Contexto complementario** — lo que ayuda a entender pero NO se construye.

## Disciplina de alcance (el dolor que resolvemos)
- Cada ítem cae en **una** de tres cajas: **En alcance** · **Fuera de alcance** · **Contexto complementario**.
- Ante la duda, **se pregunta** ("¿esto es parte de la funcionalidad o es complementario?") — no se asume.
- Información que desvía (otra feature, otro país, otra fase) → **Fuera de alcance** o **Complementario**.

## Comportamiento: qué cubrir siempre
Estado inicial · transiciones/estados · reglas de negocio · validaciones de entrada · **permisos/autorización**
(quién puede) · casos borde · estado vacío · estado de error. Anclá a Figma cuando exista.
- **Catálogo de valores**: si hay campos enum/estados, listá los valores permitidos y sus **transiciones** en
  una tabla (una por campo) — es la **fuente de verdad para Dev y QA**, no la dejes implícita.
- **Permisos**: con múltiples roles, una **matriz rol × acción/módulo** (CRUD) comunica mejor que la prosa.

## El "cómo" técnico NO va — pero el cálculo SÍ (y conciso)
- **Implementación** (FUERA del PRD, lo decide Dev): qué servicio/lenguaje, esquema de DB, layout/UI, infra.
- **Producto** (SÍ va): comportamiento, valores y reglas — y si la feature ES un cálculo/motor, **las fórmulas
  y el orden de operaciones van en el PRD** (la lógica es producto, y se lee acá).
- **Valores — distinguí dos tipos:**
  - **Tablas CHICAS de lógica** (band multiplier, factores ROP/modal, claves de lookup, mapeos de índice — un
    puñado de filas): **van en el PRD**, son algoritmo de producto.
  - **Tablas GRANDES de datos** (tarifas por edad×término×género×fumador — cientos de filas): se **referencian**
    en el artefacto **pinneado** (nombre + versión + pestaña/rango); **no se copian**.
  - El insumo es **PRD + artefacto, juntos**. (Si hay un script/macro detrás del cálculo, **es parte de la spec**:
    su lógica de lookup e indexación va al PRD.)
- Evitá los dos extremos: ni duplicar tablas enteras en el PRD, ni un "andá a leer la planilla" sin fórmula,
  sin versión y sin referencia. **Práctico y conciso**: la fórmula + el puntero exacto a los números.

## Historias y trazabilidad
- Una **épica** = una capability/objetivo; sus **historias** son los incrementos atómicos.
- Id estable por historia (`EP-<SLUG>-S<n>`) → en Dev, cada historia es **un RQ** (`based-on: EP-<SLUG>-S<n>`).
- Así cada cosa liberada a producción mapea a una historia: no se pierde el control del alcance.

## Anti-patrones (rechazar)
- PRD que describe la **solución técnica** en vez del comportamiento (eso lo decide Dev en `/argos:spec`).
- Alcance difuso ("mejorar el flujo de pago") sin bordes.
- Definiciones asumidas en silencio (van a **Preguntas abiertas**).
- **Resolver una inconsistencia en silencio**: detectar una contradicción (interna del PRD, o entre el PRD y el Figma) o un gap de dato, y taparla con un default sin registrarla. Va SIEMPRE al decision-log / Preguntas abiertas, aunque propongas el default.
- Copiar todo el ticket de Jira tal cual, con info que no es de esta funcionalidad.
- Secretos o datos sensibles (solo *nombres*, nunca valores).
