# Standard de PRD de adaptación de mercado (Olé)

Qué hace que un PRD de **adaptación de mercado** sea bueno: llevar a un país nuevo una capability que
ya existe en otro. Extiende `standards/prd.md`; donde este documento dice algo distinto, **manda este**.

> Nació de la adaptación del Módulo Póliza a México (intake `modulo-poliza-mx`, 2026-09). Cada regla
> de acá corrigió un defecto real de ese documento — no son preferencias de estilo.

## La trampa de este tipo de PRD

Un PRD de adaptación **quiere escribirse como un análisis de brecha**: "esto se reusa, esto se ajusta,
esto no aplica". Esa comparación es necesaria **para decidir si se hace**, pero es un documento
distinto del que necesita quien lo construye.

**Síntoma de que caíste:** el mercado de origen aparece cada pocas líneas; la matriz de comparación es
la sección más larga; el lector no puede entender el producto sin conocer el otro mercado.

**La regla:** el cuerpo describe **el producto del mercado nuevo**. La comparación con el mercado
origen vive en **un anexo de trazabilidad**, para quien venga de allá y quiera reusar trabajo.

## Las cuatro reglas de escritura

### 1. El cuerpo afirma; el anexo registra
Un PRD no negocia consigo mismo. **Ninguna duda aparece en medio de una regla.**
- Donde la decisión es de Producto: se toma y se escribe como definición.
- Donde es de **Underwriting, Legal u Operaciones**: el cuerpo dice **qué asume la versión 1**, marcado
  con 🔏, y el **anexo de decisiones pendientes** dice quién ratifica y qué impacto tiene si cambia.
- El decision-log del intake sigue existiendo: es la bitácora de Producto, no parte del entregable.

### 2. Se describe funcionalidad, no controles de interfaz
El PRD dice **qué puede hacer el usuario y qué obtiene**; el diseño dice con qué control.
- ❌ "los chips de estado", "el menú (⋮)", "el badge", "el simulador", "las pestañas", "el botón"
- ✅ "el filtro rápido de estado", "las acciones de la póliza", "ve la prima vigente y la que quedaría"
- **Prueba 1:** si el diseñador lo cambia mañana sin consultar a nadie y el producto sigue siendo
  correcto, es diseño y no va. **Prueba 2:** si no se puede escribir un criterio verificable sin mirar
  la maqueta, estás describiendo una imagen.
- **Excepción legítima:** decisiones que *parecen* diseño y son producto — qué columna ve cada rol, qué
  dato se enmascara, qué acciones se ofrecen según el estado. Esas **sí** van, y se escriben como regla.

### 3. Se escribe para quien no conoce el otro mercado
Nada de "hereda", "igual que el otro mercado", "reusa tal cual" en el cuerpo. Un delta que no se
explica solo, no está escrito.

### 4. Sin jerga de documento ni promesas inventadas
- Las referencias internas se nombran: "el catálogo de coberturas (sección 5.2)", nunca "§5.2".
- **No inventes métricas.** Si nadie acordó una meta, no la escribas; o la sección no existe, o dice
  explícitamente que es una propuesta a ratificar.

## Los cinco ejes de adaptación

Todo delta de un mercado cae en uno de estos cinco. Recorrerlos **es** el análisis; saltarse uno es
como se escapan los huecos:

| Eje | Qué cambia | Dónde suele pegar |
|---|---|---|
| **E1 · Identidad y formatos** | Documentos e identificadores fiscales, domicilio, teléfono, formato de los números de negocio, moneda, fechas | Detalle, formularios de datos, documentos impresos |
| **E2 · Jerarquía comercial** | Niveles de la red y qué ve cada uno | Listados, columnas, alcance de lectura y de escritura |
| **E3 · Producto y tarifa** | Catálogo de coberturas, bandas, mínimos, topes, plazos, recargos | Todo cambio que toque la prima |
| **E4 · Origen del dato y operación** | Por qué camino se dio de alta, qué catálogos guarda, qué pasarela cobra | Lo que el producto **puede mostrar** y lo que hay que construir antes |
| **E5 · Actores y facultades** | Quién gatilla cada acción, no solo quién la ve | Todo el módulo |

