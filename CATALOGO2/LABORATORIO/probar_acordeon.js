const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({viewport:{width:390,height:1200}});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file:///home/claude/trabajo/index.html');
  await p.waitForTimeout(2500);
  let ok=0,mal=0;
  const T=(n,c,d)=>{ if(c){ok++;console.log('  ✅ '+n);} else {mal++;console.log('  ❌ '+n+(d?'  →  '+d:''));} };

  const abrirPantalla = async (cuantos) => await p.evaluate(async (n)=>{
    ['pantalla-login','pantalla-bloqueo'].forEach(id=>{const e=document.getElementById(id); if(e) e.style.display='none';});
    const a=document.getElementById('app-contenido'); if(a) a.style.display='block';
    const cls=[]; for(let i=0;i<n;i++) cls.push({id:i+1,nombre:'Barbero'+(i+1),apellido:'Ap'+(i+1),negocio:'RD BARBERSHOP'});
    localStorage.setItem('ncl', JSON.stringify(cls));
    localStorage.setItem('nv','[]');
    localStorage.setItem('np', JSON.stringify([{id:'p1',nombre:'Gel 700ml',marca:'G',costo:4,precio:10,stock:20,min:5}]));
    clientes=LS('ncl',[]); ventas=LS('nv',[]); loadProds();
    ir('p-ped');
    barberosSel={}; cls.forEach(c=>{ barberosSel[String(c.id)]={cliente:c,barberia:'RD BARBERSHOP'}; });
    iniciarPedidoMultiple();
    await new Promise(r=>setTimeout(r,500));
  }, cuantos);

  const estado = async () => await p.evaluate(()=>{
    const n = pedidosMultiTemp.length;
    const cuerpos=[], flechas=[];
    for(let i=0;i<n;i++){
      const c=document.getElementById('multi-cuerpo-'+i);
      const f=document.getElementById('multi-flecha-'+i);
      cuerpos.push(c?c.style.display:'NO EXISTE');
      flechas.push(f?f.textContent:'NO EXISTE');
    }
    return { cuerpos, flechas, abierto: window._barberoAbierto,
             altoLista: Math.round(document.getElementById('ped-multi-lista').getBoundingClientRect().height) };
  });

  console.log('\n1️⃣  CON 6 BARBEROS, TODOS NACEN CERRADOS');
  await abrirPantalla(6);
  let e = await estado();
  console.log('     alto de la lista: ' + e.altoLista + ' px');
  T('los 6 nacen cerrados', e.cuerpos.every(x=>x==='none'), JSON.stringify(e.cuerpos));
  T('las 6 flechitas dicen "cerrado"', e.flechas.every(x=>x==='›'), JSON.stringify(e.flechas));
  T('🔑 los 6 caben en una pantalla de teléfono', e.altoLista < 844, e.altoLista+' px');

  console.log('\n2️⃣  AL TOCAR UNO, SE ABRE SOLO ESE');
  await p.evaluate(()=>toggleBarberoMulti(3));
  await p.waitForTimeout(250);
  e = await estado();
  T('el 4to se abrió', e.cuerpos[3]==='block', JSON.stringify(e.cuerpos));
  T('🔑 los otros 5 siguen cerrados', e.cuerpos.filter(x=>x==='block').length===1, JSON.stringify(e.cuerpos));
  T('su flechita cambió', e.flechas[3]==='⌃', JSON.stringify(e.flechas));

  console.log('\n3️⃣  🔑 AL TOCAR OTRO, EL ANTERIOR SE CIERRA SOLO');
  await p.evaluate(()=>toggleBarberoMulti(0));
  await p.waitForTimeout(250);
  e = await estado();
  T('se abrió el primero', e.cuerpos[0]==='block', JSON.stringify(e.cuerpos));
  T('🔑 el 4to se cerró solo', e.cuerpos[3]==='none', JSON.stringify(e.cuerpos));
  T('sigue habiendo solo UNO abierto', e.cuerpos.filter(x=>x==='block').length===1, JSON.stringify(e.cuerpos));
  T('y es el que está encendido para escribir', e.abierto===0, String(e.abierto));

  console.log('\n4️⃣  AL TOCARLO OTRA VEZ, SE CIERRA');
  await p.evaluate(()=>toggleBarberoMulti(0));
  await p.waitForTimeout(250);
  e = await estado();
  T('quedan todos cerrados', e.cuerpos.every(x=>x==='none'), JSON.stringify(e.cuerpos));

  console.log('\n5️⃣  🔒 LO QUE ESCRIBES NO SE PIERDE AL ABRIR Y CERRAR');
  const r5 = await p.evaluate(async ()=>{
    toggleBarberoMulti(2);
    await new Promise(r=>setTimeout(r,200));
    const buscador = document.getElementById('multi-buscar-2');
    buscador.value = 'gel';
    toggleBarberoMulti(4);                 // se abre otro
    await new Promise(r=>setTimeout(r,200));
    toggleBarberoMulti(2);                 // se vuelve al primero
    await new Promise(r=>setTimeout(r,200));
    return { loEscrito: document.getElementById('multi-buscar-2').value };
  });
  T('🔒 lo escrito sigue ahí al volver', r5.loEscrito==='gel', r5.loEscrito);

  console.log('\n6️⃣  🔒 LOS BOTONES DE LA CABECERA SIGUEN FUNCIONANDO');
  const r6 = await p.evaluate(async ()=>{
    window._barberoAbierto = null;
    renderPedidosMultiples();
    await new Promise(r=>setTimeout(r,250));
    const cab = document.getElementById('multi-cab-1');
    const btns = [...cab.querySelectorAll('button')].map(x=>x.getAttribute('onclick'));
    return { btns, todosParan: btns.every(x=>/stopPropagation/.test(x||'')) };
  });
  T('🔒 subir, bajar y quitar NO abren el acordeón por error', r6.todosParan, JSON.stringify(r6.btns));

  console.log('\n7️⃣  🔒 SOLO QUEDA UNA FUNCIÓN CON ESE NOMBRE');
  const r7 = await p.evaluate(()=>({ cuerpo: String(toggleBarberoMulti).indexOf('_barberoAbierto')>=0 }));
  T('🔒 la que corre es la buena, no la vieja', r7.cuerpo);

  console.log(`\n  ${ok} bien · ${mal} mal`);
  const reales=errs.filter(e=>!/firebase|onAuthStateChanged/i.test(e));
  if(reales.length){ console.log('⚠️ JS:'); reales.forEach(e=>console.log('   '+e)); }
  await b.close();
  process.exit(mal||reales.length?1:0);
})();
