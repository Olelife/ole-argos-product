# RAG setup — Bedrock Knowledge Bases + S3 mirror

Guía operativa para habilitar el skill `/argos-product:rag` en Olé. Corresponde a la
**Fase 1 (POC)** del plan RAG. Requiere cuenta AWS + permisos IAM + acceso a Bedrock.

> **Decisiones ya tomadas** (arranque del POC):
> - **PDFs de insumo**: se suben. Bedrock KB los pasa por Textract auto.
> - **Multimodal (Figma PNG)**: no en el POC. Texto only.
> - **Intakes `draft` / `descartada`**: se indexan, con metadata `status` para filtrar.
> - **Vector store**: preferencia por **reusar el RDS/Aurora PostgreSQL existente** de Olé
>   con pgvector (baja el costo del POC de ~$50 a ~$5-10/mes). Cluster/creds pendientes de
>   confirmación con Ops (ver §Cheklist de infra).

## Alcance del POC en 5 pasos (Fase 1 completa)

La Fase 1 **no es solo el sync git → S3**. El sync es el primer eslabón de una cadena que
tiene que llegar hasta un skill funcionando y ser evaluada. Si cortás en el paso 3 no sabés
si esto sirve.

```
[1] Sync git → S3                        ← código en el motor (rag-sync.mjs + Action)
      │
      ▼
[2] Bucket S3 con corpus + metadata      ← Ops crea el bucket
      │
      ▼
[3] Bedrock KB ingiere de S3             ← Ops crea la KB
      │  · chunking automático
      │  · embeddings con Titan v2
      │  · vectores → tu RDS/Aurora con pgvector
      ▼
[4] Skill /argos-product:rag preguntar   ← código en el motor
      │  consumiendo la KB vía RetrieveAndGenerate
      ▼
[5] GATE del POC · 10-20 queries reales
      · ¿la respuesta cita el PRD correcto?
      · ¿el score es útil?
      · criterio go/no-go: >= 7/10 útiles
```

**Estado de cada paso al mergear este PR:**

| Paso | Qué necesita                                          | Estado                          |
| ---- | ----------------------------------------------------- | ------------------------------- |
| 1    | `scripts/rag-sync.mjs` + `templates/rag/rag-sync.yml` | **Listo en el motor**            |
| 2    | Bucket S3 + versioning + encryption                    | Pendiente Ops (§Cheklist infra) |
| 3    | Bedrock KB + Aurora/RDS pgvector + IAM OIDC role       | Pendiente Ops (§Cheklist infra) |
| 4    | `skills/rag/SKILL.md` verbo `preguntar`                | **Listo en el motor**            |
| 5    | Vos con 10-20 preguntas reales sobre el corpus         | Después de Ops                   |

## Gate del paso 5 · criterio de decisión

Al terminar los pasos 1-4, corré 10-20 queries reales sobre el corpus. Anotalas en
`intakes/_meta/rag-poc-eval.md` (nuevo archivo en el repo de datos, no lo pisa ningún
skill actual).

**Métricas concretas:**

```
Por cada query anotar:
  - pregunta:            en lenguaje natural
  - respuesta esperada:  cuál sería la buena
  - respuesta del RAG:   qué devolvió
  - cita correcta:       sí / no  (¿el link apunta al MD que sí responde?)
  - útil:                sí / no  (¿me habría ahorrado tiempo buscando a mano?)
  - notas:               si no fue útil, por qué
```

**Criterio go/no-go:**

```
PASA el POC → seguir a Fase 2
  · >= 7/10 queries "útil: sí"
  · >= 8/10 queries "cita correcta: sí"

NO PASA el POC → antes de escalar, iterar en:
  · chunking strategy (Default → Hierarchical)
  · modelo de embeddings (Titan v2 → Cohere Embed Multilingual v3)
  · prompt de generación (temperature, promptTemplate)

Si tras 2 iteraciones sigue sin pasar → migrar backend a Supabase pgvector
(el skill queda igual, solo cambia la capa de retrieval — plan B).
```

## Qué NO está en la Fase 1 (importante)

Estos verbos existen en el skill como stubs documentados pero **no son parte del arranque
del POC**. Se activan después del gate del paso 5:

```
Fase 2 (2-3 sprints después del POC · si pasa)
  · /rag similares como pre-flight de /intake nuevo
  · /rag auditar como parte del gate de aprobar intake
  · métricas de uso: queries/día, hit rate, latencia p95

Fase 3 (2-3 meses después)
  · Slack bot con /rag
  · Portal Q&A web para stakeholders no-PM
  · /rag patterns (solo con 20+ RQs cerrados en el corpus)

Fase 4 (6-12 meses)
  · Multimodal Figma (PNG en el KB)
  · Cross-organización (Design, QA, Data usan el mismo KB)
```

