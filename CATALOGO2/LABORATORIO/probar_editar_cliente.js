const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch({args:['--no-sandbox']});
  const p = await b.newPage({viewport:{width:390,height:900}});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file:///home/claude/trabajo/index.html');
  await p.waitForTimeout(2500);
  let ok=0,mal=0;
  const T=(n,c,d)=>{ if(c){ok++;console.log('  ✅ '+n);} else {mal++;console.log('  ❌ '+n+(d?'  →  '+d:''));} };

  const r = await p.evaluate(async ()=>{
    ['pantalla-login','pantalla-bloqueo'].forEach(id=>{const e=document.getElementById(id); if(e) e.style.display='none';});
    const a=document.getElementById('app-contenido'); if(a) a.style.display='block';
    localStorage.setItem('ncl', JSON.stringify([{id:7,nombre:'Nelson',apellido:'Castro De La Cruz',apodo:'TITO',
      negocio:'RD BARBERSHOP',tel:'3473036436',dir:'1 Main St',ciudad:'Providence',estado:'RI',zip:'02904'}]));
    clientes=LS('ncl',[]);
    // ⚠️ Sin abrir la pantalla, TODO mide 0 y la prueba diria que esta escondido aunque
    // no lo este. Hay que entrar a la pantalla del perfil como entra Sensei.
    editarCl(7);
    ir('p-cl-perfil');
    await new Promise(r=>setTimeout(r,500));
    const ver = (id)=>{
      const e=document.getElementById(id);
      if(!e) return {existe:false};
      const r=e.getBoundingClientRect();
      return { existe:true, valor:e.value, alto:Math.round(r.height), ancho:Math.round(r.width),
               visible: r.height>0 && r.width>0 && getComputedStyle(e).display!=='none' };
    };
    return { n:ver('ecl-n'), a:ver('ecl-a'), apodo:ver('ecl-apodo'),
             negocio:ver('ecl-ne'), tel:ver('ecl-t'),
             foto: (function(){ const f=document.getElementById('ecl-foto-preview');
                                return f ? f.getBoundingClientRect().height : null; })() };
  });

  console.log('\n1️⃣  LOS TRES CAMPOS QUE NO APARECÍAN');
  T('🔴 NOMBRE se ve', r.n.visible, JSON.stringify(r.n));
  T('🔴 APELLIDO se ve', r.a.visible, JSON.stringify(r.a));
  T('🔴 APODO se ve', r.apodo.visible, JSON.stringify(r.apodo));

  console.log('\n2️⃣  Y TRAEN LOS DATOS DEL CLIENTE');
  T('el nombre dice "Nelson"', r.n.valor==='Nelson', r.n.valor);
  T('el apellido dice "Castro De La Cruz"', r.a.valor==='Castro De La Cruz', r.a.valor);
  T('el apodo dice "TITO"', r.apodo.valor==='TITO', r.apodo.valor);

  console.log('\n3️⃣  LO DEMÁS SIGUE COMO ESTABA');
  T('la pantalla se está midiendo de verdad (los campos tienen alto)', r.n.alto > 10, String(r.n.alto));
  T('el negocio se ve y trae su valor', r.negocio.visible && /RD BARBERSHOP/.test(r.negocio.valor||''), JSON.stringify(r.negocio));
  T('el teléfono se ve', r.tel.visible, JSON.stringify(r.tel));
  T('la foto sigue escondida (como estaba)', r.foto===0, String(r.foto));

  console.log('\n4️⃣  Y SE PUEDE GUARDAR EL CAMBIO');
  const r4 = await p.evaluate(async ()=>{
    document.getElementById('ecl-n').value='Nelson Antonio';
    document.getElementById('ecl-apodo').value='EL TITO';
    const oa=window.alert; window.alert=function(){}; const oc=window.confirm; window.confirm=function(){return true;};
    guardarEdicionCl(7);
    await new Promise(r=>setTimeout(r,400));
    window.alert=oa; window.confirm=oc;
    const c=LS('ncl',[]).find(x=>String(x.id)==='7');
    return { nombre:c.nombre, apodo:c.apodo, apellido:c.apellido, negocio:c.negocio };
  });
  T('guardó el nombre nuevo', r4.nombre==='Nelson Antonio', r4.nombre);
  T('guardó el apodo nuevo', r4.apodo==='EL TITO', r4.apodo);
  T('no se perdió el apellido', r4.apellido==='Castro De La Cruz', r4.apellido);
  T('no se perdió la barbería', /RD BARBERSHOP/i.test(r4.negocio||''), r4.negocio);

  console.log(`\n  ${ok} bien · ${mal} mal`);
  const reales=errs.filter(e=>!/firebase|onAuthStateChanged/i.test(e));
  if(reales.length){ console.log('⚠️ JS:'); reales.forEach(e=>console.log('   '+e)); }
  await b.close();
  process.exit(mal||reales.length?1:0);
})();
