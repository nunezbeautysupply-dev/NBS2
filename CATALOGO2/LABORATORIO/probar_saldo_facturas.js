const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file:///home/claude/trabajo/index.html');
  await p.waitForTimeout(2500);
  await p.evaluate(()=>{ window.fbDb={ref:()=>({set(){},update(){},on(){},once(){return Promise.resolve({val:()=>null});}})}; });

  let ok=0,mal=0;
  const T=(n,c,d)=>{ if(c){ok++;console.log('  ✅ '+n);} else {mal++;console.log('  ❌ '+n+(d?'  →  '+d:''));} };

  // ═══ SU CASO EXACTO: Nelson Castro "TITO" ═══
  console.log('\n1️⃣  EL CASO DE NELSON CASTRO "TITO", con sus números de verdad');
  const r1 = await p.evaluate(()=>{
    localStorage.setItem('ncl', JSON.stringify([{id:11, nombre:'Nelson Castro De La Cruz', apodo:'TITO', negocio:'RD BARBERSHOP'}]));
    localStorage.setItem('nv', JSON.stringify([
      {id:1,cid:11,cn:'Nelson',numFactura:'0601',tipo:'credito',fecha:'06/24/2026',hora:'11:45 a.m.',
       total:45,ganancia:10,items:[{nombre:'x',cant:1,precio:45,costo:35}],pagosFactura:[{monto:45,fecha:'06/24/2026'}]},
      {id:2,cid:11,cn:'Nelson',numFactura:'0702',tipo:'contado',fecha:'07/08/2026',hora:'04:30 p.m.',
       total:10,ganancia:3,items:[{nombre:'x',cant:1,precio:10,costo:7}],pagosFactura:[]},          // ← LA DEL LÍO
      {id:3,cid:11,cn:'Nelson',numFactura:'0703',tipo:'credito',fecha:'07/15/2026',hora:'12:07 p.m.',
       total:45,ganancia:10,items:[{nombre:'x',cant:3,precio:15,costo:12}],pagosFactura:[{monto:45,fecha:'07/15/2026'}]},
      {id:4,cid:11,cn:'Nelson',numFactura:'0704',tipo:'credito',fecha:'07/29/2026',hora:'4:43 PM',
       total:10,ganancia:3,items:[{nombre:'x',cant:1,precio:10,costo:7}],pagosFactura:[{monto:10,fecha:'07/29/2026'}]},
      {id:5,cid:11,cn:'Nelson',numFactura:'0801',tipo:'credito',fecha:'08/12/2026',hora:'6:42 PM',
       total:70,ganancia:18,items:[{nombre:'x',cant:3,precio:23.33,costo:17}],pagosFactura:[{monto:20,fecha:'08/13/2026'}]},
      {id:6,cid:11,cn:'Nelson',numFactura:'0802',tipo:'credito',fecha:'08/19/2026',hora:'4:12 PM',
       total:40,ganancia:11,items:[{nombre:'x',cant:4,precio:10,costo:7}],pagosFactura:[{monto:40,fecha:'08/19/2026'}]}
    ]));
    clientes=LS('ncl',[]); ventas=LS('nv',[]);
    const D = datosDelCliente(11);
    const porFactura = LS('nv',[]).map(v=>({ f:v.fecha, tipo:v.tipo, total:v.total, debe: cobradoYDebeDe(v).debe }));
    return { comprado: D.comprado, pagado: D.pagado, debe: D.debe, porFactura,
             sumaDebes: porFactura.reduce((a,x)=>a+x.debe,0) };
  });
  console.log('     por factura: ' + r1.porFactura.map(x=>`${x.f} ${x.tipo} $${x.total}→debe $${x.debe}`).join(' | '));
  T('COMPRÓ = $220.00', Math.abs(r1.comprado-220)<0.005, String(r1.comprado));
  T('DEBE de arriba = $50.00', Math.abs(r1.debe-50)<0.005, String(r1.debe));
  T('🔴 la de CONTADO del 07/08 ya NO dice que debe',
     Math.abs(r1.porFactura[1].debe)<0.005, JSON.stringify(r1.porFactura[1]));
  T('la del 08/12 sí debe $50 (70 − 20)', Math.abs(r1.porFactura[4].debe-50)<0.005, JSON.stringify(r1.porFactura[4]));
  T('🔑 la suma de los renglones CUADRA con el DEBE de arriba ($50)',
     Math.abs(r1.sumaDebes - r1.debe)<0.005, r1.sumaDebes+' vs '+r1.debe);

  console.log('\n2️⃣  EL RENGLÓN EN PANTALLA — lo que él ve');
  const r2 = await p.evaluate(async ()=>{
    // La ficha se pinta dentro de este contenedor. Se lee su HTML, no el texto de la
    // pantalla: el login tapa todo y body.innerText devolveria la pantalla de entrar.
    var _c = document.getElementById('cl-panel-completo');
    if(!_c){ _c = document.createElement('div'); _c.id='cl-panel-completo'; document.body.appendChild(_c); }
    // El panel de facturas nace cerrado. Se abre como cuando el lo toca.
    _panelAbierto = 'facturas';
    pintarPanelCliente(11);
    await new Promise(r=>setTimeout(r,400));
    const html = _c.innerHTML || '';
    return { zona: html.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').slice(0,4000),
             // Desde el 21 ago el renglon dice "DEBE" arriba y el monto grande debajo.
             cuantosDebe: (html.match(/>DEBE</g)||[]).length,
             dice10: /\$10\.00<\/div>[\s\S]{0,40}$/.test('') || /DEBE[\s\S]{0,200}?\$10\.00/.test(html),
             dice50: /DEBE[\s\S]{0,200}?\$50\.00/.test(html) };
  });
  T('🔴 la de contado del 07/08 NO sale como que debe', !r2.dice10, r2.zona.slice(0,200));
  T('la del 08/12 sí sale debiendo $50.00', r2.dice50, r2.zona.slice(0,200));
  T('solo UNA factura sale como que debe', r2.cuantosDebe===1, String(r2.cuantosDebe));

  console.log('\n3️⃣  🔒 UN CONTADO QUE SÍ DEBE (modificado) NO SE PUEDE ESCONDER');
  const r3 = await p.evaluate(()=>{
    const vs = LS('nv',[]);
    vs.push({id:9,cid:11,cn:'Nelson',numFactura:'0900',tipo:'contado',fecha:'08/18/2026',hora:'1:00 PM',
             total:30,ganancia:8,items:[{nombre:'y',cant:1,precio:30,costo:22}],
             pagosFactura:[{monto:20,fecha:'08/18/2026'}], modificada:true});
    localStorage.setItem('nv', JSON.stringify(vs)); ventas=LS('nv',[]);
    const D = datosDelCliente(11);
    const v9 = LS('nv',[]).find(x=>x.id===9);
    return { debeV9: cobradoYDebeDe(v9).debe, debeTotal: D.debe };
  });
  T('un contado MODIFICADO que debe $10 sí lo dice', Math.abs(r3.debeV9-10)<0.005, String(r3.debeV9));
  T('y suma al total del cliente ($60)', Math.abs(r3.debeTotal-60)<0.005, String(r3.debeTotal));

  console.log('\n4️⃣  🔒 EL CRÉDITO A FAVOR NO SE APLICA A UNA PAGADA');
  const r4 = await p.evaluate(()=>{
    // Se deja SOLO la de contado pagada y una de credito que debe
    localStorage.setItem('nv', JSON.stringify([
      {id:2,cid:11,cn:'Nelson',tipo:'contado',fecha:'07/08/2026',total:10,ganancia:3,
       items:[{nombre:'x',cant:1,precio:10,costo:7}],pagosFactura:[]},
      {id:5,cid:11,cn:'Nelson',tipo:'credito',fecha:'08/12/2026',total:70,ganancia:18,
       items:[{nombre:'x',cant:3,precio:23.33,costo:17}],pagosFactura:[{monto:20,fecha:'08/13/2026'}]}
    ]));
    ventas=LS('nv',[]);
    const antes = LS('nv',[]).map(v=>({id:v.id, pagos:(v.pagosFactura||[]).length}));
    return { antes, hay: typeof usarCreditoAFavor === 'function' };
  });
  T('la función del crédito a favor existe', r4.hay);
  const r4b = await p.evaluate(()=>{
    const vs = LS('nv',[]);
    const contado = vs.find(v=>v.id===2);
    return { debeContado: cobradoYDebeDe(contado).debe };
  });
  T('para el crédito, la de contado pagada figura con debe $0 (no se le puede aplicar nada)',
     Math.abs(r4b.debeContado)<0.005, String(r4b.debeContado));

  console.log('\n══════════════════════════════');
  console.log(`  ${ok} bien · ${mal} mal`);
  const reales=errs.filter(e=>!/firebase|onAuthStateChanged/i.test(e));
  if(reales.length){ console.log('⚠️ JS:'); reales.forEach(e=>console.log('   '+e)); }
  await b.close();
  process.exit(mal||reales.length?1:0);
})();
