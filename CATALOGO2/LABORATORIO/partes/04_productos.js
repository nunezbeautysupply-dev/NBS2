
function abrirTraerCambiosProductos(){
  var inp = document.getElementById('traer-prod-input');
  if(!inp) return;
  inp.value = '';
  inp.click();
}

function pintarDiferenciasProductos(){
  var d = _difProd;
  if(!d) return;
  var marcadas = ['nombre','precio','costo','foto'].reduce(function(a,k){
    return a + d[k].filter(function(x){ return x.marcado; }).length; }, 0);
  var total = d.nombre.length + d.precio.length + d.costo.length + d.foto.length;

  var h = '<div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:8px">'
    + '<div style="flex:1"><div style="font-size:17px;font-weight:900;color:#1a237e">📥 Cambios de productos</div>'
    + '<div style="font-size:12.5px;color:#666">' + total + ' diferencia(s) encontradas</div></div>'
    + '<button onclick="cerrarDiferenciasProductos()" style="flex-shrink:0;width:34px;height:34px;border:none;border-radius:9px;background:#f0f0f0;color:#666;font-size:20px;font-weight:800;cursor:pointer">✕</button>'
    + '</div>'
    + '<div style="background:#E8F5E9;border:1px solid #A5D6A7;border-radius:9px;padding:9px;margin-bottom:12px;font-size:12px;color:#2E7D32;line-height:1.4">'
    + '<b>Solo se cambia el nombre, el precio, el costo y la foto.</b><br>'
    + 'NO se tocan tus ventas, clientes, pagos, compras ni existencias. Y una foto que ya tengas NO se reemplaza.'
    + '</div>';

  function bloque(clave, titulo, icono, pintarFila){
    var lista = d[clave];
    if(!lista.length) return '';
    var cuantas = lista.filter(function(x){ return x.marcado; }).length;
    var t = '<div style="background:#fff;border:1px solid #ddd;border-radius:11px;padding:10px;margin-bottom:10px">'
      + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">'
      + '<label style="flex:1;display:flex;align-items:center;gap:7px;cursor:pointer">'
      + '<input type="checkbox" ' + (cuantas === lista.length ? 'checked' : '') + ' onchange="marcarTodoGrupo(\'' + clave + '\', this.checked)" style="width:19px;height:19px;cursor:pointer">'
      + '<span style="font-size:14px;font-weight:900;color:#1a237e">' + icono + ' ' + titulo + ' (' + lista.length + ')</span>'
      + '</label></div>';
    lista.forEach(function(x, i){
      t += '<label style="display:flex;align-items:flex-start;gap:8px;padding:7px 0;border-top:1px solid #f0f0f0;cursor:pointer">'
        + '<input type="checkbox" ' + (x.marcado ? 'checked' : '') + ' onchange="marcarDif(\'' + clave + '\',' + i + ',this.checked)" style="width:18px;height:18px;flex-shrink:0;margin-top:2px;cursor:pointer">'
        + '<span style="flex:1;font-size:12.5px;line-height:1.35">' + pintarFila(x) + '</span></label>';
    });
    return t + '</div>';
  }

  h += bloque('nombre', 'NOMBRES', '✏️', function(x){
    return '<span style="color:#999;text-decoration:line-through">' + escaparHtml(x.mio) + '</span><br>'
         + '<span style="color:#2E7D32;font-weight:700">' + escaparHtml(x.delArchivo) + '</span>';
  });
  h += bloque('precio', 'PRECIOS DE VENTA', '💵', function(x){
    return '<b>' + escaparHtml(String(x.nombre).slice(0,40)) + '</b><br>'
         + '<span style="color:#999">$' + fmtNum(x.mio) + '</span> → <span style="color:#2E7D32;font-weight:800">$' + fmtNum(x.delArchivo) + '</span>';
  });
  h += bloque('costo', 'COSTOS', '📦', function(x){
    return '<b>' + escaparHtml(String(x.nombre).slice(0,40)) + '</b><br>'
         + '<span style="color:#999">$' + fmtNum(x.mio) + '</span> → <span style="color:#2E7D32;font-weight:800">$' + fmtNum(x.delArchivo) + '</span>';
  });
  h += bloque('foto', 'FOTOS QUE NO TIENES AQUÍ', '📷', function(x){
    return '<div style="display:flex;align-items:center;gap:8px">'
         + '<img src="' + x.delArchivo + '" style="width:44px;height:44px;object-fit:cover;border-radius:7px;border:1px solid #ddd;flex-shrink:0">'
         + '<b style="flex:1">' + escaparHtml(String(x.nombre).slice(0,38)) + '</b></div>';
  });

  h += '<div style="position:sticky;bottom:0;background:#fff;padding-top:10px;border-top:2px solid #eee">'
    + '<div style="text-align:center;font-size:13px;color:#666;margin-bottom:8px">Vas a aplicar <b>' + marcadas + '</b> de ' + total + '</div>'
    + '<div style="display:flex;gap:8px">'
    + '<button onclick="aplicarCambiosProductos()" style="flex:2;padding:13px;border:none;border-radius:10px;background:#2E7D32;color:#fff;font-weight:800;font-size:13.5px;cursor:pointer">Aplicar los marcados</button>'
    + '<button onclick="cerrarDiferenciasProductos()" style="flex:1;padding:13px;border:2px solid #999;border-radius:10px;background:#fff;color:#666;font-weight:700;cursor:pointer">Cancelar</button>'
    + '</div></div>';

  var ov = document.getElementById('difprod-ov');
  if(!ov){
    ov = document.createElement('div');
    ov.id = 'difprod-ov';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:99995;display:flex;align-items:center;justify-content:center;padding:14px';
    document.body.appendChild(ov);
  }
  ov.innerHTML = '<div style="background:#fff;border-radius:16px;padding:16px;max-width:460px;width:100%;max-height:88vh;overflow-y:auto">' + h + '</div>';
  ov.style.display = 'flex';
}

function marcarDif(clave, i, val){
  if(_difProd && _difProd[clave] && _difProd[clave][i]){
    _difProd[clave][i].marcado = !!val;
    pintarDiferenciasProductos();
  }
}
function marcarTodoGrupo(clave, val){
  if(_difProd && _difProd[clave]){
    _difProd[clave].forEach(function(x){ x.marcado = !!val; });
    pintarDiferenciasProductos();
  }
}
function cerrarDiferenciasProductos(){
  var ov = document.getElementById('difprod-ov');
  if(ov) ov.remove();
  _difProd = null;
}

function aplicarCambiosProductos(){
  var d = _difProd;
  if(!d) return;
  var lista = [];
  ['nombre','precio','costo','foto'].forEach(function(k){
    d[k].forEach(function(x){ if(x.marcado) lista.push({ tipo:k, dato:x }); });
  });
  if(!lista.length){ avisoGrande('No marcaste ningún cambio.'); return; }

  if(!confirm('Se van a aplicar ' + lista.length + ' cambio(s) a tus productos.\n\n'
    + 'Solo el nombre, el precio y el costo.\n'
    + 'NO se tocan ventas, clientes, pagos, compras, existencias ni fotos.\n\n¿Seguir?')) return;

  protegerConHuella(function(){
    loadProds();
    var guardados = LS('np', []);
    var porId = {};
    guardados.forEach(function(g){ porId[String(g.id)] = g; });

    // Si un producto solo existe en el catalogo de fabrica, se crea su "parche" para
    // poder guardarle el cambio sin tocar el catalogo original.
    function parcheDe(id){
      var g = porId[String(id)];
      if(g) return g;
      var base = productos.find(function(p){ return String(p.id) === String(id); });
      if(!base) return null;
      g = { id: base.id };
      porId[String(id)] = g;
      guardados.push(g);
      return g;
    }

    var hechos = { nombre:0, precio:0, costo:0, foto:0 };
    lista.forEach(function(item){
      var x = item.dato;
      var g = parcheDe(x.id);
      if(!g) return;
      if(item.tipo === 'nombre'){
        g.nombre = x.delArchivo;
        if(x.nombreCorto !== undefined) g.nombreCorto = x.nombreCorto;
        if(x.marca !== undefined) g.marca = x.marca;
        hechos.nombre++;
      } else if(item.tipo === 'precio'){
        // Queda anotado en el historial de precios, como cualquier cambio de precio
        try { registrarCambioPrecio(x.nombre, x.mio, x.delArchivo); } catch(e){}
        g.precio = x.delArchivo;
        hechos.precio++;
      } else if(item.tipo === 'foto'){
        g.foto = x.delArchivo;
        hechos.foto++;
      } else {
        g.costo = x.delArchivo;
        hechos.costo++;
      }
    });

    // Si trae fotos puede pesar; si no cabe, avisar claro en vez de fallar en silencio
    // SS y no localStorage: asi las fotos que trae el respaldo van al almacen grande
    // en vez de al casillero chico. SS devuelve si cupo. -4 ago-
    var seGuardo = false;
    try { seGuardo = SS('np', guardados); } catch(e){ seGuardo = false; }
    if(!seGuardo){
      try { liberarEspacioSiHaceFalta(); } catch(e){}
      try { seGuardo = SS('np', guardados); } catch(e){ seGuardo = false; }
    }
    if(!seGuardo){
      avisoGrande('⚠️ No cupo en el teléfono.\n\nToca "🧹 Liberar espacio en el teléfono" y vuelve a intentarlo.\n\nNo se cambió nada.');
      return;
    }
    PRODS = [];
    loadProds();
    try { if(typeof renderCatalogo === 'function') renderCatalogo(document.getElementById('catbuscar') ? (document.getElementById('catbuscar').value || '') : ''); } catch(e){}

    cerrarDiferenciasProductos();
    avisoGrande('✓ Listo.\n\n'
      + (hechos.nombre ? hechos.nombre + ' nombre(s)\n' : '')
      + (hechos.precio ? hechos.precio + ' precio(s)\n' : '')
      + (hechos.costo  ? hechos.costo  + ' costo(s)\n'  : '')
      + (hechos.foto   ? hechos.foto   + ' foto(s)\n'   : '')
      + '\nTus ventas, clientes y existencias no se tocaron.');
  });
}

// ═══ BAJAR LAS FOTOS QUE FALTAN, POR SU CUENTA (28 jul) ═══
//
// EL PROBLEMA QUE REPORTO SENSEI: agregaba fotos a los productos desde la PC y en el
// telefono no aparecian.
//
// LA CAUSA: las fotos SOLO se pedian dentro de `cargarDatosDeLaNube()`, y solo si el
// telefono aceptaba bajar la lista de productos de la nube. Pero desde el 16 de julio
// hay una proteccion que impide que la nube pise al telefono cuando el telefono es mas
// nuevo -esa proteccion se puso porque se perdio un dia entero de ventas-. Entonces, si
// el habia hecho una venta o tocado un producto en el telefono despues de subir las
// fotos en la PC, el telefono decia "yo soy mas nuevo", NO bajaba la lista... y las
// fotos nunca se pedian.
//
// LA SOLUCION: las fotos no tienen por que depender de eso. Una foto no compite con
// nada: o esta o no esta. Ahora se piden APARTE, y `descargarFotosQueFaltan` solo
// rellena las que FALTAN -nunca sobreescribe una que ya tengas-, asi que no puede pisar
// ningun dato.
function marcarHoraLocal(k){
  try{ localStorage.setItem('_hora_'+k, String(Date.now())); }catch(e){}
}
function marcarPendienteDeSubir(k){
  try{
    var p = JSON.parse(localStorage.getItem(CLAVE_PENDIENTES) || '{}');
    p[k] = Date.now();
    localStorage.setItem(CLAVE_PENDIENTES, JSON.stringify(p));
  }catch(e){}
}
function obtenerPrecioParaCliente(cid, pid, precioDefault){
  if(!cid || !pid) return precioDefault;
  var clientesLocal = LS('ncl', []);
  var cl = clientesLocal.find(function(c){ return String(c.id)===String(cid); });
  if(!cl || !cl.preciosPersonalizados) return precioDefault;
  var especial = cl.preciosPersonalizados.find(function(pp){ return String(pp.pid)===String(pid); });
  return especial ? especial.precio : precioDefault;
}

function loadProds(){
  try {
    var el = document.getElementById('pd');
    if(el && PRODS.length === 0){ PRODS = JSON.parse(el.value); }
    var guardados = LS('np', []);
    var eliminados = LS('np_eliminados', []);
    if(guardados.length){
      var mapa = {};
      guardados.forEach(function(g){ mapa[String(g.id)] = g; });
      productos = PRODS.filter(function(p){
        return eliminados.indexOf(String(p.id)) === -1;
      }).map(function(p){
        var g = mapa[String(p.id)];
        return g ? Object.assign({}, p, g) : p;
      });
      guardados.forEach(function(g){
        if(!PRODS.find(function(p){ return String(p.id)===String(g.id); })){
          if(eliminados.indexOf(String(g.id)) === -1) productos.push(g);
        }
      });
    } else {
      productos = PRODS.filter(function(p){
        return eliminados.indexOf(String(p.id)) === -1;
      });
    }
  } catch(e){ console.error('loadProds error:', e); }
}

function toggleMarcasDetalle(){
  var el = document.getElementById('cat-marcas-detalle');
  var txt = document.getElementById('cat-marcas-toggle-txt');
  if(!el) return;
  var visible = el.style.display === 'block';
  el.style.display = visible ? 'none' : 'block';
  if(txt) txt.textContent = visible ? 'Ver por marca ▼' : 'Ocultar ▲';
}

function actualizarMarcasDetalle(){
  var el = document.getElementById('cat-marcas-detalle');
  if(!el) return;
  var porMarca = {};
  productos.forEach(function(p){
    var marca = p.marca ? p.marca.toUpperCase() : (p.nombre||'').trim().split(/\s+/)[0].toUpperCase();
    if(!marca) marca = 'SIN MARCA';
    if(!porMarca[marca]) porMarca[marca] = 0;
    porMarca[marca]++;
  });
  var marcasOrdenadas = Object.keys(porMarca).sort(function(a,b){ return porMarca[b]-porMarca[a]; });
  el.innerHTML = marcasOrdenadas.map(function(m){
    return '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #E0F2F1">'
      +'<span style="font-size:13px;color:#00695C;font-weight:600">'+m+'</span>'
      +'<span style="font-size:13px;color:#00838F;font-weight:800">'+porMarca[m]+'</span>'
      +'</div>';
  }).join('');
}

// Calcula todos los numeros del panorama de inventario -reutilizable tanto en la pantalla
// completa de Inventario como en el resumen chiquito dentro del Resumen Financiero, para que
// ambos lugares siempre muestren exactamente lo mismo, sin duplicar la logica en 2 sitios.
function productosSinPrecio(){
  loadProds();
  return productos.filter(function(p){ return !(parseFloat(p.precio) > 0.005); });
}

// Su margen de siempre, sacado de sus PROPIOS productos — no de un numero inventado.
// Se usa solo para SUGERIR un precio; el ultimo que decide es el.
function precioSugerido(costo){
  var c = parseFloat(costo) || 0;
  if(!(c > 0.005)) return 0;
  var m = margenDeCasa();
  if(m >= 0.95) m = 0.40;
  var p = c / (1 - m);
  return Math.round(p * 100) / 100;
}

// ── LA PARADA ANTES DE GUARDAR LA COMPRA ──
// Devuelve true si hay productos nuevos sin precio -y abre la pantalla para ponerselo-.
function cerrarPreciosNuevos(){
  var ov = document.getElementById('precios-nuevos-overlay');
  if(ov) ov.style.display = 'none';
}

function guardarPreciosNuevos(){
  var sinPoner = [];
  iCC.forEach(function(it, i){
    if(!it.esNuevo) return;
    var el = document.getElementById('precionuevo-' + i);
    if(!el) return;
    var v = parseFloat(String(el.value).replace(/[$,]/g,'')) || 0;
    if(v > 0.005) it.precioVenta = v; else sinPoner.push(it.nombre);
  });
  if(sinPoner.length){
    alert('Todavía falta el precio de:\n\n• ' + sinPoner.join('\n• '));
    return;
  }
  cerrarPreciosNuevos();
  var seguir = window._alTerminarPrecios;
  window._alTerminarPrecios = null;
  if(typeof seguir === 'function') seguir();
}

// ── QUE PRODUCTOS LE COMPRA A CADA SUPLIDOR ──
// No hace falta guardar nada nuevo: sale de sus propias compras. Cada compra tiene el
// suplidor -sid- y sus renglones tienen el producto -pid-. -Idea de Sensei, 19 ago-
function toggleOpcionesCatalogo(){
  var caja = document.getElementById('cat-opciones');
  var flecha = document.getElementById('cat-opciones-flecha');
  if(!caja) return;
  var abierto = caja.style.display !== 'none';
  caja.style.display = abierto ? 'none' : 'block';
  if(flecha) flecha.textContent = abierto ? '\u25bc' : '\u25b2';
}

function filtrarCatalogo(){
  try { renderCatalogo(document.getElementById('catbuscar').value); } catch(e){ renderCatalogo(''); }
}

function verSoloSinPrecio(){
  var sel = document.getElementById('cat-suplidor');
  if(sel) sel.value = 'SINPRECIO';
  filtrarCatalogo();
  try { document.getElementById('catlista').scrollIntoView({ behavior:'smooth', block:'start' }); } catch(e){}
}


// ═══════════════════════════════════════════════════════════════════
//  📸 CARGAR FOTOS RÁPIDO  (7 sep 2026)
//
//  Sensei: "el artículo con fotos vendería mucho más fácil". Le faltan 484 fotos, pero
//  con 100 bien elegidas cubre el 72% de lo que vende de verdad.
//
//  🔑 Esta pantalla se las va pasando UNA POR UNA, ordenadas por lo que MÁS VENDE, para
//  que no tenga que buscar cada producto a mano. Foto → siguiente → foto → siguiente.
// ═══════════════════════════════════════════════════════════════════
var _fotoRapidaLista = [], _fotoRapidaIdx = 0;


// ═══════════════════════════════════════════════════════════════════
//  📥 TRAER LAS FOTOS DEL CATÁLOGO  (11 sep 2026)
//
//  Sensei: "¿y así quedan también en el catálogo de la app automáticamente?"
//  No: el administrador del catálogo y la app son dos sitios distintos. Este es el
//  puente: él carga las fotos UNA vez en el administrador -donde están las herramientas
//  de lotes- y con esto las trae todas de golpe a la app de la ruta.
//
//  🔑 Los productos usan el MISMO id en los dos sitios, así que el emparejado es
//  exacto: no hay que adivinar nada.
// ═══════════════════════════════════════════════════════════════════

// \u2728 Se recuerda si Sensei apag\u00f3 el limpiador, para no tener que marcarlo cada vez.
// \u2728 Enciende o apaga el limpiador, y lo recuerda para la pr\u00f3xima vez. -12 sep-
function cambiarLimpiarFotos(activo){
  window._limpiarFotosApp = !!activo;
  try { localStorage.setItem('nbs_limpiar_fotos', activo ? '1' : '0'); } catch(e){}
}

function arrancarLimpiadorFotos(){
  try {
    var g = localStorage.getItem('nbs_limpiar_fotos');
    window._limpiarFotosApp = (g !== '0');
    var chk = document.getElementById('chk-limpiar-app');
    if(chk) chk.checked = window._limpiarFotosApp;
  } catch(e){}
}


// ═══════════════════════════════════════════════════════════════════
//  📤 MANDAR MIS FOTOS AL CATÁLOGO  (16 sep 2026)
//
//  🔴 Sensei: la app tiene 249 fotos y el catálogo solo 185. Las 64 que faltan las
//  puso EN LA APP, y el puente que había solo iba del catálogo a la app.
//
//  🔑 Este es el camino de vuelta: saca las fotos de la app en un archivo que el
//  administrador del catálogo sabe leer.
// ═══════════════════════════════════════════════════════════════════

function mandarFotosAlCatalogo(){
  loadProds();
  var conFoto = productos.filter(function(p){
    return !p.eliminado && p.foto && String(p.foto).length > 100;
  });
  if(!conFoto.length){
    avisoGrande('Todav\u00eda no tienes fotos que mandar.');
    return;
  }

  var paquete = { tipo: 'nbs_fotos_app', cuando: Date.now(), fotos: {} };
  conFoto.forEach(function(p){
    paquete.fotos[String(p.id)] = { foto: p.foto, nombre: p.nombre || '' };
  });

  var txt = JSON.stringify(paquete);
  var a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([txt], { type: 'application/json' }));
  a.download = 'FOTOS_DE_LA_APP.json';
  document.body.appendChild(a);
  a.click();
  setTimeout(function(){
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  }, 400);

  avisoGrande('\ud83d\udce4 Se baj\u00f3 FOTOS_DE_LA_APP.json con ' + conFoto.length + ' fotos.\n\n'
    + 'Pesa unos ' + Math.round(txt.length / 1024 / 1024 * 10) / 10 + ' MB.\n\n'
    + 'Ahora \u00e1brelo en el administrador del cat\u00e1logo:\n'
    + '\ud83d\udcf8 Fotos \u2192 \ud83d\udce5 Traer fotos de la app');
}

