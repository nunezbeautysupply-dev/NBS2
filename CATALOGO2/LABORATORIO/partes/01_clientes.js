
function nombreCl(c){
  if(!c) return '';
  var base = ((c.nombre||'') + ' ' + (c.apellido||'')).replace(/\s+/g,' ').trim();
  var apodos = [c.apodo, c.contactoApodo].filter(function(a){ return a && a.trim(); });
  return apodos.length ? (base + ' "' + apodos.join(' - ') + '"') : base;
}

// Nombre del cliente (con apodo) a partir de una venta/factura, para pantallas INTERNAS.
// v.cn es el nombre puro guardado en la venta (se usa tal cual en facturas impresas/compartidas).
// Esta función busca al cliente por v.cid y agrega el apodo SOLO para mostrar en pantalla.
function nombreClConNegocio(c){
  if(!c) return '';
  var base = nombreCl(c);
  return c.negocio ? (base + ' · 🏪 ' + c.negocio) : base;
}
function saveCl(){
  var n=limpiarTexto(document.getElementById('cn').value.trim());
  var a=limpiarTexto(document.getElementById('ca').value.trim());
  if(!n||!a){alert('Nombre y apellido requeridos');return;}
  var nuevoId = Date.now();
  var vipActivo = document.getElementById('cvip-activo').value === '1';
  var tipoSel = document.getElementById('ctipo').value;
  var subtipoSel = tipoSel==='Tienda' ? document.getElementById('csubtipo').value : null;
  var subtipoOtroTxt = limpiarTexto(document.getElementById('csubtipo-otro').value.trim());
  var intervaloVal = parseInt(document.getElementById('cintervalo').value) || null;
  clientes.push({id:nuevoId,nombre:n,apellido:a,apodo:limpiarTexto(document.getElementById('capodo').value.trim()),negocio:limpiarTexto(document.getElementById('cne').value.trim()),tel:document.getElementById('ct').value.trim(),tipoNegocio:tipoSel,subtipoTienda:subtipoSel,subtipoTiendaOtro:subtipoOtroTxt,intervaloVisitaDias:tipoSel==='Barberia'?null:intervaloVal,ultimaVisitaNegocio:null,contacto:limpiarTexto(document.getElementById('ccontacto').value.trim()),contactoApodo:limpiarTexto(document.getElementById('ccontactoapodo').value.trim()),contactoTel:document.getElementById('ccontactotel').value.trim(),email:document.getElementById('ce').value.trim(),dir:limpiarTexto(document.getElementById('cd').value.trim()),ciudad:limpiarTexto(document.getElementById('ccity').value.trim()),zip:document.getElementById('czip').value.trim(),estado:document.getElementById('cstate').value,vipActivo:vipActivo});
  SS('ncl',clientes);

  // Registrar balance inicial si se ingresó
  var biMonto = dinero(document.getElementById('cbi-monto').value) || 0;
  if(biMonto > 0){
    var biNota = document.getElementById('cbi-nota').value.trim() || 'Balance inicial traído de sistema anterior';
    var biComentario = document.getElementById('cbi-comentario').value.trim();
    var biFecha = document.getElementById('cbi-fecha').value;
    var biFechaFmt = biFecha ? fechaFormat(new Date(biFecha+'T12:00:00')) : fechaHoy();
    if(biComentario) biNota += ' · ' + biComentario;
    ventas = LS('nv',[]);
    ventas.push({
      id: Date.now()+1, numFactura: siguienteNumeroFactura(), cid: nuevoId, cn: n+' '+a, tipo: 'credito',
      items: [{ pid: null, nombre: biNota, cant: 1, precio: biMonto, costo: 0 }],
      subtotal: biMonto, total: biMonto, ganancia: 0,
      fecha: biFechaFmt,
      hora: new Date().toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',hour12:true}),
      pagosFactura: [], esBalanceInicial: true,
      clienteData: { negocio: document.getElementById('cne').value.trim(), tel: document.getElementById('ct').value.trim(), email: document.getElementById('ce').value.trim(), dir: document.getElementById('cd').value.trim(), ciudad: document.getElementById('ccity').value.trim(), estado: document.getElementById('cstate').value, zip: document.getElementById('czip').value.trim() }
    });
    SS('nv', ventas);
  }

  ['cn','ca','cne','ct','ce','cd','ccity','czip','ccontacto','ccontactoapodo','ccontactotel'].forEach(function(id){document.getElementById(id).value='';});
  document.getElementById('ctipo').value='Barberia';
  document.getElementById('csubtipo').value='GroceryStore'; document.getElementById('csubtipo-wrap').style.display='none';
  document.getElementById('csubtipo-otro').value=''; document.getElementById('csubtipo-otro').style.display='none';
  document.getElementById('cintervalo').value=''; document.getElementById('cintervalo-wrap').style.display='none';
  document.getElementById('cstate').value='';
  document.getElementById('cvip-activo').value='0';
  document.getElementById('cvip-switch').style.background='#ddd';
  document.getElementById('cvip-knob').style.left='3px';
  document.getElementById('cbi-monto').value='0.00';
  document.getElementById('cbi-nota').value='Balance inicial traído de sistema anterior';
  document.getElementById('cbi-fecha').value='';
  document.getElementById('cbi-comentario').value='';
  syncVcl();
  flash('mk-cl');
  renderCl('');
  document.getElementById('cl-l').style.display='block';
  document.getElementById('cl-n').style.display='none';
}

function verTodosLosClientes(){
  document.getElementById('cl-l').style.display = 'block';
  document.getElementById('cl-n').style.display = 'none';
  window._clUltimaBusqueda = '';
  window._clFiltroTipo = 'todos';
  var elBuscarCl = document.getElementById('cl-buscar-input');
  if(elBuscarCl) elBuscarCl.value = '';
  renderCl('');
}

// ═══════════════════════════════════════════════════════════════════════════
//  LISTADOS IMPRIMIBLES DE CLIENTES  (18 jul 2026, pedido por Sensei)
//  Para tener una prueba física de todos los clientes. Usa window.print() del
//  teléfono, que deja imprimir a papel o guardar como PDF, sin apps extras.
//  Dos formatos: fichas completas (cada uno en su cuadro) y lista resumida.
// ═══════════════════════════════════════════════════════════════════════════

// Abre una ventana nueva con el HTML listo para imprimir y lanza la impresión.
function clienteCoincide(c, loQueBusca){
  if(!c) return false;
  var todo = [c.nombre, c.apellido, c.apodo, c.negocio, c.telefono, c.direccion]
    .filter(Boolean).join(' ');
  return coincideBusquedaPalabras(todo, loQueBusca);
}

// 🔤 EL NOMBRE BONITO DE UNA MARCA — solo la primera letra en mayúscula.
// Sensei: "no entiendo por qué salen en letras mayúsculas todas". Salen así
// porque así están guardadas; esto solo cambia CÓMO SE VEN, no el dato. -19 ago-
function renderFavoritosCliente(){
  var cont = document.getElementById('v-favoritos');
  if(!cont) return;
  var sel = document.getElementById('vcl');
  var cid = sel ? sel.value : '';
  if(!cid){ cont.style.display='none'; cont.innerHTML=''; return; }

  // Contar qué productos compra más este cliente (sobre todo su historial)
  var ventasCl = LS('nv', []).filter(function(v){ return String(v.cid)===String(cid); });
  var conteo = {};
  ventasCl.forEach(function(v){
    (v.items||[]).forEach(function(it){
      if(!it.pid) return;
      if(!conteo[it.pid]) conteo[it.pid] = { cant:0, nombre:it.nombre };
      conteo[it.pid].cant += it.cant;
    });
  });
  var topPids = Object.keys(conteo).sort(function(a,b){ return conteo[b].cant - conteo[a].cant; }).slice(0,4);
  if(!topPids.length){ cont.style.display='none'; cont.innerHTML=''; return; }

  // Solo mostrar los que todavía existen en el catálogo (con su precio actual)
  loadProds();
  var botones = '';
  topPids.forEach(function(pid){
    var prod = productos.find(function(p){ return String(p.id)===String(pid); });
    if(!prod) return;
    var precio = obtenerPrecioParaCliente(cid, prod.id, prod.precio);
    botones += '<button onclick="agregarFavorito(\''+prod.id+'\')" '
      + 'style="flex:1;min-width:calc(50% - 4px);background:#FFF8E1;border:1.5px solid var(--nbs-gold);'
      + 'border-radius:10px;padding:10px 8px;cursor:pointer;text-align:left">'
      + '<div style="font-size:14px;font-weight:700;color:var(--nbs-ink);line-height:1.2">'+escaparHtml(prod.nombre)+'</div>'
      + '<div style="font-size:13px;font-weight:800;color:#2E7D32;margin-top:3px">$'+fmtNum(precio)+' <span style="color:#E65100">+ Agregar</span></div>'
      + '</button>';
  });
  if(!botones){ cont.style.display='none'; cont.innerHTML=''; return; }

  cont.innerHTML = '<div style="font-size:12px;font-weight:700;color:#E65100;margin-bottom:6px">\u26A1 LO QUE M\u00c1S COMPRA (toca para agregar)</div>'
    + '<div style="display:flex;flex-wrap:wrap;gap:8px">'+botones+'</div>'
    + '<button onclick="repetirUltimaVenta()" style="width:100%;margin-top:8px;background:#E8F5E9;border:1.5px solid #2E7D32;border-radius:10px;padding:11px;cursor:pointer;font-size:14px;font-weight:700;color:#2E7D32">\u21BB Repetir su \u00faltima compra</button>';
  cont.style.display='block';
}

// Buscador rápido de cliente: escribes nombre o barbería y aparecen las coincidencias
// al instante. Al tocar una, se selecciona ese cliente (más rápido que el menú de 128).
function balanceRealCliente(cid){
  var balances = calcularBalancesClientes();
  var deuda = balances.total[String(cid)] || 0;
  var cl = (typeof clientes !== 'undefined' ? clientes : LS('ncl',[])).find(function(c){ return String(c.id)===String(cid); });
  var credito = cl ? (cl.creditoAFavor||0) : 0;
  return { deuda: deuda, credito: credito };
}

// Devuelve el HTML de una etiqueta chiquita de balance, lista para insertar.
// Muestra la deuda Y el credito por separado si tiene los dos a la vez.
// vacio=true cuando no tiene ninguno y no hace falta mostrar nada (menos ruido visual).
function calcularBalancesClientes(){
  var ventasTodas = LS('nv', []);
  var total = {}, detalle = {};
  ventasTodas.forEach(function(v){
    if(v.cancelada) return;
    // IMPORTANTE: solo las ventas A CRÉDITO pueden generar balance pendiente.
    // Las de CONTADO se dan por cobradas al momento — igual que hace verCl() en el
    // perfil del cliente. Antes esta función miraba TODAS las ventas por igual, y
    // una venta de contado sin su pago completo en pagosFactura se contaba como
    // deuda, aunque el cliente ya había pagado en el momento de la venta.
    // 🔴 ANTES se saltaba TODAS las de contado. Pero una de contado MODIFICADA
    // puede quedar debiendo, y ese dinero no se contaba. -15 ago-
    if(v.tipo !== 'credito' && cobradoYDebeDe(v).debe <= 0.005) return;
    // 🔑 LA REGLA ÚNICA. Antes era `total - pagado` a secas y las ventas al CONTADO
    // parecían deber todo. Lo cazaron las leyes del dinero. -17 ago-
    var _cd = cobradoYDebeDe(v);
    var pagado = _cd.cobrado;
    var saldo = _cd.debe;
    if(saldo > 0.01){
      var k = String(v.cid);
      total[k] = (total[k] || 0) + saldo;
      if(!detalle[k]) detalle[k] = [];
      detalle[k].push({ nf: v.numFactura || String(v.id).slice(-4), fecha: v.fecha || '', saldo: saldo });
    }
  });
  return { total: total, detalle: detalle };
}

// Abre/cierra el detalle del balance dentro de la tarjeta, SIN salir de la pantalla.
// Antes habia que irse a Cuentas por Cobrar para ver cuanto debia un barbero -y ahi se
// perdia el pedido que estabas armando-.
function buscarClientePorVoz(txt){
  var q = normalizarTextoBusqueda(String(txt || ''));
  if(!q || q.length < 3) return [];
  clientes = LS('ncl', []);
  var res = [];
  clientes.forEach(function(c){
    if(c.sinServicio) return;
    var campos = normalizarTextoBusqueda(
      [c.nombre, c.apellido, c.apodo, c.negocio].filter(Boolean).join(' '));
    if(campos.indexOf(q) >= 0) res.push({ c: c, exacto: campos === q });
  });
  res.sort(function(a,b){ return (b.exacto?1:0) - (a.exacto?1:0); });
  return res.map(function(x){ return x.c; });
}

// Buscar UN producto por lo que él diga
function irAVenderCliente(id){
  clientes = LS('ncl', []);
  var cl = clientes.find(function(c){ return String(c.id) === String(id); });
  window._vendiendoDesde = { tipo:'cliente', cid:id };
  ir('p-v');
  if(cl){
    setTimeout(function(){
      syncVcl();
      var sel = document.getElementById('vcl');
      if(sel) sel.value = id;
      renderFavoritosCliente();
    }, 100);
  }
}

// Desde el perfil del cliente: ir directo a su Cuentas por Cobrar y abrir el abono.
// Pedido por Sensei: aplicar pagos desde el perfil sin tener que ir a buscar el cliente en CxC.
function irACobrarCliente(id){
  ventas = LS('nv',[]);
  var facturasC = ventas.filter(function(v){
    // 🔴 También las de contado MODIFICADAS que quedaron debiendo. -15 ago-
    if(String(v.cid) !== String(id) || v.cancelada) return false;
    if(v.tipo === 'credito') return true;
    return cobradoYDebeDe(v).debe > 0.005;
  });
  ir('p-cxc');
  setTimeout(function(){
    if(facturasC.length){
      abrirAbono(id);
    } else {
      // Cliente sin deudas: mostrar la lista de CxC (ya navegamos ahí) y avisar
      alert('Este cliente no tiene facturas a crédito pendientes.');
    }
  }, 120);
}

function codigoDeCliente(cl){
  if(!cl) return '';
  var n = parseInt(cl.codigoRegistro || 0, 10) || 0;
  if(!n) return '';
  return (n < 1000) ? ('00' + n).slice(-3) : String(n);
}

// La etiquetita para poner al lado del nombre
function abrirListadoClientes(){
  var h = '<div style="padding:16px">';
  h += '<div style="font-size:16px;font-weight:900;color:var(--nbs-ink);margin-bottom:2px">'
    + '\ud83d\udccb Listado de clientes</div>';
  h += '<div style="font-size:11px;color:var(--nbs-muted);margin-bottom:13px">'
    + 'Con toda su informaci\u00f3n, para imprimir o compartir</div>';

  h += '<label class="lbl">\u00bfEN QU\u00c9 ORDEN?</label>';
  h += '<select class="inp" id="lst-orden" onchange="previewListado()">'
    + '<option value="codigo">\ud83d\udd22 Por c\u00f3digo (001, 002, 003...)</option>'
    + '<option value="nombre">\ud83d\udd24 Por nombre (A - Z)</option>'
    + '<option value="deuda">\ud83d\udcb0 Por lo que me deben (el que m\u00e1s, primero)</option>'
    + '<option value="comprado">\ud83d\uded2 Por lo que me compran</option>'
    + '<option value="deja">\ud83d\udcb5 Por lo que me dejan</option>'
    + '</select>';

  h += '<label class="lbl">\u00bfCU\u00c1LES?</label>';
  h += '<select class="inp" id="lst-filtro" onchange="previewListado()">'
    + '<option value="todos">Todos los clientes</option>'
    + '<option value="deben">Solo los que me deben</option>'
    + '<option value="alcorriente">Solo los que est\u00e1n al d\u00eda</option>'
    + '<option value="activos">Solo los que compran (\u00faltimos 60 d\u00edas)</option>'
    + '<option value="dormidos">Solo los que dejaron de venir</option>'
    + '<option value="sinservicio">Solo los que est\u00e1n SIN SERVICIO</option>'
    + '<option value="barberia">De una sola barber\u00eda...</option>'
    + '</select>';

  h += '<div id="lst-barberia-wrap" style="display:none">'
    + '<label class="lbl">\u00bfCU\u00c1L BARBER\u00cdA?</label>'
    + '<select class="inp" id="lst-barberia" onchange="previewListado()"></select></div>';

  h += '<div id="lst-preview" style="margin:13px 0;padding:11px;background:#F7F7FB;'
    + 'border-radius:10px;font-size:12px;color:var(--nbs-ink)"></div>';

  h += '<div style="display:flex;gap:8px">'
    + '<button onclick="cerrarListadoClientes()" class="btn" '
    +   'style="flex:.7;margin:0;background:#F0F0F5;color:#333">Cerrar</button>'
    + '<button onclick="imprimirListadoClientes()" class="btn" '
    +   'style="flex:1.3;margin:0;background:var(--nbs-ink);color:#fff;font-weight:900">'
    +   '\ud83d\udda8\ufe0f Imprimir o compartir</button>'
    + '</div></div>';

  var ov = document.getElementById('lst-overlay');
  if(!ov){
    ov = document.createElement('div');
    ov.id = 'lst-overlay';
    document.body.appendChild(ov);
  }
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:99993;'
    + 'display:flex;align-items:center;justify-content:center;padding:14px';
  ov.innerHTML = '<div style="background:#fff;border-radius:15px;max-width:420px;width:100%;'
    + 'max-height:90vh;overflow:auto">' + h + '</div>';

  // Llenar las barberías
  clientes = LS('ncl', []);
  var negs = {};
  clientes.forEach(function(c){ if(c.negocio) negs[c.negocio] = (negs[c.negocio] || 0) + 1; });
  var sel = document.getElementById('lst-barberia');
  if(sel){
    sel.innerHTML = Object.keys(negs).sort().map(function(n){
      return '<option value="' + escaparHtml(n) + '">' + escaparHtml(n) + ' (' + negs[n] + ')</option>';
    }).join('');
  }
  previewListado();
}

function cerrarListadoClientes(){
  var ov = document.getElementById('lst-overlay');
  if(ov) ov.style.display = 'none';
}

// Junta la lista según lo que él escogió
function armarListadoClientes(){
  var orden = (document.getElementById('lst-orden') || {}).value || 'codigo';
  var filtro = (document.getElementById('lst-filtro') || {}).value || 'todos';
  var barberia = (document.getElementById('lst-barberia') || {}).value || '';

  var wrap = document.getElementById('lst-barberia-wrap');
  if(wrap) wrap.style.display = (filtro === 'barberia') ? 'block' : 'none';

  clientes = LS('ncl', []);
  var lista = clientes.map(function(c){
    var K;
    try { K = cuentaDeCliente(c.id); } catch(e){ K = null; }
    return {
      c: c,
      codigo: parseInt(c.codigoRegistro || 0, 10) || 99999,
      nombre: nombreCl(c) || '',
      debe: K ? K.dinero.debe : 0,
      comprado: K ? K.dinero.comprado : 0,
      deja: K ? K.dinero.ganancia : 0,
      margen: K ? K.dinero.margen : 0,
      facturas: K ? K.activas.length : 0,
      dias: K ? K.ritmo.diasDesde : null,
      cada: K ? K.ritmo.cadaCuanto : null,
      credito: K ? K.dinero.credito : 0,
      visitas: K ? K.visitas : null,
      K: K
    };
  });

  // ── EL FILTRO ──
  if(filtro === 'deben')            lista = lista.filter(function(x){ return x.debe > 0.005; });
  else if(filtro === 'alcorriente') lista = lista.filter(function(x){ return x.debe <= 0.005 && x.facturas > 0; });
  else if(filtro === 'activos')     lista = lista.filter(function(x){ return x.dias !== null && x.dias <= 60; });
  else if(filtro === 'dormidos')    lista = lista.filter(function(x){ return x.dias !== null && x.dias > 60; });
  else if(filtro === 'sinservicio') lista = lista.filter(function(x){ return !!x.c.sinServicio; });
  else if(filtro === 'barberia')    lista = lista.filter(function(x){ return String(x.c.negocio || '') === barberia; });

  // ── EL ORDEN ──
  if(orden === 'nombre')        lista.sort(function(a, b){ return a.nombre.localeCompare(b.nombre); });
  else if(orden === 'deuda')    lista.sort(function(a, b){ return b.debe - a.debe; });
  else if(orden === 'comprado') lista.sort(function(a, b){ return b.comprado - a.comprado; });
  else if(orden === 'deja')     lista.sort(function(a, b){ return b.deja - a.deja; });
  else                          lista.sort(function(a, b){ return a.codigo - b.codigo; });

  return { lista: lista, orden: orden, filtro: filtro, barberia: barberia };
}

function cuentaDeCliente(cid){
  var r2 = function(x){ return Math.round((x || 0) * 100) / 100; };
  var vacio = {
    cliente: null, facturas: [], activas: [], canceladas: [], pagos: [],
    pedidos: [], devoluciones: [], modificadas: [], conFirma: [],
    visitas: { compro: [], noCompro: [], noEstaba: [], total: 0, pct: 0 },
    dinero: { comprado: 0, pagado: 0, debe: 0, ganancia: 0, margen: 0, credito: 0 },
    ritmo: { ultima: null, diasDesde: null, cadaCuanto: null },
    top: []
  };
  if(cid === null || cid === undefined) return vacio;

  clientes = LS('ncl', []);
  ventas = LS('nv', []);
  var cl = clientes.find(function(c){ return String(c.id) === String(cid); });
  if(!cl) return vacio;

  // ── SUS FACTURAS ──
  var suyas = ventas.filter(function(v){ return String(v.cid) === String(cid); });
  var activas = suyas.filter(function(v){ return !v.cancelada; });
  var canceladas = suyas.filter(function(v){ return !!v.cancelada; });

  // ── EL DINERO, con la regla única ──
  var comprado = 0, pagado = 0, debe = 0, ganancia = 0;
  activas.forEach(function(v){
    comprado += parseFloat(v.total) || 0;
    ganancia += parseFloat(v.ganancia) || 0;
    var cd = cobradoYDebeDe(v);
    pagado += cd.cobrado;
    debe   += cd.debe;
  });

  // ── CADA PAGO, uno por uno ──
  var pagos = [];
  activas.forEach(function(v){
    (v.pagosFactura || []).forEach(function(p, i){
      if(p.esDevolucion) return;
      var monto = parseFloat(p.monto) || 0;
      if(monto <= 0.005) return;
      pagos.push({
        vid: v.id, idx: i,
        factura: v.numFactura || String(v.id).slice(-4),
        totalFactura: parseFloat(v.total) || 0,
        fecha: p.fecha || v.fecha, monto: monto,
        metodo: (p.metodos && p.metodos.length)
          ? p.metodos.map(function(m){ return m.tipo || ''; }).filter(Boolean).join(' + ')
          : (p.metodo || ''),
        nota: p.nota || ''
      });
    });
    // Una venta al contado que nunca tocaron: pagó el día de la venta
    if(v.tipo === 'contado' && !(v.pagosFactura || []).length
       && !v.modificada && !v.ajustadaPorDevolucion){
      pagos.push({
        vid: v.id, idx: null,
        factura: v.numFactura || String(v.id).slice(-4),
        totalFactura: parseFloat(v.total) || 0,
        fecha: v.fecha, monto: parseFloat(v.total) || 0,
        metodo: '', nota: 'Pag\u00f3 al momento'
      });
    }
  });
  pagos.sort(function(a, b){
    var fa = parsearFechaVenta(a.fecha), fb = parsearFechaVenta(b.fecha);
    return (fb ? fb.getTime() : 0) - (fa ? fa.getTime() : 0);
  });

  // ── SUS PEDIDOS PENDIENTES ──
  var pedidosSuyos = [];
  try {
    pedidosSuyos = LS('npedidos', []).filter(function(p){
      return String(p.cid) === String(cid);
    });
  } catch(e){}

  // ── DEVOLUCIONES, MODIFICADAS Y FIRMAS ──
  var devs = activas.filter(function(v){ return !!v.ajustadaPorDevolucion; });
  var mods = activas.filter(function(v){ return !!v.modificada; });
  var firmadas = activas.filter(function(v){ return !!v.firma; });

  // ── SUS VISITAS ──
  var vis = { compro: [], noCompro: [], noEstaba: [], total: 0, pct: 0 };
  try {
    var mapa = LS('nvisitas_barberos', {}) || {};
    var mio = mapa[String(cid)] || {};
    vis.compro = (mio.compro || []).slice();
    vis.noCompro = (mio.noCompro || []).slice();
    vis.noEstaba = (mio.noEstaba || []).slice();
    // 🔑 La visita cuenta SIEMPRE -él gastó el viaje-, incluidas las que el
    // barbero no estaba. Pero el porcentaje de compra solo mira las veces que
    // SÍ estuvo: no es culpa suya no haber estado. -16 ago-
    vis.total = vis.compro.length + vis.noCompro.length + vis.noEstaba.length;
    var conEl = vis.compro.length + vis.noCompro.length;
    vis.pct = conEl ? Math.round(vis.compro.length / conEl * 100) : 0;
  } catch(e){}

  // ── SU RITMO ──
  var fechas = [];
  activas.forEach(function(v){
    var f = parsearFechaVenta(v.fecha);
    if(f) fechas.push(f.getTime());
  });
  fechas.sort(function(a, b){ return a - b; });
  var ultima = fechas.length ? new Date(fechas[fechas.length - 1]) : null;
  var diasDesde = ultima ? Math.floor((Date.now() - ultima.getTime()) / 86400000) : null;
  var cadaCuanto = null;
  if(fechas.length >= 2){
    var suma = 0;
    for(var i = 1; i < fechas.length; i++) suma += (fechas[i] - fechas[i-1]);
    cadaCuanto = Math.round(suma / (fechas.length - 1) / 86400000);
  }

  // ── LO QUE MÁS COMPRA ──
  var cuenta = {};
  activas.forEach(function(v){
    (v.items || []).forEach(function(it){
      var k = String(it.nombre || '');
      if(!k) return;
      cuenta[k] = (cuenta[k] || 0) + (parseFloat(it.cant) || 0);
    });
  });
  var top = Object.keys(cuenta).map(function(k){ return { nombre: k, cant: cuenta[k] }; })
    .sort(function(a, b){ return b.cant - a.cant; }).slice(0, 10);

  return {
    cliente: cl,
    facturas: suyas, activas: activas, canceladas: canceladas,
    pagos: pagos, pedidos: pedidosSuyos,
    devoluciones: devs, modificadas: mods, conFirma: firmadas,
    visitas: vis,
    dinero: {
      comprado: r2(comprado), pagado: r2(pagado), debe: r2(debe),
      ganancia: r2(ganancia),
      margen: comprado > 0 ? Math.round(ganancia / comprado * 1000) / 10 : 0,
      credito: r2(cl.creditoAFavor || 0),
      totalPagos: pagos.length
    },
    ritmo: { ultima: ultima, diasDesde: diasDesde, cadaCuanto: cadaCuanto },
    top: top
  };
}

