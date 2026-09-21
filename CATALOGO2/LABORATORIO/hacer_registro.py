# -*- coding: utf-8 -*-
"""
📋 EL REGISTRO DE CAMBIOS DE NBS 2

Se perdió entre conversaciones (solo quedaba el PDF, no el guion). Reconstruido el
4 sep 2026 con el estilo negro y dorado de la portada de Sensei.

🔑 VA DENTRO DEL LABORATORIO, en el zip, para que no se vuelva a perder.

    python3 hacer_registro.py
"""
import io
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib.utils import simpleSplit

W, H = letter
IZQ, DER = 58, W - 58
ANCHO = DER - IZQ

NEGRO_F = (0.043, 0.063, 0.125)
ORO     = (0.816, 0.647, 0.267)
ORO_CL  = (0.925, 0.796, 0.478)
CREMA   = (0.961, 0.957, 0.945)
TINTA   = (0.086, 0.106, 0.180)
GRIS    = (0.42, 0.42, 0.47)
LINEA   = (0.85, 0.85, 0.88)
ROJO    = (0.70, 0.13, 0.13)

_c = None
_y = [0]
_pag = [1]


def rombo(cx, cy, r, color):
    _c.setFillColorRGB(*color)
    p = _c.beginPath()
    p.moveTo(cx, cy + r); p.lineTo(cx + r, cy)
    p.lineTo(cx, cy - r); p.lineTo(cx - r, cy); p.close()
    _c.drawPath(p, stroke=0, fill=1)


def pie():
    if _pag[0] <= 1:
        return
    _c.setStrokeColorRGB(*ORO); _c.setLineWidth(0.7)
    _c.line(IZQ, 46, IZQ + 40, 46); _c.line(DER - 40, 46, DER, 46)
    _c.setStrokeColorRGB(*LINEA); _c.setLineWidth(0.4)
    _c.line(IZQ + 46, 46, DER - 46, 46)
    _c.setFont('Helvetica', 7.5); _c.setFillColorRGB(*GRIS)
    _c.drawString(IZQ, 33, 'NUNEZ BEAUTY SUPPLY')
    _c.setFont('Helvetica-Bold', 7.5); _c.setFillColorRGB(*ORO)
    _c.drawCentredString(W / 2, 33, 'REGISTRO DE CAMBIOS')
    _c.setFont('Helvetica-Bold', 9); _c.setFillColorRGB(*TINTA)
    _c.drawRightString(DER, 33, str(_pag[0]))


def nueva():
    pie(); _c.showPage(); _pag[0] += 1; _y[0] = H - 72


def salto(alto=0):
    if _y[0] - alto < 72:
        nueva()


def hueco(n):
    _y[0] -= n


def portada(version):
    _c.setFillColorRGB(*NEGRO_F)
    _c.rect(0, 0, W, H, stroke=0, fill=1)
    _c.setFillColorRGB(0.075, 0.098, 0.180)
    p = _c.beginPath(); p.moveTo(0, H); p.lineTo(W * 0.45, H); p.lineTo(0, H * 0.42); p.close()
    _c.drawPath(p, stroke=0, fill=1)

    _c.setStrokeColorRGB(*ORO); _c.setLineWidth(1.2)
    _c.line(W / 2 - 120, H - 300, W / 2 - 24, H - 300)
    _c.line(W / 2 + 24, H - 300, W / 2 + 120, H - 300)
    rombo(W / 2, H - 300, 5, ORO)

    _c.setFont('Helvetica-Bold', 30); _c.setFillColorRGB(*CREMA)
    _c.drawCentredString(W / 2, H - 350, 'REGISTRO DE CAMBIOS')
    _c.setFont('Helvetica', 13); _c.setFillColorRGB(*ORO_CL)
    _c.drawCentredString(W / 2, H - 378, 'Todo lo que se le ha hecho a la app, por dias')

    _c.setFont('Helvetica-Bold', 11); _c.setFillColorRGB(*ORO)
    _c.drawCentredString(W / 2, H - 430, version)

    _c.setFont('Helvetica-Bold', 9.5); _c.setFillColorRGB(*ORO_CL)
    _c.drawCentredString(W / 2, 90, 'NUNEZ BEAUTY SUPPLY  \u00b7  PROVIDENCE, RHODE ISLAND')
    nueva()


