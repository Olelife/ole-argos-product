#!/usr/bin/env python3
"""prd-to-docx.py <PRD.md> [-o salida.docx] [--pdf]

Exporta un PRD (markdown) a Word con el formato que el equipo espera. Cada ajuste de acá corrigió un
defecto real de la salida cruda de pandoc — no son preferencias:

  · Letter VERTICAL con márgenes de 0.75".
  · Ancho de columna proporcional al contenido (pandoc reparte iguales y las columnas largas quedan
    ilegibles), con piso por palabra más larga para que los encabezados no se partan.
  · Encabezado de tabla en NEGRITA y REPETIDO cuando la tabla cruza de página.
  · Sin interpretación de `$…$` como fórmula TeX (un PRD con "US$" salía en itálica matemática).
  · Índice que Word actualiza al abrir.
  · Las viñetas del resumen ejecutivo no se aplanan en un párrafo corrido.

Requiere `pandoc`. Con --pdf, además `soffice` (LibreOffice).
"""
import argparse, os, re, shutil, subprocess, sys, tempfile

TOTAL_DXA = 10080          # ancho util: Letter vertical (12240) menos 2 margenes de 1080
MIN_COL   = 1150

def columnas(tabla_md):
    """Ancho por columna, proporcional al contenido y con piso por palabra mas larga."""
    limpio = lambda x: re.sub(r'\[([^\]]*)\]\([^)]*\)', r'\1', re.sub(r'[*`]', '', x))
    palabra = lambda t: max([len(w) for w in t.split()] + [4])
    filas = [[limpio(c).strip() for c in r.strip().strip('|').split('|')]
             for r in tabla_md if not re.match(r'^\s*\|[\s:|-]+\|\s*$', r)]
    n = max(len(f) for f in filas)
    pesos, pisos = [], []
    for i in range(n):
        celdas = [len(f[i]) for f in filas[1:] if len(f) > i]
        encab  = len(filas[0][i]) if len(filas[0]) > i else 8
        larga  = max([palabra(f[i]) for f in filas if len(f) > i] + [4])
        med    = sorted(celdas)[len(celdas) // 2] if celdas else 8
        mx     = max(celdas) if celdas else 8
        pesos.append(max(encab * 1.2, med * 0.8 + mx * 0.5, larga * 1.3, 7))
        pisos.append(max(MIN_COL, larga * 140 + 260))
    total = sum(pesos)
    cols = [max(pisos[i], int(TOTAL_DXA * pesos[i] / total)) for i in range(n)]
    while sum(cols) > TOTAL_DXA:
        j = max(range(n), key=lambda k: cols[k] - pisos[k])
        if cols[j] - pisos[j] <= 0:
            break
        cols[j] -= min(sum(cols) - TOTAL_DXA, cols[j] - pisos[j])
    cols[cols.index(max(cols))] += TOTAL_DXA - sum(cols)
    return cols

def tablas_del_markdown(texto):
    tablas, actual = [], []
    for linea in texto.split('\n'):
        if linea.strip().startswith('|'):
            actual.append(linea)
        elif actual:
            tablas.append(actual); actual = []
    if actual:
        tablas.append(actual)
    return tablas

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('prd')
    ap.add_argument('-o', '--out')
    ap.add_argument('--pdf', action='store_true', help='genera tambien el PDF (requiere soffice)')
    args = ap.parse_args()

    src = os.path.abspath(args.prd)
    out = os.path.abspath(args.out) if args.out else os.path.splitext(src)[0] + '.docx'
    if not shutil.which('pandoc'):
        sys.exit('✗ falta pandoc')

    tmp = tempfile.mkdtemp(prefix='prd-docx-')
    md_path = os.path.join(tmp, 'prd.md')
    md = open(src, encoding='utf-8').read()
    # un blockquote con titulo + lista se aplana en un parrafo si no hay linea en blanco entre medio
    md = re.sub(r'(^> \*\*[^\n]+\*\*\n)(> - )', r'\1>\n\2', md, flags=re.M)
    open(md_path, 'w', encoding='utf-8').write(md)

    subprocess.run(['pandoc', md_path,
                    '-f', 'markdown+pipe_tables+yaml_metadata_block-tex_math_dollars-tex_math_single_backslash',
                    '-t', 'docx', '--toc', '--toc-depth=3',
                    '-o', os.path.join(tmp, 'crudo.docx')], check=True)
    unp = os.path.join(tmp, 'unpacked'); os.makedirs(unp)
    subprocess.run(['unzip', '-q', os.path.join(tmp, 'crudo.docx'), '-d', unp], check=True)

    doc_xml = os.path.join(unp, 'word', 'document.xml')
    s = open(doc_xml, encoding='utf-8').read()

    sect = ('<w:sectPr><w:pgSz w:w="12240" w:h="15840"/>'
            '<w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080" '
            'w:header="720" w:footer="720" w:gutter="0"/>'
            '<w:cols w:space="720"/><w:docGrid w:linePitch="360"/></w:sectPr>')
    s = s.replace('<w:sectPr />', sect).replace('<w:sectPr/>', sect)

    grids = [columnas(t) for t in tablas_del_markdown(md)]
    partes, pos, k = [], 0, 0
    for m in re.finditer(r'<w:tbl>.*?</w:tbl>', s, re.S):
        tbl = m.group(0)
        if k >= len(grids):
            break
        grid = '<w:tblGrid>' + ''.join(f'<w:gridCol w:w="{c}" />' for c in grids[k]) + '</w:tblGrid>'
        k += 1
        if '<w:tblGrid>' in tbl:
            tbl = re.sub(r'<w:tblGrid>.*?</w:tblGrid>', grid, tbl, count=1, flags=re.S)
        elif re.search(r'<w:tblGrid ?/>', tbl):
            tbl = re.sub(r'<w:tblGrid ?/>', grid, tbl, count=1)
        else:
            tbl = tbl.replace('</w:tblPr>', '</w:tblPr>' + grid, 1)
        tbl = tbl.replace('<w:tblLook', '<w:tblLayout w:type="fixed" /><w:tblLook', 1)
        tbl = tbl.replace('<w:tblW w:type="pct" w:w="5000.0" />', f'<w:tblW w:type="dxa" w:w="{TOTAL_DXA}" />')
        tbl = tbl.replace('<w:tr>', '<w:tr><w:trPr><w:tblHeader /><w:cantSplit /></w:trPr>', 1)
        fin = tbl.find('</w:tr>')
        if fin > 0:                                  # encabezado en negrita
            cab = tbl[:fin].replace('<w:r><w:rPr>', '<w:r><w:rPr><w:b />')
            cab = cab.replace('<w:r><w:t', '<w:r><w:rPr><w:b /></w:rPr><w:t')
            tbl = cab + tbl[fin:]
        partes.append(s[pos:m.start()]); partes.append(tbl); pos = m.end()
    partes.append(s[pos:])
    open(doc_xml, 'w', encoding='utf-8').write(''.join(partes))
    if k != len(grids):
        print(f'  ⚠ {len(grids)} tablas en el markdown y {k} en el documento — revisá la salida')

    set_xml = os.path.join(unp, 'word', 'settings.xml')
    st = open(set_xml, encoding='utf-8').read()
    if 'updateFields' not in st:                     # que Word pueble el indice al abrir
        st = st.replace('<w:rsids>', '<w:updateFields w:val="true"/><w:rsids>', 1)
        open(set_xml, 'w', encoding='utf-8').write(st)

    if os.path.exists(out):
        os.remove(out)
    subprocess.run(['zip', '-Xrq', out, '.'], cwd=unp, check=True)
    print(f'✓ {out} · {k} tablas')

    if args.pdf:
        if not shutil.which('soffice'):
            print('  ⚠ no está soffice: no se generó el PDF')
        else:
            subprocess.run(['soffice', '--headless', '--convert-to', 'pdf',
                            '--outdir', os.path.dirname(out), out],
                           check=True, stdout=subprocess.DEVNULL)
            print(f'✓ {os.path.splitext(out)[0]}.pdf')
    shutil.rmtree(tmp, ignore_errors=True)

if __name__ == '__main__':
    main()
