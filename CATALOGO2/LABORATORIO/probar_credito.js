/**
 * 💳 PROBAR EL CRÉDITO A FAVOR  (4 sep 2026)
 *
 * Sensei: "le di a aplicar el crédito y no se aplica nada... cuando yo le dé a usar
 * crédito me debe llevar a la factura que se le aplica el crédito y mostrarme el
 * balance completo del cliente, o cómo es que me voy a dar cuenta que quedó aplicado".
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

  const sembrar = () => p.evaluate(() => {
    ['pantalla-login', 'pantalla-bloqueo'].forEach(id => {
      const e = document.getElementById(id); if (e) e.style.display = 'none';
    });
    document.getElementById('app-contenido').style.display = 'block';
    window.protegerConHuella = function (cb) { cb(); };
    // El caso real de Jose: debe $20 en una factura y tiene $5 de crédito
    localStorage.setItem('ncl', JSON.stringify([
      { id: 6, nombre: 'Jose', apellido: 'Rodriguez', negocio: 'JRJ', creditoAFavor: 5 }]));
    localStorage.setItem('nv', JSON.stringify([
      { id: 601, cid: 6, cn: 'J', tipo: 'credito', fecha: '08/15/2026', numFactura: '0455',
        total: 35, ganancia: 10, items: [],
        pagosFactura: [{ pid: 'a', monto: 35, fecha: '09/04/2026' }] },
      { id: 619, cid: 6, cn: 'J', tipo: 'credito', fecha: '09/04/2026', numFactura: '0619',
        total: 20, ganancia: 6, items: [], pagosFactura: [] }]));
    clientes = LS('ncl', []); ventas = LS('nv', []);
  });

  console.log('\n1️⃣  🔑 EL CRÉDITO SE APLICA Y LA DEUDA BAJA');
  await sembrar();
  const r1 = await p.evaluate(async () => {
    const antes = { debe: balanceDelCliente(6), credito: LS('ncl', [])[0].creditoAFavor };
    ir('p-cxc'); await new Promise(r => setTimeout(r, 200));
    abrirAbono(6); await new Promise(r => setTimeout(r, 400));
    const oc = window.confirm; window.confirm = () => true;
    usarCreditoAFavor(6);
    await new Promise(r => setTimeout(r, 600));
    window.confirm = oc;
    const f = LS('nv', []).find(v => String(v.numFactura) === '0619');
    return { antes, debe: balanceDelCliente(6), credito: LS('ncl', [])[0].creditoAFavor,
             pagos: (f.pagosFactura || []).map(x => ({ m: x.monto, pid: x.pid, met: x.metodo })) };
  });
  T('antes debía $20 con $5 de crédito', r1.antes.debe === 20 && r1.antes.credito === 5, JSON.stringify(r1.antes));
  T('🔑 ahora debe $15', r1.debe === 15, String(r1.debe));
  T('🔑 y el crédito quedó en $0', r1.credito === 0, String(r1.credito));
  T('🔑 el pago se apuntó en la factura', r1.pagos.length === 1 && r1.pagos[0].m === 5, JSON.stringify(r1.pagos));
  T('🔑 y lleva su `pid`, como todos los demás',
     !!(r1.pagos[0] && r1.pagos[0].pid), JSON.stringify(r1.pagos[0]));
  T('marcado como crédito del cliente', r1.pagos[0] && r1.pagos[0].met === 'credito_cliente');

  console.log('\n2️⃣  📋 EL AVISO DICE DÓNDE FUE Y CÓMO QUEDA');
  await sembrar();
  const r2 = await p.evaluate(async () => {
    ir('p-cxc'); await new Promise(r => setTimeout(r, 200));
    abrirAbono(6); await new Promise(r => setTimeout(r, 400));
    const oc = window.confirm; window.confirm = () => true;
    usarCreditoAFavor(6);
    await new Promise(r => setTimeout(r, 700));
    window.confirm = oc;
    const ov = document.getElementById('credito-aplicado-overlay');
    return { salio: !!ov && ov.style.display === 'flex',
             texto: ov ? ov.innerText : '',
             hayBotonFactura: ov ? !!ov.querySelector('[onclick*="verFacturaProfesional"]') : false };
  });
  T('📋 sale el aviso', r2.salio, String(r2.salio));
  T('dice cuánto se usó: $5.00', /SE USARON[\s\S]*\$5\.00/.test(r2.texto), r2.texto.slice(0, 70).replace(/\n/g, ' | '));
  T('🔑 dice EN QUÉ FACTURA: la #0619', /Factura #0619/.test(r2.texto));
  T('🔑 dice cuánto debía esa factura: $20.00', /Deb.a[\s\S]{0,20}\$20\.00/.test(r2.texto));
  T('🔑 y cuánto debe ahora: $15.00', /Ahora debe[\s\S]{0,20}\$15\.00/.test(r2.texto));
  T('🔑 enseña SU BALANCE completo', /SU BALANCE AHORA/.test(r2.texto));
  T('con el crédito que le queda', /Cr.dito que le queda[\s\S]{0,20}\$0\.00/.test(r2.texto));
  T('👁️ y el botón para ver la factura', r2.hayBotonFactura, String(r2.hayBotonFactura));

  console.log('\n3️⃣  🔑 NO TE SACA DE LA PANTALLA');
  await sembrar();
  const r3 = await p.evaluate(async () => {
    ir('p-cxc'); await new Promise(r => setTimeout(r, 200));
    abrirAbono(6); await new Promise(r => setTimeout(r, 400));
    const oc = window.confirm; window.confirm = () => true;
    usarCreditoAFavor(6);
    await new Promise(r => setTimeout(r, 700));
    window.confirm = oc;
    cerrarCreditoAplicado();
    await new Promise(r => setTimeout(r, 300));
    // Tras cerrar el aviso, la ficha del cliente tiene que seguir abierta y al día
    const t = document.getElementById('p-cxc').innerText;
    // 🔑 La FICHA abierta enseña sus facturas y el botón de registrar pago.
    // La LISTA general no: solo enseña "Total por cobrar" y las tarjetas.
    return { pantalla: pantallaActual(), diceEl15: /\$15\.00/.test(t), diceJose: /Jose/.test(t),
             sigueLaFicha: /APLICAR PAGO|Registrar pago|FACTURAS A CREDITO/i.test(t),
             volvioALaLista: /Total por cobrar/i.test(t) };
  });
  T('🔑 sigues en Cuentas por Cobrar', r3.pantalla === 'p-cxc', String(r3.pantalla));
  T('🔑 con el balance ya al día ($15.00)', r3.diceEl15, String(r3.diceEl15));
  T('y el cliente sigue en pantalla', r3.diceJose);
  T('🔑 la FICHA del cliente sigue abierta, no te echa a la lista',
     r3.sigueLaFicha && !r3.volvioALaLista,
     'ficha=' + r3.sigueLaFicha + ' lista=' + r3.volvioALaLista);

  console.log('\n4️⃣  🔒 SI SE REPARTE EN VARIAS, SALEN TODAS');
  const r4 = await p.evaluate(async () => {
    localStorage.setItem('ncl', JSON.stringify([{ id: 7, nombre: 'Test', creditoAFavor: 30 }]));
    localStorage.setItem('nv', JSON.stringify([
      { id: 1, cid: 7, cn: 'T', tipo: 'credito', fecha: '07/01/2026', numFactura: '0100',
        total: 20, ganancia: 6, items: [], pagosFactura: [] },
      { id: 2, cid: 7, cn: 'T', tipo: 'credito', fecha: '08/01/2026', numFactura: '0200',
        total: 20, ganancia: 6, items: [], pagosFactura: [] }]));
    clientes = LS('ncl', []); ventas = LS('nv', []);
    const oc = window.confirm; window.confirm = () => true;
    usarCreditoAFavor(7);
    await new Promise(r => setTimeout(r, 600));
    window.confirm = oc;
    const ov = document.getElementById('credito-aplicado-overlay');
    return { texto: ov ? ov.innerText : '', debe: balanceDelCliente(7),
             credito: LS('ncl', [])[0].creditoAFavor };
  });
  T('🔒 debía $40, tenía $30 → ahora debe $10', r4.debe === 10, String(r4.debe));
  T('🔒 y no le queda crédito', r4.credito === 0, String(r4.credito));
  T('📋 el aviso nombra LAS DOS facturas',
     /#0100/.test(r4.texto) && /#0200/.test(r4.texto), r4.texto.slice(0, 90).replace(/\n/g, ' | '));
  T('y dice que fueron varias', /ESTAS FACTURAS/.test(r4.texto));

  console.log('\n5️⃣  🔒 NO SE APLICA DONDE NO DEBE');
  const r5 = await p.evaluate(async () => {
    // Una factura de CONTADO ya pagada NO debe recibir el crédito
    localStorage.setItem('ncl', JSON.stringify([{ id: 8, nombre: 'T2', creditoAFavor: 10 }]));
    localStorage.setItem('nv', JSON.stringify([
      { id: 1, cid: 8, cn: 'T', tipo: 'contado', fecha: '07/01/2026', numFactura: '0300',
        total: 40, ganancia: 12, items: [], pagosFactura: [{ pid: 'x', monto: 40, fecha: '07/01/2026' }] }]));
    clientes = LS('ncl', []); ventas = LS('nv', []);
    let dicho = null;
    const oav = window.avisoGrande; window.avisoGrande = (m) => { dicho = m; };
    const oc = window.confirm; window.confirm = () => true;
    usarCreditoAFavor(8);
    await new Promise(r => setTimeout(r, 400));
    window.avisoGrande = oav; window.confirm = oc;
    return { dicho, credito: LS('ncl', [])[0].creditoAFavor,
             pagos: (LS('nv', [])[0].pagosFactura || []).length };
  });
  T('🔒 avisa que no hay dónde aplicarlo', /no tiene facturas pendientes/i.test(r5.dicho || ''), (r5.dicho || '').slice(0, 60));
  T('🔒 y el crédito NO se gasta', r5.credito === 10, String(r5.credito));
  T('🔒 ni se apunta ningún pago', r5.pagos === 1, String(r5.pagos));

  console.log('\n6️⃣  🔙 EL BOTÓN ATRÁS LO CIERRA');
  const r6 = await p.evaluate(() => ({
    enLista: RECUADROS_ENCIMA.some(x => x.id === 'credito-aplicado-overlay'),
    cierra: typeof cerrarCreditoAplicado === 'function'
  }));
  T('🔙 el recuadro está registrado', r6.enLista);
  T('y su función de cerrar existe', r6.cierra);

  console.log('\n7️⃣  💳 SE PUEDE APLICAR DESDE LA FICHA DEL CLIENTE');
  const r7 = await p.evaluate(async () => {
    localStorage.setItem('ncl', JSON.stringify([
      { id: 6, nombre: 'Jose', apellido: 'Rodriguez', apodo: 'JOSE', negocio: 'JRJ BARBERSHOP',
        dir: '944 atwells Avenue Providence', tel: '4019524839', creditoAFavor: 5 }]));
    localStorage.setItem('nv', JSON.stringify([
      { id: 619, cid: 6, cn: 'Jose', tipo: 'credito', fecha: '09/04/2026', numFactura: '0619',
        total: 20, ganancia: 6, items: [], pagosFactura: [] }]));
    clientes = LS('ncl', []); ventas = LS('nv', []);
    verCl(6); await new Promise(r => setTimeout(r, 400));
    const pg = document.getElementById('p-cl-perfil');
    const antes = (pg.innerText.match(/DEBE\s*\n?\s*\$([\d.,]+)/) || [])[1];
    const fila = [...pg.querySelectorAll('[onclick*="togglePanelCl"]')]
      .find(x => /Cr.dito a favor/i.test(x.textContent || ''));
    if (fila) fila.click();
    await new Promise(r => setTimeout(r, 350));
    const boton = pg.querySelectorAll('[onclick*="usarCreditoAFavor"]').length;
    const campoFecha = !!document.getElementById('cred-fecha');
    if (!boton) return { antes, boton, campoFecha };
    const oc = window.confirm; window.confirm = () => true;
    pg.querySelector('[onclick*="usarCreditoAFavor"]').click();
    await new Promise(r => setTimeout(r, 700));
    window.confirm = oc;
    try { cerrarCreditoAplicado(); } catch (e) {}
    await new Promise(r => setTimeout(r, 300));
    return { antes, boton, campoFecha,
             pantalla: pantallaActual(),
             despues: (document.getElementById('p-cl-perfil').innerText.match(/DEBE\s*\n?\s*\$([\d.,]+)/) || [])[1],
             credito: LS('ncl', [])[0].creditoAFavor || 0,
             debe: balanceDelCliente(6) };
  });
  T('🔑 el botón de aplicar ESTÁ en la ficha', r7.boton === 1, String(r7.boton));
  T('con su campo de fecha', r7.campoFecha);
  T('🔑 la deuda baja de $20 a $15', Math.abs(r7.debe - 15) < 0.02, String(r7.debe));
  T('🔑 y el DEBE de arriba se ve al día', r7.despues === '15.00',
     r7.antes + ' → ' + r7.despues);
  T('🔑 y te DEJA en la ficha, no te saca', r7.pantalla === 'p-cl-perfil', String(r7.pantalla));
  T('el crédito quedó en $0', r7.credito === 0, String(r7.credito));

  console.log('\n8️⃣  👥 DOS CLIENTES CON EL MISMO NOMBRE NO SON DUPLICADOS');
  const r8 = await p.evaluate(() => {
    // El caso real de Sensei: dos Jose Rodriguez, barberías distintas
    const lista = [
      { id: 1, nombre: 'Jose', apellido: 'Rodriguez', apodo: 'JOSE', negocio: 'JRJ BARBERSHOP',
        dir: '944 atwells Avenue Providence', tel: '4019524839' },
      { id: 2, nombre: 'Jose', apellido: 'Rodriguez', apodo: 'JOSELITO', negocio: "D' JOSELITO BARBERSHOP",
        dir: '970 Broad St Providence', tel: '4012867618' },
      // Y uno que SÍ es duplicado: mismo teléfono
      { id: 3, nombre: 'Pedro', apellido: 'Gomez', negocio: 'A', tel: '4015551111' },
      { id: 4, nombre: 'Pedro', apellido: 'Gomez', negocio: 'B', tel: '4015551111' },
      // Y otro: mismo nombre Y mismo negocio
      { id: 5, nombre: 'Luis', apellido: 'Diaz', negocio: 'CORTES LUIS', tel: '4015552222' },
      { id: 6, nombre: 'Luis', apellido: 'Diaz', negocio: 'CORTES LUIS', tel: '4015553333' }
    ];
    return {
      josesSeparados: posiblesDuplicadosDe(lista[0], lista).length === 0,
      pedroJunto: posiblesDuplicadosDe(lista[2], lista).length === 1,
      luisJunto: posiblesDuplicadosDe(lista[4], lista).length === 1,
      grupos: Object.keys(agruparPosiblesDuplicados(lista))
                .filter(k => agruparPosiblesDuplicados(lista)[k].length > 1).length
    };
  });
  T('🔑 los dos Jose NO se dan por duplicados', r8.josesSeparados, String(r8.josesSeparados));
  T('🔒 pero el mismo TELÉFONO sí los junta', r8.pedroJunto, String(r8.pedroJunto));
  T('🔒 y el mismo nombre Y NEGOCIO también', r8.luisJunto, String(r8.luisJunto));
  T('🔒 en total, 2 grupos de duplicados', r8.grupos === 2, String(r8.grupos));

  console.log('\n9️⃣  💰 EL CRÉDITO SE VE EN EL CUADRO DE ARRIBA');
  const r9 = await p.evaluate(async () => {
    localStorage.setItem('ncl', JSON.stringify([
      { id: 9, nombre: 'Test', negocio: 'B', creditoAFavor: 5 },
      { id: 10, nombre: 'SinCredito', negocio: 'C', creditoAFavor: 0 }]));
    localStorage.setItem('nv', JSON.stringify([
      { id: 1, cid: 9, cn: 'T', tipo: 'credito', fecha: '09/04/2026', numFactura: '1',
        total: 20, ganancia: 6, items: [], pagosFactura: [] },
      { id: 2, cid: 10, cn: 'S', tipo: 'credito', fecha: '09/04/2026', numFactura: '2',
        total: 30, ganancia: 9, items: [], pagosFactura: [] }]));
    clientes = LS('ncl', []); ventas = LS('nv', []);
    verCl(9); await new Promise(r => setTimeout(r, 400));
    const conCredito = document.getElementById('p-cl-perfil').innerText;
    verCl(10); await new Promise(r => setTimeout(r, 400));
    const sinCredito = document.getElementById('p-cl-perfil').innerText;
    return { conCredito, sinCredito };
  });
  T('🔑 sale la casilla A FAVOR', /A FAVOR/.test(r9.conCredito),
     r9.conCredito.slice(0, 110).replace(/\n/g, ' | '));
  T('🔑 con su monto: $5.00', /A FAVOR[\s\S]{0,15}\$5\.00/.test(r9.conCredito));
  T('🔒 junto a DEBE, en el mismo cuadro', /DEBE[\s\S]{0,30}A FAVOR/.test(r9.conCredito));
  T('🔒 y el banner para usarlo', /TIENE A SU FAVOR/.test(r9.conCredito));
  T('🔒 si NO tiene crédito, no ocupa sitio', !/A FAVOR/.test(r9.sinCredito));

  console.log(`\n  ${ok} bien · ${mal} mal`);
  const reales = errs.filter(e => !/firebase|onAuthStateChanged/i.test(e));
  if (reales.length) { console.log('⚠️ JS:'); reales.slice(0, 4).forEach(e => console.log('   ' + e)); }
  await b.close();
  process.exit(mal || reales.length ? 1 : 0);
})();