def fecha(dia, ver):
    salto(80)
    _y[0] -= 18
    _c.setFillColorRGB(*NEGRO_F)
    _c.rect(IZQ, _y[0] - 8, ANCHO, 34, stroke=0, fill=1)
    _c.setFillColorRGB(*ORO)
    _c.rect(IZQ, _y[0] - 11, ANCHO, 2.5, stroke=0, fill=1)
    _c.setFont('Helvetica-Bold', 15); _c.setFillColorRGB(*CREMA)
    _c.drawString(IZQ + 12, _y[0] + 4, dia)
    _c.setFont('Helvetica', 9); _c.setFillColorRGB(*ORO_CL)
    _c.drawRightString(DER - 12, _y[0] + 5, ver)
    _y[0] -= 30


def titulo(t, rojo=False):
    salto(46)
    _y[0] -= 13
    rombo(IZQ + 4, _y[0] + 4, 4, ROJO if rojo else ORO)
    _c.setFont('Helvetica-Bold', 12.5)
    _c.setFillColorRGB(*(ROJO if rojo else TINTA))
    primera = True
    for ln in simpleSplit(t, 'Helvetica-Bold', 12.5, ANCHO - 18):
        salto(18)
        _c.setFont('Helvetica-Bold', 12.5)
        _c.setFillColorRGB(*(ROJO if rojo else TINTA))
        _c.drawString(IZQ + 16 if primera else IZQ, _y[0], ln)
        primera = False
        _y[0] -= 16
    _y[0] -= 3


def parrafo(t, sangria=0):
    for ln in simpleSplit(t, 'Helvetica', 10.5, ANCHO - sangria):
        salto(15)
        _c.setFont('Helvetica', 10.5); _c.setFillColorRGB(*TINTA)
        _c.drawString(IZQ + sangria, _y[0], ln)
        _y[0] -= 14
    _y[0] -= 3


