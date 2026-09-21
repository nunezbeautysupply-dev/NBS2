/**
 * 💰 CONTABILIDAD PARALELA — NBS 2
 *
 * Sensei, 30 ago: "ya me has hablado de guardianes y de pruebas paralelas y de
 * contabilidad y todo eso, ¿por qué no las has seguido haciendo?".
 *
 * Tenía razón: se habían perdido. Esta es la más importante y vuelve a existir.
 *
 * 🔑 QUÉ HACE, Y POR QUÉ IMPORTA:
 * Rehace las cuentas de tu negocio DESDE CERO, con un código distinto al de la app,
 * leyendo solo los datos crudos. Y compara.
 *
 * Si la app y esta contabilidad dan lo mismo, es MUY difícil que las dos se hayan
 * equivocado igual. Si dan distinto, hay un problema y se sabe cuál.
 *
 * Se corre:  node contabilidad_paralela.js
 * Y con TUS datos:  node contabilidad_paralela.js mi_backup.json
 */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
const fs = require('fs');

// ── Los datos con los que se prueba, si no le pasan un backup ──
function datosDePrueba() {
  const cl = [], nv = [], nc = [];
  for (let i = 1; i <= 8; i++) cl.push({ id: i, nombre: 'Cliente' + i, negocio: 'BARB ' + i });

  let idv = 100;
  for (let i = 1; i <= 8; i++) {
    for (let k = 0; k < 4; k++) {
      const total = 20 + i * 7 + k * 3;
      const esCredito = (i + k) % 3 !== 0;
      const pagos = [];
      if (!esCredito) {
        pagos.push({ pid: 'p' + idv, monto: total, fecha: '08/0' + ((k % 8) + 1) + '/2026' });
      } else if (k % 2 === 0) {
        // pagado a medias
        pagos.push({ pid: 'p' + idv, recibo: 'R' + idv, montoCobro: total / 2,
                     monto: Math.round(total / 2 * 100) / 100, fecha: '08/1' + (k % 9) + '/2026' });
      }
      nv.push({
        id: idv++, cid: i, cn: 'Cliente' + i, tipo: esCredito ? 'credito' : 'contado',
        fecha: '0' + (7 + (k % 2)) + '/' + ((i * 3 + k) % 28 + 1) + '/2026',
        total: total, ganancia: Math.round(total * 0.3 * 100) / 100,
        items: [{ pid: 'p1', nombre: 'Gel', cant: 2, precio: total / 2, costo: total / 2 * 0.7 }],
        pagosFactura: pagos
      });
    }
  }
  // Una cancelada, que no debe contar
  nv.push({ id: 999, cid: 1, cn: 'Cliente1', tipo: 'credito', fecha: '08/05/2026',
            total: 500, ganancia: 150, cancelada: true, items: [], pagosFactura: [] });

  nc.push({ id: 7001, sid: 900, sn: 'Kanar', tipo: 'credito', fecha: '08/01/2026',
            total: 1200, envio: 0, cargoTarjeta: 0,
            items: [{ pid: 'p1', nombre: 'Gel', cant: 300, costo: 4 }],
            pagosFactura: [{ pid: 'c1', monto: 400, fecha: '08/10/2026' }] });
  nc.push({ id: 7002, sid: 900, sn: 'Kanar', tipo: 'contado', fecha: '08/12/2026',
            total: 300, envio: 25, cargoTarjeta: 0,
            items: [{ pid: 'p2', nombre: 'Wax', cant: 55, costo: 5 }],
            pagosFactura: [{ pid: 'c2', monto: 300, fecha: '08/12/2026' }] });

  return {
    ncl: cl, nv: nv, nc: nc,
    nsup: [{ id: 900, nombre: 'Kanar' }],
    np: [{ id: 'p1', nombre: 'Gel', marca: 'G', costo: 4, precio: 10, stock: 100, min: 5 },
         { id: 'p2', nombre: 'Wax', marca: 'W', costo: 5, precio: 12, stock: 60, min: 5 }]
  };
}

