const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file:///home/claude/trabajo/index.html');
  await p.waitForTimeout(2500);

  let ok=0,mal=0;
  const T=(n,c,d)=>{ if(c){ok++;console.log('  ✅ '+n);} else {mal++;console.log('  ❌ '+n+(d?'  →  '+d:''));} };

  console.log('\n1️⃣  LA FUNCIÓN QUE FALTABA (por eso reventaba en silencio)');
  const r1 = await p.evaluate(()=>({
    existeLimpiar: typeof limpiarPendientesQueNoSonDatos === 'function',
    existeNombres: typeof nombresPendientesDeSubir === 'function',
    existeBonito : typeof nombreBonitoDeClave === 'function'
  }));
  T('limpiarPendientesQueNoSonDatos ya existe', r1.existeLimpiar);
  T('nombresPendientesDeSubir existe', r1.existeNombres);
  T('nombreBonitoDeClave existe', r1.existeBonito);

  console.log('\n2️⃣  EL PENDIENTE FANTASMA QUE NUNCA SE IBA');
  const r2 = await p.evaluate(()=>{
    localStorage.setItem('nbs_pendientes_subir', JSON.stringify({ 'basura_de_version_vieja': Date.now() }));
    const antes = hayPendientesDeSubir();
    limpiarPendientesQueNoSonDatos();
    return { antes, despues: hayPendientesDeSubir() };
  });
  T('un pendiente que no es dato se limpia (1 → 0)', r2.antes===1 && r2.despues===0, r2.antes+' → '+r2.despues);

  const r2b = await p.evaluate(()=>{
    localStorage.setItem('ncl','[{"id":1}]');
    localStorage.setItem('nbs_pendientes_subir', JSON.stringify({ ncl: Date.now() }));
    limpiarPendientesQueNoSonDatos();
    return hayPendientesDeSubir();
  });
  T('🔒 un pendiente DE VERDAD no se borra', r2b===1, String(r2b));

  console.log('\n3️⃣  EL TOQUE EN EL AVISO — antes no hacía nada');
  const r3 = await p.evaluate(async ()=>{
    localStorage.setItem('nbs_pendientes_subir', JSON.stringify({ nv: Date.now() }));
    localStorage.setItem('nv','[]');
    var viejo = document.getElementById('aviso-sin-sincronizar');
    if(viejo) viejo.remove();
    actualizarAvisoPendientes();
    var av = document.getElementById('aviso-sin-sincronizar');
    return { existe: !!av, texto: av?av.textContent:null,
             loQueLlama: av && av.onclick ? av.onclick.toString() : null };
  });
  T('el aviso aparece', r3.existe);
  T('el toque llama a reintentarYDecirmeElError (no a subirPendientes a secas)',
     /reintentarYDecirmeElError/.test(r3.loQueLlama||''), (r3.loQueLlama||'').slice(0,120));

  console.log('\n4️⃣  QUÉ LE CONTESTA AHORA AL TOCARLO');
  const r4 = await p.evaluate(async ()=>{
    window.fbAuth = undefined;                       // como cuando no ha entrado a la nube
    var dicho=[]; var oav = window.avisoGrande; window.avisoGrande=function(m){ dicho.push(m); };
    document.getElementById('aviso-sin-sincronizar').onclick();
    window.avisoGrande = oav;
    return dicho;
  });
  console.log('     dice: ' + JSON.stringify(r4[0]||'').slice(0,150));
  T('sin sesión: le dice qué pasa y que no se pierde nada',
     /no se pierde|NO se pierden|guardados en el telefono/i.test(r4[0]||''), (r4[0]||'').slice(0,90));
  T('le dice QUÉ está esperando, en cristiano ("ventas")', /ventas/.test(r4[0]||''), (r4[0]||'').slice(0,120));

  const r5 = await p.evaluate(async ()=>{
    window.fbAuth = { currentUser: { uid:'x' } };
    Object.defineProperty(navigator,'onLine',{ value:false, configurable:true });
    var dicho=[]; var oav=window.avisoGrande; window.avisoGrande=function(m){dicho.push(m);};
    document.getElementById('aviso-sin-sincronizar').onclick();
    window.avisoGrande=oav;
    return dicho;
  });
  T('sin internet: le dice que se sube solo al volver la señal',
     /se sube solo|vuelva la se/i.test(r5[0]||''), (r5[0]||'').slice(0,90));

  const r6 = await p.evaluate(async ()=>{
    Object.defineProperty(navigator,'onLine',{ value:true, configurable:true });
    localStorage.setItem('nbs_pendientes_subir','{}');
    var dicho=[]; var oav=window.avisoGrande; window.avisoGrande=function(m){dicho.push(m);};
    reintentarYDecirmeElError();
    window.avisoGrande=oav;
    var av=document.getElementById('aviso-sin-sincronizar');
    return { dicho, ocultado: av ? av.style.display : null };
  });
  T('si ya no queda nada: lo dice y apaga el aviso',
     /Ya no hay nada pendiente/.test(r6.dicho[0]||'') && r6.ocultado==='none',
     (r6.dicho[0]||'')+' / display:'+r6.ocultado);

  console.log('\n══════════════════════════════');
  console.log(`  ${ok} bien · ${mal} mal`);
  const reales=errs.filter(e=>!/firebase|onAuthStateChanged/i.test(e));
  if(reales.length){ console.log('⚠️ JS:'); reales.forEach(e=>console.log('   '+e)); }
  await b.close();
  process.exit(mal||reales.length?1:0);
})();
