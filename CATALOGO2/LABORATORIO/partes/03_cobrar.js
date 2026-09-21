
function esSaldoPendiente(saldo){
  return saldo > 0.005;
}

// ═══════════════════════════════════════════════════════════════
//  IDENTIFICADOR UNICO DE CADA PAGO  (arreglo critico, 22 jul 2026)
//
//  POR QUE EXISTE ESTO: los pagos NO tenian un identificador propio, asi que
//  para evitar duplicados el codigo los comparaba por monto+fecha. Resultado:
//  si un cliente abonaba $20 hoy y mas tarde el MISMO DIA abonaba otros $20,
//  la app BORRABA el segundo pago creyendo que era repetido — y encima decia
//  "pago aplicado correctamente". Se perdia dinero real de la cuenta.
//
//  Ahora cada pago nace con su propio numero unico (pid). Asi se pueden
//  distinguir dos pagos identicos hechos el mismo dia, y solo se considera
//  repetido lo que de verdad tiene el MISMO pid.
// ═══════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
//  REVISION DE INTEGRIDAD  (pedida por Sensei el 22 jul 2026)
//  Revisa TODOS sus datos reales y avisa si algo no cuadra.
//  NO toca nada: solo mira y reporta. Es un chequeo, no una reparacion.
// ═══════════════════════════════════════════════════════════════
function nuevoPagoId(){
  return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2,8);
}

// 💵 LEER UN NUMERO DE DINERO, DE UNA SOLA FORMA EN TODA LA APP -Sensei, 27 ago-.
//
// 🔴 EL PELIGRO QUE ESTO EVITA: las casillas de dinero pasan a ensenar la coma de los
// miles -$2,554.87-. Pero parseFloat("2,554.87") devuelve 2. O sea que un pago de dos mil
// quinientos se habria guardado como DOS DOLARES. Habia 46 sitios en la app leyendo casillas
// de dinero a pelo con parseFloat; todos pasan por aqui ahora.
//
// Acepta cualquier cosa: "2,554.87", "$2,554.87", " 2554.87 ", un numero, o nada.
function cobradoYDebeDe(v){
  // 🌪️ BLINDADA CONTRA DATOS RAROS -30 ago-. El fuzzing encontró cuatro formas de
  // romperla, y una era grave de verdad: un total escrito "1,250.00" se leía como
  // $1.00 — se tragaba $1,249 de una factura. parseFloat se PARA en la coma.
  // Ahora se usa dinero(), que es la función de la app que limpia comas y símbolos.
  var t = (typeof dinero === 'function') ? dinero(v && v.total) : (parseFloat((v && v.total) || 0) || 0);
  if(!isFinite(t) || t < 0) t = 0;          // una factura negativa no existe

  // Si pagosFactura viniera roto -no una lista-, la app REVENTABA aquí.
  var pagos = (v && v.pagosFactura) || [];
  if(!Array.isArray(pagos)) pagos = [];

  var pg = 0;
  pagos.forEach(function(p){
    if(!p || p.esDevolucion) return;
    var m = (typeof dinero === 'function') ? dinero(p.monto) : (parseFloat(p.monto) || 0);
    if(!isFinite(m) || m < 0) return;        // un pago negativo no se cuenta
    pg += m;
  });
  var r2 = function(x){ return Math.round(x * 100) / 100; };

  if(v && v.tipo === 'contado'){
    // 🔑 Una de contado se da por pagada SOLO si NUNCA la tocaron. Si la modificaron
    // o le hicieron una devolución, se le hace caso a sus pagos igual que a las de
    // crédito. Sensei lo cazó dos veces: su factura del 26 de junio está marcada
    // "modificada" y NO tiene pagos apuntados, así que la regla vieja la daba por
    // pagada mientras el renglón de la lista decía "debe $10". -15 ago-
    var tocada = !!(v.modificada || v.ajustadaPorDevolucion || pagos.length);
    if(!tocada) return { cobrado: r2(t), debe: 0 };
    var falta = r2(t - pg);
    return { cobrado: r2(pg), debe: falta > 0.005 ? falta : 0 };
  }
  // 🔑 Si le pagaron de MÁS, la deuda es 0 — nunca negativa. Lo de más se ve en el
  // aviso del vigilante, que es donde tiene que verse. -30 ago-
  var falta2 = r2(t - pg);
  return { cobrado: r2(pg), debe: falta2 > 0.005 ? falta2 : 0 };
}


// ═══════════════════════════════════════════════════════════════════
//  🏦 LA CUENTA DEL CLIENTE — UNA SOLA VERDAD
//
//  Todo lo que la app sabe de un cliente, calculado UNA vez con UNA
//  regla. Cualquier pantalla que quiera un número de un cliente pide
//  aquí. Así es imposible que dos pantallas se contradigan.
//
//  Devuelve:
//    .cliente     el cliente tal cual está guardado
//    .facturas    TODAS, activas y canceladas
//    .activas     las que cuentan
//    .canceladas  las anuladas (antes ni se veían)
//    .pagos       cada pago con su factura, fecha y forma
//    .pedidos     los pendientes de ese cliente
//    .devoluciones  las facturas que le ajustaste
//    .modificadas   las facturas que tocaste después
//    .conFirma      las que tienen su firma
//    .visitas     compró / no compró, con fechas
//    .dinero      comprado, pagado, debe, ganancia, margen, crédito
//    .ritmo       última compra, días desde, cada cuánto compra
//    .top         lo que más compra
// ═══════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════
//  🔔 LA REVISIÓN DIARIA — la app se revisa sola y te avisa
//
//  Corre una vez al día, calladita. Si todo cuadra, NO molesta.
//  Si algo no cuadra, te lo dice ANTES de que lo descubras tú.
// ═══════════════════════════════════════════════════════════════════
function cobradoEntre(desde, hasta){
  var V = JSON.parse(localStorage.getItem('nv') || '[]');
  var total = 0, cuantos = 0;
  var dias = {};
  V.forEach(function(v){
    if(v.cancelada) return;
    (v.pagosFactura || []).forEach(function(p){
      if(p.esDevolucion) return;
      var m = parseFloat(p.monto) || 0;
      if(m <= 0) return;
      var f = parsearFechaVenta(p.fecha || v.fecha);
      if(!f) return;
      if(desde && f.getTime() < desde.getTime()) return;
      if(hasta && f.getTime() > hasta.getTime()) return;
      total += m; cuantos++;
      dias[p.fecha || v.fecha] = true;
    });
  });
  return { total: _cuadreR2(total), pagos: cuantos, dias: Object.keys(dias).length };
}

// ── LA PANTALLA 1: escoger qué cuadrar ──

// ── Del calendario (AAAA-MM-DD) a una fecha de verdad, sin líos de zona horaria ──
function calcularHistorialCxC(){
  var V = LS('nv', []);
  var porDia = {};   // clave -> { fio, cobro, quienesFiaron[], quienesPagaron[] }
  function anota(clave, campo, monto, quien, facturaId){
    if(!porDia[clave]) porDia[clave] = { fio:0, cobro:0, fiados:[], pagos:[] };
    porDia[clave][campo] += monto;
    if(campo === 'fio') porDia[clave].fiados.push({ quien: quien, monto: monto, id: facturaId });
    else                porDia[clave].pagos.push({ quien: quien, monto: monto, id: facturaId });
  }

  V.forEach(function(v){
    if(v.cancelada) return;
    // 🔴 El contado normal no deja deuda, PERO una modificada sí puede. -15 ago-
    if(v.tipo !== 'credito' && cobradoYDebeDe(v).debe <= 0.005) return;
    var fv = _histFecha(v.fecha);
    var total = parseFloat(v.total) || 0;
    if(fv && total > 0) anota(_histClave(fv), 'fio', total, v.cn || 'sin nombre', v.id);
    (v.pagosFactura || []).forEach(function(p){
      if(p.esDevolucion) return;
      var m = parseFloat(p.monto) || 0;
      if(m <= 0) return;
      var fp = _histFecha(p.fecha) || fv;
      if(fp) anota(_histClave(fp), 'cobro', m, v.cn || 'sin nombre', v.id);
    });
  });

  var claves = Object.keys(porDia).sort();     // del más viejo al más nuevo
  var saldo = 0, lista = [];
  claves.forEach(function(k){
    var d = porDia[k];
    saldo += (d.fio - d.cobro);
    lista.push({ clave:k, fio:d.fio, cobro:d.cobro, saldo:Math.round(saldo*100)/100,
                 fiados:d.fiados, pagos:d.pagos });
  });
  // el más nuevo primero
  return lista.reverse();
}

function cambiarDiasHistorialCxC(n){
  _histCxCDias = n;
  try { localStorage.setItem('nbs_hist_cxc_dias', String(n)); } catch(e){}
  renderHistorialCxC();
}

function renderHistorialCxC(){
  var el = document.getElementById('cxc-historial-lista');
  if(!el) return;
  var todo = calcularHistorialCxC();
  var lista = (_histCxCDias > 0) ? todo.slice(0, _histCxCDias) : todo;

  var botones = [[7,'7 días'],[15,'15'],[30,'30'],[0,'Todo']];
  var h = '<div style="display:flex;gap:5px;margin-bottom:10px">'
        + botones.map(function(b){
            var act = (_histCxCDias === b[0]);
            return '<button onclick="cambiarDiasHistorialCxC(' + b[0] + ')" style="flex:1;padding:8px;'
              + 'background:' + (act ? 'var(--nbs-gold)' : '#F0F0F2') + ';color:' + (act ? 'white' : 'var(--nbs-ink)')
              + ';border:none;border-radius:8px;font-size:12px;font-weight:800;cursor:pointer">' + b[1] + '</button>';
          }).join('')
        + '</div>';

  if(!lista.length){
    el.innerHTML = h + '<div style="text-align:center;color:var(--nbs-muted);font-size:13px;padding:24px">'
      + 'Todav\u00eda no hay movimiento de cr\u00e9dito que mostrar.</div>';
    return;
  }

  // El resumen del período
  var hoy = lista[0], viejo = lista[lista.length-1];
  var dif = Math.round((hoy.saldo - viejo.saldo) * 100) / 100;
  h += '<div style="background:' + (dif <= 0 ? '#E8F5E9' : '#FFF3E0') + ';border:1.5px solid '
     + (dif <= 0 ? '#2E7D32' : '#E65100') + ';border-radius:11px;padding:11px;margin-bottom:12px">'
     + '<div style="font-size:11px;font-weight:800;color:' + (dif <= 0 ? '#1B5E20' : '#E65100')
     + ';letter-spacing:.4px">EN ESTOS ' + lista.length + ' D\u00cdA(S) CON MOVIMIENTO</div>'
     + '<div style="font-size:19px;font-weight:900;color:' + (dif <= 0 ? '#1B5E20' : '#E65100') + ';line-height:1.2">'
     + (dif <= 0 ? '\u2193 Bajaste $' : '\u2191 Subi\u00f3 $') + fmtNum(Math.abs(dif)) + '</div>'
     + '<div style="font-size:12px;color:#666;margin-top:2px">de $' + fmtNum(viejo.saldo)
     + ' a $' + fmtNum(hoy.saldo) + '</div></div>';

  h += lista.map(function(d, i){
    var ant = lista[i+1];
    var cam = ant ? Math.round((d.saldo - ant.saldo) * 100) / 100 : null;
    var col = (cam === null) ? '#999' : (cam > 0 ? '#E65100' : (cam < 0 ? '#2E7D32' : '#999'));
    var fle = (cam === null) ? '' : (cam > 0 ? '\u2191 $' + fmtNum(cam) : (cam < 0 ? '\u2193 $' + fmtNum(-cam) : '='));
    return '<div class="card" style="margin-bottom:7px;padding:11px;cursor:pointer" onclick="verDiaCxC(\'' + d.clave + '\')">'
      + '<div style="display:flex;justify-content:space-between;align-items:center">'
      +   '<div style="font-size:13.5px;font-weight:800;color:var(--nbs-ink)">' + _histBonito(d.clave) + '</div>'
      +   '<div style="font-size:16px;font-weight:900;color:var(--nbs-ink)">$' + fmtNum(d.saldo) + '</div>'
      + '</div>'
      + '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:3px">'
      +   '<div style="font-size:11.5px;color:var(--nbs-muted)">fi\u00e9 $' + fmtNum(d.fio)
      +      ' \u00b7 cobr\u00e9 $' + fmtNum(d.cobro) + '</div>'
      +   '<div style="font-size:12.5px;font-weight:800;color:' + col + '">' + fle + '</div>'
      + '</div></div>';
  }).join('');

  h += '<div style="font-size:11.5px;color:var(--nbs-muted);text-align:center;margin-top:10px;line-height:1.5">'
     + 'Toca un d\u00eda para ver a qui\u00e9n le fiaste y qui\u00e9n te pag\u00f3.<br>'
     + 'Solo se cuentan las ventas a cr\u00e9dito \u2014 el contado se paga el mismo d\u00eda.</div>';

  el.innerHTML = h;
}

