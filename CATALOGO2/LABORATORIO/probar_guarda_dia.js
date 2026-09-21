/**
 * 💾 GUARDA TU DÍA  (8 sep 2026)
 * Sensei, tras quedarse fuera de la app: "imagínate que yo pierda todos mis datos, es
 * como perder el negocio. Y eso sería perderlo todo."
 */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file:///home/claude/trabajo/index.html');
  await p.waitForTimeout(2600);
  let ok = 0, mal = 0;
  const T = (n, c, d) => { if (c) { ok++; console.log('  ✅ ' + n); } else { mal++; console.log('  ❌ ' + n + (d ? '  →  ' + d : '')); } };

  const montar = (diasSinBackup) => p.evaluate((dias) => {
    ['pantalla-login', 'pantalla-bloqueo'].forEach(id => {
      const e = document.getElementById(id); if (e) e.style.display = 'none';
    });
    document.getElementById('app-contenido').style.display = 'block';
    const hoy = fechaHoy();
    localStorage.setItem('ncl', JSON.stringify([{ id: 1, nombre: 'B', negocio: 'B1' }]));
    localStorage.setItem('nv', JSON.stringify([
      { id: 1, cid: 1, cn: 'B', tipo: 'contado', fecha: hoy, numFactura: '1', total: 285,
        ganancia: 90, items: [], pagosFactura: [{ pid: 'a', monto: 285, fecha: hoy }] },
      { id: 2, cid: 1, cn: 'B', tipo: 'credito', fecha: hoy, numFactura: '2', total: 200,
        ganancia: 60, items: [], pagosFactura: [] },
      // Una de AYER: no debe contar en "hoy vendiste"
      { id: 3, cid: 1, cn: 'B', tipo: 'contado', fecha: '01/01/2026', numFactura: '3', total: 999,
        ganancia: 300, items: [], pagosFactura: [{ pid: 'c', monto: 999, fecha: '01/01/2026' }] }]));
    ventas = LS('nv', []); clientes = LS('ncl', []);
    if (dias === null) localStorage.removeItem('ultimoBackup');
    else localStorage.setItem('ultimoBackup', String(Date.now() - dias * 86400000));
  }, diasSinBackup);

  console.log('\n1️⃣  💾 EL AVISO SALE Y DICE LO QUE HACE FALTA');
  await montar(3);
  const r1 = await p.evaluate(async () => {
    avisarGuardarElDia();
    await new Promise(r => setTimeout(r, 350));
    const ov = document.getElementById('guardadia-overlay');
    return { abrio: !!ov && ov.style.display === 'flex',
             alto: ov ? Math.round(ov.getBoundingClientRect().height) : 0,
             t: ov ? ov.innerText : '',
             hayBajar: /bajarBackupDelDia/.test(ov ? ov.innerHTML : ''),
             hayAhoraNo: /cerrarGuardarElDia/.test(ov ? ov.innerHTML : '') };
  });
  T('💾 el aviso abre y se ve', r1.abrio && r1.alto > 200, r1.alto + ' px');
  T('🔑 dice cuánto vendió HOY: $485.00', /\$485\.00/.test(r1.t), r1.t.slice(0, 90).replace(/\n/g, ' | '));
  T('🔒 y NO mete las ventas de otros días ($999)', !/\$999/.test(r1.t));
  T('🔑 dice hace cuánto fue el último backup', /hace 3 d\u00eda/.test(r1.t));
  T('💾 tiene el botón de bajarlo', r1.hayBajar);
  T('y el de "Ahora no"', r1.hayAhoraNo);

  console.log('\n2️⃣  ⚠️ SI NUNCA BAJÓ UNO, AVISA MÁS FUERTE');
  await montar(null);
  const r2 = await p.evaluate(async () => {
    avisarGuardarElDia();
    await new Promise(r => setTimeout(r, 300));
    const ov = document.getElementById('guardadia-overlay');
    const t = ov.innerText;
    cerrarGuardarElDia();
    return { t, rojo: /#FFEBEE/.test(ov.innerHTML) };
  });
  T('⚠️ dice que nunca ha bajado uno', /Nunca has bajado/i.test(r2.t), r2.t.slice(0, 100).replace(/\n/g, ' | '));
  T('y sale en rojo', r2.rojo);

  console.log('\n3️⃣  ✅ SI LO BAJÓ HOY, NO ALARMA');
  await montar(0);
  const r3 = await p.evaluate(async () => {
    avisarGuardarElDia();
    await new Promise(r => setTimeout(r, 300));
    const ov = document.getElementById('guardadia-overlay');
    const t = ov.innerText;
    const rojo = /#FFEBEE/.test(ov.innerHTML);
    cerrarGuardarElDia();
    return { t, rojo };
  });
  T('✅ dice que el último fue hoy', /fue hoy/.test(r3.t), r3.t.slice(0, 100).replace(/\n/g, ' | '));
  T('🔒 y NO sale en rojo', !r3.rojo);

  console.log('\n4️⃣  🔗 SALE AL TERMINAR EL CIERRE DE RUTA');
  const r4 = await p.evaluate(() => ({
    enElCierre: /avisarGuardarElDia/.test(String(guardarCierreRuta)),
    bajaDeVerdad: /exportD/.test(String(bajarBackupDelDia))
  }));
  T('🔗 el cierre de ruta lo llama', r4.enElCierre);
  T('🔑 y el botón baja el backup de verdad', r4.bajaDeVerdad);

  console.log('\n5️⃣  🔙 EL RECUADRO ESTÁ REGISTRADO');
  const r5 = await p.evaluate(() => ({
    enLista: RECUADROS_ENCIMA.some(x => x.id === 'guardadia-overlay'),
    cierra: typeof cerrarGuardarElDia === 'function'
  }));
  T('🔙 registrado en el botón atrás', r5.enLista);
  T('y su función de cerrar existe', r5.cierra);

  console.log(`\n  ${ok} bien · ${mal} mal`);
  const reales = errs.filter(e => !/firebase|onAuthStateChanged/i.test(e));
  if (reales.length) { console.log('⚠️ JS:'); reales.slice(0, 3).forEach(e => console.log('   ' + e)); }
  await b.close();
  process.exit(mal ? 1 : 0);
})();
