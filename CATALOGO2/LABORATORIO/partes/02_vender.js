
function vigilarPedidos(nuevos){
  try {
    if(!Array.isArray(nuevos)) return;
    var crudo = localStorage.getItem('npedidos');
    var antes = crudo ? (JSON.parse(crudo) || []) : [];
    if(!Array.isArray(antes)) return;
    if(antes.length === nuevos.length) return;

    var quien = _quienLlamo();
    var hora = new Date().toLocaleString('en-US', { hour12: true });

    var bit = [];
    try { bit = JSON.parse(localStorage.getItem(CLAVE_BITACORA_PEDIDOS) || '[]'); } catch(e){}
    bit.push({ hora: hora, antes: antes.length, despues: nuevos.length, quien: quien });
    if(bit.length > 30) bit = bit.slice(-30);
    try { localStorage.setItem(CLAVE_BITACORA_PEDIDOS, JSON.stringify(bit)); } catch(e){}

    var perdidos = antes.length - nuevos.length;
    if(perdidos >= 2){
      var idsNuevos = {};
      nuevos.forEach(function(p){ idsNuevos[String(p.id)] = 1; });
      var quitados = antes.filter(function(p){ return !idsNuevos[String(p.id)]; });
      if(quitados.length >= 2){
        try {
          localStorage.setItem(CLAVE_RESCATE_PEDIDOS, JSON.stringify({
            hora: hora, quien: quien, pedidos: quitados
          }));
        } catch(e){}
      }
    }
  } catch(e){ /* la red nunca puede romper el guardado */ }
}

function hayPedidosRescatables(){
  try {
    var r = JSON.parse(localStorage.getItem(CLAVE_RESCATE_PEDIDOS) || 'null');
    if(r && r.pedidos && r.pedidos.length) return r;
  } catch(e){}
  return null;
}

function devolverPedidosRescatados(){
  var r = hayPedidosRescatables();
  if(!r) return;
  var P = LS('npedidos', []);
  var hay = {};
  P.forEach(function(p){ hay[String(p.id)] = 1; });
  var devueltos = 0;
  r.pedidos.forEach(function(p){ if(!hay[String(p.id)]){ P.push(p); devueltos++; } });
  if(devueltos){ SS('npedidos', P); pedidos = LS('npedidos', []); }
  localStorage.removeItem(CLAVE_RESCATE_PEDIDOS);
  try { renderPedidosPendientes(); } catch(e){}
  try { renderPedidos(); } catch(e){}
  avisoGrande(devueltos
    ? '\u2705 Se devolvieron ' + devueltos + ' pedido(s) a la lista.'
    : 'Esos pedidos ya estaban en la lista.');
}

function descartarPedidosRescatables(){
  if(!confirm('\u00bfBorrar el aviso? Los pedidos quitados no se van a poder devolver.')) return;
  localStorage.removeItem(CLAVE_RESCATE_PEDIDOS);
  try { renderPedidosPendientes(); } catch(e){}
  try { renderPedidos(); } catch(e){}
}

function avisoRescatePedidos(){
  var r = hayPedidosRescatables();
  if(!r) return '';
  return '<div style="background:#FFF3E0;border:2px solid #E65100;border-radius:12px;padding:12px;margin-bottom:10px">'
    + '<div style="font-size:13px;font-weight:900;color:#E65100;margin-bottom:4px">\u26a0\ufe0f SE QUITARON '
    +   r.pedidos.length + ' PEDIDO(S) DE LA LISTA</div>'
    + '<div style="font-size:12.5px;color:#6D4C00;line-height:1.5;margin-bottom:8px">'
    +   escaparHtml(r.hora) + '<br>'
    +   r.pedidos.slice(0,4).map(function(p){
          return '\u00b7 ' + escaparHtml(String(p.nombre || '').slice(0,26))
               + ' (' + ((p.items||[]).length) + ' productos)';
        }).join('<br>')
    +   (r.pedidos.length > 4 ? '<br>y ' + (r.pedidos.length-4) + ' m\u00e1s' : '')
    + '</div>'
    + '<div style="display:flex;gap:6px">'
    +   '<button onclick="devolverPedidosRescatados()" style="flex:1;padding:10px;background:#2E7D32;color:#fff;border:none;border-radius:9px;font-size:12.5px;font-weight:800;cursor:pointer">\u21a9\ufe0f Devu\u00e9lvemelos</button>'
    +   '<button onclick="descartarPedidosRescatables()" style="flex:1;padding:10px;background:#ECEFF1;color:#546E7A;border:none;border-radius:9px;font-size:12.5px;font-weight:700;cursor:pointer">Fui yo, borra el aviso</button>'
    + '</div></div>';
}


function parsearFechaVenta(fechaStr){
  if(!fechaStr) return new Date(0);
  try {
    var partes = fechaStr.split('/');
    if(partes.length !== 3) return new Date(fechaStr);
    var p0 = parseInt(partes[0]);
    var p1 = parseInt(partes[1]);
    var p2 = parseInt(partes[2]);
    var resultado;
    // Si primer número > 12, es DD/MM/YYYY (formato viejo Samsung en español)
    if(p0 > 12){
      resultado = new Date(p2, p1-1, p0);
    } else {
      // En todos los demás casos, asumir MM/DD/YYYY (formato USA que usamos)
      resultado = new Date(p2, p0-1, p1);
    }
    // Salvaguarda: una fecha de venta casi nunca deberia caer mas de 2 dias en el futuro.
    // Si la interpretacion cae en el futuro y la lectura contraria (dia/mes invertidos) es valida y no lo hace, usar esa.
    var manana = new Date(); manana.setDate(manana.getDate()+2);
    if(resultado > manana && p1 <= 12 && p0 <= 31){
      var alterna = (p0 > 12) ? new Date(p2, p0-1, p1) : new Date(p2, p1-1, p0);
      if(alterna <= manana) resultado = alterna;
    }
    return resultado;
  } catch(e){ return new Date(0); }
}

function verificarFidelidadDespuesDeVenta(cid){
  if(!cid) return;
  clientes = LS('ncl', []);
  var c = clientes.find(function(x){ return String(x.id)===String(cid); });
  if(!c) return;
  ventas = LS('nv', []);
  var ventasActivas = ventas.filter(function(v){ return String(v.cid)===String(cid) && !v.cancelada; });
  if(!clienteCuentaVIP(c)) return;      // consignacion: no avisa ni acumula
  var fidelidad = calcularFidelidad(c, ventasActivas);
  if(fidelidad.total >= fidelidad.meta && !c.fidelidadNotificado){
    c.fidelidadNotificado = true;
    SS('ncl', clientes);
    setTimeout(function(){ mostrarPopupFidelidad(cid, fidelidad); }, 600);
  }
}

function nombreVentaCliente(v){
  if(!v) return '';
  var cl = clientes.find(function(x){ return String(x.id)===String(v.cid); });
  return cl ? nombreCl(cl) : (v.cn||'Cliente general');
}

// Nombre + negocio/barbería, para pantallas donde el negocio no se muestra ya por separado
function nombreVentaClienteConNegocio(v){
  if(!v) return '';
  var cl = clientes.find(function(x){ return String(x.id)===String(v.cid); });
  return cl ? nombreClConNegocio(cl) : (v.cn||'Cliente general');
}

function abrirVentanaImpresion(titulo, contenidoHtml){
  var estilos = '<style>'
    +'@page { size: letter; margin: 12mm; }'
    +'* { box-sizing: border-box; }'
    +'body { font-family: -apple-system, Arial, sans-serif; color:#222; margin:0 auto; padding:16px; width:100%; }'
    +'@media print { body { max-width:8.5in; } }'
    +'h1 { font-size:20px; color:#1a237e; margin:0 0 4px; }'
    +'.sub { font-size:13px; color:#666; margin:0 0 16px; }'
    // Rejilla de 2 columnas para las fichas (aprovecha el ancho de la hoja)
    // La rejilla se adapta sola: si hay espacio pone 2+ columnas, si la pantalla
    // es angosta (vista previa del teléfono) pone 1 columna y se ve bien igual.
    +'.fichas-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:10px; }'
    // Al IMPRIMIR, forzar 2 columnas fijas (la hoja carta siempre tiene el ancho para eso)
    +'@media print { .fichas-grid { grid-template-columns:1fr 1fr; } }'
    +'.ficha { border:1px solid #bbb; border-radius:8px; padding:10px 12px; page-break-inside:avoid; break-inside:avoid; }'
    +'.ficha .nom { font-size:15px; font-weight:bold; color:#1a237e; margin-bottom:4px; }'
    +'.ficha .fila { font-size:12px; color:#333; margin:2px 0; }'
    +'.ficha .et { color:#888; display:inline-block; min-width:70px; }'
    +'.deuda { font-weight:bold; color:#C62828; }'
    +'.aldia { font-weight:bold; color:#2E7D32; }'
    +'.vip { display:inline-block; background:#FFF3E0; color:#E65100; font-size:10px; font-weight:bold; padding:1px 6px; border-radius:8px; }'
    +'table { width:100%; border-collapse:collapse; font-size:13px; }'
    +'th { background:#1a237e; color:white; text-align:left; padding:7px 9px; font-size:12px; }'
    +'td { border-bottom:1px solid #ddd; padding:7px 9px; }'
    +'tr:nth-child(even) td { background:#f6f6fa; }'
    +'.total-row td { font-weight:bold; background:#eee; }'
    +'@media print { .noprint { display:none; } body { padding:0; } }'
    +'.noprint { text-align:center; margin:16px 0; }'
    +'.noprint button { background:#1a237e; color:white; border:none; border-radius:8px; padding:12px 24px; font-size:15px; font-weight:bold; cursor:pointer; }'
    +'</style>';
  var htmlCompleto = '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
    +'<title>'+titulo+'</title>'+estilos+'</head><body>'
    +'<div class="noprint"><button onclick="window.print()">🖨️ Imprimir / Guardar PDF</button></div>'
    +contenidoHtml
    +'<div class="noprint"><button onclick="window.print()">🖨️ Imprimir / Guardar PDF</button></div>'
    +'</body></html>';
  var win = window.open('', '_blank');
  if(!win){ alert('Tu navegador bloqueó la ventana. Permite las ventanas emergentes para imprimir.'); return; }
  win.document.write(htmlCompleto);
  win.document.close();
}

// LISTADO 1: fichas completas de cada cliente
function calcularResumenInventario(){
  loadProds();
  var totalInvertido = 0, totalVenta = 0, totalUnidades = 0, productosConStock = 0;
  productos.forEach(function(p){
    if(p.stock > 0){
      totalInvertido += p.stock * (p.costo||0);
      totalVenta += p.stock * (p.precio||0);
      totalUnidades += p.stock;
      productosConStock++;
    }
  });
  var gananciaPotencial = totalVenta - totalInvertido;

  ventas = LS('nv', []);
  var ahora = new Date();
  var mesActual = ahora.getMonth(), anioActual = ahora.getFullYear();
  var cogsDelMes = 0;
  var ultimaVentaPorProducto = {};
  var unidadesVendidas30d = {};
  var hace30dias = new Date(ahora.getTime() - 30*24*60*60*1000);
  ventas.forEach(function(v){
    if(v.cancelada) return;
    var partesFecha = (v.fecha||'').split('/');
    if(partesFecha.length !== 3) return;
    var fechaVenta = new Date(parseInt(partesFecha[2]), parseInt(partesFecha[0])-1, parseInt(partesFecha[1]));
    var esDeEsteMes = fechaVenta.getMonth()===mesActual && fechaVenta.getFullYear()===anioActual;
    (v.items||[]).forEach(function(it){
      if(esDeEsteMes) cogsDelMes += (it.cant||0) * (it.costo||0);
      if(it.pid){
        var keyPid = String(it.pid);
        if(!ultimaVentaPorProducto[keyPid] || fechaVenta > ultimaVentaPorProducto[keyPid]) ultimaVentaPorProducto[keyPid] = fechaVenta;
        if(fechaVenta >= hace30dias) unidadesVendidas30d[keyPid] = (unidadesVendidas30d[keyPid]||0) + (it.cant||0);
      }
    });
  });
  var rotacion = totalInvertido > 0 ? (cogsDelMes / totalInvertido) : 0;

  var UMBRAL_DORMIDO_DIAS = 45;
  var productosDormidos = productos.filter(function(p){
    if(!p.stock || p.stock <= 0) return false;
    var ultimaVenta = ultimaVentaPorProducto[String(p.id)];
    if(!ultimaVenta) return true;
    var diasSinVenderse = Math.floor((ahora - ultimaVenta) / (1000*60*60*24));
    return diasSinVenderse >= UMBRAL_DORMIDO_DIAS;
  });

  return {
    totalInvertido: totalInvertido, totalVenta: totalVenta, gananciaPotencial: gananciaPotencial,
    totalUnidades: totalUnidades, productosConStock: productosConStock,
    cogsDelMes: cogsDelMes, rotacion: rotacion, productosDormidos: productosDormidos,
    unidadesVendidas30d: unidadesVendidas30d, UMBRAL_DORMIDO_DIAS: UMBRAL_DORMIDO_DIAS
  };
}

// Tarjeta chiquita de Inventario para el Resumen Financiero -con enlace directo al modulo
// completo-, aportada desde una revision hecha en paralelo y ahora integrada aqui, reutilizando
// el mismo calculo ya probado en el modulo completo de Inventario.
function renderResumenInventarioDashboard(){
  var r = calcularResumenInventario();
  return '<div onclick="irMenuProtegido(\'p-inventario\')" style="background:white;border-radius:12px;padding:14px;margin-bottom:16px;border:0.5px solid var(--nbs-line);box-shadow:var(--nbs-shadow-card);cursor:pointer">'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:'+(r.productosDormidos.length>0?'10px':'0')+'">'
    +'<div><div style="font-size:10px;color:var(--nbs-muted);font-weight:600">VALOR INVENTARIO</div><div style="font-size:16px;font-weight:700;color:var(--nbs-ink)">$'+fmtNum(r.totalInvertido)+'</div></div>'
    +'<div><div style="font-size:10px;color:var(--nbs-muted);font-weight:600">GANANCIA POTENCIAL</div><div style="font-size:16px;font-weight:700;color:var(--nbs-green-text)">$'+fmtNum(r.gananciaPotencial)+'</div></div>'
    +'<div><div style="font-size:10px;color:var(--nbs-muted);font-weight:600">ROTACIÓN -MES-</div><div style="font-size:14px;font-weight:700;color:var(--nbs-ink)">'+r.rotacion.toFixed(2)+'x</div></div>'
    +'<div><div style="font-size:10px;color:var(--nbs-muted);font-weight:600">COSTO VENDIDO -MES-</div><div style="font-size:14px;font-weight:700;color:var(--nbs-ink)">$'+fmtNum(r.cogsDelMes)+'</div></div>'
    +'</div>'
    +(r.productosDormidos.length>0 ? '<div style="font-size:11px;color:#E65100;font-weight:600;border-top:0.5px solid var(--nbs-line);padding-top:8px">💤 '+r.productosDormidos.length+' producto(s) dormidos -sin venderse hace 45+ días-</div>' : '')
    +'<div style="font-size:11px;color:var(--nbs-gold-dark);font-weight:600;margin-top:6px">Ver inventario completo →</div>'
    +'</div>';
}

function cambiarOrdenInventario(modo){
  window._ordenInventario = modo;
  ['az','vendido','dormido'].forEach(function(m){
    var btn = document.getElementById('inv-orden-'+m);
    if(btn) btn.style.background = (m===modo) ? 'var(--nbs-gold)' : '#eee';
    if(btn) btn.style.color = (m===modo) ? 'white' : 'var(--nbs-ink)';
  });
  renderInventario(document.getElementById('invbuscar').value);
}

function renderInventario(q){
  loadProds();
  q = (q||'').toLowerCase();
  var marcaFiltro = document.getElementById('inv-filtro-marca') ? document.getElementById('inv-filtro-marca').value : '';
  var catFiltro = document.getElementById('inv-filtro-cat') ? document.getElementById('inv-filtro-cat').value : '';

  var r = calcularResumenInventario();
  var totalInvertido = r.totalInvertido, totalVenta = r.totalVenta, gananciaPotencial = r.gananciaPotencial;
  var totalUnidades = r.totalUnidades, productosConStock = r.productosConStock;
  var cogsDelMes = r.cogsDelMes, rotacion = r.rotacion, productosDormidos = r.productosDormidos;
  var unidadesVendidas30d = r.unidadesVendidas30d, UMBRAL_DORMIDO_DIAS = r.UMBRAL_DORMIDO_DIAS;
  var ahora = new Date();

  var resumenEl = document.getElementById('inv-resumen');
  resumenEl.innerHTML =
    '<div style="background:white;border-radius:12px;padding:14px;border:0.5px solid var(--nbs-line);box-shadow:var(--nbs-shadow-card)">'
    +'<div style="font-size:11px;color:var(--nbs-muted);font-weight:600;margin-bottom:6px">TOTAL INVERTIDO</div>'
    +'<div style="font-size:19px;font-weight:700;color:var(--nbs-ink)">$'+fmtNum(totalInvertido)+'</div>'
    +'<div style="font-size:10px;color:var(--nbs-muted);margin-top:2px">Lo que te costó tu mercancía</div></div>'
    +'<div style="background:white;border-radius:12px;padding:14px;border:0.5px solid var(--nbs-line);box-shadow:var(--nbs-shadow-card)">'
    +'<div style="font-size:11px;color:var(--nbs-muted);font-weight:600;margin-bottom:6px">VALOR DE VENTA</div>'
    +'<div style="font-size:19px;font-weight:700;color:var(--nbs-ink)">$'+fmtNum(totalVenta)+'</div>'
    +'<div style="font-size:10px;color:var(--nbs-muted);margin-top:2px">Si vendieras todo al precio de lista</div></div>'
    +'<div style="background:var(--nbs-green-bg);border-radius:12px;padding:14px">'
    +'<div style="font-size:11px;color:var(--nbs-green-text);font-weight:600;margin-bottom:6px">GANANCIA POTENCIAL</div>'
    +'<div style="font-size:19px;font-weight:700;color:var(--nbs-green-text)">$'+fmtNum(gananciaPotencial)+'</div>'
    +'<div style="font-size:10px;color:var(--nbs-green-text);margin-top:2px">Si se vende todo lo que tienes</div></div>'
    +'<div style="background:white;border-radius:12px;padding:14px;border:0.5px solid var(--nbs-line);box-shadow:var(--nbs-shadow-card)">'
    +'<div style="font-size:11px;color:var(--nbs-muted);font-weight:600;margin-bottom:6px">UNIDADES / PRODUCTOS</div>'
    +'<div style="font-size:19px;font-weight:700;color:var(--nbs-ink)">'+totalUnidades+'</div>'
    +'<div style="font-size:10px;color:var(--nbs-muted);margin-top:2px">en '+productosConStock+' producto(s) distinto(s)</div></div>'
    +'<div style="background:white;border-radius:12px;padding:14px;border:0.5px solid var(--nbs-line);box-shadow:var(--nbs-shadow-card)">'
    +'<div style="font-size:11px;color:var(--nbs-muted);font-weight:600;margin-bottom:6px">COGS DEL MES</div>'
    +'<div style="font-size:19px;font-weight:700;color:var(--nbs-ink)">$'+fmtNum(cogsDelMes)+'</div>'
    +'<div style="font-size:10px;color:var(--nbs-muted);margin-top:2px">Costo de lo que vendiste este mes</div></div>'
    +'<div style="background:white;border-radius:12px;padding:14px;border:0.5px solid var(--nbs-line);box-shadow:var(--nbs-shadow-card)">'
    +'<div style="font-size:11px;color:var(--nbs-muted);font-weight:600;margin-bottom:6px">ROTACIÓN</div>'
    +'<div style="font-size:19px;font-weight:700;color:var(--nbs-ink)">'+rotacion.toFixed(2)+'x</div>'
    +'<div style="font-size:10px;color:var(--nbs-muted);margin-top:2px">Qué tan rápido se mueve tu dinero</div></div>';

  var alertaDormidoEl = document.getElementById('inv-alerta-dormido');
  if(alertaDormidoEl){
    if(productosDormidos.length > 0){
      alertaDormidoEl.style.display = 'block';
      alertaDormidoEl.innerHTML = '💤 <b>'+productosDormidos.length+' producto(s) dormido(s)</b> -sin venderse en '+UMBRAL_DORMIDO_DIAS+' días o más-. Toca "💤 Dormidos" abajo para verlos.';
    } else {
      alertaDormidoEl.style.display = 'none';
    }
  }
  window._productosDormidosIds = productosDormidos.map(function(p){ return String(p.id); });

  // Llenar los filtros de marca/categoria solo la primera vez -si ya tienen opciones, no se vuelven a construir-
  var selMarca = document.getElementById('inv-filtro-marca');
  if(selMarca.options.length <= 1){
    var marcas = Array.from(new Set(productos.map(function(p){ return p.marca||''; }).filter(Boolean))).sort();
    marcas.forEach(function(m){ var o=document.createElement('option'); o.value=m; o.textContent=m; selMarca.appendChild(o); });
  }
  var selCat = document.getElementById('inv-filtro-cat');
  if(selCat.options.length <= 1){
    var cats = Array.from(new Set(productos.map(function(p){ return p.cat||''; }).filter(Boolean))).sort();
    cats.forEach(function(c){ var o=document.createElement('option'); o.value=c; o.textContent=c; selCat.appendChild(o); });
  }

  var modoOrden = window._ordenInventario || 'az';
  // La TABLA respeta la busqueda y los filtros, y se ordena segun el boton elegido -A-Z,
  // mas vendido en los ultimos 30 dias, o solo los productos dormidos-.
  var lista = productos.filter(function(p){
    if(q && puntajeBusqueda(p.nombre, q) < 0) return false;
    if(marcaFiltro && p.marca !== marcaFiltro) return false;
    if(catFiltro && p.cat !== catFiltro) return false;
    if(modoOrden === 'dormido' && (window._productosDormidosIds||[]).indexOf(String(p.id)) < 0) return false;
    return true;
  });
  if(modoOrden === 'vendido'){
    lista.sort(function(a,b){ return (unidadesVendidas30d[String(b.id)]||0) - (unidadesVendidas30d[String(a.id)]||0); });
  } else {
    lista.sort(function(a,b){ return a.nombre.localeCompare(b.nombre); });
  }

  var listaEl = document.getElementById('invlista');
  if(!lista.length){
    listaEl.innerHTML = '<div style="text-align:center;color:var(--nbs-muted);padding:20px;font-size:13px">'+(modoOrden==='dormido'?'Ningún producto dormido -todo se está vendiendo bien-. 🎉':'No se encontró ningún producto.')+'</div>';
    return;
  }
  listaEl.innerHTML = lista.map(function(p){
    var costoTotal = (p.stock||0) * (p.costo||0);
    var valorTotal = (p.stock||0) * (p.precio||0);
    var margen = p.precio > 0 ? ((p.precio - (p.costo||0)) / p.precio * 100) : 0;
    var sinStock = !p.stock || p.stock <= 0;
    var ventasRecientes = unidadesVendidas30d[String(p.id)] || 0;
    return '<div class="card" style="'+(sinStock?'opacity:0.55':'')+'">'
      +'<div style="font-size:14px;font-weight:700;color:var(--nbs-ink)">'+escaparHtml(p.nombre)+'</div>'
      +'<div style="font-size:11px;color:var(--nbs-muted);margin-bottom:8px">'+(p.marca||'')+(p.cat?' · '+p.cat:'')+' · Stock: '+(p.stock||0)+(modoOrden==='vendido'?' · Vendidos -30 días-: '+ventasRecientes:'')+'</div>'
      +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px">'
      +'<div>Costo c/u: <b>$'+fmtNum(p.costo||0)+'</b></div>'
      +'<div>Precio venta: <b>$'+fmtNum(p.precio||0)+'</b></div>'
      +'<div>Costo total: <b>$'+fmtNum(costoTotal)+'</b></div>'
      +'<div>Valor total: <b style="color:var(--nbs-green-text)">$'+fmtNum(valorTotal)+'</b></div>'
      +'</div>'
      +'<div style="margin-top:6px;font-size:11px;color:'+(margen>=30?'var(--nbs-green-text)':'var(--nbs-gold-dark)')+';font-weight:700">Margen: '+margen.toFixed(1)+'%</div>'
      +'</div>';
  }).join('');
}

