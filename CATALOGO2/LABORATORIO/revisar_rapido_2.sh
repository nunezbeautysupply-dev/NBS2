#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
#  🛡️ LA REVISIÓN RÁPIDA, EN DOS PARTES  (reconstruido 18 sep 2026)
#
#  Hace TODO lo de revisar_todo.sh, pero partido en dos porque con 54
#  suites no cabe en el límite de tiempo de una sola orden:
#
#      ./revisar_rapido_2.sh 1     pasos 0-5c + primera mitad de suites
#      ./revisar_rapido_2.sh 2     resto de suites + diferencial + botones
#
#  Solo la parte 2, y solo si TODO salió en verde en las dos, escribe la
#  marca que entregar.sh exige. Una parte a medias = sin marca = sin zip.
# ═══════════════════════════════════════════════════════════════════
cd /home/claude || exit 1
TANDA="${1:-1}"
M=/tmp/nbs_pruebas; mkdir -p "$M"
CORTE=24     # cuántas suites corre la parte 1

correrSuites(){   # $1=desde  $2=hasta (índices 1-based sobre ls ordenado)
  local MAL=0 TOT=0 i=0
  for t in $(ls probar_*.js | sort | sed "s/\.js$//"); do
    i=$((i+1))
    [ $i -lt "$1" ] && continue
    [ $i -gt "$2" ] && break
    R=$(node $t.js 2>&1 | grep 'bien ·')
    N=$(echo "$R" | grep -o '^ *[0-9]*' | tr -d ' '); TOT=$((TOT+${N:-0}))
    if [ -z "$R" ] || echo "$R" | grep -qv '· 0 mal'; then
      echo "  🔴 $t → ${R:-NO TERMINÓ}"; MAL=1
    fi
  done
  echo "__SUITES__ $TOT $MAL"
}

HUELLA_AHORA(){ md5sum trabajo/index.html | cut -c1-12; }

if [ "$TANDA" = "1" ]; then
  rm -f "$M/rapido" "$M/rapido_p1"
  FALLOS=0; TOT=0
  echo "════════════════════════════════════════"
  echo "  🛡️  REVISIÓN RÁPIDA — PARTE 1 de 2"
  echo "════════════════════════════════════════"
  echo "── 0. LAS PIEZAS ARMAN BIEN ──"
  if [ -d partes ]; then
    python3 juntar.py || { echo "  🔴 LAS PIEZAS NO ARMAN"; FALLOS=1; }
  else
    echo "  (sin piezas: se trabaja sobre el archivo entero)"
  fi
  echo "── 0b. 🔍 EL ARMADO COINCIDE CON LAS PIEZAS ──"
  python3 verificar_armado.py || FALLOS=1
  echo "── 1. EL HTML ESTÁ SANO ──"
  python3 guardian_html.py trabajo/index.html || FALLOS=1
  echo "── 2. NO SE ROMPIÓ NADA DESDE EL RESPALDO ──"
  ULTIMO=""
  for R in $(ls -t RESPALDO_*.html 2>/dev/null); do
    if python3 guardian_html.py "$R" >/dev/null 2>&1; then ULTIMO="$R"; break; fi
  done
  if [ -n "$ULTIMO" ]; then
    python3 guardian_html.py "$ULTIMO" trabajo/index.html || FALLOS=1
  else
    echo "  (sin respaldo con el que comparar)"
  fi
  echo "── 3. EL JAVASCRIPT ──"
  cd trabajo && python3 /home/claude/extraer_js.py >/dev/null && node --check app.js && echo "  ✅ sintaxis correcta" || { echo "  🔴 SINTAXIS ROTA"; FALLOS=1; }
  cd /home/claude
  echo "── 4. LA ESTRUCTURA DE LA APP ──"
  node auditoria_total.js 2>&1 | grep -E "bien ·|❌" || FALLOS=1
  node auditoria_total.js 2>&1 | grep -q "· 0 mal" || FALLOS=1
  echo "── 5. EL DINERO ──"
  node auditoria_dinero.js 2>&1 | grep -E "bien ·|❌"
  node auditoria_dinero.js 2>&1 | grep -q "· 0 mal" || FALLOS=1
  echo "── 5b. CONTABILIDAD PARALELA ──"
  node contabilidad_paralela.js 2>&1 | grep -E "DAN LO MISMO|DIFERENCIA" || FALLOS=1
  node contabilidad_paralela.js 2>&1 | grep -q "DAN LO MISMO" || FALLOS=1
  echo "── 6. LAS SUITES (1 a $CORTE) ──"
  RES=$(correrSuites 1 $CORTE)
  echo "$RES" | grep -v "__SUITES__"
  LIN=$(echo "$RES" | grep "__SUITES__")
  TOT=$(echo "$LIN" | awk '{print $2}')
  [ "$(echo "$LIN" | awk '{print $3}')" = "0" ] || FALLOS=1
  echo "  suites 1-$CORTE: $TOT comprobaciones"
  echo "════════════════════════════════════════"
  if [ $FALLOS -eq 0 ]; then
    { HUELLA_AHORA; echo "$TOT"; } > "$M/rapido_p1"
    echo "  ✅ PARTE 1 EN VERDE — corre ahora: ./revisar_rapido_2.sh 2"
  else
    rm -f "$M/rapido_p1"
    echo "  🔴 PARTE 1 CON FALLOS — NO ENTREGAR"
  fi
  echo "════════════════════════════════════════"
  exit $FALLOS