function abrirTraerFotos(){
  var ov = document.getElementById('traerfotos-overlay');
  if(!ov){
    ov = document.createElement('div');
    ov.id = 'traerfotos-overlay';
    document.body.appendChild(ov);
  }
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.68);z-index:100006;'
    + 'display:flex;align-items:center;justify-content:center;padding:14px';
  ov.onclick = function(e){ if(e.target === ov) cerrarTraerFotos(); };

  loadProds();
  var sinFoto = productos.filter(function(p){
    return !p.eliminado && !(p.foto && String(p.foto).length > 100);
  }).length;

  ov.innerHTML = '<div style="background:#fff;border-radius:15px;padding:16px;'
    + 'max-width:420px;width:100%">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:11px">'
    +   '<div style="font-size:16px;font-weight:900;color:var(--nbs-ink)">'
    +     '\ud83d\udce5 Traer fotos del cat\u00e1logo</div>'
    +   '<button onclick="cerrarTraerFotos()" style="background:#F0F0F2;border:none;'
    +     'border-radius:9px;width:33px;height:33px;font-size:15px;cursor:pointer">\u2715</button>'
    + '</div>'

    + '<div style="background:#F3E5F5;border-radius:11px;padding:12px;margin-bottom:12px;'
    +   'font-size:12.5px;color:#6A1B9A;line-height:1.6">'
    +   'Si ya pusiste las fotos en el <b>administrador del cat\u00e1logo</b>, aqu\u00ed las traes '
    +   'todas de golpe. No hay que hacerlas dos veces.'
    +   '<br><br>Te faltan <b>' + sinFoto + '</b> fotos en esta app.</div>'

    + '<div style="background:#FFF8E1;border-radius:10px;padding:11px;margin-bottom:12px;'
    +   'font-size:11.5px;color:#6D4C00;line-height:1.6">'
    +   '<b>C\u00f3mo:</b><br>'
    +   '1. En el administrador: \ud83d\udcf8 Fotos<br>'
    +   '2. Toca \ud83d\udce4 Bajar las fotos para la app<br>'
    +   '3. Vuelve aqu\u00ed y elige ese archivo</div>'

    + '<input type="file" accept=".json,application/json" id="tf-arch" style="display:none" '
    +   'onchange="leerFotosDelCatalogo(event)">'
    + '<button onclick="document.getElementById(\'tf-arch\').click()" '
    +   'style="width:100%;padding:15px;background:#6A1B9A;color:#fff;border:none;'
    +   'border-radius:12px;font-size:15px;font-weight:900;cursor:pointer">'
    +   '\ud83d\udcc1 Elegir el archivo de fotos</button>'
    + '<button onclick="cerrarTraerFotos()" style="width:100%;padding:12px;margin-top:8px;'
    +   'background:#F0F0F2;color:#444;border:none;border-radius:10px;font-size:13px;'
    +   'font-weight:700;cursor:pointer">Cerrar</button>'
    + '</div>';
  ov.style.display = 'flex';
}

function cerrarTraerFotos(){
  var ov = document.getElementById('traerfotos-overlay');
  if(ov) ov.style.display = 'none';
}

function leerFotosDelCatalogo(ev){
  var f = ev.target.files && ev.target.files[0];
  ev.target.value = '';
  if(!f) return;

  var lector = new FileReader();
  lector.onload = function(e){
    var paq;
    try { paq = JSON.parse(e.target.result); }
    catch(err){ avisoGrande('Ese archivo no se puede leer.\n\nTiene que ser el '
      + 'FOTOS_PARA_LA_APP.json que baja el administrador.'); return; }

    if(!paq || paq.tipo !== 'nbs_fotos' || !paq.fotos){
      avisoGrande('Ese no es el archivo de fotos.\n\nBusca FOTOS_PARA_LA_APP.json');
      return;
    }

    loadProds();
    var puestas = 0, yaTenian = 0, noEstaban = 0;
    Object.keys(paq.fotos).forEach(function(id){
      var i = productos.findIndex(function(x){ return String(x.id) === String(id); });
      if(i < 0){ noEstaban++; return; }
      // \ud83d\udd11 NO se pisa una foto que ya tenga: las suyas mandan
      if(productos[i].foto && String(productos[i].foto).length > 100){ yaTenian++; return; }
      productos[i].foto = paq.fotos[id].foto;
      productos[i].mod = Date.now();
      puestas++;
    });

    if(!puestas){
      avisoGrande('No hab\u00eda ninguna foto nueva que traer.\n\n'
        + 'Ya ten\u00edan foto: ' + yaTenian);
      return;
    }
    if(!SS('np', productos)) return;
    loadProds();
    cerrarTraerFotos();
    avisoGrande('\u2705 Se trajeron ' + puestas + ' fotos.\n\n'
      + (yaTenian ? 'Ya ten\u00edan foto: ' + yaTenian + '\n' : '')
      + (noEstaban ? 'No estaban en esta app: ' + noEstaban : ''));
    try { renderCatalogo(''); } catch(e2){}
  };
  lector.onerror = function(){ avisoGrande('No pude leer el archivo.'); };
  lector.readAsText(f);
}

function abrirFotosRapido(){
  loadProds();
  ventas = LS('nv', []);
  // Cuánto vende de verdad, contado de las facturas
  var vend = {};
  ventas.forEach(function(v){
    if(v.cancelada) return;
    (v.items || []).forEach(function(it){
      if(!it.pid) return;
      var k = String(it.pid);
      vend[k] = (vend[k] || 0) + (Number(it.cant) || 0);
    });
  });
  // Los que NO tienen foto, del que más vende al que menos
  _fotoRapidaLista = productos.filter(function(p){
    if(p.eliminado) return false;
    if(/balance inicial/i.test(p.nombre || '')) return false;
    return !(p.foto && String(p.foto).length > 100);
  }).map(function(p){
    return { id: p.id, nombre: p.nombre || '', marca: p.marca || '', v: vend[String(p.id)] || 0 };
  }).sort(function(a, b){ return b.v - a.v; });

  _fotoRapidaIdx = 0;
  if(!_fotoRapidaLista.length){
    avisoGrande('\ud83c\udf89 \u00a1Todos tus productos ya tienen foto!');
    return;
  }
  pintarFotoRapida();
}

function pintarFotoRapida(){
  var ov = document.getElementById('fotorapido-overlay');
  if(!ov){
    ov = document.createElement('div');
    ov.id = 'fotorapido-overlay';
    document.body.appendChild(ov);
  }
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.68);z-index:100003;'
    + 'display:flex;align-items:center;justify-content:center;padding:14px';
  ov.onclick = function(e){ if(e.target === ov) cerrarFotosRapido(); };
  ov.style.display = 'flex';

  if(_fotoRapidaIdx >= _fotoRapidaLista.length){
    ov.innerHTML = '<div style="background:#fff;border-radius:15px;padding:20px;max-width:400px;'
      + 'width:100%;text-align:center">'
      + '<div style="font-size:38px">\ud83c\udf89</div>'
      + '<div style="font-size:16px;font-weight:900;margin:8px 0">\u00a1Terminaste!</div>'
      + '<button onclick="cerrarFotosRapido()" style="width:100%;padding:13px;background:#1a237e;'
      +   'color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:800;cursor:pointer">'
      +   'Cerrar</button></div>';
    return;
  }

  var p = _fotoRapidaLista[_fotoRapidaIdx];
  var quedan = _fotoRapidaLista.length - _fotoRapidaIdx;

  ov.innerHTML = '<div style="background:#fff;border-radius:15px;padding:16px;max-width:420px;width:100%">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:9px">'
    +   '<div style="font-size:15px;font-weight:900;color:#1a237e">\ud83d\udcf8 Ponerle foto</div>'
    +   '<button onclick="cerrarFotosRapido()" style="background:#F0F0F2;border:none;'
    +     'border-radius:8px;width:32px;height:32px;font-size:15px;cursor:pointer">\u2715</button>'
    + '</div>'

    // Cuánto lleva y cuánto le queda
    + '<div style="background:#E8F5E9;border-radius:9px;padding:8px;text-align:center;margin-bottom:11px">'
    +   '<div style="font-size:11.5px;color:#2E7D32;font-weight:800">'
    +     'LLEVAS ' + _fotoRapidaIdx + ' \u00b7 TE QUEDAN ' + quedan + '</div>'
    + '</div>'

    + '<div style="background:#FFF8E1;border:1.5px solid #FFD54F;border-radius:11px;padding:13px;'
    +   'margin-bottom:11px">'
    +   '<div style="font-size:15px;font-weight:900;color:var(--nbs-ink);line-height:1.3">'
    +     escaparHtml(p.nombre) + '</div>'
    +   (p.marca ? '<div style="font-size:12px;color:#7A5C00;font-weight:700;margin-top:3px">'
                 + escaparHtml(p.marca) + '</div>' : '')
    +   (p.v > 0 ? '<div style="font-size:11.5px;color:#2E7D32;font-weight:800;margin-top:5px">'
                 + '\ud83d\udd25 has vendido ' + p.v + ' de este</div>' : '')
    + '</div>'

    + '<input type="file" accept="image/*" capture="environment" id="fr-archivo" '
    +   'style="display:none" onchange="guardarFotoRapida(event)">'
    + '<button onclick="document.getElementById(\'fr-archivo\').click()" '
    +   'style="width:100%;padding:16px;background:#1a237e;color:#fff;border:none;'
    +   'border-radius:11px;font-size:16px;font-weight:900;cursor:pointer">'
    +   '\ud83d\udcf7 Tomar la foto</button>'

    + '<button onclick="saltarFotoRapida()" style="width:100%;padding:12px;margin-top:8px;'
    +   'background:#fff;color:#555;border:1.5px solid #ccc;border-radius:10px;'
    +   'font-size:13.5px;font-weight:700;cursor:pointer">\u23ed\ufe0f Saltar este</button>'
    + '</div>';
}

function saltarFotoRapida(){ _fotoRapidaIdx++; pintarFotoRapida(); }

function guardarFotoRapida(ev){
  var f = ev.target.files && ev.target.files[0];
  if(!f) return;
  if(typeof esFotoValida === 'function' && !esFotoValida(f)){ ev.target.value = ''; return; }
  var p = _fotoRapidaLista[_fotoRapidaIdx];
  var lector = new FileReader();
  lector.onload = function(e){
    // \u2728 Se limpia sola -recorta el producto, lo centra, quita el fondo- y luego pasa
    // por el recortador de siempre, por si quiere ajustarla a mano. -12 sep-
    var seguir = function(lista){
      abrirRecortarFoto(lista, function(dataFinal){
        if(!dataFinal){ return; }
        loadProds();
        var i = productos.findIndex(function(x){ return String(x.id) === String(p.id); });
        if(i < 0){ saltarFotoRapida(); return; }
        productos[i].foto = dataFinal;
        productos[i].mod = Date.now();
        if(!SS('np', productos)) return;
        loadProds();
        _fotoRapidaIdx++;
        pintarFotoRapida();
      });
    };
    if(window._limpiarFotosApp === false || typeof limpiarFoto !== 'function'){
      seguir(e.target.result);
    } else {
      limpiarFoto(e.target.result, function(limpia){ seguir(limpia); }, { lado: 560 });
    }
  };
  lector.readAsDataURL(f);
  ev.target.value = '';
}

function cerrarFotosRapido(){
  var ov = document.getElementById('fotorapido-overlay');
  if(ov) ov.style.display = 'none';
  try { renderCatalogo(''); } catch(e){}
}

// 📷 Los botones de foto del catálogo. -13 sep-
function filtroFoto(cual){
  var sel = document.getElementById('cat-suplidor');
  if(sel) sel.value = cual;
  window._filtroFoto = cual;
  renderCatalogo(document.getElementById('catq') ? document.getElementById('catq').value : '');
}

function pintarBotonesFoto(){
  var cual = window._filtroFoto || '';
  // 🔑 Cuántos hay de cada uno, para que lo vea sin tocar nada. -13 sep-
  var conFoto = productos.filter(function(p){
    return !!(p.foto && String(p.foto).length > 100);
  }).length;
  var sinFoto = productos.length - conFoto;
  var agotados = productos.filter(function(p){ return !p.stock || p.stock <= 0; }).length;

  var b = [['fb-todos', '', '#1a237e', 'Todos', productos.length],
           ['fb-sin', 'SINFOTO', '#C62828', '📷 Sin foto', sinFoto],
           ['fb-con', 'CONFOTO', '#0B7A3B', '🖼️ Con foto', conFoto],
           ['fb-agotados', 'AGOTADOS', '#B71C1C', '🔴 Agotados', agotados]];
  b.forEach(function(x){
    var e = document.getElementById(x[0]);
    if(!e) return;
    var activo = (cual === x[1]);
    e.style.background = activo ? x[2] : '#fff';
    e.style.color = activo ? '#fff' : x[2];
    e.style.border = activo ? 'none' : ('1.5px solid ' + x[2]);
    // El número, debajo del nombre y más grande
    e.innerHTML = '<div style="font-size:11px;line-height:1.2">' + x[3] + '</div>'
      + '<div style="font-size:15px;font-weight:900;line-height:1.25">' + x[4] + '</div>';
  });
}

