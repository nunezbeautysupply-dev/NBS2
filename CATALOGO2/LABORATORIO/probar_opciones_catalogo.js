const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({viewport:{width:390,height:900}});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file:///home/claude/trabajo/index.html');
  await p.waitForTimeout(2500);
  let ok=0,mal=0;
  const T=(n,c,d)=>{ if(c){ok++;console.log('  ✅ '+n);} else {mal++;console.log('  ❌ '+n+(d?'  →  '+d:''));} };

  console.log('\n1️⃣  LOS 9 BOTONES SIGUEN AHÍ, DENTRO DE OPCIONES');
  const r1 = await p.evaluate(()=>{
    const caja=document.getElementById('cat-opciones');
    const btns=[...caja.querySelectorAll('button')].map(x=>x.textContent.trim());
    const funciones=[...caja.querySelectorAll('button')].map(x=>(x.getAttribute('onclick')||'').split('(')[0]);
    return { cuantos: btns.length, btns, funciones,
             cerradoAlEmpezar: caja.style.display==='none',
             todasExisten: funciones.every(f=>typeof window[f]==='function') };
  });
  T('son 9 botones, ninguno se perdió', r1.cuantos===9, String(r1.cuantos));
  T('los 9 llaman a una función que existe', r1.todasExisten, JSON.stringify(r1.funciones));
  T('nacen cerrados', r1.cerradoAlEmpezar);
  ['Nuevo producto','Editar toda una marca','Unificar marcas','mayúscula','ya no están','Buscador profundo','Redondear','duplicados','SMS']
    .forEach(t=>T('está "'+t+'"', r1.btns.some(x=>x.indexOf(t)>=0), JSON.stringify(r1.btns).slice(0,120)));

  console.log('\n2️⃣  ABRE Y CIERRA');
  const r2 = await p.evaluate(()=>{
    toggleOpcionesCatalogo();
    const abierto = document.getElementById('cat-opciones').style.display;
    const f1 = document.getElementById('cat-opciones-flecha').textContent;
    toggleOpcionesCatalogo();
    return { abierto, cerrado: document.getElementById('cat-opciones').style.display,
             f1, f2: document.getElementById('cat-opciones-flecha').textContent };
  });
  T('al tocar se abre', r2.abierto==='block', r2.abierto);
  T('al tocar otra vez se cierra', r2.cerrado==='none', r2.cerrado);
  T('la flecha cambia (▼ / ▲)', r2.f1==='▲' && r2.f2==='▼', r2.f1+' / '+r2.f2);

  console.log('\n3️⃣  LA FRANJA DE SIN PRECIO — solo cuando hace falta');
  const r3 = await p.evaluate(async ()=>{
    localStorage.setItem('np', JSON.stringify([
      {id:'a',nombre:'Con precio',marca:'M',costo:4,precio:10,stock:5,min:5},
      {id:'b',nombre:'Sin precio 1',marca:'M',costo:4,precio:0,stock:5,min:5},
      {id:'c',nombre:'Sin precio 2',marca:'M',costo:4,precio:0,stock:5,min:5}
    ]));
    loadProds();
    document.getElementById('cat-suplidor').value='';
    renderCatalogo('');
    await new Promise(r=>setTimeout(r,200));
    const av=document.getElementById('cat-aviso-sinprecio');
    const conAviso = { display: av.style.display, txt: document.getElementById('cat-aviso-sinprecio-txt').textContent };
    // Ahora ninguno sin precio
    const ps=LS('np',[]); ps.forEach(x=>{ if(x.precio===0) x.precio=9.99; });
    localStorage.setItem('np', JSON.stringify(ps)); loadProds();
    renderCatalogo('');
    await new Promise(r=>setTimeout(r,200));
    return { conAviso, sinAviso: av.style.display };
  });
  T('con 2 sin precio, la franja sale', r3.conAviso.display==='flex', r3.conAviso.display);
  T('dice cuántos son y qué hacer', /2 productos sin precio/.test(r3.conAviso.txt), r3.conAviso.txt);
  T('cuando ninguno está sin precio, DESAPARECE', r3.sinAviso==='none', r3.sinAviso);

  console.log('\n4️⃣  QUE NADA QUEDE DESCUADRADO — los anchos');
  const r4 = await p.evaluate(async ()=>{
    // ⚠️ Sin esto, la pantalla del catalogo esta OCULTA y todos los anchos dan 0: la prueba
    // pasaria en falso comparando ceros. Hay que enseñarla como la ve Sensei.
    ['pantalla-login','pantalla-bloqueo'].forEach(function(id){ var e=document.getElementById(id); if(e) e.style.display='none'; });
    var _app=document.getElementById('app-contenido'); if(_app) _app.style.display='block';
    try { ir('p-cat'); } catch(e){}
    await new Promise(r=>setTimeout(r,300));
    localStorage.setItem('np', JSON.stringify([{id:'b',nombre:'Sin precio',marca:'M',costo:4,precio:0,stock:5,min:5}]));
    loadProds(); renderCatalogo('');
    await new Promise(r=>setTimeout(r,200));
    const anchoDe=id=>{ const e=document.getElementById(id); return e?Math.round(e.getBoundingClientRect().width):null; };
    return { opciones: anchoDe('cat-btn-opciones'), suplidor: anchoDe('cat-suplidor'),
             aviso: anchoDe('cat-aviso-sinprecio'), lista: anchoDe('catlista') };
  });
  console.log('     anchos: opciones '+r4.opciones+'  suplidor '+r4.suplidor+'  aviso '+r4.aviso+'  lista '+r4.lista);
  T('la pantalla se está midiendo de verdad (ancho > 300)', r4.lista > 300, String(r4.lista));
  T('el botón de Opciones va de lado a lado', r4.lista>300 && Math.abs(r4.opciones-r4.lista)<=2, r4.opciones+' vs '+r4.lista);
  T('el desplegable de suplidor, igual', r4.lista>300 && Math.abs(r4.suplidor-r4.lista)<=2, r4.suplidor+' vs '+r4.lista);
  T('la franja de sin precio, igual', r4.lista>300 && Math.abs(r4.aviso-r4.lista)<=2, r4.aviso+' vs '+r4.lista);

  console.log(`\n  ${ok} bien · ${mal} mal`);
  const reales=errs.filter(e=>!/firebase|onAuthStateChanged/i.test(e));
  if(reales.length){ console.log('⚠️ JS:'); reales.forEach(e=>console.log('   '+e)); }
  await b.close();
  process.exit(mal||reales.length?1:0);
})();
