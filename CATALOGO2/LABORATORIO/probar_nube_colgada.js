/**
 * ☁️ PROBAR QUE LA NUBE NO SE QUEDE COLGADA EN SILENCIO  (4 sep 2026)
 *
 * Sensei: "ese error lleva más de 10 minutos, y le doy actualizar y dice lo mismo ya
 * 5 veces" — el aviso decía "quedan 6 pendientes pero NINGUNO dio error".
 *
 * 🔑 LA CAUSA: si comprimir o el envío a Firebase se quedan colgados, no llaman ni al
 * .then ni al .catch. No sube, no apunta fallo, y se queda esperando para siempre.
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

  console.log('\n1️⃣  ⏱️ HAY UN TOPE DE TIEMPO');
  const r1 = await p.evaluate(() => {
    const cod = String(subirPendientes);
    return {
      hayReloj: /_relojColgado\s*=\s*setTimeout/.test(cod),
      apunta: /code:\s*'se-colgo'/.test(cod),
      // 🔑 el reloj se declara ANTES de apuntarFallo, que lo usa
      ordenBueno: cod.indexOf('var _relojColgado') < cod.indexOf('var apuntarFallo'),
      loPara: /clearTimeout\(_relojColgado\)/.test(cod),
      segundos: (cod.match(/\}, (\d+)\);\s*\n\s*var alSubir/) || [])[1] || (/20000/.test(cod) ? '20000' : '?')
    };
  });
  T('⏱️ hay reloj de seguridad', r1.hayReloj);
  T('🔑 y apunta el fallo "se-colgo"', r1.apunta);
  T('🔑 el reloj se declara ANTES de usarse', r1.ordenBueno, String(r1.ordenBueno));
  T('se para cuando sube o cuando falla', r1.loPara);

  console.log('\n2️⃣  🔑 EL AVISO DICE QUÉ ESTÁ ATASCADO');
  const r2 = await p.evaluate(() => {
    const cod = String(reintentarYDecirmeElError);
    return {
      nombraLoAtascado: /LO QUE FALTA POR SUBIR/.test(cod),
      diceElTamano: /KB'\)/.test(cod) && /nombresPendientesDeSubir\(\)/.test(cod),
      tranquiliza: /TUS DATOS NO SE PIERDEN/.test(cod),
      // 🔑 espera MÁS que el tope del envío, o nunca vería el fallo
      esperaSuficiente: /\}, 22000\)/.test(cod)
    };
  });
  T('🔑 nombra lo que falta por subir', r2.nombraLoAtascado);
  T('con su tamaño en KB', r2.diceElTamano);
  T('y avisa que los datos NO se pierden', r2.tranquiliza);
  T('🔑 espera 22 s, más que el tope de 20', r2.esperaSuficiente, String(r2.esperaSuficiente));

  console.log('\n3️⃣  💾 EL BOTÓN DE RESCATE');
  const r3 = await p.evaluate(async () => {
    mostrarAvisoConBackup('☁️ PRUEBA\n\nQuedan 3 pendientes.');
    await new Promise(r => setTimeout(r, 300));
    const ov = document.getElementById('aviso-backup-overlay');
    const botones = ov ? [...ov.querySelectorAll('button')].map(x => (x.textContent || '').trim()) : [];
    const res = {
      abrio: !!ov && ov.style.display === 'flex',
      alto: ov ? Math.round(ov.getBoundingClientRect().height) : 0,
      hayBackup: botones.some(x => /Bajar un backup/.test(x)),
      llamaExportD: ov ? /exportD\(\)/.test(ov.innerHTML) : false,
      texto: ov ? (ov.innerText || '').slice(0, 40) : ''
    };
    cerrarAvisoConBackup();
    res.cierra = document.getElementById('aviso-backup-overlay').style.display === 'none';
    return res;
  });
  T('💾 el aviso con rescate abre', r3.abrio && r3.alto > 100, r3.alto + ' px');
  T('🔑 tiene el botón de bajar backup', r3.hayBackup, r3.texto.replace(/\n/g, ' | '));
  T('y llama a exportD', r3.llamaExportD);
  T('se cierra bien', r3.cierra);

  console.log('\n4️⃣  🔙 EL BOTÓN ATRÁS LO CIERRA');
  const r4 = await p.evaluate(() => ({
    enLista: RECUADROS_ENCIMA.some(x => x.id === 'aviso-backup-overlay'),
    cierra: typeof cerrarAvisoConBackup === 'function'
  }));
  T('🔙 el recuadro está registrado', r4.enLista);
  T('y su función de cerrar existe', r4.cierra);

  console.log('\n5️⃣  🔒 LO QUE NO DEBE CAMBIAR');
  const r5 = await p.evaluate(() => {
    const cod = String(subirPendientes);
    return {
      sigueComprimiendo: /comprimirTexto\(docPend\.valor\)/.test(cod),
      sigueElTope: /TOPE_NUBE = 1000000/.test(cod),
      firmasAparte: /quitarFirmas\(vv\)/.test(cod),
      fotosAparte: /quitarFotos\(pp\)/.test(cod)
    };
  });
  T('🔒 sigue comprimiendo lo grande', r5.sigueComprimiendo);
  T('🔒 sigue el tope de 1 MB', r5.sigueElTope);
  T('🔒 las firmas siguen viajando aparte', r5.firmasAparte);
  T('🔒 y las fotos también', r5.fotosAparte);

  console.log(`\n  ${ok} bien · ${mal} mal`);
  const reales = errs.filter(e => !/firebase|onAuthStateChanged/i.test(e));
  if (reales.length) { console.log('⚠️ JS:'); reales.slice(0, 4).forEach(e => console.log('   ' + e)); }
  await b.close();
  process.exit(mal || reales.length ? 1 : 0);
})();
