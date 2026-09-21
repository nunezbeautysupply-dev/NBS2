/**
 * 📋 LA BARRA DE PEDIDOS GUARDADOS  (17 sep 2026)
 *
 * 🔴 Sensei: guardaba 3 pedidos de una barbería, volvía a entrar para tomar el de otro
 * barbero, y al terminar no veía los 3 anteriores. Creía haberlos perdido.
 * LA CAUSA: la lista de pendientes vive DENTRO del paso 1. Al elegir barbería ese paso
 * se esconde, y con él la lista. Los pedidos seguían guardados, pero no se veían.
 */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file:///home/claude/trabajo/index.html');
  await p.waitForTimeout(2800);
  let ok = 0, mal = 0;
  const T = (n, c, d) => { if (c) { ok++; console.log('  ✅ ' + n); } else { mal++; console.log('  ❌ ' + n + (d ? '  →  ' + d : '')); } };

  console.log('\n1️⃣  📋 LA BARRA SALE CON LOS PEDIDOS GUARDADOS');
  const r1 = await p.evaluate(async () => {
    ['pantalla-login', 'pantalla-bloqueo'].forEach(id => {
      const e = document.getElementById(id); if (e) e.style.display = 'none';
    });
    document.getElementById('app-contenido').style.display = 'block';
    localStorage.setItem('ncl', JSON.stringify([
      { id: 1, nombre: 'Jose', apellido: 'Rodriguez', negocio: 'JRJ BARBERSHOP' },
      { id: 2, nombre: 'Miguel', apellido: 'Santos', negocio: 'JRJ BARBERSHOP' },
      { id: 3, nombre: 'Francisco', apellido: 'Perez', negocio: 'BARBERIA F' }
    ]));
    // 🔑 Los 3 pedidos que Sensei creía perder
    localStorage.setItem('npedidos', JSON.stringify([
      { id: 1001, cid: 1, nombre: 'Jose Rodriguez', barberia: 'JRJ BARBERSHOP',
        items: [{ pid: 'p1', nombre: 'Gummy hair gel', cant: 3, precio: 10 }] },
      { id: 1002, cid: 2, nombre: 'Miguel Santos', barberia: 'JRJ BARBERSHOP',
        items: [{ pid: 'p2', nombre: 'Dorco navajas', cant: 2, precio: 10 }] },
      { id: 1003, cid: 3, nombre: 'Francisco Perez', barberia: 'BARBERIA F',
        items: [{ pid: 'p3', nombre: 'Andis Cool Care', cant: 4, precio: 10 }] }
    ]));
    clientes = LS('ncl', []); pedidos = LS('npedidos', []);
    ir('p-ped');
    await new Promise(r => setTimeout(r, 500));
    const barra = document.getElementById('barra-pedidos-guardados');
    return { existe: !!barra,
             visible: barra ? getComputedStyle(barra).display : 'no',
             titulo: (document.getElementById('bpg-titulo') || {}).textContent || '',
             quienes: (document.getElementById('bpg-quienes') || {}).textContent || '',
             monto: (document.getElementById('bpg-monto') || {}).textContent || '' };
  });
  T('📋 la barra existe', r1.existe);
  T('🔑 y se VE', r1.visible === 'block', r1.visible);
  T('dice cuántos hay', /3 PEDIDOS GUARDADOS/.test(r1.titulo), r1.titulo);
  T('👤 y quiénes son', /Jose/.test(r1.quienes) && /Miguel/.test(r1.quienes), r1.quienes);
  T('💵 con el monto', /\$90\.00/.test(r1.monto), r1.monto);

  console.log('\n2️⃣  🔑 EL CASO DE SENSEI: sigue visible al tomar otro pedido');
  const r2 = await p.evaluate(async () => {
    // Se esconde el paso 1, como pasa al elegir barbería
    const lista = document.getElementById('ped-lista-wrap');
    if (lista) lista.style.display = 'none';
    await new Promise(r => setTimeout(r, 200));
    const barra = document.getElementById('barra-pedidos-guardados');
    const wrap = document.getElementById('ped-pendientes-wrap');
    return { barraVisible: barra ? getComputedStyle(barra).display : 'no',
             // La lista vieja sí se esconde — ese era el problema
             listaEscondida: lista ? getComputedStyle(lista).display === 'none' : false,
             // Y los pedidos siguen guardados
             siguenGuardados: LS('npedidos', []).length };
  });
  T('🔴 la lista de antes SÍ se esconde (ese era el fallo)', r2.listaEscondida);
  T('🔑 pero LA BARRA SIGUE VISIBLE', r2.barraVisible === 'block', r2.barraVisible);
  T('🔒 y los 3 pedidos siguen guardados', r2.siguenGuardados === 3, String(r2.siguenGuardados));

  console.log('\n3️⃣  👆 AL TOCARLA, SE ABRE LA LISTA');
  const r3 = await p.evaluate(async () => {
    verLosGuardados();
    await new Promise(r => setTimeout(r, 400));
    const ov = document.getElementById('guardados-overlay');
    return { seAbre: ov ? getComputedStyle(ov).display !== 'none' : false,
             tienePedidos: ov ? /Jose|Miguel|Francisco/.test(ov.innerText) : false,
             // 🔑 Y NO le saca de donde estaba tomando el pedido
             noLeSaca: (document.getElementById('ped-lista-wrap') || {}).style.display === 'none' };
  });
  T('👆 se abre la ventana con la lista', r3.seAbre);
  T('🔑 y ahí están los 3 pedidos', r3.tienePedidos);
  T('🔒 sin sacarlo de lo que estaba haciendo', r3.noLeSaca);

  console.log('\n4️⃣  🔄 LA BARRA SE ACTUALIZA SOLA');
  const r4 = await p.evaluate(async () => {
    // Se quita uno, como al convertirlo en venta
    let peds = LS('npedidos', []);
    peds = peds.filter(x => String(x.id) !== '1001');
    SS('npedidos', peds);
    renderPedidosPendientes();
    await new Promise(r => setTimeout(r, 300));
    return { titulo: (document.getElementById('bpg-titulo') || {}).textContent || '',
             monto: (document.getElementById('bpg-monto') || {}).textContent || '' };
  });
  T('🔄 baja a 2 pedidos', /2 PEDIDOS/.test(r4.titulo), r4.titulo);
  T('y el monto cuadra', /\$60\.00/.test(r4.monto), r4.monto);

  console.log('\n5️⃣  🚫 SIN PEDIDOS, LA BARRA NO MOLESTA');
  const r5 = await p.evaluate(async () => {
    SS('npedidos', []);
    renderPedidosPendientes();
    await new Promise(r => setTimeout(r, 250));
    const barra = document.getElementById('barra-pedidos-guardados');
    return { visible: barra ? getComputedStyle(barra).display : 'no' };
  });
  T('🚫 se esconde si no hay pedidos', r5.visible === 'none', r5.visible);

  console.log(`\n  ${ok} bien · ${mal} mal`);
  const reales = errs.filter(e => !/firebase|onAuthStateChanged/i.test(e));
  if (reales.length) { console.log('⚠️ JS:'); reales.slice(0, 3).forEach(e => console.log('   ' + e)); }
  await b.close();
  process.exit(mal ? 1 : 0);
})();