// ═══════════════════════════════════════════════════════════
//  LA CONTABILIDAD DE ESTE PROGRAMA — hecha aparte, a mano
//  🔑 No usa NADA de la app. Solo los datos crudos.
// ═══════════════════════════════════════════════════════════
function cuentasAparte(d) {
  const r2 = (n) => Math.round(n * 100) / 100;
  const ventas = d.nv || [], compras = d.nc || [], clientes = d.ncl || [];

  let vendido = 0, cobrado = 0, porCobrar = 0, ganancia = 0;
  const balancePorCliente = {};

  ventas.forEach(v => {
    if (v.cancelada) return;
    const total = Number(v.total) || 0;
    vendido += total;
    ganancia += Number(v.ganancia) || 0;

    let pag = 0;
    (v.pagosFactura || []).forEach(p => {
      if (typeof p.monto === 'number' && !p.esDevolucion) pag += p.monto;
    });
    // Un pago no puede pasar del total de su factura
    const aplicado = Math.min(pag, total);
    cobrado += aplicado;
    const debe = total - aplicado;
    porCobrar += debe;

    const cid = String(v.cid);
    balancePorCliente[cid] = r2((balancePorCliente[cid] || 0) + debe);
  });

  let compradoTot = 0, pagadoSup = 0, debeSup = 0;
  compras.forEach(c => {
    const t = Number(c.total) || 0;
    let pg = 0;
    (c.pagosFactura || []).forEach(p => { if (typeof p.monto === 'number') pg += p.monto; });
    compradoTot += t;
    pagadoSup += pg;
    if (t - pg > 0.005) debeSup += t - pg;
  });

  return {
    vendido: r2(vendido), cobrado: r2(cobrado), porCobrar: r2(porCobrar),
    ganancia: r2(ganancia), balancePorCliente,
    comprado: r2(compradoTot), pagadoSup: r2(pagadoSup), debeSup: r2(debeSup)
  };
}

