
function leerTextoFacturaCompra(){
  var foto = document.getElementById('cc-foto-data').value;
  if(!foto){
    avisoGrande('📷 Primero toma o escoge la foto de la factura del suplidor.\n\nDespués toca este botón y te saco el texto que se lea en ella.');
    return;
  }
  var btn = document.getElementById('cc-btn-ocr');
  var resultadoDiv = document.getElementById('cc-ocr-resultado');
  var textoArea = document.getElementById('cc-ocr-texto');

  function restaurarBoton(){
    btn.disabled = false;
    btn.textContent = '🔍 Leer el texto de la foto -para copiar y pegar más rápido';
  }

  btn.disabled = true;
  btn.textContent = '⏳ Preparando la foto y leyendo el texto -puede tardar unos segundos...';

  cargarLibreriaOCR(function(exito){
    if(!exito){ restaurarBoton(); return; }
    prepararFotoParaOCR(foto, function(fotoPreparada){
      Tesseract.recognize(fotoPreparada, 'eng')
        .then(function(resultado){
          textoArea.value = resultado.data.text.trim() || '-No se reconoció texto en esta foto. Intenta recortarla más de cerca, solo al texto, con buena luz y sin sombras.-';
          resultadoDiv.style.display = 'block';
        })
        .catch(function(err){
          alert('No se pudo leer el texto de esta foto. Intenta con otra foto más clara.');
          console.error(err);
        })
        .finally(restaurarBoton);
    });
  });
}

function cargarFotoEditCompra(input){
  var file = input.files[0];
  if(!file) return;
  if(!esFotoValida(file)){ input.value = ''; return; }
  var reader = new FileReader();
  reader.onload = function(e){
    abrirRecortarFoto(e.target.result, function(dataFinal){
      document.getElementById('compra-edit-foto-data').value = dataFinal;
      var prev = document.getElementById('compra-edit-foto-preview');
      prev.innerHTML = '<img src="'+dataFinal+'" style="width:100%;height:100%;object-fit:cover">';
      prev.style.background = '#f0f0f0';
      prev.style.border = 'none';
    }, 1800); // alta resolucion, para poder leer los numeros de la factura despues
  };
  reader.readAsDataURL(file);
  input.value = '';
}

function agregarBalanceInicialSuplidor(id){
  suplidores = LS('nsup', []);
  var s = suplidores.find(function(x){ return String(x.id) === String(id); });
  if(!s) return;

  var el = document.getElementById('sup-perfil-contenido');
  el.innerHTML = '';

  var back = document.createElement('button');
  back.className = 'back';
  back.textContent = '← Volver al perfil';
  back.onclick = function(){ verSup(id); };
  el.appendChild(back);

  var form = document.createElement('div');
  form.className = 'card';
  form.innerHTML = '<p style="font-size:15px;font-weight:700;margin-bottom:4px">💰 Balance inicial</p>'
    +'<p style="font-size:12px;color:#aaa;margin-bottom:14px">Se creará una compra a crédito con este balance. Aparecerá en Cuentas por Pagar.</p>'
    +'<div style="background:#EDE7F6;border-radius:8px;padding:10px;margin-bottom:12px">'
    +'<div style="font-size:13px;font-weight:600;color:#6A1B9A">Suplidor: '+escaparHtml(s.nombre)+'</div>'
    +'</div>'
    +'<label class="lbl">Monto del balance pendiente ($) *</label>'
    +'<input class="inp" id="bis-monto" type="text" inputmode="numeric" value="0.00" onfocus="this.select()" oninput="formatoMoneda(this)">'
    +'<label class="lbl">Descripción</label>'
    +'<input class="inp" id="bis-nota" type="text" value="Balance inicial traído de sistema anterior" placeholder="Descripción del balance">'
    +'<label class="lbl">Fecha</label>'
    +'<input class="inp" id="bis-fecha" type="date" lang="en-US">'
    +'<button class="btn" style="background:#6A1B9A;color:white" onclick="guardarBalanceInicialSuplidor('+id+')">✓ Registrar balance inicial</button>';
  el.appendChild(form);

  document.getElementById('bis-fecha').value = fechaHoyISO();
}

function guardarBalanceInicialSuplidor(id){
  suplidores = LS('nsup', []);
  var s = suplidores.find(function(x){ return String(x.id) === String(id); });
  if(!s) return;

  var monto = dinero(document.getElementById('bis-monto').value) || 0;
  if(monto <= 0){ alert('Ingresa un monto válido mayor a $0.00'); return; }

  var nota = limpiarTexto(document.getElementById('bis-nota').value.trim()) || 'Balance inicial traído de sistema anterior';
  var fecha = document.getElementById('bis-fecha').value || fechaHoyISO();
  var fechaFmt = fechaFormat(new Date(fecha+'T12:00:00'));

  // -confirmacion redundante quitada, el boton de Guardar ya es la confirmacion-

  compras = LS('nc', []);
  compras.push({
    id: Date.now(),
    sid: s.id,
    sn: s.nombre,
    tipo: 'credito',
    items: [{ pid: null, nombre: nota, cant: 1, costo: monto }],
    total: monto,
    fecha: fechaFmt,
    hora: '12:00 p.m.',
    pagosFactura: [],
    esBalanceInicial: true
  });
  SS('nc', compras);

  alert('✅ Balance inicial de $'+fmtNum(monto)+' registrado correctamente.\nAparece en Cuentas por Pagar.');
  verSup(id);
}

