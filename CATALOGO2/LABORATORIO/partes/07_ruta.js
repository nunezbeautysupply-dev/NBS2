
function marcarVisitaNegocio(id){
  clientes = LS('ncl', []);
  var c = clientes.find(function(x){ return String(x.id) === String(id); });
  if(!c) return;
  c.ultimaVisitaNegocio = fechaHoy();
  SS('ncl', clientes);
  alert('✅ Visita registrada. El próximo recordatorio será en '+c.intervaloVisitaDias+' días.');
}

function negociosParaVisitar(){
  clientes = LS('ncl', []);
  // Fuera los barberos SIN SERVICIO: no deben salir en la ruta de visitas. -8 ago-
  var _conServ = clientes;
  try { _conServ = soloConServicio(clientes); } catch(e){}
  var lista = [];
  _conServ.forEach(function(c){
    if(!c.tipoNegocio || c.tipoNegocio === 'Barberia') return;
    if(!c.intervaloVisitaDias) return;
    var diasDesde = c.ultimaVisitaNegocio ? Math.floor((new Date() - parsearFechaVenta(c.ultimaVisitaNegocio)) / 86400000) : null;
    var diasFaltan = diasDesde === null ? -999 : (c.intervaloVisitaDias - diasDesde); // sin visita previa = siempre "toca"
    if(diasFaltan <= 0){
      lista.push({ id: c.id, nombre: nombreClConNegocio(c), diasAtraso: diasDesde===null ? null : (diasDesde - c.intervaloVisitaDias) });
    }
  });
  return lista;
}

function verificarVisitasNegocios(){
  var ultimaVezMostrado = parseInt(localStorage.getItem('ultimoAvisoVisitas') || '0');
  var horasDesde = (new Date().getTime() - ultimaVezMostrado) / (1000*60*60);
  if(horasDesde < 8) return; // no molestar mas de una vez cada 8 horas
  var lista = negociosParaVisitar();
  if(lista.length > 0){
    mostrarAlertaVisitasNegocios(lista);
  }
}

function mostrarAlertaVisitasNegocios(lista){
  if(document.getElementById('visitas-negocios-overlay')) return;
  localStorage.setItem('ultimoAvisoVisitas', new Date().getTime().toString());
  var overlay = document.createElement('div');
  overlay.id = 'visitas-negocios-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);z-index:999999;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:20px';
  var itemsHtml = lista.slice(0,6).map(function(item){
    var atraso = item.diasAtraso===null ? 'Nunca visitada' : (item.diasAtraso===0 ? 'Justo hoy' : 'Hace '+item.diasAtraso+' día(s) de atraso');
    return '<div style="text-align:left;background:#F5F5F5;border-radius:8px;padding:10px;margin-bottom:6px">'
      +'<div style="font-size:13px;font-weight:700;color:#1a237e">'+item.nombre+'</div>'
      +'<div style="font-size:11px;color:#C62828">'+atraso+'</div>'
      +'</div>';
  }).join('');
  overlay.innerHTML = '<div style="background:white;border-radius:16px;padding:24px;max-width:360px;width:100%;text-align:center;max-height:85vh;overflow-y:auto">'
    +'<div style="font-size:44px;margin-bottom:10px">🔔</div>'
    +'<div style="font-size:17px;font-weight:800;color:#1a237e;margin-bottom:8px">Toca visitar '+lista.length+' negocio(s)</div>'
    +itemsHtml
    +(lista.length>6 ? '<div style="font-size:12px;color:#aaa;margin-bottom:8px">...y '+(lista.length-6)+' más</div>' : '')
    +'<button onclick="ir(\'p-rutas\');document.getElementById(\'visitas-negocios-overlay\').remove();" style="width:100%;padding:13px;background:#1565C0;color:white;border:none;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;margin:10px 0 8px">🗺️ Ver en Ruta de Visitas</button>'
    +'<button onclick="document.getElementById(\'visitas-negocios-overlay\').remove()" style="width:100%;padding:10px;background:none;color:#aaa;border:none;font-size:13px;cursor:pointer">Cerrar</button>'
    +'</div>';
  document.body.appendChild(overlay);
}

function toggleIntervaloVisita(selectId, wrapId){
  var sel = document.getElementById(selectId);
  var wrap = document.getElementById(wrapId);
  if(!sel || !wrap) return;
  wrap.style.display = sel.value === 'Barberia' ? 'none' : 'block';
}

function cargarDatosVan(){
  var v = LS('nvan', null);
  if(!v || typeof v !== 'object'){ v = { fechaCarga: null, cargado: {} }; }
  if(!v.cargado) v.cargado = {};
  return v;
}
function guardarDatosVan(v){ SS('nvan', v); }

var _van = null;

// ═══════════════════════════════════════════════════════════════════════════
//  AYUDA / CONSULTAS  (18 jul 2026, pedido por Sensei)
//  Un buscador de ayuda que funciona SIN INTERNET y GRATIS. Las respuestas están
//  escritas aquí (no las inventa una IA), así que siempre son exactas para esta app.
//  Cada tema tiene: título, palabras clave (para que encuentre aunque escribas
//  distinto), y la respuesta con dónde está y cómo se usa.
// ═══════════════════════════════════════════════════════════════════════════
function abrirVan(){
  loadProds();
  _van = cargarDatosVan();
  var elFecha = document.getElementById('van-fecha-carga');
  if(elFecha){
    elFecha.textContent = _van.fechaCarga
      ? ('Cargaste la van el ' + fechaISOaLegible(_van.fechaCarga) + '. Las ventas desde ese día cuentan como salidas de la van.')
      : 'Aún no has cargado la van. Toca "Cargar la van" para empezar.';
  }
  var b = document.getElementById('van-buscar');
  if(b) b.value = '';
  renderVan('');
}

// Convierte 'YYYY-MM-DD' a algo legible como '18 de julio de 2026'
function calcularEstadoVan(){
  var v = _van || cargarDatosVan();
  var vendidos = v.fechaCarga ? vendidosEnRango(v.fechaCarga, fechaHoyISO()) : {};
  var filas = [];
  var totalEnVan = 0, productosBajos = 0;
  var inicialDe = v.inicial || {};
  Object.keys(v.cargado).forEach(function(pidStr){
    var cargado = v.cargado[pidStr] || 0;
    if(cargado <= 0) return;
    var prod = productos.find(function(p){ return String(p.id) === pidStr; });
    var nombre = prod ? prod.nombre : ('Producto #' + pidStr);
    var vendidoTotal = vendidos[pidStr] || 0;
    var quedan = Math.max(0, cargado - vendidoTotal);
    // El inventario inicial: si la van es de antes de este cambio, se toma lo cargado
    var inicial = (inicialDe[pidStr] !== undefined) ? inicialDe[pidStr] : cargado;
    // Lo que ya repuso al cargar la van; el "vendi" que se ENSEÑA es lo vendido DESDE
    // esa ultima carga. Sin esto los tres numeros de la pantalla no cuadraban:
    // salia "Inicial 25 - Vendi 3 - Me quedan 25", y 25-3 no es 25. Sensei lo cazo.
    var repuesto = Math.max(0, cargado - inicial);
    var vendido = Math.max(0, vendidoTotal - repuesto);
    // "bajo" = queda 25% o menos de lo que cargaste (o cero). Es una senal, no una regla fija.
    var bajo = quedan === 0 || (cargado > 0 && (quedan / cargado) <= 0.25);
    totalEnVan += quedan;
    if(bajo) productosBajos++;
    filas.push({ pid: pidStr, nombre: nombre, cargado: cargado, inicial: inicial, vendido: vendido, quedan: quedan, bajo: bajo });
  });
  // Ordenar: primero los bajos, y dentro de esos, los que mas se vendieron
  filas.sort(function(a,b){
    if(a.bajo !== b.bajo) return a.bajo ? -1 : 1;
    return b.vendido - a.vendido;
  });
  return { filas: filas, totalEnVan: totalEnVan, productosBajos: productosBajos };
}

// ═══════════════════════════════════════════════════════════════════
//  🚚 CIERRE DE RUTA — cuadrar la MERCANCÍA al terminar el día  (28 ago 2026)
//
//  Vino de comparar la app con los sistemas de reparto que usa la industria
//  (Pepperi, bMobile, SimplyDepo). Todos hacen lo mismo al final del turno:
//  el repartidor cuenta lo que le quedó en la van y el sistema lo compara con
//  lo que DEBERÍA quedar. Si no cuadra, se sabe el mismo día.
//
//  Sensei ya cuadraba el DINERO (Cuadre de Caja). Lo que faltaba era cuadrar
//  la MERCANCÍA. Un producto que se pierde no lo dice ningún número de dinero:
//  simplemente deja de estar, y meses después el inventario no cuadra y nadie
//  sabe cuándo empezó.
//
//  🔒 NO toca el inventario ni las ventas. Solo apunta lo que contaste y la
//  diferencia, para que quede constancia con su fecha.
// ═══════════════════════════════════════════════════════════════════

function abrirCierreRuta(){
  var estado = calcularEstadoVan();
  if(!estado.filas.length){
    alert('Todavía no has cargado nada en la van.\n\nCarga la van primero y al terminar el día vuelves aquí a cuadrarla.');
    return;
  }
  window._cierreRuta = { contado: {} };

  var ov = document.getElementById('cierre-ruta-overlay');
  if(!ov){
    ov = document.createElement('div');
    ov.id = 'cierre-ruta-overlay';
    document.body.appendChild(ov);
  }
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:99999;'
    + 'display:flex;align-items:flex-end;justify-content:center';
  ov.innerHTML = '<div id="cierre-ruta-caja" style="background:#fff;width:100%;max-width:520px;'
    + 'border-radius:16px 16px 0 0;padding:14px;max-height:92vh;overflow:auto"></div>';
  pintarCierreRuta();
}

function cerrarCierreRuta(){
  var ov = document.getElementById('cierre-ruta-overlay');
  if(ov) ov.style.display = 'none';
}

function pintarCierreRuta(){
  var caja = document.getElementById('cierre-ruta-caja');
  if(!caja) return;
  var estado = calcularEstadoVan();
  var contado = (window._cierreRuta || {}).contado || {};

  // Solo tiene sentido contar lo que debería quedar algo, o lo que ya contaste
  var filas = estado.filas.filter(function(f){
    return f.quedan > 0 || contado[f.pid] !== undefined;
  });

  var faltan = 0, sobran = 0, valorFaltante = 0, yaContados = 0;
  loadProds();
  filas.forEach(function(f){
    if(contado[f.pid] === undefined) return;
    yaContados++;
    var dif = contado[f.pid] - f.quedan;
    if(dif < 0){
      faltan += -dif;
      var prod = productos.find(function(x){ return String(x.id) === String(f.pid); });
      var costo = prod ? (parseFloat(prod.costo) || 0) : 0;
      valorFaltante += (-dif) * costo;
    }
    if(dif > 0) sobran += dif;
  });

  var h = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">'
    + '<div style="font-size:16px;font-weight:900;color:#5D4037">🚚 Cierre de ruta</div>'
    + '<button onclick="cerrarCierreRuta()" style="background:#F0F0F2;border:none;border-radius:8px;'
    +   'width:32px;height:32px;font-size:15px;cursor:pointer">✕</button>'
    + '</div>'
    + '<div style="font-size:11.5px;color:#888;margin-bottom:10px">'
    +   'Cuenta lo que te quedó en la van y escríbelo. La app lo compara con lo que debería quedar.</div>';

  // El resumen, arriba y siempre a la vista
  h += '<div style="font-size:11px;color:#555;font-weight:700;margin-bottom:3px">📅 ¿DE QUÉ DÍA ES ESTE CIERRE?</div>';
  h += '<input type="date" id="cr-fecha" style="width:100%;padding:9px;border:1px solid #ddd;border-radius:8px;font-size:13px;margin-bottom:10px">';
  h += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:12px">'
    + '<div style="background:#F5F5F7;border-radius:9px;padding:8px 6px;text-align:center">'
    +   '<div style="font-size:9px;color:#888;font-weight:800">CONTADOS</div>'
    +   '<div style="font-size:16px;font-weight:900;color:#5D4037">' + yaContados + '/' + filas.length + '</div></div>'
    + '<div style="background:' + (faltan ? '#FFEBEE' : '#E8F5E9') + ';border-radius:9px;padding:8px 6px;text-align:center">'
    +   '<div style="font-size:9px;color:#888;font-weight:800">FALTAN</div>'
    +   '<div style="font-size:16px;font-weight:900;color:' + (faltan ? '#C62828' : '#2E7D32') + '">' + faltan + '</div></div>'
    + '<div style="background:' + (sobran ? '#FFF8E1' : '#E8F5E9') + ';border-radius:9px;padding:8px 6px;text-align:center">'
    +   '<div style="font-size:9px;color:#888;font-weight:800">SOBRAN</div>'
    +   '<div style="font-size:16px;font-weight:900;color:' + (sobran ? '#8a6d00' : '#2E7D32') + '">' + sobran + '</div></div>'
    + '</div>';

  if(faltan){
    h += '<div style="background:#FFEBEE;border:1px solid #EF9A9A;border-radius:10px;padding:9px 11px;margin-bottom:10px">'
      + '<div style="font-size:12.5px;font-weight:800;color:#C62828">Te faltan ' + faltan + ' unidad(es)</div>'
      + '<div style="font-size:11.5px;color:#B0757A;margin-top:2px">A tu costo son <b>$' + fmtNum(valorFaltante) + '</b>. '
      + 'Puede ser una venta sin apuntar, algo que se quedó en una barbería, o un conteo mal hecho.</div>'
      + '</div>';
  }

  // Un renglón por producto
  filas.forEach(function(f){
    var val = contado[f.pid];
    var dif = (val === undefined) ? null : (val - f.quedan);
    var colorDif = (dif === null) ? '#bbb' : (dif === 0 ? '#2E7D32' : (dif < 0 ? '#C62828' : '#8a6d00'));
    var textoDif = (dif === null) ? '—' : (dif === 0 ? '✓ cuadra' : (dif > 0 ? '+' + dif : String(dif)));
    h += '<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid #F2F2F5">'
      + '<div style="flex:1;min-width:0">'
      +   '<div style="font-size:12.5px;font-weight:700;color:var(--nbs-ink)">' + escaparHtml(f.nombre) + '</div>'
      +   '<div style="font-size:10.5px;color:#888">cargaste ' + f.cargado + ' · vendiste ' + f.vendido
      +     ' · <b>deberían quedar ' + f.quedan + '</b></div>'
      + '</div>'
      + '<input type="number" min="0" inputmode="numeric" id="cr-' + f.pid + '" '
      +   'value="' + (val === undefined ? '' : val) + '" placeholder="?" '
      +   'onfocus="this.select()" onchange="apuntarContadoRuta(\'' + f.pid + '\', this.value)" '
      +   'style="width:62px;padding:8px 4px;border:1.5px solid #ccc;border-radius:8px;font-size:15px;'
      +   'font-weight:800;text-align:center;flex-shrink:0">'
      + '<div style="width:56px;text-align:right;flex-shrink:0;font-size:12.5px;font-weight:800;color:' + colorDif + '">'
      +   textoDif + '</div>'
      + '</div>';
  });

  h += '<div style="display:flex;gap:8px;margin-top:14px">'
    + '<button onclick="cerrarCierreRuta()" style="flex:.8;padding:13px;background:#F0F0F2;color:#333;'
    +   'border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer">Seguir después</button>'
    + '<button onclick="guardarCierreRuta()" style="flex:1.4;padding:13px;background:#5D4037;color:#fff;'
    +   'border:none;border-radius:10px;font-size:13.5px;font-weight:900;cursor:pointer">💾 Guardar el cierre</button>'
    + '</div>';

  caja.innerHTML = h;
  setTimeout(function(){ ponerHoyEnCampo('cr-fecha'); }, 0);   // 📅 -2 sep-
}

function apuntarContadoRuta(pid, valor){
  if(!window._cierreRuta) window._cierreRuta = { contado: {} };
  var v = String(valor).trim();
  if(v === ''){ delete window._cierreRuta.contado[pid]; }
  else {
    var n = parseInt(v, 10);
    window._cierreRuta.contado[pid] = (isFinite(n) && n >= 0) ? n : 0;
  }
  pintarCierreRuta();
}

