#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
🛡️ EL VIGILANTE DE LAS ZONAS DELICADAS  (8 sep 2026)

Sensei, después de que la huella dejara de funcionar tras la entrega de los reportes:
"esta situación ha sucedido más de 10 veces, y siempre buscas una excusa... sé que
puedes detectar si tocaste algo y afectó otra parte de la app, trabaja con más cuidado".

🔑 QUÉ HACE: compara la app de AHORA contra la ÚLTIMA ENTREGA y avisa si algún cambio
tocó una zona delicada — huella, bloqueo, sesión, dinero — aunque el trabajo del día
fuera de otra cosa.

Lo que se le escapó a Claude y este vigilante habría cazado: el puente de pedidos
metió `signInAnonymously` en el catálogo, la sesión de invitado pisó la de Sensei, y su
huella dejó de valer. Nadie lo relacionó porque el trabajo del día eran "los reportes".

    python3 vigilante_zonas.py            compara con la última entrega
    python3 vigilante_zonas.py <archivo>  compara con el que le digas
"""
import io, os, re, sys, glob, difflib

AHORA = '/home/claude/trabajo/index.html'
CATALOGO = '/home/claude/catalogo/catalogo_pedidos.html'

# ── LAS ZONAS DELICADAS ──
# Cada una: nombre, qué palabras la marcan, y por qué importa.
ZONAS = [
    ('🔒 LA HUELLA Y EL BLOQUEO',
     r'huella|credentials\.(get|create)|CLAVE_HUELLA|pantalla-bloqueo|bloquearApp|_relojHuella',
     'Si se rompe, Sensei se queda FUERA de su propia app'),

    ('👤 LA SESIÓN',
     r'signInAnonymously|signInWith|signOut|currentUser|onAuthStateChanged',
     'Un cambio de sesión invalida la huella y puede sacarlo'),

    ('💰 EL DINERO',
     r'cobradoYDebeDe|balanceDelCliente|creditoAFavor|pagosFactura|confirmarPagoMultiple',
     'Cualquier fallo aquí le cuesta plata de verdad'),

    ('💾 LOS DATOS',
     r'function SS\(|function LS\(|localStorage\.setItem|localStorage\.removeItem|importD',
     'Es donde vive su negocio'),

    ('☁️ LA NUBE',
     r'fbDb\.collection|subirALaNube|cargarDatosDeLaNube|firebase\.initializeApp',
     'Si falla, deja de tener copia de seguridad'),
]


def ultimaEntrega():
    """El index.html de la última entrega, para comparar contra él."""
    zips = sorted(glob.glob('/home/claude/entrega/*/index.html'), key=os.path.getmtime)
    return zips[-1] if zips else None


def bloquesQueCambiaron(viejo, nuevo):
    a = viejo.split('\n')
    b = nuevo.split('\n')
    sm = difflib.SequenceMatcher(None, a, b, autojunk=False)
    out = []
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == 'equal':
            continue
        out.append({
            'tipo': tag,
            'quita': '\n'.join(a[i1:i2]),
            'pone': '\n'.join(b[j1:j2]),
            'linea': j1 + 1
        })
    return out


def revisar(rutaVieja, rutaNueva, comoSeLlama):
    if not os.path.exists(rutaVieja) or not os.path.exists(rutaNueva):
        return []
    viejo = io.open(rutaVieja, encoding='utf-8', errors='replace').read()
    nuevo = io.open(rutaNueva, encoding='utf-8', errors='replace').read()
    if viejo == nuevo:
        return []

    avisos = []
    for b in bloquesQueCambiaron(viejo, nuevo):
        texto = b['quita'] + '\n' + b['pone']
        # La versión cambia en cada entrega: no es una zona delicada
        if re.search(r'app-version|NOVEDADES_VERSION', texto) and len(texto) < 200:
            continue
        for nombre, patron, porque in ZONAS:
            if re.search(patron, texto, re.I):
                # Qué palabra exacta lo marcó, para poder mirarlo
                m = re.search(patron, texto, re.I)
                avisos.append({
                    'archivo': comoSeLlama,
                    'zona': nombre,
                    'porque': porque,
                    'palabra': m.group(0),
                    'linea': b['linea'],
                    'tipo': b['tipo'],
                    'quita': b['quita'][:200],
                    'pone': b['pone'][:200]
                })
                break
    return avisos


def main():
    contra = sys.argv[1] if len(sys.argv) > 1 else ultimaEntrega()
    if not contra:
        print('  No encontré una entrega anterior con la que comparar.')
        return 0

    print('')
    print('════════════════════════════════════════════════════')
    print('  🛡️  VIGILANTE DE LAS ZONAS DELICADAS')
    print('════════════════════════════════════════════════════')
    print('  comparando contra: ' + os.path.basename(os.path.dirname(contra)))
    print('')

    avisos = revisar(contra, AHORA, 'index.html')

    # Y el catálogo, que vive aparte pero comparte el sitio
    catViejo = os.path.join(os.path.dirname(contra), 'CATALOGO', 'catalogo_pedidos.html')
    avisos += revisar(catViejo, CATALOGO, 'catalogo_pedidos.html')

    if not avisos:
        print('  ✅ Ningún cambio tocó una zona delicada.')
        print('════════════════════════════════════════════════════')
        return 0

    # Agrupados por zona, para leerlos de un vistazo
    porZona = {}
    for a in avisos:
        porZona.setdefault(a['zona'], []).append(a)

    print('  ⚠️  SE TOCARON %d ZONA(S) DELICADA(S)' % len(porZona))
    print('')
    for zona, lista in porZona.items():
        print('  ' + zona + '  (%d cambio(s))' % len(lista))
        print('     ' + lista[0]['porque'])
        for a in lista[:3]:
            print('     · %s linea %d — marcó: "%s"'
                  % (a['archivo'], a['linea'], a['palabra'][:40]))
        print('')

    print('  🔑 Esto NO significa que esté mal. Significa que hay que')
    print('     MIRARLO Y PROBARLO antes de entregar.')
    print('════════════════════════════════════════════════════')
    # Devuelve 2: no es un fallo, es un aviso que hay que atender
    return 2


if __name__ == '__main__':
    sys.exit(main())
