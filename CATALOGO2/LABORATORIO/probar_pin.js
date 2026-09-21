/**
 * 🔒 EL RECUADRO DEL PIN  (6 sep 2026)
 *
 * 🔴 EL FALLO: `verificarPIN` usaba `prompt()`, y el teléfono de Sensei NO LO DIBUJA.
 * Sin recuadro no escribía el PIN, la función se cortaba, y él veía que "no pasa nada".
 * Y esto protege 20 sitios que mueven dinero: con el prompt bloqueado, NINGUNO iba.
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

  console.log('\n1️⃣  🔑 YA NO SE USA prompt()');
  const r1 = await p.evaluate(() => ({
    // 🔑 Lo que rompía: verificarPIN llamaba a prompt(), que el teléfono no dibuja
    // Se quitan los comentarios antes de mirar: "prompt" sale en el comentario
    usaPrompt: /prompt\(/.test(String(verificarPIN).replace(/\/\/[^\n]*/g, '')),
    usaRecuadro: /pedirPinConRecuadro/.test(String(verificarPIN)),
    // Y la seguridad sigue siendo la misma
    mismoControl: /verificarPinConLimite/.test(String(comprobarPinRecuadro))
  }));
  T('🔑 verificarPIN ya NO usa prompt()', !r1.usaPrompt, String(r1.usaPrompt));
  T('🔑 usa el recuadro de la app', r1.usaRecuadro);
  T('🔒 y el MISMO control de intentos', r1.mismoControl);

  console.log('\n2️⃣  👁️ EL RECUADRO SE VE Y VA ENCIMA DE TODO');
  const r2 = await p.evaluate(async () => {
    ['pantalla-login', 'pantalla-bloqueo'].forEach(id => {
      const e = document.getElementById(id); if (e) e.style.display = 'none';
    });
    document.getElementById('app-contenido').style.display = 'block';
    let llamado = false;
    pedirPinConRecuadro('Prueba', function () { llamado = true; });
    await new Promise(r => setTimeout(r, 300));
    const ov = document.getElementById('pin-overlay');
    // 🔑 Tiene que ir por encima de los demás recuadros, o queda detrás como antes
    // 🔑 Se compara con los OTROS recuadros, no consigo mismo
    const otros = RECUADROS_ENCIMA.filter(x => x.id !== 'pin-overlay').map(x => {
      const e = document.getElementById(x.id);
      return e ? parseInt(getComputedStyle(e).zIndex, 10) || 0 : 0;
    });
    return {
      abrio: !!ov && ov.style.display === 'flex',
      alto: ov ? Math.round(ov.getBoundingClientRect().height) : 0,
      z: ov ? parseInt(getComputedStyle(ov).zIndex, 10) : 0,
      maxOtros: Math.max.apply(null, otros.concat([0])),
      hayCampo: !!document.getElementById('pin-campo'),
      llamadoAntesDelPin: llamado
    };
  });
  T('👁️ el recuadro abre y SE VE', r2.abrio && r2.alto > 200, r2.alto + ' px');
  T('🔑 va por ENCIMA de todos los demás', r2.z > r2.maxOtros, r2.z + ' vs ' + r2.maxOtros);
  T('tiene su campo para el PIN', r2.hayCampo);
  T('🔒 y NO ejecuta nada antes de acertar', !r2.llamadoAntesDelPin);

  console.log('\n3️⃣  🔒 CON EL PIN MALO NO PASA NADA');
  const r3 = await p.evaluate(async () => {
    let hecho = false;
    const oa = window.alert; window.alert = () => {};
    pedirPinConRecuadro('Prueba', function () { hecho = true; });
    await new Promise(r => setTimeout(r, 250));
    document.getElementById('pin-campo').value = '000000';
    comprobarPinRecuadro();
    await new Promise(r => setTimeout(r, 250));
    const ov = document.getElementById('pin-overlay');
    const res = { hecho, sigueAbierto: ov.style.display === 'flex',
                  aviso: (document.getElementById('pin-aviso') || {}).textContent || '' };
    window.alert = oa;
    return res;
  });
  T('🔒 con el PIN malo NO ejecuta la acción', !r3.hecho, String(r3.hecho));
  T('🔒 el recuadro sigue abierto', r3.sigueAbierto);
  T('y avisa que está mal', /incorrecto/i.test(r3.aviso), r3.aviso);

  console.log('\n4️⃣  ✅ CON EL PIN BUENO SÍ EJECUTA');
  const r4 = await p.evaluate(async () => {
    let hecho = false;
    pedirPinConRecuadro('Prueba', function () { hecho = true; });
    await new Promise(r => setTimeout(r, 250));
    document.getElementById('pin-campo').value = PIN_ADMIN;
    comprobarPinRecuadro();
    await new Promise(r => setTimeout(r, 300));
    return { hecho, cerro: document.getElementById('pin-overlay').style.display === 'none' };
  });
  T('✅ con el PIN bueno ejecuta la acción', r4.hecho, String(r4.hecho));
  T('y el recuadro se cierra solo', r4.cerro);

  console.log('\n5️⃣  🚫 CANCELAR NO EJECUTA NADA');
  const r5 = await p.evaluate(async () => {
    let hecho = false;
    pedirPinConRecuadro('Prueba', function () { hecho = true; });
    await new Promise(r => setTimeout(r, 250));
    cerrarPinRecuadro();
    await new Promise(r => setTimeout(r, 200));
    return { hecho, cerro: document.getElementById('pin-overlay').style.display === 'none' };
  });
  T('🚫 al cancelar NO se ejecuta nada', !r5.hecho, String(r5.hecho));
  T('y se cierra', r5.cerro);

  console.log('\n6️⃣  🔙 EL BOTÓN ATRÁS LO CIERRA');
  const r6 = await p.evaluate(() => ({
    enLista: RECUADROS_ENCIMA.some(x => x.id === 'pin-overlay'),
    cierra: typeof cerrarPinRecuadro === 'function'
  }));
  T('🔙 el recuadro está registrado', r6.enLista);
  T('y su función de cerrar existe', r6.cierra);

  console.log('\n7️⃣  🔑 NINGÚN SITIO DE DINERO USA prompt() PARA EL PIN');
  const r7 = await p.evaluate(() => {
    // Ninguna de las funciones que mueven dinero debe pedir el PIN con prompt
    const sospechosas = ['usarCreditoAFavor', 'confirmarPagoMultiple', 'guardarEdicionFactura',
                         'cancelarFactura', 'importD'];
    const malas = sospechosas.filter(f => typeof window[f] === 'function'
                                       && /prompt\(\s*['"]Ingresa el PIN/.test(String(window[f])));
    return { malas };
  });
  T('🔑 ninguna función de dinero pide el PIN con prompt', r7.malas.length === 0, r7.malas.join(', '));

  console.log(`\n  ${ok} bien · ${mal} mal`);
  const reales = errs.filter(e => !/firebase|onAuthStateChanged/i.test(e));
  if (reales.length) { console.log('⚠️ JS:'); reales.slice(0, 4).forEach(e => console.log('   ' + e)); }
  await b.close();
  process.exit(mal ? 1 : 0);
})();
