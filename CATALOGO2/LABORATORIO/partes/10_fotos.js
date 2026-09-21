
function conFirmaLista(v, cb){
  window._firmaImgFactura = null;
  if(!v || !v.firma){ cb(); return; }
  var img = new Image();
  var hecho = false;
  function terminar(){ if(!hecho){ hecho = true; window._firmaImgFactura = img; cb(); } }
  img.onload = terminar;
  img.onerror = function(){ if(!hecho){ hecho = true; window._firmaImgFactura = null; cb(); } };
  img.src = v.firma;
  // Por si la imagen ya estaba en cache y no dispara onload
  if(img.complete && img.naturalWidth){ terminar(); }
  // Seguridad: no esperar más de 2 segundos
  setTimeout(function(){ if(!hecho){ hecho = true; window._firmaImgFactura = (img.complete && img.naturalWidth) ? img : null; cb(); } }, 2000);
}

function abrirAlmacenImagenes(){
  return new Promise(function(listo){
    if(_almacenImgs) return listo(_almacenImgs);
    if(typeof indexedDB === 'undefined'){ return listo(null); }
    try {
      var req = indexedDB.open('nbs2_imagenes', 1);
      req.onupgradeneeded = function(e){
        var db = e.target.result;
        if(!db.objectStoreNames.contains('imgs')) db.createObjectStore('imgs');
      };
      req.onsuccess = function(e){ _almacenImgs = e.target.result; listo(_almacenImgs); };
      req.onerror = function(){ console.error('No se pudo abrir el almacen de imagenes'); listo(null); };
      req.onblocked = function(){ listo(null); };
    } catch(e){ console.error('IndexedDB no disponible:', e); listo(null); }
  });
}

// ── Guardar una imagen en el almacén grande ──
function guardarImagenGrande(clv, dato){
  return abrirAlmacenImagenes().then(function(db){
    if(!db) return false;
    return new Promise(function(listo){
      try {
        var tx = db.transaction('imgs', 'readwrite');
        tx.objectStore('imgs').put(dato, clv);
        tx.oncomplete = function(){ _IMGS_OK[clv] = true; listo(true); };
        tx.onerror = function(){ listo(false); };
        tx.onabort = function(){ listo(false); };
      } catch(e){ listo(false); }
    });
  }).catch(function(){ return false; });
}

// ── Borrar una imagen que ya no hace falta ──
function borrarImagenGrande(clv){
  return abrirAlmacenImagenes().then(function(db){
    if(!db) return;
    try {
      var tx = db.transaction('imgs', 'readwrite');
      tx.objectStore('imgs').delete(clv);
    } catch(e){}
  }).catch(function(){});
}

// ── Traer TODAS las imágenes a memoria, al arrancar ──
function cargarImagenesGrandes(){
  return abrirAlmacenImagenes().then(function(db){
    if(!db){ _IMGS_LISTO = true; return 0; }
    return new Promise(function(listo){
      try {
        var tx = db.transaction('imgs', 'readonly');
        var st = tx.objectStore('imgs');
        var pedir = st.openCursor();
        var n = 0;
        pedir.onsuccess = function(e){
          var cur = e.target.result;
          if(cur){
            _IMGS[cur.key] = cur.value;
            _IMGS_OK[cur.key] = true;
            n++;
            cur.continue();
          } else {
            _IMGS_LISTO = true;
            listo(n);
          }
        };
        pedir.onerror = function(){ _IMGS_LISTO = true; listo(0); };
      } catch(e){ _IMGS_LISTO = true; listo(0); }
    });
  }).catch(function(){ _IMGS_LISTO = true; return 0; });
}

// ── AL GUARDAR: sacar la imagen del dato ──
// Devuelve una COPIA sin la imagen. Nunca toca el objeto original, porque
// esos mismos objetos viven en las variables de la app -ventas, gastos- y
// si se les quitara la imagen, dejarían de verse en pantalla.
function sacarImagenes(clave, lista){
  var campo = CLAVES_CON_IMAGEN[clave];
  if(!campo || !Array.isArray(lista)) return lista;

  var salida = [];
  for(var i = 0; i < lista.length; i++){
    var r = lista[i];
    if(!r || typeof r !== 'object'){ salida.push(r); continue; }

    // 🔴 SI LE QUITARON LA IMAGEN, HAY QUE BORRARLA DEL ALMACEN GRANDE TAMBIEN.
    // Al quitarle la foto a un producto la app guarda foto:'' — si el almacen se
    // quedara con la vieja, `ponerImagenes` la volveria a pegar y la foto borrada
    // RESUCITARIA. Solo se borra cuando el almacen ya termino de cargar, para no
    // confundir "todavia no cargo" con "me la quitaron". -4 ago-
    if(r[campo] === undefined || r[campo] === null || r[campo] === ''){
      var clvV = _clvImg(clave, r.id);
      if(_IMGS_LISTO && (campo in r) && _IMGS[clvV]){
        delete _IMGS[clvV];
        delete _IMGS_OK[clvV];
        borrarImagenGrande(clvV);
      }
      salida.push(r);
      continue;
    }
    var clv = _clvImg(clave, r.id);
    var img = r[campo];

    // guardarla en memoria y en el almacén grande
    if(_IMGS[clv] !== img){
      _IMGS[clv] = img;
      _IMGS_OK[clv] = false;
      guardarImagenGrande(clv, img);
    }

    // 🔑 SOLO se le quita al dato si YA está confirmada en el almacén grande.
    // Si no, se deja donde estaba: mejor ocupar espacio que perder una imagen.
    if(_IMGS_OK[clv]){
      var copia = {};
      for(var k in r){ if(k !== campo) copia[k] = r[k]; }
      salida.push(copia);
    } else {
      salida.push(r);
    }
  }
  return salida;
}

// ── AL LEER: volver a pegar la imagen ──
function ponerImagenes(clave, lista){
  var campo = CLAVES_CON_IMAGEN[clave];
  if(!campo || !Array.isArray(lista)) return lista;

  for(var i = 0; i < lista.length; i++){
    var r = lista[i];
    if(!r || typeof r !== 'object') continue;
    var clv = _clvImg(clave, r.id);

    if(r[campo]){
      // Todavía viene dentro del dato -es de antes de la mudanza-.
      // Se aprovecha para llevarla al almacén grande.
      if(_IMGS[clv] !== r[campo]){
        _IMGS[clv] = r[campo];
        _IMGS_OK[clv] = false;
        guardarImagenGrande(clv, r[campo]);
      }
    } else if(_IMGS[clv]){
      r[campo] = _IMGS[clv];
    }
  }
  return lista;
}

// ── El texto CON las imágenes, para la nube y los respaldos ──
// La nube y el backup tienen que seguir llevándose las imágenes, igual que
// hoy. Solo el casillero chico del teléfono se queda sin ellas.
function textoConImagenes(clave){
  if(!CLAVES_CON_IMAGEN[clave]) return localStorage.getItem(clave);
  try { return JSON.stringify(LS(clave, [])); }
  catch(e){ return localStorage.getItem(clave); }
}

// ── Cuánto espacio se liberó ──
function cuantoLiberaronLasImagenes(){
  var n = 0;
  for(var k in _IMGS){ n += (_IMGS[k] || '').length * 2; }
  return Math.round(n / 1024);
}



// ═══════════════════════════════════════════════════════════════════
//  RED DE SEGURIDAD DE LOS PEDIDOS PENDIENTES  (8 ago 2026)
//
//  EL CASO: Sensei tenia 4 pedidos a medias de una barberia. Volvio a esa
//  barberia, le hizo el pedido a un barbero que habia cambiado de opinion,
//  y al regresar a la lista los 4 anteriores NO estaban — solo el ultimo.
//  Trabajaba en UN solo aparato, asi que no fue la sincronizacion.
//
//  Se revisaron savePedido, guardarTodosLosPedidosMultiples, saveV y la
//  lista, y se reprodujo la secuencia dos veces: los pedidos NO se
//  perdieron. La causa sigue sin encontrarse.
//
//  Por eso esto no es un arreglo — es una RED:
//     1. Se apunta cada cambio de la lista, con QUE funcion lo hizo.
//     2. Si desaparecen dos o mas de golpe, se guarda una copia ANTES y se
//        le avisa, con un boton para devolverlos.
// ═══════════════════════════════════════════════════════════════════
var CLAVE_BITACORA_PEDIDOS = 'nbs_bitacora_pedidos';
var CLAVE_RESCATE_PEDIDOS  = 'nbs_rescate_pedidos';

function arrancarAlmacenImagenes(){
  try {
    cargarImagenesGrandes().then(function(n){
      if(n > 0) console.log('Almacen de imagenes: ' + n + ' imagen(es) listas.');
      // Repintar lo que este abierto, por si ya se dibujo sin imagenes
      try { if(typeof renderGastos === 'function' && document.getElementById('p-gastos')
              && getComputedStyle(document.getElementById('p-gastos')).display !== 'none') renderGastos(''); } catch(e){}
      // Y el catalogo, que es el que mas se usa: recargar los productos con sus fotos
      // ya pegadas y volver a dibujarlo si esta a la vista. -4 ago-
      try {
        if(typeof loadProds === 'function') loadProds();
        var pc = document.getElementById('p-cat');
        if(pc && getComputedStyle(pc).display !== 'none' && typeof renderCatalogo === 'function'){
          var cb = document.getElementById('cat-buscar');
          renderCatalogo(cb ? cb.value : '');
        }
      } catch(e){}
    });
  } catch(e){ console.error('No se pudo arrancar el almacen de imagenes:', e); }
}

function leerIndiceFotos(){
  try{ return JSON.parse(localStorage.getItem(CLAVE_INDICE_FOTOS) || '{}'); }catch(e){ return {}; }
}
function guardarIndiceFotos(i){
  try{ localStorage.setItem(CLAVE_INDICE_FOTOS, JSON.stringify(i)); }catch(e){}
}
// Una "huella" corta de la foto, para saber si cambio sin tener que comparar 30 KB de texto
function huellaFoto(foto){
  var f = String(foto || '');
  return f.length + '_' + f.substring(f.length - 24);
}

// Devuelve una copia de los productos SIN las fotos -para mandar a la nube-
// ═══════════════════════════════════════════════════════════════════
//  ✍️ LAS FIRMAS VIAJAN POR SU PROPIO CAMINO  (28 ago 2026)
//
//  🔴 EL PROBLEMA QUE ESTO CURA. Las ventas de Sensei pesaban 1.473 KB y la nube
//  no acepta más de 1.024 KB. La app las comprimía, pero solo bajaban a 1.063 KB
//  — un 28%, cuando un archivo de ventas normal baja un 90%.
//
//  LA RAZÓN: dentro de cada venta iba la FIRMA del cliente, que es una imagen en
//  texto. Una imagen YA viene comprimida, así que comprimirla otra vez no sirve
//  de nada. Cada firma pesa unos 23 KB y no hay forma de encogerla.
//
//  LA CURA: exactamente la que ya tenían los PRODUCTOS desde hace tiempo. Sus
//  fotos no viajan dentro de `np`: van por su propia colección `nbs_fotos`. A las
//  ventas nunca se les hizo lo mismo. Ahora las firmas van por `nbs_firmas`, y a
//  la nube sube solo el texto de las ventas — que sí se comprime de verdad.
//
//  🔒 EN EL TELÉFONO NO CAMBIA NADA: las firmas se siguen guardando dentro de la
//  venta, como siempre. Esto es solo para el viaje a la nube.
// ═══════════════════════════════════════════════════════════════════

var CLAVE_INDICE_FIRMAS = 'nbs_firmas_subidas';

function leerIndiceFirmas(){
  try { return JSON.parse(localStorage.getItem(CLAVE_INDICE_FIRMAS) || '{}'); }
  catch(e){ return {}; }
}
function guardarIndiceFirmas(i){
  try { localStorage.setItem(CLAVE_INDICE_FIRMAS, JSON.stringify(i)); } catch(e){}
}

// Las ventas SIN la firma. Es lo que sube a la nube.
function descargarFirmasQueFaltan(listaVids){
  if(typeof fbAuth === 'undefined' || !fbAuth || !fbAuth.currentUser) return;
  if(!navigator.onLine || !listaVids || !listaVids.length) return;
  var tengo = {};
  try{
    LS('nv', []).forEach(function(v){ if(v.firma) tengo[String(v.id)] = 1; });
  }catch(e){}
  var faltan = listaVids.filter(function(vid){ return !tengo[vid]; });
  if(!faltan.length) return;
  console.log('Bajando ' + Math.min(faltan.length, 20) + ' firma(s) de la nube...');
  var promesas = faltan.slice(0, 20).map(function(vid){
    return fbDb.collection('nbs_firmas').doc(vid).get().then(function(d){
      if(d.exists && d.data() && d.data().firma) return { vid: vid, firma: d.data().firma };
      return null;
    }).catch(function(){ return null; });
  });
  Promise.all(promesas).then(function(res){
    var buenas = res.filter(function(x){ return x; });
    if(!buenas.length) return;
    try{
      var vs = LS('nv', []);
      var mapa = {};
      buenas.forEach(function(x){ mapa[x.vid] = x.firma; });
      var cambio = false;
      vs.forEach(function(v){
        if(!v.firma && mapa[String(v.id)]){ v.firma = mapa[String(v.id)]; cambio = true; }
      });
      if(cambio){
        if(!SS('nv', vs)){
          console.error('No cupo al guardar las firmas bajadas: el telefono esta lleno.');
          return;
        }
        ventas = LS('nv', []);
        console.log('Se bajaron ' + buenas.length + ' firma(s).');
      }
    }catch(e){ console.error('No se pudieron guardar las firmas bajadas:', e); }
  });
}

function quitarFotos(prods){
  return (prods || []).map(function(p){
    if(!p.foto) return p;
    var copia = {};
    for(var k in p){ if(k !== 'foto') copia[k] = p[k]; }
    return copia;
  });
}

function pidsConFoto(prods){
  return (prods || []).filter(function(p){ return p.foto; }).map(function(p){ return String(p.id); });
}

// Sube a la nube SOLO las fotos nuevas o que hayan cambiado -no las 30 cada vez-
// ═══════════════════════════════════════════════════════════════════════════
//  FOTOS DE CLIENTES  (18 jul 2026, pedido por Sensei)
//  Igual que las fotos de productos: cada foto va en su PROPIO documento aparte
//  (colección nbs_fotos_clientes), NUNCA dentro del cliente. Así nunca chocamos
//  con el límite de 1 MB por documento de Firestore. Las fotos van pequeñas y
//  livianas (comprimidas), y caben de sobra en el 1 GiB gratis.
// ═══════════════════════════════════════════════════════════════════════════

var CLAVE_INDICE_FOTOS_CL = 'nbs_fotos_cl_subidas';

function leerIndiceFotosCl(){
  try { return JSON.parse(localStorage.getItem(CLAVE_INDICE_FOTOS_CL) || '{}'); } catch(e){ return {}; }
}
function guardarIndiceFotosCl(i){
  try { localStorage.setItem(CLAVE_INDICE_FOTOS_CL, JSON.stringify(i)); } catch(e){}
}

