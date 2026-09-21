/**
 * 🔴 EL PEDIDO EQUIVOCADO  (17 sep 2026)
 *
 * Sensei, en plena ruta: "terminé un pedido de uno de los barberos y le di a guardar,
 * hice dos pedidos más, y cuando me vine a dar cuenta el pedido que había guardado se
 * fue al carrito pero el cliente apareció de nuevo en el listado sin nada en su
 * pedido... eso es un error grave".
 *
 * LA CAUSA: los botones usaban la POSICIÓN del pedido en la lista, no su id. Al
 * guardar pedidos nuevos las posiciones se mueven, y el botón abría OTRO pedido.
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

  await p.evaluate(() => {
    ['pantalla-login', 'pantalla-bloqueo'].forEach(id => {
      const e = document.getElementById(id); if (e) e.style.display = 'none';
    });
    document.getElementById('app-contenido').style.display = 'block';
    localStorage.setItem('ncl', JSON.stringify([
      { id: 1, nombre: 'Jose', apellido: 'Rodriguez', negocio: 'JRJ BARBERSHOP' },
      { id: 2, nombre: 'Miguel', apellido: 'Santos', negocio: 'JRJ BARBERSHOP' },
      { id: 3, nombre: 'Pedro', apellido: 'Gomez', negocio: 'JRJ BARBERSHOP' }
    ]));
    clientes = LS('ncl', []);
  });

  console.log('\n1️⃣  🔑 LAS PUERTAS SEGURAS EXISTEN');
  const r1 = await p.evaluate(() => ({
    pos: typeof _posDelPedido === 'function',
    carrito: typeof alCarritoPorId === 'function',
    editar: typeof editarPedidoPorId === 'function',
    borrar: typeof borrarPedidoPorId === 'function'
  }));
  T('🔑 buscar por id', r1.pos);
  T('🛒 al carrito por id', r1.carrito);
  T('✏️ cambiar por id', r1.editar);
  T('🗑️ borrar por id', r1.borrar);

  console.log('\n2️⃣  🔴 EL CASO EXACTO DE SENSEI');
  const r2 = await p.evaluate(async () => {
    // Guarda el pedido de Jose (queda en posición 0)
    localStorage.setItem('npedidos', JSON.stringify([
      { id: 1001, cid: 1, nombre: 'Jose Rodriguez', barberia: 'JRJ BARBERSHOP',
        items: [{ pid: 'p1', nombre: 'Gummy gel', cant: 3, precio: 10 }] }
    ]));
    // Y luego hace DOS pedidos más, que se ponen DELANTE
    const peds = LS('npedidos', []);
    peds.unshift(
      { id: 1002, cid: 2, nombre: 'Miguel Santos', barberia: 'JRJ BARBERSHOP',
        items: [{ pid: 'p2', nombre: 'Dorco', cant: 2, precio: 10 }] },
      { id: 1003, cid: 3, nombre: 'Pedro Gomez', barberia: 'JRJ BARBERSHOP',
        items: [{ pid: 'p3', nombre: 'Andis', cant: 5, precio: 10 }] }
    );
    SS('npedidos', peds);
    pedidos = LS('npedidos', []);

    // 🔑 Jose ahora está en la POSICIÓN 2, no en la 0
    const dondeEsta = pedidos.findIndex(x => String(x.id) === '1001');

    // Se toca "🛒 Al carrito" en el pedido de JOSE, por su id
    alCarritoPorId('1001');
    await new Promise(r => setTimeout(r, 600));

    return { dondeEsta,
             enElCarrito: (typeof iV !== 'undefined' ? iV.map(x => x.nombre) : []),
             // ¿De quién es la venta que se abrió?
             deQuien: window._vendiendoDesde ? window._vendiendoDesde.pedidoId : null };
  });
  T('🔑 Jose se movió a la posición 2', r2.dondeEsta === 2, String(r2.dondeEsta));
  T('🛒 y el carrito tiene SU producto', /Gummy/.test(String(r2.enElCarrito)),
     JSON.stringify(r2.enElCarrito));
  T('🔴 NO el de otro barbero', !/Dorco|Andis/.test(String(r2.enElCarrito)));
  T('y apunta al pedido correcto', String(r2.deQuien) === '1001', String(r2.deQuien));

  console.log('\n3️⃣  🗑️ BORRAR TAMBIÉN VA AL CORRECTO');
  const r3 = await p.evaluate(async () => {
    localStorage.setItem('npedidos', JSON.stringify([
      { id: 2001, cid: 1, nombre: 'Jose', items: [{ pid: 'a', nombre: 'A', cant: 1, precio: 10 }] },
      { id: 2002, cid: 2, nombre: 'Miguel', items: [{ pid: 'b', nombre: 'B', cant: 1, precio: 10 }] },
      { id: 2003, cid: 3, nombre: 'Pedro', items: [{ pid: 'c', nombre: 'C', cant: 1, precio: 10 }] }
    ]));
    pedidos = LS('npedidos', []);
    window.confirm = () => true;
    borrarPedidoPorId('2002');          // el del MEDIO
    await new Promise(r => setTimeout(r, 400));
    const quedan = LS('npedidos', []);
    return { cuantos: quedan.length, nombres: quedan.map(x => x.nombre) };
  });
  T('🗑️ borra el del medio', r3.cuantos === 2, String(r3.cuantos));
  T('🔑 y quedan los OTROS dos', !/Miguel/.test(String(r3.nombres)) && /Jose/.test(String(r3.nombres)),
     JSON.stringify(r3.nombres));

  console.log('\n4️⃣  🛟 SI EL PEDIDO YA NO ESTÁ, AVISA');
  const r4 = await p.evaluate(async () => {
    let aviso = '';
    const viejo = window.avisoGrande;
    window.avisoGrande = function (t) { aviso = t; };
    alCarritoPorId('99999');            // uno que no existe
    await new Promise(r => setTimeout(r, 300));
    window.avisoGrande = viejo;
    return { aviso };
  });
  T('🛟 avisa en vez de romperse', /ya no est/i.test(r4.aviso), r4.aviso);

  console.log(`\n  ${ok} bien · ${mal} mal`);
  const reales = errs.filter(e => !/firebase|onAuthStateChanged/i.test(e));
  if (reales.length) { console.log('⚠️ JS:'); reales.slice(0, 3).forEach(e => console.log('   ' + e)); }
  await b.close();
  process.exit(mal ? 1 : 0);
})();
