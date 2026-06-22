# Standard de PRD (Olé)

Qué hace que un PRD de Olé sea bueno. Lean y práctico: el objetivo es **acelerar** al PM y darle a Dev
un insumo claro y acotado — no un documento ceremonial.

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

## Historias y trazabilidad
- Una **épica** = una capability/objetivo; sus **historias** son los incrementos atómicos.
- Id estable por historia (`EP-<SLUG>-S<n>`) → en Dev, cada historia es **un RQ** (`based-on: EP-<SLUG>-S<n>`).
- Así cada cosa liberada a producción mapea a una historia: no se pierde el control del alcance.

## Anti-patrones (rechazar)
- PRD que describe la **solución técnica** en vez del comportamiento (eso lo decide Dev en `/argos:spec`).
- Alcance difuso ("mejorar el flujo de pago") sin bordes.
- Definiciones asumidas en silencio (van a **Preguntas abiertas**).
- Copiar todo el ticket de Jira tal cual, con info que no es de esta funcionalidad.
- Secretos o datos sensibles (solo *nombres*, nunca valores).