fi

# ── PARTE 2 ──
echo "════════════════════════════════════════"
echo "  🛡️  REVISIÓN RÁPIDA — PARTE 2 de 2"
echo "════════════════════════════════════════"
if [ ! -f "$M/rapido_p1" ]; then
  echo "  🔴 FALTA LA PARTE 1 — corre primero: ./revisar_rapido_2.sh 1"
  exit 1
fi
if [ "$(sed -n 1p "$M/rapido_p1")" != "$(HUELLA_AHORA)" ]; then
  echo "  🔴 el archivo CAMBIÓ desde la parte 1 — vuelve a correr las dos"
  rm -f "$M/rapido_p1"
  exit 1
fi
FALLOS=0
TOT1=$(sed -n 2p "$M/rapido_p1")
TOTAL_SUITES=$(ls probar_*.js | wc -l)
echo "── 6. LAS SUITES ($((CORTE+1)) a $TOTAL_SUITES) ──"
echo "── 5c. FUZZING DEL DINERO ──"
node fuzzing_dinero.js 2>&1 | grep -E "aguantaron|ROMPEN" || FALLOS=1
node fuzzing_dinero.js 2>&1 | grep -q " 0 fallaron" || FALLOS=1
RES=$(correrSuites $((CORTE+1)) $TOTAL_SUITES)
echo "$RES" | grep -v "__SUITES__"
LIN=$(echo "$RES" | grep "__SUITES__")
TOT2=$(echo "$LIN" | awk '{print $2}')
[ "$(echo "$LIN" | awk '{print $3}')" = "0" ] || FALLOS=1
echo "  suites $((CORTE+1))-$TOTAL_SUITES: $TOT2 comprobaciones"
echo "── 7. DIFERENCIAL Y BOTONES ──"
node diferencial.js 2>&1 | tail -1
node barrido_botones.js 2>&1 | grep -E "ninguna revent|🔴"
node barrido_botones.js 2>&1 | grep -q "ninguna revent" || FALLOS=1
TOT=$((TOT1+TOT2))
echo "════════════════════════════════════════"
if [ $FALLOS -eq 0 ]; then
  { HUELLA_AHORA; echo "$TOT"; } > "$M/rapido"
  echo "  ✅ TODO EN VERDE — $TOT comprobaciones — se puede entregar"
else
  rm -f "$M/rapido"
  echo "  🔴 HAY FALLOS — NO ENTREGAR"
fi
echo "════════════════════════════════════════"
echo "  ⚠️  FALTA LO PESADO: ./revisar_pesado.sh 1, 2, 3 y 4"
exit $FALLOS