No abrir ninguno de estos antes de tener las métricas del paso 5. Regla dura: no escalar
antes de probar.

## Checklist de infra (§ para Ops)

### 1. Cuenta y región

- **Cuenta**: Olé (sandbox o producción del equipo de plataforma).
- **Región**: `us-east-1` recomendado (más modelos de Bedrock; pgvector en Aurora/RDS soportado).

### 2. Bucket S3

```
Nombre sugerido: olelife-pilot-corpus
Versioning:      Enabled  (útil para trazar cambios y no perder MDs borrados)
Encryption:      SSE-S3 (default) o SSE-KMS si compliance lo pide
Lifecycle:       ninguna (el corpus es chico, ~30 MB con 20 intakes)
Public access:   Block all (privado)
```

Prefijos:
- `brain/` — mirror de `ole-argos-brain`
- `product/` — mirror de `ole-argos-product-data`

### 3. Vector store (elegir uno)

#### Opción A · Reusar RDS/Aurora existente **(recomendado si cumple)**

Antes de habilitar, verificar con el DBA:

```
1. Aurora o RDS estándar         (ambos sirven, cambia el modo de config)
2. Versión de PostgreSQL         (>= 15 ideal para pgvector 0.5 + HNSW)
3. Región                        (misma que Bedrock KB)
4. Carga actual                  (CPU habitual < 70%; espacio libre >= 5 GB)
5. ¿Es DB de producción?         (si sí, aislar con schema dedicado + RLS)
```

Preparación SQL:

```sql
-- En la instancia existente, como superuser
CREATE EXTENSION IF NOT EXISTS vector;
CREATE SCHEMA IF NOT EXISTS bedrock_rag;
CREATE USER bedrock_rag_user WITH PASSWORD '<generar>';
GRANT USAGE, CREATE ON SCHEMA bedrock_rag TO bedrock_rag_user;
-- Bedrock KB crea la tabla y los índices él mismo al primer ingestion job
```

En AWS Secrets Manager:
- Crear secret con `{ "username": "bedrock_rag_user", "password": "<...>" }`.
- Anotar el ARN.

Costo marginal: **~$5-10/mes** (storage extra de ~4 GB de vectores + consumo mínimo de CPU en queries del RAG).

#### Opción B · Aurora Serverless v2 nuevo (fallback si Opción A no cumple)

Consola AWS → RDS → **Create database**:
- Engine: Aurora PostgreSQL Serverless v2
- Versión: >= 15.3
- Capacity: min 0.5 ACU, max 4 ACU
- Storage: default gp3

Costo: **~$45/mes** por el piso mínimo de 0.5 ACU (fijo, no depende del uso).

### 4. Bedrock Knowledge Base

Consola AWS → Bedrock → Knowledge bases → **Create**:

- **Nombre**: `olelife-argos-kb`
- **IAM role**: crear nuevo (o el wizard lo crea) con permisos S3 read + Bedrock invoke embeddings + acceso al Secret de la DB.
- **Data source**:
  - Tipo: **S3**
  - Bucket: `olelife-pilot-corpus`
  - Prefix filter: sin filtro (indexa `brain/` y `product/` completos)
  - Chunking strategy: **Default** (300 tokens, 20% overlap) para el POC.
    Iterar a **Hierarchical** en Fase 2 si los PRDs largos se cortan feo.
- **Embeddings model**: `amazon.titan-embed-text-v2:0` (dim 1024).
  Alternativa: `cohere.embed-multilingual-v3` si el corpus mezcla ES + EN (mejor precisión).
- **Vector store**:
  - Opción A: **Amazon Aurora PostgreSQL** (o RDS PostgreSQL) — apuntar al cluster existente + secret + schema `bedrock_rag`.
  - Opción B: **Amazon Aurora PostgreSQL Serverless v2** — el que acabás de crear.

Anotar de la KB creada:
- `knowledgeBaseId` (ej. `ABCDEF1234`)
- `dataSourceId` (ej. `XYZ7890`)

Combinados forman el secret `RAG_KB_ID = ABCDEF1234:XYZ7890`.

### 5. OIDC role para GitHub Actions

Sin secrets long-lived. GitHub Actions asume un role vía OIDC:

- IAM → **Identity providers** → Add: `token.actions.githubusercontent.com`.
- IAM → **Roles** → Create: trust policy que permita `assume-role-with-web-identity` desde
  los repos `Olelife/ole-argos-brain` y `Olelife/ole-argos-product-data` (branch `main`).
- Policy adjunta:
  - `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` en `arn:aws:s3:::olelife-pilot-corpus/*`
  - `s3:ListBucket` en `arn:aws:s3:::olelife-pilot-corpus`
  - `bedrock:StartIngestionJob` en el KB creado.

Anotar el ARN del role: `arn:aws:iam::<acct>:role/olelife-argos-rag-github-actions`.

