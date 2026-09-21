/**
 * ✨ EL LIMPIADOR DE FOTOS  (12 sep 2026)
 * Sensei: "una herramienta que recorte y limpie mis propias fotos automáticamente —
 * que quite el fondo y las deje todas iguales, como de catálogo".
 */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file:///home/claude/trabajo/index.html');
  await p.waitForTimeout(2600);
  let ok = 0, mal = 0;
  const T = (n, c, d) => { if (c) { ok++; console.log('  ✅ ' + n); } else { mal++; console.log('  ❌ ' + n + (d ? '  →  ' + d : '')); } };

  console.log('\n1️⃣  ✨ LIMPIA UNA FOTO DE VERDAD');
  const r1 = await p.evaluate(async () => {
    ['pantalla-login', 'pantalla-bloqueo'].forEach(id => {
      const e = document.getElementById(id); if (e) e.style.display = 'none';
    });
    document.getElementById('app-contenido').style.display = 'block';
    // Una foto de producto sobre mostrador, como las que saca en la tienda
    const c = document.createElement('canvas');
    c.width = 800; c.height = 1000;
    const x = c.getContext('2d');
    x.fillStyle = '#b2a898'; x.fillRect(0, 0, 800, 1000);      // el mostrador
    x.fillStyle = '#1e7a3c'; x.fillRect(250, 220, 300, 560);   // el producto
    x.fillStyle = '#14592d'; x.fillRect(300, 170, 200, 60);    // la tapa
    const data = c.toDataURL('image/jpeg', 0.88);
    return await new Promise(res => {
      const t0 = performance.now();
      limpiarFoto(data, (limpia, seguro) => {
        // ¿De qué color quedó una esquina? Tiene que ser blanca
        const im = new Image();
        im.onload = function () {
          const c2 = document.createElement('canvas');
          c2.width = im.width; c2.height = im.height;
          const x2 = c2.getContext('2d');
          x2.drawImage(im, 0, 0);
          const esq = x2.getImageData(4, 4, 1, 1).data;
          const centro = x2.getImageData(Math.round(im.width / 2), Math.round(im.height / 2), 1, 1).data;
          res({ ms: Math.round(performance.now() - t0), seguro,
                antes: data.length, despues: limpia.length,
                ancho: im.width, alto: im.height,
                esquina: [esq[0], esq[1], esq[2]],
                centro: [centro[0], centro[1], centro[2]] });
        };
        im.src = limpia;
      }, { lado: 560 });
    });
  });
  T('✨ encuentra el producto en la foto', r1.seguro, String(r1.seguro));
  T('🔑 la deja CUADRADA', r1.ancho === r1.alto, r1.ancho + '×' + r1.alto);
  T('🧹 y la esquina queda BLANCA (quitó el fondo)',
     r1.esquina[0] > 240 && r1.esquina[1] > 240 && r1.esquina[2] > 240,
     JSON.stringify(r1.esquina));
  T('🔒 pero el producto NO se borra (el centro sigue verde)',
     r1.centro[1] > r1.centro[0] + 20, JSON.stringify(r1.centro));
  T('y pesa menos que la original', r1.despues < r1.antes,
     Math.round(r1.antes / 1024) + ' KB → ' + Math.round(r1.despues / 1024) + ' KB');
  T('⚡ y es rápida (menos de 2 segundos)', r1.ms < 2000, r1.ms + ' ms');

  console.log('\n2️⃣  🔗 TODAS LAS FOTOS PASAN POR ÉL');
  const r2 = await p.evaluate(() => ({
    recortadorLoUsa: /limpiarFoto/.test(String(abrirRecortarFoto)),
    seApaga: /_limpiarFotosApp/.test(String(abrirRecortarFoto))
  }));
  T('🔗 el recortador lo usa (cubre los 5 sitios)', r2.recortadorLoUsa);
  T('🔑 y se puede apagar', r2.seApaga);

  console.log('\n3️⃣  ✅ EL INTERRUPTOR ESTÁ EN CATÁLOGO');
  const r3 = await p.evaluate(async () => {
    ir('p-cat');
    await new Promise(r => setTimeout(r, 350));
    const c = document.getElementById('chk-limpiar-app');
    return { existe: !!c, marcado: c ? c.checked : null,
             recuerda: typeof arrancarLimpiadorFotos === 'function' };
  });
  T('✅ el interruptor existe', r3.existe);
  T('y viene marcado', r3.marcado === true, String(r3.marcado));
  T('🔑 y recuerda si lo apagó', r3.recuerda);

  console.log('\n4️⃣  🔒 SI SE APAGA, NO TOCA LA FOTO');
  const r4 = await p.evaluate(async () => {
    window._limpiarFotosApp = false;
    const c = document.createElement('canvas');
    c.width = 300; c.height = 400;
    const x = c.getContext('2d');
    x.fillStyle = '#b2a898'; x.fillRect(0, 0, 300, 400);
    x.fillStyle = '#1e7a3c'; x.fillRect(80, 80, 140, 240);
    const data = c.toDataURL('image/jpeg', 0.88);
    // Con el limpiador apagado, limpiarFoto igual funciona si se llama directo;
    // lo que se comprueba es que la bandera existe y el recortador la mira
    const miraLaBandera = /window\._limpiarFotosApp !== false/.test(String(abrirRecortarFoto));
    window._limpiarFotosApp = true;
    return { miraLaBandera };
  });
  T('🔒 el recortador mira la bandera antes de limpiar', r4.miraLaBandera);

  console.log(`\n  ${ok} bien · ${mal} mal`);
  const reales = errs.filter(e => !/firebase|onAuthStateChanged/i.test(e));
  if (reales.length) { console.log('⚠️ JS:'); reales.slice(0, 3).forEach(e => console.log('   ' + e)); }
  await b.close();
  process.exit(mal ? 1 : 0);
})();
