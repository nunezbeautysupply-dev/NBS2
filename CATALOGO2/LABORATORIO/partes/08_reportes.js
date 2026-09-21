
function compartirManualCompleto(){
  var partes = [];
  var grupoAnt = null;
  MANUAL_SECCIONES.forEach(function(s){
    if(s.g && s.g !== grupoAnt){
      grupoAnt = s.g;
      partes.push('<h2 style="page-break-before:auto;background:#1a237e;color:#fff;padding:8px 12px;'
        + 'border-radius:6px;font-size:15px;margin:22px 0 10px">' + escaparHtml(s.g) + '</h2>');
    }
    partes.push('<h3 style="font-size:14px;color:#1a237e;margin:14px 0 6px;'
      + 'border-bottom:1px solid #ddd;padding-bottom:3px">' + escaparHtml(s.t) + '</h3>');
    s.c.forEach(function(linea){ partes.push(pintarLineaManual(linea)); });
  });

  var estilos = '@page { size: letter; margin: 14mm; }'
    + '* { box-sizing:border-box }'
    + 'body { font-family:-apple-system,Arial,sans-serif; color:#222; margin:0; font-size:12px }'
    + 'pre { background:#f4f4f8 !important; color:#222 !important; border:1px solid #ddd; '
    + '      font-size:9.5px !important; page-break-inside:avoid }'
    + 'h3 { page-break-after:avoid }';

  var hoy = new Date().toLocaleDateString('es-US');
  var html = '<style>' + estilos + '</style>'
    + '<div style="text-align:center;border-bottom:2px solid #D4A017;padding-bottom:8px;margin-bottom:16px">'
    + '<h1 style="font-size:22px;color:#1a237e;margin:0 0 3px">Manual de Usuario \u2014 NBS 2</h1>'
    + '<p style="font-size:11px;color:#666;margin:0">Nunez Beauty Supply \u00b7 ' + MANUAL_SECCIONES.length
    + ' temas \u00b7 ' + hoy + '</p></div>'
    + partes.join('');

  var vent = window.open('', '_blank');
  if(!vent){ avisoGrande('Permite las ventanas emergentes para poder imprimir o guardar el manual.'); return; }
  vent.document.write('<html><head><meta charset="utf-8"><title>Manual NBS 2</title></head><body>' + html + '</body></html>');
  vent.document.close();
  setTimeout(function(){ try{ vent.focus(); vent.print(); }catch(e){} }, 500);
}

function pintarLineaManual(linea){
  var t = String(linea);

  // "## TÍTULO" -> subtítulo dentro del tema
  if(t.indexOf('## ') === 0){
    return '<div style="font-size:11px;font-weight:900;color:var(--nbs-gold);letter-spacing:.7px;'
         + 'margin:14px 0 6px;padding-bottom:3px;border-bottom:1.5px solid #f0ebe0">'
         + escaparHtml(t.slice(3)) + '</div>';
  }

  // "[[ dibujo ]]" -> recuadro con letra de máquina, para los dibujos
  if(t.indexOf('[[') === 0){
    var dib = t.replace(/^\[\[\s?/, '').replace(/\s?\]\]$/, '');
    return '<pre style="background:#0f1424;color:#d7e3ff;border-radius:10px;padding:11px 12px;'
         + 'margin:8px 0;font-size:11px;line-height:1.5;overflow-x:auto;white-space:pre;'
         + 'font-family:ui-monospace,Menlo,Consolas,monospace">' + escaparHtml(dib) + '</pre>';
  }

  // "!! aviso" -> recuadro ámbar
  if(t.indexOf('!!') === 0){
    return '<div style="background:#FFF8E1;border-left:4px solid #F9A825;border-radius:8px;'
         + 'padding:10px 11px;margin:10px 0;font-size:12.5px;color:#6D4C00;line-height:1.5">'
         + '<b>⚠️ OJO — </b>' + escaparHtml(t.slice(2).trim()) + '</div>';
  }

  // "> ruta del menú" -> en verde, para saber dónde tocar
  if(t.indexOf('> ') === 0){
    return '<div style="background:#E8F5E9;border-radius:8px;padding:8px 10px;margin:6px 0;'
         + 'font-size:12px;font-weight:700;color:#1B5E20;line-height:1.4">📍 '
         + escaparHtml(t.slice(2)) + '</div>';
  }

  // "1. paso" -> paso numerado, con el número en círculo
  var mp = t.match(/^(\d+)\.\s(.*)$/);
  if(mp){
    return '<div style="display:flex;gap:9px;align-items:flex-start;margin:5px 0">'
         + '<span style="flex-shrink:0;width:20px;height:20px;border-radius:50%;background:#1a237e;'
         + 'color:#fff;font-size:11px;font-weight:800;display:flex;align-items:center;'
         + 'justify-content:center;margin-top:1px">' + mp[1] + '</span>'
         + '<span style="flex:1;font-size:13px;color:var(--nbs-ink);line-height:1.5">'
         + escaparHtml(mp[2]) + '</span></div>';
  }

  // Lo demás: párrafo normal
  return '<p style="font-size:13px;color:var(--nbs-ink);line-height:1.55;margin:0 0 7px">'
       + escaparHtml(t) + '</p>';
}

function renderManual(q){
  var el = document.getElementById('manual-contenido');
  var ql = (q||'').toLowerCase().trim();
  var secciones = MANUAL_SECCIONES;
  if(ql){
    secciones = MANUAL_SECCIONES.filter(function(s){
      return s.t.toLowerCase().indexOf(ql) > -1 || s.c.some(function(linea){ return linea.toLowerCase().indexOf(ql) > -1; });
    });
  }
  if(!secciones.length){
    el.innerHTML = '<p style="text-align:center;color:var(--nbs-muted);padding:20px">No se encontró nada con esa palabra.</p>';
    return;
  }
  // Un rotulo grande cada vez que cambia de grupo, con los mismos nombres del menu
  var ICONO_GRUPO = { 'VENDER':'\ud83d\uded2', 'DINERO':'\ud83d\udcb0', 'REPORTES':'\ud83d\udcca',
                      'MERCANC\u00cdA':'\ud83d\udce6', 'SEGURIDAD':'\ud83d\udee1\ufe0f',
                      'HERRAMIENTAS':'\u2699\ufe0f' };

  // \ud83d\udd04 SE ORDENAN POR GRUPO ANTES DE PINTAR -30 ago-. El rotulo grande solo sale
  // cuando el grupo CAMBIA, asi que si las secciones vienen mezcladas salen rotulos
  // repetidos -paso al meter las secciones nuevas-. Ordenando, cada uno sale UNA vez.
  var ORDEN_GRUPOS = ['INFORMES', 'VENDER', 'DINERO', 'REPORTES', 'MERCANC\u00cdA', 'SEGURIDAD', 'HERRAMIENTAS'];
  secciones = secciones.slice().sort(function(a, b){
    var ia = ORDEN_GRUPOS.indexOf(a.g), ib = ORDEN_GRUPOS.indexOf(b.g);
    if(ia < 0) ia = 99;
    if(ib < 0) ib = 99;
    if(ia !== ib) return ia - ib;
    // Dentro del grupo, se respeta el orden en que estan escritas
    return MANUAL_SECCIONES.indexOf(a) - MANUAL_SECCIONES.indexOf(b);
  });
  var grupoAnterior = null;
  el.innerHTML = secciones.map(function(s, idx){
    var rotulo = '';
    if(s.g && s.g !== grupoAnterior){
      grupoAnterior = s.g;
      rotulo = '<div style="display:flex;align-items:center;gap:8px;margin:16px 0 8px;padding:9px 11px;'
             + 'background:#1a237e;border-radius:9px">'
             + '<span style="font-size:17px">' + (ICONO_GRUPO[s.g] || '\u2022') + '</span>'
             + '<span style="flex:1;font-size:14px;font-weight:900;color:#fff;letter-spacing:.6px">'
             + escaparHtml(s.g) + '</span></div>';
    }
    return rotulo + '<div class="card" style="border:0.5px solid var(--nbs-line);box-shadow:var(--nbs-shadow-card);padding:0;overflow:hidden">'
      +'<div onclick="toggleManualSeccion('+idx+')" style="padding:14px 16px;cursor:pointer;display:flex;justify-content:space-between;align-items:center">'
      +'<span style="font-size:15px;font-weight:600;color:var(--nbs-ink)">'+s.t+'</span>'
      +'<span id="manual-flecha-'+idx+'" style="font-size:12px;color:var(--nbs-muted)">▼</span>'
      +'</div>'
      +'<div id="manual-cuerpo-'+idx+'" style="display:none;padding:0 16px 16px">'
      +s.c.map(pintarLineaManual).join('')
      +'</div>'
      +'</div>';
  }).join('');
}

function toggleManualSeccion(idx){
  var cuerpo = document.getElementById('manual-cuerpo-'+idx);
  var flecha = document.getElementById('manual-flecha-'+idx);
  var abierto = cuerpo.style.display === 'block';
  cuerpo.style.display = abierto ? 'none' : 'block';
  flecha.textContent = abierto ? '▼' : '▲';
}

// ===== CUENTAS POR PAGAR (suplidores + tarjetas de credito + otras deudas del negocio) =====
function imprimirFichasClientes(){
  clientes = LS('ncl', []);
  if(!clientes.length){ alert('No hay clientes para imprimir.'); return; }
  var balances = calcularBalancesClientes();
  var lista = [].concat(clientes).sort(function(a,b){ return nombreCl(a).localeCompare(nombreCl(b)); });

  var hoy = fechaHoy();
  var html = '<h1>Fichas de Clientes — NBS</h1>'
    +'<p class="sub">'+lista.length+' clientes · Generado el '+hoy+'</p>'
    +'<div class="fichas-grid">';

  lista.forEach(function(c){
    var deuda = balances.total[String(c.id)] || 0;
    var nombre = nombreCl(c) || 'Sin nombre';
    var partes = [];
    if(c.negocio) partes.push('<div class="fila"><span class="et">Negocio:</span> '+escaparHtml(c.negocio)+'</div>');
    if(c.tipoNegocio) partes.push('<div class="fila"><span class="et">Tipo:</span> '+escaparHtml(c.tipoNegocio)+'</div>');
    if(c.tel) partes.push('<div class="fila"><span class="et">Teléfono:</span> '+escaparHtml(c.tel)+'</div>');
    // Dirección armada
    var dir = [c.dir, c.ciudad, c.estado, c.zip].filter(function(x){ return x && x.trim(); }).join(', ');
    if(dir) partes.push('<div class="fila"><span class="et">Dirección:</span> '+escaparHtml(dir)+'</div>');
    // Contacto adicional
    if(c.contacto || c.contactoTel){
      var cont = [c.contacto, c.contactoApodo ? '"'+c.contactoApodo+'"' : '', c.contactoTel].filter(function(x){return x && x.trim();}).join(' · ');
      partes.push('<div class="fila"><span class="et">Contacto:</span> '+escaparHtml(cont)+'</div>');
    }
    var creditoFicha = c.creditoAFavor || 0;
    var deudaHtml = deuda > 0
      ? '<div class="fila"><span class="et">Deuda:</span> <span class="deuda">$'+fmtNum(deuda)+'</span></div>'
        + (creditoFicha > 0.01 ? '<div class="fila"><span class="et">Crédito a favor:</span> <span style="color:#E65100;font-weight:700">($'+fmtNum(creditoFicha)+')</span></div>' : '')
      : ('<div class="fila"><span class="et">Deuda:</span> <span class="aldia">Al día ($0.00)</span></div>'
        + (creditoFicha > 0.01 ? '<div class="fila"><span class="et">Crédito a favor:</span> <span style="color:#E65100;font-weight:700">($'+fmtNum(creditoFicha)+')</span></div>' : ''));
    partes.push(deudaHtml);

    html += '<div class="ficha">'
      +'<div class="nom">'+escaparHtml(nombre)+(c.vipActivo?' <span class="vip">⭐ VIP</span>':'')+'</div>'
      + partes.join('')
      +'</div>';
  });
  html += '</div>'; // cerrar fichas-grid

  abrirVentanaImpresion('Fichas de Clientes NBS', html);
}

// LISTADO 2: tabla resumida (nombre, apodo, teléfono, deuda)
function imprimirListaClientes(){
  clientes = LS('ncl', []);
  if(!clientes.length){ alert('No hay clientes para imprimir.'); return; }
  var balances = calcularBalancesClientes();
  var lista = [].concat(clientes).sort(function(a,b){ return nombreCl(a).localeCompare(nombreCl(b)); });

  var hoy = fechaHoy();
  var totalDeuda = 0;
  var filas = lista.map(function(c){
    var deuda = balances.total[String(c.id)] || 0;
    totalDeuda += deuda;
    var nombre = ((c.nombre||'')+' '+(c.apellido||'')).replace(/\s+/g,' ').trim() || 'Sin nombre';
    var creditoFila = c.creditoAFavor || 0;
    return '<tr>'
      +'<td>'+escaparHtml(nombre)+'</td>'
      +'<td>'+escaparHtml(c.apodo||'—')+'</td>'
      +'<td>'+escaparHtml(c.tel||'—')+'</td>'
      +'<td style="text-align:right">'+(deuda>0?'<span class="deuda">$'+fmtNum(deuda)+'</span>':'—')+'</td>'
      +'<td style="text-align:right">'+(creditoFila>0.01?'<span style="color:#E65100;font-weight:700">($'+fmtNum(creditoFila)+')</span>':'—')+'</td>'
      +'</tr>';
  }).join('');

  var totalCreditoTabla = lista.reduce(function(s,c){ return s+(c.creditoAFavor||0); }, 0);
  var html = '<h1>Lista de Clientes — NBS</h1>'
    +'<p class="sub">'+lista.length+' clientes · Generado el '+hoy+'</p>'
    +'<table>'
    +'<thead><tr><th>Nombre</th><th>Apodo</th><th>Teléfono</th><th style="text-align:right">Debe</th><th style="text-align:right">Crédito a favor</th></tr></thead>'
    +'<tbody>'+filas
    +'<tr class="total-row"><td colspan="3">TOTALES</td><td style="text-align:right">$'+fmtNum(totalDeuda)+'</td><td style="text-align:right">($'+fmtNum(totalCreditoTabla)+')</td></tr>'
    +'</tbody></table>';

  abrirVentanaImpresion('Lista de Clientes NBS', html);
}

// ═══════════════════════════════════════════════════════════════════════════
//  BÚSQUEDA INTELIGENTE  (19 jul 2026, pedido por Sensei)
//  Busca por CUALQUIER PARTE del texto y por palabras sueltas en cualquier orden.
//  - "uan" encuentra "Juan"
//  - "Ad " (con espacio) ignora el espacio y encuentra "Adrian"
//  - "juan perez" encuentra "Perez Juan" (cada palabra por separado, cualquier orden)
//  - ignora acentos: "jose" encuentra "José"
// ═══════════════════════════════════════════════════════════════════════════
function calcularReporteClientes(desde, hasta){
  ventas = LS('nv', []);
  clientes = LS('ncl', []);
  var porCliente = {};
  ventas.forEach(function(v){
    if(v.cancelada || !v.cid) return;
    // Filtro de fechas (25 jul, pedido por Sensei): si desde/hasta vienen, solo cuenta
    // las ventas dentro del rango. Sin fechas, sigue siendo "de siempre" como antes.
    if(desde || hasta){
      var partesFecha = (v.fecha||'').split('/');
      if(partesFecha.length !== 3) return;
      var fechaVenta = new Date(parseInt(partesFecha[2]), parseInt(partesFecha[0])-1, parseInt(partesFecha[1]));
      if(desde && fechaVenta < desde) return;
      if(hasta && fechaVenta > hasta) return;
    }
    var k = String(v.cid);
    if(!porCliente[k]) porCliente[k] = { comprado:0, pagado:0, ganancia:0 };
    porCliente[k].comprado += (v.total||0);
    porCliente[k].ganancia += (v.ganancia||0);
    if(v.tipo === 'contado'){
      porCliente[k].pagado += cobradoYDebeDe(v).cobrado;
    } else {
      var pag = (v.pagosFactura||[]).reduce(function(s,p){
        return s + ((typeof p.monto==='number' && !p.esDevolucion) ? p.monto : 0);
      }, 0);
      porCliente[k].pagado += pag;
    }
  });
  var lista = [];
  Object.keys(porCliente).forEach(function(k){
    var c = clientes.find(function(x){ return String(x.id)===k; });
    if(!c) return; // cliente borrado -no lo mostramos aqui, ya lo cubre "ventas huerfanas"-
    lista.push({
      cid: c.id, nombre: nombreCl(c), negocio: c.negocio||'',
      comprado: porCliente[k].comprado, pagado: porCliente[k].pagado, ganancia: porCliente[k].ganancia
    });
  });
  return lista;
}


