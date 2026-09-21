/**
 * 🔒 LA PANTALLA DE BLOQUEO — LA SALIDA DE EMERGENCIA  (8 sep 2026)
 *
 * 🔴 EL 8 SEP SENSEI SE QUEDÓ FUERA DE SU PROPIA APP. La pantalla solo mostraba el
 * escudo y "Pon tu huella para entrar…": ni botón, ni enlace, nada. Reinició el
 * teléfono y siguió igual. Tuvo que entrar en modo incógnito con correo y contraseña.
 *
 * LA CAUSA: si el lector de huella no responde —ni acierta ni falla— no se ejecuta ni
 * el .then ni el .catch, y los dos botones estaban escondidos esperando.
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

  console.log('\n1️⃣  🔑 SIEMPRE HAY UNA FORMA DE ENTRAR');
  const r1 = await p.evaluate(async () => {
    localStorage.setItem(CLAVE_HUELLA_ID, 'aGVsbG8=');
    // 🔑 El caso real: el lector que NUNCA contesta
    Object.defineProperty(navigator, 'credentials', {
      value: { get: function () { return new Promise(function () {}); } }, configurable: true });
    bloquearApp();
    await new Promise(r => setTimeout(r, 700));
    const b2 = document.getElementById('btn-contrasena');
    return { contra: b2 ? getComputedStyle(b2).display : 'no existe',
             alto: b2 ? Math.round(b2.getBoundingClientRect().height) : 0,
             texto: b2 ? b2.textContent.trim() : '' };
  });
  T('🔑 el enlace de contraseña se ve DESDE EL PRIMER SEGUNDO',
     r1.contra !== 'none' && r1.alto > 5, r1.contra + ' · ' + r1.alto + 'px');
  T('y dice para qué sirve', /correo|contrase/i.test(r1.texto), r1.texto);

  console.log('\n2️⃣  ⏱️ SI EL LECTOR NO RESPONDE, SALEN LOS BOTONES');
  const r2 = await p.evaluate(async () => {
    window._msRelojHuella = 1200;   // en la app real son 8 segundos
    bloquearApp();
    await new Promise(r => setTimeout(r, 600));
    const antes = document.getElementById('btn-huella').style.display;
    await new Promise(r => setTimeout(r, 1500));
    return { antes,
             despues: document.getElementById('btn-huella').style.display,
             msg: document.getElementById('bloqueo-msg').textContent };
  });
  T('🔑 el botón ya está a la vista desde el principio', r2.antes !== 'none', r2.antes);
  T('⏱️ 🔑 pero a los pocos segundos APARECE', r2.despues !== 'none', r2.despues);
  T('y el mensaje dice qué hacer', /toca|huella/i.test(r2.msg), r2.msg);

  console.log('\n3️⃣  🔒 LA SEGURIDAD NO BAJA');
  const r3 = await p.evaluate(() => ({
    // Sigue haciendo falta huella o contraseña: los botones no entran solos
    pideHuella: /credentials\.get/.test(String(desbloquearConHuella)),
    contraCierraSesion: /signOut/.test(String(usarContrasenaEnVezDeHuella)),
    // El reloj NO desbloquea nada, solo enseña los botones
    relojNoEntra: !/\_appBloqueada\s*=\s*false/.test(String(mostrarOpcionesDeBloqueo))
  }));
  T('🔒 sigue pidiendo la huella de verdad', r3.pideHuella);
  T('🔒 la otra vía cierra sesión y pide correo', r3.contraCierraSesion);
  T('🔒 el reloj NO desbloquea: solo enseña los botones', r3.relojNoEntra);

  console.log('\n4️⃣  ✅ SI LA HUELLA SÍ RESPONDE, ENTRA');
  const r4 = await p.evaluate(async () => {
    Object.defineProperty(navigator, 'credentials', {
      value: { get: function () { return Promise.resolve({ id: 'x' }); } }, configurable: true });
    window._appInicializada = true;
    bloquearApp();
    await new Promise(r => setTimeout(r, 800));
    return { bloqueada: !!window._appBloqueada,
             pantalla: document.getElementById('pantalla-bloqueo').style.display };
  });
  T('✅ con la huella buena entra', !r4.bloqueada, String(r4.bloqueada));
  T('y la pantalla de bloqueo se quita', r4.pantalla === 'none', r4.pantalla);

  console.log('\n5️⃣  🔑 LA HUELLA NO DEPENDE DE LA SESIÓN');
  const r5b = await p.evaluate(() => {
    const cod = String(activarHuella);
    return {
      // 🔑 Antes se ataba al CORREO: si la sesión cambiaba, la huella dejaba de valer
      // y salía "No se reconoció la huella". Ahora va atada al aparato.
      usaIdFijo: /nbs_id_aparato/.test(cod),
      noUsaCorreoComoId: !/idUsuario\s*=\s*new TextEncoder\(\)\.encode\(correo/.test(cod)
    };
  });
  T('🔑 la huella se ata al APARATO, no al correo', r5b.usaIdFijo);
  T('🔒 y ya NO usa el correo como identificador', r5b.noUsaCorreoComoId);

  console.log('\n6️⃣  🛡️ EL CATÁLOGO NO TOCA LA SESIÓN');
  const fs = require('fs');
  const cat = fs.readFileSync('/home/claude/catalogo/catalogo_pedidos.html', 'utf8');
  // Se quitan los comentarios: la explicación del fallo menciona la palabra
  const catSinComentarios = cat.replace(/<!--[\s\S]*?-->/g, '');
  T('🛡️ el catálogo NO entra a Firebase', !/firebase\.initializeApp/.test(catSinComentarios));
  T('🔑 ni abre sesión de invitado', !/signInAnonymously/.test(catSinComentarios));
  T('🔒 esa era la causa de que la huella fallara', !/firebase-auth/.test(catSinComentarios));

  console.log('\n7️⃣  🗑️ LA HUELLA INSERVIBLE SE BORRA SOLA');
  // 🔴 EL FALLO REAL: cuando el teléfono rechazaba la credencial, la app la dejaba
  // guardada. Sensei tocaba "Intentar de nuevo" y reintentaba con la MISMA huella que
  // ya no valía — por eso "no hacía nada".
  const r7 = await p.evaluate(async () => {
    localStorage.setItem(CLAVE_HUELLA_ID, 'aGVsbG8=');
    localStorage.removeItem('nbs_fallos_huella');
    // El teléfono la rechaza como "no existe"
    Object.defineProperty(navigator, 'credentials', {
      value: { get: function () {
        const e = new Error('no credentials'); e.name = 'NotAllowedError';
        return Promise.reject(e);
      } }, configurable: true });
    window._appBloqueada = true;
    desbloquearConHuella();
    await new Promise(r => setTimeout(r, 500));
    return { borrada: !localStorage.getItem(CLAVE_HUELLA_ID),
             msg: (document.getElementById('bloqueo-msg') || {}).textContent || '',
             error: (document.getElementById('bloqueo-error') || {}).innerText || '',
             botonHuella: (document.getElementById('btn-huella') || {}).style.display,
             contra: (document.getElementById('btn-contrasena') || {}).style.display };
  });
  T('🗑️ 🔑 la huella inservible SE BORRA', r7.borrada, String(r7.borrada));
  T('y dice que ya no sirve', /ya no sirve/i.test(r7.msg), r7.msg);
  T('🔑 y le dice QUÉ HACER: activarla de nuevo', /vuelve a activar/i.test(r7.error),
     r7.error.slice(0, 70));
  T('🔒 esconde el botón de huella (reintentar no sirve)', r7.botonHuella === 'none', r7.botonHuella);
  T('🔑 y deja la contraseña VISIBLE', r7.contra !== 'none', r7.contra);

  console.log('\n8️⃣  🔒 LOS FALLOS NORMALES NO BORRAN LA HUELLA');
  const r8 = await p.evaluate(async () => {
    localStorage.setItem(CLAVE_HUELLA_ID, 'aGVsbG8=');
    localStorage.removeItem('nbs_fallos_huella');
    // Un error normal: el dedo no coincide
    Object.defineProperty(navigator, 'credentials', {
      value: { get: function () {
        const e = new Error('mismatch'); e.name = 'UnknownError';
        return Promise.reject(e);
      } }, configurable: true });
    const pasos = [];
    for (let i = 0; i < 3; i++) {
      window._appBloqueada = true;
      desbloquearConHuella();
      await new Promise(r => setTimeout(r, 350));
      pasos.push(!!localStorage.getItem(CLAVE_HUELLA_ID));
    }
    return { pasos, msg: (document.getElementById('bloqueo-msg') || {}).textContent || '' };
  });
  T('🔒 al primer fallo NO la borra (puede ser el dedo)', r8.pasos[0], JSON.stringify(r8.pasos));
  T('🔑 y al tercero TAMPOCO \u2014 es su dedo, no la huella', r8.pasos[2], JSON.stringify(r8.pasos));

  console.log('\n9️⃣  📱 LA HUELLA SE BUSCA EN EL PROPIO TELÉFONO');
  // 🔴 LA CAUSA REAL: al REGISTRAR se decía authenticatorAttachment:'platform' (el
  // lector del teléfono), pero al VERIFICAR no se decía nada. Android buscaba llaves
  // externas (USB, NFC), no encontraba ninguna, y fallaba SIN ABRIR EL LECTOR.
  // Por eso Sensei veía "No se reconoció" sin que saliera nunca el recuadro del dedo.
  const r9 = await p.evaluate(() => {
    const fuentes = [String(desbloquearConHuella), String(protegerConHuella)];
    return {
      // Los sitios que verifican tienen que decir que la credencial es INTERNA
      todosInternos: fuentes.every(f =>
        !/allowCredentials/.test(f) || /transports:\s*\['internal'\]/.test(f)),
      desbloqueo: /transports:\s*\['internal'\]/.test(fuentes[0]),
      proteger: !/allowCredentials/.test(fuentes[1]) || /transports:\s*\['internal'\]/.test(fuentes[1]),
      // Y el registro sigue pidiendo el lector del teléfono
      registroPlatform: /authenticatorAttachment:\s*'platform'/.test(String(activarHuella))
    };
  });
  T('📱 🔑 el desbloqueo busca la huella EN EL TELÉFONO', r9.desbloqueo, String(r9.desbloqueo));
  T('📱 y el PIN de las acciones de dinero también', r9.proteger, String(r9.proteger));
  T('🔒 y el registro sigue usando el lector del teléfono', r9.registroPlatform);
  T('🔑 TODOS los sitios que verifican, iguales', r9.todosInternos);

  console.log('\n🔟  ⚡ NO SE ESPERA NADA PARA ENTRAR');
  // 🔴 Sensei, 8 sep: "se puso super lenta la app para entrar, me ha hecho perder
  // muchísimo tiempo atendiendo los clientes". El reloj de 8 s le hacía mirar la
  // pantalla. Ahora las tres opciones salen de entrada.
  const r10 = await p.evaluate(async () => {
    localStorage.setItem(CLAVE_HUELLA_ID, 'aGVsbG8=');
    Object.defineProperty(navigator, 'credentials', {
      value: { get: function () { return new Promise(function () {}); } }, configurable: true });
    const t0 = performance.now();
    bloquearApp();
    await new Promise(r => setTimeout(r, 300));
    const v = id => { const e = document.getElementById(id);
                      return e ? getComputedStyle(e).display !== 'none' : false; };
    return { ms: Math.round(performance.now() - t0),
             huella: v('btn-huella'), pin: v('btn-pin-bloqueo'), correo: v('btn-contrasena') };
  });
  T('⚡ 🔑 el botón de huella se ve YA (no a los 8 s)', r10.huella, String(r10.huella));
  T('🔢 y el del PIN también', r10.pin, String(r10.pin));
  T('y el de correo', r10.correo, String(r10.correo));
  T('todo en menos de medio segundo', r10.ms < 500, r10.ms + ' ms');

  console.log('\n1️⃣1️⃣  ⏱️ NO PIDE NADA SI VUELVE ANTES DE 30 SEGUNDOS');
  const r11 = await p.evaluate(() => {
    const cod = String(document.body.innerHTML).length;  // solo para no optimizar
    return {
      segundos: typeof SEGUNDOS_PARA_BLOQUEAR !== 'undefined' ? SEGUNDOS_PARA_BLOQUEAR : null,
      // El código tiene que comparar el tiempo, no un simple "1"
      comparaTiempo: /SEGUNDOS_PARA_BLOQUEAR \* 1000/.test(document.documentElement.innerHTML)
    };
  });
  T('⏱️ 🔑 el límite son 30 segundos', r11.segundos === 30, String(r11.segundos));
  T('🔒 y de verdad compara cuánto estuvo fuera', r11.comparaTiempo);

  console.log(`\n  ${ok} bien · ${mal} mal`);
  const reales = errs.filter(e => !/firebase|onAuthStateChanged/i.test(e));
  if (reales.length) { console.log('⚠️ JS:'); reales.slice(0, 3).forEach(e => console.log('   ' + e)); }
  await b.close();
  process.exit(mal ? 1 : 0);
})();