// ═══════════════════════════════════════════════════════════════════
//  🚨 EL PRECIO DE VENTA EN CERO  (19 ago 2026)
//
//  🔴 LO QUE CAZO SENSEI: entro la factura de Kanar Online, la app creo los
//  productos nuevos que venian en ella, y quedaron con precio de venta $0.00.
//  Al ir a venderlos el precio salia en cero: se los estaba REGALANDO sin darse
//  cuenta. Sus palabras: "si no me fijo de repente se lo estoy regalando".
//
//  LA CAUSA: al guardar la compra se hace `precio: it.precioVenta || 0`. Si el
//  producto vino de un PDF escaneado, nadie le habia puesto precio de venta.
// ═══════════════════════════════════════════════════════════════════

// Todos los productos que no tienen precio de venta.
function faltanPreciosDeVenta(alTerminar){
  var faltan = [];
  iCC.forEach(function(it, i){
    if(it.esNuevo && !(parseFloat(it.precioVenta) > 0.005)) faltan.push(i);
  });
  if(!faltan.length) return false;

  window._alTerminarPrecios = alTerminar;
  var ov = document.getElementById('precios-nuevos-overlay');
  if(!ov){
    ov = document.createElement('div');
    ov.id = 'precios-nuevos-overlay';
    document.body.appendChild(ov);
  }
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:99999;display:flex;'
    + 'align-items:flex-end;justify-content:center';
  var h = '<div style="background:#fff;width:100%;max-width:520px;border-radius:16px 16px 0 0;padding:14px;max-height:92vh;overflow:auto">'
    + '<div style="font-size:15px;font-weight:900;color:#C62828;margin-bottom:4px">⚠️ Pónles precio de venta</div>'
    + '<div style="font-size:12px;color:#777;margin-bottom:10px">Estos productos son nuevos y todavía no tienen precio. '
    + 'Si los guardas en cero, al venderlos saldrían <b>gratis</b>.</div>';
  faltan.forEach(function(i){
    var it = iCC[i];
    var sug = precioSugerido(it.costo);
    h += '<div style="background:#FFF8E1;border-radius:9px;padding:9px;margin-bottom:7px">'
      + '<div style="font-size:12.5px;font-weight:800;color:#5D4037;margin-bottom:5px">' + String(it.nombre || '').replace(/[<>&"]/g,'') + '</div>'
      + '<div style="display:flex;gap:6px;align-items:center">'
      + '<span style="font-size:11.5px;color:#777;flex-shrink:0">Costo $' + fmtNum(it.costo) + '</span>'
      + '<input type="text" inputmode="decimal" id="precionuevo-' + i + '" value="' + (sug ? sug.toFixed(2) : '') + '"'
      + ' placeholder="0.00" onfocus="this.select();this.dataset.modoPreciso=\'\'"'
      + ' oninput="formatoCostoPreciso(this, event)" onblur="finalizarCostoPreciso(this)"'
      + ' style="flex:1;padding:9px;border:2px solid #C62828;border-radius:8px;font-size:15px;font-weight:800;text-align:center">'
      + '</div>'
      + (sug ? '<div style="font-size:10.5px;color:#999;margin-top:3px">Sugerido con tu margen de siempre ('
             + Math.round(margenDeCasa()*100) + '%). Cámbialo si quieres.</div>' : '')
      + '</div>';
  });
  h += '<div style="display:flex;gap:8px;margin-top:10px">'
    + '<button onclick="cerrarPreciosNuevos()" style="flex:.8;padding:13px;background:#F0F0F2;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer">Volver</button>'
    + '<button onclick="guardarPreciosNuevos()" style="flex:1.4;padding:13px;background:#C62828;color:#fff;border:none;border-radius:10px;font-size:13.5px;font-weight:900;cursor:pointer">✓ Ponerles precio y guardar</button>'
    + '</div></div>';
  ov.innerHTML = h;
  return true;
}

function fechaVentaAISO(fechaMMDDYYYY){
  var p = (fechaMMDDYYYY||'').split('/');
  if(p.length !== 3) return null;
  return p[2]+'-'+String(p[0]).padStart(2,'0')+'-'+String(p[1]).padStart(2,'0');
}

// Cuenta cuantas unidades de cada producto se vendieron dentro del rango elegido
function cambiarClienteVenta(){
  var esc = document.getElementById('v-escoger-cliente');
  if(esc) esc.style.display = 'block';
  var caja = document.getElementById('v-quien');
  if(caja) caja.style.display = 'none';
  var bus = document.getElementById('vcl-buscar');
  if(bus){ bus.value = ''; try { bus.focus(); } catch(e){} }
}

function filtrarClienteVenta(q){
  var lista = document.getElementById('vcl-lista');
  if(!lista) return;
  if(!q || !q.trim()){ lista.style.display='none'; lista.innerHTML=''; return; }
  clientes = LS('ncl', []);
  // Fuera los barberos SIN SERVICIO: no aparecen para venderles ni pedirles. -8 ago-
  var _clConServicio = soloConServicio(clientes);
  // Buscar por nombre Y por negocio (barbería)
  var res = filtrarPorBusqueda(clientes, q, function(c){ return nombreCl(c) + ' ' + (c.negocio||''); }).slice(0,15);
  if(!res.length){ lista.style.display='block'; lista.innerHTML='<div style="padding:12px;color:#999;font-size:13px">Sin coincidencias</div>'; return; }
  lista.innerHTML = '';
  res.forEach(function(c){
    var d = document.createElement('div');
    d.style.cssText = 'padding:11px 12px;border-bottom:1px solid #f0f0f0;cursor:pointer';
    d.innerHTML = '<div style="font-weight:600;font-size:14px;color:var(--nbs-ink)">'+escaparHtml(nombreCl(c))+'</div>'
      + (c.negocio ? '<div style="font-size:12px;color:var(--nbs-muted)">🏪 '+escaparHtml(c.negocio)+'</div>' : '');
    d.onclick = (function(cid){ return function(){ seleccionarClienteVenta(cid); }; })(c.id);
    lista.appendChild(d);
  });
  lista.style.display='block';
}

// Al tocar un cliente en la búsqueda: lo selecciona en el menú y muestra sus favoritos.
function seleccionarClienteVenta(cid){
  var sel = document.getElementById('vcl');
  if(sel) sel.value = cid;
  var lista = document.getElementById('vcl-lista');
  if(lista){ lista.style.display='none'; lista.innerHTML=''; }
  var buscar = document.getElementById('vcl-buscar');
  if(buscar) buscar.value = '';
  renderMetodosPago('vini');
  renderFavoritosCliente();
}

// Agrega un producto favorito a la venta de un solo toque.
function repetirUltimaVenta(){
  var sel = document.getElementById('vcl');
  var cid = sel ? sel.value : '';
  if(!cid){ alert('Primero elige el cliente.'); return; }
  var ventasCl = LS('nv', []).filter(function(v){ return String(v.cid)===String(cid) && (v.items||[]).length; });
  if(!ventasCl.length){ alert('Este cliente no tiene ventas anteriores todavía.'); return; }
  // La última venta = la de id más grande (los id son fecha en milisegundos)
  ventasCl.sort(function(a,b){ return (b.id||0) - (a.id||0); });
  var ultima = ventasCl[0];
  loadProds();
  var agregados = 0, noExisten = 0;
  (ultima.items||[]).forEach(function(it){
    var prod = productos.find(function(p){ return String(p.id)===String(it.pid); });
    if(prod){
      agregarProducto(prod.id, it.cant, prod);
      agregados++;
    } else {
      noExisten++;
    }
  });
  if(agregados){
    var msg = 'Se agregaron '+agregados+' producto(s) de su última compra.';
    if(noExisten) msg += '\n('+noExisten+' ya no están en el catálogo y no se agregaron.)';
    // aviso corto no bloqueante: se ve en el carrito de una vez
  } else {
    alert('Los productos de la última compra ya no están en el catálogo.');
  }
}

function calcDesc(){
  var tipo = document.getElementById('vdesc-tipo') ? document.getElementById('vdesc-tipo').value : 'ninguno';
  var val = dinero(document.getElementById('vdesc-val') ? document.getElementById('vdesc-val').value : 0) || 0;
  var subtot = iV.reduce(function(s,it){ return s + it.cant*it.precio; }, 0);
  var desc = 0;
  if(tipo === 'pct' && val > 0){
    desc = subtot * (val/100);
    var dl = document.getElementById('vdesc-label');
    if(dl) dl.textContent = 'Descuento ('+val+'%)';
  } else if(tipo === 'monto' && val > 0){
    desc = Math.min(val, subtot);
    var dl2 = document.getElementById('vdesc-label');
    if(dl2) dl2.textContent = 'Descuento';
  }
  var dl3 = document.getElementById('vdesc-linea');
  if(dl3) dl3.style.display = desc > 0 ? 'flex' : 'none';
  var da = document.getElementById('vdesc-amt');
  if(da) da.textContent = '-$' + fmtNum(desc);
  var st = document.getElementById('vsubtot');
  if(st) st.textContent = '$' + fmtNum(subtot);
  var vt = document.getElementById('vtot');
  if(vt) vt.textContent = '$' + fmtNum(Math.max(0, subtot-desc));
}

function renderIV(){
  var el = document.getElementById('iv'); el.innerHTML = '';
  var subtot = 0;
  // 🛒 EL ULTIMO QUE AGREGAS, ARRIBA -Sensei, 28 ago-: "el ultimo de 4 que agregue
  // deberia quedar arriba porque es el mas reciente".
  // 🔑 Se cambia SOLO EL ORDEN EN QUE SE PINTA. El carrito `iV` NO se toca: si se le
  // diera la vuelta al array, los numeros de cada renglon -que son los que usan el boton de
  // quitar y las casillas de cantidad y precio- apuntarian al producto equivocado.
  var _ordenIV = iV.map(function(it, i){ return { it: it, i: i }; }).reverse();
  _ordenIV.forEach(function(_par){
    var it = _par.it, i = _par.i;
    subtot += it.cant * it.precio;
    var row = document.createElement('div');
    row.style.cssText = 'padding:8px 0;border-bottom:1px solid #f0f0f0';
    row.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">'
      +'<span style="font-weight:600;font-size:13px;flex:1">'+escaparHtml(it.nombre)+'</span>'
      +'<span style="font-weight:700;color:#1565C0;font-size:13px;margin-left:8px">$'+fmtNum((it.cant*it.precio))+'</span>'
      +'<button onclick="rmIV('+i+')" style="background:none;border:none;cursor:pointer;color:#D32F2F;font-size:18px;padding:0 0 0 8px">✕</button>'
      +'</div>'
      +'<div style="display:flex;gap:8px;align-items:center">'
      +'<div style="display:flex;align-items:center;gap:4px">'
      +'<button onclick="cambiarCantIV('+i+',-1)" style="width:28px;height:28px;background:var(--nbs-red-bg);color:var(--nbs-red-dark);border:none;border-radius:6px;cursor:pointer;font-size:14px;font-weight:700">−</button>'
      +'<span style="width:26px;text-align:center;font-size:13px;font-weight:700">'+it.cant+'</span>'
      +'<button onclick="cambiarCantIV('+i+',1)" style="width:28px;height:28px;background:var(--nbs-green-bg);color:var(--nbs-green-text);border:none;border-radius:6px;cursor:pointer;font-size:14px;font-weight:700">+</button>'
      +'</div>'
      +'<label style="font-size:11px;color:#aaa;margin-left:auto">Precio c/u:</label>'
      +'<input type="text" inputmode="numeric" value="'+it.precio.toFixed(2)+'" onfocus="this.select()" oninput="formatoMoneda(this);actualizarPrecioIV('+i+',this.value)" style="width:70px;padding:5px 6px;border:1px solid #ddd;border-radius:6px;font-size:12px;text-align:center">'
      +'</div>';
    el.appendChild(row);
  });
  var st = document.getElementById('vsubtot');
  if(st) st.textContent = '$' + fmtNum(subtot);
  calcDesc();
}

function subtotalDeVenta(v){
  if(!v) return 0;
  var items = v.items || [];
  var s = 0;
  for(var i = 0; i < items.length; i++){
    s += (parseFloat(items[i].precio) || 0) * (parseFloat(items[i].cant) || 0);
  }
  return Math.round(s * 100) / 100;
}

// Cuanto descuento lleva la factura. 0 si no lleva.
function descuentoDeVenta(v){
  var d = (v && v.descuento && parseFloat(v.descuento.monto)) || 0;
  return d > 0.005 ? Math.round(d * 100) / 100 : 0;
}

function gananciaDeVenta(v){
  if(!v) return 0;
  var items = v.items || [];
  var g = 0;
  for(var i = 0; i < items.length; i++){
    var it = items[i];
    g += ((parseFloat(it.precio) || 0) - (parseFloat(it.costo) || 0)) * (parseFloat(it.cant) || 0);
  }
  var desc = (v.descuento && parseFloat(v.descuento.monto)) || 0;
  g = g - desc;
  if(g < 0) g = 0;
  return Math.round(g * 100) / 100;
}

// ¿Se le puede calcular la ganancia? Si a algun renglon le falta el costo, NO —
// porque el resultado seria mentira.
function saveV(){
  if(!iV.length){ alert('Agrega al menos un producto'); return; }
  // 🤖 AVISO DE INVENTARIO (14 ago): si está vendiendo más de lo que hay, se lo dice.
  // Medido: tiene 14 productos en negativo, o sea que ya le pasó 14 veces.
  // ⚠️ Solo AVISA. Si él dice que sí, la venta se hace igual — su inventario no
  // está al día y no se le puede bloquear una venta de verdad por eso.
  try { if(!avisarSiNoAlcanza(iV)) return; } catch(eInv){}
  var cid = parseInt(document.getElementById('vcl').value)||null;
  var cl = cid ? clientes.find(function(c){ return String(c.id) === String(cid); }) : null;
  var cn = cl ? nombreCl(cl) : 'Cliente general';
  var tipo = document.getElementById('vtipo').value;
  var metodosPagoV = (window._pagoMetodos && window._pagoMetodos['vini']) ? window._pagoMetodos['vini'].filter(function(m){ return m.monto>0; }) : [];
  var ini = metodosPagoV.reduce(function(s,m){ return s+m.monto; }, 0);

  // Calcular descuento
  var descTipo = document.getElementById('vdesc-tipo') ? document.getElementById('vdesc-tipo').value : 'ninguno';
  var descVal = dinero(document.getElementById('vdesc-val') ? document.getElementById('vdesc-val').value : 0) || 0;

  var subtot = iV.reduce(function(s,it){ return s + it.cant*it.precio; },0);
  var descMonto = 0;
  if(descTipo==='pct' && descVal>0) descMonto = subtot*(descVal/100);
  else if(descTipo==='monto' && descVal>0) descMonto = Math.min(descVal, subtot);
  var totalFinal = Math.max(0, subtot - descMonto);

  var resumen = cn + '\n' + iV.length + ' producto(s)\nTotal: $'+fmtNum(totalFinal)+'\nPago: ' + (tipo==='credito'?'A crédito':'Contado');
  if(tipo==='contado' && ini < totalFinal){
    if(!confirm('Marcaste "Contado" pero el pago que registraste ($'+fmtNum(ini)+') no cubre el total ($'+fmtNum(totalFinal)+'). ¿Continuar de todas formas?')) return;
  }
  if(!verificarStockSuficiente(iV)) return;
  // -confirmacion redundante "¿Registrar esta venta?" quitada, el boton de Guardar ya es la confirmacion-

  var subtot=0, gan=0;
  iV.forEach(function(it){
    var p=productos.find(function(x){return String(x.id) === String(it.pid);});
    if(p) p.stock = (p.stock||0) - it.cant;   // baja a negativo si se vende sin stock; la factura de compra lo corrige solo -20 sep-
    subtot += it.cant*it.precio;
    gan += it.cant*(it.precio-it.costo);
  });

  var descMonto = 0;
  if(descTipo==='pct' && descVal>0) descMonto = subtot*(descVal/100);
  else if(descTipo==='monto' && descVal>0) descMonto = Math.min(descVal, subtot);

  var tot = Math.max(0, subtot - descMonto);
  gan = Math.max(0, gan - descMonto);

  if(tipo==='credito' && tot-ini > 0){
    var saldo = tot - ini;
    var ex = creditos.find(function(c){ return c.cid===cid; });
    if(ex){ ex.saldo += saldo; ex.total += tot; }
    else creditos.push({cid:cid, cn:cn, total:tot, saldo:saldo, pagos:[]});
    SS('ncr', creditos);
  }
  var pagosIniciales = [];
  // Usar fecha seleccionada o fecha de hoy
  var vfechaEl = document.getElementById('vfecha');
  var fechaVenta = fechaHoy();
  if(vfechaEl && vfechaEl.value){
    var fparts = vfechaEl.value.split('-');
    if(fparts.length === 3) fechaVenta = fparts[1]+'/'+fparts[2]+'/'+fparts[0];
  }
  // 🔑 EL PAGO NUNCA PUEDE PASARSE DE LA FACTURA. Lo que sobre abona las facturas
  // viejas -de la mas vieja a la mas nueva- y si todavia sobra, va a credito a favor.
  // Sensei lo cazo: vendio $34, el cliente debia $20 y le pago $35, y el dolar que
  // sobro no abono la factura vieja ni quedo a favor: se colgaba como saldo negativo
  // en la factura nueva. -14 ago-
  var _paraEsta = Math.min(ini, tot);
  var _sobra = Math.round((ini - _paraEsta) * 100) / 100;
  if(_paraEsta > 0) pagosIniciales.push({monto:_paraEsta, fecha:fechaVenta, nota:'Pago inicial', metodos: metodosPagoV});

  var _abonadoAViejas = 0;
  var _cuantasViejas = 0;
  if(_sobra > 0.005 && cid){
    ventas = LS('nv', []);
    var _viejas = ventas.filter(function(v){
      if(v.cancelada || String(v.cid) !== String(cid) || v.tipo !== 'credito') return false;
      var pg = 0;
      (v.pagosFactura || []).forEach(function(p){ if(!p.esDevolucion) pg += parseFloat(p.monto) || 0; });
      return ((parseFloat(v.total) || 0) - pg) > 0.005;
    }).sort(function(a, b){
      var fa = parsearFechaVenta(a.fecha), fb = parsearFechaVenta(b.fecha);
      return (fa ? fa.getTime() : 0) - (fb ? fb.getTime() : 0);
    });

    _viejas.forEach(function(v){
      if(_sobra <= 0.005) return;
      var pg = 0;
      (v.pagosFactura || []).forEach(function(p){ if(!p.esDevolucion) pg += parseFloat(p.monto) || 0; });
      var debe = Math.round(((parseFloat(v.total) || 0) - pg) * 100) / 100;
      var usar = Math.min(_sobra, debe);
      if(usar <= 0.005) return;
      if(!v.pagosFactura) v.pagosFactura = [];
      v.pagosFactura.push({ monto: usar, fecha: fechaVenta,
                            nota: 'Abono del vuelto de la venta de hoy',
                            metodos: metodosPagoV });
      _sobra = Math.round((_sobra - usar) * 100) / 100;
      _abonadoAViejas = Math.round((_abonadoAViejas + usar) * 100) / 100;
      _cuantasViejas++;
    });
    if(_abonadoAViejas > 0) SS('nv', ventas);
  }

  var _aFavor = 0;
  if(_sobra > 0.005 && cid){
    clientes = LS('ncl', []);
    var _iCl = clientes.findIndex(function(c){ return String(c.id) === String(cid); });
    if(_iCl >= 0){
      clientes[_iCl].creditoAFavor = Math.round(((clientes[_iCl].creditoAFavor || 0) + _sobra) * 100) / 100;
      SS('ncl', clientes);
      _aFavor = _sobra;
      _sobra = 0;
    }
  }

  // Si el usuario eligio "Usar credito del cliente" como uno de los metodos de pago,
  // se descuenta ese monto del credito a favor que tenia -nunca se aplica solo, sin que se elija-.
  var creditoAplicadoMsg = '';
  var metodoCredito = metodosPagoV.find(function(m){ return m.tipo === 'credito_cliente'; });
  if(cid && metodoCredito && metodoCredito.monto > 0){
    clientes = LS('ncl', []);
    var clIdxCredito = clientes.findIndex(function(c){ return String(c.id) === String(cid); });
    if(clIdxCredito >= 0){
      var creditoDisp = clientes[clIdxCredito].creditoAFavor||0;
      var montoUsar = Math.min(creditoDisp, metodoCredito.monto);
      if(montoUsar > 0.005){
        clientes[clIdxCredito].creditoAFavor = creditoDisp - montoUsar;
        SS('ncl', clientes);
        creditoAplicadoMsg = '\n\n💳 Se usaron $'+fmtNum(montoUsar)+' del crédito a favor de este cliente.';
      }
      if(metodoCredito.monto > creditoDisp + 0.005){
        alert('Aviso: el cliente solo tenía $'+fmtNum(creditoDisp)+' de crédito disponible, pero se marcaron $'+fmtNum(metodoCredito.monto)+'. Solo se aplicaron los $'+fmtNum(creditoDisp)+' reales.');
      }
    }
  }

  ventas = LS('nv',[]);
  var clienteData = cl ? {negocio:cl.negocio||'',tel:cl.tel||'',email:cl.email||'',dir:cl.dir||'',ciudad:cl.ciudad||'',estado:cl.estado||'',zip:cl.zip||''} : null;
  var descInfo = descMonto > 0 ? {tipo:descTipo, valor:descVal, monto:descMonto} : null;
  ventas.push({id:Date.now(),numFactura:siguienteNumeroFactura(),cid:cid,cn:cn,tipo:tipo,items:iV.slice(),subtotal:subtot,descuento:descInfo,total:tot,ganancia:gan,fecha:fechaVenta,hora:new Date().toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',hour12:true}),pagosFactura:pagosIniciales,firma:(window._firmaVentaActual||null),firmaFecha:(window._firmaFechaActual||null),clienteData:clienteData});
  // 🤖 PEDIR LA FIRMA EN LAS VENTAS A CRÉDITO (14 ago).
  // Medido: 334 de sus 349 ventas (96%) no tienen firma. Si un cliente reclama,
  // no tiene prueba. Se le ofrece SOLO en las de crédito, que son las que pueden
  // dar problema — y solo si no la tomó ya.
  // ✍️ AQUÍ HABÍA UN TERCER AVISO DE FIRMA que salía 700ms DESPUÉS de guardar
  // la venta. Sensei: "la firma solo debe pedirla UNA VEZ y yo decido SÍ o NO...
  // hay órdenes que no requieren firma y otras que sí, y eso lo manejaré yo a
  // discreción". Tenía razón — la pregunta de antes de guardar ya es suficiente.
  // QUITADO del todo el 19 ago. NO volver a ponerlo.

  // 🤖 LA VISITA SE MARCA SOLA (14 ago): la ruta, el récord y la bitácora, de una vez.
  try {
    var _v = ventas[ventas.length - 1] || {};
    apuntarTodoDeLaVisita(cl, true, {
      ventaId: _v.id, total: _v.total, ganancia: _v.ganancia,
      tipo: _v.tipo, productos: productosParaBitacora(_v), como: 'auto'
    });
  } catch(eBit){
    // Si algo falla aquí, la venta NO se puede perder: se hace lo de antes.
    if(cl && cl.negocio) marcarLlegadaBarberia(cl.negocio);
  }
  iV=[];
  renderIV();
  document.getElementById('vcl').value='';
  document.getElementById('vtipo').value='credito';
  window._pagoMetodos = window._pagoMetodos || {};
  window._pagoMetodos['vini'] = [{tipo:'efectivo', monto:0}];
  renderMetodosPago('vini');
  actualizarLabelPagoVenta();
  if(document.getElementById('vdesc-tipo')) document.getElementById('vdesc-tipo').value='ninguno';
  if(document.getElementById('vdesc-val')) document.getElementById('vdesc-val').value='0';
  if(document.getElementById('vdesc-linea')) document.getElementById('vdesc-linea').style.display='none';
  SS('nv',ventas);
  SS('np',productos);
  window._firmaVentaActual = null; // limpiar la firma para la próxima venta
  window._firmaFechaActual = null;
  flash('mk-v');
  verificarVIPdespuesDeVenta(cid, iV.slice());
  verificarFidelidadDespuesDeVenta(cid);
  var ultV = ventas[ventas.length-1];
  var pagadoTotalVenta = pagosIniciales.reduce(function(s,p){ return s+p.monto; }, 0);
  var _msgVuelto = '';
  if(_abonadoAViejas > 0.005){
    _msgVuelto += '\n\n\ud83d\udcb5 Te sobraron $' + fmtNum(_abonadoAViejas)
      + ' y se le abonaron a ' + _cuantasViejas + ' factura(s) que ten\u00eda pendiente(s).';
  }
  if(_aFavor > 0.005){
    _msgVuelto += '\n\n\ud83d\udcb0 Y quedaron $' + fmtNum(_aFavor)
      + ' a favor de este cliente para su pr\u00f3xima compra.';
  }
  var msg = 'Venta registrada por $'+fmtNum(tot)+(tipo==='credito'?' - Saldo pendiente: $'+fmtNum(Math.max(0,tot-pagadoTotalVenta)):'')+creditoAplicadoMsg+_msgVuelto;
  var accDiv = document.getElementById('venta-acciones');
  if(!accDiv){
    accDiv = document.createElement('div');
    accDiv.id = 'venta-acciones';
    accDiv.style.cssText = 'margin-top:10px';
    document.getElementById('mk-v').parentNode.appendChild(accDiv);
  }
  accDiv.innerHTML = '<div style="margin-bottom:8px;font-size:14px;font-weight:600;color:#2E7D32">✓ '+msg+'</div>'
    +'<div style="display:flex;gap:8px">'
    +'<button onclick="verFacturaProfesional(\''+ultV.id+'\')" style="flex:1;padding:12px;background:var(--nbs-gold);color:white;border:none;border-radius:8px;cursor:pointer;font-size:14px;font-weight:700">👁️ Ver factura</button>'
    +'</div>';
  ventaActual = ultV;

  // 💬 El comprobante de la VENTA, con el balance al día. -Sensei, 29 ago-
  // Solo si la venta tiene cliente: a un "cliente general" no hay a quién mandárselo.
  try {
    // \ud83c\udfba \u00bfESA VENTA LE DIO EL PREMIO? Si un grupo acaba de llegar a los 10, suena la
  // fanfarria y se le avisa. Suena UNA sola vez, en el momento. -3 sep-
  if(ultV && ultV.cid){
    setTimeout(function(){
      var _nuevos = [];
      try { _nuevos = revisarPremioNuevo(ultV.cid) || []; } catch(e){}
      if(_nuevos.length){
        var _cli = LS('ncl', []).find(function(x){ return String(x.id) === String(ultV.cid); });
        avisoGrande('\ud83c\udf81 \u00a1PREMIO GANADO!\n\n'
          + (_cli ? nombreCl(_cli) : '') + '\n\n'
          + _nuevos.map(function(g){ return '\u2022 ' + g.nombre + ' \u2014 ' + g.puntos + ' puntos'; }).join('\n')
          + '\n\nYa le toca su regalo.');
      }
    }, 250);
    // 💬 LOS 7 MENSAJES -Sensei, 16 sep-: escoge qué pasó hoy y sale el texto armado.
    setTimeout(function(){
      try {
        var _pag = 0;
        (ultV.pagosFactura || []).forEach(function(p){
          if(p && !p.esDevolucion) _pag += (parseFloat(p.monto) || 0);
        });
        abrirMensajeCliente(ultV.cid, { compra: tot, pago: _pag });
      } catch(e){ ofrecerMensajeAlCliente(ultV.cid, 'venta', tot, null); }
    }, 900);
  }
  } catch(e){}

  // Volver automaticamente a la pantalla correcta segun de donde vino esta venta
  var destino = window._vendiendoDesde;
  if(destino){
    // Si esta venta vino de convertir un pedido, AHORA SI se borra el pedido -ya se completo de verdad-
    if(destino.tipo === 'pedido' && destino.pedidoId !== undefined){
      var pedidosActuales = LS('npedidos', []);
      var idxABorrar = pedidosActuales.findIndex(function(pp){ return String(pp.id) === String(destino.pedidoId); });
      if(idxABorrar >= 0){ pedidosActuales.splice(idxABorrar, 1); SS('npedidos', pedidosActuales); }
    }
    var btnCancelarConv2 = document.getElementById('btn-cancelar-conversion-pedido');
    if(btnCancelarConv2) btnCancelarConv2.style.display = 'none';
    var btnBorrarConv2 = document.getElementById('btn-borrar-pedido-conversion');
    if(btnBorrarConv2) btnBorrarConv2.style.display = 'none';
    window._vendiendoDesde = null;
    setTimeout(function(){
      if(destino.tipo === 'cliente' && destino.cid){
        verCl(destino.cid);
      } else if(destino.tipo === 'pedido'){
        ir('p-ped');
      }
    }, 900); // pequena pausa para que se alcance a ver la confirmacion de la venta guardada
  } else {
    // La venta se hizo directo desde VENDER (se escogio el cliente ahi mismo, sin venir de un
    // perfil ni de un pedido). Como ya se termino con ese cliente, regresar solo a la lista de
    // clientes despues de 2 segundos, para seguir con el siguiente. Da tiempo a tocar imprimir.
    setTimeout(function(){ ir('p-cl'); }, 2000);
  }
}

function actualizarLabelPagoVenta(){
  var tipo = document.getElementById('vtipo').value;
  var label = document.getElementById('v-pago-label');
  if(label) label.textContent = tipo==='contado' ? '💰 ¿Cómo pagó el cliente el total?' : '💰 Pago inicial (opcional, puede ser $0)';
}

var pedidos = LS('npedidos', []);
var pedItemsTemp = [];
var pedidoEditandoIdx = null;

// (renderPedidos vieja eliminada 18 jul 2026: estaba duplicada y muerta, JS usaba la nueva)

function eliminarPedido(idx){
  if(!confirm('¿Eliminar este pedido?')) return;
  pedidos = LS('npedidos', []);
  pedidos.splice(idx, 1);
  SS('npedidos', pedidos);
  renderPedidos();
}

function editarPedido(idx){
  pedidos = LS('npedidos', []);
  var p = pedidos[idx];
  if(!p) return;
  pedidoEditandoIdx = idx;
  pedItemsTemp = (p.items || []).slice();
  pedBarberoCid = p.cid || null;
  pedBarberoNombre = p.nombre || null;
  pedBarberiaSel = p.barberia || null;
  document.getElementById('ped-lista-wrap').style.display = 'none';
  document.getElementById('ped-barberia-wrap').style.display = 'none';
  document.getElementById('ped-barbero-wrap').style.display = 'none';
  var multiWrap = document.getElementById('ped-multi-wrap');
  if(multiWrap) multiWrap.style.display = 'none';
  document.getElementById('ped-form-wrap').style.display = 'block';
  try { ponerTextoBotonesPedido(); } catch(e){}
  try { pintarBotonCancelarPedido(); } catch(eBtn){}
  document.getElementById('ped-barbero-actual').textContent = '✏️ Editando: ' + (p.nombre||'');
  document.getElementById('ped-barberia-actual').textContent = p.barberia||'';
  renderPedItems();
  renderFavoritosPedido(); // arreglado 23 jul: al editar un pedido tampoco salian las tarjetas
}

var pedBarberiaSel = null;
var pedBarberoCid = null;
var pedBarberoNombre = null;

function nuevoPedidoRapido(){
  // Mantener compatibilidad con editar pedido existente
  pedItemsTemp = [];
  pedidoEditandoIdx = null;
  iniciarNuevoPedido();
}

var barberiasAbiertas = {};
var barberosSel = {}; // {cid: {cliente, barberia}}

function iniciarPedidoMultiple(){
  var selArray = Object.keys(barberosSel).map(function(id){ return barberosSel[id]; });
  if(!selArray.length){ alert('Selecciona al menos un barbero'); return; }
  // El orden que Sensei dejó puesto para esta barbería, con las flechitas ▲▼
  var _barberiaSel = (selArray[0] && selArray[0].barberia) || '';
  var _clientes = selArray.map(function(s){ return s.cliente; });
  try { _clientes = ordenarBarberosComoQuiere(_barberiaSel, _clientes); } catch(e){}
  var _porId = {};
  selArray.forEach(function(s){ _porId[String(s.cliente.id)] = s; });
  pedidosMultiTemp = _clientes.map(function(c, i){
    var s = _porId[String(c.id)] || { cliente: c, barberia: _barberiaSel };
    return { cliente: s.cliente, barberia: s.barberia, items: [], color: COLORES_BARBERO[i % COLORES_BARBERO.length] };
  });
  barberosSel = {};
  pedMultiSel = {};
  pedMultiCant = {};
  abrirPantallaMultiple();
}

function guardarPedidoEnProceso(){
  try{
    if(!pedidosMultiTemp.length){ localStorage.removeItem(CLAVE_PEDIDO_EN_PROCESO); return; }
    // 🔑 Si NINGUNO tiene productos pendientes —todos guardados o en blanco—, no hay
    // nada "a medias" que recordar. Antes se guardaba igual, y Sensei veía sus 3
    // pedidos guardados MÁS un borrador con esos mismos 3 en cero. -17 sep-
    var _quedaAlgo = pedidosMultiTemp.some(function(p){
      return !p._guardado && (p.items || []).length > 0;
    });
    if(!_quedaAlgo){ localStorage.removeItem(CLAVE_PEDIDO_EN_PROCESO); return; }
    // Se deja fuera _habituales -los productos que suele comprar-: se vuelve a calcular
    // solo, y guardarlo ocuparia mucho sin necesidad.
    var limpio = pedidosMultiTemp.map(function(p){
      return { cliente: p.cliente, barberia: p.barberia, items: p.items, color: p.color };
    });
    localStorage.setItem(CLAVE_PEDIDO_EN_PROCESO, JSON.stringify({ hora: Date.now(), barberos: limpio }));
  }catch(e){}
}

function hayPedidoEnProceso(){
  try{
    var d = JSON.parse(localStorage.getItem(CLAVE_PEDIDO_EN_PROCESO) || 'null');
    return (d && d.barberos && d.barberos.length) ? d : null;
  }catch(e){ return null; }
}

function olvidarPedidoEnProceso(){
  try{ localStorage.removeItem(CLAVE_PEDIDO_EN_PROCESO); }catch(e){}
}

function retomarPedidoEnProceso(){
  var d = hayPedidoEnProceso();
  if(!d) return;
  pedidosMultiTemp = d.barberos;
  pedMultiSel = {};
  pedMultiCant = {};
  abrirPantallaMultiple();
}

function descartarPedidoEnProceso(){
  var d = hayPedidoEnProceso();
  if(!d) return;
  var conItems = d.barberos.filter(function(p){ return p.items && (p.items || []).length; }).length;
  var msj = conItems
    ? '\u00bfBotar el pedido que dejaste A MEDIAS?\n\n'
      + 'Tiene ' + conItems + ' barbero(s) con productos agregados que NO has guardado.\n\n'
      + '\u26a0\ufe0f Esto NO toca los pedidos que ya guardaste. Esos siguen en Pedidos Pendientes.'
    : '\u00bfBotar el pedido que dejaste a medias?\n\n'
      + 'No tiene productos agregados.\n\n'
      + '\u26a0\ufe0f Esto NO toca los pedidos que ya guardaste.';
  if(!confirm(msj)) return;
  olvidarPedidoEnProceso();
  pedidosMultiTemp = [];

  // Borrar el aviso YA, sin esperar a nada mas. Sensei reporto el 29 jul que al tocar
  // Descartar la pantalla se quedaba igual y el aviso seguia ahi, aunque el pedido SI se
  // habia borrado -al refrescar a mano ya no estaba-. En el taller no se reproduce, asi
  // que se hace a prueba de eso: se quita el aviso del DOM de una vez, y el redibujado
  // completo se manda con setTimeout(0) para que corra DESPUES de que el telefono termine
  // de cerrar su letrero de confirmacion.
  var avisoW = document.getElementById('ped-retomar-wrap');
  if(avisoW) avisoW.innerHTML = '';
  // A PRUEBA DE BALAS (24 jul, pedido por Sensei: "debería volver al listado de todas
  // las barberías... el botón funciona pero no saca de esa pantalla"). Antes solo se
  // refrescaba el avisito, y si Sensei estaba DENTRO del formulario (ped-multi-wrap,
  // ped-barbero-wrap, etc.) se quedaba ahi mismo viendo datos ya borrados. Ahora
  // SIEMPRE se navega de vuelta a la lista completa de Pedidos Rapidos, sin importar
  // desde donde se haya tocado "Descartar".
  setTimeout(function(){
    try {
      ir('p-ped');
      var av = document.getElementById('ped-retomar-wrap');
      if(av) av.innerHTML = '';        // por si el redibujado lo repuso
      window.scrollTo(0, 0);
    } catch(e){ console.error('No se pudo volver a Pedidos Rapidos:', e); }
  }, 0);
}

// El aviso arriba de la lista, para retomar lo que dejaste a medias
function renderAvisoPedidoEnProceso(){
  var el = document.getElementById('ped-retomar-wrap');
  if(!el) return;
  var d = hayPedidoEnProceso();
  if(!d){ el.innerHTML = ''; return; }

  var totalMonto = 0, conItems = 0;
  d.barberos.forEach(function(p){
    var t = (p.items||[]).reduce(function(s,it){ return s + (it.cant * it.precio); }, 0);
    totalMonto += t;
    if((p.items||[]).length) conItems++;
  });
  var negocios = {};
  d.barberos.forEach(function(p){ negocios[p.barberia] = true; });
  var nombreNeg = Object.keys(negocios).length === 1 ? Object.keys(negocios)[0] : 'Varios negocios';

  var mins = Math.floor((Date.now() - (d.hora||0)) / 60000);
  var cuando = mins < 1 ? 'hace un momento' : (mins < 60 ? 'hace '+mins+' min' : 'hace '+Math.floor(mins/60)+' h');

  el.innerHTML = '<div style="background:var(--nbs-gold-bg);border:1.5px solid var(--nbs-gold);border-radius:12px;padding:12px;margin-bottom:10px">'
    +'<div style="font-size:12px;font-weight:800;color:var(--nbs-gold-dark);margin-bottom:3px">⚡ TIENES UN PEDIDO A MEDIAS</div>'
    +'<div style="font-size:13px;font-weight:700;color:var(--nbs-ink)">'+escaparHtml(nombreNeg)+'</div>'
    +'<div style="font-size:11px;color:var(--nbs-muted);margin-bottom:9px">'+d.barberos.length+' barbero(s) · '+conItems+' con productos · $'+fmtNum(totalMonto)+' · '+cuando+'</div>'
    +'<div style="display:flex;gap:7px">'
    +'<button onclick="retomarPedidoEnProceso()" style="flex:1;padding:10px;background:var(--nbs-gold);color:white;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer">↺ Seguir con ese</button>'
    +'<button onclick="descartarPedidoEnProceso()" style="padding:10px 13px;background:white;color:#888;border:1px solid #ddd;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer">🗑️ Botar lo que dejé a medias</button>'
    +'</div></div>';
}

// ═══ LA PANTALLA DE INICIO ═══
// Muestra un resumen de un vistazo -para saber como va el negocio sin entrar a nada- y
// avisa si llevas rato sin bajar un respaldo.
function cobrarDesdePedidos(cid){
  clientes = LS('ncl', []);
  var cl = clientes.find(function(c){ return String(c.id) === String(cid); });
  if(!cl){ alert('No encontr\u00e9 ese cliente.'); return; }

  var K = cuentaDeCliente(cid);
  var debe = K.dinero.debe;
  if(debe <= 0.005){ avisoGrande('\u2705 ' + nombreCl(cl) + ' no te debe nada.'); return; }

  // Sus facturas, de la MÁS VIEJA a la más nueva — la misma función de siempre
  var pendientes = facturasQueDebenDe(cid, null);

  var h = '<div style="padding:16px">';
  h += '<div style="font-size:10px;font-weight:900;color:var(--nbs-muted);letter-spacing:1px">COBRARLE A</div>';
  h += '<div style="font-size:19px;font-weight:900;color:var(--nbs-ink);line-height:1.2;margin-bottom:2px">'
    + escaparHtml(nombreCl(cl)) + '</div>';
  if(cl.negocio) h += '<div style="font-size:11.5px;color:var(--nbs-muted);margin-bottom:12px">\ud83c\udfea '
    + escaparHtml(cl.negocio) + '</div>';

  h += '<div style="background:var(--nbs-red-bg);border-radius:11px;padding:12px;margin-bottom:13px;text-align:center">'
    + '<div style="font-size:10.5px;font-weight:800;color:var(--nbs-muted);letter-spacing:.5px">TE DEBE</div>'
    + '<div style="font-size:27px;font-weight:900;color:var(--nbs-red-text);line-height:1.1">$'
    +   fmtNum(debe) + '</div>'
    + '<div style="font-size:11px;color:var(--nbs-muted);margin-top:2px">'
    +   pendientes.length + ' factura(s) sin saldar</div>'
    + '</div>';

  // Las facturas, de la más vieja a la más nueva
  h += '<div style="font-size:10.5px;font-weight:900;color:var(--nbs-muted);margin-bottom:6px;letter-spacing:.5px">'
    + 'SE VA A APLICAR EN ESTE ORDEN (la m\u00e1s vieja primero)</div>';
  h += '<div id="cobped-facturas" style="margin-bottom:13px">';
  pendientes.slice(0, 8).forEach(function(f, i){
    h += '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;'
      + 'padding:8px 10px;background:#F7F7FB;border-radius:8px;margin-bottom:5px">'
      + '<div style="flex:1;min-width:0">'
      +   '<div style="font-size:12px;font-weight:800;color:var(--nbs-ink)">'
      +     (i + 1) + '. ' + escaparHtml(String(f.fecha || '')) + '</div>'
      +   '<div style="font-size:10px;color:var(--nbs-muted)">factura ' + escaparHtml(String(f.nf || '')) + '</div>'
      + '</div>'
      + '<div id="cobped-f-' + f.id + '" style="font-size:13px;font-weight:900;color:var(--nbs-red-text)">$'
      +   fmtNum(f.saldo) + '</div></div>';
  });
  if(pendientes.length > 8){
    h += '<div style="font-size:10.5px;color:var(--nbs-muted);text-align:center">y '
      + (pendientes.length - 8) + ' m\u00e1s</div>';
  }
  h += '</div>';

  // Cuánto le paga
  h += '<label class="lbl">\u00bfCU\u00c1NTO TE EST\u00c1 PAGANDO?</label>';
  h += '<input class="inp" id="cobped-monto" type="text" inputmode="numeric" '
    + 'placeholder="0.00" oninput="formatoMoneda(this);previewCobroPedidos(' + _arg(cid) + ')" '
    + 'style="font-size:22px;font-weight:900;text-align:center;padding:14px">';

  // Los botones rápidos
  h += '<div style="display:flex;gap:6px;margin:8px 0 12px">'
    + '<button onclick="ponerMontoCobro(' + _arg(cid) + ',' + debe + ')" class="btn" '
    +   'style="flex:1;margin:0;padding:10px;background:#00695C;color:#fff;font-size:12px">'
    +   'Todo ($' + fmtNum(debe) + ')</button>';
  if(pendientes.length){
    h += '<button onclick="ponerMontoCobro(' + _arg(cid) + ',' + pendientes[0].saldo + ')" class="btn" '
      + 'style="flex:1;margin:0;padding:10px;background:#fff;border:1.5px solid #00695C;color:#00695C;font-size:12px">'
      + 'La m\u00e1s vieja ($' + fmtNum(pendientes[0].saldo) + ')</button>';
  }
  h += '</div>';

  // La forma de pago
  h += '<label class="lbl">\u00bfC\u00d3MO TE PAG\u00d3?</label>';
  h += '<select class="inp" id="cobped-metodo">'
    + '<option value="efectivo">\ud83d\udcb5 Efectivo</option>'
    + '<option value="cashapp">\ud83d\udcf1 CashApp</option>'
    + '<option value="zelle">\ud83c\udfe6 Zelle</option>'
    + '</select>';

  // Lo que va a pasar
  h += '<div id="cobped-preview" style="margin:12px 0"></div>';

  h += '<div style="display:flex;gap:8px;margin-top:6px">'
    + '<button onclick="cerrarCobroPedidos()" class="btn" '
    +   'style="flex:.8;margin:0;background:#F0F0F5;color:#333">Cancelar</button>'
    + '<button onclick="aplicarCobroPedidos(' + _arg(cid) + ')" class="btn" '
    +   'style="flex:1.4;margin:0;background:#00695C;color:#fff;font-weight:900">'
    +   '\u2713 Registrar el pago</button>'
    + '</div>';
  h += '</div>';

  var ov = document.getElementById('cobped-overlay');
  if(!ov){
    ov = document.createElement('div');
    ov.id = 'cobped-overlay';
    document.body.appendChild(ov);
  }
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:99993;'
    + 'display:flex;align-items:flex-end;justify-content:center;overflow:auto';
  ov.innerHTML = '<div style="background:#fff;border-radius:16px 16px 0 0;width:100%;max-width:440px;'
    + 'max-height:92vh;overflow:auto">' + h + '</div>';
  setTimeout(function(){
    var i = document.getElementById('cobped-monto');
    if(i) i.focus();
  }, 250);
}

function cerrarCobroPedidos(){
  var ov = document.getElementById('cobped-overlay');
  if(ov) ov.style.display = 'none';
}

function previewCobroPedidos(cid){
  var caja = document.getElementById('cobped-preview');
  if(!caja) return;
  var monto = dinero((document.getElementById('cobped-monto') || {}).value);
  if(monto <= 0.005){ caja.innerHTML = ''; return; }

  var pendientes = facturasQueDebenDe(cid, null);
  if(!pendientes.length){ caja.innerHTML = ''; return; }

  // La MISMA regla de planDeReparto: la más vieja primero
  var sobra = monto;
  var reparto = [];
  pendientes.forEach(function(f){
    if(sobra <= 0.005) return;
    var usar = Math.min(sobra, f.saldo);
    reparto.push({ nf: f.nf, fecha: f.fecha, usar: usar,
                   queda: Math.round((f.saldo - usar) * 100) / 100 });
    sobra = Math.round((sobra - usar) * 100) / 100;
  });

  var h = '<div style="background:var(--nbs-green-bg);border-radius:10px;padding:11px">';
  h += '<div style="font-size:11px;font-weight:900;color:var(--nbs-green-text);margin-bottom:7px">'
    + '\u2713 AS\u00cd SE VA A APLICAR</div>';
  reparto.forEach(function(r){
    h += '<div style="display:flex;justify-content:space-between;gap:8px;font-size:11.5px;'
      + 'padding:4px 0;border-bottom:1px solid rgba(0,0,0,.06)">'
      + '<span style="color:var(--nbs-ink)">' + escaparHtml(String(r.fecha || '')) + ' \u00b7 '
      +   escaparHtml(String(r.nf || '')) + '</span>'
      + '<span style="font-weight:800;color:var(--nbs-green-text)">$' + fmtNum(r.usar)
      +   (r.queda > 0.005 ? ' <span style="color:var(--nbs-muted);font-weight:600">(le queda $'
          + fmtNum(r.queda) + ')</span>' : ' <span style="color:var(--nbs-muted);font-weight:600">(saldada)</span>')
      + '</span></div>';
  });
  if(sobra > 0.005){
    h += '<div style="margin-top:8px;padding:8px;background:var(--nbs-gold-bg);border-radius:7px;'
      + 'font-size:11.5px;font-weight:800;color:var(--nbs-gold-dark)">'
      + '\ud83d\udcb0 Sobran $' + fmtNum(sobra) + ' \u2014 le quedan a favor para su pr\u00f3xima compra</div>';
  }
  h += '</div>';
  caja.innerHTML = h;
}

// Aplicar el pago. Escribe con la MISMA forma que confirmarPagoMultiple. -15 ago-
function aplicarCobroPedidos(cid){
  var monto = dinero((document.getElementById('cobped-monto') || {}).value);
  if(monto <= 0.005){ alert('Escribe cu\u00e1nto te est\u00e1 pagando.'); return; }
  var metodo = (document.getElementById('cobped-metodo') || {}).value || 'efectivo';

  clientes = LS('ncl', []);
  var cl = clientes.find(function(c){ return String(c.id) === String(cid); });
  var pendientes = facturasQueDebenDe(cid, null);
  if(!pendientes.length){ alert('Este cliente no tiene facturas sin saldar.'); return; }

  // El reparto, con la regla de siempre
  var sobra = monto;
  var plan = [];
  pendientes.forEach(function(f){
    if(sobra <= 0.005) return;
    var usar = Math.min(sobra, f.saldo);
    plan.push({ id: f.id, monto: Math.round(usar * 100) / 100, nf: f.nf, fecha: f.fecha });
    sobra = Math.round((sobra - usar) * 100) / 100;
  });

  var resumen = plan.map(function(p){
    return '\u00b7 ' + p.fecha + ' (' + p.nf + '): $' + fmtNum(p.monto);
  }).join('\n');
  if(!confirm('\u00bfRegistrar el pago de $' + fmtNum(monto) + ' de '
      + nombreCl(cl) + '?\n\n' + resumen
      + (sobra > 0.005 ? '\n\n\ud83d\udcb0 Y $' + fmtNum(sobra) + ' le quedan a favor.' : ''))) return;

  var hoy = fechaHoy();
  ventas = LS('nv', []);
  plan.forEach(function(p){
    var v = ventas.find(function(x){ return String(x.id) === String(p.id); });
    if(!v) return;
    if(!v.pagosFactura) v.pagosFactura = [];
    v.pagosFactura.push({
      monto: p.monto, fecha: hoy, metodo: metodo,
      metodos: [{ tipo: metodo, monto: p.monto }],
      nota: 'Cobrado en la ruta'
    });
  });
  SS('nv', ventas);

  // Lo que sobre, a favor del cliente — igual que en Cuentas por Cobrar
  if(sobra > 0.005){
    var i = clientes.findIndex(function(c){ return String(c.id) === String(cid); });
    if(i >= 0){
      clientes[i].creditoAFavor = Math.round(((clientes[i].creditoAFavor || 0) + sobra) * 100) / 100;
      SS('ncl', clientes);
    }
  }

  cerrarCobroPedidos();
  try { renderPedidosMultiples(); } catch(e){}
  try { renderCxC(''); } catch(e){}
  try { marcarPendienteDeSubir('nv'); } catch(e){}

  var K = cuentaDeCliente(cid);
  avisoGrande('\u2705 Cobrado $' + fmtNum(monto) + '\n\n'
    + plan.length + ' factura(s) abonada(s).\n'
    + (K.dinero.debe > 0.005
        ? 'Le queda debiendo $' + fmtNum(K.dinero.debe) + '.'
        : '\ud83c\udf89 Ya no te debe nada.')
    + (sobra > 0.005 ? '\n\n\ud83d\udcb0 $' + fmtNum(sobra) + ' le quedaron a favor.' : ''));
}


// ═══════════════════════════════════════════════════════════════════
//  🚫🚪 LOS DOS MOTIVOS DE NO COMPRAR  (16 ago 2026)
//
//  🔑 SENSEI: "que sea porque no quiere productos y también que sea
//  porque en ese momento el cliente NO ESTÁ en la barbería, o sea que
//  yo pueda decir NO COMPRÓ o NO ESTÁ, que son cosas muy distintas
//  para su récord".
//
//  Los dos cuentan como VISITA -él gastó el viaje-, pero el "no estaba"
//  NO cuenta contra su porcentaje de compra.
// ═══════════════════════════════════════════════════════════════════
function renderPedidosMultiples(){
  var el = document.getElementById('ped-multi-lista');
  if(!el) return;
  el.innerHTML = '';

  var negocios = {};
  pedidosMultiTemp.forEach(function(p){ negocios[p.barberia] = true; });
  var listaNegocios = Object.keys(negocios);
  document.getElementById('ped-multi-titulo').textContent = listaNegocios.length === 1 ? listaNegocios[0] : 'Varios negocios';
  document.getElementById('ped-multi-sub').textContent = pedidosMultiTemp.length + ' barbero(s) · agrégale a cualquiera, en el orden que quieras';

  var totalGeneral = 0;
  // Se leen las ventas UNA sola vez aqui -no una por cada barbero- para que dibujar la
  // pantalla siga siendo instantaneo aunque tengas cientos de ventas guardadas.
  var ventasParaHabituales = LS('nv', []);
  var balances = calcularBalancesClientes();

  pedidosMultiTemp.forEach(function(p, idx){
    var totalBarbero = (p.items || []).reduce(function(s,it){ return s + (it.cant * it.precio); }, 0);
    totalGeneral += totalBarbero;
    var nombreCompleto = nombreCl(p.cliente);
    var pidSel = pedMultiSel[idx];
    var prodSel = pidSel ? productos.find(function(x){ return String(x.id)===String(pidSel); }) : null;
    var cantSel = pedMultiCant[idx] || 1;
    var col = p.color || COLORES_BARBERO[idx % COLORES_BARBERO.length];
    // 💰 SU BALANCE, siempre a la vista — también después de guardar el pedido.
    // Sensei: "a veces los clientes me preguntan cuánto me deben y ya tengo el
    // balance de lo que me deben ahí". -15 ago-
    var _debe = 0;
    try { _debe = cuentaDeCliente(p.cliente.id).dinero.debe; } catch(eD){}

    // 👤 TODOS IGUALES, Y UNO ENCENDIDO -Sensei, 21 ago-: "que los nombres sean todos de
    // un solo color negro y un fondo gris, que se vean bien todos iguales... la cosa es que
    // yo los pueda elegir rapido porque se me confunden".
    // Se quitaron los cinco colores de los nombres. Queda una RAYITA fina de color a la
    // izquierda, que es lo unico que te dice donde empieza y donde termina cada bloque
    // cuando estas abajo agregando productos. Y el barbero en el que estas se marca solo.
    var card = document.createElement('div');
    card.id = 'multi-card-' + idx;
    card.setAttribute('data-idx', idx);
    // Su color de siempre, guardado aqui para poder devolverselo cuando se apague
    card.setAttribute('data-rayita', col.fuerte);
    card.style.cssText = 'background:white;border-radius:12px;margin-bottom:16px;border:1.5px solid #B9B9C6;border-left:6px solid '+col.fuerte+';overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.10);transition:border-color .12s, box-shadow .12s';
    card.onclick = function(){ marcarBarberoActivo(idx); };

    // --- Cabecera: barbero, total, y la ✕ para quitarlo si hoy no compra ---
    // \ud83d\udcc2 ACORDEON -Sensei, 28 ago-: "que cada barbero este cerrado y que cuando lo toque
    // se abra... con mas de 4 barberos se hace dificil subir y bajar entre uno y otro".
    // Nacen todos CERRADOS. Se abre el que tocas, y el que estaba abierto se cierra solo.
    var _abiertoEste = (window._barberoAbierto === idx);
    var html = '<div id="multi-cab-'+idx+'" onclick="toggleBarberoMulti('+idx+')" style="padding:11px 12px;display:flex;align-items:center;gap:9px;cursor:pointer;border-bottom:0.5px solid #f0f0f3;background:'+(_abiertoEste?'#DDE3FA':'#EFEFF3')+'">'
      +'<div style="width:34px;height:34px;border-radius:9px;background:#455A64;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;color:white;flex-shrink:0">'+escaparHtml(p.cliente.nombre[0])+'</div>'
      +'<div style="flex:1;min-width:0">'
      +'<div style="font-size:18px;font-weight:900;color:#1A1A1A;line-height:1.15;letter-spacing:-0.3px">'+escaparHtml(nombreCompleto)+'</div>'
      +(listaNegocios.length > 1 ? '<div style="font-size:11px;color:#888">'+escaparHtml(p.barberia)+'</div>' : '')
      +'</div>'
      +'<div id="multi-total-'+idx+'" style="font-size:15px;font-weight:800;color:'+(totalBarbero>0?'var(--nbs-green-text)':'#bbb')+'">$'+fmtNum(totalBarbero)+'</div>'
      +'<div style="display:flex;flex-direction:column;gap:1px;margin-right:5px">'
      +'<button onclick="event.stopPropagation();moverBarberoMulti('+idx+',-1)" title="Subir" style="background:rgba(255,255,255,0.85);color:#546E7A;border:none;border-radius:5px 5px 0 0;width:26px;height:17px;cursor:pointer;font-size:11px;font-weight:900;line-height:1;padding:0'+(idx===0?';opacity:.3':'')+'">\u25b2</button>'
      +'<button onclick="event.stopPropagation();moverBarberoMulti('+idx+',1)" title="Bajar" style="background:rgba(255,255,255,0.85);color:#546E7A;border:none;border-radius:0 0 5px 5px;width:26px;height:17px;cursor:pointer;font-size:11px;font-weight:900;line-height:1;padding:0'+(idx===pedidosMultiTemp.length-1?';opacity:.3':'')+'">\u25bc</button>'
      +'</div>'
      +'<button onclick="event.stopPropagation();quitarBarberoMulti('+idx+')" title="Hoy no compró" style="background:rgba(255,255,255,0.75);color:var(--nbs-red-dark);border:none;border-radius:7px;width:30px;height:30px;cursor:pointer;font-size:14px;flex-shrink:0">✕</button>'
      +'<span id="multi-flecha-'+idx+'" style="font-size:15px;color:#546E7A;flex-shrink:0;font-weight:900">'+(_abiertoEste?'\u2303':'\u203a')+'</span>'
      +'</div>'
      // Todo lo de abajo vive dentro de esta caja, que es la que se abre y se cierra.
      +'<div id="multi-cuerpo-'+idx+'" style="display:'+(_abiertoEste?'block':'none')+'">';

    // --- El balance del barbero, SIEMPRE visible -aunque sea $0- ---
    // Siempre se muestra, incluso al dia: si dice $0.00 queda confirmado que no debe nada,
    // en vez de tener que acordarse o salir a buscarlo.
    // El balance REAL: deuda y credito por separado -no restados entre si- (24 jul,
    // pedido por Sensei: "yo decido cuando aplicarle su credito, no que se aplique solo").
    var debe = balances.total[String(p.cliente.id)] || 0;
    var creditoBarbero = p.cliente.creditoAFavor || 0;
    var facturasDebe = balances.detalle[String(p.cliente.id)] || [];
    var tieneCredito = creditoBarbero > 0.01;
    html += '<div onclick="toggleBalanceMulti('+idx+')" style="padding:7px 12px;background:'+(debe>0.01?'#FFF3F3':(tieneCredito?'#FFF3E0':'#F1F8F2'))+';border-bottom:0.5px solid #f0f0f3;cursor:'+(debe>0.01?'pointer':'default')+';display:flex;align-items:center;gap:6px;flex-wrap:wrap">'
      +'<span style="font-size:11px;color:#999;font-weight:700">BALANCE</span>'
      +(debe>0.01 ? '<span style="font-size:14px;font-weight:800;color:var(--nbs-red-dark)">$'+fmtNum(debe)+'</span>' : '')
      +(tieneCredito ? '<span style="font-size:13px;font-weight:800;color:#E65100">💰 ($'+fmtNum(creditoBarbero)+') a favor</span>' : '')
      +(debe>0.01
         ? '<span style="font-size:11px;color:#999;margin-left:auto">'+facturasDebe.length+' factura(s) ▾</span>'
         : (tieneCredito ? '' : '<span style="font-size:11px;color:var(--nbs-green-text);margin-left:auto;font-weight:600">✓ al día</span>'))
      +'</div>';
    if(debe > 0.01){
      html += '<div id="multi-bal-detalle-'+idx+'" style="display:none;padding:8px 12px;background:#FFF8F8;border-bottom:0.5px solid #f0f0f3">';
      facturasDebe.forEach(function(f){
        html += '<div style="display:flex;justify-content:space-between;font-size:11px;padding:3px 0;color:#666">'
          +'<span>#'+escaparHtml(String(f.nf))+' · '+escaparHtml(String(f.fecha))+'</span>'
          +'<b style="color:var(--nbs-red-dark)">$'+fmtNum(f.saldo)+'</b>'
          +'</div>';
      });
      html += '</div>';
    }

    // --- Lo que suele comprar: MISMAS TARJETAS grandes y legibles que en un
    //     pedido normal (arreglado 23 jul, pedido por Sensei: "asi es que lo
    //     quiero donde quiera que toque pedidos rapido o hacer un pedido").
    //     Antes aqui salian como chips chiquitos, dificiles de leer y tocar.
    // SI YA LO GUARDO, LA TARJETA SE CIERRA. Solo queda la cabecera con el visto.
    // Sensei lo reporto: al darle a guardar en pedidos rapidos NO SE CERRABA.
    // Tenia razon: `_abierto` se escribia pero la pantalla nunca lo leia. -14 ago-
    if(p._guardado){
      html += '<div style="padding:11px 12px;background:var(--nbs-green-bg);'
        + 'display:flex;align-items:center;gap:8px">'
        +   '<span style="font-size:16px">\u2705</span>'
        +   '<div style="flex:1;min-width:0">'
        +     '<div style="font-size:12.5px;font-weight:900;color:var(--nbs-green-text)">Pedido guardado</div>'
        +     '<div style="font-size:10.5px;color:var(--nbs-muted)">Est\u00e1 en Pedidos Pendientes</div>'
        +   '</div>'
        +   '<button onclick="event.stopPropagation();reabrirBarberoMulti(' + idx + ')" '
        +     'style="background:#fff;border:1px solid var(--nbs-green-text);color:var(--nbs-green-text);'
        +     'border-radius:7px;padding:6px 10px;font-size:11px;font-weight:800;cursor:pointer">'
        +     '\u2795 Agregar m\u00e1s</button>'
        + '</div>';
      html += '</div>';                      // se cierra la caja que se abre y se cierra
      card.innerHTML = html;
      el.appendChild(card);
      return;
    }

    p._habituales = productosHabituales(p.cliente.id, ventasParaHabituales);

    // ⚡ LO QUE MÁS VENDES — la fila nueva del 12 ago. Sus datos dijeron que los
    // habituales del cliente solo aciertan el 20% de lo que va a pedir hoy; lo que
    // MÁS VENDE en general acierta mucho más. Se saltan los que ya están en el
    // pedido y los que ya salen en sus habituales, para no repetir botones.
    // 💰 SU BALANCE, debajo del nombre
    if(_debe > 0.005){
      html += '<div style="padding:8px 12px;background:var(--nbs-red-bg);'
        + 'display:flex;align-items:center;justify-content:space-between;gap:8px">'
        + '<span style="font-size:13px;font-weight:900;color:var(--nbs-red-text)">'
        +   '\ud83d\udcb0 Te debe $' + fmtNum(_debe) + '</span>'
        // 💵 COBRARLE SIN SALIR DE PEDIDOS RÁPIDOS. -15 ago-
        + '<button onclick="event.stopPropagation();cobrarDesdePedidos(' + _arg(p.cliente.id) + ')" '
        +   'style="background:#00695C;color:#fff;border:none;border-radius:8px;padding:8px 13px;'
        +   'font-size:12px;font-weight:800;cursor:pointer;flex-shrink:0">\ud83d\udcb5 Cobrarle</button>'
        + '</div>';
    } else {
      html += '<div style="padding:6px 12px;background:var(--nbs-green-bg)">'
        + '<span style="font-size:11.5px;font-weight:800;color:var(--nbs-green-text)">'
        +   '\u2705 No te debe nada</span></div>';
    }

    // 🚫🚪 SI HOY NO TE COMPRA — dos motivos MUY distintos. -16 ago-
    if(!p._guardado && !(p.items || []).length){
      html += '<div style="padding:7px 12px 2px;display:flex;gap:6px">'
        + '<button onclick="event.stopPropagation();marcarNoQuisoNada(' + idx + ')" '
        +   'style="flex:1;padding:9px 6px;background:#fff;border:1.5px solid #F9A825;'
        +   'color:#F57F17;border-radius:8px;font-size:11.5px;font-weight:800;cursor:pointer">'
        +   '\ud83d\udeab No quiso nada</button>'
        + '<button onclick="event.stopPropagation();marcarNoEstaba(' + idx + ')" '
        +   'style="flex:1;padding:9px 6px;background:#fff;border:1.5px solid #78909C;'
        +   'color:#455A64;border-radius:8px;font-size:11.5px;font-weight:800;cursor:pointer">'
        +   '\ud83d\udeaa No estaba</button>'
        + '</div>';
    }

    // ⚡ EL BOTÓN QUE ABRE LAS SUGERENCIAS. Así el cuadro no estorba. -15 ago-
    var _abierto = !!_sugerenciasAbiertas[idx];
    if(!p._guardado){
      var _cuantasSug = 0;
      try {
        _cuantasSug = masVendidos(8).filter(function(x){
          return !(p.items || []).some(function(it){ return String(it.pid) === String(x.prod.id); });
        }).slice(0, 6).length + (p._habituales || []).length;
      } catch(e){}
      if(_cuantasSug){
        html += '<div style="padding:8px 12px 2px">'
          + '<button onclick="event.stopPropagation();toggleSugerencias(' + idx + ')" '
          +   'style="width:100%;padding:10px;background:' + (_abierto ? '#37474F' : '#fff')
          +   ';color:' + (_abierto ? '#fff' : '#37474F')
          +   ';border:1.5px solid #90A4AE;border-radius:9px;font-size:12.5px;'
          +   'font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px">'
          +   '\u26a1 Sugerencias (' + _cuantasSug + ')'
          +   '<span style="font-size:10px">' + (_abierto ? '\u25b2' : '\u25bc') + '</span>'
          + '</button></div>';
      }
    }

    if(!p._guardado && _abierto){
      var _mv = masVendidos(8).filter(function(x){
        var yaEnPedido = (p.items || []).some(function(it){ return String(it.pid) === String(x.prod.id); });
        var yaEnHabituales = (p._habituales || []).some(function(h){ return String(h.prod.id) === String(x.prod.id); });
        return !yaEnPedido && !yaEnHabituales;
      }).slice(0, 6);
      if(_mv.length){
        html += '<div style="padding:9px 12px 2px">'
          + botonesRapidos('LO QUE M\u00c1S VENDES', '\u26a1', _mv, idx, '#1565C0')
          + '</div>';
      }
    }

    if(p._habituales.length && !p._guardado && _abierto){
      html += '<div style="padding:9px 12px 2px">'
        +'<div style="font-size:12px;font-weight:700;color:#37474F;margin-bottom:6px">\u26A1 LO QUE M\u00c1S COMPRA</div>'
        +'<div style="display:flex;flex-wrap:wrap;gap:8px">';
      p._habituales.forEach(function(h, hi){
        html += '<button onclick="agregarHabitualMulti('+idx+','+hi+')" '
          + 'style="flex:1;min-width:calc(50% - 4px);background:#F2F2F6;border:1.5px solid #C7C7D1;'
          + 'border-radius:10px;padding:10px 8px;cursor:pointer;text-align:left">'
          + '<div style="font-size:14px;font-weight:700;color:var(--nbs-ink);line-height:1.2">'+escaparHtml(h.prod.nombre)+'</div>'
          + '<div style="font-size:13px;font-weight:800;color:#2E7D32;margin-top:3px">$'+fmtNum(h.prod.precio)+' <span style="color:#999;font-weight:600">&middot; x'+h.veces+'</span></div>'
          + '</button>';
      });
      html += '</div></div>';
    }

    // --- Buscador propio de esta tarjeta ---
    html += '<div style="padding:9px 12px 4px">'
      +'<div style="display:flex;gap:6px;background:#F2F2F6;padding:7px;border-radius:13px;border:1px solid #DCDCE4">'
      +'<div class="busca-caja" style="border:2px solid #444">'
      +'<span style="font-size:15px;flex-shrink:0;opacity:0.75">🔍</span>'
      +'<input id="multi-buscar-'+idx+'" class="busca-fuerte" type="text" placeholder="Buscar producto..." onfocus="marcarBarberoActivo('+idx+')" oninput="filterPedMulti('+idx+', this.value)" onfocus="filterPedMulti('+idx+', this.value||\'\')">'
      +'</div>'
      +'<button id="multi-mic-'+idx+'" onclick="dictarBusquedaSimple(\'multi-buscar-'+idx+'\', \'multi-mic-'+idx+'\')" title="Dictar por voz" style="background:#5E35B1;color:white;border:none;border-radius:11px;width:46px;flex-shrink:0;cursor:pointer;font-size:18px;box-shadow:0 2px 5px rgba(94,53,177,0.35)">🎤</button>'
      +'<button onclick="toggleNuevoProdPed('+idx+')" title="Agregar producto nuevo al catálogo" style="background:#00838F;color:white;border:none;border-radius:11px;width:46px;flex-shrink:0;cursor:pointer;font-size:18px;box-shadow:0 2px 5px rgba(0,131,143,0.35)">📦</button>'
      +'</div>'
      +'<div id="multi-plist-'+idx+'" style="background:white;border:2px solid #C7C7D1;border-radius:11px;max-height:180px;overflow-y:auto;display:none;margin-top:7px;box-shadow:0 4px 12px rgba(0,0,0,0.12)"></div>';

    // --- Producto elegido + cantidad + boton de agregar ---
    if(prodSel){
      html += '<div style="display:flex;align-items:center;justify-content:space-between;background:#FFF8E1;border-radius:20px;padding:7px 12px;margin-top:6px">'
        +'<span style="font-size:12px;color:#F57F17;font-weight:600;flex:1;min-width:0">'+escaparHtml(prodSel.nombre)+' · $'+fmtNum(prodSel.precio)+'</span>'
        +'<button onclick="clearPedMulti('+idx+')" style="background:none;border:none;cursor:pointer;color:#F57F17;font-size:16px;flex-shrink:0">✕</button>'
        +'</div>'
        +'<div style="display:flex;align-items:center;gap:6px;margin-top:6px">'
        +'<button onclick="cambiarCantSelMulti('+idx+',-1)" style="width:34px;height:34px;background:var(--nbs-red-bg);color:var(--nbs-red-dark);border:none;border-radius:8px;cursor:pointer;font-size:17px;font-weight:700;line-height:1;flex-shrink:0">−</button>'
        +'<input id="multi-cant-'+idx+'" type="number" min="1" value="'+cantSel+'" oninput="pedMultiCant['+idx+']=parseInt(this.value)||1" style="width:46px;padding:7px 2px;border:0.5px solid #ddd;border-radius:6px;font-size:13px;text-align:center">'
        +'<button onclick="cambiarCantSelMulti('+idx+',1)" style="width:34px;height:34px;background:var(--nbs-green-bg);color:var(--nbs-green-text);border:none;border-radius:8px;cursor:pointer;font-size:17px;font-weight:700;line-height:1;flex-shrink:0">+</button>'
        +'<button onclick="addItemMulti('+idx+')" style="flex:1;padding:9px;background:#1a237e;color:white;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer">+ Agregar a '+escaparHtml(p.cliente.nombre)+'</button>'
        +'</div>';
    }
    html += '</div>';

    // --- Productos ya agregados a este barbero, editables aqui mismo ---
    html += '<div style="padding:4px 12px 12px">';
    if((p.items || []).length){
      (p.items || []).forEach(function(it, itIdx){
        var sub = it.cant * it.precio;
        html += '<div style="padding:8px;margin-top:6px;border:0.5px solid var(--nbs-line);border-radius:9px;background:#FCFCFD">'
          +'<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">'
          +'<input type="text" value="'+escaparHtml(it.nombre)+'" oninput="actualizarItemMulti('+idx+','+itIdx+',\'nombre\',this.value)" style="flex:1;min-width:0;border:0.5px solid #ddd;border-radius:6px;padding:6px 7px;font-size:12px;font-weight:600;color:var(--nbs-ink)">'
          +'<button onclick="quitarItemMulti('+idx+','+itIdx+')" style="background:var(--nbs-red-bg);color:var(--nbs-red-dark);border:none;border-radius:7px;width:30px;height:30px;cursor:pointer;font-size:13px;flex-shrink:0">✕</button>'
          +'</div>'
          +'<div style="display:flex;align-items:center;gap:6px">'
          +'<button onclick="cambiarCantItemMulti('+idx+','+itIdx+',-1)" style="width:32px;height:32px;background:var(--nbs-red-bg);color:var(--nbs-red-dark);border:none;border-radius:7px;cursor:pointer;font-size:16px;font-weight:700;line-height:1;flex-shrink:0">−</button>'
          +'<input id="multi-icant-'+idx+'-'+itIdx+'" type="number" min="1" value="'+it.cant+'" oninput="actualizarItemMulti('+idx+','+itIdx+',\'cant\',parseInt(this.value)||1)" style="width:42px;padding:6px 2px;border:0.5px solid #ddd;border-radius:6px;font-size:12px;text-align:center">'
          +'<button onclick="cambiarCantItemMulti('+idx+','+itIdx+',1)" style="width:32px;height:32px;background:var(--nbs-green-bg);color:var(--nbs-green-text);border:none;border-radius:7px;cursor:pointer;font-size:16px;font-weight:700;line-height:1;flex-shrink:0">+</button>'
          +'<div style="display:flex;align-items:center;gap:3px">'
          +'<span style="font-size:11px;color:#999">$</span>'
          +'<input type="text" inputmode="decimal" value="'+it.precio.toFixed(2)+'" onfocus="this.select()" oninput="formatoMoneda(this);actualizarItemMulti('+idx+','+itIdx+',\'precio\',dinero(this.value)||0)" style="width:62px;padding:6px 4px;border:0.5px solid #ddd;border-radius:6px;font-size:12px;text-align:center">'
          +'</div>'
          +'<span id="multi-isub-'+idx+'-'+itIdx+'" style="flex:1;text-align:right;font-size:13px;font-weight:700;color:var(--nbs-green-text)">$'+fmtNum(sub)+'</span>'
          +'</div>'
          +'</div>';
      });
    } else {
      html += '<div style="font-size:12px;color:#bbb;padding:6px 0;font-style:italic">Todavía no le has agregado nada</div>';
    }
    html += '</div>';

    // 💾 GUARDAR ESTE PEDIDO — uno por uno, sin esperar al final. Si ya se guardó,
    // sale el ✅ en vez del botón. -Sensei, 12 ago-
    if(p._guardado){
      html += '<div style="margin-top:9px;padding:10px;background:var(--nbs-green-bg);border-radius:9px;'
        + 'text-align:center;font-size:12.5px;font-weight:800;color:var(--nbs-green-text)">'
        + '\u2705 Ya guardado \u00b7 est\u00e1 en pedidos pendientes</div>';
    } else if((p.items || []).length){
      html += '<button onclick="event.stopPropagation();guardarUnPedidoMulti('+idx+')" '
        + 'style="width:100%;margin-top:9px;padding:12px;background:#2E7D32;color:#fff;border:none;'
        + 'border-radius:9px;font-size:13.5px;font-weight:900;cursor:pointer">'
        + '\ud83d\udcbe Guardar este pedido \u00b7 $'+fmtNum(totalBarbero)+'</button>';
    }

    html += '</div>';                        // se cierra la caja que se abre y se cierra
    card.innerHTML = html;
    el.appendChild(card);
  });

  var btnGuardar = document.getElementById('ped-multi-guardar');
  var conItems = pedidosMultiTemp.filter(function(p){ return (p.items || []).length > 0; }).length;
  if(conItems > 0){
    btnGuardar.textContent = '\u2713 Terminar con esta barber\u00eda'
      + (conItems > 0 ? '  \u00b7 guarda ' + conItems + ' m\u00e1s ($' + fmtNum(totalGeneral) + ')' : '');
    btnGuardar.style.opacity = '1';
  }
  guardarPedidoEnProceso(); // se guarda solo con cada cambio, para no perderlo si sales
}

// El buscador de cada tarjeta solo toca SU propia lista de resultados -no se vuelve a dibujar
// toda la pantalla-, para que no se pierda lo que estas escribiendo ni se cierre nada.
function _ventasReales(){
  return LS('nv', []).filter(function(v){
    if(v.cancelada) return false;
    return !esBalanceInicial(v);
  });
}

// ── 1. LOS CLIENTES QUE SE CALLARON ──
// Compraban seguido y llevan MÁS DEL DOBLE de su ritmo sin venir.
function guardarUnPedidoMulti(idx){
  var p = pedidosMultiTemp[idx];
  if(!p) return;
  if(!(p.items || []).length){
    avisoGrande('\u26a0\ufe0f Agr\u00e9gale al menos un producto a ' + nombreCl(p.cliente) + '.');
    return;
  }

  pedidos = LS('npedidos', []);
  pedidos.push({
    id: Date.now(),
    cid: p.cliente.id,
    nombre: nombreCl(p.cliente),
    barberia: p.barberia,
    items: (p.items || []).slice()
  });
  SS('npedidos', pedidos);

  // La visita queda apuntada YA: este compró. Y la ruta se marca sola. -14 ago-
  try {
    apuntarTodoDeLaVisita(p.cliente, true, {
      pedidoId: pedidos[pedidos.length - 1] ? pedidos[pedidos.length - 1].id : null,
      total: (p.items || []).reduce(function(a, it){ return a + ((it.cant||0) * (it.precio||0)); }, 0),
      productos: (p.items || []).map(function(it){
        return { nombre: String(it.nombre||'').slice(0,40), cant: it.cant||0, precio: it.precio||0 };
      }),
      nota: 'dej\u00f3 pedido', como: 'auto'
    });
  } catch(e){ registrarVisitaBarbero(p.cliente.id, true); }

  // Se marca como guardado y se cierra solo -Sensei lo pidio asi-. No se quita de la
  // lista para que él vea el ✅ y sepa que ese ya está listo.
  p._guardado = true;
  p._abierto = false;
  p.items = [];

  // El borrador se guarda solo con lo que de verdad quede pendiente
  try { guardarPedidoEnProceso(); } catch(e){}

  renderPedidosMultiples();
  avisoChico('\u2705 Pedido de ' + nombreCl(p.cliente) + ' guardado');
}

// Un aviso chico que no tapa la pantalla
function guardarTodosLosPedidosMultiples(){
  var conItems = pedidosMultiTemp.filter(function(p){ return (p.items || []).length > 0; });
  if(!conItems.length){ alert('Agrégale al menos un producto a alguno de los barberos.'); return; }
  pedidos = LS('npedidos', []);
  var ahora = Date.now();
  conItems.forEach(function(p, i){
    pedidos.push({
      id: ahora + i, // +i para que no se repita el id si se guardan en el mismo instante
      cid: p.cliente.id,
      nombre: nombreCl(p.cliente),
      barberia: p.barberia,
      items: (p.items || []).slice()
    });
    registrarVisitaBarbero(p.cliente.id, true);
  });
  SS('npedidos', pedidos);
  var cuantos = conItems.length;
  pedidosMultiTemp = [];
  pedMultiSel = {};
  pedMultiCant = {};
  olvidarPedidoEnProceso();
  document.getElementById('ped-multi-wrap').style.display = 'none';
  document.getElementById('ped-lista-wrap').style.display = 'block';
  renderBarberiasInicio(document.getElementById('ped-inicio-buscar') ? document.getElementById('ped-inicio-buscar').value : '');
  renderPedidosPendientes();
  renderAvisoPedidoEnProceso(); // que el aviso de 'pedido a medias' desaparezca
  var flash = document.createElement('div');
  flash.textContent = '✅ '+cuantos+' pedido(s) guardado(s)';
  flash.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#2E7D32;color:white;padding:12px 24px;border-radius:20px;font-size:14px;font-weight:700;z-index:9999';
  document.body.appendChild(flash);
  setTimeout(function(){ flash.remove(); }, 2500);
}

function cancelarPedidoMultiple(){
  var hayAlgo = pedidosMultiTemp.some(function(p){ return (p.items || []).length > 0; });
  if(hayAlgo && !confirm('¿Cancelar? Se perderá lo que le agregaste a los barberos.')) return;
  pedidosMultiTemp = [];
  pedMultiSel = {};
  pedMultiCant = {};
  document.getElementById('ped-multi-wrap').style.display = 'none';
  olvidarPedidoEnProceso();
  document.getElementById('ped-lista-wrap').style.display = 'block';
  renderBarberiasInicio(document.getElementById('ped-inicio-buscar') ? document.getElementById('ped-inicio-buscar').value : '');
}


// ═══════════════════════════════════════════════════════════════════
//  📥 RECOGER LOS PEDIDOS DEL BUZÓN  (17 sep 2026)
//
//  El catálogo deja los pedidos en `nbs_buzon_pedidos`. La app los recoge al abrirse,
//  los mete en `npedidos` —los mismos que él ya maneja— y los marca como recogidos
//  para no traerlos dos veces.
//
//  🔒 Va POR DETRÁS: si no hay internet o Firebase tarda, la app arranca igual.
// ═══════════════════════════════════════════════════════════════════


// ═══════════════════════════════════════════════════════════════════
//  🔔 EL AVISO DE PEDIDOS NUEVOS  (17 sep 2026)
//
//  Sensei: "quiero una ventana que se abra en la pantalla con la alerta y un sonido
//  fuerte que no sea desapercibido".
//
//  🔑 Sale UNA VEZ al abrir la app, si el buzón trajo pedidos nuevos.
// ═══════════════════════════════════════════════════════════════════

function avisarPedidosNuevos(cuantos){
  try {
    if(!cuantos) return;
    var peds = LS('npedidos', []).filter(function(p){ return p.nuevo; });
    if(!peds.length) return;

    var total = 0;
    peds.forEach(function(p){
      (p.items || []).forEach(function(it){
        total += (Number(it.cant) || 0) * (Number(it.precio) || 0);
      });
    });

    var ov = document.createElement('div');
    ov.id = 'aviso-pedidos-nuevos';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.8);z-index:100011;'
      + 'display:flex;align-items:center;justify-content:center;padding:15px';
    ov.innerHTML = '<div style="background:#fff;border-radius:16px;padding:20px;'
      +   'max-width:400px;width:100%;text-align:center">'
      + '<div style="font-size:46px;margin-bottom:5px">\ud83d\udd14</div>'
      + '<div style="font-size:18px;font-weight:900;color:#C62828;margin-bottom:12px">'
      +   '\u00a1TIENES ' + peds.length + ' PEDIDO' + (peds.length > 1 ? 'S' : '')
      +   ' NUEVO' + (peds.length > 1 ? 'S' : '') + '!</div>'
      + '<div style="background:#FFF3E0;border-radius:11px;padding:11px;margin-bottom:12px;'
      +   'text-align:left">'
      + peds.slice(0, 6).map(function(p){
          var t = (p.items || []).reduce(function(a, it){
            return a + ((Number(it.cant) || 0) * (Number(it.precio) || 0));
          }, 0);
          return '<div style="display:flex;justify-content:space-between;gap:8px;'
            + 'padding:4px 0;font-size:13px">'
            + '<span style="font-weight:800;min-width:0;overflow:hidden;'
            +   'text-overflow:ellipsis;white-space:nowrap">'
            +   escaparHtml(String(p.nombre || '')) + '</span>'
            + '<span style="font-weight:900;color:#0B7A3B;flex-shrink:0">$'
            +   fmtNum(t) + '</span></div>';
        }).join('')
      + (peds.length > 6
          ? '<div style="font-size:11.5px;color:#8A6D00;margin-top:4px">y '
            + (peds.length - 6) + ' m\u00e1s\u2026</div>' : '')
      + '</div>'
      + '<div style="font-size:16px;font-weight:900;margin-bottom:13px">TOTAL: $'
      +   fmtNum(total) + '</div>'
      + '<button onclick="cerrarAvisoPedidos();verLosGuardados()" '
      +   'style="width:100%;padding:15px;background:#C62828;color:#fff;border:none;'
      +   'border-radius:12px;font-size:15.5px;font-weight:900;cursor:pointer">'
      +   '\ud83d\udccb VER LOS PEDIDOS</button>'
      + '<button onclick="cerrarAvisoPedidos()" style="width:100%;padding:12px;'
      +   'margin-top:8px;background:#F0F0F2;color:#555;border:none;border-radius:10px;'
      +   'font-size:13px;font-weight:700;cursor:pointer">Ahora no</button>'
      + '</div>';
    document.body.appendChild(ov);

    // 🔊 Tres campanadas seguidas, para que no pase desapercibido
    try { sonarCampanaPedido(); } catch(e){}
    setTimeout(function(){ try { sonarCampanaPedido(); } catch(e){} }, 380);
    setTimeout(function(){ try { sonarCampanaPedido(); } catch(e){} }, 760);
    try { if(navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 300]); } catch(e){}
  } catch(e){ console.warn('no pude avisar:', e); }
}

function cerrarAvisoPedidos(){
  var ov = document.getElementById('aviso-pedidos-nuevos');
  if(ov) ov.remove();
}

function recogerPedidosDelBuzon(cuandoTermine){
  cuandoTermine = cuandoTermine || function(){};
  try {
    if(typeof fbDb === 'undefined' || !fbDb){ cuandoTermine(0); return; }

    fbDb.collection('nbs_buzon_pedidos')
      .where('recogido', '==', false)
      .get()
      .then(function(snap){
        if(snap.empty){ cuandoTermine(0); return; }

        var peds = LS('npedidos', []);
        var yaEstan = {};
        peds.forEach(function(p){ if(p.buzonId) yaEstan[p.buzonId] = true; });

        var nuevos = 0, marcar = [];
        snap.forEach(function(doc){
          if(yaEstan[doc.id]) return;     // ya lo tiene
          var d = doc.data() || {};
          if(!d.items || !d.items.length) return;

          peds.push({
            id: Date.now() + nuevos,
            buzonId: doc.id,              // 🔑 para no traerlo dos veces
            cid: d.cid,
            nombre: d.nombre || '',
            barberia: d.barberia || '',
            items: d.items,
            delCatalogo: true,
            nuevo: true,                  // 🔔 para el aviso
            cuando: d.cuando ? horaCortita(d.cuando) : ''
          });
          marcar.push(doc.ref);
          nuevos++;
        });

        if(!nuevos){ cuandoTermine(0); return; }

        SS('npedidos', peds);
        try { pedidos = LS('npedidos', []); } catch(e){}

        // Se marcan como recogidos para que no vuelvan a bajar
        marcar.forEach(function(ref){
          try { ref.update({ recogido: true }); } catch(e){}
        });

        try { pintarBarraGuardados(); } catch(e){}
        cuandoTermine(nuevos);
      })
      .catch(function(e){
        console.warn('no pude recoger del buzón:', e);
        cuandoTermine(0);
      });
  } catch(e){
    console.warn('el buzón falló:', e);
    cuandoTermine(0);
  }
}

// La hora, cortita, para enseñarla en la lista
function horaCortita(ms){
  try {
    var d = new Date(ms);
    var hoy = new Date();
    var esHoy = d.toDateString() === hoy.toDateString();
    var h = d.getHours(), m = d.getMinutes();
    var ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12; if(h === 0) h = 12;
    var hora = h + ':' + (m < 10 ? '0' : '') + m + ' ' + ampm;
    if(esHoy) return 'hoy ' + hora;
    var ayer = new Date(hoy.getTime() - 86400000);
    if(d.toDateString() === ayer.toDateString()) return 'ayer ' + hora;
    return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + hora;
  } catch(e){ return ''; }
}

function pintarBarraGuardados(){
  try {
    var barra = document.getElementById('barra-pedidos-guardados');
    if(!barra) return;
    var peds = LS('npedidos', []);
    if(!peds.length){ barra.style.display = 'none'; return; }

    var monto = 0;
    peds.forEach(function(p){
      (p.items || []).forEach(function(it){
        monto += (Number(it.cant) || 0) * (Number(it.precio) || 0);
      });
    });

    // Los nombres, agrupados por barbería para que quepan
    var porBarberia = {};
    peds.forEach(function(p){
      var b = p.barberia || 'Sin barbería';
      if(!porBarberia[b]) porBarberia[b] = [];
      var soloNombre = String(p.nombre || '').split(' ')[0];
      porBarberia[b].push(soloNombre);
    });
    var quienes = Object.keys(porBarberia).map(function(b){
      return b + ': ' + porBarberia[b].join(', ');
    }).join(' \u00b7 ');

    document.getElementById('bpg-titulo').textContent =
      '\ud83d\udccb TIENES ' + peds.length + ' PEDIDO' + (peds.length > 1 ? 'S' : '') + ' GUARDADO'
      + (peds.length > 1 ? 'S' : '');
    document.getElementById('bpg-quienes').textContent = quienes;
    document.getElementById('bpg-monto').textContent = '$' + fmtNum(monto);
    barra.style.display = 'block';
  } catch(e){ console.warn('no pude pintar la barra:', e); }
}

/**
 * 📋 Al tocar la barra: enseña los pedidos guardados sin salirse de lo que está
 * haciendo. Si está tomando un pedido, no lo pierde.
 */
function verLosGuardados(){
  pedidos = LS('npedidos', []);
  if(!pedidos.length) return;

  var ov = document.getElementById('guardados-overlay');
  if(!ov){
    ov = document.createElement('div');
    ov.id = 'guardados-overlay';
    document.body.appendChild(ov);
  }
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:100009;'
    + 'display:flex;align-items:center;justify-content:center;padding:13px';
  ov.onclick = function(e){ if(e.target === ov) cerrarGuardados(); };

  var monto = 0;
  pedidos.forEach(function(p){
    (p.items || []).forEach(function(it){
      monto += (Number(it.cant) || 0) * (Number(it.precio) || 0);
    });
  });

  ov.innerHTML = '<div style="background:#fff;border-radius:14px;padding:15px;'
    +   'max-width:430px;width:100%;max-height:90vh;overflow:auto">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;'
    +   'margin-bottom:11px">'
    +   '<div style="font-size:15px;font-weight:900;color:var(--nbs-ink)">'
    +     '\ud83d\udccb ' + pedidos.length + ' pedido(s) guardado(s)</div>'
    +   '<button onclick="cerrarGuardados()" style="background:#F0F0F2;border:none;'
    +     'border-radius:9px;width:32px;height:32px;font-size:15px;cursor:pointer">\u2715</button>'
    + '</div>'
    + '<div style="background:#E7F6ED;border-radius:9px;padding:9px;margin-bottom:11px;'
    +   'text-align:center;font-size:13.5px;font-weight:800;color:#0B7A3B">'
    +   'TOTAL: $' + fmtNum(monto) + '</div>'
    + pedidos.map(function(p, idx){
        var t = (p.items || []).reduce(function(a, it){
          return a + ((Number(it.cant) || 0) * (Number(it.precio) || 0));
        }, 0);
        return '<div style="background:#F6F7FB;border-radius:11px;padding:11px;'
          + 'margin-bottom:8px;border-left:4px solid var(--nbs-gold)">'
          + '<div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start">'
          +   '<div style="flex:1;min-width:0">'
          +     '<div style="font-size:14px;font-weight:900">'
          +       escaparHtml(p.nombre || '') + '</div>'
          +     (p.barberia
                ? '<div style="font-size:11.5px;color:var(--nbs-muted);font-weight:700">'
                  + '\ud83d\udccd ' + escaparHtml(p.barberia) + '</div>'
                : '')
          +     '<div style="font-size:11px;color:var(--nbs-muted);margin-top:2px">'
          +       ((p.items || []).length) + ' producto(s)</div>'
          +   '</div>'
          +   '<div style="font-size:15px;font-weight:900;color:#0B7A3B;flex-shrink:0">$'
          +     fmtNum(t) + '</div>'
          + '</div>'
          + '<div style="display:flex;gap:5px;margin-top:8px">'
          +   '<button onclick="cerrarGuardados();alCarritoPorId(' + _arg(String(p.id)) + ')" '
          +     'style="flex:1;padding:9px 4px;background:#0B7A3B;color:#fff;border:none;'
          +     'border-radius:8px;font-size:11.5px;font-weight:800;cursor:pointer">'
          +     '\ud83d\uded2 Al carrito</button>'
          +   '<button onclick="cerrarGuardados();editarPedidoPorId(' + _arg(String(p.id)) + ')" '
          +     'style="flex:1;padding:9px 4px;background:var(--nbs-gold-bg);'
          +     'color:var(--nbs-gold-dark);border:none;border-radius:8px;font-size:11.5px;'
          +     'font-weight:800;cursor:pointer">\u270f\ufe0f Cambiar</button>'
          +   '<button onclick="cerrarGuardados();borrarPedidoPorId(' + _arg(String(p.id)) + ')" '
          +     'style="padding:9px 10px;background:var(--nbs-red-bg);color:var(--nbs-red-text);'
          +     'border:none;border-radius:8px;font-size:11.5px;font-weight:800;'
          +     'cursor:pointer">\ud83d\uddd1\ufe0f</button>'
          + '</div></div>';
      }).join('')
    + '<button onclick="cerrarGuardados()" style="width:100%;padding:12px;margin-top:6px;'
    +   'background:#F0F0F2;color:#444;border:none;border-radius:10px;font-size:13px;'
    +   'font-weight:700;cursor:pointer">Seguir tomando pedidos</button>'
    + '</div>';
  ov.style.display = 'flex';
}

function cerrarGuardados(){
  var ov = document.getElementById('guardados-overlay');
  if(ov) ov.style.display = 'none';
}

function renderPedidosPendientes(){
  pedidos = LS('npedidos', []);
  try { pintarBarraGuardados(); } catch(e){}
  try { pintarBarraGuardados(); } catch(e){}
  var el = document.getElementById('ped-pendientes-wrap');
  if(!el) return;
  el.innerHTML = '';
  // El aviso de rescate va SIEMPRE, aunque la lista quede vacia: si se quitaron todos
  // es justo cuando mas falta hace poder devolverlos. -8 ago-
  var _avisoRes = '';
  try { _avisoRes = avisoRescatePedidos(); } catch(e){}
  if(_avisoRes) el.innerHTML = _avisoRes;
  if(!pedidos.length) return;

  el.innerHTML += '<div style="font-size:11px;font-weight:600;color:var(--nbs-gold-dark);letter-spacing:0.5px;text-transform:uppercase;padding:8px 0 6px;display:flex;align-items:center;gap:5px">⚡Pedidos pendientes ('+pedidos.length+')</div>';
  pedidos.forEach(function(p, idx){
    var totalItems = (p.items || []).reduce(function(s,it){ return s+it.cant; },0);
    var totalMonto = (p.items || []).reduce(function(s,it){ return s+(it.cant*it.precio); },0);
    var card = document.createElement('div');
    card.style.cssText = 'background:white;border-radius:12px;padding:14px;margin-bottom:8px;cursor:pointer;border:0.5px solid var(--nbs-line);box-shadow:var(--nbs-shadow-card);display:flex;justify-content:space-between;align-items:center';
    card.innerHTML = '<div>'
      +'<div style="font-size:18px;font-weight:900;color:var(--nbs-ink)">'+escaparHtml(p.nombre)+'</div>'
      +'<div style="font-size:12px;color:var(--nbs-muted)">'+(p.barberia||'')+'</div>'
      +'<div style="font-size:12px;color:var(--nbs-gold-dark);margin-top:2px;font-weight:500">'+(p.items || []).length+' producto(s) · $'+fmtNum(totalMonto)+'</div>'
      +'</div>'
      +'<div style="display:flex;gap:6px">'
      +'<button onclick="editarPedidoPorId('+_arg(String(p.id))+')" style="padding:8px 10px;background:var(--nbs-gold-bg);color:var(--nbs-gold-dark);border:none;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600">✏️</button>'
      +'<button onclick="alCarritoPorId('+_arg(String(p.id))+')" style="padding:8px 10px;background:var(--nbs-ink);color:white;border:none;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600">🛒</button>'
      +'<button onclick="borrarPedidoPorId('+_arg(String(p.id))+')" style="padding:8px 10px;background:var(--nbs-red-bg);color:var(--nbs-red-dark);border:none;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600">🗑️</button>'
      +'</div>';
    el.appendChild(card);
  });
}

function renderPedidos(){ renderBarberiasInicio(''); renderPedidosPendientes(); }

function iniciarNuevoPedido(){
  pedItemsTemp = [];
  pedidoEditandoIdx = null;
  pedBarberiaSel = null;
  pedBarberoCid = null;
  pedBarberoNombre = null;
  document.getElementById('ped-lista-wrap').style.display = 'none';
  document.getElementById('ped-form-wrap').style.display = 'none';
  document.getElementById('ped-barbero-wrap').style.display = 'none';
  document.getElementById('ped-barberia-wrap').style.display = 'block';
  document.getElementById('ped-barberia-buscar').value = '';
  renderBarberias('');
}

function borrarPedido(idx){
  pedidos = LS('npedidos', []);
  if(!pedidos[idx]) return;
  var nombre = pedidos[idx].nombre;
  if(!confirm('¿Borrar el pedido de '+nombre+'?')) return;
  pedidos.splice(idx, 1);
  SS('npedidos', pedidos);
  renderPedidosPendientes();
  renderBarberiasInicio(document.getElementById('ped-inicio-buscar') ? document.getElementById('ped-inicio-buscar').value : '');
}

// El botón de abajo dice LO QUE VA A HACER: si está editando un pedido ya guardado
// dice "Eliminar este pedido" y se pone rojo; si es uno nuevo, "Volver sin guardar".
// Sensei lo cazó porque decía "Cancelar" y no cancelaba nada. -13 ago-
function pintarBotonCancelarPedido(){
  var b = document.getElementById('btn-cancelar-pedido');
  if(!b) return;
  var editando = (pedidoEditandoIdx !== null && pedidoEditandoIdx !== undefined);
  if(editando){
    b.innerHTML = '\ud83d\uddd1\ufe0f Eliminar este pedido';
    b.style.background = '#C62828';
  } else {
    b.innerHTML = '\u2190 Volver sin guardar';
    b.style.background = '#546E7A';
  }
}

// Los botones de salir dicen LO QUE DE VERDAD HACEN, segun donde este:
//  · editando un pedido guardado → "Eliminar este pedido" (rojo)
//  · haciendo uno nuevo          → "Volver sin guardar"
// Sensei lo cazo probando: el boton decia cancelar y NO CANCELABA NADA. -14 ago-
function ponerTextoBotonesPedido(){
  var editando = (pedidoEditandoIdx !== null && pedidoEditandoIdx !== undefined);
  var arriba = document.getElementById('ped-btn-cancelar-arriba');
  var abajo  = document.getElementById('ped-btn-cancelar-abajo');
  var otro   = document.getElementById('btn-cancelar-pedido');
  if(arriba){
    arriba.textContent = editando ? '\ud83d\uddd1\ufe0f Eliminar' : '\u2715 Salir';
    arriba.style.color = editando ? '#B71C1C' : '#546E7A';
    arriba.style.background = editando ? '#FFEBEE' : '#f5f5f5';
  }
  [abajo, otro].forEach(function(b){
    if(!b) return;
    b.textContent = editando ? '\ud83d\uddd1\ufe0f Eliminar este pedido' : '\u2190 Volver sin guardar';
    b.style.background = editando ? '#B71C1C' : '#546E7A';
  });
}

function cancelarPedido(){
  // 🔴 ARREGLADO EL 14 AGO. Sensei: "hice una orden a un cliente y le di a cancelar este
  // pedido y se salio a donde aparecen los pedidos, PERO NO CANCELO NADA". Tenia razon:
  // solo limpiaba la pantalla. Y aclaro que esperaba: "era un pedido ya hecho, ya estaba
  // en el carrito para convertirlo a venta, y esperaba que DESAPARECIERA y que SE BORRARA
  // DEL CARRITO tambien".
  if(pedidoEditandoIdx !== null && pedidoEditandoIdx !== undefined){
    pedidos = LS('npedidos', []);
    var ped = pedidos[pedidoEditandoIdx];
    if(ped){
      var cuantos = (ped.items || []).length;
      var monto = (ped.items || []).reduce(function(s,it){ return s + ((it.cant||0) * (it.precio||0)); }, 0);
      if(!confirm('\u00bfEliminar el pedido de ' + (ped.nombre || 'este cliente') + '?\n\n'
          + cuantos + ' producto(s) \u00b7 $' + fmtNum(monto)
          + '\n\nVa a desaparecer del carrito. Esto NO se puede deshacer.')) return;
      pedidos.splice(pedidoEditandoIdx, 1);
      SS('npedidos', pedidos);
      _salirDelFormPedido();
      try { avisoChico('\ud83d\uddd1\ufe0f Pedido eliminado'); } catch(e){}
      return;
    }
  }
  if((pedItemsTemp || []).length){
    var totalNuevo = pedItemsTemp.reduce(function(s,it){ return s + ((it.cant||0) * (it.precio||0)); }, 0);
    if(!confirm('\u00bfSalir SIN GUARDAR este pedido?\n\n' + pedItemsTemp.length + ' producto(s) \u00b7 $'
        + fmtNum(totalNuevo) + '\n\nSe pierde lo que llevas escrito.')) return;
  }
  _salirDelFormPedido();
}

// Limpia el formulario y vuelve a la lista. Solo la pantalla: no toca datos.
function _salirDelFormPedido(){
  document.getElementById('ped-form-wrap').style.display = 'none';
  document.getElementById('ped-barberia-wrap').style.display = 'none';
  document.getElementById('ped-barbero-wrap').style.display = 'none';
  document.getElementById('ped-lista-wrap').style.display = 'block';
  pedItemsTemp = [];
  pedidoEditandoIdx = null;
  pedBarberiaSel = null;
  pedBarberoCid = null;
  pedBarberoNombre = null;
  try { olvidarPedidoEnProceso(); } catch(e){}
  renderBarberiasInicio('');
  renderPedidosPendientes();
  try { renderAvisoPedidoEnProceso(); } catch(e){}
  subirPantalla();
}

// Borra un pedido que YA estaba guardado en el carrito, preguntando antes.
function borrarPedidoDelCarrito(idx){
  pedidos = LS('npedidos', []);
  var p = pedidos[idx];
  if(!p){ salirDelFormularioPedido(); return; }
  var cuantos = (p.items || []).length;
  var monto = (p.items || []).reduce(function(s, it){
    return s + ((parseFloat(it.cant) || 0) * (parseFloat(it.precio) || 0));
  }, 0);
  var msg = '\u00bfEliminar el pedido de ' + (p.nombre || 'este cliente') + '?\n\n'
    + cuantos + ' producto(s) \u00b7 $' + fmtNum(monto)
    + '\n\nEsto lo saca del carrito y NO se puede deshacer.';
  if(!confirm(msg)) return;
  pedidos.splice(idx, 1);
  SS('npedidos', pedidos);
  salirDelFormularioPedido();
  try { avisoChico('\ud83d\uddd1\ufe0f Pedido de ' + (p.nombre || '') + ' eliminado'); } catch(e){}
}

// Solo cerrar el formulario y volver a la lista. No borra nada.
function salirDelFormularioPedido(){
  document.getElementById('ped-form-wrap').style.display = 'none';
  document.getElementById('ped-barberia-wrap').style.display = 'none';
  document.getElementById('ped-barbero-wrap').style.display = 'none';
  document.getElementById('ped-lista-wrap').style.display = 'block';
  pedItemsTemp = [];
  pedidoEditandoIdx = null;
  pedBarberiaSel = null;
  pedBarberoCid = null;
  pedBarberoNombre = null;
  renderBarberiasInicio('');
  renderPedidosPendientes();
  subirPantalla();
}


function dictarProductoPedido(){
  var ReconocedorVoz = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!ReconocedorVoz){
    alert('Tu navegador no tiene esta función disponible todavía. Prueba desde Chrome en tu teléfono.');
    return;
  }

  var btn = document.getElementById('btn-dictar-pedido');
  var wrap = document.getElementById('dictado-resultado-wrap');

  var reconocimiento = new ReconocedorVoz();
  reconocimiento.lang = 'es-US';
  reconocimiento.interimResults = false;
  reconocimiento.maxAlternatives = 1;

  btn.textContent = '🔴';
  btn.style.background = '#C62828';
  wrap.style.display = 'block';
  wrap.innerHTML = '<div style="font-size:13px;color:#5E35B1;font-weight:600">🎤 Escuchando... di algo como "dos máquinas Wahl"</div>';

  reconocimiento.onresult = function(evento){
    var texto = evento.results[0][0].transcript;
    procesarDictadoPedido(texto);
  };
  reconocimiento.onerror = function(evento){
    restaurarBotonDictado();
    if(evento.error === 'not-allowed'){
      wrap.innerHTML = '<div style="font-size:13px;color:#C62828">No se pudo usar el micrófono -revisa que le hayas dado permiso a la app en los ajustes de tu teléfono.</div>';
    } else if(evento.error === 'no-speech'){
      wrap.innerHTML = '<div style="font-size:13px;color:#C62828">No se escuchó nada. Intenta de nuevo, hablando cerca del teléfono.</div>';
    } else {
      wrap.innerHTML = '<div style="font-size:13px;color:#C62828">Hubo un problema escuchando. Intenta de nuevo.</div>';
    }
  };
  reconocimiento.onend = function(){ restaurarBotonDictado(); };

  function restaurarBotonDictado(){
    btn.textContent = '🎤';
    btn.style.background = '#5E35B1';
  }

  try { reconocimiento.start(); }
  catch(e){ restaurarBotonDictado(); alert('No se pudo iniciar el micrófono. Intenta de nuevo.'); }
}

function procesarDictadoPedido(textoOriginal){
  var wrap = document.getElementById('dictado-resultado-wrap');
  var texto = textoOriginal.toLowerCase().trim();
  var palabras = texto.split(/\s+/);

  // Buscar un numero -digito o palabra en español- al inicio de lo que se dijo
  var cantidad = 1;
  var primeraPalabra = palabras[0];
  if(/^\d+$/.test(primeraPalabra)){
    cantidad = parseInt(primeraPalabra);
    palabras.shift();
  } else if(NUMEROS_ESPANOL[primeraPalabra] !== undefined){
    cantidad = NUMEROS_ESPANOL[primeraPalabra];
    palabras.shift();
  }
  var textoProducto = palabras.join(' ').trim();

  if(!textoProducto){
    wrap.innerHTML = '<div style="font-size:13px;color:#C62828">No se entendió qué producto buscar. Escuché: "'+limpiarTexto(textoOriginal)+'"</div>';
    return;
  }

  loadProds();
  var candidatos = productos.filter(function(p){ return p.stock > 0; });
  // Busqueda lista: ignora acentos, el orden de las palabras no importa, y aguanta faltas de
  // ortografia -importante al dictar, porque el telefono no siempre escribe el nombre exacto-.
  var coincidencias = filtrarPorBusqueda(candidatos, textoProducto, function(p){ return p.nombre; });

  if(!coincidencias.length){
    wrap.innerHTML = '<div style="font-size:13px;color:#333">Escuché: <b>"'+limpiarTexto(textoOriginal)+'"</b></div>'
      + '<div style="font-size:12px;color:#C62828;margin-top:6px">No encontré ningún producto parecido a "'+limpiarTexto(textoProducto)+'". Intenta describirlo distinto, o búscalo escribiendo.</div>';
    return;
  }

  var mejor = coincidencias[0];
  wrap.innerHTML = '<div style="font-size:13px;color:#333">Escuché: <b>"'+limpiarTexto(textoOriginal)+'"</b></div>'
    + '<div style="background:white;border-radius:8px;padding:10px;margin-top:8px">'
    + '<div style="font-size:13px;font-weight:700">'+mejor.nombre+'</div>'
    + '<div style="font-size:12px;color:#777">Cantidad: '+cantidad+' · $'+fmtNum(mejor.precio)+' c/u · Stock: '+mejor.stock+'</div>'
    + '</div>'
    + '<div style="display:flex;gap:8px;margin-top:8px">'
    + '<button onclick="document.getElementById(\'dictado-resultado-wrap\').style.display=\'none\'" style="flex:1;padding:9px;background:#eee;color:#555;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">✕ No es esto</button>'
    + '<button onclick="confirmarDictadoPedido(\''+mejor.id+'\','+cantidad+')" style="flex:1;padding:9px;background:#2E7D32;color:white;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">✓ Agregar al pedido</button>'
    + '</div>';
}

function renderFavoritosPedido(){
  var cont = document.getElementById('ped-favoritos');
  if(!cont) return;
  var cid = pedBarberoCid;
  if(!cid){ cont.style.display='none'; cont.innerHTML=''; return; }
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
  loadProds();
  var botones = '';
  topPids.forEach(function(pid){
    var prod = productos.find(function(p){ return String(p.id)===String(pid); });
    if(!prod) return;
    var precio = obtenerPrecioParaCliente(cid, prod.id, prod.precio);
    botones += '<button onclick="agregarFavoritoPedido(\''+prod.id+'\')" '
      + 'style="flex:1;min-width:calc(50% - 4px);background:#FFF8E1;border:1.5px solid var(--nbs-gold);'
      + 'border-radius:10px;padding:10px 8px;cursor:pointer;text-align:left">'
      + '<div style="font-size:14px;font-weight:700;color:var(--nbs-ink);line-height:1.2">'+escaparHtml(prod.nombre)+'</div>'
      + '<div style="font-size:13px;font-weight:800;color:#2E7D32;margin-top:3px">$'+fmtNum(precio)+' <span style="color:#E65100">+ Agregar</span></div>'
      + '</button>';
  });
  if(!botones){ cont.style.display='none'; cont.innerHTML=''; return; }
  cont.innerHTML = '<div style="font-size:12px;font-weight:700;color:#E65100;margin-bottom:6px">\u26A1 LO QUE M\u00c1S COMPRA (toca para agregar)</div>'
    + '<div style="display:flex;flex-wrap:wrap;gap:8px">'+botones+'</div>'
    + '<button onclick="repetirUltimoPedido()" style="width:100%;margin-top:8px;background:#E8F5E9;border:1.5px solid #2E7D32;border-radius:10px;padding:11px;cursor:pointer;font-size:14px;font-weight:700;color:#2E7D32">\u21BB Repetir su \u00faltima compra</button>';
  cont.style.display='block';
}

// Agrega un favorito al pedido (reutiliza selPed que ya agrega al pedido con el precio del barbero).
function agregarFavoritoPedido(pid){
  if(typeof selPed === 'function'){ selPed(pid); }
}

// Repite la última compra del barbero en el pedido.
function repetirUltimoPedido(){
  var cid = pedBarberoCid;
  if(!cid){ alert('Primero elige el barbero.'); return; }
  var ventasCl = LS('nv', []).filter(function(v){ return String(v.cid)===String(cid) && (v.items||[]).length; });
  if(!ventasCl.length){ alert('Este barbero no tiene compras anteriores todavía.'); return; }
  ventasCl.sort(function(a,b){ return (b.id||0) - (a.id||0); });
  var ultima = ventasCl[0];
  loadProds();
  var agregados = 0;
  (ultima.items||[]).forEach(function(it){
    var prod = productos.find(function(p){ return String(p.id)===String(it.pid); });
    if(prod){
      var encontrado = false;
      var precioAUsar = obtenerPrecioParaCliente(cid, prod.id, prod.precio);
      for(var j=0;j<pedItemsTemp.length;j++){
        if(String(pedItemsTemp[j].pid)===String(prod.id)){ pedItemsTemp[j].cant += it.cant; encontrado=true; break; }
      }
      if(!encontrado) pedItemsTemp.push({ pid: prod.id, nombre: prod.nombre, cant: it.cant, precio: precioAUsar, costo: prod.costo });
      agregados++;
    }
  });
  if(agregados){ renderPedItems(); }
  else { alert('Los productos de la última compra ya no están en el catálogo.'); }
}

function irAPedidoCliente(id){
  clientes = LS('ncl', []);
  var cl = clientes.find(function(c){ return String(c.id) === String(id); });
  if(!cl) return;
  pedBarberoCid = cl.id;
  pedBarberoNombre = nombreCl(cl);
  pedBarberiaSel = cl.negocio||'';
  pedItemsTemp = [];
  pedidoEditandoIdx = null;
  ir('p-ped');
  setTimeout(function(){
    document.getElementById('ped-lista-wrap').style.display='none';
    document.getElementById('ped-barberia-wrap').style.display='none';
    document.getElementById('ped-barbero-wrap').style.display='none';
    document.getElementById('ped-form-wrap').style.display='block';
    document.getElementById('ped-barbero-actual').textContent = nombreCl(cl);
    document.getElementById('ped-barberia-actual').textContent = cl.negocio||'';
    renderPedItems();
    renderFavoritosPedido();
  }, 100);
}

function toggleNuevoProdVenta(){
  var w = document.getElementById('v-nuevo-prod-wrap');
  var visible = w.style.display !== 'none';
  w.style.display = visible ? 'none' : 'block';
  if(!visible){
    document.getElementById('vnp-marca').value = '';
    document.getElementById('vnp-nombre').value = '';
    document.getElementById('vnp-cat').value = '';
    document.getElementById('vnp-costo').value = '0.00';
    document.getElementById('vnp-precio').value = '0.00';
    document.getElementById('vnp-stock').value = '0';
  }
}

function guardarNuevoProdVenta(){
  loadProds();
  var marca = document.getElementById('vnp-marca').value.trim();
  if(!marca){ alert('La marca es requerida'); return; }
  var nombre = document.getElementById('vnp-nombre').value.trim();
  if(!nombre){ alert('El nombre del producto es requerido'); return; }
  var nombreCompleto = marca + ' ' + nombre;
  var cat = document.getElementById('vnp-cat').value.trim();
  var costo = dinero(document.getElementById('vnp-costo').value) || 0;
  var precio = dinero(document.getElementById('vnp-precio').value) || 0;
  var stock = parseInt(document.getElementById('vnp-stock').value) || 0;
  // -confirmacion redundante quitada, el boton ya es la confirmacion-
  var nuevoId = 'custom_' + Date.now();
  var nuevoProd = { id: nuevoId, marca: marca, nombreCorto: nombre, nombre: nombreCompleto, cat: cat, sku: '', costo: costo, precio: precio, stock: stock, min: 5 };
  productos.push(nuevoProd);
  SS('np', productos);
  selV(nuevoId);
  document.getElementById('vcant').value = 1;
  addIV();
  toggleNuevoProdVenta();
  alert('✅ "'+nombreCompleto+'" agregado al catálogo y a la venta.');
}

// Cual barbero de las tarjetas esta agregando un producto nuevo -null si es el pedido normal
// de un solo barbero-. Sin esto, el producto nuevo no sabria a quien agregarselo.
var barberoParaProdNuevo = null;

function savePedido(){
  if(!pedItemsTemp.length){ alert('Agrega al menos un producto'); return; }

  var cid = pedBarberoCid;
  var nombre = pedBarberoNombre;
  var barberia = pedBarberiaSel;

  if(pedidoEditandoIdx !== null){
    pedidos = LS('npedidos', []);
    var ped = pedidos[pedidoEditandoIdx];
    if(!cid) cid = ped.cid;
    if(!nombre) nombre = ped.nombre;
    if(!barberia) barberia = ped.barberia;
  }

  if(!nombre) nombre = 'Cliente general';
  var totalItems = pedItemsTemp.reduce(function(s,it){ return s+it.cant; },0);
  var totalMonto = pedItemsTemp.reduce(function(s,it){ return s+(it.cant*it.precio); },0);
  // -confirmacion redundante quitada, el boton de Guardar ya es la confirmacion-

  pedidos = LS('npedidos', []);
  if(pedidoEditandoIdx !== null && pedidos[pedidoEditandoIdx]){
    pedidos[pedidoEditandoIdx].cid = cid;
    pedidos[pedidoEditandoIdx].nombre = nombre;
    pedidos[pedidoEditandoIdx].barberia = barberia;
    pedidos[pedidoEditandoIdx].items = pedItemsTemp.slice();
  } else {
    pedidos.push({ id: Date.now(), cid: cid, nombre: nombre, barberia: barberia, items: pedItemsTemp.slice() });
    if(barberia) marcarLlegadaBarberia(barberia);   // reloj del recordatorio (23 jul)
  }
  SS('npedidos', pedidos);

  // Limpiar inmediatamente sin esperar
  pedItemsTemp = [];
  pedidoEditandoIdx = null;
  pedBarberiaSel = null;
  pedBarberoCid = null;
  pedBarberoNombre = null;
  document.getElementById('ped-form-wrap').style.display = 'none';
  document.getElementById('ped-barberia-wrap').style.display = 'none';
  document.getElementById('ped-barbero-wrap').style.display = 'none';
  document.getElementById('ped-lista-wrap').style.display = 'block';
  renderBarberiasInicio(document.getElementById('ped-inicio-buscar') ? document.getElementById('ped-inicio-buscar').value : '');
  renderPedidosPendientes();
  renderAvisoPedidoEnProceso(); // que el aviso de 'pedido a medias' desaparezca
  // Flash de confirmación sin bloquear la pantalla
  var flash = document.createElement('div');
  flash.textContent = '✅ Pedido de '+nombre+' guardado';
  flash.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#2E7D32;color:white;padding:12px 24px;border-radius:20px;font-size:14px;font-weight:700;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,0.2)';
  document.body.appendChild(flash);
  setTimeout(function(){ flash.style.opacity='0';flash.style.transition='opacity 0.5s';setTimeout(function(){ flash.remove(); },500); }, 2000);
}

// 🔑 LAS TRES PUERTAS SEGURAS -17 sep-. Reciben el ID del pedido, no su posición.
// La posición cambia en cuanto se guarda otro pedido; el id nunca.
function _posDelPedido(id){
  pedidos = LS('npedidos', []);
  return pedidos.findIndex(function(x){ return String(x.id) === String(id); });
}

function alCarritoPorId(id){
  var i = _posDelPedido(id);
  if(i < 0){ avisoGrande('Ese pedido ya no est\u00e1.'); return; }
  convertirPedidoAVenta(i);
}

function editarPedidoPorId(id){
  var i = _posDelPedido(id);
  if(i < 0){ avisoGrande('Ese pedido ya no est\u00e1.'); return; }
  editarPedido(i);
}

function borrarPedidoPorId(id){
  var i = _posDelPedido(id);
  if(i < 0){ avisoGrande('Ese pedido ya no est\u00e1.'); return; }
  borrarPedido(i);
}

function convertirPedidoAVenta(idx){
  // Al llegar desde un pedido: se pinta la franja del cliente y se ensenan los dos enlaces
  // chicos de abajo, que sustituyen a los botones grandes de antes.
  setTimeout(function(){
    try{ pintarAQuienLeVendo(); }catch(e){}
    try{
      var acc = document.getElementById('pedido-conv-acciones');
      if(acc) acc.style.display = 'flex';
    }catch(e){}
  }, 60);
  pedidos = LS('npedidos', []);
  var p = pedidos[idx];
  if(!p) return;
  loadProds();
  iV = (p.items || []).map(function(it){
    var prod = productos.find(function(x){ return String(x.id)===String(it.pid); });
    // El PRECIO siempre debe ser el que quedo guardado en el pedido -respetando cualquier
    // ajuste manual que se le haya hecho-, NUNCA se debe sobreescribir con el precio del catalogo.
    // El COSTO si conviene refrescarlo del catalogo, ya que no es algo que el usuario edite a mano.
    return { pid: it.pid, nombre: it.nombre, cant: it.cant, precio: it.precio, costo: prod?prod.costo:it.costo };
  });
  ir('p-v');
  // IMPORTANTE: el pedido NO se borra todavia -se queda guardado tal cual- hasta que la venta
  // se complete de verdad en saveV(). Asi, si el usuario cancela o algo interrumpe el proceso,
  // el pedido sigue intacto en Pedidos Pendientes, sin perder nada.
  window._vendiendoDesde = { tipo:'pedido', pedidoId: p.id };
  if(p.cid) document.getElementById('vcl').value = p.cid;
  renderIV();
  var btnCancelarConv = document.getElementById('btn-cancelar-conversion-pedido');
  if(btnCancelarConv) btnCancelarConv.style.display = 'block';
  var btnBorrarConv3 = document.getElementById('btn-borrar-pedido-conversion');
  if(btnBorrarConv3) btnBorrarConv3.style.display = 'block';
}


// ═══════════════════════════════════════════════════════════════════
//  🗑️ EL CLIENTE YA NO QUIERE SU PEDIDO  (14 ago 2026)
//
//  Sensei: "lo que quiero es que haya un botón para cancelar ese
//  pedido, porque el cliente puede cambiar de opinión y no querer su
//  pedido".
//
//  ⚠️ SON DOS COSAS DISTINTAS y por eso son DOS BOTONES:
//    ✕ Cancelar y volver  → el pedido se QUEDA. Solo salgo de aquí.
//    🗑️ Ya no lo quiere    → el pedido SE BORRA del carrito.
// ═══════════════════════════════════════════════════════════════════
function borrarPedidoQueSeEstaConvirtiendo(){
  var desde = window._vendiendoDesde;
  if(!desde || desde.tipo !== 'pedido' || desde.pedidoId === undefined){
    avisoGrande('\u26a0\ufe0f Aqu\u00ed no hay ning\u00fan pedido pendiente que borrar.');
    return;
  }
  pedidos = LS('npedidos', []);
  var idx = -1;
  for(var i = 0; i < pedidos.length; i++){
    if(String(pedidos[i].id) === String(desde.pedidoId)){ idx = i; break; }
  }
  if(idx < 0){
    avisoGrande('\u26a0\ufe0f Ese pedido ya no est\u00e1 en la lista.');
    return;
  }
  var ped = pedidos[idx];
  var cuantos = (ped.items || []).length;
  var monto = (ped.items || []).reduce(function(a, it){ return a + ((it.cant||0) * (it.precio||0)); }, 0);

  if(!confirm('\u00bfBorrar el pedido de ' + (ped.nombre || 'este cliente') + '?\n\n'
      + cuantos + ' producto(s) \u00b7 $' + fmtNum(monto)
      + '\n\nVa a DESAPARECER de Pedidos Pendientes.\nEsto NO se puede deshacer.')) return;

  pedidos.splice(idx, 1);
  SS('npedidos', pedidos);

  // Limpiar la venta que estaba a medias
  iV = [];
  renderIV();
  window._vendiendoDesde = null;
  var b1 = document.getElementById('btn-cancelar-conversion-pedido');
  if(b1) b1.style.display = 'none';
  var b2 = document.getElementById('btn-borrar-pedido-conversion');
  if(b2) b2.style.display = 'none';
  try { renderPedidosPendientes(); } catch(e){}
  ir('p-ped');
  try { avisoChico('\ud83d\uddd1\ufe0f Pedido borrado'); } catch(e){ }
}

function cancelarConversionPedido(){
  ocultarAccionesDeConversion();
  if(!confirm('¿Cancelar esto y volver a Pedidos Pendientes?\n\nEl pedido sigue guardado tal cual, no se pierde nada.')) return;
  iV = [];
  renderIV();
  window._vendiendoDesde = null;
  var btnCancelarConv = document.getElementById('btn-cancelar-conversion-pedido');
  if(btnCancelarConv) btnCancelarConv.style.display = 'none';
  var btnBorrarConv4 = document.getElementById('btn-borrar-pedido-conversion');
  if(btnBorrarConv4) btnBorrarConv4.style.display = 'none';
  ir('p-ped');
}

// ===== PROGRAMA DE FIDELIDAD GENERAL (independiente de VIP) =====
// Suma todas las compras de productos menores a $30, desde el ultimo regalo dado.
// Meta: $400. Al llegar, se puede registrar un regalo y el ciclo empieza de nuevo desde 0.
function _renglonPedidos(K){
  if(!K.pedidos.length) return '';
  var monto = K.pedidos.reduce(function(a, p){
    return a + (p.items || []).reduce(function(x, it){ return x + ((it.cant||0) * (it.precio||0)); }, 0);
  }, 0);
  var cont = _sub(
    K.pedidos.map(function(p, i){
      var t = (p.items || []).reduce(function(x, it){ return x + ((it.cant||0) * (it.precio||0)); }, 0);
      return '<div style="padding:9px 0;border-bottom:1px solid #F4F4F8">'
        + '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px">'
        +   '<span style="font-size:12.5px;font-weight:800;color:var(--nbs-ink)">'
        +     ((p.items || []).length) + ' producto(s)</span>'
        +   '<span style="font-size:13px;font-weight:900;color:var(--nbs-gold-dark)">$' + fmtNum(t) + '</span>'
        + '</div>'
        + '<div style="margin-top:4px">'
        +   (p.items || []).slice(0, 6).map(function(it){
              return '<div style="font-size:11px;color:var(--nbs-ink)">\u00b7 '
                + (it.cant || 0) + ' \u00d7 ' + escaparHtml(String(it.nombre || '').slice(0, 30)) + '</div>';
            }).join('')
        + '</div>'
        + '<button onclick="event.stopPropagation();ir(\'p-ped\')" '
        +   'style="width:100%;margin-top:7px;padding:8px;background:var(--nbs-gold);color:#fff;'
        +   'border:none;border-radius:8px;font-size:11.5px;font-weight:800;cursor:pointer">'
        +   '\u26a1 Ir a Pedidos Pendientes</button>'
        + '</div>';
    }).join('')
  );
  return _filaPanel('pedidos', '\u26a1', 'Sus pedidos pendientes',
    String(K.pedidos.length) + ' \u00b7 $' + fmtNum(monto), null, cont);
}

// ── 💰 CRÉDITO A FAVOR, editable ──
function exportarCatalogoParaPedidos(){
  loadProds();
  var catalogoParaExportar = productos
    .filter(function(p){ return p.stock > 0; })
    .map(function(p){ return { n: p.nombre, c: p.cat||'Otros', p: p.precio }; });

  var codigoAcceso = prompt('Elige un código de acceso simple para esta página -tus clientes lo van a necesitar antes de ver el catálogo, para que no cualquiera que consiga el enlace pueda verlo. Ejemplo: NBS2026, o el nombre de tu negocio.');
  if(codigoAcceso === null) return; // cancelo
  codigoAcceso = codigoAcceso.trim();
  if(!codigoAcceso){ alert('Tienes que escribir un código -no puede quedar vacío.'); return; }

  if(!confirm('Esto va a generar un archivo -pagina.html- con tu catalogo actual -'+catalogoParaExportar.length+' productos con stock- para que tus clientes puedan armar su pedido y enviartelo por mensaje de texto.\n\nEl código de acceso va a ser: '+codigoAcceso+'\n\nDespues de descargarlo, tienes que subirlo a tu sitio -junto a app.html-, y esa es la direccion que le compartes a tus clientes -junto con el código-.\n\n¿Continuar?')) return;

  var telefono = '4013050188';
  var datosJSON = JSON.stringify(catalogoParaExportar);
  var codigoJSON = JSON.stringify(codigoAcceso.toUpperCase());

  var html = '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">'
    + '<meta name="viewport" content="width=device-width, initial-scale=1.0">'
    + '<title>Hacer un Pedido - Nunez Beauty Supply</title>'
    + '<style>'
    + 'body{font-family:sans-serif;background:#f5f5f7;margin:0;padding:16px;color:#14141F}'
    + '.wrap{max-width:480px;margin:0 auto}'
    + 'h1{font-size:20px;color:#1a237e;text-align:center;margin-bottom:4px}'
    + '.sub{text-align:center;color:#777;font-size:13px;margin-bottom:16px}'
    + 'input[type=text]{width:100%;padding:12px;border:1px solid #ddd;border-radius:8px;font-size:14px;box-sizing:border-box;margin-bottom:10px}'
    + '.cat{font-size:12px;color:#B8860B;font-weight:700;text-transform:uppercase;margin:16px 0 8px}'
    + '.prod{background:white;border-radius:10px;padding:10px 12px;margin-bottom:6px;display:flex;align-items:center;gap:10px;box-shadow:0 1px 3px rgba(0,0,0,0.08)}'
    + '.prod .info{flex:1}'
    + '.prod .nom{font-size:13px;font-weight:600}'
    + '.prod .prec{font-size:12px;color:#2E7D32;font-weight:700}'
    + '.qtybox{display:flex;align-items:center;gap:6px}'
    + '.qtybox button{width:30px;height:30px;border:none;border-radius:6px;background:#eee;font-size:16px;cursor:pointer}'
    + '.qtybox span{width:20px;text-align:center;font-weight:700}'
    + '#resumen{position:sticky;bottom:0;background:white;border-radius:12px 12px 0 0;box-shadow:0 -2px 10px rgba(0,0,0,0.1);padding:14px;margin-top:20px}'
    + '#btnEnviar{width:100%;padding:14px;background:#25D366;color:white;border:none;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;margin-top:8px}'
    + '#btnEnviar:disabled{background:#ccc}'
    + '#btnEnviarSMS{width:100%;padding:11px;background:white;color:#1565C0;border:1px solid #90CAF9;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;margin-top:8px}'
    + '#btnEnviarSMS:disabled{color:#ccc;border-color:#eee}'
    + '#pantallaCodigo{max-width:340px;margin:80px auto 0;text-align:center}'
    + '#pantallaCodigo input{text-align:center;font-size:18px;letter-spacing:2px;text-transform:uppercase}'
    + '#btnEntrar{width:100%;padding:14px;background:#1a237e;color:white;border:none;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;margin-top:8px}'
    + '#errorCodigo{color:#C62828;font-size:13px;margin-top:8px;display:none}'
    + '#contenidoPedido{display:none}'
    + '</style></head><body>'
    + '<div id="pantallaCodigo">'
    + '<div style="font-size:40px;margin-bottom:10px">🔒</div>'
    + '<h1>Código de Acceso</h1>'
    + '<div class="sub">Pídele el código a Nunez Beauty Supply para ver el catálogo</div>'
    + '<input type="text" id="inputCodigo" placeholder="Código" maxlength="20">'
    + '<button id="btnEntrar" onclick="verificarCodigo()">Entrar</button>'
    + '<div id="errorCodigo">Código incorrecto, intenta de nuevo.</div>'
    + '</div>'
    + '<div class="wrap" id="contenidoPedido">'
    + '<h1>🛒 Hacer un Pedido</h1>'
    + '<div class="sub">Nunez Beauty Supply</div>'
    + '<input type="text" id="nombreCliente" placeholder="Tu nombre y negocio -ej: Julio, Barberia Julio-">'
    + '<input type="text" id="buscarProd" placeholder="Buscar producto...">'
    + '<div id="listaProductos"></div>'
    + '<div id="resumen">'
    + '<div style="display:flex;justify-content:space-between;font-size:14px;font-weight:700"><span>Total del pedido</span><span id="totalPedido">$0.00</span></div>'
    + '<button id="btnEnviar" disabled onclick="enviarPorWhatsApp()">💬 Enviar mi pedido por WhatsApp</button>'
    + '<button id="btnEnviarSMS" disabled onclick="enviarPorSMS()">✉️ O enviarlo por mensaje de texto</button>'
    + '</div>'
    + '</div>'
    + '<script>'
    + 'var CATALOGO = ' + datosJSON + ';'
    + 'var TELEFONO_NEGOCIO = "' + telefono + '";'
    + 'var cantidades = {};'
    + 'function fmt(n){ return "$"+n.toFixed(2); }'
    + 'function renderLista(filtro){'
    + '  filtro = (filtro||"").toLowerCase();'
    + '  var el = document.getElementById("listaProductos"); el.innerHTML = "";'
    + '  var porCategoria = {};'
    + '  CATALOGO.forEach(function(p,i){'
    + '    if(filtro && p.n.toLowerCase().indexOf(filtro)<0) return;'
    + '    if(!porCategoria[p.c]) porCategoria[p.c] = [];'
    + '    porCategoria[p.c].push({p:p, idx:i});'
    + '  });'
    + '  Object.keys(porCategoria).sort().forEach(function(cat){'
    + '    var catDiv = document.createElement("div"); catDiv.className="cat"; catDiv.textContent = cat;'
    + '    el.appendChild(catDiv);'
    + '    porCategoria[cat].forEach(function(item){'
    + '      var row = document.createElement("div"); row.className="prod";'
    + '      row.innerHTML = "<div class=\\"info\\"><div class=\\"nom\\">"+item.p.n+"</div><div class=\\"prec\\">"+fmt(item.p.p)+"</div></div>"'
    + '        +"<div class=\\"qtybox\\"><button onclick=\\"cambiarCant("+item.idx+",-1)\\">-</button><span id=\\"cant-"+item.idx+"\\">"+(cantidades[item.idx]||0)+"</span><button onclick=\\"cambiarCant("+item.idx+",1)\\">+</button></div>";'
    + '      el.appendChild(row);'
    + '    });'
    + '  });'
    + '}'
    + 'function cambiarCant(i, delta){'
    + '  cantidades[i] = Math.max(0, (cantidades[i]||0)+delta);'
    + '  document.getElementById("cant-"+i).textContent = cantidades[i];'
    + '  actualizarTotal();'
    + '}'
    + 'function actualizarTotal(){'
    + '  var total = 0, hayAlgo = false;'
    + '  Object.keys(cantidades).forEach(function(i){ if(cantidades[i]>0){ total += cantidades[i]*CATALOGO[i].p; hayAlgo = true; } });'
    + '  document.getElementById("totalPedido").textContent = fmt(total);'
    + '  document.getElementById("btnEnviar").disabled = !hayAlgo;'
    + '  document.getElementById("btnEnviarSMS").disabled = !hayAlgo;'
    + '}'
    + 'function construirMensajePedido(){'
    + '  var nombre = document.getElementById("nombreCliente").value.trim() || "Cliente sin nombre";'
    + '  var lineas = ["Pedido de "+nombre+":"];'
    + '  Object.keys(cantidades).forEach(function(i){'
    + '    if(cantidades[i]>0){ lineas.push("- "+CATALOGO[i].n+" x"+cantidades[i]); }'
    + '  });'
    + '  var total = 0;'
    + '  Object.keys(cantidades).forEach(function(i){ if(cantidades[i]>0){ total += cantidades[i]*CATALOGO[i].p; } });'
    + '  lineas.push("Total aprox: "+fmt(total));'
    + '  return lineas.join("\\n");'
    + '}'
    + 'function enviarPorWhatsApp(){'
    + '  var mensaje = encodeURIComponent(construirMensajePedido());'
    + '  window.location.href = "https://wa.me/1"+TELEFONO_NEGOCIO+"?text="+mensaje;'
    + '}'
    + 'function enviarPorSMS(){'
    + '  var mensaje = encodeURIComponent(construirMensajePedido());'
    + '  window.location.href = "sms:"+TELEFONO_NEGOCIO+"?body="+mensaje;'
    + '}'
    + 'document.getElementById("buscarProd").addEventListener("input", function(){ renderLista(this.value); });'
    + 'var CODIGO_CORRECTO = ' + codigoJSON + ';'
    + 'function mostrarCatalogo(){'
    + '  document.getElementById("pantallaCodigo").style.display = "none";'
    + '  document.getElementById("contenidoPedido").style.display = "block";'
    + '  renderLista("");'
    + '}'
    + 'function verificarCodigo(){'
    + '  var val = document.getElementById("inputCodigo").value.trim().toUpperCase();'
    + '  if(val === CODIGO_CORRECTO){'
    + '    sessionStorage.setItem("codigoOk", "1");'
    + '    mostrarCatalogo();'
    + '  } else {'
    + '    document.getElementById("errorCodigo").style.display = "block";'
    + '  }'
    + '}'
    + 'document.getElementById("inputCodigo").addEventListener("keypress", function(e){ if(e.key==="Enter") verificarCodigo(); });'
    + 'if(sessionStorage.getItem("codigoOk") === "1"){ mostrarCatalogo(); }'
    + '<\/script></body></html>';

  var blob = new Blob([html], {type:'text/html'});
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'pedido.html';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  alert('✅ Archivo "pedido.html" descargado.\n\nSubelo a tu sitio -junto a app.html, en la misma carpeta de GitHub- y comparte esa direccion con tus clientes -por ejemplo: tu-sitio.github.io/pedido.html-.');
}

function limpiarVentasHuerfanas(){
  clientes = LS('ncl', []);
  ventas = LS('nv', []);
  var idsClientes = clientes.map(function(c){ return String(c.id); });

  // Primero MIRAR, sin tocar nada
  var aBorrar = ventas.filter(function(v){
    if(!v.cid) return false;                      // cliente general: nunca se toca
    return !idsClientes.includes(String(v.cid));
  });

  if(!aBorrar.length){
    avisoGrande('✓ No hay ventas de clientes borrados.\n\nNo hay nada que limpiar.');
    return;
  }

  var monto = aBorrar.reduce(function(a, v){ return a + (parseFloat(v.total) || 0); }, 0);
  var conDeuda = aBorrar.filter(function(v){ return v.tipo === 'credito' && !v.cancelada; }).length;

  var msg = '⚠️ Se van a BORRAR ' + aBorrar.length + ' venta(s) de clientes que ya no existen.\n\n'
          + 'Suman $' + fmtNum(monto) + '.\n';
  if(conDeuda) msg += '\nDe esas, ' + conDeuda + ' son a CRÉDITO y todavía aparecen como deuda.\n';
  msg += '\nEsto NO se puede deshacer.\n\n¿Seguro que quieres borrarlas?';

  if(!confirm(msg)) return;

  protegerConHuella(function(){
    var ventasAhora = LS('nv', []);
    var quedan = ventasAhora.filter(function(v){
      if(!v.cid) return true;
      return idsClientes.includes(String(v.cid));
    });
    var eliminadas = ventasAhora.length - quedan.length;
    ventas = quedan;
    SS('nv', ventas);
    avisoGrande('🗑️ Se borraron ' + eliminadas + ' venta(s) de clientes eliminados.\n\nSumaban $' + fmtNum(monto) + '.');
  });
}

function ventaEnRango(v, desde, hasta){
  var f = parsearFechaVenta(v.fecha);
  return f && f >= desde && f <= hasta;
}

// ═══════════════════════════════════════════════════════════════════════════
//  MIS DOCUMENTOS  (19 jul 2026, pedido por Sensei)
//  Lista de documentos que se abren desde la misma carpeta de la app (GitHub).
//  Para agregar un documento nuevo: súbelo a GitHub junto a la app y añádelo aquí.
// ═══════════════════════════════════════════════════════════════════════════
var DOCUMENTOS_NBS = [
  { archivo: 'Recuento_Cambios_NBS_20jul2026.pdf', titulo: 'Recuento 20 Julio', desc: 'Todo lo hecho hoy: respaldos, reportes, app instalable', color: '#1a237e' },
  { archivo: 'Programa_de_Ofertas_NBS.pdf', titulo: 'Programa de Ofertas', desc: 'Cómo vender más sin perder ganancia', color: '#2E7D32' },
  { archivo: 'Como_Ganar_Lealtad_Clientes_NBS.pdf', titulo: 'Cómo Ganar la Lealtad', desc: 'Metodologías para retener clientes', color: '#1a237e' },
  { archivo: 'NBS_Guia_Finanzas_y_Contabilidad.pdf', titulo: 'Finanzas y Contabilidad', desc: 'Cómo llevar el dinero de tu negocio con claridad', color: '#2E7D32' },
  { archivo: 'NBS_Guia_Precios_y_Margenes.pdf', titulo: 'Precios y Márgenes', desc: 'Cómo poner precios que te dejen ganancia', color: '#1565C0' },
  { archivo: 'NBS2_Manual_de_Usuario_v8.pdf', titulo: 'Manual de Usuario', desc: 'Guía completa de la app — Versión 8.0, con seguridad y modo sin internet', color: '#1a237e' },
  { archivo: 'Registro_de_Cambios_NBS.pdf', titulo: 'Registro de Cambios', desc: 'Todas las mejoras de las últimas 2 semanas', color: '#E65100' }
];

// ═══════════════════════════════════════════════════════════════
//  NBS ACADEMIA - lecciones de negocio en AUDIO
//  Pedida por Sensei (21 jul 2026): escuchar mientras trabaja la ruta.
//  La voz del telefono lee las lecciones. Mantiene la pantalla encendida
//  con Wake Lock para que el audio no se corte. Avanza sola de una
//  leccion a la otra, como un podcast.
// ═══════════════════════════════════════════════════════════════

var ACA_LECCIONES = [

{ titulo: "Ganancia no es lo mismo que ingreso", texto:
"Bienvenido a tu primera lección. Vamos a empezar con el error más común en los negocios, y entenderlo te va a cambiar la forma de ver tu dinero. Muchos dueños ven entrar mil dólares en el día y piensan: gané mil dólares. Pero eso no es verdad. Ese dinero que entra se llama ingreso, y de ahí todavía tienes que pagar muchas cosas. Piénsalo así: si vendiste mil dólares, pero el producto que vendiste te costó seiscientos, y gastaste cincuenta en gasolina de la ruta, entonces tu ganancia real no es mil. Es mil, menos seiscientos, menos cincuenta. O sea, trescientos cincuenta dólares. Esa es tu ganancia de verdad. El resto nunca fue tuyo: era para reponer el producto y cubrir tus gastos. Por eso, graba esta regla de oro: el dinero que entra no es tuyo hasta que le descuentas lo que costó ganarlo. El número que de verdad importa se llama ganancia neta. Es lo que te queda después de pagar el producto y todos tus gastos. Ese es el número que debes vivir mirando. No te emociones con lo que vendes; emociónate con lo que te queda. En las próximas lecciones vamos a ver cómo hacer que tu ganancia neta sea cada vez más grande. Nos vemos en la siguiente." },

{ titulo: "Precios y márgenes: cómo cobrar bien", texto:
"En esta lección vas a aprender a poner precios que te dejen ganancia de verdad. Primero, dos palabras que se confunden todo el tiempo: margen y markup. El margen es qué parte de tu precio de venta es ganancia. El markup es cuánto le sumas encima a tu costo. Un ejemplo: te costó seis dólares y lo vendes en diez. Ganas cuatro. Ese cuatro, dividido entre el precio de diez, es cuarenta por ciento de margen. El mismo cuatro, dividido entre el costo de seis, es casi sesenta y siete por ciento de markup. Es el mismo dinero, pero se ve distinto. Para tu negocio, guíate por el margen. Ahora, la fórmula para sacar tu precio es simple: precio igual a costo, dividido entre uno menos el margen que quieres. Si te costó seis y quieres cuarenta por ciento, divides seis entre cero punto seis, y te da diez dólares. Y aquí va lo importante: no todos los productos dan el mismo margen. Las máquinas y clippers son caras y muy competidas, así que dan poco margen, entre veinte y treinta y cinco por ciento. Pero los líquidos, como shampoo, colonia y gel, son consumibles, se acaban y se vuelven a comprar, y ahí puedes ganar entre cuarenta y sesenta por ciento. La estrategia es esta: la máquina es el gancho para atraer al cliente, y ganas de verdad en lo que se lleva con ella. Recuerda: el precio correcto no es el más barato, es el que te deja ganancia y el cliente paga con gusto." },

{ titulo: "Cómo ganar la lealtad de tus barberías", texto:
"Tu ventaja más grande es algo que ningún competidor por internet puede copiar: tú ves a tus barberías en persona, cara a cara, todos los días. Usa eso. La primera clave es conocerlos de verdad. Aprende el nombre del dueño y de los barberos. Recuerda qué producto usa cada barbería y cuál prefiere. La gente quiere sentirse tratada como persona, no como un número. La segunda clave es ser rápido y confiable. Si dices que llegas el martes, llega el martes. Nunca les falles con un producto que necesitan. Si hay un problema, resuélvelo rápido. La mayoría de los clientes se van cuando su proveedor les falla. La tercera clave es crear conexión humana. Salúdalos por su nombre, pregúntales cómo va el negocio. De vez en cuando, dale una muestra gratis o un pequeño detalle a tus mejores clientes. La gente le compra a quien le cae bien y en quien confía. Y la cuarta clave: premia la lealtad. Usa tu programa VIP para dar mejores precios a los más fieles. Haz que se sientan parte de algo exclusivo. Recuerda siempre: cuidar al cliente que ya tienes es el mejor negocio que existe, porque conseguir uno nuevo cuesta cinco veces más. La competencia por internet puede tener precios, pero no puede darle a tus barberías lo que tú sí: trato personal, confianza y una relación de verdad." },

{ titulo: "Ofertas que venden sin perder ganancia", texto:
"Una oferta bien hecha no es una pérdida. Es una inversión que se paga sola si trae suficiente volumen. Cuando bajas el precio, ganas un poco menos por cada unidad, pero si vendes muchas más unidades, terminas ganando más en total. La primera estrategia, y la mejor, es el descuento por volumen. Premia al que compra más con un mejor precio por unidad. Por ejemplo: de una a cinco unidades, a diez dólares cada una. De seis a once, a nueve cincuenta. De doce o más, a nueve. El cliente siente que gana comprando más, y tú mueves más producto y más rápido. La segunda estrategia es la oferta semanal. Cada semana, elige un solo producto de buen margen y ponlo en oferta, con límite: solo esta semana. Eso crea urgencia y le da a las barberías una razón para comprarte ahora. Pero cuidado: ofrece descuentos fuertes solo en productos de buen margen. En las máquinas, que dan poco margen, ofrece descuentos suaves o ninguno. La tercera estrategia es la venta cruzada, y sube tu ganancia sin descontar nada. Consiste en ofrecer productos que combinan con lo que ya compran. Al que compra máquinas, ofrécele aceite, cuchillas y limpieza. Al que compra shampoo, ofrécele acondicionador. La máquina es el gancho; la ganancia está en lo que la acompaña." },

{ titulo: "Vender más en cada visita de la ruta", texto:
"Cada visita a una barbería es una oportunidad, y la mayoría de los vendedores la desaprovecha porque solo toma el pedido y se va. Tú vas a hacer algo diferente. Antes de entrar, revisa en tu app qué compra normalmente ese cliente y qué compró la última vez. Así llegas preparado. Cuando estés ahí, no esperes a que te pidan: sugiere. Si siempre compra shampoo, pregúntale si le hace falta acondicionador. Si compra máquinas, ofrécele las cuchillas y el aceite que va a necesitar. La gente muchas veces compra más solo porque se lo recordaste. Segundo: menciona siempre la oferta de la semana. Es una razón para que compre hoy y no la próxima vez. Tercero: fíjate en lo que se le está acabando. Si ves que un producto está bajo en su estante, díselo con confianza: te queda poco de esto, ¿te dejo unos cuantos? Cuarto: al cliente que compra poco, tiéntalo con el descuento por volumen. Muéstrale cuánto ahorra si lleva más. Recuerda: no eres solo el que entrega; eres el que ayuda a la barbería a nunca quedarse sin lo que necesita. Esa actitud te hace vender más y te hace indispensable." },

{ titulo: "Negociar bien con tus suplidores", texto:
"El dinero también se gana cuando compras, no solo cuando vendes. Si compras mejor, ganas más en cada venta. Primera regla: compra en volumen cuando puedas. Los suplidores casi siempre te dan mejor precio si les compras más cantidad. Un costo más bajo significa más margen para ti en cada producto que vendes. Segunda regla: paga a tiempo y construye confianza. El suplidor que confía en ti te da mejores precios, te avisa primero de los productos nuevos, y a veces te da crédito. Tu buena fama con ellos vale dinero. Tercera regla: compara. No te cases con un solo suplidor sin saber si otro te da mejor precio por lo mismo. Tener dos o tres opciones te da poder para negociar. Cuarta regla: pregunta siempre por descuentos y términos. ¿Hay mejor precio si pago de contado? ¿Si compro esta cantidad? Muchas veces el descuento está ahí, pero solo lo dan si preguntas. Y quinta: lleva la cuenta de lo que le debes a cada suplidor, tus cuentas por pagar, para nunca perder el control. Recuerda: cada dólar que ahorras comprando es un dólar directo a tu ganancia." },

{ titulo: "No quedarte sin lo que más vendes", texto:
"El inventario es dinero. Cada producto en tu van es dinero tuyo esperando a venderse, y manejarlo bien es clave para ganar. La primera regla de oro es esta: nunca te quedes sin tus productos más vendidos. Si un cliente te pide lo que siempre lleva y no lo tienes, no solo pierdes esa venta: le abres la puerta al competidor. Ten siempre stock de lo que más se mueve. Segundo: conoce tus números. Tu app te dice cuáles son tus productos más vendidos. Esos son tus estrellas; cuídalos y tenlos siempre. Tercero: cuidado con el inventario muerto. Ese producto que compraste y no se vende, que lleva meses ahí, es dinero atrapado que no está trabajando. Es mejor bajarle el precio y salir de él para recuperar tu dinero y comprar lo que sí se vende. Cuarto: rellena tu van con orden, por marca, para que sea rápido y no se te olvide nada. Y quinto: revisa tu inventario seguido, para pedir a tiempo y nunca llegar corto a la ruta. Recuerda: un buen negocio no es el que tiene más producto, es el que tiene el producto correcto, el que se vende, siempre disponible." },

{ titulo: "Manejar el crédito y cobrar a tiempo", texto:
"Dar crédito, fiar, ayuda a vender más, pero es un arma de doble filo. Esta lección te enseña a manejarlo sin que te ahogue. Primero entiende esto: cada dólar que te deben es un dólar que ya trabajaste, pero que todavía no tienes en la mano. Si se acumula demasiado, puedes vender muchísimo y aun así quedarte sin efectivo para comprar más producto. A eso se le llama un problema de flujo de caja. Para no caer ahí, sigue estas reglas. Regla uno: no dejes que un cliente pase de dos o tres semanas sin abonar. Habla con él antes de que la deuda crezca. Regla dos: ponle un límite a cuánto le fías a cada cliente. No todos merecen el mismo crédito. Regla tres: al que siempre paga tarde, véndele más de contado y menos a crédito. Regla cuatro: revisa tus cuentas por cobrar cada semana en la app, para no perder de vista quién te debe. Cobrar a tiempo es tan importante como vender. Una venta a crédito no está completa hasta que te pagan. El vendedor amable que nunca cobra termina quebrando; el que cobra con respeto pero con firmeza, prospera." },

{ titulo: "Servicio que hace que te prefieran a ti", texto:
"En un mundo donde el cliente puede comprar por internet, ¿por qué te compraría a ti? La respuesta es el servicio, y es tu arma secreta. Primero, la puntualidad. Llegar cuando dijiste que ibas a llegar genera una confianza que el internet no puede dar. El cliente sabe que puede contar contigo. Segundo, resolver rápido. Cuando algo sale mal, un producto defectuoso, un pedido incompleto, la velocidad con que lo arreglas es lo que decide si el cliente se queda o se va. Un problema bien resuelto crea más lealtad que si nunca hubiera pasado. Tercero, el trato humano. Preguntar cómo va el negocio, acordarte de sus cosas, felicitarlo en una fecha especial. Eso construye una relación, no solo una venta. Cuarto, escucha. Pregúntale qué productos le gustaría que trajeras, y cuando puedas, tráelos. El cliente que se siente escuchado no se va con la competencia. Y quinto, cumple siempre tu palabra. Tu palabra es tu marca. La competencia por internet puede tener precios más bajos, pero no puede mirarte a los ojos, ni resolverte un problema hoy mismo, ni conocerte por tu nombre. Ese trato personal es lo que te hace ganar, visita tras visita." },

{ titulo: "Mentalidad de dueño de negocio", texto:
"Esta lección no es de técnicas, es de mentalidad, y quizás es la más importante de todas. Un dueño de negocio piensa diferente. Primero: separa el dinero del negocio del dinero personal. Si los mezclas, nunca vas a saber si el negocio gana o pierde, y te vas a gastar sin querer el dinero que era para comprar producto. Ten una cuenta o un sobre solo para el negocio, y págate un sueldo fijo, en vez de sacar dinero cuando sea. Segundo: reinvierte para crecer. Parte de lo que ganas debe volver al negocio, en más producto, en mejores herramientas, en crecer tu ruta. El que se lo gasta todo, se queda igual. Tercero: piensa a largo plazo. No sacrifiques una relación de años por ganar un poco más hoy. Cuarto: decide con números, no con emociones. Tus números te dicen la verdad; tus corazonadas a veces te engañan. Revisa tus ganancias cada semana y cada mes. Y quinto: cuida tu nombre. En este negocio, tu reputación con las barberías y con los suplidores es tu activo más valioso. El que conoce sus números y cuida su palabra, manda en su negocio. El que va a ciegas y gasta sin control, tarde o temprano tropieza." },

{ titulo: "Cómo crecer tu negocio paso a paso", texto:
"Para cerrar, vamos a juntar todo en un plan de crecimiento. Crecer no es solo vender más hoy; es construir algo cada vez más grande y sólido. Paso uno: primero retén, después crece. Antes de buscar clientes nuevos, asegúrate de cuidar bien a los que ya tienes, porque retener cuesta cinco veces menos que conseguir. Un cliente feliz, además, te recomienda gratis con otras barberías, y esa es la mejor publicidad que existe. Paso dos: vende más a los que ya te compran. Con venta cruzada y buen servicio, cada cliente puede darte más sin que gastes en conseguir uno nuevo. Paso tres: agrega productos con inteligencia. Pregunta a tus clientes qué les gustaría que trajeras, y trae lo que de verdad se va a vender. Paso cuatro: expande tu ruta poco a poco. Cada barbería nueva bien atendida es un ingreso más, pero crece a un ritmo que puedas cumplir, porque fallar por crecer muy rápido te cuesta caro. Paso cinco: mide y ajusta. Cada mes, compara si tus ganancias subieron. Si sí, sigue por ahí. Si no, ajusta precios, gastos o cobros. Recuerda: los negocios grandes empezaron pequeños, pero con dueños que cuidaban sus números, cuidaban a su gente, y mejoraban un poco cada mes. Ese eres tú. Sigue adelante, Sensei." }
];

var acaSynth = window.speechSynthesis;
var acaIdxLeccion = -1;
var acaChunks = [];
var acaIdxChunk = 0;
var acaCancelManual = false;
var acaVelocidad = 1;
var acaVoz = null;
var acaWakeLock = null;
window._acaReproduciendo = false;

// Escoger una voz en espanol de las que tenga el telefono
function graficoVentas6Meses(ventas){
  var meses = [];
  var hoy = new Date();
  for(var i=5; i>=0; i--){
    var d = new Date(hoy.getFullYear(), hoy.getMonth()-i, 1);
    meses.push({ ano:d.getFullYear(), mes:d.getMonth(), nombre:['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][d.getMonth()], total:0 });
  }
  ventas.forEach(function(v){
    if(v.cancelada) return;
    var f = parsearFechaVenta(v.fecha); if(!f) return;
    meses.forEach(function(m){ if(f.getFullYear()===m.ano && f.getMonth()===m.mes) m.total += (v.total||0); });
  });
  var maxV = Math.max.apply(null, meses.map(function(m){ return m.total; }).concat([1]));
  var barras = meses.map(function(m, idx){
    var altura = maxV>0 ? Math.round((m.total/maxV)*90) : 0;
    var esUltimo = idx === meses.length-1;
    return '<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end">'
      +'<div style="font-size:8px;color:#888;margin-bottom:2px">$'+(m.total>=1000?(m.total/1000).toFixed(1)+'k':Math.round(m.total))+'</div>'
      +'<div style="width:70%;height:'+altura+'px;background:'+(esUltimo?'#D4A017':'#1a237e')+';border-radius:4px 4px 0 0;min-height:2px"></div>'
      +'<div style="font-size:10px;color:#888;margin-top:4px">'+m.nombre+'</div></div>';
  }).join('');
  return '<div style="background:white;border:1px solid #eee;border-radius:12px;padding:14px;margin-bottom:12px">'
    +'<div style="font-size:12px;font-weight:700;color:#1a237e;text-align:center;margin-bottom:10px">📈 VENTAS DE LOS ÚLTIMOS 6 MESES</div>'
    +'<div style="display:flex;align-items:flex-end;gap:4px;height:120px">'+barras+'</div></div>';
}

// ── Gráfico de torta (SVG): cómo te pagan ──
// ═══════════════════════════════════════════════════════════════════
//  ✕ SALIR DE ESTE PEDIDO — el menú de las 3 opciones  (18 sep 2026)
//
//  Historia: los dos enlaces chicos ("Cancelar y volver" y "Ya no lo
//  quiere") vivían pegaditos debajo del botón verde de Registrar venta.
//  Un toque de Sensei cayó en "borrar" queriendo guardar y un pedido de
//  $70 casi se pierde. Él pidió: UN solo botón, abajo, con distancia,
//  que pregunte qué hacer. Las dos funciones viejas SIGUEN existiendo
//  (el menú las usa); solo cambió la puerta de entrada.
// ═══════════════════════════════════════════════════════════════════
function salirDelPedidoConversion(){
  var desde = window._vendiendoDesde;
  var nombre = '';
  if(desde && desde.tipo === 'pedido'){
    var peds = LS('npedidos', []);
    var p = peds.find(function(x){ return String(x.id) === String(desde.pedidoId); });
    if(p) nombre = p.nombre || '';
  }
  var ov = document.getElementById('pedido-salir-menu');
  if(ov) ov.remove();
  ov = document.createElement('div');
  ov.id = 'pedido-salir-menu';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:99997;display:flex;align-items:center;justify-content:center;padding:18px';
  ov.innerHTML = '<div style="background:#fff;border-radius:13px;padding:14px;width:100%;max-width:340px">'
    + '<div style="font-size:14.5px;font-weight:800;color:#1a1a2e;margin-bottom:11px;text-align:center">¿Qué hacemos con el pedido' + (nombre ? ' de ' + escaparHtml(nombre) : '') + '?</div>'
    + '<button onclick="cerrarSalirDelPedido();salirGuardandoPedido()" style="width:100%;background:#1a237e;color:#fff;border:none;border-radius:9px;padding:11px;font-size:14px;font-weight:800;cursor:pointer;margin-bottom:7px">↩️ Se queda guardado, salir</button>'
    + '<button onclick="cerrarSalirDelPedido();borrarPedidoQueSeEstaConvirtiendo()" style="width:100%;background:#c62828;color:#fff;border:none;border-radius:9px;padding:11px;font-size:14px;font-weight:800;cursor:pointer;margin-bottom:7px">🗑️ Ya no lo quiere — borrar</button>'
    + '<button onclick="cerrarSalirDelPedido()" style="width:100%;background:#ECEFF1;color:#455A64;border:none;border-radius:9px;padding:11px;font-size:14px;font-weight:800;cursor:pointer">Seguir con la venta</button>'
    + '</div>';
  document.body.appendChild(ov);
}

function cerrarSalirDelPedido(){
  var ov = document.getElementById('pedido-salir-menu');
  if(ov) ov.remove();
}

// Salir GUARDANDO el pedido, sin preguntar otra vez: la elección ya fue
// explícita en el menú. (cancelarConversionPedido, con su pregunta, sigue
// viva para el botón escondido de siempre.)
function salirGuardandoPedido(){
  ocultarAccionesDeConversion();
  iV = [];
  renderIV();
  window._vendiendoDesde = null;
  var b1 = document.getElementById('btn-cancelar-conversion-pedido');
  if(b1) b1.style.display = 'none';
  var b2 = document.getElementById('btn-borrar-pedido-conversion');
  if(b2) b2.style.display = 'none';
  ir('p-ped');
}
