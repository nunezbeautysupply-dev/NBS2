/**
 * 📤 PROBAR LAS CUATRO FORMAS DE MANDARLE EL MENSAJE
 *
 * Sensei, 3 sep: "me gustaría poder copiarlo también... hay clientes que no tienen
 * WhatsApp y tengo que enviárselo por mensaje regular, pero la opción de WhatsApp
 * directa debe permanecer también".
 * Y: "a veces me da error y tengo que darle para atrás e intentarlo de nuevo".
 */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 1100 },
    userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S911U) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36' });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file:///home/claude/trabajo/index.html');
  await p.waitForTimeout(2600);
  let ok = 0, mal = 0;
  const T = (n, c, d) => { if (c) { ok++; console.log('  ✅ ' + n); } else { mal++; console.log('  ❌ ' + n + (d ? '  →  ' + d : '')); } };

  const sembrar = () => p.evaluate(() => {
    ['pantalla-login', 'pantalla-bloqueo'].forEach(id => {
      const e = document.getElementById(id); if (e) e.style.display = 'none';
    });
    document.getElementById('app-contenido').style.display = 'block';
    localStorage.setItem('ncl', JSON.stringify([
      { id: 26, nombre: 'Carlos', apellido: 'Tavarez', negocio: 'LUXURY BARBER', tel: '4015168653' },
      { id: 27, nombre: 'Ana', apellido: 'Solis', negocio: 'AL DIA', tel: '' }]));
    localStorage.setItem('nv', JSON.stringify([
      { id: 301, cid: 26, cn: 'Carlos', tipo: 'credito', fecha: '07/01/2026', numFactura: '0301',
        total: 262, ganancia: 60, items: [{ nombre: 'Gel', cant: 1, precio: 262, costo: 202 }],
        pagosFactura: [{ pid: 'x', recibo: 'R1', montoCobro: 120, monto: 120, fecha: '07/10/2026' }] },
      { id: 302, cid: 26, cn: 'Carlos', tipo: 'credito', fecha: '08/01/2026', numFactura: '0302',
        total: 140, ganancia: 40, items: [{ nombre: 'Clip', cant: 1, precio: 140, costo: 100 }], pagosFactura: [] }]));
    clientes = LS('ncl', []); ventas = LS('nv', []);
  });
  await sembrar();

  console.log('\n1️⃣  🔴 EL ENLACE YA NO LLEVA EL TEXTO TRIPLICADO');
  const r1 = await p.evaluate(() => {
    const corto = textoCortoParaCliente(26, 120);
    const largo = textoEstadoDeCuenta(26);
    const eC = _linkWhatsApp('4015168653', corto);
    const eL = _linkWhatsApp('4015168653', largo);
    return {
      cortoTexto: corto.length, cortoEnlace: eC.length,
      largoTexto: largo.length, largoEnlace: eL.length,
      vecesCorto: (eC.match(/Hola%20Sr/g) || []).length,
      vecesLargo: (eL.match(/NUNEZ%20BEAUTY/g) || []).length,
      respaldoSinTexto: !/browser_fallback_url=https%3A%2F%2Fwa\.me%2F\d+%3Ftext/.test(eL)
    };
  });
  console.log('     corto: ' + r1.cortoTexto + ' letras → enlace de ' + r1.cortoEnlace);
  console.log('     largo: ' + r1.largoTexto + ' letras → enlace de ' + r1.largoEnlace);
  T('🔑 el texto va UNA sola vez (corto)', r1.vecesCorto === 1, String(r1.vecesCorto));
  T('🔑 el texto va UNA sola vez (largo)', r1.vecesLargo === 1, String(r1.vecesLargo));
  T('🔑 el respaldo va SIN texto', r1.respaldoSinTexto);
  T('🔑 el enlace del largo baja de 1500', r1.largoEnlace < 1500, String(r1.largoEnlace));
  T('🔒 y sigue pidiendo WhatsApp Business',
     await p.evaluate(() => /package=com\.whatsapp\.w4b/.test(_linkWhatsApp('4015168653', 'x'))));

  console.log('\n2️⃣  📤 LA PANTALLA DE LAS CUATRO FORMAS');
  const r2 = await p.evaluate(async () => {
    comoMandarloAlCliente(26, 'Hola Sr. Carlos,\n\nSu balance pendiente es de $142.00.', 'Balance');
    await new Promise(r => setTimeout(r, 300));
    const ov = document.getElementById('como-mandar-overlay');
    const btns = [...ov.querySelectorAll('button')].map(x => (x.textContent || '').trim());
    return { abrio: !!ov && ov.style.display === 'flex', btns, texto: ov.innerText };
  });
  T('la pantalla abre', r2.abrio);
  T('💬 está WhatsApp', r2.btns.some(x => /WhatsApp/.test(x)));
  T('💌 está Texto', r2.btns.some(x => /Texto/.test(x)));
  T('📋 está Copiar', r2.btns.some(x => /Copiar/.test(x)));
  T('📤 está Compartir', r2.btns.some(x => /Compartir/.test(x)));
  T('enseña el mensaje antes de mandarlo', /balance pendiente es de \$142\.00/.test(r2.texto));
  T('y dice de quién es', /Carlos Tavarez/.test(r2.texto));
  T('con su teléfono bien escrito', /\+1 \(401\) 516-8653/.test(r2.texto), r2.texto.slice(0, 90).replace(/\n/g, ' | '));

  console.log('\n3️⃣  🔑 EL MENSAJE SE COPIA SIEMPRE, ANTES DE MANDAR');
  const r3 = await p.evaluate(async () => {
    let copiado = null;
    const oc = navigator.clipboard;
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true, value: { writeText: (t) => { copiado = t; return Promise.resolve(); } } });
    const texto = 'Hola Sr. Carlos, su balance es $142.00';
    window._textoParaMandar = texto;
    // 📋 Copiar
    const oa = window.alert; window.alert = () => {};
    copiarMensajeDelCliente(texto);
    const porCopiar = copiado; copiado = null;
    // 💌 SMS — también copia antes
    try { enviarPorSMSACliente(26, texto); } catch (e) {}
    const porSMS = copiado; copiado = null;
    window.alert = oa;
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: oc });
    return { porCopiar, porSMS };
  });
  T('📋 Copiar copia el mensaje', r3.porCopiar === 'Hola Sr. Carlos, su balance es $142.00', String(r3.porCopiar));
  T('🛡️ y el SMS también lo copia antes, por si falla', r3.porSMS === 'Hola Sr. Carlos, su balance es $142.00', String(r3.porSMS));

  console.log('\n4️⃣  🔑 EL RENGLÓN DESPLEGABLE EN LA FICHA');
  await sembrar();
  const r4 = await p.evaluate(async () => {
    verCl(26); await new Promise(r => setTimeout(r, 400));
    const pg = document.getElementById('p-cl-perfil');
    const fila = [...pg.querySelectorAll('[onclick*="togglePanelCl"]')]
      .find(x => /Mandarle su balance/.test(x.textContent || ''));
    if (!fila) return { hay: false };
    const antes = pg.innerText.indexOf('Su balance en corto') >= 0;
    fila.click(); await new Promise(r => setTimeout(r, 300));
    const despues = pg.innerText.indexOf('Su balance en corto') >= 0;
    return { hay: true, cerradoAlPrincipio: !antes, abreAlTocarlo: despues,
             dice: (fila.textContent || '').trim().slice(0, 46) };
  });
  T('🔑 el renglón está en la ficha', r4.hay, r4.dice);
  T('🔑 y viene CERRADO (compacto, como pidió)', r4.cerradoAlPrincipio, String(r4.cerradoAlPrincipio));
  T('🔑 al tocarlo se abre', r4.abreAlTocarlo, String(r4.abreAlTocarlo));

  console.log('\n5️⃣  💬 EL MENSAJE DEL BALANCE, SIN VENDER NADA');
  const r5 = await p.evaluate(() => {
    let visto = null;
    const o = window.comoMandarloAlCliente;
    window.comoMandarloAlCliente = function (cid, texto) { visto = texto; };
    mandarSuBalance(26, 0);
    const corto = visto; visto = null;
    mandarSuBalance(26, 1);
    const largo = visto;
    window.comoMandarloAlCliente = o;
    return { corto, largo };
  });
  console.log('     ' + (r5.corto || '').replace(/\n/g, ' | '));
  T('💬 el corto saluda con Sr.', /^Hola Sr\. Carlos/.test(r5.corto || ''));
  T('🔑 dice su balance: $282.00', /balance pendiente es de \$282\.00/.test(r5.corto || ''), (r5.corto||'').slice(0,70));
  T('🔒 y NO habla de un pago de hoy', !/Pago de hoy/.test(r5.corto || ''), (r5.corto || '').slice(0, 60));
  T('👔 pide confirmar', /Favor confirmar/.test(r5.corto || ''));
  T('🧾 y el completo trae el estado de cuenta', /NUNEZ BEAUTY/.test(r5.largo || ''));

  console.log('\n6️⃣  🔒 UN CLIENTE SIN TELÉFONO NO SE QUEDA COLGADO');
  const r6 = await p.evaluate(async () => {
    let dicho = null, copiado = null;
    const oc = navigator.clipboard;
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true, value: { writeText: (t) => { copiado = t; return Promise.resolve(); } } });
    const oav = window.avisoGrande; window.avisoGrande = (m) => { dicho = m; };
    enviarPorWhatsAppACliente(27, 'Hola Sr. Ana, su cuenta está al día.');
    window.avisoGrande = oav;
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: oc });
    return { dicho, copiado };
  });
  T('🔒 le avisa que no tiene teléfono', /no tiene tel/i.test(r6.dicho || ''), (r6.dicho || '').slice(0, 60));
  T('🔒 y le copia el mensaje igual', /Hola Sr\. Ana/.test(r6.copiado || ''), String(r6.copiado));

  console.log('\n7️⃣  📤 EL BOTONCITO EN CUENTAS POR COBRAR');
  await sembrar();
  const r7 = await p.evaluate(async () => {
    ir('p-cxc'); await new Promise(r => setTimeout(r, 200));
    renderCxC('');            // ⚠️ hay que llamarla: irACuentasPorCobrar no repinta con datos nuevos
    await new Promise(r => setTimeout(r, 350));
    const b = document.querySelector('#cxc-lista [data-mandar], [data-mandar]');
    return { hay: !!b, engachado: !!(b && b.onclick) };
  });
  T('🔑 el botoncito está en la tarjeta', r7.hay, String(r7.hay));
  T('🔑 y hace algo al tocarlo', r7.engachado, String(r7.engachado));

  console.log('\n8️⃣  🔙 EL BOTÓN ATRÁS LO CIERRA');
  const r8 = await p.evaluate(() => ({
    enLista: RECUADROS_ENCIMA.some(x => x.id === 'como-mandar-overlay'),
    tieneCierre: typeof cerrarComoMandar === 'function'
  }));
  T('🔙 el recuadro está registrado', r8.enLista);
  T('y su función de cerrar existe', r8.tieneCierre);

  console.log('\n9️⃣  🔑 TODOS LOS BOTONES DE SIEMPRE OFRECEN LAS CUATRO');
  await sembrar();
  const r9 = await p.evaluate(async () => {
    // Se llama a la función que usan TODOS los botones viejos (el comprobante, el
    // corto, el estado de cuenta) y se comprueba que abra la pantalla de las cuatro.
    cerrarComoMandar();
    mandarloAlCliente(26, 'Hola Sr. Carlos, su balance es $282.00', 'Balance');
    await new Promise(r => setTimeout(r, 300));
    const ov = document.getElementById('como-mandar-overlay');
    const abrio = !!ov && ov.style.display === 'flex';
    const btns = abrio ? [...ov.querySelectorAll('button')].map(x => (x.textContent || '').trim()) : [];
    return { abrio, tieneLasCuatro:
      btns.some(x => /WhatsApp/.test(x)) && btns.some(x => /Texto/.test(x)) &&
      btns.some(x => /Copiar/.test(x)) && btns.some(x => /Compartir/.test(x)) };
  });
  T('🔑 mandarloAlCliente OFRECE las cuatro formas', r9.abrio, String(r9.abrio));
  T('🔑 y están las cuatro', r9.tieneLasCuatro, String(r9.tieneLasCuatro));

  console.log('\n🔟  💌 EL SMS LLEVA EL MENSAJE ESCRITO');
  const r10 = await p.evaluate(() => {
    // Se mira el código: el enlace del SMS tiene que llevar el body con el texto.
    const codigo = String(enviarPorSMSACliente);
    return {
      llevaBody: /body=.{0,4}encodeURIComponent/.test(codigo),
      llevaTelefono: /'sms:\+' \+ tel/.test(codigo),
      distingueElTelefono: /esAndroid\(\)/.test(codigo)
    };
  });
  T('🔑 el enlace del SMS lleva el mensaje dentro', r10.llevaBody, String(r10.llevaBody));
  T('y va al teléfono del cliente', r10.llevaTelefono);
  T('🔒 usa ? en Android y & en iPhone', r10.distingueElTelefono);

  console.log('\n1️⃣1️⃣  📅 EL MENSAJE NOMBRA EL PAGO SEGÚN CUÁNDO FUE');
  const r11 = await p.evaluate(() => {
    const hoy = fechaHoy();
    localStorage.setItem('ncl', JSON.stringify([
      { id: 1, nombre: 'Carlos', apellido: 'Tavarez', negocio: 'LUXURY', tel: '4015168653' },
      { id: 2, nombre: 'Jorge', apellido: 'Duarte', negocio: 'GRAN VIA', tel: '4015550002' },
      { id: 3, nombre: 'Ana', apellido: 'Solis', negocio: 'AL DIA', tel: '4015550003' }]));
    localStorage.setItem('nv', JSON.stringify([
      // Carlos: le pagó la SEMANA PASADA
      { id: 1, cid: 1, cn: 'Carlos', tipo: 'credito', fecha: '08/01/2026', total: 262, ganancia: 60,
        items: [], pagosFactura: [{ pid: 'a', recibo: 'R1', montoCobro: 120, monto: 120, fecha: '08/25/2026' }] },
      // Jorge: NUNCA ha pagado
      { id: 2, cid: 2, cn: 'Jorge', tipo: 'credito', fecha: '08/10/2026', total: 80, ganancia: 20,
        items: [], pagosFactura: [] },
      // Ana: le pagó HOY y quedó al día
      { id: 3, cid: 3, cn: 'Ana', tipo: 'credito', fecha: '08/15/2026', total: 90, ganancia: 25,
        items: [], pagosFactura: [{ pid: 'c', monto: 90, fecha: hoy }] }]));
    clientes = LS('ncl', []); ventas = LS('nv', []);
    return {
      viejo: textoCortoParaCliente(1, 0),
      nunca: textoCortoParaCliente(2, 0),
      alDia: textoCortoParaCliente(3, 0),
      recien: textoCortoParaCliente(1, 100)
    };
  });
  console.log('     pago de otro día: ' + (r11.viejo || '').split('\n')[2]);

  // ① El pago fue otro día → "Su último pago: $X del <fecha>"
  T('📅 pago viejo: dice "Su último pago"', /Su \u00faltimo pago: \$120\.00|Su último pago: \$120\.00/.test(r11.viejo || ''), (r11.viejo||'').slice(0,60).replace(/\n/g,' | '));
  T('📅 y CON su fecha: del 08/25/2026', /del 08\/25\/2026/.test(r11.viejo || ''));
  T('🔑 y NO dice "pago de hoy" — ese era el fallo', !/[Pp]ago de hoy/.test(r11.viejo || ''), (r11.viejo||'').slice(0,70).replace(/\n/g,' | '));

  // ② Nunca pagó → no se habla de pagos
  T('🔒 si nunca pagó, no nombra ningún pago',
     !/pago/i.test((r11.nunca || '').split('balance')[0]), (r11.nunca||'').slice(0,60).replace(/\n/g,' | '));
  T('y va derecho al balance: $80.00', /balance pendiente es de \$80\.00/.test(r11.nunca || ''));

  // ③ El pago es de HOY → "Recibí su pago"
  T('📅 pago de hoy: dice "Recibí su pago de $90.00"', /Recib\u00ed su pago de \$90\.00|Recibí su pago de \$90\.00/.test(r11.alDia || ''), (r11.alDia||'').slice(0,60).replace(/\n/g,' | '));
  T('🔒 y sin repetir la fecha (es hoy)', !/del \d{2}\/\d{2}\/\d{4}/.test(r11.alDia || ''));
  T('🔒 al día: no pide confirmar deuda', /al d\u00eda|al día/.test(r11.alDia || ''));

  // ④ Se le acaba de cobrar → manda ese monto
  T('📅 recién cobrado: "Recibí su pago de $100.00"', /Recib\u00ed su pago de \$100\.00|Recibí su pago de \$100\.00/.test(r11.recien || ''), (r11.recien||'').slice(0,60).replace(/\n/g,' | '));
  T('🔑 y NO nombra el pago viejo de $120', !/120\.00/.test(r11.recien || ''));

  console.log('\n1️⃣2️⃣  🔑 ultimoPagoDelCliente ENCUENTRA EL BUENO');
  const r12 = await p.evaluate(() => {
    localStorage.setItem('nv', JSON.stringify([
      { id: 1, cid: 1, cn: 'C', tipo: 'credito', fecha: '07/01/2026', total: 200, ganancia: 50, items: [],
        pagosFactura: [{ pid: 'a', monto: 50, fecha: '07/10/2026' },
                       { pid: 'b', monto: 30, fecha: '08/25/2026' },        // el más nuevo
                       { pid: 'c', monto: 900, fecha: '09/01/2026', esDevolucion: true }] }]));
    ventas = LS('nv', []);
    const u = ultimoPagoDelCliente(1);
    // Y uno que se repartió: el cobro COMPLETO manda, no la parte
    localStorage.setItem('nv', JSON.stringify([
      { id: 2, cid: 2, cn: 'J', tipo: 'credito', fecha: '07/01/2026', total: 100, ganancia: 20, items: [],
        pagosFactura: [{ pid: 'x', recibo: 'R9', montoCobro: 80, monto: 35, fecha: '08/20/2026' }] }]));
    ventas = LS('nv', []);
    const rep = ultimoPagoDelCliente(2);
    // Y uno sin pagos
    localStorage.setItem('nv', JSON.stringify([
      { id: 3, cid: 3, cn: 'A', tipo: 'credito', fecha: '07/01/2026', total: 50, ganancia: 10, items: [], pagosFactura: [] }]));
    ventas = LS('nv', []);
    const sin = ultimoPagoDelCliente(3);
    return { u, rep, sin };
  });
  T('🔑 coge el pago MÁS NUEVO ($30 del 08/25)', r12.u && r12.u.monto === 30 && r12.u.fecha === '08/25/2026', JSON.stringify(r12.u));
  T('🔒 y NO cuenta la devolución de $900', r12.u && r12.u.monto !== 900);
  T('🔑 en un cobro repartido dice el COMPLETO ($80), no la parte', r12.rep && r12.rep.monto === 80, JSON.stringify(r12.rep));
  T('🔒 si nunca pagó, devuelve nada', r12.sin === null, String(r12.sin));

  console.log('\n1️⃣3️⃣  🔴 DESDE EL ESTADO DE CUENTA (lo que reportó Sensei)');
  const r13 = await p.evaluate(async () => {
    localStorage.setItem('ncl', JSON.stringify([
      { id: 9, nombre: 'Yordy', apellido: 'Correa', negocio: 'TRUE STYLES', tel: '4015551234' }]));
    localStorage.setItem('nv', JSON.stringify([
      { id: 373, cid: 9, cn: 'Y', tipo: 'credito', fecha: '08/07/2026', numFactura: '0373',
        total: 200, ganancia: 60, items: [],
        pagosFactura: [{ pid: 'a', recibo: 'R1', montoCobro: 50, monto: 45, fecha: '09/04/2026' }] },
      { id: 629, cid: 9, cn: 'Y', tipo: 'credito', fecha: '09/04/2026', numFactura: '0629',
        total: 12, ganancia: 4, items: [], pagosFactura: [] }]));
    clientes = LS('ncl', []); ventas = LS('nv', []);
    verCl(9); await new Promise(r => setTimeout(r, 400));
    abrirEstadoDeCuenta(9); await new Promise(r => setTimeout(r, 400));

    const res = {};
    // ① El botón de ARRIBA
    compartirEstadoDeCuenta();
    await new Promise(r => setTimeout(r, 400));
    let ov = document.getElementById('como-mandar-overlay');
    const est = document.getElementById('estado-cuenta-overlay');
    res.arriba = {
      abrio: !!ov,
      alto: ov ? Math.round(ov.getBoundingClientRect().height) : 0,
      // 🔑 El fallo era este: empataban a 99999 y salía DETRÁS
      zMandar: ov ? parseInt(getComputedStyle(ov).zIndex, 10) : 0,
      zEstado: est ? parseInt(getComputedStyle(est).zIndex, 10) : 0
    };
    cerrarComoMandar();
    await new Promise(r => setTimeout(r, 200));

    // ② El botón de ABAJO — el que se cortaba en el confirm
    let huboConfirm = false;
    const oc = window.confirm;
    window.confirm = function () { huboConfirm = true; return false; };  // dice que NO
    compartirCortoDesdeEstado();
    await new Promise(r => setTimeout(r, 400));
    window.confirm = oc;
    ov = document.getElementById('como-mandar-overlay');
    res.abajo = {
      huboConfirm,
      abrio: !!ov && getComputedStyle(ov).display !== 'none',
      alto: ov ? Math.round(ov.getBoundingClientRect().height) : 0,
      texto: ov ? (ov.innerText || '').slice(0, 60) : ''
    };
    return res;
  });
  console.log('     arriba: z ' + r13.arriba.zMandar + ' vs estado de cuenta z ' + r13.arriba.zEstado);
  T('🔑 el de ARRIBA abre y SE VE', r13.arriba.abrio && r13.arriba.alto > 100, r13.arriba.alto + ' px');
  T('🔑 y sale POR ENCIMA del estado de cuenta',
     r13.arriba.zMandar > r13.arriba.zEstado, r13.arriba.zMandar + ' > ' + r13.arriba.zEstado);
  T('🔑 el de ABAJO ya NO pregunta con confirm', !r13.abajo.huboConfirm, String(r13.abajo.huboConfirm));
  T('🔑 abre y SE VE aunque el confirm diga que no',
     r13.abajo.abrio && r13.abajo.alto > 100, r13.abajo.alto + ' px');
  T('con el mensaje dentro', /Yordy/.test(r13.abajo.texto), r13.abajo.texto.replace(/\n/g, ' | '));

  console.log(`\n  ${ok} bien · ${mal} mal`);
  const reales = errs.filter(e => !/firebase|onAuthStateChanged/i.test(e));
  if (reales.length) { console.log('⚠️ JS:'); reales.slice(0, 4).forEach(e => console.log('   ' + e)); }
  await b.close();
  process.exit(mal || reales.length ? 1 : 0);
})();
