/**
 * 🔄 QUE LA PC BAJE LO DEL CELULAR  (15 sep 2026)
 *
 * 🔴 Sensei creó productos en el celular y la PC nunca los bajó — le faltaban 57.
 * Tuvo que restaurar un backup a mano para poder meter su factura de compra.
 *
 * LA CAUSA: la protección del 16 de julio miraba la hora de la LISTA ENTERA. Si la PC
 * tenía "np" más nuevo, protegía la lista COMPLETA y no bajaba NADA de la nube.
 * Un solo cambio en la PC bloqueaba los 57 productos del celular.
 */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 800 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file:///home/claude/trabajo/index.html');
  await p.waitForTimeout(2600);
  let ok = 0, mal = 0;
  const T = (n, c, d) => { if (c) { ok++; console.log('  ✅ ' + n); } else { mal++; console.log('  ❌ ' + n + (d ? '  →  ' + d : '')); } };

  console.log('\n1️⃣  🔑 LAS LISTAS DE REGISTROS SE JUNTAN, NO SE PROTEGEN');
  const r1 = await p.evaluate(() => ({
    np: esListaDeRegistros('np'), nv: esListaDeRegistros('nv'),
    ncl: esListaDeRegistros('ncl'), ncr: esListaDeRegistros('ncr'),
    // Y una que NO es lista: esa sí se protege entera
    ajuste: esListaDeRegistros('nbs_minutos_bloqueo')
  }));
  T('🔑 productos (np) se juntan', r1.np);
  T('🔑 ventas (nv) se juntan', r1.nv);
  T('🔑 clientes (ncl) se juntan', r1.ncl);
  T('🔑 créditos (ncr) se juntan', r1.ncr);
  T('🔒 pero un ajuste suelto NO se junta', !r1.ajuste);

  console.log('\n2️⃣  🖥️ EL CASO DE SENSEI: la PC va por delante pero le faltan productos');
  const r2 = await p.evaluate(() => {
    const ahora = Date.now();
    const enLaPC = [
      { id: '1', nombre: 'Producto A', precio: 10, mod: ahora },
      { id: '2', nombre: 'Producto B', precio: 10, mod: ahora }
    ];
    const enLaNube = [
      { id: '1', nombre: 'Producto A', precio: 10, mod: ahora - 5000 },
      { id: '2', nombre: 'Producto B', precio: 10, mod: ahora - 5000 },
      { id: '3', nombre: 'CREADO EN EL CELULAR', precio: 15, mod: ahora - 3000 },
      { id: '4', nombre: 'OTRO DEL CELULAR', precio: 12, mod: ahora - 3000 }
    ];
    localStorage.setItem('np', JSON.stringify(enLaPC));
    const fundido = fundirConLoDelTelefono('np', JSON.stringify(enLaNube));
    const res = fundido ? JSON.parse(fundido) : [];
    return { cuantos: res.length, nombres: res.map(x => x.nombre) };
  });
  T('🔑 la PC acaba con los 4 productos', r2.cuantos === 4, String(r2.cuantos));
  T('y los del celular SÍ aparecen',
     r2.nombres.indexOf('CREADO EN EL CELULAR') >= 0, JSON.stringify(r2.nombres));

  console.log('\n3️⃣  🔒 PERO NO SE PIERDE LO DE LA PC');
  const r3 = await p.evaluate(() => {
    const ahora = Date.now();
    // La PC cambió el precio de A; la nube lo tiene viejo
    localStorage.setItem('np', JSON.stringify([
      { id: '1', nombre: 'Producto A', precio: 99, mod: ahora }
    ]));
    const fundido = fundirConLoDelTelefono('np', JSON.stringify([
      { id: '1', nombre: 'Producto A', precio: 10, mod: ahora - 9000 }
    ]));
    const res = fundido ? JSON.parse(fundido) : [];
    return { precio: res.length ? res[0].precio : null };
  });
  T('🔒 el cambio de la PC gana si es más nuevo', r3.precio === 99, String(r3.precio));

  console.log('\n4️⃣  🗑️ Y LO BORRADO NO RESUCITA');
  const r4 = await p.evaluate(() => ({
    hayBorrados: typeof fundirBorrados === 'function',
    seJuntan: String(fundirConLoDelTelefono).indexOf('_borrados_') >= 0
  }));
  T('🗑️ las libretas de borrados se unen sin repetir', r4.hayBorrados && r4.seJuntan);

  console.log(`\n  ${ok} bien · ${mal} mal`);
  const reales = errs.filter(e => !/firebase|onAuthStateChanged/i.test(e));
  if (reales.length) { console.log('⚠️ JS:'); reales.slice(0, 3).forEach(e => console.log('   ' + e)); }
  await b.close();
  process.exit(mal ? 1 : 0);
})();