// ═══════════════════════════════════════════════════════════════════
//  MARGEN POR PRODUCTO  (6 ago 2026)
//
//  Idea de Sensei: "un reporte donde yo pueda ver todos los productos
//  al mismo tiempo y saber cuánto me cuestan, en cuánto lo vendo y
//  cuánto me estoy ganando en cada producto".
//
//  Y él mismo aclaró que es la ganancia BRUTA — sin repartirle los
//  otros gastos del negocio. El término es el correcto.
//
//  MARGEN = (precio − costo) ÷ precio × 100
//     Es el porcentaje del precio de venta que te queda. Se usa asi
//     y no sobre el costo, porque es como se mide en el comercio.
// ═══════════════════════════════════════════════════════════════════

var _margenOrden = 'menos';   // menos | mas | nombre
var _margenBusca = '';

function mostrarMargenProductos(){
  _margenOrden = 'menos'; _margenBusca = '';
  ir('p-margen');
  renderMargenProductos();
}

function compartirMargenProductos(){
  var todos = _datosMargen().filter(function(p){ return !p.sinCosto; });
  todos.sort(function(a,b){ return a.margen - b.margen; });
  var prom = todos.length
    ? Math.round(todos.reduce(function(a,p){ return a + p.margen; }, 0) / todos.length * 10) / 10 : 0;

  var t = 'MARGEN POR PRODUCTO\n';
  t += 'Nunez Beauty Supply \u00b7 ' + fechaHoy() + '\n';
  t += '\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n';
  t += 'Margen promedio: ' + prom + '%\n';
  t += 'Productos: ' + todos.length + '\n\n';
  t += 'DE MENOS A MAS GANANCIA:\n';
  todos.slice(0, 60).forEach(function(p){
    t += '\n' + String(p.nombre).slice(0,34) + '\n';
    t += '   $' + fmtNum(p.costo) + ' \u2192 $' + fmtNum(p.precio)
       + '   +$' + fmtNum(p.gan) + '   ' + p.margen + '%\n';
  });
  if(todos.length > 60) t += '\n...y ' + (todos.length - 60) + ' m\u00e1s.';

  if(navigator.share){ navigator.share({ title: 'Margen por producto', text: t }).catch(function(){}); }
  else {
    try { navigator.clipboard.writeText(t); avisoGrande('\u2705 Copiado. P\u00e9galo donde quieras mandarlo.'); }
    catch(e){ avisoGrande('No se pudo compartir en este aparato.'); }
  }
}


function mostrarReporteClientes(orden){
  orden = orden || 'ganancia'; // 'ganancia' o 'cantidad' (cantidad = comprado, en dinero)
  var ov = document.getElementById('topclientes-ov');
  var caja = document.getElementById('topclientes-caja');
  if(!ov || !caja){ avisoGrande('No se pudo abrir el reporte.'); return; }
  window._topClientesOrden = orden;

  var desdeTxt = window._topClientesDesde || '';
  var hastaTxt = window._topClientesHasta || '';
  var desde = desdeTxt ? new Date(desdeTxt+'T00:00:00') : null;
  var hasta = hastaTxt ? new Date(hastaTxt+'T23:59:59') : null;

  var lista = calcularReporteClientes(desde, hasta);
  lista.sort(function(a,b){
    return orden==='ganancia' ? (b.ganancia - a.ganancia) : (b.comprado - a.comprado);
  });
  lista = lista.slice(0, 10);

  var h = '<h3 style="font-size:20px;font-weight:800;color:#1a237e;margin:0 0 10px">📊 Reporte por Cliente</h3>'
    + '<div style="display:flex;gap:8px;margin-bottom:10px">'
    + '<button onclick="mostrarReporteClientes(\'ganancia\')" style="flex:1;padding:10px;border-radius:9px;border:2px solid '+(orden==='ganancia'?'#2E7D32':'#ddd')+';background:'+(orden==='ganancia'?'#E8F5E9':'#fff')+';color:'+(orden==='ganancia'?'#2E7D32':'#888')+';font-weight:800;font-size:13px;cursor:pointer">💰 Por Ganancia</button>'
    + '<button onclick="mostrarReporteClientes(\'cantidad\')" style="flex:1;padding:10px;border-radius:9px;border:2px solid '+(orden==='cantidad'?'#1565C0':'#ddd')+';background:'+(orden==='cantidad'?'#E3F2FD':'#fff')+';color:'+(orden==='cantidad'?'#1565C0':'#888')+';font-weight:800;font-size:13px;cursor:pointer">📦 Por Cantidad</button>'
    + '</div>'
    // Filtro de fechas (25 jul, pedido por Sensei) -vacío = de siempre, como ya era-
    + '<div style="background:#f5f6fb;border-radius:10px;padding:10px;margin-bottom:14px">'
    + '<div style="display:flex;gap:8px;margin-bottom:8px">'
    + '<div style="flex:1"><div style="font-size:10.5px;color:#666;font-weight:700;margin-bottom:2px">DESDE</div>'
    + '<input type="date" id="topcli-desde" value="'+escaparHtml(desdeTxt)+'" style="width:100%;padding:8px;border-radius:8px;border:1px solid #ccc;font-size:13px;font-family:inherit"></div>'
    + '<div style="flex:1"><div style="font-size:10.5px;color:#666;font-weight:700;margin-bottom:2px">HASTA</div>'
    + '<input type="date" id="topcli-hasta" value="'+escaparHtml(hastaTxt)+'" style="width:100%;padding:8px;border-radius:8px;border:1px solid #ccc;font-size:13px;font-family:inherit"></div>'
    + '</div>'
    + '<div style="display:flex;gap:8px">'
    + '<button onclick="aplicarFechasReporteClientes()" style="flex:1;padding:9px;border-radius:8px;border:none;background:#1a237e;color:#fff;font-weight:800;font-size:12.5px;cursor:pointer">Aplicar fechas</button>'
    + (desdeTxt||hastaTxt ? '<button onclick="quitarFechasReporteClientes()" style="flex:1;padding:9px;border-radius:8px;border:2px solid #999;background:#fff;color:#666;font-weight:700;font-size:12.5px;cursor:pointer">Ver de siempre</button>' : '')
    + '</div>'
    + (desdeTxt||hastaTxt ? '<div style="font-size:11.5px;color:#1a237e;font-weight:700;margin-top:8px;text-align:center">📅 Mostrando '+(desdeTxt?escaparHtml(desdeTxt):'el inicio')+' → '+(hastaTxt?escaparHtml(hastaTxt):'hoy')+'</div>' : '<div style="font-size:11px;color:#999;margin-top:8px;text-align:center">Mostrando de siempre -sin filtro de fechas-</div>')
    + '</div>';

  if(!lista.length){
    h += '<div style="text-align:center;color:#999;padding:30px 10px">'+((desdeTxt||hastaTxt)?'No hay ventas en ese rango de fechas.':'Todavía no tienes ventas registradas.')+'</div>';
  } else {
    lista.forEach(function(c, idx){
      h += '<div style="background:#fff;border:1px solid #eee;border-radius:12px;padding:12px;margin-bottom:10px;box-shadow:0 1px 3px rgba(0,0,0,.05)">'
        + '<div style="font-size:15px;font-weight:800;color:#1a237e">'+(idx+1)+'. '+escaparHtml(c.nombre)+'</div>'
        + (c.negocio ? '<div style="font-size:11.5px;color:#999;margin-bottom:6px">🏪 '+escaparHtml(c.negocio)+'</div>' : '<div style="margin-bottom:6px"></div>')
        + '<div style="display:flex;gap:6px">'
        +   '<div style="flex:1;background:#E3F2FD;border-radius:8px;padding:6px 4px;text-align:center">'
        +     '<div style="font-size:10px;color:#1565C0;font-weight:800">COMPRÓ</div>'
        +     '<div style="font-size:13.5px;font-weight:800;color:#1565C0">$'+fmtNum(c.comprado)+'</div></div>'
        +   '<div style="flex:1;background:#E8F5E9;border-radius:8px;padding:6px 4px;text-align:center">'
        +     '<div style="font-size:10px;color:#2E7D32;font-weight:800">PAGÓ</div>'
        +     '<div style="font-size:13.5px;font-weight:800;color:#2E7D32">$'+fmtNum(c.pagado)+'</div></div>'
        +   '<div style="flex:1;background:#FFF3E0;border-radius:8px;padding:6px 4px;text-align:center">'
        +     '<div style="font-size:10px;color:#E65100;font-weight:800">GANANCIA</div>'
        +     '<div style="font-size:13.5px;font-weight:800;color:#E65100">$'+fmtNum(c.ganancia)+'</div></div>'
        + '</div></div>';
    });
  }

  document.getElementById('topclientes-cuerpo').innerHTML = h;
  ov.style.display = 'block';
  caja.style.display = 'flex';
}

function aplicarFechasReporteClientes(){
  var d = document.getElementById('topcli-desde').value;
  var h = document.getElementById('topcli-hasta').value;
  if(d && h && d > h){ avisoGrande('La fecha "Desde" no puede ser después de la fecha "Hasta".'); return; }
  window._topClientesDesde = d;
  window._topClientesHasta = h;
  mostrarReporteClientes(window._topClientesOrden);
}
function quitarFechasReporteClientes(){
  window._topClientesDesde = '';
  window._topClientesHasta = '';
  mostrarReporteClientes(window._topClientesOrden);
}
function cerrarReporteClientes(){
  var ov = document.getElementById('topclientes-ov');
  var caja = document.getElementById('topclientes-caja');
  if(ov) ov.style.display = 'none';
  if(caja) caja.style.display = 'none';
}

// Dibuja el Reporte por Cliente como una imagen -mismo estilo que las facturas- para
// poder compartirlo con TODAS las opciones del telefono (WhatsApp, Bluetooth,
// PrinterShare, correo, etc.), en vez de la ventana de impresion basica de antes.
function compartirReporteClientes(){
  var orden = window._topClientesOrden || 'ganancia';
  var desdeTxt = window._topClientesDesde || '';
  var hastaTxt = window._topClientesHasta || '';
  var desde = desdeTxt ? new Date(desdeTxt+'T00:00:00') : null;
  var hasta = hastaTxt ? new Date(hastaTxt+'T23:59:59') : null;
  var lista = calcularReporteClientes(desde, hasta);
  lista.sort(function(a,b){ return orden==='ganancia' ? (b.ganancia-a.ganancia) : (b.comprado-a.comprado); });
  lista = lista.slice(0, 10);

  if(!lista.length){ avisoGrande('No hay datos para compartir con ese filtro.'); return; }

  conLogoListo(function(){
    var canvas = generarReporteClientesCanvas(lista, orden, desdeTxt, hastaTxt);
    canvas.toBlob(function(blob){
      if(!blob) return;
      var file;
      try{ file = new File([blob], 'reporte-por-cliente.png', {type:'image/png'}); }catch(e){ file = null; }

      if(file && navigator.canShare && navigator.canShare({files:[file]})){
        navigator.share({ files:[file], title:'Reporte por Cliente NBS' }).catch(function(err){ console.log('Compartir cancelado:', err && err.message); });
      } else if(navigator.share){
        // Respaldo de texto si el telefono no deja compartir imagenes
        var lineas = ['Reporte por Cliente — NBS', 'Ordenado por '+(orden==='ganancia'?'Ganancia':'Cantidad comprada')];
        lista.forEach(function(c,idx){ lineas.push((idx+1)+'. '+c.nombre+' — Compró $'+fmtNum(c.comprado)+' · Pagó $'+fmtNum(c.pagado)+' · Ganancia $'+fmtNum(c.ganancia)); });
        navigator.share({ title:'Reporte por Cliente NBS', text: lineas.join('\n') }).catch(function(){});
      } else {
        avisoGrande('Tu navegador no permite compartir directo. Toca "Cerrar" e intenta desde Chrome actualizado.');
      }
    }, 'image/png');
  });
}

function imprimirReporteClientes(){
  var orden = window._topClientesOrden || 'ganancia';
  var desdeTxt = window._topClientesDesde || '';
  var hastaTxt = window._topClientesHasta || '';
  var desde = desdeTxt ? new Date(desdeTxt+'T00:00:00') : null;
  var hasta = hastaTxt ? new Date(hastaTxt+'T23:59:59') : null;
  var lista = calcularReporteClientes(desde, hasta);
  lista.sort(function(a,b){ return orden==='ganancia' ? (b.ganancia-a.ganancia) : (b.comprado-a.comprado); });
  lista = lista.slice(0, 10);
  var filas = lista.map(function(c, idx){
    return '<tr><td>'+(idx+1)+'</td><td>'+escaparHtml(c.nombre)+(c.negocio?' <span style="color:#999">('+escaparHtml(c.negocio)+')</span>':'')+'</td>'
      + '<td style="text-align:right">$'+fmtNum(c.comprado)+'</td>'
      + '<td style="text-align:right">$'+fmtNum(c.pagado)+'</td>'
      + '<td style="text-align:right">$'+fmtNum(c.ganancia)+'</td></tr>';
  }).join('');
  var textoRango = (desdeTxt||hastaTxt) ? ' · Del '+(desdeTxt||'inicio')+' al '+(hastaTxt||'hoy') : ' · De siempre';
  var html = '<h1>Reporte por Cliente — NBS</h1>'
    + '<p class="sub">Ordenado por '+(orden==='ganancia'?'Ganancia':'Cantidad comprada')+textoRango+' · Generado el '+fechaHoy()+'</p>'
    + '<table><thead><tr><th>#</th><th>Cliente</th><th style="text-align:right">Compró</th><th style="text-align:right">Pagó</th><th style="text-align:right">Ganancia</th></tr></thead>'
    + '<tbody>'+filas+'</tbody></table>';
  abrirVentanaImpresion('Reporte por Cliente NBS', html);
}

// ═══ RECORDARME 3 VECES AL DÍA — revisión de integridad (25 jul, pedido por Sensei) ═══
// Un aviso DENTRO de la app solo funciona si la tiene abierta en ese momento. Para que
// de verdad avise 3 veces al dia, tenga o no la app abierta, se usa el calendario del
// telefono -mismo principio que "Recordarme estudiar" de la Academia-: se genera un
// archivo .ics con 3 eventos que se repiten cada dia, cada uno con su propia alarma.
function mostrarReporteIntegridad(html){
  var ov = document.getElementById('integridad-ov');
  var caja = document.getElementById('integridad-caja');
  if(!ov || !caja){ avisoGrande('No se pudo abrir la revision.'); return; }
  document.getElementById('integridad-cuerpo').innerHTML = html;
  ov.style.display = 'block';
  caja.style.display = 'flex';
}
function copiarAhoraManual(){
  var el = document.getElementById('copias-estado');
  el.textContent = 'Guardando...';
  el.style.color = 'var(--nbs-muted)';
  // Primero la del telefono -esa SIEMPRE funciona, aunque no haya señal-, y despues la nube
  hacerCopiaLocal().then(function(okLocal){
    return hacerCopiaAutomatica(true).then(function(okNube){
      return { local: okLocal, nube: okNube };
    });
  }).then(function(r){
    if(r.local && r.nube){
      alert('✅ VERIFICADO\n\nCopia guardada en el teléfono Y en la nube.\n\nSe volvió a leer de la nube para confirmar que quedó completa.');
    } else if(r.local){
      // Se dice la razon REAL, no "revisa tu internet" a ciegas
      var razon = window._ultimoErrorCopia || 'No se pudo confirmar que la copia quedara en la nube.';
      alert('✅ Copia guardada en el teléfono (verificada).\n\n❌ EN LA NUBE FALLÓ\n\n' + razon);
    } else if(r.nube){
      alert('✅ Copia guardada en la nube (verificada).\n\n❌ En el teléfono falló -puede que la memoria esté llena-.');
    } else {
      alert('❌ NO SE GUARDÓ NINGUNA COPIA.\n\n' + (window._ultimoErrorCopia || 'Error desconocido.'));
    }
    abrirCopias();
  });
}

