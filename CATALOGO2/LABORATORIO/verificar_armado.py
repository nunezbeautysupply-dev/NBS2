# -*- coding: utf-8 -*-
"""
🔍 EL ARMADO COINCIDE CON LAS PIEZAS  (reconstruido 18 sep 2026)

Se perdió del zip del LABORATORIO y revisar_todo.sh lo necesita (paso 0b).
Hace UNA sola cosa: vuelve a armar el archivo desde las piezas EN MEMORIA
y comprueba que sea idéntico byte por byte a trabajo/index.html.

Si alguien tocó trabajo/index.html directo (prohibido) o una pieza quedó
a medias, esto lo caza y NO se entrega.
"""
import io, sys, hashlib

sys.path.insert(0, '/home/claude')
import juntar

def huella(t):
    return hashlib.sha256(t.encode('utf-8')).hexdigest()[:16]

def main():
    try:
        armado = juntar.armar()          # arma en memoria, sin escribir nada
    except SystemExit:
        print('  🔴 LAS PIEZAS NO ARMAN — NO SE ENTREGA')
        return 1
    try:
        actual = io.open('/home/claude/trabajo/index.html', encoding='utf-8').read()
    except Exception:
        print('  🔴 no existe trabajo/index.html — corre python3 juntar.py primero')
        return 1
    if armado == actual:
        print('  ✅ el armado coincide con las piezas · huella ' + huella(actual))
        return 0
    print('  🔴 trabajo/index.html NO coincide con las piezas — NO SE ENTREGA')
    print('     armado de piezas: ' + str(len(armado)) + ' bytes · ' + huella(armado))
    print('     el de trabajo   : ' + str(len(actual)) + ' bytes · ' + huella(actual))
    n = min(len(armado), len(actual))
    for i in range(n):
        if armado[i] != actual[i]:
            print('     primera diferencia en el byte ' + str(i))
            break
    return 1

if __name__ == '__main__':
    sys.exit(main())
