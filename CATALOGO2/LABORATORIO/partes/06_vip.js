
function normVIP(t){
  return String(t || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

// Palabras que dicen VARIANTE, no tipo: colores, tamanos, "original". Ahi se corta.
// Gracias a esto "Papel CUELLO verde" y "Papel CUELLO negro" son el MISMO tipo
// -PAPEL CUELLO-, pero "Papel TOALLA" es otro; y "Guante MEDIANO" y "Guante LARGE"
// son el mismo -GUANTE-, porque mediano y large son tamanos. -6 ago, lo precisó Sensei-
var VIP_VARIANTES = ('negro negra blanco blanca rojo roja verde azul amarillo amarilla '
  + 'dorado dorada gold plateado morado morada rosado rosa naranja orange gris cafe marron '
  + 'transparente clear pequeno pequena grande mediano mediana chico chica large small medium '
  + 'xl xxl mini maxi oscuro oscura claro clara nuevo nueva original').split(' ');

// El TIPO de un producto, para agrupar el VIP.
//
// 🔴 ANTES ESTO USABA UNA LISTA CERRADA y todo lo que no estaba en ella se caia del
// programa: "Papel cuello", "Guante", "Cool Care"... El 38% de las unidades de $10
// no contaban y Sensei quedaba mal con sus clientes. -6 ago-
//
// AHORA:
//   1. Si el nombre trae una palabra conocida -wax, gel, colonia...- esa es el tipo,
//      aunque vaya al FINAL: "Immortal Chaos sea salt WAX" -> WAX.
//   2. Si no, se le quita la marca y se toman hasta DOS palabras, cortando en cuanto
//      llega un color, un tamano o un numero.
//   3. Y si despues de eso no queda nada -el producto se llama solo por su variante,
//      como "Alcohol Grande clear"-, se usa el nombre completo sin la marca.
function tipoVIPdeNombre(nombre, marca){
  var n = normVIP(nombre);
  if(!n) return null;

  for(var i = 0; i < VIP_TIPOS.length; i++){
    if(n.indexOf(VIP_TIPOS[i]) >= 0) return VIP_TIPOS[i].toUpperCase();
  }

  var pal = n.split(' ');
  var m = normVIP(marca).split(' ').filter(function(x){ return x; });
  var i2 = 0;
  while(i2 < m.length && i2 < pal.length && pal[i2] === m[i2]) i2++;
  var resto = (i2 < pal.length) ? pal.slice(i2) : pal;

  var out = [];
  for(var j2 = 0; j2 < resto.length; j2++){
    var w = resto[j2];
    if(!w) continue;
    if(/^[0-9]+$/.test(w)) break;
    if(VIP_VARIANTES.indexOf(w) >= 0) break;
    out.push(w);
    if(out.length === 2) break;
  }
  if(out.length) return out.join(' ').toUpperCase();

  // Nada quedo: el nombre es puro tamano o color. Se usa lo que hay, sin la marca.
  return resto.length ? resto.join(' ').toUpperCase() : n.toUpperCase();
}

// ¿Es una navaja CORTADA de $5? Esas van aparte, por producto exacto.
function esNavajaCortadaVIP(nombre, precio){
  if(Math.abs((parseFloat(precio) || 0) - VIP_PRECIO_MITAD) > 0.02) return false;
  var n = String(nombre || '').toLowerCase();
  return (n.indexOf('navaja') >= 0 || n.indexOf('blade') >= 0)
      && (n.indexOf('cortad') >= 0 || n.indexOf('cut') >= 0);
}

// ¿Este cliente entra al programa? Las cuentas de CONSIGNACION no.
// ═══════════════════════════════════════════════════════════════════
//  BARBEROS A LOS QUE YA NO SE LES DA SERVICIO  (8 ago 2026)
//
//  Sensei: "hay barberos que se han mudado de barbershop y no les voy a
//  seguir dando servicio". Antes lo unico que podia hacer era ELIMINARLOS,
//  y eso le borraba su historial y lo que le debian.
//
//  Ahora se marcan como SIN SERVICIO. Desaparecen de donde estorban —los
//  pedidos, la ruta, el VIP— pero NO de su dinero: si le deben, siguen en
//  Cuentas por Cobrar hasta que paguen, y su historial queda intacto.
//  Sensei lo confirmo: "debe aparecer en cuentas por cobrar hasta que me
//  pague, claro que si".
// ═══════════════════════════════════════════════════════════════════
function clienteCuentaVIP(c){
  // Ni las cuentas de CONSIGNACION ni los barberos SIN SERVICIO entran a los
  // programas -ni el VIP de productos ni el de los $400-. -8 ago-
  if(!c) return true;
  if(c.consignacion === true) return false;
  if(c.sinServicio === true) return false;
  return true;
}

// La clave del grupo de un renglon vendido. Devuelve null si ese renglon no cuenta.
// Dibuja los productos exactos de un grupo VIP, con su nombre COMPLETO y cuántos
// lleva de cada uno. Asi Sensei ve que compra de verdad el cliente y puede decidir
// si le adelanta el regalo o espera. -7 ago-
function detalleProdsVIP(p, chico){
  if(!p || !p.prods) return '';
  var nombres = Object.keys(p.prods).filter(function(n){ return p.prods[n] > 0; });
  if(!nombres.length) return '';
  nombres.sort(function(a,b){ return p.prods[b] - p.prods[a]; });
  var fs = chico ? '10.5px' : '11.5px';
  return '<div style="margin-top:4px;padding-left:2px">'
    + nombres.map(function(n){
        return '<div style="display:flex;justify-content:space-between;gap:6px;font-size:' + fs + ';color:#777;line-height:1.5">'
          + '<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">\u00b7 '
          +   escaparHtml(n) + '</span>'
          + '<span style="flex-shrink:0;font-weight:700;color:#555">\u00d7' + p.prods[n] + '</span>'
          + '</div>';
      }).join('')
    + '</div>';
}

// ═══════════════════════════════════════════════════════════════════
//  🎁 EL PROGRAMA VIP — LAS REGLAS DE SENSEI  (3 sep 2026)
//
//  Él las dictó completas y son las que mandan. Sustituyen a todas las anteriores.
//
//  ── QUÉ PRECIO CUENTA ──
//    $10.00 (o $9.99) → 1 punto por unidad
//    $5.00            → SOLO navajas · 2 unidades = 1 punto
//
//  ── LA REGLA DE ORO ──
//    MISMA MARCA + MISMA CATEGORÍA = suman juntos.
//    El nombre no importa. Ser "para el pelo" NO basta.
//
//  ── LAS 8 CATEGORÍAS ──
//    HAIR GEL   · hair gel, gelatina, gel para el pelo, Eco Krystal, olive gel
//    WAX/CREAM  · wax, cream wax, cream, crema, cera, matte clay, paste,
//                 pomade, pomada        (todos para el pelo, van juntos)
//    COLONIA    · colonia, cologne, after shave colonia
//    AFTER SHAVE· after shave cream, lotion, balm
//    LEAVE IN
//    TWO PHASE  · two phase conditioner
//    NAVAJA     · navajas, blades  ($10 = 1 pt · $5 = 2 por 1)
//    PAPEL CUELLO · papel de cuello, neck strips (los colores suman juntos)
//
//  ── LO QUE NO CUENTA ──
//    shaving gel/cream/foam · hair spray · styling powder · mousse · shampoo
//    conditioner (que no sea two phase) · oil sheen · neck duster · hand mirror
//    cepillo · brocha · sprayers · clipper spray · blade care · cool care · talco
//    peines · guías · tintes · y TODO lo que no esté en las 8 de arriba.
//
//  ── RETROACTIVO ──
//    Cuenta desde JUNIO 2026, aunque el cliente no esté inscrito. Al inscribirlo,
//    aparecen sus puntos ya acumulados.
// ═══════════════════════════════════════════════════════════════════

var VIP_DESDE = new Date(2026, 5, 1);   // 1 de junio de 2026

// Los nombres bonitos de cada categoría, para enseñárselos
var VIP_CATEGORIAS = {
  'HAIR GEL':     'Hair gel',
  'WAX/CREAM':    'Wax y cream de pelo',
  'COLONIA':      'Colonias',
  'AFTER SHAVE':  'After shave',
  'LEAVE IN':     'Leave in',
  'TWO PHASE':    'Two phase',
  'NAVAJA':       'Navajas',
  'PAPEL CUELLO': 'Papel de cuello'
};

/**
 * La CATEGORÍA VIP de un producto, o null si no cuenta.
 *
 * 🔑 Si el producto tiene grupo puesto A MANO (Sensei lo corrigió en su ficha),
 * ese manda siempre — porque él conoce sus productos y la app solo lee palabras.
 */
function categoriaVIP(nombre, precio, prod){
  // ① Lo que él haya dicho a mano gana
  if(prod && prod.grupoVIP){
    return (prod.grupoVIP === 'NO') ? null : prod.grupoVIP;
  }

  var pr = parseFloat(precio) || 0;
  var es10 = Math.abs(pr - 10) < 0.02 || Math.abs(pr - 9.99) < 0.02;
  var es5  = Math.abs(pr - 5) < 0.02;
  if(!es10 && !es5) return null;

  var n = String(nombre || '').toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  var esNavaja = (/navaja|blade/.test(n)) && !/blade\s*care/.test(n);

  // ② Los de $5: SOLO navajas
  if(es5) return esNavaja ? 'NAVAJA' : null;

  // ③ Lo que NO cuenta, antes que nada — el orden importa
  if(/shaving\s*(gel|cream|foam)|shave\s*gel|squeeze\s*shave/.test(n)) return null;
  if(/hair\s*spray|styling\s*powder|\bmousse\b|shampoo|oil\s*sheen|\btinte\b|tintation/.test(n)) return null;
  if(/neck\s*duster|hand\s*mirror|cepillo|brocha|sprayer|clipper\s*spray|blade\s*care|cool\s*care|\btalco\b|peine|comb|guide/.test(n)) return null;

  // ④ Las 8 categorías, de lo más específico a lo más general
  if(/leave\s*[-\s]?in/.test(n)) return 'LEAVE IN';
  if(/two\s*phase|bi[-\s]?fasico|bifasico/.test(n)) return 'TWO PHASE';
  if(/conditioner|acondicionador/.test(n)) return null;   // conditioner suelto no cuenta

  if(/hair\s*gel|gelatina|gel\s*para\s*el\s*pelo|eco\s*krystal|olive/.test(n)) return 'HAIR GEL';

  // La colonia gana al after shave: "after shave cologne" es COLONIA
  if(/colonia|cologne/.test(n)) return 'COLONIA';
  if(/after\s*shave|\bbalm\b|balsam/.test(n)) return 'AFTER SHAVE';

  if(/\bwax\b|\bcera\b|matte\s*clay|\bpaste\b|pomade|pomada|\bcream\b|\bcrema\b/.test(n)) return 'WAX/CREAM';

  if(esNavaja) return 'NAVAJA';
  if(/papel\s*(de\s*)?cuello|neck\s*strip/.test(n)) return 'PAPEL CUELLO';

  // ⑤ Lo demás NO cuenta. Él fue claro: "ningún otro producto que no te haya
  //    mencionado va".
  return null;
}

/**
 * El grupo al que suma un renglón vendido: CATEGORÍA + MARCA.
 * Devuelve null si ese producto no cuenta para el VIP.
 */
function grupoVIPdeItem(it, prod){
  var precio = parseFloat(it.precio) || 0;
  // El nombre de HOY, no el de la factura vieja: si Sensei corrigió el nombre de un
  // producto, esa corrección cuenta también en las compras que ya se hicieron.
  var nomHoy = (prod && prod.nombre) ? String(prod.nombre) : String(it.nombre || '');

  var cat = categoriaVIP(nomHoy, precio, prod);
  if(!cat) return null;

  var marca = (prod && prod.marca) ? String(prod.marca).trim() : '';
  if(!marca) marca = String(nomHoy).trim().split(/\s+/)[0] || '';
  if(!marca) marca = '?';
  marca = marca.toUpperCase();

  var esMitad = Math.abs(precio - 5) < 0.02;

  return {
    clave: cat + '|' + marca,
    categoria: cat,
    marca: marca,
    nombre: marca + ' \u00b7 ' + (VIP_CATEGORIAS[cat] || cat),
    mitad: esMitad
  };
}

function claveGrupoVIP(it, prod){
  var precio = parseFloat(it.precio) || 0;

  // 🔑 EL NOMBRE DE HOY, no el de la factura vieja. Sensei corrige nombres de
  // productos -por ejemplo para que un wax diga "wax"- y esa corrección tiene que
  // contar también en las compras que ya hizo el cliente. La FACTURA sigue diciendo
  // lo que decía; lo único que cambia es cómo se AGRUPA para los puntos. -18 ago-
  var _nomHoy = (prod && prod.nombre) ? String(prod.nombre) : String(_nomHoy || '');

  if(esNavajaCortadaVIP(_nomHoy, precio)){
    return { clave: 'NAV|' + String(it.pid),
             nombre: String(_nomHoy || 'Navajas cortadas'), mitad: true };
  }

  var esDiez = VIP_PRECIOS.some(function(p){ return Math.abs(precio - p) < 0.02; });
  if(!esDiez) return null;

  var marca = (prod && prod.marca) ? String(prod.marca).trim() : '';
  if(!marca){
    // Sin marca en la ficha: se usa la PRIMERA palabra del nombre, que casi siempre
    // es la marca. Asi un producto al que se le olvido la marca no se queda fuera.
    marca = String(_nomHoy || '').trim().split(/\s+/)[0] || '';
  }
  if(!marca) return null;

  var tipo = tipoVIPdeNombre(_nomHoy, marca);
  if(!tipo) tipo = 'OTROS';   // nunca se cae un producto de $10 por no reconocerle el tipo

  // 🔑 LOS TIPOS QUE SE JUNTAN SIN IMPORTAR LA MARCA (Sensei, 16 ago).
  // Solo estos tres: colonia, wax y el cuidado de cuchilla. Todo lo demás sigue
  // agrupándose por marca + tipo, como siempre, para no destapar líos donde no los hay.
  var _n = normVIP(_nomHoy);
  var _porTipo = null;

  // "cool care" y "blade care" son LO MISMO — él lo dijo así. Ojo: hay que separarlos
  // de las NAVAJAS de verdad, que sí van por marca. La diferencia es la palabra "care".
  if(_n.indexOf('care') >= 0
     && (_n.indexOf('blade') >= 0 || _n.indexOf('cool') >= 0 || _n.indexOf('clipper') >= 0)){
    _porTipo = 'CUIDADO DE CUCHILLA';
  } else if(_n.indexOf('colonia') >= 0 || _n.indexOf('cologne') >= 0){
    _porTipo = 'COLONIA';
  } else if(_n.indexOf('wax') >= 0 || _n.indexOf('cera') >= 0){
    _porTipo = 'WAX';
  }

  if(_porTipo){
    // Se guarda la marca aparte para poder enseñársela, pero NO entra en la clave:
    // así todos los wax de todas las marcas suman al mismo grupo.
    return { clave: _porTipo, nombre: _porTipo, mitad: false,
             porTipo: true, marca: marca.toUpperCase() };
  }

  var nom = marca.toUpperCase() + ' \u00b7 ' + tipo;
  return { clave: nom, nombre: nom, mitad: false };
} // 2 unidades de $5 = 1 punto VIP

// Devuelve el precio que le corresponde a un cliente por un producto -su precio personalizado
// si tiene uno guardado para ese producto, o el precio normal del catalogo si no-.
function esProductoVIP(precio, nombre){
  if(VIP_PRECIOS.some(function(p){ return Math.abs(precio - p) < 0.02; })) return true;
  // Los de $5 ya NO entran todos: solo las navajas cortadas. -5 ago-
  return esNavajaCortadaVIP(nombre, precio);
}

function calcPuntosVIP(precio, cant){
  // Producto de $10: cada unidad = 1 punto
  if(VIP_PRECIOS.some(function(p){ return Math.abs(precio - p) < 0.02; })){
    return cant;
  }
  // Producto de $5: cada 2 unidades = 1 punto (se trunca)
  if(Math.abs(precio - VIP_PRECIO_MITAD) < 0.02){
    return Math.floor(cant / 2);
  }
  return 0;
}

function getMarcaVIP(nombre, cat){
  // Dos primeras palabras = marca + tipo (fallback para productos sin marca separada)
  var palabras = (nombre||'').trim().toUpperCase().split(/\s+/);
  return palabras.slice(0, 2).join(' ');
}

var VIP_FECHA_INICIO = '6/15/2026'; // Solo cuentan ventas desde esta fecha

// ═══════════════════════════════════════════════════════════════════
//  ✏️ AJUSTAR LOS PUNTOS DE UN GRUPO A MANO  (3 sep 2026)
//
//  Sensei: "yo pueda ponerle o quitarle a cada uno de cada categoría, y por qué...
//  puedo en un momento dado tomar la decisión de darle un regalo combinando marcas
//  pero debo bajarle o subirle a cualquier producto del grupo de su récord".
//
//  Su ejemplo: tiene 8, le da el premio, le baja 7 y le deja 1 — "para ayudarlo, ya
//  que es un buen cliente".
//
//  🔑 El 🎁 de siempre se queda igual: resetea el grupo a 0 de un toque.
//     Esto es lo OTRO: poner el número que él quiera, con el motivo apuntado.
// ═══════════════════════════════════════════════════════════════════

// Los ajustes viven en el cliente, en vipAjustes[], como los canjes.
// Cada uno: { grupo, nombreGrupo, de, a, motivo, fecha, hora, id }


// 🎺 LA FANFARRIA DEL PREMIO  (3 sep 2026)
// Sensei: "hay que agregarle sonido fuerte al premio cuando un cliente lo gana".
// 🔑 Suena UNA SOLA VEZ: en el momento exacto en que ese grupo llega a los 10 puntos.
// Si después abre su ficha, ya no suena — solo queda el aviso en el asistente.
//
// Hecha con el mismo motor de la app, sin archivos de audio ni derechos de autor.
function sonidoPremioVIP(){
  try{
    // Cinco notas subiendo, más fuerte que los demás avisos de la app
    _pitido(523, 0,    0.13, 0.34);   // DO
    _pitido(659, 0.12, 0.13, 0.34);   // MI
    _pitido(784, 0.24, 0.13, 0.36);   // SOL
    _pitido(1047,0.36, 0.30, 0.40);   // DO alto, sostenido
    _pitido(784, 0.42, 0.26, 0.30);   // SOL, para que suene a acorde
  }catch(e){}
}

// Los grupos que YA sonaron, para no repetir. Se guarda por cliente+grupo.
var CLAVE_PREMIOS_SONADOS = 'nbs_premios_sonados';

// ¿Algún grupo de este cliente ACABA de llegar a los 10? Si sí, suena y lo apunta.
// Devuelve la lista de grupos nuevos con premio.
function abrirAjustePuntosVIP(cid, claveGrupo){
  clientes = LS('ncl', []);
  var c = clientes.find(function(x){ return String(x.id) === String(cid); });
  if(!c){ avisoGrande('No encontr\u00e9 ese cliente.'); return; }

  var conteo = {};
  try { conteo = calcVIP(cid) || {}; } catch(e){}
  var g = conteo[claveGrupo];
  if(!g){ avisoGrande('Ese grupo ya no tiene puntos.'); return; }

  window._ajusteVIP = { cid: cid, grupo: claveGrupo, nombre: g.nombre, tiene: g.puntos || 0 };

  var ov = document.getElementById('ajuste-vip-overlay');
  if(!ov){
    ov = document.createElement('div');
    ov.id = 'ajuste-vip-overlay';
    document.body.appendChild(ov);
  }
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.62);z-index:99999;'
    + 'display:flex;align-items:center;justify-content:center;padding:14px';
  ov.onclick = function(e){ if(e.target === ov) cerrarAjustePuntosVIP(); };

  ov.innerHTML = '<div style="background:#fff;border-radius:15px;padding:16px;max-width:420px;width:100%">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">'
    +   '<div style="font-size:15px;font-weight:900;color:#1a237e">\u270f\ufe0f Ajustar puntos</div>'
    +   '<button onclick="cerrarAjustePuntosVIP()" style="background:#F0F0F2;border:none;border-radius:8px;'
    +     'width:32px;height:32px;font-size:15px;cursor:pointer">\u2715</button>'
    + '</div>'

    + '<div style="background:#FFF8E1;border:1px solid #FFD54F;border-radius:10px;padding:11px;margin-bottom:12px">'
    +   '<div style="font-size:13px;font-weight:900;color:#7A5C00">' + escaparHtml(g.nombre) + '</div>'
    +   '<div style="font-size:12px;color:#7A5C00;margin-top:3px">Tiene ahora: <b>'
    +     (g.puntos || 0) + ' punto(s)</b></div>'
    + '</div>'

    + '<label class="lbl">Dejarlo en</label>'
    + '<input class="inp" type="number" id="aj-vip-puntos" min="0" max="999" '
    +   'value="' + (g.puntos || 0) + '" style="font-size:20px;font-weight:900;text-align:center">'

    + '<label class="lbl" style="margin-top:10px">\u00bfPor qu\u00e9?</label>'
    + '<input class="inp" type="text" id="aj-vip-motivo" maxlength="90" '
    +   'placeholder="Le di premio combinado, se lo regal\u00e9...">'

    + '<div style="font-size:10.5px;color:var(--nbs-muted);margin:8px 0 12px">'
    +   'Queda apuntado en su ficha, con la fecha y el motivo.</div>'

    + '<button onclick="guardarAjustePuntosVIP()" style="width:100%;padding:13px;background:#1a237e;'
    +   'color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:800;cursor:pointer">'
    +   '\u2713 Guardar</button>'
    + '<button onclick="cerrarAjustePuntosVIP()" style="width:100%;padding:11px;margin-top:7px;'
    +   'background:#F0F0F2;color:#333;border:none;border-radius:10px;font-size:13px;'
    +   'font-weight:700;cursor:pointer">Cancelar</button>'
    + '</div>';

  ov.style.display = 'flex';
  setTimeout(function(){
    var i = document.getElementById('aj-vip-puntos');
    if(i){ i.focus(); i.select(); }
  }, 80);
}

function cerrarAjustePuntosVIP(){
  var ov = document.getElementById('ajuste-vip-overlay');
  if(ov) ov.style.display = 'none';
}

function guardarAjustePuntosVIP(){
  var d = window._ajusteVIP;
  if(!d) return;

  var campo = document.getElementById('aj-vip-puntos');
  var nuevos = parseInt(campo ? campo.value : '', 10);
  if(!isFinite(nuevos) || nuevos < 0){
    alert('Escribe cu\u00e1ntos puntos le quedan. Un n\u00famero de 0 en adelante.');
    return;
  }
  if(nuevos === d.tiene){ cerrarAjustePuntosVIP(); return; }

  var motivo = String((document.getElementById('aj-vip-motivo') || {}).value || '').trim();
  if(!motivo){
    alert('Escribe por qu\u00e9 lo est\u00e1s ajustando.\n\nAs\u00ed sabes m\u00e1s adelante qu\u00e9 pas\u00f3.');
    return;
  }

  clientes = LS('ncl', []);
  var j = clientes.findIndex(function(x){ return String(x.id) === String(d.cid); });
  if(j < 0) return;

  if(!clientes[j].vipAjustes) clientes[j].vipAjustes = [];
  clientes[j].vipAjustes.push({
    id: Date.now(),
    grupo: d.grupo,
    nombreGrupo: d.nombre,
    de: d.tiene,
    a: nuevos,
    diferencia: nuevos - d.tiene,
    motivo: motivo,
    fecha: fechaHoy(),
    hora: horaAhora()
  });
  clientes[j].mod = Date.now();
  if(!SS('ncl', clientes)) return;    // SS ya avisa si no cupo

  cerrarAjustePuntosVIP();
  try { pintarPanelCliente(d.cid); } catch(e){}
  avisoGrande('\u2705 Ajustado.\n\n' + d.nombre + '\n'
    + d.tiene + ' \u2192 ' + nuevos + ' punto(s)\n\n"' + motivo + '"');
}

// Deshacer el último ajuste de un grupo, por si se equivocó.
function deshacerAjustePuntosVIP(cid, idAjuste){
  clientes = LS('ncl', []);
  var j = clientes.findIndex(function(x){ return String(x.id) === String(cid); });
  if(j < 0) return;
  var lista = clientes[j].vipAjustes || [];
  var k = lista.findIndex(function(a){ return String(a.id) === String(idAjuste); });
  if(k < 0) return;
  var a = lista[k];
  if(!confirm('\u00bfDeshacer este ajuste?\n\n' + a.nombreGrupo + '\n'
      + a.de + ' \u2192 ' + a.a + '\n"' + a.motivo + '"')) return;
  lista.splice(k, 1);
  clientes[j].vipAjustes = lista;
  clientes[j].mod = Date.now();
  if(!SS('ncl', clientes)) return;
  try { pintarPanelCliente(cid); } catch(e){}
  avisoGrande('\u21a9\ufe0f Ajuste deshecho. Los puntos vuelven como estaban.');
}

// \u26a1 EL CAJON DEL VIP -5 sep-. Se llena UNA vez y sirve para todos los clientes.
// Antes cada llamada a calcVIP leia el disco y recorria las 613 ventas enteras: con
// 161 clientes eran 98.693 vueltas y el asistente tardaba segundos.
// \ud83d\udd11 NO cambia ni un calculo: los mismos datos, buscados de otra forma.
var _cajonVIP = null;

// Una huella barata de los datos: si cambia, el cajon deja de valer. Solo mira el
// largo del texto guardado, no lo recorre — cuesta casi nada.
function _huellaDatosVIP(){
  try {
    return (localStorage.getItem('nv') || '').length + '|'
         + (localStorage.getItem('ncl') || '').length + '|'
         + (localStorage.getItem('np') || '').length;
  } catch(e){ return String(Date.now()); }
}

function _abrirCajonVIP(){
  // \ud83d\udd11 Se rehace si los datos cambiaron -aunque los hayan cambiado sin pasar por
  // SS- o si pasaron mas de 3 segundos.
  var _h = _huellaDatosVIP();
  if(_cajonVIP && _cajonVIP.huella === _h && (Date.now() - _cajonVIP.cuando) < 3000){
    return _cajonVIP;
  }
  loadProds();
  ventas = LS('nv', []);
  var porCliente = {}, porId = {};
  ventas.forEach(function(v){
    var k = String(v.cid);
    if(!porCliente[k]) porCliente[k] = [];
    porCliente[k].push(v);
  });
  (LS('ncl', []) || []).forEach(function(c){ porId[String(c.id)] = c; });
  var prods = {};
  (productos || []).forEach(function(p){ prods[String(p.id)] = p; });
  _cajonVIP = { cuando: Date.now(), huella: _h, ventas: porCliente, clientes: porId, prods: prods };
  return _cajonVIP;
}

// Se vacia solo cuando algo cambia, para no dar puntos viejos.
function vaciarCajonVIP(){ _cajonVIP = null; }

function calcVIP(cid){
  var _cj = _abrirCajonVIP();
  var conteo = {};

  // Las cuentas de CONSIGNACION no entran al programa: son productos dejados para
  // que se paguen segun se vendan, no compras del barbero. -5 ago, lo pidio Sensei-
  var _cliVIP = _cj.clientes[String(cid)];
  if(!clienteCuentaVIP(_cliVIP)) return conteo;

  // \ud83d\udcc5 RETROACTIVO DESDE JUNIO 2026 -Sensei, 3 sep-: "quiero que estas nuevas reglas
  // sean retroactivas desde junio con todos los clientes que ya hayan comprado desde
  // ese tiempo". Lo de antes de junio no cuenta.
  // \u26a1 Solo SUS ventas, del cajon: no las 613 de todos.
  var ventasC = (_cj.ventas[String(cid)] || []).filter(function(v){
    if(String(v.cid)!==String(cid) || v.cancelada) return false;
    var f = parsearFechaVenta(v.fecha);
    return f ? (f >= VIP_DESDE) : false;
  });

  ventasC.forEach(function(v){
    // Si la FACTURA COMPLETA tuvo descuento, ninguno de sus productos cuenta: ya se le
    // dio un beneficio en el precio. Y si el descuento fue a UN producto -bajandole el
    // precio-, ese renglon se cae solo, porque deja de valer $10 o $9.99.
    if(v.descuento && v.descuento.monto > 0.005) return;
    if(v.esPremioVIP) return;                    // el producto regalado no suma puntos
    (v.items||[]).forEach(function(it){
      var prod = productos.find(function(x){ return String(x.id)===String(it.pid); });
      var g = grupoVIPdeItem(it, prod);       // \ud83c\udf81 el agrupador NUEVO -3 sep-
      if(!g) return;
      if(!conteo[g.clave]) conteo[g.clave] = { nombre: g.nombre, mitad: g.mitad,
                                               categoria: g.categoria, marca: g.marca,
                                               precio: it.precio, unidades: 0, prods: {} };
      conteo[g.clave].unidades += (parseFloat(it.cant) || 0);
      // Guardar el NOMBRE COMPLETO del producto y cuántos lleva de cada uno. Sensei lo
      // pidió el 7 ago: "que no diga solo gummy gel sino gummy hair gel 700 ml, el nombre
      // completo como está en la descripción, para yo estar más claro" y poder decidir si
      // le da el regalo antes o espera. -7 ago-
      var _nomP = String((prod && prod.nombre) || it.nombre || '').trim();
      if(_nomP) conteo[g.clave].prods[_nomP] = (conteo[g.clave].prods[_nomP] || 0) + (parseFloat(it.cant) || 0);
    });
  });

  // Restar lo devuelto: un producto devuelto no debe seguir contando para el punto.
  var devoluciones = LS('ndevoluciones', []);
  devoluciones.filter(function(d){ return String(d.cid)===String(cid); }).forEach(function(d){
    (d.items||[]).forEach(function(it){
      var prod = productos.find(function(x){ return String(x.id)===String(it.pid); });
      var g = grupoVIPdeItem(it, prod);       // \ud83c\udf81 el mismo, para las devoluciones
      if(!g) return;
      if(conteo[g.clave]){
        conteo[g.clave].unidades = Math.max(0, conteo[g.clave].unidades - (parseFloat(it.cant) || 0));
        var _nomD = String((prod && prod.nombre) || it.nombre || '').trim();
        if(_nomD && conteo[g.clave].prods && conteo[g.clave].prods[_nomD]){
          conteo[g.clave].prods[_nomD] = Math.max(0, conteo[g.clave].prods[_nomD] - (parseFloat(it.cant) || 0));
          if(!conteo[g.clave].prods[_nomD]) delete conteo[g.clave].prods[_nomD];
        }
      }
    });
  });

  // Los premios YA ENTREGADOS se descuentan, para que ese grupo vuelva a empezar.
  var _canjes = {};
  ((_cliVIP && _cliVIP.vipCanjes) || []).forEach(function(c){
    _canjes[c.grupo] = (_canjes[c.grupo] || 0) + 1;
  });

  // \u270f\ufe0f LOS AJUSTES A MANO -Sensei, 3 sep-. El ULTIMO ajuste de cada grupo manda:
  // si el dijo "dejalo en 1", el grupo queda en 1 y sigue sumando desde ahi.
  var _ajustes = {};
  ((_cliVIP && _cliVIP.vipAjustes) || []).forEach(function(a){
    var previo = _ajustes[a.grupo];
    if(!previo || (a.id || 0) > (previo.id || 0)) _ajustes[a.grupo] = a;
  });

  Object.keys(conteo).forEach(function(k){
    var p = conteo[k];
    // Las navajas cortadas van a 2 unidades por punto; lo demas, 1 punto por unidad.
    var puntos = p.mitad ? Math.floor(p.unidades / 2) : p.unidades;
    puntos = Math.max(0, puntos - (_canjes[k] || 0) * VIP_META);

    // Si Sensei ajusto este grupo a mano, se aplica la DIFERENCIA que el marco. Se usa
    // la diferencia y no el numero fijo para que lo que compre DESPUES siga sumando.
    var _aj = _ajustes[k];
    if(_aj){
      p.ajuste = _aj;
      puntos = Math.max(0, puntos + (_aj.diferencia || 0));
    }
    p.puntos = puntos;
    p.gratis = Math.floor(puntos / VIP_META);
    p.progreso = puntos % VIP_META;
    p.total = puntos;
    p.entregados = _canjes[k] || 0;
    p.claveGrupo = k;          // la necesita el boton de entregar el premio
  });
  return conteo;
}


function toggleVIPBtn(btn){
  var id = btn.getAttribute('data-clid');
  toggleVIP(id);
}

function toggleVIP(id){
  try {
    var todos = LS('ncl', []);
    var encontrado = -1;
    for(var i=0; i<todos.length; i++){
      if(String(todos[i].id) === String(id)){ encontrado = i; break; }
    }
    if(encontrado === -1){ alert('Error: Cliente no encontrado'); return; }
    var cl = todos[encontrado];
    var nombre = nombreClConNegocio(cl);
    if(cl.vipActivo){
      if(!confirm('¿Retirar a '+nombre+' del programa VIP?')) return;
      todos[encontrado].vipActivo = false;
      SS('ncl', todos); clientes = todos;
      alert('✅ '+nombre+' retirado del programa VIP.');
    } else {
      if(!confirm('¿Inscribir a '+nombre+' en el programa VIP?')) return;
      todos[encontrado].vipActivo = true;
      SS('ncl', todos); clientes = todos;
      alert('⭐ ¡'+nombre+' inscrito exitosamente en el programa VIP!');
    }
    verCl(id);
  } catch(err){ alert('Error: ' + err.message); }
}


function filtrarVIPBusqueda(q){
  clientes = LS('ncl', []);
  var el = document.getElementById('vip-buscar-lista');
  el.innerHTML = '';
  if(!q || !q.trim()){ el.style.display='none'; return; }
  var q2 = q.toLowerCase();
  var list = filtrarPorBusqueda(clientes, q2, function(c){
    return (c.nombre||'')+' '+(c.apellido||'')+' '+escaparHtml(c.negocio||'')+' '+(c.apodo||'')+' '+(c.tel||'')+' '+(c.dir||'')+' '+(c.ciudad||'')+' '+(c.contacto||'')+' '+(c.contactoApodo||'')+' '+(c.contactoTel||'');
  });
  if(!list.length){
    el.style.display='block';
    el.innerHTML='<div style="padding:12px;color:#aaa;font-size:13px">Sin resultados</div>';
    return;
  }
  el.style.display='block';
  list.forEach(function(c){
    var d = document.createElement('div');
    d.style.cssText='padding:12px;border-bottom:1px solid #f0f0f0;cursor:pointer;display:flex;justify-content:space-between;align-items:center';
    d.innerHTML='<div><div style="font-size:13px;font-weight:600">'+escaparHtml(nombreCl(c))+'</div>'
      +'<div style="font-size:11px;color:#aaa">'+escaparHtml(c.negocio||'')+'</div></div>'
      +'<span style="font-size:12px;font-weight:700;padding:4px 8px;border-radius:8px;'+(c.vipActivo?'background:#FCE4EC;color:#AD1457':'background:#f0f0f0;color:#aaa')+'">'+(c.vipActivo?'⭐ Ya inscrito':'+ Inscribir')+'</span>';
    d.onclick=(function(cid){ return function(){
      var todos2=LS('ncl',[]);
      var i2=-1;
      for(var j=0;j<todos2.length;j++){ if(String(todos2[j].id)===String(cid)){i2=j;break;} }
      if(i2===-1) return;
      var cliente = todos2[i2];
      document.getElementById('vip-buscar-lista').style.display='none';
      if(cliente.vipActivo){
        // Ya esta inscrito: solo mostrar su estatus/progreso, no preguntar si se retira
        renderVIPLista([cliente]);
        mostrarBotonVerTodosVIP(true);
      } else {
        var nom = nombreClConNegocio(cliente);
        if(!confirm('¿Inscribir a '+nom+' en el programa VIP?')) return;
        cliente.vipActivo=true; SS('ncl',todos2); clientes=todos2;
        alert('⭐ ¡'+nom+' inscrito en el programa VIP!');
        document.getElementById('vip-buscar-cl').value='';
        mostrarBotonVerTodosVIP(false);
        renderVIP('');
      }
    };})(c.id);
    el.appendChild(d);
  });
}

function mostrarBotonVerTodosVIP(mostrar){
  var btn = document.getElementById('vip-ver-todos-btn');
  if(btn) btn.style.display = mostrar ? 'block' : 'none';
}

function renderVIP(q){
  clientes=LS('ncl',[]);
  var inscritos=clientes.filter(function(c){ return c.vipActivo; });
  var elTotal = document.getElementById('vip-total-num');
  if(elTotal) elTotal.textContent = inscritos.length;
  renderVIPLista(inscritos);
}

function diagnosticoVIP(){
  clientes = LS('ncl',[]);
  ventas = LS('nv',[]);
  loadProds();
  var inscritos = clientes.filter(function(c){ return c.vipActivo; });
  var msg = '=== DIAGNÓSTICO VIP ===\n\nInscritos: '+inscritos.length+'\n\n';
  inscritos.forEach(function(c){
    msg += '👤 '+nombreClConNegocio(c)+' (id:'+c.id+')\n';
    var todas = ventas.filter(function(v){ return String(v.cid)===String(c.id) && !v.cancelada; });
    msg += '  Ventas totales: '+todas.length+'\n';
    todas.forEach(function(v){
      msg += '  📄 '+v.fecha+' $'+v.total+'\n';
      (v.items||[]).forEach(function(it){
        msg += '    - '+escaparHtml(it.nombre)+' x'+it.cant+' @ $'+it.precio+' VIP:'+esProductoVIP(it.precio)+'\n';
      });
    });
    var vip = calcVIP(c.id);
    var keys = Object.keys(vip);
    msg += '  Puntos: '+(keys.length ? keys.map(function(k){ return vip[k].nombre+':'+vip[k].puntos; }).join(', ') : 'ninguno')+'\n\n';
  });
  // Buscar Dorco en todas las ventas
  msg += '=== BUSCAR DORCO ===\n';
  ventas.forEach(function(v){
    (v.items||[]).forEach(function(it){
      if((it.nombre||'').toUpperCase().indexOf('DORCO')>=0){
        var cl = clientes.find(function(c){ return String(c.id)===String(v.cid); });
        msg += (cl?nombreClConNegocio(cl):'cid:'+v.cid)+' - '+escaparHtml(it.nombre)+' x'+it.cant+' $'+it.precio+' fecha:'+v.fecha+'\n';
      }
    });
  });
  alert(msg);
}

function renderVIPLista(list){
  // Fuera los barberos SIN SERVICIO: si ya no le compran, no tiene sentido llevarles
  // el conteo del premio. -8 ago-
  try { list = soloConServicio(list); } catch(e){}
  var el=document.getElementById('vip-lista');
  el.innerHTML='';
  if(!list||!list.length){
    el.innerHTML='<div class="card"><p style="color:#aaa;text-align:center;padding:20px">Ningún cliente inscrito todavía.<br><br>Escribe un nombre arriba para buscar e inscribir.</p></div>';
    return;
  }
  list.forEach(function(c){
    var vip=calcVIP(c.id);
    var prods=Object.values(vip);
    var card=document.createElement('div');
    card.className='card';
    card.style.cssText='border-left:4px solid var(--nbs-gold);border-radius:12px;box-shadow:var(--nbs-shadow-card);border-top:0.5px solid var(--nbs-line);border-right:0.5px solid var(--nbs-line);border-bottom:0.5px solid var(--nbs-line);margin-bottom:10px';
    var html='<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">'
      +'<div class="av">'+ini(c.nombre,c.apellido)+'</div>'
      +'<div style="flex:1"><div style="font-size:16px;font-weight:700;color:var(--nbs-ink)">'+escaparHtml(nombreCl(c))+'</div>'
      +(c.negocio ? '<div style="font-size:12px;color:var(--nbs-muted);margin-top:1px;display:flex;align-items:center;gap:4px">🏪'+escaparHtml(c.negocio)+'</div>' : '')
      +'</div></div>'
    if(!prods.length){
      html+='<p style="font-size:12px;color:var(--nbs-muted);text-align:center;padding:8px">Sin compras VIP todavía</p>';
    } else {
      prods.forEach(function(p){
        var pct=Math.round((p.progreso/VIP_META)*100);
        var color=p.gratis>0?'#AD1457':'var(--nbs-gold)';
        var esMitad = Math.abs((p.precio||0) - VIP_PRECIO_MITAD) < 0.02;
        html+='<div style="margin-bottom:10px;padding:10px;background:#FAFAFA;border-radius:10px">'
          +'<div style="display:flex;justify-content:space-between;margin-bottom:2px">'
          +'<div style="font-size:12px;font-weight:600;color:var(--nbs-ink)">'+escaparHtml(p.nombre)+(esMitad?' <span style="font-size:10px;color:#E65100">(2 uds=$1 punto)</span>':'')+'</div>'
          +'<div style="font-size:12px;font-weight:700;color:'+color+'">'+p.progreso+'/'+VIP_META+'</div></div>'
          +'<div style="height:8px;background:#F0F0F2;border-radius:4px;overflow:hidden;margin-bottom:4px">'
          +'<div style="height:100%;width:'+pct+'%;background:'+color+';border-radius:4px" class="barra-brillo"></div></div>'
          +'<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--nbs-muted)">'
          +'<span>Unidades: '+p.unidades+' → Puntos: '+p.puntos+'</span>'
          +(p.gratis>0?'<span style="color:#AD1457;font-weight:700">🎁 '+p.gratis+' gratis</span>':'<span>'+(VIP_META-p.progreso)+' para completar</span>')
          +'</div>'
          // Los productos exactos de este grupo, con su nombre COMPLETO. -7 ago, Sensei:
          // "que no diga solo gummy gel sino gummy hair gel 700 ml, para yo estar mas claro"
          +detalleProdsVIP(p, false)
          // Si este grupo ya llego a la meta, sale el boton para entregar el premio.
          // Antes no habia ninguno: el contador se quedaba en 10 para siempre. -5 ago-
          // El boton sale SIEMPRE. Si el grupo ya llego a la meta dice "Ya se lo di";
          // si todavia no, dice "Darle el premio ahora" y avisa antes de hacer nada.
          // Sensei lo pidio el 6 ago: a algunos clientes ya les habia hablado del
          // programa antes de que la app llevara la cuenta, y quiere quedar bien con
          // ellos aunque el contador no este completo. -6 ago-
          +'<button onclick="abrirEntregaPremioVIP(' + _arg(String(c.id)) + ','
            + JSON.stringify(String(p.claveGrupo || p.nombre)) + ')" '
            + 'style="width:100%;margin-top:8px;padding:10px;background:'
            + (p.gratis > 0 ? '#AD1457' : '#ECEFF1') + ';color:' + (p.gratis > 0 ? '#fff' : '#546E7A') + ';'
            + 'border:none;border-radius:9px;font-size:13px;font-weight:800;cursor:pointer">'
            + (p.gratis > 0 ? '\ud83c\udf81 Ya se lo di' : '\ud83c\udf81 Darle el premio ahora') + '</button>'
            // ✏️ AJUSTAR A MANO. Faltaba en esta pantalla: solo estaba en la ficha
            // del cliente, y Sensei lo cazo mirando el Programa VIP. -3 sep-
            +'<button onclick="abrirAjustePuntosVIP(' + _arg(String(c.id)) + ','
            + JSON.stringify(String(p.claveGrupo || p.nombre)) + ')" '
            + 'style="width:100%;margin-top:5px;padding:8px;background:#fff;color:#555;'
            + 'border:1px solid #ccc;border-radius:9px;font-size:11.5px;font-weight:700;cursor:pointer">'
            + '✏️ Ajustar estos puntos a mano</button>'
            // Y el rastro del ultimo ajuste, si lo hubo
            + (p.ajuste
                ? '<div style="background:#FFF8E1;border-left:3px solid #FFB300;border-radius:6px;'
                  + 'padding:6px 8px;margin-top:6px;font-size:10.5px;color:#7A5C00">'
                  + '✏️ ' + escaparHtml(p.ajuste.fecha) + ': ' + p.ajuste.de + ' → ' + p.ajuste.a
                  + '<br>“' + escaparHtml(p.ajuste.motivo) + '”</div>'
                : '')
          +'</div>';
      });

      // El historial de premios que ya se le entregaron
      var _canjes = (c.vipCanjes || []);
      if(_canjes.length){
        html += '<div style="margin-top:12px;border-top:1px solid #eee;padding-top:10px">'
          + '<div style="font-size:11px;font-weight:800;color:#AD1457;letter-spacing:.4px;margin-bottom:6px">'
          + '\ud83c\udf81 PREMIOS ENTREGADOS (' + _canjes.length + ')</div>';
        _canjes.slice(-6).reverse().forEach(function(k){
          html += '<div onclick="mostrarComprobantePremioVIP(' + _arg(String(c.id)) + ','
            + JSON.stringify(String(k.ventaId)) + ')" '
            + 'style="display:flex;justify-content:space-between;align-items:center;background:#FCE4EC;'
            + 'border-radius:8px;padding:8px 10px;margin-bottom:5px;cursor:pointer">'
            + '<div style="flex:1;min-width:0">'
            +   '<div style="font-size:12.5px;font-weight:700;color:var(--nbs-ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'
            +     escaparHtml(String(k.producto || '').slice(0,30)) + '</div>'
            +   '<div style="font-size:10.5px;color:#888">' + escaparHtml(k.fecha || '') + ' \u00b7 '
            +     escaparHtml(String(k.nombreGrupo || k.grupo || '').slice(0,24)) + '</div>'
            + '</div>'
            + '<span style="font-size:11px;color:#AD1457;font-weight:800;flex-shrink:0">ver \u203a</span>'
            + '</div>';
        });
        html += '</div>';
      }
    }
    card.innerHTML=html;
    el.appendChild(card);
  });
}

function verificarVIPdespuesDeVenta(cid, itemsVendidos){
  if(!cid) return;
  clientes=LS('ncl',[]);
  var cl=clientes.find(function(c){ return String(c.id)===String(cid); });
  // 🎁 EL VIP CUENTA PARA TODOS. Antes exigía `vipActivo` encendido a mano y NINGÚN
  // cliente lo tenía, así que el aviso del producto gratis nunca saltaba — Eric Young
  // llevaba 12 y Sensei no se enteró. Ahora entran todos menos consignación y
  // sin servicio, que es lo que decide clienteCuentaVIP. -15 ago-
  if(!cl) return;
  if(!clienteCuentaVIP(cl)) return;
  loadProds();
  var vip=calcVIP(cid);
  var alertas=[];
  itemsVendidos.forEach(function(it){
    if(!esProductoVIP(it.precio)) return;
    // IMPORTANTE: usar exactamente la misma logica de clave que calcVIP -marca+categoria real
    // del producto, o el respaldo por nombre-, ya que antes se buscaba por pid/nombre directo,
    // que nunca coincidia con como calcVIP guarda las cosas -por eso el aviso de "completo sus
    // 10 compras" nunca se disparaba, aunque el conteo de puntos en si siempre estuvo bien-.
    var prod = productos.find(function(x){ return String(x.id)===String(it.pid); });
    var key;
    if(prod && prod.marca){
      key = prod.marca.toUpperCase() + (prod.cat ? ' · '+prod.cat : '');
    } else {
      key = getMarcaVIP(it.nombre, prod ? (prod.cat||'') : '');
    }
    var p=vip[key];
    if(p&&p.progreso===0&&p.total>0){
      alertas.push('🎁 ¡'+escaparHtml(it.nombre)+' completó 10 compras! El cliente ganó 1 GRATIS.');
    }
  });
  if(alertas.length){
    var nombre=nombreClConNegocio(cl);
    setTimeout(function(){
      lanzarConfeti();
      alert('⭐ PROGRAMA LEALTAD VIP ⭐\n\n'+nombre+'\n\n'+alertas.join('\n')+'\n\n¡Entrégale su producto gratis!');
    },500);
  }
}

function toggleNuevoClienteVIP(){
  var activo = document.getElementById('cvip-activo').value === '1';
  activo = !activo;
  document.getElementById('cvip-activo').value = activo ? '1' : '0';
  var sw = document.getElementById('cvip-switch');
  var knob = document.getElementById('cvip-knob');
  sw.style.background = activo ? '#AD1457' : '#ddd';
  knob.style.left = activo ? '22px' : '3px';
}

function abrirEntregaPremioVIP(cid, grupoClave){
  var cls = LS('ncl', []);
  var cl = cls.find(function(x){ return String(x.id) === String(cid); });
  if(!cl){ avisoGrande('No encontr\u00e9 ese cliente.'); return; }

  var grupos = calcVIP(cid);
  var g = grupos[grupoClave];
  if(!g){ avisoGrande('No encontr\u00e9 ese grupo.'); return; }

  // Se puede entregar ANTES de llegar a la meta. Solo hay que decirlo claro.
  var _anticipado = (g.gratis < 1);
  var _faltan = Math.max(0, VIP_META - g.progreso);

  window._premioVIP = { cid: cid, grupo: grupoClave, nombreGrupo: g.nombre, pid: null,
                        anticipado: _anticipado, tenia: g.total, faltaban: _faltan };
  loadProds();

  // Los productos que PODRIA regalar: los de ese mismo grupo
  var candidatos = productos.filter(function(p){
    var falso = { pid: p.id, nombre: p.nombre, precio: p.precio, cant: 1 };
    var k = claveGrupoVIP(falso, p);
    return k && k.clave === grupoClave;
  });

  var h = '<div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:12px">'
    + '<div style="flex:1"><div style="font-size:18px;font-weight:900;color:#1a237e">\ud83c\udf81 ENTREGAR EL PREMIO</div>'
    + '<div style="font-size:12.5px;color:#666;margin-top:2px">' + escaparHtml(g.nombre) + '</div>'
    + '<div style="font-size:13px;font-weight:700;color:var(--nbs-ink)">' + escaparHtml(nombreCl(cl)) + '</div></div>'
    + '<button onclick="cerrarEntregaPremioVIP()" style="flex-shrink:0;width:34px;height:34px;border:none;border-radius:9px;background:#f0f0f0;color:#666;font-size:20px;font-weight:800;cursor:pointer">\u2715</button>'
    + '</div>';

  if(_anticipado){
    h += '<div style="background:#FFF3E0;border:2px solid #E65100;border-radius:10px;padding:11px;margin-bottom:12px">'
      + '<div style="font-size:12.5px;font-weight:800;color:#E65100">\u26a0\ufe0f TODAV\u00cdA NO LLEGA A ' + VIP_META + '</div>'
      + '<div style="font-size:12.5px;color:#6D4C00;line-height:1.5;margin-top:3px">'
      +   'Tiene <b>' + g.total + ' de ' + VIP_META + '</b> \u00b7 le faltan <b>' + _faltan + '</b>.<br>'
      +   'Si se lo das igual, su contador vuelve a <b>0</b> y empieza de nuevo desde hoy.'
      + '</div></div>';
  }
  h += '<div style="font-size:11px;color:#555;font-weight:700;margin-bottom:3px">📅 ¿QUÉ DÍA LE ENTREGAS EL PREMIO?</div>';
  h += '<input type="date" id="vip-fecha" style="width:100%;padding:9px;border:1px solid #ddd;border-radius:8px;font-size:13px;margin-bottom:12px">';
  h += '<div style="font-size:12px;font-weight:800;color:#6A1B9A;letter-spacing:.4px;margin-bottom:6px">\u00bfCU\u00c1L PRODUCTO LE DISTE?</div>';

  if(!candidatos.length){
    h += '<div style="background:#FFF3E0;border:1.5px solid #E65100;border-radius:10px;padding:11px;font-size:13px;color:#6D4C00">'
      + 'No encontr\u00e9 productos de ese grupo en tu cat\u00e1logo. Puede que le hayas cambiado el precio o el nombre.</div>';
  } else {
    h += '<div style="max-height:230px;overflow-y:auto;margin-bottom:12px">';
    candidatos.forEach(function(p){
      h += '<button onclick="escogerPremioVIP(' + _arg(String(p.id)) + ')" '
        + 'id="prem-op-' + p.id + '" class="prem-op" '
        + 'style="width:100%;text-align:left;background:#fff;border:1.5px solid #e5e7eb;border-radius:9px;'
        + 'padding:10px 11px;margin-bottom:6px;cursor:pointer;display:flex;justify-content:space-between;align-items:center">'
        + '<span style="font-size:13px;font-weight:700;color:var(--nbs-ink);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'
        + escaparHtml(String(p.nombre).slice(0, 34)) + '</span>'
        + '<span style="font-size:12px;color:#888;flex-shrink:0">te cuesta $' + fmtNum(p.costo || 0) + '</span>'
        + '</button>';
    });
    h += '</div>';
  }

  h += '<div id="prem-aviso" style="display:none;background:#FFF8E1;border:2px solid #F9A825;border-radius:10px;padding:11px;margin-bottom:12px;font-size:12.5px;color:#6D4C00;line-height:1.5"></div>';
  h += '<button id="prem-btn" onclick="confirmarEntregaPremioVIP()" disabled '
    + 'style="width:100%;padding:13px;background:#ccc;color:#fff;border:none;border-radius:10px;'
    + 'font-size:15px;font-weight:800;cursor:not-allowed">Escoge el producto primero</button>';

  var ov = document.getElementById('premvip-ov');
  if(!ov){
    ov = document.createElement('div');
    ov.id = 'premvip-ov';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:99994;display:flex;align-items:center;justify-content:center;padding:14px';
    document.body.appendChild(ov);
  }
  ov.innerHTML = '<div style="background:#fff;border-radius:16px;padding:15px;max-width:460px;width:100%;max-height:88vh;overflow-y:auto">' + h + '</div>';
  ov.style.display = 'flex';
  setTimeout(function(){ ponerHoyEnCampo('vip-fecha'); }, 0);   // 📅 -2 sep-
}

function escogerPremioVIP(pid){
  window._premioVIP = window._premioVIP || {};
  window._premioVIP.pid = String(pid);
  loadProds();
  var p = productos.find(function(x){ return String(x.id) === String(pid); });
  if(!p) return;

  var lista = document.querySelectorAll('.prem-op');
  for(var i = 0; i < lista.length; i++){
    lista[i].style.border = '1.5px solid #e5e7eb';
    lista[i].style.background = '#fff';
  }
  var sel = document.getElementById('prem-op-' + pid);
  if(sel){ sel.style.border = '2px solid #2E7D32'; sel.style.background = '#E8F5E9'; }

  var costo = parseFloat(p.costo) || 0;
  var av = document.getElementById('prem-aviso');
  if(av){
    av.style.display = 'block';
    av.innerHTML = '<b>Al confirmar:</b><br>'
      + '\u00b7 baja 1 de <b>' + escaparHtml(String(p.nombre).slice(0,30)) + '</b> del inventario<br>'
      + '\u00b7 tu ganancia baja <b>$' + fmtNum(costo) + '</b> (lo que te cost\u00f3)<br>'
      + '\u00b7 el "Vend\u00ed" NO sube, porque no entr\u00f3 dinero<br>'
      + '\u00b7 el contador de este grupo vuelve a 0';
  }
  var btn = document.getElementById('prem-btn');
  if(btn){
    btn.disabled = false;
    btn.style.background = '#2E7D32';
    btn.style.cursor = 'pointer';
    btn.textContent = '\u2713 Confirmar entrega';
  }
}

function cerrarEntregaPremioVIP(){
  var ov = document.getElementById('premvip-ov');
  if(ov) ov.remove();
}

function confirmarEntregaPremioVIP(){
  var d = window._premioVIP;
  if(!d || !d.pid){ avisoGrande('Escoge primero cu\u00e1l producto le diste.'); return; }

  loadProds();
  var p = productos.find(function(x){ return String(x.id) === String(d.pid); });
  var cls = LS('ncl', []);
  var idx = cls.findIndex(function(x){ return String(x.id) === String(d.cid); });
  if(!p || idx < 0){ avisoGrande('No encontr\u00e9 el producto o el cliente.'); return; }
  var cl = cls[idx];
  var costo = parseFloat(p.costo) || 0;

  var _txtAnt = d.anticipado
    ? '\n\n\u26a0\ufe0f TODAV\u00cdA NO LLEGA A ' + VIP_META + ': tiene ' + d.tenia
      + ' y le faltan ' + d.faltaban + '.\nSu contador vuelve a 0 y empieza de nuevo desde hoy.'
    : '';
  if(!confirm('Entregar "' + String(p.nombre).slice(0,34) + '" como premio a '
      + nombreCl(cl) + '?' + _txtAnt
      + '\n\nSe registra como regalo: te cuesta $' + fmtNum(costo)
      + ' y baja 1 del inventario.')) return;

  protegerConHuella(function(){
    // 1) La venta especial: $0 de venta, el costo real
    var V = LS('nv', []);
    var num = (typeof siguienteNumeroFactura === 'function') ? siguienteNumeroFactura() : '';
    var venta = {
      id: Date.now(),
      cid: cl.id,
      cn: nombreCl(cl),
      tipo: 'contado',
      items: [{ pid: p.id, nombre: p.nombre, cant: 1, precio: 0, costo: costo }],
      subtotal: 0,
      total: 0,
      ganancia: -costo,          // el regalo CUESTA: la ganancia baja
      fecha: fechaDelCampo('vip-fecha'),   // 📅 la que el escogio -2 sep-
      hora: new Date().toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',hour12:true}),
      pagosFactura: [],
      esPremioVIP: true,
      premioGrupo: d.grupo,
      numFactura: num
    };
    V.push(venta);
    SS('nv', V);
    ventas = LS('nv', []);

    // 2) Baja del inventario
    var P = LS('np', []);
    var ip = P.findIndex(function(x){ return String(x.id) === String(p.id); });
    if(ip >= 0){
      P[ip].stock = (parseFloat(P[ip].stock) || 0) - 1;
      SS('np', P);
    } else {
      // Es del catalogo de fabrica: se crea su parche para poder bajarle el stock
      P.push({ id: p.id, nombre: p.nombre, precio: p.precio, costo: p.costo,
               cat: p.cat, marca: p.marca, sku: p.sku, stock: (parseFloat(p.stock)||0) - 1,
               min: p.min || 0 });
      SS('np', P);
    }
    loadProds();

    // 3) El record del premio, para el historial del cliente
    var C = LS('ncl', []);
    var j = C.findIndex(function(x){ return String(x.id) === String(d.cid); });
    if(j >= 0){
      if(!C[j].vipCanjes) C[j].vipCanjes = [];
      C[j].vipCanjes.push({
        grupo: d.grupo, nombreGrupo: d.nombreGrupo,
        pid: String(p.id), producto: p.nombre, costo: costo,
        fecha: fechaDelCampo('vip-fecha'),   // 📅 la que el escogio -2 sep-
        hora: venta.hora,
        ventaId: venta.id,
        numero: C[j].vipCanjes.length + 1,
        anticipado: !!d.anticipado,          // se dio antes de llegar a la meta
        teniaPuntos: d.tenia
      });
      SS('ncl', C);
      clientes = LS('ncl', []);
    }

    cerrarEntregaPremioVIP();
    mostrarComprobantePremioVIP(d.cid, venta.id);
  });
}

// ═══ EL COMPROBANTE, ESTILO GIFT CARD ═══
// Sensei: "que se lleve un record de cada cliente con detalles de cuando se le dio
// el regalo, es como una pequena factura que luzca como gift card".
function mostrarComprobantePremioVIP(cid, ventaId){
  var cls = LS('ncl', []);
  var cl = cls.find(function(x){ return String(x.id) === String(cid); });
  if(!cl) return;
  var canje = (cl.vipCanjes || []).find(function(c){ return String(c.ventaId) === String(ventaId); });
  if(!canje) canje = (cl.vipCanjes || [])[(cl.vipCanjes || []).length - 1];
  if(!canje) return;

  // El nombre del negocio sale de la configuracion si esta, y si no del titulo de la app.
  var neg = 'Nunez Beauty Supply';
  try {
    var cfg = LS('nbs_negocio', null);
    if(cfg && cfg.nombre) neg = cfg.nombre;
    else {
      var m = document.querySelector('meta[name="application-name"]');
      if(m && m.content) neg = m.content;
    }
  } catch(e){}

  var h = '<div id="giftcard-vip" style="background:linear-gradient(135deg,#1a237e,#283593);border-radius:16px;padding:18px;color:#fff">'
    + '<div style="text-align:center;margin-bottom:14px">'
    +   '<div style="font-size:30px;line-height:1">\ud83c\udf81</div>'
    +   '<div style="font-size:16px;font-weight:900;letter-spacing:1px;margin-top:4px">PREMIO DE LEALTAD</div>'
    +   '<div style="font-size:11.5px;opacity:.85">' + escaparHtml(neg) + '</div>'
    + '</div>'
    + '<div style="border-top:1px dashed rgba(255,255,255,.35);padding-top:12px">'
    +   '<div style="font-size:10px;opacity:.8;letter-spacing:.6px">PARA</div>'
    +   '<div style="font-size:17px;font-weight:800;line-height:1.2">' + escaparHtml(nombreCl(cl)) + '</div>'
    +   (cl.negocio ? '<div style="font-size:12px;opacity:.85">\ud83c\udfea ' + escaparHtml(cl.negocio) + '</div>' : '')
    + '</div>'
    + '<div style="background:rgba(255,255,255,.14);border-radius:11px;padding:13px;margin:13px 0;text-align:center">'
    +   '<div style="font-size:15px;font-weight:800;line-height:1.3">' + escaparHtml(String(canje.producto).slice(0,40)) + '</div>'
    +   '<div style="font-size:22px;font-weight:900;color:#FFD54F;margin-top:3px">GRATIS</div>'
    + '</div>'
    + '<div style="font-size:12px;opacity:.9;text-align:center;line-height:1.5">'
    +   'Por completar ' + VIP_META + ' compras de<br><b>' + escaparHtml(canje.nombreGrupo || canje.grupo) + '</b>'
    + '</div>'
    + '<div style="border-top:1px dashed rgba(255,255,255,.35);margin-top:13px;padding-top:10px;display:flex;justify-content:space-between;font-size:11px;opacity:.85">'
    +   '<span>Premio #' + String(canje.numero).padStart(3,'0') + '</span>'
    +   '<span>' + escaparHtml(canje.fecha) + ' \u00b7 ' + escaparHtml(canje.hora || '') + '</span>'
    + '</div>'
    + '<div style="text-align:center;font-size:12px;font-weight:700;margin-top:10px">\u00a1Gracias por tu preferencia!</div>'
    + '</div>';

  h += '<div style="display:flex;gap:8px;margin-top:12px">'
    + '<button onclick="imprimirGiftCardVIP()" style="flex:1;padding:12px;background:#1565C0;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:800;cursor:pointer">\ud83d\udda8\ufe0f Imprimir</button>'
    + '<button onclick="compartirGiftCardVIP()" style="flex:1;padding:12px;background:#2E7D32;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:800;cursor:pointer">\ud83d\udce4 Compartir</button>'
    + '</div>'
    + '<button onclick="cerrarComprobantePremioVIP()" style="width:100%;margin-top:8px;padding:11px;background:#ECEFF1;color:#546E7A;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer">Cerrar</button>';

  var ov = document.getElementById('giftvip-ov');
  if(!ov){
    ov = document.createElement('div');
    ov.id = 'giftvip-ov';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:99995;display:flex;align-items:center;justify-content:center;padding:14px';
    document.body.appendChild(ov);
  }
  ov.innerHTML = '<div style="background:#fff;border-radius:16px;padding:14px;max-width:420px;width:100%;max-height:92vh;overflow-y:auto">' + h + '</div>';
  ov.style.display = 'flex';
}

function cerrarComprobantePremioVIP(){
  var ov = document.getElementById('giftvip-ov');
  if(ov) ov.remove();
  try { renderVIP(); } catch(e){}
}

function imprimirGiftCardVIP(){
  var el = document.getElementById('giftcard-vip');
  if(!el) return;
  var w = window.open('', '_blank');
  if(!w){ avisoGrande('El navegador bloque\u00f3 la ventana de impresi\u00f3n.'); return; }
  w.document.write('<html><head><title>Premio de Lealtad</title>'
    + '<style>body{font-family:-apple-system,system-ui,Arial;padding:20px;display:flex;justify-content:center}'
    + '@media print{body{padding:0}}</style></head><body>'
    + '<div style="max-width:380px;width:100%">' + el.outerHTML + '</div>'
    + '</body></html>');
  w.document.close();
  setTimeout(function(){ try { w.print(); } catch(e){} }, 400);
}

function compartirGiftCardVIP(){
  var el = document.getElementById('giftcard-vip');
  if(!el) return;
  var txt = el.innerText.replace(/\n{2,}/g, '\n');
  if(navigator.share){
    navigator.share({ title: 'Premio de Lealtad', text: txt }).catch(function(){});
  } else {
    try {
      navigator.clipboard.writeText(txt);
      avisoGrande('\u2705 Copiado. P\u00e9galo donde quieras mandarlo.');
    } catch(e){ avisoGrande('No se pudo compartir en este aparato.'); }
  }
}


function armarMensajeVIP(cid){
  clientes = LS('ncl', []);
  var cl = clientes.find(function(c){ return String(c.id) === String(cid); });
  if(!cl) return null;

  var v = {};
  try { v = calcVIP(cid) || {}; } catch(e){ return null; }

  // Solo los grupos donde de verdad lleva algo
  var grupos = [];
  Object.keys(v).forEach(function(k){
    var g = v[k];
    if(!g) return;
    var pts = parseInt(g.puntos || g.total || 0, 10) || 0;
    if(pts <= 0) return;
    grupos.push({ nombre: k, pts: pts, gratis: parseInt(g.gratis || 0, 10) || 0,
                  falta: Math.max(0, VIP_META - (pts % VIP_META)) });
  });
  if(!grupos.length) return null;
  grupos.sort(function(a, b){ return b.pts - a.pts; });

  var nom = primerNombreDe(cl) || 'Amigo';
  var m = '\u00a1Hola ' + nom + '! \ud83d\udc4b\n\n';
  m += '\ud83c\udfc6 *TUS PUNTOS NBS*\n\n';

  var yaGano = false;
  grupos.forEach(function(g){
    var enCurso = g.pts % VIP_META;
    if(g.gratis > 0){
      yaGano = true;
      m += '\u2b50 *' + g.nombre + '*\n';
      m += '   \ud83c\udf89 \u00a1YA TE GANASTE ' + (g.gratis > 1 ? g.gratis + ' GRATIS' : '1 GRATIS') + '!\n';
      if(enCurso > 0) m += '   y llevas ' + enCurso + ' de 10 para el siguiente\n';
    } else {
      m += '\u2b50 *' + g.nombre + '*\n';
      m += '   ' + g.pts + ' de 10';
      if(g.falta <= 2) m += '   \ud83d\udd25 \u00a1te falta' + (g.falta === 1 ? ' 1' : 'n ' + g.falta) + '!';
      else m += '   (te faltan ' + g.falta + ')';
      m += '\n';
    }
    m += '\n';
  });

  // El empujón
  var cerca = grupos.filter(function(g){ return g.gratis === 0 && g.falta <= 3; });
  if(yaGano){
    m += '\ud83c\udf81 *\u00a1Pasa por tu producto gratis!*\n';
    m += 'Te lo tengo apartado para tu pr\u00f3xima visita.\n\n';
  } else if(cerca.length){
    var g0 = cerca[0];
    m += '\ud83d\udd25 *' + VIP_ANIMOS[Math.floor(Math.random() * VIP_ANIMOS.length)] + '*\n';
    m += 'Con ' + g0.falta + ' m\u00e1s de *' + g0.nombre + '* te ganas UNO GRATIS.\n\n';
  } else {
    m += '\ud83d\udcaa *' + VIP_ANIMOS[Math.floor(Math.random() * VIP_ANIMOS.length)] + '*\n';
    m += 'Cada 10 productos de $10 del mismo tipo = *1 GRATIS*.\n\n';
  }

  m += 'Gracias por formar parte del *Programa VIP de Nunez Beauty Supply*. '
    + '\u00a1Contigo seguimos creciendo! \ud83d\ude4c';

  return { texto: m, cliente: cl, grupos: grupos, yaGano: yaGano };
}

// Se lo manda por WhatsApp
function verMensajeVIP(cid){
  var r = armarMensajeVIP(cid);
  if(!r){
    avisoGrande('Este cliente todav\u00eda no tiene puntos que mandarle.');
    return;
  }
  var h = '<div style="padding:16px">';
  h += '<div style="font-size:15px;font-weight:900;color:var(--nbs-ink);margin-bottom:3px">'
    + '\ud83d\udcf1 Mensaje para ' + escaparHtml(primerNombreDe(r.cliente)) + '</div>';
  h += '<div style="font-size:11px;color:var(--nbs-muted);margin-bottom:11px">'
    + 'As\u00ed le va a llegar por WhatsApp</div>';
  h += '<div style="background:#DCF8C6;border-radius:12px;padding:13px;font-size:13px;'
    + 'line-height:1.65;white-space:pre-wrap;color:#111;margin-bottom:13px">'
    + escaparHtml(r.texto).replace(/\*([^*]+)\*/g, '<b>$1</b>') + '</div>';
  h += '<div style="display:flex;gap:8px">'
    + '<button onclick="cerrarMensajeVIP()" class="btn" '
    +   'style="flex:.8;margin:0;background:#F0F0F5;color:#333">Cerrar</button>'
    + '<button onclick="cerrarMensajeVIP();mandarPuntosPorWhatsApp(' + _arg(cid) + ')" class="btn" '
    +   'style="flex:1.4;margin:0;background:#25D366;color:#fff;font-weight:900">'
    +   '\ud83d\udcf1 Mandar por WhatsApp</button>'
    + '</div></div>';

  var ov = document.getElementById('msgvip-overlay');
  if(!ov){
    ov = document.createElement('div');
    ov.id = 'msgvip-overlay';
    document.body.appendChild(ov);
  }
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:99994;'
    + 'display:flex;align-items:center;justify-content:center;padding:14px';
  ov.innerHTML = '<div style="background:#fff;border-radius:15px;max-width:420px;width:100%;'
    + 'max-height:88vh;overflow:auto">' + h + '</div>';
}

function cerrarMensajeVIP(){
  var ov = document.getElementById('msgvip-overlay');
  if(ov) ov.style.display = 'none';
}
