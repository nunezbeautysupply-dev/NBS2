/**
 * ⚖️🔬 PRUEBA POR PROPIEDADES CON REDUCCIÓN AUTOMÁTICA  (4 sep 2026)
 *
 * Sensei: "quiero que busques de nuevo y consigas LA MEJOR PRUEBA DE LAS MEJORES...
 * que se enfoque en encontrar errores que puedan hacerme perder o errar en el dinero".
 *
 * 🔑 QUÉ HACE, Y POR QUÉ ES LA MÁS FUERTE:
 *
 * Las otras pruebas comprueban casos que ALGUIEN PENSÓ. Si no se le ocurrió a nadie,
 * no se prueba — y ahí es donde han salido los fallos que le tocaron a él en la ruta.
 *
 * Esta INVENTA el trabajo: miles de secuencias al azar de vender, cobrar, devolver,
 * cancelar, editar facturas, borrar pagos, aplicar crédito... Y después de CADA paso
 * comprueba las 10 leyes del dinero.
 *
 * 🔑 Y LO QUE LA HACE SUPERIOR A UNA SIMULACIÓN NORMAL: cuando encuentra un fallo,
 * REDUCE el caso sola. De 400 operaciones baja a las 2 o 3 mínimas que lo provocan,
 * y las escribe en cristiano. Sin eso, un fallo en la operación 347 es inservible.
 *
 *     node propiedades_dinero.js            → 200 secuencias
 *     node propiedades_dinero.js 1000       → 1000 secuencias
 *     node propiedades_dinero.js 200 12345  → repite la semilla 12345 exacta
 */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
const fs = require('fs');

const CUANTAS = parseInt(process.argv[2] || '200', 10);
const SEMILLA_FIJA = process.argv[3] ? parseInt(process.argv[3], 10) : null;