function guardarCierreRuta(){
  var d = window._cierreRuta;
  if(!d || !Object.keys(d.contado).length){
    alert('Todavía no has contado ningún producto.\n\nEscribe cuántos te quedaron de al menos uno.');
    return;
  }
  var estado = calcularEstadoVan();
  loadProds();

  var renglones = [], faltan = 0, sobran = 0, valorFaltante = 0;
  estado.filas.forEach(function(f){
    if(d.contado[f.pid] === undefined) return;
    var dif = d.contado[f.pid] - f.quedan;
    var prod = productos.find(function(x){ return String(x.id) === String(f.pid); });
    var costo = prod ? (parseFloat(prod.costo) || 0) : 0;
    if(dif < 0){ faltan += -dif; valorFaltante += (-dif) * costo; }
    if(dif > 0) sobran += dif;
    renglones.push({ pid: f.pid, nombre: f.nombre, cargado: f.cargado, vendido: f.vendido,
                     debian: f.quedan, contados: d.contado[f.pid], diferencia: dif, costo: costo });
  });

  var sinContar = estado.filas.filter(function(f){
    return f.quedan > 0 && d.contado[f.pid] === undefined;
  }).length;
  if(sinContar){
    if(!confirm('Te quedan ' + sinContar + ' producto(s) sin contar.\n\n¿Guardar el cierre así?')) return;
  }

  var cierres = LS('ncierres_ruta', []);
  cierres.push({
    id: Date.now(),
    fecha: fechaDelCampo('cr-fecha'),   // 📅 la que el escogio -2 sep-
    hora: new Date().toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit', hour12:true }),
    fechaCarga: (cargarDatosVan() || {}).fechaCarga || null,
    renglones: renglones,
    faltan: faltan,
    sobran: sobran,
    valorFaltante: Math.round(valorFaltante * 100) / 100,
    sinContar: sinContar
  });
  if(!SS('ncierres_ruta', cierres)){ return; }   // SS ya avisa si no cupo

  cerrarCierreRuta();
  var msg = '✅ Cierre de ruta guardado.\n\n';
  if(!faltan && !sobran) msg += 'Todo cuadra. No falta ni sobra nada.';
  else {
    if(faltan) msg += 'Faltan ' + faltan + ' unidad(es) — $' + fmtNum(valorFaltante) + ' a tu costo.\n';
    if(sobran) msg += 'Sobran ' + sobran + ' unidad(es).\n';
    msg += '\nQueda apuntado con la fecha de hoy.';
  }
  alert(msg);
  // \ud83d\udcbe Y se le recuerda guardar el d\u00eda. Lo pidi\u00f3 el 8 sep, despu\u00e9s de quedarse
  // fuera de la app: "imag\u00ednate que yo pierda todos mis datos, es como perder el
  // negocio". El backup en su correo sobrevive al tel\u00e9fono y a la nube.
  setTimeout(function(){ try { avisarGuardarElDia(); } catch(e){} }, 400);
}

function renderVan(q){
  q = (q||'').toLowerCase().trim();
  var estado = calcularEstadoVan();

  // Tarjetas de resumen arriba
  var resEl = document.getElementById('van-resumen');
  if(resEl){
    resEl.innerHTML =
      '<div style="background:white;border-radius:10px;padding:11px;text-align:center;border:0.5px solid var(--nbs-line)">'
      +'<div style="font-size:11px;color:var(--nbs-muted)">EN LA VAN AHORA</div>'
      +'<div style="font-size:22px;font-weight:800;color:#1a237e">'+estado.totalEnVan+'</div>'
      +'<div style="font-size:10px;color:var(--nbs-muted)">unidades</div></div>'
      +'<div style="background:'+(estado.productosBajos>0?'var(--nbs-red-bg)':'var(--nbs-green-bg)')+';border-radius:10px;padding:11px;text-align:center">'
      +'<div style="font-size:11px;color:'+(estado.productosBajos>0?'var(--nbs-red-dark)':'var(--nbs-green-text)')+'">HAY QUE RECARGAR</div>'
      +'<div style="font-size:22px;font-weight:800;color:'+(estado.productosBajos>0?'var(--nbs-red-dark)':'var(--nbs-green-text)')+'">'+estado.productosBajos+'</div>'
      +'<div style="font-size:10px;color:'+(estado.productosBajos>0?'var(--nbs-red-dark)':'var(--nbs-green-text)')+'">producto(s) bajo(s)</div></div>';
  }

  var el = document.getElementById('van-lista');
  if(!el) return;

  var filas = estado.filas;
  if(q) filas = filtrarPorBusqueda(filas, q, function(f){ return f.nombre; });

  if(!estado.filas.length){
    el.innerHTML = '<div class="card" style="text-align:center;color:#bbb;font-size:13px;padding:20px">Tu van está vacía.<br>Toca "➕ Cargar la van" para registrar lo que llevas.</div>';
    return;
  }
  if(!filas.length){
    el.innerHTML = '<div class="card" style="text-align:center;color:#bbb;font-size:13px;padding:18px">Ningún producto con ese nombre en la van.</div>';
    return;
  }

  el.innerHTML = filas.map(function(f){
    var colorBorde = f.bajo ? 'var(--nbs-red-text)' : '#2E7D32';
    var etiqueta;
    if(f.quedan === 0){
      etiqueta = '<span style="color:var(--nbs-red-dark);font-weight:700">⚠️ Agotado en la van — recarga sugerida: '+f.vendido+'</span>';
    } else if(f.bajo){
      etiqueta = '<span style="color:var(--nbs-red-dark);font-weight:700">⚠️ Bajo — recarga sugerida: '+f.vendido+'</span>';
    } else {
      etiqueta = '<span style="color:#2E7D32;font-weight:700">✓ Tienes suficiente</span>';
    }
    return '<div class="card" style="margin-bottom:8px;padding:11px;border-left:4px solid '+colorBorde+'">'
      +'<div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:8px">'
      +'<div style="flex:1;font-size:14px;font-weight:700;color:var(--nbs-ink)">'+escaparHtml(f.nombre)+'</div>'
      +'<button onclick="quitarProductoDeVan(\''+f.pid+'\')" title="Quitar de la van" style="flex-shrink:0;width:30px;height:30px;border:none;border-radius:7px;background:var(--nbs-red-bg);color:var(--nbs-red-dark);font-size:15px;font-weight:800;cursor:pointer">\u2715</button>'
      +'</div>'
      +'<div style="display:flex;gap:6px">'
      +'<div style="flex:1;text-align:center"><div style="font-size:10px;color:var(--nbs-muted)">Inicial</div>'
      +'<input type="number" min="0" inputmode="numeric" value="'+f.inicial+'" data-cargado="'+f.inicial+'"'
      +' onfocus="this.select()" onchange="corregirCargaVan(\''+f.pid+'\', this.value, this)"'
      +' style="width:100%;max-width:66px;padding:5px 4px;text-align:center;font-size:16px;font-weight:800;color:var(--nbs-ink);border:1.5px solid var(--nbs-gold);border-radius:7px;background:#FFFDF5"></div>'
      +'<div style="flex:1;text-align:center"><div style="font-size:10px;color:var(--nbs-muted)">Vendí</div><div style="font-size:16px;font-weight:800;color:#1565C0">'+f.vendido+'</div></div>'
      +'<div style="flex:1;text-align:center"><div style="font-size:10px;color:var(--nbs-muted)">Me quedan</div><div style="font-size:16px;font-weight:800;color:'+(f.bajo?'var(--nbs-red-dark)':'#2E7D32')+'">'+f.quedan+'</div></div>'
      +'</div>'
      +'<div style="margin-top:8px;font-size:11px">'+etiqueta+'</div>'
      +'</div>';
  }).join('');
}

// Abre un panel para registrar cuanto se carga de cada producto en la van.
// Se puede REEMPLAZAR (empezar de cero) o SUMAR (agregar a lo que ya habia).

// ═══════════════════════════════════════════════════════════════════
//  CARGAR LA VAN CON LO VENDIDO  (29 jul)
// ═══════════════════════════════════════════════════════════════════
//
// LA IDEA DE SENSEI, en sus palabras: "yo hago un inventario inicial en la van, luego
// que la van me de una lista de lo que vendi de acuerdo a las ventas, y con esa lista yo
// relleno la van y se vuelve a poner como cuando empezo".
//
// LA DIFERENCIA ENTRE LOS DOS BOTONES, tambien en sus palabras:
//   INVENTARIO INICIAL -> una vez. Define cuanto es "la van llena".
//   CARGAR LA VAN      -> cada vez. Mira lo vendido, lo pone, y la van vuelve
//                         a su inventario inicial.
//
// POR QUE ES TAN SIMPLE: la app ya guarda `cargado` (el inventario inicial) y cuenta lo
// vendido DESDE `fechaCarga`. Asi que cargar la van = mover fechaCarga a hoy: lo vendido
// vuelve a 0 y "me quedan" vuelve a ser igual al inventario inicial. Sin escribir nada.
//
// NO TOCA el inventario del almacen, ni las ventas, ni el dinero.

function rellenarVanConLoVendido(){
  loadProds();
  _van = cargarDatosVan();
  if(!_van || !_van.cargado || !Object.keys(_van.cargado).length){
    avisoGrande('Tu van esta vacia.\n\nPrimero toca "Inventario inicial" para decir que lleva la van cuando esta llena.');
    return;
  }
  window._relVanDesde = _van.fechaCarga || fechaHoyISO();
  window._relVanHasta = fechaHoyISO();
  pintarRellenarVan();
}

function rangoRapidoVan(dias){
  if(dias === 0){
    window._relVanDesde = (_van && _van.fechaCarga) ? _van.fechaCarga : fechaHoyISO();
  } else {
    var d = new Date(Date.now() - dias * 86400000);
    window._relVanDesde = d.toISOString().slice(0,10);
  }
  window._relVanHasta = fechaHoyISO();
  pintarRellenarVan();
}

function cambiarFechaRelVan(cual, valor){
  if(cual === 'desde') window._relVanDesde = valor; else window._relVanHasta = valor;
  pintarRellenarVan();
}

function pintarRellenarVan(){
  loadProds();
  _van = cargarDatosVan();
  var vendidos = vendidosEnRango(window._relVanDesde, window._relVanHasta) || {};

  var filas = [], totalUnidades = 0;
  Object.keys(_van.cargado).forEach(function(pid){
    var n = vendidos[pid] || 0;
    if(n <= 0) return;
    var prod = productos.find(function(p){ return String(p.id) === String(pid); });
    filas.push({ pid: pid, nombre: prod ? prod.nombre : ('Producto #' + pid),
                 vendido: n, inicial: _van.cargado[pid] || 0 });
    totalUnidades += n;
  });
  filas.sort(function(a,b){ return b.vendido - a.vendido; });

  var h = '<div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:10px">'
        +   '<div style="flex:1"><div style="font-size:18px;font-weight:900;color:#1a237e">CARGAR LA VAN</div>'
        +   '<div style="font-size:12px;color:#666">Pon esto en la camioneta y la van vuelve a su inventario inicial</div></div>'
        +   '<button onclick="cerrarRellenarVan()" style="flex-shrink:0;width:34px;height:34px;border:none;border-radius:9px;background:#f0f0f0;color:#666;font-size:20px;font-weight:800;cursor:pointer">X</button>'
        + '</div>'
        + '<div style="background:#F4F6FB;border:1px solid #d9dcec;border-radius:11px;padding:11px;margin-bottom:10px">'
        +   '<div style="font-size:10.5px;color:#666;font-weight:800;letter-spacing:.4px;margin-bottom:6px">VER LO VENDIDO ENTRE ESTAS FECHAS</div>'
        +   '<div style="display:flex;gap:7px;align-items:center">'
        +     '<input class="inp" type="date" value="' + window._relVanDesde + '" onchange="cambiarFechaRelVan(&quot;desde&quot;, this.value)" style="flex:1;margin-bottom:0">'
        +     '<span style="font-size:12px;color:#aaa">a</span>'
        +     '<input class="inp" type="date" value="' + window._relVanHasta + '" onchange="cambiarFechaRelVan(&quot;hasta&quot;, this.value)" style="flex:1;margin-bottom:0">'
        +   '</div>'
        +   '<div style="display:flex;gap:5px;margin-top:8px">'
        +     '<button onclick="rangoRapidoVan(0)" style="flex:1.4;padding:7px;background:white;border:1px solid #ccc;border-radius:7px;font-size:11px;font-weight:700;color:#1a237e;cursor:pointer">Desde que cargue</button>'
        +     '<button onclick="rangoRapidoVan(7)" style="flex:1;padding:7px;background:white;border:1px solid #ccc;border-radius:7px;font-size:11.5px;font-weight:700;color:#1a237e;cursor:pointer">7 dias</button>'
        +     '<button onclick="rangoRapidoVan(15)" style="flex:1;padding:7px;background:white;border:1px solid #ccc;border-radius:7px;font-size:11.5px;font-weight:700;color:#1a237e;cursor:pointer">15</button>'
        +     '<button onclick="rangoRapidoVan(30)" style="flex:1;padding:7px;background:white;border:1px solid #ccc;border-radius:7px;font-size:11.5px;font-weight:700;color:#1a237e;cursor:pointer">30</button>'
        +   '</div>'
        + '</div>';

  if(!filas.length){
    h += '<div style="text-align:center;color:#999;font-size:13px;padding:22px;line-height:1.5">No vendiste nada de la van en esas fechas.<br>No hay nada que cargar.</div>'
       + '<button onclick="cerrarRellenarVan()" style="width:100%;padding:13px;background:#ECEFF1;color:#546E7A;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer">Cerrar</button>';
  } else {
    h += '<div style="font-size:11.5px;color:#2E7D32;font-weight:800;letter-spacing:.4px;margin-bottom:7px">ESTO ES LO QUE TIENES QUE PONER &middot; ' + totalUnidades + ' unidad(es)</div>';
    filas.forEach(function(f){
      h += '<div style="display:flex;align-items:center;gap:10px;background:white;border:1px solid #e5e7eb;border-radius:10px;padding:10px;margin-bottom:6px">'
        +    '<div style="flex-shrink:0;min-width:46px;text-align:center;background:#E8F5E9;border-radius:8px;padding:7px 4px">'
        +      '<div style="font-size:19px;font-weight:900;color:#1B5E20;line-height:1">' + f.vendido + '</div></div>'
        +    '<div style="flex:1;min-width:0">'
        +      '<div style="font-size:13px;font-weight:700;color:var(--nbs-ink);line-height:1.3">' + escaparHtml(f.nombre) + '</div>'
        +      '<div style="font-size:11px;color:#888">vuelve a ' + f.inicial + ' en la van</div>'
        +    '</div></div>';
    });
    h += '<button onclick="aplicarRellenoVan()" style="width:100%;padding:15px;background:#2E7D32;color:white;border:none;border-radius:11px;font-size:15px;font-weight:800;cursor:pointer;margin-top:8px">Ya lo puse - cargar la van</button>'
       + '<button onclick="cerrarRellenarVan()" style="width:100%;padding:11px;background:none;border:1px solid #999;color:#666;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;margin-top:8px">Cancelar</button>'
       + '<div style="font-size:11.5px;color:var(--nbs-muted);text-align:center;margin-top:8px;line-height:1.45">Esto NO toca tu inventario del almacen ni tus ventas.<br>Solo pone el contador de la van en cero.</div>';
  }

  var ov = document.getElementById('relvan-ov');
  if(!ov){
    ov = document.createElement('div');
    ov.id = 'relvan-ov';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:99994;display:flex;align-items:center;justify-content:center;padding:14px';
    document.body.appendChild(ov);
  }
  ov.innerHTML = '<div style="background:#fff;border-radius:16px;padding:15px;max-width:460px;width:100%;max-height:88vh;overflow-y:auto">' + h + '</div>';
  ov.style.display = 'flex';
}

function cerrarRellenarVan(){
  var ov = document.getElementById('relvan-ov');
  if(ov) ov.remove();
}

function aplicarRellenoVan(){
  loadProds();
  _van = cargarDatosVan();
  if(!_van || !_van.cargado){ cerrarRellenarVan(); return; }

  // POR QUE NO SE MUEVE LA FECHA: la app cuenta lo vendido POR DIA, asi que si Sensei
  // carga y vende el MISMO dia, mover fechaCarga no borraria las ventas de hoy y "me
  // quedan" no volveria al inventario inicial. En vez de eso se SUMA lo vendido a lo
  // cargado: quedan = cargado - vendido vuelve EXACTO al inicial, sin importar la fecha.
  var vendidos = vendidosEnRango(window._relVanDesde, window._relVanHasta) || {};
  if(!_van.inicial) _van.inicial = {};
  var cuantos = 0, unidades = 0;
  Object.keys(_van.cargado).forEach(function(pid){
    var n = vendidos[pid] || 0;
    if(n <= 0) return;
    _van.cargado[pid] = (_van.cargado[pid] || 0) + n;
    if(_van.inicial[pid] === undefined) _van.inicial[pid] = _van.cargado[pid] - n;
    cuantos++; unidades += n;
  });

  if(!cuantos){ cerrarRellenarVan(); avisoGrande('No habia nada que cargar.'); return; }

  guardarDatosVan(_van);
  cerrarRellenarVan();
  abrirVan();
  avisoGrande('Van cargada.\n\nPusiste ' + unidades + ' unidad(es) en ' + cuantos + ' producto(s).\nLa van volvio a tu inventario inicial.');
}

