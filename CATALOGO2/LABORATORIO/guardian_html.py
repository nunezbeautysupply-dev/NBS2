# -*- coding: utf-8 -*-
"""
🛡️ EL GUARDIAN DEL HTML

Sensei, 30 ago: "cada vez que haces un cambio, algo sale perjudicado o deja de
funcionar... no entiendo por que tienes que danar algo que ya esta funcionando".

Tiene razon. Hoy un </div> perdido dejo media app invisible, y NADA lo cazo:
el JavaScript seguia siendo valido y las 33 suites en verde.

Esto cuenta las etiquetas del HTML y avisa si no cuadran. Se corre ANTES y
DESPUES de cada cambio: si el numero cambio mas de lo que se toco, algo se
llevo por delante.

    python3 guardian_html.py                 -> mira el archivo de trabajo
    python3 guardian_html.py A.html B.html   -> compara dos
"""
import io, re, sys

# Las que no llevan cierre
SOLAS = {'br','hr','img','input','meta','link','source','track','area','base','col','embed','param','wbr'}

def contar(ruta):
    s = io.open(ruta, encoding='utf-8', errors='replace').read()
    # Fuera lo que hay dentro de <script> y <style>: ahi puede haber '<div>' en textos
    s = re.sub(r'<script\b[^>]*>.*?</script>', '<script></script>', s, flags=re.S | re.I)
    s = re.sub(r'<style\b[^>]*>.*?</style>', '<style></style>', s, flags=re.S | re.I)
    s = re.sub(r'<!--.*?-->', '', s, flags=re.S)

    abre, cierra = {}, {}
    for m in re.finditer(r'<\s*(/?)\s*([a-zA-Z][a-zA-Z0-9]*)([^>]*)>', s):
        barra, tag, resto = m.group(1), m.group(2).lower(), m.group(3)
        if tag in SOLAS or resto.rstrip().endswith('/'):
            continue
        if barra:
            cierra[tag] = cierra.get(tag, 0) + 1
        else:
            abre[tag] = abre.get(tag, 0) + 1
    return abre, cierra


def revisar(ruta, callado=False):
    abre, cierra = contar(ruta)
    malas = []
    for tag in sorted(set(list(abre) + list(cierra))):
        a, c = abre.get(tag, 0), cierra.get(tag, 0)
        if a != c:
            malas.append((tag, a, c, a - c))
    if not callado:
        print('ARCHIVO:', ruta)
        print('  <div> abiertos:', abre.get('div', 0), ' cerrados:', cierra.get('div', 0))
        if malas:
            print()
            print('  \U0001f534 ETIQUETAS QUE NO CUADRAN:')
            for tag, a, c, d in malas:
                falta = 'faltan ' + str(d) + ' cierres' if d > 0 else 'sobran ' + str(-d) + ' cierres'
                print('     <' + tag + '>  abre ' + str(a) + ' · cierra ' + str(c) + '  \u2192 ' + falta)
        else:
            print('  \u2705 TODAS LAS ETIQUETAS CUADRAN')
    return malas


def comparar(antes, despues):
    aA, cA = contar(antes)
    aD, cD = contar(despues)
    print('COMPARANDO')
    print('  antes  :', antes)
    print('  despues:', despues)
    print()
    tags = sorted(set(list(aA) + list(cA) + list(aD) + list(cD)))
    cambios = []
    for t in tags:
        dA = aA.get(t, 0) - cA.get(t, 0)
        dD = aD.get(t, 0) - cD.get(t, 0)
        if dA != dD:
            cambios.append((t, dA, dD))
    if cambios:
        print('  \U0001f534 EL EQUILIBRIO CAMBIO:')
        for t, dA, dD in cambios:
            print('     <' + t + '>  antes ' + str(dA) + '  \u2192  ahora ' + str(dD))
        print()
        print('  \u26a0\ufe0f  Algo se llevo por delante. NO ENTREGAR sin mirarlo.')
        return False
    print('  \u2705 El equilibrio de las etiquetas es el MISMO. Nada se rompio.')
    return True


if __name__ == '__main__':
    if len(sys.argv) == 3:
        ok = comparar(sys.argv[1], sys.argv[2])
        sys.exit(0 if ok else 1)
    ruta = sys.argv[1] if len(sys.argv) > 1 else '/home/claude/trabajo/index.html'
    malas = revisar(ruta)
    sys.exit(1 if malas else 0)
