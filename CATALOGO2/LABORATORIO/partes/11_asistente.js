
function _pitido(frecuencia, inicioSeg, duracionSeg, volumen){
  var ctx = _obtenerContextoAudio();
  if(!ctx) return;
  var osc = ctx.createOscillator();
  var vol = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = frecuencia;
  osc.connect(vol);
  vol.connect(ctx.destination);
  var t0 = ctx.currentTime + inicioSeg;
  vol.gain.setValueAtTime(0, t0);
  vol.gain.linearRampToValueAtTime(volumen, t0 + 0.02);
  vol.gain.linearRampToValueAtTime(0, t0 + duracionSeg);
  osc.start(t0);
  osc.stop(t0 + duracionSeg + 0.02);
}
// DESBLOQUEO DEL SONIDO (25 jul, arregla "el aviso de actualización no suena"):
// el teléfono NO deja sonar nada hasta que la persona toca la pantalla al menos una vez
// -es una regla de seguridad del navegador, no un error de la app-. El aviso de
// "actualización" sale justo al abrir/entrar, a veces ANTES de que ese primer toque
// haya "desbloqueado" el sonido. Con este código, el simple toque de entrar a la app
// -tocar "Entrar", poner la huella, lo que sea- ya desbloquea el sonido para el resto
// de la sesión, así que para cuando salga el aviso, ya puede sonar.
document.addEventListener('pointerdown', function _desbloquearSonido(){
  _obtenerContextoAudio();
}, { once:true, capture:true });
// 🔴 PRECAUCION: dos pitidos cortos y agudos seguidos -mismo espiritu que la alerta
// de Windows, para avisos importantes como "algo se borro" o "el dinero no cuadra"-.
function sonidoPrecaucion(){
  try{
    _pitido(880, 0,    0.14, 0.35);
    _pitido(880, 0.18, 0.14, 0.35);
  }catch(e){}
}
// 🔵 RECORDATORIO: un "ding-dong" suave de dos notas -parecido al tipo de sonido de
// una notificacion normal, para el aviso de bajar respaldo y el de llegar a la barberia-.
function sonidoRecordatorio(){
  try{
    _pitido(660, 0,    0.16, 0.22);
    _pitido(880, 0.14, 0.22, 0.22);
  }catch(e){}
}
// 🟢 ACTUALIZACIÓN: melodía de 4 notas subiendo, más larga y distinta a los otros dos
// -pedido por Sensei el 25 jul, el de 2 notas casi ni se sentía-.
function sonidoActualizacionApp(){
  try{
    _pitido(523, 0,    0.22, 0.28);  // Do
    _pitido(659, 0.20, 0.22, 0.28);  // Mi
    _pitido(784, 0.40, 0.22, 0.28);  // Sol
    _pitido(1047,0.60, 0.38, 0.30);  // Do agudo, la más larga, para que quede sonando al final
  }catch(e){}
}

function asistenteHablaEncendido(){
  var v = LS('nbs_asis_voz', null);
  return (v === null || v === undefined) ? true : !!v;   // por defecto SI habla
}

function toggleVozAsistente(){
  var ahora = !asistenteHablaEncendido();
  SS('nbs_asis_voz', ahora);
  if(!ahora) pararVozAsistente();
  var b = document.getElementById('asis-btn-voz');
  if(b){
    b.innerHTML = ahora ? '\ud83d\udd0a' : '\ud83d\udd07';
    b.title = ahora ? 'Te hablo' : 'Callado';
  }
  if(ahora) hablarAsistente('Ya te escucho y te hablo.');
}

function pararVozAsistente(){
  try { if(window.speechSynthesis) window.speechSynthesis.cancel(); } catch(e){}
  _asisHablando = false;
}

// Decir un texto en voz alta. Se le quitan los emojis y los signos raros,
// porque la voz del telefono los lee y suena mal.
function hablarAsistente(texto){
  if(!asistenteHablaEncendido()) return;
  var synth = window.speechSynthesis;
  if(!synth) return;
  // 🔇 MIENTRAS HABLA, EL MICRÓFONO SE APAGA. Si no, se oye a sí mismo, no se
  // entiende, y contesta "No te entendí" con toda la lista. Sensei lo cazó. -17 ago-
  window._asistenteHablando = true;
  try { if(window._micAsistente) window._micAsistente.abort(); } catch(eM){}
  window._loQueAcaboDeDecir = String(texto || '').toLowerCase();
  try {
    synth.cancel();
    var limpio = String(texto || '')
      // Los emojis suenan mal leidos
      .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{2705}\u{274C}\u{2713}\u{2717}]/gu, ' ')
      // 🔴 "$400.00" se parte en "400." y "00" al cortar por frases, y suena horrible.
      // Se dice "400 dolares" y se le quitan los centavos cuando son .00. -14 ago-
      .replace(/\$\s*([\d,]+)\.00\b/g, '$1 dolares')
      .replace(/\$\s*([\d,]+)\.(\d\d)\b/g, '$1 dolares con $2')
      .replace(/\$\s*([\d,]+)/g, '$1 dolares')
      // "producto(s)" se lee "producto parentesis ese". Se deja el plural.
      .replace(/\(s\)/g, 's')
      .replace(/\(es\)/g, 'es')
      // Los numeros con coma de miles: "1,284" se lee "uno coma dos ocho cuatro"
      .replace(/(\d),(\d{3})\b/g, '$1$2')
      .replace(/[·•|_*#>\[\]]/g, ' ')
      .replace(/(\d)\s*d\b(?![a-zA-Z\u00e0-\u00ff])/g, '$1 dias')
      .replace(/\s+/g, ' ')
      .trim();
    if(!limpio) return;
    var pedazos = limpio.match(/[^.!?\n]{1,180}[.!?\n]?/g) || [limpio];
    _asisHablando = true;
    pedazos.forEach(function(t){
      var txt = t.trim();
      if(!txt || txt.length < 2) return;
      var u = new SpeechSynthesisUtterance(txt);
      u.lang = 'es-US';
      u.rate = 1.02;
      u.pitch = 1;
      try {
        var voz = (typeof acaElegirVoz === 'function') ? acaElegirVoz() : null;
        if(voz) u.voice = voz;
      } catch(e){}
      // 🔇 Al terminar de hablar, se puede volver a escuchar. -17 ago-
      try {
        u.onend = function(){
          setTimeout(function(){ window._asistenteHablando = false; }, 600);
        };
      } catch(eE){ window._asistenteHablando = false; }
      synth.speak(u);
    });
  } catch(e){}
}

