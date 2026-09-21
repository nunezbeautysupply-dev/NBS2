/**
 * 📥 EL BUZÓN DE PEDIDOS  (17 sep 2026)
 *
 * El barbero pide en el catálogo → el pedido cae en el buzón de Firebase → la app lo
 * recoge al abrirse y avisa con sonido.
 *
 * 🔴 CUIDADO HISTÓRICO: en septiembre el catálogo entró al MISMO Firebase que la app y
 * le pisó la sesión — Sensei perdió la huella. Aquí se comprueba que use una app APARTE.
 */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file:///home/claude/trabajo/index.html');
  await p.waitForTimeout(2800);
  let ok = 0, mal = 0;
  const T = (n, c, d) => { if (c) { ok++; console.log('  ✅ ' + n); } else { mal++; console.log('  ❌ ' + n + (d ? '  →  ' + d : '')); } };

  console.log('\n1️⃣  📥 LA APP SABE RECOGER DEL BUZÓN');
  const r1 = await p.evaluate(() => ({
    recoger: typeof recogerPedidosDelBuzon === 'function',
    avisar: typeof avisarPedidosNuevos === 'function',
    cerrar: typeof cerrarAvisoPedidos === 'function',
    hora: typeof horaCortita === 'function'
  }));
  T('📥 recogerPedidosDelBuzon existe', r1.recoger);
  T('🔔 avisarPedidosNuevos existe', r1.avisar);
  T('y se puede cerrar', r1.cerrar);
  T('🕐 la hora se ve bonita', r1.hora);

  console.log('\n2️⃣  🔒 SIN INTERNET, LA APP NO SE ROMPE');
  const r2 = await p.evaluate(async () => {
    ['pantalla-login', 'pantalla-bloqueo'].forEach(id => {
      const e = document.getElementById(id); if (e) e.style.display = 'none';
    });
    document.getElementById('app-contenido').style.display = 'block';
    window.fbDb = null;                 // como si Firebase no hubiera llegado
    let llamado = false, cuantos = -1;
    recogerPedidosDelBuzon(function (n) { llamado = true; cuantos = n; });
    await new Promise(r => setTimeout(r, 300));
    return { llamado, cuantos };
  });
  T('🔒 sin Firebase, contesta igual', r2.llamado);
  T('y dice que no trajo nada', r2.cuantos === 0, String(r2.cuantos));

  console.log('\n3️⃣  📥 CON PEDIDOS EN EL BUZÓN, LOS TRAE');
  const r3 = await p.evaluate(async () => {
    localStorage.setItem('npedidos', '[]');
    // 🔑 Se simula el buzón con dos pedidos del catálogo
    const delBuzon = [
      { id: 'buz1', data: () => ({ cid: '1', nombre: 'Jose Rodriguez',
          barberia: 'JRJ BARBERSHOP', cuando: Date.now(), delCatalogo: true, recogido: false,
          items: [{ pid: 'p1', nombre: 'Gummy gel', cant: 3, precio: 10 }] }),
        ref: { update: () => Promise.resolve() } },
      { id: 'buz2', data: () => ({ cid: '2', nombre: 'Miguel Santos',
          barberia: 'JRJ BARBERSHOP', cuando: Date.now(), delCatalogo: true, recogido: false,
          items: [{ pid: 'p2', nombre: 'Dorco navajas', cant: 2, precio: 10 }] }),
        ref: { update: () => Promise.resolve() } }
    ];
    window.fbDb = { collection: () => ({ where: () => ({ get: () => Promise.resolve({
      empty: false, forEach: (fn) => delBuzon.forEach(fn) }) }) }) };

    let cuantos = -1;
    recogerPedidosDelBuzon(function (n) { cuantos = n; });
    await new Promise(r => setTimeout(r, 500));
    const peds = LS('npedidos', []);
    return { cuantos, guardados: peds.length,
             nombres: peds.map(x => x.nombre),
             marcadosNuevos: peds.filter(x => x.nuevo).length,
             tienenBuzonId: peds.filter(x => x.buzonId).length,
             delCatalogo: peds.filter(x => x.delCatalogo).length };
  });
  T('📥 trae los 2 pedidos', r3.cuantos === 2, String(r3.cuantos));
  T('y los guarda en npedidos', r3.guardados === 2, String(r3.guardados));
  T('👤 con el nombre del barbero', /Jose/.test(String(r3.nombres)), String(r3.nombres));
  T('🔔 marcados como nuevos', r3.marcadosNuevos === 2, String(r3.marcadosNuevos));
  T('📋 y marcados "del catálogo"', r3.delCatalogo === 2, String(r3.delCatalogo));

  console.log('\n4️⃣  🔑 NO LOS TRAE DOS VECES');
  const r4 = await p.evaluate(async () => {
    let cuantos = -1;
    recogerPedidosDelBuzon(function (n) { cuantos = n; });
    await new Promise(r => setTimeout(r, 500));
    return { cuantos, total: LS('npedidos', []).length };
  });
  T('🔑 la segunda vez no trae nada', r4.cuantos === 0, String(r4.cuantos));
  T('y siguen siendo 2, no 4', r4.total === 2, String(r4.total));

  console.log('\n5️⃣  🔔 EL AVISO CON SONIDO');
  const r5 = await p.evaluate(async () => {
    avisarPedidosNuevos(2);
    await new Promise(r => setTimeout(r, 300));
    const ov = document.getElementById('aviso-pedidos-nuevos');
    const t = ov ? ov.innerText : '';
    return { sale: !!ov, texto: t,
             botonVer: ov ? !!ov.querySelector('[onclick*="verLosGuardados"]') : false };
  });
  T('🔔 sale la ventana', r5.sale);
  T('dice cuántos son', /2 PEDIDOS NUEVOS/.test(r5.texto), r5.texto.split('\n')[1] || '');
  T('con el total', /\$50\.00/.test(r5.texto));
  T('📋 y el botón de verlos', r5.botonVer);

  console.log('\n6️⃣  🔴 EL CATÁLOGO USA UNA APP DE FIREBASE APARTE');
  const cat = fs.readFileSync('/home/claude/catalogo2/catalogo.html', 'utf8');
  T('🔒 usa el nombre "buzon", no el principal', /initializeApp\([^)]*,\s*'buzon'\)/s.test(cat));
  // El login del admin de descuentos SÍ usa auth, pero SOLO por la app aparte 'admin'
  // (nunca la principal), así no toca la sesión de Sensei ni su huella. -20 sep-
  T('🔒 si usa auth, es por la app aparte "admin"', !/firebase\.auth\(/.test(cat) || /initializeApp\([^;]*,\s*'admin'\)/s.test(cat));
  T('🔴 NUNCA abre la app principal de Firebase (todas llevan nombre aparte)',
    (cat.match(/firebase\.initializeApp\(/g)||[]).length === (cat.match(/firebase\.initializeApp\([^;]*,\s*'[a-z]+'\)/gs)||[]).length);
  T('📤 manda el pedido al buzón', /nbs_buzon_pedidos/.test(cat));
  T('🛟 y si falla, WhatsApp sigue funcionando', /wa\.me/.test(cat));

  console.log(`\n  ${ok} bien · ${mal} mal`);
  const reales = errs.filter(e => !/firebase|onAuthStateChanged/i.test(e));
  if (reales.length) { console.log('⚠️ JS:'); reales.slice(0, 3).forEach(e => console.log('   ' + e)); }
  await b.close();
  process.exit(mal ? 1 : 0);
})();
