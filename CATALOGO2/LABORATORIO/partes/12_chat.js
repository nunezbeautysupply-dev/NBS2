// ═══════════════════════════════════════════════════════════════════
//  💬 NBS CHAT — EL LADO DE SENSEI  (18 sep 2026)
//
//  El lado del barbero ya está hecho (CHAT_index.html, carpeta /CHAT/).
//  Aquí va el lado de Sensei, DENTRO de NBS2:
//    · Lista de conversaciones, con los sin leer arriba y su 🔴
//    · Contestar en el hilo (él en verde, el barbero a la izquierda)
//    · Dar acceso: escoge el cliente y ÉL escribe la clave
//    · Ver los accesos: quitar / devolver sin borrar la conversación
//
//  🔑 Usa fbDb (la sesión de Sensei ya autenticada). El barbero entra por
//  su app APARTE ('nbschat') — así nadie le pisa la huella a Sensei.
//  🔒 CANDADO (19 sep): cada conversación vive DENTRO de su clave:
//  nbs_chat_accesos/{CLAVE}/mensajes. La clave es la llave — sin la clave
//  exacta, Firebase no deja ver NADA, ni pedir la lista de claves.
//  NADA de esto toca dinero, ventas ni clientes: solo lee y escribe chat.
// ═══════════════════════════════════════════════════════════════════

function _bdChat(){
  try { return (typeof window !== 'undefined' && window.fbDb) ? window.fbDb : null; }
  catch(e){ return null; }
}

// El buzón de mensajes que vive dentro de una clave
function _buzonDeClave(clave){
  var bd = _bdChat();
  return bd ? bd.collection('nbs_chat_accesos').doc(clave).collection('mensajes') : null;
}

// ── EL GLOBITO ROJO DEL INICIO ──
// Lo llama _mirarElBuzon: al abrir, cada 2 minutos y al volver a la app.
function revisarChatSinLeer(){
  var bd = _bdChat();
  if(!bd) return;
  try {
    bd.collection('nbs_chat_accesos').get().then(function(snap){
      var accesos = [];
      snap.forEach(function(d){ var a = d.data() || {}; a.clave = d.id; accesos.push(a); });
      window._chatAccesos = accesos;
      // Un vistazo al buzón de cada clave. Son 10-15 claves: liviano.
      // (deNBS+leido son dos filtros de igualdad: Firebase los sirve sin índice extra.)
      return Promise.all(accesos.map(function(a){
        return _buzonDeClave(a.clave)
          .where('deNBS', '==', false).where('leido', '==', false).get()
          .then(function(s){ return s.size || 0; })
          .catch(function(){ return 0; });
      }));
    }).then(function(cuentas){
      var n = (cuentas || []).reduce(function(s, x){ return s + x; }, 0);
      window._chatSinLeer = n;
      pintarGloboChatNBS(n);
    }).catch(function(e){ console.warn('chat: no pude contar los sin leer:', e); });
  } catch(e){ console.warn('chat: no pude revisar:', e); }
}

function pintarGloboChatNBS(n){
  var g = document.getElementById('chatnbs-globo');
  if(!g) return;
  if(n > 0){
    g.textContent = n > 99 ? '99+' : String(n);
    g.style.display = 'inline-flex';
  } else {
    g.style.display = 'none';
  }
}

// ── LA PANTALLA — un solo recuadro que cambia de vista ──
function _cajaChatNBS(){
  var o = document.getElementById('chatnbs-overlay');
  if(!o){
    o = document.createElement('div');
    o.id = 'chatnbs-overlay';
    document.body.appendChild(o);
  }
  o.style.cssText = 'position:fixed;inset:0;background:#fff;z-index:99998;overflow-y:auto;padding:10px 12px;display:block';
  return o;
}

function abrirChatNBS(){
  var o = _cajaChatNBS();
  o.scrollTop = 0;
  var bd = _bdChat();
  if(!bd){
    o.innerHTML = '<div style="max-width:480px;margin:0 auto">'
      + '<button onclick="cerrarChatNBS()" style="width:100%;background:#E8EAF6;border:none;border-radius:8px;padding:11px;font-size:14px;font-weight:700;color:#1a237e;cursor:pointer;margin-bottom:12px">← Volver</button>'
      + '<div style="background:#FFF3E0;border:1px solid #FFE0B2;border-radius:10px;padding:12px;font-size:14px;color:#E65100;font-weight:600;text-align:center">📡 El chat necesita internet.<br>La nube todavía no responde — prueba en unos segundos.</div>'
      + '</div>';
    return;
  }
  cargarListaChatNBS();
}