// Lo que le dice al abrir el panel: el saludo y los avisos, en corto.
function contestarAsistente(texto){
  var q = _contestarAsistenteTexto(texto);
  try {
    var el = document.getElementById('asis-respuesta');
    if(el && asistenteHablaEncendido()){
      // ⚠️ NO se puede usar cloneNode + innerText: un nodo fuera del documento
      // devuelve innerText VACÍO. Se recorren los hijos y se saltan los botones. -14 ago-
      var partes = [];
      var recorrer = function(nodo){
        for(var k = 0; k < nodo.childNodes.length; k++){
          var h = nodo.childNodes[k];
          if(h.nodeType === 3){                       // texto suelto
            var t = String(h.textContent || '').trim();
            if(t) partes.push(t);
          } else if(h.nodeType === 1){                // un elemento
            var tag = (h.tagName || '').toLowerCase();
            if(tag === 'button' || tag === 'a') continue;   // los botones NO se leen
            recorrer(h);
          }
        }
      };
      recorrer(el);
      var dicho = partes.join(' ')
        .replace(/^[\s\S]*?DIJISTE:\s*[\u201c"][^\u201d"]*[\u201d"]\s*/, '')   // quitar el "TÚ DIJISTE"
        .replace(/\s+/g, ' ')
        .trim();
      if(dicho) hablarAsistente(dicho);
    }
  } catch(e){}
  return q;
}

function _contestarAsistenteTexto(texto){
  // 🧠 EL CEREBRO NUEVO PRUEBA PRIMERO. Entiende IDEAS, no frases exactas.
  // Si no reconoce nada, le deja el turno al de antes, que sigue igual. -17 ago-
  try {
    var _idea = entenderIdea(texto);
    if(_idea){
      var _resp = responderIdea(_idea, texto);
      if(_resp){
        var _el = document.getElementById('asis-respuesta');
        if(_el){
          var _c = '<div style="background:#fff;border-radius:12px;padding:14px;'
            + 'border:1px solid var(--nbs-line)">';
          _c += '<div style="font-size:15px;font-weight:900;color:var(--nbs-ink);'
            + 'margin-bottom:9px;line-height:1.3">' + _resp.titulo + '</div>';
          (_resp.lineas || []).forEach(function(l){
            _c += '<div style="font-size:13px;color:var(--nbs-ink);margin:4px 0;'
              + 'line-height:1.5">' + l + '</div>';
          });
          if(_resp.boton){
            _c += '<button onclick="' + _resp.boton[1] + '" class="btn" '
              + 'style="width:100%;margin:12px 0 0;background:var(--nbs-gold);'
              + 'color:#fff;font-weight:900;font-size:13px;padding:11px">'
              + _resp.boton[0] + '</button>';
          }
          _c += '</div>';
          _el.innerHTML = _c;
        }
        return { tipo: _idea.idea, porElCerebroNuevo: true };
      }
    }
  } catch(eIA){ /* si algo falla, sigue el camino de siempre */ }

  var q = entenderLoQueDijo(texto);
  var el = document.getElementById('asis-respuesta');
  if(!el) return q;

  var caja = function(cuerpo, botones){
    return '<div style="background:#fff;border-left:4px solid #1a237e;border-radius:11px;'
      + 'padding:12px;box-shadow:0 1px 3px rgba(0,0,0,.08)">'
      + '<div style="font-size:10px;font-weight:800;color:var(--nbs-muted);letter-spacing:.3px;margin-bottom:5px">'
      +   '\ud83e\udd16 T\u00da DIJISTE: \u201c' + escaparHtml(String(texto).slice(0, 46)) + '\u201d</div>'
      + cuerpo
      + (botones ? '<div style="display:flex;gap:6px;margin-top:9px">' + botones + '</div>' : '')
      + '</div>';
  };
  var linea = function(t, grande){
    return '<div style="font-size:' + (grande ? '14' : '12.5') + 'px;color:var(--nbs-ink);'
      + 'font-weight:' + (grande ? '900' : '600') + ';line-height:1.6">' + t + '</div>';
  };
  var btn = function(txt, fn){
    return '<button onclick="' + fn + '" style="flex:1;padding:9px 6px;background:#1a237e;color:#fff;'
      + 'border:none;border-radius:8px;font-size:11.5px;font-weight:800;cursor:pointer">' + txt + '</button>';
  };

  if(q.tipo === 'cuantoDebe'){
    var cls = buscarClientePorVoz(q.quien);
    if(!cls.length){ el.innerHTML = caja(linea('No encontr\u00e9 a nadie que se llame \u201c'
      + escaparHtml(q.quien) + '\u201d.')); return q; }
    var c = cls[0];
    var V = _ventasReales().filter(function(v){ return String(v.cid) === String(c.id) && v.tipo === 'credito'; });
    var debe = 0, facturas = 0, masVieja = 0;
    V.forEach(function(v){
      var pg = 0;
      (v.pagosFactura || []).forEach(function(p){ if(!p.esDevolucion) pg += parseFloat(p.monto) || 0; });
      var s = cobradoYDebeDe(v).debe;
      if(s <= 0.01) return;
      debe += s; facturas++;
      var d = _diasDesde(v.fecha);
      if(d !== null && d > masVieja) masVieja = d;
    });
    el.innerHTML = caja(
      linea(escaparHtml(nombreCl(c)), true)
      + linea(debe > 0.01
          ? 'Te debe <b style="color:var(--nbs-red-text)">$' + fmtNum(debe) + '</b> en '
            + facturas + ' factura(s).<br>La m\u00e1s vieja lleva <b>' + masVieja + ' d\u00edas</b>.'
          : 'No te debe nada. Est\u00e1 al d\u00eda \u2705'),
      debe > 0.01
        ? btn('\ud83d\udcb5 Cobrarle', 'cerrarAsistente();irACobrarCliente(' + _arg(c.id) + ')')
          + btn('\ud83d\udc41\ufe0f Su ficha', 'cerrarAsistente();verCl(' + _arg(c.id) + ')')
        : btn('\ud83d\udc41\ufe0f Su ficha', 'cerrarAsistente();verCl(' + _arg(c.id) + ')'));
    return q;
  }

  if(q.tipo === 'callados'){
    var lista = clientesQueSeCallaron();
    if(!lista.length){ el.innerHTML = caja(linea('Ninguno. Todos tus clientes vienen al d\u00eda \u2705')); return q; }
    el.innerHTML = caja(
      linea(lista.length + ' cliente(s) dejaron de venir', true)
      + lista.slice(0, 6).map(function(x){
          return linea('\u00b7 <b>' + escaparHtml(nombreCl(x.cliente)) + '</b> \u2014 ven\u00eda cada '
            + x.ritmo + 'd, lleva <b>' + x.diasSinVenir + 'd</b>');
        }).join(''),
      btn('\ud83d\udc41\ufe0f Verlos todos', 'asisVerCallados()'));
    return q;
  }

  if(q.tipo === 'comoMeFue'){
    var h = comoMeFueHoy();
    el.innerHTML = caja(
      linea('Hoy', true)
      + linea('Vendiste <b>$' + fmtNum(h.vendido) + '</b> en ' + h.facturas + ' factura(s).<br>'
        + 'Cobraste <b style="color:var(--nbs-green-text)">$' + fmtNum(h.cobrado) + '</b>.<br>'
        + 'Ganancia: <b>$' + fmtNum(h.ganancia) + '</b>.'
        + (h.visitasCompro + h.visitasNoCompro > 0
            ? '<br>Visitaste ' + (h.visitasCompro + h.visitasNoCompro) + ' y te compraron <b>'
              + h.visitasCompro + '</b>.' : '')
        + (h.pedidosPendientes ? '<br>\u26a1 Tienes <b>' + h.pedidosPendientes + '</b> pedido(s) sin convertir.' : '')));
    return q;
  }

  if(q.tipo === 'seAcaba'){
    var ac = loQueSeAcaba(21);
    if(!ac.length){ el.innerHTML = caja(linea('No se te est\u00e1 acabando nada \u2705')); return q; }
    el.innerHTML = caja(
      linea(ac.length + ' producto(s) para comprar', true)
      + ac.slice(0, 8).map(function(x){
          return linea('\u00b7 <b>' + escaparHtml(String(x.prod.nombre).slice(0, 28)) + '</b> \u2014 te quedan '
            + x.stock + ', vendes ' + x.alMes + '/mes');
        }).join(''),
      btn('\u2795 A la lista de relleno', 'asisAgregarAlRelleno(\'todos\')'));
    return q;
  }

  if(q.tipo === 'esteMes'){
    var V2 = _ventasReales();
    var ahora = new Date();
    var vend = 0, gan = 0, n = 0;
    V2.forEach(function(v){
      var f = parsearFechaVenta(v.fecha);
      if(!f || f.getMonth() !== ahora.getMonth() || f.getFullYear() !== ahora.getFullYear()) return;
      vend += parseFloat(v.total) || 0;
      gan += parseFloat(v.ganancia) || 0;
      n++;
    });
    el.innerHTML = caja(
      linea('Este mes', true)
      + linea('Llevas <b>$' + fmtNum(vend) + '</b> vendidos en ' + n + ' factura(s).<br>'
        + 'Ganancia: <b style="color:var(--nbs-green-text)">$' + fmtNum(gan) + '</b>'
        + (vend > 0 ? ' (' + Math.round(gan / vend * 100) + '%)' : '')));
    return q;
  }

  if(q.tipo === 'reporte'){
    el.innerHTML = caja(
      linea('\u00bfQu\u00e9 reporte quieres?', true),
      btn('\ud83d\udcb0 Qui\u00e9n me debe', 'cerrarAsistente();ir(\'p-cxc\')')
      + btn('\ud83d\udcca Por cliente', 'cerrarAsistente();mostrarReporteClientes(\'ganancia\')')
      + btn('\ud83d\udcc8 Margen', 'cerrarAsistente();mostrarMargenProductos()'));
    return q;
  }

  if(q.tipo === 'abrirPedido'){
    var cl2 = buscarClientePorVoz(q.quien);
    if(!cl2.length){ el.innerHTML = caja(linea('No encontr\u00e9 a \u201c'
      + escaparHtml(q.quien) + '\u201d entre tus clientes.')); return q; }
    var c2 = cl2[0];
    el.innerHTML = caja(
      linea('Pedido para <b>' + escaparHtml(nombreCl(c2)) + '</b>', true)
      + linea(c2.negocio ? escaparHtml(c2.negocio) : ''),
      btn('\u26a1 Abrir su pedido', 'cerrarAsistente();irAPedidoCliente(' + _arg(c2.id) + ')'));
    return q;
  }

  if(q.tipo === 'agregar'){
    el.innerHTML = caja(
      linea('Entend\u00ed ' + q.items.length + ' producto(s)', true)
      + q.items.map(function(x){
          return linea('\u00b7 <b>' + x.cant + ' \u00d7 ' + escaparHtml(String(x.prod.nombre).slice(0, 30))
            + '</b> \u2014 $' + fmtNum((x.prod.precio || 0) * x.cant));
        }).join(''),
      btn('\u26a1 Ir a Pedidos R\u00e1pidos', 'cerrarAsistente();ir(\'p-ped\')'));
    return q;
  }

  // 🔑 NO ENTENDÍ — pero en vez de la lista fría, ADIVINO lo más parecido
  // a lo que quiso decir y se lo ofrezco en botones. -17 ago-
  var _sug = [];
  try { _sug = adivinarLoQueQuiso(texto) || []; } catch(eS){}
  if(_sug.length){
    el.innerHTML = caja(
      linea('No estoy seguro de qu\u00e9 me pediste \ud83e\udd14', true)
      + linea('\u00bfSer\u00e1 alguna de estas?')
      + _sug.map(function(t){
          return '<button onclick="contestarAsistente(' + _arg(t) + ')" '
            + 'style="width:100%;text-align:left;margin:5px 0;padding:11px 13px;'
            + 'background:var(--nbs-gold-bg);border:1px solid var(--nbs-gold);'
            + 'border-radius:9px;font-size:13px;font-weight:700;color:var(--nbs-ink);'
            + 'cursor:pointer">' + escaparHtml(t) + '</button>';
        }).join(''));
    return q;
  }

  // No entendió
  el.innerHTML = caja(
    linea('No te entend\u00ed \ud83d\ude45', true)
    + linea('Puedo con estas:<br>'
      + '\u00b7 \u201c\u00bfcu\u00e1nto me debe Isidro?\u201d<br>'
      + '\u00b7 \u201c\u00bfqui\u00e9n no viene hace tiempo?\u201d<br>'
      + '\u00b7 \u201c\u00bfc\u00f3mo me fue hoy?\u201d<br>'
      + '\u00b7 \u201c\u00bfqu\u00e9 se me est\u00e1 acabando?\u201d<br>'
      + '\u00b7 \u201c\u00bfcu\u00e1nto llevo este mes?\u201d<br>'
      + '\u00b7 \u201cprepara un pedido para Luis\u201d<br>'
      + '\u00b7 \u201cdos cool care y tres gel\u201d'));
  return q;
}

// ═══ EL MICRÓFONO ═══
function hablarleAlAsistente(){
  // 🔑 SI ÉL VA A HABLAR, YO ME CALLO. Al tocar el micrófono se corta la voz
  // en seco, como cuando uno interrumpe a alguien. -17 ago-
  try {
    if(window.speechSynthesis) window.speechSynthesis.cancel();
    window._asistenteHablando = false;
    window._loQueAcaboDeDecir = '';
  } catch(eV){}
  var btn = document.getElementById('asis-mic');
  var Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!Rec){
    // Sin micrófono: que pueda escribirlo
    var t = prompt('Escr\u00edbeme qu\u00e9 necesitas:');
    if(t) contestarAsistente(t);
    return;
  }
  var r = new Rec();
  r.lang = 'es-DO';
  r.interimResults = false;
  r.maxAlternatives = 1;
  if(btn){ btn.innerHTML = '<span style="font-size:19px">\ud83d\udd34</span> Te escucho...'; btn.style.background = '#FFEBEE'; }
  window._micAsistente = r;   // guardado para poder apagarlo cuando él habla
  r.onresult = function(e){
    var txt = e.results[0][0].transcript;
    // 🔇 Si el asistente estaba HABLANDO, esto es su propia voz. Se descarta. -17 ago-
    if(window._asistenteHablando) return;
    // Y por si acaso: si lo que se oyó se parece mucho a lo que él acaba de decir
    // en voz alta, tampoco es una pregunta.
    try {
      var dicho = String(window._loQueAcaboDeDecir || '').toLowerCase();
      var oido = String(txt || '').toLowerCase().trim();
      if(oido.length > 12 && dicho.length > 12 && dicho.indexOf(oido.slice(0, 18)) >= 0) return;
    } catch(eC){}
    if(!String(txt || '').trim()) return;   // silencio: no contestar nada
    contestarAsistente(txt);
  };
  r.onerror = function(){
    var el = document.getElementById('asis-respuesta');
    if(el) el.innerHTML = '<div style="background:#fff;border-radius:11px;padding:12px;font-size:12.5px;color:var(--nbs-muted)">'
      + 'No pude escucharte. Revisa que le hayas dado permiso al micr\u00f3fono.</div>';
  };
  r.onend = function(){
    if(btn){ btn.innerHTML = '<span style="font-size:19px">\ud83c\udfa4</span> H\u00e1blame'; btn.style.background = '#fff'; }
  };
  try { r.start(); } catch(e){}
}

// ═══════════════════════════════════════════════════════════════════
//  LAS ACCIONES DE LOS AVISOS
// ═══════════════════════════════════════════════════════════════════

function saludoAsistente(){
  var h = new Date().getHours();
  if(h < 12) return 'Buenos d\u00edas';
  if(h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

// El botón redondo, abajo a la derecha

// ═══════════════════════════════════════════════════════════════════
//  📍 MOVER EL BOTÓN DEL ASISTENTE  (15 ago 2026)
//
//  Se deja apretado un momento y se arrastra donde uno quiera.
//  Donde lo suelte queda guardado. Un toque normal lo abre igual.
// ═══════════════════════════════════════════════════════════════════
function hacerArrastrableAsistente(b){
  var arrastrando = false, movio = false;
  var x0 = 0, y0 = 0, r0 = 0, ab0 = 0;
  var timer = null;

  var empezar = function(e){
    var t = e.touches ? e.touches[0] : e;
    x0 = t.clientX; y0 = t.clientY;
    var cs = getComputedStyle(b);
    r0 = parseFloat(cs.right) || 16;
    ab0 = parseFloat(cs.bottom) || 82;
    movio = false;
    // Hay que dejarlo apretado medio segundo: así un toque normal lo abre
    timer = setTimeout(function(){
      arrastrando = true;
      b.style.transform = 'scale(1.12)';
      b.style.opacity = '.85';
      try { if(navigator.vibrate) navigator.vibrate(25); } catch(err){}
    }, 400);
  };

  var mover = function(e){
    if(!arrastrando) {
      // Si movió el dedo antes de los 400 ms, no era un arrastre
      var t0 = e.touches ? e.touches[0] : e;
      if(Math.abs(t0.clientX - x0) > 8 || Math.abs(t0.clientY - y0) > 8){
        clearTimeout(timer);
      }
      return;
    }
    e.preventDefault();
    var t = e.touches ? e.touches[0] : e;
    movio = true;
    var nr = r0 - (t.clientX - x0);
    var nb = ab0 - (t.clientY - y0);
    // Que no se salga de la pantalla
    nr = Math.max(6, Math.min(window.innerWidth - 64, nr));
    nb = Math.max(6, Math.min(window.innerHeight - 64, nb));
    b.style.right = nr + 'px';
    b.style.bottom = nb + 'px';
  };

  var soltar = function(){
    clearTimeout(timer);
    if(arrastrando){
      arrastrando = false;
      b.style.transform = '';
      b.style.opacity = '';
      var cs = getComputedStyle(b);
      SS('nbs_asis_pos', { right: Math.round(parseFloat(cs.right) || 16),
                           bottom: Math.round(parseFloat(cs.bottom) || 82) });
      try { avisoChico('\ud83d\udccd Ah\u00ed queda el asistente'); } catch(e){}
    }
  };

  b.addEventListener('touchstart', empezar, { passive: true });
  b.addEventListener('touchmove', mover, { passive: false });
  b.addEventListener('touchend', soltar);
  b.addEventListener('mousedown', empezar);
  document.addEventListener('mousemove', mover);
  document.addEventListener('mouseup', soltar);

  // Si lo arrastró, el toque NO debe abrir el panel
  var abrirOriginal = b.onclick;
  b.onclick = function(ev){
    if(movio){ movio = false; ev.preventDefault(); ev.stopPropagation(); return; }
    abrirAsistente();
  };
}

// Devolverlo a su sitio de siempre
function devolverBotonAsistente(){
  try { localStorage.removeItem('nbs_asis_pos'); } catch(e){}
  var b = document.getElementById('btn-asistente');
  if(b){ b.style.right = '16px'; b.style.bottom = '82px'; }
  try { avisoChico('\ud83d\udccd El asistente volvi\u00f3 a su sitio'); } catch(e){}
}

function ponerBotonAsistente(){
  if(document.getElementById('btn-asistente')) return;
  var b = document.createElement('button');
  b.id = 'btn-asistente';
  b.setAttribute('aria-label', 'Asistente');
  b.onclick = function(){ abrirAsistente(); };
  // 📍 DONDE ÉL LO DEJÓ LA ÚLTIMA VEZ. Sensei: "el botón del asistente a veces me
  // estorba, ¿puedes ponerlo que yo lo pueda mover?". -15 ago-
  var pos = LS('nbs_asis_pos', null) || { right: 16, bottom: 82 };
  b.style.cssText = 'position:fixed;right:' + pos.right + 'px;bottom:' + pos.bottom + 'px;'
    + 'width:58px;height:58px;border-radius:50%;'
    + 'background:linear-gradient(135deg,#1a237e,#3949AB);color:#fff;border:none;font-size:25px;'
    + 'box-shadow:0 4px 14px rgba(26,35,126,.45);cursor:pointer;z-index:99990;'
    + 'display:flex;align-items:center;justify-content:center;padding:0;touch-action:none';
  b.innerHTML = '\ud83e\udd16';
  document.body.appendChild(b);
  hacerArrastrableAsistente(b);
  pintarPuntoAsistente();
}

// El puntito rojo con cuántas cosas tiene que decirle
function pintarPuntoAsistente(){
  var b = document.getElementById('btn-asistente');
  if(!b) return;
  var viejo = document.getElementById('asis-punto');
  if(viejo && viejo.parentNode) viejo.parentNode.removeChild(viejo);
  var n = 0;
  try {
    // 📥 Solo los que NO ha leído — como el puntito de un correo. -15 ago-
    n = analizarNegocio().filter(function(a){ return (a.nivel === 'rojo' || a.nivel === 'amarillo') && !estaLeido(a); }).length;
  } catch(e){}
  if(!n) return;
  var p = document.createElement('span');
  p.id = 'asis-punto';
  p.textContent = n;
  p.style.cssText = 'position:absolute;top:-3px;right:-3px;background:#C62828;color:#fff;'
    + 'min-width:21px;height:21px;border-radius:11px;font-size:11.5px;font-weight:900;'
    + 'display:flex;align-items:center;justify-content:center;border:2px solid #fff;padding:0 3px';
  b.appendChild(p);
}

function cerrarAsistente(){
  try { pararVozAsistente(); } catch(e){}
  var o = document.getElementById('asistente-ov');
  if(o && o.parentNode) o.parentNode.removeChild(o);
  _asistenteAbierto = false;
  pintarPuntoAsistente();
}

// ═══ EL PANEL ═══

// 📥 LO QUE TODAVÍA NO HA VISTO  (15 ago 2026)
//
// 🔑 Sensei: "ya se borran los anuncios pero sigue diciendo que tiene 5 cosas que
// decir; después de desaparecer las cosas que tenía que decirme ya no debería
// repetirlo". Tenía razón: el saludo y la voz contaban TODOS los avisos, no solo
// los que le faltan por ver. Ahora todo lo que cuenta o habla pasa por aquí.
function avisosPendientes(){
  try {
    return analizarNegocio().filter(function(a){ return !estaLeido(a); });
  } catch(e){ return []; }
}

function abrirAsistente(){
  cerrarAsistente();
  _asistenteAbierto = true;

  // \ud83d\udd04 LO PRIMERO: refrescar los datos. Sin esto el asistente habla de lo que hubiera
  // en memoria cuando se cargo la app, no de lo que hay AHORA. -30 ago-
  try {
    clientes = LS('ncl', []);
    ventas   = LS('nv', []);
    compras  = LS('nc', []);
    suplidores = LS('nsup', []);
    loadProds();
  } catch(e){ console.error('El asistente no pudo refrescar los datos:', e); }

  var ov = document.createElement('div');
  ov.id = 'asistente-ov';
  ov.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(15,15,24,.55);'
    + 'z-index:99995;display:flex;align-items:flex-end;justify-content:center';
  ov.onclick = function(e){ if(e.target === ov) cerrarAsistente(); };

  var caja = document.createElement('div');
  caja.style.cssText = 'background:#F4F4F8;width:100%;max-width:520px;max-height:88vh;overflow-y:auto;'
    + 'border-radius:18px 18px 0 0;padding:0 0 14px';

  var avisos = [];
  // 📥 Solo lo que TODAVÍA no ha visto. Si ya lo archivó, no se le repite. -15 ago-
  try { avisos = avisosPendientes(); } catch(e){}
  var hoy = { facturas: 0, vendido: 0, cobrado: 0 };
  try { hoy = comoMeFueHoy(); } catch(e){}

  var h = '';

  // Cabecera
  h += '<div style="position:sticky;top:0;background:#1a237e;color:#fff;padding:14px 16px;'
    + 'border-radius:18px 18px 0 0;z-index:2">'
    + '<div style="display:flex;align-items:center;gap:9px">'
    +   '<span style="font-size:24px">\ud83e\udd16</span>'
    +   '<div style="flex:1;min-width:0">'
    +     '<div style="font-size:16px;font-weight:900">' + saludoAsistente() + ', Sensei</div>'
    +     '<div style="font-size:11.5px;opacity:.85">'
    +       (avisos.length ? 'Tengo ' + avisos.length + ' cosa(s) que decirte' : 'Todo tranquilo por aqu\u00ed')
    +     '</div>'
    +   '</div>'
    +   '<button id="asis-btn-voz" onclick="toggleVozAsistente()" title="' + (asistenteHablaEncendido() ? 'Te hablo' : 'Callado') + '" '
    +     'style="background:rgba(255,255,255,.18);color:#fff;border:none;border-radius:50%;'
    +     'width:32px;height:32px;font-size:15px;cursor:pointer;margin-right:5px">'
    +     (asistenteHablaEncendido() ? '\ud83d\udd0a' : '\ud83d\udd07') + '</button>'
    +   '<button onclick="cerrarAsistente()" style="background:rgba(255,255,255,.18);color:#fff;'
    +     'border:none;border-radius:50%;width:32px;height:32px;font-size:17px;cursor:pointer">\u00d7</button>'
    + '</div></div>';

  // 🔊 ESCUCHAR LO NUEVO — lo primero si acaba de actualizar. -15 ago-
  h += '<div style="padding:12px 12px 0">'
    + '<button id="asis-btn-novedades" onclick="escucharNovedades()" '
    +   'style="width:100%;padding:13px;background:' + (hayNovedadesSinEscuchar() ? '#F9A825' : '#fff')
    +   ';color:' + (hayNovedadesSinEscuchar() ? '#1a1a1a' : 'var(--nbs-ink)')
    +   ';border:' + (hayNovedadesSinEscuchar() ? 'none' : '1.5px solid #DDD')
    +   ';border-radius:12px;font-size:14px;font-weight:900;cursor:pointer">'
    +   '\ud83d\udd0a ' + (hayNovedadesSinEscuchar() ? 'Escuchar lo nuevo de esta versi\u00f3n' : 'Escuchar lo nuevo otra vez')
    + '</button></div>';

  // Cómo va el día
  h += '<div style="padding:12px 12px 0">'
    + '<div style="background:#fff;border-radius:12px;padding:11px;display:flex;gap:6px">'
    +   _cajaAsis('HOY VENDISTE', '$' + fmtNum(hoy.vendido))
    +   _cajaAsis('COBRASTE', '$' + fmtNum(hoy.cobrado), 'var(--nbs-green-text)')
    +   _cajaAsis('FACTURAS', String(hoy.facturas))
    + '</div></div>';

  // Los avisos
  if(!avisos.length){
    h += '<div style="padding:20px 16px;text-align:center;color:var(--nbs-muted);font-size:13px">'
      + '\u2705 No veo nada que te est\u00e9 costando dinero ahora mismo.</div>';
  } else {
    // 📥 COMO UN CORREO: solo los NUEVOS. Los leídos se van al historial. -15 ago-
    var nuevos = avisos.filter(function(a){ return !estaLeido(a); });
    h += '<div style="padding:12px">';
    if(!nuevos.length){
      h += '<div style="background:var(--nbs-green-bg);border-radius:10px;padding:16px;text-align:center">'
        + '<div style="font-size:24px">\u2705</div>'
        + '<div style="font-size:13px;font-weight:800;color:var(--nbs-green-text);margin-top:5px">'
        +   'Ya viste todo</div>'
        + '<div style="font-size:11px;color:var(--nbs-muted);margin-top:3px">'
        +   'No hay avisos nuevos.</div></div>';
    } else {
      nuevos.forEach(function(a){ h += _tarjetaAviso(a); });
    }
    h += '</div>';

  }

  // 📥 EL HISTORIAL
  var cuantosLeidos = avisosLeidos().length;
  if(cuantosLeidos){
    h += '<div style="padding:0 12px 10px">'
    + '<button onclick="abrirHistorialAvisos()" '
    +   'style="width:100%;padding:11px;background:#F4F4F8;border:1px solid #DDD;'
    +   'color:var(--nbs-muted);border-radius:9px;font-size:12px;font-weight:800;cursor:pointer">'
    +   '\ud83d\udce5 Ver los ' + cuantosLeidos + ' aviso(s) que ya le\u00edste</button></div>';
  }

  if(false){
  }

  // El micrófono
  h += '<div style="padding:0 12px">'
    + '<button id="asis-mic" onclick="hablarleAlAsistente()" '
    +   'style="width:100%;padding:14px;background:#fff;border:2px solid #1a237e;border-radius:13px;'
    +   'font-size:14.5px;font-weight:900;color:#1a237e;cursor:pointer;display:flex;'
    +   'align-items:center;justify-content:center;gap:8px">'
    +   '<span style="font-size:19px">\ud83c\udfa4</span> H\u00e1blame</button>'
    + '<div id="asis-respuesta" style="margin-top:9px"></div>'
    + '<div style="font-size:10.5px;color:var(--nbs-muted);text-align:center;padding:9px 4px 0;line-height:1.5">'
    +   'Prueba: \u201cdos cool care para Luis\u201d \u00b7 \u201c\u00bfcu\u00e1nto me debe Isidro?\u201d<br>'
    +   '\u201c\u00bfqui\u00e9n no viene hace tiempo?\u201d \u00b7 \u201c\u00bfc\u00f3mo me fue hoy?\u201d</div>'
    + '</div>';

  caja.innerHTML = h;
  ov.appendChild(caja);
  document.body.appendChild(ov);

  // 🔊 Y te lo dice en voz alta. Sensei: "pensé que el botón me iba a hablar". -14 ago-
  try { hablarLosAvisos(avisos, hoy); } catch(eVoz){}
}

function verYMarcarLeido(clave, titulo, nivel, icono){
  // 🔑 Sin JSON: los saltos de línea dentro del onclick reventaban el botón y
  // por eso no hacía nada. Se pasan los cuatro datos sueltos. -15 ago-
  try {
    marcarAvisoLeido({ clave: clave || '', titulo: titulo || '',
                       nivel: nivel || '', icono: icono || '' });
    try { abrirAsistente(); } catch(e){}
    try { avisoChico('\u2713 Le\u00eddo \u00b7 est\u00e1 en el historial'); } catch(e){}
  } catch(e){}
}

function clientesQueSeCallaron(){
  var V = _ventasReales();
  var porCli = {};
  V.forEach(function(v){
    var f = parsearFechaVenta(v.fecha);
    if(!f || isNaN(f.getTime())) return;
    var k = String(v.cid);
    if(!porCli[k]) porCli[k] = [];
    porCli[k].push({ t: f.getTime(), monto: parseFloat(v.total) || 0 });
  });
  clientes = LS('ncl', []);
  var res = [];
  Object.keys(porCli).forEach(function(k){
    var lista = porCli[k];
    if(lista.length < 2) return;
    lista.sort(function(a,b){ return a.t - b.t; });
    var suma = 0;
    for(var i = 1; i < lista.length; i++) suma += (lista[i].t - lista[i-1].t) / 86400000;
    var ritmo = suma / (lista.length - 1);
    if(ritmo <= 0) return;
    var desde = Math.floor((Date.now() - lista[lista.length-1].t) / 86400000);
    if(desde <= ritmo * 2 || desde <= 20) return;
    var c = clientes.find(function(x){ return String(x.id) === k; });
    if(!c || c.sinServicio) return;
    res.push({
      cliente: c, ritmo: Math.round(ritmo), diasSinVenir: desde,
      leCompro: Math.round(lista.reduce(function(s,x){ return s + x.monto; }, 0) * 100) / 100,
      veces: lista.length
    });
  });
  res.sort(function(a,b){ return b.leCompro - a.leCompro; });
  return res;
}

// ── 2. LO QUE SE LE ESTÁ ACABANDO ──
// Se mira lo que vendió en los últimos 60 días, no el histórico:
// lo que vendía en marzo no dice nada de lo que necesita hoy.
function loQueSeAcaba(diasAviso){
  var tope = diasAviso || 21;
  var V = _ventasReales();
  var corte = Date.now() - 60 * 86400000;
  var vendido = {};
  V.forEach(function(v){
    var f = parsearFechaVenta(v.fecha);
    if(!f || f.getTime() < corte) return;
    (v.items || []).forEach(function(it){
      if(!it.pid) return;
      var k = String(it.pid);
      vendido[k] = (vendido[k] || 0) + (parseFloat(it.cant) || 0);
    });
  });
  loadProds();
  var res = [];
  productos.forEach(function(p){
    var uds = vendido[String(p.id)] || 0;
    if(uds < 4) return;                       // menos de 2 al mes: no vale avisar
    var alMes = uds / 2;
    var st = parseFloat(p.stock) || 0;
    var dias = alMes > 0 ? Math.floor(st / (alMes / 30)) : 999;
    if(dias > tope) return;
    res.push({ prod: p, stock: st, alMes: Math.round(alMes), diasQueQuedan: Math.max(0, dias) });
  });
  res.sort(function(a,b){ return a.diasQueQuedan - b.diasQueQuedan; });
  return res;
}

// ── 3. LAS DEUDAS VIEJAS ──
function avisosLeidos(){
  try {
    var l = LS(LEIDOS, []);
    return Array.isArray(l) ? l : [];
  } catch(e){ return []; }
}

// Cada aviso se reconoce por su clave + lo que dice, para que si el número
// cambia (de 5 agotados a 7) vuelva a salir como nuevo. -15 ago-
function huellaDeAviso(a){
  return String(a.clave || '') + '|' + String(a.titulo || '').slice(0, 60);
}

function estaLeido(a){
  // \ud83c\udf81 El aviso del premio NO se archiva nunca: se queda hasta que Sensei le de el
  // regalo de verdad. El lo pidio asi: "que salga la alerta hasta que yo lo resetee".
  if(a && a.noSeArchiva) return false;
  var h = huellaDeAviso(a);
  return avisosLeidos().some(function(x){ return x.huella === h; });
}

function analizarNegocio(){
  var avisos = [];

  // \ud83c\udf81 LOS PREMIOS LISTOS VAN PRIMERO Y NO SE PUEDEN ARCHIVAR -3 sep-.
  // Sensei: "que salga la alerta hasta que yo lo resetee". A diferencia de los demas
  // avisos, este NO se quita con "Ya lo vi": se va solo cuando le da el premio de
  // verdad con el boton \ud83c\udf81 de su ficha.
  try {
    var _prem = premiosListos();
    if(_prem.length){
      avisos.push({
        nivel: 'rojo', clave: 'premiosVIP', icono: '\ud83c\udf81',
        noSeArchiva: true,
        titulo: _prem.length === 1
          ? '\u00a1' + _prem[0].cliente + ' gan\u00f3 su premio!'
          : _prem.length + ' clientes tienen premio listo',
        detalle: _prem.slice(0, 4).map(function(x){
          return x.cliente + ' \u00b7 ' + x.grupo + ' (' + x.puntos + ')';
        }).join('\n'),
        datos: _prem
      });
    }
  } catch(e){}

  // Lo que se acabó del todo y es de lo que más vende — lo más urgente
  var acaba = loQueSeAcaba(21);
  var enCero = acaba.filter(function(x){ return x.stock <= 0; });
  if(enCero.length){
    avisos.push({
      nivel: 'rojo', clave: 'agotados', icono: '\ud83d\udce6',
      titulo: enCero.length === 1
        ? 'Se te acab\u00f3 ' + String(enCero[0].prod.nombre).slice(0, 26)
        : 'Se te acabaron ' + enCero.length + ' productos',
      detalle: enCero.slice(0, 3).map(function(x){
        return String(x.prod.nombre).slice(0, 30) + ' \u00b7 vendes ' + x.alMes + ' al mes';
      }).join('\n'),
      datos: enCero
    });
  }
  var porAcabarse = acaba.filter(function(x){ return x.stock > 0; });
  if(porAcabarse.length){
    avisos.push({
      nivel: 'amarillo', clave: 'porAcabarse', icono: '\u23f3',
      titulo: porAcabarse.length + ' producto(s) se te acaban pronto',
      detalle: porAcabarse.slice(0, 3).map(function(x){
        return String(x.prod.nombre).slice(0, 26) + ' \u00b7 te quedan ' + x.stock
             + ' \u00b7 ' + x.diasQueQuedan + ' d\u00edas';
      }).join('\n'),
      datos: porAcabarse
    });
  }

  // Los que se callaron
  var callados = clientesQueSeCallaron();
  if(callados.length){
    var plata = callados.reduce(function(s,x){ return s + x.leCompro; }, 0);
    avisos.push({
      nivel: 'amarillo', clave: 'callados', icono: '\ud83d\udc64',
      titulo: callados.length === 1
        ? nombreCl(callados[0].cliente) + ' no viene hace ' + callados[0].diasSinVenir + ' d\u00edas'
        : callados.length + ' clientes dejaron de venir',
      detalle: callados.slice(0, 3).map(function(x){
        return nombreCl(x.cliente).slice(0, 22) + ' \u00b7 ven\u00eda cada ' + x.ritmo
             + 'd \u00b7 lleva ' + x.diasSinVenir + 'd';
      }).join('\n') + '\nTe compraron $' + fmtNum(plata),
      datos: callados
    });
  }

  // Las deudas viejas
  var deudas = deudasViejas(30);
  if(deudas.length){
    var total = deudas.reduce(function(s,x){ return s + x.debe; }, 0);
    avisos.push({
      nivel: total > 500 ? 'rojo' : 'amarillo', clave: 'deudas', icono: '\ud83d\udcb0',
      titulo: '$' + fmtNum(total) + ' en deudas de m\u00e1s de 30 d\u00edas',
      detalle: deudas.slice(0, 3).map(function(x){
        return nombreCl(x.cliente).slice(0, 22) + ' \u00b7 $' + fmtNum(x.debe)
             + ' \u00b7 hace ' + x.diasMasVieja + 'd';
      }).join('\n'),
      datos: deudas
    });
  }

  // Los que compraron una sola vez
  var unaVez = compraronUnaVez();
  if(unaVez.length >= 5){
    avisos.push({
      nivel: 'azul', clave: 'unaVez', icono: '\ud83c\udfaf',
      titulo: unaVez.length + ' clientes te compraron UNA sola vez',
      detalle: 'Ya te conocen y ya te compraron.\nEs tu dinero m\u00e1s f\u00e1cil.',
      datos: unaVez
    });
  }

  // Productos que casi no dejan
  var flojos = sinGanancia();
  if(flojos.length){
    avisos.push({
      nivel: 'azul', clave: 'sinGanancia', icono: '\ud83d\udcc9',
      titulo: flojos.length + ' producto(s) casi no te dejan ganancia',
      detalle: flojos.slice(0, 3).map(function(x){
        return String(x.prod.nombre).slice(0, 26) + ' \u00b7 ganas $' + fmtNum(x.gana)
             + ' (' + x.pct + '%)';
      }).join('\n'),
      datos: flojos
    });
  }

  // 🎁 LOS PREMIOS QUE SE GANARON Y NO LES HA DADO. -15 ago-
  try {
    var pr = premiosPendientes();
    if(pr.fidelidad.length){
      avisos.push({
        nivel: 'amarillo', clave: 'fidelidad', icono: '\ud83c\udf81',
        titulo: pr.fidelidad.length === 1
          ? pr.fidelidad[0].nombre + ' lleg\u00f3 a los $400'
          : pr.fidelidad.length + ' clientes llegaron a los $400',
        detalle: 'Se ganaron el regalo sorpresa: '
          + pr.fidelidad.slice(0, 4).map(function(x){
              return x.nombre + ' ($' + fmtNum(x.total) + ')'; }).join(' \u00b7 ')
          + (pr.fidelidad.length > 4 ? ' y ' + (pr.fidelidad.length - 4) + ' m\u00e1s' : ''),
        accion: { txt: '\ud83c\udf81 Ver a qui\u00e9nes', fn: 'irACl' }
      });
    }
    if(pr.vip.length){
      avisos.push({
        nivel: 'amarillo', clave: 'vip', icono: '\u2b50',
        titulo: pr.vip.length === 1
          ? pr.vip[0].nombre + ' se gan\u00f3 un producto GRATIS'
          : pr.vip.length + ' clientes se ganaron un producto GRATIS',
        detalle: pr.vip.slice(0, 4).map(function(x){
            return x.nombre + ': ' + String(x.producto).slice(0, 24) + ' (' + x.cant + ')'; }).join(' \u00b7 '),
        accion: { txt: '\u2b50 Ver a qui\u00e9nes', fn: 'irACl' }
      });
    }
    if(pr.cercaFidelidad.length){
      avisos.push({
        nivel: 'azul', clave: 'cercafid', icono: '\ud83d\udcc8',
        titulo: pr.cercaFidelidad.length + ' cliente(s) cerca de los $400',
        detalle: pr.cercaFidelidad.slice(0, 4).map(function(x){
            return x.nombre + ' (le faltan $' + fmtNum(x.falta) + ')'; }).join(' \u00b7 '),
        accion: null
      });
    }
  } catch(ePr){}

  return avisos;
}

// Volver a abrir un barbero ya guardado, por si le quiere agregar algo mas.
// Lo que agregue se guarda como un pedido NUEVO: el que ya guardo no se toca. -14 ago-
function revisionDiaria(){
  var hallazgos = [];
  var r2 = function(x){ return Math.round((x || 0) * 100) / 100; };

  try {
    ventas = LS('nv', []);
    clientes = LS('ncl', []);
    var activas = ventas.filter(function(v){ return !v.cancelada; });

    // ── 1. LA LEY DEL DINERO: vendido = cobrado + por cobrar ──
    var vendido = 0, cobrado = 0, porCobrar = 0;
    activas.forEach(function(v){
      vendido += parseFloat(v.total) || 0;
      var cd = cobradoYDebeDe(v);
      cobrado += cd.cobrado;
      porCobrar += cd.debe;
    });
    var descuadre = r2(vendido - (cobrado + porCobrar));
    if(Math.abs(descuadre) > 0.02){
      hallazgos.push({
        grave: true,
        titulo: 'El dinero no cuadra por $' + fmtNum(Math.abs(descuadre)),
        detalle: 'Vendiste $' + fmtNum(vendido) + ' pero cobrado m\u00e1s por cobrar da $'
                 + fmtNum(cobrado + porCobrar) + '.',
        accion: 'Revisi\u00f3n de Integridad', fn: 'irARevisionIntegridad'
      });
    }

    // ── 2. FACTURAS PAGADAS DE MÁS ──
    var deMas = [];
    activas.forEach(function(v){
      var pg = 0;
      (v.pagosFactura || []).forEach(function(p){ if(!p.esDevolucion) pg += parseFloat(p.monto) || 0; });
      var saldo = r2((parseFloat(v.total) || 0) - pg);
      if(saldo < -0.005) deMas.push({ v: v, sobra: r2(-saldo) });
    });
    if(deMas.length){
      var totalDeMas = r2(deMas.reduce(function(a, x){ return a + x.sobra; }, 0));
      hallazgos.push({
        grave: true,
        titulo: deMas.length + ' factura(s) pagada(s) de M\u00c1S por $' + fmtNum(totalDeMas),
        detalle: deMas.slice(0, 3).map(function(x){
          var cl = clientes.find(function(c){ return String(c.id) === String(x.v.cid); });
          return (cl ? nombreCl(cl) : '?') + ' \u00b7 $' + fmtNum(x.sobra);
        }).join(' \u00b7 '),
        accion: 'Arreglarlas', fn: 'arreglarPagadasDeMas'
      });
    }

    // ── 3. FACTURAS DE CONTADO CON SALDO (el dinero escondido) ──
    var contadoDebe = activas.filter(function(v){
      return v.tipo === 'contado' && cobradoYDebeDe(v).debe > 0.005;
    });
    if(contadoDebe.length){
      var m = r2(contadoDebe.reduce(function(a, v){ return a + cobradoYDebeDe(v).debe; }, 0));
      hallazgos.push({
        grave: false,
        titulo: contadoDebe.length + ' venta(s) de contado que quedaron debiendo $' + fmtNum(m),
        detalle: 'Son ventas al contado que se modificaron despu\u00e9s. Ese dinero SÍ te lo deben.',
        accion: 'Ver en Cuentas por Cobrar', fn: 'irACuentasPorCobrar'
      });
    }

    // ── 4. VENTAS SIN CLIENTE ──
    var huerfanas = activas.filter(function(v){
      if(!v.cid) return false;
      return !clientes.some(function(c){ return String(c.id) === String(v.cid); });
    });
    if(huerfanas.length){
      hallazgos.push({
        grave: true,
        titulo: huerfanas.length + ' factura(s) de un cliente que ya no existe',
        detalle: 'Ese dinero no se le est\u00e1 sumando a nadie.',
        accion: null, fn: null
      });
    }

    // ── 5. PRODUCTOS EN NEGATIVO ──
    loadProds();
    var negativos = productos.filter(function(p){ return (parseFloat(p.stock) || 0) < 0; });
    if(negativos.length >= 5){
      hallazgos.push({
        grave: false,
        titulo: negativos.length + ' productos con existencia en negativo',
        detalle: 'Vendiste m\u00e1s de lo que ten\u00edas apuntado. Conviene hacer inventario.',
        accion: 'Ir al Cat\u00e1logo', fn: 'irACatalogo'
      });
    }

    // ── 6. DEUDAS MUY VIEJAS ──
    try {
      var viejas = deudasViejas(60);
      if(viejas.length){
        var mv = r2(viejas.reduce(function(a, x){ return a + (x.saldo || x.debe || 0); }, 0));
        if(mv > 0.005){
          hallazgos.push({
            grave: false,
            titulo: '$' + fmtNum(mv) + ' en deudas de m\u00e1s de 60 d\u00edas',
            detalle: viejas.length + ' cliente(s). Mientras m\u00e1s viejo, m\u00e1s cuesta cobrarlo.',
            accion: 'Ver a qui\u00e9nes', fn: 'irACuentasPorCobrar'
          });
        }
      }
    } catch(e){}

    // ═══════════════════════════════════════════════════════════════
    //  🔔 LO QUE VIGILA EL LADO DE LAS COMPRAS  (27 ago 2026)
    //
    //  Sensei preguntó si se puede garantizar que la app está 100% bien. La
    //  respuesta honesta es que no existe tal garantía para NINGÚN programa.
    //  Lo que sí se puede es que ningún descuadre viva escondido: que la app
    //  se revise sola y avise el mismo día.
    //
    //  La revisión que había miraba solo las VENTAS. Estas cuatro miran el
    //  lado de las COMPRAS, que es donde vive el código más nuevo.
    // ═══════════════════════════════════════════════════════════════

    // ── 7. UN PAGO A SUPLIDOR MAYOR QUE SU FACTURA ──
    // Es el fallo que dejaría la coma del dinero si algún sitio leyera mal:
    // un número cortado o inflado salta aquí en cuanto pasa.
    try {
      var comprasV = LS('nc', []);
      var pagadasDeMas = [];
      comprasV.forEach(function(c){
        var total = parseFloat(c.total) || 0;
        var pagado = (c.pagosFactura || []).reduce(function(a, p){
          return a + (typeof p.monto === 'number' ? p.monto : 0);
        }, 0);
        if(pagado > total + 0.05){
          pagadasDeMas.push({ sn: c.sn || 'suplidor', fecha: c.fecha || '', de: r2(pagado - total) });
        }
      });
      if(pagadasDeMas.length){
        var deMas = r2(pagadasDeMas.reduce(function(a, x){ return a + x.de; }, 0));
        hallazgos.push({
          grave: true,
          titulo: '$' + fmtNum(deMas) + ' pagado de más a suplidores',
          detalle: pagadasDeMas.length + ' factura(s) con más pagos que su total. '
            + 'La primera: ' + pagadasDeMas[0].sn + ', ' + pagadasDeMas[0].fecha + '.',
          accion: 'Ver suplidores', fn: 'irASuplidores'
        });
      }
    } catch(e){}

    // ── 8. LA CUENTA DE LO QUE DEBES A SUPLIDORES ──
    // Se calcula de dos formas distintas y tienen que dar lo mismo. Si no,
    // hay un pago o una factura que no está sumando donde debe.
    try {
      var comprasD = LS('nc', []);
      var porFactura = 0, totalC = 0, pagadoC = 0;
      comprasD.forEach(function(c){
        var t = parseFloat(c.total) || 0;
        var pg = (c.pagosFactura || []).reduce(function(a, p){
          return a + (typeof p.monto === 'number' ? p.monto : 0);
        }, 0);
        totalC += t;
        pagadoC += pg;
        var saldo = t - pg;
        if(saldo > 0.005) porFactura += saldo;
      });
      var porResta = totalC - pagadoC;
      // Solo cuadran si NINGUNA está pagada de más; si alguna lo está, el aviso 7
      // ya lo dijo y este no debe repetirlo.
      var hayPagadaDeMas = comprasD.some(function(c){
        var t = parseFloat(c.total) || 0;
        var pg = (c.pagosFactura || []).reduce(function(a, p){
          return a + (typeof p.monto === 'number' ? p.monto : 0);
        }, 0);
        return pg > t + 0.05;
      });
      if(!hayPagadaDeMas && Math.abs(r2(porFactura) - r2(porResta)) > 0.05){
        hallazgos.push({
          grave: true,
          titulo: 'Lo que debes a suplidores no cuadra',
          detalle: 'Sumando factura por factura da $' + fmtNum(porFactura)
            + ', pero por la resta da $' + fmtNum(porResta) + '.',
          accion: 'Ver suplidores', fn: 'irASuplidores'
        });
      }
    } catch(e){}

    // ── 9. PRODUCTOS EN $0.00 ──
    // Si uno se cuela sin precio, se regala en la próxima venta.
    try {
      var sinPrecio = (typeof productosSinPrecio === 'function') ? productosSinPrecio() : [];
      if(sinPrecio.length){
        hallazgos.push({
          grave: true,
          titulo: sinPrecio.length + ' producto(s) sin precio de venta',
          detalle: 'Si los vendes así, salen GRATIS. El primero: ' + (sinPrecio[0].nombre || '') + '.',
          accion: 'Ponerles precio', fn: 'irACatalogo'
        });
      }
    } catch(e){}

    // ── 10. COMPRAS DONDE LOS PRODUCTOS NO SUMAN EL TOTAL ──
    // Contando el envío y el cargo por tarjeta que suman, y los descuentos que restan.
    try {
      var comprasS = LS('nc', []);
      var descuadradas = [];
      comprasS.forEach(function(c){
        var suma = (c.items || []).reduce(function(a, it){
          var q = Number(it.cant); if(!isFinite(q) || q <= 0) q = 1;
          var co = Number(it.costo); if(!isFinite(co) || co < 0) co = 0;
          return a + q * co;
        }, 0);
        var desc = (c.descuentos || []).reduce(function(a, d){ return a + (parseFloat(d.monto) || 0); }, 0);
        var esperado = suma + (parseFloat(c.envio) || 0) + (parseFloat(c.cargoTarjeta) || 0) - desc;
        if(Math.abs(r2(esperado) - r2(parseFloat(c.total) || 0)) > 0.05){
          descuadradas.push({ sn: c.sn || 'suplidor', fecha: c.fecha || '' });
        }
      });
      if(descuadradas.length){
        hallazgos.push({
          grave: false,
          titulo: descuadradas.length + ' compra(s) donde los productos no suman el total',
          detalle: 'La primera: ' + descuadradas[0].sn + ', ' + descuadradas[0].fecha
            + '. Puede ser un costo mal escrito o un descuento sin apuntar.',
          accion: 'Ver suplidores', fn: 'irASuplidores'
        });
      }
    } catch(e){}

  } catch(e){
    return { error: String(e).slice(0, 90), hallazgos: [] };
  }

  return { hallazgos: hallazgos, cuando: fechaHoy() };
}

// Corre una vez al día. Si todo cuadra, NO molesta. -15 ago-
function _clienteMencionado(q){
  var cls = LS('ncl', []);
  var lq = ' ' + _limpiar(q) + ' ';
  var mejor = null, puntos = 0;
  // ⚠️ Se busca por PALABRAS, no por el nombre entero: el cliente es
  // "Luis A. Medina" y él dice "Luis Medina" — la inicial rompía todo. -17 ago-
  cls.forEach(function(c){
    var p = 0;
    [c.nombre, c.apellido, c.apodo, c.negocio].forEach(function(campo){
      if(!campo) return;
      _limpiar(campo).split(' ').forEach(function(w){
        if(w.length < 3) return;               // "a", "de", "la" no cuentan
        if(lq.indexOf(' ' + w + ' ') >= 0) p += (w.length > 5 ? 3 : 2);
      });
    });
    if(p > puntos){ puntos = p; mejor = c; }
  });
  // Hace falta al menos una palabra buena, para no confundirse
  return puntos >= 2 ? mejor : null;
}

// ── Buscar un producto dentro de lo que dijo ──
function _productoMencionado(q){
  loadProds();
  var lq = _limpiar(q);
  var mejor = null, largo = 0;
  productos.forEach(function(p){
    var lp = _limpiar(p.nombre);
    // Por palabras, para que "cuanto tengo de cool care" encuentre el producto
    var pal = lp.split(' ').filter(function(x){ return x.length > 3; });
    var cuantas = pal.filter(function(x){ return lq.indexOf(x) >= 0; }).length;
    if(cuantas >= 2 && cuantas > largo){ mejor = p; largo = cuantas; }
    else if(lq.indexOf(lp) >= 0 && lp.length > largo){ mejor = p; largo = lp.length; }
  });
  return mejor;
}

// ═══════════════════════════════════════════════════════════════════
//  LAS RESPUESTAS — todas salen de SUS datos reales
// ═══════════════════════════════════════════════════════════════════
function avisoGrande(msg, alDarOK){
  _colaAvisos.push({ m: String(msg), cb: alDarOK || null });
  if(!_avisoActivo) mostrarSiguienteAviso();
}