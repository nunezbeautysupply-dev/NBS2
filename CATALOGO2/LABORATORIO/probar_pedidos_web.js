/**
 * 🌉 EL PUENTE DE LOS PEDIDOS DEL CATÁLOGO  (8 sep 2026)
 *
 * Sensei: "en la app también debes poner una alerta cada vez que entra un pedido, y que
 * me salga una ventana para yo tocarla y entrar a ese pedido de una vez, pero con la
 * opción de dejarlo pendiente también por si en ese momento no puedo sacarlo".
 */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 1000 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file:///home/claude/trabajo/index.html');
  await p.waitForTimeout(2600);
  let ok = 0, mal = 0;
  const T = (n, c, d) => { if (c) { ok++; console.log('  ✅ ' + n); } else { mal++; console.log('  ❌ ' + n + (d ? '  →  ' + d : '')); } };

  const PED = {
    id: 'PED_TEST_1', cid: 6, cliente: 'Jose Rodriguez', negocio: 'JRJ BARBERSHOP',
    fecha: '09/08/2026', hora: '12:10 AM', total: 145,
    items: [{ pid: 'p1', nombre: 'Gummy gel verde', cant: 2, precio: 10 },
            { pid: 'p2', nombre: 'Dorco prime azul', cant: 3, precio: 10 },
            { pid: 'p3', nombre: 'Immortal colonia', cant: 1, precio: 10 }]
  };

  const montar = () => p.evaluate((ped) => {
    ['pantalla-login', 'pantalla-bloqueo'].forEach(id => {
      const e = document.getElementById(id); if (e) e.style.display = 'none';
    });
    document.getElementById('app-contenido').style.display = 'block';
    localStorage.setItem('ncl', JSON.stringify([
      { id: 6, nombre: 'Jose', apellido: 'Rodriguez', negocio: 'JRJ BARBERSHOP' }]));
    localStorage.setItem('npedidos', '[]');
    localStorage.removeItem('nbs_pedidos_web_vistos');
    clientes = LS('ncl', []);
    _pedidosWebNuevos = [ped];
    window._pedidoWebActual = null;
  }, PED);

  console.log('\n1️⃣  🔔 LA VENTANA DEL PEDIDO NUEVO');
  await montar();
  const r1 = await p.evaluate(async (ped) => {
    mostrarAvisoPedidoNuevo(ped, 1);
    await new Promise(r => setTimeout(r, 350));
    const ov = document.getElementById('pedido-nuevo-overlay');
    const t = ov ? ov.innerText : '';
    return { abrio: !!ov && ov.style.display === 'flex',
             alto: ov ? Math.round(ov.getBoundingClientRect().height) : 0,
             diceNuevo: /PEDIDO NUEVO/.test(t),
             diceCliente: /Jose Rodriguez/.test(t),
             diceNegocio: /JRJ BARBERSHOP/.test(t),
             diceTotal: /\$145\.00/.test(t),
             diceProductos: /3 PRODUCTO/.test(t),
             hayPreparar: /prepararPedidoWeb/.test(ov ? ov.innerHTML : ''),
             hayPendiente: /dejarPedidoPendiente/.test(ov ? ov.innerHTML : '') };
  }, PED);
  T('🔔 la ventana abre y se ve', r1.abrio && r1.alto > 200, r1.alto + ' px');
  T('dice PEDIDO NUEVO', r1.diceNuevo);
  T('con el cliente y su barbería', r1.diceCliente && r1.diceNegocio);
  T('cuántos productos y el total', r1.diceProductos && r1.diceTotal);
  T('🔑 botón "Prepararlo ahora"', r1.hayPreparar);
  T('🔑 botón "Dejarlo pendiente"', r1.hayPendiente);

  console.log('\n2️⃣  📦 PREPARARLO AHORA LO METE EN LA LISTA');
  await montar();
  const r2 = await p.evaluate(async (ped) => {
    mostrarAvisoPedidoNuevo(ped, 1);
    await new Promise(r => setTimeout(r, 250));
    const oav = window.avisoGrande; window.avisoGrande = () => {};
    prepararPedidoWeb();
    await new Promise(r => setTimeout(r, 400));
    window.avisoGrande = oav;
    const P = LS('npedidos', []);
    const v = JSON.parse(localStorage.getItem('nbs_pedidos_web_vistos') || '{}');
    return { cuantos: P.length,
             cliente: P[0] ? P[0].cn : null,
             items: P[0] ? P[0].items.length : 0,
             total: P[0] ? P[0].total : 0,
             deWeb: P[0] ? !!P[0].deWeb : false,
             marcado: v[ped.id],
             cerro: document.getElementById('pedido-nuevo-overlay').style.display === 'none' };
  }, PED);
  T('📦 el pedido entra en la lista', r2.cuantos === 1, String(r2.cuantos));
  T('con su cliente', r2.cliente === 'Jose Rodriguez', String(r2.cliente));
  T('sus 3 productos y su total', r2.items === 3 && r2.total === 145,
     r2.items + ' items · $' + r2.total);
  T('marcado como que vino del catálogo', r2.deWeb);
  T('🔒 y NO vuelve a saltar', r2.marcado === 'hecho', String(r2.marcado));
  T('la ventana se cierra', r2.cerro);

  console.log('\n3️⃣  ⏳ DEJARLO PENDIENTE NO LO PIERDE');
  await montar();
  const r3 = await p.evaluate(async (ped) => {
    mostrarAvisoPedidoNuevo(ped, 1);
    await new Promise(r => setTimeout(r, 250));
    const oav = window.avisoGrande; window.avisoGrande = () => {};
    dejarPedidoPendiente();
    await new Promise(r => setTimeout(r, 350));
    window.avisoGrande = oav;
    const v = JSON.parse(localStorage.getItem('nbs_pedidos_web_vistos') || '{}');
    return { marcado: v[ped.id],
             enLaLista: LS('npedidos', []).length,
             sigueEnEspera: _pedidosWebNuevos.length,
             cerro: document.getElementById('pedido-nuevo-overlay').style.display === 'none' };
  }, PED);
  T('⏳ queda marcado como pendiente', r3.marcado === 'pendiente', String(r3.marcado));
  T('🔒 NO se mete en la lista todavía', r3.enLaLista === 0, String(r3.enLaLista));
  T('🔑 pero NO se pierde: sigue esperando', r3.sigueEnEspera === 1, String(r3.sigueEnEspera));
  T('y la ventana se cierra', r3.cerro);

  console.log('\n4️⃣  📋 LA LISTA DE PEDIDOS DEL CATÁLOGO');
  await montar();
  const r4 = await p.evaluate(async () => {
    // Sin nube, la lista se pinta con lo que ya tiene en memoria
    const guardado = _pedidosWebNuevos.slice();
    verPedidosDelCatalogo();
    await new Promise(r => setTimeout(r, 500));
    _pedidosWebNuevos = guardado;
    const ov = document.getElementById('pedidos-web-overlay');
    return { existe: !!ov, cierra: typeof cerrarPedidosWeb === 'function' };
  });
  T('📋 la lista existe', r4.existe);
  T('y se puede cerrar', r4.cierra);

  console.log('\n5️⃣  🔙 LOS DOS RECUADROS ESTÁN REGISTRADOS');
  const r5 = await p.evaluate(() => ({
    aviso: RECUADROS_ENCIMA.some(x => x.id === 'pedido-nuevo-overlay'),
    lista: RECUADROS_ENCIMA.some(x => x.id === 'pedidos-web-overlay'),
    f1: typeof cerrarAvisoPedidoNuevo === 'function',
    f2: typeof cerrarPedidosWeb === 'function'
  }));
  T('🔙 el aviso está registrado', r5.aviso);
  T('🔙 la lista también', r5.lista);
  T('y sus funciones de cerrar existen', r5.f1 && r5.f2);

  console.log('\n6️⃣  🔒 SIN NUBE NO REVIENTA');
  const r6 = await p.evaluate(async () => {
    let reventó = null;
    try { revisarPedidosDelCatalogo(function () {}); } catch (e) { reventó = e.message; }
    await new Promise(r => setTimeout(r, 300));
    return { reventó };
  });
  T('🔒 sin sesión de nube no revienta', !r6.reventó, r6.reventó);

  console.log(`\n  ${ok} bien · ${mal} mal`);
  const reales = errs.filter(e => !/firebase|onAuthStateChanged/i.test(e));
  if (reales.length) { console.log('⚠️ JS:'); reales.slice(0, 4).forEach(e => console.log('   ' + e)); }
  await b.close();
  process.exit(mal ? 1 : 0);
})();
