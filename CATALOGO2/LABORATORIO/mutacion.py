# -*- coding: utf-8 -*-
"""
🧬 PRUEBA DE MUTACIÓN — NBS 2

Sensei, 30 ago: "creo que después de esas dos pruebas encontraste dos pruebas más
fuertes aún... ve a ver si no estoy equivocado". NO estaba equivocado: en agosto
llegó a 61 mutaciones, 61 cazadas. Se habían perdido. Esta las reconstruye.

🔑 QUÉ HACE, Y POR QUÉ ES LA MÁS IMPORTANTE DE TODAS:

Las pruebas normales dicen "todo bien". Pero ¿y si están mal escritas y dirían
"todo bien" pase lo que pase? Entonces no protegen nada.

Esta rompe la app A PROPÓSITO —de una forma concreta y realista cada vez— y
comprueba que las pruebas LO CACEN. Si rompo el cálculo del dinero y las pruebas
siguen en verde, esas pruebas NO SIRVEN y hay que arreglarlas.

Es la única prueba que comprueba las OTRAS pruebas.

    python3 mutacion.py            → todas
    python3 mutacion.py dinero     → solo las del dinero
    python3 mutacion.py --lista    → ver cuáles hay sin correrlas
"""
import io, os, re, subprocess, sys, shutil, time

BASE = '/home/claude/laboratorio/BASE.html'
VIVO = '/home/claude/trabajo/index.html'
LAB = '/home/claude/laboratorio'