function renderBitacora(){
  var el = document.getElementById('bit-contenido');
  if(!el) return;
  var lista = bitacoraEntre(_bitDesde, _bitHasta);
  if(_bitBusca){
    var q = normalizarTextoBusqueda(_bitBusca);
    lista = lista.filter(function(r){
      var t = normalizarTextoBusqueda(
        String(r.nombre || '') + ' ' + String(r.barberia || '') + ' ' +
        (r.productos || []).map(function(p){ return p.nombre; }).join(' '));
      return t.indexOf(q) >= 0;
    });
  }
  var r = resumenBitacora(lista);

  var h = '';
  // ── Los números del rango ──
  var caja = function(rot, val, col){
    return '<div style="flex:1;background:rgba(255,255,255,.14);border-radius:9px;padding:8px 4px;text-align:center;min-width:0">'
      + '<div style="font-size:8.5px;font-weight:800;color:rgba(255,255,255,.75);letter-spacing:.3px">' + rot + '</div>'
      + '<div style="font-size:14px;font-weight:900;margin-top:2px;color:' + (col || '#fff') + ';overflow:hidden;text-overflow:ellipsis">' + val + '</div></div>';
  };
  h += '<div style="background:#1a237e;border-radius:12px;padding:10px;margin-bottom:10px">'
    + '<div style="display:flex;gap:6px">'
    +   caja('VISITAS', String(r.visitas))
    +   caja('COMPRARON', String(r.compraron), '#A5D6A7')
    +   caja('NO COMPRARON', String(r.noCompraron), '#EF9A9A')
    + '</div>'
    + '<div style="display:flex;gap:6px;margin-top:6px">'
    +   caja('VENDISTE', '$' + fmtNum(r.total), '#FFD54F')
    +   caja('GANANCIA', '$' + fmtNum(r.ganancia), '#A5D6A7')
    +   caja('TE COMPRAN', r.pctCompro + '%')
    + '</div>'
    + '<div style="font-size:10.5px;color:rgba(255,255,255,.8);text-align:center;margin-top:7px">'
    +   r.cuantosClientes + ' cliente(s) \u00b7 ' + r.cuantasBarberias + ' barber\u00eda(s)</div>'
    + '</div>';

  if(!lista.length){
    h += '<div style="background:#fff;border-radius:12px;padding:22px 16px;text-align:center;'
      + 'color:var(--nbs-muted);font-size:13px;line-height:1.6">'
      + 'No hay visitas apuntadas en estas fechas.<br><br>'
      + '<span style="font-size:11.5px">La bit\u00e1cora empieza a llenarse sola desde que subiste '
      + 'esta versi\u00f3n: cada venta, cada pedido y cada visita que marques.</span></div>';
    el.innerHTML = h;
    return;
  }

  // ── Agrupado por día ──
  var porDia = {};
  var ordenDias = [];
  lista.forEach(function(x){
    if(!porDia[x.fecha]){ porDia[x.fecha] = []; ordenDias.push(x.fecha); }
    porDia[x.fecha].push(x);
  });

  var NOMBRE_DIA = ['domingo','lunes','martes','mi\u00e9rcoles','jueves','viernes','s\u00e1bado'];
  var NOMBRE_MES = ['enero','febrero','marzo','abril','mayo','junio','julio',
                    'agosto','septiembre','octubre','noviembre','diciembre'];

  ordenDias.forEach(function(fecha){
    var f = parsearFechaVenta(fecha);
    var rotulo = f
      ? (NOMBRE_DIA[f.getDay()] + ' ' + f.getDate() + ' de ' + NOMBRE_MES[f.getMonth()]).toUpperCase()
      : fecha;
    var delDia = porDia[fecha];
    var rd = resumenBitacora(delDia);

    h += '<div style="background:#0F0F18;color:#fff;border-radius:10px 10px 0 0;padding:9px 12px;margin-top:12px">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px">'
      +   '<span style="font-size:12.5px;font-weight:900;letter-spacing:.3px">' + rotulo + '</span>'
      +   '<span style="font-size:11.5px;font-weight:800;color:#A5D6A7">$' + fmtNum(rd.total) + '</span>'
      + '</div>'
      + '<div style="font-size:10.5px;color:rgba(255,255,255,.7);margin-top:2px">'
      +   rd.visitas + ' visita(s) \u00b7 ' + rd.compraron + ' compr\u00f3(aron) \u00b7 ' + rd.noCompraron + ' no'
      + '</div></div>';

    // Dentro del día, agrupado por barbería
    var porBarb = {}, ordenBarb = [];
    delDia.slice().reverse().forEach(function(x){        // del más temprano al más tarde
      var b = x.barberia || '(sin barber\u00eda)';
      if(!porBarb[b]){ porBarb[b] = []; ordenBarb.push(b); }
      porBarb[b].push(x);
    });

    h += '<div style="background:#fff;border-radius:0 0 10px 10px;overflow:hidden">';
    ordenBarb.forEach(function(barb, iB){
      var enBarb = porBarb[barb];
      var _min12 = function(t){
        var m = String(t || '').match(/(\d{1,2}):(\d{2})\s*([ap])/i);
        if(!m) return 0;
        var hh = parseInt(m[1], 10) % 12;
        if(/p/i.test(m[3])) hh += 12;
        return hh * 60 + parseInt(m[2], 10);
      };
      enBarb.sort(function(a, z){ return _min12(a.hora) - _min12(z.hora); });
      var horaMin = enBarb[0].hora || '';
      var horaMax = enBarb[enBarb.length - 1].hora || '';
      var rango = (horaMin === horaMax) ? horaMin : (horaMin + ' \u2192 ' + horaMax);
      h += '<div style="background:#F4F4F8;padding:7px 12px;border-top:' + (iB ? '1px solid #E8E8EF' : 'none') + '">'
        + '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px">'
        +   '<span style="font-size:12px;font-weight:900;color:var(--nbs-ink)">\ud83c\udfea ' + escaparHtml(barb) + '</span>'
        +   '<span style="font-size:10.5px;font-weight:700;color:var(--nbs-muted)">' + escaparHtml(rango) + '</span>'
        + '</div></div>';

      enBarb.forEach(function(x){
        var col = x.compro ? 'var(--nbs-green-text)' : 'var(--nbs-red-text)';
        h += '<div style="padding:10px 12px;border-top:1px solid #F0F0F5">'
          + '<div style="display:flex;align-items:flex-start;gap:9px">'
          // ⏰ LA HORA, en su propia columna: cada venta es un momento distinto -14 ago-
          +   '<div style="flex-shrink:0;width:62px;text-align:center;background:#EEEEF5;'
          +     'border-radius:7px;padding:5px 3px">'
          +     '<div style="font-size:11px;font-weight:900;color:#1a237e;line-height:1.2">'
          +       escaparHtml(String(x.hora || '').replace(/\s*([ap])\.?\s*m\.?/i, '')) + '</div>'
          +     '<div style="font-size:8.5px;font-weight:800;color:var(--nbs-muted)">'
          +       (/p\.?\s*m/i.test(String(x.hora || '')) ? 'p.m.' : 'a.m.') + '</div>'
          +   '</div>'
          +   '<div style="flex:1;min-width:0">'
          +     '<div style="font-size:13px;font-weight:800;color:var(--nbs-ink)">'
          +       (x.compro ? '\u2713 ' : '\u2717 ') + escaparHtml(x.nombre) + '</div>'
          +     '<div style="font-size:10.5px;color:var(--nbs-muted);margin-top:1px">'
          +       (x.como === 'auto' ? '\ud83e\udd16 sola' : 'a mano')
          +       (x.tipo ? ' \u00b7 ' + (x.tipo === 'credito' ? 'a cr\u00e9dito' : 'contado') : '')
          +     '</div>'
          +   '</div>'
          +   '<div style="text-align:right;flex-shrink:0">'
          +     '<div style="font-size:13.5px;font-weight:900;color:' + col + '">'
          +       (x.compro ? '$' + fmtNum(x.total) : 'no compr\u00f3') + '</div>'
          +     (x.compro && x.ganancia ? '<div style="font-size:10px;color:var(--nbs-muted)">te dej\u00f3 $'
                 + fmtNum(x.ganancia) + '</div>' : '')
          +   '</div>'
          + '</div>';
        // Los productos
        if((x.productos || []).length){
          h += '<div style="margin-top:5px;padding-left:71px">'
            + x.productos.slice(0, 8).map(function(p){
                return '<div style="font-size:11px;color:var(--nbs-ink);display:flex;justify-content:space-between;gap:8px">'
                  + '<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis">\u00b7 '
                  +   escaparHtml(String(p.nombre).slice(0, 34)) + '</span>'
                  + '<span style="color:var(--nbs-muted);flex-shrink:0">\u00d7' + p.cant + '</span></div>';
              }).join('')
            + ((x.productos || []).length > 8
                ? '<div style="font-size:10px;color:var(--nbs-muted)">y ' + (x.productos.length - 8) + ' m\u00e1s</div>' : '')
            + '</div>';
        }
        if(x.nota){
          h += '<div style="margin-top:4px;padding-left:71px;font-size:10.5px;color:var(--nbs-gold-dark);font-weight:700">'
            + '\u26a1 ' + escaparHtml(x.nota) + '</div>';
        }
        h += '</div>';
      });
    });
    h += '</div>';
  });

  el.innerHTML = h;
}

// ═══ IMPRIMIR Y COMPARTIR ═══
function compartirBitacora(){
  var t = textoBitacora();
  if(navigator.share){
    navigator.share({ title: 'Bit\u00e1cora de visitas', text: t }).catch(function(){});
  } else if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(t);
    avisoGrande('\u2705 La bit\u00e1cora se copi\u00f3. P\u00e9gala donde quieras.');
  } else {
    avisoGrande(t.slice(0, 900));
  }
}

function imprimirBitacora(){
  var el = document.getElementById('bit-contenido');
  if(!el) return;
  imprimirReporte('Bit\u00e1cora de visitas \u00b7 ' + (_bitDesde || '') + ' a ' + (_bitHasta || ''),
                  el.innerHTML, textoBitacora());
}

// ═══════════════════════════════════════════════════════════════════
//  🤖 EL ASISTENTE — LA CARA
// ═══════════════════════════════════════════════════════════════════

var _asistenteAbierto = false;

// ═══════════════════════════════════════════════════════════════════
//  🔊 ESCUCHAR LO NUEVO  (15 ago 2026)
//
//  Sensei, desde la ruta: "no puedo estar leyendo todo lo que me
//  escribes... si pudiera escucharlo en vez de leerlo fuera mucho mejor".
//
//  Usa la misma voz del Asistente. Le lee lo que trae la versión que
//  acaba de subir, en palabras cortas, sin tecnicismos.
// ═══════════════════════════════════════════════════════════════════
var NOVEDADES_VERSION = '20260921a';

