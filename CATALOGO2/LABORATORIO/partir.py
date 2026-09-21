# -*- coding: utf-8 -*-
"""
✂️ EL PARTIDOR — corta index.html en piezas para trabajar  (4 sep 2026)

Sensei, 4 sep: eligió la opción B — "partir para trabajar, juntar para entregar".
Él sigue subiendo UN SOLO archivo; las piezas son solo para que Claude trabaje sobre
2.000 líneas en vez de 40.000, y no se lleve por delante cosas que no está tocando.

🔑 REGLA DE ORO: esto NO cambia ni una coma. Corta y ya.
   El juntador (juntar.py) tiene que devolver un archivo IDÉNTICO byte por byte.
   Si no sale idéntico, la cirugía se descarta entera.

    python3 partir.py            → parte trabajo/index.html en partes/
"""
import io, os, re, sys

ORIGEN = '/home/claude/trabajo/index.html'
DESTINO = '/home/claude/partes'

# ═══════════════════════════════════════════════════════════════════
#  A QUÉ PIEZA VA CADA FUNCIÓN
#  Se mira el nombre. La primera regla que coincide manda, así que el
#  orden importa: lo más específico primero.
# ═══════════════════════════════════════════════════════════════════
PIEZAS = [
    ('03_cobrar', r'cobrad|debeDe|renderCxC|abrirAbono|confirmarPago|pagoMultiple|planDeReparto'
                  r'|usarCredito|creditoAFavor|CreditoAplicado|balanceDelCliente|saldoDe'
                  r'|esSaldoPendiente|facturasQueDeben|cobrosDelCliente|EstadoDeCuenta'
                  r'|estadoDeCuenta|pagarTodoEfectivo|nuevoPagoId|nuevoNumeroRecibo'
                  r'|EditorPago|editorPago|Abono|abono|cxc|Cxc|CxC'),

    ('06_vip',    r'VIP|vip'),

    ('05_compras', r'saveCC|Compra|compra|Suplidor|suplidor|Factura.*[Pp]df|PdfFactura'
                   r'|analizarFactura|detectarSuplidor|cargosDeLa|descuentosDeLa|subtotalImpreso'
                   r'|fechaDeLaFactura|buscarProductoParecido|iCC'),

    ('07_ruta',   r'Van|van\b|Ruta|ruta|Relleno|relleno|Visita|visita|CierreRuta|cierreRuta'),

    ('11_asistente', r'[Aa]sistente|analizarNegocio|avisoGrande|avisosLeidos|avisosPendientes'
                     r'|huellaDeAviso|estaLeido|verYMarcarLeido|_pitido|sonido|Sonido'
                     r'|loQueSeAcaba|clientesQueSeCallaron|revisionDiaria|_cliente[MP]|_producto[MP]'),

    ('09_nube',   r'[Nn]ube|subirPendientes|Firebase|firebase|exportD|importD|fundirCon'
                  r'|[Bb]ackup|respaldo|Respaldo|sincroniz|Sincroniz|derivarLlave|base64A'
                  r'|cifrar|descifrar|quitarFirmas|pegarFirmas|vidsConFirma'),

    ('10_fotos',  r'[Ff]oto|Imagen|imagen|_IMGS|recortar|Recortar|girar|Girar|canvas|Canvas'
                  r'|[Ff]irma'),

    ('08_reportes', r'mostrarReporte|mostrarResumen|mostrarPanorama|mostrarMargen|renderBitacora'
                    r'|[Rr]eporte|imprimir|Imprimir|compartir|Compartir|[Mm]anual'),

    ('02_vender', r'saveV\b|renderIV|calcDesc|_ventasReales|Venta|venta|iV\b|[Pp]edido'),

    ('04_productos', r'[Pp]roducto|loadProds|renderCatalogo|Catalogo|catalogo|[Ii]nventario'
                     r'|[Mm]arca|precio|Precio|costo|Costo|stock|Stock'),

    ('01_clientes', r'[Cc]liente|verCl|saveCl|_filaPanel|nombreCl|panelCl|Panel[Cc]l'),

    # Todo lo que no encaje arriba se queda en la base: ayuditas, arranque, botón atrás...
    ('00_base',   r'.'),
]


