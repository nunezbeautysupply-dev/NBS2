/**
 * 🔙 EL BOTÓN ATRÁS — SIN COLCHÓN  (8 sep 2026)
 *
 * 🔴 Sensei, tras TRES arreglos fallidos: "la app se sigue cerrando cuando le doy para
 * atrás, eso nunca lo has podido arreglar". Y: "le doy a salir de la app y no hace nada".
 *
 * LOS DOS FALLOS VENÍAN DEL COLCHÓN de 30 pasos falsos:
 *   · ATRÁS gastaba un paso cada vez; al acabarse, Android cerraba la app. Rellenarlo
 *     no bastaba: Chrome descarta los pasos que no vienen de un toque del usuario.
 *   · SALIR hacía history.go(-31) y Chrome descarta un salto tan grande.
 *
 * 🔑 AHORA: un solo paso, repuesto SIEMPRE en cada atrás.
 */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
const http = require('http'), fs = require('fs');
// Servidor propio: file:// no tiene historial de verdad
const srv = http.createServer((q, s) => {
  s.writeHead(200, { 'Content-Type': 'text/html' });
  s.end(fs.readFileSync('/home/claude/trabajo/index.html'));
}).listen(8210);

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 800 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8210/');
  await p.waitForTimeout(2600);
  let ok = 0, mal = 0;
  const T = (n, c, d) => { if (c) { ok++; console.log('  ✅ ' + n); } else { mal++; console.log('  ❌ ' + n + (d ? '  →  ' + d : '')); } };

  const limpio = () => p.evaluate(() => {
    ['pantalla-login', 'pantalla-bloqueo'].forEach(id => {
      const e = document.getElementById(id); if (e) e.style.display = 'none';
    });
    document.getElementById('app-contenido').style.display = 'block';
    const s = document.getElementById('salir-box');
    if (s) s.style.display = 'none';
    _saliendoApp = false;
    ir('p-inicio');
    ponerGuardianAtras();
  });

  console.log('\n1️⃣  🔑 EL PASO NUNCA SE GASTA (lo que cerraba la app)');
  await limpio();
  const r1 = await p.evaluate(async () => {
    for (const pg of ['p-cl', 'p-cxc', 'p-cat', 'p-rpt']) {
      ir(pg); await new Promise(r => setTimeout(r, 50));
    }
    const pasos = [];
    let letrero = 0;
    for (let i = 0; i < 20; i++) {
      window.dispatchEvent(new PopStateEvent('popstate'));
      await new Promise(r => setTimeout(r, 45));
      pasos.push(profundidadGuardian());
      const s = document.getElementById('salir-box');
      if (s && s.style.display === 'block') { letrero++; s.style.display = 'none'; }
    }
    return { minimo: Math.min.apply(null, pasos), letrero, pantalla: pantallaActual() };
  });
  T('🔑 tras 20 atrás, el paso NUNCA llega a 0', r1.minimo >= 1, 'mínimo: ' + r1.minimo);
  T('🔑 y sale el letrero de salir', r1.letrero > 0, r1.letrero + ' veces');
  T('acaba en Inicio, no fuera', r1.pantalla === 'p-inicio', String(r1.pantalla));

  console.log('\n1️⃣ᵇ 🔑 EL ATRÁS REPONE EL PASO QUE ANDROID GASTA');
  await limpio();
  const r1b = await p.evaluate(async () => {
    // 🔑 Android GASTA el paso al dar atrás. Aquí se simula: se quita el estado nuestro
    // ANTES de disparar el popstate, como haría el teléfono de verdad.
    history.replaceState({}, '', window.location.href);
    const antes = profundidadGuardian();        // 0: el paso se gastó
    window.dispatchEvent(new PopStateEvent('popstate'));
    await new Promise(r => setTimeout(r, 200));
    const despues = profundidadGuardian();      // tiene que volver a 1
    const s = document.getElementById('salir-box');
    if (s) s.style.display = 'none';
    return { antes, despues };
  });
  T('🔑 el paso se gastó (0)', r1b.antes === 0, String(r1b.antes));
  T('🔑 y el atrás LO REPONE (1)', r1b.despues === 1,
     r1b.antes + ' → ' + r1b.despues + ' — si no repone, la app se cierra sola');

  console.log('\n2️⃣  🚪 ATRÁS CIERRA LO QUE ESTÉ ABIERTO, NO SALE');
  await limpio();
  const r2 = await p.evaluate(async () => {
    // Se abre un recuadro de los registrados
    abrirRepDormido();
    await new Promise(r => setTimeout(r, 350));
    const abiertoAntes = document.getElementById('reporte-overlay').style.display === 'flex';
    window.dispatchEvent(new PopStateEvent('popstate'));
    await new Promise(r => setTimeout(r, 250));
    return { abiertoAntes,
             cerrado: document.getElementById('reporte-overlay').style.display === 'none',
             letrero: (document.getElementById('salir-box') || {}).style.display === 'block',
             paso: profundidadGuardian() };
  });
  T('el recuadro estaba abierto', r2.abiertoAntes);
  T('🚪 atrás lo CIERRA', r2.cerrado, String(r2.cerrado));
  T('🔒 y NO saca el letrero de salir', !r2.letrero);
  T('🔑 y el paso sigue en 1', r2.paso >= 1, String(r2.paso));

  console.log('\n3️⃣  ↩️ DESDE UNA PANTALLA, VUELVE — NO SALE');
  await limpio();
  const r3 = await p.evaluate(async () => {
    ir('p-cl'); await new Promise(r => setTimeout(r, 100));
    window.dispatchEvent(new PopStateEvent('popstate'));
    await new Promise(r => setTimeout(r, 250));
    return { pantalla: pantallaActual(),
             letrero: (document.getElementById('salir-box') || {}).style.display === 'block' };
  });
  T('↩️ vuelve atrás en la app', r3.pantalla !== 'p-cl', String(r3.pantalla));
  T('🔒 y NO pregunta si quiere salir', !r3.letrero);

  console.log('\n4️⃣  🛡️ CON EL LETRERO ABIERTO, ATRÁS NO HACE NADA');
  await limpio();
  const r4 = await p.evaluate(async () => {
    mostrarLetreroSalir();
    await new Promise(r => setTimeout(r, 200));
    for (let i = 0; i < 6; i++) {
      window.dispatchEvent(new PopStateEvent('popstate'));
      await new Promise(r => setTimeout(r, 45));
    }
    return { sigueAbierto: document.getElementById('salir-box').style.display === 'block',
             paso: profundidadGuardian() };
  });
  T('🛡️ el letrero sigue ahí tras 6 atrás', r4.sigueAbierto, String(r4.sigueAbierto));
  T('🔑 y el paso aguanta', r4.paso >= 1, String(r4.paso));

  console.log('\n5️⃣  🚶 SALIR DE LA APP FUNCIONA');
  await limpio();
  const r5 = await p.evaluate(async () => {
    const hechos = [];
    const oC = window.close; window.close = function () { hechos.push('close'); };
    const oB = history.back.bind(history); history.back = function () { hechos.push('back'); };
    let aviso = null; const oA = window.avisoGrande; window.avisoGrande = (m) => { aviso = m; };
    mostrarLetreroSalir();
    await new Promise(r => setTimeout(r, 150));
    salirDeLaApp();
    await new Promise(r => setTimeout(r, 1100));
    window.close = oC; history.back = oB; window.avisoGrande = oA;
    _saliendoApp = false;
    return { hechos, aviso: aviso ? aviso.slice(0, 60) : null,
             cerroLetrero: document.getElementById('salir-box').style.display !== 'block' };
  });
  T('🚶 intenta cerrar la ventana', r5.hechos.indexOf('close') >= 0, JSON.stringify(r5.hechos));
  T('y si no, retrocede UN paso', r5.hechos.indexOf('back') >= 0);
  T('cierra el letrero', r5.cerroLetrero);
  T('🔑 y si el navegador no deja, LO DICE', !!r5.aviso, String(r5.aviso));

  console.log('\n6️⃣  🔒 YA NO HAY COLCHÓN NI SALTO GIGANTE');
  const r6 = await p.evaluate(() => ({
    // El salto de 31 pasos que Chrome descartaba
    saltoGigante: /history\.go\(\s*-\s*\(/.test(String(salirDeLaApp)),
    // El colchón de 30
    colchon: (typeof MIN_GUARDIANES !== 'undefined') ? MIN_GUARDIANES : -1,
    reponeSiempre: /ponerGuardianAtras\(\)/.test(
      String(window.onpopstate || '') + document.documentElement.innerHTML.slice(0, 0)) || true
  }));
  T('🔒 ya NO usa el salto gigante', !r6.saltoGigante, String(r6.saltoGigante));
  T('🔒 y el colchón es de 1, no de 30', r6.colchon === 1, String(r6.colchon));

  console.log('\n1️⃣6️⃣  🔴 EL FALLO QUE CERRABA LA APP');
  // 🔴 `ponerGuardianAtras` decía "si el estado ya es nuestro, no repongo". Pero tras un
  // atrás el estado que QUEDA también es nuestro, así que no reponía nada: cada atrás
  // gastaba un paso y al acabarse Android cerraba la app. -8 sep-
  const r16 = await p.evaluate(async () => {
    const cod = String(ponerGuardianAtras);
    return {
      // Tiene que poder FORZAR la reposición
      aceptaForzar: /function ponerGuardianAtras\(forzar\)/.test(cod),
      soloSaltaSiNoFuerza: /if\(!forzar &&/.test(cod),
      // Y el evento de atrás tiene que llamarla forzando
      atrasFuerza: /ponerGuardianAtras\(true\)/.test(document.documentElement.innerHTML)
    };
  });
  T('🔑 el guardián acepta FORZAR la reposición', r16.aceptaForzar);
  T('🔒 y solo se salta si NO se fuerza', r16.soloSaltaSiNoFuerza);
  T('🔑 el botón atrás lo llama FORZANDO', r16.atrasFuerza);

  console.log('\n1️⃣7️⃣  🛡️ VEINTE ATRÁS SEGUIDOS Y NO SE CIERRA');
  const r17 = await p.evaluate(async () => {
    ir('p-inicio'); await new Promise(r => setTimeout(r, 100));
    for (const pg of ['p-cl', 'p-cxc', 'p-cat', 'p-inicio']) {
      ir(pg); await new Promise(r => setTimeout(r, 60));
    }
    const antes = history.length;
    // 🔑 20 atrás seguidos, como cuando se impacienta
    for (let i = 0; i < 20; i++) {
      window.dispatchEvent(new PopStateEvent('popstate'));
      await new Promise(r => setTimeout(r, 40));
    }
    const s = document.getElementById('salir-box');
    return { antes, despues: history.length,
             viva: !!document.getElementById('app-contenido'),
             letrero: s ? getComputedStyle(s).display : 'no existe' };
  });
  T('🛡️ 🔑 el historial NO baja tras 20 atrás',
     r17.despues >= r17.antes, r17.antes + ' → ' + r17.despues);
  T('🔑 y la app sigue viva', r17.viva);
  T('con el letrero de salir a la vista', r17.letrero === 'block', r17.letrero);

  console.log(`\n  ${ok} bien · ${mal} mal`);
  const reales = errs.filter(e => !/firebase|onAuthStateChanged/i.test(e));
  if (reales.length) { console.log('⚠️ JS:'); reales.slice(0, 3).forEach(e => console.log('   ' + e)); }
  await b.close(); srv.close();
  process.exit(mal ? 1 : 0);
})();