var NOVEDADES = [
  'Esto es lo que arreglamos desde ayer.',
  'Al convertir un pedido en venta, los dos enlaces chiquitos que estaban pegados debajo del boton de registrar ya no estan. Ahora hay un solo boton gris, bien separado, que dice Salir de este pedido. Al tocarlo te pregunta que hacer: se queda guardado y sales, ya no lo quiere y se borra con confirmacion, o seguir con la venta. Asi un dedo apurado no puede borrar un pedido queriendo guardarlo, como casi pasa ayer viernes con el de setenta dolares.',
  'Ya tienes tu lado del NBS Chat, dentro de la app. En la pantalla de inicio hay un boton nuevo que dice NBS Chat, con un globito rojo que te cuenta los mensajes sin leer. El globito se actualiza solo, con el mismo reloj de dos minutos del buzon de pedidos.',
  'Adentro ves todas las conversaciones, las que tienen mensajes sin leer arriba y marcadas en rojo. Tocas una y contestas ahi mismo: tus mensajes salen en verde a la derecha, los del cliente a la izquierda. Al abrir la conversacion, sus mensajes quedan leidos y el globito baja.',
  'Para darle chat a un cliente tocas Dar acceso, lo escoges de tu lista de siempre, y TU escribes la clave que le vas a dar, como decidiste. Y en Ver los accesos esta cada uno con su clave y cuando entro por ultima vez, con un boton para quitarle el acceso o devolverselo. La conversacion nunca se borra: si se lo devuelves, la ve completa.',
  'Y el chat quedo con candado de raiz: cada conversacion vive dentro de su propia clave, como un buzon cerrado. Quien no tenga la clave exacta no puede ver nada, ni la lista de claves, ni escribir haciendose pasar por NBS. Tu, con tu sesion, lo ves todo como siempre.',
  'El chat del cliente entra por su propia puerta, aparte del catalogo, asi que puedes darle chat a alguien sin darle el catalogo. Y nada de esto toca tu dinero ni tus ventas: el chat solo lee y escribe mensajes.',
  'Tienes un boton nuevo en el Catalogo que dice Buscador profundo. Escribes parte del nombre de un producto que no encuentras y te busca en OCHO sitios distintos: si esta guardado en el aparato, si la app lo esta escondiendo, si su numero esta marcado como borrado, en cuantas facturas de venta esta, con que numero lo guardan esas facturas, y si el buscador del catalogo lo encuentra o no.',
  'Y al final te da un boton para copiar todo eso y pegarmelo en el chat. Asi yo veo exactamente lo que pasa en TU telefono con TUS datos, en vez de adivinar.',
  'Ya se por que el Gummy gel de setecientos no te aparece: ESE PRODUCTO SE BORRO DEL CATALOGO. Por eso sale en la factura del dia doce pero no lo encuentras al vender ni al comprar. Una factura guarda una foto del producto del momento de la venta, asi que ahi sigue apareciendo aunque el producto ya no exista.',
  'En el Catalogo tienes un boton nuevo que dice: Productos que ya no estan, recuperar. Ahi te salen TODOS los que estan en tus facturas pero ya no estan en el catalogo, con lo que vendiste de cada uno y a que precio. Y los puedes devolver al catalogo con un toque: el nombre, el precio y el costo se sacan de sus propias facturas.',
  'Ya se por que el Gummy gel de setecientos no te aparecia. No era la busqueda: tenias DOS marcas que son la misma, GUMMY en mayusculas y Gummy normal, y ese producto estaba en el grupo chiquito. Y al medir tus datos encontre catorce marcas partidas asi, no solo esa. Babyliss, Level3, Nishman, Wahl y diez mas.',
  'En el Catalogo tienes dos botones nuevos: Unificar marcas repetidas, que las junta, y Marcas con mayuscula solo al principio. Los dos te ensenan ANTES lo que van a hacer, y no tocan ningun precio ni ninguna factura.',
  'Tambien le puse un diccionario de tus palabras a la busqueda: si escribes gelatina te encuentra los gel, si escribes cera te encuentra los wax, cuchilla te encuentra las navajas, y asi con cincuenta y cuatro palabras mas.',
  'Y lo ultimo que pediste: si le cambias el nombre a un producto que ya vendiste, te pregunto si quieres corregir tambien el nombre en las facturas viejas. Los precios NUNCA se tocan, solo el nombre.',
  'La firma quedo como tu la querias: te pregunto UNA sola vez y tu decides SI o NO en cada venta. Dos botones, nada mas. Le habia agregado un aviso extra que salia despues de guardar y un cuadrito de no me preguntes mas, y las dos cosas sobraban, porque tu ya me habias explicado que hay ordenes que necesitan firma y otras que no, y eso lo manejas tu a discrecion. Ya lo quite todo.',
  'Arregle lo de la firma, y encontre la causa de verdad. Habia TRES sitios que te pedian firma, no uno. Se arreglo el segundo hace unos dias, pero quedaba un tercero escondido dentro de guardar la venta: un aviso que salia menos de un segundo DESPUES de haberla guardado. La venta ya estaba guardada, pero como el aviso aparecia justo despues, parecia que no se habia cerrado.',
  'Ya no sale. Y ahora en la pregunta de la firma tienes un cuadrito que dice: no me preguntes mas por la firma, guarda directo. Si lo marcas, no te vuelvo a preguntar nunca mas y las ventas se guardan de una vez.',
  'Ahora soy mucho mas inteligente. Antes solo entendia nueve preguntas y todo lo demas me hacia decir no te entendi. Ahora entiendo veintiseis temas y no busco frases exactas sino ideas, asi que me da igual como me lo escribas. Preguntame cosas como: cuales son los clientes que mas dinero me deben, a quien tengo que cobrarle, cuanto vale mi inventario, que es lo que mas vendo, cuanto llevo en el mes, cuantos puntos tiene Eric, o cuanto me debe Luis. Y si de verdad no te entiendo, en vez de darte una lista fria te adivino lo que quisiste decir y te lo ofrezco en botones.',
  'Y arregle algo que te molestaba: si yo estoy hablando y tu tocas el boton de hablame, ahora me callo en seco, como cuando uno interrumpe a alguien.',
  'Se construyo la simulacion determinista, que es lo mas fuerte que existe: simula un ano completo de tu negocio con el reloj congelado y con tropiezos metidos a proposito, como que el guardado falle o que la app se cierre a media venta. Trescientos dias, mas de novecientos tropiezos, y el dinero cuadro en cero.',
  'Y esa simulacion encontro un hueco en las leyes que teniamos: si un pago se guardaba con un centavo de menos, ninguna de las ocho leyes lo veia, porque el centavo no desaparecia, se quedaba como deuda del cliente. Por eso ahora hay una LEY NUEVE que compara lo que el cliente pago de verdad con lo que la app apunto. Ni un centavo se pierde entre las dos cosas.',
  'Se construyeron los tres sistemas de auditoria mas fuertes que existen hoy. El primero inventa secuencias absurdas de operaciones, como vender, cancelar, cobrar, devolver y borrar un pago en orden al azar, y revisa las ocho leyes del dinero despues de cada paso. El segundo compara la app de hoy con la de ayer usando los mismos datos: si un numero cambia, avisa. Y el tercero lee las treinta y dos mil lineas buscando patrones peligrosos sin ejecutar nada. Los tres estan metidos en el guion obligatorio, asi que corren solos antes de cada entrega.',
  'Ahora TODAS las casillas donde se escribe dinero tienen el modo calculadora. El punto se pone solo en los dos ultimos numeros: escribes cuatro mil y quedan cuarenta dolares. La app ya lo tenia en veintiocho casillas pero le faltaba en siete, entre ellas el costo en compras y todas las del cuadre de caja. Por eso te fallo justo ahi. Ya son treinta y seis, y le puse una prueba que revisa toda la app para que nunca se quede ninguna sin el.',
  'Arregle algo que te tenia que estar molestando mucho: despues de que yo te decia en voz alta lo que tenia que decirte, decia no te entendi y te leia una lista larga. La razon es que el microfono se quedaba encendido mientras yo hablaba, se oia a si mismo, y como eso no era una pregunta contestaba no te entendi. Ya no. Mientras hablo el microfono se apaga, y si aun asi oye mi propia voz la descarta. Pero cuando tu me preguntes algo de verdad, te contesto igual.',
  'Arregle el boton de Ya lo vi que no funcionaba con Eric Young. La causa era el apodo: cuando un cliente tiene su apodo entre comillas, esas comillas rompian el boton por dentro y no hacia nada. Y eso le pasaba a todos tus clientes con apodo, no solo a Eric. Ya esta arreglado de raiz, en los sesenta y cuatro botones de la app que pasan un texto.',
  'Tienes una Cuadre de Caja nueva, en el menu. Es como una hoja de calculo: pones cuantos billetes de cada denominacion tienes y ella suma sola. Escoges que dias quieres cuadrar, un dia o varios o una semana, como tu decidas, y te compara lo que contaste con lo que la app dice que cobraste. Te dice si cuadra, si falta o si sobra. Y cada cuadre queda guardado, lo puedes volver a ver y editarlo cuando quieras.',
  'Muy importante: la Cuadre de Caja SOLO LEE lo que cobraste. No toca ni una venta, ni un cliente, ni un producto. Esta comprobado con una prueba que revisa catorce cosas de la app antes y despues de hacer un cuadre completo, y ninguna cambia.',
  'El boton de Ayuda esta al dia. Ahora tiene cuarenta y dos temas, con todo lo de estas dos semanas, y entiende las palabras que tu usas de verdad. Le puedes preguntar cosas como: me equivoque en un pago, cuantos puntos lleva un cliente, el robot me estorba, no quiero que firmen todos, que se me esta acabando. Y te lleva derecho a la respuesta.',
  'Cuando corriges el nombre de un producto, ese arreglo ahora SI cuenta en los puntos VIP de las compras que el cliente ya hizo. Antes no, porque la factura guarda el nombre del momento de la venta. La factura sigue diciendo lo mismo, eso no se toca, pero los puntos se cuentan con el nombre de hoy.',
  'Y en la lista de clientes ahora sale su codigo arriba del nombre, donde dice CLIENTE cero cero uno.',
  'Y ahora tienes el informe completo DENTRO de la app, para leerlo en el telefono cuando quieras. Esta en el Manual de Usuario, de primero, donde dice Informe del dieciseis y diecisiete de agosto. Trae todo: tus numeros, los dos fallos de dinero que se arreglaron, lo que se construyo dia por dia, y lo que queda pendiente.',
  'Lo mas importante de esta version es un fallo de dinero que estaba escondido hace meses. Cuando un cliente te pagaba mas de lo que debia una factura, el sobrante se repartia a las demas, pero la app no miraba si esas otras eran de contado. Una venta al contado ya esta pagada, asi que el sobrante se iba a facturas que ya estaban saldadas y la deuda del cliente no bajaba todo lo que habia pagado. Ya esta arreglado.',
  'Lo encontro una prueba nueva que se llama las leyes del dinero. En vez de probar casos que se me ocurren a mi, le puse ocho reglas que nunca se pueden romper y la maquina inventa cientos de negocios buscando donde fallan. Es la prueba mas fuerte que existe para esto.',
  'En pedidos rapidos, cuando un cliente no te compra, ahora hay dos botones porque son cosas muy distintas: No quiso nada, y No estaba. Las dos cuentan como visita porque tu fuiste hasta alla, pero el No estaba NO le baja su porcentaje de compra, porque no fue culpa suya. En su ficha ves los tres numeros separados.',
  'Lo mas importante: las visitas. Habia dos records que nunca se hablaban. Cuando marcabas una barberia en la ruta, eso se quedaba solo en la ruta y la ficha del cliente no se enteraba nunca. Por eso en Visitas no te salia nada. Ya estan conectados: marcas la barberia y a todos sus barberos les queda la visita apuntada, y si despues les vendes cambia solo de no compro a compro.',
  'Y hay un listado nuevo de clientes. En la pantalla de Clientes, boton Listado completo. Puedes ordenarlos por codigo, por nombre, por lo que te deben, por lo que te compran o por lo que te dejan. Y filtrarlos: solo los que te deben, los que estan al dia, los que dejaron de venir, los sin servicio, o los de una sola barberia. Y lo imprimes o lo compartes.',
  'Cada cliente ahora tiene su codigo de registro, del cero cero uno al ciento cuarenta y siete, en el orden en que tu los registraste. Lo ves en su cuenta al lado de donde dice CUENTA DE, y en la lista de clientes. El codigo se pone una sola vez y no cambia nunca: si entra un cliente nuevo le toca el ciento cuarenta y ocho.',
  'El programa VIP ahora agrupa por TIPO de producto. Todas las colonias cuentan juntas aunque sean de marcas distintas, todos los wax igual, y el cool care con el blade care porque es lo mismo. Las navajas siguen contando por marca, como pediste. Con esto tus clientes llegan a los diez mucho mas rapido.',
  'Y ahora puedes mandarle a cada cliente sus puntos por WhatsApp. En su cuenta, en el renglon del Programa VIP, hay un lapiz. Lo tocas, ves el mensaje, y lo mandas. Le llega su primer nombre, cuantos lleva de cada tipo, el agradecimiento y un empujon para que llegue a los diez.',
  'Lo mas importante: ahora puedes cobrarle a un cliente SIN SALIR de pedidos rapidos. Debajo de su nombre, donde dice lo que te debe, hay un boton verde que dice Cobrarle. Le pones cuanto te pago y la app lo reparte sola: primero la factura mas vieja, despues la que sigue, y asi. Y te lo ensena ANTES de tocar nada, para que veas exactamente a donde va cada peso. Si te paga de mas, lo que sobra le queda a favor.',
  'El boton de Ya lo vi de los avisos NO ESTABA FUNCIONANDO. Culpa mia: el boton mandaba un texto con saltos de linea y el navegador lo rechazaba, asi que no hacia nada. Ya esta arreglado: tocalo y el aviso se marca leido, desaparece y se va al historial.',
  'Y ahora doce de los quince renglones de la cuenta del cliente tienen su lapiz de editar a la vista. Los tres que no lo tienen son cuentas, no datos: lo que mas compra, las facturas canceladas y lo que te deja. Ponerles un lapiz seria mentirte porque no hay nada que editar ahi.',
  'Lo que me acabas de decir: en la seccion de Sus pagos de cada cliente ahora cada pago tiene su lapiz y su papelera. Lo corriges o lo borras ahi mismo, y el DEBE de arriba se actualiza al momento.',
  'Primero, el fallo que me mandaste en la foto. Cuando tocabas el lapiz de un pago decia: no se encontro el pago. Era culpa mia: el boton pasaba el numero de la factura como texto y la app lo comparaba como numero, asi que nunca coincidian. Ya esta arreglado, y de paso arregle otras veinticuatro funciones que tenian el mismo problema esperando a pasar.',
  'Segundo, los lapices. Tenias razon: yo los habia puesto DENTRO de cada renglon, y habia que abrirlo para verlos. Ahora cada renglon que se puede editar tiene su lapiz A LA VISTA, sin abrir nada. Credito a favor, notas, cada cuanto visitarlo, precios especiales y sus datos.',
  'Uno. En pedidos rapidos ahora ves lo que cada barbero te debe, debajo de su nombre, y sigue ahi despues de guardar el pedido.',
  'Dos. El cuadro de cada barbero se hizo mas chico. Lo que mas vendes y lo que mas compra el cliente ahora estan detras de un boton que dice Sugerencias, y se abren ahi mismo cuando lo toques.',
  'Tres. El boton del asistente ahora lo puedes mover. Dejalo apretado un momento y arrastralo donde tu quieras. Ahi se queda.',
  'Cuatro. Los avisos del asistente funcionan como un correo. Cuando toques Ya lo vi, se marca leido y se va a un historial donde lo puedes volver a ver o borrarlo. El puntito rojo solo cuenta los nuevos.',
  'Y cinco. Las facturas de cada cliente ahora salen siempre en orden: la mas nueva arriba y la mas vieja abajo.',
  'Lo mas grande: la cuenta del cliente. Cuando entras a un cliente ahora dice CUENTA DE y su nombre, y ahi esta absolutamente todo lo suyo: sus facturas, incluidas las canceladas que antes ni se veian, cada pago que te hizo, sus pedidos pendientes, sus devoluciones, sus visitas, su credito a favor, sus precios especiales y sus notas. Y todo se puede editar ahi mismo, sin salir.',
  'Y algo que te va a ahorrar mucho tiempo: la app ahora se revisa sola una vez al dia. Si el dinero no cuadra, si hay una factura pagada de mas, o si algo esta raro, TE LO DICE ELLA antes de que lo descubras tu. Si todo esta bien, no te molesta.',
  'Tambien los nombres de los clientes ahora se ven mas grandes en todas las pantallas.',
  'Uno. El dinero escondido. En la ficha de un cliente el DEBE decia treinta y cinco dolares y eran cuarenta y cinco. La app daba por sentado que toda factura de contado estaba pagada completa, y si una se modificaba y quedaba debiendo, ese dinero no lo contaba nadie. Ya esta arreglado en las ocho pantallas donde pasaba.',
  'Dos. Esa factura tampoco se podia cobrar. No aparecia en la pantalla de recibir pago. Ahora si aparece.',
  'Tres. El vuelto. Si te pagan de mas, lo que sobra ahora abona las facturas viejas del cliente, de la mas vieja a la mas nueva. Y si todavia sobra, queda a su favor. Antes ese dinero se quedaba colgado.',
  'Cuatro. Los nombres. Si corriges el nombre de un producto en el catalogo, ahora se actualiza solo en los pedidos pendientes, en el carrito y en la lista de relleno. Las facturas ya hechas no se tocan, porque tienen que coincidir con el papel que tiene el cliente.',
  'Cinco. La ruta se marca sola cuando vendes. Antes el dia de la semana estaba corrido y marcaba en el dia equivocado. Ya esta bien.',
  'Seis. En pedidos rapidos, cuando guardas un barbero la tarjeta ahora se cierra sola.',
  'Y siete. Hay una bitacora nueva de visitas, en Reportes, donde ves todo lo que paso con cada cliente: la hora, si te compro y que se llevo.',
  'Nueve. Y ahora puedes corregir un pago desde la factura. Si le pusiste el monto equivocado y la factura se saldo, entra a la factura y ahi salen los pagos con un lapiz para corregirlos y una papelera para borrarlos. Antes solo se podia desde Cuentas por Cobrar, y una factura saldada no sale ahi.',
  'Ocho. En la ficha del cliente hay un renglon nuevo que dice Sus pagos, donde ves todo lo que ese cliente te ha pagado, con la fecha y de que factura salio.',
  'Eso es todo. Todo esto se probo quinientas setenta y tres veces, dos vueltas completas, y el dinero cuadra.'
];

function imprimirListadoClientes(){
  var r = armarListadoClientes();
  if(!r.lista.length){ alert('No hay clientes con ese filtro.'); return; }

  var nombresOrden = { codigo: 'por c\u00f3digo', nombre: 'por nombre',
                       deuda: 'por lo que deben', comprado: 'por lo que compran',
                       deja: 'por lo que dejan' };
  var nombresFiltro = { todos: 'todos', deben: 'los que deben',
                        alcorriente: 'los que est\u00e1n al d\u00eda', activos: 'los que compran',
                        dormidos: 'los que dejaron de venir',
                        sinservicio: 'los que est\u00e1n sin servicio',
                        barberia: r.barberia };

  var totDebe = r.lista.reduce(function(a, x){ return a + x.debe; }, 0);
  var totComp = r.lista.reduce(function(a, x){ return a + x.comprado; }, 0);
  var totDeja = r.lista.reduce(function(a, x){ return a + x.deja; }, 0);

  var html = '<h1>Listado de Clientes \u2014 NBS</h1>'
    + '<p class="sub">' + r.lista.length + ' cliente(s) \u00b7 ' + nombresFiltro[r.filtro]
    + ' \u00b7 ' + nombresOrden[r.orden] + ' \u00b7 ' + fechaHoy() + '</p>';

  html += '<div style="background:#F0F0F8;padding:10px;border-radius:8px;margin-bottom:14px;'
    + 'display:flex;gap:18px;font-size:13px">'
    + '<span><b>Compraron:</b> $' + fmtNum(totComp) + '</span>'
    + '<span><b>Deben:</b> $' + fmtNum(totDebe) + '</span>'
    + '<span><b>Te dejaron:</b> $' + fmtNum(totDeja) + '</span></div>';

  r.lista.forEach(function(x){
    var c = x.c;
    var cod = codigoDeCliente(c);
    html += '<div style="border:1px solid #DDD;border-radius:8px;padding:10px;margin-bottom:9px;'
      + 'page-break-inside:avoid">';
    html += '<div style="display:flex;align-items:baseline;gap:8px;margin-bottom:5px">'
      + (cod ? '<span style="background:#3949AB;color:#fff;border-radius:4px;padding:2px 7px;'
               + 'font-size:12px;font-weight:900">' + cod + '</span>' : '')
      + '<span style="font-size:16px;font-weight:900">' + escaparHtml(x.nombre) + '</span>'
      + (c.sinServicio ? '<span style="font-size:11px;color:#C62828;font-weight:800">'
          + '\u23f8 SIN SERVICIO</span>' : '')
      + '</div>';
    if(c.negocio) html += '<div style="font-size:12.5px;color:#555;margin-bottom:5px">\ud83c\udfea '
      + escaparHtml(c.negocio) + '</div>';

    var datos = [];
    if(c.tel) datos.push('\ud83d\udcde ' + escaparHtml(c.tel));
    var dir = [c.dir, c.ciudad, c.estado, c.zip].filter(function(y){ return y && String(y).trim(); }).join(', ');
    if(dir) datos.push('\ud83d\udccd ' + escaparHtml(dir));
    if(c.contacto || c.contactoTel){
      datos.push('\ud83d\udc64 ' + escaparHtml([c.contacto, c.contactoTel].filter(Boolean).join(' \u00b7 ')));
    }
    if(datos.length) html += '<div style="font-size:12px;color:#444;margin-bottom:6px">'
      + datos.join(' &nbsp;|&nbsp; ') + '</div>';

    html += '<table style="width:100%;font-size:12px;border-collapse:collapse">'
      + '<tr>'
      +   '<td><b>Compr\u00f3:</b> $' + fmtNum(x.comprado) + '</td>'
      +   '<td><b>Debe:</b> <span style="color:' + (x.debe > 0.005 ? '#C62828' : '#2E7D32')
      +     ';font-weight:800">$' + fmtNum(x.debe) + '</span></td>'
      +   '<td><b>Te deja:</b> $' + fmtNum(x.deja) + ' (' + x.margen + '%)</td>'
      + '</tr><tr>'
      +   '<td><b>Facturas:</b> ' + x.facturas + '</td>'
      +   '<td><b>Compra:</b> ' + (x.cada !== null ? 'cada ' + x.cada + ' d\u00edas' : '\u2014') + '</td>'
      +   '<td><b>\u00daltima:</b> ' + (x.dias !== null ? 'hace ' + x.dias + ' d\u00edas' : '\u2014') + '</td>'
      + '</tr>';
    var extras = [];
    if(x.credito > 0.005) extras.push('<b>A favor:</b> $' + fmtNum(x.credito));
    if(x.visitas && x.visitas.total) extras.push('<b>Visitas:</b> ' + x.visitas.total
      + ' (' + x.visitas.pct + '% compr\u00f3)');
    if(c.nota) extras.push('<b>Nota:</b> ' + escaparHtml(String(c.nota).slice(0, 60)));
    if(extras.length) html += '<tr><td colspan="3">' + extras.join(' &nbsp;|&nbsp; ') + '</td></tr>';
    html += '</table></div>';
  });

  try { abrirVentanaImpresion('Listado de Clientes NBS', html); }
  catch(e){ alert('No se pudo abrir la impresi\u00f3n.'); }
}


