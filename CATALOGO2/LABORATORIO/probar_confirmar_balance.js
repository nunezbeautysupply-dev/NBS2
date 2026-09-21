const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({viewport:{width:390,height:1100}});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file:///home/claude/trabajo/index.html');
  await p.waitForTimeout(2500);
  let ok=0,mal=0;
  const T=(n,c,d)=>{ if(c){ok++;console.log('  ✅ '+n);} else {mal++;console.log('  ❌ '+n+(d?'  →  '+d:''));} };

  const sembrar = async () => await p.evaluate(async ()=>{
    ['pantalla-login','pantalla-bloqueo'].forEach(id=>{const e=document.getElementById(id); if(e) e.style.display='none';});
    const a=document.getElementById('app-contenido'); if(a) a.style.display='block';
    localStorage.setItem('ncl', JSON.stringify([
      {id:26,nombre:'Carlos',apellido:'Tavarez',negocio:'LUXURY',tel:'4015168653'},
      {id:27,nombre:'Jorge',apellido:'Duarte',negocio:'GRAN VIA',tel:'4015550001'},
      {id:28,nombre:'Ana',apellido:'Solis',negocio:'AL DIA',tel:'4015550002'}]));
    localStorage.setItem('nv', JSON.stringify([
      {id:301,cid:26,cn:'Carlos',tipo:'credito',fecha:'07/01/2026',total:262,ganancia:60,
       items:[{nombre:'Gel',cant:1,precio:262,costo:202}],
       pagosFactura:[{pid:'x',recibo:'R1',montoCobro:120,monto:120,fecha:'07/10/2026'}]},
      {id:302,cid:27,cn:'Jorge',tipo:'credito',fecha:'08/01/2026',total:80,ganancia:20,
       items:[{nombre:'Wax',cant:1,precio:80,costo:60}],pagosFactura:[]},
      {id:303,cid:28,cn:'Ana',tipo:'contado',fecha:'08/01/2026',total:40,ganancia:10,
       items:[{nombre:'Clip',cant:1,precio:40,costo:30}],pagosFactura:[{pid:'y',monto:40,fecha:'08/01/2026'}]}
    ]));
    localStorage.removeItem('nconfirmaciones');
    clientes=LS('ncl',[]); ventas=LS('nv',[]);
  });

  console.log('\n1️⃣  EL BALANCE SE CALCULA CON LA REGLA ÚNICA');
  await sembrar();
  const r1 = await p.evaluate(()=>({ carlos: balanceDelCliente(26), jorge: balanceDelCliente(27), ana: balanceDelCliente(28) }));
  T('Carlos debe $142.00 (262 − 120)', Math.abs(r1.carlos-142)<0.005, String(r1.carlos));
  T('Jorge debe $80.00', Math.abs(r1.jorge-80)<0.005, String(r1.jorge));
  T('🔒 Ana no debe nada (pagó al contado)', r1.ana===0, String(r1.ana));

  console.log('\n2️⃣  🔑 QUIÉN LE FALTA CONFIRMAR');
  const r2 = await p.evaluate(()=>({
    carlos: leFaltaConfirmar(26), jorge: leFaltaConfirmar(27), ana: leFaltaConfirmar(28),
    lista: clientesSinConfirmar().map(x=>({n:x.nombre, d:x.debe}))
  }));
  console.log('     ' + JSON.stringify(r2.lista));
  T('a Carlos le falta', r2.carlos===true);
  T('a Jorge le falta', r2.jorge===true);
  T('🔒 a Ana NO: no debe nada', r2.ana===false);
  T('🔑 la lista trae 2, ordenados por lo que deben', r2.lista.length===2 && r2.lista[0].d===142, JSON.stringify(r2.lista));

  console.log('\n3️⃣  ✍️ LA PANTALLA DE FIRMA');
  const r3 = await p.evaluate(async ()=>{
    abrirConfirmacionBalance(26, 120);
    await new Promise(r=>setTimeout(r,300));
    const ov=document.getElementById('confirmar-balance-overlay');
    return { abrio: !!ov && ov.style.display!=='none',
             texto: ov?ov.innerText:'',
             hayCanvas: !!document.getElementById('firma-canvas') };
  });
  T('la pantalla abre', r3.abrio);
  T('dice su nombre', /Carlos Tavarez/.test(r3.texto));
  T('🔑 enseña el balance grande: $142.00', /\$142\.00/.test(r3.texto), r3.texto.slice(0,180).replace(/\n/g,' | '));
  T('y lo que pagó hoy: $120.00', /\$120\.00/.test(r3.texto));
  T('✍️ hay recuadro para firmar', r3.hayCanvas);

  console.log('\n4️⃣  🔒 SIN FIRMA NO SE GUARDA');
  const r4 = await p.evaluate(async ()=>{
    let dicho=null; const oa=window.alert; window.alert=(m)=>{dicho=m;};
    guardarConfirmacionBalance();
    window.alert=oa;
    return { dicho, cuantas: LS('nconfirmaciones',[]).length };
  });
  T('🔒 avisa que falta la firma', /Falta la firma/.test(r4.dicho||''), (r4.dicho||'').slice(0,60));
  T('🔒 y no guarda nada', r4.cuantas===0, String(r4.cuantas));

  console.log('\n5️⃣  🔑 CON FIRMA SÍ SE GUARDA');
  const r5 = await p.evaluate(async ()=>{
    // Se finge un trazo, como si hubiera firmado
    const cv=document.getElementById('firma-canvas');
    const ctx=cv.getContext('2d');
    ctx.beginPath(); ctx.moveTo(20,60); ctx.lineTo(200,90); ctx.stroke();
    _firmaHayTrazo = true;
    const oa=window.alert; let dicho=null; window.alert=(m)=>{dicho=m;};
    guardarConfirmacionBalance();
    await new Promise(r=>setTimeout(r,200));
    window.alert=oa;
    const c=LS('nconfirmaciones',[])[0];
    return { dicho, cuantas: LS('nconfirmaciones',[]).length, conf: c };
  });
  T('se guardó la confirmación', r5.cuantas===1, String(r5.cuantas));
  T('🔑 con el balance confirmado ($142.00)', r5.conf && Math.abs(r5.conf.balance-142)<0.005, r5.conf&&r5.conf.balance);
  T('🔑 y con la FIRMA guardada', r5.conf && /^data:image/.test(r5.conf.firma||''), (r5.conf&&r5.conf.firma||'').slice(0,25));
  T('con su fecha y hora', r5.conf && !!r5.conf.fecha && !!r5.conf.hora, r5.conf&&(r5.conf.fecha+' '+r5.conf.hora));
  T('y lo que pagó ese día', r5.conf && r5.conf.pagado===120, r5.conf&&r5.conf.pagado);
  T('el aviso lo confirma', /confirmado y firmado/i.test(r5.dicho||''), (r5.dicho||'').slice(0,60));

  console.log('\n6️⃣  🔑 YA NO LE FALTA CONFIRMAR');
  const r6 = await p.evaluate(()=>({ falta: leFaltaConfirmar(26), lista: clientesSinConfirmar().map(x=>x.nombre) }));
  T('🔑 Carlos ya confirmó', r6.falta===false, String(r6.falta));
  T('y sale de la lista: queda solo Jorge', r6.lista.length===1 && /Jorge/.test(r6.lista[0]), JSON.stringify(r6.lista));

  console.log('\n7️⃣  🔑 SI EL BALANCE CAMBIA, VUELVE A HACER FALTA');
  const r7 = await p.evaluate(()=>{
    // Le vendes otra cosa: su balance cambia
    const vs=LS('nv',[]);
    vs.push({id:304,cid:26,cn:'Carlos',tipo:'credito',fecha:'08/25/2026',total:50,ganancia:12,
             items:[{nombre:'Wax',cant:1,precio:50,costo:38}],pagosFactura:[]});
    localStorage.setItem('nv', JSON.stringify(vs)); ventas=LS('nv',[]);
    return { debe: balanceDelCliente(26), falta: leFaltaConfirmar(26) };
  });
  T('su balance subió a $192.00', Math.abs(r7.debe-192)<0.005, String(r7.debe));
  T('🔑 y le vuelve a hacer falta confirmar', r7.falta===true, String(r7.falta));

  console.log('\n8️⃣  🔴 LOS BOTONES ESTÁN EN LA PANTALLA');
  const r8 = await p.evaluate(async ()=>{
    verCl(26);
    await new Promise(r=>setTimeout(r,450));
    const pg=document.getElementById('p-cl-perfil');
    // El texto cambió el 30 ago: ahora dice "Que firme su balance ... · opcional"
    const btn=[...pg.querySelectorAll('button')].find(x=>/firme su balance|Firmó su balance/.test(x.textContent||''));
    // Y el de la lista, en el menú
    const menu=document.getElementById('menu-lateral');
    const btnLista=[...menu.querySelectorAll('button')].find(x=>/Balances sin confirmar/.test(x.textContent||''));
    return { enFicha: !!btn, texto: btn?btn.textContent.trim():null,
             enMenu: !!btnLista, ocMenu: btnLista?btnLista.getAttribute('onclick'):null };
  });
  T('🔴 el botón está en la ficha del cliente', r8.enFicha, r8.texto);
  T('y dice el balance a confirmar', /\$192\.00/.test(r8.texto||''), r8.texto);
  T('🔴 y la lista está en el menú', r8.enMenu, r8.ocMenu);

  console.log('\n9️⃣  🔒 A UN CLIENTE SIN DEUDA NO SE LE PIDE NADA');
  const r9 = await p.evaluate(async ()=>{
    verCl(28);   // Ana, que no debe
    await new Promise(r=>setTimeout(r,400));
    const pg=document.getElementById('p-cl-perfil');
    const btn=[...pg.querySelectorAll('button')].find(x=>/firme su balance|Firmó su balance/.test(x.textContent||''));
    return { hayBoton: !!btn };
  });
  T('🔒 no le sale el botón de confirmar', !r9.hayBoton);

  console.log('\n🔟  📋 LA LISTA SE VE');
  const r10 = await p.evaluate(async ()=>{
    verSinConfirmar();
    await new Promise(r=>setTimeout(r,300));
    const ov=document.getElementById('sinconf-overlay');
    return { abrio: !!ov, texto: ov?ov.innerText:'' };
  });
  T('la lista abre', r10.abrio);
  T('sale Carlos con sus $192.00', /Carlos/.test(r10.texto) && /\$192\.00/.test(r10.texto), r10.texto.slice(0,200).replace(/\n/g,' | '));
  T('y Jorge con sus $80.00', /Jorge/.test(r10.texto) && /\$80\.00/.test(r10.texto));
  T('🔒 Ana NO sale (no debe nada)', !/Ana/.test(r10.texto));
  T('dice cuánto hay sin confirmar en total', /\$272\.00/.test(r10.texto), r10.texto.slice(0,160).replace(/\n/g,' | '));

  console.log('\n1️⃣1️⃣  🔙 EL BOTÓN ATRÁS LOS CIERRA');
  const r11 = await p.evaluate(()=>{
    const ids = RECUADROS_ENCIMA.map(x=>x.id);
    return { conf: ids.includes('confirmar-balance-overlay'), lista: ids.includes('sinconf-overlay') };
  });
  T('🔙 la pantalla de firma está en la lista del botón atrás', r11.conf);
  T('🔙 y la de balances sin confirmar también', r11.lista);


  console.log('\n1️⃣2️⃣  🔑 LA FIRMA ES SEGUNDA OPCIÓN, NO LA PRINCIPAL');
  const r12 = await p.evaluate(async ()=>{
    SS('nbs_pedir_firma','1');
    ofrecerMensajeAlCliente(26,'pago',120,null);
    await new Promise(r=>setTimeout(r,350));
    const ov=document.getElementById('avisar-cliente-overlay');
    const btns=[...ov.querySelectorAll('button')].map(x=>x.textContent.trim());
    return { btns, txt: ov.innerText,
             htmlSuelto: /cursor:pointer|margin-top:/.test(ov.innerText) };
  });
  console.log('     ' + JSON.stringify(r12.btns));
  T('🔑 el COMPLETO va primero', /Mandar el completo/.test(r12.btns[0]||''), r12.btns[0]);
  T('🔑 el CORTO va segundo', /Mandar solo el corto/.test(r12.btns[1]||''), r12.btns[1]);
  T('🔑 la FIRMA va después, como opción', /firme su balance/.test(r12.btns[2]||''), r12.btns[2]);
  T('y "Ahora no" queda al final', /Ahora no/.test(r12.btns[3]||''), r12.btns[3]);
  T('👉 dice que es OPCIONAL', /OPCIONAL/.test(r12.txt) && /solo si lo crees necesario/.test(r12.txt), r12.txt.slice(-200).replace(/\n/g,' | '));
  T('🔒 y no sale HTML escrito en pantalla', !r12.htmlSuelto);

  console.log('\n1️⃣3️⃣  🔕 SE PUEDE APAGAR DEL TODO');
  const r13 = await p.evaluate(async ()=>{
    SS('nbs_pedir_firma','0');
    cerrarAvisoCliente();
    ofrecerMensajeAlCliente(26,'pago',120,null);
    await new Promise(r=>setTimeout(r,300));
    const ov=document.getElementById('avisar-cliente-overlay');
    const enAviso = [...ov.querySelectorAll('button')].some(x=>/firme su balance/.test(x.textContent||''));
    cerrarAvisoCliente();
    verCl(26);
    await new Promise(r=>setTimeout(r,400));
    const pg=document.getElementById('p-cl-perfil');
    const enFicha = [...pg.querySelectorAll('button')].some(x=>/firme su balance|Firmó su balance/.test(x.textContent||''));
    SS('nbs_pedir_firma','1');
    return { enAviso, enFicha, existeFn: typeof cambiarModoFirmaBalance==='function' };
  });
  T('🔕 apagada: NO sale después de cobrar', !r13.enAviso);
  T('🔕 apagada: NO sale en la ficha del cliente', !r13.enFicha);
  T('el interruptor existe en el menú', r13.existeFn);

  console.log('\n1️⃣4️⃣  🔒 Y AL PRENDERLA VUELVE');
  const r14 = await p.evaluate(async ()=>{
    SS('nbs_pedir_firma','1');
    verCl(26);
    await new Promise(r=>setTimeout(r,400));
    const pg=document.getElementById('p-cl-perfil');
    const btn=[...pg.querySelectorAll('button')].find(x=>/firme su balance|Firmó su balance/.test(x.textContent||''));
    return { hay: !!btn, txt: btn?btn.textContent.trim():null };
  });
  T('🔒 prendida: vuelve a salir en la ficha', r14.hay, r14.txt);
  T('y dice "opcional"', /opcional/i.test(r14.txt||''), r14.txt);

  console.log(`\n  ${ok} bien · ${mal} mal`);
  const reales=errs.filter(e=>!/firebase|onAuthStateChanged/i.test(e));
  if(reales.length){ console.log('⚠️ JS:'); reales.forEach(e=>console.log('   '+e)); }
  await b.close();
  process.exit(mal||reales.length?1:0);
})();
