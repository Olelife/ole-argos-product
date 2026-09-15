---
name: prd-mercado
description: Escribe el PRD de una adaptación de mercado — llevar a un país nuevo una capability que ya existe en otro (p. ej. el Módulo Póliza de INT a MX o BR). Produce un documento de PRODUCTO, no un análisis de brecha: 19 fichas de caso de uso con criterios de aceptación que citan reglas numeradas, catálogos locales, glosario y anexos con la trazabilidad al mercado origen y las decisiones sin ratificar. Incluye lint automático y export a Word listo para compartir. Úsalo cuando Producto quiera adaptar un módulo a otro país — disparadores como "adaptemos X a Brasil", "PRD de la adaptación de Y a MX", "/argos-product:prd-mercado". Escribe en el repo de datos (intake), nunca en el cerebro.
---

# /argos-product:prd-mercado — PRD de adaptación de mercado

Llevo una capability que ya existe en un mercado a **otro país**, y escribo el PRD que el equipo de
desarrollo puede tomar sin preguntarme nada. Persona y reglas: `CONSTITUTION.md`.
Qué hace bueno a este documento: **`standards/prd-adaptacion-mercado.md`** (mándalo leer antes de escribir).

> **La trampa que este skill existe para evitar:** un PRD de adaptación quiere escribirse como una
> comparación ("esto se reusa, esto se ajusta"). Eso sirve para decidir **si se hace**; no sirve para
> **construirlo**. El cuerpo describe el producto del mercado nuevo; la comparación va a un anexo.

## Flujo (en orden)

### 1. Levantar el material — antes de escribir una línea
- **El intake del mercado origen** (`intakes/<slug-origen>/`): su PRD, su `decision-log` y sus historias.
  De ahí sale el **comportamiento** que se adapta, no el texto que se copia.
- **El Figma del mercado nuevo**: lo congelo con `figma-freeze.mjs` en `figma/v1/` del intake nuevo
  (procedimiento en el skill `intake`). **Lo miro de verdad** — los frames dicen cosas que nadie escribió:
  campos propios del país, columnas por rol, catálogos, moneda.
- **El cerebro (READ-ONLY)**: `architecture/flows/<capability>.md`, `domain/`, `glossary.md`. Acá está el
  **eje 4**: por qué camino se dan de alta las entidades en ese mercado, qué catálogos guarda, qué
  servicio cobra. Es donde aparece el riesgo que no se ve en ningún diseño.

### 2. Recorrer los cinco ejes (esto **es** el análisis)
`E1` identidad y formatos · `E2` jerarquía comercial · `E3` producto y tarifa · `E4` origen del dato y
operación · `E5` actores y facultades. Detalle en el standard.

**Saltarse un eje es como se escapan los huecos.** Los dos que más se olvidan:
- **E4** — una pantalla puede estar diseñada, aprobada y ser **imposible** porque ese dato no se
  registra en ese mercado. Se detecta leyendo el cerebro, no el Figma.
- **E5** — si el mercado origen tenía un solo tipo de usuario, nadie se preguntó **quién gatilla qué**.
  Un mercado con red comercial de varios niveles y sub-usuarios lo necesita sí o sí.

### 3. Preguntar UNA vez, todo junto
Relleno lo inferible y pregunto **en una sola tanda** — estas son las que cuestan idas y vueltas si no
se hacen al principio:

1. **Diseño:** ¿el diseño del mercado origen vale donde el mercado nuevo no entregó pantalla? (define si
   los casos sin frame se pueden escribir o quedan bloqueados).
2. **Moneda y formatos:** ¿qué moneda se muestra? (si difiere del origen, cambia pantallas, ofertas y
   **todas** las plantillas de correo, donde el símbolo suele estar escrito en la plantilla).
3. **Producto:** ¿qué coberturas, planes o beneficios del mercado origen **no se venden** acá? Cada uno
   que cae se lleva sus reglas, sus avisos y sus cascadas.