// El nombre del cliente como Sensei quiere verlo: GRANDE y completo.
// Él lo pidió: "los nombres de los clientes tienen que ser más visibles
// en todas partes". -15 ago-
function datosDelCliente(cid){
  ventas = LS('nv', []);
  var suyas = ventas.filter(function(v){ return String(v.cid) === String(cid); });
  var activas = suyas.filter(function(v){ return !v.cancelada; });

  var comprado = 0, ganancia = 0, pagado = 0, debe = 0;
  activas.forEach(function(v){
    var t = parseFloat(v.total) || 0;
    comprado += t;
    ganancia += (parseFloat(v.ganancia) || 0);
    // 🔑 La regla vive en cobradoYDebeDe: contado sin pagos = pagada; contado CON
    // pagos apuntados = se les hace caso. -15 ago-
    var _cd = cobradoYDebeDe(v);
    pagado += _cd.cobrado;
    debe += _cd.debe;
  });

  // Cuando fue la ultima compra y cada cuanto compra
  var fechas = [];
  activas.forEach(function(v){
    var f = parsearFechaVenta(v.fecha);
    if(f && !isNaN(f.getTime())) fechas.push(f.getTime());
  });
  fechas.sort(function(a,b){ return a-b; });
  var ultima = fechas.length ? new Date(fechas[fechas.length-1]) : null;
  var diasDesde = ultima ? Math.floor((Date.now() - ultima.getTime()) / 86400000) : null;

  // El ritmo: promedio de dias entre compras de DIAS DISTINTOS
  var dias = [];
  fechas.forEach(function(t){
    var d = new Date(t); d.setHours(0,0,0,0);
    if(!dias.length || dias[dias.length-1] !== d.getTime()) dias.push(d.getTime());
  });
  var cadaCuanto = null;
  if(dias.length >= 2){
    var suma = 0;
    for(var i = 1; i < dias.length; i++) suma += (dias[i] - dias[i-1]) / 86400000;
    cadaCuanto = Math.round(suma / (dias.length - 1));
  }

  // Lo que mas compra
  var porProd = {};
  activas.forEach(function(v){
    (v.items || []).forEach(function(it){
      var n = String(it.nombre || '').trim();
      if(!n) return;
      if(!porProd[n]) porProd[n] = { nombre: n, uds: 0, monto: 0, veces: 0 };
      porProd[n].uds += parseFloat(it.cant) || 0;
      porProd[n].monto += (parseFloat(it.cant) || 0) * (parseFloat(it.precio) || 0);
      porProd[n].veces++;
    });
  });
  var top = Object.keys(porProd).map(function(k){ return porProd[k]; })
    .sort(function(a,b){ return b.uds - a.uds; });

  // Sus devoluciones
  var devs = LS('ndevoluciones', []).filter(function(d){ return String(d.cid) === String(cid); })
    .sort(function(a,b){ return String(b.fecha).localeCompare(String(a.fecha)); });

  return {
    facturas: suyas, activas: activas, canceladas: suyas.length - activas.length,
    comprado: Math.round(comprado*100)/100, ganancia: Math.round(ganancia*100)/100,
    pagado: Math.round(pagado*100)/100, debe: Math.round(debe*100)/100,
    margen: comprado > 0 ? Math.round(ganancia / comprado * 1000)/10 : 0,
    ultima: ultima, diasDesde: diasDesde, cadaCuanto: cadaCuanto,
    top: top, devoluciones: devs
  };
}

function togglePanelCl(clave){
  _panelAbierto = (_panelAbierto === clave) ? null : clave;
  var cid = window._clientePerfilActual;
  if(cid != null) pintarPanelCliente(cid);
}

// ── Un renglon de la lista ──
// Un valor para meter DENTRO de un onclick="..." — con comillas SIMPLES.
// JSON.stringify usa comillas DOBLES y rompe el atributo: el navegador lo corta
// y el boton no hace nada. Lo cazo Sensei probando los botones del panel. -11 ago-
// El enlace de WhatsApp. Sensei lo pidio el 11 ago: "en vez de whatsapp normal, que se
// pueda abrir whatsapp de negocio, porque cuando le doy a whatsapp sale el normal".
//
// En ANDROID se le puede decir al telefono EXACTAMENTE cual app abrir, con el paquete:
//    com.whatsapp.w4b  = WhatsApp Business
//    com.whatsapp      = WhatsApp normal
// Si esa app no esta instalada, el `browser_fallback_url` lo manda al wa.me de siempre,
// asi que nunca se queda sin abrir nada.
//
// En iPhone y en la computadora no existe esa forma: ahi se usa wa.me y abre la que el
// sistema tenga puesta. -11 ago-
var WA_NEGOCIO = 'com.whatsapp.w4b';

function _filaPanel(clave, icono, texto, detalle, colorDet, contenido, editar){
  var abierto = (_panelAbierto === clave);
  // 🔤 EL TITULO EN NEGRITA Y LA FLECHA BIEN VISIBLE. Sensei lo pidio el 11 ago:
  // "el titulo de la barra desplegable creo que deberia ser en negrita para saber de
  //  donde parte la apertura del despliegue... al ser todos los textos iguales uno se
  //  confunde, y tambien la flechita de cada titulo debe ser mas visible".
  // Por eso: el titulo va en 900 (negrita fuerte) y la flecha en un circulo con color.
  // Y al abrirse, el renglon se pinta de azul con la flecha en blanco, para que se vea
  // CLARISIMO de donde sale lo que esta desplegado.
  var h = '<div onclick="togglePanelCl(' + _arg(clave) + ')" '
    + 'style="display:flex;align-items:center;gap:10px;padding:13px;'
    + 'border-bottom:' + (abierto ? 'none' : '1px solid #EFEFF4') + ';cursor:pointer;'
    + 'background:' + (abierto ? '#1a237e' : '#fff') + '">'
    + '<span style="font-size:16px;width:22px;text-align:center;flex-shrink:0">' + icono + '</span>'
    + '<span style="flex:1;font-size:15px;font-weight:900;letter-spacing:-.2px;'
    +   'color:' + (abierto ? '#fff' : 'var(--nbs-ink)') + '">' + texto + '</span>'
    + '<span style="font-size:12px;font-weight:800;flex-shrink:0;'
    +   'color:' + (abierto ? 'rgba(255,255,255,.85)' : (colorDet || 'var(--nbs-muted)')) + '">'
    +   (detalle || '') + '</span>'
    + (editar
        ? '<span onclick="event.stopPropagation();' + editar + '" '
          + 'style="flex-shrink:0;width:30px;height:30px;border-radius:8px;'
          + 'background:' + (abierto ? 'rgba(255,255,255,.2)' : '#FFF8E1') + ';'
          + 'border:1px solid ' + (abierto ? 'rgba(255,255,255,.35)' : '#F9A825') + ';'
          + 'display:flex;align-items:center;justify-content:center;font-size:14px;cursor:pointer">'
          + '\u270f\ufe0f</span>'
        : '')
    + '<span style="flex-shrink:0;width:24px;height:24px;border-radius:50%;'
    +   'display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:900;'
    +   'background:' + (abierto ? 'rgba(255,255,255,.22)' : '#EEEEF5') + ';'
    +   'color:' + (abierto ? '#fff' : '#5A5A66') + '">'
    +   (abierto ? '\u2303' : '\u203a') + '</span>'
    + '</div>';
  if(abierto && contenido){
    h += '<div style="background:#F7F7FC;padding:11px 11px 13px;border-bottom:1px solid #EFEFF4;'
      + 'border-left:4px solid #1a237e">' + contenido + '</div>';
  }
  return h;
}

function editarNotaCliente(cid){
  clientes = LS('ncl', []);
  var i = clientes.findIndex(function(c){ return String(c.id) === String(cid); });
  if(i < 0) return;
  var txt = prompt('Nota sobre ' + nombreCl(clientes[i]) + ':\n\n(deja vac\u00edo para borrarla)',
                   String(clientes[i].nota || ''));
  if(txt === null) return;
  clientes[i].nota = String(txt).trim();
  SS('ncl', clientes);
  try { repintarCuentaCliente(cid); } catch(e){}
  try { avisoChico(clientes[i].nota ? '\ud83d\udcdd Nota guardada' : '\ud83d\udcdd Nota borrada'); } catch(e){}
}

// ── 📅 CADA CUÁNTO VISITARLO, editable ──
function repintarCuentaCliente(cid){
  if(cid === null || cid === undefined) return;
  try {
    // Guardar qué renglón tenía abierto para no cerrárselo
    var abiertoAntes = _panelAbierto;
    verCl(cid);
    _panelAbierto = abiertoAntes;
    pintarPanelCliente(cid);
  } catch(e){
    try { pintarPanelCliente(cid); } catch(e2){}
  }
}

// Llevarlo al programa de fidelidad de ese cliente. -15 ago-
function irAFidelidadCliente(cid){
  try { ir('p-fidelidad'); } catch(e){
    try { togglePanelCl('fidelidad'); } catch(e2){}
  }
}


// ═══════════════════════════════════════════════════════════════════
//  📱 SUS PUNTOS POR WHATSAPP
//
//  Corto y motivador, como lo pidió: su primer nombre, cuántos lleva
//  de cada grupo, el gracias, y el empujón para llegar a los 10.
// ═══════════════════════════════════════════════════════════════════
var VIP_ANIMOS = [
  'Ya casi lo tienes. \u00a1Dale que el pr\u00f3ximo puede ser el bueno!',
  '\u00a1Est\u00e1s cerquita! Un empuj\u00f3n m\u00e1s y ese producto es tuyo.',
  'Vas muy bien. Cada compra te acerca a tu producto gratis.',
  '\u00a1Sigue as\u00ed! Los 10 se llegan m\u00e1s r\u00e1pido de lo que crees.'
];

// El primer nombre nada más, como pidió.
// \ud83d\udcb5 Desplegar el reparto de un pago en la ficha del cliente.  (6 sep 2026)
// Sensei: "necesito que el pago se vea el monto completo y que cuando yo lo toque se
// despliegue hacia abajo y ahi si me muestre a que facturas se les aplico".
function desplegarPagoCliente(idDetalle, idFlecha){
  var d = document.getElementById(idDetalle);
  if(!d) return;
  var abierto = d.style.display !== 'none';
  d.style.display = abierto ? 'none' : 'block';
  var f = document.getElementById(idFlecha);
  if(f) f.style.transform = abierto ? '' : 'rotate(90deg)';
}