// ═══════════════════════════════════════════════════════════════════
//  🧮 LA CAJA DE CUADRE
//
//  Cuenta los billetes, suma solo, y compara con lo que la app dice
//  que cobró en los días que él escoja.
//
//  🔒 SOLO LEE. No escribe ni una letra fuera de `nbs_cuadres`.
// ═══════════════════════════════════════════════════════════════════
var CUADRE_LLAVE = 'nbs_cuadres';
var CUADRE_FONDO = 'nbs_cuadre_fondo';

// Los billetes y monedas de verdad, de mayor a menor
var CUADRE_BILLETES = [100, 50, 20, 10, 5, 1];
var CUADRE_MONEDAS  = [0.25, 0.10, 0.05, 0.01];

var _cuadreActual = null;   // el que se está armando o editando

function reporteDePagos(desde, hasta, el){
  var ventasTodas = LS('nv', []);
  var clientesTodos = LS('ncl', []);

  // Convierte una fecha de pago -que puede venir en MM/DD/AAAA o AAAA-MM-DD- a objeto Date
  function fechaPagoADate(f){
    if(!f) return null;
    try {
      if(f.indexOf('-') > -1 && f.split('-')[0].length === 4){
        var a = f.split('-'); return new Date(parseInt(a[0]), parseInt(a[1])-1, parseInt(a[2]));
      }
      return parsearFechaVenta(f);
    } catch(e){ return null; }
  }
  function enRango(fPago){
    var d = fechaPagoADate(fPago);
    if(!d) return (!desde && !hasta); // pago sin fecha: solo entra si no hay filtro
    if(desde){ var dp=desde.split('-'); var dd=new Date(parseInt(dp[0]),parseInt(dp[1])-1,parseInt(dp[2])); if(d<dd) return false; }
    if(hasta){ var hp=hasta.split('-'); var hd=new Date(parseInt(hp[0]),parseInt(hp[1])-1,parseInt(hp[2])); hd.setHours(23,59,59,999); if(d>hd) return false; }
    return true;
  }

  var porCliente = {}; // clave -> {nombre, negocio, total, pagos:[{fecha,monto,metodo}]}
  var totalGeneral = 0, cantPagos = 0;

  ventasTodas.forEach(function(v){
    if(v.cancelada) return;
    var pagos = v.pagosFactura || [];
    pagos.forEach(function(p){
      if(typeof p.monto !== 'number' || p.monto <= 0) return;
      if(!enRango(p.fecha)) return;
      var k = v.cid ? String(v.cid) : (v.cn || 'Cliente general');
      if(!porCliente[k]){
        var cl = clientesTodos.find(function(c){ return String(c.id) === String(v.cid); });
        var nombre = cl ? ((cl.nombre || '') + (cl.apellido ? ' ' + cl.apellido : '') + (cl.apodo ? ' "'+cl.apodo+'"' : '')).trim() : (v.cn || 'Cliente general');
        if(!nombre) nombre = (v.cn || 'Cliente general');
        var negocio = cl ? (cl.negocio || '') : '';
        porCliente[k] = { nombre: nombre, negocio: negocio, total: 0, pagos: [] };
      }
      porCliente[k].total += p.monto;
      porCliente[k].pagos.push({ fecha: p.fecha || 'sin fecha', monto: p.monto, metodo: p.metodo || 'efectivo' });
      totalGeneral += p.monto;
      cantPagos++;
    });
  });

  var claves = Object.keys(porCliente);
  if(!claves.length){
    el.innerHTML = '<div class="card"><p style="color:#aaa;text-align:center;padding:20px">Nadie te pagó en ese periodo.<br>Prueba con otras fechas.</p></div>';
    return;
  }

  // Tarjeta de total arriba
  var html = '<div class="card" style="background:#E8F5E9;text-align:center;padding:16px;margin-bottom:12px">'
    +'<div style="font-size:12px;color:#2E7D32;font-weight:700">TOTAL COBRADO EN ESTAS FECHAS</div>'
    +'<div style="font-size:28px;font-weight:800;color:#2E7D32">$'+fmtNum(totalGeneral)+'</div>'
    +'<div style="font-size:12px;color:#2E7D32">'+cantPagos+' pago(s) de '+claves.length+' cliente(s)</div>'
    +'</div>';

  html += '<div style="font-size:11px;color:var(--nbs-muted);font-weight:700;letter-spacing:0.5px;margin-bottom:8px">QUIÉN TE PAGÓ Y CUÁNTO</div>';

  // Ordenar del que mas pago al que menos
  claves.sort(function(a,b){ return porCliente[b].total - porCliente[a].total; }).forEach(function(k){
    var c = porCliente[k];
    var detalle = c.pagos.map(function(p){
      return '<div style="display:flex;justify-content:space-between;font-size:12px;color:var(--nbs-muted);padding:3px 0">'
        +'<span>'+escaparHtml(p.fecha)+' · '+escaparHtml(p.metodo)+'</span>'
        +'<span>$'+fmtNum(p.monto)+'</span></div>';
    }).join('');
    html += '<div class="card" style="margin-bottom:8px;padding:12px">'
      +'<div style="display:flex;justify-content:space-between;align-items:center">'
      +'<div style="font-size:14px;font-weight:700;color:#1a237e">'+escaparHtml(c.nombre)+'</div>'
      +'<div style="font-size:16px;font-weight:800;color:#2E7D32">$'+fmtNum(c.total)+'</div>'
      +'</div>'
      +(c.negocio ? '<div style="font-size:12px;color:var(--nbs-muted)">'+escaparHtml(c.negocio)+'</div>' : '')
      +'<div style="border-top:1px solid #f0f0f0;margin-top:8px;padding-top:6px">'+detalle+'</div>'
      +'</div>';
  });

  el.innerHTML = html;
}

function imprimirReporteVentas(){
  var el = document.getElementById('rptres');
  if(!el || !el.innerHTML){ alert('Genera primero un reporte.'); return; }
  // Quitar el botón del contenido a imprimir
  var contenido = el.innerHTML.replace(/<div><button[^>]*imprimirReporteVentas[^<]*<\/button><\/div>/g, '');
  imprimirReporte('Reporte de Ventas', contenido, 'Reporte de Ventas — NBS');
}

var cxcClienteId = null;


// ═══════════════════════════════════════════════════════════════════
//  CUÁNTO ME DEBÍAN, DÍA POR DÍA  (31 jul)
//
//  Sensei: "en cuentas por cobrar, al día de ayer me debían X, al día
//  anterior otra cantidad y hoy otra, de acuerdo al movimiento que
//  haya habido cada día".
//
//  ⚠️ ESTO SOLO LEE. No guarda, no cambia y no borra NADA. Se calcula
//  todo de las ventas y los pagos que ya existen:
//     lo que te debían ese día  =  lo que fiaste hasta ese día
//                                  menos lo que cobraste hasta ese día
// ═══════════════════════════════════════════════════════════════════
var _histCxCDias = parseInt(localStorage.getItem('nbs_hist_cxc_dias') || '30', 10);

function compartirCortoDesdeEstado(){
  var cid = window._estadoCuentaCid;
  if(!cid) return;
  var cobros = cobrosDelCliente(cid);
  if(!cobros.length){
    alert('Este cliente todavía no te ha pagado nada, así que no hay un último pago que mandarle.\n\n'
      + 'Usa el botón verde para mandarle el estado de cuenta completo.');
    return;
  }
  var ultimo = cobros[0];   // ya vienen del más nuevo al más viejo
  var texto = textoCortoParaCliente(cid, ultimo.montoCobro);
  // \ud83d\udd34 SE QUITA EL confirm -4 sep-. En Android, un letrero con TODO el mensaje dentro
  // a veces no se dibuja, devuelve "no" y la funcion se corta en seco: parecia que el
  // boton no hacia nada. Y ademas sobraba: la pantalla de "¿Como se lo mandas?" YA
  // enseña el mensaje antes de mandarlo. Eran dos avisos para lo mismo.
  mandarloAlCliente(cid, texto, 'Mensaje corto');
}

function compartirMensajeDelCliente(cid, texto){
  clientes = LS('ncl', []);
  var c = clientes.find(function(x){ return String(x.id) === String(cid); });
  var nom = c ? nombreCl(c) : 'cliente';
  _copiarTexto(texto);
  cerrarComoMandar();
  if(navigator.share){
    navigator.share({ title: 'Balance de ' + nom, text: String(texto || '') })
      .catch(function(){});
    return;
  }
  avisoGrande('\ud83d\udccb Este tel\u00e9fono no tiene el men\u00fa de compartir, pero copi\u00e9 el mensaje.');
}

// ── LA PANTALLA QUE OFRECE LAS CUATRO ──
// Sale al tocar cualquier botón de mandar. Enseña el mensaje para que lo lea antes.

// 📤 Mandarle su balance sin venderle nada.  (3 sep 2026)
// Sensei: "¿cómo puedo enviar el mensaje de balance a un cliente aunque no le esté
// vendiendo en ese momento?".  completo=1 → el estado de cuenta; 0 → el corto.
function imprimirFacturaBT(vid){
  ventas = LS('nv', []);
  clientes = LS('ncl', []);
  var v = ventas.find(function(x){ return String(x.id)===String(vid); });
  if(!v) return;
  var cl = clientes.find(function(c){ return String(c.id)===String(v.cid); });
  var pagado = v.tipo==='credito' ? (v.pagosFactura ? (v.pagosFactura || []).filter(function(p){return typeof p.monto==='number';}).reduce(function(s,p){return s+p.monto;},0) : 0) : v.total;
  pagado = cobradoYDebeDe(v).cobrado;
  var saldo = cobradoYDebeDe(v).debe;
  var numFact = v.numFactura || String(v.id).slice(-6);

  // Construir texto formateado para ESC POS de 32 caracteres (58mm)
  function pad(str, len){ return (str+'').substring(0,len)+Array(Math.max(0,len-(str+'').length)+1).join(' '); }
  function padRight(str, len){ return Array(Math.max(0,len-(str+'').length)+1).join(' ')+(str+'').substring(0,len); }
  function linea(izq, der){ var esp=32-izq.length-der.length; return izq+Array(Math.max(1,esp)+1).join(' ')+der; }

  var lineas = [];
  lineas.push('================================');
  lineas.push('     NUNEZ BEAUTY SUPPLY        ');
  lineas.push('  964 Atwells Ave Providence RI ');
  lineas.push('        401-305-0188            ');
  lineas.push('================================');
  lineas.push('Fac #'+numFact+'  '+v.fecha+'  '+v.hora);
  if(cl && cl.tipoNegocio && cl.tipoNegocio !== 'Barberia' && cl.negocio){
    lineas.push(cl.negocio.substring(0,32));
    lineas.push(v.cn.substring(0,32));
  } else {
    lineas.push(v.cn.substring(0,32));
    if(cl&&cl.negocio) lineas.push(cl.negocio.substring(0,32));
  }
  lineas.push('--------------------------------');
  (v.items || []).forEach(function(it){
    // Antes se cortaba el nombre a la fuerza a 32 caracteres con substring, perdiendo partes
    // importantes como "700ml"/"220ml" que distinguen productos con el mismo nombre base.
    // Ahora se envuelve en varias lineas completas, sin perder ninguna palabra.
    var palabras = (it.nombre||'').split(' ');
    var lineaActual = '';
    palabras.forEach(function(palabra){
      if((lineaActual+' '+palabra).trim().length <= 32){
        lineaActual = (lineaActual+' '+palabra).trim();
      } else {
        if(lineaActual) lineas.push(lineaActual);
        lineaActual = palabra;
      }
    });
    if(lineaActual) lineas.push(lineaActual);
    var cant = ' '+it.cant+' x $'+fmtNum(it.precio);
    var tot = '$'+fmtNum(it.cant*it.precio);
    lineas.push(linea(cant, tot));
  });
  lineas.push('--------------------------------');
  lineas.push(linea('TOTAL:','$'+fmtNum(v.total)));
  if(v.pagosFactura) (v.pagosFactura || []).filter(function(p){return p.monto>0;}).forEach(function(p){
    lineas.push(linea('Abono '+(p.fecha||''),'$'+fmtNum(p.monto)));
  });
  lineas.push(linea('BALANCE:','$'+fmtNum(saldo)));
  lineas.push('================================');
  lineas.push('  Gracias por su preferencia    ');
  // Espacio extra al final para que el corte de la impresora no quede al ras del texto
  lineas.push('');lineas.push('');lineas.push('');lineas.push('');lineas.push('');lineas.push('');lineas.push('');lineas.push('');lineas.push('');lineas.push('');

  var texto = lineas.join('\n');

  // Usar Web Share API para enviar texto a ESC POS Print Service
  if(navigator.share){
    navigator.share({
      title: 'Factura #'+numFact,
      text: texto
    }).catch(function(err){
      // Si el usuario cancela, no hacer nada
      console.log('Share cancelado:', err.message);
    });
  } else {
    // Fallback: mostrar factura e imprimir
    verFacturaProfesional(vid);
    setTimeout(function(){ window.print(); }, 800);
  }
}


function imprimirFacturaDiseno(vid){
  ventas = LS('nv', []);
  clientes = LS('ncl', []);
  var v = ventas.find(function(x){ return String(x.id)===String(vid); });
  if(!v) return;
  var cl = clientes.find(function(c){ return String(c.id)===String(v.cid); });
  var pagado = v.tipo==='credito' ? (v.pagosFactura ? (v.pagosFactura || []).filter(function(p){return typeof p.monto==='number';}).reduce(function(s,p){return s+p.monto;},0) : 0) : v.total;
  pagado = cobradoYDebeDe(v).cobrado;
  var saldo = cobradoYDebeDe(v).debe;
  var numFact = v.numFactura || String(v.id).slice(-6);

  conLogoListo(function(){
    conFirmaLista(v, function(){
    var canvas = generarFacturaCanvas(v, cl, pagado, saldo, numFact, false);

    canvas.toBlob(function(blob){
      if(!blob) return;
      var file;
      try{ file = new File([blob], 'factura-'+numFact+'.png', {type:'image/png'}); }catch(e){ file = null; }

      if(file && navigator.canShare && navigator.canShare({files:[file]})){
        navigator.share({ files:[file], title:'Factura #'+numFact }).catch(function(err){ console.log('Compartir cancelado:', err && err.message); });
      } else {
        // Respaldo: abrir la imagen para guardarla/compartirla manualmente
        var url = URL.createObjectURL(blob);
        window.open(url, '_blank');
      }
    }, 'image/png');
    });
  });
}

