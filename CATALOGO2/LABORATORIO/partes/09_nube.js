
function tocarHoraUltimaCopiaNube(){
  try{
    localStorage.setItem('nbs_hora_ultima_revision_nube', String(Date.now()));
    localStorage.setItem('nbs_ultima_revision_nube_sincambios', '1');
    // Si la pantalla de copias está abierta, refrescarla para mostrar la hora nueva
    if(typeof cargarCopiasDeLaNube === 'function' && document.getElementById('p-copias') &&
       document.getElementById('p-copias').classList.contains('activa')){
      // no recargamos de la nube (gasta datos), solo actualizamos el texto de hora si existe
    }
  }catch(e){}
}

function traducirErrorFirebase(e){
  var codigo = (e && (e.code || '')) + '';
  var msj = (e && (e.message || '')) + '';
  if(codigo.indexOf('permission-denied') >= 0 || msj.indexOf('Missing or insufficient permissions') >= 0){
    return 'Firebase está bloqueando el acceso.\n\nHay que actualizar las REGLAS en la consola de Firebase (Firestore → Reglas).\n\nNO es tu internet.';
  }
  if(codigo.indexOf('unauthenticated') >= 0) return 'La sesión se cerró. Vuelve a entrar con tu correo y contraseña.';
  if(codigo.indexOf('unavailable') >= 0 || msj.indexOf('offline') >= 0 || !navigator.onLine){
    return 'No hay conexión con Firebase. Revisa tu internet.';
  }
  if(msj.indexOf('longer than') >= 0 || msj.indexOf('exceeds the maximum') >= 0){
    return 'Hay un dato demasiado grande para Firebase (más de 1 MB).';
  }
  if(codigo.indexOf('resource-exhausted') >= 0) return 'Se acabó la cuota gratis de Firebase por hoy.';
  return 'Error de Firebase: ' + (codigo || msj || 'desconocido');
}

// Borra las copias de mas de 30 dias, para no llenar el espacio de la nube
function marcarRespaldoBajado(){
  try { SS('nbs_ultimo_backup_bajado', fechaHoy()); } catch(e){}
  localStorage.setItem(CLAVE_NV_ULTIMO_RESPALDO, String((LS('nv', []) || []).length));
  localStorage.removeItem(CLAVE_SNOOZE_RESPALDO);
  ocultarAvisoRespaldo();
}

function mostrarAvisoRespaldo(){
  var mins = minutosSinRespaldar();
  var facturas = facturasSinRespaldar();

  // Si lo cerraste con la ✕, se calla 30 minutos y despues vuelve
  var snooze = parseInt(localStorage.getItem(CLAVE_SNOOZE_RESPALDO) || '0', 10);
  if(snooze && Date.now() < snooze){ ocultarAvisoRespaldo(); return; }

  // Aparece por TIEMPO -cada 30 min- o por facturas, lo que llegue primero
  if(mins < MINUTOS_ENTRE_AVISOS && facturas < FACTURAS_ENTRE_COPIAS){ ocultarAvisoRespaldo(); return; }

  // Mientras mas tiempo pase, mas se nota — para que sepas de un vistazo que tan
  // expuesto estas, sin tener que pensarlo.
  var fondo, icono;
  if(mins >= 240 || facturas >= 25){      fondo = '#B71C1C'; icono = '🚨'; }
  else if(mins >= 120 || facturas >= 15){ fondo = '#E65100'; icono = '⚠️'; }
  else {                                   fondo = '#1a237e'; icono = '💾'; }

  var texto = icono + ' ' + textoTiempo(mins);
  if(facturas > 0) texto += ' · ' + facturas + ' factura(s)';

  var a = document.getElementById('aviso-bajar-respaldo');
  if(!a){
    try{ sonidoRecordatorio(); }catch(eSonido){} // solo suena la PRIMERA vez que aparece, no cada minuto
    a = document.createElement('div');
    a.id = 'aviso-bajar-respaldo';
    a.innerHTML = '<span id="aviso-respaldo-texto" style="flex:1"></span>'
      + '<button onclick="bajarRespaldoDesdeAviso()" style="background:white;color:#1a237e;border:none;border-radius:7px;padding:6px 11px;font-size:11px;font-weight:800;cursor:pointer;flex-shrink:0">Bajar</button>'
      + '<button onclick="posponerAvisoRespaldo()" style="background:none;border:none;color:rgba(255,255,255,0.65);font-size:17px;cursor:pointer;flex-shrink:0;padding:0 4px">✕</button>';
    document.body.appendChild(a);
  }
  a.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:'+fondo+';color:white;padding:9px 12px;font-size:12px;font-weight:600;z-index:99989;display:flex;align-items:center;gap:8px;box-shadow:0 -2px 8px rgba(0,0,0,0.2)';
  var t = document.getElementById('aviso-respaldo-texto');
  if(t) t.textContent = texto;
}

// La ✕ no lo apaga para siempre: lo calla 30 minutos y despues vuelve
function posponerAvisoRespaldo(){
  localStorage.setItem(CLAVE_SNOOZE_RESPALDO, String(Date.now() + MINUTOS_ENTRE_AVISOS*60*1000));
  ocultarAvisoRespaldo();
}

// Se llama desde el boton "Bajar" del aviso. El toque del usuario es lo que Chrome exige,
// y exportD() descarga de forma sincrona -sin esperas- para no perder ese permiso.
function bajarRespaldoDesdeAviso(){
  exportD();
  marcarRespaldoBajado();
}

function ocultarAvisoRespaldo(){
  var a = document.getElementById('aviso-bajar-respaldo');
  if(a) a.style.display = 'none';
}

// Revisa cada minuto si ya toca avisar -asi el aviso aparece solo a los 30 minutos, sin
// que tengas que hacer nada ni recargar la app-
function iniciarVigilanteDeRespaldo(){
  mostrarAvisoRespaldo();
  setInterval(mostrarAvisoRespaldo, 60000);
}

// ═══════════════════════════════════════════════════════════════════════════════
//   LAS FOTOS DE LOS PRODUCTOS VAN APARTE  —  17 de julio de 2026
// ═══════════════════════════════════════════════════════════════════════════════
// EL PROBLEMA: Firebase no acepta guardar mas de 1 MB de una sola vez. Los 460 productos
// SIN fotos ocupan 100 KB (9.6%), pero con solo 30 fotos adentro llegaban a 1,018,628 bytes
// = 97.1% del limite. Con UNA foto mas, los productos dejaban de subir a la nube.
//
// LA SOLUCION: cada foto se guarda como su PROPIO archivo en la nube, no metida dentro de la
// lista de productos. Asi la lista queda en 9.6% y caben las 460 fotos que quieras.
//
// POR QUE NO SE USA FIREBASE STORAGE: verificado el 17 de julio de 2026 — desde el 3 de
// febrero de 2026, Google exige plan de pago (tarjeta de credito) para usar Storage, aunque
// no gastes nada. Firestore sigue dando 1 GB gratis sin tarjeta, y 460 fotos ocupan ~14 MB.
//
// IMPORTANTE: en el TELEFONO las fotos se siguen guardando junto a los productos, como
// siempre. Asi se siguen viendo en los pedidos aunque estes sin señal en la van.
var CLAVE_INDICE_FOTOS = 'nbs_fotos_subidas';

function quitarFirmas(ventasL){
  return (ventasL || []).map(function(v){
    if(!v.firma) return v;
    var copia = {};
    for(var k in v){ if(k !== 'firma') copia[k] = v[k]; }
    return copia;
  });
}

// Los números de las ventas que SÍ tienen firma, para saber cuáles ir a buscar.
function vidsConFirma(ventasL){
  return (ventasL || []).filter(function(v){ return v.firma; }).map(function(v){ return String(v.id); });
}

// Sube a `nbs_firmas` solo las que cambiaron, igual que hace sincronizarFotos.
function sincronizarFirmas(ventasL){
  if(typeof fbAuth === 'undefined' || !fbAuth || !fbAuth.currentUser) return;
  if(!navigator.onLine) return;
  var indice = leerIndiceFirmas();
  var pendientes = (ventasL || []).filter(function(v){
    return v.firma && indice[String(v.id)] !== huellaFoto(v.firma);
  });
  if(!pendientes.length) return;
  // De a 20 por tanda: una firma pesa ~23 KB y con señal de la calle no conviene
  // mandar cincuenta de golpe.
  pendientes.slice(0, 20).forEach(function(v){
    var huella = huellaFoto(v.firma);
    fbDb.collection('nbs_firmas').doc(String(v.id)).set({
      firma: v.firma,
      cliente: v.cn || '',
      fecha: v.fecha || '',
      hora: Date.now()
    }).then(function(){
      var i = leerIndiceFirmas();
      i[String(v.id)] = huella;
      guardarIndiceFirmas(i);
    }).catch(function(e){
      console.error('No se pudo subir la firma de la venta ' + v.id + ':', e);
    });
  });
  console.log('Subiendo ' + Math.min(pendientes.length, 20) + ' firma(s) a la nube...');
}

// Y al revés: si este teléfono bajó ventas sin firma, se van a buscar.
function sincronizarFotosClientes(cls){
  if(typeof fbAuth === 'undefined' || !fbAuth || !fbAuth.currentUser) return;
  if(!navigator.onLine) return;
  var indice = leerIndiceFotosCl();
  var pendientes = (cls || []).filter(function(c){
    return c.foto && indice[String(c.id)] !== huellaFoto(c.foto);
  });
  if(!pendientes.length) return;
  pendientes.forEach(function(c){
    var huella = huellaFoto(c.foto);
    fbDb.collection('nbs_fotos_clientes').doc(String(c.id)).set({
      foto: c.foto,
      nombre: (c.nombre||'') + ' ' + (c.apellido||''),
      hora: Date.now()
    }).then(function(){
      var i = leerIndiceFotosCl();
      i[String(c.id)] = huella;
      guardarIndiceFotosCl(i);
    }).catch(function(e){
      console.error('No se pudo subir la foto del cliente:', e);
    });
  });
}

// Baja de la nube las fotos de clientes que este teléfono no tenga

// ═══════════════════════════════════════════════════════════════════
//  TRAER CAMBIOS DE PRODUCTOS DE UN RESPALDO  (28 jul)
// ═══════════════════════════════════════════════════════════════════
//
// POR QUE EXISTE: Sensei trabaja en la PC cuando esta en la casa -pantalla grande, mas
// comodo para corregir precios y nombres- y en el telefono cuando anda en la calle. Pero
// la sincronizacion usa la regla "el mas nuevo gana", asi que el aparato que va mas
// adelante le pasa por encima al otro. El 28 de julio perdio 7 precios, 16 costos y 8
// nombres que habia corregido en la PC.
//
// ESTO ES UN PUENTE ENTRE LOS DOS APARATOS: lee un respaldo, compara SOLO los productos,
// le enseña las diferencias una por una, y aplica unicamente las que el marque.
//
// ⚠️ LO QUE NUNCA TOCA: ventas, clientes, pagos, compras, gastos, devoluciones, stock ni
// fotos. Solo NOMBRE, PRECIO y COSTO de productos. Ni una cosa mas.

