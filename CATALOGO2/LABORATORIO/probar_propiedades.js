/**
 * ⚖️ LOS DOS FALLOS QUE ENCONTRÓ LA PRUEBA POR PROPIEDADES  (4 sep 2026)
 * Se guardan como prueba fija para que no puedan volver.
 */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 900 } });
  p.on('pageerror', () => {});
  await p.goto('file:///home/claude/trabajo/index.html');
  await p.waitForTimeout(2600);
  let ok = 0, mal = 0;
  const T = (n, c, d) => { if (c) { ok++; console.log('  ✅ ' + n); } else { mal++; console.log('  ❌ ' + n + (d ? '  →  ' + d : '')); } };

  console.log('\n1️⃣  💵 AL BAJAR EL TOTAL, EL SOBRANTE VA A CRÉDITO');
  const r1 = await p.evaluate(async () => {
    ['pantalla-login', 'pantalla-bloqueo'].forEach(id => {
      const e = document.getElementById(id); if (e) e.style.display = 'none';
    });
    document.getElementById('app-contenido').style.display = 'block';
    if (!document.getElementById('fact-edit-overlay')) { const d = document.createElement('div'); d.id = 'fact-edit-overlay'; document.body.appendChild(d); }
    if (!document.getElementById('fact-buscar')) { const i = document.createElement('input'); i.id = 'fact-buscar'; document.body.appendChild(i); }
    localStorage.setItem('ncl', JSON.stringify([{ id: 1, nombre: 'C1' }]));
    localStorage.setItem('np', JSON.stringify([{ id: 'p1', nombre: 'Gel', marca: 'G', precio: 10, costo: 6, stock: 99, min: 5 }]));
    localStorage.setItem('nv', JSON.stringify([
      { id: 1, cid: 1, cn: 'C1', tipo: 'contado', fecha: '09/04/2026', numFactura: '0001',
        total: 116.69, ganancia: 35, items: [{ pid: 'p1', nombre: 'Gel', cant: 1, precio: 116.69, costo: 70 }],
        pagosFactura: [{ pid: 'a', monto: 116.69, fecha: '09/04/2026' }] }]));
    clientes = LS('ncl', []); ventas = LS('nv', []); loadProds();
    const oa = window.alert; window.alert = () => {};
    window._facturaEditItems = [{ pid: 'p1', nombre: 'Gel', cant: 1, precio: 113.82, costo: 70 }];
    window._facturaEditVid = 1;
    guardarEdicionFactura(1);
    await new Promise(r => setTimeout(r, 300));
    window.alert = oa;
    const v = LS('nv', [])[0]; const c = cobradoYDebeDe(v);
    return { total: v.total, cobrado: c.cobrado, debe: c.debe,
             credito: LS('ncl', [])[0].creditoAFavor || 0,
             pagos: (v.pagosFactura || []).map(x => x.monto) };
  });
  T('la factura queda en $113.82', Math.abs(r1.total - 113.82) < 0.005, String(r1.total));
  T('🔑 los $2.87 van a su crédito a favor', Math.abs(r1.credito - 2.87) < 0.005, String(r1.credito));
  T('🔑 y el PAGO se ajusta a $113.82', r1.pagos.length === 1 && Math.abs(r1.pagos[0] - 113.82) < 0.005, JSON.stringify(r1.pagos));
  T('🔒 así el dinero NO se cuenta dos veces', Math.abs(r1.cobrado - 113.82) < 0.005, String(r1.cobrado));
  T('y la factura queda saldada', Math.abs(r1.debe) < 0.005, String(r1.debe));

  console.log('\n2️⃣  🧾 DOS RECIBOS SEGUIDOS NUNCA COMPARTEN NÚMERO');
  const r2 = await p.evaluate(() => {
    const vistos = {};
    let repetido = null;
    // 300 recibos seguidos, como si cobrara a muchos barberos del tirón
    for (let i = 0; i < 300; i++) {
      const r = nuevoNumeroRecibo();
      if (vistos[r]) { repetido = r; break; }
      vistos[r] = true;
    }
    return { repetido, cuantos: Object.keys(vistos).length, ejemplo: Object.keys(vistos)[0] };
  });
  T('🔑 300 recibos seguidos y NINGUNO se repite', !r2.repetido, String(r2.repetido));
  T('los 300 son distintos', r2.cuantos === 300, String(r2.cuantos));
  console.log('     ejemplo: ' + r2.ejemplo);

  console.log(`\n  ${ok} bien · ${mal} mal`);
  await b.close();
  process.exit(mal ? 1 : 0);
})();