def main():
    global _c
    _c = canvas.Canvas('/home/claude/Registro_de_Cambios_NBS.pdf', pagesize=letter)
    _y[0] = H - 72
    portada('Version 20260904g-OFICIAL-V2.0')

    # ═══════════════════════════════════════════════════════
    fecha('4 DE SEPTIEMBRE', 'version 20260904e')

    titulo('LA APP YA NO SE CIERRA SOLA CON EL BOTON ATRAS', rojo=True)
    parrafo('Sensei: "la app se sigue saliendo dandole al boton de atras del celular, sigue pasando '
            'desde hace mucho tiempo... no quiero que se salga aunque le de muchas veces, tiene que '
            'salir la opcion de salir o quedarme".')
    parrafo('LA CAUSA: la proteccion del boton atras -el colchon de pasos- solo se rellenaba al '
            'TOCAR la pantalla. Dando atras varias veces seguidas sin tocar nada, se gastaba, y al '
            'llegar a cero Android cerraba la app.')
    parrafo('LA CURA: el letrero de "\u00bfsalir o quedarme?" ahora sale cuando quedan POCOS pasos, '
            'no cuando se acaban. Asi nunca se llega a cero. Y el freno que evitaba rellenar dos '
            'veces seguidas ya no se aplica cuando la proteccion esta baja.')
    hueco(4)

    titulo('LA PRUEBA MAS FUERTE QUE EXISTE, PUESTA A TRABAJAR')
    parrafo('Sensei pidio "la mejor prueba de las mejores" para el dinero. Se buscaron TODAS las '
            'que existen y se monto la mas fuerte que se puede aplicar a la app: prueba por '
            'propiedades con reduccion automatica.')
    parrafo('QUE HACE: inventa miles de dias de trabajo al azar -vender, cobrar, devolver, '
            'cancelar, editar facturas, borrar pagos, aplicar credito- y despues de CADA operacion '
            'comprueba 10 LEYES DEL DINERO.')
    parrafo('LO QUE LA HACE SUPERIOR: cuando encuentra un fallo, lo REDUCE sola. De 28 operaciones '
            'al azar baja a las 2 que lo provocan, escritas en cristiano.')
    hueco(4)

    titulo('DOS FALLOS DE DINERO QUE LLEVABAN AHI DESDE SIEMPRE', rojo=True)
    parrafo('1. AL BAJAR EL TOTAL DE UNA FACTURA YA PAGADA, EL SOBRANTE SE PERDIA.')
    parrafo('Factura de contado con $116.69 pagados. Se edita y se baja a $113.82. El pago se '
            'quedaba en $116.69, la factura decia "pagada", y los $2.87 se perdian en el aire.', sangria=14)
    parrafo('Ahora van al credito a favor del cliente, el pago se ajusta al total nuevo, y sale '
            'un aviso diciendolo.', sangria=14)
    hueco(3)
    parrafo('2. DOS COBROS EN EL MISMO MINUTO PODIAN COMPARTIR NUMERO DE RECIBO.')
    parrafo('El numero acababa en dos cifras al azar: solo 90 posibles por minuto. Cobrando a dos '
            'barberos seguidos habia 1 entre 90 de que coincidieran, y la app los juntaba como UN '
            'SOLO COBRO en el estado de cuenta.', sangria=14)
    parrafo('Ahora el numero lleva segundos y un contador que no da la vuelta. Probado con 300 '
            'recibos seguidos: ninguno se repite.', sangria=14)
    hueco(4)

    titulo('LAS 19 FUNCIONES DE DINERO QUE NO TENIAN NINGUNA PRUEBA')
    parrafo('El analisis encontro que 71 funciones de la app ESCRIBEN dinero y 56 no tenian ninguna '
            'prueba. Se cubrieron las 19 mas graves: las que mueven o borran dinero.')
    parrafo('Borrar un pago (los tres caminos) \u00b7 cancelar una factura \u00b7 el editor de pagos \u00b7 '
            'guardar el balance inicial \u00b7 eliminar cliente, compra, gasto y factura cancelada \u00b7 '
            'eliminar duplicados \u00b7 guardar venta, cliente y gasto \u00b7 y restaurar un backup.', sangria=14)
    parrafo('Cada una se prueba de verdad y despues se comprueban las leyes del dinero: no basta '
            'con que no reviente, las cuentas tienen que seguir cuadrando. 32 comprobaciones.')
    hueco(4)

    titulo('LA NUBE SE QUEDABA COLGADA EN SILENCIO', rojo=True)
    parrafo('Sensei: "ese error lleva mas de 10 minutos y le doy actualizar y dice lo mismo ya 5 '
            'veces". El aviso decia "quedan 6 pendientes pero NINGUNO dio error".')
    parrafo('LA CAUSA: si comprimir o el envio a la nube se quedan colgados, no avisan de nada. Ni '
            'de exito ni de error. No subia, no apuntaba fallo, y esperaba para siempre.')
    parrafo('AHORA: un tope de 20 segundos que lo apunta como colgado \u00b7 el aviso dice QUE esta '
            'atascado y cuanto pesa \u00b7 y un boton para bajar un backup ahi mismo.')
    hueco(4)

    titulo('LOS DOS BOTONES DE MANDAR NO FUNCIONABAN', rojo=True)
    parrafo('Desde el estado de cuenta, ninguno de los dos hacia nada. Eran fallos DISTINTOS:')
    parrafo('El de arriba salia DETRAS: tenia el mismo nivel que el estado de cuenta y empataban.', sangria=14)
    parrafo('El de abajo se cortaba en un letrero del telefono con todo el mensaje dentro, que en '
            'Android a veces no se dibuja y devuelve "no" solo.', sangria=14)
    hueco(4)

    titulo('SE RECUPERO UNA PROTECCION PERDIDA', rojo=True)
    parrafo('La app habia perdido el relleno del colchon del boton atras -el arreglo del 30 de '
            'agosto para que no se cerrara sola-. El comentario seguia, el codigo no.')
    parrafo('Lo cazo la prueba de mutacion al no poder aplicarse. Una mutacion que "no aplica" es '
            'una proteccion que ya no existe.')
    hueco(4)

    titulo('LA APP, PARTIDA EN 12 PIEZAS PARA TRABAJAR')
    parrafo('Sensei eligio: partir para trabajar, juntar para entregar. El sigue subiendo UN SOLO '
            'archivo; las piezas son para que los cambios no se lleven por delante cosas que no '
            'se estan tocando.')
    parrafo('PROBADO: partir y juntar sin tocar nada da un archivo IDENTICO byte por byte. Y al '
            'tocar la pieza del VIP, de las 40.736 lineas del archivo cambio UNA SOLA.')
    hueco(8)

    # ═══════════════════════════════════════════════════════
    fecha('3 DE SEPTIEMBRE', 'version 20260903e')

    titulo('EL PROGRAMA VIP, CON LAS REGLAS NUEVAS')
    parrafo('Sensei dicto las reglas completas y sustituyen a todas las anteriores.')
    parrafo('Solo $10.00 (1 punto) y $5.00 en navajas (2 = 1 punto). Manda la MARCA y la CATEGORIA, '
            'no el nombre: 10 colonias Immortal de nombres distintos ya son un premio.')
    parrafo('Las 8 categorias: hair gel \u00b7 wax y cream de pelo (con pomada, paste y matte clay) \u00b7 '
            'colonias \u00b7 after shave \u00b7 leave in \u00b7 two phase \u00b7 navajas \u00b7 papel de cuello.')
    parrafo('Retroactivo desde junio 2026, aunque el cliente no este inscrito.')
    hueco(3)
    parrafo('Y se puede AJUSTAR los puntos de cada grupo a mano, con el motivo apuntado: "tiene 8, '
            'le doy el premio y le dejo 1 para ayudarlo". Lo que compre despues sigue sumando.')
    hueco(4)

    titulo('LA FANFARRIA DEL PREMIO')
    parrafo('Cinco notas subiendo, mas fuerte que los demas avisos. Suena UNA SOLA VEZ, en el '
            'momento en que un grupo llega a los 10 puntos.')
    parrafo('Y el aviso del premio va PRIMERO en el asistente y NO se puede archivar: se queda '
            'hasta que se le da el regalo de verdad.')
    hueco(4)

    titulo('LAS CUATRO FORMAS DE MANDAR UN MENSAJE')
    parrafo('WhatsApp y Texto de un toque cada uno, mas Copiar y Compartir. El mensaje se ve antes '
            'de mandarlo y se copia solo, por si algo falla.')
    hueco(3)
    parrafo('Y SE ENCONTRO EL FALLO INTERMITENTE DE WHATSAPP: el enlace llevaba el mensaje TRES '
            'VECES. Un mensaje de 149 letras hacia un enlace de 878 caracteres, en el filo del '
            'limite de Android. Por eso unas veces abria y otras daba error. Ahora va una sola vez.')
    hueco(4)

    titulo('"SU ULTIMO PAGO", NO "PAGO DE HOY"')
    parrafo('Decir "pago de hoy" era falso cuando el pago fue dias antes. Ahora la app escoge sola: '
            '"Recibi su pago de $X" si es de hoy, o "Su ultimo pago: $X del <fecha>" si fue otro '
            'dia. Si nunca ha pagado, no menciona pagos.')
    hueco(8)

    # ═══════════════════════════════════════════════════════
    fecha('2 DE SEPTIEMBRE', 'version 20260902b')

    titulo('PODER ELEGIR LA FECHA EN TODO')
    parrafo('Sensei: "el pedido nunca me llega el dia que hacen la factura sino unos dias despues, '
            'entonces no tengo forma de elegir la fecha".')
    parrafo('La mitad de la app ya lo tenia. Se agrego en los ocho que faltaban: compra a suplidor, '
            'cobro al cliente (por los dos caminos), pago al suplidor desde su ficha, devolucion, '
            'cierre de ruta, premio VIP, credito a favor y confirmacion firmada.')
    parrafo('Siempre viene puesta la de hoy. Y si la fecha viene mal -vacia, con letras, o un '
            'imposible como el 31 de febrero- se guarda la de hoy.')
    hueco(4)

    titulo('LA FECHA SALE SOLA DE LA FACTURA PDF')
    parrafo('Al leer una factura de suplidor, la app saca la fecha del propio PDF. Entiende 8 '
            'formatos, en ingles y espanol, y si hay varias fechas gana la de la factura.')
    parrafo('Se ve arriba del todo, con la nota "la lei del PDF, si esta mal cambiala aqui".')
    hueco(3)
    parrafo('Y de paso se caso un fallo que daba miedo: EL 31 DE FEBRERO COLABA. En programacion, '
            'pedir el 31 de febrero no da error: se pasa solo al 3 de marzo, calladito. Una fecha '
            'mal impresa se habria guardado CAMBIADA sin que nadie se enterara.')

    pie()
    _c.save()
    print('paginas:', _pag[0])


if __name__ == '__main__':
    main()