function cerrarChatNBS(){
  pararEscuchaChatNBS();
  var o = document.getElementById('chatnbs-overlay');
  if(o) o.style.display = 'none';
}

function pararEscuchaChatNBS(){
  if(window._chatEscucha){
    try { window._chatEscucha(); } catch(e){}
    window._chatEscucha = null;
  }
}

// ── LA LISTA DE CONVERSACIONES ──
function cargarListaChatNBS(){
  var bd = _bdChat();
  var o = _cajaChatNBS();
  pararEscuchaChatNBS();
  o.innerHTML = '<div style="max-width:480px;margin:0 auto">'
    + '<div style="text-align:center;color:#888;font-size:13px;padding:24px 0">Cargando el chat…</div></div>';
  // Primero los accesos; luego, al buzón de cada clave se le piden dos cosas
  // en paralelo: su último mensaje y sus sin leer. 10-15 claves: liviano.
  bd.collection('nbs_chat_accesos').get().then(function(snap){
    var accesos = [];
    snap.forEach(function(d){ var a = d.data() || {}; a.clave = d.id; accesos.push(a); });
    return Promise.all(accesos.map(function(a){
      var buzon = _buzonDeClave(a.clave);
      return Promise.all([
        buzon.orderBy('cuando', 'desc').limit(1).get()
          .then(function(s){ var u = null; s.forEach(function(d){ u = d.data(); }); return u; })
          .catch(function(){ return null; }),
        buzon.where('deNBS', '==', false).where('leido', '==', false).get()
          .then(function(s){ return s.size || 0; })
          .catch(function(){ return 0; })
      ]).then(function(par){ return { clave: a.clave, ultimo: par[0], sinLeer: par[1] }; });
    })).then(function(resumenes){
      var porClave = {};
      resumenes.forEach(function(r){ porClave[r.clave] = { ultimo: r.ultimo, sinLeer: r.sinLeer }; });
      pintarListaChatNBS(accesos, porClave);
    });
  }).catch(function(e){
    console.warn('chat: no pude cargar la lista:', e);
    o.innerHTML = '<div style="max-width:480px;margin:0 auto">'
      + '<button onclick="cerrarChatNBS()" style="width:100%;background:#E8EAF6;border:none;border-radius:8px;padding:11px;font-size:14px;font-weight:700;color:#1a237e;cursor:pointer;margin-bottom:12px">← Volver</button>'
      + '<div style="background:#FFEBEE;border:1px solid #FFCDD2;border-radius:10px;padding:12px;font-size:14px;color:#c62828;font-weight:600;text-align:center">No pude traer el chat.<br>Revisa el internet y toca de nuevo.</div>'
      + '<button onclick="cargarListaChatNBS()" style="width:100%;background:#1a237e;color:#fff;border:none;border-radius:8px;padding:11px;font-size:14px;font-weight:700;cursor:pointer;margin-top:10px">🔄 Probar otra vez</button>'
      + '</div>';
  });
}