# ═══════════════════════════════════════════════════════════════
#  LAS MUTACIONES
#  Cada una: un nombre en cristiano, el texto viejo, el nuevo,
#  y con qué prueba se debería cazar.
# ═══════════════════════════════════════════════════════════════
MUTACIONES = [

    # ── EL DINERO — el corazón ──
    dict(area='dinero', n='El cobrado y lo que debe salen al revés',
         v="return { cobrado: r2(pg), debe: falta2 > 0.005 ? falta2 : 0 };",
         m="return { cobrado: r2(t - pg), debe: r2(pg) };",
         caza=['auditoria_dinero.js', 'contabilidad_paralela.js']),

    dict(area='dinero', n='La deuda no resta los pagos',
         v="var falta2 = r2(t - pg);",
         m="var falta2 = r2(t);",
         caza=['auditoria_dinero.js', 'contabilidad_paralela.js']),

    dict(area='dinero', n='Vuelve el fallo de la coma de miles',
         v="var t = (typeof dinero === 'function') ? dinero(v && v.total) : (parseFloat((v && v.total) || 0) || 0);",
         m="var t = parseFloat((v && v.total) || 0) || 0;",
         caza=['fuzzing_dinero.js']),

    # ⚠️ Aquí hay DEFENSA EN PROFUNDIDAD: dos redes distintas paran la deuda negativa
    # (el total negativo se pone a 0, y el `debe` nunca baja de 0). Quitar UNA sola es
    # un no-op y no se puede cazar — eso NO es un hueco, es que está bien hecho.
    # Esta mutación quita LAS DOS a la vez, que sí es cazable.
    dict(area='dinero', n='Se caen LAS DOS redes de la deuda negativa',
         v="""  var falta2 = r2(t - pg);
  return { cobrado: r2(pg), debe: falta2 > 0.005 ? falta2 : 0 };""",
         m="""  return { cobrado: r2(pg), debe: r2(t - pg) };""",
         extra=[("if(!isFinite(t) || t < 0) t = 0;          // una factura negativa no existe",
                 "if(!isFinite(t)) t = 0;")],
         caza=['fuzzing_dinero.js']),

    dict(area='dinero', n='La lista de pagos rota vuelve a reventar',
         v="if(!Array.isArray(pagos)) pagos = [];",
         m="",
         caza=['fuzzing_dinero.js']),

    dict(area='dinero', n='Los pagos negativos vuelven a contarse',
         v="if(!isFinite(m) || m < 0) return;        // un pago negativo no se cuenta",
         m="if(!isFinite(m)) return;",
         caza=['fuzzing_dinero.js']),

    dict(area='dinero', n='Una devolución cuenta como pago',
         v='  pagos.forEach(function(p){\n    if(!p || p.esDevolucion) return;',
         m='  pagos.forEach(function(p){\n    if(!p) return;',
         caza=['auditoria_dinero.js']),

    dict(area='dinero', n='Los centavos se pierden al redondear',
         v="var r2 = function(x){ return Math.round(x * 100) / 100; };",
         m="var r2 = function(x){ return Math.round(x); };",
         caza=['auditoria_dinero.js', 'contabilidad_paralela.js']),

    dict(area='dinero', n='Una factura de contado se da por pagada aunque la tocaran',
         v="var tocada = !!(v.modificada || v.ajustadaPorDevolucion || pagos.length);",
         m="var tocada = false;",
         caza=['probar_saldo_facturas.js', 'auditoria_dinero.js']),

    # ── EL ESTADO DE CUENTA ──
    dict(area='estado', n='El pago repartido se ve otra vez partido',
         v="var clave = p.recibo ? ('R:' + p.recibo) : ('F:' + (p.fecha || '?') + '|' + (p.metodo || ''));",
         m="var clave = 'X:' + Math.random();",
         caza=['probar_estado_cuenta.js']),

    # ⚠️ OTRA DEFENSA EN PROFUNDIDAD: si el montoCobro guardado se pierde, hay una red
    # que lo recalcula sumando las partes -y da lo mismo-. Quitar solo una es un no-op.
    # Esta quita LAS DOS, que sí cambia el resultado. -30 ago-
    dict(area='estado', n='Se caen LAS DOS redes del monto del cobro',
         v="montoCobro: (typeof p.montoCobro === 'number') ? p.montoCobro : 0,",
         m="montoCobro: 0,",
         extra=[("    if(!g.montoCobro) g.montoCobro = g.suma;", "")],
         caza=['probar_estado_cuenta.js']),

    dict(area='estado', n='Todas las partes del cobro llevan recibo distinto',
         v="var _recibo = nuevoNumeroRecibo();",
         m="var _recibo = null;",
         caza=['probar_estado_cuenta.js']),

    # ── CUENTAS POR COBRAR ──
    dict(area='cobrar', n='Las facturas vuelven a salir de la más nueva a la más vieja',
         v="""  _conSaldoCxC.sort(function(a, b){
    var fa = parsearFechaVenta(a.fecha), fb = parsearFechaVenta(b.fecha);
    return (fa ? fa.getTime() : 0) - (fb ? fb.getTime() : 0);
  });""",
         m="""  _conSaldoCxC.sort(function(a, b){
    var fa = parsearFechaVenta(a.fecha), fb = parsearFechaVenta(b.fecha);
    return (fb ? fb.getTime() : 0) - (fa ? fa.getTime() : 0);
  });""",
         caza=['probar_cxc.js']),

    dict(area='cobrar', n='Las facturas ya pagadas vuelven a salir abiertas',
         v="if(!v.cancelada && esSaldoPendiente(sal)) _conSaldoCxC.push(v);",
         m="_conSaldoCxC.push(v);",
         caza=['probar_cxc.js']),

    # ── EL BOTÓN ATRÁS ──
    dict(area='atras', n='El letrero de salir vuelve a desarmar la protección',
         v="logAtras('LETRERO: se queda con ' + profundidadGuardian() + ' guardianes. Atras no hace nada.');",
         m="var _p = profundidadGuardian(); if(_p > 0){ _saliendoApp = true; try{ history.go(-_p); }catch(e){} }",
         caza=['probar_boton_atras.js']),

    dict(area='atras', n='El atras deja de reponer el paso',
         v="  ponerGuardianAtras(true);",
         m="  // sin reponer",
         caza=['probar_boton_atras.js']),

    dict(area='atras', n='Salir vuelve al salto gigante que Chrome descarta',
         v="    try { history.back(); } catch(e){}",
         m="    try { history.go(-(profundidadGuardian()+1)); } catch(e){}",
         caza=['probar_boton_atras.js']),

    dict(area='atras', n='El paso no se pone al arrancar',
         v="    if(!forzar && history.state && history.state.nbs) return;",
         m="    return;",
         caza=['probar_boton_atras.js']),

    # ── LA CONFIRMACIÓN FIRMADA ──
    dict(area='firma', n='Se guarda la confirmación SIN firma',
         v="""  if(!_firmaHayTrazo){
    alert('Falta la firma del cliente.\\n\\nQue firme con el dedo en el recuadro, o toca "Ahora no".');
    return;
  }""",
         m="",
         caza=['probar_confirmar_balance.js']),

    dict(area='firma', n='A un cliente sin deuda se le pide confirmar',
         v="  if(debe <= 0.005) return false;            // sin deuda no hay nada que confirmar",
         m="",
         caza=['probar_confirmar_balance.js']),

    dict(area='firma', n='Si el balance cambia, ya no hace falta volver a confirmar',
         v="return Math.abs((u.balance || 0) - debe) > 0.005;",
         m="return false;",
         caza=['probar_confirmar_balance.js']),

    # ── WHATSAPP ──
    dict(area='whatsapp', n='Vuelve a abrir el WhatsApp normal, no el Business',
         v="var cual = LS('nbs_whatsapp_app', WA_NEGOCIO);",
         m="var cual = 'com.whatsapp';",
         caza=['probar_whatsapp.js']),

    dict(area='whatsapp', n='El enlace pierde el camino de respaldo',
         v="    + ';S.browser_fallback_url=' + encodeURIComponent('https://wa.me/' + num) + ';end';",
         m="    + ';end';",
         caza=['probar_whatsapp.js']),

    dict(area='whatsapp', n='El mensaje ya no lleva el texto',
         v="    + (t ? '&text=' + encodeURIComponent(t) : '')",
         m="",
         caza=['probar_whatsapp.js', 'probar_mandar_balance.js']),

    # ── LA BÚSQUEDA ──
    dict(area='buscar', n='Dos palabras vuelven a buscar por separado',
         v="    if(_exactos.length) conPuntaje = _exactos;",
         m="",
         caza=['probar_busqueda_frase.js', 'probar_busqueda_todas.js']),

    # ── EL VIGILANTE ──
    dict(area='vigilante', n='Ya no avisa de un pago mayor que su factura',
         v="        if(pagado > total + 0.05){",
         m="        if(false){",
         caza=['probar_vigilante.js']),

    dict(area='vigilante', n='Ya no avisa de productos sin precio',
         v="      if(sinPrecio.length){",
         m="      if(false){",
         caza=['probar_vigilante.js']),

    # ── LAS FIRMAS A LA NUBE ──
    dict(area='nube', n='Las ventas vuelven a subir con las firmas dentro',
         v="        docPend.valor = JSON.stringify(quitarFirmas(vv));",
         m="        docPend.valor = JSON.stringify(vv);",
         caza=['probar_firmas_aparte.js']),

    dict(area='nube', n='Al bajar de la nube se pierden las firmas',
         v="            var vtas = pegarFirmasQueYaTengo(JSON.parse(_valorDelDoc));",
         m="            var vtas = JSON.parse(_valorDelDoc);",
         caza=['probar_firmas_aparte.js']),

    dict(area='nube', n='Lo que no cabe se vuelve a mandar crudo',
         v="      if(docPend.valor.length > TOPE_NUBE){",
         m="      if(false){",
         caza=['probar_subida_nube.js']),

    # ── EL CIERRE DE RUTA ──
    dict(area='ruta', n='El cierre de ruta TOCA el inventario',
         v="  if(!SS('ncierres_ruta', cierres)){ return; }   // SS ya avisa si no cupo",
         m="  if(!SS('ncierres_ruta', cierres)){ return; }\n  try { var _ps = LS('np', []); _ps.forEach(function(p){ p.stock = 0; }); SS('np', _ps); } catch(e){}",
         caza=['probar_cierre_ruta.js']),

    dict(area='ruta', n='No dice cuánto vale lo que falta',
         v="if(dif < 0){ faltan += -dif; valorFaltante += (-dif) * costo; }",
         m="if(dif < 0){ faltan += -dif; }",
         caza=['probar_cierre_ruta.js']),

    # ── LAS FECHAS ELEGIBLES (2 sep) ──
    dict(area='fechas', n='La COMPRA vuelve a ponerse con la fecha de hoy',
         v="fecha: fechaDelCampo('cc-fecha'),   // \U0001f4c5 la que el escogio -2 sep-",
         m="fecha: fechaHoy(),",
         caza=['probar_fechas.js']),

    dict(area='fechas', n='El COBRO al cliente vuelve a la fecha de hoy',
         v="  var fechaPago = fechaDelCampo('cxc-fecha-' + vid);   // \U0001f4c5 la que el escogio -2 sep-",
         m="  var fechaPago = fechaHoy();",
         caza=['probar_fechas.js']),

    dict(area='fechas', n='El CIERRE DE RUTA vuelve a la fecha de hoy',
         v="fecha: fechaDelCampo('cr-fecha'),   // \U0001f4c5 la que el escogio -2 sep-",
         m="fecha: fechaHoy(),",
         caza=['probar_fechas.js']),

    dict(area='fechas', n='Una fecha invalida ya no cae en HOY',
         v="    if(!a || !m || !d || m < 1 || m > 12 || d < 1 || d > 31) return fechaHoy();",
         m="",
         caza=['probar_fechas.js']),

    dict(area='fechas', n='Los campos ya no vienen con la fecha de hoy puesta',
         v="    el.value = d.getFullYear() + '-' + (mm < 10 ? '0' : '') + mm + '-' + (dd < 10 ? '0' : '') + dd;",
         m="    el.value = '';",
         caza=['probar_fechas.js']),

    dict(area='fechas', n='La fecha del PDF ya no se lee',
         v="    var _f = fechaDeLaFactura(textoCompleto);",
         m="      var _f = null;",
         caza=['probar_fechas.js']),

    # ⚠️ DEFENSA EN PROFUNDIDAD: new Date() ya rechaza sola el mes 13, asi que quitar
    # solo la comprobacion es un no-op. Esta quita LAS DOS redes.
    dict(area='fechas', n='Se caen LAS DOS redes de la fecha imposible',
         v="  if(m < 1 || m > 12 || d < 1 || d > 31) return false;",
         m="",
         extra=[("  if(isNaN(f.getTime())) return false;", ""),
                ("  if(f.getDate() !== d || (f.getMonth() + 1) !== m || f.getFullYear() !== a) return false;", "")],
         caza=['probar_fechas.js']),

    # ── LAS CUATRO FORMAS DE MANDAR (3 sep) ──
    dict(area='mandar', n='Vuelve el enlace con el texto triplicado',
         v="    + ';S.browser_fallback_url=' + encodeURIComponent('https://wa.me/' + num) + ';end';",
         m="    + (t ? ';S.text=' + encodeURIComponent(t) : '')\n    + ';S.browser_fallback_url=' + encodeURIComponent(normal) + ';end';",
         caza=['probar_mandar_balance.js', 'probar_whatsapp.js']),

    dict(area='mandar', n='Ya no se ofrecen las cuatro formas: va directo a WhatsApp',
         v="  try { comoMandarloAlCliente(cid, texto, queEs); return; } catch(e){}",
         m="",
         caza=['probar_mandar_balance.js']),

    dict(area='mandar', n='El mensaje ya no se copia antes de mandarlo',
         v="  _copiarTexto(texto);                    // \U0001f6e1\ufe0f por si el enlace falla, ya lo tiene",
         m="",
         caza=['probar_mandar_balance.js']),

    dict(area='mandar', n='El SMS no lleva el mensaje escrito',
         v="    window.location.href = 'sms:+' + tel + sep + 'body=' + encodeURIComponent(String(texto || ''));",
         m="    window.location.href = 'sms:+' + tel;",
         caza=['probar_mandar_balance.js']),

    dict(area='mandar', n='El balance del mensaje sale mal',
         v="    t.push('Su balance pendiente es de $' + fmtNum(debe) + '.');",
         m="    t.push('Su balance pendiente es de $0.00.');",
         caza=['probar_mandar_balance.js']),

    dict(area='mandar', n='Vuelve el "Pago de hoy" aunque el pago sea viejo',
         v="    t.push('Su \\u00faltimo pago: $' + fmtNum(_pg.monto));",
         m="    t.push('Pago de hoy: $' + fmtNum(_pg.monto));",
         caza=['probar_mandar_balance.js']),

    dict(area='mandar', n='El mensaje ya no dice de que dia fue el pago',
         v="    if(_pg.fecha) t.push('del ' + _pg.fecha);",
         m="",
         caza=['probar_mandar_balance.js']),

    dict(area='mandar', n='Se nombra un pago viejo cuando acaban de cobrar',
         v="""  if(_montoDado){
    // Le acaban de cobrar: se habla en presente, con el monto de ese cobro.
    t.push('Recib\\u00ed su pago de $' + fmtNum(_montoDado));
    t.push('');
  } else if(_pg && _pagoEsDeHoy(_pg.fecha)){""",
         m="""  if(false){
    t.push('Recib\\u00ed su pago de $' + fmtNum(_montoDado));
    t.push('');
  } else if(_pg && _pagoEsDeHoy(_pg.fecha)){""",
         caza=['probar_mandar_balance.js']),

    dict(area='mandar', n='Una devolucion se toma como el ultimo pago',
         v="      if(!p || p.esDevolucion) return;\n      var m = (typeof dinero === 'function') ? dinero(p.monto) : (parseFloat(p.monto) || 0);\n      if(!isFinite(m) || m <= 0.005) return;",
         m="      if(!p) return;\n      var m = (typeof dinero === 'function') ? dinero(p.monto) : (parseFloat(p.monto) || 0);\n      if(!isFinite(m) || m <= 0.005) return;",
         caza=['probar_mandar_balance.js']),

    # ── EL PROGRAMA VIP (3 sep) ──
    dict(area='vip', n='Los shaving gel vuelven a dar puntos',
         v="  if(/shaving\\s*(gel|cream|foam)|shave\\s*gel|squeeze\\s*shave/.test(n)) return null;",
         m="",
         caza=['probar_vip.js']),

    # ⚠️ Con defensa en profundidad: el filtro de arriba Y el "todo lo demás no cuenta"
    # del final. Quitar uno solo no cambia nada, así que se quitan LOS DOS.
    dict(area='vip', n='Lo que no se reconoce vuelve a contar',
         v="  if(/hair\\s*spray|styling\\s*powder|\\bmousse\\b|shampoo|oil\\s*sheen|\\btinte\\b|tintation/.test(n)) return null;",
         m="",
         extra=[("  //    mencionado va\".\n  return null;", "  //    mencionado va\".\n  return 'OTROS';")],
         caza=['probar_vip.js']),

    dict(area='vip', n='Las herramientas vuelven a contar',
         v="  if(/neck\\s*duster|hand\\s*mirror|cepillo|brocha|sprayer|clipper\\s*spray|blade\\s*care|cool\\s*care|\\btalco\\b|peine|comb|guide/.test(n)) return null;",
         m="  if(/xxxxnoexistexxxx/.test(n)) return null;",
         extra=[("  if(/\\bwax\\b|\\bcera\\b|matte\\s*clay|\\bpaste\\b|pomade|pomada|\\bcream\\b|\\bcrema\\b/.test(n)) return 'WAX/CREAM';",
                 "  if(/\\bwax\\b|\\bcera\\b|matte\\s*clay|\\bpaste\\b|pomade|pomada|\\bcream\\b|\\bcrema\\b|cepillo|brocha|duster|mirror/.test(n)) return 'WAX/CREAM';")],
         caza=['probar_vip.js']),

    dict(area='vip', n='Los grupos dejan de separarse por marca',
         v="    clave: cat + '|' + marca,",
         m="    clave: cat,",
         caza=['probar_vip.js']),

    dict(area='vip', n='Vuelve a contar lo de antes de junio',
         v="""    var f = parsearFechaVenta(v.fecha);
    return f ? (f >= VIP_DESDE) : false;""",
         m="""    return true;""",
         caza=['probar_vip.js']),

    dict(area='vip', n='Las navajas de $5 dan un punto por unidad',
         v="    var puntos = p.mitad ? Math.floor(p.unidades / 2) : p.unidades;",
         m="    var puntos = p.unidades;",
         caza=['probar_vip.js']),

    dict(area='vip', n='Los ajustes a mano dejan de aplicarse',
         v="      puntos = Math.max(0, puntos + (_aj.diferencia || 0));",
         m="",
         caza=['probar_vip.js']),

    dict(area='vip', n='Un producto de $5 que no es navaja cuenta',
         v="  var esNavaja = (/navaja|blade/.test(n)) && !/blade\\s*care/.test(n);",
         m="  var esNavaja = true;",
         caza=['probar_vip.js']),

    dict(area='vip', n='El aviso del premio se puede archivar',
         v="  if(a && a.noSeArchiva) return false;",
         m="",
         caza=['probar_vip.js']),

    dict(area='vip', n='La fanfarria suena cada vez, no una sola',
         v="      if(sonados[huella]) return;",
         m="",
         caza=['probar_vip.js']),

    dict(area='vip', n='Suena antes de llegar a los 10 puntos',
         v="      if(!g || g.gratis <= 0) return;",
         m="      if(!g) return;",
         caza=['probar_vip.js']),

    dict(area='vip', n='El aviso del premio deja de salir primero',
         v="      avisos.push({\n        nivel: 'rojo', clave: 'premiosVIP', icono: '\\ud83c\\udf81',",
         m="      avisos.push({\n        nivel: 'rojo', clave: 'premiosVIP_x', icono: '\\ud83c\\udf81',",
         caza=['probar_vip.js']),

    dict(area='vip', n='El lapiz desaparece del Programa VIP',
         v="            +" + chr(39) + "<button onclick=" + chr(34) + "abrirAjustePuntosVIP(" + chr(39) + " + _arg(String(c.id)) + " + chr(39) + ",",
         m="            +" + chr(39) + "<span style=" + chr(34) + "display:none" + chr(34) + " data-x=" + chr(34) + "" + chr(39) + " + _arg(String(c.id)) + " + chr(39) + ",",
         caza=['probar_vip.js']),

    dict(area='vip', n='Los textos vuelven a decir "mismo producto"',
         v='10 de la misma MARCA y el mismo TIPO',
         m='10 compras del mismo producto',
         caza=['probar_vip.js']),

    # ── EL CREDITO A FAVOR (4 sep) ──
    dict(area='credito', n='El pago del credito vuelve a ir sin pid',
         v="      vv.pagosFactura.push({ pid: nuevoPagoId(), monto: t.monto,",
         m="      vv.pagosFactura.push({ monto: t.monto,",
         caza=['probar_credito.js']),

    dict(area='credito', n='Ya no se enseña donde se aplico el credito',
         v="    mostrarCreditoAplicado(cid, usado, queda, tocadas, deudaAntes, deudaDespues);",
         m="",
         caza=['probar_credito.js']),

    dict(area='credito', n='Vuelve a sacarte de la pantalla',
         v="      try { verCl(cid); } catch(e){}",
         m="      try { renderCxC(''); } catch(e){}",
         caza=['probar_credito.js']),

    dict(area='credito', n='El credito se aplica a facturas ya pagadas',
         v="    var debe = cobradoYDebeDe(v).debe;\n    if(debe <= 0.005) return;",
         m="    var debe = parseFloat(v.total) || 0;",
         caza=['probar_credito.js']),

    dict(area='mandar', n='El recuadro vuelve a salir DETRAS del estado de cuenta',
         v="background:rgba(0,0,0,.62);z-index:100001;'",
         m="background:rgba(0,0,0,.62);z-index:99999;'",
         caza=['probar_mandar_balance.js']),

    dict(area='mandar', n='Vuelve el confirm que bloqueaba el boton',
         v="  mandarloAlCliente(cid, texto, 'Mensaje corto');",
         m="  if(!confirm('Se le va a mandar esto')) return;\n  mandarloAlCliente(cid, texto, 'Mensaje corto');",
         caza=['probar_mandar_balance.js']),

    dict(area='dinero', n='El sobrante al bajar el total se pierde otra vez',
         v="  if(_pagado > totalDespues + 0.005){",
         m="  if(false){",
         caza=['probar_propiedades.js']),

    dict(area='dinero', n='El numero de recibo vuelve a poder repetirse',
         v="  _contadorRecibo++;\n  // El contador NO da la vuelta",
         m="  var sufijo = Math.floor(Math.random() * 90 + 10);\n  // borrado",
         caza=['probar_propiedades.js']),

    # ── EL HTML ──
    dict(area='html', n='Se pierde un cierre de etiqueta',
         v="</div><!-- cierra salir-box.",
         m="<!-- cierra salir-box.",
         caza=['guardian_html.py']),
]


