#!/bin/bash
# 🧬 LO PESADO — lo que no cabe en revisar_todo.sh  (5 sep 2026)
#
# 🔑 REGLA DE SENSEI: la entrega NO sale sin esto.
#
# Se corre EN TANDAS porque la tanda entera se pasa del limite de tiempo:
#     ./revisar_pesado.sh 1     mutacion, primera parte
#     ./revisar_pesado.sh 2     mutacion, segunda parte
#     ./revisar_pesado.sh 3     mutacion, tercera parte
#     ./revisar_pesado.sh 4     cobertura y propiedades
# Hay que correr LAS CUATRO.
cd /home/claude || exit 1
TANDA="${1:-1}"
cp trabajo/index.html laboratorio/BASE.html
cd laboratorio || exit 1
FALLOS=0

correrAreas(){
  local TOT=0
  for A in "$@"; do
    R=$(timeout 200 python3 mutacion.py "$A" 2>&1 | grep "cazadas  ·")
    if [ -z "$R" ]; then echo "  🔴 el área $A NO se pudo correr"; FALLOS=1; continue; fi
    N=$(echo "$R" | grep -o "^ *[0-9]*" | tr -d " "); TOT=$((TOT+${N:-0}))
    if echo "$R" | grep -q "100%"; then printf "  ✅ %-12s %s\n" "$A" "$R"
    else printf "  🔴 %-12s %s\n" "$A" "$R"; FALLOS=1; fi
  done
  echo "  ── subtotal: $TOT ──"
  CUANTO=$TOT
}

case "$TANDA" in
  1) echo "🧬 MUTACIÓN 1/3"; correrAreas dinero estado cobrar atras firma whatsapp buscar ;;
  2) echo "🧬 MUTACIÓN 2/3"; correrAreas vigilante nube ruta fechas ;;
  3) echo "🧬 MUTACIÓN 3/3"; correrAreas mandar vip credito html ;;
  4) echo "🛡️ ZONAS DELICADAS — ¿tocamos algo que no debiamos?"
     cd /home/claude && python3 vigilante_zonas.py; cd laboratorio
     echo
     echo "📊 COBERTURA"
     timeout 200 node cobertura_real.js 2>&1 | grep -E "funciones de la app|tocadas|cobertura" || { echo "  🔴 no corrió"; FALLOS=1; }
     echo
     echo "⚖️ PROPIEDADES DEL DINERO"
     R=$(timeout 280 node propiedades_dinero.js 4000 2>&1 | tail -6)
     echo "$R" | grep -E "NINGUNA ley|rompieron"
     if echo "$R" | grep -q "NINGUNA ley"; then
       CUANTO=$(echo "$R" | grep -o "[0-9]* secuencias" | head -1 | grep -o "[0-9]*")
     else FALLOS=1; CUANTO=0; fi
     ;;
  *) echo "Usa: ./revisar_pesado.sh 1|2|3|4"; exit 1 ;;
esac

echo
[ $FALLOS -eq 0 ] && echo "  ✅ tanda $TANDA en verde" || echo "  🔴 tanda $TANDA CON FALLOS — NO ENTREGAR"
mkdir -p /tmp/nbs_pruebas
if [ $FALLOS -eq 0 ]; then
  md5sum /home/claude/trabajo/index.html | cut -c1-12 > "/tmp/nbs_pruebas/pesado$TANDA"
  echo "${CUANTO:-0}" >> "/tmp/nbs_pruebas/pesado$TANDA"   # cuanto trabajo hizo
else rm -f "/tmp/nbs_pruebas/pesado$TANDA"; fi
exit $FALLOS