def piezaDe(nombre):
    for pieza, patron in PIEZAS:
        if re.search(patron, nombre):
            return pieza
    return '00_base'


def main():
    s = io.open(ORIGEN, encoding='utf-8').read()

    # El bloque grande de código, que es donde vive todo
    grande = None
    for x in re.finditer(r'<script\b[^>]*>(.*?)</script>', s, re.S | re.I):
        if len(x.group(1)) > 1000000:
            grande = x
    if not grande:
        print('X no encontré el bloque de código'); sys.exit(1)

    antes = s[:grande.start(1)]          # todo lo de arriba, tal cual
    cod = grande.group(1)
    despues = s[grande.end(1):]          # todo lo de abajo, tal cual

    # Las funciones de primer nivel, en orden
    fns = [(x.start(), x.group(1)) for x in re.finditer(r'\nfunction\s+([A-Za-z_$][\w$]*)\s*\(', cod)]
    if not fns:
        print('X no encontré funciones'); sys.exit(1)

    # 🔑 Cada trozo va desde el inicio de su función hasta el inicio de la siguiente.
    # Así no se pierde NI UN BYTE: los comentarios de encima de una función se quedan
    # con la anterior, pero eso da igual — al juntar vuelve todo a su sitio.
    trozos = []
    cabecera = cod[:fns[0][0]]           # variables y arranque, antes de la 1ª función
    for i, (pos, nombre) in enumerate(fns):
        fin = fns[i + 1][0] if i + 1 < len(fns) else len(cod)
        trozos.append((nombre, cod[pos:fin]))

    # Se reparten en piezas, conservando el ORDEN ORIGINAL dentro de cada una
    porPieza = {}
    orden = []      # para poder juntarlas en el mismo orden en que estaban
    for nombre, txt in trozos:
        pz = piezaDe(nombre)
        porPieza.setdefault(pz, []).append(txt)
        orden.append((pz, nombre))

    os.makedirs(DESTINO, exist_ok=True)
    for f in os.listdir(DESTINO):
        os.remove(os.path.join(DESTINO, f))

    # Lo de arriba y lo de abajo del bloque, tal cual
    io.open(DESTINO + '/_antes.html', 'w', encoding='utf-8').write(antes)
    io.open(DESTINO + '/_despues.html', 'w', encoding='utf-8').write(despues)
    io.open(DESTINO + '/00_cabecera.js', 'w', encoding='utf-8').write(cabecera)

    for pz in sorted(porPieza):
        io.open(DESTINO + '/' + pz + '.js', 'w', encoding='utf-8').write(''.join(porPieza[pz]))

    # 🔑 EL ORDEN, que es lo que permite volver a juntarlo IDÉNTICO
    io.open(DESTINO + '/_orden.txt', 'w', encoding='utf-8').write(
        '\n'.join(pz + '|' + nom for pz, nom in orden))

    print('')
    print('  PIEZA'.ljust(22) + 'FUNCIONES'.rjust(10) + 'TAMAÑO'.rjust(10))
    print('  ' + '-' * 40)
    tot = 0
    for pz in sorted(porPieza):
        n = len(porPieza[pz])
        kb = round(len(''.join(porPieza[pz])) / 1024)
        tot += n
        print('  ' + pz.ljust(20) + str(n).rjust(10) + (str(kb) + ' KB').rjust(10))
    print('  ' + '-' * 40)
    print('  ' + 'TOTAL'.ljust(20) + str(tot).rjust(10)
          + (str(round(len(cod) / 1024)) + ' KB').rjust(10))
    print('')
    print('  cabecera (variables y arranque): ' + str(round(len(cabecera) / 1024)) + ' KB')


if __name__ == '__main__':
    main()