var _difProd = null;

function leerRespaldoParaComparar(input){
  var file = input.files && input.files[0];
  if(!file) return;
  var fr = new FileReader();
  fr.onload = async function(ev){
    input.value = '';
    var d;
    try {
      var contenido = JSON.parse(ev.target.result);
      if(contenido && contenido.enc === true && contenido.datos){
        var pin = prompt('🔒 Ese respaldo está protegido.\nEscribe el PIN con el que se bajó:');
        if(pin === null) return;
        try {
          var llave = await derivarLlaveBackup(pin, base64ABytes(contenido.sal));
          var claro = await crypto.subtle.decrypt(
            { name:'AES-GCM', iv: base64ABytes(contenido.iv) }, llave, base64ABytes(contenido.datos));
          d = JSON.parse(new TextDecoder().decode(claro));
        } catch(e){
          avisoGrande('🔒 PIN incorrecto, o el archivo está dañado.\n\nRecuerda: cada aparato tiene su propio PIN. Si el respaldo lo bajaste de la computadora, puede tener un PIN distinto al de este teléfono.');
          return;
        }
      } else {
        d = contenido;
      }
    } catch(e){
      avisoGrande('📄 Ese archivo no se entiende. ¿Es un respaldo de NBS 2?');
      return;
    }

    if(!d || !Array.isArray(d.productos)){
      avisoGrande('📄 Ese respaldo no trae productos.');
      return;
    }
    compararProductosDelRespaldo(d.productos);
  };
  fr.onerror = function(){ avisoGrande('📄 No se pudo abrir ese archivo.'); };
  fr.readAsText(file);
}

function compararProductosDelRespaldo(delRespaldo){
  // Red de seguridad: aunque la pantalla ya comprueba que el archivo traiga productos,
  // esta funcion no debe romperse nunca si le llega algo raro -28 jul-
  if(!Array.isArray(delRespaldo) || !delRespaldo.length){
    avisoGrande('📄 Ese respaldo no trae productos que comparar.');
    return;
  }
  loadProds();
  var mios = {};
  productos.forEach(function(p){ mios[String(p.id)] = p; });

  // Las FOTOS tambien viajan en el respaldo, dentro de cada producto. Traerlas por aqui
  // es directo y de una vez — mucho mejor que ir pidiendolas a la nube una por una.
  // -28 jul, despues de que ese camino largo le costara horas a Sensei-
  var difs = { nombre: [], precio: [], costo: [], foto: [] };
  delRespaldo.forEach(function(r){
    var m = mios[String(r.id)];
    if(!m) return;                                  // producto que aqui no existe: no se toca
    if(r.foto && !m.foto){
      difs.foto.push({ id: r.id, nombre: String(m.nombre || r.nombre || ''), delArchivo: r.foto });
    }
    var nomR = String(r.nombre || '').trim();
    var nomM = String(m.nombre || '').trim();
    if(nomR && nomR !== nomM){
      difs.nombre.push({ id: r.id, mio: nomM, delArchivo: nomR,
                         marca: r.marca, nombreCorto: r.nombreCorto });
    }
    if(Math.abs(nMon(r.precio) - nMon(m.precio)) > 0.005){
      difs.precio.push({ id: r.id, nombre: nomM || nomR, mio: nMon(m.precio), delArchivo: nMon(r.precio) });
    }
    if(Math.abs(nMon(r.costo) - nMon(m.costo)) > 0.005){
      difs.costo.push({ id: r.id, nombre: nomM || nomR, mio: nMon(m.costo), delArchivo: nMon(r.costo) });
    }
  });

  var total = difs.nombre.length + difs.precio.length + difs.costo.length + difs.foto.length;
  if(!total){
    avisoGrande('✓ No hay ninguna diferencia.\n\nLos productos de ese respaldo son iguales a los de este teléfono.');
    return;
  }
  // Todas marcadas al principio; el decide cuales quitar
  ['nombre','precio','costo','foto'].forEach(function(k){
    difs[k].forEach(function(x){ x.marcado = true; });
  });
  _difProd = difs;
  pintarDiferenciasProductos();
}

function revisarFotosDeLaNube(alTerminar, alAvanzar){
  if(typeof fbAuth === 'undefined' || !fbAuth || !fbAuth.currentUser){
    if(alTerminar) alTerminar({ error: 'SIN_SESION' });
    return;
  }
  if(!navigator.onLine){
    if(alTerminar) alTerminar({ error: 'SIN_SENAL' });
    return;
  }

  // ⚠️ POR QUE ESTO RECORRE TODO Y NO SE QUEDA PEGADO:
  // La primera version pedia `faltan.slice(0, 40)` — SIEMPRE los primeros 40 de la lista.
  // Como los productos que NO tienen foto en la nube nunca salen de esa lista, cada toque
  // revisaba LOS MISMOS 40 y nunca avanzaba. Sensei se topo con eso el 28 jul: el boton
  // le decia lo mismo una y otra vez.
  // Ahora se recorre la lista ENTERA por tandas, saltando lo ya revisado, y con un tope
  // de tiempo para que nunca se quede colgado.

  loadProds();
  var tengo = {}, todos = [];
  try {
    LS('np', []).forEach(function(p){
      todos.push(String(p.id));
      if(p.foto) tengo[String(p.id)] = 1;
    });
  } catch(e){}
  try {
    (productos || []).forEach(function(p){
      if(todos.indexOf(String(p.id)) < 0) todos.push(String(p.id));
      if(p.foto) tengo[String(p.id)] = 1;
    });
  } catch(e){}

  var pendientes = todos.filter(function(pid){ return !tengo[String(pid)]; });
  if(!pendientes.length){
    if(alTerminar) alTerminar({ bajadas: 0, faltaban: 0 });
    return;
  }

  var TANDA = 40;
  var bajadas = 0, revisados = 0, fallos = 0;
  var yaTermino = false;
  var arranque = Date.now();

  function terminarUnaVez(r){
    if(yaTermino) return;
    yaTermino = true;
    clearTimeout(relojDeSeguridad);
    if(alTerminar) alTerminar(r);
  }

  // ⏱ RELOJ DE SEGURIDAD, INNEGOCIABLE. El tope de 90 segundos que se mira al empezar
  // cada tanda NO sirve si la nube se queda callada a media tanda: esa promesa nunca
  // resuelve y el letrero se queda puesto para siempre. Este reloj corre por su cuenta
  // y termina pase lo que pase. -28 jul, tras habersele colgado a Sensei-
  var relojDeSeguridad = setTimeout(function(){
    terminarUnaVez({ bajadas: bajadas, faltaban: pendientes.length, revisados: revisados,
                     fallos: fallos, incompleto: true, error: revisados === 0 ? 'TARDO' : null });
  }, 95000);

  function siguienteTanda(){
    if(yaTermino) return;
    // Tope de tiempo: 90 segundos en total, pase lo que pase
    if(Date.now() - arranque > 90000){
      terminarUnaVez({ bajadas: bajadas, faltaban: pendientes.length, revisados: revisados,
                       fallos: fallos, incompleto: true });
      return;
    }
    if(revisados >= pendientes.length){
      terminarUnaVez({ bajadas: bajadas, faltaban: pendientes.length, revisados: revisados, fallos: fallos });
      return;
    }

    var tanda = pendientes.slice(revisados, revisados + TANDA);
    if(alAvanzar) alAvanzar(revisados, pendientes.length, bajadas);

    var promesas = tanda.map(function(pid){
      return fbDb.collection('nbs_fotos').doc(String(pid)).get().then(function(d){
        if(d.exists && d.data() && d.data().foto) return { pid: String(pid), foto: d.data().foto };
        return null;
      }).catch(function(){ fallos++; return null; });
    });

    Promise.all(promesas).then(function(res){
      revisados += tanda.length;
      var buenas = res.filter(function(x){ return x; });
      if(buenas.length){
        try {
          var prods = LS('np', []);
          var mapa = {};
          buenas.forEach(function(x){ mapa[x.pid] = x.foto; });
          var cambio = false;
          prods.forEach(function(p){
            if(!p.foto && mapa[String(p.id)]){ p.foto = mapa[String(p.id)]; cambio = true; }
          });
          if(cambio){
            // SS y no localStorage: si no, las fotos bajadas de la nube volverian al
            // casillero chico y desharian la mudanza. SS devuelve si cupo. -4 ago-
            if(!SS('np', prods)){
              terminarUnaVez({ bajadas: bajadas, faltaban: pendientes.length, revisados: revisados,
                               fallos: fallos, sinEspacio: true });
              return;
            }
            bajadas += buenas.length;
            try {
              var idx = leerIndiceFotos();
              buenas.forEach(function(x){ idx[x.pid] = huellaFoto(x.foto); });
              guardarIndiceFotos(idx);
            } catch(e){}
            if(typeof productos !== 'undefined') productos = prods;
          }
        } catch(e){
          // Si no se pudo guardar -memoria llena- se para aqui y se avisa
          terminarUnaVez({ bajadas: bajadas, faltaban: pendientes.length, revisados: revisados,
                           fallos: fallos, sinEspacio: true });
          return;
        }
      }
      setTimeout(siguienteTanda, 120);   // respiro entre tandas
    });
  }

  siguienteTanda();
}

// El boton de "bajar las fotos que me falten", para forzarlo cuando quiera
function borrarFotoClienteNube(cid){
  if(typeof fbAuth === 'undefined' || !fbAuth || !fbAuth.currentUser) return;
  if(!navigator.onLine) return;
  fbDb.collection('nbs_fotos_clientes').doc(String(cid)).delete().catch(function(){});
  var i = leerIndiceFotosCl();
  delete i[String(cid)];
  guardarIndiceFotosCl(i);
}

// Devuelve una copia de los clientes SIN las fotos (para subir a la nube sin llenar el documento)
function sincronizarFotos(prods){
  if(typeof fbAuth === 'undefined' || !fbAuth || !fbAuth.currentUser) return;
  if(!navigator.onLine) return;
  var indice = leerIndiceFotos();
  var pendientes = (prods || []).filter(function(p){
    return p.foto && indice[String(p.id)] !== huellaFoto(p.foto);
  });
  if(!pendientes.length) return;
  pendientes.forEach(function(p){
    var huella = huellaFoto(p.foto);
    fbDb.collection('nbs_fotos').doc(String(p.id)).set({
      foto: p.foto,
      nombre: p.nombre || '',
      hora: Date.now()
    }).then(function(){
      var i = leerIndiceFotos();
      i[String(p.id)] = huella;
      guardarIndiceFotos(i);
    }).catch(function(e){
      console.error('No se pudo subir la foto de "'+(p.nombre||p.id)+'":', e);
    });
  });
  console.log('Subiendo '+pendientes.length+' foto(s) a la nube...');
}

