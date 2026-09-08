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

## Dónde vive todo

- **Motor** = este plugin (read-only). El skill hace las llamadas al índice.
- **Corpus indexado** = bucket S3 `${RAG_S3_BUCKET}` con el mirror de:
  - `ole-argos-brain` (dominio, arquitectura, glossary, findings, RQ cerrados)
  - `ole-argos-product-data` (intakes: PRDs, decision-logs, historias, análisis)
- **Índice** = Bedrock Knowledge Base ID `${RAG_KB_ID}` (vector store: Aurora pgvector).
- **Sync** = GitHub Action `rag-sync.yml` on-push a main de cada repo (usa `scripts/rag-sync.mjs`).

Config esperada en env (Parameter Store o `.env` local):
```
RAG_KB_ID          <knowledgeBaseId>:<dataSourceId>   (Bedrock KB)
RAG_S3_BUCKET      olelife-pilot-corpus                (mirror)
RAG_AWS_REGION     us-east-1                           (default)
RAG_MODEL_ID       anthropic.claude-3-5-sonnet-20241022-v2:0  (generación)
```

Si `RAG_KB_ID` no está configurado, el skill responde "RAG no habilitado — ver
`docs/rag-setup.md` en el motor" y no rompe.

## Verbos

### `preguntar` (default) — Q&A con citas

Disparador: `/argos-product:rag <pregunta>` o cualquier frase que pida contexto histórico.

1. **Pre-filtro por metadata** (si la pregunta lo permite):
   - Si menciona un slug de intake conocido → `metadataFilter: { slug: "<slug>" }`.
   - Si pide "findings" → `docType in ["finding"]`.
   - Si pide "decisiones" o "dudas" → `docType in ["decision-log"]`.
   - Si pide "PRDs cerrados" → `status: "closed"`.
   - Si no infiere filtro claro → sin filtro (top-k global).
2. **Llamo a Bedrock KB** `RetrieveAndGenerate`:
   - `numberOfResults: 8` (chunks)
   - `orchestrationConfiguration.promptTemplate`: instruyo a citar **siempre** con
     `[<file>:<slug>]` en cada afirmación.
   - `generationConfiguration.inferenceConfig.textInferenceConfig.temperature: 0.2`
     (respuestas conservadoras).
3. **Emito la respuesta** al chat con:
   - Resumen conciso (3-6 líneas máx.).
   - Bloque "Citas" con hasta 5 links a los MDs fuente (formato `[slug/archivo.md#seccion]`
     resoluble por el PM en su clon local).
   - Si el score de recuperación es bajo (< 0.5 promedio), lo digo explícito:
     "el corpus no tiene material fuerte sobre esto — la respuesta puede ser
     parcial o desactualizada".
4. **Nunca fabrico** links, slugs o versiones. Si dudo, digo "no hay cita disponible".

### `similares` — encontrar intakes/PRDs parecidos a un texto

Disparador: `/argos-product:rag similares <texto o slug de intake>` o pre-flight cuando
`/intake nuevo` recibe una descripción inicial.

1. Uso `Retrieve` (sin `AndGenerate` — solo top-k con scores).
2. Devuelvo hasta 5 intakes/PRDs con score, slug, título, capability y una línea de
   por qué son parecidos.
3. Útil para: "antes de abrir este intake, ¿ya hay algo parecido en curso o cerrado?"
   y para el PM decidir si sumarse o abrir aparte.

### `auditar` — cruzar un PRD nuevo contra el corpus

Disparador: al aprobar un intake (`/argos-product:intake aprobar <slug>`), el gate llama
a este verbo automáticamente.

1. Extraigo secciones clave del PRD nuevo (alcance, criterios, capabilities).
2. Para cada una, corro `Retrieve` con filtro `source: brain` y `source: product`.
3. Reporto:
   - **Contradicciones potenciales**: un flow del cerebro dice X, el PRD dice Y.
   - **Redundancia**: una historia similar ya existe cerrada en otro intake.
   - **Standard violado**: si el corpus tiene un `standards/prd.md` que el PRD contradice.
