/**
 * 📊 COBERTURA REAL — NBS 2
 *
 * Mide qué porcentaje de las funciones de la app se EJECUTAN de verdad al usarla.
 * No dice si están bien: dice cuáles NUNCA se tocan, que son las que pueden estar
 * rotas sin que nadie se entere.
 *
 * 🔑 COBERTURA ≠ PROTECCIÓN. Se puede tener 100% de cobertura y no proteger nada si
 * las pruebas no comprueban el resultado. Por eso esta va SIEMPRE junto con la
 * mutación: la cobertura dice qué se toca, la mutación dice si se protege.
 *
 * Corre varios escenarios de trabajo de verdad y FUNDE lo que tocó cada uno.
 *
 *     node cobertura_real.js
 */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');

// ── Los escenarios: un día de trabajo de Sensei, por partes ──
const ESCENARIOS = [

  { n: 'Recorrer todas las pantallas', f: async (p) => {
      await p.evaluate(async () => {
        const pgs = [...document.querySelectorAll('.pg')].map(x => x.id);
        for (const id of pgs) { try { ir(id); } catch (e) {} await new Promise(r => setTimeout(r, 25)); }
      });
    } },

  { n: 'Vender a un cliente', f: async (p) => {
      await p.evaluate(async () => {
        ir('p-v'); await new Promise(r => setTimeout(r, 80));
        try {
          iV = [{ pid: 'p1', nombre: 'Gel', cant: 2, precio: 10, costo: 4 }];
          renderIV(); calcDesc();
          ventaClienteId = 1;
          if (typeof filtrarClienteVenta === 'function') filtrarClienteVenta('Isidro');
        } catch (e) {}
      });
    } },

  { n: 'Cobrarle a un cliente', f: async (p) => {
      await p.evaluate(async () => {
        try {
          irACuentasPorCobrar(); await new Promise(r => setTimeout(r, 80));
          renderCxC('');
          abrirAbono(1); await new Promise(r => setTimeout(r, 120));
        } catch (e) {}
      });
    } },

  { n: 'Mirar la ficha de un cliente', f: async (p) => {
      await p.evaluate(async () => {
        try {
          verCl(1); await new Promise(r => setTimeout(r, 200));
          // Abrir todos los renglones del panel
          const pg = document.getElementById('p-cl-perfil');
          const filas = [...pg.querySelectorAll('[onclick*="togglePanelCl"]')];
          for (const f of filas) { f.click(); await new Promise(r => setTimeout(r, 40)); }
          abrirEstadoDeCuenta(1); await new Promise(r => setTimeout(r, 150));
          cerrarEstadoDeCuenta();
        } catch (e) {}
      });
    } },

  { n: 'El catálogo y el inventario', f: async (p) => {
      await p.evaluate(async () => {
        try {
          ir('p-cat'); await new Promise(r => setTimeout(r, 80));
          renderCatalogo(''); renderCatalogo('gel');
          if (typeof renderInventario === 'function') { ir('p-inventario'); renderInventario(); }
          if (typeof renderListaPrecios === 'function') renderListaPrecios('');
        } catch (e) {}
      });
    } },

  { n: 'Los reportes', f: async (p) => {
      await p.evaluate(async () => {
        const fns = ['mostrarResumenFinanciero', 'mostrarPanorama', 'mostrarReporteClientes',
                     'mostrarMargenProductos', 'renderBitacora', 'mostrarReportePorFecha'];
        for (const f of fns) { try { if (typeof window[f] === 'function') window[f](); } catch (e) {} 
          await new Promise(r => setTimeout(r, 40)); }
      });
    } },

  { n: 'La van y el relleno', f: async (p) => {
      await p.evaluate(async () => {
        try {
          ir('p-van'); await new Promise(r => setTimeout(r, 80));
          renderVan(''); calcularEstadoVan();
          abrirCierreRuta(); await new Promise(r => setTimeout(r, 100));
          cerrarCierreRuta();
          ir('p-relleno'); if (typeof abrirRelleno === 'function') abrirRelleno();
        } catch (e) {}
      });
    } },

  { n: 'Compras y suplidores', f: async (p) => {
      await p.evaluate(async () => {
        try {
          ir('p-comp'); await new Promise(r => setTimeout(r, 80));
          toggleBloqueCompra('cc-bloque-factura', 'cc-btn-factura');
          toggleBloqueCompra('cc-bloque-extras', 'cc-btn-extras');
          ir('p-sup'); renderSup('');
        } catch (e) {}
      });
    } },

  { n: 'El asistente', f: async (p) => {
      await p.evaluate(async () => {
        try {
          abrirAsistente(); await new Promise(r => setTimeout(r, 250));
          ['cuanto me debe isidro', 'cuanto vendi hoy', 'que se me acaba',
           'cuanto llevo este mes'].forEach(q => { try { contestarAsistente(q); } catch (e) {} });
          cerrarAsistente();
        } catch (e) {}
      });
    } },

  { n: 'Los respaldos y la nube', f: async (p) => {
      await p.evaluate(async () => {
        const fns = ['hayPendientesDeSubir', 'revisionDiaria', 'verQueUsoMas', 'verSinConfirmar'];
        for (const f of fns) { try { if (typeof window[f] === 'function') window[f](); } catch (e) {} }
        try { cerrarSinConfirmar(); cerrarAviso(); } catch (e) {}
      });
    } },
];

