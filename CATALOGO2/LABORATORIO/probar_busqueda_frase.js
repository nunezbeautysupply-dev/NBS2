const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({viewport:{width:390,height:900}});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file:///home/claude/trabajo/index.html');
  await p.waitForTimeout(2500);
  let ok=0,mal=0;
  const T=(n,c,d)=>{ if(c){ok++;console.log('  ✅ '+n);} else {mal++;console.log('  ❌ '+n+(d?'  →  '+d:''));} };

  // El caso EXACTO de Sensei
  const buscar = async (q) => await p.evaluate((qq)=>{
    const cls=[
      {id:1,nombre:'Jose',apellido:'Ramirez',negocio:'PLAINFIELD BARBERSHOP',dir:'12 Main St',ciudad:'Providence'},
      {id:2,nombre:'Luis',apellido:'Perez',negocio:'ELITE BARBERSHOP',dir:'340 Plainfield St',ciudad:'Providence'},
      {id:3,nombre:'Ana',apellido:'Diaz',negocio:'RD BARBER SHOP',dir:'88 Plainfield Ave',ciudad:'Providence'},
      {id:4,nombre:'Pedro',apellido:'Gomez',negocio:'URBAN CUTS',dir:'5 Broad St',ciudad:'Cranston'},
      {id:5,nombre:'Maria',apellido:'Soto',negocio:'PLAINFIELD BEAUTY',dir:'99 Atwells Ave',ciudad:'Providence'}
    ];
    const texto=(c)=>(c.nombre||'')+' '+(c.apellido||'')+' '+(c.negocio||'')+' '+(c.dir||'')+' '+(c.ciudad||'');
    return filtrarPorBusqueda(cls, qq, texto).map(c=>c.negocio);
  }, q);

  console.log('\n1️⃣  🔑 EL CASO DE SENSEI: "plainfield barbershop"');
  const r1 = await buscar('plainfield barbershop');
  console.log('     sale: ' + JSON.stringify(r1));
  T('🔑 sale SOLO Plainfield Barbershop', r1.length===1 && r1[0]==='PLAINFIELD BARBERSHOP', JSON.stringify(r1));
  T('🔑 ya NO salen los de la CALLE Plainfield', !r1.includes('ELITE BARBERSHOP') && !r1.includes('RD BARBER SHOP'), JSON.stringify(r1));

  console.log('\n2️⃣  UNA SOLA PALABRA SIGUE SACANDO TODO');
  const r2 = await buscar('plainfield');
  console.log('     sale: ' + JSON.stringify(r2));
  T('salen los 4 que llevan plainfield', r2.length===4, String(r2.length));
  T('los de la calle también', r2.includes('ELITE BARBERSHOP') && r2.includes('RD BARBER SHOP'), JSON.stringify(r2));
  T('y el Plainfield Beauty', r2.includes('PLAINFIELD BEAUTY'));

  console.log('\n3️⃣  UNA SOLA PALABRA: "barbershop"');
  const r3 = await buscar('barbershop');
  T('salen los barbershops', r3.includes('PLAINFIELD BARBERSHOP') && r3.includes('ELITE BARBERSHOP'), JSON.stringify(r3));

  console.log('\n4️⃣  🔒 SI NINGUNO TIENE LA FRASE JUNTA, NO SE QUEDA SIN NADA');
  // "barbershop providence": ninguno dice "barbershop providence" seguido, pero varios
  // tienen las dos palabras -una en el negocio y otra en la ciudad-. Ahi NO se afina.
  const r4 = await buscar('barbershop providence');
  console.log('     sale: ' + JSON.stringify(r4));
  T('🔒 sigue dando resultados en vez de vaciarse', r4.length > 0, JSON.stringify(r4));
  T('🔒 y salen los que tienen las dos palabras sueltas', r4.length >= 2, JSON.stringify(r4));

  console.log('\n4️⃣b  🔒 SI NINGUNO TIENE LAS PALABRAS, SIGUE VACÍO (como antes)');
  const r4b = await buscar('urban plainfield');
  T('🔒 eso no cambió: nadie tiene las dos', r4b.length === 0, JSON.stringify(r4b));

  console.log('\n5️⃣  OTRAS COMBINACIONES DE DOS PALABRAS');
  const r5a = await buscar('elite barbershop');
  T('"elite barbershop" saca solo ese', r5a.length===1 && r5a[0]==='ELITE BARBERSHOP', JSON.stringify(r5a));
  const r5b = await buscar('plainfield beauty');
  T('"plainfield beauty" saca solo ese', r5b.length===1 && r5b[0]==='PLAINFIELD BEAUTY', JSON.stringify(r5b));
  const r5c = await buscar('jose ramirez');
  T('también funciona con nombre y apellido', r5c.length===1 && r5c[0]==='PLAINFIELD BARBERSHOP', JSON.stringify(r5c));

  console.log('\n6️⃣  🔒 LO QUE NO SE TOCÓ');
  const r6 = await p.evaluate(()=>{
    const prods=[
      {id:'a',nombre:'Gummy hair gel 700ml',precio:10,stock:5},
      {id:'b',nombre:'Gummy wax fuerte',precio:12,stock:3},
      {id:'c',nombre:'Barber colonia 400ml',precio:9.99,stock:0}
    ];
    const t=(x)=>x.nombre;
    return {
      unaPalabra: filtrarPorBusqueda(prods,'gummy',t).map(x=>x.nombre),
      dosPalabras: filtrarPorBusqueda(prods,'gummy gel',t).map(x=>x.nombre),
      porDinero: filtrarPorBusqueda(prods,'$10',t).map(x=>x.nombre),
      vacia: filtrarPorBusqueda(prods,'',t).length
    };
  });
  T('🔒 buscar por dinero sigue igual ($10)', r6.porDinero.length===1 && /700ml/.test(r6.porDinero[0]), JSON.stringify(r6.porDinero));
  T('🔒 una palabra saca los 2 gummy', r6.unaPalabra.length===2, JSON.stringify(r6.unaPalabra));
  T('con dos palabras afina al que las tiene juntas', r6.dosPalabras.length===1 && /gel/.test(r6.dosPalabras[0]), JSON.stringify(r6.dosPalabras));
  T('🔒 sin escribir nada, salen todos', r6.vacia===3, String(r6.vacia));

  console.log('\n7️⃣  🔒 EL DICCIONARIO DE SUS PALABRAS SIGUE SIRVIENDO');
  const r7 = await p.evaluate(()=>{
    const prods=[{id:'a',nombre:'Gummy hair gel 700ml',precio:10,stock:5},
                 {id:'b',nombre:'Andis clipper',precio:150,stock:2}];
    return filtrarPorBusqueda(prods,'gelatina',(x)=>x.nombre).map(x=>x.nombre);
  });
  T('🔒 "gelatina" sigue encontrando el gel', r7.length>=1 && /gel/i.test(r7[0]), JSON.stringify(r7));

  console.log(`\n  ${ok} bien · ${mal} mal`);
  const reales=errs.filter(e=>!/firebase|onAuthStateChanged/i.test(e));
  if(reales.length){ console.log('⚠️ JS:'); reales.forEach(e=>console.log('   '+e)); }
  await b.close();
  process.exit(mal||reales.length?1:0);
})();