function pintarPanelCliente(cid){
  var el = document.getElementById('cl-panel-completo');
  if(!el) return;
  clientes = LS('ncl', []);
  var c = clientes.find(function(x){ return String(x.id) === String(cid); });
  if(!c) return;
  var D = datosDelCliente(cid);
  // 🏦 LA CUENTA COMPLETA — una sola verdad para todos los renglones. -15 ago-
  var K = cuentaDeCliente(cid);
  var h = '';

  // ── 📇 SUS DATOS ── (va PRIMERO: es lo que más necesita a mano)
  // Sensei: "falta toda la información del cliente... todos los datos del cliente
  // los necesito y desplegables estaría bien". -11 ago-
  var _tel = String(c.tel || '').trim();
  var _telLimpio = _tel.replace(/[^0-9]/g, '');
  var _dirCompleta = [c.dir, c.ciudad, c.estado, c.zip]
    .map(function(x){ return String(x || '').trim(); })
    .filter(function(x){ return x; }).join(', ');

  var _dato = function(icono, rotulo, valor, extra){
    if(!valor) return '';
    return '<div style="display:flex;gap:8px;padding:7px 0;border-bottom:1px solid #F0F0F5">'
      + '<span style="font-size:13px;width:20px;flex-shrink:0;text-align:center">' + icono + '</span>'
      + '<div style="flex:1;min-width:0">'
      +   '<div style="font-size:10px;font-weight:800;color:var(--nbs-muted);letter-spacing:.3px">' + rotulo + '</div>'
      +   '<div style="font-size:13px;color:var(--nbs-ink);font-weight:600;word-break:break-word">' + valor + '</div>'
      +   (extra || '')
      + '</div></div>';
  };

  var contDatos = _sub(
      _dato('\ud83d\udcde', 'TEL\u00c9FONO', _tel ? escaparHtml(_tel) : '',
        _telLimpio ? '<div style="display:flex;gap:6px;margin-top:6px">'
          + '<a href="tel:' + escaparHtml(_telLimpio) + '" onclick="event.stopPropagation()" '
          +   'style="flex:1;text-align:center;padding:8px;background:#00695C;color:#fff;border-radius:8px;'
          +   'font-size:11.5px;font-weight:800;text-decoration:none">\ud83d\udcde Llamar</a>'
          + '<a href="' + _linkWhatsApp(_telLimpio) + '" '
          +   'target="_blank" onclick="event.stopPropagation()" '
          +   'style="flex:1;text-align:center;padding:8px;background:#25D366;color:#fff;border-radius:8px;'
          +   'font-size:11.5px;font-weight:800;text-decoration:none">\ud83d\udcac WhatsApp</a>'
          + '</div>' : '')
    + _dato('\u2709\ufe0f', 'CORREO', c.email ? escaparHtml(c.email) : '')
    + _dato('\ud83d\udccd', 'DIRECCI\u00d3N', _dirCompleta ? escaparHtml(_dirCompleta) : '',
        _dirCompleta ? '<div style="margin-top:6px">'
          + '<a href="https://www.google.com/maps/search/?api=1&query='
          +   encodeURIComponent(_dirCompleta) + '" target="_blank" onclick="event.stopPropagation()" '
          +   'style="display:block;text-align:center;padding:8px;background:#1565C0;color:#fff;border-radius:8px;'
          +   'font-size:11.5px;font-weight:800;text-decoration:none">\ud83d\uddfa\ufe0f C\u00f3mo llegar</a>'
          + '</div>' : '')
    + _dato('\ud83c\udfea', 'NEGOCIO', c.negocio ? escaparHtml(c.negocio) : '')
    + _dato('\ud83c\udff7\ufe0f', 'TIPO', escaparHtml(String(etiquetaTipoNegocio(c) || '').replace(/<[^>]*>/g, '').trim())
        + (c.subtipoTienda ? ' \u00b7 ' + escaparHtml(c.subtipoTienda) : '')
        + (c.subtipoTiendaOtro ? ' \u00b7 ' + escaparHtml(c.subtipoTiendaOtro) : ''))
    + _dato('\ud83d\udc64', 'APODO', c.apodo ? escaparHtml(c.apodo) : '')
    + _dato('\ud83e\udd1d', 'PERSONA DE CONTACTO',
        c.contacto ? escaparHtml(c.contacto)
          + (c.contactoApodo ? ' "' + escaparHtml(c.contactoApodo) + '"' : '')
          + (c.contactoTel ? '<br>\ud83d\udcde ' + escaparHtml(c.contactoTel) : '') : '')
    + _dato('\ud83d\udd01', 'CADA CU\u00c1NTO LO VISITAS',
        c.intervaloVisitaDias ? 'cada ' + c.intervaloVisitaDias + ' d\u00edas' : '')
    + '<div style="display:flex;gap:8px;padding:7px 0">'
      + '<span style="font-size:13px;width:20px;flex-shrink:0;text-align:center">\ud83c\udd94</span>'
      + '<div style="flex:1;min-width:0">'
      +   '<div style="font-size:9.5px;font-weight:800;color:var(--nbs-muted);letter-spacing:.3px">FICHA CREADA</div>'
      +   '<div style="font-size:13px;color:var(--nbs-ink);font-weight:600">'
      +     (Number(c.id) > 1000000000000
              ? new Date(Number(c.id)).toLocaleDateString('es-DO', { day:'numeric', month:'long', year:'numeric' })
              : '\u2014') + '</div>'
      + '</div></div>'
  );

  // El record de visitas, dentro del mismo renglon
  // 🔴 FALLO PROPIO ARREGLADO EL 12 AGO: se leía 'nbs_visitas_barberos' como LISTA, y la
  // app guarda 'nvisitas_barberos' como MAPA -{ cid: { compro:[fechas], noCompro:[fechas] } }-.
  // Por eso el récord decía "ninguna" SIEMPRE, aunque Sensei tuviera 140 clientes con
  // visitas apuntadas. Lo cazó él: "el récord de compra y no compra que se supone que
  // lo puedo ver en el récord del cliente".
  var _vis = null;
  try {
    var _todas = LS('nvisitas_barberos', {});
    if(_todas && typeof _todas === 'object' && _todas[String(cid)]) _vis = _todas[String(cid)];
  } catch(e){}
  if(_vis){
    var _compro = (_vis.compro || []).length;
    var _noCompro = (_vis.noCompro || []).length;
    var _totalV = _compro + _noCompro;
    if(_totalV){
      var pctV = Math.round(_compro / _totalV * 100);
      // Las últimas visitas, de la más nueva a la más vieja
      var _ultimas = []
        .concat((_vis.compro || []).map(function(f){ return { f: f, c: true }; }))
        .concat((_vis.noCompro || []).map(function(f){ return { f: f, c: false }; }))
        .sort(function(a, b){
          var fa = parsearFechaVenta(a.f), fb = parsearFechaVenta(b.f);
          return (fb ? fb.getTime() : 0) - (fa ? fa.getTime() : 0);
        });
      contDatos += _sub(
        '<div style="font-size:11px;font-weight:800;color:var(--nbs-muted);letter-spacing:.3px;margin-bottom:5px">\ud83d\udccd R\u00c9CORD DE VISITAS</div>'
        + '<div style="display:flex;gap:10px;font-size:12.5px;font-weight:800">'
        +   '<span style="color:var(--nbs-green-text)">\u2713 ' + _compro + ' compr\u00f3</span>'
        +   '<span style="color:var(--nbs-red-text)">\u2717 ' + _noCompro + ' no compr\u00f3</span>'
        + '</div>'
        + '<div style="height:6px;background:#EAEAF2;border-radius:3px;margin-top:6px;overflow:hidden">'
        +   '<div style="height:100%;width:' + pctV + '%;background:var(--nbs-green-text)"></div></div>'
        + '<div style="font-size:11px;color:var(--nbs-muted);margin-top:5px">'
        +   'Te compra el <b>' + pctV + '%</b> de las veces que lo visitas ('
        +   _totalV + ' visita' + (_totalV === 1 ? '' : 's') + ')</div>'
        + '<div style="margin-top:7px">'
        +   _ultimas.slice(0, 8).map(function(x){
              return '<div style="display:flex;justify-content:space-between;font-size:11.5px;padding:3px 0;'
                + 'border-bottom:1px solid #F0F0F5">'
                + '<span style="color:var(--nbs-ink)">' + escaparHtml(x.f) + '</span>'
                + '<span style="font-weight:800;color:' + (x.c ? 'var(--nbs-green-text)' : 'var(--nbs-red-text)') + '">'
                +   (x.c ? '\u2713 compr\u00f3' : '\u2717 no compr\u00f3') + '</span></div>';
            }).join('')
        +   (_ultimas.length > 8 ? '<div style="font-size:10.5px;color:var(--nbs-muted);text-align:center;padding:5px 0">y ' + (_ultimas.length - 8) + ' visita(s) m\u00e1s</div>' : '')
        + '</div>'
      );
    }
  }

  contDatos += '<button onclick="event.stopPropagation();editarCl(' + cid + ')" '
    + 'style="width:100%;margin-top:2px;padding:10px;background:#1565C0;color:#fff;border:none;'
    + 'border-radius:9px;font-size:12px;font-weight:800;cursor:pointer">\u270f\ufe0f Corregir estos datos</button>';

  // \ud83e\uddfe EL ESTADO DE CUENTA, lo primero de la lista -Sensei, 29 ago-. Es lo que se le
  // ensena al cliente cuando dice que pago una cantidad y la app ensena otra.
  // \ud83d\udd34 El 30 ago Sensei aviso de que NO APARECIA: la funcion existia pero este boton
  // nunca se llego a escribir -un parche murio a medias-. Aqui esta.
  h += '<button onclick="event.stopPropagation();abrirEstadoDeCuenta(' + _arg(cid) + ')" '
    + 'style="width:100%;padding:13px;margin-bottom:8px;background:#1a237e;color:#fff;border:none;'
    + 'border-radius:10px;font-size:14px;font-weight:800;cursor:pointer;box-shadow:0 2px 8px rgba(26,35,126,.25)">'
    + '\ud83e\uddfe Estado de cuenta \u00b7 todo su movimiento</button>';

  // \u270d\ufe0f LA CONFIRMACION FIRMADA -Sensei, 30 ago-: "deberia haber una forma de que el
  // cliente se vea obligado a confirmar su balance... eso seria la prueba de que esta de
  // acuerdo". Solo sale si DEBE algo: sin deuda no hay nada que confirmar.
  var _debeAhora = 0;
  try { _debeAhora = balanceDelCliente(cid); } catch(e){}
  if(_debeAhora > 0.005 && (typeof seOfreceFirma !== 'function' || seOfreceFirma())){
    var _faltaConf = false;
    try { _faltaConf = leFaltaConfirmar(cid); } catch(e){}
    // \u270d\ufe0f OPCION, no alarma. Antes salia en rojo fuerte como si fuera un problema, y
    // no lo es: hay clientes de confianza con los que esto no hace falta. -Sensei, 30 ago-
    h += '<button onclick="event.stopPropagation();abrirConfirmacionBalance(' + _arg(cid) + ')" '
      + 'style="width:100%;padding:11px;margin-bottom:10px;border-radius:10px;font-size:12.5px;'
      + 'font-weight:800;cursor:pointer;background:#fff;'
      + (_faltaConf ? 'color:#1a237e;border:1.5px solid #b9bfe0;'
                    : 'color:#2E7D32;border:1.5px solid #A5D6A7;')
      + '">' + (_faltaConf
          ? '\u270d\ufe0f Que firme su balance de $' + fmtNum(_debeAhora) + ' \u00b7 opcional'
          : '\u2705 Firm\u00f3 su balance \u00b7 firmar de nuevo')
      + '</button>';
  }

  // \ud83d\udce4 MANDARLE SU BALANCE, sin tener que venderle nada -3 sep-. Va desplegable:
  // cerrado es un renglon, y al abrirlo salen las cuatro formas de mandarlo.
  var _debeAhora2 = 0;
  try { _debeAhora2 = balanceDelCliente(cid); } catch(e){}
  var contMandar = '<div style="font-size:11.5px;color:var(--nbs-muted);margin-bottom:8px">'
    + 'Se le manda su balance sin necesidad de venderle ni cobrarle nada.</div>'
    + '<button onclick="event.stopPropagation();mandarSuBalance(' + _arg(cid) + ', 0)" '
    +   'style="width:100%;padding:12px;margin-bottom:6px;background:#1a237e;color:#fff;border:none;'
    +   'border-radius:10px;font-size:13px;font-weight:800;cursor:pointer">'
    +   '\ud83d\udcac Su balance en corto</button>'
    + '<button onclick="event.stopPropagation();mandarSuBalance(' + _arg(cid) + ', 1)" '
    +   'style="width:100%;padding:11px;background:#fff;color:#1a237e;border:1.5px solid #b9bfe0;'
    +   'border-radius:10px;font-size:12.5px;font-weight:800;cursor:pointer">'
    +   '\ud83e\uddfe El estado de cuenta completo</button>';

  h += _filaPanel('mandar', '\ud83d\udce4', 'Mandarle su balance',
    (_debeAhora2 > 0.005 ? '$' + fmtNum(_debeAhora2) : 'al d\u00eda'),
    (_debeAhora2 > 0.005 ? '#C62828' : '#2E7D32'), contMandar, null);

  // \ud83d\udcca ESTADO POR FECHAS -Sensei, 5 sep-: "un reporte donde se vea cada factura y
  // cada pago por orden de fecha, y que yo pueda tocar cada uno para verlo con detalle".
  h += '<div onclick="abrirEstadoPorFechas(' + _arg(cid) + ')" '
    + 'style="display:flex;align-items:center;gap:10px;padding:13px 12px;border-bottom:1px solid #EEE;cursor:pointer">'
    + '<div style="font-size:19px">\ud83d\udcca</div>'
    + '<div style="flex:1"><div style="font-size:14.5px;font-weight:900;color:var(--nbs-ink);'
    +   'letter-spacing:-.2px">Estado por fechas</div></div>'
    + '<div style="font-size:11.5px;color:var(--nbs-muted);margin-right:4px">todo su movimiento</div>'
    + '<div style="background:#EEEEF5;border-radius:50%;width:24px;height:24px;display:flex;'
    +   'align-items:center;justify-content:center;color:#5A5A66;font-size:14px">\u203a</div>'
    + '</div>';

  h += _filaPanel('datos', '\ud83d\udcc7', 'Sus datos',
    _tel ? escaparHtml(_tel.length > 15 ? _tel.slice(0, 15) : _tel) : (c.negocio ? 'ver ficha' : ''),
    null, contDatos, 'editarCl(' + _arg(cid) + ')');

  // ── ⭐ PROGRAMA VIP ──
  if(c.vipActivo){
    var grupos = calcVIP(cid);
    var keys = Object.keys(grupos);
    if(keys.length){
      var listos = keys.filter(function(k){ return grupos[k].gratis > 0; }).length;
      var cont = keys.map(function(k){
        var g = grupos[k];
        var pct = Math.min(100, Math.round((g.progreso / VIP_META) * 100));
        return _sub(
          '<div style="display:flex;justify-content:space-between">'
          + '<span style="font-size:12.5px;font-weight:800;color:var(--nbs-ink)">' + escaparHtml(g.nombre) + '</span>'
          + '<span style="font-size:12.5px;font-weight:800;color:#AD1457">' + g.progreso + '/' + VIP_META + (g.gratis>0?' \ud83c\udf81':'') + '</span>'
          + '</div>'
          + '<div style="height:6px;background:#EAEAF2;border-radius:3px;margin-top:6px;overflow:hidden">'
          +   '<div style="height:100%;width:' + pct + '%;background:#AD1457"></div></div>'
          + detalleProdsVIP(g, true)
          + '<button onclick="event.stopPropagation();abrirEntregaPremioVIP(' + _arg(cid) + ',' + _arg(k) + ')" '
          + 'style="width:100%;margin-top:7px;padding:8px;background:' + (g.gratis>0?'#AD1457':'#fff') + ';color:' + (g.gratis>0?'#fff':'#AD1457') + ';'
          + 'border:' + (g.gratis>0?'none':'1px solid #AD1457') + ';border-radius:8px;font-size:11.5px;font-weight:800;cursor:pointer">'
          + (g.gratis>0?'\ud83c\udf81 Ya se lo di':'\ud83c\udf81 Darle el premio ahora') + '</button>'
            // \u270f\ufe0f AJUSTAR A MANO -Sensei, 3 sep-: "puedo darle un regalo combinando
            // marcas, pero debo bajarle o subirle a cualquier producto de su record".
            + '<button onclick="event.stopPropagation();abrirAjustePuntosVIP(' + _arg(cid) + ',' + _arg(k) + ')" '
            +   'style="width:100%;margin-top:5px;padding:7px;background:#fff;color:#555;'
            +   'border:1px solid #ccc;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer">'
            +   '\u270f\ufe0f Ajustar estos puntos a mano</button>'
            // Y el rastro del ultimo ajuste, para que se vea que se toco y por que.
            + (g.ajuste
                ? '<div style="background:#FFF8E1;border-left:3px solid #FFB300;border-radius:6px;'
                  + 'padding:6px 8px;margin-top:6px;font-size:10.5px;color:#7A5C00">'
                  + '\u270f\ufe0f ' + escaparHtml(g.ajuste.fecha) + ': ' + g.ajuste.de + ' \u2192 ' + g.ajuste.a
                  + '<br>\u201c' + escaparHtml(g.ajuste.motivo) + '\u201d'
                  + '<span onclick="event.stopPropagation();deshacerAjustePuntosVIP(' + _arg(cid) + ',' + _arg(String(g.ajuste.id)) + ')" '
                  +   'style="display:block;margin-top:3px;text-decoration:underline;cursor:pointer">deshacer</span>'
                  + '</div>'
                : '')
        );
      }).join('');
      h += _filaPanel('vip', '\u2b50', 'Programa VIP',
        keys.length + ' grupo' + (keys.length>1?'s':'') + (listos ? ' \u00b7 ' + listos + ' \ud83c\udf81' : ''),
        listos ? '#AD1457' : null, cont, 'editarCl(' + _arg(cid) + ')', 'verMensajeVIP(' + _arg(cid) + ')');
    }
  }

  // ── 🎁 PREMIOS QUE LE DI ──
  var canjes = c.vipCanjes || [];
  if(canjes.length){
    var costoTotal = canjes.reduce(function(a,x){ return a + (parseFloat(x.costo)||0); }, 0);
    var contP = canjes.slice().reverse().map(function(x){
      return _sub(
        '<div style="display:flex;justify-content:space-between">'
        + '<span style="font-size:12.5px;font-weight:700;color:var(--nbs-ink)">' + escaparHtml(String(x.producto||'').slice(0,32)) + (x.anticipado?' \u2733\ufe0f':'') + '</span>'
        + '<span style="font-size:11.5px;color:#8D6E00;font-weight:800">te cost\u00f3 $' + fmtNum(x.costo||0) + '</span>'
        + '</div>'
        + '<div style="font-size:11px;color:var(--nbs-muted);margin-top:2px">' + escaparHtml(x.fecha||'') + ' \u00b7 ' + escaparHtml(String(x.nombreGrupo||x.grupo||'')) + '</div>'
        + '<button onclick="event.stopPropagation();mostrarComprobantePremioVIP(' + _arg(cid) + ',' + _arg(x.ventaId) + ')" '
        + 'style="width:100%;margin-top:6px;padding:7px;background:#fff;border:1px solid #AD1457;color:#AD1457;border-radius:8px;font-size:11px;font-weight:800;cursor:pointer">\ud83e\uddfe Ver su comprobante</button>'
      );
    }).join('')
    + (canjes.some(function(x){ return x.anticipado; })
        ? '<div style="font-size:10.5px;color:#8D6E00;padding:2px 2px 0">\u2733\ufe0f = se lo diste antes de que completara</div>' : '');
    h += _filaPanel('premios', '\ud83c\udf81', 'Premios que le di',
      canjes.length + ' \u00b7 $' + fmtNum(costoTotal), '#8D6E00', contP);
  }

  // ── ↩️ DEVOLUCIONES ── (lo que Sensei no veía por ningún lado)
  if(D.devoluciones.length){
    var montoDev = D.devoluciones.reduce(function(a,x){ return a + (parseFloat(x.monto)||0); }, 0);
    var contD = D.devoluciones.map(function(d){
      var prods = (d.items || []).map(function(it){
        return '<div style="display:flex;justify-content:space-between;font-size:11.5px;color:#777;line-height:1.6">'
          + '<span>' + (parseFloat(it.cant)||0) + ' \u00d7 ' + escaparHtml(String(it.nombre||'').slice(0,26)) + '</span>'
          + '<span>$' + fmtNum((parseFloat(it.cant)||0) * (parseFloat(it.precio)||0)) + '</span></div>';
      }).join('');
      var vOrigen = ventas.find(function(v){ return String(v.id) === String(d.ventaId); });
      return _sub(
        '<div style="display:flex;justify-content:space-between">'
        + '<span style="font-size:12.5px;font-weight:800;color:var(--nbs-ink)">' + escaparHtml(d.fecha||'') + '</span>'
        + '<span style="font-size:12.5px;font-weight:800;color:var(--nbs-red-text)">\u2212$' + fmtNum(d.monto||0) + '</span>'
        + '</div>'
        + '<div style="font-size:11px;color:var(--nbs-muted);margin-top:2px">'
        +   (vOrigen ? 'De la factura #' + escaparHtml(String(vOrigen.numFactura||vOrigen.id)) : 'Factura no encontrada')
        +   (d.hora ? ' \u00b7 ' + escaparHtml(d.hora) : '') + (d.esCambio ? ' \u00b7 cambio de producto' : '') + '</div>'
        + '<div style="margin-top:5px">' + prods + '</div>'
        + (d.motivoTexto ? '<div style="font-size:11px;font-weight:800;color:#C62828;margin-top:4px">' + escaparHtml(d.motivoTexto) + '</div>' : '')
        + (d.nota ? '<div style="font-size:11px;color:var(--nbs-muted);margin-top:2px;font-style:italic">\u201c' + escaparHtml(d.nota) + '\u201d</div>' : '')
        + (d.foto ? '<img src="' + d.foto + '" onclick="event.stopPropagation();verFotoGasto(this.src)" style="margin-top:6px;width:64px;height:64px;object-fit:cover;border-radius:9px;cursor:pointer;border:1px solid #ddd">' : '')
        + '<button onclick="event.stopPropagation();deshacerDevolucion(' + _arg(d.id) + ')" '
        + 'style="width:100%;margin-top:7px;padding:8px;background:#fff;border:1px solid #96331A;color:#96331A;border-radius:8px;font-size:11.5px;font-weight:800;cursor:pointer">\u21a9\ufe0f Deshacer esta devoluci\u00f3n</button>'
      );
    }).join('');
    h += _filaPanel('devs', '\u21a9\ufe0f', 'Devoluciones',
      D.devoluciones.length + ' \u00b7 $' + fmtNum(montoDev), 'var(--nbs-red-text)', contD);
  }

  // ── 🛒 LO QUE MÁS COMPRA ──
  if(D.top.length){
    var contT = D.top.slice(0, 8).map(function(p, i){
      return '<div style="display:flex;align-items:center;gap:8px;background:#fff;border-radius:8px;padding:8px 10px;margin-bottom:5px">'
        + '<span style="font-size:11px;font-weight:900;color:#B9B9C6;width:14px">' + (i+1) + '</span>'
        + '<span style="flex:1;font-size:12.5px;font-weight:700;color:var(--nbs-ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escaparHtml(p.nombre.slice(0,30)) + '</span>'
        + '<span style="font-size:11.5px;color:var(--nbs-muted);flex-shrink:0">' + p.uds + ' uds \u00b7 $' + fmtNum(p.monto) + '</span>'
        + '</div>';
    }).join('');
    h += _filaPanel('top', '\ud83d\uded2', 'Lo que m\u00e1s compra',
      String(D.top[0].nombre).slice(0, 14), null, contT);
  }

  // ── 📅 CADA CUÁNTO COMPRA ──
  if(D.ultima){
    var proxima = '';
    if(D.cadaCuanto){
      var p = new Date(D.ultima.getTime() + D.cadaCuanto * 86400000);
      proxima = p.toLocaleDateString('es-DO', { day:'numeric', month:'short' });
    }
    var contC = _sub(
      '<div style="font-size:12.5px;color:var(--nbs-ink);line-height:1.7">'
      + '\u00daltima compra: <b>' + D.ultima.toLocaleDateString('es-DO', { day:'numeric', month:'long', year:'numeric' }) + '</b>'
      + ' (hace ' + D.diasDesde + ' d\u00eda' + (D.diasDesde===1?'':'s') + ')<br>'
      + (D.cadaCuanto ? 'Te compra cada <b>' + D.cadaCuanto + ' d\u00edas</b> en promedio<br>Pr\u00f3xima estimada: <b>' + proxima + '</b><br>' : '')
      + 'Le has vendido <b>' + D.activas.length + '</b> vez' + (D.activas.length===1?'':'es')
      + (D.canceladas ? ' (y ' + D.canceladas + ' cancelada' + (D.canceladas===1?'':'s') + ')' : '')
      + '</div>'
    );
    // (este renglón lo reemplazó el nuevo, que además se edita — 15 ago)

  }

  // ── 💰 CRÉDITO A FAVOR ──
  var cred = parseFloat(c.creditoAFavor) || 0;
  if(cred > 0.005){
    var contCr = _sub(
      '<div style="font-size:12.5px;color:var(--nbs-ink);line-height:1.7">'
      + 'Este cliente tiene <b style="color:var(--nbs-gold-dark)">$' + fmtNum(cred) + '</b> a favor.<br>'
      + 'Se le puede aplicar a cualquier factura que deba, desde <b>\ud83d\udcb5 Cobrar</b>.'
      + '</div>'
    );
    // (este renglón lo reemplazó el nuevo, que además se edita — 15 ago)

  }

  // ── 📄 SUS FACTURAS ──
  if(D.facturas.length){
    var listaF = D.facturas.slice().sort(function(a,b){
      var fa = parsearFechaVenta(a.fecha), fb = parsearFechaVenta(b.fecha);
      return (fb ? fb.getTime() : 0) - (fa ? fa.getTime() : 0);
    });
    // 📄 LAS QUE DEBEN, ABIERTAS. LAS PAGADAS, EN UNA LINEA. -Sensei, 21 ago-:
    // "quiero que solo esten abiertas las facturas que tengan balance y que las otras solo
    // se vean pero no abiertas, porque eso tambien hace que sean mas largas las pantallas.
    // Y ademas que la factura mas vieja se vea en balance mas grande para que sea mas
    // notable y yo pueda elegirla con mas facilidad a la hora de aplicarle un pago".
    var _conSaldo = [], _saldadas = [];
    listaF.forEach(function(v){
      var sal = cobradoYDebeDe(v).debe;
      if(!v.cancelada && esSaldoPendiente(sal)) _conSaldo.push({ v: v, saldo: sal });
      else _saldadas.push(v);
    });
    // La MAS VIEJA de las que deben va primera y marcada: es la que toca cobrar
    _conSaldo.sort(function(a, b){
      var fa = parsearFechaVenta(a.v.fecha), fb = parsearFechaVenta(b.v.fecha);
      return (fa ? fa.getTime() : 0) - (fb ? fb.getTime() : 0);
    });

    var contF = _conSaldo.map(function(o, i){
      var v = o.v, saldo = o.saldo;
      var laVieja = (i === 0 && _conSaldo.length > 1);
      return '<div onclick="event.stopPropagation();verFacturaProfesional(' + _arg(v.id) + ')" '
        + 'style="background:#fff;border:' + (laVieja ? '2px solid #C62828' : '1px solid #F0C4C4')
        + ';border-left:' + (laVieja ? '7px' : '4px') + ' solid #C62828;border-radius:9px;'
        + 'padding:' + (laVieja ? '11px 12px' : '9px 11px') + ';margin-bottom:6px;cursor:pointer'
        + (laVieja ? ';box-shadow:0 2px 8px rgba(198,40,40,.16)' : '') + '">'
        + (laVieja ? '<div style="font-size:9.5px;font-weight:900;color:#C62828;letter-spacing:.7px;margin-bottom:3px">\u2b50 LA M\u00c1S VIEJA \u2014 C\u00d3BRALE ESTA PRIMERO</div>' : '')
        + '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px">'
        +   '<div style="flex:1;min-width:0">'
        +     '<div style="font-size:12.5px;font-weight:700;color:var(--nbs-ink)">'
        +       escaparHtml(v.fecha || '') + (v.hora ? ' \u00b7 ' + escaparHtml(v.hora) : '') + '</div>'
        +     '<div style="font-size:10.5px;color:var(--nbs-muted);margin-top:1px">'
        +       ((v.items || []).length) + ' producto(s) \u00b7 de $' + fmtNum(v.total)
        +       (v.modificada ? ' \u00b7 modificada' : '') + '</div>'
        +   '</div>'
        +   '<div style="text-align:right;flex-shrink:0">'
        +     '<div style="font-size:9.5px;font-weight:800;color:#B0757A;letter-spacing:.4px">DEBE</div>'
        +     '<div style="font-size:' + (laVieja ? '26px' : '19px') + ';font-weight:900;color:#C62828;line-height:1.05;letter-spacing:-0.6px">$'
        +       fmtNum(saldo) + '</div>'
        +   '</div>'
        + '</div></div>';
    }).join('')

    // Las pagadas y las canceladas: una linea cada una, sin ocupar sitio. Se siguen tocando.
    + (_saldadas.length
        ? '<div style="font-size:10px;font-weight:800;color:var(--nbs-muted);letter-spacing:.6px;margin:9px 0 4px">'
          + (_conSaldo.length ? 'YA SALDADAS' : 'TODAS SALDADAS \u2014 no te debe nada') + ' (' + _saldadas.length + ')</div>'
          + _saldadas.slice(0, 40).map(function(v){
              var canc = !!v.cancelada;
              return '<div onclick="event.stopPropagation();verFacturaProfesional(' + _arg(v.id) + ')" '
                + 'style="display:flex;justify-content:space-between;align-items:center;gap:8px;'
                + 'padding:5px 10px;border-bottom:1px solid #F2F2F5;cursor:pointer;font-size:11.5px'
                + (canc ? ';opacity:.65' : '') + '">'
                + '<span style="color:var(--nbs-muted)' + (canc ? ';text-decoration:line-through' : '') + '">'
                +   escaparHtml(v.fecha || '') + '</span>'
                + '<span style="display:flex;gap:9px;align-items:center;flex-shrink:0">'
                +   '<span style="font-weight:700;color:var(--nbs-ink)">$' + fmtNum(v.total) + '</span>'
                +   '<span style="font-size:10px;font-weight:700;color:' + (canc ? '#B71C1C' : 'var(--nbs-green-text)') + '">'
                +     (canc ? 'cancelada' : 'pagada') + '</span>'
                + '</span></div>';
            }).join('')
        : '')
    + (_saldadas.length > 40 ? '<div style="font-size:11px;color:var(--nbs-muted);text-align:center;padding:6px">y ' + (_saldadas.length - 40) + ' m\u00e1s</div>' : '')
    + '<button onclick="event.stopPropagation();verHistorialCliente(' + _arg(cid) + ',\'completo\')" '
    + 'style="width:100%;margin-top:6px;padding:9px;background:#1a237e;color:#fff;border:none;border-radius:8px;'
    + 'font-size:11.5px;font-weight:800;cursor:pointer">\ud83d\udccb Ver historial completo</button>';
    h += _filaPanel('facturas', '\ud83d\udcc4', 'Sus facturas',
      String(D.activas.length) + (D.canceladas ? ' + ' + D.canceladas + ' canc.' : ''), null, contF, 'verHistorialCliente(' + _arg(cid) + ')');
  }

  // ── 💵 SUS PAGOS — el récord de todo lo que te ha pagado. -15 ago-
  // Sensei: "tampoco veo un récord de pagos que pudiera tenerlo también y no lo tiene".
  var _pagos = [];
  (D.activas || []).forEach(function(v){
    (v.pagosFactura || []).forEach(function(p, i){
      if(p.esDevolucion) return;
      var monto = parseFloat(p.monto) || 0;
      if(monto <= 0.005) return;
      _pagos.push({
        vid: v.id, idx: i,
        fecha: p.fecha || v.fecha, monto: monto,
        recibo: p.recibo || null,
        montoCobro: (typeof p.montoCobro === 'number' && p.montoCobro > 0) ? p.montoCobro : 0,
        factura: v.numFactura || String(v.id).slice(-4),
        totalFactura: parseFloat(v.total) || 0,
        metodo: (p.metodos && p.metodos.length)
          ? p.metodos.map(function(m){ return m.tipo || ''; }).filter(Boolean).join(' + ')
          : (p.metodo || ''),
        nota: p.nota || ''
      });
    });
    // Una venta al contado sin pagos apuntados: el pago fue el día de la venta
    if(v.tipo === 'contado' && !(v.pagosFactura || []).length && !v.modificada && !v.ajustadaPorDevolucion){
      _pagos.push({ vid: v.id, idx: null,
                    fecha: v.fecha, monto: parseFloat(v.total) || 0,
                    recibo: null, montoCobro: 0,
                    factura: v.numFactura || String(v.id).slice(-4),
                    totalFactura: parseFloat(v.total) || 0,
                    metodo: '', nota: 'Pag\u00f3 al momento' });
    }
  });

  // \ud83d\udd11 SE JUNTAN LAS PARTES DEL MISMO COBRO -6 sep-. Si le cobras $30 y se reparte
  // entre dos facturas, el cliente pag\u00f3 UNA vez $30: eso es lo que tiene que ver Sensei
  // de un vistazo. El reparto va escondido hasta que lo toque.
  var _porCobro = {}, _cobros = [];
  _pagos.forEach(function(p){
    // Sin recibo -los pagos viejos- cada uno va suelto, o se mezclar\u00edan dos pagos
    // distintos del mismo d\u00eda a la misma factura.
    var clave = p.recibo ? ('R:' + p.recibo) : ('S:' + p.vid + '|' + p.idx + '|' + p.fecha);
    if(!_porCobro[clave]){
      _porCobro[clave] = { fecha: p.fecha, recibo: p.recibo, metodo: p.metodo,
                           nota: p.nota, completo: 0, suma: 0, partes: [] };
      _cobros.push(_porCobro[clave]);
    }
    var g = _porCobro[clave];
    g.partes.push(p);
    g.suma = Math.round((g.suma + p.monto) * 100) / 100;
    if(p.montoCobro > g.completo) g.completo = p.montoCobro;
    if(!g.metodo && p.metodo) g.metodo = p.metodo;
  });
  // Si no se guard\u00f3 el monto del cobro completo, se usa la suma de sus partes
  _cobros.forEach(function(g){ if(!g.completo) g.completo = g.suma; });

  _cobros.sort(function(a, b){
    var fa = parsearFechaVenta(a.fecha), fb = parsearFechaVenta(b.fecha);
    return (fb ? fb.getTime() : 0) - (fa ? fa.getTime() : 0);
  });

  var _totalPagado = Math.round(_pagos.reduce(function(x, p){ return x + p.monto; }, 0) * 100) / 100;

  if(_cobros.length){
    var contPagos = _sub(
      '<div style="display:flex;justify-content:space-between;font-size:12.5px;font-weight:800;'
      +   'padding:0 0 7px;border-bottom:1px solid #EEE;margin-bottom:7px">'
      +   '<span style="color:var(--nbs-muted)">TE HA PAGADO EN TOTAL</span>'
      +   '<span style="color:var(--nbs-green-text)">$' + fmtNum(_totalPagado) + '</span></div>'
      + _cobros.slice(0, 30).map(function(g, gi){
          var repartido = g.partes.length > 1;
          var idDet = 'pago-det-' + cid + '-' + gi;
          var idFle = 'pago-fle-' + cid + '-' + gi;

          // ── EL RENGLÓN: el MONTO COMPLETO primero, que es lo que le preguntan ──
          var fila = '<div ' + (repartido
                ? 'onclick="event.stopPropagation();desplegarPagoCliente(' + _arg(idDet) + ',' + _arg(idFle) + ')" style="cursor:pointer;'
                : 'style="')
            + 'display:flex;justify-content:space-between;align-items:flex-start;gap:8px;'
            + 'padding:8px 0;border-bottom:1px solid #F4F4F8">'
            + '<div style="flex:1;min-width:0">'
            +   '<div style="font-size:13px;font-weight:800;color:var(--nbs-ink)">'
            +     escaparHtml(g.fecha || '') + '</div>'
            +   '<div style="font-size:10.5px;color:var(--nbs-muted);margin-top:1px">'
            +     (repartido
                    ? 'se reparti\u00f3 en ' + g.partes.length + ' facturas'
                    : 'factura ' + escaparHtml(String(g.partes[0].factura)))
            +     (g.metodo ? ' \u00b7 ' + escaparHtml(g.metodo) : '')
            +   '</div>'
            + '</div>'
            + '<div style="font-size:14.5px;font-weight:900;color:var(--nbs-green-text);flex-shrink:0">+$'
            +   fmtNum(g.completo) + '</div>';

          if(repartido){
            // La flechita, para que se vea que se abre
            fila += '<div id="' + idFle + '" style="color:#bbb;font-size:15px;flex-shrink:0;'
              + 'transition:transform .15s">\u203a</div>';
          } else {
            // Sin repartir: los botones van en el propio renglón, como siempre
            var p0 = g.partes[0];
            fila += (p0.idx !== null && p0.idx !== undefined
                ? '<button onclick="event.stopPropagation();editarPagoDesdeCuenta(' + _arg(p0.vid) + ',' + p0.idx + ',' + _arg(K.cliente.id) + ')" '
                  + 'style="background:#FFF8E1;border:1px solid #F9A825;border-radius:7px;padding:6px 9px;'
                  + 'font-size:12px;cursor:pointer;flex-shrink:0" title="Corregir este pago">\u270f\ufe0f</button>'
                  + '<button onclick="event.stopPropagation();borrarPagoDesdeCuenta(' + _arg(p0.vid) + ',' + p0.idx + ',' + _arg(K.cliente.id) + ')" '
                  + 'style="background:#FFEBEE;border:1px solid #C62828;border-radius:7px;padding:6px 9px;'
                  + 'font-size:12px;cursor:pointer;flex-shrink:0" title="Borrar este pago">\ud83d\uddd1\ufe0f</button>'
                : '<button onclick="event.stopPropagation();verFacturaProfesional(' + _arg(p0.vid) + ')" '
                  + 'style="background:#F4F6FB;border:1px solid #b9bfe0;border-radius:7px;padding:6px 9px;'
                  + 'font-size:12px;cursor:pointer;flex-shrink:0" title="Ver la factura">\ud83d\udc41\ufe0f</button>');
          }
          fila += '</div>';

          // ── EL DETALLE, ESCONDIDO HASTA QUE LO TOQUE ──
          if(repartido){
            fila += '<div id="' + idDet + '" style="display:none;background:#F7F9FC;'
              + 'border-left:3px solid var(--nbs-green-text);border-radius:0 8px 8px 0;'
              + 'padding:8px 10px;margin:0 0 7px 4px">'
              + '<div style="font-size:9.5px;font-weight:800;color:var(--nbs-muted);'
              +   'letter-spacing:.4px;margin-bottom:5px">SE APLIC\u00d3 AS\u00cd</div>'
              + g.partes.map(function(p){
                  return '<div style="display:flex;justify-content:space-between;align-items:center;'
                    + 'gap:7px;padding:5px 0;border-bottom:1px solid #EAEEF5">'
                    + '<div style="flex:1;min-width:0;font-size:12px;color:var(--nbs-ink);font-weight:600">'
                    +   'Factura #' + escaparHtml(String(p.factura)) + '</div>'
                    + '<div style="font-size:12.5px;font-weight:800;color:var(--nbs-ink);flex-shrink:0">$'
                    +   fmtNum(p.monto) + '</div>'
                    + (p.idx !== null && p.idx !== undefined
                        ? '<button onclick="event.stopPropagation();editarPagoDesdeCuenta(' + _arg(p.vid) + ',' + p.idx + ',' + _arg(K.cliente.id) + ')" '
                          + 'style="background:#FFF8E1;border:1px solid #F9A825;border-radius:6px;padding:4px 7px;'
                          + 'font-size:11px;cursor:pointer;flex-shrink:0" title="Corregir esta parte">\u270f\ufe0f</button>'
                          + '<button onclick="event.stopPropagation();borrarPagoDesdeCuenta(' + _arg(p.vid) + ',' + p.idx + ',' + _arg(K.cliente.id) + ')" '
                          + 'style="background:#FFEBEE;border:1px solid #C62828;border-radius:6px;padding:4px 7px;'
                          + 'font-size:11px;cursor:pointer;flex-shrink:0" title="Borrar esta parte">\ud83d\uddd1\ufe0f</button>'
                        : '')
                    + '</div>';
                }).join('')
              // Si sobró algo del cobro, se dice: si no, las partes no cuadran con el total
              + (g.completo - g.suma > 0.005
                  ? '<div style="display:flex;justify-content:space-between;padding:5px 0;'
                    + 'font-size:11.5px;color:#E65100;font-weight:700">'
                    + '<span>Qued\u00f3 a su favor</span><span>$' + fmtNum(g.completo - g.suma) + '</span></div>'
                  : '')
              + '</div>';
          }
          return fila;
        }).join('')
      + (_cobros.length > 30
          ? '<div style="font-size:10.5px;color:var(--nbs-muted);text-align:center;padding:6px">y '
            + (_cobros.length - 30) + ' pago(s) m\u00e1s</div>' : '')
    );
    h += _filaPanel('pagos', '\ud83d\udcb5', 'Sus pagos',
      String(_cobros.length) + ' \u00b7 $' + fmtNum(_totalPagado), null, contPagos, 'irACobrarCliente(' + _arg(cid) + ')');
  }

  // ── 🏦 LOS RENGLONES NUEVOS DE LA CUENTA (15 ago) ──
  // Todo lo que envuelve al cliente, visible y editable desde aquí.
  try { h += _renglonCanceladas(K); } catch(e){}
  try { h += _renglonPedidos(K); } catch(e){}
  try { h += _renglonCredito(K); } catch(e){}
  try { h += _renglonNotas(K); } catch(e){}
  try { h += _renglonIntervalo(K); } catch(e){}
  // (los precios especiales se quitaron: Sensei no los usa — 15 ago)
  try { h += _renglonAjustesCuenta(K); } catch(e){}

  // ── 📍 VISITAS ──
  var visitasCont = _sub(
    '<div style="font-size:12.5px;color:var(--nbs-ink);line-height:1.7">'
    + (function(){
        // 📍 El récord DE VERDAD, el mismo que llena la ruta. -16 ago-
        var vv = K.visitas || { compro: [], noCompro: [], total: 0, pct: 0 };
        if(!vv.total) return 'Todav\u00eda no hay ninguna visita apuntada.';
        var ult = [].concat(vv.compro, vv.noCompro).sort(function(a, b){
          var fa = parsearFechaVenta(a), fb = parsearFechaVenta(b);
          return (fb ? fb.getTime() : 0) - (fa ? fa.getTime() : 0);
        })[0];
        var comproUlt = vv.compro.indexOf(ult) >= 0;
        var noEst = (vv.noEstaba || []).length;
        var estabaUlt = (vv.noEstaba || []).indexOf(ult) < 0;
        return '<b>' + vv.total + ' visita(s)</b> apuntada(s)<br>'
          + '\u2705 Te compr\u00f3 en <b>' + vv.compro.length + '</b><br>'
          + '\ud83d\udeab No quiso nada en <b>' + vv.noCompro.length + '</b><br>'
          + (noEst ? '\ud83d\udeaa No estaba en <b>' + noEst + '</b><br>' : '')
          + '<span style="color:var(--nbs-muted)">De las veces que S\u00cd estaba, '
          + 'te compr\u00f3 el <b>' + vv.pct + '%</b></span><br>'
          + '\u00daltima: <b>' + escaparHtml(String(ult)) + '</b> '
          + (comproUlt ? '\u2705 compr\u00f3'
              : (estabaUlt ? '\ud83d\udeab no quiso nada' : '\ud83d\udeaa no estaba'));
      })()
    + (c.intervaloVisitaDias ? '<br>Lo visitas cada <b>' + c.intervaloVisitaDias + ' d\u00edas</b>' : '')
    + '</div>'
    + '<button onclick="event.stopPropagation();marcarVisitaNegocio(' + _arg(cid) + ')" '
    + 'style="width:100%;margin-top:7px;padding:9px;background:#00695C;color:#fff;border:none;border-radius:8px;'
    + 'font-size:11.5px;font-weight:800;cursor:pointer">\ud83d\udccd Marcar visita de hoy</button>'
  );
  h += _filaPanel('visitas', '\ud83d\udccd', 'Visitas',
    (K.visitas && K.visitas.total)
      ? (K.visitas.total + ' \u00b7 ' + K.visitas.pct + '% compr\u00f3')
      : 'ninguna',
    null, visitasCont, 'marcarVisitaNegocio(' + _arg(cid) + ')');

  // ── 🎁 PROGRAMA DE FIDELIDAD (el de los $400) ──
  var fid = null;
  try { fid = calcularFidelidad(c, D.activas); } catch(e){}
  if(fid && fid.consignacion){
    h += _filaPanel('consig', '\ud83d\udd01', 'Cuenta de consignaci\u00f3n', 'fuera de programas', '#00695C',
      _sub('<div style="font-size:12.5px;color:var(--nbs-ink);line-height:1.6">'
        + 'No entra al Programa de Fidelidad ni al VIP. Son productos dejados para pagar seg\u00fan se vendan.</div>'));
  } else if(fid){
    var pctF = Math.min(100, Math.round((fid.total / fid.meta) * 100));
    var listoF = fid.total >= fid.meta;
    var contFid = _sub(
      '<div style="display:flex;justify-content:space-between">'
      + '<span style="font-size:12.5px;font-weight:800;color:var(--nbs-ink)">Compras de menos de $30</span>'
      + '<span style="font-size:12.5px;font-weight:800;color:var(--nbs-gold-dark)">$' + fmtNum(fid.total) + ' / $' + fmtNum(fid.meta) + '</span>'
      + '</div>'
      + '<div style="height:6px;background:#EAEAF2;border-radius:3px;margin-top:6px;overflow:hidden">'
      +   '<div style="height:100%;width:' + pctF + '%;background:var(--nbs-gold)"></div></div>'
      + '<div style="font-size:11px;color:var(--nbs-muted);margin-top:6px;line-height:1.5">'
      +   'Al llegar a $' + fmtNum(fid.meta) + ', dale un regalo entre $10 y $20 para agradecer su preferencia.'
      +   (fid.regalosDados ? '<br>Ya le has dado <b>' + fid.regalosDados + '</b> regalo(s).' : '') + '</div>'
      + '<button onclick="event.stopPropagation();darRegaloFidelidad(' + _arg(cid) + ')" '
      + 'style="width:100%;margin-top:7px;padding:9px;background:' + (listoF ? 'var(--nbs-gold)' : '#fff') + ';'
      + 'color:' + (listoF ? '#fff' : 'var(--nbs-gold-dark)') + ';border:' + (listoF ? 'none' : '1px solid var(--nbs-gold)') + ';'
      + 'border-radius:8px;font-size:11.5px;font-weight:800;cursor:pointer">\ud83c\udf81 Ya le di el regalo'
      + (listoF ? '' : ' (a\u00fan no llega a la meta)') + '</button>'
    );
    h += _filaPanel('fidelidad', '\ud83c\udf81', 'Programa de Fidelidad',
      '$' + fmtNum(fid.total) + ' / $' + fmtNum(fid.meta), 'var(--nbs-gold-dark)', contFid, 'irAFidelidadCliente(' + _arg(cid) + ')');
  }

  // ── ⚙️ AJUSTES DE ESTE CLIENTE ──
  var btn = function(txt, fn, bg, col, borde){
    return '<button onclick="event.stopPropagation();' + fn + '" '
      + 'style="width:100%;margin-bottom:6px;padding:11px;background:' + bg + ';color:' + (col || '#fff') + ';'
      + 'border:' + (borde || 'none') + ';border-radius:9px;font-size:12.5px;font-weight:800;cursor:pointer">'
      + txt + '</button>';
  };
  // El contacto ya NO va aqui: tiene su propio renglon 📇 Sus datos. -11 ago-
  var contAj = ''
    + '<div style="font-size:11px;font-weight:800;color:var(--nbs-muted);letter-spacing:.4px;padding:6px 2px 6px">PROGRAMAS</div>'
    + btn((c.vipActivo ? '\u2b50 Inscrito en VIP \u2014 Toca para retirar' : '\u2606 Inscribir en programa VIP'),
          'toggleVIPBtn(this)', (c.vipActivo ? '#AD1457' : '#546E7A'))
      .replace('<button ', '<button id="btn-vip-cl" data-clid="' + cid + '" ')
    + btn((c.consignacion ? '\ud83d\udd01 Cuenta de CONSIGNACI\u00d3N' : '\ud83d\udd01 Marcar como cuenta de consignaci\u00f3n'),
          'toggleConsignacion(this)', (c.consignacion ? '#00695C' : '#ECEFF1'), (c.consignacion ? '#fff' : '#546E7A'))
      .replace('<button ', '<button id="btn-consig-cl" data-clid="' + cid + '" ')
    + btn((c.sinServicio ? '\ud83d\udeab SIN SERVICIO \u2014 toca para volver a atenderlo' : '\ud83d\udeab Ya no le doy servicio'),
          'toggleSinServicio(this)', (c.sinServicio ? '#B71C1C' : '#ECEFF1'), (c.sinServicio ? '#fff' : '#546E7A'))
      .replace('<button ', '<button id="btn-sinserv-cl" data-clid="' + cid + '" ')
    + '<div style="font-size:11px;font-weight:800;color:var(--nbs-muted);letter-spacing:.4px;padding:6px 2px 6px">ADMINISTRAR</div>'
    + btn('\u270f\ufe0f Editar cliente', 'editarCl(' + cid + ')', '#1565C0')
    + btn('\ud83d\udcb2 Precios especiales de este cliente', 'abrirPreciosPersonalizados(' + cid + ')', '#00695C')
    + btn('\ud83d\udcb0 Agregar balance inicial', 'agregarBalanceInicial(' + cid + ')', '#6A1B9A')
    + btn('\ud83d\uddd1\ufe0f Eliminar cliente', 'eliminarCl(' + cid + ')', '#fff', '#B71C1C', '1px solid #B71C1C');
  h += _filaPanel('ajustes', '\u2699\ufe0f', 'Ajustes', '', null, contAj, 'editarCl(' + _arg(cid) + ')');

  // ── 💵 LO QUE TE DEJA ──
  if(D.comprado > 0){
    var contG = _sub(
      '<div style="font-size:12.5px;color:var(--nbs-ink);line-height:1.7">'
      + 'Te ha comprado <b>$' + fmtNum(D.comprado) + '</b><br>'
      + 'Te deja <b style="color:var(--nbs-green-text)">$' + fmtNum(D.ganancia) + '</b> de ganancia bruta<br>'
      + 'O sea un margen del <b>' + D.margen + '%</b>'
      + '</div>'
      + '<div style="font-size:11px;color:var(--nbs-muted);margin-top:6px;line-height:1.5">'
      + '\u26a0\ufe0f Es ganancia <b>bruta</b>: no incluye gasolina, tiempo ni los dem\u00e1s gastos del negocio.</div>'
    );
    h += _filaPanel('deja', '\ud83d\udcb5', 'Lo que te deja',
      '$' + fmtNum(D.ganancia) + ' \u00b7 ' + D.margen + '%', 'var(--nbs-green-text)', contG);
  }

  el.innerHTML = h;
}

