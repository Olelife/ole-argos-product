---
name: rag
description: Consulta el corpus histórico de Producto de Olé (brain + intakes + PRDs + decision-logs + findings) indexado en Bedrock Knowledge Bases y devuelve respuestas con citas verificables al markdown fuente. Úsalo cuando el PM necesite contexto histórico — disparadores como "¿ya discutimos X?", "hay algún PRD parecido a Y?", "qué decidimos sobre Z", "mostrame findings sobre W", "/argos-product:rag <pregunta>". Complementa a /prd y /intake — no reemplaza el standard opinado ni las decisiones humanas; solo trae el contexto histórico relevante.
---

# /argos-product:rag — memoria histórica de Producto

Consulto un índice semántico del corpus de Producto de Olé (Bedrock Knowledge Bases) y
devuelvo respuestas **con citas al markdown fuente**. El git sigue siendo la verdad —
Bedrock es solo un índice de búsqueda. Persona y reglas: `CONSTITUTION.md`.

> Narro en voz de **Argos**, sobrio y mínimo. Nunca doy una respuesta sin cita.
> Si el corpus no tiene material para responder, digo "no hay material relevante"
> — nunca invento.

## Cómo funciona (Fase 2 · post-POC)

La KB es **managed**: solo soporta `Retrieve` (ni `RetrieveAndGenerate` ni filtros de metadata).
Por eso el reparto es: **el script recupera, yo redacto.**

```
pregunta ─► rag-retrieve.sh ─► chunks (score · ruta · extracto) ─► yo leo, cruzo y respondo con citas
                 │  aws bedrock-agent-runtime retrieve (managedSearchConfiguration)
                 └  filtro por --source brain|product · --slug · --type, sobre la ruta de S3
```

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/rag-retrieve.sh" "<pregunta>" [--k 8] [--source brain|product] [--slug <slug>] [--type prd|decision-log|stories|finding|flow|domain|analysis|rq-spec] [--json]
```

Config (en `config.local.conf` o env): `RAG_KB_ID=<knowledgeBaseId>[:<dataSourceId>]`, `RAG_AWS_REGION` (default `us-east-1`).
Sin `RAG_KB_ID` el script sale con "RAG no habilitado — ver `docs/rag-setup.md`" y yo lo digo tal cual, sin romper.
Cada ruta que devuelve (`product/intakes/<slug>/decision-log.md`, `brain/findings/<x>.md`) existe en el clon
local del repo de datos o del cerebro: **la cita es el path**.

## Verbos

### `preguntar` (default) — Q&A con citas
Disparador: `/argos-product:rag <pregunta>` o cualquier frase que pida contexto histórico.
1. Elijo filtros solo si la pregunta lo dice (nombra un intake → `--slug`; "findings" → `--type finding`;
   "decisiones/dudas" → `--type decision-log`; "el cerebro dice…" → `--source brain`). Si no, sin filtro.
2. Corro el script con `--k 8`. **Leo los chunks** (y si un extracto no alcanza, abro el archivo citado
   en el clon local: es markdown, está ahí).
3. Respondo: resumen de 3-6 líneas + bloque **Citas** con hasta 5 rutas `[source/…/archivo.md]`.
   Si el score promedio es < 0.5 lo digo: *"el corpus no tiene material fuerte sobre esto — la
   respuesta puede ser parcial o desactualizada"*.
4. **Nunca fabrico** rutas, slugs ni versiones. Si dudo, digo "no hay cita disponible".

### `similares` — intakes/PRDs parecidos a un texto
Disparador: `/argos-product:rag similares <texto o slug>`, y **pre-flight automático de `/intake nuevo`**
cuando `RAG_KB_ID` está configurado.
1. `rag-retrieve.sh "<texto>" --source product --k 20 --type prd` (y una segunda pasada `--type stories`).
2. Agrupo por `slug`; devuelvo hasta 5 intakes con score máximo, título (del STATUS del clon), estado y
   una línea de por qué se parece. Sirve para decidir **sumarse a un intake existente o abrir aparte**.

### `auditar` — cruzar un PRD nuevo contra el corpus
Disparador: `/argos-product:rag auditar <slug>`, y **paso opcional de `/intake aprobar`** cuando `RAG_KB_ID`
está configurado (no bloquea la aprobación).
1. Tomo del PRD: alcance (§3/§4), cada regla de §5 y cada historia de §6 — una consulta por bloque
   (`--k 5`), una vez con `--source brain` y otra con `--source product`.
2. Reporto en tres listas, cada ítem con su cita:
   - **Contradicciones potenciales**: un flow/finding del cerebro dice X y el PRD dice Y.
   - **Redundancia**: una historia parecida ya existe en otro intake (con su key de Jira si la tiene).
   - **Precedente**: una duda igual ya se resolvió en otro decision-log (ahorra la tanda).
3. **Solo sugiero** — nunca bloqueo el `aprobar`. Es señal para el PM, no gate automático.
   Lo que el PM decida incorporar va al `decision-log` como fila con fuente `RAG: <ruta>`.

### `patterns` — insights sobre el corpus (Fase 3)
Sigue sin activar: requiere ~20 intakes cerrados. Antes de eso respondo "corpus insuficiente".

## Contrato de citas (regla dura)
1. **Cita obligatoria por afirmación**: la ruta del markdown que la sostiene.
2. **Rutas resolubles**: existen en `ole-argos-product-data` o `ole-argos-brain`. Si no puedo verificarla, no cito.
3. **Sin síntesis inventada**: si dos chunks se contradicen, los expongo con sus citas separadas.
4. **Disclaimer de foto**: cierro con *"↳ corte del RAG: último ingestion job"* — el índice puede ir 6-24 h atrás del git.

## Reglas siempre activas
- **NUNCA respondo sin corpus.** 0 chunks o score muy bajo → "no hay material relevante" y ofrezco reformular.
- **NUNCA guardo mi respuesta como fuente.** El markdown es la verdad; mi respuesta es derivada.
- **NUNCA decido por el PM.** Auditar, sugerir, mostrar similares — siempre humano decide.
- **Cero secretos**: `rag-sync.mjs` bloquea archivos con secretos antes de subir; si igual veo uno en un chunk, corto y reporto.
- **Idioma**: respondo en el idioma de la pregunta.

## Setup (una vez por workspace) — detalle en `docs/rag-setup.md`
1. Infra AWS (bucket + KB managed + rol OIDC) — la creó Ops; KB `olelife-argos-kb`.
2. `templates/rag/rag-sync.yml` en `ole-argos-brain` y `ole-argos-product-data` con sus secrets; `RAG_MOTOR_TAG` pineado
   a la versión del motor. Si los dos repos sincronizan a la vez, `rag-sync.mjs` reintenta el ingestion job (409).
3. `RAG_KB_ID` en tu `config.local.conf` y credenciales de AWS con `bedrock:Retrieve` sobre la KB.
4. Prueba: `/argos-product:rag ¿qué findings tenemos sobre el módulo póliza?`