function compartirFactura(vid){
  ventas = LS('nv', []);
  clientes = LS('ncl', []);
  var v = ventas.find(function(x){ return String(x.id)===String(vid); });
  if(!v) return;
  var cl = clientes.find(function(c){ return String(c.id)===String(v.cid); });
  var pagado = v.tipo==='credito' ? (v.pagosFactura ? (v.pagosFactura || []).filter(function(p){return typeof p.monto==='number';}).reduce(function(s,p){return s+p.monto;},0) : 0) : v.total;
  pagado = cobradoYDebeDe(v).cobrado;
  var saldo = cobradoYDebeDe(v).debe;
  var numFact = v.numFactura || String(v.id).slice(-6);

  conLogoListo(function(){
    conFirmaLista(v, function(){
    // Imagen a color (igual al diseño de la vista Ver) para enviar al cliente por WhatsApp/email
    var canvas = generarFacturaCanvas(v, cl, pagado, saldo, numFact, true);

    canvas.toBlob(function(blob){
      if(!blob) return;
      var file;
      try{ file = new File([blob], 'factura-'+numFact+'.png', {type:'image/png'}); }catch(e){ file = null; }

      if(file && navigator.canShare && navigator.canShare({files:[file]})){
        navigator.share({ files:[file], title:'Factura #'+numFact+' - '+v.cn }).catch(function(err){ console.log('Compartir cancelado:', err && err.message); });
      } else {
        // Respaldo: texto plano si el navegador no soporta compartir imagenes
        var lineas = ['NUNEZ BEAUTY SUPPLY','964 Atwells Ave, Providence, RI 02909','401-305-0188','------------------------','FACTURA #'+numFact,'Fecha: '+v.fecha+' '+v.hora,'Cliente: '+v.cn];
        if(cl&&cl.negocio) lineas.push('Negocio: '+cl.negocio);
        lineas.push('------------------------');
        (v.items || []).forEach(function(it){ lineas.push(it.nombre); lineas.push('  '+it.cant+' x $'+fmtNum(it.precio)+' = $'+fmtNum(it.cant*it.precio)); });
        lineas.push('------------------------');
        lineas.push('TOTAL: $'+fmtNum(v.total));
        lineas.push(esSaldoPendiente(saldo)?'Balance pendiente: $'+fmtNum(saldo):'PAGADO COMPLETO');
        lineas.push('------------------------');
        lineas.push('Gracias por su preferencia');
        var texto = lineas.join('\n');
        if(navigator.share){
          navigator.share({ title: 'Factura #'+numFact+' - '+v.cn, text: texto }).catch(function(){});
        } else {
          window.location.href = 'mailto:?subject=Factura%20%23'+numFact+'%20-%20'+encodeURIComponent(v.cn)+'&body='+encodeURIComponent(texto);
        }
      }
    }, 'image/png');
    });
  });
}


