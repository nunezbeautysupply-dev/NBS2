const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({viewport:{width:390,height:1200}});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file:///home/claude/trabajo/index.html');
  await p.waitForTimeout(2500);
  await p.evaluate(()=>{ window.fbDb={ref:()=>({set(){},update(){},on(){},once(){return Promise.resolve({val:()=>null});}})};
    window.protegerConHuella=function(cb){ cb(); }; });
  let ok=0,mal=0;
  const T=(n,c,d)=>{ if(c){ok++;console.log('  ✅ '+n);} else {mal++;console.log('  ❌ '+n+(d?'  →  '+d:''));} };

  const abrir = async () => await p.evaluate(async ()=>{
    ['pantalla-login','pantalla-bloqueo'].forEach(id=>{const e=document.getElementById(id); if(e) e.style.display='none';});
    const a=document.getElementById('app-contenido'); if(a) a.style.display='block';
    localStorage.setItem('ncl', JSON.stringify([{id:11,nombre:'Nelson',apellido:'Castro',apodo:'TITO',negocio:'RD BARBERSHOP'}]));
    localStorage.setItem('nv', JSON.stringify([
      {id:1,cid:11,cn:'Nelson',tipo:'credito',fecha:'06/24/2026',hora:'11:45 AM',total:45,ganancia:10,
       items:[{nombre:'x',cant:1,precio:45,costo:35}],pagosFactura:[{pid:'a',monto:45,fecha:'06/24/2026'}]},
      {id:2,cid:11,cn:'Nelson',tipo:'contado',fecha:'07/08/2026',hora:'4:30 PM',total:10,ganancia:3,
       items:[{nombre:'x',cant:1,precio:10,costo:7}],pagosFactura:[]},
      {id:5,cid:11,cn:'Nelson',tipo:'credito',fecha:'08/12/2026',hora:'6:42 PM',total:70,ganancia:18,
       items:[{nombre:'x',cant:3,precio:23,costo:17}],pagosFactura:[{pid:'b',monto:20,fecha:'08/13/2026'}]},
      {id:6,cid:11,cn:'Nelson',tipo:'credito',fecha:'08/19/2026',hora:'4:12 PM',total:40,ganancia:11,
       items:[{nombre:'x',cant:4,precio:10,costo:7}],pagosFactura:[]},
      {id:7,cid:11,cn:'Nelson',tipo:'credito',fecha:'07/02/2026',hora:'1:00 PM',total:25,ganancia:6,
       items:[{nombre:'x',cant:2,precio:12.5,costo:9}],pagosFactura:[]}
    ]));
    clientes=LS('ncl',[]); ventas=LS('nv',[]);
    ir('p-cxc'); renderCxC('');
    await new Promise(r=>setTimeout(r,300));
    abrirAbono(11);
    await new Promise(r=>setTimeout(r,400));
    const el=document.getElementById('cxc-facturas');
    return { html: el.innerHTML, texto: el.innerText };
  });

  const r = await abrir();

  console.log('\n1️⃣  LA MÁS VIEJA VA PRIMERA Y MARCADA');
  T('sale el rótulo "LA MÁS VIEJA"', /LA M.?S VIEJA/.test(r.texto), r.texto.slice(0,150).replace(/\n/g,' | '));
  const pos = {
    v0702: r.texto.indexOf('07/02/2026'),
    v0812: r.texto.indexOf('08/12/2026'),
    v0819: r.texto.indexOf('08/19/2026')
  };
  console.log('     orden: ' + JSON.stringify(pos));
  T('🔑 la del 07/02 (la más vieja que debe) va PRIMERA',
     pos.v0702 >= 0 && pos.v0702 < pos.v0812 && pos.v0702 < pos.v0819, JSON.stringify(pos));
  T('después la del 08/12', pos.v0812 < pos.v0819, JSON.stringify(pos));

  console.log('\n2️⃣  EL SALDO DE LA MÁS VIEJA, MÁS GRANDE');
  const r2 = await p.evaluate(()=>{
    const el=document.getElementById('cxc-facturas');
    return [...el.querySelectorAll('div')].filter(x=>x.children.length===0 && /^\$[\d,.]+$/.test((x.textContent||'').trim()) && getComputedStyle(x).fontWeight==='900')
      .map(x=>({txt:x.textContent.trim(), tam:getComputedStyle(x).fontSize}));
  });
  console.log('     saldos: ' + JSON.stringify(r2));
  T('salen 3 saldos (las 3 que deben)', r2.length===3, String(r2.length));
  T('🔑 el primero es más grande que los otros',
     r2.length===3 && parseFloat(r2[0].tam) > parseFloat(r2[1].tam), JSON.stringify(r2.map(x=>x.tam)));
  T('el primero es $25.00 (la del 07/02)', r2[0] && r2[0].txt==='$25.00', r2[0]&&r2[0].txt);

  console.log('\n3️⃣  LAS PAGADAS, EN UNA LÍNEA');
  T('sale el rótulo YA SALDADAS', /YA SALDADAS/.test(r.texto), r.texto.slice(-260).replace(/\n/g,' | '));
  T('la del 06/24 (pagada) aparece', /06\/24\/2026/.test(r.texto));
  T('🔑 y va DESPUÉS de las que deben',
     r.texto.indexOf('06/24/2026') > pos.v0819, 'orden');
  T('la de contado pagada NO ensucia la lista de las que deben',
     r.texto.indexOf('07/08/2026') < 0 || r.texto.indexOf('07/08/2026') > r.texto.indexOf('YA SALDADAS'),
     'contado');

  console.log('\n4️⃣  🔒 SE PUEDE SEGUIR COBRANDO');
  const r4 = await p.evaluate(()=>{
    const el=document.getElementById('cxc-facturas');
    const b=[...el.querySelectorAll('button')].map(x=>x.textContent.trim());
    return { pagarTodo: b.filter(x=>/Pagar todo en efectivo/.test(x)).length,
             registrar: b.filter(x=>/Registrar pago/.test(x)).length,
             verFactura: b.filter(x=>/Ver factura completa/.test(x)).length };
  });
  T('3 botones de "Pagar todo en efectivo" (uno por cada que debe)', r4.pagarTodo===3, String(r4.pagarTodo));
  T('3 botones de "Registrar pago"', r4.registrar===3, String(r4.registrar));
  T('y su botón de ver factura', r4.verFactura===3, String(r4.verFactura));

  console.log('\n5️⃣  🔒 UN CLIENTE QUE NO DEBE NADA');
  const r5 = await p.evaluate(async ()=>{
    const vs=LS('nv',[]); vs.forEach(v=>{ v.pagosFactura=[{pid:'z',monto:v.total,fecha:'08/20/2026'}]; });
    localStorage.setItem('nv', JSON.stringify(vs)); ventas=LS('nv',[]);
    abrirAbono(11);
    await new Promise(r=>setTimeout(r,300));
    const el=document.getElementById('cxc-facturas');
    return { texto: el.innerText, botones: [...el.querySelectorAll('button')].filter(x=>/Pagar todo|Registrar pago/.test(x.textContent)).length };
  });
  T('dice "TODAS SALDADAS"', /TODAS SALDADAS/.test(r5.texto), r5.texto.slice(0,140).replace(/\n/g,' | '));
  T('no marca ninguna como la más vieja', !/LA M.?S VIEJA/.test(r5.texto));
  T('🔒 y no ofrece cobrar nada', r5.botones===0, String(r5.botones));

  console.log('\n6️⃣  🔒 CON UNA SOLA QUE DEBE, NO DICE "LA MÁS VIEJA"');
  const r6 = await p.evaluate(async ()=>{
    const vs=LS('nv',[]);
    vs.find(v=>v.id===6).pagosFactura=[];
    localStorage.setItem('nv', JSON.stringify(vs)); ventas=LS('nv',[]);
    abrirAbono(11);
    await new Promise(r=>setTimeout(r,300));
    return document.getElementById('cxc-facturas').innerText;
  });
  T('con una sola pendiente, sin rótulo de más vieja', !/LA M.?S VIEJA/.test(r6), r6.slice(0,120).replace(/\n/g,' | '));

  console.log(`\n  ${ok} bien · ${mal} mal`);
  const reales=errs.filter(e=>!/firebase|onAuthStateChanged/i.test(e));
  if(reales.length){ console.log('⚠️ JS:'); reales.forEach(e=>console.log('   '+e)); }
  await b.close();
  process.exit(mal||reales.length?1:0);
})();
