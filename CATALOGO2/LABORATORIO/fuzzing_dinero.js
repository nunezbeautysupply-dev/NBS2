/**
 * 🌪️ FUZZING DEL DINERO — NBS 2
 *
 * Le mete a la app datos ROTOS a propósito — de los que pasan de verdad cuando algo
 * falla a medias — y comprueba dos cosas:
 *
 *   1. Que NO reviente
 *   2. Que NO invente dinero: las cuentas tienen que seguir cuadrando
 *
 * 🔑 Por qué importa: un dato raro que hace que la app diga un número equivocado es
 * peor que un error a la vista. El error se ve; el número malo se lo das al cliente.
 *
 * Se corre:  node fuzzing_dinero.js
 */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');

// ── Los casos raros, cada uno con su nombre en cristiano ──
const CASOS = [
  { n: 'una venta sin total',
    v: { id: 1, cid: 1, cn: 'A', tipo: 'credito', fecha: '08/01/2026', items: [], pagosFactura: [] } },

  { n: 'el total llega como TEXTO',
    v: { id: 2, cid: 1, cn: 'A', tipo: 'credito', fecha: '08/01/2026', total: '150.00', ganancia: 40,
         items: [], pagosFactura: [] },
    debe: 150 },

  { n: 'el total con coma de miles',
    v: { id: 3, cid: 1, cn: 'A', tipo: 'credito', fecha: '08/01/2026', total: '1,250.00', ganancia: 300,
         items: [], pagosFactura: [] },
    debe: 1250 },                       // 🔑 tiene que dar 1250, NO 1

  { n: 'total negativo',
    v: { id: 4, cid: 1, cn: 'A', tipo: 'credito', fecha: '08/01/2026', total: -80, ganancia: 0,
         items: [], pagosFactura: [] },
    debe: 0 },                          // una factura negativa no existe

  { n: 'total en cero',
    v: { id: 5, cid: 1, cn: 'A', tipo: 'contado', fecha: '08/01/2026', total: 0, ganancia: 0,
         items: [], pagosFactura: [] } },

  { n: 'un pago SIN monto',
    v: { id: 6, cid: 1, cn: 'A', tipo: 'credito', fecha: '08/01/2026', total: 100, ganancia: 30,
         items: [], pagosFactura: [{ pid: 'x', fecha: '08/02/2026' }] } },

  { n: 'un pago con el monto en TEXTO',
    v: { id: 7, cid: 1, cn: 'A', tipo: 'credito', fecha: '08/01/2026', total: 100, ganancia: 30,
         items: [], pagosFactura: [{ pid: 'x', monto: '50', fecha: '08/02/2026' }] },
    debe: 50, cobrado: 50 },

  { n: 'un pago MAYOR que su factura',
    v: { id: 8, cid: 1, cn: 'A', tipo: 'credito', fecha: '08/01/2026', total: 100, ganancia: 30,
         items: [], pagosFactura: [{ pid: 'x', monto: 500, fecha: '08/02/2026' }] },
    debe: 0 },                          // le pagaron de mas: la deuda es 0

  { n: 'un pago negativo',
    v: { id: 9, cid: 1, cn: 'A', tipo: 'credito', fecha: '08/01/2026', total: 100, ganancia: 30,
         items: [], pagosFactura: [{ pid: 'x', monto: -40, fecha: '08/02/2026' }] } },

  { n: 'pagosFactura no es una lista',
    v: { id: 10, cid: 1, cn: 'A', tipo: 'credito', fecha: '08/01/2026', total: 100, ganancia: 30,
         items: [], pagosFactura: 'nada' } },

  { n: 'sin pagosFactura',
    v: { id: 11, cid: 1, cn: 'A', tipo: 'credito', fecha: '08/01/2026', total: 100, ganancia: 30,
         items: [] } },

  { n: 'la fecha vacia',
    v: { id: 12, cid: 1, cn: 'A', tipo: 'credito', fecha: '', total: 100, ganancia: 30,
         items: [], pagosFactura: [] } },

  { n: 'la fecha al reves',
    v: { id: 13, cid: 1, cn: 'A', tipo: 'credito', fecha: '2026-08-01', total: 100, ganancia: 30,
         items: [], pagosFactura: [] } },

  { n: 'sin cliente',
    v: { id: 14, tipo: 'credito', fecha: '08/01/2026', total: 100, ganancia: 30,
         items: [], pagosFactura: [] } },

  { n: 'un cliente que NO existe',
    v: { id: 15, cid: 9999, cn: 'Fantasma', tipo: 'credito', fecha: '08/01/2026', total: 100,
         ganancia: 30, items: [], pagosFactura: [] } },

  { n: 'total con muchos decimales',
    v: { id: 16, cid: 1, cn: 'A', tipo: 'credito', fecha: '08/01/2026', total: 33.333333, ganancia: 10,
         items: [], pagosFactura: [] } },

  { n: 'un total ENORME',
    v: { id: 17, cid: 1, cn: 'A', tipo: 'credito', fecha: '08/01/2026', total: 99999999, ganancia: 1,
         items: [], pagosFactura: [] } },

  { n: 'el total es null',
    v: { id: 18, cid: 1, cn: 'A', tipo: 'credito', fecha: '08/01/2026', total: null, ganancia: 0,
         items: [], pagosFactura: [] } },

  { n: 'el total no es un numero (NaN)',
    v: { id: 19, cid: 1, cn: 'A', tipo: 'credito', fecha: '08/01/2026', total: 'abc', ganancia: 0,
         items: [], pagosFactura: [] } },

  { n: 'cancelada pero con pagos',
    v: { id: 20, cid: 1, cn: 'A', tipo: 'credito', fecha: '08/01/2026', total: 100, ganancia: 30,
         cancelada: true, items: [], pagosFactura: [{ pid: 'x', monto: 100, fecha: '08/02/2026' }] } },

  { n: 'dos pagos con el mismo numero',
    v: { id: 21, cid: 1, cn: 'A', tipo: 'credito', fecha: '08/01/2026', total: 100, ganancia: 30,
         items: [], pagosFactura: [{ pid: 'x', monto: 40, fecha: '08/02/2026' },
                                    { pid: 'x', monto: 40, fecha: '08/03/2026' }] } },

  { n: 'una devolucion NO cuenta como pago',
    v: { id: 23, cid: 1, cn: 'A', tipo: 'credito', fecha: '08/01/2026', total: 100, ganancia: 30,
         items: [], pagosFactura: [{ pid: 'x', monto: 40, fecha: '08/02/2026' },
                                    { pid: 'd', monto: 60, fecha: '08/03/2026', esDevolucion: true }] },
    debe: 60, cobrado: 40 },            // 🔑 solo cuenta el pago de 40; la devolucion NO

  { n: 'items no es una lista',
    v: { id: 22, cid: 1, cn: 'A', tipo: 'credito', fecha: '08/01/2026', total: 100, ganancia: 30,
         items: 'gel', pagosFactura: [] } },
];

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 900 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file:///home/claude/trabajo/index.html');
  await p.waitForTimeout(2800);

  await p.evaluate(() => {
    ['pantalla-login', 'pantalla-bloqueo'].forEach(id => {
      const e = document.getElementById(id); if (e) e.style.display = 'none';
    });
    const a = document.getElementById('app-contenido'); if (a) a.style.display = 'block';
    localStorage.setItem('ncl', JSON.stringify([{ id: 1, nombre: 'Ana', negocio: 'X' }]));
    localStorage.setItem('np', JSON.stringify([{ id: 'p1', nombre: 'Gel', marca: 'G', costo: 4, precio: 10, stock: 50, min: 5 }]));
  });

  console.log('');
  console.log('════════════════════════════════════════════════');
  console.log('  🌪️  FUZZING DEL DINERO');
  console.log('  Datos rotos a propósito, para ver si aguanta');
  console.log('════════════════════════════════════════════════');
  console.log('');

  let ok = 0, mal = 0;
  for (const caso of CASOS) {
    const r = await p.evaluate((v) => {
      localStorage.setItem('nv', JSON.stringify([v]));
      ventas = LS('nv', []);
      const salida = { error: null, cobrado: null, debe: null, balance: null };
      try {
        const c = cobradoYDebeDe(v);
        salida.cobrado = c.cobrado;
        salida.debe = c.debe;
        salida.balance = (typeof balanceDelCliente === 'function') ? balanceDelCliente(1) : 0;
      } catch (e) { salida.error = e.message; }
      return salida;
    }, caso.v);

    const problemas = [];
    if (r.error) problemas.push('revienta: ' + r.error);
    if (r.cobrado !== null) {
      if (!isFinite(r.cobrado)) problemas.push('cobrado no es un numero');
      if (!isFinite(r.debe)) problemas.push('debe no es un numero');
      if (r.debe < -0.005) problemas.push('debe NEGATIVO: ' + r.debe);
      if (r.cobrado < -0.005) problemas.push('cobrado NEGATIVO: ' + r.cobrado);
      if (!isFinite(r.balance)) problemas.push('el balance del cliente no es un numero');
    }

    // 🔑 Y LO QUE FALTABA: comprobar que el numero sea el CORRECTO, no solo que no
    // reviente. La mutacion de la coma se escapaba porque $1.00 "no revienta". -30 ago-
    if (caso.debe !== undefined && Math.abs(Number(r.debe) - caso.debe) > 0.005) {
      problemas.push('DEBERIA DEBER $' + caso.debe.toFixed(2) + ' y dice $' + Number(r.debe).toFixed(2));
    }
    if (caso.cobrado !== undefined && Math.abs(Number(r.cobrado) - caso.cobrado) > 0.005) {
      problemas.push('DEBERIA HABER COBRADO $' + caso.cobrado.toFixed(2) + ' y dice $' + Number(r.cobrado).toFixed(2));
    }

    if (problemas.length) {
      mal++;
      console.log('  🔴 ' + caso.n);
      problemas.forEach(x => console.log('       → ' + x));
    } else {
      ok++;
      console.log('  ✅ ' + caso.n.padEnd(34)
        + ' cobrado $' + Number(r.cobrado || 0).toFixed(2)
        + ' · debe $' + Number(r.debe || 0).toFixed(2));
    }
  }

  console.log('');
  console.log('════════════════════════════════════════════════');
  console.log('  ' + ok + ' aguantaron · ' + mal + ' fallaron');
  if (mal === 0) console.log('  ✅ La app aguanta todos los datos raros');
  else console.log('  🔴 HAY ' + mal + ' CASO(S) QUE ROMPEN EL DINERO');
  console.log('════════════════════════════════════════════════');

  const reales = errs.filter(e => !/firebase|onAuthStateChanged/i.test(e));
  if (reales.length) { console.log(''); console.log('⚠️ JS:'); reales.slice(0, 5).forEach(e => console.log('   ' + e)); }
  await b.close();
  process.exit(mal ? 1 : 0);
})();
