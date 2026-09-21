const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({viewport:{width:390,height:1200}});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file:///home/claude/trabajo/index.html');
  await p.waitForTimeout(2500);
  await p.evaluate(()=>{ window.protegerConHuella=function(cb){cb();};
    window.fbDb={ref:()=>({set(){},update(){},on(){},once(){return Promise.resolve({val:()=>null});}})}; });
  let ok=0,mal=0;
  const T=(n,c,d)=>{ if(c){ok++;console.log('  ✅ '+n);} else {mal++;console.log('  ❌ '+n+(d?'  →  '+d:''));} };

  // EL CASO EXACTO DE SENSEI: un pago de $80 repartido en 3 facturas
  const sembrar = async () => await p.evaluate(async ()=>{
    ['pantalla-login','pantalla-bloqueo'].forEach(id=>{const e=document.getElementById(id); if(e) e.style.display='none';});
    const a=document.getElementById('app-contenido'); if(a) a.style.display='block';
    localStorage.setItem('ncl', JSON.stringify([{id:7,nombre:'Isidro',apellido:'Gonzalez',apodo:'EL FLACO',
      negocio:'URBAN CUTS',tel:'4015551212'}]));
    localStorage.setItem('nv', JSON.stringify([
      {id:101,cid:7,cn:'Isidro',tipo:'credito',fecha:'07/10/2026',numFactura:'0101',total:35,ganancia:10,
       items:[{nombre:'Gel',cant:1,precio:35,costo:25}],
       pagosFactura:[{pid:'a1',recibo:'R260815-1030-11',montoCobro:80,monto:35,fecha:'08/15/2026',hora:'10:30 AM',
                      metodos:[{tipo:'efectivo',monto:80}]}]},
      {id:102,cid:7,cn:'Isidro',tipo:'credito',fecha:'07/20/2026',numFactura:'0102',total:15,ganancia:4,
       items:[{nombre:'Wax',cant:1,precio:15,costo:11}],
       pagosFactura:[{pid:'a2',recibo:'R260815-1030-11',montoCobro:80,monto:15,fecha:'08/15/2026',hora:'10:30 AM'}]},
      {id:103,cid:7,cn:'Isidro',tipo:'credito',fecha:'08/01/2026',numFactura:'0103',total:55,ganancia:15,
       items:[{nombre:'Clipper',cant:1,precio:55,costo:40}],
       pagosFactura:[{pid:'a3',recibo:'R260815-1030-11',montoCobro:80,monto:30,fecha:'08/15/2026',hora:'10:30 AM'}]}
    ]));
    clientes=LS('ncl',[]); ventas=LS('nv',[]);
  });

  console.log('\n1️⃣  🔑 EL PAGO DE $80 SE VE COMPLETO, NO PARTIDO');
  await sembrar();
  const r1 = await p.evaluate(()=>{
    const cobros = cobrosDelCliente(7);
    return { cuantos: cobros.length, montoCobro: cobros[0].montoCobro,
             partes: cobros[0].partes.length, suma: cobros[0].suma,
             recibo: cobros[0].recibo, detalle: cobros[0].partes.map(x=>x.monto) };
  });
  console.log('     ' + JSON.stringify(r1));
  T('🔑 sale UN solo pago, no tres', r1.cuantos===1, String(r1.cuantos));
  T('🔑 y dice $80.00, no $35.00', r1.montoCobro===80, String(r1.montoCobro));
  T('con sus 3 partes guardadas', r1.partes===3, String(r1.partes));
  T('que suman los mismos $80', r1.suma===80, String(r1.suma));
  T('y lleva su número de recibo', /^R260815/.test(r1.recibo||''), r1.recibo);
  T('el detalle es 35 + 15 + 30', JSON.stringify(r1.detalle)===JSON.stringify([35,15,30]), JSON.stringify(r1.detalle));

  console.log('\n2️⃣  LA PANTALLA LO ENSEÑA ASÍ');
  const r2 = await p.evaluate(async ()=>{
    abrirEstadoDeCuenta(7);
    await new Promise(r=>setTimeout(r,300));
    const t=document.getElementById('estado-cuenta-caja').innerText;
    return { texto:t, hay:/\$80\.00/.test(t), reparto:/se repartió en 3/.test(t) };
  });
  T('la pantalla abre', !!r2.texto);
  T('🔑 enseña el pago de $80.00', r2.hay, r2.texto.slice(0,300).replace(/\n/g,' | '));
  T('y avisa que se repartió en 3', r2.reparto, r2.texto.slice(0,400).replace(/\n/g,' | '));

  console.log('\n3️⃣  🔑 AL TOCARLO SE VE LA DISTRIBUCIÓN');
  const r3 = await p.evaluate(async ()=>{
    toggleCobroEstado('R:R260815-1030-11');
    await new Promise(r=>setTimeout(r,250));
    const t=document.getElementById('estado-cuenta-caja').innerText;
    return { titulo:/A QUÉ FACTURAS SE APLICÓ/.test(t),
             m35:/\$35\.00/.test(t), m15:/\$15\.00/.test(t), m30:/\$30\.00/.test(t),
             f1:/0101/.test(t), f2:/0102/.test(t), f3:/0103/.test(t) };
  });
  T('🔑 dice "a qué facturas se aplicó"', r3.titulo);
  T('sale el $35.00', r3.m35);
  T('sale el $15.00', r3.m15);
  T('sale el $30.00', r3.m30);
  T('con sus tres números de factura', r3.f1 && r3.f2 && r3.f3, JSON.stringify(r3));

  console.log('\n4️⃣  LOS NÚMEROS DE ARRIBA CUADRAN');
  const r4 = await p.evaluate(()=>{
    const t=document.getElementById('estado-cuenta-caja').innerText;
    return { facturado:/\$105\.00/.test(t), pagado:/\$80\.00/.test(t), debe:/\$25\.00/.test(t) };
  });
  T('LE FACTURÉ $105.00 (35+15+55)', r4.facturado);
  T('ME PAGÓ $80.00', r4.pagado);
  T('🔑 DEBE $25.00 (105 − 80)', r4.debe);

  console.log('\n5️⃣  💬 EL MENSAJE PARA EL CLIENTE');
  const r5 = await p.evaluate(()=>{
    const txt = textoParaCliente(7, 'pago', 80, [{monto:35,fecha:'07/10/2026'},{monto:15,fecha:'07/20/2026'},{monto:30,fecha:'08/01/2026'}]);
    return { txt, tieneNombre:/Isidro/.test(txt), tieneMonto:/\$80\.00/.test(txt),
             tieneBalance:/\$25\.00/.test(txt), tieneReparto:/\$35\.00/.test(txt) };
  });
  console.log('     ' + r5.txt.split('\n').slice(0,10).join('\n     '));
  T('saluda por su nombre', r5.tieneNombre);
  T('🔑 dice el pago completo: $80.00', r5.tieneMonto);
  T('🔑 dice el balance que le queda: $25.00', r5.tieneBalance);
  T('y detalla cómo se aplicó', r5.tieneReparto);

  console.log('\n6️⃣  💬 EL ESTADO DE CUENTA EN TEXTO');
  const r6 = await p.evaluate(()=>{
    const txt = textoEstadoDeCuenta(7);
    return { txt, facturado:/105\.00/.test(txt), pagado:/80\.00/.test(txt),
             balance:/BALANCE/.test(txt), pendientes:/FACTURAS PENDIENTES/.test(txt),
             recibo:/R260815/.test(txt) };
  });
  T('lleva el total facturado', r6.facturado);
  T('lo pagado', r6.pagado);
  T('el balance', r6.balance);
  T('las facturas pendientes', r6.pendientes);
  T('🔑 y el número de recibo del pago', r6.recibo, r6.txt.slice(0,400));

  console.log('\n7️⃣  🔒 LOS PAGOS VIEJOS (sin recibo) NO SE PIERDEN');
  const r7 = await p.evaluate(()=>{
    // Como los de antes del 29 ago: sin recibo, agrupados por fecha
    const vs=LS('nv',[]);
    vs[0].pagosFactura=[{monto:35,fecha:'08/15/2026'}];
    vs[1].pagosFactura=[{monto:15,fecha:'08/15/2026'}];
    vs[2].pagosFactura=[{monto:30,fecha:'08/15/2026'}];
    localStorage.setItem('nv', JSON.stringify(vs)); ventas=LS('nv',[]);
    const cobros=cobrosDelCliente(7);
    return { cuantos:cobros.length, monto:cobros[0].montoCobro, partes:cobros[0].partes.length,
             conRecibo:cobros[0].conRecibo };
  });
  T('🔒 se juntan por fecha y dan $80', r7.cuantos===1 && r7.monto===80, JSON.stringify(r7));
  T('con sus 3 partes', r7.partes===3, String(r7.partes));
  T('y quedan marcados como "sin recibo"', r7.conRecibo===false, String(r7.conRecibo));

  console.log('\n8️⃣  🔒 UN CLIENTE SIN NADA NO REVIENTA');
  const r8 = await p.evaluate(async ()=>{
    localStorage.setItem('ncl', JSON.stringify([{id:9,nombre:'Nuevo',negocio:'X'}]));
    localStorage.setItem('nv','[]');
    clientes=LS('ncl',[]); ventas=LS('nv',[]);
    let err=null;
    try { abrirEstadoDeCuenta(9); } catch(e){ err=e.message; }
    await new Promise(r=>setTimeout(r,250));
    const t=document.getElementById('estado-cuenta-caja').innerText;
    return { err, dice:/Todavía no te ha pagado nada/.test(t), ceros:/\$0\.00/.test(t) };
  });
  T('🔒 no revienta', !r8.err, r8.err||'');
  T('dice que no le ha pagado nada', r8.dice);
  T('y los números salen en cero', r8.ceros);


  console.log('\n9️⃣  ✏️ EL MENSAJE CORTO — cuánto pagó y cuánto queda');
  const r9 = await p.evaluate(async ()=>{
    // Se vuelve a sembrar el caso de los $80
    localStorage.setItem('ncl', JSON.stringify([{id:7,nombre:'Isidro',apellido:'Gonzalez',apodo:'EL FLACO',negocio:'URBAN CUTS',tel:'4015551212'}]));
    localStorage.setItem('nv', JSON.stringify([
      {id:101,cid:7,cn:'Isidro',tipo:'credito',fecha:'07/10/2026',numFactura:'0101',total:35,ganancia:10,
       items:[{nombre:'Gel',cant:1,precio:35,costo:25}],
       pagosFactura:[{pid:'a1',recibo:'R260815-1030-11',montoCobro:80,monto:35,fecha:'08/15/2026',hora:'10:30 AM'}]},
      {id:102,cid:7,cn:'Isidro',tipo:'credito',fecha:'07/20/2026',numFactura:'0102',total:15,ganancia:4,
       items:[{nombre:'Wax',cant:1,precio:15,costo:11}],
       pagosFactura:[{pid:'a2',recibo:'R260815-1030-11',montoCobro:80,monto:15,fecha:'08/15/2026'}]},
      {id:103,cid:7,cn:'Isidro',tipo:'credito',fecha:'08/01/2026',numFactura:'0103',total:55,ganancia:15,
       items:[{nombre:'Clipper',cant:1,precio:55,costo:40}],
       pagosFactura:[{pid:'a3',recibo:'R260815-1030-11',montoCobro:80,monto:30,fecha:'08/15/2026'}]}
    ]));
    clientes=LS('ncl',[]); ventas=LS('nv',[]);
    return { corto: textoCortoParaCliente(7, 80) };
  });
  console.log('     "' + r9.corto + '"');
  T('🔑 dice cuánto pagó', /Recib.* su pago de \$80\.00/.test(r9.corto), r9.corto);
  T('🔑 y cuánto queda pendiente', /balance pendiente es de \$25\.00/.test(r9.corto), r9.corto);
  T('👔 🔑 y le PIDE CONFIRMAR', /Favor confirmar que est. de acuerdo/.test(r9.corto), r9.corto);
  T('👔 y cierra dando las gracias', /Gracias/.test(r9.corto));
  T('👔 saluda con "Hola Sr."', /^Hola Sr\. /.test(r9.corto), r9.corto.split('\n')[0]);
  T('🔒 sigue siendo corto: 4 líneas, no el estado de cuenta entero',
     r9.corto.split('\n').filter(x=>x.trim()).length===4 && r9.corto.length < 200, String(r9.corto.length));
  T('🔒 sin encabezado de negocio ni lista de facturas',
     !/NUNEZ BEAUTY/.test(r9.corto) && !/FACTURAS PENDIENTES/.test(r9.corto), r9.corto);

  console.log('\n🔟  LOS DOS BOTONES ESTÁN, Y SON DISTINTOS');
  const r10 = await p.evaluate(async ()=>{
    abrirEstadoDeCuenta(7);
    await new Promise(r=>setTimeout(r,300));
    const caja=document.getElementById('estado-cuenta-caja');
    const btns=[...caja.querySelectorAll('button')].map(x=>({t:x.textContent.trim(), oc:x.getAttribute('onclick')||''}));
    return {
      completo: btns.some(x=>/estado de cuenta completo/i.test(x.t) && /compartirEstadoDeCuenta/.test(x.oc)),
      corto: btns.some(x=>/cu.nto pag.* y cu.nto queda/i.test(x.t) && /compartirCortoDesdeEstado/.test(x.oc)),
      existeFn: typeof compartirCortoDesdeEstado==='function'
    };
  });
  T('el botón del COMPLETO está', r10.completo);
  T('🔑 el botón del CORTO está, aparte', r10.corto);
  T('y su función existe', r10.existeFn);

  console.log('\n1️⃣1️⃣  🔒 SIN PAGOS, EL CORTO AVISA EN VEZ DE MANDAR ALGO RARO');
  const r11 = await p.evaluate(async ()=>{
    localStorage.setItem('ncl', JSON.stringify([{id:9,nombre:'Nuevo',negocio:'X',tel:'4015550000'}]));
    localStorage.setItem('nv','[]');
    clientes=LS('ncl',[]); ventas=LS('nv',[]);
    abrirEstadoDeCuenta(9);
    await new Promise(r=>setTimeout(r,250));
    let dicho=null; const oa=window.alert; window.alert=(m)=>{dicho=m;};
    let abrio=false; const ow=window.open; window.open=()=>{abrio=true;};
    compartirCortoDesdeEstado();
    window.alert=oa; window.open=ow;
    return { dicho, abrio };
  });
  T('🔒 avisa que no hay pagos', /no te ha pagado nada/.test(r11.dicho||''), (r11.dicho||'').slice(0,80));
  T('🔒 y NO manda nada', !r11.abrio);


  console.log('\n1️⃣2️⃣  💬 EL COMPROBANTE DE UN PAGO VIEJO (lo que pidió el 30 ago)');
  const r12 = await p.evaluate(async ()=>{
    // Dos cobros en fechas distintas: uno viejo y uno nuevo
    localStorage.setItem('ncl', JSON.stringify([{id:7,nombre:'Isidro',apellido:'Gonzalez',negocio:'URBAN CUTS',tel:'4015551212'}]));
    localStorage.setItem('nv', JSON.stringify([
      {id:201,cid:7,cn:'Isidro',tipo:'credito',fecha:'07/01/2026',numFactura:'0201',total:50,ganancia:12,
       items:[{nombre:'Gel',cant:1,precio:50,costo:38}],
       pagosFactura:[{pid:'v1',recibo:'R260705-0900-22',montoCobro:50,monto:50,fecha:'07/05/2026',hora:'9:00 AM',
                      metodos:[{tipo:'efectivo',monto:50}]}]},
      {id:202,cid:7,cn:'Isidro',tipo:'credito',fecha:'08/01/2026',numFactura:'0202',total:90,ganancia:20,
       items:[{nombre:'Clipper',cant:1,precio:90,costo:70}],
       pagosFactura:[{pid:'v2',recibo:'R260820-1500-33',montoCobro:40,monto:40,fecha:'08/20/2026',hora:'3:00 PM'}]}
    ]));
    clientes=LS('ncl',[]); ventas=LS('nv',[]);
    abrirEstadoDeCuenta(7);
    await new Promise(r=>setTimeout(r,300));
    const cobros = cobrosDelCliente(7);
    // El VIEJO es el del 07/05
    const viejo = cobros.find(x=>x.fecha==='07/05/2026');
    const txtViejo = textoDeUnPago(7, viejo, null);
    const cortoViejo = textoCortoParaCliente(7, viejo.montoCobro);
    return { cuantos:cobros.length, ordenPrimero:cobros[0].fecha,
             txtViejo, cortoViejo, reciboViejo: viejo.recibo };
  });
  console.log('     ' + r12.txtViejo.split('\n').slice(0,7).join('\n     '));
  T('hay dos cobros distintos', r12.cuantos===2, String(r12.cuantos));
  T('el más nuevo va primero', r12.ordenPrimero==='08/20/2026', r12.ordenPrimero);
  T('🔑 el comprobante del VIEJO dice su monto ($50.00)', /\$50\.00/.test(r12.txtViejo), r12.txtViejo.slice(0,150));
  T('🔑 y SU fecha (07/05/2026), no la de hoy', /07\/05\/2026/.test(r12.txtViejo), r12.txtViejo.slice(0,150));
  T('🔑 y SU número de recibo', /R260705/.test(r12.txtViejo), r12.reciboViejo);
  T('dice el balance de HOY ($50.00 pendiente)', /balance hoy: \$50\.00/.test(r12.txtViejo), r12.txtViejo.slice(-160));
  T('el corto del viejo también da $50.00', /Recib.* su pago de \$50\.00/.test(r12.cortoViejo), r12.cortoViejo);

  console.log('\n1️⃣3️⃣  LOS BOTONES ESTÁN EN CADA PAGO');
  const r13 = await p.evaluate(async ()=>{
    // Se abre el pago VIEJO
    const cobros = cobrosDelCliente(7);
    const viejo = cobros.find(x=>x.fecha==='07/05/2026');
    toggleCobroEstado(viejo.clave);
    await new Promise(r=>setTimeout(r,250));
    const caja=document.getElementById('estado-cuenta-caja');
    const btns=[...caja.querySelectorAll('button')].map(x=>x.getAttribute('onclick')||'');
    return {
      completo: btns.filter(x=>/mandarComprobanteDeEstePago\([^,]+, 1\)/.test(x)).length,
      corto: btns.filter(x=>/mandarComprobanteDeEstePago\([^,]+, 0\)/.test(x)).length,
      llevanLaClave: btns.some(x=>/R260705/.test(x))
    };
  });
  T('🔑 el pago abierto tiene su botón de Comprobante', r13.completo===1, String(r13.completo));
  T('🔑 y su botón de Solo el corto', r13.corto===1, String(r13.corto));
  T('y apuntan a ESE pago, no a otro', r13.llevanLaClave, JSON.stringify(r13));

  console.log('\n1️⃣4️⃣  🔒 AVISA QUE EL BALANCE ES EL DE HOY');
  const r14 = await p.evaluate(()=>{
    const cobros = cobrosDelCliente(7);
    const viejo = cobros.find(x=>x.fecha==='07/05/2026');
    let preg=null; const oc=window.confirm; window.confirm=(m)=>{preg=m; return false;};
    let abrio=false; const ow=window.open; window.open=()=>{abrio=true;};
    mandarComprobanteDeEstePago(viejo.clave, 1);
    window.confirm=oc; window.open=ow;
    return { preg, abrio };
  });
  T('🔒 avisa que el balance es el de HOY', /balance que sale es el de HOY/.test(r14.preg||''), (r14.preg||'').slice(-120));
  T('🔒 y si dices que no, no manda nada', !r14.abrio);


  console.log('\n1️⃣5️⃣  🔴 EL BOTÓN ESTÁ EN LA FICHA DEL CLIENTE (lo que faltaba el 30 ago)');
  const r15 = await p.evaluate(async ()=>{
    localStorage.setItem('ncl', JSON.stringify([{id:26,nombre:'Carlos',apellido:'Tavarez',negocio:'LUXURY',tel:'4015168653'}]));
    localStorage.setItem('nv', JSON.stringify([
      {id:301,cid:26,cn:'Carlos',tipo:'credito',fecha:'07/01/2026',total:262,ganancia:60,
       items:[{nombre:'Gel',cant:1,precio:262,costo:202}],
       pagosFactura:[{pid:'x1',recibo:'R260710-1000-55',montoCobro:260,monto:260,fecha:'07/10/2026'}]}
    ]));
    clientes=LS('ncl',[]); ventas=LS('nv',[]);
    // ⚠️ Se abre como lo hace la app: verCl() es quien CREA el contenedor y luego pinta.
    // Llamar a pintarPanelCliente() a secas no sirve: el contenedor todavía no existe.
    verCl(26);
    await new Promise(r=>setTimeout(r,450));
    const pg=document.getElementById('p-cl-perfil');
    const btn=[...pg.querySelectorAll('button')].find(x=>/Estado de cuenta/.test(x.textContent||''));
    return { hay: !!btn, oc: btn?btn.getAttribute('onclick'):null,
             alto: btn?Math.round(btn.getBoundingClientRect().height):0,
             // ¿está ANTES de "Sus datos"?
             antesDeDatos: btn ? (pg.innerHTML.indexOf('Estado de cuenta') < pg.innerHTML.indexOf('Sus datos')) : false };
  });
  T('🔴 el botón EXISTE en la ficha', r15.hay, JSON.stringify(r15));
  T('llama a abrirEstadoDeCuenta', /abrirEstadoDeCuenta/.test(r15.oc||''), r15.oc);
  T('se ve (tiene alto)', r15.alto > 20, String(r15.alto));
  T('y va antes de "Sus datos"', r15.antesDeDatos);

  console.log('\n1️⃣6️⃣  Y AL TOCARLO SE ABRE');
  const r16 = await p.evaluate(async ()=>{
    const pg=document.getElementById('p-cl-perfil');
    const btn=[...pg.querySelectorAll('button')].find(x=>/Estado de cuenta/.test(x.textContent||''));
    btn.click();
    await new Promise(r=>setTimeout(r,350));
    const caja=document.getElementById('estado-cuenta-caja');
    return { abrio: !!caja && caja.innerText.length>50, texto: caja?caja.innerText.slice(0,80):'' };
  });
  T('🔑 se abre el estado de cuenta', r16.abrio, r16.texto.replace(/\n/g,' | '));

  console.log('\n1️⃣7️⃣  🔑 EL COBRO COMPLETO Y EL RECIBO, DE VERDAD');
  const r17 = await p.evaluate(()=>{
    // 🔴 Huecos que destapó la mutación: no se comprobaba que el monto del cobro
    // completo saliera del dato guardado, ni que todas las partes compartieran recibo.
    localStorage.setItem('ncl', JSON.stringify([{id:7,nombre:'Isidro',negocio:'URBAN',tel:'4015551212'}]));
    localStorage.setItem('nv', JSON.stringify([
      {id:401,cid:7,cn:'Isidro',tipo:'credito',fecha:'07/10/2026',total:35,ganancia:10,
       items:[{nombre:'x',cant:1,precio:35,costo:25}],
       pagosFactura:[{pid:'a',recibo:'RX-1',montoCobro:80,monto:35,fecha:'08/15/2026'}]},
      {id:402,cid:7,cn:'Isidro',tipo:'credito',fecha:'07/20/2026',total:15,ganancia:4,
       items:[{nombre:'x',cant:1,precio:15,costo:11}],
       pagosFactura:[{pid:'b',recibo:'RX-1',montoCobro:80,monto:15,fecha:'08/15/2026'}]},
      {id:403,cid:7,cn:'Isidro',tipo:'credito',fecha:'08/01/2026',total:55,ganancia:15,
       items:[{nombre:'x',cant:1,precio:55,costo:40}],
       pagosFactura:[{pid:'c',recibo:'RX-1',montoCobro:80,monto:30,fecha:'08/15/2026'}]}
    ]));
    clientes=LS('ncl',[]); ventas=LS('nv',[]);
    const c = cobrosDelCliente(7);
    return { cuantos: c.length, monto: c[0] ? c[0].montoCobro : null,
             partes: c[0] ? c[0].partes.length : 0,
             recibo: c[0] ? c[0].recibo : null,
             conRecibo: c[0] ? c[0].conRecibo : null };
  });
  T('🔑 los 3 pagos se juntan en UNO solo', r17.cuantos===1, String(r17.cuantos));
  T('🔑 y ese uno dice $80.00, el cobro COMPLETO', r17.monto===80, String(r17.monto));
  T('con sus 3 partes', r17.partes===3, String(r17.partes));
  T('🔑 y lleva SU número de recibo', r17.recibo==='RX-1', String(r17.recibo));
  T('marcado como que SÍ tiene recibo', r17.conRecibo===true, String(r17.conRecibo));

  console.log('\n1️⃣8️⃣  🔑 UN COBRO NUEVO REPARTE EL MISMO RECIBO');
  const r18 = await p.evaluate(()=>{
    // Que el código de aplicar el pago dé UN solo recibo a todas las partes
    const html = document.documentElement.innerHTML;
    return {
      unSoloRecibo: /var _recibo = nuevoNumeroRecibo\(\);/.test(html),
      seLoPoneACadaParte: /recibo: _recibo,/.test(html),
      guardaElCompleto: /montoCobro: total,/.test(html)
    };
  });
  T('🔑 se saca UN número de recibo por cobro', r18.unSoloRecibo);
  T('🔑 y se le pone a CADA parte', r18.seLoPoneACadaParte);
  T('con el monto del cobro completo', r18.guardaElCompleto);

  console.log(`\n  ${ok} bien · ${mal} mal`);
  const reales=errs.filter(e=>!/firebase|onAuthStateChanged/i.test(e));
  if(reales.length){ console.log('⚠️ JS:'); reales.forEach(e=>console.log('   '+e)); }
  await b.close();
  process.exit(mal||reales.length?1:0);
})();