(async () => {
  const b = await chromium.launch();
  const tocadas = new Set();
  let total = 0;

  for (const esc of ESCENARIOS) {
    const p = await b.newPage({ viewport: { width: 390, height: 900 } });
    p.on('pageerror', () => {});
    await p.goto('file:///home/claude/trabajo/index.html');
    await p.waitForTimeout(2400);

    // Se pone el medidor: cada función global se envuelve para saber si se llamó
    await p.evaluate(() => {
      ['pantalla-login', 'pantalla-bloqueo'].forEach(id => {
        const e = document.getElementById(id); if (e) e.style.display = 'none';
      });
      const a = document.getElementById('app-contenido'); if (a) a.style.display = 'block';

      // Datos de trabajo
      localStorage.setItem('ncl', JSON.stringify([
        { id: 1, nombre: 'Isidro', apellido: 'Gonzalez', negocio: 'URBAN', tel: '4015550001' },
        { id: 2, nombre: 'Nelson', apellido: 'Castro', negocio: 'RD', tel: '4015550002' }]));
      localStorage.setItem('np', JSON.stringify([
        { id: 'p1', nombre: 'Gel', marca: 'G', costo: 4, precio: 10, stock: 20, min: 5 },
        { id: 'p2', nombre: 'Wax', marca: 'W', costo: 5, precio: 12, stock: 3, min: 5 }]));
      const hoy = fechaHoy();
      localStorage.setItem('nv', JSON.stringify([
        { id: 1, cid: 1, cn: 'Isidro', tipo: 'credito', fecha: hoy, total: 100, ganancia: 30,
          items: [{ pid: 'p1', nombre: 'Gel', cant: 10, precio: 10, costo: 7 }],
          pagosFactura: [{ pid: 'a', recibo: 'R1', montoCobro: 40, monto: 40, fecha: hoy }] },
        { id: 2, cid: 2, cn: 'Nelson', tipo: 'contado', fecha: hoy, total: 60, ganancia: 18,
          items: [{ pid: 'p2', nombre: 'Wax', cant: 5, precio: 12, costo: 8 }],
          pagosFactura: [{ pid: 'b', monto: 60, fecha: hoy }] }]));
      localStorage.setItem('nsup', JSON.stringify([{ id: 900, nombre: 'Kanar' }]));
      localStorage.setItem('nc', JSON.stringify([
        { id: 7001, sid: 900, sn: 'Kanar', tipo: 'credito', fecha: hoy, total: 400,
          items: [{ pid: 'p1', nombre: 'Gel', cant: 100, costo: 4 }],
          pagosFactura: [{ pid: 'c', monto: 150, fecha: hoy }] }]));
      localStorage.setItem('nvan', JSON.stringify({ fechaCarga: '2026-08-20', cargado: { p1: 24 } }));
      clientes = LS('ncl', []); ventas = LS('nv', []);
      compras = LS('nc', []); suplidores = LS('nsup', []); loadProds();

      // El medidor
      window.__TOCADAS = new Set();
      window.__TODAS = [];
      for (const k of Object.getOwnPropertyNames(window)) {
        let v;
        try { v = window[k]; } catch (e) { continue; }
        if (typeof v !== 'function') continue;
        if (v.toString().indexOf('[native code]') >= 0) continue;
        window.__TODAS.push(k);
        const orig = v;
        const envuelta = function () { window.__TOCADAS.add(k); return orig.apply(this, arguments); };
        envuelta.toString = () => orig.toString();
        // 🔑 Las declaradas con `function nombre(){}` quedan writable pero NO configurable,
        // y defineProperty las rechaza. A esas hay que asignarlas directamente. -30 ago-
        const d = Object.getOwnPropertyDescriptor(window, k);
        if (d && !d.configurable) {
          if (d.writable) { try { window[k] = envuelta; } catch (e) {} }
        } else {
          try {
            Object.defineProperty(window, k, { value: envuelta, writable: true, configurable: true });
          } catch (e) { try { window[k] = envuelta; } catch (e2) {} }
        }
      }
    });

    try { await esc.f(p); } catch (e) {}
    await p.waitForTimeout(150);

    const r = await p.evaluate(() => ({
      tocadas: [...window.__TOCADAS], total: window.__TODAS.length
    }));
    r.tocadas.forEach(x => tocadas.add(x));
    total = Math.max(total, r.total);
    console.log('  ' + esc.n.padEnd(34) + ' tocó ' + String(r.tocadas.length).padStart(4) + ' funciones');
    await p.close();
  }

  const pct = total ? Math.round(tocadas.size / total * 100) : 0;
  console.log('');
  console.log('════════════════════════════════════════════════');
  console.log('  📊 COBERTURA REAL');
  console.log('════════════════════════════════════════════════');
  console.log('  funciones de la app ....... ' + total);
  console.log('  tocadas al usarla ......... ' + tocadas.size);
  console.log('  cobertura ................. ' + pct + '%');
  console.log('');
  console.log('  🔑 Esto NO dice si funcionan bien — dice cuáles se');
  console.log('     tocan. Lo que protege es la mutación.');
  console.log('════════════════════════════════════════════════');

  await b.close();
})();