function pintarListaChatNBS(accesos, porClave){
  var o = _cajaChatNBS();
  porClave = porClave || {};
  var filas = (accesos || []).map(function(a){
    var g = porClave[a.clave] || { ultimo: null, sinLeer: 0 };
    return { a: a, ultimo: g.ultimo, sinLeer: g.sinLeer,
             orden: g.ultimo ? (g.ultimo.cuando || 0) : (a.creado || 0) };
  });
  // Sin leer arriba; después, el más reciente primero
  filas.sort(function(x, y){
    if((y.sinLeer > 0) !== (x.sinLeer > 0)) return (y.sinLeer > 0) ? 1 : -1;
    return (y.orden || 0) - (x.orden || 0);
  });

  var totalSinLeer = 0;
  filas.forEach(function(f){ totalSinLeer += f.sinLeer; });
  window._chatSinLeer = totalSinLeer;
  pintarGloboChatNBS(totalSinLeer);
  window._chatAccesos = accesos || [];

  var h = '<div style="max-width:480px;margin:0 auto">'
    + '<div style="display:flex;gap:8px;margin-bottom:10px">'
    + '<button onclick="cerrarChatNBS()" style="flex:0 0 auto;background:#E8EAF6;border:none;border-radius:8px;padding:9px 14px;font-size:14px;font-weight:700;color:#1a237e;cursor:pointer">← Volver</button>'
    + '<div style="flex:1;display:flex;align-items:center;justify-content:center;background:linear-gradient(90deg,#4A148C,#6A1B9A);border-radius:8px;color:#fff;font-size:15px;font-weight:900;letter-spacing:.3px">💬 NBS CHAT</div>'
    + '</div>'
    + '<button onclick="abrirDarAccesoChat()" style="width:100%;background:linear-gradient(90deg,#D4A017,#c49212);color:#fff;border:none;border-radius:9px;padding:10px;font-size:14px;font-weight:800;cursor:pointer;margin-bottom:10px">➕ Dar acceso a un cliente</button>';

  if(!filas.length){
    h += '<div style="background:#F4F6FB;border-radius:10px;padding:16px;text-align:center;font-size:13.5px;color:#666">'
      + 'Todavía nadie tiene acceso al chat.<br>Toca <b>➕ Dar acceso</b>, escoge el cliente y escribe su clave.</div>';
  } else {
    filas.forEach(function(f){
      var a = f.a, u = f.ultimo;
      var quien = escaparHtml(a.nombre || '') + (a.barberia ? ' · ' + escaparHtml(a.barberia) : '');
      var vista = u
        ? (u.deNBS ? 'Tú: ' : '') + escaparHtml(String(u.texto || '').slice(0, 60))
        : 'Sin mensajes todavía';
      var hora = u ? horaCortita(u.cuando || 0) : '';
      var globo = f.sinLeer > 0
        ? '<span style="flex:0 0 auto;background:#c62828;color:#fff;font-size:12px;font-weight:900;min-width:21px;height:21px;border-radius:11px;display:inline-flex;align-items:center;justify-content:center;padding:0 6px">' + f.sinLeer + '</span>'
        : '';
      var apagado = a.activo === false
        ? '<span style="flex:0 0 auto;background:#ECEFF1;color:#78909C;font-size:10px;font-weight:800;padding:2px 7px;border-radius:8px">🚫 SIN ACCESO</span>'
        : '';
      h += '<button onclick="abrirConversacionNBS(\'' + encodeURIComponent(a.clave) + '\')" style="width:100%;text-align:left;background:' + (f.sinLeer > 0 ? '#F3E5F5' : '#F4F6FB') + ';border:none;border-radius:10px;padding:9px 11px;margin-bottom:7px;cursor:pointer;font-family:inherit">'
        + '<div style="display:flex;align-items:center;gap:7px">'
        + globo
        + '<span style="flex:1;font-size:14.5px;font-weight:800;color:#1a1a2e;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + quien + '</span>'
        + apagado
        + '<span style="flex:0 0 auto;font-size:11px;color:#888">' + hora + '</span>'
        + '</div>'
        + '<div style="font-size:12.5px;color:#666;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + vista + '</div>'
        + '</button>';
    });
  }

  h += '<button onclick="abrirAccesosChat()" style="width:100%;background:#E8EAF6;color:#1a237e;border:none;border-radius:9px;padding:10px;font-size:13.5px;font-weight:800;cursor:pointer;margin-top:4px">🔑 Ver los accesos (quitar / devolver)</button>'
    + '</div>';
  o.innerHTML = h;
  o.scrollTop = 0;
}