// ═══ CORREGIR LO CARGADO EN LA VAN (29 jul) ═══
// Sensei: "necesito que las cantidades sean editables porque puede ser que esté contando
// lo que tengo por primera vez y haya productos en varios sitios, y cuando cuente no
// cuente bien y haya que arreglar la cantidad".
//
// Antes, despues de guardar la carga, el "Cargue" quedaba fijo: solo se podia SUMAR mas o
// empezar la van de cero. Si conto 25 y en realidad eran 20, no habia como bajarlo.
//
// Esto NO toca el inventario ni las ventas: solo el conteo de lo que metio en la van.
function corregirCargaVan(pid, valor, campo){
  var n = parseInt(valor, 10);
  if(!isFinite(n) || n < 0){
    avisoGrande('Escribe un número de 0 o más.');
    if(campo) campo.value = campo.getAttribute('data-cargado') || '0';
    return;
  }
  _van = cargarDatosVan();
  if(!_van || !_van.cargado){ avisoGrande('Tu van está vacía.'); return; }

  if(!_van.inicial) _van.inicial = {};
  var antes = (_van.inicial[pid] !== undefined) ? _van.inicial[pid] : (_van.cargado[pid] || 0);
  if(antes === n) return;                      // no cambio nada

  loadProds();
  var prod = productos.find(function(p){ return String(p.id) === String(pid); });
  var nombre = prod ? prod.nombre : ('Producto #' + pid);

  if(n === 0){
    if(!confirm('Poner ' + nombre + ' en 0 lo quita de la van.\n\n¿Seguir?')){
      if(campo) campo.value = String(antes);
      return;
    }
    delete _van.cargado[pid];
    delete _van.inicial[pid];
  } else {
    // Se mueve el inicial, y lo cargado se corre lo mismo para no descuadrar lo vendido
    var dif = n - antes;
    _van.inicial[pid] = n;
    _van.cargado[pid] = Math.max(0, (_van.cargado[pid] || 0) + dif);
  }
  guardarDatosVan(_van);
  apuntarCorreccionVan(nombre, antes, n);
  abrirVan();                                  // redibuja: "Me quedan" se recalcula solo
  avisoGrande('\u2713 ' + nombre + '\n\nCargué: ' + antes + ' \u2192 ' + n);
}

function quitarProductoDeVan(pid){
  _van = cargarDatosVan();
  if(!_van || !_van.cargado || _van.cargado[pid] === undefined) return;
  loadProds();
  var prod = productos.find(function(p){ return String(p.id) === String(pid); });
  var nombre = prod ? prod.nombre : ('Producto #' + pid);
  var antes = (_van.inicial && _van.inicial[pid] !== undefined) ? _van.inicial[pid] : (_van.cargado[pid] || 0);
  if(!confirm('¿Quitar ' + nombre + ' de la van?\n\nTenías ' + antes + ' cargada(s). Esto NO toca tu inventario ni tus ventas.')) return;
  delete _van.cargado[pid];
  if(_van.inicial) delete _van.inicial[pid];
  guardarDatosVan(_van);
  apuntarCorreccionVan(nombre, antes, 0);
  abrirVan();
  avisoGrande('\u2713 ' + nombre + ' se quitó de la van.');
}

// Cada correccion queda anotada, igual que los cambios de precio. Asi hay rastro de lo que
// se toco durante el conteo. Se guardan las ultimas 300.
function apuntarCorreccionVan(nombre, antes, despues){
  try {
    var log = LS('nbs_correcciones_van', []);
    if(!Array.isArray(log)) log = [];
    log.push({ nombre: nombre, antes: antes, despues: despues,
               fecha: fechaHoy(), hora: new Date().toLocaleTimeString('es-DO', {hour:'numeric', minute:'2-digit'}) });
    if(log.length > 300) log = log.slice(-300);
    SS('nbs_correcciones_van', log);
  } catch(e){ console.error('No se pudo apuntar la corrección de la van:', e); }
}

function abrirCargarVan(){
  loadProds();
  _van = cargarDatosVan();
  var overlay = document.getElementById('van-cargar-overlay');
  if(!overlay){
    overlay = document.createElement('div');
    overlay.id = 'van-cargar-overlay';
    document.body.appendChild(overlay);
  }
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:white;z-index:99999;overflow-y:auto;padding:14px';
  overlay.scrollTop = 0;

  // ═══ REDISEÑADA IGUAL QUE UN PEDIDO (29 jul) ═══
  // Sensei: "el cargar la van esta mal diseñado, deberia funcionar como si estuviera
  // haciendo un pedido... las mismas opciones que cuando estoy haciendo un pedido".
  // Antes: el buscador metia el producto con cantidad 1 y habia que corregirlo en una
  // cajita de 60px. Ahora es igual que el pedido: buscador con microfono y boton de
  // producto nuevo, escoges el producto, pones la cantidad con - y +, y lo agregas.
  // ⚠️ NO LLEVA PRECIO: esto no toca dinero ni inventario, solo el conteo de la van.
  overlay.innerHTML =
    '<div style="max-width:480px;margin:0 auto">'
    +'<div style="display:flex;gap:8px;margin-bottom:12px">'
    +'<button onclick="cerrarCargarVan()" style="flex:1;background:#E8EAF6;border:none;border-radius:8px;padding:11px;font-size:14px;font-weight:700;color:#1a237e;cursor:pointer">\u2190 Volver</button>'
    +'</div>'
    +'<h2 style="font-size:19px;font-weight:700;color:#1a237e;margin-bottom:2px">\ud83d\ude90 Cargar la van</h2>'
    +'<p style="font-size:12px;color:var(--nbs-muted);margin-bottom:12px">Busca cada producto, pon cu\u00e1ntos metes y agr\u00e9galo. Esto NO toca tu inventario ni tu dinero.</p>'

    // Buscador + microfono + producto nuevo, igual que el pedido
    +'<div style="display:flex;gap:6px;align-items:stretch;margin-bottom:8px">'
    +'<div class="busca-caja" style="flex:1;border:2px solid var(--nbs-gold);margin:0">'
    +'<span style="font-size:16px;flex-shrink:0;opacity:0.75">\ud83d\udd0d</span>'
    +'<input id="van-carga-buscar" class="busca-fuerte" type="search" inputmode="search" autocomplete="off" placeholder="Buscar producto..." oninput="filtrarCargaVan(this.value)">'
    +'</div>'
    +'<button id="van-carga-mic" onclick="dictarBusquedaSimple(\'van-carga-buscar\', \'van-carga-mic\')" title="Dictar por voz" style="flex-shrink:0;width:44px;background:#5E35B1;color:white;border:none;border-radius:9px;font-size:19px;cursor:pointer">\ud83c\udfa4</button>'
    +'<button onclick="abrirNuevoProdVan(document.getElementById(\'van-carga-buscar\').value||\'\')" title="Crear producto nuevo" style="flex-shrink:0;width:44px;background:#00838F;color:white;border:none;border-radius:9px;font-size:22px;font-weight:800;cursor:pointer">+</button>'
    +'</div>'
    +'<div id="van-carga-plist" style="background:white;border:1px solid #ddd;border-radius:8px;max-height:230px;overflow-y:auto;display:none;margin-bottom:10px"></div>'

    // El producto escogido, con su cantidad -- y +
    +'<div id="van-sel-wrap" style="display:none;background:#FFFDF5;border:2px solid var(--nbs-gold);border-radius:12px;padding:12px;margin-bottom:12px"></div>'

    // Formulario de producto nuevo
    +'<div id="van-np-wrap" style="display:none;background:#E0F7FA;border-radius:10px;padding:12px;margin-bottom:10px">'
    +'<div style="font-size:12px;font-weight:700;color:#00838F;margin-bottom:8px">\u2795 NUEVO PRODUCTO</div>'
    +'<label class="lbl">Marca *</label><input class="inp" id="vannp-marca" type="text" placeholder="Ej: DORCO, IMMORTAL" autocomplete="off">'
    +'<label class="lbl">Nombre del producto *</label><input class="inp" id="vannp-nombre" type="text" placeholder="Ej: Colonia Venom" autocomplete="off">'
    +'<label class="lbl">Categor\u00eda</label><input class="inp" id="vannp-cat" type="text" placeholder="Ej: Colonias, Navajas..." autocomplete="off">'
    +'<div class="r2">'
    +'<div><label class="lbl">Costo ($)</label><input class="inp" id="vannp-costo" type="text" inputmode="decimal" value="0.00" onfocus="this.select()" oninput="formatoMoneda(this)"></div>'
    +'<div><label class="lbl">Precio ($)</label><input class="inp" id="vannp-precio" type="text" inputmode="decimal" value="0.00" onfocus="this.select()" oninput="formatoMoneda(this)"></div>'
    +'</div>'
    +'<label class="lbl">Cu\u00e1ntos cargas en la van</label><input class="inp" id="vannp-stock" type="number" value="1" min="0">'
    +'<div style="display:flex;gap:8px">'
    +'<button class="btn" style="flex:1;background:#00838F;color:white;margin:0" onclick="guardarNuevoProdVan()">\u2713 Crear y agregar</button>'
    +'<button class="btn" style="flex:1;background:#546E7A;color:white;margin:0" onclick="cerrarNuevoProdVan()">Cancelar</button>'
    +'</div>'
    +'</div>'

    // Lo que va llevando
    +'<div id="van-carga-conteo" style="font-size:12px;font-weight:800;color:#2E7D32;letter-spacing:.4px;margin-bottom:6px"></div>'
    +'<div id="van-carga-lista" style="margin-bottom:14px"></div>'

    +'<div id="van-carga-botones"></div>'
    +'</div>';

  window._cargaVanTemp = {};   // pid -> cantidad que se va a cargar
  window._vanSel = null;       // el producto escogido, esperando su cantidad
  window._vanSelCant = 1;
  renderCargaVanLista();
  setTimeout(function(){ var c = document.getElementById('van-carga-buscar'); if(c) c.focus(); }, 120);
}

// Al tocar un producto de los resultados: NO se agrega de una vez. Se muestra arriba con
// su cantidad, igual que en el pedido, para que Sensei ponga cuantos metio de verdad.
function seleccionarProdVan(pid){
  loadProds();
  var p = productos.find(function(x){ return String(x.id) === String(pid); });
  if(!p) return;
  window._vanSel = p;
  window._vanSelCant = window._cargaVanTemp[String(pid)] || 1;
  var buscar = document.getElementById('van-carga-buscar');
  if(buscar) buscar.value = '';
  var plist = document.getElementById('van-carga-plist');
  if(plist){ plist.innerHTML = ''; plist.style.display = 'none'; }
  pintarSelVan();
}

function pintarSelVan(){
  var w = document.getElementById('van-sel-wrap');
  if(!w) return;
  var p = window._vanSel;
  if(!p){ w.style.display = 'none'; w.innerHTML = ''; return; }
  var yaTiene = window._cargaVanTemp[String(p.id)];
  w.style.display = 'block';
  w.innerHTML =
     '<div style="font-size:14.5px;font-weight:800;color:var(--nbs-ink);line-height:1.3;margin-bottom:8px">' + escaparHtml(p.nombre) + '</div>'
   + (yaTiene !== undefined ? '<div style="font-size:11.5px;color:#8D6E63;margin-bottom:8px">Ya llevas ' + yaTiene + ' de este \u2014 esto lo cambia</div>' : '')
   + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">'
   +   '<button onclick="cambiarCantSelVan(-1)" style="width:44px;height:44px;background:var(--nbs-red-bg);color:var(--nbs-red-dark);border:none;border-radius:10px;font-size:22px;font-weight:800;cursor:pointer">\u2212</button>'
   +   '<input id="van-sel-cant" type="number" min="1" inputmode="numeric" value="' + window._vanSelCant + '" onfocus="this.select()" oninput="window._vanSelCant = parseInt(this.value) || 1" style="flex:1;height:44px;text-align:center;font-size:20px;font-weight:800;color:var(--nbs-ink);border:1.5px solid #ccc;border-radius:10px">'
   +   '<button onclick="cambiarCantSelVan(1)" style="width:44px;height:44px;background:var(--nbs-green-bg);color:var(--nbs-green-text);border:none;border-radius:10px;font-size:22px;font-weight:800;cursor:pointer">+</button>'
   + '</div>'
   + '<div style="display:flex;gap:8px">'
   +   '<button onclick="agregarSelVan()" style="flex:2;padding:13px;background:#2E7D32;color:white;border:none;border-radius:10px;font-size:14px;font-weight:800;cursor:pointer">\u2713 Agregar a la van</button>'
   +   '<button onclick="cancelarSelVan()" style="flex:1;padding:13px;background:#ECEFF1;color:#546E7A;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer">Cancelar</button>'
   + '</div>';
  setTimeout(function(){ var c = document.getElementById('van-sel-cant'); if(c){ try{ c.focus(); c.select(); }catch(e){} } }, 80);
}

function cambiarCantSelVan(d){
  var n = (parseInt(window._vanSelCant, 10) || 1) + d;
  if(n < 1) n = 1;
  window._vanSelCant = n;
  var c = document.getElementById('van-sel-cant');
  if(c) c.value = String(n);
}

function agregarSelVan(){
  var p = window._vanSel;
  if(!p) return;
  var n = parseInt(window._vanSelCant, 10) || 1;
  if(n < 1) n = 1;
  window._cargaVanTemp[String(p.id)] = n;
  window._vanSel = null;
  pintarSelVan();
  renderCargaVanLista();
  var buscar = document.getElementById('van-carga-buscar');
  if(buscar) buscar.focus();
}

function cancelarSelVan(){
  window._vanSel = null;
  pintarSelVan();
  var buscar = document.getElementById('van-carga-buscar');
  if(buscar) buscar.focus();
}

function cambiarCantItemVan(pid, d){
  var actual = window._cargaVanTemp[String(pid)] || 0;
  var n = actual + d;
  if(n < 1){ quitarDeCargaVan(pid); return; }
  window._cargaVanTemp[String(pid)] = n;
  renderCargaVanLista();
}

function cerrarCargarVan(){
  var o = document.getElementById('van-cargar-overlay');
  if(o) o.style.display = 'none';
}

function filtrarCargaVan(q){
  var el = document.getElementById('van-carga-plist');
  if(!el) return;
  el.innerHTML = '';
  if(!q || !q.trim()){ el.style.display = 'none'; return; }
  var lista = filtrarPorBusqueda(productos, q, function(p){ return p.nombre; }).slice(0, 30);
  el.style.display = 'block';
  lista.forEach(function(p){
    var ya = window._cargaVanTemp[String(p.id)] !== undefined;
    var d = document.createElement('div');
    d.style.cssText = 'padding:10px;border-bottom:1px solid #f0f0f0;cursor:pointer;font-size:13px;background:'+(ya?'#F1F8E9':'white')+';display:flex;align-items:center;justify-content:space-between;gap:8px';
    d.innerHTML = '<span style="flex:1;min-width:0;font-weight:600;color:var(--nbs-ink)">'+escaparHtml(p.nombre)+'</span>'
      +(ya ? '<span style="font-size:11px;color:var(--nbs-green-text);font-weight:700">✓ agregado</span>'
           : '<span style="font-size:18px;color:var(--nbs-gold)">+</span>');
    d.onclick = (function(prod){ return function(){ seleccionarProdVan(prod.id); }; })(p);
    el.appendChild(d);
  });
  // Siempre ofrecer crear un producto nuevo con lo que escribió (útil al armar inventario desde cero)
  var crear = document.createElement('div');
  crear.style.cssText = 'padding:11px;cursor:pointer;font-size:13px;background:#E0F7FA;display:flex;align-items:center;gap:8px;font-weight:700;color:#00838F;border-top:2px solid #B2EBF2';
  crear.innerHTML = '<span style="font-size:16px">➕</span><span>Crear producto nuevo: "'+escaparHtml(q.trim())+'"</span>';
  crear.onclick = (function(texto){ return function(){ abrirNuevoProdVan(texto); }; })(q.trim());
  el.appendChild(crear);
}

function agregarACargaVan(prod){
  if(window._cargaVanTemp[String(prod.id)] === undefined){
    window._cargaVanTemp[String(prod.id)] = 1;
  }
  document.getElementById('van-carga-buscar').value = '';
  document.getElementById('van-carga-plist').style.display = 'none';
  renderCargaVanLista();
}

// Genera el siguiente ID NUMERICO libre (no usa 'custom_' que dio problemas antes).
function abrirNuevoProdVan(nombreSugerido){
  var wrap = document.getElementById('van-np-wrap');
  if(!wrap) return;
  wrap.style.display = 'block';
  document.getElementById('van-carga-plist').style.display = 'none';
  document.getElementById('van-carga-buscar').value = '';
  // Rellenar el nombre con lo que ya había escrito
  document.getElementById('vannp-marca').value = '';
  document.getElementById('vannp-nombre').value = nombreSugerido || '';
  document.getElementById('vannp-cat').value = '';
  document.getElementById('vannp-costo').value = '0.00';
  document.getElementById('vannp-precio').value = '0.00';
  document.getElementById('vannp-stock').value = '1';
  // Llevar la vista al formulario
  wrap.scrollIntoView({ behavior:'smooth', block:'center' });
}

function cerrarNuevoProdVan(){
  var wrap = document.getElementById('van-np-wrap');
  if(wrap) wrap.style.display = 'none';
}

