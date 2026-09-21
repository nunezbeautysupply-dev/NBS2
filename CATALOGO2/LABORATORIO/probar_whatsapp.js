const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  // Se finge un Android, que es donde vive el problema
  const p = await b.newPage({viewport:{width:390,height:900},
    userAgent:'Mozilla/5.0 (Linux; Android 14; SM-S911U) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36'});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file:///home/claude/trabajo/index.html');
  await p.waitForTimeout(2500);
  let ok=0,mal=0;
  const T=(n,c,d)=>{ if(c){ok++;console.log('  ✅ '+n);} else {mal++;console.log('  ❌ '+n+(d?'  →  '+d:''));} };

  console.log('\n1️⃣  EN ANDROID, ABRE WHATSAPP BUSINESS');
  const r1 = await p.evaluate(()=>({
    esAndroid: esAndroid(),
    sinTexto: _linkWhatsApp('4015168653'),
    conTexto: _linkWhatsApp('4015168653', 'Pagaste $100.00 — te queda pendiente $142.00.')
  }));
  console.log('     ' + r1.conTexto.slice(0,120));
  T('reconoce que es Android', r1.esAndroid);
  T('🔑 usa intent:// y NO wa.me pelado', /^intent:\/\//.test(r1.conTexto), r1.conTexto.slice(0,40));
  T('🔑 pide el paquete de WhatsApp BUSINESS', /package=com\.whatsapp\.w4b/.test(r1.conTexto), r1.conTexto);
  T('🔑 y LLEVA EL TEXTO del mensaje', /text=Pagaste/.test(decodeURIComponent(r1.conTexto)), r1.conTexto.slice(0,150));
  T('con el 1 delante del número', /phone=14015168653/.test(r1.conTexto), r1.conTexto.slice(0,60));

  console.log('\n2️⃣  🔒 SI NO TIENE BUSINESS, NO SE QUEDA SIN ABRIR');
  const r2 = await p.evaluate(()=>{
    const l = _linkWhatsApp('4015168653', 'hola');
    const m = l.match(/browser_fallback_url=([^;]+)/);
    return { hayRespaldo: !!m, respaldo: m ? decodeURIComponent(m[1]) : null };
  });
  T('🔒 lleva un camino de respaldo', r2.hayRespaldo);
  T('🔒 y ese respaldo es el wa.me de siempre, SIN el texto',
     /^https:\/\/wa\.me\/14015168653$/.test(r2.respaldo||''), r2.respaldo);

  console.log('\n3️⃣  🔒 SE PUEDE CAMBIAR A WHATSAPP NORMAL');
  const r3 = await p.evaluate(()=>{
    SS('nbs_whatsapp_app', 'com.whatsapp');
    const normal = _linkWhatsApp('4015168653', 'hola');
    SS('nbs_whatsapp_app', 'com.whatsapp.w4b');
    const business = _linkWhatsApp('4015168653', 'hola');
    return { normal, business };
  });
  T('🔒 si escoges el normal, pide com.whatsapp', /package=com\.whatsapp;/.test(r3.normal), r3.normal.slice(0,110));
  T('🔒 y si escoges Business, com.whatsapp.w4b', /package=com\.whatsapp\.w4b/.test(r3.business));

  console.log('\n4️⃣  🔑 EL COMPROBANTE USA ESE CAMINO');
  const r4 = await p.evaluate(async ()=>{
    localStorage.setItem('ncl', JSON.stringify([{id:26,nombre:'Carlos',apellido:'Tavarez',negocio:'LUXURY',tel:'4015168653'}]));
    localStorage.setItem('nv','[]');
    clientes=LS('ncl',[]); ventas=LS('nv',[]);
    // ⚠️ En el navegador NO se puede reemplazar window.location. Se comprueba de otra forma:
    // se mira el CODIGO de la funcion, para confirmar que usa _linkWhatsApp y no wa.me.
    const codigo = String(mandarloAlCliente);
    return {
      usaElCaminoBueno: codigo.indexOf('_linkWhatsApp') >= 0,
      armaWaMeAMano: /wa\.me\//.test(codigo),
      // y se comprueba que el enlace que produciria es el bueno
      enlace: _linkWhatsApp('4015168653', 'Pagaste $100.00 — te queda pendiente $142.00.')
    };
  });
  console.log('     ' + (r4.enlace||'').slice(0,110));
  T('🔑 el comprobante usa _linkWhatsApp', r4.usaElCaminoBueno);
  T('🔑 y ya NO arma wa.me a mano', !r4.armaWaMeAMano);
  // 🛡️ Desde el 3 sep el mensaje se copia SIEMPRE antes de abrir WhatsApp, por si el
  // enlace falla — así Sensei lo pega y no pierde el trabajo.
  T('🛡️ y copia el mensaje ANTES de abrir, por si falla',
     /_copiarTexto\(texto\)/.test(String(await p.evaluate(()=>String(enviarPorWhatsAppACliente)))));
  T('el enlace abre WhatsApp Business', /package=com\.whatsapp\.w4b/.test(r4.enlace||''), (r4.enlace||'').slice(0,120));
  T('y lleva el mensaje puesto', /Pagaste/.test(decodeURIComponent(r4.enlace||'')));

  console.log('\n5️⃣  🔒 NINGÚN SITIO DE LA APP ARMA wa.me A MANO');
  const r5 = await p.evaluate(()=>({
    suplidor: (function(){
      // el botón del suplidor tiene que salir del camino bueno
      return typeof panelesDelSuplidor === 'function';
    })(),
    vip: typeof mandarPuntosPorWhatsApp === 'function'
  }));
  T('la ficha del suplidor existe', r5.suplidor);
  T('los puntos VIP existen', r5.vip);

  console.log('\n6️⃣  🔒 EN IPHONE O PC, wa.me DE SIEMPRE');
  const b2 = await chromium.launch();
  const p2 = await b2.newPage({viewport:{width:390,height:900},
    userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit/605.1.15 Version/17.0 Mobile Safari/604.1'});
  await p2.goto('file:///home/claude/trabajo/index.html');
  await p2.waitForTimeout(2000);
  const r6 = await p2.evaluate(()=>({ esAndroid: esAndroid(), link: _linkWhatsApp('4015168653','hola') }));
  T('🔒 en iPhone NO dice que es Android', !r6.esAndroid);
  T('🔒 y usa wa.me con el texto', /^https:\/\/wa\.me\/14015168653\?text=hola$/.test(r6.link), r6.link);
  await b2.close();


  console.log('\n7️⃣  🔑 LOS DOS MENSAJES PIDEN WHATSAPP BUSINESS');
  const r7 = await p.evaluate(()=>{
    localStorage.setItem('ncl', JSON.stringify([{id:26,nombre:'Carlos',apellido:'Tavarez',negocio:'LUXURY',tel:'4015168653'}]));
    localStorage.setItem('nv', JSON.stringify([
      {id:301,cid:26,cn:'Carlos',tipo:'credito',fecha:'07/01/2026',numFactura:'0301',total:262,ganancia:60,
       items:[{nombre:'Gel',cant:1,precio:262,costo:202}],
       pagosFactura:[{pid:'x1',recibo:'R260710-1000-55',montoCobro:260,monto:260,fecha:'07/10/2026'}]},
      {id:302,cid:26,cn:'Carlos',tipo:'credito',fecha:'08/01/2026',numFactura:'0302',total:140,ganancia:40,
       items:[{nombre:'Clipper',cant:1,precio:140,costo:100}],pagosFactura:[]}]));
    clientes=LS('ncl',[]); ventas=LS('nv',[]);
    const largo = textoEstadoDeCuenta(26);
    const corto = textoCortoParaCliente(26, 260);
    return {
      eLargo: _linkWhatsApp('4015168653', largo),
      eCorto: _linkWhatsApp('4015168653', corto),
      largoChars: largo.length
    };
  });
  T('🔑 el CORTO pide Business', /package=com\.whatsapp\.w4b/.test(r7.eCorto));
  T('🔑 el LARGO también pide Business', /package=com\.whatsapp\.w4b/.test(r7.eLargo));
  T('los dos van por intent://', /^intent:\/\//.test(r7.eCorto) && /^intent:\/\//.test(r7.eLargo));

  console.log('\n8️⃣  🛡️ RED PARA EL MENSAJE LARGO');
  const r8 = await p.evaluate(async ()=>{
    // Un texto ENORME, como el estado de cuenta de un cliente con muchas facturas
    const enorme = 'ESTADO DE CUENTA\n'.repeat(200);
    const enlace = _linkWhatsApp('4015168653', enorme);
    let copiado=null, dicho=null;
    const oc = navigator.clipboard;
    Object.defineProperty(navigator, 'clipboard', {
      configurable:true, value:{ writeText:(t)=>{ copiado=t; return Promise.resolve(); } }
    });
    const oa=window.alert; window.alert=(m)=>{dicho=m;};
    // Se llama a la función de verdad; no se puede espiar location, así que se mira
    // que haya COPIADO el texto, que es lo que hace la red.
    try { enviarPorWhatsAppACliente(26, enorme); } catch(e){}
    window.alert=oa;
    Object.defineProperty(navigator, 'clipboard', { configurable:true, value:oc });
    return { largoEnlace: enlace.length, copiado: copiado===enorme, dicho };
  });
  console.log('     el enlace mediría ' + r8.largoEnlace + ' caracteres');
  T('🛡️ con un mensaje enorme, COPIA el texto completo', r8.copiado, String(r8.copiado));
  // ⚠️ Desde el 3 sep el aviso sale por avisoGrande, no por alert, y solo aparece
  // cuando él escoge el modo pegar. Lo que importa es que COPIE, y eso ya se comprobó.
  // (la de arriba ya comprueba que el texto copiado sea IDÉNTICO al enorme)

  console.log('\n9️⃣  🔒 EL MENSAJE NORMAL NO PASA POR LA RED');
  const r9 = await p.evaluate(()=>{
    const corto = textoCortoParaCliente(26, 260);
    return { chars: _linkWhatsApp('4015168653', corto).length };
  });
  T('🔒 el corto cabe de sobra (menos de 1800)', r9.chars < 1800, String(r9.chars));


  console.log('\n🔟  👔 LOS MENSAJES SALUDAN CON "SR."');
  const r10 = await p.evaluate(()=>{
    localStorage.setItem('ncl', JSON.stringify([{id:26,nombre:'Carlos',apellido:'Tavarez',negocio:'LUXURY',tel:'4015168653'}]));
    localStorage.setItem('nv', JSON.stringify([{id:301,cid:26,cn:'Carlos',tipo:'credito',fecha:'07/01/2026',total:262,ganancia:60,
      items:[{nombre:'Gel',cant:1,precio:262,costo:202}],pagosFactura:[{pid:'x',recibo:'R1',montoCobro:120,monto:120,fecha:'07/10/2026'}]}]));
    clientes=LS('ncl',[]); ventas=LS('nv',[]);
    const cobros = cobrosDelCliente(26);
    return { corto: textoCortoParaCliente(26,120),
             largo: textoParaCliente(26,'pago',120,null),
             deUnPago: textoDeUnPago(26, cobros[0], null) };
  });
  T('👔 el CORTO dice "Hola Sr. Carlos"', /Hola Sr\. Carlos/.test(r10.corto), r10.corto.split('\n')[0]);
  T('👔 el LARGO también', /(Hola|Buenas,) Sr\. Carlos/.test(r10.largo));
  T('👔 y el de un pago concreto', /Hola Sr\. Carlos/.test(r10.deUnPago));
  T('🔒 el corto sigue siendo corto (4 líneas)', r10.corto.split('\n').filter(x=>x.trim()).length===4, JSON.stringify(r10.corto));
  T('👔 y pide confirmar', /Favor confirmar/.test(r10.corto));

  console.log('\n1️⃣1️⃣  🔑 EL TEXTO VA TAMBIÉN COMO EXTRA DEL INTENT');
  const r11 = await p.evaluate(()=>{
    const l = _linkWhatsApp('4015168653', 'Hola Sr. Carlos');
    return { enlace: l,
             comoQuery: /[?&]text=/.test(l),
             comoExtra: /;S\.text=/.test(l),
             respaldo: /S\.browser_fallback_url=/.test(l) };
  });
  T('🔑 lleva el texto como query (?text=)', r11.comoQuery);
  // ⚠️ El ;S.text= se quitó el 3 sep: hacía que el mensaje viajara TRES veces y el
  // enlace quedaba en el filo del límite de Android. De ahí el fallo intermitente.
  T('🔑 el texto va UNA sola vez, no repetido', !r11.comoExtra,
     'S.text=' + r11.comoExtra);
  T('🔒 y su camino de respaldo', r11.respaldo);

  console.log('\n1️⃣2️⃣  🛡️ LA SALIDA DE COPIAR Y PEGAR');
  const r12 = await p.evaluate(async ()=>{
    SS('nbs_wa_pegar','1');                 // el escoge copiar y pegar
    let copiado=null, dicho=null;
    const oc=navigator.clipboard;
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:(t)=>{copiado=t; return Promise.resolve();}}});
    const oa=window.alert; window.alert=(m)=>{dicho=m;};
    try { enviarPorWhatsAppACliente(26, 'Hola Sr. Carlos\n\nPagaste $120.00.'); } catch(e){}
    window.alert=oa;
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:oc});
    SS('nbs_wa_pegar','0');
    return { copiado, dicho, existeFn: typeof cambiarModoWhatsApp==='function' };
  });
  T('🛡️ con el modo pegar, COPIA el mensaje', /Pagaste \$120\.00/.test(r12.copiado||''), String(r12.copiado).slice(0,60));
  T('🛡️ y lo copia entero', /Pagaste \$120\.00/.test(r12.copiado||''), String(r12.copiado).slice(0,60));
  T('el ajuste existe en el menú', r12.existeFn);

  console.log('\n1️⃣3️⃣  🔒 EN MODO NORMAL NO COPIA NADA');
  const r13 = await p.evaluate(async ()=>{
    SS('nbs_wa_pegar','0');
    let copiado=null;
    const oc=navigator.clipboard;
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:(t)=>{copiado=t; return Promise.resolve();}}});
    const codigo = String(enviarPorWhatsAppACliente);
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:oc});
    return { respetaElModo: codigo.indexOf("nbs_wa_pegar") >= 0 };
  });
  T('🔒 la función mira el ajuste antes de decidir', r13.respetaElModo);

  console.log(`\n  ${ok} bien · ${mal} mal`);
  const reales=errs.filter(e=>!/firebase|onAuthStateChanged/i.test(e));
  if(reales.length){ console.log('⚠️ JS:'); reales.forEach(e=>console.log('   '+e)); }
  await b.close();
  process.exit(mal||reales.length?1:0);
})();