// ── LA CONVERSACIÓN ──
function abrirConversacionNBS(claveCod){
  var clave = decodeURIComponent(claveCod || '');
  var bd = _bdChat();
  if(!bd || !clave) return;
  var acceso = (window._chatAccesos || []).find(function(a){ return a.clave === clave; }) || { clave: clave };
  window._chatAccesoActual = acceso;
  var o = _cajaChatNBS();
  var quien = escaparHtml(acceso.nombre || clave) + (acceso.barberia ? ' · ' + escaparHtml(acceso.barberia) : '');
  o.innerHTML = '<div style="max-width:480px;margin:0 auto;display:flex;flex-direction:column;height:calc(100vh - 20px)">'
    + '<div style="display:flex;gap:8px;margin-bottom:8px;flex:0 0 auto">'
    + '<button onclick="volverAListaChat()" style="flex:0 0 auto;background:#E8EAF6;border:none;border-radius:8px;padding:9px 14px;font-size:14px;font-weight:700;color:#1a237e;cursor:pointer">←</button>'
    + '<div style="flex:1;display:flex;align-items:center;padding:0 10px;background:linear-gradient(90deg,#4A148C,#6A1B9A);border-radius:8px;color:#fff;font-size:13.5px;font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + quien + '</div>'
    + '</div>'
    + '<div id="chatnbs-hilo" style="flex:1;overflow-y:auto;background:#F4F6FB;border-radius:10px;padding:9px"></div>'
    + '<div style="flex:0 0 auto;display:flex;gap:7px;margin-top:8px">'
    + '<textarea id="chatnbs-texto" rows="1" placeholder="Escribe aquí…" style="flex:1;border:1.5px solid #C5CAE9;border-radius:9px;padding:9px 10px;font-size:14.5px;font-family:inherit;resize:none;max-height:110px" oninput="this.style.height=\'auto\';this.style.height=Math.min(this.scrollHeight,110)+\'px\'"></textarea>'
    + '<button id="chatnbs-enviar" onclick="mandarMensajeNBS()" style="flex:0 0 auto;background:#2E7D32;color:#fff;border:none;border-radius:9px;padding:0 16px;font-size:14px;font-weight:800;cursor:pointer">Enviar</button>'
    + '</div>'
    + '</div>';

  pararEscuchaChatNBS();
  try {
    // 🔑 El buzón de SU clave, y nada más. El orden se pone aquí adentro.
    window._chatEscucha = _buzonDeClave(clave)
      .onSnapshot(function(snap){
        var msgs = [];
        snap.forEach(function(d){ var m = d.data(); if(m) msgs.push(m); });
        msgs.sort(function(a, b){ return (a.cuando || 0) - (b.cuando || 0); });
        pintarHiloNBS(msgs);
        // Lo que el barbero mandó y él no había visto, queda leído al abrirlo
        var marcados = 0;
        snap.forEach(function(d){
          var m = d.data();
          if(m && !m.deNBS && !m.leido){
            try { d.ref.update({ leido: true }); marcados++; } catch(e){}
          }
        });
        if(marcados > 0){
          window._chatSinLeer = Math.max(0, (window._chatSinLeer || 0) - marcados);
          pintarGloboChatNBS(window._chatSinLeer);
        }
      }, function(e){ console.warn('chat: no pude escuchar el hilo:', e); });
  } catch(e){ console.warn('chat: no pude abrir el hilo:', e); }
}

function volverAListaChat(){
  pararEscuchaChatNBS();
  window._chatAccesoActual = null;
  cargarListaChatNBS();
}

function pintarHiloNBS(msgs){
  var hilo = document.getElementById('chatnbs-hilo');
  if(!hilo) return;
  if(!msgs || !msgs.length){
    hilo.innerHTML = '<div style="text-align:center;color:#999;font-size:13px;padding:24px 8px">Aún no hay mensajes.<br>Escríbele abajo cuando quieras.</div>';
    return;
  }
  hilo.innerHTML = msgs.map(function(m){
    var mio = !!m.deNBS;
    return '<div style="display:flex;justify-content:' + (mio ? 'flex-end' : 'flex-start') + ';margin-bottom:6px">'
      + '<div style="max-width:82%;background:' + (mio ? '#2E7D32' : '#fff') + ';color:' + (mio ? '#fff' : '#1a1a2e') + ';border-radius:11px;padding:7px 10px;font-size:14px;line-height:1.35;box-shadow:0 1px 2px rgba(0,0,0,.08);white-space:pre-wrap;word-break:break-word">'
      + escaparHtml(String(m.texto || ''))
      + '<div style="font-size:10px;color:' + (mio ? '#c8f0cd' : '#999') + ';text-align:right;margin-top:2px">' + horaCortita(m.cuando || 0) + '</div>'
      + '</div></div>';
  }).join('');
  hilo.scrollTop = hilo.scrollHeight;
}

