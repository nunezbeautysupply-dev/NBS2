#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  🚨 LA ÚNICA ORDEN PARA ENTREGAR  (5 sep 2026)
#
#  Sensei: "no se puede olvidar de nuevo, tiene que ser prioridad
#  como regla número 1 obligatoria correr TODAS las pruebas".
#
#  🔑 Ya NO depende de que Claude se acuerde: sin las 5 marcas en
#  verde, esta orden SE NIEGA a armar el zip.
#
#      ./entregar.sh NBS2_loquesea_MMDDAA
# ═══════════════════════════════════════════════════════════════
cd /home/claude || exit 1
NOMBRE="$1"
[ -z "$NOMBRE" ] && { echo "Usa: ./entregar.sh NBS2_loquesea_MMDDAA"; exit 1; }
M=/tmp/nbs_pruebas

FALTAN=""
[ -f "$M/rapido" ]  || FALTAN="$FALTAN\n     ./revisar_todo.sh        (lo rápido)"
[ -f "$M/pesado1" ] || FALTAN="$FALTAN\n     ./revisar_pesado.sh 1    (mutación 1/3)"
[ -f "$M/pesado2" ] || FALTAN="$FALTAN\n     ./revisar_pesado.sh 2    (mutación 2/3)"
[ -f "$M/pesado3" ] || FALTAN="$FALTAN\n     ./revisar_pesado.sh 3    (mutación 3/3)"
[ -f "$M/pesado4" ] || FALTAN="$FALTAN\n     ./revisar_pesado.sh 4    (cobertura y propiedades)"

if [ -n "$FALTAN" ]; then
  echo "════════════════════════════════════════════════════"
  echo "  🔴 NO SE PUEDE ENTREGAR — FALTAN PRUEBAS"
  echo "════════════════════════════════════════════════════"
  echo -e "  Falta correr:$FALTAN"
  echo
  echo "  🔑 REGLA Nº1 DE SENSEI: la entrega NO sale sin"
  echo "     TODAS las pruebas en verde."
  echo "════════════════════════════════════════════════════"
  exit 1
fi

# 🔑 Y que las marcas sean de ESTE archivo, no de uno viejo
HUELLA=$(md5sum trabajo/index.html | cut -c1-12)
for f in rapido pesado1 pesado2 pesado3 pesado4; do
  if [ "$(sed -n 1p "$M/$f" 2>/dev/null)" != "$HUELLA" ]; then
    echo "  🔴 la prueba '$f' se corrió sobre OTRA versión del archivo."
    echo "     Vuelve a correrlas todas."
    exit 1
  fi
done

# 🚨 Y que cada tanda haya hecho el TRABAJO COMPLETO, no una muestra corta
MINIMOS="rapido:900 pesado1:25 pesado2:14 pesado3:30 pesado4:4000"
for par in $MINIMOS; do
  f="${par%%:*}"; min="${par##*:}"
  n=$(sed -n '2p' "$M/$f" 2>/dev/null)
  if [ -z "$n" ] || [ "$n" -lt "$min" ] 2>/dev/null; then
    echo "  🔴 la tanda '$f' corrió INCOMPLETA: $n (mínimo $min)"
    echo "     🔑 REGLA DE SENSEI: las pruebas se hacen COMPLETAS siempre."
    exit 1
  fi
done

echo "  ✅ las 5 tandas en verde y COMPLETAS — armando el zip"
D="entrega/$NOMBRE"
rm -rf "$D" && mkdir -p "$D/LABORATORIO/partes"
cp trabajo/index.html "$D/"
cp partir.py juntar.py hacer_registro.py entregar.sh revisar_todo.sh revisar_pesado.sh \
   verificar_armado.py revisar_rapido_2.sh vigilante_zonas.py \
   laboratorio/mutacion.py laboratorio/cobertura_real.js laboratorio/leyes_dinero.js \
   laboratorio/propiedades_dinero.js guardian_html.py contabilidad_paralela.js \
   fuzzing_dinero.js auditoria_total.js auditoria_dinero.js diferencial.js \
   barrido_botones.js extraer_js.py BASE_20260819f.html probar_*.js "$D/LABORATORIO/" 2>/dev/null
# 📸 La copia de los catálogos que se probaron (probar_bloqueo y probar_buzon los leen).
# Si Sensei cambia un catálogo, hay que pedirle el nuevo — esta es la foto de HOY.
mkdir -p "$D/LABORATORIO/catalogo" "$D/LABORATORIO/catalogo2"
cp catalogo/catalogo_pedidos.html "$D/LABORATORIO/catalogo/" 2>/dev/null
cp catalogo2/catalogo.html "$D/LABORATORIO/catalogo2/" 2>/dev/null
cp partes/* "$D/LABORATORIO/partes/" 2>/dev/null
cd entrega && zip -r "$NOMBRE.zip" "$NOMBRE" > /dev/null
echo "  ✅ entrega/$NOMBRE.zip  ($(du -h "$NOMBRE.zip" | cut -f1))"
