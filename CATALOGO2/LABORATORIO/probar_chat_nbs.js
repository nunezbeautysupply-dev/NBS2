/**
 * 💬 NBS CHAT — EL LADO DE SENSEI  (18 sep 2026)
 *
 * El barbero ya tiene su puerta (CHAT_index.html). Aquí se prueba el lado de
 * Sensei dentro de NBS2: el globito, la lista, el hilo, contestar, dar acceso
 * y quitar/devolver. Y lo más importante: que el chat NO toque ni un centavo.
 */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file:///home/claude/trabajo/index.html');
  await p.waitForTimeout(2800);
  let ok = 0, mal = 0;
  const T = (n, c, d) => { if (c) { ok++; console.log('  ✅ ' + n); } else { mal++; console.log('  ❌ ' + n + (d ? '  →  ' + d : '')); } };

  console.log('\n1️⃣  💬 LAS PIEZAS DEL CHAT EXISTEN');
  const r1 = await p.evaluate(() => ({
    abrir: typeof abrirChatNBS === 'function',
    lista: typeof cargarListaChatNBS === 'function',
    hilo: typeof abrirConversacionNBS === 'function',
    mandar: typeof mandarMensajeNBS === 'function',
    dar: typeof abrirDarAccesoChat === 'function',
    guardar: typeof guardarAccesoChat === 'function',
    accesos: typeof abrirAccesosChat === 'function',
    toggle: typeof toggleAccesoChat === 'function',
    globo: typeof revisarChatSinLeer === 'function',
    botonInicio: !!document.querySelector('button[onclick="abrirChatNBS()"]'),
    globoInicio: !!document.getElementById('chatnbs-globo')
  }));
  T('abrirChatNBS existe', r1.abrir);
  T('la lista, el hilo y el enviar existen', r1.lista && r1.hilo && r1.mandar);
  T('dar acceso, guardarlo y verlos existen', r1.dar && r1.guardar && r1.accesos && r1.toggle);
  T('el contador del globito existe', r1.globo);
  T('🏠 el botón está en la pantalla de inicio', r1.botonInicio);
  T('🔴 con su globito rojo', r1.globoInicio);

  console.log('\n2️⃣  🔒 SIN INTERNET, EL CHAT NO ROMPE NADA');
  const r2 = await p.evaluate(async () => {
    ['pantalla-login', 'pantalla-bloqueo'].forEach(id => {
      const e = document.getElementById(id); if (e) e.style.display = 'none';
    });
    document.getElementById('app-contenido').style.display = 'block';
    window.fbDb = null;
    let peto = false;
    try { revisarChatSinLeer(); abrirChatNBS(); } catch (e) { peto = true; }
    await new Promise(r => setTimeout(r, 200));
    const o = document.getElementById('chatnbs-overlay');
    const avisa = o && /internet/i.test(o.textContent);
    cerrarChatNBS();
    return { peto, avisa };
  });
  T('🔒 sin Firebase no revienta', !r2.peto);
  T('y avisa que necesita internet', r2.avisa);

  // ── El Firebase falso: buzones por clave, como el candado real (19 sep) ──
  await p.evaluate(() => {
    window._fake = {
      accesos: {},            // clave -> datos de la tarjeta
      buzones: {},            // clave -> [mensajes]
      escuchas: [],           // repintadores de onSnapshot por clave
      agregados: [],          // [{clave, m}] lo que se mandó con add()
      updatesAcceso: [],      // [{clave, campos}]
      updatesMsg: [],         // ids marcados leído
      pedidoListaPlana: false,// 🔒 si alguien pide la colección vieja, se sabe
      fallarAdd: false
    };
    function snapDe(docs){ return { forEach: fn => docs.forEach(fn), size: docs.length, empty: !docs.length }; }
    function docMsg(m){
      return { id: m.id, data: () => m,
        ref: { update: c => { window._fake.updatesMsg.push(m.id); Object.assign(m, c); return Promise.resolve(); } } };
    }
    function buzonFalso(clave){
      const msgs = () => window._fake.buzones[clave] || [];
      function consulta(filtro){
        return {
          where: (campo, op, val) => consulta(m => filtro(m) && m[campo] === val),
          orderBy: (campo, dir) => ({
            limit: (n) => ({ get: () => {
              const orden = msgs().filter(filtro).slice()
                .sort((a,b) => dir==='desc' ? (b[campo]||0)-(a[campo]||0) : (a[campo]||0)-(b[campo]||0));
              return Promise.resolve(snapDe(orden.slice(0, n).map(docMsg)));
            } })
          }),
          get: () => Promise.resolve(snapDe(msgs().filter(filtro).map(docMsg))),
          onSnapshot: (cb, errCb) => {
            const mia = () => cb(snapDe(msgs().filter(filtro).map(docMsg)));
            window._fake.escuchas.push(mia); mia();
            return () => {};
          },
          add: (d) => {
            if(window._fake.fallarAdd) return Promise.reject(new Error('sin señal'));
            if(!window._fake.buzones[clave]) window._fake.buzones[clave] = [];
            const m = Object.assign({ id: clave + '_m' + window._fake.buzones[clave].length }, d);
            window._fake.buzones[clave].push(m);
            window._fake.agregados.push({ clave: clave, m: d });
            window._fake.escuchas.forEach(f => f());
            return Promise.resolve({ id: 'nuevo' });
          }
        };
      }
      return consulta(() => true);
    }
    window._armarFbFalso = function(){
      window.fbDb = { collection: (nom) => {
        if(nom === 'nbs_chat_accesos') return {
          get: () => Promise.resolve(snapDe(Object.keys(window._fake.accesos)
            .map(k => ({ id: k, data: () => window._fake.accesos[k] })))),
          doc: (clave) => ({
            get: () => Promise.resolve({ exists: !!window._fake.accesos[clave],
              data: () => window._fake.accesos[clave] }),
            set: (d) => { window._fake.accesos[clave] = d; return Promise.resolve(); },
            update: (c) => { window._fake.updatesAcceso.push({ clave, campos: c });
              Object.assign(window._fake.accesos[clave] = window._fake.accesos[clave] || {}, c);
              return Promise.resolve(); },
            collection: (sub) => buzonFalso(clave)
          })
        };
        if(nom === 'nbs_chat_mensajes'){ window._fake.pedidoListaPlana = true; return { get: () => Promise.resolve(snapDe([])) }; }
        return {};
      } };
    };
  });

  console.log('\n3️⃣  🔴 EL GLOBITO CUENTA SOLO LO DEL BARBERO SIN LEER');
  const r3 = await p.evaluate(async () => {
    window._armarFbFalso();
    window._fake.accesos = {
      'LUIS1': { cid: '1', nombre: 'Luis Gomez', barberia: 'Fade Masters', activo: true, creado: 10 },
      'PEDRO2': { cid: '2', nombre: 'Pedro Diaz', barberia: 'Kings Cuts', activo: true, creado: 20 }
    };
    window._fake.buzones = {
      'LUIS1': [
        { id: 'a', deNBS: false, leido: false, texto: 'hola', cuando: 100 },
        { id: 'b', deNBS: false, leido: false, texto: 'oye', cuando: 200 }
      ],
      'PEDRO2': [
        { id: 'c', deNBS: true, leido: false, texto: 'mío sin leer', cuando: 300 },
        { id: 'd', deNBS: false, leido: true, texto: 'ya visto', cuando: 400 }
      ]
    };
    revisarChatSinLeer();
    await new Promise(r => setTimeout(r, 200));
    const g = document.getElementById('chatnbs-globo');
    return { n: window._chatSinLeer, visible: g && g.style.display !== 'none', txt: g && g.textContent };
  });
  T('🔴 cuenta 2 (los del barbero), no 3', r3.n === 2, String(r3.n));
  T('el globito se ve y dice 2', r3.visible && r3.txt === '2', r3.txt);

  console.log('\n4️⃣  📋 LA LISTA: SIN LEER ARRIBA Y CON SU NÚMERO');
  const r4 = await p.evaluate(async () => {
    window._fake.accesos['NUEVO3'] = { cid: '3', nombre: 'Recien Dado', barberia: '', activo: true, creado: 999 };
    abrirChatNBS();
    await new Promise(r => setTimeout(r, 300));
    const o = document.getElementById('chatnbs-overlay');
    const botones = Array.from(o.querySelectorAll('button[onclick^="abrirConversacionNBS"]'));
    return {
      cuantos: botones.length,
      primero: botones[0] ? botones[0].textContent : '',
      tieneGlobo2: botones[0] ? /2/.test(botones[0].textContent) : false,
      salioElNuevo: /Recien Dado/.test(o.textContent),
      sinMensajes: /Sin mensajes todav/.test(o.textContent),
      hayDarAcceso: /Dar acceso a un cliente/.test(o.textContent),
      hayVerAccesos: /Ver los accesos/.test(o.textContent)
    };
  });
  T('📋 salen las 3 conversaciones', r4.cuantos === 3, String(r4.cuantos));
  T('🔝 Luis (con 2 sin leer) va de primero', /Luis/.test(r4.primero), r4.primero.slice(0, 40));
  T('con su numerito 2 en rojo', r4.tieneGlobo2);
  T('🆕 el acceso recién dado sale aunque no tenga mensajes', r4.salioElNuevo && r4.sinMensajes);
  T('➕ y 🔑 los dos botones están', r4.hayDarAcceso && r4.hayVerAccesos);

  console.log('\n5️⃣  💬 EL HILO: PINTA, SEPARA LADOS Y MARCA LEÍDO');
  const r5 = await p.evaluate(async () => {
    window._fake.updatesMsg = [];
    abrirConversacionNBS(encodeURIComponent('LUIS1'));
    await new Promise(r => setTimeout(r, 250));
    const hilo = document.getElementById('chatnbs-hilo');
    const burbujas = hilo ? hilo.children.length : 0;
    return {
      burbujas,
      pintaTexto: hilo && /hola/.test(hilo.textContent) && /oye/.test(hilo.textContent),
      marcados: window._fake.updatesMsg.slice(),
      quedaronLeidos: (window._fake.buzones['LUIS1']||[]).filter(m => m.leido).length,
      globoBajo: window._chatSinLeer,
      hayCaja: !!document.getElementById('chatnbs-texto'),
      hayEnviar: !!document.getElementById('chatnbs-enviar')
    };
  });
  T('💬 pinta los 2 mensajes de Luis', r5.burbujas === 2 && r5.pintaTexto, String(r5.burbujas));
  T('👁️ marca leídos SOLO los del barbero (a y b)', r5.marcados.sort().join(',') === 'a,b', r5.marcados.join(','));
  T('y en la nube quedan leídos', r5.quedaronLeidos === 2, String(r5.quedaronLeidos));
  T('🔴 el globito baja a 0', r5.globoBajo === 0, String(r5.globoBajo));
  T('✍️ la caja de escribir y Enviar están', r5.hayCaja && r5.hayEnviar);

  console.log('\n6️⃣  📤 CONTESTAR: SALE CON TODOS SUS DATOS');
  const r6 = await p.evaluate(async () => {
    window._fake.agregados = [];
    document.getElementById('chatnbs-texto').value = '  te las llevo el lunes  ';
    mandarMensajeNBS();
    await new Promise(r => setTimeout(r, 250));
    const caida = window._fake.agregados[0] || {};
    const m = caida.m || {};
    const hilo = document.getElementById('chatnbs-hilo');
    return { m, caidaEn: caida.clave, cuantos: window._fake.agregados.length,
      cajaVacia: document.getElementById('chatnbs-texto').value === '',
      botonVivo: !document.getElementById('chatnbs-enviar').disabled,
      salioEnElHilo: hilo && /te las llevo el lunes/.test(hilo.textContent) };
  });
  T('📤 se manda 1 solo mensaje', r6.cuantos === 1, String(r6.cuantos));
  T('deNBS:true y leido:false', r6.m.deNBS === true && r6.m.leido === false);
  T('🔒 cae en el buzón de LUIS1 y solo lleva el mensaje', r6.caidaEn === 'LUIS1' && !('cid' in r6.m) && !('nombre' in r6.m), r6.caidaEn);
  T('✂️ el texto va limpio, sin espacios sobrantes', r6.m.texto === 'te las llevo el lunes', JSON.stringify(r6.m.texto));
  T('la caja queda vacía y el botón vivo', r6.cajaVacia && r6.botonVivo);
  T('y aparece en el hilo en el momento', r6.salioEnElHilo);

  console.log('\n7️⃣  📵 SI EL ENVÍO FALLA, NO SE LE PIERDE LO ESCRITO');
  const r7 = await p.evaluate(async () => {
    window._fake.fallarAdd = true;
    document.getElementById('chatnbs-texto').value = 'mensaje importante';
    mandarMensajeNBS();
    await new Promise(r => setTimeout(r, 250));
    const caja = document.getElementById('chatnbs-texto');
    const boton = document.getElementById('chatnbs-enviar');
    window._fake.fallarAdd = false;
    return { vuelve: caja.value === 'mensaje importante', vivo: !boton.disabled };
  });
  T('📵 el texto vuelve a la caja', r7.vuelve);
  T('y el botón no se queda muerto', r7.vivo);

  console.log('\n8️⃣  ➕ DAR ACCESO: EL CLIENTE DE SU LISTA Y LA CLAVE DE ÉL');
  const r8 = await p.evaluate(async () => {
    localStorage.setItem('ncl', JSON.stringify([
      { id: 7, nombre: 'Carlos', apellido: 'Mota', apodo: '', negocio: 'La Esquina Barbershop' },
      { id: 8, nombre: 'Ana', apellido: 'Reyes', apodo: '', negocio: '' }
    ]));
    window.clientes = JSON.parse(localStorage.getItem('ncl'));
    abrirDarAccesoChat();
    await new Promise(r => setTimeout(r, 150));
    filtrarClienteChat('carlos');
    const lista1 = document.getElementById('chatnbs-clientes').textContent;
    escogerClienteChat(encodeURIComponent('7'));
    await new Promise(r => setTimeout(r, 100));
    const paso2 = document.getElementById('chatnbs-paso2').style.display;

    // Clave corta → la rechaza
    document.getElementById('chatnbs-clave').value = 'AB';
    guardarAccesoChat();
    await new Promise(r => setTimeout(r, 100));
    const errCorta = document.getElementById('chatnbs-err').textContent;

    // Clave con signos → la rechaza
    document.getElementById('chatnbs-clave').value = 'CAR-LOS!';
    guardarAccesoChat();
    await new Promise(r => setTimeout(r, 100));
    const errSignos = document.getElementById('chatnbs-err').textContent;

    // Clave repetida → la rechaza y dice de quién es
    document.getElementById('chatnbs-clave').value = 'LUIS1';
    guardarAccesoChat();
    await new Promise(r => setTimeout(r, 200));
    const errRepetida = document.getElementById('chatnbs-err').textContent;

    return { encontro: /Carlos/.test(lista1), paso2, errCorta, errSignos, errRepetida,
             seGuardoAlgo: !!window._fake.accesos['AB'] || !!window._fake.accesos['CAR-LOS!'] };
  });
  T('🔎 el buscador encuentra a Carlos', r8.encontro);
  T('al escogerlo se abre el paso de la clave', r8.paso2 === 'block');
  T('🚫 clave corta: rechazada', /4/.test(r8.errCorta), r8.errCorta);
  T('🚫 clave con signos: rechazada', /letras y n/i.test(r8.errSignos), r8.errSignos);
  T('🚫 clave repetida: rechazada y dice de quién es', /YA est/.test(r8.errRepetida) && /Luis/.test(r8.errRepetida), r8.errRepetida);
  T('y nada de eso se guardó', !r8.seGuardoAlgo);

  const r8b = await p.evaluate(async () => {
    abrirDarAccesoChat();
    await new Promise(r => setTimeout(r, 100));
    escogerClienteChat(encodeURIComponent('7'));
    await new Promise(r => setTimeout(r, 100));
    document.getElementById('chatnbs-clave').value = 'carlos 2026';   // minúsculas y espacio
    guardarAccesoChat();
    await new Promise(r => setTimeout(r, 300));
    const a = window._fake.accesos['CARLOS2026'];
    return { guardado: !!a, datos: a || {} };
  });
  T('✅ la buena se guarda EN MAYÚSCULAS y sin espacios (CARLOS2026)', r8b.guardado);
  T('con el cliente, la barbería y activo:true', r8b.datos.cid === '7' && r8b.datos.barberia === 'La Esquina Barbershop' && r8b.datos.activo === true, JSON.stringify(r8b.datos));
  T('el nombre va plano, sin comillas de apodo', r8b.datos.nombre === 'Carlos Mota', JSON.stringify(r8b.datos.nombre));

  console.log('\n9️⃣  🔑 QUITAR Y DEVOLVER EL ACCESO, SIN BORRAR NADA');
  const r9 = await p.evaluate(async () => {
    window._fake.updatesAcceso = [];
    const antesMsgs = Object.values(window._fake.buzones).reduce((s,b)=>s+b.length,0);
    abrirAccesosChat();
    await new Promise(r => setTimeout(r, 250));
    const caja = document.getElementById('chatnbs-accesos');
    const salen = caja && /LUIS1/.test(caja.textContent) && /CARLOS2026/.test(caja.textContent);
    const diceNunca = /nunca ha entrado/.test(caja.textContent);
    toggleAccesoChat(encodeURIComponent('LUIS1'), false);
    await new Promise(r => setTimeout(r, 250));
    const quitado = window._fake.accesos['LUIS1'].activo === false;
    toggleAccesoChat(encodeURIComponent('LUIS1'), true);
    await new Promise(r => setTimeout(r, 250));
    const devuelto = window._fake.accesos['LUIS1'].activo === true;
    return { salen, diceNunca, quitado, devuelto,
             mensajesIntactos: Object.values(window._fake.buzones).reduce((s,b)=>s+b.length,0) === antesMsgs,
             soloActivo: window._fake.updatesAcceso.every(u => Object.keys(u.campos).join('') === 'activo') };
  });
  T('🔑 salen todos los accesos con su clave', r9.salen);
  T('y dice "nunca ha entrado" cuando aplica', r9.diceNunca);
  T('🚫 Quitar lo apaga', r9.quitado);
  T('✅ Devolver lo enciende', r9.devuelto);
  T('💬 la conversación NO se borra', r9.mensajesIntactos);
  T('y solo se toca el campo activo, nada más', r9.soloActivo);

  console.log('\n🔟  💰 EL CHAT NO TOCA NI UN CENTAVO NI UN DATO DEL NEGOCIO');
  const r10 = await p.evaluate(async () => {
    const foto = k => localStorage.getItem(k) || '';
    localStorage.setItem('nvts', JSON.stringify([{ id: 1, total: 100, items: [] }]));
    const antes = ['nvts', 'ncl', 'nprods', 'npedidos', 'ncr', 'ngastos', 'ncompras'].map(foto).join('§');
    abrirChatNBS();
    await new Promise(r => setTimeout(r, 300));
    abrirConversacionNBS(encodeURIComponent('LUIS1'));
    await new Promise(r => setTimeout(r, 250));
    document.getElementById('chatnbs-texto').value = 'prueba de dinero';
    mandarMensajeNBS();
    await new Promise(r => setTimeout(r, 250));
    volverAListaChat();
    await new Promise(r => setTimeout(r, 250));
    cerrarChatNBS();
    const despues = ['nvts', 'ncl', 'nprods', 'npedidos', 'ncr', 'ngastos', 'ncompras'].map(foto).join('§');
    return { igual: antes === despues };
  });
  T('💰 ventas, clientes, productos, pedidos, crédito, gastos y compras: INTACTOS', r10.igual);

  console.log('\n1️⃣1️⃣  ⏰ EL RELOJ DEL BUZÓN TAMBIÉN REVISA EL CHAT');
  const r11 = await p.evaluate(() => {
    const fn = String(window.iniciarAppDespuesDeLogin || '');
    return { enganchado: /revisarChatSinLeer/.test(fn) };
  });
  T('⏰ _mirarElBuzon llama a revisarChatSinLeer', r11.enganchado);

  console.log('\n1️⃣2️⃣  🔒 EL CANDADO: NADIE PIDE LA GAVETA GRANDE VIEJA');
  const r12 = await p.evaluate(() => ({ pidioPlana: window._fake.pedidoListaPlana }));
  T('🔒 la app NUNCA pidió la colección plana nbs_chat_mensajes', !r12.pidioPlana);
  const r12b = await p.evaluate(async () => {
    // Y el barbero de la calle (CHAT/index.html) tampoco: se lee el archivo aparte
    return true;
  });

  const erroresReales = errs.filter(e => !/favicon|net::|icon-/.test(e));
  T('🧯 sin errores de página en toda la corrida', erroresReales.length === 0, erroresReales.join(' | ').slice(0, 120));

  // 🔒 Verificación estática del lado del barbero (CHAT/index.html):
  // debe usar el buzón por clave y NUNCA la colección plana vieja.
  const fs = require('fs');
  try {
    const cat = fs.readFileSync('/home/claude/CHAT/index.html', 'utf8');
    T('🚪 el barbero escucha DENTRO de su clave', /nbs_chat_accesos'\)\.doc\(YO\.clave\)[\s\S]{0,80}collection\('mensajes'\)/.test(cat));
    T('🚪 y NO toca la gaveta grande vieja', !/nbs_chat_mensajes/.test(cat));
    T('🚪 sus mensajes salen con deNBS:false (no puede hacerse pasar por NBS)', /deNBS:\s*false/.test(cat));
  } catch(e){ T('🚪 el archivo del barbero existe en /home/claude/CHAT/', false, e.message); }

  console.log('\n  ' + ok + ' bien · ' + mal + ' mal');
  await b.close();
  process.exit(mal ? 1 : 0);
})();
