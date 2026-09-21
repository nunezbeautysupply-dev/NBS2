/**
 * ✕ SALIR DE ESTE PEDIDO — el menú de las 3 opciones  (18 sep 2026)
 *
 * Historia: un toque de Sensei cayó en "🗑️ Ya no lo quiere" queriendo dar
 * "Registrar venta" y un pedido de $70 casi se pierde. Ahora hay UN botón
 * separado que abre un menú. Aquí se prueba que las 3 salidas hagan
 * EXACTAMENTE lo que dicen, y que ningún camino toque el dinero.
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

  const armar = async () => await p.evaluate(async () => {
    ['pantalla-login', 'pantalla-bloqueo'].forEach(id => {
      const e = document.getElementById(id); if (e) e.style.display = 'none';
    });
    document.getElementById('app-contenido').style.display = 'block';
    localStorage.setItem('ncl', JSON.stringify([{ id: 1, nombre: 'Raul', apellido: 'Madera', apodo: 'RAUL', negocio: 'La 42' }]));
    localStorage.setItem('nv', '[]');
    localStorage.setItem('npedidos', JSON.stringify([{ id: 7001, cid: 1, nombre: 'Raul Madera "RAUL"', fecha: '09/18/2026',
      items: [{ pid: 'p1', nombre: 'Cera azul', cant: 3, precio: 23.33, costo: 15 }], total: 70 }]));
    localStorage.setItem('np', JSON.stringify([{ id: 'p1', nombre: 'Cera azul', marca: 'B', costo: 15, precio: 23.33, stock: 9, min: 2 }]));
    clientes = LS('ncl', []); ventas = LS('nv', []); pedidos = LS('npedidos', []); loadProds();
    cerrarSalirDelPedido();
    convertirPedidoAVenta(0);
    await new Promise(r => setTimeout(r, 400));
  });

  console.log('\n1️⃣  🧷 EL BOTÓN NUEVO Y LA DISTANCIA DE SEGURIDAD');
  await armar();
  const r1 = await p.evaluate(() => {
    const acc = document.getElementById('pedido-conv-acciones');
    const btn = acc ? acc.querySelector('button') : null;
    const verde = [...document.querySelectorAll('#p-v button')].find(x => /Registrar venta/.test(x.textContent));
    let hueco = -1;
    if (btn && verde) hueco = Math.round(acc.getBoundingClientRect().top - verde.getBoundingClientRect().bottom);
    return {
      hay: !!btn, texto: btn ? btn.textContent.trim() : '',
      seVe: acc ? getComputedStyle(acc).display !== 'none' : false,
      hueco,
      yaNoHayEnlaces: !document.querySelector('#pedido-conv-acciones span[onclick]')
    };
  });
  T('🧷 hay UN solo botón y dice "Salir de este pedido"', r1.hay && /Salir de este pedido/.test(r1.texto), r1.texto);
  T('se ve al convertir un pedido', r1.seVe);
  T('📏 con distancia del botón verde (>= 20 px)', r1.hueco >= 20, r1.hueco + ' px');
  T('los dos enlaces viejos YA NO están', r1.yaNoHayEnlaces);

  console.log('\n2️⃣  📋 EL MENÚ: LAS 3 OPCIONES, CON EL NOMBRE DEL CLIENTE');
  const r2 = await p.evaluate(() => {
    salirDelPedidoConversion();
    const ov = document.getElementById('pedido-salir-menu');
    const botones = ov ? [...ov.querySelectorAll('button')].map(x => x.textContent.trim()) : [];
    return { abre: !!ov, botones, nombre: ov ? /Raul Madera/.test(ov.textContent) : false };
  });
  T('📋 el menú abre', r2.abre);
  T('con el nombre del cliente en la pregunta', r2.nombre);
  T('opción azul: Se queda guardado, salir', /Se queda guardado/.test(r2.botones[0] || ''), r2.botones[0]);
  T('opción roja: Ya no lo quiere — borrar', /Ya no lo quiere/.test(r2.botones[1] || ''), r2.botones[1]);
  T('opción gris: Seguir con la venta', /Seguir con la venta/.test(r2.botones[2] || ''), r2.botones[2]);

  console.log('\n3️⃣  ▶️ "SEGUIR CON LA VENTA": CIERRA Y NO TOCA NADA');
  const r3 = await p.evaluate(() => {
    const antesIV = iV.length, antesPeds = LS('npedidos', []).length;
    [...document.getElementById('pedido-salir-menu').querySelectorAll('button')][2].click();
    return { cerro: !document.getElementById('pedido-salir-menu'),
             carritoIgual: iV.length === antesIV, pedidosIgual: LS('npedidos', []).length === antesPeds,
             sigueConvirtiendo: !!(window._vendiendoDesde && window._vendiendoDesde.tipo === 'pedido') };
  });
  T('▶️ el menú se cierra', r3.cerro);
  T('el carrito sigue con sus productos', r3.carritoIgual);
  T('el pedido sigue en la lista', r3.pedidosIgual);
  T('y la conversión sigue viva', r3.sigueConvirtiendo);

  console.log('\n4️⃣  ↩️ "SE QUEDA GUARDADO, SALIR": SALE SIN PREGUNTAR Y SIN BORRAR');
  const r4 = await p.evaluate(async () => {
    let pregunto = false;
    const confirmViejo = window.confirm;
    window.confirm = function(){ pregunto = true; return true; };
    salirDelPedidoConversion();
    [...document.getElementById('pedido-salir-menu').querySelectorAll('button')][0].click();
    await new Promise(r => setTimeout(r, 300));
    window.confirm = confirmViejo;
    const peds = LS('npedidos', []);
    return { pregunto, cerro: !document.getElementById('pedido-salir-menu'),
             pedidoVivo: peds.length === 1 && String(peds[0].id) === '7001',
             carritoVacio: iV.length === 0, conversionApagada: !window._vendiendoDesde,
             enPedidos: document.getElementById('p-ped').style.display === 'block' };
  });
  T('↩️ NO pregunta otra vez (la elección ya fue explícita)', !r4.pregunto);
  T('el pedido de Raul SIGUE guardado tal cual', r4.pedidoVivo);
  T('el carrito queda vacío y la conversión apagada', r4.carritoVacio && r4.conversionApagada);
  T('y te lleva a Pedidos Pendientes', r4.enPedidos);

  console.log('\n5️⃣  🗑️ "YA NO LO QUIERE": PREGUNTA, Y SI DICES QUE NO, NO BORRA');
  await armar();
  const r5 = await p.evaluate(async () => {
    const confirmViejo = window.confirm;
    let loQuePregunto = '';
    window.confirm = function(t){ loQuePregunto = t; return false; };   // ¡NO!
    salirDelPedidoConversion();
    [...document.getElementById('pedido-salir-menu').querySelectorAll('button')][1].click();
    await new Promise(r => setTimeout(r, 200));
    window.confirm = confirmViejo;
    return { pregunto: /Borrar el pedido/.test(loQuePregunto), dijoMonto: /\$69\.99/.test(loQuePregunto),   // 3 x 23.33 — lo recalcula de los items
             pedidoVivo: LS('npedidos', []).length === 1 };
  });
  T('🗑️ pregunta "¿Borrar el pedido...?" con el monto real', r5.pregunto && r5.dijoMonto);
  T('🔒 dijiste que NO → el pedido SIGUE ahí', r5.pedidoVivo);

  console.log('\n6️⃣  🗑️ Y SI DICES QUE SÍ: BORRA ESE Y SOLO ESE');
  const r6 = await p.evaluate(async () => {
    const confirmViejo = window.confirm;
    window.confirm = function(){ return true; };                        // ¡SÍ!
    salirDelPedidoConversion();
    [...document.getElementById('pedido-salir-menu').querySelectorAll('button')][1].click();
    await new Promise(r => setTimeout(r, 300));
    window.confirm = confirmViejo;
    return { pedidoBorrado: LS('npedidos', []).length === 0,
             ventasIntactas: LS('nv', []).length === 0,
             carritoVacio: iV.length === 0, conversionApagada: !window._vendiendoDesde };
  });
  T('🗑️ dijiste que SÍ → el pedido se borra', r6.pedidoBorrado);
  T('💰 y NO se inventó ninguna venta', r6.ventasIntactas);
  T('carrito vacío y conversión apagada', r6.carritoVacio && r6.conversionApagada);

  console.log('\n7️⃣  ✅ EL CAMINO FELIZ SIGUE IGUAL: REGISTRAR LA VENTA NO PREGUNTA NADA');
  await armar();
  const r7 = await p.evaluate(async () => {
    let pregunto = false;
    const confirmViejo = window.confirm;
    window.confirm = function(t){ if(/Borrar el pedido/.test(t)){ pregunto = true; } return true; };
    cobroRapidoContadoEfectivo();   // el boton real de un toque: efectivo por el total
    await new Promise(r => setTimeout(r, 300));
    // Sale la pregunta de la firma, como en la vida real: 'No es necesario, guardar'
    var ovF = document.getElementById('firma-pregunta-overlay');
    var sinFirma = ovF ? [...ovF.querySelectorAll('button')].find(x => /No es necesario/i.test(x.textContent)) : null;
    if(sinFirma) sinFirma.click();
    await new Promise(r => setTimeout(r, 600));
    window.confirm = confirmViejo;
    const vts = LS('nv', []);
    return { pregunto, ventaGuardada: vts.length === 1, total: vts[0] ? vts[0].total : 0,
             pedidoSeFue: LS('npedidos', []).length === 0 };
  });
  T('✅ registrar la venta NO enseña el letrero de borrar', !r7.pregunto);
  T('la venta queda guardada ($69.99 de 3 x 23.33)', r7.ventaGuardada && Math.abs(r7.total - 69.99) < 0.02, String(r7.total));
  T('y el pedido sale de Pendientes él solito', r7.pedidoSeFue);

  console.log('\n8️⃣  🔙 EL BOTÓN ATRÁS CIERRA EL MENÚ COMO A TODOS');
  const r8 = await p.evaluate(() => {
    salirDelPedidoConversion();
    const registrado = RECUADROS_ENCIMA.some(function(r){ return r.id === 'pedido-salir-menu' && r.cerrar === 'cerrarSalirDelPedido'; });
    cerrarSalirDelPedido();
    return { registrado, cerro: !document.getElementById('pedido-salir-menu') };
  });
  T('🔙 está registrado en la escalera del atrás', r8.registrado);
  T('y cerrarSalirDelPedido lo cierra', r8.cerro);

  const erroresReales = errs.filter(e => !/favicon|net::|icon-/.test(e));
  T('🧯 sin errores de página en toda la corrida', erroresReales.length === 0, erroresReales.join(' | ').slice(0, 120));

  console.log('\n  ' + ok + ' bien · ' + mal + ' mal');
  await b.close();
  process.exit(mal ? 1 : 0);
})();
