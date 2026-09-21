
function conLogoListo(cb){
  var listos = 0;
  var necesarios = 2;
  var hecho = false;
  function marcar(){
    listos++;
    if(listos >= necesarios && !hecho){ hecho = true; cb(); }
  }
  if(LOGO_IMG.complete && LOGO_IMG.naturalWidth > 0){ marcar(); }
  else {
    LOGO_IMG.onload = marcar;
    LOGO_IMG.onerror = marcar;
  }
  if(LOGO_IMG_COLOR.complete && LOGO_IMG_COLOR.naturalWidth > 0){ marcar(); }
  else {
    LOGO_IMG_COLOR.onload = marcar;
    LOGO_IMG_COLOR.onerror = marcar;
  }
  setTimeout(function(){ if(!hecho){ hecho = true; cb(); } }, 1500);
}

// ═══════════════════════════════════════════════════════════════════
//  EL ALMACÉN GRANDE DE IMÁGENES  (1 ago 2026)
//
//  EL PROBLEMA: el navegador le da a la app un casillero de solo 5 MB
//  (localStorage). Los datos de Sensei llegaron al 89% y las copias del
//  teléfono empezaron a fallar. Medido: el 84% de todo eran IMÁGENES.
//
//  LA CURA: las imágenes se mudan a IndexedDB, que NO tiene ese tope.
//  Los NÚMEROS (ventas, montos, pagos) se quedan donde están — no se
//  toca ni uno.
//
//  CÓMO, sin cambiar las 16 funciones que las usan: se engancha en las
//  DOS PUERTAS por donde pasa todo, `LS()` y `SS()`.
//     · Al GUARDAR  -> la imagen sale del dato y se guarda aparte
//     · Al LEER     -> la imagen se vuelve a pegar
//  Así `gasto.foto` y `venta.firma` se siguen viendo igual en todas
//  partes, y ninguna de esas 16 funciones se entera.
//
//  REGLA DE ORO: una imagen SOLO se le quita al dato cuando ya está
//  CONFIRMADA en el almacén nuevo. Si IndexedDB no existe o falla, no
//  se quita nada y la app funciona exactamente como hoy.
// ═══════════════════════════════════════════════════════════════════

// Que clave lleva que imagen.
//   FASE 1 -1 ago-: gastos, compras y firmas.
//   FASE 2 -4 ago-: tambien las fotos de PRODUCTOS.
// OJO CON LA FASE 2: las fotos de productos ya tenian su propio sistema para la nube
// -sincronizarFotos, pegarFotosQueYaTengo, descargarFotosQueFaltan, revisarFotosDeLaNube-
// y ese sistema leia los productos con localStorage crudo. Al mudar las fotos al
// almacen grande, esas lecturas veian los productos SIN fotos y la app se las habria
// vuelto a bajar de la nube, gastando datos y pisando las que ya estaban. Por eso las
// 5 lecturas crudas de 'np' pasaron a LS('np'), que si se las pega.
var CLAVES_CON_IMAGEN = { ngastos: 'foto', nc: 'foto', nv: 'firma', np: 'foto' };

var _IMGS = {};        // las imágenes en memoria: 'ngastos|123' -> 'data:image...'
var _IMGS_OK = {};     // las que YA están confirmadas en el almacén grande
var _IMGS_LISTO = false;
var _almacenImgs = null;

function _clvImg(clave, id){ return clave + '|' + String(id); }

// ── Abrir el almacén grande ──
function _quienLlamo(){
  try {
    var st = (new Error()).stack || '';
    var lineas = st.split('\n').slice(2, 8);
    var nombres = [];
    for(var i = 0; i < lineas.length; i++){
      var m = lineas[i].match(/at ([A-Za-z_$][\w$]*)/);
      if(m && ['SS','_quienLlamo','vigilarPedidos','Object'].indexOf(m[1]) < 0) nombres.push(m[1]);
      if(nombres.length >= 3) break;
    }
    return nombres.join(' \u2190 ') || '(no se pudo saber)';
  } catch(e){ return '(no se pudo saber)'; }
}

function LS(k,d){
  try{
    var v = localStorage.getItem(k);
    if(!v) return d;
    var dato = JSON.parse(v);
    // Volver a pegarle las imagenes que viven en el almacen grande
    if(CLAVES_CON_IMAGEN[k]){ try { dato = ponerImagenes(k, dato); } catch(eImg){} }
    return dato;
  }catch(e){ return d; }
}

// (toggleMenuExtra eliminada 18 jul 2026: ya nadie la llama)

// Cada vez que se guarda algo, se anota la HORA en que se guardo. Esto es clave: sin la hora
// no hay forma de saber cual version es mas nueva -si la del telefono o la de la nube- y se
// puede terminar borrando trabajo nuevo con datos viejos. Eso paso el 16 de julio 2026 y
// costo un dia entero de ventas.
// ===== COMPRIMIR / DESCOMPRIMIR =====
// Firebase no acepta guardar mas de 1 MB de una sola vez. Comprimiendo, lo mismo ocupa
// entre un 35% y un 90% menos, asi que cabe de sobra y las copias son mas rapidas.
// Si el navegador fuera muy viejo y no supiera comprimir, se guarda sin comprimir -la app
// sigue funcionando igual, solo ocupa mas-.
function navegadorSabeComprimir(){
  return typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';
}

function comprimirTexto(txt){
  if(!navegadorSabeComprimir()) return Promise.resolve(null);
  try{
    var cs = new CompressionStream('gzip');
    var flujo = new Blob([txt]).stream().pipeThrough(cs);
    return new Response(flujo).arrayBuffer().then(function(buf){
      // Se pasa a texto para poder guardarlo en Firebase -que solo acepta texto-.
      // Se hace por pedazos para no reventar la memoria con datos grandes.
      var bytes = new Uint8Array(buf);
      var binario = '';
      var pedazo = 8192;
      for(var i=0; i<bytes.length; i+=pedazo){
        binario += String.fromCharCode.apply(null, bytes.subarray(i, i+pedazo));
      }
      return btoa(binario);
    }).catch(function(){ return null; });
  }catch(e){ return Promise.resolve(null); }
}

function descomprimirTexto(base64){
  if(!navegadorSabeComprimir()) return Promise.resolve(null);
  try{
    var binario = atob(base64);
    var bytes = new Uint8Array(binario.length);
    for(var i=0; i<binario.length; i++) bytes[i] = binario.charCodeAt(i);
    var ds = new DecompressionStream('gzip');
    var flujo = new Blob([bytes]).stream().pipeThrough(ds);
    return new Response(flujo).text().catch(function(){ return null; });
  }catch(e){ return Promise.resolve(null); }
}

// ═══════════════════════════════════════════════════════════════════════════════
//   COPIAS AUTOMATICAS CADA 2 HORAS  —  construido el 17 de julio de 2026
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUE EXISTE ESTO:
// El 16 de julio de 2026 se perdio un dia COMPLETO de ventas por un error de esta app.
// No habia forma de volver atras. Ahora la app guarda sola una copia completa cada 2 horas
// en la nube, y conserva las de los ultimos 30 dias. Si algo se rompe -por un error mio, por
// un borrado sin querer, por lo que sea-, se puede volver a como estaba, con un boton.
//
// La idea de fondo: la app NO debe depender de que nadie no se equivoque. Debe poder VOLVER
// ATRAS. Eso es lo que le faltaba.
// ═══════════════════════════════════════════════════════════════════════════════

var CLAVES_A_RESPALDAR = ['ncl','nv','nc','ncr','np','nsup','ngastos','ntarjetas','notrasdeudas','npedidos','ndevoluciones','np_eliminados','nvisitas_barberos','historial_precios','rutas_por_dia',
  'nvan','nrelleno','ncierres_ruta','nconfirmaciones','nbs_uso_pantallas','nbs_avisar_cliente','nbs_wa_pegar','nbs_pedir_firma','nbs_premios_sonados','nbs_facturas_emparejadas','nbs_correcciones_van',
  // La LISTA de impresoras sí viaja a la nube. La que está ACTIVA no: eso es de cada
  // aparato -el teléfono puede usar la portátil y la PC la de escritorio-. -30 jul-
  'impresoras_lista',
  // Las listas de lo borrado tambien viajan: si no, lo que Sensei borro en un aparato
  // resucitaria al juntarse con el otro. -29 jul-
  '_borrados_ncl','_borrados_nv','_borrados_nc','_borrados_np','_borrados_nsup',
  '_borrados_ngastos','_borrados_npedidos','_borrados_ndevoluciones'];  // agregados el 28 jul: la van, el relleno y lo aprendido del lector de facturas
var HORAS_ENTRE_COPIAS = 0.25; // cada 15 minutos (pedido por Sensei, 19 jul 2026)
var DIAS_QUE_SE_GUARDAN = 15;
var CLAVE_ULTIMA_COPIA = 'nbs_ultima_copia_auto';

function toca_hacer_copia(){
  var ultima = parseInt(localStorage.getItem(CLAVE_ULTIMA_COPIA) || '0', 10);
  if(!ultima) return true; // nunca se ha hecho ninguna
  return (Date.now() - ultima) >= HORAS_ENTRE_COPIAS * 60 * 60 * 1000;
}

// Cuenta lo que hay ahora, para poder detectar despues si algo se borro
function contarTodo(){
  var c = {};
  CLAVES_A_RESPALDAR.forEach(function(k){
    var v = LS(k, null);
    if(Array.isArray(v)) c[k] = v.length;
    else if(v && typeof v === 'object') c[k] = Object.keys(v).length;
  });
  return c;
}

// Cuenta cuántos MOVIMIENTOS nuevos hubo desde la última copia de la nube.
// Compara el conteo actual (ventas, gastos, compras, etc.) con el de la última copia.
// Devuelve el total de diferencias (cuántos registros nuevos hay en total).
function contarCambiosDesdeUltimaCopia(conteoActual){
  var previo = {};
  try{ previo = JSON.parse(localStorage.getItem('nbs_conteo_ultima_copia_nube') || '{}'); }catch(e){ previo = {}; }
  // Si nunca se ha guardado un conteo, se considera que hay cambios (para hacer la primera copia)
  if(!previo || Object.keys(previo).length === 0) return 1;
  var totalCambios = 0;
  // Solo cuentan como "movimientos" las cosas que registran transacciones
  var clavesMovimiento = ['nv', 'ngastos', 'nc']; // ventas, gastos, compras
  clavesMovimiento.forEach(function(k){
    var ahora = conteoActual[k] || 0;
    var antes = previo[k] || 0;
    if(ahora > antes) totalCambios += (ahora - antes); // cuántos registros nuevos
  });
  return totalCambios;
}

// Cuando NO hubo movimientos: refresca la hora de la copia más reciente de la nube,
// sin subir una copia nueva. Así Sensei ve la hora fresca y la nota "sin cambios".
function hacerCopiaAutomatica(forzada){
  if(typeof fbAuth === 'undefined' || !fbAuth || !fbAuth.currentUser) return Promise.resolve(false);
  if(!navigator.onLine) return Promise.resolve(false);
  if(!forzada && !toca_hacer_copia()) return Promise.resolve(false);

  var idCopia = String(Date.now());
  var conteo = contarTodo();

  // ─── SOLO SE HACE COPIA SI HUBO MOVIMIENTOS (pedido por Sensei, 19 jul 2026) ───
  // Se compara lo que hay ahora con lo que había en la última copia. Si no cambió nada
  // (ninguna venta, gasto ni compra nueva), NO se sube una copia repetida: solo se
  // actualiza la hora con la nota "sin cambios". Si sí hubo movimientos, se cuenta cuántos
  // y se guarda la copia real, avisando cuántos cambios se guardaron.
  if(!forzada){
    var cambios = contarCambiosDesdeUltimaCopia(conteo);
    if(cambios === 0){
      // No hubo movimientos: NO se sube copia nueva y NO se toca la hora de la última
      // copia real (para que arriba siga mostrando cuándo se guardaron datos por última vez).
      // Solo se registra que se revisó ahora y que no había cambios.
      tocarHoraUltimaCopiaNube();
      return Promise.resolve(false);
    }
    window._cambiosParaAvisar = cambios; // para el letrero
  }

  var promesas = [];
  var guardadas = 0;
  var claves_ok = [], claves_malas = [];

  CLAVES_A_RESPALDAR.forEach(function(k){
    // Con las imagenes pegadas: la copia de la nube debe poder restaurarlo todo
    var crudo = textoConImagenes(k);
    if(crudo === null) return; // no existe: no hay nada que copiar
    // Los productos se copian SIN fotos: cada foto ya esta guardada por su lado en la nube,
    // y meterlas en cada copia cada 2 horas llenaria el espacio sin necesidad
    // (con fotos: 242 MB en 30 dias; sin fotos: 18 MB).
    if(k === 'np'){
      try{ crudo = JSON.stringify(quitarFotos(JSON.parse(crudo))); }catch(e){}
    }
    promesas.push(
      comprimirTexto(crudo).then(function(comprimido){
        var doc = { clave: k, hora: Date.now() };
        if(comprimido){ doc.zip = comprimido; }
        else { doc.valor = crudo; } // el navegador no supo comprimir: se guarda tal cual
        return fbDb.collection('nbs_copias').doc(idCopia + '__' + k).set(doc)
          .then(function(){ guardadas++; claves_ok.push(k); });
      }).catch(function(e){
        // Esta pieza no se pudo subir. Se anota y se SIGUE con las demas: mas vale una
        // copia con 27 de 28 piezas que ninguna copia.
        claves_malas.push({ clave: k, porque: (e && e.code) ? e.code : String(e).slice(0,80) });
        console.error('No se pudo subir a la nube la pieza "' + k + '":', e);
      })
    );
  });

  return Promise.all(promesas).then(function(){
    // El indice: la ficha de esta copia, con que trae y cuanto de cada cosa
    return fbDb.collection('nbs_copias').doc(idCopia).set({
      esIndice: true,
      hora: Date.now(),
      fecha: fechaHoy(),
      horaTexto: new Date().toLocaleTimeString('en-US', {hour:'numeric', minute:'2-digit', hour12:true}),
      claves: claves_ok.slice(),   // SOLO las que de verdad subieron, no las que se intentaron
      falladas: claves_malas.slice(),
      conteo: conteo,
      cambios: window._cambiosParaAvisar || 0,
      automatica: !forzada
    });
  }).then(function(){
    // ═══ VERIFICACION DE VERDAD ═══
    // No basta con que la escritura no de error: hay que VOLVER A LEER lo que se guardo y
    // comprobar que esta completo. Sin esto, la app podia decir "copia guardada" cuando en
    // realidad no habia nada. Paso el 17 de julio de 2026: las reglas de Firebase bloqueaban
    // la coleccion nbs_copias y la app igual decia que todo estaba bien.
    // Si alguna pieza no subio, hay que DECIRLO. Callarlo fue lo que dejo a Sensei sin
    // copias en la nube sin que se enterara. -30 jul-
    if(claves_malas.length){
      var lista = claves_malas.map(function(x){ return x.clave + ' (' + x.porque + ')'; }).join('\n   ');
      console.error('PIEZAS QUE NO SUBIERON A LA NUBE:\n   ' + lista);
      try {
        localStorage.setItem('nbs_copia_nube_fallos', JSON.stringify({
          hora: Date.now(), fecha: fechaHoy(), fallas: claves_malas
        }));
      } catch(e){}
      if(forzada){
        setTimeout(function(){
          avisoGrande('\u26a0\ufe0f La copia se guard\u00f3, pero ' + claves_malas.length +
            ' parte(s) no subieron:\n\n   ' + lista +
            '\n\nTus datos est\u00e1n en el tel\u00e9fono y en tu backup. Av\u00edsame para revisarlo.');
        }, 900);
      }
    } else {
      try { localStorage.removeItem('nbs_copia_nube_fallos'); } catch(e){}
    }
    return verificarCopiaDeVerdad(idCopia);
  }).then(function(v){
    if(!v.completa){
      throw new Error('La copia quedó incompleta: se guardaron ' + v.encontradas + ' de ' + v.esperadas + ' parte(s)');
    }
    localStorage.setItem(CLAVE_ULTIMA_COPIA, String(Date.now()));
    localStorage.setItem('nbs_conteo_ultima_copia_nube', JSON.stringify(conteo));
    console.log('Copia verificada en la nube: '+v.encontradas+' parte(s) leidas de vuelta');
    // Se te avisa en pantalla: antes se hacia en silencio y no habia forma de saber que
    // estaba pasando -Sensei paso un dia entero sin ver una sola copia y creyendo que no
    // funcionaba, cuando si funcionaba-.
    if(!forzada) mostrarAvisoCopiaHecha();
    limpiarCopiasViejas();
    return true;
  }).catch(function(e){
    console.error('No se pudo hacer la copia en la nube:', e);
    window._ultimoErrorCopia = traducirErrorFirebase(e);
    return false;
  });
}

// Vuelve a LEER de la nube lo que se acaba de guardar, y comprueba que este completo.
// Devuelve { completa, encontradas, esperadas }.
// Un aviso breve -3 segundos- para que sepas que la copia automatica se hizo. Sin esto,
// todo pasaba por detras y no tenias forma de saber si estaba funcionando o no.
function mostrarAvisoCopiaHecha(){
  var t = document.getElementById('toast-copia-auto');
  if(!t){
    t = document.createElement('div');
    t.id = 'toast-copia-auto';
    t.style.cssText = 'position:fixed;top:64px;left:50%;transform:translateX(-50%);background:#2E7D32;color:white;padding:9px 16px;border-radius:20px;font-size:12px;font-weight:700;z-index:99988;box-shadow:0 3px 12px rgba(0,0,0,0.25);transition:opacity 0.4s;white-space:nowrap';
    document.body.appendChild(t);
  }
  var hora = new Date().toLocaleTimeString('en-US', {hour:'numeric', minute:'2-digit', hour12:true});
  var n = window._cambiosParaAvisar || 0;
  var textoCambios = n === 1 ? '1 cambio guardado' : (n > 1 ? n + ' cambios guardados' : 'Copia guardada');
  t.textContent = '🛡️ ' + textoCambios + ' · ' + hora;
  window._cambiosParaAvisar = 0;
  t.style.display = 'block';
  t.style.opacity = '1';
  setTimeout(function(){ t.style.opacity = '0'; }, 3000);
  setTimeout(function(){ t.style.display = 'none'; }, 3500);
}

function verificarCopiaDeVerdad(idCopia){
  return fbDb.collection('nbs_copias').doc(idCopia).get().then(function(doc){
    if(!doc.exists) return { completa: false, encontradas: 0, esperadas: 0 };
    var indice = doc.data();
    var claves = indice.claves || [];
    var revisiones = claves.map(function(k){
      return fbDb.collection('nbs_copias').doc(idCopia + '__' + k).get().then(function(d){
        // No basta con que exista: tiene que traer contenido de verdad
        if(!d.exists) return false;
        var dd = d.data();
        return !!(dd && ((dd.zip && dd.zip.length > 10) || (dd.valor && dd.valor.length > 1)));
      }).catch(function(){ return false; });
    });
    return Promise.all(revisiones).then(function(res){
      var ok = res.filter(function(x){ return x; }).length;
      return { completa: ok === claves.length && ok > 0, encontradas: ok, esperadas: claves.length };
    });
  }).catch(function(e){
    return { completa: false, encontradas: 0, esperadas: 0, error: e };
  });
}

// Convierte el error tecnico de Firebase en algo que se entienda -y que sea VERDAD-.
// Antes se decia siempre "revisa tu internet", aunque el problema fuera otro. Eso mandaba
// a buscar donde no era.
function limpiarCopiasViejas(){
  var limite = Date.now() - DIAS_QUE_SE_GUARDAN * 24 * 60 * 60 * 1000;
  fbDb.collection('nbs_copias').get().then(function(snap){
    var borrar = [];
    snap.forEach(function(doc){
      var id = String(doc.id).split('__')[0];
      var t = parseInt(id, 10);
      if(t && t < limite) borrar.push(fbDb.collection('nbs_copias').doc(doc.id).delete());
    });
    if(borrar.length){
      Promise.all(borrar).then(function(){ console.log('Se borraron '+borrar.length+' parte(s) de copias viejas'); });
    }
  }).catch(function(e){ console.error('No se pudieron limpiar las copias viejas:', e); });
}

// Trae la lista de copias disponibles, de la mas nueva a la mas vieja
function listarCopias(){
  return fbDb.collection('nbs_copias').get().then(function(snap){
    var copias = [];
    snap.forEach(function(doc){
      var d = doc.data();
      if(d && d.esIndice) copias.push({ id: doc.id, datos: d });
    });
    copias.sort(function(a,b){ return (b.datos.hora||0) - (a.datos.hora||0); });
    return copias;
  });
}

// Vuelve a como estaba en el momento de esa copia
function restaurarCopia(idCopia){
  return fbDb.collection('nbs_copias').doc(idCopia).get().then(function(doc){
    if(!doc.exists) throw new Error('No se encontró esa copia');
    var indice = doc.data();
    var claves = indice.claves || [];
    var promesas = claves.map(function(k){
      return fbDb.collection('nbs_copias').doc(idCopia + '__' + k).get().then(function(d){
        if(!d.exists) return null;
        var dd = d.data();
        if(dd.zip){
          return descomprimirTexto(dd.zip).then(function(txt){
            return txt ? { clave: k, valor: txt } : null;
          });
        }
        return dd.valor ? { clave: k, valor: dd.valor } : null;
      });
    });
    return Promise.all(promesas).then(function(partes){
      var buenas = partes.filter(function(p){ return p; });
      if(!buenas.length) throw new Error('No se pudo leer el contenido de esa copia');
      buenas.forEach(function(p){
        localStorage.setItem(p.clave, p.valor);
        localStorage.setItem('_hora_'+p.clave, String(Date.now())); // ahora ES lo mas nuevo
        marcarPendienteDeSubir(p.clave); // y hay que subirlo para que la nube tambien lo tenga
      });
      return buenas.length;
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
//   DETECTOR DE QUE ALGO SE BORRO
// ═══════════════════════════════════════════════════════════════════════════════
// Si al abrir la app hay MENOS ventas o clientes que la ultima vez, algo paso. Antes eso
// ocurria en silencio y te enterabas semanas despues -o nunca-. Ahora te avisa en el momento
// y te ofrece volver a una copia anterior.
var CLAVE_ULTIMO_CONTEO = 'nbs_ultimo_conteo';
var NOMBRES_BONITOS = { ncl:'clientes', nv:'ventas', nc:'compras', np:'productos', ngastos:'gastos', npedidos:'pedidos', nsup:'suplidores', ntarjetas:'tarjetas' };

// Estas claves NO se vigilan para el aviso de "algo se borro", porque BAJAN
// por diseno cuando todo esta bien -no son senal de perdida de datos-:
//   npedidos: un pedido se BORRA de esta lista justo cuando se completa de
//             verdad como venta -es un exito, no una perdida-.
//   ncr:      un dato viejo que la app ya no usa para nada -no afecta ningun
//             balance ni calculo que Sensei vea-. Se deja de vigilar (25 jul,
//             encontrado porque el aviso lo asustaba sin razon con estas dos).
var CLAVES_SIN_VIGILAR = { npedidos:true, ncr:true };
// Las libretas `_borrados_*` NO son datos de Sensei: son apuntes internos de que EL
// borro algo. Que suban o bajen es normal y no significa perdida de mercancia. El
// detector las estaba vigilando y le sacaba un aviso de "se borraron datos" que lo
// asustaba sin razon. -30 jul-
function esLibretaInterna(clave){
  return String(clave).indexOf('_borrados_') === 0 || String(clave).indexOf('_hora_') === 0;
}

// ═══ SONIDOS DE AVISO — hechos desde cero con el propio telefono, sin archivos de
// audio (25 jul, pedido por Sensei). No se puede copiar el sonido de Windows ni el de
// otra app -tienen derechos de autor-, asi que se armaron dos sonidos PROPIOS con el
// mismo espiritu: uno fuerte para avisos de precaucion, uno suave para recordatorios.
var _contextoAudio = null;
function _obtenerContextoAudio(){
  try{
    if(!_contextoAudio) _contextoAudio = new (window.AudioContext || window.webkitAudioContext)();
    if(_contextoAudio.state === 'suspended') _contextoAudio.resume();
    return _contextoAudio;
  }catch(e){ return null; }
}
// Un pitido simple, del tono y duracion que se le pida
function revisarSiFaltaAlgo(){
  var ahora = contarTodo();
  var antes;
  try{ antes = JSON.parse(localStorage.getItem(CLAVE_ULTIMO_CONTEO) || 'null'); }catch(e){ antes = null; }

  if(!antes){
    localStorage.setItem(CLAVE_ULTIMO_CONTEO, JSON.stringify(ahora));
    return;
  }

  var perdidas = [];
  Object.keys(antes).forEach(function(k){
    if(CLAVES_SIN_VIGILAR[k]) return;
    if(esLibretaInterna(k)) return;   // apuntes internos, no son datos de Sensei
    var a = antes[k] || 0;
    var b = ahora[k] || 0;
    // Solo avisa si la caida es de verdad -mas de 2, o mas del 10%-, para no molestar
    // cuando borras un cliente o cancelas una venta a proposito.
    if(b < a && (a - b) > 2 && (a - b) / a > 0.10){
      perdidas.push({ que: NOMBRES_BONITOS[k] || k, antes: a, ahora: b, faltan: a - b });
    }
  });

  localStorage.setItem(CLAVE_ULTIMO_CONTEO, JSON.stringify(ahora));

  if(perdidas.length){
    var msj = '⚠️ ATENCIÓN: parece que se borraron datos.\n\n';
    perdidas.forEach(function(p){
      msj += '   ' + p.que.toUpperCase() + ': tenías ' + p.antes + ', ahora hay ' + p.ahora + ' (faltan ' + p.faltan + ')\n';
    });
    msj += '\nSi tú no los borraste, puedes volver a una copia anterior.\n\n¿Quieres ver las copias guardadas?';
    setTimeout(function(){
      sonidoPrecaucion();
      if(confirm(msj)) irMenuProtegido('p-copias');
    }, 1200);
  }
}

// Al arrancar: traer las imagenes del almacen grande y repintar lo que se vea.
// Mientras cargan -son milisegundos- la app funciona igual, solo que una foto de
// gasto o una firma podria tardar un parpadeo en aparecer.
function iniciarCopiasAutomaticas(){
  try { arrancarAlmacenImagenes(); } catch(e){}
  revisarSiFaltaAlgo();
  // El recordatorio de bajar respaldo se revisa cada minuto, y aparece solo a los 30 min
  setTimeout(iniciarVigilanteDeRespaldo, 2500);
  // La primera copia se intenta a los 5 segundos de abrir -sin estorbar el arranque-
  setTimeout(function(){ hacerCopiaAutomatica(false); }, 5000);
  // Y despues se revisa cada 15 minutos si ya toca hacer la siguiente
  setInterval(function(){ hacerCopiaAutomatica(false); }, 15 * 60 * 1000);

  // ─── COPIA LOCAL DEL TELÉFONO CADA 30 MINUTOS (pedido por Sensei, 19 jul 2026) ───
  // Antes la copia del teléfono SOLO se hacía cada 5 facturas. Si un día solo registrabas
  // gastos (sin ventas), NUNCA se hacía copia y esos datos quedaban sin respaldo local.
  // Ahora además se hace por TIEMPO, cada 15 min, pase lo que pase. Doble protección.
  setInterval(function(){ hacerCopiaLocalSiCambio(); }, 15 * 60 * 1000);
  // La primera por tiempo, a los 5 segundos de abrir (para respaldar pronto)
  setTimeout(function(){ hacerCopiaLocalSiCambio(); }, 5000);

  // ─── RESPALDAR AL VOLVER A LA APP (pedido por Sensei, 19 jul 2026) ───
  // Los navegadores CONGELAN los temporizadores cuando la app no está en pantalla
  // (cierras la app, cambias de app, apagas la pantalla). Por eso los respaldos
  // automáticos se pausan y aparecen huecos de más de 15 minutos. Para arreglarlo:
  // cada vez que VUELVES a la app, se revisa si ya toca respaldar y se hace enseguida.
  document.addEventListener('visibilitychange', function(){
    if(document.visibilityState === 'hidden'){
      // Al SALIR de la app (mandarla a segundo plano): si hay huella registrada y el usuario
      // activó el bloqueo inmediato, se marca para bloquear en cuanto vuelva -aunque sean segundos-.
      if(bloqueoInmediatoActivado() && hayHuellaRegistrada() && typeof fbAuth !== 'undefined' && fbAuth && fbAuth.currentUser && !window._appBloqueada){
        // \ud83d\udd11 Se apunta CU\u00c1NDO sali\u00f3. Al volver se mira cu\u00e1nto tard\u00f3: si vuelve en
        // menos de 30 segundos, NO se le pide nada. Antes se le ped\u00eda la huella aunque
        // volviera en 2 segundos de mirar el WhatsApp, con el cliente delante. -8 sep-
        try{ localStorage.setItem(CLAVE_BLOQUEO_INMEDIATO_PENDIENTE, String(Date.now())); }catch(e){}
      }
    }
    if(document.visibilityState === 'visible'){
      // Al VOLVER: si quedó marcado el bloqueo inmediato, se bloquea la app de una vez (pide huella).
      var _cuandoSalio = parseInt(localStorage.getItem(CLAVE_BLOQUEO_INMEDIATO_PENDIENTE) || '0', 10);
      if(_cuandoSalio > 0 && hayHuellaRegistrada() && typeof fbAuth !== 'undefined' && fbAuth && fbAuth.currentUser && !window._appBloqueada){
        try{ localStorage.removeItem(CLAVE_BLOQUEO_INMEDIATO_PENDIENTE); }catch(e){}
        // \ud83d\udd11 SOLO se bloquea si estuvo fuera M\u00c1S DE 30 SEGUNDOS. -8 sep-
        var _fuera = Date.now() - _cuandoSalio;
        if(_fuera >= SEGUNDOS_PARA_BLOQUEAR * 1000){
          bloquearApp();
          return; // no seguir con las copias mientras está bloqueada
        }
        // Volvi\u00f3 enseguida: entra directo, sin pedirle nada
      }
      // Copia local del teléfono (siempre, refresca la hora aunque no haya cambios)
      hacerCopiaLocalSiCambio();
      // Copia en la nube si ya toca (cada 15 min) y hubo movimientos
      hacerCopiaAutomatica(false);
      // Revisar si hay versión nueva en GitHub y actualizar sola
      revisarVersionNueva();
    }
  });
}

// Hace una copia local del teléfono, pero SOLO si los datos cambiaron desde la última copia
// (así no se llena la memoria con copias idénticas cuando la app está abierta sin usarse).
function hacerCopiaLocalSiCambio(){
  try{
    var huellaActual = '';
    CLAVES_COPIA_LOCAL.forEach(function(k){
      var v = localStorage.getItem(k);
      huellaActual += k + ':' + (v ? v.length : 0) + '|';
    });
    var huellaPrevia = localStorage.getItem('nbs_huella_ultima_copia_local') || '';
    if(huellaActual === huellaPrevia){
      // Nada cambió: en vez de crear una copia idéntica (que llenaría el teléfono),
      // se actualiza la HORA de la copia más reciente. Así Sensei ve siempre una hora
      // fresca -tranquilidad de que sigue respaldando- sin acumular copias repetidas.
      tocarHoraUltimaCopiaLocal();
      return;
    }
    hacerCopiaLocal().then(function(ok){
      if(ok) localStorage.setItem('nbs_huella_ultima_copia_local', huellaActual);
    });
  }catch(e){ console.error('Copia local por tiempo falló:', e); }
}

// Actualiza la fecha/hora de la copia más reciente del teléfono (cuando nada cambió).
// No crea una copia nueva: solo refresca la hora de la que ya está arriba.
function tocarHoraUltimaCopiaLocal(){
  try{
    var copias = leerCopiasLocales();
    if(!copias.length) return;
    var ahora = Date.now();
    copias[0].hora = ahora;
    copias[0].fecha = fechaHoy();
    copias[0].horaTexto = new Date(ahora).toLocaleTimeString('en-US', {hour:'numeric', minute:'2-digit', hour12:true});
    copias[0].sinCambios = true; // marca: es la misma copia, solo se refrescó la hora
    localStorage.setItem(CLAVE_COPIAS_LOCALES, JSON.stringify(copias));
  }catch(e){ console.error('No se pudo refrescar la hora de la copia:', e); }
}

// ═══════════════════════════════════════════════════════════════════════════════
//   COPIAS DENTRO DEL PROPIO TELEFONO  —  cada 5 facturas, SIN internet
// ═══════════════════════════════════════════════════════════════════════════════
// Idea de Sensei, y cubre un hueco real: las copias de la nube NECESITAN INTERNET, y en la
// van, entre barberia y barberia, muchas veces no hay señal. Ahi no se hace ninguna copia.
// Estas se guardan DENTRO del telefono cada 5 facturas, sin internet y sin tocar un boton.
//
// Se guardan con localStorage directo -NO con SS()- a proposito: asi nunca se suben a la
// nube y, sobre todo, la nube NUNCA las puede sobrescribir. Ese fue el error del 16 de julio.
//
// Solo se guardan los datos del NEGOCIO -ventas, clientes, compras, cobros...-, no los
// productos: las fotos de productos pesan 1 MB y llenarian la memoria del telefono en 10
// copias. Los productos casi no cambian y estan a salvo en las copias de la nube.
// Se agregaron np -los productos con sus precios, costos, stock y fotos-, nsup -los
// suplidores-, historial_precios, nvan y nrelleno. Antes las copias del telefono no los
// llevaban, asi que una copia local no era una foto completa del negocio. Encontrado en
// la auditoria del 27 jul.
var CLAVES_COPIA_LOCAL = ['nv','ncl','nc','ncr','ngastos','ntarjetas','notrasdeudas','npedidos','ndevoluciones','nvisitas_barberos',
                          'np','nsup','historial_precios','nvan','nrelleno','ncierres_ruta','nconfirmaciones','rutas_por_dia',
                          'nbs_facturas_emparejadas'];
var FACTURAS_ENTRE_COPIAS = 5;
var COPIAS_LOCALES_QUE_SE_GUARDAN = 40; // 40 copias del teléfono (cada 15 min ≈ el último día de trabajo)
var CLAVE_COPIAS_LOCALES = 'nbs_copias_locales';
var CLAVE_CONTEO_NV_COPIA = 'nbs_nv_ultima_copia_local';

function leerCopiasLocales(){
  try{ return JSON.parse(localStorage.getItem(CLAVE_COPIAS_LOCALES) || '[]'); }catch(e){ return []; }
}

function hacerCopiaLocal(){
  var partes = {};
  var promesas = [];
  CLAVES_COPIA_LOCAL.forEach(function(k){
    var crudo = localStorage.getItem(k);
    if(crudo === null) return;
    // ⚠️ LOS PRODUCTOS VAN SIN FOTOS. El 28 de julio se agrego 'np' a las copias del
    // telefono sin caer en que los productos llevan las fotos ADENTRO: 10 copias con
    // fotos llenaron la memoria y la app dejo de poder guardar. Las fotos viven en la
    // nube -coleccion nbs_fotos- y en el 'np' de ahora, asi que en las copias sobran.
    if(k === 'np'){
      try {
        var lista = JSON.parse(crudo);
        if(Array.isArray(lista) && typeof quitarFotos === 'function'){
          crudo = JSON.stringify(quitarFotos(lista));
        }
      } catch(e){}
    }
    // Las fotos de gastos y compras y las firmas viven ahora en el almacen grande,
    // asi que en las copias del telefono sobran igual que las de productos. Si no se
    // quitaran, una copia hecha justo antes de la mudanza se las llevaria dentro y el
    // espacio liberado se volveria a ocupar. -1 ago-
    if(typeof CLAVES_CON_IMAGEN !== 'undefined' && CLAVES_CON_IMAGEN[k]){
      try {
        var campoImg = CLAVES_CON_IMAGEN[k];
        var lista2 = JSON.parse(crudo);
        if(Array.isArray(lista2)){
          crudo = JSON.stringify(lista2.map(function(r){
            if(!r || typeof r !== 'object' || !r[campoImg]) return r;
            var cp = {}; for(var kk in r){ if(kk !== campoImg) cp[kk] = r[kk]; }
            return cp;
          }));
        }
      } catch(e){}
    }
    promesas.push(comprimirTexto(crudo).then(function(z){
      partes[k] = z ? { zip: z } : { valor: crudo };
    }));
  });
  return Promise.all(promesas).then(function(){
    var copias = leerCopiasLocales();
    copias.unshift({
      hora: Date.now(),
      fecha: fechaHoy(),
      horaTexto: new Date().toLocaleTimeString('en-US', {hour:'numeric', minute:'2-digit', hour12:true}),
      conteo: contarTodo(),
      partes: partes
    });
    copias = copias.slice(0, COPIAS_LOCALES_QUE_SE_GUARDAN); // solo las ultimas 10
    try{
      localStorage.setItem(CLAVE_COPIAS_LOCALES, JSON.stringify(copias));
      // ═══ VERIFICACION DE VERDAD ═══
      // Se vuelve a LEER lo que se acaba de guardar y se comprueba que este completo.
      // Sin esto, la app podia decir "guardada" cuando en realidad no se guardo nada -por
      // ejemplo, si la memoria del telefono se lleno-.
      var releido = leerCopiasLocales();
      var laNueva = releido.find(function(x){ return String(x.hora) === String(copias[0].hora); });
      if(!laNueva || !laNueva.partes || !Object.keys(laNueva.partes).length){
        console.error('La copia del telefono NO quedo guardada de verdad');
        return false;
      }
      localStorage.setItem(CLAVE_CONTEO_NV_COPIA, String((LS('nv',[]) || []).length));
      console.log('Copia verificada en el telefono: '+Object.keys(laNueva.partes).length+' parte(s). Total: '+releido.length);
      return true;
    }catch(e){
      // Si la memoria del telefono se lleno, se van botando las mas viejas
      console.error('No cupo la copia en el telefono, se quitan las mas viejas:', e);
      try{
        localStorage.setItem(CLAVE_COPIAS_LOCALES, JSON.stringify(copias.slice(0, 3)));
        return true;
      }catch(e2){ return false; }
    }
  });
}

// Se llama sola cada vez que se guardan ventas: si ya hay 5 facturas nuevas, hace la copia
function revisarSiTocaCopiaLocal(k, v){
  if(k !== 'nv' || !Array.isArray(v)) return;
  // El aviso se refresca con CADA factura, no solo cuando toca hacer copia. Sin esto el
  // numero se quedaba atrasado: con 16 facturas seguia diciendo 12, porque solo se
  // actualizaba al hacer la copia -cada 5-.
  setTimeout(mostrarAvisoRespaldo, 0);
  var ultimo = parseInt(localStorage.getItem(CLAVE_CONTEO_NV_COPIA) || '0', 10);
  if(v.length >= ultimo + FACTURAS_ENTRE_COPIAS){
    hacerCopiaLocal();
  }
}

function restaurarCopiaLocal(hora){
  var copias = leerCopiasLocales();
  var c = copias.find(function(x){ return String(x.hora) === String(hora); });
  if(!c) return Promise.reject(new Error('No se encontró esa copia'));
  var promesas = Object.keys(c.partes).map(function(k){
    var p = c.partes[k];
    if(p.zip){
      return descomprimirTexto(p.zip).then(function(txt){ return txt ? {clave:k, valor:txt} : null; });
    }
    return Promise.resolve(p.valor ? {clave:k, valor:p.valor} : null);
  });
  return Promise.all(promesas).then(function(partes){
    var buenas = partes.filter(function(x){ return x; });
    if(!buenas.length) throw new Error('No se pudo leer esa copia');
    buenas.forEach(function(p){
      localStorage.setItem(p.clave, p.valor);
      localStorage.setItem('_hora_'+p.clave, String(Date.now())); // ahora ES lo mas nuevo
      marcarPendienteDeSubir(p.clave);
    });
    return buenas.length;
  });
}

// ===== EL AVISO DE BAJAR UN RESPALDO =====
// Una barrita que NO te bloquea: la puedes ignorar mientras atiendes al barbero, y sigue
// ahi cuando tengas un momento. Nada de ventanas que te paren en medio de la ruta.
//
// AVISA CADA 30 MINUTOS -decidido con Sensei el 17 de julio de 2026-. Antes solo avisaba
// cada 5 facturas, y eso dejaba un hueco: un dia de pocas ventas podias pasar horas -o
// dias- sin bajar un respaldo y la app no decia nada.
//
// POR QUE TIENES QUE TOCARLA TU -verificado el 17 de julio de 2026-:
// Desde Chrome 125 (mayo 2024), el navegador BLOQUEA toda descarga que no venga de un toque
// del usuario dentro de los 500 ms siguientes. Una descarga automatica seria bloqueada
// siempre. Tu toque ES el permiso que Chrome exige. Por eso hay un boton y no magia.
var CLAVE_NV_ULTIMO_RESPALDO = 'nbs_nv_al_bajar_respaldo';
var CLAVE_SNOOZE_RESPALDO = 'nbs_snooze_respaldo';
var MINUTOS_ENTRE_AVISOS = 30;

// Cuantas facturas llevas desde la ultima vez que bajaste un respaldo
function facturasSinRespaldar(){
  var ahora = (LS('nv', []) || []).length;
  var alBajar = localStorage.getItem(CLAVE_NV_ULTIMO_RESPALDO);
  if(alBajar === null){
    // Primera vez: se toma el momento actual como punto de partida, para no asustarte
    // con un numero enorme el primer dia.
    localStorage.setItem(CLAVE_NV_ULTIMO_RESPALDO, String(ahora));
    return 0;
  }
  return Math.max(0, ahora - parseInt(alBajar, 10));
}

// Cuantos minutos llevas sin bajar un respaldo
function minutosSinRespaldar(){
  var ultimo = parseInt(localStorage.getItem('ultimoBackup') || '0', 10);
  if(!ultimo) return 9999; // nunca has bajado uno
  return Math.floor((Date.now() - ultimo) / 60000);
}

function textoTiempo(mins){
  if(mins >= 9999) return 'nunca has bajado un respaldo';
  if(mins < 60) return 'Llevas ' + mins + ' min sin bajar respaldo';
  var h = Math.floor(mins / 60);
  if(h < 24) return 'Llevas ' + h + ' hora(s) sin bajar respaldo';
  return 'Llevas ' + Math.floor(h/24) + ' día(s) sin bajar respaldo';
}

function nMon(x){
  var v = parseFloat(x);
  return isFinite(v) ? Math.round(v * 100) / 100 : 0;
}

function horaLocalDe(k){
  return parseInt(localStorage.getItem('_hora_'+k) || '0', 10);
}


// ═══════════════════════════════════════════════════════════════════════════
//  SINCRONIZACION QUE JUNTA EN VEZ DE PISAR  (29 jul 2026)
// ═══════════════════════════════════════════════════════════════════════════
//
// EL PROBLEMA QUE RESUELVE: hasta hoy la app comparaba la LISTA ENTERA. Si el
// telefono era mas nuevo, se quedaba con todo lo del telefono; si la nube era
// mas nueva, con todo lo de la nube. Resultado: Sensei corregia precios en la
// PC, vendia en el telefono, y al juntarse uno de los dos lados se perdia
// completo. El 28 de julio perdio asi 31 correcciones de precios y nombres,
// 23 fotos y el historial de precios.
//
// LA SOLUCION: cada REGISTRO lleva su propia hora de modificacion (`mod`), y al
// juntar se compara UNO POR UNO. La PC cambio el producto A y el telefono
// vendio el B -> los dos sobreviven.
//
// COMO SE PONE LA HORA: sola, dentro de SS(), que es el unico sitio por donde
// pasa todo lo que se guarda. No hay que tocar los cien lugares donde la app
// crea o edita algo.
//
// LO QUE BORRAS SE QUEDA BORRADO: si se borra un registro, se anota su id y la
// hora en una lista de borrados. Al juntar, un registro no puede resucitar
// porque el otro aparato todavia lo tenga.

// Las claves que son LISTAS de registros con id -esas se funden uno por uno-
var CLAVES_CON_REGISTROS = ['ncl','nv','nc','ncr','np','nsup','ngastos',
                            'ntarjetas','notrasdeudas','npedidos','ndevoluciones',
                            'impresoras_lista'];

// Cuadernos que SOLO CRECEN: se unen sin repetir, nunca se pisan
var CLAVES_CUADERNO = ['historial_precios','np_eliminados','nbs_correcciones_van'];

// Mapas: se juntan clave por clave
var CLAVES_MAPA = ['nbs_facturas_emparejadas','nvisitas_barberos','rutas_por_dia'];

function esListaDeRegistros(k){ return CLAVES_CON_REGISTROS.indexOf(k) >= 0; }
function claveDeBorrados(k){ return '_borrados_' + k; }

// El JSON del registro SIN su sello, para poder ver si de verdad cambio algo.
// Si se comparara con el sello puesto, todo pareceria cambiado siempre.
function sinSello(reg){
  if(!reg || typeof reg !== 'object') return JSON.stringify(reg);
  var copia = {};
  for(var p in reg){ if(p !== 'mod' && Object.prototype.hasOwnProperty.call(reg, p)) copia[p] = reg[p]; }
  return JSON.stringify(copia);
}

function leerBorrados(k){
  var lista = [];
  try {
    var b = JSON.parse(localStorage.getItem(claveDeBorrados(k)) || '[]');
    if(Array.isArray(b)) lista = b.slice();
  } catch(e){}
  // Y tambien lo que trae la nube en esta misma bajada, aunque aun no este guardado.
  // Sin esto, un borrado hecho en el otro aparato podia resucitar. -30 jul-
  var deLaBajada = _borradosDeEstaBajada[claveDeBorrados(k)];
  if(Array.isArray(deLaBajada)){
    var vistos = {};
    lista.forEach(function(x){ if(x && x.id !== undefined) vistos[String(x.id)] = true; });
    deLaBajada.forEach(function(x){
      if(x && x.id !== undefined && !vistos[String(x.id)]) lista.push(x);
    });
  }
  return lista;
}

// Le pone la hora a los registros que CAMBIARON, y anota los que se borraron.
// Corre dentro de SS(), antes de guardar. Medido con los datos reales de Sensei
// -505 productos, 270 ventas- en un telefono 4 veces mas lento: 24 y 29 ms.
function sellarCambios(k, lista){
  if(!esListaDeRegistros(k) || !Array.isArray(lista)) return lista;
  var ahora = Date.now();
  var antes = [];
  try { antes = JSON.parse(localStorage.getItem(k) || '[]'); } catch(e){ antes = []; }
  if(!Array.isArray(antes)) antes = [];

  var previos = {};
  antes.forEach(function(x){ if(x && x.id !== undefined) previos[String(x.id)] = x; });

  var vistos = {};
  lista.forEach(function(reg){
    if(!reg || typeof reg !== 'object' || reg.id === undefined) return;
    var id = String(reg.id);
    vistos[id] = true;
    var viejo = previos[id];
    if(!viejo){
      reg.mod = ahora;                                   // registro nuevo
    } else if(sinSello(viejo) !== sinSello(reg)){
      reg.mod = ahora;                                   // cambio de verdad
    } else if(reg.mod === undefined && viejo.mod !== undefined){
      reg.mod = viejo.mod;                               // no cambio: conserva su hora
    }
  });

  // Los que estaban y ya no estan: quedan anotados como borrados
  var borrados = leerBorrados(k);
  var yaAnotados = {};
  borrados.forEach(function(b){ yaAnotados[String(b.id)] = true; });
  var huboBorrados = false;
  antes.forEach(function(x){
    if(!x || x.id === undefined) return;
    var id = String(x.id);
    if(!vistos[id] && !yaAnotados[id]){
      borrados.push({ id: id, mod: ahora });
      huboBorrados = true;
    }
  });
  if(huboBorrados){
    if(borrados.length > 900) borrados = borrados.slice(-900);   // no crecer para siempre
    try { localStorage.setItem(claveDeBorrados(k), JSON.stringify(borrados)); } catch(e){}
  }
  return lista;
}

function horaDe(reg){
  var m = reg && reg.mod;
  return (typeof m === 'number' && isFinite(m)) ? m : 0;
}

// ═══ JUNTAR DOS LISTAS, REGISTRO POR REGISTRO ═══
// Gana el que se modifico despues. Si empatan -por ejemplo los dos sin sello,
// que es como estan todos los registros viejos-, gana el del TELEFONO: es donde
// Sensei trabaja y lo mas reciente casi siempre esta ahi.
function fundirListas(k, deLaNube, delTelefono){
  if(!Array.isArray(deLaNube)) return delTelefono;
  if(!Array.isArray(delTelefono)) return deLaNube;

  var resultado = {}, orden = [];
  function meter(reg, esDelTelefono){
    if(!reg || typeof reg !== 'object' || reg.id === undefined) return;
    var id = String(reg.id);
    if(!(id in resultado)){ resultado[id] = reg; orden.push(id); return; }
    var actual = resultado[id];
    var hA = horaDe(actual), hN = horaDe(reg);
    if(hN > hA) resultado[id] = reg;
    else if(hN === hA && esDelTelefono) resultado[id] = reg;   // empate: manda el telefono
  }
  deLaNube.forEach(function(r){ meter(r, false); });
  delTelefono.forEach(function(r){ meter(r, true); });

  // Aplicar lo borrado: si un registro esta anotado como borrado DESPUES de su
  // ultima modificacion, se va. Asi lo que borro no puede resucitar.
  var borrados = leerBorrados(k);
  borrados.forEach(function(b){
    var id = String(b.id);
    var reg = resultado[id];
    if(reg && horaDe(reg) <= (b.mod || 0)) delete resultado[id];
  });

  var salida = [];
  orden.forEach(function(id){ if(resultado[id]) salida.push(resultado[id]); });
  return salida;
}

// Une dos libretas de borrados sin repetir. Si el mismo id esta en las dos, se queda
// con la hora MAS VIEJA: fue el momento en que de verdad se borro.
function fundirBorrados(deLaNube, delTelefono){
  if(!Array.isArray(deLaNube)) return delTelefono;
  if(!Array.isArray(delTelefono)) return deLaNube;
  var porId = {}, orden = [];
  function meter(x){
    if(!x || x.id === undefined) return;
    var id = String(x.id);
    if(!(id in porId)){ porId[id] = x; orden.push(id); return; }
    var m1 = porId[id].mod || 0, m2 = x.mod || 0;
    if(m2 && (!m1 || m2 < m1)) porId[id] = x;
  }
  deLaNube.forEach(meter);
  delTelefono.forEach(meter);
  var salida = [];
  orden.forEach(function(id){ salida.push(porId[id]); });
  if(salida.length > 900) salida = salida.slice(-900);
  return salida;
}

// Cuadernos que solo crecen: se unen sin repetir
function fundirCuaderno(deLaNube, delTelefono){
  if(!Array.isArray(deLaNube)) return delTelefono;
  if(!Array.isArray(delTelefono)) return deLaNube;
  var vistos = {}, salida = [];
  function meter(x){
    var llave = (x && typeof x === 'object') ? JSON.stringify(x) : String(x);
    if(vistos[llave]) return;
    vistos[llave] = true;
    salida.push(x);
  }
  deLaNube.forEach(meter);
  delTelefono.forEach(meter);
  return salida;
}

// Mapas: se juntan clave por clave; ante duda manda el telefono
function fundirMapa(deLaNube, delTelefono){
  if(!deLaNube || typeof deLaNube !== 'object') return delTelefono;
  if(!delTelefono || typeof delTelefono !== 'object') return deLaNube;
  var salida = {};
  for(var a in deLaNube){ if(Object.prototype.hasOwnProperty.call(deLaNube, a)) salida[a] = deLaNube[a]; }
  for(var b in delTelefono){ if(Object.prototype.hasOwnProperty.call(delTelefono, b)) salida[b] = delTelefono[b]; }
  return salida;
}

// El que usa la bajada de la nube. Devuelve el TEXTO ya fundido, o null si esa
// clave no se sabe fundir -y entonces se hace lo de siempre-.
// Lo que la nube trae en ESTA misma bajada, para que fundirListas pueda mirar la
// libreta de borrados aunque todavia no se haya guardado en el telefono. Es la segunda
// red por si el orden fallara. -30 jul-
var _borradosDeEstaBajada = {};

// Se llama ANTES de fundir nada, con TODO lo que trae la nube en esta tanda. Registra
// las libretas de borrados de una vez, para que al fundir cualquier lista ya se sepa
// que estaba borrado — sin importar en que orden lleguen los documentos.
// Es la cura de raiz del fallo del 30 jul: un cliente borrado en la PC resucitaba en
// el telefono solo porque `ncl` llegaba antes que `_borrados_ncl`.
function prepararBorradosDeLaTanda(tanda){
  _borradosDeEstaBajada = {};
  if(!tanda) return 0;
  var cuantas = 0;
  Object.keys(tanda).forEach(function(clave){
    if(String(clave).indexOf('_borrados_') !== 0) return;
    try {
      var lista = JSON.parse(tanda[clave]);
      if(Array.isArray(lista)){ _borradosDeEstaBajada[clave] = lista; cuantas++; }
    } catch(e){}
  });
  return cuantas;
}

function SS(k,v){
  // Devuelve si de verdad se pudo guardar. Nadie usaba el resultado de SS, asi que
  // agregarlo no rompe nada — lo necesita el puente de traer cambios. -4 ago-
  var _seGuardoBien = false;
  // \u26a1 Si cambian las ventas, los clientes o los productos, el cajon del VIP deja de
  // valer: se vacia para que los puntos se calculen de nuevo. -5 sep-
  if(k === 'nv' || k === 'ncl' || k === 'np'){
    try { if(typeof vaciarCajonVIP === 'function') vaciarCajonVIP(); } catch(e){}
  }
  try{
    // 🔑 PRIMERO se sacan las imagenes, DESPUES se sella. En ese orden, y no al
    // reves: `sellarCambios` compara lo nuevo contra lo guardado, y si uno tuviera
    // la imagen y el otro no, creeria que TODOS los registros cambiaron y les
    // pondria hora nueva a todos. Eso ensuciaria la sincronizacion. -1 ago-
    // La red de los pedidos: apunta el cambio y guarda copia si desaparecen varios
    if(k === 'npedidos'){ try { vigilarPedidos(v); } catch(eVig){} }
    var _paraGuardar = v;
    if(CLAVES_CON_IMAGEN[k]){
      try { _paraGuardar = sacarImagenes(k, v); } catch(eImg){ _paraGuardar = v; }
    }
    // Ponerle la hora a los registros que cambiaron, para poder juntar sin pisar
    try { _paraGuardar = sellarCambios(k, _paraGuardar); } catch(eSello){ console.error('No se pudo sellar', k, eSello); }
    localStorage.setItem(k,JSON.stringify(_paraGuardar));
    _seGuardoBien = true;
    marcarHoraLocal(k);
    revisarSiTocaCopiaLocal(k, v); // cada 5 facturas guarda una copia DENTRO del telefono
  }catch(e){
    // ═══ ARREGLO CRITICO (22 jul 2026) ═══
    // ANTES este catch estaba VACIO: si el telefono no podia guardar -memoria
    // llena, modo privado, permisos- el dato se perdia EN SILENCIO y Sensei
    // seguia trabajando creyendo que todo se habia guardado. Ahora se avisa
    // fuerte y claro, para que pueda actuar antes de perder el dia de trabajo.
    console.error('FALLO AL GUARDAR', k, e);
    try{
      var ahora = Date.now();
      if(!window._ultimoAvisoGuardado || ahora - window._ultimoAvisoGuardado > 15000){
        window._ultimoAvisoGuardado = ahora;
        var msg = '\u26a0\ufe0f NO SE PUDO GUARDAR\n\n'
          + 'El telefono no pudo guardar la informacion (' + k + ').\n\n'
          + 'QUE HACER AHORA:\n'
          + '1. Anota en papel lo que acabas de registrar\n'
          + '2. Libera espacio en el telefono\n'
          + '3. Cierra y vuelve a abrir la app\n\n'
          + 'NO sigas trabajando hasta resolverlo: lo que hagas no se va a guardar.';
        try{ sonidoPrecaucion(); }catch(eSonido){}
        if(typeof avisoGrande === 'function') avisoGrande(msg);
        else if(typeof _alertNativo === 'function') _alertNativo(msg);
      }
    }catch(e2){}
  }
  // Ademas de guardar local -como siempre-, se manda una copia a la nube en segundo plano.
  // Si no hay internet o falla, la app sigue funcionando igual con lo que ya guardo local;
  // esto nunca bloquea ni retrasa el uso normal de la app.
  // Se apunta SIEMPRE que sea un dato del negocio, aunque la sesion todavia no haya
  // cargado. Antes solo se apuntaba con la sesion lista, y las ventas hechas en los
  // primeros segundos de abrir la app se quedaban sin subir para siempre. -30 jul-
  try {
    if(typeof CLAVES_A_RESPALDAR !== 'undefined' && CLAVES_A_RESPALDAR.indexOf(k) >= 0){
      marcarPendienteDeSubir(k);
    }
  } catch(eMarca){}

  if(typeof fbAuth !== 'undefined' && fbAuth && fbAuth.currentUser){
    // SOLO los datos del negocio. Antes se apuntaba CUALQUIER clave, incluidas las
    // internas (relojes, contadores, la meta semanal). Esas la nube las rechaza y se
    // quedaban atascadas para siempre en "cambios sin guardar". -30 jul-
    if(typeof CLAVES_A_RESPALDAR === 'undefined' || CLAVES_A_RESPALDAR.indexOf(k) >= 0){
      marcarPendienteDeSubir(k);
    }
    // Los productos van a la nube SIN las fotos -esas se guardan cada una por su lado-.
    // Sin esto, los productos ocupaban el 97.1% del limite de Firebase y con una foto mas
    // dejaban de subir. Ver "LAS FOTOS DE LOS PRODUCTOS VAN APARTE" mas arriba.
    var esProductos = (k === 'np' && Array.isArray(v));
    var esClientes = (k === 'ncl' && Array.isArray(v));
    var esVentas = (k === 'nv' && Array.isArray(v));   // las firmas van aparte -28 ago-
    var doc = {
      valor: JSON.stringify(esProductos ? quitarFotos(v)
                          : (esClientes ? quitarFotosClientes(v)
                          : (esVentas ? quitarFirmas(v) : v))),
      actualizado: Date.now()
    };
    if(esProductos) doc.pidsConFoto = pidsConFoto(v); // para saber cuales fotos hay que bajar
    if(esVentas) doc.vidsConFirma = vidsConFirma(v);  // idem con las firmas
    fbDb.collection('nbs_data').doc(k.replace(/\//g,'_')).set(doc).then(function(){
      quitarPendienteDeSubir(k);
      if(esProductos) sincronizarFotos(v);
      if(esClientes) sincronizarFotosClientes(v); // las fotos de clientes van aparte
      if(esVentas) sincronizarFirmas(v);
    }).catch(function(e){
      console.error('No se pudo sincronizar "'+k+'" con la nube:', e);
      // Se queda marcado como pendiente: la app avisara y reintentara
    });
  }
  return _seGuardoBien;
}

// ===== LO QUE NO HA SUBIDO A LA NUBE =====
// Si no hay internet -pasa todo el tiempo en la ruta-, el guardado local funciona pero la
// subida a la nube falla. Antes eso fallaba EN SILENCIO. Ahora queda anotado, la app te avisa,
// y reintenta sola cuando vuelve la señal.
var CLAVE_PENDIENTES = 'nbs_pendientes_subir';

// Para no ensenarle a Sensei nombres de programador como "ncl" o "npedidos".
var NOMBRES_DE_CLAVES = { ncl:'clientes', nc:'compras', nsup:'suplidores', nv:'ventas',
  np:'productos', npedidos:'pedidos', ngastos:'gastos', ndevoluciones:'devoluciones',
  nvisitas:'visitas', ncuadres:'cuadres de caja', ncreditos:'creditos', nrutas:'rutas',
  nvip:'programa VIP', npremios:'premios', nbalances:'balances', nfotos:'fotos',
  nnotas:'notas', nprecios:'precios', ntarjetas:'tarjetas', ndeudas:'deudas' };
function nombreBonitoDeClave(k){ return NOMBRES_DE_CLAVES[k] || k; }
function quitarPendienteDeSubir(k){
  try{
    var p = JSON.parse(localStorage.getItem(CLAVE_PENDIENTES) || '{}');
    delete p[k];
    localStorage.setItem(CLAVE_PENDIENTES, JSON.stringify(p));
    actualizarAvisoPendientes();
  }catch(e){}
}
// 🔴 ESTA FUNCION NO EXISTIA -19 ago-. `subirPendientes` la llamaba dentro de un
// try/catch, asi que reventaba EN SILENCIO en cada intento y la limpieza nunca se hacia.
// Si en la lista de pendientes se colaba una clave que no es un dato de la app -por
// ejemplo un ajuste o algo de una version vieja-, se quedaba ahi PARA SIEMPRE: nunca
// podia subir, nunca se quitaba, y el aviso naranja se quedaba encendido sin razon.
var CLAVES_QUE_SI_SON_DATOS = ['ncl','nc','nsup','nv','np','npedidos','ngastos','ndevoluciones',
  'nvisitas','ncuadres','ncreditos','nrutas','nvip','npremios','nbalances','nfotos','nnotas',
  'nprecios','nmarcas','ncategorias','ntarjetas','ndeudas','nreposicion'];
function limpiarPendientesQueNoSonDatos(){
  try{
    var p = JSON.parse(localStorage.getItem(CLAVE_PENDIENTES) || '{}');
    var cambio = false;
    Object.keys(p).forEach(function(k){
      var esDato = CLAVES_QUE_SI_SON_DATOS.indexOf(k) >= 0;
      // Tambien vale si hay algo guardado con esa clave: asi no se borra un dato nuevo
      // que todavia no este en la lista de arriba.
      var existeEnElAparato = localStorage.getItem(k) !== null;
      if(!esDato && !existeEnElAparato){ delete p[k]; cambio = true; }
    });
    if(cambio) localStorage.setItem(CLAVE_PENDIENTES, JSON.stringify(p));
  }catch(e){}
}

// Los nombres de lo que esta esperando subir, para poder decirselo a Sensei.
function nombresPendientesDeSubir(){
  try{
    return Object.keys(JSON.parse(localStorage.getItem(CLAVE_PENDIENTES) || '{}'));
  }catch(e){ return []; }
}

function hayPendientesDeSubir(){
  try{
    var p = JSON.parse(localStorage.getItem(CLAVE_PENDIENTES) || '{}');
    return Object.keys(p).length;
  }catch(e){ return 0; }
}
var clientes=LS('ncl',[]);
var compras=LS('nc',[]);
var suplidores=LS('nsup',[]);
var ventaActual = null;
var ventas=[];
var creditos=[];
var iCC = [];



// === SISTEMA DE AUTOCOMPLETADO DE DIRECCIÓN ===
var ZIP_DATA = {
  // Rhode Island
  '02860':'Pawtucket,RI','02861':'Pawtucket,RI','02863':'Central Falls,RI',
  '02864':'Cumberland,RI','02865':'Lincoln,RI','02871':'Portsmouth,RI',
  '02874':'North Kingstown,RI','02876':'Burrillville,RI','02878':'Tiverton,RI',
  '02879':'South Kingstown,RI','02882':'Narragansett,RI','02885':'Warren,RI',
  '02886':'Warwick,RI','02887':'Warwick,RI','02888':'Warwick,RI','02889':'Warwick,RI',
  '02891':'Westerly,RI','02893':'West Warwick,RI','02895':'Woonsocket,RI',
  '02896':'North Smithfield,RI','02901':'Providence,RI','02902':'Providence,RI',
  '02903':'Providence,RI','02904':'Providence,RI','02905':'Providence,RI',
  '02906':'Providence,RI','02907':'Providence,RI','02908':'Providence,RI',
  '02909':'Providence,RI','02910':'Cranston,RI','02911':'North Providence,RI',
  '02914':'East Providence,RI','02915':'East Providence,RI','02916':'Rumford,RI',
  '02917':'Smithfield,RI','02919':'Johnston,RI','02920':'Cranston,RI',
  '02921':'Cranston,RI','02806':'Barrington,RI','02807':'Block Island,RI',
  '02809':'Bristol,RI','02813':'Charlestown,RI','02816':'Coventry,RI',
  '02817':'West Greenwich,RI','02818':'East Greenwich,RI','02822':'Exeter,RI',
  '02825':'Foster,RI','02828':'Greenville,RI','02830':'Harrisville,RI',
  '02835':'Jamestown,RI','02837':'Little Compton,RI','02840':'Newport,RI',
  '02841':'Newport,RI','02842':'Middletown,RI','02852':'North Kingstown,RI',
  '02857':'North Scituate,RI',
  // Massachusetts
  '02101':'Boston,MA','02108':'Boston,MA','02109':'Boston,MA','02110':'Boston,MA',
  '02111':'Boston,MA','02114':'Boston,MA','02115':'Boston,MA','02116':'Boston,MA',
  '02118':'Boston,MA','02119':'Boston,MA','02120':'Boston,MA','02121':'Boston,MA',
  '02122':'Boston,MA','02124':'Boston,MA','02125':'Boston,MA','02126':'Boston,MA',
  '02127':'Boston,MA','02128':'Boston,MA','02129':'Boston,MA','02130':'Jamaica Plain,MA',
  '02131':'Roslindale,MA','02132':'West Roxbury,MA','02134':'Allston,MA',
  '02135':'Brighton,MA','02136':'Hyde Park,MA','02138':'Cambridge,MA',
  '02139':'Cambridge,MA','02140':'Cambridge,MA','02141':'Cambridge,MA',
  '02143':'Somerville,MA','02144':'Somerville,MA','02145':'Somerville,MA',
  '02148':'Malden,MA','02149':'Everett,MA','02150':'Chelsea,MA','02151':'Revere,MA',
  '02152':'Winthrop,MA','02155':'Medford,MA','02169':'Quincy,MA','02170':'Quincy,MA',
  '02171':'Quincy,MA','02176':'Melrose,MA','02180':'Stoneham,MA','02184':'Braintree,MA',
  '02186':'Milton,MA','02188':'Weymouth,MA','02190':'South Weymouth,MA',
  '02301':'Brockton,MA','02302':'Brockton,MA','02324':'Bridgewater,MA',
  '02332':'Duxbury,MA','02339':'Hanover,MA','02343':'Holbrook,MA',
  '02351':'Abington,MA','02360':'Plymouth,MA','02364':'Kingston,MA',
  '02368':'Randolph,MA','02370':'Rockland,MA','02382':'Whitman,MA',
  '02420':'Lexington,MA','02445':'Brookline,MA','02446':'Brookline,MA',
  '02451':'Waltham,MA','02452':'Waltham,MA','02453':'Waltham,MA',
  '02458':'Newton,MA','02459':'Newton Center,MA','02472':'Watertown,MA',
  '02474':'Arlington,MA','02476':'Arlington,MA','02478':'Belmont,MA',
  '02481':'Wellesley Hills,MA','02482':'Wellesley,MA','02492':'Needham,MA',
  '02493':'Weston,MA','02532':'Buzzards Bay,MA','02540':'Falmouth,MA',
  '02563':'Sandwich,MA','02601':'Hyannis,MA','02703':'Attleboro,MA',
  '02720':'Fall River,MA','02740':'New Bedford,MA','02747':'North Dartmouth,MA',
  '02760':'North Attleborough,MA','02766':'Norton,MA','02767':'Raynham,MA',
  '02769':'Rehoboth,MA','02771':'Seekonk,MA','02777':'Swansea,MA',
  '02780':'Taunton,MA','02790':'Westport,MA',
  '01013':'Chicopee,MA','01040':'Holyoke,MA','01060':'Northampton,MA',
  '01085':'Westfield,MA','01089':'West Springfield,MA','01103':'Springfield,MA',
  '01104':'Springfield,MA','01105':'Springfield,MA','01107':'Springfield,MA',
  '01108':'Springfield,MA','01109':'Springfield,MA','01201':'Pittsfield,MA',
  '01420':'Fitchburg,MA','01440':'Gardner,MA','01501':'Auburn,MA',
  '01545':'Shrewsbury,MA','01601':'Worcester,MA','01602':'Worcester,MA',
  '01603':'Worcester,MA','01604':'Worcester,MA','01605':'Worcester,MA',
  '01701':'Framingham,MA','01702':'Framingham,MA','01730':'Bedford,MA',
  '01742':'Concord,MA','01748':'Hopkinton,MA','01749':'Hudson,MA',
  '01752':'Marlborough,MA','01757':'Milford,MA','01760':'Natick,MA',
  '01801':'Woburn,MA','01803':'Burlington,MA','01810':'Andover,MA',
  '01821':'Billerica,MA','01824':'Chelmsford,MA','01826':'Dracut,MA',
  '01830':'Haverhill,MA','01840':'Lawrence,MA','01844':'Methuen,MA',
  '01845':'North Andover,MA','01850':'Lowell,MA','01851':'Lowell,MA',
  '01852':'Lowell,MA','01867':'Reading,MA','01876':'Tewksbury,MA',
  '01880':'Wakefield,MA','01887':'Wilmington,MA','01890':'Winchester,MA',
  '01901':'Lynn,MA','01902':'Lynn,MA','01904':'Lynn,MA','01905':'Lynn,MA',
  '01906':'Saugus,MA','01907':'Swampscott,MA','01913':'Amesbury,MA',
  '01915':'Beverly,MA','01923':'Danvers,MA','01930':'Gloucester,MA',
  '01938':'Ipswich,MA','01940':'Lynnfield,MA','01945':'Marblehead,MA',
  '01950':'Newburyport,MA','01960':'Peabody,MA','01966':'Rockport,MA',
  '01970':'Salem,MA','02021':'Canton,MA','02026':'Dedham,MA',
  '02035':'Foxborough,MA','02038':'Franklin,MA','02043':'Hingham,MA',
  '02048':'Mansfield,MA','02050':'Marshfield,MA','02062':'Norwood,MA',
  '02066':'Scituate,MA','02067':'Sharon,MA','02072':'Stoughton,MA',
  '02081':'Walpole,MA','02090':'Westwood,MA','02093':'Wrentham,MA'
};

var CIUDADES_RI_MA = [
  // Rhode Island
  'Providence','Cranston','Warwick','Pawtucket','East Providence',
  'Woonsocket','Coventry','Cumberland','North Providence','South Kingstown',
  'West Warwick','Johnston','North Kingstown','Newport','Bristol',
  'Westerly','Smithfield','Lincoln','Central Falls','Portsmouth',
  'Barrington','Middletown','Burrillville','North Smithfield','Scituate',
  'Tiverton','Warren','East Greenwich','West Greenwich','Narragansett',
  'Jamestown','Rumford','Greenville','Harrisville',
  // Massachusetts
  'Boston','Worcester','Springfield','Lowell','Cambridge','New Bedford',
  'Brockton','Quincy','Lynn','Fall River','Newton','Lawrence','Somerville',
  'Framingham','Haverhill','Waltham','Malden','Brookline','Plymouth',
  'Medford','Taunton','Weymouth','Revere','Peabody','Methuen','Barnstable',
  'Pittsfield','Attleboro','Everett','Salem','Westfield','Leominster',
  'Fitchburg','Beverly','Holyoke','Marlborough','Woburn','Chelmsford',
  'Shrewsbury','Northampton','Gloucester','Agawam','Dartmouth','Andover',
  'Watertown','Chelsea','Randolph','Billerica','Lexington','Milford',
  'Dracut','Tewksbury','Braintree','Bridgewater','Saugus','Yarmouth',
  'Canton','Needham','Wilmington','Stoughton','Natick','Norwood',
  'Wellesley','Easton','Westborough','North Attleborough','Marshfield',
  'Mansfield','Falmouth','Sandwich','Wareham','Duxbury','Scituate',
  'Hanover','Abington','Rockland','Holbrook','Avon','West Springfield',
  'Chicopee','Longmeadow','Amherst','Northampton','Gardner','Amesbury',
  'Newburyport','Rockport','Ipswich','Marblehead','Swampscott','Nahant',
  'Jamaica Plain','Roslindale','West Roxbury','Allston','Brighton',
  'Hyde Park','Winthrop','Medford','Milton','East Weymouth','South Weymouth',
  'Belmont','Arlington','Lexington','Weston','Concord','Hopkinton',
  'Burlington','Reading','Wakefield','Winchester','Lynnfield','Danvers',
  'Peabody','Beverly','Gloucester','Ipswich','Rowley','Topsfield',
  'Wenham','Hamilton','Manchester','Rockport'
];

var ESTADOS_US = [
  'Alabama','Alaska','Arizona','Arkansas','California','Colorado',
  'Connecticut','Delaware','Florida','Georgia','Hawaii','Idaho',
  'Illinois','Indiana','Iowa','Kansas','Kentucky','Louisiana',
  'Maine','Maryland','Massachusetts','Michigan','Minnesota','Mississippi',
  'Missouri','Montana','Nebraska','Nevada','New Hampshire','New Jersey',
  'New Mexico','New York','North Carolina','North Dakota','Ohio','Oklahoma',
  'Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota',
  'Tennessee','Texas','Utah','Vermont','Virginia','Washington',
  'West Virginia','Wisconsin','Wyoming'
];

function crearDropdown(id){
  var d = document.getElementById(id+'-drop');
  if(!d){
    d = document.createElement('div');
    d.id = id+'-drop';
    d.style.cssText = 'display:none;background:white;border:2px solid #1565C0;border-radius:8px;max-height:200px;overflow-y:auto;margin-top:2px;margin-bottom:8px;box-shadow:0 4px 16px rgba(0,0,0,0.18);z-index:9999';
    var inp = document.getElementById(id);
    if(inp && inp.parentNode){
      inp.parentNode.insertBefore(d, inp.nextSibling);
    }
  }
  return d;
}

function mostrarDropdown(dropId, opciones, inputId, onSelect){
  var el = document.getElementById(dropId);
  if(!el) el = crearDropdown(inputId);
  if(!el || !opciones.length){ if(el) el.style.display='none'; return; }
  el.innerHTML = '';
  el.style.display = 'block';
  opciones.slice(0,10).forEach(function(op){
    var d = document.createElement('div');
    d.style.cssText = 'padding:10px 14px;border-bottom:1px solid #f0f0f0;cursor:pointer;font-size:13px;color:#1a237e;font-weight:500';
    d.textContent = op;
    d.onmousedown = function(e){ e.preventDefault(); };
    d.onclick = function(){
      onSelect(op);
      el.style.display = 'none';
    };
    d.onmouseover = function(){ this.style.background='#E8EAF6'; };
    d.onmouseout = function(){ this.style.background='white'; };
    el.appendChild(d);
  });
}

function ocultarDropdown(id){
  setTimeout(function(){
    var el = document.getElementById(id+'-drop');
    if(el) el.style.display='none';
  }, 200);
}

// Autocompletado de ciudad
function onCiudadInput(inputId, estadoId){
  var val = document.getElementById(inputId).value;
  if(!val || val.length < 2){ ocultarDropdown(inputId); return; }
  var q = val.toLowerCase();
  var matches = CIUDADES_RI_MA.filter(function(c){ return c.toLowerCase().indexOf(q) === 0; });
  if(!matches.length) matches = CIUDADES_RI_MA.filter(function(c){ return c.toLowerCase().indexOf(q) >= 0; });
  mostrarDropdown(inputId+'-drop', matches, inputId, function(ciudad){
    document.getElementById(inputId).value = ciudad;
  });
}

// Autocompletado de ZIP con auto-llenado de ciudad y estado
function onZipInput(zipId, ciudadId, estadoId){
  var val = document.getElementById(zipId).value.replace(/\D/g,'');
  document.getElementById(zipId).value = val;
  if(val.length === 5 && ZIP_DATA[val]){
    var parts = ZIP_DATA[val].split(',');
    var ciudad = parts[0];
    var estado = parts[1]==='RI' ? 'Rhode Island' : parts[1]==='MA' ? 'Massachusetts' : parts[1];
    if(ciudadId && document.getElementById(ciudadId)) document.getElementById(ciudadId).value = ciudad;
    if(estadoId && document.getElementById(estadoId)) document.getElementById(estadoId).value = estado;
    ocultarDropdown(zipId);
    return;
  }
  if(val.length < 2){ ocultarDropdown(zipId); return; }
  var matches = Object.keys(ZIP_DATA).filter(function(z){ return z.indexOf(val) === 0; });
  mostrarDropdown(zipId+'-drop', matches.map(function(z){ return z+' - '+ZIP_DATA[z].split(',')[0]; }), zipId, function(op){
    var zip = op.split(' - ')[0];
    document.getElementById(zipId).value = zip;
    if(ZIP_DATA[zip]){
      var parts = ZIP_DATA[zip].split(',');
      var ciudad = parts[0];
      var estado = parts[1]==='RI'?'Rhode Island':parts[1]==='MA'?'Massachusetts':parts[1];
      if(ciudadId && document.getElementById(ciudadId)) document.getElementById(ciudadId).value = ciudad;
      if(estadoId && document.getElementById(estadoId)) document.getElementById(estadoId).value = estado;
    }
  });
}

// Autocompletado de estado
function onEstadoInput(inputId){
  var val = document.getElementById(inputId).value;
  if(!val || val.length < 2){ ocultarDropdown(inputId); return; }
  var q = val.toLowerCase();
  var matches = ESTADOS_US.filter(function(e){ return e.toLowerCase().indexOf(q) === 0; });
  if(!matches.length) matches = ESTADOS_US.filter(function(e){ return e.toLowerCase().indexOf(q) >= 0; });
  mostrarDropdown(inputId+'-drop', matches, inputId, function(estado){
    document.getElementById(inputId).value = estado;
  });
}

// Autocompletado de dirección
function onDireccionInput(inputId){
  var val = document.getElementById(inputId).value;
  if(!val || val.length < 2){ ocultarDropdown(inputId); return; }
  var q = val.toLowerCase();

  // Sugerencias de clientes existentes con dirección completa
  var clientesConDir = [];
  var dirsCompletas = [];
  LS('ncl',[]).forEach(function(c){
    if(c.dir && c.dir.toLowerCase().indexOf(q) >= 0){
      if(dirsCompletas.indexOf(c.dir) < 0) dirsCompletas.push(c.dir);
      clientesConDir.push(c);
    }
  });

  // Sugerencias de calles conocidas
  var sinNumero = val.replace(/^\d+\s*/, '').toLowerCase();
  var numPrefix = val.match(/^\d+\s*/);
  var prefix = numPrefix ? numPrefix[0].trim() : '';
  var dirsCalles = DIR_SUGERENCIAS.filter(function(d){
    return sinNumero.length >= 2 && d.toLowerCase().indexOf(sinNumero) >= 0;
  }).map(function(d){
    return prefix ? prefix + ' ' + d : d;
  });

  // Combinar sin duplicados
  var todas = dirsCompletas.concat(dirsCalles.filter(function(d){
    return dirsCompletas.indexOf(d) < 0;
  }));

  if(!todas.length){ ocultarDropdown(inputId); return; }

  mostrarDropdown(inputId+'-drop', todas, inputId, function(dir){
    // Siempre poner la dirección seleccionada completa, sin agregar nada más
    document.getElementById(inputId).value = dir;
    // Autocompletar ciudad, estado y ZIP
    var cliente = clientesConDir.find(function(c){ return c.dir === dir; });
    if(cliente){
      var pre = inputId.replace('d','');
      var cityId = pre + 'city';
      var stateId = pre + 'state';
      var zipId = pre + 'zip';
      if(document.getElementById(cityId) && cliente.ciudad) document.getElementById(cityId).value = cliente.ciudad;
      if(document.getElementById(stateId) && cliente.estado) document.getElementById(stateId).value = cliente.estado;
      if(document.getElementById(zipId) && cliente.zip) document.getElementById(zipId).value = cliente.zip;
    }
  });
}
// === FIN AUTOCOMPLETADO ===

var DIR_SUGERENCIAS = [
  // Atwells / Federal Hill
  "Atwells Ave","Sutton St","Spruce St","Tobey St","Camden St","Hawkins St",
  "America St","Eagle St","Vinton St","Dean St","Pidge Ave","Joslin St",
  // West End / Olneyville
  "Westminster St","Broad St","Elmwood Ave","Cranston St","Chalkstone Ave",
  "Manton Ave","Douglas Ave","Prairie Ave","Killingly St","Potters Ave",
  "Messer St","Valley St","Hartford Ave","Plainfield St","Olneyville Square",
  "Pocasset Ave","Alverson Ave","Chapin Ave","Carpenter St","River Ave",
  // South Providence
  "Eddy St","Public St","Prairie Ave","Dudley St","Adelaide Ave","Peace St",
  "Lenox Ave","Oxford St","Dexter St","Bucklin St","Pavilion Ave","Globe St",
  // Smith Hill / Charles St
  "Admiral St","Smith St","Charles St","Branch Ave","Orms St","Harris Ave",
  "Promenade St","Geneva St","Dike St","Larch St","Joslin St","Taft St",
  // East Side
  "Hope St","Waterman St","Angell St","Power St","Lloyd Ave","Wayland Ave",
  "Cole Ave","Doyle Ave","Wickenden St","Friendship St","Governor St",
  "Benefit St","College St","Bowen St","Stimson Ave","Butler Ave",
  "Rochambeau Ave","Elmgrove Ave","Eaton St","Congdon St",
  // Downtown
  "Reservoir Ave","Park Ave","Westminster St","Exchange St","Ship St",
  "Point St","South St","North St","Canal St","Memorial Blvd","Fulton St",
  "Mathewson St","Dorrance St","Weybosset St","Pine St","Clifford St",
  // North Providence / Pawtucket
  "Mineral Spring Ave","Academy Ave","Fruit Hill Ave","Mount Pleasant Ave",
  "Smithfield Ave","Newport Ave","Central Ave","Prospect St","Main St",
  "Goff Ave","High St","Church St","Division St","Cottage St",
  // Cranston
  "Pontiac Ave","Oaklawn Ave","Park Ave","Reservoir Ave","Phenix Ave",
  "Scituate Ave","Atwood Ave","Doric Ave","Norwood Ave","Arlington Ave",
  // Providence general
  "Putnam St","Union Ave","Cole Ave","Doyle Ave","Laurel Ave","Ivy St",
  "Oak St","Cedar St","Maple St","Pine St","Elm St","Walnut St","Chestnut St",
  "Magnolia St","Summer St","Winter St","Spring St","Autumn St",
  "Washington St","East Ave","West Ave","North Ave","South Ave",
  "Broadway","Aborn St","Percy St","Hamlet Ave","Pekin St","Dudley St",
  // Woonsocket
  "Social St","Main St","Hamlet Ave","Blackstone St","River St",
  // East Providence
  "Taunton Ave","Pawtucket Ave","Warren Ave","Wampanoag Trail",
  // Massachusetts calles comunes
  "Tremont St","Boylston St","Commonwealth Ave","Beacon St","Newbury St",
  "Huntington Ave","Massachusetts Ave","Blue Hill Ave","Dorchester Ave",
  "Columbia Rd","Warren Ave","American Legion Hwy"
];

function mostrarDirSugerencias(inputId, dropId, val){
  var el = document.getElementById(dropId);
  if(!el) return;
  if(!val || val.length < 2){ el.style.display='none'; el.innerHTML=''; return; }
  var q = val.toLowerCase();
  // Buscar calles que coincidan
  var matches = DIR_SUGERENCIAS.filter(function(c){ return c.toLowerCase().indexOf(q) >= 0; });
  // También agregar direcciones de clientes existentes
  var dirs = LS('ncl',[]).map(function(c){ return c.dir||''; }).filter(function(d){ return d && d.toLowerCase().indexOf(q)>=0; });
  dirs.forEach(function(d){ if(matches.indexOf(d)<0) matches.unshift(d); });
  if(!matches.length){ el.style.display='none'; return; }
  el.innerHTML = '';
  el.style.display = 'block';
  matches.slice(0,8).forEach(function(s){
    var d = document.createElement('div');
    d.style.cssText = 'padding:10px 14px;border-bottom:1px solid #f0f0f0;cursor:pointer;font-size:13px';
    d.textContent = s;
    d.onmousedown = function(e){ e.preventDefault(); };
    d.onclick = function(){
      document.getElementById(inputId).value = s;
      el.style.display='none';
    };
    el.appendChild(d);
  });
}



// En el INICIO el escudo salia DOS veces -el de la barra de arriba y el grande del medio-.
// Ahora el de la barra se esconde solo en el inicio, y en las demas pantallas se queda
// y sirve para volver al inicio de un toque.
function pintarSegunPantalla(id){
  var esInicio = (id === 'p-inicio');
  document.body.classList.toggle('inicio-oscuro', esInicio);
  var logoBarra = document.getElementById('logo-barra');
  if(logoBarra){
    logoBarra.style.visibility = 'visible';
    // En el inicio se quita la caja blanca, para que el letrero quede limpio sobre el fondo
    logoBarra.style.background = esInicio ? 'transparent' : 'white';
    logoBarra.style.padding    = esInicio ? '0' : '5px 12px';
    // Y se esconde SOLO el escudo, que en el inicio ya sale grande en el medio -19 ago-
    var escudo = logoBarra.querySelector('img');
    if(escudo) escudo.style.display = esInicio ? 'none' : '';
  }
}

var historialPantallas = [];
function pantallaActual(){
  var all = ['menu','p-inicio','p-cl','p-v','p-rpt','p-cxc','p-cl-perfil','p-cl-factura','p-cat','p-inventario','p-margen','p-bitacora','p-panorama','p-docs','p-relleno','p-van','p-copias','p-sup','p-comp','p-ped','p-gastos','p-vip','p-mas','p-facturas','p-dashboard','p-rutas','p-manual','p-cxp','p-academia','p-resumen'];
  for(var i=0;i<all.length;i++){
    var el = document.getElementById(all[i]);
    if(el && el.style.display === 'block') return all[i];
  }
  return null;
}
// ═══════════════════════════════════════════════════════════════════
//  EL BOTÓN PARA ATRÁS  (reescrito el 7 ago 2026)
//
//  🔴 EL PROBLEMA: estaba escrito como una lista de casos A MANO, uno
//  por pantalla. Cubria 8 subvistas de 14, y las 6 que faltaban eran
//  casi todas de PEDIDOS RAPIDOS — la pantalla que Sensei mas usa. Cada
//  pantalla nueva que se construia se quedaba fuera y el atras dejaba
//  de funcionar ahi, sin que nadie se enterara.
//
//  AHORA es un REGISTRO declarado: cada subvista dice a donde vuelve.
//  Agregar una pantalla nueva es agregar un renglon aqui — no hay que
//  tocar la logica. Y el orden importa: la MAS PROFUNDA va primero.
// ═══════════════════════════════════════════════════════════════════

// { wrap: el id que esta abierto, volver: que hacer para retroceder }
var PASOS_ATRAS = {
  'p-ped': [
    // El carrito del pedido: si lleva productos, se pregunta antes de descartar.
    { wrap: 'ped-form-wrap', volver: function(){
        var lleva = (typeof pedItemsTemp !== 'undefined' && pedItemsTemp && pedItemsTemp.length) || 0;
        if(lleva && !confirm('Tienes ' + lleva + ' producto(s) en este pedido.\n\n\u00bfDescartarlo y volver atr\u00e1s?')) return false;
        cancelarPedido();
        return true;
      } },
    { wrap: 'ped-barbero-wrap',  volver: function(){ volverABarberias(); return true; } },
    { wrap: 'ped-multi-wrap',    volver: function(){ cancelarPedidoMultiple(); return true; } },
    { wrap: 'ped-barberia-wrap', volver: function(){ cancelarPedido(); return true; } },
    // El formulario de producto nuevo, abierto DENTRO de pedidos -7 ago-
    { wrap: 'ped-nuevo-prod-wrap', volver: function(){
        var w = document.getElementById('ped-nuevo-prod-wrap');
        if(w) w.style.display = 'none';
        return true;
      } }
  ],
  'p-cat': [
    { wrap: 'cat-edit-wrap',         volver: function(){ cerrarEdicionProducto(); return true; } },
    { wrap: 'cat-marca-lista-wrap',  volver: function(){ cerrarEditarProductosDeMarca(); return true; } },
    { wrap: 'cat-marca-wrap',        volver: function(){ cerrarEditarPorMarca(); return true; } }
  ],
  'p-cl': [
    { wrap: 'cl-n', volver: function(){
        document.getElementById('cl-n').style.display = 'none';
        document.getElementById('cl-l').style.display = 'block';
        return true;
      } }
  ],
  'p-sup': [
    { wrap: 'sup-perfil-wrap', volver: function(){
        document.getElementById('sup-perfil-wrap').style.display = 'none';
        var l = document.getElementById('sup-lista-wrap');
        if(l) l.style.display = 'block';
        return true;
      } }
  ],
  'p-gastos': [
    { wrap: 'gastos-n', volver: function(){
        document.getElementById('gastos-n').style.display = 'none';
        document.getElementById('gastos-l').style.display = 'block';
        subirPantalla();
        return true;
      } }
  ]
};

function _estaAbierto(id){
  var el = document.getElementById(id);
  if(!el) return false;
  try { return getComputedStyle(el).display !== 'none'; }
  catch(e){ return el.style.display === 'block'; }
}


// ═══════════════════════════════════════════════════════════════════
//  LA ESCALERA DE ATRÁS  (12 ago 2026)
//  Un toque = un peldaño. Los dos botones —el de la app y el del
//  teléfono— llaman a `unPasoAtras()`, así hacen exactamente lo mismo.
// ═══════════════════════════════════════════════════════════════════

// Los recuadros que se abren ENCIMA de la pantalla. El de más arriba
// primero. Cada uno dice cómo se cierra; si no lo dice, se esconde.
var RECUADROS_ENCIMA = [
  { id: 'pedido-salir-menu',       cerrar: 'cerrarSalirDelPedido' }, // ✕ salir del pedido -18 sep-
  { id: 'chatnbs-overlay',         cerrar: 'cerrarChatNBS' },   // 💬 NBS Chat -18 sep-
  { id: 'asistente-ov',            cerrar: 'cerrarAsistente' },
  { id: 'crop-foto-overlay' },
  { id: 'firma-canvas-overlay' },
  { id: 'firma-overlay' },
  { id: 'firma-pregunta-overlay' },
  { id: 'foto-visor-overlay' },
  { id: 'foto-acciones-overlay' },
  { id: 'scanner-overlay' },
  { id: 'fact-edit-total-box' },
  { id: 'fact-acciones-overlay' },
  { id: 'fact-edit-overlay',        cerrar: 'cerrarFacturaEdit' },
  { id: 'editor-pago-overlay',      cerrar: 'cerrarEditorPago' },
  { id: 'devolucion-overlay',       cerrar: 'cerrarDevolucion' },
  { id: 'giftvip-ov' },
  { id: 'premvip-ov' },
  { id: 'factura-view-overlay',     cerrar: 'cerrarFacturaView' },
  { id: 'factura-ov' },
  { id: 'precios-esp-overlay' },
  { id: 'historial-costo-overlay' },
  { id: 'historial-overlay',        cerrar: 'cerrarHistorial' },
  { id: 'difprod-ov' },
  { id: 'prod-nuevo-ov' },
  { id: 'buscar-prod-ov' },
  { id: 'compra-edit-overlay' },
  { id: 'descartar-compra-ov' },
  { id: 'cxp-form-overlay' },
  { id: 'sup-edit-overlay' },
  { id: 'relvan-ov',                cerrar: 'cerrarRellenarVan' },
  { id: 'van-cargar-overlay',       cerrar: 'cerrarCargarVan' },
  { id: 'diacxc-ov' },
  { id: 'topclientes-ov' },
  { id: 'recvis-ov' },
  { id: 'visitas-negocios-overlay' },
  { id: 'comparar-ruta-ov' },
  { id: 'cargando-ruta-ov' },
  { id: 'integridad-ov' },
  { id: 'diagnostico-fechas-overlay' },
  { id: 'diagnostico-direcciones-overlay' },
  { id: 'backup-texto-overlay' },
  { id: 'backup-overlay' },
  { id: 'printer-config-overlay' },
  { id: 'print-overlay' },
  { id: 'reporte-acciones-overlay' },
  { id: 'fidelidad-popup-overlay' },
  { id: 'ayuda-overlay',            cerrar: 'cerrarAyuda' },
  { id: 'logatras-ov' },
  // \ud83d\udd34 LOS QUE FALTABAN -30 ago-. Los cuatro primeros son de estos dias; los diez
  // siguientes llevaban tiempo igual. Con cualquiera abierto, el boton atras del telefono
  // retrocedia por detras y acababa cerrando la app. Lo cazo un barrido que ahora es
  // prueba fija: compara la lista con TODOS los recuadros que existen en el archivo.
  { id: 'precios-nuevos-overlay',   cerrar: 'cerrarPreciosNuevos' },
  { id: 'buscprof-ov',              cerrar: 'cerrarBuscadorProfundo' },
  { id: 'borrados-ov',              cerrar: 'cerrarProductosBorrados' },
  { id: 'cobped-overlay',           cerrar: 'cerrarCobroPedidos' },
  { id: 'hist-avisos-overlay',      cerrar: 'cerrarHistorialAvisos' },
  { id: 'revision-overlay',         cerrar: 'cerrarRevisionDiaria' },
  { id: 'lst-overlay',              cerrar: 'cerrarListadoClientes' },
  { id: 'msgvip-overlay',           cerrar: 'cerrarMensajeVIP' },
  { id: 'pagosup-overlay',          cerrar: 'cerrarPagoSuplidor' },
  { id: 'unif-marcas-ov',           cerrar: 'cerrarUnificarMarcas' },
  { id: 'confirmar-balance-overlay', cerrar: 'cerrarConfirmacionBalance' },
  { id: 'sinconf-overlay',          cerrar: 'cerrarSinConfirmar' },
  { id: 'guardadia-overlay',        cerrar: 'cerrarGuardarElDia' },
  { id: 'reporte-overlay',          cerrar: 'cerrarReporte' },
  { id: 'pedido-nuevo-overlay',     cerrar: 'cerrarAvisoPedidoNuevo' },
  { id: 'pedidos-web-overlay',      cerrar: 'cerrarPedidosWeb' },
  { id: 'traerfotos-overlay',       cerrar: 'cerrarTraerFotos' },
  { id: 'msgcli-overlay',           cerrar: 'cerrarMensajeCliente' },
  { id: 'guardados-overlay',        cerrar: 'cerrarGuardados' },
  { id: 'aviso-pedidos-nuevos',     cerrar: 'cerrarAvisoPedidos' },
  { id: 'fotorapido-overlay',       cerrar: 'cerrarFotosRapido' },
  { id: 'pin-overlay',              cerrar: 'cerrarPinRecuadro' },
  { id: 'estado-fechas-overlay',    cerrar: 'cerrarEstadoPorFechas' },
  { id: 'aviso-backup-overlay',     cerrar: 'cerrarAvisoConBackup' },
  { id: 'credito-aplicado-overlay', cerrar: 'cerrarCreditoAplicado' },
  { id: 'ajuste-vip-overlay',       cerrar: 'cerrarAjustePuntosVIP' },
  { id: 'como-mandar-overlay',      cerrar: 'cerrarComoMandar' },
  { id: 'estado-cuenta-overlay',    cerrar: 'cerrarEstadoDeCuenta' },
  { id: 'avisar-cliente-overlay',   cerrar: 'cerrarAvisoCliente' },
  { id: 'editor-pago-compra',       cerrar: 'cerrarEditorPagoCompra' },
  { id: 'cierre-ruta-overlay',      cerrar: 'cerrarCierreRuta' },
  { id: 'aviso-ov' }
];

function _estaVisible(id){
  var el = document.getElementById(id);
  if(!el) return false;
  try {
    var st = getComputedStyle(el);
    return st.display !== 'none' && st.visibility !== 'hidden';
  } catch(e){ return el.style.display === 'block' || el.style.display === 'flex'; }
}

// ¿Hay un recuadro abierto? Se cierra el de más arriba y se dice que sí.
function cerrarRecuadroDeArriba(){
  for(var i = 0; i < RECUADROS_ENCIMA.length; i++){
    var r = RECUADROS_ENCIMA[i];
    if(!_estaVisible(r.id)) continue;
    if(r.cerrar && typeof window[r.cerrar] === 'function'){
      try { window[r.cerrar](); } catch(e){ var e1 = document.getElementById(r.id); if(e1) e1.style.display = 'none'; }
    } else {
      var el = document.getElementById(r.id);
      if(el){
        // Los que se crean al vuelo se quitan; los que viven en el HTML solo se esconden.
        if(el.parentNode && el.getAttribute('data-fijo') !== '1' && /-ov$/.test(r.id)) el.parentNode.removeChild(el);
        else el.style.display = 'none';
      }
    }
    return true;
  }
  return false;
}

// ═══ UN SOLO PASO ATRÁS ═══
// La usan LOS DOS botones: el de la app y el del telefono.
function unPasoAtras(){
  // Peldaño 0 — el menú lateral, que tapa todo
  try {
    if(typeof menuLateralAbierto === 'function' && menuLateralAbierto()){
      cerrarMenuLateral();
      return true;
    }
  } catch(e){}

  // Peldaño 1 — un recuadro abierto encima
  try { if(cerrarRecuadroDeArriba()) return true; } catch(e){}

  // Peldaño 2 — una subvista dentro de la pantalla
  try {
    var actual = pantallaActual();
    var pasos = PASOS_ATRAS[actual];
    if(pasos){
      for(var i = 0; i < pasos.length; i++){
        if(_estaAbierto(pasos[i].wrap)){
          var hecho = pasos[i].volver();
          if(hecho !== false) subirPantalla();
          return true;   // aunque diga que no: NO se sale de la pantalla
        }
      }
    }
  } catch(e){}

  // Peldaño 3 — la pantalla anterior
  if(historialPantallas && historialPantallas.length){
    var prev = historialPantallas.pop();
    ir(prev, true);
    return true;
  }

  // Ya no hay a dónde: solo si no estamos en el Inicio
  if(pantallaActual() !== 'p-inicio'){
    ir('p-inicio', true);
    return true;
  }
  return false;   // de aqui no se puede retroceder mas
}

function volverAtras(){
  // 🔑 EL BOTON DE LA APP Y EL DEL TELEFONO HACEN LO MISMO: los dos llaman a
  // `unPasoAtras()`. UN TOQUE = UN PELDAÑO. Nunca dos. -Sensei, 12 ago-
  unPasoAtras();
}

// Para que nunca se vuelva a quedar una subvista sin cubrir: esto avisa en la consola
// si aparece una que el registro no conoce. -7 ago-
function revisarSubvistasSinCubrir(){
  var faltan = [];
  Object.keys(PASOS_ATRAS).forEach(function(p){});
  try {
    var todas = document.querySelectorAll('[id$="-wrap"],[id$="-n"],[id$="-l"]');
    for(var i = 0; i < todas.length; i++){
      var id = todas[i].id;
      var cubierta = false;
      Object.keys(PASOS_ATRAS).forEach(function(p){
        PASOS_ATRAS[p].forEach(function(x){ if(x.wrap === id) cubierta = true; });
      });
      if(!cubierta) faltan.push(id);
    }
  } catch(e){}
  return faltan;
}
// ═══════════════════════════════════════════════════════════════════
//  📊 EL RÉCORD DE USO  (29 ago 2026)
//
//  Sensei preguntó qué le sugiero para la pantalla de inicio "de acuerdo al
//  récord de uso de la app". No había ninguno: la app nunca apuntó qué usa.
//
//  Así que ahora lo apunta. Solo cuenta CUÁNTAS VECES abre cada pantalla y
//  cuándo fue la última. Nada más: ni qué escribió, ni cuánto vendió, ni nada
//  que salga del teléfono. Es para poder decidir con datos qué merece estar en
//  el inicio, en vez de adivinar.
//
//  Dentro de unas semanas, en Herramientas → 📊 Qué uso más, va a poder ver la
//  lista de verdad y ajustar el inicio a lo que hace, no a lo que cree que hace.
// ═══════════════════════════════════════════════════════════════════

var CLAVE_USO = 'nbs_uso_pantallas';

// Nombres en cristiano, para que la lista se lea
var NOMBRES_PANTALLA = {
  'p-inicio':'Inicio', 'p-ped':'Pedidos Rápidos', 'p-v':'Vender', 'p-cl':'Clientes',
  'p-cxc':'Cuentas por Cobrar', 'p-cat':'Catálogo', 'p-comp':'Compras', 'p-sup':'Suplidores',
  'p-van':'Control de la Van', 'p-relleno':'Lista de Relleno', 'p-gastos':'Gastos',
  'p-cuadre':'Cuadre de Caja', 'p-copias':'Copias de Seguridad', 'p-rpt':'Reportes',
  'p-rutas':'Ruta de Visitas', 'p-vip':'Programa VIP', 'p-bitacora':'Bitácora',
  'p-resumen':'Resumen', 'p-mas':'Más', 'p-academia':'Academia', 'p-cxp':'Cuentas por Pagar',
  'p-cl-perfil':'Ficha del cliente', 'p-inv':'Inventario'
};

function apuntarUsoPantalla(id){
  if(!id || String(id).indexOf('p-') !== 0) return;
  try {
    var u = JSON.parse(localStorage.getItem(CLAVE_USO) || '{}');
    if(!u[id]) u[id] = { veces: 0, ultima: null };
    u[id].veces++;
    u[id].ultima = Date.now();
    localStorage.setItem(CLAVE_USO, JSON.stringify(u));
  } catch(e){}
}

function verQueUsoMas(){
  var u = {};
  try { u = JSON.parse(localStorage.getItem(CLAVE_USO) || '{}'); } catch(e){}
  var lista = Object.keys(u).map(function(id){
    return { id: id, nombre: NOMBRES_PANTALLA[id] || id, veces: u[id].veces, ultima: u[id].ultima };
  }).sort(function(a, b){ return b.veces - a.veces; });

  if(!lista.length){
    avisoGrande('📊 QUÉ USO MÁS\n\nTodavía no hay nada apuntado.\n\n'
      + 'La app empezó a contar hoy. Vuelve en una semana y aquí vas a ver, en orden, '
      + 'las pantallas que más abres — para decidir cuáles merecen estar en el inicio.');
    return;
  }

  var total = lista.reduce(function(a, x){ return a + x.veces; }, 0);
  var t = ['📊 QUÉ USO MÁS', '', 'De ' + total + ' veces que has entrado a una pantalla:', ''];
  lista.slice(0, 15).forEach(function(x, i){
    var pct = Math.round((x.veces / total) * 100);
    var dias = x.ultima ? Math.floor((Date.now() - x.ultima) / 86400000) : null;
    t.push((i + 1) + '. ' + x.nombre + ' — ' + x.veces + ' vez/veces (' + pct + '%)'
      + (dias === 0 ? ' · hoy' : (dias !== null ? ' · hace ' + dias + ' día(s)' : '')));
  });
  t.push('');
  t.push('Las de arriba son las que merecen estar en el inicio.');
  avisoGrande(t.join('\n'));
}

function borrarRecordDeUso(){
  if(!confirm('¿Empezar a contar de cero?\n\nSe borra solo el récord de qué pantallas abres. '
    + 'No se toca ningún dato de tu negocio.')) return;
  try { localStorage.removeItem(CLAVE_USO); } catch(e){}
  alert('✅ El récord de uso empezó de cero.');
}

function ir(id, sinHistorial){
  // 📊 Apuntar que pantalla se abrio, para poder decidir el inicio con datos. -29 ago-
  try { apuntarUsoPantalla(id); } catch(e){}
  // 🛡️ Y rellenar el colchon del boton atras. Antes solo se rellenaba al TOCAR la
  // pantalla; si Sensei daba a atras varias veces seguidas sin tocar nada, se los comia
  // todos y la app se cerraba. -30 ago-
  try { _ultimoGuardian = 0; ponerGuardianAtras(); } catch(e){}
  if(!sinHistorial){
    var actual = pantallaActual();
    if(actual && actual !== id) historialPantallas.push(actual);
  }
  window.scrollTo(0, 0);
  var all = ['menu','p-inicio','p-cl','p-v','p-rpt','p-cxc','p-cl-perfil','p-cl-factura','p-cat','p-inventario','p-margen','p-bitacora','p-panorama','p-docs','p-relleno','p-van','p-copias','p-sup','p-comp','p-ped','p-gastos','p-vip','p-mas','p-facturas','p-dashboard','p-rutas','p-manual','p-cxp','p-academia','p-resumen'];
  // BLINDAJE (23 jul): antes, si un id de la lista no existia, el bucle se
  // rompia y las pantallas siguientes NO se escondian. Ahora se salta el que
  // falte y sigue. Ademas se esconde CUALQUIER pantalla .pg aunque no este
  // en la lista, para que nunca se quede una pegada.
  for(var i=0;i<all.length;i++){
    var elP = document.getElementById(all[i]);
    if(elP) elP.style.display='none';
  }
  var todasPg = document.querySelectorAll('.pg');
  for(var j=0;j<todasPg.length;j++){ todasPg[j].style.display='none'; }
  document.getElementById(id).style.display='block';
  pintarSegunPantalla(id);
  if(id==='p-cl'){
    var clN = document.getElementById('cl-n');
    var clL = document.getElementById('cl-l');
    if(clN) clN.style.display = 'none';
    if(clL) clL.style.display = 'block';
    var busquedaGuardada = window._clUltimaBusqueda || '';
    var elBuscarCl = document.getElementById('cl-buscar-input');
    if(elBuscarCl) elBuscarCl.value = busquedaGuardada;
    renderCl(busquedaGuardada); llenarDataLists();
  }
  if(id==='p-v'){
    syncVcl();
    var vf=document.getElementById('vfecha');
    if(vf) vf.value=fechaHoyISO();
    window._pagoMetodos = window._pagoMetodos || {};
    window._pagoMetodos['vini'] = [{tipo:'efectivo', monto:0}];
    renderMetodosPago('vini');
    actualizarLabelPagoVenta();
    var btnCancConv = document.getElementById('btn-cancelar-conversion-pedido');
    if(btnCancConv) btnCancConv.style.display = 'none';
    var btnBorrarConv = document.getElementById('btn-borrar-pedido-conversion');
    if(btnBorrarConv) btnBorrarConv.style.display = 'none';
  }
  if(id==='p-rpt') document.getElementById('rto').value=fechaHoyISO();
  if(id==='p-cxc'){ var bc=document.getElementById('cxc-buscar'); if(bc) bc.value=''; window._cxcTabActiva='pendientes'; cambiarPestanaCxC('pendientes'); }
  if(id==='p-cat'){
    loadProds();
    // Reiniciar todas las subvistas -Editar toda una marca, Editar producto- para que
    // siempre se muestre la lista principal del catalogo al entrar, sin importar donde
    // se haya quedado la ultima vez.
    var catEditW = document.getElementById('cat-edit-wrap');
    var catMarcaListaW = document.getElementById('cat-marca-lista-wrap');
    var catMarcaW = document.getElementById('cat-marca-wrap');
    var catListaW = document.getElementById('cat-lista-wrap');
    if(catEditW) catEditW.style.display = 'none';
    if(catMarcaListaW) catMarcaListaW.style.display = 'none';
    if(catMarcaW) catMarcaW.style.display = 'none';
    if(catListaW) catListaW.style.display = 'block';
    var elCatSkel = document.getElementById('catlista');
    if(elCatSkel){
      var filasSkel = '';
      for(var sk=0; sk<6; sk++){
        filasSkel += '<div class="skel-row"><div class="skel skel-av"></div><div style="flex:1"><div class="skel skel-line1"></div><div class="skel skel-line2"></div></div></div>';
      }
      elCatSkel.innerHTML = filasSkel;
    }
    setTimeout(function(){ renderCatalogo(''); }, 200);
  }
  if(id==='p-sup'){
    document.getElementById('sup-lista-wrap').style.display='block';
    document.getElementById('sup-perfil-wrap').style.display='none';
    document.getElementById('sup-l').style.display='block';
    document.getElementById('sup-n').style.display='none';
    renderSup('');
    llenarDataLists();
  }
  if(id==='p-comp'){
    ponerHoyEnCampo('cc-fecha');   // 📅 la de hoy, lista para cambiarla -2 sep-
    loadProds();
    syncCCsup();
    if(typeof pintarHojasFactura === 'function') pintarHojasFactura();   // 📄 la fila de hojas -20 sep-
    window._pagoMetodos = window._pagoMetodos || {};
    window._pagoMetodos['ccini'] = [{tipo:'efectivo', monto:0}];
    renderMetodosPago('ccini');
    actualizarLabelPagoCompra();
  }
  if(id==='p-ped'){
    document.getElementById('ped-lista-wrap').style.display='block';
    document.getElementById('ped-form-wrap').style.display='none';
    document.getElementById('ped-barberia-wrap').style.display='none';
    document.getElementById('ped-barbero-wrap').style.display='none';
    var multiWrap = document.getElementById('ped-multi-wrap');
    if(multiWrap) multiWrap.style.display='none';
    if(typeof renderAvisoPedidoEnProceso === 'function') renderAvisoPedidoEnProceso();
    var bi = document.getElementById('ped-inicio-buscar');
    if(bi) bi.value='';
    renderBarberiasInicio('');
    renderPedidosPendientes();
  }
  if(id==='p-facturas'){ var bf=document.getElementById('fact-buscar'); if(bf) bf.value=''; renderFacturas(''); }
  if(id==='p-dashboard') renderDashboard();
  if(id==='p-panorama') renderPanorama();
  if(id==='p-docs') renderDocs();
  if(id==='p-resumen') abrirResumen();
  if(id==='p-academia') renderAcademia();
  // Si sale de la Academia, callar la voz para que no siga hablando en otra pantalla
  if(id!=='p-academia' && typeof acaPausar === 'function' && window._acaReproduciendo) acaPausar();
  if(id==='p-inventario') renderInventario('');
  if(id==='p-inicio'){
    renderInicio();
    // 🔔 El aviso con sonido, si hay pedidos nuevos. Sale UNA vez. -17 sep-
    setTimeout(function(){ try { avisarPedidosNuevos(); } catch(e){} }, 700);
  }
  pintarMiniResumen();   // la miniatura sale en todas las pantallas, se refresca siempre
  if(id==='p-relleno') abrirRelleno();
  if(id==='p-van') abrirVan();
  if(id==='p-copias') abrirCopias();
  if(id==='p-rutas') renderRutas();
  if(id==='p-gastos'){
    document.getElementById('gastos-l').style.display='block';
    document.getElementById('gastos-n').style.display='none';
    document.getElementById('gfecha').value = fechaHoyISO();
    renderGastos();
  }
  if(id==='p-vip'){
    document.getElementById('vip-buscar-cl').value = '';
    document.getElementById('vip-buscar-lista').style.display = 'none';
    renderVIP('');
  }
  if(id==='p-manual'){
    document.getElementById('manual-buscar').value = '';
    renderManual('');
  }
  if(id==='p-cxp'){ renderCXP(); }
}

function irProtegido(dest){
  if(PIN_ACTIVO){
    var pin = prompt('🔒 PIN de administrador:');
    if(pin === null) return;
    if(!verificarPinConLimite(pin)) return;
  }
  if(dest === 'exportar'){ exportD(); return; }
  if(dest === 'importar'){ document.getElementById('impf').click(); return; }
  ir(dest);
}

var VIP_META = 10;
var VIP_PRECIOS = [9.99, 10.00];
var VIP_PRECIO_MITAD = 5.00;

// ═══════════════════════════════════════════════════════════════════
//  LA REGLA DEL VIP, COMO LA PIDIO SENSEI (5 ago 2026)
//
//  Cuentan juntos los productos de la MISMA MARCA y el MISMO TIPO que
//  se hayan vendido a $10.00 o $9.99. Ejemplo suyo: todos los WAX de
//  IMMORTAL -spicebomb, amarillo, strawberry- suman al mismo grupo.
//
//  ⚠️ LA CATEGORIA NO SIRVE: es muy amplia -"PRODUCTO PARA PELO" tiene
//  81 productos, ahi caben wax, gel y spray juntos-. Por eso el TIPO se
//  saca de la PALABRA que esta en el NOMBRE.
//
//  APARTE: las navajas cortadas de $5 siguen a 2 unidades = 1 punto,
//  pero cuentan POR PRODUCTO EXACTO, no por marca+tipo.
//
//  Y si le baja el precio a un producto -o sea, un descuento-, esa
//  linea deja de contar sola, porque ya no vale $10 ni $9.99.
// ═══════════════════════════════════════════════════════════════════

// Los tipos, en orden de busqueda. Los de DOS palabras van primero para que
// "after shave" no se confunda con "shave" a secas.
var VIP_TIPOS = [
  // 'sea salt' se quito a proposito: "Chaos sea salt wax" tiene que contar como
  // WAX junto a los demas wax de Immortal, no como un grupo aparte. -5 ago, Sensei-
  'after shave', 'shaving cream', 'hair spray',
  'colonia', 'cologne', 'shampoo', 'acondicionador', 'conditioner',
  'pomade', 'pomada', 'mousse', 'mouse', 'serum', 'tonic', 'talco',
  'powder', 'polvo', 'balsam', 'balm', 'paste', 'sheen', 'lotion', 'locion',
  'spray', 'cream', 'crema', 'aceite', 'oil', 'gel', 'wax', 'cera',
  'tinte', 'navaja', 'blade', 'peine', 'cepillo'
];

function sinServicio(c){
  return !!(c && c.sinServicio === true);
}

function soloConServicio(lista){
  if(!Array.isArray(lista)) return lista;
  return lista.filter(function(c){ return !sinServicio(c); });
}

function toggleSinServicio(btn){
  var id = btn.getAttribute('data-clid');
  var C = LS('ncl', []);
  var i = C.findIndex(function(x){ return String(x.id) === String(id); });
  if(i < 0) return;
  var ahora = !C[i].sinServicio;

  if(ahora){
    var debe = 0;
    try {
      LS('nv', []).forEach(function(v){
        if(String(v.cid) !== String(id) || v.cancelada || v.tipo !== 'credito') return;
        var pg = 0;
        (v.pagosFactura || []).forEach(function(p){ if(!p.esDevolucion) pg += parseFloat(p.monto) || 0; });
        debe += cobradoYDebeDe(v).debe;
      });
    } catch(e){}
    var msg = 'Marcar a ' + nombreCl(C[i]) + ' como SIN SERVICIO?\n\n'
      + 'Va a desaparecer de los pedidos, de la ruta y del VIP.\n'
      + 'Su historial y sus facturas NO se tocan.';
    if(debe > 0.005) msg += '\n\n\u26a0\ufe0f TE DEBE $' + fmtNum(debe)
      + '.\nSigue apareciendo en Cuentas por Cobrar hasta que pague.';
    if(!confirm(msg)) return;
  }

  C[i].sinServicio = ahora;
  if(!ahora) delete C[i].sinServicio;
  SS('ncl', C);
  clientes = LS('ncl', []);
  try { verCl(id); } catch(e){}
}

function revisarPremioNuevo(cid){
  var nuevos = [];
  try {
    var conteo = calcVIP(cid) || {};
    var sonados = LS(CLAVE_PREMIOS_SONADOS, {});
    var cambio = false;

    Object.keys(conteo).forEach(function(k){
      var g = conteo[k];
      if(!g || g.gratis <= 0) return;
      // La huella lleva cuántos premios tiene: si gana OTRO, vuelve a sonar.
      var huella = String(cid) + '|' + k + '|' + g.gratis;
      if(sonados[huella]) return;
      sonados[huella] = Date.now();
      cambio = true;
      nuevos.push({ clave: k, nombre: g.nombre, puntos: g.puntos });
    });

    if(cambio){
      SS(CLAVE_PREMIOS_SONADOS, sonados);
      sonidoPremioVIP();
    }
  } catch(e){}
  return nuevos;
}

// Todos los premios listos, de todos los clientes. Para el asistente.
// 🎁 La lista de todos los que tienen premio, cuando hay varios. -3 sep-
function premiosListos(){
  var out = [];
  try {
    clientes = LS('ncl', []);
    clientes.forEach(function(c){
      var conteo = {};
      try { conteo = calcVIP(c.id) || {}; } catch(e){ return; }
      Object.keys(conteo).forEach(function(k){
        var g = conteo[k];
        if(g && g.gratis > 0){
          out.push({ cid: c.id, cliente: nombreCl(c), negocio: c.negocio || '',
                     grupo: g.nombre, clave: k, puntos: g.puntos, cuantos: g.gratis });
        }
      });
    });
  } catch(e){}
  return out;
}

function siguienteNumeroFactura(){
  var todas = LS('nv', []);
  var maxNum = 0;
  todas.forEach(function(v){
    if(v.numFactura){
      var n = parseInt(v.numFactura, 10);
      if(!isNaN(n) && n > maxNum) maxNum = n;
    }
  });
  return String(maxNum + 1).padStart(4, '0');
}

function renumerarTodasLasFacturas(){
  var todas = LS('nv', []);
  if(!todas.length){ alert('No hay facturas para renumerar.'); return; }
  if(!confirm('⚠️ Esto va a cambiar el número de TODAS las facturas ('+todas.length+' en total), ordenándolas de la más vieja a la más nueva empezando en 0001.\n\n¿Deseas continuar?')) return;
  var confirmacion2 = prompt('Para confirmar de verdad, escribe la palabra RENUMERAR (en mayúsculas) y toca Aceptar:');
  if(confirmacion2 !== 'RENUMERAR'){ alert('Cancelado — no se hizo ningún cambio.'); return; }
  todas.sort(function(a,b){
    var fa = parsearFechaVenta(a.fecha), fb = parsearFechaVenta(b.fecha);
    var da = fa ? fa.getTime() : 0, db = fb ? fb.getTime() : 0;
    if(da !== db) return da - db;
    return (a.id > b.id) ? 1 : (a.id < b.id ? -1 : 0);
  });
  todas.forEach(function(v, idx){ v.numFactura = String(idx+1).padStart(4, '0'); });
  SS('nv', todas);
  alert('✅ Listo. Se renumeraron '+todas.length+' facturas.\n\nLa más vieja quedó como #0001 y la más reciente como #'+todas[todas.length-1].numFactura+'.');
  if(document.getElementById('cxc-buscar')) cambiarPestanaCxC(window._cxcTabActiva || 'pendientes');
  else renderFacturas('');
}

// Prende y apaga la marca de CONSIGNACION. Al prenderla, ese cliente deja de contar
// para el programa VIP -son productos dejados a pagar segun se vendan, no compras-.
function toggleConsignacion(btn){
  var id = btn.getAttribute('data-clid');
  var C = LS('ncl', []);
  var i = C.findIndex(function(x){ return String(x.id) === String(id); });
  if(i < 0) return;
  var ahora = !C[i].consignacion;

  if(ahora && !confirm('Marcar a ' + nombreCl(C[i]) + ' como cuenta de CONSIGNACION?\n\n'
      + 'Sus compras dejaran de contar para el programa VIP.')) return;

  C[i].consignacion = ahora;
  if(!ahora) delete C[i].consignacion;
  SS('ncl', C);
  clientes = LS('ncl', []);
  try { verCl(id); } catch(e){}
}

function mostrarPopupFidelidad(cid, fidelidad){
  clientes = LS('ncl', []);
  var c = clientes.find(function(x){ return String(x.id)===String(cid); });
  if(!c) return;
  var overlay = document.getElementById('fidelidad-popup-overlay');
  if(!overlay){
    overlay = document.createElement('div');
    overlay.id = 'fidelidad-popup-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:99999;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:24px';
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = '';

  var card = document.createElement('div');
  card.style.cssText = 'background:white;border-radius:16px;padding:24px;max-width:340px;width:100%;text-align:center;box-shadow:0 10px 40px rgba(0,0,0,0.3)';
  card.innerHTML = '<div style="font-size:44px;margin-bottom:8px">🎉</div>'
    +'<div style="font-size:17px;font-weight:800;color:var(--nbs-ink);margin-bottom:6px">¡Meta de Fidelidad alcanzada!</div>'
    +'<div style="font-size:15px;font-weight:700;color:var(--nbs-gold-dark);margin-bottom:10px">'+nombreClConNegocio(c)+'</div>'
    +'<div style="font-size:13px;color:var(--nbs-muted);margin-bottom:18px;line-height:1.5">Este cliente acumuló $'+fmtNum(fidelidad.total)+' en compras de productos menores a $30. Es momento de darle un regalo entre $10 y $20 para agradecer su preferencia.</div>'
    +'<button id="fidpop-dar" style="width:100%;padding:13px;background:var(--nbs-gold);color:white;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;margin-bottom:8px">🎁 Registrar el regalo ahora</button>'
    +'<button id="fidpop-luego" style="width:100%;padding:12px;background:none;color:var(--nbs-muted);border:none;font-size:13px;cursor:pointer">Recordármelo después</button>';
  overlay.appendChild(card);
  overlay.style.display = 'flex'; overlay.scrollTop = 0;
  lanzarConfeti();

  document.getElementById('fidpop-dar').onclick = function(){
    overlay.style.display = 'none';
    darRegaloFidelidad(cid);
  };
  document.getElementById('fidpop-luego').onclick = function(){
    overlay.style.display = 'none';
  };
}


function adminAccion(accion){
  // "borrar" tiene su PROPIA proteccion triple (huella + PIN + escribir BORRAR) dentro de
  // borrarTodo(), asi que aqui NO se le pide PIN otra vez (seria doble). Las demas acciones
  // si pasan por el PIN general cuando esta activo.
  if(accion === 'borrar'){ borrarTodo(); return; }
  if(PIN_ACTIVO){
    var pin = prompt('🔒 PIN de administrador:');
    if(pin === null) return;
    if(!verificarPinConLimite(pin)) return;
  }
  if(accion === 'huerfanas') limpiarVentasHuerfanas();
}

var GCAT_QUICK = ['Gasolina','Comida','Gastos de oficina','Miscelaneos'];
var GCAT_BTNS = {'Gasolina':'gbtn-gas','Comida':'gbtn-com','Gastos de oficina':'gbtn-ofi','Miscelaneos':'gbtn-mis'};
var GCCOMIDA_BTNS = {'Desayuno':'gcbtn-des','Almuerzo':'gcbtn-alm','Cena':'gcbtn-cen','Merienda':'gcbtn-mer','Bebidas':'gcbtn-beb','Otro':'gcbtn-ot2'};

function selComidaTipo(tipo){
  document.getElementById('gcomida-tipo').value = tipo;
  Object.values(GCCOMIDA_BTNS).forEach(function(id){
    var b = document.getElementById(id);
    if(b){ b.style.background='white'; b.style.borderColor='#ddd'; b.style.color='#222'; }
  });
  var bid = GCCOMIDA_BTNS[tipo];
  if(bid){
    var b = document.getElementById(bid);
    if(b){ b.style.background='#E65100'; b.style.borderColor='#E65100'; b.style.color='white'; }
  }
}

function selGcat(cat){
  document.getElementById('gcat').value = cat;
  Object.values(GCAT_BTNS).forEach(function(id){
    var b = document.getElementById(id);
    if(b){ b.style.background='white'; b.style.borderColor='#ddd'; b.style.color='#222'; }
  });
  var bid = GCAT_BTNS[cat];
  if(bid){
    var b = document.getElementById(bid);
    if(b){ b.style.background='#E65100'; b.style.borderColor='#E65100'; b.style.color='white'; }
  }
  document.getElementById('gcat-select').value = '';
  document.getElementById('gcat-otro').style.display = 'none';
  document.getElementById('gcat-sel-display').style.display = 'none';
  // Mostrar panel de comida solo si se selecciona Comida
  var comidaWrap = document.getElementById('gcomida-wrap');
  if(comidaWrap){
    if(cat === 'Comida'){
      comidaWrap.style.display = 'block';
      document.getElementById('gcomida-tipo').value = '';
      document.getElementById('gcomida-desc').value = '';
      document.getElementById('gcomida-lugar').value = '';
      Object.values(GCCOMIDA_BTNS).forEach(function(id){
        var b2 = document.getElementById(id);
        if(b2){ b2.style.background='white'; b2.style.borderColor='#ddd'; b2.style.color='#222'; }
      });
    } else {
      comidaWrap.style.display = 'none';
    }
  }
}

function selGcatSelect(val){
  if(!val) return;
  // Reset quick buttons
  Object.values(GCAT_BTNS).forEach(function(id){
    var b = document.getElementById(id);
    if(b){ b.style.background='white'; b.style.borderColor='#ddd'; b.style.color='#222'; }
  });
  document.getElementById('gcat').value = val;
  var disp = document.getElementById('gcat-sel-display');
  disp.style.display = 'block';
  disp.textContent = '✓ Seleccionado: ' + val;
  document.getElementById('gcat-otro').style.display = val === 'Otro' ? 'block' : 'none';
}

function cargarLibreriaIA(callback){
  if(window.transformersLib){ callback(true); return; }
  import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3/dist/transformers.min.js')
    .then(function(modulo){ window.transformersLib = modulo; callback(true); })
    .catch(function(err){
      console.error(err);
      alert('No se pudo cargar la Inteligencia Artificial -necesita internet la primera vez que se usa, para descargarla-. Revisa tu conexión e intenta de nuevo.');
      callback(false);
    });
}

function similitudCoseno(a, b){
  var punto = 0, normA = 0, normB = 0;
  for(var i=0;i<a.length;i++){ punto += a[i]*b[i]; normA += a[i]*a[i]; normB += b[i]*b[i]; }
  return punto / (Math.sqrt(normA)*Math.sqrt(normB));
}

function activarBusquedaInteligente(){
  var wrap = document.getElementById('busqueda-inteligente-resultado');
  var btn = document.getElementById('btn-busqueda-inteligente');

  if(window._iaEmbeddingsCatalogo){
    mostrarCajaBusquedaIA();
    return;
  }

  btn.disabled = true;
  btn.textContent = '⏳ Preparando la Inteligencia Artificial por primera vez -puede tardar un minuto, solo esta vez...';

  cargarLibreriaIA(function(exito){
    if(!exito){ btn.disabled = false; btn.textContent = '🧠 Buscar con Inteligencia Artificial -encuentra productos aunque los escribas distinto o con una falta-'; return; }

    window.transformersLib.pipeline('feature-extraction', 'Xenova/multilingual-e5-small').then(function(extractor){
      window._iaExtractor = extractor;
      loadProds();
      var conStock = productos.filter(function(p){ return p.stock > 0; });

      btn.textContent = '⏳ Analizando tu catálogo -'+conStock.length+' productos, esto solo pasa una vez...';

      extractor(conStock.map(function(p){ return 'passage: '+p.nombre; }), { pooling: 'mean', normalize: true }).then(function(salida){
        var vectores = salida.tolist();
        window._iaEmbeddingsCatalogo = conStock.map(function(p, i){ return { producto: p, vector: vectores[i] }; });
        btn.disabled = false;
        btn.textContent = '🧠 Buscar con Inteligencia Artificial -ya está lista-';
        mostrarCajaBusquedaIA();
      }).catch(function(err){
        console.error(err);
        alert('Hubo un problema preparando la Inteligencia Artificial. Intenta de nuevo.');
        btn.disabled = false;
        btn.textContent = '🧠 Buscar con Inteligencia Artificial -encuentra productos aunque los escribas distinto o con una falta-';
      });
    }).catch(function(err){
      console.error(err);
      alert('No se pudo preparar la Inteligencia Artificial. Revisa tu conexión e intenta de nuevo.');
      btn.disabled = false;
      btn.textContent = '🧠 Buscar con Inteligencia Artificial -encuentra productos aunque los escribas distinto o con una falta-';
    });
  });
}

function mostrarCajaBusquedaIA(){
  var wrap = document.getElementById('busqueda-inteligente-resultado');
  wrap.style.display = 'block';
  wrap.innerHTML = '<div class="busca-caja" style="border:2px solid var(--nbs-gold);margin-bottom:8px"><span style="font-size:16px;flex-shrink:0;opacity:0.75">🔍</span><input class="busca-fuerte" type="text" id="ia-buscar-input" placeholder="Escribe lo que buscas..."></div>'
    + '<div id="ia-buscar-resultados"></div>';
  document.getElementById('ia-buscar-input').addEventListener('input', debounce(function(){
    buscarConIA(document.getElementById('ia-buscar-input').value);
  }, 400));
  document.getElementById('ia-buscar-input').focus();
}

function debounce(fn, espera){
  var t;
  return function(){
    clearTimeout(t);
    var args = arguments;
    t = setTimeout(function(){ fn.apply(null, args); }, espera);
  };
}

function buscarConIA(consulta){
  var resDiv = document.getElementById('ia-buscar-resultados');
  if(!consulta || !consulta.trim()){ resDiv.innerHTML = ''; return; }
  resDiv.innerHTML = '<div style="font-size:12px;color:#aaa;padding:8px">Buscando...</div>';

  window._iaExtractor('query: '+consulta, { pooling: 'mean', normalize: true }).then(function(salida){
    var vectorConsulta = salida.tolist()[0];
    var conPuntaje = window._iaEmbeddingsCatalogo.map(function(item){
      return { producto: item.producto, puntaje: similitudCoseno(vectorConsulta, item.vector) };
    });
    conPuntaje.sort(function(a,b){ return b.puntaje - a.puntaje; });
    var top5 = conPuntaje.slice(0, 5);

    resDiv.innerHTML = top5.map(function(r){
      return '<div style="background:white;border-radius:8px;padding:10px;margin-bottom:6px;border:0.5px solid #eee;display:flex;justify-content:space-between;align-items:center">'
        + '<div><div style="font-size:13px;font-weight:600">'+r.producto.nombre+'</div>'
        + '<div style="font-size:11px;color:#aaa">Stock: '+r.producto.stock+' · $'+fmtNum(r.producto.precio)+'</div></div>'
        + '<div style="font-size:10px;color:#5E35B1;font-weight:700">'+Math.round(r.puntaje*100)+'% parecido</div>'
        + '</div>';
    }).join('');
  }).catch(function(err){
    console.error(err);
    resDiv.innerHTML = '<div style="font-size:12px;color:#C62828;padding:8px">Hubo un problema buscando. Intenta de nuevo.</div>';
  });
}

function cargarLibreriaOCR(callback){
  if(window.Tesseract){ callback(true); return; }
  var script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
  script.onload = function(){ callback(true); };
  script.onerror = function(){
    alert('No se pudo cargar la herramienta de lectura de texto -necesita internet la primera vez que se usa-. Revisa tu conexión e intenta de nuevo.');
    callback(false);
  };
  document.head.appendChild(script);
}

// Prepara la imagen para que el lector de texto la entienda mejor: la pasa a blanco y negro,
// le sube el contraste, y la agranda si esta chica -todo esto ayuda bastante a la precision del OCR-.
function saveGasto(){
  var cat = document.getElementById('gcat').value;
  if(!cat){ alert('Selecciona una categoría'); return; }
  if(cat === 'Otro'){
    var desc = document.getElementById('gcat-desc').value.trim();
    if(!desc){ alert('Describe el tipo de gasto'); return; }
    cat = desc;
  }
  var monto = dinero(document.getElementById('gmonto').value) || 0;
  if(monto <= 0){ alert('Ingresa un monto válido'); return; }
  // Convertir la fecha del campo -formato AAAA-MM-DD- al formato que usa el resto de la app -MM/DD/AAAA-
  var fechaEl = document.getElementById('gfecha');
  var fecha = fechaHoy();
  if(fechaEl && fechaEl.value){
    var fparts = fechaEl.value.split('-');
    if(fparts.length === 3) fecha = fparts[1]+'/'+fparts[2]+'/'+fparts[0];
  }
  var nota = limpiarTexto(document.getElementById('gnota').value.trim());

  // Datos adicionales de comida
  var comidaTipo = ''; var comidaDesc = ''; var comidaLugar = '';
  if(cat === 'Comida'){
    comidaTipo = document.getElementById('gcomida-tipo').value;
    comidaDesc = document.getElementById('gcomida-desc').value.trim();
    comidaLugar = document.getElementById('gcomida-lugar').value.trim();
    if(!comidaTipo){ alert('Selecciona el tipo de comida (Desayuno, Almuerzo, etc.)'); return; }
    // Construir nota automática
    var notaComida = comidaTipo;
    if(comidaDesc) notaComida += ' · ' + comidaDesc;
    if(comidaLugar) notaComida += ' · ' + comidaLugar;
    nota = notaComida + (nota ? ' · ' + nota : '');
  }

  // -confirmacion redundante quitada, el boton de Guardar ya es la confirmacion-

  var gastos = LS('ngastos', []);
  var fotoGasto = document.getElementById('gasto-foto-data').value || null;
  gastos.push({ id: Date.now(), cat: cat, monto: monto, fecha: fecha, nota: nota,
    comidaTipo: comidaTipo, comidaDesc: comidaDesc, comidaLugar: comidaLugar, foto: fotoGasto });
  SS('ngastos', gastos);

  // Reset form
  document.getElementById('gmonto').value = '0.00';
  document.getElementById('gnota').value = '';
  document.getElementById('gcat').value = '';
  document.getElementById('gcat-select').value = '';
  document.getElementById('gcat-otro').style.display = 'none';
  document.getElementById('gcat-sel-display').style.display = 'none';
  document.getElementById('gcomida-wrap').style.display = 'none';
  document.getElementById('gcomida-tipo').value = '';
  document.getElementById('gcomida-desc').value = '';
  document.getElementById('gcomida-lugar').value = '';
  quitarFotoGasto();
  Object.values(GCAT_BTNS).forEach(function(id){
    var b = document.getElementById(id);
    if(b){ b.style.background='white'; b.style.borderColor='#ddd'; b.style.color='#222'; }
  });
  Object.values(GCCOMIDA_BTNS).forEach(function(id){
    var b = document.getElementById(id);
    if(b){ b.style.background='white'; b.style.borderColor='#ddd'; b.style.color='#222'; }
  });
  flash('mk-gasto');
  setTimeout(function(){
    document.getElementById('gastos-n').style.display = 'none';
    document.getElementById('gastos-l').style.display = 'block';
    renderGastos();
  }, 700);
}

function renderGastos(){
  var gastos = LS('ngastos', []);
  var desde = document.getElementById('gfrom').value;
  var hasta = document.getElementById('gto').value;
  var el = document.getElementById('glista');
  el.innerHTML = '';

  var filt = gastos.filter(function(g){
    if(!desde && !hasta) return true;
    var gd = parsearFechaVenta(g.fecha);
    var desdeD = desde ? new Date(desde+'T00:00:00') : null;
    var hastaD = hasta ? new Date(hasta+'T23:59:59') : null;
    if(desdeD && gd < desdeD) return false;
    if(hastaD && gd > hastaD) return false;
    return true;
  });

  if(!filt.length){
    document.getElementById('gastos-resumen').style.display = 'none';
    el.innerHTML = '<div class="card"><p style="color:#aaa;text-align:center;padding:20px">Sin gastos registrados</p></div>';
    return;
  }

  // Agrupar por categoría
  var porCat = {};
  var total = 0;
  filt.forEach(function(g){
    if(!porCat[g.cat]) porCat[g.cat] = 0;
    porCat[g.cat] += g.monto;
    total += g.monto;
  });

  // Resumen total
  document.getElementById('gastos-resumen').style.display = 'block';
  document.getElementById('gastos-total').textContent = '$' + fmtNum(total);

  // Resumen por categoría
  var resCard = document.createElement('div'); resCard.className = 'card';
  resCard.innerHTML = '<p style="font-size:13px;font-weight:700;margin-bottom:10px">Por categoría</p>';
  Object.keys(porCat).sort(function(a,b){ return porCat[b]-porCat[a]; }).forEach(function(cat){
    var pct = total > 0 ? Math.round((porCat[cat]/total)*100) : 0;
    var row = document.createElement('div');
    row.style.cssText = 'margin-bottom:10px';
    row.innerHTML = '<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px">'
      +'<span style="font-weight:600">'+cat+'</span>'
      +'<span style="font-weight:700;color:#C62828">$'+fmtNum(porCat[cat])+' <span style="color:#aaa;font-weight:400">('+pct+'%)</span></span></div>'
      +'<div style="height:6px;background:#eee;border-radius:3px;overflow:hidden">'
      +'<div style="height:100%;width:'+pct+'%;background:#C62828;border-radius:3px"></div></div>';
    resCard.appendChild(row);
  });
  el.appendChild(resCard);

  // Lista de gastos - solo resumen, detalles al tocar
  var detCard = document.createElement('div'); detCard.className = 'card';
  detCard.innerHTML = '<p style="font-size:13px;font-weight:700;margin-bottom:10px">Lista de gastos</p>';
  filt.slice().sort(function(a,b){ return new Date(b.fecha)-new Date(a.fecha); }).forEach(function(g){
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #f0f0f0;cursor:pointer';
    row.innerHTML = '<div><div style="font-size:13px;font-weight:600">'+g.cat+(g.foto?' 📷':'')+'</div>'
      +'<div style="font-size:11px;color:#aaa">'+g.fecha+'</div></div>'
      +'<div style="display:flex;align-items:center;gap:10px">'
      +'<span style="font-weight:700;color:#C62828">$'+fmtNum(g.monto)+'</span>'
      +'<span style="color:#ddd;font-size:18px">›</span>'
      +'</div>';
    row.onclick = (function(gasto){ return function(){ verDetalleGasto(gasto); }; })(g);
    detCard.appendChild(row);
  });
  el.appendChild(detCard);
}

// Sube la pantalla al principio. Sin esto, al volver de un detalle a su lista el
// contenido cambia pero uno sigue mirando la misma parte de la pantalla, y parece
// que el boton no hizo nada. -4 ago, lo encontro Sensei en Gastos-
function subirPantalla(){
  try { window.scrollTo({ top: 0, behavior: 'smooth' }); }
  catch(e){ try { window.scrollTo(0, 0); } catch(e2){} }
}

function verDetalleGasto(g){
  var el = document.getElementById('glista');
  el.innerHTML = '';
  document.getElementById('gastos-resumen').style.display = 'none';

  var card = document.createElement('div'); card.className = 'card';
  card.style.borderLeft = '4px solid #C62828';
  card.innerHTML = '<button onclick="renderGastos();subirPantalla()" style="background:none;border:none;cursor:pointer;color:#1565C0;font-size:13px;margin-bottom:12px;padding:0">← Volver a la lista</button>'
    +'<div style="font-size:18px;font-weight:700;margin-bottom:4px">'+g.cat+'</div>'
    +'<div style="font-size:24px;font-weight:700;color:#C62828;margin-bottom:14px">$'+fmtNum(g.monto)+'</div>'
    +'<div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f0f0f0">'
    +'<span style="color:#777;font-size:13px">Fecha</span><span style="font-weight:600;font-size:13px">'+g.fecha+'</span></div>';

  if(g.cat === 'Comida' || g.comidaTipo){
    if(g.comidaTipo) card.innerHTML += '<div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f0f0f0">'
      +'<span style="color:#777;font-size:13px">Tipo</span><span style="font-weight:600;font-size:13px">'+g.comidaTipo+'</span></div>';
    if(g.comidaDesc) card.innerHTML += '<div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f0f0f0">'
      +'<span style="color:#777;font-size:13px">¿Qué se compró?</span><span style="font-weight:600;font-size:13px">'+g.comidaDesc+'</span></div>';
    if(g.comidaLugar) card.innerHTML += '<div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f0f0f0">'
      +'<span style="color:#777;font-size:13px">Lugar</span><span style="font-weight:600;font-size:13px">'+g.comidaLugar+'</span></div>';
  }

  if(g.nota) card.innerHTML += '<div style="padding:10px 0;border-bottom:1px solid #f0f0f0">'
    +'<div style="color:#777;font-size:13px;margin-bottom:4px">Notas</div>'
    +'<div style="font-size:13px">'+escaparHtml(g.nota)+'</div></div>';

  if(g.foto){
    card.innerHTML += '<div style="padding:10px 0;border-bottom:1px solid #f0f0f0">'
      +'<div style="color:#777;font-size:13px;margin-bottom:6px">📷 Foto del recibo</div>'
      +'<div id="gasto-foto-thumb" style="width:100px;height:100px;border-radius:8px;overflow:hidden;cursor:pointer;background:#f0f0f0"></div></div>';
  }

  card.innerHTML += '<div style="display:flex;gap:8px;margin-top:14px">'
    +'<button id="btn-editar-gasto" style="flex:1;padding:12px;background:#1565C0;color:white;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600">✏️ Editar</button>'
    +'<button id="btn-eliminar-gasto" style="flex:1;padding:12px;background:#B71C1C;color:white;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600">🗑️ Eliminar</button>'
    +'</div>';
  el.appendChild(card);

  if(g.foto){
    var thumb = document.getElementById('gasto-foto-thumb');
    thumb.innerHTML = '<img src="'+g.foto+'" style="width:100%;height:100%;object-fit:cover">';
    thumb.onclick = function(){ verFotoGasto(g.foto); };
  }

  document.getElementById('btn-editar-gasto').onclick = function(){ editarGasto(g); };
  document.getElementById('btn-eliminar-gasto').onclick = function(){ eliminarGasto(g.id); };
}

function editarGasto(g){
  var el = document.getElementById('glista');
  el.innerHTML = '';
  document.getElementById('gastos-resumen').style.display = 'none';

  var esComida = g.cat === 'Comida' || !!g.comidaTipo;
  var comidaBtns = ['Desayuno','Almuerzo','Cena','Merienda','Bebidas','Otro'];
  var comidaBtnIds = {'Desayuno':'egcbtn-des','Almuerzo':'egcbtn-alm','Cena':'egcbtn-cen','Merienda':'egcbtn-mer','Bebidas':'egcbtn-beb','Otro':'egcbtn-ot2'};

  var card = document.createElement('div'); card.className = 'card';
  card.innerHTML = '<button onclick="verDetalleGasto(window._gastoEditando)" style="background:none;border:none;cursor:pointer;color:#1565C0;font-size:13px;margin-bottom:12px;padding:0">← Volver al detalle</button>'
    +'<p style="font-size:15px;font-weight:700;margin-bottom:12px">✏️ Editar gasto</p>'
    +'<label class="lbl">Categoría</label>'
    +'<input class="inp" id="eg-cat" type="text" value="'+g.cat+'">'
    +'<label class="lbl">Monto ($)</label>'
    +'<input class="inp" id="eg-monto" type="text" inputmode="numeric" value="'+g.monto.toFixed(2)+'" onfocus="this.select()" oninput="formatoMoneda(this)">'
    +'<label class="lbl">Fecha</label>'
    +'<input class="inp" id="eg-fecha" type="date" value="'+g.fecha+'">'
    +(esComida ?
      '<div style="background:#FFF8E1;border-radius:10px;padding:12px;margin-bottom:10px">'
      +'<div style="font-size:12px;font-weight:700;color:#E65100;margin-bottom:8px">🍽️ DETALLE DE COMIDA</div>'
      +'<label class="lbl">Tipo</label>'
      +'<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:8px">'
      +comidaBtns.map(function(t){
        var bid = comidaBtnIds[t];
        var activo = g.comidaTipo === t;
        return '<button type="button" id="'+bid+'" onclick="selComidaTipoEdit(\''+t+'\')" style="padding:10px 4px;border:2px solid '+(activo?'#E65100':'#ddd')+';border-radius:8px;background:'+(activo?'#E65100':'white')+';color:'+(activo?'white':'#222')+';cursor:pointer;font-size:12px;font-weight:600">'+t+'</button>';
      }).join('')
      +'</div>'
      +'<label class="lbl">¿Qué se compró?</label>'
      +'<input class="inp" id="eg-comida-desc" type="text" value="'+(g.comidaDesc||'')+'" placeholder="Ej: Sandwich y café...">'
      +'<label class="lbl">Nombre del lugar</label>'
      +'<input class="inp" id="eg-comida-lugar" type="text" value="'+(g.comidaLugar||'')+'" placeholder="Ej: Dunkin Donuts...">'
      +'<input type="hidden" id="eg-comida-tipo" value="'+(g.comidaTipo||'')+'">'
      +'</div>'
    : '')
    +'<label class="lbl">Notas</label>'
    +'<input class="inp" id="eg-nota" type="text" value="'+(g.nota||'')+'">'
    +'<label class="lbl">Foto del recibo o factura (opcional)</label>'
    +'<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">'
    +'<div id="eg-foto-preview" onclick="abrirOpcionesFotoGasto(\'eg\')" style="width:56px;height:56px;border-radius:10px;background:'+(g.foto?'#f0f0f0':'var(--nbs-gold-bg)')+';border:'+(g.foto?'none':'2px dashed var(--nbs-gold)')+';display:flex;align-items:center;justify-content:center;font-size:26px;flex-shrink:0;overflow:hidden;cursor:pointer">'+(g.foto?'<img src="'+g.foto+'" style="width:100%;height:100%;object-fit:cover">':'📷')+'</div>'
    +'<div style="font-size:12px;color:#aaa;flex:1">Toca para tomar una foto, elegir de la galería, o quitar la actual</div>'
    +'</div>'
    +'<input type="hidden" id="eg-foto-data" value="'+(g.foto||'')+'">'
    +'<input type="file" id="eg-foto-camara" accept="image/*" capture="camera" style="display:none" onchange="cargarFotoGasto(this,\'eg\')">'
    +'<input type="file" id="eg-foto-galeria" accept="image/*" style="display:none" onchange="cargarFotoGasto(this,\'eg\')">'
    +'<button class="btn" style="background:#2E7D32;color:white" onclick="guardarEdicionGasto('+g.id+')">✓ Guardar cambios</button>';
  el.appendChild(card);
  window._gastoEditando = g;
}

function selComidaTipoEdit(tipo){
  document.getElementById('eg-comida-tipo').value = tipo;
  var ids = {'Desayuno':'egcbtn-des','Almuerzo':'egcbtn-alm','Cena':'egcbtn-cen','Merienda':'egcbtn-mer','Bebidas':'egcbtn-beb','Otro':'egcbtn-ot2'};
  Object.values(ids).forEach(function(id){
    var b = document.getElementById(id);
    if(b){ b.style.background='white'; b.style.borderColor='#ddd'; b.style.color='#222'; }
  });
  var b = document.getElementById(ids[tipo]);
  if(b){ b.style.background='#E65100'; b.style.borderColor='#E65100'; b.style.color='white'; }
}

function guardarEdicionGasto(id){
  var cat = document.getElementById('eg-cat').value.trim();
  var monto = dinero(document.getElementById('eg-monto').value) || 0;
  // Convertir la fecha del campo -formato AAAA-MM-DD- al formato que usa el resto de la app -MM/DD/AAAA-
  var fechaElEdit = document.getElementById('eg-fecha');
  var fecha = fechaHoy();
  if(fechaElEdit && fechaElEdit.value){
    var fpartsEdit = fechaElEdit.value.split('-');
    if(fpartsEdit.length === 3) fecha = fpartsEdit[1]+'/'+fpartsEdit[2]+'/'+fpartsEdit[0];
  }
  var nota = limpiarTexto(document.getElementById('eg-nota').value.trim());
  if(!cat){ alert('La categoría es requerida'); return; }
  if(monto <= 0){ alert('El monto debe ser mayor a $0.00'); return; }
  // -confirmacion redundante quitada, el boton de Guardar ya es la confirmacion-

  var comidaTipo = document.getElementById('eg-comida-tipo') ? document.getElementById('eg-comida-tipo').value : '';
  var comidaDesc = document.getElementById('eg-comida-desc') ? document.getElementById('eg-comida-desc').value.trim() : '';
  var comidaLugar = document.getElementById('eg-comida-lugar') ? document.getElementById('eg-comida-lugar').value.trim() : '';

  if(cat === 'Comida' && comidaTipo){
    var notaComida = comidaTipo;
    if(comidaDesc) notaComida += ' · '+comidaDesc;
    if(comidaLugar) notaComida += ' · '+comidaLugar;
    nota = notaComida;
  }

  var gastos = LS('ngastos', []);
  var idx = gastos.findIndex(function(g){ return String(g.id) === String(id); });
  if(idx === -1){ alert('Gasto no encontrado'); return; }
  gastos[idx].cat = cat;
  gastos[idx].monto = monto;
  gastos[idx].fecha = fecha;
  gastos[idx].nota = nota;
  gastos[idx].comidaTipo = comidaTipo;
  gastos[idx].comidaDesc = comidaDesc;
  gastos[idx].comidaLugar = comidaLugar;
  var fotoEl = document.getElementById('eg-foto-data');
  if(fotoEl) gastos[idx].foto = fotoEl.value || null;
  SS('ngastos', gastos);
  alert('✅ Gasto actualizado correctamente.');
  verDetalleGasto(gastos[idx]);
}

function eliminarGasto(id){
  if(!confirm('¿Eliminar este gasto?')) return;
  var gastos = LS('ngastos', []);
  gastos = gastos.filter(function(g){ return g.id !== id; });
  SS('ngastos', gastos);
  renderGastos();
}


function llenarDataLists(){
  clientes = LS('ncl', []);
  suplidores = LS('nsup', []);
  var dirs = new Set();
  var cities = new Set();
  clientes.forEach(function(c){
    if(c.dir) dirs.add(c.dir);
    if(c.ciudad) cities.add(c.ciudad);
  });
  suplidores.forEach(function(s){
    if(s.dir) dirs.add(s.dir);
    if(s.ciudad) cities.add(s.ciudad);
  });
  var dl = document.getElementById('dir-list');
  if(dl){ dl.innerHTML = ''; dirs.forEach(function(d){ var o = document.createElement('option'); o.value = d; dl.appendChild(o); }); }
  var cl2 = document.getElementById('city-list');
  if(cl2){ cl2.innerHTML = ''; cities.forEach(function(c){ var o = document.createElement('option'); o.value = c; cl2.appendChild(o); }); }
}

// Muestra brevemente el mensaje de confirmación (ej. "Producto actualizado") y lo oculta despues
function flash(id){
  var el = document.getElementById(id);
  if(!el) return;
  if(!el.getAttribute('data-msg')) el.setAttribute('data-msg', el.textContent.trim());
  var texto = el.getAttribute('data-msg');
  el.innerHTML = '<span class="snk-check">✓</span><span>'+texto+'</span>';
  el.style.display = '';
  el.classList.add('mostrando');
  clearTimeout(el._flashTimeout);
  el._flashTimeout = setTimeout(function(){ el.classList.remove('mostrando'); }, 1800);
}

// ===== MANUAL DE USUARIO =====
var MANUAL_SECCIONES = [
    { g:"DINERO", t:"\ud83e\uddfe Estado de cuenta del cliente", c:[
    "## PARA QUE SIRVE",
    "Es la pantalla que le ensenas al cliente cuando dice que pago una cantidad y la app ensena otra.",
    "Trae TODO su movimiento: cada factura y cada pago, con su fecha, su hora y su numero de recibo.",
    "## COMO SE LLEGA",
    "[[ Clientes -> tocas el cliente\n         |\n         v\n  [Pedido] [Cobrar] [Vender]\n  +----------------------------+\n  | \ud83e\uddfe Estado de cuenta      |  <- el boton azul\n  +----------------------------+\n  \ud83d\udcc7 Sus datos ]]",
    "## LO QUE VAS A VER",
    "[[ LE FACTURE    ME PAGO      DEBE\n  $105.00      $80.00     $25.00 ]]",
    "## \ud83d\udd11 LO MAS IMPORTANTE: EL PAGO COMPLETO",
    "Cuando le cobras $80 y ese pago se reparte entre tres facturas, la app ANTES guardaba tres pagos sueltos: $35 aqui, $15 alla y $30 en otra.",
    "!!Por eso el cliente decia 80 y el sistema ensenaba 35. Los dos tenian razon, mirando cosas distintas.",
    "Ahora se ve como UN pago de $80. Y al tocarlo se abre y te ensena en que facturas se repartio:",
    "[[ \ud83d\udcb5 SUS PAGOS (1)\n +------------------------------+\n | $80.00      se repartio en 3 |\n | 08/15/2026 . 10:30 AM . R260815 |\n | \ud83d\udcb5 Efectivo $80.00           |\n +------------------------------+\n | A QUE FACTURAS SE APLICO     |\n | #0101 . 07/10/2026   $35.00  |\n | #0102 . 07/20/2026   $15.00  |\n | #0103 . 08/01/2026   $30.00  |\n +------------------------------+ ]]",
    "## EL NUMERO DE RECIBO",
    "Cada cobro lleva ahora su numero, asi: R260829-1432-7. Todas las partes del mismo cobro llevan el MISMO numero, por eso la app sabe que fueron uno solo.",
    "!!Los pagos de ANTES del 29 de agosto no tienen numero, porque no existia. Esos se juntan por FECHA, y la pantalla te lo avisa. Los de ahora en adelante salen exactos."
    ]},

    { g:"DINERO", t:"\ud83d\udcac El comprobante para el cliente", c:[
    "## PARA QUE SIRVE",
    "Para que quede constancia del balance para los dos. Si el cliente contesta, ahi queda por escrito que ambos vieron el mismo numero el mismo dia.",
    "## CUANDO SALE",
    "Solo. Despues de cada VENTA y de cada COBRO. Tu lo lees y decides si lo mandas: no se manda nada sin que lo veas.",
    "## HAY DOS MENSAJES",
    "[[ +--------------------------------+\n | [ \ud83d\udcac Mandar el completo ]      |\n |                                |\n | O MANDA SOLO ESTO              |\n | Hola Sr. Carlos, Pago de hoy...|\n | [ \u270f\ufe0f Mandar solo el corto ]    |\n | ------------------------------ |\n | OPCIONAL . solo si lo crees    |\n | necesario con este cliente     |\n | [ \u270d\ufe0f Que firme su balance ]    |\n |                                |\n | [ Ahora no ]                   |\n +--------------------------------+ ]]",
    "## EL CORTO",
    "[[ Hola Sr. Carlos,\n\nPago de hoy: $120.00\n\nGracias por su pago. Su nuevo\nbalance pendiente es de $142.00.\n\nFavor confirmar que esta de\nacuerdo. Gracias. ]]",
    "El 'favor confirmar' es lo que convierte el mensaje en PRUEBA.",
    "## EL COMPLETO",
    "Lleva ademas la fecha, la hora, el numero de recibo, como te pago, y si el pago se repartio, a que facturas fue cada parte.",
    "## MANDAR EL DE UN PAGO VIEJO",
    "En el estado de cuenta, abres cualquier pago -de la fecha que sea- y ahi mismo tiene sus dos botones. Manda el mensaje de ESE pago, con SU fecha y SU recibo.",
    "!!Ojo: el balance que sale en el mensaje es el de HOY, no el de aquel dia. La app te lo recuerda antes de mandarlo.",
    "## SI ABRE EL WHATSAPP EQUIVOCADO",
    "Menu -> Herramientas -> \ud83d\udce4 Mandar por WhatsApp. Ahi puedes cambiar a COPIAR Y PEGAR: la app copia el mensaje, abre el chat y tu lo pegas. Es un paso mas pero funciona seguro.",
    "Y en Ajustes puedes escoger cual WhatsApp usar: el normal o el Business."
    ]},

    { g:"DINERO", t:"\u270d\ufe0f Que el cliente firme su balance", c:[
    "## PARA QUE SIRVE",
    "Es la prueba mas fuerte que existe: el cliente firma en tu telefono confirmando cuanto debe, delante de ti.",
    "!!ES OPCIONAL. Hay clientes de confianza con los que esto no hace falta. Tu decides con quien lo usas.",
    "## COMO SE USA",
    "[[ 1. Le cobras como siempre\n        |\n        v\n 2. Sale el comprobante, y abajo:\n    OPCIONAL . solo si lo crees\n    necesario con este cliente\n    [ \u270d\ufe0f Que firme su balance ]\n        |\n        v\n 3. Le pasas el telefono\n        |\n        v\n 4. El lee y firma con el dedo\n        |\n        v\n 5. Tocas [ \u2713 Confirmado ] ]]",
    "## LO QUE EL VE",
    "[[ +----------------------------------+\n |  \u270d\ufe0f Confirmacion de balance      |\n |  Que el cliente lo lea y firme   |\n |                                  |\n |  Carlos Tavarez                  |\n |  LUXURY BARBER STUDIO            |\n |  Pago hoy          $120.00       |\n |  SU BALANCE        $142.00       |\n |                                  |\n |  +----------------------------+  |\n |  |     firma aqui             |  |\n |  +----------------------------+  |\n |  [ \ud83d\udd04 Borrar ] [ \u2713 Confirmado ] |\n +----------------------------------+ ]]",
    "Queda guardado con la fecha, la hora, el balance exacto y su firma.",
    "## FUNCIONA SIN INTERNET",
    "No hace falta senal. Se guarda en el telefono y sube a la nube cuando haya.",
    "## \ud83d\udccb QUIEN NO HA FIRMADO",
    "Menu -> \u270d\ufe0f Balances sin confirmar",
    "[[ 2 cliente(s) . $272.00\n\n Carlos Tavarez        $192.00\n LUXURY . confirmo $142.00\n         el 08/30/2026\n\n Jorge Duarte           $80.00\n GRAN VIA . nunca ha confirmado ]]",
    "La app lo lleva sola: un cliente sale en la lista cuando DEBE dinero y su balance de HOY no coincide con el que firmo la ultima vez. Si le vendes otra vez, vuelve a hacer falta que confirme.",
    "Tocas uno y vas directo a su ficha.",
    "## PARA APAGARLO DEL TODO",
    "Menu -> \ud83d\udd8b\ufe0f Pedir firma del balance. Desaparece de todas partes. El comprobante por WhatsApp sigue igual."
    ]},

    { g:"MERCANC\u00cdA", t:"\ud83d\ude9a Cierre de ruta \u2014 cuadrar la mercancia", c:[
    "## PARA QUE SIRVE",
    "Ya cuadrabas el DINERO con el Cuadre de Caja. Esto cuadra la MERCANCIA.",
    "!!Un producto que se pierde no lo dice ningun numero de dinero: simplemente deja de estar, y meses despues el inventario no cuadra y nadie sabe cuando empezo.",
    "## COMO SE LLEGA",
    "Menu -> \ud83d\ude90 Control de la Van -> boton \ud83d\ude9a Cierre de ruta",
    "## COMO SE USA",
    "Al terminar el dia, cuentas lo que te quedo en la van y lo escribes. La app lo compara con lo que DEBERIA quedar.",
    "[[ CONTADOS   FALTAN   SOBRAN\n   3/3         2         1\n\n \u26a0\ufe0f Te faltan 2 unidad(es)\n    A tu costo son $8.00\n\n Gel 700ml\n cargaste 24 . vendiste 4\n deberian quedar 20   [18]   -2\n\n Colonia 400ml\n deberian quedar 10   [11]   +1\n\n Wax\n deberian quedar 6    [ 6] cuadra ]]",
    "## LO QUE MAS IMPORTA",
    "Te dice CUANTO VALE lo que falta, a tu costo. No es lo mismo que falten 2 gomas que 2 clippers.",
    "## NO TOCA NADA",
    "Ni el inventario, ni las ventas, ni lo que cargaste en la van. Solo apunta lo que contaste y la diferencia, con su fecha."
    ]},

    { g:"DINERO", t:"\u21a9\ufe0f Devoluciones con motivo y foto", c:[
    "## LO QUE CAMBIO",
    "Ahora al devolver escoges el MOTIVO de una lista, y le puedes tomar FOTO a lo devuelto.",
    "## LOS SIETE MOTIVOS",
    "[[ \ud83d\udd27 Vino danado o defectuoso\n \u274c No era el que pidio\n \ud83d\udcc9 No se le vendio\n \ud83d\udcc5 Vencido o muy viejo\n \u2795 Le llego de mas\n \ud83d\ude41 No le gusto al cliente\n ... Otro motivo ]]",
    "Se guarda por su clave, asi que mas adelante se pueden CONTAR: ver que te devuelven mas y por que.",
    "## LA FOTO",
    "Es opcional. Pero si hay discusion despues, la foto la resuelve.",
    "El motivo y la foto salen luego en la ficha del cliente y en la lista de devoluciones. La foto se toca para verla grande."
    ]},

    { g:"HERRAMIENTAS", t:"\ud83e\udded Que uso mas \u2014 el record de uso", c:[
    "## PARA QUE SIRVE",
    "La app apunta cuantas veces abres cada pantalla. Con eso se decide QUE MERECE ESTAR EN EL INICIO, con datos y no adivinando.",
    "## COMO SE LLEGA",
    "Menu -> Herramientas -> \ud83e\udded Que uso mas",
    "[[ \ud83d\udcca QUE USO MAS\n De 5 veces que has entrado:\n\n 1. Clientes - 3 veces (60%) . hoy\n 2. Catalogo - 1 vez (20%) . hoy\n 3. Pedidos Rapidos - 1 vez (20%) ]]",
    "## LO QUE APUNTA Y LO QUE NO",
    "Solo cuenta cuantas veces abres cada pantalla y cuando fue la ultima. NADA MAS. Ni lo que escribes, ni lo que vendes, ni nada que salga del telefono.",
    "Se puede poner a cero cuando quieras."
    ]},

    { g:"SEGURIDAD", t:"\ud83d\udd19 El boton atras del telefono", c:[
    "## COMO FUNCIONA",
    "El boton atras del telefono va cerrando lo que tengas abierto, de uno en uno, en este orden:",
    "[[ 1. El recuadro que este encima\n      (estado de cuenta, firma,\n       cierre de ruta, etc.)\n         |\n         v\n 2. El menu lateral, si esta abierto\n         |\n         v\n 3. Vuelve a la pantalla anterior\n         |\n         v\n 4. Y cuando ya no hay a donde\n    volver, PREGUNTA ]]",
    "## EL LETRERO DE SALIR",
    "[[ +--------------------------------+\n |             \ud83d\udeaa                 |\n |      \u00bfSalir de la app?         |\n |  Tu informacion ya esta        |\n |  guardada.                     |\n |                                |\n |  [ \u2714 No, quedarme aqui ]       |\n |  [ \ud83d\udeaa Si, salir de la app ]     |\n +--------------------------------+ ]]",
    "!!Con este letrero abierto, el boton atras NO HACE NADA. Solo se sale tocando uno de los dos botones. Puedes darle a atras las veces que quieras sin miedo a que se cierre."
    ]},

    { g:"HERRAMIENTAS", t:"\ud83d\udd0e Como buscar en la app", c:[
    "## UNA PALABRA",
    "Sale TODO lo que la lleve, por donde sea: el nombre, el negocio, el telefono o la direccion.",
    "[[ Escribes:  plainfield\n\n Salen:\n  . PLAINFIELD BARBERSHOP\n  . ELITE BARBERSHOP\n    (calle Plainfield)\n  . RD BARBER SHOP\n    (Plainfield Ave)\n  . PLAINFIELD BEAUTY ]]",
    "## DOS O MAS PALABRAS",
    "Sale solo lo que lleva la FRASE COMPLETA junta.",
    "[[ Escribes:  plainfield barbershop\n\n Sale:\n  . PLAINFIELD BARBERSHOP\n\n Y ya. Los de la calle no. ]]",
    "!!Si NINGUNO lleva la frase junta, se ensena lo de antes. Asi nunca te quedas sin resultados por afinar de mas.",
    "## SIRVE EN TODAS PARTES",
    "Clientes, catalogo, suplidores, la venta, los pedidos rapidos, las compras, la van, la lista de relleno... los 28 buscadores de la app.",
    "## LO QUE NO CAMBIO",
    "Buscar por dinero con el signo -escribes $10 y salen los de ese precio-, y el diccionario de tus palabras -escribes 'gelatina' y encuentra el gel-."
    ]},
    { g:"INFORMES", t:"\ud83d\udcca Informe del 16 y 17 de agosto 2026", c:[
    "## LO PRIMERO, Y LO MAS IMPORTANTE",
    "Tus datos estan limpios. Te preocupaba haberle dado mal el balance a algun cliente. Se reviso tu informacion factura por factura y no hay ni un centavo fuera de sitio.",
    "[[ Vendido        $23,009.59\nCobrado        $15,262.59\nPor cobrar     $7,747.00\nDescuadre  $0.00 ]]",
    "Y los 11 repartos de pago que tienes con clientes reales -Jhoan Cabrera, Alexis Barillas, Alberto Rosa, Braily Moya, Argenis Castillo, Wilmer Cepeda, Daniel- estan todos correctos, con su fecha y su monto.",
    "Ningun cliente tuyo tiene el balance mal.",
    "## RESUMEN EN NUMEROS",
    "[[ 8      entregas\n14     cosas nuevas\n16     fallos arreglados\n755    pruebas\n$0.00  descuadre ]]",
    "## LOS DOS FALLOS GRAVES DE DINERO",
    "!!1) El sobrante se iba a facturas ya pagadas",
    "Llevaba MESES escondido y ninguna de las 755 pruebas lo habia visto.",
    "Cuando un cliente te pagaba mas de lo que debia una factura, el sobrante se repartia a las demas. Pero la app no miraba si esas otras eran de CONTADO.",
    "Una venta al contado ya esta pagada, pero como no lleva pagos apuntados, la app creia que debia todo. El sobrante se iba a facturas ya saldadas y la deuda del cliente no bajaba lo que habia pagado.",
    "EL CASO QUE LO DESTAPO: el cliente debia $525.19 y pago $289.63.",
    "[[ $193.04  a una de credito  correcto\n$96.59   a una de CONTADO  ya estaba pagada ]]",
    "Su deuda solo bajo $193.04 en vez de $289.63.",
    "Estaba en dos funciones. Las dos arregladas.",
    "!!2) Diez parentesis mal puestos",
    "Con franqueza: ese lo meti yo. El 15 de agosto por la tarde, arreglando otra cosa, mi patron de busqueda dejo un parentesis fuera de sitio en 10 lugares.",
    "Los dos peores: el reparto de pagos, y el que DESCUENTA DEL INVENTARIO.",
    "Se verifico version por version: vivio menos de 48 horas y tus datos NO se afectaron, porque todos tus repartos de pago son anteriores.",
    "## LO QUE SE CONSTRUYO EL DOMINGO 16",
    "Cobrar desde Pedidos Rapidos. Le cobras al barbero sin salir de la pantalla. Te ensena el reparto ANTES de tocar nada.",
    "El VIP por tipo de producto. Todas las colonias cuentan juntas aunque sean de marcas distintas. Igual los wax y el cuidado de cuchilla. Las navajas siguen por marca. De 107 grupos a 24.",
    "Los puntos por WhatsApp. Le mandas a cada cliente sus puntos con su primer nombre y un empujon para llegar a los 10.",
    "El codigo de registro. Del 001 al 147, en el orden en que los registraste. Se asigna una vez y no cambia nunca.",
    "El listado completo. Ordenas por codigo, nombre, deuda, lo que compran o lo que dejan. Y filtras. Y lo imprimes.",
    "Las visitas conectadas. Marcas la barberia en la ruta y a todos sus barberos les queda la visita apuntada.",
    "No quiso nada vs No estaba. Dos motivos distintos. Las dos cuentan como visita, pero el no estaba NO le baja su porcentaje de compra.",
    "## LO QUE SE CONSTRUYO EL LUNES 17",
    "Las leyes del dinero. La prueba mas fuerte que existe. En vez de probar casos que se me ocurren a mi, se le ponen 8 reglas que nunca se pueden romper y la maquina inventa cientos de negocios buscando donde fallan. Fue la que encontro el fallo grande.",
    "Cobertura del dinero al 100%. De 35 funciones que tocan plata, 14 no tenian ninguna prueba. Ahora todas la tienen.",
    "## COMO CRECIO LA VIGILANCIA",
    "[[ 15 ago  693 pruebas\n16 ago  727 pruebas\n17 ago  755 pruebas ]]",
    "COBERTURA DE LAS FUNCIONES DE DINERO:",
    "[[ Antes  21 de 35  60%\nAhora  35 de 35  100% ]]",
    "> Los dos fallos de dinero vivian justo en ese 40% sin vigilancia.",
    "## LAS 8 LEYES DEL DINERO",
    "Reglas que nunca se pueden romper. Todas se cumplen.",
    "1. Vendido = cobrado + por cobrar. Siempre.",
    "2. Ninguna factura queda pagada de mas.",
    "3. Ni un centavo se pierde ni se inventa.",
    "4. El reparto empieza siempre por la mas vieja.",
    "5. La deuda de un cliente nunca es negativa.",
    "6. Borrar un pago sube la deuda ese mismo monto.",
    "7. El inventario baja al vender lo justo.",
    "8. La ganancia nunca pasa de lo vendido.",
    "## LAS 8 ENTREGAS",
    "[[ 20260816a  Cobrar desde Pedidos Rapidos\n20260816b  Los avisos vuelven a ensenar su detalle\n20260816c  VIP por tipo + puntos por WhatsApp\n20260816d  El codigo de registro 001-147\n20260816e  Visitas conectadas + listado con filtros\n20260816f  No quiso nada vs No estaba\n20260817a  Las 8 leyes + los 2 fallos arreglados ]]",
    "## LO QUE QUEDA PENDIENTE",
    "1. Verificar el candado de dominio de Firebase y las reglas de la base de datos.",
    "2. Tus gastos reales para el plan de duplicar ventas -de julio solo hay $926.55 apuntados contra $10,130.60 vendidos, y eso no puede ser todo.",
    "3. Actualizar el Registro de Cambios en PDF con todo lo de estos dos dias.",
    "## Y UNA RECOMENDACION",
    "> La app crecio mucho en pocos dias, y los dos fallos de hoy aparecieron justo por eso. Si paramos de agregar cosas nuevas por dos semanas y solo probamos y arreglamos, vas a tener una app mucho mas tranquila."
  ]},
  { g:"VENDER", t:"💵 Vender — hacer una venta", c:[
    "## ¿PARA QUÉ SIRVE?",
    "Para registrar una venta a un cliente: al contado o a crédito.",
    "> Menú ☰ → 🛒 VENDER → 💵 Vender",
    "## PASO A PASO",
    "1. Escoge el cliente. Si no aparece, escribe su nombre en el buscador.",
    "2. Busca cada producto y toca el + para agregarlo. Puedes cambiar la cantidad y el precio.",
    "3. Escoge CONTADO (te paga ahora) o CRÉDITO (te queda debiendo).",
    "4. Toca ✓ Registrar venta.",
    "## LO QUE PASA SOLO",
    "[[ Al guardar la venta:\n\n  · el stock baja                \n  · la ganancia queda apuntada   \n  · si es a crédito, entra en\n    Cuentas por Cobrar           \n  · si es de contado, cuenta como\n    cobrado el mismo día         ]]",
    "## ATAJOS QUE TE AHORRAN TIEMPO",
    "↻ Repetir su última compra — le vuelve a cargar lo mismo del último pedido.",
    "⚡ Cobro rápido — contado en efectivo de un toque.",
    "💲 Precios especiales — si un cliente tiene su propio precio, la app lo usa sola.",
    "!! Si el cliente tiene CRÉDITO A FAVOR, la app te pregunta si quieres usarlo. Nunca lo aplica sola — tú decides."
  ]},
  { g:"VENDER", t:"⚡ Pedidos Rápidos", c:[
    "## \u00bfPARA QU\u00c9 SIRVE?",
    "Para tomarle el pedido a TODOS los barberos de una barber\u00eda de una sola pasada, y de paso llevar el r\u00e9cord de qui\u00e9n te compr\u00f3 y qui\u00e9n no.",
    "> Men\u00fa \u2630 \u2192 \ud83d\uded2 VENDER \u2192 \u26a1 Pedidos R\u00e1pidos",
    "## PASO A PASO",
    "1. Escoge la barber\u00eda. Se te seleccionan TODOS sus barberos de una vez.",
    "2. A cada barbero le salen dos filas de botones de un toque:",
    "3. \u26a1 LO QUE M\u00c1S VENDES \u2014 tus productos m\u00e1s vendidos de los \u00faltimos 60 d\u00edas",
    "4. \ud83d\udc64 LO QUE M\u00c1S COMPRA \u2014 lo que ESE barbero suele llevar",
    "5. Un toque agrega el producto. Otro toque sube la cantidad.",
    "6. Si no est\u00e1 en los botones, b\u00fascalo o d\u00edctalo con el \ud83c\udfa4",
    "7. Al terminar con ese barbero, dale a \ud83d\udcbe Guardar este pedido.",
    "8. Cuando acabes con todos, dale a \u2713 Terminar con esta barber\u00eda.",
    "[[ \u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510\n\u2502 \u25b2\u25bc Yordys Santiago     $20.00 \u2502\n\u2502                               \u2502\n\u2502 \u26a1 LO QUE M\u00c1S VENDES          \u2502\n\u2502 [Cool Care][Gummy gel][Dorco] \u2502\n\u2502 [Guante   ][Chaos wax][Navaja]\u2502\n\u2502                               \u2502\n\u2502 \ud83d\udc64 LO QUE M\u00c1S COMPRA          \u2502\n\u2502 [Persona blade][Nishman]      \u2502\n\u2502                               \u2502\n\u2502 [ \ud83d\udcbe Guardar este pedido ]    \u2502\n\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518 ]]",
    "## \ud83d\udcbe GUARDAR UNO POR UNO",
    "Cada barbero tiene su propio bot\u00f3n. Al tocarlo, ESE pedido queda guardado y el barbero se cierra solo para pasar al siguiente.",
    "Su pedido pasa a la lista de pendientes, donde despu\u00e9s lo conviertes en venta \u2014 y ah\u00ed todav\u00eda le puedes agregar algo si hace falta.",
    "!! ESTO ES IMPORTANTE: antes se guardaban TODOS al final. Si algo pasaba en medio se perd\u00eda la barber\u00eda entera. Ahora, lo que guardas ya no se puede perder.",
    "## \u25b2\u25bc EL ORDEN DE LOS BARBEROS",
    "Con las flechitas subes o bajas cada barbero. El orden queda guardado por barber\u00eda: la pr\u00f3xima vez que entres, est\u00e1n como los dejaste.",
    "## \u2713 TERMINAR CON ESTA BARBER\u00cdA",
    "El bot\u00f3n de abajo hace dos cosas: guarda los pedidos que te queden sin guardar, y apunta como NO COMPR\u00d3 a los barberos que no llevaron nada.",
    "As\u00ed tu r\u00e9cord de compra y no compra queda completo. Lo ves en la ficha de cada cliente, en \ud83d\udcc7 Sus datos.",
    "## \ud83d\uddd1\ufe0f ELIMINAR UN PEDIDO",
    "Si abres un pedido guardado y quieres botarlo, el bot\u00f3n dice \ud83d\uddd1\ufe0f Eliminar este pedido. Te pregunta con el nombre y el monto, y lo borra del carrito.",
    "Si est\u00e1s haciendo uno nuevo, el bot\u00f3n dice \u2190 Volver sin guardar y no borra nada de nadie.",
    "!! Un pedido NO es una venta. El inventario no baja y el dinero no se mueve hasta que lo conviertas en venta."
  ]},
  { g:"VENDER", t:"🗺️ Ruta de Visitas", c:[
    "## ¿PARA QUÉ SIRVE?",
    "Para saber a quién visitar hoy, en qué orden, y llevar el rastro de a quién ya viste.",
    "> Menú ☰ → 🛒 VENDER → 🗺️ Ruta de Visitas",
    "## CÓMO SE VE",
    "[[ MIÉRCOLES · 11 paradas      \n                               \n 1. MODERN CUTS        ✓ 1:18pm\n 2. ELITE CUTS         🗺️      \n 3. RD BARBER SHOP     🗺️      ]]",
    "## LO QUE PUEDES HACER",
    "✓ Marcar la visita cuando llegues — queda con su hora.",
    "🗺️ Abrir esa barbería sola en Google Maps o en Waze.",
    "🗺️ Navegar toda la ruta de una vez — te arma el viaje con todas las paradas.",
    "## SI SON MÁS DE 10 PARADAS",
    "Google Maps solo acepta 10 por viaje, así que la app parte la ruta en tramos y cada uno arranca donde terminó el anterior.",
    "!! Waze no acepta varias paradas de una vez. Para Waze, la app te abre una por una."
  ]},
  { g:"VENDER", t:"👥 Clientes", c:[
    "## \u00bfPARA QU\u00c9 SIRVE?",
    "Para ver y manejar TODO lo de un cliente desde un solo sitio: sus datos, lo que compra, lo que debe, sus facturas y sus programas.",
    "> Men\u00fa \u2630 \u2192 \ud83d\uded2 VENDER \u2192 \ud83d\udc65 Clientes",
    "## LA FICHA, DE UN VISTAZO",
    "Arriba salen sus cuatro n\u00fameros y los tres botones que m\u00e1s usas.",
    "[[ \u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510\n\u2502 JD  Jorge Duarte              \u2502\n\u2502     \ud83c\udfea ELITE CUTS BARBERSHOP  \u2502\n\u2502     \ud83d\udcde +1 (401) 570-9745      \u2502\n\u2502                               \u2502\n\u2502 COMPR\u00d3  DEBE  TE DEJA  \u00daLTIMA\u2502\n\u2502 $201.99 $60.00 $92.89   13 d  \u2502\n\u2502                               \u2502\n\u2502 [\u26a1Pedido][\ud83d\udcb5Cobrar][\ud83e\uddfeVender] \u2502\n\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518 ]]",
    "## LOS RENGLONES",
    "Debajo va una lista. Cada renglón ya te ense\u00f1a su n\u00famero, as\u00ed que muchas veces ni tienes que abrirlo. Se abre UNO A LA VEZ, y el que est\u00e1 abierto se pinta de azul.",
    "1. \ud83d\udcc7 Sus datos \u2014 tel\u00e9fono, correo, direcci\u00f3n, negocio, apodo, persona de contacto, y su R\u00c9CORD DE VISITAS (cu\u00e1ntas veces te compr\u00f3 y cu\u00e1ntas no)",
    "2. \u2b50 Programa VIP \u2014 sus grupos y el bot\u00f3n de darle el premio",
    "3. \ud83c\udf81 Premios que le di",
    "4. \u21a9\ufe0f Devoluciones \u2014 con el bot\u00f3n de deshacerla",
    "5. \ud83d\uded2 Lo que m\u00e1s compra",
    "6. \ud83d\udcc5 Cada cu\u00e1nto compra",
    "7. \ud83d\udcb0 Cr\u00e9dito a favor",
    "8. \ud83d\udcc4 Sus facturas \u2014 t\u00f3calas para verlas",
    "9. \ud83d\udccd Visitas",
    "10. \ud83c\udf81 Programa de Fidelidad (el de los $400)",
    "11. \u2699\ufe0f Ajustes \u2014 VIP, consignaci\u00f3n, sin servicio, editar, precios especiales, balance inicial y eliminar",
    "12. \ud83d\udcb5 Lo que te deja \u2014 tu ganancia con \u00e9l y su margen",
    "## \ud83d\udcde LLAMAR Y WHATSAPP DE UN TOQUE",
    "En \ud83d\udcc7 Sus datos tienes botones para llamarlo, mandarle WhatsApp o abrir el mapa a su direcci\u00f3n. Ya no tienes que copiar el n\u00famero.",
    "!! El WhatsApp abre el de NEGOCIO. Si quieres cambiarlo al normal: Men\u00fa \u2630 \u2192 \u2699\ufe0f HERRAMIENTAS \u2192 \ud83d\udcac Cu\u00e1l WhatsApp usar",
    "!! Lo que est\u00e1 vac\u00edo no se ve. Un cliente sin correo no ve ese rengl\u00f3n."
  ]},
  { g:"VENDER", t:"⭐ Programa VIP", c:[
    "## ¿PARA QUÉ SIRVE?",
    "Para premiar al cliente que te compra seguido. Suma sus compras chicas y cuando llega a la meta le das un regalo.",
    "> Menú ☰ → 🛒 VENDER → ⭐ Programa VIP",
    "## CÓMO FUNCIONA",
    "[[ PROGRAMA DE FIDELIDAD      \n   $140.00 / $400.00          \n                              \n Suma las compras menores a   \n $30. Al llegar a $400, dale  \n un regalo de $10 a $20.      ]]",
    "## PASO A PASO",
    "1. En la ficha del cliente, toca ☆ Inscribir en programa VIP.",
    "2. La app va sumando sola sus compras chicas.",
    "3. Cuando llega a la meta, te avisa.",
    "4. Le das el regalo y tocas 🎁 Ya le di el regalo."
  ]},
  { g:"DINERO", t:"💰 Cobrado y Vendido", c:[
    "## ¿PARA QUÉ SIRVE?",
    "Para ver, en el rango de fechas que tú escojas, cuánto dinero ENTRÓ y cuánto VENDISTE. No es lo mismo.",
    "> Menú ☰ → 💰 DINERO → 💰 Cobrado y Vendido",
    "## LA DIFERENCIA, QUE ES IMPORTANTE",
    "[[ VENDIDO = lo que facturaste \n            (aunque no te      \n             hayan pagado)     \n                               \n COBRADO = el dinero que de    \n           verdad entró        ]]",
    "## Y LO MÁS ÚTIL: TU GANANCIA REAL",
    "[[ 💵 GANANCIA YA COBRADA      \n    $1,562.88                  \n    de lo que de verdad entró  \n  ───────────────────────────  \n  🧾 Gastos          −$655.83  \n  ✅ TE QUEDÓ         $907.05  \n                               \n ⏳ EN LA CALLE      $1,574.03 \n    te la ganaste, pero        \n    todavía no te la han pagado]]",
    "## CÓMO SE CUENTA LA GANANCIA",
    "Al CONTADO: la ganancia cuenta el mismo día.",
    "A CRÉDITO: cada abono trae su parte. Si una factura de $500 te deja $150 y te pagan $250 (la mitad), cuentas $75.",
    "!! Si gastaste más de lo que cobraste, la app te lo dice en rojo: \"QUEDASTE EN ROJO\"."
  ]},
  { g:"DINERO", t:"💳 Cuentas por Cobrar — lo que TE DEBEN", c:[
    "## ¿PARA QUÉ SIRVE?",
    "Para ver quién te debe, cuánto, y cobrarle.",
    "> Menú ☰ → 💰 DINERO → 💳 Cuentas por Cobrar",
    "## CÓMO SE VE",
    "[[ TOTAL POR COBRAR           \n     $7,778.00                \n     23 clientes              \n                              \n JUAN PEREZ                   \n MODERN CUTS                  \n $30.00 pendiente             \n [ 💰 Registrar pago ]        ]]",
    "## PARA COBRARLE A ALGUIEN",
    "1. Búscalo o tócalo en la lista.",
    "2. Toca 💰 Registrar pago.",
    "3. Escoge la factura y pon cuánto te dio.",
    "4. Puedes dividir el pago: parte en efectivo, parte en tarjeta.",
    "## LAS DOS PESTAÑAS",
    "📋 Pendientes — los que te deben. ✅ Facturas Saldadas — las ya pagadas, para consultarlas.",
    "!! Si un pago te queda con la fecha de hoy pero el cliente te pagó otro día, corrígela con el ✏️ del pago. Si no, tu \"Cobrado\" del día sale mal."
  ]},
  { g:"DINERO", t:"📤 Cuentas por Pagar — lo que TÚ DEBES", c:[
    "## ¿PARA QUÉ SIRVE?",
    "Para llevar lo que le debes a tus suplidores, a las tarjetas de crédito y otras deudas.",
    "> Menú ☰ → 💰 DINERO → 📤 Cuentas por Pagar",
    "## LAS TRES COSAS QUE LLEVA",
    "[[ 🏭 SUPLIDORES               \n    lo que debes de compras    \n    a crédito                  \n                               \n 💳 TARJETAS DE CRÉDITO        \n    el balance de cada una     \n                               \n 📋 OTRAS DEUDAS               \n    préstamos, la camioneta... ]]",
    "## PARA PAGAR",
    "1. Escoge al suplidor o la tarjeta.",
    "2. Toca ✓ Pagar y pon el monto.",
    "3. Escoge si fue en EFECTIVO o con TARJETA."
  ]},
  { g:"DINERO", t:"💸 Gastos", c:[
    "## ¿PARA QUÉ SIRVE?",
    "Para anotar todo lo que sale: gasolina, comida, papelería, lo que sea. Sin esto no sabes tu ganancia real.",
    "> Menú ☰ → 💰 DINERO → 💸 Gastos",
    "## PASO A PASO",
    "1. Toca + Nuevo gasto.",
    "2. Escoge la categoría con un toque: ⛽ Gasolina · 🍽️ Comida · 📎 Oficina · 📦 Misceláneos.",
    "3. Pon el monto y la fecha.",
    "4. ✓ Registrar gasto.",
    "## PARA QUÉ SIRVEN DESPUÉS",
    "Tus gastos se restan solos en \"Cobrado y Vendido\" y en el Resumen Financiero, para que veas lo que de verdad te queda."
  ]},
  { g:"DINERO", t:"🧾 Facturas", c:[
    "## ¿PARA QUÉ SIRVE?",
    "Para ver, imprimir, compartir o corregir cualquier factura que hayas hecho.",
    "> Menú ☰ → 💰 DINERO → 💳 Cuentas por Cobrar → toca una factura",
    "## LO QUE PUEDES HACER CON UNA FACTURA",
    "👁️ Verla completa · 🖨️ Imprimirla o compartirla · ✏️ Modificar los productos · 🚫 Cancelarla.",
    "## MODIFICAR UNA FACTURA YA HECHA",
    "1. Toca ✏️ Modificar.",
    "2. Puedes cambiar cantidades, precios, quitar o agregar productos.",
    "3. Al guardar, el stock y la ganancia se recalculan solos.",
    "!! Cancelar una factura pide huella o PIN, y te pregunta dos veces. No se puede cancelar por accidente."
  ]},
  { g:"DINERO", t:"↩️ Devoluciones y crédito a favor", c:[
    "## ¿PARA QUÉ SIRVE?",
    "Cuando un cliente te devuelve mercancía, o te paga más de lo que debía.",
    "## SI TE DEVUELVE UN PRODUCTO",
    "1. Abre la factura → ✏️ Modificar.",
    "2. Quita o cambia el producto devuelto.",
    "3. El stock vuelve a subir y la ganancia se ajusta.",
    "## SI TE PAGA DE MÁS",
    "Ese sobrante queda como CRÉDITO A FAVOR del cliente.",
    "[[ JUAN PEREZ                 \n $60.00 pendiente             \n 💰 ($30.00) a favor          \n                              \n El crédito se aplica SOLO    \n cuando tú lo escojas al      \n venderle. Nunca solo.        ]]",
    "!! La app NUNCA resta el crédito de la deuda por su cuenta. Tú decides cuándo usarlo."
  ]},
  { g:"REPORTES", t:"\ud83d\udccb Bit\u00e1cora de visitas", c:[
    "## \u00bfPARA QU\u00c9 SIRVE?",
    "Para ver TODO lo que pas\u00f3 con cada cliente: qu\u00e9 d\u00eda lo visitaste, a qu\u00e9 hora, si te compr\u00f3 y qu\u00e9 se llev\u00f3.",
    "Se llena SOLA. T\u00fa no tienes que apuntar nada.",
    "> Men\u00fa \u2630 \u2192 \ud83d\udcca REPORTES \u2192 \ud83d\udccb Bit\u00e1cora de visitas",
    "[[ \u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510\n\u2502 VISITAS  COMPRARON  NO       \u2502\n\u2502   47        31       16      \u2502\n\u2502 VENDISTE  GANANCIA  TE COMPRAN\u2502\n\u2502 $2,840     $1,190     66%    \u2502\n\u251c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524\n\u2502 JUEVES 14 DE AGOSTO   $340  \u2502\n\u251c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524\n\u2502 \ud83c\udfea TROPICAL     8:15 a.m.  \u2502\n\u2502  \u2713 Luis Santiago      $30.00 \u2502\n\u2502     \u00b7 3 \u00d7 Andis Cool Care    \u2502\n\u2502  \u2717 Rainy Santiago  no compr\u00f3 \u2502\n\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518 ]]",
    "## POR FECHAS, COMO T\u00da QUIERAS",
    "1. Botones r\u00e1pidos: Hoy \u00b7 7 d\u00edas \u00b7 30 d\u00edas \u00b7 Todo",
    "2. O escoge las fechas que quieras en Desde y Hasta",
    "3. Y busca por cliente, barber\u00eda o producto",
    "4. Con \ud83d\udda8\ufe0f Imprimir y \ud83d\udce4 Compartir por WhatsApp",
    "## LO QUE GUARDA DE CADA VISITA",
    "La fecha y la hora exacta \u00b7 la barber\u00eda y el barbero \u00b7 si compr\u00f3 o no \u00b7 qu\u00e9 se llev\u00f3, producto por producto \u00b7 cu\u00e1nto y si fue a cr\u00e9dito o contado \u00b7 tu ganancia \u00b7 si dej\u00f3 pedido \u00b7 y si se marc\u00f3 sola o la marcaste t\u00fa.",
    "!! SI LE VENDES DOS VECES AL MISMO CLIENTE EL MISMO D\u00cdA, es UN solo rengl\u00f3n con todo sumado \u2014 no dos.",
    "!! LA BIT\u00c1CORA EMPIEZA DESDE QUE SUBISTE ESTA VERSI\u00d3N. Lo de antes no tiene la hora ni los productos, porque no se guardaba."
  ]},
  { g:"REPORTES", t:"📈 Resumen Financiero", c:[
    "## ¿PARA QUÉ SIRVE?",
    "Para ver de un vistazo cómo va el negocio: hoy, este mes, y comparado con el mes pasado.",
    "> Menú ☰ → 📊 REPORTES → 📈 Resumen Financiero",
    "## LO QUE TE MUESTRA",
    "[[ HOY                        \n  Ventas   ·  Facturas         \n                              \n ESTE MES                     \n  Ventas   ·  Gastos          \n  ↑ +12% vs el mes pasado     \n                              \n 💵 LO QUE TE QUEDA ESTE MES  \n 💳 Lo que te deben           \n 📤 Lo que tú debes           \n ⚖️ La diferencia             \n 🎯 Meta semanal              ]]",
    "## LO QUE MÁS SIRVE MIRAR",
    "Los clientes atrasados más de 30 días — la app te los lista aparte para que los llames."
  ]},
  { g:"REPORTES", t:"📊 Panorama Completo", c:[
    "## ¿PARA QUÉ SIRVE?",
    "Todo el negocio en una sola pantalla, con gráficos, para el período que escojas: hoy, semana, mes o año.",
    "> Menú ☰ → 📊 REPORTES → 📊 Panorama Completo",
    "## LO QUE TRAE",
    "Ganancia real · Ventas · Te deben · Tú debes · Gráfico de barras por día · Los productos que más se mueven.",
    "## PARA GUARDARLO O MANDARLO",
    "Toca 📤 y la app te lo arma en PDF, o te lo manda por WhatsApp con el resumen en texto."
  ]},
  { g:"REPORTES", t:"📊 Reporte por Cliente", c:[
    "## ¿PARA QUÉ SIRVE?",
    "Para saber quién te compra más y quién te deja más ganancia. No siempre es el mismo.",
    "> Menú ☰ → 📊 REPORTES → 📊 Reporte por Cliente",
    "## CÓMO SE VE",
    "[[ CLIENTE      COMPRÓ  PAGÓ  GANANCIA\n JUAN PEREZ     $840   $810     $210 \n LUIS GOMEZ     $600   $600     $95  \n ANA RAMIREZ    $420   $300     $180 ]]",
    "## LOS DOS ÓRDENES",
    "💰 Por Ganancia — quién te deja más dinero.",
    "📦 Por Cantidad — quién te compra más volumen.",
    "## CON FECHAS O DE SIEMPRE",
    "Puedes ponerle un rango de fechas, o dejarlo en \"de siempre\" para ver el total de toda la vida del cliente."
  ]},
  { g:"REPORTES", t:"📊 Reportes por fecha", c:[
    "## ¿PARA QUÉ SIRVE?",
    "Reportes de ventas, inventario o gastos entre dos fechas.",
    "> Menú ☰ → 📊 REPORTES → 📊 Reportes",
    "## PASO A PASO",
    "1. Escoge el tipo de reporte en la lista.",
    "2. Pon las fechas.",
    "3. 🔍 Generar reporte.",
    "4. 🖨️ Imprimir o compartir."
  ]},
  { g:"MERCANCÍA", t:"📦 Catálogo de productos", c:[
    "## ¿PARA QUÉ SIRVE?",
    "Es la lista de todo lo que vendes, con su costo, su precio y su foto.",
    "> Menú ☰ → 📦 MERCANCÍA → 📦 Catálogo",
    "## EL BUSCADOR ES LISTO",
    "Puedes escribir las palabras en cualquier orden y hasta con faltas: \"olive 5\", \"5 olive\" y \"oliv\" encuentran lo mismo.",
    "## PARA EDITAR UN PRODUCTO",
    "1. Tócalo en la lista.",
    "2. Cambia lo que necesites.",
    "3. La barra de abajo tiene ✓ Guardar cambios, siempre a la vista.",
    "## PARA CAMBIAR TODA UNA MARCA DE UNA VEZ",
    "✏️ Editar toda una marca — escoges la marca (con buscador, son 90) y editas todos sus productos juntos, con buscador adentro también.",
    "## OTRAS HERRAMIENTAS",
    "⬆️ Redondear precios al entero · 🔍 Detectar duplicados · 📊 Historial de costo por suplidor.",
    "!! Cada vez que cambias un precio queda apuntado en el historial de precios, con el antes y el después."
  ]},
  { g:"MERCANCÍA", t:"💰 Inventario", c:[
    "## \u00bfPARA QU\u00c9 SIRVE?",
    "Para ver cu\u00e1nto vale lo que tienes: al costo, a precio de venta, y cu\u00e1nta ganancia hay guardada ah\u00ed.",
    "> Men\u00fa \u2630 \u2192 \ud83d\udce6 MERCANC\u00cdA \u2192 \ud83d\udcb0 Inventario",
    "## HACER EL INVENTARIO POR MARCA",
    "Esta es la forma r\u00e1pida: cuentas una marca completa en el estante y la corriges toda de una vez.",
    "> Men\u00fa \u2630 \u2192 \ud83d\udce6 MERCANC\u00cdA \u2192 \ud83d\udcda Cat\u00e1logo \u2192 Editar por marca",
    "1. Escoge la marca.",
    "2. Arriba te salen sus n\u00fameros: cu\u00e1ntos productos, cu\u00e1ntos con existencia, cu\u00e1ntas unidades, cu\u00e1nto tienes INVERTIDO, a cu\u00e1nto lo vender\u00edas y cu\u00e1nta ganancia hay.",
    "3. Cada producto tiene su EXISTENCIA y su VALE (cantidad \u00d7 costo).",
    "4. Escribes la cantidad real y el VALE se recalcula al momento.",
    "5. Y el INVERTIDO de arriba BAJA EN VIVO mientras cuentas.",
    "6. Al final, un solo bot\u00f3n para guardar toda la marca.",
    "[[ \u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510\n\u2502 PRODUCTOS  CON EXIST.  UNIDADES\u2502\n\u2502    30          24        1,247 \u2502\n\u2502                                \u2502\n\u2502 INVERTIDO  A VENTA   GANANCIA  \u2502\n\u2502 $5,899.25 $11,240.00 $5,340.75 \u2502\n\u251c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524\n\u2502 Immortal Colonia negra         \u2502\n\u2502 EXISTENCIA    VALE             \u2502\n\u2502 [   25   ]   $150.00           \u2502\n\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518 ]]",
    "!! SI DEJAS UN CAMPO VAC\u00cdO O ESCRIBES LETRAS, se queda la cantidad de antes. NUNCA se pone en cero por error.",
    "## \ud83e\udd16 Y EL ASISTENTE TE AVISA",
    "El bot\u00f3n \ud83e\udd16 de abajo a la derecha te dice qu\u00e9 se te acab\u00f3 y qu\u00e9 se te acaba pronto, mirando lo que vendes al mes. Y te lo mete a la Lista de Relleno de un toque.",
    "!! Si tu inventario no est\u00e1 al d\u00eda, los n\u00fameros de esta pantalla tampoco lo van a estar. Cuenta marca por marca cuando tengas un rato."
  ]},
  { g:"MERCANCÍA", t:"🚐 LA VAN — inventario inicial y cargar", c:[
    "## ¿PARA QUÉ SIRVE?",
    "Para saber, en medio de la ruta, qué te queda en la camioneta.",
    "> Menú ☰ → 📦 MERCANCÍA → 🚐 VAN",
    "## CÓMO SE VE",
    "[[ EN LA VAN AHORA   HAY QUE  \n       47            RECARGAR \n    unidades            3     \n                              \n ECO OLIVE OIL 5 LBS      ✕   \n  Inicial  Vendí  Me quedan   \n  [ 25 ]     3        22      ]]",
    "## LOS DOS BOTONES, Y CUÁNDO USAR CADA UNO",
    "[[ 📥 INVENTARIO INICIAL       \n    UNA VEZ. Cuentas todo y    \n    dejas dicho: \"la van llena\n    es ESTO\".                  \n                               \n 🔄 CARGAR LA VAN              \n    CADA VEZ. Miras lo que    \n    vendiste, lo pones, y la  \n    van vuelve a su inventario\n    inicial.                   ]]",
    "## PARA HACER EL INVENTARIO INICIAL",
    "1. Toca 📥 Inventario inicial.",
    "2. Busca cada producto (o dilo con el 🎤).",
    "3. Pon cuántos tienes con los botones − y +.",
    "4. ✓ Agregar a la van. Repite con cada uno.",
    "5. Al final: 🔄 Empezar de cero (reemplazar todo).",
    "## PARA CARGAR LA VAN CADA SEMANA",
    "1. Toca 🔄 Cargar la van.",
    "2. Escoge las fechas de lo vendido.",
    "3. La app te dice exactamente qué poner y cuántos.",
    "4. Lo pones en la camioneta.",
    "5. Toca \"Ya lo puse — cargar la van\".",
    "## SI CONTASTE MAL",
    "El número de \"Inicial\" se puede escribir directo en la lista. Y el ✕ quita un producto de la van, si ya no lo cargas.",
    "!! La VAN no toca tu inventario del almacén, ni tus ventas, ni tu dinero. Es solo el conteo de lo que llevas encima."
  ]},
  { g:"MERCANCÍA", t:"📋 Lista de Relleno", c:[
    "## ¿PARA QUÉ SIRVE?",
    "Para saber qué COMPRARLE AL SUPLIDOR. Es distinto de cargar la van.",
    "> Menú ☰ → 📦 MERCANCÍA → 🚐 Lista de Relleno",
    "## LA DIFERENCIA CON LA VAN",
    "[[ 🔄 CARGAR LA VAN            \n    del ALMACÉN → a la        \n    camioneta                  \n                               \n 📋 LISTA DE RELLENO           \n    del SUPLIDOR → al almacén ]]",
    "## PASO A PASO",
    "1. Escoge las fechas (7, 15, 30 días o todo).",
    "2. Toca 🔄 Llenar la lista con lo vendido en estas fechas.",
    "3. La lista se arma sola con lo que vendiste.",
    "4. Ajusta las cantidades si hace falta.",
    "5. 📤 Compartir la lista — se la mandas al suplidor por WhatsApp."
  ]},
  { g:"MERCANCÍA", t:"🚚 Compras", c:[
    "## ¿PARA QUÉ SIRVE?",
    "Para registrar lo que le compras a tus suplidores, con su envío y su cargo de tarjeta.",
    "> Menú ☰ → 📦 MERCANCÍA → 🚚 Compras",
    "## PASO A PASO",
    "1. Escoge el suplidor.",
    "2. Agrega cada producto con su cantidad y su costo.",
    "3. Pon el ENVÍO y el CARGO POR TARJETA si los hubo.",
    "4. Escoge CONTADO o CRÉDITO.",
    "5. ✓ Registrar compra.",
    "## LO QUE PASA SOLO",
    "El stock sube, el costo del producto se actualiza, y si fue a crédito entra en Cuentas por Pagar.",
    "!! Si un producto no está en tu catálogo, usa \"+ Producto nuevo\". La app te pide su marca, categoría y precio de venta para que nazca completo."
  ]},
  { g:"MERCANCÍA", t:"📄 El lector de facturas PDF", c:[
    "## ¿PARA QUÉ SIRVE?",
    "Para no teclear una factura de suplidor renglón por renglón. La app lee el PDF y arma la compra sola.",
    "> Menú ☰ → 📦 MERCANCÍA → 🚚 Compras → 📄 Leer factura del suplidor (PDF)",
    "## PASO A PASO",
    "1. Toca el botón y escoge el PDF de la factura.",
    "2. La app reconoce el suplidor y lee los renglones.",
    "3. Revisa la pantalla que sale.",
    "4. Toca \"Agregar las marcadas\".",
    "## CÓMO SE VE",
    "[[ 📄 Kanar · 6 renglones      \n ✓ Las cuentas cuadran con el \n   Subtotal ($998.42)         \n                              \n ☑ NISHMAN HAIR CREAM NO 6    \n   TU PRODUCTO · ya lo sabía  \n   Nishman Hair Cream No 6    \n   Cant 24 · Costo 3.12 · $74.88 ]]",
    "## LO QUE HACE BIEN",
    "Comprueba dos veces: que cada renglón cuadre (cantidad × precio = total) y que la suma dé el Subtotal impreso.",
    "Aprende: cada vez que le dices qué producto tuyo es cada línea, se lo guarda para la próxima.",
    "Detecta el ENVÍO y el CARGO POR TARJETA y los pone en su campo.",
    "!! Nunca adivina. Si no está seguro de qué producto es, te pide que lo escojas con el 🔍. Mejor eso que meterte mal el inventario."
  ]},
  { g:"MERCANCÍA", t:"🏭 Suplidores", c:[
    "## ¿PARA QUÉ SIRVE?",
    "La ficha de cada suplidor: su contacto, lo que le debes y su historial de compras.",
    "> Menú ☰ → 📦 MERCANCÍA → 🏭 Suplidores",
    "## LOS ATAJOS DE ADENTRO",
    "🛒 Nueva compra · 📄 Leer factura PDF · 📂 Compras abiertas · 📋 Historial completo · ✓ Pagar."
  ]},
  { g:"SEGURIDAD", t:"🛡️ Tus tres respaldos", c:[
    "## ¿PARA QUÉ SIRVE?",
    "Para que nunca pierdas tus datos. La app te respalda en TRES sitios distintos.",
    "> Menú ☰ → 🛡️ SEGURIDAD → 🛡️ Copias de Seguridad",
    "## LOS TRES",
    "[[ 📱 EN EL TELÉFONO           \n    cada 15 minutos, guarda   \n    las últimas 10 copias      \n                               \n ☁️ EN LA NUBE                 \n    cada 15 minutos, cuando   \n    hay cambios                \n                               \n 💾 EL BACKUP QUE TÚ BAJAS     \n    un archivo cifrado, en tu  \n    teléfono o tu correo       ]]",
    "## PARA BAJAR UN BACKUP",
    "1. Menú ☰ → 🛡️ SEGURIDAD → 💾 Exportar backup.",
    "2. Se descarga NBS2_backup_MM-DD-AAAA.json.",
    "3. Mándalo a tu correo, así tienes dos copias.",
    "## QUÉ LLEVA ESE BACKUP",
    "Todo: productos con sus fotos, ventas con la firma del cliente, compras, clientes, gastos, tarjetas, deudas, pedidos, devoluciones, rutas, visitas con su hora, historial de precios, la van y lo que aprendió el lector de facturas.",
    "!! MUY IMPORTANTE: el backup va cifrado con tu PIN, y el PIN NO viaja dentro del archivo. Si cambias tu PIN, los backups VIEJOS solo se abren con el PIN viejo. Baja uno nuevo el mismo día que lo cambies."
  ]},
  { g:"SEGURIDAD", t:"🔀 Trabajar en la PC y en el teléfono", c:[
    "## ¿PARA QUÉ SIRVE?",
    "Puedes trabajar en la computadora en la casa y en el teléfono en la calle, el mismo día, sin perder nada.",
    "## CÓMO FUNCIONA",
    "[[ Corriges un precio en la PC \n Haces una venta en el celular\n                               \n Al juntarse, la app compara  \n REGISTRO POR REGISTRO:        \n                               \n  el producto que tocó la PC  \n   → gana la PC                \n  la venta que hizo el celular\n   → gana el celular           \n                               \n LOS DOS SOBREVIVEN            ]]",
    "## PARA ENTRAR DESDE OTRO APARATO",
    "1. Abre nbs2.pages.dev en el navegador.",
    "2. Entra con tu correo y tu clave.",
    "3. La app baja tus datos de la nube sola.",
    "## SI ES UN APARATO PRESTADO",
    "Usa una ventana de incógnito. Al cerrarla no queda nada de tu negocio en ese aparato.",
    "!! Lo que borras se queda borrado. Un cliente que borraste no puede resucitar porque la otra máquina todavía lo tenga."
  ]},
  { g:"SEGURIDAD", t:"🩺 Revisión de Integridad", c:[
    "## ¿PARA QUÉ SIRVE?",
    "Es el chequeo médico de tus números. Revisa que todo cuadre y te dice qué está torcido.",
    "> Menú ☰ → 🛡️ SEGURIDAD → 🩺 Revisión de integridad",
    "## LAS COSAS QUE REVISA",
    "[[ ✓ Facturas repetidas        \n ✓ Clientes repetidos          \n ✓ Ventas de clientes borrados \n ✓ Facturas con más pagos que  \n   su total                    \n ✓ Montos negativos o dañados  \n ✓ Pagos y ventas sin fecha    \n ✓ Fechas escritas al revés    \n ✓ Pagos guardados dos veces   \n ✓ Que vendido = cobrado +     \n   por cobrar                  \n ✓ Compras sin suplidor        \n ✓ Compras pagadas de más      \n ✓ Devoluciones huérfanas      \n ✓ Existencias negativas       \n ✓ Productos bajo costo        \n ✓ Que la ganancia cuadre      ]]",
    "## SI ENCUENTRA ALGO",
    "Te da un botón para arreglarlo, con el nombre y el monto exactos. Y cada arreglo pide huella o PIN.",
    "## RECORDATORIO",
    "🔔 Recordarme 3 veces al día — te agrega el aviso al calendario del teléfono.",
    "!! Córrela al menos una vez al día. Es lo más rápido que tienes para saber que tu dinero está bien."
  ]},
  { g:"SEGURIDAD", t:"🔒 PIN, huella y bloqueo", c:[
    "## ¿PARA QUÉ SIRVE?",
    "Para que nadie más pueda entrar a tu negocio ni tocar tu dinero.",
    "> Menú ☰ → 🛡️ SEGURIDAD",
    "## LO QUE PUEDES PONER",
    "PIN — un número de 4 a 8 dígitos que protege las pantallas y las acciones de dinero.",
    "Huella digital — más rápido que el PIN, y si falla siempre te pide el PIN.",
    "Bloqueo automático — a los minutos que escojas sin usar la app.",
    "Bloqueo inmediato — pide huella cada vez que sales y vuelves.",
    "## PARA CAMBIAR TU PIN",
    "1. Toca 🔑 Cambiar mi PIN secreto.",
    "2. Pon el PIN de ahora.",
    "3. Pon el nuevo, dos veces.",
    "!! El PIN vive SOLO en este teléfono. No está en la nube ni en el backup, y nadie te lo puede recuperar. Guárdalo donde no se pierda."
  ]},
  { g:"SEGURIDAD", t:"🧹 Liberar espacio en el teléfono", c:[
    "## ¿PARA QUÉ SIRVE?",
    "Si el teléfono se queda sin espacio, la app no puede guardar. Este botón libera sin tocar tus datos.",
    "> Menú ☰ → 🛡️ SEGURIDAD → 🛡️ Copias de Seguridad → 🧹 Liberar espacio",
    "## QUÉ BORRA Y QUÉ NO",
    "[[ SE BORRA                    \n  las copias viejas que        \n  guarda el teléfono           \n                               \n NO SE TOCA                    \n  ventas · clientes ·          \n  productos · fotos ·          \n  tu backup ni el de la nube   ]]",
    "!! Si te sale \"NO SE PUDO GUARDAR\", toca ese botón y vuelve a intentar. Y baja un backup antes, por si acaso."
  ]},
    { g:"HERRAMIENTAS", t:"\ud83e\udd16 Lo que la app hace SOLA", c:[
    "## \u00bfPARA QU\u00c9 SIRVE?",
    "Para que t\u00fa no tengas que acordarte de los detalles. La app los hace sola.",
    "## 1. LA RUTA SE MARCA SOLA AL VENDER",
    "Cuando le vendes a un barbero de una barber\u00eda que est\u00e1 en la ruta de hoy, la visita queda marcada con la hora. Lo mismo al guardar un pedido.",
    "!! Se hizo porque el 36% de tus ventas no ten\u00edan su visita apuntada \u2014 la mitad de tus d\u00edas de trabajo.",
    "## 2. TE OFRECE LA FIRMA EN LAS VENTAS A CR\u00c9DITO",
    "Al terminar una venta a cr\u00e9dito te pregunta si le tomas la firma al cliente. Con la firma tienes prueba de que se llev\u00f3 la mercanc\u00eda.",
    "!! Solo en las de cr\u00e9dito, que son las que pueden dar problema.",
    "## 3. TE AVISA SI VENDES M\u00c1S DE LO QUE HAY",
    "\u201cTe quedan 2 y est\u00e1s vendiendo 5\u201d.",
    "!! SOLO AVISA. Si le das que s\u00ed, la venta se hace igual \u2014 puede que lo tengas y no lo hayas apuntado.",
    "## 4. TE AVISA SI PASA UNA SEMANA SIN BACKUP",
    "Ya tienes la barra de color de arriba, que te avisa cada 30 minutos o cada varias facturas. Esa es la principal.",
    "Y ADEM\u00c1S, si de verdad pasan 7 d\u00edas sin que bajes un backup, sale un letrero que te lo dice.",
    "!! Casi nunca lo vas a ver. Si lo ves, es porque el riesgo ya es serio.",
    "## 5. GUARDA LA HORA DE CADA VISITA",
    "Para que la Bit\u00e1cora sepa a qu\u00e9 hora pasaste por cada sitio.",
    "## 6. TE AVISA SI SALES DE UNA BARBER\u00cdA SIN MARCAR",
    "A los 40 minutos de haber llegado, si no marcaste ni vendiste, te lo dice.",
    "!! Si ya la marcaste, NO te molesta.",
    "## 7. LLENA TU LISTA DE RELLENO SOLA",
    "Una vez por semana le mete lo que se te est\u00e1 acabando, con la cantidad que vendes en un mes. Rev\u00edsala antes de comprarle al suplidor.",
    "[[ \u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510\n\u2502 T\u00da VENDES                \u2502\n\u2502        \u2193                 \u2502\n\u2502 \u2713 la ruta se marca      \u2502\n\u2502 \u2713 el r\u00e9cord se apunta   \u2502\n\u2502 \u2713 la bit\u00e1cora lo guarda \u2502\n\u2502 \u2713 te ofrece la firma    \u2502\n\u2502                          \u2502\n\u2502 T\u00fa no tocaste NADA      \u2502\n\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518 ]]"
  ]},
{ g:"HERRAMIENTAS", t:"\ud83e\udd16 El Asistente \u2014 tu ayudante", c:[
    "## \u00bfPARA QU\u00c9 SIRVE?",
    "Es un ayudante que mira TUS datos y te dice lo que se te est\u00e1 escapando. Y tambi\u00e9n le puedes hablar y te contesta.",
    "No necesita internet y no cuesta nada. No adivina: cuenta lo que hay en tu app.",
    "> Bot\u00f3n redondo \ud83e\udd16 abajo a la derecha, en cualquier pantalla",
    "[[ \u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510\n\u2502                  \u2502\n\u2502  la pantalla     \u2502\n\u2502                  \u2502\n\u2502            \u256d\u2500\u2500\u256e \u2502\n\u2502            \u2502\ud83e\udd16\u2502\u25cf\u2502  \u2190 el puntito rojo dice\n\u2502            \u2570\u2500\u2500\u256f \u2502     cu\u00e1ntas cosas tiene\n\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518     que decirte ]]",
    "## LO QUE TE AVISA SOLO",
    "T\u00f3calo y te dice, sin que le preguntes:",
    "1. \ud83d\udce6 Qu\u00e9 se te acab\u00f3 y qu\u00e9 se te acaba pronto \u2014 mirando lo que vendes al mes, no lo que hay en la lista",
    "2. \ud83d\udc64 Qu\u00e9 clientes dejaron de venir \u2014 los que compraban seguido y llevan m\u00e1s del doble de su ritmo sin aparecer",
    "3. \ud83d\udcb0 Las deudas de m\u00e1s de 30 d\u00edas, con el nombre y cu\u00e1nto lleva cada una",
    "4. \ud83c\udfaf Los clientes que te compraron UNA sola vez \u2014 tu dinero m\u00e1s f\u00e1cil",
    "5. \ud83d\udcc9 Los productos que casi no te dejan ganancia",
    "## Y CADA AVISO TRAE SU BOT\u00d3N",
    "No es solo avisarte: es resolverlo ah\u00ed mismo.",
    "[[ \u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510\n\u2502 \ud83d\udce6 Se te acab\u00f3 Cool Care    \u2502\n\u2502    vendes 26 al mes          \u2502\n\u2502  [ \u2795 A la lista de relleno ]\u2502\n\u251c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524\n\u2502 \ud83d\udcb0 $1,284 en deudas viejas   \u2502\n\u2502  [ \ud83d\udcb5 Ir a cobrar ]         \u2502\n\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518 ]]",
    "## LO QUE LE PUEDES PREGUNTAR",
    "Toca \ud83c\udfa4 H\u00e1blame y dile con tus palabras:",
    "1. \u201c\u00bfcu\u00e1nto me debe Isidro?\u201d \u2014 te dice cu\u00e1nto, en cu\u00e1ntas facturas y cu\u00e1ntos d\u00edas lleva la m\u00e1s vieja, con el bot\u00f3n de cobrarle",
    "2. \u201c\u00bfqui\u00e9n no viene hace tiempo?\u201d \u2014 la lista de los que se callaron",
    "3. \u201c\u00bfc\u00f3mo me fue hoy?\u201d \u2014 vendido, cobrado, ganancia, cu\u00e1ntos visitaste y cu\u00e1ntos compraron",
    "4. \u201c\u00bfqu\u00e9 se me est\u00e1 acabando?\u201d \u2014 lo que hay que comprar, con el bot\u00f3n de meterlo al relleno",
    "5. \u201c\u00bfcu\u00e1nto llevo este mes?\u201d \u2014 vendido y ganancia del mes",
    "6. \u201cprepara un pedido para Luis\u201d \u2014 te abre su pedido",
    "7. \u201cdos cool care y tres gel\u201d \u2014 entiende la cantidad y el producto",
    "8. \u201chazme un reporte de qui\u00e9n me debe\u201d \u2014 te ofrece los reportes",
    "!! NO ES UNA INTELIGENCIA ARTIFICIAL DE VERDAD. Entiende TUS palabras: tus productos, tus clientes y tus n\u00fameros. Por eso funciona sin internet y sin costar nada. Si le dices algo que no est\u00e1 en su mundo, te dice que no entendi\u00f3 y te ense\u00f1a qu\u00e9 s\u00ed puede. NUNCA se inventa un n\u00famero.",
    "!! Si el micr\u00f3fono no funciona, revisa que le hayas dado permiso a la app. Y si tu tel\u00e9fono no tiene micr\u00f3fono disponible, te deja escribirle."
  ]},
  { g:"HERRAMIENTAS", t:"📷 Las fotos de tus productos", c:[
    "## ¿PARA QUÉ SIRVE?",
    "Para reconocer un producto de un vistazo, sobre todo cuando dos se parecen.",
    "## PARA PONERLE FOTO A UN PRODUCTO",
    "1. Catálogo → toca el producto.",
    "2. Toca 📷 y escoge Cámara o Galería.",
    "3. Recórtala y guárdala.",
    "## LAS FOTOS VIAJAN SOLAS",
    "Se guardan en la nube aparte de los productos. Si entras desde otro aparato, la app las baja sola.",
    "## SI NO APARECEN",
    "Menú ☰ → 🛡️ SEGURIDAD → Copias de Seguridad → 🔄 Bajar las fotos que me falten. Puede tardar hasta minuto y medio.",
    "!! Si dice \"revisé N productos y ninguno tiene foto\", no es un fallo: esos productos de verdad no tienen foto puesta."
  ]},
  { g:"HERRAMIENTAS", t:"📥 Traer cambios de otro aparato", c:[
    "## ¿PARA QUÉ SIRVE?",
    "Es un puente: si corregiste precios, costos, nombres o fotos en otro aparato, los trae aquí sin tocar nada más.",
    "> Menú ☰ → 🛡️ SEGURIDAD → Copias de Seguridad → 📥 Traer cambios de productos",
    "## PASO A PASO",
    "1. En el otro aparato, baja un backup.",
    "2. Aquí, toca el botón y escoge ese archivo.",
    "3. Pon el PIN con el que se bajó.",
    "4. La app te muestra las diferencias agrupadas.",
    "5. Desmarca las que no quieras y aplica.",
    "## CÓMO SE VE",
    "[[ 54 diferencias encontradas  \n                               \n ☑ ✏️ NOMBRES (8)              \n ☑ 💵 PRECIOS (7)              \n ☑ 📦 COSTOS (16)              \n ☑ 📷 FOTOS QUE NO TIENES (23) ]]",
    "!! Solo cambia nombre, precio, costo y foto. NO toca ventas, clientes, pagos, compras ni existencias. Y una foto que ya tengas no se reemplaza."
  ]},
  { g:"HERRAMIENTAS", t:"📁 Mis Documentos y 🎓 Academia", c:[
    "## MIS DOCUMENTOS",
    "Guías en PDF sobre tu negocio: precios y márgenes, finanzas, cómo ganar la lealtad de tus clientes, programa de ofertas.",
    "> Menú ☰ → ⚙️ HERRAMIENTAS → 📁 Mis Documentos",
    "Puedes ver cada uno, bajarlo, o subir los tuyos.",
    "## LA ACADEMIA",
    "Es una app aparte que te LEE las lecciones en voz alta, para escucharlas manejando en la ruta.",
    "> Menú ☰ → ⚙️ HERRAMIENTAS → 🎓 Academia",
    "Tiene lecciones de negocio, control de velocidad de lectura, y te recuerda estudiar."
  ]},
  { g:"HERRAMIENTAS", t:"❓ Si algo sale mal", c:[
    "## LO PRIMERO, SIEMPRE",
    "1. Baja un backup: Menú ☰ → 🛡️ SEGURIDAD → 💾 Exportar backup.",
    "2. Corre la 🩺 Revisión de integridad.",
    "## LOS AVISOS QUE PUEDEN SALIR, Y QUÉ SIGNIFICAN",
    "[[ \"NO SE PUDO GUARDAR\"        \n  → se llenó la memoria.       \n    Toca 🧹 Liberar espacio.   \n                               \n \"parece que se borraron       \n  datos\"                       \n  → compara con lo de antes.   \n    Si tú no borraste nada,    \n    puedes volver a una copia. \n                               \n \"El dinero no cuadra\"         \n  → la Revisión te da el botón\n    para arreglarlo.           ]]",
    "## PARA VOLVER ATRÁS",
    "Menú ☰ → 🛡️ SEGURIDAD → 🛡️ Copias de Seguridad. Ahí tienes las copias del teléfono y las de la nube, con su hora. Tocas 🔄 Restaurar en la que quieras.",
    "## SI NADA DE ESO FUNCIONA",
    "Importa el último backup que bajaste: Menú ☰ → 🛡️ SEGURIDAD → 📂 Importar backup.",
    "!! Importar REEMPLAZA lo que hay ahora. Si el teléfono tiene ventas más nuevas que el backup, se pierden. Baja un backup antes de importar otro."
  ]}
];


// ═══ COMPARTIR O IMPRIMIR TODO EL MANUAL (30 jul) ═══
// Sensei pidió que el manual se pueda imprimir o compartir en PDF. Se arma el texto
// completo de los 31 temas, respetando los dibujos, y se abre la ventana de impresión.
function renderCXP(){
  compras = LS('nc', []);
  suplidores = LS('nsup', []);
  var tarjetas = LS('ntarjetas', []);
  var otrasDeudas = LS('notrasdeudas', []);

  // ---- Calcular deuda con suplidores (reutiliza los mismos datos de Compras) ----
  var totalSuplidores = 0;
  var suplidoresConDeuda = [];
  suplidores.forEach(function(s){
    var comprasS = compras.filter(function(c){ return String(c.sid)===String(s.id) && c.tipo==='credito'; });
    var totalS = 0;
    comprasS.forEach(function(c){
      var pagado = c.pagosFactura ? (c.pagosFactura || []).filter(function(p){return typeof p.monto==='number';}).reduce(function(s2,p){return s2+p.monto;},0) : 0;
      totalS += Math.max(0, c.total - pagado);
    });
    if(totalS > 0.001){ totalSuplidores += totalS; suplidoresConDeuda.push({ nombre: s.nombre, id: s.id, total: totalS }); }
  });

  var totalTarjetas = tarjetas.reduce(function(s,t){ return s+(t.balance||0); }, 0);
  var totalOtras = otrasDeudas.reduce(function(s,d){ return s+(d.balance||0); }, 0);
  var totalGeneral = totalSuplidores + totalTarjetas + totalOtras;

  var el = document.getElementById('cxp-contenido');
  el.innerHTML = '';

  // ---- Resumen general ----
  var resumen = document.createElement('div');
  resumen.style.cssText = 'background:linear-gradient(135deg,#7B1E3A,#5A1529);color:white;border-radius:14px;padding:18px;margin-bottom:16px';
  resumen.innerHTML = '<div style="font-size:11px;font-weight:700;letter-spacing:1px;opacity:0.85;margin-bottom:6px">TOTAL QUE DEBE EL NEGOCIO</div>'
    +'<div style="font-size:30px;font-weight:800;margin-bottom:12px">$'+fmtNum(totalGeneral)+'</div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;font-size:11px">'
    +'<div style="background:rgba(255,255,255,0.15);border-radius:8px;padding:8px;text-align:center"><div style="opacity:0.8">Suplidores</div><div style="font-size:14px;font-weight:700;margin-top:2px">$'+fmtNum(totalSuplidores)+'</div></div>'
    +'<div style="background:rgba(255,255,255,0.15);border-radius:8px;padding:8px;text-align:center"><div style="opacity:0.8">Tarjetas</div><div style="font-size:14px;font-weight:700;margin-top:2px">$'+fmtNum(totalTarjetas)+'</div></div>'
    +'<div style="background:rgba(255,255,255,0.15);border-radius:8px;padding:8px;text-align:center"><div style="opacity:0.8">Otras deudas</div><div style="font-size:14px;font-weight:700;margin-top:2px">$'+fmtNum(totalOtras)+'</div></div>'
    +'</div>';
  el.appendChild(resumen);

  // ---- Seccion Suplidores ----
  var tituloSup = document.createElement('div');
  tituloSup.style.cssText = 'font-size:12px;font-weight:700;color:var(--nbs-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center';
  tituloSup.innerHTML = '<span>🏭 Suplidores</span><span style="color:var(--nbs-gold-dark)">$'+fmtNum(totalSuplidores)+'</span>';
  el.appendChild(tituloSup);
  if(!suplidoresConDeuda.length){
    var vacSup = document.createElement('p');
    vacSup.style.cssText = 'color:var(--nbs-muted);font-size:12px;padding:8px 0 16px';
    vacSup.textContent = 'No debes nada a ningún suplidor ahora mismo.';
    el.appendChild(vacSup);
  } else {
    suplidoresConDeuda.sort(function(a,b){ return b.total-a.total; });
    suplidoresConDeuda.forEach(function(s, idxCard){
      var card = document.createElement('div');
      card.style.cssText = 'background:white;border:0.5px solid var(--nbs-line);border-radius:10px;padding:12px 14px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;cursor:pointer;box-shadow:var(--nbs-shadow-card);animation:tarjetaEntra 0.35s ease backwards;animation-delay:'+(Math.min(idxCard,6)*0.03)+'s';
      card.innerHTML = '<span style="font-size:14px;font-weight:600;color:var(--nbs-ink)">'+escaparHtml(s.nombre)+'</span><span style="font-size:15px;font-weight:700;color:var(--nbs-red-text)">$'+fmtNum(s.total)+'</span>';
      card.onclick = (function(sid){ return function(){ ir('p-sup'); verSup(sid, 'abiertas'); }; })(s.id);
      el.appendChild(card);
    });
    var espacio = document.createElement('div'); espacio.style.height='8px'; el.appendChild(espacio);
  }

  // ---- Seccion Tarjetas de Credito ----
  var tituloTarj = document.createElement('div');
  tituloTarj.style.cssText = 'font-size:12px;font-weight:700;color:var(--nbs-muted);text-transform:uppercase;letter-spacing:0.5px;margin:12px 0 8px;display:flex;justify-content:space-between;align-items:center';
  tituloTarj.innerHTML = '<span>💳 Tarjetas de Crédito</span><span style="color:var(--nbs-gold-dark)">$'+fmtNum(totalTarjetas)+'</span>';
  el.appendChild(tituloTarj);
  if(!tarjetas.length){
    var vacT = document.createElement('p');
    vacT.style.cssText = 'color:var(--nbs-muted);font-size:12px;padding:4px 0 12px';
    vacT.textContent = 'No has agregado ninguna tarjeta todavía.';
    el.appendChild(vacT);
  }
  tarjetas.forEach(function(t, idxCard){
    var pctUso = t.limite > 0 ? Math.min(100, Math.round((t.balance/t.limite)*100)) : 0;
    var card = document.createElement('div');
    card.style.cssText = 'background:white;border:0.5px solid var(--nbs-line);border-radius:12px;padding:14px;margin-bottom:8px;box-shadow:var(--nbs-shadow-card);animation:tarjetaEntra 0.35s ease backwards;animation-delay:'+(Math.min(idxCard,6)*0.03)+'s';
    card.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:'+(t.limite>0?'8px':'10px')+'">'
      +'<div><div style="font-size:14px;font-weight:700;color:var(--nbs-ink)">'+escaparHtml(t.nombre)+'</div>'+(t.banco?'<div style="font-size:11px;color:var(--nbs-muted)">'+t.banco+'</div>':'')+'</div>'
      +'<div style="text-align:right"><div style="font-size:17px;font-weight:800;color:var(--nbs-red-text)">$'+fmtNum(t.balance)+'</div>'+(t.limite>0?'<div style="font-size:10px;color:var(--nbs-muted)">de $'+fmtNum(t.limite)+' límite</div>':'')+'</div>'
      +'</div>'
      +(t.limite>0?'<div style="height:6px;background:#F0F0F2;border-radius:3px;overflow:hidden;margin-bottom:10px"><div style="height:100%;width:'+pctUso+'%;background:'+(pctUso>85?'var(--nbs-red-dark)':'var(--nbs-gold)')+'"></div></div>':'')
      +'<div style="display:flex;gap:6px">'
      +'<button onclick="registrarMovimientoTarjeta('+t.id+',\'pago\')" style="flex:1;padding:9px;background:var(--nbs-green-bg);color:var(--nbs-green-text);border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">💰 Pago</button>'
      +'<button onclick="registrarMovimientoTarjeta('+t.id+',\'cargo\')" style="flex:1;padding:9px;background:var(--nbs-red-bg);color:var(--nbs-red-dark);border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">+ Cargo</button>'
      +'<button onclick="editarTarjeta('+t.id+')" style="padding:9px 12px;background:#F0F0F2;color:var(--nbs-ink);border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">✏️</button>'
      +'<button onclick="eliminarTarjeta('+t.id+')" style="padding:9px 12px;background:#F0F0F2;color:var(--nbs-red-dark);border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">🗑️</button>'
      +'</div>';
    el.appendChild(card);
  });
  var btnAddTarj = document.createElement('button');
  btnAddTarj.textContent = '+ Agregar tarjeta de crédito';
  btnAddTarj.style.cssText = 'width:100%;padding:12px;background:var(--nbs-gold-bg);color:var(--nbs-gold-dark);border:1px dashed var(--nbs-gold);border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;margin-bottom:8px';
  btnAddTarj.onclick = function(){ abrirFormTarjeta(null); };
  el.appendChild(btnAddTarj);

  // ---- Seccion Otras Deudas ----
  var tituloOtras = document.createElement('div');
  tituloOtras.style.cssText = 'font-size:12px;font-weight:700;color:var(--nbs-muted);text-transform:uppercase;letter-spacing:0.5px;margin:12px 0 8px;display:flex;justify-content:space-between;align-items:center';
  tituloOtras.innerHTML = '<span>📋 Otras Deudas del Negocio</span><span style="color:var(--nbs-gold-dark)">$'+fmtNum(totalOtras)+'</span>';
  el.appendChild(tituloOtras);
  if(!otrasDeudas.length){
    var vacO = document.createElement('p');
    vacO.style.cssText = 'color:var(--nbs-muted);font-size:12px;padding:4px 0 12px';
    vacO.textContent = 'Préstamos, renta, equipos financiados, etc. — aquí no tienes ninguna registrada.';
    el.appendChild(vacO);
  }
  otrasDeudas.forEach(function(d, idxCard){
    var card = document.createElement('div');
    card.style.cssText = 'background:white;border:0.5px solid var(--nbs-line);border-radius:12px;padding:14px;margin-bottom:8px;box-shadow:var(--nbs-shadow-card);animation:tarjetaEntra 0.35s ease backwards;animation-delay:'+(Math.min(idxCard,6)*0.03)+'s';
    card.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">'
      +'<div><div style="font-size:14px;font-weight:700;color:var(--nbs-ink)">'+escaparHtml(d.nombre)+'</div><div style="font-size:11px;color:var(--nbs-muted)">'+(d.tipo||'Otro')+(d.notas?' · '+d.notas:'')+'</div></div>'
      +'<div style="font-size:17px;font-weight:800;color:var(--nbs-red-text)">$'+fmtNum(d.balance)+'</div>'
      +'</div>'
      +'<div style="display:flex;gap:6px">'
      +'<button onclick="registrarMovimientoOtraDeuda('+d.id+',\'pago\')" style="flex:1;padding:9px;background:var(--nbs-green-bg);color:var(--nbs-green-text);border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">💰 Pago</button>'
      +'<button onclick="registrarMovimientoOtraDeuda('+d.id+',\'aumento\')" style="flex:1;padding:9px;background:var(--nbs-red-bg);color:var(--nbs-red-dark);border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">+ Aumentar</button>'
      +'<button onclick="editarOtraDeuda('+d.id+')" style="padding:9px 12px;background:#F0F0F2;color:var(--nbs-ink);border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">✏️</button>'
      +'<button onclick="eliminarOtraDeuda('+d.id+')" style="padding:9px 12px;background:#F0F0F2;color:var(--nbs-red-dark);border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">🗑️</button>'
      +'</div>';
    el.appendChild(card);
  });
  var btnAddOtra = document.createElement('button');
  btnAddOtra.textContent = '+ Agregar otra deuda';
  btnAddOtra.style.cssText = 'width:100%;padding:12px;background:var(--nbs-gold-bg);color:var(--nbs-gold-dark);border:1px dashed var(--nbs-gold);border-radius:10px;font-size:13px;font-weight:700;cursor:pointer';
  btnAddOtra.onclick = function(){ abrirFormOtraDeuda(null); };
  el.appendChild(btnAddOtra);
}

// ---- Formulario para agregar/editar una tarjeta de credito ----
function abrirFormTarjeta(id){
  var tarjetas = LS('ntarjetas', []);
  var t = id ? tarjetas.find(function(x){ return String(x.id) === String(id); }) : null;

  var overlay = document.getElementById('cxp-form-overlay');
  if(!overlay){
    overlay = document.createElement('div');
    overlay.id = 'cxp-form-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:99999;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);display:flex;align-items:flex-end';
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = '<div style="background:white;width:100%;max-width:480px;margin:0 auto;border-radius:16px 16px 0 0;padding:20px;max-height:90vh;overflow-y:auto">'
    +'<div style="font-size:16px;font-weight:700;color:var(--nbs-ink);margin-bottom:14px">'+(t?'✏️ Editar tarjeta':'💳 Nueva tarjeta de crédito')+'</div>'
    +'<label class="lbl">Nombre de la tarjeta *</label>'
    +'<input class="inp" id="cxpt-nombre" type="text" placeholder="Ej: Visa Chase Negocio" value="'+(t?t.nombre.replace(/"/g,"'"):'')+'">'
    +'<label class="lbl">Banco (opcional)</label>'
    +'<input class="inp" id="cxpt-banco" type="text" placeholder="Ej: Chase, Bank of America" value="'+(t&&t.banco?t.banco.replace(/"/g,"'"):'')+'">'
    +'<div class="r2">'
    +'<div><label class="lbl">Balance actual ($)</label><input class="inp" id="cxpt-balance" type="text" inputmode="numeric" onfocus="this.select()" oninput="formatoMoneda(this)" value="'+(t?t.balance.toFixed(2):'0.00')+'"></div>'
    +'<div><label class="lbl">Límite (opcional)</label><input class="inp" id="cxpt-limite" type="text" inputmode="numeric" onfocus="this.select()" oninput="formatoMoneda(this)" value="'+(t&&t.limite?t.limite.toFixed(2):'0.00')+'"></div>'
    +'</div>'
    +'<button class="btn" style="background:var(--nbs-gold);color:white" onclick="guardarTarjeta('+(t?t.id:'null')+')">✓ '+(t?'Guardar cambios':'Agregar tarjeta')+'</button>'
    +'<button class="btn" style="background:#F0F0F2;color:var(--nbs-ink)" onclick="document.getElementById(\'cxp-form-overlay\').style.display=\'none\'">Cancelar</button>'
    +'</div>';
  overlay.style.display = 'flex'; overlay.scrollTop = 0;
}

function guardarTarjeta(id){
  var nombre = document.getElementById('cxpt-nombre').value.trim();
  if(!nombre){ alert('Escribe el nombre de la tarjeta'); return; }
  var banco = document.getElementById('cxpt-banco').value.trim();
  var balance = dinero(document.getElementById('cxpt-balance').value) || 0;
  var limite = dinero(document.getElementById('cxpt-limite').value) || 0;

  var tarjetas = LS('ntarjetas', []);
  if(id){
    var t = tarjetas.find(function(x){ return String(x.id) === String(id); });
    if(t){ t.nombre=nombre; t.banco=banco; t.balance=balance; t.limite=limite; }
  } else {
    tarjetas.push({ id: Date.now(), nombre: nombre, banco: banco, balance: balance, limite: limite, historial: [] });
  }
  SS('ntarjetas', tarjetas);
  document.getElementById('cxp-form-overlay').style.display = 'none';
  renderCXP();
}

function editarTarjeta(id){ abrirFormTarjeta(id); }

function eliminarTarjeta(id){
  if(!confirm('¿Eliminar esta tarjeta de tu registro? Esto no cancela la deuda real, solo la quita de la app.')) return;
  var tarjetas = LS('ntarjetas', []).filter(function(t){ return t.id!==id; });
  SS('ntarjetas', tarjetas);
  renderCXP();
}

// Si el pago es mayor al balance, avisa cuánto sobra ANTES de aplicarlo.
// El usuario decide: corregir el monto, o aplicarlo igual (el balance
// queda en 0 y el sobrante NO se guarda en ningún lado, tal como antes,
// pero ahora al menos se avisa con el número exacto).
function verificarSobrepago(balanceActual, montoNum){
  if(montoNum <= (balanceActual||0)) return true;
  var sobra = montoNum - (balanceActual||0);
  return confirm('⚠️ Estás pagando de más\n\nBalance actual: $'+fmtNum(balanceActual||0)+'\nPago que registraste: $'+fmtNum(montoNum)+'\nTe sobran: $'+fmtNum(sobra)+'\n\nEl balance quedará en $0. Anota tú mismo si te deben ese sobrante.\n\n¿Aplicar el pago igual?');
}

function registrarMovimientoTarjeta(id, tipo){
  var tarjetas = LS('ntarjetas', []);
  var t = tarjetas.find(function(x){ return String(x.id) === String(id); });
  if(!t) return;
  var texto = tipo==='pago' ? '¿Cuánto vas a pagar a esta tarjeta?' : '¿Cuánto fue el cargo/compra a esta tarjeta?';
  var monto = prompt(texto, '0');
  if(monto === null) return;
  var montoNum = dinero(monto);
  if(isNaN(montoNum) || montoNum <= 0){ alert('Monto inválido'); return; }
  if(tipo==='pago' && !verificarSobrepago(t.balance, montoNum)) return;
  if(!t.historial) t.historial = [];
  t.historial.push({ tipo: tipo, monto: montoNum, fecha: fechaHoy() });
  t.balance = tipo==='pago' ? Math.max(0, t.balance - montoNum) : t.balance + montoNum;
  SS('ntarjetas', tarjetas);
  renderCXP();
}

// ---- Formulario para agregar/editar otra deuda ----
function abrirFormOtraDeuda(id){
  var deudas = LS('notrasdeudas', []);
  var d = id ? deudas.find(function(x){ return String(x.id) === String(id); }) : null;

  var overlay = document.getElementById('cxp-form-overlay');
  if(!overlay){
    overlay = document.createElement('div');
    overlay.id = 'cxp-form-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:99999;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);display:flex;align-items:flex-end';
    document.body.appendChild(overlay);
  }
  var tipos = ['Préstamo', 'Renta', 'Equipo financiado', 'Servicio/Utilidad', 'Otro'];
  overlay.innerHTML = '<div style="background:white;width:100%;max-width:480px;margin:0 auto;border-radius:16px 16px 0 0;padding:20px;max-height:90vh;overflow-y:auto">'
    +'<div style="font-size:16px;font-weight:700;color:var(--nbs-ink);margin-bottom:14px">'+(d?'✏️ Editar deuda':'📋 Nueva deuda del negocio')+'</div>'
    +'<label class="lbl">Nombre / descripción *</label>'
    +'<input class="inp" id="cxpd-nombre" type="text" placeholder="Ej: Préstamo del carro, Renta del local" value="'+(d?d.nombre.replace(/"/g,"'"):'')+'">'
    +'<label class="lbl">Tipo</label>'
    +'<select class="inp" id="cxpd-tipo">'+tipos.map(function(tp){ return '<option value="'+tp+'"'+(d&&d.tipo===tp?' selected':'')+'>'+tp+'</option>'; }).join('')+'</select>'
    +'<label class="lbl">Balance pendiente ($)</label>'
    +'<input class="inp" id="cxpd-balance" type="text" inputmode="numeric" onfocus="this.select()" oninput="formatoMoneda(this)" value="'+(d?d.balance.toFixed(2):'0.00')+'">'
    +'<label class="lbl">Notas (opcional)</label>'
    +'<input class="inp" id="cxpd-notas" type="text" placeholder="Ej: pago mensual $250" value="'+(d&&d.notas?d.notas.replace(/"/g,"'"):'')+'">'
    +'<button class="btn" style="background:var(--nbs-gold);color:white" onclick="guardarOtraDeuda('+(d?d.id:'null')+')">✓ '+(d?'Guardar cambios':'Agregar deuda')+'</button>'
    +'<button class="btn" style="background:#F0F0F2;color:var(--nbs-ink)" onclick="document.getElementById(\'cxp-form-overlay\').style.display=\'none\'">Cancelar</button>'
    +'</div>';
  overlay.style.display = 'flex'; overlay.scrollTop = 0;
}

function guardarOtraDeuda(id){
  var nombre = document.getElementById('cxpd-nombre').value.trim();
  if(!nombre){ alert('Escribe el nombre o descripción de la deuda'); return; }
  var tipo = document.getElementById('cxpd-tipo').value;
  var balance = dinero(document.getElementById('cxpd-balance').value) || 0;
  var notas = document.getElementById('cxpd-notas').value.trim();

  var deudas = LS('notrasdeudas', []);
  if(id){
    var d = deudas.find(function(x){ return String(x.id) === String(id); });
    if(d){ d.nombre=nombre; d.tipo=tipo; d.balance=balance; d.notas=notas; }
  } else {
    deudas.push({ id: Date.now(), nombre: nombre, tipo: tipo, balance: balance, notas: notas, historial: [] });
  }
  SS('notrasdeudas', deudas);
  document.getElementById('cxp-form-overlay').style.display = 'none';
  renderCXP();
}

function editarOtraDeuda(id){ abrirFormOtraDeuda(id); }

function eliminarOtraDeuda(id){
  if(!confirm('¿Eliminar esta deuda de tu registro?')) return;
  var deudas = LS('notrasdeudas', []).filter(function(d){ return d.id!==id; });
  SS('notrasdeudas', deudas);
  renderCXP();
}

function registrarMovimientoOtraDeuda(id, tipo){
  var deudas = LS('notrasdeudas', []);
  var d = deudas.find(function(x){ return String(x.id) === String(id); });
  if(!d) return;
  var texto = tipo==='pago' ? '¿Cuánto vas a pagar de esta deuda?' : '¿Cuánto aumentó esta deuda?';
  var monto = prompt(texto, '0');
  if(monto === null) return;
  var montoNum = dinero(monto);
  if(isNaN(montoNum) || montoNum <= 0){ alert('Monto inválido'); return; }
  if(tipo==='pago' && !verificarSobrepago(d.balance, montoNum)) return;
  if(!d.historial) d.historial = [];
  d.historial.push({ tipo: tipo, monto: montoNum, fecha: fechaHoy() });
  d.balance = tipo==='pago' ? Math.max(0, d.balance - montoNum) : d.balance + montoNum;
  SS('notrasdeudas', deudas);
  renderCXP();
}

function ini(n,a){
  var n1 = (n && n.length) ? n[0] : '?';
  var n2 = (a && a.length) ? a[0] : '';
  return (n1+n2).toUpperCase();
}

// Nombre completo del cliente incluyendo su apodo (si tiene), para mostrar en listas/tarjetas
function saveSup(){
  var n = limpiarTexto(document.getElementById('sn').value.trim());
  if(!n){ alert('El nombre de la empresa es requerido'); return; }
  // -confirmacion redundante quitada, el boton de Guardar ya es la confirmacion-
  suplidores = LS('nsup', []);
  suplidores.push({
    id: Date.now(),
    nombre: n,
    contacto: limpiarTexto(document.getElementById('sct').value.trim()),
    tel: document.getElementById('stel').value.trim(),
    telContacto: document.getElementById('stelc').value.trim(),
    email: document.getElementById('sem').value.trim(),
    dir: limpiarTexto(document.getElementById('sdir').value.trim()),
    ciudad: limpiarTexto(document.getElementById('sciu').value.trim()),
    zip: document.getElementById('szip').value.trim(),
    estado: document.getElementById('sest').value,
    notas: document.getElementById('snotas').value.trim()
  });
  ['sn','sct','stel','stelc','sem','sdir','sciu','szip','snotas'].forEach(function(id){ document.getElementById(id).value=''; });
  document.getElementById('sest').value = '';
  SS('nsup', suplidores);
  flash('mk-sup');
  renderSup('');
  document.getElementById('sup-l').style.display = 'block';
  document.getElementById('sup-n').style.display = 'none';
}

function renderSup(q){
  suplidores = LS('nsup', []);
  compras = LS('nc', []);
  var el = document.getElementById('lsup');
  el.innerHTML = '';
  var list = q ? filtrarPorBusqueda(suplidores, q, function(s){ return s.nombre+' '+(s.contacto||'')+' '+(s.tel||'')+' '+(s.telContacto||'')+' '+(s.dir||'')+' '+(s.ciudad||''); }) : suplidores;
  if(!list.length){ el.innerHTML = '<p style="color:#aaa;text-align:center;padding:20px">Sin suplidores</p>'; return; }
  list.forEach(function(s){
    var comprasS = compras.filter(function(c){ return String(c.sid)===String(s.id); });
    var totalComprado = comprasS.reduce(function(sum,c){ return sum+c.total; },0);
    var totalPagado = comprasS.filter(function(c){ return c.tipo==='credito'; }).reduce(function(sum,c){
      var pf = c.pagosFactura ? (c.pagosFactura || []).filter(function(p){return typeof p.monto==='number';}).reduce(function(sp,p){return sp+p.monto;},0) : 0;
      return sum+pf;
    },0);
    var totalCredito = comprasS.filter(function(c){ return c.tipo==='credito'; }).reduce(function(sum,c){ return sum+c.total; },0);
    var debo = Math.max(0, totalCredito-totalPagado);
    var d = document.createElement('div'); d.className = 'clrow';
    d.innerHTML = '<div class="av" style="background:#EFEBE9;color:#5D4037">'+ini(s.nombre,'')+'</div>'
      +'<div style="flex:1"><div style="font-size:14px;font-weight:600">'+escaparHtml(s.nombre)+'</div>'
      +'<div style="font-size:12px;color:#aaa">'+(s.contacto||'Sin contacto')+' · '+(s.tel||'Sin tel.')+'</div>'
      +'<div style="margin-top:4px">'+(debo>0?'<span class="chip ca">Debo $'+fmtNum(debo)+'</span>':'<span class="chip cg">Al corriente</span>')+' <span style="font-size:12px;color:#aaa">Comprado: $'+fmtNum(totalComprado)+'</span></div></div>'
      +'<span style="color:#ddd;font-size:20px">›</span>';
    d.onclick = (function(sid){ return function(){ verSup(sid); }; })(s.id);
    el.appendChild(d);
  });
}

function toggleSupPanel(clave, id){
  _panelSupAbierto = (_panelSupAbierto === clave) ? null : clave;
  verSup(id, window._modoSupActual || 'abiertas');
  setTimeout(function(){
    var f = document.getElementById('supfila-' + clave);
    if(f) try { f.scrollIntoView({ behavior:'smooth', block:'center' }); } catch(e){}
  }, 80);
}

// Un renglon: icono, titulo, su numero a la derecha, y el contenido que se despliega.
function _filaSup(clave, icono, titulo, resumen, contenido, id){
  var abierto = (_panelSupAbierto === clave);
  var h = '<div id="supfila-' + clave + '" style="border-radius:11px;margin-bottom:7px;overflow:hidden;'
    + 'border:1px solid ' + (abierto ? '#5D4037' : 'var(--nbs-line)') + '">'
    + '<div onclick="toggleSupPanel(\'' + clave + '\',' + id + ')" style="display:flex;align-items:center;gap:9px;'
    + 'padding:11px 12px;cursor:pointer;background:' + (abierto ? '#EFEBE9' : '#fff') + '">'
    + '<span style="font-size:16px;flex-shrink:0">' + icono + '</span>'
    + '<span style="flex:1;font-size:14px;font-weight:800;color:' + (abierto ? '#5D4037' : 'var(--nbs-ink)') + '">' + titulo + '</span>'
    + (resumen ? '<span style="font-size:12px;font-weight:700;color:var(--nbs-muted);flex-shrink:0">' + resumen + '</span>' : '')
    + '<span style="font-size:13px;color:var(--nbs-muted);flex-shrink:0">' + (abierto ? '\u2303' : '\u203a') + '</span>'
    + '</div>';
  if(abierto) h += '<div style="padding:11px 12px;background:#FAFAFC;border-top:1px solid var(--nbs-line)">' + contenido + '</div>';
  return h + '</div>';
}

function verSup(id, modo){
  modo = modo || 'abiertas';
  suplidores = LS('nsup', []);
  compras = LS('nc', []);
  var s = suplidores.find(function(x){ return String(x.id)===String(id); });
  if(!s) return;

  var todasComprasS = compras.filter(function(c){ return String(c.sid)===String(id); });
  todasComprasS.forEach(function(c){
    var pagado = c.pagosFactura ? (c.pagosFactura || []).filter(function(p){return typeof p.monto==='number';}).reduce(function(s2,p){return s2+p.monto;},0) : 0;
    c._pagado = pagado;
    c._saldo = Math.max(0, c.total - pagado);
  });
  var comprasS = modo==='abiertas' ? todasComprasS.filter(function(c){ return c.tipo==='credito' && esSaldoPendiente(c._saldo); }) : todasComprasS;

  var totalComprado = todasComprasS.reduce(function(sum,c){ return sum+c.total; },0);
  var totalPagado = todasComprasS.filter(function(c){ return c.tipo==='credito'; }).reduce(function(sum,c){ return sum+c._pagado; },0);
  var totalCredito = todasComprasS.filter(function(c){ return c.tipo==='credito'; }).reduce(function(sum,c){ return sum+c.total; },0);
  var debo = Math.max(0, totalCredito-totalPagado);

  var el = document.getElementById('sup-perfil-contenido');
  el.innerHTML = '';

  var header = document.createElement('div');
  header.className = 'card';
  header.innerHTML = '<div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">'
    +'<div class="av" style="width:56px;height:56px;font-size:20px;background:#EFEBE9;color:#5D4037">'+ini(s.nombre,'')+'</div>'
    +'<div><div style="font-size:22px;font-weight:700">'+escaparHtml(s.nombre)+'</div>'
  // 🏪 LA CABECERA, COMO LA DEL CLIENTE -Sensei, 21 ago-: cuatro numeros arriba y ya. Los
  // datos y los botones de ajustes se fueron a los renglones desplegables de abajo.
  var _prodDistintos = {};
  todasComprasS.forEach(function(c){
    (c.items || []).forEach(function(it){
      _prodDistintos[it.pid ? String(it.pid) : ('n:' + String(it.nombre || ''))] = true;
    });
  });
  var _fechasSup = [];
  todasComprasS.forEach(function(c){
    var f = parsearFechaVenta(c.fecha);
    if(f && !isNaN(f.getTime())) _fechasSup.push(f.getTime());
  });
  _fechasSup.sort(function(a,b){ return a-b; });
  var _ultimaSup = _fechasSup.length ? Math.floor((Date.now() - _fechasSup[_fechasSup.length-1]) / 86400000) : null;

  var _num = function(rotulo, valor, color, fondo){
    return '<div style="background:' + (fondo || '#F5F5F7') + ';border-radius:9px;padding:8px 6px;text-align:center">'
      + '<div style="font-size:9px;color:var(--nbs-muted);font-weight:800;letter-spacing:.3px">' + rotulo + '</div>'
      + '<div style="font-size:16px;font-weight:900;color:' + (color || 'var(--nbs-ink)') + ';margin-top:2px;letter-spacing:-0.4px">' + valor + '</div></div>';
  };

  header.innerHTML = '<div style="display:flex;align-items:center;gap:11px;margin-bottom:11px">'
    +'<div class="av" style="width:50px;height:50px;font-size:19px;background:#EFEBE9;color:#5D4037;flex-shrink:0">'+ini(s.nombre,'')+'</div>'
    +'<div style="min-width:0"><div style="font-size:20px;font-weight:900;color:var(--nbs-ink);line-height:1.12">'+escaparHtml(s.nombre)+'</div>'
    +'<div style="font-size:12px;color:var(--nbs-muted)">'+(s.contacto?escaparHtml(s.contacto):'Sin contacto registrado')+'</div></div></div>'
    +'<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px">'
    + _num('COMPRÉ', '$'+fmtNum(totalComprado), '#1565C0')
    + _num('DEBO', '$'+fmtNum(debo), debo>0.005?'#C62828':'#2E7D32', debo>0.005?'#FFEBEE':'#E8F5E9')
    + _num('PRODUCTOS', String(Object.keys(_prodDistintos).length), '#5D4037')
    + _num('ÚLTIMA', (_ultimaSup===null?'—':(_ultimaSup+' d')), '#5D4037')
    +'</div>';
  el.appendChild(header);

  // Atajos para comprarle a ESTE suplidor -27 jul, idea de Sensei-. Antes habia que ir a
  // Compras y buscar el suplidor en la lista; ahora se llega con el ya escogido.
  var atajos = document.createElement('div');
  atajos.style.cssText = 'display:flex;flex-direction:column;gap:8px;margin:12px 0';

  var btnCompra = document.createElement('button');
  btnCompra.textContent = '🛒 Nueva compra a este suplidor';
  btnCompra.style.cssText = 'width:100%;padding:12px;border:2px solid #1565C0;border-radius:10px;background:#E3F2FD;color:#1565C0;font-weight:800;font-size:13.5px;cursor:pointer';
  btnCompra.onclick = (function(sid){ return function(){ nuevaCompraASuplidor(sid, false); }; })(id);

  var btnFactura = document.createElement('button');
  btnFactura.textContent = '📄 Leer factura PDF de este suplidor';
  btnFactura.style.cssText = 'width:100%;padding:12px;border:2px solid #2E7D32;border-radius:10px;background:#E8F5E9;color:#2E7D32;font-weight:800;font-size:13.5px;cursor:pointer';
  btnFactura.onclick = (function(sid){ return function(){ nuevaCompraASuplidor(sid, true); }; })(id);

  // 💸 PAGARLE -19 ago-. Antes no existia: para pagar habia que entrar factura por factura.
  var btnPagar = document.createElement('button');
  var _leDebo = LS('nc', []).filter(function(cc){ return String(cc.sid) === String(id); })
                  .reduce(function(a, cc){ var s2 = saldoDeCompra(cc); return a + (s2 > 0.005 ? s2 : 0); }, 0);
  btnPagar.textContent = _leDebo > 0.005 ? ('💸 Pagarle ($' + fmtNum(_leDebo) + ')') : '💸 Pagarle';
  btnPagar.style.cssText = 'width:100%;padding:12px;border:2px solid #C62828;border-radius:10px;background:#FFEBEE;color:#C62828;font-weight:800;font-size:13.5px;cursor:pointer';
  btnPagar.onclick = (function(sid){ return function(){ abrirPagoSuplidor(sid); }; })(id);

  atajos.appendChild(btnPagar);
  atajos.appendChild(btnCompra);
  atajos.appendChild(btnFactura);
  el.appendChild(atajos);

  // 🏪 LOS RENGLONES DESPLEGABLES, como los del cliente. -21 ago-
  window._modoSupActual = modo;
  var paneles = document.createElement('div');
  paneles.style.cssText = 'margin-bottom:12px';
  paneles.innerHTML = panelesDelSuplidor(id, s, todasComprasS);
  el.appendChild(paneles);

  var tabs = document.createElement('div');
  tabs.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px';
  tabs.innerHTML = '<button onclick="verSup('+id+',\'abiertas\')" style="padding:12px;background:'+(modo==='abiertas'?'var(--nbs-gold)':'#F0F0F2')+';color:'+(modo==='abiertas'?'white':'var(--nbs-ink)')+';border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer">📂 Compras abiertas</button>'
    +'<button onclick="verSup('+id+',\'completo\')" style="padding:12px;background:'+(modo==='completo'?'var(--nbs-gold)':'#F0F0F2')+';color:'+(modo==='completo'?'white':'var(--nbs-ink)')+';border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer">📋 Historial completo</button>';
  el.appendChild(tabs);

  var tit = document.createElement('div');
  tit.style.cssText = 'font-size:13px;font-weight:700;color:#5D4037;text-transform:uppercase;margin-bottom:10px';
  tit.textContent = (modo==='abiertas' ? 'Compras con saldo pendiente' : 'Historial completo') + ' (' + comprasS.length + ')';
  el.appendChild(tit);

  if(!comprasS.length){
    var vacio = document.createElement('p');
    vacio.style.cssText = 'color:#aaa;text-align:center;padding:20px;font-size:13px';
    vacio.textContent = modo==='abiertas' ? 'No hay compras abiertas — todo está al día.' : 'Sin compras registradas.';
    el.appendChild(vacio);
  }

  comprasS.slice().reverse().forEach(function(c){
      var saldo = c._saldo;
      var card = document.createElement('div');
      card.className = 'card';
      card.style.cursor = 'pointer';
      card.style.borderLeft = '4px solid ' + (c.tipo==='credito' ? (esSaldoPendiente(saldo)?'#C62828':'#2E7D32') : '#1565C0');
      var pagosHtml = '';
      if(modo==='completo' && c.tipo==='credito' && c.pagosFactura && (c.pagosFactura || []).length){
        pagosHtml = '<div style="margin-top:6px;padding-top:6px;border-top:0.5px dashed #ddd">'
          +(c.pagosFactura || []).filter(function(p){return p.monto>0;}).map(function(p){
            var detalle = (p.metodos && p.metodos.length) ? p.metodos.map(function(m){ return METODOS_PAGO_LABELS[m.tipo]+' $'+fmtNum(m.monto); }).join(' + ') : '';
            return '<div style="font-size:11px;color:#2E7D32;padding:2px 0">✓ '+p.fecha+' — Pagué $'+fmtNum(p.monto)+(detalle?' ('+detalle+')':'')+'</div>';
          }).join('')
          +'</div>';
      }
      card.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center">'
        +'<div><div style="font-size:14px;font-weight:700">'+c.fecha+' - '+c.hora+(c.foto?' 📷':'')+'</div>'
        +'<div style="font-size:12px;color:#aaa;margin-top:2px">'+(c.items || []).length+' producto(s)</div>'
        +'<div style="margin-top:4px"><span style="font-size:13px;padding:3px 9px;border-radius:10px;font-weight:500;'+(c.tipo==='credito'?'background:#FFF8E1;color:#E65100':'background:#E8F5E9;color:#2E7D32')+'">'+(c.tipo==='credito'?'a credito':'contado')+'</span></div></div>'
        +'<div style="text-align:right"><div style="font-size:18px;font-weight:700;color:#1565C0">$'+fmtNum(c.total)+'</div>'
        +(c.tipo==='credito'?'<div style="font-size:12px;color:'+(esSaldoPendiente(saldo)?'#C62828':'#2E7D32')+'">'+(esSaldoPendiente(saldo)?'Debo: $'+fmtNum(saldo):'Pagado')+'</div>':'')
        +'</div></div>'
        +pagosHtml;
      card.onclick = (function(compra){ return function(){ verFacturaCompra(compra, id); }; })(c);
      el.appendChild(card);
  });

  document.getElementById('sup-lista-wrap').style.display = 'none';
  document.getElementById('sup-perfil-wrap').style.display = 'block';
}

function eliminarSup(id){
  if(!confirm('¿Eliminar este suplidor? Esto no elimina las compras ya registradas.')) return;
  suplidores = LS('nsup', []);
  suplidores = suplidores.filter(function(x){ return String(x.id)!==String(id); });
  SS('nsup', suplidores);
  document.getElementById('sup-lista-wrap').style.display = 'block';
  document.getElementById('sup-perfil-wrap').style.display = 'none';
  renderSup('');
}

function toggleSubtipoTienda(selectId, wrapId){
  var sel = document.getElementById(selectId);
  var wrap = document.getElementById(wrapId);
  if(!sel || !wrap) return;
  wrap.style.display = sel.value === 'Tienda' ? 'block' : 'none';
}

function toggleTipoNegocioOtro(selectId, otroInputId){
  var sel = document.getElementById(selectId);
  var otro = document.getElementById(otroInputId);
  if(!sel || !otro) return;
  otro.style.display = sel.value === 'Otro' ? 'block' : 'none';
  if(sel.value !== 'Otro') otro.value = '';
}

function subtipoTiendaLabel(c){
  // Compatibilidad: registros viejos guardaban MeatMarket/Otro directamente en tipoNegocio
  var st = c.subtipoTienda || (c.tipoNegocio==='MeatMarket' ? 'MeatMarket' : (c.tipoNegocio==='Otro' ? 'Otro' : 'GroceryStore'));
  if(st==='MeatMarket') return '🥩 Meat Market';
  if(st==='SuperMarket') return '🏬 Super Market';
  if(st==='Otro') return '✏️ '+(c.subtipoTiendaOtro||c.tipoNegocioOtro||'Otro');
  return '🛒 Grocery Store';
}

function etiquetaTipoNegocio(c){
  if(!c.tipoNegocio || c.tipoNegocio==='Barberia') return '✂️ Barbería';
  return '🏪 Tienda — '+subtipoTiendaLabel(c);
}

function coincideBusqueda(texto, consulta){
  if(!consulta) return true; // sin búsqueda, todo coincide
  // Quitar acentos y pasar a minúsculas, tanto del texto como de lo buscado
  var t = (texto||'').toLowerCase()
    .replace(/á/g,'a').replace(/é/g,'e').replace(/í/g,'i').replace(/ó/g,'o').replace(/ú/g,'u').replace(/ñ/g,'n');
  var c = (consulta||'').toLowerCase()
    .replace(/á/g,'a').replace(/é/g,'e').replace(/í/g,'i').replace(/ó/g,'o').replace(/ú/g,'u').replace(/ñ/g,'n');
  // Partir lo buscado en palabras sueltas (ignora espacios de más)
  var palabras = c.split(/\s+/).filter(function(p){ return p.length > 0; });
  if(!palabras.length) return true;
  // Cada palabra debe estar en alguna parte del texto (en cualquier orden)
  return palabras.every(function(p){ return apareceComoPalabra(t, p); });
}

function renderCl(q){
  clientes = LS('ncl', []);
  // Actualizar contadores
  var totalCl = clientes.length;
  var barberiasUnicas = {};
  clientes.forEach(function(c){
    if(c.negocio && c.negocio.trim()){
      barberiasUnicas[c.negocio.trim().toUpperCase()] = true;
    }
  });
  var totalBarberias = Object.keys(barberiasUnicas).length;
  var elTotalCl = document.getElementById('cl-total-num');
  var elTotalBarb = document.getElementById('cl-barberias-num');
  if(elTotalCl) elTotalCl.textContent = totalCl;
  if(elTotalBarb) elTotalBarb.textContent = totalBarberias;

  // ---- Filtro por tipo de negocio, con conteo de cada uno (simplificado a Barberia/Tienda) ----
  var conteoTipos = { Barberia: 0, Tienda: 0 };
  clientes.forEach(function(c){
    var t = (!c.tipoNegocio || c.tipoNegocio==='Barberia') ? 'Barberia' : 'Tienda';
    conteoTipos[t]++;
  });
  if(!window._clFiltroTipo) window._clFiltroTipo = 'todos';
  var elFiltros = document.getElementById('cl-filtro-tipos');
  if(elFiltros){
    var tabsInfo = [
      { key:'todos', label:'Todos', count: totalCl },
      { key:'Barberia', label:'✂️ Barberías', count: conteoTipos.Barberia||0 },
      { key:'Tienda', label:'🏪 Tiendas', count: conteoTipos.Tienda||0 }
    ].filter(function(t2){ return t2.key==='todos' || t2.count>0; });
    elFiltros.innerHTML = tabsInfo.map(function(t2){
      var activo = window._clFiltroTipo === t2.key;
      return '<button onclick="window._clFiltroTipo=\''+t2.key+'\';renderCl(document.getElementById(\'cl-buscar-input\')?document.getElementById(\'cl-buscar-input\').value:\'\')" style="flex-shrink:0;padding:7px 12px;border-radius:20px;border:none;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;background:'+(activo?'var(--nbs-gold)':'#F0F0F2')+';color:'+(activo?'white':'var(--nbs-ink)')+'">'+t2.label+' ('+t2.count+')</button>';
    }).join('');
  }

  var el=document.getElementById('lcl');el.innerHTML='';
  var list = q ? filtrarPorBusqueda(clientes, q, function(c){
    return (c.nombre||'')+' '+(c.apellido||'')+' '+(c.negocio||'')+' '+(c.apodo||'')+' '+(c.tel||'')+' '+(c.dir||'')+' '+(c.ciudad||'')+' '+(c.estado||'')+' '+(c.zip||'')+' '+(c.contacto||'')+' '+(c.contactoApodo||'')+' '+(c.contactoTel||'');
  }) : clientes;
  if(window._clFiltroTipo && window._clFiltroTipo !== 'todos'){
    list = list.filter(function(c){ var t2=(!c.tipoNegocio||c.tipoNegocio==='Barberia')?'Barberia':'Tienda'; return t2 === window._clFiltroTipo; });
  }
  if(!list.length){el.innerHTML='<p style="color:#aaa;font-size:13px;text-align:center;padding:20px">Sin clientes</p>';return;}
  ventas = LS('nv',[]);
  list.forEach(function(c){
    var ventasC = ventas.filter(function(v){ return String(v.cid)===String(c.id) && v.tipo==='credito' && !v.cancelada; });
    var totalCred = ventasC.reduce(function(s,v){ return s+v.total; },0);
    var totalPag = ventasC.reduce(function(s,v){
      var pf = v.pagosFactura ? (v.pagosFactura || []).filter(function(p){return typeof p.monto==='number';}).reduce(function(sp,p){return sp+p.monto;},0) : 0;
      return s+pf;
    },0);
    var balance = Math.max(0, totalCred - totalPag);
    var creditoCl = c.creditoAFavor || 0; // 24 jul, pedido por Sensei: mostrar SIEMPRE el credito a favor tambien
    var d=document.createElement('div');d.className='clrow';
    var direccionCorta = [c.dir, c.ciudad].filter(Boolean).join(', ');
    d.innerHTML=(c.foto ? '<div style="width:44px;height:44px;border-radius:50%;overflow:hidden;flex-shrink:0"><img src="'+c.foto+'" style="width:100%;height:100%;object-fit:cover"></div>' : '<div class="av">'+ini(c.nombre,c.apellido)+'</div>')
      +'<div style="flex:1">'
      // 🔢 EL CÓDIGO DEL CLIENTE, ARRIBA DEL NOMBRE. -17 ago-
      +(codigoDeCliente(c)
          ? '<div style="font-size:10px;font-weight:900;color:#3949AB;letter-spacing:1.2px;'
            + 'line-height:1;margin-bottom:2px">CLIENTE ' + codigoDeCliente(c) + '</div>'
          : '')
      +'<div style="font-size:18px;font-weight:900;color:var(--nbs-ink)">'+escaparHtml(((c.nombre||'')+' '+(c.apellido||'')).replace(/\s+/g,' ').trim())+(c.apodo?' <span style="color:var(--nbs-gold-dark);font-weight:700">"'+escaparHtml(c.apodo)+'"</span>':'')+(c.vipActivo?' <span style="color:var(--nbs-red-text);font-size:13px">★</span>':'')+'</div>'
      +'<div style="font-size:12px;color:var(--nbs-muted)">'+escaparHtml(c.negocio||'Cliente')+' · '+escaparHtml(c.tel||'Sin tel.')+'</div>'
      +(direccionCorta ? '<div style="font-size:11px;color:var(--nbs-muted-2);margin-top:1px">📍 '+escaparHtml(direccionCorta)+'</div>' : '')
      +(balance>0.01 ? '<div style="font-size:12px;font-weight:700;margin-top:2px;color:var(--nbs-red-text)">Balance: $'+fmtNum(balance)+'</div>' : '')
      +(creditoCl>0.01 ? '<div style="font-size:12px;font-weight:700;margin-top:2px;color:#E65100">💰 ($'+fmtNum(creditoCl)+') a favor</div>' : '')
      +(balance<=0.01 && creditoCl<=0.01 ? '<div style="font-size:12px;font-weight:700;margin-top:2px;color:var(--nbs-muted-2)">Balance: $0.00</div>' : '')
      +'</div>'
      +'<span style="color:#ddd;font-size:20px">›</span>';
    d.onclick=(function(cid){return function(){verCl(cid);};})(c.id);
    el.appendChild(d);
  });
}

var iV = [];
var PRODS = [];
var productos = [];

function margenDeCasa(){
  loadProds();
  var margenes = [];
  productos.forEach(function(p){
    var c = parseFloat(p.costo) || 0, v = parseFloat(p.precio) || 0;
    if(c > 0.005 && v > c) margenes.push((v - c) / v);
  });
  if(!margenes.length) return 0.40;                 // sin datos: 40%, lo tipico del ramo
  margenes.sort(function(a,b){ return a-b; });
  return margenes[Math.floor(margenes.length / 2)]; // la mediana, no el promedio:
                                                    // un producto raro no la mueve
}

function revisarIntegridad(){
  var V = LS('nv', []), C = LS('ncl', []), CO = LS('nc', []), G = LS('ngastos', []);
  var problemas = [], avisos = [], oks = [];

  // ── 1. IDs repetidos en ventas ──
  var idsV = {}, dupV = 0;
  V.forEach(function(v){ var k=String(v.id); if(idsV[k]) dupV++; idsV[k]=1; });
  if(dupV) problemas.push('Hay '+dupV+' factura(s) con el mismo numero. Eso puede hacer que un pago se aplique a la factura equivocada.');
  else oks.push('Ninguna factura repetida ('+V.length+' revisadas)');

  // ── 2. IDs repetidos en clientes ──
  var idsC = {}, dupC = 0;
  C.forEach(function(c){ var k=String(c.id); if(idsC[k]) dupC++; idsC[k]=1; });
  if(dupC) problemas.push('Hay '+dupC+' cliente(s) con el mismo numero interno.');
  else oks.push('Ningun cliente repetido ('+C.length+' revisados)');

  // ── 3. Ventas de clientes que ya no existen ──
  var huerfanas = V.filter(function(v){ return v.cid && !idsC[String(v.cid)]; });
  if(huerfanas.length){
    var montoH = huerfanas.reduce(function(s,v){ return s+(v.total||0); },0);
    avisos.push(huerfanas.length+' venta(s) de clientes que ya borraste, por $'+fmtNum(montoH)+'. Aparecen en Cuentas por Cobrar pero el cliente no esta en la lista. Se limpian desde el menu: "Limpiar ventas huerfanas".');
  } else oks.push('Todas las ventas tienen su cliente');

  // ── 4. Pagos que suman MAS que la factura ──
  var sobrepago = [];
  V.forEach(function(v){
    if(v.tipo!=='credito' || !v.pagosFactura) return;
    var pag = (v.pagosFactura || []).reduce(function(s,p){ return s+(typeof p.monto==='number'?p.monto:0); },0);
    if(pag > (v.total||0) + 0.01) sobrepago.push({id:v.id, total:v.total, pag:pag, cid:v.cid, cn:v.cn});
  });
  if(sobrepago.length){
    problemas.push(sobrepago.length+' factura(s) con MAS pagos que su total. Se pueden arreglar de un toque abajo -mueve el sobrante a crédito a favor del cliente-.');
  } else oks.push('Ninguna factura tiene mas pagos que su total');

  // ── 5. Montos negativos o raros ──
  var raros = 0;
  V.forEach(function(v){
    if(typeof v.total !== 'number' || isNaN(v.total) || v.total < 0) raros++;
    (v.pagosFactura||[]).forEach(function(p){
      if(typeof p.monto !== 'number' || isNaN(p.monto)) raros++;
      else if(p.monto < 0 && !p.esDevolucion) raros++;
    });
  });
  if(raros) problemas.push(raros+' monto(s) invalidos (negativos o dañados) en ventas o pagos.');
  else oks.push('Todos los montos son numeros validos');

  // ── 6. Pagos sin fecha ──
  var sinFecha = 0;
  V.forEach(function(v){ (v.pagosFactura||[]).forEach(function(p){ if(!p.fecha) sinFecha++; }); });
  if(sinFecha) avisos.push(sinFecha+' pago(s) sin fecha. No van a contar bien en el resumen por fechas.');
  else oks.push('Todos los pagos tienen fecha');

  // ── 7. Ventas sin fecha ──
  var vSinFecha = V.filter(function(v){ return !v.fecha; }).length;
  if(vSinFecha) avisos.push(vSinFecha+' venta(s) sin fecha.');
  else oks.push('Todas las ventas tienen fecha');

  // ── 8. Identificador unico de pago (el arreglo del 22 jul) ──
  var pidsRep = 0, vistos = {}, totalPagos = 0, sinPid = 0;
  V.forEach(function(v){
    (v.pagosFactura||[]).forEach(function(p){
      totalPagos++;
      if(!p.pid){ sinPid++; return; }
      if(vistos[p.pid]) pidsRep++;
      vistos[p.pid] = 1;
    });
  });
  if(pidsRep) problemas.push(pidsRep+' pago(s) guardados dos veces (mismo identificador).');
  else oks.push(totalPagos+' pagos revisados, ninguno guardado dos veces');
  if(sinPid) avisos.push(sinPid+' pago(s) viejos sin identificador. No es un error: son de antes del arreglo del 22 de julio y estan protegidos, nunca se borran.');

  // ── 9. Cuadre general del dinero ──
  var totalVendido = 0, totalCobrado = 0, totalPorCobrar = 0;
  V.forEach(function(v){
    if(v.cancelada) return;
    totalVendido += (v.total||0);
    if(v.tipo === 'contado'){
      var _ci = cobradoYDebeDe(v);
      totalCobrado += _ci.cobrado;
      totalPorCobrar += _ci.debe;
      return;
    }
    var pag = (v.pagosFactura||[]).reduce(function(s,p){ return s+(typeof p.monto==='number'&&!p.esDevolucion?p.monto:0); },0);
    totalCobrado += pag;
    totalPorCobrar += Math.max(0, (v.total||0) - pag);
  });
  var descuadre = Math.abs(totalVendido - (totalCobrado + totalPorCobrar));
  if(descuadre > 0.05) problemas.push('El dinero no cuadra: vendido $'+fmtNum(totalVendido)+' pero cobrado + por cobrar da $'+fmtNum(totalCobrado+totalPorCobrar)+'. Diferencia de $'+fmtNum(descuadre)+'.');
  else oks.push('El dinero CUADRA: vendido $'+fmtNum(totalVendido)+' = cobrado $'+fmtNum(totalCobrado)+' + por cobrar $'+fmtNum(totalPorCobrar));

  // ── 10. ¿El telefono puede guardar? ──
  var puedeGuardar = true;
  try{ localStorage.setItem('nbs_chk_'+Date.now(), '1'); localStorage.removeItem('nbs_chk_'+Date.now()); }
  catch(e){ puedeGuardar = false; }
  if(!puedeGuardar) problemas.push('EL TELEFONO NO PUEDE GUARDAR. Libera espacio YA: lo que registres no se va a guardar.');
  else oks.push('El telefono puede guardar sin problema');

  // ── 11. Cuanto espacio ocupa ──
  var bytes = 0;
  try{ for(var k in localStorage){ if(localStorage.hasOwnProperty(k)) bytes += (localStorage[k]||'').length; } }catch(e){}
  var mb = (bytes/1048576).toFixed(2);
  if(bytes > 4.5*1048576) avisos.push('Tus datos ocupan '+mb+' MB. El limite anda por 5 MB. Conviene bajar un respaldo y borrar copias viejas.');
  else oks.push('Espacio usado: '+mb+' MB (hay de sobra)');

  // ── Armar el reporte ──
  // ═══ REVISIONES AGREGADAS EL 28 JUL ═══
  // Salieron de auditar los datos REALES de Sensei. Antes la revision solo miraba las
  // ventas y los clientes: las compras, las devoluciones, el inventario y la ganancia
  // no se revisaban en absoluto.

  // ── FECHAS IMPOSIBLES (29 jul) ──
  // Se encontraron 4 pagos de Sensei escritos como '24/6/2026' en vez de '6/24/2026'.
  // JavaScript lee ese 24 como el MES y rueda la fecha a diciembre de 2027. O sea que
  // ese dinero queda archivado 18 meses en el futuro y no sale en NINGUN reporte que el
  // mire. No es un error de la app: es un dato mal escrito, pero nadie lo avisaba.
  var fechasMalas = [];
  V.forEach(function(v){
    function revisarFecha(f, dondeDice, monto){
      if(!f) return;
      var pt = String(f).split('/');
      if(pt.length !== 3) return;
      var primero = parseInt(pt[0], 10);
      if(primero > 12){
        fechasMalas.push({ id: v.id, cn: v.cn, fecha: String(f), donde: dondeDice, monto: monto || 0 });
      }
    }
    revisarFecha(v.fecha, 'la factura', v.total);
    (v.pagosFactura || []).forEach(function(p){ revisarFecha(p.fecha, 'un pago', p.monto); });
  });
  if(fechasMalas.length){
    var montoMalo = fechasMalas.reduce(function(a,x){ return a + (parseFloat(x.monto)||0); }, 0);
    problemas.push(fechasMalas.length + ' fecha(s) escritas al reves -dia primero en vez del mes-, por $'
      + fmtNum(montoMalo) + '. La app las lee como si fueran de anos futuros, asi que ese dinero NO sale en tus reportes. '
      + fechasMalas.slice(0,4).map(function(x){
          return (x.cn || 'sin nombre') + ': ' + x.fecha + ' en ' + x.donde;
        }).join(' · ')
      + (fechasMalas.length > 4 ? ' y ' + (fechasMalas.length-4) + ' mas' : '')
      + '. Corrigelas con el lapiz ✏️ del pago.');
  } else oks.push('Todas las fechas estan bien escritas');

  // ── Las COMPRAS ──
  var COMP = LS('nc', []);
  var SUP  = LS('nsup', []);
  var idsSup = {};
  SUP.forEach(function(x){ idsSup[String(x.id)] = true; });

  var compSinSup = COMP.filter(function(c){ return c.sid && !idsSup[String(c.sid)]; });
  if(compSinSup.length){
    var mSinSup = compSinSup.reduce(function(a,c){ return a + (parseFloat(c.total)||0); }, 0);
    avisos.push(compSinSup.length + ' compra(s) de suplidores que ya borraste, por $' + fmtNum(mSinSup) + '.');
  } else oks.push('Todas las compras tienen su suplidor (' + COMP.length + ' revisadas)');

  var compPagadasDeMas = COMP.filter(function(c){
    var pg = (c.pagos || []).reduce(function(a,p){ return a + (parseFloat(p.monto)||0); }, 0);
    return pg - (parseFloat(c.total)||0) > 0.005;
  });
  if(compPagadasDeMas.length){
    problemas.push(compPagadasDeMas.length + ' compra(s) donde pagaste MAS de lo que costaron. Revisa esos pagos.');
  } else oks.push('Ninguna compra pagada de mas');

  var compDescuadre = COMP.filter(function(c){
    var items = c.items || [];
    if(!items.length) return false;
    var suma = items.reduce(function(a,i){ return a + (parseFloat(i.cant)||0) * (parseFloat(i.costo)||0); }, 0);
    // Los descuentos se SUMAN de vuelta porque bajaron el total pero no salieron de los
    // productos. Sin esta linea, cada compra con descuento gritaria "no suman el total". -19 ago-
    var desc = (c.descuentos || []).reduce(function(a,d){ return a + (parseFloat(d.monto)||0); }, 0);
    var tot  = (parseFloat(c.total)||0) - (parseFloat(c.envio)||0) - (parseFloat(c.cargoTarjeta)||0) + desc;
    return Math.abs(suma - tot) > 0.05;
  });
  if(compDescuadre.length){
    problemas.push(compDescuadre.length + ' compra(s) donde los productos no suman el total de la compra.');
  } else if(COMP.length) oks.push('En todas las compras, los productos suman el total');

  // ── Las DEVOLUCIONES ──
  var DEV = LS('ndevoluciones', []);
  var idsVenta = {};
  V.forEach(function(v){ idsVenta[String(v.id)] = true; });
  var devSinVenta = DEV.filter(function(x){ return x.vid && !idsVenta[String(x.vid)]; });
  if(devSinVenta.length){
    avisos.push(devSinVenta.length + ' devolucion(es) que apuntan a facturas que ya no existen.');
  } else if(DEV.length) oks.push('Todas las devoluciones tienen su factura (' + DEV.length + ' revisadas)');

  // ── El INVENTARIO ──
  loadProds();
  var stockNeg = productos.filter(function(p){ return (parseFloat(p.stock)||0) < 0; });
  if(stockNeg.length){
    avisos.push(stockNeg.length + ' producto(s) con existencia NEGATIVA. Significa que vendiste mas de lo que la app creia que tenias: '
      + stockNeg.slice(0,3).map(function(p){ return p.nombre + ' (' + (parseFloat(p.stock)||0) + ')'; }).join(', ')
      + (stockNeg.length > 3 ? ' y ' + (stockNeg.length-3) + ' mas' : '') + '.');
  } else oks.push('Ningun producto con existencia negativa');

  var bajoCosto = productos.filter(function(p){
    var pr = parseFloat(p.precio)||0, co = parseFloat(p.costo)||0;
    return pr > 0 && co > 0 && pr < co;
  });
  if(bajoCosto.length){
    problemas.push(bajoCosto.length + ' producto(s) que vendes MAS BARATO de lo que te cuestan: '
      + bajoCosto.slice(0,3).map(function(p){ return p.nombre; }).join(', ') + '.');
  } else oks.push('Ningun producto se vende por debajo de su costo');

  // ── La GANANCIA de cada venta ──
  // OJO IMPORTANTE: los "Balance inicial traido de sistema anterior" NO son ventas, son
  // deudas que Sensei paso a mano al cambiarse de app. Su ganancia es CERO y esta BIEN
  // asi. Si se "arreglaran" se le inventaria una ganancia que nunca existio. Se saltan
  // siempre. -28 jul-
  window._ganMal = [];
  V.forEach(function(v){
    if(v.cancelada) return;
    var items = v.items || [];
    if(!items.length) return;
    if(esBalanceInicial(v)) return;                       // nunca se tocan
    // Con la formula UNICA, que si resta el descuento de la factura. Antes esta cuenta
    // lo ignoraba y marcaba como "mal" ventas que estaban bien. -8 ago-
    if(!sePuedeCalcularGanancia(v)) return;
    var calc = gananciaDeVenta(v);
    var g = parseFloat(v.ganancia) || 0;
    if(Math.abs(calc - g) > 0.05) window._ganMal.push({ id: v.id, cn: v.cn, fecha: v.fecha, dice: g, real: calc });
  });
  if(window._ganMal.length){
    var difG = window._ganMal.reduce(function(a,x){ return a + (x.real - x.dice); }, 0);
    problemas.push(window._ganMal.length + ' venta(s) donde la ganancia guardada no coincide con sus productos. '
      + 'Tus reportes de ganancia estan ' + (difG > 0 ? 'por DEBAJO' : 'por ENCIMA') + ' de lo real en $'
      + fmtNum(Math.abs(difG)) + '. Se pueden arreglar de un toque abajo.');
  } else oks.push('La ganancia guardada cuadra en todas las ventas');



  var h = '<h3 style="font-size:21px;font-weight:800;color:#1a237e;margin:0 0 4px">\ud83e\ude7a Revisi\u00f3n de integridad</h3>'
    + '<p style="font-size:14px;color:#666;margin:6px 0 14px">Revis\u00e9 '+V.length+' ventas, '+C.length+' clientes, '+CO.length+' compras y '+G.length+' gastos. No toqu\u00e9 nada: solo revis\u00e9.</p>';

  if(problemas.length){
    h += '<div style="background:#FDECEA;border:2px solid #C62828;border-radius:12px;padding:14px;margin-bottom:12px">'
      + '<div style="font-size:16px;font-weight:900;color:#C62828;margin-bottom:8px">\u26a0\ufe0f HAY QUE ARREGLAR ('+problemas.length+')</div>';
    problemas.forEach(function(x){ h += '<div style="font-size:15px;line-height:1.5;color:#7f1d1d;margin-bottom:8px">\u2022 '+escaparHtml(x)+'</div>'; });
    h += '</div>';
    // ── Botones de arreglo automatico para las facturas con sobrepago (25 jul, pedido por Sensei) ──
    // Estas son de ANTES del 24 jul, cuando el sobrante de un pago se quedaba metido en la
    // misma factura en vez de irse a credito a favor. Un toque lo corrige, con huella de por medio.
    if(sobrepago.length){
      h += '<div style="background:#fff;border:2px solid #E65100;border-radius:12px;padding:14px;margin-bottom:12px">'
        + '<div style="font-size:14px;font-weight:900;color:#E65100;margin-bottom:8px">\ud83d\udd27 ARREGLAR SOBREPAGOS ('+sobrepago.length+')</div>';
      sobrepago.forEach(function(sp){
        var clSp = C.find(function(c){ return String(c.id)===String(sp.cid); });
        var nombreSp = clSp ? nombreCl(clSp) : (sp.cn||'Cliente');
        var excesoSp = sp.pag - sp.total;
        h += '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 0;border-top:1px solid #FFE0B2">'
          + '<div style="font-size:13px;color:#555"><b>'+escaparHtml(nombreSp)+'</b><br>Factura #'+sp.id+' \u2014 $'+fmtNum(sp.total)+' con $'+fmtNum(sp.pag)+' pagados (sobran $'+fmtNum(excesoSp)+')</div>'
          + '<button onclick="arreglarSobrepagoFactura(\''+sp.id+'\')" style="flex-shrink:0;padding:9px 12px;background:#E65100;color:white;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">Arreglar</button>'
          + '</div>';
      });
      h += '</div>';
    }
  } else {
    h += '<div style="background:#E8F5E9;border:2px solid #2E7D32;border-radius:12px;padding:16px;margin-bottom:12px;text-align:center">'
      + '<div style="font-size:38px">\u2705</div>'
      + '<div style="font-size:18px;font-weight:900;color:#2E7D32;margin-top:4px">TODO EN ORDEN</div>'
      + '<div style="font-size:14px;color:#2E7D32;margin-top:4px">No encontr\u00e9 ning\u00fan problema con tus datos.</div></div>';
  }

  if(avisos.length){
    h += '<div style="background:#FFF8E1;border:1px solid #F9A825;border-radius:12px;padding:14px;margin-bottom:12px">'
      + '<div style="font-size:15px;font-weight:900;color:#8a6d00;margin-bottom:8px">\ud83d\udcdd PARA QUE LO SEPAS ('+avisos.length+')</div>';
    avisos.forEach(function(x){ h += '<div style="font-size:14.5px;line-height:1.5;color:#6b5500;margin-bottom:8px">\u2022 '+escaparHtml(x)+'</div>'; });
    h += '</div>';
  }

  // Boton para arreglar las ganancias mal guardadas -28 jul-
  if(window._ganMal && window._ganMal.length){
    h += '<div style="background:#E8F5E9;border:2px solid #2E7D32;border-radius:12px;padding:14px;margin-bottom:12px">'
      + '<div style="font-size:15px;font-weight:900;color:#2E7D32;margin-bottom:6px">\ud83d\udd27 ARREGLAR LAS GANANCIAS</div>'
      + '<div style="font-size:13px;color:#33691E;line-height:1.45;margin-bottom:10px">'
      + 'Se van a recalcular ' + window._ganMal.length + ' venta(s) usando el precio y el costo que YA estan guardados en cada renglon. '
      + 'No se inventa ningun numero.<br><br>'
      + '<b>Los "Balance inicial traido de sistema anterior" NO se tocan</b> — esos no son ventas y su ganancia cero es correcta.'
      + '</div>';
    window._ganMal.slice(0, 8).forEach(function(x){
      h += '<div style="font-size:12.5px;color:#33691E;margin-bottom:3px">\u2022 ' + escaparHtml(String(x.cn||'')).slice(0,26)
        + ' ' + escaparHtml(String(x.fecha||'')) + ': dice $' + fmtNum(x.dice) + ' \u2192 $' + fmtNum(x.real) + '</div>';
    });
    if(window._ganMal.length > 8) h += '<div style="font-size:12px;color:#558B2F">y ' + (window._ganMal.length-8) + ' mas...</div>';
    h += '<button onclick="arreglarGanancias()" style="width:100%;margin-top:10px;padding:13px;border:none;border-radius:10px;background:#2E7D32;color:#fff;font-weight:800;font-size:13.5px;cursor:pointer">Arreglar las ' + window._ganMal.length + ' ganancias</button>'
      + '</div>';
  }

  h += '<div style="background:#F4F6FB;border:1px solid #d9dcec;border-radius:12px;padding:14px">'
    + '<div style="font-size:14px;font-weight:900;color:#1a237e;margin-bottom:8px">\u2705 REVISADO Y CORRECTO ('+oks.length+')</div>';
  oks.forEach(function(x){ h += '<div style="font-size:13.5px;line-height:1.5;color:#444;margin-bottom:5px">\u2022 '+escaparHtml(x)+'</div>'; });
  h += '</div>';


  mostrarReporteIntegridad(h);
}

// Reconoce los renglones que NO son una venta de verdad, sino la deuda que Sensei paso a
// mano cuando se cambio de la app vieja a NBS2. Esos van con ganancia CERO a proposito.
// Recalcula la ganancia de las ventas donde no cuadra, usando el precio y el costo que
// YA estan guardados en cada renglon de esa misma venta. No inventa nada y NUNCA toca
// los balances iniciales. Pide huella, como toda accion de dinero. -28 jul-
function arreglarGanancias(){
  var lista = window._ganMal || [];
  if(!lista.length){ avisoGrande('No hay ganancias que arreglar.'); return; }

  var difTotal = lista.reduce(function(a,x){ return a + (x.real - x.dice); }, 0);
  var msg = 'Se van a recalcular ' + lista.length + ' venta(s).\n\n'
          + 'Tu ganancia total cambiaria en $' + fmtNum(Math.abs(difTotal))
          + (difTotal > 0 ? ' hacia ARRIBA.' : ' hacia ABAJO.') + '\n\n'
          + 'Los balances iniciales NO se tocan.\n\n¿Seguir?';
  if(!confirm(msg)) return;

  protegerConHuella(function(){
    var V = LS('nv', []);
    var mapa = {};
    lista.forEach(function(x){ mapa[String(x.id)] = x.real; });
    var cambiadas = 0;
    V.forEach(function(v){
      var nuevo = mapa[String(v.id)];
      if(nuevo === undefined) return;
      if(esBalanceInicial(v)) return;        // red de seguridad, por si acaso
      v.ganancia = Math.round(nuevo * 100) / 100;
      cambiadas++;
    });
    ventas = V;
    SS('nv', ventas);
    avisoGrande('\u2713 Se arreglaron ' + cambiadas + ' ganancia(s).\n\nTus reportes ya muestran la ganancia real.', function(){
      revisarIntegridad();
    });
  });
}

function esBalanceInicial(v){
  return (v.items || []).some(function(i){
    return String(i.nombre || '').toLowerCase().indexOf('balance inicial') >= 0;
  });
}

// ═══ ARREGLAR UN SOBREPAGO VIEJO — mueve el sobrante a credito a favor (25 jul) ═══
function arreglarSobrepagoFactura(vid){
  ventas = LS('nv', []);
  var v = ventas.find(function(x){ return String(x.id) === String(vid); });
  if(!v || !v.pagosFactura){ alert('No encontré esa factura.'); return; }
  var pagado = (v.pagosFactura || []).reduce(function(s,p){ return s+(typeof p.monto==='number'?p.monto:0); },0);
  var exceso = pagado - (v.total||0);
  if(exceso <= 0.01){ avisoGrande('Esta factura ya no tiene sobrepago.', function(){ revisarIntegridad(); }); return; }

  clientes = LS('ncl', []);
  var cl = clientes.find(function(c){ return String(c.id)===String(v.cid); });
  var nombreCliente = cl ? nombreCl(cl) : (v.cn||'este cliente');

  var msj = 'Esta factura tiene $'+fmtNum(exceso)+' de más.\n\n'
    + 'Se va a hacer esto:\n'
    + '1. Bajar el pago de esta factura a su total exacto ($'+fmtNum(v.total)+')\n'
    + '2. Guardar $'+fmtNum(exceso)+' como crédito a favor de '+nombreCliente+'\n\n'
    + '¿Aplicar la corrección?';
  if(!confirm(msj)) return;

  if(typeof protegerConHuella === 'function'){
    protegerConHuella(function(){ aplicarArregloSobrepago(vid, exceso); });
  } else {
    aplicarArregloSobrepago(vid, exceso);
  }
}

function aplicarArregloSobrepago(vid, exceso){
  ventas = LS('nv', []);
  var v = ventas.find(function(x){ return String(x.id) === String(vid); });
  if(!v || !v.pagosFactura) return;

  // Recorrer los pagos del mas reciente al mas viejo, reduciendo hasta agotar el exceso.
  // Asi el pago mas antiguo -el original, el que de verdad salda la factura- queda intacto.
  var restante = exceso;
  for(var i=(v.pagosFactura || []).length-1; i>=0 && restante>0.005; i--){
    var p = v.pagosFactura[i];
    if(typeof p.monto !== 'number') continue;
    if(p.monto <= restante + 0.005){
      restante -= p.monto;
      v.pagosFactura.splice(i,1);
    } else {
      p.monto = Math.round((p.monto - restante)*100)/100;
      restante = 0;
    }
  }
  SS('nv', ventas);

  clientes = LS('ncl', []);
  var clIdx = clientes.findIndex(function(c){ return String(c.id)===String(v.cid); });
  if(clIdx >= 0){
    clientes[clIdx].creditoAFavor = Math.round(((clientes[clIdx].creditoAFavor||0) + exceso)*100)/100;
    SS('ncl', clientes);
  }

  cerrarIntegridad();
  avisoGrande('✅ Corregido. $'+fmtNum(exceso)+' se movió a crédito a favor.', function(){ revisarIntegridad(); });
}

// ═══ REPORTE POR CLIENTE: comprado, pagado y ganancia (25 jul, pedido por Sensei) ═══
// "para saber cuales son los clientes que mas me compran y apoyan". Son totales de
// SIEMPRE -no de un rango de fechas-, con dos formas de ordenar que el mismo escoge.
function _datosMargen(){
  loadProds();
  var lista = [];
  productos.forEach(function(p){
    var precio = parseFloat(p.precio) || 0;
    var costo  = parseFloat(p.costo)  || 0;
    if(precio <= 0) return;                 // sin precio no hay margen que calcular
    var gan = Math.round((precio - costo) * 100) / 100;
    lista.push({
      id: p.id, nombre: p.nombre || '', marca: p.marca || '', cat: p.cat || '',
      precio: precio, costo: costo, gan: gan,
      margen: Math.round((gan / precio) * 1000) / 10,
      stock: parseFloat(p.stock) || 0,
      sinCosto: costo <= 0
    });
  });
  return lista;
}

function cambiarOrdenMargen(cual){ _margenOrden = cual; renderMargenProductos(); }
function buscarEnMargen(q){ _margenBusca = q || ''; renderMargenProductos(); }

function _validarHora12(txt){
  txt = String(txt||'').trim().toUpperCase();
  if(!/^\d{1,2}:\d{2}\s?(AM|PM)$/.test(txt)) return null;
  var p = txt.replace(/\s+/g,' ').split(/[: ]/);
  var hh = parseInt(p[0],10), mm = parseInt(p[1],10), ampm = p[2];
  if(hh<1||hh>12||mm<0||mm>59) return null;
  var h24 = hh % 12; if(ampm==='PM') h24 += 12;
  return { h24:h24, mm:mm, texto:(p[0].length<2?'0':'')+p[0]+':'+p[1]+' '+ampm };
}

function configurarRecordatorioIntegridad(){
  var sugeridas = ['09:00 AM', '02:00 PM', '07:00 PM'];
  var horas = [];
  for(var i=0;i<3;i++){
    var cual = (i===0?'primera':i===1?'segunda':'tercera');
    var txt = prompt('¿A qué hora quieres la '+cual+' revisión del día?\n\nEscríbela así:  '+sugeridas[i], sugeridas[i]);
    if(txt === null) return; // cancelo
    var h = _validarHora12(txt);
    if(!h){ avisoGrande('Esa hora no se entiende.\n\nEscríbela así:\n\n   09:00 AM\n   02:30 PM'); return; }
    horas.push(h);
  }
  descargarIcsIntegridad(horas);
}

function descargarIcsIntegridad(horas){
  var manana = new Date(); manana.setDate(manana.getDate()+1);
  var yyyy = manana.getFullYear();
  var mm = String(manana.getMonth()+1).padStart(2,'0');
  var dd = String(manana.getDate()).padStart(2,'0');

  var eventos = horas.map(function(h, idx){
    var hh = String(h.h24).padStart(2,'0');
    var mi = String(h.mm).padStart(2,'0');
    return 'BEGIN:VEVENT\r\n'
      + 'UID:nbs2-integridad-'+idx+'-'+Date.now()+'@nunezbeauty\r\n'
      + 'DTSTAMP:'+yyyy+mm+dd+'T000000Z\r\n'
      + 'DTSTART;TZID=America/New_York:'+yyyy+mm+dd+'T'+hh+mi+'00\r\n'
      + 'DTEND;TZID=America/New_York:'+yyyy+mm+dd+'T'+hh+mi+'00\r\n'
      + 'RRULE:FREQ=DAILY\r\n'
      + 'SUMMARY:🩺 Revisión de Integridad - NBS2\r\n'
      + 'DESCRIPTION:Abre NBS2 y corre la Revisión de Integridad -menú lateral- para asegurarte que tus datos están bien.\r\n'
      + 'BEGIN:VALARM\r\n'
      + 'ACTION:DISPLAY\r\n'
      + 'DESCRIPTION:Revisión de Integridad NBS2\r\n'
      + 'TRIGGER:-PT0M\r\n'
      + 'END:VALARM\r\n'
      + 'END:VEVENT\r\n';
  }).join('');

  var contenido = 'BEGIN:VCALENDAR\r\n'
    + 'VERSION:2.0\r\n'
    + 'PRODID:-//NBS2//Revision de Integridad//ES\r\n'
    + 'CALSCALE:GREGORIAN\r\n'
    + eventos
    + 'END:VCALENDAR\r\n';

  var blob = new Blob([contenido], {type:'text/calendar'});
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'NBS2_Revision_Integridad.ics';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  avisoGrande('📅 Archivo descargado.\n\nÁbrelo una vez para agregarlo a tu calendario. Desde entonces, tu teléfono te avisará solo, todos los días, a las 3 horas que escogiste.');
}

function cerrarIntegridad(){
  var ov = document.getElementById('integridad-ov');
  var caja = document.getElementById('integridad-caja');
  if(ov) ov.style.display = 'none';
  if(caja) caja.style.display = 'none';
}

function dinero(v){
  if(v === null || v === undefined) return 0;
  if(typeof v === 'number') return isFinite(v) ? v : 0;
  var n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
  return isFinite(n) ? n : 0;
}

// Lo mismo pero leyendo la casilla directamente, por id o por el elemento.
function dineroDe(elOid){
  var el = (typeof elOid === 'string') ? document.getElementById(elOid) : elOid;
  return el ? dinero(el.value) : 0;
}

function fmtNum(n){
  if(n===undefined||n===null) return '0.00';
  return parseFloat(n).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});
}

function formatFechaInput(input){
  var val = input.value.replace(/\D/g,'');
  if(val.length >= 3 && val.length <= 4){
    val = val.substring(0,2)+'/'+val.substring(2);
  } else if(val.length >= 5){
    val = val.substring(0,2)+'/'+val.substring(2,4)+'/'+val.substring(4,8);
  }
  input.value = val;
}

// Quita cualquier codigo HTML de un texto antes de guardarlo -para que un nombre, nota, o
// direccion con simbolos como < > nunca se pueda ejecutar como codigo en ningun lugar de la app-.
// Neutraliza cualquier codigo HTML dentro de un texto ANTES de mostrarlo en pantalla.
// limpiarTexto() protege al GUARDAR; esta protege al MOSTRAR. Son dos capas distintas:
// si por lo que sea entra un dato sucio -por ejemplo, de un respaldo viejo o manipulado-,
// esta se asegura de que se vea como texto y nunca se ejecute como codigo.
// ===== BUSQUEDA LISTA -instantanea, sin descargar nada, funciona sin internet- =====
// Antes se buscaba el texto EXACTO y en ese mismo orden, asi que "dorco azul" no encontraba
// "Navaja DORCO Azul", y "silla" no encontraba "Sillon". Ahora:
//   - ignora acentos y simbolos      -> "cafe" encuentra "Café"
//   - el orden no importa            -> "azul dorco" encuentra "Navaja DORCO Azul"
//   - aguanta faltas de ortografia   -> "gumi" encuentra "GUMMY", "silla" encuentra "Sillon"
// Esto sirve igual escribiendo o dictando por voz, ya que el microfono escribe en el buscador.
function normalizarTextoBusqueda(txt){
  return String(txt == null ? '' : txt)
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quita acentos: á->a, ñ->n
    .replace(/[^a-z0-9\s]/g, ' ')                      // quita simbolos: #, -, /, etc
    .replace(/\s+/g, ' ')
    .trim();
}

// ═══════════════════════════════════════════════════════════════════
//  🔍 LA BÚSQUEDA INTELIGENTE Y EL NOMBRE BONITO DE LAS MARCAS
//
//  🔑 SENSEI, 19 ago: hizo una venta del Gummy 700ml el día 12, y al ir a
//  entrar la factura de compra NO LO ENCONTRABA. La causa: la app tenía 23
//  cajas de búsqueda y **casi ninguna** usaba `normalizarTextoBusqueda`.
//  Buscaban a lo bruto, así que "gummy" no encontraba "GUMMY".
//
//  Y las marcas salían TODAS EN MAYÚSCULAS en los menús, porque así están
//  escritas en sus datos.
// ═══════════════════════════════════════════════════════════════════

// 🔑 BUSCA POR PALABRAS SUELTAS, en cualquier orden.
// Así "gel 700" encuentra "Gummy hair gel maximum hold roja 700ml",
// y "700 gel" también. Y da igual mayúsculas, acentos o símbolos.
function coincideBusquedaPalabras(texto, loQueBusca){
  var q = normalizarTextoBusqueda(loQueBusca);
  if(!q) return true;                       // sin nada escrito, todo coincide
  var t = normalizarTextoBusqueda(texto);
  if(!t) return false;
  // Cada palabra que escribió tiene que estar en alguna parte
  var palabras = q.split(' ').filter(function(p){ return p.length > 0; });
  return palabras.every(function(p){ return t.indexOf(p) >= 0; });
}

// La misma, pero mirando varios campos de un producto a la vez
function distanciaTexto(a, b){
  if(a === b) return 0;
  if(!a.length) return b.length;
  if(!b.length) return a.length;
  var fila = [];
  for(var j=0; j<=b.length; j++) fila[j] = j;
  for(var i=1; i<=a.length; i++){
    var anterior = fila[0];
    fila[0] = i;
    for(var k=1; k<=b.length; k++){
      var temp = fila[k];
      fila[k] = Math.min(
        fila[k] + 1,                                       // borrar
        fila[k-1] + 1,                                     // insertar
        anterior + (a[i-1] === b[k-1] ? 0 : 1)             // cambiar
      );
      anterior = temp;
    }
  }
  return fila[b.length];
}

// ¿Que tan parecida es esta palabra que dijiste a esta palabra del producto?
// Devuelve -1 si no se parecen; si se parecen, devuelve QUE TAN LEJOS esta -0 = identica-.
// Es importante devolver la distancia y no solo si/no: sin eso, "silla" le daba el mismo
// puntaje a "Sillon" -1 cambio- que a "Silver" -2 cambios-, y ganaba el equivocado.
function calidadParecido(loQueDijiste, palabraDelProducto){
  if(loQueDijiste.length < 3) return -1; // muy corta: no arriesgar falsos positivos
  if(palabraDelProducto === loQueDijiste) return 0;
  if(palabraDelProducto.indexOf(loQueDijiste) === 0) return 0.5; // "gel" -> "gelatina"
  // Comparar contra el pedazo del mismo largo: "silla" contra "sillo" -de "sillon"-
  var pedazo = palabraDelProducto.substring(0, loQueDijiste.length);
  var tolerancia = loQueDijiste.length <= 4 ? 1 : (loQueDijiste.length <= 7 ? 2 : 3);
  var d = distanciaTexto(loQueDijiste, pedazo);
  return d <= tolerancia ? d : -1;
}

// Devuelve un puntaje: -1 si no coincide, y mientras mas alto mejor coincide -para poder
// poner primero lo que mejor calza-.
// Arreglo del 23 jul: las palabras de 1 o 2 letras (rd, la, el...) solo cuentan
// si EMPIEZAN una palabra del texto, no si estan escondidas en medio de otra.
// Antes "rd" encontraba tambien "Yordy", "Gordon", "Berdecia"... porque se
// buscaba como subcadena en cualquier parte.
function apareceComoPalabra(texto, palabra){
  if(palabra.length <= 2){
    var partes = texto.split(/\s+/);
    for(var i=0;i<partes.length;i++){ if(partes[i].indexOf(palabra)===0) return true; }
    return false;
  }
  return texto.indexOf(palabra) >= 0;
}


// ═══════════════════════════════════════════════════════════════════
//  📖 EL DICCIONARIO DE PALABRAS
//
//  🔑 Sensei buscó "gelatina" y no encontró el "Gummy hair gel 700ml",
//  porque el producto dice GEL y él dice GELATINA. Aquí se traducen sus
//  palabras a las que de verdad están escritas en los nombres.
//
//  ⚠️ ESTA LISTA CRECE. Cuando Sensei diga más palabras, se agregan aquí
//  y funcionan al momento en TODAS las búsquedas de productos.
// ═══════════════════════════════════════════════════════════════════
var PALABRAS_PRODUCTOS = [
  // lo que él dice          →  lo que está en el nombre
  ['gelatina',                 'gel'],
  ['jalea',                    'gel'],
  ['cera',                     'wax'],
  ['pomada',                   'wax pomade'],
  ['perfume',                  'colonia cologne'],
  ['locion',                   'colonia cologne lotion'],
  ['fragancia',                'colonia cologne'],
  ['cuchilla',                 'blade navaja'],
  ['cuchillas',                'blade navaja'],
  ['hojilla',                  'blade navaja'],
  ['hojillas',                 'blade navaja'],
  ['maquina',                  'clipper trimmer machine'],
  ['maquinas',                 'clipper trimmer machine'],
  ['peluquera',                'clipper trimmer'],
  ['recortadora',              'trimmer'],
  ['afeitadora',               'shaver razor'],
  ['espuma',                   'mousse foam'],
  ['talco',                    'powder'],
  ['polvo',                    'powder'],
  ['champu',                   'shampoo'],
  ['champo',                   'shampoo'],
  ['acondicionador',           'conditioner'],
  ['tinte',                    'tint color dye'],
  ['pintura',                  'tint color dye'],
  ['aceite',                   'oil'],
  ['spray',                    'spray splash'],
  ['refrescante',              'cool care'],
  ['enfriador',                'cool care'],
  ['limpiador',                'cleaner clean'],
  ['desinfectante',            'sanitizer disinfect'],
  ['crema',                    'cream'],
  ['barba',                    'beard'],
  ['bigote',                   'mustache beard'],
  ['tijera',                   'scissor shear'],
  ['tijeras',                  'scissor shear'],
  ['peine',                    'comb'],
  ['cepillo',                  'brush'],
  ['capa',                     'cape'],
  ['bata',                     'cape'],
  ['toalla',                   'towel'],
  ['guante',                   'glove'],
  ['guantes',                  'glove'],
  ['cuello',                   'neck strip'],
  ['papel de cuello',          'neck strip'],
  ['secadora',                 'dryer'],
  ['gorro',                    'cap'],
  ['tratamiento',              'treatment'],
  ['mascarilla',               'mask'],
  ['sal marina',               'sea salt'],
  ['agua',                     'water'],
  ['brillo',                   'shine gloss'],
  ['fijador',                  'hold fixative'],
  ['trenza',                   'braid'],
  ['rasuradora',               'shaver razor']
];

// 🔑 CAMBIA SU PALABRA POR LA EQUIVALENTE, DENTRO DE LA MISMA FRASE.
// Así "gelatina 700" se prueba también como "gel 700" — sin perder el 700.
// ⚠️ Antes reemplazaba la frase entera y "gelatina 700" daba 182 resultados. -19 ago-
function ampliarBusqueda(consulta){
  var q = normalizarTextoBusqueda(consulta);
  if(!q) return q;
  var versiones = [];
  for(var i = 0; i < PALABRAS_PRODUCTOS.length; i++){
    var suya = normalizarTextoBusqueda(PALABRAS_PRODUCTOS[i][0]);
    var equiv = normalizarTextoBusqueda(PALABRAS_PRODUCTOS[i][1]);
    if(!suya || !equiv) continue;
    var re = new RegExp('(^| )' + suya.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '( |$)');
    if(!re.test(q)) continue;
    // 🔑 Cada equivalente, puesto EN EL SITIO de su palabra
    equiv.split(' ').forEach(function(e){
      if(!e) return;
      versiones.push(q.replace(re, ' ' + e + ' ').replace(/\s+/g, ' ').trim());
    });
  }
  if(!versiones.length) return q;
  return { original: q, equivalentes: versiones };
}

function puntajeBusqueda(textoProducto, consulta){
  var normProd = normalizarTextoBusqueda(textoProducto);
  var normCons = normalizarTextoBusqueda(consulta);
  if(!normCons) return 0; // sin busqueda: todo pasa

  // 📖 SI USÓ UNA PALABRA SUYA -"gelatina" en vez de "gel"-, se prueba también
  // con la equivalente y se queda con el mejor puntaje de las dos. Si no hay
  // equivalencia, todo sigue EXACTAMENTE igual que antes. -19 ago-
  try {
    var _amp = ampliarBusqueda(consulta);
    if(_amp && _amp.equivalentes && _amp.equivalentes.length){
      var _mejor = _puntajeBusquedaBase(normProd, normCons);
      for(var _k = 0; _k < _amp.equivalentes.length; _k++){
        var _p = _puntajeBusquedaBase(normProd, _amp.equivalentes[_k]);
        if(_p > _mejor) _mejor = _p;
      }
      return _mejor;
    }
  } catch(eAmp){ /* si algo falla, sigue el camino normal */ }

  return _puntajeBusquedaBase(normProd, normCons);
}

// La cuenta de siempre, tal cual estaba. Solo se le cambió el nombre para
// que `puntajeBusqueda` la pueda llamar varias veces. -19 ago-
function _puntajeBusquedaBase(normProd, normCons){
  if(!normCons) return 0;
  // El "calza tal cual" solo aplica si la busqueda completa tiene mas de 2
  // letras -si no, una busqueda de 2 letras encontraria de todo por subcadena-.
  if(normCons.length > 2 && normProd.indexOf(normCons) >= 0) return 100;

  var palabrasConsulta = normCons.split(' ').filter(function(p){ return p; });
  var palabrasProducto = normProd.split(' ').filter(function(p){ return p; });
  var puntaje = 0;

  for(var i=0; i<palabrasConsulta.length; i++){
    var pal = palabrasConsulta[i];
    if(apareceComoPalabra(normProd, pal)){ puntaje += 10; continue; } // la palabra esta, en cualquier orden

    // Si no esta tal cual, buscar la palabra MAS parecida del producto y premiar segun
    // que tan cerca este: mientras menos cambios haga falta, mas puntaje.
    var mejorDistancia = -1;
    for(var j=0; j<palabrasProducto.length; j++){
      var d = calidadParecido(pal, palabrasProducto[j]);
      if(d >= 0 && (mejorDistancia < 0 || d < mejorDistancia)) mejorDistancia = d;
    }
    if(mejorDistancia >= 0){ puntaje += (8 - mejorDistancia * 2); continue; }
    return -1; // esta palabra no aparece de ninguna forma: no es este producto
  }
  return puntaje;
}

// Filtra y ordena una lista poniendo primero lo que mejor coincide
// Devuelve un precio en las formas en que uno lo escribiria al buscar: 12 y 12.00.
// Asi escribir "12" encuentra tanto el precio como los nombres que llevan 12.
function textoDeDinero(v){
  var n = parseFloat(v);
  if(!isFinite(n)) return '';
  var conDec = n.toFixed(2);
  var entero = String(Math.round(n * 100) / 100);
  return entero === conDec ? conDec : (entero + ' ' + conDec);
}

function filtrarPorBusqueda(lista, consulta, sacarTexto){
  if(!consulta || !consulta.trim()) return lista;

  // ═══ BUSCAR POR DINERO EXACTO:  $12  ═══
  // Sensei lo pidio el 4 ago: escribir 12 saca todo lo que tenga un 12 -en el nombre
  // o en el precio-, pero con el signo delante saca SOLO lo que cuesta $12.00 exactos.
  // Hace falta la señal porque el buscador convierte los simbolos en espacios: escribir
  // "12.00" se vuelve "12 00" y no sirve para afinar.
  // Vive aqui adentro para que sirva en TODAS las pantallas de productos de una vez.
  var _c = String(consulta).trim();
  if(_c.charAt(0) === '$'){
    var _n = parseFloat(_c.slice(1).replace(',', '.').replace(/[^0-9.]/g, ''));
    if(!isFinite(_n)) return [];
    // SOLO el precio de venta, no el costo. Mezclar los dos confundia: buscar "$12"
    // traia tambien productos de $20 cuyo COSTO era $12. -4 ago-
    return lista.filter(function(x){
      if(!x || typeof x !== 'object') return false;
      var pr = parseFloat(x.precio);
      return isFinite(pr) && Math.abs(pr - _n) < 0.005;
    });
  }
  var conPuntaje = [];
  for(var i=0; i<lista.length; i++){
    var p = puntajeBusqueda(sacarTexto(lista[i]), consulta);
    if(p >= 0) conPuntaje.push({ item: lista[i], puntaje: p, orden: i });
  }

  // \ud83d\udd0e Con DOS O MAS palabras, manda la frase completa. -29 ago-
  // El puntaje 100 significa justamente eso: el texto lleva la frase tal cual, junta.
  var _palabras = normalizarTextoBusqueda(consulta).split(' ').filter(function(x){ return x; });
  if(_palabras.length >= 2){
    var _exactos = conPuntaje.filter(function(x){ return x.puntaje >= 100; });
    // Solo se afina si HAY alguno con la frase completa; si no, se deja lo de antes
    // para que nunca se quede sin resultados.
    if(_exactos.length) conPuntaje = _exactos;
  }
  // 🔑 EL DESEMPATE. Cuando varios sacan el mismo puntaje —13 productos que
  // todos dicen "gummy"— hay que decidir cuál va arriba. Se premia:
  //   1. que EMPIECE con lo que él escribió
  //   2. que tenga MÁS EXISTENCIA (lo que sí puede vender)
  //   3. y el nombre más corto (más directo)
  // Antes mandaba el orden alfabético y su producto caía al medio. -19 ago-
  var _qn = normalizarTextoBusqueda(consulta);
  conPuntaje.forEach(function(x){
    var t = normalizarTextoBusqueda(sacarTexto(x.item));
    x.extra = 0;
    if(_qn && t.indexOf(_qn) === 0) x.extra += 50;          // empieza igual
    var st = parseFloat(x.item && x.item.stock);
    if(isFinite(st) && st > 0) x.extra += 10;                 // hay en existencia
    x.largo = t.length;
  });
  conPuntaje.sort(function(a,b){
    if(b.puntaje !== a.puntaje) return b.puntaje - a.puntaje;
    if(b.extra !== a.extra) return b.extra - a.extra;
    if(a.largo !== b.largo) return a.largo - b.largo;         // el más corto arriba
    return a.orden - b.orden;
  });
  return conPuntaje.map(function(x){ return x.item; });
}

// ===== LISTA DE RELLENO - para reponer la mercancia de la van =====
// Funciona como armar un pedido, pero para ti mismo: buscas el producto, ves cuanto vendiste
// en el rango de fechas que elijas, y tu decides la cantidad a reponer. Se guarda sola, es
// UNA sola lista que vas reemplazando, y se comparte como imagen -sin precios ni costos-.
var listaRelleno = { desde: null, hasta: null, items: [] };

function fechaISOhace(dias){
  var d = new Date();
  d.setDate(d.getDate() - dias);
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}

function renderCopiasLocales(){
  var el = document.getElementById('copias-locales-lista');
  if(!el) return;
  var copias = leerCopiasLocales();
  if(!copias.length){
    el.innerHTML = '<div class="card" style="text-align:center;color:#bbb;font-size:12px;padding:14px">Todavía no hay ninguna.<br>Se guardará sola cuando lleves 5 facturas.</div>';
    return;
  }
  var html = '';
  copias.forEach(function(c){
    var cn = c.conteo || {};
    var cuando = new Date(c.hora || 0);
    var hoy = new Date();
    var ayer = new Date(hoy); ayer.setDate(hoy.getDate()-1);
    var etiqueta = cuando.toDateString() === hoy.toDateString() ? 'HOY'
                 : (cuando.toDateString() === ayer.toDateString() ? 'AYER' : (c.fecha || ''));
    html += '<div class="card" style="margin-bottom:8px;padding:11px;border-left:4px solid #1a237e">'
      +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">'
      +'<div style="font-size:13px;font-weight:800;color:var(--nbs-ink)">📱 '+etiqueta+' · '+(c.horaTexto||'')+(c.sinCambios?' <span style="font-size:9px;font-weight:600;color:#888">(revisada, sin cambios)</span>':'')+'</div>'
      +'<button onclick="pedirRestaurarLocal(\''+c.hora+'\')" style="background:#E8EAF6;color:#1a237e;border:1px solid #1a237e;border-radius:8px;padding:7px 12px;font-size:12px;font-weight:700;cursor:pointer">🔄 Restaurar</button>'
      +'</div>'
      +'<div style="font-size:11px;color:#888;background:#FAFAFA;border-radius:6px;padding:6px 8px">'
      +'📋 '+(cn.nv||0)+' ventas · 👥 '+(cn.ncl||0)+' clientes · 🧾 '+(cn.nc||0)+' compras'
      +'</div></div>';
  });
  el.innerHTML = html;
}

function pedirRestaurarLocal(hora){
  var copias = leerCopiasLocales();
  var c = copias.find(function(x){ return String(x.hora) === String(hora); });
  if(!c) return;
  var cn = c.conteo || {};
  var ahora = contarTodo();
  var msj = '↺ VOLVER A LA COPIA DEL TELÉFONO\n' + (c.fecha||'') + ' a las ' + (c.horaTexto||'') + '\n\n';
  msj += 'Así quedarían tus datos:\n\n';
  [['nv','Ventas'],['ncl','Clientes'],['nc','Compras']].forEach(function(par){
    var a = ahora[par[0]] || 0, b = cn[par[0]] || 0;
    var f = b > a ? '  ↑ recuperas ' + (b-a) : (b < a ? '  ↓ PIERDES ' + (a-b) : '');
    msj += '   ' + par[1] + ': ' + a + ' → ' + b + f + '\n';
  });
  msj += '\nNota: esta copia NO trae los productos (esos están en las copias de la nube).\n';
  msj += '\n⚠️ Todo lo que hayas hecho DESPUÉS de esa copia se va a perder.\n\n¿Continuar?';
  if(!confirm(msj)) return;

  hacerCopiaLocal().then(function(){          // red de seguridad: guardar como esta AHORA
    return restaurarCopiaLocal(hora);
  }).then(function(partes){
    avisoGrande('✅ Listo. Se restauraron '+partes+' parte(s).\n\nLa app se va a recargar.', function(){ location.reload(); });
  }).catch(function(e){
    console.error(e);
    alert('No se pudo restaurar: ' + (e.message||'error') + '\n\nTus datos NO se tocaron.');
  });
}

// Muestra la lista del teléfono O la de la nube según el botón que toques (pedido por Sensei)
function mostrarTipoCopias(tipo){
  var secTel = document.getElementById('seccion-copias-telefono');
  var secNube = document.getElementById('seccion-copias-nube');
  var btnTel = document.getElementById('btn-copias-tel');
  var btnNube = document.getElementById('btn-copias-nube');
  if(!secTel || !secNube) return;

  if(tipo === 'nube'){
    secTel.style.display = 'none';
    secNube.style.display = 'block';
    if(btnNube){ btnNube.style.background = '#1a237e'; btnNube.style.color = 'white'; }
    if(btnTel){ btnTel.style.background = '#E8EAF6'; btnTel.style.color = '#1a237e'; }
    cargarCopiasDeLaNube(); // carga la lista de la nube al entrar
  } else {
    secTel.style.display = 'block';
    secNube.style.display = 'none';
    if(btnTel){ btnTel.style.background = '#1a237e'; btnTel.style.color = 'white'; }
    if(btnNube){ btnNube.style.background = '#E8EAF6'; btnNube.style.color = '#1a237e'; }
    renderCopiasLocales();
  }
}

function abrirCopias(){
  renderCopiasLocales();
  mostrarTipoCopias('telefono'); // por defecto muestra las del teléfono
  var ultima = parseInt(localStorage.getItem(CLAVE_ULTIMA_COPIA) || '0', 10);
  var el = document.getElementById('copias-ultima');
  var est = document.getElementById('copias-estado');
  if(ultima){
    var mins = Math.floor((Date.now() - ultima) / 60000);
    var texto;
    if(mins < 1) texto = 'Hace un momento';
    else if(mins < 60) texto = 'Hace ' + mins + ' minuto(s)';
    else if(mins < 1440) texto = 'Hace ' + Math.floor(mins/60) + ' hora(s)';
    else texto = 'Hace ' + Math.floor(mins/1440) + ' día(s)';

    // Si hubo una revisión más reciente SIN cambios, mostrar la hora de la copia real
    // (arriba, en grande) y una nota abajo de que se revisó sin cambios nuevos.
    var horaRevision = parseInt(localStorage.getItem('nbs_hora_ultima_revision_nube') || '0', 10);
    var revisadoSinCambios = localStorage.getItem('nbs_ultima_revision_nube_sincambios') === '1';
    var nota = '';
    if(revisadoSinCambios && horaRevision > ultima){
      var minsRev = Math.floor((Date.now() - horaRevision) / 60000);
      var textoRev;
      if(minsRev < 1) textoRev = 'hace un momento';
      else if(minsRev < 60) textoRev = 'hace ' + minsRev + ' min';
      else if(minsRev < 1440) textoRev = 'hace ' + Math.floor(minsRev/60) + ' h';
      else textoRev = 'hace ' + Math.floor(minsRev/1440) + ' días';
      nota = 'Revisado ' + textoRev + ' · sin cambios nuevos';
    }
    el.innerHTML = texto + (nota ? '<div style="font-size:11px;color:var(--nbs-muted);font-weight:400;margin-top:3px">' + nota + '</div>' : '');

    // Como la app respalda al abrir y al volver, siempre está "al día" salvo que
    // la última copia real sea de hace más de un día.
    var alDia = mins < 1440;
    est.textContent = alDia ? '✓ Al día' : '☁️ Se actualiza al abrir la app';
    est.style.color = alDia ? 'var(--nbs-green-text)' : 'var(--nbs-muted)';
  } else {
    el.textContent = 'Ninguna todavía';
    est.textContent = '⚠️ Sin copias';
    est.style.color = '#E65100';
  }

}

// Carga la lista de copias de la NUBE (solo cuando tocas el botón de nube)
function pedirRestaurar(idCopia){
  listarCopias().then(function(copias){
    var c = copias.find(function(x){ return String(x.id) === String(idCopia); });
    if(!c) return;
    var d = c.datos;
    var cn = d.conteo || {};
    var ahora = contarTodo();

    var msj = '↺ VOLVER A LA COPIA DEL ' + (d.fecha||'') + ' A LAS ' + (d.horaTexto||'') + '\n\n';
    msj += 'Así quedarían tus datos:\n\n';
    [['nv','Ventas'],['ncl','Clientes'],['np','Productos'],['nc','Compras']].forEach(function(par){
      var k = par[0], nom = par[1];
      var a = ahora[k] || 0, b = cn[k] || 0;
      var flecha = b > a ? '  ↑ recuperas ' + (b-a) : (b < a ? '  ↓ PIERDES ' + (a-b) : '');
      msj += '   ' + nom + ': ' + a + ' → ' + b + flecha + '\n';
    });
    msj += '\n⚠️ Todo lo que hayas hecho DESPUÉS de esa copia se va a perder.\n\n';
    msj += 'Antes de continuar, la app va a guardar una copia de cómo está AHORA, por si te arrepientes.\n\n¿Continuar?';

    if(!confirm(msj)) return;

    // Red de seguridad: guardar como esta AHORA antes de tocar nada
    hacerCopiaAutomatica(true).then(function(){
      return restaurarCopia(idCopia);
    }).then(function(partes){
      avisoGrande('✅ Listo. Se restauraron '+partes+' parte(s).\n\nLa app se va a recargar.', function(){ location.reload(); });
    }).catch(function(e){
      console.error(e);
      alert('No se pudo restaurar: ' + (e.message || 'error desconocido') + '\n\nTus datos NO se tocaron.');
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
//  CONTROL DE LA VAN  (18 de julio 2026, pedido por Sensei)
//  Es un conteo APARTE del inventario general. NO toca el stock ni las ventas.
//  Guarda: cuanto cargo Sensei de cada producto y la fecha de esa carga.
//  Luego lee las ventas desde esa fecha (con vendidosEnRango, que ya existe) para
//  calcular cuanto se vendio y cuanto queda en la van. Todo vive en la clave 'nvan'.
//  Objetivo: aprender que se mueve rapido y cargar mas de eso, menos de lo que no sale.
// ═══════════════════════════════════════════════════════════════════════════

// Estructura de 'nvan': { fechaCarga: 'YYYY-MM-DD', cargado: { pid: cantidad, ... } }
function baseAyudaNBS(){
  return [
    { t:'\ud83e\uddee Cuadre de Caja \u2014 contar el dinero, el fondo fijo y el cierre del d\u00eda',
      k:'cuadre de caja cuadrar cuadro cuadre diario contar el dinero contar billetes denominaciones efectivo billetes monedas comparar lo que cobre me falta dinero me sobra dinero falto sobro cuanto tengo en la caja fondo fijo que es el fondo fijo dar cambio vuelto hoja de calculo calculadora excel record de cuadres arqueo cierre de caja cerrar la caja cierre del dia cerrar el dia fin del dia al final del dia terminar la ruta descuadre no me cuadra',
      r:'Est\u00e1 en la pantalla de INICIO, donde dice \ud83e\uddee Cuadre de Caja.\n\nPASO 1 \u2014 ESCOGES QU\u00c9 CUADRAR\n  \u2022 Hoy \u00b7 Ayer \u00b7 Esta semana\n  \u2022 O tocas DESDE y HASTA y sale el calendario\n\nY te dice cu\u00e1nto dice la app que cobraste en esos d\u00edas. Puedes cuadrar un solo d\u00eda, tres d\u00edas juntos o una semana \u2014 como t\u00fa quieras.\n\nPASO 2 \u2014 CUENTAS TU DINERO\n  Escribes cu\u00e1ntos billetes tienes de cada uno y \u00e9l suma solo:\n     12 \u00d7 $20.00 = $240.00\n  Tambi\u00e9n pones CashApp, Zelle y cheques.\n  Y el FONDO FIJO (lo que dejas siempre en la caja para dar cambio), que se descuenta porque no es de las ventas.\n\nY te dice al momento:\n  \u2705 CUADRA PERFECTO\n  \ud83d\udd34 FALTA $X\n  \u26a0\ufe0f SOBRA $X\n\nPASO 3 \u2014 TU R\u00c9CORD\n  Cada cuadre queda guardado con sus billetes contados. Lo puedes volver a ver, editarlo con el \u270f\ufe0f o borrarlo con el \ud83d\uddd1\ufe0f.\n\n\ud83d\udd12 IMPORTANTE: el Cuadre de Caja SOLO LEE lo que cobraste. No toca ninguna venta, ni un cliente, ni un producto. Y tus cuadres entran en el backup.' },

    { t:'\ud83d\udcb5 Cobrarle a un barbero SIN salir de Pedidos R\u00e1pidos',
      k:'cobrar en la ruta cobrarle pedidos rapidos sin salir pago rapido recibir dinero en la calle me pago el barbero cobro rapido aplicar pago ruta reparto mas vieja antiguedad',
      r:'En Pedidos R\u00e1pidos, debajo del nombre de cada barbero, sale lo que te debe y un bot\u00f3n verde \ud83d\udcb5 Cobrarle.\n\nLe pones cu\u00e1nto te pag\u00f3 y la app lo reparte sola: primero la factura M\u00c1S VIEJA, despu\u00e9s la que sigue, y as\u00ed.\n\nY te ENSE\u00d1A el reparto ANTES de tocar nada, para que veas exactamente a d\u00f3nde va cada peso. Si te paga de m\u00e1s, lo que sobra le queda a favor para su pr\u00f3xima compra.\n\nBotones r\u00e1pidos: "Todo" (lo que debe completo) y "La m\u00e1s vieja".' },

    { t:'\u2b50 El Programa VIP \u2014 10 productos de $10 = uno GRATIS',
      k:'vip puntos programa vip diez 10 productos gratis premio regalo colonia wax cera cool care blade care navajas cuchillas grupo grupos tipo tipos producto acumula cuantos lleva se gano un gratis cuentan juntos juntas se juntan misma marca marcas distintas todas las colonias todos los wax por tipo agrupados',
      r:'Cada 10 productos DEL MISMO TIPO que cuesten $10, el cliente se gana uno GRATIS.\n\nSE AGRUPAN POR TIPO, sin importar la marca:\n  \u2022 COLONIA \u2014 todas las colonias juntas\n  \u2022 WAX \u2014 todos los wax juntos\n  \u2022 CUIDADO DE CUCHILLA \u2014 cool care y blade care\n\nLAS NAVAJAS S\u00cd van por marca: Dorco aparte de Astra.\n\nD\u00d3NDE LO VES: entra al cliente \u2192 rengl\u00f3n \u2b50 Programa VIP.\n\nY el Asistente \ud83e\udd16 te avisa solo cuando alguien se gan\u00f3 un producto gratis.\n\n\u26a0\ufe0f Si le corriges el nombre a un producto \u2014por ejemplo para que un wax diga "wax"\u2014 esa correcci\u00f3n cuenta tambi\u00e9n en las compras que el cliente YA hizo.' },

    { t:'\ud83d\udcf1 Mandarle sus puntos VIP por WhatsApp',
      k:'whatsapp puntos mensaje mandar puntos avisarle al cliente sus puntos constancia motivar comprar mas empujon recordarle',
      r:'Entra al cliente \u2192 rengl\u00f3n \u2b50 Programa VIP \u2192 toca el \u270f\ufe0f.\n\nVes el mensaje antes de mandarlo y luego le das a \ud83d\udcf1 Mandar por WhatsApp.\n\nLE LLEGA:\n  \u2022 Su primer nombre\n  \u2022 Cu\u00e1ntos lleva de cada tipo\n  \u2022 El gracias por ser parte del Programa VIP de Nunez Beauty Supply\n  \u2022 Y un empuj\u00f3n para llegar a los 10\n\nEl mensaje de \u00e1nimo cambia solo, para que no le llegue siempre igual.' },

    { t:'\ud83c\udf81 El Programa de Fidelidad \u2014 $400 = regalo sorpresa',
      k:'fidelidad cuatrocientos 400 regalo sorpresa total comprado meta llegar acumulado premio grande',
      r:'Cuando un cliente llega a $400 comprados, se gana un regalo sorpresa.\n\n\u26a0\ufe0f IMPORTANTE: solo cuentan los productos de MENOS de $30. Las m\u00e1quinas caras no cuentan para este programa.\n\nPor eso un cliente puede haberte comprado $768 y llevar solo $78 contados: casi todo lo suyo eran m\u00e1quinas.\n\nD\u00d3NDE LO VES: entra al cliente \u2192 rengl\u00f3n \ud83c\udf81 Programa de Fidelidad. Y el Asistente \ud83e\udd16 te avisa de qui\u00e9n lleg\u00f3 y de qui\u00e9n est\u00e1 cerca.' },

    { t:'\ud83d\udd22 El c\u00f3digo de cada cliente (001, 002, 003...)',
      k:'codigo cliente numero registro 001 antiguedad cual es el numero del cliente identificacion ficha numero de cliente',
      r:'Cada cliente tiene su c\u00f3digo, del 001 al \u00faltimo, en el orden en que TU lo registraste.\n\nD\u00d3NDE LO VES:\n  \u2022 En la lista de Clientes, ARRIBA del nombre\n  \u2022 En su cuenta, junto a donde dice CUENTA DE\n\n\ud83d\udd12 EL C\u00d3DIGO NO CAMBIA NUNCA. Si entra un cliente nuevo le toca el siguiente n\u00famero. Y si borras a uno, su n\u00famero queda vac\u00edo para siempre \u2014 nadie se renumera.\n\nEso es a prop\u00f3sito: si se renumeraran, el 001 de hoy ser\u00eda otro ma\u00f1ana y no te servir\u00eda de nada.' },

    { t:'\ud83d\udccb El Listado completo de clientes (con orden y filtros)',
      k:'listado completo clientes imprimir lista todos los clientes ordenar filtrar quienes me deben quienes estan al dia dormidos sin servicio por barberia papel imprimir fichas',
      r:'Pantalla de Clientes \u2192 bot\u00f3n azul \ud83d\udccb Listado completo.\n\nPUEDES ORDENARLOS POR:\n  \ud83d\udd22 c\u00f3digo (001, 002, 003...)\n  \ud83d\udd24 nombre (A - Z)\n  \ud83d\udcb0 lo que te deben (el que m\u00e1s, primero)\n  \ud83d\uded2 lo que te compran\n  \ud83d\udcb5 lo que te dejan\n\nY FILTRAR:\n  \u2022 Todos\n  \u2022 Solo los que me deben\n  \u2022 Solo los que est\u00e1n al d\u00eda\n  \u2022 Solo los que compran (\u00faltimos 60 d\u00edas)\n  \u2022 Solo los que dejaron de venir\n  \u2022 Solo los SIN SERVICIO\n  \u2022 De una sola barber\u00eda\n\nAntes de imprimir te dice cu\u00e1ntos son y cu\u00e1nto suman, para que no gastes papel de gusto.' },

    { t:'\ud83d\udccd Las visitas: c\u00f3mo se apuntan y qu\u00e9 significan',
      k:'visitas record de visitas marcar barberia visitada no quiso nada no estaba porcentaje de compra cuantas veces fui bitacora ruta marcada automatica',
      r:'Cuando marcas una barber\u00eda en la Ruta, a TODOS sus barberos les queda la visita apuntada. Y si despu\u00e9s le vendes a uno, cambia solo a "compr\u00f3".\n\nEN PEDIDOS R\u00c1PIDOS, si un barbero no te compra, tienes DOS botones:\n  \ud83d\udeab No quiso nada \u2014 estaba pero no compr\u00f3\n  \ud83d\udeaa No estaba \u2014 no lo encontraste\n\nLAS DOS CUENTAN COMO VISITA porque t\u00fa fuiste hasta all\u00e1. Pero el "no estaba" NO le baja su porcentaje de compra, porque no fue culpa suya.\n\nEN SU FICHA VES:\n  \u2705 Te compr\u00f3 en X\n  \ud83d\udeab No quiso nada en X\n  \ud83d\udeaa No estaba en X\n  Y de las veces que S\u00cd estaba, te compr\u00f3 el X%' },

    { t:'\ud83d\udcb5 Corregir o borrar un pago que pusiste mal',
      k:'editar pago corregir pago borrar pago puse mal el monto me equivoque en el pago factura saldada por error lapiz del pago papelera pago equivocado',
      r:'DOS FORMAS, las dos sirven:\n\n1) DESDE LA FACTURA\n   Entra al cliente \u2192 \ud83d\udcc4 Sus facturas \u2192 toca la factura.\n   Ah\u00ed abajo sale \ud83d\udcb5 PAGOS APLICADOS con cada pago, su \u270f\ufe0f y su \ud83d\uddd1\ufe0f.\n\n2) DESDE SU CUENTA\n   Entra al cliente \u2192 rengl\u00f3n \ud83d\udcb5 Sus pagos.\n   Cada pago tiene su \u270f\ufe0f y su \ud83d\uddd1\ufe0f ah\u00ed mismo.\n\nAl corregirlo, el DEBE de arriba se actualiza al momento.\n\n\u26a0\ufe0f Si borras un pago, la deuda del cliente SUBE ese mismo monto. Te lo pregunta antes.' },

    { t:'\u2705 Lo que hay en la CUENTA de un cliente',
      k:'cuenta del cliente perfil todo lo del cliente sus facturas sus pagos canceladas pedidos credito a favor notas cada cuanto compra ajustes editar cliente lapiz',
      r:'Entra a un cliente y arriba dice CUENTA DE con su nombre grande y su c\u00f3digo.\n\nARRIBA: COMPR\u00d3 \u00b7 DEBE \u00b7 TE DEJA \u00b7 \u00daLTIMA\n\nY ABAJO, cada rengl\u00f3n se abre al tocarlo. Los que llevan \u270f\ufe0f se editan ah\u00ed mismo, sin abrirlos:\n  \ud83d\udcc7 Sus datos \u270f\ufe0f\n  \u2b50 Programa VIP \u270f\ufe0f\n  \ud83d\uded2 Lo que m\u00e1s compra\n  \ud83d\udcc4 Sus facturas \u270f\ufe0f\n  \ud83d\udcb5 Sus pagos \u270f\ufe0f\n  \ud83d\udeab Facturas canceladas\n  \ud83d\udcb0 Cr\u00e9dito a favor \u270f\ufe0f\n  \ud83d\udcdd Notas \u270f\ufe0f\n  \ud83d\udcc5 Cada cu\u00e1nto compra \u270f\ufe0f\n  \u2699\ufe0f Ajustes de su cuenta \u270f\ufe0f\n  \ud83d\udccd Visitas \u270f\ufe0f\n  \ud83c\udf81 Programa de Fidelidad \u270f\ufe0f\n  \ud83d\udcb5 Lo que te deja' },

    { t:'\u270d\ufe0f La firma NO es obligatoria',
      k:'firma firmar firme firmo firmado no quiero firma obligatoria obligatorio no me deja cerrar la venta sin firma no hace falta firma cliente firme que firmen todos no todos confianza mas de cincuenta 50 grande',
      r:'Cuando haces una venta a cr\u00e9dito, la app te ofrece tomarle la firma. Pero T\u00da DECIDES.\n\nEn el recuadro de la firma hay tres botones:\n  \ud83d\udd04 Borrar\n  \u2713 No hace falta firma  \u2190 cierra la venta AH\u00cd MISMO\n  Cancelar\n\nEl del medio hace la venta sin firma, sin tener que empezar de nuevo.\n\nAs\u00ed le pides firma solo a los que todav\u00eda no se han ganado tu confianza, o cuando la venta es grande.' },

    { t:'\ud83d\udce5 Los avisos del Asistente funcionan como un correo',
      k:'avisos asistente ya lo vi archivar historial puntito rojo notificaciones leido borrar aviso bandeja de entrada',
      r:'Cada aviso del \ud83e\udd16 trae su bot\u00f3n \u2713 Ya lo vi.\n\nAl tocarlo:\n  \u2022 se marca le\u00eddo\n  \u2022 desaparece de los avisos nuevos\n  \u2022 el puntito rojo baja\n  \u2022 y se va al HISTORIAL\n\nEN EL HISTORIAL (bot\u00f3n abajo del panel) puedes:\n  \ud83d\udce5 Que vuelva a salir\n  \ud83d\uddd1\ufe0f Borrarlo\n  \ud83d\uddd1\ufe0f Borrar todo el historial\n\n\u26a0\ufe0f Y si el n\u00famero cambia \u2014de 5 agotados a 7\u2014 el aviso VUELVE a salir como nuevo, para que no se te escape que algo empeor\u00f3.' },

    { t:'\ud83d\udccd Mover el bot\u00f3n del Asistente si te estorba',
      k:'mover boton asistente estorba tapa arrastrar cambiar de sitio molesta el robot',
      r:'Deja el bot\u00f3n \ud83e\udd16 APRETADO un momento (medio segundo) y arr\u00e1stralo donde t\u00fa quieras.\n\nAh\u00ed se queda, y la app lo recuerda.\n\nUn toque normal lo sigue abriendo igual.' },

    { t:'\ud83d\udd14 La Revisi\u00f3n Diaria autom\u00e1tica',
      k:'revision diaria automatica avisa errores dinero descuadre productos en negativo pagadas de mas contado debiendo alerta',
      r:'Una vez al d\u00eda, la app se revisa sola por dentro. SI TODO CUADRA NO TE MOLESTA \u2014 el letrero solo salta si hay algo GRAVE.\n\nLO QUE REVISA:\n  \u2022 Que el dinero cuadre (vendido = cobrado + por cobrar)\n  \u2022 Facturas pagadas de M\u00c1S\n  \u2022 Ventas de contado que quedaron debiendo\n  \u2022 Facturas de clientes borrados\n  \u2022 Productos con existencia en negativo\n  \u2022 Deudas de m\u00e1s de 60 d\u00edas\n\nY si encuentra facturas pagadas de m\u00e1s, te ofrece arreglarlas dejando el sobrante a favor del cliente.' },

    { t:'\ud83d\udcca El Informe de cambios (para estudiar la app)',
      k:'informe cambios que hay de nuevo novedades estudiar aprender la app manual repasar que hace la app resumen',
      r:'Men\u00fa \u2192 \ud83d\udcd6 Manual de Usuario \u2192 el PRIMERO de la lista dice \ud83d\udcca Informe.\n\nAh\u00ed est\u00e1 todo lo que se ha ido construyendo, con tus n\u00fameros, los fallos que se arreglaron y lo que queda pendiente.\n\nY como est\u00e1 dentro del Manual, lo puedes BUSCAR con el buscador de arriba y sale en "Imprimir o compartir todo el manual".\n\nTambi\u00e9n: toca el \ud83e\udd16 y dale al bot\u00f3n amarillo \ud83d\udd0a Escuchar lo nuevo \u2014 te lee las novedades en voz alta.' },

    { t:'\ud83e\udd16 El Asistente (el bot\u00f3n de abajo a la derecha)',
      k:'asistente robot boton redondo abajo derecha ayudante avisos hablar voz microfono me habla escuchar puntito rojo inteligencia artificial ia',
      r:'Es el bot\u00f3n redondo \ud83e\udd16 de abajo a la derecha. T\u00f3calo y te DICE EN VOZ ALTA lo que se te est\u00e1 escapando: qu\u00e9 se te acab\u00f3, qu\u00e9 clientes dejaron de venir, las deudas de m\u00e1s de 30 d\u00edas, los que te compraron una sola vez y los productos que casi no dejan ganancia. El puntito rojo dice cu\u00e1ntas cosas tiene que decirte. Cada aviso trae SU BOT\u00d3N para resolverlo ah\u00ed mismo. Y con \ud83c\udfa4 H\u00e1blame le preguntas: \u201c\u00bfcu\u00e1nto me debe Isidro?\u201d, \u201c\u00bfqui\u00e9n no viene hace tiempo?\u201d, \u201c\u00bfc\u00f3mo me fue hoy?\u201d, \u201c\u00bfqu\u00e9 se me est\u00e1 acabando?\u201d, \u201cprepara un pedido para Luis\u201d. Si no quieres que te hable, el bot\u00f3n \ud83d\udd0a de arriba lo calla. Funciona SIN internet y no cuesta nada.' },

    { t:'\ud83d\udccb Bit\u00e1cora de visitas (todo lo que pas\u00f3 con cada cliente)',
      k:'bitacora visitas reporte historial que compro cuando hora fecha detalle record semanal por fecha rango imprimir compartir',
      r:'Men\u00fa \u2630 \u2192 \ud83d\udcca REPORTES \u2192 \ud83d\udccb Bit\u00e1cora de visitas. Ah\u00ed est\u00e1 TODO lo que pas\u00f3 con cada cliente: qu\u00e9 d\u00eda lo visitaste, A QU\u00c9 HORA, si te compr\u00f3 y qu\u00e9 se llev\u00f3 producto por producto, cu\u00e1nto y si fue a cr\u00e9dito o contado, y tu ganancia. CADA VENTA ES SU PROPIO RENGL\u00d3N con su hora: si le vendiste a las 8:15 y otra vez a las 11:30, salen las dos. Escoge Hoy, 7 d\u00edas, 30 d\u00edas, Todo, o las fechas que quieras. Y busca por cliente, barber\u00eda o producto. Con \ud83d\udda8\ufe0f Imprimir y \ud83d\udce4 Compartir. Se llena SOLA, t\u00fa no apuntas nada.' },

    { t:'\ud83e\udd16 La ruta se marca sola al vender',
      k:'ruta marca sola automatico visitada olvido marcar visita se me olvida automatizado auto',
      r:'Ya no tienes que acordarte. Cuando le vendes a un barbero de una barber\u00eda que est\u00e1 en la ruta de hoy, LA RUTA SE MARCA SOLA con la hora. Lo mismo al guardar un pedido. Y si pasas 40 minutos en una barber\u00eda sin marcar ni vender, la app te avisa. Al terminar una barber\u00eda en Pedidos R\u00e1pidos, los barberos que no llevaron nada quedan apuntados como \u201cno compr\u00f3\u201d, para que tu r\u00e9cord est\u00e9 completo.' },

    { t:'\ud83d\uddd1\ufe0f Borrar un pedido que el cliente ya no quiere',
      k:'borrar pedido cancelar eliminar quitar pendiente cambio de opinion no lo quiere carrito',
      r:'Ve a Pedidos Pendientes y toca el pedido para convertirlo en venta. Abajo salen DOS botones: \u201c\u2715 Cancelar y volver a Pedidos Pendientes\u201d te saca SIN borrar nada \u2014 el pedido se queda. Y \u201c\ud83d\uddd1\ufe0f El cliente ya no lo quiere \u2014 borrar este pedido\u201d s\u00ed lo BORRA del carrito: te pregunta con el nombre y el monto, y desaparece.' },

    { t:'\ud83d\udcbe Guardar los pedidos uno por uno',
      k:'pedidos rapidos guardar individual uno por uno barberos orden flechas botones un toque perder pedidos',
      r:'En Pedidos R\u00e1pidos escoges la barber\u00eda y salen TODOS sus barberos. Cada uno tiene su bot\u00f3n \ud83d\udcbe Guardar este pedido: al tocarlo se guarda ESE y se cierra solo para pasar al siguiente \u2014 as\u00ed no pierdes la barber\u00eda entera si algo pasa. Cada barbero trae dos filas de botones de un toque: \u26a1 LO QUE M\u00c1S VENDES y \ud83d\udc64 LO QUE M\u00c1S COMPRA \u00e9l. Y con las flechitas \u25b2\u25bc los pones en el orden que quieras, que queda guardado. Al final, \u201c\u2713 Terminar con esta barber\u00eda\u201d.' },

    { t:'\ud83d\udce6 Hacer el inventario por marca',
      k:'inventario marca contar existencia stock cantidad corregir invertido valor editar por marca vale',
      r:'Cat\u00e1logo \u2192 Editar por marca \u2192 escoge una marca. Arriba salen sus n\u00fameros: cu\u00e1ntos productos, cu\u00e1ntos con existencia, unidades, INVERTIDO, a venta y ganancia. Cada producto tiene su EXISTENCIA y su VALE (cantidad \u00d7 costo). Escribes la cantidad real y el INVERTIDO de arriba baja EN VIVO mientras cuentas. As\u00ed haces una marca completa de una sola vez. Si dejas un campo vac\u00edo o escribes letras, se queda la cantidad de antes \u2014 nunca se pone en cero por error.' },

    { t:'\u21a9\ufe0f El bot\u00f3n de atr\u00e1s y el del celular',
      k:'atras volver regresar boton celular se cierra la app pantalla anterior salir',
      r:'El bot\u00f3n \u2190 Atr\u00e1s de la app y el bot\u00f3n de atr\u00e1s del celular hacen LO MISMO, y dan UN SOLO PASO cada vez. Si tienes una factura abierta, el primer toque la cierra y te quedas donde estabas; el siguiente te saca de la pantalla; y cuando ya no hay a d\u00f3nde volver, te pregunta si quieres salir. La app ya no se cierra sola.' },

    { t:'✏️ Corregir o borrar un pago',
      k:'pago pagos cobro cobrar abono abonos me pagaron dinero editar corregir borrar eliminar cambiar monto fecha metodo dividir efectivo tarjeta zelle equivocado error',
      r:'Ve a Cuentas por Cobrar (💳) → toca el cliente → toca la factura. En "Pagos aplicados" cada pago tiene un lápiz ✏️. Tócalo para cambiar el monto, la fecha y el método, o dividirlo en varios (efectivo + tarjeta + Zelle). El total se suma solo. También puedes borrarlo con 🗑️. El saldo del cliente se ajusta solo.' },
    { t:'💳 Ver lo que me deben los clientes',
      k:'deben deuda deudas dinero cobrar cuentas por cobrar cxc saldo balance pendiente quien me debe cuanto',
      r:'Ve a Cuentas por Cobrar (💳) desde el inicio o el menú (☰). Ahí ves la lista de clientes que te deben y cuánto. Toca un cliente para ver sus facturas y aplicar pagos.' },
    { t:'💵 Registrar un pago que me hicieron',
      k:'pago abono cobrar cobro me pagaron aplicar pago registrar recibir dinero cliente pago factura',
      r:'Ve a Cuentas por Cobrar (💳) → toca el cliente → toca la factura que te está pagando → en "Aplicar pago" pones el monto y el método. Si te paga con varias formas, agregas más métodos. Si sobra dinero, se aplica solo a la factura más vieja.' },
    { t:'⚡ Tomar un pedido en la barbería',
      k:'pedido pedidos rapidos tomar pedido barberia orden anotar vender apuntar',
      r:'Toca "Pedidos Rápidos" (⚡) en el inicio. Buscas la barbería, marcas los barberos, agregas los productos y cantidades. El pedido queda en "Pendientes" hasta que lo conviertas en factura.' },
    { t:'🧾 Hacer una venta / factura',
      k:'vender venta factura facturar nueva venta cobrar contado credito',
      r:'Toca "Vender" para una venta directa, o convierte un pedido en factura desde Pedidos Rápidos. Eliges cliente, productos, y si es de contado o crédito. La factura descuenta el inventario solo.' },
    { t:'🚐 Control de la Van (cargué, vendí, me quedan)',
      k:'van control van cargar van inventario van cuanto cargue cuanto vendi cuanto queda reponer recarga camioneta',
      r:'En el menú (☰) → "Control de la Van". Toca "➕ Cargar la van" y pones cuánto metes de cada producto. Según vendes, se rebaja solo y te dice cuánto te queda y qué recargar. Es aparte de tu inventario general.' },
    { t:'📋 Lista de Relleno (qué reponer)',
      k:'relleno lista relleno van reponer que reponer que vendi surtir llenar recargar recarga que se me esta acabando acabando se acaba acabo agotado agotados agotandose queda poco me queda poco falta reponer que tengo que comprar que necesito comprar por acabarse',
      r:'En el menú (☰) → "Lista de Relleno". Eliges las fechas y se llena sola con lo que vendiste, para reponerlo. Ajustas las cantidades o agregas más a mano. La compartes por WhatsApp como texto.' },
    { t:'📦 Crear o editar un producto',
      k:'producto nuevo crear producto agregar producto editar producto cambiar producto modificar producto cambiar precio cambiar costo catalogo registrar articulo mercancia borrar producto eliminar producto',
      r:'En Catálogo (📦) → "+ Nuevo producto" para crear uno. Para editar (cambiar nombre, precio, costo, stock), toca el producto en el catálogo. También puedes crear un producto al vuelo cuando cargas la van: si buscas uno que no existe, sale el botón "➕ Crear producto nuevo".' },
    { t:'💰 Ver el valor de mi inventario',
      k:'inventario valor inventario cuanto tengo stock mercancia ganancia potencial cuanto vale',
      r:'En el menú (☰) → "Inventario". Te muestra cuánto tienes invertido, el valor de venta, la ganancia potencial y qué productos no se han vendido en mucho tiempo.' },
    { t:'📊 Ver ganancias, ventas y márgenes',
      k:'ganancia ganancias ventas margen beneficio dinero reporte reportes cuanto gane cuanto vendi por cliente',
      r:'En el menú (☰) → "Reportes". Eliges fechas y el tipo: ventas por cliente (con cuánto ganaste y el margen), pagos recibidos, ganancias, gastos, y más.' },
    { t:'📈 Resumen del negocio (Dashboard)',
      k:'dashboard resumen financiero negocio dinero como voy ventas del mes ganancia del mes cuanto me queda',
      r:'En el menú (☰) → "Resumen Financiero". Te muestra las ventas de hoy y del mes, la ganancia menos gastos, lo que te deben y lo que tú debes.' },
    { t:'💸 Registrar un gasto',
      k:'gasto gastos gasolina comida dinero anotar gasto registrar gasto egreso editar gasto cambiar gasto borrar gasto corregir gasto',
      r:'En el menú (☰) → "Gastos". Pones la categoría (gasolina, comida, etc.), el monto y la fecha. Los gastos se restan de tu ganancia en el Resumen Financiero.' },
    { t:'🏭 Suplidores y lo que les debo',
      k:'suplidor suplidores proveedor proveedores lo que debo dinero cuentas por pagar compras a credito editar suplidor cambiar suplidor nuevo suplidor agregar suplidor',
      r:'En el menú (☰) → "Suplidores" para ver tus proveedores y lo que les debes. En "Compras" registras la mercancía que les compras.' },
    { t:'🚚 Registrar una compra de mercancía',
      k:'compra compras comprar mercancia registrar compra suplidor proveedor factura de compra editar compra cambiar compra borrar compra corregir compra',
      r:'En el menú (☰) → "Compras". Eliges el suplidor, agregas los productos y cantidades, el costo, y si es de contado o crédito. Esto sube tu inventario.' },
    { t:'⭐ Programa VIP de clientes',
      k:'vip programa vip fidelidad premio regalo cliente frecuente lealtad inscribir vip quitar vip editar vip',
      r:'En el menú (☰) → "Programa VIP". Inscribes un cliente desde su perfil.\n\nAl comprar 10 de la MISMA MARCA y el MISMO TIPO —da igual el nombre—, el 11 va gratis.\n\nEjemplo: 10 colonias Immortal de nombres distintos ya son un premio. Las navajas de $5.00 cuentan 2 por 1.' },
    { t:'🗺️ Ruta de visitas por día',
      k:'ruta rutas visita visitas dia semana a quien visito lunes martes barberias del dia editar ruta cambiar ruta quitar de ruta agregar a ruta',
      r:'En el menú (☰) → "Ruta de Visitas". Organizas qué barberías visitar cada día de la semana. Buscas por nombre de barbería o barbero.' },
    { t:'👥 Agregar o buscar un cliente',
      k:'cliente clientes nuevo cliente agregar cliente anadir barbero barberia buscar cliente registrar crear cliente',
      r:'Toca "Clientes" (👥) en el inicio. Con "+ Nuevo" agregas un cliente (nombre, negocio, teléfono, barberos). Usa el buscador para encontrar uno.' },
    { t:'✏️ Editar o cambiar un cliente',
      k:'editar cliente cambiar cliente modificar cliente corregir cliente actualizar cliente cambiar telefono cambiar nombre cambiar direccion arreglar cliente datos del cliente editar barbero borrar cliente eliminar cliente',
      r:'Toca "Clientes" (👥) → busca y toca el cliente → en su perfil toca "✏️ Editar cliente". Ahí cambias el nombre, negocio, teléfono, dirección y barberos. También desde ahí puedes eliminarlo.' },
    { t:'💾 Hacer un respaldo (backup)',
      k:'respaldo backup copia seguridad guardar datos bajar respaldo perder datos proteger',
      r:'En el inicio, toca "Hacer respaldo ahora" para bajar una copia a tu teléfono. Además, la app guarda solo en la nube cada 2 horas. En "Copias de Seguridad" puedes restaurar.' },
    { t:'🖨️ Imprimir una factura',
      k:'imprimir impresora factura ticket recibo bluetooth esc pos compartir factura',
      r:'Desde la factura, usa el botón de compartir para mandarla a tu app de impresora (ESC POS) por el menú de compartir de Android.' },
    { t:'📷 Cargador de fotos de productos',
      k:'foto fotos imagen imagenes producto cargar fotos subir fotos',
      r:'Esta función está planeada pero aún no está lista. Cuando esté, emparejarás las fotos con los productos por el número del producto en el nombre del archivo.' },
  ];
}

var _ayudaAbierta = false;

function abrirAyuda(){
  var overlay = document.getElementById('ayuda-overlay');
  if(!overlay){
    overlay = document.createElement('div');
    overlay.id = 'ayuda-overlay';
    document.body.appendChild(overlay);
  }
  overlay.style.cssText = 'position:fixed;inset:0;background:white;z-index:99998;overflow-y:auto;padding:16px';
  overlay.scrollTop = 0;
  overlay.innerHTML =
    '<div style="max-width:480px;margin:0 auto">'
    +'<div style="display:flex;gap:8px;margin-bottom:14px">'
    +'<button onclick="cerrarAyuda()" style="flex:1;background:#E8EAF6;border:none;border-radius:8px;padding:12px;font-size:14px;font-weight:700;color:#1a237e;cursor:pointer">← Volver</button>'
    +'</div>'
    +'<h2 style="font-size:20px;font-weight:800;color:#1a237e;margin-bottom:4px">❓ Ayuda — ¿Cómo hago tal cosa?</h2>'
    +'<p style="font-size:13px;color:#888;margin-bottom:14px">Escribe tu pregunta con tus palabras y te digo dónde está y cómo se hace.</p>'
    +'<div class="busca-caja" style="border:2px solid var(--nbs-gold);margin-bottom:6px">'
    +'<span style="font-size:18px;flex-shrink:0;opacity:0.75">🔎</span>'
    +'<input id="ayuda-buscar" class="busca-fuerte" type="text" placeholder="Ej: cómo edito un pago, cargar la van..." oninput="renderAyuda(this.value)" autocomplete="off">'
    +'</div>'
    +'<p style="font-size:11px;color:#aaa;margin-bottom:14px">Ejemplos: "editar pago", "lo que me deben", "hacer respaldo", "crear producto"</p>'
    +'<div id="ayuda-resultados"></div>'
    +'</div>';
  renderAyuda('');
  setTimeout(function(){ var i=document.getElementById('ayuda-buscar'); if(i) i.focus(); }, 100);
}

function cerrarAyuda(){
  var o = document.getElementById('ayuda-overlay');
  if(o) o.style.display = 'none';
}

// Quita acentos y pasa a minúsculas, para que "cómo" y "como" encuentren lo mismo
function normalizarTexto(s){
  return (s||'').toLowerCase()
    .replace(/á/g,'a').replace(/é/g,'e').replace(/í/g,'i').replace(/ó/g,'o').replace(/ú/g,'u').replace(/ñ/g,'n');
}

// Grupos de palabras que significan lo mismo. Si escribes cualquiera de un grupo,
// el buscador también busca las demás. Así "editar" encuentra todo lo editable,
// aunque el tema use la palabra "cambiar" o "corregir".
function gruposSinonimosAyuda(){
  return [
    // 🔑 Los que él usa de verdad, agregados el 17 ago
    ['vip','puntos','punto','premio','premios','gratis','regalo','recompensa','acumula','acumulado'],
    ['fidelidad','cuatrocientos','400','sorpresa','meta'],
    ['codigo','numero','registro','identificacion','ficha','001'],
    ['visita','visitas','visite','visito','pase','fui','llegue','marcar','marque','marcada'],
    ['ruta','recorrido','vuelta','dia','camino'],
    ['listado','lista','reporte','informe','imprimir','papel','impresion'],
    ['ordenar','orden','acomodar','clasificar','organizar'],
    ['filtrar','filtro','solo','nomas','unicamente','separar'],
    ['whatsapp','wasap','wasa','mensaje','mandar','enviar','texto'],
    ['firma','firmar','firme','firmo','firmado'],
    ['aviso','avisos','notificacion','notificaciones','alerta','alertas','recordatorio'],
    ['asistente','robot','ia','inteligencia','ayudante','bot'],
    ['nombre','nombres','descripcion','titulo','como se llama'],
    ['tipo','tipos','grupo','grupos','categoria','clase'],
    ['wax','cera','gel','pomada'],
    ['colonia','perfume','cologne','fragancia'],
    ['navaja','navajas','blade','blades','cuchilla','cuchillas'],
    ['sobrante','sobra','vuelto','cambio','resto','excedente','demas'],
    ['favor','credito','afavor','saldo a favor','tiene a favor'],
    ['vieja','viejo','antigua','antiguo','primera','antes','atrasada'],
    ['equivoque','error','mal','malo','equivocado','confundi','puse mal'],
    ['contado','efectivo','cash','de una'],
    ['pedidos rapidos','pedido rapido','rapidos','multiple','varios barberos'],
    ['cuenta','perfil','ficha','expediente','historial'],
    ['gastos','gasto','gaste','egreso','egresos','salida'],
    ['ganancia','gane','beneficio','margen','deja','me deja','utilidad'],
    ['inventario','existencia','existencias','cantidad','stock','me queda','quedan'],
    ['agotado','agoto','acabo','acabado','se acabo','sin nada','en cero'],
    ['nube','internet','sincronizar','sincroniza','subir','bajar','firebase'],
    ['telefono','celular','movil','android','pc','computadora'],
    ['manual','ayuda','instrucciones','como se hace','como hago','guia','tutorial'],
    ['editar','cambiar','modificar','corregir','actualizar','arreglar','ajustar','edito','cambio'],
    ['borrar','eliminar','quitar','remover','borro','elimino'],
    ['crear','agregar','anadir','nuevo','nueva','registrar','crea','agrega','poner'],
    ['ver','consultar','mostrar','revisar','buscar','encontrar','veo'],
    ['pago','pagos','abono','abonos','cobro','cobrar','cobre','pagaron','pague'],
    ['deben','deuda','deudas','debe','debo','saldo','balance','pendiente'],
    ['venta','vender','factura','facturar','vendo','vendi'],
    ['cliente','clientes','barbero','barberia','barberos'],
    ['producto','productos','articulo','articulos','mercancia','item'],
    ['precio','precios','costo','costos','valor'],
    ['van','camioneta','carro'],
    ['respaldo','backup','copia','seguridad'],
    ['gasto','gastos','gasolina','comida'],
    ['reporte','reportes','informe','ganancia','ganancias','margen'],
  ];
}

// Toma las palabras que escribió el usuario y les suma los sinónimos de cada grupo.
function expandirConSinonimos(palabras){
  var grupos = gruposSinonimosAyuda();
  var resultado = palabras.slice();
  palabras.forEach(function(w){
    grupos.forEach(function(g){
      if(g.indexOf(w) > -1){
        g.forEach(function(sin){ if(resultado.indexOf(sin) === -1) resultado.push(sin); });
      }
    });
  });
  return resultado;
}

function renderAyuda(q){
  var el = document.getElementById('ayuda-resultados');
  if(!el) return;
  var temas = baseAyudaNBS();
  var qn = normalizarTexto(q).trim();

  var lista;
  if(!qn){
    lista = temas; // sin búsqueda: mostrar todos
  } else {
    var palabras = qn.split(/\s+/).filter(function(w){ return w.length >= 2; });
    var palabrasEscritas = palabras.slice();
    var palabrasBusqueda = expandirConSinonimos(palabras);
    // Puntuar cada tema. Las palabras que el usuario escribió de verdad valen más (2 puntos)
    // que los sinónimos agregados (1 punto), para que lo más exacto salga primero.
    lista = temas.map(function(tema){
      var textoTitulo = normalizarTexto(tema.t);
      var textoClaves = normalizarTexto(tema.k);
      var puntos = 0;
      palabrasBusqueda.forEach(function(w){
        var escrita = (palabrasEscritas.indexOf(w) > -1);
        // Si la palabra está en el TÍTULO, vale mucho más (es el tema principal).
        if(textoTitulo.indexOf(w) > -1){
          puntos += escrita ? 5 : 3;
        } else if(textoClaves.indexOf(w) > -1){
          puntos += escrita ? 2 : 1;
        }
      });
      return { tema: tema, puntos: puntos };
    }).filter(function(x){ return x.puntos > 0; })
      .sort(function(a,b){ return b.puntos - a.puntos; })
      .map(function(x){ return x.tema; });
  }

  if(!lista.length){
    el.innerHTML = '<div class="card" style="text-align:center;color:#999;font-size:14px;padding:24px">'
      +'No encontré nada con esas palabras.<br>Prueba con otra palabra, por ejemplo: <b>pago</b>, <b>venta</b>, <b>cliente</b>, <b>van</b>, <b>respaldo</b>.'
      +'</div>';
    return;
  }

  el.innerHTML = lista.map(function(tema){
    return '<div class="card" style="margin-bottom:10px;padding:14px">'
      +'<div style="font-size:15px;font-weight:700;color:#1a237e;margin-bottom:6px">'+tema.t+'</div>'
      +'<div style="font-size:13px;color:#444;line-height:1.5">'+tema.r+'</div>'
      +'</div>';
  }).join('');
}

function fechaISOaLegible(iso){
  try {
    var p = iso.split('-');
    var meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    return parseInt(p[2]) + ' de ' + meses[parseInt(p[1])-1] + ' de ' + p[0];
  } catch(e){ return iso; }
}

// Calcula, por cada producto cargado: cargado, vendido (desde la fecha de carga), y lo que queda.
function vendidosEnRango(desdeISO, hastaISO){
  var ventasTodas = LS('nv', []);
  var conteo = {};
  ventasTodas.forEach(function(v){
    if(v.cancelada) return;
    var fISO = fechaVentaAISO(v.fecha);
    if(!fISO) return;
    if(desdeISO && fISO < desdeISO) return;
    if(hastaISO && fISO > hastaISO) return;
    (v.items||[]).forEach(function(it){
      if(!it.pid) return;
      var k = String(it.pid);
      conteo[k] = (conteo[k] || 0) + (it.cant || 0);
    });
  });
  return conteo;
}

function escaparHtml(txt){
  if(txt === null || txt === undefined) return '';
  return String(txt)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function limpiarTexto(texto){
  if(!texto) return texto;
  var div = document.createElement('div');
  div.textContent = texto;
  return div.innerHTML.replace(/</g, '').replace(/>/g, '');
}

// 📅 PARA QUE SENSEI PUEDA ELEGIR LA FECHA EN TODO  (2 sep 2026)
//
// Sus palabras: "en todas partes donde vaya a entrar un dato debo tener la opción de
// cambiar la fecha, aunque la fecha por defecto siempre sea la de ese día".
//
// El calendario del teléfono trabaja con AAAA-MM-DD; la app guarda MM/DD/AAAA.
// Estas dos ayuditas traducen, y se usan en los siete sitios.

// De AAAA-MM-DD —lo que da el calendario— a MM/DD/AAAA —lo que guarda la app—.
// 🔑 Si viene vacío o raro devuelve HOY: nunca se guarda una fecha inválida.
function fechaDelCampo(idCampo){
  try {
    var el = document.getElementById(idCampo);
    if(!el || !el.value) return fechaHoy();
    var p = String(el.value).split('-');
    if(p.length !== 3) return fechaHoy();
    var a = parseInt(p[0], 10), m = parseInt(p[1], 10), d = parseInt(p[2], 10);
    if(!a || !m || !d || m < 1 || m > 12 || d < 1 || d > 31) return fechaHoy();
    return (m < 10 ? '0' : '') + m + '/' + (d < 10 ? '0' : '') + d + '/' + a;
  } catch(e){ return fechaHoy(); }
}

// Deja el campo con la fecha de HOY puesta, listo para cambiarla si hace falta.
function ponerHoyEnCampo(idCampo){
  try {
    var el = document.getElementById(idCampo);
    if(!el) return;
    var d = new Date();
    var mm = d.getMonth() + 1, dd = d.getDate();
    el.value = d.getFullYear() + '-' + (mm < 10 ? '0' : '') + mm + '-' + (dd < 10 ? '0' : '') + dd;
  } catch(e){}
}

function fechaHoy(){
  var d = new Date();
  var mm = String(d.getMonth()+1).padStart(2,'0');
  var dd = String(d.getDate()).padStart(2,'0');
  var yyyy = d.getFullYear();
  return mm+'/'+dd+'/'+yyyy;
}

function fechaHoyISO(){
  // Para campos input type="date" que necesitan YYYY-MM-DD
  var d = new Date();
  var mm = String(d.getMonth()+1).padStart(2,'0');
  var dd = String(d.getDate()).padStart(2,'0');
  var yyyy = d.getFullYear();
  return yyyy+'-'+mm+'-'+dd;
}

function fechaFormat(dateObj){
  var d = dateObj instanceof Date ? dateObj : new Date(dateObj);
  var mm = String(d.getMonth()+1).padStart(2,'0');
  var dd = String(d.getDate()).padStart(2,'0');
  var yyyy = d.getFullYear();
  return mm+'/'+dd+'/'+yyyy;
}

function formatoMoneda(input){
  var digitos = input.value.replace(/\D/g,'');
  digitos = digitos.replace(/^0+(?=\d)/,'');
  if(digitos === '') digitos = '0';
  while(digitos.length < 3) digitos = '0' + digitos;
  var entero = digitos.slice(0, -2);
  var decimales = digitos.slice(-2);
  // La coma de los miles, para que se lea como dinero: 2554.87 -> 2,554.87
  entero = entero.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  input.value = entero + '.' + decimales;
}

// Campo de COSTO con precision completa -a diferencia de formatoMoneda, que siempre fuerza
// exactamente 2 decimales tipo calculadora-. Esto es porque algunos suplidores facturan el
// costo por unidad con mas de 2 decimales -por ejemplo $3.9589-, resultado de dividir el precio
// de una caja entre las unidades. Forzar solo 2 decimales aqui causaba diferencias de centavos
// o hasta dolares en facturas con muchas unidades. Se escribe el punto decimal normal, como en
// una calculadora de verdad -no como los demas campos de dinero de la app, que autoinsertan el
// punto-.
// Ensena un costo respetando los decimales que traiga: 4.00 se ve "4.00" y 4.4589 se ve
// "4.4589". Antes se usaba .toFixed(2) a secas y en pantalla se perdian los decimales de mas
// -aunque por dentro estuvieran bien-, asi que al corregir a mano se guardaba el redondeado.
function ponerComaSiHaceFalta(input){
  var v = String(input.value || '');
  if(v.indexOf(',') >= 0) return;
  var partes = v.split('.');
  if(!partes[0]) return;
  partes[0] = partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  input.value = partes.join('.');
}

function formatoMonedaEdit(input, i){
  formatoMoneda(input);
  if(typeof actualizarItemEdit === 'function') actualizarItemEdit(i);
}

var scannerStream = null;
var scannerLoop = null;

function abrirEscanerSKU(){
  document.getElementById('ep-sku-foto').click();
}

var _escaneoVivoStream = null;
var _escaneoVivoActivo = false;
var _escaneoVivoInputDestino = null;

function iniciarEscaneoVivo(inputDestinoId){
  if(!('BarcodeDetector' in window)){
    alert('Tu navegador no soporta el escaneo en vivo con cámara. Usa el botón 📷 para tomar una foto del código en su lugar.');
    return;
  }
  _escaneoVivoInputDestino = inputDestinoId;
  var overlay = document.getElementById('scanner-overlay');
  var video = document.getElementById('scanner-video');
  var msg = document.getElementById('scanner-msg');
  msg.style.display = 'none';

  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    .then(function(stream){
      _escaneoVivoStream = stream;
      video.srcObject = stream;
      overlay.style.display = 'block'; overlay.scrollTop = 0;
      _escaneoVivoActivo = true;

      var detector = new BarcodeDetector({ formats: ['ean_13','ean_8','upc_a','upc_e','code_128','code_39','codabar','qr_code','data_matrix','itf'] });

      function ciclo(){
        if(!_escaneoVivoActivo) return;
        detector.detect(video).then(function(codes){
          if(codes.length > 0 && _escaneoVivoActivo){
            var codigo = codes[0].rawValue;
            _escaneoVivoActivo = false;
            var elDestino = document.getElementById(_escaneoVivoInputDestino);
            if(elDestino) elDestino.value = codigo;
            msg.textContent = '✓ Código leído: ' + codigo;
            msg.style.display = 'block';
            msg.style.color = '#69F0AE';
            setTimeout(cerrarEscanerSKU, 700);
          } else if(_escaneoVivoActivo){
            requestAnimationFrame(ciclo);
          }
        }).catch(function(){
          if(_escaneoVivoActivo) requestAnimationFrame(ciclo);
        });
      }
      requestAnimationFrame(ciclo);
    })
    .catch(function(err){
      alert('No se pudo acceder a la cámara. Revisa que le hayas dado permiso a la app, o usa el botón 📷 para tomar una foto en su lugar.');
    });
}

function cerrarEscanerSKU(){
  _escaneoVivoActivo = false;
  var overlay = document.getElementById('scanner-overlay');
  var video = document.getElementById('scanner-video');
  if(_escaneoVivoStream){
    _escaneoVivoStream.getTracks().forEach(function(track){ track.stop(); });
    _escaneoVivoStream = null;
  }
  video.srcObject = null;
  overlay.style.display = 'none';
}

// Recortador de fotos reutilizable: muestra un cuadro donde se puede arrastrar y hacer zoom
// antes de confirmar. Al confirmar, llama a onConfirmar(dataUrlRecortado).
function llenarProveedoresPref(){
  suplidores = LS('nsup', []);
  var sel = document.getElementById('ep-proveedor-pref');
  if(!sel) return;
  var actual = sel.value;
  sel.innerHTML = '<option value="">Sin asignar</option>' + suplidores.map(function(s){
    return '<option value="'+s.nombre.replace(/"/g,"'")+'">'+escaparHtml(s.nombre)+'</option>';
  }).join('');
  sel.value = actual;
}

function onBarberoNuevoInput(){
  var val = document.getElementById('ped-barbero-nuevo').value;
  if(!val || val.length < 1){ ocultarDropdown('ped-barbero-nuevo'); return; }
  clientes = LS('ncl', []);
  // Sugerir nombres de clientes existentes en la misma barbería seleccionada
  var nombres = {};
  clientes.forEach(function(c){
    if(pedBarberiaSel && (c.negocio||'').trim() !== pedBarberiaSel) return;
    nombres[c.nombre+' '+c.apellido] = true;
  });
  var q = val.toLowerCase();
  var matches = filtrarPorBusqueda(Object.keys(nombres), q, function(n){ return n; });
  mostrarDropdown('ped-barbero-nuevo-drop', matches, 'ped-barbero-nuevo', function(nombre){
    document.getElementById('ped-barbero-nuevo').value = nombre;
  });
}

function onNegocioInput(inputId){
  var val = document.getElementById(inputId).value;
  if(!val || val.length < 1){ ocultarDropdown(inputId); return; }
  clientes = LS('ncl', []);
  var negocios = {};
  clientes.forEach(function(c){ if(c.negocio && c.negocio.trim()) negocios[c.negocio.trim()] = true; });
  var q = val.toLowerCase();
  var matches = filtrarPorBusqueda(Object.keys(negocios), q, function(n){ return n; });
  mostrarDropdown(inputId+'-drop', matches, inputId, function(neg){
    document.getElementById(inputId).value = neg;
    // Si esta barberia ya tiene otro barbero registrado con su direccion, se copia automaticamente
    // -para no tener que escribirla de nuevo cada vez que se agrega otro barbero del mismo lugar-.
    autocompletarDireccionDeNegocio(inputId, neg);
  });
}

// Copia la direccion -de un cliente que ya tenga registrada esa misma barberia- a los campos
// de direccion del formulario correspondiente. Solo llena los campos que esten vacios, para no
// pisar algo que el usuario ya haya escrito a mano.
function autocompletarDireccionDeNegocio(inputIdNegocio, nombreNegocio){
  clientes = LS('ncl', []);
  var conEsaDireccion = clientes.find(function(c){
    return (c.negocio||'').trim().toLowerCase() === nombreNegocio.trim().toLowerCase() && (c.dir || c.ciudad);
  });
  if(!conEsaDireccion) return;

  // Mapa de que campos de direccion usar segun el formulario -nuevo cliente vs editar cliente-
  var mapaCampos = inputIdNegocio === 'cne'
    ? { dir:'cd', ciudad:'ccity', estado:'cstate', zip:'czip' }
    : { dir:'ecl-d', ciudad:'ecl-ci', estado:'ecl-st', zip:'ecl-z' };

  var huboAutocompletado = false;
  Object.keys(mapaCampos).forEach(function(campo){
    var el = document.getElementById(mapaCampos[campo]);
    // Se sobreescribe siempre -no solo si esta vacio-, ya que elegir una barberia del listado
    // es una accion explicita e intencional: si la persona cambia de barberia una segunda vez,
    // se espera que la direccion se actualice tambien, no que se quede con la de la eleccion anterior.
    if(el && conEsaDireccion[campo]){
      el.value = conEsaDireccion[campo];
      huboAutocompletado = true;
    }
  });
  if(huboAutocompletado){
    var avisoId = inputIdNegocio === 'cne' ? 'c-aviso-direccion-auto' : 'ecl-aviso-direccion-auto';
    var aviso = document.getElementById(avisoId);
    if(!aviso){
      aviso = document.createElement('div');
      aviso.id = avisoId;
      aviso.style.cssText = 'background:#E8F5E9;color:#2E7D32;border-radius:8px;padding:8px 10px;font-size:11px;margin:-4px 0 8px';
      var campoNegocio = document.getElementById(inputIdNegocio);
      campoNegocio.parentNode.insertBefore(aviso, campoNegocio.nextSibling);
    }
    aviso.textContent = '✓ Dirección copiada automáticamente de otro barbero de "'+nombreNegocio+'" — puedes cambiarla si hace falta.';
    aviso.style.display = 'block';
    setTimeout(function(){ if(aviso) aviso.style.display = 'none'; }, 6000);
  }
}

function onCategoriaInput(inputId){
  var val = document.getElementById(inputId).value;
  if(!val || val.length < 1){ ocultarDropdown(inputId); return; }
  loadProds();
  var cats = {};
  productos.forEach(function(p){ if(p.cat) cats[p.cat] = true; });
  var q = val.toLowerCase();
  var matches = filtrarPorBusqueda(Object.keys(cats), q, function(c){ return c; });
  mostrarDropdown(inputId+'-drop', matches, inputId, function(cat){
    document.getElementById(inputId).value = cat;
  });
}

function actualizarNombreEnPendientes(pid, nombreNuevo){
  if(!pid || !nombreNuevo) return { pedidos: 0, carrito: 0, aMedias: 0, relleno: 0 };
  var pidT = String(pid);
  var r = { pedidos: 0, carrito: 0, aMedias: 0, relleno: 0 };

  // ── 1. Los pedidos pendientes ──
  try {
    var peds = LS('npedidos', []);
    var cambio = false;
    peds.forEach(function(p){
      (p.items || []).forEach(function(it){
        if(String(it.pid) === pidT && it.nombre !== nombreNuevo){
          it.nombre = nombreNuevo; cambio = true; r.pedidos++;
        }
      });
    });
    if(cambio){ SS('npedidos', peds); try { pedidos = LS('npedidos', []); } catch(e){} }
  } catch(e){}

  // ── 2. El carrito de la venta que esté abierta ──
  try {
    if(typeof iV !== 'undefined' && Array.isArray(iV)){
      iV.forEach(function(it){
        if(String(it.pid) === pidT && it.nombre !== nombreNuevo){
          it.nombre = nombreNuevo; r.carrito++;
        }
      });
      if(r.carrito) { try { renderIV(); } catch(e){} }
    }
  } catch(e){}

  // ── 3. El pedido a medias de varios barberos ──
  try {
    if(typeof pedidosMultiTemp !== 'undefined' && Array.isArray(pedidosMultiTemp)){
      pedidosMultiTemp.forEach(function(p){
        (p.items || []).forEach(function(it){
          if(String(it.pid) === pidT && it.nombre !== nombreNuevo){
            it.nombre = nombreNuevo; r.aMedias++;
          }
        });
      });
      if(r.aMedias){
        try { guardarPedidoEnProceso(); } catch(e){}
        try { if(pantallaActual() === 'p-ped') renderPedidosMultiples(); } catch(e){}
      }
    }
    // Y el que esté guardado en el aparato, aunque no esté abierto ahora
    var enProceso = LS('nbs_pedido_en_proceso', null);
    if(enProceso && enProceso.barberos){
      var c2 = false;
      enProceso.barberos.forEach(function(p){
        (p.items || []).forEach(function(it){
          if(String(it.pid) === pidT && it.nombre !== nombreNuevo){
            it.nombre = nombreNuevo; c2 = true; r.aMedias++;
          }
        });
      });
      if(c2) SS('nbs_pedido_en_proceso', enProceso);
    }
  } catch(e){}

  // ── 4. La lista de relleno ──
  try {
    var rel = LS('nrelleno', {});
    var c3 = false;
    (rel.items || []).forEach(function(it){
      if(String(it.pid) === pidT && it.nombre && it.nombre !== nombreNuevo){
        it.nombre = nombreNuevo; c3 = true; r.relleno++;
      }
    });
    if(c3){ SS('nrelleno', rel); try { listaRelleno = LS('nrelleno', {}); } catch(e){} }
  } catch(e){}

  return r;
}

// El aviso, solo si de verdad cambió algo en algún sitio
function avisarNombreActualizado(r){
  if(!r) return;
  var total = (r.pedidos || 0) + (r.carrito || 0) + (r.aMedias || 0) + (r.relleno || 0);
  if(!total) return;
  var partes = [];
  if(r.pedidos)  partes.push(r.pedidos + ' en pedidos pendientes');
  if(r.carrito)  partes.push(r.carrito + ' en la venta que tienes abierta');
  if(r.aMedias)  partes.push(r.aMedias + ' en el pedido a medias');
  if(r.relleno)  partes.push(r.relleno + ' en la lista de relleno');
  try {
    avisoChico('\ud83d\udd04 Nombre actualizado tambi\u00e9n en ' + partes.join(' y '));
  } catch(e){}
}


// ═══════════════════════════════════════════════════════════════════
//  🏷️ EL NOMBRE CORREGIDO, TAMBIÉN EN LAS FACTURAS VIEJAS
//
//  🔑 Sensei, 19 ago: "si cambio el nombre de un producto que ya vendí en
//  el pasado, que también cambie el nombre en la factura vieja".
//
//  🔒 EL PRECIO NUNCA SE TOCA. Eso es lo que le cobró al cliente y no puede
//  cambiar. Solo el nombre, que es una etiqueta.
//
//  ⚠️ Y SE LE PREGUNTA ANTES: si algún día reusa un producto para otra cosa
//  distinta, las facturas viejas dirían algo que nunca vendió.
// ═══════════════════════════════════════════════════════════════════

// ¿En cuántas facturas está este producto con el nombre viejo?
function renombrarEnFacturasViejas(pid, nombreViejo, nombreNuevo){
  var tocadas = 0;

  // ── LAS VENTAS ──
  var V = LS('nv', []);
  V.forEach(function(v){
    var cambio = false;
    (v.items || []).forEach(function(it){
      if(String(it.pid) !== String(pid)) return;
      if(String(it.nombre || '') !== String(nombreViejo)) return;
      // 🔒 SOLO el nombre. El precio, el costo y la cantidad NO se tocan.
      it.nombre = nombreNuevo;
      cambio = true;
    });
    if(cambio) tocadas++;
  });
  if(tocadas){ SS('nv', V); ventas = LS('nv', []); try { marcarPendienteDeSubir('nv'); } catch(e){} }

  // ── LAS COMPRAS ──
  var C = LS('nc', []);
  var tocadasC = 0;
  C.forEach(function(c){
    var cambio = false;
    (c.items || []).forEach(function(it){
      if(String(it.pid) !== String(pid)) return;
      if(String(it.nombre || '') !== String(nombreViejo)) return;
      it.nombre = nombreNuevo;
      cambio = true;
    });
    if(cambio) tocadasC++;
  });
  if(tocadasC){ SS('nc', C); try { marcarPendienteDeSubir('nc'); } catch(e){} }

  return { ventas: tocadas, compras: tocadasC };
}

// La pregunta que se le hace
function preguntarRenombrarViejas(pid, nombreViejo, nombreNuevo){
  if(!pid || !nombreViejo || !nombreNuevo) return;
  if(String(nombreViejo) === String(nombreNuevo)) return;
  var d = dondeApareceElProducto(pid, nombreViejo);
  if(!d.ventas && !d.compras) return;   // no está en ninguna factura vieja

  var msj = '\u{1F3F7}\u{FE0F} Le cambiaste el nombre a este producto.\n\n'
    + 'De:  "' + nombreViejo + '"\n'
    + 'A:   "' + nombreNuevo + '"\n\n'
    + 'Est\u00e1 en ' + d.ventas + ' factura(s) de venta'
    + (d.compras ? ' y ' + d.compras + ' de compra' : '') + ' que ya hiciste.\n\n'
    + '\u00bfCorregir el nombre tambi\u00e9n en esas facturas?\n\n'
    + '\u{1F512} Los precios NO se tocan \u2014 solo el nombre.';

  if(!confirm(msj)) return;
  var r = renombrarEnFacturasViejas(pid, nombreViejo, nombreNuevo);
  avisoGrande('\u2705 Nombre corregido en ' + r.ventas + ' factura(s) de venta'
    + (r.compras ? ' y ' + r.compras + ' de compra' : '') + '.\n\n'
    + 'Ning\u00fan precio se toc\u00f3.');
}

function abrirBuscadorProfundo(){
  var ov = document.getElementById('buscprof-ov');
  if(!ov){
    ov = document.createElement('div');
    ov.id = 'buscprof-ov';
    document.body.appendChild(ov);
  }
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:99997;'
    + 'overflow-y:auto;padding:18px 14px';
  ov.innerHTML = '<div style="max-width:470px;margin:0 auto;background:#fff;border-radius:14px;'
    + 'padding:18px">'
    + '<div style="font-size:18px;font-weight:900;margin-bottom:4px">'
    +   '\u{1F50E} Buscador profundo</div>'
    + '<div style="font-size:12.5px;color:var(--nbs-muted);line-height:1.55;margin-bottom:13px">'
    +   'Escribe parte del nombre de un producto que no encuentras. Voy a buscarlo por '
    +   '<b>todos lados</b> y te digo exactamente d\u00f3nde est\u00e1 y por qu\u00e9 no lo ves.</div>'
    + '<input class="inp" id="buscprof-txt" type="text" placeholder="Ej: 700ml" '
    +   'style="margin:0 0 10px" autocomplete="off">'
    + '<button onclick="correrBuscadorProfundo()" class="btn" style="width:100%;margin:0 0 8px;'
    +   'background:#00695C;color:#fff;font-weight:900;padding:13px">\u{1F50E} Buscarlo</button>'
    + '<button onclick="cerrarBuscadorProfundo()" class="btn" style="width:100%;margin:0;'
    +   'background:#F0F0F5;color:#333">Cerrar</button>'
    + '<div id="buscprof-res" style="margin-top:14px"></div>'
    + '</div>';
  setTimeout(function(){
    var i = document.getElementById('buscprof-txt');
    if(i) i.focus();
  }, 200);
}

function cerrarBuscadorProfundo(){
  var ov = document.getElementById('buscprof-ov');
  if(ov) ov.remove();
}

function correrBuscadorProfundo(){
  var q = (document.getElementById('buscprof-txt') || {}).value || '';
  q = String(q).trim();
  if(!q){ alert('Escribe parte del nombre del producto.'); return; }
  var qn = normalizarTextoBusqueda(q);
  var el = document.getElementById('buscprof-res');
  if(!el) return;

  var hallazgos = [];
  var informe = [];   // para copiar y pegar

  var apunta = function(donde, texto, bueno){
    hallazgos.push({ donde: donde, texto: texto, bueno: bueno });
    informe.push((bueno ? '[OK] ' : '[!!] ') + donde + ': ' + texto);
  };

  // ── 1) EN EL ALMACÉN CRUDO (np) ──
  var np = LS('np', []);
  var enNp = np.filter(function(p){
    return normalizarTextoBusqueda((p.nombre || '') + ' ' + (p.marca || '')).indexOf(qn) >= 0;
  });
  if(enNp.length){
    enNp.forEach(function(p){
      apunta('Guardado en el aparato',
        '"' + p.nombre + '"  id:' + p.id + '  marca:' + (p.marca || '(sin marca)')
        + '  $' + fmtNum(p.precio) + '  ' + (p.stock || 0) + ' unid', true);
    });
  } else {
    apunta('Guardado en el aparato', 'NO EST\u00c1 en la lista de productos guardados', false);
  }

  // ── 2) EN LA LISTA QUE VE LA APP ──
  loadProds();
  var enVista = productos.filter(function(p){
    return normalizarTextoBusqueda((p.nombre || '') + ' ' + (p.marca || '')).indexOf(qn) >= 0;
  });
  if(enVista.length){
    apunta('Lo que la app muestra', enVista.length + ' producto(s) \u2014 S\u00cd deber\u00eda verse', true);
  } else {
    apunta('Lo que la app muestra', 'NO aparece \u2014 por eso no lo ves', false);
  }

  // ── 3) EN LA LISTA DE ELIMINADOS ──
  var elim = LS('np_eliminados', []);
  var elimAqui = [];
  enNp.concat(enVista).forEach(function(p){
    if(elim.indexOf(String(p.id)) >= 0 && elimAqui.indexOf(String(p.id)) < 0){
      elimAqui.push(String(p.id));
    }
  });
  if(elimAqui.length){
    apunta('Lista de eliminados',
      '\u{1F534} SU ID EST\u00c1 MARCADO COMO BORRADO: ' + elimAqui.join(', ')
      + '  \u2014 por eso la app lo esconde', false);
  } else {
    apunta('Lista de eliminados', 'no est\u00e1 marcado como borrado ('
      + elim.length + ' ids en esa lista)', true);
  }

  // ── 4) EN LA LISTA DE FÁBRICA (PRODS) ──
  var enFabrica = (typeof PRODS !== 'undefined' && PRODS.length)
    ? PRODS.filter(function(p){
        return normalizarTextoBusqueda((p.nombre || '') + ' ' + (p.marca || '')).indexOf(qn) >= 0;
      }) : [];
  apunta('Lista original del cat\u00e1logo',
    enFabrica.length ? enFabrica.length + ' producto(s)' : 'no est\u00e1 (es un producto que creaste t\u00fa)',
    true);

  // ── 5) EN LAS FACTURAS DE VENTA ──
  var V = LS('nv', []);
  var enVentas = [], pidsVenta = {};
  V.forEach(function(v){
    if(v.cancelada) return;
    (v.items || []).forEach(function(it){
      if(normalizarTextoBusqueda(it.nombre || '').indexOf(qn) < 0) return;
      enVentas.push({ f: v.fecha, cn: v.cn, cant: it.cant, pr: it.precio, pid: it.pid });
      pidsVenta[String(it.pid)] = (pidsVenta[String(it.pid)] || 0) + 1;
    });
  });
  if(enVentas.length){
    var ult = enVentas[enVentas.length - 1];
    apunta('Facturas de venta',
      enVentas.length + ' vez/veces \u2014 la \u00faltima el ' + ult.f + ' a ' + (ult.cn || '?')
      + ' ($' + fmtNum(ult.pr) + ')', true);
    apunta('El id que usan las facturas',
      Object.keys(pidsVenta).map(function(k){ return k + ' (\u00d7' + pidsVenta[k] + ')'; }).join(', '),
      true);
  } else {
    apunta('Facturas de venta', 'nunca se ha vendido con ese nombre', true);
  }

  // ── 6) ¿EL ID DE LA FACTURA COINCIDE CON EL DEL PRODUCTO? ──
  if(enVentas.length && enNp.length){
    var idsProd = enNp.map(function(p){ return String(p.id); });
    var idsFact = Object.keys(pidsVenta);
    var pegan = idsFact.filter(function(i){ return idsProd.indexOf(i) >= 0; });
    if(pegan.length){
      apunta('\u00bfPegan los ids?', 'S\u00cd \u2014 la factura y el producto son el mismo', true);
    } else {
      apunta('\u00bfPegan los ids?',
        '\u{1F534} NO PEGAN. El producto tiene el id ' + idsProd.join('/')
        + ' pero las facturas usan ' + idsFact.join('/')
        + ' \u2014 son DOS cosas distintas', false);
    }
  }

  // ── 7) EN LAS COMPRAS ──
  var C = LS('nc', []);
  var enCompras = 0;
  C.forEach(function(c){
    (c.items || []).forEach(function(it){
      if(normalizarTextoBusqueda(it.nombre || '').indexOf(qn) >= 0) enCompras++;
    });
  });
  apunta('Facturas de compra', enCompras ? enCompras + ' vez/veces' : 'nunca lo has comprado', true);

  // ── 8) ¿LA BÚSQUEDA DEL CATÁLOGO LO ENCUENTRA? ──
  try {
    var sacar = function(x){ return (x.nombre || '') + ' ' + (x.marca || '') + ' ' + (x.cat || ''); };
    var res = filtrarPorBusqueda(productos, q, sacar);
    var lugar = -1;
    for(var i = 0; i < res.length; i++){
      if(normalizarTextoBusqueda(sacar(res[i])).indexOf(qn) >= 0){ lugar = i + 1; break; }
    }
    apunta('El buscador del cat\u00e1logo',
      lugar > 0 ? 'S\u00cd lo encuentra \u2014 sale en el puesto ' + lugar + ' de ' + res.length
                : '\u{1F534} NO lo encuentra (' + res.length + ' resultados)',
      lugar > 0);
  } catch(e){
    apunta('El buscador del cat\u00e1logo', 'no se pudo probar', false);
  }

  // ══ PINTAR ══
  var malos = hallazgos.filter(function(x){ return !x.bueno; });
  var h = '<div style="background:' + (malos.length ? 'var(--nbs-red-bg)' : 'var(--nbs-green-bg)')
    + ';border-radius:11px;padding:13px;margin-bottom:11px">'
    + '<div style="font-size:14px;font-weight:900;color:'
    + (malos.length ? 'var(--nbs-red-text)' : 'var(--nbs-green-text)') + '">'
    + (malos.length ? '\u{1F534} Encontr\u00e9 ' + malos.length + ' cosa(s) que explican el problema'
                    : '\u2705 Todo se ve normal con ese producto')
    + '</div></div>';

  hallazgos.forEach(function(x){
    h += '<div style="border-left:4px solid ' + (x.bueno ? '#2E7D32' : '#C62828') + ';'
      + 'background:#FAFAFC;border-radius:0 8px 8px 0;padding:9px 12px;margin-bottom:7px">'
      + '<div style="font-size:11px;font-weight:900;color:var(--nbs-muted);letter-spacing:.4px">'
      +   (x.bueno ? '\u2705 ' : '\u{1F534} ') + x.donde.toUpperCase() + '</div>'
      + '<div style="font-size:12.5px;color:var(--nbs-ink);margin-top:3px;line-height:1.45;'
      +   'word-break:break-word">' + escaparHtml(x.texto) + '</div></div>';
  });

  // 🔑 Y el informe listo para copiar y mandármelo
  var texto = 'BUSCADOR PROFUNDO \u2014 "' + q + '"\n'
    + fechaHoy() + '\n\n' + informe.join('\n');
  h += '<button onclick="copiarInformeProfundo()" class="btn" style="width:100%;margin:12px 0 0;'
    + 'background:var(--nbs-gold);color:#fff;font-weight:900;padding:12px">'
    + '\u{1F4CB} Copiar esto para mand\u00e1rselo a Claude</button>';
  window._informeProfundo = texto;
  el.innerHTML = h;
}

function copiarInformeProfundo(){
  var t = window._informeProfundo || '';
  if(!t) return;
  try {
    navigator.clipboard.writeText(t).then(function(){
      avisoGrande('\u{1F4CB} Copiado.\n\nP\u00e9gaselo a Claude en el chat.');
    }).catch(function(){ _copiarALaViejaProfundo(t); });
  } catch(e){ _copiarALaViejaProfundo(t); }
}

function _copiarALaViejaProfundo(t){
  var ta = document.createElement('textarea');
  ta.value = t;
  ta.style.cssText = 'position:fixed;top:10px;left:10px;width:92%;height:60%;z-index:99999;'
    + 'font-size:12px;padding:10px';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); } catch(e){}
  setTimeout(function(){ ta.remove(); }, 100);
  avisoGrande('\u{1F4CB} Copiado.\n\nP\u00e9gaselo a Claude en el chat.');
}

function syncVcl(){
  clientes = LS('ncl',[]);
  var s = document.getElementById('vcl');
  if(!s) return;
  s.innerHTML = '<option value="">-- Cliente general --</option>';
  clientes.forEach(function(c){
    var o = document.createElement('option');
    o.value = c.id;
    o.textContent = nombreCl(c) + (c.negocio?' - '+c.negocio:'');
    s.appendChild(o);
  });
}

function filterV(q){
  loadProds();
  var el = document.getElementById('vlist');
  el.innerHTML = '';
  var list = [].concat(productos).sort(function(a,b){return a.nombre.localeCompare(b.nombre);});
  if(q && q.trim()) list = filtrarPorBusqueda(list, q, function(p){ return p.nombre; });
  if(!list.length){ el.style.display='none'; return; }
  el.style.display = 'block';
  list.forEach(function(p){
    var d = document.createElement('div');
    d.style.cssText = 'padding:12px;border-bottom:1px solid #f0f0f0;cursor:pointer;font-size:13px;background:'+(p.stock<=0?'#FFCDD2':p.stock<=p.min?'#FFF9C4':'white');
    d.innerHTML = '<div style="font-weight:600">'+escaparHtml(p.nombre)+'</div><div style="color:#aaa;font-size:11px">'+p.cat+' · Stock:'+p.stock+' · $'+fmtNum(p.precio)+'</div>';
    d.onclick = (function(pid){ return function(){ selV(pid); }; })(p.id);
    el.appendChild(d);
  });
}

function selV(id){
  var p = productos.find(function(x){ return String(x.id)===String(id); }); if(!p) return;
  // Agregar directamente con cantidad 1
  document.getElementById('vlist').style.display = 'none';
  document.getElementById('vb').value = '';
  document.getElementById('vchip').style.display = 'none';
  // Verificar stock
  if(p.stock < 1){
    if(!confirm('Stock insuficiente (hay '+p.stock+'). ¿Vender de todas formas?')) return;
  }
  agregarProducto(p.id, 1, p);
  // Flash visual
  var flash = document.createElement('div');
  flash.textContent = '✅ '+escaparHtml(p.nombre)+' agregado';
  flash.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#2E7D32;color:white;padding:10px 20px;border-radius:20px;font-size:13px;font-weight:700;z-index:9999;opacity:1;transition:opacity 0.5s';
  document.body.appendChild(flash);
  setTimeout(function(){ flash.style.opacity='0'; setTimeout(function(){ flash.remove(); }, 500); }, 1500);
}

function clearV(){
  if(document.getElementById('vsel')) document.getElementById('vsel').value='';
  document.getElementById('vchip').style.display='none';
  document.getElementById('vb').value='';
}

function addIV(){
  var pid = document.getElementById('vsel').value;
  if(!pid) return;
  var cant = parseInt(document.getElementById('vcant').value)||1;
  var prod = null;
  for(var i=0;i<productos.length;i++){
    if(String(productos[i].id)===String(pid)){ prod=productos[i]; break; }
  }
  if(!prod) return;
  if(prod.stock < cant){
    // Show inline warning instead of confirm
    var warn = document.getElementById('stock-warn');
    if(!warn){
      warn = document.createElement('div');
      warn.id = 'stock-warn';
      warn.style.cssText = 'background:#FFEBEE;border-radius:8px;padding:12px;margin:8px 0;font-size:13px';
      document.getElementById('iv').parentNode.insertBefore(warn, document.getElementById('iv'));
    }
    warn.innerHTML = '<b>&#9888; Stock insuficiente (hay '+prod.stock+').</b> <button onclick="forzarAgregar()" style="background:#D32F2F;color:white;border:none;padding:6px 12px;border-radius:6px;cursor:pointer;font-size:13px;margin-left:8px">Vender de todas formas</button> <button onclick="ocultarWarn()" style="background:#546E7A;color:white;border:none;padding:6px 12px;border-radius:6px;cursor:pointer;font-size:13px;margin-left:4px">Cancelar</button>';
    warn.style.display = 'block';
    return;
  }
  agregarProducto(pid, cant, prod);
}

function ocultarWarn(){ var w=document.getElementById("stock-warn"); if(w) w.style.display="none"; }
function forzarAgregar(){
  var pid = document.getElementById('vsel').value;
  var cant = parseInt(document.getElementById('vcant').value)||1;
  var prod = null;
  for(var i=0;i<productos.length;i++){
    if(String(productos[i].id)===String(pid)){ prod=productos[i]; break; }
  }
  if(!prod) return;
  var warn = document.getElementById('stock-warn');
  if(warn) warn.style.display='none';
  agregarProducto(pid, cant, prod);
}

// Muestra los productos que ESTE cliente compra más seguido, como botones grandes.
// Tocar uno lo agrega a la venta al instante (con su precio personalizado si tiene).
// Ahorra tener que buscar y escribir el producto en cada venta.
// 👤 Pinta arriba, bien grande, a quien le estas vendiendo. Se llama al escoger cliente
// y cada vez que se abre la pantalla de Vender. -21 ago-
// Vuelve a enseñar el buscador y el desplegable para escoger otro cliente. -21 ago-
function pintarAQuienLeVendo(){
  var caja = document.getElementById('v-quien');
  if(!caja) return;
  var esc = document.getElementById('v-escoger-cliente');
  var sel = document.getElementById('vcl');
  var cid = sel ? sel.value : '';
  // 📏 Sin cliente escogido: se enseña el buscador. Con cliente: se esconde y manda la
  // franja azul, que ya dice quien es y trae su boton de Cambiar. Así la pantalla no repite
  // el mismo dato tres veces. -Sensei, 21 ago: "hay demasiada informacion, es muy largo"-
  if(esc) esc.style.display = cid ? 'none' : 'block';
  if(!cid){ caja.style.display = 'none'; return; }
  clientes = LS('ncl', []);
  var c = clientes.find(function(x){ return String(x.id) === String(cid); });
  if(!c){ caja.style.display = 'none'; return; }

  var nom = [c.nombre, c.apellido].filter(function(x){ return String(x||'').trim(); }).join(' ').trim();
  if(String(c.apodo||'').trim()) nom += ' "' + String(c.apodo).trim() + '"';
  document.getElementById('v-quien-nombre').textContent = nom || 'Cliente';
  var neg = String(c.negocio||'').trim();
  var elNeg = document.getElementById('v-quien-negocio');
  elNeg.textContent = neg ? ('\ud83c\udfea ' + neg) : '';
  elNeg.style.display = neg ? 'block' : 'none';
  caja.style.display = 'block';
}

function agregarFavorito(pid){
  loadProds();
  var prod = productos.find(function(p){ return String(p.id)===String(pid); });
  if(!prod){ alert('Ese producto ya no está en el catálogo.'); return; }
  agregarProducto(prod.id, 1, prod);
}

// Repite la última venta de este cliente: pone en el carrito los mismos productos
// y cantidades que compró la última vez. Ahorra armar toda la venta de nuevo.
function onDescTipoChange(){
  var tipo = document.getElementById('vdesc-tipo').value;
  var val = document.getElementById('vdesc-val');
  // Al cambiar de tipo, reiniciar el campo con el formato correcto para cada caso
  val.value = tipo === 'monto' ? '0.00' : '0';
  calcDesc();
}

function onDescInput(input){
  var tipo = document.getElementById('vdesc-tipo').value;
  if(tipo === 'monto'){
    formatoMoneda(input); // formato tipo calculadora, solo tiene sentido para montos en $
  }
  calcDesc();
}

function cambiarCantIV(i, delta){
  if(!iV[i]) return;
  var nueva = (iV[i].cant||1) + delta;
  if(nueva < 1) nueva = 1;
  iV[i].cant = nueva;
  renderIV();
}

function rmIV(i){ iV.splice(i,1); renderIV(); }

// ═══════════════════════════════════════════════════════════════════════════
//  FIRMA DEL CLIENTE  (18 jul 2026, pedido por Sensei)
//  Al registrar una venta, pregunta si el cliente debe firmar. Si sí, abre un
//  recuadro para firmar con el dedo. La firma se guarda con la factura.
// ═══════════════════════════════════════════════════════════════════════════

// Este es el nuevo punto de entrada del botón "Registrar venta".
// Primero valida que haya productos, luego pregunta por la firma.
// COBRO RÁPIDO: para la venta más común (contado, efectivo). Pone contado + efectivo
// y registra la venta de una vez, sin tener que elegir tipo ni forma de pago.
// Los casos especiales (crédito, CashApp, Zelle) siguen con las opciones normales.
function cobroRapidoContadoEfectivo(){
  if(!iV.length){ alert('Agrega al menos un producto'); return; }
  // Poner tipo = contado
  var vtipo = document.getElementById('vtipo');
  if(vtipo){ vtipo.value = 'contado'; if(typeof actualizarLabelPagoVenta==='function') actualizarLabelPagoVenta(); }
  // Poner forma de pago = efectivo por el total
  var total = iV.reduce(function(s,it){ return s + it.cant*it.precio; }, 0);
  // aplicar descuento si hay
  try{
    var tipoD = document.getElementById('vdesc-tipo');
    var valD = dinero((document.getElementById('vdesc-val')||{}).value);
    if(tipoD && tipoD.value==='pct' && valD>0) total = total - total*(valD/100);
    else if(tipoD && tipoD.value==='monto' && valD>0) total = Math.max(0, total - valD);
  }catch(e){}
  if(window._pagoMetodos) window._pagoMetodos['vini'] = [{tipo:'efectivo', monto:total}];
  if(typeof renderMetodosPago==='function') renderMetodosPago('vini');
  // Registrar la venta (pasa por la pregunta de firma, como siempre)
  registrarVentaConFirma();
}


function sePuedeCalcularGanancia(v){
  var items = (v && v.items) || [];
  if(!items.length) return false;
  for(var i = 0; i < items.length; i++){
    if(items[i].costo === undefined || items[i].costo === null) return false;
  }
  return true;
}

function syncCCsup(){
  suplidores = LS('nsup', []);
  var s = document.getElementById('ccsup');
  if(!s) return;
  s.innerHTML = '<option value="">-- Seleccionar suplidor --</option>';
  suplidores.forEach(function(sup){
    var o = document.createElement('option');
    o.value = sup.id;
    o.textContent = sup.nombre;
    s.appendChild(o);
  });
}

function filterCC(q){
  loadProds();
  var el = document.getElementById('cclist');
  el.innerHTML = '';
  var list = [].concat(productos).sort(function(a,b){return a.nombre.localeCompare(b.nombre);});
  if(q && q.trim()) list = filtrarPorBusqueda(list, q, function(p){ return p.nombre; });
  if(!list.length){ el.style.display='none'; return; }
  el.style.display = 'block';
  list.forEach(function(p){
    var d = document.createElement('div');
    d.style.cssText = 'padding:12px;border-bottom:1px solid #f0f0f0;cursor:pointer;font-size:13px';
    d.innerHTML = '<div style="font-weight:600">'+escaparHtml(p.nombre)+'</div><div style="color:#aaa;font-size:11px">'+p.cat+' · Costo: $'+fmtNum(p.costo)+' · <b style="color:'+(p.stock<0?'#E67E22':'#2E7D32')+'">Quedan: '+p.stock+(p.stock<0?' \u26a0\ufe0f':'')+'</b></div>';
    d.onclick = (function(pid){ return function(){ selCC(pid); }; })(p.id);
    el.appendChild(d);
  });
}

function selCC(id){
  var p = productos.find(function(x){ return String(x.id)===String(id); }); if(!p) return;
  document.getElementById('ccsel').value = id;
  document.getElementById('ccsn').innerHTML = escaparHtml(p.nombre) + ' · <b style="color:'+(p.stock<0?'#E67E22':'#2E7D32')+'">Quedan ' + p.stock + (p.stock<0?' \u26a0\ufe0f':'') + '</b> · Costo: $' + fmtNum(p.costo);
  document.getElementById('cclist').style.display = 'none';
  document.getElementById('ccb').value = '';
  document.getElementById('ccchip').style.display = 'flex';
  document.getElementById('cc-nuevo-prod').style.display = 'none';
  document.getElementById('cccosto').value = p.costo.toFixed(2);
}

function clearCC(){
  document.getElementById('ccsel').value='';
  document.getElementById('ccchip').style.display='none';
  document.getElementById('ccb').value='';
}

function addCC(){
  loadProds();
  var pid = document.getElementById('ccsel').value;
  var cant = parseInt(document.getElementById('cccant').value) || 1;
  var costo = dinero(document.getElementById('cccosto').value) || 0;
  var precio = dinero(document.getElementById('ccprecio').value) || 0;

  if(pid){
    var prod = productos.find(function(x){ return String(x.id)===String(pid); });
    if(!prod) return;
    var encontrado = false;
    for(var j=0;j<iCC.length;j++){
      if(String(iCC[j].pid)===String(pid)){ iCC[j].cant += cant; iCC[j].costo = costo; encontrado = true; break; }
    }
    if(!encontrado) iCC.push({pid: prod.id, nombre: prod.nombre, cant: cant, costo: costo, esNuevo: false, precioVenta: prod.precio});
  } else {
    var marcaNueva = document.getElementById('ccnp-marca').value.trim();
    var nombreNuevo = document.getElementById('ccnp-nombre').value.trim();
    if(!nombreNuevo){ alert('Escribe el nombre del producto o selecciona uno existente'); return; }
    var catNuevo = document.getElementById('ccnp-cat').value.trim();
    iCC.push({pid: null, nombre: nombreNuevo, cat: catNuevo, marca: marcaNueva, cant: cant, costo: costo, esNuevo: true, precioVenta: precio});
  }
  document.getElementById('cccant').value = 1;
  document.getElementById('cccosto').value = '0.00';
  document.getElementById('ccprecio').value = '0.00';
  clearCC();
  // IMPORTANTE: limpiar tambien los campos de "producto nuevo" -si no se limpian, un doble toque
  // accidental en el boton -muy comun en el telefono- agregaba el mismo producto 2 veces, porque
  // los campos seguian con el mismo texto escrito.
  document.getElementById('ccnp-marca').value = '';
  document.getElementById('ccnp-nombre').value = '';
  document.getElementById('ccnp-cat').value = '';
  document.getElementById('cc-nuevo-prod').style.display = 'none';
  renderICC();
}

function renderICC(){
  var el = document.getElementById('iccp'); el.innerHTML = '';
  var tot = 0;
  iCC.forEach(function(it,i){
    // Misma proteccion que en editar compra: nunca mostrar "undefined", "NaN", ni un campo vacio.
    var cantSegura = Number(it.cant); if(!isFinite(cantSegura) || cantSegura <= 0) cantSegura = 1;
    var costoSeguro = Number(it.costo); if(!isFinite(costoSeguro) || costoSeguro < 0) costoSeguro = 0;
    it.cant = cantSegura; it.costo = costoSeguro;
    tot += cantSegura * costoSeguro;
    var row = document.createElement('div');
    row.style.cssText = 'background:#FAFAFA;border-radius:10px;padding:10px;margin-bottom:8px;border:0.5px solid #eee';
    row.innerHTML = '<div style="display:flex;gap:8px;align-items:center;margin-bottom:6px">'
      +'<input type="text" value="'+(it.nombre||'Producto sin nombre').replace(/"/g,"'")+'" data-i="'+i+'" class="icc-nombre" style="flex:1;border:0.5px solid #ddd;border-radius:6px;padding:7px 8px;font-size:13px;font-weight:600;color:var(--nbs-ink)">'
      +(it.esNuevo?' <span style="color:#795548;font-size:11px;flex-shrink:0">(nuevo)</span>':'')
      +'<button data-i="'+i+'" class="icc-quitar" style="background:var(--nbs-red-bg);color:var(--nbs-red-dark);border:none;border-radius:8px;width:36px;height:36px;cursor:pointer;font-size:15px;flex-shrink:0">✕</button>'
      +'</div>'
      +'<div style="display:flex;gap:8px;align-items:center">'
      +'<div style="display:flex;align-items:center;gap:4px">'
      +'<button data-i="'+i+'" data-d="-1" class="icc-cant" style="width:28px;height:28px;background:var(--nbs-red-bg);color:var(--nbs-red-dark);border:none;border-radius:6px;cursor:pointer;font-size:14px;font-weight:700">−</button>'
      +'<span style="width:26px;text-align:center;font-size:13px;font-weight:700">'+cantSegura+'</span>'
      +'<button data-i="'+i+'" data-d="1" class="icc-cant" style="width:28px;height:28px;background:var(--nbs-green-bg);color:var(--nbs-green-text);border:none;border-radius:6px;cursor:pointer;font-size:14px;font-weight:700">+</button>'
      +'</div>'
      +'<label style="font-size:11px;color:#aaa">Costo c/u:</label>'
      +'<input type="text" inputmode="decimal" value="'+costoSeguro+'" data-i="'+i+'" class="icc-costo" onfocus="this.select();this.dataset.modoPreciso=\'\'" style="width:65px;padding:6px;border:1px solid #ddd;border-radius:6px;font-size:12px;text-align:center">'
      +'<label style="font-size:11px;color:#1565C0;font-weight:700;margin-left:auto">Total línea:</label>'
      +'<input type="text" inputmode="decimal" value="'+(it.cant*it.costo).toFixed(2)+'" data-i="'+i+'" class="icc-total-linea" onfocus="this.select();this.dataset.modoPreciso=\'\'" style="width:65px;padding:6px;border:1.5px solid #90CAF9;border-radius:6px;font-size:12px;text-align:center;color:#1565C0;font-weight:700;background:#E3F2FD">'
      +'</div>';
    el.appendChild(row);
  });
  el.querySelectorAll('.icc-nombre').forEach(function(inp){
    inp.oninput = function(){ iCC[parseInt(inp.dataset.i)].nombre = inp.value; };
  });
  el.querySelectorAll('.icc-quitar').forEach(function(btn){
    btn.onclick = function(){ rmICC(parseInt(btn.dataset.i)); };
  });
  el.querySelectorAll('.icc-cant').forEach(function(btn){
    btn.onclick = function(){
      var i = parseInt(btn.dataset.i);
      var nuevaCant = (iCC[i].cant||1) + parseInt(btn.dataset.d);
      if(nuevaCant < 1) nuevaCant = 1;
      iCC[i].cant = nuevaCant;
      renderICC();
    };
  });
  el.querySelectorAll('.icc-costo').forEach(function(inp){
    inp.oninput = function(e){
      formatoCostoPreciso(inp, e);
      var i = parseInt(inp.dataset.i);
      iCC[i].costo = dinero(inp.value)||0;
      // No se vuelve a dibujar toda la lista aqui -perderias el foco del campo mientras escribes-,
      // solo se actualiza el numero del total de esa linea y el total general.
      var totalLineaInp = el.querySelector('.icc-total-linea[data-i="'+i+'"]');
      if(totalLineaInp) totalLineaInp.value = (iCC[i].cant*iCC[i].costo).toFixed(2);
      pintarTotalCompra();
    };
    inp.onblur = function(){
      finalizarCostoPreciso(inp);
      var i = parseInt(inp.dataset.i);
      iCC[i].costo = dinero(inp.value)||0;
      var totalLineaInp = el.querySelector('.icc-total-linea[data-i="'+i+'"]');
      if(totalLineaInp) totalLineaInp.value = (iCC[i].cant*iCC[i].costo).toFixed(2);
      pintarTotalCompra();
    };
  });
  // LA GRAN IDEA: si se escribe el TOTAL de la linea en vez del costo por unidad -muy comun en
  // facturas de suplidor que solo dan el total, no el precio unitario-, el costo se calcula solo.
  el.querySelectorAll('.icc-total-linea').forEach(function(inp){
    inp.oninput = function(e){
      formatoCostoPreciso(inp, e);
      var i = parseInt(inp.dataset.i);
      var totalEscrito = dinero(inp.value) || 0;
      var cantActual = iCC[i].cant || 1;
      var costoCalculado = Math.round((totalEscrito / cantActual) * 1000000) / 1000000;
      iCC[i].costo = costoCalculado;
      var costoInp = el.querySelector('.icc-costo[data-i="'+i+'"]');
      if(costoInp) costoInp.value = costoCalculado;
      pintarTotalCompra();
    };
    inp.onblur = function(){
      finalizarCostoPreciso(inp);
      var i = parseInt(inp.dataset.i);
      var totalEscrito = dinero(inp.value) || 0;
      var cantActual = iCC[i].cant || 1;
      var costoCalculado = Math.round((totalEscrito / cantActual) * 1000000) / 1000000;
      iCC[i].costo = costoCalculado;
      var costoInp = el.querySelector('.icc-costo[data-i="'+i+'"]');
      if(costoInp) costoInp.value = costoCalculado;
      pintarTotalCompra();
    };
  });
  // El envio y el cargo por tarjeta SUMAN, los descuentos RESTAN. Los tres van al total de la
  // compra pero NINGUNO se reparte entre los productos: el costo de cada uno se queda como esta.
  pintarTotalCompra();
}

function rmICC(i){ iCC.splice(i,1); renderICC(); }

// 💸 LOS DESCUENTOS DE LA COMPRA QUE SE ESTA ENTRANDO -Sensei, 19 ago-.
// Lee las tres casillas. El monto se escribe en POSITIVO y aqui se devuelve en positivo;
// quien lo use lo RESTA. Asi Sensei nunca tiene que acordarse de poner el signo menos.
function renderBarberias(q){
  clientes = LS('ncl', []);
  // Fuera los barberos SIN SERVICIO: no aparecen para venderles ni pedirles. -8 ago-
  var _clConServicio = soloConServicio(clientes);
  var el = document.getElementById('ped-barberia-lista');
  el.innerHTML = '';

  // Agrupar clientes por negocio/barbería
  var barberias = {};
  _clConServicio.forEach(function(c){
    var neg = (c.negocio||'').trim() || 'Sin barbería';
    if(!barberias[neg]) barberias[neg] = [];
    barberias[neg].push(c);
  });

  var keys = Object.keys(barberias).sort();

  if(q){
    var qLower = q.toLowerCase();
    // Filtrar por nombre de barbería O por nombre de barbero
    keys = keys.filter(function(k){
      // Coincide con nombre de barbería
      if(coincideBusquedaPalabras(k, qLower)) return true;
      // Coincide con nombre de algún barbero de esa barbería
      return barberias[k].some(function(c){
        return (c.nombre+' '+c.apellido+' '+(c.apodo||'')+' '+(c.tel||'')+' '+(c.dir||'')+' '+(c.ciudad||'')+' '+(c.contacto||'')+' '+(c.contactoApodo||'')+' '+(c.contactoTel||'')).toLowerCase().indexOf(qLower) >= 0;
      });
    });
  }

  if(!keys.length){
    el.innerHTML = '<p style="color:#aaa;text-align:center;padding:16px;font-size:13px">Sin resultados — prueba con otro nombre</p>';
    return;
  }

  keys.forEach(function(neg){
    // Si hay búsqueda, mostrar barberos que coincidan destacados
    var barberosCoinc = q ? barberias[neg].filter(function(c){
      return (c.nombre+' '+c.apellido+' '+(c.apodo||'')+' '+(c.tel||'')+' '+(c.dir||'')+' '+(c.ciudad||'')+' '+(c.contacto||'')+' '+(c.contactoApodo||'')+' '+(c.contactoTel||'')).toLowerCase().indexOf(q.toLowerCase()) >= 0;
    }) : [];

    var d = document.createElement('div');
    d.style.cssText = 'padding:14px;border-bottom:1px solid #f0f0f0;cursor:pointer;border-radius:8px';
    d.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center">'
      +'<div>'
      +'<div style="font-size:14px;font-weight:700">🏪 '+escaparHtml(neg)+'</div>'
      +'<div style="font-size:12px;color:#aaa;margin-top:2px">'+barberias[neg].length+' barbero(s)</div>'
      +(barberosCoinc.length ? '<div style="font-size:12px;color:#1565C0;margin-top:4px">✓ '+barberosCoinc.map(function(c){ return escaparHtml(nombreCl(c)); }).join(', ')+'</div>' : '')
      +'</div><span style="color:#ddd;font-size:20px">›</span></div>';
    d.onclick = (function(n){ return function(){ selBarberia(n, barberias[n]); }; })(neg);
    el.appendChild(d);
  });
}

function diagnosticoBarberias(nombreBuscar){
  clientes = LS('ncl', []);
  var msg = '=== DIAGNÓSTICO BARBERÍAS ===\n\n';
  var q = (nombreBuscar||'').toLowerCase();
  var encontrados = clientes.filter(function(c){
    return coincideBusquedaPalabras((c.nombre||'') + ' ' + (c.apellido||''), q);
  });
  if(!encontrados.length){
    msg += 'No se encontró ningún cliente con ese nombre.\n';
  }
  encontrados.forEach(function(c){
    msg += '👤 '+nombreCl(c)+'\n';
    msg += '  Campo negocio: "'+(c.negocio||'(VACÍO)')+'"\n';
    msg += '  Longitud: '+((c.negocio||'').length)+' caracteres\n\n';
  });
  alert(msg);
}

function selBarberia(nombre, barberos){
  pedBarberiaSel = nombre;
  document.getElementById('ped-barberia-wrap').style.display = 'none';
  document.getElementById('ped-barbero-wrap').style.display = 'block';
  document.getElementById('ped-barberia-sel-label').textContent = '🏪 '+nombre;
  document.getElementById('ped-barbero-nuevo').value = '';
  var el = document.getElementById('ped-barbero-lista');
  el.innerHTML = '';
  barberos.forEach(function(c){
    var d = document.createElement('div');
    d.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:12px;border-bottom:1px solid #f0f0f0;cursor:pointer';
    d.innerHTML = '<div class="av" style="width:36px;height:36px;font-size:14px;margin-right:10px;flex-shrink:0">'+ini(c.nombre,c.apellido)+'</div>'
      +'<div style="flex:1"><div style="font-size:17px;font-weight:800;color:#1a237e">'+escaparHtml(nombreCl(c))+'</div>'
      +'<div style="margin-top:2px">'+etiquetaBalanceHtml(c.id)+'</div></div>'
      +'<span style="color:#ddd;font-size:20px">›</span>';
    d.onclick = (function(cl){ return function(){ selBarbero(cl.id, nombreCl(cl)); }; })(c);
    el.appendChild(d);
  });
}

function selBarberoPorNombre(){
  var nombre = document.getElementById('ped-barbero-nuevo').value.trim();
  if(!nombre){ alert('Escribe el nombre del barbero'); return; }
  selBarbero(null, nombre);
}

function selBarbero(cid, nombre){
  pedBarberoCid = cid;
  pedBarberoNombre = nombre;
  // Llegaste a esa barberia: arranca el reloj para recordarte marcarla (23 jul)
  try{ marcarLlegadaBarberia(pedBarberiaSel); }catch(e){}
  document.getElementById('ped-barbero-wrap').style.display = 'none';
  document.getElementById('ped-form-wrap').style.display = 'block';
  try { ponerTextoBotonesPedido(); } catch(e){}
  try { pintarBotonCancelarPedido(); } catch(eBtn){}
  document.getElementById('ped-barbero-actual').textContent = nombre;
  document.getElementById('ped-barberia-actual').textContent = pedBarberiaSel||'';
  // Balance del cliente aqui tambien -pedido por Sensei el 24 jul-, igual que en
  // la lista de donde vino y en el resto de la app.
  var elBal = document.getElementById('ped-balance-actual');
  if(elBal) elBal.innerHTML = cid ? etiquetaBalanceHtml(cid, true) : '';
  pedItemsTemp = [];
  renderPedItems();
  renderFavoritosPedido();
}

function volverABarberias(){
  document.getElementById('ped-barbero-wrap').style.display = 'none';
  document.getElementById('ped-barberia-wrap').style.display = 'block';
  document.getElementById('ped-barberia-buscar').value = '';
  renderBarberias('');
}

function renderBarberiasInicio(q){
  clientes = LS('ncl', []);
  // Fuera los barberos SIN SERVICIO: no aparecen para venderles ni pedirles. -8 ago-
  var _clConServicio = soloConServicio(clientes);
  var el = document.getElementById('ped-inicio-lista');
  if(!el) return;
  el.innerHTML = '';

  var barberias = {};
  _clConServicio.forEach(function(c){
    var neg = (c.negocio||'').trim() || 'Sin barbería';
    if(!barberias[neg]) barberias[neg] = [];
    barberias[neg].push(c);
  });

  var keys = Object.keys(barberias).sort();
  if(q && q.trim()){
    var ql = q.toLowerCase();
    keys = keys.filter(function(k){
      if(coincideBusquedaPalabras(k, ql)) return true;
      return barberias[k].some(function(c){
        return (c.nombre+' '+c.apellido+' '+(c.apodo||'')+' '+(c.tel||'')+' '+(c.dir||'')+' '+(c.ciudad||'')+' '+(c.contacto||'')+' '+(c.contactoApodo||'')+' '+(c.contactoTel||'')).toLowerCase().indexOf(ql) >= 0;
      });
    });
    keys.forEach(function(k){ barberiasAbiertas[k] = true; });
  }

  if(!keys.length){
    el.innerHTML = '<p style="color:#aaa;text-align:center;padding:20px">Sin barberías encontradas</p>';
    return;
  }

  keys.forEach(function(neg){
    var barberos = barberias[neg];
    var abierta = barberiasAbiertas[neg];
    var selCount = barberos.filter(function(c){ return barberosSel[String(c.id)]; }).length;
    var todosSel = barberos.length > 0 && selCount === barberos.length;
    var algunoSel = selCount > 0 && !todosSel;

    var wrap = document.createElement('div');
    wrap.style.cssText = 'background:white;border-radius:12px;margin-bottom:8px;border:0.5px solid var(--nbs-line);overflow:hidden;box-shadow:var(--nbs-shadow-card)';

    var header = document.createElement('div');
    header.style.cssText = 'padding:13px 14px;display:flex;justify-content:space-between;align-items:center;cursor:pointer;background:'+(selCount>0?'var(--nbs-gold-bg)':'white')+';gap:10px';

    // Casilla para elegir TODOS los barberos de esta barberia de un solo toque -en las
    // barberias donde todos te compran, evita tener que tocarlos uno por uno-.
    var chkTodos = document.createElement('div');
    // Antes: 26px con borde de 1.5px en gris #d8d8dc sobre blanco — casi no se veia donde
    // tocar. Ahora: mas grande, borde de 2.5px y gris mas oscuro, con fondo propio.
    chkTodos.style.cssText = 'width:30px;height:30px;border-radius:8px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:900;transition:all 0.15s;'
      + (todosSel
          ? 'background:var(--nbs-gold);color:white;border:2.5px solid var(--nbs-gold);box-shadow:0 2px 6px rgba(212,160,23,0.45);'
          : (algunoSel
              ? 'background:var(--nbs-gold-bg);color:var(--nbs-gold-dark);border:2.5px solid var(--nbs-gold);'
              : 'background:#F4F4F8;border:2.5px solid #8A8A9A;color:transparent;'));
    chkTodos.textContent = todosSel ? '✓' : (algunoSel ? '−' : '');
    chkTodos.title = todosSel ? 'Quitar todos' : 'Elegir todos';
    chkTodos.onclick = (function(negocio, listaBarberos, yaEstabanTodos){
      return function(e){
        e.stopPropagation(); // que no abra/cierre la barberia al tocar la casilla
        if(yaEstabanTodos){
          listaBarberos.forEach(function(c){ delete barberosSel[String(c.id)]; });
        } else {
          listaBarberos.forEach(function(c){ barberosSel[String(c.id)] = {cliente: c, barberia: negocio}; });
          barberiasAbiertas[negocio] = true; // abrirla para que veas a quien elegiste
        }
        renderBarberiasInicio(document.getElementById('ped-inicio-buscar') ? document.getElementById('ped-inicio-buscar').value : '');
      };
    })(neg, barberos, todosSel);

    var titulo = document.createElement('div');
    titulo.style.cssText = 'font-size:14px;font-weight:600;color:var(--nbs-ink);flex:1;min-width:0';
    titulo.innerHTML = '🏪'+escaparHtml(neg);

    var contador = document.createElement('div');
    contador.style.cssText = 'font-size:12px;color:'+(selCount>0?'var(--nbs-gold-dark)':'var(--nbs-muted)')+';display:flex;align-items:center;gap:4px;flex-shrink:0;font-weight:'+(selCount>0?'700':'400');
    contador.innerHTML = (selCount>0 ? selCount+' de '+barberos.length : barberos.length+' barbero(s)')+' <span style="font-size:11px">'+(abierta?'▲':'▼')+'</span>';

    header.appendChild(chkTodos);
    header.appendChild(titulo);
    header.appendChild(contador);

    var lista = document.createElement('div');
    lista.style.cssText = 'padding:8px;display:'+(abierta?'block':'none');

    barberos.forEach(function(c){
      var cid = String(c.id);
      var seleccionado = !!barberosSel[cid];
      var nombreCompleto = nombreCl(c);

      var btn = document.createElement('div');
      btn.id = 'barb-row-'+cid;
      // La fila entera se marca cuando el barbero esta elegido -fondo dorado y una franja
      // lateral-, para que se vea a quien elegiste sin tener que mirar la casilla.
      btn.style.cssText = 'display:flex;align-items:center;gap:10px;padding:11px 12px;border-radius:9px;margin-bottom:5px;cursor:pointer;transition:all 0.15s;'
        + (seleccionado
            ? 'background:var(--nbs-gold-bg);border:1.5px solid var(--nbs-gold);border-left:5px solid var(--nbs-gold);'
            : 'background:white;border:1.5px solid var(--nbs-line);border-left:5px solid transparent;');
      // Antes: 22px con borde de 1.5px en gris #d8d8dc — casi invisible sobre blanco.
      // Ahora: mas grande, borde de 2.5px, gris mas oscuro, y fondo propio.
      btn.innerHTML = '<div id="barb-check-'+cid+'" style="width:28px;height:28px;border-radius:8px;'
        +(seleccionado
            ? 'background:var(--nbs-gold);border:2.5px solid var(--nbs-gold);box-shadow:0 2px 6px rgba(212,160,23,0.45);'
            : 'background:#F4F4F8;border:2.5px solid #8A8A9A;')
        +'display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all 0.15s">'
        +(seleccionado?'<span style="color:white;font-size:16px;font-weight:900">✓</span>':'')
        +'</div>'
        +'<div style="width:34px;height:34px;border-radius:8px;background:var(--nbs-gold-bg);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:var(--nbs-gold-dark);flex-shrink:0">'+c.nombre[0]+'</div>'
        +'<div style="font-size:18px;font-weight:'+(seleccionado?'900':'800')+';color:var(--nbs-ink);flex:1;line-height:1.2">'+escaparHtml(nombreCompleto)+'</div>'
        +(seleccionado?'<div style="font-size:13px;color:var(--nbs-gold-dark);font-weight:800">✓</div>':'');

      btn.onclick = (function(cliente, barberia, id){
        return function(){
          if(barberosSel[id]){
            delete barberosSel[id];
          } else {
            barberosSel[id] = {cliente: cliente, barberia: barberia};
          }
          renderBarberiasInicio(document.getElementById('ped-inicio-buscar') ? document.getElementById('ped-inicio-buscar').value : '');
        };
      })(c, neg, cid);

      lista.appendChild(btn);
    });

    // Botón de hacer pedido si hay seleccionados en esta barbería
    var selEnBarberia = barberos.filter(function(c){ return barberosSel[String(c.id)]; });
    if(selEnBarberia.length > 0 && abierta){
      var btnPed = document.createElement('div');
      btnPed.style.cssText = 'padding:10px;border-top:0.5px solid var(--nbs-line);background:#FAFAFA';
      btnPed.innerHTML = '<button onclick="iniciarPedidoMultiple()" style="width:100%;padding:11px;background:var(--nbs-gold);color:white;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px">⚡Hacer pedido a '+selEnBarberia.length+' seleccionado(s)</button>';
      lista.appendChild(btnPed);
    }

    header.onclick = (function(n, l, h){
      return function(){
        barberiasAbiertas[n] = !barberiasAbiertas[n];
        l.style.display = barberiasAbiertas[n] ? 'block' : 'none';
        renderBarberiasInicio(document.getElementById('ped-inicio-buscar') ? document.getElementById('ped-inicio-buscar').value : '');
      };
    })(neg, lista, header);

    wrap.appendChild(header);
    wrap.appendChild(lista);
    el.appendChild(wrap);
  });
}

// ===== PEDIDO A VARIOS BARBEROS A LA VEZ =====
// TODOS los barberos quedan abiertos al mismo tiempo, y CADA UNO tiene su propio buscador,
// microfono y lista de productos, ahi mismo dentro de su tarjeta. Nunca se sale de esta
// pantalla ni se cierra ninguna tarjeta: en la barberia los barberos piden en desorden, y
// asi se le puede agregar a cualquiera en cualquier momento sin perder de vista a los demas.
var pedidosMultiTemp = [];   // [{cliente, barberia, items:[], color}]
var pedMultiSel = {};        // idx -> id del producto elegido en el buscador de esa tarjeta
var pedMultiCant = {};       // idx -> cantidad elegida en esa tarjeta

// Cada barbero recibe su propio color, para poder ubicarlo de un vistazo sin leer el nombre.
// El color se guarda con el barbero -no se calcula por posicion-, asi que si quitas a uno con
// la ✕, los demas CONSERVAN su color en vez de cambiarse todos de golpe.
var COLORES_BARBERO = [
  { fuerte:'#1a237e', suave:'#EEF0FA' },  // azul marino
  { fuerte:'#00695C', suave:'#E4F1EF' },  // verde azulado
  { fuerte:'#C62828', suave:'#FBEAEA' },  // rojo
  { fuerte:'#6A1B9A', suave:'#F3EAF7' },  // morado
  { fuerte:'#E65100', suave:'#FDF0E6' },  // naranja
  { fuerte:'#2E7D32', suave:'#E9F3EA' },  // verde
  { fuerte:'#0277BD', suave:'#E5F1FA' },  // celeste
  { fuerte:'#AD1457', suave:'#FBE9F1' }   // fucsia
];

function abrirPantallaMultiple(){
  document.getElementById('ped-lista-wrap').style.display = 'none';
  document.getElementById('ped-form-wrap').style.display = 'none';
  document.getElementById('ped-barberia-wrap').style.display = 'none';
  document.getElementById('ped-barbero-wrap').style.display = 'none';
  document.getElementById('ped-multi-wrap').style.display = 'block';
  loadProds();
  // Todos CERRADOS al abrir, como lo pidio Sensei. Se abre el que el toque. -28 ago-
  window._barberoAbierto = null;
  renderPedidosMultiples();
  window.scrollTo(0,0);
}

// Saca los productos que este barbero SUELE comprar, mirando sus ultimas 5 ventas reales.
// Los ordena por cuantas veces los ha comprado, y recuerda la cantidad de la ultima vez.
// Sirve para agregarlos de un toque sin tener que buscarlos.
function agregarHabitualMulti(idx, hi){
  var p = pedidosMultiTemp[idx];
  if(!p || !p._habituales || !p._habituales[hi]) return;
  var h = p._habituales[hi];
  var yaEsta = false;
  for(var j=0; j<(p.items || []).length; j++){
    if(String(p.items[j].pid) === String(h.prod.id)){ p.items[j].cant += h.cant; yaEsta = true; break; }
  }
  if(!yaEsta) p.items.push({ pid: h.prod.id, nombre: h.prod.nombre, cant: h.cant, precio: h.prod.precio, costo: h.prod.costo });
  renderPedidosMultiples();
}

// Calcula lo que debe cada cliente, sumando el saldo de todas sus facturas sin pagar.
// Se hace UNA vez por dibujado -no una por cada barbero- para que no se ponga lento.
// El balance REAL de un cliente: lo que debe y su credito a favor, POR SEPARADO -no
// restados entre si-. Corregido el 24 jul: al principio esto mostraba un solo numero
// neto, y Sensei aclaro que quiere ver la deuda real y el credito real cada uno aparte,
// porque es EL QUIEN decide cuando aplicarle el credito a un cliente -no que la pantalla
// lo de por aplicado solo con restarlo-.
function etiquetaBalanceHtml(cid, vacio){
  var b = balanceRealCliente(cid);
  var partes = [];
  if(b.deuda > 0.01) partes.push('<span style="font-size:11px;color:var(--nbs-red-dark);font-weight:800">Debe $'+fmtNum(b.deuda)+'</span>');
  if(b.credito > 0.01) partes.push('<span style="font-size:11px;color:#E65100;font-weight:800">💰 ($'+fmtNum(b.credito)+') a favor</span>');
  if(!partes.length) return vacio ? '' : '<span style="font-size:11px;color:#bbb;font-weight:700">✓ Al día</span>';
  return partes.join('&nbsp;&nbsp;');
}

function toggleBalanceMulti(idx){
  var el = document.getElementById('multi-bal-detalle-'+idx);
  if(!el) return;
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

// ═══════════════════════════════════════════════════════════════════════════════
//   EL PEDIDO A MEDIAS NO SE PIERDE
// ═══════════════════════════════════════════════════════════════════════════════
// Antes, si estabas armando un pedido y salias a otra pantalla -por ejemplo a ver cuanto
// debia un cliente-, al volver las tarjetas desaparecian y habia que empezar de cero.
// Ahora se guarda solo mientras lo armas: sobrevive a salir a otro modulo, a cerrar la app,
// y hasta a apagar el telefono.
var CLAVE_PEDIDO_EN_PROCESO = 'nbs_pedido_en_proceso';

function renderInicio(){
  // La linea de "X ventas - Y clientes - $Z por cobrar" se quito el 22 jul:
  // era informacion repetida, la miniatura de arriba ya muestra lo del dia.
  var el = document.getElementById('inicio-resumen');
  if(el) el.style.display = 'none';

  // El boton de respaldo dice hace cuanto fue el ultimo, y se pone rojo si llevas mucho
  var sub = document.getElementById('inicio-respaldo-sub');
  if(sub){
    var mins = minutosSinRespaldar();
    if(mins >= 9999){
      sub.textContent = '⚠️ Nunca has bajado un respaldo';
      sub.style.color = '#B71C1C';
    } else if(mins >= MINUTOS_ENTRE_AVISOS){
      sub.textContent = '⚠️ ' + textoTiempo(mins).replace('Llevas ', 'Llevas ');
      sub.style.color = mins >= 240 ? '#B71C1C' : '#E65100';
    } else {
      sub.textContent = 'Último: hace ' + mins + ' min · al día ✓';
      sub.style.color = 'var(--nbs-green-text)';
    }
  }
}

// El respaldo desde el inicio. Tu toque es lo que Chrome exige para dejar descargar,
// asi que exportD() se llama directo -sin esperas- para no perder ese permiso.
function toggleSugerencias(idx){
  _sugerenciasAbiertas[idx] = !_sugerenciasAbiertas[idx];
  try { renderPedidosMultiples(); } catch(e){}
}


// ═══════════════════════════════════════════════════════════════════
//  💵 COBRARLE DESDE PEDIDOS RÁPIDOS
//
//  ⚠️ ESTO NO ESCRIBE PAGOS POR SU CUENTA. Usa `facturasQueDebenDe`
//  (que ya ordena de la más vieja a la más nueva) y reparte con la
//  misma regla de `planDeReparto`, que lleva funcionando desde julio.
// ═══════════════════════════════════════════════════════════════════
function ponerMontoCobro(cid, monto){
  var i = document.getElementById('cobped-monto');
  // 🔑 Ya con el punto puesto: la casilla es de modo calculadora. -17 ago-
  if(i){ i.value = (Math.round(monto * 100) / 100).toFixed(2); }
  previewCobroPedidos(cid);
}

// Le enseña EXACTAMENTE a qué facturas va a parar el pago, antes de tocarlo.
function toggleBarberoMulti(idx){
  var abrir = (window._barberoAbierto !== idx);
  window._barberoAbierto = abrir ? idx : null;
  for(var i = 0; i < (pedidosMultiTemp || []).length; i++){
    var cuerpo = document.getElementById('multi-cuerpo-' + i);
    var flecha = document.getElementById('multi-flecha-' + i);
    var cab = document.getElementById('multi-cab-' + i);
    var esteAbierto = (i === idx && abrir);
    if(cuerpo) cuerpo.style.display = esteAbierto ? 'block' : 'none';
    if(flecha) flecha.textContent = esteAbierto ? '\u2303' : '\u203a';
    if(cab) cab.style.background = esteAbierto ? '#DDE3FA' : '#EFEFF3';
  }
  if(abrir){
    marcarBarberoActivo(idx);
    // La cabecera del que se abrio, arriba de la pantalla
    setTimeout(function(){
      var c = document.getElementById('multi-cab-' + idx);
      if(c) try { c.scrollIntoView({ behavior:'smooth', block:'start' }); } catch(e){}
    }, 60);
  }
}

function filterPedMulti(idx, q){
  loadProds();
  var el = document.getElementById('multi-plist-'+idx);
  if(!el) return;
  el.innerHTML = '';
  var list = [].concat(productos).sort(function(a,b){ return a.nombre.localeCompare(b.nombre); });
  if(q && q.trim()) list = filtrarPorBusqueda(list, q, function(p){ return p.nombre; });
  if(!list.length){ el.style.display='none'; return; }
  el.style.display = 'block';
  list.slice(0,40).forEach(function(p){
    var d = document.createElement('div');
    d.style.cssText = 'padding:9px 10px;border-bottom:1px solid #f0f0f0;cursor:pointer;font-size:12px;background:'+(p.stock<=0?'#FFCDD2':p.stock<=p.min?'#FFF9C4':'white')+';display:flex;align-items:center;gap:8px';
    var fotoHtml = p.foto
      ? '<img src="'+escaparHtml(p.foto)+'" style="width:32px;height:32px;border-radius:7px;object-fit:cover;flex-shrink:0">'
      : '<div style="width:32px;height:32px;border-radius:7px;background:#eee;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;color:#bbb">📦</div>';
    d.innerHTML = fotoHtml+'<div style="flex:1;min-width:0"><div style="font-weight:600">'+escaparHtml(p.nombre)+'</div><div style="color:#aaa;font-size:10px">Stock:'+escaparHtml(p.stock)+' · $'+fmtNum(p.precio)+'</div></div>';
    d.onclick = (function(pid){ return function(){ selPedMulti(idx, pid); }; })(p.id);
    el.appendChild(d);
  });
}

function selPedMulti(idx, pid){
  // Al elegir el producto, se agrega de una vez con cantidad 1 (Sensei casi siempre pone 1).
  // Si necesita más, ajusta con los botones + y − de la lista. Esto ahorra el paso de "Agregar".
  pedMultiSel[idx] = pid;
  pedMultiCant[idx] = 1;
  var buscador = document.getElementById('multi-buscar-'+idx);
  if(buscador) buscador.value = '';
  var lista = document.getElementById('multi-plist-'+idx);
  if(lista) lista.style.display = 'none';
  addItemMulti(idx); // agrega el producto directo al barbero
}

function clearPedMulti(idx){
  delete pedMultiSel[idx];
  delete pedMultiCant[idx];
  renderPedidosMultiples();
}

function cambiarCantSelMulti(idx, delta){
  var nueva = (pedMultiCant[idx] || 1) + delta;
  if(nueva < 1) nueva = 1;
  pedMultiCant[idx] = nueva;
  var input = document.getElementById('multi-cant-'+idx);
  if(input) input.value = nueva;
}

function addItemMulti(idx){
  var pid = pedMultiSel[idx];
  if(!pid){ alert('Primero busca y elige un producto.'); return; }
  var p = pedidosMultiTemp[idx];
  if(!p) return;
  loadProds();
  var prod = productos.find(function(x){ return String(x.id)===String(pid); });
  if(!prod) return;
  var cant = pedMultiCant[idx] || 1;
  // Si ya le habias agregado ese mismo producto, se le suma la cantidad en vez de repetirlo
  var yaEsta = false;
  for(var j=0; j<(p.items || []).length; j++){
    if(String(p.items[j].pid) === String(pid)){ p.items[j].cant += cant; yaEsta = true; break; }
  }
  if(!yaEsta) p.items.push({ pid: prod.id, nombre: prod.nombre, cant: cant, precio: prod.precio, costo: prod.costo });
  delete pedMultiSel[idx];
  delete pedMultiCant[idx];
  renderPedidosMultiples();
}

function actualizarItemMulti(idx, itIdx, campo, valor){
  var p = pedidosMultiTemp[idx];
  if(!p || !p.items[itIdx]) return;
  p.items[itIdx][campo] = valor;
  if(campo === 'cant' || campo === 'precio') actualizarSubtotalItemMulti(idx, itIdx);
}

function cambiarCantItemMulti(idx, itIdx, delta){
  var p = pedidosMultiTemp[idx];
  if(!p || !p.items[itIdx]) return;
  var nueva = (p.items[itIdx].cant || 1) + delta;
  if(nueva < 1) nueva = 1;
  p.items[itIdx].cant = nueva;
  var input = document.getElementById('multi-icant-'+idx+'-'+itIdx);
  if(input) input.value = nueva;
  actualizarSubtotalItemMulti(idx, itIdx);
}

// Actualiza el subtotal de la linea y el total del barbero SIN volver a dibujar la pantalla,
// para no interrumpir lo que estes escribiendo en otra tarjeta.
function actualizarSubtotalItemMulti(idx, itIdx){
  var p = pedidosMultiTemp[idx];
  if(!p || !p.items[itIdx]) return;
  var it = p.items[itIdx];
  var sub = document.getElementById('multi-isub-'+idx+'-'+itIdx);
  if(sub) sub.textContent = '$'+fmtNum(it.cant * it.precio);
  var totalBarbero = (p.items || []).reduce(function(s,x){ return s + (x.cant * x.precio); }, 0);
  var totEl = document.getElementById('multi-total-'+idx);
  if(totEl){
    totEl.textContent = '$'+fmtNum(totalBarbero);
    totEl.style.color = totalBarbero > 0 ? 'var(--nbs-green-text)' : '#ccc';
  }
  actualizarBotonGuardarMulti();
}

function actualizarBotonGuardarMulti(){
  var btn = document.getElementById('ped-multi-guardar');
  if(!btn) return;
  var totalGeneral = 0, conItems = 0;
  pedidosMultiTemp.forEach(function(p){
    var t = (p.items || []).reduce(function(s,x){ return s + (x.cant * x.precio); }, 0);
    totalGeneral += t;
    if((p.items || []).length) conItems++;
  });
  if(conItems > 0){
    btn.textContent = '\u2713 Terminar con esta barber\u00eda'
      + (conItems > 0 ? '  \u00b7 guarda ' + conItems + ' m\u00e1s ($' + fmtNum(totalGeneral) + ')' : '');
    btn.style.opacity = '1';
  }
}

function quitarItemMulti(idxBarbero, idxItem){
  if(!pedidosMultiTemp[idxBarbero]) return;
  pedidosMultiTemp[idxBarbero].items.splice(idxItem, 1);
  renderPedidosMultiples();
}

// La ✕ del barbero: lo saca del pedido de hoy Y deja registrado que lo visitaste pero no
// compro, para poder ver despues su record de cuantas veces compra y cuantas no.
function quitarBarberoMulti(idx){
  var p = pedidosMultiTemp[idx];
  if(!p) return;
  var nombre = nombreCl(p.cliente);
  var aviso = (p.items || []).length
    ? '¿Quitar a '+nombre+'? Se perderá lo que ya le agregaste, y quedará registrado que hoy NO compró.'
    : '¿'+nombre+' no va a comprar hoy?\n\nQuedará registrado en su récord como una visita sin compra.';
  if(!confirm(aviso)) return;
  registrarVisitaBarbero(p.cliente.id, false);
  pedidosMultiTemp.splice(idx, 1);
  // Los indices se corren al sacar uno, asi que se limpia lo elegido para no confundir tarjetas
  pedMultiSel = {};
  pedMultiCant = {};
  if(!pedidosMultiTemp.length){
    olvidarPedidoEnProceso();
    document.getElementById('ped-multi-wrap').style.display = 'none';
    document.getElementById('ped-lista-wrap').style.display = 'block';
    renderBarberiasInicio(document.getElementById('ped-inicio-buscar') ? document.getElementById('ped-inicio-buscar').value : '');
    renderPedidosPendientes();
    return;
  }
  renderPedidosMultiples();
}

// ===== RECORD DE VISITAS POR BARBERO -compro / no compro- =====
// Se guarda por cliente: las fechas en que compro y las fechas en que se le visito pero no
// compro. Sirve para ver despues que barberos compran siempre y cuales casi nunca.
function ordenBarberosDe(barberia){
  try {
    var todo = LS('nbs_orden_barberos', {});
    var v = todo[String(barberia || '')];
    return Array.isArray(v) ? v : [];
  } catch(e){ return []; }
}

function guardarOrdenBarberos(barberia, ids){
  var todo = LS('nbs_orden_barberos', {});
  todo[String(barberia || '')] = ids.map(String);
  SS('nbs_orden_barberos', todo);
}

// Ordena una lista de barberos como él la dejó. Los que no estén en su orden
// -barberos nuevos- van al final, como estaban.
function ordenarBarberosComoQuiere(barberia, lista){
  var orden = ordenBarberosDe(barberia);
  if(!orden.length || !Array.isArray(lista)) return lista;
  var pos = {};
  orden.forEach(function(id, i){ pos[String(id)] = i; });
  var conOrden = [], sinOrden = [];
  lista.forEach(function(c){
    if(pos[String(c.id)] !== undefined) conOrden.push(c); else sinOrden.push(c);
  });
  conOrden.sort(function(a, b){ return pos[String(a.id)] - pos[String(b.id)]; });
  return conOrden.concat(sinOrden);
}

// Subir o bajar un barbero en la lista de la barbería que está atendiendo
function moverBarberoMulti(idx, cuanto){
  var nuevo = idx + cuanto;
  if(nuevo < 0 || nuevo >= pedidosMultiTemp.length) return;
  var tmp = pedidosMultiTemp[idx];
  pedidosMultiTemp[idx] = pedidosMultiTemp[nuevo];
  pedidosMultiTemp[nuevo] = tmp;
  // Se guarda el orden para la próxima vez que entre a esta barbería
  var barberia = (pedidosMultiTemp[0] && pedidosMultiTemp[0].barberia) || '';
  guardarOrdenBarberos(barberia, pedidosMultiTemp.map(function(p){ return p.cliente.id; }));
  renderPedidosMultiples();
}

// ═══════════════════════════════════════════════════════════════════
//  LOS BOTONES RÁPIDOS  (12 ago 2026)
// ═══════════════════════════════════════════════════════════════════

// Lo que MÁS VENDE él, en general. Se calcula de sus ventas de verdad.
// ⚠️ Se guarda en memoria porque se pide una vez por barbero y recorrer
// 400 ventas por cada uno haría lenta la pantalla.
var _masVendidosCache = null;
var _masVendidosHora = 0;

function masVendidos(cuantos){
  var ahora = Date.now();
  if(_masVendidosCache && (ahora - _masVendidosHora) < 60000) return _masVendidosCache.slice(0, cuantos || 6);
  var cuenta = {};
  var V = LS('nv', []);
  // Solo los últimos 60 días: lo que vendía en marzo ya no dice nada de hoy
  var corte = ahora - 60 * 86400000;
  V.forEach(function(v){
    if(v.cancelada) return;
    var f = parsearFechaVenta(v.fecha);
    if(f && f.getTime() < corte) return;
    (v.items || []).forEach(function(it){
      if(!it.pid) return;
      var k = String(it.pid);
      if(!cuenta[k]) cuenta[k] = 0;
      cuenta[k] += (parseFloat(it.cant) || 0);
    });
  });
  loadProds();
  var lista = [];
  Object.keys(cuenta).forEach(function(k){
    var prod = productos.find(function(x){ return String(x.id) === k; });
    if(!prod) return;
    lista.push({ prod: prod, uds: cuenta[k] });
  });
  lista.sort(function(a, b){ return b.uds - a.uds; });
  _masVendidosCache = lista;
  _masVendidosHora = ahora;
  return lista.slice(0, cuantos || 6);
}

// Los botoncitos. `alTocar` es el nombre de la función que se llama con el pid.
// Los botoncitos de un toque. Siempre llaman a agregarRapidoMulti(idx, pid).
// ⚠️ El onclick se arma con comillas SIMPLES — JSON.stringify rompe el atributo,
// que fue el fallo de los 8 botones muertos del 11 ago.
function botonesRapidos(rotulo, icono, lista, idx, color){
  if(!lista || !lista.length) return '';
  return '<div style="margin-bottom:8px">'
    + '<div style="font-size:9.5px;font-weight:800;color:var(--nbs-muted);letter-spacing:.3px;margin-bottom:5px">'
    +   icono + ' ' + rotulo + '</div>'
    + '<div style="display:flex;flex-wrap:wrap;gap:5px">'
    +   lista.map(function(x){
          var p = x.prod;
          var nom = String(p.nombre || '');
          return '<button onclick="event.stopPropagation();agregarRapidoMulti(' + idx + ',' + _arg(p.id) + ')" '
            + 'style="flex:1 1 30%;min-width:86px;padding:8px 5px;background:#fff;border:1.5px solid ' + color + ';'
            + 'border-radius:9px;cursor:pointer;text-align:center">'
            + '<div style="font-size:10.5px;font-weight:800;color:var(--nbs-ink);line-height:1.25;height:26px;'
            +   'overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">'
            +   escaparHtml(nom.slice(0, 32)) + '</div>'
            + '<div style="font-size:11px;font-weight:900;color:' + color + ';margin-top:2px">$'
            +   fmtNum(p.precio || 0) + '</div>'
            + '</button>';
        }).join('')
    + '</div></div>';
}

// Agregar un producto de un toque al pedido de un barbero de la lista
function agregarRapidoMulti(idx, pid){
  var p = pedidosMultiTemp[idx];
  if(!p) return;
  loadProds();
  var prod = productos.find(function(x){ return String(x.id) === String(pid); });
  if(!prod) return;
  var precio = prod.precio || 0;
  try { precio = obtenerPrecioParaCliente(p.cliente ? p.cliente.id : null, prod.id, prod.precio || 0); }
  catch(e){ precio = prod.precio || 0; }
  var ya = false;
  (p.items || []).forEach(function(it){
    if(String(it.pid) === String(pid)){ it.cant += 1; ya = true; }
  });
  if(!ya){
    if(!p.items) p.items = [];
    p.items.push({ pid: prod.id, nombre: prod.nombre, cant: 1, precio: precio, costo: prod.costo || 0 });
  }
  renderPedidosMultiples();
}




// ═══════════════════════════════════════════════════════════════════
//  📋 LA BITÁCORA DE VISITAS
//  Un renglón por visita, con TODO lo que pasó en ese momento.
//  Se escribe sola. Sensei no tiene que acordarse de nada.
// ═══════════════════════════════════════════════════════════════════
var BITACORA = 'nbs_bitacora_visitas';

// Cuántos renglones se guardan. Con 3 visitas al día son más de 2 años.
var BITACORA_TOPE = 2500;

function leerBitacora(){
  try {
    var b = LS(BITACORA, []);
    return Array.isArray(b) ? b : [];
  } catch(e){ return []; }
}

// ═══ APUNTAR UNA VISITA ═══
// Un solo sitio. Todo lo que pase con un cliente pasa por aquí.
//   cid       — el cliente
//   compro    — true / false
//   extra     — { ventaId, total, ganancia, tipo, productos, pedidoId, nota }
function apuntarEnBitacora(cid, compro, extra){
  if(!cid) return null;
  try {
    clientes = LS('ncl', []);
    var c = clientes.find(function(x){ return String(x.id) === String(cid); });
    if(!c) return null;

    var b = leerBitacora();
    var hoy = fechaHoy();
    var ex = extra || {};

    // 🔑 CADA VENTA ES SU PROPIO RENGLÓN, CON SU HORA.
    // Sensei lo corrigió: "si a un cliente le hago dos ventas aunque sea el mismo día
    // en diferentes horas, esas ventas NO pueden estar juntas en el récord, porque
    // entonces no se lleva la hora, y así no me gusta, porque necesito todo con todos
    // los detalles posibles". Tiene razón: 8:15 y 11:30 son dos momentos distintos.
    //
    // Lo ÚNICO que no se duplica es el "no compró": si ya hay un renglón de hoy para
    // ese cliente, no se le agrega otro que diga que no compró — sería falso.
    if(!compro){
      var yaHoy = false;
      for(var i = b.length - 1; i >= 0; i--){
        if(String(b[i].fecha) !== hoy) break;      // la lista va en orden
        if(String(b[i].cid) === String(cid)){ yaHoy = true; break; }
      }
      if(yaHoy) return null;
    }

    // Un renglón nuevo
    var reg = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      cid: String(cid),
      nombre: nombreCl(c),
      barberia: c.negocio || '',
      fecha: hoy,
      hora: horaAhora12(),
      horaFin: horaAhora12(),
      compro: !!compro,
      total: Math.round((parseFloat(ex.total) || 0) * 100) / 100,
      ganancia: Math.round((parseFloat(ex.ganancia) || 0) * 100) / 100,
      tipo: ex.tipo || '',
      productos: ex.productos || [],
      ventas: ex.ventaId ? [String(ex.ventaId)] : [],
      pedidos: ex.pedidoId ? [String(ex.pedidoId)] : [],
      como: ex.como || 'auto',        // 'auto' = se marcó sola · 'mano' = él la marcó
      nota: ex.nota || ''
    };
    b.push(reg);
    // No dejar que crezca sin fin
    if(b.length > BITACORA_TOPE) b = b.slice(b.length - BITACORA_TOPE);
    SS(BITACORA, b);
    return reg;
  } catch(e){ return null; }
}

// Los productos de una venta, en corto, para guardarlos en la bitácora
function bitacoraEntre(desde, hasta){
  var b = leerBitacora();
  var d = desde ? parsearFechaVenta(desde) : null;
  var h = hasta ? parsearFechaVenta(hasta) : null;
  if(h) h.setHours(23, 59, 59, 999);
  return b.filter(function(r){
    var f = parsearFechaVenta(r.fecha);
    if(!f) return false;
    if(d && f < d) return false;
    if(h && f > h) return false;
    return true;
  }).sort(function(a, z){
    var fa = parsearFechaVenta(a.fecha), fz = parsearFechaVenta(z.fecha);
    var t = (fz ? fz.getTime() : 0) - (fa ? fa.getTime() : 0);
    if(t !== 0) return t;
    return String(z.hora || '').localeCompare(String(a.hora || ''));
  });
}

// Los números de un rango
function resumenBitacora(lista){
  var r = { visitas: 0, compraron: 0, noCompraron: 0, total: 0, ganancia: 0,
            barberias: {}, clientes: {} };
  (lista || []).forEach(function(x){
    r.visitas++;
    if(x.compro) r.compraron++; else r.noCompraron++;
    r.total += parseFloat(x.total) || 0;
    r.ganancia += parseFloat(x.ganancia) || 0;
    if(x.barberia) r.barberias[x.barberia] = (r.barberias[x.barberia] || 0) + 1;
    r.clientes[x.cid] = (r.clientes[x.cid] || 0) + 1;
  });
  r.total = Math.round(r.total * 100) / 100;
  r.ganancia = Math.round(r.ganancia * 100) / 100;
  r.cuantasBarberias = Object.keys(r.barberias).length;
  r.cuantosClientes = Object.keys(r.clientes).length;
  r.pctCompro = r.visitas ? Math.round(r.compraron / r.visitas * 100) : 0;
  return r;
}


// ═══════════════════════════════════════════════════════════════════
//  📋 LA PANTALLA DE LA BITÁCORA
// ═══════════════════════════════════════════════════════════════════
var _bitDesde = null, _bitHasta = null, _bitBusca = '';

function _fmtFechaCorta(d){
  var m = String(d.getMonth() + 1); if(m.length < 2) m = '0' + m;
  var dd = String(d.getDate()); if(dd.length < 2) dd = '0' + dd;
  return m + '/' + dd + '/' + d.getFullYear();
}

function abrirBitacora(){
  if(!_bitDesde){ rangoBitacora('semana'); return; }
  ir('p-bitacora');
  renderBitacora();
}

// Los botones rápidos de fecha
function rangoBitacora(cual){
  var hoy = new Date(); hoy.setHours(0,0,0,0);
  var d = new Date(hoy);
  if(cual === 'hoy'){ /* desde hoy */ }
  else if(cual === 'semana'){ d.setDate(d.getDate() - 6); }
  else if(cual === 'mes'){ d.setDate(d.getDate() - 29); }
  else if(cual === 'todo'){ d = null; }
  _bitDesde = d ? _fmtFechaCorta(d) : null;
  _bitHasta = _fmtFechaCorta(hoy);
  ir('p-bitacora');
  renderBitacora();
}

function cambiarFechaBitacora(cual, valor){
  // El campo de fecha viene AAAA-MM-DD y la app usa MM/DD/AAAA
  if(!valor){ if(cual === 'desde') _bitDesde = null; else _bitHasta = null; }
  else {
    var p = String(valor).split('-');
    if(p.length === 3){
      var f = p[1] + '/' + p[2] + '/' + p[0];
      if(cual === 'desde') _bitDesde = f; else _bitHasta = f;
    }
  }
  renderBitacora();
}

function buscarEnBitacora(q){ _bitBusca = String(q || ''); renderBitacora(); }

function textoBitacora(){
  var lista = bitacoraEntre(_bitDesde, _bitHasta);
  var r = resumenBitacora(lista);
  var t = 'BIT\u00c1CORA DE VISITAS\n';
  t += (_bitDesde || 'el principio') + '  a  ' + (_bitHasta || 'hoy') + '\n';
  t += '\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\n';
  t += r.visitas + ' visitas \u00b7 ' + r.compraron + ' compraron \u00b7 ' + r.noCompraron + ' no\n';
  t += 'Vendiste $' + fmtNum(r.total) + ' \u00b7 ganancia $' + fmtNum(r.ganancia) + '\n';
  t += 'Te compran el ' + r.pctCompro + '% de las veces\n\n';
  var diaAnt = '';
  lista.slice().reverse().forEach(function(x){
    if(x.fecha !== diaAnt){ t += '\n=== ' + x.fecha + ' ===\n'; diaAnt = x.fecha; }
    t += (x.compro ? '\u2713 ' : '\u2717 ') + x.hora + '  ' + x.nombre;
    if(x.barberia) t += '  (' + x.barberia + ')';
    t += x.compro ? '  $' + fmtNum(x.total) : '  no compr\u00f3';
    t += '\n';
    (x.productos || []).forEach(function(p){
      t += '      ' + p.cant + ' \u00d7 ' + p.nombre + '\n';
    });
    if(x.nota) t += '      [' + x.nota + ']\n';
  });
  return t;
}

function hayNovedadesSinEscuchar(){
  try { return LS('nbs_novedades_oidas', '') !== NOVEDADES_VERSION; } catch(e){ return true; }
}

function escucharNovedades(){
  try { SS('nbs_novedades_oidas', NOVEDADES_VERSION); } catch(e){}
  var b = document.getElementById('asis-btn-novedades');
  if(b){ b.innerHTML = '\ud83d\udd0a Leyendo... (toca para parar)'; b.onclick = function(){ pararNovedades(); }; }
  // Se lee con la voz del asistente, aunque él lo tenga callado: lo pidió a propósito
  var antes = null;
  try { antes = LS('nbs_asis_voz', null); SS('nbs_asis_voz', true); } catch(e){}
  try { hablarAsistente(NOVEDADES.join(' ')); } catch(e){}
  // Devolverle su ajuste cuando termine
  setTimeout(function(){
    try { if(antes !== null) SS('nbs_asis_voz', antes); } catch(e){}
    var b2 = document.getElementById('asis-btn-novedades');
    if(b2){ b2.innerHTML = '\ud83d\udd0a Escuchar lo nuevo otra vez'; b2.onclick = function(){ escucharNovedades(); }; }
  }, 90000);
}

function pararNovedades(){
  try { pararVozAsistente(); } catch(e){}
  var b = document.getElementById('asis-btn-novedades');
  if(b){ b.innerHTML = '\ud83d\udd0a Escuchar lo nuevo otra vez'; b.onclick = function(){ escucharNovedades(); }; }
}



// ═══════════════════════════════════════════════════════════════════
//  🔊 QUE EL ASISTENTE TE HABLE  (14 ago 2026)
//  Sensei: "pensé que el botón me iba a hablar, que yo iba a poder
//  escucharlo también". Tiene razon: si le hablas, tiene que contestarte
//  con la voz. Usa la MISMA voz que le lee las lecciones de la Academia.
// ═══════════════════════════════════════════════════════════════════
var _asisHablando = false;

// ¿Quiere que le hable? Se guarda para que no tenga que decirlo cada vez.
function hablarLosAvisos(avisos, hoy){
  if(!asistenteHablaEncendido()) return;
  var t = saludoAsistente() + ', Sensei. ';
  if(hoy && hoy.vendido > 0){
    t += 'Hoy llevas ' + Math.round(hoy.vendido) + ' dolares vendidos. ';
  }
  if(!avisos || !avisos.length){
    t += 'No veo nada que te este costando dinero ahora mismo.';
  } else {
    t += 'Tengo ' + avisos.length + (avisos.length === 1 ? ' cosa' : ' cosas') + ' que decirte. ';
    // Solo las 3 primeras, que son las que mas le importan
    avisos.slice(0, 3).forEach(function(a){ t += a.titulo + '. '; });
  }
  hablarAsistente(t);
}



// ═══════════════════════════════════════════════════════════════════
//  🎤 HABLARLE AL ASISTENTE
// ═══════════════════════════════════════════════════════════════════

// Los números escritos como él los dice
var _NUMEROS = { 'un':1,'una':1,'uno':1,'dos':2,'tres':3,'cuatro':4,'cinco':5,'seis':6,
  'siete':7,'ocho':8,'nueve':9,'diez':10,'once':11,'doce':12,'quince':15,'veinte':20,
  'veinticinco':25,'treinta':30,'cuarenta':40,'cincuenta':50 };

function _num(txt){
  var t = String(txt || '').trim().toLowerCase();
  if(_NUMEROS[t] !== undefined) return _NUMEROS[t];
  var n = parseFloat(t.replace(/[^0-9.]/g, ''));
  return isNaN(n) ? null : n;
}

// Buscar UN cliente por lo que él diga: nombre, apodo o barbería
function entenderLoQueDijo(texto){
  var t = normalizarTextoBusqueda(String(texto || ''));
  if(!t) return { tipo: 'nada' };

  // ── ¿CUÁNTO ME DEBE X? ──
  var m = t.match(/(?:cuanto|cuando)\s+(?:me\s+)?debe\s+(.+)/);
  if(m) return { tipo: 'cuantoDebe', quien: m[1] };

  // ── ¿QUIÉN NO VIENE? ──
  if(/quien(es)?\s+no\s+(viene|ha venido|compra)/.test(t) || /clientes?\s+(perdidos?|callados?)/.test(t))
    return { tipo: 'callados' };

  // ── ¿CÓMO ME FUE HOY? ──
  if(/como\s+(me\s+)?(fue|voy|va)/.test(t) || /(cuanto|que)\s+(vendi|llevo)\s+hoy/.test(t))
    return { tipo: 'comoMeFue' };

  // ── ¿QUÉ SE ME ACABA? ──
  if(/(que|cuales?)\s+(se\s+me\s+)?(acaba|esta acaband|falta|tengo que comprar)/.test(t)
     || /(que\s+)?comprar/.test(t))
    return { tipo: 'seAcaba' };

  // ── ¿CUÁNTO LLEVO ESTE MES? ──
  if(/(cuanto|que)\s+(llevo|vendi|he vendido)\s+(este\s+)?mes/.test(t))
    return { tipo: 'esteMes' };

  // ── UN REPORTE ──
  m = t.match(/(?:hazme|dame|quiero|prepara(?:me)?)\s+(?:un\s+)?reporte\s+(?:de\s+)?(.*)/);
  if(m) return { tipo: 'reporte', de: m[1] || '' };

  // ── PREPARA UN PEDIDO PARA X ──
  m = t.match(/(?:prepara|hazme|abre|empieza)\s+(?:un\s+)?pedido\s+(?:para|de|a)\s+(.+)/);
  if(m) return { tipo: 'abrirPedido', quien: m[1] };

  // ── AGREGAR PRODUCTOS: "dos cool care y tres gel" ──
  var partes = t.split(/\s+(?:y|mas|tambien)\s+/);
  var items = [];
  partes.forEach(function(p){
    var mm = p.match(/^\s*([a-z0-9]+)\s+(.+)$/);
    if(!mm) return;
    var cant = _num(mm[1]);
    if(cant === null || cant <= 0) return;
    var prods = buscarProductoPorVoz(mm[2]);
    if(prods.length) items.push({ cant: cant, prod: prods[0], dijo: mm[2], opciones: prods.length });
  });
  if(items.length) return { tipo: 'agregar', items: items };

  return { tipo: 'nada', dijo: texto };
}

// ═══ CONTESTAR ═══
// 🔊 Envoltorio: contesta como siempre y DESPUÉS lee en voz alta lo que escribió.
// Se hace aquí y no en los 9 casos, para que nunca se olvide en uno. -14 ago-
function asisVerAgotados(cual){
  var lista = loQueSeAcaba(21);
  if(cual === 'agotados') lista = lista.filter(function(x){ return x.stock <= 0; });
  var t = lista.map(function(x){
    return '\u00b7 ' + String(x.prod.nombre).slice(0, 32) + '\n   te quedan ' + x.stock
         + ' \u00b7 vendes ' + x.alMes + ' al mes \u00b7 ' + x.diasQueQuedan + ' d\u00edas';
  }).join('\n');
  avisoGrande('\ud83d\udce6 LO QUE SE TE ACABA\n\n' + t);
}

function asisVerCallados(){
  var lista = clientesQueSeCallaron();
  var t = lista.map(function(x){
    return '\u00b7 ' + nombreCl(x.cliente).slice(0, 26) + '\n   ven\u00eda cada ' + x.ritmo
         + ' d\u00edas \u00b7 lleva ' + x.diasSinVenir + ' \u00b7 te dej\u00f3 $' + fmtNum(x.leCompro);
  }).join('\n');
  avisoGrande('\ud83d\udc64 LOS QUE DEJARON DE VENIR\n\n' + t
    + '\n\nEntra a su ficha y ll\u00e1malos o mand\u00e1les WhatsApp.');
}

function asisVerDeudas(){
  var lista = deudasViejas(30);
  var t = lista.slice(0, 12).map(function(x){
    return '\u00b7 ' + nombreCl(x.cliente).slice(0, 26) + '\n   $' + fmtNum(x.debe)
         + ' en ' + x.facturas + ' factura(s) \u00b7 la m\u00e1s vieja hace ' + x.diasMasVieja + 'd';
  }).join('\n');
  avisoGrande('\ud83d\udcb0 DEUDAS DE M\u00c1S DE 30 D\u00cdAS\n\n' + t);
}

function asisVerUnaVez(){
  var lista = compraronUnaVez();
  var t = lista.slice(0, 15).map(function(x){
    return '\u00b7 ' + nombreCl(x.cliente).slice(0, 26) + ' \u2014 $' + fmtNum(x.monto)
         + ' hace ' + x.diasDesde + 'd';
  }).join('\n');
  avisoGrande('\ud83c\udfaf TE COMPRARON UNA SOLA VEZ (' + lista.length + ')\n\n' + t
    + '\n\nYa te conocen. Es tu dinero m\u00e1s f\u00e1cil.');
}



function _cajaAsis(rot, val, col){
  return '<div style="flex:1;text-align:center;min-width:0">'
    + '<div style="font-size:9px;font-weight:800;color:var(--nbs-muted);letter-spacing:.3px">' + rot + '</div>'
    + '<div style="font-size:15px;font-weight:900;margin-top:2px;color:' + (col || 'var(--nbs-ink)') + ';'
    +   'overflow:hidden;text-overflow:ellipsis">' + val + '</div></div>';
}

// Una tarjeta de aviso, con SU botón para resolverlo
// Marcarlo leído: se va al historial y deja de contar en el puntito. -15 ago-
function _tarjetaAviso(a){
  var colores = {
    rojo:     { borde: '#C62828', fondo: 'var(--nbs-red-bg)',   texto: 'var(--nbs-red-text)' },
    amarillo: { borde: '#E65100', fondo: '#FFF3E0',             texto: '#8D4A00' },
    azul:     { borde: '#1565C0', fondo: '#E8F1FB',             texto: '#0D47A1' }
  };
  var c = colores[a.nivel] || colores.azul;
  var h = '<div style="background:#fff;border-left:4px solid ' + c.borde + ';border-radius:11px;'
    + 'padding:12px;margin-bottom:9px;box-shadow:0 1px 3px rgba(0,0,0,.08)">'
    + '<div style="display:flex;align-items:flex-start;gap:8px">'
    +   '<span style="font-size:24px;flex-shrink:0">' + a.icono + '</span>'
    +   '<div style="flex:1;min-width:0">'
    +     '<div style="font-size:13.5px;font-weight:900;color:' + c.texto + ';line-height:1.3">'
    +       escaparHtml(a.titulo) + '</div>'
    +     '<div style="font-size:11.5px;color:var(--nbs-muted);margin-top:4px;line-height:1.55;white-space:pre-line">'
    +       escaparHtml(a.detalle) + '</div>'
    +   '</div>'
    + '</div>'
    + _botonesDelAviso(a, c)
    // \ud83c\udf81 El aviso del premio no lleva "Ya lo vi": se queda hasta que le de el regalo.
    + (a.noSeArchiva
        ? '<div style="margin-top:7px;padding:8px;background:#FFF3E0;border:1px dashed #E65100;'
          + 'border-radius:8px;font-size:10.5px;color:#E65100;text-align:center;font-weight:700">'
          + 'Este aviso se queda hasta que le des el premio \ud83c\udf81</div>'
        : '<button onclick="verYMarcarLeido(' + _arg(a.clave || '') + ',' + _arg(a.titulo || '') + ','
          +   _arg(a.nivel || '') + ',' + _arg(a.icono || '') + ')" '
          +   'style="width:100%;margin-top:7px;padding:9px;background:#F4F4F8;border:1px solid #DDD;'
          +   'color:var(--nbs-muted);border-radius:8px;font-size:11.5px;font-weight:800;cursor:pointer">'
          +   '\u2713 Ya lo vi</button>')
    + '</div>';
  return h;
}

// 🔑 AQUI ESTA LA FUSION: cada aviso trae el boton que lo resuelve.
function _botonesDelAviso(a, c){
  var b = function(txt, fn, principal){
    return '<button onclick="' + fn + '" style="flex:1;padding:9px 6px;border-radius:8px;'
      + 'font-size:11.5px;font-weight:800;cursor:pointer;'
      + (principal
          ? 'background:' + c.borde + ';color:#fff;border:none'
          : 'background:#fff;color:' + c.texto + ';border:1px solid ' + c.borde)
      + '">' + txt + '</button>';
  };
  var botones = '';
  // \ud83c\udf81 El del premio lleva derecho a la ficha del cliente, que es donde esta el
  // boton de darle el regalo. -3 sep-
  if(a.clave === 'premiosVIP'){
    var _p = (a.datos || [])[0];
    if(_p){
      botones = b('\ud83d\udc41\ufe0f Ver la ficha de ' + String(_p.cliente).split(' ')[0],
                  'cerrarAsistente();verCl(' + _arg(_p.cid) + ')', true);
      if((a.datos || []).length > 1){
        botones += b('\ud83c\udf81 Ver los ' + a.datos.length, 'cerrarAsistente();verSinConfirmarPremios()', false);
      }
    }
  }
  else if(a.clave === 'agotados' || a.clave === 'porAcabarse'){
    botones = b('\u2795 A la lista de relleno', 'asisAgregarAlRelleno(' + _arg(a.clave) + ')', true)
            + b('\ud83d\udc41\ufe0f Verlos', 'asisVerAgotados(' + _arg(a.clave) + ')');
  } else if(a.clave === 'callados'){
    botones = b('\ud83d\udc41\ufe0f Ver qui\u00e9nes son', 'asisVerCallados()', true);
  } else if(a.clave === 'deudas'){
    botones = b('\ud83d\udcb5 Ir a cobrar', 'cerrarAsistente();ir(\'p-cxc\')', true)
            + b('\ud83d\udc41\ufe0f Ver la lista', 'asisVerDeudas()');
  } else if(a.clave === 'unaVez'){
    botones = b('\ud83d\udc41\ufe0f Ver los ' + (a.datos ? a.datos.length : '') + '', 'asisVerUnaVez()', true);
  } else if(a.clave === 'sinGanancia'){
    botones = b('\ud83d\udcca Ver el margen', 'cerrarAsistente();mostrarMargenProductos()', true);
  }
  if(!botones) return '';
  return '<div style="display:flex;gap:6px;margin-top:9px">' + botones + '</div>';
}

// ═══════════════════════════════════════════════════════════════════
//  🤖 EL ASISTENTE — EL CEREBRO
//  Mira los datos de Sensei y saca lo que él no está viendo.
//  Sin internet, sin costo. No adivina: cuenta.
// ═══════════════════════════════════════════════════════════════════

// Cuántos días pasaron desde una fecha de la app (MM/DD/AAAA)
function _diasDesde(fechaTxt){
  var f = parsearFechaVenta(fechaTxt);
  if(!f || isNaN(f.getTime())) return null;
  var hoy = new Date(); hoy.setHours(0,0,0,0);
  var d = new Date(f.getTime()); d.setHours(0,0,0,0);
  return Math.floor((hoy - d) / 86400000);
}

// Las ventas de verdad: sin canceladas y sin los "Balance inicial"
function deudasViejas(diasMin){
  var tope = (diasMin === 0 || diasMin > 0) ? diasMin : 30;
  var V = _ventasReales();
  clientes = LS('ncl', []);
  var porCli = {};
  V.forEach(function(v){
    if(v.tipo !== 'credito') return;
    var pg = 0;
    (v.pagosFactura || []).forEach(function(p){ if(!p.esDevolucion) pg += parseFloat(p.monto) || 0; });
    var saldo = cobradoYDebeDe(v).debe;
    if(saldo <= 0.01) return;
    var d = _diasDesde(v.fecha);
    if(d === null || d < tope) return;
    var k = String(v.cid);
    if(!porCli[k]) porCli[k] = { debe: 0, facturas: 0, masVieja: 0 };
    porCli[k].debe += saldo;
    porCli[k].facturas++;
    if(d > porCli[k].masVieja) porCli[k].masVieja = d;
  });
  var res = [];
  Object.keys(porCli).forEach(function(k){
    var c = clientes.find(function(x){ return String(x.id) === k; });
    if(!c) return;
    res.push({ cliente: c, debe: Math.round(porCli[k].debe * 100) / 100,
               facturas: porCli[k].facturas, diasMasVieja: porCli[k].masVieja });
  });
  res.sort(function(a,b){ return b.debe - a.debe; });
  return res;
}

// ── 4. LOS QUE COMPRARON UNA SOLA VEZ ──
// Su dinero más fácil: ya lo conocen y ya le compraron.
function sinGanancia(){
  loadProds();
  var res = [];
  productos.forEach(function(p){
    var pr = parseFloat(p.precio) || 0;
    var co = parseFloat(p.costo) || 0;
    if(!pr || !co) return;
    var g = pr - co;
    var pct = pr > 0 ? (g / pr * 100) : 0;
    if(pct >= 15) return;
    res.push({ prod: p, gana: Math.round(g * 100) / 100, pct: Math.round(pct * 10) / 10 });
  });
  res.sort(function(a,b){ return a.pct - b.pct; });
  return res;
}

// ── 6. CÓMO LE FUE HOY ──
function comoMeFueHoy(){
  var hoy = fechaHoy();
  var V = _ventasReales().filter(function(v){ return String(v.fecha) === hoy; });
  var vendido = 0, ganancia = 0, cobrado = 0;
  V.forEach(function(v){
    var t = parseFloat(v.total) || 0;
    vendido += t;
    ganancia += parseFloat(v.ganancia) || 0;
    if(v.tipo === 'contado'){ cobrado += t; return; }
    (v.pagosFactura || []).forEach(function(p){
      if(!p.esDevolucion && String(p.fecha) === hoy) cobrado += parseFloat(p.monto) || 0;
    });
  });
  // Los abonos de hoy a facturas viejas
  _ventasReales().forEach(function(v){
    if(String(v.fecha) === hoy) return;
    (v.pagosFactura || []).forEach(function(p){
      if(!p.esDevolucion && String(p.fecha) === hoy) cobrado += parseFloat(p.monto) || 0;
    });
  });
  // Las visitas de hoy
  var vis = LS('nvisitas_barberos', {});
  var compro = 0, noCompro = 0;
  Object.keys(vis).forEach(function(k){
    (vis[k].compro || []).forEach(function(f){ if(String(f) === hoy) compro++; });
    (vis[k].noCompro || []).forEach(function(f){ if(String(f) === hoy) noCompro++; });
  });
  var r2 = function(n){ return Math.round(n * 100) / 100; };
  return { facturas: V.length, vendido: r2(vendido), ganancia: r2(ganancia),
           cobrado: r2(cobrado), visitasCompro: compro, visitasNoCompro: noCompro,
           pedidosPendientes: LS('npedidos', []).length };
}

// ═══ TODO JUNTO: LO QUE EL ASISTENTE TIENE QUE DECIRLE ═══
// Devuelve los avisos ordenados por lo que más le importa al bolsillo.

// ═══════════════════════════════════════════════════════════════════
//  📥 LA BANDEJA DE AVISOS — como un correo
//
//  Los avisos NUEVOS salen arriba. Al tocarlos se marcan LEÍDOS y se
//  van al historial, donde él los puede volver a ver o borrar.
//  El puntito rojo solo cuenta los NUEVOS.
// ═══════════════════════════════════════════════════════════════════
var LEIDOS = 'nbs_avisos_leidos';

function borrarDelHistorial(huella){
  try {
    var l = avisosLeidos().filter(function(x){ return x.huella !== huella; });
    SS(LEIDOS, l);
    renderHistorialAvisos();
    try { avisoChico('\ud83d\uddd1\ufe0f Borrado'); } catch(e){}
  } catch(e){}
}

function borrarTodoElHistorial(){
  if(!confirm('\u00bfBorrar TODO el historial de avisos?\n\n'
      + 'Son ' + avisosLeidos().length + ' aviso(s) que ya leíste.\n'
      + 'Esto no toca ning\u00fan dato de tu negocio.')) return;
  SS(LEIDOS, []);
  renderHistorialAvisos();
  try { avisoChico('\ud83d\uddd1\ufe0f Historial vac\u00edo'); } catch(e){}
}

// Volver a poner un aviso como NUEVO
function abrirHistorialAvisos(){
  var ov = document.getElementById('hist-avisos-overlay');
  if(!ov){
    ov = document.createElement('div');
    ov.id = 'hist-avisos-overlay';
    document.body.appendChild(ov);
  }
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:99992;'
    + 'display:flex;align-items:flex-end;justify-content:center';
  ov.innerHTML = '<div id="hist-avisos-caja" style="background:#fff;border-radius:16px 16px 0 0;'
    + 'width:100%;max-width:440px;max-height:82vh;overflow:auto"></div>';
  renderHistorialAvisos();
}

function cerrarHistorialAvisos(){
  var ov = document.getElementById('hist-avisos-overlay');
  if(ov) ov.style.display = 'none';
}

function renderHistorialAvisos(){
  var caja = document.getElementById('hist-avisos-caja');
  if(!caja) return;
  var l = avisosLeidos();
  var h = '<div style="position:sticky;top:0;background:#fff;padding:14px 14px 10px;'
    + 'border-bottom:1px solid #EEE;display:flex;align-items:center;justify-content:space-between;gap:8px">'
    + '<div><div style="font-size:15.5px;font-weight:900;color:var(--nbs-ink)">\ud83d\udce5 Avisos le\u00eddos</div>'
    +   '<div style="font-size:11px;color:var(--nbs-muted)">' + l.length + ' en el historial</div></div>'
    + '<button onclick="cerrarHistorialAvisos()" style="background:#EEE;border:none;border-radius:9px;'
    +   'padding:8px 12px;font-size:14px;cursor:pointer">\u2715</button></div>';

  h += '<div style="padding:12px 14px">';
  if(!l.length){
    h += '<div style="text-align:center;padding:26px 12px;color:var(--nbs-muted);font-size:12.5px;line-height:1.6">'
      + 'Todav\u00eda no has le\u00eddo ning\u00fan aviso.<br><br>'
      + 'Cuando toques un aviso del asistente, se marca le\u00eddo y viene a parar aqu\u00ed.</div>';
  } else {
    l.forEach(function(x){
      h += '<div style="background:#F7F7FB;border-radius:10px;padding:10px;margin-bottom:8px">'
        + '<div style="display:flex;align-items:flex-start;gap:8px">'
        +   '<span style="font-size:17px;flex-shrink:0">' + (x.icono || '\ud83d\udcac') + '</span>'
        +   '<div style="flex:1;min-width:0">'
        +     '<div style="font-size:12.5px;font-weight:800;color:var(--nbs-ink);line-height:1.35">'
        +       escaparHtml(String(x.titulo || '')) + '</div>'
        +     '<div style="font-size:10.5px;color:var(--nbs-muted);margin-top:2px">'
        +       escaparHtml(String(x.cuando || '')) + ' \u00b7 ' + escaparHtml(String(x.hora || '')) + '</div>'
        +   '</div>'
        + '</div>'
        + '<div style="display:flex;gap:6px;margin-top:8px">'
        +   '<button onclick="marcarComoNoLeido(' + _arg(x.huella) + ')" '
        +     'style="flex:1;padding:7px;background:#fff;border:1px solid #BBB;color:var(--nbs-ink);'
        +     'border-radius:7px;font-size:11px;font-weight:700;cursor:pointer">\ud83d\udce5 Que vuelva a salir</button>'
        +   '<button onclick="borrarDelHistorial(' + _arg(x.huella) + ')" '
        +     'style="padding:7px 12px;background:#FFEBEE;border:1px solid #C62828;color:#C62828;'
        +     'border-radius:7px;font-size:11px;font-weight:700;cursor:pointer">\ud83d\uddd1\ufe0f</button>'
        + '</div></div>';
    });
    h += '<button onclick="borrarTodoElHistorial()" class="btn" '
      + 'style="width:100%;margin-top:6px;background:#fff;border:1.5px solid #C62828;color:#C62828">'
      + '\ud83d\uddd1\ufe0f Borrar todo el historial</button>';
  }
  h += '</div>';
  caja.innerHTML = h;
}


// ═══════════════════════════════════════════════════════════════════
//  🎁 QUIÉNES SE GANARON UN PREMIO  (15 ago 2026)
//
//  🔑 SENSEI: el VIP es "cuando lleguen a 10 productos del mismo tipo que
//  cuesten 10 dólares, los voy a recompensar con uno gratis". Y el de
//  Fidelidad, "cuando lleguen al total comprado de $400 les voy a dar un
//  regalo sorpresa". Los dos son importantes.
//
//  📊 MEDIDO EN SUS DATOS: 6 clientes ya llegaron a los $400 y 1 ya tiene
//  12 de un producto de $10 — y NUNCA se le avisó, porque el aviso del VIP
//  exigía un interruptor que ningún cliente tenía encendido.
//
//  Ahora el asistente se lo dice.
// ═══════════════════════════════════════════════════════════════════
function premiosPendientes(){
  var r = { vip: [], fidelidad: [], cercaFidelidad: [] };
  try {
    clientes = LS('ncl', []);
    ventas = LS('nv', []);
    clientes.forEach(function(c){
      if(!clienteCuentaVIP(c)) return;
      // ── El VIP por producto ──
      try {
        // calcVIP devuelve un OBJETO por grupo: { "MARCA · CATEGORÍA": {puntos, gratis...} }
        var v = calcVIP(c.id);
        if(v){
          Object.keys(v).forEach(function(k){
            var g = v[k];
            if(!g) return;
            var gratis = parseInt(g.gratis || 0, 10) || 0;
            if(gratis > 0){
              r.vip.push({ cid: c.id, nombre: nombreCl(c), producto: k,
                           cant: g.puntos || g.total || 0, gratis: gratis });
            }
          });
        }
      } catch(e){}
      // ── Los $400 ──
      try {
        var suyas = ventas.filter(function(x){
          return String(x.cid) === String(c.id) && !x.cancelada && !esBalanceInicial(x);
        });
        var f = calcularFidelidad(c, suyas);
        if(f){
          if((f.total || 0) >= (f.meta || 400) && !f.yaCanjeado){
            r.fidelidad.push({ cid: c.id, nombre: nombreCl(c), total: f.total });
          } else if((f.total || 0) >= (f.meta || 400) * 0.75){
            r.cercaFidelidad.push({ cid: c.id, nombre: nombreCl(c), total: f.total,
                                    falta: Math.round(((f.meta || 400) - f.total) * 100) / 100 });
          }
        }
      } catch(e){}
    });
  } catch(e){}
  return r;
}

function reabrirBarberoMulti(idx){
  var p = pedidosMultiTemp[idx];
  if(!p) return;
  p._guardado = false;
  p.items = [];
  renderPedidosMultiples();
}

function avisoChico(txt){
  var f = document.createElement('div');
  f.textContent = txt;
  f.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);'
    + 'background:#2E7D32;color:#fff;padding:11px 18px;border-radius:22px;font-size:13px;'
    + 'font-weight:800;z-index:999999;box-shadow:0 3px 12px rgba(0,0,0,.3);max-width:88%;text-align:center';
  document.body.appendChild(f);
  setTimeout(function(){ if(f.parentNode) f.parentNode.removeChild(f); }, 2200);
}

// Abrir y cerrar el barbero en el que está trabajando
// -- La funcion vieja que habia aqui se quito el 28 ago: era de un acordeon que nunca
// llego a funcionar -usaba `_abierto`, que se escribia y nadie leia, como decia el
// comentario del 14 ago-. Y como estaba MAS ABAJO en el archivo, pisaba a la buena.
// La que vale es toggleBarberoMulti, mas arriba, junto a marcarBarberoActivo. --

// ═══ TERMINAR LA BARBERÍA ═══
// Apunta la visita de TODOS: los que compraron ya quedaron apuntados al guardar,
// y aqui se apuntan los que NO compraron. Asi el record de compra/no compra queda
// completo, que es justo para lo que Sensei escoge la barberia entera.
function terminarBarberiaMulti(){
  var conItems = pedidosMultiTemp.filter(function(p){ return (p.items || []).length > 0; });
  var guardados = pedidosMultiTemp.filter(function(p){ return p._guardado; });
  var sinNada = pedidosMultiTemp.filter(function(p){ return !p._guardado && !(p.items || []).length; });

  var msg = '';
  if(conItems.length) msg += 'Vas a guardar ' + conItems.length + ' pedido(s) m\u00e1s.\n';
  if(guardados.length) msg += 'Ya ten\u00edas ' + guardados.length + ' guardado(s).\n';
  if(sinNada.length) msg += '\nY se van a apuntar como NO COMPR\u00d3 ' + sinNada.length + ' barbero(s).';
  if(!conItems.length && !guardados.length && !sinNada.length) return;
  if(msg && !confirm('\u00bfTerminar con esta barber\u00eda?\n\n' + msg)) return;

  // Guardar los que todavia tienen productos sin guardar
  if(conItems.length){
    pedidos = LS('npedidos', []);
    var ahora = Date.now();
    conItems.forEach(function(p, i){
      pedidos.push({
        id: ahora + i,
        cid: p.cliente.id,
        nombre: nombreCl(p.cliente),
        barberia: p.barberia,
        items: (p.items || []).slice()
      });
      try {
        apuntarTodoDeLaVisita(p.cliente, true, {
          pedidoId: ahora + i,
          total: (p.items || []).reduce(function(a, it){ return a + ((it.cant||0) * (it.precio||0)); }, 0),
          productos: (p.items || []).map(function(it){
            return { nombre: String(it.nombre||'').slice(0,40), cant: it.cant||0, precio: it.precio||0 };
          }),
          nota: 'dej\u00f3 pedido', como: 'auto'
        });
      } catch(e){ registrarVisitaBarbero(p.cliente.id, true); }
    });
    SS('npedidos', pedidos);
  }

  // Y apuntar a los que no compraron
  sinNada.forEach(function(p){
    try { apuntarTodoDeLaVisita(p.cliente, false, { como: 'auto', nota: 'no compr\u00f3' }); }
    catch(e){ registrarVisitaBarbero(p.cliente.id, false); }
  });

  var total = conItems.length + guardados.length;
  pedidosMultiTemp = [];
  pedMultiSel = {};
  pedMultiCant = {};
  olvidarPedidoEnProceso();
  document.getElementById('ped-multi-wrap').style.display = 'none';
  document.getElementById('ped-lista-wrap').style.display = 'block';
  try { renderBarberiasInicio(document.getElementById('ped-inicio-buscar') ? document.getElementById('ped-inicio-buscar').value : ''); } catch(e){}
  try { renderPedidosPendientes(); } catch(e){}
  try { renderAvisoPedidoEnProceso(); } catch(e){}
  subirPantalla();
  avisoChico('\u2705 ' + total + ' pedido(s) \u00b7 ' + sinNada.length + ' sin comprar');
}

function renderBarberiasInicio_old(q){ renderBarberias(q); }

function filterPed(q){
  loadProds();
  var el = document.getElementById('pedplist');
  el.innerHTML = '';
  var list = [].concat(productos).sort(function(a,b){return a.nombre.localeCompare(b.nombre);});
  if(q && q.trim()) list = filtrarPorBusqueda(list, q, function(p){ return p.nombre; });
  if(!list.length){ el.style.display='none'; return; }
  el.style.display = 'block';
  list.forEach(function(p){
    var d = document.createElement('div');
    d.style.cssText = 'padding:10px 12px;border-bottom:1px solid #f0f0f0;cursor:pointer;font-size:13px;background:'+(p.stock<=0?'#FFCDD2':p.stock<=p.min?'#FFF9C4':'white')+';display:flex;align-items:center;gap:10px';
    var fotoHtml = p.foto
      ? '<img src="'+p.foto+'" style="width:38px;height:38px;border-radius:8px;object-fit:cover;flex-shrink:0">'
      : '<div style="width:38px;height:38px;border-radius:8px;background:#eee;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;color:#bbb">📦</div>';
    d.innerHTML = fotoHtml+'<div style="flex:1"><div style="font-weight:600">'+escaparHtml(p.nombre)+'</div><div style="color:#aaa;font-size:11px">'+p.cat+' · Stock:'+p.stock+' · $'+fmtNum(p.precio)+'</div></div>';
    d.onclick = (function(pid){ return function(){ selPed(pid); }; })(p.id);
    el.appendChild(d);
  });
}

// ===== DICTADO POR VOZ PARA PEDIDOS -gratis, usa el microfono del telefono, ya integrado
// en el navegador, sin necesidad de ninguna libreria ni servidor propio- =====
var NUMEROS_ESPANOL = {
  'un':1,'uno':1,'una':1,'dos':2,'tres':3,'cuatro':4,'cinco':5,'seis':6,'siete':7,'ocho':8,
  'nueve':9,'diez':10,'once':11,'doce':12,'trece':13,'catorce':14,'quince':15,'dieciseis':16,
  'diecisiete':17,'dieciocho':18,'diecinueve':19,'veinte':20
};

// Dictado por voz GENERICO para busquedas simples de texto -Catalogo, VIP, etc-, a diferencia
// del dictado de Pedidos/Compras que ademas interpreta cantidad y agrega el producto solo. Aqui
// solo se transcribe lo dicho y se pone en el campo de busqueda, disparando la busqueda normal.
function dictarBusquedaSimple(inputId, botonId){
  var ReconocedorVoz = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!ReconocedorVoz){
    alert('Tu navegador no tiene esta función disponible todavía. Prueba desde Chrome en tu teléfono.');
    return;
  }
  var input = document.getElementById(inputId);
  var btn = document.getElementById(botonId);
  var reconocimiento = new ReconocedorVoz();
  reconocimiento.lang = 'es-US';
  reconocimiento.interimResults = false;
  reconocimiento.maxAlternatives = 1;

  function restaurarBoton(){ btn.textContent = '🎤'; btn.style.background = '#5E35B1'; }
  btn.textContent = '🔴'; btn.style.background = '#C62828';

  reconocimiento.onresult = function(evento){
    var texto = limpiarTexto(evento.results[0][0].transcript);
    input.value = texto;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };
  reconocimiento.onerror = function(evento){
    restaurarBoton();
    if(evento.error !== 'no-speech' && evento.error !== 'aborted') alert('No se pudo usar el micrófono. Intenta de nuevo.');
  };
  reconocimiento.onend = restaurarBoton;
  try { reconocimiento.start(); } catch(e){ restaurarBoton(); }
}

function selPed(id){
  var p = productos.find(function(x){ return String(x.id)===String(id); }); if(!p) return;
  // Agregar directamente al pedido sin pasos extra
  var encontrado = false;
  var precioAUsar = obtenerPrecioParaCliente(pedBarberoCid, p.id, p.precio);
  for(var j=0;j<pedItemsTemp.length;j++){
    if(String(pedItemsTemp[j].pid)===String(p.id)){ pedItemsTemp[j].cant += 1; encontrado = true; break; }
  }
  if(!encontrado) pedItemsTemp.push({ pid: p.id, nombre: p.nombre, cant: 1, precio: precioAUsar, costo: p.costo, foto: p.foto||null });
  // Limpiar búsqueda y mostrar confirmación breve
  document.getElementById('pedsel').value = '';
  document.getElementById('pedchip').style.display = 'none';
  document.getElementById('pedb').value = '';
  document.getElementById('pedplist').style.display = 'none';
  renderPedItems();
  // Flash visual en el nombre del producto agregado
  var flash = document.createElement('div');
  flash.textContent = '✅ '+escaparHtml(p.nombre)+' agregado';
  flash.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#2E7D32;color:white;padding:10px 20px;border-radius:20px;font-size:13px;font-weight:700;z-index:9999;opacity:1;transition:opacity 0.5s';
  document.body.appendChild(flash);
  setTimeout(function(){ flash.style.opacity='0'; setTimeout(function(){ flash.remove(); }, 500); }, 1500);
}

function clearPed(){
  document.getElementById('pedsel').value = '';
  document.getElementById('pedchip').style.display = 'none';
  document.getElementById('pedb').value = '';
}

function addPedItem(){
  var pid = document.getElementById('pedsel').value;
  if(!pid) return;
  var cant = parseInt(document.getElementById('pedcant').value) || 1;
  var prod = productos.find(function(x){ return String(x.id)===String(pid); });
  if(!prod) return;
  var encontrado = false;
  for(var j=0;j<pedItemsTemp.length;j++){
    if(String(pedItemsTemp[j].pid)===String(pid)){ pedItemsTemp[j].cant += cant; encontrado = true; break; }
  }
  if(!encontrado) pedItemsTemp.push({ pid: prod.id, nombre: prod.nombre, cant: cant, precio: prod.precio, costo: prod.costo });
  document.getElementById('pedcant').value = 1;
  clearPed();
  renderPedItems();
}

// Favoritos del barbero en PEDIDOS RÁPIDOS: muestra lo que ese barbero compra más,
// en botones. Un toque lo agrega al pedido. Igual que en Vender pero para pedidos.
function renderPedItems(){
  var el = document.getElementById('pedItems');
  el.innerHTML = '';
  pedItemsTemp.forEach(function(it, i){
    var subtotal = (it.cant * it.precio);
    var row = document.createElement('div');
    row.style.cssText = 'padding:10px;margin-bottom:8px;border:0.5px solid var(--nbs-line);border-radius:10px;background:white';
    row.innerHTML = '<div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">'
      +(it.foto
        ? '<img src="'+it.foto+'" onclick="verFotoGasto(\''+it.foto+'\')" style="width:40px;height:40px;border-radius:8px;object-fit:cover;flex-shrink:0;cursor:pointer">'
        : '<div style="width:40px;height:40px;border-radius:8px;background:#f0f0f0;display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0;color:#ccc">📦</div>')
      +'<input type="text" value="'+it.nombre.replace(/"/g,"'")+'" oninput="actualizarPedItem('+i+',\'nombre\',this.value)" style="flex:1;border:0.5px solid #ddd;border-radius:6px;padding:7px 8px;font-size:13px;font-weight:600;color:var(--nbs-ink)">'
      +'<button onclick="pedItemsTemp.splice('+i+',1);renderPedItems();" style="background:var(--nbs-red-bg);color:var(--nbs-red-dark);border:none;border-radius:8px;width:36px;height:36px;cursor:pointer;font-size:15px;flex-shrink:0">✕</button>'
      +'</div>'
      +'<div style="display:flex;align-items:center;gap:8px">'
      +'<div>'
      +'<label style="font-size:9px;color:#999;display:block;margin-bottom:2px">CANT</label>'
      +'<div style="display:flex;align-items:center;gap:3px">'
      +'<button onclick="cambiarCantPedItem('+i+',-1)" style="width:36px;height:36px;background:var(--nbs-red-bg);color:var(--nbs-red-dark);border:none;border-radius:8px;cursor:pointer;font-size:18px;font-weight:700;line-height:1;flex-shrink:0">−</button>'
      +'<input type="number" min="1" value="'+it.cant+'" id="ped-cant-'+i+'" oninput="actualizarPedItem('+i+',\'cant\',parseInt(this.value)||1);actualizarSubtotalPed('+i+')" style="width:42px;padding:6px 2px;border:0.5px solid #ddd;border-radius:6px;font-size:13px;text-align:center">'
      +'<button onclick="cambiarCantPedItem('+i+',1)" style="width:36px;height:36px;background:var(--nbs-green-bg);color:var(--nbs-green-text);border:none;border-radius:8px;cursor:pointer;font-size:18px;font-weight:700;line-height:1;flex-shrink:0">+</button>'
      +'</div>'
      +'</div>'
      +'<div>'
      +'<label style="font-size:9px;color:#999;display:block;margin-bottom:2px">PRECIO $</label>'
      +'<input type="text" inputmode="decimal" value="'+it.precio.toFixed(2)+'" onfocus="this.select()" oninput="formatoMoneda(this);actualizarPedItem('+i+',\'precio\',dinero(this.value)||0);actualizarSubtotalPed('+i+')" style="width:68px;padding:6px 4px;border:0.5px solid #ddd;border-radius:6px;font-size:13px;text-align:center">'
      +'</div>'
      +'<span id="ped-subtotal-'+i+'" style="flex:1;text-align:right;font-size:14px;font-weight:700;color:var(--nbs-green-text)">$'+fmtNum(subtotal)+'</span>'
      +'</div>';
    el.appendChild(row);
  });
  actualizarTotalPedGeneral();
}

function actualizarPedItem(i, campo, valor){
  if(!pedItemsTemp[i]) return;
  pedItemsTemp[i][campo] = valor;
}

function cambiarCantPedItem(i, delta){
  if(!pedItemsTemp[i]) return;
  var nuevaCant = (pedItemsTemp[i].cant||1) + delta;
  if(nuevaCant < 1) nuevaCant = 1;
  pedItemsTemp[i].cant = nuevaCant;
  var input = document.getElementById('ped-cant-'+i);
  if(input) input.value = nuevaCant;
  actualizarSubtotalPed(i);
}

function actualizarSubtotalPed(i){
  var it = pedItemsTemp[i];
  if(!it) return;
  var subtotal = it.cant * it.precio;
  var span = document.getElementById('ped-subtotal-'+i);
  if(span) span.textContent = '$'+fmtNum(subtotal);
  actualizarTotalPedGeneral();
}

function actualizarTotalPedGeneral(){
  var el = document.getElementById('pedItems');
  if(!el) return;
  var viejo = document.getElementById('ped-total-row');
  if(viejo) viejo.remove();
  if(!pedItemsTemp.length) return;
  var totalGeneral = pedItemsTemp.reduce(function(s,it){ return s+(it.cant*it.precio); }, 0);
  var totalRow = document.createElement('div');
  totalRow.id = 'ped-total-row';
  totalRow.style.cssText = 'padding:10px 0;display:flex;justify-content:space-between;align-items:center;border-top:2px solid #1a237e;margin-top:4px';
  totalRow.innerHTML = '<span style="font-size:14px;font-weight:800;color:#1a237e">TOTAL ('+pedItemsTemp.length+')</span>'
    +'<span style="font-size:18px;font-weight:800;color:#1565C0">$'+fmtNum(totalGeneral)+'</span>';
  el.appendChild(totalRow);
}

function toggleNuevoProdPed(idxBarbero){
  barberoParaProdNuevo = (idxBarbero === undefined || idxBarbero === null) ? null : idxBarbero;
  var w = document.getElementById('ped-nuevo-prod-wrap');
  var visible = w.style.display !== 'none';
  w.style.display = visible ? 'none' : 'block';
  if(!visible){
    document.getElementById('pednp-marca').value = '';
    document.getElementById('pednp-nombre').value = '';
    document.getElementById('pednp-cat').value = '';
    document.getElementById('pednp-costo').value = '0.00';
    document.getElementById('pednp-precio').value = '0.00';
    document.getElementById('pednp-stock').value = '0';
    // Si viene desde una tarjeta de barbero, el panel se muestra encima de la pantalla
    // de tarjetas -no dentro del formulario viejo, que ahi no se veria-.
    if(barberoParaProdNuevo !== null){
      var titulo = document.getElementById('pednp-titulo-barbero');
      if(titulo && pedidosMultiTemp[barberoParaProdNuevo]){
        titulo.textContent = 'Para ' + nombreCl(pedidosMultiTemp[barberoParaProdNuevo].cliente);
        titulo.style.display = 'block';
      }
      var flotante = document.getElementById('ped-nuevo-prod-flotante');
      if(flotante){
        flotante.style.display = 'flex';
        flotante.appendChild(w);
        w.style.margin = '0';
        w.style.maxHeight = '85vh';
        w.style.overflowY = 'auto';
        w.style.width = '100%';
      }
    }
  } else {
    cerrarPanelProdNuevo();
  }
}

// Devuelve el panel a su sitio original -dentro del formulario- y esconde el fondo flotante
function cerrarPanelProdNuevo(){
  var w = document.getElementById('ped-nuevo-prod-wrap');
  var flotante = document.getElementById('ped-nuevo-prod-flotante');
  var casa = document.getElementById('ped-nuevo-prod-casa');
  if(flotante) flotante.style.display = 'none';
  if(w && casa && w.parentElement !== casa){
    casa.appendChild(w);
    w.style.margin = '';
    w.style.maxHeight = '';
    w.style.overflowY = '';
    w.style.width = '';
  }
  if(w) w.style.display = 'none';
  var titulo = document.getElementById('pednp-titulo-barbero');
  if(titulo) titulo.style.display = 'none';
  barberoParaProdNuevo = null;
}

function guardarNuevoProdPed(){
  loadProds();
  var marca = document.getElementById('pednp-marca').value.trim();
  if(!marca){ alert('La marca es requerida'); return; }
  var nombre = document.getElementById('pednp-nombre').value.trim();
  if(!nombre){ alert('El nombre del producto es requerido'); return; }
  var nombreCompleto = marca + ' ' + nombre;
  var cat = document.getElementById('pednp-cat').value.trim();
  var costo = dinero(document.getElementById('pednp-costo').value) || 0;
  var precio = dinero(document.getElementById('pednp-precio').value) || 0;
  var stock = parseInt(document.getElementById('pednp-stock').value) || 0;
  var nuevoId = 'custom_' + Date.now();
  var nuevoProd = { id: nuevoId, marca: marca, nombreCorto: nombre, nombre: nombreCompleto, cat: cat, sku: '', costo: costo, precio: precio, stock: stock, min: 5 };
  productos.push(nuevoProd);
  SS('np', productos);

  if(barberoParaProdNuevo !== null && pedidosMultiTemp[barberoParaProdNuevo]){
    // Vino desde una tarjeta de barbero: se le agrega a ESE barbero
    var idx = barberoParaProdNuevo;
    var quien = nombreCl(pedidosMultiTemp[idx].cliente);
    pedidosMultiTemp[idx].items.push({ pid: nuevoId, nombre: nombreCompleto, cant: 1, precio: precio, costo: costo });
    cerrarPanelProdNuevo();
    renderPedidosMultiples();
    alert('✅ "'+nombreCompleto+'" agregado al catálogo y al pedido de '+quien+'.');
    return;
  }

  // Flujo normal de un solo barbero
  pedItemsTemp.push({ pid: nuevoId, nombre: nombreCompleto, cant: 1, precio: precio, costo: costo });
  cerrarPanelProdNuevo();
  renderPedItems();
  alert('✅ "'+nombreCompleto+'" agregado al catálogo y al pedido.');
}

function rmPedItem(i){ pedItemsTemp.splice(i,1); renderPedItems(); }

function ocultarAccionesDeConversion(){
  var acc = document.getElementById('pedido-conv-acciones');
  if(acc) acc.style.display = 'none';
}

function calcularFidelidad(c, ventasActivas){
  // Las cuentas de CONSIGNACION tampoco entran a este programa. Son productos
  // dejados para pagar segun se vendan, no compras del barbero — no pueden ganar
  // el regalo de los $400. -6 ago, lo cazo Sensei con la cuenta de Isidro-
  if(!clienteCuentaVIP(c)) return { total: 0, meta: 400, regalosDados: 0, consignacion: true };
  var regalos = c.fidelidadRegalos || [];
  var ultimoRegaloFecha = regalos.length ? parsearFechaVenta(regalos[regalos.length-1].fecha) : null;
  var total = 0;
  ventasActivas.forEach(function(v){
    if(ultimoRegaloFecha && parsearFechaVenta(v.fecha) <= ultimoRegaloFecha) return;
    (v.items||[]).forEach(function(it){
      if(it.precio < 30){ total += it.cant * it.precio; }
    });
  });
  return { total: total, meta: 400, regalosDados: regalos.length };
}


// ═══════════════════════════════════════════════════════════════════
//  ENTREGAR EL PREMIO VIP  (5 ago 2026)
//
//  Sensei: "cuando yo regale el producto debe registrarse tambien para
//  que pueda ser descontado y al mismo tiempo tambien afecte mi
//  verdadera ganancia y todo lo que tenga que ver con los numeros de
//  la app en cuestion de contabilidad y finanzas".
//
//  COMO SE REGISTRA — y por que asi:
//     total:  $0.00   → no infla el "Vendi", porque no entro dinero
//     costo:  el real → SI baja la ganancia, porque el producto costo
//     stock:  baja 1  → salio de la mercancia de verdad
//     esPremioVIP: true
//
//  Y la LEY DEL DINERO se sigue cumpliendo: vendido 0 = cobrado 0 +
//  por cobrar 0.
// ═══════════════════════════════════════════════════════════════════

function darRegaloFidelidad(cid){
  clientes = LS('ncl', []);
  var c = clientes.find(function(x){ return String(x.id)===String(cid); });
  if(!c) return;
  ventas = LS('nv', []);
  var ventasActivas = ventas.filter(function(v){ return String(v.cid)===String(cid) && !v.cancelada; });
  var fidelidad = calcularFidelidad(c, ventasActivas);
  if(fidelidad.total < fidelidad.meta){
    alert('Este cliente todavía no llega a los $'+fmtNum(fidelidad.meta)+' — lleva $'+fmtNum(fidelidad.total)+'.');
    return;
  }
  var monto = prompt('¿Cuánto vale el regalo que le vas a dar? (sugerido entre $10 y $20)', '15');
  if(monto === null) return;
  var montoNum = dinero(monto);
  if(isNaN(montoNum) || montoNum <= 0){ alert('Monto inválido'); return; }
  if(!confirm('¿Confirmar regalo de $'+fmtNum(montoNum)+' para '+nombreCl(c)+'?\n\nEl contador de fidelidad vuelve a $0 y empieza un nuevo ciclo hacia $'+fmtNum(fidelidad.meta)+'.')) return;
  if(!c.fidelidadRegalos) c.fidelidadRegalos = [];
  c.fidelidadRegalos.push({ monto: montoNum, fecha: fechaHoy() });
  c.fidelidadNotificado = false;
  SS('ncl', clientes);
  alert('🎁 ¡Regalo registrado! El ciclo de fidelidad de '+nombreCl(c)+' vuelve a empezar.');
  verCl(cid);
}

// Version liviana de agruparPosiblesDuplicados para UN cliente -se usa al abrir su
// perfil, para avisar EN EL MOMENTO si hay otra copia suya con deuda escondida-.
function posiblesDuplicadosDe(c, listaClientes){
  // \ud83d\udd11 EL MISMO NOMBRE NO BASTA -6 sep-. Sensei: "son dos clientes distintos porque
  // son de dos barberias diferentes... no tiene logica la confusion de la app".
  // Sus dos Jose Rodriguez: apodo, negocio, direccion y telefono TODO distinto.
  // Se avisa solo si comparten TELEFONO, o el nombre Y (el negocio o la direccion).
  var nom = normalizarTextoBusqueda((c.nombre||'')+' '+(c.apellido||''));
  var tel = (c.tel||'').replace(/\D/g,'');
  var neg = normalizarTextoBusqueda(c.negocio||'');
  var dir = normalizarTextoBusqueda(c.dir||'');
  return listaClientes.filter(function(x){
    if(String(x.id) === String(c.id)) return false;
    // \u260e\ufe0f El telefono manda: mismo numero es la misma persona
    var xTel = (x.tel||'').replace(/\D/g,'');
    if(tel && tel.length >= 7 && xTel === tel) return true;
    var xNom = normalizarTextoBusqueda((x.nombre||'')+' '+(x.apellido||''));
    if(!nom || xNom !== nom) return false;
    // Mismo nombre: hace falta ademas el mismo negocio o la misma direccion
    var xNeg = normalizarTextoBusqueda(x.negocio||'');
    if(neg && xNeg && neg === xNeg) return true;
    var xDir = normalizarTextoBusqueda(x.dir||'');
    if(dir && xDir && dir === xDir) return true;
    // Si ninguno de los dos tiene negocio, direccion ni telefono, el nombre es lo unico
    if(!neg && !dir && !tel && !xNeg && !xDir && !xTel) return true;
    return false;
  });
}


// ═══════════════════════════════════════════════════════════════════
//  EL PANEL COMPACTO DEL PERFIL DE CLIENTE  (9 ago 2026)
//
//  Una sola lista de renglones iguales. Cada uno enseña YA el numero que
//  importa, asi muchas veces ni hay que abrirlo. Se abre UNO A LA VEZ,
//  para que la pantalla no se corra. Y lo que esta vacio NO SE VE.
// ═══════════════════════════════════════════════════════════════════

var _panelAbierto = null;   // que renglon esta abierto ahora

// ── Los datos de un cliente, todos juntos ──

// ═══════════════════════════════════════════════════════════════════
//  💵 CUÁNTO SE COBRÓ Y CUÁNTO SE DEBE DE UNA FACTURA  (15 ago 2026)
//
//  🔴 EL FALLO QUE CAZÓ SENSEI: en la ficha de José Rodríguez el DEBE
//  decía $35 y eran $45. Su factura del 26 de junio era de CONTADO,
//  pero fue MODIFICADA y quedó debiendo $10. Toda la app daba por
//  sentado que una factura de contado está pagada completa, así que
//  esos $10 no los contaba NADIE.
//
//  🔑 LA REGLA, en un solo sitio para que no se contradigan:
//    · contado SIN pagos apuntados → pagada completa (así son las de siempre)
//    · contado CON pagos apuntados → se les hace caso: lo que falte SE DEBE
//    · a crédito                   → lo de siempre: total menos los abonos
// ═══════════════════════════════════════════════════════════════════
function correrRevisionDiaria(){
  try {
    var hoy = fechaHoy();
    var r = revisionDiaria();
    SS('nbs_revision_resultado', r);
    var graves = (r.hallazgos || []).filter(function(x){ return x.grave; });

    // La huella de lo grave: si cambia, es que salió algo nuevo y hay que avisar YA,
    // aunque la revisión de hoy ya se hubiera corrido.
    var huella = graves.map(function(x){ return x.titulo; }).sort().join(' | ');
    var huellaVieja = LS('nbs_revision_huella', '');
    var yaHoy = (LS('nbs_revision_dia', '') === hoy);

    SS('nbs_revision_dia', hoy);
    SS('nbs_revision_huella', huella);

    if(!graves.length) return;                 // nada grave: callado
    if(yaHoy && huella === huellaVieja) return; // lo mismo de antes: no repetir
    setTimeout(function(){ mostrarRevisionDiaria(); }, 2500);
  } catch(e){}
}

function mostrarRevisionDiaria(){
  var r = LS('nbs_revision_resultado', null);
  if(!r) r = revisionDiaria();
  var hall = r.hallazgos || [];
  var h = '<div style="padding:14px">';
  h += '<div style="font-size:16px;font-weight:900;color:var(--nbs-ink);margin-bottom:3px">'
    + '\ud83d\udd14 Revisi\u00f3n de hoy</div>';
  h += '<div style="font-size:11px;color:var(--nbs-muted);margin-bottom:12px">'
    + 'La app se revisa sola una vez al d\u00eda</div>';

  if(!hall.length){
    h += '<div style="background:var(--nbs-green-bg);border-radius:10px;padding:16px;text-align:center">'
      + '<div style="font-size:26px">\u2705</div>'
      + '<div style="font-size:13.5px;font-weight:800;color:var(--nbs-green-text);margin-top:5px">'
      + 'Todo cuadra</div>'
      + '<div style="font-size:11.5px;color:var(--nbs-muted);margin-top:4px;line-height:1.5">'
      + 'El dinero est\u00e1 bien, ninguna factura est\u00e1 pagada de m\u00e1s y no hay nada raro.</div></div>';
  } else {
    hall.forEach(function(x){
      var col = x.grave ? 'var(--nbs-red-text)' : 'var(--nbs-gold-dark)';
      var bg  = x.grave ? 'var(--nbs-red-bg)'   : 'var(--nbs-gold-bg)';
      h += '<div style="background:' + bg + ';border-radius:10px;padding:11px;margin-bottom:9px">'
        + '<div style="font-size:13px;font-weight:900;color:' + col + ';line-height:1.3">'
        +   (x.grave ? '\ud83d\udd34 ' : '\u26a0\ufe0f ') + escaparHtml(x.titulo) + '</div>'
        + '<div style="font-size:11.5px;color:var(--nbs-ink);margin-top:4px;line-height:1.5">'
        +   escaparHtml(x.detalle) + '</div>'
        + (x.accion && x.fn
            ? '<button onclick="cerrarRevisionDiaria();' + x.fn + '()" '
              + 'style="width:100%;margin-top:8px;padding:9px;background:#fff;border:1.5px solid ' + col
              + ';color:' + col + ';border-radius:8px;font-size:12px;font-weight:800;cursor:pointer">'
              + escaparHtml(x.accion) + '</button>'
            : '')
        + '</div>';
    });
  }
  h += '<button onclick="cerrarRevisionDiaria()" class="btn" '
    + 'style="width:100%;margin-top:6px;background:var(--nbs-ink);color:#fff">Entendido</button>';
  h += '</div>';

  var ov = document.getElementById('revision-overlay');
  if(!ov){
    ov = document.createElement('div');
    ov.id = 'revision-overlay';
    document.body.appendChild(ov);
  }
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:99990;'
    + 'display:flex;align-items:center;justify-content:center;padding:16px';
  ov.innerHTML = '<div style="background:#fff;border-radius:14px;max-width:400px;width:100%;'
    + 'max-height:85vh;overflow:auto">' + h + '</div>';
}

function cerrarRevisionDiaria(){
  var ov = document.getElementById('revision-overlay');
  if(ov) ov.style.display = 'none';
}

function irARevisionIntegridad(){ try { ir('p-integridad'); } catch(e){ try { ir('p-ajustes'); } catch(e2){} } }
function irACuentasPorCobrar(){ try { ir('p-cxc'); renderCxC(''); } catch(e){} }
function arreglarPagadasDeMas(){
  ventas = LS('nv', []);
  clientes = LS('ncl', []);
  var r2 = function(x){ return Math.round((x || 0) * 100) / 100; };
  var arreglos = [];
  ventas.forEach(function(v){
    if(v.cancelada) return;
    var pg = 0;
    (v.pagosFactura || []).forEach(function(p){ if(!p.esDevolucion) pg += parseFloat(p.monto) || 0; });
    var sobra = r2(pg - (parseFloat(v.total) || 0));
    if(sobra > 0.005) arreglos.push({ v: v, sobra: sobra });
  });
  if(!arreglos.length){ avisoGrande('\u2705 No hay ninguna factura pagada de m\u00e1s.'); return; }
  var total = r2(arreglos.reduce(function(a, x){ return a + x.sobra; }, 0));
  if(!confirm('\u00bfArreglar ' + arreglos.length + ' factura(s) pagada(s) de m\u00e1s?\n\n'
      + 'Se les recortan los pagos a lo que de verdad vale la factura, y los $'
      + fmtNum(total) + ' que sobran quedan A FAVOR de cada cliente para su pr\u00f3xima compra.\n\n'
      + 'Ning\u00fan peso se pierde.')) return;

  arreglos.forEach(function(x){
    var v = x.v;
    var queda = parseFloat(v.total) || 0;
    var nuevos = [];
    (v.pagosFactura || []).forEach(function(p){
      if(p.esDevolucion){ nuevos.push(p); return; }
      if(queda <= 0.005) return;
      var usar = Math.min(parseFloat(p.monto) || 0, queda);
      nuevos.push(Object.assign({}, p, { monto: r2(usar) }));
      queda = r2(queda - usar);
    });
    v.pagosFactura = nuevos;
    var i = clientes.findIndex(function(c){ return String(c.id) === String(v.cid); });
    if(i >= 0) clientes[i].creditoAFavor = r2((clientes[i].creditoAFavor || 0) + x.sobra);
  });
  SS('nv', ventas);
  SS('ncl', clientes);
  avisoGrande('\u2705 ' + arreglos.length + ' factura(s) arreglada(s).\n\n$' + fmtNum(total)
    + ' quedaron a favor de sus clientes.');
  try { renderCxC(''); } catch(e){}
}


// ═══════════════════════════════════════════════════════════════════
//  🔢 EL CÓDIGO DE REGISTRO — por antigüedad de primera compra
//
//  🔴 SE ASIGNA UNA VEZ Y NO CAMBIA NUNCA MÁS. Se guarda en
//  `cl.codigoRegistro`. Si un cliente se borra, su número queda
//  vacío para siempre — eso es correcto: renumerar haría que el
//  001 de hoy fuera otro mañana.
// ═══════════════════════════════════════════════════════════════════

// La fecha de su primera compra. Los balances iniciales cuentan:
// son deuda que traía de antes, o sea que ya era cliente.
function asignarCodigosDeRegistro(){
  clientes = LS('ncl', []);
  ventas = LS('nv', []);

  // El número más alto que ya se dio
  var mayor = 0;
  clientes.forEach(function(c){
    var n = parseInt(c.codigoRegistro || 0, 10) || 0;
    if(n > mayor) mayor = n;
  });

  // Los que no tienen código, EN EL ORDEN EN QUE LOS REGISTRÓ.
  // El `id` del cliente es la marca de tiempo de cuando lo creó, así que ordenar
  // por id ES ordenar por cuándo lo metió en la app. -16 ago-
  var sinCodigo = [];
  clientes.forEach(function(c){
    if(c.codigoRegistro) return;
    sinCodigo.push({ cliente: c, cuando: parseFloat(c.id) || 0 });
  });
  if(!sinCodigo.length) return 0;

  sinCodigo.sort(function(a, b){ return a.cuando - b.cuando; });

  sinCodigo.forEach(function(x){
    mayor++;
    var i = clientes.findIndex(function(c){ return String(c.id) === String(x.cliente.id); });
    if(i >= 0) clientes[i].codigoRegistro = mayor;
  });
  SS('ncl', clientes);
  try { marcarPendienteDeSubir('ncl'); } catch(e){}
  return sinCodigo.length;
}

// Cómo se ve: 001, 042, 147...
function etiquetaCodigo(cl, chico){
  var c = codigoDeCliente(cl);
  if(!c) return '';
  return '<span style="display:inline-block;background:#EEF0F8;color:#3949AB;'
    + 'border-radius:5px;padding:' + (chico ? '1px 5px' : '2px 6px') + ';'
    + 'font-size:' + (chico ? '9.5' : '10.5') + 'px;font-weight:900;'
    + 'letter-spacing:.5px;margin-right:5px;vertical-align:middle">'
    + c + '</span>';
}


// ═══════════════════════════════════════════════════════════════════
//  📋 EL LISTADO COMPLETO DE CLIENTES
//
//  Todo lo que la app sabe de cada cliente, en una hoja que se puede
//  imprimir o compartir. Con orden y filtro a escoger.
// ═══════════════════════════════════════════════════════════════════
var _listadoOrden = 'codigo';
var _listadoFiltro = 'todos';

function previewListado(){
  var caja = document.getElementById('lst-preview');
  if(!caja) return;
  var r = armarListadoClientes();
  var debe = r.lista.reduce(function(a, x){ return a + x.debe; }, 0);
  var comp = r.lista.reduce(function(a, x){ return a + x.comprado; }, 0);
  caja.innerHTML = '<b>' + r.lista.length + ' cliente(s)</b><br>'
    + 'Te compraron $' + fmtNum(comp) + '<br>'
    + 'Te deben $' + fmtNum(debe)
    + (r.lista.length ? '<br><span style="color:var(--nbs-muted);font-size:11px">Empieza por: '
        + escaparHtml(r.lista[0].nombre.slice(0, 26)) + '</span>' : '');
}

function _cuadreR2(n){ return Math.round((parseFloat(n) || 0) * 100) / 100; }

// ── Lo que la app dice que cobró entre dos fechas ──
// 🔒 SOLO LEE de `nv`. No toca nada.
function fechaDesdeISO(txt){
  var t = String(txt || '').trim();
  if(!t) return null;
  var p = t.split('-');
  if(p.length === 3){
    var a = parseInt(p[0], 10), m = parseInt(p[1], 10), dd = parseInt(p[2], 10);
    if(a && m && dd) return new Date(a, m - 1, dd);
  }
  // Por si viene en MM/DD/AAAA
  return parsearFechaVenta(t);
}

// Y al revés: de MM/DD/AAAA a AAAA-MM-DD, que es lo que entiende el calendario
function fechaAISO(txt){
  var f = parsearFechaVenta(txt);
  if(!f) return '';
  return f.getFullYear() + '-' + ('0' + (f.getMonth()+1)).slice(-2)
       + '-' + ('0' + f.getDate()).slice(-2);
}

function abrirCajaCuadre(){
  ir('p-cuadre');
  pintarElegirDiasCuadre();
}

function pintarElegirDiasCuadre(){
  var el = document.getElementById('cuadre-cuerpo');
  if(!el) return;
  var hoy = fechaHoy();
  var h = '';

  h += '<div style="background:linear-gradient(135deg,#00695C,#00897B);border-radius:13px;'
    + 'padding:15px;margin-bottom:13px;color:#fff">'
    + '<div style="font-size:10.5px;font-weight:900;letter-spacing:1.2px;opacity:.85">PASO 1</div>'
    + '<div style="font-size:17px;font-weight:900;line-height:1.2">\u00bfQu\u00e9 quieres cuadrar?</div>'
    + '<div style="font-size:11.5px;opacity:.9;margin-top:3px">'
    +   'Un d\u00eda, varios d\u00edas o una semana \u2014 t\u00fa decides.</div></div>';

  h += '<div style="display:flex;gap:7px;margin-bottom:8px">'
    + '<button onclick="cuadreRango(\'hoy\')" class="btn" style="flex:1;margin:0;padding:12px;'
    +   'background:#fff;border:2px solid #00695C;color:#00695C;font-size:13px;font-weight:900">'
    +   '\ud83d\udcc5 Hoy</button>'
    + '<button onclick="cuadreRango(\'ayer\')" class="btn" style="flex:1;margin:0;padding:12px;'
    +   'background:#fff;border:2px solid #00695C;color:#00695C;font-size:13px;font-weight:900">'
    +   '\ud83d\udcc5 Ayer</button></div>';
  h += '<button onclick="cuadreRango(\'semana\')" class="btn" style="width:100%;margin:0 0 13px;'
    + 'padding:12px;background:#fff;border:2px solid #00695C;color:#00695C;font-size:13px;'
    + 'font-weight:900">\ud83d\udcc5 Esta semana (lunes a hoy)</button>';

  h += '<div style="font-size:10.5px;font-weight:900;color:var(--nbs-muted);letter-spacing:.6px;'
    + 'margin-bottom:6px">O ESCOGE T\u00da LOS D\u00cdAS</div>';
  // 🔑 type="date" para que se abra el CALENDARIO del teléfono, como en el resto
  // de la app. Devuelve AAAA-MM-DD. -17 ago-
  var hoyISO = fechaAISO(hoy);
  h += '<div style="display:flex;gap:7px;margin-bottom:8px">'
    + '<div style="flex:1"><label class="lbl" style="margin:0 0 3px">DESDE</label>'
    +   '<input class="inp" id="cuadre-desde" type="date" '
    +   'value="' + hoyISO + '" style="margin:0"></div>'
    + '<div style="flex:1"><label class="lbl" style="margin:0 0 3px">HASTA</label>'
    +   '<input class="inp" id="cuadre-hasta" type="date" '
    +   'value="' + hoyISO + '" style="margin:0"></div></div>';
  h += '<button onclick="cuadreRango(\'manual\')" class="btn" style="width:100%;margin:0 0 14px;'
    + 'background:#00695C;color:#fff;font-weight:900">\ud83d\udd0d Ver estos d\u00edas</button>';

  h += '<div id="cuadre-loque"></div>';

  h += '<div style="border-top:1px solid var(--nbs-line);margin-top:16px;padding-top:13px">'
    + '<button onclick="verRecordCuadres()" class="btn" style="width:100%;margin:0;'
    +   'background:#F4F4F8;border:1px solid #DDD;color:var(--nbs-ink);font-weight:800">'
    +   '\ud83d\udccb Mis cuadres guardados (' + cuadresGuardados().length + ')</button></div>';

  el.innerHTML = h;
}

function cuadresGuardados(){
  try {
    var l = LS(CUADRE_LLAVE, []);
    return Array.isArray(l) ? l : [];
  } catch(e){ return []; }
}

// ── Calcular el rango que escogió ──
function cuadreRango(cual){
  var hoy = new Date(); hoy.setHours(0,0,0,0);
  var d, h2;
  if(cual === 'hoy'){ d = new Date(hoy); h2 = new Date(hoy); }
  else if(cual === 'ayer'){
    d = new Date(hoy); d.setDate(d.getDate() - 1); h2 = new Date(d);
  }
  else if(cual === 'semana'){
    d = new Date(hoy);
    var dow = d.getDay();                     // 0=domingo
    var atras = (dow === 0) ? 6 : (dow - 1);  // hasta el lunes
    d.setDate(d.getDate() - atras);
    h2 = new Date(hoy);
  }
  else {
    d = fechaDesdeISO((document.getElementById('cuadre-desde') || {}).value);
    h2 = fechaDesdeISO((document.getElementById('cuadre-hasta') || {}).value);
    if(!d || !h2){ alert('Escoge las dos fechas en el calendario.'); return; }
    if(d.getTime() > h2.getTime()){ alert('La fecha DESDE no puede ser despu\u00e9s que la HASTA.'); return; }
  }
  h2.setHours(23,59,59,999);
  var r = cobradoEntre(d, h2);
  _cuadreActual = { desde: d, hasta: h2, appDice: r.total, pagos: r.pagos, dias: r.dias, id: null };

  var caja = document.getElementById('cuadre-loque');
  if(!caja) return;
  caja.innerHTML = '<div style="background:var(--nbs-green-bg);border-radius:12px;padding:15px;'
    + 'text-align:center;border:1.5px solid #A5D6A7">'
    + '<div style="font-size:10.5px;font-weight:900;color:var(--nbs-muted);letter-spacing:.8px">'
    +   'EN ESOS D\u00cdAS LA APP DICE QUE COBRASTE</div>'
    + '<div style="font-size:31px;font-weight:900;color:var(--nbs-green-text);line-height:1.1;'
    +   'margin:4px 0">$' + fmtNum(r.total) + '</div>'
    + '<div style="font-size:11.5px;color:var(--nbs-muted)">'
    +   textoRangoCuadre(d, h2) + ' \u00b7 ' + r.pagos + ' pago(s)</div>'
    + '<button onclick="empezarConteoCuadre()" class="btn" style="width:100%;margin:12px 0 0;'
    +   'background:#00695C;color:#fff;font-weight:900;font-size:14px">'
    +   '\ud83e\uddee Empezar el cuadre</button>'
    + '</div>';
}

function textoRangoCuadre(d, h2){
  var f1 = (d.getMonth()+1) + '/' + d.getDate();
  var f2 = (h2.getMonth()+1) + '/' + h2.getDate();
  return (f1 === f2) ? ('el ' + f1) : ('del ' + f1 + ' al ' + f2);
}

// ── LA PANTALLA 2: contar el dinero ──
function empezarConteoCuadre(){
  if(!_cuadreActual){ alert('Escoge primero los d\u00edas a cuadrar.'); return; }
  if(!_cuadreActual.billetes) _cuadreActual.billetes = {};
  if(!_cuadreActual.monedas)  _cuadreActual.monedas = {};
  if(_cuadreActual.cashapp === undefined) _cuadreActual.cashapp = 0;
  if(_cuadreActual.zelle === undefined)   _cuadreActual.zelle = 0;
  if(_cuadreActual.cheques === undefined) _cuadreActual.cheques = 0;
  if(_cuadreActual.fondo === undefined)   _cuadreActual.fondo = parseFloat(LS(CUADRE_FONDO, 0)) || 0;
  pintarConteoCuadre();
}

function pintarConteoCuadre(){
  var el = document.getElementById('cuadre-cuerpo');
  if(!el || !_cuadreActual) return;
  var C = _cuadreActual;
  var h = '';

  h += '<div style="background:linear-gradient(135deg,#00695C,#00897B);border-radius:13px;'
    + 'padding:14px;margin-bottom:12px;color:#fff;display:flex;align-items:center;gap:10px">'
    + '<button onclick="pintarElegirDiasCuadre()" style="background:rgba(255,255,255,.2);'
    +   'border:none;color:#fff;border-radius:8px;padding:8px 11px;font-size:14px;cursor:pointer">'
    +   '\u2190</button>'
    + '<div><div style="font-size:10px;font-weight:900;letter-spacing:1.2px;opacity:.85">CUADRE</div>'
    + '<div style="font-size:15.5px;font-weight:900;line-height:1.2">'
    +   textoRangoCuadre(C.desde, C.hasta) + '</div></div></div>';

  // ── LOS BILLETES ──
  h += _cuadreSeccion('\ud83d\udcb5 BILLETES', CUADRE_BILLETES, 'billetes');
  h += _cuadreSeccion('\ud83e\ude99 MONEDAS', CUADRE_MONEDAS, 'monedas');

  var efec = totalEfectivoCuadre();
  h += '<div style="display:flex;justify-content:space-between;align-items:center;'
    + 'background:#E8F5E9;border-radius:10px;padding:11px 14px;margin-bottom:14px">'
    + '<span style="font-size:12.5px;font-weight:900;color:var(--nbs-green-text)">EFECTIVO CONTADO</span>'
    + '<span style="font-size:19px;font-weight:900;color:var(--nbs-green-text)" id="cuadre-efec">$'
    +   fmtNum(efec) + '</span></div>';

  // ── LO QUE NO ES EFECTIVO ──
  h += '<div style="font-size:10.5px;font-weight:900;color:var(--nbs-muted);letter-spacing:.7px;'
    + 'margin-bottom:7px">\ud83d\udcf1 LO QUE NO ES EFECTIVO</div>';
  [['cashapp','\ud83d\udcf1 CashApp'], ['zelle','\ud83c\udfe6 Zelle'], ['cheques','\ud83e\uddfe Cheques']]
    .forEach(function(x){
      h += '<div style="display:flex;align-items:center;gap:9px;margin-bottom:6px">'
        + '<span style="flex:1;font-size:13px;font-weight:700">' + x[1] + '</span>'
        + '<input class="inp" type="text" inputmode="numeric" id="cuadre-' + x[0] + '" '
        +   'value="' + (C[x[0]] ? C[x[0]].toFixed(2) : '') + '" placeholder="0.00" '
        +   'oninput="formatoMoneda(this);cambiarOtroCuadre(\'' + x[0] + '\', this.value)" '
        +   'style="flex:0 0 118px;margin:0;text-align:right;font-weight:800;padding:9px"></div>';
    });

  // ── EL FONDO FIJO ──
  h += '<div style="background:var(--nbs-gold-bg);border-radius:10px;padding:12px;margin:13px 0">'
    + '<div style="font-size:11px;font-weight:900;color:var(--nbs-gold-dark);letter-spacing:.5px;'
    +   'margin-bottom:3px">\ud83c\udfe6 FONDO FIJO</div>'
    + '<div style="font-size:11px;color:var(--nbs-muted);margin-bottom:7px">'
    +   'Lo que dejas siempre en la caja para dar cambio. Se descuenta porque no es de las ventas.</div>'
    + '<input class="inp" type="text" inputmode="numeric" id="cuadre-fondo" '
    +   'value="' + (C.fondo ? C.fondo.toFixed(2) : '') + '" placeholder="0.00" '
    +   'oninput="formatoMoneda(this);cambiarOtroCuadre(\'fondo\', this.value)" '
    +   'style="margin:0;text-align:right;font-weight:800"></div>';

  // ── LA COMPARACIÓN ──
  h += '<div id="cuadre-comparacion"></div>';

  h += '<label class="lbl">\ud83d\udcdd NOTA (si quieres apuntar algo)</label>';
  h += '<input class="inp" id="cuadre-nota" type="text" value="' + escaparHtml(C.nota || '') + '" '
    + 'placeholder="Ej: le di cambio a Luis y no lo apunt\u00e9" '
    + 'oninput="if(_cuadreActual) _cuadreActual.nota = this.value">';

  h += '<button onclick="guardarCuadre()" class="btn" style="width:100%;margin:10px 0 0;'
    + 'background:#00695C;color:#fff;font-weight:900;font-size:15px;padding:14px">'
    + '\ud83d\udcbe Guardar este cuadre</button>';

  el.innerHTML = h;
  pintarComparacionCuadre();
}

function _cuadreSeccion(titulo, lista, campo){
  var C = _cuadreActual;
  var h = '<div style="font-size:10.5px;font-weight:900;color:var(--nbs-muted);letter-spacing:.7px;'
    + 'margin:12px 0 7px">' + titulo + '</div>';
  lista.forEach(function(d){
    var k = String(d);
    var cant = parseInt(C[campo][k] || 0, 10) || 0;
    var sub = _cuadreR2(cant * d);
    h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:5px">'
      + '<input class="inp" type="number" inputmode="numeric" min="0" step="1" '
      +   'value="' + (cant || '') + '" placeholder="0" '
      +   'oninput="cambiarCantidadCuadre(\'' + campo + '\',\'' + k + '\', this.value)" '
      +   'style="flex:0 0 74px;margin:0;text-align:center;font-weight:900;font-size:16px;padding:9px">'
      + '<span style="flex:0 0 22px;text-align:center;color:var(--nbs-muted);font-size:13px">\u00d7</span>'
      + '<span style="flex:0 0 74px;font-size:14px;font-weight:800;color:var(--nbs-ink)">$'
      +   (d >= 1 ? d.toFixed(2) : d.toFixed(2)) + '</span>'
      + '<span style="flex:0 0 18px;text-align:center;color:var(--nbs-muted);font-size:13px">=</span>'
      + '<span id="cuadre-sub-' + campo + '-' + k.replace('.','_') + '" '
      +   'style="flex:1;text-align:right;font-size:14.5px;font-weight:900;'
      +   'color:' + (sub > 0 ? 'var(--nbs-green-text)' : '#BBB') + '">$' + fmtNum(sub) + '</span>'
      + '</div>';
  });
  return h;
}

function cambiarCantidadCuadre(campo, denom, valor){
  if(!_cuadreActual) return;
  var n = parseInt(valor, 10);
  if(isNaN(n) || n < 0) n = 0;
  _cuadreActual[campo][denom] = n;
  // Actualizar solo lo que cambió, sin repintar todo (para no perder el teclado)
  var sub = _cuadreR2(n * parseFloat(denom));
  var el = document.getElementById('cuadre-sub-' + campo + '-' + String(denom).replace('.','_'));
  if(el){
    el.textContent = '$' + fmtNum(sub);
    el.style.color = sub > 0 ? 'var(--nbs-green-text)' : '#BBB';
  }
  var ef = document.getElementById('cuadre-efec');
  if(ef) ef.textContent = '$' + fmtNum(totalEfectivoCuadre());
  pintarComparacionCuadre();
}

function cambiarOtroCuadre(campo, valor){
  if(!_cuadreActual) return;
  _cuadreActual[campo] = dinero(valor);
  if(campo === 'fondo'){ try { SS(CUADRE_FONDO, _cuadreActual.fondo); } catch(e){} }
  pintarComparacionCuadre();
}

function totalEfectivoCuadre(){
  if(!_cuadreActual) return 0;
  var t = 0;
  CUADRE_BILLETES.forEach(function(d){
    t += (parseInt(_cuadreActual.billetes[String(d)] || 0, 10) || 0) * d;
  });
  CUADRE_MONEDAS.forEach(function(d){
    t += (parseInt(_cuadreActual.monedas[String(d)] || 0, 10) || 0) * d;
  });
  return _cuadreR2(t);
}

function totalContadoCuadre(){
  if(!_cuadreActual) return 0;
  return _cuadreR2(totalEfectivoCuadre()
    + (_cuadreActual.cashapp || 0) + (_cuadreActual.zelle || 0) + (_cuadreActual.cheques || 0));
}

function pintarComparacionCuadre(){
  var caja = document.getElementById('cuadre-comparacion');
  if(!caja || !_cuadreActual) return;
  var C = _cuadreActual;
  var contado = totalContadoCuadre();
  var deVentas = _cuadreR2(contado - (C.fondo || 0));
  var dif = _cuadreR2(deVentas - C.appDice);
  var cuadra = Math.abs(dif) < 0.005;
  var sobra = dif > 0;

  var color = cuadra ? '#2E7D32' : (sobra ? '#F57F17' : '#C62828');
  var fondo = cuadra ? 'var(--nbs-green-bg)' : (sobra ? 'var(--nbs-gold-bg)' : 'var(--nbs-red-bg)');
  var texto = cuadra ? '\u2705 CUADRA PERFECTO'
                     : (sobra ? '\u26a0\ufe0f SOBRA' : '\ud83d\udd34 FALTA');

  var h = '<div style="background:' + fondo + ';border-radius:12px;padding:14px;margin:14px 0;'
    + 'border:1.5px solid ' + color + '33">';
  h += '<div style="font-size:10.5px;font-weight:900;color:var(--nbs-muted);letter-spacing:.8px;'
    + 'margin-bottom:9px">\ud83d\udd0d LA COMPARACI\u00d3N</div>';
  var fila = function(et, val, negrita, linea){
    return '<div style="display:flex;justify-content:space-between;padding:4px 0;'
      + (linea ? 'border-top:1px solid rgba(0,0,0,.12);margin-top:4px;padding-top:7px;' : '')
      + 'font-size:' + (negrita ? '13.5' : '12.5') + 'px">'
      + '<span style="color:var(--nbs-ink);font-weight:' + (negrita ? '900' : '600') + '">' + et + '</span>'
      + '<span style="font-weight:900;font-variant-numeric:tabular-nums">' + val + '</span></div>';
  };
  h += fila('Cont\u00e9', '$' + fmtNum(contado));
  if(C.fondo > 0.005) h += fila('\u2212 Fondo fijo', '\u2212$' + fmtNum(C.fondo));
  h += fila('De las ventas', '$' + fmtNum(deVentas), true, true);
  h += fila('La app dice', '$' + fmtNum(C.appDice), true);
  h += '<div style="display:flex;justify-content:space-between;align-items:center;'
    + 'border-top:2px solid ' + color + ';margin-top:8px;padding-top:9px">'
    + '<span style="font-size:14px;font-weight:900;color:' + color + '">' + texto + '</span>'
    + '<span style="font-size:21px;font-weight:900;color:' + color + '">$'
    +   fmtNum(Math.abs(dif)) + '</span></div>';
  h += '</div>';
  caja.innerHTML = h;
}

// ── GUARDAR ──
function guardarCuadre(){
  if(!_cuadreActual) return;
  var C = _cuadreActual;
  var contado = totalContadoCuadre();
  if(contado <= 0.005 && !confirm('No contaste nada. \u00bfGuardar as\u00ed de todos modos?')) return;
  var deVentas = _cuadreR2(contado - (C.fondo || 0));

  var reg = {
    id: C.id || ('cu' + Date.now()),
    desde: fechaDeObjeto(C.desde), hasta: fechaDeObjeto(C.hasta),
    appDice: C.appDice, pagos: C.pagos, dias: C.dias,
    billetes: C.billetes, monedas: C.monedas,
    cashapp: C.cashapp || 0, zelle: C.zelle || 0, cheques: C.cheques || 0,
    fondo: C.fondo || 0,
    contado: contado, deVentas: deVentas,
    diferencia: _cuadreR2(deVentas - C.appDice),
    nota: C.nota || '',
    cuando: fechaHoy(), hora: horaAhora12()
  };

  var l = cuadresGuardados();
  var i = l.findIndex(function(x){ return String(x.id) === String(reg.id); });
  if(i >= 0) l[i] = reg; else l.unshift(reg);
  SS(CUADRE_LLAVE, l);
  try { marcarPendienteDeSubir(CUADRE_LLAVE); } catch(e){}

  var d = reg.diferencia;
  avisoGrande((Math.abs(d) < 0.005
      ? '\u2705 Cuadre guardado \u2014 \u00a1cuadra perfecto!'
      : (d > 0 ? '\u26a0\ufe0f Cuadre guardado \u2014 sobran $' + fmtNum(d)
               : '\ud83d\udd34 Cuadre guardado \u2014 faltan $' + fmtNum(Math.abs(d)))));
  _cuadreActual = null;
  verRecordCuadres();
}

// Una fecha a MM/DD/AAAA
function fechaDeObjeto(d){
  if(!d) return '';
  return ('0' + (d.getMonth()+1)).slice(-2) + '/' + ('0' + d.getDate()).slice(-2)
    + '/' + d.getFullYear();
}

// ── LA PANTALLA 3: el récord ──
function verRecordCuadres(){
  ir('p-cuadre');
  var el = document.getElementById('cuadre-cuerpo');
  if(!el) return;
  var l = cuadresGuardados();
  var cuadraron = l.filter(function(x){ return Math.abs(x.diferencia) < 0.005; }).length;

  var h = '<div style="background:linear-gradient(135deg,#1a237e,#3949AB);border-radius:13px;'
    + 'padding:15px;margin-bottom:13px;color:#fff">'
    + '<div style="font-size:17px;font-weight:900">\ud83d\udccb Mis cuadres</div>'
    + '<div style="font-size:11.5px;opacity:.9;margin-top:2px">'
    +   l.length + ' cuadre(s) \u00b7 ' + cuadraron + ' cuadraron \u00b7 '
    +   (l.length - cuadraron) + ' con diferencia</div></div>';

  h += '<button onclick="pintarElegirDiasCuadre()" class="btn" style="width:100%;margin:0 0 13px;'
    + 'background:#00695C;color:#fff;font-weight:900">\ud83e\uddee Hacer un cuadre nuevo</button>';

  if(!l.length){
    h += '<div style="text-align:center;padding:30px 16px;color:var(--nbs-muted);font-size:13px;'
      + 'line-height:1.65">Todav\u00eda no has hecho ning\u00fan cuadre.<br><br>'
      + 'Toca el bot\u00f3n de arriba, escoge los d\u00edas y cuenta tu dinero.</div>';
  } else {
    l.forEach(function(c){
      var cuadra = Math.abs(c.diferencia) < 0.005;
      var sobra = c.diferencia > 0;
      var col = cuadra ? '#2E7D32' : (sobra ? '#F57F17' : '#C62828');
      var txt = cuadra ? '\u2705 Cuadr\u00f3'
                       : (sobra ? '\u26a0\ufe0f Sobraron $' + fmtNum(c.diferencia)
                                : '\ud83d\udd34 Faltaron $' + fmtNum(Math.abs(c.diferencia)));
      h += '<div style="background:#fff;border:1px solid var(--nbs-line);border-left:4px solid '
        + col + ';border-radius:10px;padding:12px;margin-bottom:9px">'
        + '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">'
        +   '<div style="flex:1;min-width:0">'
        +     '<div style="font-size:13.5px;font-weight:900;color:var(--nbs-ink)">'
        +       escaparHtml(c.desde === c.hasta ? c.desde : (c.desde + ' al ' + c.hasta)) + '</div>'
        +     '<div style="font-size:11px;color:var(--nbs-muted);margin-top:1px">'
        +       (c.dias || 1) + ' d\u00eda(s) \u00b7 guardado el ' + escaparHtml(String(c.cuando)) + '</div>'
        +   '</div>'
        +   '<div style="display:flex;gap:5px;flex-shrink:0">'
        +     '<button onclick="editarCuadre(' + _arg(c.id) + ')" '
        +       'style="background:#FFF8E1;border:1px solid #F9A825;border-radius:7px;padding:7px 10px;'
        +       'font-size:12px;cursor:pointer">\u270f\ufe0f</button>'
        +     '<button onclick="borrarCuadre(' + _arg(c.id) + ')" '
        +       'style="background:#FFEBEE;border:1px solid #C62828;border-radius:7px;padding:7px 10px;'
        +       'font-size:12px;cursor:pointer">\ud83d\uddd1\ufe0f</button>'
        +   '</div></div>'
        + '<div style="font-size:12px;color:var(--nbs-ink);margin-top:7px">'
        +   'Cont\u00e9 <b>$' + fmtNum(c.contado) + '</b> \u00b7 App dice <b>$' + fmtNum(c.appDice) + '</b></div>'
        + '<div style="font-size:12.5px;font-weight:900;color:' + col + ';margin-top:4px">'
        +   txt + '</div>'
        + (c.nota ? '<div style="font-size:11.5px;color:var(--nbs-muted);margin-top:5px;'
            + 'font-style:italic">\ud83d\udcdd ' + escaparHtml(c.nota) + '</div>' : '')
        + '</div>';
    });
  }
  el.innerHTML = h;
}

function editarCuadre(id){
  var c = cuadresGuardados().find(function(x){ return String(x.id) === String(id); });
  if(!c){ alert('No encontr\u00e9 ese cuadre.'); return; }
  var d = parsearFechaVenta(c.desde), h2 = parsearFechaVenta(c.hasta);
  if(h2) h2.setHours(23,59,59,999);
  // 🔑 Se vuelve a leer lo cobrado por si cambió algo desde entonces
  var r = cobradoEntre(d, h2);
  _cuadreActual = {
    id: c.id, desde: d, hasta: h2,
    appDice: r.total, pagos: r.pagos, dias: r.dias,
    billetes: c.billetes || {}, monedas: c.monedas || {},
    cashapp: c.cashapp || 0, zelle: c.zelle || 0, cheques: c.cheques || 0,
    fondo: c.fondo || 0, nota: c.nota || ''
  };
  ir('p-cuadre');
  pintarConteoCuadre();
}

function borrarCuadre(id){
  var c = cuadresGuardados().find(function(x){ return String(x.id) === String(id); });
  if(!c) return;
  if(!confirm('\u00bfBorrar el cuadre ' + (c.desde === c.hasta ? 'del ' + c.desde
      : 'del ' + c.desde + ' al ' + c.hasta) + '?\n\n'
      + 'Esto NO toca ninguna venta ni ning\u00fan pago \u2014 solo borra este cuadre.')) return;
  var l = cuadresGuardados().filter(function(x){ return String(x.id) !== String(id); });
  SS(CUADRE_LLAVE, l);
  try { marcarPendienteDeSubir(CUADRE_LLAVE); } catch(e){}
  verRecordCuadres();
  try { avisoChico('\ud83d\uddd1\ufe0f Cuadre borrado'); } catch(e){}
}



// ═══════════════════════════════════════════════════════════════════
//  🧠 EL CEREBRO DEL ASISTENTE
//
//  No busca frases exactas: busca IDEAS. Saca las palabras clave de
//  lo que Sensei dijo y decide qué le está preguntando.
//
//  Así entiende "quién me debe más", "cuál cliente me debe más
//  dinero", "los que más me deben", "quiénes tienen más deuda" —
//  todas la misma pregunta, escritas de forma distinta.
// ═══════════════════════════════════════════════════════════════════

// Quitar acentos y dejar todo parejo para poder comparar
function _limpiar(t){
  return String(t || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[¿?¡!.,;:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── LAS IDEAS QUE SABE RECONOCER ──
// Cada una tiene palabras que la delatan. Si aparecen varias, gana.
var IDEAS_ASISTENTE = [
  { id: 'quienDebeMas',
    debe: [['quien','quienes','cual','cuales','lista','clientes','cliente','los que','a quien','dime']],
    y:    [['debe','deben','debiendo','deuda','deudas','deudor','deudores','por cobrar',
            'tengo que cobrar','cobrarle','hay que cobrar','debo cobrar','falta cobrar','me deben']] },

  { id: 'cuantoDebeUno',
    debe: [['cuanto','que tanto','cuanta','cual es']],
    y:    [['debe','deuda','debiendo','me debe','su balance','su deuda']] },

  { id: 'totalPorCobrar',
    debe: [['cuanto','total','todo']],
    y:    [['me deben','por cobrar','en la calle','deben en total','deuda total']] },

  { id: 'quienCompraMas',
    debe: [['quien','quienes','cual','cuales','lista','mejores','mejor']],
    y:    [['compra','compran','compro','mas me compra','mejor cliente','mas dinero deja','deja mas','mas gasta']] },

  { id: 'quienDejaMas',
    debe: [['quien','cual','cuales','quienes']],
    y:    [['ganancia','deja mas ganancia','mas ganancia','mejor margen','mas margen']] },

  { id: 'comoMeFue',
    debe: [['como','cuanto','que tal']],
    y:    [['me fue','vendi hoy','voy hoy','va hoy','fue hoy','del dia','hoy']],
    ni:   ['mes','semana','ano'] },

  { id: 'esteMes',
    debe: [['cuanto','como','que tal','llevo','voy','vendi']],
    y:    [['mes','este mes','del mes','mensual','en el mes','llevo en el mes']] },

  { id: 'estaSemana',
    debe: [['cuanto','como','que tal']],
    y:    [['semana','esta semana','de la semana']] },

  { id: 'callados',
    debe: [['quien','quienes','cual','cuales','clientes']],
    y:    [['no viene','no ha venido','no compra','perdido','perdidos','callado','callados','dejo de comprar','no me compra','desaparecido','dormido','dormidos']] },

  { id: 'seAcaba',
    debe: [['que','cual','cuales','cuanto']],
    y:    [['se acaba','acabando','falta','agotado','agotados','tengo que comprar','necesito comprar','reponer','relleno','queda poco','sin stock']] },

  { id: 'cuantoTengoDe',
    debe: [['cuanto','cuantos','cuantas','tengo']],
    y:    [['tengo de','me queda','me quedan','quedan de','hay de','existencia','inventario de']] },

  { id: 'valorInventario',
    debe: [['cuanto','valor','vale']],
    y:    [['inventario','mercancia','en la van','productos tengo','todo el inventario']] },

  { id: 'yoDebo',
    debe: [['cuanto','que','a quien']],
    y:    [['yo debo','le debo','debo yo','suplidor','suplidores','por pagar','tengo que pagar']] },

  { id: 'ganancia',
    debe: [['cuanto','que']],
    y:    [['ganancia','gane','he ganado','margen','beneficio','utilidad']] },

  { id: 'gastos',
    debe: [['cuanto','que']],
    y:    [['gaste','gastos','gastado','he gastado']] },

  { id: 'vipQuienGano',
    debe: [['quien','quienes','cual','cuales','hay']],
    y:    [['vip','punto','puntos','gratis','premio','premios','se gano','regalo']] },

  { id: 'cuantosPuntos',
    debe: [['cuanto','cuantos','que']],
    y:    [['puntos tiene','puntos lleva','puntos de','vip de']] },

  { id: 'aQuienVisito',
    debe: [['a quien','quien','cuales','que','donde']],
    y:    [['visito','visitar','toca hoy','voy hoy','ruta de hoy','ruta','me toca']] },

  { id: 'noVisitado',
    debe: [['quien','quienes','cual','cuales','falta']],
    y:    [['no he visitado','sin visitar','falta visitar','no visite','hace tiempo que no']] },

  { id: 'ultimaCompra',
    debe: [['cuando','que dia']],
    y:    [['compro','me compro','ultima compra','vino','la ultima vez']] },

  { id: 'masVendido',
    debe: [['que','cual','cuales']],
    y:    [['mas vendo','mas se vende','mas vendido','mejor producto','mas sale','producto estrella']] },

  { id: 'menosVendido',
    debe: [['que','cual','cuales']],
    y:    [['menos vendo','no se vende','menos sale','no sale','parado','estancado']] },

  { id: 'facturasCliente',
    debe: [['cuales','que','cuantas','ver']],
    y:    [['facturas de','facturas tiene','sus facturas','le vendi']] },

  { id: 'reporte',
    debe: [['reporte','informe','resumen','dame','hazme']],
    y:    [['reporte','informe','resumen']] },

  { id: 'abrirPedido',
    debe: [['prepara','abre','empieza','hazme','arma']],
    y:    [['pedido','orden']] },

  { id: 'cuadre',
    debe: [['cuadrar','cuadre','contar','cuanto']],
    y:    [['caja','cuadre','efectivo','dinero de hoy','cuanto cobre hoy']] }
];

// 🔑 EL QUE DECIDE — cuenta cuántas palabras del tema aparecen y gana la que
// más tenga. NO exige que estén todas: la gente escribe como le sale. -17 ago-
function entenderIdea(texto){
  var q = _limpiar(texto);
  if(!q) return null;
  var mejor = null, mejorPunto = 0;

  IDEAS_ASISTENTE.forEach(function(idea){
    // Si trae una palabra que la descarta, se salta
    if(idea.ni && idea.ni.some(function(x){ return q.indexOf(_limpiar(x)) >= 0; })) return;

    var puntoDebe = 0, puntoY = 0;
    (idea.debe || []).forEach(function(grupo){
      grupo.forEach(function(p){
        var lp = _limpiar(p);
        if(!lp) return;
        if(q.indexOf(lp) >= 0) puntoDebe = Math.max(puntoDebe, lp.split(' ').length > 1 ? 2 : 1);
      });
    });
    (idea.y || []).forEach(function(grupo){
      grupo.forEach(function(p){
        var lp = _limpiar(p);
        if(!lp) return;
        // Las frases largas valen mucho más que una palabra suelta
        if(q.indexOf(lp) >= 0) puntoY += (lp.split(' ').length > 1 ? 6 : 3);
      });
    });

      // 🔑 Hace falta que aparezca ALGO del tema (el grupo "y"). El "debe" suma.
    if(puntoY <= 0) return;
    var total = puntoY + puntoDebe;
    if(total > mejorPunto){ mejorPunto = total; mejor = idea.id; }
  });

  // 🔑 SI NOMBRÓ A UN CLIENTE DE VERDAD, la pregunta es SOBRE ÉL.
  // ⚠️ Pero solo si el nombre es FUERTE: "los que mas me deben" no lleva nombre,
  // y una palabra suelta no puede convertir la pregunta. -17 ago-
  // ⚠️ Si la pregunta es en PLURAL o pide una LISTA, es de TODOS aunque
  // aparezca una palabra que se parezca a un nombre. -17 ago-
  var _esDeTodos = /\b(los que|las que|quienes|cuales|lista|todos|mas me deben|mis clientes|top)\b/.test(q);
  var _cl = _esDeTodos ? null : _clienteMencionado(q);
  if(_cl){
    if(mejor === 'quienDebeMas') mejor = 'cuantoDebeUno';
    if(mejor === 'quienCompraMas') mejor = 'facturasCliente';
  }

  return mejor ? { idea: mejor, punto: mejorPunto, texto: q } : null;
}

// ── Buscar a un cliente dentro de lo que dijo ──
function responderIdea(r, textoOriginal){
  var q = r.texto;

  // ── QUIÉNES ME DEBEN MÁS ──
  if(r.idea === 'quienDebeMas'){
    var lista = [];
    LS('ncl', []).forEach(function(c){
      var d = cuentaDeCliente(c.id).dinero.debe;
      if(d > 0.005) lista.push({ nombre: nombreCl(c), debe: d, cid: c.id });
    });
    lista.sort(function(a, b){ return b.debe - a.debe; });
    if(!lista.length) return { titulo: '\u2705 Nadie te debe nada', lineas: ['Todos tus clientes est\u00e1n al d\u00eda.'] };
    var total = lista.reduce(function(a, x){ return a + x.debe; }, 0);
    return {
      titulo: '\ud83d\udcb0 Los que m\u00e1s te deben',
      lineas: lista.slice(0, 10).map(function(x, i){
        return (i + 1) + '. <b>' + escaparHtml(x.nombre) + '</b> \u2014 $' + fmtNum(x.debe);
      }).concat(['', '<b>' + lista.length + ' clientes te deben $' + fmtNum(total) + ' en total</b>']),
      boton: ['\ud83d\udcb0 Ir a Cuentas por Cobrar', "cerrarAsistente();ir('p-cxc')"]
    };
  }

  // ── CUÁNTO ME DEBEN EN TOTAL ──
  if(r.idea === 'totalPorCobrar'){
    var t = 0, n = 0;
    LS('ncl', []).forEach(function(c){
      var d = cuentaDeCliente(c.id).dinero.debe;
      if(d > 0.005){ t += d; n++; }
    });
    return { titulo: '\ud83d\udcb0 Te deben $' + fmtNum(t),
             lineas: ['Repartido entre <b>' + n + ' cliente(s)</b>.'],
             boton: ['\ud83d\udcb0 Ver el detalle', "cerrarAsistente();ir('p-cxc')"] };
  }

  // ── QUIÉN ME COMPRA MÁS ──
  if(r.idea === 'quienCompraMas'){
    var l2 = [];
    LS('ncl', []).forEach(function(c){
      var d = cuentaDeCliente(c.id).dinero;
      if(d.comprado > 0.005) l2.push({ nombre: nombreCl(c), c: d.comprado, g: d.ganancia });
    });
    l2.sort(function(a, b){ return b.c - a.c; });
    if(!l2.length) return { titulo: '\ud83e\udd14 Todav\u00eda no hay compras', lineas: [] };
    return { titulo: '\ud83c\udfc6 Los que m\u00e1s te compran',
             lineas: l2.slice(0, 10).map(function(x, i){
               return (i + 1) + '. <b>' + escaparHtml(x.nombre) + '</b> \u2014 $' + fmtNum(x.c)
                 + ' <span style="color:var(--nbs-muted);font-size:12px">(te dej\u00f3 $' + fmtNum(x.g) + ')</span>';
             }) };
  }

  // ── QUIÉN ME DEJA MÁS GANANCIA ──
  if(r.idea === 'quienDejaMas'){
    var l3 = [];
    LS('ncl', []).forEach(function(c){
      var d = cuentaDeCliente(c.id).dinero;
      if(d.ganancia > 0.005) l3.push({ nombre: nombreCl(c), g: d.ganancia, c: d.comprado });
    });
    l3.sort(function(a, b){ return b.g - a.g; });
    if(!l3.length) return { titulo: '\ud83e\udd14 Todav\u00eda no hay ganancias', lineas: [] };
    return { titulo: '\ud83d\udcb5 Los que m\u00e1s ganancia te dejan',
             lineas: l3.slice(0, 10).map(function(x, i){
               return (i + 1) + '. <b>' + escaparHtml(x.nombre) + '</b> \u2014 $' + fmtNum(x.g)
                 + ' <span style="color:var(--nbs-muted);font-size:12px">de $' + fmtNum(x.c) + '</span>';
             }) };
  }

  // ── LA SEMANA ──
  if(r.idea === 'estaSemana'){
    var hoy = new Date(); hoy.setHours(23,59,59,999);
    var lun = new Date(); lun.setHours(0,0,0,0);
    var dw = lun.getDay(); lun.setDate(lun.getDate() - (dw === 0 ? 6 : dw - 1));
    var vend = 0, gan = 0, cob = 0, cuantas = 0;
    LS('nv', []).forEach(function(v){
      if(v.cancelada) return;
      var f = parsearFechaVenta(v.fecha);
      if(!f || f < lun || f > hoy) return;
      vend += parseFloat(v.total) || 0;
      gan += parseFloat(v.ganancia) || 0;
      cuantas++;
    });
    LS('nv', []).forEach(function(v){
      (v.pagosFactura || []).forEach(function(p){
        if(p.esDevolucion) return;
        var f = parsearFechaVenta(p.fecha || v.fecha);
        if(f && f >= lun && f <= hoy) cob += parseFloat(p.monto) || 0;
      });
    });
    return { titulo: '\ud83d\udcc5 Esta semana',
             lineas: ['Vendiste <b>$' + fmtNum(vend) + '</b> en ' + cuantas + ' factura(s).',
                      'Cobraste <b>$' + fmtNum(cob) + '</b>.',
                      'Te dej\u00f3 <b>$' + fmtNum(gan) + '</b> de ganancia.'] };
  }

  // ── CUÁNTO TENGO DE UN PRODUCTO ──
  if(r.idea === 'cuantoTengoDe'){
    var p = _productoMencionado(q);
    if(!p) return { titulo: '\ud83e\udd14 \u00bfDe cu\u00e1l producto?',
                    lineas: ['Dime el nombre, por ejemplo: <i>"cu\u00e1nto tengo de cool care"</i>'] };
    var st = parseFloat(p.stock) || 0;
    return { titulo: (st <= 0 ? '\ud83d\udd34 ' : '\ud83d\udce6 ') + escaparHtml(p.nombre),
             lineas: ['Te quedan <b>' + st + '</b> unidad(es).',
                      'Se vende a $' + fmtNum(p.precio) + ' y te cuesta $' + fmtNum(p.costo) + '.',
                      st <= 0 ? '\u26a0\ufe0f <b>Se te acab\u00f3.</b>' : ''] .filter(Boolean) };
  }

  // ── EL VALOR DEL INVENTARIO ──
  if(r.idea === 'valorInventario'){
    loadProds();
    var costoT = 0, ventaT = 0, unid = 0, agot = 0;
    productos.forEach(function(p){
      var st = parseFloat(p.stock) || 0;
      if(st <= 0){ agot++; return; }
      unid += st;
      costoT += st * (parseFloat(p.costo) || 0);
      ventaT += st * (parseFloat(p.precio) || 0);
    });
    return { titulo: '\ud83d\udce6 Tu inventario',
             lineas: ['<b>' + unid + '</b> unidades de ' + productos.length + ' productos.',
                      'Te cost\u00f3 <b>$' + fmtNum(costoT) + '</b>.',
                      'Vale <b>$' + fmtNum(ventaT) + '</b> a precio de venta.',
                      'Si lo vendes todo ganar\u00edas <b>$' + fmtNum(ventaT - costoT) + '</b>.',
                      agot ? '\u26a0\ufe0f Tienes <b>' + agot + '</b> producto(s) agotado(s).' : ''].filter(Boolean) };
  }

  // ── CUÁNTO DEBO YO ──
  if(r.idea === 'yoDebo'){
    var deb = 0;
    try { deb = calcularTotalPorPagar(); } catch(e){}
    return { titulo: '\ud83c\udfea Le debes $' + fmtNum(deb),
             lineas: ['Eso es lo que le debes a tus suplidores, tarjetas y otras deudas.'],
             boton: ['\ud83c\udfea Ver Cuentas por Pagar', "cerrarAsistente();ir('p-cxp')"] };
  }

  // ── LA GANANCIA ──
  if(r.idea === 'ganancia'){
    var g = 0, v2 = 0;
    LS('nv', []).forEach(function(v){
      if(v.cancelada) return;
      g += parseFloat(v.ganancia) || 0;
      v2 += parseFloat(v.total) || 0;
    });
    var margen = v2 > 0 ? Math.round(g / v2 * 1000) / 10 : 0;
    return { titulo: '\ud83d\udcb5 Has ganado $' + fmtNum(g),
             lineas: ['De <b>$' + fmtNum(v2) + '</b> vendidos.',
                      'Eso es un margen del <b>' + margen + '%</b>.'] };
  }

  // ── LOS GASTOS ──
  if(r.idea === 'gastos'){
    var gs = LS('ngastos', []);
    var tg = 0;
    gs.forEach(function(x){ tg += parseFloat(x.monto) || 0; });
    return { titulo: '\ud83d\udcb8 Has gastado $' + fmtNum(tg),
             lineas: ['En <b>' + gs.length + '</b> gasto(s) apuntado(s).'],
             boton: ['\ud83d\udcb8 Ver los gastos', "cerrarAsistente();ir('p-gastos')"] };
  }

  // ── QUIÉN SE GANÓ UN PREMIO ──
  if(r.idea === 'vipQuienGano'){
    var pr = [];
    try { pr = premiosPendientes() || []; } catch(e){}
    if(!pr.length) return { titulo: '\u2b50 Nadie tiene premios pendientes',
                            lineas: ['Cuando alguien llegue a 10 productos del mismo tipo, te aviso.'] };
    return { titulo: '\ud83c\udf81 ' + pr.length + ' premio(s) por entregar',
             lineas: pr.slice(0, 10).map(function(x){
               return '\u2b50 <b>' + escaparHtml(x.nombre || '') + '</b> \u2014 ' + escaparHtml(x.detalle || x.texto || '');
             }) };
  }

  // ── LOS PUNTOS DE UN CLIENTE ──
  if(r.idea === 'cuantosPuntos'){
    var cl = _clienteMencionado(q);
    if(!cl) return { titulo: '\ud83e\udd14 \u00bfDe cu\u00e1l cliente?',
                     lineas: ['Dime su nombre, por ejemplo: <i>"cu\u00e1ntos puntos tiene Luis"</i>'] };
    var gr = {};
    try { gr = calcVIP(cl.id) || {}; } catch(e){}
    var ks = Object.keys(gr);
    if(!ks.length) return { titulo: '\u2b50 ' + nombreCl(cl),
                            lineas: ['Todav\u00eda no tiene puntos VIP.'] };
    return { titulo: '\u2b50 Puntos de ' + nombreCl(cl),
             lineas: ks.map(function(k){
               var g2 = gr[k];
               return '<b>' + escaparHtml(k) + '</b> \u2014 ' + g2.puntos + ' de 10'
                 + (g2.gratis ? '  \ud83c\udf81 <b>' + g2.gratis + ' gratis ganado(s)</b>' : '');
             }) };
  }

  // ── A QUIÉN VISITO HOY ──
  if(r.idea === 'aQuienVisito'){
    var dia = '';
    try { dia = getDiaHoy(); } catch(e){}
    var rutas = LS('rutas_por_dia', {});
    var hoyR = (rutas && rutas[dia]) || [];
    if(!hoyR.length) return { titulo: '\ud83d\uddfa\ufe0f No tienes ruta para hoy',
                              lineas: ['Puedes armarla en la pantalla de Rutas.'],
                              boton: ['\ud83d\uddfa\ufe0f Ir a Rutas', "cerrarAsistente();ir('p-rutas')"] };
    return { titulo: '\ud83d\uddfa\ufe0f Hoy te tocan ' + hoyR.length + ' barber\u00eda(s)',
             lineas: hoyR.slice(0, 15).map(function(b, i){ return (i + 1) + '. ' + escaparHtml(b); }),
             boton: ['\ud83d\uddfa\ufe0f Ver la ruta', "cerrarAsistente();ir('p-rutas')"] };
  }

  // ── LA ÚLTIMA COMPRA DE ALGUIEN ──
  if(r.idea === 'ultimaCompra'){
    var cl2 = _clienteMencionado(q);
    if(!cl2) return { titulo: '\ud83e\udd14 \u00bfDe cu\u00e1l cliente?',
                      lineas: ['Dime su nombre, por ejemplo: <i>"cu\u00e1ndo compr\u00f3 Luis"</i>'] };
    var cta = cuentaDeCliente(cl2.id);
    if(!cta.activas.length) return { titulo: '\ud83d\udcc5 ' + nombreCl(cl2),
                                     lineas: ['Nunca te ha comprado.'] };
    var ult = cta.activas.slice().sort(function(a, b){
      var fa = parsearFechaVenta(a.fecha), fb = parsearFechaVenta(b.fecha);
      return (fb ? fb.getTime() : 0) - (fa ? fa.getTime() : 0);
    })[0];
    return { titulo: '\ud83d\udcc5 ' + nombreCl(cl2),
             lineas: ['Su \u00faltima compra fue el <b>' + escaparHtml(ult.fecha) + '</b>.',
                      'Fue de <b>$' + fmtNum(ult.total) + '</b>.',
                      'Te ha comprado <b>$' + fmtNum(cta.dinero.comprado) + '</b> en total.'],
             boton: ['\ud83d\udc64 Ver su cuenta', "cerrarAsistente();verCl(" + _arg(cl2.id) + ")"] };
  }

  // ── LO QUE MÁS VENDO ──
  if(r.idea === 'masVendido' || r.idea === 'menosVendido'){
    var cuenta = {};
    LS('nv', []).forEach(function(v){
      if(v.cancelada) return;
      (v.items || []).forEach(function(it){
        var k = it.nombre || '?';
        if(!cuenta[k]) cuenta[k] = { cant: 0, plata: 0 };
        cuenta[k].cant += parseFloat(it.cant) || 0;
        cuenta[k].plata += (parseFloat(it.cant) || 0) * (parseFloat(it.precio) || 0);
      });
    });
    var arr = Object.keys(cuenta).map(function(k){
      return { n: k, cant: cuenta[k].cant, plata: cuenta[k].plata };
    });
    if(!arr.length) return { titulo: '\ud83e\udd14 Todav\u00eda no hay ventas', lineas: [] };
    var masVend = r.idea === 'masVendido';
    arr.sort(function(a, b){ return masVend ? b.cant - a.cant : a.cant - b.cant; });
    return { titulo: masVend ? '\ud83d\udd25 Lo que m\u00e1s vendes' : '\ud83d\udc0c Lo que menos sale',
             lineas: arr.slice(0, 10).map(function(x, i){
               return (i + 1) + '. <b>' + escaparHtml(x.n) + '</b> \u2014 ' + x.cant + ' unidad(es)'
                 + ' <span style="color:var(--nbs-muted);font-size:12px">($' + fmtNum(x.plata) + ')</span>';
             }) };
  }

  // ── LAS FACTURAS DE UN CLIENTE ──
  if(r.idea === 'facturasCliente'){
    var cl3 = _clienteMencionado(q);
    if(!cl3) return { titulo: '\ud83e\udd14 \u00bfDe cu\u00e1l cliente?', lineas: ['Dime su nombre.'] };
    var ct = cuentaDeCliente(cl3.id);
    return { titulo: '\ud83d\udcc4 Facturas de ' + nombreCl(cl3),
             lineas: ['Tiene <b>' + ct.activas.length + '</b> factura(s) activa(s)'
                      + (ct.canceladas.length ? ' y ' + ct.canceladas.length + ' cancelada(s)' : '') + '.',
                      'Te compr\u00f3 <b>$' + fmtNum(ct.dinero.comprado) + '</b> y debe <b>$' + fmtNum(ct.dinero.debe) + '</b>.'],
             boton: ['\ud83d\udc64 Ver su cuenta', "cerrarAsistente();verCl(" + _arg(cl3.id) + ")"] };
  }

  // ── EL CUADRE ──
  if(r.idea === 'cuadre'){
    var hoyF = fechaHoy();
    var cobHoy = 0;
    LS('nv', []).forEach(function(v){
      (v.pagosFactura || []).forEach(function(p){
        if(!p.esDevolucion && (p.fecha === hoyF)) cobHoy += parseFloat(p.monto) || 0;
      });
    });
    return { titulo: '\ud83e\uddee Hoy cobraste $' + fmtNum(cobHoy),
             lineas: ['Puedes contar tu dinero y compararlo en el Cuadre de Caja.'],
             boton: ['\ud83e\uddee Ir al Cuadre de Caja', "cerrarAsistente();abrirCajaCuadre()"] };
  }

  // ── LOS QUE NO HE VISITADO ──
  if(r.idea === 'noVisitado'){
    var hoy2 = new Date();
    var lista2 = [];
    LS('ncl', []).forEach(function(c){
      var ct2 = cuentaDeCliente(c.id);
      if(!ct2.activas.length) return;
      var ult2 = ct2.activas.slice().sort(function(a, b){
        var fa = parsearFechaVenta(a.fecha), fb = parsearFechaVenta(b.fecha);
        return (fb ? fb.getTime() : 0) - (fa ? fa.getTime() : 0);
      })[0];
      var f2 = parsearFechaVenta(ult2.fecha);
      if(!f2) return;
      var dias = Math.floor((hoy2 - f2) / 86400000);
      if(dias >= 20) lista2.push({ nombre: nombreCl(c), dias: dias, cid: c.id });
    });
    lista2.sort(function(a, b){ return b.dias - a.dias; });
    if(!lista2.length) return { titulo: '\u2705 Est\u00e1s al d\u00eda con todos',
                                lineas: ['Nadie lleva m\u00e1s de 20 d\u00edas sin comprarte.'] };
    return { titulo: '\u23f0 ' + lista2.length + ' cliente(s) llevan tiempo sin comprarte',
             lineas: lista2.slice(0, 12).map(function(x){
               return '<b>' + escaparHtml(x.nombre) + '</b> \u2014 hace ' + x.dias + ' d\u00edas';
             }) };
  }

  // ── CUÁNTO ME DEBE UN CLIENTE ──
  if(r.idea === 'cuantoDebeUno'){
    var clD = _clienteMencionado(q);
    if(!clD) return { titulo: '\ud83e\udd14 \u00bfDe cu\u00e1l cliente?',
                      lineas: ['Dime su nombre, por ejemplo: <i>"cu\u00e1nto me debe Luis"</i>'] };
    var ctD = cuentaDeCliente(clD.id);
    var lin = [];
    if(ctD.dinero.debe <= 0.005){
      lin.push('<b>No te debe nada.</b> Est\u00e1 al d\u00eda. \u2705');
    } else {
      lin.push('Te debe <b>$' + fmtNum(ctD.dinero.debe) + '</b>.');
      var pend = ctD.activas.filter(function(v){ return cobradoYDebeDe(v).debe > 0.005; });
      lin.push('En <b>' + pend.length + '</b> factura(s) sin saldar.');
      if(pend.length){
        var vieja = pend.slice().sort(function(a, b){
          var fa = parsearFechaVenta(a.fecha), fb = parsearFechaVenta(b.fecha);
          return (fa ? fa.getTime() : 0) - (fb ? fb.getTime() : 0);
        })[0];
        var fV = parsearFechaVenta(vieja.fecha);
        var diasV = fV ? Math.floor((new Date() - fV) / 86400000) : null;
        lin.push('La m\u00e1s vieja es del <b>' + escaparHtml(vieja.fecha) + '</b>'
          + (diasV !== null ? ' \u2014 hace <b>' + diasV + ' d\u00edas</b>' : '') + '.');
      }
    }
    if(ctD.dinero.credito > 0.005) lin.push('Y tiene <b>$' + fmtNum(ctD.dinero.credito) + '</b> a favor.');
    lin.push('Te ha comprado <b>$' + fmtNum(ctD.dinero.comprado) + '</b> en total.');
    return { titulo: '\ud83d\udc64 ' + nombreCl(clD), lineas: lin,
             boton: ['\ud83d\udc64 Ver su cuenta', "cerrarAsistente();verCl(" + _arg(clD.id) + ")"] };
  }

  // ── CÓMO ME FUE HOY ──
  if(r.idea === 'comoMeFue'){
    var hoyF2 = fechaHoy();
    var vH = 0, gH = 0, nH = 0, cH = 0;
    LS('nv', []).forEach(function(v){
      if(!v.cancelada && v.fecha === hoyF2){
        vH += parseFloat(v.total) || 0; gH += parseFloat(v.ganancia) || 0; nH++;
      }
      (v.pagosFactura || []).forEach(function(p){
        if(!p.esDevolucion && p.fecha === hoyF2) cH += parseFloat(p.monto) || 0;
      });
    });
    if(!nH && cH <= 0.005) return { titulo: '\ud83d\udcc5 Hoy todav\u00eda no hay nada',
                                    lineas: ['Ni ventas ni cobros apuntados hoy.'] };
    return { titulo: '\ud83d\udcc5 As\u00ed va el d\u00eda',
             lineas: ['Vendiste <b>$' + fmtNum(vH) + '</b> en ' + nH + ' factura(s).',
                      'Cobraste <b>$' + fmtNum(cH) + '</b>.',
                      'Te dej\u00f3 <b>$' + fmtNum(gH) + '</b> de ganancia.'] };
  }

  // ── ESTE MES ──
  if(r.idea === 'esteMes'){
    var ah = new Date();
    var vM = 0, gM = 0, nM = 0, cM = 0;
    LS('nv', []).forEach(function(v){
      var f = parsearFechaVenta(v.fecha);
      if(!v.cancelada && f && f.getMonth() === ah.getMonth() && f.getFullYear() === ah.getFullYear()){
        vM += parseFloat(v.total) || 0; gM += parseFloat(v.ganancia) || 0; nM++;
      }
      (v.pagosFactura || []).forEach(function(p){
        if(p.esDevolucion) return;
        var fp = parsearFechaVenta(p.fecha || v.fecha);
        if(fp && fp.getMonth() === ah.getMonth() && fp.getFullYear() === ah.getFullYear()){
          cM += parseFloat(p.monto) || 0;
        }
      });
    });
    var MESES = ['enero','febrero','marzo','abril','mayo','junio','julio',
                 'agosto','septiembre','octubre','noviembre','diciembre'];
    return { titulo: '\ud83d\udcc6 En ' + MESES[ah.getMonth()],
             lineas: ['Vendiste <b>$' + fmtNum(vM) + '</b> en ' + nM + ' factura(s).',
                      'Cobraste <b>$' + fmtNum(cM) + '</b>.',
                      'Te dej\u00f3 <b>$' + fmtNum(gM) + '</b> de ganancia.'] };
  }

  return null;   // esta idea la contesta el código viejo
}

// 🔑 CUANDO NO ENTIENDE: en vez de la lista fría, ADIVINA lo más parecido
function adivinarLoQueQuiso(texto){
  var q = _limpiar(texto);
  if(!q) return [];
  var palabras = q.split(' ').filter(function(x){ return x.length > 3; });
  var puntos = [];
  var EJEMPLOS = [
    ['\u00bfqui\u00e9nes me deben m\u00e1s?', 'quienes me deben mas dinero deuda clientes'],
    ['\u00bfcu\u00e1nto me deben en total?', 'cuanto me deben total por cobrar calle'],
    ['\u00bfqui\u00e9n me compra m\u00e1s?', 'quien me compra mas mejor cliente'],
    ['\u00bfc\u00f3mo me fue hoy?', 'como me fue hoy vendi dia'],
    ['\u00bfcu\u00e1nto llevo este mes?', 'cuanto llevo este mes vendido mensual'],
    ['\u00bfqu\u00e9 se me est\u00e1 acabando?', 'que se me esta acabando agotado comprar reponer'],
    ['\u00bfcu\u00e1nto vale mi inventario?', 'cuanto vale inventario mercancia van'],
    ['\u00bfcu\u00e1nto le debo a los suplidores?', 'cuanto debo yo suplidores pagar'],
    ['\u00bfqui\u00e9n se gan\u00f3 un premio?', 'quien gano premio vip puntos gratis'],
    ['\u00bfa qui\u00e9n visito hoy?', 'a quien visito hoy ruta toca'],
    ['\u00bfqui\u00e9nes no vienen hace tiempo?', 'quienes no vienen callados perdidos dormidos'],
    ['\u00bfqu\u00e9 es lo que m\u00e1s vendo?', 'que mas vendo producto estrella sale'],
    ['\u00bfcu\u00e1nto me debe Luis?', 'cuanto me debe cliente nombre'],
    ['\u00bfcu\u00e1ntos puntos tiene Luis?', 'cuantos puntos tiene vip cliente'],
    ['\u00bfcu\u00e1nto he ganado?', 'cuanto he ganado ganancia margen'],
    ['prepara un pedido para Luis', 'prepara pedido para cliente']
  ];
  EJEMPLOS.forEach(function(e){
    var p = 0;
    palabras.forEach(function(w){ if(e[1].indexOf(w) >= 0) p++; });
    if(p > 0) puntos.push({ texto: e[0], p: p });
  });
  puntos.sort(function(a, b){ return b.p - a.p; });
  return puntos.slice(0, 4).map(function(x){ return x.texto; });
}

function nombreGrande(cl){
  if(!cl) return '';
  try {
    var n = nombreCl(cl);
    return n || '';
  } catch(e){ return String(cl.nombre || ''); }
}

function esAndroid(){
  try { return /android/i.test(navigator.userAgent || ''); } catch(e){ return false; }
}

// Que WhatsApp usar. Se guarda una vez y vale para toda la app. -11 ago-
function cambiarWhatsAppApp(){
  var actual = LS('nbs_whatsapp_app', WA_NEGOCIO);
  var esNegocio = (actual === WA_NEGOCIO);
  var msg = 'Ahora mismo los botones de WhatsApp abren:\n\n'
    + (esNegocio ? '\ud83d\udcbc WhatsApp BUSINESS (el de negocio)' : '\ud83d\udcac WhatsApp normal')
    + '\n\n\u00bfCambiarlo a ' + (esNegocio ? 'WhatsApp normal' : 'WhatsApp BUSINESS') + '?';
  if(!confirm(msg)) return;
  var nuevo = esNegocio ? 'com.whatsapp' : WA_NEGOCIO;
  SS('nbs_whatsapp_app', nuevo);
  avisoGrande('\u2705 Los botones de WhatsApp van a abrir '
    + (nuevo === WA_NEGOCIO ? 'WhatsApp BUSINESS' : 'WhatsApp normal') + '.'
    + (esAndroid() ? '' : '\n\n\u26a0\ufe0f En este aparato no es Android, as\u00ed que abre el que tengas puesto por defecto.'));
  try { if(window._clientePerfilActual != null) pintarPanelCliente(window._clientePerfilActual); } catch(e){}
}

function _linkWhatsApp(telLimpio, texto){
  var num = String(telLimpio || '').replace(/[^0-9]/g, '');
  if(!num) return '#';
  if(num.length === 10) num = '1' + num;          // numeros de aqui, sin el 1
  // \ud83d\udcac EL TEXTO -30 ago-. Antes esta funcion solo abria el chat; los comprobantes
  // nuevos mandan mensaje, asi que ahora tambien lleva el texto por el camino bueno.
  var t = String(texto || '');
  var normal = 'https://wa.me/' + num + (t ? '?text=' + encodeURIComponent(t) : '');
  if(!esAndroid()) return normal;
  // Preferir el WhatsApp que el escogio; si no esta, cae al normal solo.
  var cual = LS('nbs_whatsapp_app', WA_NEGOCIO);
  if(!cual) return normal;

  // \ud83d\udd34 EL TEXTO, UNA SOLA VEZ -3 sep-. Antes viajaba TRES veces en el mismo enlace
  // -en &text=, en ;S.text= y otra vez dentro del respaldo-: un mensaje de 149 letras
  // hacia un enlace de 878 caracteres. Android tiene un limite y el enlace quedaba en
  // el filo, asi que unas veces abria y otras daba error. Eso era el fallo intermitente
  // que Sensei reportaba: "a veces me da error y tengo que darle para atras".
  // El respaldo va SIN texto: si el WhatsApp escogido no esta, abre el chat, y el
  // mensaje ya esta copiado en el portapapeles.
  return 'intent://send?phone=' + num
    + (t ? '&text=' + encodeURIComponent(t) : '')
    + '#Intent;scheme=whatsapp;package=' + cual
    + ';S.browser_fallback_url=' + encodeURIComponent('https://wa.me/' + num) + ';end';
}

function _arg(v){
  // 🔑 Las comillas DOBLES hay que escaparlas también: estos textos van dentro de
  // onclick="...", así que una comilla doble cierra el atributo y rompe el botón.
  // Le pasó con "Eric Young "ERIC"" y ningún cliente con apodo funcionaba. -17 ago-
  return "'" + String(v)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '&quot;')
    .replace(/\n/g, ' ')
    .replace(/\r/g, '') + "'";
}

function _sub(inner){
  return '<div style="background:#fff;border-radius:9px;padding:10px;margin-bottom:6px">' + inner + '</div>';
}

// ═══ EL PANEL COMPLETO ═══

// ═══════════════════════════════════════════════════════════════════
//  🏦 LOS RENGLONES NUEVOS DE LA CUENTA
//  Todo sale de cuentaDeCliente(cid) — una sola verdad.
// ═══════════════════════════════════════════════════════════════════

// ── 🚫 SUS FACTURAS CANCELADAS — antes ni se veían ──
function _renglonCanceladas(K){
  if(!K.canceladas.length) return '';
  var monto = K.canceladas.reduce(function(a, v){ return a + (parseFloat(v.total) || 0); }, 0);
  var cont = _sub(
    '<div style="font-size:11px;color:var(--nbs-muted);margin-bottom:8px;line-height:1.5">'
    + 'Estas facturas est\u00e1n ANULADAS: no cuentan en lo que compr\u00f3 ni en lo que debe. '
    + 'Se guardan para que quede el rastro.</div>'
    + K.canceladas.slice(0, 20).map(function(v){
        return '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;'
          + 'padding:8px 0;border-bottom:1px solid #F4F4F8;opacity:.75">'
          + '<div style="flex:1;min-width:0">'
          +   '<div style="font-size:12.5px;font-weight:700;color:var(--nbs-ink);text-decoration:line-through">'
          +     escaparHtml(String(v.fecha || '')) + ' \u00b7 #' + escaparHtml(String(v.numFactura || String(v.id).slice(-4))) + '</div>'
          +   '<div style="font-size:10.5px;color:var(--nbs-muted)">'
          +     ((v.items || []).length) + ' producto(s)</div>'
          + '</div>'
          + '<div style="font-size:13px;font-weight:800;color:var(--nbs-muted);text-decoration:line-through">$'
          +   fmtNum(parseFloat(v.total) || 0) + '</div>'
          + '<button onclick="event.stopPropagation();verFacturaProfesional(' + _arg(v.id) + ')" '
          +   'style="background:#EEE;border:1px solid #DDD;border-radius:7px;padding:6px 9px;'
          +   'font-size:12px;cursor:pointer;flex-shrink:0">\ud83d\udc41\ufe0f</button>'
          + '</div>';
      }).join('')
  );
  return _filaPanel('canceladas', '\ud83d\udeab', 'Facturas canceladas',
    String(K.canceladas.length) + ' \u00b7 $' + fmtNum(monto), null, cont);
}

// ── ⚡ SUS PEDIDOS PENDIENTES ──
function _renglonCredito(K){
  var c = K.dinero.credito;
  // \ud83d\udd11 \u00bfHay d\u00f3nde aplicarlo? Solo se ofrece si de verdad debe algo. -6 sep-
  var _debe = 0;
  try { _debe = balanceDelCliente(K.cliente.id); } catch(e){}
  var _seUsan = Math.min(c, _debe);
  var _sobra = Math.round((c - _seUsan) * 100) / 100;

  var cont = _sub(
    '<div style="font-size:11.5px;color:var(--nbs-muted);line-height:1.6;margin-bottom:9px">'
    + (c > 0.005
        ? 'Este cliente tiene <b>$' + fmtNum(c) + '</b> a su favor.'
        : 'Este cliente no tiene cr\u00e9dito a favor. Le queda a favor cuando te paga de m\u00e1s o cuando devuelve algo que ya hab\u00eda pagado.')
    + '</div>'
    // \ud83d\udcb3 EL BOT\u00d3N DE APLICARLO, aqu\u00ed mismo -6 sep-. Antes solo estaba en Cuentas
    // por Cobrar: el rengl\u00f3n llevaba hasta aqu\u00ed y no dejaba hacer nada.
    + (_seUsan > 0.005
        ? '<div style="background:#FFF8E1;border:1.5px solid #FFD54F;border-radius:10px;padding:11px;margin-bottom:9px">'
          + '<div style="font-size:12px;color:#6D4C00;line-height:1.5;margin-bottom:8px">'
          +   'Se van a usar <b>$' + fmtNum(_seUsan) + '</b> para bajarle la deuda de <b>$'
          +   fmtNum(_debe) + '</b>.'
          +   (_sobra > 0.005 ? '<br>Le quedar\u00e1n <b>$' + fmtNum(_sobra) + '</b> a favor.' : '')
          + '</div>'
          + '<div style="font-size:10.5px;color:#6D4C00;font-weight:700;margin-bottom:3px">'
          +   '\ud83d\udcc5 \u00bfQU\u00c9 D\u00cdA SE LO APLICAS?</div>'
          + '<input type="date" id="cred-fecha" '
          +   'style="width:100%;padding:9px;border:1px solid #E0C070;border-radius:8px;'
          +   'font-size:13px;margin-bottom:9px">'
          + '<button onclick="event.stopPropagation();usarCreditoAFavor(' + _arg(K.cliente.id) + ')" '
          +   'style="width:100%;padding:13px;background:#E65100;color:#fff;border:none;'
          +   'border-radius:10px;font-size:14.5px;font-weight:800;cursor:pointer">'
          +   '\ud83d\udcb3 Usar $' + fmtNum(_seUsan) + ' de su cr\u00e9dito</button>'
          + '</div>'
        : (c > 0.005
            ? '<div style="background:#F4F6FB;border-radius:9px;padding:10px;margin-bottom:9px;'
              + 'font-size:11.5px;color:var(--nbs-muted);line-height:1.5">'
              + 'No debe nada, as\u00ed que no hay d\u00f3nde aplicarlo. Se le descontar\u00e1 solo en su '
              + 'pr\u00f3xima compra.</div>'
            : ''))
    + '<button onclick="event.stopPropagation();cambiarCreditoAFavor(' + _arg(K.cliente.id) + ')" '
    +   'style="width:100%;padding:10px;background:#fff;border:1.5px solid var(--nbs-gold);'
    +   'color:var(--nbs-gold-dark);border-radius:9px;font-size:12.5px;font-weight:800;cursor:pointer">'
    +   '\u270f\ufe0f Corregir el cr\u00e9dito a favor</button>'
  );
  return _filaPanel('credito', '\ud83d\udcb0', 'Cr\u00e9dito a favor',
    '$' + fmtNum(c), c > 0.005 ? 'var(--nbs-gold-dark)' : null, cont,
    'cambiarCreditoAFavor(' + _arg(K.cliente.id) + ')');
}

function cambiarCreditoAFavor(cid){
  clientes = LS('ncl', []);
  var i = clientes.findIndex(function(c){ return String(c.id) === String(cid); });
  if(i < 0) return;
  var actual = parseFloat(clientes[i].creditoAFavor || 0) || 0;
  var txt = prompt('Cr\u00e9dito a favor de ' + nombreCl(clientes[i]) + '\n\n'
    + 'Ahora tiene: $' + fmtNum(actual) + '\n\n'
    + 'Escribe el monto correcto (0 para quitarlo):', String(actual));
  if(txt === null) return;
  var nuevo = parseFloat(String(txt).replace(/[^0-9.\-]/g, ''));
  if(isNaN(nuevo) || nuevo < 0){ alert('Escribe un n\u00famero de cero para arriba.'); return; }
  nuevo = Math.round(nuevo * 100) / 100;
  if(Math.abs(nuevo - actual) < 0.005) return;
  if(!confirm('\u00bfDejar el cr\u00e9dito a favor en $' + fmtNum(nuevo) + '?\n\n'
      + 'Antes ten\u00eda $' + fmtNum(actual) + '.')) return;
  clientes[i].creditoAFavor = nuevo;
  SS('ncl', clientes);
  try { repintarCuentaCliente(cid); } catch(e){}
  try { avisoChico('\ud83d\udcb0 Cr\u00e9dito a favor: $' + fmtNum(nuevo)); } catch(e){}
}

// ── 📝 NOTAS DEL CLIENTE ──
function _renglonNotas(K){
  var nota = String(K.cliente.nota || '');
  var cont = _sub(
    (nota
      ? '<div style="font-size:12.5px;color:var(--nbs-ink);line-height:1.6;white-space:pre-wrap;'
        + 'background:#FFFDE7;padding:10px;border-radius:8px;margin-bottom:9px">'
        + escaparHtml(nota) + '</div>'
      : '<div style="font-size:11.5px;color:var(--nbs-muted);margin-bottom:9px">'
        + 'Aqu\u00ed puedes apuntar lo que necesites de este cliente: c\u00f3mo le gusta que le lleves las cosas, '
        + 'qui\u00e9n recibe, a qu\u00e9 hora abre, lo que sea.</div>')
    + '<button onclick="event.stopPropagation();editarNotaCliente(' + _arg(K.cliente.id) + ')" '
    +   'style="width:100%;padding:10px;background:#fff;border:1.5px solid var(--nbs-ink);'
    +   'color:var(--nbs-ink);border-radius:9px;font-size:12.5px;font-weight:800;cursor:pointer">'
    +   '\u270f\ufe0f ' + (nota ? 'Cambiar la nota' : 'Escribir una nota') + '</button>'
  );
  return _filaPanel('notas', '\ud83d\udcdd', 'Notas',
    nota ? String(nota).slice(0, 22) + (nota.length > 22 ? '\u2026' : '') : 'ninguna', null, cont,
    'editarNotaCliente(' + _arg(K.cliente.id) + ')');
}

function _renglonIntervalo(K){
  var puesto = parseInt(K.cliente.intervaloVisitaDias || 0, 10) || 0;
  var real = K.ritmo.cadaCuanto;
  var cont = _sub(
    '<div style="font-size:12.5px;color:var(--nbs-ink);line-height:1.8">'
    + (real !== null
        ? 'Te compra <b>cada ' + real + ' d\u00edas</b> en promedio.<br>'
        : 'Todav\u00eda no hay compras suficientes para saber su ritmo.<br>')
    + (K.ritmo.diasDesde !== null
        ? 'La \u00faltima vez fue hace <b>' + K.ritmo.diasDesde + ' d\u00edas</b>.<br>' : '')
    + (puesto ? 'T\u00fa lo tienes puesto para visitarlo <b>cada ' + puesto + ' d\u00edas</b>.'
              : 'No le has puesto cada cu\u00e1nto visitarlo.')
    + '</div>'
    + '<button onclick="event.stopPropagation();cambiarIntervaloVisita(' + _arg(K.cliente.id) + ')" '
    +   'style="width:100%;margin-top:9px;padding:10px;background:#fff;border:1.5px solid #1a237e;'
    +   'color:#1a237e;border-radius:9px;font-size:12.5px;font-weight:800;cursor:pointer">'
    +   '\u270f\ufe0f Cambiar cada cu\u00e1nto visitarlo</button>'
  );
  return _filaPanel('ritmo', '\ud83d\udcc5', 'Cada cu\u00e1nto compra',
    (real !== null ? real + ' d\u00edas' : 'sin datos'), null, cont,
    'cambiarIntervaloVisita(' + _arg(K.cliente.id) + ')');
}

function _renglonAjustesCuenta(K){
  var sinServ = !!K.cliente.sinServicio;
  var cont = _sub(
    '<button onclick="event.stopPropagation();editarCl(' + _arg(K.cliente.id) + ')" '
    +   'style="width:100%;padding:12px;background:var(--nbs-ink);color:#fff;border:none;'
    +   'border-radius:9px;font-size:13px;font-weight:800;cursor:pointer;margin-bottom:8px">'
    +   '\u270f\ufe0f Editar todos sus datos</button>'
    + '<div style="font-size:10.5px;color:var(--nbs-muted);margin-bottom:12px;line-height:1.5">'
    +   'Nombre, apodo, barber\u00eda, tel\u00e9fono, direcci\u00f3n, la persona que atiende, la foto.</div>'

    + '<button onclick="event.stopPropagation();cambiarSinServicioDesdeCuenta(' + _arg(K.cliente.id) + ')" '
    +   'style="width:100%;padding:11px;background:#fff;border:1.5px solid '
    +   (sinServ ? 'var(--nbs-green-text);color:var(--nbs-green-text)' : '#F9A825;color:#F57F17')
    +   ';border-radius:9px;font-size:12.5px;font-weight:800;cursor:pointer;margin-bottom:8px">'
    +   (sinServ ? '\u2705 Volver a darle servicio' : '\u23f8\ufe0f Marcarlo SIN SERVICIO') + '</button>'
    + '<div style="font-size:10.5px;color:var(--nbs-muted);margin-bottom:12px;line-height:1.5">'
    +   (sinServ
        ? 'Ahora mismo NO te sale en pedidos ni en la ruta. Sus facturas y su deuda siguen ah\u00ed.'
        : 'Si lo marcas, deja de salirte en pedidos y en la ruta, pero NO se borra nada: '
          + 'sus facturas y lo que te debe se quedan igual.') + '</div>'

    + '<button onclick="event.stopPropagation();eliminarCl(' + _arg(K.cliente.id) + ')" '
    +   'style="width:100%;padding:11px;background:#fff;border:1.5px solid #C62828;color:#C62828;'
    +   'border-radius:9px;font-size:12.5px;font-weight:800;cursor:pointer">'
    +   '\ud83d\uddd1\ufe0f Borrar este cliente</button>'
    + '<div style="font-size:10.5px;color:var(--nbs-muted);margin-top:6px;line-height:1.5">'
    +   (K.activas.length
        ? '\u26a0\ufe0f Tiene ' + K.activas.length + ' factura(s). Piensa bien antes de borrarlo \u2014 '
          + 'si solo quieres que deje de salirte, m\u00e1rcalo sin servicio.'
        : 'No tiene facturas, se puede borrar sin problema.') + '</div>'
  );
  return _filaPanel('ajustescta', '\u2699\ufe0f', 'Ajustes de su cuenta',
    sinServ ? 'sin servicio' : '', sinServ ? 'var(--nbs-gold-dark)' : null, cont,
    'editarCl(' + _arg(K.cliente.id) + ')');
}

function cambiarSinServicioDesdeCuenta(cid){
  clientes = LS('ncl', []);
  var i = clientes.findIndex(function(c){ return String(c.id) === String(cid); });
  if(i < 0) return;
  var ahora = !!clientes[i].sinServicio;
  var msg = ahora
    ? '\u00bfVolver a darle servicio a ' + nombreCl(clientes[i]) + '?\n\nVa a volver a salirte en pedidos y en la ruta.'
    : '\u00bfMarcar a ' + nombreCl(clientes[i]) + ' SIN SERVICIO?\n\n'
      + 'Deja de salirte en pedidos y en la ruta.\n\u26a0\ufe0f NO se borra nada: sus facturas y su deuda se quedan.';
  if(!confirm(msg)) return;
  clientes[i].sinServicio = !ahora;
  SS('ncl', clientes);
  try { repintarCuentaCliente(cid); } catch(e){}
  try { avisoChico(clientes[i].sinServicio ? '\u23f8\ufe0f Sin servicio' : '\u2705 Con servicio'); } catch(e){}
}


// ── ✏️🗑️ CORREGIR UN PAGO DESDE LA CUENTA DEL CLIENTE  (15 ago 2026)
//
// 🔑 SENSEI: "cuando entro a la sección de pagos del cliente NO ME DEJA EDITAR
// los pagos, ¿no arreglaste eso, por qué?". Tenía razón: ese renglón se quedó
// de solo mirar. Ahora cada pago tiene su ✏️ y su 🗑️, y al terminar vuelve
// a la cuenta del cliente, no a otra pantalla.
function editarPagoDesdeCuenta(vid, pidx, cid){
  window._pagoVuelveACuenta = cid;
  window._pagoVuelveAFactura = null;
  try { abrirEditorPago(vid, pidx); }
  catch(e){ alert('No se pudo abrir el pago.'); }
}

function borrarPagoDesdeCuenta(vid, pidx, cid){
  ventas = LS('nv', []);
  var v = ventas.find(function(x){ return String(x.id) === String(vid); });
  if(!v || !v.pagosFactura || v.pagosFactura[pidx] === undefined){
    alert('No se encontr\u00f3 el pago.'); return;
  }
  var p = v.pagosFactura[pidx];
  if(!confirm('\u00bfBorrar este pago de $' + fmtNum(parseFloat(p.monto) || 0) + '?\n\n'
      + 'Factura ' + (v.numFactura || String(v.id).slice(-4)) + ' del ' + (v.fecha || '') + '\n\n'
      + 'La deuda de este cliente va a SUBIR ese mismo monto.\nEsto no se puede deshacer.')) return;
  v.pagosFactura.splice(pidx, 1);
  SS('nv', ventas);
  try { repintarCuentaCliente(cid); } catch(e){}
  try { renderCxC(''); } catch(e){}
  try { avisoChico('\ud83d\uddd1\ufe0f Pago borrado'); } catch(e){}
}


// 🔄 REPINTAR LA CUENTA ENTERA, cabecera incluida  (15 ago 2026)
//
// 🔴 `pintarPanelCliente` solo repinta la LISTA de renglones — el COMPRÓ / DEBE /
// TE DEJA de la cabecera lo pinta `verCl`. Así que al corregir un pago, la lista
// se actualizaba pero el DEBE de arriba se quedaba con el número viejo.
// Lo destapó una mutación. Ahora todo lo que toca dinero llama aquí.
function primerNombreDe(cl){
  if(!cl) return '';
  var n = String(cl.nombre || '').trim().split(/\s+/)[0] || '';
  return n ? (n.charAt(0).toUpperCase() + n.slice(1).toLowerCase()) : '';
}

function mandarPuntosPorWhatsApp(cid){
  var r = armarMensajeVIP(cid);
  if(!r){
    avisoGrande('Este cliente todav\u00eda no tiene puntos que mandarle.');
    return;
  }
  var tel = String(r.cliente.tel || r.cliente.telefono || '').replace(/[^0-9]/g, '');
  if(tel.length === 10) tel = '1' + tel;
  if(!tel){
    alert('Este cliente no tiene tel\u00e9fono guardado.\n\n'
      + 'P\u00f3nselo en Sus datos y vuelve a intentarlo.');
    return;
  }
  // Por el camino bueno: abre el WhatsApp BUSINESS en Android. -30 ago-
  var url = _linkWhatsApp(tel, r.texto);
  try { window.open(url, '_blank'); }
  catch(e){ location.href = url; }
}

// Verlo antes de mandarlo
function verFactura(v){
  var el=document.getElementById('cl-factura-contenido');el.innerHTML='';
  var pagado=v.pagosFactura?(v.pagosFactura || []).filter(function(p){return p.monto!==undefined&&typeof p.monto==='number';}).reduce(function(s,p){return s+p.monto;},0):0;
  pagado = cobradoYDebeDe(v).cobrado;
  var saldo = cobradoYDebeDe(v).debe;

  var card=document.createElement('div');card.className='card';
  card.innerHTML='<div style="font-size:18px;font-weight:700;margin-bottom:4px">Factura</div>'
    +'<div style="font-size:13px;color:#aaa;margin-bottom:14px">'+v.fecha+' a las '+v.hora+'</div>'
    +'<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f0f0f0">'
    +'<span style="color:#777">Cliente</span><span style="font-weight:600">'+nombreVentaClienteConNegocio(v)+'</span></div>'
    +'<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f0f0f0">'
    +'<span style="color:#777">Tipo de pago</span><span style="font-size:16px;padding:4px 11px;border-radius:10px;font-weight:600;'+(v.tipo==='credito'?'background:#FFF8E1;color:#E65100':'background:#E8F5E9;color:#2E7D32')+'">'+(v.tipo==='credito'?'a credito':v.tipo)+'</span></div>'
    +'<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f0f0f0">'
    +'<span style="color:#777">Total factura</span><span style="font-weight:700;font-size:18px;color:#1565C0">$'+fmtNum(v.total)+'</span></div>';

  if(v.tipo==='credito'){
    card.innerHTML+='<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f0f0f0">'
      +'<span style="color:#777">Total pagado</span><span style="font-weight:700;color:#2E7D32">$'+fmtNum(pagado)+'</span></div>'
      +'<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f0f0f0">'
      +'<span style="color:#777">Balance pendiente</span><span style="font-weight:700;color:'+(esSaldoPendiente(saldo)?'#C62828':'#2E7D32')+'">$'+fmtNum(saldo)+'</span></div>';
  }
  el.appendChild(card);

  // Products
  var prodCard=document.createElement('div');prodCard.className='card';
  prodCard.innerHTML='<div style="font-size:13px;font-weight:700;color:#1a237e;margin-bottom:10px">PRODUCTOS</div>';
  (v.items || []).forEach(function(it){
    var row=document.createElement('div');
    row.style.cssText='display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f0f0f0;font-size:13px';
    row.innerHTML='<div><div style="font-weight:600">'+escaparHtml(it.nombre)+'</div>'
      +'<div style="color:#aaa;font-size:11px">x'+it.cant+' @ $'+fmtNum(it.precio)+'</div></div>'
      +'<span style="font-weight:700;color:#1565C0">$'+fmtNum((it.cant*it.precio))+'</span>';
    prodCard.appendChild(row);
  });
  el.appendChild(prodCard);

  // Payment history
  if(v.pagosFactura&&(v.pagosFactura || []).length){
    var pagCard=document.createElement('div');pagCard.className='card';
    pagCard.innerHTML='<div style="font-size:13px;font-weight:700;color:#1a237e;margin-bottom:10px">PAGOS APLICADOS</div>';
    (v.pagosFactura || []).filter(function(p){ return p.monto !== undefined && typeof p.monto === 'number'; }).forEach(function(p){
      var row=document.createElement('div');
      row.style.cssText='display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f0f0f0;font-size:13px';
      row.innerHTML='<span style="color:#777">'+p.fecha+(p.nota?' · '+p.nota:'')+'</span>'
        +'<span style="font-weight:700;color:#2E7D32">+$'+fmtNum(p.monto)+'</span>';
      pagCard.appendChild(row);
    });
    el.appendChild(pagCard);
  }

  if(v.tipo==='credito' && esSaldoPendiente(saldo)){
    var payCard=document.createElement('div');payCard.className='card';
    payCard.innerHTML='<div style="font-size:13px;font-weight:700;color:#1a237e;margin-bottom:8px">APLICAR PAGO A ESTA FACTURA</div>'
      +'<div style="font-size:12px;color:#aaa;margin-bottom:8px">Saldo pendiente: $'+fmtNum(saldo)+'</div>'
      +'<div style="display:flex;gap:8px;align-items:center">'
      +'<input type="text" inputmode="numeric" placeholder="0.00" id="pagofactura-'+v.id+'" value="0.00" style="flex:1;padding:6px 10px;font-size:13px;border:1px solid #ddd;border-radius:6px;outline:none;font-family:sans-serif" onfocus="this.select()" oninput="formatoMoneda(this)">'
      +'<button id="btnpagofactura-'+v.id+'" style="padding:10px 14px;background:#1565C0;color:white;border:none;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600">✓ Pagar</button>'
      +'</div>';
    el.appendChild(payCard);
    // Botón de cobro rápido: pagar TODO el saldo en efectivo de un toque (sin escribir monto)
    (function(vid, saldoFac){
      var btnRapido = document.createElement('button');
      btnRapido.textContent = '💵 Pagar todo en efectivo ($'+fmtNum(saldoFac)+')';
      btnRapido.style.cssText = 'width:100%;padding:13px;background:#00838F;color:white;border:none;border-radius:8px;font-size:15px;font-weight:800;cursor:pointer;margin-top:10px';
      btnRapido.onclick = function(){
        if(!confirm('¿Registrar el pago COMPLETO de $'+fmtNum(saldoFac)+' en efectivo?')) return;
        ventas = LS('nv', []);
        var vr = ventas.find(function(x){ return String(x.id) === String(vid); });
        if(!vr) return;
        if(!vr.pagosFactura) vr.pagosFactura = [];
        vr.pagosFactura.push({ pid: nuevoPagoId(), monto: saldoFac, fecha: fechaHoy(), metodos:[{tipo:'efectivo', monto:saldoFac}] });
        SS('nv', ventas);
        alert('✅ Pago de $'+fmtNum(saldoFac)+' en efectivo aplicado correctamente.');
        verFactura(vr);
      };
      payCard.appendChild(btnRapido);
    })(v.id, saldo);
    document.getElementById('btnpagofactura-'+v.id).onclick = function(){
      var inp = document.getElementById('pagofactura-'+v.id);
      var monto = dinero(inp.value) || 0;
      if(monto <= 0){ alert('Ingresa un monto valido'); return; }
      if(monto > saldo){ if(!confirm('El monto es mayor al saldo. ¿Continuar?')) return; monto = saldo; }
      ventas = LS('nv', []);
      var ventaReal = ventas.find(function(x){ return String(x.id) === String(v.id); });
      if(!ventaReal) return;
      if(!ventaReal.pagosFactura) ventaReal.pagosFactura = [];
      ventaReal.pagosFactura.push({ pid: nuevoPagoId(), monto: monto, fecha: fechaHoy() });
      SS('nv', ventas);
      alert('Pago de $'+fmtNum(monto)+' aplicado correctamente');
      verFactura(ventaReal);
    };
  }

  // Botones de administrador
  if(!v.cancelada){
    var adminCard = document.createElement('div');
    adminCard.className = 'card';
    adminCard.style.cssText = 'border-left:4px solid #B71C1C';
    adminCard.innerHTML = '<div style="font-size:12px;font-weight:700;color:#B71C1C;margin-bottom:10px">🔒 ZONA DE ADMINISTRADOR</div>'
      +'<div style="display:flex;gap:8px">'
      +'<button id="btn-cancel-fac" style="flex:1;padding:12px;background:#B71C1C;color:white;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600">🚫 Cancelar factura</button>'
      +'<button id="btn-edit-fac" style="flex:1;padding:12px;background:#E65100;color:white;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600">✏️ Modificar</button>'
      +'</div>';
    el.appendChild(adminCard);
    document.getElementById('btn-cancel-fac').onclick = function(){ cancelarFactura(v); };
    document.getElementById('btn-edit-fac').onclick = function(){ modificarFactura(v); };
  } else {
    var cancelCard = document.createElement('div');
    cancelCard.className = 'card';
    cancelCard.style.cssText = 'background:#FFEBEE;border-left:4px solid #B71C1C';
    cancelCard.innerHTML = '<div style="color:#B71C1C;font-weight:700;font-size:14px">🚫 FACTURA CANCELADA</div>'
      +'<div style="font-size:12px;color:#aaa;margin-top:4px">Cancelada el '+v.fechaCancelacion+' · Stock restaurado</div>';
    el.appendChild(cancelCard);
  }

  // Mostrar la firma del cliente si la factura tiene una
  if(v.firma){
    var firmaCard = document.createElement('div');
    firmaCard.className = 'card';
    firmaCard.style.cssText = 'text-align:center;padding:12px';
    firmaCard.innerHTML = '<div style="font-size:12px;color:#888;font-weight:700;margin-bottom:8px">✍️ FIRMA DEL CLIENTE</div>'
      +'<img src="'+v.firma+'" style="max-width:100%;max-height:220px;border:1px solid #eee;border-radius:8px;background:white;image-rendering:auto">';
    el.appendChild(firmaCard);
  }

  var all=['menu','p-cl','p-v','p-cxc','p-rpt','p-cl-perfil','p-cl-factura'];
  all.forEach(function(x){document.getElementById(x).style.display='none';});
  document.getElementById('p-cl-factura').style.display='block';
  document.getElementById('btn-print-factura').onclick=function(){imprimirFactura(v);};
  document.getElementById('btn-email-factura').onclick=function(){emailFactura(v);};
}

// El PIN se guarda en el teléfono. Si nunca se cambió, usa 8899 por defecto (el usuario
// debería cambiarlo por el suyo desde "Cambiar PIN" para mayor seguridad).
var PIN_ADMIN = localStorage.getItem('nbs_pin_admin') || '8899';

// ═══ LIMITE DE INTENTOS DEL PIN (agregado 24 jul, pedido por Sensei) ═══
// Antes se podia probar el PIN las veces que fueran, sin limite. Ahora, despues
// de 5 fallos seguidos, se bloquea 5 minutos. El contador se guarda en el
// telefono y se resetea solo con un PIN correcto.
var CLAVE_PIN_INTENTOS = 'nbs_pin_intentos';
var PIN_MAX_INTENTOS = 5;
var PIN_MINUTOS_BLOQUEO = 5;

function verificarPinConLimite(pinIngresado){
  var estado = LS(CLAVE_PIN_INTENTOS, {fallos:0, bloqueadoHasta:0});
  var ahora = Date.now();
  if(estado.bloqueadoHasta && ahora < estado.bloqueadoHasta){
    var minRestantes = Math.ceil((estado.bloqueadoHasta - ahora) / 60000);
    alert('🔒 Demasiados intentos fallidos.\n\nEspera '+minRestantes+' minuto(s) antes de volver a intentar.');
    return false;
  }
  if(String(pinIngresado||'').trim() === String(PIN_ADMIN).trim()){
    SS(CLAVE_PIN_INTENTOS, {fallos:0, bloqueadoHasta:0});
    return true;
  }
  estado.fallos = (estado.fallos||0) + 1;
  if(estado.fallos >= PIN_MAX_INTENTOS){
    SS(CLAVE_PIN_INTENTOS, {fallos:0, bloqueadoHasta: ahora + PIN_MINUTOS_BLOQUEO*60000});
    alert('🔒 PIN incorrecto '+PIN_MAX_INTENTOS+' veces seguidas.\n\nPor tu seguridad, espera '+PIN_MINUTOS_BLOQUEO+' minutos antes de volver a intentar.');
  } else {
    SS(CLAVE_PIN_INTENTOS, estado);
    alert('PIN incorrecto. Te quedan '+(PIN_MAX_INTENTOS - estado.fallos)+' intento(s).');
  }
  return false;
}
var PIN_ACTIVO = false;

// 🔑 VER MI PIN. Sensei lo olvidó y no podía abrir su backup. Va protegido con la
// huella: solo entra quien pueda poner el dedo en este teléfono. -15 sep-
function verMiPin(){
  cerrarMenuLateral();
  function enseniarlo(){
    var p = localStorage.getItem('nbs_pin_admin') || '8899';
    avisoGrande('\ud83d\udd11 TU PIN DE ADMINISTRADOR\n\n' + p + '\n\n'
      + 'Es el mismo que abre tus backups.\n'
      + 'Ap\u00fantalo en un sitio seguro.');
  }
  if(typeof protegerConHuella === 'function'){
    protegerConHuella(enseniarlo, 'Ver tu PIN de administrador');
  } else {
    enseniarlo();
  }
}

// Permite al usuario poner su PROPIO PIN secreto (queda guardado solo en su teléfono).
function cambiarPinAdmin(){
  var actual = prompt('Para cambiar el PIN, primero escribe el PIN ACTUAL:');
  if(actual === null) return;
  if(!verificarPinConLimite(actual)) return;
  var nuevo = prompt('Escribe tu NUEVO PIN (solo números, de 4 a 8 dígitos):');
  if(nuevo === null) return;
  nuevo = String(nuevo).trim();
  if(!/^[0-9]{4,8}$/.test(nuevo)){ alert('El PIN debe tener entre 4 y 8 números.'); return; }
  var confirmar = prompt('Escribe otra vez tu nuevo PIN para confirmar:');
  if(confirmar === null) return;
  if(String(confirmar).trim() !== nuevo){ alert('Los PIN no coinciden. Intenta de nuevo.'); return; }
  PIN_ADMIN = nuevo;
  localStorage.setItem('nbs_pin_admin', nuevo);
  alert('✅ PIN cambiado. Guárdalo bien: es el único que funcionará ahora.');
}

function togglePin(){
  var pin = prompt('Ingresa PIN para cambiar seguridad:');
  if(pin === null) return;
  if(!verificarPinConLimite(pin)) return;
  PIN_ACTIVO = !PIN_ACTIVO;
  // Hay DOS interruptores de PIN: uno en el menu lateral y otro en la pantalla del menu.
  // Antes los dos tenian el MISMO nombre, el navegador solo encontraba el primero, y el
  // segundo se quedaba diciendo "Desactivado" aunque el PIN SI estuviera activo.
  var pares = [
    ['pin-switch','pin-knob','pin-status-txt'],
    ['pin-switch-2','pin-knob-2','pin-status-txt-2']
  ];
  var icons = ['btn-cat','btn-sup','btn-comp','btn-rpt','btn-gastos','btn-borrar','btn-exp','btn-imp'];
  pares.forEach(function(par){
    var sw = document.getElementById(par[0]);
    var knob = document.getElementById(par[1]);
    var txt = document.getElementById(par[2]);
    if(!sw || !knob || !txt) return;
    sw.style.background = PIN_ACTIVO ? '#2E7D32' : '#aaa';
    knob.style.left = PIN_ACTIVO ? '22px' : '3px';
    txt.textContent = PIN_ACTIVO ? 'Activado' : 'Desactivado';
  });
  if(PIN_ACTIVO){
    icons.forEach(function(id){ var b=document.getElementById(id); if(b) b.textContent = b.textContent.replace(' 🔒',''); });
  }
}

function eliminarDuplicados(){
  loadProds();
  var vistos = {};
  var duplicados = [];
  var unicos = [];

  productos.forEach(function(p){
    var key = p.nombre.trim().toLowerCase();
    if(vistos[key]){
      duplicados.push(p);
    } else {
      vistos[key] = true;
      unicos.push(p);
    }
  });

  if(!duplicados.length){
    alert('✅ No se encontraron productos duplicados en el catálogo.');
    return;
  }

  var lista = duplicados.map(function(p, i){
    return (i+1)+'. '+escaparHtml(p.nombre)+' (SKU: '+(p.sku||'sin SKU')+', Precio: $'+fmtNum(p.precio)+', Stock: '+p.stock+')';
  }).join('\n');

  if(!confirm('Se encontraron '+duplicados.length+' producto(s) duplicado(s):\n\n'+lista+'\n\n¿Eliminarlos? Solo se conservará la primera versión de cada uno.')){
    return;
  }

  // IMPORTANTE: no basta con quitarlos de la lista en memoria -si son parte del catalogo base
  // de la app, hay que marcarlos como eliminados de verdad, o vuelven a aparecer la proxima vez-
  var eliminados = LS('np_eliminados', []);
  duplicados.forEach(function(p){
    if(eliminados.indexOf(String(p.id)) === -1) eliminados.push(String(p.id));
  });
  SS('np_eliminados', eliminados);

  productos = unicos;
  SS('np', productos);
  alert('✅ '+duplicados.length+' duplicado(s) eliminado(s). Catálogo actualizado.');
  renderCatalogo(document.getElementById('catbuscar').value || '');
}

function actualizarPrefijoNombre(i){
  var sel = document.getElementById('epml-marca-sel-'+i);
  var input = document.getElementById('epml-marca-'+i);
  var pref = document.getElementById('epml-nombre-prefijo-'+i);
  if(!pref) return;
  var marcaTxt = (sel.value === '__otra__') ? input.value.trim() : sel.value;
  pref.textContent = marcaTxt || '(sin marca)';
}

function toggleOtraCat(i){
  var sel = document.getElementById('epml-cat-sel-'+i);
  var input = document.getElementById('epml-cat-'+i);
  if(sel.value === '__otra__'){
    input.style.display = 'block';
    input.value = '';
    input.focus();
  } else {
    input.style.display = 'none';
    input.value = sel.value;
  }
}

// ═══════════════════════════════════════════════════════════════════
//  🔒 EL RECUADRO DEL PIN  (6 sep 2026)
//
//  🔴 EL FALLO QUE ARREGLA, y era grave: `verificarPIN` usaba `prompt()`, y en el
//  teléfono de Sensei Chrome NO LO DIBUJA. Sin recuadro no escribe el PIN, la función
//  se corta en seco, y él veía que "no pasa nada" — sin error, sin aviso, sin nada.
//
//  ⚠️ Y no era solo el crédito: `protegerConHuella` protege **20 sitios** que mueven
//  dinero. Con el prompt bloqueado, NINGUNO funcionaba.
//
//  🔑 La seguridad NO cambia: sigue pidiendo el mismo PIN, con el mismo límite de
//  intentos. Lo único que cambia es que ahora SE VE.
// ═══════════════════════════════════════════════════════════════════

function pedirPinConRecuadro(motivo, alAcertar){
  var ov = document.getElementById('pin-overlay');
  if(!ov){
    ov = document.createElement('div');
    ov.id = 'pin-overlay';
    document.body.appendChild(ov);
  }
  window._pinCallback = alAcertar;

  // 🔑 z-index 2000005: por encima de TODO lo demás de la app. El recuadro del PIN
  // aparece encima de otros recuadros -el del crédito, el de cobrar-, así que si
  // quedara detrás volveríamos al mismo problema.
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:2000005;'
    + 'display:flex;align-items:center;justify-content:center;padding:16px';
  ov.onclick = function(e){ if(e.target === ov) cerrarPinRecuadro(); };

  ov.innerHTML = '<div style="background:#fff;border-radius:15px;padding:18px;max-width:380px;width:100%">'
    + '<div style="font-size:16px;font-weight:900;color:#1a237e;text-align:center;margin-bottom:4px">'
    +   '\ud83d\udd12 Confirma con tu PIN</div>'
    + (motivo
        ? '<div style="font-size:12.5px;color:var(--nbs-muted);text-align:center;line-height:1.5;'
          + 'margin-bottom:13px">' + escaparHtml(String(motivo)) + '</div>'
        : '<div style="margin-bottom:13px"></div>')
    + '<input type="password" id="pin-campo" inputmode="numeric" autocomplete="off" '
    +   'placeholder="PIN" '
    +   'style="width:100%;padding:15px;border:2px solid #ccc;border-radius:11px;'
    +   'font-size:22px;text-align:center;letter-spacing:6px;font-weight:800">'
    + '<div id="pin-aviso" style="font-size:12px;color:#C62828;font-weight:700;'
    +   'text-align:center;min-height:17px;margin-top:6px"></div>'
    + '<button onclick="comprobarPinRecuadro()" style="width:100%;padding:14px;margin-top:8px;'
    +   'background:#1a237e;color:#fff;border:none;border-radius:11px;font-size:15px;'
    +   'font-weight:800;cursor:pointer">\u2713 Confirmar</button>'
    + '<button onclick="cerrarPinRecuadro()" style="width:100%;padding:12px;margin-top:7px;'
    +   'background:#F0F0F2;color:#333;border:none;border-radius:10px;font-size:13.5px;'
    +   'font-weight:700;cursor:pointer">Cancelar</button>'
    + '</div>';

  ov.style.display = 'flex';
  setTimeout(function(){
    var c = document.getElementById('pin-campo');
    if(c){
      c.focus();
      // Entrar con la tecla, para el que escribe con teclado
      c.onkeydown = function(e){ if(e.key === 'Enter') comprobarPinRecuadro(); };
    }
  }, 90);
}

function cerrarPinRecuadro(){
  var ov = document.getElementById('pin-overlay');
  if(ov) ov.style.display = 'none';
  window._pinCallback = null;
}

function comprobarPinRecuadro(){
  var c = document.getElementById('pin-campo');
  var av = document.getElementById('pin-aviso');
  var pin = c ? c.value : '';
  if(!pin){
    if(av) av.textContent = 'Escribe tu PIN.';
    return;
  }
  // 🔑 EL MISMO control de siempre, con su límite de intentos. No se relaja nada.
  if(verificarPinConLimite(pin)){
    var cb = window._pinCallback;
    cerrarPinRecuadro();
    if(typeof cb === 'function'){
      try { cb(); } catch(e){ console.error('PIN ok pero la accion fallo:', e); }
    }
  } else {
    if(av) av.textContent = 'PIN incorrecto.';
    if(c){ c.value = ''; c.focus(); }
  }
}

function verificarPIN(callback, motivo){
  // \ud83d\udd34 ANTES ERA UN prompt() Y EL TELEFONO NO LO DIBUJABA -6 sep-. Sensei tocaba
  // "Usar el credito" y no pasaba NADA: ni error, ni aviso. Y esto protege 20 sitios
  // que mueven dinero, asi que ninguno funcionaba.
  // La seguridad no cambia: el mismo PIN y el mismo limite de intentos.
  pedirPinConRecuadro(motivo || 'Esta accion mueve dinero.', callback);
}

// Protege una accion peligrosa (borrar cliente, borrar pago, etc.) pidiendo SOLO la huella
// -un toque, rapido-. Si el usuario NO tiene huella configurada, cae al PIN como respaldo
// para que la accion nunca quede sin proteccion. El callback solo corre si se verifica.
function protegerConHuella(callback){
  var idHuella = localStorage.getItem(CLAVE_HUELLA_ID);
  if(idHuella && window.PublicKeyCredential && navigator.credentials && navigator.credentials.get){
    navigator.credentials.get({
      publicKey: {
        challenge: retoAleatorio(),
        // \ud83d\udd11 `transports:['internal']` le dice a Android que la huella est\u00e1 EN ESTE
        // TELEFONO. Sin esto buscaba llaves externas -USB, NFC-, no encontraba ninguna
        // y fallaba SIN ABRIR EL LECTOR. -8 sep-
        allowCredentials: [{ type:'public-key', id: base64ABuffer(idHuella),
                             transports: ['internal'] }],
        userVerification: 'required',
        timeout: 60000
      }
    }).then(function(){
      callback(); // huella verificada por el telefono
    }).catch(function(e){
      console.error('Huella no verificada:', e);
      alert('No se reconoció la huella. Acción cancelada.');
    });
  } else {
    // No hay huella configurada: usar el PIN como respaldo para no quedar sin proteccion.
    verificarPIN(callback);
  }
}

function cancelarFactura(v){
  protegerConHuella(function(){
    if(!confirm('¿Cancelar esta factura de $'+fmtNum(v.total)+'?\n\nEl stock de los productos será restaurado.\nLa factura quedará marcada como CANCELADA en el historial.')) return;
    loadProds();
    ventas = LS('nv', []);
    var ventaReal = ventas.find(function(x){ return String(x.id) === String(v.id); });
    if(!ventaReal) return;
    ventaReal.cancelada = true;
    ventaReal.fechaCancelacion = fechaHoy();
    // Restaurar stock
    ventaReal.items.forEach(function(it){
      var p = productos.find(function(x){ return String(x.id)===String(it.pid); });
      if(p) p.stock += it.cant;
    });
    SS('nv', ventas);
    SS('np', productos);
    alert('Factura cancelada. Stock restaurado correctamente.');
    verFactura(ventaReal);
  });
}

function modificarFactura(v){
  protegerConHuella(function(){
    var el = document.getElementById('cl-factura-contenido');
    el.innerHTML = '';

    var titulo = document.createElement('div');
    titulo.innerHTML = '<div style="font-size:16px;font-weight:700;color:#E65100;margin-bottom:12px">✏️ Modificar factura</div>'
      +'<div style="font-size:12px;color:#aaa;margin-bottom:16px">'+nombreVentaClienteConNegocio(v)+' · '+v.fecha+'</div>';
    el.appendChild(titulo);

    var itemsEdit = (v.items || []).map(function(it){ return Object.assign({}, it); });

    function renderEdicion(){
      var lista = document.getElementById('edit-items-lista');
      if(!lista) return;
      lista.innerHTML = '';
      var subtot = 0;
      itemsEdit.forEach(function(it, i){
        subtot += it.cant * it.precio;
        var row = document.createElement('div');
        row.className = 'card';
        row.style.cssText = 'margin-bottom:8px;padding:10px';
        row.innerHTML = '<div style="font-size:13px;font-weight:700;margin-bottom:8px">'+escaparHtml(it.nombre)+'</div>'
          +'<div style="display:grid;grid-template-columns:1fr 1fr auto;gap:8px;align-items:center">'
          +'<div><div style="font-size:11px;color:#aaa;margin-bottom:4px">CANTIDAD</div>'
          +'<input type="number" min="1" value="'+it.cant+'" id="edit-cant-'+i+'" style="width:100%;padding:8px;border:1.5px solid #ddd;border-radius:8px;font-size:14px;font-family:sans-serif" oninput="actualizarItemEdit('+i+')">'
          +'</div>'
          +'<div><div style="font-size:11px;color:#aaa;margin-bottom:4px">PRECIO UNIT. ($)</div>'
          +'<input type="text" inputmode="numeric" value="'+it.precio.toFixed(2)+'" id="edit-precio-'+i+'" style="width:100%;padding:8px;border:1.5px solid #ddd;border-radius:8px;font-size:14px;font-family:sans-serif" onfocus="this.select()" oninput="formatoMonedaEdit(this,'+i+')">'
          +'</div>'
          +'<div style="text-align:center"><div style="font-size:11px;color:#aaa;margin-bottom:4px">TOTAL</div>'
          +'<div id="edit-tot-'+i+'" style="font-weight:700;color:#1565C0;font-size:14px">$'+fmtNum((it.cant*it.precio))+'</div>'
          +'<button onclick="eliminarItemEdit('+i+')" style="background:none;border:none;cursor:pointer;color:#D32F2F;font-size:20px;margin-top:4px">🗑️</button>'
          +'</div></div>';
        lista.appendChild(row);
      });
      var totEl = document.getElementById('edit-total-final');
      if(totEl) totEl.textContent = '$' + fmtNum(subtot);
    }

    window.actualizarItemEdit = function(i){
      var cant = parseInt(document.getElementById('edit-cant-'+i).value) || 1;
      var precio = dinero(document.getElementById('edit-precio-'+i).value) || 0;
      itemsEdit[i].cant = cant;
      itemsEdit[i].precio = precio;
      var totEl = document.getElementById('edit-tot-'+i);
      if(totEl) totEl.textContent = '$'+fmtNum((cant*precio));
      var subtot = itemsEdit.reduce(function(s,it){ return s+it.cant*it.precio; }, 0);
      var totFinal = document.getElementById('edit-total-final');
      if(totFinal) totFinal.textContent = '$'+fmtNum(subtot);
    };

    window.eliminarItemEdit = function(i){
      if(!confirm('¿Eliminar "'+itemsEdit[i].nombre+'" de esta factura?')) return;
      itemsEdit.splice(i, 1);
      renderEdicion();
    };

    var wrap = document.createElement('div');
    wrap.innerHTML = '<div id="edit-items-lista"></div>'
      +'<div style="background:#E8F5E9;border-radius:8px;padding:12px;margin:8px 0;display:flex;justify-content:space-between">'
      +'<span style="font-weight:700">Nuevo total</span><span id="edit-total-final" style="font-weight:700;font-size:18px;color:#1565C0">$0.00</span></div>'
      +'<button onclick="guardarModificacionFactura('+v.id+')" style="width:100%;padding:14px;background:#2E7D32;color:white;border:none;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600;margin-bottom:8px">✓ Guardar cambios</button>'
      +'<button onclick="verFactura(ventaActual||window._facturaActual)" style="width:100%;padding:12px;background:#546E7A;color:white;border:none;border-radius:8px;cursor:pointer;font-size:13px">← Cancelar</button>';
    el.appendChild(wrap);

    window._facturaActual = v;
    window._itemsEdit = itemsEdit;

    renderEdicion();
  });
}

window.guardarModificacionFactura = function(vid){
  if(!window._itemsEdit || !window._itemsEdit.length){ alert('Debe quedar al menos un producto'); return; }
  // -confirmacion redundante quitada, el boton de Guardar ya es la confirmacion-
  loadProds();
  ventas = LS('nv', []);
  var ventaReal = ventas.find(function(x){ return String(x.id) === String(vid); });
  if(!ventaReal) return;

  // Restaurar stock original y aplicar nuevo
  ventaReal.items.forEach(function(it){
    var p = productos.find(function(x){ return String(x.id)===String(it.pid); });
    if(p) p.stock += it.cant;
  });
  if(!verificarStockSuficiente(window._itemsEdit)) {
    // Deshacer la restauración que ya se hizo, para no dejar el stock alterado sin guardar
    ventaReal.items.forEach(function(it){
      var p = productos.find(function(x){ return String(x.id)===String(it.pid); });
      if(p) p.stock -= it.cant;
    });
    return;
  }
  window._itemsEdit.forEach(function(it){
    var p = productos.find(function(x){ return String(x.id)===String(it.pid); });
    if(p) p.stock = (p.stock||0) - it.cant;   // igual que saveV: baja a negativo, la factura lo corrige solo -20 sep-
  });

  var nuevoTotal = window._itemsEdit.reduce(function(s,it){ return s+it.cant*it.precio; }, 0);
  // Con la formula UNICA, para que no se contradiga con el chequeo. -8 ago-
  var nuevaGanancia = gananciaDeVenta({ items: window._itemsEdit, descuento: ventaReal.descuento });

  ventaReal.items = window._itemsEdit.slice();
  ventaReal.total = nuevoTotal;
  ventaReal.ganancia = nuevaGanancia;
  ventaReal.modificada = true;
  ventaReal.fechaModificacion = fechaHoy();

  SS('nv', ventas);
  SS('np', productos);
  alert('Factura modificada correctamente.');
  verFactura(ventaReal);
};

function agregarBalanceInicial(id){
  clientes = LS('ncl', []);
  var cl = clientes.find(function(x){ return String(x.id) === String(id); });
  if(!cl) return;

  var el = document.getElementById('cl-perfil-contenido');
  el.innerHTML = '';

  var back = document.createElement('button');
  back.className = 'back';
  back.textContent = '← Volver al perfil';
  back.onclick = function(){ verCl(id); };
  el.appendChild(back);

  var form = document.createElement('div');
  form.className = 'card';
  form.innerHTML = '<p style="font-size:15px;font-weight:700;margin-bottom:4px">💰 Balance inicial</p>'
    +'<p style="font-size:12px;color:#aaa;margin-bottom:14px">Se creará una factura a crédito con este balance. Aparecerá en Cuentas por Cobrar.</p>'
    +'<div style="background:#EDE7F6;border-radius:8px;padding:10px;margin-bottom:12px">'
    +'<div style="font-size:13px;font-weight:600;color:#6A1B9A">Cliente: '+escaparHtml(nombreCl(cl))+'</div>'
    +(cl.negocio?'<div style="font-size:12px;color:#aaa">'+cl.negocio+'</div>':'')
    +'</div>'
    +'<label class="lbl">Monto del balance pendiente ($) *</label>'
    +'<input class="inp" id="bi-monto" type="text" inputmode="numeric" value="0.00" onfocus="this.select()" oninput="formatoMoneda(this)">'
    +'<label class="lbl">Descripción</label>'
    +'<input class="inp" id="bi-nota" type="text" value="Balance inicial traído de sistema anterior" placeholder="Descripción del balance">'
    +'<label class="lbl">Fecha</label>'
    +'<input class="inp" id="bi-fecha" type="date" lang="en-US">'
    +'<button class="btn" style="background:#6A1B9A;color:white" onclick="guardarBalanceInicial('+id+')">✓ Registrar balance inicial</button>';
  el.appendChild(form);

  document.getElementById('bi-fecha').value = fechaHoyISO();
}

function guardarBalanceInicial(id){
  clientes = LS('ncl', []);
  var cl = clientes.find(function(x){ return String(x.id) === String(id); });
  if(!cl) return;

  var monto = dinero(document.getElementById('bi-monto').value) || 0;
  if(monto <= 0){ alert('Ingresa un monto válido mayor a $0.00'); return; }

  var nota = limpiarTexto(document.getElementById('bi-nota').value.trim()) || 'Balance inicial traído de sistema anterior';
  var fecha = document.getElementById('bi-fecha').value || fechaHoyISO();
  var fechaFmt = fechaFormat(new Date(fecha+'T12:00:00'));

  // -confirmacion redundante quitada, el boton de Guardar ya es la confirmacion-

  ventas = LS('nv', []);
  ventas.push({
    id: Date.now(),
    numFactura: siguienteNumeroFactura(),
    cid: cl.id,
    cn: nombreCl(cl),
    tipo: 'credito',
    items: [{ pid: null, nombre: nota, cant: 1, precio: monto, costo: 0 }],
    subtotal: monto,
    total: monto,
    ganancia: 0,
    fecha: fechaFmt,
    hora: '12:00 p.m.',
    pagosFactura: [],
    clienteData: { negocio: cl.negocio||'', tel: cl.tel||'', email: cl.email||'', dir: cl.dir||'', ciudad: cl.ciudad||'', estado: cl.estado||'', zip: cl.zip||'' },
    esBalanceInicial: true
  });
  SS('nv', ventas);

  alert('✅ Balance inicial de $'+fmtNum(monto)+' registrado correctamente.\nAparece en Cuentas por Cobrar.');
  verCl(id);
}

function editarCl(id){
  clientes = LS('ncl', []);
  var c = clientes.find(function(x){ return String(x.id) === String(id); });
  if(!c) return;

  var el = document.getElementById('cl-perfil-contenido');
  el.innerHTML = '';

  var back = document.createElement('button');
  back.className = 'back';
  back.textContent = '← Volver al perfil';
  back.onclick = function(){ verCl(id); };
  el.appendChild(back);

  var form = document.createElement('div');
  form.className = 'card';
  form.innerHTML = '<p style="font-size:15px;font-weight:700;margin-bottom:12px">✏️ Editar cliente</p>'
    +'<input type="file" id="ecl-foto-camara" accept="image/*" capture="camera" style="display:none" onchange="cargarFotoCliente(this)">'
    +'<input type="file" id="ecl-foto-galeria" accept="image/*" style="display:none" onchange="cargarFotoCliente(this)">'
    +'<input type="hidden" id="ecl-foto-data" value="'+(c.foto||'')+'">'
    // 🔴 ARREGLO 21 ago: antes esto abria un <div style="display:none"> que envolvia la
    // foto Y TAMBIEN el bloque de Nombre, Apellido y Apodo, asi que esos tres campos
    // quedaban escondidos y no se podian editar. Ahora el display:none va en la fila de
    // la foto y en nada mas.
    +'<div style="display:none;align-items:center;gap:12px;margin-bottom:14px">'
    +'<div id="ecl-foto-preview" onclick="abrirOpcionesFotoCliente()" style="width:64px;height:64px;border-radius:12px;flex-shrink:0;cursor:pointer;display:flex;align-items:center;justify-content:center;overflow:hidden;'+(c.foto?'background:#f0f0f0':'background:var(--nbs-gold-bg);border:2px dashed var(--nbs-gold)')+'">'+(c.foto?'<img src="'+c.foto+'" style="width:100%;height:100%;object-fit:cover">':'📷')+'</div>'
    +'<div style="flex:1"><div style="font-size:13px;font-weight:700;color:var(--nbs-ink)">Foto del cliente</div>'
    +'<div style="font-size:11px;color:#888">Toca la foto para tomar una o elegir de la galería'+(c.foto?', o quitarla':'')+'</div></div>'
    +'</div>'
    +'<div class="r2">'
    +'<div><label class="lbl">Nombre *</label><input class="inp" id="ecl-n" type="text" value="'+( c.nombre||'')+'" onblur="capitalizarFinal(this)"></div>'
    +'<div><label class="lbl">Apellido *</label><input class="inp" id="ecl-a" type="text" value="'+(c.apellido||'')+'" onblur="capitalizarFinal(this)"></div>'
    +'<label class="lbl">Apodo / Como lo conoces 🔒 (uso interno)</label><input class="inp" id="ecl-apodo" type="text" value="'+(c.apodo||'')+'" placeholder="Ej: El Flaco, Cano..." onblur="capitalizarFinal(this)">'
    +'</div>'
    +'<label class="lbl">Tipo de negocio</label>'
    +'<select class="inp" id="ecl-tipo" onchange="toggleSubtipoTienda(\'ecl-tipo\',\'ecl-subtipo-wrap\');toggleIntervaloVisita(\'ecl-tipo\',\'ecl-intervalo-wrap\')">'
    +'<option value="Barberia"'+(!c.tipoNegocio||c.tipoNegocio==='Barberia'?' selected':'')+'>✂️ Barbería</option>'
    +'<option value="Tienda"'+(c.tipoNegocio&&c.tipoNegocio!=='Barberia'?' selected':'')+'>🏪 Tienda</option>'
    +'</select>'
    +'<div id="ecl-subtipo-wrap" style="display:'+(c.tipoNegocio&&c.tipoNegocio!=='Barberia'?'block':'none')+'">'
    +'<label class="lbl">Tipo de tienda</label>'
    +'<select class="inp" id="ecl-subtipo" onchange="toggleTipoNegocioOtro(\'ecl-subtipo\',\'ecl-subtipo-otro\')">'
    +'<option value="GroceryStore"'+((c.subtipoTienda||'GroceryStore')==='GroceryStore'?' selected':'')+'>🛒 Grocery Store</option>'
    +'<option value="MeatMarket"'+(c.subtipoTienda==='MeatMarket'||c.tipoNegocio==='MeatMarket'?' selected':'')+'>🥩 Meat Market</option>'
    +'<option value="SuperMarket"'+(c.subtipoTienda==='SuperMarket'?' selected':'')+'>🏬 Super Market</option>'
    +'<option value="Otro"'+(c.subtipoTienda==='Otro'||c.tipoNegocio==='Otro'?' selected':'')+'>✏️ Otro (escribir)</option>'
    +'</select>'
    +'<input class="inp" id="ecl-subtipo-otro" type="text" placeholder="Escribe el tipo de tienda" value="'+(c.subtipoTiendaOtro||c.tipoNegocioOtro||'')+'" style="display:'+((c.subtipoTienda==='Otro'||c.tipoNegocio==='Otro')?'block':'none')+'">'
    +'</div>'
    +'<div id="ecl-intervalo-wrap" style="display:'+(c.tipoNegocio&&c.tipoNegocio!=='Barberia'?'block':'none')+';background:#E3F2FD;border-radius:10px;padding:10px;margin-bottom:8px">'
    +'<div style="font-size:11px;font-weight:700;color:#1565C0;margin-bottom:6px">🔔 RECORDATORIO DE VISITA</div>'
    +'<label class="lbl" style="margin-bottom:2px">Recordarme visitar cada cuántos días</label>'
    +'<input class="inp" id="ecl-intervalo" type="number" min="1" placeholder="Ej: 15" value="'+(c.intervaloVisitaDias||'')+'" style="margin-bottom:0">'
    +'</div>'
    +'<label class="lbl">Negocio / Barberia</label><input class="inp" id="ecl-ne" type="text" value="'+escaparHtml(c.negocio||'')+'" autocomplete="off" oninput="onNegocioInput(\'ecl-ne\')" onblur="capitalizarFinal(this);ocultarDropdown(\'ecl-ne\')">'
    +'<label class="lbl">Telefono</label><input class="inp" id="ecl-t" type="tel" value="'+(c.tel||'')+'" oninput="fmtTel(this)" maxlength="17" autocomplete="off" autocorrect="off">'
    +'<div style="background:#F5F5F5;border-radius:10px;padding:10px;margin-bottom:8px">'
    +'<div style="font-size:11px;font-weight:700;color:#666;margin-bottom:6px">📇 CONTACTO ADICIONAL (opcional)</div>'
    +'<label class="lbl">Nombre del contacto</label><input class="inp" id="ecl-contacto" type="text" value="'+(c.contacto||'')+'" placeholder="Ej: encargado, gerente, otro dueño..." onblur="capitalizarFinal(this)">'
    +'<label class="lbl">Apodo del contacto</label><input class="inp" id="ecl-contactoapodo" type="text" value="'+(c.contactoApodo||'')+'" placeholder="Ej: Robertico, Nena...">'
    +'<label class="lbl" style="margin-bottom:0">Teléfono del contacto</label><input class="inp" id="ecl-contactotel" type="tel" value="'+(c.contactoTel||'')+'" oninput="fmtTel(this)" maxlength="17" style="margin-bottom:0" autocomplete="off" autocorrect="off">'
    +'</div>'
    +'<label class="lbl">Email</label><input class="inp" id="ecl-e" type="email" value="'+(c.email||'')+'">'
    +'<label class="lbl">Direccion</label><input class="inp" id="ecl-d" type="text" value="'+(c.dir||'')+'" autocomplete="off" oninput="mostrarDirSugerencias(\'ecl-d\',\'ecl-d-drop\',this.value)" onblur="setTimeout(function(){var e=document.getElementById(\'ecl-d-drop\');if(e)e.style.display=\'none\';},200)">'
    +'<div id="ecl-d-drop" style="display:none;background:white;border:1px solid #ddd;border-radius:8px;max-height:180px;overflow-y:auto;margin-bottom:8px;box-shadow:0 2px 8px rgba(0,0,0,0.1)"></div>'
    +'<div class="r2">'
    +'<div><label class="lbl">Ciudad</label><input class="inp" id="ecl-ci" type="text" value="'+(c.ciudad||'')+'" autocomplete="off" oninput="onCiudadInput(\'ecl-ci\',\'ecl-st\')" onblur="ocultarDropdown(\'ecl-ci\')"></div>'
    +'<div><label class="lbl">ZIP</label><input class="inp" id="ecl-z" type="text" value="'+(c.zip||'')+'" maxlength="5" autocomplete="off" oninput="onZipInput(\'ecl-z\',\'ecl-ci\',\'ecl-st\')" onblur="ocultarDropdown(\'ecl-z\')"></div>'
    +'</div>'
    +'<label class="lbl">Estado</label><input class="inp" id="ecl-st" type="text" value="'+(c.estado||'')+'" autocomplete="off" oninput="onEstadoInput(\'ecl-st\')" onblur="ocultarDropdown(\'ecl-st\')">'
    +'<button class="btn" style="background:#1565C0;color:white" onclick="guardarEdicionCl('+id+')">✓ Guardar cambios</button>'
    +'<div class="snk" id="mk-ecl">Cliente actualizado</div>';
  el.appendChild(form);
}

function guardarEdicionCl(id){
  clientes = LS('ncl', []);
  var idx = clientes.findIndex(function(x){ return String(x.id) === String(id); });
  if(idx === -1) return;
  var nombre = limpiarTexto(document.getElementById('ecl-n').value.trim());
  var apellido = limpiarTexto(document.getElementById('ecl-a').value.trim());
  if(!nombre || !apellido){ alert('Nombre y apellido son requeridos'); return; }
  var negocioAnterior = (clientes[idx].negocio || '').trim();
  clientes[idx].nombre = nombre;
  clientes[idx].apellido = apellido;
  clientes[idx].negocio = limpiarTexto(document.getElementById('ecl-ne').value.trim());
  var apodoEl = document.getElementById('ecl-apodo'); if(apodoEl) clientes[idx].apodo = limpiarTexto(apodoEl.value.trim());
  clientes[idx].tel = document.getElementById('ecl-t').value.trim();
  var tipoEl = document.getElementById('ecl-tipo'); if(tipoEl) clientes[idx].tipoNegocio = tipoEl.value;
  var subtipoEl = document.getElementById('ecl-subtipo'); if(subtipoEl) clientes[idx].subtipoTienda = (tipoEl && tipoEl.value==='Tienda') ? subtipoEl.value : null;
  var subtipoOtroEl = document.getElementById('ecl-subtipo-otro'); if(subtipoOtroEl) clientes[idx].subtipoTiendaOtro = limpiarTexto(subtipoOtroEl.value.trim());
  var intervaloEl = document.getElementById('ecl-intervalo'); if(intervaloEl) clientes[idx].intervaloVisitaDias = (tipoEl && tipoEl.value==='Barberia') ? null : (parseInt(intervaloEl.value)||null);
  var contactoEl = document.getElementById('ecl-contacto'); if(contactoEl) clientes[idx].contacto = limpiarTexto(contactoEl.value.trim());
  var contactoApodoEl = document.getElementById('ecl-contactoapodo'); if(contactoApodoEl) clientes[idx].contactoApodo = limpiarTexto(contactoApodoEl.value.trim());
  var contactoTelEl = document.getElementById('ecl-contactotel'); if(contactoTelEl) clientes[idx].contactoTel = contactoTelEl.value.trim();
  clientes[idx].email = document.getElementById('ecl-e').value.trim();
  clientes[idx].dir = limpiarTexto(document.getElementById('ecl-d').value.trim());
  clientes[idx].ciudad = document.getElementById('ecl-ci').value.trim();
  clientes[idx].zip = document.getElementById('ecl-z').value.trim();
  clientes[idx].estado = document.getElementById('ecl-st').value.trim();
  // Foto del cliente: se guarda en el cliente localmente, pero a la nube va APARTE
  var fotoEl = document.getElementById('ecl-foto-data');
  if(fotoEl){
    var fotoNueva = fotoEl.value || '';
    var teniaFoto = !!clientes[idx].foto;
    if(fotoNueva){
      clientes[idx].foto = fotoNueva;
    } else {
      if(teniaFoto) borrarFotoClienteNube(clientes[idx].id); // se quitó la foto
      delete clientes[idx].foto;
    }
  }
  SS('ncl', clientes);
  sincronizarFotosClientes(clientes); // sube la foto a la nube (aparte, no dentro del cliente)

  // Si el negocio de este cliente cambio de nombre -y ya nadie mas usa el nombre viejo-, es un
  // renombre real de la barberia -no que el barbero se cambio a otro negocio distinto-. En ese caso,
  // se actualiza el nombre viejo por el nuevo en la Ruta de Visitas, para que no se quede "huerfano".
  var negocioNuevo = clientes[idx].negocio;
  if(negocioAnterior && negocioAnterior !== negocioNuevo){
    var siguenUsandoElViejo = clientes.some(function(c){ return String(c.id)!==String(id) && (c.negocio||'').trim()===negocioAnterior; });
    if(!siguenUsandoElViejo){
      var rutasPorDia2 = LS('rutas_por_dia', {});
      var seActualizoAlgunDia = false;
      Object.keys(rutasPorDia2).forEach(function(dk){
        var ruta = rutasPorDia2[dk] || [];
        var posicion = ruta.indexOf(negocioAnterior);
        if(posicion >= 0){
          if(negocioNuevo && ruta.indexOf(negocioNuevo) < 0){
            ruta[posicion] = negocioNuevo; // renombrar en su mismo lugar en la ruta
          } else {
            ruta.splice(posicion, 1); // ya no tiene nombre nuevo -o ya estaba duplicado-, se quita
          }
          rutasPorDia2[dk] = ruta;
          seActualizoAlgunDia = true;
        }
      });
      if(seActualizoAlgunDia) SS('rutas_por_dia', rutasPorDia2);
    }
  }

  // IMPORTANTE: a proposito NO se actualiza el nombre de negocio dentro de las ventas viejas
  // -v.clienteData.negocio-. La historia de una venta debe quedar tal como paso en su momento:
  // si el barbero vendio algo estando en la barberia "A" y despues se mudo a la barberia "B",
  // esa venta vieja debe seguir mostrando "A" para siempre, sin importar donde este el barbero ahora.
  // Solo la Ruta de Visitas -que es sobre a donde ir DE AHORA EN ADELANTE, no sobre el pasado- se
  // actualiza arriba.

  // Actualizar nombre en todas las ventas de este cliente
  ventas = LS('nv', []);
  var nombreCompleto = nombre + ' ' + apellido;
  var actualizadas = 0;
  ventas.forEach(function(v){
    if(String(v.cid) === String(id)){
      v.cn = nombreCompleto;
      actualizadas++;
    }
  });
  if(actualizadas > 0) SS('nv', ventas);
  // Actualizar nombre en pedidos pendientes
  var pedidos = LS('npedidos', []);
  pedidos.forEach(function(p){
    if(String(p.cid) === String(id)) p.nombre = nombreCompleto;
  });
  SS('npedidos', pedidos);
  alert('✅ Datos de ' + nombreCompleto + ' guardados con éxito.' + (actualizadas > 0 ? '\n' + actualizadas + ' factura(s) actualizada(s).' : ''));
  verCl(id);
}

function eliminarCl(id){
  if(confirm('¿Eliminar este cliente?')){
    protegerConHuella(function(){
      clientes=LS('ncl',[]);
      clientes=clientes.filter(function(x){return x.id!==id;});
      SS('ncl',clientes);
      ir('p-cl');
    });
  }
}

// Reporte de PAGOS RECIBIDOS: quien te pago, cuanto, cuando y como, dentro del rango de fechas.
// Junta los abonos de TODAS las facturas -ventas a credito- cuya fecha de PAGO caiga en el rango.
function genRpt(){
  ventas = LS('nv',[]);
  var desde = document.getElementById('rfrom').value;
  var hasta = document.getElementById('rto').value;
  var tipo = document.getElementById('rtipo').value;
  var el = document.getElementById('rptres');
  el.innerHTML = '';
  var filt = ventas.filter(function(v){
    if(v.cancelada) return false;
    if(v.esBalanceInicial) return false;
    if(!desde && !hasta) return true;
    try {
      var vd = parsearFechaVenta(v.fecha);
      if(desde){
        // desde viene en formato YYYY-MM-DD del input type=date
        var dp = desde.split('-');
        var dd = new Date(parseInt(dp[0]), parseInt(dp[1])-1, parseInt(dp[2]));
        if(vd < dd) return false;
      }
      if(hasta){
        var hp = hasta.split('-');
        var hd = new Date(parseInt(hp[0]), parseInt(hp[1])-1, parseInt(hp[2]));
        hd.setHours(23,59,59,999);
        if(vd > hd) return false;
      }
    } catch(e){ return true; }
    return true;
  });
  // ══ REPORTE DE PAGOS RECIBIDOS ══ (va antes del chequeo de ventas, porque filtra
  //    por la fecha del PAGO, no por la fecha de la venta — un pago puede caer en otra fecha)
  if(tipo === 'pagos'){
    reporteDePagos(desde, hasta, el);
    return;
  }

  if(!filt.length){
    el.innerHTML = '<div class="card"><p style="color:#aaa;text-align:center;padding:20px">Sin ventas vigentes en ese periodo</p></div>';
    return;
  }
  var tv = filt.reduce(function(s,v){return s+v.total;},0);
  var tg = filt.reduce(function(s,v){return s+(v.ganancia||0);},0);

  // Devoluciones dentro del mismo periodo -usando la fecha REAL de la devolucion, no la de la venta original-
  var devolucionesLS = LS('ndevoluciones', []);
  var devFiltradas = devolucionesLS.filter(function(d){
    if(!desde && !hasta) return true;
    try {
      var dd2 = parsearFechaVenta(d.fecha);
      if(desde){ var dp2=desde.split('-'); var df2=new Date(parseInt(dp2[0]),parseInt(dp2[1])-1,parseInt(dp2[2])); if(dd2<df2) return false; }
      if(hasta){ var hp2=hasta.split('-'); var hf2=new Date(parseInt(hp2[0]),parseInt(hp2[1])-1,parseInt(hp2[2])); hf2.setHours(23,59,59,999); if(dd2>hf2) return false; }
    } catch(e){ return true; }
    return true;
  });
  var totalDevuelto = devFiltradas.reduce(function(s,d){ return s+d.monto; },0);
  var gananciaPerdidaEnDev = devFiltradas.reduce(function(s,d){
    return s + (d.items || []).reduce(function(s2,it){ return s2+(it.cant*(it.precio-(it.costo||0))); },0);
  },0);

  var card = document.createElement('div'); card.className='card';
  card.innerHTML = '<p style="font-size:15px;font-weight:700;margin-bottom:10px">Resumen</p>'
    +'<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f0f0f0"><span style="color:#777">Total ventas</span><span style="font-weight:700;color:#1565C0">$'+fmtNum(tv)+'</span></div>'
    +'<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f0f0f0"><span style="color:#777">Numero de ventas</span><span style="font-weight:700">'+filt.length+'</span></div>'
    +(devFiltradas.length ? '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f0f0f0"><span style="color:#E65100">↩️ Devoluciones ('+devFiltradas.length+')</span><span style="font-weight:700;color:#E65100">-$'+fmtNum(totalDevuelto)+'</span></div>' : '')
    +'<div style="background:#E8F5E9;border-radius:8px;padding:14px;margin-top:10px;display:flex;justify-content:space-between;align-items:center">'
    +'<span style="color:#2E7D32;font-weight:600">Ganancia'+(devFiltradas.length?' neta':' total')+'</span>'
    +'<span style="font-size:22px;font-weight:700;color:#2E7D32">$'+fmtNum(tg-gananciaPerdidaEnDev)+'</span></div>'
    +(devFiltradas.length ? '<div style="font-size:11px;color:#aaa;text-align:right;margin-top:4px">Ganancia bruta $'+fmtNum(tg)+' − $'+fmtNum(gananciaPerdidaEnDev)+' de devoluciones</div>' : '');
  el.appendChild(card);

  if(tipo==='cliente'){
    var pc={};
    filt.forEach(function(v){
      var k = v.cid ? String(v.cid) : (v.cn||'Cliente general');
      if(!pc[k]) pc[k]={v:0,g:0,c:0,nombre:nombreVentaClienteConNegocio(v)};
      pc[k].v+=v.total; pc[k].g+=(v.ganancia||0); pc[k].c++;
    });
    // Totales generales
    var totV=0,totG=0,totC=0;
    Object.keys(pc).forEach(function(k){ totV+=pc[k].v; totG+=pc[k].g; totC+=pc[k].c; });
    var c2=document.createElement('div'); c2.className='card';
    c2.innerHTML='<p style="font-size:15px;font-weight:700;margin-bottom:10px">📋 Reporte por cliente</p>'
      +'<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px">'
      +'<div style="background:#E3F2FD;border-radius:8px;padding:10px;text-align:center">'
      +'<div style="font-size:11px;color:#1565C0;font-weight:700">TOTAL VENTAS</div>'
      +'<div style="font-size:16px;font-weight:800;color:#1565C0">$'+fmtNum(totV)+'</div></div>'
      +'<div style="background:#E8F5E9;border-radius:8px;padding:10px;text-align:center">'
      +'<div style="font-size:11px;color:#2E7D32;font-weight:700">GANANCIA</div>'
      +'<div style="font-size:16px;font-weight:800;color:#2E7D32">$'+fmtNum(totG)+'</div></div>'
      +'<div style="background:#FFF3E0;border-radius:8px;padding:10px;text-align:center">'
      +'<div style="font-size:11px;color:#E65100;font-weight:700">FACTURAS</div>'
      +'<div style="font-size:16px;font-weight:800;color:#E65100">'+totC+'</div></div>'
      +'</div>';
    Object.keys(pc).sort(function(a,b){return pc[b].v-pc[a].v;}).forEach(function(k,idx){
      var margen = pc[k].v>0 ? Math.round((pc[k].g/pc[k].v)*100) : 0;
      var numColor = '#6D4C41';
      var numBg = idx===0?'#FFFDE7':idx===1?'#F5F5F5':idx===2?'#FFF3E0':'transparent';
      var row=document.createElement('div');
      row.style.cssText='padding:10px;border-bottom:1px solid #f0f0f0;display:flex;align-items:flex-start;gap:10px'+(idx<3?';background:'+numBg+';border-radius:8px':'');
      row.innerHTML='<div style="min-width:32px;height:32px;border-radius:50%;background:'+numColor+';color:white;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:800;flex-shrink:0">'+(idx+1)+'</div>'
        +'<div style="flex:1">'
        +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">'
        +'<div style="font-size:14px;font-weight:700;color:#1a237e">'+pc[k].nombre+'</div>'
        +'<div style="font-size:11px;color:#aaa">'+pc[k].c+' factura(s)</div>'
        +'</div>'
        +'<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px">'
        +'<div style="background:#f5f5f5;border-radius:6px;padding:6px;text-align:center">'
        +'<div style="font-size:10px;color:#aaa">Compró</div>'
        +'<div style="font-size:13px;font-weight:700;color:#1565C0">$'+fmtNum(pc[k].v)+'</div></div>'
        +'<div style="background:#f5f5f5;border-radius:6px;padding:6px;text-align:center">'
        +'<div style="font-size:10px;color:#aaa">Ganancia</div>'
        +'<div style="font-size:13px;font-weight:700;color:#2E7D32">$'+fmtNum(pc[k].g)+'</div></div>'
        +'<div style="background:#f5f5f5;border-radius:6px;padding:6px;text-align:center">'
        +'<div style="font-size:10px;color:#aaa">Margen</div>'
        +'<div style="font-size:13px;font-weight:700;color:#E65100">'+margen+'%</div></div>'
        +'</div></div>';
      c2.appendChild(row);
    });
    el.appendChild(c2);
  }

  if(tipo==='ruta'){
    clientes = LS('ncl', []);
    var porNegocioRuta = {};
    filt.forEach(function(v){
      var negocioV = (v.clienteData && v.clienteData.negocio) ? v.clienteData.negocio : 'Sin negocio asignado';
      if(!porNegocioRuta[negocioV]) porNegocioRuta[negocioV] = { entregado:0, pendiente:0, facturas:0 };
      porNegocioRuta[negocioV].entregado += v.total;
      porNegocioRuta[negocioV].facturas += 1;
      if(v.tipo === 'credito'){
        var pagadoV = v.pagosFactura ? (v.pagosFactura || []).filter(function(p){return typeof p.monto==='number';}).reduce(function(s,p){return s+p.monto;},0) : 0;
        porNegocioRuta[negocioV].pendiente += Math.max(0, v.total - pagadoV);
      }
    });
    devFiltradas.forEach(function(d){
      var negocioD = d.cn ? (function(){
        var clD = clientes.find(function(c){ return String(c.id)===String(d.cid); });
        return clD ? (clD.negocio||'Sin negocio asignado') : 'Sin negocio asignado';
      })() : 'Sin negocio asignado';
      if(!porNegocioRuta[negocioD]) porNegocioRuta[negocioD] = { entregado:0, pendiente:0, facturas:0, devuelto:0 };
      porNegocioRuta[negocioD].devuelto = (porNegocioRuta[negocioD].devuelto||0) + d.monto;
    });

    var tituloRuta = document.createElement('div');
    tituloRuta.style.cssText = 'font-size:13px;font-weight:700;color:#1a237e;margin:14px 0 10px';
    tituloRuta.textContent = 'Por negocio: entregado, devuelto y pendiente';
    el.appendChild(tituloRuta);

    Object.keys(porNegocioRuta).sort(function(a,b){ return porNegocioRuta[b].entregado - porNegocioRuta[a].entregado; }).forEach(function(neg){
      var datos = porNegocioRuta[neg];
      var devueltoNeg = datos.devuelto || 0;
      var row = document.createElement('div');
      row.className = 'card';
      row.innerHTML = '<div style="font-size:14px;font-weight:700;color:#1a237e;margin-bottom:8px">🏪 '+neg+'</div>'
        +'<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px">'
        +'<div style="background:#E8F5E9;border-radius:6px;padding:8px;text-align:center">'
        +'<div style="font-size:10px;color:#2E7D32">Entregado</div>'
        +'<div style="font-size:13px;font-weight:700;color:#2E7D32">$'+fmtNum(datos.entregado)+'</div></div>'
        +'<div style="background:'+(devueltoNeg>0?'#FFF3E0':'#f5f5f5')+';border-radius:6px;padding:8px;text-align:center">'
        +'<div style="font-size:10px;color:'+(devueltoNeg>0?'#E65100':'#aaa')+'">Devuelto</div>'
        +'<div style="font-size:13px;font-weight:700;color:'+(devueltoNeg>0?'#E65100':'#aaa')+'">$'+fmtNum(devueltoNeg)+'</div></div>'
        +'<div style="background:'+(datos.pendiente>0.005?'#FFEBEE':'#f5f5f5')+';border-radius:6px;padding:8px;text-align:center">'
        +'<div style="font-size:10px;color:'+(datos.pendiente>0.005?'#C62828':'#aaa')+'">Pendiente</div>'
        +'<div style="font-size:13px;font-weight:700;color:'+(datos.pendiente>0.005?'#C62828':'#aaa')+'">$'+fmtNum(datos.pendiente)+'</div></div>'
        +'</div>'
        +'<div style="font-size:11px;color:#aaa;margin-top:6px">'+datos.facturas+' factura(s) en el periodo</div>';
      el.appendChild(row);
    });
  }

  if(tipo==='tiponegocio'){
    clientes = LS('ncl', []);
    var pt={};
    filt.forEach(function(v){
      var cl = clientes.find(function(c){ return String(c.id)===String(v.cid); });
      var tipoKey = cl ? ((!cl.tipoNegocio||cl.tipoNegocio==='Barberia')?'Barberia':'Tienda') : 'Barberia';
      var etiqueta = cl ? etiquetaTipoNegocio(cl) : '✂️ Barbería';
      if(!pt[tipoKey]) pt[tipoKey]={v:0,g:0,c:0,etiqueta:etiqueta};
      pt[tipoKey].v+=v.total; pt[tipoKey].g+=(v.ganancia||0); pt[tipoKey].c++;
    });
    var totVt=0,totGt=0,totCt=0;
    Object.keys(pt).forEach(function(k){ totVt+=pt[k].v; totGt+=pt[k].g; totCt+=pt[k].c; });
    var c3=document.createElement('div'); c3.className='card';
    c3.innerHTML='<p style="font-size:15px;font-weight:700;margin-bottom:10px">🏬 Ventas por tipo de negocio</p>'
      +'<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px">'
      +'<div style="background:#E3F2FD;border-radius:8px;padding:10px;text-align:center">'
      +'<div style="font-size:11px;color:#1565C0;font-weight:700">TOTAL VENTAS</div>'
      +'<div style="font-size:16px;font-weight:800;color:#1565C0">$'+fmtNum(totVt)+'</div></div>'
      +'<div style="background:#E8F5E9;border-radius:8px;padding:10px;text-align:center">'
      +'<div style="font-size:11px;color:#2E7D32;font-weight:700">GANANCIA</div>'
      +'<div style="font-size:16px;font-weight:800;color:#2E7D32">$'+fmtNum(totGt)+'</div></div>'
      +'<div style="background:#FFF3E0;border-radius:8px;padding:10px;text-align:center">'
      +'<div style="font-size:11px;color:#E65100;font-weight:700">FACTURAS</div>'
      +'<div style="font-size:16px;font-weight:800;color:#E65100">'+totCt+'</div></div>'
      +'</div>';
    Object.keys(pt).sort(function(a,b){return pt[b].v-pt[a].v;}).forEach(function(k){
      var margen = pt[k].v>0 ? Math.round((pt[k].g/pt[k].v)*100) : 0;
      var row=document.createElement('div');
      row.style.cssText='padding:10px;border-bottom:1px solid #f0f0f0';
      row.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">'
        +'<div style="font-size:14px;font-weight:700;color:#1a237e">'+pt[k].etiqueta+'</div>'
        +'<div style="font-size:11px;color:#aaa">'+pt[k].c+' factura(s)</div>'
        +'</div>'
        +'<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px">'
        +'<div style="background:#f5f5f5;border-radius:6px;padding:6px;text-align:center">'
        +'<div style="font-size:10px;color:#aaa">Vendido</div>'
        +'<div style="font-size:13px;font-weight:700;color:#1565C0">$'+fmtNum(pt[k].v)+'</div></div>'
        +'<div style="background:#f5f5f5;border-radius:6px;padding:6px;text-align:center">'
        +'<div style="font-size:10px;color:#aaa">Ganancia</div>'
        +'<div style="font-size:13px;font-weight:700;color:#2E7D32">$'+fmtNum(pt[k].g)+'</div></div>'
        +'<div style="background:#f5f5f5;border-radius:6px;padding:6px;text-align:center">'
        +'<div style="font-size:10px;color:#aaa">Margen</div>'
        +'<div style="font-size:13px;font-weight:700;color:#E65100">'+margen+'%</div></div>'
        +'</div>';
      c3.appendChild(row);
    });
    el.appendChild(c3);
  }

  if(tipo==='productos'){
    var pp={};
    filt.filter(function(v){ return !v.cancelada && !v.esBalanceInicial; }).forEach(function(v){
      (v.items||[]).forEach(function(it){
        var k = String(it.pid||it.nombre);
        if(!pp[k]) pp[k]={nombre:it.nombre, cant:0, total:0, ganancia:0};
        pp[k].cant += it.cant;
        pp[k].total += it.cant * it.precio;
        pp[k].ganancia += it.cant * (it.precio - (it.costo||0));
      });
    });
    var lista = Object.keys(pp).map(function(k){ return pp[k]; })
      .sort(function(a,b){ return b.cant - a.cant; });
    if(!lista.length){
      el.innerHTML += '<div class="card"><p style="color:#aaa;text-align:center;padding:20px">Sin datos de productos en este periodo</p></div>';
      return;
    }
    var maxCant = lista[0].cant;
    var c3 = document.createElement('div'); c3.className='card';
    c3.innerHTML = '<p style="font-size:15px;font-weight:700;margin-bottom:4px">🏆 Productos más vendidos</p>'
      +'<p style="font-size:12px;color:#aaa;margin-bottom:12px">Ordenados por cantidad vendida</p>';
    lista.forEach(function(p, i){
      var pct = maxCant > 0 ? Math.round((p.cant/maxCant)*100) : 0;
      var medal = i===0?'🥇':i===1?'🥈':i===2?'🥉':'';
      var row = document.createElement('div');
      row.style.cssText = 'padding:10px 0;border-bottom:1px solid #f0f0f0';
      row.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">'
        +'<div style="font-size:13px;font-weight:600;flex:1;margin-right:8px">'+medal+' '+escaparHtml(p.nombre)+'</div>'
        +'<div style="text-align:right;flex-shrink:0">'
        +'<div style="font-weight:700;color:#1565C0">'+p.cant+' unid.</div>'
        +'<div style="font-size:11px;color:#aaa">$'+fmtNum(p.total)+'</div>'
        +'</div></div>'
        +'<div style="height:6px;background:#eee;border-radius:3px;overflow:hidden">'
        +'<div style="height:100%;width:'+pct+'%;background:'+(i===0?'#F9A825':i===1?'#90A4AE':i===2?'#A1887F':'#1565C0')+';border-radius:3px"></div></div>';
      c3.appendChild(row);
    });
    el.appendChild(c3);
  }

  if(tipo==='ganancia'){
    var pg={};
    filt.filter(function(v){ return !v.cancelada && !v.esBalanceInicial; }).forEach(function(v){
      (v.items||[]).forEach(function(it){
        var k = String(it.pid||it.nombre);
        if(!pg[k]) pg[k]={nombre:it.nombre, cant:0, total:0, ganancia:0};
        pg[k].cant += it.cant;
        pg[k].total += it.cant * it.precio;
        pg[k].ganancia += it.cant * (it.precio - (it.costo||0));
      });
    });
    var listaG = Object.keys(pg).map(function(k){ return pg[k]; })
      .filter(function(p){ return p.ganancia > 0; })
      .sort(function(a,b){ return b.ganancia - a.ganancia; });
    if(!listaG.length){
      el.innerHTML += '<div class="card"><p style="color:#aaa;text-align:center;padding:20px">Sin datos en este periodo</p></div>';
      return;
    }
    var maxG = listaG[0].ganancia;
    var c4 = document.createElement('div'); c4.className='card';
    c4.innerHTML = '<p style="font-size:15px;font-weight:700;margin-bottom:4px">💰 Productos por mejor ganancia</p>'
      +'<p style="font-size:12px;color:#aaa;margin-bottom:12px">Ordenados por ganancia total ($)</p>';
    listaG.forEach(function(p, i){
      var pct = maxG > 0 ? Math.round((p.ganancia/maxG)*100) : 0;
      var medal = i===0?'🥇':i===1?'🥈':i===2?'🥉':'';
      var margen = p.total > 0 ? Math.round((p.ganancia/p.total)*100) : 0;
      var row = document.createElement('div');
      row.style.cssText = 'padding:10px 0;border-bottom:1px solid #f0f0f0';
      row.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">'
        +'<div style="font-size:13px;font-weight:600;flex:1;margin-right:8px">'+medal+' '+escaparHtml(p.nombre)+'</div>'
        +'<div style="text-align:right;flex-shrink:0">'
        +'<div style="font-weight:700;color:#2E7D32">$'+fmtNum(p.ganancia)+'</div>'
        +'<div style="font-size:11px;color:#aaa">'+p.cant+' unid. · '+margen+'% margen</div>'
        +'</div></div>'
        +'<div style="height:6px;background:#eee;border-radius:3px;overflow:hidden">'
        +'<div style="height:100%;width:'+pct+'%;background:'+(i===0?'#2E7D32':i===1?'#43A047':i===2?'#66BB6A':'#A5D6A7')+';border-radius:3px"></div></div>';
      c4.appendChild(row);
    });
    el.appendChild(c4);
  }

  if(tipo==='categoria'){
    var pcat={};
    filt.filter(function(v){ return !v.cancelada && !v.esBalanceInicial; }).forEach(function(v){
      (v.items||[]).forEach(function(it){
        loadProds();
        var prod = productos.find(function(x){ return String(x.id)===String(it.pid); });
        var cat = (prod && prod.cat) ? prod.cat : 'Sin categoría';
        if(!pcat[cat]) pcat[cat]={cant:0,total:0,ganancia:0};
        pcat[cat].cant += it.cant;
        pcat[cat].total += it.cant*it.precio;
        pcat[cat].ganancia += it.cant*(it.precio-(it.costo||0));
      });
    });
    var c5 = document.createElement('div'); c5.className='card';
    c5.innerHTML = '<p style="font-size:15px;font-weight:700;margin-bottom:12px">📂 Ventas por categoría</p>';
    Object.keys(pcat).sort(function(a,b){ return pcat[b].total-pcat[a].total; }).forEach(function(cat){
      var row = document.createElement('div');
      row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #f0f0f0';
      row.innerHTML = '<div><div style="font-size:13px;font-weight:600">'+cat+'</div>'
        +'<div style="font-size:11px;color:#aaa">'+pcat[cat].cant+' unidades vendidas</div></div>'
        +'<div style="text-align:right"><div style="font-weight:700;color:#1565C0">$'+fmtNum(pcat[cat].total)+'</div>'
        +'<div style="font-size:11px;color:#2E7D32">+$'+fmtNum(pcat[cat].ganancia)+' ganancia</div></div>';
      c5.appendChild(row);
    });
    el.appendChild(c5);
  }

  if(tipo==='gastos' || tipo==='gastos-cat'){
    var gastos = LS('ngastos',[]);
    var gfilt = gastos.filter(function(g){
      if(!desde && !hasta) return true;
      try {
        var gd = new Date(g.fecha);
        if(desde && gd < new Date(desde)) return false;
        if(hasta && gd > new Date(hasta+' 23:59:59')) return false;
      } catch(e){ return true; }
      return true;
    });
    var totalG = gfilt.reduce(function(s,g){ return s+g.monto; },0);
    var gc = document.createElement('div'); gc.className='card';
    gc.innerHTML = '<p style="font-size:15px;font-weight:700;margin-bottom:10px">💸 Resumen de gastos</p>'
      +'<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f0f0f0"><span style="color:#777">Total gastos</span><span style="font-weight:700;color:#C62828">$'+fmtNum(totalG)+'</span></div>'
      +'<div style="display:flex;justify-content:space-between;padding:8px 0"><span style="color:#777">Número de gastos</span><span style="font-weight:700">'+gfilt.length+'</span></div>';
    el.appendChild(gc);
    if(tipo==='gastos-cat'){
      var porcat={};
      gfilt.forEach(function(g){ if(!porcat[g.cat]) porcat[g.cat]=0; porcat[g.cat]+=g.monto; });
      var gc2 = document.createElement('div'); gc2.className='card';
      gc2.innerHTML = '<p style="font-size:15px;font-weight:700;margin-bottom:10px">Por categoría</p>';
      Object.keys(porcat).sort(function(a,b){ return porcat[b]-porcat[a]; }).forEach(function(cat){
        var pct = totalG>0?Math.round((porcat[cat]/totalG)*100):0;
        var row = document.createElement('div'); row.style.cssText='margin-bottom:10px';
        row.innerHTML='<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px">'
          +'<span style="font-weight:600">'+cat+'</span>'
          +'<span style="font-weight:700;color:#C62828">$'+fmtNum(porcat[cat])+' <span style="color:#aaa;font-weight:400">('+pct+'%)</span></span></div>'
          +'<div style="height:6px;background:#eee;border-radius:3px;overflow:hidden">'
          +'<div style="height:100%;width:'+pct+'%;background:#C62828;border-radius:3px"></div></div>';
        gc2.appendChild(row);
      });
      el.appendChild(gc2);
    }
  }

  if(tipo==='ventas-vs-gastos'){
    var gastos2 = LS('ngastos',[]);
    var gfilt2 = gastos2.filter(function(g){
      if(!desde && !hasta) return true;
      try {
        var gd = new Date(g.fecha);
        if(desde && gd < new Date(desde)) return false;
        if(hasta && gd > new Date(hasta+' 23:59:59')) return false;
      } catch(e){ return true; }
      return true;
    });
    var totalVentas = filt.filter(function(v){ return !v.cancelada; }).reduce(function(s,v){ return s+v.total; },0);
    var totalGanancias = filt.filter(function(v){ return !v.cancelada; }).reduce(function(s,v){ return s+(v.ganancia||0); },0);
    var totalGastos2 = gfilt2.reduce(function(s,g){ return s+g.monto; },0);
    var balance = totalGanancias - totalGastos2;
    var cv = document.createElement('div'); cv.className='card';
    cv.innerHTML = '<p style="font-size:15px;font-weight:700;margin-bottom:12px">📈 Ventas vs Gastos</p>'
      +'<div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f0f0f0">'
      +'<span style="color:#777">Total ventas</span><span style="font-weight:700;color:#1565C0">$'+fmtNum(totalVentas)+'</span></div>'
      +'<div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f0f0f0">'
      +'<span style="color:#777">Ganancia bruta</span><span style="font-weight:700;color:#2E7D32">$'+fmtNum(totalGanancias)+'</span></div>'
      +'<div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f0f0f0">'
      +'<span style="color:#777">Total gastos</span><span style="font-weight:700;color:#C62828">$'+fmtNum(totalGastos2)+'</span></div>'
      +'<div style="background:'+(balance>=0?'#E8F5E9':'#FFEBEE')+';border-radius:8px;padding:14px;margin-top:10px;display:flex;justify-content:space-between;align-items:center">'
      +'<span style="font-weight:700;color:'+(balance>=0?'#2E7D32':'#C62828')+'">Balance neto</span>'
      +'<span style="font-size:22px;font-weight:700;color:'+(balance>=0?'#2E7D32':'#C62828')+'">$'+fmtNum(balance)+'</span></div>';
    el.appendChild(cv);
  }

  // Botón de imprimir/compartir el reporte de ventas (pedido por Sensei)
  if(el.innerHTML && el.innerHTML.indexOf('Sin ve') === -1){
    var btnDiv = document.createElement('div');
    btnDiv.innerHTML = botonImprimirReporte('imprimirReporteVentas()');
    el.appendChild(btnDiv);
  }
}

// Imprime/comparte el reporte de ventas con lo que está en pantalla
function _histFecha(f){
  // Entiende MM/DD/AAAA y también las escritas al revés (DD/MM/AAAA)
  if(!f) return null;
  var p = String(f).split('/');
  if(p.length !== 3) return null;
  var m = parseInt(p[0],10), d = parseInt(p[1],10), a = parseInt(p[2],10);
  if(!isFinite(m) || !isFinite(d) || !isFinite(a)) return null;
  if(m > 12){ var t = m; m = d; d = t; }
  var x = new Date(a, m-1, d);
  return isNaN(x.getTime()) ? null : x;
}
function _histClave(x){
  return x.getFullYear() + '-' + String(x.getMonth()+1).padStart(2,'0') + '-' + String(x.getDate()).padStart(2,'0');
}
function _histBonito(clave){
  var p = clave.split('-');
  var x = new Date(+p[0], +p[1]-1, +p[2]);
  var dias = ['dom','lun','mar','mié','jue','vie','sáb'];
  var mes  = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return dias[x.getDay()] + ' ' + x.getDate() + ' ' + mes[x.getMonth()];
}

// Arma el día por día. Devuelve una lista del más nuevo al más viejo.
function renderFacturasSaldadas(q){
  ventas = LS('nv', []);
  clientes = LS('ncl', []);
  var el = document.getElementById('cxc-saldadas-lista');
  el.innerHTML = '';

  var saldadas = ventas.filter(function(v){
    if(v.cancelada) return false;
    var pagado = v.tipo==='credito'
      ? (v.pagosFactura ? (v.pagosFactura || []).filter(function(p){return typeof p.monto==='number';}).reduce(function(s,p){return s+p.monto;},0) : 0)
      : v.total;
    return cobradoYDebeDe(v).debe <= 0.005;
  });

  if(q && q.trim()){
    var ql = q.toLowerCase();
    saldadas = saldadas.filter(function(v){
      var cl = clientes.find(function(c){ return String(c.id)===String(v.cid); });
      var extra = cl ? ((cl.apodo||'')+' '+(cl.negocio||'')+' '+(cl.tel||'')+' '+(cl.dir||'')+' '+(cl.ciudad||'')+' '+(cl.contacto||'')+' '+(cl.contactoApodo||'')+' '+(cl.contactoTel||'')) : '';
      return coincideBusquedaPalabras((v.cn||'') + ' ' + extra + ' ' + (v.numFactura||''), ql);
    });
  }

  saldadas.sort(function(a,b){ return parsearFechaVenta(b.fecha) - parsearFechaVenta(a.fecha); });

  if(!saldadas.length){
    el.innerHTML = '<div class="card"><p style="color:#aaa;text-align:center;padding:20px">No hay facturas saldadas todavía</p></div>';
    return;
  }

  var resumen = document.createElement('div');
  resumen.style.cssText = 'background:var(--nbs-green-bg);border-radius:12px;padding:14px;margin-bottom:12px';
  resumen.innerHTML = '<div style="font-size:11px;color:var(--nbs-green-text);font-weight:500">✅ Facturas saldadas</div>'
    +'<div style="font-size:22px;font-weight:700;color:var(--nbs-green-text);margin-top:2px">'+saldadas.length+' factura(s)</div>';
  el.appendChild(resumen);

  saldadas.forEach(function(v){
    var cl = clientes.find(function(c){ return String(c.id)===String(v.cid); });
    var card = document.createElement('div');
    card.className = 'card';
    card.style.cssText = 'cursor:pointer;border:0.5px solid var(--nbs-line);border-left:3px solid var(--nbs-green-text);padding:14px';
    card.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center">'
      +'<div><div style="font-size:15px;font-weight:700">'+escaparHtml(cl?nombreCl(cl):v.cn)+'</div>'
      +'<div style="font-size:11px;color:#aaa;margin-top:2px">'+(v.numFactura?'#'+v.numFactura+' · ':'')+v.fecha+' · '+(v.tipo==='credito'?'A crédito':'Contado')+'</div></div>'
      +'<div style="text-align:right"><div style="font-size:16px;font-weight:700;color:var(--nbs-green-text)">$'+fmtNum(v.total)+'</div>'
      +'<div style="font-size:10px;color:var(--nbs-green-text)">✓ saldada</div></div></div>';
    card.onclick = (function(vid){ return function(){ verFacturaProfesional(vid); }; })(v.id);
    el.appendChild(card);
  });
}

function pintarCreditoAFavor(cid, saldoReal){
  var caja = document.getElementById('cxc-credito-favor');
  if(!caja) return;
  var cls = LS('ncl', []);
  var cl = cls.find(function(x){ return String(x.id) === String(cid); });
  var credito = cl ? (parseFloat(cl.creditoAFavor) || 0) : 0;

  if(credito <= 0.005 || saldoReal <= 0.005){
    caja.style.display = 'none';
    caja.innerHTML = '';
    return;
  }

  var seUsan = Math.min(credito, saldoReal);
  var sobra = Math.round((credito - seUsan) * 100) / 100;

  caja.style.display = 'block';
  caja.innerHTML =
    '<div style="background:#FFF8E1;border:2px solid #F9A825;border-radius:11px;padding:12px">'
  +   '<div style="font-size:11px;font-weight:800;color:#8D6E00;letter-spacing:.5px">ESTE CLIENTE TIENE A FAVOR</div>'
  +   '<div style="font-size:26px;font-weight:900;color:#E65100;line-height:1.1;margin:2px 0 6px">$' + fmtNum(credito) + '</div>'
  +   '<div style="font-size:12.5px;color:#6D4C00;line-height:1.45;margin-bottom:10px">'
  +     'Se van a usar <b>$' + fmtNum(seUsan) + '</b> para bajarle la deuda'
  +     (sobra > 0.005 ? '.<br>Le quedar\u00e1n <b>$' + fmtNum(sobra) + '</b> a favor.' : '.')
  +   '</div>'
    +   '<div style="font-size:11px;color:#6D4C00;font-weight:700;margin-bottom:3px">📅 ¿QUÉ DÍA SE LO APLICAS?</div>'
    +   '<input type="date" id="cred-fecha" style="width:100%;padding:9px;border:1px solid #E0C070;border-radius:8px;font-size:13px;margin-bottom:10px">'
  +   '<button onclick="usarCreditoAFavor(' + _arg(String(cid)) + ')" '
  +     'style="width:100%;padding:13px;background:#E65100;color:white;border:none;border-radius:10px;'
  +     'font-size:15px;font-weight:800;cursor:pointer">\ud83d\udcb3 Usar $' + fmtNum(seUsan) + ' de su cr\u00e9dito</button>'
  + '</div>';
  setTimeout(function(){ ponerHoyEnCampo('cred-fecha'); }, 0);   // 📅 -2 sep-
}

// Aplica el crédito como pago, de la factura MÁS VIEJA a la más nueva.
function fechaUSAaISO(f){
  try {
    var p = String(f).split('/');
    if(p.length === 3) return p[2] + '-' + p[0].padStart(2,'0') + '-' + p[1].padStart(2,'0');
  } catch(e){}
  return fechaHoyISO();
}
// Convierte 'YYYY-MM-DD' -> 'MM/DD/YYYY' (como guarda la app)
function fechaISOaUSA(iso){
  try {
    var p = String(iso).split('-');
    if(p.length === 3) return p[1] + '/' + p[2] + '/' + p[0];
  } catch(e){}
  return iso;
}

// Abre el formulario para corregir un pago. vid = id de la venta/factura, pidx = índice del pago.
function renderFilasEditPago(){
  var cont = document.getElementById('editor-pago-filas');
  if(!cont) return;
  var filas = window._editPagoMetodos || [];
  var opciones = { efectivo:'💵 Efectivo', cashapp:'📱 CashApp', zelle:'💸 Zelle' };
  cont.innerHTML = filas.map(function(m, i){
    return '<div style="display:flex;gap:6px;align-items:center;margin-bottom:6px">'
      +'<select onchange="fijarMetodoEditPago('+i+',this.value)" style="flex:1.2;min-width:0;padding:9px 6px;border:1px solid #ddd;border-radius:7px;font-size:13px">'
      + Object.keys(opciones).map(function(k){ return '<option value="'+k+'"'+(m.tipo===k?' selected':'')+'>'+opciones[k]+'</option>'; }).join('')
      +'</select>'
      +'<input type="text" inputmode="decimal" value="'+(m.monto||0).toFixed(2)+'" onfocus="this.select()" oninput="fijarMontoEditPago('+i+',this.value)" style="flex:1;width:70px;padding:9px;border:1px solid #ddd;border-radius:7px;font-size:14px;font-weight:700;text-align:right;box-sizing:border-box">'
      +(filas.length>1 ? '<button type="button" onclick="quitarFilaEditPago('+i+')" style="background:#FFEBEE;color:#C62828;border:none;border-radius:7px;width:34px;height:34px;font-size:15px;cursor:pointer;flex-shrink:0">✕</button>' : '')
      +'</div>';
  }).join('');
  actualizarTotalEditPago();
}

function agregarFilaEditPago(){
  window._editPagoMetodos.push({ tipo:'efectivo', monto:0 });
  renderFilasEditPago();
}
function quitarFilaEditPago(idx){
  window._editPagoMetodos.splice(idx, 1);
  renderFilasEditPago();
}
function fijarMetodoEditPago(idx, tipo){
  window._editPagoMetodos[idx].tipo = tipo;
}
function fijarMontoEditPago(idx, valor){
  window._editPagoMetodos[idx].monto = dinero(valor);
  actualizarTotalEditPago();
}
function actualizarTotalEditPago(){
  var filas = window._editPagoMetodos || [];
  var total = filas.reduce(function(s,m){ return s+(m.monto||0); }, 0);
  var el = document.getElementById('editor-pago-total');
  if(el) el.textContent = '$'+fmtNum(total);
}

// Editar un pago DESDE EL HISTORIAL del cliente (pedido por Sensei, 22 jul).
// Antes solo se podia desde Cuentas por Cobrar, y si el pago habia saldado la
// factura el cliente ya no aparecia ahi. Ahora tambien se llega desde el
// historial: cierra el historial, entra a la pantalla de pagos de ese cliente
// -que si lista las facturas saldadas- y abre el editor de ese pago exacto.
function editarPagoDesdeHistorial(cid, vid, pidx){
  try{ cerrarHistorial(); }catch(e){}
  irACobrarCliente(cid);
  setTimeout(function(){ abrirEditorPago(vid, pidx); }, 450);
}

function borrarPagoDesdeEditor(vid, pidx){
  ventas = LS('nv', []);
  // 🔴 Comparar como TEXTO en los dos lados: los botones pasan el id como texto
  // (con _arg) y aquí se comparaba con === estricto contra un número, así que
  // nunca encontraba el pago. Sensei lo cazó con una foto. -15 ago-
  var vf = ventas.find(function(x){ return String(x.id) === String(vid); });
  if(!vf || !vf.pagosFactura || vf.pagosFactura[pidx] === undefined){ alert('No se encontró el pago.'); return; }
  var monto = vf.pagosFactura[pidx].monto || 0;
  if(!confirm('¿Borrar este pago de $'+fmtNum(monto)+'? El saldo del cliente volverá a subir por ese monto.')) return;
  // Borrar un pago toca el dinero del cliente: se pide la huella antes de hacerlo.
  protegerConHuella(function(){
    ventas = LS('nv', []);
    var vf2 = ventas.find(function(x){ return String(x.id) === String(vid); });
    if(!vf2 || !vf2.pagosFactura || vf2.pagosFactura[pidx] === undefined){ alert('No se encontró el pago.'); return; }
    vf2.pagosFactura.splice(pidx, 1);
    SS('nv', ventas);
    cerrarEditorPago();
    abrirAbono(cxcClienteId);
    alert('Pago borrado. El saldo se actualizó.');
  });
}

var METODOS_PAGO_LABELS = { efectivo:'💵 Efectivo', cashapp:'📱 CashApp', zelle:'💸 Zelle', credito_cliente:'🎁 Crédito del cliente', tarjeta:'💳 Tarjeta (anterior)' };

// 💳 LAS CUATRO FORMAS CON LAS QUE SENSEI LE PAGA A SUS SUPLIDORES -19 ago-.
// Va aparte de METODOS_PAGO_LABELS a proposito: en las VENTAS la tarjeta esta marcada como
// "anterior" porque sus clientes ya no le pagan asi, pero a los SUPLIDORES si les paga con
// tarjeta de credito. Tocar la lista de ventas para esto habria cambiado lo que ven sus
// clientes sin motivo.
var METODOS_PAGO_COMPRA = [
  { tipo:'tarjeta',  texto:'💳 Tarjeta', color:'#1565C0' },
  { tipo:'efectivo', texto:'💵 Cash',    color:'#2E7D32' },
  { tipo:'zelle',    texto:'🏦 Zelle',   color:'#6A1B9A' },
  { tipo:'cashapp',  texto:'📱 CashApp', color:'#00838F' }
];

function comoPagoElCobro(g){
  var porTipo = {};
  g.partes.forEach(function(p){
    if(p.metodos && p.metodos.length){
      p.metodos.forEach(function(m){
        if(!m || !m.monto) return;
        var et = (typeof METODOS_PAGO_LABELS !== 'undefined' && METODOS_PAGO_LABELS[m.tipo]) ? METODOS_PAGO_LABELS[m.tipo] : m.tipo;
        porTipo[et] = Math.round(((porTipo[et] || 0) + m.monto) * 100) / 100;
      });
    } else if(p.metodo){
      var et2 = (p.metodo === 'credito_cliente') ? 'Crédito a favor' : p.metodo;
      porTipo[et2] = Math.round(((porTipo[et2] || 0) + p.monto) * 100) / 100;
    }
  });
  var claves = Object.keys(porTipo);
  if(!claves.length) return '';
  return claves.map(function(k){ return k + ' $' + fmtNum(porTipo[k]); }).join(' · ');
}

function toggleCobroEstado(clave){
  window._cobroAbierto = (window._cobroAbierto === clave) ? null : clave;
  pintarEstadoDeCuenta();
}

function _pagoEsDeHoy(fecha){
  return String(fecha || '') === fechaHoy();
}

function mandarComprobanteDeEstePago(clave, completo){
  var cid = window._estadoCuentaCid;
  if(!cid) return;
  var cobros = cobrosDelCliente(cid);
  var g = null;
  for(var i = 0; i < cobros.length; i++){ if(cobros[i].clave === clave) g = cobros[i]; }
  if(!g){ alert('No encontré ese pago.'); return; }

  var texto;
  if(completo){
    var detalle = (g.partes.length > 1)
      ? g.partes.map(function(p){ return { monto: p.monto, fecha: p.fechaFactura }; })
      : null;
    texto = textoDeUnPago(cid, g, detalle);
  } else {
    texto = textoCortoParaCliente(cid, g.montoCobro);
  }

  // 🔑 Se le avisa de algo importante: el balance que sale es el de HOY, no el de aquel
  // día. Si no se dice, se abre otra confusión igual a la que veníamos arreglando.
  if(!confirm('Se le va a mandar esto:\n\n' + texto
    + '\n\n⚠️ El balance que sale es el de HOY, no el de aquel día.\n\n¿Mandarlo?')) return;
  mandarloAlCliente(cid, texto, 'Comprobante');
}

// El mensaje largo de un pago concreto: igual que el de después de cobrar, pero con la
// FECHA de aquel pago y su número de recibo.
function textoDeUnPago(cid, g, detalleFacturas){
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
  t.push('');
  t.push('Hola Sr. ' + (c.nombre || nombreCl(c)) + ' 👋');
  t.push('');
  t.push('✅ Recibí tu pago de *$' + fmtNum(g.montoCobro) + '*');
  t.push('📅 ' + g.fecha + (g.hora ? ' · ' + g.hora : ''));
  if(g.recibo) t.push('🧾 Recibo ' + g.recibo);
  var como = comoPagoElCobro(g);
  if(como) t.push('💵 ' + como);
  if(detalleFacturas && detalleFacturas.length > 1){
    t.push('');
    t.push('Lo apliqué así:');
    detalleFacturas.forEach(function(d){
      t.push('   • $' + fmtNum(d.monto) + ' → factura del ' + d.fecha);
    });
  }
  t.push('');
  t.push('━━━━━━━━━━━━━━━');
  if(debe > 0.005) t.push('*Tu balance hoy: $' + fmtNum(debe) + '*');
  else t.push('*Tu balance: $0.00 — al día* ✅');
  if(aFavor > 0.005) t.push('Tienes $' + fmtNum(aFavor) + ' a favor para tu próxima compra.');
  t.push('━━━━━━━━━━━━━━━');
  t.push('');
  t.push('Si algo no te cuadra, dímelo y lo revisamos juntos. 🙏');
  return t.join('\n');
}

function _copiarTexto(texto){
  try {
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(String(texto || ''));
      return true;
    }
  } catch(e){}
  // Camino viejo, para navegadores que no tienen el moderno
  try {
    var ta = document.createElement('textarea');
    ta.value = String(texto || '');
    ta.style.cssText = 'position:fixed;top:-999px;left:-999px';
    document.body.appendChild(ta);
    ta.select();
    var ok = document.execCommand('copy');
    ta.remove();
    return !!ok;
  } catch(e){ return false; }
}

// El teléfono del cliente, limpio y con el 1 delante si hace falta.
function mandarSuBalance(cid, completo){
  clientes = LS('ncl', []);
  var c = clientes.find(function(x){ return String(x.id) === String(cid); });
  if(!c){ avisoGrande('No encontr\u00e9 ese cliente.'); return; }

  var texto = '';
  try {
    if(completo){
      texto = textoEstadoDeCuenta(cid);
    } else {
      // \ud83d\udd11 El mismo mensaje de siempre. Se le pasa 0 porque aqu\u00ed NO se le acaba de
      // cobrar: as\u00ed nombra su \u00daLTIMO pago con su fecha, en vez de decir "pago de hoy".
      texto = textoCortoParaCliente(cid, 0);
    }
  } catch(e){ avisoGrande('No pude armar el mensaje.'); return; }

  comoMandarloAlCliente(cid, texto, completo ? 'Estado de cuenta' : 'Balance');
}

function cerrarComoMandar(){
  var ov = document.getElementById('como-mandar-overlay');
  if(ov) ov.style.display = 'none';
}

// El teléfono con formato, para que se lea bien
function fmtTelTexto(tel){
  var t = String(tel || '').replace(/[^0-9]/g, '');
  if(t.length === 11 && t[0] === '1') t = t.slice(1);
  if(t.length !== 10) return String(tel || '');
  return '+1 (' + t.slice(0, 3) + ') ' + t.slice(3, 6) + '-' + t.slice(6);
}

function cambiarModoWhatsApp(){
  var pegando = (LS('nbs_wa_pegar', '0') === '1');
  var msg = pegando
    ? 'Ahora mismo la app COPIA el mensaje y abre el chat vac\u00edo, para que lo pegues.\n\n'
      + '\u00bfVolver a mandarlo directo -sin pegar-?'
    : 'Ahora mismo la app manda el mensaje DIRECTO al chat.\n\n'
      + 'Si te est\u00e1 abriendo la p\u00e1gina web de WhatsApp en vez del Business, cambia a '
      + 'COPIAR Y PEGAR: la app copia el mensaje, abre el chat y t\u00fa lo pegas.\n\n\u00bfCambiar?';
  if(!confirm(msg)) return;
  SS('nbs_wa_pegar', pegando ? '0' : '1');
  avisoGrande(pegando
    ? '\u2705 Los mensajes se mandan directo otra vez.'
    : '\u2705 Ahora la app copia el mensaje y abre el chat.\n\nMant\u00e9n el dedo en la casilla y dale PEGAR.');
}

function horaAhora(){
  try { return new Date().toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit', hour12:true }); }
  catch(e){ return ''; }
}

function obtenerOpcionesMetodoPago(vid){
  // Sensei pidio poder usar el credito tambien al cobrar pedidos rapidos,
  // no solo en una venta nueva. -31 jul-
  var opciones = { efectivo: METODOS_PAGO_LABELS.efectivo, cashapp: METODOS_PAGO_LABELS.cashapp, zelle: METODOS_PAGO_LABELS.zelle };
  // ═══ EL CRÉDITO A FAVOR, EN TODOS LOS SITIOS (31 jul) ═══
  // Antes solo salía al hacer una VENTA NUEVA (vid === 'vini'). Sensei pidió poder
  // usarlo también al cobrar un pedido rápido o al aplicar un pago. Ahora se busca
  // el cliente de dos formas: si es venta nueva, del selector de la pantalla; si es
  // una factura, del cliente de esa factura.
  var cidCredito = null;
  if(vid === 'vini'){
    var clEl = document.getElementById('vcl');
    cidCredito = clEl ? parseInt(clEl.value) : null;
  } else {
    try {
      var vv = LS('nv', []).find(function(x){ return String(x.id) === String(vid); });
      if(vv) cidCredito = vv.cid;
    } catch(e){}
  }
  if(cidCredito){
    var clientesLocal = LS('ncl', []);
    var cl = clientesLocal.find(function(c){ return String(c.id) === String(cidCredito); });
    if(cl && (cl.creditoAFavor||0) > 0.005){
      // Texto CORTO a proposito: el largo estiraba la fila y sacaba el monto de la
        // pantalla del telefono. -31 jul, lo encontro Sensei-
        opciones.credito_cliente = '🎁 Crédito ($'+fmtNum(cl.creditoAFavor)+')';
    }
  }
  return opciones;
}

function renderMetodosPago(vid){
  var cont = document.getElementById('pago-metodos-'+vid);
  if(!cont) return;
  var filas = window._pagoMetodos[vid] || [];
  var opciones = obtenerOpcionesMetodoPago(vid);
  cont.innerHTML = filas.map(function(m, i){
    return '<div style="display:flex;gap:6px;align-items:center;margin-bottom:6px">'
      +'<select onchange="actualizarMetodoPago(\''+vid+'\','+i+',\'tipo\',this.value)" style="flex:1.2;min-width:0;padding:8px 6px;border:1px solid #ddd;border-radius:6px;font-size:12px">'
      +Object.keys(opciones).map(function(k){ return '<option value="'+k+'"'+(m.tipo===k?' selected':'')+'>'+opciones[k]+'</option>'; }).join('')
      +'</select>'
      +'<input type="text" inputmode="numeric" value="'+m.monto.toFixed(2)+'" onfocus="this.select()" oninput="formatoMoneda(this);actualizarMetodoPago(\''+vid+'\','+i+',\'monto\',dinero(this.value)||0)" style="width:80px;padding:8px 6px;border:1px solid #ddd;border-radius:6px;font-size:12px;text-align:center">'
      +(filas.length>1 ? '<button type="button" onclick="quitarMetodoPago(\''+vid+'\','+i+')" style="background:var(--nbs-red-bg);color:var(--nbs-red-dark);border:none;border-radius:8px;width:38px;height:38px;cursor:pointer;font-size:14px">✕</button>' : '')
      +'</div>';
  }).join('');
  actualizarTotalPago(vid);
}

function agregarMetodoPago(vid){
  window._pagoMetodos[vid].push({tipo:'efectivo', monto:0});
  renderMetodosPago(vid);
}

function quitarMetodoPago(vid, idx){
  window._pagoMetodos[vid].splice(idx, 1);
  renderMetodosPago(vid);
}

function actualizarMetodoPago(vid, idx, campo, valor){
  // El campo 'monto' viene de una casilla de dinero: puede traer coma. El 'tipo' es texto.
  window._pagoMetodos[vid][idx][campo] = (campo === 'monto') ? dinero(valor) : valor;
  actualizarTotalPago(vid);
}

function actualizarTotalPago(vid){
  var filas = window._pagoMetodos[vid] || [];
  var total = filas.reduce(function(s,m){ return s+(m.monto||0); }, 0);
  var el = document.getElementById('pago-total-'+vid);
  if(el) el.textContent = '$'+fmtNum(total);
}

// ═══════════════════════════════════════════════════════════════════════════════
//   EL SOBRANTE DE UN PAGO VA A LA FACTURA MAS VIEJA
// ═══════════════════════════════════════════════════════════════════════════════
// ANTES: si le aplicabas $20 a una factura que debia $5, los $20 COMPLETOS se metian en
// esa factura. Su saldo quedaba en -$15, pero se mostraba $0 -el negativo se escondia-, y
// los $15 de sobra NO bajaban la deuda de las otras facturas. El balance total del cliente
// si cuadraba, pero las facturas una por una mentian.
// AHORA: $5 cierran esa factura, y los $15 se aplican solos a la factura MAS VIEJA que
// deba, y si sobra sigue con la siguiente mas vieja. Asi la deuda antigua se limpia primero.

// Devuelve las otras facturas del cliente que deben, ordenadas de la MAS VIEJA a la mas nueva
function descontarCreditoUsado(cid, filas){
  var usado = 0;
  (filas || []).forEach(function(f){
    if(f && f.tipo === 'credito_cliente') usado += (parseFloat(f.monto) || 0);
  });
  if(usado <= 0.005) return 0;

  var cls = LS('ncl', []);
  var i = cls.findIndex(function(c){ return String(c.id) === String(cid); });
  if(i < 0) return 0;

  var tenia = parseFloat(cls[i].creditoAFavor) || 0;
  var seUsa = Math.min(tenia, usado);
  cls[i].creditoAFavor = Math.round((tenia - seUsa) * 100) / 100;
  SS('ncl', cls);
  clientes = LS('ncl', []);

  if(usado > tenia + 0.005){
    setTimeout(function(){
      avisoGrande('\u26a0\ufe0f Se marcaron $' + fmtNum(usado) + ' de cr\u00e9dito, pero el cliente'
        + ' solo ten\u00eda $' + fmtNum(tenia) + '.\n\nRevisa ese pago.');
    }, 800);
  }
  return seUsa;
}


function abrirArreglarMayusculas(){
  loadProds();
  var cambios = [];
  productos.forEach(function(p){
    var m = String(p.marca || '').trim();
    if(!m) return;
    var bonita = marcaBonita(m);
    if(bonita && bonita !== m) cambios.push({ de: m, a: bonita });
  });
  // Agrupar para enseñárselo
  var vistos = {};
  cambios.forEach(function(c){
    var k = c.de + '\u2192' + c.a;
    vistos[k] = (vistos[k] || 0) + 1;
  });
  var lista = Object.keys(vistos).map(function(k){
    var p = k.split('\u2192');
    return { de: p[0], a: p[1], cuantos: vistos[k] };
  }).sort(function(a, b){ return b.cuantos - a.cuantos; });

  var ov = document.getElementById('unif-marcas-ov');
  if(!ov){
    ov = document.createElement('div');
    ov.id = 'unif-marcas-ov';
    document.body.appendChild(ov);
  }
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:99997;'
    + 'overflow-y:auto;padding:18px 14px';

  var h = '<div style="max-width:460px;margin:0 auto;background:#fff;border-radius:14px;padding:18px">';
  h += '<div style="font-size:18px;font-weight:900;margin-bottom:4px">'
    + '\u{1F524} Marcas con may\u00fascula solo al principio</div>';
  if(!lista.length){
    h += '<div style="font-size:13px;color:var(--nbs-muted);margin:14px 0">'
      + '\u2705 <b>Ya est\u00e1n todas bien escritas.</b></div>';
    h += '<button onclick="cerrarUnificarMarcas()" class="btn" style="width:100%;margin:0;'
      + 'background:#F0F0F5;color:#333">Cerrar</button></div>';
    ov.innerHTML = h;
    return;
  }
  h += '<div style="font-size:12.5px;color:var(--nbs-muted);line-height:1.55;margin-bottom:13px">'
    + '\u{1F512} <b>No se toca ning\u00fan precio ni ninguna factura</b> \u2014 solo c\u00f3mo se escribe '
    + 'la marca.</div>';
  h += '<div style="max-height:320px;overflow-y:auto;margin-bottom:13px">';
  lista.forEach(function(c){
    h += '<div style="display:flex;align-items:center;gap:8px;padding:7px 10px;'
      + 'border-bottom:1px solid var(--nbs-line);font-size:13px">'
      + '<span style="flex:1;color:var(--nbs-muted)">' + escaparHtml(c.de) + '</span>'
      + '<span style="color:#BBB">\u2192</span>'
      + '<span style="flex:1;font-weight:900">' + escaparHtml(c.a) + '</span>'
      + '<span style="font-size:11px;color:var(--nbs-muted)">' + c.cuantos + '</span>'
      + '</div>';
  });
  h += '</div>';
  h += '<button onclick="aplicarArreglarMayusculas()" class="btn" style="width:100%;margin:0 0 8px;'
    + 'background:var(--nbs-green-text);color:#fff;font-weight:900;padding:14px">'
    + '\u2705 S\u00ed, arreglarlas</button>';
  h += '<button onclick="cerrarUnificarMarcas()" class="btn" style="width:100%;margin:0;'
    + 'background:#F0F0F5;color:#333">Ahora no</button></div>';
  ov.innerHTML = h;
}

function aplicarArreglarMayusculas(){
  protegerConHuella(function(){
    var P = LS('np', []);
    var n = 0;
    P.forEach(function(p){
      var m = String(p.marca || '').trim();
      if(!m) return;
      var bonita = marcaBonita(m);
      if(bonita && bonita !== p.marca){ p.marca = bonita; n++; }
    });
    SS('np', P);
    PRODS = []; loadProds();
    try { marcarPendienteDeSubir('np'); } catch(e){}
    cerrarUnificarMarcas();
    avisoGrande('\u2705 Listo. Se arreglaron ' + n + ' producto(s).\n\n'
      + 'Ning\u00fan precio ni ninguna factura se toc\u00f3.');
    try { if(typeof renderCatalogo === 'function') renderCatalogo(); } catch(e){}
  });
}

function agruparPosiblesDuplicados(listaClientes){
  var padre = {};
  function raiz(id){ if(padre[id]===undefined) padre[id]=id; while(padre[id]!==id){ id=padre[id]; } return id; }
  function unir(a,b){ var ra=raiz(a), rb=raiz(b); if(ra!==rb) padre[ra]=rb; }
  listaClientes.forEach(function(c){ raiz(c.id); });

  // \ud83d\udd11 EL MISMO NOMBRE NO BASTA -6 sep-. Dos barberos pueden llamarse igual y no
  // tener nada que ver: distinto negocio, distinta direccion, distinto telefono.
  // Se juntan solo si comparten TELEFONO, o si ademas del nombre comparten el negocio
  // o la direccion.
  var porTel = {}, porNegocio = {}, porDir = {};
  listaClientes.forEach(function(c){
    // \u260e\ufe0f El telefono manda: dos fichas con el mismo numero son la misma persona.
    var tel = (c.tel||'').replace(/\D/g,'');
    if(tel && tel.length >= 7){
      if(porTel[tel]) unir(c.id, porTel[tel]);
      else porTel[tel] = c.id;
    }
    var nom = normalizarTextoBusqueda((c.nombre||'')+' '+(c.apellido||''));
    if(!nom) return;
    // \ud83c\udfea Mismo nombre Y mismo negocio
    var neg = normalizarTextoBusqueda(c.negocio||'');
    if(neg){
      var kN = nom + '|' + neg;
      if(porNegocio[kN]) unir(c.id, porNegocio[kN]);
      else porNegocio[kN] = c.id;
    }
    // \ud83d\udccd Mismo nombre Y misma direccion
    var dir = normalizarTextoBusqueda(c.dir||'');
    if(dir){
      var kD = nom + '|' + dir;
      if(porDir[kD]) unir(c.id, porDir[kD]);
      else porDir[kD] = c.id;
    }
    // Si no tiene NI negocio NI direccion NI telefono, el nombre es lo unico que hay
    if(!neg && !dir && !tel){
      if(porNegocio['solo|' + nom]) unir(c.id, porNegocio['solo|' + nom]);
      else porNegocio['solo|' + nom] = c.id;
    }
  });

  var grupos = {};
  listaClientes.forEach(function(c){
    var r = raiz(c.id);
    if(!grupos[r]) grupos[r] = [];
    grupos[r].push(c);
  });
  return grupos;
}

function abrirMenuAccionesFactura(vid){
  var overlay = document.getElementById('fact-acciones-overlay');
  if(!overlay){
    overlay = document.createElement('div');
    overlay.id = 'fact-acciones-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:999998;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);display:flex;align-items:flex-end';
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = '';
  overlay.onclick = function(e){ if(e.target === overlay) overlay.style.display = 'none'; };

  var sheet = document.createElement('div');
  sheet.style.cssText = 'background:white;width:100%;max-width:480px;margin:0 auto;border-radius:16px 16px 0 0;padding:16px;box-shadow:0 -4px 20px rgba(0,0,0,0.15)';

  var titulo = document.createElement('div');
  titulo.style.cssText = 'text-align:center;font-size:13px;color:#aaa;font-weight:700;text-transform:uppercase;margin-bottom:12px';
  titulo.textContent = 'Compartir / Imprimir';
  sheet.appendChild(titulo);

  var opciones = [
    ['🖨️ Imprimir (texto)', '#1565C0', function(){ imprimirFacturaBT(vid); }],
    ['🎨 Imprimir (diseño)', '#6A1B9A', function(){ imprimirFacturaDiseno(vid); }],
    ['📤 Enviar al cliente', '#2E7D32', function(){ compartirFactura(vid); }]
  ];
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

function renderFacturas(q){
  ventas = LS('nv', []);
  clientes = LS('ncl', []);
  var el = document.getElementById('fact-lista');
  if(!el) return;
  el.innerHTML = '';

  var lista = ventas.filter(function(v){ return !v.cancelada; });
  if(q && q.trim()){
    var ql = q.toLowerCase();
    lista = lista.filter(function(v){
      var cl = clientes.find(function(c){ return String(c.id)===String(v.cid); });
      var extra = cl ? ((cl.apodo||'')+' '+(cl.negocio||'')+' '+(cl.tel||'')+' '+(cl.dir||'')+' '+(cl.ciudad||'')+' '+(cl.contacto||'')+' '+(cl.contactoApodo||'')+' '+(cl.contactoTel||'')) : '';
      return ((v.cn||'')+' '+extra).toLowerCase().indexOf(ql) >= 0;
    });
  }

  // Filtro por rango de fechas
  var elDesde = document.getElementById('fact-desde');
  var elHasta = document.getElementById('fact-hasta');
  var desde = elDesde && elDesde.value ? new Date(elDesde.value+'T00:00:00') : null;
  var hasta = elHasta && elHasta.value ? new Date(elHasta.value+'T23:59:59') : null;
  if(desde || hasta){
    lista = lista.filter(function(v){
      var f = parsearFechaVenta(v.fecha);
      if(desde && f < desde) return false;
      if(hasta && f > hasta) return false;
      return true;
    });
  }

  if(!lista.length){
    el.innerHTML = '<p style="color:#aaa;text-align:center;padding:20px">Sin facturas encontradas</p>';
    return;
  }

  // Calcular totales generales (sobre la lista filtrada/buscada actual)
  var totalGeneral = 0;
  var totalPendiente = 0;
  var countAbiertas = 0;
  lista.forEach(function(v){
    var pagadoT = v.tipo==='credito' ? (v.pagosFactura ? (v.pagosFactura || []).filter(function(p){return typeof p.monto==='number';}).reduce(function(s,p){return s+p.monto;},0) : 0) : v.total;
    var saldoT = Math.max(0, v.total - pagadoT);
    totalGeneral += v.total;
    if(saldoT > 0){ totalPendiente += saldoT; countAbiertas++; }
  });
  var resumenTotales = document.createElement('div');
  resumenTotales.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px';
  resumenTotales.innerHTML = '<div style="background:var(--nbs-gold-bg);border-radius:12px;padding:14px;text-align:center">'
    +'<div style="font-size:11px;font-weight:500;color:var(--nbs-gold)">Total general</div>'
    +'<div style="font-size:20px;font-weight:500;color:var(--nbs-gold-dark);margin-top:4px">$'+fmtNum(totalGeneral)+'</div>'
    +'<div style="font-size:11px;color:var(--nbs-gold);margin-top:2px">'+lista.length+' factura(s)</div>'
    +'</div>'
    +'<div style="background:'+(totalPendiente>0?'var(--nbs-red-bg)':'var(--nbs-green-bg)')+';border-radius:12px;padding:14px;text-align:center">'
    +'<div style="font-size:11px;font-weight:500;color:'+(totalPendiente>0?'var(--nbs-red-text)':'var(--nbs-green-text)')+'">Facturas abiertas</div>'
    +'<div style="font-size:20px;font-weight:500;color:'+(totalPendiente>0?'var(--nbs-red-dark)':'var(--nbs-green-text)')+';margin-top:4px">$'+fmtNum(totalPendiente)+'</div>'
    +'<div style="font-size:11px;color:'+(totalPendiente>0?'var(--nbs-red-text)':'var(--nbs-green-text)')+';margin-top:2px">'+countAbiertas+' factura(s)</div>'
    +'</div>';
  el.appendChild(resumenTotales);

  var elOrden = document.getElementById('fact-orden');
  var orden = elOrden ? elOrden.value : 'fecha-desc';

  if(orden === 'monto-desc' || orden === 'monto-asc'){
    // Lista simple, factura por factura, ordenada estrictamente por su propio monto (sin agrupar)
    lista.sort(function(a,b){ return orden==='monto-desc' ? b.total-a.total : a.total-b.total; });
    lista.forEach(function(v){ el.appendChild(crearTarjetaFactura(v)); });
  } else if(orden === 'ranking-clientes'){
    // Agrupar por CLIENTE, sumar su total, y ordenar los clientes de mayor a menor gasto acumulado
    var porCliente = {};
    lista.forEach(function(v){
      var key = v.cid || ('sin-cliente-'+v.cn);
      if(!porCliente[key]) porCliente[key] = { nombre: v.cn, cid: v.cid, facturas: [], total: 0 };
      porCliente[key].facturas.push(v);
      porCliente[key].total += v.total;
    });
    var gruposCliente = Object.keys(porCliente).map(function(k){ return porCliente[k]; });
    gruposCliente.sort(function(a,b){ return b.total-a.total; });

    gruposCliente.forEach(function(grupo, gi){
      var clForGrupo = clientes.find(function(x){return String(x.id)===String(grupo.cid);});
      var negForGrupo = clForGrupo && clForGrupo.negocio ? clForGrupo.negocio.trim() : '';
      var rankHeader = document.createElement('div');
      rankHeader.style.cssText = 'display:flex;align-items:center;gap:10px;margin:'+(gi===0?'0':'18px')+' 0 8px';
      rankHeader.innerHTML = '<div style="width:28px;height:28px;border-radius:50%;background:var(--nbs-ink);color:white;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;flex-shrink:0">#'+(gi+1)+'</div>'
        +'<div style="flex:1"><div style="font-size:14px;font-weight:700;color:var(--nbs-ink)">'+grupo.nombre+(negForGrupo?' <span style="font-weight:400;color:var(--nbs-muted);font-size:12px">· 🏪'+negForGrupo+'</span>':'')+'</div></div>'
        +'<div style="text-align:right"><div style="font-size:16px;font-weight:800;color:var(--nbs-gold-dark)">$'+fmtNum(grupo.total)+'</div><div style="font-size:10px;color:var(--nbs-muted)">'+grupo.facturas.length+' factura(s)</div></div>';
      el.appendChild(rankHeader);

      grupo.facturas.sort(function(a,b){ return parsearFechaVenta(b.fecha) - parsearFechaVenta(a.fecha); });
      grupo.facturas.forEach(function(v){ el.appendChild(crearTarjetaFactura(v)); });
    });
  } else {
    // Agrupar por DIA
    lista.sort(function(a,b){ return orden==='fecha-asc' ? parsearFechaVenta(a.fecha)-parsearFechaVenta(b.fecha) : parsearFechaVenta(b.fecha)-parsearFechaVenta(a.fecha); });
    var porDia = {};
    var ordenDias = [];
    lista.forEach(function(v){
      if(!porDia[v.fecha]){ porDia[v.fecha] = []; ordenDias.push(v.fecha); }
      porDia[v.fecha].push(v);
    });

    ordenDias.forEach(function(dia, di){
      var totalDia = porDia[dia].reduce(function(s,v){ return s+v.total; }, 0);
      var diaHeader = document.createElement('div');
      diaHeader.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin:'+(di===0?'0':'18px')+' 0 8px;padding-bottom:6px;border-bottom:1.5px solid var(--nbs-ink)';
      diaHeader.innerHTML = '<span style="font-size:13px;font-weight:800;color:var(--nbs-ink)">📅 '+dia+'</span>'
        +'<span style="font-size:12px;font-weight:700;color:var(--nbs-gold-dark)">$'+fmtNum(totalDia)+' · '+porDia[dia].length+' factura(s)</span>';
      el.appendChild(diaHeader);
      porDia[dia].forEach(function(v){ el.appendChild(crearTarjetaFactura(v)); });
    });
  }
}

function crearTarjetaFactura(v){
    var pagado = v.tipo==='credito' ? (v.pagosFactura ? (v.pagosFactura || []).filter(function(p){return typeof p.monto==='number';}).reduce(function(s,p){return s+p.monto;},0) : 0) : v.total;
    pagado = cobradoYDebeDe(v).cobrado;
    var saldo = cobradoYDebeDe(v).debe;
    var numFact = v.numFactura || String(v.id).slice(-6);
    var clForCard = clientes.find(function(x){return String(x.id)===String(v.cid);});
    var negForCard = clForCard && clForCard.negocio ? clForCard.negocio.trim() : '';
    var dirForCard = clForCard ? ((clForCard.dir||'')+(clForCard.ciudad?', '+clForCard.ciudad:'')).trim() : '';

    var card = document.createElement('div');
    card.className = 'card';
    card.style.cssText = 'margin-bottom:10px;border:0.5px solid var(--nbs-line);border-radius:12px;box-shadow:var(--nbs-shadow-card);background:white;padding:16px';

    // Header de la card
    var header = '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">'
      +'<div style="display:flex;gap:10px">'
      +'<div style="width:38px;height:38px;border-radius:10px;background:var(--nbs-gold-bg);display:flex;align-items:center;justify-content:center;flex-shrink:0">'
      +'<span style="font-size:13px;font-weight:700;color:var(--nbs-gold-dark)">'+ini((clForCard&&clForCard.nombre)||v.cn,(clForCard&&clForCard.apellido)||'')+'</span>'
      +'</div>'
      +'<div>'
      +'<div style="font-size:16px;font-weight:700;color:var(--nbs-ink)">'+nombreVentaCliente(v)+'</div>'
      +(negForCard ? '<div style="font-size:12px;color:var(--nbs-muted);margin-top:1px;display:flex;align-items:center;gap:4px">🏪'+negForCard+'</div>' : '')
      +(dirForCard ? '<div style="font-size:11px;color:var(--nbs-muted-2);margin-top:1px">📍 '+dirForCard+' <span style="opacity:0.6">(uso interno)</span></div>' : '')
      +'<div style="font-size:11px;color:var(--nbs-muted-2);margin-top:3px">'+v.fecha+' · '+v.hora+' · #'+numFact+'</div>'
      +'</div></div>'
      +'<div style="text-align:right">'
      +'<div style="font-size:17px;font-weight:500;color:var(--nbs-ink)">$'+fmtNum(v.total)+'</div>'
      +'<div style="font-size:11px;font-weight:500;margin-top:4px;color:'+(v.tipo==='credito'?'var(--nbs-gold)':'var(--nbs-green-text)')+';background:'+(v.tipo==='credito'?'var(--nbs-gold-bg)':'var(--nbs-green-bg)')+';padding:2px 8px;border-radius:20px;display:inline-block">'+(v.tipo==='credito'?'A crédito':'Contado')+'</div>'
      +(esSaldoPendiente(saldo)?'<div style="font-size:11px;color:var(--nbs-red-text);font-weight:500;margin-top:4px">Saldo: $'+fmtNum(saldo)+'</div>':'<div style="font-size:11px;color:var(--nbs-green-text);font-weight:500;margin-top:4px;display:flex;align-items:center;gap:3px;justify-content:flex-end">✓Pagado</div>')
      +'</div></div>';

    // Items resumidos
    var items = '<div style="font-size:12px;color:var(--nbs-muted);border-top:0.5px solid var(--nbs-line);padding-top:10px;margin-bottom:10px">'
      +(v.items || []).map(function(it){ return '<span style="display:inline-block;background:#F7F7F8;color:var(--nbs-muted);border-radius:6px;padding:3px 8px;margin:2px 4px 2px 0;font-size:11px">'+escaparHtml(it.nombre)+' x'+it.cant+'</span>'; }).join('')
      +'</div>';

    // Botones de acción
    var btnsDiv = document.createElement('div');
    btnsDiv.style.cssText = 'display:flex;gap:8px';
    [['👁️','Ver',true,verFacturaProfesional],['📤','Compartir',false,abrirMenuAccionesFactura]].forEach(function(b){
      var btn = document.createElement('button');
      btn.innerHTML = '<span style="font-size:15px">'+b[0]+'</span>'+b[1];
      var esPrincipal = b[2];
      btn.style.cssText = 'flex:1;padding:9px;background:'+(esPrincipal?'var(--nbs-gold-bg)':'#F0F0F2')+';color:'+(esPrincipal?'var(--nbs-gold-dark)':'var(--nbs-ink)')+';border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:6px';
      btn.onclick = (function(fn,id){ return function(){ fn(id); }; })(b[3], v.id);
      btnsDiv.appendChild(btn);
    });
    card.innerHTML = header + items;
    card.appendChild(btnsDiv);
    return card;
}

function verFacturaProfesional(vid){
  ventas = LS('nv', []);
  clientes = LS('ncl', []);
  var v = ventas.find(function(x){ return String(x.id)===String(vid); });
  if(!v) return;
  var cl = clientes.find(function(c){ return String(c.id)===String(v.cid); });
  var pagado = v.tipo==='credito' ? (v.pagosFactura ? (v.pagosFactura || []).filter(function(p){return typeof p.monto==='number';}).reduce(function(s,p){return s+p.monto;},0) : 0) : v.total;
  pagado = cobradoYDebeDe(v).cobrado;
  var saldo = cobradoYDebeDe(v).debe;
  var numFact = v.numFactura || String(v.id).slice(-6);

  var overlay = document.getElementById('factura-view-overlay');
  if(!overlay){
    overlay = document.createElement('div');
    overlay.id = 'factura-view-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:white;z-index:99999;overflow-y:auto;padding:16px';
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = '';

  // Nota de impresión
  var nota = document.createElement('div');
  nota.className = 'no-print';
  nota.style.cssText = 'font-size:11px;color:#E65100;text-align:center;margin-bottom:8px;background:#FFF3E0;padding:6px;border-radius:8px;max-width:400px;margin-left:auto;margin-right:auto';
  nota.textContent = '💡 Para imprimir usa el botón 🖨️ directamente desde la lista de facturas';
  overlay.appendChild(nota);

  // Botones de acción (no se imprimen)
  var headerFactura = document.createElement('div');
  headerFactura.className = 'no-print';
  headerFactura.style.cssText = 'display:flex;justify-content:flex-end;margin-bottom:8px;max-width:400px;margin-left:auto;margin-right:auto';
  var iconoNBS2 = document.createElement('img');
  iconoNBS2.src = 'icon-512.png';
  iconoNBS2.style.cssText = 'width:32px;height:32px;border-radius:8px;cursor:pointer';
  iconoNBS2.alt = 'NBS';
  iconoNBS2.onclick = function(){ overlay.style.display='none'; ir('p-inicio'); };
  headerFactura.appendChild(iconoNBS2);
  overlay.appendChild(headerFactura);

  var actBtns = document.createElement('div');
  actBtns.className = 'no-print';
  actBtns.style.cssText = 'display:flex;gap:8px;margin-bottom:16px;max-width:400px;margin-left:auto;margin-right:auto';
  [['ti-arrow-left','Volver',false, cerrarFacturaView],
   ['ti-share','Compartir',true, function(){ abrirMenuAccionesFactura(vid); }],
   ['ti-edit','Editar',false, function(){ editarFactura(vid); }]
  ].forEach(function(b){
    var btn = document.createElement('button');
    btn.innerHTML = '<i class="ti '+b[0]+'" style="font-size:16px" aria-hidden="true"></i>'+b[1];
    var esPrincipal = b[2];
    btn.style.cssText = 'flex:1;padding:10px;background:'+(esPrincipal?'var(--nbs-gold)':'#F0F0F2')+';color:'+(esPrincipal?'white':'var(--nbs-ink)')+';border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:6px';
    btn.onclick = b[3];
    actBtns.appendChild(btn);
  });
  overlay.appendChild(actBtns);

  var btnDevolucion = document.createElement('button');
  btnDevolucion.className = 'no-print';
  btnDevolucion.innerHTML = '↩️ Procesar devolución de producto(s)';
  btnDevolucion.style.cssText = 'display:block;width:100%;max-width:400px;margin:0 auto 8px;padding:10px;background:#FFF3E0;color:#E65100;border:1px solid #FFCC80;border-radius:8px;cursor:pointer;font-size:13px;font-weight:700';
  btnDevolucion.onclick = function(){ abrirDevolucion(vid); };
  overlay.appendChild(btnDevolucion);

  // Botón de cobro rápido: pagar TODO el saldo en efectivo de un toque (solo si es crédito con saldo)
  if(!v.cancelada && v.tipo==='credito' && saldo > 0){
    var btnPagoRapido = document.createElement('button');
    btnPagoRapido.className = 'no-print';
    btnPagoRapido.innerHTML = '💵 Pagar todo en efectivo ($'+fmtNum(saldo)+')';
    btnPagoRapido.style.cssText = 'display:block;width:100%;max-width:400px;margin:0 auto 8px;padding:13px;background:#00838F;color:white;border:none;border-radius:8px;font-size:15px;font-weight:800;cursor:pointer';
    btnPagoRapido.onclick = function(){
      if(!confirm('¿Registrar el pago COMPLETO de $'+fmtNum(saldo)+' en efectivo?')) return;
      var vv = LS('nv', []);
      var vr = vv.find(function(x){ return String(x.id)===String(vid); });
      if(!vr){ alert('No se encontró la factura.'); return; }
      if(!vr.pagosFactura) vr.pagosFactura = [];
      vr.pagosFactura.push({ pid: nuevoPagoId(), monto: saldo, fecha: fechaHoy(), metodos:[{tipo:'efectivo', monto:saldo}] });
      SS('nv', vv);
      alert('✅ Pago de $'+fmtNum(saldo)+' en efectivo aplicado correctamente.');
      verFacturaProfesional(vid);
    };
    overlay.appendChild(btnPagoRapido);
  }
  if(!v.cancelada){
    var btnFirma = document.createElement('button');
    btnFirma.className = 'no-print';
    btnFirma.innerHTML = v.firma ? '✍️ Ver firma del cliente -guardada-' : '✍️ Firma del cliente -opcional, como constancia de entrega-';
    btnFirma.style.cssText = 'display:block;width:100%;max-width:400px;margin:0 auto 8px;padding:10px;background:'+(v.firma?'#E8F5E9':'#E3F2FD')+';color:'+(v.firma?'#2E7D32':'#1565C0')+';border:1px solid '+(v.firma?'#A5D6A7':'#90CAF9')+';border-radius:8px;cursor:pointer;font-size:13px;font-weight:700';
    btnFirma.onclick = function(){ abrirFirmaFactura(vid); };
    overlay.appendChild(btnFirma);
  }

  if(!v.cancelada){
    var btnCancelarFac = document.createElement('button');
    btnCancelarFac.className = 'no-print';
    btnCancelarFac.innerHTML = '🚫 Cancelar esta factura completa';
    btnCancelarFac.style.cssText = 'display:block;width:100%;max-width:400px;margin:0 auto 16px;padding:10px;background:#FFEBEE;color:#C62828;border:1px solid #FFCDD2;border-radius:8px;cursor:pointer;font-size:13px;font-weight:700';
    btnCancelarFac.onclick = function(){ cancelarFacturaCompleta(vid); };
    overlay.appendChild(btnCancelarFac);
  } else {
    var btnEliminarFac = document.createElement('button');
    btnEliminarFac.className = 'no-print';
    btnEliminarFac.innerHTML = '🗑️ Eliminar esta factura cancelada -no se puede deshacer';
    btnEliminarFac.style.cssText = 'display:block;width:100%;max-width:400px;margin:0 auto 16px;padding:10px;background:#B71C1C;color:white;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:700';
    btnEliminarFac.onclick = function(){ eliminarFacturaCancelada(vid); };
    overlay.appendChild(btnEliminarFac);
  }

  // Contenido de la factura
  var itemsHTML = (v.items || []).map(function(it, idx){
    var bg = idx % 2 === 0 ? 'transparent' : '#FAFAFA';
    return '<tr style="background:'+bg+'">'
      +'<td style="padding:9px 6px;border-bottom:0.5px solid #f0f0f0;font-size:13px">'+escaparHtml(it.nombre)+'</td>'
      +'<td style="padding:9px 6px;border-bottom:0.5px solid #f0f0f0;text-align:center;font-size:13px">'+it.cant+'</td>'
      +'<td style="padding:9px 6px;border-bottom:0.5px solid #f0f0f0;text-align:right;font-size:13px">$'+fmtNum(it.precio)+'</td>'
      +'<td style="padding:9px 6px;border-bottom:0.5px solid #f0f0f0;text-align:right;font-size:13px;font-weight:700">$'+fmtNum(it.cant*it.precio)+'</td>'
      +'</tr>';
  }).join('');

  var factDiv = document.createElement('div');
  factDiv.id = 'factura-imprimible';
  factDiv.style.cssText = 'max-width:400px;margin:0 auto;font-family:sans-serif;box-shadow:0 2px 12px rgba(0,0,0,0.08);border-radius:12px;position:relative;overflow:hidden';
  factDiv.innerHTML = '<div style="background:white;padding:14px 20px 12px;text-align:center;border:0.5px solid #e5e7eb;border-bottom:none;border-radius:12px 12px 0 0">'
    +'<img src="'+LOGO_SRC_COLOR+'" style="height:70px;display:inline-block" alt="Nunez Beauty Supply">'
    +'<div style="font-size:12px;color:#888;font-weight:700;margin-top:14px">964 Atwells Ave, Providence, Rhode Island 02909</div>'
    +'<div style="font-size:12px;color:#888;font-weight:700;margin-top:2px">401-305-0188</div>'
    +'<div style="margin-top:10px;display:inline-block;background:#1a237e;color:white;font-size:11px;font-weight:800;letter-spacing:1.5px;padding:4px 16px;border-radius:20px">FACTURA</div>'
    +'</div>'
    +'<div style="border:0.5px solid #e5e7eb;border-top:none;padding:16px;border-radius:0 0 12px 12px">'
    +'<div style="display:flex;justify-content:space-between;margin-bottom:12px;padding-bottom:12px;border-bottom:0.5px solid #f0f0f0">'
    +'<div><div style="font-size:11px;color:#aaa;font-weight:700;text-transform:uppercase">Cliente</div>'
    +(cl && cl.tipoNegocio && cl.tipoNegocio !== 'Barberia' && cl.negocio
      // Para Tiendas y otros negocios -no barberias-, el NEGOCIO tiene la prioridad -es el
      // cliente real-, y el dueño/encargado se muestra mas chico debajo, al reves que en
      // barberias, donde el barbero individual es el cliente real, no el local.
      ? '<div style="font-size:15px;font-weight:800;color:#1a237e;margin-top:2px">🏪 '+cl.negocio+'</div>'
        +'<div style="font-size:12px;color:#555;margin-top:2px">'+v.cn+'</div>'
      : '<div style="font-size:15px;font-weight:800;color:#1a237e;margin-top:2px">'+v.cn+'</div>'
        +(cl&&cl.negocio?'<div style="font-size:12px;color:#555;margin-top:2px">🏪 '+cl.negocio+'</div>':''))
    +(cl&&(cl.dir||cl.ciudad)?'<div style="font-size:11px;color:#888;margin-top:2px">📍 '+((cl.dir||'')+(cl.ciudad?', '+cl.ciudad:'')+(cl.estado?', '+cl.estado:''))+'</div>':'')
    +(cl&&cl.tel?'<div style="font-size:12px;color:#555;margin-top:2px">📱 '+cl.tel+'</div>':'')
    +'</div>'
    +'<div style="text-align:right"><div style="font-size:11px;color:#aaa;font-weight:700;text-transform:uppercase">Factura</div>'
    +'<div style="font-size:14px;font-weight:800;color:#1a237e;margin-top:2px">#'+numFact+'</div>'
    +'<div style="font-size:12px;color:#555;margin-top:2px">'+v.fecha+'</div>'
    +'<div style="font-size:12px;color:#555">'+v.hora+'</div>'
    +'</div></div>'
    +'<table style="width:100%;border-collapse:collapse;margin-bottom:12px">'
    +'<thead><tr style="background:#f5f5f5">'
    +'<th style="padding:8px 6px;text-align:left;font-size:11px;color:#aaa;font-weight:700;text-transform:uppercase">Producto</th>'
    +'<th style="padding:8px 6px;text-align:center;font-size:11px;color:#aaa;font-weight:700;text-transform:uppercase">Cant</th>'
    +'<th style="padding:8px 6px;text-align:right;font-size:11px;color:#aaa;font-weight:700;text-transform:uppercase">Precio</th>'
    +'<th style="padding:8px 6px;text-align:right;font-size:11px;color:#aaa;font-weight:700;text-transform:uppercase">Total</th>'
    +'</tr></thead><tbody>'+itemsHTML+'</tbody></table>'
    +(v.firma ? '<div style="margin:4px 0 14px;text-align:center"><div style="font-size:11px;font-weight:700;color:#666;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;text-align:left">Constancia de entrega</div><img src="'+v.firma+'" style="max-width:100%;max-height:200px;background:white"><div style="font-size:12px;color:#888;margin-top:2px">Firma del cliente</div></div>' : '')
    +'<div style="border-top:2px solid #1a237e;padding-top:12px">'
    +'<div style="display:flex;justify-content:space-between;margin-bottom:4px">'
    +'<span style="font-size:13px;color:#555">Tipo de pago:</span>'
    +'<span style="font-size:13px;font-weight:600;color:'+(v.tipo==='credito'?'#E65100':'#2E7D32')+'">'+(v.tipo==='credito'?'A crédito':'Contado')+'</span>'
    +'</div>'
    // 🧾 EL DESCUENTO, QUE ANTES NO SE VEIA EN NINGUN SITIO.
    // Sensei lo cazo el 8 ago mirando una factura: "por que en la factura no se ve el
    // descuento, aparece como que no se lo di". La app lo guardaba y lo restaba del
    // total, pero ni el cliente ni el lo veian. Ahora sale el subtotal, el descuento
    // en verde con su signo menos, y el total.
    +(function(){
      var _desc = descuentoDeVenta(v);
      if(!_desc) return '';
      return '<div style="display:flex;justify-content:space-between;margin-top:8px">'
        +   '<span style="font-size:13px;color:#555">Subtotal</span>'
        +   '<span style="font-size:13px;color:#555">$' + fmtNum(subtotalDeVenta(v)) + '</span>'
        + '</div>'
        + '<div style="display:flex;justify-content:space-between;margin-top:3px">'
        +   '<span style="font-size:13px;font-weight:700;color:#2E7D32">🎁 Descuento</span>'
        +   '<span style="font-size:13px;font-weight:700;color:#2E7D32">\u2212$' + fmtNum(_desc) + '</span>'
        + '</div>';
    })()
    +'<div style="display:flex;justify-content:space-between;margin-top:8px">'
    +'<span style="font-size:17px;font-weight:800;color:#1a237e">TOTAL</span>'
    +'<span style="font-size:20px;font-weight:800;color:#1565C0">$'+fmtNum(v.total)+'</span>'
    +'</div>'
    +(v.tipo==='credito' && v.pagosFactura && (v.pagosFactura || []).filter(function(p){ return p.monto>0; }).length > 0 ?
      '<div style="margin-top:10px;background:#F1F8E9;border-radius:8px;padding:10px">'
      +'<div style="font-size:11px;font-weight:700;color:#2E7D32;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px">📋 Historial de abonos</div>'
      +(v.pagosFactura || []).filter(function(p){ return typeof p.monto==='number' && p.monto>0; }).map(function(p){
        return '<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:0.5px solid #C8E6C9;font-size:12px">'
          +'<span style="color:#555">'+(p.fecha||'')+(p.nota?' · '+p.nota:'')+'</span>'
          +'<span style="font-weight:700;color:#2E7D32">$'+fmtNum(p.monto)+'</span>'
          +'</div>';
      }).join('')
      +'<div style="display:flex;justify-content:space-between;padding-top:6px;font-size:13px;font-weight:700">'
      +'<span style="color:#2E7D32">Total abonado:</span><span style="color:#2E7D32">$'+fmtNum(pagado)+'</span>'
      +'</div></div>' : '')
    +(esSaldoPendiente(saldo)?'<div style="display:flex;justify-content:space-between;margin-top:8px;background:#FFEBEE;padding:8px;border-radius:8px"><span style="font-size:14px;font-weight:700;color:#C62828">Balance pendiente:</span><span style="font-size:16px;font-weight:800;color:#C62828">$'+fmtNum(saldo)+'</span></div>':'<div style="text-align:center;margin-top:8px;background:#E8F5E9;padding:8px;border-radius:8px;font-size:13px;font-weight:700;color:#2E7D32">✓ PAGADO COMPLETO</div>')
    +'<div style="display:flex;justify-content:space-between;margin-top:6px;padding:6px 8px;border-radius:8px;background:#f5f5f5">'
    +'<span style="font-size:13px;font-weight:700;color:#555">Balance:</span>'
    +'<span style="font-size:14px;font-weight:800;color:'+(esSaldoPendiente(saldo)?'#C62828':'#2E7D32')+'">$'+fmtNum(saldo)+'</span>'
    +'</div>'
    +'</div>'
    +'<div style="text-align:center;margin-top:16px;font-size:11px;color:#aaa;border-top:0.5px solid #f0f0f0;padding-top:12px">Gracias por su preferencia · Nunez Beauty Supply</div>'
    +'</div>';
  overlay.appendChild(factDiv);

  if(v.cancelada){
    var watermark = document.createElement('div');
    watermark.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:5;overflow:hidden';
    watermark.innerHTML = '<div style="font-size:42px;font-weight:900;color:rgba(198,40,40,0.35);transform:rotate(-25deg);white-space:nowrap;text-transform:uppercase;letter-spacing:2px;border:6px solid rgba(198,40,40,0.35);padding:10px 24px;border-radius:12px">FACTURA<br>CANCELADA</div>';
    factDiv.appendChild(watermark);
  }
  overlay.style.display = 'block'; overlay.scrollTop = 0;
}


function envolverTexto(ctx, texto, maxAncho, maxLineas){
  var palabras = (texto||'').trim().split(/\s+/);
  var lineas = [];
  var linea = '';
  for(var i=0; i<palabras.length; i++){
    var prueba = linea ? linea+' '+palabras[i] : palabras[i];
    if(ctx.measureText(prueba).width <= maxAncho){
      linea = prueba;
    } else {
      if(linea) lineas.push(linea);
      if(lineas.length === maxLineas-1){
        var resto = palabras.slice(i).join(' ');
        while(resto.length>1 && ctx.measureText(resto+'\u2026').width > maxAncho){ resto = resto.slice(0,-1); }
        lineas.push(resto+(resto===palabras.slice(i).join(' ')?'':'\u2026'));
        return lineas;
      }
      linea = palabras[i];
    }
  }
  if(linea) lineas.push(linea);
  return lineas;
}

// Formatea un telefono a estilo profesional -(401) 275-6694-, sin importar como se haya
// guardado originalmente -solo digitos, con guiones, con codigo de pais, etc-, para que se vea
// igual de cuidado que el telefono del propio negocio en la factura.
function formatearTelefonoFactura(tel){
  if(!tel) return '';
  var digitos = (tel+'').replace(/\D/g, '');
  if(digitos.length === 11 && digitos[0] === '1') digitos = digitos.slice(1);
  if(digitos.length === 10){
    return '('+digitos.slice(0,3)+') '+digitos.slice(3,6)+'-'+digitos.slice(6);
  }
  return tel; // si no tiene el largo esperado, se deja tal cual para no inventar formato
}

function dibujarContenidoFactura(ctx, W, pad, v, cl, pagado, saldo, numFact, abonos, colorMode){
  var y;
  // Tamanos de letra ajustados para dar prioridad a la informacion del CLIENTE -lo que
  // realmente importa al abrir la factura- por encima de los datos del propio negocio, que
  // ahora son visibles pero discretos -sin negrita-.
  var fs = colorMode
    ? { dir:12, lbl:11, cliente:17, negocio:13, dirCl:11, prodLbl:11, item:14, itemQty:12, pago:14, total:21 }
    : { dir:17, lbl:22, cliente:26, negocio:19, dirCl:20, prodLbl:20, item:22, itemQty:19, pago:26, total:40 };
  var maxCliente = colorMode ? 24 : 17; // solo se usa en el modo a color
  var maxNegocio = colorMode ? 24 : 15; // solo se usa en el modo a color
  var maxDir = colorMode ? 34 : 22; // solo se usa en el modo a color

  // FUENTE del recibo. En la Epson TERMICA (blanco y negro) se usa una fuente SIN adornos
  // y en NEGRITA: se imprime mucho mas marcada, limpia y legible que Georgia (que tiene
  // "patitas" que la impresora termica no define bien). En color se mantiene Georgia (elegante).
  var ff = colorMode ? 'bold Georgia, serif' : 'bold Arial, sans-serif';
  var ffFam = colorMode ? 'Georgia, serif' : 'Arial, sans-serif'; // familia sin 'bold' (para armar 'bold Npx familia')

  // Header con logo -se usa la proporcion REAL de cada imagen, ya que el logo a color y el
  // logo en blanco y negro no tienen exactamente las mismas proporciones; antes se forzaba la
  // misma proporcion a los dos, estirando el logo a color-. Tambien un poco mas grande que antes.
  var logoActivo = colorMode ? LOGO_IMG_COLOR : LOGO_IMG;
  if(colorMode && (!logoActivo || logoActivo.naturalWidth === 0)) logoActivo = LOGO_IMG;
  var logoW = colorMode ? Math.min(W*0.68, 290) : Math.min(W*0.5, 190);
  if(logoActivo && logoActivo.naturalWidth > 0){
    var logoH = logoW * (logoActivo.naturalHeight / logoActivo.naturalWidth);
    ctx.drawImage(logoActivo, W/2 - logoW/2, 10, logoW, logoH);
    y = 10 + logoH + 16;
  } else {
    // Respaldo si el logo no cargo a tiempo
    ctx.fillStyle = colorMode ? '#1a237e' : '#000';
    ctx.textAlign = 'center';
    ctx.font = 'bold 23px '+ffFam+'';
    ctx.fillText('Nunez Beauty Supply', W/2, 32);
    y = 50;
  }
  // Direccion y telefono del NEGOCIO -visibles pero discretos, sin negrita, para no competir
  // con la informacion del cliente que viene despues-. Un poco mas grande y con mas espaciado
  // que antes, para que se lea mejor incluso con zoom/impreso.
  ctx.font = (fs.dir+2)+'px '+ff+'';
  ctx.fillStyle = colorMode ? '#888' : '#555';
  ctx.textAlign = 'center';
  ctx.fillText('964 Atwells Ave, Providence, RI 02909', W/2, y);
  y += colorMode?19:22;
  ctx.fillText('401-305-0188', W/2, y);
  y += colorMode?28:30;

  if(colorMode){
    // ===== Formato original, sin cambios (version a color para compartir) =====
    ctx.font = 'bold '+fs.lbl+'px '+ffFam+'';
    ctx.textAlign = 'left'; ctx.fillStyle = '#aaa'; ctx.fillText('CLIENTE', pad, y);
    ctx.textAlign = 'right'; ctx.fillText('FACTURA', W-pad, y);
    y += 20;
    ctx.font = 'bold '+fs.cliente+'px '+ffFam+'';
    ctx.fillStyle = '#1a237e';
    // Misma prioridad que en la vista digital: para Tiendas -no barberias-, el negocio va
    // primero y mas grande, el dueño/encargado mas chico debajo.
    var esNegocioPrioritario = cl && cl.tipoNegocio && cl.tipoNegocio !== 'Barberia' && cl.negocio;
    var lineaGrande = esNegocioPrioritario ? cl.negocio : (v.cn||'');
    var lineaChica = esNegocioPrioritario ? (v.cn||'') : (cl && cl.negocio ? cl.negocio : '');
    ctx.textAlign = 'left'; ctx.fillText(lineaGrande.substring(0,maxCliente), pad, y);
    ctx.textAlign = 'right'; ctx.fillText('#'+numFact, W-pad, y);
    y += 19;
    ctx.font = 'bold '+fs.negocio+'px '+ffFam+'';
    ctx.fillStyle = '#555';
    if(lineaChica){ ctx.textAlign='left'; ctx.fillText(lineaChica.substring(0,maxNegocio), pad, y); }
    ctx.textAlign='right'; ctx.fillText(v.fecha, W-pad, y);
    y += 17;
    var dirClColor = cl ? ((cl.dir||'')+(cl.ciudad?', '+cl.ciudad:'')+(cl.estado?', '+cl.estado:'')+(cl.zip?' '+cl.zip:'')).trim() : '';
    if(dirClColor){
      ctx.font = 'bold '+fs.dirCl+'px '+ffFam+'';
      ctx.fillStyle = '#888';
      ctx.textAlign='left'; ctx.fillText(dirClColor.substring(0,maxDir), pad, y);
      ctx.textAlign='right'; ctx.fillText(v.hora, W-pad, y);
      y += 15;
      ctx.font = 'bold '+fs.negocio+'px '+ffFam+'';
      ctx.fillStyle = '#555';
    } else {
      ctx.textAlign='right'; ctx.fillText(v.hora, W-pad, y);
    }
    if(cl && cl.tel){ ctx.textAlign='left'; ctx.fillText(formatearTelefonoFactura(cl.tel), pad, y); }
    y += 16;
  } else {
    // ===== Formato nuevo, SOLO para impresion termica =====
    ctx.fillStyle = '#000';

    // Fila 1: fecha (izquierda) | numero de factura (derecha) -sin la hora, que solo se
    // muestra en la factura interna/digital, no en la de impresion-
    ctx.font = 'bold '+fs.lbl+'px '+ffFam+'';
    ctx.textAlign='left'; ctx.fillText(v.fecha, pad, y);
    ctx.textAlign='right'; ctx.fillText('Factura No. '+numFact, W-pad, y);
    y += 34;

    // Fila 2: nombre grande + telefono juntos si caben; si no, telefono baja a su propia linea.
    // Misma prioridad que en la vista digital: para Tiendas -no barberias-, el negocio va
    // primero -grande-, y el dueño/encargado mas chico debajo. Para Barberias, sigue igual
    // que siempre -el barbero individual primero-.
    var esNegocioPrioritarioBN = cl && cl.tipoNegocio && cl.tipoNegocio !== 'Barberia' && cl.negocio;
    var nombreCl = esNegocioPrioritarioBN ? cl.negocio : (v.cn || '');
    var nombreChico = esNegocioPrioritarioBN ? (v.cn || '') : '';
    var telCl = (cl && cl.tel) ? formatearTelefonoFactura(cl.tel) : '';
    ctx.font = 'bold '+fs.cliente+'px '+ffFam+'';
    var anchoNombreCl = ctx.measureText(nombreCl).width;
    ctx.font = 'bold '+fs.negocio+'px '+ffFam+'';
    var anchoTelCl = telCl ? ctx.measureText(telCl).width : 0;
    var cabenJuntos = telCl && (anchoNombreCl + anchoTelCl + 16) <= (W-2*pad);

    ctx.font = 'bold '+fs.cliente+'px '+ffFam+'';
    ctx.textAlign='left'; ctx.fillText(nombreCl, pad, y);
    if(telCl && cabenJuntos){
      ctx.font = 'bold '+fs.negocio+'px '+ffFam+'';
      ctx.textAlign='right'; ctx.fillText(telCl, W-pad, y);
    }
    y += 36;
    if(telCl && !cabenJuntos){
      ctx.font = 'bold '+fs.negocio+'px '+ffFam+'';
      ctx.textAlign='left'; ctx.fillText(telCl, pad, y);
      y += 32;
    }

    // Segunda linea -mas chica-: para Tienda es el nombre del dueño; para Barberia es el
    // nombre del negocio, tal como funcionaba antes. Se distribuye junto a la direccion del
    // cliente -a la derecha- cuando ambos caben en una sola linea, para no amontonar todo del
    // lado izquierdo.
    var textoSegundaLinea = esNegocioPrioritarioBN ? nombreChico : (cl && cl.negocio ? cl.negocio : '');
    var dirCl2 = cl ? ((cl.dir||'')+(cl.ciudad?', '+cl.ciudad:'')+(cl.estado?', '+cl.estado:'')+(cl.zip?' '+cl.zip:'')).trim() : '';
    ctx.font = 'bold '+fs.dirCl+'px '+ffFam+'';
    var anchoSegundaLinea = textoSegundaLinea ? ctx.measureText(textoSegundaLinea).width : 0;
    var anchoDirCl = dirCl2 ? ctx.measureText(dirCl2).width : 0;
    var cabenSegundaLineaYDireccionJuntos = textoSegundaLinea && dirCl2 && (anchoSegundaLinea + anchoDirCl + 16) <= (W-2*pad);

    if(cabenSegundaLineaYDireccionJuntos){
      ctx.textAlign='left'; ctx.fillText(textoSegundaLinea, pad, y);
      ctx.textAlign='right'; ctx.fillText(dirCl2, W-pad, y);
      y += 28;
    } else {
      if(textoSegundaLinea){
        var lineasNeg = envolverTexto(ctx, textoSegundaLinea, W-2*pad, 2);
        lineasNeg.forEach(function(linea){
          ctx.textAlign='left'; ctx.fillText(linea, pad, y);
          y += 28;
        });
      }
      // Direccion - en su propia linea, SIN cortar (se parte en hasta 2 lineas si hace falta)
      if(dirCl2){
        var lineasDir = envolverTexto(ctx, dirCl2, W-2*pad, 2);
        lineasDir.forEach(function(linea){
          ctx.textAlign='left'; ctx.fillText(linea, pad, y);
          y += 30;
        });
      }
    }
    y += 8;
  }

  y += 6;
  ctx.strokeStyle = colorMode ? '#e5e7eb' : '#000'; ctx.lineWidth = colorMode ? 1 : 2;
  ctx.beginPath(); ctx.moveTo(pad,y); ctx.lineTo(W-pad,y); ctx.stroke();
  y += colorMode?22:26;

  ctx.font = 'bold '+fs.prodLbl+'px Arial, sans-serif';
  ctx.fillStyle = colorMode ? '#aaa' : '#000';
  ctx.textAlign='left'; ctx.fillText('PRODUCTO', pad, y);
  ctx.textAlign='right'; ctx.fillText('TOTAL', W-pad, y);
  y += 10;
  ctx.strokeStyle = colorMode ? '#e5e7eb' : '#000';
  ctx.beginPath(); ctx.moveTo(pad,y); ctx.lineTo(W-pad,y); ctx.stroke();
  y += colorMode?22:28;

  (v.items||[]).forEach(function(it){
    // Nombre del producto -con algo de peso, pero ya no tan fuerte como antes-, en una
    // fuente sans-serif limpia que se lee mejor a tamaños chicos que el serif del encabezado.
    ctx.font = 'bold '+fs.item+'px Arial, sans-serif';
    ctx.fillStyle = colorMode ? '#1a1a2e' : '#000';
    var precioTxt = '$'+fmtNum(it.cant*it.precio);
    if(colorMode){
      ctx.textAlign='left';
      ctx.fillText((it.nombre||'').substring(0,26), pad, y);
      ctx.textAlign='right';
      ctx.fillText(precioTxt, W-pad, y);
      y += 18;
    } else {
      // Version termica: el nombre del producto va solo, en hasta 2 lineas sin cortarse.
      var lineas = envolverTexto(ctx, it.nombre||'', W-2*pad, 2);
      ctx.textAlign='left';
      lineas.forEach(function(linea){
        ctx.fillText(linea, pad, y);
        y += 26;
      });
    }
    // "Cantidad x precio unitario" -tamaño de apoyo, pero en color normal como el resto del
    // detalle de la compra del cliente, no en gris-.
    ctx.font='bold '+fs.itemQty+'px Arial, sans-serif';
    ctx.fillStyle = colorMode ? '#777' : '#000';
    ctx.textAlign='left';
    ctx.fillText(it.cant+' x $'+fmtNum(it.precio), pad, y);
    if(!colorMode){
      ctx.font='bold '+(fs.itemQty+2)+'px Arial, sans-serif';
      ctx.fillStyle = '#000';
      ctx.textAlign='right'; ctx.fillText(precioTxt, W-pad, y);
    }
    y += colorMode?22:30;
  });

  y += 2;
  ctx.strokeStyle = colorMode ? '#1a237e' : '#000'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(pad,y); ctx.lineTo(W-pad,y); ctx.stroke();
  y += colorMode?26:29;

  // FIRMA DEL CLIENTE — va aqui, DESPUES de los productos (y su raya) y ANTES de los
  // totales. Solo si el cliente firmo. La imagen ya trae su X y linea guia. Debajo va
  // otra raya que separa la firma de los totales. Pedido por Sensei con este orden exacto.
  if(v.firma && window._firmaImgFactura && window._firmaImgFactura.complete && window._firmaImgFactura.naturalWidth){
    ctx.font = 'bold '+(colorMode?11:14)+'px '+(colorMode?'Georgia, serif':'Arial, sans-serif');
    ctx.fillStyle = colorMode ? '#666' : '#000';
    ctx.textAlign='left';
    ctx.fillText('CONSTANCIA DE ENTREGA', pad, y);
    y += 8;
    var _fimg = window._firmaImgFactura;
    var _fmaxW = W - pad*2;
    var _fmaxH = colorMode ? 200 : 230;
    var _fesc = Math.min(_fmaxW / _fimg.naturalWidth, _fmaxH / _fimg.naturalHeight);
    var _fw = _fimg.naturalWidth * _fesc;
    var _fh = _fimg.naturalHeight * _fesc;
    var _fx = (W - _fw) / 2;
    try{ ctx.drawImage(_fimg, _fx, y, _fw, _fh); }catch(e){}
    y += _fh + 2;
    ctx.font = ''+(colorMode?11:13)+'px '+(colorMode?'Georgia, serif':'Arial, sans-serif');
    ctx.fillStyle = colorMode ? '#888' : '#000';
    ctx.textAlign='center';
    ctx.fillText('Firma del cliente', W/2, y);
    y += colorMode?14:18;
    // Raya que separa la firma de los totales
    ctx.strokeStyle = colorMode ? '#1a237e' : '#000'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(pad,y); ctx.lineTo(W-pad,y); ctx.stroke();
    y += colorMode?26:29;
  }

  if(colorMode){
    ctx.font='bold '+fs.pago+'px '+ffFam+'';
    ctx.fillStyle = '#555';
    ctx.textAlign='left'; ctx.fillText('Tipo de pago:', pad, y);
    ctx.fillStyle = (v.tipo==='credito' ? '#E65100' : '#2E7D32');
    ctx.textAlign='right'; ctx.fillText(v.tipo==='credito'?'A credito':'Contado', W-pad, y);
    y += 30;

    // 🧾 EL DESCUENTO, TAMBIEN EN LA FACTURA QUE SE IMPRIME Y SE COMPARTE.
    // Es la que ve el cliente — si no sale, no se entera de lo que le rebajaste. -8 ago-
    var _descF = descuentoDeVenta(v);
    if(_descF){
      ctx.font='bold '+fs.pago+'px '+ffFam+'';
      ctx.fillStyle = '#555';
      ctx.textAlign='left';  ctx.fillText('Subtotal', pad, y);
      ctx.textAlign='right'; ctx.fillText('$'+fmtNum(subtotalDeVenta(v)), W-pad, y);
      y += 26;
      ctx.fillStyle = '#2E7D32';
      ctx.textAlign='left';  ctx.fillText('Descuento', pad, y);
      ctx.textAlign='right'; ctx.fillText('-$'+fmtNum(_descF), W-pad, y);
      y += 30;
    }

    ctx.font='bold '+fs.total+'px '+ffFam+'';
    ctx.fillStyle = '#1a237e';
    ctx.textAlign='left'; ctx.fillText('TOTAL', pad, y);
    ctx.fillStyle = '#1565C0';
    ctx.textAlign='right'; ctx.fillText('$'+fmtNum(v.total), W-pad, y);
    y += 18;

    if(abonos.length){
      y += 20;
      var boxTop = y - 18;
      var boxHeight = 22 + abonos.length*20 + 12;
      ctx.fillStyle = '#F1F8E9';
      ctx.fillRect(pad-6, boxTop, W-2*pad+12, boxHeight);
      ctx.font='bold 16px '+ffFam+'';
      ctx.fillStyle = '#2E7D32';
      ctx.textAlign='left'; ctx.fillText('HISTORIAL DE ABONOS', pad, y);
      y += 22;
      ctx.font='bold 17px '+ffFam+'';
      abonos.forEach(function(p){
        ctx.fillStyle = '#555';
        ctx.textAlign='left'; ctx.fillText(((p.fecha||'')+(p.nota?' - '+p.nota:'')).substring(0,24), pad, y);
        ctx.fillStyle = '#2E7D32';
        ctx.textAlign='right'; ctx.fillText('$'+fmtNum(p.monto), W-pad, y);
        y += 20;
      });
      ctx.font='bold 18px '+ffFam+'';
      ctx.fillStyle = '#2E7D32';
      ctx.textAlign='left'; ctx.fillText('Total abonado:', pad, y);
      ctx.textAlign='right'; ctx.fillText('$'+fmtNum(pagado), W-pad, y);
      y += 24;
    } else {
      y += 16;
    }

    if(esSaldoPendiente(saldo)){
      var bt = y - 18;
      ctx.fillStyle = '#FFEBEE';
      ctx.fillRect(pad-6, bt, W-2*pad+12, 26);
      ctx.font='bold 19px '+ffFam+'';
      ctx.fillStyle = '#C62828';
      ctx.textAlign='left'; ctx.fillText('BALANCE PENDIENTE:', pad, y);
      ctx.textAlign='right'; ctx.fillText('$'+fmtNum(saldo), W-pad, y);
      y += 32;
    } else {
      ctx.fillStyle = '#E8F5E9';
      ctx.fillRect(pad-6, y-18, W-2*pad+12, 26);
      ctx.font='bold 19px '+ffFam+'';
      ctx.fillStyle = '#2E7D32';
      ctx.textAlign='center'; ctx.fillText('\u2713 PAGADO COMPLETO', W/2, y);
      y += 32;
    }
  } else {
    // ===== Formato nuevo y simple, SOLO para impresion termica =====
    // Linea 1: TOTAL ESTA FACTURA $00.00 -el mas importante de los 3-
    ctx.font='bold 22px Arial, sans-serif';
    ctx.fillStyle = '#000';
    ctx.textAlign='left'; ctx.fillText('TOTAL ESTA FACTURA', pad, y);
    ctx.textAlign='right'; ctx.fillText('$'+fmtNum(v.total), W-pad, y);
    y += 32;

    // Linea 2: PAGO $00.00 -en negro para que se lea bien en termica, no gris-
    ctx.font='bold 18px Arial, sans-serif';
    ctx.fillStyle = '#000';
    ctx.textAlign='left'; ctx.fillText('PAGO', pad, y);
    ctx.textAlign='right'; ctx.fillText('$'+fmtNum(pagado), W-pad, y);
    y += 28;

    // Linea 3: BALANCE PENDIENTE $00.00 -o $0.00 si esta saldada- -en negro, bien visible-
    ctx.font='bold 18px Arial, sans-serif';
    ctx.fillStyle = '#000';
    ctx.textAlign='left'; ctx.fillText('BALANCE PENDIENTE', pad, y);
    ctx.textAlign='right'; ctx.fillText('$'+fmtNum(saldo), W-pad, y);
    y += 30;
  }

  y += 16;
  ctx.font=''+(colorMode?12:18)+'px '+ff+'';
  ctx.fillStyle = colorMode ? '#aaa' : '#000';
  ctx.textAlign='center';
  ctx.fillText('Gracias por su preferencia', W/2, y);
  y += colorMode?16:20;
  ctx.fillText('Nunez Beauty Supply', W/2, y);
  y += 18;

  return y;
}

function pintarPagosEnEditorFactura(vid){
  var caja = document.getElementById('fact-edit-pagos');
  if(!caja) return;
  ventas = LS('nv', []);
  var v = ventas.find(function(x){ return String(x.id) === String(vid); });
  if(!v){ caja.innerHTML = ''; return; }

  var pagos = v.pagosFactura || [];
  var total = parseFloat(v.total) || 0;
  var pagado = 0;
  pagos.forEach(function(p){ if(!p.esDevolucion) pagado += parseFloat(p.monto) || 0; });
  pagado = Math.round(pagado * 100) / 100;
  var saldo = cobradoYDebeDe(v).debe;

  var h = '<div style="border-top:1px solid #E8E8EF;padding-top:12px;margin-bottom:14px">';
  h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:9px">'
    +   '<span style="font-size:12.5px;font-weight:900;color:var(--nbs-ink)">\ud83d\udcb5 PAGOS APLICADOS</span>'
    +   '<span style="font-size:13px;font-weight:900;color:var(--nbs-green-text)">$' + fmtNum(pagado) + '</span>'
    + '</div>';

  if(!pagos.length){
    h += '<div style="font-size:11.5px;color:var(--nbs-muted);padding:8px 0">'
      + (v.tipo === 'contado'
          ? 'Esta venta fue al contado y no tiene pagos apuntados por separado.'
          : 'Todav\u00eda no le has aplicado ning\u00fan pago a esta factura.')
      + '</div>';
  } else {
    pagos.forEach(function(p, i){
      if(p.esDevolucion) return;
      var metodo = (p.metodos && p.metodos.length)
        ? p.metodos.map(function(m){ return m.tipo || ''; }).filter(Boolean).join(' + ')
        : (p.metodo || '');
      h += '<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid #F4F4F8">'
        + '<div style="flex:1;min-width:0">'
        +   '<div style="font-size:12.5px;font-weight:700;color:var(--nbs-ink)">'
        +     escaparHtml(String(p.fecha || v.fecha || '')) + '</div>'
        +   '<div style="font-size:10.5px;color:var(--nbs-muted)">'
        +     (metodo ? escaparHtml(metodo) : 'sin forma de pago')
        +     (p.nota ? ' \u00b7 ' + escaparHtml(String(p.nota).slice(0, 26)) : '') + '</div>'
        + '</div>'
        + '<div style="font-size:13.5px;font-weight:900;color:var(--nbs-green-text);flex-shrink:0">+$'
        +   fmtNum(parseFloat(p.monto) || 0) + '</div>'
        + '<button onclick="editarPagoDesdeFactura(' + _arg(vid) + ',' + i + ')" '
        +   'style="background:#FFF8E1;border:1px solid #F9A825;border-radius:7px;padding:6px 9px;'
        +   'font-size:13px;cursor:pointer;flex-shrink:0" title="Corregir este pago">\u270f\ufe0f</button>'
        + '<button onclick="borrarPagoDesdeFactura(' + _arg(vid) + ',' + i + ')" '
        +   'style="background:#FFEBEE;border:1px solid #C62828;border-radius:7px;padding:6px 9px;'
        +   'font-size:13px;cursor:pointer;flex-shrink:0" title="Borrar este pago">\ud83d\uddd1\ufe0f</button>'
        + '</div>';
    });
  }

  // Cómo queda la factura
  var col = saldo > 0.005 ? 'var(--nbs-red-text)' : 'var(--nbs-green-text)';
  var txt = saldo > 0.005 ? 'Le queda debiendo $' + fmtNum(saldo)
          : (saldo < -0.005 ? '\u26a0\ufe0f Est\u00e1 pagada de M\u00c1S por $' + fmtNum(-saldo)
                            : '\u2705 Esta factura est\u00e1 SALDADA');
  h += '<div style="margin-top:9px;padding:9px;background:' + (saldo > 0.005 ? 'var(--nbs-red-bg)' : 'var(--nbs-green-bg)')
    + ';border-radius:8px;text-align:center;font-size:12px;font-weight:800;color:' + col + '">'
    + txt + '</div>';
  h += '</div>';
  caja.innerHTML = h;
}

// Corregir un pago desde la factura. Usa el editor que ya existía. -15 ago-
function editarPagoDesdeFactura(vid, pidx){
  window._pagoVuelveAFactura = vid;
  try { abrirEditorPago(vid, pidx); } catch(e){ alert('No se pudo abrir el pago.'); }
}

function borrarPagoDesdeFactura(vid, pidx){
  ventas = LS('nv', []);
  var v = ventas.find(function(x){ return String(x.id) === String(vid); });
  if(!v || !v.pagosFactura || v.pagosFactura[pidx] === undefined) return;
  var p = v.pagosFactura[pidx];
  if(!confirm('\u00bfBorrar este pago de $' + fmtNum(parseFloat(p.monto) || 0) + '?\n\n'
      + 'La deuda del cliente va a SUBIR ese mismo monto.\n\nEsto no se puede deshacer.')) return;
  v.pagosFactura.splice(pidx, 1);
  SS('nv', ventas);
  try { pintarPagosEnEditorFactura(vid); } catch(e){}
  try { renderCxC(''); } catch(e){}
  try { avisoChico('\ud83d\uddd1\ufe0f Pago borrado'); } catch(e){}
}

function editarFactura(vid){
  ventas = LS('nv', []);
  var v = ventas.find(function(x){ return String(x.id)===String(vid); });
  if(!v) return;

  // Copia editable de los productos - permite agregar/quitar antes de guardar
  window._facturaEditItems = (v.items || []).map(function(it){ return { nombre: it.nombre, cant: it.cant, precio: it.precio, pid: it.pid || null, costo: it.costo || 0 }; });
  window._facturaEditVid = vid;

  var overlay = document.getElementById('fact-edit-overlay');
  if(!overlay){
    overlay = document.createElement('div');
    overlay.id = 'fact-edit-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:white;z-index:99999;overflow-y:auto;padding:16px';
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = '';

  var wrap = document.createElement('div');
  wrap.style.cssText = 'max-width:480px;margin:0 auto';
  wrap.id = 'fact-edit-wrap-interno';

  // Header
  var header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;gap:12px;margin-bottom:18px';
  var btnBack = document.createElement('button');
  btnBack.innerHTML = '←';
  btnBack.style.cssText = 'background:transparent;border:0.5px solid #d8d8dc;border-radius:8px;padding:10px 14px;cursor:pointer;color:var(--nbs-ink);display:flex;align-items:center';
  btnBack.onclick = cerrarFacturaEdit;
  var titulo = document.createElement('div');
  titulo.style.cssText = 'font-size:17px;font-weight:500;color:var(--nbs-ink)';
  titulo.textContent = 'Editar factura';
  var iconoNBS3 = document.createElement('img');
  iconoNBS3.src = 'icon-512.png';
  iconoNBS3.style.cssText = 'width:32px;height:32px;margin-left:auto;border-radius:8px;cursor:pointer';
  iconoNBS3.alt = 'NBS';
  iconoNBS3.onclick = function(){ overlay.style.display='none'; ir('p-inicio'); };
  header.appendChild(btnBack);
  header.appendChild(titulo);
  header.appendChild(iconoNBS3);
  wrap.appendChild(header);

  var numFactEdit = String(v.id).slice(-6);

  // Encabezado tipo factura (logo + numero de factura)
  var facHeader = document.createElement('div');
  facHeader.style.cssText = 'background:white;border:0.5px solid var(--nbs-line);border-radius:12px 12px 0 0;padding:16px;text-align:center;box-shadow:var(--nbs-shadow-card)';
  facHeader.innerHTML = '<img src="'+LOGO_SRC_COLOR+'" style="height:48px" alt="Nunez Beauty Supply">'
    +'<div style="margin-top:8px;display:inline-block;background:var(--nbs-ink);color:white;font-size:10px;font-weight:500;letter-spacing:1.5px;padding:3px 14px;border-radius:20px">FACTURA #'+numFactEdit+'</div>';
  wrap.appendChild(facHeader);

  // Info del cliente (parte del "cuerpo" de la factura, sin redondear arriba para que se vea unido al encabezado)
  var info = document.createElement('div');
  info.style.cssText = 'background:white;border:0.5px solid var(--nbs-line);border-top:none;padding:12px 16px;margin-bottom:14px;font-size:13px;color:var(--nbs-ink)';
  var fechaISO = (function(){
    var d = parsearFechaVenta(v.fecha);
    var mm = String(d.getMonth()+1).padStart(2,'0');
    var dd = String(d.getDate()).padStart(2,'0');
    return d.getFullYear()+'-'+mm+'-'+dd;
  })();
  info.innerHTML = '<div style="margin-bottom:8px"><span style="font-weight:500">'+nombreVentaClienteConNegocio(v)+'</span></div>'
    +'<label style="font-size:10px;color:var(--nbs-muted);font-weight:600;display:block;margin-bottom:4px">FECHA DE LA FACTURA (toca para corregir si está mal)</label>'
    +'<input type="date" id="fact-edit-fecha" value="'+fechaISO+'" style="width:100%;padding:8px;border:0.5px solid #d8d8dc;border-radius:8px;font-size:13px;color:var(--nbs-ink)">';
  wrap.appendChild(info);

  // Agregar producto nuevo a la factura
  var addBox = document.createElement('div');
  addBox.style.cssText = 'background:var(--nbs-gold-bg);border-radius:12px;padding:12px;margin-bottom:14px';
  addBox.innerHTML = '<label style="font-size:11px;color:var(--nbs-gold-dark);font-weight:700;display:block;margin-bottom:6px">➕ AGREGAR PRODUCTO A ESTA FACTURA</label>'
    +'<div class="busca-caja" style="border:2px solid var(--nbs-gold);margin-bottom:8px"><span style="font-size:16px;flex-shrink:0;opacity:0.75">🔍</span><input class="busca-fuerte" type="text" id="fact-edit-buscar-prod" placeholder="Buscar producto del catálogo..." autocomplete="off" oninput="buscarProductoParaFactura(this.value)"></div>'
    +'<div id="fact-edit-resultados" style="background:white;border-radius:8px;max-height:180px;overflow-y:auto;display:none"></div>';
  wrap.appendChild(addBox);

  var tituloEdicion = document.createElement('div');
  tituloEdicion.style.cssText = 'font-size:11px;color:var(--nbs-muted);font-weight:500;margin-bottom:8px;padding-left:2px';
  tituloEdicion.textContent = 'Productos (toca para editar, o quita con ✕)';
  wrap.appendChild(tituloEdicion);

  // Items (contenedor que se vuelve a dibujar cada vez que se agrega/quita algo)
  var itemsWrap = document.createElement('div');
  itemsWrap.id = 'fact-edit-items-wrap';
  wrap.appendChild(itemsWrap);

  // Total
  var totalBox = document.createElement('div');
  totalBox.id = 'fact-edit-total-box';
  totalBox.style.cssText = 'border-top:2px solid var(--nbs-ink);padding-top:10px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center';
  wrap.appendChild(totalBox);

  // 💵 LOS PAGOS DE ESTA FACTURA, con su lápiz y su papelera. -15 ago-
  var pagosBox = document.createElement('div');
  pagosBox.id = 'fact-edit-pagos';
  wrap.appendChild(pagosBox);

  // Botones
  var btnsRow = document.createElement('div');
  btnsRow.style.cssText = 'display:flex;gap:8px;margin-top:8px';
  var btnGuardar = document.createElement('button');
  btnGuardar.innerHTML = '✓Guardar cambios';
  btnGuardar.style.cssText = 'flex:1;padding:14px;background:var(--nbs-gold);color:white;border:none;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px';
  btnGuardar.onclick = (function(id){ return function(){ guardarEdicionFactura(id); }; })(vid);
  var btnCancel = document.createElement('button');
  btnCancel.innerHTML = '✕Cancelar';
  btnCancel.style.cssText = 'padding:14px 20px;background:#F0F0F2;color:var(--nbs-ink);border:0.5px solid #d8d8dc;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px';
  btnCancel.onclick = cerrarFacturaEdit;
  btnsRow.appendChild(btnGuardar);
  btnsRow.appendChild(btnCancel);
  wrap.appendChild(btnsRow);

  overlay.appendChild(wrap);
  overlay.style.display = 'block'; overlay.scrollTop = 0;
  renderItemsFacturaEdit();
}

function renderItemsFacturaEdit(){
  var itemsWrap = document.getElementById('fact-edit-items-wrap');
  if(!itemsWrap) return;
  itemsWrap.innerHTML = '';
  var items = window._facturaEditItems || [];

  items.forEach(function(it, i){
    var row = document.createElement('div');
    row.style.cssText = 'padding:14px;margin-bottom:10px;border:0.5px solid var(--nbs-line);border-radius:12px;box-shadow:var(--nbs-shadow-card)';
    row.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">'
      +'<span style="font-size:11px;color:var(--nbs-muted-2);font-weight:500">Producto '+(i+1)+'</span>'
      +'<button onclick="quitarProductoDeFactura('+i+')" style="background:var(--nbs-red-bg);color:var(--nbs-red-dark);border:none;border-radius:8px;width:36px;height:36px;cursor:pointer;font-size:15px;flex-shrink:0">✕</button>'
      +'</div>'
      +'<input type="text" value="'+it.nombre.replace(/"/g,"'")+'" id="fact-item-nombre-'+i+'" oninput="actualizarItemFacturaEdit('+i+',\'nombre\',this.value)" style="width:100%;padding:9px 10px;border:0.5px solid #d8d8dc;border-radius:8px;font-size:14px;margin-bottom:8px;box-sizing:border-box;color:var(--nbs-ink)">'
      +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">'
      +'<div><label style="font-size:11px;color:var(--nbs-muted);font-weight:500;display:block;margin-bottom:4px">Cantidad</label>'
      +'<input type="number" value="'+it.cant+'" id="fact-item-cant-'+i+'" oninput="actualizarItemFacturaEdit('+i+',\'cant\',parseInt(this.value)||1)" style="width:100%;padding:9px 10px;border:0.5px solid #d8d8dc;border-radius:8px;font-size:14px;text-align:center;box-sizing:border-box;color:var(--nbs-ink)"></div>'
      +'<div><label style="font-size:11px;color:var(--nbs-muted);font-weight:500;display:block;margin-bottom:4px">Precio ($)</label>'
      +'<input type="text" inputmode="decimal" value="'+it.precio.toFixed(2)+'" id="fact-item-precio-'+i+'" onfocus="this.select()" oninput="formatoMoneda(this);actualizarItemFacturaEdit('+i+',\'precio\',dinero(this.value)||0)" style="width:100%;padding:9px 10px;border:0.5px solid #d8d8dc;border-radius:8px;font-size:14px;text-align:center;box-sizing:border-box;color:var(--nbs-ink)"></div>'
      +'</div>';
    itemsWrap.appendChild(row);
  });

  var totalBox = document.getElementById('fact-edit-total-box');
  if(totalBox){
    var totalNuevo = items.reduce(function(s,it){ return s+(it.cant*it.precio); }, 0);
    totalBox.innerHTML = '<span style="font-size:14px;font-weight:500;color:var(--nbs-ink)">TOTAL</span><span style="font-size:18px;font-weight:500;color:var(--nbs-ink)">$'+fmtNum(totalNuevo)+'</span>';
  }

  // 💵 Y los pagos de esta factura, con su lápiz y su papelera. -15 ago-
  try { pintarPagosEnEditorFactura(window._facturaEditVid); } catch(e){}
}

function actualizarItemFacturaEdit(i, campo, valor){
  if(!window._facturaEditItems || !window._facturaEditItems[i]) return;
  window._facturaEditItems[i][campo] = valor;
  var totalBox = document.getElementById('fact-edit-total-box');
  if(totalBox){
    var totalNuevo = window._facturaEditItems.reduce(function(s,it){ return s+(it.cant*it.precio); }, 0);
    totalBox.innerHTML = '<span style="font-size:14px;font-weight:500;color:var(--nbs-ink)">TOTAL</span><span style="font-size:18px;font-weight:500;color:var(--nbs-ink)">$'+fmtNum(totalNuevo)+'</span>';
  }
}

function guardarEdicionFactura(vid){
  ventas = LS('nv', []);
  loadProds();
  var idx = ventas.findIndex(function(x){ return String(x.id)===String(vid); });
  if(idx < 0) return;
  if(!window._facturaEditItems || !window._facturaEditItems.length){ alert('La factura debe tener al menos un producto.'); return; }

  var totalAntes = ventas[idx].total;
  var tipoAntes = ventas[idx].tipo;

  // Ajustar inventario: primero restaurar lo que tenia la factura ANTES de editar,
  // luego descontar lo que tiene AHORA -asi los cambios de cantidad se reflejan bien en el stock-.
  ventas[idx].items.forEach(function(it){
    if(!it.pid) return;
    var p = productos.find(function(x){ return String(x.id)===String(it.pid); });
    if(p) p.stock = (p.stock||0) + it.cant;
  });
  window._facturaEditItems.forEach(function(it){
    if(!it.pid) return;
    var p = productos.find(function(x){ return String(x.id)===String(it.pid); });
    if(p) p.stock = (p.stock||0) - (it.cant||1);
  });
  SS('np', productos);

  ventas[idx].items = window._facturaEditItems.map(function(it){
    return { nombre: (it.nombre||'').trim(), cant: it.cant||1, precio: it.precio||0, pid: it.pid||null, costo: it.costo||0 };
  });

  var fechaEl = document.getElementById('fact-edit-fecha');
  if(fechaEl && fechaEl.value){
    var fparts = fechaEl.value.split('-'); // YYYY-MM-DD del input
    if(fparts.length === 3) ventas[idx].fecha = fparts[1]+'/'+fparts[2]+'/'+fparts[0]; // guardar como MM/DD/YYYY
  }
  var totalDespues = ventas[idx].items.reduce(function(s,it){ return s+(it.cant*it.precio); },0);
  ventas[idx].total = totalDespues;

  var mensajeExtra = '';
  // Si la factura era de CONTADO -ya pagada por completo- y el total subio al agregar productos,
  // NO se puede asumir que lo nuevo tambien esta pagado. Se convierte a credito, se registra el
  // pago que realmente se hizo -el monto original-, y la diferencia queda como saldo pendiente real.
  if(tipoAntes === 'contado' && totalDespues > totalAntes + 0.001){
    var diferencia = totalDespues - totalAntes;
    ventas[idx].tipo = 'credito';
    if(!ventas[idx].pagosFactura) ventas[idx].pagosFactura = [];
    ventas[idx].pagosFactura.push({
      monto: totalAntes,
      fecha: ventas[idx].fecha,
      nota: 'Pago original antes de agregar producto(s)'
    });
    mensajeExtra = '\n\n⚠️ Como ya se habían pagado $'+fmtNum(totalAntes)+' de esta factura, el producto nuevo agregó $'+fmtNum(diferencia)+' que el cliente TODAVÍA DEBE. La factura ahora aparece como "a crédito" con ese saldo pendiente en Cuentas por Cobrar.';
  }

  // \ud83d\udd34 Y SI EL TOTAL BAJA POR DEBAJO DE LO YA PAGADO, el sobrante va al CREDITO A
  // FAVOR del cliente. Antes se perdia. -4 sep-
  var _pagado = 0;
  (ventas[idx].pagosFactura || []).forEach(function(pp){
    if(pp && !pp.esDevolucion) _pagado += (typeof dinero === 'function') ? dinero(pp.monto) : (parseFloat(pp.monto) || 0);
  });
  _pagado = Math.round(_pagado * 100) / 100;
  if(_pagado > totalDespues + 0.005){
    var _sobra = Math.round((_pagado - totalDespues) * 100) / 100;
    var _cls = LS('ncl', []);
    var _jc = _cls.findIndex(function(x){ return String(x.id) === String(ventas[idx].cid); });
    if(_jc >= 0){
      _cls[_jc].creditoAFavor = Math.round(((parseFloat(_cls[_jc].creditoAFavor) || 0) + _sobra) * 100) / 100;
      _cls[_jc].mod = Date.now();
      SS('ncl', _cls);
      clientes = LS('ncl', []);

      // \ud83d\udd11 Y SE BAJA EL PAGO A LO QUE DE VERDAD CUBRE ESTA FACTURA. Si no, el
      // sobrante quedaria contado DOS VECES: en la factura y en el credito.
      var _falta = _sobra;
      for(var _q = (ventas[idx].pagosFactura || []).length - 1; _q >= 0 && _falta > 0.005; _q--){
        var _pg = ventas[idx].pagosFactura[_q];
        if(!_pg || _pg.esDevolucion) continue;
        var _m = (typeof dinero === 'function') ? dinero(_pg.monto) : (parseFloat(_pg.monto) || 0);
        var _quito = Math.min(_m, _falta);
        _pg.monto = Math.round((_m - _quito) * 100) / 100;
        _pg.notaAjuste = 'Se le quitaron $' + fmtNum(_quito) + ' al bajar el total; fueron a credito a favor';
        _falta = Math.round((_falta - _quito) * 100) / 100;
      }
      // Los pagos que quedaron en cero se van: no aportan nada y ensucian el historial.
      ventas[idx].pagosFactura = (ventas[idx].pagosFactura || []).filter(function(_x){
        return _x.esDevolucion || ((parseFloat(_x.monto) || 0) > 0.005);
      });
      mensajeExtra += '\n\n\u26a0\ufe0f Esta factura ten\u00eda $' + fmtNum(_pagado)
        + ' pagados y ahora es de $' + fmtNum(totalDespues) + '.\n\nLos $' + fmtNum(_sobra)
        + ' que sobran se le pusieron como CR\u00c9DITO A FAVOR a '
        + nombreCl(_cls[_jc]) + '.';
    }
  }

  SS('nv', ventas);
  window._facturaEditItems = null;
  window._facturaEditVid = null;
  window._facturaEditResultados = null;
  document.getElementById('fact-edit-overlay').style.display = 'none';
  renderFacturas(document.getElementById('fact-buscar') ? document.getElementById('fact-buscar').value : '');
  alert('✅ Factura actualizada.'+mensajeExtra);
}


// ⚠️ ESTA FUNCION BORRA VENTAS. Hasta la auditoria del 27 jul lo hacia SIN preguntar y
// SIN huella: un toque por error en el menu y las ventas se iban, sin vuelta atras.
// Ahora: (1) primero CUENTA lo que se iria y dice cuanto dinero es, (2) pide confirmacion
// enseñando los numeros, (3) pide la huella -o el PIN si no hay huella- como el resto de
// las acciones de dinero. Solo despues borra.
function borrarTodo(){
  // ===== TRIPLE CANDADO DE SEGURIDAD =====
  // Borrar TODOS los datos es la accion mas peligrosa de la app. Si alguien agarra el
  // telefono desbloqueado, NO debe poder borrar nada. Se piden 3 cosas en fila:
  //   1) Huella digital (si esta activa)  2) PIN de administrador  3) Escribir BORRAR
  // Solo si pasa las 3, se borra. Cualquier fallo o cancelacion detiene todo.
  var pedirPalabraYBorrar = function(){
    var palabra = prompt('\u26a0\ufe0f ULTIMO PASO\n\nEsto borrara TODOS tus datos y la copia en la nube. NO se puede deshacer.\n\nEscribe la palabra BORRAR (en mayusculas) para confirmar:');
    if(palabra === null) return;
    if(palabra.trim().toUpperCase() !== 'BORRAR'){ alert('La palabra no coincide. No se borro nada.'); return; }
    if(!confirm('\u00bfSeguro que quieres borrar TODO? Esta es tu ultima oportunidad de cancelar.')) return;
    ejecutarBorradoTotal();
  };
  var pedirPinYSeguir = function(){
    var pin = prompt('\ud83d\udd12 Paso 2 de 3 \u2014 PIN de administrador:');
    if(pin === null) return;
    if(!verificarPinConLimite(pin)) return;
    pedirPalabraYBorrar();
  };
  var idHuella = localStorage.getItem(CLAVE_HUELLA_ID);
  if(idHuella && window.PublicKeyCredential && navigator.credentials && navigator.credentials.get){
    navigator.credentials.get({
      publicKey: {
        challenge: retoAleatorio(),
        // \ud83d\udd11 `transports:['internal']` le dice a Android que la huella est\u00e1 EN ESTE
        // TELEFONO. Sin esto buscaba llaves externas -USB, NFC-, no encontraba ninguna
        // y fallaba SIN ABRIR EL LECTOR. -8 sep-
        allowCredentials: [{ type:'public-key', id: base64ABuffer(idHuella),
                             transports: ['internal'] }],
        userVerification: 'required',
        timeout: 60000
      }
    }).then(function(){
      pedirPinYSeguir();
    }).catch(function(e){
      console.error('Huella no verificada para borrar:', e);
      alert('No se reconocio la huella. No se borro nada.');
    });
  } else {
    pedirPinYSeguir();
  }
}

// Hace el borrado de verdad (nube + telefono). Solo se llama tras pasar los 3 candados.
function ejecutarBorradoTotal(){
  var terminarBorrado = function(){
    localStorage.clear();
    avisoGrande("Datos borrados", function(){ location.reload(); });
  };
  if(typeof fbAuth !== 'undefined' && fbAuth && fbAuth.currentUser){
    fbDb.collection('nbs_data').get().then(function(snapshot){
      var borrados = [];
      snapshot.forEach(function(doc){
        borrados.push(fbDb.collection('nbs_data').doc(doc.id).delete());
      });
      return Promise.all(borrados);
    }).then(terminarBorrado).catch(function(e){
      console.error('No se pudo borrar todo en la nube:', e);
      alert('No se pudo borrar la copia en la nube -revisa tu conexion-. El telefono no se borro.');
    });
  } else {
    terminarBorrado();
  }
}

// ══════════════════════════════════════════════════════════════
//  BOTON ATRAS DEL CELULAR  (arreglado 22 jul 2026, pedido por Sensei)
//
//  ANTES: solo funcionaba en 4 pantallas de las 26. En las otras 22 no
//  hacia nada y, peor, el telefono se quedaba sin historial y CERRABA
//  la app de golpe -aunque estuvieras a mitad de una venta-.
//
//  AHORA: hace exactamente lo mismo que el boton "<- Atras" de la app,
//  en TODAS las pantallas; nunca deja al telefono sin historial; y al
//  llegar al Inicio pregunta si de verdad quieres salir.
// ══════════════════════════════════════════════════════════════

var _saliendoApp = false;

// ═══════════════════════════════════════════════════════════════
//  EL GUARDIAN DEL BOTON ATRAS  (3er intento, 22 jul — este si)
//
//  POR QUE FALLARON LOS INTENTOS ANTERIORES:
//  Chrome tiene una proteccion llamada "history manipulation intervention".
//  Existe porque hay paginas tramposas que secuestran el boton atras.
//  Chrome MARCA COMO BASURA (skippable) cualquier entrada del historial que
//  la pagina cree SIN que el usuario haya tocado algo — y la SALTA, sin
//  siquiera avisarle al codigo. Yo ponia el guardian al cargar la app y
//  desde adentro del propio evento de atras: ninguno de los dos cuenta como
//  "toque del usuario". Por eso Chrome lo saltaba y la app se cerraba de una,
//  sin llegar nunca a mostrar el letrero.
//
//  LA SOLUCION (segun la propia documentacion de Chromium):
//  la entrada vale si hay un gesto real del usuario en el documento. Por eso
//  ahora el guardian se asegura EN CADA TOQUE de pantalla. Como Sensei toca
//  la app todo el tiempo mientras trabaja, siempre habra un guardian valido.
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
//  AVISOS GRANDES  (pedido por Sensei el 22 jul: "que sean mas legibles")
//  Reemplaza el letrero chiquito del telefono por uno propio de la app,
//  con letras grandes y un boton grande de Entendido. Si por lo que sea el
//  letrero aun no existe en la pantalla, se usa el del telefono como respaldo.
//  Los avisos se ponen en fila: si llegan dos seguidos, se ven uno tras otro.
// ═══════════════════════════════════════════════════════════════
var _alertNativo = window.alert;
var _colaAvisos = [];
var _avisoActivo = false;
var _avisoCb = null;

function mostrarSiguienteAviso(){
  if(!_colaAvisos.length){ _avisoActivo = false; return; }
  var caja = document.getElementById('aviso-caja');
  var txt  = document.getElementById('aviso-texto');
  var ov   = document.getElementById('aviso-ov');
  var a = _colaAvisos.shift();
  if(!caja || !txt || !ov){          // respaldo: el letrero del telefono
    try{ _alertNativo(a.m); }catch(e){}
    if(a.cb){ try{ a.cb(); }catch(e){} }
    setTimeout(mostrarSiguienteAviso, 50);
    return;
  }
  _avisoActivo = true;
  _avisoCb = a.cb;
  txt.innerHTML = escaparHtml(a.m).replace(/\n/g, '<br>');
  ov.style.display = 'block';
  caja.style.display = 'block';
}
function cerrarAviso(){
  var caja = document.getElementById('aviso-caja');
  var ov   = document.getElementById('aviso-ov');
  if(caja) caja.style.display = 'none';
  if(ov)   ov.style.display = 'none';
  var cb = _avisoCb; _avisoCb = null; _avisoActivo = false;
  if(cb){ try{ cb(); }catch(e){} }
  setTimeout(mostrarSiguienteAviso, 130);
}
// De aqui en adelante, TODOS los alert() de la app salen con letras grandes
window.alert = function(m){ avisoGrande(m); };

// ═══ REGISTRO DE DIAGNOSTICO DEL BOTON ATRAS ═══
// Graba en el telefono lo que va pasando. Como se guarda en localStorage,
// SOBREVIVE aunque la app se cierre: al volver a abrir se puede leer que
// paso justo antes. Es la unica forma de ver que ocurre en el telefono de
// Sensei, porque en la computadora de pruebas todo funciona.
function logAtras(txt){
  try{
    var L = JSON.parse(localStorage.getItem('nbs_log_atras') || '[]');
    var t = new Date();
    L.push(('0'+t.getHours()).slice(-2)+':'+('0'+t.getMinutes()).slice(-2)+':'+('0'+t.getSeconds()).slice(-2)
           +' | ' + txt);
    if(L.length > 80) L = L.slice(-80);
    localStorage.setItem('nbs_log_atras', JSON.stringify(L));
  }catch(e){}
}
function verLogAtras(){
  var L = [];
  try{ L = JSON.parse(localStorage.getItem('nbs_log_atras') || '[]'); }catch(e){}
  var txt = L.length ? L.join('\n') : '(vacio)';
  var w = document.getElementById('logatras-caja');
  if(!w) return;
  document.getElementById('logatras-texto').textContent = txt;
  document.getElementById('logatras-ov').style.display = 'block';
  w.style.display = 'flex';   // ARREGLADO: era block y los botones se salian de pantalla
}
function cerrarLogAtras(){
  var ov = document.getElementById('logatras-ov'), c = document.getElementById('logatras-caja');
  if(ov) ov.style.display='none';
  if(c) c.style.display='none';
}
function borrarLogAtras(){
  try{ localStorage.removeItem('nbs_log_atras'); }catch(e){}
  document.getElementById('logatras-texto').textContent = '(borrado - ahora haz tu prueba)';
}
function copiarLogAtras(){
  var t = document.getElementById('logatras-texto').textContent;
  try{
    if(navigator.clipboard) navigator.clipboard.writeText(t);
    else { var a=document.createElement('textarea'); a.value=t; document.body.appendChild(a); a.select(); document.execCommand('copy'); document.body.removeChild(a); }
    alert('Copiado. Pegalo en el chat.');
  }catch(e){ alert('No se pudo copiar. Toma una foto de la pantalla.'); }
}

function hayGuardian(){
  return !!(history.state && history.state.nbs);
}

// ── ERROR DEL 3er INTENTO, corregido aqui ──
// Antes decia: "si ya hay un guardian, no pongas otro". El problema es que
// despues de tocar atras, el guardian que quedaba lo habia creado el propio
// codigo (sin toque del usuario), o sea uno que Chrome tira a la basura. Y
// como "ya habia uno", los toques de Sensei nunca ponian uno bueno.
// AHORA: CADA toque real del usuario pone un guardian NUEVO y valido. Asi
// hay tantos guardianes como pasos haya dado, y puede tocar atras varias
// veces seguidas sin tener que tocar la pantalla entremedio.
var _ultimoGuardian = 0;
// ═══════════════════════════════════════════════════════════════════
//  🔙 EL BOTÓN ATRÁS — SIN COLCHÓN  (8 sep 2026)
//
//  🔴 POR QUÉ SE REHIZO ENTERO. Sensei, tras tres arreglos fallidos: "la app se sigue
//  cerrando cuando le doy para atrás, eso nunca lo has podido arreglar". Y además:
//  "le doy a salir de la app y no hace nada".
//
//  LOS DOS FALLOS VENÍAN DEL MISMO SITIO — el colchón de 30 pasos falsos:
//    · ATRÁS gastaba un paso cada vez. Cuando se acababan, Android cerraba la app.
//      Y rellenar el colchón no bastaba: Chrome descarta los pasos que no vienen de
//      un toque del usuario, así que bajaba más rápido de lo que subía.
//    · SALIR hacía history.go(-31) para saltarse el colchón entero, y Chrome descarta
//      un salto tan grande: no hacía nada.
//
//  🔑 LA CURA: NO HAY COLCHÓN. Un solo paso, que se repone SIEMPRE en cada atrás.
//  Con uno basta, porque nunca se llega a gastar el último.
// ═══════════════════════════════════════════════════════════════════

// Se pone el único paso que hace falta. Se llama al arrancar y tras cada atrás.
function ponerGuardianAtras(forzar){
  try {
    // \ud83d\udd11 CUANDO VIENE DEL BOT\u00d3N ATR\u00c1S se repone SIEMPRE -forzar=true-. Antes se
    // miraba "si el estado ya es nuestro, no hace falta": pero tras un atr\u00e1s el estado
    // que queda TAMBI\u00c9N es nuestro, as\u00ed que no repon\u00eda nada. Cada atr\u00e1s gastaba un
    // paso, no se repon\u00eda ninguno, y al acabarse Android cerraba la app. -8 sep-
    if(!forzar && history.state && history.state.nbs) return;
    history.pushState({ nbs: 1, t: Date.now() }, '', window.location.href);
  } catch(e){}
}

// Cuántos pasos nuestros quedan. Con el sistema nuevo solo interesa si hay 0 o más.
function profundidadGuardian(){
  try { return (history.state && history.state.nbs) ? 1 : 0; } catch(e){ return 0; }
}

var MIN_GUARDIANES = 1;      // ya no hay colchón: un solo paso
var GUARDIANES_BAJOS = 1;

function menuLateralAbierto(){
  var m = document.getElementById('menu-lateral');
  return !!(m && m.style.display && m.style.display !== 'none');
}

function hayADondeVolver(){
  if(historialPantallas && historialPantallas.length) return true;
  var actual = pantallaActual();
  if(actual && actual !== 'p-inicio') return true;
  return false;
}

window.addEventListener('popstate', function(){
  logAtras('ATRAS: pantalla=' + pantallaActual() + ' | largo=' + history.length
           + (_saliendoApp ? ' | SALIENDO' : ''));
  if(_saliendoApp) return;

  // 🔑 LO PRIMERO Y SIEMPRE: se repone el paso que Android acaba de gastar, FORZANDO.
  // Sin el `true` no repone nada, porque el estado que queda tras el atrás también es
  // nuestro. Ese era el fallo que cerraba la app. -8 sep-
  ponerGuardianAtras(true);

  // ① ¿Está abierto el letrero de salir? Atrás no hace nada: que toque una opción.
  var caja = document.getElementById('salir-box');
  if(caja && caja.style.display === 'block'){
    logAtras('  -> letrero abierto, atras ignorado');
    return;
  }

  // ② ¿Hay algún recuadro encima? Se cierra ese y ya.
  for(var i = 0; i < RECUADROS_ENCIMA.length; i++){
    var r = RECUADROS_ENCIMA[i];
    var el = document.getElementById(r.id);
    if(el && (el.style.display === 'flex' || el.style.display === 'block')){
      logAtras('  -> cerrando ' + r.id);
      try { window[r.cerrar](); } catch(e){ el.style.display = 'none'; }
      return;
    }
  }

  // ③ ¿El menú lateral abierto? Se cierra.
  if(menuLateralAbierto()){
    logAtras('  -> cerrando el menu');
    try { cerrarMenu(); } catch(e){}
    return;
  }

  // ④ ¿Estamos en una pantalla que no es Inicio? Se vuelve atrás en la app.
  if(hayADondeVolver()){
    logAtras('  -> volviendo a la pantalla anterior');
    try { volverAtras(); } catch(e){ try { ir('p-inicio'); } catch(e2){} }
    return;
  }

  // ⑤ Estamos en Inicio y no hay nada abierto: se pregunta si quiere salir.
  logAtras('  -> en inicio: se pregunta si sale');
  mostrarLetreroSalir();
});

function mostrarLetreroSalir(){
  var ov = document.getElementById('salir-ov');
  var box = document.getElementById('salir-box');
  if(!ov || !box) return;
  ov.style.display = 'block';
  box.style.display = 'block';

  // ═══ LA REGLA NUEVA (30 ago) ═══
  // \ud83d\udd34 ANTES aqui se DESHACIAN todos los guardianes para dejar la app "en el borde",
  // y asi el siguiente toque de atras la cerraba de una. Sensei lo cazo: "no deberia
  // funcionar el boton de atras por ninguna razon de ahi para alla, ahi deberian haber dos
  // opciones, quedarte o salir, pero TOCANDO las opciones". Tenia razon: el letrero
  // preguntaba y el siguiente toque salia sin esperar la respuesta.
  //
  // AHORA los guardianes SE QUEDAN. Con el letrero abierto, cada toque de atras se come un
  // guardian y no pasa nada mas -hay 20 de colchon, y se rellenan con cada toque suyo-.
  // De aqui solo se sale TOCANDO un boton.
  logAtras('LETRERO: se queda con ' + profundidadGuardian() + ' guardianes. Atras no hace nada.');
}

function cerrarLetreroSalir(){
  var ov = document.getElementById('salir-ov');
  var box = document.getElementById('salir-box');
  if(ov) ov.style.display = 'none';
  if(box) box.style.display = 'none';
  // El toque del boton viene de un gesto real, asi que se rellenan los 6
  // guardianes de colchon de una vez.
  _ultimoGuardian = 0; ponerGuardianAtras();
}

function salirDeLaApp(){
  // \ud83d\udd11 SIN COLCHON, salir es simple: se quita el paso nuestro y se va -8 sep-.
  // Antes hacia history.go(-31) para saltarse los 30 guardianes de golpe, y Chrome
  // descarta un salto tan grande: por eso "no hacia nada" y sallia el letrero otra vez.
  _saliendoApp = true;
  cerrarLetreroSalir();
  logAtras('SALIR: se pidio salir de la app');

  // \u2460 Si la app se abrio desde su icono, window.close() la cierra de verdad
  try {
    window.close();
  } catch(e){}

  // \u2461 Y si no se cerro -en el navegador normal no siempre deja-, se retrocede
  // UN paso, que es el nuestro. Eso saca al usuario de la app.
  setTimeout(function(){
    if(!_saliendoApp) return;
    try { history.back(); } catch(e){}
  }, 120);

  // \u2462 Si a los 900 ms sigue aqui, es que el navegador no deja salir. Se le dice
  // la verdad en vez de dejarlo mirando una pantalla que no hace nada.
  setTimeout(function(){
    if(!_saliendoApp) return;
    _saliendoApp = false;
    ponerGuardianAtras();
    avisoGrande('El navegador no deja que la app se cierre sola.\n\n'
      + 'Cierra la pesta\u00f1a o desliza la app hacia arriba para sacarla.');
  }, 900);
}


function capitalizarFinal(el){
  var pos = el.selectionStart;
  var val = el.value;
  var nuevo = val.replace(/(^|\s)([a-zñáéíóúü])/gi, function(m, sep, letra){ return sep + letra.toUpperCase(); });
  if(nuevo !== val){
    el.value = nuevo;
    el.setSelectionRange(pos, pos);
  }
}

function fmtTel(el){
  var v = el.value.replace(/\D/g,'');
  if(v.length > 0 && v[0]==='1') v = v.substring(1);
  if(v.length <= 3) v = '+1 '+v;
  else if(v.length <= 6) v = '+1 ('+v.substring(0,3)+') '+v.substring(3);
  else v = '+1 ('+v.substring(0,3)+') '+v.substring(3,6)+'-'+v.substring(6,10);
  el.value = v;
}

// ═══ CIFRADO DEL RESPALDO (agregado 24 jul, pedido por Sensei) ═══
// Antes el respaldo se guardaba en texto plano: cualquiera que abriera el
// archivo con una computadora veia todo -clientes, deudas, ventas- sin
// ninguna proteccion. Ahora se cifra automaticamente con la MISMA clave
// del PIN de administrador, asi que no hay que recordar una clave nueva:
// el respaldo pide el mismo PIN para poder abrirse.
async function derivarLlaveBackup(pin, salBytes){
  var enc = new TextEncoder();
  var pepper = 'NBS2::Backup::2026';
  var material = await crypto.subtle.importKey('raw', enc.encode(String(pin).trim()+pepper), {name:'PBKDF2'}, false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    {name:'PBKDF2', salt: salBytes, iterations: 150000, hash:'SHA-256'},
    material, {name:'AES-GCM', length:256}, false, ['encrypt','decrypt']
  );
}
function bytesABase64(bytes){ var bin=''; for(var i=0;i<bytes.length;i++) bin+=String.fromCharCode(bytes[i]); return btoa(bin); }
function emailFactura(v){
  var pagado = v.tipo==='credito' ? (v.pagosFactura ? (v.pagosFactura || []).filter(function(p){return typeof p.monto==='number';}).reduce(function(s,p){return s+p.monto;},0) : 0) : v.total;
  pagado = cobradoYDebeDe(v).cobrado;
  var saldo = cobradoYDebeDe(v).debe;
  var items = (v.items && (v.items || []).length) ? (v.items || []).map(function(it){ return it.nombre+' x'+it.cant+' = $'+(it.cant*it.precio).toFixed(2); }).join('\n') : '';
  var body = 'Estimado/a '+v.cn+',\n\n'
    +'Aqui el detalle de su factura de Nunez Beauty Supply:\n\n'
    +'Fecha: '+v.fecha+' '+v.hora+'\n'
    +'Tipo de pago: '+(v.tipo==='credito'?'a credito':v.tipo)+'\n\n'
    +'PRODUCTOS:\n'+items+'\n\n'
    +'Total: $'+fmtNum(v.total)+'\n'
    +'Pagado: $'+fmtNum(pagado)+'\n'
    +'Balance pendiente: $'+fmtNum(saldo)+'\n\n'
    +'Gracias por su preferencia.\nNunez Beauty Supply';
  window.location.href = 'mailto:?subject=Factura Nunez Beauty Supply - '+v.cn+'&body='+encodeURIComponent(body);
}

// Inicialización al cargar
document.addEventListener('DOMContentLoaded', function(){
  // El arranque normal de la app YA NO corre aqui directo -ahora espera a que el usuario
  // inicie sesion y se bajen los datos de la nube primero-. Ver iniciarAppDespuesDeLogin()
  // y el listener de fbAuth.onAuthStateChanged mas abajo.
  configurarPantallaLogin();
});

// ===== REPARACION DE DATOS INCOMPLETOS =====
// Si un pedido, venta o compra llega SIN su lista de productos -por un respaldo dañado, una
// sincronizacion cortada a medias, o un dato viejo incompleto-, la app se caia ENTERA al
// intentar sumarlos: la pantalla se quedaba en blanco y no podias ni entrar a borrarlo.
// Esto lo revisa al arrancar y le pone una lista vacia, para que la app siga funcionando y
// puedas ver el registro dañado y decidir que hacer con el.
function repararDatosIncompletos(){
  var reparados = 0;
  ['npedidos','nv','nc'].forEach(function(clave){
    try{
      var lista = LS(clave, null);
      if(!Array.isArray(lista)) return;
      var cambio = false;
      lista.forEach(function(o){
        if(o && !Array.isArray(o.items)){ o.items = []; cambio = true; reparados++; }
      });
      if(cambio) SS(clave, lista);
    }catch(e){ console.error('No se pudo revisar "'+clave+'":', e); }
  });
  if(reparados > 0) console.log('Se repararon '+reparados+' registro(s) que venían sin su lista de productos.');
}

// ===== LIMPIEZA UNICA DE DATOS YA GUARDADOS =====
// La app limpia el texto al GUARDAR -limpiarTexto()- desde hace tiempo, pero un dato creado
// ANTES de que eso existiera podria tener codigo HTML metido dentro. Esto lo revisa una sola
// vez y lo limpia. Solo toca lo que de verdad tenga < o >; si esta limpio, no lo toca.
function limpiarDatosGuardadosUnaVez(){
  if(localStorage.getItem('nbs_datos_limpiados') === 'si') return;
  var sucio = function(v){ return typeof v === 'string' && (v.indexOf('<') >= 0 || v.indexOf('>') >= 0); };
  var limpiados = 0;

  var limpiarLista = function(clave, campos){
    var lista = LS(clave, null);
    if(!Array.isArray(lista)) return;
    var cambio = false;
    lista.forEach(function(o){
      if(!o) return;
      campos.forEach(function(c){
        if(sucio(o[c])){ o[c] = limpiarTexto(o[c]); cambio = true; limpiados++; }
      });
      if(Array.isArray(o.items)){
        (o.items || []).forEach(function(it){
          if(it && sucio(it.nombre)){ it.nombre = limpiarTexto(it.nombre); cambio = true; limpiados++; }
        });
      }
    });
    if(cambio) SS(clave, lista);
  };

  try{
    limpiarLista('ncl', ['nombre','apellido','negocio','contacto','contactoApodo','dir','ciudad','nota']);
    limpiarLista('np', ['nombre','nombreCorto','marca','cat','desc']);
    limpiarLista('nsup', ['nombre','contacto','nota']);
    limpiarLista('nv', ['cn','nota']);
    limpiarLista('nc', ['sn','nota']);
    limpiarLista('npedidos', ['nombre','barberia']);
    limpiarLista('ntarjetas', ['nombre','banco']);
    limpiarLista('notrasdeudas', ['descripcion','nota']);
    limpiarLista('ngastos', ['descripcion','nota']);
    localStorage.setItem('nbs_datos_limpiados', 'si');
    if(limpiados > 0) console.log('Limpieza de seguridad: se limpiaron '+limpiados+' campo(s) que tenían código HTML.');
  }catch(e){
    console.error('No se pudo hacer la limpieza de seguridad:', e);
  }
}

// Número de versión VISIBLE que se muestra en el letrero de actualización.
// Se actualiza en cada entrega nueva (junto con el meta app-version).
var VERSION_VISIBLE = 'OFICIAL V2.0';

// ═══════════════════════════════════════════════════════════════════════════
//  AVISO "LA APP SE ACTUALIZÓ"  (pedido por Sensei, 19 jul 2026)
//  Cuando la app se abre y detecta que su versión cambió (porque subiste el
//  archivo actualizado a GitHub), muestra por 4 segundos un letrero que lo
//  confirma. Así sabes con certeza que tu actualización ya está cargada.
// ═══════════════════════════════════════════════════════════════════════════
function detectarActualizacion(){
  try{
    // La versión actual está en el <meta name="app-version">
    var meta = document.querySelector('meta[name="app-version"]');
    var versionActual = meta ? meta.getAttribute('content') : null;
    if(!versionActual) return;

    var versionGuardada = localStorage.getItem('nbs_version_vista');

    // Si nunca se había guardado (primera vez que se usa esto), solo se guarda,
    // sin mostrar el letrero (para no avisar de una "actualización" en la primera vez)
    if(versionGuardada === null){
      localStorage.setItem('nbs_version_vista', versionActual);
      return;
    }

    // Si la versión cambió → mostrar el letrero de actualización
    if(versionGuardada !== versionActual){
      localStorage.setItem('nbs_version_vista', versionActual);
      mostrarLetreroActualizacion();
    }
  }catch(e){}
}

// ─── AUTO-REFRESCO: revisa si hay versión nueva en GitHub y recarga sola ───
// (pedido por Sensei, 20 jul 2026). Así ya no hay que borrar caché ni hacer cierre
// forzoso: la app se actualiza sola cuando subes una versión nueva a GitHub.
function revisarVersionNueva(){
  try{
    if(!navigator.onLine) return; // sin internet no se puede revisar
    var meta = document.querySelector('meta[name="app-version"]');
    var versionActual = meta ? meta.getAttribute('content') : null;
    if(!versionActual) return;

    // Pedir el propio archivo de la app a GitHub, con un número al final para
    // saltarse la caché del navegador y traer siempre lo más nuevo.
    var url = window.location.href.split('#')[0].split('?')[0] + '?v=' + Date.now();
    fetch(url, { cache: 'no-store' })
      .then(function(resp){ return resp.ok ? resp.text() : null; })
      .then(function(html){
        if(!html) return;
        // Buscar el número de versión en el archivo que está en GitHub
        var m = html.match(/<meta name="app-version" content="([^"]*)"/);
        if(!m) return;
        var versionEnGitHub = m[1];
        // Si GitHub tiene una versión distinta (más nueva), recargar la app
        if(versionEnGitHub && versionEnGitHub !== versionActual){
          // Guardar la nueva versión para que al recargar salga el letrero
          localStorage.setItem('nbs_version_vista', versionActual); // la de ahora, para detectar el cambio al recargar
          // Recargar trayendo la versión nueva de GitHub (sin caché)
          location.reload(true);
        }
      })
      .catch(function(){ /* si falla, no pasa nada, se revisa luego */ });
  }catch(e){}
}

function mostrarLetreroActualizacion(){
  sonidoActualizacionApp();
  var d = document.createElement('div');
  // Banner discreto arriba (no pantalla completa), gris fuerte con borde negro y letras azules.
  // Achicado el 24 jul (pedido por Sensei): antes ocupaba 3 renglones con un icono grande
  // arriba; ahora son 2 renglones mas bajitos, mismo texto de siempre.
  d.style.cssText = 'position:fixed;top:12px;left:50%;transform:translateX(-50%);'
    + 'width:calc(100% - 32px);max-width:360px;background:#b8bcc8;border:2px solid #111;'
    + 'border-radius:9px;padding:8px 14px;text-align:center;z-index:99999;'
    + 'box-shadow:0 3px 11px rgba(0,0,0,0.22);animation:bajarBanner 0.35s ease';
  d.innerHTML = '<div style="font-size:14px;font-weight:700;color:#0d1547">✅ La app se actualizó — '+escaparHtml(VERSION_VISIBLE)+'</div>'
    + '<div style="font-size:11px;color:#333;margin-top:2px">Ya tienes la versión más reciente</div>';
  // Animación de entrada y salida
  var estilo = document.createElement('style');
  estilo.textContent = '@keyframes bajarBanner{from{opacity:0;transform:translateX(-50%) translateY(-16px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}'
    + '@keyframes subirBanner{from{opacity:1;transform:translateX(-50%) translateY(0)}to{opacity:0;transform:translateX(-50%) translateY(-16px)}}';
  document.head.appendChild(estilo);
  document.body.appendChild(d);
  // Desaparece a los 5 segundos (bajado de 7 a 5, pedido por Sensei el 24 jul)
  setTimeout(function(){
    d.style.animation = 'subirBanner 0.4s ease';
    setTimeout(function(){ if(d.parentNode) d.parentNode.removeChild(d); }, 400);
  }, 5000);
}

// ═══ REPARAR DATOS SUELTOS AL ARRANCAR (auditoria del 27 jul) ═══
// En la auditoria se encontro que la pantalla de FACTURAS se rompia entera
// -"Cannot read properties of undefined (reading 'map')"- si alguna venta no traia su
// lista de productos. En el archivo hay 72 usos de .items y solo 24 iban protegidos, asi
// que en vez de parchar 48 sitios uno por uno, se repara el DATO: al arrancar se recorren
// ventas, compras y pedidos y al que le falte la lista se le pone una vacia.
//
// ES A PRUEBA DE TONTOS: solo AGREGA la lista que falta. No cambia ni un numero, ni un
// precio, ni una fecha. Y si no habia nada que reparar, no guarda nada.
// ═══ LIBERAR ESPACIO (28 jul) ═══
// Las copias del telefono que se hicieron el 28 de julio llevan las fotos adentro y
// llenaron la memoria, dejando a la app sin poder guardar. Esto las tira y deja solo
// las 2 mas recientes, ya sin fotos. Corre solo si de verdad hace falta.
function tamanoDeLocalStorage(){
  var n = 0;
  try {
    for(var i = 0; i < localStorage.length; i++){
      var k = localStorage.key(i);
      var v = localStorage.getItem(k);
      n += (k.length + (v ? v.length : 0)) * 2;   // 2 bytes por caracter
    }
  } catch(e){}
  return n;
}

function liberarEspacioSiHaceFalta(){
  var TOPE = 4.2 * 1048576;               // 4,2 MB — antes de que el telefono diga basta
  var antes = tamanoDeLocalStorage();
  if(antes < TOPE) return 0;

  console.warn('Memoria casi llena (' + (antes/1048576).toFixed(2) + ' MB). Liberando...');

  // 1) Dejar solo las 2 copias mas recientes
  try {
    var copias = JSON.parse(localStorage.getItem(CLAVE_COPIAS_LOCALES) || '[]');
    if(Array.isArray(copias) && copias.length > 2){
      localStorage.setItem(CLAVE_COPIAS_LOCALES, JSON.stringify(copias.slice(0, 2)));
    }
  } catch(e){}

  // 2) Si aun asi no alcanza, quitarles las fotos a las copias que quedan
  if(tamanoDeLocalStorage() >= TOPE){
    try {
      var c2 = JSON.parse(localStorage.getItem(CLAVE_COPIAS_LOCALES) || '[]');
      c2.forEach(function(cp){ if(cp && cp.partes) delete cp.partes.np; });
      localStorage.setItem(CLAVE_COPIAS_LOCALES, JSON.stringify(c2));
    } catch(e){}
  }

  // 3) Y si todavia no, borrar las copias del todo -tus DATOS no se tocan-
  if(tamanoDeLocalStorage() >= TOPE){
    try { localStorage.removeItem(CLAVE_COPIAS_LOCALES); } catch(e){}
    try { localStorage.removeItem('nbs_huella_ultima_copia_local'); } catch(e){}
  }

  var despues = tamanoDeLocalStorage();
  var liberado = antes - despues;
  console.warn('Se liberaron ' + (liberado/1048576).toFixed(2) + ' MB. Ahora: ' + (despues/1048576).toFixed(2) + ' MB');
  return liberado;
}

// El boton, para que Sensei pueda forzarlo cuando quiera
function liberarEspacioAhora(){
  var antes = tamanoDeLocalStorage();
  var copias = 0;
  try { copias = (JSON.parse(localStorage.getItem(CLAVE_COPIAS_LOCALES) || '[]') || []).length; } catch(e){}

  if(!confirm('Vas a borrar las copias viejas que guarda el teléfono (' + copias + ').\n\n'
    + 'Tus VENTAS, CLIENTES, PRODUCTOS y FOTOS no se tocan — solo las copias de respaldo.\n\n'
    + 'Tu respaldo de la nube y los que has bajado siguen igual.\n\n¿Seguir?')) return;

  try {
    localStorage.removeItem(CLAVE_COPIAS_LOCALES);
    localStorage.removeItem('nbs_huella_ultima_copia_local');
  } catch(e){}

  var despues = tamanoDeLocalStorage();
  avisoGrande('✓ Se liberaron ' + ((antes - despues)/1048576).toFixed(2) + ' MB.\n\n'
    + 'Ahora estás usando ' + (despues/1048576).toFixed(2) + ' MB.\n\n'
    + 'Tus datos no se tocaron. El teléfono va a hacer copias nuevas solo, y ya sin fotos.');
}

function repararListasQueFaltan(){
  var arreglos = 0;

  function revisar(clave, nombreLegible){
    var lista;
    try { lista = JSON.parse(localStorage.getItem(clave) || '[]'); } catch(e){ return; }
    if(!Array.isArray(lista)) return;
    var cambio = false;
    lista.forEach(function(reg){
      if(reg && typeof reg === 'object' && !Array.isArray(reg.items)){
        reg.items = [];
        cambio = true; arreglos++;
      }
      // Los pagos de una factura, igual
      if(reg && typeof reg === 'object' && reg.pagosFactura !== undefined && !Array.isArray(reg.pagosFactura)){
        reg.pagosFactura = [];
        cambio = true; arreglos++;
      }
    });
    if(cambio){
      try { localStorage.setItem(clave, JSON.stringify(lista)); } catch(e){}
      console.warn('Reparadas listas que faltaban en ' + nombreLegible);
    }
  }

  revisar('nv', 'ventas');
  revisar('nc', 'compras');
  revisar('npedidos', 'pedidos');
  revisar('ndevoluciones', 'devoluciones');

  if(arreglos > 0) console.warn('Se repararon ' + arreglos + ' registros a los que les faltaba una lista.');
  return arreglos;
}

// \u26a1 Cuando la nube termina de bajar POR DETR\u00c1S, se refresca lo que se est\u00e9 viendo.
// As\u00ed Sensei entra al instante y, si la nube trae algo de otro aparato, aparece solo
// sin que \u00e9l espere. -12 sep-
function refrescarTrasLaNube(){
  try {
    ventas = LS('nv', []);
    clientes = LS('ncl', []);
    PRODS = []; loadProds();
    try { creditos = LS('ncr', []); } catch(e){}
  } catch(e){ return; }
  // Se repinta solo la pantalla en la que est\u00e9, sin sacarlo de donde estaba
  try {
    var p = (typeof pantallaActual === 'function') ? pantallaActual() : '';
    if(p === 'p-inicio' && typeof pintarInicio === 'function') pintarInicio();
    else if(p === 'p-cl' && typeof renderCl === 'function') renderCl('');
    else if(p === 'p-cxc' && typeof renderCxC === 'function') renderCxC('');
    else if(p === 'p-cat' && typeof renderCatalogo === 'function') renderCatalogo('');
  } catch(e){}
  try { if(typeof actualizarBarraDia === 'function') actualizarBarraDia(); } catch(e){}
}

function iniciarAppDespuesDeLogin(){
  try { repararListasQueFaltan(); } catch(e){ console.error('No se pudo reparar:', e); }
  try { liberarEspacioSiHaceFalta(); } catch(e){ console.error('No se pudo liberar espacio:', e); }
  // Las fotos se revisan por su cuenta, sin depender de si la nube gano o no -28 jul-
  setTimeout(function(){
    try { revisarFotosDeLaNube(); } catch(e){ console.error('No se pudieron revisar las fotos:', e); }
    try { descargarFotosClientesQueFaltan(); } catch(e){}
  }, 5000);
  window._appInicializada = true;
  // 📥 LOS PEDIDOS DEL CATÁLOGO -17 sep-: se recogen del buzón y, si hay nuevos, se le
  // avisa con la ventana y el sonido. Va por detrás: si no hay internet, no pasa nada.
  function _mirarElBuzon(){
    try {
      recogerPedidosDelBuzon(function(cuantos){
        if(cuantos > 0){ try { avisarPedidosNuevos(cuantos); } catch(e){} }
      });
    } catch(e){ console.warn('el buzón no respondió:', e); }
    // 💬 Y de paso el globito del chat -18 sep-: mismo reloj, cero relojes nuevos.
    try { revisarChatSinLeer(); } catch(e){}
  }
  setTimeout(_mirarElBuzon, 3000);
  // 🔑 Y CADA 2 MINUTOS -Sensei, 17 sep-: antes solo se miraba al entrar, y si tenía
  // la app abierta el pedido no llegaba hasta que se bloqueaba por inactividad.
  if(!window._relojDelBuzon){
    window._relojDelBuzon = setInterval(_mirarElBuzon, 120000);
  }
  // Y al volver a la app desde otra pantalla del teléfono
  if(!window._buzonAlVolver){
    window._buzonAlVolver = true;
    document.addEventListener('visibilitychange', function(){
      if(!document.hidden) setTimeout(_mirarElBuzon, 700);
    });
  }
  detectarActualizacion();            // muestra "LA APP SE ACTUALIZÓ" si la versión cambió
  // Revisar si hay versión nueva en GitHub: a los 8 seg de abrir, y luego cada 30 min
  setTimeout(revisarVersionNueva, 8000);
  setInterval(revisarVersionNueva, 30 * 60 * 1000);
  iniciarVigilanteDeSincronizacion(); // avisa si algo no ha subido a la nube, y reintenta solo
  iniciarCopiasAutomaticas();
  // 🤖 El asistente: su botón abajo a la derecha, y el puntito con lo que tiene que decirle
  try { setTimeout(function(){ ponerBotonAsistente(); }, 1500); } catch(eAsis){}
  // 🔑 Que el letrero diga la FECHA de la versión, no siempre "V2.0". Así Sensei
  // ve de un vistazo si su archivo subió o si el navegador tiene la copia vieja. -15 ago-
  try { ponerLetrerosDeVersion(); } catch(eVer){}
  // 🤖 LOS AUTOMATISMOS: al arrancar y cada 10 minutos. -14 ago-
  try {
    setTimeout(function(){ correrAutomatismos(); }, 4000);
    // 🔔 LA REVISIÓN DIARIA: la app se revisa sola y avisa. -15 ago-
    setTimeout(function(){ correrRevisionDiaria(); }, 6000);
    // 🔢 Repartir los códigos de registro que falten. -16 ago-
    try { asignarCodigosDeRegistro(); } catch(eCod){}
    setInterval(function(){ correrAutomatismos(); }, 600000);
  } catch(eAuto){}         // copia completa cada 2 horas + aviso si algo se borro
  repararDatosIncompletos();
  limpiarDatosGuardadosUnaVez();
  // La app abre en la pantalla de inicio, con los 6 accesos de todos los dias
  ir('p-inicio');

  // === CORRECCION UNICA: gastos guardados con la fecha en formato AAAA-MM-DD -bug ya corregido-
  // se convierten al formato MM/DD/AAAA que usa el resto de la app, para que se cuenten bien
  // en el Dashboard y en cualquier reporte.
  corregirFechasGastosViejos();

  // === SISTEMA DE RECORDATORIO DE BACKUP ===
  verificarBackup();

  // === SISTEMA DE RECORDATORIO DE VISITAS A NEGOCIOS (tiendas, meat market, etc) ===
  setTimeout(verificarVisitasNegocios, 2500);

  // === CIERRE DE SESION AUTOMATICO POR INACTIVIDAD -1 hora-, por seguridad ===
  iniciarVigilanteDeInactividad();
}

// ===== HUELLA DIGITAL -WebAuthn- =====
// Se usa la huella como CANDADO de la app: tras 15 min de inactividad se tapa la app con
// una pantalla de bloqueo que se abre con la huella, en vez de pedir correo y contraseña.
// La sesion de Firebase se mantiene viva por debajo -por eso es un candado, no un login
// completo con huella; eso ultimo requeriria el plan de pago de Firebase-.
// Si no hay huella registrada, se vuelve al comportamiento de siempre: cerrar sesion de
// verdad y pedir correo y contraseña.
var CLAVE_HUELLA_ID = 'nbs_huella_credencial';
// \u23f1\ufe0f Cu\u00e1ntos segundos puede estar fuera de la app sin que se le pida la huella.
// Sensei lo pidi\u00f3 el 8 sep: sale a mirar el WhatsApp y vuelve, y no quiere teclear
// nada para seguir vendiendo.
var SEGUNDOS_PARA_BLOQUEAR = 30;

function bufferABase64(buffer){
  var bytes = new Uint8Array(buffer);
  var binario = '';
  for(var i=0; i<bytes.byteLength; i++) binario += String.fromCharCode(bytes[i]);
  return btoa(binario);
}
function retoAleatorio(){
  var bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytes;
}

function hayHuellaRegistrada(){
  return !!localStorage.getItem(CLAVE_HUELLA_ID);
}

// Confirma que el telefono tenga lector de huella -o Face ID- disponible para el navegador
function huellaDisponibleEnEsteDispositivo(){
  if(!window.PublicKeyCredential || !navigator.credentials || !navigator.credentials.create){
    return Promise.resolve(false);
  }
  if(!PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable){
    return Promise.resolve(false);
  }
  return PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().catch(function(){ return false; });
}

function activarHuella(){
  cerrarMenuLateral();
  huellaDisponibleEnEsteDispositivo().then(function(disponible){
    if(!disponible){
      alert('Este dispositivo o navegador no tiene huella digital disponible. Necesitas un teléfono con lector de huella configurado, usando Chrome.');
      return;
    }
    // \ud83d\udd11 La huella se ata a un identificador FIJO DEL APARATO, NO al correo de la
    // sesion. Antes usaba el correo: si la sesion cambiaba, la huella dejaba de
    // coincidir y sal\u00eda "No se reconoci\u00f3 la huella". -8 sep-
    var idFijo = localStorage.getItem('nbs_id_aparato');
    if(!idFijo){
      idFijo = 'nbs-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
      localStorage.setItem('nbs_id_aparato', idFijo);
    }
    var correo = (fbAuth.currentUser && fbAuth.currentUser.email) ? fbAuth.currentUser.email : 'usuario';
    var idUsuario = new TextEncoder().encode(idFijo.substring(0, 32));
    navigator.credentials.create({
      publicKey: {
        challenge: retoAleatorio(),
        rp: { name: 'Nunez Beauty Supply' },
        user: { id: idUsuario, name: correo, displayName: correo },
        pubKeyCredParams: [{type:'public-key', alg:-7}, {type:'public-key', alg:-257}],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'preferred'
        },
        timeout: 60000,
        attestation: 'none'
      }
    }).then(function(credencial){
      localStorage.setItem(CLAVE_HUELLA_ID, bufferABase64(credencial.rawId));
      actualizarBotonHuella();
      // 🔑 Dice el tiempo QUE TIENE PUESTO, no 15 fijo. -13 sep-
      var _min = parseInt(localStorage.getItem(CLAVE_MINUTOS_BLOQUEO) || '1', 10) || 1;
      alert('\u2705 Huella activada.\n\nA partir de ahora, tras '
        + etiquetaMinutos(_min) + ' sin usar la app, se desbloquea con tu huella.\n\n'
        + 'Puedes cambiar ese tiempo en el men\u00fa \u2630, donde dice "\ud83d\udd12 Bloquear tras".');
    }).catch(function(e){
      console.error('No se pudo activar la huella:', e);
      alert('No se pudo activar la huella. Puede que la hayas cancelado, o que no esté configurada en el teléfono.');
    });
  });
}

function desactivarHuella(){
  cerrarMenuLateral();
  if(!confirm('¿Quitar la huella? La app volverá a pedirte correo y contraseña.')) return;
  localStorage.removeItem(CLAVE_HUELLA_ID);
  actualizarBotonHuella();
  alert('Huella desactivada.');
}

function actualizarBotonHuella(){
  // OJO (arreglado 22 jul): antes buscaba 'btn-huella', pero ESE id estaba
  // repetido: existia igual en la pantalla de bloqueo. Como getElementById
  // devuelve el PRIMERO, esta funcion le cambiaba el texto y el onclick al
  // boton EQUIVOCADO — el de desbloquear pasaba a decir "Quitar huella
  // digital" y, si Sensei lo tocaba, le BORRABA la huella en vez de
  // reintentarla. Ahora apunta solo al del menu de seguridad.
  var btn = document.getElementById('btn-huella-config');
  if(!btn) return;
  if(hayHuellaRegistrada()){
    btn.textContent = '👆 Quitar huella digital';
    btn.setAttribute('onclick', 'desactivarHuella()');
    btn.style.borderColor = '#888';
    btn.style.color = '#888';
  } else {
    btn.textContent = '👆 Activar huella digital';
    btn.setAttribute('onclick', 'activarHuella()');
    btn.style.borderColor = 'var(--nbs-gold, #D4A017)';
    btn.style.color = 'var(--nbs-gold-dark, #8a6a10)';
  }
}

function bloquearApp(){
  window._appBloqueada = true;
  document.getElementById('bloqueo-error').style.display = 'none';
  document.getElementById('pantalla-bloqueo').style.display = 'flex';
  document.getElementById('app-contenido').style.display = 'none';

  // Pedido por Sensei (22 jul): que NO tenga que tocar un boton para usar la huella.
  // La app pide la huella SOLA al abrir. Mientras tanto se esconden las otras
  // opciones; si la huella falla, ahi si aparecen -ver el catch de desbloquearConHuella-.
  var b1 = document.getElementById('btn-huella');
  var b2 = document.getElementById('btn-contrasena');
  var msg = document.getElementById('bloqueo-msg');
  var hayHuella = !!localStorage.getItem(CLAVE_HUELLA_ID);
  if(hayHuella){
    if(b1) b1.style.display = '';   // \ud83d\udd11 sale YA: si el lector falla, no espera -8 sep-
    // \ud83d\udd11 El enlace de correo y contrase\u00f1a NO se esconde NUNCA. El 8 sep la app se
    // qued\u00f3 colgada esperando un lector que no contest\u00f3, y sin este enlace no hab\u00eda
    // forma de entrar: tuvo que usar el modo inc\u00f3gnito.
    if(b2){
      b2.style.display = '';
      b2.style.marginTop = '26px';
    }
    if(msg) msg.textContent = 'Pon tu huella para entrar...';
    // Pequena pausa para que la pantalla alcance a dibujarse antes de pedirla
    setTimeout(function(){ desbloquearConHuella(); }, 350);
  } else {
    // Sin huella configurada: se muestran las opciones de siempre
    if(b1) b1.style.display = '';
    if(b2) b2.style.display = '';
    if(msg) msg.textContent = 'Entra con tu contrase\u00f1a para continuar';
  }
}

// Si la huella falla o Sensei la cancela, se muestran las otras opciones
function mostrarOpcionesDeBloqueo(){
  var b1 = document.getElementById('btn-huella');
  var b2 = document.getElementById('btn-contrasena');
  var msg = document.getElementById('bloqueo-msg');
  if(b1){
    b1.style.display = '';
    // Que diga exactamente lo que hace, y que lo haga (pedido de Sensei)
    b1.innerHTML = '\ud83d\udc46 Intentar de nuevo con la huella';
    b1.setAttribute('onclick', 'reintentarHuella()');
    b1.onclick = reintentarHuella;
    b1.style.background = 'var(--nbs-gold,#D4A017)';
    b1.style.color = '#fff';
    b1.style.borderColor = '';
  }
  if(b2) b2.style.display = '';
  if(msg) msg.textContent = 'Toca el bot\u00f3n para poner tu huella de nuevo';
}

// Vuelve a pedir la huella desde la pantalla de bloqueo
function reintentarHuella(){
  var err = document.getElementById('bloqueo-error');
  if(err) err.style.display = 'none';
  var msg = document.getElementById('bloqueo-msg');
  if(msg) msg.textContent = 'Pon tu huella...';
  desbloquearConHuella();
}

function desbloquearConHuella(){
  var errorEl = document.getElementById('bloqueo-error');
  errorEl.style.display = 'none';
  var idGuardado = localStorage.getItem(CLAVE_HUELLA_ID);
  if(!idGuardado){ usarContrasenaEnVezDeHuella(); return; }
  navigator.credentials.get({
    publicKey: {
      challenge: retoAleatorio(),
      // \ud83d\udd11 `transports:['internal']`: la huella est\u00e1 EN ESTE TELEFONO. Sin esto
      // Android buscaba llaves externas y fallaba SIN ABRIR EL LECTOR. -8 sep-
      allowCredentials: [{ type:'public-key', id: base64ABuffer(idGuardado),
                           transports: ['internal'] }],
      userVerification: 'required',
      timeout: 60000
    }
  }).then(function(){
    clearTimeout(window._relojHuella);
    localStorage.removeItem('nbs_fallos_huella');   // entro bien: se olvida lo anterior
    // La huella fue verificada por el propio telefono antes de devolver esto
    window._appBloqueada = false;
    registrarActividad();
    document.getElementById('pantalla-bloqueo').style.display = 'none';
    if(window._appInicializada){
      document.getElementById('app-contenido').style.display = 'block';
    } else {
      // Caso: cerraste la app y volviste tarde -la app nunca llego a arrancar-. Ahora que
      // se verifico la huella, se bajan los datos de la nube y se arranca normalmente.
      // \u26a1 Igual con la huella: entra ya, la nube detr\u00e1s. -12 sep-
      document.getElementById('app-contenido').style.display = 'block';
      iniciarAppDespuesDeLogin();
      setTimeout(function(){
        try { cargarDatosDeLaNube(function(){ try { refrescarTrasLaNube(); } catch(e){} }); }
        catch(e){ console.warn('la nube no baj\u00f3:', e); }
      }, 300);
    }
  }).catch(function(e){
    clearTimeout(window._relojHuella);
    console.error('No se pudo verificar la huella:', e);

    // \ud83d\udd11 \u00bfEs que fall\u00f3 el dedo, o es que ESTA HUELLA YA NO EXISTE en el telefono?
    // Si la credencial no existe, reintentar con ella no sirve de NADA: hay que
    // borrarla y registrar una nueva. Antes se dejaba guardada y Sensei tocaba
    // "Intentar de nuevo" una y otra vez sin que pasara nada. -8 sep-
    var texto = String((e && (e.name + ' ' + e.message)) || '');
    // 🔑 SOLO si el teléfono dice que esa credencial YA NO EXISTE. `NotAllowedError`
    // también sale cuando se cancela o se agota el tiempo, y por eso se le borraba la
    // huella a Sensei sin motivo. -13 sep-
    var yaNoExiste = /InvalidStateError|NotSupportedError|no credentials|not found|not registered/i.test(texto);

    // Se cuentan los fallos seguidos: si falla 3 veces, la huella no sirve aunque el
    // error no lo diga claro
    var fallos = (parseInt(localStorage.getItem('nbs_fallos_huella') || '0', 10) || 0) + 1;
    localStorage.setItem('nbs_fallos_huella', String(fallos));

    // 🔑 Y los fallos normales YA NO la borran: se queda, y él vuelve a intentarlo.
    // Antes 3 fallos seguidos —dedo mojado, lector sucio— le costaban la huella. -13 sep-
    if(yaNoExiste){
      // \ud83d\uddd1\ufe0f SE BORRA la huella que ya no sirve, para no seguir dando vueltas
      localStorage.removeItem(CLAVE_HUELLA_ID);
      localStorage.removeItem('nbs_fallos_huella');
      try { actualizarBotonHuella(); } catch(e2){}
      var m3 = document.getElementById('bloqueo-msg');
      if(m3) m3.textContent = 'Esta huella ya no sirve en este tel\u00e9fono';
      errorEl.innerHTML = 'Entra con tu <b>correo y contrase\u00f1a</b>, y vuelve a '
        + 'activar la huella en el men\u00fa, en SEGURIDAD.';
      errorEl.style.display = 'block';
      var bh = document.getElementById('btn-huella');
      if(bh) bh.style.display = 'none';       // reintentar no sirve de nada
      var bc = document.getElementById('btn-contrasena');
      if(bc){ bc.style.display = ''; bc.style.marginTop = '26px'; }
      logAtras('HUELLA: la credencial ya no existe, se borro');
      return;
    }

    errorEl.textContent = 'No se reconoci\u00f3 la huella. Prueba otra vez.';
    errorEl.style.display = 'block';
    mostrarOpcionesDeBloqueo();   // aqui si aparecen el boton y la contraseña
  });

  // \ud83d\udd11 EL TERCER CAMINO, el que faltaba -8 sep-. Si el lector NUNCA contesta -ni
  // acierta ni falla-, la app se quedaba colgada con los botones escondidos y Sensei no
  // pod\u00eda entrar de ninguna forma. A los 8 segundos salen las otras opciones.
  clearTimeout(window._relojHuella);
  window._relojHuella = setTimeout(function(){
    if(!window._appBloqueada) return;                 // ya entr\u00f3, no hay nada que hacer
    var b = document.getElementById('btn-huella');
    if(b && b.style.display !== 'none') return;       // los botones ya est\u00e1n a la vista
    var msg = document.getElementById('bloqueo-msg');
    if(msg) msg.textContent = 'El lector de huella no respondi\u00f3';
    mostrarOpcionesDeBloqueo();
  }, window._msRelojHuella || 2000);
}

// \ud83d\udd11 ENTRAR CON EL PIN, sin depender del lector ni del correo. -8 sep-
function entrarConPinDesdeBloqueo(){
  pedirPinConRecuadro('Entra a tu app con el PIN.', function(){
    window._appBloqueada = false;
    localStorage.removeItem('nbs_fallos_huella');
    var pb = document.getElementById('pantalla-bloqueo');
    if(pb) pb.style.display = 'none';
    var ac = document.getElementById('app-contenido');
    if(ac) ac.style.display = 'block';
    try { logAtras('ENTRO con el PIN'); } catch(e){}
  });
}

function usarContrasenaEnVezDeHuella(){
  window._appBloqueada = false;
  document.getElementById('pantalla-bloqueo').style.display = 'none';
  try{ localStorage.removeItem(CLAVE_ULTIMA_ACTIVIDAD); }catch(e){}
  fbAuth.signOut().catch(function(e){ console.error('Error al cerrar sesion:', e); });
}

// Cierra la sesion sola si pasan 15 minutos completos sin ningun toque, clic, o tecla -por
// seguridad, para que el telefono no se quede con la sesion abierta indefinidamente si
// se pierde o alguien mas lo toma-. Cualquier interaccion reinicia el conteo desde cero.
//
// IMPORTANTE -por que se guarda una marca de tiempo en vez de usar solo un temporizador-:
// los telefonos SUSPENDEN los temporizadores cuando la app se manda al fondo o se apaga la
// pantalla, asi que un setTimeout solo NO se dispara de forma confiable. Ademas, si la app
// se cierra y se vuelve a abrir, un temporizador arrancaria de cero y nunca vencería.
// Guardando la hora de la ultima actividad, se puede comparar contra la hora actual en
// cualquier momento -al volver a la app, al abrirla de nuevo, o cada 20 segundos- y cerrar
// la sesion de verdad si ya se paso del limite.
// El tiempo de bloqueo se puede cambiar desde el menu -asi se puede probar con 1 minuto sin
// tener que tocar el codigo, y cambiarlo cualquier dia segun te convenga-. Por defecto 15 min.
var CLAVE_MINUTOS_BLOQUEO = 'nbs_minutos_bloqueo';
// Bloqueo inmediato: si está activado, la app se bloquea (pide huella) CADA VEZ que sales
// y vuelves, aunque sea por segundos. Da la máxima seguridad.
var CLAVE_BLOQUEO_INMEDIATO = 'nbs_bloqueo_inmediato';
var CLAVE_BLOQUEO_INMEDIATO_PENDIENTE = 'nbs_bloqueo_inmediato_pendiente';
function bloqueoInmediatoActivado(){
  return localStorage.getItem(CLAVE_BLOQUEO_INMEDIATO) === '1';
}
function toggleBloqueoInmediato(){
  if(!hayHuellaRegistrada()){
    alert('Primero activa la huella digital. El bloqueo inmediato usa tu huella para desbloquear.');
    renderToggleBloqueoInmediato();
    return;
  }
  var nuevo = bloqueoInmediatoActivado() ? '0' : '1';
  localStorage.setItem(CLAVE_BLOQUEO_INMEDIATO, nuevo);
  renderToggleBloqueoInmediato();
  if(nuevo === '1'){
    alert('✅ Bloqueo inmediato activado. Cada vez que salgas y vuelvas a la app, te pedirá la huella.');
  }
}
function renderToggleBloqueoInmediato(){
  var txt = document.getElementById('bloqueo-inmediato-status');
  var knob = document.getElementById('bloqueo-inmediato-knob');
  var sw = document.getElementById('bloqueo-inmediato-switch');
  if(!txt || !knob || !sw) return;
  var on = bloqueoInmediatoActivado();
  txt.textContent = on ? 'Activado' : 'Desactivado';
  sw.style.background = on ? '#2E7D32' : '#d8d8dc';
  knob.style.left = on ? '23px' : '3px';
}
var PRESETS_BLOQUEO = [1, 5, 10, 15, 20, 30, 45, 60, 90, 120];

function limiteInactividadMs(){
  var mins = parseInt(localStorage.getItem(CLAVE_MINUTOS_BLOQUEO) || '1', 10);
  if(!mins || mins < 1) mins = 1;
  return mins * 60 * 1000;
}

function etiquetaMinutos(m){
  if(m === 1) return '1 minuto';
  if(m < 60) return m + ' min';
  if(m === 60) return '1 hora';
  if(m % 60 === 0) return (m/60) + ' horas';
  return Math.floor(m/60) + 'h ' + (m%60) + 'min';
}

// Arma el selector del menu. Si tienes un tiempo personalizado -por ejemplo 37 min-, se agrega
// solo a la lista para que lo veas elegido, aunque no sea uno de los tiempos comunes.
function renderSelectorBloqueo(){
  var sel = document.getElementById('sel-minutos-bloqueo');
  if(!sel) return;
  var actual = parseInt(localStorage.getItem(CLAVE_MINUTOS_BLOQUEO) || '1', 10);
  if(!actual || actual < 1) actual = 1;
  var valores = PRESETS_BLOQUEO.slice();
  if(valores.indexOf(actual) < 0) valores.push(actual);
  valores.sort(function(a,b){ return a-b; });
  sel.innerHTML = '';
  valores.forEach(function(m){
    var o = document.createElement('option');
    o.value = String(m);
    o.textContent = etiquetaMinutos(m);
    if(m === actual) o.selected = true;
    sel.appendChild(o);
  });
  var otro = document.createElement('option');
  otro.value = 'otro';
  otro.textContent = '✏️ Otro...';
  sel.appendChild(otro);
}

function cambiarMinutosBloqueo(valor){
  if(valor === 'otro'){
    var r = prompt('¿Cuántos minutos sin usar la app antes de que se bloquee?\n\nEscribe el número que quieras (ejemplo: 45)');
    if(r === null){ renderSelectorBloqueo(); return; } // cancelo, se deja como estaba
    var m = parseInt(r, 10);
    if(!m || m < 1 || m > 480){
      alert('Escribe un número entre 1 y 480 minutos (8 horas).');
      renderSelectorBloqueo();
      return;
    }
    localStorage.setItem(CLAVE_MINUTOS_BLOQUEO, String(m));
    renderSelectorBloqueo();
    registrarActividad();
    alert('✅ La app se bloqueará tras ' + etiquetaMinutos(m) + ' sin usarla.');
    return;
  }
  var mins = parseInt(valor, 10);
  if(!mins || mins < 1) mins = 1;
  localStorage.setItem(CLAVE_MINUTOS_BLOQUEO, String(mins));
  renderSelectorBloqueo();
  registrarActividad(); // reiniciar el conteo con el tiempo nuevo
}

function bloquearAhora(){
  cerrarMenuLateral();
  if(hayHuellaRegistrada()){
    bloquearApp();
  } else {
    if(!confirm('No tienes huella activada, así que se cerrará la sesión y tendrás que entrar con tu correo y contraseña. ¿Continuar?')) return;
    try{ localStorage.removeItem(CLAVE_ULTIMA_ACTIVIDAD); }catch(e){}
    fbAuth.signOut().catch(function(e){ console.error('Error al cerrar sesion:', e); });
  }
}
var CLAVE_ULTIMA_ACTIVIDAD = 'nbs_ultima_actividad';
var intervaloVigilante = null;

function registrarActividad(){
  if(window._appBloqueada) return; // estando bloqueada, tocar la pantalla no cuenta como actividad
  try{ localStorage.setItem(CLAVE_ULTIMA_ACTIVIDAD, String(Date.now())); }catch(e){}
}

function sesionVencidaPorInactividad(){
  var ultima = parseInt(localStorage.getItem(CLAVE_ULTIMA_ACTIVIDAD) || '0', 10);
  if(!ultima) return false; // nunca se registro actividad -sesion recien iniciada-
  return (Date.now() - ultima) >= limiteInactividadMs();
}

// Al vencerse el tiempo: si hay huella registrada, se BLOQUEA la app -mas comodo-; si no,
// se cierra la sesion de verdad y se piden correo y contraseña -mas estricto-.
function cerrarSesionPorInactividad(){
  if(typeof fbAuth === 'undefined' || !fbAuth || !fbAuth.currentUser) return;
  if(hayHuellaRegistrada()){
    bloquearApp();
    return;
  }
  try{ localStorage.removeItem(CLAVE_ULTIMA_ACTIVIDAD); }catch(e){}
  fbAuth.signOut().catch(function(e){ console.error('Error al cerrar sesion por inactividad:', e); });
}

function revisarInactividad(){
  if(window._appBloqueada) return; // ya esta bloqueada, no hay nada que hacer
  if(sesionVencidaPorInactividad()) cerrarSesionPorInactividad();
}

function iniciarVigilanteDeInactividad(){
  registrarActividad();
  actualizarBotonHuella();
  renderSelectorBloqueo(); // deja el selector del menu mostrando el tiempo que ya tenias elegido
  ['click','touchstart','keydown','scroll','mousemove'].forEach(function(evento){
    document.addEventListener(evento, registrarActividad, {passive:true});
  });
  // Revisar cada 20 segundos mientras la app este abierta y en uso
  if(intervaloVigilante) clearInterval(intervaloVigilante);
  intervaloVigilante = setInterval(revisarInactividad, 20000);
  // Y revisar tambien en el momento exacto en que la app vuelve al frente -al volver de otra
  // app, o al prender la pantalla-, que es justo cuando los temporizadores fallan.
  document.addEventListener('visibilitychange', function(){
    if(document.visibilityState === 'visible') revisarInactividad();
  });
  window.addEventListener('focus', revisarInactividad);
}

// ===== LOGIN Y SINCRONIZACION CON LA NUBE =====

function cerrarSesionNBS(){
  cerrarMenuLateral();
  if(!confirm('¿Cerrar sesión? Vas a necesitar tu correo y contraseña para volver a entrar.')) return;
  fbAuth.signOut().then(function(){
    // No se borra nada de localStorage -tus datos siguen en la nube y en este dispositivo-,
    // solo se cierra la sesion. La pantalla de login se muestra sola gracias al listener
    // de onAuthStateChanged que ya esta escuchando este cambio.
  }).catch(function(e){
    console.error('Error al cerrar sesion:', e);
    alert('No se pudo cerrar sesión. Intenta de nuevo.');
  });
}

function configurarPantallaLogin(){
  // \ud83d\udd11 La versi\u00f3n, VISIBLE antes de entrar. As\u00ed Sensei ve de un vistazo si Chrome le
  // est\u00e1 dando el archivo nuevo o una copia vieja. -11 sep-
  try {
    var mv = document.querySelector('meta[name="app-version"]');
    var cont = mv ? (mv.getAttribute('content') || '') : '';
    var ev = document.getElementById('login-version');
    if(ev && cont){
      var t = cont.split('-')[0];                       // 20260911e
      ev.textContent = 'v' + t.slice(6, 8) + '/' + t.slice(4, 6) + t.slice(8).toUpperCase();
    }
  } catch(e){}

  document.getElementById('login-pass').addEventListener('keydown', function(e){
    if(e.key === 'Enter') intentarLogin();
  });

  // \ud83d\udd11 Mientras la nube no llegue, el bot\u00f3n lo dice. As\u00ed no toca a ciegas. -11 sep-
  var btn = document.querySelector('[onclick="intentarLogin()"]');
  if(btn && typeof window._firebaseListo !== 'undefined' && !window._firebaseListo){
    var textoOriginal = btn.textContent;
    btn.textContent = 'Conectando\u2026';
    btn.style.opacity = '.65';
    if(typeof cuandoHayaFirebase === 'function'){
      cuandoHayaFirebase(function(){
        btn.textContent = textoOriginal || 'Entrar';
        btn.style.opacity = '1';
      });
    }
  }
  // \u26a1 Firebase ahora llega POR DETR\u00c1S, as\u00ed que se espera a que est\u00e9. Antes bloqueaba
  // el arranque y Sensei esperaba 4 segundos con un cliente delante. -11 sep-
  if(typeof cuandoHayaFirebase === 'function'){
    cuandoHayaFirebase(engancharSesion);
  } else {
    engancharSesion();
  }
}

function engancharSesion(){
  if(typeof fbAuth === 'undefined' || !fbAuth) return;
  fbAuth.onAuthStateChanged(function(user){
    if(user){
      // Firebase recuerda la sesion aunque se cierre la app por completo. Aqui se revisa
      // PRIMERO si ya pasaron los 15 minutos de inactividad -por ejemplo, si cerraste la
      // app y volviste 20 minutos despues-. Si se paso del limite: con huella registrada
      // se muestra la pantalla de bloqueo; sin huella, se cierra la sesion de verdad.
      if(sesionVencidaPorInactividad()){
        if(hayHuellaRegistrada()){
          document.getElementById('pantalla-login').style.display = 'none';
          bloquearApp();
        } else {
          cerrarSesionPorInactividad();
        }
        return;
      }
      document.getElementById('login-cargando').style.display = 'none';
      document.getElementById('login-error').style.display = 'none';
      // \u26a1 SE ENTRA YA, con los datos del tel\u00e9fono. La nube baja POR DETR\u00c1S.
      // Antes se esperaba hasta 15 s mirando "Entrando...". -12 sep-
      document.getElementById('pantalla-login').style.display = 'none';
      document.getElementById('app-contenido').style.display = 'block';
      iniciarAppDespuesDeLogin();
      setTimeout(function(){
        try { cargarDatosDeLaNube(function(){ try { refrescarTrasLaNube(); } catch(e){} }); }
        catch(e){ console.warn('la nube no baj\u00f3:', e); }
      }, 300);
    } else {
      // \ud83d\udd11 SIN SESI\u00d3N, PERO CON HUELLA: se le pide la huella, no el correo.
      // Firebase pierde la sesi\u00f3n sola tras d\u00edas sin abrir, y Sensei acababa
      // escribiendo correo y contrase\u00f1a cada vez. -13 sep-
      if(hayHuellaRegistrada()){
        window._appBloqueada = true;
        document.getElementById('pantalla-login').style.display = 'none';
        document.getElementById('login-cargando').style.display = 'none';
        bloquearApp();
        return;
      }
      window._appBloqueada = false;
      document.getElementById('pantalla-bloqueo').style.display = 'none';
      document.getElementById('pantalla-login').style.display = 'flex';
      document.getElementById('app-contenido').style.display = 'none';
      document.getElementById('login-cargando').style.display = 'none';
    }
  });
}

function intentarLogin(){
  var email = document.getElementById('login-email').value.trim();
  var pass = document.getElementById('login-pass').value;
  var errorEl = document.getElementById('login-error');
  errorEl.style.display = 'none';
  if(!email || !pass){
    errorEl.textContent = 'Ingresa tu correo y contraseña.';
    errorEl.style.display = 'block';
    return;
  }
  // Marcar actividad AHORA, antes de iniciar sesion, para que la revision de inactividad
  // que corre justo despues no vea una marca vieja y cierre la sesion recien abierta.
  registrarActividad();
  document.getElementById('login-cargando').style.display = 'block';
  // Limite de tiempo de espera -12 segundos-: si Firebase nunca responde -por ejemplo,
  // sin internet o algun problema de conexion-, se muestra un error claro en vez de
  // quedarse trabado en "Entrando..." para siempre.
  var seAgotoElTiempo = false;
  var temporizador = setTimeout(function(){
    seAgotoElTiempo = true;
    document.getElementById('login-cargando').style.display = 'none';
    errorEl.textContent = 'No se pudo conectar. Revisa tu conexión a internet e intenta de nuevo.';
    errorEl.style.display = 'block';
  }, 12000);
  // \ud83d\udd11 Firebase llega por detr\u00e1s: si todav\u00eda no est\u00e1, se espera a que llegue en vez
  // de reventar. Antes esto dejaba el "Entrando..." colgado para siempre. -11 sep-
  function entrarDeVerdad(){
    if(typeof fbAuth === 'undefined' || !fbAuth){
      clearTimeout(temporizador);
      document.getElementById('login-cargando').style.display = 'none';
      errorEl.textContent = 'La nube no arranc\u00f3. Revisa tu internet y vuelve a intentar.';
      errorEl.style.display = 'block';
      return;
    }
    fbAuth.signInWithEmailAndPassword(email, pass).then(function(){
      clearTimeout(temporizador);
    }).catch(function(e){
    clearTimeout(temporizador);
    if(seAgotoElTiempo) return; // ya se mostro el mensaje de tiempo agotado, no pisarlo
      document.getElementById('login-cargando').style.display = 'none';
      errorEl.textContent = 'Correo o contrase\u00f1a incorrectos.';
      errorEl.style.display = 'block';
    });
  }

  // Si Firebase ya est\u00e1, entra ya. Si no, espera a que llegue.
  if(typeof cuandoHayaFirebase === 'function') cuandoHayaFirebase(entrarDeVerdad);
  else entrarDeVerdad();
}

// ═══════════════════════════════════════════════════════════════
//  RECUPERAR LA CONTRASEÑA POR CORREO  (pedido por Sensei, 22 jul)
//  Firebase manda un correo con un enlace para poner una contraseña nueva.
//  No hace falta nada mas: ni servidor propio ni configuracion extra.
// ═══════════════════════════════════════════════════════════════
function recuperarContrasena(){
  var campo = document.getElementById('login-email');
  var email = (campo && campo.value ? campo.value : '').trim();
  var errorEl = document.getElementById('login-error');

  if(!email){
    avisoGrande('Escribe primero tu correo electr\u00f3nico arriba, y despu\u00e9s toca "\u00bfOlvidaste tu contrase\u00f1a?".');
    if(campo) campo.focus();
    return;
  }
  if(email.indexOf('@') < 0){
    avisoGrande('Ese correo no se ve bien escrito. Rev\u00edsalo e intenta otra vez.');
    if(campo) campo.focus();
    return;
  }
  if(typeof fbAuth === 'undefined' || !fbAuth){
    avisoGrande('No hay conexi\u00f3n con el servidor. Rev\u00edsa tu internet e intenta de nuevo.');
    return;
  }

  if(errorEl){ errorEl.style.display = 'none'; }
  avisoGrande('\ud83d\udce7 Enviando el correo a:\n\n' + email + '\n\nEspera un momento...');

  fbAuth.sendPasswordResetEmail(email).then(function(){
    avisoGrande('\u2705 LISTO\n\nSe envi\u00f3 un correo a:\n' + email +
      '\n\nAbrelo y toca el enlace para poner una contrase\u00f1a nueva.\n\n' +
      'Si no lo ves en unos minutos, revisa la carpeta de SPAM o correo no deseado.');
  }).catch(function(e){
    var codigo = (e && e.code) ? e.code : '';
    var msg;
    if(codigo === 'auth/user-not-found'){
      msg = 'No hay ninguna cuenta con ese correo.\n\nRevisa que est\u00e9 bien escrito.';
    } else if(codigo === 'auth/invalid-email'){
      msg = 'Ese correo no es v\u00e1lido. Rev\u00edsalo e intenta otra vez.';
    } else if(codigo === 'auth/too-many-requests'){
      msg = 'Se hicieron muchos intentos seguidos.\n\nEspera unos minutos e intenta de nuevo.';
    } else if(codigo === 'auth/network-request-failed'){
      msg = 'No hay internet.\n\nCon\u00e9ctate e intenta otra vez.';
    } else {
      msg = 'No se pudo enviar el correo.\n\nRevisa tu conexi\u00f3n e intenta de nuevo.';
    }
    avisoGrande('\u26a0\ufe0f ' + msg);
    console.error('Error al enviar el correo de recuperacion:', e);
  });
}

function ponerLetrerosDeVersion(){
  try {
    var meta = document.querySelector('meta[name=app-version]');
    if(!meta) return;
    var f = String(meta.content || '').match(/^(\d{4})(\d{2})(\d{2})([a-z]?)/);
    if(!f) return;
    var corta = 'v' + f[3] + '/' + f[2] + (f[4] ? f[4].toUpperCase() : '');
    var bv = document.getElementById('badge-version');
    if(bv) bv.textContent = corta;
  } catch(e){}
}
if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', ponerLetrerosDeVersion);
} else {
  ponerLetrerosDeVersion();
}

function verQueVersionTengo(){
  var meta = document.querySelector('meta[name=app-version]');
  var cruda = meta ? String(meta.content || '') : '(no la encuentro)';
  var f = cruda.match(/^(\d{4})(\d{2})(\d{2})([a-z]?)/);
  var bonita = f
    ? (f[3] + ' de ' + ['','enero','febrero','marzo','abril','mayo','junio','julio','agosto',
        'septiembre','octubre','noviembre','diciembre'][parseInt(f[2],10)] + ' de ' + f[1]
        + (f[4] ? ', entrega ' + f[4].toUpperCase() : ''))
    : cruda;
  avisoGrande('\u2139\ufe0f LA VERSI\u00d3N QUE TIENES\n\n' + bonita
    + '\n\nCompleta: ' + cruda
    + '\n\n\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n'
    + 'Si acabas de subir un archivo nuevo y aqu\u00ed sigue saliendo el viejo, el tel\u00e9fono te est\u00e1 '
    + 'dando su copia guardada.\n\nARR\u00c9GLALO AS\u00cd: cierra la app del todo y vu\u00e9lvela a abrir. '
    + 'Si sigue igual, \u00e1brela desde el navegador y recarga la p\u00e1gina.');
}

function reintentarYDecirmeElError(){
  var _quePendiente = nombresPendientesDeSubir();
  var _lista = _quePendiente.length
    ? ('\n\nEsperando: ' + _quePendiente.map(function(k){ return nombreBonitoDeClave(k); }).join(', '))
    : '';

  // Antes estos dos casos tambien se salian callados cuando se tocaba el aviso naranja.
  if(typeof fbAuth === 'undefined' || !fbAuth || !fbAuth.currentUser){
    avisoGrande('\u2601\ufe0f No estas conectado a la nube.\n\nEntra con tu correo y clave y se sube '
      + 'solo. Mientras tanto tus datos NO se pierden: estan guardados en el telefono.' + _lista);
    return;
  }
  if(!navigator.onLine){
    avisoGrande('\ud83d\udcf4 No hay internet.\n\nEn cuanto vuelva la se\u00f1al se sube solo, no '
      + 'tienes que hacer nada. Tus datos estan guardados en el telefono.' + _lista);
    return;
  }
  if(!_quePendiente.length){
    limpiarPendientesQueNoSonDatos();
    actualizarAvisoPendientes();
    avisoGrande('\u2705 Ya no hay nada pendiente. Todo esta en la nube.');
    return;
  }

  try { localStorage.removeItem('nbs_fallos_subida'); } catch(e){}
  var antes = hayPendientesDeSubir();
  mostrarCargandoRuta('\u2601\ufe0f Reintentando de verdad...');

  subirPendientes();

  setTimeout(function(){
    cerrarCargandoRuta();
    var despues = hayPendientesDeSubir();
    var fallos = {};
    try { fallos = JSON.parse(localStorage.getItem('nbs_fallos_subida') || '{}'); } catch(e){}
    var nombres = Object.keys(fallos);

    var t = [];
    t.push('\u2601\ufe0f REINTENTO DE VERDAD\n');
    t.push('Pendientes antes:   ' + antes);
    t.push('Pendientes ahora:   ' + despues);
    t.push('');

    if(!nombres.length && despues === 0){
      t.push('\u2705 SUBIO TODO. Ya no queda nada pendiente.');
    } else if(!nombres.length && despues > 0){
      t.push('\u23f3 Quedan ' + despues + ' pendientes y NINGUNO dio error todavia.');
      t.push('');
      // \ud83d\udd11 DECIRLE QUE ES LO QUE ESTA ATASCADO Y CUANTO PESA. -4 sep-
      var _atascados = nombresPendientesDeSubir();
      if(_atascados.length){
        t.push('LO QUE FALTA POR SUBIR:');
        _atascados.slice(0, 8).forEach(function(k){
          var kb = 0;
          try { kb = Math.round((localStorage.getItem(k) || '').length / 1024); } catch(e){}
          t.push('\u2022 ' + nombreBonitoDeClave(k) + '   (' + kb + ' KB)');
        });
        t.push('');
      }
      t.push('Puede que sigan subiendo. La app avisa sola en cuanto');
      t.push('terminen, o te dira el error si lo hay.');
      t.push('');
      t.push('\ud83d\udee1\ufe0f TUS DATOS NO SE PIERDEN: estan guardados en el');
      t.push('telefono. Si quieres estar tranquilo, baja un backup');
      t.push('desde el Menu, en SEGURIDAD.');
    } else {
      t.push('\ud83d\udd34 ESTAS NO PUDIERON SUBIR:\n');
      nombres.slice(0, 6).forEach(function(k){
        var f = fallos[k];
        t.push('\u2022 ' + nombreBonitoDeClave(k) + '  [' + k + ']   (' + Math.round(f.bytes/1024) + ' KB)');
        // \ud83d\udd0e Lo que hacia falta para saber POR QUE. -28 ago-
        if(f.como) t.push('   por donde fue: ' + f.como);
        if(f.crudoKB !== undefined) t.push('   sin comprimir: ' + f.crudoKB + ' KB');
        if(f.sabeComprimir !== undefined) t.push('   \u00bfsabe comprimir?: ' + (f.sabeComprimir ? 'S\u00cd' : 'NO'));
        t.push('   ' + f.codigo);
        t.push('   ' + f.mensaje);
        t.push('');
      });
      if(nombres.length > 6) t.push('...y ' + (nombres.length - 6) + ' mas.');
      t.push('MANDAME ESTA PANTALLA.');
    }
    // \ud83d\udee1\ufe0f Y el rescate: si no sube, que pueda guardar sus datos igual. -4 sep-
    if(despues > 0){
      mostrarAvisoConBackup(t.join('\n'));
    } else {
      avisoGrande(t.join('\n'));
    }
  }, 22000);   // \u23f1\ufe0f 22 s: el tope del envio son 20, hay que esperarlo o no se ve el fallo
}

// \ud83d\udcbe Un aviso con boton para bajar el backup. Se usa cuando algo no sube a la nube:
// asi Sensei puede guardar sus datos en un archivo aunque la nube este fallando. -4 sep-
function mostrarAvisoConBackup(texto){
  var ov = document.getElementById('aviso-backup-overlay');
  if(!ov){
    ov = document.createElement('div');
    ov.id = 'aviso-backup-overlay';
    document.body.appendChild(ov);
  }
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:2000002;'
    + 'display:flex;align-items:center;justify-content:center;padding:14px';
  ov.onclick = function(e){ if(e.target === ov) cerrarAvisoConBackup(); };
  ov.innerHTML = '<div style="background:#fff;border-radius:15px;padding:16px;max-width:440px;'
    + 'width:100%;max-height:88vh;overflow:auto">'
    + '<div style="font-size:12.5px;color:#222;white-space:pre-wrap;line-height:1.5">'
    +   escaparHtml(String(texto || '')) + '</div>'
    + '<button onclick="cerrarAvisoConBackup();exportD()" style="width:100%;padding:13px;'
    +   'margin-top:14px;background:#E65100;color:#fff;border:none;border-radius:10px;'
    +   'font-size:14px;font-weight:800;cursor:pointer">'
    +   '\ud83d\udcbe Bajar un backup ahora mismo</button>'
    + '<button onclick="cerrarAvisoConBackup()" style="width:100%;padding:12px;margin-top:8px;'
    +   'background:#1a237e;color:#fff;border:none;border-radius:10px;font-size:13.5px;'
    +   'font-weight:800;cursor:pointer">Entendido</button>'
    + '</div>';
  ov.style.display = 'flex';
}

function cerrarAvisoConBackup(){
  var ov = document.getElementById('aviso-backup-overlay');
  if(ov) ov.style.display = 'none';
}

function traerLoNuevo(){
  if(_trayendo) return;
  if(typeof fbAuth === 'undefined' || !fbAuth || !fbAuth.currentUser){
    avisoGrande('\u26a0\ufe0f No hay sesi\u00f3n de la nube todav\u00eda.\n\nEspera unos segundos y vuelve a intentar.');
    return;
  }
  if(!navigator.onLine){
    avisoGrande('\u26a0\ufe0f No hay internet.\n\nLo que hayas guardado se sube solo en cuanto vuelva la se\u00f1al.');
    return;
  }

  _trayendo = true;
  var btn = document.getElementById('btn-traer-nuevo');
  var textoAntes = btn ? btn.innerHTML : '';
  if(btn){ btn.innerHTML = '\u23f3 Trayendo...'; btn.disabled = true; }

  // Lo que había ANTES, para poder decirle qué llegó
  var antes = {};
  CLAVES_A_RESPALDAR.forEach(function(k){
    try {
      var v = JSON.parse(localStorage.getItem(k) || '[]');
      antes[k] = Array.isArray(v) ? v.length : 0;
    } catch(e){ antes[k] = 0; }
  });

  var terminar = function(){
    _trayendo = false;
    if(btn){ btn.innerHTML = textoAntes; btn.disabled = false; }
  };

  // 1) Primero SUBIR lo que este aparato tenga pendiente, para no perderlo
  try { subirPendientes(); } catch(e){}

  setTimeout(function(){
    // 2) Y ahora bajar y fundir
    try {
      cargarDatosDeLaNube(function(){
        try {
          // Recargar todo lo que la app tiene en memoria
          ventas = LS('nv', []);
          clientes = LS('ncl', []);
          PRODS = []; loadProds();
          try { creditos = LS('ncr', []); } catch(e){}
          try { pedidos = LS('npedidos', []); } catch(e){}
          try { suplidores = LS('nsup', []); } catch(e){}
          try { gastos = LS('ngastos', []); } catch(e){}
          try { compras = LS('nc', []); } catch(e){}
        } catch(e){}

        // Qué llegó
        var lineas = [];
        var NOMBRES = { nv:'ventas', ncl:'clientes', np:'productos', nc:'compras',
                        ngastos:'gastos', nsup:'suplidores', npedidos:'pedidos',
                        ndevoluciones:'devoluciones', ntarjetas:'tarjetas' };
        CLAVES_A_RESPALDAR.forEach(function(k){
          if(!NOMBRES[k]) return;
          var ahora = 0;
          try {
            var v = JSON.parse(localStorage.getItem(k) || '[]');
            ahora = Array.isArray(v) ? v.length : 0;
          } catch(e){}
          var dif = ahora - (antes[k] || 0);
          if(dif > 0) lineas.push('\u2795 ' + dif + ' ' + NOMBRES[k]);
        });

        // Repintar la pantalla donde esté parado
        try {
          var p = pantallaActual();
          if(p === 'p-cl' || p === 'p-cl-perfil'){ if(typeof renderCl === 'function') renderCl(''); }
          else if(p === 'p-cxc'){ if(typeof renderCxC === 'function') renderCxC(); }
          else if(p === 'p-ped'){ if(typeof renderPedidos === 'function') renderPedidos(); }
          else if(p === 'p-cat'){ if(typeof renderCat === 'function') renderCat(''); }
          else if(p === 'p-inventario'){ if(typeof renderInventario === 'function') renderInventario(''); }
          if(typeof pintarMiniResumen === 'function') pintarMiniResumen();
          if(typeof actualizarAvisoPendientes === 'function') actualizarAvisoPendientes();
        } catch(e){}

        terminar();
        avisoGrande(lineas.length
          ? '\u2705 Ya est\u00e1 al d\u00eda.\n\n' + lineas.join('\n')
          : '\u2705 Ya estabas al d\u00eda.\n\nNo hab\u00eda nada nuevo en la nube.');
      });
    } catch(e){
      terminar();
      avisoGrande('\u26a0\ufe0f No se pudo traer: ' + String(e).slice(0, 60));
    }
  }, 900);
}

function actualizarAvisoPendientes(){
  var n = hayPendientesDeSubir();
  var aviso = document.getElementById('aviso-sin-sincronizar');
  if(!aviso){
    if(n === 0) return;
    aviso = document.createElement('div');
    aviso.id = 'aviso-sin-sincronizar';
    aviso.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:#E65100;color:white;padding:9px 14px;font-size:12px;font-weight:700;z-index:99990;text-align:center;cursor:pointer;box-shadow:0 -2px 8px rgba(0,0,0,0.2)';
    // 🔴 ANTES ESTO LLAMABA A subirPendientes() A SECAS -19 ago-. Esa funcion se sale
    // CALLADA en cuatro casos -sin sesion, sin internet, lista ilegible, lista vacia- y los
    // fallos de verdad solo se apuntaban en la consola. Resultado: Sensei tocaba el aviso y
    // no pasaba absolutamente nada, sin saber por que. Ahora el toque SIEMPRE le contesta.
    aviso.onclick = function(){ reintentarYDecirmeElError(); };
    document.body.appendChild(aviso);
  }
  if(n === 0){
    aviso.style.display = 'none';
  } else {
    aviso.style.display = 'block';
    aviso.textContent = navigator.onLine
      ? '⚠️ ' + n + ' cambio(s) sin guardar en la nube · toca para reintentar'
      : '📴 Sin internet · ' + n + ' cambio(s) esperando · se subirán solos al volver la señal';
  }
}

function corregirFechasGastosViejos(){
  var gastosLS = LS('ngastos', []);
  var huboCambios = false;
  gastosLS.forEach(function(g){
    if(g.fecha && g.fecha.indexOf('-') >= 0){
      var partes = (g.fecha || '').split('-');
      if(partes.length === 3 && partes[0].length === 4){ // AAAA-MM-DD
        g.fecha = partes[1]+'/'+partes[2]+'/'+partes[0];
        huboCambios = true;
      }
    }
  });
  if(huboCambios) SS('ngastos', gastosLS);
}

function abrirMenuLateral(){
  var menu = document.getElementById('menu-lateral');
  var overlay = document.getElementById('menu-lateral-overlay');
  menu.style.display = 'block';
  overlay.style.display = 'block'; overlay.scrollTop = 0;
  setTimeout(function(){ menu.style.transform = 'translateX(0)'; }, 10);
  try{ renderToggleBloqueoInmediato(); }catch(e){}
}


// ═══ MENÚ AGRUPADO EN SECCIONES (29 jul) ═══
// Sensei: "hay cosas que pertenecen a otras y están separadas... ponlo dentro de un menú
// con un título grande y destacado". Tenía 35 botones sueltos y se perdía. Ahora son 6
// secciones que se abren y cierran: el menú se ve corto y cada cosa dice para qué sirve
// en letra chica. NINGUNA funcionalidad cambió — cada botón conserva su onclick exacto.
// Se quitó el botón repetido "Relleno de la Van", que iba a la misma pantalla que
// "Lista de Relleno".
function toggleGrupoMenu(clave){
  var c = document.getElementById('gm-c-' + clave);
  var f = document.getElementById('gm-f-' + clave);
  if(!c) return;
  var abierto = c.style.display !== 'none';
  c.style.display = abierto ? 'none' : 'block';
  if(f) f.textContent = abierto ? '\u203A' : '\u2304';
}

function cerrarMenuLateral(){
  var menu = document.getElementById('menu-lateral');
  var overlay = document.getElementById('menu-lateral-overlay');
  menu.style.transform = 'translateX(-100%)';
  setTimeout(function(){
    menu.style.display = 'none';
    overlay.style.display = 'none';
  }, 300);
}

function irMenu(id){
  cerrarMenuLateral();
  setTimeout(function(){ ir(id); }, 150);
}

function irMenuProtegido(id){
  cerrarMenuLateral();
  setTimeout(function(){ irProtegido(id); }, 150);
}



function abrirConfigImpresora(){
  var overlay = document.getElementById('printer-config-overlay');
  if(!overlay){
    overlay = document.createElement('div');
    overlay.id = 'printer-config-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:white;z-index:99999;overflow-y:auto;padding:16px';
    document.body.appendChild(overlay);
  }

  var impresoras = LS('impresoras_lista', null);
  if(!impresoras || !impresoras.length){
    impresoras = [
      {id:1, nombre:'Epson TM-P20', papel:'58mm', notas:'Principal'}
    ];
    SS('impresoras_lista', impresoras);
  }
  var config = LS('printer_config', null);
  if(!config || !config.activa_id || !impresoras.find(function(i){return String(i.id) === String(config.activa_id);})){
    // Si nunca se eligio una activa (o la que tenia guardada ya no existe), usar la primera de la lista
    config = { activa_id: impresoras[0].id, nombre: impresoras[0].nombre };
    SS('printer_config', config);
  }

  overlay.innerHTML = '';
  var wrap = document.createElement('div');
  wrap.style.cssText = 'max-width:480px;margin:0 auto';

  // Header
  var header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;gap:12px;margin-bottom:20px';
  var btnBack = document.createElement('button');
  btnBack.textContent = '← Volver';
  btnBack.style.cssText = 'background:#E8EAF6;border:none;border-radius:8px;padding:10px 14px;cursor:pointer;font-size:13px;font-weight:700;color:#1a237e';
  btnBack.onclick = function(){ overlay.style.display='none'; };
  var titulo = document.createElement('div');
  titulo.innerHTML = '<div style="font-size:18px;font-weight:800;color:#1a237e">🖨️ Impresoras Bluetooth</div>'
    +'<div style="font-size:12px;color:#aaa;margin-top:2px">Gestiona tus impresoras portátiles</div>';
  var iconoNBS = document.createElement('img');
  iconoNBS.src = 'icon-512.png';
  iconoNBS.style.cssText = 'width:32px;height:32px;margin-left:auto;border-radius:8px';
  iconoNBS.alt = 'NBS';
  iconoNBS.onclick = function(){ overlay.style.display='none'; ir('p-inicio'); };
  iconoNBS.style.cursor = 'pointer';
  header.appendChild(btnBack);
  header.appendChild(titulo);
  header.appendChild(iconoNBS);
  wrap.appendChild(header);

  // Info del modelo actual
  var infoDiv = document.createElement('div');
  infoDiv.style.cssText = 'background:#E8EAF6;border-radius:12px;padding:14px;margin-bottom:16px';
  infoDiv.innerHTML = '<div style="font-size:12px;color:#1a237e;font-weight:700;margin-bottom:6px">📋 CÓMO CONECTAR TU IMPRESORA</div>'
    +'<div style="font-size:12px;color:#555;line-height:1.6">'
    +'1. Enciende la impresora<br>'
    +'2. Ve a Ajustes → Bluetooth en tu teléfono<br>'
    +'3. Busca y empareja la impresora<br>'
    +'4. Regresa a la app y toca 🖨️ Imprimir<br>'
    +'5. En el diálogo elige tu impresora<br>'
    +'</div>';
  wrap.appendChild(infoDiv);

  // Lista de impresoras
  var listTitle = document.createElement('div');
  listTitle.style.cssText = 'font-size:11px;color:#aaa;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px';
  listTitle.textContent = 'Mis impresoras registradas';
  wrap.appendChild(listTitle);

  var listaWrap = document.createElement('div');
  listaWrap.id = 'printer-lista-wrap';
  wrap.appendChild(listaWrap);

  function renderListaImpresoras(){
    listaWrap.innerHTML = '';
    impresoras.forEach(function(imp, idx){
      var activa = config.activa_id === imp.id;
      var row = document.createElement('div');
      row.style.cssText = 'background:white;border-radius:12px;padding:14px;margin-bottom:8px;border:2px solid '+(activa?'#1565C0':'#e5e7eb')+';display:flex;align-items:center;gap:12px';

      var info = document.createElement('div');
      info.style.cssText = 'flex:1';
      info.innerHTML = '<input type="text" value="'+imp.nombre+'" id="printer-nombre-'+idx+'" style="width:100%;border:none;font-size:15px;font-weight:700;color:#1a237e;padding:0;background:transparent;margin-bottom:2px" placeholder="Nombre de la impresora">'
        +'<div style="font-size:12px;color:#aaa">Papel: '+imp.papel+(imp.notas?' · '+imp.notas:'')+'</div>'
        +(activa?'<div style="font-size:11px;color:#1565C0;font-weight:700;margin-top:4px">✓ ACTIVA AHORA</div>':'');

      var btnSelDiv = document.createElement('div');
      btnSelDiv.style.cssText = 'display:flex;flex-direction:column;gap:4px';

      var btnSel = document.createElement('button');
      btnSel.textContent = activa ? '✓ Activa' : 'Usar esta';
      btnSel.style.cssText = 'padding:6px 12px;background:'+(activa?'#1565C0':'#E8EAF6')+';color:'+(activa?'white':'#1a237e')+';border:none;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700';
      btnSel.onclick = (function(i){ return function(){
        var nombre = document.getElementById('printer-nombre-'+i).value.trim() || impresoras[i].nombre;
        impresoras[i].nombre = nombre;
        config.activa_id = impresoras[i].id;
        config.nombre = nombre;
        SS('printer_config', config);
        SS('impresoras_lista', impresoras);
        renderListaImpresoras();
      }; })(idx);

      var btnGuardar = document.createElement('button');
      btnGuardar.textContent = '💾 Guardar';
      btnGuardar.style.cssText = 'padding:5px 10px;background:#f5f5f5;color:#555;border:none;border-radius:8px;cursor:pointer;font-size:11px';
      btnGuardar.onclick = (function(i){ return function(){
        var nombre = document.getElementById('printer-nombre-'+i).value.trim() || impresoras[i].nombre;
        impresoras[i].nombre = nombre;
        if(config.activa_id === impresoras[i].id) config.nombre = nombre;
        SS('impresoras_lista', impresoras);
        SS('printer_config', config);
        flash('printer-mk-'+i);
      }; })(idx);

      var btnEliminar = document.createElement('button');
      btnEliminar.textContent = '🗑️ Eliminar';
      btnEliminar.style.cssText = 'padding:5px 10px;background:var(--nbs-red-bg);color:var(--nbs-red-dark);border:none;border-radius:8px;cursor:pointer;font-size:11px';
      btnEliminar.onclick = (function(i){ return function(){
        if(impresoras.length <= 1){ alert('Debes tener al menos una impresora registrada. Agrega otra antes de eliminar esta.'); return; }
        if(!confirm('¿Eliminar "'+impresoras[i].nombre+'" de tu lista? Esto no afecta la impresora física, solo la quita de este registro.')) return;
        var eraActiva = config.activa_id === impresoras[i].id;
        impresoras.splice(i, 1);
        if(eraActiva){ config.activa_id = impresoras[0].id; config.nombre = impresoras[0].nombre; }
        SS('impresoras_lista', impresoras);
        SS('printer_config', config);
        renderListaImpresoras();
      }; })(idx);

      var snkGuardado = document.createElement('div');
      snkGuardado.className = 'snk';
      snkGuardado.id = 'printer-mk-'+idx;
      snkGuardado.textContent = 'Guardado';
      snkGuardado.style.cssText += 'margin-top:6px;font-size:11px;padding:6px 8px';

      btnSelDiv.appendChild(btnSel);
      btnSelDiv.appendChild(btnGuardar);
      btnSelDiv.appendChild(btnEliminar);
      row.appendChild(info);
      row.appendChild(btnSelDiv);
      listaWrap.appendChild(row);
      listaWrap.appendChild(snkGuardado);
    });
  }
  renderListaImpresoras();

  // Agregar nueva impresora
  var btnAgregar = document.createElement('button');
  btnAgregar.textContent = '+ Agregar otra impresora';
  btnAgregar.style.cssText = 'width:100%;padding:12px;background:var(--nbs-gold-bg);color:var(--nbs-gold-dark);border:1px dashed var(--nbs-gold);border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;margin-bottom:8px;margin-top:4px';
  btnAgregar.onclick = function(){
    var nombreNueva = prompt('Nombre de la nueva impresora (ej: "La de repuesto", "Epson del carro"):', '');
    if(nombreNueva === null || !nombreNueva.trim()) return;
    var nuevoId = Date.now();
    impresoras.push({ id: nuevoId, nombre: nombreNueva.trim(), papel: '58mm', notas: '' });
    SS('impresoras_lista', impresoras);
    renderListaImpresoras();
  };
  wrap.appendChild(btnAgregar);

  // Tip de batería
  var tip = document.createElement('div');
  tip.style.cssText = 'background:#FFF8E1;border-radius:12px;padding:14px;margin-top:8px;border:0.5px solid #FFE082';
  tip.innerHTML = '<div style="font-size:12px;color:#E65100;font-weight:700;margin-bottom:6px">💡 TIP: Batería baja</div>'
    +'<div style="font-size:12px;color:#555;line-height:1.6">'
    +'Si la batería de tu impresora se agotó, simplemente:<br>'
    +'1. Apaga esa impresora<br>'
    +'2. Enciende la impresora de repuesto<br>'
    +'3. En el diálogo de impresión selecciona la nueva<br>'
    +'4. Ven aquí y toca "Usar esta" en la nueva<br>'
    +'</div>';
  wrap.appendChild(tip);

  overlay.appendChild(wrap);
  overlay.style.display = 'block'; overlay.scrollTop = 0;
}

// ===== DASHBOARD FINANCIERO =====
// ═══════════════════════════════════════════════════════════════════════════
//  PANORAMA COMPLETO  (19 jul 2026, pedido por Sensei)
//  Toda la salud financiera del negocio en una pantalla, con gráficos, y por período.
// ═══════════════════════════════════════════════════════════════════════════
// Calcula el total de lo que TÚ debes (suplidores a crédito + tarjetas + otras deudas)
function calcularTotalPorPagar(){
  var compras = LS('nc', []);
  var sups = LS('nsup', []);
  var totalSup = 0;
  sups.forEach(function(s){
    compras.filter(function(c){ return String(c.sid)===String(s.id) && c.tipo==='credito'; }).forEach(function(c){
      var pagado = c.pagosFactura ? (c.pagosFactura || []).filter(function(p){return typeof p.monto==='number';}).reduce(function(s2,p){return s2+p.monto;},0) : 0;
      totalSup += Math.max(0, (c.total||0) - pagado);
    });
  });
  var totalTarj = LS('ntarjetas', []).reduce(function(s,t){ return s+(t.balance||0); }, 0);
  var totalOtras = LS('notrasdeudas', []).reduce(function(s,d){ return s+(d.balance||0); }, 0);
  return totalSup + totalTarj + totalOtras;
}

var _panoramaPeriodo = 'mes'; // hoy, semana, mes, ano

function fijarPeriodoPanorama(p){ _panoramaPeriodo = p; renderPanorama(); }

// Devuelve {desde, hasta} según el período elegido
function rangoPanorama(){
  var hoy = new Date();
  var desde = new Date(hoy);
  if(_panoramaPeriodo === 'hoy'){ desde.setHours(0,0,0,0); }
  else if(_panoramaPeriodo === 'semana'){ desde.setDate(hoy.getDate()-6); desde.setHours(0,0,0,0); }
  else if(_panoramaPeriodo === 'mes'){ desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1); }
  else if(_panoramaPeriodo === 'ano'){ desde = new Date(hoy.getFullYear(), 0, 1); }
  return { desde: desde, hasta: hoy };
}

function acaElegirVoz(){
  if(!acaSynth) return null;
  var voces = acaSynth.getVoices() || [];
  var pref = ['es-us','es-mx','es-419','es-es','es'];
  for(var p=0; p<pref.length; p++){
    for(var i=0;i<voces.length;i++){
      if((voces[i].lang||'').toLowerCase().indexOf(pref[p])===0) return voces[i];
    }
  }
  return null;
}
if(acaSynth){
  acaVoz = acaElegirVoz();
  if(typeof acaSynth.onvoiceschanged !== 'undefined'){
    acaSynth.onvoiceschanged = function(){ acaVoz = acaElegirVoz(); };
  }
}

// Partir la leccion en pedazos cortos (por oracion). Chrome corta la voz a los
// ~15 segundos si el texto es largo, por eso se lee de a pedacitos encadenados.
function acaPartir(txt){
  var crudo = txt.match(/[^.!?]+[.!?]*/g) || [txt];
  var res = [];
  crudo.forEach(function(s){
    s = s.trim();
    if(!s) return;
    if(s.length <= 200){ res.push(s); return; }
    var partes = s.split(/,\s*/);
    var buffer = '';
    partes.forEach(function(p){
      if((buffer + ' ' + p).length > 200){
        if(buffer) res.push(buffer.trim());
        buffer = p;
      } else {
        buffer = buffer ? (buffer + ', ' + p) : p;
      }
    });
    if(buffer) res.push(buffer.trim());
  });
  return res;
}

// Mantener la pantalla encendida mientras lee -asi el audio no se detiene-
function acaPedirWakeLock(){
  try{
    if('wakeLock' in navigator && navigator.wakeLock.request){
      navigator.wakeLock.request('screen').then(function(wl){
        acaWakeLock = wl;
        acaNotaPantalla(true);
      }).catch(function(){ acaNotaPantalla(false); });
    }
  }catch(e){ acaNotaPantalla(false); }
}
function acaSoltarWakeLock(){
  try{ if(acaWakeLock){ acaWakeLock.release(); acaWakeLock = null; } }catch(e){}
  acaNotaPantalla(false);
}
function acaNotaPantalla(activa){
  var el = document.getElementById('aca-pantalla');
  if(!el) return;
  if(activa){ el.innerHTML = '<span style="color:#6cd08f;font-weight:700">\u2600\ufe0f Pantalla encendida - no se apagara</span>'; }
  else { el.textContent = 'La pantalla se mantiene encendida al reproducir'; }
}
document.addEventListener('visibilitychange', function(){
  if(document.visibilityState === 'visible' && window._acaReproduciendo) acaPedirWakeLock();
});

// Leer un pedazo y encadenar el siguiente
function acaHablarChunk(){
  if(!acaSynth) return;
  if(acaIdxChunk >= acaChunks.length){ acaLeccionTerminada(); return; }
  var u = new SpeechSynthesisUtterance(acaChunks[acaIdxChunk]);
  u.lang = 'es-US';
  if(acaVoz) u.voice = acaVoz;
  u.rate = acaVelocidad;
  u.onend = function(){
    if(acaCancelManual){ acaCancelManual = false; return; }
    acaIdxChunk++;
    acaActualizarParte();
    if(acaIdxChunk < acaChunks.length){ acaHablarChunk(); } else { acaLeccionTerminada(); }
  };
  u.onerror = function(){
    if(!acaCancelManual && window._acaReproduciendo){
      acaIdxChunk++;
      if(acaIdxChunk < acaChunks.length){ acaHablarChunk(); } else { acaLeccionTerminada(); }
    }
    acaCancelManual = false;
  };
  acaSynth.speak(u);
}

function acaReproducir(){
  if(!acaSynth){ alert('Este telefono no soporta lectura por voz. Prueba con Chrome.'); return; }
  if(acaIdxLeccion < 0){ acaCargarLeccion(0, false); }
  if(!acaChunks.length){ acaChunks = acaPartir(ACA_LECCIONES[acaIdxLeccion].texto); }
  window._acaReproduciendo = true;
  acaActualizarBoton();
  acaPedirWakeLock();
  acaCancelManual = true;
  try{ acaSynth.cancel(); }catch(e){}
  setTimeout(function(){ acaCancelManual = false; acaHablarChunk(); }, 120);
}

function acaPausar(){
  window._acaReproduciendo = false;
  acaCancelManual = true;
  try{ if(acaSynth) acaSynth.cancel(); }catch(e){}
  acaSoltarWakeLock();
  acaActualizarBoton();
}

function acaTogglePlay(){
  if(window._acaReproduciendo){ acaPausar(); } else { acaReproducir(); }
}

// Al terminar una leccion, pasar sola a la siguiente -como un podcast-
function acaLeccionTerminada(){
  if(acaIdxLeccion < ACA_LECCIONES.length - 1){
    var seguia = window._acaReproduciendo;
    acaCargarLeccion(acaIdxLeccion + 1, false);
    if(seguia){ setTimeout(acaReproducir, 400); }
  } else {
    window._acaReproduciendo = false;
    acaSoltarWakeLock();
    acaActualizarBoton();
    var el = document.getElementById('aca-parte');
    if(el) el.textContent = 'Fin de las lecciones. \u00a1Bien hecho!';
  }
}

function acaCargarLeccion(i, autoplay){
  if(i < 0 || i >= ACA_LECCIONES.length) return;
  acaCancelManual = true;
  try{ if(acaSynth) acaSynth.cancel(); }catch(e){}
  acaIdxLeccion = i;
  acaChunks = acaPartir(ACA_LECCIONES[i].texto);
  acaIdxChunk = 0;
  try{ localStorage.setItem('nbs_academia_leccion', String(i)); }catch(e){}
  var t = document.getElementById('aca-titulo');
  if(t) t.textContent = ACA_LECCIONES[i].titulo;
  acaActualizarParte();
  acaRenderLista();
  if(autoplay){ setTimeout(acaReproducir, 150); }
}

function acaSiguiente(){ if(acaIdxLeccion < ACA_LECCIONES.length-1) acaCargarLeccion(acaIdxLeccion+1, window._acaReproduciendo); }
function acaAnterior(){ if(acaIdxLeccion > 0) acaCargarLeccion(acaIdxLeccion-1, window._acaReproduciendo); }

function acaActualizarBoton(){
  var b = document.getElementById('aca-play');
  if(b) b.textContent = window._acaReproduciendo ? '\u23F8' : '\u25B6';
  acaRenderLista();
}
function acaActualizarParte(){
  var el = document.getElementById('aca-parte');
  if(!el) return;
  if(acaIdxLeccion < 0){ el.innerHTML = '&nbsp;'; return; }
  var total = acaChunks.length || 1;
  el.textContent = 'Lecci\u00f3n ' + (acaIdxLeccion+1) + ' de ' + ACA_LECCIONES.length + '  \u00b7  parte ' + Math.min(acaIdxChunk+1, total) + '/' + total;
}

function acaRenderLista(){
  var cont = document.getElementById('aca-lista');
  if(!cont) return;
  cont.innerHTML = ACA_LECCIONES.map(function(l, i){
    var activa = (i === acaIdxLeccion);
    return '<div class="aca-lec" data-i="'+i+'" style="display:flex;align-items:center;gap:11px;background:'+(activa?'#1e2658':'#171e46')+';border:1px solid '+(activa?'#E3B23C':'#262e63')+';border-radius:13px;padding:13px 12px;margin-bottom:8px;cursor:pointer">' +
      '<div style="width:32px;height:32px;border-radius:8px;flex-shrink:0;background:'+(activa?'#E3B23C':'#2a336f')+';color:'+(activa?'#161d44':'#E3B23C')+';font-weight:800;font-size:14px;display:flex;align-items:center;justify-content:center">'+(i+1)+'</div>' +
      '<div style="font-size:15px;font-weight:600;color:#f3f4fb;line-height:1.25;flex:1">'+escaparHtml(l.titulo)+'</div>' +
      '<div style="color:'+(activa?'#E3B23C':'#7b83b5')+';font-size:18px;flex-shrink:0">'+((activa && window._acaReproduciendo)?'\u25B6':'\u266A')+'</div>' +
    '</div>';
  }).join('');
  Array.prototype.forEach.call(cont.querySelectorAll('.aca-lec'), function(el){
    el.onclick = function(){ acaCargarLeccion(parseInt(el.getAttribute('data-i'),10), true); };
  });
}

// Se llama cada vez que entras a la pantalla de Academia
function renderAcademia(){
  var bp = document.getElementById('aca-play');
  if(bp && !bp._acaListo){
    bp._acaListo = true;
    bp.onclick = acaTogglePlay;
    var bs = document.getElementById('aca-sig'); if(bs) bs.onclick = acaSiguiente;
    var ba = document.getElementById('aca-ant'); if(ba) ba.onclick = acaAnterior;
    Array.prototype.forEach.call(document.querySelectorAll('.aca-velo'), function(el){
      el.onclick = function(){
        Array.prototype.forEach.call(document.querySelectorAll('.aca-velo'), function(x){
          x.style.background = '#20285a'; x.style.color = '#c7cdf0'; x.style.borderColor = '#313a7d';
        });
        el.style.background = '#E3B23C'; el.style.color = '#161d44'; el.style.borderColor = '#E3B23C';
        acaVelocidad = parseFloat(el.getAttribute('data-v'));
        if(window._acaReproduciendo){
          acaCancelManual = true;
          try{ acaSynth.cancel(); }catch(e){}
          setTimeout(function(){ acaCancelManual=false; acaHablarChunk(); }, 150);
        }
      };
    });
  }
  if(acaIdxLeccion < 0){
    var guardada = 0;
    try{ var g = localStorage.getItem('nbs_academia_leccion'); if(g!==null) guardada = parseInt(g,10)||0; }catch(e){}
    acaCargarLeccion(guardada, false);
  } else {
    acaRenderLista();
    acaActualizarParte();
  }
  acaActualizarBoton();
}

// ═══════════════════════════════════════════════════════════════
//  COBRADO Y VENDIDO  (acceso directo, pedido por Sensei 22 jul)
//  Abre con la fecha de HOY y el resultado ya calculado.
//
//  VENDIDO  = todo lo que facturaste en el rango (contado + credito),
//             sin contar las facturas canceladas.
//  COBRADO  = el dinero que de verdad entro en el rango:
//             las ventas de contado de esos dias + los abonos que te
//             pagaron esos dias (aunque la factura sea de antes).
// ═══════════════════════════════════════════════════════════════

// Convierte MM/DD/AAAA o AAAA-MM-DD a un objeto Date (a las 12 del dia, para
// que no se corra por zonas horarias)
function resFechaADate(f){
  if(!f) return null;
  f = String(f).trim();
  var p;
  if(f.indexOf('-') > 0){ p = f.split('-'); return new Date(+p[0], +p[1]-1, +p[2], 12,0,0); }
  p = f.split('/');
  if(p.length !== 3) return null;
  return new Date(+p[2], +p[0]-1, +p[1], 12,0,0);
}
function resISOaDate(iso){
  if(!iso) return null;
  var p = iso.split('-');
  return new Date(+p[0], +p[1]-1, +p[2], 12,0,0);
}
function resHoyISO(){
  var d = new Date();
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function resSumarDias(iso, n){
  var d = resISOaDate(iso);
  d.setDate(d.getDate()+n);
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}

// Se llama cada vez que entras a la pantalla: pone HOY y calcula de una
function abrirResumen(){
  var dEl = document.getElementById('res-desde');
  var hEl = document.getElementById('res-hasta');
  if(!dEl || !hEl) return;
  if(!dEl.value || !hEl.value){
    var hoy = resHoyISO();
    dEl.value = hoy; hEl.value = hoy;
  }
  if(!dEl._listo){
    dEl._listo = true;
    dEl.onchange = function(){ marcarRango(null); calcularResumen(); };
    hEl.onchange = function(){ marcarRango(null); calcularResumen(); };
    Array.prototype.forEach.call(document.querySelectorAll('.rng-btn'), function(b){
      b.onclick = function(){ ponerRango(b.getAttribute('data-r')); };
    });
  }
  calcularResumen();
}

function ponerRango(cual){
  var hoy = resHoyISO();
  var desde = hoy, hasta = hoy;
  if(cual === 'ayer'){ desde = resSumarDias(hoy,-1); hasta = desde; }
  else if(cual === 'semana'){ desde = resSumarDias(hoy,-6); hasta = hoy; }
  else if(cual === 'mes'){
    var d = new Date();
    desde = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-01';
    hasta = hoy;
  }
  document.getElementById('res-desde').value = desde;
  document.getElementById('res-hasta').value = hasta;
  marcarRango(cual);
  calcularResumen();
}

// La miniatura de la pantalla de inicio: calcula lo de HOY y lo muestra chiquito.
// Al tocarla se abre la pantalla completa de Cobrado y Vendido.
function pintarMiniResumen(){
  var el = document.getElementById('mini-res-txt');
  if(!el) return;
  try{
    var V = LS('nv', []);
    var hoy = resHoyISO();
    var d0 = resISOaDate(hoy), d1 = resISOaDate(hoy);
    var cobrado = 0, vendido = 0;
    function dentro(f){ var x = resFechaADate(f); return x && x >= d0 && x <= d1; }
    V.forEach(function(v){
      if(v.cancelada) return;
      if(dentro(v.fecha)){
        vendido += (v.total || 0);
        if(v.tipo === 'contado') cobrado += cobradoYDebeDe(v).cobrado;
      }
      if(v.tipo === 'credito' && v.pagosFactura){
        (v.pagosFactura || []).forEach(function(p){
          if(typeof p.monto !== 'number' || p.monto <= 0 || p.esDevolucion) return;
          if(dentro(p.fecha || v.fecha)) cobrado += p.monto;
        });
      }
    });
    el.innerHTML = '<span>Cobr&eacute; $'+fmtNum(cobrado)+'</span>'
      + '<span style="color:#8FD19A;letter-spacing:2px">&middot;&middot;&middot;</span>'
      + '<span>Vend&iacute; $'+fmtNum(vendido)+'</span>';
  }catch(e){ el.innerHTML = '<span>Toca para ver lo de hoy</span>'; }
}

// Detalle por cliente: quien pago, cuanto cogio y como quedo el balance
function calcularResumen(){
  ventas = LS('nv', []);
  var dIso = document.getElementById('res-desde').value;
  var hIso = document.getElementById('res-hasta').value;
  var d0 = resISOaDate(dIso), d1 = resISOaDate(hIso);
  if(!d0 || !d1){ return; }
  if(d0 > d1){ var t=d0; d0=d1; d1=t; }

  function dentro(fecha){
    var f = resFechaADate(fecha);
    if(!f) return false;
    return f >= d0 && f <= d1;
  }

  var vendido = 0, nVentas = 0, contado = 0, credito = 0;
  var cobrado = 0, nCobros = 0, abonos = 0;

  // ═══ GANANCIA YA COBRADA (29 jul, pedido de Sensei) ═══
  // "las ventas al contado dame de inmediato cuanto me gane, y las de credito que
  // reflejen la ganancia al momento de que sean pagadas".
  //
  // LA REGLA:
  //   · CONTADO  -> la ganancia entera cuenta el dia de la venta
  //   · CREDITO  -> cada abono trae SU PARTE de la ganancia, proporcional:
  //                 si la factura de $500 deja $150 y te pagan $250 (la mitad),
  //                 cuentas $75.
  //
  // OJO: los "Balance inicial traido de sistema anterior" NO son ventas suyas — son
  // deudas que paso a mano al cambiarse de app. Su ganancia es cero y asi debe quedar.
  var ganCobrada = 0, ganEnLaCalle = 0;

  ventas.forEach(function(v){
    if(v.cancelada) return;
    // ── VENDIDO: facturas emitidas en el rango ──
    if(dentro(v.fecha)){
      var t = v.total || 0;
      vendido += t; nVentas++;
      var _cd = cobradoYDebeDe(v);
      if(v.tipo === 'contado'){ contado += _cd.cobrado; cobrado += _cd.cobrado; if(_cd.cobrado > 0) nCobros++; }
      else { credito += t; }
    }
    // ── COBRADO: abonos pagados en el rango, sea cual sea la fecha de la factura ──
    if(v.tipo === 'credito' && v.pagosFactura && (v.pagosFactura || []).length){
      (v.pagosFactura || []).forEach(function(p){
        if(typeof p.monto !== 'number' || p.monto <= 0) return;
        if(p.esDevolucion) return;
        if(dentro(p.fecha || v.fecha)){
          cobrado += p.monto; abonos += p.monto; nCobros++;
        }
      });
    }

    // ── GANANCIA COBRADA ──
    if(typeof esBalanceInicial === 'function' && esBalanceInicial(v)) return;
    var totalV = parseFloat(v.total) || 0;
    var ganV = parseFloat(v.ganancia) || 0;
    if(totalV <= 0) return;

    if(v.tipo === 'contado'){
      if(dentro(v.fecha)) ganCobrada += ganV;
    } else {
      var pagadoTodo = 0;
      (v.pagosFactura || []).forEach(function(p){
        var m = parseFloat(p.monto) || 0;
        if(m <= 0 || p.esDevolucion) return;
        pagadoTodo += m;
        if(dentro(p.fecha || v.fecha)) ganCobrada += ganV * (m / totalV);
      });
      // Lo que todavia no te han pagado de esa factura, en ganancia
      var faltaPagar = totalV - pagadoTodo;
      if(faltaPagar > 0.005) ganEnLaCalle += ganV * (faltaPagar / totalV);
    }
  });

  // ── GASTOS del rango ──
  var gastosRango = 0, nGastos = 0;
  try {
    (LS('ngastos', []) || []).forEach(function(g){
      if(!dentro(g.fecha)) return;
      gastosRango += parseFloat(g.monto) || 0;
      nGastos++;
    });
  } catch(e){}

  var teQuedo = ganCobrada - gastosRango;

  document.getElementById('res-cobrado').textContent = '$'+fmtNum(cobrado);
  document.getElementById('res-cobrado-n').textContent = nCobros + (nCobros===1?' cobro':' cobros');
  document.getElementById('res-vendido').textContent = '$'+fmtNum(vendido);
  document.getElementById('res-vendido-n').textContent = nVentas + (nVentas===1?' venta':' ventas');

  function fila(nom, val, color){
    return '<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px dashed #eee">'
      + '<span style="font-size:15.5px;color:#444;font-weight:600">'+nom+'</span>'
      + '<span style="font-size:17px;font-weight:800;color:'+color+'">$'+fmtNum(val)+'</span></div>';
  }
  document.getElementById('res-desglose').innerHTML =
      fila('Ventas de contado', contado, '#2E7D32')
    + fila('Ventas a cr\u00e9dito', credito, '#E65100')
    + fila('Abono a cuentas', abonos, '#1565C0')
    + '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0 2px">'
    + '<span style="font-size:15.5px;color:#1a237e;font-weight:800">Falta por cobrar de estas ventas</span>'
    + '<span style="font-size:17px;font-weight:900;color:#C62828">$'+fmtNum(Math.max(0, credito))+'</span></div>';

  // ── El bloque de la ganancia real ──
  var elGan = document.getElementById('res-ganancia');
  if(elGan){
    elGan.innerHTML =
        '<div style="background:#E8F5E9;border:2px solid #2E7D32;border-radius:14px;padding:14px;margin-bottom:10px">'
      +   '<div style="font-size:11.5px;font-weight:800;color:#2E7D32;letter-spacing:.5px;margin-bottom:2px">\ud83d\udcb5 GANANCIA YA COBRADA</div>'
      +   '<div style="font-size:30px;font-weight:900;color:#1B5E20;line-height:1.1">$' + fmtNum(ganCobrada) + '</div>'
      +   '<div style="font-size:12px;color:#33691E;margin-top:2px">de lo que de verdad entr\u00f3</div>'

      +   '<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 0 7px;margin-top:9px;border-top:1px dashed #A5D6A7">'
      +     '<span style="font-size:14.5px;color:#444;font-weight:600">\ud83e\uddfe Gastos' + (nGastos ? ' (' + nGastos + ')' : '') + '</span>'
      +     '<span style="font-size:16.5px;font-weight:800;color:#C62828">\u2212$' + fmtNum(gastosRango) + '</span>'
      +   '</div>'

      +   '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;border-radius:10px;background:' + (teQuedo >= 0 ? '#C8E6C9' : '#FFCDD2') + '">'
      +     '<span style="font-size:15px;font-weight:900;color:' + (teQuedo >= 0 ? '#1B5E20' : '#B71C1C') + '">' + (teQuedo >= 0 ? '\u2705 TE QUED\u00d3' : '\u26a0\ufe0f QUEDASTE EN ROJO') + '</span>'
      +     '<span style="font-size:20px;font-weight:900;color:' + (teQuedo >= 0 ? '#1B5E20' : '#B71C1C') + '">$' + fmtNum(Math.abs(teQuedo)) + '</span>'
      +   '</div>'
      + '</div>'

      + (ganEnLaCalle > 0.005
          ? '<div style="background:#FFF8E1;border:1px solid #FFE082;border-radius:12px;padding:11px">'
          +   '<div style="font-size:11.5px;font-weight:800;color:#8D6E63;letter-spacing:.5px">\u23f3 GANANCIA QUE EST\u00c1 EN LA CALLE</div>'
          +   '<div style="font-size:21px;font-weight:900;color:#E65100;line-height:1.2">$' + fmtNum(ganEnLaCalle) + '</div>'
          +   '<div style="font-size:12px;color:#8D6E63;margin-top:2px">te la ganaste, pero todav\u00eda no te la han pagado</div>'
          + '</div>'
          : '');
  }

  function bonito(iso){ var p = iso.split('-'); return p[2]+'/'+p[1]+'/'+p[0]; }
  document.getElementById('res-rango').textContent =
    (dIso === hIso) ? ('Del d\u00eda '+bonito(dIso)) : ('Del '+bonito(dIso)+' al '+bonito(hIso));

  pintarDetalleClientes(d0, d1, dentro);
}

function renderDocs(){
  var cont = document.getElementById('docs-lista');
  if(!cont) return;
  if(!DOCUMENTOS_NBS.length){
    cont.innerHTML = '<div style="text-align:center;color:#aaa;font-size:13px;padding:20px">Todavía no hay documentos.</div>';
    return;
  }
  cont.innerHTML = DOCUMENTOS_NBS.map(function(d){
    return '<div style="background:white;border:1px solid #eee;border-radius:12px;padding:14px;margin-bottom:12px;display:flex;align-items:center;gap:12px">'
      +'<div style="flex-shrink:0;width:48px;height:56px;background:'+d.color+';border-radius:8px;display:flex;align-items:center;justify-content:center;color:white;font-size:11px;font-weight:800">PDF</div>'
      +'<div style="flex:1;min-width:0">'
      +'<div style="font-size:15px;font-weight:700;color:#1a237e">'+escaparHtml(d.titulo)+'</div>'
      +'<div style="font-size:12px;color:var(--nbs-muted);margin-top:2px">'+escaparHtml(d.desc)+'</div>'
      +'</div>'
      +'<div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0">'
      +'<button class="btn" style="margin:0;padding:9px 16px;background:#E8EAF6;color:#1a237e;font-size:13px" onclick="verDocumento(\''+d.archivo+'\')">👁️ Ver</button>'
      +'<button class="btn" style="margin:0;padding:9px 16px;background:#2E7D32;color:white;font-size:13px" onclick="descargarDocumento(\''+d.archivo+'\')">⬇️ Bajar</button>'
      +'</div></div>';
  }).join('');
}

// Abre el documento (desde la misma carpeta de la app en GitHub)
function verDocumento(archivo){
  var url = rutaDocumento(archivo);
  // Se abre DIRECTO, en el mismo toque del usuario. Antes se hacía un fetch HEAD para
  // revisar si existía primero, pero eso abría el PDF un instante DESPUÉS del toque y el
  // navegador del telefono lo bloqueaba como "ventana emergente". Abriendo directo, el
  // telefono lo trata como accion pedida por el usuario y no lo bloquea. Si un documento
  // no existiera, el navegador muestra su propio aviso (los documentos ya estan subidos).
  window.open(url, '_blank');
}

// Aviso claro cuando un documento todavía no está en esta app.
function avisoDocumentoNoDisponible(){
  alert('📄 Documento no disponible\n\nEste documento todavía no está en esta app. Los documentos se generan con tu información real.\n\nAparecerán aquí cuando cargues tus datos en esta app.');
}


// Descarga el documento al teléfono (para guardarlo y verlo después sin internet)
function descargarDocumento(archivo){
  var url = rutaDocumento(archivo);
  // Descarga DIRECTA en el mismo toque (sin fetch HEAD previo que el telefono bloqueaba).
  var a = document.createElement('a');
  a.href = url;
  a.download = archivo;
  a.target = '_blank';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// Construye la ruta del documento en la misma carpeta donde vive la app
function renderPanorama(){
  // ── Selector de período ──
  var periodos = [['hoy','Hoy'],['semana','Semana'],['mes','Mes'],['ano','Año']];
  var pEl = document.getElementById('panorama-periodo');
  if(pEl){
    pEl.innerHTML = periodos.map(function(p){
      var activo = _panoramaPeriodo === p[0];
      return '<button onclick="fijarPeriodoPanorama(\''+p[0]+'\')" style="flex:1;padding:10px 4px;border-radius:8px;border:1px solid #1a237e;font-size:13px;font-weight:700;cursor:pointer;background:'+(activo?'#1a237e':'white')+';color:'+(activo?'white':'#1a237e')+'">'+p[1]+'</button>';
    }).join('');
  }

  var r = rangoPanorama();
  var ventas = LS('nv', []);
  var gastos = LS('ngastos', []);

  // ── Cálculos del período ──
  var ventasPeriodo = ventas.filter(function(v){ return !v.cancelada && ventaEnRango(v, r.desde, r.hasta); });
  var totalVentas = ventasPeriodo.reduce(function(s,v){ return s + (v.total||0); }, 0);
  var totalGanancia = ventasPeriodo.reduce(function(s,v){ return s + (v.ganancia||0); }, 0);
  var totalCosto = totalVentas - totalGanancia;
  var gastosPeriodo = gastos.filter(function(g){ var f=parsearFechaVenta(g.fecha); return f && f>=r.desde && f<=r.hasta; });
  var totalGastos = gastosPeriodo.reduce(function(s,g){ return s + (g.monto||0); }, 0);
  var gananciaReal = totalGanancia - totalGastos;

  // Deudas
  var balances = calcularBalancesClientes();
  var teDeben = Object.keys(balances.total).reduce(function(s,cid){ var d=balances.total[cid]; return s + (d>0?d:0); }, 0);
  var tuDebes = calcularTotalPorPagar();

  // Métodos de pago del período (efectivo, cashapp, zelle)
  var porMetodo = { efectivo:0, cashapp:0, zelle:0, tarjeta:0 };
  ventasPeriodo.forEach(function(v){
    (v.pagosFactura||[]).forEach(function(p){
      if(p.metodos && p.metodos.length){
        p.metodos.forEach(function(m){ if(porMetodo[m.tipo]!==undefined) porMetodo[m.tipo]+=(m.monto||0); });
      } else if(p.metodo && porMetodo[p.metodo]!==undefined){ porMetodo[p.metodo]+=(p.monto||0); }
      else if(typeof p.monto==='number'){ porMetodo.efectivo+=p.monto; } // pagos viejos sin método = efectivo
    });
  });

  // Inventario
  var inv = calcularResumenInventario();

  // ── Armar el HTML ──
  var nombrePeriodo = { hoy:'HOY', semana:'ESTA SEMANA', mes:'ESTE MES', ano:'ESTE AÑO' }[_panoramaPeriodo];
  var html = '';

  // Tarjeta grande: ganancia real
  html += '<div style="background:'+(gananciaReal>=0?'#2E7D32':'#C62828')+';border-radius:14px;padding:18px;text-align:center;margin-bottom:12px;color:white">'
    +'<div style="font-size:12px;font-weight:700;opacity:0.9">LO QUE GANASTE DE VERDAD ('+nombrePeriodo+')</div>'
    +'<div style="font-size:32px;font-weight:800;margin:6px 0">$'+fmtNum(gananciaReal)+'</div>'
    +'<div style="font-size:11px;opacity:0.9">Ventas $'+fmtNum(totalVentas)+' − Costos $'+fmtNum(totalCosto)+' − Gastos $'+fmtNum(totalGastos)+'</div>'
    +'</div>';

  // Dos tarjetas: te deben / tú debes
  html += '<div style="display:flex;gap:10px;margin-bottom:12px">'
    +'<div style="flex:1;background:white;border:1px solid #eee;border-radius:12px;padding:14px;text-align:center">'
    +'<div style="font-size:11px;color:#888;font-weight:700">💳 TE DEBEN</div>'
    +'<div style="font-size:20px;font-weight:800;color:#C62828;margin-top:4px">$'+fmtNum(teDeben)+'</div></div>'
    +'<div style="flex:1;background:white;border:1px solid #eee;border-radius:12px;padding:14px;text-align:center">'
    +'<div style="font-size:11px;color:#888;font-weight:700">📤 TÚ DEBES</div>'
    +'<div style="font-size:20px;font-weight:800;color:#E65100;margin-top:4px">$'+fmtNum(tuDebes)+'</div></div>'
    +'</div>';

  // Gráfico de barras: ventas de los últimos 6 meses (siempre, sin importar período)
  html += graficoVentas6Meses(ventas);

  // Inventario
  html += '<div style="background:#E8EAF6;border-radius:12px;padding:14px;margin-bottom:12px">'
    +'<div style="font-size:12px;font-weight:700;color:#1a237e;text-align:center;margin-bottom:10px">📦 VALOR DE TU INVENTARIO</div>'
    +'<div style="display:flex;justify-content:space-around;text-align:center">'
    +'<div><div style="font-size:10px;color:#888">Invertido</div><div style="font-size:15px;font-weight:800;color:#1a237e">$'+fmtNum(inv.totalInvertido)+'</div></div>'
    +'<div><div style="font-size:10px;color:#888">Valor venta</div><div style="font-size:15px;font-weight:800;color:#2E7D32">$'+fmtNum(inv.totalVenta)+'</div></div>'
    +'<div><div style="font-size:10px;color:#888">Ganancia</div><div style="font-size:15px;font-weight:800;color:#D4A017">$'+fmtNum(inv.gananciaPotencial)+'</div></div>'
    +'</div></div>';

  // Gráfico de torta: cómo te pagan
  html += graficoMetodosPago(porMetodo);

  // Top 5 clientes que más compran (del período)
  html += graficoTopClientes(ventasPeriodo);

  var cEl = document.getElementById('panorama-contenido');
  if(cEl) cEl.innerHTML = html;
}

// ── Gráfico de barras: ventas de los últimos 6 meses ──
function graficoMetodosPago(porMetodo){
  var total = porMetodo.efectivo + porMetodo.cashapp + porMetodo.zelle + porMetodo.tarjeta;
  if(total <= 0){
    return '<div style="background:white;border:1px solid #eee;border-radius:12px;padding:14px;margin-bottom:12px;text-align:center">'
      +'<div style="font-size:12px;font-weight:700;color:#1a237e;margin-bottom:6px">💵 CÓMO TE PAGAN</div>'
      +'<div style="font-size:12px;color:#aaa;padding:10px">Todavía no hay pagos en este período</div></div>';
  }
  var partes = [
    { nom:'Efectivo', val:porMetodo.efectivo, col:'#2E7D32' },
    { nom:'CashApp', val:porMetodo.cashapp, col:'#1a237e' },
    { nom:'Zelle', val:porMetodo.zelle, col:'#D4A017' }
  ];
  if(porMetodo.tarjeta > 0) partes.push({ nom:'Tarjeta (ant.)', val:porMetodo.tarjeta, col:'#888' });
  partes = partes.filter(function(p){ return p.val > 0; });

  // Construir la torta con SVG (círculos con stroke-dasharray)
  var radio = 50, circ = 2*Math.PI*radio, offset = 0;
  var segmentos = partes.map(function(p){
    var frac = p.val/total;
    var largo = frac*circ;
    var seg = '<circle cx="60" cy="60" r="'+radio+'" fill="none" stroke="'+p.col+'" stroke-width="20" '
      +'stroke-dasharray="'+largo+' '+(circ-largo)+'" stroke-dashoffset="'+(-offset)+'" transform="rotate(-90 60 60)"></circle>';
    offset += largo;
    return seg;
  }).join('');
  var leyenda = partes.map(function(p){
    var pct = Math.round((p.val/total)*100);
    return '<div style="display:flex;align-items:center;gap:6px;margin:3px 0">'
      +'<div style="width:12px;height:12px;border-radius:3px;background:'+p.col+'"></div>'
      +'<span style="font-size:12px;color:#333">'+p.nom+': <b>'+pct+'%</b> ($'+fmtNum(p.val)+')</span></div>';
  }).join('');
  return '<div style="background:white;border:1px solid #eee;border-radius:12px;padding:14px;margin-bottom:12px">'
    +'<div style="font-size:12px;font-weight:700;color:#1a237e;text-align:center;margin-bottom:10px">💵 CÓMO TE PAGAN</div>'
    +'<div style="display:flex;align-items:center;gap:14px">'
    +'<svg width="120" height="120" viewBox="0 0 120 120" style="flex-shrink:0">'+segmentos+'</svg>'
    +'<div style="flex:1">'+leyenda+'</div></div></div>';
}

// ── Top 5 clientes que más compran ──
function exportarPanoramaPDF(){
  var contenido = document.getElementById('panorama-contenido');
  if(!contenido){ alert('No hay datos para exportar.'); return; }
  var nombrePeriodo = { hoy:'Hoy', semana:'Esta semana', mes:'Este mes', ano:'Este año' }[_panoramaPeriodo];
  var hoy = new Date().toLocaleDateString('es-US');

  // Estilos COMPACTOS para que todo quepa en una sola hoja carta
  var estilos = '<style>'
    + '@page { size: letter; margin: 8mm; }'
    + '* { box-sizing: border-box; }'
    + 'body { font-family: -apple-system, Arial, sans-serif; color:#222; margin:0; padding:0; width:100%; }'
    + '.cab { text-align:center; border-bottom:2px solid #D4A017; padding-bottom:6px; margin-bottom:10px; }'
    + '.cab h1 { font-size:20px; color:#1a237e; margin:0 0 2px; }'
    + '.cab .sub { font-size:11px; color:#666; margin:0; }'
    // Tarjetas: ancho completo pero MENOS espacio entre ellas y menos padding interno
    + '.pan-print > div { width:100% !important; max-width:100% !important; margin-bottom:8px !important; padding:8px 10px !important; page-break-inside:avoid; }'
    + '.pan-print svg { width:110px !important; height:110px !important; }'
    + '.pan-print { font-size:12px; }'
    // La tarjeta grande de ganancia: reducir su altura interna
    + '.pan-print div[style*="font-size:32px"] { font-size:28px !important; margin:2px 0 !important; }'
    + '.pan-print div[style*="font-size:20px"] { font-size:18px !important; }'
    // Gráfico de barras: bajarle la altura para que no ocupe tanto
    + '.pan-print div[style*="height:120px"] { height:70px !important; }'
    // Quitar márgenes internos grandes de los títulos de cada tarjeta
    + '.pan-print div[style*="margin-bottom:10px"] { margin-bottom:5px !important; }'
    + '</style>';

  var html = estilos
    + '<div class="cab"><h1>Panorama Completo — NBS</h1>'
    + '<p class="sub">'+nombrePeriodo+' · Generado el '+hoy+'</p></div>'
    + '<div class="pan-print">'+contenido.innerHTML+'</div>';

  // Intentar compartir con el menú del teléfono (WhatsApp, email, etc.) usando un texto resumen.
  // El reporte visual completo se abre en una ventana para guardar/compartir como PDF.
  var resumen = armarResumenPanoramaTexto(nombrePeriodo, hoy);
  if(navigator.share){
    navigator.share({ title:'Panorama Completo NBS', text: resumen }).catch(function(){});
  }

  // Además, abrir el reporte visual completo (con gráficos) para imprimir/guardar/compartir como PDF
  var vent = window.open('', '_blank');
  if(!vent){
    if(!navigator.share) alert('Permite las ventanas emergentes para compartir el reporte.');
    return;
  }
  vent.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>Panorama Completo NBS</title></head><body>'+html+'</body></html>');
  vent.document.close();
  setTimeout(function(){ try{ vent.focus(); vent.print(); }catch(e){} }, 400);
}

// Arma un resumen en texto del panorama, para compartir por WhatsApp/email
function armarResumenPanoramaTexto(nombrePeriodo, hoy){
  var r = rangoPanorama();
  var ventas = LS('nv', []).filter(function(v){ return !v.cancelada && ventaEnRango(v, r.desde, r.hasta); });
  var totalVentas = ventas.reduce(function(s,v){ return s+(v.total||0); }, 0);
  var totalGanancia = ventas.reduce(function(s,v){ return s+(v.ganancia||0); }, 0);
  var gastos = LS('ngastos', []).filter(function(g){ var f=parsearFechaVenta(g.fecha); return f && f>=r.desde && f<=r.hasta; });
  var totalGastos = gastos.reduce(function(s,g){ return s+(g.monto||0); }, 0);
  var gananciaReal = totalGanancia - totalGastos;
  var balances = calcularBalancesClientes();
  var teDeben = Object.keys(balances.total).reduce(function(s,cid){ var d=balances.total[cid]; return s+(d>0?d:0); }, 0);
  var tuDebes = calcularTotalPorPagar();
  return '📊 PANORAMA COMPLETO — NBS\n'+nombrePeriodo+' · '+hoy+'\n\n'
    + '💵 Ganancia real: $'+fmtNum(gananciaReal)+'\n'
    + '📈 Ventas: $'+fmtNum(totalVentas)+'\n'
    + '💳 Te deben: $'+fmtNum(teDeben)+'\n'
    + '📤 Tú debes: $'+fmtNum(tuDebes)+'\n\n'
    + 'Nunez Beauty Supply';
}

function renderDashboard(){
  var hoy = fechaHoy();
  ventas = LS('nv',[]);
  clientes = LS('ncl',[]);
  loadProds();
  var gastos = LS('ngastos',[]);

  // Ventas de hoy
  var ventasHoy = ventas.filter(function(v){
    return !v.cancelada && !v.esBalanceInicial && v.fecha === hoy;
  });
  var totalHoy = ventasHoy.reduce(function(s,v){ return s+v.total; },0);
  var gananciaHoy = ventasHoy.reduce(function(s,v){ return s+(v.ganancia||0); },0);

  // Ventas del mes
  var mesActual = hoy.split('/')[0]+'/'+hoy.split('/')[2]; // MM/YYYY
  var ventasMes = ventas.filter(function(v){
    if(v.cancelada||v.esBalanceInicial) return false;
    var p = (v.fecha || '').split('/');
    return p[0]+'/'+p[2] === mesActual;
  });
  var totalMes = ventasMes.reduce(function(s,v){ return s+v.total; },0);
  var gananciaMes = ventasMes.reduce(function(s,v){ return s+(v.ganancia||0); },0);
  var ticketPromedio = ventasMes.length>0 ? totalMes/ventasMes.length : 0;

  // Mes anterior, para comparar crecimiento
  var fechaMesAnterior = new Date(); fechaMesAnterior.setDate(1); fechaMesAnterior.setMonth(fechaMesAnterior.getMonth()-1);
  var mesAnteriorKey = String(fechaMesAnterior.getMonth()+1).padStart(2,'0')+'/'+fechaMesAnterior.getFullYear();
  var ventasMesAnterior = ventas.filter(function(v){
    if(v.cancelada||v.esBalanceInicial) return false;
    var p = (v.fecha || '').split('/');
    return p[0]+'/'+p[2] === mesAnteriorKey;
  });
  var totalMesAnterior = ventasMesAnterior.reduce(function(s,v){ return s+v.total; },0);
  var crecimientoPct = totalMesAnterior>0 ? Math.round(((totalMes-totalMesAnterior)/totalMesAnterior)*100) : null;

  // Devoluciones de este mes
  var devolucionesLS2 = LS('ndevoluciones', []);
  var devolucionesMes = devolucionesLS2.filter(function(d){
    var p = (d.fecha||'').split('/');
    return p[0]+'/'+p[2] === mesActual;
  });
  var totalDevueltoMes = devolucionesMes.reduce(function(s,d){ return s+d.monto; },0);
  var gananciaPerdidaMes = devolucionesMes.reduce(function(s,d){
    return s + (d.items || []).reduce(function(s2,it){ return s2+(it.cant*(it.precio-(it.costo||0))); },0);
  },0);
  gananciaMes = gananciaMes - gananciaPerdidaMes;

  // CxC total pendiente -restando cualquier credito a favor que tengan los clientes-
  var balancesPorCliente = {};
  ventas.filter(function(v){ return v.tipo==='credito'&&!v.cancelada; }).forEach(function(v){
    var key = String(v.cid);
    if(!balancesPorCliente[key]) balancesPorCliente[key] = {total:0,pagado:0};
    balancesPorCliente[key].total += v.total;
    var pf = v.pagosFactura ? (v.pagosFactura || []).filter(function(p){return typeof p.monto==='number';}).reduce(function(s,p){return s+p.monto;},0):0;
    balancesPorCliente[key].pagado += pf;
  });
  var totalCreditoAFavorTodos = clientes.reduce(function(s,c){ return s+(c.creditoAFavor||0); }, 0);
  var totalCxC = Object.keys(balancesPorCliente).reduce(function(s,k){
    return s + Math.max(0, balancesPorCliente[k].total - balancesPorCliente[k].pagado);
  },0);
  totalCxC = Math.max(0, totalCxC - totalCreditoAFavorTodos);

  // Cuentas vencidas -facturas a credito abiertas hace mas de 30 dias-
  var hoyDate = new Date();
  var cuentasVencidas = [];
  Object.keys(balancesPorCliente).forEach(function(k){
    var b = balancesPorCliente[k];
    var saldoB = Math.max(0, b.total-b.pagado);
    if(saldoB <= 0.005) return;
    var facturasDelCliente = ventas.filter(function(v){ return String(v.cid)===k && v.tipo==='credito' && !v.cancelada; });
    var masAntigua = facturasDelCliente.reduce(function(min,v){ var f=parsearFechaVenta(v.fecha); return (!min||f<min)?f:min; }, null);
    if(masAntigua){
      var dias = Math.floor((hoyDate-masAntigua)/(1000*60*60*24));
      if(dias >= 30){
        var clV = clientes.find(function(c){ return String(c.id)===k; });
        cuentasVencidas.push({ nombre: clV?nombreCl(clV):'Cliente', dias: dias, saldo: saldoB, cid: k });
      }
    }
  });
  cuentasVencidas.sort(function(a,b){ return b.dias-a.dias; });

  // Cuentas por Pagar (suplidores + tarjetas de credito + otras deudas)
  compras = LS('nc', []);
  var totalCxPSuplidores = 0;
  suplidores = LS('nsup', []);
  suplidores.forEach(function(s){
    var comprasS = compras.filter(function(c){ return String(c.sid)===String(s.id) && c.tipo==='credito'; });
    comprasS.forEach(function(c){
      var pagadoC = c.pagosFactura ? (c.pagosFactura || []).filter(function(p){return typeof p.monto==='number';}).reduce(function(s2,p){return s2+p.monto;},0) : 0;
      totalCxPSuplidores += Math.max(0, c.total - pagadoC);
    });
  });
  var totalCxPTarjetas = LS('ntarjetas', []).reduce(function(s,t){ return s+(t.balance||0); }, 0);
  var totalCxPOtras = LS('notrasdeudas', []).reduce(function(s,d){ return s+(d.balance||0); }, 0);
  var totalCxP = totalCxPSuplidores + totalCxPTarjetas + totalCxPOtras;

  // Gastos del mes
  var gastosMes = gastos.filter(function(g){
    var p = (g.fecha||'').split('/');
    return p[0]+'/'+p[2] === mesActual;
  });
  var totalGastosMes = gastosMes.reduce(function(s,g){ return s+(g.monto||0); },0);

  // Stock bajo
  var productosStockBajo = productos.filter(function(p){ return p.stock <= (p.min||5) && p.stock >= 0; });
  var productosSinStock = productos.filter(function(p){ return p.stock <= 0; });
  var negociosPendientesVisita = negociosParaVisitar();

  // Meta semanal
  var meta = parseInt(localStorage.getItem('metaSemanal')||'0');
  var inicioSemana = new Date();
  inicioSemana.setDate(inicioSemana.getDate() - inicioSemana.getDay());
  var ventasSemana = ventas.filter(function(v){
    if(v.cancelada||v.esBalanceInicial) return false;
    return parsearFechaVenta(v.fecha) >= inicioSemana;
  });
  var totalSemana = ventasSemana.reduce(function(s,v){ return s+v.total; },0);
  var progresoPct = meta > 0 ? Math.min(100, Math.round((totalSemana/meta)*100)) : 0;

  var el = document.getElementById('dashboard-contenido');
  if(!el) return;

  el.innerHTML = '<h3 style="font-size:12px;color:var(--nbs-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px;display:flex;align-items:center;gap:5px">📅Hoy — '+hoy+'</h3>'

  // Cards de hoy
  +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">'
  +'<div style="background:white;border-radius:12px;padding:14px;border:0.5px solid var(--nbs-line);box-shadow:var(--nbs-shadow-card)">'
  +'<div style="font-size:11px;color:var(--nbs-muted);font-weight:600;margin-bottom:6px">VENTAS HOY</div>'
  +'<div style="font-size:22px;font-weight:700;color:var(--nbs-ink)" class="contador-animado" data-valor="'+totalHoy+'">$0.00</div>'
  +'<div style="font-size:11px;color:var(--nbs-green-text);margin-top:4px">Ganancia: $'+fmtNum(gananciaHoy)+'</div>'
  +'</div>'
  +'<div style="background:white;border-radius:12px;padding:14px;border:0.5px solid var(--nbs-line);box-shadow:var(--nbs-shadow-card)">'
  +'<div style="font-size:11px;color:var(--nbs-muted);font-weight:600;margin-bottom:6px">FACTURAS HOY</div>'
  +'<div style="font-size:22px;font-weight:700;color:var(--nbs-ink)">'+ventasHoy.length+'</div>'
  +'<div style="font-size:11px;color:var(--nbs-muted);margin-top:4px">transacciones</div>'
  +'</div>'
  +'</div>'

  // Cards del mes
  +'<h3 style="font-size:12px;color:var(--nbs-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px;display:flex;align-items:center;gap:5px">📆Este mes</h3>'
  +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">'
  +'<div style="background:white;border-radius:12px;padding:14px;border:0.5px solid var(--nbs-line);box-shadow:var(--nbs-shadow-card)">'
  +'<div style="font-size:11px;color:var(--nbs-muted);font-weight:600;margin-bottom:6px">VENTAS DEL MES</div>'
  +'<div style="font-size:20px;font-weight:700;color:var(--nbs-ink)" class="contador-animado" data-valor="'+totalMes+'">$0.00</div>'
  +(crecimientoPct!==null ? '<div style="font-size:11px;color:'+(crecimientoPct>=0?'var(--nbs-green-text)':'var(--nbs-red-text)')+';margin-top:4px;font-weight:600">'+(crecimientoPct>=0?'↑ +':'↓ ')+crecimientoPct+'% comparado al mes pasado</div>' : '<div style="font-size:11px;color:var(--nbs-muted);margin-top:4px">Sin datos del mes pasado para comparar</div>')
  +'</div>'
  +'<div style="background:white;border-radius:12px;padding:14px;border:0.5px solid var(--nbs-line);box-shadow:var(--nbs-shadow-card)">'
  +'<div style="font-size:11px;color:var(--nbs-muted);font-weight:600;margin-bottom:6px">GASTOS DEL MES</div>'
  +'<div style="font-size:20px;font-weight:700;color:var(--nbs-red-dark)">$'+fmtNum(totalGastosMes)+'</div>'
  +'<div style="font-size:11px;color:var(--nbs-muted);margin-top:4px">gasolina, comida, suministros...</div>'
  +'</div>'
  +'</div>'

  // Ganancia neta del mes -tarjeta grande y clara, la mas importante de todas-
  +'<div style="background:'+(gananciaMes-totalGastosMes>=0?'var(--nbs-green-bg)':'var(--nbs-red-bg)')+';border-radius:12px;padding:16px;margin-bottom:16px;text-align:center">'
  +'<div style="font-size:12px;color:'+(gananciaMes-totalGastosMes>=0?'var(--nbs-green-text)':'var(--nbs-red-text)')+';font-weight:700">💵 LO QUE TE QUEDA REALMENTE ESTE MES</div>'
  +'<div style="font-size:11px;color:'+(gananciaMes-totalGastosMes>=0?'var(--nbs-green-text)':'var(--nbs-red-text)')+';margin-top:1px">Ganancia de tus ventas, menos tus gastos del mes</div>'
  +'<div style="font-size:26px;font-weight:800;color:'+(gananciaMes-totalGastosMes>=0?'var(--nbs-green-text)':'var(--nbs-red-text)')+';margin-top:4px" class="contador-animado" data-valor="'+(gananciaMes-totalGastosMes)+'">$0.00</div>'
  +(gananciaPerdidaMes>0.005?'<div style="font-size:10px;color:'+(gananciaMes-totalGastosMes>=0?'var(--nbs-green-text)':'var(--nbs-red-text)')+';margin-top:2px">Ya se restaron las devoluciones de este mes</div>':'')
  +'</div>'

  +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">'
  +'<div style="background:white;border-radius:12px;padding:14px;border:0.5px solid var(--nbs-line);box-shadow:var(--nbs-shadow-card)">'
  +'<div style="font-size:11px;color:var(--nbs-muted);font-weight:600;margin-bottom:6px">💰 VENTA PROMEDIO</div>'
  +'<div style="font-size:18px;font-weight:700;color:var(--nbs-ink)">$'+fmtNum(ticketPromedio)+'</div>'
  +'<div style="font-size:11px;color:var(--nbs-muted);margin-top:4px">Cuánto gasta un cliente en promedio -'+ventasMes.length+' venta(s) este mes-</div>'
  +'</div>'
  +(devolucionesMes.length>0 ? '<div style="background:#FFF3E0;border-radius:12px;padding:14px;border:0.5px solid #FFCC80">'
    +'<div style="font-size:11px;color:#E65100;font-weight:600;margin-bottom:6px">↩️ DEVOLUCIONES DEL MES</div>'
    +'<div style="font-size:18px;font-weight:700;color:#E65100">$'+fmtNum(totalDevueltoMes)+'</div>'
    +'<div style="font-size:11px;color:#E65100;margin-top:4px">'+devolucionesMes.length+' devolución(es)</div>'
    +'</div>' : '<div></div>')
  +'</div>'

  // Seccion de dinero -cuentas por cobrar y por pagar-
  +'<h3 style="font-size:12px;color:var(--nbs-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px;display:flex;align-items:center;gap:5px">💰 Dinero pendiente</h3>'
  +'<div onclick="ir(\'p-cxc\')" style="background:var(--nbs-gold-bg);border-radius:12px;padding:14px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;cursor:pointer">'
  +'<div><div style="font-size:12px;color:var(--nbs-gold-dark);font-weight:600;display:flex;align-items:center;gap:5px">💳 Lo que te deben tus clientes</div>'
  +'<div style="font-size:11px;color:var(--nbs-gold-dark);margin-top:2px">Toca para ver el detalle</div></div>'
  +'<div style="font-size:22px;font-weight:700;color:var(--nbs-gold-dark)" class="contador-animado" data-valor="'+totalCxC+'">$0.00</div>'
  +'</div>'

  +(cuentasVencidas.length > 0 ?
    '<div onclick="ir(\'p-cxc\')" style="background:#FFEBEE;border-radius:12px;padding:12px;margin-bottom:10px;cursor:pointer">'
    +'<div style="font-size:12px;color:#C62828;font-weight:600;margin-bottom:6px;display:flex;align-items:center;gap:5px">⏰ Clientes atrasados hace más de 30 días ('+cuentasVencidas.length+')</div>'
    +cuentasVencidas.slice(0,3).map(function(c){ return '<div style="font-size:12px;color:var(--nbs-ink);padding:3px 0;display:flex;justify-content:space-between"><span>• '+escaparHtml(c.nombre)+' ('+c.dias+' días)</span><span style="font-weight:700">$'+fmtNum(c.saldo)+'</span></div>'; }).join('')
    +(cuentasVencidas.length>3?'<div style="font-size:11px;color:var(--nbs-muted);margin-top:2px">...y '+(cuentasVencidas.length-3)+' más — toca para ver todas</div>':'')
    +'</div>' : '')

  +'<div onclick="ir(\'p-cxp\')" style="background:#F5E6EA;border-radius:12px;padding:14px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;cursor:pointer">'
  +'<div><div style="font-size:12px;color:#7B1E3A;font-weight:600;display:flex;align-items:center;gap:5px">📤 Lo que tú debes</div>'
  +'<div style="font-size:11px;color:#7B1E3A;margin-top:2px">A suplidores, tarjetas y otras deudas</div></div>'
  +'<div style="font-size:22px;font-weight:700;color:#7B1E3A" class="contador-animado" data-valor="'+totalCxP+'">$0.00</div>'
  +'</div>'

  // Diferencia entre lo que te deben y lo que debes
  +'<div style="background:'+(totalCxC-totalCxP>=0?'var(--nbs-green-bg)':'var(--nbs-red-bg)')+';border-radius:12px;padding:12px;margin-bottom:16px;text-align:center">'
  +'<div style="font-size:11px;color:'+(totalCxC-totalCxP>=0?'var(--nbs-green-text)':'var(--nbs-red-text)')+';font-weight:600">⚖️ LA DIFERENCIA ENTRE LOS DOS</div>'
  +'<div style="font-size:10px;color:'+(totalCxC-totalCxP>=0?'var(--nbs-green-text)':'var(--nbs-red-text)')+'">Lo que te deben, menos lo que tú debes</div>'
  +'<div style="font-size:18px;font-weight:800;color:'+(totalCxC-totalCxP>=0?'var(--nbs-green-text)':'var(--nbs-red-text)')+';margin-top:2px" class="contador-animado" data-valor="'+(totalCxC-totalCxP)+'">$0.00</div>'
  +'</div>'

  // Meta semanal
  +'<div style="background:white;border-radius:12px;padding:14px;margin-bottom:16px;border:0.5px solid var(--nbs-line);box-shadow:var(--nbs-shadow-card)">'
  +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">'
  +'<div style="font-size:12px;color:var(--nbs-ink);font-weight:600;display:flex;align-items:center;gap:5px">🎯Meta semanal</div>'
  +'<div style="font-size:13px;font-weight:600;color:var(--nbs-ink)">$'+fmtNum(totalSemana)+' / $'+fmtNum(meta)+'</div>'
  +'</div>'
  +'<div style="background:#F0F0F2;border-radius:20px;height:10px;overflow:hidden">'
  +'<div style="background:'+(progresoPct>=100?'var(--nbs-green-text)':'var(--nbs-gold)')+';height:100%;width:'+progresoPct+'%;border-radius:20px;transition:width 0.5s" class="barra-brillo"></div>'
  +'</div>'
  +'<div style="display:flex;justify-content:space-between;margin-top:6px">'
  +'<span style="font-size:11px;color:var(--nbs-muted)">'+progresoPct+'% completado</span>'
  +'<button onclick="cambiarMeta()" style="font-size:11px;color:var(--nbs-gold-dark);background:none;border:none;cursor:pointer;font-weight:600">Cambiar meta</button>'
  +'</div>'
  +'</div>'

  // Alertas de inventario
  +(productosSinStock.length > 0 ?
    '<div style="background:var(--nbs-red-bg);border-radius:12px;padding:12px;margin-bottom:8px">'
    +'<div style="font-size:12px;color:var(--nbs-red-dark);font-weight:600;margin-bottom:6px;display:flex;align-items:center;gap:5px">🚨 Productos agotados ('+productosSinStock.length+')</div>'
    +productosSinStock.slice(0,3).map(function(p){ return '<div style="font-size:12px;color:var(--nbs-ink);padding:3px 0">• '+escaparHtml(p.nombre)+'</div>'; }).join('')
    +(productosSinStock.length>3?'<div style="font-size:11px;color:var(--nbs-muted)">...y '+(productosSinStock.length-3)+' más</div>':'')
    +'</div>' : '')
  +(productosStockBajo.length > 0 ?
    '<div style="background:var(--nbs-gold-bg);border-radius:12px;padding:12px;margin-bottom:16px">'
    +'<div style="font-size:12px;color:var(--nbs-gold-dark);font-weight:600;margin-bottom:6px;display:flex;align-items:center;gap:5px">⚠️ Se está acabando el stock ('+productosStockBajo.length+')</div>'
    +productosStockBajo.slice(0,3).map(function(p){ return '<div style="font-size:12px;color:var(--nbs-ink);padding:3px 0">• '+escaparHtml(p.nombre)+' -quedan '+p.stock+' unidades-</div>'; }).join('')
    +(productosStockBajo.length>3?'<div style="font-size:11px;color:var(--nbs-muted)">...y '+(productosStockBajo.length-3)+' más</div>':'')
    +'</div>' : '')

  // Panorama de Inventario -conectado con el modulo completo, toca para ver todos los detalles-
  +'<h3 style="font-size:12px;color:var(--nbs-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px;display:flex;align-items:center;gap:5px">🏬 Inventario</h3>'
  +renderResumenInventarioDashboard()

  // Alerta de negocios para visitar (tiendas, meat market, etc)
  +(negociosPendientesVisita.length > 0 ?
    '<div onclick="ir(\'p-rutas\')" style="background:#FFEBEE;border-radius:12px;padding:12px;margin-bottom:16px;cursor:pointer">'
    +'<div style="font-size:12px;color:#C62828;font-weight:600;margin-bottom:6px;display:flex;align-items:center;gap:5px">🔔Negocios para visitar ('+negociosPendientesVisita.length+')</div>'
    +negociosPendientesVisita.slice(0,3).map(function(item){ return '<div style="font-size:12px;color:var(--nbs-ink);padding:3px 0">• '+item.nombre+'</div>'; }).join('')
    +(negociosPendientesVisita.length>3?'<div style="font-size:11px;color:var(--nbs-muted)">...y '+(negociosPendientesVisita.length-3)+' más — toca para ver en Ruta de Visitas</div>':'<div style="font-size:11px;color:var(--nbs-muted)">Toca para ver en Ruta de Visitas</div>')
    +'</div>' : '')

  // Productos más vendidos
  +'<h3 style="font-size:12px;color:var(--nbs-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px;display:flex;align-items:center;gap:5px">🏆Más vendidos este mes</h3>'
  +renderTopProductos(ventasMes)

  // Historial de precios recientes
  +'<h3 style="font-size:12px;color:var(--nbs-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-top:16px;margin-bottom:10px;display:flex;align-items:center;gap:5px">📈Historial de precios</h3>'
  +'<div style="background:white;border-radius:12px;padding:12px;border:0.5px solid var(--nbs-line);box-shadow:var(--nbs-shadow-card)">'
  +renderHistorialPrecios()
  +'</div>';
  animarContadoresDashboard();
}

function lanzarConfeti(){
  var colores = ['#B8860B','#1a237e','#7B1E3A','#D4AF37','#3B6D11'];
  var cantidad = 32;
  for(var c=0; c<cantidad; c++){
    var pieza = document.createElement('div');
    pieza.className = 'confeti-pieza';
    pieza.style.left = (Math.random()*100)+'vw';
    pieza.style.background = colores[Math.floor(Math.random()*colores.length)];
    pieza.style.animationDuration = (1.8+Math.random()*1.4)+'s';
    pieza.style.animationDelay = (Math.random()*0.4)+'s';
    document.body.appendChild(pieza);
    (function(p){ setTimeout(function(){ p.remove(); }, 3500); })(pieza);
  }
}

function animarContadoresDashboard(){
  document.querySelectorAll('.contador-animado').forEach(function(el){
    var valorFinal = parseFloat(el.getAttribute('data-valor')) || 0;
    var esNegativo = valorFinal < 0;
    var absValor = Math.abs(valorFinal);
    var pasos = 28;
    var actual = 0;
    var incremento = absValor/pasos;
    var i = 0;
    var intervalo = setInterval(function(){
      actual += incremento;
      i++;
      if(i>=pasos){ actual = absValor; clearInterval(intervalo); }
      el.textContent = (esNegativo?'-':'')+'$'+fmtNum(actual);
    }, 22);
  });
}

function cambiarMeta(){
  var actual = parseInt(localStorage.getItem('metaSemanal')||'0');
  var nueva = prompt('Meta de ventas semanal ($):', actual);
  if(nueva !== null && !isNaN(parseInt(nueva))){
    localStorage.setItem('metaSemanal', parseInt(nueva).toString());
    renderDashboard();
  }
}

// ===== RUTAS DE VISITA =====
var DIAS_SEMANA = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
var DIAS_KEYS = ['lun','mar','mie','jue','vie','sab'];

function getDiaHoy(){
  var d = new Date().getDay(); // 0=dom,1=lun...6=sab
  var map = {1:'lun',2:'mar',3:'mie',4:'jue',5:'vie',6:'sab'};
  return map[d] || 'lun';
}

// Devuelve la fecha (MM/DD/YYYY) de la ocurrencia MAS RECIENTE de ese dia de la semana
// -hoy mismo si coincide, o hasta 6 dias hacia atras si ya paso esta semana-.
// Esto permite marcar un negocio como visitado aunque hayan pasado uno o varios dias,
// mientras siga siendo la misma semana.
function fechaMasRecienteParaDia(diaKey){
  var mapInverso = {'lun':1,'mar':2,'mie':3,'jue':4,'vie':5,'sab':6};
  var diaObjetivo = mapInverso[diaKey];
  if(!diaObjetivo) return fechaHoy();
  var hoy = new Date();
  var diaActualNum = hoy.getDay();
  var diferencia = diaActualNum - diaObjetivo;
  if(diferencia < 0) diferencia += 7; // si el dia objetivo cae mas adelante en la semana, retroceder toda la semana
  var fechaResultado = new Date(hoy);
  fechaResultado.setDate(hoy.getDate() - diferencia);
  var mm = String(fechaResultado.getMonth()+1).padStart(2,'0');
  var dd = String(fechaResultado.getDate()).padStart(2,'0');
  var yyyy = fechaResultado.getFullYear();
  return mm+'/'+dd+'/'+yyyy;
}

function navegarANegocio(nombreNegocio){
  clientes = LS('ncl', []);
  // Buscar TODOS los clientes de ese negocio -no solo el primero-, sin importar mayusculas/minusculas
  var todosDelNegocio = clientes.filter(function(c){
    return (c.negocio||'').trim().toLowerCase() === nombreNegocio.trim().toLowerCase();
  });
  var conDireccion = todosDelNegocio.filter(function(c){ return c.dir || c.ciudad; });

  if(!conDireccion.length){
    alert('No hay una dirección guardada para "'+nombreNegocio+'" todavía.\n\nPuedes agregarla desde el perfil de un cliente de ese negocio -Editar cliente-.');
    return;
  }

  // Revisar si hay direcciones DISTINTAS entre los barberos de este mismo negocio -eso indicaria
  // un dato mal cargado en alguno de ellos, y por eso el mapa podria llevar al lugar equivocado-.
  var direccionesUnicas = {};
  conDireccion.forEach(function(c){
    var dirCompleta = [c.dir, c.ciudad, c.estado, c.zip].filter(Boolean).join(', ').toLowerCase();
    direccionesUnicas[dirCompleta] = (direccionesUnicas[dirCompleta]||[]).concat(nombreCl(c));
  });
  var listaDirecciones = Object.keys(direccionesUnicas);

  if(listaDirecciones.length > 1){
    // Hay direcciones que NO coinciden entre los barberos de la misma barberia -avisar claramente
    // en vez de adivinar cual usar, para no llevar al lugar equivocado otra vez-.
    var mensaje = '⚠️ "'+nombreNegocio+'" tiene DIRECCIONES DISTINTAS guardadas entre sus barberos:\n\n';
    listaDirecciones.forEach(function(dir, i){
      mensaje += (i+1)+'. '+dir+'\n   -de: '+direccionesUnicas[dir].join(', ')+'\n\n';
    });
    mensaje += 'Corrige la dirección incorrecta desde el perfil de ese cliente -Editar cliente- para que el mapa lleve siempre al lugar correcto.';
    alert(mensaje);
    return;
  }

  var cl = conDireccion[0];
  var direccionCompleta = [cl.dir, cl.ciudad, cl.estado, cl.zip].filter(Boolean).join(', ');
  var url = 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(direccionCompleta);
  window.open(url, '_blank');
}

// \u2705 Arreglar una fecha mal escrita, en todos los sitios donde est\u00e9.  (8 sep 2026)
// El caso real: la factura #0009 de Jorge Duarte ten\u00eda "6/17/2026" en vez de
// "06/17/2026", y se descolgaba de su mes en los reportes.
function arreglarUnaFecha(vieja, nueva){
  if(!confirm('\u00bfCambiar la fecha?\n\n' + vieja + '  \u2192  ' + nueva)) return;
  var tocadas = 0;

  var V = LS('nv', []);
  V.forEach(function(v){
    if(v.fecha === vieja){ v.fecha = nueva; v.mod = Date.now(); tocadas++; }
    (v.pagosFactura || []).forEach(function(p){
      if(p && p.fecha === vieja){ p.fecha = nueva; tocadas++; }
    });
  });
  if(tocadas) SS('nv', V);

  var G = LS('ngastos', []);
  var tg = 0;
  G.forEach(function(g){ if(g.fecha === vieja){ g.fecha = nueva; tg++; } });
  if(tg){ SS('ngastos', G); tocadas += tg; }

  var C = LS('nc', []);
  var tc = 0;
  C.forEach(function(c){
    if(c.fecha === vieja){ c.fecha = nueva; tc++; }
    (c.pagosFactura || []).forEach(function(p){
      if(p && p.fecha === vieja){ p.fecha = nueva; tc++; }
    });
  });
  if(tc){ SS('nc', C); tocadas += tc; }

  ventas = LS('nv', []);
  avisoGrande('\u2705 Arreglado.\n\n' + vieja + '  \u2192  ' + nueva
    + '\n\nSe cambi\u00f3 en ' + tocadas + ' sitio(s).');
  try { revisarFechasSospechosas(); } catch(e){}
}

function revisarFechasSospechosas(){
  var problemas = [];

  function revisarFecha(fechaStr, origen, detalle){
    if(!fechaStr) return;
    if(fechaStr.indexOf('-') >= 0){
      problemas.push({ origen: origen, detalle: detalle, fecha: fechaStr, razon: 'Tiene guiones en vez de diagonales -formato viejo, incorrecto-' });
      return;
    }
    var partes = fechaStr.split('/');
    if(partes.length !== 3){
      problemas.push({ origen: origen, detalle: detalle, fecha: fechaStr, razon: 'No tiene el formato esperado MM/DD/AAAA' });
      return;
    }
    var mes = parseInt(partes[0]), dia = parseInt(partes[1]), anio = parseInt(partes[2]);
    // \ud83d\udd11 Le faltan los ceros: "6/17/2026" en vez de "06/17/2026". parseInt la lee
    // bien, pero al cortarla por posici\u00f3n se descuadra y la factura se sale de su mes.
    if(partes[0].length !== 2 || partes[1].length !== 2 || partes[2].length !== 4){
      problemas.push({ origen: origen, detalle: detalle, fecha: fechaStr,
        razon: 'Le faltan ceros: deber\u00eda ser MM/DD/AAAA con dos d\u00edgitos en mes y d\u00eda',
        arreglable: (mes >= 1 && mes <= 12 && dia >= 1 && dia <= 31 && anio >= 2020 && anio <= 2035)
          ? (mes < 10 ? '0' : '') + mes + '/' + (dia < 10 ? '0' : '') + dia + '/' + anio
          : null });
      return;
    }
    if(mes > 12){
      problemas.push({ origen: origen, detalle: detalle, fecha: fechaStr, razon: 'El primer número ('+mes+') es mayor a 12 -no puede ser un mes-, esta fecha puede estar invertida' });
    } else if(anio < 2020 || anio > 2035){
      problemas.push({ origen: origen, detalle: detalle, fecha: fechaStr, razon: 'El año ('+anio+') se ve fuera de lo normal' });
    }
  }

  ventas = LS('nv', []);
  ventas.forEach(function(v){ revisarFecha(v.fecha, 'Venta', 'Factura de '+(v.cn||'cliente')+' por $'+fmtNum(v.total)); });
  var gastosRev = LS('ngastos', []);
  gastosRev.forEach(function(g){ revisarFecha(g.fecha, 'Gasto', g.cat+' - $'+fmtNum(g.monto)); });
  var comprasRev = LS('nc', []);
  comprasRev.forEach(function(c){ revisarFecha(c.fecha, 'Compra', c.sn+' - $'+fmtNum(c.total)); });
  var devRev = LS('ndevoluciones', []);
  devRev.forEach(function(d){ revisarFecha(d.fecha, 'Devolución', (d.cn||'cliente')+' - $'+fmtNum(d.monto)); });

  var overlay = document.getElementById('diagnostico-fechas-overlay');
  if(!overlay){
    overlay = document.createElement('div');
    overlay.id = 'diagnostico-fechas-overlay';
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
  header.appendChild(btnBack);
  wrap.appendChild(header);

  var titulo = document.createElement('div');
  titulo.innerHTML = '<div style="font-size:18px;font-weight:800;color:#C62828">🔍 Revisión de Fechas</div>'
    +'<div style="font-size:13px;color:#aaa;margin-top:2px">Ventas, gastos, compras y devoluciones con fechas sospechosas</div>';
  wrap.appendChild(titulo);

  if(!problemas.length){
    var ok = document.createElement('div');
    ok.style.cssText = 'background:#E8F5E9;border-radius:10px;padding:16px;margin-top:16px;text-align:center;color:#2E7D32;font-size:13px';
    ok.textContent = '✅ No se encontró ninguna fecha con formato sospechoso en tus datos.';
    wrap.appendChild(ok);
  } else {
    var aviso = document.createElement('div');
    aviso.style.cssText = 'background:#FFEBEE;border-radius:10px;padding:12px;margin:14px 0;font-size:12px;color:#C62828';
    aviso.textContent = 'Se encontraron '+problemas.length+' registro(s) con fechas que vale la pena revisar. La app no puede adivinar sola cuál es la fecha correcta cuando el día y el mes son ambos 12 o menos -por ejemplo, 05/07/2026 podría ser 5 de julio o 7 de mayo-, así que estas hay que corregirlas a mano si hace falta, editando esa venta, gasto, o compra.';
    wrap.appendChild(aviso);

    problemas.forEach(function(pr){
      var card = document.createElement('div');
      card.style.cssText = 'background:#FAFAFA;border-radius:10px;padding:12px;margin-bottom:8px;border:1px solid #FFCDD2';
      card.innerHTML = '<div style="font-size:13px;font-weight:800;color:#1a237e">'+pr.origen+' · '+pr.detalle+'</div>'
        +'<div style="font-size:12px;color:#333;margin-top:4px">📅 Fecha guardada: <b>'+pr.fecha+'</b></div>'
        +'<div style="font-size:11px;color:#C62828;margin-top:2px">'+pr.razon+'</div>'
        // ✅ Si la fecha se puede deducir sola, se ofrece arreglarla de un toque. -8 sep-
        + (pr.arreglable
            ? '<div style="font-size:11.5px;color:#2E7D32;font-weight:700;margin-top:6px">'
              + 'Deber\u00eda ser: <b>' + pr.arreglable + '</b></div>'
              + '<button onclick="arreglarUnaFecha(' + _arg(String(pr.fecha)) + ',' + _arg(String(pr.arreglable)) + ')" '
              + 'style="width:100%;margin-top:6px;padding:9px;background:#2E7D32;color:#fff;border:none;'
              + 'border-radius:8px;font-size:12px;font-weight:800;cursor:pointer">'
              + '\u2713 Arreglarla a ' + pr.arreglable + '</button>'
            : '');
      wrap.appendChild(card);
    });
  }

  overlay.innerHTML = '';
  overlay.appendChild(wrap);
  overlay.style.display = 'block';
}

function revisarDireccionesDeNegocios(){
  clientes = LS('ncl', []);
  var porNegocio = {};
  clientes.forEach(function(c){
    var neg = (c.negocio||'').trim();
    if(!neg) return;
    var key = neg.toLowerCase();
    if(!porNegocio[key]) porNegocio[key] = { nombreOriginal: neg, clientes: [] };
    porNegocio[key].clientes.push(c);
  });

  var conflictos = [];
  Object.keys(porNegocio).forEach(function(key){
    var grupo = porNegocio[key];
    var direcciones = {};
    grupo.clientes.forEach(function(c){
      if(!c.dir && !c.ciudad) return;
      var dirCompleta = [c.dir, c.ciudad, c.estado, c.zip].filter(Boolean).join(', ');
      direcciones[dirCompleta] = (direcciones[dirCompleta]||[]).concat(nombreCl(c));
    });
    if(Object.keys(direcciones).length > 1){
      conflictos.push({ negocio: grupo.nombreOriginal, direcciones: direcciones });
    }
  });

  var overlay = document.getElementById('diagnostico-direcciones-overlay');
  if(!overlay){
    overlay = document.createElement('div');
    overlay.id = 'diagnostico-direcciones-overlay';
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
  titulo.innerHTML = '<div style="font-size:18px;font-weight:800;color:#C62828">🔍 Revisión de Direcciones</div>'
    +'<div style="font-size:13px;color:#aaa;margin-top:2px">Negocios con direcciones distintas entre sus barberos</div>';
  wrap.appendChild(titulo);

  if(!conflictos.length){
    var ok = document.createElement('div');
    ok.style.cssText = 'background:#E8F5E9;border-radius:10px;padding:16px;margin-top:16px;text-align:center;color:#2E7D32;font-size:13px';
    ok.textContent = '✅ No se encontró ningún negocio con direcciones que no coincidan entre sus barberos.';
    wrap.appendChild(ok);
  } else {
    var avisoTop = document.createElement('div');
    avisoTop.style.cssText = 'background:#FFEBEE;border-radius:10px;padding:12px;margin:14px 0;font-size:12px;color:#C62828';
    avisoTop.textContent = conflictos.length+' negocio(s) tienen direcciones que no coinciden entre sus barberos — esto puede ser la causa de que el mapa lleve al lugar equivocado.';
    wrap.appendChild(avisoTop);

    conflictos.forEach(function(c){
      var card = document.createElement('div');
      card.style.cssText = 'background:#FAFAFA;border-radius:10px;padding:12px;margin-bottom:10px;border:1px solid #FFCDD2';
      var html = '<div style="font-size:14px;font-weight:800;color:#1a237e;margin-bottom:8px">🏪 '+c.negocio+'</div>';
      Object.keys(c.direcciones).forEach(function(dir){
        html += '<div style="font-size:12px;color:#333;margin-bottom:4px">📍 '+dir+'<br><span style="color:#aaa;font-size:11px">de: '+c.direcciones[dir].join(', ')+'</span></div>';
      });
      card.innerHTML = html;
      wrap.appendChild(card);
    });
  }

  overlay.innerHTML = '';
  overlay.appendChild(wrap);
  overlay.style.display = 'block';
}


// ═══════════════════════════════════════════════════════════════════
//  LEER LA FACTURA DEL SUPLIDOR DESDE EL PDF  (27 jul, pedido de Sensei)
// ═══════════════════════════════════════════════════════════════════
//
// COMO LLEGA: Sensei pide por correo y le mandan la factura en PDF. Eso es lo
// mejor que podia pasar: un PDF trae el TEXTO ADENTRO, no hay que adivinar
// letra por letra como con una foto.
//
// LA IDEA QUE HACE ESTO SEGURO PARA EL DINERO: no se confia en lo que leyo.
// Se COMPRUEBA con las cuentas de la propia factura, dos veces:
//   1. Por linea:   cantidad x precio = total de la linea
//   2. En conjunto: la suma de las lineas = el Subtotal impreso
// Si algo no cuadra, se marca en rojo y NO se mete callado a la compra.
//
// LO ELEGANTE: las cuentas mismas dicen cual numero es cual. En Kanar hay una
// columna B/O -pedido pendiente- metida entre la cantidad y el precio:
//     NISHMAN AFTER SHAVE ... 400ML   8   16   3.48   27.84
// Un lector tonto agarraria el 16 y le meteria al inventario 16 unidades que
// NUNCA LLEGARON. Aqui se prueban las combinaciones y solo 8 x 3.48 = 27.84
// cuadra, asi que el 16 se descarta solo, sin tener que saber el formato.
//
// APRENDE: cada vez que Sensei empareja una linea con un producto suyo, se
// guarda. La proxima factura de ese suplidor ya sale emparejada sola.

var PDFJS_URL   = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
var PDFJS_WORKER= 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
var CLAVE_EMPAREJADOS = 'nbs_facturas_emparejadas';
var _pdfjsPromesa = null;

// Los suplidores que ya conoce. Se reconoce por palabras de la propia factura.
// Para agregar uno nuevo: copiar un bloque y poner sus senas.
var SUPLIDORES_FACTURA = [
  { id:'vecina',  nombre:'Vecina Beauty Supply',
    senas:['VECINA','MARSTON','LAWRENCE'],
    columnaIzquierda:'marca' },   // Vecina trae la MARCA en la primera columna
  { id:'kanar',   nombre:'Kanar',
    senas:['KANAR','KERO ROAD','CARLSTADT'],
    columnaIzquierda:'modelo' },  // Kanar trae el CODIGO del suplidor
  { id:'monkeys', nombre:'Monkeys Group',
    senas:['MONKEYS','MONKEYSGROUP'],
    columnaIzquierda:'ninguna',
    ignorarLineas:['ORIGINAL PRICE','CREDICARD','VIEW ONLINE','SQUAREUP','PAGE '] }
];

function cargarPdfJs(){
  if(window.pdfjsLib) return Promise.resolve();
  if(_pdfjsPromesa) return _pdfjsPromesa;
  _pdfjsPromesa = new Promise(function(resolve, reject){
    var listo = false;
    var sc = document.createElement('script');
    sc.src = PDFJS_URL;
    sc.onload = function(){
      if(window.pdfjsLib){
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
        listo = true; resolve();
      } else { _pdfjsPromesa = null; reject(new Error('SIN_LIBRERIA')); }
    };
    sc.onerror = function(){ _pdfjsPromesa = null; reject(new Error('SIN_RED')); };
    setTimeout(function(){ if(!listo){ _pdfjsPromesa = null; reject(new Error('TARDO')); } }, 25000);
    document.head.appendChild(sc);
  });
  return _pdfjsPromesa;
}

// Saca el texto del PDF agrupado en LINEAS, con la posicion de cada palabra.
// Junta todas las paginas seguidas -Monkeys manda facturas de 2 paginas-.
function sacarLineasDelPdf(datos){
  return window.pdfjsLib.getDocument({ data: datos }).promise.then(function(pdf){
    var trabajos = [];
    for(var i = 1; i <= pdf.numPages; i++){
      trabajos.push(pdf.getPage(i).then(function(pg){ return pg.getTextContent(); }));
    }
    return Promise.all(trabajos).then(function(paginas){
      var lineas = [];
      paginas.forEach(function(tc, np){
        var porFila = {};
        (tc.items || []).forEach(function(it){
          if(!it.str || !it.str.trim()) return;
          var x = it.transform[4], y = it.transform[5];
          var clave = Math.round(y / 3);           // agrupa lo que esta a la misma altura
          if(!porFila[clave]) porFila[clave] = [];
          porFila[clave].push({ t: it.str.trim(), x: x });
        });
        Object.keys(porFila)
          .sort(function(a,b){ return b - a; })    // de arriba hacia abajo
          .forEach(function(k){
            var pal = porFila[k].sort(function(a,b){ return a.x - b.x; });
            lineas.push({ pagina: np+1, palabras: pal, texto: pal.map(function(p){ return p.t; }).join(' ') });
          });
      });
      return lineas;
    });
  });
}

function esNumeroFactura(t){
  return /^-?\$?[\d,]+\.?\d*$/.test(t) && /\d/.test(t);
}
function aNumero(t){
  return parseFloat(String(t).replace(/[$,]/g, ''));
}

// De una linea saca {descripcion, cant, costo, total} usando las CUENTAS.
// Devuelve null si esa linea no es un producto.
function leerLineaDeFactura(linea){
  var pal = linea.palabras;
  if(pal.length < 3) return null;

  // 1) La tira de numeros pegados al final. Se para en cuanto aparece algo que
  //    no sea numero puro -asi "500ML", "5lb" o "5 ROLL" no confunden-.
  var nums = [], i = pal.length - 1;
  while(i >= 0 && esNumeroFactura(pal[i].t)){ nums.unshift(aNumero(pal[i].t)); i--; }
  if(nums.length < 3) return null;              // hacen falta al menos cant, precio y total

  var total = nums[nums.length - 1];
  if(!(total > 0)) return null;

  // 2) Buscar QUE PAR de numeros multiplicado da el total. Se prueba de derecha a
  //    izquierda, que es donde estan las columnas de verdad -asi si la descripcion
  //    dejo colado un numero, gana el par correcto-.
  var cant = null, costo = null;
  for(var a = nums.length - 2; a >= 0 && cant === null; a--){
    for(var b = a - 1; b >= 0; b--){
      var q = nums[b], pr = nums[a];
      if(q > 0 && Number.isInteger(q) && pr > 0 && Math.abs(q * pr - total) < 0.015){
        cant = q; costo = pr; break;
      }
      // tambien al reves, por si el precio va antes que la cantidad
      if(pr > 0 && Number.isInteger(pr) && q > 0 && Math.abs(pr * q - total) < 0.015){
        cant = pr; costo = q; break;
      }
    }
  }
  if(cant === null) return null;

  // 3) La descripcion es todo lo que quedo antes de los numeros
  var desc = pal.slice(0, pal.length - nums.length).map(function(p){ return p.t; }).join(' ').trim();
  if(desc.length < 3) return null;

  return { descripcion: desc, cant: cant, costo: costo, total: total,
           x0: pal[0].x, cuadra: true };
}

function montoNegativoDeLinea(pal){
  for(var j = pal.length - 1; j >= 0; j--){
    var t = String(pal[j].t || '').trim();
    // 1) el numero viene con su signo pegado:  -612.78
    if(esNumeroFactura(t)){
      var v = aNumero(t);
      if(isFinite(v) && v < -0.005) return { monto: Math.abs(v), corte: j };
      // 2) el signo quedo suelto en la palabra de antes:  -   612.78
      if(isFinite(v) && v > 0.005 && j > 0 && String(pal[j-1].t || '').trim() === '-'){
        return { monto: v, corte: j - 1 };
      }
      return null;   // el ultimo numero es positivo: no es descuento
    }
    // 3) contabilidad clasica, el negativo entre parentesis:  (612.78)
    var m = t.match(/^\(\$?([\d,]+\.?\d*)\)$/);
    if(m){
      var v2 = parseFloat(m[1].replace(/,/g,''));
      if(isFinite(v2) && v2 > 0.005) return { monto: v2, corte: j };
      return null;
    }
  }
  return null;
}

function normTextoFactura(t){
  return canonizarMedidas(t)
    .replace(/[ÁÀÄÂ]/g,'A').replace(/[ÉÈËÊ]/g,'E').replace(/[ÍÌÏÎ]/g,'I')
    .replace(/[ÓÒÖÔ]/g,'O').replace(/[ÚÙÜÛ]/g,'U').replace(/Ñ/g,'N')
    .replace(/[^A-Z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
}

function emparejadosGuardados(){ return LS(CLAVE_EMPAREJADOS, {}); }

// Saca las MEDIDAS de un texto -5LB, 32OZ, 500ML...-. Esto salio de una prueba con la
// factura real de Vecina: trae "OLIVE OIL STYLING GEL - GREEN 5lb" Y "... GREEN 32oz",
// dos productos DISTINTOS que comparten casi todas las palabras. Sin mirar la medida, el
// emparejador metia los dos en el mismo producto y sumaba las cantidades -un error de
// inventario y de dinero-. Si los dos textos traen medida y NINGUNA coincide, no es el
// mismo producto y punto.
// Deja todas las medidas escritas IGUAL, venga como venga: "5 LBS", "5lb" y "5 Lb"
// terminan siendo "5LB". Hace falta porque el suplidor y Sensei las escriben distinto:
// la factura de Vecina dice "GREEN 5lb" y su producto se llama "ECO OLIVE OIL 5 LBS".
function canonizarMedidas(t){
  return String(t || '').toUpperCase().replace(/,/g, '')
    .replace(/(\d+(?:\.\d+)?)\s*(OZ|ML|LBS|LB|KG|GR|G|PK|CT)\b/g, function(m, num, uni){
      var u = uni === 'LBS' ? 'LB' : (uni === 'GR' ? 'G' : uni);
      return num.replace('.', '') + u;
    });
}

function medidasDe(t){
  var n = canonizarMedidas(t);
  var out = [], re = /(\d+)(OZ|ML|LB|KG|G|PK|CT)\b/g, m;
  while((m = re.exec(n))) out.push(m[1] + m[2]);
  return out;
}
function medidasChocan(a, b){
  var ma = medidasDe(a), mb = medidasDe(b);
  if(!ma.length || !mb.length) return false;      // si alguno no dice medida, no se puede juzgar
  for(var i = 0; i < ma.length; i++){
    if(mb.indexOf(ma[i]) >= 0) return false;       // comparten al menos una: van bien
  }
  return true;                                     // los dos dicen medida y ninguna coincide
}

function recordarEmparejado(supId, desc, pid){
  var m = emparejadosGuardados();
  m[supId + '|' + normTextoFactura(desc)] = pid;
  SS(CLAVE_EMPAREJADOS, m);
}

// SOLO devuelve un producto si Sensei YA lo emparejo antes. NUNCA adivina.
//
// POR QUE: se probo el emparejado automatico contra su catalogo REAL de 386 productos
// y el resultado fue malo Y PELIGROSO: de la factura de Vecina emparejo 1 de 12, y ese
// 1 estaba EQUIVOCADO -metia "OLIVE OIL STYLING GEL 32oz" dentro de "ECO HAIR GEL
// CANNABIS SATIVA OIL 32oz", que es otro producto-. Lo mismo en Kanar. La razon es
// simple: Sensei nombra sus productos a su manera y el suplidor a la suya.
// Un emparejado equivocado le mete mercancia al producto equivocado SIN AVISAR, que es
// peor que no emparejar nada. Asi que ahora solo se propone -las mas parecidas salen
// arriba en la lista- y el escoge. Lo que escoge se aprende y ya no se le pregunta mas.
function sugerenciasPara(desc, cuantas){
  loadProds();
  var palabras = normTextoFactura(desc).split(' ').filter(function(w){ return w.length > 2; });
  if(!palabras.length) return [];
  var lista = [];
  productos.forEach(function(p){
    if(medidasChocan(desc, p.nombre)) return;   // 5lb no es 32oz
    var np = normTextoFactura(p.nombre + ' ' + (p.marca || ''));
    var aciertos = 0;
    palabras.forEach(function(w){ if(np.indexOf(w) >= 0) aciertos++; });
    if(aciertos) lista.push({ p: p, punto: aciertos / palabras.length });
  });
  lista.sort(function(a, b){ return b.punto - a.punto; });
  return lista.slice(0, cuantas || 5).map(function(x){ return x.p; });
}


// ── ATAJO: comprarle a un suplidor desde su perfil (27 jul) ──
// Lleva a la pantalla de Compras con ese suplidor ya escogido, y si se le pide,
// abre de una vez el buscador del PDF.
//
// EL CUIDADO IMPORTANTE: si ya hay renglones sin guardar de OTRA compra, mezclarlos
// seria un enredo de dinero. Asi que se pregunta antes y nunca se borra nada callado.
function abrirLectorFactura(){
  var inp = document.getElementById('factura-pdf-input');
  if(!inp) return;
  inp.value = '';
  inp.click();
}

function _fechaTieneSentido(a, m, d){
  if(!a || !m || !d) return false;
  if(m < 1 || m > 12 || d < 1 || d > 31) return false;
  var hoy = new Date();
  var f = new Date(a, m - 1, d);
  if(isNaN(f.getTime())) return false;
  // \ud83d\udd11 new Date(2026,1,31) NO falla: se pasa solo al 3 de marzo. Si el dia que sale
  // no es el que se pidio, esa fecha no existe -el 31 de febrero, el 31 de abril-. -2 sep-
  if(f.getDate() !== d || (f.getMonth() + 1) !== m || f.getFullYear() !== a) return false;
  // Hasta 3 días en el futuro (por husos horarios) y hasta 2 años atrás
  var maxFuturo = new Date(hoy.getTime() + 3 * 86400000);
  var minPasado = new Date(hoy.getFullYear() - 2, hoy.getMonth(), hoy.getDate());
  return f <= maxFuturo && f >= minPasado;
}

function _mmddaaaa(a, m, d){
  return (m < 10 ? '0' : '') + m + '/' + (d < 10 ? '0' : '') + d + '/' + a;
}

/**
 * Busca la fecha de la factura en el texto del PDF.
 * Devuelve MM/DD/AAAA, o null si no encontró ninguna con sentido.
 *
 * Da preferencia a las fechas que están JUNTO a una palabra como "Invoice Date"
 * o "Fecha", porque un PDF trae varias fechas (vencimiento, impresión, envío).
 */
function _aFormatoCalendario(f){
  var p = String(f || '').split('/');
  if(p.length !== 3) return '';
  return p[2] + '-' + p[0] + '-' + p[1];
}

function cambiarFechaDeLaFactura(valor){
  try {
    var campo = document.getElementById('cc-fecha');
    if(campo && valor) campo.value = valor;
    if(valor){
      var p = String(valor).split('-');
      if(p.length === 3) window._fechaDelPdf = p[1] + '/' + p[2] + '/' + p[0];
    }
  } catch(e){}
}

function pintarRevisionFactura(){
  loadProds();
  var items = window._facturaItems || [];
  var sup = window._facturaSup || { nombre: '' };
  var sub = window._facturaSubtotal;

  var suma = 0;
  items.forEach(function(it){ if(it.marcado) suma += it.cant * it.costo; });
  var sumaTodo = items.reduce(function(a, it){ return a + it.cant * it.costo; }, 0);

  var cuadraGlobal = (sub !== null && sub !== undefined) ? (Math.abs(sumaTodo - sub) < 0.05) : null;

  var html = '<div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:8px">'
    + '<div style="flex:1"><div style="font-size:17px;font-weight:900;color:#1a237e">📄 ' + escaparHtml(sup.nombre) + '</div>'
    + '<div style="font-size:12px;color:#666">' + items.length + ' renglones encontrados</div></div>'
    + '<button onclick="cerrarRevisionFactura()" style="flex-shrink:0;width:34px;height:34px;border:none;border-radius:9px;background:#f0f0f0;color:#666;font-size:20px;font-weight:800;cursor:pointer">✕</button>'
    + '</div>';

  // 📅 LA FECHA QUE SE SACÓ DE LA FACTURA -2 sep-. Se enseña para que él la vea y,
  // si el suplidor la puso mal, la corrija ahí mismo.
  if(window._fechaDelPdf){
    html += '<div style="background:#E3F2FD;border:1px solid #90CAF9;border-radius:9px;padding:9px;margin-bottom:10px">'
      + '<div style="font-size:11px;color:#1565C0;font-weight:800;letter-spacing:.3px;margin-bottom:3px">📅 FECHA DE LA FACTURA</div>'
      + '<input type="date" id="rev-fecha" value="' + escaparHtml(_aFormatoCalendario(window._fechaDelPdf)) + '" '
      +   'onchange="cambiarFechaDeLaFactura(this.value)" '
      +   'style="width:100%;padding:9px;border:1px solid #90CAF9;border-radius:8px;font-size:14px;font-weight:700;background:#fff">'
      + '<div style="font-size:10.5px;color:#1565C0;margin-top:3px">La le\u00ed del PDF. Si est\u00e1 mal, c\u00e1mbiala aqu\u00ed.</div>'
      + '</div>';
  } else {
    html += '<div style="background:#FFF8E1;border:1px solid #FFD54F;border-radius:9px;padding:9px;margin-bottom:10px;font-size:12px;color:#7A5C00">'
      + '\ud83d\udcc5 No encontr\u00e9 la fecha en este PDF. Qued\u00f3 puesta la de <b>hoy</b> \u2014 c\u00e1mbiala abajo si la factura es de otro d\u00eda.</div>';
  }
  // La comprobacion en conjunto
  if(cuadraGlobal === true){
    html += '<div style="background:#E8F5E9;border:1px solid #A5D6A7;border-radius:9px;padding:9px;margin-bottom:10px;font-size:12.5px;color:#2E7D32;font-weight:800">'
      + '✓ Las cuentas cuadran con el Subtotal de la factura ($' + fmtNum(sub) + ')</div>';
  } else if(cuadraGlobal === false){
    html += '<div style="background:#FFF3E0;border:1px solid #FFB74D;border-radius:9px;padding:9px;margin-bottom:10px;font-size:12.5px;color:#E65100;font-weight:800">'
      + '⚠️ La suma de los renglones ($' + fmtNum(sumaTodo) + ') no coincide con el Subtotal de la factura ($' + fmtNum(sub) + ').<br>'
      + '<span style="font-weight:600">Puede faltar un renglón o sobrar alguno. Revísalos bien antes de agregar.</span></div>';
  } else {
    html += '<div style="background:#f5f5f5;border-radius:9px;padding:9px;margin-bottom:10px;font-size:12px;color:#666">'
      + 'No encontré el Subtotal impreso para comprobar la suma. Revisa los renglones uno por uno.</div>';
  }

  // Lista de productos para los desplegables
  // Ya no se arma la lista de 386 productos aqui: ahora hay un BUSCADOR -27 jul, pedido
  // de Sensei: "se despliega la lista completa y encontrar el producto correcto cuesta
  // mucho, pero si se pudiera escribir en la busqueda fuera muchisimo mas facil"-.

  // Los cargos que no son productos, para que Sensei los vea antes de confirmar
  var descsPdf = window._facturaDescuentos || [];
  if(descsPdf.length){
    html += '<div style="background:#FFEBEE;border:1px solid #EF9A9A;border-radius:9px;padding:9px;margin-bottom:10px;font-size:12.5px;color:#C62828;font-weight:700">'
      + '\ud83d\udcb8 Descuentos que encontré en la factura:'
      + descsPdf.map(function(d){
          return '<div style="margin-top:4px;display:flex;justify-content:space-between">'
               + '<span>' + String(d.desc||'').replace(/[<>&"]/g,'') + '</span>'
               + '<span>\u2212$' + fmtNum(d.monto) + '</span></div>';
        }).join('')
      + '<div style="font-size:11.5px;font-weight:600;margin-top:5px">Se restarán del total al agregar los renglones. Puedes corregirlos abajo.</div>'
      + '</div>';
  }

  var cargos = window._facturaCargos || { envio: 0, tarjeta: 0 };
  if(cargos.envio > 0 || cargos.tarjeta > 0){
    html += '<div style="background:#E3F2FD;border:1px solid #90CAF9;border-radius:9px;padding:9px;margin-bottom:10px;font-size:12.5px;color:#1565C0;font-weight:700">'
      + 'Además de los productos, la factura trae:'
      + (cargos.envio > 0   ? '<div style="margin-top:4px">🚚 Envío: <b>$' + fmtNum(cargos.envio) + '</b></div>' : '')
      + (cargos.tarjeta > 0 ? '<div style="margin-top:4px">💳 Cargo por tarjeta: <b>$' + fmtNum(cargos.tarjeta) + '</b></div>' : '')
      + '<div style="font-size:11.5px;font-weight:600;margin-top:5px">Se pondrán en la compra al agregar los renglones.</div>'
      + '</div>';
  }

  items.forEach(function(it, i){
    var cuadraLinea = Math.abs(it.cant * it.costo - it.total) < 0.015;
    var fondo = it.marcado ? '#fff' : '#FAFAFA';
    var borde = cuadraLinea ? '#e0e0e0' : '#FFB74D';
    html += '<div style="border:1px solid ' + borde + ';border-radius:10px;padding:10px;margin-bottom:8px;background:' + fondo + (it.marcado ? '' : ';opacity:.55') + '">'
      + '<label style="display:flex;align-items:flex-start;gap:8px;cursor:pointer;margin-bottom:7px">'
      + '<input type="checkbox" ' + (it.marcado ? 'checked' : '') + ' onchange="marcarLineaFactura(' + i + ', this.checked)" style="width:19px;height:19px;flex-shrink:0;margin-top:2px;cursor:pointer">'
      + '<span style="flex:1;font-size:12.5px;font-weight:700;color:#333;line-height:1.3">' + escaparHtml(it.descripcion) + '</span>'
      + '</label>';

    var etiqueta = it.comoLoSupo === 'aprendido'
      ? '<span style="font-size:10.5px;color:#2E7D32;font-weight:800"> · ya lo sabía</span>' : '';
    // Boton que abre el BUSCADOR, en vez de una lista de 386 para desplazar
    var elegido = null;
    if(it.pid) elegido = productos.find(function(p){ return String(p.id) === String(it.pid); });
    var textoBoton = elegido ? escaparHtml(elegido.nombre)
                   : (it.esNuevo ? '➕ ' + escaparHtml(it.nombreNuevo || 'Producto nuevo')
                                   + (it.precioVentaNuevo ? ' · venta $' + fmtNum(it.precioVentaNuevo) : ' · SIN precio de venta')
                                 : '⚠️ Escoge el producto');
    var colorBorde = (elegido || it.esNuevo) ? '#c8e6c9' : '#FFCC80';
    var colorTexto = (elegido || it.esNuevo) ? '#1a237e' : '#E65100';
    html += '<div style="font-size:10.5px;color:#999;font-weight:800;margin-bottom:3px">TU PRODUCTO' + etiqueta + '</div>'
      + '<button onclick="abrirBuscadorProducto(' + i + ')" style="width:100%;display:flex;align-items:center;gap:8px;text-align:left;padding:10px;border:2px solid ' + colorBorde + ';border-radius:8px;font-size:12.5px;font-weight:700;margin-bottom:8px;background:#fff;color:' + colorTexto + ';cursor:pointer">'
      + '<span style="flex:1;line-height:1.3">' + textoBoton + '</span>'
      + '<span style="flex-shrink:0;font-size:17px">🔍</span>'
      + '</button>';

    html += '<div style="display:flex;gap:6px;align-items:center">'
      + '<div style="flex:1"><div style="font-size:10px;color:#999;font-weight:700">CANTIDAD</div>'
      + '<input type="number" inputmode="numeric" value="' + it.cant + '" onchange="cambiarNumeroFactura(' + i + ',\'cant\',this.value)" style="width:100%;padding:7px;border:1px solid #ddd;border-radius:7px;font-size:13.5px;font-weight:700"></div>'
      + '<div style="flex:1"><div style="font-size:10px;color:#999;font-weight:700">COSTO</div>'
      // 🔑 MODO CALCULADORA + DECIMALES DE VERDAD -19 ago, lo pidio Sensei-. Antes era un
      // type="number" con step 0.01: ni ponia el punto solo ni dejaba escribir 4.4589. Ahora
      // se comporta igual que los demas campos de costo de la app: escribes 400 y queda 4.00,
      // y si escribes el punto tu mismo se respeta hasta 4 decimales.
      + '<input type="text" inputmode="decimal" value="' + costoBonito(it.costo) + '"'
      + ' onfocus="this.select();this.dataset.modoPreciso=\'\'"'
      + ' oninput="formatoCostoPreciso(this, event)"'
      + ' onblur="finalizarCostoPreciso(this);cambiarNumeroFactura(' + i + ',\'costo\',this.value)"'
      + ' style="width:100%;padding:7px;border:1px solid #ddd;border-radius:7px;font-size:13.5px;font-weight:700"></div>'
      + '<div style="flex:1"><div style="font-size:10px;color:#999;font-weight:700">TOTAL</div>'
      + '<div style="padding:7px;font-size:13.5px;font-weight:900;color:' + (cuadraLinea ? '#2E7D32' : '#E65100') + '">'
      + (cuadraLinea ? '✓ ' : '⚠️ ') + '$' + fmtNum(it.cant * it.costo) + '</div></div>'
      + '</div>';

    if(!cuadraLinea){
      html += '<div style="font-size:11px;color:#E65100;margin-top:5px;font-weight:700">La factura dice $' + fmtNum(it.total) + ' en este renglón. Revisa la cantidad y el costo.</div>';
    }
    html += '</div>';
  });

  var marcadas = items.filter(function(it){ return it.marcado; }).length;
  html += '<div style="position:sticky;bottom:0;background:#fff;padding-top:10px;border-top:2px solid #eee;margin-top:6px">'
    + '<div style="text-align:center;font-size:13px;color:#666;margin-bottom:8px">Vas a agregar <b>' + marcadas + '</b> renglones · <b>$' + fmtNum(suma) + '</b></div>'
    + '<div style="display:flex;gap:8px">'
    + '<button onclick="agregarFacturaALaCompra()" style="flex:2;padding:13px;border:none;border-radius:10px;background:#2E7D32;color:#fff;font-weight:800;font-size:13.5px;cursor:pointer">Agregar las marcadas</button>'
    + '<button onclick="cerrarRevisionFactura()" style="flex:1;padding:13px;border:2px solid #999;border-radius:10px;background:#fff;color:#666;font-weight:700;cursor:pointer">Cancelar</button>'
    + '</div></div>';

  var ov = document.getElementById('factura-ov');
  if(!ov){
    ov = document.createElement('div');
    ov.id = 'factura-ov';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:99994;display:flex;align-items:center;justify-content:center;padding:14px';
    document.body.appendChild(ov);
  }
  ov.innerHTML = '<div style="background:#fff;border-radius:16px;padding:16px;max-width:460px;width:100%;max-height:88vh;overflow-y:auto">' + html + '</div>';
  ov.style.display = 'flex';
}

// ── EL BUSCADOR DE PRODUCTOS (27 jul) ──
// Sensei tiene 386 productos. Desplazar una lista de 386 en el telefono para encontrar
// uno era lo que mas tiempo le quitaba al meter una factura. Ahora escribe 3 letras.
var _buscadorLinea = null;

function pintarResultadosBuscador(){
  var cont = document.getElementById('buscar-prod-lista');
  if(!cont) return;
  loadProds();
  var it = (window._facturaItems || [])[_buscadorLinea] || { descripcion: '' };
  var texto = (document.getElementById('buscar-prod-txt') || {}).value || '';
  var palabras = normTextoFactura(texto).split(' ').filter(function(w){ return w; });

  var lista, conEstrella = {};
  if(!palabras.length){
    // Sin escribir nada: primero las que mas se parecen a lo que dice la factura
    var sug = sugerenciasPara(it.descripcion, 6);
    sug.forEach(function(p){ conEstrella[String(p.id)] = true; });
    var resto = productos.filter(function(p){ return !conEstrella[String(p.id)]; });
    lista = sug.concat(resto);
  } else {
    // TODAS las palabras tienen que estar, en cualquier orden: "olive 5" encuentra
    // "ECO OLIVE OIL 5 LBS"
    lista = productos.filter(function(p){
      var np = normTextoFactura((p.nombre || '') + ' ' + (p.marca || '') + ' ' + (p.sku || ''));
      for(var k = 0; k < palabras.length; k++){ if(np.indexOf(palabras[k]) < 0) return false; }
      return true;
    });
    var sug2 = sugerenciasPara(it.descripcion, 6);
    sug2.forEach(function(p){ conEstrella[String(p.id)] = true; });
    lista.sort(function(a, b){
      var ea = conEstrella[String(a.id)] ? 0 : 1, eb = conEstrella[String(b.id)] ? 0 : 1;
      return ea - eb;
    });
  }

  if(!lista.length){
    cont.innerHTML = '<div style="text-align:center;padding:30px 14px;color:#999;font-size:13.5px">'
      + 'No hay ningún producto con esas palabras.<br><br>Prueba con menos letras, o usa<br>"➕ Es un producto nuevo" de abajo.</div>';
    return;
  }

  var html = '';
  lista.slice(0, 120).forEach(function(p){
    var estrella = conEstrella[String(p.id)] ? '<span style="color:#F9A825">⭐ </span>' : '';
    var costo = (typeof p.costo === 'number' && p.costo > 0) ? ' · $' + fmtNum(p.costo) : '';
    html += '<button onclick="escogerProductoBuscador(\'' + p.id + '\')" style="width:100%;text-align:left;padding:11px;border:none;border-bottom:1px solid #eee;background:#fff;cursor:pointer">'
      + '<div style="font-size:13.5px;font-weight:700;color:#1a237e;line-height:1.3">' + estrella + escaparHtml(p.nombre) + '</div>'
      + '<div style="font-size:11.5px;color:#888;margin-top:2px">' + escaparHtml(p.marca || 'Sin marca') + costo + '</div>'
      + '</button>';
  });
  if(lista.length > 120){
    html += '<div style="text-align:center;padding:14px;color:#999;font-size:12px">y ' + (lista.length - 120) + ' más — escribe algo para achicar la lista</div>';
  }
  cont.innerHTML = html;
}

function pnCambioCat(){
  var sel = document.getElementById('pn-cat-sel');
  var otra = document.getElementById('pn-cat-otra');
  if(sel && otra) otra.style.display = (sel.value === '__otra__') ? 'block' : 'none';
}
function cambiarNumeroFactura(i, campo, val){
  var it = window._facturaItems && window._facturaItems[i];
  if(!it) return;
  var v = dinero(val);
  it[campo] = campo === 'cant' ? Math.round(v) : v;
  pintarRevisionFactura();
}
function cerrarRevisionFactura(){
  var ov = document.getElementById('factura-ov');
  if(ov) ov.remove();
  mostrarBotonVolverFactura();
}

// Enseña el boton de "volver a la factura" si quedo una a medias. Los renglones viven en
// window._facturaItems, asi que Sensei puede irse al catalogo, arreglar lo que necesite y
// volver justo donde iba -28 jul-.
function mostrarBotonVolverFactura(){
  var b = document.getElementById('cc-volver-factura');
  if(!b) return;
  var hay = window._facturaItems && window._facturaItems.length;
  b.style.display = hay ? 'block' : 'none';
  if(hay){
    var marcadas = window._facturaItems.filter(function(x){ return x.marcado; }).length;
    b.textContent = '📄 Volver a la factura (' + marcadas + ' renglones marcados)';
  }
}

function volverALaFactura(){
  if(!(window._facturaItems && window._facturaItems.length)){
    avisoGrande('No hay ninguna factura a medias.');
    mostrarBotonVolverFactura();
    return;
  }
  ir('p-comp');
  setTimeout(pintarRevisionFactura, 100);
}

function tramosParaMaps(paradas){
  var tramos = [], i = 0;
  while(i < paradas.length){
    var fin = Math.min(i + MAX_PARADAS_MAPS, paradas.length);
    tramos.push({ origen: (i === 0 ? null : paradas[i-1]), lista: paradas.slice(i, fin) });
    i = fin;
  }
  return tramos;
}

// Arma el enlace de Google Maps. Si no se le da origen, Maps arranca desde
// DONDE ESTE Sensei en ese momento -que es lo que queremos en el primer tramo-.
function direccionesDelDia(diaKey){
  var rutasPorDia = LS('rutas_por_dia', {});
  var rutaHoy = rutasPorDia[diaKey] || [];
  if(!rutaHoy.length){
    avisoGrande('No hay barberías en la ruta de ese día.');
    return null;
  }
  var faltan = [], dirs = [];
  rutaHoy.forEach(function(neg){
    var d = direccionDeBarberia(neg);
    if(d) dirs.push(d); else faltan.push(neg);
  });
  if(faltan.length){
    avisoGrande('⚠️ Estas barberías no tienen dirección guardada, así que no se pueden poner en el mapa:\n\n'
      + faltan.map(function(n){ return '• ' + n; }).join('\n')
      + '\n\nAgrégales la dirección en el perfil de un cliente de esa barbería.');
    return null;
  }
  return dirs;
}

// Botón "Navegar toda la ruta"
function menuNavegarParada(negocio){
  var dir = direccionDeBarberia(negocio);
  mostrarMenuOpcionesFoto([
    ['🗺️ Google Maps', function(){ navegarANegocio(negocio); }],
    ['🚗 Waze', function(){
      if(!dir){
        avisoGrande('⚠️ "' + negocio + '" no tiene dirección guardada.\n\nAgrégasela en el perfil de un cliente de esa barbería.');
        return;
      }
      // Waze solo admite UN destino. Con q= busca la direccion y arranca a navegar.
      window.open('https://waze.com/ul?q=' + encodeURIComponent(dir) + '&navigate=yes', '_blank');
    }]
  ]);
}

// ═══ OPTIMIZAR RUTA CON TRÁFICO EN TIEMPO REAL ═══
// (25 jul: primera versión. 26 jul: REHECHA porque no funcionaba.)
//
// POR QUÉ SE REHIZO: la primera versión llamaba al SERVICIO WEB de Google
// -maps.googleapis.com/maps/api/directions/json- con fetch() desde el navegador.
// Ese servicio NO manda la cabecera Access-Control-Allow-Origin, así que el
// navegador BLOQUEA la llamada SIEMPRE (CORS). No fallaba a veces: no podía
// funcionar nunca desde una página web. Ahora se usa la librería de JavaScript de
// Google -DirectionsService-, que sí está hecha para correr dentro de una página
// y funciona con la clave restringida por HTTP referrer (nbs2.pages.dev).
//
// REQUISITO EN GOOGLE CLOUD: proyecto "nbs-rutas" con "Maps JavaScript API"
// habilitada, además de Directions API.
//
// ⚠️ LÍMITE DOCUMENTADO DE GOOGLE: duration_in_traffic -los minutos con tráfico
// real- NO viene cuando la petición lleva paradas intermedias. Por eso se hace en
// DOS PASOS: (1) una llamada con todas las paradas para que Google devuelva el
// ORDEN óptimo, y (2) una llamada por cada tramo suelto -A→B, sin paradas en
// medio- para sacar los minutos CON tráfico de verdad. Los tramos se piden todos
// a la vez -en paralelo- para que no se sienta lento en la ruta.

var GOOGLE_MAPS_API_KEY = 'AIzaSyDUQgiuZAvXWuhTC0By_liXlvbYbP3JjQQ';

var _gmapsPromesa = null;

// Se pone en true si Sensei cancela la busqueda -con la X, el boton Cancelar, o
// el boton atras del celular-. Si esta en true, cuando Google conteste NO se le
// muestra nada: ya se salio de ahi a proposito -26 jul-.
var _rutaCancelada = false;

// Google llama a esta función él solo si rechaza la clave -restricción mal puesta,
// API sin habilitar, facturación apagada-. Sin esto el fallo sería mudo.
window.gm_authFailure = function(){
  _gmapsPromesa = null;
  cerrarCargandoRuta();
  avisoGrande('🔑 Google rechazó la clave de mapas.\n\nRevisa en Google Cloud Console, proyecto "nbs-rutas":\n\n• Que "Maps JavaScript API" esté habilitada\n• Que la restricción de la clave incluya  nbs2.pages.dev/*\n• Que la facturación esté activa\n\nTu ruta sigue funcionando normal — esto solo afecta el botón de optimizar.');
};

// Carga la librería de Google la PRIMERA vez que se toca el botón, no al abrir la
// app -así no la hace más lenta de arrancar-.
function cargarGoogleMaps(){
  if(window.google && window.google.maps && window.google.maps.DirectionsService){
    return Promise.resolve();
  }
  if(_gmapsPromesa) return _gmapsPromesa;
  _gmapsPromesa = new Promise(function(resolve, reject){
    var listo = false;
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://maps.googleapis.com/maps/api/js?key=' + encodeURIComponent(GOOGLE_MAPS_API_KEY) + '&language=es&region=US';
    s.onload = function(){
      if(window.google && window.google.maps && window.google.maps.DirectionsService){
        listo = true; resolve();
      } else {
        _gmapsPromesa = null; reject(new Error('SIN_LIBRERIA'));
      }
    };
    s.onerror = function(){ _gmapsPromesa = null; reject(new Error('SIN_RED')); };
    setTimeout(function(){
      if(!listo){ _gmapsPromesa = null; reject(new Error('TARDO')); }
    }, 20000);
    document.head.appendChild(s);
  });
  return _gmapsPromesa;
}

// Traduce los códigos de Google a español claro. Nunca más un "revisa tu internet"
// a ciegas cuando el problema es otro.
function direccionDeBarberia(negocio){
  clientes = LS('ncl', []);
  var c = clientes.find(function(x){ return (x.negocio||'').trim() === negocio; });
  if(!c || !c.dir) return null;
  return c.dir + (c.ciudad ? ', '+c.ciudad : '') + (c.estado ? ', '+c.estado : '');
}

// Envuelve la llamada de Google en una promesa, para poder encadenarla
function ubicacionActual(){
  return new Promise(function(resolve, reject){
    if(!navigator.geolocation){ reject(new Error('SIN_UBICACION')); return; }
    navigator.geolocation.getCurrentPosition(
      function(pos){ resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }); },
      function(){ reject(new Error('SIN_UBICACION')); },
      { enableHighAccuracy:true, timeout:15000, maximumAge:60000 }
    );
  });
}

// PASO 2: minutos CON tráfico real, tramo por tramo -sin paradas intermedias, que
// es la única forma en que Google devuelve duration_in_traffic-. Todos a la vez.
function minutosConTrafico(puntos){
  var ahora = new Date();
  var tramos = [];
  for(var i=0; i<puntos.length-1; i++){
    tramos.push(pedirRutaGoogle({
      origin: puntos[i],
      destination: puntos[i+1],
      travelMode: google.maps.TravelMode.DRIVING,
      drivingOptions: { departureTime: ahora, trafficModel: 'bestguess' }
    }));
  }
  return Promise.all(tramos).then(function(resultados){
    var seg = 0, conTrafico = true;
    resultados.forEach(function(r){
      var leg = r.routes[0].legs[0];
      if(leg.duration_in_traffic) seg += leg.duration_in_traffic.value;
      else { conTrafico = false; seg += leg.duration.value; }
    });
    return { minutos: Math.round(seg/60), conTrafico: conTrafico };
  });
}

function aplicarOrdenSugerido(diaKey){
  var rutasPorDia = LS('rutas_por_dia', {});
  rutasPorDia[diaKey] = window._ordenSugeridoTemp;
  SS('rutas_por_dia', rutasPorDia);
  cerrarComparacionRuta();
  renderRutaDia(diaKey);
  avisoGrande('✓ Orden actualizado con el tráfico de ahora.');
}

function agregarADia(diaKey, neg){
  var rutasPorDia = LS('rutas_por_dia',{});
  if(!rutasPorDia[diaKey]) rutasPorDia[diaKey] = [];
  if(rutasPorDia[diaKey].indexOf(neg) < 0) rutasPorDia[diaKey].push(neg);
  SS('rutas_por_dia', rutasPorDia);
  renderRutaDia(diaKey);
}

function quitarDeDia(diaKey, neg){
  var rutasPorDia = LS('rutas_por_dia',{});
  if(!rutasPorDia[diaKey]) return;
  rutasPorDia[diaKey] = rutasPorDia[diaKey].filter(function(b){ return b !== neg; });
  SS('rutas_por_dia', rutasPorDia);
  renderRutaDia(diaKey);
}

// ═══════════════════════════════════════════════════════════════
//  HORA DE LAS VISITAS  (pedido por Sensei el 23 jul 2026)
//  Antes solo se guardaba el NOMBRE de la barberia visitada. Ahora se guarda
//  tambien la HORA, para poder ver la ruta en el orden real del dia.
//  Formato viejo: ["MODERN CUTS", "RD BARBERSHOP"]        (solo nombres)
//  Formato nuevo: [{n:"MODERN CUTS", h:"01:18 PM"}, ...]  (nombre + hora)
//  Se aceptan LOS DOS, para no perder lo que ya estaba marcado.
// ═══════════════════════════════════════════════════════════════

function normNegocio(x){
  return String(x || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')   // quita acentos
    .replace(/\s+/g, ' ')                               // dobles espacios -> uno
    .trim()
    .toUpperCase();
}

function mismoNegocio(a, b){
  var na = normNegocio(a);
  return na !== '' && na === normNegocio(b);
}

// Busca una barberia dentro de una lista sin que un espacio lo rompa. Devuelve la posicion.
function posEnLista(lista, neg){
  for(var i = 0; i < (lista || []).length; i++){
    if(mismoNegocio(lista[i], neg)) return i;
  }
  return -1;
}

function horaAhora12(){
  var d = new Date(), hh = d.getHours(), mm = d.getMinutes();
  var ampm = hh >= 12 ? 'PM' : 'AM';
  var h12 = hh % 12; if(h12 === 0) h12 = 12;
  return (h12 < 10 ? '0' : '') + h12 + ':' + (mm < 10 ? '0' : '') + mm + ' ' + ampm;
}

// Cambiar a mano la hora de una visita (a veces se le olvida marcarla al momento)
function avisarSiNoAlcanza(items){
  try {
    loadProds();
    var flojos = [];
    (items || []).forEach(function(it){
      if(!it.pid) return;
      var p = productos.find(function(x){ return String(x.id) === String(it.pid); });
      if(!p) return;
      var hay = parseFloat(p.stock) || 0;
      var pide = parseFloat(it.cant) || 0;
      if(pide > hay) flojos.push({ nombre: p.nombre, hay: hay, pide: pide });
    });
    if(!flojos.length) return true;
    var msg = '\u26a0\ufe0f OJO CON EL INVENTARIO\n\n';
    flojos.forEach(function(f){
      msg += '\u00b7 ' + String(f.nombre).slice(0, 34) + '\n'
           + '   te quedan ' + f.hay + ' y est\u00e1s vendiendo ' + f.pide + '\n';
    });
    msg += '\n\u00bfVender de todos modos?\n(Si lo tienes y no lo hab\u00edas apuntado, dale que s\u00ed)';
    return confirm(msg);
  } catch(e){ return true; }   // si algo falla, NUNCA se traba la venta
}

// ── 4️⃣ EL BACKUP: SOLO SI LLEVA MÁS DE 7 DÍAS SIN BAJAR UNO ──
//
// ⚠️ SENSEI YA TENÍA UN AVISO Y ESTE ESTABA DE MÁS. El de siempre es la barra de
// color de arriba (`mostrarAvisoRespaldo`), que aparece cada 30 minutos o cada X
// facturas y se pone naranja y roja según pasa el tiempo. ESE es el bueno: le avisa
// MIENTRAS TRABAJA, que es cuando importa.
//
// Él escogió dejar los dos, pero que este solo salga si de verdad lleva MÁS DE UNA
// SEMANA sin bajar un backup — así casi nunca lo ve, y cuando lo vea será porque el
// riesgo es serio. -14 ago-
var DIAS_SIN_BACKUP_PARA_AVISAR = 7;

function correrAutomatismos(){
  try { revisarRecordatorioBackup(); } catch(e){}
  try { revisarBarberiaSinMarcar(); } catch(e){}
  try { rellenoAutomaticoSemanal(); } catch(e){}
}

function cancelarRecordatorioBarberia(negocio){
  try{
    var lleg = LS(CLAVE_LLEGADAS, {});
    if(lleg[negocio]){ delete lleg[negocio]; SS(CLAVE_LLEGADAS, lleg); }
  }catch(e){}
  var caja = document.getElementById('recvis-caja');
  if(caja && caja.getAttribute('data-neg') === negocio) cerrarRecordatorioVisita();
}

// Revisa cada minuto si toca recordar alguna
function recvisPosponer(){
  var caja = document.getElementById('recvis-caja');
  var neg = caja ? caja.getAttribute('data-neg') : '';
  cerrarRecordatorioVisita();
  if(!neg) return;
  try{
    var lleg = LS(CLAVE_LLEGADAS, {});
    // Se corre el reloj: como si hubiera llegado hace (20 - 10) minutos
    lleg[neg] = Date.now() - ((MIN_PARA_RECORDAR - MIN_PARA_POSPONER) * 60000);
    SS(CLAVE_LLEGADAS, lleg);
  }catch(e){}
}

// El reloj corre mientras la app esta abierta
setInterval(revisarRecordatoriosVisita, 60000);
setTimeout(revisarRecordatoriosVisita, 8000);


// ═══════════════════════════════════════════════════════════════════
//  📍 APUNTAR LA VISITA EN LOS DOS SITIOS  (16 ago 2026)
//
//  🔑 SENSEI: "las barberías no están quedando marcadas como visitadas
//  automáticamente... y en el perfil del cliente hay una ficha que dice
//  visitas y no se ve ninguna visita hecha a ningún cliente; eso debería
//  ser automático también para que sea parte de su récord".
//
//  🔴 HABÍA DOS RÉCORDS QUE NUNCA SE HABLABAN:
//    · la RUTA guardaba en  visitas_<día>_<fecha>
//    · la FICHA leía de     nvisitas_barberos
//  Marcar en la ruta jamás llegaba a la ficha del cliente.
//
//  Ahora TODO pasa por aquí y se apunta en los dos.
// ═══════════════════════════════════════════════════════════════════
// 🚪 LOS TRES ESTADOS DE UNA VISITA (Sensei, 16 ago):
//    'compro'    → le compró
//    'noCompro'  → estaba, pero no quiso nada
//    'noEstaba'  → él fue, pero el barbero no estaba
//
// La visita cuenta SIEMPRE -él gastó el viaje-, pero el "no estaba" NO
// cuenta contra su porcentaje de compra: no es culpa suya no haber estado.
function cerrarFacturaEdit(){ var o=document.getElementById("fact-edit-overlay"); if(o) o.style.display="none"; }
function eliminarFacturaCancelada(vid){
  protegerConHuella(function(){
    ventas = LS('nv', []);
    var idx = ventas.findIndex(function(x){ return String(x.id)===String(vid); });
    if(idx === -1) return;
    var v = ventas[idx];
    if(!v.cancelada){ alert('Solo se pueden eliminar facturas que ya estén canceladas. Primero cancélala.'); return; }

    // Avisar si hay devoluciones vinculadas a esta factura, para no dejar registros huerfanos
    var devoluciones = LS('ndevoluciones', []);
    var devolucionesVinculadas = devoluciones.filter(function(d){ return String(d.ventaId)===String(vid); });
    var avisoDevoluciones = devolucionesVinculadas.length
      ? '\n\n⚠️ Esta factura tiene '+devolucionesVinculadas.length+' devolución(es) registrada(s) vinculada(s). Esos registros de devolución se van a quedar sin la factura original a la que pertenecían.'
      : '';

    if(!confirm('¿Eliminar por completo esta factura cancelada de $'+fmtNum(v.total)+' del '+v.fecha+'?\n\nEsto NO se puede deshacer -la factura desaparece por completo, no queda ningún registro de ella.'+avisoDevoluciones+'\n\n¿Continuar?')) return;
    if(prompt('Para confirmar, escribe la palabra ELIMINAR en mayúsculas:') !== 'ELIMINAR') { alert('No se escribió la palabra correcta. No se eliminó nada.'); return; }

    var cidCliente = v.cid;
    ventas.splice(idx, 1);
    SS('nv', ventas);
    alert('✅ Factura eliminada por completo.');
    cerrarFacturaView();
    if(cidCliente) verCl(cidCliente); else ir('p-cxc');
  });
}

function cancelarFacturaCompleta(vid){
  protegerConHuella(function(){
    ventas = LS('nv', []);
    var v = ventas.find(function(x){ return String(x.id)===String(vid); });
    if(!v) return;
    if(!confirm('¿Cancelar esta factura de $'+fmtNum(v.total)+' por completo?\n\nEl stock de todos los productos será restaurado.\nLa factura quedará marcada como CANCELADA -no se borra, para mantener el registro-.')) return;
    loadProds();
    v.cancelada = true;
    v.fechaCancelacion = fechaHoy();
    (v.items || []).forEach(function(it){
      if(!it.pid) return;
      var p = productos.find(function(x){ return String(x.id)===String(it.pid); });
      if(p) p.stock = (p.stock||0) + it.cant;
    });
    SS('nv', ventas);
    SS('np', productos);
    alert('✅ Factura cancelada. El inventario ya fue restaurado.');
    cerrarFacturaView();
    renderFacturas('');
  });
}

function cerrarFacturaView(){ var o=document.getElementById("factura-view-overlay"); if(o) o.style.display="none"; }

function textoDelMotivo(id){
  for(var i = 0; i < MOTIVOS_DEVOLUCION.length; i++){
    if(MOTIVOS_DEVOLUCION[i].id === id) return MOTIVOS_DEVOLUCION[i].texto;
  }
  return id || '';
}

function cerrarDevolucion(){
  var overlay = document.getElementById('devolucion-overlay');
  if(overlay) overlay.style.display = 'none';
}

function abrirDevolucion(vid){
  window._cambioItems = [];
  ventas = LS('nv', []);
  clientes = LS('ncl', []);
  var v = ventas.find(function(x){ return String(x.id)===String(vid); });
  if(!v) return;
  var cl = clientes.find(function(c){ return String(c.id)===String(v.cid); });

  var overlay = document.getElementById('devolucion-overlay');
  if(!overlay){
    overlay = document.createElement('div');
    overlay.id = 'devolucion-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:white;z-index:999996;overflow-y:auto;padding:16px';
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
  titulo.innerHTML = '<div style="font-size:18px;font-weight:800;color:#E65100">↩️ Procesar Devolución</div>'
    +'<div style="font-size:13px;color:#aaa;margin-top:2px">'+escaparHtml(cl?nombreCl(cl):v.cn)+' · Factura '+(v.numFactura?'#'+v.numFactura+' · ':'')+v.fecha+'</div>';
  wrap.appendChild(titulo);

  var aviso = document.createElement('div');
  aviso.style.cssText = 'background:#E3F2FD;border-radius:10px;padding:10px;margin:12px 0;font-size:12px;color:#1565C0;line-height:1.5';
  aviso.innerHTML = '💡 La factura original NO se modifica -queda igual para tus reportes-. La devolución se registra por separado con la fecha de hoy, y el inventario se restaura automáticamente.';
  wrap.appendChild(aviso);

  var itemsWrap = document.createElement('div');
  itemsWrap.id = 'dev-items-wrap';
  (v.items || []).forEach(function(it, idx){
    var card = document.createElement('div');
    card.style.cssText = 'background:#FAFAFA;border-radius:10px;padding:12px;margin-bottom:8px;border:0.5px solid #eee';
    card.innerHTML = '<div style="font-size:14px;font-weight:700;margin-bottom:2px">'+escaparHtml(it.nombre)+'</div>'
      +'<div style="font-size:11px;color:#aaa;margin-bottom:8px">Vendidos: '+it.cant+' · Precio unidad: $'+fmtNum(it.precio)+'</div>'
      +'<label class="lbl" style="margin-bottom:2px">Cantidad a devolver</label>'
      +'<input class="inp" type="number" min="0" max="'+it.cant+'" value="0" id="dev-cant-'+idx+'" style="margin-bottom:0" oninput="calcularTotalDevolucion(\''+vid+'\')">';
    itemsWrap.appendChild(card);
  });
  wrap.appendChild(itemsWrap);

  var totalCard = document.createElement('div');
  totalCard.style.cssText = 'background:#FFF3E0;border-radius:10px;padding:14px;margin:12px 0;text-align:center';
  totalCard.innerHTML = '<div style="font-size:11px;color:#E65100;font-weight:700">VALOR DEVUELTO</div>'
    +'<div style="font-size:26px;font-weight:800;color:#E65100" id="dev-total-monto">$0.00</div>';
  wrap.appendChild(totalCard);

  // ===== Opcion de cambio por otro producto =====
  var cambioToggleWrap = document.createElement('div');
  cambioToggleWrap.style.cssText = 'background:#F3E5F5;border-radius:10px;padding:12px;margin-bottom:12px';
  cambioToggleWrap.innerHTML = '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;font-weight:700;color:#6A1B9A">'
    +'<input type="checkbox" id="dev-es-cambio" onchange="toggleCambioProducto(\''+vid+'\')" style="width:18px;height:18px">'
    +'🔁 Es un cambio por otro producto (no una devolución de dinero)</label>';
  wrap.appendChild(cambioToggleWrap);

  var cambioWrap = document.createElement('div');
  cambioWrap.id = 'dev-cambio-wrap';
  cambioWrap.style.cssText = 'display:none;margin-bottom:12px';
  cambioWrap.innerHTML = '<label class="lbl">Buscar el producto nuevo que se lleva el cliente</label>'
    +'<div class="busca-caja" style="border:2px solid var(--nbs-gold);margin-bottom:8px"><span style="font-size:16px;flex-shrink:0;opacity:0.75">🔍</span><input class="busca-fuerte" id="dev-cambio-buscar" type="text" placeholder="Escribe el nombre del producto..." autocomplete="off" oninput="buscarProductoParaCambio(\''+vid+'\')"></div>'
    +'<div id="dev-cambio-resultados" style="display:none;max-height:180px;overflow-y:auto;background:white;border:1px solid #ddd;border-radius:8px;margin-top:4px"></div>'
    +'<div id="dev-cambio-items"></div>';
  wrap.appendChild(cambioWrap);

  var diferenciaCard = document.createElement('div');
  diferenciaCard.id = 'dev-diferencia-card';
  diferenciaCard.style.cssText = 'display:none;background:#E3F2FD;border-radius:10px;padding:14px;margin-bottom:12px;text-align:center';
  wrap.appendChild(diferenciaCard);

  if(v.tipo === 'contado'){
    var avisoContado = document.createElement('div');
    avisoContado.id = 'dev-aviso-tipo';
    avisoContado.style.cssText = 'background:#FFEBEE;border-radius:10px;padding:10px;margin-bottom:12px;font-size:12px;color:#C62828';
    avisoContado.textContent = 'Esta factura ya estaba pagada de contado — recuerda entregarle este monto en efectivo o como corresponda al cliente.';
    wrap.appendChild(avisoContado);
  } else {
    var avisoCredito = document.createElement('div');
    avisoCredito.id = 'dev-aviso-tipo';
    avisoCredito.style.cssText = 'background:#E8F5E9;border-radius:10px;padding:10px;margin-bottom:12px;font-size:12px;color:#2E7D32';
    avisoCredito.textContent = 'Esta factura es a crédito — el monto devuelto se restará automáticamente de lo que el cliente debe.';
    wrap.appendChild(avisoCredito);
  }

  // ── EL MOTIVO, DE LISTA ── para poder contarlos despues y ver que te devuelven mas
  var motivoBox = document.createElement('div');
  motivoBox.innerHTML = '<label class="lbl">\ud83d\udcc5 \u00bfQu\u00e9 d\u00eda te lo devolvi\u00f3?</label>'
    + '<input class="inp" type="date" id="dev-fecha" style="margin-bottom:8px">'
    + '<label class="lbl">\u00bfPor qu\u00e9 lo devuelve?</label>'
    + '<select class="inp" id="dev-motivo" style="margin-bottom:8px">'
    +   MOTIVOS_DEVOLUCION.map(function(m){ return '<option value="'+m.id+'">'+m.texto+'</option>'; }).join('')
    + '</select>'
    + '<label class="lbl">Detalle (opcional)</label>'
    + '<input class="inp" id="dev-nota" type="text" placeholder="Lo que quieras apuntar de este caso">';
  wrap.appendChild(motivoBox);
  setTimeout(function(){ ponerHoyEnCampo('dev-fecha'); }, 0);   // 📅 -2 sep-

  // ── LA FOTO DE PRUEBA ── se reusa el mismo mecanismo de las fotos de gastos y compras
  var fotoBox = document.createElement('div');
  fotoBox.style.cssText = 'display:flex;align-items:center;gap:12px;margin-bottom:10px';
  fotoBox.innerHTML =
      '<div id="dev-foto-preview" onclick="abrirOpcionesFotoGasto(\'dev\')" '
    +   'style="width:64px;height:64px;border-radius:12px;flex-shrink:0;cursor:pointer;display:flex;'
    +   'align-items:center;justify-content:center;background:#F5F5F7;border:2px dashed #c9c9d2;font-size:24px">\ud83d\udcf7</div>'
    + '<div style="flex:1">'
    +   '<div style="font-size:13px;font-weight:700;color:var(--nbs-ink)">Foto de lo devuelto</div>'
    +   '<div style="font-size:11px;color:#888">Opcional, pero si hay discusi\u00f3n despu\u00e9s, la foto la resuelve</div>'
    + '</div>'
    + '<input type="hidden" id="dev-foto-data">'
    + '<input type="file" id="dev-foto-camara" accept="image/*" capture="environment" style="display:none" onchange="cargarFotoGasto(this,\'dev\')">'
    + '<input type="file" id="dev-foto-galeria" accept="image/*" style="display:none" onchange="cargarFotoGasto(this,\'dev\')">';
  wrap.appendChild(fotoBox);

  var contBotones = document.createElement('div');
  contBotones.style.cssText = 'display:flex;gap:10px;margin-top:8px';

  var btnCancelar = document.createElement('button');
  btnCancelar.textContent = '✕ Cancelar';
  btnCancelar.style.cssText = 'flex:1;padding:14px;background:#F0F0F2;color:#555;border:none;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer';
  btnCancelar.onclick = function(){ cerrarDevolucion(); };
  contBotones.appendChild(btnCancelar);

  var btnConfirmar = document.createElement('button');
  btnConfirmar.textContent = '✓ Confirmar devolución';
  btnConfirmar.style.cssText = 'flex:1.5;padding:14px;background:#E65100;color:white;border:none;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer';
  btnConfirmar.onclick = function(){ procesarDevolucion(vid); };
  contBotones.appendChild(btnConfirmar);

  wrap.appendChild(contBotones);

  overlay.innerHTML = '';
  overlay.appendChild(wrap);
  overlay.style.display = 'block'; overlay.scrollTop = 0;
}

function calcularTotalDevolucion(vid){
  ventas = LS('nv', []);
  var v = ventas.find(function(x){ return String(x.id)===String(vid); });
  if(!v) return;
  var total = 0;
  (v.items || []).forEach(function(it, idx){
    var el = document.getElementById('dev-cant-'+idx);
    var cant = el ? (parseInt(el.value)||0) : 0;
    if(cant > it.cant){ cant = it.cant; el.value = it.cant; }
    if(cant < 0){ cant = 0; el.value = 0; }
    total += cant * it.precio;
  });
  var elTotal = document.getElementById('dev-total-monto');
  if(elTotal) elTotal.textContent = '$'+fmtNum(total);
  actualizarDiferenciaCambio(vid, total);
}

function renderItemsCambio(vid){
  var el = document.getElementById('dev-cambio-items');
  var items = window._cambioItems || [];
  el.innerHTML = items.map(function(it, i){
    return '<div style="background:white;border-radius:8px;padding:10px;margin-top:6px;border:0.5px solid #eee">'
      +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">'
      +'<div style="font-size:13px;font-weight:600">'+escaparHtml(it.nombre)+'</div>'
      +'<button type="button" onclick="quitarItemCambio('+i+',\''+vid+'\')" style="background:var(--nbs-red-bg);color:var(--nbs-red-dark);border:none;border-radius:6px;padding:5px 9px;cursor:pointer;flex-shrink:0">✕</button>'
      +'</div>'
      +'<div style="display:flex;gap:8px">'
      +'<div style="flex:1"><label class="lbl" style="margin-bottom:2px">Cantidad</label><input class="inp" type="number" min="1" value="'+it.cant+'" style="margin-bottom:0;text-align:center" onchange="cambiarCantCambioItem('+i+',this.value,\''+vid+'\')"></div>'
      +'<div style="flex:1.4"><label class="lbl" style="margin-bottom:2px">Precio c/u (puedes ajustarlo)</label><input class="inp" type="text" inputmode="numeric" value="'+fmtNum(it.precio)+'" style="margin-bottom:0;text-align:center" onfocus="this.select()" oninput="formatoMoneda(this)" onchange="cambiarPrecioCambioItem('+i+',this.value,\''+vid+'\')"></div>'
      +'</div>'
      +'</div>';
  }).join('');
  var totalDev = parseFloat((document.getElementById('dev-total-monto').textContent||'$0').replace('$','').replace(',','')) || 0;
  actualizarDiferenciaCambio(vid, totalDev);
}

function cambiarCantCambioItem(i, val, vid){
  var n = parseInt(val)||1;
  if(n<1) n=1;
  window._cambioItems[i].cant = n;
  renderItemsCambio(vid);
}

function quitarItemCambio(i, vid){
  window._cambioItems.splice(i,1);
  renderItemsCambio(vid);
}

function actualizarDiferenciaCambio(vid, totalDevuelto){
  var checked = document.getElementById('dev-es-cambio') ? document.getElementById('dev-es-cambio').checked : false;
  var card = document.getElementById('dev-diferencia-card');
  if(!checked || !card) return;
  var items = window._cambioItems || [];
  var totalNuevo = items.reduce(function(s,it){ return s+(it.cant*it.precio); },0);
  var diferencia = totalNuevo - totalDevuelto;
  var texto, color;
  if(Math.abs(diferencia) < 0.005){
    texto = '✓ Cambio exacto — el cliente no debe ni le debes nada';
    color = '#2E7D32';
  } else if(diferencia > 0){
    texto = 'El cliente debe pagar <b>$'+fmtNum(diferencia)+'</b> más';
    color = '#C62828';
  } else {
    texto = 'Debes devolverle <b>$'+fmtNum(Math.abs(diferencia))+'</b> al cliente';
    color = '#E65100';
  }
  card.innerHTML = '<div style="font-size:11px;color:#1565C0;font-weight:700">PRODUCTO NUEVO: $'+fmtNum(totalNuevo)+' — DEVUELTO: $'+fmtNum(totalDevuelto)+'</div>'
    +'<div style="font-size:16px;font-weight:800;margin-top:4px;color:'+color+'">'+texto+'</div>';
}

// Le quita a una factura los productos devueltos y recalcula su total y su ganancia.
// Devuelve cuanto bajo el total. NO toca pagos ni credito: de eso se encarga quien llama.
// -9 ago 2026-
function ajustarFacturaPorDevolucion(v, itemsDevueltos, itemsNuevos){
  var antesTotal = parseFloat(v.total) || 0;

  (itemsDevueltos || []).forEach(function(dev){
    for(var i = 0; i < (v.items || []).length; i++){
      var it = v.items[i];
      var mismo = (dev.pid != null && it.pid != null)
        ? String(it.pid) === String(dev.pid)
        : String(it.nombre) === String(dev.nombre);
      if(!mismo) continue;
      if(Math.abs((parseFloat(it.precio)||0) - (parseFloat(dev.precio)||0)) > 0.005) continue;
      var queda = (parseFloat(it.cant) || 0) - (parseFloat(dev.cant) || 0);
      if(queda > 0.0001){ it.cant = queda; }
      else { v.items.splice(i, 1); }
      break;
    }
  });

  (itemsNuevos || []).forEach(function(nu){
    v.items.push({ pid: nu.pid || null, nombre: nu.nombre,
                   cant: parseFloat(nu.cant) || 0,
                   precio: parseFloat(nu.precio) || 0,
                   costo: parseFloat(nu.costo) || 0 });
  });

  var sub = subtotalDeVenta(v);
  var desc = descuentoDeVenta(v);
  if(desc > sub){ desc = sub; if(v.descuento) v.descuento.monto = desc; }
  v.total = Math.round((sub - desc) * 100) / 100;

  if(!(v.items || []).length){
    v.ganancia = 0;                       // factura vacía: no queda ninguna ganancia
  } else if(sePuedeCalcularGanancia(v)){
    v.ganancia = gananciaDeVenta(v);
  }

  v.ajustadaPorDevolucion = true;
  return Math.round((antesTotal - v.total) * 100) / 100;
}

function procesarDevolucion(vid){
  ventas = LS('nv', []);
  loadProds();
  var v = ventas.find(function(x){ return String(x.id)===String(vid); });
  if(!v) return;

  var esCambio = document.getElementById('dev-es-cambio') && document.getElementById('dev-es-cambio').checked;

  var itemsDevueltos = [];
  var totalDevuelto = 0;
  (v.items || []).forEach(function(it, idx){
    var el = document.getElementById('dev-cant-'+idx);
    var cant = el ? (parseInt(el.value)||0) : 0;
    if(cant > 0){
      itemsDevueltos.push({ nombre: it.nombre, cant: cant, precio: it.precio, costo: it.costo||0, pid: it.pid||null });
      totalDevuelto += cant * it.precio;
    }
  });

  if(!itemsDevueltos.length){ alert('Indica al menos una cantidad a devolver.'); return; }

  var itemsNuevos = esCambio ? (window._cambioItems||[]) : [];
  var totalNuevo = itemsNuevos.reduce(function(s,it){ return s+(it.cant*it.precio); },0);

  if(esCambio && !itemsNuevos.length){ alert('Agrega al menos un producto nuevo para el cambio, o desmarca la opción de cambio.'); return; }

  var diferencia = totalNuevo - totalDevuelto; // positivo: cliente debe pagar mas. negativo: hay que devolverle.

  var mensajeConfirmar = esCambio
    ? '¿Confirmar el cambio?\n\nDevuelve: $'+fmtNum(totalDevuelto)+'\nSe lleva: $'+fmtNum(totalNuevo)+'\n'+(diferencia>0.005?'Cliente debe pagar $'+fmtNum(diferencia)+' más.':diferencia<-0.005?'Debes devolverle $'+fmtNum(Math.abs(diferencia))+'.':'Cambio exacto, no debe nada.')
    : '¿Confirmar devolución por $'+fmtNum(totalDevuelto)+'?\n\nEsto restaurará el inventario y quedará registrado con la fecha de hoy.';
  if(!confirm(mensajeConfirmar)) return;

  // Restaurar inventario de lo devuelto
  itemsDevueltos.forEach(function(it){
    if(it.pid){
      var p = productos.find(function(x){ return String(x.id)===String(it.pid); });
      if(p) p.stock = (p.stock||0) + it.cant;
    }
  });
  // Descontar inventario de lo nuevo -si es un cambio-
  itemsNuevos.forEach(function(it){
    if(it.pid){
      var p = productos.find(function(x){ return String(x.id)===String(it.pid); });
      if(p) p.stock = (p.stock||0) - it.cant;
    }
  });
  SS('np', productos);

  var nota = limpiarTexto(document.getElementById('dev-nota').value.trim());
  // El motivo de lista y la foto de prueba. -28 ago-
  var _elMot = document.getElementById('dev-motivo');
  var motivo = _elMot ? _elMot.value : '';
  var _elFoto = document.getElementById('dev-foto-data');
  var fotoDev = _elFoto ? _elFoto.value : '';
  var fechaHoyStr = fechaDelCampo('dev-fecha');   // 📅 la que el escogio -2 sep-
  var horaHoyStr = new Date().toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',hour12:true});

  // Registrar en la bitacora de devoluciones/cambios -para el historial del cliente-
  var devoluciones = LS('ndevoluciones', []);
  devoluciones.push({
    id: Date.now(),
    ventaId: v.id,
    numFacturaOrigen: v.numFactura || null,
    cid: v.cid,
    cn: v.cn,
    fecha: fechaHoyStr,
    hora: horaHoyStr,
    items: itemsDevueltos,
    itemsNuevos: itemsNuevos,
    esCambio: esCambio,
    monto: totalDevuelto,
    montoNuevo: totalNuevo,
    diferencia: diferencia,
    nota: nota,
    motivo: motivo,                    // la clave, para poder contarlos
    motivoTexto: textoDelMotivo(motivo),
    foto: fotoDev || null,             // la prueba, si la tomo
    tipoFacturaOrigen: v.tipo
  });
  SS('ndevoluciones', devoluciones);

  // Calcular cuanto de lo devuelto se puede aplicar directamente al SALDO PENDIENTE de esta
  // factura especifica -si era a credito y todavia debia algo-, y cuanto queda como EXCEDENTE
  // -que se convierte en credito a favor del cliente, aplicable a cualquier factura futura-.
  // ═══ EL CAMBIO DE FONDO DEL 9 AGO 2026 ═══
  // ANTES se apuntaba un PAGO falso de lo devuelto. Sensei lo corrigio:
  // "no es un pago, es simplemente una devolucion de mercancia, porque no es dinero;
  //  en la devolucion no hay ganancia, lo que hay es un ajuste de inventario, no se
  //  puede contar como una venta".
  // AHORA se le quitan a la factura los productos devueltos y se recalcula su total y
  // su ganancia. Vendiste menos, punto. Y si el cliente ya habia pagado mas de lo que
  // queda, ese excedente se le deja como CREDITO A FAVOR.
  //
  // Esto ademas arregla una inconsistencia vieja: el pago falso lo contaban 39 sitios
  // como pago y 3 no -revisarIntegridad, calcularReporteClientes y pintarDetalleClientes-,
  // asi que el mismo cliente salia con DOS deudas distintas segun donde se mirara.
  // ⚠️ EN UNA VENTA AL CONTADO EL PAGO NO QUEDA EN LA LISTA: el cliente pago todo al
  // momento y la app lo cuenta por el tipo. Si no se toma en cuenta aqui, al devolver
  // mercancia de una venta al contado la app NO le apuntaria lo que hay que devolverle.
  // -9 ago, cazado antes de entregar-
  var pagadoAntes = (v.tipo === 'contado')
    ? (parseFloat(v.total) || 0)
    : (v.pagosFactura||[])
        .filter(function(p){ return typeof p.monto === 'number' && !p.esDevolucion; })
        .reduce(function(s,p){ return s + p.monto; }, 0);

  var bajoElTotal = ajustarFacturaPorDevolucion(v, itemsDevueltos, itemsNuevos);
  SS('nv', ventas);

  var excedenteComoCreditoAFavor = Math.max(0, Math.round((pagadoAntes - (parseFloat(v.total)||0)) * 100) / 100);
  var montoADevolverOAplicar = esCambio ? Math.max(0, -diferencia) : totalDevuelto;
  var mensajeFinal = '';

  if(excedenteComoCreditoAFavor > 0.005){
    clientes = LS('ncl', []);
    var clIdx = clientes.findIndex(function(c){ return String(c.id)===String(v.cid); });
    if(clIdx >= 0){
      clientes[clIdx].creditoAFavor = (clientes[clIdx].creditoAFavor||0) + excedenteComoCreditoAFavor;
      SS('ncl', clientes);
    }
    // Y se le quita a la factura lo que paso al credito, para que no quede "pagada de
    // mas" y la Revision de Integridad no la marque.
    // En contado no hay pagos que recortar: el total ya bajo y con eso basta.
    var restante = (v.tipo === 'contado') ? 0 : excedenteComoCreditoAFavor;
    for(var iP = (v.pagosFactura||[]).length - 1; iP >= 0 && restante > 0.005; iP--){
      var pg = v.pagosFactura[iP];
      if(typeof pg.monto !== 'number' || pg.esDevolucion) continue;
      var quita = Math.min(pg.monto, restante);
      pg.monto = Math.round((pg.monto - quita) * 100) / 100;
      restante = Math.round((restante - quita) * 100) / 100;
      if(pg.monto <= 0.005) v.pagosFactura.splice(iP, 1);
    }
    SS('nv', ventas);
  }

  if(!esCambio){
    if(v.tipo === 'credito' && excedenteComoCreditoAFavor <= 0.005){
      mensajeFinal = 'El balance pendiente de esta factura ya se redujo en $'+fmtNum(montoADevolverOAplicar)+'.';
    } else if(excedenteComoCreditoAFavor > 0.005){
      mensajeFinal = 'Como '+(v.tipo==='contado'?'la factura era de contado':'esta factura ya no debía tanto')+', se guardaron $'+fmtNum(excedenteComoCreditoAFavor)+' como CRÉDITO A FAVOR del cliente -se aplicará solo o parcial a su próxima compra-. Lo puedes ver en Cuentas por Cobrar o en su historial.';
    }
  } else {
    // Cambio de producto: se ajusta solo la diferencia de precio
    if(Math.abs(diferencia) < 0.005){
      mensajeFinal = 'Cambio exacto — no se debe nada de ningún lado.';
    } else if(diferencia < 0){
      if(v.tipo === 'credito' && excedenteComoCreditoAFavor <= 0.005){
        mensajeFinal = 'Se le restó $'+fmtNum(montoADevolverOAplicar)+' de lo que debía en esta factura.';
      } else {
        mensajeFinal = 'Se guardaron $'+fmtNum(excedenteComoCreditoAFavor)+' como CRÉDITO A FAVOR del cliente -se aplicará a su próxima compra-.';
      }
    } else {
      // El cliente debe pagar mas -el producto nuevo cuesta mas-. Si tiene credito a favor de antes, se aplica primero.
      clientes = LS('ncl', []);
      var clIdxDif = clientes.findIndex(function(c){ return String(c.id)===String(v.cid); });
      var creditoDisponible = (clIdxDif>=0 && clientes[clIdxDif].creditoAFavor) ? clientes[clIdxDif].creditoAFavor : 0;
      var aplicadoDeCredito = Math.min(creditoDisponible, diferencia);
      var faltantePorCobrar = diferencia - aplicadoDeCredito;

      if(aplicadoDeCredito > 0.005 && clIdxDif >= 0){
        clientes[clIdxDif].creditoAFavor = creditoDisponible - aplicadoDeCredito;
        SS('ncl', clientes);
      }

      if(faltantePorCobrar <= 0.005){
        mensajeFinal = 'La diferencia de $'+fmtNum(diferencia)+' se cubrió completa con el crédito a favor que ya tenía el cliente. No debe nada.';
      } else if(v.tipo === 'contado'){
        mensajeFinal = (aplicadoDeCredito>0.005 ? 'Se aplicaron $'+fmtNum(aplicadoDeCredito)+' de su crédito a favor. ' : '')+'Cobra $'+fmtNum(faltantePorCobrar)+' adicionales al cliente ahora mismo.';
      } else {
        ventas.push({
          id: Date.now()+1,
          numFactura: siguienteNumeroFactura(),
          cid: v.cid, cn: v.cn, tipo: 'credito',
          items: [{ nombre: 'Diferencia por cambio de producto (factura #'+(v.numFactura||'')+')', cant: 1, precio: faltantePorCobrar, costo: 0, pid: null }],
          subtotal: faltantePorCobrar, total: faltantePorCobrar, ganancia: faltantePorCobrar,
          fecha: fechaHoyStr, hora: horaHoyStr, pagosFactura: []
        });
        SS('nv', ventas);
        mensajeFinal = (aplicadoDeCredito>0.005 ? 'Se aplicaron $'+fmtNum(aplicadoDeCredito)+' de su crédito a favor. ' : '')+'Se creó una factura nueva #'+ventas[ventas.length-1].numFactura+' por los $'+fmtNum(faltantePorCobrar)+' restantes que el cliente debe.';
      }
    }
  }

  window._cambioItems = [];
  document.getElementById('devolucion-overlay').style.display = 'none';
  alert('✅ '+(esCambio?'Cambio':'Devolución')+' registrado.\n\nEl inventario ya fue ajustado.\n\n'+mensajeFinal);
  cerrarFacturaView();
}
function cerrarHistorial(){ var o=document.getElementById("historial-overlay"); if(o) o.style.display="none"; }

function deshacerDevolucion(devId){
  var devoluciones = LS('ndevoluciones', []);
  var idx = devoluciones.findIndex(function(d){ return String(d.id) === String(devId); });
  if(idx < 0){ alert('No se encontró esa devolución -puede que ya se haya deshecho-.'); return; }
  var d = devoluciones[idx];

  var resumenItems = (d.items || []).map(function(it){ return it.nombre+' x'+it.cant; }).join(', ');
  var resumenCambio = d.esCambio && d.itemsNuevos && d.itemsNuevos.length
    ? '\nProducto que se había entregado a cambio: '+d.itemsNuevos.map(function(it){ return it.nombre+' x'+it.cant; }).join(', ')
    : '';
  if(!confirm('¿Deshacer esta devolución del '+d.fecha+'?\n\nProducto(s) devuelto(s) en su momento: '+resumenItems+resumenCambio+'\nMonto: $'+fmtNum(d.monto)+'\n\nEsto va a: restaurar el inventario a como estaba antes de la devolución, y quitar el crédito o pago que se haya generado por ella.\n\n¿Continuar?')) return;

  loadProds();
  // Revertir el inventario: lo que se habia restaurado -por ser devuelto- se vuelve a descontar;
  // lo que se habia descontado -por ser el producto nuevo de un cambio- se vuelve a restaurar.
  (d.items || []).forEach(function(it){
    if(it.pid){
      var p = productos.find(function(x){ return String(x.id)===String(it.pid); });
      if(p) p.stock = Math.max(0, (p.stock||0) - it.cant);
    }
  });
  if(d.esCambio && d.itemsNuevos){
    d.itemsNuevos.forEach(function(it){
      if(it.pid){
        var p = productos.find(function(x){ return String(x.id)===String(it.pid); });
        if(p) p.stock = (p.stock||0) + it.cant;
      }
    });
  }
  SS('np', productos);

  // Revertir el dinero: primero buscar si esta devolucion dejo un pago -abono- en la factura de origen
  // ═══ DESHACER, CON LA REGLA NUEVA DEL 9 AGO 2026 ═══
  // Antes esto buscaba el PAGO falso que se apuntaba al devolver. Ya no existe: ahora
  // la devolucion AJUSTA LA FACTURA. Asi que deshacer tiene que devolver la factura a
  // como estaba — los productos, el total y la ganancia — y quitarle al cliente el
  // credito que se le habia dejado.
  ventas = LS('nv', []);
  var ventaOrigen = ventas.find(function(v){ return String(v.id)===String(d.ventaId); });
  var montoRevertidoDeFactura = 0;

  if(ventaOrigen){
    var totalAntesDeshacer = parseFloat(ventaOrigen.total) || 0;

    // 1) Devolver a la factura los productos que se habian devuelto
    (d.items || []).forEach(function(dev){
      var enc = null;
      for(var i2 = 0; i2 < (ventaOrigen.items || []).length; i2++){
        var it = ventaOrigen.items[i2];
        var mismo = (dev.pid != null && it.pid != null)
          ? String(it.pid) === String(dev.pid)
          : String(it.nombre) === String(dev.nombre);
        if(mismo && Math.abs((parseFloat(it.precio)||0) - (parseFloat(dev.precio)||0)) < 0.005){ enc = it; break; }
      }
      if(enc){ enc.cant = (parseFloat(enc.cant) || 0) + (parseFloat(dev.cant) || 0); }
      else {
        if(!ventaOrigen.items) ventaOrigen.items = [];
        ventaOrigen.items.push({ pid: dev.pid || null, nombre: dev.nombre,
                                 cant: parseFloat(dev.cant) || 0,
                                 precio: parseFloat(dev.precio) || 0,
                                 costo: parseFloat(dev.costo) || 0 });
      }
    });

    // 2) Y quitarle los que se habia llevado a cambio
    (d.itemsNuevos || []).forEach(function(nu){
      for(var i3 = 0; i3 < (ventaOrigen.items || []).length; i3++){
        var it = ventaOrigen.items[i3];
        var mismo = (nu.pid != null && it.pid != null)
          ? String(it.pid) === String(nu.pid)
          : String(it.nombre) === String(nu.nombre);
        if(!mismo) continue;
        var queda = (parseFloat(it.cant) || 0) - (parseFloat(nu.cant) || 0);
        if(queda > 0.0001) it.cant = queda; else ventaOrigen.items.splice(i3, 1);
        break;
      }
    });

    // 3) Recalcular total y ganancia con las formulas UNICAS
    var sub2 = subtotalDeVenta(ventaOrigen);
    var desc2 = descuentoDeVenta(ventaOrigen);
    if(desc2 > sub2){ desc2 = sub2; if(ventaOrigen.descuento) ventaOrigen.descuento.monto = desc2; }
    ventaOrigen.total = Math.round((sub2 - desc2) * 100) / 100;
    if(sePuedeCalcularGanancia(ventaOrigen)) ventaOrigen.ganancia = gananciaDeVenta(ventaOrigen);
    delete ventaOrigen.ajustadaPorDevolucion;
    SS('nv', ventas);

    montoRevertidoDeFactura = Math.round(((parseFloat(ventaOrigen.total)||0) - totalAntesDeshacer) * 100) / 100;
  }

  // 4) Quitarle al cliente el credito que se le habia dejado por esta devolucion
  var restante = Math.max(0, parseFloat(d.monto) || 0);
  var avisoCredito = '';
  var montoQuitadoDeCredito = 0;
  if(restante > 0.005){
    clientes = LS('ncl', []);
    var clIdx = clientes.findIndex(function(c){ return String(c.id)===String(d.cid); });
    if(clIdx >= 0){
      var creditoActual = clientes[clIdx].creditoAFavor || 0;
      var aQuitar = Math.min(creditoActual, restante);
      montoQuitadoDeCredito = aQuitar;
      clientes[clIdx].creditoAFavor = Math.max(0, creditoActual - aQuitar);
      SS('ncl', clientes);
    }
  }

  // Quitar el registro de la devolucion
  devoluciones.splice(idx, 1);
  SS('ndevoluciones', devoluciones);

  alert('✅ Devolución deshecha.\n\nInventario restaurado a como estaba antes.'+(montoRevertidoDeFactura>0.005?'\nSe quitó $'+fmtNum(montoRevertidoDeFactura)+' que se había aplicado a la factura.':'')+(montoQuitadoDeCredito>0.005?'\nSe quitó $'+fmtNum(montoQuitadoDeCredito)+' del crédito a favor del cliente.':'')+avisoCredito);

  var histOverlay = document.getElementById('historial-overlay');
  if(histOverlay && histOverlay.style.display !== 'none'){
    verHistorialCliente(d.cid, 'completo');
  }
}
