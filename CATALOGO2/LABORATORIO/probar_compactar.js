const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({viewport:{width:390,height:844}});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file:///home/claude/trabajo/index.html');
  await p.waitForTimeout(2500);
  let ok=0,mal=0;
  const T=(n,c,d)=>{ if(c){ok++;console.log('  ✅ '+n);} else {mal++;console.log('  ❌ '+n+(d?'  →  '+d:''));} };

  // ══════ LAS FACTURAS DEL CLIENTE ══════
  console.log('\n1️⃣  FACTURAS DEL CLIENTE — solo las que deben, abiertas');
  const r1 = await p.evaluate(async ()=>{
    ['pantalla-login','pantalla-bloqueo'].forEach(id=>{const e=document.getElementById(id); if(e) e.style.display='none';});
    const a=document.getElementById('app-contenido'); if(a) a.style.display='block';
    localStorage.setItem('ncl', JSON.stringify([{id:11,nombre:'Nelson',apellido:'Castro',apodo:'TITO',negocio:'RD'}]));
    localStorage.setItem('nv', JSON.stringify([
      {id:1,cid:11,tipo:'credito',fecha:'06/24/2026',total:45,ganancia:10,items:[{nombre:'x',cant:1,precio:45,costo:35}],pagosFactura:[{monto:45}]},
      {id:2,cid:11,tipo:'contado',fecha:'07/08/2026',total:10,ganancia:3,items:[{nombre:'x',cant:1,precio:10,costo:7}],pagosFactura:[]},
      {id:3,cid:11,tipo:'credito',fecha:'07/15/2026',total:45,ganancia:10,items:[{nombre:'x',cant:3,precio:15,costo:12}],pagosFactura:[{monto:45}]},
      {id:5,cid:11,tipo:'credito',fecha:'08/12/2026',total:70,ganancia:18,items:[{nombre:'x',cant:3,precio:23,costo:17}],pagosFactura:[{monto:20}]},
      {id:6,cid:11,tipo:'credito',fecha:'08/19/2026',total:40,ganancia:11,items:[{nombre:'x',cant:4,precio:10,costo:7}],pagosFactura:[]}
    ]));
    clientes=LS('ncl',[]); ventas=LS('nv',[]);
    _panelAbierto='facturas';
    let c=document.getElementById('cl-panel-completo');
    if(!c){ c=document.createElement('div'); c.id='cl-panel-completo'; document.body.appendChild(c); }
    pintarPanelCliente(11); ir('p-cl-perfil');
    await new Promise(r=>setTimeout(r,400));
    const html=c.innerHTML;
    const zona=html.slice(html.indexOf('Sus facturas'));
    // Las abiertas traen la palabra DEBE; las saldadas van bajo YA SALDADAS
    const saldos=[...zona.matchAll(/font-size:(\d+)px;font-weight:900;color:#C62828[^>]*>\$([\d,.]+)/g)]
                  .map(m=>({tam:+m[1], monto:m[2]}));
    return { hayMasVieja: /LA M\u00c1S VIEJA/.test(zona),
             saldos,
             hayYaSaldadas: /YA SALDADAS \(3\)/.test(zona),
             cuantasPagadas: (zona.match(/>pagada</g)||[]).length,
             altoPanel: Math.round(c.getBoundingClientRect().height) };
  });
  console.log('     saldos que salen: '+JSON.stringify(r1.saldos));
  T('sale el rótulo "LA MÁS VIEJA"', r1.hayMasVieja);
  T('solo DOS facturas abiertas (las que deben)', r1.saldos.length===2, JSON.stringify(r1.saldos));
  T('🔑 la más vieja va primera (08/12, debe $50)', r1.saldos[0] && r1.saldos[0].monto==='50.00', JSON.stringify(r1.saldos[0]));
  T('🔑 y su saldo es MÁS GRANDE que el de la otra',
     r1.saldos[0].tam > r1.saldos[1].tam, r1.saldos[0].tam+'px vs '+r1.saldos[1].tam+'px');
  T('las 3 pagadas van bajo "YA SALDADAS (3)"', r1.hayYaSaldadas);
  T('y aparecen las 3 como pagadas', r1.cuantasPagadas===3, String(r1.cuantasPagadas));

  console.log('\n2️⃣  🔒 UN CLIENTE QUE NO DEBE NADA');
  const r2 = await p.evaluate(async ()=>{
    const vs=LS('nv',[]); vs.forEach(v=>{ v.pagosFactura=[{monto:v.total}]; });
    localStorage.setItem('nv', JSON.stringify(vs)); ventas=LS('nv',[]);
    _panelAbierto='facturas'; pintarPanelCliente(11);
    await new Promise(r=>setTimeout(r,300));
    const html=document.getElementById('cl-panel-completo').innerHTML;
    const zona=html.slice(html.indexOf('Sus facturas'));
    return { dice: /TODAS SALDADAS/.test(zona), hayVieja: /LA M\u00c1S VIEJA/.test(zona),
             cuantas: (zona.match(/>pagada</g)||[]).length };
  });
  T('dice "TODAS SALDADAS — no te debe nada"', r2.dice);
  T('no marca ninguna como la más vieja', !r2.hayVieja);
  T('salen las 5 facturas en línea', r2.cuantas===5, String(r2.cuantas));

  console.log('\n3️⃣  🔒 CON UNA SOLA FACTURA QUE DEBE, NO SE MARCA "LA MÁS VIEJA"');
  const r3 = await p.evaluate(async ()=>{
    const vs=LS('nv',[]); vs[3].pagosFactura=[{monto:20}];
    localStorage.setItem('nv', JSON.stringify(vs)); ventas=LS('nv',[]);
    _panelAbierto='facturas'; pintarPanelCliente(11);
    await new Promise(r=>setTimeout(r,300));
    const html=document.getElementById('cl-panel-completo').innerHTML;
    return { hayVieja: /LA M\u00c1S VIEJA/.test(html.slice(html.indexOf('Sus facturas'))) };
  });
  T('con una sola que debe, no dice "la más vieja"', !r3.hayVieja);

  // ══════ LA PANTALLA DE VENDER ══════
  console.log('\n4️⃣  VENDER — más corta y sin repetir el cliente');
  const r4 = await p.evaluate(async ()=>{
    localStorage.setItem('ncl', JSON.stringify([{id:1,nombre:'Isidro',apellido:'Gonzalez',apodo:'EL FLACO',negocio:'URBAN CUTS'}]));
    localStorage.setItem('nv','[]');
    localStorage.setItem('npedidos', JSON.stringify([{id:5001,cid:1,cn:'Isidro',negocio:'URBAN CUTS',fecha:'08/27/2026',hora:'2PM',
      items:[{pid:'p1',nombre:'Jacket',cant:1,precio:55,costo:40}], total:55}]));
    localStorage.setItem('np', JSON.stringify([{id:'p1',nombre:'Jacket',marca:'B',costo:40,precio:55,stock:5,min:2}]));
    clientes=LS('ncl',[]); ventas=LS('nv',[]); loadProds();
    convertirPedidoAVenta(0);
    await new Promise(r=>setTimeout(r,700));
    const pv=document.getElementById('p-v');
    const esc=document.getElementById('v-escoger-cliente');
    const acc=document.getElementById('pedido-conv-acciones');
    return { alto: Math.round(pv.getBoundingClientRect().height),
             nombre: (document.getElementById('v-quien-nombre')||{}).textContent,
             negocio: (document.getElementById('v-quien-negocio')||{}).textContent,
             franja: getComputedStyle(document.getElementById('v-quien')).display,
             escogerCliente: esc?getComputedStyle(esc).display:null,
             enlaces: acc?getComputedStyle(acc).display:null,
             botonViejoAlto: Math.round(document.getElementById('btn-borrar-pedido-conversion').getBoundingClientRect().height) };
  });
  console.log('     alto: '+r4.alto+' px');
  T('la franja con el nombre se ve', r4.franja==='block', r4.franja);
  T('dice el nombre completo con apodo', r4.nombre==='Isidro Gonzalez "EL FLACO"', r4.nombre);
  T('y su barbería', /URBAN CUTS/.test(r4.negocio||''), r4.negocio);
  T('🔑 el buscador y el desplegable se esconden', r4.escogerCliente==='none', r4.escogerCliente);
  // -18 sep- Los dos enlaces chicos se cambiaron por UN boton "Salir de este pedido"
  // bien separado del verde, porque un toque cayo en "borrar" queriendo guardar.
  T('el botón de Salir de este pedido se ve', r4.enlaces==='flex'||r4.enlaces==='block', r4.enlaces);
  // Hay codigo que los enciende; lo que importa es que NO OCUPEN SITIO.
  T('los botones grandes viejos no ocupan sitio', r4.botonViejoAlto===0, String(r4.botonViejoAlto));
  T('🔑 la pantalla bajó de 1554 px a menos de 1300', r4.alto < 1300, String(r4.alto));

  console.log('\n5️⃣  EL BOTÓN ✏️ CAMBIAR DEVUELVE EL BUSCADOR');
  const r5 = await p.evaluate(async ()=>{
    cambiarClienteVenta();
    await new Promise(r=>setTimeout(r,150));
    return { escoger: getComputedStyle(document.getElementById('v-escoger-cliente')).display,
             franja: getComputedStyle(document.getElementById('v-quien')).display };
  });
  T('vuelve a salir el buscador de cliente', r5.escoger==='block', r5.escoger);
  T('y la franja se esconde mientras escoges', r5.franja==='none', r5.franja);

  console.log('\n6️⃣  🔒 SIN CLIENTE (venta general) EL BUSCADOR SIGUE AHÍ');
  const r6 = await p.evaluate(async ()=>{
    document.getElementById('vcl').value='';
    pintarAQuienLeVendo();
    await new Promise(r=>setTimeout(r,150));
    return { escoger: getComputedStyle(document.getElementById('v-escoger-cliente')).display,
             franja: getComputedStyle(document.getElementById('v-quien')).display };
  });
  T('el buscador se ve', r6.escoger==='block', r6.escoger);
  T('y no sale franja de nombre', r6.franja==='none', r6.franja);

  console.log(`\n  ${ok} bien · ${mal} mal`);
  const reales=errs.filter(e=>!/firebase|onAuthStateChanged/i.test(e));
  if(reales.length){ console.log('⚠️ JS:'); reales.forEach(e=>console.log('   '+e)); }
  await b.close();
  process.exit(mal||reales.length?1:0);
})();