function mandarMensajeNBS(){
  var bd = _bdChat();
  var caja = document.getElementById('chatnbs-texto');
  var a = window._chatAccesoActual;
  if(!bd || !caja || !a || !a.clave) return;
  var texto = (caja.value || '').trim();
  if(!texto) return;
  var boton = document.getElementById('chatnbs-enviar');
  if(boton) boton.disabled = true;
  caja.value = '';
  caja.style.height = 'auto';
  // El mensaje cae en el buzón de la clave; los datos del cliente ya viven
  // en su tarjeta de acceso, aquí va solo el mensaje.
  _buzonDeClave(a.clave).add({
    texto: texto.slice(0, 900),
    deNBS: true,
    leido: false,
    cuando: Date.now()
  }).then(function(){
    if(boton) boton.disabled = false;
  }).catch(function(e){
    console.warn('chat: no se pudo mandar:', e);
    if(boton) boton.disabled = false;
    caja.value = texto;              // no se le pierde lo que escribió
    try { avisoChico('No se pudo enviar. Revisa el internet.'); } catch(err){}
  });
}

// ── DAR ACCESO — escoge el cliente y ÉL escribe la clave ──
function abrirDarAccesoChat(){
  var o = _cajaChatNBS();
  window._chatClienteElegido = null;
  o.innerHTML = '<div style="max-width:480px;margin:0 auto">'
    + '<div style="display:flex;gap:8px;margin-bottom:10px">'
    + '<button onclick="volverAListaChat()" style="flex:0 0 auto;background:#E8EAF6;border:none;border-radius:8px;padding:9px 14px;font-size:14px;font-weight:700;color:#1a237e;cursor:pointer">←</button>'
    + '<div style="flex:1;display:flex;align-items:center;justify-content:center;background:linear-gradient(90deg,#D4A017,#c49212);border-radius:8px;color:#fff;font-size:14px;font-weight:900">➕ DAR ACCESO</div>'
    + '</div>'
    + '<div style="font-size:13px;color:#666;font-weight:600;margin-bottom:6px">1️⃣ Escoge el cliente:</div>'
    + '<input id="chatnbs-buscar" type="text" placeholder="Busca por nombre o barbería…" oninput="filtrarClienteChat(this.value)" autocomplete="off" style="width:100%;box-sizing:border-box;border:1.5px solid #C5CAE9;border-radius:9px;padding:9px 11px;font-size:14.5px;font-family:inherit;margin-bottom:8px">'
    + '<div id="chatnbs-clientes"></div>'
    + '<div id="chatnbs-paso2" style="display:none;margin-top:10px">'
    + '<div style="font-size:13px;color:#666;font-weight:600;margin-bottom:6px">2️⃣ Escribe TÚ la clave que le vas a dar:</div>'
    + '<input id="chatnbs-clave" type="text" placeholder="Ej: LUIS2026" autocomplete="off" autocapitalize="characters" style="width:100%;box-sizing:border-box;border:2px solid #D4A017;border-radius:9px;padding:10px 11px;font-size:16px;font-weight:800;letter-spacing:1px;text-transform:uppercase;font-family:inherit">'
    + '<div style="font-size:11.5px;color:#999;margin-top:4px">Solo letras y números, mínimo 4. Esa clave se la das tú al cliente.</div>'
    + '<div id="chatnbs-err" style="font-size:13px;color:#c62828;font-weight:700;margin-top:6px"></div>'
    + '<button onclick="guardarAccesoChat()" style="width:100%;background:#2E7D32;color:#fff;border:none;border-radius:9px;padding:11px;font-size:14.5px;font-weight:800;cursor:pointer;margin-top:8px">✅ Guardar el acceso</button>'
    + '</div>'
    + '</div>';
  filtrarClienteChat('');
  setTimeout(function(){ var i = document.getElementById('chatnbs-buscar'); if(i) i.focus(); }, 100);
}