function guardarNuevoProdVan(){
  loadProds();
  var marca = document.getElementById('vannp-marca').value.trim();
  if(!marca){ alert('La marca es requerida'); return; }
  var nombre = document.getElementById('vannp-nombre').value.trim();
  if(!nombre){ alert('El nombre del producto es requerido'); return; }
  var nombreCompleto = marca + ' ' + nombre;
  var cat = document.getElementById('vannp-cat').value.trim();
  var costo = dinero(document.getElementById('vannp-costo').value) || 0;
  var precio = dinero(document.getElementById('vannp-precio').value) || 0;
  var stock = parseInt(document.getElementById('vannp-stock').value) || 0;

  // ID numerico secuencial (como los productos originales del catalogo)
  var nuevoId = siguienteIdProductoNumerico();
  var nuevoProd = { id: nuevoId, marca: marca, nombreCorto: nombre, nombre: nombreCompleto, cat: cat, sku: '', costo: costo, precio: precio, stock: stock, unidad: 'unidad' };
  productos.push(nuevoProd);
  SS('np', productos); // se guarda en el catalogo general

  // Agregarlo a la carga de la van con la cantidad que puso como stock (o 1)
  window._cargaVanTemp[String(nuevoId)] = stock > 0 ? stock : 1;

  cerrarNuevoProdVan();
  renderCargaVanLista();
  alert('✅ "'+nombreCompleto+'" creado en el catálogo y agregado a la carga.');
}

function fijarCargaVan(pid, valor){
  var n = parseInt(valor);
  if(isNaN(n) || n < 0) n = 0;
  window._cargaVanTemp[String(pid)] = n;
}

function quitarDeCargaVan(pid){
  delete window._cargaVanTemp[String(pid)];
  renderCargaVanLista();
}

function renderCargaVanLista(){
  var el = document.getElementById('van-carga-lista');
  var elConteo = document.getElementById('van-carga-conteo');
  var elBotones = document.getElementById('van-carga-botones');
  if(!el) return;
  loadProds();
  var pids = Object.keys(window._cargaVanTemp);

  // Cuantos productos y cuantas unidades lleva, como el pedido
  var unidades = pids.reduce(function(a, pid){ return a + (window._cargaVanTemp[pid] || 0); }, 0);
  if(elConteo){
    elConteo.textContent = pids.length
      ? 'LLEVAS ' + pids.length + ' producto(s) \u00b7 ' + unidades + ' unidad(es)'
      : '';
  }

  if(!pids.length){
    el.innerHTML = '<div style="text-align:center;color:#bbb;font-size:13px;padding:18px">Busca un producto arriba para empezar.</div>';
    if(elBotones) elBotones.innerHTML = '';
    return;
  }

  el.innerHTML = pids.map(function(pid){
    var prod = productos.find(function(p){ return String(p.id) === pid; });
    var nombre = prod ? prod.nombre : ('Producto #' + pid);
    var cant = window._cargaVanTemp[pid];
    return '<div class="card" style="margin-bottom:8px;padding:11px">'
      + '<div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:8px">'
      +   '<div style="flex:1;font-size:13.5px;font-weight:700;color:var(--nbs-ink);line-height:1.3">' + escaparHtml(nombre) + '</div>'
      +   '<button onclick="quitarDeCargaVan(\'' + pid + '\')" title="Quitar" style="flex-shrink:0;width:30px;height:30px;background:var(--nbs-red-bg);color:var(--nbs-red-dark);border:none;border-radius:7px;font-size:14px;cursor:pointer">\ud83d\uddd1\ufe0f</button>'
      + '</div>'
      + '<div style="display:flex;align-items:center;gap:7px">'
      +   '<button onclick="cambiarCantItemVan(\'' + pid + '\',-1)" style="width:38px;height:38px;background:var(--nbs-red-bg);color:var(--nbs-red-dark);border:none;border-radius:9px;font-size:20px;font-weight:800;cursor:pointer">\u2212</button>'
      +   '<input type="number" min="1" inputmode="numeric" value="' + cant + '" onfocus="this.select()" oninput="fijarCargaVan(\'' + pid + '\', this.value)" style="flex:1;height:38px;text-align:center;font-size:17px;font-weight:800;color:var(--nbs-ink);border:1.5px solid #ccc;border-radius:9px">'
      +   '<button onclick="cambiarCantItemVan(\'' + pid + '\',1)" style="width:38px;height:38px;background:var(--nbs-green-bg);color:var(--nbs-green-text);border:none;border-radius:9px;font-size:20px;font-weight:800;cursor:pointer">+</button>'
      + '</div>'
      + '</div>';
  }).join('');

  // Los dos botones de guardar solo salen cuando ya hay algo que guardar
  if(elBotones){
    elBotones.innerHTML =
       '<button onclick="guardarCargaVan(\'sumar\')" style="width:100%;padding:14px;background:#2E7D32;color:white;border:none;border-radius:10px;font-size:14.5px;font-weight:800;cursor:pointer;margin-bottom:8px">\u2713 Sumar a la van</button>'
     + '<button onclick="guardarCargaVan(\'reemplazar\')" style="width:100%;padding:12px;background:none;border:2px solid #546E7A;color:#546E7A;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer">\ud83d\udd04 Empezar de cero (reemplazar todo)</button>'
     + '<div style="font-size:11.5px;color:var(--nbs-muted);text-align:center;margin-top:7px;line-height:1.4">"Sumar" agrega a lo que ya hab\u00eda.<br>"Empezar de cero" borra el conteo anterior \u2014 es el que sirve para el inventario.</div>';
  }
}

function guardarCargaVan(modo){
  var pids = Object.keys(window._cargaVanTemp);
  if(!pids.length){ alert('No agregaste ningún producto para cargar.'); return; }
  _van = cargarDatosVan();

  if(modo === 'reemplazar'){
    if(!confirm('¿Empezar la van de cero? Esto borra el conteo anterior y arranca de nuevo con lo que acabas de poner.')) return;
    _van.cargado = {};
  }
  if(!_van.inicial) _van.inicial = {};
  if(modo === 'reemplazar') _van.inicial = {};
  pids.forEach(function(pid){
    var n = window._cargaVanTemp[pid] || 0;
    if(n <= 0) return;
    if(modo === 'sumar'){
      _van.cargado[pid] = (_van.cargado[pid] || 0) + n;
      _van.inicial[pid] = (_van.inicial[pid] || 0) + n;
    } else {
      _van.cargado[pid] = n;
      _van.inicial[pid] = n;
    }
  });
  // La fecha de carga se pone a HOY: desde hoy se cuentan las ventas como salidas de la van.
  _van.fechaCarga = fechaHoyISO();
  guardarDatosVan(_van);
  cerrarCargarVan();
  abrirVan(); // refresca la pantalla
  alert('Van actualizada. El conteo de ventas arranca desde hoy.');
}

// Arma un texto con lo que hay que recargar (los productos bajos) y lo comparte.
function compartirRecargaVan(){
  loadProds();
  var estado = calcularEstadoVan();
  var bajos = estado.filas.filter(function(f){ return f.bajo; });
  if(!bajos.length){
    alert('No hay nada bajo por ahora. Todo lo que cargaste todavía tiene suficiente en la van.');
    return;
  }
  var lineas = ['RECARGA DE LA VAN \u2014 NBS', fechaHoy(), '(seg\u00fan lo que se vendi\u00f3)', ''];
  bajos.forEach(function(f){
    var prod = productos.find(function(p){ return String(p.id) === String(f.pid); });
    var marca = (prod && prod.marca) ? prod.marca.trim() : '';
    var nombreCorto = (prod && prod.nombreCorto) ? prod.nombreCorto.trim() : '';
    var linea;
    if(marca && nombreCorto){
      linea = f.vendido + '  \u00b7  ' + marca + '  \u00b7  ' + nombreCorto;
    } else {
      linea = f.vendido + '  \u00b7  ' + f.nombre;
    }
    lineas.push(linea);
    lineas.push('');
  });
  lineas.push('Total: ' + bajos.length + ' productos para recargar');
  var texto = lineas.join('\n');

  if(navigator.share){
    navigator.share({ title:'Recarga de la Van NBS', text: texto }).catch(function(){});
  } else {
    try {
      navigator.clipboard.writeText(texto);
      alert('Lista de recarga copiada. P\u00e9gala donde quieras.\n\n' + texto);
    } catch(e){
      alert(texto);
    }
  }
}

function abrirRelleno(){
  loadProds();
  listaRelleno = LS('nrelleno', { desde: null, hasta: null, items: [] });
  if(!listaRelleno.items) listaRelleno.items = [];
  // Si es la primera vez, arrancar con los ultimos 30 dias
  if(!listaRelleno.desde) listaRelleno.desde = fechaISOhace(30);
  if(!listaRelleno.hasta) listaRelleno.hasta = fechaISOhace(0);
  document.getElementById('rel-desde').value = listaRelleno.desde;
  document.getElementById('rel-hasta').value = listaRelleno.hasta;
  document.getElementById('rel-buscar').value = '';
  document.getElementById('rel-plist').style.display = 'none';
  if(!listaRelleno.modo) listaRelleno.modo = 'todo';
  pintarBotonesModoRelleno();
  renderRelleno();
}

function rangoRapidoRelleno(dias){
  // dias = 0 significa "todo": desde bien atras para que entre cualquier venta
  document.getElementById('rel-desde').value = dias === 0 ? '2000-01-01' : fechaISOhace(dias);
  document.getElementById('rel-hasta').value = fechaISOhace(0);
  llenarRellenoAuto();
}

// Convierte la fecha MM/DD/AAAA que usa la app a AAAA-MM-DD, para poder compararlas
function guardarRelleno(){
  listaRelleno.desde = document.getElementById('rel-desde').value;
  listaRelleno.hasta = document.getElementById('rel-hasta').value;
  SS('nrelleno', listaRelleno);
}

