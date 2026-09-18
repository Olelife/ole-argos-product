#!/usr/bin/env bash
set -euo pipefail

# prd-check.sh <archivo.md> [--strict] — valida un PRD contra standards/prd.md.
#   · secciones obligatorias · placeholders y comentarios guía sin borrar
#   · frontmatter (title · epic · status · capability · country)
#   · "Resumen para Dev" arriba · cada historia de §6 con al menos un criterio Dado/cuando/entonces
#   · preguntas abiertas con dueño · un PRD `ready` no puede tener huecos ni preguntas `open`
# Advisory: sale 0 salvo con --strict (sale 1 si hay ⚠) o si un PRD `ready` tiene huecos (siempre 1).
# Lo usa /argos-product:prd (paso 8) e /argos-product:intake (verbo aprobar); el CI lo corre en --strict.

FILE="${1:-}"; shift || true
STRICT=0; [ "${1:-}" = "--strict" ] && STRICT=1
if [ ! -f "${FILE}" ]; then
  echo "Uso: $(basename "$0") PRD-<slug>.md [--strict]" >&2
  exit 1
fi

PRD_FILE="${FILE}" PRD_STRICT="${STRICT}" python3 - <<'PY'
import os, re, sys

path = os.environ['PRD_FILE']; strict = os.environ['PRD_STRICT'] == '1'
doc = open(path, encoding='utf-8').read()
issues, infos = [], []
flag = issues.append; info = infos.append

print(f'🗿  Argos valida {path}')
if re.search(r'^## Anexo A', doc, re.M) and re.search(r'^#+ CU-\d+', doc, re.M):
    print('  • es un PRD de adaptación de mercado (casos de uso + anexos): lo valida scripts/prd-lint.sh, no este check.')
    sys.exit(0)

# frontmatter
fm = {}
m = re.match(r'^---\n(.*?)\n---', doc, re.S)
if m:
    for line in m.group(1).split('\n'):
        k, _, v = line.partition(':')
        if _: fm[k.strip()] = re.sub(r'\s+#.*$', '', v).strip()
else:
    flag('sin frontmatter (--- title/epic/status/capability/country ---)')
for k in ['title', 'epic', 'status', 'capability', 'country']:
    if not fm.get(k) or re.match(r'^<.*>$', fm.get(k, '')): flag(f'frontmatter: falta {k}')
status = fm.get('status', '?')

# secciones obligatorias (standards/prd.md)
def has(sec): return re.search(r'^#+\s.*' + sec, doc, re.M | re.I) is not None
for sec in ['Problema', 'Objetivo', 'En alcance', 'Fuera de alcance', 'Comportamiento', '(Historias|Épicas)', 'Preguntas abiertas', 'Contexto complementario']:
    if not has(sec): flag(f'falta sección: {sec}')

# placeholders / guía
n_ph = len(re.findall(r'<[A-Za-zÁÉÍÓÚÑáéíóúñ][^>\n]*>|TODO', doc))
if n_ph: flag(f'{n_ph} placeholder(s) sin completar (<…> / TODO)')
if '<!--' in doc: flag('quedan comentarios guía <!-- --> sin borrar')

# Resumen para Dev
if not re.search(r'Resumen para Dev', doc): flag('falta el bloque "Resumen para Dev" arriba (qué se construye · alcance · sub-tareas)')

# historias de §6 con criterios verificables
stories = re.findall(r'^###\s+((?:EP-[A-Z0-9-]+-)?[SH]\d+[a-z]?)\b[^\n]*\n(.*?)(?=^###\s|^##\s|\Z)', doc, re.M | re.S)
sin = [sid for sid, body in stories if not re.search(r'^\s*-\s*(\[[ x]\]\s*)?Dad[oa]s?\b.*\b(cuando|entonces)\b', body, re.M | re.I)]
if stories:
    if sin: flag(f'{len(sin)} de {len(stories)} historias sin criterio Dado/cuando/entonces: {", ".join(sin[:6])}{"…" if len(sin) > 6 else ""}')
    else: info(f'{len(stories)} historias, todas con criterios verificables')
else:
    sec6 = re.search(r'^#+\s.*(Historias|Épicas).*?\n(.*?)(?=^##\s|\Z)', doc, re.M | re.S)
    tabla = sec6 and re.search(r'^\|.*Historia', sec6.group(2), re.M | re.I)
    if tabla: info('§6 lista las historias en una tabla (el detalle y los criterios viven en stories.md del intake)')
    else: flag('no encontré historias (### EP-<SLUG>-S<n> · …) en §6')

# preguntas abiertas: dueño y estado
q = re.search(r'^#+\s.*Preguntas abiertas.*?\n(.*?)(?=^#+\s|\Z)', doc, re.M | re.S)
n_open = 0
if q:
    rows = [r for r in q.group(1).split('\n') if r.strip().startswith('|')]
    rows = [r for r in rows[1:] if not re.match(r'^\s*\|[\s:|-]+\|\s*$', r)]
    sin_owner = 0
    for r in rows:
        cells = [c.strip() for c in r.strip().strip('|').split('|')]
        if len(cells) >= 4:
            if re.fullmatch(r'open|abierta', cells[3], re.I): n_open += 1
            if not cells[2] or cells[2] in ('—', '-'): sin_owner += 1
    if sin_owner: flag(f'{sin_owner} pregunta(s) abierta(s) sin dueño')
    if n_open: info(f'{n_open} pregunta(s) en estado open (ok a propósito; resolvé antes de ready)')

# un PRD ready no negocia consigo mismo
ready_broken = status.lower() == 'ready' and (n_open or n_ph or issues)
if status.lower() == 'ready' and n_open: flag(f'status ready con {n_open} pregunta(s) open')

info(f'status: {status}')
for t in issues: print(f'  ⚠ {t}')
for t in infos: print(f'  • {t}')
print()
if not issues:
    print('✓ Estructura completa. Revisá las preguntas abiertas antes de marcar status: ready.')
    sys.exit(0)
print(f'⚠ {len(issues)} hueco(s). Completalos antes de dar el PRD por listo.')
sys.exit(1 if (strict or ready_broken) else 0)
PY