function filtrarClienteChat(txt){
  var caja = document.getElementById('chatnbs-clientes');
  if(!caja) return;
  var lista = (typeof clientes !== 'undefined' && clientes && clientes.length) ? clientes : LS('ncl', []);
  var q = normalizarTexto(txt || '');
  var quedan = lista.filter(function(c){
    if(!q) return true;
    var todo = normalizarTexto([c.nombre, c.apellido, c.apodo, c.negocio].filter(Boolean).join(' '));
    return todo.indexOf(q) >= 0;
  }).slice(0, 20);
  if(!quedan.length){
    caja.innerHTML = '<div style="font-size:13px;color:#999;text-align:center;padding:10px">No encuentro a nadie con eso.</div>';
    return;
  }
  caja.innerHTML = quedan.map(function(c){
    var el = window._chatClienteElegido;
    var elegido = el && String(el.id) === String(c.id);
    return '<button onclick="escogerClienteChat(\'' + encodeURIComponent(String(c.id)) + '\')" style="width:100%;text-align:left;background:' + (elegido ? '#E8F5E9' : '#F4F6FB') + ';border:' + (elegido ? '1.5px solid #2E7D32' : 'none') + ';border-radius:9px;padding:8px 11px;margin-bottom:5px;cursor:pointer;font-family:inherit">'
      + '<span style="font-size:14px;font-weight:700;color:#1a1a2e">' + escaparHtml(nombreCl(c)) + '</span>'
      + (c.negocio ? '<span style="font-size:12px;color:#666"> · 🏪 ' + escaparHtml(c.negocio) + '</span>' : '')
      + (elegido ? '<span style="float:right;color:#2E7D32;font-weight:900">✓</span>' : '')
      + '</button>';
  }).join('');
}

function escogerClienteChat(idCod){
  var id = decodeURIComponent(idCod || '');
  var lista = (typeof clientes !== 'undefined' && clientes && clientes.length) ? clientes : LS('ncl', []);
  var c = lista.find(function(x){ return String(x.id) === String(id); });
  if(!c) return;
  window._chatClienteElegido = c;
  var b = document.getElementById('chatnbs-buscar');
  filtrarClienteChat(b ? b.value : '');
  var p2 = document.getElementById('chatnbs-paso2');
  if(p2){ p2.style.display = 'block'; }
  setTimeout(function(){ var i = document.getElementById('chatnbs-clave'); if(i) i.focus(); }, 100);
}

function guardarAccesoChat(){
  var bd = _bdChat();
  var c = window._chatClienteElegido;
  var cajaClave = document.getElementById('chatnbs-clave');
  var err = document.getElementById('chatnbs-err');
  var decir = function(t){ if(err) err.textContent = t; };
  if(!bd){ decir('Sin internet. Prueba otra vez.'); return; }
  if(!c){ decir('Primero escoge el cliente arriba.'); return; }
  var clave = (cajaClave ? cajaClave.value : '').trim().toUpperCase().replace(/\s+/g, '');
  if(!clave || clave.length < 4){ decir('La clave necesita al menos 4 letras o números.'); return; }
  if(!/^[A-Z0-9]+$/.test(clave)){ decir('Solo letras y números, sin espacios ni signos.'); return; }
  decir('Guardando…');
  var ref = bd.collection('nbs_chat_accesos').doc(clave);
  ref.get().then(function(doc){
    if(doc.exists){
      decir('Esa clave YA está en uso' + (doc.data() && doc.data().nombre ? ' (' + doc.data().nombre + ')' : '') + '. Escribe otra.');
      return;
    }
    var nombrePlano = ((c.nombre || '') + ' ' + (c.apellido || '')).replace(/\s+/g, ' ').trim();
    return ref.set({
      cid: String(c.id),
      nombre: nombrePlano,
      barberia: c.negocio || '',
      activo: true,
      creado: Date.now(),
      ultimaEntrada: null
    }).then(function(){
      try { avisoChico('✅ Acceso creado: ' + clave); } catch(e){}
      window._chatClienteElegido = null;
      cargarListaChatNBS();
    });
  }).catch(function(e){
    console.warn('chat: no pude guardar el acceso:', e);
    decir('No se pudo guardar. Revisa el internet y prueba otra vez.');
  });
}

