const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({viewport:{width:390,height:1400}});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file:///home/claude/trabajo/index.html');
  await p.waitForTimeout(2500);
  let ok=0,mal=0;
  const T=(n,c,d)=>{ if(c){ok++;console.log('  ✅ '+n);} else {mal++;console.log('  ❌ '+n+(d?'  →  '+d:''));} };

  await p.evaluate(()=>{
    ['pantalla-login','pantalla-bloqueo'].forEach(id=>{const e=document.getElementById(id); if(e) e.style.display='none';});
    const a=document.getElementById('app-contenido'); if(a) a.style.display='block';
    abrirMenuLateral();
    ['vender','dinero','reportes','mercancia','seguridad','herramientas'].forEach(g=>toggleGrupoMenu(g));
  });
  await p.waitForTimeout(400);

  console.log('\n1️⃣  TODO MÁS GRANDE');
  const r1 = await p.evaluate(()=>{
    const b=document.querySelector('.mlb2');
    const ico=document.querySelector('.mlb2-icon');
    const icoTxt=ico.querySelector('span');
    const tit=document.querySelector('#gm-t-vender span:nth-child(2)');
    const titIco=document.querySelector('#gm-t-vender span');
    const fl=document.getElementById('gm-f-vender');
    return { renglon:getComputedStyle(b).fontSize, cuadro:getComputedStyle(ico).width,
             icono:getComputedStyle(icoTxt).fontSize, titulo:getComputedStyle(tit).fontSize,
             tituloIcono:getComputedStyle(titIco).fontSize, flecha:getComputedStyle(fl).fontSize };
  });
  console.log('     ' + JSON.stringify(r1));
  T('el texto del renglón subió de 16 px', parseFloat(r1.renglon) >= 18, r1.renglon);
  T('el cuadro del icono: 38px (era 30)', r1.cuadro==='38px', r1.cuadro);
  T('el icono: 23px (era 19)', r1.icono==='23px', r1.icono);
  T('el título del grupo: 17px (era 14.5)', r1.titulo==='17px', r1.titulo);
  T('su icono: 24px (era 18)', r1.tituloIcono==='24px', r1.tituloIcono);
  T('la flechita: 19px (era 15)', r1.flecha==='19px', r1.flecha);

  console.log('\n2️⃣  🔑 NINGÚN NOMBRE SE PARTE EN DOS LÍNEAS');
  const r2 = await p.evaluate(()=>{
    const m=document.getElementById('menu-lateral');
    const partidos=[];
    m.querySelectorAll('.mlb2').forEach(btn=>{
      // el nombre es el texto suelto, sin contar la explicación
      const sub=btn.querySelector('.mlb2-sub');
      const nombre=[...btn.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent.trim()).join('');
      if(!nombre) return;
      // se mide poniendo el nombre en un elemento igual y viendo si cabe en una línea
      const r=document.createRange();
      const nodo=[...btn.childNodes].find(n=>n.nodeType===3 && n.textContent.trim());
      r.selectNode(nodo);
      const lineas=r.getClientRects().length;
      if(lineas>1) partidos.push(nombre);
    });
    return { partidos, cuantos: m.querySelectorAll('.mlb2').length };
  });
  console.log('     renglones revisados: ' + r2.cuantos);
  T('🔑 ninguno se parte', r2.partidos.length===0, JSON.stringify(r2.partidos));

  console.log('\n3️⃣  LA EXPLICACIÓN VA DEBAJO, NO AL LADO');
  const r3 = await p.evaluate(()=>{
    const btn=[...document.querySelectorAll('.mlb2')].find(x=>/Pedidos r/i.test(x.textContent));
    const sub=btn.querySelector('.mlb2-sub');
    const nodo=[...btn.childNodes].find(n=>n.nodeType===3 && n.textContent.trim());
    const r=document.createRange(); r.selectNode(nodo);
    const rectN=r.getBoundingClientRect();
    const rectS=sub.getBoundingClientRect();
    return { nombreAbajo:Math.round(rectN.bottom), subArriba:Math.round(rectS.top),
             tamSub:getComputedStyle(sub).fontSize };
  });
  T('la explicación empieza DEBAJO del nombre', r3.subArriba >= r3.nombreAbajo - 2,
     'nombre acaba en '+r3.nombreAbajo+', sub empieza en '+r3.subArriba);
  T('y es más chica que el nombre', parseFloat(r3.tamSub) < 18, r3.tamSub);

  console.log('\n4️⃣  🔑 CADA COSA CON SU PROPIO ICONO');
  const r4 = await p.evaluate(()=>{
    const m=document.getElementById('menu-lateral');
    const pares=[];
    m.querySelectorAll('.mlb2').forEach(btn=>{
      const ico=btn.querySelector('.mlb2-icon span');
      const nodo=[...btn.childNodes].find(n=>n.nodeType===3 && n.textContent.trim());
      if(ico && nodo) pares.push({ico:ico.textContent.trim(), txt:nodo.textContent.trim()});
    });
    const cuenta={};
    pares.forEach(x=>{ cuenta[x.ico]=(cuenta[x.ico]||0)+1; });
    const repetidos=Object.keys(cuenta).filter(k=>cuenta[k]>1)
      .map(k=>({ico:k, donde:pares.filter(x=>x.ico===k).map(x=>x.txt)}));
    return { total:pares.length, repetidos };
  });
  console.log('     renglones con icono: ' + r4.total);
  T('🔑 ningún icono repetido', r4.repetidos.length===0, JSON.stringify(r4.repetidos));

  console.log('\n5️⃣  🔒 LOS BOTONES SIGUEN LLEVANDO A SU SITIO');
  const r5 = await p.evaluate(()=>{
    const m=document.getElementById('menu-lateral');
    const btns=[...m.querySelectorAll('.mlb2')];
    const sinAccion=btns.filter(x=>!x.getAttribute('onclick'));
    const rotos=btns.filter(x=>{
      const oc=x.getAttribute('onclick')||'';
      const fn=(oc.match(/^\s*([A-Za-z_$][\w$]*)\s*\(/)||[])[1];
      return fn && typeof window[fn]!=='function';
    }).map(x=>x.getAttribute('onclick'));
    return { total:btns.length, sinAccion:sinAccion.length, rotos };
  });
  T('todos tienen su acción', r5.sinAccion===0, String(r5.sinAccion));
  T('🔒 y ninguna acción está rota', r5.rotos.length===0, JSON.stringify(r5.rotos));

  console.log(`\n  ${ok} bien · ${mal} mal`);
  const reales=errs.filter(e=>!/firebase|onAuthStateChanged/i.test(e));
  if(reales.length){ console.log('⚠️ JS:'); reales.forEach(e=>console.log('   '+e)); }
  await b.close();
  process.exit(mal||reales.length?1:0);
})();
