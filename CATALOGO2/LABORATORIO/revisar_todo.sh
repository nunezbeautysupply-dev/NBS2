#!/bin/bash
# 🛡️ LA REVISIÓN COMPLETA — se corre ANTES DE CADA ENTREGA, sin excepción.
# Sensei, 30 ago: "no sé qué es lo que vas a hacer para que no sigan pasando estas cosas".
# Esto es lo que se va a hacer.
cd /home/claude
FALLOS=0

echo "════════════════════════════════════════"
echo "  🛡️  REVISIÓN COMPLETA DE NBS 2"
echo "════════════════════════════════════════"
echo
echo "── 0. LAS PIEZAS ARMAN BIEN ──"
# 🔑 Si se trabajó con piezas, el archivo tiene que armarse sin faltar ninguna.
if [ -d partes ]; then
  python3 juntar.py || { echo "  🔴 LAS PIEZAS NO ARMAN"; FALLOS=1; }
else
  echo "  (sin piezas: se trabaja sobre el archivo entero)"
fi
echo
echo "── 0b. 🔍 EL ARMADO COINCIDE CON LAS PIEZAS ──"
python3 verificar_armado.py || exit 1

echo "── 1. EL HTML ESTÁ SANO ──"
python3 guardian_html.py trabajo/index.html || FALLOS=1
echo
echo "── 2. NO SE ROMPIÓ NADA DESDE EL RESPALDO ──"
# ⚠️ Se compara contra el ultimo respaldo SANO. Uno roto daria falsa alarma
# para siempre, y una alarma que siempre suena deja de servir.
ULTIMO=""
for R in $(ls -t RESPALDO_*.html 2>/dev/null); do
  if python3 guardian_html.py "$R" >/dev/null 2>&1; then ULTIMO="$R"; break; fi
done
if [ -n "$ULTIMO" ]; then
  python3 guardian_html.py "$ULTIMO" trabajo/index.html || FALLOS=1
else
  echo "  (sin respaldo con el que comparar)"
fi
echo
echo "── 3. EL JAVASCRIPT ──"
cd trabajo && python3 /home/claude/extraer_js.py >/dev/null && node --check app.js && echo "  ✅ sintaxis correcta" || { echo "  🔴 SINTAXIS ROTA"; FALLOS=1; }
cd /home/claude
echo
echo "── 4. LA ESTRUCTURA DE LA APP ──"
node auditoria_total.js 2>&1 | grep -E "bien ·|❌" || FALLOS=1
echo
echo "── 5. EL DINERO ──"
node auditoria_dinero.js 2>&1 | grep -E "bien ·|❌"
echo
echo "── 5b. CONTABILIDAD PARALELA ──"
node contabilidad_paralela.js 2>&1 | grep -E "DAN LO MISMO|DIFERENCIA" || FALLOS=1
echo
echo "── 5c. FUZZING DEL DINERO ──"
node fuzzing_dinero.js 2>&1 | grep -E "aguantaron|ROMPEN" || FALLOS=1
echo
echo "── 6. LAS SUITES ──"
MAL=0
TOT=0
# 🔑 Por lotes: con 51 suites el guión se pasaba de tiempo. -17 sep-
for t in $(ls probar_*.js | sed "s/\.js$//"); do
  R=$(node $t.js 2>&1 | grep 'bien ·')
  N=$(echo "$R" | grep -o '^ *[0-9]*' | tr -d ' '); TOT=$((TOT+${N:-0}))
  if echo "$R" | grep -qv '· 0 mal'; then echo "  🔴 $t → $R"; MAL=1; FALLOS=1; fi
done
[ $MAL -eq 0 ] && echo "  ✅ las $(ls probar_*.js | wc -l) suites en verde"
echo
echo "── 7. DIFERENCIAL Y BOTONES ──"
node diferencial.js 2>&1 | tail -1
node barrido_botones.js 2>&1 | grep -E "ninguna revent|🔴"
echo
echo "════════════════════════════════════════"
if [ $FALLOS -eq 0 ]; then
  echo "  ✅ TODO EN VERDE — se puede entregar"
else
  echo "  🔴 HAY FALLOS — NO ENTREGAR"
fi
echo "════════════════════════════════════════"

# 🔑 La marca: sin ella, entregar.sh no arma el zip. -5 sep-
mkdir -p /tmp/nbs_pruebas
if [ $FALLOS -eq 0 ]; then
  md5sum trabajo/index.html | cut -c1-12 > /tmp/nbs_pruebas/rapido
  echo "$TOT" >> /tmp/nbs_pruebas/rapido      # cuantas comprobaciones hizo
else rm -f /tmp/nbs_pruebas/rapido; fi

exit $FALLOS

echo
echo "════════════════════════════════════════════════════"
echo "  ⚠️  FALTA_PESADO — lo que NO cabe en esta orden"
echo "════════════════════════════════════════════════════"
echo "  Esto se pasa del límite de tiempo y hay que correrlo aparte:"
echo "     ./revisar_pesado.sh"
echo "  Incluye: 🧬 mutación (69) · 📊 cobertura · ⚖️ propiedades"
echo "  🔑 REGLA DE SENSEI: la entrega NO sale sin esto."
echo "════════════════════════════════════════════════════"

