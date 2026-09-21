const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({viewport:{width:390,height:1000}});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file:///home/claude/trabajo/index.html');
  await p.waitForTimeout(2500);
  let ok=0,mal=0;
  const T=(n,c,d)=>{ if(c){ok++;console.log('  ✅ '+n);} else {mal++;console.log('  ❌ '+n+(d?'  →  '+d:''));} };

  await p.evaluate(()=>{
    ['pantalla-login','pantalla-bloqueo'].forEach(id=>{const e=document.getElementById(id); if(e) e.style.display='none';});
    const a=document.getElementById('app-contenido'); if(a) a.style.display='block';
    localStorage.setItem('ncl', JSON.stringify([
      {id:1,nombre:'Jose',apellido:'Ramirez',negocio:'PLAINFIELD BARBERSHOP',dir:'12 Main St',ciudad:'Providence'},
      {id:2,nombre:'Luis',apellido:'Perez',negocio:'ELITE BARBERSHOP',dir:'340 Plainfield St',ciudad:'Providence'},
      {id:3,nombre:'Ana',apellido:'Diaz',negocio:'RD BARBER SHOP',dir:'88 Plainfield Ave',ciudad:'Providence'}]));
    localStorage.setItem('np', JSON.stringify([
      {id:'p1',nombre:'Gummy hair gel 700ml',marca:'Gummy',costo:4,precio:10,stock:20,min:5},
      {id:'p2',nombre:'Gummy wax fuerte 150ml',marca:'Gummy',costo:5,precio:12,stock:10,min:5},
      {id:'p3',nombre:'Andis hair clipper',marca:'Andis',costo:90,precio:150,stock:3,min:2}]));
    localStorage.setItem('nsup', JSON.stringify([
      {id:900,nombre:'KANAR ONLINE',contacto:'Maria',dir:'250 Online Ave',ciudad:'Providence'},
      {id:901,nombre:'MONKEYS GROUP',contacto:'Ana',dir:'12 Kanar St',ciudad:'Cranston'}]));
    clientes=LS('ncl',[]); suplidores=LS('nsup',[]); loadProds();
  });

  console.log('\n1️⃣  UNA SOLA FUNCIÓN PARA TODOS');
  const r1 = await p.evaluate(()=>({ existe: typeof filtrarPorBusqueda==='function' }));
  T('la función común existe', r1.existe);

  const probar = async (lista, texto, q) => await p.evaluate(({lista,texto,q})=>{
    const datos = LS(lista,[]);
    const f = new Function('x','return '+texto);
    return filtrarPorBusqueda(datos, q, f).map(x=> x.negocio || x.nombre);
  }, {lista, texto, q});

  console.log('\n2️⃣  CLIENTES — el caso de Sensei');
  const txtCl = "(x.nombre||'')+' '+(x.apellido||'')+' '+(x.negocio||'')+' '+(x.dir||'')+' '+(x.ciudad||'')";
  const c1 = await probar('ncl', txtCl, 'plainfield barbershop');
  const c2 = await probar('ncl', txtCl, 'plainfield');
  T('🔑 dos palabras: solo Plainfield Barbershop', c1.length===1 && c1[0]==='PLAINFIELD BARBERSHOP', JSON.stringify(c1));
  T('una palabra: los 3', c2.length===3, JSON.stringify(c2));

  console.log('\n3️⃣  PRODUCTOS');
  const p1 = await probar('np', "x.nombre", 'gummy gel');
  const p2 = await probar('np', "x.nombre", 'gummy');
  const p3 = await probar('np', "x.nombre", 'hair');
  T('🔑 "gummy gel" saca solo el gel', p1.length===1 && /gel/.test(p1[0]), JSON.stringify(p1));
  T('"gummy" saca los 2', p2.length===2, JSON.stringify(p2));
  T('"hair" saca el gel y el clipper', p3.length===2, JSON.stringify(p3));

  console.log('\n4️⃣  SUPLIDORES');
  const s1 = await probar('nsup', "(x.nombre||'')+' '+(x.contacto||'')+' '+(x.dir||'')+' '+(x.ciudad||'')", 'kanar online');
  T('🔑 "kanar online" saca solo Kanar Online', s1.length===1 && s1[0]==='KANAR ONLINE', JSON.stringify(s1));
  T('🔒 y NO el que tiene "Kanar" en la calle', !s1.includes('MONKEYS GROUP'), JSON.stringify(s1));

  console.log('\n5️⃣  🔑 EN LAS PANTALLAS DE VERDAD');
  const r5 = await p.evaluate(async ()=>{
    const res={};
    // Clientes
    ir('p-cl'); await new Promise(r=>setTimeout(r,200));
    // ⚠️ Los ids de verdad son 'cl-buscar-input' y 'cl-l', no 'clbuscar'/'cllista'.
    renderCl('plainfield barbershop');
    await new Promise(r=>setTimeout(r,250));
    const tcl=document.getElementById('cl-l').innerText;
    res.clientes=(tcl.match(/BARBERSHOP|BARBER SHOP/g)||[]).length;
    res.clientesTxt=tcl.slice(0,120).replace(/\n/g,' | ');
    // Catálogo
    ir('p-cat'); await new Promise(r=>setTimeout(r,200));
    renderCatalogo('gummy gel'); await new Promise(r=>setTimeout(r,250));
    const t=document.getElementById('catlista').innerText;
    res.catalogoGel = /Gummy hair gel/.test(t);
    res.catalogoWax = /Gummy wax/.test(t);
    // Suplidores
    ir('p-sup'); await new Promise(r=>setTimeout(r,200));
    renderSup('kanar online'); await new Promise(r=>setTimeout(r,250));
    const ts=document.getElementById('sup-l').innerText;
    res.supKanar = /KANAR ONLINE/.test(ts);
    res.supMonkeys = /MONKEYS/.test(ts);
    return res;
  });
  T('en CLIENTES sale un solo barbershop', r5.clientes===1, String(r5.clientes));
  T('en CATÁLOGO sale el gel', r5.catalogoGel);
  T('🔑 y NO sale el wax', !r5.catalogoWax);
  T('en SUPLIDORES sale Kanar Online', r5.supKanar);
  T('🔑 y NO sale Monkeys (que tiene Kanar en la calle)', !r5.supMonkeys);

  console.log('\n6️⃣  🔒 LOS BUSCADORES DE DIRECCIÓN NO SE TOCARON');
  const r6 = await p.evaluate(()=>({
    ciudad: typeof onCiudadInput==='function',
    estado: typeof onEstadoInput==='function',
    dir: typeof mostrarDirSugerencias==='function'
  }));
  T('🔒 sugerencias de ciudad, intactas', r6.ciudad);
  T('🔒 sugerencias de estado, intactas', r6.estado);
  T('🔒 sugerencias de calle, intactas', r6.dir);

  console.log(`\n  ${ok} bien · ${mal} mal`);
  const reales=errs.filter(e=>!/firebase|onAuthStateChanged/i.test(e));
  if(reales.length){ console.log('⚠️ JS:'); reales.forEach(e=>console.log('   '+e)); }
  await b.close();
  process.exit(mal||reales.length?1:0);
})();