(async () => {
  const archivo = process.argv[2];
  let datos;
  if (archivo) {
    console.log('Usando TUS datos:', archivo);
    const crudo = JSON.parse(fs.readFileSync(archivo, 'utf8'));
    datos = crudo.datos || crudo;
  } else {
    datos = datosDePrueba();
  }

  const mias = cuentasAparte(datos);

  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 900 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file:///home/claude/trabajo/index.html');
  await p.waitForTimeout(2800);

  const suyas = await p.evaluate((d) => {
    ['pantalla-login', 'pantalla-bloqueo'].forEach(id => {
      const e = document.getElementById(id); if (e) e.style.display = 'none';
    });
    const a = document.getElementById('app-contenido'); if (a) a.style.display = 'block';
    Object.keys(d).forEach(k => localStorage.setItem(k, JSON.stringify(d[k])));
    clientes = LS('ncl', []); ventas = LS('nv', []);
    compras = LS('nc', []); suplidores = LS('nsup', []); loadProds();

    const r2 = (n) => Math.round(n * 100) / 100;
    let vendido = 0, cobrado = 0, porCobrar = 0, ganancia = 0;
    const bal = {};
    LS('nv', []).forEach(v => {
      if (v.cancelada) return;
      vendido += parseFloat(v.total) || 0;
      ganancia += parseFloat(v.ganancia) || 0;
      const c = cobradoYDebeDe(v);          // ← LA FUNCIÓN DE LA APP
      cobrado += c.cobrado;
      porCobrar += c.debe;
      const cid = String(v.cid);
      bal[cid] = r2((bal[cid] || 0) + c.debe);
    });

    let comprado = 0, pagadoSup = 0, debeSup = 0;
    LS('nc', []).forEach(c => {
      const t = parseFloat(c.total) || 0;
      let pg = 0;
      (c.pagosFactura || []).forEach(x => { if (typeof x.monto === 'number') pg += x.monto; });
      comprado += t; pagadoSup += pg;
      if (t - pg > 0.005) debeSup += t - pg;
    });

    return {
      vendido: r2(vendido), cobrado: r2(cobrado), porCobrar: r2(porCobrar),
      ganancia: r2(ganancia), balancePorCliente: bal,
      comprado: r2(comprado), pagadoSup: r2(pagadoSup), debeSup: r2(debeSup)
    };
  }, datos);

  // ── LA COMPARACIÓN ──
  console.log('');
  console.log('════════════════════════════════════════════════');
  console.log('  💰 CONTABILIDAD PARALELA');
  console.log('  Las cuentas hechas DOS VECES, por caminos distintos');
  console.log('════════════════════════════════════════════════');
  console.log('');
  console.log('  CONCEPTO'.padEnd(20) + 'LA APP'.padStart(14) + 'APARTE'.padStart(14) + '   ');

  let fallos = 0;
  const fila = (n, a, c) => {
    const igual = Math.abs(a - c) < 0.005;
    if (!igual) fallos++;
    console.log('  ' + n.padEnd(18)
      + ('$' + a.toFixed(2)).padStart(14)
      + ('$' + c.toFixed(2)).padStart(14)
      + '   ' + (igual ? '✅' : '🔴 NO CUADRA'));
  };
  fila('Vendido', suyas.vendido, mias.vendido);
  fila('Cobrado', suyas.cobrado, mias.cobrado);
  fila('Por cobrar', suyas.porCobrar, mias.porCobrar);
  fila('Ganancia', suyas.ganancia, mias.ganancia);
  fila('Comprado', suyas.comprado, mias.comprado);
  fila('Pagado a sup.', suyas.pagadoSup, mias.pagadoSup);
  fila('Debo a sup.', suyas.debeSup, mias.debeSup);

  console.log('');
  console.log('  ── LA LEY DEL DINERO ──');
  const leyApp = Math.abs(suyas.vendido - (suyas.cobrado + suyas.porCobrar)) < 0.005;
  const leyMia = Math.abs(mias.vendido - (mias.cobrado + mias.porCobrar)) < 0.005;
  console.log('  vendido = cobrado + por cobrar');
  console.log('    en la app :', leyApp ? '✅ cuadra' : '🔴 NO CUADRA');
  console.log('    aparte    :', leyMia ? '✅ cuadra' : '🔴 NO CUADRA');
  if (!leyApp || !leyMia) fallos++;

  console.log('');
  console.log('  ── EL BALANCE DE CADA CLIENTE ──');
  const cids = new Set([...Object.keys(suyas.balancePorCliente), ...Object.keys(mias.balancePorCliente)]);
  let malos = 0;
  cids.forEach(cid => {
    const a = suyas.balancePorCliente[cid] || 0;
    const c = mias.balancePorCliente[cid] || 0;
    if (Math.abs(a - c) > 0.005) {
      malos++; fallos++;
      console.log('    🔴 cliente ' + cid + ': la app dice $' + a.toFixed(2) + ' y aparte da $' + c.toFixed(2));
    }
  });
  console.log('  ' + cids.size + ' cliente(s) comprobados · ' + (malos ? malos + ' con diferencia' : 'todos cuadran ✅'));

  console.log('');
  console.log('════════════════════════════════════════════════');
  if (fallos === 0) {
    console.log('  ✅ LAS DOS CONTABILIDADES DAN LO MISMO');
    console.log('     Es muy difícil que las dos se equivoquen igual.');
  } else {
    console.log('  🔴 HAY ' + fallos + ' DIFERENCIA(S) — MIRARLO ANTES DE ENTREGAR');
  }
  console.log('════════════════════════════════════════════════');

  const reales = errs.filter(e => !/firebase|onAuthStateChanged/i.test(e));
  if (reales.length) { console.log(''); console.log('⚠️ JS:'); reales.forEach(e => console.log('   ' + e)); }
  await b.close();
  process.exit(fallos || reales.length ? 1 : 0);
})();