function verCl(id){
  clientes = LS('ncl', []);
  var c = clientes.find(function(x){ return String(x.id) === String(id); });
  if(!c) return;
  ventas = LS('nv', []); creditos = LS('ncr', []);

  // Al cambiar de cliente, todos los renglones arrancan cerrados
  if(String(window._clientePerfilActual) !== String(id)) _panelAbierto = null;
  window._clientePerfilActual = id;

  var el = document.getElementById('cl-perfil-contenido');
  el.innerHTML = '';

  var D = datosDelCliente(id);
  var ini = (nombreCl(c) || '?').split(' ').map(function(p){ return p.charAt(0); })
              .join('').slice(0,2).toUpperCase();

  // ══════════ LA CABECERA ══════════
  var cab = document.createElement('div');
  cab.className = 'card';
  var h = '<div style="display:flex;align-items:center;gap:11px">'
    + '<div style="width:46px;height:46px;border-radius:12px;background:#1a237e;color:#fff;'
    +   'display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:900;flex-shrink:0">'
    +   escaparHtml(ini) + '</div>'
    + '<div style="flex:1;min-width:0">'
    +   '<div style="display:flex;align-items:center;gap:5px;margin-bottom:1px">'
    +     (codigoDeCliente(c)
        ? '<span style="background:#3949AB;color:#fff;border-radius:5px;padding:2px 7px;'
          + 'font-size:10.5px;font-weight:900;letter-spacing:.5px">'
          + codigoDeCliente(c) + '</span>' : '')
    +     '<span style="font-size:9.5px;font-weight:900;color:var(--nbs-muted);letter-spacing:1.2px">'
    +       'CUENTA DE</span>'
    +   '</div>'
    +   '<div style="font-size:21px;font-weight:900;color:var(--nbs-ink);line-height:1.15;overflow:hidden;text-overflow:ellipsis">'
    +     escaparHtml(nombreCl(c)) + '</div>'
    +   '<div style="font-size:12px;color:var(--nbs-muted);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'
    +     (c.negocio ? '\ud83c\udfea ' + escaparHtml(c.negocio) : etiquetaTipoNegocio(c)) + '</div>'
    +   (c.tel ? '<div style="font-size:12.5px;color:var(--nbs-ink);font-weight:700;margin-top:2px">'
    +     '\ud83d\udcde ' + escaparHtml(c.tel) + '</div>' : '')
    + '</div></div>';

  // Aviso si hay otra copia de este mismo cliente
  var dups = posiblesDuplicadosDe(c, clientes);
  if(dups && dups.length){
    h += '<div style="background:var(--nbs-red-bg);border-radius:9px;padding:9px;margin-top:9px;'
      + 'font-size:12px;color:var(--nbs-red-text);font-weight:700">'
      + '\u26a0\ufe0f Hay otra ficha parecida a esta: ' + escaparHtml(nombreCl(dups[0]))
      + '. Su deuda podr\u00eda estar repartida entre las dos.</div>';
  }

  // Los cuatro números
  var n = function(t, v, col){
    return '<div style="flex:1;background:#F5F5F9;border-radius:10px;padding:8px 4px;text-align:center;min-width:0">'
      + '<div style="font-size:9px;font-weight:800;color:var(--nbs-muted);letter-spacing:.3px">' + t + '</div>'
      + '<div style="font-size:14.5px;font-weight:900;margin-top:2px;color:' + (col || 'var(--nbs-ink)') + ';'
      +   'overflow:hidden;text-overflow:ellipsis">' + v + '</div></div>';
  };
  // \ud83d\udcb0 EL CR\u00c9DITO A FAVOR, VISIBLE ARRIBA -6 sep-. Solo sale cuando lo tiene, para
  // no ocupar sitio de balde. Se toca y lleva derecho a aplicarlo.
  var _credArriba = 0;
  try {
    var _cCred = clientes.find(function(x){ return String(x.id) === String(id); });
    _credArriba = parseFloat(_cCred && _cCred.creditoAFavor) || 0;
  } catch(e){}

  // \ud83d\udcb0 EL CR\u00c9DITO, EN EL MISMO CUADRO -6 sep-. Sensei: "si existe debe estar
  // visible as\u00ed como su balance pendiente". Sale una quinta casilla, en naranja y justo
  // al lado de DEBE, solo cuando de verdad tiene cr\u00e9dito.
  h += '<div style="display:flex;gap:6px;margin-top:12px">'
    + n('COMPR\u00d3', '$' + fmtNum(D.comprado))
    + n('DEBE', '$' + fmtNum(D.debe), D.debe > 0.005 ? 'var(--nbs-red-text)' : 'var(--nbs-ink)')
    + (_credArriba > 0.005 ? n('A FAVOR', '$' + fmtNum(_credArriba), '#E65100') : '')
    + n('TE DEJA', '$' + fmtNum(D.ganancia), 'var(--nbs-green-text)')
    + n('\u00daLTIMA', D.diasDesde === null ? '\u2014' : (D.diasDesde + ' d'))
    + '</div>';

  if(_credArriba > 0.005){
    h += '<div onclick="irACobrarCliente(' + _arg(id) + ')" '
      + 'style="display:flex;align-items:center;gap:9px;background:#FFF8E1;'
      + 'border:1.5px solid #FFD54F;border-radius:10px;padding:10px 12px;margin-top:8px;'
      + 'cursor:pointer">'
      + '<div style="font-size:19px">\ud83d\udcb0</div>'
      + '<div style="flex:1;min-width:0">'
      +   '<div style="font-size:9.5px;font-weight:800;color:#8A6D00;letter-spacing:.4px">'
      +     'TIENE A SU FAVOR</div>'
      +   '<div style="font-size:18px;font-weight:900;color:#E65100;line-height:1.1">$'
      +     fmtNum(_credArriba) + '</div>'
      + '</div>'
      + '<div style="font-size:11px;color:#8A6D00;font-weight:700;text-align:right;'
      +   'line-height:1.3">'
      + (D.debe > 0.005 ? 'toca para<br>usarlo' : 'se le usa en<br>su pr\u00f3xima compra')
      + '</div>'
      + (D.debe > 0.005
          ? '<div style="color:#E65100;font-size:16px;font-weight:900">\u203a</div>'
          : '')
      + '</div>';
  }

  // Los tres botones de siempre
  h += '<div style="display:flex;gap:6px;margin-top:11px">'
    + '<button class="btn" style="flex:1;margin:0;background:#6A1B9A;color:#fff;padding:11px 4px;font-size:12.5px" onclick="irAPedidoCliente(' + id + ')">\u26a1 Pedido</button>'
    + '<button class="btn" style="flex:1;margin:0;background:#00695C;color:#fff;padding:11px 4px;font-size:12.5px" onclick="irACobrarCliente(' + id + ')">\ud83d\udcb5 Cobrar</button>'
    + '<button class="btn" style="flex:1;margin:0;background:#1565C0;color:#fff;padding:11px 4px;font-size:12.5px" onclick="irAVenderCliente(' + id + ')">\ud83e\uddfe Vender</button>'
    + '</div>'
    // 💬 LOS 7 MENSAJES -16 sep-
    + '<button class="btn" style="width:100%;margin:6px 0 0;background:#25D366;'
    +   'color:#fff;padding:11px;font-size:13px;font-weight:800" '
    +   'onclick="abrirMensajeCliente(' + _arg(id) + ')">'
    +   '\ud83d\udcac Mandarle un mensaje</button>';
  cab.innerHTML = h;
  el.appendChild(cab);

  // ══════════ LA LISTA COMPACTA ══════════
  var panel = document.createElement('div');
  panel.id = 'cl-panel-completo';
  panel.style.cssText = 'background:#fff;border-radius:13px;overflow:hidden;margin-bottom:10px;box-shadow:0 1px 3px rgba(0,0,0,.09)';
  el.appendChild(panel);
  try { pintarPanelCliente(id); } catch(ePanel){}

  // Show profile page (usando ir() para que el historial de navegacion funcione)
  ir('p-cl-perfil');
}

