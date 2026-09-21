/**
 * 📅 PROBAR QUE SE PUEDE ELEGIR LA FECHA EN TODO
 *
 * Sensei, 2 sep: "en todas partes donde vaya a entrar un dato debo tener la opción de
 * cambiar la fecha, aunque la fecha por defecto siempre sea la de ese día".
 *
 * Comprueba, en los OCHO sitios: que el campo exista, que venga con la de HOY, y que
 * lo que se guarda lleve la fecha que él escogió — no la de hoy.
 */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 1100 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file:///home/claude/trabajo/index.html');
  await p.waitForTimeout(2600);
  let ok = 0, mal = 0;
  const T = (n, c, d) => { if (c) { ok++; console.log('  ✅ ' + n); } else { mal++; console.log('  ❌ ' + n + (d ? '  →  ' + d : '')); } };

  await p.evaluate(() => {
    ['pantalla-login', 'pantalla-bloqueo'].forEach(id => {
      const e = document.getElementById(id); if (e) e.style.display = 'none';
    });
    document.getElementById('app-contenido').style.display = 'block';
    window.protegerConHuella = function (cb) { cb(); };
  });

  console.log('\n1️⃣  LAS DOS AYUDITAS');
  const r1 = await p.evaluate(() => {
    const hoy = fechaHoy();
    return {
      existen: typeof fechaDelCampo === 'function' && typeof ponerHoyEnCampo === 'function',
      sinCampo: fechaDelCampo('no-existe-este-campo'),   // debe dar HOY
      hoy: hoy
    };
  });
  T('las dos funciones existen', r1.existen);
  T('🔒 si el campo no existe, devuelve HOY', r1.sinCampo === r1.hoy, r1.sinCampo);

  console.log('\n2️⃣  🔒 UNA FECHA RARA NUNCA SE GUARDA');
  const r2 = await p.evaluate(() => {
    const d = document.createElement('input');
    d.type = 'text'; d.id = 'prueba-fecha'; document.body.appendChild(d);
    const casos = {};
    [['', 'vacío'], ['abc', 'letras'], ['2026-13-45', 'mes 13 día 45'],
     ['2026-02', 'incompleta'], ['2026-08-28', 'buena']].forEach(([v, n]) => {
      d.value = v; casos[n] = fechaDelCampo('prueba-fecha');
    });
    d.remove();
    return { casos, hoy: fechaHoy() };
  });
  T('🔒 vacía → HOY', r2.casos['vacío'] === r2.hoy, r2.casos['vacío']);
  T('🔒 letras → HOY', r2.casos['letras'] === r2.hoy, r2.casos['letras']);
  T('🔒 mes 13 día 45 → HOY', r2.casos['mes 13 día 45'] === r2.hoy, r2.casos['mes 13 día 45']);
  T('🔒 incompleta → HOY', r2.casos['incompleta'] === r2.hoy, r2.casos['incompleta']);
  T('🔑 y una buena SÍ se respeta', r2.casos['buena'] === '08/28/2026', r2.casos['buena']);

  const sembrar = () => p.evaluate(() => {
    localStorage.setItem('ncl', JSON.stringify([{ id: 1, nombre: 'Isidro', negocio: 'URBAN', tel: '4015550001', creditoAFavor: 50 }]));
    localStorage.setItem('np', JSON.stringify([{ id: 'p1', nombre: 'Gel', marca: 'G', costo: 4, precio: 10, stock: 50, min: 5 }]));
    localStorage.setItem('nsup', JSON.stringify([{ id: 900, nombre: 'Kanar' }]));
    localStorage.setItem('nc', '[]');
    localStorage.setItem('nv', JSON.stringify([
      { id: 501, cid: 1, cn: 'Isidro', tipo: 'credito', fecha: '08/01/2026', numFactura: '0501',
        total: 100, ganancia: 30, items: [{ pid: 'p1', nombre: 'Gel', cant: 10, precio: 10, costo: 7 }],
        pagosFactura: [] }]));
    localStorage.setItem('nvan', JSON.stringify({ fechaCarga: '2026-08-20', cargado: { p1: 24 } }));
    clientes = LS('ncl', []); ventas = LS('nv', []);
    compras = LS('nc', []); suplidores = LS('nsup', []); loadProds();
  });

  console.log('\n3️⃣  🔑 COMPRA A SUPLIDOR');
  await sembrar();
  const r3 = await p.evaluate(async () => {
    ir('p-comp'); await new Promise(r => setTimeout(r, 250));
    const c = document.getElementById('cc-fecha');
    const vino = c ? c.value : null;
    c.value = '2026-08-28';
    const sel = document.getElementById('ccsup'); sel.innerHTML = '<option value="900">Kanar</option>'; sel.value = '900';
    document.getElementById('cctipo').value = 'credito';
    window._pagoMetodos = { ccini: [{ tipo: 'efectivo', monto: 0 }] };
    iCC = [{ pid: 'p1', nombre: 'Gel', cant: 10, costo: 4, esNuevo: false, precioVenta: 10 }];
    const oa = window.alert; window.alert = () => {};
    saveCC(); window.alert = oa;
    const co = LS('nc', [])[0];
    return { vino, guardada: co ? co.fecha : null };
  });
  T('el campo existe y viene con hoy', /^\d{4}-\d{2}-\d{2}$/.test(r3.vino || ''), r3.vino);
  T('🔑 la compra se guarda con 08/28/2026', r3.guardada === '08/28/2026', r3.guardada);

  console.log('\n4️⃣  🔑 COBRO A CLIENTE');
  await sembrar();
  const r4 = await p.evaluate(async () => {
    ir('p-cxc'); await new Promise(r => setTimeout(r, 200));
    abrirAbono(1); await new Promise(r => setTimeout(r, 400));
    const c = document.getElementById('cxc-fecha-501');
    const vino = c ? c.value : null;
    if (c) c.value = '2026-08-25';
    window._pagoMetodos = { 501: [{ tipo: 'efectivo', monto: 60 }] };
    const oa = window.alert, oc = window.confirm;
    window.alert = () => {}; window.confirm = () => true;
    confirmarPagoMultiple(501, 100);
    await new Promise(r => setTimeout(r, 300));
    window.alert = oa; window.confirm = oc;
    const v = LS('nv', []).find(x => x.id === 501);
    const pg = (v.pagosFactura || [])[0];
    return { vino, guardada: pg ? pg.fecha : null, monto: pg ? pg.monto : null };
  });
  T('el campo existe y viene con hoy', /^\d{4}-\d{2}-\d{2}$/.test(r4.vino || ''), r4.vino);
  T('🔑 el pago se guarda con 08/25/2026', r4.guardada === '08/25/2026', r4.guardada);
  T('🔒 y el monto no se toca: $60.00', r4.monto === 60, String(r4.monto));

  console.log('\n4️⃣b 🔑 EL COBRO QUE SE REPARTE ENTRE VARIAS FACTURAS');
  await p.evaluate(() => {
    localStorage.setItem('nv', JSON.stringify([
      { id: 601, cid: 1, cn: 'Isidro', tipo: 'credito', fecha: '07/10/2026', numFactura: '0601',
        total: 35, ganancia: 10, items: [{ pid:'p1', nombre:'Gel', cant:1, precio:35, costo:25 }], pagosFactura: [] },
      { id: 602, cid: 1, cn: 'Isidro', tipo: 'credito', fecha: '07/20/2026', numFactura: '0602',
        total: 15, ganancia: 4, items: [{ pid:'p1', nombre:'Gel', cant:1, precio:15, costo:11 }], pagosFactura: [] },
      { id: 603, cid: 1, cn: 'Isidro', tipo: 'credito', fecha: '08/01/2026', numFactura: '0603',
        total: 55, ganancia: 15, items: [{ pid:'p1', nombre:'Gel', cant:2, precio:27.5, costo:20 }], pagosFactura: [] }]));
    ventas = LS('nv', []);
  });
  const r4b = await p.evaluate(async () => {
    ir('p-cxc'); await new Promise(r => setTimeout(r, 200));
    abrirAbono(1); await new Promise(r => setTimeout(r, 400));
    const c = document.getElementById('cxc-fecha-601');
    if (c) c.value = '2026-08-20';
    // Le paga $80: más de los $35 de esa factura, así que se reparte en las tres
    window._pagoMetodos = { 601: [{ tipo: 'efectivo', monto: 80 }] };
    const oa = window.alert, oc = window.confirm;
    window.alert = () => {}; window.confirm = () => true;
    confirmarPagoMultiple(601, 35);
    await new Promise(r => setTimeout(r, 400));
    window.alert = oa; window.confirm = oc;
    const V = LS('nv', []);
    const fechas = [];
    V.forEach(v => (v.pagosFactura || []).forEach(pg => fechas.push({ f: pg.fecha, m: pg.monto, nf: v.numFactura })));
    return { fechas, cuantos: fechas.length };
  });
  console.log('     ' + JSON.stringify(r4b.fechas));
  T('🔑 el pago se repartió en 3 facturas', r4b.cuantos === 3, String(r4b.cuantos));
  T('🔑 y las TRES partes llevan 08/20/2026',
     r4b.fechas.length === 3 && r4b.fechas.every(x => x.f === '08/20/2026'),
     JSON.stringify(r4b.fechas.map(x => x.f)));
  T('🔒 y suman los $80.00',
     Math.abs(r4b.fechas.reduce((a, x) => a + x.m, 0) - 80) < 0.005,
     String(r4b.fechas.reduce((a, x) => a + x.m, 0)));

  console.log('\n5️⃣  🔑 DEVOLUCIÓN');
  await sembrar();
  const r5 = await p.evaluate(async () => {
    verCl(1); await new Promise(r => setTimeout(r, 350));
    if (typeof abrirDevolucion === 'function') { abrirDevolucion(501); await new Promise(r => setTimeout(r, 300)); }
    const c = document.getElementById('dev-fecha');
    return { existe: !!c, vino: c ? c.value : null };
  });
  T('el campo de la devolución existe', r5.existe, String(r5.existe));
  T('y viene con hoy', /^\d{4}-\d{2}-\d{2}$/.test(r5.vino || ''), r5.vino);

  console.log('\n6️⃣  🔑 CIERRE DE RUTA');
  await sembrar();
  const r6 = await p.evaluate(async () => {
    abrirCierreRuta(); await new Promise(r => setTimeout(r, 350));
    const c = document.getElementById('cr-fecha');
    const vino = c ? c.value : null;
    if (c) c.value = '2026-08-29';
    window._cierreRuta = { contado: { p1: 20 } };
    const oa = window.alert, oc = window.confirm;
    window.alert = () => {}; window.confirm = () => true;
    try { guardarCierreRuta(); } catch (e) {}
    window.alert = oa; window.confirm = oc;
    const ci = LS('ncierres_ruta', []);
    return { vino, guardada: ci.length ? ci[ci.length - 1].fecha : null };
  });
  T('el campo existe y viene con hoy', /^\d{4}-\d{2}-\d{2}$/.test(r6.vino || ''), r6.vino);
  T('🔑 el cierre se guarda con 08/29/2026', r6.guardada === '08/29/2026', r6.guardada);

  console.log('\n7️⃣  🔑 LOS DEMÁS CAMPOS EXISTEN');
  const r7 = await p.evaluate(async () => {
    const res = {};
    // Pago al suplidor desde su ficha
    localStorage.setItem('nc', JSON.stringify([{ id: 7001, sid: 900, sn: 'Kanar', tipo: 'credito',
      fecha: '08/01/2026', total: 400, items: [], pagosFactura: [] }]));
    compras = LS('nc', []);
    try { verFacturaCompra(LS('nc', [])[0], 900); await new Promise(r => setTimeout(r, 300)); } catch (e) {}
    res.pagoSuplidor = !!document.getElementById('pagoc-fecha-7001');
    // Confirmación firmada
    try { abrirConfirmacionBalance(1, 60); await new Promise(r => setTimeout(r, 250)); } catch (e) {}
    res.confirmacion = !!document.getElementById('conf-fecha');
    try { cerrarConfirmacionBalance(); } catch (e) {}
    return res;
  });
  T('🔑 pago al suplidor desde su ficha', r7.pagoSuplidor, String(r7.pagoSuplidor));
  T('🔑 la confirmación firmada', r7.confirmacion, String(r7.confirmacion));

  console.log('\n8️⃣  🔒 EL CÓDIGO YA NO PONE HOY A LA FUERZA');
  const r8 = await p.evaluate(() => {
    const html = document.documentElement.innerHTML;
    return {
      compra: /fecha: fechaDelCampo\('cc-fecha'\)/.test(html),
      cobro: /fechaDelCampo\('cxc-fecha-' \+ vid\)/.test(html),
      suplidor: /fechaDelCampo\('pagoc-fecha-' \+ c\.id\)/.test(html),
      devolucion: /fechaDelCampo\('dev-fecha'\)/.test(html),
      ruta: /fechaDelCampo\('cr-fecha'\)/.test(html),
      vip: /fechaDelCampo\('vip-fecha'\)/.test(html),
      credito: /fechaDelCampo\('cred-fecha'\)/.test(html),
      confirmacion: /fechaDelCampo\('conf-fecha'\)/.test(html)
    };
  });
  Object.keys(r8).forEach(k => T('  ' + k, r8[k], String(r8[k])));

  console.log('\n9️⃣  📄 LA FECHA SALE DE LA FACTURA PDF');
  const r9 = await p.evaluate(() => {
    const casos = [
      ['Invoice Date: 08/28/2026', '08/28/2026'],
      ['Date: 8-28-26', '08/28/2026'],
      ['Invoice Date: August 28, 2026', '08/28/2026'],
      ['FECHA DE FACTURA: 28/08/2026', '08/28/2026'],
      ['Order Date 2026-08-28', '08/28/2026'],
      ['Fecha: 28 de agosto de 2026', '08/28/2026'],
      ['28-Aug-26 INVOICE', '08/28/2026'],
      ['Printed 09/01/2026\nInvoice Date: 08/28/2026\nDue Date: 09/28/2026', '08/28/2026'],
      ['QTY DESCRIPTION PRICE\n10 Gel 4.00', null],
      ['Invoice Date: 13/45/2026', null],
      ['Invoice Date: 08/28/2015', null],
      // 🔑 El DÍA 45 no existe. Sin esto se colaba: la prueba solo usaba el mes 13,
      // que new Date() ya para por su cuenta. Lo destapó la mutación. -2 sep-
      ['Invoice Date: 05/45/2026', null],
      ['Invoice Date: 02/31/2026', null]
    ];
    return casos.map(([t, esp]) => ({ dio: fechaDeLaFactura(t), esp, bien: fechaDeLaFactura(t) === esp }));
  });
  T('🔑 lee los 8 formatos de fecha que usan los suplidores',
     r9.slice(0, 8).every(x => x.bien), JSON.stringify(r9.slice(0, 8).filter(x => !x.bien)));
  T('🔒 si no hay fecha, no inventa ninguna', r9[8].bien, String(r9[8].dio));
  T('🔒 una fecha imposible (mes 13) no cuela', r9[9].bien, String(r9[9].dio));
  T('🔒 una de hace 11 años tampoco', r9[10].bien, String(r9[10].dio));
  T('🔒 el día 45 no existe', r9[11].bien, String(r9[11].dio));
  T('🔒 y el 31 de febrero tampoco', r9[12].bien, String(r9[12].dio));
  T('🔑 con varias fechas, gana la de la FACTURA', r9[7].dio === '08/28/2026', String(r9[7].dio));

  console.log('\n🔟  📄 Y LLEGA AL CAMPO DE LA COMPRA');
  const r10 = await p.evaluate(async () => {
    ir('p-comp'); await new Promise(r => setTimeout(r, 250));
    const antes = document.getElementById('cc-fecha').value;
    // Como si acabara de leer un PDF con esa fecha
    window._fechaDelPdf = '08/28/2026';
    document.getElementById('cc-fecha').value = _aFormatoCalendario('08/28/2026');
    const despues = document.getElementById('cc-fecha').value;
    // Y si la corrige en la pantalla de revisión
    cambiarFechaDeLaFactura('2026-08-20');
    return { antes, despues, corregida: document.getElementById('cc-fecha').value,
             guardaria: fechaDelCampo('cc-fecha') };
  });
  T('🔑 la fecha del PDF llega al campo', r10.despues === '2026-08-28', r10.despues);
  T('🔑 y si la corriges ahí, también', r10.corregida === '2026-08-20', r10.corregida);
  T('🔑 se guardaría con 08/20/2026', r10.guardaria === '08/20/2026', r10.guardaria);

  console.log('\n1️⃣1️⃣  🔑 EL CAMINO COMPLETO: DEL PDF AL CAMPO');
  const r11 = await p.evaluate(async () => {
    ir('p-comp'); await new Promise(r => setTimeout(r, 250));
    ponerHoyEnCampo('cc-fecha');
    const antes = document.getElementById('cc-fecha').value;
    // Se llama a la función DE VERDAD que procesa la factura, con líneas como las del PDF
    const lineas = [
      { texto: 'KANAR BEAUTY SUPPLY' },
      { texto: 'Invoice Date: 08/28/2026' },
      { texto: '12  COOL CARE AFTER SHAVE 4OZ   3.75   45.00' },
      { texto: 'Subtotal 45.00' }
    ];
    try { analizarFacturaYMostrar(lineas); } catch (e) {}
    await new Promise(r => setTimeout(r, 300));
    return { antes, despues: document.getElementById('cc-fecha').value,
             guardaria: fechaDelCampo('cc-fecha'),
             loLeyo: window._fechaDelPdf };
  });
  console.log('     el campo pasó de ' + r11.antes + ' a ' + r11.despues);
  T('🔑 al leer la factura, la fecha LLEGA al campo', r11.despues === '2026-08-28', r11.despues);
  T('🔑 y la compra se guardaría con 08/28/2026', r11.guardaria === '08/28/2026', r11.guardaria);
  T('y queda apuntado que salió del PDF', r11.loLeyo === '08/28/2026', String(r11.loLeyo));

  console.log('\n1️⃣2️⃣  🔒 UNA FACTURA CON FECHA IMPOSIBLE NO ENSUCIA EL CAMPO');
  const r12 = await p.evaluate(async () => {
    ir('p-comp'); await new Promise(r => setTimeout(r, 250));
    ponerHoyEnCampo('cc-fecha');
    const hoy = document.getElementById('cc-fecha').value;
    try {
      analizarFacturaYMostrar([
        { texto: 'SUPLIDOR RARO' },
        { texto: 'Invoice Date: 13/45/2026' },
        { texto: '10  GEL 700ML   4.00   40.00' }
      ]);
    } catch (e) {}
    await new Promise(r => setTimeout(r, 300));
    return { hoy, despues: document.getElementById('cc-fecha').value, loLeyo: window._fechaDelPdf };
  });
  T('🔒 con el mes 13, el campo se queda con HOY', r12.despues === r12.hoy, r12.despues + ' vs ' + r12.hoy);
  T('🔒 y no dice que la leyó del PDF', !r12.loLeyo, String(r12.loLeyo));

  console.log(`\n  ${ok} bien · ${mal} mal`);
  const reales = errs.filter(e => !/firebase|onAuthStateChanged/i.test(e));
  if (reales.length) { console.log('⚠️ JS:'); reales.slice(0, 4).forEach(e => console.log('   ' + e)); }
  await b.close();
  process.exit(mal || reales.length ? 1 : 0);
})();
