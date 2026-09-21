# -*- coding: utf-8 -*-
"""
🔗 EL JUNTADOR — vuelve a armar index.html desde las piezas  (4 sep 2026)

Sensei sigue subiendo UN SOLO archivo. Esto es lo que lo arma.

🔑 LA GARANTÍA: si no se ha tocado ninguna pieza, el archivo que sale tiene que ser
   IDÉNTICO BYTE POR BYTE al original. Si no lo es, algo se perdió y NO se entrega.

    python3 juntar.py                    → arma trabajo/index.html
    python3 juntar.py --comprobar        → arma y compara con el original, sin escribir
"""
import io, os, re, sys, hashlib

PARTES = '/home/claude/partes'
SALIDA = '/home/claude/trabajo/index.html'


def armar():
    if not os.path.isdir(PARTES):
        print('X no existe la carpeta de partes'); sys.exit(1)

    antes = io.open(PARTES + '/_antes.html', encoding='utf-8').read()
    despues = io.open(PARTES + '/_despues.html', encoding='utf-8').read()
    cabecera = io.open(PARTES + '/00_cabecera.js', encoding='utf-8').read()
    orden = [l for l in io.open(PARTES + '/_orden.txt', encoding='utf-8').read().split('\n') if l]

    # Cada pieza se lee entera y se parte otra vez en sus funciones, para poder
    # devolverlas al ORDEN ORIGINAL que guarda _orden.txt.
    porPieza = {}
    for f in os.listdir(PARTES):
        if not f.endswith('.js') or f == '00_cabecera.js':
            continue
        pz = f[:-3]
        txt = io.open(PARTES + '/' + f, encoding='utf-8').read()
        # Se corta por cada 'function nombre(' de primer nivel, igual que al partir
        cortes = [(m.start(), m.group(1)) for m in re.finditer(r'\nfunction\s+([A-Za-z_$][\w$]*)\s*\(', txt)]
        # La primera empieza en 0, no en un \n previo: se ajusta
        if cortes and cortes[0][0] != 0:
            cortes = [(0, cortes[0][1])] + cortes[1:]
        trozos = {}
        for i, (pos, nombre) in enumerate(cortes):
            fin = cortes[i + 1][0] if i + 1 < len(cortes) else len(txt)
            # Si un nombre se repite, se guardan en lista y se van sacando en orden
            trozos.setdefault(nombre, []).append(txt[pos:fin])
        porPieza[pz] = trozos

    # Se rearma en el orden de siempre
    cod = [cabecera]
    faltan = []
    for linea in orden:
        pz, nombre = linea.split('|', 1)
        lista = porPieza.get(pz, {}).get(nombre)
        if not lista:
            faltan.append(pz + ' → ' + nombre)
            continue
        cod.append(lista.pop(0))

    if faltan:
        print('🔴 FALTAN ' + str(len(faltan)) + ' FUNCIONES — NO SE ENTREGA')
        for f in faltan[:10]:
            print('   · ' + f)
        sys.exit(1)

    # Y se comprueba que no haya sobrado nada
    sobran = []
    for pz, trozos in porPieza.items():
        for nombre, lista in trozos.items():
            if lista:
                sobran.append(pz + ' → ' + nombre + ' (' + str(len(lista)) + ')')
    if sobran:
        print('🔴 SOBRAN TROZOS SIN COLOCAR — NO SE ENTREGA')
        for x in sobran[:10]:
            print('   · ' + x)
        sys.exit(1)

    return antes + ''.join(cod) + despues


def huella(t):
    return hashlib.sha256(t.encode('utf-8')).hexdigest()[:16]


def main():
    comprobar = '--comprobar' in sys.argv
    nuevo = armar()

    if comprobar:
        original = io.open('/home/claude/RESPALDO_antes_partir.html', encoding='utf-8').read()
        print('')
        print('  original: ' + str(len(original)) + ' bytes · huella ' + huella(original))
        print('  armado  : ' + str(len(nuevo)) + ' bytes · huella ' + huella(nuevo))
        print('')
        if nuevo == original:
            print('  ✅ IDÉNTICO BYTE POR BYTE — el método funciona')
            return 0
        print('  🔴 NO SON IGUALES — la cirugía se descarta')
        # ¿Dónde está la primera diferencia?
        n = min(len(nuevo), len(original))
        for i in range(n):
            if nuevo[i] != original[i]:
                print('  primera diferencia en el byte ' + str(i))
                print('  original: ' + repr(original[i:i + 70]))
                print('  armado  : ' + repr(nuevo[i:i + 70]))
                break
        else:
            print('  se diferencian en el largo: ' + str(abs(len(nuevo) - len(original))) + ' bytes')
        return 1

    io.open(SALIDA, 'w', encoding='utf-8').write(nuevo)
    print('  ✅ armado: ' + str(round(len(nuevo) / 1024)) + ' KB · huella ' + huella(nuevo))
    return 0


if __name__ == '__main__':
    sys.exit(main())