// ═══════════════════════════════════════════════════════════════════
//  💬 LOS 7 MENSAJES AL CLIENTE  (16 sep 2026)
//
//  Sensei los redactó él mismo, en voz de EMPRESA: "quiero usar un lenguaje de
//  negocios, basado en una empresa de prestigio y excelente reputación, con el mayor
//  respeto posible para mis clientes".
//
//  🔑 Los 7 casos posibles del día, con los números reales de cada cliente.
//  Las despedidas rotan solas para que no suene monótono.
// ═══════════════════════════════════════════════════════════════════

// 🔑 Las despedidas. Se elige una al azar cada vez, y las dos últimas solo en su caso.
var DESPEDIDAS_NBS = [
  'Gracias por hacer negocio con nosotros, estamos para servirle.',
  'Agradecemos su preferencia. Quedamos a su entera disposición.',
  'Es un placer atenderle. Cuente con nosotros para lo que necesite.',
  'Gracias por su confianza. Seguimos a su servicio.',
  'Apreciamos su preferencia. Estamos para apoyarle en lo que precise.'
];
var DESPEDIDA_AL_DIA = 'Agradecemos su puntualidad en el pago. Un gusto trabajar con usted.';
var DESPEDIDA_A_FAVOR = 'Gracias por su confianza. Su crédito queda disponible cuando lo necesite.';

function despedidaNBS(caso){
  if(caso === 'aldia') return DESPEDIDA_AL_DIA;
  if(caso === 'afavor') return DESPEDIDA_A_FAVOR;
  var n = (typeof window._despedidaVa === 'number') ? window._despedidaVa : -1;
  n = (n + 1) % DESPEDIDAS_NBS.length;
  window._despedidaVa = n;
  return DESPEDIDAS_NBS[n];
}

/**
 * 💬 Arma el mensaje del caso que Sensei escoja, con los números reales del cliente.
 * casos: pago · compraypago · compra · aldia · demas · devolucion · credito
 */
function mensajeNBS(cid, caso, datos){
  datos = datos || {};
  clientes = LS('ncl', []);
  ventas = LS('nv', []);
  var c = clientes.find(function(x){ return String(x.id) === String(cid); });
  if(!c) return '';

  // Lo que debe AHORA
  var debe = 0;
  ventas.forEach(function(v){
    if(String(v.cid) !== String(cid) || v.cancelada) return;
    debe += cobradoYDebeDe(v).debe;
  });
  debe = Math.round(debe * 100) / 100;
  var aFavor = Math.round((parseFloat(c.creditoAFavor) || 0) * 100) / 100;

  var compra = Math.round((parseFloat(datos.compra) || 0) * 100) / 100;
  var pago = Math.round((parseFloat(datos.pago) || 0) * 100) / 100;
  var devolucion = Math.round((parseFloat(datos.devolucion) || 0) * 100) / 100;
  var credito = Math.round((parseFloat(datos.credito) || 0) * 100) / 100;

  // 🔑 El balance de antes se deduce SOLO con lo que de verdad pasó en este caso. -16 sep-
  var antes = debe;
  if(caso === 'pago' || caso === 'aldia' || caso === 'demas'){
    antes = debe + pago;
  } else if(caso === 'compraypago'){
    antes = debe + pago - compra;
  } else if(caso === 'compra'){
    antes = debe - compra;
  } else if(caso === 'devolucion'){
    antes = debe + devolucion;
  } else if(caso === 'credito'){
    antes = debe + credito - compra;
  }
  antes = Math.round(antes * 100) / 100;
  if(antes < 0) antes = 0;

  var d = function(n){ return '$' + fmtNum(n); };
  var t = [];
  t.push('Estimado Sr. ' + (c.nombre || nombreCl(c)) + ',');
  t.push('');

  if(caso === 'pago'){
    t.push('Tenía un balance pendiente de ' + d(antes));
    t.push('');
    t.push('Hoy registramos su pago de ' + d(pago));
    t.push('');
    t.push('Queda con un balance pendiente al día de hoy de ' + d(debe));
    t.push('');
    t.push(despedidaNBS());

  } else if(caso === 'compraypago'){
    t.push('Tenía un balance pendiente de ' + d(antes));
    t.push('');
    t.push('Hoy realizó una compra por valor de ' + d(compra));
    t.push('');
    t.push('Y registramos su pago de ' + d(pago));
    t.push('');
    t.push('Queda con un balance pendiente al día de hoy de ' + d(debe));
    t.push('');
    t.push(despedidaNBS());

  } else if(caso === 'compra'){
    t.push('Tenía un balance pendiente de ' + d(antes));
    t.push('');
    t.push('Hoy realizó una compra por valor de ' + d(compra));
    t.push('');
    t.push('Queda con un balance pendiente al día de hoy de ' + d(debe));
    t.push('');
    t.push(despedidaNBS());

  } else if(caso === 'aldia'){
    t.push('Tenía un balance pendiente de ' + d(antes));
    t.push('');
    t.push('Hoy registramos su pago de ' + d(pago));
    t.push('');
    t.push('Su cuenta queda al día, con balance de $0.00 \u2705');
    t.push('');
    t.push(despedidaNBS('aldia'));

  } else if(caso === 'demas'){
    t.push('Tenía un balance pendiente de ' + d(antes));
    t.push('');
    t.push('Hoy registramos su pago de ' + d(pago));
    t.push('');
    t.push('Su cuenta queda al día, y con ' + d(aFavor)
      + ' a favor para su próxima compra');
    t.push('');
    t.push(despedidaNBS('afavor'));

  } else if(caso === 'devolucion'){
    t.push('Tenía un balance pendiente de ' + d(antes));
    t.push('');
    t.push('Hoy registramos la devolución de ' + d(devolucion));
    t.push('');
    t.push('Queda con un balance pendiente al día de hoy de ' + d(debe));
    t.push('');
    t.push(despedidaNBS());

  } else if(caso === 'credito'){
    t.push('Tenía ' + d(credito) + ' a favor');
    t.push('');
    t.push('Hoy realizó una compra por valor de ' + d(compra));
    t.push('');
    t.push('Aplicamos su crédito a favor y queda con un balance pendiente al día de hoy de '
      + d(debe));
    t.push('');
    t.push(despedidaNBS());
  }

  t.push('');
  t.push('Att. Nunez Beauty Supply');
  return t.join('\n');
}


// ═══════════════════════════════════════════════════════════════════
//  📤 LA PANTALLA PARA ESCOGER EL MENSAJE  (16 sep 2026)
//  Sensei escoge qué pasó hoy, ve el mensaje armado, y lo manda por WhatsApp.
//  En WhatsApp todavía lo puede editar antes de darle a enviar.
// ═══════════════════════════════════════════════════════════════════

var CASOS_MENSAJE = [
  ['pago',        '① Pagó y no compró'],
  ['compraypago', '② Compró y pagó'],
  ['compra',      '③ Compró y no pagó'],
  ['aldia',       '④ Quedó al día'],
  ['demas',       '⑤ Pagó de más'],
  ['devolucion',  '⑥ Devolvió mercancía'],
  ['credito',     '⑦ Usó su crédito a favor']
];

function abrirMensajeCliente(cid, datos){
  if(!cid) return;
  clientes = LS('ncl', []);
  var c = clientes.find(function(x){ return String(x.id) === String(cid); });
  if(!c){ avisoGrande('No encontré ese cliente.'); return; }

  window._msgCid = cid;
  window._msgDatos = datos || {};
  window._msgCaso = null;

  var ov = document.getElementById('msgcli-overlay');
  if(!ov){
    ov = document.createElement('div');
    ov.id = 'msgcli-overlay';
    document.body.appendChild(ov);
  }
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:100007;'
    + 'display:flex;align-items:center;justify-content:center;padding:13px';
  ov.onclick = function(e){ if(e.target === ov) cerrarMensajeCliente(); };
  pintarMensajeCliente();
  ov.style.display = 'flex';
}

function cerrarMensajeCliente(){
  var ov = document.getElementById('msgcli-overlay');
  if(ov) ov.style.display = 'none';
}

function pintarMensajeCliente(){
  var cid = window._msgCid;
  var c = clientes.find(function(x){ return String(x.id) === String(cid); });
  if(!c) return;
  var caso = window._msgCaso;

  var h = '<div style="background:#fff;border-radius:14px;padding:15px;max-width:430px;'
    +   'width:100%;max-height:92vh;overflow:auto">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;'
    +   'margin-bottom:11px">'
    +   '<div style="font-size:15px;font-weight:900;color:var(--nbs-ink)">'
    +     '\ud83d\udce4 Mensaje al cliente</div>'
    +   '<button onclick="cerrarMensajeCliente()" style="background:#F0F0F2;border:none;'
    +     'border-radius:9px;width:32px;height:32px;font-size:15px;cursor:pointer">\u2715</button>'
    + '</div>'
    + '<div style="background:#FFF8E1;border-radius:9px;padding:9px;margin-bottom:11px;'
    +   'font-size:13.5px;font-weight:800">' + escaparHtml(nombreCl(c)) + '</div>';

  if(!caso){
    // ① Escoger qué pasó hoy
    h += '<div style="font-size:11px;font-weight:800;color:#8A8B9E;margin-bottom:6px">'
      +   '\u00bfQU\u00c9 PAS\u00d3 HOY?</div>'
      + CASOS_MENSAJE.map(function(x){
          return '<button onclick="escogerCaso(\'' + x[0] + '\')" '
            + 'style="width:100%;padding:12px;margin-bottom:6px;background:#fff;'
            + 'border:1.5px solid #D4D5E0;border-radius:10px;font-size:13.5px;'
            + 'font-weight:700;text-align:left;cursor:pointer">' + x[1] + '</button>';
        }).join('')
      // 🔑 La salida clara: antes solo estaba la ✕ de arriba y no se veía. -17 sep-
      + '<button onclick="cerrarMensajeCliente()" style="width:100%;padding:13px;'
      +   'margin-top:9px;background:#F0F0F2;color:#555;border:none;border-radius:10px;'
      +   'font-size:13.5px;font-weight:800;cursor:pointer">'
      +   'No mandar ning\u00fan mensaje</button>';
  } else if(window._msgLargo === null || window._msgLargo === undefined){
    // ② ¿Corto o largo? Como antes de los 7 mensajes -Sensei, 17 sep-
    h += '<div style="font-size:11px;font-weight:800;color:#8A8B9E;margin-bottom:6px">'
      +   '\u00bfC\u00d3MO SE LO MANDO?</div>'
      + '<button onclick="escogerLargoCorto(false)" style="width:100%;padding:13px;'
      +   'margin-bottom:7px;background:#fff;border:1.5px solid #1a237e;border-radius:11px;'
      +   'text-align:left;cursor:pointer">'
      +   '<div style="font-size:14px;font-weight:900;color:#1a237e">\ud83d\udcdd CORTO</div>'
      +   '<div style="font-size:11.5px;color:#8A8B9E;margin-top:1px">'
      +     'Solo lo de hoy y su balance</div></button>'
      + '<button onclick="escogerLargoCorto(true)" style="width:100%;padding:13px;'
      +   'margin-bottom:7px;background:#fff;border:1.5px solid #0B7A3B;border-radius:11px;'
      +   'text-align:left;cursor:pointer">'
      +   '<div style="font-size:14px;font-weight:900;color:#0B7A3B">\ud83d\udcc4 LARGO</div>'
      +   '<div style="font-size:11.5px;color:#8A8B9E;margin-top:1px">'
      +     'Con el detalle de lo que debe</div></button>'
      + '<button onclick="window._msgCaso=null;pintarMensajeCliente()" '
      +   'style="width:100%;padding:11px;margin-top:4px;background:#F0F0F2;color:#444;'
      +   'border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer">'
      +   '\u2039 Escoger otro caso</button>'
      + '<button onclick="cerrarMensajeCliente()" style="width:100%;padding:12px;'
      +   'margin-top:7px;background:#fff;color:#8A8B9E;border:1.5px solid #D4D5E0;'
      +   'border-radius:10px;font-size:13px;font-weight:700;cursor:pointer">'
      +   'No mandar ning\u00fan mensaje</button>';
  } else {
    // ③ Ver el mensaje y mandarlo
    var texto = mensajeNBS(cid, caso, window._msgDatos);
    if(window._msgLargo){
      // 📄 El largo lleva el detalle, justo antes de la despedida
      var det = detalleDeSusFacturas(cid);
      if(det){
        var lineas = texto.split('\n');
        var iFirma = lineas.length - 1;
        while(iFirma > 0 && !/^Att\./.test(lineas[iFirma])) iFirma--;
        if(iFirma > 2) lineas.splice(iFirma - 2, 0, det);
        texto = lineas.join('\n');
      }
    }
    window._msgTexto = texto;
    h += '<div style="background:#F6F7FB;border:1.5px solid #E5E6EE;border-radius:11px;'
      +   'padding:13px;font-size:13px;line-height:1.6;white-space:pre-wrap;'
      +   'margin-bottom:11px">' + escaparHtml(texto) + '</div>'
      + '<button onclick="mandarMensajeCliente()" style="width:100%;padding:14px;'
      +   'background:#25D366;color:#fff;border:none;border-radius:11px;font-size:15px;'
      +   'font-weight:900;cursor:pointer">\ud83d\udce4 Mandar por WhatsApp</button>'
      + '<button onclick="otraDespedida()" style="width:100%;padding:11px;margin-top:7px;'
      +   'background:#fff;color:#1a237e;border:1.5px solid #1a237e;border-radius:10px;'
      +   'font-size:13px;font-weight:800;cursor:pointer">\ud83d\udd04 Otra despedida</button>'
      + '<button onclick="window._msgLargo=null;pintarMensajeCliente()" '
      +   'style="width:100%;padding:11px;margin-top:7px;background:#F0F0F2;color:#444;'
      +   'border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer">'
      +   '\u2039 Atr\u00e1s</button>'
      + '<button onclick="cerrarMensajeCliente()" style="width:100%;padding:12px;'
      +   'margin-top:7px;background:#fff;color:#8A8B9E;border:1.5px solid #D4D5E0;'
      +   'border-radius:10px;font-size:13px;font-weight:700;cursor:pointer">'
      +   'No mandar ning\u00fan mensaje</button>';
  }
  h += '</div>';
  document.getElementById('msgcli-overlay').innerHTML = h;
}

function escogerCaso(caso){
  window._msgCaso = caso;
  window._msgLargo = null;      // todavía no ha elegido corto o largo
  pintarMensajeCliente();
}

// 🔑 Corto o largo, como antes de los 7 mensajes. -17 sep-
function escogerLargoCorto(largo){
  window._msgLargo = !!largo;
  pintarMensajeCliente();
}

/**
 * 📄 EL LARGO: el mismo mensaje del caso, más el detalle de lo que debe factura por
 * factura. El CORTO es solo lo de hoy y su balance.
 */
function detalleDeSusFacturas(cid){
  try {
    ventas = LS('nv', []);
    var suyas = ventas.filter(function(v){
      if(String(v.cid) !== String(cid) || v.cancelada) return false;
      return cobradoYDebeDe(v).debe > 0.005;
    });
    if(!suyas.length) return '';
    suyas.sort(function(a, b){
      var fa = 0, fb = 0;
      try { fa = parsearFechaVenta(a.fecha).getTime(); } catch(e){}
      try { fb = parsearFechaVenta(b.fecha).getTime(); } catch(e){}
      return fa - fb;
    });
    var t = [];
    t.push('');
    t.push('\ud83d\udcc4 *Detalle de lo pendiente:*');
    suyas.forEach(function(v){
      var d = cobradoYDebeDe(v);
      t.push('\u00b7 ' + (v.fecha || '') + (v.numFactura ? ' \u00b7 #' + v.numFactura : '')
        + ' \u2014 $' + fmtNum(d.debe));
    });
    return t.join('\n');
  } catch(e){ return ''; }
}

function otraDespedida(){
  pintarMensajeCliente();      // despedidaNBS() ya rota sola
}

function mandarMensajeCliente(){
  var cid = window._msgCid;
  if(!cid || !window._msgTexto) return;
  cerrarMensajeCliente();
  // 🔑 Se usa la de siempre: ya maneja el teléfono, el copiado y su modo de WhatsApp
  try { enviarPorWhatsAppACliente(cid, window._msgTexto); }
  catch(e){ avisoGrande('No pude abrir WhatsApp.'); }
}

function textoParaCliente(cid, tipo, monto, detalleFacturas){
  clientes = LS('ncl', []);
  ventas = LS('nv', []);
  var c = clientes.find(function(x){ return String(x.id) === String(cid); });
  if(!c) return '';

  var debe = 0;
  ventas.forEach(function(v){
    if(String(v.cid) !== String(cid) || v.cancelada) return;
    debe += cobradoYDebeDe(v).debe;
  });
  debe = Math.round(debe * 100) / 100;
  var aFavor = parseFloat(c.creditoAFavor) || 0;

  var t = [];
  t.push('*NUNEZ BEAUTY SUPPLY*');
  t.push('_Tu proveedor de confianza_');
  t.push('');
  t.push('Buenas, Sr. ' + (c.nombre || nombreCl(c)) + ' \ud83d\udc4b');
  t.push('');

  if(tipo === 'pago'){
    t.push('Le confirmo su pago:');
    t.push('');
    t.push('\u25aa\ufe0f Pago recibido        $' + fmtNum(monto));
    if(detalleFacturas && detalleFacturas.length > 1){
      t.push('');
      t.push('Lo apliqué así:');
      detalleFacturas.forEach(function(d){
        t.push('   • $' + fmtNum(d.monto) + ' → factura del ' + d.fecha);
      });
    }
  } else {
    t.push('Le dejo el detalle de su pedido de hoy:');
    t.push('');
    t.push('\u25aa\ufe0f Mercanc\u00eda entregada   $' + fmtNum(monto));
    // 🔑 Si abonó algo en la misma visita, se le dice. Antes solo veía lo entregado y
    // el balance, y no quedaba claro que su abono se hubiera apuntado. -12 sep-
    var abonado = 0;
    try {
      // La última factura suya de hoy: lo que haya pagado en ella es su abono
      var suyasHoy = ventas.filter(function(v){
        return String(v.cid) === String(cid) && !v.cancelada && v.fecha === fechaHoy();
      });
      var ult = suyasHoy.length ? suyasHoy[suyasHoy.length - 1] : null;
      if(ult){
        (ult.pagosFactura || []).forEach(function(p){
          if(!p || p.esDevolucion) return;
          abonado += (typeof dinero === 'function') ? dinero(p.monto) : (parseFloat(p.monto) || 0);
        });
      }
    } catch(e){}
    if(abonado > 0.005){
      t.push('\u25aa\ufe0f Abono recibido        $' + fmtNum(abonado));
    }
  }

  t.push('\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501');
  if(debe > 0.005){
    t.push('\u25aa\ufe0f *Balance pendiente     $' + fmtNum(debe) + '*');
  } else {
    t.push('\u25aa\ufe0f *Balance: $0.00 \u2014 al d\u00eda* \u2705');
  }
  t.push('\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501');
  if(aFavor > 0.005){
    t.push('');
    t.push('\ud83d\udcb0 Tiene $' + fmtNum(aFavor) + ' a favor para su pr\u00f3xima compra.');
  }
  t.push('');
  t.push('\ud83d\udcc5 ' + fechaHoy() + ' \u00b7 ' + horaAhora());
  t.push('');
  t.push('Estamos siempre a su orden. Si tiene alguna duda, cont\u00e1cteme con '
       + 'confianza \u2014 estamos para servirle.');
  t.push('');
  t.push('Gracias por su preferencia.');

  // \ud83c\udf81 EL PROGRAMA VIP. A prop\u00f3sito NO se le dice de cu\u00e1l producto: as\u00ed pregunta,
  // y cuando pregunta, compra. -Sensei, 12 sep-
  try {
    var _vip = calcVIP(cid) || {};
    var _max = 0;
    Object.keys(_vip).forEach(function(k){
      var pts = (_vip[k].puntos || 0) % 10;
      if((_vip[k].puntos || 0) > 0 && pts === 0) pts = 10;
      if(pts > _max) _max = pts;
    });
    t.push('');
    if(_max >= 10){
      t.push('\ud83c\udf81 *\u00a1Ya complet\u00f3 sus 10 puntos!* Su pr\u00f3ximo producto va por '
           + 'nuestra cuenta.');
    } else if(_max > 0){
      t.push('\ud83c\udf81 *Lleva ' + _max + ' puntos de 10* en uno de los productos de su '
           + 'Programa VIP.');
    } else {
      t.push('\ud83c\udf81 *Programa VIP de Lealtad:* al comprar 10 del mismo producto, '
           + 'el siguiente va por nuestra cuenta.');
    }
  } catch(e){}

  t.push('');
  t.push('_Nunez Beauty Supply_');
  return t.join('\n');
}

// El estado de cuenta entero, en texto, para mandárselo cuando hay discusión.
function ultimoPagoDelCliente(cid){
  ventas = LS('nv', []);
  var mejor = null;
  ventas.forEach(function(v){
    if(String(v.cid) !== String(cid) || v.cancelada) return;
    (v.pagosFactura || []).forEach(function(p){
      if(!p || p.esDevolucion) return;
      var m = (typeof dinero === 'function') ? dinero(p.monto) : (parseFloat(p.monto) || 0);
      if(!isFinite(m) || m <= 0.005) return;
      var f = p.fecha || '';
      // Si el pago se repartió entre facturas, el cobro COMPLETO es lo que él pagó
      var completo = (typeof p.montoCobro === 'number' && p.montoCobro > 0) ? p.montoCobro : m;
      var d = parsearFechaVenta(f);
      var cuando = d ? d.getTime() : 0;
      if(!mejor || cuando > mejor.cuando){
        mejor = { monto: completo, fecha: f, cuando: cuando, recibo: p.recibo || null };
      }
    });
  });
  return mejor;
}

// ¿Ese pago es de HOY? Si lo es, el mensaje habla en presente.
function textoCortoParaCliente(cid, monto){
  clientes = LS('ncl', []);
  ventas = LS('nv', []);
  var c = clientes.find(function(x){ return String(x.id) === String(cid); });
  if(!c) return '';
  var debe = 0;
  ventas.forEach(function(v){
    if(String(v.cid) !== String(cid) || v.cancelada) return;
    debe += cobradoYDebeDe(v).debe;
  });
  debe = Math.round(debe * 100) / 100;
  var nom = String(c.nombre || nombreCl(c) || '').trim();

  var t = [];
  t.push('Hola Sr. ' + nom + ',');
  t.push('');

  // 📅 QUÉ PAGO SE NOMBRA Y CÓMO — Sensei, 3 sep. "Pago de hoy" era falso cuando el
  // pago fue días antes: él manda el mensaje después, solo para que el barbero tenga
  // su balance al día. Ahora la app elige la frase según CUÁNDO fue el pago.
  var _pg = null;
  try { _pg = ultimoPagoDelCliente(cid); } catch(e){}
  // Si viene un monto de un cobro que se acaba de hacer, ese manda.
  var _montoDado = (typeof monto === 'number' && monto > 0.005) ? monto : null;

  if(_montoDado){
    // Le acaban de cobrar: se habla en presente, con el monto de ese cobro.
    t.push('Recib\u00ed su pago de $' + fmtNum(_montoDado));
    t.push('');
  } else if(_pg && _pagoEsDeHoy(_pg.fecha)){
    // El \u00faltimo pago es de hoy: tambi\u00e9n en presente, sin repetir la fecha.
    t.push('Recib\u00ed su pago de $' + fmtNum(_pg.monto));
    t.push('');
  } else if(_pg){
    // Fue otro d\u00eda: se dice CU\u00c1L y DE CU\u00c1NDO, para que no haya confusi\u00f3n.
    t.push('Su \u00faltimo pago: $' + fmtNum(_pg.monto));
    if(_pg.fecha) t.push('del ' + _pg.fecha);
    t.push('');
  }
  // Si nunca ha pagado, no se habla de pagos: se va derecho al balance.

  if(debe > 0.005){
    t.push('Su balance pendiente es de $' + fmtNum(debe) + '.');
    t.push('');
    t.push('Favor confirmar que est\u00e1 de acuerdo. Gracias.');
  } else {
    t.push('Su cuenta est\u00e1 al d\u00eda \u2014 no tiene balance pendiente.');
    t.push('');
    t.push('Gracias por su confianza.');
  }
  return t.join('\n');
}