// Sube a la nube las fotos de clientes que hayan cambiado (cada una en su documento aparte)
function bajarFotosQueFaltan(){
  mostrarCargandoRuta('📷 Revisando las fotos de la nube...');
  revisarFotosDeLaNube(function(r){
    cerrarCargandoRuta();
    if(r.error === 'SIN_SESION'){ avisoGrande('📷 Primero entra con tu correo y clave.'); return; }
    if(r.error === 'SIN_SENAL'){ avisoGrande('📷 No hay señal. Conéctate a internet e inténtalo de nuevo.'); return; }
    if(r.error){ avisoGrande('📷 No se pudo revisar las fotos.\n\nInténtalo de nuevo en un momento.'); return; }

    if(r.sinEspacio){
      avisoGrande('⚠️ Se bajaron ' + r.bajadas + ' foto(s), pero el teléfono se quedó sin espacio.\n\nToca "🧹 Liberar espacio en el teléfono" y vuelve a intentarlo.');
      return;
    }
    if(!r.faltaban){ avisoGrande('✓ Ya tienes todas las fotos.'); return; }

    if(r.bajadas > 0){
      avisoGrande('✓ Se bajaron ' + r.bajadas + ' foto(s).\n\n'
        + (r.incompleto ? 'Todavía faltan productos por revisar — toca el botón otra vez.' : 'Ya revisé los ' + r.revisados + ' productos que no tenían foto.'),
        function(){
          try { PRODS = []; loadProds(); if(typeof renderCatalogo === 'function') renderCatalogo(''); } catch(e){}
        });
      return;
    }

    if(r.fallos > 0){
      avisoGrande('📷 No se pudo preguntar por ' + r.fallos + ' foto(s).\n\nPuede ser la señal. Inténtalo otra vez — lo que ya bajó no se pierde.');
      return;
    }
    if(r.incompleto){
      avisoGrande('📷 Revisé ' + r.revisados + ' de ' + r.faltaban + ' producto(s) y ninguno tenía foto en la nube.\n\nToca el botón otra vez para seguir revisando los que faltan.');
      return;
    }
    avisoGrande('✓ Revisé los ' + r.revisados + ' producto(s) que no tenían foto, y ninguno tiene foto guardada en la nube.\n\nEsos son los que todavía no les has puesto foto. No se perdió nada.');
  }, function(hechos, total, bajadas){
    mostrarCargandoRuta('📷 Revisando ' + hechos + ' de ' + total + '...'
      + (bajadas ? '\n' + bajadas + ' foto(s) bajadas' : ''));
  });
}

function descargarFotosClientesQueFaltan(){
  if(typeof fbAuth === 'undefined' || !fbAuth || !fbAuth.currentUser) return;
  if(!navigator.onLine) return;
  var cls = [];
  try { cls = JSON.parse(localStorage.getItem('ncl') || '[]'); } catch(e){ return; }
  var faltan = cls.filter(function(c){ return !c.foto; });
  if(!faltan.length) return;
  faltan.forEach(function(c){
    fbDb.collection('nbs_fotos_clientes').doc(String(c.id)).get().then(function(d){
      if(d.exists && d.data().foto){
        var todos = JSON.parse(localStorage.getItem('ncl') || '[]');
        var idx = todos.findIndex(function(x){ return String(x.id) === String(c.id); });
        if(idx > -1){ todos[idx].foto = d.data().foto; localStorage.setItem('ncl', JSON.stringify(todos)); clientes = todos; }
      }
    }).catch(function(){});
  });
}

// Borra la foto de un cliente de la nube (cuando se quita)
function quitarFotosClientes(cls){
  return (cls || []).map(function(c){
    if(!c.foto) return c;
    var copia = {}; for(var k in c){ if(k !== 'foto') copia[k] = c[k]; }
    return copia;
  });
}

function pegarFotosQueYaTengo(prodsDeLaNube){
  var fotos = {};
  try{
    var local = LS('np', []);
    local.forEach(function(p){ if(p.foto) fotos[String(p.id)] = p.foto; });
  }catch(e){}
  (prodsDeLaNube || []).forEach(function(p){
    if(!p.foto && fotos[String(p.id)]) p.foto = fotos[String(p.id)];
  });
  return prodsDeLaNube;
}

// Baja de la nube las fotos que este telefono no tenga -por ejemplo, si entras desde otro
// telefono por primera vez-. Se hace en segundo plano, sin estorbar.
function descargarFotosQueFaltan(listaPids){
  if(typeof fbAuth === 'undefined' || !fbAuth || !fbAuth.currentUser) return;
  if(!navigator.onLine || !listaPids || !listaPids.length) return;
  var tengo = {};
  try{
    LS('np', []).forEach(function(p){ if(p.foto) tengo[String(p.id)] = 1; });
  }catch(e){}
  var faltan = listaPids.filter(function(pid){ return !tengo[pid]; });
  if(!faltan.length) return;
  console.log('Bajando '+faltan.length+' foto(s) de la nube...');
  // De a 40. Con 150 eran ~4,5 MB de golpe y el telefono se ahogaba con señal normal.
  var fallos = 0;
  var promesas = faltan.slice(0, 40).map(function(pid){
    return fbDb.collection('nbs_fotos').doc(pid).get().then(function(d){
      if(d.exists && d.data() && d.data().foto) return { pid: pid, foto: d.data().foto };
      return null;                       // el producto simplemente no tiene foto
    }).catch(function(){ fallos++; return null; });   // esto SI es un fallo de verdad
  });
  Promise.all(promesas).then(function(res){
    var buenas = res.filter(function(x){ return x; });
    // Se apunta cuantas de las que se pidieron EXISTIAN de verdad en la nube. Sin esto,
    // pedir 40 fotos que simplemente no existen se veia igual que un fallo de conexion.
    window._ultimoIntentoFotos = { pedidas: Math.min(faltan.length, 40), existian: buenas.length, fallos: fallos };
    if(!buenas.length) return;
    try{
      var prods = LS('np', []);
      var mapa = {};
      buenas.forEach(function(x){ mapa[x.pid] = x.foto; });
      var cambio = false;
      prods.forEach(function(p){
        if(!p.foto && mapa[String(p.id)]){ p.foto = mapa[String(p.id)]; cambio = true; }
      });
      if(cambio){
        // SS y no localStorage, por lo mismo. Esta funcion no devuelve nada, asi que
        // si no cupo solo se deja constancia — SS ya le enseño su aviso a Sensei.
        if(!SS('np', prods)){
          console.error('No cupo al guardar las fotos bajadas: el telefono esta lleno.');
          return;
        }
        var i = leerIndiceFotos();
        buenas.forEach(function(x){ i[x.pid] = huellaFoto(x.foto); });
        guardarIndiceFotos(i);
        console.log('Se bajaron '+buenas.length+' foto(s).');
        if(typeof productos !== 'undefined') productos = prods;
      }
    }catch(e){ console.error('No se pudieron guardar las fotos bajadas:', e); }
  });
}

function verSinConfirmarPremios(){
  var lista = premiosListos();
  if(!lista.length){ avisoGrande('Ahora mismo nadie tiene premio pendiente.'); return; }
  var t = lista.map(function(x){
    return '\u2022 ' + x.cliente + (x.negocio ? ' (' + x.negocio + ')' : '')
         + '\n   ' + x.grupo + ' \u00b7 ' + x.puntos + ' puntos';
  }).join('\n');
  avisoGrande('\ud83c\udf81 PREMIOS PENDIENTES DE ENTREGAR\n\n' + t
    + '\n\nEntra a su ficha y dale el regalo con el bot\u00f3n \ud83c\udf81.');
}

function cargarFotoGasto(input, prefijo){
  prefijo = prefijo || 'gasto';
  var file = input.files[0];
  if(!file) return;
  if(!esFotoValida(file)){ input.value = ''; return; }
  var reader = new FileReader();
  reader.onload = function(e){
    // Fotos de facturas y recibos -gasto, compra- necesitan mucha mas resolucion que una foto
    // de producto normal, para poder leer los numeros chiquitos despues.
    var resolucionAlta = (prefijo === 'gasto' || prefijo === 'cc') ? 1800 : undefined;
    abrirRecortarFoto(e.target.result, function(dataFinal){
      document.getElementById(prefijo+'-foto-data').value = dataFinal;
      var prev = document.getElementById(prefijo+'-foto-preview');
      prev.innerHTML = '<img src="'+dataFinal+'" style="width:100%;height:100%;object-fit:cover">';
      prev.style.background = '#f0f0f0';
      prev.style.border = 'none';
      if(prefijo === 'cc'){
        var btnOcr = document.getElementById('cc-btn-ocr');
        if(btnOcr) btnOcr.style.display = 'block';  // ya se ve siempre; esto lo repone si estaba oculto
      }
    }, resolucionAlta);
  };
  reader.readAsDataURL(file);
  input.value = '';
}

// ═══════════════════════════════════════════════════════════════════
//  HOJAS DE LA FACTURA DE COMPRA -20 sep-. Sensei: una factura a mano puede
//  tener dos hojas o mas, y antes solo cabia una foto. Ahora se pueden poner
//  varias. Se guardan en window._ccHojas -array de dataURLs-. La hoja 1 tambien
//  se copia a #cc-foto-data para que el lector de texto -OCR- siga funcionando
//  igual sobre la primera hoja, sin tocar nada de eso.
window._ccHojas = window._ccHojas || [];

function pintarHojasFactura(){
  var fila = document.getElementById('cc-hojas-fila');
  if(!fila) return;
  var html = '';
  window._ccHojas.forEach(function(dataUrl, i){
    html += '<div onclick="opcionesHojaFactura('+i+')" '
      + 'style="width:56px;height:56px;border-radius:10px;overflow:hidden;flex-shrink:0;cursor:pointer;position:relative;border:1px solid #ddd">'
      + '<img src="'+dataUrl+'" style="width:100%;height:100%;object-fit:cover">'
      + '<span style="position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,.55);color:#fff;font-size:9px;font-weight:800;text-align:center;line-height:14px">Hoja '+(i+1)+'</span>'
      + '</div>';
  });
  // El boton de agregar: siempre visible, para poner 2, 3, las que traiga la factura
  html += '<div onclick="abrirOpcionesHojaNueva()" '
    + 'style="width:56px;height:56px;border-radius:10px;background:var(--nbs-gold-bg);border:2px dashed var(--nbs-gold);display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0;cursor:pointer;color:var(--nbs-gold-dark)">'
    + '<span style="font-size:20px;line-height:1">➕</span>'
    + '<span style="font-size:9px;font-weight:800">'+(window._ccHojas.length?'más':'foto')+'</span>'
    + '</div>';
  fila.innerHTML = html;
  // La hoja 1 alimenta el lector de texto -OCR- y el campo viejo, sin romper nada
  var campoViejo = document.getElementById('cc-foto-data');
  if(campoViejo) campoViejo.value = window._ccHojas[0] || '';
  var btnOcr = document.getElementById('cc-btn-ocr');
  if(btnOcr && window._ccHojas.length) btnOcr.style.display = 'block';
}

function abrirOpcionesHojaNueva(){
  mostrarMenuOpcionesFoto([
    ['📷 Tomar foto', function(){ recrearInputFoto('cc-foto-camara', function(input){ cargarHojaFactura(input); }).click(); }],
    ['🖼️ Elegir de galería', function(){ recrearInputFoto('cc-foto-galeria', function(input){ cargarHojaFactura(input); }).click(); }]
  ]);
}

function cargarHojaFactura(input){
  var file = input.files[0];
  if(!file) return;
  if(!esFotoValida(file)){ input.value = ''; return; }
  var reader = new FileReader();
  reader.onload = function(e){
    // Misma resolucion alta que la foto de factura de siempre, para leer los numeros chiquitos
    abrirRecortarFoto(e.target.result, function(dataFinal){
      window._ccHojas.push(dataFinal);
      pintarHojasFactura();
    }, 1800);
  };
  reader.readAsDataURL(file);
  input.value = '';
}

function opcionesHojaFactura(i){
  var dataUrl = window._ccHojas[i];
  if(!dataUrl) return;
  mostrarMenuOpcionesFoto([
    ['👁️ Ver esta hoja grande', function(){ verFotoGasto(dataUrl); }],
    ['🗑️ Quitar esta hoja', function(){
      window._ccHojas.splice(i, 1);
      pintarHojasFactura();
    }]
  ]);
}

// Carga la libreria de lectura de texto -Tesseract.js- solo la primera vez que hace falta,
// para no ralentizar el resto de la app en cada uso normal. Necesita internet SOLO esta
// primera vez, para descargarla; despues de cargada, el navegador la guarda en cache.
// ===== BUSQUEDA INTELIGENTE CON IA -gratis, corre en el telefono, sin servidor ni costo- =====
// Usa un modelo pequeño -Transformers.js, de Hugging Face- que entiende el SIGNIFICADO de lo que
// se busca, no solo las letras exactas. Asi encuentra un producto aunque se escriba distinto,
// con una falta de ortografia, o con otra palabra parecida.
window._iaEmbeddingsCatalogo = null; // cache en memoria mientras la app esta abierta

function prepararFotoParaOCR(dataUrl, callback){
  var img = new Image();
  img.onload = function(){
    var escala = img.naturalWidth < 1000 ? 1600/img.naturalWidth : 1;
    var canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth*escala);
    canvas.height = Math.round(img.naturalHeight*escala);
    var ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    var datos = ctx.getImageData(0, 0, canvas.width, canvas.height);
    var d = datos.data;
    var CONTRASTE = 1.35;
    for(var i=0; i<d.length; i+=4){
      var gris = d[i]*0.3 + d[i+1]*0.59 + d[i+2]*0.11; // pasar a blanco y negro
      gris = Math.min(255, Math.max(0, (gris-128)*CONTRASTE + 128)); // subir el contraste
      d[i] = d[i+1] = d[i+2] = gris;
    }
    ctx.putImageData(datos, 0, 0);
    callback(canvas.toDataURL('image/png'));
  };
  img.src = dataUrl;
}

function quitarFotoGasto(prefijo){
  prefijo = prefijo || 'gasto';
  var campo = document.getElementById(prefijo+'-foto-data');
  if(campo) campo.value = '';
  var prev = document.getElementById(prefijo+'-foto-preview');
  if(prev){   // 📄 la compra ya no usa preview -usa hojas-; los demas si lo tienen
    prev.innerHTML = '📷';
    prev.style.background = 'var(--nbs-gold-bg)';
    prev.style.border = '2px dashed var(--nbs-gold)';
  }
  if(prefijo === 'cc'){
    var btnOcr = document.getElementById('cc-btn-ocr');
    if(btnOcr) btnOcr.style.display = 'block';  // se deja visible aunque no haya foto -26 jul-
    var resOcr = document.getElementById('cc-ocr-resultado');
    if(resOcr) resOcr.style.display = 'none';
  }
}

