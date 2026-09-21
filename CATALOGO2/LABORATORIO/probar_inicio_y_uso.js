const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({viewport:{width:390,height:900}});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file:///home/claude/trabajo/index.html');
  await p.waitForTimeout(2500);
  let ok=0,mal=0;
  const T=(n,c,d)=>{ if(c){ok++;console.log('  ✅ '+n);} else {mal++;console.log('  ❌ '+n+(d?'  →  '+d:''));} };

  await p.evaluate(()=>{
    ['pantalla-login','pantalla-bloqueo'].forEach(id=>{const e=document.getElementById(id); if(e) e.style.display='none';});
    const a=document.getElementById('app-contenido'); if(a) a.style.display='block';
    localStorage.removeItem('nbs_uso_pantallas');
  });

  console.log('\n1️⃣  LOS 6 GRUPOS DEL MENÚ, TODOS CERRADOS');
  const r1 = await p.evaluate(()=>{
    const g=['vender','dinero','reportes','mercancia','seguridad','herramientas'];
    return g.map(k=>({k, cuerpo:document.getElementById('gm-c-'+k).style.display,
                        flecha:document.getElementById('gm-f-'+k).textContent}));
  });
  T('los 6 nacen cerrados', r1.every(x=>x.cuerpo==='none'), JSON.stringify(r1.map(x=>x.k+':'+x.cuerpo)));
  T('las 6 flechitas dicen cerrado', r1.every(x=>x.flecha==='›'), JSON.stringify(r1.map(x=>x.flecha)));
  T('🔑 "Vender" ya no nace abierto', r1[0].cuerpo==='none', r1[0].cuerpo);

  console.log('\n2️⃣  Y ABREN AL TOCARLOS');
  const r2 = await p.evaluate(()=>{
    toggleGrupoMenu('vender');
    const a = document.getElementById('gm-c-vender').style.display;
    const f = document.getElementById('gm-f-vender').textContent;
    toggleGrupoMenu('vender');
    return { a, f, cerrado: document.getElementById('gm-c-vender').style.display };
  });
  T('abre', r2.a==='block', r2.a);
  T('la flechita cambia', r2.f==='⌄', r2.f);
  T('y cierra otra vez', r2.cerrado==='none', r2.cerrado);

  console.log('\n3️⃣  LA PANTALLA DE INICIO');
  const r3 = await p.evaluate(()=>{
    const ini=document.getElementById('p-inicio');
    const btns=[...ini.querySelectorAll('button.ini-btn')].map(x=>{
      const t=x.querySelector('.ini-txt b');
      return { txt: t?t.textContent.trim():'', onclick: x.getAttribute('onclick') };
    });
    return btns;
  });
  console.log('     ' + r3.map((x,i)=>(i+1)+'. '+x.txt).join('\n     '));
  T('Pedidos Rápidos sigue de primero', r3[0] && r3[0].txt==='Pedidos Rápidos', r3[0]&&r3[0].txt);
  T('🔑 Cuentas por Cobrar va de segundo', r3[1] && r3[1].txt==='Cuentas por Cobrar', r3[1]&&r3[1].txt);
  T('y lleva a la pantalla correcta', r3[1] && /irACuentasPorCobrar/.test(r3[1].onclick||''), r3[1]&&r3[1].onclick);
  T('🔑 Lista de Relleno ya NO está en el inicio',
     !r3.some(x=>/Relleno/.test(x.txt)), JSON.stringify(r3.map(x=>x.txt)));
  // El ultimo es "Hacer respaldo ahora", que tambien lleva la clase ini-btn pero no es
  // una pantalla: es una accion. Desde el 18 sep entro 💬 NBS Chat (aprobado por Sensei),
  // asi que ahora son 7 PANTALLAS + el respaldo = 8.
  T('quedan 7 atajos de pantalla + el de respaldo', r3.length===8, String(r3.length));
  T('💬 NBS Chat está entre ellos, después de Clientes',
     r3.some(x=>/NBS Chat/.test(x.txt)) && r3.findIndex(x=>/NBS Chat/.test(x.txt)) === r3.findIndex(x=>x.txt==='Clientes')+1,
     JSON.stringify(r3.map(x=>x.txt)));
  T('y el último es el de hacer respaldo', /respaldo/i.test(r3[7]?r3[7].txt:''), r3[7]&&r3[7].txt);

  console.log('\n4️⃣  🔒 LISTA DE RELLENO SIGUE EN EL MENÚ');
  const r4 = await p.evaluate(()=>{
    // ⚠️ El menú es 'menu-lateral', no 'menu'. Buscar en el equivocado daba falso negativo.
    const m=document.getElementById('menu-lateral');
    const btn=[...m.querySelectorAll('button')].find(x=>/Lista de Relleno/i.test(x.textContent||''));
    return { hay: !!btn, dentroDeMercancia: !!(btn && document.getElementById('gm-c-mercancia').contains(btn)) };
  });
  T('🔒 se llega por el menú ☰', r4.hay, JSON.stringify(r4));
  T('y está en el grupo de Mercancía', r4.dentroDeMercancia, JSON.stringify(r4));

  console.log('\n5️⃣  📊 EL RÉCORD DE USO CUENTA');
  const r5 = await p.evaluate(()=>{
    ir('p-cl'); ir('p-cat'); ir('p-cl'); ir('p-cl'); ir('p-ped');
    return JSON.parse(localStorage.getItem('nbs_uso_pantallas')||'{}');
  });
  T('cuenta las veces de cada pantalla', r5['p-cl'] && r5['p-cl'].veces===3, JSON.stringify(r5['p-cl']));
  T('y las de las otras', r5['p-cat'] && r5['p-cat'].veces===1 && r5['p-ped'].veces===1, JSON.stringify({cat:r5['p-cat'],ped:r5['p-ped']}));
  T('guarda cuándo fue la última', r5['p-cl'] && r5['p-cl'].ultima > 0);

  console.log('\n6️⃣  Y SE PUEDE VER, ORDENADO');
  const r6 = await p.evaluate(()=>{
    let dicho=null; const o=window.avisoGrande; window.avisoGrande=(m)=>{dicho=m;};
    verQueUsoMas();
    window.avisoGrande=o;
    return dicho;
  });
  console.log('     ' + (r6||'').split('\n').slice(0,7).join('\n     '));
  T('sale la lista', /QU\u00c9 USO M\u00c1S/.test(r6||''), (r6||'').slice(0,60));
  T('🔑 Clientes va de primero (3 veces)', /1\. Clientes — 3/.test(r6||''), (r6||'').slice(0,200));
  T('con su porcentaje', /%/.test(r6||''));
  T('y con nombres en cristiano, no códigos', !/p-cl/.test(r6||''), (r6||'').slice(0,150));

  console.log('\n7️⃣  🔒 SIN NADA APUNTADO, LO DICE BIEN');
  const r7 = await p.evaluate(()=>{
    localStorage.removeItem('nbs_uso_pantallas');
    let dicho=null; const o=window.avisoGrande; window.avisoGrande=(m)=>{dicho=m;};
    verQueUsoMas();
    window.avisoGrande=o;
    return dicho;
  });
  T('🔒 no revienta si no hay nada', /Todav\u00eda no hay nada apuntado/.test(r7||''), (r7||'').slice(0,80));

  console.log('\n8️⃣  🔒 SOLO CUENTA PANTALLAS, NADA MÁS');
  const r8 = await p.evaluate(()=>{
    localStorage.removeItem('nbs_uso_pantallas');
    apuntarUsoPantalla('menu');          // no es pantalla
    apuntarUsoPantalla('');              // vacío
    apuntarUsoPantalla('cualquier-cosa');
    ir('p-cat');
    const u=JSON.parse(localStorage.getItem('nbs_uso_pantallas')||'{}');
    return { claves: Object.keys(u), guardado: u['p-cat'] };
  });
  T('🔒 solo guarda las que empiezan con p-', JSON.stringify(r8.claves)===JSON.stringify(['p-cat']), JSON.stringify(r8.claves));
  T('🔒 y solo guarda veces y fecha, nada más',
     JSON.stringify(Object.keys(r8.guardado).sort())===JSON.stringify(['ultima','veces']),
     JSON.stringify(Object.keys(r8.guardado)));

  console.log(`\n  ${ok} bien · ${mal} mal`);
  const reales=errs.filter(e=>!/firebase|onAuthStateChanged/i.test(e));
  if(reales.length){ console.log('⚠️ JS:'); reales.forEach(e=>console.log('   '+e)); }
  await b.close();
  process.exit(mal||reales.length?1:0);
})();