function renderCatalogo(q){
  try { arrancarLimpiadorFotos(); } catch(e){}
  loadProds();

  // Actualizar contador total y por marca
  var elTotal = document.getElementById('cat-total-num');
  if(elTotal) elTotal.textContent = productos.length;
  // 📷 Cuántas le faltan por fotografiar
  var elSF = document.getElementById('cat-sin-foto');
  if(elSF){
    var _sf = productos.filter(function(p){
      return !(p.foto && String(p.foto).length > 100);
    }).length;
    elSF.textContent = '';      // el botón de Sin foto ya lo dice
  }
  try { pintarBotonesFoto(); } catch(e){}
  actualizarMarcasDetalle();

  var el = document.getElementById('catlista');
  if(!el) return;
  // 🔑 SIN BÚSQUEDA: alfabético, como siempre.
  // CON BÚSQUEDA: sin ordenar antes, para que mande la RELEVANCIA. Antes se
  // ordenaba alfabético primero y el producto buscado caía al medio de la lista:
  // Sensei buscaba "gummy" y su 700ml salía de NOVENO entre 13. -19 ago-
  var _hayBusqueda = !!(q && String(q).trim());
  var list = _hayBusqueda
    ? productos.slice()
    : productos.slice().sort(function(a,b){ return a.nombre.localeCompare(b.nombre); });

  // 🏪 EL FILTRO POR SUPLIDOR Y EL DE SIN PRECIO -19 ago-
  var _sel = document.getElementById('cat-suplidor');
  var _filtro = _sel ? _sel.value : '';
  if(_sel){
    // Se rellena el desplegable con sus suplidores, conservando lo que tenga escogido
    var _sups = LS('nsup', []);
    // 🔑 Ahora son 4 fijas: todos, sin precio, sin foto, con foto. -13 sep-
    var _falta = _sel.options.length !== (_sups.length + 5);
    if(_falta){
      var _html = '<option value="">🏪 Todos los suplidores</option>';
      _sups.forEach(function(sp){
        _html += '<option value="' + sp.id + '">' + String(sp.nombre || '').replace(/[<>&"]/g,'') + '</option>';
      });
      _html += '<option value="SINPRECIO">⚠️ Solo los que no tienen precio de venta</option>';
      // 📷 Con foto y sin foto — para saber cuáles le faltan. -13 sep-
      _html += '<option value="SINFOTO">📷 Solo los que NO tienen foto</option>';
      _html += '<option value="CONFOTO">🖼️ Solo los que SÍ tienen foto</option>';
      _html += '<option value="AGOTADOS">🔴 Solo los agotados (sin stock)</option>';
      _sel.innerHTML = _html;
      _sel.value = _filtro || '';
    }
  }
  if(_filtro === 'SINPRECIO'){
    list = list.filter(function(p){ return !(parseFloat(p.precio) > 0.005); });
  } else if(_filtro === 'SINFOTO'){
    // 📷 Los que le faltan por fotografiar. -13 sep-
    list = list.filter(function(p){ return !(p.foto && String(p.foto).length > 100); });
  } else if(_filtro === 'CONFOTO'){
    list = list.filter(function(p){ return !!(p.foto && String(p.foto).length > 100); });
  } else if(_filtro === 'AGOTADOS'){
    // 🔴 Los que están en 0 o menos — para saber qué reponer. -21 sep-
    list = list.filter(function(p){ return !p.stock || p.stock <= 0; });
  } else if(_filtro){
    var _ids = productosDeSuplidor(_filtro);
    list = list.filter(function(p){ return _ids[String(p.id)]; });
  }

  // La franja del aviso: sale SOLO si hay productos sin precio. Si no hay, no ocupa sitio.
  var _avSP = document.getElementById('cat-aviso-sinprecio');
  if(_avSP){
    var _n = productos.filter(function(p){ return !(parseFloat(p.precio) > 0.005); }).length;
    if(_n > 0 && _filtro !== 'SINPRECIO'){
      _avSP.style.display = 'flex';
      document.getElementById('cat-aviso-sinprecio-txt').textContent =
        _n + (_n === 1 ? ' producto sin precio de venta \u2014 t\u00f3calo para ponerle precio'
                       : ' productos sin precio de venta \u2014 t\u00f3calos para ponerles precio');
    } else {
      _avSP.style.display = 'none';
    }
  }
  // Ahora tambien por MARCA, PRECIO y COSTO. El catalogo era el unico buscador de
  // productos que no miraba la marca, y el precio no lo miraba ninguno. -4 ago-
  // El catalogo busca por TODO lo que tiene un producto: nombre, marca, categoria,
  // SKU, proveedor, nombre corto, descripcion, unidad, precio y costo. Antes solo
  // miraba nombre, categoria y SKU — ni la marca. -4 ago-
  // ⚠️ A proposito NO se meten el STOCK ni el MINIMO: escribir "8" traeria decenas
  // de productos solo porque tienen 8 en existencia, y el buscador se llenaria de ruido.
  if(q && q.trim()) list = filtrarPorBusqueda(list, q, function(p){
    return p.nombre + ' ' + (p.marca||'') + ' ' + (p.cat||'') + ' ' + (p.sku||'')
         + ' ' + (p.proveedorPref||'') + ' ' + (p.nombreCorto||'')
         + ' ' + (p.desc||'') + ' ' + (p.unidad||'')
         + ' ' + textoDeDinero(p.precio) + ' ' + textoDeDinero(p.costo);
  });
  if(!list.length){ el.innerHTML = '<div class="card"><p style="color:#aaa;text-align:center;padding:20px">Sin productos encontrados</p></div>'; return; }
  el.innerHTML = '';
  list.forEach(function(p){
    var stockColor = p.stock<=0 ? '#C62828' : (p.stock<=(p.min||5) ? '#E65100' : '#2E7D32');
    var stockBg = p.stock<=0 ? '#FFEBEE' : (p.stock<=(p.min||5) ? '#FFF3E0' : '#E8F5E9');
    var card = document.createElement('div');
    card.className = 'card';
    card.style.cssText = 'display:flex;align-items:center;gap:12px;padding:12px;margin-bottom:8px;cursor:pointer';
    card.innerHTML = '<div style="width:88px;height:88px;border-radius:12px;background:#f0f0f0;display:flex;align-items:center;justify-content:center;font-size:38px;flex-shrink:0;overflow:hidden">'+(p.foto?'<img src="'+p.foto+'" style="width:100%;height:100%;object-fit:cover">':'📦')+'</div>'
      +'<div style="flex:1;min-width:0">'
      +'<div style="font-size:14px;font-weight:700;line-height:1.3">'+escaparHtml(p.nombre)+'</div>'
      +'<div style="font-size:11px;color:#999;margin-top:2px">'+escaparHtml(p.cat||'Sin categoria')+(p.sku?' · SKU: '+escaparHtml(p.sku):'')+'</div>'
      +(p.desc ? '<div style="font-size:12px;color:#555;margin-top:4px;line-height:1.4">'+escaparHtml(p.desc)+'</div>' : '')
      +'<div style="display:flex;gap:8px;align-items:center;margin-top:4px">'
      +'<span style="font-size:13px;font-weight:700;color:#1565C0">$'+fmtNum(p.precio||0)+'</span>'
      +'<span style="font-size:11px;color:#aaa;font-weight:500">Costo: $'+fmtNum(p.costo||0)+'</span>'
      +'<span style="font-size:11px;padding:2px 8px;border-radius:8px;font-weight:600;background:'+stockBg+';color:'+stockColor+'">Stock: '+p.stock+'</span>'
      +'</div></div>'
      +'<button type="button" class="btn-duplicar-prod" title="Duplicar producto" style="background:var(--nbs-gold);color:white;border:none;border-radius:8px;padding:10px 12px;cursor:pointer;flex-shrink:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;font-size:10px;font-weight:700">📋Duplicar</button>';
    card.onclick = (function(prod){ return function(){ verProductoCatalogo(prod); }; })(p);
    card.querySelector('.btn-duplicar-prod').onclick = (function(prod){ return function(e){ e.stopPropagation(); duplicarProducto(prod); }; })(p);

    // Long press para eliminar directamente
    var pressTimer;
    card.addEventListener('touchstart', (function(prod){ return function(e){
      pressTimer = setTimeout(function(){
        var confirmar = window.confirm('¿Eliminar "'+prod.nombre+'" del catálogo?\nEsto no se puede deshacer.');
        if(!confirmar) return;
        loadProds();
        var eliminados = LS('np_eliminados', []);
        if(eliminados.indexOf(String(prod.id)) === -1){
          eliminados.push(String(prod.id));
          SS('np_eliminados', eliminados);
        }
        productos = productos.filter(function(x){ return String(x.id) !== String(prod.id); });
        SS('np', productos);
        renderCatalogo(document.getElementById('catbuscar').value || '');
        alert('✅ Producto eliminado.');
      }, 800);
    }; })(p), false);
    card.addEventListener('touchend', function(e){ clearTimeout(pressTimer); }, false);
    card.addEventListener('touchmove', function(e){ clearTimeout(pressTimer); }, false);
    card.addEventListener('touchcancel', function(e){ clearTimeout(pressTimer); }, false);

    el.appendChild(card);
  });
}

var productoEditandoId = null;


// Debido a como las computadoras manejan los decimales, una resta como 19.99 - 19.99
// a veces no da exactamente 0 -puede dar un residuo minusculo como 0.000000000000002-.
// Esta funcion evita que ese residuo haga parecer que una factura pagada todavia debe algo.
function renderMargenProductos(){
  var el = document.getElementById('margen-lista');
  if(!el) return;
  var todos = _datosMargen();

  // El promedio se saca SOLO de los que tienen costo puesto: meter los de costo
  // cero lo inflaria a 100% y el numero no diria nada.
  var conCosto = todos.filter(function(p){ return !p.sinCosto; });
  var prom = conCosto.length
    ? Math.round(conCosto.reduce(function(a,p){ return a + p.margen; }, 0) / conCosto.length * 10) / 10
    : 0;
  var bajos = conCosto.filter(function(p){ return p.margen < 20; }).length;
  var perdida = conCosto.filter(function(p){ return p.gan <= 0; }).length;
  var sinCosto = todos.filter(function(p){ return p.sinCosto; }).length;

  var lista = todos.slice();
  if(_margenBusca && _margenBusca.trim()){
    lista = filtrarPorBusqueda(lista, _margenBusca, function(p){
      return p.nombre + ' ' + p.marca + ' ' + p.cat
           + ' ' + textoDeDinero(p.precio) + ' ' + textoDeDinero(p.costo);
    });
  }
  if(_margenOrden === 'menos')      lista.sort(function(a,b){ return a.margen - b.margen; });
  else if(_margenOrden === 'mas')   lista.sort(function(a,b){ return b.margen - a.margen; });
  else lista.sort(function(a,b){ return String(a.nombre).localeCompare(String(b.nombre)); });

  var h = '';

  // El resumen de arriba
  h += '<div style="background:linear-gradient(135deg,#4A148C,#6A1B9A);border-radius:12px;padding:14px;margin-bottom:10px;color:#fff">'
    +   '<div style="font-size:11px;opacity:.85;letter-spacing:.5px">TU MARGEN PROMEDIO</div>'
    +   '<div style="font-size:30px;font-weight:900;line-height:1.1">' + prom + '%</div>'
    +   '<div style="font-size:11.5px;opacity:.9;margin-top:2px">de ' + conCosto.length + ' productos con costo puesto</div>'
    + '</div>';

  if(perdida || bajos || sinCosto){
    h += '<div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap">';
    if(perdida) h += '<div style="flex:1;min-width:90px;background:#FFEBEE;border-radius:9px;padding:8px;text-align:center">'
      + '<div style="font-size:19px;font-weight:900;color:#C62828">' + perdida + '</div>'
      + '<div style="font-size:10px;color:#C62828;font-weight:700">sin ganancia</div></div>';
    if(bajos) h += '<div style="flex:1;min-width:90px;background:#FFF3E0;border-radius:9px;padding:8px;text-align:center">'
      + '<div style="font-size:19px;font-weight:900;color:#E65100">' + bajos + '</div>'
      + '<div style="font-size:10px;color:#E65100;font-weight:700">bajo 20%</div></div>';
    if(sinCosto) h += '<div style="flex:1;min-width:90px;background:#ECEFF1;border-radius:9px;padding:8px;text-align:center">'
      + '<div style="font-size:19px;font-weight:900;color:#546E7A">' + sinCosto + '</div>'
      + '<div style="font-size:10px;color:#546E7A;font-weight:700">sin costo puesto</div></div>';
    h += '</div>';
  }

  // Los botones de orden
  var ops = [['menos','Menos ganancia'],['mas','M\u00e1s ganancia'],['nombre','Por nombre']];
  h += '<div style="display:flex;gap:5px;margin-bottom:10px">'
    + ops.map(function(o){
        var act = (_margenOrden === o[0]);
        return '<button onclick="cambiarOrdenMargen(' + _arg(o[0]) + ')" style="flex:1;padding:8px 4px;'
          + 'background:' + (act ? '#6A1B9A' : '#F0F0F2') + ';color:' + (act ? '#fff' : 'var(--nbs-ink)')
          + ';border:none;border-radius:8px;font-size:11.5px;font-weight:800;cursor:pointer">' + o[1] + '</button>';
      }).join('')
    + '</div>';

  h += '<div style="font-size:11.5px;color:var(--nbs-muted);margin-bottom:8px">'
    + lista.length + ' producto(s) \u00b7 toca uno para modificarlo</div>';

  if(!lista.length){
    h += '<div class="card"><p style="color:#aaa;text-align:center;padding:20px">Sin productos.</p></div>';
    el.innerHTML = h;
    return;
  }

  h += lista.slice(0, 400).map(function(p){
    var col = p.sinCosto ? '#546E7A'
            : (p.gan <= 0 ? '#C62828' : (p.margen < 20 ? '#E65100' : (p.margen >= 45 ? '#2E7D32' : '#1565C0')));
    var pct = Math.max(0, Math.min(100, p.margen));
    return '<div onclick="editarProductoDesdeMargen(' + _arg(String(p.id)) + ')" '
      + 'style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:10px 11px;margin-bottom:6px;cursor:pointer">'
      + '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">'
      +   '<div style="flex:1;min-width:0">'
      +     '<div style="font-size:13px;font-weight:700;color:var(--nbs-ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'
      +       escaparHtml(String(p.nombre).slice(0,40)) + '</div>'
      +     '<div style="font-size:11px;color:#888;margin-top:1px">te cuesta $' + fmtNum(p.costo)
      +       ' \u00b7 lo vendes $' + fmtNum(p.precio) + '</div>'
      +   '</div>'
      +   '<div style="text-align:right;flex-shrink:0">'
      +     '<div style="font-size:15px;font-weight:900;color:' + col + '">' + (p.sinCosto ? '\u2014' : p.margen + '%') + '</div>'
      +     '<div style="font-size:11px;color:' + col + ';font-weight:700">' + (p.sinCosto ? 'sin costo' : '+$' + fmtNum(p.gan)) + '</div>'
      +   '</div>'
      + '</div>'
      + (p.sinCosto ? '' :
          '<div style="height:5px;background:#F0F0F2;border-radius:3px;overflow:hidden;margin-top:6px">'
          + '<div style="height:100%;width:' + pct + '%;background:' + col + '"></div></div>')
      + '</div>';
  }).join('');

  if(lista.length > 400) h += '<div style="font-size:11.5px;color:var(--nbs-muted);text-align:center;padding:8px">'
    + 'Se muestran los primeros 400. Usa el buscador para afinar.</div>';

  el.innerHTML = h;
}

// Al tocar un producto se abre para modificarlo, asi puede corregir el precio o el
// costo ahi mismo sin ir hasta el catalogo.
function editarProductoDesdeMargen(pid){
  loadProds();
  var p = productos.find(function(x){ return String(x.id) === String(pid); });
  if(!p){ avisoGrande('No encontr\u00e9 ese producto.'); return; }
  try { verProductoCatalogo(p); } catch(e){
    try { ir('p-cat'); renderCatalogo(p.nombre); } catch(e2){}
  }
}

// Para imprimir o mandarlo por WhatsApp
function productoCoincide(p, loQueBusca){
  if(!p) return false;
  var todo = [p.nombre, p.marca, p.cat, p.categoria, p.sku, p.codigo]
    .filter(Boolean).join(' ');
  return coincideBusquedaPalabras(todo, loQueBusca);
}

// Y para clientes
function marcaBonita(m){
  var t = String(m == null ? '' : m).trim();
  if(!t) return '';
  // Palabra por palabra, para que "cool care" quede "Cool Care"
  return t.split(/\s+/).map(function(p){
    if(!p) return p;
    // Las de 2 letras o menos que ya vienen en mayúscula se dejan (KG, ML, 3D...)
    if(p.length <= 2 && p === p.toUpperCase() && /[A-Z]/.test(p)) return p;
    return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
  }).join(' ');
}


// Cuenta cuantos cambios hacen falta para convertir una palabra en otra -para aguantar faltas-
function siguienteIdProductoNumerico(){
  var maxId = 0;
  productos.forEach(function(p){
    var n = parseInt(p.id, 10);
    if(!isNaN(n) && String(n) === String(p.id) && n > maxId) maxId = n;
  });
  return maxId + 1;
}

// Abre el mini-formulario de producto nuevo DENTRO del panel de cargar van.
// No se sale de la pantalla, no se pierde lo que ya se está cargando.
function costoBonito(n){
  var v = Number(n);
  if(!isFinite(v)) v = 0;
  var d = String(v).split('.')[1];
  return (d && d.length > 2) ? String(v) : v.toFixed(2);
}

function formatoCostoPreciso(input, event){
  // La coma es solo para leerlo; aqui estorba. Se quita antes de trabajar. -27 ago-
  if(String(input.value).indexOf(',') >= 0) input.value = String(input.value).replace(/,/g, '');
  // Si el usuario teclea el punto decimal el mismo -precision especifica, como 4.0985-, o si
  // pega/rellena un valor de una vez que ya trae un punto -en vez de escribirlo letra por
  // letra-, se activa el "modo preciso" para el resto de esta edicion. Se revisa el texto que
  // se acaba de insertar -event.data-, que puede ser un solo caracter -al teclear- o el texto
  // completo -al pegar o rellenar de una vez-.
  var textoRecienInsertado = event ? event.data : null;
  if(textoRecienInsertado && textoRecienInsertado.indexOf('.') >= 0){ input.dataset.modoPreciso = '1'; }
  else if(event && event.data === undefined && input.value.indexOf('.') >= 0){
    // Respaldo: si el evento no trae la propiedad .data en absoluto -poco comun, pasa cuando algo
    // dispara el evento por codigo en vez de un tecleo o pegado real-, se revisa el valor actual.
    input.dataset.modoPreciso = '1';
  }

  if(input.dataset.modoPreciso === '1'){
    var valor = input.value.replace(/[^\d.]/g, '');
    var partes = valor.split('.');
    if(partes.length > 2) valor = partes[0] + '.' + partes.slice(1).join('');
    var partesFinal = valor.split('.');
    if(partesFinal[1] && partesFinal[1].length > 4) valor = partesFinal[0] + '.' + partesFinal[1].slice(0,4);
    input.value = valor;
  } else {
    // Todavia no se sabe si el usuario quiere precision especial o un monto normal -no se
    // adivina ni se autoinserta el punto todavia, para no danar los digitos de antemano-.
    // Solo se dejan pasar numeros. El punto se inserta al terminar de editar el campo
    // -ver finalizarCostoPreciso-, igual que la calculadora de siempre.
    input.value = input.value.replace(/\D/g, '');
  }
}

// Al salir del campo -onblur-, si el usuario nunca escribio un punto el mismo, se aplica el
// formato de calculadora de siempre -insertar el punto automatico 2 posiciones del final-,
// para que escribir "400" de $4.00 no se quede tal cual ni se guarde por error como $400.00.
// El costo con decimales de mas -4.4589- tambien se ensena con su coma al salir. -27 ago-
function finalizarCostoPreciso(input){
  if(input.dataset.modoPreciso !== '1'){
    formatoMoneda(input);
  } else {
    // Modo preciso -4.4589-: se respetan sus decimales, pero se le pone la coma. -27 ago-
    ponerComaSiHaceFalta(input);
  }
}

function duplicarProducto(p){
  verProductoCatalogo(p); // reutiliza toda la logica de llenar el formulario con los datos del producto original
  productoEditandoId = null; // asi al guardar se crea un producto NUEVO, no se sobreescribe el original
  document.getElementById('ep-titulo').textContent = 'Duplicar producto';
  document.getElementById('ep-btn-eliminar').style.display = 'none';
  document.getElementById('ep-stock').value = 0; // es un producto nuevo, no hereda el stock del original
  document.getElementById('ep-sku').value = ''; // el SKU no debe repetirse entre productos
  setTimeout(function(){
    var campoNombre = document.getElementById('ep-nombre');
    if(campoNombre){ campoNombre.focus(); campoNombre.select(); }
  }, 50);
}

function verProductoCatalogo(p){
  window._volverAMarcaTrasEditar = false;
  productoEditandoId = p.id;
  document.getElementById('ep-titulo').textContent = 'Editar producto';
  document.getElementById('ep-btn-eliminar').style.display = 'block';
  document.getElementById('cat-lista-wrap').style.display = 'none';
  document.getElementById('cat-edit-wrap').style.display = 'block';
  var barraEp = document.getElementById('ep-barra-guardar');
  if(barraEp) barraEp.style.display = 'block';
  window.scrollTo(0, 0);
  // Si el producto ya tiene marca separada, usarla. Si no, separar de la primera palabra del nombre (compatibilidad con productos antiguos)
  // 🏷️ Apuntar cómo se llama AHORA, para poder corregir las facturas viejas
  // si él le cambia el nombre. -19 ago-
  window._nombreAntesDeEditar = String(p.nombre || '');
  if(p.marca){
    document.getElementById('ep-marca').value = p.marca;
    document.getElementById('ep-nombre').value = p.nombreCorto || p.nombre || '';
  } else {
    var partes = (p.nombre||'').trim().split(/\s+/);
    document.getElementById('ep-marca').value = partes[0] || '';
    document.getElementById('ep-nombre').value = partes.slice(1).join(' ') || '';
  }
  document.getElementById('ep-cat').value = p.cat || '';
  document.getElementById('ep-sku').value = p.sku || '';
  document.getElementById('ep-costo').value = (p.costo || 0).toFixed(2);
  document.getElementById('ep-precio').value = (p.precio || 0).toFixed(2);
  document.getElementById('ep-stock').value = p.stock || 0;
  document.getElementById('ep-min').value = p.min || 5;
  document.getElementById('ep-unidad').value = p.unidad || 'unidad';
  llenarProveedoresPref();
  document.getElementById('ep-proveedor-pref').value = p.proveedorPref || '';
  document.getElementById('ep-desc').value = p.desc || '';
  // Cargar foto si existe
  var prev = document.getElementById('ep-foto-preview');
  if(p.foto){
    document.getElementById('ep-foto-data').value = p.foto;
    prev.innerHTML = '<img src="'+p.foto+'" style="width:100%;height:100%;object-fit:cover">';
    prev.style.background = '#f0f0f0';
    prev.style.border = 'none';
  } else {
    document.getElementById('ep-foto-data').value = '';
    prev.innerHTML = '📷';
    prev.style.background = 'var(--nbs-gold-bg)';
    prev.style.border = '2px dashed var(--nbs-gold)';
  }
}

function nuevoProductoCatalogo(){
  window._volverAMarcaTrasEditar = false;
  loadProds();
  productoEditandoId = null;
  document.getElementById('ep-titulo').textContent = 'Nuevo producto';
  document.getElementById('ep-btn-eliminar').style.display = 'none';
  document.getElementById('cat-lista-wrap').style.display = 'none';
  document.getElementById('cat-edit-wrap').style.display = 'block';
  var barraEp = document.getElementById('ep-barra-guardar');
  if(barraEp) barraEp.style.display = 'block';
  window.scrollTo(0, 0);
  document.getElementById('ep-foto-data').value = '';
  var prevNuevo = document.getElementById('ep-foto-preview');
  prevNuevo.innerHTML = '📷';
  prevNuevo.style.background = 'var(--nbs-gold-bg)';
  prevNuevo.style.border = '2px dashed var(--nbs-gold)';
  document.getElementById('ep-marca').value = '';
  document.getElementById('ep-nombre').value = '';
  document.getElementById('ep-cat').value = '';
  document.getElementById('ep-sku').value = '';
  document.getElementById('ep-costo').value = '0.00';
  document.getElementById('ep-precio').value = '0.00';
  document.getElementById('ep-stock').value = 0;
  document.getElementById('ep-min').value = 5;
  document.getElementById('ep-unidad').value = 'unidad';
  llenarProveedoresPref();
  document.getElementById('ep-proveedor-pref').value = '';
  document.getElementById('ep-desc').value = '';
}

function onNombreProductoInput(inputId){
  var val = document.getElementById(inputId).value;
  if(!val || val.length < 1){ ocultarDropdown(inputId); return; }
  loadProds();
  // Buscar el campo de marca correspondiente al mismo formulario
  // Si el campo es pednp-nombre, la marca está en pednp-marca
  // Si es vnp-nombre, la marca está en vnp-marca
  // Si es ep-nombre, la marca está en ep-marca
  var marcaInputId = inputId.replace('-nombre', '-marca');
  var marcaEl = document.getElementById(marcaInputId);
  var marcaActual = marcaEl ? marcaEl.value.trim().toUpperCase() : '';
  var nombres = {};
  productos.forEach(function(p){
    var nombreCorto, marcaProd;
    if(p.marca){
      marcaProd = p.marca.toUpperCase();
      nombreCorto = p.nombreCorto || '';
    } else if(p.nombre){
      var nombreUpper = p.nombre.trim().toUpperCase();
      if(marcaActual && nombreUpper.indexOf(marcaActual) === 0){
        marcaProd = marcaActual;
        nombreCorto = p.nombre.trim().substring(marcaActual.length).trim();
      } else {
        var partes = p.nombre.trim().split(/\s+/);
        marcaProd = (partes[0]||'').toUpperCase();
        nombreCorto = partes.slice(1).join(' ');
      }
    }
    if(!nombreCorto) return;
    if(marcaActual && marcaProd !== marcaActual) return;
    nombres[nombreCorto] = true;
  });
  var q = val.toLowerCase();
  var matches = filtrarPorBusqueda(Object.keys(nombres), q, function(n){ return n; });
  mostrarDropdown(inputId+'-drop', matches, inputId, function(nombre){
    document.getElementById(inputId).value = nombre;
  });
}

function onMarcaInput(inputId){
  var val = document.getElementById(inputId).value;
  if(!val || val.length < 1){ ocultarDropdown(inputId); return; }
  loadProds();
  var marcas = {};
  productos.forEach(function(p){
    if(p.marca){
      marcas[p.marca.toUpperCase()] = true;
    } else if(p.nombre){
      // Productos antiguos sin marca separada: usar primera palabra
      var primera = p.nombre.trim().split(/\s+/)[0];
      if(primera) marcas[primera.toUpperCase()] = true;
    }
  });
  var q = val.toLowerCase();
  var matches = filtrarPorBusqueda(Object.keys(marcas), q, function(m){ return m; });
  mostrarDropdown(inputId+'-drop', matches, inputId, function(marca){
    document.getElementById(inputId).value = marca;
  });
}

function cerrarEdicionProducto(){
  document.getElementById('cat-edit-wrap').style.display = 'none';
  var barraEp = document.getElementById('ep-barra-guardar');
  if(barraEp) barraEp.style.display = 'none';
  productoEditandoId = null;
  if(window._volverAMarcaTrasEditar && window._epmlMarcaActual){
    window._volverAMarcaTrasEditar = false;
    document.getElementById('epm-marca').value = window._epmlMarcaActual;
    abrirEditarProductosDeMarca();
  } else {
    document.getElementById('cat-lista-wrap').style.display = 'block';
  }
}


// ═══════════════════════════════════════════════════════════════════
//  🔄 AL CORREGIR UN NOMBRE, ACTUALIZARLO EN LO PENDIENTE  (15 ago 2026)
//
//  Sensei: "si tengo un pedido a medio hacer y me salgo y voy al catálogo
//  para corregir un nombre, ese nombre corregido no se actualiza cuando
//  tengo ese producto ya en el carrito del pedido del cliente; debería
//  actualizarse".
//
//  🔑 POR QUÉ PASABA: el carrito guarda una COPIA del nombre
//  (`items.push({ pid, nombre, ... })`). Al corregir el catálogo, la copia
//  se queda vieja. Pero el `pid` SÍ está guardado, así que se puede buscar.
//
//  ⚠️ LAS VENTAS YA HECHAS NO SE TOCAN. Una factura entregada es un
//  documento: tiene que coincidir con el papel que tiene el cliente.
//  Solo se actualiza LO PENDIENTE.
// ═══════════════════════════════════════════════════════════════════
function dondeApareceElProducto(pid, nombreViejo){
  var V = LS('nv', []);
  var C = LS('nc', []);
  var enVentas = 0, enCompras = 0, facturas = [];
  V.forEach(function(v){
    var hay = (v.items || []).some(function(it){
      return String(it.pid) === String(pid) && String(it.nombre || '') === String(nombreViejo);
    });
    if(hay){ enVentas++; if(facturas.length < 4) facturas.push(v.numFactura || v.id); }
  });
  C.forEach(function(c){
    var hay = (c.items || []).some(function(it){
      return String(it.pid) === String(pid) && String(it.nombre || '') === String(nombreViejo);
    });
    if(hay) enCompras++;
  });
  return { ventas: enVentas, compras: enCompras, ejemplos: facturas };
}

// 🔑 Cambiar el nombre en las facturas viejas. SOLO el nombre.
function guardarEdicionProducto(){
  var marca = limpiarTexto(document.getElementById('ep-marca').value.trim());
  if(!marca){ alert('La marca es requerida'); return; }
  var nombre = limpiarTexto(document.getElementById('ep-nombre').value.trim());
  if(!nombre){ alert('El nombre del producto es requerido'); return; }
  var cat = limpiarTexto(document.getElementById('ep-cat').value.trim());
  var sku = document.getElementById('ep-sku').value.trim();
  var costo = dinero(document.getElementById('ep-costo').value) || 0;
  var precio = dinero(document.getElementById('ep-precio').value) || 0;
  var stock = parseInt(document.getElementById('ep-stock').value) || 0;
  var min = parseInt(document.getElementById('ep-min').value) || 5;
  var foto = document.getElementById('ep-foto-data').value || '';
  var unidad = document.getElementById('ep-unidad').value || 'unidad';
  var proveedorPref = document.getElementById('ep-proveedor-pref').value || '';
  var desc = limpiarTexto(document.getElementById('ep-desc').value.trim());
  var nombreCompleto = marca + ' ' + nombre;

  // -confirmacion redundante quitada, el boton de Guardar ya es la confirmacion-

  // OJO: hay que apuntar el precio y el costo ANTES de sobreescribirlos. Antes el codigo
  // comparaba DESPUES, sobre el mismo objeto ya modificado, asi que "el precio de antes" y
  // "el precio nuevo" siempre salian iguales y el HISTORIAL DE PRECIOS NUNCA SE REGISTRABA.
  // Comprobado en pruebas: cero registros guardados. -arreglado 27 jul-
  var costoAntes = null, precioAntes = null;
  if(productoEditandoId === null){
    var nuevoId = 'custom_' + Date.now();
    productos.push({ id: nuevoId, marca: marca, nombreCorto: nombre, nombre: nombreCompleto, cat: cat, sku: sku, costo: costo, precio: precio, stock: stock, min: min, foto: foto, unidad: unidad, proveedorPref: proveedorPref, desc: desc });
  } else {
    var p = productos.find(function(x){ return String(x.id) === String(productoEditandoId); });
    if(!p) return;
    costoAntes = p.costo || 0;
    precioAntes = (typeof p.precio === 'number') ? p.precio : parseFloat(p.precio) || 0;
    p.marca = marca;
    p.nombreCorto = nombre;
    // 🔄 Si el nombre cambió, actualizarlo en TODO lo pendiente. -15 ago-
    var _nomAntes = p.nombre;
    p.nombre = nombreCompleto;
    if(_nomAntes !== nombreCompleto){
      try { window._nombresCambiados = window._nombresCambiados || [];
            window._nombresCambiados.push({ pid: p.id, nombre: nombreCompleto }); } catch(e){}
    }
    p.cat = cat;
    p.sku = sku;
    p.costo = costo;
    p.precio = precio;
    p.stock = stock;
    p.min = min;
    p.foto = foto;
    p.unidad = unidad;
    p.proveedorPref = proveedorPref;
    p.desc = desc;
  }
  // Registrar cambio de precio si hubo -ahora si compara contra el valor de ANTES-
  if(productoEditandoId !== null && precioAntes !== null && precioAntes !== precio){
    registrarCambioPrecio(nombreCompleto, precioAntes, precio);
  }
  var idProductoEditado = productoEditandoId;
  var _nombreAntes = window._nombreAntesDeEditar || null;
  SS('np', productos);
  // 🏷️ Si le cambió el nombre y el producto está en facturas viejas, se le
  // pregunta si quiere corregirlas también. -19 ago-
  try {
    if(idProductoEditado !== null && _nombreAntes && _nombreAntes !== nombreCompleto){
      setTimeout(function(){
        preguntarRenombrarViejas(idProductoEditado, _nombreAntes, nombreCompleto);
      }, 350);
    }
  } catch(eRen){}
  window._nombreAntesDeEditar = null;
  flash('mk-ep');
  // 🔄 Aplicar los nombres corregidos a TODO lo pendiente. -15 ago-
  try {
    var _cambios = window._nombresCambiados || [];
    if(_cambios.length){
      var _tot = { pedidos: 0, carrito: 0, aMedias: 0, relleno: 0 };
      _cambios.forEach(function(c){
        var r = actualizarNombreEnPendientes(c.pid, c.nombre);
        _tot.pedidos += r.pedidos; _tot.carrito += r.carrito;
        _tot.aMedias += r.aMedias; _tot.relleno += r.relleno;
      });
      window._nombresCambiados = [];
      avisarNombreActualizado(_tot);
    }
  } catch(eNom){}
  // Si el COSTO cambio en un producto ya existente, preguntar si fue un error de captura
  // -en cuyo caso se corrige tambien en las ventas ya registradas, para que la ganancia de
  // los reportes pasados quede correcta- o si el costo realmente cambio con el proveedor
  // -en cuyo caso las ventas pasadas se dejan tal cual, porque en su momento ese fue el
  // costo real y no se debe alterar un registro financiero historico valido-.
  if(costoAntes !== null && costoAntes !== costo){
    var corregirHistorial = confirm(
      'El costo de este producto cambió de $'+costoAntes.toFixed(2)+' a $'+costo.toFixed(2)+'.\n\n'+
      'Presiona ACEPTAR si el costo anterior estaba MAL -un error tuyo- y quieres corregirlo también en las ventas ya registradas, para que la ganancia de tus reportes pasados quede correcta.\n\n'+
      'Presiona CANCELAR si el proveedor realmente cambió el precio -en ese caso las ventas pasadas se dejan tal cual, ya que en su momento ese fue el costo real.'
    );
    if(corregirHistorial){
      var ventasCorregir = LS('nv', []);
      var lineasCorregidas = 0;
      var ventasRecalculadas = 0;
      ventasCorregir.forEach(function(v){
        var tocada = false;
        (v.items||[]).forEach(function(it){
          if(it.pid && String(it.pid) === String(idProductoEditado)){
            it.costo = costo;
            lineasCorregidas++;
            tocada = true;
          }
        });
        // 🔴 Y AHORA SI SE RECALCULA LA GANANCIA DE ESA VENTA. ESTE ERA EL FALLO QUE
        // LE VOLVIA A SENSEI CADA SEMANA: la app cambiaba el costo de las ventas viejas
        // pero dejaba la ganancia con el numero anterior, asi que la Revision de
        // Integridad se lo marcaba una y otra vez. -8 ago-
        // Los "Balance inicial" NO se tocan: su ganancia cero es correcta.
        if(tocada && !v.cancelada && !esBalanceInicial(v) && sePuedeCalcularGanancia(v)){
          var gNueva = gananciaDeVenta(v);
          if(Math.abs((parseFloat(v.ganancia) || 0) - gNueva) > 0.005){
            v.ganancia = gNueva;
            ventasRecalculadas++;
          }
        }
      });
      if(lineasCorregidas > 0){
        SS('nv', ventasCorregir);
        setTimeout(function(){ alert('Corregido: '+lineasCorregidas+' línea(s) en ventas ya registradas ahora reflejan el costo correcto de $'+costo.toFixed(2)+'.'
          + (ventasRecalculadas ? '\n\nY se recalculó la ganancia de '+ventasRecalculadas+' venta(s), para que la Revisión de Integridad no te las vuelva a marcar.' : '')); }, 300);
      }
    }
  }
  // Antes esto esperaba 900ms antes de cerrar, y encima dejaba la pagina donde estaba
  // -a media lista-. Sensei no veia respuesta y creia que no habia guardado. Ahora se
  // cierra al instante, sube al principio de la lista y lo dice claro. -27 jul-
  cerrarEdicionProducto();
  renderCatalogo(document.getElementById('catbuscar').value || '');
  window.scrollTo(0, 0);
  avisoGrande('✓ Producto guardado\n\n' + nombreCompleto);
}


// ═══════════════════════════════════════════════════════════════════
//  ♻️ LOS PRODUCTOS BORRADOS
//
//  🔑 Sensei, 19 ago: un producto no le aparecía en el catálogo ni al
//  hacer una orden, pero SÍ salía en una factura vieja. Eso solo pasa
//  cuando el producto se borró: la factura guarda una foto del momento
//  de la venta, así que ahí sigue.
//
//  La app guardaba los ids borrados pero no había forma de verlos.
// ═══════════════════════════════════════════════════════════════════

// 🔍 Busca en las FACTURAS los productos que ya no están en el catálogo
function productosQueYaNoEstan(){
  loadProds();
  var vivos = {};
  productos.forEach(function(p){ vivos[String(p.id)] = true; });

  var fantasmas = {};
  // ── En las VENTAS ──
  LS('nv', []).forEach(function(v){
    if(v.cancelada) return;
    (v.items || []).forEach(function(it){
      var pid = String(it.pid || '');
      if(!pid || vivos[pid]) return;
      if(!fantasmas[pid]){
        fantasmas[pid] = {
          pid: pid,
          nombre: it.nombre || '(sin nombre)',
          precio: parseFloat(it.precio) || 0,
          costo: parseFloat(it.costo) || 0,
          vendido: 0, veces: 0, ultima: '', clientes: {}
        };
      }
      var f = fantasmas[pid];
      f.vendido += parseFloat(it.cant) || 0;
      f.veces++;
      // El nombre y el precio más recientes mandan
      var fe = parsearFechaVenta(v.fecha);
      var fu = f.ultima ? parsearFechaVenta(f.ultima) : null;
      if(!fu || (fe && fe.getTime() > fu.getTime())){
        f.ultima = v.fecha || '';
        f.nombre = it.nombre || f.nombre;
        f.precio = parseFloat(it.precio) || f.precio;
        if(parseFloat(it.costo)) f.costo = parseFloat(it.costo);
      }
      if(v.cn) f.clientes[v.cn] = true;
    });
  });

  // ── Y en las COMPRAS, que dan el costo real ──
  LS('nc', []).forEach(function(c){
    (c.items || []).forEach(function(it){
      var pid = String(it.pid || '');
      if(!pid || vivos[pid]) return;
      if(!fantasmas[pid]){
        fantasmas[pid] = { pid: pid, nombre: it.nombre || '(sin nombre)',
                           precio: 0, costo: parseFloat(it.costo) || 0,
                           vendido: 0, veces: 0, ultima: '', clientes: {} };
      }
      if(parseFloat(it.costo)) fantasmas[pid].costo = parseFloat(it.costo);
      fantasmas[pid].comprado = (fantasmas[pid].comprado || 0) + (parseFloat(it.cant) || 0);
    });
  });

  return Object.keys(fantasmas).map(function(k){
    var f = fantasmas[k];
    f.cuantosClientes = Object.keys(f.clientes).length;
    return f;
  }).sort(function(a, b){ return b.vendido - a.vendido; });
}

// LA PANTALLA

// ═══════════════════════════════════════════════════════════════════
//  🔎 EL BUSCADOR PROFUNDO
//
//  Busca UN producto por todos lados y dice exactamente dónde está y
//  por qué no se ve. Hecho el 19 ago porque Sensei llevaba horas con
//  un producto que no aparecía y Claude no tenía sus datos de hoy.
// ═══════════════════════════════════════════════════════════════════

function abrirProductosBorrados(){
  var lista = productosQueYaNoEstan();
  var ov = document.getElementById('borrados-ov');
  if(!ov){
    ov = document.createElement('div');
    ov.id = 'borrados-ov';
    document.body.appendChild(ov);
  }
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:99997;'
    + 'overflow-y:auto;padding:18px 14px';

  var h = '<div style="max-width:470px;margin:0 auto;background:#fff;border-radius:14px;padding:18px">';
  h += '<div style="font-size:18px;font-weight:900;margin-bottom:4px">'
    + '\u267B\uFE0F Productos que ya no est\u00e1n</div>';

  if(!lista.length){
    h += '<div style="font-size:13px;color:var(--nbs-muted);line-height:1.6;margin:14px 0">'
      + '\u2705 <b>No falta ninguno.</b><br><br>'
      + 'Todos los productos de tus facturas siguen en el cat\u00e1logo.</div>';
    h += '<button onclick="cerrarProductosBorrados()" class="btn" style="width:100%;margin:0;'
      + 'background:#F0F0F5;color:#333">Cerrar</button></div>';
    ov.innerHTML = h;
    return;
  }

  h += '<div style="font-size:12.5px;color:var(--nbs-muted);line-height:1.55;margin-bottom:14px">'
    + 'Estos <b>' + lista.length + ' producto(s)</b> est\u00e1n en tus facturas pero ya <b>NO est\u00e1n '
    + 'en el cat\u00e1logo</b>. Por eso no los encuentras al vender ni al comprar.<br><br>'
    + 'Se pueden devolver al cat\u00e1logo con su nombre, precio y costo, sac\u00e1ndolos de sus '
    + 'propias facturas.</div>';

  lista.forEach(function(f){
    h += '<div style="background:var(--nbs-red-bg);border-radius:11px;padding:13px;margin-bottom:10px;'
      + 'border:1px solid #EF9A9A">';
    h += '<div style="font-size:14.5px;font-weight:900;color:var(--nbs-ink);line-height:1.3">'
      + escaparHtml(f.nombre) + '</div>';
    h += '<div style="font-size:12px;color:var(--nbs-muted);margin-top:5px;line-height:1.5">'
      + 'Vendiste <b>' + f.vendido + '</b> unidad(es) en <b>' + f.veces + '</b> factura(s)'
      + (f.cuantosClientes ? ' a <b>' + f.cuantosClientes + '</b> cliente(s)' : '') + '.<br>'
      + (f.ultima ? 'La \u00faltima vez el <b>' + escaparHtml(f.ultima) + '</b>.<br>' : '')
      + 'Se vend\u00eda a <b>$' + fmtNum(f.precio) + '</b>'
      + (f.costo ? ' y costaba <b>$' + fmtNum(f.costo) + '</b>' : '') + '.</div>';
    h += '<button onclick="devolverAlCatalogo(' + _arg(f.pid) + ')" class="btn" '
      + 'style="width:100%;margin:10px 0 0;background:var(--nbs-green-text);color:#fff;'
      + 'font-weight:900;font-size:13.5px;padding:11px">'
      + '\u267B\uFE0F Devolverlo al cat\u00e1logo</button>';
    h += '</div>';
  });

  h += '<button onclick="cerrarProductosBorrados()" class="btn" style="width:100%;margin:8px 0 0;'
    + 'background:#F0F0F5;color:#333">Cerrar</button></div>';
  ov.innerHTML = h;
}

function cerrarProductosBorrados(){
  var ov = document.getElementById('borrados-ov');
  if(ov) ov.remove();
}

// ♻️ DEVOLVERLO AL CATÁLOGO, reconstruido desde sus facturas
function devolverAlCatalogo(pid){
  var lista = productosQueYaNoEstan();
  var f = lista.find(function(x){ return String(x.pid) === String(pid); });
  if(!f){ alert('Ya no encuentro ese producto.'); return; }

  var cuantas = prompt('\u267B\uFE0F Devolver "' + f.nombre + '" al cat\u00e1logo.\n\n'
    + '\u00bfCu\u00e1ntas unidades tienes de este producto AHORA?\n'
    + '(si no tienes ninguna, pon 0)', '0');
  if(cuantas === null) return;
  var stock = parseInt(cuantas, 10);
  if(isNaN(stock) || stock < 0) stock = 0;

  protegerConHuella(function(){
    loadProds();
    var P = LS('np', []);
    // Por si acaso, que no esté ya
    if(P.some(function(x){ return String(x.id) === String(pid); })){
      alert('Ese producto ya est\u00e1 en el cat\u00e1logo.');
      cerrarProductosBorrados();
      return;
    }
    // 🔑 La marca: la primera palabra del nombre, como hace el resto de la app
    var partes = String(f.nombre || '').trim().split(/\s+/);
    var marca = partes.length > 1 ? partes[0] : '';
    var nombreCorto = partes.length > 1 ? partes.slice(1).join(' ') : f.nombre;

    P.push({
      id: f.pid,
      nombre: f.nombre,
      nombreCorto: nombreCorto,
      marca: marca,
      cat: '',
      sku: '',
      precio: f.precio,
      costo: f.costo,
      stock: stock,
      min: 5,
      unidad: 'unidad',
      desc: '',
      mod: Date.now()
    });
    SS('np', P);

    // 🔑 Y sacarlo de la lista de borrados, para que no lo vuelva a esconder
    var elim = LS('np_eliminados', []);
    var i = elim.indexOf(String(pid));
    if(i >= 0){ elim.splice(i, 1); SS('np_eliminados', elim); }

    PRODS = []; loadProds();
    try { marcarPendienteDeSubir('np'); } catch(e){}
    cerrarProductosBorrados();
    avisoGrande('\u2705 "' + f.nombre + '" volvi\u00f3 al cat\u00e1logo.\n\n'
      + 'Precio $' + fmtNum(f.precio) + ' \u00b7 costo $' + fmtNum(f.costo)
      + ' \u00b7 ' + stock + ' unidad(es).\n\n'
      + 'Rev\u00edsalo por si quieres ajustarle algo.');
    try { if(typeof renderCatalogo === 'function') renderCatalogo(''); } catch(e){}
  });
}

function eliminarProductoCatalogo(){
  if(productoEditandoId === null){ alert('No hay producto seleccionado'); return; }
  loadProds();
  var p = productos.find(function(x){ return String(x.id) === String(productoEditandoId); });
  if(!p){ alert('Producto no encontrado'); return; }
  if(!confirm('¿Eliminar "'+escaparHtml(p.nombre)+'" del catálogo?\nEsto no se puede deshacer.')) return;
  // Guardar en lista de eliminados
  var eliminados = LS('np_eliminados', []);
  if(eliminados.indexOf(String(productoEditandoId)) === -1){
    eliminados.push(String(productoEditandoId));
    SS('np_eliminados', eliminados);
  }
  // Eliminar del array y guardar
  productos = productos.filter(function(x){ return String(x.id) !== String(productoEditandoId); });
  SS('np', productos);
  productoEditandoId = null;
  cerrarEdicionProducto();
  renderCatalogo(document.getElementById('catbuscar').value || '');
  alert('✅ Producto eliminado correctamente.');
}

function agregarProducto(pid, cant, prod){
  var encontrado = false;
  var cidActual = document.getElementById('vcl') ? document.getElementById('vcl').value : null;
  var precioAUsar = obtenerPrecioParaCliente(cidActual, prod.id, prod.precio);

  // 🚨 LA RED: nunca meter en una venta un producto que va en $0.00 -19 ago-.
  // Sensei: "el producto a la hora de venderlo sale el precio del cliente en 0.00, o sea
  // que le sale gratis, y si no me fijo de repente se lo estoy regalando".
  if(!(parseFloat(precioAUsar) > 0.005)){
    var _sug = precioSugerido(prod.costo);
    var _esc = prompt('⚠️ "' + prod.nombre + '" no tiene precio de venta.\n\n'
      + 'Si lo dejas así se lo estás REGALANDO.\n\n'
      + 'Escribe a qué precio lo vendes:', _sug ? _sug.toFixed(2) : '');
    if(_esc === null) return;                       // se arrepintio: no se agrega nada
    var _v = parseFloat(String(_esc).replace(/[$,]/g,'')) || 0;
    if(!(_v > 0.005)){
      alert('No se agregó: sin precio de venta el producto iría gratis.');
      return;
    }
    precioAUsar = _v;
    // Y se le guarda al producto, para no volver a preguntar en cada venta
    try {
      loadProds();
      var _p = productos.find(function(x){ return String(x.id) === String(prod.id); });
      if(_p){ _p.precio = _v; SS('np', productos); }
    } catch(e){}
  }
  for(var j=0;j<iV.length;j++){
    if(String(iV[j].pid)===String(pid)){ iV[j].cant+=cant; encontrado=true; break; }
  }
  if(!encontrado) iV.push({pid:prod.id,nombre:prod.nombre,cant:cant,precio:precioAUsar,costo:prod.costo});
  document.getElementById('vcant').value=1;
  clearV();
  renderIV();
}
function actualizarPrecioIV(i, val){
  if(!iV[i]) return;
  iV[i].precio = dinero(val);
  // No se vuelve a dibujar toda la lista aqui -perderias el foco del campo mientras escribes-,
  // solo se actualiza el numero del total de esa linea y el subtotal general.
  var el = document.getElementById('iv');
  if(el && el.children[i]){
    var totalLinea = el.children[i].querySelector('span:nth-child(2)');
    if(totalLinea) totalLinea.textContent = '$'+fmtNum(iV[i].cant*iV[i].precio);
  }
  var subtot = iV.reduce(function(s,it){ return s+(it.cant*it.precio); },0);
  var st = document.getElementById('vsubtot');
  if(st) st.textContent = '$' + fmtNum(subtot);
  calcDesc();
}

function verificarStockSuficiente(items){
  var faltantes = [];
  items.forEach(function(it){
    var p = productos.find(function(x){ return String(x.id) === String(it.pid); });
    if(p && it.cant > (p.stock||0)){
      faltantes.push({ nombre: p.nombre, stock: p.stock||0, cant: it.cant });
    }
  });
  if(!faltantes.length) return true;
  var detalle = faltantes.map(function(f){
    return '• "'+f.nombre+'" — tienes '+f.stock+' en existencia, estás vendiendo '+f.cant+'.';
  }).join('\n');
  return confirm('⚠️ Stock insuficiente\n\n'+detalle+'\n\nEl stock quedará en negativo y se corregirá solo cuando metas la factura de compra de estos productos.\n\n¿Vender igual?');
}

// ═══════════════════════════════════════════════════════════════════
//  LA GANANCIA DE UNA VENTA — UNA SOLA FÓRMULA PARA TODA LA APP
//
//  🔴 EL PROBLEMA QUE ESTO RESUELVE (7-8 ago 2026):
//  Habia CUATRO formulas distintas — al vender, al editar la factura, en
//  la Revision de Integridad y en "Arreglar las ganancias" — y SOLO la de
//  vender restaba el descuento de la factura. Por eso la Revision marcaba
//  como "mal" ventas que estaban BIEN, y "Arreglar las ganancias" las
//  dejaba INFLADAS. A Sensei le salia el mismo aviso cada semana.
//
//  Ahora todas llaman aqui. Si algun dia cambia la regla, cambia en un
//  solo sitio y no se pueden volver a contradecir.
// ═══════════════════════════════════════════════════════════════════
// El subtotal de una factura: lo que suman los renglones ANTES del descuento.
// Se calcula de los items y no del campo `subtotal`, porque las facturas viejas
// pueden no tenerlo. -8 ago-
function avisarSiProductoExiste(valor){
  var aviso = document.getElementById('ccnombre-aviso');
  if(!valor || valor.trim().length < 3){ aviso.style.display = 'none'; return; }
  loadProds();
  var vl = valor.trim().toLowerCase();
  var existe = productos.some(function(p){ return p.nombre.toLowerCase().indexOf(vl) >= 0 || vl.indexOf(p.nombre.toLowerCase()) >= 0; });
  aviso.style.display = existe ? 'block' : 'none';
}

function productosHabituales(cid, ventasTodas){
  if(!cid) return [];
  var delCliente = (ventasTodas || []).filter(function(v){
    return !v.cancelada && String(v.cid) === String(cid);
  });
  var recientes = delCliente.slice(-5); // las ultimas 5 compras
  var mapa = {};
  recientes.forEach(function(v){
    (v.items||[]).forEach(function(it){
      if(!it.pid) return;
      var k = String(it.pid);
      if(!mapa[k]) mapa[k] = { veces: 0, cant: it.cant || 1 };
      mapa[k].veces++;
      mapa[k].cant = it.cant || 1; // la cantidad de la vez mas reciente
    });
  });
  var lista = [];
  Object.keys(mapa).forEach(function(k){
    var prod = productos.find(function(x){ return String(x.id) === k; });
    if(!prod) return; // ese producto ya no existe en el catalogo
    lista.push({ prod: prod, veces: mapa[k].veces, cant: mapa[k].cant });
  });
  lista.sort(function(a,b){ return b.veces - a.veces; });
  return lista.slice(0, 6);
}

function marcarNoQuisoNada(idx){
  _marcarBarberoSinCompra(idx, 'noCompro',
    '\ud83d\udeab No quiso nada', 'estaba pero no quiso nada');
}

function marcarNoEstaba(idx){
  _marcarBarberoSinCompra(idx, 'noEstaba',
    '\ud83d\udeaa No estaba', 'no estaba en la barber\u00eda');
}

function marcarBarberoActivo(idx){
  window._barberoActivo = idx;
  for(var i = 0; i < (pedidosMultiTemp || []).length; i++){
    var c = document.getElementById('multi-card-' + i);
    var cab = document.getElementById('multi-cab-' + i);
    if(!c) continue;
    var encendido = (i === idx);
    c.style.borderTopColor = encendido ? '#1a237e' : '#B9B9C6';
    c.style.borderRightColor = encendido ? '#1a237e' : '#B9B9C6';
    c.style.borderBottomColor = encendido ? '#1a237e' : '#B9B9C6';
    c.style.borderTopWidth = encendido ? '4px' : '1.5px';
    c.style.borderRightWidth = encendido ? '4px' : '1.5px';
    c.style.borderBottomWidth = encendido ? '4px' : '1.5px';
    c.style.boxShadow = encendido ? '0 5px 18px rgba(26,35,126,0.30)' : '0 1px 5px rgba(0,0,0,0.06)';
    // La rayita de la izquierda: ROJA y mas gruesa mientras este elegido; al apagarse
    // vuelve a su color de siempre.
    c.style.borderLeftWidth = encendido ? '10px' : '6px';
    c.style.borderLeftColor = encendido ? '#C62828' : (c.getAttribute('data-rayita') || '#999');
    // Los apagados se ven mas suaves: menos color y un poco mas claros. El elegido, entero.
    c.style.filter  = encendido ? 'none' : 'saturate(0.45) opacity(0.72)';
    c.style.background = encendido ? '#fff' : '#FAFAFC';
    if(cab) cab.style.background = encendido ? '#DDE3FA' : '#EFEFF3';
  }
}

function productosParaBitacora(v){
  return ((v && v.items) || []).map(function(it){
    return { nombre: String(it.nombre || '').slice(0, 40),
             cant: parseFloat(it.cant) || 0,
             precio: parseFloat(it.precio) || 0 };
  });
}

// ═══ BUSCAR EN LA BITÁCORA ═══
// desde / hasta en formato MM/DD/AAAA. Sin nada = todo.
function buscarProductoPorVoz(txt){
  var q = normalizarTextoBusqueda(String(txt || ''));
  if(!q || q.length < 3) return [];
  loadProds();
  var res = [];
  productos.forEach(function(p){
    var n = normalizarTextoBusqueda(String(p.nombre || '') + ' ' + String(p.marca || ''));
    if(n.indexOf(q) >= 0) res.push({ p: p, largo: n.length });
  });
  // El nombre más corto que contiene lo que dijo suele ser el que quería
  res.sort(function(a,b){ return a.largo - b.largo; });
  return res.map(function(x){ return x.p; });
}

// ═══ ENTENDER LO QUE DIJO ═══
// Devuelve { tipo, ... }. Si no entiende, tipo='nada'.
function marcarAvisoLeido(a){
  try {
    var l = avisosLeidos();
    var h = huellaDeAviso(a);
    if(l.some(function(x){ return x.huella === h; })) return;
    l.unshift({
      huella: h, clave: a.clave || '', titulo: a.titulo || '',
      detalle: a.detalle || a.texto || '', nivel: a.nivel || '',
      icono: a.icono || '\ud83d\udcac', cuando: fechaHoy(), hora: horaAhora12()
    });
    if(l.length > 120) l = l.slice(0, 120);
    SS(LEIDOS, l);
    try { pintarPuntoAsistente(); } catch(e){}
  } catch(e){}
}

function marcarComoNoLeido(huella){
  try {
    var l = avisosLeidos().filter(function(x){ return x.huella !== huella; });
    SS(LEIDOS, l);
    renderHistorialAvisos();
    try { pintarPuntoAsistente(); } catch(e){}
    try { avisoChico('\ud83d\udce5 Vuelve a salir como nuevo'); } catch(e){}
  } catch(e){}
}

// ── EL HISTORIAL ──
function irACatalogo(){ try { ir('p-inv'); } catch(e){ try { ir('p-cat'); } catch(e2){} } }
// Lo pide el aviso del vigilante y NO existia: el boton habria quedado muerto. -27 ago-
// La pantalla es 'p-sup', que al abrirse ensena la LISTA de suplidores -asi lo hace ir()-.
// Ojo: 'p-sups' no existe; se probo y habria dejado el boton sin hacer nada.
function _renglonPrecios(K){
  var pp = K.cliente.preciosPersonalizados || [];
  loadProds();
  var cont = _sub(
    (pp.length
      ? pp.map(function(x, i){
          var prod = productos.find(function(q){ return String(q.id) === String(x.pid); });
          var nombre = prod ? prod.nombre : ('producto #' + x.pid);
          var normal = prod ? (parseFloat(prod.precio) || 0) : 0;
          var suyo = parseFloat(x.precio) || 0;
          var dif = normal ? Math.round((normal - suyo) * 100) / 100 : 0;
          return '<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid #F4F4F8">'
            + '<div style="flex:1;min-width:0">'
            +   '<div style="font-size:12.5px;font-weight:700;color:var(--nbs-ink);overflow:hidden;'
            +     'text-overflow:ellipsis;white-space:nowrap">' + escaparHtml(String(nombre).slice(0, 34)) + '</div>'
            +   '<div style="font-size:10.5px;color:var(--nbs-muted)">normal $' + fmtNum(normal)
            +     (dif > 0.005 ? ' \u00b7 le rebajas $' + fmtNum(dif) : '') + '</div>'
            + '</div>'
            + '<div style="font-size:13.5px;font-weight:900;color:var(--nbs-gold-dark);flex-shrink:0">$'
            +   fmtNum(suyo) + '</div>'
            + '<button onclick="event.stopPropagation();cambiarPrecioEspecial(' + _arg(K.cliente.id) + ',' + _arg(x.pid) + ')" '
            +   'style="background:#FFF8E1;border:1px solid #F9A825;border-radius:7px;padding:6px 9px;'
            +   'font-size:12px;cursor:pointer;flex-shrink:0">\u270f\ufe0f</button>'
            + '<button onclick="event.stopPropagation();quitarPrecioEspecial(' + _arg(K.cliente.id) + ',' + _arg(x.pid) + ')" '
            +   'style="background:#FFEBEE;border:1px solid #C62828;border-radius:7px;padding:6px 9px;'
            +   'font-size:12px;cursor:pointer;flex-shrink:0">\ud83d\uddd1\ufe0f</button>'
            + '</div>';
        }).join('')
      : '<div style="font-size:11.5px;color:var(--nbs-muted);margin-bottom:9px;line-height:1.6">'
        + 'Este cliente paga los precios normales. Si le das un precio especial en alg\u00fan producto, '
        + 'la app se lo aplica sola cada vez que le vendas ese producto.</div>')
    + '<button onclick="event.stopPropagation();agregarPrecioEspecial(' + _arg(K.cliente.id) + ')" '
    +   'style="width:100%;margin-top:9px;padding:10px;background:#fff;border:1.5px solid var(--nbs-gold);'
    +   'color:var(--nbs-gold-dark);border-radius:9px;font-size:12.5px;font-weight:800;cursor:pointer">'
    +   '\u2795 Ponerle un precio especial</button>'
  );
  return _filaPanel('precios', '\ud83c\udff7\ufe0f', 'Sus precios especiales',
    pp.length ? String(pp.length) + ' producto(s)' : 'ninguno', null, cont,
    'agregarPrecioEspecial(' + _arg(K.cliente.id) + ')');
}

function agregarPrecioEspecial(cid){
  loadProds();
  var q = prompt('\u00bfA qu\u00e9 producto le quieres poner precio especial?\n\nEscribe parte del nombre:');
  if(!q) return;
  var qn = normalizarTextoBusqueda(q);
  var hallados = productos.filter(function(p){
    return normalizarTextoBusqueda(String(p.nombre || '')).indexOf(qn) >= 0;
  }).slice(0, 8);
  if(!hallados.length){ alert('No encontr\u00e9 ning\u00fan producto con "' + q + '".'); return; }
  var lista = hallados.map(function(p, i){
    return (i + 1) + '. ' + String(p.nombre).slice(0, 34) + '  $' + fmtNum(parseFloat(p.precio) || 0);
  }).join('\n');
  var cual = prompt('\u00bfCu\u00e1l de estos?\n\n' + lista + '\n\nEscribe el n\u00famero:');
  if(!cual) return;
  var idx = parseInt(cual, 10) - 1;
  if(isNaN(idx) || idx < 0 || idx >= hallados.length) return;
  cambiarPrecioEspecial(cid, hallados[idx].id);
}

function cambiarPrecioEspecial(cid, pid){
  loadProds();
  clientes = LS('ncl', []);
  var i = clientes.findIndex(function(c){ return String(c.id) === String(cid); });
  if(i < 0) return;
  var prod = productos.find(function(p){ return String(p.id) === String(pid); });
  if(!prod){ alert('No encontr\u00e9 ese producto.'); return; }
  var normal = parseFloat(prod.precio) || 0;
  if(!clientes[i].preciosPersonalizados) clientes[i].preciosPersonalizados = [];
  var ya = clientes[i].preciosPersonalizados.find(function(x){ return String(x.pid) === String(pid); });
  var actual = ya ? (parseFloat(ya.precio) || 0) : normal;
  var txt = prompt(String(prod.nombre).slice(0, 40) + '\n\n'
    + 'Precio normal: $' + fmtNum(normal) + '\n'
    + (ya ? 'Precio suyo ahora: $' + fmtNum(actual) + '\n' : '')
    + '\n\u00bfQu\u00e9 precio le pones a ' + nombreCl(clientes[i]) + '?', String(actual));
  if(txt === null) return;
  var nuevo = parseFloat(String(txt).replace(/[^0-9.]/g, ''));
  if(isNaN(nuevo) || nuevo < 0){ alert('Escribe un precio v\u00e1lido.'); return; }
  nuevo = Math.round(nuevo * 100) / 100;
  var costo = parseFloat(prod.costo) || 0;
  if(costo > 0 && nuevo < costo){
    if(!confirm('\u26a0\ufe0f OJO: $' + fmtNum(nuevo) + ' est\u00e1 POR DEBAJO de lo que te cuesta ($'
        + fmtNum(costo) + ').\n\nCada vez que le vendas este producto vas a PERDER $'
        + fmtNum(costo - nuevo) + '.\n\n\u00bfSeguro?')) return;
  }
  if(ya) ya.precio = nuevo;
  else clientes[i].preciosPersonalizados.push({ pid: pid, precio: nuevo });
  SS('ncl', clientes);
  try { repintarCuentaCliente(cid); } catch(e){}
  try { avisoChico('\ud83c\udff7\ufe0f ' + String(prod.nombre).slice(0, 18) + ': $' + fmtNum(nuevo)); } catch(e){}
}

function quitarPrecioEspecial(cid, pid){
  clientes = LS('ncl', []);
  var i = clientes.findIndex(function(c){ return String(c.id) === String(cid); });
  if(i < 0 || !clientes[i].preciosPersonalizados) return;
  loadProds();
  var prod = productos.find(function(p){ return String(p.id) === String(pid); });
  var normal = prod ? (parseFloat(prod.precio) || 0) : 0;
  if(!confirm('\u00bfQuitarle el precio especial?\n\n'
      + (prod ? String(prod.nombre).slice(0, 36) + '\n\n' : '')
      + 'A partir de ahora le vas a cobrar el precio normal de $' + fmtNum(normal) + '.')) return;
  clientes[i].preciosPersonalizados = clientes[i].preciosPersonalizados.filter(function(x){
    return String(x.pid) !== String(pid);
  });
  SS('ncl', clientes);
  try { repintarCuentaCliente(cid); } catch(e){}
  try { avisoChico('\ud83c\udff7\ufe0f Precio especial quitado'); } catch(e){}
}

// ── ⚙️ AJUSTES DE SU CUENTA: editar sus datos, sin servicio, borrarlo ──
function redondearPrecios(){
  if(!confirm('¿Redondear todos los precios que terminen en .99?\nEjemplo: $9.99 → $10.00, $11.99 → $12.00, $24.99 → $25.00\n\nSolo afecta precios que terminen en .99')) return;
  loadProds();
  var count = 0;
  productos.forEach(function(p){
    var str = p.precio.toFixed(2);
    if(str.endsWith('.99')){
      var nuevo = Math.ceil(p.precio);
      p.precio = nuevo;
      count++;
    }
  });
  SS('np', productos);
  alert(count + ' precio(s) redondeados correctamente.\nEjemplo: $9.99 → $10.00');
  renderCatalogo(document.getElementById('catbuscar') ? document.getElementById('catbuscar').value||'' : '');
}

// ---- Edición masiva por marca ----

function marcaDe(p){
  return p.marca ? p.marca.toUpperCase() : (p.nombre||'').trim().split(/\s+/)[0].toUpperCase();
}

function abrirEditarPorMarca(){
  loadProds();
  document.getElementById('cat-lista-wrap').style.display = 'none';
  document.getElementById('cat-marca-wrap').style.display = 'block';

  // Poblar marcas (unicas, con conteo)
  var conteo = {};
  productos.forEach(function(p){ var m = marcaDe(p); conteo[m] = (conteo[m]||0)+1; });
  var marcas = Object.keys(conteo).sort();
  // Se guardan todas para poder filtrarlas sin volver a calcularlas -27 jul-
  window._epmTodasLasMarcas = marcas.map(function(m){ return { nombre: m, cuantos: conteo[m] }; });
  var cajaB = document.getElementById('epm-buscar');
  if(cajaB) cajaB.value = '';
  var sel = document.getElementById('epm-marca');
  sel.innerHTML = marcas.map(function(m){ return '<option value="'+m+'">'+m+' ('+conteo[m]+' productos)</option>'; }).join('');

  actualizarConteoMarca();
}

// Filtra la lista de marcas mientras Sensei escribe. Guarda TODAS las marcas en
// window._epmTodasLasMarcas la primera vez, para poder volver a llenarla al borrar
// lo escrito. Usa el mismo motor de busqueda de Vender y Compras -palabras en
// cualquier orden, sin importar tildes-. -27 jul-
function filtrarMarcasEditar(){
  var caja = document.getElementById('epm-buscar');
  var sel  = document.getElementById('epm-marca');
  if(!sel || !window._epmTodasLasMarcas) return;
  var q = caja ? caja.value.trim() : '';
  var lista = window._epmTodasLasMarcas;

  if(q){
    lista = filtrarPorBusqueda(lista, q, function(m){ return m.nombre; });
  }
  if(!lista.length){
    sel.innerHTML = '<option value="">(ninguna marca con esas letras)</option>';
    var elC = document.getElementById('epm-conteo');
    if(elC) elC.textContent = 'Ninguna marca coincide';
    return;
  }
  sel.innerHTML = lista.map(function(m){
    return '<option value="' + escaparHtml(m.nombre) + '">' + escaparHtml(m.nombre) + ' (' + m.cuantos + ' productos)</option>';
  }).join('');
  actualizarConteoMarca();
}

function actualizarConteoMarca(){
  var marcaSel = document.getElementById('epm-marca').value;
  var n = productos.filter(function(p){ return marcaDe(p) === marcaSel; }).length;
  document.getElementById('epm-conteo').textContent = n + ' producto(s) con esta marca';
}

function cerrarEditarPorMarca(){
  document.getElementById('cat-marca-wrap').style.display = 'none';
  document.getElementById('cat-lista-wrap').style.display = 'block';
}

function toggleOtraMarca(i){
  var sel = document.getElementById('epml-marca-sel-'+i);
  var input = document.getElementById('epml-marca-'+i);
  if(sel.value === '__otra__'){
    input.style.display = 'block';
    input.value = '';
    input.focus();
  } else {
    input.style.display = 'none';
    input.value = sel.value;
  }
  actualizarPrefijoNombre(i);
}

function duplicarProductoDesdeMarca(i){
  var ids = window._epmlIds || [];
  var pid = ids[i];
  if(pid === undefined) return;
  loadProds();
  var p = productos.find(function(x){ return String(x.id) === String(pid); });
  if(!p) return;
  document.getElementById('cat-marca-lista-wrap').style.display = 'none';
  duplicarProducto(p);
  window._volverAMarcaTrasEditar = true; // despues de esta linea (duplicarProducto ya reseteo la bandera a false)
}

function marcarEliminarProductoMarca(i){
  window._epmlEliminar = window._epmlEliminar || {};
  var card = document.getElementById('epml-card-'+i);
  var btn = document.getElementById('epml-btn-elim-'+i);
  var marcado = !!window._epmlEliminar[i];
  if(!marcado){
    window._epmlEliminar[i] = true;
    card.style.opacity = '0.4';
    card.style.background = '#FBECEC';
    btn.innerHTML = '↩️ Deshacer';
    btn.style.background = '#F0F0F2';
    btn.style.color = 'var(--nbs-ink)';
  } else {
    delete window._epmlEliminar[i];
    card.style.opacity = '1';
    card.style.background = 'white';
    btn.innerHTML = '🗑️ Eliminar';
    btn.style.background = 'var(--nbs-red-bg)';
    btn.style.color = 'var(--nbs-red-dark)';
  }
}

// Los números de una marca: cuántos productos, cuánto hay invertido, cuánto valen a
// precio de venta y cuánta ganancia habría. SOLO LEE — no guarda ni cambia nada. -11 ago-
// Recalcula el "vale" de un producto y el resumen de arriba, mientras escribe. -11 ago-
function recalcularValeMarca(i){
  try {
    var elS = document.getElementById('epml-stock-' + i);
    var elC = document.getElementById('epml-costo-' + i);
    var elV = document.getElementById('epml-vale-' + i);
    if(!elS || !elC || !elV) return;
    var st = parseFloat(String(elS.value).replace(/[^0-9.\-]/g, '')) || 0;
    var co = parseFloat(String(elC.value).replace(/[^0-9.]/g, '')) || 0;
    elV.textContent = '$' + fmtNum(Math.max(0, st) * co);
    // Y el recuadro de arriba, con lo que hay escrito AHORA en la pantalla
    var ids = window._epmlIds || [];
    var enPantalla = [];
    loadProds();
    for(var k = 0; k < ids.length; k++){
      var orig = productos.find(function(p){ return String(p.id) === String(ids[k]); });
      if(!orig) continue;
      var s2 = document.getElementById('epml-stock-' + k);
      var c2 = document.getElementById('epml-costo-' + k);
      var p2 = document.getElementById('epml-precio-' + k);
      enPantalla.push({
        stock:  s2 ? (parseFloat(String(s2.value).replace(/[^0-9.\-]/g, '')) || 0) : (orig.stock || 0),
        costo:  c2 ? (parseFloat(String(c2.value).replace(/[^0-9.]/g, '')) || 0) : (orig.costo || 0),
        precio: p2 ? (parseFloat(String(p2.value).replace(/[^0-9.]/g, '')) || 0) : (orig.precio || 0)
      });
    }
    pintarResumenMarca(enPantalla);
  } catch(e){}
}

function resumenDeMarca(lista){
  var r = { productos: 0, conStock: 0, unidades: 0, costo: 0, venta: 0, sinCosto: 0, negativos: 0 };
  (lista || []).forEach(function(p){
    r.productos++;
    var st = parseFloat(p.stock) || 0;
    var co = parseFloat(p.costo) || 0;
    var pr = parseFloat(p.precio) || 0;
    if(!co) r.sinCosto++;
    if(st < 0) r.negativos++;
    if(st > 0){
      r.conStock++;
      r.unidades += st;
      r.costo += st * co;
      r.venta += st * pr;
    }
  });
  r.costo = Math.round(r.costo * 100) / 100;
  r.venta = Math.round(r.venta * 100) / 100;
  r.ganancia = Math.round((r.venta - r.costo) * 100) / 100;
  return r;
}

// Lo pinta arriba de la lista de la marca
function pintarResumenMarca(lista){
  var el = document.getElementById('epml-resumen');
  if(!el) return;
  var r = resumenDeMarca(lista);
  var caja = function(rot, val, col){
    return '<div style="flex:1;background:rgba(255,255,255,.14);border-radius:9px;padding:7px 4px;text-align:center;min-width:0">'
      + '<div style="font-size:8.5px;font-weight:800;color:rgba(255,255,255,.75);letter-spacing:.3px">' + rot + '</div>'
      + '<div style="font-size:13.5px;font-weight:900;margin-top:2px;color:' + (col || '#fff') + ';overflow:hidden;text-overflow:ellipsis">' + val + '</div></div>';
  };
  var h = '<div style="background:#1a237e;border-radius:12px;padding:10px;margin-bottom:10px">'
    + '<div style="display:flex;gap:6px">'
    +   caja('PRODUCTOS', String(r.productos))
    +   caja('CON EXISTENCIA', String(r.conStock))
    +   caja('UNIDADES', String(Math.round(r.unidades)))
    + '</div>'
    + '<div style="display:flex;gap:6px;margin-top:6px">'
    +   caja('INVERTIDO', '$' + fmtNum(r.costo), '#FFD54F')
    +   caja('A VENTA', '$' + fmtNum(r.venta))
    +   caja('GANANCIA', '$' + fmtNum(r.ganancia), '#A5D6A7')
    + '</div>';
  if(r.sinCosto || r.negativos){
    h += '<div style="margin-top:7px;font-size:11px;color:#FFD54F;font-weight:700;text-align:center">'
      + (r.sinCosto ? '\u26a0\ufe0f ' + r.sinCosto + ' sin costo puesto' : '')
      + (r.sinCosto && r.negativos ? '  \u00b7  ' : '')
      + (r.negativos ? '\u26a0\ufe0f ' + r.negativos + ' en negativo' : '')
      + '</div>';
  }
  h += '</div>';
  el.innerHTML = h;
}

function abrirEditarProductosDeMarca(){
  var marcaSel = document.getElementById('epm-marca').value;
  if(!marcaSel){ alert('Selecciona una marca primero.'); return; }

  window._epmlMarcaActual = marcaSel;
  loadProds();
  suplidores = LS('nsup', []);
  var afectados = productos.filter(function(p){ return marcaDe(p) === marcaSel; });
  if(!afectados.length){ alert('No hay productos con esa marca.'); return; }

  document.getElementById('cat-marca-wrap').style.display = 'none';
  document.getElementById('cat-marca-lista-wrap').style.display = 'block';
  document.getElementById('epml-titulo').textContent = marcaSel + ' — ' + afectados.length + ' producto(s)';
  // Los numeros de esta marca, arriba de la lista. SOLO LEE. -11 ago-
  try { pintarResumenMarca(afectados); } catch(eRes){}
  var cajaEpml = document.getElementById('epml-buscar');
  if(cajaEpml) cajaEpml.value = '';
  var sinResEpml = document.getElementById('epml-sinres');
  if(sinResEpml) sinResEpml.style.display = 'none';

  var opcionesProveedor = '<option value="">-- Sin proveedor --</option>' + suplidores.map(function(s){ return '<option value="'+s.nombre.replace(/"/g,"'")+'">'+escaparHtml(s.nombre)+'</option>'; }).join('');

  // Listas de marcas y categorias existentes en todo el catalogo (para los menus desplegables)
  var marcasExistentes = {};
  var categoriasExistentes = {};
  productos.forEach(function(p){
    marcasExistentes[p.marca || marcaDe(p)] = true;
    if(p.cat) categoriasExistentes[p.cat] = true;
  });
  var listaMarcas = Object.keys(marcasExistentes).sort();
  var listaCats = Object.keys(categoriasExistentes).sort();

  var el = document.getElementById('epml-lista');
  el.innerHTML = afectados.map(function(p, i){
    var marcaActual = (p.marca || marcaDe(p));
    var catActual = (p.cat || '');
    var marcaEnLista = listaMarcas.indexOf(marcaActual) > -1;
    var catEnLista = listaCats.indexOf(catActual) > -1;
    var opcionesMarca = listaMarcas.map(function(m){ return '<option value="'+m.replace(/"/g,"'")+'"'+(m===marcaActual?' selected':'')+'>'+m+'</option>'; }).join('') + '<option value="__otra__"'+(marcaEnLista?'':' selected')+'>✏️ Otra (escribir nueva)</option>';
    var opcionesCat = listaCats.map(function(c){ return '<option value="'+c.replace(/"/g,"'")+'"'+(c===catActual?' selected':'')+'>'+c+'</option>'; }).join('') + '<option value="__otra__"'+(catEnLista?'':' selected')+'>✏️ Otra (escribir nueva)</option>';

    // Calcular el "resto" del nombre sin la marca, para mostrar la marca como prefijo automatico
    var restoNombre = (p.nombre||'');
    var prefRegex = new RegExp('^\\s*'+marcaActual.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\s*','i');
    restoNombre = restoNombre.replace(prefRegex, '').trim();

    return '<div class="card" id="epml-card-'+i+'" style="border:0.5px solid var(--nbs-line);box-shadow:var(--nbs-shadow-card)" data-pid="'+p.id+'">'
      +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">'
      +'<span style="font-size:11px;color:var(--nbs-muted-2)">Producto '+(i+1)+'</span>'
      +'<div style="display:flex;gap:6px">'
      +'<button type="button" onclick="duplicarProductoDesdeMarca('+i+')" style="background:var(--nbs-gold);color:white;border:none;border-radius:8px;padding:6px 10px;font-size:11px;font-weight:700;cursor:pointer">📋 Duplicar</button>'
      +'<button type="button" onclick="marcarEliminarProductoMarca('+i+')" id="epml-btn-elim-'+i+'" style="background:var(--nbs-red-bg);color:var(--nbs-red-dark);border:none;border-radius:8px;padding:6px 10px;font-size:11px;font-weight:600;cursor:pointer">🗑️ Eliminar</button>'
      +'</div>'
      +'</div>'
      +'<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">'
      +'<div id="epml-foto-preview-'+i+'" onclick="abrirOpcionesFotoMarca('+i+')" style="width:56px;height:56px;border-radius:10px;background:'+(p.foto?'#f0f0f0':'var(--nbs-gold-bg)')+';border:'+(p.foto?'none':'2px dashed var(--nbs-gold)')+';display:flex;align-items:center;justify-content:center;font-size:26px;flex-shrink:0;overflow:hidden;cursor:pointer">'+(p.foto?'<img src="'+p.foto+'" style="width:100%;height:100%;object-fit:cover">':'📷')+'</div>'
      +'<input type="file" id="epml-foto-camara-'+i+'" accept="image/*" capture="environment" style="display:none" onchange="cargarFotoProductoMarca(this,'+i+')">'
      +'<input type="file" id="epml-foto-galeria-'+i+'" accept="image/*" style="display:none" onchange="cargarFotoProductoMarca(this,'+i+')">'
      +'<input type="hidden" id="epml-foto-data-'+i+'" value="'+(p.foto||'').replace(/"/g,"'")+'">'
      +'</div>'
      +'<label class="lbl">Nombre del producto</label>'
      +'<div style="display:flex;align-items:stretch;gap:6px;margin-bottom:10px">'
      +'<div id="epml-nombre-prefijo-'+i+'" style="background:var(--nbs-gold-bg);color:var(--nbs-gold-dark);border-radius:8px;padding:0 12px;display:flex;align-items:center;font-size:14px;font-weight:700;white-space:nowrap">'+marcaActual+'</div>'
      +'<input class="inp" id="epml-nombre-'+i+'" type="text" value="'+restoNombre.replace(/"/g,"'")+'" placeholder="resto del nombre..." style="margin-bottom:0;flex:1">'
      +'</div>'
      +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:6px">'
      +'<div><label class="lbl">Marca</label><select class="inp" id="epml-marca-sel-'+i+'" onchange="toggleOtraMarca('+i+')">'+opcionesMarca+'</select></div>'
      +'<div><label class="lbl">Categoría</label><select class="inp" id="epml-cat-sel-'+i+'" onchange="toggleOtraCat('+i+')">'+opcionesCat+'</select></div>'
      +'</div>'
      +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">'
      +'<input class="inp" id="epml-marca-'+i+'" type="text" placeholder="Escribe la marca nueva" value="'+(marcaEnLista?'':marcaActual.replace(/"/g,"'"))+'" style="display:'+(marcaEnLista?'none':'block')+'" oninput="actualizarPrefijoNombre('+i+')">'
      +'<input class="inp" id="epml-cat-'+i+'" type="text" placeholder="Escribe la categoría nueva" value="'+(catEnLista?'':catActual.replace(/"/g,"'"))+'" style="display:'+(catEnLista?'none':'block')+'">'
      +'</div>'
      +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">'
      +'<div><label class="lbl">Costo ($)</label><input class="inp" id="epml-costo-'+i+'" type="text" inputmode="decimal" value="'+(p.costo||0).toFixed(2)+'" onfocus="this.select()" oninput="formatoMoneda(this);recalcularValeMarca('+i+')"></div>'
      +'<div><label class="lbl">Precio ($)</label><input class="inp" id="epml-precio-'+i+'" type="text" inputmode="decimal" value="'+(p.precio||0).toFixed(2)+'" onfocus="this.select()" oninput="formatoMoneda(this)"></div>'
      +'</div>'
      +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">'
      +'<div><label class="lbl">Existencia</label><input class="inp" id="epml-stock-'+i+'" type="text" inputmode="decimal" value="'+(parseFloat(p.stock)||0)+'" onfocus="this.select()" oninput="recalcularValeMarca('+i+')"></div>'
      +'<div><label class="lbl">Vale (cantidad \u00d7 costo)</label><div id="epml-vale-'+i+'" style="padding:11px 12px;background:#FFF6DF;border:1px solid #E8D9A8;border-radius:9px;font-size:14px;font-weight:900;color:#6B520C">$'+fmtNum(Math.max(0,(parseFloat(p.stock)||0))*(parseFloat(p.costo)||0))+'</div></div>'
      +'</div>'
      +'<label class="lbl">Proveedor</label>'
      +'<select class="inp" id="epml-suplidor-'+i+'">'+opcionesProveedor+'</select>'
      +'<button type="button" onclick="guardarProductoIndividualDeMarca('+i+')" style="width:100%;padding:11px;background:var(--nbs-green-bg);color:var(--nbs-green-text);border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;margin-top:10px">💾 Guardar solo este producto</button>'
      +'<div class="snk" id="epml-mk-'+i+'" style="margin-top:8px">Guardado</div>'
      +'</div>';
  }).join('');

  window._epmlEliminar = {};

  // Marcar el proveedor actual seleccionado en cada select
  afectados.forEach(function(p, i){
    if(p.proveedorPref) document.getElementById('epml-suplidor-'+i).value = p.proveedorPref;
  });

  // Guardar referencia de los ids afectados para el guardado
  window._epmlIds = afectados.map(function(p){ return p.id; });
}

// Esconde o enseña cada renglon segun lo que escriba. NO vuelve a dibujar la lista:
// solo tapa lo que no coincide, para que NO SE PIERDA nada de lo que Sensei ya haya
// escrito en los campos de los otros productos. -27 jul-
//
// OJO — POR QUE NO SE FILTRA POR EL TEXTO DEL RENGLON: el textContent de cada renglon
// mide 1.000 caracteres porque incluye TODAS las opciones de sus listas desplegables
// (las 90 marcas y todas las categorias), y ademas NO incluye el nombre del producto,
// que vive dentro de un <input value="...">. Filtrar por ahi no podia funcionar.
// Se filtra por los CAMPOS de verdad: nombre, marca y categoria de ese renglon.
function filtrarProductosDeMarca(){
  var caja = document.getElementById('epml-buscar');
  var cont = document.getElementById('epml-lista');
  var sinRes = document.getElementById('epml-sinres');
  if(!cont) return;
  var q = caja ? caja.value.trim() : '';
  var filas = cont.children;
  var visibles = 0;

  if(!q){
    for(var i = 0; i < filas.length; i++) filas[i].style.display = '';
    if(sinRes) sinRes.style.display = 'none';
    return;
  }

  for(var j = 0; j < filas.length; j++){
    var nom = document.getElementById('epml-nombre-' + j);
    var mar = document.getElementById('epml-marca-' + j);
    var cat = document.getElementById('epml-cat-' + j);
    var texto = ((nom && nom.value) || '') + ' '
              + ((mar && mar.value) || '') + ' '
              + ((cat && cat.value) || '');
    var calza = filtrarPorBusqueda([{ t: texto }], q, function(x){ return x.t; }).length > 0;
    filas[j].style.display = calza ? '' : 'none';
    if(calza) visibles++;
  }
  if(sinRes) sinRes.style.display = visibles ? 'none' : 'block';
}

function cerrarEditarProductosDeMarca(){
  document.getElementById('cat-marca-lista-wrap').style.display = 'none';
  document.getElementById('cat-lista-wrap').style.display = 'block';
}

function guardarProductoIndividualDeMarca(i){
  var ids = window._epmlIds || [];
  var pid = ids[i];
  if(!pid){ alert('No se encontró este producto.'); return; }
  if(window._epmlEliminar && window._epmlEliminar[i]){ alert('Este producto está marcado para eliminar. Toca "🗑️ Eliminar" de nuevo para desmarcarlo si quieres guardarlo.'); return; }

  loadProds();
  var p = productos.find(function(x){ return String(x.id) === String(pid); });
  if(!p){ alert('No se encontró este producto en el catálogo.'); return; }

  var nombreInput = document.getElementById('epml-nombre-'+i);
  var marcaSelInput = document.getElementById('epml-marca-sel-'+i);
  var catSelInput = document.getElementById('epml-cat-sel-'+i);
  var marcaInput = document.getElementById('epml-marca-'+i);
  var catInput = document.getElementById('epml-cat-'+i);
  var costoInput = document.getElementById('epml-costo-'+i);
  var precioInput = document.getElementById('epml-precio-'+i);
  var supInput = document.getElementById('epml-suplidor-'+i);
  var fotoInput = document.getElementById('epml-foto-data-'+i);
  if(!nombreInput) return;

  var marcaFinal = (marcaSelInput.value === '__otra__' ? marcaInput.value.trim() : marcaSelInput.value);
  var restoFinal = nombreInput.value.trim();
  var _nomAntes = p.nombre;
  p.nombre = (marcaFinal ? marcaFinal + ' ' : '') + restoFinal;
  // 🔄 Si el nombre cambió, se apunta para actualizar lo pendiente. -15 ago-
  if(_nomAntes !== p.nombre){
    try { window._nombresCambiados = window._nombresCambiados || [];
          window._nombresCambiados.push({ pid: p.id, nombre: p.nombre }); } catch(e){}
  }
  p.nombreCorto = restoFinal;
  p.marca = marcaFinal;
  p.foto = fotoInput ? fotoInput.value : (p.foto || '');
  p.cat = (catSelInput.value === '__otra__' ? catInput.value.trim() : catSelInput.value);
  p.costo = dinero(costoInput.value) || 0;
  // ⚠️ LA EXISTENCIA. Sensei la necesita aqui para hacer el inventario por marca sin
  // entrar producto por producto. Solo se toca si el campo EXISTE y trae un numero:
  // si no, se deja la de antes — nunca se pone en cero por error. -11 ago-
  var stockInputA = document.getElementById('epml-stock-' + i);
  if(stockInputA){
    var txtStA = String(stockInputA.value).trim();
    if(txtStA !== ''){
      var stNuevoA = parseFloat(txtStA.replace(/[^0-9.\-]/g, ''));
      if(!isNaN(stNuevoA)) p.stock = stNuevoA;
    }
  }
  // Igual que arriba: apuntar el precio de ANTES para poder compararlo -27 jul-
  var precioAntesI = (typeof p.precio === 'number') ? p.precio : parseFloat(p.precio) || 0;
  p.precio = dinero(precioInput.value) || 0;
  if(precioAntesI !== p.precio) registrarCambioPrecio(p.nombre, precioAntesI, p.precio);
  p.proveedorPref = supInput.value;

  SS('np', productos);
  flash('epml-mk-'+i);
  // 🔄 Aplicar los nombres corregidos a TODO lo pendiente. -15 ago-
  try {
    var _cambios = window._nombresCambiados || [];
    if(_cambios.length){
      var _tot = { pedidos: 0, carrito: 0, aMedias: 0, relleno: 0 };
      _cambios.forEach(function(c){
        var r = actualizarNombreEnPendientes(c.pid, c.nombre);
        _tot.pedidos += r.pedidos; _tot.carrito += r.carrito;
        _tot.aMedias += r.aMedias; _tot.relleno += r.relleno;
      });
      window._nombresCambiados = [];
      avisarNombreActualizado(_tot);
    }
  } catch(eNom){}
}

function guardarTodosLosProductosDeMarca(){
  var ids = window._epmlIds || [];
  if(!ids.length) return;
  var aEliminar = window._epmlEliminar || {};
  var cantEliminar = Object.keys(aEliminar).length;
  var cantEditar = ids.length - cantEliminar;

  var msg = '';
  if(cantEditar > 0) msg += 'Guardar cambios de ' + cantEditar + ' producto(s). ';
  if(cantEliminar > 0) msg += 'Eliminar ' + cantEliminar + ' producto(s). ';
  msg += '¿Continuar?';
  if(!confirm(msg)) return;

  loadProds();
  var eliminados = LS('np_eliminados', []);

  ids.forEach(function(pid, i){
    if(aEliminar[i]){
      // Eliminar este producto
      if(eliminados.indexOf(String(pid)) === -1) eliminados.push(String(pid));
      productos = productos.filter(function(x){ return String(x.id) !== String(pid); });
      return;
    }
    var p = productos.find(function(x){ return String(x.id) === String(pid); });
    if(!p) return;
    var nombreInput = document.getElementById('epml-nombre-'+i);
    var marcaSelInput = document.getElementById('epml-marca-sel-'+i);
    var catSelInput = document.getElementById('epml-cat-sel-'+i);
    var marcaInput = document.getElementById('epml-marca-'+i);
    var catInput = document.getElementById('epml-cat-'+i);
    var costoInput = document.getElementById('epml-costo-'+i);
    var precioInput = document.getElementById('epml-precio-'+i);
    var supInput = document.getElementById('epml-suplidor-'+i);
    var fotoInput = document.getElementById('epml-foto-data-'+i);
    if(!nombreInput) return;
    var marcaFinal = (marcaSelInput.value === '__otra__' ? marcaInput.value.trim() : marcaSelInput.value);
    var restoFinal = nombreInput.value.trim();
    var _nomAntes = p.nombre;
    p.nombre = (marcaFinal ? marcaFinal + ' ' : '') + restoFinal;
    // 🔄 Si el nombre cambió, se apunta para actualizar lo pendiente. -15 ago-
    if(_nomAntes !== p.nombre){
      try { window._nombresCambiados = window._nombresCambiados || [];
            window._nombresCambiados.push({ pid: p.id, nombre: p.nombre }); } catch(e){}
    }
    p.nombreCorto = restoFinal;
    p.marca = marcaFinal;
    p.foto = fotoInput ? fotoInput.value : (p.foto || '');
    p.cat = (catSelInput.value === '__otra__' ? catInput.value.trim() : catSelInput.value);
    p.costo = dinero(costoInput.value) || 0;
  // ⚠️ LA EXISTENCIA. Sensei la necesita aqui para hacer el inventario por marca sin
  // entrar producto por producto. Solo se toca si el campo EXISTE y trae un numero:
  // si no, se deja la de antes — nunca se pone en cero por error. -11 ago-
  var stockInputB = document.getElementById('epml-stock-' + i);
  if(stockInputB){
    var txtStB = String(stockInputB.value).trim();
    if(txtStB !== ''){
      var stNuevoB = parseFloat(txtStB.replace(/[^0-9.\-]/g, ''));
      if(!isNaN(stNuevoB)) p.stock = stNuevoB;
    }
  }
    // El precio de ANTES se apunta primero, para poder compararlo. Si se lee despues de
    // asignarlo se lee el nuevo y nunca se registra nada -mismo error que tenia el editor
    // de un producto suelto, encontrado el 27 jul-.
    var precioAntesM = (typeof p.precio === 'number') ? p.precio : parseFloat(p.precio) || 0;
    p.precio = dinero(precioInput.value) || 0;
    if(precioAntesM !== p.precio) registrarCambioPrecio(p.nombre, precioAntesM, p.precio);
    p.proveedorPref = supInput.value;
  });

  SS('np_eliminados', eliminados);
  SS('np', productos);
  // 🔄 Aplicar los nombres corregidos a TODO lo pendiente. -15 ago-
  try {
    var _cambios = window._nombresCambiados || [];
    if(_cambios.length){
      var _tot = { pedidos: 0, carrito: 0, aMedias: 0, relleno: 0 };
      _cambios.forEach(function(c){
        var r = actualizarNombreEnPendientes(c.pid, c.nombre);
        _tot.pedidos += r.pedidos; _tot.carrito += r.carrito;
        _tot.aMedias += r.aMedias; _tot.relleno += r.relleno;
      });
      window._nombresCambiados = [];
      avisarNombreActualizado(_tot);
    }
  } catch(eNom){}
  // Antes se quedaba DENTRO de la misma marca, a proposito, "para poder seguir haciendo
  // cambios ahi". Sensei pidio el 27 jul que lo llevara de vuelta al listado de todos los
  // productos, que es lo que espera al terminar de guardar.
  cerrarEditarProductosDeMarca();
  cerrarEditarPorMarca();
  renderCatalogo(document.getElementById('catbuscar') ? (document.getElementById('catbuscar').value || '') : '');
  window.scrollTo(0, 0);
  avisoGrande('✓ Listo.\n\n'
    + (cantEditar > 0 ? cantEditar + ' producto(s) actualizado(s).\n' : '')
    + (cantEliminar > 0 ? cantEliminar + ' producto(s) eliminado(s).\n' : '')
    + '\nVolviste al catálogo.');
}

function agruparMarcasParecidas(){
  loadProds();
  var grupos = {};
  productos.forEach(function(p){
    var m = String(p.marca || '').trim();
    if(!m) return;
    var clave = m.toLowerCase().replace(/[^a-z0-9]/g, '');
    if(!clave) return;
    if(!grupos[clave]) grupos[clave] = { formas: {}, total: 0 };
    grupos[clave].formas[m] = (grupos[clave].formas[m] || 0) + 1;
    grupos[clave].total++;
  });
  // Solo los que están partidos
  var partidos = [];
  Object.keys(grupos).forEach(function(k){
    var formas = Object.keys(grupos[k].formas);
    if(formas.length < 2) return;
    partidos.push({
      clave: k,
      formas: formas.map(function(f){ return { texto: f, cuantos: grupos[k].formas[f] }; })
                    .sort(function(a, b){ return b.cuantos - a.cuantos; }),
      total: grupos[k].total,
      // 🔑 Cómo va a quedar: primera letra en mayúscula
      quedaComo: marcaBonita(formas.sort(function(a, b){
        return grupos[k].formas[b] - grupos[k].formas[a];
      })[0])
    });
  });
  return partidos.sort(function(a, b){ return b.total - a.total; });
}

// LA PANTALLA — le enseña qué va a pasar ANTES de tocar nada
function abrirUnificarMarcas(){
  var partidos = agruparMarcasParecidas();
  var ov = document.getElementById('unif-marcas-ov');
  if(!ov){
    ov = document.createElement('div');
    ov.id = 'unif-marcas-ov';
    document.body.appendChild(ov);
  }
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:99997;'
    + 'overflow-y:auto;padding:18px 14px';

  var h = '<div style="max-width:460px;margin:0 auto;background:#fff;border-radius:14px;'
    + 'padding:18px">';
  h += '<div style="font-size:18px;font-weight:900;color:var(--nbs-ink);margin-bottom:4px">'
    + '\u{1F524} Unificar marcas</div>';

  if(!partidos.length){
    h += '<div style="font-size:13px;color:var(--nbs-muted);line-height:1.6;margin:14px 0">'
      + '\u2705 <b>Todas tus marcas est\u00e1n bien.</b><br><br>'
      + 'No hay ninguna partida en dos por c\u00f3mo est\u00e1 escrita.</div>';
    h += '<button onclick="cerrarUnificarMarcas()" class="btn" style="width:100%;margin:0;'
      + 'background:#F0F0F5;color:#333">Cerrar</button></div>';
    ov.innerHTML = h;
    return;
  }

  var totalProd = partidos.reduce(function(a, x){ return a + x.total; }, 0);
  h += '<div style="font-size:12.5px;color:var(--nbs-muted);line-height:1.55;margin-bottom:14px">'
    + 'Encontr\u00e9 <b>' + partidos.length + ' marca(s)</b> que est\u00e1n partidas en dos porque '
    + 'se escribieron distinto. Eso hace que sus productos salgan en grupos separados.<br><br>'
    + '\u{1F512} <b>No se toca ning\u00fan precio ni ninguna factura</b> \u2014 solo se corrige c\u00f3mo '
    + 'est\u00e1 escrita la marca.</div>';

  partidos.forEach(function(g){
    h += '<div style="background:var(--nbs-gold-bg);border-radius:10px;padding:12px;'
      + 'margin-bottom:9px">';
    h += '<div style="font-size:12px;color:var(--nbs-muted);margin-bottom:5px">'
      + g.formas.map(function(f){
          return '<b>' + escaparHtml(f.texto) + '</b> (' + f.cuantos + ')';
        }).join('  +  ') + '</div>';
    h += '<div style="font-size:15px;font-weight:900;color:var(--nbs-green-text)">'
      + '\u2192 ' + escaparHtml(g.quedaComo)
      + '  <span style="font-size:12px;color:var(--nbs-muted);font-weight:600">('
      + g.total + ' productos juntos)</span></div>';
    h += '</div>';
  });

  h += '<div style="font-size:12px;color:var(--nbs-muted);margin:13px 0 10px;text-align:center">'
    + 'Se van a corregir <b>' + totalProd + ' productos</b>.</div>';
  h += '<button onclick="aplicarUnificarMarcas()" class="btn" style="width:100%;margin:0 0 8px;'
    + 'background:var(--nbs-green-text);color:#fff;font-weight:900;font-size:15px;padding:14px">'
    + '\u2705 S\u00ed, unificarlas</button>';
  h += '<button onclick="cerrarUnificarMarcas()" class="btn" style="width:100%;margin:0;'
    + 'background:#F0F0F5;color:#333">Ahora no</button>';
  h += '</div>';
  ov.innerHTML = h;
}

function cerrarUnificarMarcas(){
  var ov = document.getElementById('unif-marcas-ov');
  if(ov) ov.remove();
}

// 🔒 APLICARLO. Protegido con huella, porque toca los datos.
function aplicarUnificarMarcas(){
  var partidos = agruparMarcasParecidas();
  if(!partidos.length){ cerrarUnificarMarcas(); return; }

  protegerConHuella(function(){
    loadProds();
    var P = LS('np', []);
    var cambiados = 0;
    var mapa = {};
    partidos.forEach(function(g){ mapa[g.clave] = g.quedaComo; });

    P.forEach(function(p){
      var m = String(p.marca || '').trim();
      if(!m) return;
      var clave = m.toLowerCase().replace(/[^a-z0-9]/g, '');
      if(!mapa[clave]) return;
      if(p.marca !== mapa[clave]){ p.marca = mapa[clave]; cambiados++; }
    });

    SS('np', P);
    PRODS = []; loadProds();
    try { marcarPendienteDeSubir('np'); } catch(e){}
    cerrarUnificarMarcas();
    avisoGrande('\u2705 Listo. Se unificaron ' + partidos.length + ' marca(s) en '
      + cambiados + ' producto(s).\n\nNing\u00fan precio ni ninguna factura se toc\u00f3.');
    try { if(typeof renderCatalogo === 'function') renderCatalogo(); } catch(e){}
  });
}

// 🔤 Y PONER **TODAS** LAS MARCAS CON LA PRIMERA LETRA EN MAYÚSCULA.
// Sensei: "no entiendo por qué salen en letras mayúsculas todas".
function quitarProductoDeFactura(i){
  if(!window._facturaEditItems) return;
  if(window._facturaEditItems.length <= 1){ alert('Una factura debe tener al menos un producto. Si quieres eliminar toda la factura, usa la opción de cancelar factura.'); return; }
  window._facturaEditItems.splice(i, 1);
  renderItemsFacturaEdit();
}

function buscarProductoParaFactura(q){
  var el = document.getElementById('fact-edit-resultados');
  loadProds();
  if(!q || !q.trim()){ el.style.display = 'none'; el.innerHTML=''; return; }
  // Usa el MISMO motor de busqueda de Vender y Compras -filtrarPorBusqueda-, que
  // encuentra las palabras en cualquier orden y aguanta errores de tecleo. Antes
  // aqui se buscaba el texto PEGADO, asi que "olive 5" no encontraba
  // "ECO OLIVE OIL 5 LBS". -27 jul-
  var lista = filtrarPorBusqueda(productos, q, function(p){
    return (p.nombre || '') + ' ' + (p.marca || '') + ' ' + (p.sku || '');
  }).slice(0, 15);
  if(!lista.length){
    el.style.display = 'block';
    el.innerHTML = '<div style="padding:10px;font-size:12px;color:var(--nbs-muted);text-align:center">Sin resultados — puedes escribir el nombre manualmente y agregarlo abajo</div>';
    return;
  }
  el.style.display = 'block';
  el.innerHTML = lista.map(function(p, idx){
    return '<div onclick="agregarProductoAFactura('+idx+')" style="padding:10px;border-bottom:0.5px solid #f0f0f0;cursor:pointer;font-size:13px" data-idx="'+idx+'">'
      +'<div style="font-weight:600">'+escaparHtml(p.nombre)+'</div>'
      +'<div style="color:var(--nbs-muted);font-size:11px">$'+fmtNum(p.precio)+' · Stock: '+p.stock+'</div>'
      +'</div>';
  }).join('');
  window._facturaEditResultados = lista;
}

function agregarProductoAFactura(idx){
  var p = window._facturaEditResultados[idx];
  if(!p) return;
  window._facturaEditItems.push({ nombre: p.nombre, cant: 1, precio: p.precio, pid: p.id, costo: p.costo||0 });
  document.getElementById('fact-edit-buscar-prod').value = '';
  document.getElementById('fact-edit-resultados').style.display = 'none';
  document.getElementById('fact-edit-resultados').innerHTML = '';
  renderItemsFacturaEdit();
}

function marcarRango(cual){
  Array.prototype.forEach.call(document.querySelectorAll('.rng-btn'), function(b){
    if(cual && b.getAttribute('data-r') === cual) b.classList.add('rng-on');
    else b.classList.remove('rng-on');
  });
}

function renderTopProductos(ventasMes){
  var conteo = {};
  ventasMes.forEach(function(v){
    (v.items||[]).forEach(function(it){
      if(!conteo[it.nombre]) conteo[it.nombre] = {nombre:it.nombre, unidades:0, monto:0};
      conteo[it.nombre].unidades += it.cant;
      conteo[it.nombre].monto += it.cant * it.precio;
    });
  });
  var top = Object.values(conteo).sort(function(a,b){ return b.unidades-a.unidades; }).slice(0,5);
  if(!top.length) return '<div style="color:#aaa;font-size:13px;text-align:center;padding:12px">Sin ventas este mes</div>';
  var maxU = top[0].unidades;
  return '<div style="background:white;border-radius:12px;padding:12px;border:0.5px solid #e5e7eb">'
    +top.map(function(p,i){
      var pct = maxU>0?Math.round((p.unidades/maxU)*100):0;
      var colores = ['#6D4C41','#795548','#8D6E63','#A1887F','#BCAAA4'];
      return '<div style="margin-bottom:10px">'
        +'<div style="display:flex;justify-content:space-between;margin-bottom:4px">'
        +'<span style="font-size:12px;font-weight:600;color:#1a237e">'+(i+1)+'. '+escaparHtml(p.nombre)+'</span>'
        +'<span style="font-size:11px;color:#aaa">'+p.unidades+' uds · $'+fmtNum(p.monto)+'</span>'
        +'</div>'
        +'<div style="background:#f0f0f0;border-radius:20px;height:6px">'
        +'<div style="background:'+colores[i]+';height:100%;width:'+pct+'%;border-radius:20px"></div>'
        +'</div></div>';
    }).join('')+'</div>';
}

function renderHistorialPrecios(){
  loadProds();
  var historial = LS('historial_precios',[]);
  if(!historial.length){
    return '<div style="color:#aaa;font-size:12px;text-align:center;padding:8px">Los cambios de precio se registrarán automáticamente aquí</div>';
  }
  return historial.slice(-10).reverse().map(function(h){
    return '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:0.5px solid #f0f0f0;font-size:12px">'
      +'<span style="color:#333">'+h.nombre+'</span>'
      +'<span style="color:#aaa">'+h.fecha+'</span>'
      +'<span style="color:#C62828">$'+fmtNum(h.antes)+'</span>'
      +'<span style="color:#aaa">→</span>'
      +'<span style="color:#2E7D32">$'+fmtNum(h.despues)+'</span>'
      +'</div>';
  }).join('');
}

function abrirBuscadorProducto(i){
  _buscadorLinea = i;
  var ov = document.getElementById('buscar-prod-ov');
  if(!ov){
    ov = document.createElement('div');
    ov.id = 'buscar-prod-ov';
    ov.style.cssText = 'position:fixed;inset:0;background:#fff;z-index:99996;display:flex;flex-direction:column';
    document.body.appendChild(ov);
  }
  var it = (window._facturaItems || [])[i] || { descripcion: '' };
  ov.innerHTML =
      '<div style="flex-shrink:0;padding:12px;border-bottom:2px solid #eee">'
    +   '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">'
    +     '<div style="flex:1;font-size:16px;font-weight:900;color:#1a237e">Buscar producto</div>'
    +     '<button onclick="cerrarBuscadorProducto()" style="flex-shrink:0;width:34px;height:34px;border:none;border-radius:9px;background:#f0f0f0;color:#666;font-size:20px;font-weight:800;cursor:pointer">✕</button>'
    +   '</div>'
    +   '<div style="background:#FFF8E1;border:1px solid #FFE082;border-radius:8px;padding:8px;margin-bottom:8px">'
    +     '<div style="font-size:10px;color:#8D6E63;font-weight:800;margin-bottom:2px">DICE LA FACTURA</div>'
    +     '<div style="font-size:12.5px;color:#5D4037;font-weight:700;line-height:1.3">' + escaparHtml(it.descripcion) + '</div>'
    +   '</div>'
    +   '<input id="buscar-prod-txt" type="search" inputmode="search" autocomplete="off" placeholder="🔍 Escribe parte del nombre..." '
    +     'oninput="pintarResultadosBuscador()" style="width:100%;padding:12px;border:2px solid #1565C0;border-radius:10px;font-size:15px;font-weight:600">'
    + '</div>'
    + '<div id="buscar-prod-lista" style="flex:1;overflow-y:auto;padding:8px 12px"></div>'
    + '<div style="flex-shrink:0;padding:10px 12px;border-top:2px solid #eee">'
    +   '<button onclick="escogerProductoBuscador(\'NUEVO\')" style="width:100%;padding:13px;border:2px solid #2E7D32;border-radius:10px;background:#E8F5E9;color:#2E7D32;font-weight:800;font-size:13.5px;cursor:pointer">➕ Es un producto nuevo</button>'
    + '</div>';
  ov.style.display = 'flex';
  pintarResultadosBuscador();
  var caja = document.getElementById('buscar-prod-txt');
  if(caja) setTimeout(function(){ try { caja.focus(); } catch(e){} }, 60);
}

function cerrarBuscadorProducto(){
  var ov = document.getElementById('buscar-prod-ov');
  if(ov) ov.remove();
  _buscadorLinea = null;
}

function escogerProductoBuscador(pid){
  var i = _buscadorLinea;
  cerrarBuscadorProducto();
  if(i === null || i === undefined) return;
  if(String(pid) === 'NUEVO'){ abrirFormProductoNuevo(i); return; }
  cambiarProductoFactura(i, String(pid));
}

// ── CREAR UN PRODUCTO SIN SALIR DE LA FACTURA (28 jul) ──
// Sensei: "no hay forma de que yo pueda salir de esa parte sin que se me cierre e ir al
// catalogo... si salgo se pierde el progreso de la factura". ANTES, marcar "producto
// nuevo" solo lo apuntaba, y al guardar la compra se creaba SIN marca, SIN categoria y
// con precio de venta en CERO — o sea que despues habia que ir a arreglarlo igual.
// Ahora se le piden esos tres datos aqui mismo, con el nombre y el costo ya puestos
// desde la factura.
function abrirFormProductoNuevo(i){
  loadProds();
  var it = (window._facturaItems || [])[i];
  if(!it) return;

  // Marcas y categorias que ya usa, para no escribirlas a mano
  // Se usa marcaDe(p), la MISMA que usa "editar toda una marca": muchos productos de
  // Sensei no tienen el campo marca lleno, la marca va dentro del nombre. Con p.marca
  // solo salian 2 marcas; con marcaDe salen las 90 de verdad. -28 jul-
  var marcas = {}, cats = {};
  productos.forEach(function(p){
    var m = String(marcaDe(p) || '').trim(); if(m) marcas[m] = true;
    var c = (p.cat || '').trim();            if(c) cats[c] = true;
  });
  var listaM = Object.keys(marcas).sort();
  var listaC = Object.keys(cats).sort();

  var ov = document.getElementById('prod-nuevo-ov');
  if(!ov){
    ov = document.createElement('div');
    ov.id = 'prod-nuevo-ov';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:99997;display:flex;align-items:center;justify-content:center;padding:14px';
    document.body.appendChild(ov);
  }
  ov.innerHTML = '<div style="background:#fff;border-radius:16px;padding:16px;max-width:440px;width:100%;max-height:88vh;overflow-y:auto">'
    + '<div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:10px">'
    +   '<div style="flex:1;font-size:17px;font-weight:900;color:#2E7D32">\u2795 Producto nuevo</div>'
    +   '<button onclick="cerrarFormProductoNuevo()" style="flex-shrink:0;width:34px;height:34px;border:none;border-radius:9px;background:#f0f0f0;color:#666;font-size:20px;font-weight:800;cursor:pointer">\u2715</button>'
    + '</div>'
    + '<div style="background:#FFF8E1;border:1px solid #FFE082;border-radius:8px;padding:8px;margin-bottom:12px">'
    +   '<div style="font-size:10px;color:#8D6E63;font-weight:800;margin-bottom:2px">DICE LA FACTURA</div>'
    +   '<div style="font-size:12.5px;color:#5D4037;font-weight:700;line-height:1.3">' + escaparHtml(it.descripcion) + '</div>'
    + '</div>'

    + '<label class="lbl">Nombre del producto *</label>'
    + '<input class="inp" id="pn-nombre" type="text" autocomplete="off" value="' + escaparHtml(it.descripcion) + '">'

    + '<label class="lbl">Marca</label>'
    + '<select class="inp" id="pn-marca-sel" onchange="pnCambioMarca()">'
    +   '<option value="">(sin marca)</option>'
    +   listaM.map(function(m){ return '<option value="' + escaparHtml(m) + '">' + escaparHtml(m) + '</option>'; }).join('')
    +   '<option value="__otra__">\u2795 Otra marca (escribir)</option>'
    + '</select>'
    + '<input class="inp" id="pn-marca-otra" type="text" placeholder="Escribe la marca" autocomplete="off" style="display:none">'

    + '<label class="lbl">Categor\u00eda</label>'
    + '<select class="inp" id="pn-cat-sel" onchange="pnCambioCat()">'
    +   '<option value="">(sin categor\u00eda)</option>'
    +   listaC.map(function(c){ return '<option value="' + escaparHtml(c) + '">' + escaparHtml(c) + '</option>'; }).join('')
    +   '<option value="__otra__">\u2795 Otra categor\u00eda (escribir)</option>'
    + '</select>'
    + '<input class="inp" id="pn-cat-otra" type="text" placeholder="Escribe la categor\u00eda" autocomplete="off" style="display:none">'

    + '<div style="display:flex;gap:8px;margin-top:8px">'
    +   '<div style="flex:1"><label class="lbl">Costo (de la factura)</label>'
    +     '<div style="padding:11px;background:#f5f5f5;border-radius:8px;font-size:15px;font-weight:800;color:#666">$' + fmtNum(it.costo) + '</div></div>'
    +   '<div style="flex:1"><label class="lbl">Precio de venta *</label>'
    +     '<input class="inp" id="pn-precio" type="text" inputmode="decimal" placeholder="$0.00" oninput="formatoMoneda(this)"></div>'
    + '</div>'
    + '<div style="font-size:11.5px;color:#888;margin-top:4px">Si lo dejas vac\u00edo, el producto queda con precio $0.00 y te va a salir en la Revisi\u00f3n de integridad.</div>'

    + '<div style="display:flex;gap:8px;margin-top:14px">'
    +   '<button onclick="guardarProductoNuevoFactura(' + i + ')" style="flex:2;padding:13px;border:none;border-radius:10px;background:#2E7D32;color:#fff;font-weight:800;font-size:13.5px;cursor:pointer">\u2713 Crear y usarlo</button>'
    +   '<button onclick="cerrarFormProductoNuevo()" style="flex:1;padding:13px;border:2px solid #999;border-radius:10px;background:#fff;color:#666;font-weight:700;cursor:pointer">Cancelar</button>'
    + '</div>'
    + '</div>';
  ov.style.display = 'flex';
  setTimeout(function(){ var c = document.getElementById('pn-nombre'); if(c){ try{ c.focus(); c.select(); }catch(e){} } }, 60);
}

function pnCambioMarca(){
  var sel = document.getElementById('pn-marca-sel');
  var otra = document.getElementById('pn-marca-otra');
  if(sel && otra) otra.style.display = (sel.value === '__otra__') ? 'block' : 'none';
}
function cerrarFormProductoNuevo(){
  var ov = document.getElementById('prod-nuevo-ov');
  if(ov) ov.remove();
}

function guardarProductoNuevoFactura(i){
  var it = (window._facturaItems || [])[i];
  if(!it) return;
  var nombre = (document.getElementById('pn-nombre').value || '').trim();
  if(!nombre){ avisoGrande('Ponle un nombre al producto.'); return; }

  var mSel = document.getElementById('pn-marca-sel').value;
  var marca = (mSel === '__otra__') ? (document.getElementById('pn-marca-otra').value || '').trim() : mSel;
  var cSel = document.getElementById('pn-cat-sel').value;
  var cat = (cSel === '__otra__') ? (document.getElementById('pn-cat-otra').value || '').trim() : cSel;
  var precio = dinero(document.getElementById('pn-precio').value) || 0;

  // Se guarda en el renglon. El producto se crea de verdad al GUARDAR LA COMPRA -asi si
  // Sensei cancela la compra, no le queda un producto suelto en el catalogo-.
  it.pid = null;
  it.esNuevo = true;
  it.nombreNuevo = nombre;
  it.marcaNueva = marca;
  it.catNueva = cat;
  it.precioVentaNuevo = precio;
  it.comoLoSupo = null;

  cerrarFormProductoNuevo();
  pintarRevisionFactura();
}

function marcarLineaFactura(i, val){
  if(window._facturaItems && window._facturaItems[i]){ window._facturaItems[i].marcado = !!val; pintarRevisionFactura(); }
}
function cambiarProductoFactura(i, val){
  var it = window._facturaItems && window._facturaItems[i];
  if(!it) return;
  if(val === 'NUEVO'){ it.pid = null; it.esNuevo = true; }
  else if(val){
    it.pid = val; it.esNuevo = false;
    // APRENDE: la proxima factura de este suplidor ya sale emparejada sola
    recordarEmparejado(window._facturaSup.id, it.descripcion, val);
    it.comoLoSupo = 'aprendido';
  } else { it.pid = null; it.esNuevo = false; }
  pintarRevisionFactura();
}
function revisarBarberiaSinMarcar(){
  try {
    var lleg = LS(CLAVE_LLEGADAS, {});
    var hoyKey = getDiaHoy();
    var key = 'visitas_' + hoyKey + '_' + fechaMasRecienteParaDia(hoyKey);
    var visitas = LS(key, []);
    var avisados = LS('nbs_avisado_sin_marcar', {});
    var hoyTxt = fechaHoy();

    Object.keys(lleg).forEach(function(neg){
      if(posVisita(visitas, neg) >= 0) return;             // ya está marcada
      if(avisados[neg] === hoyTxt) return;                 // ya se lo dije hoy
      var minutos = (Date.now() - (lleg[neg] || 0)) / 60000;
      if(minutos < MINUTOS_SIN_MARCAR) return;
      avisados[neg] = hoyTxt;
      SS('nbs_avisado_sin_marcar', avisados);
      avisoGrande('\ud83d\udccd ' + neg + '\n\nLlegaste hace ' + Math.round(minutos)
        + ' minutos y no marcaste la visita.\n\n\u00bfLe vendiste algo? Si no, m\u00e1rcala '
        + 'igual en la Ruta para que quede tu r\u00e9cord.');
    });
  } catch(e){}
}

// ── 7️⃣ LLENAR LA LISTA DE RELLENO SOLA, UNA VEZ POR SEMANA ──
function marcarLlegadaBarberia(negocio){
  if(!negocio) return;
  try{
    var hoyKey = getDiaHoy();
    var rutas  = LS('rutas_por_dia', {});
    var rutaHoy = rutas[hoyKey] || [];
    if(rutaHoy.indexOf(negocio) < 0) return;         // no esta en la ruta de hoy

    var key = 'visitas_'+hoyKey+'_'+fechaMasRecienteParaDia(hoyKey);
    var visitas = LS(key, []);
    if(posVisita(visitas, negocio) >= 0) return;     // ya la marcaste, no molestar

    var lleg = LS(CLAVE_LLEGADAS, {});
    if(lleg[negocio]) return;                        // ya se habia registrado la llegada
    lleg[negocio] = Date.now();
    SS(CLAVE_LLEGADAS, lleg);
  }catch(e){}
}

// Cuando marca la barberia, se borra su reloj
function recvisMarcar(){
  var caja = document.getElementById('recvis-caja');
  var neg = caja ? caja.getAttribute('data-neg') : '';
  cerrarRecordatorioVisita();
  if(!neg) return;
  var hoyKey = getDiaHoy();
  toggleVisita(hoyKey, neg);     // esto ya guarda la hora y cancela el reloj
}

// "Todavia no, recuerdame en 10 minutos"
function registrarCambioPrecio(nombre, precioAntes, precioDespues){
  if(precioAntes === precioDespues) return;
  var historial = LS('historial_precios',[]);
  historial.push({nombre:nombre, antes:precioAntes, despues:precioDespues, fecha:fechaHoy()});
  if(historial.length > 100) historial = historial.slice(-100);
  SS('historial_precios', historial);
}

// ===== HISTORIAL DE COMPRAS POR CLIENTE =====
function toggleCambioProducto(vid){
  var checked = document.getElementById('dev-es-cambio').checked;
  document.getElementById('dev-cambio-wrap').style.display = checked ? 'block' : 'none';
  document.getElementById('dev-diferencia-card').style.display = checked ? 'block' : 'none';
  document.getElementById('dev-aviso-tipo').style.display = checked ? 'none' : 'block';
  if(!checked){
    window._cambioItems = [];
    document.getElementById('dev-cambio-items').innerHTML = '';
  }
  var totalDev = parseFloat((document.getElementById('dev-total-monto').textContent||'$0').replace('$','').replace(',','')) || 0;
  actualizarDiferenciaCambio(vid, totalDev);
}

function buscarProductoParaCambio(vid){
  loadProds();
  var q = document.getElementById('dev-cambio-buscar').value.trim().toLowerCase();
  var elRes = document.getElementById('dev-cambio-resultados');
  if(!q){ elRes.style.display = 'none'; elRes.innerHTML = ''; return; }
  // Usa el MISMO motor de busqueda de Vender y Compras -filtrarPorBusqueda-, que
  // encuentra las palabras en cualquier orden y aguanta errores de tecleo. Antes
  // aqui se buscaba el texto PEGADO, asi que "olive 5" no encontraba
  // "ECO OLIVE OIL 5 LBS". -27 jul-
  var encontrados = filtrarPorBusqueda(productos, q, function(p){
    return (p.nombre || '') + ' ' + (p.marca || '') + ' ' + (p.sku || '');
  }).slice(0, 8);
  if(!encontrados.length){ elRes.innerHTML = '<div style="padding:10px;font-size:12px;color:#aaa">Sin resultados</div>'; elRes.style.display='block'; return; }
  elRes.innerHTML = encontrados.map(function(p){
    return '<div onclick="agregarProductoCambio(\''+vid+'\',\''+p.id+'\')" style="padding:10px;border-bottom:1px solid #f0f0f0;cursor:pointer;font-size:13px">'
      +'<div style="font-weight:600">'+escaparHtml(p.nombre)+'</div>'
      +'<div style="font-size:11px;color:#aaa">$'+fmtNum(p.precio)+' · Stock: '+(p.stock||0)+'</div></div>';
  }).join('');
  elRes.style.display = 'block';
}

function agregarProductoCambio(vid, pid){
  loadProds();
  var p = productos.find(function(x){ return String(x.id)===String(pid); });
  if(!p) return;
  if(!window._cambioItems) window._cambioItems = [];
  window._cambioItems.push({ nombre: p.nombre, cant: 1, precio: p.precio, costo: p.costo||0, pid: p.id });
  document.getElementById('dev-cambio-buscar').value = '';
  document.getElementById('dev-cambio-resultados').style.display = 'none';
  renderItemsCambio(vid);
}

function cambiarPrecioCambioItem(i, val, vid){
  var n = dinero(val);
  if(isNaN(n) || n<0) n=0;
  window._cambioItems[i].precio = n;
  renderItemsCambio(vid);
}

function abrirPreciosPersonalizados(cid){
  clientes = LS('ncl', []);
  var cl = clientes.find(function(c){ return String(c.id)===String(cid); });
  if(!cl) return;

  var overlay = document.getElementById('precios-esp-overlay');
  if(!overlay){
    overlay = document.createElement('div');
    overlay.id = 'precios-esp-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:white;z-index:99998;overflow-y:auto;padding:16px';
    document.body.appendChild(overlay);
  }

  var wrap = document.createElement('div');
  wrap.style.cssText = 'max-width:480px;margin:0 auto';

  var header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;gap:10px;margin-bottom:16px';
  var btnBack = document.createElement('button');
  btnBack.textContent = '← Volver';
  btnBack.style.cssText = 'background:#E8EAF6;border:none;border-radius:8px;padding:10px 16px;cursor:pointer;font-size:14px;font-weight:600;color:#1a237e';
  btnBack.onclick = function(){ overlay.style.display='none'; };
  var iconoNBS = document.createElement('img');
  iconoNBS.src = 'icon-512.png'; iconoNBS.alt = 'NBS';
  iconoNBS.style.cssText = 'width:32px;height:32px;margin-left:auto;border-radius:8px;cursor:pointer';
  iconoNBS.onclick = function(){ overlay.style.display='none'; ir('p-inicio'); };
  header.appendChild(btnBack); header.appendChild(iconoNBS);
  wrap.appendChild(header);

  var titulo = document.createElement('div');
  titulo.innerHTML = '<div style="font-size:18px;font-weight:800;color:#00695C">💲 Precios Especiales</div>'
    +'<div style="font-size:13px;color:#aaa;margin-top:2px">'+escaparHtml(nombreCl(cl))+'</div>';
  wrap.appendChild(titulo);

  var aviso = document.createElement('div');
  aviso.style.cssText = 'background:#E0F2F1;border-radius:10px;padding:10px;margin:12px 0;font-size:12px;color:#00695C;line-height:1.5';
  aviso.textContent = 'Los precios que guardes aquí se llenan solos cada vez que le vendas ese producto a este cliente -en Vender o en Pedidos Rápidos-. Puedes seguir ajustándolos a mano en cada venta si hace falta.';
  wrap.appendChild(aviso);

  var listaTitulo = document.createElement('div');
  listaTitulo.style.cssText = 'font-size:11px;color:#aaa;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin:12px 0 8px';
  listaTitulo.textContent = 'Precios guardados';
  wrap.appendChild(listaTitulo);

  var listaWrap = document.createElement('div');
  listaWrap.id = 'precios-esp-lista';
  wrap.appendChild(listaWrap);

  function renderListaPrecios(){
    clientes = LS('ncl', []);
    var clFresco = clientes.find(function(c){ return String(c.id)===String(cid); });
    var precios = (clFresco && clFresco.preciosPersonalizados) ? clFresco.preciosPersonalizados : [];
    if(!precios.length){
      listaWrap.innerHTML = '<div style="text-align:center;color:#ccc;padding:20px;font-size:13px">Todavía no hay precios especiales guardados</div>';
      return;
    }
    loadProds();
    listaWrap.innerHTML = '';
    precios.forEach(function(pp, i){
      var prod = productos.find(function(x){ return String(x.id)===String(pp.pid); });
      var precioNormal = prod ? prod.precio : null;
      var card = document.createElement('div');
      card.style.cssText = 'background:#FAFAFA;border-radius:10px;padding:12px;margin-bottom:8px;border:0.5px solid #eee;display:flex;justify-content:space-between;align-items:center;gap:10px';
      card.innerHTML = '<div style="flex:1">'
        +'<div style="font-size:13px;font-weight:700">'+(prod?prod.nombre:pp.nombreProducto||'Producto')+'</div>'
        +(precioNormal!==null ? '<div style="font-size:11px;color:#aaa">Precio normal: $'+fmtNum(precioNormal)+'</div>' : '')
        +'<div style="font-size:15px;font-weight:800;color:#00695C;margin-top:2px">$'+fmtNum(pp.precio)+' <span style="font-size:11px;font-weight:400;color:#00695C">precio especial</span></div>'
        +'</div>'
        +'<button style="background:var(--nbs-red-bg);color:var(--nbs-red-dark);border:none;border-radius:8px;width:36px;height:36px;cursor:pointer;font-size:15px;flex-shrink:0">✕</button>';
      card.querySelector('button').onclick = function(){
        if(!confirm('¿Quitar el precio especial de "'+(prod?prod.nombre:pp.nombreProducto)+'" para este cliente?')) return;
        clientes = LS('ncl', []);
        var c2 = clientes.find(function(x){ return String(x.id)===String(cid); });
        c2.preciosPersonalizados.splice(i, 1);
        SS('ncl', clientes);
        renderListaPrecios();
      };
      listaWrap.appendChild(card);
    });
  }
  renderListaPrecios();

  var agregarTitulo = document.createElement('div');
  agregarTitulo.style.cssText = 'font-size:11px;color:#aaa;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin:20px 0 8px';
  agregarTitulo.textContent = 'Agregar un precio especial nuevo';
  wrap.appendChild(agregarTitulo);

  var buscarProd = document.createElement('input');
  buscarProd.className = 'inp';
  buscarProd.type = 'text';
  buscarProd.placeholder = 'Buscar producto por nombre...';
  buscarProd.autocomplete = 'off';
  wrap.appendChild(buscarProd);

  var resultadosBusqueda = document.createElement('div');
  resultadosBusqueda.style.cssText = 'display:none;max-height:200px;overflow-y:auto;background:white;border:1px solid #ddd;border-radius:8px;margin-top:4px';
  wrap.appendChild(resultadosBusqueda);

  var formNuevoPrecio = document.createElement('div');
  formNuevoPrecio.style.display = 'none';
  formNuevoPrecio.style.marginTop = '10px';
  wrap.appendChild(formNuevoPrecio);

  var productoSeleccionado = null;

  buscarProd.oninput = function(){
    loadProds();
    var q = buscarProd.value.trim().toLowerCase();
    if(!q){ resultadosBusqueda.style.display='none'; return; }
    // Mismo motor de busqueda que Vender y Compras -27 jul-
    var encontrados = filtrarPorBusqueda(productos, q, function(p){
      return (p.nombre || '') + ' ' + (p.marca || '') + ' ' + (p.sku || '');
    }).slice(0, 8);
    if(!encontrados.length){ resultadosBusqueda.innerHTML = '<div style="padding:10px;font-size:12px;color:#aaa">Sin resultados</div>'; resultadosBusqueda.style.display='block'; return; }
    resultadosBusqueda.innerHTML = encontrados.map(function(p){
      return '<div data-pid="'+p.id+'" style="padding:10px;border-bottom:1px solid #f0f0f0;cursor:pointer;font-size:13px">'
        +'<div style="font-weight:600">'+escaparHtml(p.nombre)+'</div><div style="font-size:11px;color:#aaa">Precio normal: $'+fmtNum(p.precio)+'</div></div>';
    }).join('');
    resultadosBusqueda.style.display = 'block';
    Array.from(resultadosBusqueda.children).forEach(function(el){
      el.onclick = function(){
        var pid = el.getAttribute('data-pid');
        productoSeleccionado = productos.find(function(x){ return String(x.id)===String(pid); });
        resultadosBusqueda.style.display = 'none';
        buscarProd.value = productoSeleccionado.nombre;
        formNuevoPrecio.style.display = 'block';
        formNuevoPrecio.innerHTML = '<label class="lbl">Precio especial para '+productoSeleccionado.nombre+' -precio normal $'+fmtNum(productoSeleccionado.precio)+'-</label>'
          +'<input class="inp" id="precio-esp-nuevo" type="text" inputmode="numeric" value="'+productoSeleccionado.precio.toFixed(2)+'" onfocus="this.select()" oninput="formatoMoneda(this)">'
          +'<button style="width:100%;padding:12px;background:#00695C;color:white;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;margin-top:8px">✓ Guardar precio especial</button>';
        formNuevoPrecio.querySelector('button').onclick = function(){
          var nuevoPrecio = dinero(document.getElementById('precio-esp-nuevo').value) || 0;
          clientes = LS('ncl', []);
          var c2 = clientes.find(function(x){ return String(x.id)===String(cid); });
          if(!c2.preciosPersonalizados) c2.preciosPersonalizados = [];
          var idxExistente = c2.preciosPersonalizados.findIndex(function(pp){ return String(pp.pid)===String(productoSeleccionado.id); });
          var entrada = { pid: productoSeleccionado.id, nombreProducto: productoSeleccionado.nombre, precio: nuevoPrecio };
          if(idxExistente >= 0) c2.preciosPersonalizados[idxExistente] = entrada;
          else c2.preciosPersonalizados.push(entrada);
          SS('ncl', clientes);
          buscarProd.value = '';
          formNuevoPrecio.style.display = 'none';
          productoSeleccionado = null;
          renderListaPrecios();
        };
      };
    });
  };

  overlay.innerHTML = '';
  overlay.appendChild(wrap);
  overlay.style.display = 'block'; overlay.scrollTop = 0;
}
