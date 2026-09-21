/**
 * 💵 EL PAGO SE VE ENTERO EN LA FICHA DEL CLIENTE  (6 sep 2026)
 *
 * Sensei: "cuando el cliente me pregunta por un pago que hizo, de la forma en que está
 * no me da el monto completo que él pagó... tengo que ponerme a sumar. Y lo de la
 * distribución del pago es cosa mía, no de él".
 */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 1300 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file:///home/claude/trabajo/index.html');
  await p.waitForTimeout(2600);
  let ok = 0, mal = 0;
  const T = (n, c, d) => { if (c) { ok++; console.log('  ✅ ' + n); } else { mal++; console.log('  ❌ ' + n + (d ? '  →  ' + d : '')); } };

  const abrirPagos = () => p.evaluate(async () => {
    ['pantalla-login', 'pantalla-bloqueo'].forEach(id => {
      const e = document.getElementById(id); if (e) e.style.display = 'none';
    });
    document.getElementById('app-contenido').style.display = 'block';
    localStorage.setItem('ncl', JSON.stringify([{ id: 1, nombre: 'Jorge', apellido: 'Duarte', negocio: 'B1' }]));
    localStorage.setItem('nv', JSON.stringify([
      // Un cobro de $30 REPARTIDO entre dos facturas
      { id: 275, cid: 1, cn: 'J', tipo: 'credito', fecha: '08/01/2026', numFactura: '0275',
        total: 60, ganancia: 18, items: [],
        pagosFactura: [{ pid: 'a', recibo: 'R-30', montoCobro: 30, monto: 10, fecha: '09/03/2026', metodo: 'efectivo' }] },
      { id: 419, cid: 1, cn: 'J', tipo: 'credito', fecha: '08/10/2026', numFactura: '0419',
        total: 40, ganancia: 12, items: [],
        pagosFactura: [{ pid: 'b', recibo: 'R-30', montoCobro: 30, monto: 20, fecha: '09/03/2026', metodo: 'efectivo' },
                       { pid: 'c', monto: 27, fecha: '08/19/2026', metodo: 'zelle' }] }]));
    clientes = LS('ncl', []); ventas = LS('nv', []);
    verCl(1); await new Promise(r => setTimeout(r, 400));
    const pg = document.getElementById('p-cl-perfil');
    const fila = [...pg.querySelectorAll('[onclick*="togglePanelCl"]')]
      .find(x => /Sus pagos/i.test(x.textContent || ''));
    if (fila) fila.click();
    await new Promise(r => setTimeout(r, 350));
    return pg;
  });

  console.log('\n1️⃣  🔑 EL PAGO SE VE POR SU MONTO COMPLETO');
  await abrirPagos();
  const r1 = await p.evaluate(() => {
    const pg = document.getElementById('p-cl-perfil');
    const t = pg.innerText;
    return {
      // 🔑 Lo que Sensei necesita: los $30 de un vistazo, no $10 y $20 sueltos
      dice30: /\+\$30\.00/.test(t),
      diceRepartido: /se reparti\u00f3 en 2 facturas/.test(t),
      // Y NO deben salir las partes como renglones sueltos arriba
      renglones: pg.querySelectorAll('[onclick*="desplegarPagoCliente"]').length,
      // El pago suelto de $27 sigue como siempre
      dice27: /\+\$27\.00/.test(t),
      rotulo: (t.match(/Sus pagos\s*\n?\s*([^\n]*)/) || [])[1] || ''
    };
  });
  T('🔑 sale el pago ENTERO: $30.00', r1.dice30, String(r1.dice30));
  T('🔑 y dice que se repartió en 2', r1.diceRepartido);
  T('hay 1 pago desplegable', r1.renglones === 1, String(r1.renglones));
  T('🔒 el pago suelto de $27 sigue saliendo', r1.dice27);
  T('el rótulo cuenta 2 pagos, no 3', /^2 /.test(r1.rotulo.trim()), r1.rotulo);

  console.log('\n2️⃣  🖐️ AL TOCARLO SE DESPLIEGA EL REPARTO');
  const r2 = await p.evaluate(async () => {
    const pg = document.getElementById('p-cl-perfil');
    const rep = pg.querySelector('[onclick*="desplegarPagoCliente"]');
    const det = pg.querySelector('[id^="pago-det-"]');
    const antes = det ? det.style.display : '?';
    rep.click();
    await new Promise(r => setTimeout(r, 250));
    const despues = det ? det.style.display : '?';
    const t = pg.innerText;
    rep.click();   // se vuelve a cerrar
    await new Promise(r => setTimeout(r, 200));
    return { antes, despues, cerroOtraVez: det ? det.style.display : '?',
             diceComo: /SE APLIC\u00d3 AS\u00cd/.test(t),
             dice0275: /Factura #0275[\s\S]{0,30}\$10\.00/.test(t),
             dice0419: /Factura #0419[\s\S]{0,30}\$20\.00/.test(t) };
  });
  T('🔒 empieza CERRADO', r2.antes === 'none', r2.antes);
  T('🔑 al tocarlo se abre', r2.despues === 'block', r2.despues);
  T('🔑 dice "SE APLICÓ ASÍ"', r2.diceComo);
  T('🔑 $10.00 a la factura #0275', r2.dice0275);
  T('🔑 $20.00 a la factura #0419', r2.dice0419);
  T('y al tocarlo otra vez se cierra', r2.cerroOtraVez === 'none', r2.cerroOtraVez);

  console.log('\n3️⃣  🔒 LOS PAGOS SUELTOS NO CAMBIAN');
  const r3 = await p.evaluate(() => {
    const pg = document.getElementById('p-cl-perfil');
    const t = pg.innerText;
    return {
      // El de $27 lleva su factura y sus botones en el renglón, como siempre
      conFactura: /factura 0419 \u00b7 zelle/.test(t),
      botonesEditar: pg.querySelectorAll('[onclick*="editarPagoDesdeCuenta"]').length,
      botonesBorrar: pg.querySelectorAll('[onclick*="borrarPagoDesdeCuenta"]').length
    };
  });
  T('🔒 el pago suelto dice su factura y método', r3.conFactura);
  T('🔒 hay botón de corregir para cada parte', r3.botonesEditar === 3, String(r3.botonesEditar));
  T('🔒 y de borrar para cada parte', r3.botonesBorrar === 3, String(r3.botonesBorrar));

  console.log('\n4️⃣  🔒 EL TOTAL PAGADO NO CAMBIA');
  const r4 = await p.evaluate(() => {
    const t = document.getElementById('p-cl-perfil').innerText;
    const m = t.match(/TE HA PAGADO EN TOTAL\s*\n?\s*\$([\d,.]+)/);
    return { total: m ? m[1] : null, balance: balanceDelCliente(1) };
  });
  T('🔒 el total sigue siendo $57.00 (10+20+27)', r4.total === '57.00', String(r4.total));
  // 0275: $60 - $10 = $50 · 0419: $40 - $47 = $0 (pagó de más). Total $50.
  T('🔒 y el balance sigue siendo $50.00', Math.abs(r4.balance - 50) < 0.02, String(r4.balance));

  console.log('\n5️⃣  🔒 DOS PAGOS SIN RECIBO NO SE MEZCLAN');
  const r5 = await p.evaluate(async () => {
    localStorage.setItem('nv', JSON.stringify([
      { id: 53, cid: 1, cn: 'J', tipo: 'credito', fecha: '06/30/2026', numFactura: '0053',
        total: 35, ganancia: 10, items: [],
        pagosFactura: [{ pid: 'x1', monto: 25, fecha: '07/09/2026' },
                       { pid: 'x2', monto: 1, fecha: '07/09/2026' }] }]));
    ventas = LS('nv', []);
    verCl(1); await new Promise(r => setTimeout(r, 400));
    const pg = document.getElementById('p-cl-perfil');
    // El renglón puede venir ya abierto de la prueba anterior: se mira si hace falta tocarlo
    let t = pg.innerText;
    if (!/TE HA PAGADO EN TOTAL/.test(t)) {
      const fila = [...pg.querySelectorAll('[onclick*="togglePanelCl"]')]
        .find(x => /Sus pagos/i.test(x.textContent || ''));
      if (fila) fila.click();
      await new Promise(r => setTimeout(r, 350));
      t = pg.innerText;
    }
    return { dice25: /\+\$25\.00/.test(t), dice1: /\+\$1\.00/.test(t),
             desplegables: pg.querySelectorAll('[onclick*="desplegarPagoCliente"]').length };
  });
  T('🔑 salen los DOS por separado: $25 y $1', r5.dice25 && r5.dice1,
     '25:' + r5.dice25 + ' 1:' + r5.dice1);
  T('🔒 y ninguno dice "se repartió"', r5.desplegables === 0, String(r5.desplegables));

  console.log(`\n  ${ok} bien · ${mal} mal`);
  const reales = errs.filter(e => !/firebase|onAuthStateChanged/i.test(e));
  if (reales.length) { console.log('⚠️ JS:'); reales.slice(0, 4).forEach(e => console.log('   ' + e)); }
  await b.close();
  process.exit(mal ? 1 : 0);
})();
