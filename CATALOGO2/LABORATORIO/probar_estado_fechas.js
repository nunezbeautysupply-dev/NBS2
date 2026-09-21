/**
 * 📊 PROBAR EL ESTADO POR FECHAS  (5 sep 2026)
 *
 * Sensei: "un reporte donde se vea cada factura y cada pago por orden de fecha y que yo
 * pueda tocar cada uno... y poder enviarle un estado al cliente donde vea todo lo que ha
 * comprado y pagado de acuerdo a las fechas que yo elija".
 * Y: "cada compra con sus pagos aplicados, y si un pago cae en dos facturas, que se vea
 * el total de ese pago y la distribucion".
 */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 1200 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file:///home/claude/trabajo/index.html');
  await p.waitForTimeout(2600);
  let ok = 0, mal = 0;
  const T = (n, c, d) => { if (c) { ok++; console.log('  ✅ ' + n); } else { mal++; console.log('  ❌ ' + n + (d ? '  →  ' + d : '')); } };

  const montar = () => p.evaluate(() => {
    ['pantalla-login', 'pantalla-bloqueo'].forEach(id => {
      const e = document.getElementById(id); if (e) e.style.display = 'none';
    });
    document.getElementById('app-contenido').style.display = 'block';
    localStorage.setItem('ncl', JSON.stringify([
      { id: 1, nombre: 'Isidro', apellido: 'Gonzalez', negocio: 'URBAN', tel: '4015550001' }]));
    localStorage.setItem('nv', JSON.stringify([
      // Julio — fuera del rango que se pedirá
      { id: 1, cid: 1, cn: 'I', tipo: 'credito', fecha: '07/05/2026', numFactura: '0001',
        total: 40, ganancia: 12, items: [{ nombre: 'x', cant: 1, precio: 40, costo: 28 }],
        pagosFactura: [{ pid: 'v1', monto: 40, fecha: '07/06/2026' }] },
      // Agosto — dentro
      { id: 2, cid: 1, cn: 'I', tipo: 'credito', fecha: '08/07/2026', numFactura: '0373',
        total: 200, ganancia: 60, items: [{ nombre: 'y', cant: 2, precio: 100, costo: 70 }],
        pagosFactura: [{ pid: 'a', monto: 100, fecha: '08/10/2026' },
                       { pid: 'b', recibo: 'R-80', montoCobro: 80, monto: 55, fecha: '09/04/2026' }] },
      { id: 3, cid: 1, cn: 'I', tipo: 'credito', fecha: '08/14/2026', numFactura: '0442',
        total: 25, ganancia: 8, items: [{ nombre: 'z', cant: 1, precio: 25, costo: 17 }],
        pagosFactura: [{ pid: 'c', recibo: 'R-80', montoCobro: 80, monto: 25, fecha: '09/04/2026' }] },
      { id: 4, cid: 1, cn: 'I', tipo: 'credito', fecha: '08/20/2026', numFactura: '0500',
        total: 60, ganancia: 18, items: [{ nombre: 'w', cant: 1, precio: 60, costo: 42 }],
        pagosFactura: [] }]));
    clientes = LS('ncl', []); ventas = LS('nv', []);
  });

  console.log('\n1️⃣  📅 SOLO LO QUE CAE EN LAS FECHAS QUE ÉL ELIGE');
  await montar();
  const r1 = await p.evaluate(() => {
    const m = movimientoEntreFechas(1, '08/01/2026', '08/31/2026');
    return { cuantos: m.lista.length, facturado: m.facturado, pagado: m.pagado,
             tipos: m.lista.map(x => x.tipo + ':' + (x.nf || '') + ':' + x.fecha) };
  });
  console.log('     ' + JSON.stringify(r1.tipos));
  T('🔑 solo agosto: 4 cosas (3 facturas + 1 pago)', r1.cuantos === 4, String(r1.cuantos));
  T('🔑 la de julio NO sale', !r1.tipos.some(x => /0001/.test(x)));
  T('facturado en agosto: $285.00', Math.abs(r1.facturado - 285) < 0.02, String(r1.facturado));
  T('pagado en agosto: $100.00', Math.abs(r1.pagado - 100) < 0.02, String(r1.pagado));

  console.log('\n2️⃣  🔑 UN PAGO SE VE ENTERO CON SU REPARTO');
  const r2 = await p.evaluate(() => {
    const m = movimientoEntreFechas(1, '06/01/2026', '12/31/2026');
    const pago = m.lista.find(x => x.tipo === 'pago' && x.recibo === 'R-80');
    return pago ? { completo: pago.completo, partes: pago.partes.length,
                    detalle: pago.partes.map(x => x.nf + '=' + x.monto), suma: pago.suma } : null;
  });
  T('🔑 el pago de $80 sale entero', r2 && Math.abs(r2.completo - 80) < 0.02, JSON.stringify(r2));
  T('🔑 y dice que se repartió en 2', r2 && r2.partes === 2, r2 && String(r2.partes));
  T('🔑 con su distribución: 55 y 25', r2 && r2.detalle.join(',') === '0373=55,0442=25', r2 && r2.detalle.join(','));
  T('🔒 las partes suman los $80', r2 && Math.abs(r2.suma - 80) < 0.02, r2 && String(r2.suma));

  console.log('\n3️⃣  📄 EL TEXTO PARA EL CLIENTE');
  const r3 = await p.evaluate(() => textoEstadoPorFechas(1, '06/01/2026', '12/31/2026'));
  T('lleva el nombre del negocio', /NUNEZ BEAUTY SUPPLY/.test(r3));
  T('y el del cliente', /Isidro Gonzalez/.test(r3));
  T('🔑 cada factura con su total', /Factura #0373[\s\S]{0,40}\$200\.00/.test(r3));
  T('🔑 y sus pagos aplicados debajo', /Factura #0373[\s\S]{0,200}Pagos aplicados[\s\S]{0,80}\$100\.00/.test(r3));
  T('🔑 el pago de $80 sale entero al final', /Pago del 09\/04\/2026[\s\S]{0,20}\$80\.00/.test(r3));
  T('🔑 con su reparto explicado', /Se aplico asi[\s\S]{0,120}\$55\.00[\s\S]{0,40}#0373/.test(r3),
     (r3.match(/Se aplico asi[\s\S]{0,120}/) || [''])[0].replace(/\n/g, ' | '));
  T('dice lo que debe hoy', /SU BALANCE HOY|AL DIA/.test(r3));
  T('🔒 y las facturas sin pagar dicen lo que queda', /QUEDA: \$60\.00/.test(r3));

  console.log('\n4️⃣  🖐️ LA PANTALLA Y SUS RENGLONES TOCABLES');
  await montar();
  const r4 = await p.evaluate(async () => {
    window._efDesde = '2026-06-01'; window._efHasta = '2026-12-31';
    abrirEstadoPorFechas(1);
    await new Promise(r => setTimeout(r, 400));
    const ov = document.getElementById('estado-fechas-overlay');
    return { abrio: !!ov && ov.style.display === 'flex',
             alto: ov ? Math.round(ov.getBoundingClientRect().height) : 0,
             tocables: ov ? ov.querySelectorAll('[onclick*="verDetalleMovimiento"]').length : 0,
             hayFechas: ov ? ov.querySelectorAll('input[type="date"]').length : 0,
             hayMandar: ov ? /mandarEstadoPorFechas/.test(ov.innerHTML) : false,
             hayPDF: ov ? /pdfEstadoPorFechas/.test(ov.innerHTML) : false,
             hayAtajos: ov ? /rangoRapidoEstado/.test(ov.innerHTML) : false };
  });
  T('la pantalla abre y se ve', r4.abrio && r4.alto > 200, r4.alto + ' px');
  T('🔑 cada renglón se puede tocar', r4.tocables >= 5, String(r4.tocables));
  T('🔑 hay dos campos de fecha', r4.hayFechas === 2, String(r4.hayFechas));
  T('con atajos (este mes, mes pasado...)', r4.hayAtajos);
  T('📤 el botón de mandárselo', r4.hayMandar);
  T('📄 y el de hacer PDF', r4.hayPDF);

  console.log('\n5️⃣  🔒 DOS PAGOS DEL MISMO DÍA NO SE MEZCLAN');
  const r5 = await p.evaluate(() => {
    // Pagos viejos sin recibo, el mismo día a la misma factura
    localStorage.setItem('nv', JSON.stringify([
      { id: 9, cid: 1, cn: 'I', tipo: 'credito', fecha: '06/30/2026', numFactura: '0053',
        total: 35, ganancia: 10, items: [],
        pagosFactura: [{ pid: 'x1', monto: 25, fecha: '07/09/2026' },
                       { pid: 'x2', monto: 1, fecha: '07/09/2026' }] }]));
    ventas = LS('nv', []);
    const m = movimientoEntreFechas(1, '06/01/2026', '12/31/2026');
    const pagos = m.lista.filter(x => x.tipo === 'pago');
    return { cuantos: pagos.length, montos: pagos.map(x => x.completo),
             partes: pagos.map(x => x.partes.length) };
  });
  T('🔑 salen los DOS pagos, no uno', r5.cuantos === 2, String(r5.cuantos));
  T('de $25 y $1', r5.montos.sort((a, b) => b - a).join(',') === '25,1', JSON.stringify(r5.montos));
  T('🔒 y ninguno dice "se repartió"', r5.partes.every(x => x === 1), JSON.stringify(r5.partes));

  console.log('\n6️⃣  🔙 EL BOTÓN ATRÁS LO CIERRA');
  const r6 = await p.evaluate(() => ({
    enLista: RECUADROS_ENCIMA.some(x => x.id === 'estado-fechas-overlay'),
    cierra: typeof cerrarEstadoPorFechas === 'function'
  }));
  T('🔙 el recuadro está registrado', r6.enLista);
  T('y su función de cerrar existe', r6.cierra);

  console.log(`\n  ${ok} bien · ${mal} mal`);
  const reales = errs.filter(e => !/firebase|onAuthStateChanged/i.test(e));
  if (reales.length) { console.log('⚠️ JS:'); reales.slice(0, 4).forEach(e => console.log('   ' + e)); }
  await b.close();
  process.exit(mal ? 1 : 0);
})();
