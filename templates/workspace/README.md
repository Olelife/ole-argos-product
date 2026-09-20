# Taller de Producto · Olé

Workspace listo para trabajar con el Motor de Producto (`argos-product`). Abrilo con Claude Code y el
plugin queda instalado solo: `.claude/settings.json` ya declara el marketplace y lo habilita.

## Puesta en marcha

1. Abrí esta carpeta con Claude Code.
2. Corré `/argos-product:setup`. Clona el cerebro recortado (solo lectura) y el repo de datos de intakes
   dentro de `repos/`.
3. Si vas a usar la búsqueda sobre el corpus histórico, descomentá `RAG_KB_ID` y `RAG_AWS_REGION` en
   `config.local.conf`. Sin eso, el skill `rag` avisa que no está habilitado y el resto funciona igual.
4. Para sincronizar con Jira, Confluence o Slack hace falta autorizar esos conectores en tu sesión.
   Sin ellos, los verbos que escriben afuera caen a su alternativa: por ejemplo, la creación de tickets
   genera un archivo importable en lugar de llamar a Jira.

## Qué hay en la carpeta

| Ruta | Qué es |
|---|---|
| `CLAUDE.md` | instrucciones del taller y ficha de verbos, se refresca sola |
| `config.local.conf` | configuración de esta máquina, no se versiona |
| `repos/` | cerebro y datos de intake, los clona el paso de puesta en marcha |

## Refrescar la ficha de verbos

Cuando actualices el Motor, volvé a correr esto para que la ficha de `CLAUDE.md` refleje la versión nueva:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/workspace-init.sh" .
```

Es idempotente: reescribe solo los bloques entre marcadores y deja intacto lo que hayas escrito alrededor.