// El corto desde el estado de cuenta: toma el ÚLTIMO cobro que le hizo, para poder
// mandárselo cuando quiera y no solo justo después de cobrar.
// 💬 EL COMPROBANTE DE UN PAGO CUALQUIERA  (Sensei, 30 ago)
//
// Sus palabras: "pero si quiero enviarle un mensaje a los pagos YA HECHOS en la app,
// ¿no se puede usar esta vía?". Tenía razón: el botón de abajo tomaba siempre el
// ÚLTIMO pago, así que no había forma de mandarle el comprobante de un cobro de hace
// tres semanas. Ahora cada pago del estado de cuenta lleva sus propios botones.
//
// completo = 1 → el mensaje largo con el reparto.  completo = 0 → la línea corta.
function _telDelCliente(cid){
  clientes = LS('ncl', []);
  var c = clientes.find(function(x){ return String(x.id) === String(cid); });
  var tel = c ? String(c.tel || '').replace(/[^0-9]/g, '') : '';
  if(tel.length === 10) tel = '1' + tel;
  return tel;
}

// ── LAS CUATRO FORMAS ──

// 💬 WhatsApp — un toque. Igual que siempre, al Business si lo tiene puesto.
function enviarPorWhatsAppACliente(cid, texto){
  var tel = _telDelCliente(cid);
  _copiarTexto(texto);                    // 🛡️ por si el enlace falla, ya lo tiene
  cerrarComoMandar();
  if(!tel){
    avisoGrande('\ud83d\udccb Copi\u00e9 el mensaje.\n\nEste cliente no tiene tel\u00e9fono guardado, '
      + 'as\u00ed que p\u00e9galo donde quieras.');
    return;
  }
  if(LS('nbs_wa_pegar', '0') === '1'){
    avisoGrande('\ud83d\udccb Copi\u00e9 el mensaje.\n\nSe abre el chat: mant\u00e9n el dedo en la casilla y dale PEGAR.');
    try { window.location.href = _linkWhatsApp(tel); } catch(e){}
    return;
  }
  try { window.location.href = _linkWhatsApp(tel, texto); } catch(e){}
}

// 💌 Mensaje de texto (SMS) — un toque también, como pidió Sensei.
function enviarPorSMSACliente(cid, texto){
  var tel = _telDelCliente(cid);
  _copiarTexto(texto);
  cerrarComoMandar();
  if(!tel){
    avisoGrande('\ud83d\udccb Copi\u00e9 el mensaje.\n\nEste cliente no tiene tel\u00e9fono guardado.');
    return;
  }
  // El iPhone usa & y Android usa ? para el cuerpo del mensaje. Se manda el que toca.
  var sep = esAndroid() ? '?' : '&';
  try {
    window.location.href = 'sms:+' + tel + sep + 'body=' + encodeURIComponent(String(texto || ''));
  } catch(e){
    avisoGrande('\ud83d\udccb No se pudo abrir Mensajes, pero el texto qued\u00f3 copiado.');
  }
}

// 📋 Copiar
function copiarMensajeDelCliente(texto){
  var ok = _copiarTexto(texto);
  cerrarComoMandar();
  avisoGrande(ok
    ? '\ud83d\udccb Copiado.\n\nP\u00e9galo donde quieras: Messenger, correo, un mensaje de texto...'
    : 'No se pudo copiar en este navegador.');
}

// 📤 Compartir — el menú del propio teléfono
// ═══════════════════════════════════════════════════════════════════
//  📊 ESTADO POR FECHAS  (5 sep 2026)
//
//  Sensei: "necesito un reporte donde se vea cada factura y cada pago por orden de
//  fecha y que yo pueda tocar cada uno para verlo con todos sus detalles... y poder
//  enviarle un estado al cliente donde vea todo lo que ha comprado y todo lo que ha
//  pagado de acuerdo a las fechas que yo elija".
//
//  Y para el mensaje al cliente: "cada compra, y a cada compra que se le vea cada pago
//  aplicado... y si el último pago le cae a esa factura y a otra, que también se vea el
//  total de ese pago y la distribución, para que el cliente esté claro".
// ═══════════════════════════════════════════════════════════════════

// De MM/DD/AAAA a un número que se puede ordenar y comparar. 0 si la fecha viene mal.
function _fechaNum(f) {
  var d = null;
  try { d = parsearFechaVenta(f); } catch (e) {}
  return d ? d.getTime() : 0;
}

/**
 * Todo el movimiento de un cliente entre dos fechas, en orden.
 * Devuelve facturas, pagos y devoluciones mezclados y ordenados por fecha.
 */
function movimientoEntreFechas(cid, desde, hasta) {
  ventas = LS('nv', []);
  var dN = desde ? _fechaNum(desde) : 0;
  var hN = hasta ? _fechaNum(hasta) + 86399000 : Infinity;   // hasta el final de ese día

  var lista = [], facturado = 0, pagado = 0, devuelto = 0;
  var porRecibo = {};   // para juntar las partes de un mismo cobro

  ventas.forEach(function (v) {
    if (String(v.cid) !== String(cid)) return;

    var fv = _fechaNum(v.fecha);
    var dentroFactura = fv >= dN && fv <= hN;
    if (dentroFactura && !v.cancelada) {
      facturado += (typeof dinero === 'function') ? dinero(v.total) : (parseFloat(v.total) || 0);
    }
    if (dentroFactura) {
      lista.push({
        tipo: v.cancelada ? 'cancelada' : 'factura',
        cuando: fv, fecha: v.fecha, hora: v.hora || '',
        vid: v.id, nf: v.numFactura || String(v.id),
        monto: (typeof dinero === 'function') ? dinero(v.total) : (parseFloat(v.total) || 0),
        items: (v.items || []).length,
        tipoPago: v.tipo || '',
        debe: v.cancelada ? 0 : cobradoYDebeDe(v).debe
      });
    }

    // Los pagos van por su PROPIA fecha, que puede caer en otro rango que la factura
    (v.pagosFactura || []).forEach(function (p) {
      if (!p) return;
      var fp = _fechaNum(p.fecha || v.fecha);
      if (fp < dN || fp > hN) return;
      var m = (typeof dinero === 'function') ? dinero(p.monto) : (parseFloat(p.monto) || 0);
      if (!isFinite(m) || m <= 0.005) return;

      if (p.esDevolucion) {
        devuelto += m;
        lista.push({ tipo: 'devolucion', cuando: fp, fecha: p.fecha || v.fecha,
                     vid: v.id, nf: v.numFactura || String(v.id), monto: m, pid: p.pid || '' });
        return;
      }

      pagado += m;
      // 🔑 Las partes de un mismo cobro se juntan: el cliente pagó UNA vez, aunque se
      // repartiera en varias facturas. Sin recibo, cada pago va suelto.
      // Con recibo, las partes del mismo cobro se juntan. Sin recibo -los pagos de antes
      // del 29 ago- cada uno va SUELTO: si no, dos pagos del mismo dia a la misma
      // factura se mezclarian en uno y se veria "#0053 · #0053". -5 sep-
      var clave = p.recibo ? ('R:' + p.recibo)
                           : ('S:' + v.id + '|' + (p.pid || (fp + '|' + m)));
      if (!porRecibo[clave]) {
        porRecibo[clave] = {
          tipo: 'pago', cuando: fp, fecha: p.fecha || v.fecha,
          recibo: p.recibo || null,
          completo: (typeof p.montoCobro === 'number' && p.montoCobro > 0) ? p.montoCobro : 0,
          metodo: p.metodo || (p.metodos ? 'varios' : ''),
          partes: [], suma: 0
        };
        lista.push(porRecibo[clave]);
      }
      var g = porRecibo[clave];
      g.partes.push({ vid: v.id, nf: v.numFactura || String(v.id), monto: m,
                      totalFactura: (typeof dinero === 'function') ? dinero(v.total) : (parseFloat(v.total) || 0) });
      g.suma = Math.round((g.suma + m) * 100) / 100;
      if (!g.completo) g.completo = g.suma;
    });
  });

  // Del más viejo al más nuevo, como se lee un extracto
  lista.sort(function (a, b) { return a.cuando - b.cuando; });

  var r2 = function (x) { return Math.round(x * 100) / 100; };
  return {
    lista: lista,
    facturado: r2(facturado),
    pagado: r2(pagado),
    devuelto: r2(devuelto),
    // El balance TOTAL del cliente, no solo el del rango: es lo que de verdad debe hoy
    debeHoy: (function () { try { return balanceDelCliente(cid); } catch (e) { return 0; } })()
  };
}

/**
 * 📄 EL TEXTO PARA EL CLIENTE.
 * Cada compra con SUS pagos aplicados debajo, y al final el detalle de cada pago
 * entero con su reparto — que es lo que Sensei pidió para que el barbero lo entienda.
 */
function textoEstadoPorFechas(cid, desde, hasta) {
  clientes = LS('ncl', []);
  var c = clientes.find(function (x) { return String(x.id) === String(cid); });
  if (!c) return '';
  var m = movimientoEntreFechas(cid, desde, hasta);

  var t = [];
  t.push('NUNEZ BEAUTY SUPPLY');
  t.push('Estado de cuenta');
  t.push('');
  t.push(nombreCl(c));
  if (c.negocio) t.push(c.negocio);
  t.push('Del ' + (desde || 'principio') + ' al ' + (hasta || 'hoy'));
  t.push('');
  t.push('--------------------------------');

  // ── LO QUE COMPRÓ, con sus pagos debajo ──
  var facturas = m.lista.filter(function (x) { return x.tipo === 'factura'; });
  if (!facturas.length) {
    t.push('No hay compras en esas fechas.');
  } else {
    t.push('LO QUE COMPRO');
    t.push('');
    facturas.forEach(function (f) {
      t.push('Factura #' + f.nf + '  ·  ' + f.fecha);
      t.push('   Total: $' + fmtNum(f.monto));
      // 🔑 Cada pago que se le aplicó a ESTA factura
      var suyos = [];
      m.lista.forEach(function (x) {
        if (x.tipo !== 'pago') return;
        (x.partes || []).forEach(function (pt) {
          if (String(pt.vid) === String(f.vid)) suyos.push({ fecha: x.fecha, monto: pt.monto });
        });
      });
      if (suyos.length) {
        t.push('   Pagos aplicados:');
        suyos.forEach(function (s) {
          t.push('     ' + s.fecha + '   $' + fmtNum(s.monto));
        });
      } else {
        t.push('   Sin pagos todavia.');
      }
      t.push(f.debe > 0.005 ? '   QUEDA: $' + fmtNum(f.debe) : '   PAGADA');
      t.push('');
    });
  }

  // ── CADA PAGO ENTERO, CON SU REPARTO ──
  var pagos = m.lista.filter(function (x) { return x.tipo === 'pago'; });
  if (pagos.length) {
    t.push('--------------------------------');
    t.push('SUS PAGOS');
    t.push('');
    pagos.forEach(function (p) {
      t.push('Pago del ' + p.fecha + '   $' + fmtNum(p.completo));
      if (p.partes.length > 1) {
        // 🔑 Lo que Sensei pidió: que se vea el pago entero Y cómo se repartió
        t.push('   Se aplico asi:');
        p.partes.forEach(function (pt) {
          t.push('     $' + fmtNum(pt.monto) + '  ->  Factura #' + pt.nf);
        });
        var sobra = Math.round((p.completo - p.suma) * 100) / 100;
        if (sobra > 0.005) t.push('     $' + fmtNum(sobra) + '  ->  quedo a su favor');
      } else if (p.partes.length === 1) {
        t.push('   A la factura #' + p.partes[0].nf);
      }
      t.push('');
    });
  }

  var dev = m.lista.filter(function (x) { return x.tipo === 'devolucion'; });
  if (dev.length) {
    t.push('--------------------------------');
    t.push('DEVOLUCIONES');
    dev.forEach(function (d) {
      t.push('   ' + d.fecha + '   $' + fmtNum(d.monto) + '   (factura #' + d.nf + ')');
    });
    t.push('');
  }

  t.push('--------------------------------');
  t.push('EN ESTAS FECHAS');
  t.push('   Le facture:  $' + fmtNum(m.facturado));
  t.push('   Me pago:     $' + fmtNum(m.pagado));
  if (m.devuelto > 0.005) t.push('   Devolvio:    $' + fmtNum(m.devuelto));
  t.push('');
  t.push(m.debeHoy > 0.005
    ? 'SU BALANCE HOY: $' + fmtNum(m.debeHoy)
    : 'SU CUENTA ESTA AL DIA');
  t.push('');
  t.push('Gracias por su confianza.');
  return t.join('\n');
}


// ═══════════════════════════════════════════════════════════════════
//  📊 LA PANTALLA DEL ESTADO POR FECHAS  (5 sep 2026)
//  Cada renglón se toca y se abre con todo el detalle.
// ═══════════════════════════════════════════════════════════════════
function abrirEstadoPorFechas(cid){
  clientes = LS('ncl', []);
  var c = clientes.find(function(x){ return String(x.id) === String(cid); });
  if(!c){ avisoGrande('No encontr\u00e9 ese cliente.'); return; }
  window._estadoFechasCid = cid;

  // Por defecto: los \u00faltimos 3 meses, que es lo que suele querer ver
  var hoy = new Date();
  var atras = new Date(hoy.getFullYear(), hoy.getMonth() - 3, hoy.getDate());
  var aISO = function(d){
    var mm = d.getMonth() + 1, dd = d.getDate();
    return d.getFullYear() + '-' + (mm < 10 ? '0' : '') + mm + '-' + (dd < 10 ? '0' : '') + dd;
  };
  window._efDesde = window._efDesde || aISO(atras);
  window._efHasta = window._efHasta || aISO(hoy);

  var ov = document.getElementById('estado-fechas-overlay');
  if(!ov){
    ov = document.createElement('div');
    ov.id = 'estado-fechas-overlay';
    document.body.appendChild(ov);
  }
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.62);z-index:100002;'
    + 'display:flex;align-items:flex-end;justify-content:center';
  ov.onclick = function(e){ if(e.target === ov) cerrarEstadoPorFechas(); };
  ov.style.display = 'flex';
  pintarEstadoPorFechas();
}

function cerrarEstadoPorFechas(){
  var ov = document.getElementById('estado-fechas-overlay');
  if(ov) ov.style.display = 'none';
}

// Los atajos de fechas, para no tener que escribirlas
function rangoRapidoEstado(cual){
  var hoy = new Date();
  var aISO = function(d){
    var mm = d.getMonth() + 1, dd = d.getDate();
    return d.getFullYear() + '-' + (mm < 10 ? '0' : '') + mm + '-' + (dd < 10 ? '0' : '') + dd;
  };
  if(cual === 'mes'){
    window._efDesde = aISO(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
    window._efHasta = aISO(hoy);
  } else if(cual === 'mespasado'){
    window._efDesde = aISO(new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1));
    window._efHasta = aISO(new Date(hoy.getFullYear(), hoy.getMonth(), 0));
  } else if(cual === 'ano'){
    window._efDesde = aISO(new Date(hoy.getFullYear(), 0, 1));
    window._efHasta = aISO(hoy);
  } else {   // todo
    window._efDesde = '2020-01-01';
    window._efHasta = aISO(hoy);
  }
  pintarEstadoPorFechas();
}

function cambiarFechaEstado(cual, valor){
  if(cual === 'desde') window._efDesde = valor;
  else window._efHasta = valor;
  pintarEstadoPorFechas();
}

// De AAAA-MM-DD a MM/DD/AAAA, que es como guarda las fechas la app
function _aFechaApp(iso){
  var p = String(iso || '').split('-');
  if(p.length !== 3) return '';
  return p[1] + '/' + p[2] + '/' + p[0];
}

function pintarEstadoPorFechas(){
  var ov = document.getElementById('estado-fechas-overlay');
  if(!ov) return;
  var cid = window._estadoFechasCid;
  clientes = LS('ncl', []);
  var c = clientes.find(function(x){ return String(x.id) === String(cid); });
  if(!c) return;

  var desde = _aFechaApp(window._efDesde), hasta = _aFechaApp(window._efHasta);
  var m = movimientoEntreFechas(cid, desde, hasta);

  var h = '<div style="background:#fff;width:100%;max-width:520px;border-radius:16px 16px 0 0;'
    + 'padding:14px;max-height:92vh;overflow:auto">'

    + '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">'
    +   '<div><div style="font-size:16px;font-weight:900;color:var(--nbs-ink)">'
    +     escaparHtml(nombreCl(c)) + '</div>'
    +     (c.negocio ? '<div style="font-size:12px;color:var(--nbs-muted)">' + escaparHtml(c.negocio) + '</div>' : '')
    +     '<div style="font-size:11.5px;font-weight:800;color:#1a237e;margin-top:2px">'
    +       '\ud83d\udcca ESTADO POR FECHAS</div></div>'
    +   '<button onclick="cerrarEstadoPorFechas()" style="background:#F0F0F2;border:none;'
    +     'border-radius:9px;width:34px;height:34px;font-size:16px;cursor:pointer">\u2715</button>'
    + '</div>'

    // Las fechas que él elige
    + '<div style="display:flex;gap:8px;margin-bottom:8px">'
    +   '<div style="flex:1"><div style="font-size:10.5px;font-weight:800;color:#555;margin-bottom:2px">DESDE</div>'
    +     '<input type="date" value="' + escaparHtml(window._efDesde) + '" '
    +     'onchange="cambiarFechaEstado(\'desde\', this.value)" '
    +     'style="width:100%;padding:8px;border:1px solid #ccc;border-radius:8px;font-size:12.5px"></div>'
    +   '<div style="flex:1"><div style="font-size:10.5px;font-weight:800;color:#555;margin-bottom:2px">HASTA</div>'
    +     '<input type="date" value="' + escaparHtml(window._efHasta) + '" '
    +     'onchange="cambiarFechaEstado(\'hasta\', this.value)" '
    +     'style="width:100%;padding:8px;border:1px solid #ccc;border-radius:8px;font-size:12.5px"></div>'
    + '</div>'

    + '<div style="display:flex;gap:5px;margin-bottom:11px">'
    +   ['mes|Este mes','mespasado|Mes pasado','ano|Este a\u00f1o','todo|Todo'].map(function(x){
          var p = x.split('|');
          return '<button onclick="rangoRapidoEstado(\'' + p[0] + '\')" '
            + 'style="flex:1;padding:7px 2px;background:#fff;color:#1a237e;border:1px solid #b9bfe0;'
            + 'border-radius:7px;font-size:10.5px;font-weight:700;cursor:pointer">' + p[1] + '</button>';
        }).join('')
    + '</div>';

  // Los tres números del rango
  h += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:12px">'
    + [['LE FACTUR\u00c9', m.facturado, '#1565C0', '#E3F2FD'],
       ['ME PAG\u00d3',    m.pagado,    '#2E7D32', '#E8F5E9'],
       ['DEBE HOY',     m.debeHoy,   m.debeHoy > 0.005 ? '#C62828' : '#2E7D32',
                                     m.debeHoy > 0.005 ? '#FFEBEE' : '#E8F5E9']]
      .map(function(x){
        return '<div style="background:' + x[3] + ';border-radius:10px;padding:9px;text-align:center">'
          + '<div style="font-size:9.5px;font-weight:800;color:' + x[2] + ';letter-spacing:.3px">' + x[0] + '</div>'
          + '<div style="font-size:16px;font-weight:900;color:' + x[2] + '">$' + fmtNum(x[1]) + '</div></div>';
      }).join('')
    + '</div>';

  // ── EL MOVIMIENTO, POR ORDEN DE FECHA Y TOCABLE ──
  h += '<div style="font-size:11px;font-weight:800;color:#555;letter-spacing:.4px;margin-bottom:6px">'
    +   'TODO SU MOVIMIENTO \u00b7 ' + m.lista.length + ' cosa(s)</div>';

  if(!m.lista.length){
    h += '<div style="background:#F4F6FB;border-radius:10px;padding:16px;text-align:center;'
      +  'font-size:12.5px;color:var(--nbs-muted)">No hay movimiento en esas fechas.</div>';
  } else {
    m.lista.forEach(function(x, i){
      var ico, col, tit, sub, mon;
      if(x.tipo === 'factura' || x.tipo === 'cancelada'){
        ico = '\ud83e\uddfe'; col = x.tipo === 'cancelada' ? '#999' : '#1565C0';
        tit = 'Factura #' + x.nf + (x.tipo === 'cancelada' ? ' \u00b7 CANCELADA' : '');
        sub = x.items + ' producto(s)' + (x.debe > 0.005 ? ' \u00b7 debe $' + fmtNum(x.debe) : ' \u00b7 pagada');
        mon = '$' + fmtNum(x.monto);
      } else if(x.tipo === 'pago'){
        ico = '\ud83d\udcb5'; col = '#2E7D32';
        tit = 'Pago' + (x.partes.length > 1 ? ' \u00b7 se reparti\u00f3 en ' + x.partes.length : '');
        sub = x.partes.map(function(pt){ return '#' + pt.nf; }).join(' \u00b7 ');
        mon = '$' + fmtNum(x.completo);
      } else {
        ico = '\u21a9\ufe0f'; col = '#E65100';
        tit = 'Devoluci\u00f3n'; sub = 'de la factura #' + x.nf;
        mon = '\u2212 $' + fmtNum(x.monto);
      }
      h += '<div onclick="verDetalleMovimiento(' + i + ')" '
        + 'style="display:flex;align-items:center;gap:9px;padding:10px;border:1px solid #E4E4EC;'
        + 'border-left:3px solid ' + col + ';border-radius:9px;margin-bottom:6px;cursor:pointer">'
        + '<div style="font-size:17px">' + ico + '</div>'
        + '<div style="flex:1;min-width:0">'
        +   '<div style="font-size:12.5px;font-weight:800;color:var(--nbs-ink)">' + escaparHtml(tit) + '</div>'
        +   '<div style="font-size:10.5px;color:var(--nbs-muted)">' + escaparHtml(x.fecha + ' \u00b7 ' + sub) + '</div>'
        + '</div>'
        + '<div style="font-size:13.5px;font-weight:900;color:' + col + '">' + mon + '</div>'
        + '<div style="color:#bbb;font-size:15px">\u203a</div>'
        + '</div>';
    });
  }

  // Los botones de mandárselo
  h += '<div style="display:flex;gap:8px;margin-top:12px">'
    + '<button onclick="mandarEstadoPorFechas()" style="flex:1;padding:13px 6px;background:#128C7E;'
    +   'color:#fff;border:none;border-radius:11px;font-size:12.5px;font-weight:800;cursor:pointer">'
    +   '\ud83d\udce4 Mand\u00e1rselo</button>'
    + '<button onclick="pdfEstadoPorFechas()" style="flex:1;padding:13px 6px;background:#1a237e;'
    +   'color:#fff;border:none;border-radius:11px;font-size:12.5px;font-weight:800;cursor:pointer">'
    +   '\ud83d\udcc4 Hacer PDF</button>'
    + '</div>'
    + '<button onclick="cerrarEstadoPorFechas()" style="width:100%;padding:12px;margin-top:7px;'
    +   'background:#F0F0F2;color:#333;border:none;border-radius:10px;font-size:13px;'
    +   'font-weight:700;cursor:pointer">Cerrar</button>'
    + '</div>';

  ov.innerHTML = h;
  window._efLista = m.lista;
}