4. **Legal:** ¿qué figuras contractuales del origen no existen o cambian de forma?
5. **Red comercial:** ¿qué niveles hay, qué ve cada uno y **qué puede gatillar** cada uno? ¿Hay
   sub-usuarios? ¿Pueden originar cambios o solo consultar?
6. **Reemplazo:** ¿alguna pantalla que ya existe en ese mercado se reemplaza? ¿Alguien depende de ella?
7. **Métricas:** ¿hay metas acordadas? **Si no, la sección no va** — no se inventan números.
8. **Ratificación:** ¿quién firma por Underwriting, por Legal y por Operaciones de ese mercado?

Lo que **no** pregunto: nada que estén el Figma, el intake origen o el cerebro. Si lo puedo inferir,
lo escribo y lo marco como supuesto.

### 4. Escribir, en este orden
1. **Los casos de uso** (la columna vertebral) — una ficha por proceso, con el formato del standard.
2. **Las reglas numeradas** (`RN-xx`) que salen de esas fichas, agrupadas por tema.
3. **Los criterios de aceptación** dentro de cada ficha, **citando** la regla que los respalda.
4. **Las validaciones** con el mensaje al usuario, y los errores que no son de campo.
5. **Catálogos, ciclo de vida, notificaciones, no funcionales, dependencias, glosario.**
6. **Los anexos**: trazabilidad con el origen · decisiones sin ratificar · fuentes de diseño.
7. **El control del documento** — versión, responsable, historial y aprobaciones pendientes.

Arranco del template: `templates/prd-adaptacion-mercado.md`.

### 5. Auto-auditar — obligatorio, antes de mostrar nada
```
bash "${CLAUDE_PLUGIN_ROOT}/scripts/prd-lint.sh" <PRD.md> --origen <TOKEN-DEL-MERCADO-ORIGEN>
```
Chequea lo que el standard exige: dudas en el cuerpo, menciones al mercado origen, controles de
interfaz, jerga de secciones, casos de uso sin criterios, criterios sin regla, reglas huérfanas,
estructura mínima y diagramas demasiado anchos. **Si sale con fallas, se corrigen antes de entregar.**
Una línea que use vocabulario de interfaz a propósito se marca con `<!-- lint:ui-ok -->`.

### 6. Exportar
```
python3 "${CLAUDE_PLUGIN_ROOT}/scripts/prd-to-docx.py" <PRD.md> -o <salida.docx> --pdf
```
Letter vertical, columnas proporcionales al contenido, encabezados en negrita y repetidos, índice que
Word actualiza al abrir. **El .docx es una foto: la fuente es el markdown del intake.**

### 7. Compartir
Confluence (espacio del squad) como hogar del documento, o Artifact para iterar rápido.
**Regla:** los comentarios vuelven, se aplican **al markdown**, se sube la versión en el control del
documento y se republica. Nadie edita la copia publicada — la próxima republicación la pisa.

## Reglas siempre activas
- **El cuerpo afirma, el anexo registra.** Ninguna duda en medio de una regla; lo que espera
  ratificación se marca 🔏 y dice **qué asume la v1**.
- **Funcionalidad, no controles de interfaz.** Si el diseñador lo cambia mañana y el producto sigue
  siendo correcto, no va al PRD.
- **Se escribe para quien no conoce el mercado origen.** "Hereda" e "igual que el otro mercado" están
  prohibidos en el cuerpo.
- **Ninguna inconsistencia se resuelve en silencio**: va al `decision-log` del intake, aunque proponga
  un default.
- **Nunca escribo el cerebro.** Lo leo para fundamentar.
- **Nada de endpoints, contratos ni modelo de datos físico**: eso lo produce Dev con este PRD en la mano.

## Relación con los otros skills
- **`intake`** gobierna el ciclo de vida (versiones, Figma congelado, decision-log, dashboard). Este
  skill escribe **el PRD de adentro** cuando ese intake es una adaptación de mercado.
- **`prd`** sigue siendo el skill para un PRD nuevo que no adapta nada.
- Las **historias de ejecución** (`stories.md`) se derivan **después** de que existan los criterios de
  aceptación: son ellos los que definen el tamaño real de cada historia.