// Cuando la nube manda los productos SIN fotos, se les vuelven a pegar las que ya tiene
// este telefono -para no perderlas de vista-.
// Lo mismo que pegarFotosQueYaTengo, pero para las firmas. La nube manda las ventas
// sin firma; las que este telefono ya tenia se le vuelven a pegar para no perderlas,
// y las que falten se bajan aparte. -28 ago-
function pegarFirmasQueYaTengo(ventasDeLaNube){
  var firmas = {};
  try{
    var local = LS('nv', []);
    local.forEach(function(v){ if(v.firma) firmas[String(v.id)] = v.firma; });
  }catch(e){}
  (ventasDeLaNube || []).forEach(function(v){
    if(!v.firma && firmas[String(v.id)]) v.firma = firmas[String(v.id)];
  });
  return ventasDeLaNube;
}

function fundirConLoDelTelefono(clave, textoDeLaNube){
  var crudoLocal = localStorage.getItem(clave);
  if(crudoLocal === null) return null;                 // aqui no hay nada: que baje tal cual
  var nube, local;
  try { nube = JSON.parse(textoDeLaNube); } catch(e){ return null; }
  try { local = JSON.parse(crudoLocal); } catch(e){ return null; }

  if(esListaDeRegistros(clave))       return JSON.stringify(fundirListas(clave, nube, local));
  // Las libretas de borrados SOLO CRECEN: se unen sin repetir, jamas se pisan.
  // Si se reemplazaran, lo que Sensei borro en un aparato resucitaria al juntarse
  // con el otro. -30 jul, tras pasarle de verdad-
  if(clave.indexOf('_borrados_') === 0) return JSON.stringify(fundirBorrados(nube, local));
  if(CLAVES_CUADERNO.indexOf(clave) >= 0) return JSON.stringify(fundirCuaderno(nube, local));
  if(CLAVES_MAPA.indexOf(clave) >= 0)     return JSON.stringify(fundirMapa(nube, local));
  return null;
}

function cargarCopiasDeLaNube(){
  var lista = document.getElementById('copias-lista');
  lista.innerHTML = '<div class="card" style="text-align:center;color:#bbb;font-size:13px;padding:18px">Buscando tus copias en la nube...</div>';

  if(typeof fbAuth === 'undefined' || !fbAuth || !fbAuth.currentUser){
    lista.innerHTML = '<div class="card" style="text-align:center;color:#c0392b;font-size:13px;padding:18px">Necesitas iniciar sesión para ver tus copias.</div>';
    return;
  }

  listarCopias().then(function(copias){
    if(!copias.length){
      lista.innerHTML = '<div class="card" style="text-align:center;color:#bbb;font-size:13px;padding:18px">Todavía no hay copias guardadas.<br><br>La primera se hace sola a los pocos segundos de abrir la app, o puedes hacer una ahora con el botón de arriba.</div>';
      return;
    }
    var html = '<div style="font-size:11px;color:var(--nbs-muted);font-weight:700;margin:4px 0 8px">TUS COPIAS ('+copias.length+')</div>';
    copias.forEach(function(c){
      var d = c.datos;
      var cn = d.conteo || {};
      var cuando = new Date(d.hora || 0);
      var hoy = new Date();
      var esHoy = cuando.toDateString() === hoy.toDateString();
      var ayer = new Date(hoy); ayer.setDate(hoy.getDate()-1);
      var esAyer = cuando.toDateString() === ayer.toDateString();
      var etiqueta = esHoy ? 'HOY' : (esAyer ? 'AYER' : (d.fecha || ''));
      html += '<div class="card" style="margin-bottom:8px;padding:12px">'
        +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:7px">'
        +'<div>'
        +'<div style="font-size:14px;font-weight:800;color:var(--nbs-ink)">'+etiqueta+' · '+(d.horaTexto||'')+'</div>'
        +'<div style="font-size:11px;color:var(--nbs-muted);margin-top:2px">'+(d.automatica ? 'Automática' : 'La hiciste tú')+(d.cambios ? ' · guardó '+d.cambios+(d.cambios===1?' cambio':' cambios') : '')+'</div>'
        +'</div>'
        +'<button onclick="pedirRestaurar(\''+c.id+'\')" style="background:var(--nbs-gold-bg);color:var(--nbs-gold-dark);border:1px solid var(--nbs-gold);border-radius:8px;padding:8px 13px;font-size:12px;font-weight:700;cursor:pointer">🔄 Restaurar</button>'
        +'</div>'
        +'<div style="font-size:11px;color:#888;background:#FAFAFA;border-radius:7px;padding:7px 9px">'
        +'📋 '+(cn.nv||0)+' ventas · 👥 '+(cn.ncl||0)+' clientes · 📦 '+(cn.np||0)+' productos · 🧾 '+(cn.nc||0)+' compras'
        +'</div></div>';
    });
    lista.innerHTML = html;
  }).catch(function(e){
    console.error(e);
    var razon = traducirErrorFirebase(e);
    lista.innerHTML = '<div class="card" style="border:1px solid #E57373;background:#FFF5F5;padding:14px">'
      +'<div style="font-size:13px;font-weight:800;color:#c0392b;margin-bottom:6px">❌ No se pudieron leer las copias</div>'
      +'<div style="font-size:12px;color:#666;line-height:1.5;white-space:pre-line">'+escaparHtml(razon)+'</div>'
      +'</div>';
  });
}

// ═══ PRUEBA DE VERDAD CONTRA TU FIREBASE REAL ═══
// Claude no puede probar contra tu Firebase -su entorno no tiene internet, asi que simula
// Firebase y su simulacion siempre dice que si-. Por eso no detecto que las reglas estaban
// bloqueando nbs_copias y nbs_fotos el 17 de julio de 2026.
// Esta prueba corre en TU telefono, contra TU Firebase de verdad: escribe algo, lo lee de
// vuelta, y lo borra. Si algo falla, dice exactamente que y por que.
function diagnosticarNube(){
  var el = document.getElementById('diag-resultado');
  el.style.display = 'block';
  el.textContent = 'Probando...';
  var lineas = [];

  function probarColeccion(nombre, paraQue){
    var idPrueba = '__prueba__' + Date.now();
    var textoPrueba = 'prueba-' + Date.now();
    return fbDb.collection(nombre).doc(idPrueba).set({ prueba: textoPrueba, hora: Date.now() })
      .then(function(){
        // No basta con escribir: hay que LEERLO DE VUELTA para saber que de verdad quedo
        return fbDb.collection(nombre).doc(idPrueba).get();
      })
      .then(function(d){
        var ok = d.exists && d.data() && d.data().prueba === textoPrueba;
        return fbDb.collection(nombre).doc(idPrueba).delete().catch(function(){}).then(function(){
          return ok ? { ok: true } : { ok: false, razon: 'Se escribió pero al leerlo de vuelta no estaba' };
        });
      })
      .catch(function(e){
        return { ok: false, razon: traducirErrorFirebase(e).split('\n')[0] };
      });
  }

  lineas.push('SESIÓN: ' + (fbAuth.currentUser ? '✓ ' + fbAuth.currentUser.email : '✗ sin sesión'));
  lineas.push('INTERNET: ' + (navigator.onLine ? '✓ conectado' : '✗ sin conexión'));
  lineas.push('');
  el.textContent = lineas.join('\n') + '\nProbando las carpetas...';

  if(!fbAuth.currentUser || !navigator.onLine){
    el.textContent = lineas.join('\n') + '\n\nNo se puede probar sin sesión e internet.';
    return;
  }

  var carpetas = [
    ['nbs_data', 'tus datos'],
    ['nbs_copias', 'las copias de seguridad'],
    ['nbs_fotos', 'las fotos de productos']
  ];

  Promise.all(carpetas.map(function(c){ return probarColeccion(c[0], c[1]); })).then(function(res){
    var fallan = [];
    res.forEach(function(r, i){
      var nom = carpetas[i][0], paraQue = carpetas[i][1];
      if(r.ok){
        lineas.push('✓ ' + nom + '  (' + paraQue + ')');
      } else {
        lineas.push('✗ ' + nom + '  (' + paraQue + ')');
        lineas.push('     ' + r.razon);
        fallan.push(nom);
      }
    });
    lineas.push('');
    if(!fallan.length){
      lineas.push('✅ TODO FUNCIONA.');
      lineas.push('Se escribió y se volvió a leer en las 3 carpetas.');
    } else {
      lineas.push('❌ FALLAN: ' + fallan.join(', '));
      lineas.push('');
      lineas.push('Si dice que Firebase bloquea el acceso, hay que');
      lineas.push('actualizar las REGLAS en la consola de Firebase:');
      lineas.push('Firestore → Reglas → pegar la regla nueva → Publicar.');
      lineas.push('');
      lineas.push('NO es tu internet.');
    }
    el.textContent = lineas.join('\n');
  });
}

function respaldoDesdeInicio(){
  exportD();
  marcarRespaldoBajado();
  setTimeout(renderInicio, 400);
}


// ═══════════════════════════════════════════════════════════════════
//  ⚡ LAS SUGERENCIAS, DETRÁS DE UN BOTÓN  (15 ago 2026)
//
//  🔑 SENSEI: "en pedidos rápidos el cuadro para cada cliente se hizo muy
//  grande agregando lo que más se está vendiendo... creo que eso deberías
//  quitarlo y ponerlo en un lugar que yo pueda tocar un botón y que se
//  abra en la misma pantalla".
//
//  ⚠️ NO SE QUITA, SE ESCONDE. Se midieron sus datos: lo que un cliente
//  ya compró antes solo cubre el 20% de lo que va a pedir hoy. Quitar
//  "lo que más vendes" le costaría aciertos. Detrás del botón se tiene
//  todo sin que el cuadro estorbe.
// ═══════════════════════════════════════════════════════════════════
var _sugerenciasAbiertas = {};

function base64ABytes(b64){ var bin=atob(b64); var bytes=new Uint8Array(bin.length); for(var i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i); return bytes; }