// 👁️ El detalle de un renglón, al tocarlo.  (5 sep 2026)
function verDetalleMovimiento(i){
  var x = (window._efLista || [])[i];
  if(!x) return;

  if(x.tipo === 'factura' || x.tipo === 'cancelada'){
    // La factura completa, que ya sabe pintarla la app
    cerrarEstadoPorFechas();
    try { verFacturaProfesional(String(x.vid)); } catch(e){
      avisoGrande('No pude abrir esa factura.');
    }
    return;
  }

  if(x.tipo === 'pago'){
    // 🔑 EL PAGO ENTERO CON SU REPARTO, que es lo que Sensei pidió que se vea claro
    var t = ['\ud83d\udcb5 PAGO DEL ' + x.fecha, ''];
    t.push('Total del pago: $' + fmtNum(x.completo));
    if(x.metodo) t.push('Forma: ' + (METODOS_PAGO_LABELS[x.metodo] || x.metodo));
    if(x.recibo) t.push('Recibo: ' + x.recibo);
    t.push('');
    if(x.partes.length > 1){
      t.push('SE APLIC\u00d3 AS\u00cd:');
      x.partes.forEach(function(pt){
        t.push('  \u2022 $' + fmtNum(pt.monto) + '  \u2192  Factura #' + pt.nf
             + '  (de $' + fmtNum(pt.totalFactura) + ')');
      });
      var sobra = Math.round((x.completo - x.suma) * 100) / 100;
      if(sobra > 0.005){
        t.push('  \u2022 $' + fmtNum(sobra) + '  \u2192  qued\u00f3 a su favor');
      }
    } else if(x.partes.length === 1){
      t.push('Se aplic\u00f3 a la factura #' + x.partes[0].nf
           + ' (de $' + fmtNum(x.partes[0].totalFactura) + ')');
    }
    avisoGrande(t.join('\n'));
    return;
  }

  // Devolución
  avisoGrande('\u21a9\ufe0f DEVOLUCI\u00d3N DEL ' + x.fecha + '\n\n'
    + 'Monto: $' + fmtNum(x.monto) + '\n'
    + 'De la factura #' + x.nf + '\n\n'
    + 'Se le descont\u00f3 de lo que deb\u00eda.');
}

// 📤 Mandarle el estado por las cuatro formas de siempre
function mandarEstadoPorFechas(){
  var cid = window._estadoFechasCid;
  if(!cid) return;
  var texto = textoEstadoPorFechas(cid, _aFechaApp(window._efDesde), _aFechaApp(window._efHasta));
  cerrarEstadoPorFechas();
  mandarloAlCliente(cid, texto, 'Estado por fechas');
}

// 📄 El mismo estado, pero en PDF para imprimir o mandar como archivo
function pdfEstadoPorFechas(){
  var cid = window._estadoFechasCid;
  if(!cid) return;
  clientes = LS('ncl', []);
  var c = clientes.find(function(x){ return String(x.id) === String(cid); });
  var desde = _aFechaApp(window._efDesde), hasta = _aFechaApp(window._efHasta);
  var m = movimientoEntreFechas(cid, desde, hasta);

  var facturas = m.lista.filter(function(x){ return x.tipo === 'factura'; });
  var pagos = m.lista.filter(function(x){ return x.tipo === 'pago'; });

  var h = '<html><head><meta charset="utf-8"><title>Estado de cuenta</title><style>'
    + 'body{font-family:Arial,Helvetica,sans-serif;color:#222;margin:26px;font-size:13px}'
    + '.cab{text-align:center;border-bottom:3px solid #1a237e;padding-bottom:10px;margin-bottom:16px}'
    + '.cab h1{margin:0;font-size:20px;color:#1a237e;letter-spacing:1px}'
    + '.cab p{margin:3px 0;font-size:11px;color:#666}'
    + '.cli{background:#F4F6FB;border-radius:8px;padding:11px;margin-bottom:16px}'
    + '.cli b{font-size:15px;color:#1a237e}'
    + 'h2{font-size:13px;color:#1a237e;border-bottom:1px solid #ccc;padding-bottom:4px;margin:18px 0 9px}'
    + '.f{border:1px solid #ddd;border-radius:7px;padding:9px;margin-bottom:9px}'
    + '.f .t{font-weight:bold;font-size:13px}'
    + '.f .l{display:flex;justify-content:space-between;font-size:11.5px;color:#555;padding:1px 0}'
    + '.f .q{font-weight:bold;border-top:1px solid #eee;margin-top:5px;padding-top:4px}'
    + '.p{border-left:3px solid #2E7D32;background:#F6FBF7;padding:9px;margin-bottom:9px;border-radius:0 7px 7px 0}'
    + '.tot{background:#1a237e;color:#fff;border-radius:8px;padding:12px;margin-top:16px}'
    + '.tot .l{display:flex;justify-content:space-between;padding:2px 0;font-size:12.5px}'
    + '.tot .g{font-size:16px;font-weight:bold;border-top:1px solid rgba(255,255,255,.3);'
    +   'margin-top:6px;padding-top:6px}'
    + '</style></head><body>'

    + '<div class="cab"><h1>NUNEZ BEAUTY SUPPLY</h1>'
    + '<p>964 Atwells Ave, Providence, Rhode Island 02909 &nbsp;·&nbsp; 401-305-0188</p>'
    + '<p style="font-weight:bold;color:#1a237e;font-size:13px">ESTADO DE CUENTA</p></div>'

    + '<div class="cli"><b>' + escaparHtml(nombreCl(c)) + '</b><br>'
    + (c.negocio ? escaparHtml(c.negocio) + '<br>' : '')
    + '<span style="font-size:11px;color:#666">Del ' + escaparHtml(desde)
    + ' al ' + escaparHtml(hasta) + '</span></div>';

  h += '<h2>LO QUE COMPRO</h2>';
  if(!facturas.length){
    h += '<p style="color:#888;font-size:12px">No hay compras en esas fechas.</p>';
  } else {
    facturas.forEach(function(f){
      h += '<div class="f"><div class="t">Factura #' + escaparHtml(String(f.nf))
        + ' &nbsp;·&nbsp; ' + escaparHtml(f.fecha) + '</div>'
        + '<div class="l"><span>Total de la compra</span><b>$' + fmtNum(f.monto) + '</b></div>';
      var suyos = [];
      pagos.forEach(function(x){
        (x.partes || []).forEach(function(pt){
          if(String(pt.vid) === String(f.vid)) suyos.push({ fecha: x.fecha, monto: pt.monto });
        });
      });
      if(suyos.length){
        h += '<div style="font-size:10.5px;color:#2E7D32;font-weight:bold;margin-top:5px">PAGOS APLICADOS</div>';
        suyos.forEach(function(s){
          h += '<div class="l"><span>' + escaparHtml(s.fecha) + '</span><span>$' + fmtNum(s.monto) + '</span></div>';
        });
      }
      h += '<div class="l q"><span>' + (f.debe > 0.005 ? 'Queda' : 'PAGADA') + '</span>'
        + '<span style="color:' + (f.debe > 0.005 ? '#C62828' : '#2E7D32') + '">$'
        + fmtNum(f.debe) + '</span></div></div>';
    });
  }

  if(pagos.length){
    h += '<h2>SUS PAGOS</h2>';
    pagos.forEach(function(p){
      h += '<div class="p"><div class="t">Pago del ' + escaparHtml(p.fecha)
        + ' &nbsp;·&nbsp; <span style="color:#2E7D32">$' + fmtNum(p.completo) + '</span></div>';
      if(p.partes.length > 1){
        h += '<div style="font-size:10.5px;color:#666;margin-top:4px">SE APLICO ASI</div>';
        p.partes.forEach(function(pt){
          h += '<div class="l"><span>Factura #' + escaparHtml(String(pt.nf)) + '</span>'
            + '<span>$' + fmtNum(pt.monto) + '</span></div>';
        });
        var sobra = Math.round((p.completo - p.suma) * 100) / 100;
        if(sobra > 0.005){
          h += '<div class="l"><span>Quedo a su favor</span><span>$' + fmtNum(sobra) + '</span></div>';
        }
      } else if(p.partes.length === 1){
        h += '<div class="l"><span>A la factura #' + escaparHtml(String(p.partes[0].nf)) + '</span>'
          + '<span>$' + fmtNum(p.partes[0].monto) + '</span></div>';
      }
      h += '</div>';
    });
  }

  h += '<div class="tot">'
    + '<div class="l"><span>Le facture en estas fechas</span><span>$' + fmtNum(m.facturado) + '</span></div>'
    + '<div class="l"><span>Me pago</span><span>$' + fmtNum(m.pagado) + '</span></div>'
    + (m.devuelto > 0.005 ? '<div class="l"><span>Devolvio</span><span>$' + fmtNum(m.devuelto) + '</span></div>' : '')
    + '<div class="l g"><span>' + (m.debeHoy > 0.005 ? 'SU BALANCE HOY' : 'SU CUENTA ESTA AL DIA')
    + '</span><span>$' + fmtNum(m.debeHoy) + '</span></div></div>'
    + '<p style="text-align:center;font-size:10.5px;color:#888;margin-top:18px">'
    + 'Gracias por su confianza</p></body></html>';

  try {
    var w = window.open('', '_blank');
    if(!w){ avisoGrande('El telefono bloqueo la ventana. Permite las ventanas emergentes y vuelve a intentar.'); return; }
    w.document.write(h);
    w.document.close();
    setTimeout(function(){ try { w.print(); } catch(e){} }, 400);
  } catch(e){
    avisoGrande('No pude abrir el PDF: ' + e.message);
  }
}

function comoMandarloAlCliente(cid, texto, queEs){
  clientes = LS('ncl', []);
  var c = clientes.find(function(x){ return String(x.id) === String(cid); });
  var tel = _telDelCliente(cid);
  window._textoParaMandar = String(texto || '');
  window._cidParaMandar = cid;

  var ov = document.getElementById('como-mandar-overlay');
  if(!ov){
    ov = document.createElement('div');
    ov.id = 'como-mandar-overlay';
    document.body.appendChild(ov);
  }
  // \ud83d\udd34 EL NIVEL SUBE A 100001 -4 sep-. Estaba en 99999, EMPATADO con el estado de
  // cuenta: al abrirlo desde ahi salia DETRAS y Sensei no veia nada. "Cuando toco
  // enviar mensaje no funcionan ninguna de las dos opciones".
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.62);z-index:100001;'
    + 'display:flex;align-items:flex-end;justify-content:center';
  ov.onclick = function(e){ if(e.target === ov) cerrarComoMandar(); };

  var telBonito = tel ? fmtTelTexto(tel) : '';

  var h = '<div style="background:#fff;width:100%;max-width:520px;border-radius:16px 16px 0 0;'
    + 'padding:14px;max-height:88vh;overflow:auto">'

    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px">'
    +   '<div style="font-size:15px;font-weight:900;color:#1a237e">\ud83d\udce4 \u00bfC\u00f3mo se lo mandas?</div>'
    +   '<button onclick="cerrarComoMandar()" style="background:#F0F0F2;border:none;border-radius:8px;'
    +     'width:32px;height:32px;font-size:15px;cursor:pointer">\u2715</button>'
    + '</div>'
    + '<div style="font-size:12.5px;font-weight:800;color:var(--nbs-ink)">' + escaparHtml(c ? nombreCl(c) : '') + '</div>'
    + (telBonito ? '<div style="font-size:11.5px;color:var(--nbs-muted);margin-bottom:9px">' + escaparHtml(telBonito) + '</div>'
                 : '<div style="font-size:11.5px;color:#C62828;margin-bottom:9px">\u26a0\ufe0f Sin tel\u00e9fono guardado</div>')

    // El mensaje, para que lo lea antes de mandarlo
    + '<div style="background:#F4F6FB;border:1px solid #d8dcee;border-radius:10px;padding:10px;'
    +   'margin-bottom:12px;font-size:12px;color:#333;white-space:pre-wrap;max-height:150px;overflow:auto">'
    +   escaparHtml(window._textoParaMandar) + '</div>';

  // 💬 y 💌 grandes, lado a lado, un toque cada uno
  h += '<div style="display:flex;gap:8px;margin-bottom:8px">'
    +   '<button onclick="enviarPorWhatsAppACliente(' + _arg(cid) + ', window._textoParaMandar)" '
    +     'style="flex:1;padding:15px 8px;background:#128C7E;color:#fff;border:none;border-radius:11px;'
    +     'font-size:13.5px;font-weight:800;cursor:pointer">\ud83d\udcac WhatsApp</button>'
    +   '<button onclick="enviarPorSMSACliente(' + _arg(cid) + ', window._textoParaMandar)" '
    +     'style="flex:1;padding:15px 8px;background:#1565C0;color:#fff;border:none;border-radius:11px;'
    +     'font-size:13.5px;font-weight:800;cursor:pointer">\ud83d\udc8c Texto</button>'
    + '</div>';

  // 📋 y 📤 debajo, más chicos
  h += '<div style="display:flex;gap:8px">'
    +   '<button onclick="copiarMensajeDelCliente(window._textoParaMandar)" '
    +     'style="flex:1;padding:11px;background:#fff;color:#444;border:1.5px solid #ccc;border-radius:10px;'
    +     'font-size:12.5px;font-weight:700;cursor:pointer">\ud83d\udccb Copiar</button>'
    +   '<button onclick="compartirMensajeDelCliente(' + _arg(cid) + ', window._textoParaMandar)" '
    +     'style="flex:1;padding:11px;background:#fff;color:#444;border:1.5px solid #ccc;border-radius:10px;'
    +     'font-size:12.5px;font-weight:700;cursor:pointer">\ud83d\udce4 Compartir</button>'
    + '</div>';

  h += '<div style="font-size:10.5px;color:var(--nbs-muted);text-align:center;margin-top:9px">'
    +   'El mensaje se copia solo antes de mandarlo, por si algo falla.</div>'
    + '<button onclick="cerrarComoMandar()" style="width:100%;padding:12px;margin-top:10px;'
    +   'background:#F0F0F2;color:#333;border:none;border-radius:10px;font-size:13px;'
    +   'font-weight:700;cursor:pointer">Cancelar</button>'
    + '</div>';

  ov.innerHTML = h;
  ov.style.display = 'flex';
}

function mandarloAlCliente(cid, texto, queEs){
  // \ud83d\udce4 Desde el 3 de sep esto OFRECE LAS CUATRO FORMAS -WhatsApp, Texto, Copiar y
  // Compartir- en vez de irse derecho a WhatsApp. Sensei: "hay clientes que no tienen
  // WhatsApp y tengo que enviarselo por mensaje regular".
  // Asi todos los botones que ya existian pasan por el mismo sitio.
  try { comoMandarloAlCliente(cid, texto, queEs); return; } catch(e){}

  // Si eso fallara, se sigue por el camino viejo — nunca se queda sin mandar.
  clientes = LS('ncl', []);
  var c = clientes.find(function(x){ return String(x.id) === String(cid); });
  var tel = c ? String(c.tel || '').replace(/[^0-9]/g, '') : '';
  if(tel){
    // \ud83d\udd34 ANTES aqui se armaba el wa.me a mano y por eso se abria el WhatsApp normal
    // -o la pagina de la web-. La app YA tenia resuelto esto desde el 11 de agosto con
    // _linkWhatsApp, que en Android abre el WhatsApp BUSINESS directo. Sensei lo vio:
    // "yo tengo whatsapp business, y antes cuando tocaba enviar mensaje se abria directo".
    // Tenia razon: el codigo nuevo no estaba usando lo que ya existia. -30 ago-
    var enlace = _linkWhatsApp(tel, texto);

    // \ud83d\udee1\ufe0f LA RED. Dos motivos para usarla:
    //   1. Los enlaces muy largos algunos Android los cortan.
    //   2. Y hay telefonos -el de Sensei entre ellos- que rechazan el enlace en cuanto
    //      lleva el mensaje dentro, y caen a la pagina web de WhatsApp. -30 ago-
    // En los dos casos se hace lo mismo, que es lo que a el SI le funciona: se COPIA el
    // texto entero y se abre el chat vacio para que lo pegue.
    // Si el escogio copiar y pegar siempre, o el enlace es muy largo
    if(LS('nbs_wa_pegar', '0') === '1' || enlace.length > 6000){
      try {
        if(navigator.clipboard && navigator.clipboard.writeText){
          navigator.clipboard.writeText(texto);
          alert('\ud83d\udccb El mensaje es largo, as\u00ed que lo COPI\u00c9 completo.\n\n'
            + 'Se va a abrir el chat de ' + (c && c.nombre ? c.nombre : 'tu cliente') + '.\n'
            + 'Ah\u00ed solo mant\u00e9n el dedo en la casilla y dale PEGAR.');
          window.location.href = _linkWhatsApp(tel);   // el chat, sin texto
          return;
        }
      } catch(e){}
    }

    try {
      window.location.href = enlace;
      return;
    } catch(e){}
  }
  // Sin teléfono: se copia para que lo pegue donde quiera
  try {
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(texto);
      alert('📋 ' + queEs + ' copiado.\n\nEste cliente no tiene teléfono guardado, así que lo copié '
        + 'para que lo pegues donde quieras.');
      return;
    }
  } catch(e){}
  avisoGrande(texto);
}

// ── El aviso que sale después de una venta o de un cobro ──
// Se le enseña el mensaje ya armado y él decide si lo manda.
function ofrecerMensajeAlCliente(cid, tipo, monto, detalleFacturas){
  try {
    if(!cid) return;
    clientes = LS('ncl', []);
    var c = clientes.find(function(x){ return String(x.id) === String(cid); });
    if(!c) return;
    if(LS('nbs_avisar_cliente', '1') !== '1') return;   // se puede apagar
    var texto = textoParaCliente(cid, tipo, monto, detalleFacturas);
    if(!texto) return;
    // El corto se arma ANTES de pintar, porque el HTML de abajo ya lo usa. -29 ago-
    window._textoCortoCliente = (tipo === 'pago') ? textoCortoParaCliente(cid, monto) : '';
    // Y lo que le queda debiendo, para saber si ofrecer la firma. -30 ago-
    window._debeTrasElPago = 0;
    try { window._debeTrasElPago = balanceDelCliente(cid); } catch(e){}

    var ov = document.getElementById('avisar-cliente-overlay');
    if(!ov){
      ov = document.createElement('div');
      ov.id = 'avisar-cliente-overlay';
      document.body.appendChild(ov);
    }
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:99999;'
      + 'display:flex;align-items:center;justify-content:center;padding:16px';
    ov.innerHTML = '<div style="background:#fff;border-radius:14px;padding:15px;max-width:420px;width:100%;max-height:88vh;overflow:auto">'
      + '<div style="font-size:15px;font-weight:900;color:#128C7E;margin-bottom:3px">💬 Mándale el comprobante</div>'
      + '<div style="font-size:11.5px;color:#888;margin-bottom:11px">Así queda constancia del balance para los dos.</div>'
      + '<div style="background:#E7F6EF;border-radius:10px;padding:11px;font-size:12px;color:#222;'
      +   'white-space:pre-wrap;line-height:1.5;max-height:38vh;overflow:auto;margin-bottom:12px">'
      +   escaparHtml(texto) + '</div>'
      + '<div style="display:flex;gap:8px;margin-bottom:8px">'
      +   '<button onclick="mandarloAlCliente(' + _arg(cid) + ', window._textoAvisoCliente, \'Comprobante\');cerrarAvisoCliente()" '
      +     'style="flex:1;padding:13px;background:#128C7E;color:#fff;border:none;border-radius:10px;'
      +     'font-size:13.5px;font-weight:800;cursor:pointer">\ud83d\udcac Mandar el completo</button>'
      + '</div>'
      // \u270f\ufe0f EL CORTO: dos lineas y ya. Para el barbero que solo quiere saber en que
      // quedo. Sensei: "que el mensaje diga SOLO ESO, aparte de lo que ya hiciste". -29 ago-
      + (tipo === 'pago' && window._textoCortoCliente
          ? '<div style="background:#F2F2F6;border-radius:9px;padding:9px 11px;margin-bottom:9px">'
            + '<div style="font-size:10.5px;font-weight:800;color:#888;letter-spacing:.4px;margin-bottom:4px">O MANDA SOLO ESTO</div>'
            + '<div style="font-size:12.5px;color:#222;margin-bottom:8px">' + escaparHtml(window._textoCortoCliente) + '</div>'
            + '<button onclick="mandarloAlCliente(' + _arg(cid) + ', window._textoCortoCliente, \'Mensaje corto\');cerrarAvisoCliente()" '
            +   'style="width:100%;padding:11px;background:#546E7A;color:#fff;border:none;border-radius:9px;'
            +   'font-size:12.5px;font-weight:800;cursor:pointer">\u270f\ufe0f Mandar solo el corto</button>'
            + '</div>'
          : '')
      // \u270d\ufe0f LA FIRMA: SEGUNDA OPCION Y OPCIONAL. Va aqui, ANTES del "Ahora no", y
      // sale chiquita con su rotulo. No todos los clientes la necesitan. -Sensei, 30 ago-
      + (tipo === 'pago' && window._debeTrasElPago > 0.005 && seOfreceFirma()
          ? '<div style="border-top:1px solid #EEE;margin:2px 0 9px;padding-top:9px">'
            + '<div style="font-size:10.5px;color:#999;text-align:center;margin-bottom:6px">'
            +   'OPCIONAL \u00b7 solo si lo crees necesario con este cliente</div>'
            + '<button onclick="cerrarAvisoCliente();abrirConfirmacionBalance(' + _arg(cid) + ', ' + monto + ')" '
            +   'style="width:100%;padding:11px;background:#fff;color:#1a237e;'
            +   'border:1.5px solid #b9bfe0;border-radius:10px;font-size:12.5px;font-weight:800;cursor:pointer">'
            +   '\u270d\ufe0f Que firme su balance de $' + fmtNum(window._debeTrasElPago) + '</button>'
            + '</div>'
          : '')
      + '<div style="display:flex;gap:8px">'
      +   '<button onclick="cerrarAvisoCliente()" style="flex:1;padding:12px;background:#F0F0F2;color:#333;'
      +     'border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer">Ahora no</button>'
      + '</div>'
      + '<div onclick="apagarAvisoCliente()" style="text-align:center;font-size:11px;color:#999;'
      +   'margin-top:9px;cursor:pointer;text-decoration:underline">No volver a ofrecerlo</div>'
      + '</div>';
    window._textoAvisoCliente = texto;
  } catch(e){ console.error('No se pudo armar el mensaje al cliente:', e); }
}

function cerrarAvisoCliente(){
  var ov = document.getElementById('avisar-cliente-overlay');
  if(ov) ov.style.display = 'none';
}

// \ud83d\udee1\ufe0f Si el telefono no acepta el mensaje dentro del enlace -a Sensei le pasa con
// los cortos-, con esto SIEMPRE se copia el texto y se abre el chat vacio. Un paso mas,
// pero funciona seguro. -30 ago-
function apagarAvisoCliente(){
  if(!confirm('¿Dejar de ofrecer el comprobante después de cada venta y cobro?\n\n'
    + 'Lo puedes volver a prender en Ajustes.')) return;
  SS('nbs_avisar_cliente', '0');
  cerrarAvisoCliente();
  alert('Listo. Ya no se ofrece solo.\n\nSiempre puedes mandarlo desde el estado de cuenta del cliente.');
}

function eliminarDuplicadosClientes(){
  clientes = LS('ncl', []);
  var grupos = agruparPosiblesDuplicados(clientes);
  var conDuplicados = Object.keys(grupos).filter(function(k){ return grupos[k].length > 1; });
  if(!conDuplicados.length){
    alert('✅ No se encontraron clientes duplicados.');
    return;
  }
  // Mostrar resumen y pedir confirmación antes de cualquier acción
  var resumen = 'Se encontraron '+conDuplicados.length+' nombre(s) duplicado(s):\n\n';
  conDuplicados.forEach(function(k){
    var g = grupos[k];
    resumen += '• '+nombreClConNegocio(g[0])+' ('+g.length+' copias';
    var vips = g.filter(function(c){ return c.vipActivo; }).length;
    if(vips) resumen += ', '+vips+' con VIP activo';
    resumen += ')\n';
  });
  resumen += '\n¿Limpiar duplicados? Se conservará el que tenga VIP activo, o el primero si ninguno lo tiene. Las ventas de los duplicados se reasignarán al original.';
  if(!confirm(resumen)) return;

  var unicos = [];
  var eliminados = 0;
  ventas = LS('nv', []);

  Object.keys(grupos).forEach(function(k){
    var g = grupos[k];
    if(g.length === 1){ unicos.push(g[0]); return; }
    // Elegir el que tenga vipActivo, o el primero
    var principal = g.find(function(c){ return c.vipActivo; }) || g[0];
    // Fusionar VIP de todos
    var tieneVIP = g.some(function(c){ return c.vipActivo; });
    principal.vipActivo = tieneVIP;
    unicos.push(principal);
    // Reasignar ventas
    g.forEach(function(dup){
      if(String(dup.id) === String(principal.id)) return;
      ventas.forEach(function(v){
        if(String(v.cid)===String(dup.id)){
          v.cid = principal.id;
          v.cn = nombreCl(principal);
        }
      });
      eliminados++;
    });
  });

  clientes = unicos;
  SS('ncl', clientes);
  SS('nv', ventas);
  alert('✅ Listo. '+eliminados+' duplicado(s) eliminado(s).\nEl estado VIP fue preservado en todos los casos.');
  renderCl('');
}