function editarSuplidor(id){
  suplidores = LS('nsup', []);
  var s = suplidores.find(function(x){ return String(x.id)===String(id); });
  if(!s) return;

  var overlay = document.getElementById('sup-edit-overlay');
  if(!overlay){
    overlay = document.createElement('div');
    overlay.id = 'sup-edit-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:white;z-index:99999;overflow-y:auto;padding:16px';
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = '';

  var wrap = document.createElement('div');
  wrap.style.cssText = 'max-width:480px;margin:0 auto';

  var header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;gap:12px;margin-bottom:16px';
  var btnBack = document.createElement('button');
  btnBack.textContent = '←';
  btnBack.style.cssText = 'background:#E8EAF6;border:none;border-radius:8px;padding:10px 14px;cursor:pointer;font-size:14px;font-weight:700;color:#1a237e';
  btnBack.onclick = function(){ overlay.style.display='none'; };
  var titulo = document.createElement('div');
  titulo.style.cssText = 'font-size:17px;font-weight:800;color:#1a237e';
  titulo.textContent = '✏️ Editar Suplidor';
  var iconoNBS1 = document.createElement('img');
  iconoNBS1.src = 'icon-512.png';
  iconoNBS1.style.cssText = 'width:32px;height:32px;margin-left:auto;border-radius:8px;cursor:pointer';
  iconoNBS1.alt = 'NBS';
  iconoNBS1.onclick = function(){ overlay.style.display='none'; ir('p-inicio'); };
  header.appendChild(btnBack);
  header.appendChild(titulo);
  header.appendChild(iconoNBS1);
  wrap.appendChild(header);

  var campos = [
    {label:'Nombre de la empresa *', id:'esup-n', value:s.nombre||''},
    {label:'Persona de contacto', id:'esup-ct', value:s.contacto||''},
    {label:'Teléfono empresa', id:'esup-tel', value:s.tel||''},
    {label:'Teléfono contacto', id:'esup-telc', value:s.telContacto||''},
    {label:'Email', id:'esup-em', value:s.email||''},
    {label:'Dirección', id:'esup-dir', value:s.dir||''},
    {label:'Ciudad', id:'esup-ciu', value:s.ciudad||''},
    {label:'ZIP', id:'esup-zip', value:s.zip||''},
  ];

  campos.forEach(function(c){
    var lbl = document.createElement('label');
    lbl.className = 'lbl';
    lbl.textContent = c.label;
    var inp = document.createElement('input');
    inp.className = 'inp';
    inp.id = c.id;
    inp.type = 'text';
    inp.value = c.value;
    wrap.appendChild(lbl);
    wrap.appendChild(inp);
  });

  // Notas
  var lblNotas = document.createElement('label');
  lblNotas.className = 'lbl';
  lblNotas.textContent = 'Notas';
  var txtNotas = document.createElement('textarea');
  txtNotas.className = 'inp';
  txtNotas.id = 'esup-notas';
  txtNotas.rows = 3;
  txtNotas.style.resize = 'vertical';
  txtNotas.value = s.notas||'';
  wrap.appendChild(lblNotas);
  wrap.appendChild(txtNotas);

  var btnGuardar = document.createElement('button');
  btnGuardar.className = 'btn';
  btnGuardar.style.cssText = 'background:#2E7D32;color:white;margin-top:8px';
  btnGuardar.textContent = '✅ Guardar cambios';
  btnGuardar.onclick = (function(sid){ return function(){
    suplidores = LS('nsup',[]);
    var idx = suplidores.findIndex(function(x){ return String(x.id)===String(sid); });
    if(idx<0) return;
    var n = document.getElementById('esup-n').value.trim();
    if(!n){ alert('El nombre es requerido'); return; }
    suplidores[idx].nombre = n;
    suplidores[idx].contacto = document.getElementById('esup-ct').value.trim();
    suplidores[idx].tel = document.getElementById('esup-tel').value.trim();
    suplidores[idx].telContacto = document.getElementById('esup-telc').value.trim();
    suplidores[idx].email = document.getElementById('esup-em').value.trim();
    suplidores[idx].dir = document.getElementById('esup-dir').value.trim();
    suplidores[idx].ciudad = document.getElementById('esup-ciu').value.trim();
    suplidores[idx].zip = document.getElementById('esup-zip').value.trim();
    suplidores[idx].notas = document.getElementById('esup-notas').value.trim();
    SS('nsup', suplidores);
    overlay.style.display='none';
    verSup(sid);
    alert('✅ Suplidor actualizado');
  }; })(id);
  wrap.appendChild(btnGuardar);

  overlay.appendChild(wrap);
  overlay.style.display='block'; overlay.scrollTop = 0;
}

// ═══════════════════════════════════════════════════════════════════
//  🏪 EL PERFIL DEL SUPLIDOR — como la ficha del cliente  (21 ago 2026)
//
//  Sensei: "¿deberían los suplidores tener más o menos su perfil parecido al de
//  los clientes?". Si: los datos YA estaban guardados -persona de contacto, dos
//  telefonos, email, direccion, notas- pero solo se veian entrando a Editar.
//
//  Se copian los renglones desplegables del cliente, con lo que aplica a un
//  suplidor. NO se traen VIP, premios, fidelidad, visitas ni "lo que te deja":
//  eso es de vender, no de comprar.
// ═══════════════════════════════════════════════════════════════════

var _panelSupAbierto = null;

function panelesDelSuplidor(id, s, comprasDelSup){
  var h = '';
  var _esc = function(x){ return escaparHtml(String(x || '')); };

  // ── 📇 SUS DATOS ──
  var telLimpio = String(s.tel || '').replace(/[^0-9]/g, '');
  var telCLimpio = String(s.telContacto || '').replace(/[^0-9]/g, '');
  var dirCompleta = [s.dir, s.ciudad, s.zip].filter(function(x){ return String(x || '').trim(); }).join(', ');
  var dato = function(rotulo, valor){
    return '<div style="display:flex;justify-content:space-between;gap:10px;padding:5px 0;border-bottom:1px solid #F0F0F3">'
      + '<span style="font-size:11.5px;color:var(--nbs-muted);font-weight:700;flex-shrink:0">' + rotulo + '</span>'
      + '<span style="font-size:12.5px;color:var(--nbs-ink);font-weight:600;text-align:right">' + (_esc(valor) || '—') + '</span></div>';
  };
  var cont = dato('Contacto', s.contacto)
    + dato('Tel. empresa', s.tel)
    + dato('Tel. contacto', s.telContacto)
    + dato('Email', s.email)
    + dato('Dirección', dirCompleta);
  var acciones = '';
  if(telLimpio || telCLimpio){
    var elTel = telLimpio || telCLimpio;
    acciones += '<a href="tel:' + elTel + '" style="flex:1;text-align:center;padding:9px;background:#E8F5E9;color:#2E7D32;'
      + 'border-radius:9px;font-size:12px;font-weight:800;text-decoration:none">📞 Llamar</a>';
    // Por el camino bueno, para que abra el WhatsApp BUSINESS en Android. -30 ago-
    acciones += '<a href="' + _linkWhatsApp(elTel) + '" target="_blank" '
      + 'style="flex:1;text-align:center;padding:9px;background:#E8F5E9;color:#128C7E;border-radius:9px;font-size:12px;font-weight:800;text-decoration:none">💬 WhatsApp</a>';
  }
  if(dirCompleta){
    acciones += '<a href="https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(dirCompleta) + '" target="_blank" '
      + 'style="flex:1;text-align:center;padding:9px;background:#E3F2FD;color:#1565C0;border-radius:9px;font-size:12px;font-weight:800;text-decoration:none">🗺️ Mapa</a>';
  }
  if(acciones) cont += '<div style="display:flex;gap:6px;margin-top:9px">' + acciones + '</div>';
  h += _filaSup('datos', '📇', 'Sus datos', (s.tel || s.telContacto || s.contacto || '—'), cont, id);

  // ── 💵 MIS PAGOS ── el record de todo lo que le he pagado, cada uno con su lapiz
  var pagos = [];
  comprasDelSup.forEach(function(c){
    (c.pagosFactura || []).forEach(function(p, i){
      if(typeof p.monto !== 'number') return;
      pagos.push({ compra: c, idx: i, pago: p });
    });
  });
  pagos.sort(function(a, b){
    var fa = parsearFechaVenta(a.pago.fecha), fb = parsearFechaVenta(b.pago.fecha);
    return (fb ? fb.getTime() : 0) - (fa ? fa.getTime() : 0);
  });
  var totalPagos = pagos.reduce(function(a, x){ return a + x.pago.monto; }, 0);
  var contPagos = pagos.length
    ? pagos.slice(0, 40).map(function(x){
        return '<div onclick="abrirEditorPagoCompra(' + _arg(x.compra.id) + ',' + x.idx + ',' + _arg(id) + ')" '
          + 'style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:7px 0;'
          + 'border-bottom:1px solid #F0F0F3;cursor:pointer">'
          + '<span style="font-size:12px;color:var(--nbs-muted);flex:1;min-width:0">' + _esc(x.pago.fecha)
          +   (x.pago.metodo ? ' · ' + etiquetaMetodoCompra(x.pago.metodo) : '') + '</span>'
          + '<span style="font-size:13px;font-weight:800;color:#2E7D32;flex-shrink:0">$' + fmtNum(x.pago.monto) + '</span>'
          + '<span style="flex-shrink:0;font-size:12px">✏️</span></div>';
      }).join('')
    : '<div style="font-size:12px;color:var(--nbs-muted)">Todavía no le has pagado nada.</div>';
  h += _filaSup('pagos', '💵', 'Mis pagos', pagos.length + ' · $' + fmtNum(totalPagos), contPagos, id);

  // ── 📦 LO QUE MÁS LE COMPRO ──
  var porProd = {};
  comprasDelSup.forEach(function(c){
    (c.items || []).forEach(function(it){
      var clave = it.pid ? String(it.pid) : ('n:' + String(it.nombre || ''));
      if(!porProd[clave]) porProd[clave] = { nombre: it.nombre || '', unid: 0, gastado: 0 };
      var q = Number(it.cant); if(!isFinite(q) || q <= 0) q = 1;
      var co = Number(it.costo); if(!isFinite(co) || co < 0) co = 0;
      porProd[clave].unid += q;
      porProd[clave].gastado += q * co;
    });
  });
  var lista = Object.keys(porProd).map(function(k){ return porProd[k]; })
    .sort(function(a, b){ return b.gastado - a.gastado; });
  var contTop = lista.length
    ? lista.slice(0, 15).map(function(x){
        return '<div style="display:flex;justify-content:space-between;gap:10px;padding:5px 0;border-bottom:1px solid #F0F0F3">'
          + '<span style="font-size:12px;color:var(--nbs-ink);flex:1;min-width:0">' + _esc(x.nombre) + '</span>'
          + '<span style="font-size:11.5px;color:var(--nbs-muted);flex-shrink:0">' + x.unid + ' unid · $' + fmtNum(x.gastado) + '</span></div>';
      }).join('')
    : '<div style="font-size:12px;color:var(--nbs-muted)">Todavía no le has comprado nada.</div>';
  h += _filaSup('top', '📦', 'Lo que más le compro', lista.length + ' productos', contTop, id);

  // ── 💲 HISTORIAL DE COSTOS ──
  h += _filaSup('costos', '💲', 'Historial de costos', '',
    '<div style="font-size:12px;color:var(--nbs-muted);margin-bottom:8px">Cómo te ha ido cambiando el costo de cada producto que le compras.</div>'
    + '<button onclick="event.stopPropagation();verHistorialCostoSuplidor(' + _arg(id) + ')" '
    + 'style="width:100%;padding:10px;background:#5D4037;color:#fff;border:none;border-radius:9px;font-size:12.5px;font-weight:800;cursor:pointer">Ver el historial de costos</button>', id);

  // ── 📅 CADA CUÁNTO LE COMPRO ──
  var fechas = [];
  comprasDelSup.forEach(function(c){
    var f = parsearFechaVenta(c.fecha);
    if(f && !isNaN(f.getTime())) fechas.push(f.getTime());
  });
  fechas.sort(function(a, b){ return a - b; });
  var cada = null, diasDesde = null;
  if(fechas.length >= 2){
    var huecos = [];
    for(var i = 1; i < fechas.length; i++) huecos.push((fechas[i] - fechas[i-1]) / 86400000);
    huecos.sort(function(a, b){ return a - b; });
    cada = Math.round(huecos[Math.floor(huecos.length / 2)]);
  }
  if(fechas.length) diasDesde = Math.floor((Date.now() - fechas[fechas.length - 1]) / 86400000);
  var contRitmo = '<div style="font-size:12.5px;color:var(--nbs-ink);line-height:1.8">'
    + 'Le has hecho <b>' + comprasDelSup.length + '</b> compra(s).<br>'
    + (cada !== null ? 'Le compras cada <b>' + cada + ' días</b> más o menos.<br>' : '')
    + (diasDesde !== null ? 'La última fue hace <b>' + diasDesde + ' día(s)</b>.' : 'Sin compras todavía.')
    + '</div>';
  h += _filaSup('ritmo', '📅', 'Cada cuánto le compro', (cada !== null ? cada + ' días' : '—'), contRitmo, id);

  // ── 💳 CÓMO LE SUELO PAGAR ──
  var porMetodo = {};
  pagos.forEach(function(x){
    var m = x.pago.metodo || 'sin apuntar';
    if(!porMetodo[m]) porMetodo[m] = { veces: 0, monto: 0 };
    porMetodo[m].veces++;
    porMetodo[m].monto += x.pago.monto;
  });
  var metodos = Object.keys(porMetodo).sort(function(a, b){ return porMetodo[b].monto - porMetodo[a].monto; });
  var contMet = metodos.length
    ? metodos.map(function(m){
        return '<div style="display:flex;justify-content:space-between;gap:10px;padding:5px 0;border-bottom:1px solid #F0F0F3">'
          + '<span style="font-size:12.5px;color:var(--nbs-ink)">' + (m === 'sin apuntar' ? 'Sin apuntar' : etiquetaMetodoCompra(m)) + '</span>'
          + '<span style="font-size:12px;color:var(--nbs-muted)">' + porMetodo[m].veces + ' vez/veces · $' + fmtNum(porMetodo[m].monto) + '</span></div>';
      }).join('')
    : '<div style="font-size:12px;color:var(--nbs-muted)">Todavía no le has pagado nada.</div>';
  h += _filaSup('comopago', '💳', 'Cómo le suelo pagar',
    (metodos.length ? (metodos[0] === 'sin apuntar' ? 'Sin apuntar' : etiquetaMetodoCompra(metodos[0])) : '—'), contMet, id);

  // ── 📝 NOTAS ──
  h += _filaSup('notas', '📝', 'Notas', (String(s.notas || '').trim() ? 'sí' : 'ninguna'),
    '<div style="font-size:12.5px;color:var(--nbs-ink);white-space:pre-wrap;line-height:1.6">'
    + (String(s.notas || '').trim() ? _esc(s.notas) : '<span style="color:var(--nbs-muted)">Sin notas. Se escriben en Editar suplidor.</span>')
    + '</div>', id);

  // ── ⚙️ AJUSTES ── (los botones que antes estaban sueltos arriba)
  h += _filaSup('ajustes', '⚙️', 'Ajustes', '',
    '<button class="btn" style="background:#1565C0;color:white;margin-bottom:7px" onclick="event.stopPropagation();editarSuplidor(' + _arg(id) + ')">✏️ Editar suplidor</button>'
    + '<button class="btn" style="background:#6A1B9A;color:white;margin-bottom:7px" onclick="event.stopPropagation();agregarBalanceInicialSuplidor(' + _arg(id) + ')">💰 Agregar balance inicial</button>'
    + '<button class="btn" style="background:#D32F2F;color:white;margin:0" onclick="event.stopPropagation();eliminarSup(' + _arg(id) + ')">🗑️ Eliminar suplidor</button>', id);

  return h;
}

function verFacturaCompra(c, sid){
  var el = document.getElementById('sup-perfil-contenido');
  el.innerHTML = '';

  var pagado = c.pagosFactura ? (c.pagosFactura || []).filter(function(p){return typeof p.monto==='number';}).reduce(function(s,p){return s+p.monto;},0) : 0;
  var saldo = Math.max(0, c.total-pagado);

  var back = document.createElement('button');
  back.className = 'back';
  back.textContent = '← Volver al suplidor';
  back.onclick = function(){ verSup(sid); };
  el.appendChild(back);

  var header = document.createElement('div');
  header.className = 'card';
  header.innerHTML = '<div style="font-size:18px;font-weight:700;margin-bottom:4px">Factura de compra</div>'
    +'<div style="font-size:13px;color:#aaa;margin-bottom:14px">'+c.fecha+' a las '+c.hora+'</div>'
    +'<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f0f0f0">'
    +'<span style="color:#777">Suplidor</span><span style="font-weight:600">'+c.sn+'</span></div>'
    +'<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f0f0f0">'
    +'<span style="color:#777">Tipo de pago</span><span style="font-size:13px;padding:3px 9px;border-radius:10px;font-weight:500;'+(c.tipo==='credito'?'background:#FFF8E1;color:#E65100':'background:#E8F5E9;color:#2E7D32')+'">'+(c.tipo==='credito'?'a credito':'contado')+'</span></div>'
    +'<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f0f0f0">'
    +'<span style="color:#777">Total factura</span><span style="font-weight:700;font-size:18px;color:#1565C0">$'+fmtNum(c.total)+'</span></div>'
    +(c.tipo==='credito' ?
      '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f0f0f0">'
      +'<span style="color:#777">Total pagado</span><span style="font-weight:700;color:#2E7D32">$'+fmtNum(pagado)+'</span></div>'
      +'<div style="display:flex;justify-content:space-between;padding:8px 0">'
      +'<span style="color:#777">Saldo pendiente</span><span style="font-weight:700;color:'+(esSaldoPendiente(saldo)?'#C62828':'#2E7D32')+'">$'+fmtNum(saldo)+'</span></div>'
      : '');
  el.appendChild(header);

  // 📄 Las hojas de la factura -20 sep-. Las compras nuevas guardan varias en c.fotos;
  //    las viejas tienen una sola en c.foto. Se muestran todas las que haya.
  var hojasCompra = (c.fotos && c.fotos.length) ? c.fotos : (c.foto ? [c.foto] : []);
  if(hojasCompra.length){
    var fotoCard = document.createElement('div');
    fotoCard.className = 'card';
    fotoCard.innerHTML = '<div style="font-size:13px;font-weight:700;color:#5D4037;margin-bottom:8px">📷 FACTURA'
      + (hojasCompra.length > 1 ? ' ('+hojasCompra.length+' hojas)' : '') + '</div>';
    var filaH = document.createElement('div');
    filaH.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap';
    hojasCompra.forEach(function(dataUrl, i){
      var th = document.createElement('div');
      th.style.cssText = 'width:110px;height:110px;border-radius:8px;overflow:hidden;cursor:pointer;background:#f0f0f0;position:relative';
      th.innerHTML = '<img src="'+dataUrl+'" style="width:100%;height:100%;object-fit:cover">'
        + (hojasCompra.length > 1 ? '<span style="position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,.55);color:#fff;font-size:10px;font-weight:800;text-align:center;line-height:16px">Hoja '+(i+1)+'</span>' : '');
      th.onclick = (function(u){ return function(){ verFotoGasto(u); }; })(dataUrl);
      filaH.appendChild(th);
    });
    fotoCard.appendChild(filaH);
    el.appendChild(fotoCard);
  }

  var prodCard = document.createElement('div');
  prodCard.className = 'card';
  prodCard.innerHTML = '<div style="font-size:13px;font-weight:700;color:#5D4037;margin-bottom:10px">PRODUCTOS</div>';
  (c.items || []).forEach(function(it){
    var cantSegura = Number(it.cant); if(!isFinite(cantSegura) || cantSegura <= 0) cantSegura = 1;
    var costoSeguro = Number(it.costo); if(!isFinite(costoSeguro) || costoSeguro < 0) costoSeguro = 0;
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f0f0f0;font-size:13px';
    row.innerHTML = '<div><div style="font-weight:600">'+(it.nombre||'Producto sin nombre')+(it.esNuevo?' <span style="color:#795548;font-size:11px">(nuevo)</span>':'')+'</div>'
      +'<div style="color:#aaa;font-size:11px">x'+cantSegura+' @ $'+fmtNum(costoSeguro)+'</div></div>'
      +'<span style="font-weight:700;color:#5D4037">$'+fmtNum((cantSegura*costoSeguro))+'</span>';
    prodCard.appendChild(row);
  });
  // Lo que no son productos pero SI son parte del total: envio y tarjeta suman, descuentos restan.
  var sumaProd = (c.items || []).reduce(function(a,it){
    var q = Number(it.cant); if(!isFinite(q) || q <= 0) q = 1;
    var co = Number(it.costo); if(!isFinite(co) || co < 0) co = 0;
    return a + q * co;
  }, 0);
  var hayExtras = (c.envio > 0) || (c.cargoTarjeta > 0) || ((c.descuentos || []).length > 0);
  if(hayExtras){
    var extra = document.createElement('div');
    extra.style.cssText = 'margin-top:8px;padding-top:8px;border-top:1px solid #e0e0e0';
    var filas = '<div style="display:flex;justify-content:space-between;font-size:12px;color:#777;margin-bottom:4px">'
              + '<span>Productos</span><span>$' + fmtNum(sumaProd) + '</span></div>';
    if(c.envio > 0) filas += '<div style="display:flex;justify-content:space-between;font-size:12px;color:#777;margin-bottom:4px"><span>\ud83d\ude9a Envío</span><span>$' + fmtNum(c.envio) + '</span></div>';
    if(c.cargoTarjeta > 0) filas += '<div style="display:flex;justify-content:space-between;font-size:12px;color:#777;margin-bottom:4px"><span>\ud83d\udcb3 Cargo por tarjeta</span><span>$' + fmtNum(c.cargoTarjeta) + '</span></div>';
    (c.descuentos || []).forEach(function(d){
      filas += '<div style="display:flex;justify-content:space-between;font-size:12px;color:#C62828;font-weight:700;margin-bottom:4px">'
             + '<span>\ud83d\udcb8 ' + String(d.desc||'Descuento').replace(/[<>&"]/g,'') + '</span>'
             + '<span>\u2212$' + fmtNum(d.monto||0) + '</span></div>';
    });
    filas += '<div style="display:flex;justify-content:space-between;font-size:14px;font-weight:800;color:#5D4037;border-top:1px solid #e0e0e0;padding-top:6px;margin-top:2px">'
           + '<span>TOTAL</span><span>$' + fmtNum(c.total||0) + '</span></div>';
    extra.innerHTML = filas;
    prodCard.appendChild(extra);
  }
  el.appendChild(prodCard);

  if(c.pagosFactura && (c.pagosFactura || []).length){
    var pagCard = document.createElement('div');
    pagCard.className = 'card';
    pagCard.innerHTML = '<div style="font-size:13px;font-weight:700;color:#5D4037;margin-bottom:10px">PAGOS APLICADOS</div>';
    // ✏️ CADA PAGO SE PUEDE CORREGIR -Sensei, 21 ago-: acababa de pagarle a un suplidor
    // y no habia forma de cambiarle la fecha ni de editarlo. A los CLIENTES si se les podia
    // corregir un cobro desde hace tiempo; a los suplidores no. Ahora es igual en los dos.
    (c.pagosFactura || []).forEach(function(p, _i){
      if(typeof p.monto !== 'number') return;
      var row = document.createElement('div');
      row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:8px;'
        + 'padding:8px 0;border-bottom:1px solid #f0f0f0;font-size:13px;cursor:pointer';
      var _comoPago = p.metodo ? (' · ' + etiquetaMetodoCompra(p.metodo)) : '';
      row.innerHTML = '<span style="color:#777;flex:1;min-width:0">'+p.fecha+_comoPago+(p.nota?' · '+p.nota:'')+'</span>'
        +'<span style="font-weight:700;color:#2E7D32;flex-shrink:0">+$'+fmtNum(p.monto)+'</span>'
        +'<span style="flex-shrink:0;background:#FFF8E1;border:1px solid #D4A017;border-radius:7px;padding:3px 7px;font-size:11px;font-weight:800;color:#8a6d00">✏️</span>';
      row.onclick = (function(cid, idx, sidd){
        return function(){ abrirEditorPagoCompra(cid, idx, sidd); };
      })(c.id, _i, sid);
      pagCard.appendChild(row);
    });
    el.appendChild(pagCard);
  }

  if(c.tipo==='credito' && esSaldoPendiente(saldo)){
    var payCard = document.createElement('div');
    payCard.className = 'card';
    payCard.innerHTML = '<div style="font-size:13px;font-weight:700;color:#5D4037;margin-bottom:8px">APLICAR PAGO A ESTA FACTURA</div>'
      +'<div style="font-size:12px;color:#aaa;margin-bottom:8px">Saldo pendiente: $'+fmtNum(saldo)+'</div>'
      // 📅 QUÉ DÍA LE PAGASTE -2 sep-. Vale para los dos botones de abajo.
      +'<div style="font-size:11px;color:#555;font-weight:700;margin-bottom:3px">📅 ¿QUÉ DÍA LE PAGASTE?</div>'
      +'<input type="date" id="pagoc-fecha-'+c.id+'" style="width:100%;padding:9px;border:1px solid #ddd;border-radius:8px;font-size:13px;margin-bottom:8px">'
      +'<div style="display:flex;gap:8px;align-items:center">'
      +'<input type="text" inputmode="numeric" placeholder="0.00" id="pagocompra-'+c.id+'" value="0.00" style="flex:1;padding:6px 10px;font-size:13px;border:1px solid #ddd;border-radius:6px;outline:none;font-family:sans-serif" onfocus="this.select()" oninput="formatoMoneda(this)">'
      // 🔴 ANTES ESTE PAGO SE GUARDABA SIN FORMA DE PAGO -19 ago-. Se apuntaba el monto y la
      // fecha y nada mas, asi que despues no habia manera de saber con que le habia pagado.
      +'<select id="metpagocompra-'+c.id+'" style="width:120px;padding:9px 6px;border:1px solid #ddd;border-radius:8px;font-size:12px">'
      + METODOS_PAGO_COMPRA.map(function(m){ return '<option value="'+m.tipo+'">'+m.texto+'</option>'; }).join('')
      +'</select>'
      +'<button id="btnpagocompra-'+c.id+'" style="padding:10px 14px;background:#5D4037;color:white;border:none;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600">✓ Pagar</button>'
      +'</div>';
    el.appendChild(payCard);
    (function(cid){ setTimeout(function(){ ponerHoyEnCampo('pagoc-fecha-' + cid); }, 0); })(c.id);
    // NUEVO: dos botones grandes para pagar TODO el saldo de un toque, eligiendo como.
    var pagarTodoCard = document.createElement('div');
    pagarTodoCard.className = 'card';
    pagarTodoCard.innerHTML = '<div style="font-size:13px;font-weight:700;color:#5D4037;margin-bottom:4px">O PAGAR TODA LA FACTURA</div>'
      + '<div style="font-size:12px;color:#aaa;margin-bottom:10px">Un toque paga los $'+fmtNum(saldo)+' completos</div>'
      // Las CUATRO formas con las que Sensei le paga a sus suplidores -19 ago-. Antes solo habia
      // efectivo y tarjeta, y faltaban Zelle y CashApp.
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">'
      + METODOS_PAGO_COMPRA.map(function(m){
          return '<button id="pagtodo-'+m.tipo+'-'+c.id+'" style="padding:13px 8px;background:'+m.color+';color:white;border:none;border-radius:10px;font-size:13.5px;font-weight:800">'
               + m.texto + '<br><span style="font-size:12px;font-weight:600">$'+fmtNum(saldo)+'</span></button>';
        }).join('')
      + '</div>';
    el.appendChild(pagarTodoCard);
    // Funcion que paga TODO el saldo con el metodo elegido (protegida con huella por ser dinero).
    var pagarTodoCompra = function(metodo, metodoLabel){
      if(!confirm('\u00bfPagar TODA la factura de $'+fmtNum(saldo)+' con '+metodoLabel+'?')) return;
      protegerConHuella(function(){
        compras = LS('nc', []);
        var compraReal = compras.find(function(x){ return String(x.id) === String(c.id); });
        if(!compraReal) return;
        if(!compraReal.pagosFactura) compraReal.pagosFactura = [];
        compraReal.pagosFactura.push({ pid: nuevoPagoId(), monto: saldo, fecha: fechaDelCampo('pagoc-fecha-' + c.id), metodo: metodo });
        SS('nc', compras);
        alert('\u2705 Factura pagada por completo ($'+fmtNum(saldo)+') con '+metodoLabel+'.');
        verSup(sid);
      });
    };
    METODOS_PAGO_COMPRA.forEach(function(m){
      var b = document.getElementById('pagtodo-'+m.tipo+'-'+c.id);
      if(b) b.onclick = function(){ pagarTodoCompra(m.tipo, m.texto); };
    });
    document.getElementById('btnpagocompra-'+c.id).onclick = function(){
      var inp = document.getElementById('pagocompra-'+c.id);
      var monto = dinero(inp.value) || 0;
      if(monto <= 0){ alert('Ingresa un monto valido'); return; }
      if(monto > saldo){ if(!confirm('El monto es mayor al saldo. ¿Continuar?')) return; monto = saldo; }
      compras = LS('nc', []);
      var compraReal = compras.find(function(x){ return String(x.id) === String(c.id); });
      if(!compraReal) return;
      if(!compraReal.pagosFactura) compraReal.pagosFactura = [];
      var _selMet = document.getElementById('metpagocompra-'+c.id);
      compraReal.pagosFactura.push({ pid: nuevoPagoId(), monto: monto, fecha: fechaDelCampo('pagoc-fecha-' + c.id),
                                     metodo: _selMet ? _selMet.value : 'efectivo' });
      SS('nc', compras);
      alert('Pago de $'+fmtNum(monto)+' aplicado correctamente');
      verSup(sid);
    };
  }

  var btnEditarCompra = document.createElement('button');
  btnEditarCompra.textContent = '✏️ Editar esta compra';
  btnEditarCompra.style.cssText = 'display:block;width:100%;margin-top:8px;padding:10px;background:#E3F2FD;color:#1565C0;border:1px solid #90CAF9;border-radius:8px;cursor:pointer;font-size:13px;font-weight:700';
  btnEditarCompra.onclick = function(){ editarCompra(c.id, sid); };
  el.appendChild(btnEditarCompra);

  var btnEliminarCompra = document.createElement('button');
  btnEliminarCompra.textContent = '🗑️ Eliminar esta compra -por ejemplo, si fue de prueba';
  btnEliminarCompra.style.cssText = 'display:block;width:100%;margin-top:8px;padding:10px;background:#B71C1C;color:white;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:700';
  btnEliminarCompra.onclick = function(){ eliminarCompra(c.id, sid); };
  el.appendChild(btnEliminarCompra);
}

function eliminarCompra(cid, sid){
  protegerConHuella(function(){
    compras = LS('nc', []);
    var idx = compras.findIndex(function(x){ return String(x.id)===String(cid); });
    if(idx === -1) return;
    var c = compras[idx];

    if(!confirm('¿Eliminar por completo esta compra de $'+fmtNum(c.total)+' del '+c.fecha+' -'+c.sn+'-?\n\nEsto NO se puede deshacer. El inventario que esta compra agregó se va a restar de vuelta -donde se pueda encontrar el producto exacto-.\n\n¿Continuar?')) return;
    if(prompt('Para confirmar, escribe la palabra ELIMINAR en mayúsculas:') !== 'ELIMINAR'){ alert('No se escribió la palabra correcta. No se eliminó nada.'); return; }

    loadProds();
    var avisosStock = [];
    (c.items || []).forEach(function(it){
      var p = null;
      if(it.pid) p = productos.find(function(x){ return String(x.id)===String(it.pid); });
      if(!p && it.esNuevo){
        // Producto creado en el momento de esta compra -no guardo su id-, se busca por nombre y marca como mejor esfuerzo
        p = productos.find(function(x){ return (x.marca||'').toLowerCase()===(it.marca||'').toLowerCase() && (x.nombreCorto||'').toLowerCase()===(it.nombre||'').toLowerCase(); });
      }
      if(p){
        p.stock = Math.max(0, (p.stock||0) - it.cant);
      } else {
        avisosStock.push(it.nombre+' x'+it.cant);
      }
    });
    SS('np', productos);

    compras.splice(idx, 1);
    SS('nc', compras);

    var mensajeFinal = '✅ Compra eliminada por completo.';
    if(avisosStock.length){
      mensajeFinal += '\n\n⚠️ No se pudo encontrar el producto exacto para restar el inventario de: '+avisosStock.join(', ')+'. Revisa el stock de esos productos a mano por si acaso.';
    }
    alert(mensajeFinal);
    verSup(sid);
  });
}

function editarCompra(cid, sid){
  compras = LS('nc', []);
  var c = compras.find(function(x){ return String(x.id)===String(cid); });
  if(!c) return;

  window._compraEditItems = (c.items || []).map(function(it){
    var cantSegura = Number(it.cant);
    if(!isFinite(cantSegura) || cantSegura <= 0) cantSegura = 1;
    var costoSeguro = Number(it.costo);
    if(!isFinite(costoSeguro) || costoSeguro < 0) costoSeguro = 0;
    return { nombre: it.nombre||'Producto sin nombre', cant: cantSegura, costo: costoSeguro, pid: it.pid||null, esNuevo: it.esNuevo||false, marca: it.marca||'', cat: it.cat||'' };
  });
  window._compraEditId = cid;
  window._compraEditSid = sid;

  var overlay = document.getElementById('compra-edit-overlay');
  if(!overlay){
    overlay = document.createElement('div');
    overlay.id = 'compra-edit-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:white;z-index:99999;overflow-y:auto;padding:16px';
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = '';

  var wrap = document.createElement('div');
  wrap.style.cssText = 'max-width:480px;margin:0 auto';

  var header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;gap:10px;margin-bottom:16px';
  var btnBack = document.createElement('button');
  btnBack.textContent = '← Volver';
  btnBack.style.cssText = 'background:#E8EAF6;border:none;border-radius:8px;padding:10px 16px;cursor:pointer;font-size:14px;font-weight:600;color:#1a237e';
  btnBack.onclick = function(){ overlay.style.display='none'; };
  var iconoNBS4 = document.createElement('img');
  iconoNBS4.src = 'icon-512.png'; iconoNBS4.alt = 'NBS';
  iconoNBS4.style.cssText = 'width:32px;height:32px;margin-left:auto;border-radius:8px;cursor:pointer';
  iconoNBS4.onclick = function(){ overlay.style.display='none'; ir('p-inicio'); };
  header.appendChild(btnBack); header.appendChild(iconoNBS4);
  wrap.appendChild(header);

  var titulo = document.createElement('div');
  titulo.innerHTML = '<div style="font-size:17px;font-weight:800;color:#5D4037">✏️ Editar Compra</div>'
    +'<div style="font-size:12px;color:#aaa;margin-top:2px">'+c.sn+' · '+c.fecha+'</div>';
  wrap.appendChild(titulo);

  var fechaLabel = document.createElement('label');
  fechaLabel.className = 'lbl';
  fechaLabel.textContent = 'Fecha de la compra';
  wrap.appendChild(fechaLabel);
  var fechaInput = document.createElement('input');
  fechaInput.className = 'inp';
  fechaInput.type = 'date';
  fechaInput.id = 'compra-edit-fecha';
  var dFecha = parsearFechaVenta(c.fecha);
  fechaInput.value = dFecha.getFullYear()+'-'+String(dFecha.getMonth()+1).padStart(2,'0')+'-'+String(dFecha.getDate()).padStart(2,'0');
  wrap.appendChild(fechaInput);

  var itemsLabel = document.createElement('div');
  itemsLabel.style.cssText = 'font-size:11px;color:#aaa;font-weight:700;text-transform:uppercase;margin:16px 0 8px';
  itemsLabel.textContent = 'Productos de esta compra';
  wrap.appendChild(itemsLabel);

  var itemsWrap = document.createElement('div');
  itemsWrap.id = 'compra-edit-items-wrap';
  wrap.appendChild(itemsWrap);

  // Agregar un producto que faltaba -por ejemplo, si el suplidor mando algo de mas o distinto
  // a lo que decia la factura original-
  var agregarLabel = document.createElement('div');
  agregarLabel.style.cssText = 'font-size:11px;color:#aaa;font-weight:700;text-transform:uppercase;margin:16px 0 8px';
  agregarLabel.textContent = 'Agregar un producto que faltaba';
  wrap.appendChild(agregarLabel);

  var buscarAgregar = document.createElement('input');
  buscarAgregar.className = 'inp';
  buscarAgregar.type = 'text';
  buscarAgregar.placeholder = 'Buscar producto del catálogo...';
  wrap.appendChild(buscarAgregar);

  var resultadosAgregar = document.createElement('div');
  resultadosAgregar.style.cssText = 'display:none;max-height:200px;overflow-y:auto;background:white;border:1px solid #ddd;border-radius:8px;margin-top:4px;margin-bottom:8px';
  wrap.appendChild(resultadosAgregar);

  var btnProductoNuevo = document.createElement('button');
  btnProductoNuevo.textContent = '+ Agregar un producto que no está en el catálogo';
  btnProductoNuevo.style.cssText = 'width:100%;padding:9px;background:#EFEBE9;color:#5D4037;border:1px dashed #A1887F;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;margin-bottom:10px';
  btnProductoNuevo.onclick = function(){
    var nombreNuevo = prompt('Nombre del producto que faltaba:');
    if(nombreNuevo === null) return;
    nombreNuevo = limpiarTexto(nombreNuevo.trim());
    if(!nombreNuevo){ alert('Tienes que escribir un nombre.'); return; }
    var costoNuevo = parseFloat(prompt('Costo por unidad -lo que pagaste-:')) || 0;
    var cantNueva = parseInt(prompt('Cantidad recibida:')) || 1;
    var precioVentaNuevo = parseFloat(prompt('¿A qué precio lo vas a vender? -puedes ajustarlo después en Catálogo-:')) || 0;
    window._compraEditItems.push({ nombre: nombreNuevo, cant: cantNueva, costo: costoNuevo, pid: null, esNuevo: true, marca: '', cat: '', precioVenta: precioVentaNuevo });
    renderCompraEditItems();
  };
  wrap.appendChild(btnProductoNuevo);

  buscarAgregar.addEventListener('input', function(){
    var q = buscarAgregar.value.trim().toLowerCase();
    if(!q){ resultadosAgregar.style.display='none'; return; }
    loadProds();
    var lista = filtrarPorBusqueda(productos, q, function(p){ return p.nombre; }).slice(0,15);
    if(!lista.length){
      resultadosAgregar.innerHTML = '<div style="padding:10px;font-size:12px;color:#aaa">Sin resultados -puedes agregarlo como producto que no está en el catálogo, abajo-</div>';
      resultadosAgregar.style.display = 'block';
      return;
    }
    resultadosAgregar.innerHTML = lista.map(function(p){
      return '<div data-pid="'+p.id+'" style="padding:10px;border-bottom:1px solid #f0f0f0;cursor:pointer;font-size:13px">'
        +'<div style="font-weight:600">'+escaparHtml(p.nombre)+'</div><div style="font-size:11px;color:#aaa">Costo actual: $'+fmtNum(p.costo)+'</div></div>';
    }).join('');
    resultadosAgregar.style.display = 'block';
    Array.from(resultadosAgregar.children).forEach(function(el){
      el.onclick = function(){
        var pid = el.getAttribute('data-pid');
        var p = productos.find(function(x){ return String(x.id)===String(pid); });
        if(!p) return;
        window._compraEditItems.push({ nombre: p.nombre, cant: 1, costo: p.costo, pid: p.id, esNuevo: false, marca: p.marca||'', cat: p.cat||'' });
        buscarAgregar.value = '';
        resultadosAgregar.style.display = 'none';
        renderCompraEditItems();
      };
    });
  });

  function renderCompraEditItems(){
    itemsWrap.innerHTML = '';
    window._compraEditItems.forEach(function(it, i){
      // Segunda capa de proteccion: sin importar como haya llegado el dato -de un guardado viejo,
      // de una busqueda, de voz, etc-, aqui SIEMPRE se garantiza un numero valido para mostrar,
      // nunca "undefined", "NaN", ni un campo vacio.
      var cantSegura = Number(it.cant); if(!isFinite(cantSegura) || cantSegura <= 0) cantSegura = 1;
      var costoSeguro = Number(it.costo); if(!isFinite(costoSeguro) || costoSeguro < 0) costoSeguro = 0;
      it.cant = cantSegura; it.costo = costoSeguro; // corregir tambien en los datos, no solo en pantalla
      var row = document.createElement('div');
      row.style.cssText = 'background:#FAFAFA;border-radius:10px;padding:10px;margin-bottom:8px;border:0.5px solid #eee';
      row.innerHTML = '<div style="display:flex;gap:8px;align-items:center;margin-bottom:6px">'
        +'<input type="text" value="'+(it.nombre||'Producto sin nombre').replace(/"/g,"'")+'" oninput="window._compraEditItems['+i+'].nombre=this.value" style="flex:1;border:0.5px solid #ddd;border-radius:6px;padding:7px 8px;font-size:13px;font-weight:600">'
        +'<button data-i="'+i+'" class="compra-edit-quitar" style="background:var(--nbs-red-bg);color:var(--nbs-red-dark);border:none;border-radius:8px;width:36px;height:36px;cursor:pointer;font-size:15px;flex-shrink:0">✕</button>'
        +'</div>'
        +'<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">'
        +'<div style="display:flex;align-items:center;gap:4px">'
        +'<label style="font-size:11px;color:#aaa">Cant:</label>'
        +'<input type="text" inputmode="numeric" value="'+cantSegura+'" data-i="'+i+'" class="compra-edit-cant" onfocus="this.select()" style="width:50px;padding:6px;border:1px solid #ddd;border-radius:6px;font-size:12px;text-align:center">'
        +'</div>'
        +'<div style="display:flex;align-items:center;gap:4px">'
        +'<label style="font-size:11px;color:#aaa">Costo c/u:</label>'
        +'<input type="text" inputmode="decimal" value="'+costoSeguro+'" data-i="'+i+'" class="compra-edit-costo" onfocus="this.select();this.dataset.modoPreciso=\'\'" style="width:65px;padding:6px;border:1px solid #ddd;border-radius:6px;font-size:12px;text-align:center">'
        +'</div>'
        +'<div style="display:flex;align-items:center;gap:4px;margin-left:auto">'
        +'<label style="font-size:11px;color:#1565C0;font-weight:700">Total línea:</label>'
        +'<input type="text" inputmode="decimal" value="'+(cantSegura*costoSeguro).toFixed(2)+'" data-i="'+i+'" class="compra-edit-total-linea" onfocus="this.select();this.dataset.modoPreciso=\'\'" style="width:70px;padding:6px;border:1.5px solid #90CAF9;border-radius:6px;font-size:12px;text-align:center;color:#1565C0;font-weight:700;background:#E3F2FD">'
        +'</div>'
        +'</div>'
        +'<div style="font-size:10px;color:#aaa;margin-top:4px">Tip: si tu factura solo trae el total de la línea -no el costo por unidad-, escríbelo en "Total línea" y el costo se calcula solo.</div>';
      itemsWrap.appendChild(row);
    });
    itemsWrap.querySelectorAll('.compra-edit-quitar').forEach(function(btn){
      btn.onclick = function(){ window._compraEditItems.splice(parseInt(btn.dataset.i),1); renderCompraEditItems(); };
    });
    itemsWrap.querySelectorAll('.compra-edit-cant').forEach(function(inp){
      inp.oninput = function(){
        var i = parseInt(inp.dataset.i);
        window._compraEditItems[i].cant = parseInt(inp.value)||1;
        var totalLineaInp = itemsWrap.querySelector('.compra-edit-total-linea[data-i="'+i+'"]');
        if(totalLineaInp) totalLineaInp.value = (window._compraEditItems[i].cant*window._compraEditItems[i].costo).toFixed(2);
        actualizarTotalEdicionCompra();
      };
    });
    itemsWrap.querySelectorAll('.compra-edit-costo').forEach(function(inp){
      inp.oninput = function(e){
        formatoCostoPreciso(inp, e);
        var i = parseInt(inp.dataset.i);
        window._compraEditItems[i].costo = dinero(inp.value)||0;
        var totalLineaInp = itemsWrap.querySelector('.compra-edit-total-linea[data-i="'+i+'"]');
        if(totalLineaInp) totalLineaInp.value = (window._compraEditItems[i].cant*window._compraEditItems[i].costo).toFixed(2);
        actualizarTotalEdicionCompra();
      };
      inp.onblur = function(){
        finalizarCostoPreciso(inp);
        var i = parseInt(inp.dataset.i);
        window._compraEditItems[i].costo = dinero(inp.value)||0;
        var totalLineaInp = itemsWrap.querySelector('.compra-edit-total-linea[data-i="'+i+'"]');
        if(totalLineaInp) totalLineaInp.value = (window._compraEditItems[i].cant*window._compraEditItems[i].costo).toFixed(2);
        actualizarTotalEdicionCompra();
      };
    });
    // LA GRAN IDEA: si se escribe el TOTAL de la linea en vez del costo por unidad -muy comun
    // en facturas de suplidor que solo dan el total, no el precio unitario-, el costo por unidad
    // se calcula solo dividiendo el total entre la cantidad.
    itemsWrap.querySelectorAll('.compra-edit-total-linea').forEach(function(inp){
      inp.oninput = function(e){
        formatoCostoPreciso(inp, e);
        var i = parseInt(inp.dataset.i);
        var totalEscrito = dinero(inp.value) || 0;
        var cantActual = window._compraEditItems[i].cant || 1;
        var costoCalculado = Math.round((totalEscrito / cantActual) * 1000000) / 1000000;
        window._compraEditItems[i].costo = costoCalculado;
        var costoInp = itemsWrap.querySelector('.compra-edit-costo[data-i="'+i+'"]');
        if(costoInp) costoInp.value = costoCalculado;
        actualizarTotalEdicionCompra();
      };
      inp.onblur = function(){
        finalizarCostoPreciso(inp);
        var i = parseInt(inp.dataset.i);
        var totalEscrito = dinero(inp.value) || 0;
        var cantActual = window._compraEditItems[i].cant || 1;
        var costoCalculado = Math.round((totalEscrito / cantActual) * 1000000) / 1000000;
        window._compraEditItems[i].costo = costoCalculado;
        var costoInp = itemsWrap.querySelector('.compra-edit-costo[data-i="'+i+'"]');
        if(costoInp) costoInp.value = costoCalculado;
        actualizarTotalEdicionCompra();
      };
    });
  }
  renderCompraEditItems();

  // ALERTA DE RIESGO: si esta compra ya tiene pagos registrados, cambiar el total aqui
  // afecta el balance pendiente -el pago ya hecho no se ajusta solo-. Se avisa claramente.
  var totalPagadoYa = (c.pagosFactura||[]).filter(function(p){return typeof p.monto==='number';}).reduce(function(s,p){return s+p.monto;},0);
  if(totalPagadoYa > 0.005){
    var avisoRiesgo = document.createElement('div');
    avisoRiesgo.style.cssText = 'background:#FFEBEE;border:1.5px solid #E53935;border-radius:10px;padding:12px;margin:14px 0';
    avisoRiesgo.innerHTML = '<div style="font-size:12px;font-weight:800;color:#C62828">⚠️ CUIDADO: esta compra ya tiene $'+fmtNum(totalPagadoYa)+' pagado(s)</div>'
      +'<div style="font-size:11px;color:#C62828;margin-top:4px">Si cambias productos, cantidades, costos, o el envío, el TOTAL de la compra va a cambiar, pero lo que ya pagaste se queda igual -el balance pendiente con el suplidor se va a ajustar según el nuevo total, no según lo que pagaste antes de este cambio.</div>';
    wrap.appendChild(avisoRiesgo);
  }

  var fotoLabel = document.createElement('label');
  fotoLabel.className = 'lbl';
  fotoLabel.textContent = 'Foto de la factura del suplidor';
  wrap.appendChild(fotoLabel);
  var fotoRow = document.createElement('div');
  fotoRow.style.cssText = 'display:flex;align-items:center;gap:10px;margin-bottom:14px';
  var fotoPreviewEdit = document.createElement('div');
  fotoPreviewEdit.id = 'compra-edit-foto-preview';
  fotoPreviewEdit.style.cssText = 'width:56px;height:56px;border-radius:10px;background:'+(c.foto?'#f0f0f0':'var(--nbs-gold-bg)')+';border:'+(c.foto?'none':'2px dashed var(--nbs-gold)')+';display:flex;align-items:center;justify-content:center;font-size:26px;flex-shrink:0;overflow:hidden;cursor:pointer';
  fotoPreviewEdit.innerHTML = c.foto ? '<img src="'+c.foto+'" style="width:100%;height:100%;object-fit:cover">' : '📷';
  var fotoInfoTxt = document.createElement('div');
  fotoInfoTxt.style.cssText = 'font-size:12px;color:#aaa;flex:1';
  fotoInfoTxt.textContent = c.foto ? 'Toca la foto para verla en grande, cambiarla, o quitarla.' : 'Todavía no tiene foto — toca para agregar una.';
  fotoRow.appendChild(fotoPreviewEdit);
  fotoRow.appendChild(fotoInfoTxt);
  wrap.appendChild(fotoRow);

  var fotoDataEditInput = document.createElement('input');
  fotoDataEditInput.type = 'hidden';
  fotoDataEditInput.id = 'compra-edit-foto-data';
  fotoDataEditInput.value = c.foto || '';
  wrap.appendChild(fotoDataEditInput);

  var inputCamaraEdit = document.createElement('input');
  inputCamaraEdit.type = 'file'; inputCamaraEdit.accept = 'image/*'; inputCamaraEdit.capture = 'camera';
  inputCamaraEdit.style.display = 'none'; inputCamaraEdit.id = 'compra-edit-foto-camara';
  inputCamaraEdit.onchange = function(){ cargarFotoEditCompra(inputCamaraEdit); };
  wrap.appendChild(inputCamaraEdit);
  var inputGaleriaEdit = document.createElement('input');
  inputGaleriaEdit.type = 'file'; inputGaleriaEdit.accept = 'image/*';  // era una lista corta que dejaba
  // FUERA el formato HEIC -el que usa el Samsung de Sensei por defecto-, asi que en esta pantalla
  // se le escondia media galeria. Ahora pide lo mismo que los otros 11 inputs de foto -26 jul-.
  inputGaleriaEdit.style.display = 'none'; inputGaleriaEdit.id = 'compra-edit-foto-galeria';
  inputGaleriaEdit.onchange = function(){ cargarFotoEditCompra(inputGaleriaEdit); };
  wrap.appendChild(inputGaleriaEdit);

  fotoPreviewEdit.onclick = function(){
    var opciones = c.foto
      ? [['👁️ Ver en grande', function(){ verFotoGasto(document.getElementById('compra-edit-foto-data').value); }],
         ['📷 Tomar otra foto', function(){ recrearInputFoto('compra-edit-foto-camara', cargarFotoEditCompra).click(); }],
         ['🖼️ Elegir otra de galería', function(){ recrearInputFoto('compra-edit-foto-galeria', cargarFotoEditCompra).click(); }],
         ['🗑️ Quitar foto', function(){
           document.getElementById('compra-edit-foto-data').value = '';
           fotoPreviewEdit.innerHTML = '📷';
           fotoPreviewEdit.style.background = 'var(--nbs-gold-bg)';
           fotoPreviewEdit.style.border = '2px dashed var(--nbs-gold)';
           fotoInfoTxt.textContent = 'Todavía no tiene foto — toca para agregar una.';
           c.foto = null;
         }]]
      : [['📷 Tomar foto', function(){ recrearInputFoto('compra-edit-foto-camara', cargarFotoEditCompra).click(); }],
         ['🖼️ Elegir de galería', function(){ recrearInputFoto('compra-edit-foto-galeria', cargarFotoEditCompra).click(); }]];
    mostrarMenuOpcionesFoto(opciones);
  };


  var envioLabel = document.createElement('label');
  envioLabel.className = 'lbl';
  envioLabel.textContent = 'Costo de envío -shipping-';
  wrap.appendChild(envioLabel);
  var envioInput = document.createElement('input');
  envioInput.className = 'inp';
  envioInput.type = 'text';
  envioInput.inputMode = 'numeric';
  envioInput.id = 'compra-edit-envio';
  envioInput.value = (c.envio||0).toFixed(2);
  envioInput.onfocus = function(){ envioInput.select(); };
  wrap.appendChild(envioInput);

  // 💳 CARGO POR TARJETA EN EL EDITOR -19 ago-. Antes NO estaba aqui, y al modificar una compra
  // el total se recalculaba como productos + envio: el cargo por tarjeta se PERDIA del total y
  // lo que se le debia a ese suplidor quedaba por debajo de lo real. Ahora se edita y se conserva.
  var tarjLabel = document.createElement('label');
  tarjLabel.className = 'lbl';
  tarjLabel.textContent = 'Cargo por tarjeta de crédito';
  wrap.appendChild(tarjLabel);
  var tarjInput = document.createElement('input');
  tarjInput.className = 'inp';
  tarjInput.type = 'text';
  tarjInput.inputMode = 'numeric';
  tarjInput.id = 'compra-edit-tarjeta';
  tarjInput.value = (c.cargoTarjeta||0).toFixed(2);
  tarjInput.onfocus = function(){ tarjInput.select(); };
  wrap.appendChild(tarjInput);

  // 💸 LOS TRES DESCUENTOS EN EL EDITOR -19 ago-. Sensei los necesita para arreglar compras
  // que ya entro sin ellos y quedaron sin cuadrar.
  var descWrap = document.createElement('div');
  descWrap.style.cssText = 'background:#FFEBEE;border-radius:9px;padding:8px;margin:8px 0';
  var descHtml = '<label style="font-size:12.5px;font-weight:800;color:#C62828;display:block;margin-bottom:5px">💸 DESCUENTOS -hasta 3</label>';
  for(var iDe = 1; iDe <= 3; iDe++){
    var dGuardado = (c.descuentos || [])[iDe-1] || { desc: '', monto: 0 };
    descHtml += '<div style="display:flex;gap:5px;margin-bottom:4px">'
      + '<input class="inp" id="compra-edit-desc' + iDe + '" type="text" placeholder="Por qué (ej: promoción)" autocomplete="off" value="' + String(dGuardado.desc||'').replace(/"/g,"'") + '" style="flex:1;padding:7px 8px;font-size:12.5px;margin:0">'
      + '<input class="inp" id="compra-edit-descm' + iDe + '" type="text" inputmode="numeric" placeholder="$0.00" value="' + (dGuardado.monto ? Number(dGuardado.monto).toFixed(2) : '') + '" style="width:84px;padding:7px 4px;font-size:12.5px;text-align:center;margin:0">'
      + '</div>';
  }
  descHtml += '<div style="font-size:10.5px;color:#B71C1C;margin-top:2px">Escribe el número sin el menos. La app lo resta sola.</div>';
  descWrap.innerHTML = descHtml;
  wrap.appendChild(descWrap);

  var totalEditWrap = document.createElement('div');
  totalEditWrap.style.cssText = 'background:#EFEBE9;border-radius:8px;padding:12px;margin:10px 0';
  totalEditWrap.innerHTML = '<div id="compra-edit-desc-detalle"></div>'
    + '<div style="display:flex;justify-content:space-between"><span style="font-size:13px;color:#5D4037">Total de la compra</span><span id="compra-edit-total" style="font-weight:700;font-size:18px;color:#5D4037">$0.00</span></div>';
  wrap.appendChild(totalEditWrap);

  function descuentosEdicionCompra(){
    var lista = [], total = 0;
    for(var i = 1; i <= 3; i++){
      var elD = document.getElementById('compra-edit-desc' + i);
      var elM = document.getElementById('compra-edit-descm' + i);
      var monto = elM ? (parseFloat(String(elM.value).replace(/[$,]/g,'')) || 0) : 0;
      if(!(monto > 0.005)) continue;
      var texto = elD && elD.value ? String(elD.value).trim() : '';
      lista.push({ desc: texto || 'Descuento', monto: monto });
      total += monto;
    }
    return { lista: lista, total: total };
  }
  window._descuentosEdicionCompra = descuentosEdicionCompra;

  function actualizarTotalEdicionCompra(){
    var totItems = window._compraEditItems.reduce(function(s,it){ return s+(it.cant*it.costo); },0);
    var envio = parseFloat(String((document.getElementById('compra-edit-envio')||{}).value||'').replace(/[$,]/g,''))||0;
    var tarj  = parseFloat(String((document.getElementById('compra-edit-tarjeta')||{}).value||'').replace(/[$,]/g,''))||0;
    var d = descuentosEdicionCompra();
    document.getElementById('compra-edit-total').textContent = '$'+fmtNum(totItems + envio + tarj - d.total);
    var det = document.getElementById('compra-edit-desc-detalle');
    if(det){
      det.innerHTML = d.lista.length
        ? d.lista.map(function(x){
            return '<div style="display:flex;justify-content:space-between;font-size:11.5px;color:#C62828;margin-bottom:3px">'
                 + '<span>💸 ' + String(x.desc).replace(/[<>&"]/g,'') + '</span>'
                 + '<span style="font-weight:700">\u2212$' + fmtNum(x.monto) + '</span></div>';
          }).join('') + '<div style="border-top:1px solid #d7ccc8;margin:4px 0"></div>'
        : '';
    }
  }
  envioInput.addEventListener('input', function(){ formatoMoneda(envioInput); actualizarTotalEdicionCompra(); });
  tarjInput.addEventListener('input', function(){ formatoMoneda(tarjInput); actualizarTotalEdicionCompra(); });
  // ⚠️ AQUI SE BUSCA DENTRO DE descWrap, NO con document.getElementById: en este punto 'wrap'
  // todavia no esta colgado en la pantalla, asi que getElementById devolveria null y las tres
  // casillas quedarian muertas -el total no se movia al escribir un descuento-. -19 ago-
  for(var iEv = 1; iEv <= 3; iEv++){
    (function(k){
      var elM = descWrap.querySelector('#compra-edit-descm' + k);
      if(elM) elM.addEventListener('input', function(){ formatoMoneda(elM); actualizarTotalEdicionCompra(); });
      var elD = descWrap.querySelector('#compra-edit-desc' + k);
      if(elD) elD.addEventListener('input', actualizarTotalEdicionCompra);
    })(iEv);
  }
  var renderOriginal = renderCompraEditItems;
  renderCompraEditItems = function(){ renderOriginal(); actualizarTotalEdicionCompra(); };
  setTimeout(actualizarTotalEdicionCompra, 0);

  var btnGuardarCompra = document.createElement('button');
  btnGuardarCompra.textContent = '✓ Guardar cambios';
  btnGuardarCompra.style.cssText = 'width:100%;padding:12px;background:#1565C0;color:white;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;margin-top:14px';
  btnGuardarCompra.onclick = function(){ guardarEdicionCompra(); };
  wrap.appendChild(btnGuardarCompra);

  overlay.appendChild(wrap);
  overlay.style.display = 'block';
  overlay.scrollTop = 0;
}

function guardarEdicionCompra(){
  compras = LS('nc', []);
  loadProds();
  var idx = compras.findIndex(function(x){ return String(x.id)===String(window._compraEditId); });
  if(idx < 0) return;
  if(!window._compraEditItems || !window._compraEditItems.length){ alert('La compra debe tener al menos un producto.'); return; }

  // Ajustar inventario: primero quitar lo que esta compra habia agregado ANTES de editar,
  // luego agregar lo que tiene AHORA -asi los cambios de cantidad se reflejan bien en el stock-.
  compras[idx].items.forEach(function(it){
    var p = it.pid ? productos.find(function(x){ return String(x.id)===String(it.pid); }) : null;
    if(!p && it.esNuevo) p = productos.find(function(x){ return (x.marca||'').toLowerCase()===(it.marca||'').toLowerCase() && (x.nombreCorto||'').toLowerCase()===(it.nombre||'').toLowerCase(); });
    if(p) p.stock = Math.max(0, (p.stock||0) - it.cant);
  });
  window._compraEditItems.forEach(function(it){
    var p = it.pid ? productos.find(function(x){ return String(x.id)===String(it.pid); }) : null;
    if(!p && it.esNuevo) p = productos.find(function(x){ return (x.marca||'').toLowerCase()===(it.marca||'').toLowerCase() && (x.nombreCorto||'').toLowerCase()===(it.nombre||'').toLowerCase(); });
    if(p){
      p.stock = (p.stock||0) + (it.cant||1);
    } else if(it.esNuevo){
      // Producto genuinamente nuevo -nunca existio en el catalogo-, hay que crearlo de verdad,
      // no solo dejarlo como texto dentro de la compra, o se pierde el control del inventario.
      var nuevoId = 'custom_' + Date.now() + '_' + Math.floor(Math.random()*1000);
      productos.push({ id: nuevoId, marca: it.marca||'', nombreCorto: it.nombre, nombre: it.nombre, cat: it.cat||'', sku: '', costo: it.costo||0, precio: it.precioVenta||0, stock: it.cant||1, min: 5 });
      it.pid = nuevoId; // guardar la referencia para la proxima vez que se edite esta compra
    }
  });
  SS('np', productos);

  compras[idx].items = window._compraEditItems.map(function(it){
    return { nombre: (it.nombre||'').trim(), cant: it.cant||1, costo: it.costo||0, pid: it.pid||null, esNuevo: it.esNuevo||false, marca: it.marca||'', cat: it.cat||'' };
  });
  var envioEditado = parseFloat(String((document.getElementById('compra-edit-envio')||{}).value||'').replace(/[$,]/g,'')) || 0;
  // 🔴 EL CARGO POR TARJETA SE PERDIA AQUI -arreglado el 19 ago-. El total se recalculaba como
  // productos + envio, sin la tarjeta, asi que cada vez que se modificaba una compra con cargo
  // de tarjeta el total bajaba solo y la deuda con ese suplidor quedaba corta.
  var tarjEl = document.getElementById('compra-edit-tarjeta');
  var tarjEditada = tarjEl ? (parseFloat(String(tarjEl.value).replace(/[$,]/g,'')) || 0)
                           : (parseFloat(compras[idx].cargoTarjeta) || 0);
  var descEditados = window._descuentosEdicionCompra ? window._descuentosEdicionCompra() : { lista: [], total: 0 };
  compras[idx].envio = envioEditado;
  compras[idx].cargoTarjeta = tarjEditada;
  compras[idx].descuentos = descEditados.lista;
  compras[idx].total = compras[idx].items.reduce(function(s,it){ return s+(it.cant*it.costo); },0)
                     + envioEditado + tarjEditada - descEditados.total;

  var fechaEl = document.getElementById('compra-edit-fecha');
  if(fechaEl && fechaEl.value){
    var fparts = fechaEl.value.split('-');
    if(fparts.length === 3) compras[idx].fecha = fparts[1]+'/'+fparts[2]+'/'+fparts[0];
  }

  var fotoEditEl = document.getElementById('compra-edit-foto-data');
  compras[idx].foto = fotoEditEl ? (fotoEditEl.value || null) : compras[idx].foto;

  SS('nc', compras);
  document.getElementById('compra-edit-overlay').style.display = 'none';
  alert('✅ Compra actualizada.');
  verSup(window._compraEditSid);
}

function productosDeSuplidor(sid){
  var ids = {};
  LS('nc', []).forEach(function(c){
    if(String(c.sid) !== String(sid)) return;
    (c.items || []).forEach(function(it){ if(it.pid) ids[String(it.pid)] = true; });
  });
  return ids;
}

// 📂 Abrir y cerrar un bloque de la pantalla de compras. -29 ago-
function toggleBloqueCompra(idBloque, idBoton){
  var caja = document.getElementById(idBloque);
  if(!caja) return;
  var abierto = caja.style.display !== 'none';
  caja.style.display = abierto ? 'none' : 'block';
  var btn = document.getElementById(idBoton);
  if(btn){
    var fl = btn.querySelector('.cc-flecha');
    if(fl) fl.textContent = abierto ? '\u203a' : '\u2303';
    btn.style.background = abierto ? '#F2F2F6' : '#E3E7FB';
    btn.style.borderColor = abierto ? '#DCDCE4' : '#1a237e';
  }
}

// Para abrirlo desde el codigo -por ejemplo, cuando el PDF trae descuentos-.
function abrirBloqueCompra(idBloque, idBoton){
  var caja = document.getElementById(idBloque);
  if(caja && caja.style.display === 'none') toggleBloqueCompra(idBloque, idBoton);
}

function crearSuplidorRapido(){
  var nombre = prompt('Nombre del suplidor nuevo:');
  if(nombre === null) return;
  nombre = limpiarTexto(nombre.trim());
  if(!nombre){ alert('Tienes que escribir un nombre.'); return; }
  suplidores = LS('nsup', []);
  var nuevoId = Date.now();
  suplidores.push({ id: nuevoId, nombre: nombre, contacto:'', tel:'', telContacto:'', email:'', dir:'', ciudad:'', zip:'', estado:'' });
  SS('nsup', suplidores);
  syncCCsup();
  document.getElementById('ccsup').value = nuevoId;
  alert('✅ Suplidor "'+nombre+'" creado. Ya puedes agregarle productos a esta compra.');
}

function dictarProductoCompra(){
  var ReconocedorVoz = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!ReconocedorVoz){
    alert('Tu navegador no tiene esta función disponible todavía. Prueba desde Chrome en tu teléfono.');
    return;
  }
  var btn = document.getElementById('btn-dictar-compra');
  var wrap = document.getElementById('dictado-compra-wrap');
  var reconocimiento = new ReconocedorVoz();
  reconocimiento.lang = 'es-US';
  reconocimiento.interimResults = false;
  reconocimiento.maxAlternatives = 1;

  btn.textContent = '🔴';
  btn.style.background = '#C62828';
  wrap.style.display = 'block';
  wrap.innerHTML = '<div style="font-size:13px;color:#5E35B1;font-weight:600">🎤 Escuchando... di algo como "cinco máquinas Wahl a ocho dólares"</div>';

  function restaurarBoton(){ btn.textContent = '🎤'; btn.style.background = '#5E35B1'; }

  reconocimiento.onresult = function(evento){ procesarDictadoCompra(evento.results[0][0].transcript); };
  reconocimiento.onerror = function(evento){
    restaurarBoton();
    if(evento.error === 'not-allowed') wrap.innerHTML = '<div style="font-size:13px;color:#C62828">No se pudo usar el micrófono -revisa el permiso en los ajustes de tu teléfono.</div>';
    else if(evento.error === 'no-speech') wrap.innerHTML = '<div style="font-size:13px;color:#C62828">No se escuchó nada. Intenta de nuevo.</div>';
    else wrap.innerHTML = '<div style="font-size:13px;color:#C62828">Hubo un problema escuchando. Intenta de nuevo.</div>';
  };
  reconocimiento.onend = restaurarBoton;
  try { reconocimiento.start(); } catch(e){ restaurarBoton(); alert('No se pudo iniciar el micrófono.'); }
}

function procesarDictadoCompra(textoOriginal){
  var wrap = document.getElementById('dictado-compra-wrap');
  var texto = textoOriginal.toLowerCase().trim();
  var palabras = texto.split(/\s+/);

  var cantidad = 1;
  if(/^\d+$/.test(palabras[0])){ cantidad = parseInt(palabras[0]); palabras.shift(); }
  else if(NUMEROS_ESPANOL[palabras[0]] !== undefined){ cantidad = NUMEROS_ESPANOL[palabras[0]]; palabras.shift(); }

  var textoProducto = palabras.join(' ').trim();
  if(!textoProducto){
    wrap.innerHTML = '<div style="font-size:13px;color:#C62828">No se entendió qué producto buscar. Escuché: "'+limpiarTexto(textoOriginal)+'"</div>';
    return;
  }

  loadProds();
  // Busqueda lista: ignora acentos, el orden no importa, y aguanta faltas de ortografia
  var coincidencias = filtrarPorBusqueda(productos, textoProducto, function(p){ return p.nombre; });

  if(!coincidencias.length){
    wrap.innerHTML = '<div style="font-size:13px;color:#333">Escuché: <b>"'+limpiarTexto(textoOriginal)+'"</b></div>'
      + '<div style="font-size:12px;color:#C62828;margin-top:6px">No encontré ningún producto parecido a "'+limpiarTexto(textoProducto)+'". Búscalo escribiendo, o agrégalo como producto nuevo.</div>';
    return;
  }

  var mejor = coincidencias[0];
  wrap.innerHTML = '<div style="font-size:13px;color:#333">Escuché: <b>"'+limpiarTexto(textoOriginal)+'"</b></div>'
    + '<div style="background:white;border-radius:8px;padding:10px;margin-top:8px">'
    + '<div style="font-size:13px;font-weight:700">'+mejor.nombre+'</div>'
    + '<div style="font-size:12px;color:#777">Cantidad: '+cantidad+' · Costo actual: $'+fmtNum(mejor.costo)+' c/u</div>'
    + '</div>'
    + '<div style="display:flex;gap:8px;margin-top:8px">'
    + '<button onclick="document.getElementById(\'dictado-compra-wrap\').style.display=\'none\'" style="flex:1;padding:9px;background:#eee;color:#555;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">✕ No es esto</button>'
    + '<button onclick="confirmarDictadoCompra(\''+mejor.id+'\','+cantidad+')" style="flex:1;padding:9px;background:#2E7D32;color:white;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">✓ Agregar a la compra</button>'
    + '</div>';
}

function confirmarDictadoCompra(pid, cantidad){
  loadProds();
  var p = productos.find(function(x){ return String(x.id)===String(pid); });
  if(!p) return;
  var encontrado = false;
  for(var j=0;j<iCC.length;j++){
    if(String(iCC[j].pid)===String(p.id)){ iCC[j].cant += cantidad; encontrado = true; break; }
  }
  if(!encontrado) iCC.push({ pid: p.id, nombre: p.nombre, cant: cantidad, costo: p.costo, esNuevo: false });
  renderICC();
  document.getElementById('dictado-compra-wrap').style.display = 'none';
  document.getElementById('ccb').value = '';
}

function mostrarNuevoProductoCompra(){
  clearCC();
  document.getElementById('cc-nuevo-prod').style.display = 'block';
  document.getElementById('ccnp-marca').value = '';
  document.getElementById('ccnp-nombre').value = '';
  document.getElementById('ccnp-cat').value = '';
  document.getElementById('cccosto').value = '0.00';
  document.getElementById('ccprecio').value = '0.00';
  document.getElementById('ccnombre-aviso').style.display = 'none';
}

function descuentosCompraActual(){
  var lista = [], total = 0;
  for(var i = 1; i <= 3; i++){
    var elDesc  = document.getElementById('cc-desc' + i);
    var elMonto = document.getElementById('cc-descm' + i);
    var monto = elMonto ? (parseFloat(String(elMonto.value).replace(/[$,]/g,'')) || 0) : 0;
    if(!(monto > 0.005)) continue;
    var texto = elDesc && elDesc.value ? String(elDesc.value).trim() : '';
    lista.push({ desc: texto || 'Descuento', monto: monto });
    total += monto;
  }
  return { lista: lista, total: total };
}

// EL TOTAL DE LA COMPRA, EN UN SOLO SITIO -19 ago-.
// Antes esto estaba repetido en CINCO lugares dentro de renderICC, cada uno sumando envio y
// tarjeta por su cuenta. Con el descuento eso eran cinco sitios mas donde equivocarse, asi que
// se junto todo aqui: quien necesite repintar el total llama a esta funcion y ya.
function pintarTotalCompra(){
  var tot = iCC.reduce(function(s2,it){ return s2 + (it.cant * it.costo); }, 0);
  var elEnv = document.getElementById('cc-envio');
  var envio = elEnv ? (parseFloat(String(elEnv.value).replace(/[$,]/g,'')) || 0) : 0;
  var elTar = document.getElementById('cc-tarjeta');
  var tarjeta = elTar ? (parseFloat(String(elTar.value).replace(/[$,]/g,'')) || 0) : 0;
  var d = descuentosCompraActual();
  var elTot = document.getElementById('cctot');
  if(elTot) elTot.textContent = '$' + fmtNum(tot + envio + tarjeta - d.total);
  var det = document.getElementById('cc-desc-detalle');
  if(det){
    det.innerHTML = d.lista.length
      ? d.lista.map(function(x){
          return '<div style="display:flex;justify-content:space-between;font-size:11.5px;color:#C62828;margin-bottom:3px">'
               + '<span>💸 ' + String(x.desc).replace(/[<>&"]/g,'') + '</span>'
               + '<span style="font-weight:700">\u2212$' + fmtNum(x.monto) + '</span></div>';
        }).join('') + '<div style="border-top:1px solid #d7ccc8;margin:4px 0"></div>'
      : '';
  }
}

function saveCC(){
  if(!iCC.length){ alert('Agrega al menos un producto'); return; }
  var sid = parseInt(document.getElementById('ccsup').value) || null;
  if(!sid){ alert('Selecciona un suplidor'); return; }
  suplidores = LS('nsup', []);
  var sup = suplidores.find(function(s){ return String(s.id) === String(sid); });
  var sn = sup ? sup.nombre : 'Suplidor';
  var tipo = document.getElementById('cctipo').value;
  var metodosPago = (window._pagoMetodos && window._pagoMetodos['ccini']) ? window._pagoMetodos['ccini'].filter(function(m){ return m.monto>0; }) : [];
  var ini = metodosPago.reduce(function(s,m){ return s+m.monto; }, 0);
  var costoEnvio = dinero(document.getElementById('cc-envio').value) || 0;
  var cargoTarjeta = dinero((document.getElementById('cc-tarjeta')||{}).value);
  // 🚨 LA PARADA: no se guarda una compra que crearia productos SIN precio de venta.
  // Se abre la pantalla para ponerselos y, cuando termine, vuelve aqui y sigue. -19 ago-
  if(!window._preciosYaPuestos && faltanPreciosDeVenta(function(){
        window._preciosYaPuestos = true;
        try { saveCC(); } finally { window._preciosYaPuestos = false; }
      })) return;

  var descC = descuentosCompraActual();
  var tot = iCC.reduce(function(s,it){ return s + it.cant*it.costo; }, 0) + costoEnvio + cargoTarjeta - descC.total;
  if(tipo==='contado' && ini < tot){
    if(!confirm('Marcaste "Contado" pero el pago que registraste ($'+fmtNum(ini)+') no cubre el total ($'+fmtNum(tot)+'). ¿Continuar de todas formas?')) return;
  }
  // -confirmacion redundante "¿Registrar esta compra?" quitada, el boton de Guardar ya es la confirmacion-

  loadProds();
  var tot = 0;
  iCC.forEach(function(it){
    tot += it.cant * it.costo;
    if(it.esNuevo){
      var nuevoId = 'custom_' + Date.now() + '_' + Math.floor(Math.random()*1000);
      var marcaFinal = it.marca || '';
      var nombreFinal = marcaFinal ? (it.nombre.toLowerCase().indexOf(marcaFinal.toLowerCase())===0 ? it.nombre : marcaFinal+' '+it.nombre) : it.nombre;
      // 🏪 EL PROVEEDOR PREFERIDO SE LLENA SOLO -Sensei, 19 ago-: "si yo entro una factura
      // de un suplidor X, esa factura en la parte de proveedor preferido deberia llenarse
      // automaticamente porque se esta entrando una factura a nombre de ese suplidor". Tiene
      // razon: el dato ya esta ahi y hacerselo escribir a mano es trabajo de gratis.
      productos.push({ id: nuevoId, marca: marcaFinal, nombreCorto: it.nombre, nombre: nombreFinal, cat: it.cat||'', sku: '', costo: it.costo, precio: it.precioVenta||0, stock: it.cant, min: 5, proveedorPref: sn || '' });
    } else {
      var p = productos.find(function(x){ return String(x.id)===String(it.pid); });
      if(p){
        p.stock += it.cant; p.costo = it.costo;
        // Si el producto todavia no tenia proveedor preferido, se le pone este. Si YA tenia
        // uno, NO se le pisa: puede que se lo compre a dos y el haya escogido cual prefiere.
        if(sn && !String(p.proveedorPref || '').trim()) p.proveedorPref = sn;
      }
    }
  });
  tot += costoEnvio + cargoTarjeta - descC.total;

  var pagosIniciales = [];
  if(ini > 0) pagosIniciales.push({ monto: ini, fecha: fechaDelCampo('cc-fecha'), nota: 'Pago inicial', metodos: metodosPago });

  compras = LS('nc', []);
  compras.push({
    id: Date.now(), sid: sid, sn: sn, tipo: tipo,
    items: iCC.slice(), total: tot, envio: costoEnvio, cargoTarjeta: cargoTarjeta,
    descuentos: descC.lista,
    fecha: fechaDelCampo('cc-fecha'),   // 📅 la que el escogio -2 sep-
    hora: new Date().toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',hour12:true}),
    pagosFactura: pagosIniciales,
    foto: (window._ccHojas && window._ccHojas[0]) || document.getElementById('cc-foto-data').value || null,
    fotos: (window._ccHojas && window._ccHojas.length) ? window._ccHojas.slice() : null   // 📄 varias hojas -20 sep-
  });

  iCC = [];
  renderICC();
  document.getElementById('ccsup').value = '';
  document.getElementById('cctipo').value = 'credito';
  document.getElementById('cc-envio').value = '';
  var ccTarjEl = document.getElementById('cc-tarjeta');
  if(ccTarjEl) ccTarjEl.value = '';
  for(var iD = 1; iD <= 3; iD++){
    var elD = document.getElementById('cc-desc' + iD);   if(elD) elD.value = '';
    var elM = document.getElementById('cc-descm' + iD);  if(elM) elM.value = '';
  }
  quitarFotoGasto('cc');
  window._ccHojas = [];
  if(typeof pintarHojasFactura === 'function') pintarHojasFactura();
  var ocrResEl = document.getElementById('cc-ocr-resultado');
  if(ocrResEl) ocrResEl.style.display = 'none';
  window._pagoMetodos = window._pagoMetodos || {};
  window._pagoMetodos['ccini'] = [{tipo:'efectivo', monto:0}];
  renderMetodosPago('ccini');
  actualizarLabelPagoCompra();
  SS('nc', compras);
  SS('np', productos);
  flash('mk-cc');
  alert('Compra registrada por $'+fmtNum(tot)+(tipo==='credito'?' - Saldo pendiente: $'+fmtNum((tot-ini)):''));
}

function actualizarLabelPagoCompra(){
  var tipo = document.getElementById('cctipo').value;
  var label = document.getElementById('cc-pago-label');
  if(label) label.textContent = tipo==='contado' ? '💰 ¿Cómo pagaste el total?' : '💰 Pago inicial (opcional, puede ser $0)';
}

function _marcarBarberoSinCompra(idx, estado, titulo, nota){
  var p = pedidosMultiTemp[idx];
  if(!p || !p.cliente) return;
  var nom = nombreCl(p.cliente);
  if(!confirm(titulo + '\n\n' + nom + '\n\n'
      + 'Se le apunta la visita de hoy con ese motivo.'
      + (estado === 'noEstaba'
          ? '\n\n\u2139\ufe0f La visita cuenta -fuiste hasta all\u00e1-, pero NO le baja su '
            + 'porcentaje de compra, porque no fue culpa suya.'
          : ''))) return;

  try { apuntarVisitaDeUnBarbero(p.cliente.id, estado); } catch(e){}
  // Y a la bitácora, con la nota de por qué
  try { apuntarEnBitacora(p.cliente.id, false, { como: 'mano', nota: nota }); } catch(e){}

  // Se saca del cuadro: ya quedó resuelto
  pedidosMultiTemp.splice(idx, 1);
  try { guardarPedidoEnProceso(); } catch(e){}
  try { renderPedidosMultiples(); } catch(e){}
  try { avisoChico(titulo + ' \u00b7 ' + String(nom).slice(0, 18)); } catch(e){}
}

// 🎯 EN CUAL BARBERO ESTAS -21 ago-. Con 4 o 5 pedidos abiertos, lo importante no es
// distinguirlos por color: es saber a cual le estas escribiendo AHORA. El que tocaste se
// enciende con borde azul grueso y cabecera azul clarita; los demas se apagan en gris.
// \ud83d\udcc2 ABRIR UNO Y CERRAR LOS DEMAS -28 ago-. No se vuelve a dibujar la pantalla: solo
// se esconde y se ensena. Asi no se pierde lo que estuviera escrito en una casilla.
function compraronUnaVez(){
  var V = _ventasReales();
  var cuenta = {};
  V.forEach(function(v){
    var k = String(v.cid);
    if(!cuenta[k]) cuenta[k] = { veces: 0, monto: 0, ultima: null };
    cuenta[k].veces++;
    cuenta[k].monto += parseFloat(v.total) || 0;
    var d = _diasDesde(v.fecha);
    if(d !== null && (cuenta[k].ultima === null || d < cuenta[k].ultima)) cuenta[k].ultima = d;
  });
  clientes = LS('ncl', []);
  var res = [];
  Object.keys(cuenta).forEach(function(k){
    if(cuenta[k].veces !== 1) return;
    var c = clientes.find(function(x){ return String(x.id) === k; });
    if(!c || c.sinServicio) return;
    res.push({ cliente: c, monto: Math.round(cuenta[k].monto * 100) / 100,
               diasDesde: cuenta[k].ultima });
  });
  res.sort(function(a,b){ return b.monto - a.monto; });
  return res;
}

// ── 5. PRODUCTOS QUE CASI NO DEJAN GANANCIA ──
function irASuplidores(){ try { ir('p-sup'); } catch(e){} }

// Arreglar las facturas pagadas de más: el sobrante se le deja a favor. -15 ago-
function primeraCompraDe(cid){
  ventas = LS('nv', []);
  var mas = null;
  ventas.forEach(function(v){
    if(v.cancelada || String(v.cid) !== String(cid)) return;
    var f = parsearFechaVenta(v.fecha);
    if(!f) return;
    if(mas === null || f.getTime() < mas.getTime()) mas = f;
  });
  return mas;
}

// Reparte los códigos a los que todavía no tienen. NO toca los ya puestos.
function etiquetaMetodoCompra(tipo){
  for(var i = 0; i < METODOS_PAGO_COMPRA.length; i++){
    if(METODOS_PAGO_COMPRA[i].tipo === tipo) return METODOS_PAGO_COMPRA[i].texto;
  }
  return METODOS_PAGO_LABELS[tipo] || '';
}

// Lo que le queda debiendo una compra: su total menos lo que ya le pago.
// \ud83e\uddfe Un numero de recibo distinto para cada cobro. Lleva la fecha delante para que se
// lea y se ordene solo: R260829-1432-7. -29 ago-
// ═══════════════════════════════════════════════════════════════════
//  🧾 ESTADO DE CUENTA DEL CLIENTE  (29 ago 2026)
//
//  Sensei, textual: "estoy teniendo problemas con los clientes que me dicen que
//  pagaron una cantidad y aparece otra en el sistema".
//
//  LA CAUSA: cuando un cobro se reparte entre varias facturas, la app guardaba
//  un pago suelto en cada una. Un cobro de $80 quedaba como $35 aquí, $15 allá
//  y $30 en otra. No había nada que dijera "esto fue UN pago de $80". El cliente
//  decía 80, el sistema enseñaba 35, y los dos tenían razón.
//
//  ESTA PANTALLA junta todo el movimiento del cliente en una sola línea de
//  tiempo: cada factura y cada COBRO COMPLETO. Al tocar un cobro se abre y
//  enseña en qué facturas se repartió y cuánto a cada una.
// ═══════════════════════════════════════════════════════════════════

// Junta los pagos de un cliente por su número de recibo.
// ⚠️ Los pagos de ANTES del 29 de agosto no tienen recibo. Para esos se agrupa
// por FECHA — es lo mejor que se puede hacer sin inventar datos, y se avisa.
function escogerMetodoEditPagoCompra(tipo){
  window._editPagoCompraMetodo = tipo;
  var botones = document.querySelectorAll('.edpc-met');
  for(var i = 0; i < botones.length; i++){
    var b = botones[i], m = null;
    for(var j = 0; j < METODOS_PAGO_COMPRA.length; j++){
      if(METODOS_PAGO_COMPRA[j].tipo === b.getAttribute('data-met')) m = METODOS_PAGO_COMPRA[j];
    }
    if(!m) continue;
    var sel = (m.tipo === tipo);
    b.style.background = sel ? m.color : '#fff';
    b.style.color = sel ? '#fff' : m.color;
    b.style.border = (sel ? '2px solid ' : '1.5px solid ') + m.color;
  }
}

function borrarPagoCompra(){
  var d = window._editPagoCompra;
  if(!d) return;
  var todas = LS('nc', []);
  var c = todas.find(function(x){ return String(x.id) === String(d.cid); });
  if(!c || !c.pagosFactura || c.pagosFactura[d.pidx] === undefined){ alert('No encontré ese pago.'); return; }
  var p = c.pagosFactura[d.pidx];
  if(!confirm('¿Borrar el pago de $' + fmtNum(p.monto) + ' del ' + (p.fecha || '') + '?\n\n'
    + 'La deuda con este suplidor va a SUBIR $' + fmtNum(p.monto) + '.')) return;

  protegerConHuella(function(){
    var t2 = LS('nc', []);
    var c2 = t2.find(function(x){ return String(x.id) === String(d.cid); });
    if(!c2 || !c2.pagosFactura || c2.pagosFactura[d.pidx] === undefined){ alert('No encontré ese pago.'); return; }
    c2.pagosFactura.splice(d.pidx, 1);
    SS('nc', t2);
    cerrarEditorPagoCompra();
    alert('🗑️ Pago borrado.');
    compras = LS('nc', []);
    var cAct = compras.find(function(x){ return String(x.id) === String(d.cid); });
    if(cAct) verFacturaCompra(cAct, d.sid);
  });
}

function abrirPagoSuplidor(sid){
  var sups = LS('nsup', []);
  var sup = sups.find(function(x){ return String(x.id) === String(sid); });
  if(!sup){ alert('No encontré ese suplidor.'); return; }
  var abiertas = LS('nc', []).filter(function(c){
    return String(c.sid) === String(sid) && esSaldoPendiente(saldoDeCompra(c));
  }).sort(function(a, b){ return (a.id || 0) - (b.id || 0); });

  if(!abiertas.length){
    alert('No le debes nada a ' + sup.nombre + '. No hay facturas con saldo pendiente.');
    return;
  }

  window._pagoSupSid = sid;
  window._pagoSupFacturas = abiertas;
  window._pagoSupEscogida = null;
  window._pagoSupMetodo = null;

  var ov = document.getElementById('pagosup-overlay');
  if(!ov){
    ov = document.createElement('div');
    ov.id = 'pagosup-overlay';
    document.body.appendChild(ov);
  }
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:99999;display:flex;'
    + 'align-items:flex-end;justify-content:center;padding:0';
  ov.innerHTML = '<div id="pagosup-caja" style="background:#fff;width:100%;max-width:520px;'
    + 'border-radius:16px 16px 0 0;padding:14px;max-height:92vh;overflow:auto"></div>';
  pintarPagoSuplidor();
}

function cerrarPagoSuplidor(){
  var ov = document.getElementById('pagosup-overlay');
  if(ov) ov.style.display = 'none';
}

function pintarPagoSuplidor(){
  var caja = document.getElementById('pagosup-caja');
  if(!caja) return;
  // Lo que ya haya escrito, para no perderlo al repintar. -21 ago-
  var _elFprev = document.getElementById('pagosup-fecha');
  var _fechaPrev = _elFprev && _elFprev.value ? _elFprev.value : null;
  var _elMprev = document.getElementById('pagosup-monto');
  var _montoPrev = _elMprev && _elMprev.value ? _elMprev.value : null;
  var sups = LS('nsup', []);
  var sup = sups.find(function(x){ return String(x.id) === String(window._pagoSupSid); });
  var facturas = window._pagoSupFacturas || [];
  var debeTodo = facturas.reduce(function(a, c){ return a + saldoDeCompra(c); }, 0);
  var esc = window._pagoSupEscogida;
  var elegida = facturas.find(function(c){ return String(c.id) === String(esc); });
  var saldoElegida = elegida ? saldoDeCompra(elegida) : 0;

  var h = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">'
    + '<div style="font-size:15px;font-weight:900;color:#5D4037">💸 Pagarle a ' + (sup ? sup.nombre : 'suplidor') + '</div>'
    + '<button onclick="cerrarPagoSuplidor()" style="background:#F0F0F2;border:none;border-radius:8px;width:32px;height:32px;font-size:15px;cursor:pointer">✕</button>'
    + '</div>'
    + '<div style="font-size:12px;color:#777;margin-bottom:10px">Le debes <b>$' + fmtNum(debeTodo) + '</b> en ' + facturas.length + ' factura(s)</div>';

  h += '<div style="font-size:11.5px;font-weight:800;color:#5D4037;margin-bottom:5px">1. ESCOGE LA FACTURA</div>';
  facturas.forEach(function(c){
    var sal = saldoDeCompra(c);
    var marcada = String(c.id) === String(esc);
    h += '<div onclick="escogerFacturaSuplidor(\'' + c.id + '\')" style="display:flex;justify-content:space-between;'
      + 'align-items:center;padding:9px 10px;margin-bottom:5px;border-radius:9px;cursor:pointer;'
      + 'border:' + (marcada ? '2px solid #5D4037' : '1px solid #e0e0e0') + ';'
      + 'background:' + (marcada ? '#EFEBE9' : '#fff') + '">'
      + '<div style="font-size:12.5px;color:#333">' + (marcada ? '◉' : '○') + ' ' + (c.fecha || '') + '</div>'
      + '<div style="font-size:13px;font-weight:800;color:#C62828">$' + fmtNum(sal) + '</div>'
      + '</div>';
  });

  if(elegida){
    h += '<div style="font-size:11.5px;font-weight:800;color:#5D4037;margin:10px 0 5px">2. CUÁNTO LE PAGASTE</div>'
      + '<div style="display:flex;gap:6px;align-items:center">'
      + '<input type="text" inputmode="numeric" id="pagosup-monto" value="' + (_montoPrev !== null ? _montoPrev : saldoElegida.toFixed(2)) + '"'
      + ' onfocus="this.select()" oninput="formatoMoneda(this)"'
      + ' style="flex:1;padding:10px;border:1px solid #ddd;border-radius:8px;font-size:15px;font-weight:700;text-align:center">'
      + '<button onclick="ponerTodoElSaldoSuplidor()" style="padding:10px 12px;background:#EFEBE9;border:1px solid #5D4037;'
      + 'border-radius:8px;color:#5D4037;font-size:12px;font-weight:700;cursor:pointer">Todo el saldo</button>'
      + '</div>';

    // 📅 La fecha del pago, para cuando le pagaste otro dia -Sensei, 21 ago-.
    h += '<div style="font-size:11.5px;font-weight:800;color:#5D4037;margin:10px 0 5px">3. QUÉ DÍA LE PAGASTE</div>'
      + '<input type="date" id="pagosup-fecha" value="' + (_fechaPrev || fechaUSAaISO(fechaHoy())) + '"'
      + ' style="width:100%;padding:9px;border:1px solid #ddd;border-radius:8px;font-size:14px;box-sizing:border-box">'
      + '<div style="font-size:11.5px;font-weight:800;color:#5D4037;margin:10px 0 5px">4. CÓMO LE PAGASTE</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">';
    METODOS_PAGO_COMPRA.forEach(function(m){
      var sel = window._pagoSupMetodo === m.tipo;
      h += '<button onclick="escogerMetodoSuplidor(\'' + m.tipo + '\')" style="padding:11px 6px;border-radius:9px;cursor:pointer;'
        + 'font-size:12.5px;font-weight:800;'
        + (sel ? 'background:' + m.color + ';color:#fff;border:2px solid ' + m.color + ';'
               : 'background:#fff;color:' + m.color + ';border:1.5px solid ' + m.color + ';')
        + '">' + m.texto + '</button>';
    });
    h += '</div>';

    h += '<div style="display:flex;gap:8px;margin-top:12px">'
      + '<button onclick="cerrarPagoSuplidor()" style="flex:.8;padding:13px;background:#F0F0F2;border:none;'
      + 'border-radius:10px;font-size:13px;font-weight:700;cursor:pointer">Cancelar</button>'
      + '<button onclick="aplicarPagoSuplidor()" style="flex:1.4;padding:13px;background:#5D4037;color:#fff;border:none;'
      + 'border-radius:10px;font-size:13.5px;font-weight:900;cursor:pointer">✋ Huella y pagar</button>'
      + '</div>';
  } else {
    h += '<div style="font-size:12px;color:#aaa;margin-top:10px;text-align:center">Toca una factura para seguir.</div>';
  }

  caja.innerHTML = h;
}

function escogerFacturaSuplidor(cid){
  window._pagoSupEscogida = cid;
  window._pagoSupMetodo = null;
  // Al cambiar de factura si se limpia el monto: es otro pago, con otro saldo. La FECHA se
  // respeta, porque el dia en que pago es el mismo aunque cambie de factura. -21 ago-
  var _m = document.getElementById('pagosup-monto');
  if(_m) _m.value = '';
  pintarPagoSuplidor();
}

function escogerMetodoSuplidor(tipo){
  window._pagoSupMetodo = tipo;
  pintarPagoSuplidor();
}

function ponerTodoElSaldoSuplidor(){
  var f = (window._pagoSupFacturas || []).find(function(c){ return String(c.id) === String(window._pagoSupEscogida); });
  if(!f) return;
  var el = document.getElementById('pagosup-monto');
  if(el) el.value = saldoDeCompra(f).toFixed(2);
}

function aplicarPagoSuplidor(){
  var el = document.getElementById('pagosup-monto');
  var monto = el ? (parseFloat(String(el.value).replace(/[$,]/g, '')) || 0) : 0;
  if(!(monto > 0.005)){ alert('Escribe cuánto le pagaste.'); return; }
  if(!window._pagoSupMetodo){ alert('Escoge cómo le pagaste.'); return; }

  var comprasT = LS('nc', []);
  var c = comprasT.find(function(x){ return String(x.id) === String(window._pagoSupEscogida); });
  if(!c){ alert('No encontré esa factura.'); return; }
  var saldo = saldoDeCompra(c);

  // 🔴 NO se pasa el sobrante a otra factura: Sensei lo prohibio expresamente para suplidores.
  if(monto > saldo + 0.005){
    if(!confirm('Esa factura solo debe $' + fmtNum(saldo) + ' y escribiste $' + fmtNum(monto) + '.\n\n'
      + 'El sobrante NO se pasa a otra factura. ¿Guardar de todas formas?')) return;
  }

  var etiqueta = etiquetaMetodoCompra(window._pagoSupMetodo);
  if(!confirm('¿Pagar $' + fmtNum(monto) + ' de la factura del ' + (c.fecha || '') + ' con ' + etiqueta + '?')) return;

  var metodoElegido = window._pagoSupMetodo;
  var sidGuardado = window._pagoSupSid;
  protegerConHuella(function(){
    var todas = LS('nc', []);
    var real = todas.find(function(x){ return String(x.id) === String(window._pagoSupEscogida); });
    if(!real){ alert('No encontré esa factura.'); return; }
    if(!real.pagosFactura) real.pagosFactura = [];
    // La fecha que el escogio; si no la toca, queda la de hoy.
    var _elF = document.getElementById('pagosup-fecha');
    var _fechaPago = _elF && _elF.value ? fechaISOaUSA(_elF.value) : fechaHoy();
    real.pagosFactura.push({ pid: nuevoPagoId(), monto: monto, fecha: _fechaPago, metodo: metodoElegido });
    SS('nc', todas);
    cerrarPagoSuplidor();
    alert('✅ Pago de $' + fmtNum(monto) + ' con ' + etiqueta + ' aplicado a la factura del ' + (real.fecha || '') + '.');
    verSup(sidGuardado);
  });
}

// Devuelve las opciones de metodo de pago para una fila especifica -incluye "usar credito del
// cliente" SOLO si el cliente seleccionado en Vender tiene credito a favor disponible-.
function verHistorialCostoSuplidor(pid){
  if(pid === null || pid === undefined){ alert('No hay producto seleccionado.'); return; }
  loadProds();
  var prod = productos.find(function(x){ return String(x.id)===String(pid); });
  if(!prod){ alert('Producto no encontrado.'); return; }

  var compras = LS('nc', []);
  var registros = [];
  compras.forEach(function(c){
    (c.items||[]).forEach(function(it){
      if(String(it.pid)===String(pid)){
        registros.push({ suplidor: c.sn || 'Suplidor', costo: it.costo, fecha: c.fecha, cant: it.cant });
      }
    });
  });
  registros.sort(function(a,b){ return parsearFechaVenta(b.fecha) - parsearFechaVenta(a.fecha); });

  var overlay = document.getElementById('historial-costo-overlay');
  if(!overlay){
    overlay = document.createElement('div');
    overlay.id = 'historial-costo-overlay';
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
  titulo.innerHTML = '<div style="font-size:18px;font-weight:800;color:#6A1B9A">📊 Historial de Costo</div>'
    +'<div style="font-size:13px;color:#aaa;margin-top:2px">'+prod.nombre+' · Costo actual: $'+fmtNum(prod.costo)+'</div>';
  wrap.appendChild(titulo);

  if(!registros.length){
    var vacio = document.createElement('div');
    vacio.style.cssText = 'text-align:center;color:#ccc;padding:40px 20px;font-size:13px';
    vacio.textContent = 'Todavía no hay compras registradas de este producto. En cuanto registres una Compra que lo incluya, va a aparecer aquí.';
    wrap.appendChild(vacio);
  } else {
    // Resumen por suplidor: el costo mas reciente de cada uno, para comparar rapido
    var porSuplidor = {};
    registros.forEach(function(r){
      if(!porSuplidor[r.suplidor] || parsearFechaVenta(r.fecha) > parsearFechaVenta(porSuplidor[r.suplidor].fecha)){
        porSuplidor[r.suplidor] = r;
      }
    });
    var nombresSuplidores = Object.keys(porSuplidor);
    if(nombresSuplidores.length > 1){
      var resumen = document.createElement('div');
      resumen.style.cssText = 'background:#F3E5F5;border-radius:10px;padding:12px;margin:14px 0';
      resumen.innerHTML = '<div style="font-size:11px;color:#6A1B9A;font-weight:700;margin-bottom:8px">ÚLTIMO PRECIO DE CADA SUPLIDOR -para comparar-</div>'
        +nombresSuplidores.sort(function(a,b){ return porSuplidor[a].costo - porSuplidor[b].costo; }).map(function(s){
          return '<div style="display:flex;justify-content:space-between;padding:3px 0;font-size:13px"><span>'+s+'</span><span style="font-weight:700">$'+fmtNum(porSuplidor[s].costo)+'</span></div>';
        }).join('');
      wrap.appendChild(resumen);
    }

    var listaTitulo = document.createElement('div');
    listaTitulo.style.cssText = 'font-size:11px;color:#aaa;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin:16px 0 8px';
    listaTitulo.textContent = 'Historial completo de compras -más reciente primero-';
    wrap.appendChild(listaTitulo);

    registros.forEach(function(r){
      var card = document.createElement('div');
      card.style.cssText = 'background:#FAFAFA;border-radius:10px;padding:10px 12px;margin-bottom:6px;border:0.5px solid #eee;display:flex;justify-content:space-between;align-items:center';
      card.innerHTML = '<div><div style="font-size:13px;font-weight:700">'+r.suplidor+'</div>'
        +'<div style="font-size:11px;color:#aaa">'+r.fecha+' · '+r.cant+' unidad(es)</div></div>'
        +'<div style="font-size:15px;font-weight:800;color:#6A1B9A">$'+fmtNum(r.costo)+'</div>';
      wrap.appendChild(card);
    });
  }

  overlay.innerHTML = '';
  overlay.appendChild(wrap);
  overlay.style.display = 'block'; overlay.scrollTop = 0;
}

function detectarSuplidorFactura(textoCompleto){
  var T = textoCompleto.toUpperCase();
  for(var i = 0; i < SUPLIDORES_FACTURA.length; i++){
    var s = SUPLIDORES_FACTURA[i];
    for(var j = 0; j < s.senas.length; j++){
      if(T.indexOf(s.senas[j]) >= 0) return s;
    }
  }
  return null;
}

// Busca en la factura los cargos que NO son productos: el envio y el cargo por tarjeta.
// Sale de las facturas reales de Sensei: Vecina pone "Shipping Charges: 10.00" y Monkeys
// pone "Credicard Fee $30.17" -27 jul-.
// 💸 LOS DESCUENTOS QUE TRAE EL PDF DEL SUPLIDOR -Sensei, 19 ago-.
//
// LA SEÑAL: que el ULTIMO numero de la linea sea NEGATIVO. Ejemplo real de su factura de
// Kanar Online: "All reign pairs clipper and trimmer $155.00   -612.78". Ojo con ese $155.00
// del medio: hay que quedarse con el ULTIMO numero, no con el primero.
//
// POR QUE ESTAS LINEAS NO SE CUELAN COMO PRODUCTOS: leerLineaDeFactura exige que el total sea
// mayor que cero, asi que una linea que termina en negativo ya devolvia null. Aqui solo se
// recogen, no se le quita nada a nadie.
function descuentosDeLaFactura(lineas){
  var hallados = [];
  (lineas || []).forEach(function(l){
    var pal = l.palabras || [];
    if(!pal.length) return;
    var T = String(l.texto || '').toUpperCase();
    // El total, el balance y los pagos no son descuentos aunque salgan en negativo
    if(T.indexOf('TOTAL') >= 0 || T.indexOf('BALANCE') >= 0 || T.indexOf('AMOUNT DUE') >= 0) return;
    var neg = montoNegativoDeLinea(pal);
    if(!neg) return;
    var desc = pal.slice(0, neg.corte).map(function(p){ return p.t; }).join(' ')
                 .replace(/\s+/g,' ').trim();
    if(desc.length > 60) desc = desc.slice(0,60).trim();
    hallados.push({ desc: desc || 'Descuento', monto: neg.monto });
  });
  // 🔑 LO QUE SENSEI ESCOGIO -opcion B, 19 ago-: si vienen MAS DE TRES, se dejan los dos
  // primeros con su nombre y TODOS los demas se juntan en el tercero. Asi el total de la
  // factura siempre cuadra solo, sin que el tenga que sumar nada a mano.
  if(hallados.length > 3){
    var resto = hallados.slice(2);
    var suma = resto.reduce(function(a,x){ return a + x.monto; }, 0);
    hallados = hallados.slice(0,2).concat([{ desc: 'Otros descuentos (' + resto.length + ')', monto: suma }]);
  }
  return hallados;
}

function cargosDeLaFactura(lineas){
  var r = { envio: 0, tarjeta: 0 };
  var senasEnvio   = ['SHIPPING','FLETE','ENVIO','FREIGHT','DELIVERY CHARGE'];
  var senasTarjeta = ['CREDICARD','CREDIT CARD','CARD FEE','TARJETA','SURCHARGE','PROCESSING FEE'];
  lineas.forEach(function(l){
    var T = l.texto.toUpperCase();
    var esEnvio = senasEnvio.some(function(x){ return T.indexOf(x) >= 0; });
    var esTarjeta = senasTarjeta.some(function(x){ return T.indexOf(x) >= 0; });
    if(!esEnvio && !esTarjeta) return;
    // El ultimo numero de la linea es el monto
    var pal = l.palabras, monto = null;
    for(var j = pal.length - 1; j >= 0; j--){
      if(esNumeroFactura(pal[j].t)){ monto = aNumero(pal[j].t); break; }
    }
    if(monto === null || !(monto > 0)) return;
    if(esTarjeta) r.tarjeta += monto; else r.envio += monto;
  });
  return r;
}

// Busca el Subtotal impreso, para la segunda comprobacion
function subtotalImpreso(lineas){
  for(var i = lineas.length - 1; i >= 0; i--){
    var T = lineas[i].texto.toUpperCase();
    if(T.indexOf('SUBTOTAL') >= 0){
      var pal = lineas[i].palabras;
      for(var j = pal.length - 1; j >= 0; j--){
        if(esNumeroFactura(pal[j].t)){
          var v = aNumero(pal[j].t);
          if(v > 0) return v;
        }
      }
    }
  }
  return null;
}

// ── Emparejar con el catalogo de Sensei ──
// OJO: NO llamarla normalizarTexto. Ya existe una funcion con ese nombre para el
// buscador de la Ayuda -linea ~7603-, que devuelve MINUSCULAS. Al ponerle el mismo
// nombre a esta, la de la Ayuda quedaba pisada y sus SINONIMOS dejaban de funcionar
// -buscar "editar" ya no encontraba "cambiar" ni "modificar"-. Encontrado en la
// auditoria del 27 jul. Esta devuelve MAYUSCULAS y es solo para facturas.
function buscarProductoParecido(supId, desc){
  loadProds();
  var aprendidos = emparejadosGuardados();
  var guardado = aprendidos[supId + '|' + normTextoFactura(desc)];
  if(guardado){
    var yaEsta = productos.find(function(p){ return String(p.id) === String(guardado); });
    if(yaEsta) return { pid: yaEsta.id, comoLoSupo: 'aprendido' };
  }
  return null;
}

// Los productos que MAS SE PARECEN, para ponerlos de primeros en la lista y que Sensei
// no tenga que buscar entre 386. No escoge por el: solo se los acerca.
function nuevaCompraASuplidor(sid, abrirPdf){
  function seguir(){
    ir('p-comp');
    setTimeout(function(){
      var sel = document.getElementById('ccsup');
      if(sel) sel.value = String(sid);
      if(abrirPdf) setTimeout(abrirLectorFactura, 250);
    }, 120);
  }

  if(iCC.length){
    var sel = document.getElementById('ccsup');
    var mismoSuplidor = sel && String(sel.value) === String(sid);
    if(mismoSuplidor){ seguir(); return; }   // es la misma compra, no hay nada que mezclar

    suplidores = LS('nsup', []);
    var nombreViejo = '';
    if(sel && sel.value){
      var sv = suplidores.find(function(x){ return String(x.id) === String(sel.value); });
      if(sv) nombreViejo = ' a ' + sv.nombre;
    }
    var nuevo = suplidores.find(function(x){ return String(x.id) === String(sid); });
    var nombreNuevo = nuevo ? nuevo.nombre : 'este suplidor';

    preguntarDescartarCompra(iCC.length, nombreViejo, nombreNuevo, function(){
      iCC.length = 0;
      renderICC();
      seguir();
    });
    return;
  }
  seguir();
}

function preguntarDescartarCompra(cuantos, nombreViejo, nombreNuevo, alDescartar){
  // Se apunta el suplidor que ya tenia escogido: al volver a la pantalla de Compras se
  // vuelve a dibujar la lista y se perdia la seleccion -bug encontrado en pruebas-.
  var selAntes = document.getElementById('ccsup');
  var valorAntes = selAntes ? selAntes.value : '';
  var ov = document.getElementById('descartar-compra-ov');
  if(!ov){
    ov = document.createElement('div');
    ov.id = 'descartar-compra-ov';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:99993;display:flex;align-items:center;justify-content:center;padding:20px';
    document.body.appendChild(ov);
  }
  ov.innerHTML = '<div style="background:#fff;border-radius:16px;padding:20px;max-width:380px;width:100%">'
    + '<div style="font-size:15px;font-weight:800;color:#1a237e;margin-bottom:8px">⚠️ Tienes una compra a medias</div>'
    + '<div style="font-size:13.5px;color:#555;line-height:1.45;margin-bottom:16px">Hay <b>' + cuantos + '</b> renglón(es) sin guardar'
    + escaparHtml(nombreViejo) + '.<br><br>Si empiezas una compra a <b>' + escaparHtml(nombreNuevo) + '</b>, esos renglones se pierden.</div>'
    + '<button id="desc-seguir" style="width:100%;padding:13px;border:none;border-radius:10px;background:#1565C0;color:#fff;font-weight:800;font-size:13.5px;cursor:pointer;margin-bottom:8px">Seguir con la que tengo</button>'
    + '<button id="desc-tirar" style="width:100%;padding:13px;border:2px solid #C62828;border-radius:10px;background:#fff;color:#C62828;font-weight:800;font-size:13.5px;cursor:pointer">Descartarlos y empezar la nueva</button>'
    + '</div>';
  ov.style.display = 'flex';
  document.getElementById('desc-seguir').onclick = function(){
    ov.remove();
    ir('p-comp');
    setTimeout(function(){
      var sel = document.getElementById('ccsup');
      if(sel && valorAntes) sel.value = valorAntes;   // se lo devolvemos tal como estaba
    }, 120);
  };
  document.getElementById('desc-tirar').onclick = function(){ ov.remove(); alDescartar(); };
}

// ── LA PANTALLA DE REVISION DE LA FACTURA (27 jul) ──
// Nada entra solo a la compra: Sensei revisa linea por linea y confirma.

function procesarPdfFactura(input){
  var file = input.files && input.files[0];
  if(!file) return;
  var nombre = (file.name || '').toLowerCase();
  if(nombre.slice(-4) !== '.pdf' && (file.type || '').indexOf('pdf') < 0){
    avisoGrande('📄 Eso no es un PDF.\n\nEscogiste: ' + (file.name || 'un archivo') + '\n\nBusca el PDF que te mandó el suplidor por correo.');
    input.value = '';
    return;
  }

  mostrarCargandoRuta('📄 Abriendo la factura...');
  var lector = new FileReader();
  lector.onload = function(ev){
    var datos = new Uint8Array(ev.target.result);
    mostrarCargandoRuta('📄 Leyendo la factura...');
    cargarPdfJs()
      .then(function(){ return sacarLineasDelPdf(datos); })
      .then(function(lineas){
        cerrarCargandoRuta();
        analizarFacturaYMostrar(lineas);
      })
      .catch(function(err){
        cerrarCargandoRuta();
        var c = (err && err.message) || 'UNKNOWN';
        var m = {
          'SIN_RED':      'No se pudo descargar el lector de PDF. Revisa tu señal e inténtalo de nuevo.\n\nLa primera vez hace falta internet; después queda guardado.',
          'SIN_LIBRERIA': 'El lector de PDF se descargó incompleto. Cierra la app, ábrela de nuevo e inténtalo.',
          'TARDO':        'Tardó demasiado en cargar el lector. Puede ser señal lenta — inténtalo otra vez.'
        };
        avisoGrande('📄 ' + (m[c] || ('No se pudo leer ese PDF (' + c + ').\n\nSi el suplidor te mandó una FOTO escaneada en vez de un PDF de texto, no hay texto que leer y hay que meterlo a mano.')));
      });
  };
  lector.onerror = function(){ cerrarCargandoRuta(); avisoGrande('📄 No se pudo abrir ese archivo.'); };
  lector.readAsArrayBuffer(file);
  input.value = '';
}

// 📅 SACAR LA FECHA DE LA FACTURA DEL PDF  (2 sep 2026)
//
// Sensei: cuando lee una factura PDF de un suplidor, la fecha se pone con la de HOY —
// pero la factura ES de otro día, y esa fecha VIENE IMPRESA en el papel.
// Sería tonto que la escriba a mano teniendo el PDF delante.
//
// 🔑 Esto la busca en el texto del PDF. Si la encuentra, la pone. Si no, se queda la
// de hoy y él la cambia — nunca se queda sin nada.

var MESES_FACTURA = {
  jan:1, january:1, ene:1, enero:1,
  feb:2, february:2, febrero:2,
  mar:3, march:3, marzo:3,
  apr:4, april:4, abr:4, abril:4,
  may:5, mayo:5,
  jun:6, june:6, junio:6,
  jul:7, july:7, julio:7,
  aug:8, august:8, ago:8, agosto:8,
  sep:9, sept:9, september:9, septiembre:9,
  oct:10, october:10, octubre:10,
  nov:11, november:11, noviembre:11,
  dec:12, december:12, dic:12, diciembre:12
};

// ¿Es una fecha con sentido? Ni del futuro lejano ni de hace diez años.
function fechaDeLaFactura(texto){
  if(!texto) return null;
  var T = String(texto);

  // Las que van pegadas a un rótulo valen más: se buscan primero.
  var rotulos = ['invoice date', 'fecha de factura', 'fecha factura', 'order date',
                 'fecha de la factura', 'date of invoice', 'bill date', 'fecha:'];

  var candidatas = [];   // { fecha:'MM/DD/AAAA', puntos: n }

  function anotar(a, m, d, puntos){
    if(!_fechaTieneSentido(a, m, d)) return;
    candidatas.push({ fecha: _mmddaaaa(a, m, d), puntos: puntos });
  }

  // ── Formato 1: 08/28/2026 · 8-28-26 · 08.28.2026 ──
  var re1 = /(\d{1,2})\s*[\/\-.]\s*(\d{1,2})\s*[\/\-.]\s*(\d{2,4})/g;
  var m1;
  while((m1 = re1.exec(T))){
    var p1 = parseInt(m1[1], 10), p2 = parseInt(m1[2], 10), a1 = parseInt(m1[3], 10);
    if(a1 < 100) a1 += 2000;
    var antes = T.slice(Math.max(0, m1.index - 40), m1.index).toLowerCase();
    var puntos = 0;
    rotulos.forEach(function(r){ if(antes.indexOf(r) >= 0) puntos += 10; });
    // En Estados Unidos es MM/DD; si el primero pasa de 12, entonces era DD/MM
    if(p1 > 12) anotar(a1, p2, p1, puntos);
    else anotar(a1, p1, p2, puntos);
  }

  // ── Formato 2: 2026-08-28 (el que usan los sistemas) ──
  var re2 = /(\d{4})\s*-\s*(\d{1,2})\s*-\s*(\d{1,2})/g;
  var m2;
  while((m2 = re2.exec(T))){
    var antes2 = T.slice(Math.max(0, m2.index - 40), m2.index).toLowerCase();
    var pt2 = 0;
    rotulos.forEach(function(r){ if(antes2.indexOf(r) >= 0) pt2 += 10; });
    anotar(parseInt(m2[1], 10), parseInt(m2[2], 10), parseInt(m2[3], 10), pt2);
  }

  // ── Formato 3: August 28, 2026 · 28 AUG 2026 · 28-Aug-26 ──
  var re3 = /([A-Za-zÁÉÍÓÚáéíóú]{3,12})\.?\s*[\s\-]\s*(\d{1,2})\s*[,\s\-]\s*(\d{2,4})/g;
  var m3;
  while((m3 = re3.exec(T))){
    var mes3 = MESES_FACTURA[m3[1].toLowerCase()];
    if(!mes3) continue;
    var a3 = parseInt(m3[3], 10);
    if(a3 < 100) a3 += 2000;
    var antes3 = T.slice(Math.max(0, m3.index - 40), m3.index).toLowerCase();
    var pt3 = 2;   // los meses con letras casi nunca son otra cosa
    rotulos.forEach(function(r){ if(antes3.indexOf(r) >= 0) pt3 += 10; });
    anotar(a3, mes3, parseInt(m3[2], 10), pt3);
  }

  // ── Formato 3b: 28-Aug-26 · 28 AUG 2026 — aquí el DÍA va primero ──
  // Lo usan varios suplidores, y sin esto se escapaba. -2 sep-
  var re3b = /(\d{1,2})\s*[\s\-]\s*([A-Za-z\u00c1\u00c9\u00cd\u00d3\u00da\u00e1\u00e9\u00ed\u00f3\u00fa]{3,12})\.?\s*[\s\-,]\s*(\d{2,4})/g;
  var m3b;
  while((m3b = re3b.exec(T))){
    var mes3b = MESES_FACTURA[m3b[2].toLowerCase()];
    if(!mes3b) continue;
    var a3b = parseInt(m3b[3], 10);
    if(a3b < 100) a3b += 2000;
    var antes3b = T.slice(Math.max(0, m3b.index - 40), m3b.index).toLowerCase();
    var pt3b = 2;
    rotulos.forEach(function(r){ if(antes3b.indexOf(r) >= 0) pt3b += 10; });
    anotar(a3b, mes3b, parseInt(m3b[1], 10), pt3b);
  }

  // ── Formato 4: 28 de agosto de 2026 ──
  var re4 = /(\d{1,2})\s+de\s+([A-Za-zÁÉÍÓÚáéíóú]{3,12})\s+de\s+(\d{4})/gi;
  var m4;
  while((m4 = re4.exec(T))){
    var mes4 = MESES_FACTURA[m4[2].toLowerCase()];
    if(!mes4) continue;
    anotar(parseInt(m4[3], 10), mes4, parseInt(m4[1], 10), 3);
  }

  if(!candidatas.length) return null;

  // Gana la que tenga más puntos; si empatan, la primera que salió en el papel
  candidatas.sort(function(x, y){ return y.puntos - x.puntos; });
  return candidatas[0].fecha;
}

// Para el aviso: pasa MM/DD/AAAA al formato del calendario, AAAA-MM-DD
function analizarFacturaYMostrar(lineas){
  var textoCompleto = lineas.map(function(l){ return l.texto; }).join('\n');

  // \ud83d\udcc5 LA FECHA SALE DE LA PROPIA FACTURA -Sensei, 2 sep-. Su caso: lee el PDF de un
  // suplidor y la fecha se ponia con la de HOY, cuando la factura es de dias antes y su
  // fecha VIENE IMPRESA en el papel. Si se encuentra, se pone sola; si no, se queda la de
  // hoy y el la cambia.
  window._fechaDelPdf = null;
  try {
    var _f = fechaDeLaFactura(textoCompleto);
    if(_f){
      window._fechaDelPdf = _f;
      var _campo = document.getElementById('cc-fecha');
      if(_campo) _campo.value = _aFormatoCalendario(_f);
    }
  } catch(e){}

  var sup = detectarSuplidorFactura(textoCompleto);
  var supId = sup ? sup.id : 'desconocido';
  var ignorar = (sup && sup.ignorarLineas) || [];

  var items = [];
  lineas.forEach(function(l){
    var T = l.texto.toUpperCase();
    var saltar = false;
    ignorar.forEach(function(x){ if(T.indexOf(x) >= 0) saltar = true; });
    // Encabezados y pies que nunca son productos
    ['SUBTOTAL','TOTAL','QTY','QUANTITY','DESCRIPTION','SHIPPING','TAX','INVOICE #','ORDER #','BILL TO','SHIP TO','TOTAL UNITS'].forEach(function(x){
      if(T.indexOf(x) >= 0) saltar = true;
    });
    if(saltar) return;
    var it = leerLineaDeFactura(l);
    if(it) items.push(it);
  });

  if(!items.length){
    avisoGrande('📄 No encontré renglones de productos en ese PDF.\n\nPuede ser que el suplidor lo haya mandado como foto escaneada, o que su formato sea distinto a los que conozco.\n\nMándale el PDF a Claude y le agrego la receta de ese suplidor.');
    return;
  }

  // Emparejar con el catalogo
  items.forEach(function(it){
    var m = buscarProductoParecido(supId, it.descripcion);
    it.pid = m ? m.pid : null;
    it.comoLoSupo = m ? m.comoLoSupo : null;
    it.marcado = true;
  });

  var sub = subtotalImpreso(lineas);
  window._facturaCargos = cargosDeLaFactura(lineas);
  window._facturaDescuentos = descuentosDeLaFactura(lineas);
  window._facturaItems = items;
  window._facturaSup = { id: supId, nombre: sup ? sup.nombre : 'Suplidor no reconocido' };
  window._facturaSubtotal = sub;
  pintarRevisionFactura();
}

// 📅 Si Sensei corrige la fecha en la pantalla de revision, se lleva al campo
// de la compra, que es de donde sale al guardar. -2 sep-
function agregarFacturaALaCompra(){
  var items = (window._facturaItems || []).filter(function(it){ return it.marcado; });
  if(!items.length){ avisoGrande('No marcaste ningún renglón.'); return; }

  var sinProducto = items.filter(function(it){ return !it.pid && !it.esNuevo; });
  if(sinProducto.length){
    avisoGrande('⚠️ ' + sinProducto.length + ' renglón(es) no tienen producto escogido:\n\n'
      + sinProducto.slice(0,5).map(function(it){ return '• ' + it.descripcion; }).join('\n')
      + '\n\nEscoge el producto en la lista, o marca "Es un producto nuevo", o desmárcalos.');
    return;
  }

  // Dos renglones de la MISMA factura apuntando al MISMO producto casi siempre es un
  // emparejado equivocado -presentaciones distintas del mismo articulo-. Antes se sumaban
  // calladas y quedaba una cantidad inflada con el costo del ultimo. Ahora se avisa y no
  // se agrega nada hasta que Sensei lo corrija.
  var vistos = {}, repetidos = [];
  items.forEach(function(it){
    if(!it.pid) return;
    if(vistos[it.pid]) repetidos.push([vistos[it.pid], it.descripcion]);
    else vistos[it.pid] = it.descripcion;
  });
  if(repetidos.length){
    loadProds();
    var texto = repetidos.map(function(par){
      return '• "' + par[0] + '"\n  y\n• "' + par[1] + '"';
    }).join('\n\n');
    avisoGrande('⚠️ Dos renglones apuntan al MISMO producto tuyo:\n\n' + texto
      + '\n\nCasi siempre son presentaciones distintas -por ejemplo 5lb y 32oz-. Escoge el producto correcto en cada uno, o desmarca el que no vaya.\n\nNo se agregó nada todavía.');
    return;
  }

  loadProds();
  var agregados = 0;
  items.forEach(function(it){
    if(it.pid){
      var prod = productos.find(function(p){ return String(p.id) === String(it.pid); });
      if(!prod) return;
      var yaEsta = false;
      for(var j = 0; j < iCC.length; j++){
        if(String(iCC[j].pid) === String(it.pid)){
          iCC[j].cant += it.cant; iCC[j].costo = it.costo; yaEsta = true; break;
        }
      }
      if(!yaEsta){
        iCC.push({ pid: prod.id, nombre: prod.nombre, cant: it.cant, costo: it.costo,
                   esNuevo: false, precioVenta: prod.precio });
      }
    } else {
      // Con lo que Sensei puso en el formulario, para que el producto nazca completo
      iCC.push({ pid: null, nombre: it.nombreNuevo || it.descripcion,
                 cat: it.catNueva || '', marca: it.marcaNueva || '',
                 cant: it.cant, costo: it.costo, esNuevo: true,
                 precioVenta: it.precioVentaNuevo || 0 });
    }
    agregados++;
  });

  // Poner los cargos de la factura en sus campos -27 jul-
  var cg = window._facturaCargos || { envio: 0, tarjeta: 0 };
  var puestos = '';
  if(cg.envio > 0){
    var elEnv = document.getElementById('cc-envio');
    if(elEnv){ elEnv.value = cg.envio.toFixed(2); puestos += '\n🚚 Envío: $' + fmtNum(cg.envio); }
  }
  var dsPdf = window._facturaDescuentos || [];
  if(dsPdf.length){
    // Se abre solo para que VEA los descuentos que se le pusieron. -29 ago-
    try { abrirBloqueCompra('cc-bloque-extras', 'cc-btn-extras'); } catch(e){}
    for(var iDp = 0; iDp < 3; iDp++){
      var elDd = document.getElementById('cc-desc' + (iDp+1));
      var elDm = document.getElementById('cc-descm' + (iDp+1));
      if(dsPdf[iDp]){
        if(elDd) elDd.value = dsPdf[iDp].desc || 'Descuento';
        if(elDm) elDm.value = Number(dsPdf[iDp].monto).toFixed(2);
        puestos += '\n\ud83d\udcb8 ' + (dsPdf[iDp].desc || 'Descuento') + ': \u2212$' + fmtNum(dsPdf[iDp].monto);
      }
    }
  }
  if(cg.tarjeta > 0){
    var elTar = document.getElementById('cc-tarjeta');
    if(elTar){ elTar.value = cg.tarjeta.toFixed(2); puestos += '\n💳 Cargo por tarjeta: $' + fmtNum(cg.tarjeta); }
  }

  window._facturaItems = null;      // ya se agregaron: no hay nada a medias
  window._facturaDescuentos = null;
  cerrarRevisionFactura();
  renderICC();
  avisoGrande('✓ Se agregaron ' + agregados + ' renglones a la compra.'
    + (puestos ? '\n\nTambién se pusieron:' + puestos : '')
    + '\n\nRevísalos abajo y guarda la compra cuando estés listo.');
}

// ═══ NAVEGAR LA RUTA — Google Maps y Waze (27 jul, pedido de Sensei) ═══
//
// LA DIFERENCIA ENTRE LOS DOS -verificada en la documentacion de ambos-:
//   · GOOGLE MAPS si acepta rutas de VARIAS paradas, por el parametro waypoints.
//     Tope: 9 paradas intermedias, o sea 10 paradas en total por enlace.
//   · WAZE NO acepta varias paradas. Su enlace solo admite UN destino. No es
//     limitacion nuestra: Waze no tiene ese parametro. Por eso Waze se ofrece
//     parada por parada, que ademas encaja con como trabaja Sensei -se baja,
//     atiende 20 minutos, y sigue-.
//
// Si un dia tiene MAS de 10 paradas en un mismo dia, la ruta se parte sola en
// tramos de 10, y cada tramo arranca donde termino el anterior para que no
// quede ningun hueco.

var MAX_PARADAS_MAPS = 10;   // 9 intermedias + la de destino

// Parte la lista en tramos que Google Maps si acepta. Cada tramo despues del
// primero arranca en la ULTIMA parada del anterior, para que la ruta siga
// completa sin saltos.