async function exportD(){
  loadProds();
  ventas = LS('nv', []);
  clientes = LS('ncl', []);
  compras = LS('nc', []);
  creditos = LS('ncr', []);
  suplidores = LS('nsup', []);
  var gastos = LS('ngastos', []);
  var tarjetas = LS('ntarjetas', []);
  var otrasDeudas = LS('notrasdeudas', []);
  var pedidos = LS('npedidos', []);
  var devoluciones = LS('ndevoluciones', []);
  var productosEliminados = LS('np_eliminados', []);
  var visitasBarberos = LS('nvisitas_barberos', {});
  // 🧮 LOS CUADRES DE CAJA. Van en el backup para que no los pierda. -17 ago-
  var cuadres = LS('nbs_cuadres', []);
  var cuadreFondo = LS('nbs_cuadre_fondo', 0);
  // ── RUTAS (agregado 23 jul 2026) ──
  // Antes las rutas NO iban en el respaldo, por eso al pasar el backup de la app
  // vieja a la nueva quedaron VACIAS. Ahora se guarda el orden de cada dia y
  // TODAS las visitas marcadas, con su hora.
  var rutasPorDia = LS('rutas_por_dia', {});
  var visitasRuta = {};
  try{
    for(var kR in localStorage){
      if(localStorage.hasOwnProperty(kR) && kR.indexOf('visitas_') === 0){
        visitasRuta[kR] = LS(kR, []);
      }
    }
  }catch(eR){}
  var d = {v:2, productos:productos, ventas:ventas, compras:compras, creditos:creditos, clientes:clientes, suplidores:suplidores, gastos:gastos,
    tarjetas:tarjetas, otrasDeudas:otrasDeudas, pedidos:pedidos, devoluciones:devoluciones, productosEliminados:productosEliminados,
    visitasBarberos:visitasBarberos, rutasPorDia:rutasPorDia, visitasRuta:visitasRuta,
    cuadres:cuadres, cuadreFondo:cuadreFondo,
    // Faltaban en el respaldo descargable -encontrado en la auditoria del 27 jul-. El
    // respaldo de la nube si las llevaba, pero este no: si Sensei restauraba desde el
    // archivo perdia el historial de precios, lo cargado en la van y la lista de relleno.
    historialPrecios: LS('historial_precios', []),
    van: LS('nvan', null),
    listaRelleno: LS('nrelleno', null),
    // Lo que APRENDIO el lector de facturas: que producto suyo es cada linea de cada
    // suplidor. Es trabajo de Sensei, uno por uno; sin esto, al perder el telefono
    // habria que empezar de cero con cada suplidor -agregado 28 jul-.
    facturasEmparejadas: LS(CLAVE_EMPAREJADOS, {}),
    // El rastro de las correcciones del conteo de la van -29 jul-
    correccionesVan: LS('nbs_correcciones_van', []),
    // La impresora: la lista y cuál estaba activa. Asi no hay que configurarla otra vez
    // si cambia de telefono. -30 jul, hallazgo de la auditoria-
    impresoras: LS('impresoras_lista', []),
    impresoraActiva: LS('printer_config', null)};
  var json = JSON.stringify(d);

  // Cifrar antes de guardar, con la misma clave del PIN de administrador.
  var salBytes = crypto.getRandomValues(new Uint8Array(16));
  var ivBytes = crypto.getRandomValues(new Uint8Array(12));
  var jsonFinal;
  try{
    var llave = await derivarLlaveBackup(PIN_ADMIN, salBytes);
    var datosCifrados = await crypto.subtle.encrypt({name:'AES-GCM', iv:ivBytes}, llave, new TextEncoder().encode(json));
    var sobre = {app:'NBS2Backup', v:1, enc:true, fecha:fechaHoy(), sal:bytesABase64(salBytes), iv:bytesABase64(ivBytes), datos:bytesABase64(new Uint8Array(datosCifrados))};
    jsonFinal = JSON.stringify(sobre);
  }catch(eCifrado){
    // Si el telefono no soporta cifrado -muy raro-, se avisa y se manda SIN cifrar para no perder el respaldo.
    console.error('No se pudo cifrar el respaldo:', eCifrado);
    alert('⚠️ Este respaldo se guardó SIN cifrar porque tu navegador no lo permitió. Guárdalo en un lugar seguro.');
    jsonFinal = json;
  }

  // Registrar fecha del backup
  localStorage.setItem('ultimoBackup', new Date().getTime().toString());
  // Reiniciar el contador del aviso: si bajaste el respaldo por tu cuenta -desde el menu-,
  // el aviso tiene que enterarse igual y volver a cero.
  try{
    localStorage.setItem('nbs_nv_al_bajar_respaldo', String((LS('nv', []) || []).length));
    if(typeof ocultarAvisoRespaldo === 'function') ocultarAvisoRespaldo();
  }catch(e){}

  // Descarga real - funciona en Chrome/GitHub Pages
  var blob = new Blob([jsonFinal], {type:'application/json'});
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'NBS2_backup_' + fechaHoy().replace(/\//g,'-') + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function mostrarBackupTexto(json){
  var overlay = document.getElementById('backup-texto-overlay');
  if(!overlay){
    overlay = document.createElement('div');
    overlay.id = 'backup-texto-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:white;z-index:99999;overflow-y:auto;padding:16px';
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = '<div style="max-width:600px;margin:0 auto">'
    +'<div style="background:#1a237e;color:white;padding:16px;border-radius:8px;margin-bottom:16px;text-align:center">'
    +'<div style="font-size:18px;font-weight:800">💾 Backup de Datos</div>'
    +'<div style="font-size:12px;opacity:0.8;margin-top:4px">'+fechaHoy()+'</div>'
    +'</div>'
    +'<div style="background:#E8F5E9;border-radius:8px;padding:12px;margin-bottom:12px">'
    +'<div style="font-size:13px;color:#2E7D32;font-weight:700;margin-bottom:8px">📋 Instrucciones:</div>'
    +'<div style="font-size:12px;color:#555;line-height:1.6">'
    +'1. Mantén presionado el texto de abajo<br>'
    +'2. Selecciona "Seleccionar todo"<br>'
    +'3. Copia el texto<br>'
    +'4. Pégalo en un email o nota y guárdalo'
    +'</div></div>'
    +'<textarea id="backup-json-text" style="width:100%;height:200px;font-size:11px;padding:8px;border:1px solid #ddd;border-radius:8px;font-family:monospace;resize:none" readonly>'+json+'</textarea>'
    +'<div style="display:flex;gap:8px;margin-top:12px">'
    +'<button onclick="copiarBackup()" style="flex:1;padding:12px;background:#1565C0;color:white;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer">📋 Copiar</button>'
    +'<button onclick="emailBackup()" style="flex:1;padding:12px;background:#2E7D32;color:white;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer">📧 Email</button>'
    +'<button onclick="document.getElementById(\'backup-texto-overlay\').style.display=\'none\'" style="flex:1;padding:12px;background:#546E7A;color:white;border:none;border-radius:8px;font-size:14px;cursor:pointer">← Cerrar</button>'
    +'</div>'
    +'<div style="font-size:11px;color:#aaa;text-align:center;margin-top:8px">Guarda este texto en un lugar seguro para poder restaurar tus datos</div>'
    +'</div>';
  overlay.style.display = 'block'; overlay.scrollTop = 0;
}

function emailBackup(){
  var txt = document.getElementById('backup-json-text');
  var fecha = fechaHoy();
  var subject = 'NBS Backup ' + fecha;
  var body = 'Backup de Nunez Beauty Supply - ' + fecha + '\n\n' + txt.value;
  window.location.href = 'mailto:?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
}

function copiarBackup(){
  var txt = document.getElementById('backup-json-text');
  txt.select();
  try {
    navigator.clipboard.writeText(txt.value).then(function(){
      alert('✅ Texto copiado. Pégalo en un email o nota para guardarlo.');
    }).catch(function(){
      document.execCommand('copy');
      alert('✅ Texto copiado.');
    });
  } catch(e){
    document.execCommand('copy');
    alert('✅ Texto copiado. Pégalo en un email o nota para guardarlo.');
  }
}


function importD(inp){
  var file=inp.files[0];if(!file)return;
  var fr=new FileReader();
  fr.onload=async function(e){
    try{
      var contenido = JSON.parse(e.target.result);
      var d;
      if(contenido && contenido.enc === true && contenido.datos){
        // Respaldo cifrado (24 jul en adelante): pedir el PIN para poder abrirlo.
        var pinBackup = prompt('🔒 Este respaldo está protegido.\nEscribe el PIN de administrador para abrirlo:');
        if(pinBackup === null){ inp.value=''; return; }
        try{
          var salBytes = base64ABytes(contenido.sal);
          var ivBytes = base64ABytes(contenido.iv);
          var llave = await derivarLlaveBackup(pinBackup, salBytes);
          var datosBytes = base64ABytes(contenido.datos);
          var descifrado = await crypto.subtle.decrypt({name:'AES-GCM', iv:ivBytes}, llave, datosBytes);
          d = JSON.parse(new TextDecoder().decode(descifrado));
        }catch(errDescifrar){
          alert('❌ PIN incorrecto, o el archivo está dañado.\n\nNo se pudo abrir el respaldo.');
          inp.value='';
          return;
        }
      } else {
        // Respaldo viejo, de antes del cifrado -sigue funcionando igual que siempre-.
        d = contenido;
      }
      if(!confirm('Importar datos? Esto reemplaza todo lo actual.'))return;
      // Limpiar los nombres que vienen en el respaldo: si el archivo es viejo -de antes de que
      // existiera la limpieza al guardar- o fue manipulado, aqui se neutraliza cualquier codigo
      // antes de que entre a la app. Es la puerta por donde podrian entrar datos sucios.
      var limpiarCampos = function(lista, campos){
        if(!Array.isArray(lista)) return;
        lista.forEach(function(o){
          if(!o) return;
          campos.forEach(function(campo){
            if(typeof o[campo] === 'string') o[campo] = limpiarTexto(o[campo]);
          });
        });
      };
      limpiarCampos(d.clientes, ['nombre','apellido','negocio','contacto','contactoApodo','dir','ciudad','nota']);
      limpiarCampos(d.productos, ['nombre','nombreCorto','marca','cat','desc']);
      limpiarCampos(d.suplidores, ['nombre','contacto','nota']);
      if(Array.isArray(d.ventas)) d.ventas.forEach(function(v){
        if(v && typeof v.cn === 'string') v.cn = limpiarTexto(v.cn);
        limpiarCampos(v && v.items, ['nombre']);
      });
      if(Array.isArray(d.pedidos)) d.pedidos.forEach(function(p){
        if(p && typeof p.nombre === 'string') p.nombre = limpiarTexto(p.nombre);
        if(p && typeof p.barberia === 'string') p.barberia = limpiarTexto(p.barberia);
        limpiarCampos(p && p.items, ['nombre']);
      });
      limpiarCampos(d.tarjetas, ['nombre','banco']);
      limpiarCampos(d.otrasDeudas, ['descripcion','nota']);
      if(d.clientes){clientes=d.clientes;SS('ncl',clientes);}
      if(d.ventas){ventas=d.ventas;SS('nv',ventas);}
      if(d.compras){compras=d.compras;SS('nc',compras);}
      if(d.creditos){creditos=d.creditos;SS('ncr',creditos);}
      if(d.productos){productos=d.productos;SS('np',productos);}
      if(d.suplidores){suplidores=d.suplidores;SS('nsup',suplidores);}
      if(d.gastos){SS('ngastos',d.gastos);}
      if(d.tarjetas){SS('ntarjetas',d.tarjetas);}
      if(d.otrasDeudas){SS('notrasdeudas',d.otrasDeudas);}
      if(d.pedidos){SS('npedidos',d.pedidos);}
      if(d.devoluciones){SS('ndevoluciones',d.devoluciones);}
      if(d.productosEliminados){SS('np_eliminados',d.productosEliminados);}
      if(d.visitasBarberos){SS('nvisitas_barberos',d.visitasBarberos);}
      // 🧮 LOS CUADRES DE CAJA (17 ago)
      if(d.cuadres){ SS('nbs_cuadres', d.cuadres); }
      if(d.cuadreFondo !== undefined && d.cuadreFondo !== null){ SS('nbs_cuadre_fondo', d.cuadreFondo); }
      // ── RUTAS (23 jul) ──
      if(d.rutasPorDia){ SS('rutas_por_dia', d.rutasPorDia); }
      if(d.historialPrecios){ SS('historial_precios', d.historialPrecios); }
      if(d.van){ SS('nvan', d.van); }
      if(d.listaRelleno){ SS('nrelleno', d.listaRelleno); }
      if(d.facturasEmparejadas){ SS(CLAVE_EMPAREJADOS, d.facturasEmparejadas); }
      if(d.correccionesVan){ SS('nbs_correcciones_van', d.correccionesVan); }
      if(d.impresoras){ SS('impresoras_lista', d.impresoras); }
      if(d.impresoraActiva){ SS('printer_config', d.impresoraActiva); }
      if(d.visitasRuta){
        for(var kV in d.visitasRuta){
          if(d.visitasRuta.hasOwnProperty(kV)) SS(kV, d.visitasRuta[kV]);
        }
      }
      avisoGrande('Datos importados correctamente', function(){ ir('p-ped'); });
    }catch(err){alert('Error al importar');}
    inp.value='';
  };fr.readAsText(file);
}

function base64ABuffer(base64){
  var binario = atob(base64);
  var bytes = new Uint8Array(binario.length);
  for(var i=0; i<binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes.buffer;
}
function cargarDatosDeLaNube(callback){
  var yaSeLlamoElCallback = false;
  var llamarUnaSolaVez = function(){
    if(yaSeLlamoElCallback) return;
    yaSeLlamoElCallback = true;
    callback();
  };
  // Mismo limite de tiempo de espera aqui: si bajar los datos de la nube tarda mas de
  // 15 segundos -sin internet, problema de permisos, etc-, se sigue adelante con lo que
  // ya haya guardado en este telefono, en vez de quedarse trabado para siempre.
  var temporizador = setTimeout(function(){
    console.error('Se agoto el tiempo esperando los datos de la nube, se sigue con lo que haya guardado en este dispositivo.');
    llamarUnaSolaVez();
  }, 15000);
  fbDb.collection('nbs_data').get().then(function(snapshot){
    clearTimeout(temporizador);
    var bajados = 0, protegidos = 0, juntados = 0;
    var clavesQueCambiaron = [], protegidosLista = [];
    // Primero se REGISTRAN todas las libretas de borrados de esta tanda, y ademas se
    // ordenan para que se apliquen antes. Dos redes: si una fallara, la otra sostiene.
    // Sin esto, un registro que Sensei borro en un aparato resucitaba en el otro. -30 jul-
    var docsOrdenados = [];
    var tandaBorrados = {};
    snapshot.forEach(function(doc){
      docsOrdenados.push(doc);
      if(String(doc.id).indexOf('_borrados_') === 0){
        var d = doc.data();
        if(d && typeof d.valor === 'string') tandaBorrados[doc.id] = d.valor;
      }
    });
    try { prepararBorradosDeLaTanda(tandaBorrados); } catch(e){ console.error(e); }
    docsOrdenados.sort(function(a, b){
      var ea = String(a.id).indexOf('_borrados_') === 0 ? 0 : 1;
      var eb = String(b.id).indexOf('_borrados_') === 0 ? 0 : 1;
      return ea - eb;
    });

    // Se prepara la lista: cada documento con su TEXTO ya listo. Los que vengan
    // comprimidos (campo `zip`) se descomprimen primero; los de siempre (campo `valor`)
    // pasan tal cual, sin tocar nada de su camino. -30 jul-
    var listos = [];
    var esperas = [];
    docsOrdenados.forEach(function(doc){
      var data = doc.data();
      if(!data) return;
      if(typeof data.valor === 'string'){
        listos.push({ doc: doc, data: data, texto: data.valor });
      } else if(typeof data.zip === 'string'){
        esperas.push(
          descomprimirTexto(data.zip).then(function(txt){
            if(typeof txt === 'string') listos.push({ doc: doc, data: data, texto: txt });
            else console.error('No se pudo descomprimir "' + doc.id + '"');
          }).catch(function(e){
            console.error('No se pudo descomprimir "' + doc.id + '":', e);
          })
        );
      }
    });

    return Promise.all(esperas).then(function(){
    // Las libretas de borrados, primero — y con el texto ya descomprimido
    listos.sort(function(a, b){
      var ea = String(a.doc.id).indexOf('_borrados_') === 0 ? 0 : 1;
      var eb = String(b.doc.id).indexOf('_borrados_') === 0 ? 0 : 1;
      return ea - eb;
    });
    var tandaB = {};
    listos.forEach(function(x){
      if(String(x.doc.id).indexOf('_borrados_') === 0) tandaB[x.doc.id] = x.texto;
    });
    try { prepararBorradosDeLaTanda(tandaB); } catch(e){ console.error(e); }

    listos.forEach(function(item){
      var doc = item.doc;
      var data = item.data;
      var _valorDelDoc = item.texto;

      // ===== LA PROTECCION QUE FALTABA =====
      // ANTES esta linea sobreescribia el telefono con la nube SIEMPRE, sin mirar cual era
      // mas nueva. Si trabajabas sin señal, tus ventas se guardaban solo en el telefono; al
      // volver la señal y abrir la app, la nube -vieja- les pasaba por encima y desaparecian.
      // Asi se perdio un dia completo de ventas el 16 de julio de 2026.
      // AHORA: solo se acepta lo de la nube si de verdad es MAS NUEVO que lo del telefono.
      var horaNube = data.actualizado || 0;
      var horaTelefono = horaLocalDe(doc.id);
      var hayAlgoLocal = localStorage.getItem(doc.id) !== null;

      // 🔑 LAS LISTAS QUE SABEN JUNTARSE NO SE PROTEGEN ENTERAS. Si este aparato tiene
      // la lista más nueva, antes se saltaba la nube COMPLETA — y los registros que solo
      // estaban en el otro aparato no bajaban nunca. A Sensei le faltaron 57 productos
      // en la PC por esto. Ahora se juntan registro por registro. -15 sep-
      var _seJunta = false;
      try {
        _seJunta = esListaDeRegistros(doc.id)
          || String(doc.id).indexOf('_borrados_') === 0
          || CLAVES_CUADERNO.indexOf(doc.id) >= 0
          || CLAVES_MAPA.indexOf(doc.id) >= 0;
      } catch(e){ _seJunta = false; }

      if(hayAlgoLocal && horaTelefono > horaNube && !_seJunta){
        protegidos++;
        protegidosLista.push(doc.id);
        console.log('PROTEGIDO: "'+doc.id+'" en este teléfono es más nuevo que en la nube. No se toca.');
        // Y como lo del telefono es mas nuevo, hay que subirlo -la nube esta atrasada-
        marcarPendienteDeSubir(doc.id);
        return;
      }
      // Si se junta y este aparato va por delante, se juntará igual y luego se sube
      if(hayAlgoLocal && horaTelefono > horaNube && _seJunta){
        marcarPendienteDeSubir(doc.id);
      }

      try{
        var valorFinal = _valorDelDoc;
        // Los productos bajan SIN fotos. Se les vuelven a pegar las que este telefono ya
        // tiene, y en segundo plano se bajan las que falten.
        if(doc.id === 'np'){
          try{
            var prods = pegarFotosQueYaTengo(JSON.parse(_valorDelDoc));
            valorFinal = JSON.stringify(prods);
            if(data.pidsConFoto) setTimeout(function(){ descargarFotosQueFaltan(data.pidsConFoto); }, 3000);
          }catch(e){ console.error('No se pudieron pegar las fotos:', e); }
        }
        // \u270d\ufe0f LAS VENTAS: se les vuelven a pegar las firmas que este telefono ya tenia,
        // y las que falten se bajan de `nbs_firmas` en segundo plano. -28 ago-
        if(doc.id === 'nv'){
          try{
            var vtas = pegarFirmasQueYaTengo(JSON.parse(_valorDelDoc));
            valorFinal = JSON.stringify(vtas);
            if(data.vidsConFirma) setTimeout(function(){ descargarFirmasQueFaltan(data.vidsConFirma); }, 3500);
          }catch(e){ console.error('No se pudieron pegar las firmas:', e); }
        }
        if(doc.id === 'ncl'){
          // Bajar las fotos de clientes que falten (van aparte, en su propia colección)
          setTimeout(function(){ descargarFotosClientesQueFaltan(); }, 4000);
        }
        // ═══ AQUI ESTABA LA PERDIDA (arreglado el 29 jul) ═══
        // Antes esta linea reemplazaba la LISTA ENTERA con la de la nube. Ahora se
        // JUNTAN registro por registro: gana el que se modifico despues, y lo que
        // se borro no resucita. Si por lo que sea no se puede juntar, se hace lo de
        // siempre -reemplazar-, que es como funcionaba hasta hoy.
        var loQueHabia = localStorage.getItem(doc.id);
        var fundido = null;
        try { fundido = fundirConLoDelTelefono(doc.id, valorFinal); }
        catch(eFundir){ console.error('No se pudo juntar "'+doc.id+'":', eFundir); }
        var loQueQueda = (fundido !== null) ? fundido : valorFinal;
        localStorage.setItem(doc.id, loQueQueda);
        if(fundido !== null) juntados++;
        // Solo si el resultado es DISTINTO de lo que este telefono ya tenia, hay algo
        // nuevo que subir. Si quedo igual, la nube ya lo tiene y no hay que molestar.
        if(loQueQueda !== loQueHabia) clavesQueCambiaron.push(doc.id);

        // Se anota la hora de la nube como la hora de este dato, para no confundir despues
        localStorage.setItem('_hora_'+doc.id, String(horaNube));
        bajados++;
      }catch(e){}
    });
    _borradosDeEstaBajada = {};   // se limpia: era de ESTA tanda, no de la siguiente
    if(juntados > 0) console.log(juntados+' dato(s) se JUNTARON registro por registro con lo de este telefono.');
    if(protegidos > 0){
      console.log(protegidos+' dato(s) de este teléfono se protegieron de ser sobrescritos por la nube.');
    }
    // Solo se marcan para subir las claves que DE VERDAD cambiaron al juntarse — no
    // todas. Marcarlas todas hacia que cada arranque enseñara "16 cambios sin guardar"
    // aunque no hubiera pasado nada, y eso asustaba a Sensei sin razon. -30 jul-
    if(clavesQueCambiaron.length){
      clavesQueCambiaron.forEach(function(k){ marcarPendienteDeSubir(k); });
      console.log('Se van a subir ' + clavesQueCambiaron.length + ' clave(s) que cambiaron al juntarse.');
      setTimeout(subirPendientes, 1500);
    } else if(protegidos > 0){
      // Nada cambio al juntar, pero este telefono tiene datos que la nube no: se suben
      protegidosLista.forEach(function(k){ marcarPendienteDeSubir(k); });
      setTimeout(subirPendientes, 1500);
    }
    llamarUnaSolaVez();
    });   // cierra el Promise.all de las descompresiones
  }).catch(function(e){
    clearTimeout(temporizador);
    console.error('No se pudieron cargar los datos de la nube, se sigue con lo que haya guardado en este dispositivo:', e);
    llamarUnaSolaVez(); // no bloquear el uso de la app aunque falle la nube
  });
}

// Reintenta subir a la nube todo lo que quedo pendiente -por ejemplo, lo que registraste
// sin señal en la ruta-. Se llama sola al volver el internet y cada 2 minutos.

// ═══ PROBAR LA NUBE, PIEZA POR PIEZA (30 jul) ═══
// Sensei descubrio que llevaba dias sin copias en la nube y la app no le decia nada.
// Esto prueba a escribir CADA clave por separado y le dice exactamente cual falla y
// por que, para no andar adivinando con las reglas de Firebase.
// ═══ REINTENTAR Y DECIR EL ERROR DE VERDAD (30 jul) ═══
// Se llevaban horas adivinando por que 16 cambios no subian: la prueba con documentos
// falsos decia que todo estaba bien, porque escribia datos de mentira en documentos de
// mentira. Esto reintenta la subida DE VERDAD y enseña el error exacto de cada pieza.
// Al tocar el letrero de la version. Le dice lo que tiene y, si el telefono le esta dando
// una copia vieja, como forzar la nueva. -19 ago-
// Pone la version en los dos letreros. Se llama nada mas cargar el archivo -sin esperar
// al login- y otra vez en el arranque, por si acaso. -19 ago-
function probarLaNubePiezaPorPieza(){
  if(typeof fbAuth === 'undefined' || !fbAuth || !fbAuth.currentUser){
    avisoGrande('Primero entra con tu correo y clave.'); return;
  }
  if(!navigator.onLine){ avisoGrande('No hay internet. Conéctate y prueba otra vez.'); return; }

  // ⚠️ SE PRUEBAN LAS DOS PUERTAS. La primera version solo probaba `nbs_copias` y decia
  // que todo estaba bien, cuando lo que le fallaba a Sensei eran los cambios pendientes,
  // que van a `nbs_data`. Probar la puerta equivocada es peor que no probar. -30 jul-
  mostrarCargandoRuta('☁️ Probando las dos puertas de la nube...');
  var marca = 'prueba_' + Date.now();
  var res = { nbs_copias: { ok: [], mal: [] }, nbs_data: { ok: [], mal: [] } };
  var claves = CLAVES_A_RESPALDAR.filter(function(k){ return localStorage.getItem(k) !== null; });

  function probarEn(coleccion, k){
    var id = (coleccion === 'nbs_copias') ? (marca + '__' + k) : (marca + '_' + k);
    return fbDb.collection(coleccion).doc(id)
      .set({ clave: k, hora: Date.now(), valor: 'prueba' })
      .then(function(){
        res[coleccion].ok.push(k);
        return fbDb.collection(coleccion).doc(id).delete().catch(function(){});
      })
      .catch(function(e){
        res[coleccion].mal.push({ k: k, e: (e && e.code) ? e.code : String(e).slice(0,60) });
      });
  }

  var todas = [];
  claves.forEach(function(k){
    todas.push(probarEn('nbs_copias', k));
    todas.push(probarEn('nbs_data', k));
  });

  Promise.all(todas).then(function(){
    cerrarCargandoRuta();
    var c = res.nbs_copias, d = res.nbs_data;
    var lineas = [];
    lineas.push('\u2601\ufe0f LAS DOS PUERTAS DE LA NUBE\n');
    lineas.push('\ud83d\udcbe COPIAS (nbs_copias)');
    lineas.push(c.mal.length ? '   \ud83d\udd34 rechaza ' + c.mal.length + ' de ' + claves.length
                             : '   \u2705 acepta las ' + c.ok.length);
    lineas.push('');
    lineas.push('\ud83d\udd04 CAMBIOS DEL DIA (nbs_data)');
    lineas.push(d.mal.length ? '   \ud83d\udd34 rechaza ' + d.mal.length + ' de ' + claves.length
                             : '   \u2705 acepta las ' + d.ok.length);

    var malas = [];
    if(d.mal.length) malas = d.mal;
    else if(c.mal.length) malas = c.mal;

    if(malas.length){
      lineas.push('');
      lineas.push('LAS QUE RECHAZA:');
      malas.slice(0, 8).forEach(function(x){ lineas.push('   \u2022 ' + x.k + '  \u2014  ' + x.e); });
      if(malas.length > 8) lineas.push('   y ' + (malas.length - 8) + ' mas');
      lineas.push('');
      lineas.push('Casi siempre son las REGLAS de Firebase.');
      lineas.push('Mandame esta pantalla.');
    } else {
      lineas.push('');
      lineas.push('Las dos puertas aceptan todo.');
      lineas.push('Si el aviso naranja sigue, es otra cosa \u2014 avisame.');
    }

    try {
      localStorage.setItem('nbs_prueba_nube', JSON.stringify({ hora: Date.now(), res: res }));
    } catch(e){}
    avisoGrande(lineas.join('\n'));
  });
}


// ═══════════════════════════════════════════════════════════════════
//  🔄 TRAER LO NUEVO  (11 ago 2026)
//
//  Sensei preguntó cada cuánto se sincroniza y se le dijo la verdad: la app SUBE cada
//  2 minutos, pero el otro aparato solo BAJA cuando se abre. Si tiene la PC y el
//  teléfono abiertos a la vez, uno no se entera de lo del otro hasta cerrarlo y abrirlo.
//
//  Este botón hace lo mismo que hace la app al arrancar: sube lo que esté pendiente y
//  después baja y FUNDE lo de la nube registro por registro. No pisa nada: gana el que
//  se editó después, igual que siempre.
// ═══════════════════════════════════════════════════════════════════
var _trayendo = false;

function subirPendientes(){
  if(typeof fbAuth === 'undefined' || !fbAuth || !fbAuth.currentUser) return;
  try { limpiarPendientesQueNoSonDatos(); } catch(e){}
  // Nota: los pendientes se apuntan SIEMPRE al guardar -aunque la sesion no estuviera
  // lista-, y esta funcion es la que comprueba la sesion antes de intentar subir. Asi
  // nada se queda sin subir por haberse guardado antes de que cargara la sesion.
  if(!navigator.onLine) return;
  var p;
  try{ p = JSON.parse(localStorage.getItem(CLAVE_PENDIENTES) || '{}'); }catch(e){ return; }
  var claves = Object.keys(p);
  if(!claves.length) return;
  claves.forEach(function(k){
    // Con las imagenes pegadas: la nube tiene que seguir recibiendolas igual que hoy
    var valor = textoConImagenes(k);
    if(valor === null){ quitarPendienteDeSubir(k); return; }
    var docPend = { valor: valor, actualizado: horaLocalDe(k) || Date.now() };
    if(k === 'np'){
      try{
        var pp = JSON.parse(valor);
        docPend.valor = JSON.stringify(quitarFotos(pp)); // los productos van sin fotos
        docPend.pidsConFoto = pidsConFoto(pp);
        setTimeout(function(){ sincronizarFotos(pp); }, 500);
      }catch(e){}
    }
    // \u270d\ufe0f LAS VENTAS, IGUAL: van SIN la firma. -28 ago-
    // Una firma pesa ~23 KB, es una imagen y NO se comprime. Por eso sus 1.473 KB de
    // ventas solo bajaban a 1.063 KB y no cabian en la nube. Las firmas viajan aparte,
    // por la coleccion `nbs_firmas`, igual que las fotos de los productos.
    if(k === 'nv'){
      try{
        var vv = JSON.parse(valor);
        docPend.valor = JSON.stringify(quitarFirmas(vv));
        docPend.vidsConFirma = vidsConFirma(vv);
        setTimeout(function(){ sincronizarFirmas(vv); }, 500);
      }catch(e){}
    }

    // ═══ SE COMPRIME LO GRANDE (30 jul · rehecho el 28 ago) ═══
    // Firestore no acepta documentos de mas de 1 MB.
    //
    // 🔴 LO QUE ESTABA MAL Y CAZO SENSEI: si el envio COMPRIMIDO fallaba por cualquier
    // motivo, el `.catch` reintentaba con el crudo — que NO cabe — y el error que se
    // guardaba era el del crudo. O sea que el mensaje TAPABA la causa de verdad.
    // Sus ventas [nv] pesan 1.539 KB sin comprimir; comprimidas caben de sobra.
    //
    // AHORA: cada camino guarda SU propio error, y el crudo solo se intenta si de
    // verdad cabe. Ademas se apunta si el telefono sabe comprimir y cuanto quedo.
    var subirDoc = function(d){
      return fbDb.collection('nbs_data').doc(k.replace(/\//g,'_')).set(d);
    };
    var TOPE_NUBE = 1000000;   // 1 MB con un margen
    // \u23f1\ufe0f Se declaran ANTES que apuntarFallo, que las usa. -4 sep-
    var _yaContesto = false;
    var _relojColgado = null;

    var apuntarFallo = function(e, comoFue, bytes){
      _yaContesto = true;
      try { clearTimeout(_relojColgado); } catch(e2){}
      try {
        var fallos = JSON.parse(localStorage.getItem('nbs_fallos_subida') || '{}');
        fallos[k] = {
          codigo: (e && e.code) ? e.code : '(sin codigo)',
          mensaje: (e && e.message) ? String(e.message).slice(0, 180) : String(e).slice(0, 180),
          bytes: bytes,
          como: comoFue,
          sabeComprimir: (typeof navegadorSabeComprimir === 'function') ? !!navegadorSabeComprimir() : false,
          crudoKB: Math.round(docPend.valor.length / 1024),
          hora: Date.now()
        };
        localStorage.setItem('nbs_fallos_subida', JSON.stringify(fallos));
      } catch(e2){}
    };
    // \u23f1\ufe0f EL TOPE DE TIEMPO -4 sep-. Si en 20 segundos no subio NI dio error, se
    // apunta como colgado. Antes se quedaba esperando callado para siempre.
    _relojColgado = setTimeout(function(){
      if(_yaContesto) return;
      _yaContesto = true;
      apuntarFallo({ code: 'se-colgo',
        message: 'Pasaron 20 segundos y la nube no contesto ni con exito ni con error. '
               + 'Puede ser señal muy debil o que el envio se quedo a medias.' },
        'se colgo', docPend.valor.length);
      try { actualizarAvisoPendientes(); } catch(e){}
    }, 20000);

    var alSubir = function(){
      _yaContesto = true; clearTimeout(_relojColgado);
      quitarPendienteDeSubir(k);
      try {
        var okf = JSON.parse(localStorage.getItem('nbs_fallos_subida') || '{}');
        if(okf[k]){ delete okf[k]; localStorage.setItem('nbs_fallos_subida', JSON.stringify(okf)); }
      } catch(e2){}
      console.log('Se subió a la nube lo que estaba pendiente: '+k);
    };
    // El crudo, solo si CABE. Si no cabe, no se intenta: seria un error seguro que
    // ademas taparia el motivo verdadero.
    var subirCrudo = function(porQue){
      if(docPend.valor.length > TOPE_NUBE){
        apuntarFallo({ code: 'no-cabe', message: 'Sin comprimir son '
          + Math.round(docPend.valor.length/1024) + ' KB y el tope de la nube es 1024 KB. '
          + (porQue || '') }, 'crudo (no se intento)', JSON.stringify(docPend).length);
        return;
      }
      subirDoc(docPend).then(alSubir).catch(function(e){
        apuntarFallo(e, 'crudo', JSON.stringify(docPend).length);
      });
    };

    if(docPend.valor.length > 100000 && typeof comprimirTexto === 'function'){
      comprimirTexto(docPend.valor).then(function(z){
        if(z && z.length < docPend.valor.length && z.length < TOPE_NUBE){
          var dz = { zip: z, actualizado: docPend.actualizado };
          if(docPend.pidsConFoto) dz.pidsConFoto = docPend.pidsConFoto;
          if(docPend.vidsConFirma) dz.vidsConFirma = docPend.vidsConFirma;
          // 🔑 Este catch es SOLO del envio comprimido: guarda SU error, no el del crudo.
          subirDoc(dz).then(alSubir).catch(function(e){
            apuntarFallo(e, 'comprimido (' + Math.round(z.length/1024) + ' KB)', z.length);
          });
        } else {
          subirCrudo(z ? ('Comprimido quedo en ' + Math.round(z.length/1024) + ' KB.')
                       : 'Este telefono no pudo comprimir.');
        }
      }).catch(function(e){
        subirCrudo('Fallo al comprimir: ' + ((e && e.message) ? String(e.message).slice(0,80) : e));
      });
    } else {
      subirDoc(docPend).then(alSubir).catch(function(e){
        apuntarFallo(e, 'directo', JSON.stringify(docPend).length);
      });
    }
  });
}

// ===== EL AVISO EN PANTALLA =====
// Antes, si algo no subia a la nube, fallaba en silencio y tu no te enterabas. Ahora se ve
// un aviso permanente hasta que todo este a salvo en la nube.
function iniciarVigilanteDeSincronizacion(){
  actualizarAvisoPendientes();
  // Reintentar en cuanto vuelva el internet -clave para la ruta, donde la señal va y viene-
  window.addEventListener('online', function(){
    actualizarAvisoPendientes();
    setTimeout(subirPendientes, 800);
  });
  window.addEventListener('offline', actualizarAvisoPendientes);
  setInterval(function(){
    actualizarAvisoPendientes();
    subirPendientes();
  }, 120000); // cada 2 minutos
}

function verificarBackup(){
  var hoy = new Date().getTime();
  var ultimoBackup = parseInt(localStorage.getItem('ultimoBackup') || '0');
  var horasTranscurridas = ultimoBackup > 0 ? (hoy - ultimoBackup) / (1000 * 60 * 60) : 999;

  // Mostrar si nunca ha hecho backup O ha pasado 1+ hora
  if(!ultimoBackup || horasTranscurridas >= 1){
    setTimeout(function(){ mostrarAlertaBackup(ultimoBackup); }, 1500);
  }
}

function mostrarAlertaBackup(ultimoBackup){
  if(document.getElementById('backup-overlay')) return;
  var overlay = document.createElement('div');
  overlay.id = 'backup-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);z-index:999999;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:20px';
  var horas = ultimoBackup ? Math.round((new Date().getTime() - ultimoBackup) / (1000 * 60 * 60)) : null;
  var mensaje = horas ? 'Han pasado <b>'+horas+' hora(s)</b> desde tu último backup.' : 'Nunca has hecho un backup de tus datos.';
  overlay.innerHTML = '<div style="background:white;border-radius:16px;padding:24px;max-width:340px;width:100%;text-align:center">'
    +'<div style="font-size:44px;margin-bottom:10px">💾</div>'
    +'<div style="font-size:17px;font-weight:800;color:#1a237e;margin-bottom:8px">Recordatorio de Backup</div>'
    +'<div style="font-size:13px;color:#555;margin-bottom:16px">'+mensaje+'</div>'
    +'<button onclick="hacerBackupAhora()" style="width:100%;padding:13px;background:#1565C0;color:white;border:none;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;margin-bottom:12px">📤 Hacer Backup Ahora</button>'
    +'<div style="font-size:11px;color:#aaa;margin-bottom:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px">Posponer recordatorio</div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px">'
    +'<button onclick="posponerBackup(15)" style="padding:9px;background:#f5f5f5;color:#555;border:none;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600">⏰ 15 min</button>'
    +'<button onclick="posponerBackup(30)" style="padding:9px;background:#f5f5f5;color:#555;border:none;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600">⏰ 30 min</button>'
    +'<button onclick="posponerBackup(60)" style="padding:9px;background:#f5f5f5;color:#555;border:none;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600">⏰ 1 hora</button>'
    +'</div>'
    +'</div>';
  document.body.appendChild(overlay);
}

function hacerBackupAhora(){
  localStorage.setItem('ultimoBackup', new Date().getTime().toString());
  var overlay = document.getElementById('backup-overlay');
  if(overlay) overlay.remove();
  exportD();
}

function posponerBackup(minutos){
  // Guardar como si el backup fue hace (60-minutos) minutos para que vuelva en 'minutos'
  var tiempoAtras = new Date().getTime() - ((60 - minutos) * 60 * 1000);
  localStorage.setItem('ultimoBackup', tiempoAtras.toString());
  var overlay = document.getElementById('backup-overlay');
  if(overlay) overlay.remove();
}



function revisarRecordatorioBackup(){
  try {
    var hoyTxt = fechaHoy();
    var ultimo = LS('nbs_ultimo_backup_bajado', '');

    // Si nunca ha bajado uno, se apunta HOY como punto de partida y NO se le molesta.
    // Si no, el aviso saltaría desde el primer día de usar esta versión.
    if(!ultimo){ SS('nbs_ultimo_backup_bajado', hoyTxt); return; }

    var dias = _diasDesde(ultimo);
    if(dias === null || dias < DIAS_SIN_BACKUP_PARA_AVISAR) return;

    // Una sola vez al día
    if(LS('nbs_aviso_backup_dia', '') === hoyTxt) return;
    SS('nbs_aviso_backup_dia', hoyTxt);

    avisoGrande('\ud83d\udcbe HACE ' + dias + ' D\u00cdAS QUE NO BAJAS UN BACKUP\n\n'
      + 'El backup es el archivo que te devuelve TODO si pierdes el tel\u00e9fono.\n\n'
      + 'B\u00e1jalo desde el Men\u00fa \u2630 \u2192 \ud83d\udee1\ufe0f SEGURIDAD.');
  } catch(e){}
}

// Se apunta la llegada; si pasan 40 minutos y no marcó ni vendió, se le dice.
var MINUTOS_SIN_MARCAR = 40;

// ═══════════════════════════════════════════════════════════════════
//  🌉 LOS PEDIDOS QUE LLEGAN DEL CATÁLOGO  (8 sep 2026)
//
//  Sensei: "en la app también debes poner una alerta cada vez que entra un pedido, y
//  que me salga una ventana para yo tocarla y entrar a ese pedido de una vez, pero con
//  la opción de dejarlo pendiente también por si en ese momento no puedo sacarlo".
//
//  🔑 El barbero pide desde el catálogo → el pedido cae en el buzón de la nube →
//  NBS2 lo recoge y le sale la ventana. El WhatsApp sigue llegando igual.
// ═══════════════════════════════════════════════════════════════════

var CLAVE_PEDIDOS_WEB = 'nbs_pedidos_web_vistos';
var _pedidosWebNuevos = [];

// Los pedidos que ya vio, para no avisarle dos veces del mismo
function pedidosWebVistos(){
  try { return JSON.parse(localStorage.getItem(CLAVE_PEDIDOS_WEB) || '{}'); }
  catch(e){ return {}; }
}
function apuntarPedidoVisto(id, como){
  var v = pedidosWebVistos();
  v[id] = como || 'visto';
  try { localStorage.setItem(CLAVE_PEDIDOS_WEB, JSON.stringify(v)); } catch(e){}
}

/**
 * Mira el buzón y avisa si hay pedidos nuevos.
 * Se llama sola al arrancar y cada 2 minutos.
 */
function revisarPedidosDelCatalogo(alTerminar){
  if(typeof fbDb === 'undefined' || typeof fbAuth === 'undefined' || !fbAuth || !fbAuth.currentUser){
    if(alTerminar) alTerminar([]);
    return;
  }
  fbDb.collection('nbs_pedidos_web')
    .where('estado', '==', 'nuevo')
    .get()
    .then(function(snap){
      var vistos = pedidosWebVistos();
      var nuevos = [];
      snap.forEach(function(doc){
        var p = doc.data() || {};
        p.id = doc.id;
        // Los que ya despachó o dejó pendiente no vuelven a saltar
        if(vistos[p.id] === 'hecho') return;
        nuevos.push(p);
      });
      // El más nuevo primero
      nuevos.sort(function(a, b){ return (b.cuando || 0) - (a.cuando || 0); });
      _pedidosWebNuevos = nuevos;
      // Solo salta la ventana con los que NO ha visto todavía
      var sinVer = nuevos.filter(function(p){ return !vistos[p.id]; });
      if(sinVer.length) mostrarAvisoPedidoNuevo(sinVer[0], sinVer.length);
      try { actualizarChivatoPedidos(); } catch(e){}
      if(alTerminar) alTerminar(nuevos);
    })
    .catch(function(e){
      console.warn('no pude mirar el buzon de pedidos', e);
      if(alTerminar) alTerminar([]);
    });
}

/**
 * 🔔 LA VENTANA que pidió Sensei: se toca y entra al pedido, o lo deja pendiente.
 */
function mostrarAvisoPedidoNuevo(p, cuantos){
  var ov = document.getElementById('pedido-nuevo-overlay');
  if(!ov){
    ov = document.createElement('div');
    ov.id = 'pedido-nuevo-overlay';
    document.body.appendChild(ov);
  }
  window._pedidoWebActual = p;
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:2000004;'
    + 'display:flex;align-items:center;justify-content:center;padding:14px';
  ov.onclick = function(e){ if(e.target === ov) dejarPedidoPendiente(); };

  var lista = (p.items || []).slice(0, 6).map(function(it){
    return '<div style="display:flex;justify-content:space-between;gap:8px;padding:3px 0;'
      + 'font-size:12.5px;color:var(--nbs-ink)">'
      + '<span style="flex:1;min-width:0">' + it.cant + ' \u00d7 ' + escaparHtml(String(it.nombre || '')) + '</span>'
      + '<span style="font-weight:700;flex-shrink:0">$' + fmtNum((it.cant || 0) * (it.precio || 0)) + '</span>'
      + '</div>';
  }).join('');
  var mas = (p.items || []).length > 6
    ? '<div style="font-size:11px;color:var(--nbs-muted);padding-top:3px">y '
      + ((p.items || []).length - 6) + ' m\u00e1s\u2026</div>' : '';

  ov.innerHTML = '<div style="background:#fff;border-radius:15px;padding:16px;max-width:430px;'
    + 'width:100%;max-height:88vh;overflow:auto">'

    + '<div style="text-align:center;margin-bottom:11px">'
    +   '<div style="font-size:30px">\ud83d\udd14</div>'
    +   '<div style="font-size:17px;font-weight:900;color:#E65100">PEDIDO NUEVO</div>'
    +   (cuantos > 1
          ? '<div style="font-size:12px;color:var(--nbs-muted);margin-top:2px">y '
            + (cuantos - 1) + ' m\u00e1s esperando</div>' : '')
    + '</div>'

    + '<div style="background:#FFF8E1;border:1.5px solid #FFD54F;border-radius:11px;'
    +   'padding:12px;margin-bottom:11px">'
    +   '<div style="font-size:15px;font-weight:900;color:var(--nbs-ink)">'
    +     escaparHtml(String(p.cliente || 'Cliente')) + '</div>'
    +   (p.negocio ? '<div style="font-size:12.5px;color:#7A5C00;font-weight:700">'
                   + escaparHtml(String(p.negocio)) + '</div>' : '')
    +   '<div style="font-size:11px;color:#7A5C00;margin-top:3px">'
    +     escaparHtml(String(p.fecha || '')) + ' \u00b7 ' + escaparHtml(String(p.hora || '')) + '</div>'
    + '</div>'

    + '<div style="border:1px solid #E4E4EC;border-radius:10px;padding:11px;margin-bottom:11px">'
    +   '<div style="font-size:10.5px;font-weight:800;color:var(--nbs-muted);'
    +     'letter-spacing:.4px;margin-bottom:5px">'
    +     (p.items || []).length + ' PRODUCTO(S)</div>'
    +   lista + mas
    +   '<div style="display:flex;justify-content:space-between;padding-top:8px;margin-top:6px;'
    +     'border-top:2px solid #1a237e;font-size:17px;font-weight:900">'
    +     '<span>TOTAL</span><span style="color:var(--nbs-green-text)">$'
    +     fmtNum(p.total || 0) + '</span></div>'
    + '</div>'

    + '<button onclick="prepararPedidoWeb()" style="width:100%;padding:15px;background:#1a237e;'
    +   'color:#fff;border:none;border-radius:12px;font-size:15.5px;font-weight:900;cursor:pointer">'
    +   '\ud83d\udce6 Prepararlo ahora</button>'
    + '<button onclick="dejarPedidoPendiente()" style="width:100%;padding:13px;margin-top:8px;'
    +   'background:#fff;color:#E65100;border:1.5px solid #FFB74D;border-radius:11px;'
    +   'font-size:13.5px;font-weight:800;cursor:pointer">'
    +   '\u23f3 Dejarlo pendiente</button>'
    + '</div>';

  ov.style.display = 'flex';
  try { sonidoRecordatorio(); } catch(e){}
}

function cerrarAvisoPedidoNuevo(){
  var ov = document.getElementById('pedido-nuevo-overlay');
  if(ov) ov.style.display = 'none';
}

/**
 * 📦 Prepararlo ahora: se mete en su lista de pedidos y se marca como despachado.
 */
function prepararPedidoWeb(){
  var p = window._pedidoWebActual;
  if(!p) return;
  cerrarAvisoPedidoNuevo();

  // Se pasa a la lista de pedidos de siempre, para prepararlo como cualquier otro
  var P = LS('npedidos', []);
  P.push({
    id: Date.now(),
    cid: p.cid,
    cn: p.cliente,
    negocio: p.negocio || '',
    fecha: p.fecha || fechaHoy(),
    items: (p.items || []).map(function(it){
      return { pid: it.pid, nombre: it.nombre, cant: it.cant, precio: it.precio };
    }),
    total: p.total || 0,
    deWeb: true,
    idWeb: p.id,
    mod: Date.now()
  });
  if(!SS('npedidos', P)) return;

  apuntarPedidoVisto(p.id, 'hecho');
  marcarPedidoEnLaNube(p.id, 'despachado');
  try { actualizarChivatoPedidos(); } catch(e){}

  avisoGrande('\ud83d\udce6 El pedido de ' + (p.cliente || '') + ' est\u00e1 en tu lista.\n\n'
    + 'Lo prepras y lo llevas en la ruta.');
  try { ir('p-ped'); } catch(e){}
}

/**
 * ⏳ Dejarlo pendiente: se cierra, pero NO se pierde. Sigue en la lista de nuevos y el
 * robot se lo recuerda.
 */
function dejarPedidoPendiente(){
  var p = window._pedidoWebActual;
  cerrarAvisoPedidoNuevo();
  if(!p) return;
  apuntarPedidoVisto(p.id, 'pendiente');
  try { actualizarChivatoPedidos(); } catch(e){}
  avisoGrande('\u23f3 Lo dejo pendiente.\n\nNo se pierde: lo tienes en \ud83d\udd14 Pedidos del cat\u00e1logo, '
    + 'en el men\u00fa, y el robot te lo recuerda.');
}

// Se apunta en la nube cómo quedó, para que no vuelva a saltar en otro aparato
function marcarPedidoEnLaNube(id, estado){
  if(typeof fbDb === 'undefined' || !fbAuth || !fbAuth.currentUser) return;
  try {
    fbDb.collection('nbs_pedidos_web').doc(String(id))
      .update({ estado: estado, cuandoAtendido: Date.now() })
      .catch(function(){});
  } catch(e){}
}

/**
 * 📋 La lista de todos los pedidos del catálogo que están esperando.
 */
function verPedidosDelCatalogo(){
  revisarPedidosDelCatalogo(function(){
    var ov = document.getElementById('pedidos-web-overlay');
    if(!ov){
      ov = document.createElement('div');
      ov.id = 'pedidos-web-overlay';
      document.body.appendChild(ov);
    }
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.62);z-index:100004;'
      + 'display:flex;align-items:flex-end;justify-content:center';
    ov.onclick = function(e){ if(e.target === ov) cerrarPedidosWeb(); };

    var h = '<div style="background:#fff;width:100%;max-width:520px;border-radius:16px 16px 0 0;'
      + 'padding:15px;max-height:88vh;overflow:auto">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:11px">'
      +   '<div style="font-size:16px;font-weight:900;color:var(--nbs-ink)">'
      +     '\ud83d\udd14 Pedidos del cat\u00e1logo</div>'
      +   '<button onclick="cerrarPedidosWeb()" style="background:#F0F0F2;border:none;'
      +     'border-radius:9px;width:34px;height:34px;font-size:16px;cursor:pointer">\u2715</button>'
      + '</div>';

    if(!_pedidosWebNuevos.length){
      h += '<div style="background:#F4F6FB;border-radius:11px;padding:22px;text-align:center;'
        + 'font-size:13.5px;color:var(--nbs-muted)">No hay pedidos esperando.<br><br>'
        + 'Cuando un barbero pida desde su cat\u00e1logo, te aparece aqu\u00ed.</div>';
    } else {
      var vistos = pedidosWebVistos();
      h += _pedidosWebNuevos.map(function(p, i){
        var pend = vistos[p.id] === 'pendiente';
        return '<div onclick="abrirPedidoWebDeLaLista(' + i + ')" '
          + 'style="border:1px solid #E4E4EC;border-left:4px solid '
          +   (pend ? '#E65100' : '#2E7D32') + ';border-radius:10px;padding:11px;'
          +   'margin-bottom:8px;cursor:pointer">'
          + '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">'
          +   '<div style="flex:1;min-width:0">'
          +     '<div style="font-size:13.5px;font-weight:900">'
          +       escaparHtml(String(p.cliente || '')) + '</div>'
          +     (p.negocio ? '<div style="font-size:11px;color:var(--nbs-muted)">'
                           + escaparHtml(String(p.negocio)) + '</div>' : '')
          +     '<div style="font-size:11px;color:var(--nbs-muted);margin-top:2px">'
          +       escaparHtml(String(p.fecha || '')) + ' \u00b7 ' + (p.items || []).length + ' producto(s)'
          +       (pend ? ' \u00b7 <b style="color:#E65100">PENDIENTE</b>' : '') + '</div>'
          +   '</div>'
          +   '<div style="font-size:15px;font-weight:900;color:var(--nbs-green-text)">$'
          +     fmtNum(p.total || 0) + '</div>'
          + '</div></div>';
      }).join('');
    }

    h += '<button onclick="cerrarPedidosWeb()" style="width:100%;padding:12px;margin-top:8px;'
      +   'background:#F0F0F2;color:#333;border:none;border-radius:10px;font-size:13px;'
      +   'font-weight:700;cursor:pointer">Cerrar</button></div>';
    ov.innerHTML = h;
    ov.style.display = 'flex';
  });
}

function cerrarPedidosWeb(){
  var ov = document.getElementById('pedidos-web-overlay');
  if(ov) ov.style.display = 'none';
}

function abrirPedidoWebDeLaLista(i){
  var p = _pedidosWebNuevos[i];
  if(!p) return;
  cerrarPedidosWeb();
  mostrarAvisoPedidoNuevo(p, 1);
}

// 🔔 El numerito rojo del menú, para que se vea sin entrar
function actualizarChivatoPedidos(){
  var n = _pedidosWebNuevos.length;
  var e = document.getElementById('chivato-pedidos-web');
  if(!e) return;
  e.textContent = n > 0 ? String(n) : '';
  e.style.display = n > 0 ? 'flex' : 'none';
}

// Se mira el buzón al arrancar y cada 2 minutos
setTimeout(function(){ try { revisarPedidosDelCatalogo(); } catch(e){} }, 6000);
setInterval(function(){ try { revisarPedidosDelCatalogo(); } catch(e){} }, 120000);