// Al tocar un día: quiénes fiaron y quiénes pagaron
function verDiaCxC(clave){
  var d = calcularHistorialCxC().find(function(x){ return x.clave === clave; });
  if(!d) return;

  var h = '<div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:12px">'
        + '<div style="flex:1"><div style="font-size:18px;font-weight:900;color:#1a237e">' + _histBonito(clave) + '</div>'
        + '<div style="font-size:12px;color:#666">te deb\u00edan <b>$' + fmtNum(d.saldo) + '</b> al cerrar el d\u00eda</div></div>'
        + '<button onclick="cerrarDiaCxC()" style="flex-shrink:0;width:34px;height:34px;border:none;border-radius:9px;background:#f0f0f0;color:#666;font-size:20px;font-weight:800;cursor:pointer">\u2715</button>'
        + '</div>';

  h += '<div style="display:flex;gap:8px;margin-bottom:12px">'
     + '<div style="flex:1;background:#FFF3E0;border-radius:10px;padding:10px;text-align:center">'
     +   '<div style="font-size:10.5px;font-weight:800;color:#E65100;letter-spacing:.4px">FIASTE</div>'
     +   '<div style="font-size:18px;font-weight:900;color:#E65100">$' + fmtNum(d.fio) + '</div></div>'
     + '<div style="flex:1;background:#E8F5E9;border-radius:10px;padding:10px;text-align:center">'
     +   '<div style="font-size:10.5px;font-weight:800;color:#1B5E20;letter-spacing:.4px">COBRASTE</div>'
     +   '<div style="font-size:18px;font-weight:900;color:#1B5E20">$' + fmtNum(d.cobro) + '</div></div>'
     + '</div>';

  function bloque(titulo, color, items){
    if(!items.length) return '';
    var t = '<div style="font-size:11px;font-weight:800;color:' + color + ';letter-spacing:.4px;margin:12px 0 6px">'
          + titulo + ' (' + items.length + ')</div>';
    t += items.map(function(x){
      return '<div style="display:flex;justify-content:space-between;align-items:center;background:white;'
        + 'border:1px solid #e5e7eb;border-radius:9px;padding:9px 11px;margin-bottom:5px">'
        + '<span style="font-size:13px;font-weight:700;color:var(--nbs-ink);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'
        + escaparHtml(String(x.quien).slice(0,30)) + '</span>'
        + '<span style="font-size:14px;font-weight:900;color:' + color + '">$' + fmtNum(x.monto) + '</span>'
        + '</div>';
    }).join('');
    return t;
  }
  h += bloque('\ud83e\uddfe LES FIASTE', '#E65100', d.fiados);
  h += bloque('\ud83d\udcb5 TE PAGARON', '#1B5E20', d.pagos);

  h += '<button onclick="cerrarDiaCxC()" style="width:100%;padding:12px;background:#ECEFF1;color:#546E7A;'
     + 'border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;margin-top:12px">Cerrar</button>';

  var ov = document.getElementById('diacxc-ov');
  if(!ov){
    ov = document.createElement('div');
    ov.id = 'diacxc-ov';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:99993;display:flex;align-items:center;justify-content:center;padding:14px';
    document.body.appendChild(ov);
  }
  ov.innerHTML = '<div style="background:#fff;border-radius:16px;padding:15px;max-width:460px;width:100%;max-height:88vh;overflow-y:auto">' + h + '</div>';
  ov.style.display = 'flex';
}

function cerrarDiaCxC(){
  var ov = document.getElementById('diacxc-ov');
  if(ov) ov.remove();
}


function cambiarPestanaCxC(tab){
  window._cxcTabActiva = tab;
  var btnPend = document.getElementById('cxc-tab-pendientes');
  var btnSald = document.getElementById('cxc-tab-saldadas');
  var btnHist = document.getElementById('cxc-tab-historial');
  var listaPend = document.getElementById('cxc-lista');
  var listaSald = document.getElementById('cxc-saldadas-lista');
  var listaHist = document.getElementById('cxc-historial-lista');
  var buscar = document.getElementById('cxc-buscar');

  function apagar(b){ if(b){ b.style.background = '#F0F0F2'; b.style.color = 'var(--nbs-ink)'; } }
  function prender(b){ if(b){ b.style.background = 'var(--nbs-gold)'; b.style.color = 'white'; } }
  apagar(btnPend); apagar(btnSald); apagar(btnHist);
  if(listaPend) listaPend.style.display = 'none';
  if(listaSald) listaSald.style.display = 'none';
  if(listaHist) listaHist.style.display = 'none';

  if(tab === 'saldadas'){
    prender(btnSald);
    if(listaSald) listaSald.style.display = 'block';
    if(buscar){ buscar.style.display = ''; buscar.placeholder = 'Buscar factura saldada...'; }
    renderFacturasSaldadas(buscar ? buscar.value : '');
  } else if(tab === 'historial'){
    prender(btnHist);
    if(listaHist) listaHist.style.display = 'block';
    // El historial no se busca por nombre: se esconde la caja de búsqueda
    if(buscar && buscar.parentElement) buscar.parentElement.style.display = 'none';
    renderHistorialCxC();
  } else {
    prender(btnPend);
    if(listaPend) listaPend.style.display = 'block';
    if(buscar){ buscar.style.display = ''; buscar.placeholder = 'Buscar por nombre o negocio...'; }
    renderCxC(buscar ? buscar.value : '');
  }
  // la caja de búsqueda vuelve a salir en las otras dos pestañas
  if(tab !== 'historial' && buscar && buscar.parentElement) buscar.parentElement.style.display = '';
}

function cxcBuscarActivo(q){
  if(window._cxcTabActiva === 'saldadas'){ renderFacturasSaldadas(q); } else { renderCxC(q); }
}

function renderCxC(q){
  ventas = LS('nv',[]);
  clientes = LS('ncl',[]);
  var el = document.getElementById('cxc-lista');
  el.style.display = 'block';
  document.getElementById('cxc-abono').style.display = 'none';
  el.innerHTML = '';

  // Calculate balance per client DIRECTLY from invoices (pagosFactura) - excluding cancelled
  var balancesPorCliente = {};
  // 🔴 ANTES solo miraba las de CRÉDITO, así que una factura de contado MODIFICADA
  // que quedara debiendo NO SE PODÍA COBRAR: ni salía en la lista. Sensei lo cazó:
  // "cuando toco recibir un pago desde el perfil, la factura de $10 no se ve".
  // Ahora entra cualquier factura que DEBA algo, según cobradoYDebeDe. -15 ago-
  ventas.filter(function(v){
    if(v.cancelada) return false;
    if(v.tipo === 'credito') return true;
    return cobradoYDebeDe(v).debe > 0.005;
  }).forEach(function(v){
    var key = String(v.cid);
    if(!balancesPorCliente[key]) balancesPorCliente[key] = {cid:v.cid, cn:v.cn, total:0, pagado:0};
    balancesPorCliente[key].total += v.total;
    var pf = v.pagosFactura ? (v.pagosFactura || []).filter(function(p){return typeof p.monto==='number';}).reduce(function(s,p){return s+p.monto;},0) : 0;
    balancesPorCliente[key].pagado += pf;
  });
  // Asegurar que tambien aparezcan los clientes que tienen credito a favor -por una devolucion-
  // aunque no tengan ninguna factura a credito abierta -por ejemplo, si la devolucion fue de una venta de contado-.
  clientes.filter(function(c){ return (c.creditoAFavor||0) > 0.005; }).forEach(function(c){
    var key = String(c.id);
    if(!balancesPorCliente[key]) balancesPorCliente[key] = {cid:c.id, cn:nombreCl(c), total:0, pagado:0};
  });

  var pendientes = Object.keys(balancesPorCliente).map(function(k){
    var b = balancesPorCliente[k];
    var cl = clientes.find(function(c){ return String(c.id)===String(b.cid); });
    var creditoAFavor = cl ? (cl.creditoAFavor||0) : 0;
    var saldoBruto = Math.max(0,b.total-b.pagado);
    var saldoNeto = saldoBruto - creditoAFavor; // negativo = el negocio le debe al cliente
    return {cid:b.cid, cn:b.cn, total:b.total, saldo:saldoNeto, saldoBruto:saldoBruto, creditoAFavor:creditoAFavor, negocio: cl ? (cl.negocio||'') : ''};
  }).filter(function(b){ return b.saldoBruto > 0.005 || b.creditoAFavor > 0.005; }); // el REAL, no el neto

  // Filtrar por búsqueda (nombre, negocio, apodo, teléfono, o dirección del cliente)
  if(q && q.trim()){
    var ql = q.toLowerCase();
    pendientes = pendientes.filter(function(p){
      var cl = clientes.find(function(c){ return String(c.id)===String(p.cid); });
      var apodo = (cl && cl.apodo) ? cl.apodo.toLowerCase() : '';
      var tel = (cl && cl.tel) ? cl.tel.toLowerCase() : '';
      var dir = cl ? ((cl.dir||'')+' '+(cl.ciudad||'')).toLowerCase() : '';
      var contactoInfo = cl ? ((cl.contacto||'')+' '+(cl.contactoApodo||'')+' '+(cl.contactoTel||'')).toLowerCase() : '';
      return p.cn.toLowerCase().indexOf(ql) >= 0 || p.negocio.toLowerCase().indexOf(ql) >= 0 || apodo.indexOf(ql) >= 0 || tel.indexOf(ql) >= 0 || dir.indexOf(ql) >= 0 || contactoInfo.indexOf(ql) >= 0;
    });
  }

  if(!pendientes.length){
    el.innerHTML = '<div class="card"><p style="color:#aaa;text-align:center;padding:20px">Sin cuentas pendientes<br>Todo al corriente ✓</p></div>';
    return;
  }

  var totalTeDeben = pendientes.filter(function(c){return c.saldo>0;}).reduce(function(s,c){ return s+c.saldo; }, 0);
  var totalLeDebes = pendientes.filter(function(c){return c.saldo<0;}).reduce(function(s,c){ return s+Math.abs(c.saldo); }, 0);
  var resumen = document.createElement('div');
  resumen.style.cssText = 'display:flex;gap:8px;margin-bottom:12px';
  // Cuantos clientes son, no solo el total -pedido de Sensei el 28 jul: "en clientes que
  // me deben no me dicen cuantos son, deberia decirmelo ya que es tambien un dato
  // importante"-
  var cuantosTeDeben = pendientes.filter(function(c){ return c.saldo > 0; }).length;
  var cuantosLeDebes = pendientes.filter(function(c){ return c.saldo < 0; }).length;

  resumen.innerHTML = '<div style="flex:1;background:var(--nbs-red-bg);border-radius:12px;padding:14px">'
    +'<div style="font-size:11px;color:var(--nbs-red-text);font-weight:500">Total por cobrar</div>'
    +'<div style="font-size:20px;font-weight:700;color:var(--nbs-red-dark)">$'+fmtNum(totalTeDeben)+'</div>'
    +'<div style="font-size:12.5px;font-weight:700;color:var(--nbs-red-dark);opacity:.85">'+cuantosTeDeben+(cuantosTeDeben===1?' cliente':' clientes')+'</div></div>'
    +(totalLeDebes>0.005 ? '<div style="flex:1;background:#FFF3E0;border-radius:12px;padding:14px">'
    +'<div style="font-size:11px;color:#E65100;font-weight:500">Crédito a favor de clientes</div>'
    +'<div style="font-size:20px;font-weight:700;color:#E65100">$'+fmtNum(totalLeDebes)+'</div>'
    +'<div style="font-size:12.5px;font-weight:700;color:#E65100;opacity:.85">'+cuantosLeDebes+(cuantosLeDebes===1?' cliente':' clientes')+'</div></div>' : '');
  el.appendChild(resumen);

  var btnsAdmin = document.createElement('div');
  btnsAdmin.style.cssText = 'display:flex;gap:8px;margin-bottom:14px';
  var btnDiag = document.createElement('button');
  btnDiag.innerHTML = '🩺 Diagnóstico';
  btnDiag.style.cssText = 'flex:1;padding:9px;background:#F0F0F2;color:var(--nbs-ink);border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:5px';
  btnDiag.onclick = function(){ diagnosticoCxC(pendientes); };
  btnsAdmin.appendChild(btnDiag);

  var btnBuscar = document.createElement('button');
  btnBuscar.innerHTML = '🔍 Buscar cliente';
  btnBuscar.style.cssText = 'flex:1;padding:9px;background:#F0F0F2;color:var(--nbs-ink);border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:5px';
  btnBuscar.onclick = function(){
    var n = prompt('Escribe el nombre del cliente a buscar:');
    if(n) buscarClienteEspecifico(n);
  };
  btnsAdmin.appendChild(btnBuscar);
  el.appendChild(btnsAdmin);

  pendientes.sort(function(a,b){ return b.saldo-a.saldo; }).forEach(function(c){
    var esFavorCliente = c.saldo < 0;
    var pct = c.total>0 ? Math.round((1-c.saldoBruto/c.total)*100) : 0;
    var cl = clientes.find(function(x){ return String(x.id)===String(c.cid); });
    var negocio = cl && cl.negocio ? cl.negocio.trim() : '';
    var card = document.createElement('div');
    card.className = 'card';
    card.style.cssText = 'cursor:pointer;border:0.5px solid '+(esFavorCliente?'#FFCC80':'var(--nbs-line)')+';border-radius:12px;box-shadow:var(--nbs-shadow-card);background:'+(esFavorCliente?'#FFFBF5':'white')+';padding:16px';
    card.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">'
      +'<div style="display:flex;gap:10px">'
      +'<div style="width:38px;height:38px;border-radius:10px;background:var(--nbs-gold-bg);display:flex;align-items:center;justify-content:center;flex-shrink:0">'
      +'<span style="font-size:13px;font-weight:700;color:var(--nbs-gold-dark)">'+(cl?ini(cl.nombre,cl.apellido):'?')+'</span>'
      +'</div>'
      +'<div><div style="font-size:18px;font-weight:900;color:var(--nbs-ink)">'+escaparHtml(cl?nombreCl(cl):c.cn)+'</div>'
      +(negocio ? '<div style="font-size:12px;color:var(--nbs-muted);margin-top:1px;display:flex;align-items:center;gap:4px">🏪'+escaparHtml(negocio)+'</div>' : '')
      +'<div style="font-size:11px;color:var(--nbs-muted-2);margin-top:3px">'+(c.total>0?'Total facturado: $'+fmtNum(c.total):'Sin facturas abiertas')+'</div></div>'
      +'</div>'
      +'<div style="text-align:right">'
      // El balance REAL: la deuda y el credito por separado, SIN restarlos entre si -pedido
      // por Sensei el 24 jul: "yo decido cuando aplicarle su balance o credito pendiente a
      // favor a cada cliente, no que el credito se aplique automaticamente"-.
      +(c.saldoBruto>0.01 ? '<div style="font-size:18px;font-weight:700;color:var(--nbs-red-dark)">$'+fmtNum(c.saldoBruto)+'</div><div style="font-size:11px;color:var(--nbs-muted)">pendiente</div>' : '')
      +(c.creditoAFavor>0.01 ? '<div style="font-size:'+(c.saldoBruto>0.01?'14px':'18px')+';font-weight:700;color:#E65100;margin-top:'+(c.saldoBruto>0.01?'3px':'0')+'">💰($'+fmtNum(c.creditoAFavor)+')</div><div style="font-size:11px;color:#E65100;font-weight:700">a favor</div>' : '')
      +'</div></div>'
      +(c.creditoAFavor>0.01
        ? '<div style="background:#FFF3E0;border-radius:8px;padding:8px 10px;margin-bottom:12px;font-size:11px;color:#E65100">💰 Tiene ($'+fmtNum(c.creditoAFavor)+') de crédito a favor. Se aplica SOLO cuando tú elijas "Usar crédito del cliente" al venderle.</div>'
        : '')
      +(c.saldoBruto>0.01
        ? '<div style="height:6px;background:#F0F0F2;border-radius:3px;overflow:hidden;margin-bottom:8px">'
          +'<div style="height:100%;width:'+pct+'%;background:var(--nbs-green-text);border-radius:3px"></div></div>'
          +'<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--nbs-muted);margin-bottom:12px">'
          +'<span>Pagado: '+pct+'%</span><span>Pendiente: '+(100-pct)+'%</span></div>'
        : '')
      +'<div style="display:flex;gap:6px">'
    +'<button style="flex:1;padding:10px;background:'+(c.saldoBruto>0.01?'var(--nbs-gold)':'#E65100')+';color:white;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:6px">'+(c.saldoBruto>0.01?'💰Registrar pago':'👁️ Ver detalle')+'</button>'
    +'<button data-mandar="1" style="flex-shrink:0;width:46px;padding:10px 0;background:#fff;color:#1a237e;border:1.5px solid #b9bfe0;border-radius:9px;font-size:15px;cursor:pointer" title="Mandarle su balance">\ud83d\udce4</button>'
    +'</div>';
    card.style.cursor='pointer';
    card.onclick=(function(cid){return function(){abrirAbono(cid);};})(c.cid);
    card.querySelector('button').onclick=(function(cid){return function(e){e.stopPropagation();abrirAbono(cid);};})(c.cid);
    // \ud83d\udce4 El botoncito de mandarle el balance sin entrar en su ficha. -3 sep-
    var _btnMandar = card.querySelector('[data-mandar]');
    if(_btnMandar) _btnMandar.onclick = (function(cid){
      return function(e){ e.stopPropagation(); mandarSuBalance(cid, 0); };
    })(c.cid);
    el.appendChild(card);
  });
}