## Config en los repos que sincronizan

Repos: `ole-argos-brain` y `ole-argos-product-data`.

### Copiar el workflow

```
templates/rag/rag-sync.yml (del motor)
   → .github/workflows/rag-sync.yml (en el repo destino)
```

### Secrets/variables (Settings → Secrets and variables → Actions)

Por cada repo:

| Nombre                | Tipo    | Valor                                                          |
| --------------------- | ------- | -------------------------------------------------------------- |
| `RAG_AWS_ROLE_ARN`    | Secret  | `arn:aws:iam::<acct>:role/olelife-argos-rag-github-actions`     |
| `RAG_S3_BUCKET`       | Secret  | `olelife-pilot-corpus`                                          |
| `RAG_S3_PREFIX`       | Secret  | `brain` (en brain) · `product` (en product-data)                |
| `RAG_KB_ID`           | Secret  | `<knowledgeBaseId>:<dataSourceId>`                              |
| `RAG_MOTOR_TAG`       | Var     | `v1.13.0` (bump cuando saque nueva versión del motor)           |
| `RAG_MOTOR_TOKEN`     | Secret  | (opcional) PAT si el motor pasa a privado; default: github.token |

### Primera corrida

Push trivial a `main` (o `workflow_dispatch` manual). El Action:
1. Chequea el repo + baja el motor pineado.
2. Instala AWS SDK.
3. Corre dry-run del manifiesto (revisar el output antes de merge).
4. Sube a S3.
5. Dispara ingestion-job en Bedrock KB.

## Verificación local (antes de mergear en el repo real)

Desde tu workspace, con un clon local del repo brain o product-data:

```
node ${CLAUDE_PLUGIN_ROOT}/scripts/rag-sync.mjs \
  /path/al/clon/ole-argos-brain \
  --dry-run | jq '.summary'
```

Deberías ver algo como:

```
{
  "repoRoot": "/path/al/clon/ole-argos-brain",
  "counts": { "kept": 87, "skipped": 12, "secretsBlocked": 0 },
  "bytes": 4212000,
  "generatedAt": "2026-09-07T..."
}
```

**Si `secretsBlocked > 0`**, revisar los `secrets[]` del output y limpiar el repo antes
de habilitar el workflow.

## Consumo desde el skill (paso 4 del POC)

Una vez que el KB tiene un ingestion-job exitoso:

```
/argos-product:rag ¿qué findings tenemos sobre módulo póliza?
/argos-product:rag similares "cambio de frecuencia con oferta al cliente"
```

Si el skill responde "RAG no habilitado", verificar que `RAG_KB_ID` esté configurado en
el `.env` local o en Parameter Store.

## Costos estimados (mensual)

Asumiendo: ~30 MB de corpus, 100 queries/mes, 5 ingestion-jobs incrementales/mes.

### Opción A · Reusar RDS/Aurora existente

| Servicio                          | Costo aprox. |
| --------------------------------- | -----------: |
| S3 storage (30 MB)                | < $0.01      |
| pgvector en RDS/Aurora existente  | ~$5 (storage extra ~4 GB) |
| Bedrock embeddings (Titan v2)     | ~$1          |
| Bedrock retrieve+generate         | ~$3          |
| Textract (PDFs, ~50 páginas/mes)  | ~$1          |
| **Total POC (Opción A)**          | **~$10/mes** |

### Opción B · Aurora Serverless v2 nuevo

| Servicio                          | Costo aprox. |
| --------------------------------- | -----------: |
| S3 storage (30 MB)                | < $0.01      |
| Aurora Serverless v2 (min 0.5 ACU) | ~$45         |
| Bedrock embeddings (Titan v2)     | ~$1          |
| Bedrock retrieve+generate         | ~$3          |
| Textract (PDFs, ~50 páginas/mes)  | ~$1          |
| **Total POC (Opción B)**          | **~$50/mes** |

## Riesgos y qué monitorear

- **Ingestion-job falla silencioso**: chequear CloudWatch logs de Bedrock KB. El Action
  no espera el resultado del job (async), solo lo dispara.
- **Corpus con chunks mal cortados**: si un PRD largo devuelve chunks fragmentados en el
  medio de una tabla, cambiar chunking a Hierarchical.
- **Costos que se disparan**: alarma en CloudWatch a $100/mes.
- **Filtro de secretos falso negativo**: el regex del script es conservador; si el equipo
  detecta patrones nuevos, sumarlos a `SECRET_PATTERNS` en `scripts/rag-sync.mjs`.
- **Impact en la DB compartida** (Opción A): si tu RDS/Aurora ya está a >70% CPU, el RAG
  puede degradar el negocio. Monitorear IOPS + CPU la primera semana; si aparece
  contención, migrar a Opción B.
