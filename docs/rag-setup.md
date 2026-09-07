# RAG setup — Bedrock Knowledge Bases + S3 mirror

Guía operativa para habilitar el skill `/argos-product:rag` en Olé. Corresponde
a la Fase 1 (POC) del plan RAG. Requiere cuenta AWS + permisos IAM.

> **Decisiones ya tomadas** (arranque del POC):
> - **PDFs de insumo**: se suben. Bedrock KB los pasa por Textract auto.
> - **Multimodal (Figma PNG)**: no en el POC. Texto only.
> - **Intakes `draft` / `descartada`**: se indexan, con metadata `status` para filtrar.
> - **Bucket / cuenta**: pendiente de definir con el equipo AWS de Olé (ver §1).

## 1. Infraestructura AWS (una vez)

### 1.1 Cuenta y región

- **Cuenta**: Olé (sandbox o producción del equipo de plataforma — a definir con Ops).
- **Región**: `us-east-1` (Bedrock KB tiene más modelos disponibles; Aurora Serverless v2 con pgvector también).

### 1.2 Bucket S3

```
Nombre sugerido: olelife-argos-corpus
Versioning:      Enabled  (útil para trazar cambios y no perder MDs borrados)
Encryption:      SSE-S3 (por defecto) o SSE-KMS si compliance lo pide
Lifecycle:       ninguna (el corpus es chico, ~30 MB con 20 intakes)
Public access:   Block all (privado)
```

Prefijos:
- `brain/` — mirror de `ole-argos-brain`.
- `product/` — mirror de `ole-argos-product-data`.

### 1.3 Bedrock Knowledge Base

Consola AWS → Bedrock → Knowledge bases → **Create**:

- **Nombre**: `olelife-argos-kb`
- **IAM role**: crear nuevo con permisos S3 read del bucket + Bedrock invoke embeddings.
- **Data source**:
  - Tipo: **S3**
  - Bucket: `olelife-argos-corpus`
  - Chunking strategy: **Default** (300 tokens con 20% overlap) para el POC.
    Iterar a **Hierarchical** en Fase 2 si los PRDs largos se cortan feo.
- **Embeddings model**: `amazon.titan-embed-text-v2:0` (dim 1024).
  Alternativa Cohere Embed Multilingual v3 si el corpus tiene ES+EN mezclado (recomendado).
- **Vector store**:
  - **Amazon Aurora PostgreSQL Serverless** con `pgvector`.
  - Cluster nuevo o reusar Aurora existente si Olé ya tiene.
  - Tabla: `argos_kb_chunks` (Bedrock la crea auto).

Anotar de la KB creada:
- `knowledgeBaseId` (ej. `ABCDEF1234`)
- `dataSourceId` (ej. `XYZ7890`)

Combinados forman el secret `RAG_KB_ID = ABCDEF1234:XYZ7890`.

### 1.4 OIDC role para GitHub Actions

Sin secrets long-lived. GitHub Actions asume un role vía OIDC:

- IAM → **Identity providers** → Add: `token.actions.githubusercontent.com`.
- IAM → **Roles** → Create: trust policy que permita `assume-role-with-web-identity` desde
  los repos `Olelife/ole-argos-brain` y `Olelife/ole-argos-product-data` (branch `main`).
- Policy adjunta:
  - `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` en `arn:aws:s3:::olelife-argos-corpus/*`
  - `s3:ListBucket` en `arn:aws:s3:::olelife-argos-corpus`
  - `bedrock:StartIngestionJob` en el KB creado.

Anotar el ARN del role: `arn:aws:iam::<acct>:role/olelife-argos-rag-github-actions`.

## 2. Config en los repos que sincronizan

Repos: `ole-argos-brain` y `ole-argos-product-data`.

### 2.1 Copiar el workflow

```
templates/rag/rag-sync.yml (del motor)
   → .github/workflows/rag-sync.yml (en el repo destino)
```

### 2.2 Configurar secrets/variables (Settings → Secrets and variables → Actions)

Por cada repo:

| Nombre                | Tipo    | Valor                                                          |
| --------------------- | ------- | -------------------------------------------------------------- |
| `RAG_AWS_ROLE_ARN`    | Secret  | `arn:aws:iam::<acct>:role/olelife-argos-rag-github-actions`     |
| `RAG_S3_BUCKET`       | Secret  | `olelife-argos-corpus`                                          |
| `RAG_S3_PREFIX`       | Secret  | `brain` (en brain) · `product` (en product-data)                |
| `RAG_KB_ID`           | Secret  | `<knowledgeBaseId>:<dataSourceId>`                              |
| `RAG_MOTOR_TAG`       | Var     | `v1.13.0` (bump cuando saque nueva versión del motor)           |
| `RAG_MOTOR_TOKEN`     | Secret  | (opcional) PAT si el motor pasa a privado; default: github.token |

### 2.3 Primera corrida

Push trivial a `main` (o `workflow_dispatch` manual). El Action:
1. Chequea el repo + baja el motor pineado.
2. Instala AWS SDK.
3. Corre dry-run del manifiesto (revisar el output antes de merge).
4. Sube a S3.
5. Dispara ingestion-job en Bedrock KB.

## 3. Verificación local (antes de mergear en el repo real)

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

## 4. Consumo desde el skill

Una vez que el KB tiene un ingestion-job exitoso:

```
/argos-product:rag ¿qué findings tenemos sobre módulo póliza?
/argos-product:rag similares "cambio de frecuencia con oferta al cliente"
```

Si el skill responde "RAG no habilitado", verificar que `RAG_KB_ID` esté configurado
en el `.env` local o en Parameter Store.

## 5. Costos estimados (mensual · POC)

Asumiendo: ~30 MB de corpus, 100 queries/mes, 5 ingestion-jobs incrementales/mes.

| Servicio                          | Costo aprox. |
| --------------------------------- | -----------: |
| S3 storage (30 MB)                | < $0.01      |
| Aurora Serverless v2 (min 0.5 ACU) | ~$45         |
| Bedrock embeddings (Titan v2)     | ~$1          |
| Bedrock retrieve+generate         | ~$3          |
| Textract (PDFs, ~50 páginas/mes)  | ~$1          |
| **Total POC**                     | **~$50/mes** |

Se puede bajar Aurora a $0 usando OpenSearch Serverless (min $60) — para POC, Aurora es
más barato aunque tiene el piso de 0.5 ACU. Fase 2 iterar.

## 6. Riesgos y qué monitorear

- **Ingestion-job falla silencioso**: chequear CloudWatch logs de Bedrock KB. El Action
  no espera el resultado del job (async), solo lo dispara.
- **Corpus con chunks mal cortados**: si un PRD largo devuelve chunks fragmentados en el
  medio de una tabla, cambiar chunking a Hierarchical.
- **Costos que se disparan**: alarma en CloudWatch a $100/mes.
- **Filtro de secretos falso negativo**: el regex del script es conservador; si el equipo
  detecta patrones nuevos, sumarlos a `SECRET_PATTERNS` en `scripts/rag-sync.mjs`.