// ═══════════════════════════════════════════════════════════════════
//  💵 LOS PAGOS, DENTRO DE LA FACTURA  (15 ago 2026)
//
//  🔑 SENSEI: "no encuentro la forma de editar un pago que me hicieron
//  y que por error puse la cantidad completa y la factura se saldó, y
//  como está saldada NO APARECE EN CUENTAS POR COBRAR, que era por
//  donde se podía entrar para editar el pago... necesito que se pueda
//  editar desde donde se entra a la factura".
//
//  Tenía razón: editar un pago solo se podía desde Cuentas por Cobrar
//  -y una factura SALDADA no sale ahí- o buscándola en el historial.
//  Si se equivocaba en el monto, la factura quedaba trancada.
//
//  Ahora los pagos salen DENTRO del editor de la factura, con su
//  lápiz y su papelera, usando el editor que ya existía.
// ═══════════════════════════════════════════════════════════════════
function imprimirFactura(v){
  var pagado = v.tipo==='credito' ? (v.pagosFactura ? (v.pagosFactura || []).filter(function(p){return typeof p.monto==='number';}).reduce(function(s,p){return s+p.monto;},0) : 0) : v.total;
  pagado = cobradoYDebeDe(v).cobrado;
  var saldo = cobradoYDebeDe(v).debe;
  var items = (v.items && (v.items || []).length) ? (v.items || []).map(function(it){
    return '<tr><td style="padding:8px;border-bottom:1px solid #eee">'+escaparHtml(it.nombre)+'</td>'
      +'<td style="padding:8px;border-bottom:1px solid #eee;text-align:center">'+it.cant+'</td>'
      +'<td style="padding:8px;border-bottom:1px solid #eee;text-align:right">$'+fmtNum(it.precio)+'</td>'
      +'<td style="padding:8px;border-bottom:1px solid #eee;text-align:right">$'+fmtNum(it.cant*it.precio)+'</td></tr>';
  }).join('') : '';
  var overlay = document.getElementById('print-overlay');
  if(!overlay){
    overlay = document.createElement('div');
    overlay.id = 'print-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:white;z-index:99999;overflow-y:auto;padding:20px';
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = '<button onclick="document.getElementById(\'print-overlay\').style.display=\'none\'" style="margin-bottom:16px;padding:10px 20px;background:#1565C0;color:white;border:none;border-radius:8px;cursor:pointer;font-size:14px">← Volver</button>'
    +'<div style="max-width:600px;margin:0 auto;font-family:sans-serif">'
    +'<div style="background:#1a237e;color:white;padding:24px;text-align:center;border-radius:8px 8px 0 0">'
    +'<div style="font-size:22px;font-weight:800">✂️ Nunez Beauty Supply</div>'
    +'<div style="font-size:12px;opacity:0.7;margin-top:4px">964 Atwells Ave, Providence, Rhode Island 02909</div>'
    +'<div style="font-size:12px;opacity:0.7;margin-top:2px">401-305-0188</div>'
    +'</div>'
    +'<div style="border:1px solid #eee;padding:20px">'
    +'<h2 style="margin-bottom:16px;font-size:18px">Factura</h2>'
    +'<div style="display:flex;justify-content:space-between;margin-bottom:8px"><span style="color:#777">Fecha</span><span>'+v.fecha+' '+v.hora+'</span></div>'
    +'<div style="display:flex;justify-content:space-between;margin-bottom:8px"><span style="color:#777">Cliente</span><span style="font-weight:700">'+v.cn+'</span></div>'
    +'<div style="display:flex;justify-content:space-between;margin-bottom:16px"><span style="color:#777">Tipo de pago</span><span>'+v.tipo+'</span></div>'
    +'<table style="width:100%;border-collapse:collapse;margin-bottom:16px">'
    +'<thead><tr style="background:#f5f5f5"><th style="padding:8px;text-align:left">Producto</th><th style="padding:8px;text-align:center">Cant</th><th style="padding:8px;text-align:right">Precio</th><th style="padding:8px;text-align:right">Total</th></tr></thead>'
    +'<tbody>'+items+'</tbody></table>'
    +'<div style="border-top:2px solid #1a237e;padding-top:12px">'
    +'<div style="display:flex;justify-content:space-between;font-size:18px;font-weight:800"><span>Total Factura</span><span style="color:#1565C0">$'+fmtNum(v.total)+'</span></div>'
    +(esSaldoPendiente(saldo) ? '<div style="display:flex;justify-content:space-between;margin-top:8px;color:#C62828;font-weight:700"><span>Balance Pendiente</span><span>$'+fmtNum(saldo)+'</span></div>' : '<div style="text-align:center;margin-top:8px;color:#2E7D32;font-weight:700;background:#E8F5E9;padding:8px;border-radius:6px">✓ PAGADO COMPLETO</div>')
    +'</div>'
    +'<div style="text-align:center;margin-top:20px;font-size:11px;color:#aaa">Gracias por su preferencia · Nunez Beauty Supply</div>'
    +'</div></div>';
  overlay.style.display = 'block'; overlay.scrollTop = 0;
}


function abrirMenuReporte(idContenedor, titulo){
  var cont = document.getElementById(idContenedor);
  if(!cont || !cont.innerHTML.trim()){ alert('No hay datos para imprimir en este reporte.'); return; }
  var limpio = cont.innerHTML
    .replace(/<button[^>]*>[\s\S]*?<\/button>/g, '')
    .replace(/<input[^>]*>/g, '');

  var overlay = document.getElementById('reporte-acciones-overlay');
  if(!overlay){
    overlay = document.createElement('div');
    overlay.id = 'reporte-acciones-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:100000;display:flex;align-items:flex-end;justify-content:center';
    document.body.appendChild(overlay);
  }
  overlay.style.display = 'flex';
  overlay.innerHTML = '';
  overlay.onclick = function(e){ if(e.target === overlay) overlay.style.display = 'none'; };

  var sheet = document.createElement('div');
  sheet.style.cssText = 'background:white;width:100%;max-width:480px;margin:0 auto;border-radius:16px 16px 0 0;padding:18px 16px 26px';
  var tit = document.createElement('div');
  tit.style.cssText = 'text-align:center;font-size:13px;color:#aaa;font-weight:700;text-transform:uppercase;margin-bottom:14px';
  tit.textContent = titulo;
  sheet.appendChild(tit);

  var opciones = [
    ['🖨️ Imprimir / Guardar PDF', '#1565C0', function(){ overlay.style.display='none'; soloImprimirReporte(titulo, limpio); }],
    ['📤 Compartir (WhatsApp, etc.)', '#2E7D32', function(){ overlay.style.display='none'; soloCompartirReporte(idContenedor, titulo); }]
  ];
  opciones.forEach(function(op){
    var btn = document.createElement('button');
    btn.textContent = op[0];
    btn.style.cssText = 'width:100%;padding:15px;margin-bottom:10px;background:'+op[1]+';color:white;border:none;border-radius:10px;font-size:16px;font-weight:700;cursor:pointer';
    btn.onclick = op[2];
    sheet.appendChild(btn);
  });
  var cancelar = document.createElement('button');
  cancelar.textContent = 'Cancelar';
  cancelar.style.cssText = 'width:100%;padding:13px;background:#F0F0F2;color:#555;border:none;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer';
  cancelar.onclick = function(){ overlay.style.display='none'; };
  sheet.appendChild(cancelar);
  overlay.appendChild(sheet);
}

// SOLO imprime (abre la ventana de impresion / guardar PDF). No comparte.
function soloImprimirReporte(titulo, contenidoHTML){
  imprimirReporteVisual(titulo, contenidoHTML);
}

// SOLO comparte: arma un TEXTO legible con el contenido real del reporte (no un letrerito)
// y lo manda por el menu del telefono (WhatsApp, email, etc.).
function soloCompartirReporte(idContenedor, titulo){
  var cont = document.getElementById(idContenedor);
  if(!cont){ alert('No hay datos para compartir.'); return; }
  // Convertir el HTML del reporte a texto plano legible
  var tmp = document.createElement('div');
  tmp.innerHTML = cont.innerHTML.replace(/<button[^>]*>[\s\S]*?<\/button>/g, '').replace(/<input[^>]*>/g, '');
  var texto = (tmp.innerText || tmp.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
  var encabezado = titulo + ' — NBS\n' + new Date().toLocaleDateString('es-US') + '\n\n';
  var mensaje = encabezado + texto;
  if(navigator.share){
    navigator.share({ title: titulo + ' — NBS', text: mensaje }).catch(function(){});
  } else {
    // Respaldo: copiar al portapapeles
    try{ navigator.clipboard.writeText(mensaje); alert('Reporte copiado. Pégalo donde quieras compartirlo.'); }
    catch(e){ alert('Tu navegador no permite compartir directamente.'); }
  }
}

// Version visual del reporte SOLO para imprimir (sin compartir). Reusa el mismo diseno.
function imprimirReporteVisual(titulo, contenidoHTML){
  var hoy = new Date().toLocaleDateString('es-US');
  var estilos = '<style>'
    + '@page { size: letter; margin: 12mm; }'
    + '* { box-sizing: border-box; }'
    + 'body { font-family: -apple-system, Arial, sans-serif; color:#222; margin:0; padding:0; width:100%; }'
    + '.rep-cab { text-align:center; border-bottom:2px solid #D4A017; padding-bottom:8px; margin-bottom:14px; }'
    + '.rep-cab h1 { font-size:22px; color:#1a237e; margin:0 0 3px; }'
    + '.rep-cab .sub { font-size:12px; color:#666; margin:0; }'
    + '.rep-cuerpo > div { width:100% !important; max-width:100% !important; page-break-inside:avoid; }'
    + '.rep-cuerpo table { width:100%; border-collapse:collapse; }'
    + '.rep-cuerpo { font-size:13px; }'
    + '</style>';
  var html = estilos
    + '<div class="rep-cab"><h1>'+titulo+' — NBS</h1>'
    + '<p class="sub">Generado el '+hoy+' · Nunez Beauty Supply</p></div>'
    + '<div class="rep-cuerpo">'+contenidoHTML+'</div>';
  var vent = window.open('', '_blank');
  if(!vent){ alert('Permite las ventanas emergentes para imprimir el reporte.'); return; }
  vent.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>'+titulo+' NBS</title></head><body>'+html+'</body></html>');
  vent.document.close();
  setTimeout(function(){ try{ vent.focus(); vent.print(); }catch(e){} }, 400);
}

function imprimirReporte(titulo, contenidoHTML, resumenTexto){
  var hoy = new Date().toLocaleDateString('es-US');

  // Estilos compactos que usan todo el ancho de la hoja carta
  var estilos = '<style>'
    + '@page { size: letter; margin: 12mm; }'
    + '* { box-sizing: border-box; }'
    + 'body { font-family: -apple-system, Arial, sans-serif; color:#222; margin:0; padding:0; width:100%; }'
    + '.rep-cab { text-align:center; border-bottom:2px solid #D4A017; padding-bottom:8px; margin-bottom:14px; }'
    + '.rep-cab h1 { font-size:22px; color:#1a237e; margin:0 0 3px; }'
    + '.rep-cab .sub { font-size:12px; color:#666; margin:0; }'
    + '.rep-cuerpo > div { width:100% !important; max-width:100% !important; page-break-inside:avoid; }'
    + '.rep-cuerpo table { width:100%; border-collapse:collapse; }'
    + '.rep-cuerpo { font-size:13px; }'
    + '</style>';

  var html = estilos
    + '<div class="rep-cab"><h1>'+titulo+' — NBS</h1>'
    + '<p class="sub">Generado el '+hoy+' · Nunez Beauty Supply</p></div>'
    + '<div class="rep-cuerpo">'+contenidoHTML+'</div>';

  // Compartir el resumen en texto por el menú del teléfono (si se dio uno)
  if(resumenTexto && navigator.share){
    navigator.share({ title: titulo + ' — NBS', text: resumenTexto }).catch(function(){});
  }

  // Abrir el reporte visual para imprimir o guardar como PDF
  var vent = window.open('', '_blank');
  if(!vent){
    if(!(resumenTexto && navigator.share)) alert('Permite las ventanas emergentes para imprimir el reporte.');
    return;
  }
  vent.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>'+titulo+' NBS</title></head><body>'+html+'</body></html>');
  vent.document.close();
  setTimeout(function(){ try{ vent.focus(); vent.print(); }catch(e){} }, 400);
}

// Botón estándar de imprimir/compartir para poner en los reportes
function botonImprimirReporte(funcionOnclick){
  return '<button class="btn" style="width:100%;background:#1a237e;color:white;margin-top:14px;padding:12px" onclick="'+funcionOnclick+'">🖨️ Imprimir / Compartir este reporte</button>';
}

// Imprime/comparte el contenido de una pantalla por el id de su contenedor.
// Sirve para Dashboard, Inventario, CxC, CxP, VIP, Gastos, etc.
function imprimirPantalla(idContenedor, titulo){
  var cont = document.getElementById(idContenedor);
  if(!cont || !cont.innerHTML.trim()){ alert('No hay datos para imprimir en este reporte.'); return; }
  // Quitar botones y controles del contenido a imprimir (no tiene sentido imprimirlos)
  var limpio = cont.innerHTML
    .replace(/<button[^>]*>[\s\S]*?<\/button>/g, '')
    .replace(/<input[^>]*>/g, '');
  imprimirReporte(titulo, limpio, titulo + ' — NBS');
}

// Imprime el reporte de inventario: junta el resumen (totales) con la lista de productos
function imprimirReporteInventario(){
  var resumen = document.getElementById('inv-resumen');
  var lista = document.getElementById('invlista');
  if(!resumen || !resumen.innerHTML.trim()){ alert('No hay datos de inventario para imprimir.'); return; }
  var contenido = '<div style="margin-bottom:14px">' + resumen.innerHTML + '</div>';
  if(lista && lista.innerHTML.trim()){
    contenido += '<div>' + lista.innerHTML.replace(/<button[^>]*>[\s\S]*?<\/button>/g, '') + '</div>';
  }
  imprimirReporte('Reporte de Inventario', contenido, 'Reporte de Inventario — NBS');
}

// Imprime el reporte de gastos: junta el resumen con la lista de gastos
function imprimirReporteGastos(){
  var resumen = document.getElementById('gastos-resumen');
  var lista = document.getElementById('glista');
  var contenido = '';
  if(resumen && resumen.innerHTML.trim()) contenido += '<div style="margin-bottom:14px">' + resumen.innerHTML + '</div>';
  if(lista && lista.innerHTML.trim()) contenido += '<div>' + lista.innerHTML.replace(/<button[^>]*>[\s\S]*?<\/button>/g, '') + '</div>';
  if(!contenido){ alert('No hay gastos para imprimir.'); return; }
  imprimirReporte('Reporte de Gastos', contenido, 'Reporte de Gastos — NBS');
}

// ═══════════════════════════════════════════════════════════════════
//  📊 LOS 7 REPORTES  (8 sep 2026)
//
//  Sensei pidió el de producto por fechas, y un análisis dijo qué más le faltaba.
//  El hallazgo más gordo: 246 productos con stock sin vender en 60 días — $26.355
//  de su dinero dormido, el 42% de su inventario.
//
//  🔑 TODO SE CUENTA DESDE LAS FACTURAS, que es el registro de verdad.
// ═══════════════════════════════════════════════════════════════════

var _rangoRep = { desde: null, hasta: null };

// El rango por defecto: los últimos 3 meses
function _rangoPorDefecto(){
  if(_rangoRep.desde) return;
  var h = new Date();
  var d = new Date(h.getFullYear(), h.getMonth() - 3, h.getDate());
  var iso = function(x){
    var m = x.getMonth() + 1, dd = x.getDate();
    return x.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (dd < 10 ? '0' : '') + dd;
  };
  _rangoRep.desde = iso(d);
  _rangoRep.hasta = iso(h);
}

function _aFechaApp2(iso){
  var p = String(iso || '').split('-');
  return p.length === 3 ? (p[1] + '/' + p[2] + '/' + p[0]) : '';
}

// Las ventas del rango, ya filtradas. Todo lo demás se calcula de aquí.
function _ventasDelRango(){
  _rangoPorDefecto();
  var d = parsearFechaVenta(_aFechaApp2(_rangoRep.desde));
  var h = parsearFechaVenta(_aFechaApp2(_rangoRep.hasta));
  var dN = d ? d.getTime() : 0;
  var hN = h ? h.getTime() + 86399000 : Infinity;
  return LS('nv', []).filter(function(v){
    if(v.cancelada) return false;
    var f = parsearFechaVenta(v.fecha);
    return f && f.getTime() >= dN && f.getTime() <= hN;
  });
}

// El armazón que comparten todos: cabecera, fechas y atajos
function _cajaReporte(titulo, cuerpo, extra){
  var ov = document.getElementById('reporte-overlay');
  if(!ov){
    ov = document.createElement('div');
    ov.id = 'reporte-overlay';
    document.body.appendChild(ov);
  }
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.62);z-index:100005;'
    + 'display:flex;align-items:flex-end;justify-content:center';
  ov.onclick = function(e){ if(e.target === ov) cerrarReporte(); };
  // \ud83d\udd11 La ventana NO cambia de tama\u00f1o al escribir: si creciera, arrastrar\u00eda el
  // campo hacia arriba y se le escapar\u00eda a Sensei mientras teclea. -8 sep-
  ov.innerHTML = '<div style="background:#fff;width:100%;max-width:540px;'
    + 'border-radius:16px 16px 0 0;padding:15px;max-height:92vh;overflow:auto">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">'
    +   '<div style="font-size:16px;font-weight:900;color:var(--nbs-ink)">' + titulo + '</div>'
    +   '<button onclick="cerrarReporte()" style="background:#F0F0F2;border:none;border-radius:9px;'
    +     'width:34px;height:34px;font-size:16px;cursor:pointer">\u2715</button>'
    + '</div>'
    + (extra === 'sinFechas' ? '' : _cajaFechas())
    + '<div id="rep-cuerpo">' + cuerpo + '</div>'
    + '<button onclick="cerrarReporte()" style="width:100%;padding:12px;margin-top:10px;'
    +   'background:#F0F0F2;color:#333;border:none;border-radius:10px;font-size:13px;'
    +   'font-weight:700;cursor:pointer">Cerrar</button>'
    + '</div>';
  ov.style.display = 'flex';
}

function _cajaFechas(){
  _rangoPorDefecto();
  return '<div style="display:flex;gap:8px;margin-bottom:7px">'
    + '<div style="flex:1"><div style="font-size:10px;font-weight:800;color:#555">DESDE</div>'
    +   '<input type="date" value="' + _rangoRep.desde + '" onchange="cambiarRangoRep(\'desde\',this.value)" '
    +   'style="width:100%;padding:7px;border:1px solid #ccc;border-radius:7px;font-size:12px"></div>'
    + '<div style="flex:1"><div style="font-size:10px;font-weight:800;color:#555">HASTA</div>'
    +   '<input type="date" value="' + _rangoRep.hasta + '" onchange="cambiarRangoRep(\'hasta\',this.value)" '
    +   'style="width:100%;padding:7px;border:1px solid #ccc;border-radius:7px;font-size:12px"></div>'
    + '</div>'
    + '<div style="display:flex;gap:4px;margin-bottom:11px">'
    + ['mes|Este mes','mespasado|Mes pasado','ano|Este a\u00f1o','todo|Todo'].map(function(x){
        var p = x.split('|');
        return '<button onclick="atajoRangoRep(\'' + p[0] + '\')" style="flex:1;padding:6px 2px;'
          + 'background:#fff;color:#1a237e;border:1px solid #b9bfe0;border-radius:6px;'
          + 'font-size:10px;font-weight:700;cursor:pointer">' + p[1] + '</button>';
      }).join('')
    + '</div>';
}

function cambiarRangoRep(cual, v){
  _rangoRep[cual] = v;
  if(window._repActual) window._repActual();
}

function atajoRangoRep(cual){
  var h = new Date();
  var iso = function(x){
    var m = x.getMonth() + 1, d = x.getDate();
    return x.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (d < 10 ? '0' : '') + d;
  };
  if(cual === 'mes'){ _rangoRep.desde = iso(new Date(h.getFullYear(), h.getMonth(), 1)); _rangoRep.hasta = iso(h); }
  else if(cual === 'mespasado'){
    _rangoRep.desde = iso(new Date(h.getFullYear(), h.getMonth() - 1, 1));
    _rangoRep.hasta = iso(new Date(h.getFullYear(), h.getMonth(), 0));
  }
  else if(cual === 'ano'){ _rangoRep.desde = iso(new Date(h.getFullYear(), 0, 1)); _rangoRep.hasta = iso(h); }
  else { _rangoRep.desde = '2020-01-01'; _rangoRep.hasta = iso(h); }
  if(window._repActual) window._repActual();
}

function cerrarReporte(){
  var ov = document.getElementById('reporte-overlay');
  if(ov) ov.style.display = 'none';
  window._repActual = null;
}

// Tres números grandes, que se repiten en varios reportes
function _tresNumeros(datos){
  return '<div style="display:grid;grid-template-columns:repeat(' + datos.length + ',1fr);'
    + 'gap:6px;margin-bottom:12px">'
    + datos.map(function(d){
        return '<div style="background:' + d[3] + ';border-radius:10px;padding:10px;text-align:center">'
          + '<div style="font-size:9.5px;font-weight:800;color:' + d[2] + '">' + d[0] + '</div>'
          + '<div style="font-size:17px;font-weight:900;color:' + d[2] + '">' + d[1] + '</div></div>';
      }).join('')
    + '</div>';
}


// ═══ ① CUÁNTO VENDÍ DE UN PRODUCTO ═══════════════════════════════
// El que pidió Sensei: buscar un producto, elegir fechas, y ver cuánto vendió.
function abrirRepProducto(){
  window._repProdElegido = window._repProdElegido || null;
  window._repActual = pintarRepProducto;
  pintarRepProducto();
}

// La lista de productos que coinciden. Aparte, para poder repintarla sola.  (8 sep)
function _listaProdRep(){
  loadProds();
  var q = (window._repProdBusca || '').toLowerCase().trim();
  if(!q){
    // Ocupa parecido a la lista, para que la ventana no d\u00e9 un salto al escribir la
    // primera letra
    return '<div style="background:#F4F6FB;border-radius:10px;padding:34px 20px;'
      + 'text-align:center;font-size:13px;color:var(--nbs-muted)">'
      + 'Escribe el nombre del producto que quieres mirar.</div>';
  }
  var hallados = productos.filter(function(p){
    return !p.eliminado && (p.nombre || '').toLowerCase().indexOf(q) >= 0;
  }).slice(0, 12);
  if(!hallados.length){
    return '<div style="padding:18px;text-align:center;color:var(--nbs-muted);font-size:13px">'
      + 'No encontr\u00e9 ning\u00fan producto con eso.</div>';
  }
  return hallados.map(function(p){
    return '<div onclick="elegirProdRep(' + _arg(String(p.id)) + ')" '
      + 'style="padding:11px;border:1px solid #E4E4EC;border-radius:9px;margin-bottom:6px;'
      + 'cursor:pointer;font-size:13px;font-weight:700">' + escaparHtml(p.nombre)
      + (p.marca ? '<div style="font-size:10.5px;color:var(--nbs-muted);font-weight:600">'
                  + escaparHtml(p.marca) + '</div>' : '')
      + '</div>';
  }).join('');
}

function pintarRepProducto(){
  loadProds();
  var q = (window._repProdBusca || '').toLowerCase().trim();
  var cuerpo = '<input id="rep-buscar-prod" value="' + escaparHtml(window._repProdBusca || '') + '" '
    + 'placeholder="\ud83d\udd0d Buscar el producto..." oninput="buscarProdRep(this.value)" '
    + 'style="width:100%;padding:11px;border:1.5px solid #ccc;border-radius:9px;font-size:14px;'
    + 'margin-bottom:9px">';

  if(!window._repProdElegido){
    // \ud83d\udd11 La lista tiene ALTO FIJO y hace scroll dentro: as\u00ed la ventana no crece al
    // salir los resultados, y el campo de escribir NO SE MUEVE. -8 sep-
    cuerpo += '<div id="rep-resultados" style="height:44vh;overflow-y:auto;'
      + '-webkit-overflow-scrolling:touch">' + _listaProdRep() + '</div>';
  } else {
    var p = productos.find(function(x){ return String(x.id) === String(window._repProdElegido); });
    if(p){
      var uds = 0, plata = 0, gan = 0, porCli = {};
      _ventasDelRango().forEach(function(v){
        (v.items || []).forEach(function(it){
          if(String(it.pid) !== String(p.id)) return;
          var c = Number(it.cant) || 0;
          uds += c;
          plata += c * (parseFloat(it.precio) || 0);
          gan += c * ((parseFloat(it.precio) || 0) - (parseFloat(it.costo) || 0));
          var k = v.cn || String(v.cid);
          porCli[k] = (porCli[k] || 0) + c;
        });
      });
      var quienes = Object.keys(porCli).sort(function(a, b){ return porCli[b] - porCli[a]; });
      cuerpo += '<div style="background:#FFF8E1;border:1.5px solid #FFD54F;border-radius:10px;'
        +   'padding:11px;margin-bottom:11px">'
        +   '<div style="font-size:14px;font-weight:900">' + escaparHtml(p.nombre) + '</div>'
        +   (p.marca ? '<div style="font-size:11px;color:#7A5C00;font-weight:700">' + escaparHtml(p.marca) + '</div>' : '')
        +   '<button onclick="elegirProdRep(null)" style="margin-top:7px;padding:6px 11px;'
        +     'background:#fff;border:1px solid #E0C070;border-radius:7px;font-size:11px;'
        +     'font-weight:700;cursor:pointer">\ud83d\udd04 Buscar otro</button>'
        + '</div>'
        + _tresNumeros([
            ['VENDISTE', uds + ' u.', '#1565C0', '#E3F2FD'],
            ['COBRASTE', '$' + fmtNum(plata), '#2E7D32', '#E8F5E9'],
            ['TE DEJ\u00d3', '$' + fmtNum(gan), '#E65100', '#FFF3E0']
          ]);
      if(quienes.length){
        cuerpo += '<div style="font-size:11px;font-weight:800;color:#555;margin-bottom:6px">'
          + 'QUI\u00c9N LO COMPR\u00d3 \u00b7 ' + quienes.length + ' cliente(s)</div>'
          + quienes.slice(0, 15).map(function(k){
              return '<div style="display:flex;justify-content:space-between;padding:6px 0;'
                + 'border-bottom:1px solid #F4F4F8;font-size:12.5px">'
                + '<span>' + escaparHtml(k) + '</span>'
                + '<b>' + porCli[k] + '</b></div>';
            }).join('');
      } else {
        cuerpo += '<div style="padding:16px;text-align:center;color:var(--nbs-muted);font-size:13px">'
          + 'No vendiste nada de este producto en esas fechas.</div>';
      }
    }
  }
  _cajaReporte('\ud83d\udcca Cu\u00e1nto vend\u00ed de\u2026', cuerpo);
}

// \ud83d\udd11 SOLO SE REPINTA LA LISTA, no la pantalla entera. Si se repintara todo, el
// campo de escribir se destruir\u00eda con cada letra y el teclado se cerrar\u00eda y abrir\u00eda:
// eso era el "pesta\u00f1eo" que report\u00f3 Sensei. -8 sep-
function buscarProdRep(v){
  window._repProdBusca = v;
  window._repProdElegido = null;
  var caja = document.getElementById('rep-resultados');
  if(caja) caja.innerHTML = _listaProdRep();
  else pintarRepProducto();
}

function elegirProdRep(id){
  window._repProdElegido = id;
  pintarRepProducto();
}


// ═══ ② DINERO DORMIDO ════════════════════════════════════════════
// 🔑 EL MÁS VALIOSO. En sus datos: 246 productos con stock sin vender en 60 días,
// $26.355 parados — el 42% de su inventario.
function abrirRepDormido(){
  window._repActual = null;
  loadProds();
  var dias = window._repDiasDormido || 60;
  var corte = Date.now() - dias * 86400000;
  var vendidos = {};
  LS('nv', []).forEach(function(v){
    if(v.cancelada) return;
    var f = parsearFechaVenta(v.fecha);
    if(!f || f.getTime() < corte) return;
    (v.items || []).forEach(function(it){ if(it.pid) vendidos[String(it.pid)] = true; });
  });
  var parados = productos.filter(function(p){
    return !p.eliminado && (p.stock || 0) > 0 && !vendidos[String(p.id)]
        && !/balance inicial/i.test(p.nombre || '');
  }).map(function(p){
    return { n: p.nombre || '', m: p.marca || '', stock: p.stock || 0,
             costo: parseFloat(p.costo) || 0,
             plata: (p.stock || 0) * (parseFloat(p.costo) || 0) };
  }).sort(function(a, b){ return b.plata - a.plata; });

  var total = parados.reduce(function(a, x){ return a + x.plata; }, 0);
  var invTotal = productos.filter(function(p){ return !p.eliminado; })
    .reduce(function(a, p){ return a + (p.stock || 0) * (parseFloat(p.costo) || 0); }, 0);
  var pct = invTotal > 0 ? Math.round(total / invTotal * 100) : 0;

  var cuerpo = '<div style="display:flex;gap:5px;margin-bottom:11px">'
    + [30, 60, 90, 180].map(function(d){
        return '<button onclick="window._repDiasDormido=' + d + ';abrirRepDormido()" '
          + 'style="flex:1;padding:7px 2px;background:' + (d === dias ? '#1a237e' : '#fff') + ';'
          + 'color:' + (d === dias ? '#fff' : '#1a237e') + ';border:1px solid #b9bfe0;'
          + 'border-radius:7px;font-size:11px;font-weight:700;cursor:pointer">' + d + ' d\u00edas</button>';
      }).join('')
    + '</div>'
    + '<div style="background:#FFEBEE;border:1.5px solid #EF9A9A;border-radius:11px;padding:13px;'
    +   'margin-bottom:12px;text-align:center">'
    +   '<div style="font-size:11px;font-weight:800;color:#C62828">DINERO DORMIDO</div>'
    +   '<div style="font-size:27px;font-weight:900;color:#C62828">$' + fmtNum(total) + '</div>'
    +   '<div style="font-size:12px;color:#C62828;margin-top:3px">'
    +     parados.length + ' producto(s) sin venderse en ' + dias + ' d\u00edas'
    +     '<br>es el <b>' + pct + '%</b> de tu inventario</div>'
    + '</div>';

  cuerpo += parados.length
    ? '<div style="font-size:11px;font-weight:800;color:#555;margin-bottom:6px">'
      + 'LO QUE M\u00c1S PLATA TIENE PARADA</div>'
      + parados.slice(0, 25).map(function(x){
          return '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;'
            + 'padding:8px 0;border-bottom:1px solid #F4F4F8">'
            + '<div style="flex:1;min-width:0">'
            +   '<div style="font-size:12.5px;font-weight:700">' + escaparHtml(x.n) + '</div>'
            +   '<div style="font-size:10.5px;color:var(--nbs-muted)">' + x.stock + ' en stock'
            +     (x.m ? ' \u00b7 ' + escaparHtml(x.m) : '') + '</div>'
            + '</div>'
            + '<div style="font-size:13px;font-weight:900;color:#C62828">$' + fmtNum(x.plata) + '</div>'
            + '</div>';
        }).join('')
      + (parados.length > 25 ? '<div style="font-size:11px;color:var(--nbs-muted);text-align:center;'
          + 'padding:8px">y ' + (parados.length - 25) + ' m\u00e1s\u2026</div>' : '')
    : '<div style="padding:20px;text-align:center;color:#2E7D32;font-size:14px;font-weight:700">'
      + '\ud83c\udf89 Todo lo que tienes en stock se ha vendido en estos ' + dias + ' d\u00edas.</div>';

  _cajaReporte('\ud83d\udc80 Dinero dormido', cuerpo, 'sinFechas');
}


// ═══ ③ MES A MES ═════════════════════════════════════════════════
function abrirRepMeses(){
  window._repActual = null;
  var meses = {};
  LS('nv', []).forEach(function(v){
    if(v.cancelada) return;
    var f = parsearFechaVenta(v.fecha);
    if(!f) return;
    var k = f.getFullYear() + '-' + (f.getMonth() < 9 ? '0' : '') + (f.getMonth() + 1);
    if(!meses[k]) meses[k] = { vend: 0, gan: 0, n: 0 };
    meses[k].vend += (typeof dinero === 'function') ? dinero(v.total) : (parseFloat(v.total) || 0);
    meses[k].gan += parseFloat(v.ganancia) || 0;
    meses[k].n++;
  });
  var claves = Object.keys(meses).sort().reverse();
  var NOM = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto',
             'septiembre','octubre','noviembre','diciembre'];
  var maxV = Math.max.apply(null, claves.map(function(k){ return meses[k].vend; }).concat([1]));

  var cuerpo = claves.map(function(k, i){
    var m = meses[k];
    var p = k.split('-');
    var antes = claves[i + 1] ? meses[claves[i + 1]].vend : 0;
    var sube = antes > 0 ? Math.round((m.vend - antes) / antes * 100) : null;
    return '<div style="padding:11px;border:1px solid #E4E4EC;border-radius:10px;margin-bottom:7px">'
      + '<div style="display:flex;justify-content:space-between;align-items:flex-start">'
      +   '<div><div style="font-size:13.5px;font-weight:900;text-transform:capitalize">'
      +     NOM[parseInt(p[1], 10) - 1] + ' ' + p[0] + '</div>'
      +     '<div style="font-size:10.5px;color:var(--nbs-muted)">' + m.n + ' factura(s)</div></div>'
      +   '<div style="text-align:right">'
      +     '<div style="font-size:16px;font-weight:900;color:#1565C0">$' + fmtNum(m.vend) + '</div>'
      +     '<div style="font-size:11px;color:#2E7D32;font-weight:700">te dej\u00f3 $' + fmtNum(m.gan) + '</div>'
      +   '</div>'
      + '</div>'
      + '<div style="height:7px;background:#EEF0F6;border-radius:4px;margin-top:7px;overflow:hidden">'
      +   '<div style="height:100%;width:' + Math.round(m.vend / maxV * 100) + '%;background:#1565C0"></div>'
      + '</div>'
      + (sube !== null
          ? '<div style="font-size:11px;font-weight:700;margin-top:5px;color:'
            + (sube >= 0 ? '#2E7D32' : '#C62828') + '">'
            + (sube >= 0 ? '\u25b2 subi\u00f3 ' : '\u25bc baj\u00f3 ') + Math.abs(sube)
            + '% contra el mes anterior</div>'
          : '')
      + '</div>';
  }).join('');

  _cajaReporte('\ud83d\udcc8 Mes a mes',
    cuerpo || '<div style="padding:20px;text-align:center;color:var(--nbs-muted)">Sin ventas todav\u00eda.</div>',
    'sinFechas');
}


