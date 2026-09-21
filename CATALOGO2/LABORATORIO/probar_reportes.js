/**
 * 📊 LOS 7 REPORTES  (8 sep 2026)
 * Sensei pidió el de producto por fechas; los otros salieron de un análisis de sus datos.
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

  const montar = () => p.evaluate(() => {
    ['pantalla-login', 'pantalla-bloqueo'].forEach(id => {
      const e = document.getElementById(id); if (e) e.style.display = 'none';
    });
    document.getElementById('app-contenido').style.display = 'block';
    // 🔑 loadProds() JUNTA el catálogo de fábrica del HTML con lo guardado en 'np'.
    // Para probar con datos limpios hay que vaciar el de fábrica primero.
    const pd = document.getElementById('pd');
    if (pd) pd.value = '[]';
    PRODS = [];
    // Se limpia lo que dejó la prueba anterior, o el buscador arranca con texto viejo
    window._repProdBusca = '';
    window._repProdElegido = null;
    localStorage.setItem('ncl', JSON.stringify([
      { id: 1, nombre: 'Barbero', apellido: 'Uno', negocio: 'B1' },
      { id: 2, nombre: 'Barbero', apellido: 'Dos', negocio: 'B2' }]));
    localStorage.setItem('np', JSON.stringify([
      { id: 'p1', nombre: 'Gel verde', marca: 'Gummy', precio: 10, costo: 6, stock: 20, min: 5 },
      { id: 'p2', nombre: 'Navaja azul', marca: 'Dorco', precio: 10, costo: 6, stock: 100, min: 5 },
      // Este NO se vende: es el "dinero dormido"
      { id: 'p3', nombre: 'Producto parado', marca: 'X', precio: 10, costo: 5, stock: 40, min: 5 }]));
    localStorage.setItem('nv', JSON.stringify([
      // Sábado 08/08/2026
      { id: 1, cid: 1, cn: 'Barbero Uno', tipo: 'contado', fecha: '08/08/2026', numFactura: '1',
        total: 100, ganancia: 40, items: [{ pid: 'p1', nombre: 'Gel verde', cant: 10, precio: 10, costo: 6 }],
        pagosFactura: [{ pid: 'a', monto: 100, fecha: '08/08/2026' }] },
      // Viernes 08/14/2026
      { id: 2, cid: 2, cn: 'Barbero Dos', tipo: 'credito', fecha: '08/14/2026', numFactura: '2',
        total: 50, ganancia: 20, items: [{ pid: 'p2', nombre: 'Navaja azul', cant: 5, precio: 10, costo: 6 }],
        pagosFactura: [] },
      // Julio, para comparar meses
      { id: 3, cid: 1, cn: 'Barbero Uno', tipo: 'contado', fecha: '07/10/2026', numFactura: '3',
        total: 30, ganancia: 12, items: [{ pid: 'p1', nombre: 'Gel verde', cant: 3, precio: 10, costo: 6 }],
        pagosFactura: [{ pid: 'b', monto: 30, fecha: '07/10/2026' }] }]));
    localStorage.setItem('ngastos', JSON.stringify([
      { id: 1, concepto: 'Gasolina', monto: 40, fecha: '08/10/2026', categoria: 'transporte' }]));
    clientes = LS('ncl', []); ventas = LS('nv', []); loadProds();
    _rangoRep = { desde: '2026-08-01', hasta: '2026-08-31' };
  });

  const txt = () => p.evaluate(() => {
    const ov = document.getElementById('reporte-overlay');
    return ov && ov.style.display === 'flex' ? (ov.innerText || '') : '';
  });

  console.log('\n1️⃣  📊 CUÁNTO VENDÍ DE UN PRODUCTO');
  await montar();
  const r1 = await p.evaluate(async () => {
    abrirRepProducto();
    await new Promise(r => setTimeout(r, 250));
    window._repProdBusca = 'gel';
    pintarRepProducto();
    await new Promise(r => setTimeout(r, 200));
    const hallados = document.querySelectorAll('#reporte-overlay [onclick*="elegirProdRep"]').length;
    elegirProdRep('p1');
    await new Promise(r => setTimeout(r, 250));
    const t = document.getElementById('reporte-overlay').innerText;
    cerrarReporte();
    return { hallados, t };
  });
  T('🔍 el buscador encuentra el producto', r1.hallados >= 1, String(r1.hallados));
  T('🔑 dice cuántas unidades: 10', /10 u\./.test(r1.t), r1.t.slice(0, 120).replace(/\n/g, ' | '));
  T('🔑 y cuánto cobraste: $100.00', /\$100\.00/.test(r1.t));
  T('🔑 y lo que te dejó: $40.00', /\$40\.00/.test(r1.t));
  T('🔑 y quién lo compró', /Barbero Uno/.test(r1.t));
  T('🔒 solo cuenta agosto, no julio (serían 13)', !/13 u\./.test(r1.t));

  console.log('\n2️⃣  💀 DINERO DORMIDO');
  await montar();
  const r2 = await p.evaluate(async () => {
    window._repDiasDormido = 60;
    abrirRepDormido();
    await new Promise(r => setTimeout(r, 300));
    const t = document.getElementById('reporte-overlay').innerText;
    cerrarReporte();
    return t;
  });
  T('💀 encuentra el producto parado', /Producto parado/.test(r2), r2.slice(0, 110).replace(/\n/g, ' | '));
  T('🔑 y cuánta plata tiene ahí: $200.00', /\$200\.00/.test(r2));
  T('🔒 NO mete los que sí se venden', !/Gel verde/.test(r2));

  console.log('\n3️⃣  💵 GANANCIA REAL');
  await montar();
  const r3 = await p.evaluate(async () => {
    abrirRepGanancia();
    await new Promise(r => setTimeout(r, 300));
    const t = document.getElementById('reporte-overlay').innerText;
    cerrarReporte();
    return t;
  });
  T('💵 vendiste $150.00 en agosto', /Vendiste[\s\S]{0,20}\$150\.00/.test(r3), r3.slice(0, 130).replace(/\n/g, ' | '));
  T('🔑 te costó $90.00', /\$90\.00/.test(r3));
  T('🔑 gastos $40.00', /\$40\.00/.test(r3));
  T('🔑 TE QUEDA $20.00 (150−90−40)', /TE QUEDA[\s\S]{0,20}\$20\.00/.test(r3));
  T('y lo que falta por cobrar: $50.00', /por cobrar[\s\S]{0,20}\$50\.00/.test(r3));

  console.log('\n4️⃣  📈 MES A MES');
  await montar();
  const r4 = await p.evaluate(async () => {
    abrirRepMeses();
    await new Promise(r => setTimeout(r, 300));
    const t = document.getElementById('reporte-overlay').innerText;
    cerrarReporte();
    return t;
  });
  T('📈 sale agosto con $150.00', /[Aa]gosto[\s\S]{0,60}\$150\.00/.test(r4), r4.slice(0, 110).replace(/\n/g, ' | '));
  T('y julio con $30.00', /[Jj]ulio[\s\S]{0,60}\$30\.00/.test(r4));
  T('🔑 y compara: subió contra el mes anterior', /subi\u00f3|baj\u00f3/.test(r4));

  console.log('\n5️⃣  📅 POR DÍA DE LA SEMANA');
  await montar();
  const r5 = await p.evaluate(async () => {
    abrirRepDias();
    await new Promise(r => setTimeout(r, 300));
    const t = document.getElementById('reporte-overlay').innerText;
    cerrarReporte();
    return t;
  });
  T('📅 salen los 7 días', /Lunes[\s\S]*Domingo/.test(r5));
  T('🔑 el sábado tiene $100.00', /S\u00e1bado[\s\S]{0,30}\$100\.00/.test(r5), r5.slice(0, 130).replace(/\n/g, ' | '));
  T('🔑 y el viernes $50.00', /Viernes[\s\S]{0,30}\$50\.00/.test(r5));

  console.log('\n6️⃣  🏪 QUIÉN TE COMPRA MÁS');
  await montar();
  const r6 = await p.evaluate(async () => {
    abrirRepClientes();
    await new Promise(r => setTimeout(r, 300));
    const t = document.getElementById('reporte-overlay').innerText;
    const clicable = document.querySelectorAll('#reporte-overlay [onclick*="verCl"]').length;
    cerrarReporte();
    return { t, clicable };
  });
  T('🏪 salen los 2 clientes', /Barbero Uno[\s\S]*Barbero Dos/.test(r6.t), r6.t.slice(0, 120).replace(/\n/g, ' | '));
  T('🔑 el primero es el que más compró ($100)', /\ud83e\udd47[\s\S]{0,40}Barbero Uno/.test(r6.t));
  T('y se puede tocar para ir a su ficha', r6.clicable >= 2, String(r6.clicable));

  console.log('\n7️⃣  📦 QUÉ REPONER');
  await montar();
  const r7 = await p.evaluate(async () => {
    abrirRepReponer();
    await new Promise(r => setTimeout(r, 300));
    const t = document.getElementById('reporte-overlay').innerText;
    cerrarReporte();
    return t;
  });
  T('📦 el reporte abre', r7.length > 40, String(r7.length));
  T('🔒 y NO mete el producto que no se vende', !/Producto parado/.test(r7));

  console.log('\n8️⃣  📅 LAS FECHAS Y LOS ATAJOS');
  await montar();
  const r8 = await p.evaluate(async () => {
    abrirRepGanancia();
    await new Promise(r => setTimeout(r, 250));
    const ov = document.getElementById('reporte-overlay');
    const campos = ov.querySelectorAll('input[type="date"]').length;
    const atajos = ov.querySelectorAll('[onclick*="atajoRangoRep"]').length;
    // Cambiar el rango tiene que cambiar el resultado
    const antes = ov.innerText;
    atajoRangoRep('todo');
    await new Promise(r => setTimeout(r, 300));
    const despues = document.getElementById('reporte-overlay').innerText;
    cerrarReporte();
    return { campos, atajos, cambio: antes !== despues };
  });
  T('📅 hay dos campos de fecha', r8.campos === 2, String(r8.campos));
  T('y 4 atajos', r8.atajos === 4, String(r8.atajos));
  T('🔑 al cambiar el rango, cambia el resultado', r8.cambio);

  console.log('\n9️⃣  🔙 EL RECUADRO ESTÁ REGISTRADO');
  const r9 = await p.evaluate(() => ({
    enLista: RECUADROS_ENCIMA.some(x => x.id === 'reporte-overlay'),
    cierra: typeof cerrarReporte === 'function'
  }));
  T('🔙 registrado en el botón atrás', r9.enLista);
  T('y su función de cerrar existe', r9.cierra);

  console.log('\n🔟  ⌨️ EL BUSCADOR NO HACE PESTAÑEAR LA PANTALLA');
  await montar();
  const r10 = await p.evaluate(async () => {
    abrirRepProducto();
    await new Promise(r => setTimeout(r, 300));
    const campo = document.getElementById('rep-buscar-prod');
    campo.focus();
    const original = campo;
    const pasos = [];
    // 🔑 Se escribe letra por letra, como en el teléfono. El campo NO se puede destruir:
    // si se destruye, el teclado se cierra y se abre — el "pestañeo" que reportó Sensei.
    for (const letra of ['g', 'e', 'l']) {
      campo.value += letra;
      campo.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise(r => setTimeout(r, 100));
      const ahora = document.getElementById('rep-buscar-prod');
      pasos.push({ mismo: ahora === original,
                   foco: document.activeElement === ahora,
                   valor: ahora ? ahora.value : null,
                   resultados: document.querySelectorAll('#rep-resultados [onclick*="elegirProdRep"]').length });
    }
    cerrarReporte();
    return pasos;
  });
  T('⌨️ el campo NO se destruye al escribir', r10.every(x => x.mismo),
     JSON.stringify(r10.map(x => x.mismo)));
  T('🔑 y NO pierde el foco (el teclado no pestañea)', r10.every(x => x.foco),
     JSON.stringify(r10.map(x => x.foco)));
  T('el texto se conserva: "gel"', r10[2].valor === 'gel', String(r10[2].valor));
  T('🔑 y la lista SÍ se actualiza', r10[2].resultados >= 1, String(r10[2].resultados));

  console.log('\n1️⃣1️⃣  📏 EL CAMPO NO SE MUEVE (con el teclado abierto)');
  // 🔑 Sensei: "el teclado como que se baja y la ventana como que se mueve o medio
  // oculta". La ventana está pegada abajo: si crece, arrastra el campo hacia arriba.
  await p.setViewportSize({ width: 390, height: 450 });   // como su pantalla con teclado
  await montar();
  const r11 = await p.evaluate(async () => {
    abrirRepProducto();
    await new Promise(r => setTimeout(r, 300));
    const pos = () => Math.round(document.getElementById('rep-buscar-prod').getBoundingClientRect().top);
    const ys = [pos()];
    const campo = document.getElementById('rep-buscar-prod');
    campo.focus();
    for (const l of ['g', 'e', 'l']) {
      campo.value += l;
      campo.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise(r => setTimeout(r, 130));
      ys.push(pos());
    }
    const caja = document.getElementById('rep-resultados');
    const alto = caja ? getComputedStyle(caja).height : '';
    cerrarReporte();
    return { ys, movimiento: Math.max.apply(null, ys) - Math.min.apply(null, ys),
             altoFijo: /px$/.test(alto) };
  });
  await p.setViewportSize({ width: 390, height: 1200 });
  T('📏 el campo NO se mueve ni un píxel', r11.movimiento === 0,
     r11.movimiento + 'px · ' + JSON.stringify(r11.ys));
  T('🔒 la lista tiene alto fijo (no estira la ventana)', r11.altoFijo);

  console.log(`\n  ${ok} bien · ${mal} mal`);
  const reales = errs.filter(e => !/firebase|onAuthStateChanged/i.test(e));
  if (reales.length) { console.log('⚠️ JS:'); reales.slice(0, 4).forEach(e => console.log('   ' + e)); }
  await b.close();
  process.exit(mal ? 1 : 0);
})();