def correr(cmd, seg=180):
    try:
        r = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=seg)
        return r.returncode, (r.stdout or '') + (r.stderr or '')
    except subprocess.TimeoutExpired:
        return 99, '(se pasó del tiempo)'


def aplicar(mut):
    """Mete la mutación en el archivo vivo. Devuelve True si se pudo.

    Algunas mutaciones necesitan tocar VARIOS sitios a la vez — cuando hay defensa
    en profundidad y quitar una sola red no cambia nada. Eso va en 'extra'.
    """
    s = io.open(BASE, encoding='utf-8').read()
    if s.count(mut['v']) != 1:
        return False, s.count(mut['v'])
    s = s.replace(mut['v'], mut['m'])
    for ve, me in mut.get('extra', []):
        if s.count(ve) != 1:
            return False, s.count(ve)
        s = s.replace(ve, me)
    io.open(VIVO, 'w', encoding='utf-8').write(s)
    return True, 1


def restaurar():
    shutil.copy(BASE, VIVO)


def main():
    filtro = None
    if len(sys.argv) > 1 and sys.argv[1] != '--lista':
        filtro = sys.argv[1]

    muts = [m for m in MUTACIONES if not filtro or m['area'] == filtro]

    if len(sys.argv) > 1 and sys.argv[1] == '--lista':
        print('LAS MUTACIONES QUE HAY (' + str(len(MUTACIONES)) + '):')
        area = None
        for m in MUTACIONES:
            if m['area'] != area:
                area = m['area']
                print('\n  ── ' + area.upper() + ' ──')
            print('     · ' + m['n'])
        return 0

    print('')
    print('════════════════════════════════════════════════════')
    print('  🧬 PRUEBA DE MUTACIÓN')
    print('  Rompe la app a propósito y comprueba que se cace')
    print('════════════════════════════════════════════════════')
    print('')
    print('  ' + str(len(muts)) + ' mutaciones' + (' del área "' + filtro + '"' if filtro else ''))
    print('')

    cazadas, escapadas, noAplican = 0, [], []
    t0 = time.time()

    for i, mut in enumerate(muts, 1):
        ok, veces = aplicar(mut)
        if not ok:
            noAplican.append((mut['n'], veces))
            print('  ⚠️  ' + str(i).rjust(2) + '. ' + mut['n'][:52].ljust(54)
                  + ' NO APLICA (el texto sale ' + str(veces) + ' veces)')
            continue

        # ¿La caza alguna de sus pruebas?
        cazada, quien = False, None
        for prueba in mut['caza']:
            if prueba.endswith('.py'):
                cod, _ = correr('cd /home/claude && python3 ' + prueba + ' trabajo/index.html', 60)
            else:
                cod, _ = correr('cd /home/claude && node ' + prueba, 180)
            if cod != 0:
                cazada, quien = True, prueba
                break

        restaurar()

        if cazada:
            cazadas += 1
            print('  ✅ ' + str(i).rjust(2) + '. ' + mut['n'][:52].ljust(54) + ' cazada por ' + quien)
        else:
            escapadas.append(mut)
            print('  🔴 ' + str(i).rjust(2) + '. ' + mut['n'][:52].ljust(54) + ' SE ESCAPÓ')

    restaurar()
    aplicadas = len(muts) - len(noAplican)
    pct = round(cazadas / aplicadas * 100) if aplicadas else 0

    print('')
    print('════════════════════════════════════════════════════')
    print('  ' + str(cazadas) + ' de ' + str(aplicadas) + ' cazadas  ·  ' + str(pct) + '%')
    if noAplican:
        print('  ' + str(len(noAplican)) + ' no se pudieron aplicar (el código cambió)')
    print('  tardó ' + str(round(time.time() - t0)) + ' segundos')
    print('')
    if escapadas:
        print('  🔴 LAS QUE SE ESCAPARON — hay que escribir la prueba que falta:')
        for m in escapadas:
            print('     · ' + m['n'])
            print('       debería cazarla: ' + ', '.join(m['caza']))
    else:
        print('  ✅ NINGUNA SE ESCAPÓ')
        print('     Las pruebas de verdad protegen lo que dicen proteger.')
    print('════════════════════════════════════════════════════')
    return 1 if escapadas else 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    finally:
        restaurar()