function buscarClienteEspecifico(nombre){
  clientes = LS('ncl', []);
  ventas = LS('nv', []);
  var nombreQ = nombre.toLowerCase();
  var msg = '=== BÚSQUEDA: "'+nombre+'" ===\n\n';

  // Buscar en clientes
  var enClientes = clientes.filter(function(c){
    return (c.nombre+' '+c.apellido).toLowerCase().indexOf(nombreQ) >= 0;
  });
  msg += '📋 En lista de Clientes: '+enClientes.length+' coincidencia(s)\n';
  enClientes.forEach(function(c){
    msg += '  - '+nombreCl(c)+' (id:'+c.id+')\n';
  });

  // Buscar en ventas (por nombre guardado cn)
  var enVentas = ventas.filter(function(v){
    return (v.cn||'').toLowerCase().indexOf(nombreQ) >= 0 && !v.cancelada;
  });
  msg += '\n💳 En Ventas (cn): '+enVentas.length+' factura(s)\n';
  enVentas.forEach(function(v){
    var cl = clientes.find(function(c){ return String(c.id)===String(v.cid); });
    msg += '  - '+v.fecha+' $'+v.total+' cid:'+v.cid+' (cliente existe: '+(cl?'SÍ':'NO')+')\n';
  });

  alert(msg);
}

function pintarDetalleClientes(d0, d1, dentro){
  var el = document.getElementById('res-detalle');
  if(!el) return;
  clientes = LS('ncl', []);
  var porCli = {};

  ventas.forEach(function(v){
    if(v.cancelada) return;
    var cid = String(v.cid || 'general');
    if(!porCli[cid]) porCli[cid] = { pago:0, cogio:0, bce:0 };

    // COGIO: lo que se llevo en mercancia en el rango
    if(dentro(v.fecha)) porCli[cid].cogio += (v.total || 0);

    // PAGO: contado del rango + abonos pagados en el rango
    if(v.tipo === 'contado'){
      if(dentro(v.fecha)) porCli[cid].pago += cobradoYDebeDe(v).cobrado;
    } else {
      (v.pagosFactura || []).forEach(function(p){
        if(typeof p.monto !== 'number' || p.monto <= 0 || p.esDevolucion) return;
        if(dentro(p.fecha || v.fecha)) porCli[cid].pago += p.monto;
      });
    }
  });

  // BALANCE: lo que debe hoy en total (de todas sus facturas, no solo del rango)
  ventas.forEach(function(v){
    if(v.cancelada || v.tipo !== 'credito') return;
    var cid = String(v.cid || 'general');
    if(!porCli[cid]) return;
    var pag = (v.pagosFactura || []).reduce(function(s,p){
      return s + ((typeof p.monto === 'number' && !p.esDevolucion) ? p.monto : 0); }, 0);
    porCli[cid].bce += Math.max(0, (v.total || 0) - pag);
  });

  var filas = [];
  Object.keys(porCli).forEach(function(cid){
    var x = porCli[cid];
    if(x.pago < 0.005 && x.cogio < 0.005) return;   // solo los que se movieron hoy
    var c = clientes.filter(function(y){ return String(y.id) === cid; })[0];
    filas.push({
      nombre: c ? ((c.nombre||'')+' '+(c.apellido||'')).trim() : 'Cliente general',
      apodo: c ? (c.apodo || '') : '',
      negocio: c ? (c.negocio || '') : '',
      pago: x.pago, cogio: x.cogio, bce: x.bce
    });
  });
  filas.sort(function(a,b){ return b.pago - a.pago; });

  if(!filas.length){
    el.innerHTML = '<div style="text-align:center;color:#999;font-size:14px;padding:14px">Sin movimientos en estas fechas</div>';
    return;
  }

  el.innerHTML = filas.map(function(f){
    return '<div style="background:#fff;border:1px solid #e5e7eb;border-radius:11px;padding:10px 12px;margin-bottom:7px">'
      + '<div style="font-size:15.5px;font-weight:800;color:#1a237e;line-height:1.2">'+escaparHtml(f.nombre.toUpperCase())
      +   (f.apodo ? ' <span style="color:#A63D2F;font-weight:700">('+escaparHtml(f.apodo)+')</span>' : '')
      + '</div>'
      + (f.negocio ? '<div style="font-size:11.5px;color:#8a8f9e;margin-bottom:5px">'+escaparHtml(f.negocio)+'</div>' : '<div style="margin-bottom:5px"></div>')
      + '<div style="display:flex;gap:6px">'
      +   '<div style="flex:1;background:#E8F5E9;border-radius:7px;padding:5px 7px;text-align:center">'
      +     '<div style="font-size:9.5px;color:#2E7D32;font-weight:800">PAG\u00d3</div>'
      +     '<div style="font-size:14px;font-weight:900;color:#2E7D32">$'+fmtNum(f.pago)+'</div></div>'
      +   '<div style="flex:1;background:#E3F2FD;border-radius:7px;padding:5px 7px;text-align:center">'
      +     '<div style="font-size:9.5px;color:#1565C0;font-weight:800">COMPR\u00d3</div>'
      +     '<div style="font-size:14px;font-weight:900;color:#1565C0">$'+fmtNum(f.cogio)+'</div></div>'
      +   '<div style="flex:1;background:'+(f.bce>0.005?'#FFEBEE':'#F1F3F8')+';border-radius:7px;padding:5px 7px;text-align:center">'
      +     '<div style="font-size:9.5px;color:'+(f.bce>0.005?'#C62828':'#8a8f9e')+';font-weight:800">BCE.</div>'
      +     '<div style="font-size:14px;font-weight:900;color:'+(f.bce>0.005?'#C62828':'#8a8f9e')+'">$'+fmtNum(f.bce)+'</div></div>'
      + '</div></div>';
  }).join('');
}

function graficoTopClientes(ventasPeriodo){
  var porCliente = {};
  ventasPeriodo.forEach(function(v){
    var cid = String(v.cid);
    porCliente[cid] = (porCliente[cid]||0) + (v.total||0);
  });
  var lista = Object.keys(porCliente).map(function(cid){
    var c = (clientes||[]).find(function(x){ return String(x.id)===cid; });
    return { nombre: c ? (nombreCl(c)||c.negocio||'Cliente') : 'Cliente', total: porCliente[cid] };
  }).sort(function(a,b){ return b.total-a.total; }).slice(0, 5);

  if(!lista.length){
    return '<div style="background:white;border:1px solid #eee;border-radius:12px;padding:14px;margin-bottom:12px;text-align:center">'
      +'<div style="font-size:12px;font-weight:700;color:#1a237e;margin-bottom:6px">🏆 TOP CLIENTES</div>'
      +'<div style="font-size:12px;color:#aaa;padding:10px">Sin ventas en este período</div></div>';
  }
  var maxV = lista[0].total || 1;
  var filas = lista.map(function(c, idx){
    var ancho = Math.round((c.total/maxV)*100);
    return '<div style="margin-bottom:8px">'
      +'<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:2px">'
      +'<span style="color:#333;font-weight:600">'+(idx+1)+'. '+escaparHtml(c.nombre)+'</span>'
      +'<span style="color:#1a237e;font-weight:700">$'+fmtNum(c.total)+'</span></div>'
      +'<div style="height:8px;background:#eee;border-radius:4px;overflow:hidden">'
      +'<div style="height:100%;width:'+ancho+'%;background:'+(idx===0?'#D4A017':'#1a237e')+';border-radius:4px"></div></div></div>';
  }).join('');
  return '<div style="background:white;border:1px solid #eee;border-radius:12px;padding:14px;margin-bottom:12px">'
    +'<div style="font-size:12px;font-weight:700;color:#1a237e;text-align:center;margin-bottom:10px">🏆 TOP 5 CLIENTES QUE MÁS COMPRAN</div>'
    +filas+'</div>';
}

// ── Exportar el panorama a PDF (usa la ventana de impresión que ya existe) ──
// ═══════════════════════════════════════════════════════════════════════════
//  IMPRIMIR / COMPARTIR REPORTES  (pedido por Sensei, 19 jul 2026)
//  Función común que cualquier reporte usa para imprimirse y compartirse,
//  igual que el Panorama: abre el reporte visual para imprimir/guardar PDF,
//  y si hay resumen en texto, lo comparte por el menú del teléfono.
// ═══════════════════════════════════════════════════════════════════════════
// Menu de opciones para un reporte de pantalla (CxC, Inventario, etc.): deja ELEGIR
// entre Imprimir o Compartir, en vez de hacer las dos cosas a la vez (que abria
// PrinterShare de una y ademas compartia solo un letrerito). Pedido por Sensei.
function verHistorialCliente(cid, modo){
  modo = modo || 'abiertas';
  ventas = LS('nv',[]);
  clientes = LS('ncl',[]);
  var cl = clientes.find(function(c){ return String(c.id)===String(cid); });
  if(!cl) return;
  var todasVentasCl = ventas.filter(function(v){ return String(v.cid)===String(cid) && !v.cancelada; });
  todasVentasCl.sort(function(a,b){ return parsearFechaVenta(b.fecha)-parsearFechaVenta(a.fecha); });

  // Calcular saldo de cada venta a credito
  todasVentasCl.forEach(function(v){
    var pagado = (v.tipo==='credito' && v.pagosFactura) ? (v.pagosFactura || []).filter(function(p){return typeof p.monto==='number';}).reduce(function(s,p){return s+p.monto;},0) : v.total;
    v._pagado = pagado;
    var _cdH = cobradoYDebeDe(v);
    v._pagado = _cdH.cobrado;
    v._saldo  = _cdH.debe;
  });

  var ventasCl = modo==='abiertas' ? todasVentasCl.filter(function(v){ return v.tipo==='credito' && esSaldoPendiente(v._saldo); }) : todasVentasCl;

  var totalGastado = todasVentasCl.reduce(function(s,v){ return s+v.total; },0);
  var frecuencia = todasVentasCl.length;

  // Productos favoritos (siempre sobre el historial completo, no solo abiertas)
  var prodCount = {};
  todasVentasCl.forEach(function(v){
    (v.items||[]).forEach(function(it){
      if(!prodCount[it.nombre]) prodCount[it.nombre] = 0;
      prodCount[it.nombre] += it.cant;
    });
  });
  var topProds = Object.keys(prodCount).sort(function(a,b){ return prodCount[b]-prodCount[a]; }).slice(0,3);

  var overlay = document.getElementById('historial-overlay');
  if(!overlay){
    overlay = document.createElement('div');
    overlay.id = 'historial-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:white;z-index:99999;overflow-y:auto;padding:16px';
    document.body.appendChild(overlay);
  }

  var abiertasCount = todasVentasCl.filter(function(v){ return v.tipo==='credito' && esSaldoPendiente(v._saldo); }).length;
  var totalPagado = todasVentasCl.reduce(function(s,v){ return s+(v._pagado||0); }, 0);
  var gananciaTotal = todasVentasCl.reduce(function(s,v){ return s+(v.ganancia||0); }, 0);

  overlay.innerHTML = '<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">'
    +'<button onclick="cerrarHistorial()" style="background:#E8EAF6;border:none;border-radius:8px;padding:10px 16px;cursor:pointer;font-size:14px;font-weight:600;color:#1a237e">← Volver</button>'
    +'<img src="icon-512.png" alt="NBS" style="width:32px;height:32px;margin-left:auto;border-radius:8px;cursor:pointer" onclick="cerrarHistorial();ir(\'p-ped\')">'
    +'</div>'
    +'<div style="background:linear-gradient(135deg,#1a237e,#283593);color:white;border-radius:12px;padding:16px;margin-bottom:16px">'
    +'<div style="font-size:18px;font-weight:800">'+escaparHtml(nombreCl(cl))+'</div>'
    +'<div style="font-size:13px;opacity:0.8;margin-top:4px">🏪 '+(cl.negocio||'Sin barbería')+'</div>'
    +'</div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">'
    +'<button onclick="verHistorialCliente(\''+cid+'\',\'abiertas\')" style="padding:12px;background:'+(modo==='abiertas'?'var(--nbs-gold)':'#F0F0F2')+';color:'+(modo==='abiertas'?'white':'var(--nbs-ink)')+';border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer">📂 Facturas abiertas ('+abiertasCount+')</button>'
    +'<button onclick="verHistorialCliente(\''+cid+'\',\'completo\')" style="padding:12px;background:'+(modo==='completo'?'var(--nbs-gold)':'#F0F0F2')+';color:'+(modo==='completo'?'white':'var(--nbs-ink)')+';border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer">📋 Historial completo ('+todasVentasCl.length+')</button>'
    +'</div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">'
    +'<div style="background:#E3F2FD;border-radius:10px;padding:12px;border:0.5px solid #BBDEFB;text-align:center">'
    +'<div style="font-size:10px;color:#1565C0;font-weight:700">TOTAL PAGADO</div>'
    +'<div style="font-size:18px;font-weight:800;color:#1565C0">$'+fmtNum(totalPagado)+'</div>'
    +'</div>'
    +'<div style="background:#E8F5E9;border-radius:10px;padding:12px;border:0.5px solid #C8E6C9;text-align:center">'
    +'<div style="font-size:10px;color:#2E7D32;font-weight:700">GANANCIA QUE TE HA DEJADO</div>'
    +'<div style="font-size:18px;font-weight:800;color:#2E7D32">$'+fmtNum(gananciaTotal)+'</div>'
    +'</div>'
    +'</div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:16px">'
    +'<div style="background:white;border-radius:10px;padding:12px;border:0.5px solid #e5e7eb;text-align:center">'
    +'<div style="font-size:10px;color:#aaa;font-weight:600">TOTAL COMPRADO</div>'
    +'<div style="font-size:18px;font-weight:800;color:#1565C0">$'+fmtNum(totalGastado)+'</div>'
    +'</div>'
    +'<div style="background:white;border-radius:10px;padding:12px;border:0.5px solid #e5e7eb;text-align:center">'
    +'<div style="font-size:10px;color:#aaa;font-weight:600">COMPRAS</div>'
    +'<div style="font-size:18px;font-weight:800;color:#1a237e">'+frecuencia+'</div>'
    +'</div>'
    +'<div style="background:white;border-radius:10px;padding:12px;border:0.5px solid #e5e7eb;text-align:center">'
    +'<div style="font-size:10px;color:#aaa;font-weight:600">PROMEDIO</div>'
    +'<div style="font-size:18px;font-weight:800;color:#2E7D32">$'+fmtNum(frecuencia>0?totalGastado/frecuencia:0)+'</div>'
    +'</div>'
    +'</div>'
    +'</div>'
    +(function(){
      // ===== Seccion Programa VIP =====
      if(!cl.vipActivo) return '';
      var vip = calcVIP(cid);
      var keys = Object.keys(vip);
      if(!keys.length) return '<div style="background:#FCE4EC;border-radius:12px;padding:12px;margin-bottom:16px">'
        +'<div style="font-size:12px;color:#AD1457;font-weight:700;margin-bottom:4px">⭐ PROGRAMA VIP</div>'
        +'<div style="font-size:12px;color:#777">Inscrito, sin compras VIP registradas todavía.</div></div>';
      return '<div style="background:#FCE4EC;border-radius:12px;padding:12px;margin-bottom:16px">'
        +'<div style="font-size:12px;color:#AD1457;font-weight:700;margin-bottom:8px">⭐ PROGRAMA VIP</div>'
        +keys.map(function(k){
          var v = vip[k];
          var pct = Math.min(100, Math.round((v.puntos/10)*100));
          return '<div style="margin-bottom:6px">'
            +'<div style="display:flex;justify-content:space-between;font-size:12px;color:#333;margin-bottom:3px"><span>'+v.nombre+'</span><span style="font-weight:700">'+v.puntos+'/10</span></div>'
            +'<div style="height:6px;background:white;border-radius:3px;overflow:hidden"><div style="height:100%;width:'+pct+'%;background:#AD1457"></div></div>'
            +'</div>';
        }).join('')
        +'</div>';
    })()
    +(function(){
      // ===== Seccion Visitas (para clientes tipo Tienda con recordatorio de visita) =====
      if(!cl.tipoNegocio || cl.tipoNegocio==='Barberia') return '';
      var intervalo = cl.intervaloVisitaDias;
      var ultima = cl.ultimaVisitaNegocio;
      var infoVisita = '';
      if(ultima){
        var fUlt = parsearFechaVenta(ultima);
        var dias = Math.floor((new Date() - fUlt) / (1000*60*60*24));
        infoVisita = 'Última visita: '+ultima+' ('+dias+' día(s) atrás)';
        if(intervalo){
          var proxima = new Date(fUlt); proxima.setDate(proxima.getDate()+intervalo);
          infoVisita += '<br>Próxima visita: '+proxima.toLocaleDateString('en-US')+(proxima<=new Date()?' <span style="color:#C62828;font-weight:700">— ¡ya toca!</span>':'');
        }
      } else {
        infoVisita = 'Todavía no se ha registrado ninguna visita a este negocio.';
      }
      return '<div style="background:#E3F2FD;border-radius:12px;padding:12px;margin-bottom:16px">'
        +'<div style="font-size:12px;color:#1565C0;font-weight:700;margin-bottom:6px">🗺️ VISITAS AL NEGOCIO</div>'
        +'<div style="font-size:12px;color:#333;line-height:1.6">'+infoVisita+(intervalo?'<br>Recordatorio configurado: cada '+intervalo+' días':'')+'</div>'
        +'</div>';
    })()
    +(topProds.length?'<div style="background:#FFF8E1;border-radius:12px;padding:12px;margin-bottom:16px">'
    +'<div style="font-size:12px;color:#E65100;font-weight:700;margin-bottom:8px">⭐ PRODUCTOS FAVORITOS</div>'
    +topProds.map(function(p){ return '<div style="font-size:13px;color:#333;padding:4px 0">• '+p+' ('+prodCount[p]+' unidades)</div>'; }).join('')
    +'</div>':'')
    +(cl.creditoAFavor && cl.creditoAFavor > 0.005 ? '<div style="background:#FFF3E0;border-radius:12px;padding:12px;margin-bottom:16px;border:1px solid #FFCC80">'
      +'<div style="font-size:12px;color:#E65100;font-weight:700;margin-bottom:4px">💳 CRÉDITO A FAVOR DE ESTE CLIENTE</div>'
      +'<div style="font-size:22px;font-weight:800;color:#E65100">($'+fmtNum(cl.creditoAFavor)+')</div>'
      +'<div style="font-size:11px;color:#777;margin-top:2px">Se aplicará automáticamente a su próxima compra a crédito.</div></div>' : '')
    +(function(){
      // ===== Seccion Devoluciones =====
      var devoluciones = LS('ndevoluciones', []).filter(function(d){ return String(d.cid)===String(cid); });
      if(!devoluciones.length) return '';
      devoluciones.sort(function(a,b){ return parsearFechaVenta(b.fecha)-parsearFechaVenta(a.fecha); });
      var totalDev = devoluciones.reduce(function(s,d){ return s+d.monto; },0);
      return '<div style="background:#FFF3E0;border-radius:12px;padding:12px;margin-bottom:16px">'
        +'<div style="font-size:12px;color:#E65100;font-weight:700;margin-bottom:8px">↩️ DEVOLUCIONES ('+devoluciones.length+' · $'+fmtNum(totalDev)+' en total)</div>'
        +devoluciones.map(function(d){
          var itemsTxt = (d.items || []).map(function(it){ return it.nombre+' x'+it.cant; }).join(', ');
          return '<div style="background:white;border-radius:8px;padding:8px 10px;margin-bottom:6px">'
            +'<div style="display:flex;justify-content:space-between"><span style="font-size:12px;font-weight:700">'+d.fecha+'</span><span style="font-size:12px;font-weight:700;color:#E65100">$'+fmtNum(d.monto)+'</span></div>'
            +'<div style="font-size:11px;color:#777;margin-top:2px">'+itemsTxt+(d.nota?' \u00b7 '+d.nota:'')+'</div>'
            +(d.motivoTexto?'<div style="font-size:11px;font-weight:800;color:#C62828;margin-top:2px">'+escaparHtml(d.motivoTexto)+'</div>':'')
            +(d.foto?'<img src="'+d.foto+'" onclick="event.stopPropagation();verFotoGasto(this.src)" style="margin-top:5px;width:56px;height:56px;object-fit:cover;border-radius:8px;cursor:pointer;border:1px solid #ddd">':'')
            +(d.numFacturaOrigen?'<div style="font-size:10px;color:#aaa;margin-top:2px">De la factura #'+d.numFacturaOrigen+'</div>':'')
            +'<button type="button" onclick="deshacerDevolucion('+d.id+')" style="margin-top:6px;width:100%;padding:6px;background:#FFEBEE;color:#C62828;border:none;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer">🗑️ Deshacer esta devolución -por error o duplicada-</button>'
            +'</div>';
        }).join('')
        +'</div>';
    })()
    +'<div style="font-size:13px;font-weight:700;color:#1a237e;margin-bottom:8px">'+(modo==='abiertas'?'Facturas con saldo pendiente':'Historial completo de compras y pagos')+'</div>'
    +(!ventasCl.length ? '<p style="color:#aaa;text-align:center;padding:20px;font-size:13px">'+(modo==='abiertas'?'No hay facturas abiertas — todo está al día.':'Sin compras registradas.')+'</p>' : '')
    +ventasCl.map(function(v){
      var pagosHtml = '';
      if(modo==='completo' && v.tipo==='credito' && v.pagosFactura && (v.pagosFactura || []).length){
        pagosHtml = '<div style="margin-top:6px;padding-top:6px;border-top:0.5px dashed #ddd">'
          +(v.pagosFactura || []).map(function(p, pidx){
            if(!(p.monto > 0)) return '';
            var detalle = (p.metodos && p.metodos.length) ? p.metodos.map(function(m){ return METODOS_PAGO_LABELS[m.tipo]+' $'+fmtNum(m.monto); }).join(' + ') : '';
            var lapizPago = '<button onclick="editarPagoDesdeHistorial(\''+cid+'\','+v.id+','+pidx+')" title="Editar este pago" style="background:#E8EAF6;border:none;border-radius:7px;padding:4px 9px;font-size:14px;cursor:pointer;margin-left:auto;flex:0 0 auto">✏️</button>';
            if(p.esDevolucion) return '<div style="font-size:12.5px;color:#E65100;padding:4px 0;display:flex;align-items:center;gap:4px">↩️ '+p.fecha+' — Devolución $'+fmtNum(p.monto)+(p.nota?' ('+p.nota.replace('↩️ Devolución: ','')+')':'')+lapizPago+'</div>';
            return '<div style="font-size:12.5px;color:#2E7D32;padding:4px 0;display:flex;align-items:center;gap:4px">✓ '+p.fecha+' — Pagó $'+fmtNum(p.monto)+(detalle?' ('+detalle+')':'')+lapizPago+'</div>';
          }).join('')
          +'</div>';
      }
      return '<div style="background:white;border-radius:10px;padding:12px;margin-bottom:6px;border:0.5px solid #e5e7eb;border-left:3px solid '+(v.tipo==='credito'&&esSaldoPendiente(v._saldo)?'#C62828':'#2E7D32')+'">'
        +'<div style="display:flex;justify-content:space-between">'
        +'<span style="font-size:13px;font-weight:700;color:#1a237e">'+v.fecha+' <span style="font-size:10px;color:#aaa;font-weight:400">('+(v.tipo==='credito'?'crédito':'contado')+')</span></span>'
        +'<span style="font-size:14px;font-weight:800;color:#1565C0">$'+fmtNum(v.total)+'</span>'
        +'</div>'
        +'<div style="font-size:11px;color:#aaa;margin-top:4px">'+(v.items || []).map(function(it){ return it.nombre+' x'+it.cant; }).join(', ')+'</div>'
        +(v.tipo==='credito' ? '<div style="font-size:11px;font-weight:700;margin-top:4px;color:'+(esSaldoPendiente(v._saldo)?'#C62828':'#2E7D32')+'">'+(esSaldoPendiente(v._saldo)?'Saldo pendiente: $'+fmtNum(v._saldo):'✓ Pagada completa')+'</div>' : '')
        +pagosHtml
        +'</div>';
    }).join('');
  overlay.style.display = 'block'; overlay.scrollTop = 0;
}