**E4 es el que esconde el riesgo caro** y el que nadie pregunta: una pantalla puede estar diseñada,
aprobada y ser imposible porque el dato no se registra en ese mercado. **E5 es el que nadie ve**
cuando el mercado origen tenía un solo tipo de usuario.

## Estructura del documento

1. **Control del documento** — versión vigente, estado, responsable, historial de cambios y aprobaciones pendientes.
2. **Contexto y objetivo** — el problema *en ese mercado*, para quién, y qué se cumple al cerrar el alcance.
3. **Usuarios y facultades** — actores + matriz de qué puede hacer cada uno + las reglas que la gobiernan.
4. **Alcance** — en capacidades, no en pantallas; y fuera de alcance con su razón.
5. **Casos de uso** — **la columna vertebral** (ver abajo).
6. **Reglas de negocio y catálogos** — incluidas las **reglas numeradas** y las validaciones.
7. **Ciclo de vida** de la entidad central, si la hay.
8. **Notificaciones** — disparador, destinatarios y contenido.
9. **Requisitos no funcionales** — pocos y verificables.
10. **Dependencias y supuestos.**
11. **Glosario** — el mercado nuevo trae vocabulario que el equipo no conoce.
12. **Anexos** — A: trazabilidad con el mercado origen · B: decisiones pendientes de ratificar · C: fuentes de diseño.

> **Divergencia declarada con `standards/prd.md`:** ahí la columna vertebral son las **historias**; acá
> son los **casos de uso**. En una adaptación, el equipo necesita entender qué hace el producto antes
> de cómo se corta el trabajo, y el corte cambia con la planificación mientras el caso de uso no. Las
> historias de ejecución viven en `stories.md` del intake y se derivan **después**, cuando los
> criterios de aceptación ya existen — son ellos los que definen el tamaño real de cada historia.

## La ficha de caso de uso

Cada caso de uso lleva, en este orden: **Quién** (con los actores de la sección 3) · **Disponible**
(precondiciones) · **Diseño** (enlace, si existe para ese mercado) · **Entrada** (desde dónde) ·
**Pasos** (camino feliz, numerados) · **Opciones** (bifurcaciones reales) · **Reglas del mercado** ·
**Notifica** · **Resultado** (qué queda escrito) · **Casos alternos** · **Criterios de aceptación**.

## Reglas, criterios y validaciones: el hilo que los une

- **Reglas numeradas** (`RN-01`, `RN-02`, …), agrupadas por tema, con identificador **estable**.
- **Criterios de aceptación** dentro de cada caso de uso, verificables, **citando la regla** que los
  respalda: *"Dado un monto entre dos escalones, entonces se ajusta al inferior (RN-30)"*.
- **Validaciones** en una tabla propia: campo, obligatoriedad, regla y **el mensaje que ve el usuario**
  — más los errores que no son de campo (sin permiso, ya existe, el sistema falló).

Sin numerar las reglas, nada de esto se puede rastrear: un ticket no puede citar un párrafo.

## Antes de entregar: el lint

`scripts/prd-lint.sh <archivo>` chequea mecánicamente lo que este standard exige. **Si no pasa, no se
exporta ni se comparte.** Es lo que evita que el PM tenga que descubrir a mano lo mismo dos veces.

## Anti-patrones (rechazar)

- El **análisis de brecha disfrazado de PRD** (la trampa de arriba).
- **Dudas incrustadas** en las reglas del cuerpo.
- Describir **controles de interfaz** en vez de comportamiento.
- Decir "hereda" o "igual que el otro mercado" **en el cuerpo**.
- **Métricas inventadas** que nadie acordó.
- Dejar un eje sin recorrer porque "en el otro mercado no existía" — **E4 y E5 son justamente esos**.
- Poner **endpoints, contratos o modelo de datos físico**: eso lo produce Dev con este PRD en la mano.