4. **Solo sugiero** — nunca bloqueo el aprobar. Es señal para el PM revisar,
   no un gate automático (regla: humano decide).

### `patterns` — insights emergentes sobre el corpus

Disparador: `/argos-product:rag patterns [--capability <cap>] [--last <N>d]`.

Reporte periódico (útil al cierre de trimestre):
- Bugs más frecuentes por capability.
- Dudas que se repiten en múltiples intakes (posible gap del standard).
- Tiempo promedio de resolución de decisiones por vertical.
- Findings del cerebro más citados en intakes.

Requiere corpus mínimo de ~20 intakes cerrados para dar valor. Antes, avisa
"corpus insuficiente — al menos 20 RQs cerrados requeridos".

## Contrato de citas (regla dura)

Toda respuesta del skill debe cumplir:

1. **Cita obligatoria por afirmación** — si digo "en el módulo póliza decidimos X",
   la próxima línea es `[modulo-poliza-petra/decision-log.md#duda-34]`.
2. **Links resolubles** — los slugs y paths existen en `ole-argos-product-data` o
   `ole-argos-brain`. Si no puedo verificar el path, no cito.
3. **Sin síntesis inventada** — si 3 chunks dicen cosas parcialmente contradictorias,
   las expongo con sus citas separadas, no fabrico una síntesis "promedio".
4. **Disclaimer de foto** — cada respuesta cierra con `↳ corte del RAG: <fecha del
   último ingestion job>`. Los stakeholders entienden que puede estar 6-24h atrás.

## Reglas siempre activas

- **NUNCA respondo sin corpus.** Si Bedrock KB devuelve 0 chunks o score muy bajo,
  digo "no hay material relevante" y ofrezco reformular.
- **NUNCA guardo la respuesta como fuente.** El markdown es la verdad; mi respuesta
  es derivada.
- **NUNCA decido por el PM.** Auditar, sugerir, mostrar patterns — siempre humano decide.
- **Cero secretos** — el filtro `rag-sync.mjs` bloquea archivos con secretos detectados
  antes de subir. Si igual encontrás uno, cortá el pipeline y reportá.
- **Idioma**: respondo en el idioma de la pregunta.

## Setup inicial (una vez por workspace)

1. **Infra AWS** (fuera del scope de este skill — ver `docs/rag-setup.md`):
   - Bucket S3 `${RAG_S3_BUCKET}` en la cuenta de Olé.
   - Bedrock KB con Aurora pgvector; dataSource apuntando al bucket.
   - IAM role con OIDC para GitHub Actions.
2. **Activar sync**:
   - Copiar `templates/rag/rag-sync.yml` en `ole-argos-brain/.github/workflows/` y en
     `ole-argos-product-data/.github/workflows/`.
   - Definir secrets en cada repo (`RAG_AWS_ROLE_ARN`, `RAG_S3_BUCKET`, `RAG_S3_PREFIX`,
     `RAG_KB_ID`).
3. **Verificar**: `bash "${CLAUDE_PLUGIN_ROOT}/scripts/rag-sync.mjs" <clon-local-del-repo> --dry-run`
   imprime el manifiesto que se subiría (sin subir). Confirmar que:
   - Ningún archivo aparece como `secret detected`.
   - Los `docType` están bien mapeados.
   - El count de `kept` es el esperado.
4. **Primera corrida**: mergear un cambio trivial a `main` de cada repo → el Action
   sube el corpus y dispara el primer ingestion-job.
5. **Prueba**: `/argos-product:rag ¿qué findings tenemos sobre el módulo póliza?`

## Interacción con otros skills

- **`/argos-product:intake nuevo`** puede llamar internamente a `similares` para el
  pre-flight (Fase 2 del roadmap).
- **`/argos-product:intake aprobar`** llama a `auditar` como parte del gate (Fase 3).
- **`/argos-product:avance`** no toca RAG — es data live de Jira.
