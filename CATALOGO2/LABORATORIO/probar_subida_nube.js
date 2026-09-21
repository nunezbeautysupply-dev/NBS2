const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({viewport:{width:390,height:900}});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file:///home/claude/trabajo/index.html');
  await p.waitForTimeout(2500);
  let ok=0,mal=0;
  const T=(n,c,d)=>{ if(c){ok++;console.log('  ✅ '+n);} else {mal++;console.log('  ❌ '+n+(d?'  →  '+d:''));} };

  // Una nube de mentira que se puede hacer fallar a voluntad
  const montar = async (comoFalla) => await p.evaluate((modo)=>{
    window._subidas = [];
    window.fbAuth = { currentUser:{uid:'x'} };
    window.fbDb = { collection:()=>({ doc:()=>({ set:(d)=>{
      window._subidas.push({ tieneZip: typeof d.zip==='string', tieneValor: typeof d.valor==='string',
                             bytes: JSON.stringify(d).length });
      if(modo==='falla-todo') return Promise.reject({code:'invalid-argument',
        message:'The value of property "valor" is longer than 1048487 bytes.'});
      if(modo==='falla-comprimido' && typeof d.zip==='string')
        return Promise.reject({code:'permission-denied', message:'Missing or insufficient permissions.'});
      return Promise.resolve();
    }})})};
    localStorage.removeItem('nbs_fallos_subida');
    // Unas ventas GRANDES, como las suyas: 1.5 MB
    const ventas=[];
    for(let i=0;i<1200;i++) ventas.push({id:i,cid:i%140,cn:'Cliente '+(i%140),tipo:'credito',
      fecha:'08/'+((i%28)+1)+'/2026',total:45+i,ganancia:12,
      items:[{pid:'p'+(i%60),nombre:'Producto '+(i%60),cant:2,precio:9.99,costo:4.25}],
      pagosFactura:[{pid:'g'+i,monto:20,fecha:'08/10/2026'}], relleno:'x'.repeat(900)});
    localStorage.setItem('nv', JSON.stringify(ventas));
    localStorage.setItem('nbs_pendientes_subir', JSON.stringify({ nv: Date.now() }));
    return { kb: Math.round(JSON.stringify(ventas).length/1024),
             sabeComprimir: navegadorSabeComprimir() };
  }, comoFalla);

  console.log('\n1️⃣  UNAS VENTAS TAN GRANDES COMO LAS SUYAS');
  let info = await montar('ok');
  console.log('     ventas: ' + info.kb + ' KB   ·   ¿sabe comprimir?: ' + (info.sabeComprimir?'SÍ':'NO'));
  T('pesan más de 1 MB, como las suyas', info.kb > 1024, info.kb+' KB');

  console.log('\n2️⃣  🔑 SUBEN COMPRIMIDAS, NO A LO BRUTO');
  const r2 = await p.evaluate(async ()=>{
    subirPendientes();
    await new Promise(r=>setTimeout(r,1200));
    return { subidas: window._subidas, pendientes: hayPendientesDeSubir(),
             fallos: JSON.parse(localStorage.getItem('nbs_fallos_subida')||'{}') };
  });
  console.log('     lo que se envió: ' + JSON.stringify(r2.subidas));
  T('se envió UNA sola vez', r2.subidas.length===1, JSON.stringify(r2.subidas));
  T('🔑 y se envió COMPRIMIDA (campo zip)', r2.subidas[0] && r2.subidas[0].tieneZip===true, JSON.stringify(r2.subidas[0]));
  T('lo comprimido cabe de sobra en la nube', r2.subidas[0] && r2.subidas[0].bytes < 1000000, r2.subidas[0]&&r2.subidas[0].bytes);
  T('quedó subida: cero pendientes', r2.pendientes===0, String(r2.pendientes));
  T('y sin errores apuntados', Object.keys(r2.fallos).length===0, JSON.stringify(r2.fallos));

  console.log('\n3️⃣  🔴 EL FALLO QUE CAZÓ SENSEI: si el envío comprimido falla');
  await montar('falla-comprimido');
  const r3 = await p.evaluate(async ()=>{
    subirPendientes();
    await new Promise(r=>setTimeout(r,1200));
    return { subidas: window._subidas, fallos: JSON.parse(localStorage.getItem('nbs_fallos_subida')||'{}') };
  });
  console.log('     lo que se envió: ' + JSON.stringify(r3.subidas));
  T('🔑 NO reintenta a lo bruto con algo que no cabe',
     r3.subidas.filter(x=>x.tieneValor).length===0, JSON.stringify(r3.subidas));
  T('🔑 y guarda el error DE VERDAD (permisos), no el del crudo',
     r3.fallos.nv && r3.fallos.nv.codigo==='permission-denied', JSON.stringify(r3.fallos.nv));
  T('dice por dónde fue', /comprimido/.test(r3.fallos.nv?r3.fallos.nv.como:''), r3.fallos.nv&&r3.fallos.nv.como);
  T('apunta cuánto pesa sin comprimir', r3.fallos.nv && r3.fallos.nv.crudoKB > 1024, r3.fallos.nv&&r3.fallos.nv.crudoKB);
  T('y si el teléfono sabe comprimir', r3.fallos.nv && r3.fallos.nv.sabeComprimir===true, r3.fallos.nv&&r3.fallos.nv.sabeComprimir);

  console.log('\n4️⃣  🔒 SI EL TELÉFONO NO SABE COMPRIMIR, LO DICE CLARO');
  const r4 = await p.evaluate(async ()=>{
    const guardado = window.CompressionStream;
    delete window.CompressionStream;                 // como un teléfono viejo
    localStorage.removeItem('nbs_fallos_subida');
    localStorage.setItem('nbs_pendientes_subir', JSON.stringify({ nv: Date.now() }));
    window._subidas = [];
    subirPendientes();
    await new Promise(r=>setTimeout(r,1000));
    const f = JSON.parse(localStorage.getItem('nbs_fallos_subida')||'{}');
    window.CompressionStream = guardado;
    return { subidas: window._subidas, fallo: f.nv };
  });
  T('🔒 no intenta subir algo que no cabe', r4.subidas.length===0, JSON.stringify(r4.subidas));
  // El codigo es 'no-cabe' y el detalle va en el mensaje; se miran los dos.
  T('dice que no cabe y cuánto pesa',
     r4.fallo && r4.fallo.codigo==='no-cabe' && /1024 KB/.test(r4.fallo.mensaje||''),
     JSON.stringify(r4.fallo));
  T('y avisa que el teléfono no pudo comprimir',
     r4.fallo && r4.fallo.sabeComprimir===false, r4.fallo&&r4.fallo.sabeComprimir);

  console.log('\n5️⃣  🔒 LO CHICO SIGUE SUBIENDO IGUAL QUE SIEMPRE');
  const r5 = await p.evaluate(async ()=>{
    localStorage.setItem('ncl', JSON.stringify([{id:1,nombre:'Isidro',negocio:'URBAN'}]));
    localStorage.setItem('nbs_pendientes_subir', JSON.stringify({ ncl: Date.now() }));
    localStorage.removeItem('nbs_fallos_subida');
    window._subidas = [];
    subirPendientes();
    await new Promise(r=>setTimeout(r,900));
    return { subidas: window._subidas, pendientes: hayPendientesDeSubir(),
             fallos: JSON.parse(localStorage.getItem('nbs_fallos_subida')||'{}') };
  });
  T('los clientes suben SIN comprimir, como siempre',
     r5.subidas.length===1 && r5.subidas[0].tieneValor===true, JSON.stringify(r5.subidas));
  T('y quedan subidos', r5.pendientes===0 && !Object.keys(r5.fallos).length, String(r5.pendientes));

  console.log(`\n  ${ok} bien · ${mal} mal`);
  const reales=errs.filter(e=>!/firebase|onAuthStateChanged/i.test(e));
  if(reales.length){ console.log('⚠️ JS:'); reales.forEach(e=>console.log('   '+e)); }
  await b.close();
  process.exit(mal||reales.length?1:0);
})();