// ── Un generador de azar REPETIBLE: con la misma semilla salen los mismos números.
//    Sin esto no se podría reducir un fallo ni volver a montarlo. ──
function azarConSemilla(semilla) {
  let s = semilla >>> 0;
  return function () {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

// ═══════════════════════════════════════════════════════════════════
//  LAS OPERACIONES QUE PUEDE INVENTAR
//  Cada una es algo que Sensei hace de verdad en su ruta.
// ═══════════════════════════════════════════════════════════════════
const OPERACIONES = [
  'venderCredito', 'venderContado', 'cobrarParte', 'cobrarTodo', 'cobrarDeMas',
  'devolver', 'cancelarFactura', 'aplicarCredito', 'borrarUnPago', 'editarTotal'
];

function generarSecuencia(azar, largo) {
  const ops = [];
  for (let i = 0; i < largo; i++) {
    const tipo = OPERACIONES[Math.floor(azar() * OPERACIONES.length)];
    ops.push({
      tipo: tipo,
      cliente: Math.floor(azar() * 3) + 1,          // 3 clientes
      monto: Math.round((azar() * 200 + 5) * 100) / 100,
      cual: Math.floor(azar() * 6)                  // qué factura toca
    });
  }
  return ops;
}

// ═══════════════════════════════════════════════════════════════════
//  CORRER UNA SECUENCIA Y REVISAR LAS LEYES
// ═══════════════════════════════════════════════════════════════════
async function correr(p, ops) {
  return await p.evaluate(async (ops) => {
    // Se parte siempre del mismo negocio limpio
    localStorage.setItem('ncl', JSON.stringify([
      { id: 1, nombre: 'Cliente1', negocio: 'B1' },
      { id: 2, nombre: 'Cliente2', negocio: 'B2' },
      { id: 3, nombre: 'Cliente3', negocio: 'B3' }]));
    localStorage.setItem('nv', '[]');
    localStorage.setItem('np', JSON.stringify([
      { id: 'p1', nombre: 'Gel', marca: 'G', precio: 10, costo: 6, stock: 999, min: 5 }]));
    clientes = LS('ncl', []); ventas = LS('nv', []);
    try { loadProds(); } catch (e) {}

    // Se callan los avisos: aquí no hay nadie mirando
    const oa = window.alert, oc = window.confirm, oav = window.avisoGrande;
    window.alert = function () {}; window.confirm = function () { return true; };
    window.avisoGrande = function () {};
    if (typeof protegerConHuella === 'function') window.protegerConHuella = function (cb) { cb(); };

    let idV = 1000;
    const hacer = {
      venderCredito: function (o) {
        const V = LS('nv', []);
        V.push({ id: ++idV, cid: o.cliente, cn: 'C' + o.cliente, tipo: 'credito',
                 fecha: fechaHoy(), numFactura: String(idV), total: o.monto,
                 ganancia: Math.round(o.monto * 0.3 * 100) / 100,
                 items: [{ pid: 'p1', nombre: 'Gel', cant: 1, precio: o.monto, costo: o.monto * 0.7 }],
                 pagosFactura: [] });
        SS('nv', V); ventas = LS('nv', []);
      },
      venderContado: function (o) {
        const V = LS('nv', []);
        V.push({ id: ++idV, cid: o.cliente, cn: 'C' + o.cliente, tipo: 'contado',
                 fecha: fechaHoy(), numFactura: String(idV), total: o.monto,
                 ganancia: Math.round(o.monto * 0.3 * 100) / 100,
                 items: [{ pid: 'p1', nombre: 'Gel', cant: 1, precio: o.monto, costo: o.monto * 0.7 }],
                 pagosFactura: [{ pid: nuevoPagoId(), monto: o.monto, fecha: fechaHoy() }] });
        SS('nv', V); ventas = LS('nv', []);
      },
      cobrarParte: function (o) {
        const abiertas = LS('nv', []).filter(function (v) {
          return String(v.cid) === String(o.cliente) && !v.cancelada && cobradoYDebeDe(v).debe > 0.01;
        });
        if (!abiertas.length) return;
        const v = abiertas[o.cual % abiertas.length];
        const debe = cobradoYDebeDe(v).debe;
        window._pagoMetodos = {}; window._pagoMetodos[v.id] = [{ tipo: 'efectivo', monto: Math.min(o.monto, debe) }];
        confirmarPagoMultiple(v.id, debe);
      },
      cobrarTodo: function (o) {
        const abiertas = LS('nv', []).filter(function (v) {
          return String(v.cid) === String(o.cliente) && !v.cancelada && cobradoYDebeDe(v).debe > 0.01;
        });
        if (!abiertas.length) return;
        const v = abiertas[o.cual % abiertas.length];
        const debe = cobradoYDebeDe(v).debe;
        window._pagoMetodos = {}; window._pagoMetodos[v.id] = [{ tipo: 'efectivo', monto: debe }];
        confirmarPagoMultiple(v.id, debe);
      },
      cobrarDeMas: function (o) {
        // 🔑 El caso que le rompió el balance a Jose Rodriguez
        const abiertas = LS('nv', []).filter(function (v) {
          return String(v.cid) === String(o.cliente) && !v.cancelada && cobradoYDebeDe(v).debe > 0.01;
        });
        if (!abiertas.length) return;
        const v = abiertas[o.cual % abiertas.length];
        const debe = cobradoYDebeDe(v).debe;
        window._pagoMetodos = {}; window._pagoMetodos[v.id] = [{ tipo: 'efectivo', monto: debe + o.monto }];
        confirmarPagoMultiple(v.id, debe);
      },
      aplicarCredito: function (o) {
        const c = LS('ncl', []).find(function (x) { return String(x.id) === String(o.cliente); });
        if (!c || (parseFloat(c.creditoAFavor) || 0) <= 0.005) return;
        try { usarCreditoAFavor(o.cliente); } catch (e) {}
      },
      devolver: function (o) {
        const V = LS('nv', []);
        const suyas = V.filter(function (v) { return String(v.cid) === String(o.cliente) && !v.cancelada; });
        if (!suyas.length) return;
        const v = suyas[o.cual % suyas.length];
        const j = V.findIndex(function (x) { return x.id === v.id; });
        if (!V[j].pagosFactura) V[j].pagosFactura = [];
        V[j].pagosFactura.push({ pid: nuevoPagoId(), monto: Math.min(o.monto, v.total),
                                 fecha: fechaHoy(), esDevolucion: true });
        SS('nv', V); ventas = LS('nv', []);
      },
      cancelarFactura: function (o) {
        const V = LS('nv', []);
        const suyas = V.filter(function (v) { return String(v.cid) === String(o.cliente) && !v.cancelada; });
        if (!suyas.length) return;
        const v = suyas[o.cual % suyas.length];
        const j = V.findIndex(function (x) { return x.id === v.id; });
        V[j].cancelada = true;
        SS('nv', V); ventas = LS('nv', []);
      },
      borrarUnPago: function (o) {
        const V = LS('nv', []);
        const conPagos = V.filter(function (v) { return (v.pagosFactura || []).length > 0; });
        if (!conPagos.length) return;
        const v = conPagos[o.cual % conPagos.length];
        const j = V.findIndex(function (x) { return x.id === v.id; });
        V[j].pagosFactura.splice(o.cual % V[j].pagosFactura.length, 1);
        SS('nv', V); ventas = LS('nv', []);
      },
      editarTotal: function (o) {
        // 🔑 Se edita POR LA FUNCION DE LA APP, no a mano: asi se prueba lo que Sensei
        // hace de verdad, incluido el paso del sobrante a credito a favor. -4 sep-
        const V = LS('nv', []);
        const suyas = V.filter(function (v) { return String(v.cid) === String(o.cliente) && !v.cancelada; });
        if (!suyas.length) return;
        const v = suyas[o.cual % suyas.length];
        if (!document.getElementById('fact-edit-overlay')) {
          const d = document.createElement('div'); d.id = 'fact-edit-overlay'; document.body.appendChild(d);
        }
        if (!document.getElementById('fact-buscar')) {
          const i2 = document.createElement('input'); i2.id = 'fact-buscar'; document.body.appendChild(i2);
        }
        window._facturaEditItems = [{ pid: 'p1', nombre: 'Gel', cant: 1, precio: o.monto, costo: o.monto * 0.7 }];
        window._facturaEditVid = v.id;
        try { guardarEdicionFactura(v.id); } catch (e) {}
        ventas = LS('nv', []); clientes = LS('ncl', []);
      }
    };

    // ── Se hacen las operaciones, y tras CADA una se revisan las leyes ──
    let roto = null;
    for (let i = 0; i < ops.length && !roto; i++) {
      const o = ops[i];
      try { if (hacer[o.tipo]) hacer[o.tipo](o); } catch (e) { /* que reviente no es el fallo que buscamos aquí */ }
      for (let L = 0; L < window.LEYES_DINERO.length; L++) {
        const ley = window.LEYES_DINERO[L];
        let fallo = null;
        try { fallo = ley.revisar(); } catch (e) { fallo = 'la ley reventó: ' + e.message; }
        if (fallo) { roto = { paso: i, ley: ley.nombre, id: ley.id, detalle: fallo }; break; }
      }
    }

    window.alert = oa; window.confirm = oc; window.avisoGrande = oav;
    return roto;
  }, ops);
}

// ═══════════════════════════════════════════════════════════════════
//  🔑 LA REDUCCIÓN — lo que hace superior a esta prueba
//  Va quitando operaciones mientras el fallo SIGA saliendo.
//  De 400 pasos baja a 2 o 3 que se pueden leer.
// ═══════════════════════════════════════════════════════════════════
async function reducir(p, ops, leyRota) {
  let mejor = ops.slice(0, leyRota.paso + 1);   // hasta donde falló, lo demás sobra
  let mejoro = true;

  while (mejoro && mejor.length > 1) {
    mejoro = false;
    // Se prueba quitando cada operación, una por una
    for (let i = mejor.length - 1; i >= 0; i--) {
      const menos = mejor.slice(0, i).concat(mejor.slice(i + 1));
      if (!menos.length) continue;
      const r = await correr(p, menos);
      if (r && r.id === leyRota.id) {   // sigue rompiendo LA MISMA ley
        mejor = menos;
        mejoro = true;
        break;
      }
    }
  }
  return mejor;
}

function enCristiano(o) {
  const t = {
    venderCredito: 'Vender $' + o.monto + ' a crédito al cliente ' + o.cliente,
    venderContado: 'Vender $' + o.monto + ' de contado al cliente ' + o.cliente,
    cobrarParte: 'Cobrarle $' + o.monto + ' al cliente ' + o.cliente,
    cobrarTodo: 'Cobrarle TODO al cliente ' + o.cliente,
    cobrarDeMas: 'Cobrarle $' + o.monto + ' DE MÁS al cliente ' + o.cliente,
    aplicarCredito: 'Aplicarle su crédito a favor al cliente ' + o.cliente,
    devolver: 'Devolución de $' + o.monto + ' del cliente ' + o.cliente,
    cancelarFactura: 'Cancelar una factura del cliente ' + o.cliente,
    borrarUnPago: 'Borrar un pago',
    editarTotal: 'Cambiar el total de una factura a $' + o.monto
  };
  return t[o.tipo] || o.tipo;
}

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 900 } });
  p.on('pageerror', function () {});
  await p.goto('file:///home/claude/trabajo/index.html');
  await p.waitForTimeout(2800);

  // Se le meten las leyes
  await p.evaluate(fs.readFileSync('/home/claude/laboratorio/leyes_dinero.js', 'utf8'));
  const cuantasLeyes = await p.evaluate(() => window.LEYES_DINERO.length);

  console.log('');
  console.log('════════════════════════════════════════════════════');
  console.log('  ⚖️  PRUEBA POR PROPIEDADES — EL DINERO');
  console.log('════════════════════════════════════════════════════');
  console.log('  ' + cuantasLeyes + ' leyes del dinero');
  console.log('  ' + CUANTAS + ' secuencias de trabajo inventadas al azar');
  console.log('  ' + OPERACIONES.length + ' tipos de operación');
  console.log('');

  const fallos = [];
  const t0 = Date.now();

  for (let n = 0; n < CUANTAS; n++) {
    const semilla = SEMILLA_FIJA !== null ? SEMILLA_FIJA : (n * 7919 + 104729);
    const azar = azarConSemilla(semilla);
    const largo = Math.floor(azar() * 55) + 5;      // entre 5 y 60 operaciones
    const ops = generarSecuencia(azar, largo);

    const roto = await correr(p, ops);
    if (roto) {
      process.stdout.write('\r  🔴 fallo en la secuencia ' + (n + 1) + ' — reduciendo...          ');
      const minimo = await reducir(p, ops, roto);
      const yaEsta = fallos.some(f => f.id === roto.id);
      fallos.push({ id: roto.id, ley: roto.ley, detalle: roto.detalle, pasos: minimo, semilla: semilla });
      if (!yaEsta) {
        console.log('');
        console.log('  🔴 SE ROMPIÓ: ' + roto.ley);
        console.log('     ' + roto.detalle);
        console.log('     de ' + ops.length + ' operaciones → REDUCIDO A ' + minimo.length + ':');
        minimo.forEach(function (o, i) { console.log('       ' + (i + 1) + '. ' + enCristiano(o)); });
        console.log('');
      }
    } else if ((n + 1) % 20 === 0) {
      process.stdout.write('\r  ' + (n + 1) + ' de ' + CUANTAS + ' secuencias · sin fallos          ');
    }
  }

  console.log('');
  console.log('');
  console.log('════════════════════════════════════════════════════');
  const seg = Math.round((Date.now() - t0) / 1000);
  const porLey = {};
  fallos.forEach(f => { porLey[f.ley] = (porLey[f.ley] || 0) + 1; });
  if (!fallos.length) {
    console.log('  ✅ ' + CUANTAS + ' secuencias y NINGUNA ley del dinero se rompió');
    console.log('     (' + seg + ' segundos)');
  } else {
    console.log('  🔴 ' + fallos.length + ' de ' + CUANTAS + ' secuencias rompieron una ley');
    console.log('');
    Object.keys(porLey).forEach(function (k) {
      console.log('     · ' + k + '  (' + porLey[k] + ' veces)');
    });
    // Se guardan para poder repetirlos exactos
    fs.writeFileSync('/home/claude/laboratorio/fallos_propiedades.json',
      JSON.stringify(fallos.slice(0, 30), null, 1));
    console.log('');
    console.log('  guardados en laboratorio/fallos_propiedades.json');
  }
  console.log('════════════════════════════════════════════════════');

  await b.close();
  process.exit(fallos.length ? 1 : 0);
})();
