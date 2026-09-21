/**
 * 💰🔴 LAS FUNCIONES DE DINERO QUE NO TENÍAN NINGUNA PRUEBA  (4 sep 2026)
 *
 * El análisis del 4 sep encontró que 71 funciones ESCRIBEN dinero y 56 no tenían
 * ninguna prueba. Estas son las 19 GRAVES: las que mueven o borran dinero.
 *
 * 🔑 CADA UNA se prueba así: se monta un negocio con números conocidos, se llama a la
 * función, y después se comprueban LAS LEYES DEL DINERO. No basta con que no reviente:
 * las cuentas tienen que seguir cuadrando.
 */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
const fs = require('fs');

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 1000 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file:///home/claude/trabajo/index.html');
  await p.waitForTimeout(2600);
  await p.evaluate(fs.readFileSync('/home/claude/laboratorio/leyes_dinero.js', 'utf8'));

  let ok = 0, mal = 0;
  const T = (n, c, d) => { if (c) { ok++; console.log('  ✅ ' + n); } else { mal++; console.log('  ❌ ' + n + (d ? '  →  ' + d : '')); } };

  // Monta siempre el mismo negocio conocido
  const montar = () => p.evaluate(() => {
    ['pantalla-login', 'pantalla-bloqueo'].forEach(id => {
      const e = document.getElementById(id); if (e) e.style.display = 'none';
    });
    document.getElementById('app-contenido').style.display = 'block';
    window.protegerConHuella = function (cb) { cb(); };
    window.alert = function () {}; window.confirm = function () { return true; };
    window.avisoGrande = function () {};
    localStorage.setItem('ncl', JSON.stringify([
      { id: 1, nombre: 'Isidro', apellido: 'Gonzalez', negocio: 'URBAN', tel: '4015550001' },
      { id: 2, nombre: 'Nelson', apellido: 'Castro', negocio: 'RD', tel: '4015550002' }]));
    localStorage.setItem('np', JSON.stringify([
      { id: 'p1', nombre: 'Gel', marca: 'G', precio: 10, costo: 6, stock: 100, min: 5 }]));
    localStorage.setItem('nv', JSON.stringify([
      { id: 101, cid: 1, cn: 'Isidro', tipo: 'credito', fecha: '08/01/2026', numFactura: '0101',
        total: 100, ganancia: 30, items: [{ pid: 'p1', nombre: 'Gel', cant: 10, precio: 10, costo: 7 }],
        pagosFactura: [{ pid: 'pg1', monto: 40, fecha: '08/10/2026' }] },
      { id: 102, cid: 1, cn: 'Isidro', tipo: 'credito', fecha: '08/15/2026', numFactura: '0102',
        total: 50, ganancia: 15, items: [{ pid: 'p1', nombre: 'Gel', cant: 5, precio: 10, costo: 7 }],
        pagosFactura: [] },
      { id: 103, cid: 2, cn: 'Nelson', tipo: 'contado', fecha: '08/20/2026', numFactura: '0103',
        total: 60, ganancia: 18, items: [{ pid: 'p1', nombre: 'Gel', cant: 6, precio: 10, costo: 7 }],
        pagosFactura: [{ pid: 'pg2', monto: 60, fecha: '08/20/2026' }] }]));
    localStorage.setItem('ngastos', JSON.stringify([
      { id: 501, concepto: 'Gasolina', monto: 45, fecha: '08/22/2026', categoria: 'transporte' }]));
    localStorage.setItem('nc', JSON.stringify([
      { id: 701, sid: 900, sn: 'Kanar', tipo: 'credito', fecha: '08/05/2026', total: 400,
        items: [{ pid: 'p1', nombre: 'Gel', cant: 100, costo: 4 }],
        pagosFactura: [{ pid: 'c1', monto: 150, fecha: '08/12/2026' }] }]));
    localStorage.setItem('nsup', JSON.stringify([{ id: 900, nombre: 'Kanar' }]));
    clientes = LS('ncl', []); ventas = LS('nv', []);
    compras = LS('nc', []); suplidores = LS('nsup', []);
    try { gastos = LS('ngastos', []); } catch (e) {}
    loadProds();
  });

  // Revisa TODAS las leyes y devuelve la primera rota
  const leyes = () => p.evaluate(() => {
    for (let i = 0; i < window.LEYES_DINERO.length; i++) {
      let f = null;
      try { f = window.LEYES_DINERO[i].revisar(); } catch (e) { f = 'la ley reventó: ' + e.message; }
      if (f) return window.LEYES_DINERO[i].nombre + ' → ' + f;
    }
    return null;
  });

  console.log('\n1️⃣  🗑️ BORRAR UN PAGO — los tres caminos');
  for (const cual of ['borrarPagoDesdeFactura', 'borrarPagoDesdeCuenta', 'borrarPagoDesdeEditor']) {
    await montar();
    const r = await p.evaluate(async (fn) => {
      const antes = balanceDelCliente(1);
      let reventó = null;
      try {
        if (typeof window[fn] === 'function') window[fn](101, 'pg1');
      } catch (e) { reventó = e.message; }
      await new Promise(r => setTimeout(r, 200));
      const v = LS('nv', []).find(x => x.id === 101);
      return { antes, despues: balanceDelCliente(1), reventó,
               pagos: v ? (v.pagosFactura || []).length : -1 };
    }, cual);
    const ley = await leyes();
    T('🔒 ' + cual + ' no revienta', !r.reventó, r.reventó);
    T('   y las leyes del dinero siguen bien', !ley, ley);
    if (r.pagos === 0) {
      T('   🔑 al borrar el pago de $40, la deuda sube a $110',
         Math.abs(r.despues - 110) < 0.02, 'antes $' + r.antes + ' ahora $' + r.despues);
    }
  }

  console.log('\n2️⃣  🚫 CANCELAR UNA FACTURA');
  await montar();
  const r2 = await p.evaluate(async () => {
    const antes = balanceDelCliente(1);
    let reventó = null;
    try { if (typeof cancelarFactura === 'function') cancelarFactura(102); } catch (e) { reventó = e.message; }
    await new Promise(r => setTimeout(r, 250));
    const v = LS('nv', []).find(x => x.id === 102);
    return { antes, despues: balanceDelCliente(1), reventó, cancelada: v ? !!v.cancelada : null,
             otroCliente: balanceDelCliente(2) };
  });
  const ley2 = await leyes();
  T('🔒 cancelarFactura no revienta', !r2.reventó, r2.reventó);
  T('   y las leyes siguen bien', !ley2, ley2);
  if (r2.cancelada) {
    T('   🔑 la deuda baja de $110 a $60', Math.abs(r2.despues - 60) < 0.02,
       'antes $' + r2.antes + ' ahora $' + r2.despues);
  }
  T('   🔒 y NO toca al otro cliente', Math.abs(r2.otroCliente) < 0.02, String(r2.otroCliente));

  console.log('\n3️⃣  💾 GUARDAR EL BALANCE INICIAL');
  await montar();
  const r3 = await p.evaluate(async () => {
    let reventó = null;
    const antes = balanceDelCliente(2);
    try {
      // Los campos tienen que existir ANTES de llamarla
      ['bi-monto', 'bi-fecha', 'bi-nota'].forEach(function (id) {
        if (!document.getElementById(id)) {
          const e2 = document.createElement('input'); e2.id = id; document.body.appendChild(e2);
        }
      });
      document.getElementById('bi-monto').value = '75';
      document.getElementById('bi-fecha').value = '2026-07-01';
      window._biCid = 2;
      if (typeof guardarBalanceInicial === 'function') guardarBalanceInicial(2);
    } catch (e) { reventó = e.message; }
    await new Promise(r => setTimeout(r, 250));
    return { antes, despues: balanceDelCliente(2), reventó };
  });
  const ley3 = await leyes();
  T('🔒 guardarBalanceInicial no revienta', !r3.reventó, r3.reventó);
  T('   y las leyes siguen bien', !ley3, ley3);

  console.log('\n4️⃣  ✏️ EL EDITOR DE PAGOS');
  await montar();
  const r4 = await p.evaluate(async () => {
    let reventó = null;
    const antes = balanceDelCliente(1);
    try {
      window._editorPagoVid = 101; window._editorPagoPid = 'pg1';
      const m = document.createElement('input'); m.id = 'editor-pago-monto'; m.value = '25'; document.body.appendChild(m);
      const f = document.createElement('input'); f.id = 'editor-pago-fecha'; f.type = 'date'; f.value = '2026-08-10'; document.body.appendChild(f);
      if (typeof guardarEditorPago === 'function') guardarEditorPago();
    } catch (e) { reventó = e.message; }
    await new Promise(r => setTimeout(r, 250));
    return { antes, despues: balanceDelCliente(1), reventó };
  });
  const ley4 = await leyes();
  T('🔒 guardarEditorPago no revienta', !r4.reventó, r4.reventó);
  T('   y las leyes siguen bien', !ley4, ley4);

  console.log('\n5️⃣  🗑️ ELIMINAR: cliente, compra, gasto, factura cancelada');
  const borrados = [
    ['eliminarGasto', '501'],
    ['eliminarCompra', '701'],
    ['eliminarFacturaCancelada', '102'],
    ['eliminarCl', '2']
  ];
  for (const [fn, arg] of borrados) {
    await montar();
    const r = await p.evaluate(async (d) => {
      let reventó = null;
      try { if (typeof window[d[0]] === 'function') window[d[0]](d[1]); } catch (e) { reventó = e.message; }
      await new Promise(r => setTimeout(r, 200));
      return { reventó };
    }, [fn, arg]);
    const ley = await leyes();
    T('🔒 ' + fn + ' no revienta', !r.reventó, r.reventó);
    T('   y las leyes del dinero siguen bien', !ley, ley);
  }

  console.log('\n6️⃣  🧹 ELIMINAR CLIENTES DUPLICADOS');
  await montar();
  const r6 = await p.evaluate(async () => {
    // Se mete un duplicado, como los dos Jose Rodriguez de Sensei
    const C = LS('ncl', []);
    C.push({ id: 3, nombre: 'Isidro', apellido: 'Gonzalez', negocio: 'URBAN', tel: '4015550001' });
    localStorage.setItem('ncl', JSON.stringify(C)); clientes = LS('ncl', []);
    const antes = { clientes: LS('ncl', []).length, deuda1: balanceDelCliente(1) };
    let reventó = null;
    try { if (typeof eliminarDuplicadosClientes === 'function') eliminarDuplicadosClientes(); } catch (e) { reventó = e.message; }
    await new Promise(r => setTimeout(r, 300));
    return { antes, despues: { clientes: LS('ncl', []).length, deuda1: balanceDelCliente(1) }, reventó };
  });
  const ley6 = await leyes();
  T('🔒 eliminarDuplicadosClientes no revienta', !r6.reventó, r6.reventó);
  T('   y las leyes siguen bien', !ley6, ley6);
  T('   🔑 la deuda de Isidro NO cambia',
     Math.abs(r6.antes.deuda1 - r6.despues.deuda1) < 0.02,
     '$' + r6.antes.deuda1 + ' → $' + r6.despues.deuda1);

  console.log('\n7️⃣  💵 GUARDAR UN GASTO');
  await montar();
  const r7 = await p.evaluate(async () => {
    let reventó = null;
    const antes = LS('ngastos', []).length;
    try {
      ir('p-gastos'); await new Promise(r => setTimeout(r, 200));
      const c = document.getElementById('gconcepto'); if (c) c.value = 'Prueba';
      const m = document.getElementById('gmonto'); if (m) m.value = '30';
      if (typeof saveGasto === 'function') saveGasto();
    } catch (e) { reventó = e.message; }
    await new Promise(r => setTimeout(r, 250));
    return { antes, despues: LS('ngastos', []).length, reventó };
  });
  const ley7 = await leyes();
  T('🔒 saveGasto no revienta', !r7.reventó, r7.reventó);
  T('   y las leyes del dinero siguen bien', !ley7, ley7);

  console.log('\n8️⃣  👤 GUARDAR UN CLIENTE');
  await montar();
  const r8 = await p.evaluate(async () => {
    let reventó = null;
    const antes = balanceDelCliente(1);
    try {
      const n = document.getElementById('cnombre'); if (n) n.value = 'Isidro';
      if (typeof saveCl === 'function') saveCl();
    } catch (e) { reventó = e.message; }
    await new Promise(r => setTimeout(r, 250));
    return { antes, despues: balanceDelCliente(1), reventó };
  });
  const ley8 = await leyes();
  T('🔒 saveCl no revienta', !r8.reventó, r8.reventó);
  T('   y las leyes siguen bien', !ley8, ley8);

  console.log('\n9️⃣  💾 RESTAURAR UN BACKUP (importD)');
  await montar();
  const r9 = await p.evaluate(async () => {
    // 🔑 Lo más delicado: si esto falla mal, se lleva TODO por delante.
    const antesV = LS('nv', []).length, antesC = LS('ncl', []).length;
    let reventó = null;
    try {
      // Se le mete basura, que es el caso peligroso
      // 🔑 importD(inp) recibe el INPUT, no un evento: usa inp.files[0]
      const inp = { files: [new File(['esto no es un backup'], 'malo.json', { type: 'application/json' })] };
      if (typeof importD === 'function') importD(inp);
    } catch (e) { reventó = e.message; }
    await new Promise(r => setTimeout(r, 500));
    return { antesV, antesC, despuesV: LS('nv', []).length, despuesC: LS('ncl', []).length, reventó };
  });
  const ley9 = await leyes();
  T('🔒 importD con basura no revienta', !r9.reventó, r9.reventó);
  T('   🔑 y NO borra las ventas', r9.despuesV === r9.antesV, r9.antesV + ' → ' + r9.despuesV);
  T('   🔑 ni los clientes', r9.despuesC === r9.antesC, r9.antesC + ' → ' + r9.despuesC);
  T('   y las leyes siguen bien', !ley9, ley9);

  console.log(`\n  ${ok} bien · ${mal} mal`);
  const reales = errs.filter(e => !/firebase|onAuthStateChanged/i.test(e));
  if (reales.length) { console.log('⚠️ JS:'); reales.slice(0, 5).forEach(e => console.log('   ' + e)); }
  await b.close();
  process.exit(mal ? 1 : 0);
})();