// El modo decide QUE se mete al llenar la lista sola:
//   'poco' = solo lo que vendiste Y ya te queda poco (stock <= minimo). Lo que urge reponer.
//   'todo' = todo lo que vendiste en el rango, sin importar cuanto te quede.
function modoRellenoActual(){
  // Predeterminado 'todo': Sensei repone lo que vende porque no tiene inventario fijo en la van.
  return (listaRelleno && listaRelleno.modo) ? listaRelleno.modo : 'todo';
}
function pintarBotonesModoRelleno(){
  var modo = modoRellenoActual();
  var bP = document.getElementById('rel-modo-poco');
  var bT = document.getElementById('rel-modo-todo');
  if(!bP || !bT) return;
  var activo = 'background:#6A1B9A;color:white';
  var inactivo = 'background:#F0F0F2;color:var(--nbs-ink)';
  bP.setAttribute('style', bP.getAttribute('style').replace(/background:[^;]+;color:[^;"]+/, modo==='poco'?activo:inactivo));
  bT.setAttribute('style', bT.getAttribute('style').replace(/background:[^;]+;color:[^;"]+/, modo==='todo'?activo:inactivo));
}
function cambiarModoRelleno(modo){
  listaRelleno.modo = modo;
  SS('nrelleno', listaRelleno);
  pintarBotonesModoRelleno();
}

// Llena la lista SOLA con lo vendido en el rango de fechas elegido.
// Respeta lo que ya tengas puesto a mano: no borra, solo agrega lo que falte.
function llenarRellenoAuto(){
  loadProds();
  var desde = document.getElementById('rel-desde').value;
  var hasta = document.getElementById('rel-hasta').value;
  var vendidos = vendidosEnRango(desde, hasta);
  var modo = modoRellenoActual();

  var pids = Object.keys(vendidos);
  if(!pids.length){
    alert('No vendiste nada en esas fechas. Prueba con otro rango.');
    return;
  }

  var agregados = 0, saltadosPorStock = 0;
  pids.forEach(function(pid){
    var prod = productos.find(function(p){ return String(p.id) === String(pid); });
    if(!prod) return; // el producto pudo haber sido borrado
    var vend = vendidos[pid] || 0;
    var stock = prod.stock || 0;
    var min = prod.min || 0;

    // En modo 'poco', solo entra si ya te queda poco (stock por debajo o igual al minimo)
    if(modo === 'poco' && stock > min){ saltadosPorStock++; return; }

    var yaIdx = -1;
    for(var i=0; i<(listaRelleno.items || []).length; i++){
      if(String(listaRelleno.items[i].pid) === String(prod.id)){ yaIdx = i; break; }
    }
    if(yaIdx >= 0){
      // ya estaba en la lista: solo actualizo los numeros de referencia, no piso la cantidad que pusiste
      listaRelleno.items[yaIdx].vendidos = vend;
      listaRelleno.items[yaIdx].stock = stock;
    } else {
      // Cuanto reponer: en modo 'todo' repones lo mismo que vendiste (no tienes inventario fijo).
      // En modo 'poco' repones lo vendido menos lo que ya te queda.
      var sugerida = (modo === 'todo') ? Math.max(1, vend) : Math.max(1, vend - stock);
      listaRelleno.items.push({ pid: prod.id, nombre: prod.nombre, cant: sugerida, vendidos: vend, stock: stock });
      agregados++;
    }
  });

  SS('nrelleno', listaRelleno);
  renderRelleno();

  var msg = 'Se agregaron ' + agregados + ' producto(s) a tu lista.';
  if(modo === 'poco' && saltadosPorStock > 0){
    msg += '\n\n(' + saltadosPorStock + ' producto(s) que vendiste NO se agregaron porque todavía te queda suficiente. Toca "Todo lo que vendí" si los quieres ver.)';
  }
  if(agregados === 0 && modo === 'poco' && saltadosPorStock > 0){
    msg = 'Vendiste ' + saltadosPorStock + ' producto(s), pero de todos te queda suficiente — no hay nada urgente que reponer. Toca "Todo lo que vendí" si quieres verlos igual.';
  }
  alert(msg);
}

function renderRelleno(){
  guardarRelleno();
  var el = document.getElementById('rel-lista');
  var acciones = document.getElementById('rel-acciones');
  if(!el) return;

  if(!(listaRelleno.items || []).length){
    el.innerHTML = '<div class="card" style="text-align:center;color:#bbb;font-size:13px;padding:20px">Tu lista está vacía.<br>Busca un producto arriba para agregarlo.</div>';
    acciones.style.display = 'none';
    return;
  }
  acciones.style.display = 'block';

  var totalUnidades = (listaRelleno.items || []).reduce(function(s,it){ return s + (it.cant||0); }, 0);
  var html = '<div class="card" style="margin-bottom:10px;padding:12px">'
    +'<div style="display:flex;justify-content:space-between;align-items:center">'
    +'<span style="font-size:13px;font-weight:700;color:var(--nbs-ink)">📋 Tu lista</span>'
    +'<span style="font-size:13px;font-weight:800;color:var(--nbs-gold-dark)">'+(listaRelleno.items || []).length+' producto(s) · '+totalUnidades+' piezas en total</span>'
    +'</div></div>';

  // ─── AGRUPAR POR MARCA (pedido por Sensei, 19 jul 2026) ───
  // Los productos se muestran agrupados por marca, para rellenar la van más rápido
  // (igual que están organizados en la van). Cada item guarda su índice original 'i'
  // para que los botones +/− y quitar sigan funcionando.
  var productos = LS('np', []);
  var grupos = {}; // marca -> [ {it, i} ]
  var ordenMarcas = [];
  (listaRelleno.items || []).forEach(function(it, i){
    // Buscar la marca del producto original
    var prod = productos.find(function(p){ return String(p.id) === String(it.pid); });
    var marca = (prod && prod.marca) ? prod.marca.toUpperCase() : 'SIN MARCA';
    if(!grupos[marca]){ grupos[marca] = []; ordenMarcas.push(marca); }
    grupos[marca].push({ it: it, i: i });
  });
  // Ordenar las marcas alfabéticamente (SIN MARCA al final)
  ordenMarcas.sort(function(a,b){
    if(a === 'SIN MARCA') return 1;
    if(b === 'SIN MARCA') return -1;
    return a.localeCompare(b);
  });

  ordenMarcas.forEach(function(marca){
    var items = grupos[marca];
    var piezasMarca = items.reduce(function(s,x){ return s + (x.it.cant||0); }, 0);
    // Encabezado de la marca
    html += '<div style="background:var(--nbs-gold);color:white;border-radius:8px;padding:8px 12px;margin:12px 0 8px;display:flex;justify-content:space-between;align-items:center">'
      +'<span style="font-size:13px;font-weight:800">📦 '+escaparHtml(marca)+'</span>'
      +'<span style="font-size:11px;font-weight:600;opacity:0.9">'+items.length+' producto(s) · '+piezasMarca+' pzas</span>'
      +'</div>';
    // Los productos de esa marca
    items.forEach(function(x){
      var it = x.it, i = x.i;
      html += '<div class="card" style="margin-bottom:8px;padding:10px;display:flex;align-items:center;gap:9px">'
        +'<div style="display:flex;align-items:center;gap:4px;flex-shrink:0">'
        +'<button onclick="cambiarCantRelleno('+i+',-1)" style="width:32px;height:32px;background:var(--nbs-red-bg);color:var(--nbs-red-dark);border:none;border-radius:7px;cursor:pointer;font-size:16px;font-weight:700;line-height:1">−</button>'
        +'<input id="rel-cant-'+i+'" type="number" min="1" value="'+it.cant+'" oninput="fijarCantRelleno('+i+', this.value)" style="width:52px;padding:7px 2px;border:0.5px solid #ddd;border-radius:6px;font-size:14px;text-align:center;font-weight:700">'
        +'<button onclick="cambiarCantRelleno('+i+',1)" style="width:32px;height:32px;background:var(--nbs-green-bg);color:var(--nbs-green-text);border:none;border-radius:7px;cursor:pointer;font-size:16px;font-weight:700;line-height:1">+</button>'
        +'</div>'
        +'<div style="flex:1;min-width:0">'
        +'<div style="font-size:13px;font-weight:600;color:var(--nbs-ink)">'+escaparHtml(it.nombre)+'</div>'
        +(it.vendidos !== undefined ? '<div style="font-size:11px;color:var(--nbs-muted)">Vendiste '+it.vendidos+' · Te quedan '+(it.stock !== undefined ? it.stock : '?')+'</div>' : '')
        +'</div>'
        +'<button onclick="quitarDeRelleno('+i+')" style="background:var(--nbs-red-bg);color:var(--nbs-red-dark);border:none;border-radius:7px;width:32px;height:32px;cursor:pointer;font-size:14px;flex-shrink:0">✕</button>'
        +'</div>';
    });
  });
  el.innerHTML = html;
}

// El buscador solo toca su propia lista de resultados -no vuelve a dibujar toda la pantalla-,
// para no perder lo que estas escribiendo.
function filterRelleno(q){
  loadProds();
  var el = document.getElementById('rel-plist');
  if(!el) return;
  el.innerHTML = '';
  if(!q || !q.trim()){ el.style.display = 'none'; return; }

  var desde = document.getElementById('rel-desde').value;
  var hasta = document.getElementById('rel-hasta').value;
  var vendidos = vendidosEnRango(desde, hasta);

  var lista = filtrarPorBusqueda(productos, q, function(p){ return p.nombre; }).slice(0, 30);
  if(!lista.length){ el.style.display = 'none'; return; }
  el.style.display = 'block';

  lista.forEach(function(p){
    var vend = vendidos[String(p.id)] || 0;
    var yaEsta = (listaRelleno.items || []).some(function(it){ return String(it.pid) === String(p.id); });
    var d = document.createElement('div');
    d.style.cssText = 'padding:10px;border-bottom:1px solid #f0f0f0;cursor:pointer;font-size:13px;background:'+(yaEsta?'#F1F8E9':'white')+';display:flex;align-items:center;gap:9px';
    d.innerHTML = '<div style="flex:1;min-width:0">'
      +'<div style="font-weight:600;color:var(--nbs-ink)">'+escaparHtml(p.nombre)+'</div>'
      +'<div style="font-size:11px;margin-top:2px">'
      +'<span style="color:'+(vend>0?'var(--nbs-gold-dark)':'#bbb')+';font-weight:700">Vendiste '+vend+'</span>'
      +'<span style="color:#ccc"> · </span>'
      +'<span style="color:'+((p.stock||0) <= (p.min||0) ? 'var(--nbs-red-dark)' : 'var(--nbs-muted)')+'">Te quedan '+(p.stock||0)+'</span>'
      +'</div></div>'
      +(yaEsta ? '<span style="font-size:11px;color:var(--nbs-green-text);font-weight:700;flex-shrink:0">✓ ya está</span>'
               : '<span style="font-size:18px;color:var(--nbs-gold);flex-shrink:0">+</span>');
    d.onclick = (function(prod, vendidas){
      return function(){ agregarARelleno(prod, vendidas); };
    })(p, vend);
    el.appendChild(d);
  });
}

function agregarARelleno(prod, vendidas){
  var yaIdx = -1;
  for(var i=0; i<(listaRelleno.items || []).length; i++){
    if(String(listaRelleno.items[i].pid) === String(prod.id)){ yaIdx = i; break; }
  }
  if(yaIdx >= 0){
    listaRelleno.items[yaIdx].cant += 1; // ya estaba: le suma uno
  } else {
    // Sugerencia de cantidad: lo que vendiste menos lo que te queda -nunca menos de 1-.
    // Es solo un punto de partida; tu decides el numero final.
    var sugerida = Math.max(1, (vendidas || 0) - (prod.stock || 0));
    listaRelleno.items.push({
      pid: prod.id,
      nombre: prod.nombre,
      cant: sugerida,
      vendidos: vendidas || 0,
      stock: prod.stock || 0
    });
  }
  document.getElementById('rel-buscar').value = '';
  document.getElementById('rel-plist').style.display = 'none';
  llenarRellenoAuto();
}

function fijarCantRelleno(i, valor){
  if(!listaRelleno.items[i]) return;
  var n = parseInt(valor, 10);
  if(!n || n < 1) n = 1;
  listaRelleno.items[i].cant = n;
  guardarRelleno();
}

function cambiarCantRelleno(i, delta){
  if(!listaRelleno.items[i]) return;
  var nueva = (listaRelleno.items[i].cant || 1) + delta;
  if(nueva < 1) nueva = 1;
  listaRelleno.items[i].cant = nueva;
  var input = document.getElementById('rel-cant-'+i);
  if(input) input.value = nueva;
  guardarRelleno();
  renderRelleno();
}

function quitarDeRelleno(i){
  if(!listaRelleno.items[i]) return;
  listaRelleno.items.splice(i, 1);
  renderRelleno();
}

function vaciarListaRelleno(){
  if(!(listaRelleno.items || []).length) return;
  if(!confirm('¿Vaciar la lista y empezar de nuevo?')) return;
  listaRelleno.items = [];
  renderRelleno();
}

// Arma la imagen de la lista: el escudo arriba, el titulo, y los productos con su cantidad.
// SIN precios ni costos -es para mandarsela a quien vaya a cargar la van-.
function generarCanvasRelleno(){
  var items = listaRelleno.items;
  var pad = 24;
  var W = 620;
  var logoW = Math.min(W*0.28, 150);
  var logo = LOGO_IMG_COLOR && LOGO_IMG_COLOR.naturalWidth > 0 ? LOGO_IMG_COLOR : LOGO_IMG;
  var logoH = (logo && logo.naturalWidth > 0) ? logoW * (logo.naturalHeight / logo.naturalWidth) : 0;
  var alturaFila = 46;
  var H = 20 + logoH + 90 + (items.length * alturaFila) + 80;

  var canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  var ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  var y = 18;
  if(logo && logo.naturalWidth > 0){
    ctx.drawImage(logo, W/2 - logoW/2, y, logoW, logoH);
    y += logoH + 16;
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = '#1a237e';
  ctx.font = '700 26px Georgia, serif';
  ctx.fillText('LISTA DE RELLENO DE NBS', W/2, y);
  y += 24;

  ctx.font = '13px Arial, sans-serif';
  ctx.fillStyle = '#999';
  ctx.fillText(fechaHoy(), W/2, y);
  y += 26;

  ctx.strokeStyle = '#1a237e';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(W-pad, y); ctx.stroke();
  y += 30;

  items.forEach(function(it, i){
    if(i % 2 === 1){
      ctx.fillStyle = '#F7F7FA';
      ctx.fillRect(pad-6, y-22, W-2*pad+12, alturaFila-4);
    }
    // La cantidad, en un recuadro dorado a la izquierda
    ctx.fillStyle = '#D4A017';
    if(typeof ctx.roundRect === 'function'){
      ctx.beginPath();
      ctx.roundRect(pad, y-19, 54, 30, 7);
      ctx.fill();
    } else {
      // Respaldo para navegadores que no tienen esquinas redondeadas -que no se rompa la imagen-
      ctx.fillRect(pad, y-19, 54, 30);
    }
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 17px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(it.cant), pad+27, y+2);
    // El nombre a la derecha
    ctx.fillStyle = '#1a1a2e';
    ctx.font = '15px Arial, sans-serif';
    ctx.textAlign = 'left';
    var nombre = it.nombre;
    while(ctx.measureText(nombre).width > W - pad*2 - 70 && nombre.length > 4){
      nombre = nombre.substring(0, nombre.length-1);
    }
    if(nombre !== it.nombre) nombre += '…';
    ctx.fillText(nombre, pad+68, y+2);
    y += alturaFila;
  });

  y += 6;
  ctx.strokeStyle = '#ddd'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(W-pad, y); ctx.stroke();
  y += 28;

  var totalUnidades = items.reduce(function(s,it){ return s + (it.cant||0); }, 0);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#1a237e';
  ctx.font = '700 16px Arial, sans-serif';
  ctx.fillText(totalUnidades + ' unidades · ' + items.length + ' productos', W/2, y);

  return canvas;
}

function compartirListaRelleno(){
  if(!(listaRelleno.items || []).length){ alert('Tu lista está vacía.'); return; }
  loadProds();
  var lineas = ['LISTA DE RELLENO — NBS', fechaHoy(), ''];
  (listaRelleno.items || []).forEach(function(it){
    // Buscar el producto para sacar marca y nombre por separado si los tiene
    var prod = productos.find(function(p){ return String(p.id) === String(it.pid); });
    var marca = (prod && prod.marca) ? prod.marca.trim() : '';
    var nombreCorto = (prod && prod.nombreCorto) ? prod.nombreCorto.trim() : '';
    var linea;
    if(marca && nombreCorto){
      // Producto con marca separada: cantidad · marca · nombre
      linea = it.cant + '  ·  ' + marca + '  ·  ' + nombreCorto;
    } else {
      // Producto viejo (todo junto): cantidad · nombre completo
      linea = it.cant + '  ·  ' + (it.nombre || (prod ? prod.nombre : 'Producto'));
    }
    lineas.push(linea);
    lineas.push('');
  });
  lineas.push('Total: ' + (listaRelleno.items || []).length + ' productos para reponer');
  var texto = lineas.join('\n');

  if(navigator.share){
    navigator.share({ title:'Lista de Relleno NBS', text: texto }).catch(function(){});
  } else {
    // Respaldo si el telefono no deja compartir: mostrar para copiar
    if(typeof mostrarBackupTexto === 'function'){ mostrarBackupTexto(texto); }
    else {
      try{ navigator.clipboard.writeText(texto); alert('Lista copiada:\n\n'+texto); }
      catch(e){ alert(texto); }
    }
  }
}

function registrarVisitaBarbero(cid, compro){
  if(!cid) return;
  var visitas = LS('nvisitas_barberos', {});
  var k = String(cid);
  if(!visitas[k]) visitas[k] = { compro: [], noCompro: [] };
  if(!visitas[k].compro) visitas[k].compro = [];
  if(!visitas[k].noCompro) visitas[k].noCompro = [];
  var hoy = fechaHoy();
  // 🔒 Que no se apunte dos veces el mismo día. Si figuraba como "no compró" y
  // ahora SÍ compró, se corrige en vez de duplicar. -16 ago-
  var yaCompro = visitas[k].compro.indexOf(hoy) >= 0;
  var yaNo = visitas[k].noCompro.indexOf(hoy) >= 0;
  if(compro){
    if(yaCompro) return;
    if(yaNo) visitas[k].noCompro = visitas[k].noCompro.filter(function(f){ return f !== hoy; });
    visitas[k].compro.push(hoy);
  } else {
    if(yaCompro || yaNo) return;    // ya hay récord de hoy: no se pisa
    visitas[k].noCompro.push(hoy);
  }
  SS('nvisitas_barberos', visitas);
}


// ═══════════════════════════════════════════════════════════════════
//  GUARDAR UN PEDIDO SUELTO, SIN ESPERAR AL FINAL  (12 ago 2026)
// ═══════════════════════════════════════════════════════════════════

// Guarda el pedido de UN barbero de la lista de varios. Lo saca de la lista de
// pendientes de la pantalla y lo manda a los pedidos de verdad.

// ═══════════════════════════════════════════════════════════════════
//  EL ORDEN DE LOS BARBEROS, COMO SENSEI LO QUIERA  (12 ago 2026)
// ═══════════════════════════════════════════════════════════════════

// El orden que él puso para una barbería: una lista de ids.
function asisAgregarAlRelleno(cual){
  var lista = loQueSeAcaba(21);
  if(cual === 'agotados') lista = lista.filter(function(x){ return x.stock <= 0; });
  else if(cual === 'porAcabarse') lista = lista.filter(function(x){ return x.stock > 0; });
  if(!lista.length) return;

  var rel = LS('nrelleno', {});
  if(!rel.items) rel.items = [];
  var puestos = 0;
  lista.forEach(function(x){
    var ya = rel.items.some(function(i){ return String(i.pid) === String(x.prod.id); });
    if(ya) return;
    // Lo que vende en un mes, para no quedarse corto
    rel.items.push({ pid: x.prod.id, cant: Math.max(1, Math.round(x.alMes)) });
    puestos++;
  });
  SS('nrelleno', rel);
  try { listaRelleno = LS('nrelleno', {}); } catch(e){}
  cerrarAsistente();
  avisoGrande('\u2705 Se agregaron ' + puestos + ' producto(s) a tu Lista de Relleno.'
    + (puestos ? '\n\nCon la cantidad que vendes en un mes.' : ''));
  try { ir('p-relleno'); } catch(e){}
}

function cambiarIntervaloVisita(cid){
  clientes = LS('ncl', []);
  var i = clientes.findIndex(function(c){ return String(c.id) === String(cid); });
  if(i < 0) return;
  var actual = parseInt(clientes[i].intervaloVisitaDias || 0, 10) || 0;
  var txt = prompt('\u00bfCada cu\u00e1ntos d\u00edas quieres visitar a ' + nombreCl(clientes[i]) + '?\n\n'
    + '(deja 0 para no ponerle ninguno)', String(actual));
  if(txt === null) return;
  var n = parseInt(String(txt).replace(/[^0-9]/g, ''), 10);
  if(isNaN(n) || n < 0){ alert('Escribe un n\u00famero de d\u00edas.'); return; }
  clientes[i].intervaloVisitaDias = n;
  SS('ncl', clientes);
  try { repintarCuentaCliente(cid); } catch(e){}
  try { avisoChico(n ? '\ud83d\udcc5 Cada ' + n + ' d\u00edas' : '\ud83d\udcc5 Sin intervalo'); } catch(e){}
}


// ── 🏷️ SUS PRECIOS ESPECIALES, editables desde su cuenta ──
function rutaDocumento(archivo){
  // La app y los documentos están en la misma carpeta de GitHub Pages.
  // Se usa la dirección actual de la app, quitando el nombre del archivo .html
  var base = window.location.href.split('/').slice(0, -1).join('/');
  return base + '/' + archivo;
}

function renderRutas(){
  var el = document.getElementById('rutas-contenido');
  if(!el) return;
  var diaActual = getDiaHoy();
  var diaIdx = DIAS_KEYS.indexOf(diaActual);

  // Seccion de otros negocios pendientes por visitar (tiendas, meat market, etc - no siguen la ruta semanal)
  var pendientesNegocios = negociosParaVisitar();
  if(pendientesNegocios.length){
    var bloqueNegocios = document.createElement('div');
    bloqueNegocios.style.cssText = 'background:#FFEBEE;border-radius:12px;padding:14px;margin-bottom:16px';
    bloqueNegocios.innerHTML = '<div style="font-size:13px;font-weight:800;color:#C62828;margin-bottom:8px">🔔 Otros negocios para visitar ('+pendientesNegocios.length+')</div>';
    pendientesNegocios.forEach(function(item){
      var atraso = item.diasAtraso===null ? 'Nunca visitada' : (item.diasAtraso===0 ? 'Justo hoy' : 'Hace '+item.diasAtraso+' día(s) de atraso');
      var fila = document.createElement('div');
      fila.style.cssText = 'display:flex;justify-content:space-between;align-items:center;background:white;border-radius:8px;padding:10px;margin-bottom:6px';
      fila.innerHTML = '<div><div style="font-size:13px;font-weight:700;color:#1a237e">'+item.nombre+'</div><div style="font-size:11px;color:#C62828">'+atraso+'</div></div>';
      var btn = document.createElement('button');
      btn.textContent = '✓ Marqué la visita';
      btn.style.cssText = 'padding:8px 12px;background:#1565C0;color:white;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;flex-shrink:0';
      btn.onclick = (function(cid){ return function(){ marcarVisitaNegocio(cid); renderRutas(); }; })(item.id);
      fila.appendChild(btn);
      bloqueNegocios.appendChild(fila);
    });
    el.innerHTML = '';
    el.appendChild(bloqueNegocios);
  } else {
    el.innerHTML = '';
  }

  // Crear botones de días sin problemas de comillas
  var diasDiv = document.createElement('div');
  diasDiv.style.cssText = 'display:flex;overflow-x:auto;gap:6px;margin-bottom:16px;padding-bottom:4px';
  DIAS_KEYS.forEach(function(dk, i){
    var activo = dk === diaActual;
    var btn = document.createElement('button');
    btn.textContent = DIAS_SEMANA[i];
    btn.style.cssText = 'flex-shrink:0;padding:8px 14px;border:none;border-radius:20px;cursor:pointer;font-size:13px;font-weight:700;background:'+(activo?'#1a237e':'#E8EAF6')+';color:'+(activo?'white':'#1a237e');
    btn.onclick = (function(d){ return function(){ renderRutaDia(d); }; })(dk);
    diasDiv.appendChild(btn);
  });

  var contenido = document.createElement('div');
  contenido.id = 'ruta-dia-contenido';

  el.appendChild(diasDiv);
  el.appendChild(contenido);
  renderRutaDia(diaActual);
}

function urlMapsRuta(origen, lista){
  var destino = lista[lista.length - 1];
  var intermedias = lista.slice(0, -1);
  var u = 'https://www.google.com/maps/dir/?api=1&travelmode=driving';
  if(origen) u += '&origin=' + encodeURIComponent(origen);
  u += '&destination=' + encodeURIComponent(destino);
  if(intermedias.length){
    u += '&waypoints=' + intermedias.map(encodeURIComponent).join('%7C');
  }
  return u;
}

// Junta las direcciones del dia y avisa si a alguna barberia le falta la suya
function navegarRutaCompleta(diaKey){
  var dirs = direccionesDelDia(diaKey);
  if(!dirs) return;
  if(dirs.length === 1){ window.open(urlMapsRuta(null, dirs), '_blank'); return; }

  var tramos = tramosParaMaps(dirs);
  if(tramos.length === 1){
    window.open(urlMapsRuta(tramos[0].origen, tramos[0].lista), '_blank');
    return;
  }

  // Mas de 10 paradas: se abre por tramos. Se le explica por que.
  var opciones = tramos.map(function(t, i){
    var desde = (i === 0 ? 1 : i*MAX_PARADAS_MAPS + 1);
    var hasta = desde + t.lista.length - 1;
    return ['🗺️ Tramo ' + (i+1) + ' — paradas ' + desde + ' a ' + hasta,
            function(){ window.open(urlMapsRuta(t.origen, t.lista), '_blank'); }];
  });
  avisoGrande('Tienes ' + dirs.length + ' paradas hoy, y Google Maps solo acepta 10 por ruta.\n\n'
    + 'La partí en ' + tramos.length + ' tramos. Cada uno arranca donde termina el anterior, '
    + 'así que no se te queda ninguna parada fuera.\n\nAbre el tramo que vayas a manejar.',
    function(){ mostrarMenuOpcionesFoto(opciones); });
}

// El 🗺️ de cada barbería: ahora deja escoger entre Maps y Waze
function explicarFalloRuta(codigo){
  var m = {
    'ZERO_RESULTS':          'Google no encontró forma de manejar entre esas direcciones. Revisa que estén bien escritas en los perfiles de tus clientes.',
    'NOT_FOUND':             'Google no pudo ubicar una de las direcciones. Revisa que estén completas -calle, ciudad y estado- en los perfiles de tus clientes.',
    'MAX_WAYPOINTS_EXCEEDED':'Son demasiadas paradas para una sola consulta. Divide la ruta del día.',
    'OVER_QUERY_LIMIT':      'Pasaste el límite de consultas de Google por ahora. Espera un rato e inténtalo de nuevo.',
    'REQUEST_DENIED':        'Google rechazó la consulta. Casi siempre es que falta habilitar "Maps JavaScript API" en el proyecto nbs-rutas, o que la restricción de la clave no incluye nbs2.pages.dev/*',
    'INVALID_REQUEST':       'La consulta salió mal armada. Avísale a Claude con este código: INVALID_REQUEST.',
    'UNKNOWN_ERROR':         'Google tuvo un problema pasajero de su lado. Inténtalo otra vez en un momento.',
    'SIN_RED':               'No se pudo descargar el mapa de Google. Revisa tu señal e inténtalo de nuevo.',
    'SIN_LIBRERIA':          'El mapa de Google se descargó incompleto. Cierra la app, ábrela de nuevo e inténtalo.',
    'TARDO':                 'Google tardó demasiado en responder. Puede ser señal lenta — inténtalo de nuevo.',
    'SIN_UBICACION':         'No se pudo obtener tu ubicación. Revisa que le diste permiso de ubicación a la app en tu teléfono.'
  };
  return m[codigo] || ('No se pudo calcular la ruta (' + codigo + '). Inténtalo de nuevo en un momento.');
}

// Letrero de "trabajando" mientras se consulta -para que no parezca colgada-
function mostrarCargandoRuta(txt){
  var ov = document.getElementById('cargando-ruta-ov');
  if(!ov){
    ov = document.createElement('div');
    ov.id = 'cargando-ruta-ov';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:99996;display:flex;align-items:center;justify-content:center;padding:20px';
    ov.innerHTML = '<div style="background:#fff;border-radius:14px;padding:22px 20px;max-width:320px;width:100%;text-align:center">'
      + '<div id="cargando-ruta-txt" style="font-size:15px;font-weight:700;color:#1a237e"></div>'
      + '<button onclick="cancelarBusquedaRuta()" style="margin-top:14px;padding:9px 18px;border:2px solid #999;border-radius:9px;background:#fff;color:#666;font-weight:700;font-size:13.5px;cursor:pointer">Cancelar</button>'
      + '</div>';
    document.body.appendChild(ov);
  }
  var t = document.getElementById('cargando-ruta-txt');
  if(t) t.textContent = txt;
}
function cerrarCargandoRuta(){
  var ov = document.getElementById('cargando-ruta-ov');
  if(ov) ov.remove();
}

// Cancelar la busqueda a medias. No se puede "desllamar" a Google, pero se marca
// la bandera para que cuando conteste no se muestre nada -26 jul-.
function cancelarBusquedaRuta(){
  _rutaCancelada = true;
  cerrarCargandoRuta();
}

// Busca la direccion de una barberia usando el primer cliente que tenga ese negocio
function pedirRutaGoogle(peticion){
  return new Promise(function(resolve, reject){
    var svc = new google.maps.DirectionsService();
    svc.route(peticion, function(res, status){
      if(status === 'OK' && res && res.routes && res.routes.length) resolve(res);
      else reject(new Error(status || 'UNKNOWN_ERROR'));
    });
  });
}

function optimizarRutaConTrafico(diaKey, incluirUltima){
  incluirUltima = !!incluirUltima;
  _rutaCancelada = false;
  cerrarComparacionRuta();

  var rutasPorDia = LS('rutas_por_dia', {});
  var rutaHoy = rutasPorDia[diaKey] || [];
  if(rutaHoy.length < 2){ avisoGrande('Necesitas al menos 2 barberías en la ruta para optimizar.'); return; }

  // Revisar que todas tengan direccion ANTES de molestar a Google
  var direcciones = rutaHoy.map(function(neg){ return { negocio: neg, dir: direccionDeBarberia(neg) }; });
  var sinDireccion = direcciones.filter(function(d){ return !d.dir; });
  if(sinDireccion.length){
    avisoGrande('⚠️ Estas barberías no tienen dirección guardada, así que no se pueden incluir en la optimización:\n\n'
      + sinDireccion.map(function(d){ return '• '+d.negocio; }).join('\n')
      + '\n\nAgrégales la dirección en el perfil de un cliente de esa barbería.');
    return;
  }

  mostrarCargandoRuta('📍 Buscando tu ubicación...');

  var origenGuardado = null;

  ubicacionActual().then(function(origen){
    origenGuardado = origen;
    mostrarCargandoRuta('🚦 Conectando con Google...');
    return cargarGoogleMaps();
  }).then(function(){
    mostrarCargandoRuta('🚦 Calculando el mejor orden...');
    var peticion;
    if(incluirUltima){
      // TODAS las paradas se pueden reordenar. Se vuelve al punto de partida para
      // que ninguna quede clavada; el tramo de regreso NO se cuenta en los minutos.
      peticion = {
        origin: origenGuardado,
        destination: origenGuardado,
        waypoints: direcciones.map(function(d){ return { location: d.dir, stopover: true }; }),
        optimizeWaypoints: true,
        travelMode: google.maps.TravelMode.DRIVING
      };
    } else {
      // La última parada del día se queda clavada de última.
      peticion = {
        origin: origenGuardado,
        destination: direcciones[direcciones.length-1].dir,
        waypoints: direcciones.slice(0, -1).map(function(d){ return { location: d.dir, stopover: true }; }),
        optimizeWaypoints: true,
        travelMode: google.maps.TravelMode.DRIVING
      };
    }
    return pedirRutaGoogle(peticion);
  }).then(function(res){
    var orden = res.routes[0].waypoint_order || [];
    var nuevoOrden = orden.map(function(i){ return direcciones[i].negocio; });
    if(!incluirUltima) nuevoOrden.push(direcciones[direcciones.length-1].negocio);

    // Seguridad: si algo raro pasara y el orden no trae las mismas barberías, no
    // se le ofrece cambiar nada -mejor no tocar que tocar mal-.
    var a = rutaHoy.slice().sort().join('|');
    var b = nuevoOrden.slice().sort().join('|');
    if(a !== b){
      cerrarCargandoRuta();
      avisoGrande('La respuesta de Google no coincidió con tu lista de barberías, así que no se cambió nada. Inténtalo de nuevo.');
      return null;
    }

    mostrarCargandoRuta('🚦 Midiendo el tráfico de ahora...');
    // Se miden LOS DOS: el que sugiere Google y el que Sensei tiene puesto -26 jul-.
    // Asi el puede comparar los dos numeros y decidir el, en vez de creerle a Google
    // a ciegas. Los dos se miden IGUAL -desde donde esta parado, parada por parada,
    // sin contar regreso- para que la comparacion sea justa.
    var direccionesDe = function(lista){
      return [origenGuardado].concat(lista.map(function(n){ return direccionDeBarberia(n); }));
    };
    var mismoOrden = JSON.stringify(rutaHoy) === JSON.stringify(nuevoOrden);
    var medirSugerido = minutosConTrafico(direccionesDe(nuevoOrden))
      .catch(function(){ return null; });
    // Si los dos ordenes son iguales no se gasta una segunda tanda de consultas
    var medirActual = mismoOrden
      ? medirSugerido
      : minutosConTrafico(direccionesDe(rutaHoy)).catch(function(){ return null; });

    return Promise.all([medirSugerido, medirActual]).then(function(par){
      var sug = par[0], act = par[1];
      return {
        orden: nuevoOrden,
        minutos: sug ? sug.minutos : null,
        conTrafico: sug ? sug.conTrafico : false,
        minutosActual: act ? act.minutos : null
      };
    });
  }).then(function(d){
    cerrarCargandoRuta();
    if(_rutaCancelada) return;
    if(!d) return;
    mostrarComparacionRuta(diaKey, rutaHoy, d.orden, d.minutos, d.conTrafico, incluirUltima, d.minutosActual);
  }).catch(function(err){
    cerrarCargandoRuta();
    if(_rutaCancelada) return;
    avisoGrande('🚦 ' + explicarFalloRuta(err && err.message ? err.message : 'UNKNOWN_ERROR'));
  });
}

function mostrarComparacionRuta(diaKey, ordenActual, ordenSugerido, minutosEstimados, conTrafico, incluirUltima, minutosActual){
  var cambio = JSON.stringify(ordenActual) !== JSON.stringify(ordenSugerido);
  var ultima = ordenSugerido[ordenSugerido.length-1];
  var haySug = (minutosEstimados !== null && minutosEstimados !== undefined);
  var hayAct = (minutosActual !== null && minutosActual !== undefined);

  var lineaTiempo;
  if(!haySug){
    lineaTiempo = 'No se pudo medir el tiempo de manejo, pero el orden sí se calculó.';
  } else if(conTrafico){
    lineaTiempo = 'Minutos de manejo entre paradas, con el tráfico de ahora';
  } else {
    lineaTiempo = 'Minutos de manejo entre paradas -tiempo normal, sin tráfico en vivo-';
  }

  // Un reloj para poner debajo del titulo de cada columna
  function reloj(min, color){
    if(min === null || min === undefined) return '';
    return '<div style="font-size:16px;font-weight:900;color:'+color+';margin-bottom:6px">⏱ '+min+' min</div>';
  }

  var html = '<div style="display:flex;align-items:flex-start;gap:8px;margin:0 0 6px">'
    + '<h3 style="flex:1;font-size:19px;font-weight:800;color:#1a237e;margin:0">🚦 Ruta con el tráfico de ahora</h3>'
    + '<button onclick="cerrarComparacionRuta()" aria-label="Cerrar" style="flex-shrink:0;width:34px;height:34px;line-height:1;border:none;border-radius:9px;background:#f0f0f0;color:#666;font-size:20px;font-weight:800;cursor:pointer">✕</button>'
    + '</div>'
    + '<p style="font-size:13px;color:#666;margin:0 0 12px">'+lineaTiempo+'</p>';

  // Casilla para dejar que Google escoja tambien la ultima parada
  html += '<label style="display:flex;align-items:center;gap:9px;background:#FFF8E1;border:1px solid #FFE082;border-radius:9px;padding:9px 11px;margin-bottom:14px;cursor:pointer">'
    + '<input type="checkbox" id="chk-ultima-libre" '+(incluirUltima?'checked':'')+' style="width:19px;height:19px;flex-shrink:0;cursor:pointer" onchange="optimizarRutaConTrafico(\'' + diaKey + '\', this.checked)">'
    + '<span style="font-size:12.5px;color:#6D4C41;line-height:1.3">Dejar que Google escoja también la <b>última parada</b></span>'
    + '</label>';

  if(!cambio){
    html += '<div style="background:#E8F5E9;border-radius:10px;padding:14px;text-align:center;color:#2E7D32;font-weight:800;font-size:13.5px">'
      + '✓ Tu orden ya es el más rápido.'
      + (haySug ? '<div style="font-size:17px;font-weight:900;margin-top:6px">⏱ '+minutosEstimados+' min</div>' : '')
      + '</div>';
  } else {
    html += '<div style="display:flex;gap:10px;margin-bottom:14px">'
      + '<div style="flex:1"><div style="font-size:11px;font-weight:800;color:#999;margin-bottom:4px">TU ORDEN ACTUAL</div>'
      + reloj(minutosActual, '#666')
      + ordenActual.map(function(n,i){ return '<div style="background:#f5f5f5;border-radius:8px;padding:8px;margin-bottom:4px;font-size:12px">'+(i+1)+'. '+escaparHtml(n)+'</div>'; }).join('')
      + '</div>'
      + '<div style="flex:1"><div style="font-size:11px;font-weight:800;color:#1565C0;margin-bottom:4px">ORDEN SUGERIDO</div>'
      + reloj(minutosEstimados, '#1565C0')
      + ordenSugerido.map(function(n,i){
          var pin = (!incluirUltima && n === ultima) ? ' 📌' : '';
          return '<div style="background:#E3F2FD;border-radius:8px;padding:8px;margin-bottom:4px;font-size:12px;font-weight:700">'+(i+1)+'. '+escaparHtml(n)+pin+'</div>';
        }).join('')
      + '</div></div>';
    if(!incluirUltima){
      html += '<div style="font-size:11px;color:#999;margin:-6px 0 10px">📌 = parada fija, no se mueve</div>';
    }

    // EL VEREDICTO: con los dos numeros en la mano, Sensei decide -26 jul-.
    // Puede ganar Google, puede ganar el. Se dice tal cual, sin maquillar.
    if(haySug && hayAct){
      var dif = minutosActual - minutosEstimados;
      if(dif > 0){
        html += '<div style="background:#E8F5E9;border:1px solid #A5D6A7;border-radius:10px;padding:11px;text-align:center;color:#2E7D32;font-weight:800;font-size:13.5px;margin-bottom:12px">'
          + '✓ Te ahorras '+dif+' minuto'+(dif===1?'':'s')+'</div>';
      } else if(dif < 0){
        html += '<div style="background:#FFF8E1;border:1px solid #FFE082;border-radius:10px;padding:11px;text-align:center;color:#6D4C41;font-weight:800;font-size:13.5px;margin-bottom:12px">'
          + '🏆 Tu orden es '+Math.abs(dif)+' minuto'+(Math.abs(dif)===1?'':'s')+' MÁS RÁPIDO que el que sugiere Google</div>';
      } else {
        html += '<div style="background:#f5f5f5;border-radius:10px;padding:11px;text-align:center;color:#666;font-weight:700;font-size:13px;margin-bottom:12px">'
          + 'Los dos tardan lo mismo</div>';
      }
    }
  }

  html += '<div style="display:flex;gap:8px;margin-top:8px">'
    + (cambio ? '<button onclick="aplicarOrdenSugerido(\''+diaKey+'\')" style="flex:1;padding:13px;border:none;border-radius:10px;background:#1565C0;color:#fff;font-weight:800;cursor:pointer">Usar este orden</button>' : '')
    + '<button onclick="cerrarComparacionRuta()" style="flex:1;padding:13px;border:2px solid #999;border-radius:10px;background:#fff;color:#666;font-weight:700;cursor:pointer">'+(cambio?'Quedarme con el mío':'Cerrar')+'</button>'
    + '</div>';

  var ov = document.createElement('div');
  ov.id = 'comparar-ruta-ov';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:99995;display:flex;align-items:center;justify-content:center;padding:20px';
  ov.innerHTML = '<div style="background:#fff;border-radius:16px;padding:20px;max-width:420px;width:100%;max-height:85vh;overflow-y:auto">'+html+'</div>';
  document.body.appendChild(ov);
  window._ordenSugeridoTemp = ordenSugerido;
}
function cerrarComparacionRuta(){
  var ov = document.getElementById('comparar-ruta-ov');
  if(ov) ov.remove();
}
function renderRutaDia(diaKey){
  var el = document.getElementById('ruta-dia-contenido');
  if(!el) return;
  el.innerHTML = '';

  var diaIdx = DIAS_KEYS.indexOf(diaKey);
  var diaLabel = DIAS_SEMANA[diaIdx] || diaKey;
  var rutasPorDia = LS('rutas_por_dia', {});
  var rutaHoy = rutasPorDia[diaKey] || [];
  var fechaDeEsteDia = fechaMasRecienteParaDia(diaKey);
  var visitas = LS('visitas_'+diaKey+'_'+fechaDeEsteDia,[]);

  clientes = LS('ncl',[]);
  var barberias = {};
  clientes.forEach(function(c){
    var neg = (c.negocio||'').trim();
    if(neg) barberias[neg] = true;
  });
  var todasBarberias = Object.keys(barberias).sort();
  var barberiasNoEnDia = todasBarberias.filter(function(b){ return rutaHoy.indexOf(b) < 0; });

  // Header
  var header = document.createElement('div');
  header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:12px';
  header.innerHTML = '<div><div style="font-size:15px;font-weight:800;color:#1a237e">📅 '+diaLabel+'</div><div style="font-size:11px;color:#aaa;margin-top:1px">'+fechaDeEsteDia+(diaKey!==getDiaHoy()?' · día pasado':' · hoy')+'</div></div>'
    +'<div style="font-size:12px;color:#aaa">'+rutaHoy.length+' barbería(s)</div>';
  el.appendChild(header);

  // Boton de optimizar con trafico -25 jul, solo para HOY y con 2+ paradas- (Sensei pidio
  // esto despues de comparar NBS2 contra apps de ruta profesionales)
  if(diaKey === getDiaHoy() && rutaHoy.length >= 2){
    var btnOpt = document.createElement('button');
    btnOpt.textContent = '🚦 Optimizar con el tráfico de ahora';
    btnOpt.style.cssText = 'width:100%;padding:12px;border:2px solid #1565C0;border-radius:10px;background:#E3F2FD;color:#1565C0;font-weight:800;font-size:13.5px;cursor:pointer;margin-bottom:12px';
    btnOpt.onclick = function(){ optimizarRutaConTrafico(diaKey); };
    el.appendChild(btnOpt);
  }

  // Boton para abrir TODA la ruta del dia en Google Maps, en el orden guardado
  // -o sea, el que quedo despues de la eleccion de Sensei- (27 jul)
  if(rutaHoy.length >= 1){
    var btnNavTodo = document.createElement('button');
    btnNavTodo.textContent = '🗺️ Navegar toda la ruta';
    btnNavTodo.style.cssText = 'width:100%;padding:12px;border:2px solid #2E7D32;border-radius:10px;background:#E8F5E9;color:#2E7D32;font-weight:800;font-size:13.5px;cursor:pointer;margin-bottom:12px';
    btnNavTodo.onclick = (function(dk){ return function(){ navegarRutaCompleta(dk); }; })(diaKey);
    el.appendChild(btnNavTodo);
  }

  // Lista de barberías en la ruta
  if(rutaHoy.length === 0){
    var empty = document.createElement('div');
    empty.style.cssText = 'background:#f5f5f5;border-radius:10px;padding:20px;text-align:center;color:#aaa;font-size:13px;margin-bottom:12px';
    empty.textContent = 'Sin barberías asignadas para '+diaLabel;
    el.appendChild(empty);
  } else {
    rutaHoy.forEach(function(neg, idx){
      var visitada = posVisita(visitas, neg) >= 0;
      var horaVis = visitada ? horaDeVisita(visitas, neg) : '';
      var esHuerfana = !barberias[neg]; // ya no hay ningun cliente con este nombre de negocio
      var row = document.createElement('div');
      row.style.cssText = 'background:'+(esHuerfana?'#FFF3E0':'white')+';border-radius:12px;padding:12px 14px;margin-bottom:6px;border:0.5px solid '+(esHuerfana?'#FFCC80':visitada?'#A5D6A7':'#e5e7eb')+';display:flex;align-items:center;gap:10px';

      var btnUp = document.createElement('button');
      btnUp.textContent = '⬆️';
      btnUp.style.cssText = 'background:none;border:none;cursor:pointer;font-size:16px;padding:0';
      btnUp.onclick = (function(dk,i){ return function(){ moverRutaArriba(dk,i); }; })(diaKey, idx);

      var numDiv = document.createElement('div');
      numDiv.style.cssText = 'width:28px;height:28px;border-radius:8px;background:'+(visitada?'#2E7D32':'#E8EAF6')+';display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:'+(visitada?'white':'#1a237e')+';flex-shrink:0';
      numDiv.textContent = idx+1;

      var nameDiv = document.createElement('div');
      nameDiv.style.cssText = 'flex:1;font-size:14px;font-weight:700;color:'+(esHuerfana?'#E65100':visitada?'#2E7D32':'#1a237e');
      nameDiv.innerHTML = '🏪 '+neg+(esHuerfana?'<div style="font-size:10px;font-weight:600;color:#E65100;margin-top:2px">⚠️ Ya no hay ningún cliente con este negocio -¿se renombró o se eliminó?</div>':'');
      if(visitada){
        // La hora de la visita, con lapiz para corregirla (23 jul)
        var hDiv = document.createElement('div');
        hDiv.style.cssText = 'font-size:12px;font-weight:700;color:#1565C0;margin-top:3px;display:flex;align-items:center;gap:5px';
        hDiv.innerHTML = '\ud83d\udd50 ' + (horaVis || '<span style="color:#999;font-weight:600">sin hora</span>');
        var lap = document.createElement('button');
        lap.textContent = '\u270f\ufe0f';
        lap.title = 'Cambiar la hora';
        lap.style.cssText = 'background:#E8EAF6;border:none;border-radius:6px;padding:2px 6px;font-size:11px;cursor:pointer';
        lap.onclick = (function(dk,n){ return function(ev){ ev.stopPropagation(); editarHoraVisita(dk,n); }; })(diaKey, neg);
        hDiv.appendChild(lap);
        nameDiv.appendChild(hDiv);
      }

      var btnVis = document.createElement('button');
      btnVis.textContent = visitada ? '✓ Visitada' : 'Marcar';
      btnVis.style.cssText = 'padding:6px 10px;background:'+(visitada?'#E8F5E9':'#1a237e')+';color:'+(visitada?'#2E7D32':'white')+';border:none;border-radius:8px;cursor:pointer;font-size:11px;font-weight:700';
      btnVis.onclick = (function(dk,n){ return function(){ toggleVisita(dk,n); }; })(diaKey, neg);

      var btnNav = document.createElement('button');
      btnNav.textContent = '🗺️';
      btnNav.title = 'Navegar con Google Maps o Waze';
      btnNav.style.cssText = 'background:#E3F2FD;color:#1565C0;border:none;border-radius:8px;width:32px;height:32px;cursor:pointer;font-size:15px;flex-shrink:0';
      btnNav.onclick = (function(n){ return function(){ menuNavegarParada(n); }; })(neg);

      var btnQuit = document.createElement('button');
      btnQuit.textContent = '✕';
      btnQuit.style.cssText = 'padding:6px 8px;background:#FFEBEE;color:#C62828;border:none;border-radius:8px;cursor:pointer;font-size:12px';
      btnQuit.onclick = (function(dk,n){ return function(){ quitarDeDia(dk,n); }; })(diaKey, neg);

      row.appendChild(btnUp);
      row.appendChild(numDiv);
      row.appendChild(nameDiv);
      row.appendChild(btnNav);
      row.appendChild(btnVis);
      row.appendChild(btnQuit);
      el.appendChild(row);
    });

    // Progreso
    var prog = document.createElement('div');
    prog.style.cssText = 'background:#E8EAF6;border-radius:12px;padding:12px;margin-top:8px;margin-bottom:12px;text-align:center';
    var pct = Math.round((visitas.length/rutaHoy.length)*100);
    prog.innerHTML = '<div style="font-size:12px;font-weight:700;color:#1a237e">Progreso de hoy: '+visitas.length+'/'+rutaHoy.length+'</div>'
      +'<div style="background:#C5CAE9;border-radius:20px;height:8px;overflow:hidden;margin-top:6px">'
      +'<div style="background:#1a237e;height:100%;width:'+pct+'%;border-radius:20px"></div>'
      +'</div>';
    el.appendChild(prog);
  }

  // Agregar barberías al día
  if(barberiasNoEnDia.length > 0){
    var addTitle = document.createElement('div');
    addTitle.style.cssText = 'font-size:11px;font-weight:700;color:#aaa;letter-spacing:0.5px;text-transform:uppercase;margin-bottom:8px';
    addTitle.textContent = 'Agregar a '+diaLabel;
    el.appendChild(addTitle);

    // Caja de busqueda IGUAL de acentuada que el resto de la app -pedido por Sensei
    // el 24 jul: "el boton de busqueda casi no se ve, ponlo mas grande y con el
    // borde mas acentuado"-. Antes usaba la clase generica '.inp' (borde gris
    // finito); ahora es la misma caja dorada gruesa que usan Clientes, Catalogo,
    // Suplidores, etc, pero con el borde AUN MAS marcado (4px, dorado oscuro)
    // porque en esta pantalla se pierde entre las filas de barberias.
    var cajaAgregar = document.createElement('div');
    cajaAgregar.className = 'busca-caja';
    // !important porque hay una regla general (.busca-caja) que fuerza 3px
    // dorado normal en TODAS las cajas de busqueda de la app -esta necesita
    // ganarle a esa regla para verse MAS acentuada que las demas-.
    // Fondo BLANCO PURO, borde NEGRO un poquito mas grueso -pedido por Sensei.
    // OJO: el "blanco palido" que veia al escribir NO era el fondo -ya media
    // blanco puro por getComputedStyle- sino el resaltado azul que Chrome
    // pone solo mientras el dedo esta tocando el campo (normal en telefonos).
    // Se quita con -webkit-tap-highlight-color:transparent.
    // Ajuste fino pedido por Sensei (24 jul): el negro puro y 5px quedo muy
    // exagerado -"ahi me equivoque en la eleccion"-. Ahora gris oscuro en vez
    // de negro puro, 3px en vez de 5px, y un poco menos alta todavia.
    // Bajada de altura otra vez (24 jul): seguia viendose alta comparando con
    // la foto de al lado -padding 8px->4px, letra 17px->15px-.
    // Ya no hace falta repetir el borde/fondo/sombra a mano: la regla
    // compartida .busca-caja de arriba (24 jul) ya deja TODAS las cajas
    // de la app exactamente asi. Solo se deja el margen, propio de esta pantalla.
    cajaAgregar.style.cssText = 'margin-bottom:8px';
    var iconoAgregar = document.createElement('span');
    iconoAgregar.style.cssText = 'font-size:20px;flex-shrink:0;opacity:.85';
    iconoAgregar.textContent = '🔍';
    var buscarAgregar = document.createElement('input');
    buscarAgregar.className = 'busca-fuerte';
    buscarAgregar.id = 'ruta-buscar-agregar';
    buscarAgregar.type = 'text';
    buscarAgregar.placeholder = 'Buscar barbería para agregar...';
    buscarAgregar.autocomplete = 'off';
    // Igual que arriba: la regla compartida .busca-fuerte ya pone el
    // mismo tamano de letra, peso y fondo -no hace falta repetirlo aqui-.
    buscarAgregar.style.cssText = '';
    buscarAgregar.oninput = (function(dk){ return function(){ renderRutaAgregarLista(dk, this.value); }; })(diaKey);
    cajaAgregar.appendChild(iconoAgregar);
    cajaAgregar.appendChild(buscarAgregar);
    el.appendChild(cajaAgregar);

    var listaAgregar = document.createElement('div');
    listaAgregar.id = 'ruta-agregar-lista';
    el.appendChild(listaAgregar);

    renderRutaAgregarLista(diaKey, '');
  }
}

function renderRutaAgregarLista(diaKey, filtro){
  var el = document.getElementById('ruta-agregar-lista');
  if(!el) return;
  var rutasPorDia = LS('rutas_por_dia', {});
  var rutaHoy = rutasPorDia[diaKey] || [];
  clientes = LS('ncl',[]);
  var barberias = {};
  clientes.forEach(function(c){
    var neg = (c.negocio||'').trim();
    if(!neg) return;
    if(!barberias[neg]) barberias[neg] = [];
    barberias[neg].push(c);
  });
  var todasBarberias = Object.keys(barberias).sort();
  var barberiasNoEnDia = todasBarberias.filter(function(b){ return rutaHoy.indexOf(b) < 0; });

  var q = (filtro||'').toLowerCase().trim();
  var lista = barberiasNoEnDia;
  if(q){
    lista = barberiasNoEnDia.filter(function(neg){
      if(neg.toLowerCase().indexOf(q) >= 0) return true;
      return barberias[neg].some(function(c){
        return ((c.nombre||'')+' '+(c.apellido||'')+' '+(c.apodo||'')+' '+(c.tel||'')+' '+(c.dir||'')+' '+(c.ciudad||'')+' '+(c.contacto||'')+' '+(c.contactoApodo||'')+' '+(c.contactoTel||'')).toLowerCase().indexOf(q) >= 0;
      });
    });
  }

  el.innerHTML = '';
  if(!lista.length){
    var msg = document.createElement('div');
    msg.style.cssText = 'text-align:center;color:#aaa;font-size:12px;padding:12px';
    msg.textContent = q ? 'Sin resultados para "'+filtro+'"' : 'No hay más barberías para agregar.';
    el.appendChild(msg);
    return;
  }

  lista.forEach(function(neg){
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:#f9f9f9;border-radius:8px;margin-bottom:4px';

    var nameSpan = document.createElement('span');
    nameSpan.style.cssText = 'font-size:13px;color:#555';
    nameSpan.textContent = '🏪 '+neg;

    var btnAdd = document.createElement('button');
    btnAdd.textContent = '+ Agregar';
    btnAdd.style.cssText = 'padding:6px 12px;background:#E8EAF6;color:#1a237e;border:none;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700';
    btnAdd.onclick = (function(dk,n){ return function(){ agregarADia(dk,n); }; })(diaKey, neg);

    row.appendChild(nameSpan);
    row.appendChild(btnAdd);
    el.appendChild(row);
  });
}


function nombreDeVisita(v){ return (v && typeof v === 'object') ? v.n : v; }

// Devuelve la posicion de una barberia en la lista de visitas, o -1
// 🔴 POR QUE LA VISITA NO SE MARCABA SOLA -19 ago-.
//
// La ruta se guarda en `rutas_por_dia` y la pantalla de la ruta arma su lista con
// `(c.negocio||'').trim()` — o sea, SIN espacios de sobra. Pero el marcado automatico
// comparaba con `cl.negocio` TAL CUAL esta guardado en el cliente, sin limpiar.
//
// Si al escribir el nombre de la barberia se colo un espacio al final, o quedo en
// mayusculas en un sitio y en minusculas en otro, `rutaHoy.indexOf(negocio)` daba -1 y la
// funcion se salia CALLADA: ni marcaba, ni avisaba, ni dejaba rastro. Por eso Sensei tenia
// que marcar a mano sin entender por que.
//
// Ahora los nombres se comparan normalizados: sin espacios de sobra, sin dobles espacios,
// sin acentos y sin distinguir mayusculas. "Modern Cuts ", "MODERN CUTS" y "modern cuts"
// son la misma barberia.
function posVisita(visitas, neg){
  for(var i=0;i<visitas.length;i++){ if(mismoNegocio(nombreDeVisita(visitas[i]), neg)) return i; }
  return -1;
}

// La hora guardada de esa visita (o '' si es de las viejas, sin hora)
function horaDeVisita(visitas, neg){
  var i = posVisita(visitas, neg);
  if(i < 0) return '';
  var v = visitas[i];
  return (v && typeof v === 'object' && v.h) ? v.h : '';
}

// Hora de AHORA en formato 12 horas: "01:18 PM"
function editarHoraVisita(diaKey, neg){
  var key = 'visitas_'+diaKey+'_'+fechaMasRecienteParaDia(diaKey);
  var visitas = LS(key, []);
  var i = posVisita(visitas, neg);
  if(i < 0){ avisoGrande('Primero marca la barber\u00eda como visitada.'); return; }
  var actual = horaDeVisita(visitas, neg) || horaAhora12();
  var nueva = prompt('\u00bfA qu\u00e9 hora visitaste ' + neg + '?\n\nEscr\u00edbela as\u00ed:  01:18 PM', actual);
  if(nueva === null) return;
  nueva = String(nueva).trim().toUpperCase();
  if(!/^\d{1,2}:\d{2}\s?(AM|PM)$/.test(nueva)){
    avisoGrande('Esa hora no se entiende.\n\nEscr\u00edbela as\u00ed:\n\n   01:18 PM\n   09:30 AM');
    return;
  }
  var p = nueva.replace(/\s+/g,' ').split(/[: ]/);
  nueva = (p[0].length<2?'0':'')+p[0]+':'+p[1]+' '+p[2];
  visitas[i] = { n: neg, h: nueva };
  SS(key, visitas);
  renderRutaDia(diaKey);
}

// ═══════════════════════════════════════════════════════════════
//  RECORDATORIO DE MARCAR LA VISITA  (pedido por Sensei, 23 jul 2026)
//
//  "a veces por cuestion de tiempo se me olvida marcarlas, a menos que haya
//   una ventana que me salga diciendome que la marque despues de x tiempo
//   y que yo pueda posponerla si aun no e terminado de esa barberia"
//
//  COMO FUNCIONA: cuando Sensei registra la primera venta o el primer pedido
//  en una barberia que esta en la ruta de HOY, empieza un reloj de 20 minutos.
//  Al cumplirse, sale una ventana preguntando si ya termino ahi.
//  Puede marcarla visitada, o posponer 10 minutos si sigue trabajando.
// ═══════════════════════════════════════════════════════════════

var MIN_PARA_RECORDAR   = 20;   // minutos desde que llega hasta el aviso
var MIN_PARA_POSPONER   = 10;   // minutos que se pospone al tocar "Todavia no"
var CLAVE_LLEGADAS      = 'nbs_llegadas_barberia';

// Se llama sola cuando registra algo en una barberia

// ═══════════════════════════════════════════════════════════════════
//  🤖 QUE LA RUTA SE MARQUE SOLA  (14 ago 2026)
//
//  Sensei: "que la ruta pueda determinar cuando yo haga una venta que
//  automáticamente marque la visita de esa barbería, ya que muchas
//  veces yo me olvido de marcar el botón de visitada".
//
//  📊 MEDIDO ANTES DE CONSTRUIR: 126 de sus 349 ventas -el 36%- no
//  tenían su visita apuntada. La MITAD de sus días de trabajo.
// ═══════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════
//  🤖 LAS DEMÁS AUTOMATIZACIONES  (14 ago 2026)
//
//  Sensei: "quisiera que la app fuera más automatizada... que yo no
//  tenga que hacer tantas cosas que son detalles que creo que la app
//  puede hacer por sí sola".
// ═══════════════════════════════════════════════════════════════════

// ── 3️⃣ AVISAR SI VENDE MÁS DE LO QUE TIENE ──
// 📊 MEDIDO: tiene 14 productos en negativo, o sea que ya le pasó 14 veces.
function rellenoAutomaticoSemanal(){
  try {
    var hoyTxt = fechaHoy();
    var ultimo = LS('nbs_relleno_auto_dia', '');
    if(ultimo){
      var d = _diasDesde(ultimo);
      if(d !== null && d < 7) return;                      // todavía no toca
    }
    var lista = loQueSeAcaba(14);
    if(!lista.length){ SS('nbs_relleno_auto_dia', hoyTxt); return; }
    var rel = LS('nrelleno', {});
    if(!rel.items) rel.items = [];
    var puestos = 0;
    lista.forEach(function(x){
      var ya = rel.items.some(function(i){ return String(i.pid) === String(x.prod.id); });
      if(ya) return;
      rel.items.push({ pid: x.prod.id, cant: Math.max(1, Math.round(x.alMes)) });
      puestos++;
    });
    if(puestos){
      SS('nrelleno', rel);
      try { listaRelleno = LS('nrelleno', {}); } catch(e){}
    }
    SS('nbs_relleno_auto_dia', hoyTxt);
    if(puestos){
      avisoGrande('\ud83d\uded2 SE LLEN\u00d3 TU LISTA DE RELLENO\n\n'
        + 'Le puse ' + puestos + ' producto(s) que se te est\u00e1n acabando,\n'
        + 'con la cantidad que vendes en un mes.\n\n'
        + 'Rev\u00edsala antes de comprarle al suplidor.');
    }
  } catch(e){}
}

// Todo lo automático, en un solo sitio. Se llama al arrancar y cada rato.
function marcarVisitaAutomatica(negocio){
  if(!negocio) return false;
  try {
    var hoyKey = getDiaHoy();
    var rutas  = LS('rutas_por_dia', {});
    var rutaHoy = rutas[hoyKey] || [];
    // Se busca sin que un espacio o una mayuscula lo rompa. -19 ago-
    var _pos = posEnLista(rutaHoy, negocio);
    if(_pos < 0) return false;      // de verdad no está en la ruta de hoy

    // 🔑 Y se apunta con el nombre TAL COMO ESTA EN LA RUTA, no como venga del cliente.
    // Si se apuntara el del cliente -con su espacio de mas-, la pantalla de la ruta seguiria
    // sin encontrarlo y el ✓ no aparecería aunque el dato estuviera guardado.
    negocio = rutaHoy[_pos];

    var key = 'visitas_' + hoyKey + '_' + fechaMasRecienteParaDia(hoyKey);
    var visitas = LS(key, []);
    if(posVisita(visitas, negocio) >= 0){
      // Ya estaba marcada en la ruta, pero puede que figure como "no compró".
      // Como acaba de comprar, hay que corregirle el récord igual. -16 ago-
      try { apuntarVisitaDeBarberia(negocio, true); } catch(eV){}
      return false;
    }

    // El ✓, con la hora de este momento y la marca de que se puso sola
    visitas.push({ n: negocio, h: horaAhora12(), auto: true });
    SS(key, visitas);
    try { cancelarRecordatorioBarberia(negocio); } catch(e){}
    // 📍 Y al récord del cliente. Aquí SÍ compró. -16 ago-
    try { apuntarVisitaDeBarberia(negocio, true); } catch(eV){}
    // Si está mirando la ruta, que lo vea al momento
    try { if(pantallaActual() === 'p-rutas') renderRutaDia(hoyKey); } catch(e){}
    return true;
  } catch(e){ return false; }
}

// Todo lo que pasa con un cliente pasa por aquí: la ruta, la bitácora y el récord.
// Un solo sitio, para que no se olvide en ninguno. -14 ago-
function apuntarTodoDeLaVisita(cl, compro, extra){
  if(!cl) return;
  try { if(cl.negocio) marcarLlegadaBarberia(cl.negocio); } catch(e){}
  if(compro){
    try { if(cl.negocio) marcarVisitaAutomatica(cl.negocio); } catch(e){}
  }
  // El récord de compra/no compra se apunta SIEMPRE. -14 ago-
  try { registrarVisitaBarbero(cl.id, !!compro); } catch(e){}
  try { apuntarEnBitacora(cl.id, compro, extra); } catch(e){}
}

function revisarRecordatoriosVisita(){
  try{
    if(window._appBloqueada) return;
    var caja = document.getElementById('recvis-caja');
    if(caja && caja.style.display === 'block') return;   // ya hay uno en pantalla

    var lleg = LS(CLAVE_LLEGADAS, {});
    var hoyKey = getDiaHoy();
    var key = 'visitas_'+hoyKey+'_'+fechaMasRecienteParaDia(hoyKey);
    var visitas = LS(key, []);
    var ahora = Date.now();

    for(var neg in lleg){
      if(!lleg.hasOwnProperty(neg)) continue;
      if(posVisita(visitas, neg) >= 0){                 // ya la marcaste mientras tanto
        delete lleg[neg]; SS(CLAVE_LLEGADAS, lleg); continue;
      }
      var minutos = Math.floor((ahora - lleg[neg]) / 60000);
      if(minutos >= MIN_PARA_RECORDAR){
        mostrarRecordatorioVisita(neg, minutos);
        return;
      }
    }
  }catch(e){}
}

function mostrarRecordatorioVisita(negocio, minutos){
  var ov   = document.getElementById('recvis-ov');
  var caja = document.getElementById('recvis-caja');
  if(!ov || !caja) return;
  if(caja.style.display !== 'block'){ try{ sonidoRecordatorio(); }catch(eSonido){} } // solo al aparecer
  document.getElementById('recvis-neg').textContent = negocio;
  document.getElementById('recvis-min').textContent = 'Llegaste hace ' + minutos + ' minutos';
  caja.setAttribute('data-neg', negocio);
  ov.style.display = 'block';
  caja.style.display = 'block';
}

function cerrarRecordatorioVisita(){
  var ov   = document.getElementById('recvis-ov');
  var caja = document.getElementById('recvis-caja');
  if(ov) ov.style.display = 'none';
  if(caja) caja.style.display = 'none';
}

// "Si, marcar visitada"
function apuntarVisitaDeBarberia(negocio, estado){
  if(!negocio) return 0;
  // Se sigue aceptando true/false de antes, para no romper lo que ya llama
  if(estado === true) estado = 'compro';
  else if(estado === false || !estado) estado = 'noCompro';

  clientes = LS('ncl', []);
  var hoy = fechaHoy();
  var visitas = LS('nvisitas_barberos', {});
  var cuantos = 0;

  clientes.forEach(function(c){
    if(String(c.negocio || '') !== String(negocio)) return;
    if(c.sinServicio) return;
    cuantos += _apuntarVisitaAUno(visitas, c.id, hoy, estado) ? 1 : 0;
  });

  if(cuantos){
    SS('nvisitas_barberos', visitas);
    try { marcarPendienteDeSubir('nvisitas_barberos'); } catch(e){}
  }
  return cuantos;
}

// A un solo cliente. Devuelve true si cambió algo.
function _apuntarVisitaAUno(visitas, cid, hoy, estado){
  var k = String(cid);
  if(!visitas[k]) visitas[k] = { compro: [], noCompro: [], noEstaba: [] };
  if(!visitas[k].compro) visitas[k].compro = [];
  if(!visitas[k].noCompro) visitas[k].noCompro = [];
  if(!visitas[k].noEstaba) visitas[k].noEstaba = [];

  var yaC = visitas[k].compro.indexOf(hoy) >= 0;
  var yaN = visitas[k].noCompro.indexOf(hoy) >= 0;
  var yaE = visitas[k].noEstaba.indexOf(hoy) >= 0;

  // 🔑 EL ORDEN MANDA: comprar gana sobre todo. Y si no estaba pero después
  // apareció y no quiso nada, vale el "no quiso nada".
  if(estado === 'compro'){
    if(yaC) return false;
    visitas[k].noCompro = visitas[k].noCompro.filter(function(f){ return f !== hoy; });
    visitas[k].noEstaba = visitas[k].noEstaba.filter(function(f){ return f !== hoy; });
    visitas[k].compro.push(hoy);
    return true;
  }
  if(estado === 'noEstaba'){
    if(yaC || yaN || yaE) return false;   // ya hay algo mejor apuntado hoy
    visitas[k].noEstaba.push(hoy);
    return true;
  }
  // noCompro
  if(yaC || yaN) return false;
  visitas[k].noEstaba = visitas[k].noEstaba.filter(function(f){ return f !== hoy; });
  visitas[k].noCompro.push(hoy);
  return true;
}

// A UN SOLO BARBERO, no a toda la barbería. Es lo que usan los botones
// de Pedidos Rápidos: ahí él decide barbero por barbero. -16 ago-
function apuntarVisitaDeUnBarbero(cid, estado){
  if(!cid) return false;
  if(estado === true) estado = 'compro';
  else if(estado === false || !estado) estado = 'noCompro';
  var visitas = LS('nvisitas_barberos', {});
  var cambio = _apuntarVisitaAUno(visitas, cid, fechaHoy(), estado);
  if(cambio){
    SS('nvisitas_barberos', visitas);
    try { marcarPendienteDeSubir('nvisitas_barberos'); } catch(e){}
  }
  return cambio;
}

function toggleVisita(diaKey, neg){
  var key = 'visitas_'+diaKey+'_'+fechaMasRecienteParaDia(diaKey);
  var visitas = LS(key,[]);
  var idx = posVisita(visitas, neg);
  if(idx >= 0){
    visitas.splice(idx,1);
  } else {
    // Se guarda con la HORA de este momento (23 jul)
    visitas.push({ n: neg, h: horaAhora12() });
    cancelarRecordatorioBarberia(neg);   // ya la marcaste, no hace falta recordarte
    // 📍 Y AL RÉCORD DE CADA CLIENTE de esa barbería, que antes no se enteraba. -16 ago-
    try { apuntarVisitaDeBarberia(neg, false); } catch(eV){}
    // Y a la bitácora: los barberos de esa barbería que no tengan renglón de hoy. -14 ago-
    try {
      clientes = LS('ncl', []);
      var hoyB = fechaHoy();
      var yaHay = leerBitacora().filter(function(r){ return String(r.fecha) === hoyB; });
      clientes.forEach(function(c){
        if(String(c.negocio || '') !== String(neg)) return;
        if(c.sinServicio) return;
        if(yaHay.some(function(r){ return String(r.cid) === String(c.id); })) return;
        apuntarEnBitacora(c.id, false, { como: 'mano', nota: 'visitada, sin compra' });
      });
    } catch(eB){}
  }
  SS(key, visitas);
  renderRutaDia(diaKey);
}

function moverRutaArriba(diaKey, idx){
  if(idx === 0) return;
  var rutasPorDia = LS('rutas_por_dia',{});
  var ruta = rutasPorDia[diaKey] || [];
  var temp = ruta[idx-1];
  ruta[idx-1] = ruta[idx];
  ruta[idx] = temp;
  rutasPorDia[diaKey] = ruta;
  SS('rutas_por_dia', rutasPorDia);
  renderRutaDia(diaKey);
}

// ===== HISTORIAL DE PRECIOS (registrar automáticamente) =====

// ═══════════════════════════════════════════════════════════════════
//  💾 GUARDA TU DÍA  (8 sep 2026)
//
//  Sensei, tras quedarse fuera de la app: "imagínate que yo pierda todos mis datos,
//  es como perder el negocio. Y eso sería perderlo todo."
//
//  🔑 Al terminar el cierre de ruta le recuerda bajar su backup, con lo que vendió hoy
//  y cuánto lleva sin bajar uno. Un archivo en su correo es indestructible: sobrevive
//  al teléfono, a la nube y a cualquier fallo de la app.
// ═══════════════════════════════════════════════════════════════════
function avisarGuardarElDia(){
  var mins = 9999;
  try { mins = minutosSinRespaldar(); } catch(e){}
  var dias = mins >= 9999 ? 99 : Math.floor(mins / 1440);
  var urgente = dias >= 2;

  // Lo que vendió hoy, para que vea qué es lo que está en juego
  var hoy = fechaHoy(), vendido = 0, facturas = 0;
  try {
    LS('nv', []).forEach(function(v){
      if(v.cancelada || v.fecha !== hoy) return;
      vendido += (typeof dinero === 'function') ? dinero(v.total) : (parseFloat(v.total) || 0);
      facturas++;
    });
  } catch(e){}

  var ov = document.getElementById('guardadia-overlay');
  if(!ov){
    ov = document.createElement('div');
    ov.id = 'guardadia-overlay';
    document.body.appendChild(ov);
  }
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:2000003;'
    + 'display:flex;align-items:center;justify-content:center;padding:15px';
  ov.onclick = function(e){ if(e.target === ov) cerrarGuardarElDia(); };

  ov.innerHTML = '<div style="background:#fff;border-radius:15px;padding:18px;max-width:410px;width:100%">'
    + '<div style="text-align:center;margin-bottom:12px">'
    +   '<div style="font-size:34px">\ud83d\udcbe</div>'
    +   '<div style="font-size:17px;font-weight:900;color:var(--nbs-ink)">GUARDA TU D\u00cdA</div>'
    + '</div>'

    + (facturas > 0
        ? '<div style="background:#E8F5E9;border-radius:10px;padding:11px;margin-bottom:9px;'
          + 'text-align:center">'
          + '<div style="font-size:11px;font-weight:800;color:#2E7D32">HOY VENDISTE</div>'
          + '<div style="font-size:22px;font-weight:900;color:#2E7D32">$' + fmtNum(vendido) + '</div>'
          + '<div style="font-size:11.5px;color:#2E7D32">en ' + facturas + ' factura(s)</div>'
          + '</div>'
        : '')

    + '<div style="background:' + (urgente ? '#FFEBEE' : '#F4F6FB') + ';border-radius:10px;'
    +   'padding:11px;margin-bottom:11px;text-align:center">'
    +   '<div style="font-size:13px;font-weight:800;color:' + (urgente ? '#C62828' : '#555') + '">'
    +     (mins >= 9999
            ? '\u26a0\ufe0f Nunca has bajado un backup'
            : (dias >= 1
                ? 'Tu \u00faltimo backup fue hace ' + dias + ' d\u00eda(s)'
                : 'Tu \u00faltimo backup fue hoy'))
    +   '</div>'
    + '</div>'

    + '<div style="font-size:12.5px;color:var(--nbs-muted);line-height:1.55;margin-bottom:13px;'
    +   'text-align:center">Si pierdes el tel\u00e9fono, <b>este archivo es tu negocio</b>.<br>'
    +   'B\u00e1jalo y m\u00e1ndalo a tu WhatsApp o a tu correo.</div>'

    + '<button onclick="bajarBackupDelDia()" style="width:100%;padding:15px;background:#1a237e;'
    +   'color:#fff;border:none;border-radius:12px;font-size:15.5px;font-weight:900;cursor:pointer">'
    +   '\ud83d\udcbe Bajar mi backup</button>'
    + '<button onclick="cerrarGuardarElDia()" style="width:100%;padding:12px;margin-top:8px;'
    +   'background:#F0F0F2;color:#555;border:none;border-radius:10px;font-size:13px;'
    +   'font-weight:700;cursor:pointer">Ahora no</button>'
    + '</div>';
  ov.style.display = 'flex';
}

function cerrarGuardarElDia(){
  var ov = document.getElementById('guardadia-overlay');
  if(ov) ov.style.display = 'none';
}

function bajarBackupDelDia(){
  cerrarGuardarElDia();
  try { exportD(); } catch(e){ avisoGrande('No pude bajar el backup: ' + e.message); }
}
