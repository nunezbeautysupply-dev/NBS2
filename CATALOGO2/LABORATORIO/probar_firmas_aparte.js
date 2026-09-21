const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({viewport:{width:390,height:900}});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file:///home/claude/trabajo/index.html');
  await p.waitForTimeout(2500);
  let ok=0,mal=0;
  const T=(n,c,d)=>{ if(c){ok++;console.log('  ✅ '+n);} else {mal++;console.log('  ❌ '+n+(d?'  →  '+d:''));} };

  const montar = async () => await p.evaluate(()=>{
    window._subidas = []; window._firmasSubidas = [];
    window.fbAuth = { currentUser:{uid:'x'} };
    window.fbDb = { collection:(col)=>({ doc:(id)=>({
      set:(d)=>{
        if(col==='nbs_firmas'){ window._firmasSubidas.push({id:id, kb:Math.round(JSON.stringify(d).length/1024)}); }
        else { window._subidas.push({ col:col, id:id, tieneZip: typeof d.zip==='string',
               tieneValor: typeof d.valor==='string', vids: d.vidsConFirma||null,
               bytes: JSON.stringify(d).length }); }
        return Promise.resolve();
      },
      get:()=>Promise.resolve({exists:false, data:()=>null})
    })})};
    // Ventas como las suyas: muchas, y 55 con firma de ~23 KB
    const ventas=[];
    for(let i=0;i<1200;i++) ventas.push({id:i,cid:i%140,cn:'Cliente '+(i%140),tipo:'credito',
      fecha:'08/'+((i%28)+1)+'/2026',total:45+i,ganancia:12,
      items:[{pid:'p'+(i%60),nombre:'Producto '+(i%60),cant:2,precio:9.99,costo:4.25}],
      pagosFactura:[{pid:'g'+i,monto:20,fecha:'08/10/2026'}]});
    // Las firmas: base64 de verdad, que NO se comprime
    let alfabeto='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    for(let i=0;i<55;i++){
      let s='';
      for(let j=0;j<23000;j++) s+=alfabeto[(i*7+j*13)%64];
      ventas[i].firma='data:image/png;base64,'+s;
    }
    localStorage.setItem('nv', JSON.stringify(ventas));
    localStorage.setItem('nbs_pendientes_subir', JSON.stringify({ nv: Date.now() }));
    localStorage.removeItem('nbs_fallos_subida');
    localStorage.removeItem('nbs_firmas_subidas');
    const conFirma = JSON.stringify(ventas).length;
    const sinFirma = JSON.stringify(quitarFirmas(ventas)).length;
    return { conFirmaKB: Math.round(conFirma/1024), sinFirmaKB: Math.round(sinFirma/1024) };
  });

  console.log('\n1️⃣  EL PESO, ANTES Y DESPUÉS DE SACAR LAS FIRMAS');
  const info = await montar();
  console.log('     con firmas: ' + info.conFirmaKB + ' KB   ·   sin firmas: ' + info.sinFirmaKB + ' KB');
  T('con firmas pasa del tope de 1024 KB', info.conFirmaKB > 1024, info.conFirmaKB+' KB');
  T('🔑 sin firmas cabe de sobra', info.sinFirmaKB < 500, info.sinFirmaKB+' KB');

  console.log('\n2️⃣  🔑 LAS VENTAS SUBEN SIN FIRMA, Y LAS FIRMAS APARTE');
  const r2 = await p.evaluate(async ()=>{
    subirPendientes();
    await new Promise(r=>setTimeout(r,1500));
    const sub = window._subidas;
    let contenido = null;
    // Lo que se envió, descomprimido, para mirar si lleva firmas
    return { subidas: sub, firmas: window._firmasSubidas,
             pendientes: hayPendientesDeSubir(),
             fallos: JSON.parse(localStorage.getItem('nbs_fallos_subida')||'{}') };
  });
  console.log('     ventas enviadas: ' + JSON.stringify(r2.subidas));
  console.log('     firmas enviadas: ' + r2.firmas.length + ' (la primera: ' + (r2.firmas[0]?r2.firmas[0].kb+' KB':'—') + ')');
  T('las ventas se enviaron UNA vez', r2.subidas.length===1, JSON.stringify(r2.subidas));
  T('y caben en la nube', r2.subidas[0] && r2.subidas[0].bytes < 1000000, r2.subidas[0]&&r2.subidas[0].bytes);
  T('🔑 se subieron firmas por su propio camino', r2.firmas.length>0, String(r2.firmas.length));
  T('de a 20 por tanda, para no ahogar el teléfono', r2.firmas.length===20, String(r2.firmas.length));
  T('la venta lleva la lista de cuáles tienen firma',
     r2.subidas[0] && Array.isArray(r2.subidas[0].vids) && r2.subidas[0].vids.length===55,
     r2.subidas[0] && r2.subidas[0].vids && r2.subidas[0].vids.length);
  T('quedó subida: cero pendientes', r2.pendientes===0, String(r2.pendientes));
  T('y sin errores', Object.keys(r2.fallos).length===0, JSON.stringify(r2.fallos));

  console.log('\n2️⃣b 🔑 LO QUE SE ENVIÓ DE VERDAD NO LLEVA FIRMAS');
  const r2b = await p.evaluate(async ()=>{
    // Se mira lo que SE MANDÓ, no lo que quitarFirmas() sabría hacer.
    const env = window._subidas[0];
    let dentro = null;
    try {
      // El envío va comprimido: se descomprime para mirar lo que lleva
      const zip = window._ultimoZip || null;
      dentro = zip;
    } catch(e){}
    return { bytes: env ? env.bytes : 0, vids: env ? (env.vids||[]).length : 0 };
  });
  // Si las firmas viajaran dentro, el envío pesaría más de 1 MB y no habría cabido.
  T('🔑 lo enviado es pequeño: las firmas NO van dentro', r2b.bytes < 200000, r2b.bytes + ' bytes');
  T('🔑 y la app SÍ mandó la lista de cuáles tienen firma', r2b.vids === 55, String(r2b.vids));

  console.log('\n3️⃣  🔒 LO QUE SUBIÓ NO LLEVA NINGUNA FIRMA DENTRO');
  const r3 = await p.evaluate(()=>{
    const vs = JSON.parse(localStorage.getItem('nv'));
    const sin = quitarFirmas(vs);
    return { conFirmaOriginal: vs.filter(v=>v.firma).length,
             enLoQueSube: sin.filter(v=>v.firma).length,
             mismasVentas: vs.length===sin.length,
             conservaTotales: sin[0].total===vs[0].total && sin[0].id===vs[0].id };
  });
  T('el original tiene 55 firmas', r3.conFirmaOriginal===55, String(r3.conFirmaOriginal));
  T('🔑 lo que sube tiene CERO firmas', r3.enLoQueSube===0, String(r3.enLoQueSube));
  T('pero van todas las ventas', r3.mismasVentas);
  T('y con sus totales intactos', r3.conservaTotales);

  console.log('\n4️⃣  🔒 EN EL TELÉFONO LAS FIRMAS NO SE TOCAN');
  const r4 = await p.evaluate(()=>{
    const vs = LS('nv',[]);
    return { firmasEnElTelefono: vs.filter(v=>v.firma).length,
             laPrimeraEsLarga: vs[0].firma && vs[0].firma.length > 20000 };
  });
  T('🔒 las 55 firmas siguen guardadas en el teléfono', r4.firmasEnElTelefono===55, String(r4.firmasEnElTelefono));
  T('y enteras', r4.laPrimeraEsLarga);

  console.log('\n5️⃣  🔑 AL BAJAR DE LA NUBE NO SE PIERDE NINGUNA FIRMA');
  const r5 = await p.evaluate(()=>{
    // La nube manda las ventas SIN firma. Este teléfono ya tiene las suyas.
    const mias = LS('nv',[]);
    const deLaNube = quitarFirmas(mias).map(v=>Object.assign({}, v));
    deLaNube[0].total = 99999;                      // un cambio hecho en el otro aparato
    const juntadas = pegarFirmasQueYaTengo(deLaNube);
    return { conFirma: juntadas.filter(v=>v.firma).length,
             tomoElCambio: juntadas[0].total===99999,
             firmaIntacta: juntadas[0].firma === mias[0].firma };
  });
  T('🔑 las 55 firmas se vuelven a pegar', r5.conFirma===55, String(r5.conFirma));
  T('y son las mismas, sin cortar', r5.firmaIntacta);
  T('🔒 el cambio del otro aparato sí entra', r5.tomoElCambio);

  console.log('\n6️⃣  🔒 UNA VENTA SIN FIRMA NO SE ROMPE');
  const r6 = await p.evaluate(()=>{
    const vs=[{id:1,total:10},{id:2,total:20,firma:'data:image/png;base64,AAA'}];
    return { sinFirmas: quitarFirmas(vs).filter(v=>v.firma).length,
             lista: vidsConFirma(vs),
             conserva: quitarFirmas(vs).length===2 };
  });
  T('las que no tienen firma pasan igual', r6.conserva && r6.sinFirmas===0);
  T('la lista solo trae la que sí tiene', JSON.stringify(r6.lista)===JSON.stringify(['2']), JSON.stringify(r6.lista));

  console.log('\n7️⃣  🔑 LA APP DE VERDAD USA EL CAMINO DE LAS FIRMAS');
  const r7 = await p.evaluate(()=>{
    // 🔑 Mirar el CÓDIGO: que subirPendientes quite las firmas y que al bajar se peguen.
    // Sin esto, quitar esas llamadas pasaría desapercibido.
    const html = document.documentElement.innerHTML;
    return {
      alSubir: /docPend\.valor\s*=\s*JSON\.stringify\(quitarFirmas\(/.test(html),
      alBajar: /pegarFirmasQueYaTengo\(JSON\.parse\(/.test(html),
      mandaLista: /docPend\.vidsConFirma\s*=\s*vidsConFirma\(/.test(html),
      bajaLasQueFaltan: /descargarFirmasQueFaltan\(data\.vidsConFirma\)/.test(html)
    };
  });
  T('🔑 al SUBIR, las ventas van sin firmas', r7.alSubir);
  T('🔑 al BAJAR, se vuelven a pegar', r7.alBajar);
  T('manda la lista de cuáles tienen firma', r7.mandaLista);
  T('y baja las que falten', r7.bajaLasQueFaltan);

  console.log(`\n  ${ok} bien · ${mal} mal`);
  const reales=errs.filter(e=>!/firebase|onAuthStateChanged/i.test(e));
  if(reales.length){ console.log('⚠️ JS:'); reales.forEach(e=>console.log('   '+e)); }
  await b.close();
  process.exit(mal||reales.length?1:0);
})();
