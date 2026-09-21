const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({viewport:{width:390,height:1000}});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file:///home/claude/trabajo/index.html');
  await p.waitForTimeout(2500);
  let ok=0,mal=0;
  const T=(n,c,d)=>{ if(c){ok++;console.log('  ✅ '+n);} else {mal++;console.log('  ❌ '+n+(d?'  →  '+d:''));} };

  const sembrar = async () => await p.evaluate(async ()=>{
    ['pantalla-login','pantalla-bloqueo'].forEach(id=>{const e=document.getElementById(id); if(e) e.style.display='none';});
    const a=document.getElementById('app-contenido'); if(a) a.style.display='block';
    localStorage.setItem('np', JSON.stringify([
      {id:'p1',nombre:'Gel 700ml',marca:'G',costo:4.00,precio:10,stock:100,min:5},
      {id:'p2',nombre:'Colonia 400ml',marca:'B',costo:4.25,precio:9.99,stock:100,min:5},
      {id:'p3',nombre:'Wax',marca:'W',costo:3.00,precio:8,stock:100,min:5}]));
    // Cargó la van el 08/20 y vendió algo desde entonces
    localStorage.setItem('nvan', JSON.stringify({ fechaCarga:'2026-08-20',
      cargado:{ p1:24, p2:12, p3:6 } }));
    localStorage.setItem('ncl', JSON.stringify([{id:1,nombre:'Isidro',negocio:'URBAN'}]));
    localStorage.setItem('nv', JSON.stringify([
      {id:1,cid:1,cn:'Isidro',tipo:'contado',fecha:'08/25/2026',total:40,ganancia:24,
       items:[{pid:'p1',nombre:'Gel 700ml',cant:4,precio:10,costo:4}],pagosFactura:[]},
      {id:2,cid:1,cn:'Isidro',tipo:'contado',fecha:'08/26/2026',total:20,ganancia:11,
       items:[{pid:'p2',nombre:'Colonia 400ml',cant:2,precio:10,costo:4.25}],pagosFactura:[]}
    ]));
    localStorage.removeItem('ncierres_ruta');
    clientes=LS('ncl',[]); ventas=LS('nv',[]); loadProds();
    return calcularEstadoVan().filas.map(f=>({pid:f.pid,nombre:f.nombre,cargado:f.cargado,vendido:f.vendido,quedan:f.quedan}));
  });

  console.log('\n1️⃣  LO QUE DEBERÍA QUEDAR EN LA VAN');
  const filas = await sembrar();
  console.log('     ' + filas.map(f=>f.nombre+': cargó '+f.cargado+', vendió '+f.vendido+', quedan '+f.quedan).join('\n     '));
  const gel = filas.find(f=>f.pid==='p1');
  T('del gel: cargó 24, vendió 4, quedan 20', gel && gel.cargado===24 && gel.vendido===4 && gel.quedan===20, JSON.stringify(gel));

  console.log('\n2️⃣  LA PANTALLA ABRE Y PIDE CONTAR');
  const r2 = await p.evaluate(async ()=>{
    abrirCierreRuta();
    await new Promise(r=>setTimeout(r,300));
    const c=document.getElementById('cierre-ruta-caja');
    return { abrio: !!c, texto: c?c.innerText:'',
             casillas: c?[...c.querySelectorAll('input[type=number]')].map(x=>x.id):[] };
  });
  T('la pantalla abre', r2.abrio);
  T('hay una casilla por producto', r2.casillas.length===3, JSON.stringify(r2.casillas));
  T('dice cuántos deberían quedar', /deberían quedar 20/.test(r2.texto), r2.texto.slice(0,200).replace(/\n/g,' | '));
  T('empieza en 0 contados de 3', /0\/3/.test(r2.texto), r2.texto.slice(0,160).replace(/\n/g,' | '));

  console.log('\n3️⃣  🔑 SI CUENTAS MENOS, TE DICE CUÁNTO FALTA Y CUÁNTO VALE');
  const r3 = await p.evaluate(async ()=>{
    apuntarContadoRuta('p1', '18');      // deberían quedar 20 → faltan 2
    await new Promise(r=>setTimeout(r,200));
    const c=document.getElementById('cierre-ruta-caja');
    return { texto: c.innerText };
  });
  T('avisa que faltan 2', /Te faltan 2 unidad/.test(r3.texto), r3.texto.slice(0,300).replace(/\n/g,' | '));
  T('🔑 y lo pone en dinero: 2 × $4.00 = $8.00', /\$8\.00/.test(r3.texto), r3.texto.slice(0,300).replace(/\n/g,' | '));

  console.log('\n4️⃣  SI CUENTAS DE MÁS, TAMBIÉN LO DICE');
  const r4 = await p.evaluate(async ()=>{
    apuntarContadoRuta('p2', '11');      // deberían quedar 10 → sobra 1
    await new Promise(r=>setTimeout(r,200));
    return document.getElementById('cierre-ruta-caja').innerText;
  });
  T('dice que sobra 1', /SOBRAN[\s\S]{0,20}1/.test(r4), r4.slice(0,200).replace(/\n/g,' | '));

  console.log('\n5️⃣  Y SI CUADRA, LO DICE EN VERDE');
  const r5 = await p.evaluate(async ()=>{
    apuntarContadoRuta('p3', '6');       // deberían quedar 6 → cuadra
    await new Promise(r=>setTimeout(r,200));
    return document.getElementById('cierre-ruta-caja').innerText;
  });
  T('marca el que cuadra', /cuadra/.test(r5), r5.slice(0,300).replace(/\n/g,' | '));
  T('van 3 de 3 contados', /3\/3/.test(r5), r5.slice(0,160).replace(/\n/g,' | '));

  console.log('\n6️⃣  🔑 SE GUARDA CON SU FECHA Y SU DIFERENCIA');
  const r6 = await p.evaluate(async ()=>{
    const oa=window.alert; let dicho=null; window.alert=(m)=>{dicho=m;};
    const oc=window.confirm; window.confirm=()=>true;
    guardarCierreRuta();
    await new Promise(r=>setTimeout(r,300));
    window.alert=oa; window.confirm=oc;
    const cs=LS('ncierres_ruta',[]);
    return { dicho, cuantos: cs.length, cierre: cs[0] };
  });
  T('se guardó un cierre', r6.cuantos===1, String(r6.cuantos));
  T('con sus 3 renglones', r6.cierre && r6.cierre.renglones.length===3, r6.cierre&&r6.cierre.renglones.length);
  T('faltan 2', r6.cierre && r6.cierre.faltan===2, r6.cierre&&r6.cierre.faltan);
  T('sobra 1', r6.cierre && r6.cierre.sobran===1, r6.cierre&&r6.cierre.sobran);
  T('🔑 el valor de lo que falta: $8.00', r6.cierre && Math.abs(r6.cierre.valorFaltante-8)<0.005, r6.cierre&&r6.cierre.valorFaltante);
  T('con la fecha de hoy', r6.cierre && r6.cierre.fecha===(await p.evaluate(()=>fechaHoy())), r6.cierre&&r6.cierre.fecha);
  T('el aviso dice lo que falta y lo que vale', /Faltan 2/.test(r6.dicho||'') && /8\.00/.test(r6.dicho||''), (r6.dicho||'').slice(0,120));

  console.log('\n7️⃣  🔒 NO TOCA NI EL INVENTARIO NI LAS VENTAS');
  const r7 = await p.evaluate(()=>{
    const ps=LS('np',[]);
    return { stockGel: ps.find(x=>x.id==='p1').stock, ventas: LS('nv',[]).length,
             van: LS('nvan',{}).cargado };
  });
  T('🔒 el inventario general no se movió', r7.stockGel===100, String(r7.stockGel));
  T('🔒 las ventas no se tocaron', r7.ventas===2, String(r7.ventas));
  T('🔒 y lo cargado en la van tampoco', r7.van.p1===24, JSON.stringify(r7.van));

  console.log('\n8️⃣  🔒 CON TODO CUADRADO, LO DICE');
  const r8 = await p.evaluate(async ()=>{
    localStorage.removeItem('ncierres_ruta');
    abrirCierreRuta();
    await new Promise(r=>setTimeout(r,200));
    apuntarContadoRuta('p1','20'); apuntarContadoRuta('p2','10'); apuntarContadoRuta('p3','6');
    await new Promise(r=>setTimeout(r,200));
    const oa=window.alert; let dicho=null; window.alert=(m)=>{dicho=m;};
    guardarCierreRuta();
    await new Promise(r=>setTimeout(r,250));
    window.alert=oa;
    return { dicho, cierre: LS('ncierres_ruta',[])[0] };
  });
  T('dice que todo cuadra', /Todo cuadra/.test(r8.dicho||''), (r8.dicho||'').slice(0,90));
  T('ni falta ni sobra', r8.cierre && r8.cierre.faltan===0 && r8.cierre.sobran===0, JSON.stringify(r8.cierre&&{f:r8.cierre.faltan,s:r8.cierre.sobran}));

  console.log(`\n  ${ok} bien · ${mal} mal`);
  const reales=errs.filter(e=>!/firebase|onAuthStateChanged/i.test(e));
  if(reales.length){ console.log('⚠️ JS:'); reales.forEach(e=>console.log('   '+e)); }
  await b.close();
  process.exit(mal||reales.length?1:0);
})();