// ═══ ④ POR DÍA DE LA SEMANA ══════════════════════════════════════
// En sus datos: sábado $10.985 y viernes $10.314, contra lunes $572. Sirve para
// decidir dónde poner el esfuerzo.
function abrirRepDias(){
  window._repActual = pintarRepDias;
  pintarRepDias();
}

function pintarRepDias(){
  var NOM = ['Domingo','Lunes','Martes','Mi\u00e9rcoles','Jueves','Viernes','S\u00e1bado'];
  var dias = [0,0,0,0,0,0,0], cuenta = [0,0,0,0,0,0,0];
  _ventasDelRango().forEach(function(v){
    var f = parsearFechaVenta(v.fecha);
    if(!f) return;
    var d = f.getDay();
    dias[d] += (typeof dinero === 'function') ? dinero(v.total) : (parseFloat(v.total) || 0);
    cuenta[d]++;
  });
  var max = Math.max.apply(null, dias.concat([1]));
  var total = dias.reduce(function(a, x){ return a + x; }, 0);
  var orden = [1,2,3,4,5,6,0];   // de lunes a domingo

  var cuerpo = orden.map(function(d){
    var pct = total > 0 ? Math.round(dias[d] / total * 100) : 0;
    return '<div style="margin-bottom:9px">'
      + '<div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:3px">'
      +   '<b>' + NOM[d] + '</b>'
      +   '<span><b style="color:#1565C0">$' + fmtNum(dias[d]) + '</b>'
      +     '<span style="color:var(--nbs-muted);font-size:11px"> \u00b7 ' + pct + '%</span></span>'
      + '</div>'
      + '<div style="height:11px;background:#EEF0F6;border-radius:6px;overflow:hidden">'
      +   '<div style="height:100%;width:' + Math.round(dias[d] / max * 100) + '%;'
      +     'background:' + (dias[d] === max ? '#2E7D32' : '#1565C0') + '"></div>'
      + '</div>'
      + '<div style="font-size:10px;color:var(--nbs-muted);margin-top:2px">'
      +   cuenta[d] + ' factura(s)</div>'
      + '</div>';
  }).join('');

  _cajaReporte('\ud83d\udcc5 Por d\u00eda de la semana', cuerpo);
}


// ═══ ⑤ GANANCIA REAL ═════════════════════════════════════════════
// Vendido − costo − gastos = lo que de verdad te queda. No lo tenía en ningún sitio.
function abrirRepGanancia(){
  window._repActual = pintarRepGanancia;
  pintarRepGanancia();
}

function pintarRepGanancia(){
  var V = _ventasDelRango();
  var vendido = 0, costo = 0, cobrado = 0;
  V.forEach(function(v){
    vendido += (typeof dinero === 'function') ? dinero(v.total) : (parseFloat(v.total) || 0);
    cobrado += cobradoYDebeDe(v).cobrado;
    (v.items || []).forEach(function(it){
      costo += (Number(it.cant) || 0) * (parseFloat(it.costo) || 0);
    });
  });

  // Los gastos del mismo rango
  var d = parsearFechaVenta(_aFechaApp2(_rangoRep.desde));
  var h = parsearFechaVenta(_aFechaApp2(_rangoRep.hasta));
  var dN = d ? d.getTime() : 0, hN = h ? h.getTime() + 86399000 : Infinity;
  var gastos = 0, porTipo = {};
  LS('ngastos', []).forEach(function(g){
    var f = parsearFechaVenta(g.fecha);
    if(!f || f.getTime() < dN || f.getTime() > hN) return;
    var m = (typeof dinero === 'function') ? dinero(g.monto) : (parseFloat(g.monto) || 0);
    gastos += m;
    var k = g.categoria || 'otros';
    porTipo[k] = (porTipo[k] || 0) + m;
  });

  var bruta = vendido - costo;
  var neta = bruta - gastos;
  var margen = vendido > 0 ? Math.round(neta / vendido * 100) : 0;

  var fila = function(t, v, col, gordo){
    return '<div style="display:flex;justify-content:space-between;padding:' + (gordo ? '9px' : '5px')
      + ' 0;font-size:' + (gordo ? '16px' : '13px') + ';font-weight:' + (gordo ? '900' : '600') + ';'
      + (gordo ? 'border-top:2px solid #1a237e;margin-top:5px;' : '')
      + 'color:' + (col || 'var(--nbs-ink)') + '">'
      + '<span>' + t + '</span><span>$' + fmtNum(v) + '</span></div>';
  };

  var cuerpo = '<div style="border:1px solid #E4E4EC;border-radius:11px;padding:13px;margin-bottom:11px">'
    + fila('Vendiste', vendido, '#1565C0')
    + fila('\u2212 lo que te cost\u00f3', costo, '#8A8A9E')
    + fila('= ganancia de la mercanc\u00eda', bruta, '#2E7D32')
    + fila('\u2212 gastos del negocio', gastos, '#E65100')
    + fila('TE QUEDA', neta, neta >= 0 ? '#2E7D32' : '#C62828', true)
    + '<div style="text-align:center;font-size:11.5px;color:var(--nbs-muted);margin-top:5px">'
    +   'de cada $100 que vendes, te quedan <b>$' + margen + '</b></div>'
    + '</div>'
    + '<div style="background:#F4F6FB;border-radius:10px;padding:11px;margin-bottom:11px">'
    +   '<div style="display:flex;justify-content:space-between;font-size:12.5px">'
    +     '<span>De lo vendido, ya cobraste</span><b>$' + fmtNum(cobrado) + '</b></div>'
    +   '<div style="display:flex;justify-content:space-between;font-size:12.5px;margin-top:3px;'
    +     'color:#C62828"><span>Te queda por cobrar</span><b>$' + fmtNum(vendido - cobrado) + '</b></div>'
    + '</div>';

  var tipos = Object.keys(porTipo).sort(function(a, b){ return porTipo[b] - porTipo[a]; });
  if(tipos.length){
    cuerpo += '<div style="font-size:11px;font-weight:800;color:#555;margin-bottom:6px">'
      + 'EN QU\u00c9 SE FUERON LOS GASTOS</div>'
      + tipos.map(function(k){
          return '<div style="display:flex;justify-content:space-between;padding:5px 0;'
            + 'border-bottom:1px solid #F4F4F8;font-size:12.5px">'
            + '<span style="text-transform:capitalize">' + escaparHtml(k) + '</span>'
            + '<b>$' + fmtNum(porTipo[k]) + '</b></div>';
        }).join('');
  }

  _cajaReporte('\ud83d\udcb5 Ganancia real', cuerpo);
}


// ═══ ⑥ QUIÉN TE COMPRA MÁS ═══════════════════════════════════════
function abrirRepClientes(){
  window._repActual = pintarRepClientes;
  pintarRepClientes();
}

function pintarRepClientes(){
  clientes = LS('ncl', []);
  var porCli = {};
  _ventasDelRango().forEach(function(v){
    var k = String(v.cid);
    if(!porCli[k]) porCli[k] = { vend: 0, gan: 0, n: 0, nombre: v.cn || '' };
    porCli[k].vend += (typeof dinero === 'function') ? dinero(v.total) : (parseFloat(v.total) || 0);
    porCli[k].gan += parseFloat(v.ganancia) || 0;
    porCli[k].n++;
  });
  var lista = Object.keys(porCli).map(function(k){
    var c = clientes.find(function(x){ return String(x.id) === k; });
    return { k: k, nombre: c ? nombreCl(c) : (porCli[k].nombre || '(sin nombre)'),
             negocio: c ? (c.negocio || '') : '',
             vend: porCli[k].vend, gan: porCli[k].gan, n: porCli[k].n };
  }).sort(function(a, b){ return b.vend - a.vend; });

  var total = lista.reduce(function(a, x){ return a + x.vend; }, 0);
  var max = lista.length ? lista[0].vend : 1;

  var cuerpo = _tresNumeros([
      ['CLIENTES', String(lista.length), '#1565C0', '#E3F2FD'],
      ['VENDIDO', '$' + fmtNum(total), '#2E7D32', '#E8F5E9'],
      ['PROMEDIO', '$' + fmtNum(lista.length ? total / lista.length : 0), '#E65100', '#FFF3E0']
    ])
    + lista.slice(0, 30).map(function(x, i){
        return '<div onclick="cerrarReporte();verCl(' + _arg(x.k) + ')" '
          + 'style="padding:9px 0;border-bottom:1px solid #F4F4F8;cursor:pointer">'
          + '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">'
          +   '<div style="flex:1;min-width:0">'
          +     '<div style="font-size:12.5px;font-weight:800">'
          +       (i < 3 ? ['\ud83e\udd47','\ud83e\udd48','\ud83e\udd49'][i] + ' ' : '')
          +       escaparHtml(x.nombre) + '</div>'
          +     (x.negocio ? '<div style="font-size:10.5px;color:var(--nbs-muted)">'
                           + escaparHtml(x.negocio) + '</div>' : '')
          +     '<div style="font-size:10px;color:var(--nbs-muted)">' + x.n + ' factura(s) \u00b7 te dej\u00f3 $'
          +       fmtNum(x.gan) + '</div>'
          +   '</div>'
          +   '<div style="font-size:14px;font-weight:900;color:#1565C0">$' + fmtNum(x.vend) + '</div>'
          + '</div>'
          + '<div style="height:5px;background:#EEF0F6;border-radius:3px;margin-top:5px;overflow:hidden">'
          +   '<div style="height:100%;width:' + Math.round(x.vend / max * 100) + '%;background:#1565C0"></div>'
          + '</div></div>';
      }).join('');

  _cajaReporte('\ud83c\udfea Qui\u00e9n te compra m\u00e1s',
    cuerpo || '<div style="padding:20px;text-align:center;color:var(--nbs-muted)">Sin ventas en esas fechas.</div>');
}


// ═══ ⑦ QUÉ REPONER ═══════════════════════════════════════════════
// Lo que más sale y ya queda poco: para no quedarse sin lo que de verdad vende.
function abrirRepReponer(){
  window._repActual = pintarRepReponer;
  pintarRepReponer();
}

function pintarRepReponer(){
  loadProds();
  var vend = {};
  _ventasDelRango().forEach(function(v){
    (v.items || []).forEach(function(it){
      if(!it.pid) return;
      vend[String(it.pid)] = (vend[String(it.pid)] || 0) + (Number(it.cant) || 0);
    });
  });
  var dias = Math.max(1, Math.round((
      (parsearFechaVenta(_aFechaApp2(_rangoRep.hasta)) || new Date()).getTime()
    - (parsearFechaVenta(_aFechaApp2(_rangoRep.desde)) || new Date()).getTime()
  ) / 86400000));

  var lista = productos.filter(function(p){
    return !p.eliminado && (vend[String(p.id)] || 0) > 0
        && !/balance inicial/i.test(p.nombre || '');
  }).map(function(p){
    var u = vend[String(p.id)];
    var porDia = u / dias;
    var stock = p.stock || 0;
    // Cuántos días aguanta con lo que le queda, al ritmo al que se vende
    var aguanta = porDia > 0 ? Math.round(stock / porDia) : 999;
    return { n: p.nombre || '', m: p.marca || '', u: u, stock: stock, aguanta: aguanta,
             costo: parseFloat(p.costo) || 0 };
  }).filter(function(x){ return x.aguanta <= 30; })
    .sort(function(a, b){ return a.aguanta - b.aguanta; });

  var cuerpo = '<div style="background:#FFF3E0;border-radius:10px;padding:11px;margin-bottom:11px;'
    + 'font-size:12px;color:#E65100;line-height:1.5">'
    + 'Lo que m\u00e1s sale y ya te queda poco. Los d\u00edas son a tu ritmo de venta '
    + 'de estas fechas.</div>';

  cuerpo += lista.length
    ? lista.slice(0, 30).map(function(x){
        var urg = x.aguanta <= 7;
        return '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;'
          + 'padding:9px;border:1px solid ' + (urg ? '#EF9A9A' : '#E4E4EC') + ';'
          + 'border-left:4px solid ' + (urg ? '#C62828' : '#F9A825') + ';'
          + 'border-radius:9px;margin-bottom:6px">'
          + '<div style="flex:1;min-width:0">'
          +   '<div style="font-size:12.5px;font-weight:800">' + escaparHtml(x.n) + '</div>'
          +   '<div style="font-size:10.5px;color:var(--nbs-muted)">'
          +     'vendiste ' + x.u + ' \u00b7 te quedan ' + x.stock + '</div>'
          + '</div>'
          + '<div style="text-align:right;flex-shrink:0">'
          +   '<div style="font-size:14px;font-weight:900;color:' + (urg ? '#C62828' : '#E65100') + '">'
          +     (x.stock === 0 ? 'SIN' : x.aguanta + ' d') + '</div>'
          +   '<div style="font-size:9.5px;color:var(--nbs-muted)">'
          +     (x.stock === 0 ? 'se acab\u00f3' : 'te aguanta') + '</div>'
          + '</div></div>';
      }).join('')
    : '<div style="padding:20px;text-align:center;color:#2E7D32;font-size:14px;font-weight:700">'
      + '\u2705 De momento no te falta nada urgente.</div>';

  _cajaReporte('\ud83d\udce6 Qu\u00e9 reponer', cuerpo);
}