// ── VER LOS ACCESOS — quitar / devolver sin borrar nada ──
function abrirAccesosChat(){
  var bd = _bdChat();
  var o = _cajaChatNBS();
  o.innerHTML = '<div style="max-width:480px;margin:0 auto">'
    + '<div style="display:flex;gap:8px;margin-bottom:10px">'
    + '<button onclick="volverAListaChat()" style="flex:0 0 auto;background:#E8EAF6;border:none;border-radius:8px;padding:9px 14px;font-size:14px;font-weight:700;color:#1a237e;cursor:pointer">←</button>'
    + '<div style="flex:1;display:flex;align-items:center;justify-content:center;background:#1a237e;border-radius:8px;color:#fff;font-size:14px;font-weight:900">🔑 LOS ACCESOS</div>'
    + '</div>'
    + '<div id="chatnbs-accesos"><div style="text-align:center;color:#888;font-size:13px;padding:20px 0">Cargando…</div></div>'
    + '</div>';
  if(!bd) return;
  bd.collection('nbs_chat_accesos').get().then(function(snap){
    var accs = [];
    snap.forEach(function(d){ var a = d.data() || {}; a.clave = d.id; accs.push(a); });
    accs.sort(function(x, y){ return (y.creado || 0) - (x.creado || 0); });
    window._chatAccesos = accs;
    pintarAccesosChat(accs);
  }).catch(function(e){
    console.warn('chat: no pude cargar los accesos:', e);
    var caja = document.getElementById('chatnbs-accesos');
    if(caja) caja.innerHTML = '<div style="font-size:13px;color:#c62828;font-weight:700;text-align:center;padding:10px">No pude traer los accesos. Revisa el internet.</div>';
  });
}

function pintarAccesosChat(accs){
  var caja = document.getElementById('chatnbs-accesos');
  if(!caja) return;
  if(!accs || !accs.length){
    caja.innerHTML = '<div style="background:#F4F6FB;border-radius:10px;padding:14px;text-align:center;font-size:13px;color:#666">No hay accesos todavía.</div>';
    return;
  }
  caja.innerHTML = accs.map(function(a){
    var activo = a.activo !== false;
    var entrada = a.ultimaEntrada ? horaCortita(a.ultimaEntrada) : 'nunca ha entrado';
    return '<div style="background:' + (activo ? '#F4F6FB' : '#FBE9E7') + ';border-radius:10px;padding:9px 11px;margin-bottom:7px">'
      + '<div style="display:flex;align-items:center;gap:7px">'
      + '<span style="flex:1;font-size:14px;font-weight:800;color:#1a1a2e;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escaparHtml(a.nombre || '') + (a.barberia ? ' · ' + escaparHtml(a.barberia) : '') + '</span>'
      + '<span style="flex:0 0 auto;background:' + (activo ? '#E8F5E9' : '#ECEFF1') + ';color:' + (activo ? '#2E7D32' : '#78909C') + ';font-size:10.5px;font-weight:900;padding:2px 8px;border-radius:8px">' + (activo ? '✅ ACTIVO' : '🚫 SIN ACCESO') + '</span>'
      + '</div>'
      + '<div style="display:flex;align-items:center;gap:7px;margin-top:5px">'
      + '<span style="flex:1;font-size:12px;color:#666">🔑 <b style="letter-spacing:1px">' + escaparHtml(a.clave) + '</b> · entró: ' + entrada + '</span>'
      + '<button onclick="toggleAccesoChat(\'' + encodeURIComponent(a.clave) + '\',' + (activo ? 'false' : 'true') + ')" style="flex:0 0 auto;background:' + (activo ? '#c62828' : '#2E7D32') + ';color:#fff;border:none;border-radius:8px;padding:6px 11px;font-size:12px;font-weight:800;cursor:pointer">' + (activo ? 'Quitar' : 'Devolver') + '</button>'
      + '</div>'
      + '</div>';
  }).join('');
}

function toggleAccesoChat(claveCod, nuevo){
  var bd = _bdChat();
  var clave = decodeURIComponent(claveCod || '');
  if(!bd || !clave) return;
  bd.collection('nbs_chat_accesos').doc(clave).update({ activo: !!nuevo }).then(function(){
    try { avisoChico(nuevo ? '✅ Acceso devuelto' : '🚫 Acceso quitado'); } catch(e){}
    // La conversación NO se borra: si le devuelve el acceso, la ve completa.
    abrirAccesosChat();
  }).catch(function(e){
    console.warn('chat: no pude cambiar el acceso:', e);
    try { avisoChico('No se pudo. Revisa el internet.'); } catch(err){}
  });
}