// ═══════════════════════════════════════════════════════════════════
//  USAR EL CRÉDITO A FAVOR DEL CLIENTE  (31 jul)
//
//  Sensei: "debería poder aplicarse el pago desde el perfil del cliente
//  también, o cuando hago pedidos rápidos y convierto a venta".
//
//  Antes SOLO se podía usar al hacer una venta nueva (como una forma de
//  pago). Aquí se agrega también en "Aplicar pago", que es donde él lo
//  buscó. Un toque usa TODO el crédito; si sobra, se le queda a favor.
// ═══════════════════════════════════════════════════════════════════
function usarCreditoAFavor(cid){
  var cls = LS('ncl', []);
  var idx = cls.findIndex(function(x){ return String(x.id) === String(cid); });
  if(idx < 0) return;
  var credito = parseFloat(cls[idx].creditoAFavor) || 0;
  if(credito <= 0.005){ avisoGrande('Este cliente ya no tiene cr\u00e9dito a favor.'); return; }

  var deudaAntes = 0;
  try { deudaAntes = balanceDelCliente(cid); } catch(e){}

  var V = LS('nv', []);
  var suyas = V.filter(function(v){
    return String(v.cid) === String(cid) && v.tipo === 'credito' && !v.cancelada;
  });
  // De la más vieja a la más nueva. Se usa fechaVentaAISO, que devuelve AAAA-MM-DD
  // y por eso se puede ordenar como texto. Si una fecha viniera dañada, esa factura
  // se va al final y no rompe el orden de las demás.
  suyas.sort(function(a, b){
    var fa = '', fb = '';
    try { fa = fechaVentaAISO(a) || ''; } catch(e){}
    try { fb = fechaVentaAISO(b) || ''; } catch(e){}
    if(!fa) fa = '9999-99-99';
    if(!fb) fb = '9999-99-99';
    return fa < fb ? -1 : (fa > fb ? 1 : 0);
  });

  var queda = credito, usado = 0, tocadas = [];
  suyas.forEach(function(v){
    if(queda <= 0.005) return;
    // 🔴 ESTO MUEVE DINERO: sin la regla unica, el credito a favor se le podia
    // aplicar a una factura de CONTADO que ya estaba pagada. -19 ago-
    var debe = cobradoYDebeDe(v).debe;
    if(debe <= 0.005) return;
    var pone = Math.min(queda, debe);
    pone = Math.round(pone * 100) / 100;
    if(pone <= 0.005) return;
    queda = Math.round((queda - pone) * 100) / 100;
    usado = Math.round((usado + pone) * 100) / 100;
    // 🔑 Se apunta TODO lo que hace falta para el aviso: cuánto debía esa factura
    // antes, cuánto se le aplicó y cuánto le queda. -4 sep-
    tocadas.push({ id: v.id, monto: pone, nf: v.numFactura || '', fecha: v.fecha || '',
                   total: parseFloat(v.total) || 0, debiaAntes: debe,
                   debeDespues: Math.round((debe - pone) * 100) / 100 });
  });

  if(usado <= 0.005){ avisoGrande('Este cliente no tiene facturas pendientes donde aplicar el cr\u00e9dito.'); return; }

  var texto = 'Se van a usar $' + fmtNum(usado) + ' del cr\u00e9dito a favor'
            + (tocadas.length > 1 ? ' en ' + tocadas.length + ' facturas' : '')
            + '.\n\n'
            + tocadas.map(function(t){
                return '\u2022 Factura #' + t.nf + ' \u2014 $' + fmtNum(t.monto);
              }).join('\n')
            + '\n\n'
            + (queda > 0.005 ? 'Le quedar\u00e1n $' + fmtNum(queda) + ' a favor.' : 'No le quedar\u00e1 cr\u00e9dito.')
            + '\n\n\u00bfConfirmas?';
  if(!confirm(texto)) return;

  protegerConHuella(function(){
    // guardar el cambio: primero las ventas, después el crédito del cliente
    var Vg = LS('nv', []);
    tocadas.forEach(function(t){
      var vv = Vg.find(function(x){ return String(x.id) === String(t.id); });
      if(!vv) return;
      if(!vv.pagosFactura) vv.pagosFactura = [];
      // 🔑 CON SU `pid`, como todos los demás pagos de la app. Sin él, el editor de
      // pagos no puede identificarlo ni corregirlo. -4 sep-
      vv.pagosFactura.push({ pid: nuevoPagoId(), monto: t.monto,
                             fecha: fechaDelCampo('cred-fecha'),
                             metodo: 'credito_cliente', nota: 'Cr\u00e9dito a favor aplicado' });
    });
    if(!SS('nv', Vg)) return;      // SS ya avisa si no cupo
    ventas = LS('nv', []);

    var Cg = LS('ncl', []);
    var i2 = Cg.findIndex(function(x){ return String(x.id) === String(cid); });
    if(i2 >= 0){
      Cg[i2].creditoAFavor = queda;
      Cg[i2].mod = Date.now();
      if(!SS('ncl', Cg)) return;
    }
    clientes = LS('ncl', []);

    var deudaDespues = 0;
    try { deudaDespues = balanceDelCliente(cid); } catch(e){}

    // 📋 EL RESULTADO, CON TODO EL DETALLE -Sensei, 4 sep-: "cuando yo le de a usar
    // crédito me debe llevar a la factura que se le aplica el crédito y mostrarme el
    // balance completo del cliente, o cómo es que me voy a dar cuenta que quedó
    // aplicado el pago".
    mostrarCreditoAplicado(cid, usado, queda, tocadas, deudaAntes, deudaDespues);

    // 🔑 Y NO SE LE SACA DE LA PANTALLA. Antes se llamaba a abrirAbono y DESPUÉS a
    // renderCxC, que repintaba la lista encima y lo echaba fuera: parecía que no
    // había pasado nada. Ahora se refresca la lista PRIMERO y se vuelve a su ficha.
    // \ud83d\udd11 SE VUELVE A DONDE ESTABA, con el balance YA AL D\u00cdA. -6 sep-
    // Si vino de la FICHA del cliente, se queda en la ficha y se repinta la cabecera
    // para que el "DEBE" de arriba baje de $20 a $15. Antes siempre acababa en
    // Cuentas por Cobrar, y el balance de la ficha se quedaba viejo.
    var _enLaFicha = false;
    try { _enLaFicha = (pantallaActual() === 'p-cl-perfil'); } catch(e){}
    if(_enLaFicha){
      try { verCl(cid); } catch(e){}
      try { pintarPanelCliente(cid); } catch(e){}
    } else {
      try { renderCxC(''); } catch(e){}
      try { abrirAbono(cid); } catch(e){}
      try { pintarPanelCliente(cid); } catch(e){}
    }
  });
}

// 📋 El recuadro que enseña DÓNDE fue el crédito y cómo queda su balance.  (4 sep 2026)
function mostrarCreditoAplicado(cid, usado, queda, tocadas, deudaAntes, deudaDespues){
  clientes = LS('ncl', []);
  var c = clientes.find(function(x){ return String(x.id) === String(cid); });

  var ov = document.getElementById('credito-aplicado-overlay');
  if(!ov){
    ov = document.createElement('div');
    ov.id = 'credito-aplicado-overlay';
    document.body.appendChild(ov);
  }
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.62);z-index:99999;'
    + 'display:flex;align-items:center;justify-content:center;padding:14px';
  ov.onclick = function(e){ if(e.target === ov) cerrarCreditoAplicado(); };

  var h = '<div style="background:#fff;border-radius:15px;padding:16px;max-width:440px;'
    + 'width:100%;max-height:90vh;overflow:auto">'

    + '<div style="font-size:16px;font-weight:900;color:#2E7D32;text-align:center;margin-bottom:3px">'
    +   '\u2705 Cr\u00e9dito aplicado</div>'
    + '<div style="font-size:13px;font-weight:800;color:var(--nbs-ink);text-align:center;margin-bottom:12px">'
    +   escaparHtml(c ? nombreCl(c) : '') + '</div>'

    + '<div style="background:#E8F5E9;border-radius:10px;padding:11px;text-align:center;margin-bottom:12px">'
    +   '<div style="font-size:11px;color:#2E7D32;font-weight:800;letter-spacing:.4px">SE USARON</div>'
    +   '<div style="font-size:26px;font-weight:900;color:#2E7D32;letter-spacing:-.6px">$'
    +     fmtNum(usado) + '</div>'
    + '</div>';

  // Cada factura donde entró, con su antes y su después
  h += '<div style="font-size:11px;font-weight:800;color:#555;letter-spacing:.4px;margin-bottom:6px">'
    +   (tocadas.length > 1 ? 'SE APLIC\u00d3 EN ESTAS FACTURAS' : 'SE APLIC\u00d3 EN ESTA FACTURA') + '</div>';

  tocadas.forEach(function(t){
    h += '<div style="border:1.5px solid #A5D6A7;border-radius:10px;padding:10px;margin-bottom:8px">'
      + '<div style="font-size:13px;font-weight:900;color:var(--nbs-ink);margin-bottom:5px">'
      +   'Factura #' + escaparHtml(String(t.nf)) + ' \u00b7 ' + escaparHtml(String(t.fecha)) + '</div>'
      + '<div style="display:flex;justify-content:space-between;font-size:12px;color:#666;padding:2px 0">'
      +   '<span>Deb\u00eda</span><span>$' + fmtNum(t.debiaAntes) + '</span></div>'
      + '<div style="display:flex;justify-content:space-between;font-size:12px;color:#2E7D32;'
      +   'font-weight:800;padding:2px 0"><span>Se le aplic\u00f3</span><span>\u2212 $'
      +   fmtNum(t.monto) + '</span></div>'
      + '<div style="display:flex;justify-content:space-between;font-size:13.5px;font-weight:900;'
      +   'padding-top:5px;margin-top:4px;border-top:1px solid #E0E0E0;color:'
      +   (t.debeDespues > 0.005 ? '#C62828' : '#2E7D32') + '">'
      +   '<span>Ahora debe</span><span>$' + fmtNum(t.debeDespues) + '</span></div>'
      + '<button onclick="cerrarCreditoAplicado();verFacturaProfesional(' + _arg(String(t.id)) + ')" '
      +   'style="width:100%;margin-top:8px;padding:8px;background:#fff;color:#1a237e;'
      +   'border:1.5px solid #b9bfe0;border-radius:8px;font-size:11.5px;font-weight:800;'
      +   'cursor:pointer">\ud83d\udc41\ufe0f Ver la factura #' + escaparHtml(String(t.nf)) + '</button>'
      + '</div>';
  });

  // El balance completo del cliente, que es lo que él pidió ver
  h += '<div style="background:#F4F6FB;border:1px solid #d8dcee;border-radius:10px;'
    +   'padding:11px;margin-top:4px">'
    + '<div style="font-size:11px;font-weight:800;color:#1a237e;letter-spacing:.4px;margin-bottom:6px">'
    +   'SU BALANCE AHORA</div>'
    + '<div style="display:flex;justify-content:space-between;font-size:12.5px;color:#666;padding:2px 0">'
    +   '<span>Deb\u00eda en total</span><span>$' + fmtNum(deudaAntes) + '</span></div>'
    + '<div style="display:flex;justify-content:space-between;font-size:15px;font-weight:900;'
    +   'padding:4px 0;color:' + (deudaDespues > 0.005 ? '#C62828' : '#2E7D32') + '">'
    +   '<span>Ahora debe</span><span>$' + fmtNum(deudaDespues) + '</span></div>'
    + '<div style="display:flex;justify-content:space-between;font-size:12.5px;padding-top:5px;'
    +   'margin-top:4px;border-top:1px solid #d8dcee;color:'
    +   (queda > 0.005 ? '#E65100' : '#666') + ';font-weight:' + (queda > 0.005 ? '800' : '600') + '">'
    +   '<span>Cr\u00e9dito que le queda</span><span>$' + fmtNum(queda) + '</span></div>'
    + '</div>';

  h += '<button onclick="cerrarCreditoAplicado()" style="width:100%;padding:13px;margin-top:12px;'
    +   'background:#2E7D32;color:#fff;border:none;border-radius:10px;font-size:14px;'
    +   'font-weight:800;cursor:pointer">\u2713 Entendido</button>'
    + '</div>';

  ov.innerHTML = h;
  ov.style.display = 'flex';
}

