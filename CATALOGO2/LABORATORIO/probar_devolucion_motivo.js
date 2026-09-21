const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({viewport:{width:390,height:1100}});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file:///home/claude/trabajo/index.html');
  await p.waitForTimeout(2500);
  await p.evaluate(()=>{ window.protegerConHuella=function(cb){cb();};
    window.fbDb={ref:()=>({set(){},update(){},on(){},once(){return Promise.resolve({val:()=>null});}})}; });
  let ok=0,mal=0;
  const T=(n,c,d)=>{ if(c){ok++;console.log('  ✅ '+n);} else {mal++;console.log('  ❌ '+n+(d?'  →  '+d:''));} };

  console.log('\n1️⃣  LOS MOTIVOS DE LISTA');
  const r1 = await p.evaluate(()=>({
    cuantos: MOTIVOS_DEVOLUCION.length,
    ids: MOTIVOS_DEVOLUCION.map(m=>m.id),
    texto: textoDelMotivo('defectuoso'),
    desconocido: textoDelMotivo('nada')
  }));
  T('hay 7 motivos', r1.cuantos===7, String(r1.cuantos));
  T('están los de siempre en una ruta',
     ['defectuoso','equivocado','no_vendio','vencido','de_mas','no_gusto','otro'].every(x=>r1.ids.includes(x)),
     JSON.stringify(r1.ids));
  T('cada uno tiene su texto', /da\u00f1ado|dañado/.test(r1.texto), r1.texto);
  T('🔒 uno que no existe no revienta', r1.desconocido==='nada', r1.desconocido);

  console.log('\n2️⃣  EL FORMULARIO PIDE MOTIVO Y FOTO');
  const r2 = await p.evaluate(async ()=>{
    ['pantalla-login','pantalla-bloqueo'].forEach(id=>{const e=document.getElementById(id); if(e) e.style.display='none';});
    const a=document.getElementById('app-contenido'); if(a) a.style.display='block';
    localStorage.setItem('ncl', JSON.stringify([{id:1,nombre:'Isidro',negocio:'URBAN'}]));
    localStorage.setItem('np', JSON.stringify([{id:'p1',nombre:'Gel 700ml',marca:'G',costo:4,precio:10,stock:50,min:5}]));
    localStorage.setItem('nv', JSON.stringify([{id:900,cid:1,cn:'Isidro',tipo:'contado',
      fecha:'08/25/2026',hora:'2 PM',total:40,ganancia:24,
      items:[{pid:'p1',nombre:'Gel 700ml',cant:4,precio:10,costo:4}],pagosFactura:[]}]));
    localStorage.removeItem('ndevoluciones');
    clientes=LS('ncl',[]); ventas=LS('nv',[]); loadProds();
    abrirDevolucion(900);
    await new Promise(r=>setTimeout(r,400));
    const sel=document.getElementById('dev-motivo');
    return { hayMotivo: !!sel, opciones: sel?sel.options.length:0,
             hayNota: !!document.getElementById('dev-nota'),
             hayFoto: !!document.getElementById('dev-foto-data'),
             hayPreview: !!document.getElementById('dev-foto-preview'),
             hayCamara: !!document.getElementById('dev-foto-camara'),
             hayGaleria: !!document.getElementById('dev-foto-galeria') };
  });
  T('hay desplegable de motivo', r2.hayMotivo);
  T('con los 7 motivos', r2.opciones===7, String(r2.opciones));
  T('sigue el detalle escrito a mano', r2.hayNota);
  T('hay sitio para la foto', r2.hayFoto && r2.hayPreview);
  T('y se puede tomar o escoger de la galería', r2.hayCamara && r2.hayGaleria);

  console.log('\n3️⃣  🔑 SE GUARDAN EL MOTIVO Y LA FOTO');
  const r3 = await p.evaluate(async ()=>{
    // ⚠️ NO es una casilla de marcar: es una casilla de CANTIDAD, dev-cant-0.
    const c0 = document.getElementById('dev-cant-0');
    c0.value = '1';
    calcularTotalDevolucion('900');
    await new Promise(r=>setTimeout(r,200));
    document.getElementById('dev-motivo').value = 'defectuoso';
    document.getElementById('dev-nota').value = 'La tapa venía rota';
    document.getElementById('dev-foto-data').value = 'data:image/png;base64,AAAA';
    const oc=window.confirm; window.confirm=()=>true;
    const oa=window.alert; let dicho=null; window.alert=(m)=>{dicho=m;};
    procesarDevolucion(900);
    await new Promise(r=>setTimeout(r,500));
    window.confirm=oc; window.alert=oa;
    const ds=LS('ndevoluciones',[]);
    return { cuantas: ds.length, dev: ds[0], dicho };
  });
  T('se registró la devolución', r3.cuantas===1, String(r3.cuantas));
  T('🔑 con su motivo', r3.dev && r3.dev.motivo==='defectuoso', r3.dev&&r3.dev.motivo);
  T('y el texto del motivo, para leerlo', r3.dev && /da\u00f1ado|dañado/.test(r3.dev.motivoTexto||''), r3.dev&&r3.dev.motivoTexto);
  T('🔑 con su foto de prueba', r3.dev && r3.dev.foto==='data:image/png;base64,AAAA', r3.dev&&(r3.dev.foto||'').slice(0,30));
  T('con el detalle escrito', r3.dev && r3.dev.nota==='La tapa venía rota', r3.dev&&r3.dev.nota);
  T('y con su fecha y hora', r3.dev && !!r3.dev.fecha && !!r3.dev.hora, r3.dev&&(r3.dev.fecha+' '+r3.dev.hora));

  console.log('\n4️⃣  🔒 SIN FOTO TAMBIÉN SE PUEDE (es opcional)');
  const r4 = await p.evaluate(async ()=>{
    localStorage.removeItem('ndevoluciones');
    const vs=LS('nv',[]); vs[0].items=[{pid:'p1',nombre:'Gel 700ml',cant:4,precio:10,costo:4}];
    vs[0].total=40; delete vs[0].ajustadaPorDevolucion; delete vs[0].modificada;
    localStorage.setItem('nv', JSON.stringify(vs)); ventas=LS('nv',[]);
    abrirDevolucion(900);
    await new Promise(r=>setTimeout(r,350));
    const c0=document.getElementById('dev-cant-0');
    c0.value='1';
    calcularTotalDevolucion('900');
    await new Promise(r=>setTimeout(r,200));
    document.getElementById('dev-motivo').value='no_vendio';
    const oc=window.confirm; window.confirm=()=>true; const oa=window.alert; window.alert=()=>{};
    procesarDevolucion(900);
    await new Promise(r=>setTimeout(r,450));
    window.confirm=oc; window.alert=oa;
    const d=LS('ndevoluciones',[])[0];
    return { motivo:d?d.motivo:null, foto:d?d.foto:'(no hay devolucion)' };
  });
  T('se guarda igual sin foto', r4.motivo==='no_vendio', String(r4.motivo));
  T('🔒 y la foto queda vacía, no rota', r4.foto===null, String(r4.foto));

  console.log(`\n  ${ok} bien · ${mal} mal`);
  const reales=errs.filter(e=>!/firebase|onAuthStateChanged/i.test(e));
  if(reales.length){ console.log('⚠️ JS:'); reales.forEach(e=>console.log('   '+e)); }
  await b.close();
  process.exit(mal||reales.length?1:0);
})();