function abrirOpcionesFotoGasto(prefijo){
  prefijo = prefijo || 'gasto';
  var tieneFoto = !!(document.getElementById(prefijo+'-foto-data').value);
  var overlay = document.getElementById('foto-acciones-overlay');
  if(!overlay){
    overlay = document.createElement('div');
    overlay.id = 'foto-acciones-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:99998;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);display:flex;align-items:flex-end';
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = '';
  overlay.onclick = function(e){ if(e.target === overlay) overlay.style.display = 'none'; };

  var sheet = document.createElement('div');
  sheet.style.cssText = 'background:white;width:100%;max-width:480px;margin:0 auto;border-radius:16px 16px 0 0;padding:16px;box-shadow:0 -4px 20px rgba(0,0,0,0.15)';

  var titulo = document.createElement('div');
  titulo.style.cssText = 'text-align:center;font-size:13px;color:#aaa;font-weight:700;text-transform:uppercase;margin-bottom:12px';
  titulo.textContent = 'Foto del recibo o factura';
  sheet.appendChild(titulo);

  var opciones = [
    ['📷 Tomar foto', 'var(--nbs-ink)', function(){ recrearInputFoto(prefijo+'-foto-camara', function(input){ cargarFotoGasto(input, prefijo); }).click(); }],
    ['🖼️ Elegir de galería', 'var(--nbs-ink)', function(){ recrearInputFoto(prefijo+'-foto-galeria', function(input){ cargarFotoGasto(input, prefijo); }).click(); }]
  ];
  if(tieneFoto){
    opciones.push(['🗑️ Quitar foto', 'var(--nbs-red-text)', function(){ quitarFotoGasto(prefijo); }]);
  }
  opciones.forEach(function(op){
    var btn = document.createElement('button');
    btn.textContent = op[0];
    btn.style.cssText = 'display:block;width:100%;text-align:left;padding:14px 16px;background:#f5f5f5;color:'+op[1]+';border:none;border-radius:10px;margin-bottom:8px;font-size:15px;font-weight:700;cursor:pointer';
    btn.onclick = function(){ overlay.style.display = 'none'; op[2](); };
    sheet.appendChild(btn);
  });

  var btnCancelar = document.createElement('button');
  btnCancelar.textContent = 'Cancelar';
  btnCancelar.style.cssText = 'display:block;width:100%;text-align:center;padding:14px 16px;background:none;color:#999;border:none;font-size:15px;cursor:pointer';
  btnCancelar.onclick = function(){ overlay.style.display = 'none'; };
  sheet.appendChild(btnCancelar);

  overlay.appendChild(sheet);
  overlay.style.display = 'flex'; overlay.scrollTop = 0;
}

// Menu generico de opciones para una foto, reutilizable donde haga falta -recibe una lista de
// [texto, funcion] y las muestra como una hoja que sube desde abajo-.
function mostrarMenuOpcionesFoto(opciones){
  var overlay = document.getElementById('foto-acciones-overlay');
  if(!overlay){
    overlay = document.createElement('div');
    overlay.id = 'foto-acciones-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:999999;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);display:flex;align-items:flex-end';
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = '';
  overlay.onclick = function(e){ if(e.target === overlay) overlay.style.display = 'none'; };
  var sheet = document.createElement('div');
  sheet.style.cssText = 'background:white;width:100%;max-width:480px;margin:0 auto;border-radius:16px 16px 0 0;padding:16px;box-shadow:0 -4px 20px rgba(0,0,0,0.15)';
  opciones.forEach(function(op){
    var btn = document.createElement('button');
    btn.textContent = op[0];
    btn.style.cssText = 'display:block;width:100%;text-align:left;padding:14px 16px;background:#f5f5f5;color:'+(op[0].indexOf('Quitar')>=0?'var(--nbs-red-text)':'var(--nbs-ink)')+';border:none;border-radius:10px;margin-bottom:8px;font-size:15px;font-weight:700;cursor:pointer';
    btn.onclick = function(){ overlay.style.display = 'none'; op[1](); };
    sheet.appendChild(btn);
  });
  var btnCancelar = document.createElement('button');
  btnCancelar.textContent = 'Cancelar';
  btnCancelar.style.cssText = 'display:block;width:100%;text-align:center;padding:14px 16px;background:none;color:#999;border:none;font-size:15px;cursor:pointer';
  btnCancelar.onclick = function(){ overlay.style.display = 'none'; };
  sheet.appendChild(btnCancelar);
  overlay.appendChild(sheet);
  overlay.style.display = 'flex'; overlay.scrollTop = 0;
}

function verFotoGasto(dataUrl){
  var overlay = document.getElementById('foto-visor-overlay');
  if(!overlay){
    overlay = document.createElement('div');
    overlay.id = 'foto-visor-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.92);z-index:999998;display:flex;align-items:center;justify-content:center;padding:20px';
    overlay.onclick = function(){ overlay.style.display = 'none'; };
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = '<img src="'+dataUrl+'" style="max-width:100%;max-height:100%;border-radius:8px">'
    +'<button onclick="document.getElementById(\'foto-visor-overlay\').style.display=\'none\'" style="position:fixed;top:16px;right:16px;background:white;border:none;border-radius:50%;width:40px;height:40px;font-size:20px;cursor:pointer">✕</button>';
  overlay.style.display = 'flex'; overlay.scrollTop = 0;
}

function generarReporteClientesCanvas(lista, orden, desdeTxt, hastaTxt){
  var W = 480, pad = 18, SCALE = 2;
  var alturaFila = 62;
  var alturaEstim = 260 + lista.length*alturaFila + 60;

  var canvas = document.createElement('canvas');
  canvas.width = W*SCALE; canvas.height = alturaEstim*SCALE;
  var ctx = canvas.getContext('2d');
  ctx.scale(SCALE, SCALE);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#fff'; ctx.fillRect(0,0,W,alturaEstim);

  var y = pad;
  // Logo + nombre del negocio
  if(LOGO_IMG_COLOR && LOGO_IMG_COLOR.naturalWidth > 0){
    ctx.drawImage(LOGO_IMG_COLOR, pad, y, 40, 40);
  }
  ctx.fillStyle = '#1a237e';
  ctx.font = '800 17px Arial'; ctx.textAlign = 'left';
  ctx.fillText('Nunez Beauty Supply', pad+48, y+18);
  ctx.fillStyle = '#666'; ctx.font = '12px Arial';
  ctx.fillText('964 Atwells Ave, Providence, RI', pad+48, y+36);
  y += 58;

  ctx.strokeStyle = '#ddd'; ctx.beginPath(); ctx.moveTo(pad,y); ctx.lineTo(W-pad,y); ctx.stroke();
  y += 24;

  ctx.fillStyle = '#1a237e'; ctx.font = '800 20px Arial'; ctx.textAlign = 'center';
  ctx.fillText('📊 Reporte por Cliente', W/2, y);
  y += 24;

  var textoRango = (desdeTxt||hastaTxt) ? ('Del '+(desdeTxt||'inicio')+' al '+(hastaTxt||'hoy')) : 'De siempre';
  ctx.fillStyle = '#666'; ctx.font = '12.5px Arial';
  ctx.fillText('Ordenado por '+(orden==='ganancia'?'Ganancia':'Cantidad comprada')+' · '+textoRango, W/2, y);
  y += 16;
  ctx.font = '11px Arial'; ctx.fillStyle = '#999';
  ctx.fillText('Generado el '+fechaHoy(), W/2, y);
  y += 26;

  ctx.textAlign = 'left';
  lista.forEach(function(c, idx){
    // tarjeta de fondo alterna, igual espiritu que la pantalla en la app
    ctx.fillStyle = idx % 2 === 0 ? '#f7f8fc' : '#fff';
    ctx.fillRect(pad-6, y-16, W-(pad-6)*2, alturaFila-8);

    ctx.fillStyle = '#1a237e'; ctx.font = '800 14px Arial';
    ctx.fillText((idx+1)+'. '+c.nombre, pad, y);
    if(c.negocio){
      ctx.fillStyle = '#999'; ctx.font = '11px Arial';
      ctx.fillText('🏪 '+c.negocio, pad, y+15);
    }
    var colW = (W - pad*2)/3;
    var yNum = y + 32;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#1565C0'; ctx.font = '9.5px Arial'; ctx.fillText('COMPRÓ', pad+colW*0.5, yNum-12);
    ctx.font = '800 13px Arial'; ctx.fillText('$'+fmtNum(c.comprado), pad+colW*0.5, yNum);
    ctx.fillStyle = '#2E7D32'; ctx.font = '9.5px Arial'; ctx.fillText('PAGÓ', pad+colW*1.5, yNum-12);
    ctx.font = '800 13px Arial'; ctx.fillText('$'+fmtNum(c.pagado), pad+colW*1.5, yNum);
    ctx.fillStyle = '#E65100'; ctx.font = '9.5px Arial'; ctx.fillText('GANANCIA', pad+colW*2.5, yNum-12);
    ctx.font = '800 13px Arial'; ctx.fillText('$'+fmtNum(c.ganancia), pad+colW*2.5, yNum);
    ctx.textAlign = 'left';
    y += alturaFila;
  });

  // recortar el canvas final a lo que realmente se dibujo
  var finalH = Math.ceil(y) + 10;
  var final = document.createElement('canvas');
  final.width = W*SCALE; final.height = finalH*SCALE;
  var ctxFinal = final.getContext('2d');
  ctxFinal.drawImage(canvas, 0, 0, W*SCALE, finalH*SCALE, 0, 0, W*SCALE, finalH*SCALE);
  return final;
}

function leerBarcodeDeFoto(input){
  var file = input.files[0];
  if(!file){ return; }
  if(!('BarcodeDetector' in window)){
    alert('Tu navegador no soporta la lectura de códigos de barra. Escribe el SKU manualmente.');
    input.value = '';
    return;
  }
  var reader = new FileReader();
  reader.onload = function(e){
    var img = new Image();
    img.onload = function(){
      var detector = new BarcodeDetector({ formats: ['ean_13','ean_8','upc_a','upc_e','code_128','code_39','codabar','qr_code','data_matrix','itf'] });
      detector.detect(img).then(function(codes){
        if(codes.length > 0){
          document.getElementById('ep-sku').value = codes[0].rawValue;
          alert('✅ Código leído: ' + codes[0].rawValue);
        } else {
          alert('No se detectó ningún código de barras en la foto. Intenta con mejor iluminación o más cerca.');
        }
      }).catch(function(){
        alert('Error al leer el código. Intenta de nuevo.');
      });
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
  input.value = '';
}


// ═══════════════════════════════════════════════════════════════════
//  ✨ LIMPIAR LAS FOTOS  (12 sep 2026)
//
//  Sensei: "una herramienta que recorte y limpie mis propias fotos automáticamente —
//  que quite el fondo y las deje todas iguales, como de catálogo".
//
//  🔑 TODO PASA EN SU TELÉFONO/PC. No sube nada a ningún sitio, no depende de ningún
//  servicio de pago, y funciona sin internet.
//
//  QUÉ HACE CON CADA FOTO:
//    ① Busca dónde está el producto y recorta lo que sobra
//    ② Lo centra en un cuadrado
//    ③ Pone fondo blanco limpio
//    ④ Sube un poco el contraste y el brillo
//  Así todas quedan iguales, como de catálogo.
// ═══════════════════════════════════════════════════════════════════

// 🔑 Encuentra el producto: mira el color de las esquinas -que es el fondo- y busca
// hasta dónde llega lo que NO se parece a ese color.
function _dondeEstaElProducto(datos, W, H){
  function color(x, y){
    var i = (y * W + x) * 4;
    return [datos[i], datos[i+1], datos[i+2]];
  }
  // El fondo: el promedio de las cuatro esquinas
  var esq = [color(2,2), color(W-3,2), color(2,H-3), color(W-3,H-3)];
  var fr = 0, fg = 0, fb = 0;
  esq.forEach(function(c){ fr += c[0]; fg += c[1]; fb += c[2]; });
  fr /= 4; fg /= 4; fb /= 4;

  var UMBRAL = 42;          // cuánto tiene que diferenciarse para contar como producto
  var x1 = W, y1 = H, x2 = 0, y2 = 0, hallados = 0;
  var salto = Math.max(1, Math.floor(Math.min(W, H) / 220));   // no hace falta mirar todo

  for(var y = 0; y < H; y += salto){
    for(var x = 0; x < W; x += salto){
      var c = color(x, y);
      var dif = Math.abs(c[0]-fr) + Math.abs(c[1]-fg) + Math.abs(c[2]-fb);
      if(dif > UMBRAL){
        hallados++;
        if(x < x1) x1 = x;
        if(x > x2) x2 = x;
        if(y < y1) y1 = y;
        if(y > y2) y2 = y;
      }
    }
  }
  // Si no encontró nada claro, se deja la foto entera
  if(hallados < 40 || x2 <= x1 || y2 <= y1) return { x: 0, y: 0, w: W, h: H, seguro: false };
  // Un margen alrededor, para no cortar al ras
  var m = Math.round(Math.max(x2-x1, y2-y1) * 0.08);
  x1 = Math.max(0, x1 - m); y1 = Math.max(0, y1 - m);
  x2 = Math.min(W, x2 + m); y2 = Math.min(H, y2 + m);
  return { x: x1, y: y1, w: x2-x1, h: y2-y1, seguro: true };
}

/**
 * ✨ Limpia una foto: recorta, centra en cuadrado, fondo blanco y realce.
 * Devuelve la imagen lista para guardar.
 */
function limpiarFoto(dataUrl, listo, opciones){
  opciones = opciones || {};
  var LADO = opciones.lado || 600;
  var img = new Image();
  img.onload = function(){
    try {
      // Se mira la foto a tamaño manejable, para que vaya rápido
      var W = img.width, H = img.height;
      var esc = Math.min(1, 700 / Math.max(W, H));
      var aw = Math.round(W * esc), ah = Math.round(H * esc);
      var c1 = document.createElement('canvas');
      c1.width = aw; c1.height = ah;
      var x1 = c1.getContext('2d', { willReadFrequently: true });
      x1.drawImage(img, 0, 0, aw, ah);
      var datos = x1.getImageData(0, 0, aw, ah).data;

      var r = opciones.recortar === false
        ? { x: 0, y: 0, w: aw, h: ah, seguro: false }
        : _dondeEstaElProducto(datos, aw, ah);

      // Se pasa el recorte a las medidas de la foto original
      var rx = Math.round(r.x / esc), ry = Math.round(r.y / esc);
      var rw = Math.round(r.w / esc), rh = Math.round(r.h / esc);

      // El lienzo final: cuadrado y blanco
      var c2 = document.createElement('canvas');
      c2.width = LADO; c2.height = LADO;
      var x2 = c2.getContext('2d');
      x2.fillStyle = opciones.fondo || '#ffffff';
      x2.fillRect(0, 0, LADO, LADO);

      // El producto, centrado y sin deformar
      var margen = Math.round(LADO * 0.06);
      var cabe = LADO - margen * 2;
      var f = Math.min(cabe / rw, cabe / rh);
      var dw = Math.round(rw * f), dh = Math.round(rh * f);
      var dx = Math.round((LADO - dw) / 2), dy = Math.round((LADO - dh) / 2);
      x2.imageSmoothingQuality = 'high';
      x2.drawImage(img, rx, ry, rw, rh, dx, dy, dw, dh);

      // 🧹 QUITAR EL FONDO: lo que se parece al color de las esquinas se vuelve blanco.
      // Así el producto queda sobre blanco limpio, no sobre el mostrador. -12 sep-
      if(opciones.quitarFondo !== false){
        var imf = x2.getImageData(0, 0, LADO, LADO);
        var pf = imf.data;
        // El color del fondo: las esquinas del recorte ya pegado
        function px(xx, yy){ var i = (yy*LADO+xx)*4; return [pf[i],pf[i+1],pf[i+2]]; }
        var muestras = [px(dx+3,dy+3), px(dx+dw-4,dy+3), px(dx+3,dy+dh-4), px(dx+dw-4,dy+dh-4),
                        px(dx+Math.round(dw/2),dy+2), px(dx+2,dy+Math.round(dh/2))];
        var fr2=0, fg2=0, fb2=0;
        muestras.forEach(function(c){ fr2+=c[0]; fg2+=c[1]; fb2+=c[2]; });
        fr2/=muestras.length; fg2/=muestras.length; fb2/=muestras.length;

        // Solo si el fondo NO es ya casi blanco: si lo es, no hay nada que quitar
        if(!(fr2 > 232 && fg2 > 232 && fb2 > 232)){
          var TOL = 58;
          for(var k = 0; k < pf.length; k += 4){
            var dd = Math.abs(pf[k]-fr2) + Math.abs(pf[k+1]-fg2) + Math.abs(pf[k+2]-fb2);
            if(dd < TOL){ pf[k] = 255; pf[k+1] = 255; pf[k+2] = 255; }
            else if(dd < TOL * 1.9){
              // Borde: se mezcla con blanco para que no quede recortado a cuchillo
              var m2 = (dd - TOL) / (TOL * 0.9);
              pf[k]   = Math.round(pf[k]   * m2 + 255 * (1-m2));
              pf[k+1] = Math.round(pf[k+1] * m2 + 255 * (1-m2));
              pf[k+2] = Math.round(pf[k+2] * m2 + 255 * (1-m2));
            }
          }
          x2.putImageData(imf, 0, 0);
        }
      }

      // ✨ Un poco de brillo y contraste, para que se vea de catálogo
      if(opciones.realzar !== false){
        var im2 = x2.getImageData(0, 0, LADO, LADO);
        var p = im2.data;
        var CONTRASTE = 1.14, BRILLO = 8;
        for(var i = 0; i < p.length; i += 4){
          p[i]   = Math.min(255, Math.max(0, (p[i]   - 128) * CONTRASTE + 128 + BRILLO));
          p[i+1] = Math.min(255, Math.max(0, (p[i+1] - 128) * CONTRASTE + 128 + BRILLO));
          p[i+2] = Math.min(255, Math.max(0, (p[i+2] - 128) * CONTRASTE + 128 + BRILLO));
        }
        x2.putImageData(im2, 0, 0);
      }

      listo(c2.toDataURL('image/jpeg', 0.82), r.seguro);
    } catch(e){
      console.warn('no pude limpiar la foto:', e);
      listo(dataUrl, false);        // si algo falla, se deja la original
    }
  };
  img.onerror = function(){ listo(dataUrl, false); };
  img.src = dataUrl;
}

function abrirRecortarFoto(dataUrlOriginal, onConfirmar, salidaMaxCustom){
  var MAXW = 320, MAXH = 420; // tamano maximo del area donde se ve la foto completa en pantalla
  var SALIDA_MAX = salidaMaxCustom || 600; // resolucion maxima del lado mas largo de la imagen final -mas alta para facturas/recibos, donde hay que poder leer numeros chiquitos-
  var MIN_RECT = 40; // tamano minimo del recuadro de recorte, en pixeles de pantalla
  var MAX_TRABAJO = 1600; // resolucion con la que se trabaja al girar -mas que suficiente,
                          // porque la foto final sale a SALIDA_MAX (600 u 900)-

  // ── Girar y mejorar -26 jul, pedido de Sensei- ──
  // giroBase = los saltos de 90 grados. giroFino = la barrita de -45 a +45 para enderezar.
  // SIEMPRE se parte de la foto ORIGINAL, nunca de la ya girada, para que no se vaya
  // poniendo borrosa cada vez que se toca algo.
  var giroBase = 0, giroFino = 0, mejorar = false;
  var imgOrig = null;        // la foto original, sin tocar
  var preservarRecuadro = false;

  var overlay = document.getElementById('crop-foto-overlay');
  if(!overlay){
    overlay = document.createElement('div');
    overlay.id = 'crop-foto-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.9);z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;box-sizing:border-box';
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = '';

  var titulo = document.createElement('div');
  titulo.textContent = 'Ajusta la foto';
  titulo.style.cssText = 'color:white;font-size:15px;font-weight:700;margin-bottom:6px';
  overlay.appendChild(titulo);

  var subtitulo = document.createElement('div');
  subtitulo.textContent = 'Arrastra los bordes para recortar · Gira si salió chueca · ✨ para aclararla';
  subtitulo.style.cssText = 'color:#ccc;font-size:12px;margin-bottom:14px;text-align:center;max-width:300px';
  overlay.appendChild(subtitulo);

  var lienzo = document.createElement('div');
  lienzo.style.cssText = 'position:relative;background:#111;touch-action:none;user-select:none';
  overlay.appendChild(lienzo);

  var img = new Image();
  img.style.cssText = 'display:block;position:absolute;top:0;left:0;user-select:none;-webkit-user-drag:none;pointer-events:none';
  lienzo.appendChild(img);

  // Capas oscuras fuera del recuadro de recorte -para resaltar que area va a quedar-
  var sombras = {};
  ['top','bottom','left','right'].forEach(function(lado){
    var s = document.createElement('div');
    s.style.cssText = 'position:absolute;background:rgba(0,0,0,0.6);pointer-events:none';
    lienzo.appendChild(s);
    sombras[lado] = s;
  });

  var recuadro = document.createElement('div');
  recuadro.style.cssText = 'position:absolute;border:2px solid var(--nbs-gold);box-sizing:border-box;cursor:move';
  lienzo.appendChild(recuadro);

  // Manijas: una barra larga en cada lado, facil de agarrar con el dedo
  var manijas = {};
  var estiloManijaBase = 'position:absolute;background:var(--nbs-gold);border-radius:4px;touch-action:none';
  ['top','bottom'].forEach(function(lado){
    var m = document.createElement('div');
    m.style.cssText = estiloManijaBase+';left:50%;transform:translateX(-50%);width:44px;height:10px;cursor:ns-resize';
    lienzo.appendChild(m);
    manijas[lado] = m;
  });
  ['left','right'].forEach(function(lado){
    var m = document.createElement('div');
    m.style.cssText = estiloManijaBase+';top:50%;transform:translateY(-50%);width:10px;height:44px;cursor:ew-resize';
    lienzo.appendChild(m);
    manijas[lado] = m;
  });

  // ── Girar -26 jul- ──
  // OJO: la primera version tenia UNA sola barra de -45 a +45. Sensei la probo y dijo que
  // estaba "muy sensitiva": 90 grados metidos en el ancho del telefono hacen que un
  // milimetro de dedo sean varios grados, imposible dejarla en un punto exacto. Ahora la
  // barra va de -20 a +20 -menos de la mitad de brincona en el mismo ancho- y ademas hay
  // botones - y + que mueven EXACTAMENTE 1 grado por toque, sin arrastrar nada.
  var TOPE_FINO = 20;

  function botonGiro(txt, ancho){
    var b = document.createElement('button');
    b.textContent = txt;
    b.style.cssText = 'flex-shrink:0;'+(ancho ? 'flex:1;' : 'width:46px;')
      + 'height:40px;background:#333;color:white;border:none;border-radius:9px;font-size:16px;font-weight:800;cursor:pointer';
    return b;
  }

  // Fila 1: los saltos de 90 grados, con los grados en grande en el medio
  var filaGiro = document.createElement('div');
  filaGiro.style.cssText = 'display:flex;align-items:center;gap:8px;margin-top:12px;width:100%;max-width:'+MAXW+'px';
  var btnIzq = botonGiro('↺ 90°', true);
  var btnDer = botonGiro('↻ 90°', true);
  var etiquetaGrados = document.createElement('div');
  etiquetaGrados.textContent = '0°';
  etiquetaGrados.style.cssText = 'flex-shrink:0;width:64px;text-align:center;color:var(--nbs-gold);font-size:19px;font-weight:900';
  filaGiro.appendChild(btnIzq); filaGiro.appendChild(etiquetaGrados); filaGiro.appendChild(btnDer);
  overlay.appendChild(filaGiro);

  // Fila 2: el ajuste fino -1 grado por toque, o la barrita mansa-
  var filaFina = document.createElement('div');
  filaFina.style.cssText = 'display:flex;align-items:center;gap:8px;margin-top:8px;width:100%;max-width:'+MAXW+'px';
  var btnMenos = botonGiro('−');
  var btnMas = botonGiro('+');
  var barra = document.createElement('input');
  barra.type = 'range';
  barra.min = String(-TOPE_FINO); barra.max = String(TOPE_FINO); barra.step = '1'; barra.value = '0';
  barra.style.cssText = 'flex:1;min-width:0;accent-color:var(--nbs-gold);height:34px';
  filaFina.appendChild(btnMenos); filaFina.appendChild(barra); filaFina.appendChild(btnMas);
  overlay.appendChild(filaFina);

  var pista = document.createElement('div');
  pista.textContent = 'Los botones − y + mueven 1 grado exacto';
  pista.style.cssText = 'color:#888;font-size:11px;margin-top:5px;text-align:center';
  overlay.appendChild(pista);

  // ── Boton de mejorar la luz -26 jul- ──
  var btnMejorar = document.createElement('button');
  btnMejorar.textContent = '✨ Mejorar la luz';
  btnMejorar.style.cssText = 'margin-top:10px;width:100%;max-width:'+MAXW+'px;padding:11px;background:#333;color:white;border:2px solid #555;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer';
  overlay.appendChild(btnMejorar);

  var botones = document.createElement('div');
  botones.style.cssText = 'display:flex;gap:10px;margin-top:14px;width:100%;max-width:'+MAXW+'px';
  var btnCancelar = document.createElement('button');
  btnCancelar.textContent = 'Cancelar';
  btnCancelar.style.cssText = 'flex:1;padding:12px;background:#444;color:white;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer';
  var btnReiniciar = document.createElement('button');
  btnReiniciar.textContent = '↺ Reiniciar';
  btnReiniciar.style.cssText = 'padding:12px 14px;background:#333;color:white;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer';
  var btnConfirmar = document.createElement('button');
  btnConfirmar.textContent = '✓ Confirmar';
  btnConfirmar.style.cssText = 'flex:1;padding:12px;background:var(--nbs-gold);color:white;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer';
  botones.appendChild(btnCancelar);
  botones.appendChild(btnReiniciar);
  botones.appendChild(btnConfirmar);
  overlay.appendChild(botones);

  var dispW, dispH; // tamano de la imagen tal como se muestra en pantalla
  var rx, ry, rw, rh; // posicion y tamano del recuadro de recorte, en coordenadas de PANTALLA

  function posicionInicialRecuadro(){
    // Por defecto, casi toda la foto -con un margen chiquito- para no recortar de mas sin querer
    var margen = 0.06;
    rx = dispW*margen; ry = dispH*margen;
    rw = dispW*(1-margen*2); rh = dispH*(1-margen*2);
  }

  function dibujar(){
    recuadro.style.left = rx+'px'; recuadro.style.top = ry+'px';
    recuadro.style.width = rw+'px'; recuadro.style.height = rh+'px';

    sombras.top.style.cssText += ';left:0;top:0;width:'+dispW+'px;height:'+ry+'px';
    sombras.bottom.style.cssText += ';left:0;top:'+(ry+rh)+'px;width:'+dispW+'px;height:'+(dispH-ry-rh)+'px';
    sombras.left.style.cssText += ';left:0;top:'+ry+'px;width:'+rx+'px;height:'+rh+'px';
    sombras.right.style.cssText += ';left:'+(rx+rw)+'px;top:'+ry+'px;width:'+(dispW-rx-rw)+'px;height:'+rh+'px';

    manijas.top.style.left = (rx+rw/2)+'px'; manijas.top.style.top = (ry-5)+'px';
    manijas.bottom.style.left = (rx+rw/2)+'px'; manijas.bottom.style.top = (ry+rh-5)+'px';
    manijas.left.style.top = (ry+rh/2)+'px'; manijas.left.style.left = (rx-5)+'px';
    manijas.right.style.top = (ry+rh/2)+'px'; manijas.right.style.left = (rx+rw-5)+'px';
  }

  // Sube la luz y el contraste automaticamente -"auto niveles"-. Busca el punto mas oscuro
  // y el mas claro de verdad de la foto -dejando fuera el 1% de cada extremo, que suelen ser
  // motas sueltas- y estira todo lo de en medio para que use el rango completo. Le da un
  // empujoncito extra a las sombras. Sirve mucho con las fotos oscuras de las barberias y
  // con las facturas donde el texto se pierde -26 jul-.
  function mejorarLuzYContraste(cx, w, h){
    try{
      var d = cx.getImageData(0, 0, w, h);
      var p = d.data, total = w*h, hist = new Uint32Array(256), i;
      for(i = 0; i < p.length; i += 4){
        hist[(p[i]*299 + p[i+1]*587 + p[i+2]*114)/1000 | 0]++;
      }
      var corte = Math.max(1, Math.round(total*0.01));
      var acum = 0, lo = 0, hi = 255;
      for(i = 0; i < 256; i++){ acum += hist[i]; if(acum > corte){ lo = i; break; } }
      acum = 0;
      for(i = 255; i >= 0; i--){ acum += hist[i]; if(acum > corte){ hi = i; break; } }
      if(hi - lo < 12) return;   // la foto ya usa casi todo el rango: mejor no tocarla
      var mapa = new Uint8ClampedArray(256), rango = hi - lo, v;
      for(i = 0; i < 256; i++){
        v = (i - lo)/rango;
        if(v < 0) v = 0; else if(v > 1) v = 1;
        mapa[i] = Math.round(Math.pow(v, 0.85)*255);  // 0.85 = aclara un poco las sombras
      }
      for(i = 0; i < p.length; i += 4){
        p[i] = mapa[p[i]]; p[i+1] = mapa[p[i+1]]; p[i+2] = mapa[p[i+2]];
      }
      cx.putImageData(d, 0, 0);
    }catch(e){
      // Si el navegador no deja leer el lienzo, se deja la foto tal cual -sin romper nada-
      console.warn('No se pudo mejorar la luz de la foto:', e);
    }
  }

  // Rehace la vista previa a partir de la foto ORIGINAL, con el giro y la mejora puestos.
  function regenerarVista(preservar){
    if(!imgOrig) return;
    preservarRecuadro = !!preservar;
    var grados = giroBase + giroFino;
    var ow = imgOrig.naturalWidth, oh = imgOrig.naturalHeight;
    var esc = Math.min(MAX_TRABAJO/Math.max(ow, oh), 1);
    var w = Math.round(ow*esc), h = Math.round(oh*esc);
    var rad = grados*Math.PI/180;
    var cosA = Math.abs(Math.cos(rad)), sinA = Math.abs(Math.sin(rad));
    var cw = Math.round(w*cosA + h*sinA), ch = Math.round(w*sinA + h*cosA);
    var c = document.createElement('canvas');
    c.width = cw; c.height = ch;
    var cx = c.getContext('2d');
    cx.fillStyle = '#ffffff';           // las esquinas que quedan vacias al girar, en blanco
    cx.fillRect(0, 0, cw, ch);
    cx.translate(cw/2, ch/2);
    cx.rotate(rad);
    cx.drawImage(imgOrig, -w/2, -h/2, w, h);
    cx.setTransform(1, 0, 0, 1, 0, 0);
    if(mejorar) mejorarLuzYContraste(cx, cw, ch);
    img.src = c.toDataURL('image/jpeg', 0.92);
  }

  img.onload = function(){
    var natW = img.naturalWidth, natH = img.naturalHeight;
    var escala = Math.min(MAXW/natW, MAXH/natH, 1);
    var antesW = dispW, antesH = dispH;
    dispW = Math.round(natW*escala); dispH = Math.round(natH*escala);
    img.style.width = dispW+'px'; img.style.height = dispH+'px';
    lienzo.style.width = dispW+'px'; lienzo.style.height = dispH+'px';
    // Al girar cambia el tamano y hay que reiniciar el recuadro. Al solo "mejorar" la luz
    // el tamano es el mismo, asi que se le respeta a Sensei el recorte que ya habia hecho.
    if(preservarRecuadro && antesW === dispW && antesH === dispH && rw && rh){
      dibujar();
    } else {
      posicionInicialRecuadro();
      dibujar();
    }
    preservarRecuadro = false;
  };

  imgOrig = new Image();
  imgOrig.onload = function(){ regenerarVista(false); };
  imgOrig.src = dataUrlOriginal;

  // ── Que hacen los controles nuevos ──
  function actualizarEtiqueta(){
    var g = giroBase + giroFino;
    while(g > 180) g -= 360;
    while(g <= -180) g += 360;
    etiquetaGrados.textContent = g + '°';
  }
  btnIzq.onclick = function(){ giroBase -= 90; actualizarEtiqueta(); regenerarVista(false); };
  btnDer.onclick = function(){ giroBase += 90; actualizarEtiqueta(); regenerarVista(false); };

  // Regenera con un respiro, para que arrastrar o tocar rapido no ahogue el telefono
  var relojBarra = null;
  function pedirRegenerar(ms){
    if(relojBarra) clearTimeout(relojBarra);
    relojBarra = setTimeout(function(){ regenerarVista(false); }, ms);
  }
  function ponerGiroFino(g){
    if(g < -TOPE_FINO) g = -TOPE_FINO;
    if(g > TOPE_FINO) g = TOPE_FINO;
    giroFino = g;
    barra.value = String(g);
    actualizarEtiqueta();
  }
  barra.oninput = function(){
    ponerGiroFino(parseInt(barra.value, 10) || 0);
    pedirRegenerar(130);
  };
  // Un toque = UN grado exacto. Asi no hay que atinarle arrastrando -26 jul-
  btnMenos.onclick = function(){ ponerGiroFino(giroFino - 1); pedirRegenerar(200); };
  btnMas.onclick   = function(){ ponerGiroFino(giroFino + 1); pedirRegenerar(200); };

  btnMejorar.onclick = function(){
    mejorar = !mejorar;
    btnMejorar.textContent = mejorar ? '✨ Mejorada — tocar para deshacer' : '✨ Mejorar la luz';
    btnMejorar.style.background = mejorar ? 'var(--nbs-gold)' : '#333';
    btnMejorar.style.borderColor = mejorar ? 'var(--nbs-gold)' : '#555';
    regenerarVista(true);   // el recorte que ya hizo se respeta
  };

  function posDe(e){
    if(e.touches && e.touches.length) return {x:e.touches[0].clientX, y:e.touches[0].clientY};
    return {x:e.clientX, y:e.clientY};
  }

  var modo = null; // 'mover' | 'top' | 'bottom' | 'left' | 'right'
  var startX, startY, startRx, startRy, startRw, startRh;

  function empezar(m){
    return function(e){
      e.preventDefault();
      modo = m;
      var p = posDe(e);
      startX = p.x; startY = p.y;
      startRx=rx; startRy=ry; startRw=rw; startRh=rh;
    };
  }
  function alMover(e){
    if(!modo) return;
    e.preventDefault();
    var p = posDe(e);
    var dx = p.x-startX, dy = p.y-startY;

    if(modo === 'mover'){
      rx = Math.min(dispW-rw, Math.max(0, startRx+dx));
      ry = Math.min(dispH-rh, Math.max(0, startRy+dy));
    } else if(modo === 'top'){
      var nuevoTop = Math.min(startRy+startRh-MIN_RECT, Math.max(0, startRy+dy));
      rh = startRh - (nuevoTop-startRy);
      ry = nuevoTop;
    } else if(modo === 'bottom'){
      rh = Math.min(dispH-startRy, Math.max(MIN_RECT, startRh+dy));
    } else if(modo === 'left'){
      var nuevoLeft = Math.min(startRx+startRw-MIN_RECT, Math.max(0, startRx+dx));
      rw = startRw - (nuevoLeft-startRx);
      rx = nuevoLeft;
    } else if(modo === 'right'){
      rw = Math.min(dispW-startRx, Math.max(MIN_RECT, startRw+dx));
    }
    dibujar();
  }
  function terminar(){ modo = null; }

  recuadro.addEventListener('mousedown', empezar('mover'));
  recuadro.addEventListener('touchstart', empezar('mover'), {passive:false});
  Object.keys(manijas).forEach(function(lado){
    manijas[lado].addEventListener('mousedown', empezar(lado));
    manijas[lado].addEventListener('touchstart', empezar(lado), {passive:false});
  });
  window.addEventListener('mousemove', alMover);
  window.addEventListener('touchmove', alMover, {passive:false});
  window.addEventListener('mouseup', terminar);
  window.addEventListener('touchend', terminar);

  btnReiniciar.onclick = function(){
    // Deja la foto como llego: sin giro, sin mejora y con el recorte completo -26 jul-
    giroBase = 0; giroFino = 0; mejorar = false;
    barra.value = '0';
    actualizarEtiqueta();
    btnMejorar.textContent = '✨ Mejorar la luz';
    btnMejorar.style.background = '#333';
    btnMejorar.style.borderColor = '#555';
    regenerarVista(false);
  };

  function cerrar(){
    overlay.style.display = 'none';
    window.removeEventListener('mousemove', alMover);
    window.removeEventListener('touchmove', alMover);
    window.removeEventListener('mouseup', terminar);
    window.removeEventListener('touchend', terminar);
  }
  btnCancelar.onclick = cerrar;
  btnConfirmar.onclick = function(){
    var escalaNatural = img.naturalWidth / dispW;
    var sx = rx*escalaNatural, sy = ry*escalaNatural;
    var sw = rw*escalaNatural, sh = rh*escalaNatural;

    var salidaW, salidaH;
    if(sw >= sh){ salidaW = Math.min(SALIDA_MAX, sw); salidaH = salidaW*(sh/sw); }
    else { salidaH = Math.min(SALIDA_MAX, sh); salidaW = salidaH*(sw/sh); }

    var canvas = document.createElement('canvas');
    canvas.width = Math.round(salidaW); canvas.height = Math.round(salidaH);
    var ctx = canvas.getContext('2d');
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    var dataFinal = canvas.toDataURL('image/jpeg', 0.85);
    cerrar();
    // \u2728 EL LIMPIADOR -12 sep-: recorta el producto, lo centra, quita el fondo y
    // realza. Sensei lo quiso en los dos sitios, para que d\u00e9 igual d\u00f3nde haga la foto.
    // Se puede apagar desde Cat\u00e1logo, con la casilla de limpiar.
    if(window._limpiarFotosApp !== false && typeof limpiarFoto === 'function'){
      limpiarFoto(dataFinal, function(limpia){ onConfirmar(limpia || dataFinal); }, { lado: 560 });
    } else {
      onConfirmar(dataFinal);
    }
  };

  overlay.style.display = 'flex'; overlay.scrollTop = 0;
}

function cargarFotoProducto(input){
  var file = input.files[0];
  if(!file) return;
  if(!esFotoValida(file)){ input.value = ''; return; }
  var reader = new FileReader();
  reader.onload = function(e){
    abrirRecortarFoto(e.target.result, function(dataFinal){
      document.getElementById('ep-foto-data').value = dataFinal;
      var prev = document.getElementById('ep-foto-preview');
      prev.innerHTML = '<img src="'+dataFinal+'" style="width:100%;height:100%;object-fit:cover">';
      prev.style.background = '#f0f0f0';
      prev.style.border = 'none';
    });
  };
  reader.readAsDataURL(file);
  input.value = '';
}

// Recrea un <input type=file> para forzar que el selector de archivos se abra
// de forma confiable en Android cada vez (algunos navegadores no reabren el mismo input dos veces).
// Red de seguridad: aunque el filtro accept="image/*" ya le pide fotos a Android, algunos
// exploradores dejan colar un PDF o un video igual. Esta funcion lo revisa y avisa claro,
// en vez de romperse en silencio -26 jul-.
function esFotoValida(file){
  if(!file) return false;
  var tipo = (file.type || '').toLowerCase();
  var nombre = (file.name || '').toLowerCase();
  var porNombre = /\.(jpe?g|png|gif|bmp|webp|heic|heif)$/.test(nombre);
  if(tipo.indexOf('image/') === 0 || porNombre) return true;
  avisoGrande('📷 Eso no parece una foto.\n\nEscogiste: ' + (file.name || 'un archivo') + '\n\nEscoge una imagen (JPG, PNG, etc.).');
  return false;
}

function recrearInputFoto(id, handler){
  var viejo = document.getElementById(id);
  var nuevo = document.createElement('input');
  nuevo.type = 'file';
  nuevo.id = id;
  nuevo.accept = viejo.accept;
  if(viejo.capture) nuevo.capture = viejo.capture;
  nuevo.style.display = 'none';
  nuevo.onchange = function(){ handler(this); };
  viejo.parentNode.replaceChild(nuevo, viejo);
  return nuevo;
}

function quitarFotoProducto(){
  document.getElementById('ep-foto-data').value = '';
  var prev = document.getElementById('ep-foto-preview');
  prev.innerHTML = '📷';
  prev.style.background = 'var(--nbs-gold-bg)';
  prev.style.border = '2px dashed var(--nbs-gold)';
}

// ── Foto del cliente (reusa el mismo recorte/compresión de productos) ──
function cargarFotoCliente(input){
  var file = input.files[0];
  if(!file) return;
  if(!esFotoValida(file)){ input.value = ''; return; }
  var reader = new FileReader();
  reader.onload = function(e){
    // salidaMax 300 = foto chica y liviana (Sensei eligió liviana para los 117 clientes)
    abrirRecortarFoto(e.target.result, function(dataFinal){
      document.getElementById('ecl-foto-data').value = dataFinal;
      var prev = document.getElementById('ecl-foto-preview');
      prev.innerHTML = '<img src="'+dataFinal+'" style="width:100%;height:100%;object-fit:cover">';
      prev.style.background = '#f0f0f0';
      prev.style.border = 'none';
    }, 300);
  };
  reader.readAsDataURL(file);
  input.value = '';
}

// ANTES usaba prompt() -"escribe 1, 2 o 3"-. PROBLEMA REAL que reporto Sensei el 26 jul:
// la opcion 2 -galeria- no hacia NADA. Al darle OK al letrero de Android, el toque cuenta
// como hecho en el LETRERO del sistema y no dentro de la pagina, asi que Chrome bloquea el
// .click() al input de archivos. Ahora usa el MISMO menu de botones que ya usan los
// productos y los gastos -codigo ya probado en la app-, donde el toque si es de verdad.
function abrirOpcionesFotoCliente(){
  var tieneFoto = !!(document.getElementById('ecl-foto-data').value);
  var overlay = document.getElementById('foto-acciones-overlay');
  if(!overlay){
    overlay = document.createElement('div');
    overlay.id = 'foto-acciones-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:99998;backdrop-filter:blur(6px);display:flex;align-items:flex-end;overflow-y:auto';
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = '';
  overlay.onclick = function(e){ if(e.target === overlay) overlay.style.display = 'none'; };

  var sheet = document.createElement('div');
  sheet.style.cssText = 'background:white;width:100%;max-width:480px;margin:0 auto;border-radius:16px 16px 0 0;padding:16px;box-shadow:0 -4px 20px rgba(0,0,0,0.3)';

  var titulo = document.createElement('div');
  titulo.style.cssText = 'text-align:center;font-size:13px;color:#aaa;font-weight:700;text-transform:uppercase;margin-bottom:12px';
  titulo.textContent = 'Foto del cliente';
  sheet.appendChild(titulo);

  var opciones = [
    ['📷 Tomar foto', 'var(--nbs-ink)', function(){ recrearInputFoto('ecl-foto-camara', cargarFotoCliente).click(); }],
    ['🖼️ Elegir de galería', 'var(--nbs-ink)', function(){ recrearInputFoto('ecl-foto-galeria', cargarFotoCliente).click(); }]
  ];
  if(tieneFoto){
    opciones.push(['🗑️ Quitar foto', 'var(--nbs-red-text)', function(){ quitarFotoCliente(); }]);
  }
  opciones.forEach(function(op){
    var btn = document.createElement('button');
    btn.textContent = op[0];
    btn.style.cssText = 'display:block;width:100%;text-align:left;padding:14px 16px;background:#f5f5f5;color:'+op[1]+';border:none;border-radius:12px;font-size:15.5px;font-weight:700;margin-bottom:8px;cursor:pointer';
    btn.onclick = function(){ overlay.style.display = 'none'; op[2](); };
    sheet.appendChild(btn);
  });

  var btnCancelar = document.createElement('button');
  btnCancelar.textContent = 'Cancelar';
  btnCancelar.style.cssText = 'display:block;width:100%;text-align:center;padding:14px 16px;background:none;color:#999;border:none;font-size:15px;font-weight:700;cursor:pointer';
  btnCancelar.onclick = function(){ overlay.style.display = 'none'; };
  sheet.appendChild(btnCancelar);

  overlay.appendChild(sheet);
  overlay.style.display = 'flex'; overlay.scrollTop = 0;
}

function quitarFotoCliente(){
  document.getElementById('ecl-foto-data').value = '';
  var prev = document.getElementById('ecl-foto-preview');
  prev.innerHTML = '📷';
  prev.style.background = 'var(--nbs-gold-bg)';
  prev.style.border = '2px dashed var(--nbs-gold)';
}

function abrirOpcionesFotoProducto(){
  var tieneFoto = !!(document.getElementById('ep-foto-data').value);
  var overlay = document.getElementById('foto-acciones-overlay');
  if(!overlay){
    overlay = document.createElement('div');
    overlay.id = 'foto-acciones-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:99998;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);display:flex;align-items:flex-end';
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = '';
  overlay.onclick = function(e){ if(e.target === overlay) overlay.style.display = 'none'; };

  var sheet = document.createElement('div');
  sheet.style.cssText = 'background:white;width:100%;max-width:480px;margin:0 auto;border-radius:16px 16px 0 0;padding:16px;box-shadow:0 -4px 20px rgba(0,0,0,0.15)';

  var titulo = document.createElement('div');
  titulo.style.cssText = 'text-align:center;font-size:13px;color:#aaa;font-weight:700;text-transform:uppercase;margin-bottom:12px';
  titulo.textContent = 'Foto del producto';
  sheet.appendChild(titulo);

  var opciones = [
    ['📷 Tomar foto', 'var(--nbs-ink)', function(){ recrearInputFoto('ep-foto-camara', cargarFotoProducto).click(); }],
    ['🖼️ Elegir de galería', 'var(--nbs-ink)', function(){ recrearInputFoto('ep-foto-galeria', cargarFotoProducto).click(); }]
  ];
  if(tieneFoto){
    opciones.push(['🗑️ Quitar foto', 'var(--nbs-red-text)', function(){ quitarFotoProducto(); }]);
  }
  opciones.forEach(function(op){
    var btn = document.createElement('button');
    btn.textContent = op[0];
    btn.style.cssText = 'display:block;width:100%;text-align:left;padding:14px 16px;background:#f5f5f5;color:'+op[1]+';border:none;border-radius:10px;margin-bottom:8px;font-size:15px;font-weight:700;cursor:pointer';
    btn.onclick = function(){ overlay.style.display = 'none'; op[2](); };
    sheet.appendChild(btn);
  });

  var btnCancelar = document.createElement('button');
  btnCancelar.textContent = 'Cancelar';
  btnCancelar.style.cssText = 'display:block;width:100%;text-align:center;padding:14px 16px;background:none;color:#999;border:none;font-size:15px;cursor:pointer';
  btnCancelar.onclick = function(){ overlay.style.display = 'none'; };
  sheet.appendChild(btnCancelar);

  overlay.appendChild(sheet);
  overlay.style.display = 'flex'; overlay.scrollTop = 0;
}

function registrarVentaConFirma(){
  // Si el cliente pertenece a una barberia de la ruta de hoy, arranca el reloj
  // para recordarte marcarla como visitada (23 jul).
  try{
    var _cSel = (typeof clientes!=='undefined') ? clientes.filter(function(x){
      return String(x.id) === String(window._vendiendoCid || (document.getElementById('vcl')||{}).value);
    })[0] : null;
    if(_cSel && _cSel.negocio) marcarLlegadaBarberia(_cSel.negocio);
  }catch(e){}
  if(!iV.length){ alert('Agrega al menos un producto'); return; }
  // Preguntar si el cliente firma
  var overlay = document.getElementById('firma-pregunta-overlay');
  if(!overlay){
    overlay = document.createElement('div');
    overlay.id = 'firma-pregunta-overlay';
    document.body.appendChild(overlay);
  }
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px';
  overlay.innerHTML =
    '<div style="background:white;border-radius:14px;padding:20px;max-width:380px;width:100%;text-align:center">'
    +'<div style="font-size:17px;font-weight:800;color:#1a237e;margin-bottom:8px">✍️ ¿El cliente va a firmar?</div>'
    +'<p style="font-size:13px;color:#666;margin-bottom:18px">Si el cliente debe firmar esta factura, tócalo abajo. Si no, guárdala sin firma.</p>'
    +'<button onclick="pedirFirmaCliente()" style="width:100%;padding:13px;background:#2E7D32;color:white;border:none;border-radius:8px;font-size:15px;font-weight:700;cursor:pointer;margin-bottom:10px">✍️ Sí, debe firmar</button>'
    +'<button onclick="cerrarPreguntaFirma(); saveV();" style="width:100%;padding:13px;background:#F0F0F5;color:#333;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer">No es necesario, guardar</button>'
    +'</div>';
}

function cerrarPreguntaFirma(){
  var o = document.getElementById('firma-pregunta-overlay');
  if(o) o.style.display = 'none';
}

// Abre el recuadro para firmar con el dedo
function pedirFirmaCliente(){
  cerrarPreguntaFirma();
  var overlay = document.getElementById('firma-canvas-overlay');
  if(!overlay){
    overlay = document.createElement('div');
    overlay.id = 'firma-canvas-overlay';
    document.body.appendChild(overlay);
  }
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px';
  overlay.innerHTML =
    '<div style="background:white;border-radius:14px;padding:16px;max-width:440px;width:100%">'
    +'<div style="font-size:16px;font-weight:800;color:#1a237e;margin-bottom:4px;text-align:center">✍️ Firma del cliente</div>'
    +'<p style="font-size:12px;color:#888;margin-bottom:10px;text-align:center">Firma con el dedo en el recuadro</p>'
    +'<canvas id="firma-canvas" width="400" height="130" style="width:100%;height:130px;border:2px dashed #bbb;border-radius:10px;background:#FAFAFA;touch-action:none;display:block"></canvas>'
    +'<div style="display:flex;gap:8px;margin-top:12px">'
    +'<button onclick="limpiarFirma()" style="flex:1;padding:11px;background:#FFF3E0;color:#E65100;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer">🔄 Borrar</button>'
    +'<button onclick="venderSinFirma()" style="flex:1.2;padding:11px;background:#fff;color:#00695C;border:1.5px solid #00695C;border-radius:8px;font-size:12.5px;font-weight:800;cursor:pointer">\u2713 No hace falta firma</button>'
    +'<button onclick="cancelarFirma()" style="flex:.8;padding:11px;background:#F0F0F5;color:#333;border:none;border-radius:8px;font-size:12.5px;font-weight:600;cursor:pointer">Cancelar</button>'
    +'<button onclick="guardarFirmaYVenta()" style="flex:1.4;padding:11px;background:#2E7D32;color:white;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer">✓ Firmar y guardar</button>'
    +'</div>'
    +'</div>';
  setTimeout(iniciarCanvasFirma, 60);
}

var _firmaCtx = null, _firmaDibujando = false, _firmaHayTrazo = false;

// Dibuja la GUÍA de firma: una línea horizontal con una X a la izquierda, estilo
// documento profesional, para que el cliente firme ENCIMA de la línea. La guía queda
// en el canvas por debajo de la firma, así al guardar la firma sale CON su línea.
function dibujarGuiaFirma(){
  if(!_firmaCtx) return;
  var w = window._firmaAncho || 360;
  var hh = window._firmaAlto || 130;
  var yLinea = hh * 0.60; // la linea va un poco mas arriba del centro-bajo (menos espacio vacio)
  var margen = 22;
  _firmaCtx.save();
  // GRIS OSCURO: se ve claro pero no distrae ni tapa la firma
  _firmaCtx.strokeStyle = '#5f6368';
  _firmaCtx.fillStyle = '#5f6368';
  _firmaCtx.lineCap = 'round';
  _firmaCtx.lineJoin = 'round';
  // La linea horizontal, bien marcada
  _firmaCtx.lineWidth = 2;
  _firmaCtx.beginPath();
  _firmaCtx.moveTo(margen + 34, yLinea);
  _firmaCtx.lineTo(w - margen, yLinea);
  _firmaCtx.stroke();
  // La X a la izquierda, GRANDE, encima del inicio de la linea (tamano 20px)
  var xs = 20; // tamano de la X
  var xcx = margen + 4; // esquina izquierda de la X
  var xcy = yLinea - xs; // arriba de la linea
  _firmaCtx.lineWidth = 3;
  _firmaCtx.beginPath();
  _firmaCtx.moveTo(xcx, xcy);
  _firmaCtx.lineTo(xcx + xs, xcy + xs);
  _firmaCtx.moveTo(xcx + xs, xcy);
  _firmaCtx.lineTo(xcx, xcy + xs);
  _firmaCtx.stroke();
  _firmaCtx.restore();
  // Devolver el pincel al estado de firma (negro, grueso)
  _firmaCtx.strokeStyle = '#111';
  _firmaCtx.lineWidth = 3.5;
  _firmaCtx.lineCap = 'round';
  _firmaCtx.lineJoin = 'round';
}

function iniciarCanvasFirma(){
  var canvas = document.getElementById('firma-canvas');
  if(!canvas) return;
  // SOLUCIÓN DEFINITIVA (basada en la librería profesional signature_pad):
  // El secreto para que NO salga con escaloncitos es fijar DOS tamaños que coincidan:
  //   1. El tamaño de dibujo (canvas.width/height) = tamaño en pantalla x densidad
  //   2. El tamaño CSS EXACTO en píxeles (canvas.style.width/height) = tamaño en pantalla
  // Antes el canvas tenía style width:100% (se estiraba y no coincidía → escaloncitos).
  var rect = canvas.getBoundingClientRect();
  var dpr = Math.max(window.devicePixelRatio || 1, 1);
  // Fijar el tamaño CSS EXACTO en píxeles (no % que estira)
  canvas.style.width = rect.width + 'px';
  canvas.style.height = rect.height + 'px';
  // Fijar el tamaño de dibujo a la densidad real de la pantalla
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  _firmaCtx = canvas.getContext('2d');
  _firmaCtx.scale(dpr, dpr); // así se dibuja en coordenadas de pantalla, nítido
  _firmaCtx.strokeStyle = '#111';
  _firmaCtx.lineWidth = 3.5;
  _firmaCtx.lineCap = 'round';
  _firmaCtx.lineJoin = 'round';
  _firmaCtx.imageSmoothingEnabled = true;
  _firmaCtx.imageSmoothingQuality = 'high';
  _firmaHayTrazo = false;

  // Dibujar la GUÍA: una X y una línea horizontal, para que el cliente firme encima.
  // Se guarda el tamaño en pantalla para redibujarla al limpiar.
  window._firmaAncho = rect.width;
  window._firmaAlto = rect.height;
  dibujarGuiaFirma();

  // La posición del dedo se calcula en el tamaño en pantalla (rect), que es la misma
  // escala en la que dibuja el contexto tras scale(dpr). El trazo sigue al dedo exacto.
  function pos(e){
    var r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  // Usamos "Pointer Events": un solo sistema que reconoce el dedo, el mouse Y el S Pen
  // (Samsung stylus). Así el cliente puede firmar con el lápiz del S26 Ultra o con el dedo.
  if(window.PointerEvent){
    function empezar(e){
      e.preventDefault();
      _firmaDibujando = true;
      // Grosor un poco más fino si es lápiz (pen), para que se vea como pluma de verdad
      _firmaCtx.lineWidth = (e.pointerType === 'pen') ? 3.0 : 3.5;
      var p = pos(e);
      _firmaCtx.beginPath();
      _firmaCtx.moveTo(p.x, p.y);
      _ultimoPunto = p;
      try{ canvas.setPointerCapture(e.pointerId); }catch(err){}
    }
    var _ultimoPunto = null;
    function mover(e){
      if(!_firmaDibujando) return;
      e.preventDefault();
      var p = pos(e);
      if(_ultimoPunto){
        // Curva suave (punto medio) en vez de línea recta: elimina los "escaloncitos"
        // en las curvas de la firma. El trazo sigue el dedo pero redondeado.
        var medioX = (_ultimoPunto.x + p.x) / 2;
        var medioY = (_ultimoPunto.y + p.y) / 2;
        _firmaCtx.quadraticCurveTo(_ultimoPunto.x, _ultimoPunto.y, medioX, medioY);
        _firmaCtx.stroke();
      }
      _ultimoPunto = p;
      _firmaHayTrazo = true;
    }
    function terminar(e){ if(e) e.preventDefault(); _firmaDibujando = false; _ultimoPunto = null; }

    canvas.addEventListener('pointerdown', empezar);
    canvas.addEventListener('pointermove', mover);
    canvas.addEventListener('pointerup', terminar);
    canvas.addEventListener('pointercancel', terminar);
    canvas.addEventListener('pointerleave', terminar);
  } else {
    // Respaldo para navegadores viejos que no tienen Pointer Events: dedo y mouse.
    function pos2(e){
      var r = canvas.getBoundingClientRect();
      var punto = e.touches ? e.touches[0] : e;
      return { x: punto.clientX - r.left, y: punto.clientY - r.top };
    }
    var _ultimoPunto2 = null;
    function empezar2(e){ e.preventDefault(); _firmaDibujando = true; var p = pos2(e); _firmaCtx.beginPath(); _firmaCtx.moveTo(p.x, p.y); _ultimoPunto2 = p; }
    function mover2(e){ if(!_firmaDibujando) return; e.preventDefault(); var p = pos2(e); if(_ultimoPunto2){ var mx=(_ultimoPunto2.x+p.x)/2, my=(_ultimoPunto2.y+p.y)/2; _firmaCtx.quadraticCurveTo(_ultimoPunto2.x, _ultimoPunto2.y, mx, my); _firmaCtx.stroke(); } _ultimoPunto2 = p; _firmaHayTrazo = true; }
    function terminar2(e){ if(e) e.preventDefault(); _firmaDibujando = false; _ultimoPunto2 = null; }
    canvas.addEventListener('mousedown', empezar2);
    canvas.addEventListener('mousemove', mover2);
    canvas.addEventListener('mouseup', terminar2);
    canvas.addEventListener('touchstart', empezar2, {passive:false});
    canvas.addEventListener('touchmove', mover2, {passive:false});
    canvas.addEventListener('touchend', terminar2, {passive:false});
  }
}

function limpiarFirma(){
  var canvas = document.getElementById('firma-canvas');
  if(canvas && _firmaCtx){ _firmaCtx.clearRect(0, 0, canvas.width, canvas.height); _firmaHayTrazo = false; dibujarGuiaFirma(); }
}

function cancelarFirma(){
  var o = document.getElementById('firma-canvas-overlay');
  if(o) o.style.display = 'none';
  // No guarda nada; el usuario puede volver a darle a Registrar venta
}


// ✅ CERRAR LA VENTA SIN FIRMA  (15 ago 2026)
//
// 🔑 SENSEI: "no quiero que sea obligatoria porque ahora mismo no me deja cerrar
// una venta si no se pone una firma... sí quiero que pida la firma siempre, pero
// si yo digo que no es necesario que AHÍ MISMO se haga la venta".
//
// Antes, "Cancelar" solo cerraba el recuadro y había que empezar la venta de nuevo.
// Ahora hay un botón que la cierra en el momento, sin firma.
function venderSinFirma(){
  var o = document.getElementById('firma-canvas-overlay');
  if(o) o.style.display = 'none';
  window._firmaVentaActual = null;
  window._firmaFechaActual = null;
  try { saveV(); } catch(e){ alert('No se pudo registrar la venta.'); }
}

function guardarFirmaYVenta(){
  if(!_firmaHayTrazo){ alert('El recuadro está vacío. Pide al cliente que firme, o toca Cancelar.'); return; }
  var canvas = document.getElementById('firma-canvas');
  if(canvas){
    // Se pinta el fondo BLANCO detrás de la firma (así no sale negro)
    // y se guarda en PNG para que la firma se vea nítida.
    var canvasBlanco = document.createElement('canvas');
    canvasBlanco.width = canvas.width;
    canvasBlanco.height = canvas.height;
    var ctxB = canvasBlanco.getContext('2d');
    ctxB.fillStyle = '#FFFFFF';
    ctxB.fillRect(0, 0, canvasBlanco.width, canvasBlanco.height);
    ctxB.drawImage(canvas, 0, 0);
    window._firmaVentaActual = canvasBlanco.toDataURL('image/png');
    window._firmaFechaActual = fechaHoy()+' '+new Date().toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',hour12:true});
  }
  var o = document.getElementById('firma-canvas-overlay');
  if(o) o.style.display = 'none';
  saveV(); // ahora sí guarda la venta, con la firma incluida
}

// Revisa si algún producto de la venta no tiene suficiente stock.
// Si falta, avisa con el detalle y deja que el usuario decida seguir o no.
// NUNCA bloquea la venta por sí sola — solo informa, porque el usuario
// puede tener el inventario desactualizado y necesita poder vender igual.
function confirmarDictadoPedido(pid, cantidad){
  loadProds();
  var p = productos.find(function(x){ return String(x.id)===String(pid); });
  if(!p) return;
  var encontrado = false;
  var precioAUsar = obtenerPrecioParaCliente(pedBarberoCid, p.id, p.precio);
  for(var j=0;j<pedItemsTemp.length;j++){
    if(String(pedItemsTemp[j].pid)===String(p.id)){ pedItemsTemp[j].cant += cantidad; encontrado = true; break; }
  }
  if(!encontrado) pedItemsTemp.push({ pid: p.id, nombre: p.nombre, cant: cantidad, precio: precioAUsar, costo: p.costo, foto: p.foto||null });
  renderPedItems();
  document.getElementById('dictado-resultado-wrap').style.display = 'none';
  document.getElementById('pedb').value = '';
}

function abrirOpcionesFotoMarca(i){
  var tieneFoto = !!(document.getElementById('epml-foto-data-'+i).value);
  var overlay = document.getElementById('foto-acciones-overlay');
  if(!overlay){
    overlay = document.createElement('div');
    overlay.id = 'foto-acciones-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:99998;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);display:flex;align-items:flex-end';
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = '';
  overlay.onclick = function(e){ if(e.target === overlay) overlay.style.display = 'none'; };

  var sheet = document.createElement('div');
  sheet.style.cssText = 'background:white;width:100%;max-width:480px;margin:0 auto;border-radius:16px 16px 0 0;padding:16px;box-shadow:0 -4px 20px rgba(0,0,0,0.15)';

  var titulo = document.createElement('div');
  titulo.style.cssText = 'text-align:center;font-size:13px;color:#aaa;font-weight:700;text-transform:uppercase;margin-bottom:12px';
  titulo.textContent = 'Foto del producto';
  sheet.appendChild(titulo);

  var opciones = [
    ['📷 Tomar foto', 'var(--nbs-ink)', function(){ recrearInputFoto('epml-foto-camara-'+i, function(inp){ cargarFotoProductoMarca(inp, i); }).click(); }],
    ['🖼️ Elegir de galería', 'var(--nbs-ink)', function(){ recrearInputFoto('epml-foto-galeria-'+i, function(inp){ cargarFotoProductoMarca(inp, i); }).click(); }]
  ];
  if(tieneFoto){
    opciones.push(['🗑️ Quitar foto', 'var(--nbs-red-text)', function(){ quitarFotoProductoMarca(i); }]);
  }
  opciones.forEach(function(op){
    var btn = document.createElement('button');
    btn.textContent = op[0];
    btn.style.cssText = 'display:block;width:100%;text-align:left;padding:14px 16px;background:#f5f5f5;color:'+op[1]+';border:none;border-radius:10px;margin-bottom:8px;font-size:15px;font-weight:700;cursor:pointer';
    btn.onclick = function(){ overlay.style.display = 'none'; op[2](); };
    sheet.appendChild(btn);
  });

  var btnCancelar = document.createElement('button');
  btnCancelar.textContent = 'Cancelar';
  btnCancelar.style.cssText = 'display:block;width:100%;text-align:center;padding:14px 16px;background:none;color:#999;border:none;font-size:15px;cursor:pointer';
  btnCancelar.onclick = function(){ overlay.style.display = 'none'; };
  sheet.appendChild(btnCancelar);

  overlay.appendChild(sheet);
  overlay.style.display = 'flex'; overlay.scrollTop = 0;
}

function cargarFotoProductoMarca(input, i){
  var file = input.files[0];
  if(!file) return;
  if(!esFotoValida(file)){ input.value = ''; return; }
  var reader = new FileReader();
  reader.onload = function(e){
    abrirRecortarFoto(e.target.result, function(dataFinal){
      document.getElementById('epml-foto-data-'+i).value = dataFinal;
      var prev = document.getElementById('epml-foto-preview-'+i);
      prev.innerHTML = '<img src="'+dataFinal+'" style="width:100%;height:100%;object-fit:cover">';
      prev.style.background = '#f0f0f0';
      prev.style.border = 'none';
    });
  };
  reader.readAsDataURL(file);
  input.value = '';
}

function quitarFotoProductoMarca(i){
  document.getElementById('epml-foto-data-'+i).value = '';
  var prev = document.getElementById('epml-foto-preview-'+i);
  prev.innerHTML = '📷';
  prev.style.background = 'var(--nbs-gold-bg)';
  prev.style.border = '2px dashed var(--nbs-gold)';
}

function abrirConfirmacionBalance(cid, montoPagado){
  clientes = LS('ncl', []);
  var c = clientes.find(function(x){ return String(x.id) === String(cid); });
  if(!c){ alert('No encontré ese cliente.'); return; }
  var debe = balanceDelCliente(cid);
  window._confBalance = { cid: cid, debe: debe, pagado: (typeof montoPagado === 'number' ? montoPagado : null) };

  var ov = document.getElementById('confirmar-balance-overlay');
  if(!ov){
    ov = document.createElement('div');
    ov.id = 'confirmar-balance-overlay';
    document.body.appendChild(ov);
  }
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:99999;'
    + 'display:flex;align-items:center;justify-content:center;padding:14px';

  ov.innerHTML = '<div style="background:#fff;border-radius:15px;padding:16px;max-width:440px;width:100%;max-height:92vh;overflow:auto">'
    + '<div style="font-size:16px;font-weight:900;color:#1a237e;text-align:center;margin-bottom:3px">✍️ Confirmación de balance</div>'
    + '<div style="font-size:11.5px;color:#888;text-align:center;margin-bottom:12px">Que el cliente lo lea y firme</div>'

    // Lo que él está confirmando, grande y claro
    + '<div style="background:#F4F6FB;border:1px solid #c9cef0;border-radius:12px;padding:13px;margin-bottom:12px">'
    +   '<div style="font-size:15px;font-weight:900;color:var(--nbs-ink)">' + escaparHtml(nombreCl(c)) + '</div>'
    +   (c.negocio ? '<div style="font-size:11.5px;color:var(--nbs-muted);margin-bottom:8px">' + escaparHtml(c.negocio) + '</div>' : '<div style="margin-bottom:8px"></div>')
    +   (window._confBalance.pagado !== null
          ? '<div style="display:flex;justify-content:space-between;font-size:13px;padding:4px 0;border-bottom:1px solid #dde">'
            + '<span style="color:#555">Pagó hoy</span>'
            + '<span style="font-weight:800;color:#2E7D32">$' + fmtNum(window._confBalance.pagado) + '</span></div>'
          : '')
    +   '<div style="display:flex;justify-content:space-between;align-items:center;padding-top:9px">'
    +     '<span style="font-size:12px;font-weight:800;color:#555;letter-spacing:.4px">SU BALANCE</span>'
    +     '<span style="font-size:26px;font-weight:900;letter-spacing:-.6px;color:' + (debe > 0.005 ? '#C62828' : '#2E7D32') + '">$' + fmtNum(debe) + '</span>'
    +   '</div>'
    + '</div>'

    + '<div style="font-size:11px;color:#555;font-weight:700;margin-bottom:3px">📅 ¿De qué día es esta confirmación?</div>'
    + '<input type="date" id="conf-fecha" style="width:100%;padding:9px;border:1px solid #ddd;border-radius:8px;font-size:13px;margin-bottom:10px">'
    + '<div style="font-size:12px;color:#555;text-align:center;margin-bottom:8px">'
    +   'Firme aquí para confirmar que está de acuerdo con este balance</div>'
    + '<canvas id="firma-canvas" width="400" height="130" style="width:100%;height:130px;border:2px dashed #bbb;'
    +   'border-radius:10px;background:#FAFAFA;touch-action:none;display:block"></canvas>'

    + '<div style="display:flex;gap:8px;margin-top:12px">'
    +   '<button onclick="limpiarFirma()" style="flex:.9;padding:12px;background:#FFF3E0;color:#E65100;border:none;'
    +     'border-radius:9px;font-size:12.5px;font-weight:700;cursor:pointer">🔄 Borrar</button>'
    +   '<button onclick="guardarConfirmacionBalance()" style="flex:1.6;padding:12px;background:#2E7D32;color:#fff;'
    +     'border:none;border-radius:9px;font-size:13.5px;font-weight:800;cursor:pointer">✓ Confirmado</button>'
    + '</div>'
    + '<button onclick="cerrarConfirmacionBalance()" style="width:100%;padding:11px;margin-top:8px;background:#F0F0F5;'
    +   'color:#444;border:none;border-radius:9px;font-size:12.5px;font-weight:700;cursor:pointer">Ahora no</button>'
    + '</div>';

  // El mismo lienzo de siempre
  setTimeout(function(){ try { iniciarCanvasFirma(); } catch(e){} }, 60);
  setTimeout(function(){ ponerHoyEnCampo('conf-fecha'); }, 0);   // 📅 -2 sep-
}

// \ud83d\udd15 Prender o apagar lo de la firma. Si a Sensei le estorba, desaparece de todas
// partes: del aviso de despues de cobrar, de la ficha del cliente y del menu. -30 ago-
function cambiarModoFirmaBalance(){
  var puesto = (LS('nbs_pedir_firma', '1') === '1');
  var msg = puesto
    ? 'Ahora mismo la app te OFRECE que el cliente firme su balance.\n\n'
      + '\u00bfQuitarlo? Dejar\u00eda de aparecer en la ficha del cliente y despu\u00e9s de cobrar.\n\n'
      + 'El comprobante por WhatsApp sigue igual.'
    : 'Ahora mismo lo de la firma est\u00e1 apagado.\n\n\u00bfVolver a ofrecerlo?';
  if(!confirm(msg)) return;
  SS('nbs_pedir_firma', puesto ? '0' : '1');
  avisoGrande(puesto
    ? '\u2705 Listo. Ya no se ofrece la firma.\n\nSi alg\u00fan d\u00eda la necesitas con un cliente, la vuelves a prender aqu\u00ed mismo.'
    : '\u2705 La firma se vuelve a ofrecer.');
  try { if(window._clientePerfilActual != null) pintarPanelCliente(window._clientePerfilActual); } catch(e){}
}

// \u00bfSe ofrece la firma? Por defecto si, pero el manda.
function seOfreceFirma(){ return LS('nbs_pedir_firma', '1') === '1'; }

function cerrarConfirmacionBalance(){
  var ov = document.getElementById('confirmar-balance-overlay');
  if(ov) ov.style.display = 'none';
}

function guardarConfirmacionBalance(){
  var d = window._confBalance;
  if(!d) return;
  if(!_firmaHayTrazo){
    alert('Falta la firma del cliente.\n\nQue firme con el dedo en el recuadro, o toca "Ahora no".');
    return;
  }
  var canvas = document.getElementById('firma-canvas');
  var firma = '';
  try { firma = canvas.toDataURL('image/png'); } catch(e){}

  var confs = LS('nconfirmaciones', []);
  confs.push({
    id: Date.now(),
    cid: d.cid,
    balance: d.debe,
    pagado: d.pagado,
    fecha: fechaDelCampo('conf-fecha'),   // 📅 la que el escogio -2 sep-
    hora: horaAhora(),
    firma: firma || null,
    como: 'firma'
  });
  if(!SS('nconfirmaciones', confs)) return;   // SS ya avisa si no cupo

  cerrarConfirmacionBalance();
  alert('✅ Balance confirmado y firmado.\n\n' + nombreCl(clientes.find(function(x){ return String(x.id)===String(d.cid); }) || {})
    + '\nBalance: $' + fmtNum(d.debe) + '\n' + fechaHoy() + ' · ' + horaAhora()
    + '\n\nQueda guardado en su ficha como prueba.');
}

// ── Lo que sirve para saber quién NO ha confirmado ──

// La última confirmación de un cliente, o null.
function ultimaConfirmacion(cid){
  var confs = LS('nconfirmaciones', []).filter(function(x){ return String(x.cid) === String(cid); });
  if(!confs.length) return null;
  confs.sort(function(a, b){ return (b.id || 0) - (a.id || 0); });
  return confs[0];
}

// ¿Le hace falta confirmar? Sí cuando debe dinero y su balance de hoy NO coincide
// con el que confirmó la última vez. Si nunca confirmó y debe, también.
function leFaltaConfirmar(cid){
  var debe = balanceDelCliente(cid);
  if(debe <= 0.005) return false;            // sin deuda no hay nada que confirmar
  var u = ultimaConfirmacion(cid);
  if(!u) return true;
  return Math.abs((u.balance || 0) - debe) > 0.005;
}

// Todos los que deben y no han confirmado su balance de ahora.
function clientesSinConfirmar(){
  clientes = LS('ncl', []);
  return clientes.filter(function(c){ return leFaltaConfirmar(c.id); })
    .map(function(c){
      var u = ultimaConfirmacion(c.id);
      return { cid: c.id, nombre: nombreCl(c), negocio: c.negocio || '',
               debe: balanceDelCliente(c.id),
               confirmoAntes: u ? { balance: u.balance, fecha: u.fecha } : null };
    })
    .sort(function(a, b){ return b.debe - a.debe; });
}

// ── 📋 LA LISTA DE QUIÉN NO HA CONFIRMADO ──
// Sin esto, cualquier confirmación se pierde. Con esto, el que no confirma queda
// marcado y se resuelve en la próxima visita.
function verSinConfirmar(){
  var lista = clientesSinConfirmar();
  var ov = document.getElementById('sinconf-overlay');
  if(!ov){
    ov = document.createElement('div');
    ov.id = 'sinconf-overlay';
    document.body.appendChild(ov);
  }
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:99999;'
    + 'display:flex;align-items:flex-end;justify-content:center';

  var total = lista.reduce(function(a, x){ return a + x.debe; }, 0);
  var h = '<div style="background:#fff;width:100%;max-width:520px;border-radius:16px 16px 0 0;'
    + 'padding:14px;max-height:92vh;overflow:auto">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">'
    +   '<div style="font-size:16px;font-weight:900;color:#1a237e">📋 Balances sin confirmar</div>'
    +   '<button onclick="cerrarSinConfirmar()" style="background:#F0F0F2;border:none;border-radius:8px;'
    +     'width:32px;height:32px;font-size:15px;cursor:pointer">✕</button>'
    + '</div>'
    + '<div style="font-size:11.5px;color:#888;margin-bottom:12px">'
    +   'Clientes que te deben y todavía no han firmado que están de acuerdo.</div>';

  if(!lista.length){
    h += '<div style="background:#E8F5E9;border-radius:11px;padding:16px;text-align:center">'
      + '<div style="font-size:15px;font-weight:800;color:#2E7D32">✅ Todos confirmados</div>'
      + '<div style="font-size:12px;color:#555;margin-top:4px">Nadie te debe sin haber firmado su balance.</div>'
      + '</div>';
  } else {
    h += '<div style="background:#FFEBEE;border:1px solid #EF9A9A;border-radius:10px;padding:9px 11px;margin-bottom:10px">'
      + '<div style="font-size:12.5px;font-weight:800;color:#C62828">'
      +   lista.length + ' cliente(s) · $' + fmtNum(total) + ' sin confirmar</div></div>';

    lista.forEach(function(x){
      h += '<div onclick="cerrarSinConfirmar();verCl(' + _arg(x.cid) + ')" '
        + 'style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 4px;'
        + 'border-bottom:1px solid #F2F2F5;cursor:pointer">'
        + '<div style="flex:1;min-width:0">'
        +   '<div style="font-size:13.5px;font-weight:800;color:var(--nbs-ink)">' + escaparHtml(x.nombre) + '</div>'
        +   '<div style="font-size:11px;color:var(--nbs-muted)">' + escaparHtml(x.negocio)
        +     (x.confirmoAntes ? ' · confirmó $' + fmtNum(x.confirmoAntes.balance) + ' el ' + escaparHtml(x.confirmoAntes.fecha)
                               : ' · nunca ha confirmado') + '</div>'
        + '</div>'
        + '<div style="font-size:16px;font-weight:900;color:#C62828;flex-shrink:0">$' + fmtNum(x.debe) + '</div>'
        + '</div>';
    });
  }

  h += '<button onclick="cerrarSinConfirmar()" style="width:100%;padding:13px;margin-top:14px;background:#F0F0F2;'
    + 'color:#333;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer">Cerrar</button>'
    + '</div>';
  ov.innerHTML = h;
}

function cerrarSinConfirmar(){
  var ov = document.getElementById('sinconf-overlay');
  if(ov) ov.style.display = 'none';
}

// 📅 El último pago del cliente: cuánto y de qué día.  (3 sep 2026)
// Sensei: "dice 'su pago de hoy' y debe decir 'este es su último pago'... porque si le
// envío este mensaje hoy y fue la semana pasada que lo visité, solo le estoy enviando
// el mensaje para que él pudiera tener su balance al día".
// Devuelve null si nunca ha pagado.
function generarFacturaCanvas(v, cl, pagado, saldo, numFact, colorMode){
  var W = colorMode ? 480 : 384, pad = 16;
  var SCALE = colorMode ? 2 : 4; // b/n en resolucion 4 = texto nitido/profesional en la Epson termica; color en 2 (se ve nitida al hacer zoom en el celular)
  var abonos = (v.tipo==='credito' && v.pagosFactura) ? (v.pagosFactura || []).filter(function(p){ return typeof p.monto==='number' && p.monto>0; }) : [];

  var tmp = document.createElement('canvas');
  tmp.width = W*SCALE; tmp.height = 2200*SCALE;
  var ctxTmp = tmp.getContext('2d');
  ctxTmp.scale(SCALE, SCALE);
  ctxTmp.imageSmoothingEnabled = true; // suavizado siempre activo: en b/n a resolucion 4 da letras finas y nitidas antes de pasar a blanco/negro puro
  ctxTmp.imageSmoothingQuality = 'high';
  ctxTmp.fillStyle = '#fff'; ctxTmp.fillRect(0,0,W,2200);
  var finalY = dibujarContenidoFactura(ctxTmp, W, pad, v, cl, pagado, saldo, numFact, abonos, colorMode);

  // Sello de "PAGADO COMPLETO" -diagonal y bien tenue, para que no tape ningun detalle-.
  // Solo en la version a color: la version blanco y negro fuerza todo a blanco o negro puro
  // mas abajo -para que la impresora termica no manche el papel-, asi que un sello sutil con
  // transparencia no se veria bien ahi; no tendria sentido en un recibo termico real tampoco.
  if(colorMode && !esSaldoPendiente(saldo)){
    ctxTmp.save();
    ctxTmp.translate(W/2, finalY/2);
    ctxTmp.rotate(-28 * Math.PI/180);
    ctxTmp.globalAlpha = 0.13;
    ctxTmp.fillStyle = '#0F6E56';
    ctxTmp.font = '700 34px Georgia, serif';
    ctxTmp.textAlign = 'center';
    ctxTmp.fillText('PAGADO COMPLETO', 0, 0);
    ctxTmp.restore();
  }

  var finalH = Math.ceil(finalY) + (colorMode ? 16 : 100);
  var canvas = document.createElement('canvas');
  canvas.width = W*SCALE; canvas.height = finalH*SCALE;
  var ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#fff'; ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(tmp, 0, 0, W*SCALE, finalH*SCALE, 0, 0, W*SCALE, finalH*SCALE);

  if(!colorMode){
    // Forzar blanco y negro puro (sin grises) para que la impresora termica
    // no "diluya" el texto en puntos sueltos - esto evita el efecto de tinta baja.
    var imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    var d = imgData.data;
    for(var i = 0; i < d.length; i += 4){
      var lum = 0.299*d[i] + 0.587*d[i+1] + 0.114*d[i+2];
      var v2 = lum < 185 ? 0 : 255;
      d[i] = v2; d[i+1] = v2; d[i+2] = v2; d[i+3] = 255;
    }
    ctx.putImageData(imgData, 0, 0);
  }

  return canvas;
}


function abrirFirmaFactura(vid){
  ventas = LS('nv', []);
  var v = ventas.find(function(x){ return String(x.id)===String(vid); });
  if(!v) return;

  var overlay = document.getElementById('firma-overlay');
  if(!overlay){
    overlay = document.createElement('div');
    overlay.id = 'firma-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:white;z-index:999998;display:flex;flex-direction:column;padding:16px';
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = '';

  var header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;gap:10px;margin-bottom:12px';
  var btnBack = document.createElement('button');
  btnBack.textContent = '← Volver';
  btnBack.style.cssText = 'background:#E8EAF6;border:none;border-radius:8px;padding:10px 16px;cursor:pointer;font-size:14px;font-weight:600;color:#1a237e';
  btnBack.onclick = function(){ overlay.style.display='none'; };
  header.appendChild(btnBack);
  overlay.appendChild(header);

  var titulo = document.createElement('div');
  titulo.innerHTML = '<div style="font-size:17px;font-weight:800;color:#1565C0">✍️ Firma del cliente</div>'
    +'<div style="font-size:12px;color:#aaa;margin-top:2px">Factura #'+(v.numFactura||String(v.id).slice(-6))+' · '+v.cn+' · Opcional, solo como constancia de entrega</div>';
  overlay.appendChild(titulo);

  if(v.firma){
    var fotoActual = document.createElement('div');
    fotoActual.style.cssText = 'margin-top:12px;text-align:center';
    fotoActual.innerHTML = '<div style="font-size:11px;color:#777;margin-bottom:6px">Firma ya guardada -'+(v.firmaFecha||'')+'-:</div>'
      +'<img src="'+v.firma+'" style="max-width:100%;border:1px solid #ddd;border-radius:8px;background:#FAFAFA;image-rendering:auto">';
    overlay.appendChild(fotoActual);
    var btnBorrarFirma = document.createElement('button');
    btnBorrarFirma.textContent = '🗑️ Quitar esta firma y capturar una nueva';
    btnBorrarFirma.style.cssText = 'margin-top:10px;width:100%;padding:10px;background:#FFEBEE;color:#C62828;border:1px solid #FFCDD2;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer';
    btnBorrarFirma.onclick = function(){
      ventas = LS('nv', []);
      var v2 = ventas.find(function(x){ return String(x.id)===String(vid); });
      if(v2){ delete v2.firma; delete v2.firmaFecha; SS('nv', ventas); }
      abrirFirmaFactura(vid);
    };
    overlay.appendChild(btnBorrarFirma);
    overlay.style.display = 'flex';
    return;
  }

  var instrucciones = document.createElement('div');
  instrucciones.style.cssText = 'font-size:12px;color:#777;margin:12px 0 8px';
  instrucciones.textContent = 'Pídele al cliente que firme aquí con el dedo, para dejar constancia de que recibió el pedido:';
  overlay.appendChild(instrucciones);

  var contenedorLienzo = document.createElement('div');
  contenedorLienzo.style.cssText = 'border:2px dashed #ccc;border-radius:12px;background:#FAFAFA;flex:1;min-height:250px;position:relative;touch-action:none';
  overlay.appendChild(contenedorLienzo);

  var canvas = document.createElement('canvas');
  canvas.style.cssText = 'width:100%;height:100%;display:block;touch-action:none';
  contenedorLienzo.appendChild(canvas);

  var placeholder = document.createElement('div');
  placeholder.textContent = 'Firma aquí';
  placeholder.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#ccc;font-size:16px;pointer-events:none';
  contenedorLienzo.appendChild(placeholder);

  var ctx = canvas.getContext('2d');
  var dibujando = false;
  var yaFirmo = false;
  function ajustarTamanoLienzo(){
    var rect = contenedorLienzo.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    ctx.strokeStyle = '#1a237e';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }
  setTimeout(ajustarTamanoLienzo, 50);

  function posDe(e){
    var rect = canvas.getBoundingClientRect();
    if(e.touches && e.touches.length) return { x: e.touches[0].clientX-rect.left, y: e.touches[0].clientY-rect.top };
    return { x: e.clientX-rect.left, y: e.clientY-rect.top };
  }
  function empezar(e){
    e.preventDefault();
    dibujando = true; yaFirmo = true;
    placeholder.style.display = 'none';
    var p = posDe(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }
  function mover(e){
    if(!dibujando) return;
    e.preventDefault();
    var p = posDe(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }
  function terminar(){ dibujando = false; }

  // Pointer events: reconoce el S Pen (lápiz Samsung), el dedo y el mouse con un solo sistema.
  if(window.PointerEvent){
    canvas.addEventListener('pointerdown', function(e){ empezar(e); try{ canvas.setPointerCapture(e.pointerId); }catch(err){} });
    canvas.addEventListener('pointermove', mover);
    canvas.addEventListener('pointerup', terminar);
    canvas.addEventListener('pointercancel', terminar);
    canvas.addEventListener('pointerleave', terminar);
  } else {
    canvas.addEventListener('mousedown', empezar);
    canvas.addEventListener('mousemove', mover);
    canvas.addEventListener('mouseup', terminar);
    canvas.addEventListener('touchstart', empezar, {passive:false});
    canvas.addEventListener('touchmove', mover, {passive:false});
    canvas.addEventListener('touchend', terminar);
  }

  var botones = document.createElement('div');
  botones.style.cssText = 'display:flex;gap:10px;margin-top:12px';
  var btnLimpiar = document.createElement('button');
  btnLimpiar.textContent = '↺ Borrar y empezar de nuevo';
  btnLimpiar.style.cssText = 'flex:1;padding:12px;background:#f0f0f0;color:#555;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer';
  btnLimpiar.onclick = function(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    placeholder.style.display = 'block';
    yaFirmo = false;
  };
  var btnGuardarFirma = document.createElement('button');
  btnGuardarFirma.textContent = '✓ Guardar firma';
  btnGuardarFirma.style.cssText = 'flex:1;padding:12px;background:#1565C0;color:white;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer';
  btnGuardarFirma.onclick = function(){
    if(!yaFirmo){ alert('Todavía no hay ninguna firma dibujada.'); return; }
    ventas = LS('nv', []);
    var v2 = ventas.find(function(x){ return String(x.id)===String(vid); });
    if(v2){
      // Fondo blanco detrás de la firma para que no salga negra, y PNG nítido
      var cB = document.createElement('canvas');
      cB.width = canvas.width; cB.height = canvas.height;
      var ctxB = cB.getContext('2d');
      ctxB.fillStyle = '#FFFFFF';
      ctxB.fillRect(0, 0, cB.width, cB.height);
      ctxB.drawImage(canvas, 0, 0);
      v2.firma = cB.toDataURL('image/png');
      v2.firmaFecha = fechaHoy()+' '+new Date().toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',hour12:true});
      SS('nv', ventas);
    }
    overlay.style.display = 'none';
    verFacturaProfesional(vid);
  };
  botones.appendChild(btnLimpiar);
  botones.appendChild(btnGuardarFirma);
  overlay.appendChild(botones);

  overlay.style.display = 'flex';
}

// Cierra la pantalla de devolución sin hacer nada (por si el cliente cambia de parecer)
// Los motivos de siempre en una ruta de beauty supply. Se guardan por su clave -no por su
// texto- para poder contarlos aunque manana se cambie como se leen. -28 ago-
var MOTIVOS_DEVOLUCION = [
  { id:'defectuoso',  texto:'\ud83d\udd27 Vino da\u00f1ado o defectuoso' },
  { id:'equivocado',  texto:'\u274c No era el que pidi\u00f3' },
  { id:'no_vendio',   texto:'\ud83d\udcc9 No se le vendi\u00f3' },
  { id:'vencido',     texto:'\ud83d\udcc5 Vencido o muy viejo' },
  { id:'de_mas',      texto:'\u2795 Le lleg\u00f3 de m\u00e1s' },
  { id:'no_gusto',    texto:'\ud83d\ude41 No le gust\u00f3 al cliente' },
  { id:'otro',        texto:'\u2026 Otro motivo' }
];

