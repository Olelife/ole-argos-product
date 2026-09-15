#!/usr/bin/env bash
set -euo pipefail

# prd-lint.sh <PRD.md> [--origen <TOKEN>] — audita un PRD de adaptación de mercado contra
# standards/prd-adaptacion-mercado.md. Sale 1 si hay fallas duras.
# Lo corre /argos-product:prd-mercado antes de exportar o compartir.

FILE="${1:-}"; shift || true
ORIGEN=""
while [ $# -gt 0 ]; do
  case "$1" in
    --origen) ORIGEN="${2:-}"; shift 2 ;;
    *) shift ;;
  esac
done
[ -n "${FILE}" ] && [ -f "${FILE}" ] || { echo "uso: prd-lint.sh <PRD.md> [--origen INT]" >&2; exit 2; }

PRD_FILE="${FILE}" PRD_ORIGEN="${ORIGEN}" python3 - <<'PY'
import os, re, sys

path = os.environ['PRD_FILE']; origen = os.environ.get('PRD_ORIGEN','').strip()
doc = open(path, encoding='utf-8').read()

# El cuerpo es lo anterior a los anexos: ahí viven la trazabilidad y las dudas, y es legítimo.
m = re.search(r'^## Anexo A', doc, re.M)
body = doc[:m.start()] if m else doc
# El control del documento narra los cambios (y puede nombrar lo que se sacó): no es cuerpo.
c = re.search(r'^## Control del documento.*?(?=^## )', body, re.M | re.S)
if c: body = body.replace(c.group(0), '')
# Una línea marcada con <!-- lint:ui-ok --> usa el vocabulario de interfaz a propósito
# (por ejemplo, para decir que esconder un control NO es un permiso).
body_ui = '\n'.join(l for l in body.split('\n') if 'lint:ui-ok' not in l)

fails, warns, oks = [], [], []
def fail(t): fails.append(t)
def warn(t): warns.append(t)
def ok(t):   oks.append(t)

# 1 · el cuerpo afirma
n = len(re.findall(r'\bdudas?\b', body, re.I))
fail(f'{n} mención(es) de "duda" en el cuerpo — van al Anexo B') if n else ok('el cuerpo no negocia consigo mismo')

# 2 · se escribe para quien no conoce el otro mercado
if origen:
    n = len(re.findall(rf'\b{re.escape(origen)}\b', body))
    fail(f'{n} mención(es) de "{origen}" en el cuerpo — la comparación va al Anexo A') if n else ok(f'el cuerpo no se apoya en "{origen}"')
for frase in ['hereda', 'igual que el otro mercado', 'reusa tal cual', 'tal cual el otro']:
    if re.search(rf'\b{frase}', body, re.I):
        fail(f'aparece "{frase}" en el cuerpo — describí el delta, no la herencia')

# 3 · funcionalidad, no controles de interfaz
CONTROLES = ['menú', 'chip', 'badge', 'popup', 'toast', 'banner', 'pestaña', 'simulador',
             'botón', 'toggle', 'dropdown', 'desplegable', 'tooltip', 'modal', 'checkbox', '⋮']
hits = []
for c in CONTROLES:
    k = len(re.findall(re.escape(c), body_ui, re.I))
    if k: hits.append(f'{c}×{k}')
fail('controles de interfaz en el cuerpo: ' + ' · '.join(hits)) if hits else ok('sin controles de interfaz en el cuerpo')

# 4 · sin jerga de documento
n = doc.count('§')
fail(f'{n} símbolo(s) "§" — nombrá la sección ("sección 5.2")') if n else ok('sin jerga de secciones')

# 5 · estructura mínima
for titulo, patron in [('Control del documento', r'^## Control del documento'),
                       ('Glosario',              r'^#+ .*Glosario'),
                       ('Anexo A · trazabilidad',r'^## Anexo A'),
                       ('Anexo B · decisiones',  r'^## Anexo B'),
                       ('Anexo C · diseño',      r'^## Anexo C')]:
    ok(f'tiene {titulo}') if re.search(patron, doc, re.M) else fail(f'falta: {titulo}')
if re.search(r'^\| *RN-\d+ *\|', doc, re.M): ok('reglas de negocio numeradas')
else: fail('no hay reglas numeradas (RN-xx)')
if re.search(r'Validaciones y mensajes', doc): ok('tiene validaciones con mensajes')
else: fail('falta la tabla de validaciones y mensajes al usuario')

# 6 · casos de uso: criterios y trazabilidad a las reglas
cus = re.findall(r'^#+ (CU-\d+)[^\n]*\n(.*?)(?=^#+ |\Z)', doc, re.M | re.S)
sin_crit = [c for c, cuerpo in cus if 'Criterios de aceptación' not in cuerpo]
if not cus: fail('no se encontró ningún caso de uso (CU-xx)')
elif sin_crit: fail(f'{len(sin_crit)} caso(s) de uso sin criterios de aceptación: {", ".join(sin_crit)}')
else: ok(f'los {len(cus)} casos de uso tienen criterios de aceptación')

criterios = re.findall(r'^ +- (Dado|Dada) .+$', doc, re.M)
sin_rn = [c for c in re.findall(r'^ +- (?:Dado|Dada) [^\n]+$', doc, re.M) if not re.search(r'RN-\d+', c)]
if criterios:
    if sin_rn: warn(f'{len(sin_rn)} de {len(criterios)} criterios no citan ninguna regla')
    else: ok(f'los {len(criterios)} criterios citan su regla')

definidas = set(re.findall(r'^\| *(RN-\d+) *\|', doc, re.M))
citadas   = set(re.findall(r'\((?:[^)]*?)(RN-\d+)', doc)) | set(re.findall(r'RN-\d+(?=[,)\s])', doc))
huerfanas = sorted(definidas - citadas)
if definidas:
    warn(f'{len(huerfanas)} regla(s) definidas y nunca citadas: {", ".join(huerfanas[:8])}') if huerfanas \
        else ok(f'las {len(definidas)} reglas están citadas por algún criterio')

# 7 · diagramas que sobreviven al Word vertical
for bloque in re.findall(r'```\n(.*?)```', doc, re.S):
    ancho = max((len(l) for l in bloque.split('\n')), default=0)
    if ancho > 66:
        fail(f'un diagrama mide {ancho} caracteres de ancho — en vertical se parte (máximo 66)')

print(f'\n  PRD lint · {path}\n')
for t in oks:   print(f'  ✓ {t}')
for t in warns: print(f'  ⚠ {t}')
for t in fails: print(f'  ✗ {t}')
print()
if fails:
    print(f'  {len(fails)} falla(s) dura(s) — no exportes ni compartas hasta corregirlas.\n')
    sys.exit(1)
print('  Listo para exportar y compartir.\n' if not warns else '  Pasa, con avisos.\n')
PY
