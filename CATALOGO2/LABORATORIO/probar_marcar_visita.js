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

  // Prepara: la ruta de HOY con 3 barberías, y clientes cuyo nombre NO coincide exacto
  const preparar = async (nombreEnCliente, nombreEnRuta) => await p.evaluate(({nc, nr})=>{
    const hoy = getDiaHoy();
    localStorage.setItem('rutas_por_dia', JSON.stringify({ [hoy]: [nr, 'ELITE CUTS', 'RD BARBER SHOP'] }));
    const key = 'visitas_' + hoy + '_' + fechaMasRecienteParaDia(hoy);
    localStorage.removeItem(key);
    localStorage.setItem('ncl', JSON.stringify([{id:1, nombre:'Juan', negocio:nc}]));
    clientes = LS('ncl',[]);
    return { hoy, key };
  }, {nc:nombreEnCliente, nr:nombreEnRuta});

  const leerVisitas = async (key) => await p.evaluate((k)=>LS(k,[]), key);

  console.log('\n1️⃣  EL CASO EXACTO — todo escrito igual (esto ya funcionaba)');
  let inf = await preparar('MODERN CUTS','MODERN CUTS');
  let r = await p.evaluate(()=>marcarVisitaAutomatica('MODERN CUTS'));
  let v = await leerVisitas(inf.key);
  T('marca la visita', r===true, String(r));
  T('queda con su hora y marcada como automática', v.length===1 && v[0].auto===true, JSON.stringify(v));

  console.log('\n2️⃣  🔴 EL ESPACIO AL FINAL — esto es lo que te estaba pasando');
  inf = await preparar('MODERN CUTS ','MODERN CUTS');
  r = await p.evaluate(()=>marcarVisitaAutomatica('MODERN CUTS '));
  v = await leerVisitas(inf.key);
  T('AHORA sí la marca aunque sobre un espacio', r===true, String(r));
  T('la apunta con el nombre de la RUTA (sin el espacio)',
     v.length===1 && v[0].n==='MODERN CUTS', JSON.stringify(v));

  console.log('\n3️⃣  MAYÚSCULAS Y MINÚSCULAS DISTINTAS');
  inf = await preparar('Modern Cuts','MODERN CUTS');
  r = await p.evaluate(()=>marcarVisitaAutomatica('Modern Cuts'));
  v = await leerVisitas(inf.key);
  T('la marca igual', r===true, String(r));
  T('la apunta como está en la ruta', v.length===1 && v[0].n==='MODERN CUTS', JSON.stringify(v));

  console.log('\n4️⃣  DOBLE ESPACIO Y ACENTOS');
  inf = await preparar('MODERN  CUTS','MODERN CUTS');
  r = await p.evaluate(()=>marcarVisitaAutomatica('MODERN  CUTS'));
  T('doble espacio: la marca', r===true, String(r));

  inf = await preparar('BARBERÍA LÓPEZ','BARBERIA LOPEZ');
  r = await p.evaluate(()=>marcarVisitaAutomatica('BARBERÍA LÓPEZ'));
  T('con acento vs sin acento: la marca', r===true, String(r));

  console.log('\n5️⃣  🔒 LO QUE NO DEBE MARCAR (que no se pase de listo)');
  inf = await preparar('OTRA BARBERIA','MODERN CUTS');
  r = await p.evaluate(()=>marcarVisitaAutomatica('OTRA BARBERIA'));
  v = await leerVisitas(inf.key);
  T('una barbería que NO está en la ruta de hoy: no marca', r===false && v.length===0, String(r)+' / '+JSON.stringify(v));

  r = await p.evaluate(()=>marcarVisitaAutomatica(''));
  T('nombre vacío: no marca', r===false, String(r));
  r = await p.evaluate(()=>marcarVisitaAutomatica('   '));
  T('solo espacios: no marca', r===false, String(r));

  console.log('\n6️⃣  DE PUNTA A PUNTA — haciendo una VENTA de verdad');
  const r6 = await p.evaluate(async ()=>{
    const hoy = getDiaHoy();
    localStorage.setItem('rutas_por_dia', JSON.stringify({ [hoy]: ['MODERN CUTS'] }));
    const key = 'visitas_'+hoy+'_'+fechaMasRecienteParaDia(hoy);
    localStorage.removeItem(key);
    // El cliente tiene el espacio de mas, como en la vida real
    const cl = { id:1, nombre:'Juan', negocio:'MODERN CUTS ' };
    apuntarTodoDeLaVisita(cl, true, { como:'auto' });
    return { visitas: LS(key,[]), key };
  });
  T('al vender, la barbería queda marcada sola', r6.visitas.length===1, JSON.stringify(r6.visitas));
  T('con la hora puesta', !!(r6.visitas[0] && r6.visitas[0].h), JSON.stringify(r6.visitas[0]));

  console.log('\n7️⃣  Y QUE LA PANTALLA DE LA RUTA LO VEA');
  const r7 = await p.evaluate(async ()=>{
    localStorage.setItem('ncl', JSON.stringify([{id:1,nombre:'Juan',negocio:'MODERN CUTS ',dir:'1 Main St'}]));
    clientes = LS('ncl',[]);
    // El contenedor lo crea renderRutas(), no el HTML. Se llama primero, como en la app.
    renderRutas();
    await new Promise(r=>setTimeout(r,200));
    const cont=document.getElementById('ruta-dia-contenido');
    if(!cont) return { botones:['NO EXISTE ruta-dia-contenido'], hayVisitada:false, hayMarcar:false };
    renderRutaDia(getDiaHoy());
    await new Promise(r=>setTimeout(r,250));
    const botones=[...cont.querySelectorAll('button')].map(x=>x.textContent.trim());
    return { botones, hayVisitada: botones.some(x=>/Visitada/.test(x)), hayMarcar: botones.some(x=>x==='Marcar') };
  });
  T('la pantalla de la ruta la enseña como ✓ Visitada', r7.hayVisitada, JSON.stringify(r7.botones).slice(0,140));
  T('ya no le pide marcarla a mano', !r7.hayMarcar, JSON.stringify(r7.botones).slice(0,140));

  console.log('\n══════════════════════════════');
  console.log(`  ${ok} bien · ${mal} mal`);
  const reales=errs.filter(e=>!/firebase|onAuthStateChanged/i.test(e));
  if(reales.length){ console.log('⚠️ JS:'); reales.forEach(e=>console.log('   '+e)); }
  await b.close();
  process.exit(mal||reales.length?1:0);
})();