function cerrarCreditoAplicado(){
  var ov = document.getElementById('credito-aplicado-overlay');
  if(ov) ov.style.display = 'none';
}


function abrirAbono(cid){
  cxcClienteId = cid;
  ventas = LS('nv',[]);
  clientes = LS('ncl',[]);
  var facturasC = ventas.filter(function(v){
    if(String(v.cid) !== String(cid) || v.cancelada) return false;
    if(v.tipo === 'credito') return true;
    // Y las de contado MODIFICADAS que quedaron debiendo: si no, no se pueden cobrar
    return cobradoYDebeDe(v).debe > 0.005;
  });
  if(!facturasC.length) return;
  var cl = clientes.find(function(x){ return String(x.id)===String(cid); });
  var cn = cl ? nombreCl(cl) : facturasC[0].cn;
  var negocioTxt = cl && cl.negocio ? cl.negocio.trim() : '';
  document.getElementById('cxc-lista').style.display = 'none';
  document.getElementById('cxc-abono').style.display = 'block';
  document.getElementById('cxc-nombre').innerHTML = escaparHtml(cn) + (negocioTxt ? '<div style="font-size:14px;font-weight:600;color:var(--nbs-muted);margin-top:2px;display:flex;align-items:center;gap:5px">🏪'+escaparHtml(negocioTxt)+'</div>' : '');
  var totalFacturado = 0;
  var totalPagado = 0;
  facturasC.forEach(function(v){
    totalFacturado += v.total;
    if(v.pagosFactura && (v.pagosFactura || []).length){
      totalPagado += (v.pagosFactura || []).filter(function(p){return typeof p.monto==='number';}).reduce(function(s,p){return s+p.monto;},0);
    }
  });
  var saldoReal = Math.max(0, totalFacturado - totalPagado);
  var clParaCredito = clientes.find(function(x){ return String(x.id)===String(cid); });
  var creditoParaMostrar = clParaCredito ? (clParaCredito.creditoAFavor||0) : 0;
  document.getElementById('cxc-saldo-txt').innerHTML = 
    '<span style="color:var(--nbs-red-dark);font-weight:700">Balance: $'+fmtNum(saldoReal)+'</span>' +
    ' | <span style="color:var(--nbs-green-text);font-weight:700">Pagado: $'+fmtNum(totalPagado)+'</span>' +
    ' | <span style="color:var(--nbs-muted)">Total factura: $'+fmtNum(totalFacturado)+'</span>' +
    (creditoParaMostrar>0.01 ? '<br><span style="color:#E65100;font-weight:700">💰 Tiene ($'+fmtNum(creditoParaMostrar)+') de crédito a favor</span>' : '');
  pintarCreditoAFavor(cid, saldoReal);

  var el = document.getElementById('cxc-facturas');
  el.innerHTML = '';

  // Show invoices with pending balance
  var facturasCredito = ventas.filter(function(v){
    if(String(v.cid) !== String(cid)) return false;
    if(v.tipo === 'credito') return true;
    return cobradoYDebeDe(v).debe > 0.005;
  });
  // \ud83d\udcc4 IGUAL QUE EN LA FICHA DEL CLIENTE -Sensei, 27 ago-: "ese mismo cambio debiste
  // haberlo hecho cuando entro a cuentas por cobrar, ¿no crees?". Tenia razon, y aqui pesa
  // MAS todavia: esta es LA pantalla de cobrar.
  //
  // \ud83d\udd34 Y estaba ordenada de la MAS NUEVA a la mas vieja, o sea al reves de como se
  // cobra. La que hay que cobrar primero quedaba abajo del todo.
  var _conSaldoCxC = [], _saldadasCxC = [];
  facturasCredito.forEach(function(v){
    var sal = cobradoYDebeDe(v).debe;
    if(!v.cancelada && esSaldoPendiente(sal)) _conSaldoCxC.push(v);
    else _saldadasCxC.push(v);
  });
  // Las que DEBEN: de la mas vieja a la mas nueva. Esa es la que toca cobrar.
  _conSaldoCxC.sort(function(a, b){
    var fa = parsearFechaVenta(a.fecha), fb = parsearFechaVenta(b.fecha);
    return (fa ? fa.getTime() : 0) - (fb ? fb.getTime() : 0);
  });
  // Las saldadas y las canceladas: de la mas nueva a la mas vieja, que es como se consultan.
  _saldadasCxC.sort(function(a, b){
    var c = (a.cancelada ? 1 : 0) - (b.cancelada ? 1 : 0);
    if(c !== 0) return c;
    var fa = parsearFechaVenta(a.fecha), fb = parsearFechaVenta(b.fecha);
    return (fb ? fb.getTime() : 0) - (fa ? fa.getTime() : 0);
  });
  facturasCredito = _conSaldoCxC.concat(_saldadasCxC);



  if(facturasCredito.length){
    // ═══ ARREGLO CRITICO (22 jul 2026) ═══
    // ANTES: aqui se borraba cualquier pago con el mismo monto+fecha que otro.
    // Eso BORRABA DINERO REAL: si un cliente abonaba $20 hoy y mas tarde el
    // mismo dia abonaba otros $20, el segundo desaparecia -y la app decia que
    // el pago se habia aplicado correctamente-.
    // AHORA: solo se quita lo que de verdad esta repetido, o sea lo que tiene
    // el MISMO identificador de pago (pid). Dos pagos distintos del mismo monto
    // y el mismo dia son dos pagos distintos, y los dos se respetan.
    var huboLimpieza = false;
    facturasCredito.forEach(function(v){
      if(v.pagosFactura && (v.pagosFactura || []).length > 1){
        var vistos = {};
        var antes = (v.pagosFactura || []).length;
        v.pagosFactura = (v.pagosFactura || []).filter(function(p){
          if(!p || !p.pid) return true;       // sin identificador: NUNCA se borra
          if(vistos[p.pid]) return false;     // mismo pid = el mismo pago guardado dos veces
          vistos[p.pid] = true;
          return true;
        });
        if((v.pagosFactura || []).length !== antes) huboLimpieza = true;
      }
    });
    if(huboLimpieza) SS('nv', ventas);

    var div = document.createElement('div');
    div.style.cssText = 'font-size:12px;font-weight:700;color:#6A1B9A;margin-bottom:8px;text-transform:uppercase';
    div.textContent = 'Facturas a credito';
    el.appendChild(div);

    // Un rotulo antes de las saldadas, y a partir de ahi van en una linea cada una.
    var _yaPuseRotuloSaldadas = false;

    facturasCredito.forEach(function(v, _iCxC){
      var pagadoFactura = 0;
      if(v.pagosFactura) pagadoFactura = (v.pagosFactura || []).filter(function(p){return p.monto!==undefined&&typeof p.monto==='number';}).reduce(function(s,p){return s+p.monto;},0);
      // \ud83d\udd11 La regla unica, como en el resto de la app. Antes era total - pagos a mano.
      var saldoFactura = cobradoYDebeDe(v).debe;
      if(saldoFactura < 0) saldoFactura = 0;

      var _debeEsta = !v.cancelada && esSaldoPendiente(saldoFactura);
      var _laViejaCxC = _debeEsta && (_iCxC === 0) && (_conSaldoCxC.length > 1);

      // ── LAS SALDADAS Y LAS CANCELADAS: una linea, sin ocupar media pantalla ──
      if(!_debeEsta){
        if(!_yaPuseRotuloSaldadas){
          _yaPuseRotuloSaldadas = true;
          var rot = document.createElement('div');
          rot.style.cssText = 'font-size:10px;font-weight:800;color:var(--nbs-muted);letter-spacing:.6px;margin:12px 0 4px';
          rot.textContent = (_conSaldoCxC.length ? 'YA SALDADAS' : 'TODAS SALDADAS \u2014 no te debe nada')
            + ' (' + _saldadasCxC.length + ')';
          el.appendChild(rot);
        }
        var fila = document.createElement('div');
        fila.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:8px;'
          + 'padding:6px 10px;border-bottom:1px solid #F2F2F5;cursor:pointer;font-size:11.5px'
          + (v.cancelada ? ';opacity:.65' : '');
        fila.innerHTML = '<span style="color:var(--nbs-muted)' + (v.cancelada ? ';text-decoration:line-through' : '') + '">'
          + escaparHtml(v.fecha || '') + '</span>'
          + '<span style="display:flex;gap:9px;align-items:center;flex-shrink:0">'
          + '<span style="font-weight:700;color:var(--nbs-ink)">$' + fmtNum(v.total) + '</span>'
          + '<span style="font-size:10px;font-weight:700;color:' + (v.cancelada ? '#B71C1C' : 'var(--nbs-green-text)') + '">'
          + (v.cancelada ? 'cancelada' : 'pagada') + '</span></span>';
        fila.onclick = (function(vid){ return function(){ verFacturaProfesional(vid); }; })(v.id);
        el.appendChild(fila);
        return;
      }

      var card = document.createElement('div');
      card.style.cssText = 'background:#F8F4FF;border-radius:10px;padding:' + (_laViejaCxC ? '13px' : '12px')
        + ';margin-bottom:8px;border-left:' + (_laViejaCxC ? '7px' : '3px') + ' solid #C62828'
        + (_laViejaCxC ? ';border:2px solid #C62828;border-left:7px solid #C62828;box-shadow:0 2px 8px rgba(198,40,40,.16)' : '');
      card.innerHTML = (_laViejaCxC ? '<div style="font-size:9.5px;font-weight:900;color:#C62828;letter-spacing:.7px;margin-bottom:4px">\u2b50 LA M\u00c1S VIEJA \u2014 C\u00d3BRALE ESTA PRIMERO</div>' : '')
        +'<div style="display:flex;justify-content:space-between;margin-bottom:6px;gap:10px">'
        +'<div><div style="font-size:13px;font-weight:700">Factura '+(v.numFactura?'#'+v.numFactura+' · ':'')+v.fecha+' - '+v.hora+'</div>'
        +'<div style="font-size:11px;color:#aaa">Total factura: $'+fmtNum(v.total)+'</div></div>'
        +'<div style="text-align:right;flex-shrink:0">'
        +'<div style="font-size:9.5px;font-weight:800;color:#B0757A;letter-spacing:.4px">DEBE</div>'
        +'<div style="font-size:'+(_laViejaCxC?'26px':'19px')+';font-weight:900;color:#C62828;line-height:1.05;letter-spacing:-0.6px">$'+fmtNum(saldoFactura)+'</div>'
        +'</div></div>'
        +'<button type="button" onclick="verFacturaProfesional(\''+v.id+'\')" style="width:100%;padding:8px;background:#E8EAF6;color:#1a237e;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;margin-bottom:8px">👁️ Ver factura completa / Editar productos y pagos</button>';

      // Items of the invoice
      var items = (v.items && (v.items || []).length) ? (v.items || []).map(function(it){ return it.nombre+' x'+it.cant; }).join(', ') : '';
      var itemDiv = document.createElement('div');
      itemDiv.style.cssText = 'font-size:11px;color:#777;margin-bottom:8px;border-top:1px solid #eee;padding-top:6px';
      itemDiv.textContent = items;
      card.appendChild(itemDiv);

      // Payment history for this invoice
      if(v.pagosFactura && (v.pagosFactura || []).length){
        var ph = document.createElement('div');
        ph.style.cssText = 'font-size:11px;font-weight:700;color:#6A1B9A;margin-bottom:4px';
        ph.textContent = 'Pagos aplicados:';
        card.appendChild(ph);
        (v.pagosFactura || []).forEach(function(p, pidx){
          if(!p.monto || p.monto <= 0) return;
          var pr = document.createElement('div');
          pr.style.cssText = 'display:flex;justify-content:space-between;align-items:center;font-size:12px;padding:4px 0;border-bottom:0.5px solid #f0f0f0';
          
          var infoSpan = document.createElement('span');
          infoSpan.style.cssText = 'color:#555;flex:1';
          var detalleMetodos = (p.metodos && p.metodos.length) ? p.metodos.map(function(m){ return METODOS_PAGO_LABELS[m.tipo]+' $'+fmtNum(m.monto); }).join(' + ') : '';
          infoSpan.innerHTML = (p.fecha||'') + (p.nota?' · '+p.nota:'') + (detalleMetodos ? '<div style="font-size:10px;color:#6A1B9A;margin-top:2px">'+detalleMetodos+'</div>' : '');
          
          var montoSpan = document.createElement('span');
          montoSpan.style.cssText = 'color:'+(p.esDevolucion?'#E65100':'#2E7D32')+';font-weight:700;margin:0 8px';
          montoSpan.textContent = (p.esDevolucion?'↩️ +$':'+$')+fmtNum(p.monto);
          
          var btnEdit = document.createElement('button');
          btnEdit.textContent = '✏️';
          btnEdit.style.cssText = 'background:#E8EAF6;border:none;border-radius:6px;padding:3px 7px;cursor:pointer;font-size:12px;margin-right:4px';
          btnEdit.onclick = (function(vid, pi){ return function(){
            abrirEditorPago(vid, pi);
          }; })(v.id, pidx);

          var btnDel = document.createElement('button');
          btnDel.textContent = '🗑️';
          btnDel.style.cssText = 'background:#FFEBEE;border:none;border-radius:6px;padding:3px 7px;cursor:pointer;font-size:12px';
          btnDel.onclick = (function(vid, pi, pm){ return function(){
            if(!confirm('¿Borrar este abono de $'+fmtNum(pm)+'?')) return;
            ventas = LS('nv',[]);
            var vf = ventas.find(function(x){ return String(x.id) === String(vid); });
            if(vf && vf.pagosFactura){
              vf.pagosFactura.splice(pi, 1);
              SS('nv', ventas);
              abrirAbono(cxcClienteId);
            }
          }; })(v.id, pidx, p.monto);

          pr.appendChild(infoSpan);
          pr.appendChild(montoSpan);
          pr.appendChild(btnEdit);
          pr.appendChild(btnDel);
          card.appendChild(pr);
        });
      }

      // Button to apply payment to THIS invoice (con soporte para varias formas de pago a la vez)
      // 🔴 A una factura CANCELADA no se le cobra. Antes salían igual los botones
      // "Pagar todo en efectivo" y "Registrar pago", y un toque por error le metía
      // al negocio un cobro de dinero que no existe. -1 ago, lo encontró Sensei-
      if(esSaldoPendiente(saldoFactura) && !v.cancelada){
        if(!window._pagoMetodos) window._pagoMetodos = {};
        window._pagoMetodos[v.id] = [{tipo:'efectivo', monto:0}];

        var pagoDiv = document.createElement('div');
        pagoDiv.style.cssText = 'margin-top:8px;border-top:1px solid #f0f0f0;padding-top:8px';
        pagoDiv.innerHTML = '<button type="button" onclick="pagarTodoEfectivo(\''+v.id+'\','+saldoFactura+')" style="width:100%;padding:13px;background:#00838F;color:white;border:none;border-radius:8px;font-size:15px;font-weight:800;cursor:pointer;margin-bottom:10px">💵 Pagar todo en efectivo ($'+fmtNum(saldoFactura)+')</button>'
          +'<div style="font-size:11px;color:#6A1B9A;font-weight:700;margin-bottom:4px;letter-spacing:0.5px">💰 APLICAR PAGO</div>'
          +'<div style="font-size:12px;color:#aaa;margin-bottom:8px">Saldo pendiente: $'+fmtNum(saldoFactura)+'</div>'
          // 📅 QUÉ DÍA TE PAGÓ -2 sep-. Viene la de hoy; se cambia si el pago fue otro día.
          +'<div style="font-size:11px;color:#555;font-weight:700;margin-bottom:3px">📅 ¿QUÉ DÍA TE PAGÓ?</div>'
          +'<input type="date" id="cxc-fecha-'+v.id+'" style="width:100%;padding:9px;border:1px solid #ddd;border-radius:8px;font-size:13px;margin-bottom:8px">'
          +'<div id="pago-metodos-'+v.id+'"></div>'
          +'<button type="button" onclick="agregarMetodoPago(\''+v.id+'\')" style="background:none;border:1px dashed #ccc;border-radius:8px;padding:6px 10px;font-size:11px;color:#6A1B9A;cursor:pointer;margin:4px 0 8px;width:100%">+ Agregar otra forma de pago</button>'
          +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">'
          +'<span style="font-size:12px;color:#555;font-weight:600">Total a registrar:</span>'
          +'<span id="pago-total-'+v.id+'" style="font-size:16px;font-weight:800;color:#2E7D32">$0.00</span>'
          +'</div>'
          +'<button id="btn-'+v.id+'" style="width:100%;padding:12px;background:#6A1B9A;color:white;border:none;border-radius:8px;cursor:pointer;font-size:14px;font-weight:700">✓ Registrar pago</button>';

        var aplicarBtn = pagoDiv.querySelector('#btn-'+v.id);
        aplicarBtn.onclick = (function(vid, saldo){ return function(){ confirmarPagoMultiple(vid, saldo); }; })(v.id, saldoFactura);
        card.appendChild(pagoDiv);
        // 📅 La fecha se pone al final, cuando la tarjeta ya esta en la pagina. -2 sep-
        (function(vid){ setTimeout(function(){ ponerHoyEnCampo('cxc-fecha-' + vid); }, 0); })(v.id);
        renderMetodosPago(v.id);
      }
      el.appendChild(card);
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  EDITOR DE PAGOS (corregir monto, fecha y método de un pago ya registrado)
//  Pedido por Sensei el 18 jul 2026. Vive en el detalle de la factura (CxC).
//  Al guardar o borrar, el saldo del cliente se recalcula solo (lo hace abrirAbono).
// ═══════════════════════════════════════════════════════════════════════════

// Convierte 'MM/DD/YYYY' -> 'YYYY-MM-DD' (para el input date). Si no puede, hoy.
function abrirEditorPago(vid, pidx){
  ventas = LS('nv', []);
  // 🔴 Comparar como TEXTO en los dos lados: los botones pasan el id como texto
  // (con _arg) y aquí se comparaba con === estricto contra un número, así que
  // nunca encontraba el pago. Sensei lo cazó con una foto. -15 ago-
  var vf = ventas.find(function(x){ return String(x.id) === String(vid); });
  if(!vf || !vf.pagosFactura || vf.pagosFactura[pidx] === undefined){ alert('No se encontró el pago.'); return; }
  var pago = vf.pagosFactura[pidx];

  // Armar las filas de métodos a partir del pago existente:
  //  - Si el pago ya tenía métodos múltiples (metodos[]), usarlos tal cual.
  //  - Si tenía un solo método, hacer UNA fila con ese método y el monto total.
  var filas;
  if(pago.metodos && pago.metodos.length){
    filas = pago.metodos.map(function(m){ return { tipo: m.tipo || 'efectivo', monto: m.monto || 0 }; });
  } else {
    filas = [{ tipo: pago.metodo || 'efectivo', monto: pago.monto || 0 }];
  }
  window._editPagoMetodos = filas;

  var overlay = document.getElementById('editor-pago-overlay');
  if(!overlay){
    overlay = document.createElement('div');
    overlay.id = 'editor-pago-overlay';
    document.body.appendChild(overlay);
  }
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px';

  overlay.innerHTML =
    '<div style="background:white;border-radius:14px;padding:18px;max-width:400px;width:100%;max-height:90vh;overflow-y:auto">'
    +'<div style="font-size:16px;font-weight:800;color:#1a237e;margin-bottom:14px">✏️ Corregir pago</div>'
    +'<label style="font-size:11px;color:#888;font-weight:700;display:block;margin-bottom:5px">FECHA</label>'
    +'<input id="editor-pago-fecha" type="date" value="'+fechaUSAaISO(pago.fecha)+'" style="width:100%;padding:11px;border:1px solid #ccc;border-radius:8px;font-size:15px;margin-bottom:16px;box-sizing:border-box">'
    +'<label style="font-size:11px;color:#888;font-weight:700;display:block;margin-bottom:6px">CÓMO SE PAGÓ (puedes dividirlo)</label>'
    +'<div id="editor-pago-filas" style="margin-bottom:8px"></div>'
    +'<button type="button" onclick="agregarFilaEditPago()" style="width:100%;background:none;border:1px dashed #bbb;border-radius:8px;padding:9px;color:#555;font-size:13px;font-weight:600;cursor:pointer;margin-bottom:14px">+ Agregar otro método</button>'
    +'<div style="display:flex;justify-content:space-between;align-items:center;background:#F0F0F5;border-radius:8px;padding:11px;margin-bottom:16px">'
    +'<span style="font-size:13px;color:#555;font-weight:600">Monto total del pago:</span>'
    +'<span id="editor-pago-total" style="font-size:18px;font-weight:800;color:#2E7D32">$0.00</span>'
    +'</div>'
    +'<div style="display:flex;gap:8px;margin-bottom:10px">'
    +'<button onclick="guardarEditorPago('+vid+','+pidx+')" style="flex:1;padding:12px;background:#2E7D32;color:white;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer">✓ Guardar cambios</button>'
    +'<button onclick="cerrarEditorPago()" style="flex:1;padding:12px;background:#F0F0F5;color:#333;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer">Cancelar</button>'
    +'</div>'
    +'<button onclick="borrarPagoDesdeEditor('+vid+','+pidx+')" style="width:100%;padding:11px;background:#FFEBEE;color:#C62828;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer">🗑️ Borrar este pago</button>'
    +'</div>';

  renderFilasEditPago();
}

// Dibuja las filas de métodos (cada una: menú de método + monto + botón quitar)
function cerrarEditorPago(){
  var o = document.getElementById('editor-pago-overlay');
  if(o) o.style.display = 'none';
}

function guardarEditorPago(vid, pidx){
  var fechaISO = document.getElementById('editor-pago-fecha').value;
  if(!fechaISO){ alert('Elige una fecha.'); return; }

  var filas = (window._editPagoMetodos || []).filter(function(m){ return (m.monto||0) > 0; });
  if(!filas.length){ alert('Pon al menos un método con monto mayor a cero.'); return; }
  var montoTotal = filas.reduce(function(s,m){ return s+(m.monto||0); }, 0);
  if(montoTotal <= 0){ alert('El monto total debe ser mayor a cero.'); return; }

  ventas = LS('nv', []);
  // 🔴 Comparar como TEXTO en los dos lados: los botones pasan el id como texto
  // (con _arg) y aquí se comparaba con === estricto contra un número, así que
  // nunca encontraba el pago. Sensei lo cazó con una foto. -15 ago-
  var vf = ventas.find(function(x){ return String(x.id) === String(vid); });
  if(!vf || !vf.pagosFactura || vf.pagosFactura[pidx] === undefined){ alert('No se encontró el pago.'); return; }

  vf.pagosFactura[pidx].monto = montoTotal;
  vf.pagosFactura[pidx].fecha = fechaISOaUSA(fechaISO);
  if(filas.length === 1){
    // Un solo método: guardar como método simple y limpiar el array múltiple
    vf.pagosFactura[pidx].metodo = filas[0].tipo;
    if(vf.pagosFactura[pidx].metodos) delete vf.pagosFactura[pidx].metodos;
  } else {
    // Varios métodos: guardar el array y dejar metodo como el primero (por compatibilidad)
    vf.pagosFactura[pidx].metodos = filas.map(function(m){ return { tipo:m.tipo, monto:m.monto }; });
    vf.pagosFactura[pidx].metodo = filas[0].tipo;
  }
  SS('nv', ventas);
  cerrarEditorPago();
  // Si se abrió desde el editor de la factura, volver AHÍ. Una factura saldada no
  // sale en Cuentas por Cobrar, así que abrirAbono dejaría la pantalla vacía. -15 ago-
  if(window._pagoVuelveACuenta){
    // Si se abrió desde la cuenta del cliente, volver AHÍ. -15 ago-
    var _vc = window._pagoVuelveACuenta;
    window._pagoVuelveACuenta = null;
    try { repintarCuentaCliente(_vc); } catch(e){}
    try { renderCxC(''); } catch(e){}
  } else if(window._pagoVuelveAFactura){
    var _vf = window._pagoVuelveAFactura;
    window._pagoVuelveAFactura = null;
    try { pintarPagosEnEditorFactura(_vf); } catch(e){}
    try { renderCxC(''); } catch(e){}
  } else {
    abrirAbono(cxcClienteId); // recalcula el saldo y refresca la pantalla
  }
  alert('\u2705 Pago corregido. El saldo se actualiz\u00f3.');
}

function cobrosDelCliente(cid){
  var vs = LS('nv', []).filter(function(v){ return String(v.cid) === String(cid); });
  var porRecibo = {};

  vs.forEach(function(v){
    (v.pagosFactura || []).forEach(function(p, idx){
      if(typeof p.monto !== 'number') return;
      if(p.esDevolucion) return;
      var clave = p.recibo ? ('R:' + p.recibo) : ('F:' + (p.fecha || '?') + '|' + (p.metodo || ''));
      if(!porRecibo[clave]){
        porRecibo[clave] = {
          recibo: p.recibo || null,
          conRecibo: !!p.recibo,
          fecha: p.fecha || '',
          hora: p.hora || '',
          montoCobro: (typeof p.montoCobro === 'number') ? p.montoCobro : 0,
          partes: [],
          suma: 0
        };
      }
      var g = porRecibo[clave];
      g.partes.push({
        vid: v.id, idx: idx, numFactura: v.numFactura || '', fechaFactura: v.fecha || '',
        monto: p.monto, metodo: p.metodo || '', metodos: p.metodos || null, nota: p.nota || ''
      });
      g.suma = Math.round((g.suma + p.monto) * 100) / 100;
      if(!g.hora && p.hora) g.hora = p.hora;
    });
  });

  var lista = Object.keys(porRecibo).map(function(k){
    var g = porRecibo[k];
    // Si no venía apuntado cuánto fue el cobro completo, es la suma de sus partes
    if(!g.montoCobro) g.montoCobro = g.suma;
    g.clave = k;
    return g;
  });
  lista.sort(function(a, b){
    var fa = parsearFechaVenta(a.fecha), fb = parsearFechaVenta(b.fecha);
    return (fb ? fb.getTime() : 0) - (fa ? fa.getTime() : 0);
  });
  return lista;
}

// Cómo pagó: en cristiano, juntando las formas de pago de todas sus partes.
function abrirEstadoDeCuenta(cid){
  clientes = LS('ncl', []);
  var c = clientes.find(function(x){ return String(x.id) === String(cid); });
  if(!c){ alert('No encontré ese cliente.'); return; }
  window._estadoCuentaCid = cid;
  window._cobroAbierto = null;

  var ov = document.getElementById('estado-cuenta-overlay');
  if(!ov){
    ov = document.createElement('div');
    ov.id = 'estado-cuenta-overlay';
    document.body.appendChild(ov);
  }
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:99999;'
    + 'display:flex;align-items:flex-end;justify-content:center';
  ov.innerHTML = '<div id="estado-cuenta-caja" style="background:#fff;width:100%;max-width:520px;'
    + 'border-radius:16px 16px 0 0;padding:14px;max-height:94vh;overflow:auto"></div>';
  pintarEstadoDeCuenta();
}

function cerrarEstadoDeCuenta(){
  var ov = document.getElementById('estado-cuenta-overlay');
  if(ov) ov.style.display = 'none';
}

function pintarEstadoDeCuenta(){
  var caja = document.getElementById('estado-cuenta-caja');
  if(!caja) return;
  var cid = window._estadoCuentaCid;
  clientes = LS('ncl', []);
  ventas = LS('nv', []);
  var c = clientes.find(function(x){ return String(x.id) === String(cid); });
  if(!c) return;

  var vs = ventas.filter(function(v){ return String(v.cid) === String(cid); });
  var cobros = cobrosDelCliente(cid);

  // Los números de arriba
  var totalFacturado = 0, totalDebe = 0;
  vs.forEach(function(v){
    if(v.cancelada) return;
    totalFacturado += parseFloat(v.total) || 0;
    totalDebe += cobradoYDebeDe(v).debe;
  });
  totalFacturado = Math.round(totalFacturado * 100) / 100;
  totalDebe = Math.round(totalDebe * 100) / 100;
  var totalCobrado = Math.round(cobros.reduce(function(a, g){ return a + g.suma; }, 0) * 100) / 100;
  var creditoAFavor = parseFloat(c.creditoAFavor) || 0;
  var hayViejos = cobros.some(function(g){ return !g.conRecibo; });

  var h = '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:4px">'
    + '<div style="min-width:0">'
    +   '<div style="font-size:17px;font-weight:900;color:var(--nbs-ink);line-height:1.1">' + escaparHtml(nombreCl(c)) + '</div>'
    +   '<div style="font-size:12px;color:var(--nbs-muted)">' + escaparHtml(c.negocio || '') + '</div>'
    + '</div>'
    + '<button onclick="cerrarEstadoDeCuenta()" style="background:#F0F0F2;border:none;border-radius:8px;'
    +   'width:32px;height:32px;font-size:15px;cursor:pointer;flex-shrink:0">✕</button>'
    + '</div>'
    + '<div style="font-size:11px;color:var(--nbs-muted);font-weight:800;letter-spacing:.5px;margin-bottom:10px">🧾 ESTADO DE CUENTA</div>';

  h += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:12px">'
    + '<div style="background:#E3F2FD;border-radius:9px;padding:9px 6px;text-align:center">'
    +   '<div style="font-size:9px;color:#666;font-weight:800">LE FACTURÉ</div>'
    +   '<div style="font-size:15px;font-weight:900;color:#1565C0">$' + fmtNum(totalFacturado) + '</div></div>'
    + '<div style="background:#E8F5E9;border-radius:9px;padding:9px 6px;text-align:center">'
    +   '<div style="font-size:9px;color:#666;font-weight:800">ME PAGÓ</div>'
    +   '<div style="font-size:15px;font-weight:900;color:#2E7D32">$' + fmtNum(totalCobrado) + '</div></div>'
    + '<div style="background:' + (totalDebe > 0.005 ? '#FFEBEE' : '#E8F5E9') + ';border-radius:9px;padding:9px 6px;text-align:center">'
    +   '<div style="font-size:9px;color:#666;font-weight:800">DEBE</div>'
    +   '<div style="font-size:15px;font-weight:900;color:' + (totalDebe > 0.005 ? '#C62828' : '#2E7D32') + '">$' + fmtNum(totalDebe) + '</div></div>'
    + '</div>';

  if(creditoAFavor > 0.005){
    h += '<div style="background:#FFF8E1;border:1px solid #FFD54F;border-radius:9px;padding:8px 11px;margin-bottom:10px;font-size:12.5px;font-weight:700;color:#8a6d00">'
      + '💰 Tiene $' + fmtNum(creditoAFavor) + ' a favor, para su próxima compra.</div>';
  }

  // ── LOS COBROS ──
  h += '<div style="font-size:11px;font-weight:800;color:var(--nbs-muted);letter-spacing:.5px;margin:14px 0 6px">'
    + '💵 SUS PAGOS (' + cobros.length + ')</div>';

  if(hayViejos){
    h += '<div style="background:#FFF8E1;border-radius:8px;padding:8px 10px;margin-bottom:8px;font-size:11px;color:#8a6d00;line-height:1.45">'
      + '⚠️ Los pagos de antes del 29 de agosto no llevan número de recibo. Esos se agrupan por '
      + 'fecha, así que si en un mismo día le cobraste dos veces, aquí salen juntos. Los de ahora '
      + 'en adelante llevan su recibo y salen exactos.</div>';
  }

  if(!cobros.length){
    h += '<div style="font-size:12.5px;color:var(--nbs-muted);padding:6px 0">Todavía no te ha pagado nada.</div>';
  }

  cobros.forEach(function(g){
    var abierto = (window._cobroAbierto === g.clave);
    var varias = g.partes.length > 1;
    h += '<div style="border:1px solid ' + (abierto ? '#2E7D32' : 'var(--nbs-line)') + ';border-radius:10px;'
      + 'margin-bottom:7px;overflow:hidden">'
      + '<div onclick="toggleCobroEstado(\'' + g.clave.replace(/'/g, "\\'") + '\')" '
      +   'style="display:flex;align-items:center;gap:10px;padding:10px 11px;cursor:pointer;'
      +   'background:' + (abierto ? '#E8F5E9' : '#fff') + '">'
      +   '<div style="flex:1;min-width:0">'
      +     '<div style="font-size:14px;font-weight:900;color:#2E7D32">$' + fmtNum(g.montoCobro) + '</div>'
      +     '<div style="font-size:11px;color:var(--nbs-muted);margin-top:1px">'
      +       escaparHtml(g.fecha) + (g.hora ? ' · ' + escaparHtml(g.hora) : '')
      +       (g.recibo ? ' · ' + escaparHtml(g.recibo) : '')
      +     '</div>'
      +     (comoPagoElCobro(g) ? '<div style="font-size:11px;color:#555;margin-top:2px">' + escaparHtml(comoPagoElCobro(g)) + '</div>' : '')
      +   '</div>'
      +   '<div style="text-align:right;flex-shrink:0">'
      +     (varias ? '<div style="font-size:10.5px;font-weight:800;color:#1565C0">se repartió en ' + g.partes.length + '</div>' : '')
      +     '<div style="font-size:14px;color:var(--nbs-muted)">' + (abierto ? '⌃' : '›') + '</div>'
      +   '</div>'
      + '</div>';

    if(abierto){
      h += '<div style="padding:9px 11px;background:#FAFAFC;border-top:1px solid var(--nbs-line)">'
        + '<div style="font-size:10.5px;font-weight:800;color:var(--nbs-muted);margin-bottom:5px">A QUÉ FACTURAS SE APLICÓ</div>';
      g.partes.forEach(function(p){
        h += '<div style="display:flex;justify-content:space-between;gap:10px;padding:5px 0;border-bottom:1px solid #F0F0F3">'
          + '<span style="font-size:12px;color:var(--nbs-ink);flex:1;min-width:0">'
          +   (p.numFactura ? '#' + escaparHtml(String(p.numFactura)) + ' · ' : '') + escaparHtml(p.fechaFactura)
          + '</span>'
          + '<span style="font-size:12.5px;font-weight:800;color:#2E7D32;flex-shrink:0">$' + fmtNum(p.monto) + '</span>'
          + '</div>';
      });
      if(Math.abs(g.montoCobro - g.suma) > 0.005){
        h += '<div style="font-size:11px;color:#8a6d00;margin-top:6px">'
          + 'Del cobro de $' + fmtNum(g.montoCobro) + ' se aplicaron $' + fmtNum(g.suma)
          + '. La diferencia ($' + fmtNum(g.montoCobro - g.suma) + ') quedó como crédito a favor.</div>';
      }
      // \ud83d\udcac EL COMPROBANTE DE ESTE PAGO EN CONCRETO, sea de cuando sea. -Sensei, 30 ago-
      // Antes el boton de abajo tomaba siempre el ULTIMO pago; no habia forma de mandarle
      // el comprobante de un cobro de hace tres semanas.
      var _cl = g.clave.replace(/'/g, "\\'");
      h += '<div style="display:flex;gap:6px;margin-top:9px">'
        + '<button onclick="event.stopPropagation();mandarComprobanteDeEstePago(\'' + _cl + '\', 1)" '
        +   'style="flex:1;padding:9px 6px;background:#128C7E;color:#fff;border:none;border-radius:8px;'
        +   'font-size:11.5px;font-weight:800;cursor:pointer">\ud83d\udcac Comprobante</button>'
        + '<button onclick="event.stopPropagation();mandarComprobanteDeEstePago(\'' + _cl + '\', 0)" '
        +   'style="flex:1;padding:9px 6px;background:#546E7A;color:#fff;border:none;border-radius:8px;'
        +   'font-size:11.5px;font-weight:800;cursor:pointer">\u270f\ufe0f Solo el corto</button>'
        + '</div>';
      h += '</div>';
    }
    h += '</div>';
  });

  // ── LAS FACTURAS ──
  var vsOrden = vs.slice().sort(function(a, b){
    var fa = parsearFechaVenta(a.fecha), fb = parsearFechaVenta(b.fecha);
    return (fb ? fb.getTime() : 0) - (fa ? fa.getTime() : 0);
  });
  h += '<div style="font-size:11px;font-weight:800;color:var(--nbs-muted);letter-spacing:.5px;margin:16px 0 6px">'
    + '📄 SUS FACTURAS (' + vsOrden.length + ')</div>';
  vsOrden.forEach(function(v){
    var debe = cobradoYDebeDe(v).debe;
    var canc = !!v.cancelada;
    var pagadaCon = (v.pagosFactura || []).filter(function(p){ return typeof p.monto === 'number' && !p.esDevolucion; });
    var pagado = pagadaCon.reduce(function(a, p){ return a + p.monto; }, 0);
    h += '<div onclick="event.stopPropagation();verFacturaProfesional(' + _arg(v.id) + ')" '
      + 'style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:8px 10px;'
      + 'border-bottom:1px solid #F2F2F5;cursor:pointer' + (canc ? ';opacity:.6' : '') + '">'
      + '<div style="flex:1;min-width:0">'
      +   '<div style="font-size:12.5px;font-weight:700;color:var(--nbs-ink)' + (canc ? ';text-decoration:line-through' : '') + '">'
      +     (v.numFactura ? '#' + escaparHtml(String(v.numFactura)) + ' · ' : '') + escaparHtml(v.fecha || '') + '</div>'
      +   '<div style="font-size:10.5px;color:var(--nbs-muted)">'
      +     ((v.items || []).length) + ' producto(s) · pagó $' + fmtNum(pagado) + ' de $' + fmtNum(v.total) + '</div>'
      + '</div>'
      + '<div style="text-align:right;flex-shrink:0">'
      +   '<div style="font-size:13px;font-weight:900;color:' + (canc ? '#B71C1C' : (debe > 0.005 ? '#C62828' : '#2E7D32')) + '">'
      +     (canc ? 'cancelada' : (debe > 0.005 ? '$' + fmtNum(debe) : 'pagada')) + '</div>'
      + '</div>'
      + '</div>';
  });

  h += '<button onclick="compartirEstadoDeCuenta()" style="width:100%;padding:13px;margin-top:16px;background:#128C7E;color:#fff;'
    +   'border:none;border-radius:10px;font-size:13px;font-weight:800;cursor:pointer">\ud83d\udcac Mandarle el estado de cuenta completo</button>'
    // \u270f\ufe0f Y el corto: cuanto pago y cuanto queda. Nada mas. -Sensei, 29 ago-
    + '<button onclick="compartirCortoDesdeEstado()" style="width:100%;padding:12px;margin-top:8px;background:#546E7A;color:#fff;'
    +   'border:none;border-radius:10px;font-size:12.5px;font-weight:800;cursor:pointer">\u270f\ufe0f Mandarle solo: cu\u00e1nto pag\u00f3 y cu\u00e1nto queda</button>'
    + '<button onclick="cerrarEstadoDeCuenta()" style="width:100%;padding:12px;margin-top:8px;background:#F0F0F2;color:#333;'
    +   'border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer">Cerrar</button>';

  caja.innerHTML = h;
}

// ═══════════════════════════════════════════════════════════════════
//  💬 EL MENSAJE PARA EL CLIENTE  (29 ago 2026)
//
//  Sensei: "me gustaría que me pudieras preparar un mensaje automático para
//  cada cliente cada vez que compre o pague, con su balance actual, para que así
//  haya una transparencia con ellos y conmigo, y eso sirve de prueba de que
//  estamos en la misma página en sus balances pendientes".
//
//  El mensaje se arma solo con lo que hay guardado. Él lo revisa y lo manda por
//  WhatsApp. No se manda nada sin que él lo vea.
// ═══════════════════════════════════════════════════════════════════

// El texto que se le manda después de una VENTA o de un COBRO.
// tipo: 'venta' o 'pago'.  monto: lo de esta operación.
function textoEstadoDeCuenta(cid){
  clientes = LS('ncl', []);
  ventas = LS('nv', []);
  var c = clientes.find(function(x){ return String(x.id) === String(cid); });
  if(!c) return '';

  var vs = ventas.filter(function(v){ return String(v.cid) === String(cid); });
  var cobros = cobrosDelCliente(cid);
  var facturado = 0, debe = 0;
  vs.forEach(function(v){
    if(v.cancelada) return;
    facturado += parseFloat(v.total) || 0;
    debe += cobradoYDebeDe(v).debe;
  });
  facturado = Math.round(facturado * 100) / 100;
  debe = Math.round(debe * 100) / 100;
  var cobrado = Math.round(cobros.reduce(function(a, g){ return a + g.suma; }, 0) * 100) / 100;

  var t = [];
  t.push('*NUNEZ BEAUTY SUPPLY*');
  t.push('*ESTADO DE CUENTA*');
  t.push(fechaHoy() + ' · ' + horaAhora());
  t.push('');
  t.push('Cliente: *' + nombreCl(c) + '*');
  if(c.negocio) t.push(c.negocio);
  t.push('');
  t.push('━━━━━━━━━━━━━━━');
  t.push('Total facturado:  $' + fmtNum(facturado));
  t.push('Total pagado:     $' + fmtNum(cobrado));
  t.push('*BALANCE:          $' + fmtNum(debe) + '*');
  t.push('━━━━━━━━━━━━━━━');
  t.push('');

  // Las que deben
  var conSaldo = vs.filter(function(v){ return !v.cancelada && esSaldoPendiente(cobradoYDebeDe(v).debe); });
  if(conSaldo.length){
    conSaldo.sort(function(a, b){
      var fa = parsearFechaVenta(a.fecha), fb = parsearFechaVenta(b.fecha);
      return (fa ? fa.getTime() : 0) - (fb ? fb.getTime() : 0);
    });
    t.push('*FACTURAS PENDIENTES*');
    conSaldo.forEach(function(v){
      t.push('• ' + (v.fecha || '') + (v.numFactura ? ' #' + v.numFactura : '')
        + ' — de $' + fmtNum(v.total) + ' debe *$' + fmtNum(cobradoYDebeDe(v).debe) + '*');
    });
    t.push('');
  }

  // Los pagos, del más nuevo al más viejo
  if(cobros.length){
    t.push('*TUS PAGOS*');
    cobros.slice(0, 20).forEach(function(g){
      var linea = '• ' + g.fecha + ' — $' + fmtNum(g.montoCobro);
      if(g.recibo) linea += ' (' + g.recibo + ')';
      t.push(linea);
      if(g.partes.length > 1){
        g.partes.forEach(function(p){
          t.push('      $' + fmtNum(p.monto) + ' → factura del ' + p.fechaFactura);
        });
      }
    });
    if(cobros.length > 20) t.push('   ...y ' + (cobros.length - 20) + ' pago(s) más.');
    t.push('');
  }

  t.push('Si algo no te cuadra, dímelo y lo revisamos juntos. 🙏');
  return t.join('\n');
}

// ✏️ EL MENSAJE CORTO  (Sensei, 29 ago)
//
// Sus palabras: "quiero tener la opción de ponerle un mensaje que diga cuánto pagó y
// cuánto queda pendiente, que el mensaje diga SOLO ESO, aparte de lo que ya hiciste".
//
// O sea: una línea y ya. Para el barbero que solo quiere saber en qué quedó. El
// comprobante completo se queda como estaba: son dos botones distintos.
// ═══════════════════════════════════════════════════════════════════
//  ✍️ CONFIRMACIÓN DEL BALANCE, FIRMADA POR EL CLIENTE  (30 ago 2026)
//
//  Sensei: "creo que debería haber una forma de que el cliente se vea obligado a
//  confirmar su balance pendiente... porque eso sería la prueba de que está de
//  acuerdo".
//
//  🔑 LA VERDAD QUE SE LE DIJO: a un cliente no se le puede OBLIGAR a contestar
//  un WhatsApp. Lo que sí se puede es tener la prueba firmada en el momento, y
//  llevar la lista de quién no ha confirmado — para resolverlo en la próxima
//  visita y no tres meses después.
//
//  Esta es la prueba fuerte: él firma en el teléfono, delante de Sensei,
//  confirmando su balance. Funciona sin internet y queda con fecha y hora.
//
//  🔒 Reusa el mismo lienzo de firma que ya existía para las ventas
//  (iniciarCanvasFirma, limpiarFirma, _firmaHayTrazo). No se duplicó nada.
// ═══════════════════════════════════════════════════════════════════

// Lo que el cliente debe hoy, con la misma regla que usa el resto de la app.
function balanceDelCliente(cid){
  ventas = LS('nv', []);
  var debe = 0;
  ventas.forEach(function(v){
    if(String(v.cid) !== String(cid) || v.cancelada) return;
    debe += cobradoYDebeDe(v).debe;
  });
  return Math.round(debe * 100) / 100;
}

function compartirEstadoDeCuenta(){
  var cid = window._estadoCuentaCid;
  if(!cid) return;
  var texto = textoEstadoDeCuenta(cid);
  mandarloAlCliente(cid, texto, 'Estado de cuenta');
}

// Manda el texto por WhatsApp si hay teléfono; si no, lo copia.
// ═══════════════════════════════════════════════════════════════════
//  📤 CUATRO FORMAS DE MANDARLE EL MENSAJE AL CLIENTE  (3 sep 2026)
//
//  Sensei: "me gustaría poder copiarlo también... hay clientes que no tienen WhatsApp
//  y tengo que enviárselo por mensaje regular, pero la opción de WhatsApp directa debe
//  permanecer también".
//
//  🔑 WhatsApp y Texto son de UN TOQUE, grandes y lado a lado. Copiar y Compartir van
//  debajo, más chicos. Y el mensaje SE COPIA SIEMPRE antes de abrir nada: así, si algo
//  falla, él lo pega y no pierde el trabajo.
// ═══════════════════════════════════════════════════════════════════

// Copia al portapapeles y dice si pudo. Se usa antes de cada envío.
var _contadorRecibo = 0;
function nuevoNumeroRecibo(){
  var d = new Date();
  var dosDig = function(n){ return (n < 10 ? '0' : '') + n; };
  // \ud83d\udd11 El contador sube SIEMPRE: dos cobros seguidos no pueden compartir numero
  // aunque caigan en el mismo minuto. Antes eran dos cifras al azar -90 posibles-, y
  // con dos barberos seguidos en la misma barberia se podian repetir: la app los
  // juntaba como UN SOLO cobro. -4 sep-
  _contadorRecibo++;
  // El contador NO da la vuelta: si diera, dos recibos del mismo segundo volverian a
  // repetirse. Con 4 cifras hay de sobra para cualquier dia de trabajo.
  var sufijo = String(_contadorRecibo).padStart(4, '0');
  return 'R' + String(d.getFullYear()).slice(2) + dosDig(d.getMonth() + 1) + dosDig(d.getDate())
       + '-' + dosDig(d.getHours()) + dosDig(d.getMinutes()) + dosDig(d.getSeconds())
       + '-' + sufijo;
}

function saldoDeCompra(c){
  var total = parseFloat(c.total) || 0;
  var pagado = (c.pagosFactura || []).filter(function(p){ return typeof p.monto === 'number'; })
                 .reduce(function(a, p){ return a + p.monto; }, 0);
  return total - pagado;
}

// 💸 PAGARLE A UN SUPLIDOR -19 ago-. Antes no habia ninguna forma de pagarle desde la
// pantalla del suplidor: habia que entrar factura por factura.
//
// 🔴 REGLA DE SENSEI, TEXTUAL: "yo elijo a que factura le aplico el pago, eso no deberia ser
// automatico en ningun caso". Por eso aqui NO se reparte nada solo, ni el sobrante. El pago va
// entero a la factura que el marque. -Lo de repartir a la mas vieja es SOLO para los pagos de
// sus CLIENTES, y eso se queda como esta.-
// ✏️ CORREGIR UN PAGO QUE YA LE HICISTE A UN SUPLIDOR -Sensei, 21 ago-.
// Sus palabras: "acabo de hacer un pago a un suplidor y se hizo el pago pero no me deja
// cambiar la fecha, ni tengo forma de editarlo, eso esta muy mal". Tenia razon: a los
// CLIENTES si se les podia corregir un cobro desde hace tiempo -abrirEditorPago-, y a los
// suplidores no habia ninguna manera. Ahora es el mismo camino en los dos lados: se puede
// cambiar la FECHA, el MONTO y la FORMA DE PAGO, o borrarlo del todo. Todo con huella.
function abrirEditorPagoCompra(cid, pidx, sid){
  var todas = LS('nc', []);
  var c = todas.find(function(x){ return String(x.id) === String(cid); });
  if(!c || !c.pagosFactura || c.pagosFactura[pidx] === undefined){ alert('No encontré ese pago.'); return; }
  var pago = c.pagosFactura[pidx];
  window._editPagoCompra = { cid: cid, pidx: pidx, sid: sid };
  window._editPagoCompraMetodo = pago.metodo || 'efectivo';

  var ov = document.getElementById('editor-pago-compra');
  if(!ov){ ov = document.createElement('div'); ov.id = 'editor-pago-compra'; document.body.appendChild(ov); }
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:99999;'
    + 'display:flex;align-items:center;justify-content:center;padding:16px';

  var h = '<div style="background:#fff;border-radius:14px;padding:16px;max-width:400px;width:100%;max-height:90vh;overflow-y:auto">'
    + '<div style="font-size:16px;font-weight:900;color:#5D4037;margin-bottom:3px">✏️ Corregir este pago</div>'
    + '<div style="font-size:11.5px;color:#888;margin-bottom:14px">Factura del '
    +   escaparHtml(c.fecha || '') + ' · ' + escaparHtml(c.sn || '') + '</div>'

    + '<div style="font-size:11px;color:#888;font-weight:800;margin-bottom:5px">QUÉ DÍA LE PAGASTE</div>'
    + '<input type="date" id="edpc-fecha" value="' + fechaUSAaISO(pago.fecha) + '" '
    +   'style="width:100%;padding:11px;border:1px solid #ccc;border-radius:8px;font-size:15px;margin-bottom:14px;box-sizing:border-box">'

    + '<div style="font-size:11px;color:#888;font-weight:800;margin-bottom:5px">CUÁNTO LE PAGASTE</div>'
    + '<input type="text" inputmode="numeric" id="edpc-monto" value="' + (parseFloat(pago.monto)||0).toFixed(2) + '" '
    +   'onfocus="this.select()" oninput="formatoMoneda(this)" '
    +   'style="width:100%;padding:11px;border:1px solid #ccc;border-radius:8px;font-size:17px;font-weight:800;'
    +   'text-align:center;margin-bottom:14px;box-sizing:border-box">'

    + '<div style="font-size:11px;color:#888;font-weight:800;margin-bottom:5px">CÓMO LE PAGASTE</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:16px">';

  METODOS_PAGO_COMPRA.forEach(function(m){
    var sel = (pago.metodo || 'efectivo') === m.tipo;
    h += '<button onclick="escogerMetodoEditPagoCompra(\'' + m.tipo + '\')" data-met="' + m.tipo + '" '
      + 'class="edpc-met" style="padding:10px 6px;border-radius:9px;cursor:pointer;font-size:12.5px;font-weight:800;'
      + (sel ? 'background:' + m.color + ';color:#fff;border:2px solid ' + m.color + ';'
             : 'background:#fff;color:' + m.color + ';border:1.5px solid ' + m.color + ';')
      + '">' + m.texto + '</button>';
  });

  h += '</div>'
    + '<div style="display:flex;gap:8px;margin-bottom:10px">'
    + '<button onclick="guardarEditorPagoCompra()" style="flex:1.4;padding:12px;background:#2E7D32;color:#fff;'
    +   'border:none;border-radius:9px;font-size:14px;font-weight:800;cursor:pointer">✓ Guardar cambios</button>'
    + '<button onclick="cerrarEditorPagoCompra()" style="flex:.8;padding:12px;background:#F0F0F5;color:#333;'
    +   'border:none;border-radius:9px;font-size:13.5px;font-weight:700;cursor:pointer">Cancelar</button>'
    + '</div>'
    + '<button onclick="borrarPagoCompra()" style="width:100%;padding:11px;background:#FFEBEE;color:#C62828;'
    +   'border:none;border-radius:9px;font-size:13px;font-weight:800;cursor:pointer">🗑️ Borrar este pago</button>'
    + '</div>';
  ov.innerHTML = h;
}

function cerrarEditorPagoCompra(){
  var ov = document.getElementById('editor-pago-compra');
  if(ov) ov.style.display = 'none';
}

function guardarEditorPagoCompra(){
  var d = window._editPagoCompra;
  if(!d) return;

  var elM = document.getElementById('edpc-monto');
  var monto = elM ? (parseFloat(String(elM.value).replace(/[$,]/g, '')) || 0) : 0;
  if(!(monto > 0.005)){
    alert('El pago tiene que ser mayor que cero.\n\nSi lo quieres quitar, usa Borrar este pago.');
    return;
  }
  var elF = document.getElementById('edpc-fecha');
  var fecha = elF && elF.value ? fechaISOaUSA(elF.value) : null;
  if(!fecha){ alert('Escoge la fecha del pago.'); return; }

  var todas = LS('nc', []);
  var c = todas.find(function(x){ return String(x.id) === String(d.cid); });
  if(!c || !c.pagosFactura || c.pagosFactura[d.pidx] === undefined){ alert('No encontré ese pago.'); return; }

  // Si con el cambio le quedaria pagado de mas, se AVISA. No se bloquea: puede haber
  // razones -un adelanto, un credito-, y el que decide es Sensei.
  var otros = c.pagosFactura.reduce(function(a, p, i){
    return a + (i === d.pidx ? 0 : (typeof p.monto === 'number' ? p.monto : 0));
  }, 0);
  var total = parseFloat(c.total) || 0;
  if(otros + monto > total + 0.005){
    if(!confirm('Con ese cambio le quedarías pagando $' + fmtNum(otros + monto)
      + ' a una factura de $' + fmtNum(total) + '.\n\n¿Guardar de todas formas?')) return;
  }

  var metodo = window._editPagoCompraMetodo || 'efectivo';
  protegerConHuella(function(){
    var t2 = LS('nc', []);
    var c2 = t2.find(function(x){ return String(x.id) === String(d.cid); });
    if(!c2 || !c2.pagosFactura || c2.pagosFactura[d.pidx] === undefined){ alert('No encontré ese pago.'); return; }
    c2.pagosFactura[d.pidx].monto = monto;
    c2.pagosFactura[d.pidx].fecha = fecha;
    c2.pagosFactura[d.pidx].metodo = metodo;
    SS('nc', t2);
    cerrarEditorPagoCompra();
    alert('✅ Pago corregido: $' + fmtNum(monto) + ' con ' + etiquetaMetodoCompra(metodo) + ' el ' + fecha + '.');
    compras = LS('nc', []);
    var cAct = compras.find(function(x){ return String(x.id) === String(d.cid); });
    if(cAct) verFacturaCompra(cAct, d.sid);
  });
}

function facturasQueDebenDe(cid, excluirVid){
  var todas = LS('nv', []);
  var lista = [];
  todas.forEach(function(v){
    if(v.cancelada) return;
    if(String(v.cid) !== String(cid)) return;
    if(String(v.id) === String(excluirVid)) return;
    // 🔑 LA REGLA ÚNICA. Antes era `total - pagado` a secas y las ventas al CONTADO
    // parecían deber todo. Lo cazaron las leyes del dinero. -17 ago-
    var _cd = cobradoYDebeDe(v);
    var pagado = _cd.cobrado;
    var saldo = _cd.debe;
    if(saldo > 0.01){
      lista.push({ id: v.id, nf: v.numFactura || String(v.id).slice(-4), fecha: v.fecha || '', saldo: saldo, cuando: parsearFechaVenta(v.fecha) });
    }
  });
  // La MAS VIEJA primero. Si 2 son del mismo dia, la que se registro antes -id mas chico-.
  lista.sort(function(a,b){
    var d = a.cuando - b.cuando;
    return d !== 0 ? d : (a.id - b.id);
  });
  return lista;
}

// Arma el plan de reparto: cuanto va a cada factura, empezando por la mas vieja
function planDeReparto(cid, vidActual, saldoActual, montoPagado){
  var plan = [];
  var aEsta = Math.min(montoPagado, saldoActual);
  if(aEsta > 0.001) plan.push({ id: vidActual, monto: aEsta, esLaActual: true });
  var sobrante = montoPagado - aEsta;
  if(sobrante <= 0.01) return { plan: plan, sinAplicar: 0 };

  var otras = facturasQueDebenDe(cid, vidActual);
  otras.forEach(function(o){
    if(sobrante <= 0.01) return;
    var aplicar = Math.min(sobrante, o.saldo);
    plan.push({ id: o.id, monto: aplicar, nf: o.nf, fecha: o.fecha, saldoAntes: o.saldo });
    sobrante -= aplicar;
  });
  return { plan: plan, sinAplicar: sobrante }; // sinAplicar = pago de mas, ya no debe nada
}

// COBRO RÁPIDO en Cuentas por Cobrar: paga TODO el saldo de la factura en efectivo,
// de un solo toque, sin elegir forma de pago ni escribir cantidad. Pedido por Sensei
// para no perder tiempo. Reutiliza confirmarPagoMultiple con el saldo completo en efectivo.
function pagarTodoEfectivo(vid, saldo){
  if(saldo <= 0){ alert('Esta factura ya está saldada.'); return; }
  if(!confirm('¿Registrar el pago COMPLETO de $'+fmtNum(saldo)+' en efectivo?')) return;
  if(!window._pagoMetodos) window._pagoMetodos = {};
  window._pagoMetodos[vid] = [{tipo:'efectivo', monto: saldo}];
  confirmarPagoMultiple(vid, saldo);
}


// ═══════════════════════════════════════════════════════════════════
//  DESCONTAR EL CRÉDITO A FAVOR QUE SE HAYA USADO EN UN PAGO (31 jul)
//
//  🔴 EL FALLO QUE ENCONTRÓ SENSEI EN LA RUTA: se abrió la opción
//  "Usar crédito del cliente" al cobrar una factura, pero el crédito
//  NUNCA se le descontaba. El mismo crédito se podía usar infinitas
//  veces, y la app contaba como cobrado un dinero que seguía existiendo.
//
//  ⚠️ OJO: `confirmarPagoMultiple` tiene DOS caminos y el normal hace
//  `return` temprano. Por eso esto vive en su propia función y se llama
//  desde LOS DOS — si solo se pusiera en uno, el fallo seguiría vivo
//  justo en el caso más común.
// ═══════════════════════════════════════════════════════════════════
function confirmarPagoMultiple(vid, saldo){
  var filas = (window._pagoMetodos[vid] || []).filter(function(m){ return m.monto > 0; });
  var total = filas.reduce(function(s,m){ return s+m.monto; }, 0);
  if(total <= 0){ alert('Ingresa un monto válido en al menos una forma de pago.'); return; }

  ventas = LS('nv',[]);
  var venta = ventas.find(function(x){ return String(x.id)===String(vid); });
  if(!venta) return;

  // Caso normal: el pago cabe en esta factura
  if(total <= saldo + 0.01){
    if(!venta.pagosFactura) venta.pagosFactura = [];
    venta.pagosFactura.push({ pid: nuevoPagoId(), monto: total, fecha: fechaDelCampo('cxc-fecha-' + vid), metodos: filas });
    SS('nv', ventas);
    // Descontarle el credito que haya usado. Este es el camino NORMAL, el mas comun
    // — y era justo el que se quedaba sin descontar. -31 jul-
    descontarCreditoUsado(venta.cid, filas);
    var detalle = filas.map(function(m){ return METODOS_PAGO_LABELS[m.tipo]+': $'+fmtNum(m.monto); }).join('\n');
    alert('✅ Pago de $'+fmtNum(total)+' aplicado correctamente.\n\n'+detalle);
    // 💬 Se le ofrece el comprobante, para que quede constancia del balance. -29 ago-
    try { ofrecerMensajeAlCliente(venta.cid, 'pago', total, null); } catch(e){}
    // Refrescar la pantalla DESPUES de cerrar el alert, con una pausa para que el telefono
    // alcance a actualizar bien y el balance nuevo se vea al instante (sin salir y entrar).
    setTimeout(function(){ abrirAbono(cxcClienteId); }, 50);
    return;
  }

  // El pago es MAYOR que lo que debe esta factura: se reparte, empezando por la mas vieja
  var r = planDeReparto(venta.cid, vid, saldo, total);
  var msj = 'El pago de $'+fmtNum(total)+' es mayor que lo que debe esta factura ($'+fmtNum(saldo)+').\n\n';
  msj += 'Se repartiría así, empezando por la factura MÁS VIEJA:\n\n';
  r.plan.forEach(function(p){
    if(p.esLaActual) msj += '   • $'+fmtNum(p.monto)+'  →  esta factura (queda saldada)\n';
    else msj += '   • $'+fmtNum(p.monto)+'  →  #'+p.nf+' del '+p.fecha+'  (debía $'+fmtNum(p.saldoAntes)+')\n';
  });
  if(r.sinAplicar > 0.01){
    // Antes esto se quedaba metido dentro de esta misma factura como "pago de mas"
    // y no se podia usar despues. Ahora (24 jul, pedido por Sensei) se guarda como
    // CREDITO A FAVOR del cliente, igual que ya se hacia con las devoluciones -asi
    // se ve en su perfil y se puede aplicar solo con "Usar credito del cliente"
    // en su proxima compra-.
    msj += '\n💰 Sobran $'+fmtNum(r.sinAplicar)+' porque el cliente ya no debe más.\n';
    msj += 'Ese sobrante se guardará como CRÉDITO A FAVOR del cliente, para usarlo en su próxima compra.\n';
  }
  msj += '\n¿Aplicar así?';
  if(!confirm(msj)) return;

  var fechaPago = fechaDelCampo('cxc-fecha-' + vid);   // 📅 la que el escogio -2 sep-
  var horaPago = horaAhora();
  // 🧾 TODAS las partes de este cobro llevan el MISMO numero de recibo, y todas apuntan
  // cuanto fue el cobro COMPLETO. Asi el estado de cuenta puede ensenar "pago de $80" y, al
  // tocarlo, en que facturas se repartio. Antes quedaban tres pagos sueltos sin nada que los
  // uniera, y por eso el cliente decia 80 y el sistema ensenaba 35. -Sensei, 29 ago-
  var _recibo = nuevoNumeroRecibo();
  var aplicados = 0;
  r.plan.forEach(function(p){
    var v = ventas.find(function(x){ return String(x.id) === String(p.id); });
    if(!v) return;
    if(!v.pagosFactura) v.pagosFactura = [];
    var monto = p.monto;
    // El sobrante YA NO se mete aqui -se guarda aparte como credito a favor-.
    var pago = { pid: nuevoPagoId(), recibo: _recibo, montoCobro: total,
                 monto: monto, fecha: fechaPago, hora: horaPago };
    if(p.esLaActual) pago.metodos = filas;
    else pago.nota = 'Parte del pago de $'+fmtNum(total)+' aplicado a la factura m\u00e1s vieja';
    v.pagosFactura.push(pago);
    aplicados++;
  });
  SS('nv', ventas);
  // Y aqui tambien, cuando el pago se reparte entre varias facturas
  descontarCreditoUsado(venta.cid, filas);

  // El dinero que sobro -el cliente ya no debia nada mas- se guarda como
  // CREDITO A FAVOR del cliente, con el mismo sistema que ya usan las
  // devoluciones (campo clientes[].creditoAFavor). Queda disponible para
  // su proxima compra con "Usar credito del cliente".
  if(r.sinAplicar > 0.01){
    clientes = LS('ncl', []);
    var clIdxSobra = clientes.findIndex(function(c){ return String(c.id) === String(venta.cid); });
    if(clIdxSobra >= 0){
      clientes[clIdxSobra].creditoAFavor = (clientes[clIdxSobra].creditoAFavor||0) + r.sinAplicar;
      SS('ncl', clientes);
    }
  }

  var resumen = '✅ Pago de $'+fmtNum(total)+' repartido en '+aplicados+' factura(s):\n\n';
  r.plan.forEach(function(p){
    resumen += (p.esLaActual ? '   • $'+fmtNum(p.monto)+'  →  esta factura\n' : '   • $'+fmtNum(p.monto)+'  →  #'+p.nf+' ('+p.fecha+')\n');
  });
  if(r.sinAplicar > 0.01){
    resumen += '\n💰 $'+fmtNum(r.sinAplicar)+' quedó como CRÉDITO A FAVOR del cliente, para su próxima compra.';
  }
  alert(resumen);
  // 💬 El comprobante, con el DETALLE de a que facturas fue cada parte. Justo lo que
  // evita la discusion de "yo te pague 80 y ahi dice 35". -29 ago-
  try {
    var _detalle = r.plan.map(function(p){ return { monto: p.monto, fecha: p.fecha || fechaHoy() }; });
    ofrecerMensajeAlCliente(venta.cid, 'pago', total, _detalle);
  } catch(e){}
  // Refrescar la pantalla DESPUES de cerrar el alert, con una pausa, para que el balance
  // nuevo se vea al instante (sin salir y entrar).
  setTimeout(function(){ abrirAbono(cxcClienteId); }, 50);
}




// Encuentra grupos de clientes que probablemente son la MISMA persona -pedido por Sensei
// el 25 jul, tras un cliente preguntarle cuanto debia y la app decir $0.00 cuando en
// realidad si debia: la deuda estaba repartida entre dos copias del mismo cliente-.
// Antes solo juntaba nombres IDENTICOS letra por letra -"Jose Perez" y "José Pérez" NO
// se detectaban como el mismo-. Ahora usa la MISMA normalizacion que ya usa el buscador
// -quita acentos, simbolos, espacios de mas- y TAMBIEN junta a cualquiera que comparta
// el mismo telefono, aunque el nombre este escrito distinto.

// ═══════════════════════════════════════════════════════════════════
//  🔤 UNIFICAR LAS MARCAS
//
//  🔑 Sensei, 19 ago: el "Gummy hair gel 700ml" no le aparecía. La causa
//  no era la búsqueda: tenía DOS marcas que son la misma —GUMMY y Gummy—
//  y el producto estaba en el grupo chiquito.
//
//  Al medir sus datos salieron 14 marcas partidas así.
//
//  🔒 ESTO NO TOCA NINGÚN PRECIO NI NINGUNA FACTURA. Solo corrige cómo
//  está escrita la marca de cada producto.
// ═══════════════════════════════════════════════════════════════════

// Junta las marcas que son la misma escrita distinto
function diagnosticoCxC(pendientes){
  clientes = LS('ncl', []);
  var msg = '=== DIAGNÓSTICO CxC ===\n\n';
  pendientes.forEach(function(p){
    var cl = clientes.find(function(c){ return String(c.id)===String(p.cid); });
    msg += '👤 '+p.cn+' (cid:'+p.cid+')\n';
    msg += '  Existe en Clientes: '+(cl ? '✅ SÍ' : '❌ NO - CLIENTE FANTASMA')+'\n';
    msg += '  Saldo: $'+p.saldo.toFixed(2)+'\n\n';
  });
  alert(msg);
}
